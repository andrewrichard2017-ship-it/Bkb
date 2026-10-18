// Tractor Tippin': one night on the farm. Holds the world, the players, the tractors and Thrasher, and runs
// the rules: sneaking up, honking, tipping, the noise that wakes Thrasher, getting hit, the gate, escaping,
// and the score. In an online game the host runs the rules and the guest mirrors them from snapshots.
//
// Modes:  story   tip enough tractors to open the gate, then escape through it (1 or 2 players as a team)
//         tipoff  2½ minutes, Thrasher hunts from the start, most tips wins (1 player = score attack)
//         hunt    a player drives Thrasher; the runners (a player and/or computer drivers) tip enough to
//                 open the gate and escape before he catches them all or the clock runs out
//         attract the title screen: nobody driving, the odd tractor falls over
(() => {
  'use strict';
  const TT = window.TT, { clamp } = TT.math;

  class Game {
    // cfg: { mode, level, humans: [{ slot, car, name, remote, view }], role: 'solo'|'host'|'guest',
    //        thrasher: { slot, name, remote, view } (hunt: a player drives him), ai: ['dash', ...] (computer-driven cars) }
    constructor(cfg, renderer, quality) {
      this.cfg = cfg; this.mode = cfg.mode; this.level = cfg.level; this.quality = quality;
      this.role = cfg.role || 'solo'; this.authority = this.role !== 'guest';
      this.humans = cfg.humans.length + (cfg.thrasher ? 1 : 0);
      this.events = [];
      const race = this.race = !!cfg.level.race;
      this.world = race ? new TT.RaceWorld(cfg.level, renderer, quality) : new TT.World(cfg.level, renderer, quality);
      if (race) this.world.makeGrid([...(cfg.ai || []).map((c, i) => 2 + i), ...cfg.humans.map(h => h.slot)]); // computer cars at the front
      this.players = cfg.humans.map(h => new TT.Car(this, h));
      (cfg.ai || []).forEach((car, i) => {
        const c = new TT.Car(this, { slot: 2 + i, car, name: TT.CARS[car].name, ai: true, remote: !this.authority });
        if (this.authority) c.ai = race ? new TT.RaceAI(c, i === 0 ? 1.0 : 0.9 + (i % 3) * 0.03) : new TT.CarAI(c); // the track's champion drives best
        this.players.push(c);
      });
      this.tractors = this.world.tractorSpots.map((s, i) => new TT.Tractor(this, s, i));
      this.thrasher = race ? new TT.ThrasherStub() : new TT.Thrasher(this);
      if (race) { this.laps = cfg.level.laps; this.finishers = 0; this.firstFinish = -1; for (const p of this.players) this.raceInit(p); }
      if (cfg.thrasher) this.thrasher.pilotBy(cfg.thrasher);
      const hunt = this.mode === 'hunt';
      this.maxDents = hunt ? TT.HUNT_DENTS : TT.DENTS;
      this.threshold = cfg.level.wake; this.alarm = 0; this.teamTips = 0; this.goal = hunt ? Math.ceil(cfg.level.tractors * 0.8) : cfg.level.goal; // hunt: most of the herd, so Thrasher has a chance
      this.recoverTime = this.mode === 'tipoff' ? 9 : this.mode === 'attract' ? 7 : cfg.level.recover;
      this.state = this.mode === 'attract' ? 'play' : 'countdown';
      this.time = this.mode === 'attract' ? 0 : -3.6; this.clock = 0; this.lastCount = 9;
      this.gateOpen = false; this.gateT = 0; this.over = false; this.hold = false; this.demoT = 3;
      this.net = null;
    }
    emit(type, e = {}) { e.type = type; this.events.push(e); return e; }
    get timeLeft() { return Math.max(0, (this.mode === 'hunt' ? TT.HUNT_TIME : TT.TIPOFF_TIME) - this.clock); }

    update(dt) {
      this.time += dt;
      if (this.state === 'countdown' && !this.hold) {
        const n = Math.ceil(-this.time);
        if (n !== this.lastCount && n >= 1 && n <= 3) this.emit('count', { n });
        this.lastCount = n;
        if (this.time >= 0) { this.state = 'play'; this.emit('go'); }
      } else if (this.state === 'countdown') this.time = Math.min(this.time, -3.0);
      const canDrive = this.state === 'play';
      if (this.state === 'play' && this.mode !== 'attract') this.clock += dt;
      for (const p of this.players) { if (p.ai) p.ai.think(dt); p.remote ? p.netStep(dt) : p.step(dt, canDrive); }
      this.collisions(dt);
      if (this.race) this.raceTrack();
      if (this.authority) {
        for (const t of this.tractors) t.update(dt);
        if (this.state === 'play') this.rules(dt);
        this.thrasher.update(dt);
      } else {
        for (const t of this.tractors) t.t += dt;
        if (this.thrasher.controller === 'local') this.thrasher.pilot(dt); else this.thrasher.netStep(dt);
      }
      if (this.world.gateOpen !== this.gateOpen) this.world.setGateOpen(this.gateOpen);
    }

    // ---------------------------------------------------------------- the rules (host / single machine)
    rules(dt) {
      if (this.race) return this.raceRules(dt);
      const th = this.thrasher, story = this.mode === 'story', hunt = this.mode === 'hunt';
      for (const p of this.players) {
        if (!p.active) continue;
        const sp = Math.abs(p.vf);
        // creep up slowly or they wake up grumpy (no tip)
        for (const t of this.tractors) {
          if (t.state !== 'sleep') continue;
          const d = Math.hypot(t.x - p.x, t.z - p.z);
          if ((d < TT.WAKE_R && sp > TT.SNEAK) || (p.boosting && d < 15)) { t.set('wary', p); if (story) this.alarm += 5; }
        }
        if (story) {
          if (p.boosting) this.alarm += 4 * dt;
          if (!th.awake && Math.hypot(th.x - p.x, th.z - p.z) < 30 && sp > TT.SNEAK) this.alarm += 22 * dt;
        }
        // remote cars escape by where the guest says they are
        if (p.remote && !p.escaped && p.z < -this.world.H - 3) this.escape(p);
      }
      if (story) {
        if ((th.state === 'sleep' || th.state === 'home') && this.alarm >= this.threshold) { this.alarm = this.threshold; th.wake(); }
        if (th.state === 'sleep') this.alarm = Math.max(0, this.alarm - 1.6 * dt);
        if (th.hunting) this.alarm = this.threshold;
      } else if (this.mode === 'tipoff') {
        this.alarm = clamp(this.clock / 12, 0, 1) * this.threshold;
        if (this.clock > 12 && th.state === 'sleep') th.wake();
      } else if (this.mode === 'attract') {
        this.demoT -= dt;
        if (this.demoT <= 0) {
          this.demoT = 4 + Math.random() * 3;
          const sleepers = this.tractors.filter(t => t.state === 'sleep');
          if (sleepers.length) sleepers[Math.floor(Math.random() * sleepers.length)].set('startle', null);
        }
      }
      // Thrasher hits anyone he touches
      if (th.state === 'chase' || th.state === 'search' || th.state === 'home') {
        for (const p of this.players) {
          if (!p.active || p.invuln > 0 || p.hop > 0.3) continue;
          if (th.contact(p.x, p.z, p.spec.radius + 0.35)) this.hitPlayer(p); // reaches past the solid push-out in collisions()
        }
      }
      // the gate opens for GATE_TIME seconds; if anyone's still inside when it shuts, tip another to open it again
      if ((story || hunt) && !this.gateOpen && this.teamTips >= this.goal) { this.gateOpen = true; this.gateT = TT.GATE_TIME; this.emit('gateOpen'); }
      else if (this.gateOpen && (story || hunt)) {
        this.gateT -= dt;
        if (this.gateT <= 0 && this.players.some(p => p.active)) { this.gateOpen = false; this.goal = this.teamTips + 1; this.emit('gateClose'); }
      }
      if ((story || hunt) && this.players.length && this.players.every(p => !p.active)) this.finish();
      if (hunt && this.clock >= TT.HUNT_TIME) this.finish();
      if (this.mode === 'tipoff' && this.clock >= TT.TIPOFF_TIME) this.finish();
    }
    hitPlayer(p) {
      const th = this.thrasher, story = this.mode === 'story' || this.mode === 'hunt';
      const dx = p.x - th.x, dz = p.z - th.z, d = Math.hypot(dx, dz) || 1;
      let nx = dx / d + Math.sin(th.a) * 0.7, nz = dz / d + Math.cos(th.a) * 0.7;
      const n = Math.hypot(nx, nz) || 1; nx /= n; nz /= n;
      const power = 13 + Math.abs(th.v) * 0.6;
      if (p.remote) { p.invuln = 2.5; if (this.net) this.net.sendHit(p, nx, nz, power); } else p.knock(nx, nz, power);
      if (story) {
        p.dents++;
        if (p.dents >= this.maxDents) { p.caught = true; this.emit('caught', { p }); if (th.target === p) th.target = null; }
        else this.emit('hit', { p });
      } else {
        const lost = Math.min(2, p.tips); p.tips -= lost; p.invuln = 3;
        this.emit('hit', { p, lost });
      }
      if (!th.human) { th.set('gloat'); th.chargeT = 0; }
    }
    // Thrasher's roar (a player driving him presses the horn button): everything asleep nearby wakes up
    // grumpy, so it can't be tipped for a while, and anyone close gets a fright
    roar(th) {
      if (!this.authority) { if (this.net) this.net.sendRoar(); return; }
      let n = 0;
      for (const t of this.tractors) if (t.state === 'sleep' && Math.hypot(t.x - th.x, t.z - th.z) < 24) { t.set('wary', null); n++; }
      for (const p of this.players) if (p.active && !p.remote && Math.hypot(p.x - th.x, p.z - th.z) < 13) p.stunT = Math.max(p.stunT, 0.6);
      this.emit('bigRoar', { n });
    }
    // a horn: every sleeping tractor in range jumps and falls over
    // at: where the guest's car was when it honked (online), so lag doesn't move the horn
    honk(p, at) {
      if (!this.authority) { if (this.net) this.net.sendHonk(p); return; }
      if (this.state !== 'play') return;
      const hx = at ? at.x : p.x, hz = at ? at.z : p.z;
      let n = 0;
      for (const t of this.tractors) {
        const d = Math.hypot(t.x - hx, t.z - hz);
        if (d > p.spec.hornR) continue;
        if (t.state === 'sleep') { t.set('startle', p); n++; }
        else if (t.state === 'wary') this.emit('grumble', { tr: t });
      }
      if (this.mode === 'story') {
        this.alarm += p.spec.hornAlarm;
        if (!this.thrasher.awake && Math.hypot(this.thrasher.x - hx, this.thrasher.z - hz) < 32) this.alarm += 40;
      }
      this.emit('honkResult', { p, n });
    }
    // called when a tractor lands on its back
    tipped(t) {
      const p = t.by;
      this.teamTips++;
      if (p) { p.tips++; p.happyT = 2.2; }
      if (this.mode === 'story') this.alarm += 4;
      this.emit('tip', { p, tr: t });
    }
    escape(p) {
      if (p.escaped || p.caught) return;
      p.escaped = true; p.happyT = 99;
      this.emit('escape', { p });
      if (!this.authority && this.net) this.net.sendEscape();
    }
    // ---------------------------------------------------------------- races
    raceInit(p) {
      const n = this.world.nearest(p.x, p.z);
      p.race = { i: n.i, s: n.s, lat: n.lat, lap: n.s > this.world.track.L / 2 ? -1 : 0, half: false, fin: false, place: 0, time: 0, wrong: 0 };
    }
    // where everyone is round the lap (every machine; the host decides who's finished)
    raceTrack() {
      const L = this.world.track.L;
      for (const p of this.players) {
        const R = p.race; if (!R) continue;
        const n = this.world.nearest(p.x, p.z, R.i), prev = R.s;
        R.i = n.i; R.s = n.s; R.lat = n.lat;
        if (n.s > L * 0.4 && n.s < L * 0.6) R.half = true;
        if (prev > L * 0.75 && n.s < L * 0.25 && (R.half || R.lap < 0)) { R.lap++; R.half = false; if (R.lap >= 1 && R.lap < this.laps && !p.isAI) this.emit('lap', { p, lap: R.lap }); }
        else if (prev < L * 0.25 && n.s > L * 0.75 && R.lap >= 0) { R.lap--; R.half = true; }
        // driving the wrong way round?
        const fwd = Math.cos(wrapA(this.world.track.hs[n.i] - p.a));
        R.wrong = fwd < -0.3 && Math.abs(p.vf) > 3 ? R.wrong + 1 : 0;
      }
    }
    raceTotal(p) { return p.race.fin ? 1e9 - p.race.place : p.race.lap * this.world.track.L + p.race.s; }
    racePlace(p) { const t = this.raceTotal(p); let k = 1; for (const o of this.players) if (o !== p && o.race && this.raceTotal(o) > t) k++; return k; }
    // how far ahead of the best human this computer car is (metres)
    raceLead(p) { let best = -1e9; for (const o of this.players) if (!o.isAI && o.race && !o.race.fin) best = Math.max(best, this.raceTotal(o)); return best < -1e8 ? 0 : this.raceTotal(p) - best; }
    raceRules(dt) {
      for (const p of this.players) {
        const R = p.race; if (!R || R.fin || R.lap < this.laps) continue;
        R.fin = true; R.place = ++this.finishers; R.time = this.clock;
        if (this.firstFinish < 0) this.firstFinish = this.clock;
        this.emit('finish', { p, place: R.place });
      }
      const humans = this.players.filter(p => !p.isAI);
      if (humans.length && humans.every(p => p.race.fin)) { this.endT = (this.endT || 0) + dt; if (this.endT > 2.5) this.finish(); }
      else if (this.firstFinish >= 0 && this.clock - this.firstFinish > 60) this.finish(); // don't wait for ever
    }
    finish() {
      if (this.over) return;
      this.over = true; this.state = 'over';
      if (this.race) {
        const order = [...this.players].sort((a, b) => this.raceTotal(b) - this.raceTotal(a));
        const standings = order.map((p, k) => ({ slot: p.slot, name: p.name, car: p.carId, place: k + 1, time: p.race.fin ? p.race.time : null, human: !p.isAI }));
        this.results = { mode: 'race', level: this.level.id, race: standings, players: standings.filter(x => x.human), online: this.role !== 'solo', time: this.clock, win: standings[0].human };
        this.emit('over', { results: this.results });
        return;
      }
      const L = this.level, story = this.mode === 'story';
      const pl = this.players.map(p => ({ slot: p.slot, name: p.name, car: p.carId, tips: p.tips, pumpkins: p.pumpkins, dents: p.dents, escaped: p.escaped, caught: p.caught }));
      const win = story ? this.players.some(p => p.escaped) : true;
      const dents = this.players.reduce((s, p) => s + p.dents, 0);
      const stars = story && win ? 1 + (this.teamTips >= L.bonus ? 1 : 0) + (dents === 0 ? 1 : 0) : 0;
      let winner = -1;
      if (this.mode === 'tipoff' && pl.length > 1) winner = pl[0].tips > pl[1].tips ? 0 : pl[1].tips > pl[0].tips ? 1 : -1;
      if (this.mode === 'hunt') {
        const th = this.thrasher, escaped = this.players.filter(p => p.escaped).length;
        winner = escaped ? 'runners' : 'thrasher';
        this.huntInfo = { thrasher: { slot: th.slot, name: th.name }, caught: this.players.filter(p => p.caught).length, escaped, total: this.players.length };
      }
      const results = { hunt: this.huntInfo || null, mode: this.mode, level: L.id, win, stars, tips: this.teamTips, goal: this.goal, bonus: L.bonus, players: pl, winner, time: this.clock, pumpkins: this.players.reduce((s, p) => s + p.pumpkins, 0), online: this.role !== 'solo' };
      this.results = results;
      this.emit('over', { results });
    }

    // ---------------------------------------------------------------- collisions on this machine
    collisions(dt) {
      const th = this.thrasher, w = this.world;
      for (const p of this.players) {
        if (p.remote) continue;
        const r = p.spec.radius;
        // tractors (a tipped one lies a bit further back)
        for (const t of this.tractors) {
          const k = t.tip > 0.5 ? 1.3 : 0, cx = t.x - Math.sin(t.a) * k, cz = t.z - Math.cos(t.a) * k;
          const dx = p.x - cx, dz = p.z - cz, d = Math.hypot(dx, dz), m = r + TT.TRACTOR_R;
          if (d < m && d > 0.01) {
            const nx = dx / d, nz = dz / d, vn = p.vx * nx + p.vz * nz;
            p.x = cx + nx * m; p.z = cz + nz * m;
            if (vn < 0) { p.vx -= nx * vn * 1.3; p.vz -= nz * vn * 1.3; }
            if (-vn > 2.5 && this.authority && t.state === 'sleep' && this.state === 'play') { t.set('wary', p); if (this.mode === 'story') this.alarm += 5; }
            if (-vn > 4 && p.bumpT <= 0) { p.bumpT = 0.4; this.emit('bump', { p, hard: clamp(-vn / 14, 0, 1) }); }
          }
        }
        // the other car
        for (const o of this.players) {
          if (o === p || o.escaped) continue;
          const dx = p.x - o.x, dz = p.z - o.z, d = Math.hypot(dx, dz), m = r + o.spec.radius;
          if (d < m && d > 0.01) {
            const nx = dx / d, nz = dz / d, push = o.remote ? 1 : 0.5;
            p.x += nx * (m - d) * push; p.z += nz * (m - d) * push;
            if (!o.remote) { o.x -= nx * (m - d) * 0.5; o.z -= nz * (m - d) * 0.5; }
            const rel = (p.vx - o.vx) * nx + (p.vz - o.vz) * nz;
            if (rel < 0) {
              const j = -rel * 0.9, mp = p.spec.mass, mo = o.spec.mass;
              p.vx += nx * j * mo / (mp + mo); p.vz += nz * j * mo / (mp + mo);
              if (!o.remote) { o.vx -= nx * j * mp / (mp + mo); o.vz -= nz * j * mp / (mp + mo); }
              if (j > 4 && p.bumpT <= 0) { p.bumpT = 0.4; this.emit('bump', { p, hard: clamp(j / 14, 0, 1), other: o }); }
            }
          }
        }
        // Thrasher's body is solid (hits are worked out in rules)
        const c = th.contact(p.x, p.z, p.spec.radius);
        if (c && p.hop < 0.5) {
          p.x += c.x; p.z += c.z;
          const n = Math.hypot(c.x, c.z) || 1, nx = c.x / n, nz = c.z / n, vn = p.vx * nx + p.vz * nz;
          if (vn < 0) { p.vx -= nx * vn * 1.2; p.vz -= nz * vn * 1.2; }
        }
        // pumpkins splat under your wheels
        for (const pk of w.pumpkins) {
          if (!pk.alive || Math.hypot(pk.x - p.x, pk.z - p.z) > pk.r + r * 0.8) continue;
          w.smashPumpkin(pk);
          if (this.authority) p.pumpkins++; else if (this.net) this.net.sendSmash(pk.i);
          this.emit('pumpkin', { pk, p });
          if (this.mode === 'story') this.alarm += 1.5;
        }
      }
    }

    // ---------------------------------------------------------------- online (see net.js)
    snapshot() {
      const r = v => Math.round(v * 10) / 10;
      return {
        time: Math.round(this.time * 100) / 100, st: this.state, alarm: r(this.alarm), tips: this.teamTips, gate: this.gateOpen ? 1 : 0, gt: r(this.gateT), goal: this.goal, clock: r(this.clock),
        th: this.thrasher.netState(), tr: this.tractors.map(t => [t.code, r(t.t)]),
        pl: this.players.map(p => [p.slot, p.tips, p.dents, p.escaped ? 1 : 0, p.caught ? 1 : 0, p.pumpkins, p.remote ? null : p.netState(), p.race ? [p.race.lap, p.race.fin ? 1 : 0, p.race.place, r(p.race.time)] : null]),
      };
    }
    applySnapshot(s) {
      const diff = s.time - this.time;
      if (Math.abs(diff) > 0.4) this.time = s.time; else this.time += diff * 0.1;
      if (s.st === 'play' && this.state === 'countdown') { this.state = 'play'; this.emit('go'); }
      this.clock = s.clock; this.alarm = s.alarm; this.teamTips = s.tips;
      if (s.gate && !this.gateOpen) { this.gateOpen = true; this.emit('gateOpen'); } else if (!s.gate && this.gateOpen) { this.gateOpen = false; this.emit('gateClose'); }
      this.gateT = s.gt || 0; if (s.goal) this.goal = s.goal;
      const th = this.thrasher;
      if (th.controller !== 'local') { th.net = th.net || { cur: null, age: 0 }; th.net.cur = s.th; th.net.age = 0; }
      s.tr.forEach((x, i) => { const t = this.tractors[i]; if (t) t.netSet(x[0], x[1]); });
      for (const [slot, tips, dents, esc, caught, pumpkins, st, rc] of s.pl) {
        const p = this.players.find(q => q.slot === slot); if (!p) continue;
        if (rc && p.race) { // the host decides laps and places
          if (rc[1] && !p.race.fin) this.emit('finish', { p, place: rc[2] });
          if (rc[0] > p.race.lap && rc[0] >= 1 && rc[0] < this.laps && !p.isAI && !p.remote) this.emit('lap', { p, lap: rc[0] });
          p.race.lap = rc[0]; p.race.fin = !!rc[1]; p.race.place = rc[2]; p.race.time = rc[3];
        }
        p.tips = tips; p.dents = dents; p.pumpkins = pumpkins;
        if (esc && !p.escaped) { p.escaped = true; p.happyT = 99; if (p.remote) this.emit('escape', { p }); }
        if (caught && !p.caught) { p.caught = true; }
        if (st && p.remote) { p.net = p.net || { cur: null, age: 0 }; p.net.cur = st; p.net.age = 0; }
      }
    }

    removePlayer(p) {
      const i = this.players.indexOf(p); if (i < 0) return;
      this.players.splice(i, 1); this.world.scene.remove(p.rig.root); p.dispose();
      if (this.thrasher.target === p) this.thrasher.target = null;
    }
    // online: the player driving Thrasher left, so he drives himself
    thrasherToAI() { const th = this.thrasher; th.controller = 'ai'; th.top = this.level.tSpeed; th.net = null; th.view = null; if (th.state === 'sleep') th.set('wake'); }
    dispose() { for (const p of this.players) p.dispose(); this.world.dispose(); }
  }

  // who else lines up for a race: the track's own champion first (beat them to unlock them), then the rest
  TT.raceField = (humanCars, trackId) => {
    const champ = TT.CAR_IDS.find(id => TT.CARS[id].unlock && TT.CARS[id].unlock.win === trackId);
    const order = [champ, 'chatter', 'dash', 'sunny', 'ace', 'longhorn', 'blower', 'marshal', 'rusty', 'pepe', 'groovy', 'nippy', 'bigmo'];
    const out = [];
    for (const id of order) if (id && !humanCars.includes(id) && !out.includes(id) && out.length < TT.RACE_FIELD - humanCars.length) out.push(id);
    return out;
  };
  const wrapA = a => { while (a > Math.PI) a -= Math.PI * 2; while (a < -Math.PI) a += Math.PI * 2; return a; };
  TT.Game = Game;
})();
