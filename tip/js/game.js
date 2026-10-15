// Tractor Tippin': one night on the farm. Holds the world, the players, the tractors and Thrasher, and runs
// the rules: sneaking up, honking, tipping, the noise that wakes Thrasher, getting hit, the gate, escaping,
// and the score. In an online game the host runs the rules and the guest mirrors them from snapshots.
//
// Modes:  story   tip enough tractors to open the gate, then escape through it (1 or 2 players as a team)
//         tipoff  2½ minutes, Thrasher hunts from the start, most tips wins (1 player = score attack)
//         attract the title screen: nobody driving, the odd tractor falls over
(() => {
  'use strict';
  const TT = window.TT, { clamp } = TT.math;

  class Game {
    // cfg: { mode, level, humans: [{ slot, car, name, remote, view }], role: 'solo'|'host'|'guest' }
    constructor(cfg, renderer, quality) {
      this.cfg = cfg; this.mode = cfg.mode; this.level = cfg.level; this.quality = quality;
      this.role = cfg.role || 'solo'; this.authority = this.role !== 'guest';
      this.humans = cfg.humans.length;
      this.events = [];
      this.world = new TT.World(cfg.level, renderer, quality);
      this.players = cfg.humans.map(h => new TT.Car(this, h));
      this.tractors = this.world.tractorSpots.map((s, i) => new TT.Tractor(this, s, i));
      this.thrasher = new TT.Thrasher(this);
      this.threshold = cfg.level.wake; this.alarm = 0; this.teamTips = 0; this.goal = cfg.level.goal;
      this.recoverTime = this.mode === 'tipoff' ? 9 : this.mode === 'attract' ? 7 : cfg.level.recover;
      this.state = this.mode === 'attract' ? 'play' : 'countdown';
      this.time = this.mode === 'attract' ? 0 : -3.6; this.clock = 0; this.lastCount = 9;
      this.gateOpen = false; this.over = false; this.hold = false; this.demoT = 3;
      this.net = null;
    }
    emit(type, e = {}) { e.type = type; this.events.push(e); return e; }
    get timeLeft() { return Math.max(0, TT.TIPOFF_TIME - this.clock); }

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
      for (const p of this.players) p.remote ? p.netStep(dt) : p.step(dt, canDrive);
      this.collisions(dt);
      if (this.authority) {
        for (const t of this.tractors) t.update(dt);
        if (this.state === 'play') this.rules(dt);
        this.thrasher.update(dt);
      } else {
        for (const t of this.tractors) t.t += dt;
        this.thrasher.netStep(dt);
      }
      if (this.world.gateOpen !== this.gateOpen) this.world.setGateOpen(this.gateOpen);
    }

    // ---------------------------------------------------------------- the rules (host / single machine)
    rules(dt) {
      const th = this.thrasher, story = this.mode === 'story';
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
        if (p.remote && !p.escaped && this.gateOpen && p.z < -this.world.H - 3) this.escape(p);
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
      if (story && !this.gateOpen && this.teamTips >= this.goal) { this.gateOpen = true; this.emit('gateOpen'); }
      if (story && this.players.length && this.players.every(p => !p.active)) this.finish();
      if (this.mode === 'tipoff' && this.clock >= TT.TIPOFF_TIME) this.finish();
    }
    hitPlayer(p) {
      const th = this.thrasher, story = this.mode === 'story';
      const dx = p.x - th.x, dz = p.z - th.z, d = Math.hypot(dx, dz) || 1;
      let nx = dx / d + Math.sin(th.a) * 0.7, nz = dz / d + Math.cos(th.a) * 0.7;
      const n = Math.hypot(nx, nz) || 1; nx /= n; nz /= n;
      const power = 13 + Math.abs(th.v) * 0.6;
      if (p.remote) { p.invuln = 2.5; if (this.net) this.net.sendHit(p, nx, nz, power); } else p.knock(nx, nz, power);
      if (story) {
        p.dents++;
        if (p.dents >= TT.DENTS) { p.caught = true; this.emit('caught', { p }); if (th.target === p) th.target = null; }
        else this.emit('hit', { p });
      } else {
        const lost = Math.min(2, p.tips); p.tips -= lost; p.invuln = 3;
        this.emit('hit', { p, lost });
      }
      th.set('gloat'); th.chargeT = 0;
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
    finish() {
      if (this.over) return;
      this.over = true; this.state = 'over';
      const L = this.level, story = this.mode === 'story';
      const pl = this.players.map(p => ({ slot: p.slot, name: p.name, car: p.carId, tips: p.tips, pumpkins: p.pumpkins, dents: p.dents, escaped: p.escaped, caught: p.caught }));
      const win = story ? this.players.some(p => p.escaped) : true;
      const dents = this.players.reduce((s, p) => s + p.dents, 0);
      const stars = story && win ? 1 + (this.teamTips >= L.bonus ? 1 : 0) + (dents === 0 ? 1 : 0) : 0;
      let winner = -1;
      if (this.mode === 'tipoff' && pl.length > 1) winner = pl[0].tips > pl[1].tips ? 0 : pl[1].tips > pl[0].tips ? 1 : -1;
      const results = { mode: this.mode, level: L.id, win, stars, tips: this.teamTips, goal: this.goal, bonus: L.bonus, players: pl, winner, time: this.clock, pumpkins: this.players.reduce((s, p) => s + p.pumpkins, 0), online: this.role !== 'solo' };
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
        time: Math.round(this.time * 100) / 100, st: this.state, alarm: r(this.alarm), tips: this.teamTips, gate: this.gateOpen ? 1 : 0, clock: r(this.clock),
        th: this.thrasher.netState(), tr: this.tractors.map(t => [t.code, r(t.t)]),
        pl: this.players.map(p => [p.slot, p.tips, p.dents, p.escaped ? 1 : 0, p.caught ? 1 : 0, p.pumpkins, p.remote ? null : p.netState()]),
      };
    }
    applySnapshot(s) {
      const diff = s.time - this.time;
      if (Math.abs(diff) > 0.4) this.time = s.time; else this.time += diff * 0.1;
      if (s.st === 'play' && this.state === 'countdown') { this.state = 'play'; this.emit('go'); }
      this.clock = s.clock; this.alarm = s.alarm; this.teamTips = s.tips;
      if (s.gate && !this.gateOpen) { this.gateOpen = true; this.emit('gateOpen'); }
      const th = this.thrasher; th.net = th.net || { cur: null, age: 0 }; th.net.cur = s.th; th.net.age = 0;
      s.tr.forEach((x, i) => { const t = this.tractors[i]; if (t) t.netSet(x[0], x[1]); });
      for (const [slot, tips, dents, esc, caught, pumpkins, st] of s.pl) {
        const p = this.players.find(q => q.slot === slot); if (!p) continue;
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
    dispose() { for (const p of this.players) p.dispose(); this.world.dispose(); }
  }

  TT.Game = Game;
})();
