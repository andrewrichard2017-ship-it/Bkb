// Road Rumble: one race. Builds the track, world and pack, runs the countdown, steps every rider, settles hits,
// bumps, cops and the finish, and keeps the standings. Emits events (sound, HUD, network) into race.events.
(() => {
  'use strict';
  const RR = window.RR, { clamp } = RR.math;
  const H = RR.ROAD_HALF;

  class Race {
    // cfg: { trackIndex, level (0-4), mode: 'career'|'versus'|'online'|'attract', role: 'solo'|'host'|'guest',
    //        humans: [{ name, bikeId, look, view, remote, slot }], seed, packSize }
    constructor(cfg, renderer, quality) {
      this.cfg = cfg; this.mode = cfg.mode; this.role = cfg.role || 'solo';
      this.def = RR.TRACKS[cfg.trackIndex];
      this.level = cfg.level;
      const shoot = cfg.mode === 'shootout';
      this.track = new RR.Track(this.def, cfg.level, { length: cfg.mode === 'attract' ? 14000 : undefined, noTraffic: shoot, noCrates: shoot });
      this.world = new RR.World(this.track, renderer, quality);
      this.time = cfg.mode === 'attract' ? 0 : -4.2; this.state = cfg.mode === 'attract' ? 'race' : 'countdown';
      this.events = []; this.riders = []; this.humans = []; this.finishCount = 0; this.endT = 0; this.over = false;
      this.beeps = 3; this.bumpT = 0;
      this.buildPack(cfg);
      this.standings();
      for (const r of this.riders) this.world.scene.add(r.model.root);
      this.world.prebuild(this.track.startS);
      this.track.updateTraffic(this.time);
    }

    buildPack(cfg) {
      const tr = this.track, rng = RR.rng((cfg.seed || 1) * 977 + cfg.trackIndex * 13 + cfg.level), lv = RR.LEVELS[this.level];
      const humans = cfg.humans || [];
      const total = cfg.mode === 'attract' ? 10 : clamp(cfg.packSize || 10, humans.length + 1, cfg.mode === 'shootout' ? 18 : 12);
      const rivals = RR.RIVALS.slice(); for (let i = rivals.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [rivals[i], rivals[j]] = [rivals[j], rivals[i]]; }
      // grid: rows of three on our side of the road; humans start near the back
      const slots = []; for (let i = 0; i < total; i++) slots.push({ s: tr.startS - 4 - Math.floor(i / 3) * 6, d: [1.6, 3.8, 6.0][i % 3] });
      const humanSlots = humans.length === 1 ? [total - 3] : humans.map((_, i) => total - humans.length - 1 + i);
      let ai = 0, id = 0;
      for (let i = 0; i < total; i++) {
        const hi = humanSlots.indexOf(i);
        if (hi >= 0) {
          const h = humans[hi];
          const r = new RR.Rider(this, { id: id++, name: h.name, bike: h.bikeId === 'cop' ? RR.COP_BIKE : RR.bike(h.bikeId), look: h.look, copSkin: h.bikeId === 'cop', human: true, view: h.view, remote: h.remote, slot: h.slot, s: slots[i].s, d: slots[i].d });
          this.riders.push(r); this.humans.push(r);
        } else {
          const rv = rivals[ai++ % rivals.length];
          const bikeId = rng.pick(RR.PACK_BIKES[cfg.mode === 'shootout' ? 3 : this.level]);
          const weapon = rv.weapon && rng() < 0.65 ? rv.weapon : null;
          const r = new RR.Rider(this, { id: id++, name: rv.name, bike: RR.bike(bikeId), look: { jacket: rv.jacket, helmet: rv.helmet, legs: rv.legs }, rival: rv, weapon, s: slots[i].s, d: slots[i].d, remote: this.role === 'guest' });
          this.riders.push(r);
        }
      }
      // parked police along the route
      if (cfg.mode !== 'attract' && !humans.some(h => h.bikeId === 'cop')) {
        const cops = lv.cops + (this.def.theme === 'city' ? 1 : 0);
        for (let c = 0; c < cops; c++) {
          const s = tr.startS + 700 + (tr.length - 1100) * (c + 0.3 + rng() * 0.4) / cops;
          const r = new RR.Rider(this, { id: id++, name: 'Police', bike: RR.COP_BIKE, look: { jacket: 0x14213d, helmet: 0xf5f5f5, legs: 0x101828 }, cop: true, weapon: 'baton', s, d: H + 2.4, remote: this.role === 'guest' });
          this.riders.push(r);
        }
      }
      this.byId = new Map(this.riders.map(r => [r.id, r]));
      // shootout: the pack are targets, so they pick fewer fights
      if (cfg.mode === 'shootout') for (const r of this.riders) if (r.ai && !r.cop) r.ai.aggro *= 0.35;
    }

    emit(type, data = {}) { data.type = type; this.events.push(data); }

    update(dt) {
      if (this.hold) return; // online: waiting for the other side to load
      this.time += dt;
      if (this.state === 'countdown') {
        const n = Math.ceil(-this.time);
        if (n < this.beeps + 1 && n >= 1 && n <= 3) { this.beeps = n - 1; this.emit('count', { n }); }
        if (this.time >= 0) { this.state = 'race'; this.emit('go'); }
      }
      this.track.updateTraffic(this.time);
      const racing = this.state !== 'countdown';
      const lv = RR.LEVELS[this.level];
      const lead = this.leadHuman();
      // shootout: endless shotgun shells and a Frenzy that is always ready
      if (this.mode === 'shootout') for (const h of this.humans) { if (!h.crash) { h.weapon = 'shotgun'; h.ammo = 99; } if (h.frenzyT <= 0) h.frenzy = 100; }
      for (const r of this.riders) {
        if (!r.human && !r.cop && !r.remote) r.pace = this.mode === 'attract' ? 0.9 * (r.ai ? r.ai.skill : 1) : lv.pace * (r.ai ? r.ai.skill : 1) * this.rubber(r, lead);
        else if (r.cop) r.pace = r.copState === 'done' ? 0.5 : 1;
        else r.pace = 1;
        if (racing || r.remote) r.step(dt);
      }
      if (racing) {
        this.bumps(dt);
        this.copsCheck();
        this.finishCheck();
      }
      this.standings();
      if (this.mode !== 'attract' && !this.over && this.humans.length && this.humans.every(h => h.finished || h.out)) {
        this.endT += dt;
        if (this.endT > 3.5 && this.role !== 'guest') this.finishRace();
      }
    }
    leadHuman() { let best = null; for (const h of this.humans) if (!best || h.progress > best.progress) best = h; return best; }
    // keeps the pack around the players: slower when far ahead, quicker when far behind
    rubber(r, lead) {
      if (!lead) return 1;
      const ds = r.s - lead.progress;
      if (this.mode === 'shootout') { // keep the targets coming: stragglers race back up to you
        if (ds < -30) return 1 + Math.min(0.5, (-ds - 30) / 200);
        if (ds > 60) return 1 - Math.min(0.3, (ds - 60) / 400);
        return 1;
      }
      if (ds > 120) return 1 - Math.min(0.14, (ds - 120) / 1800);
      if (ds < -150) return 1 + Math.min(0.1, (-ds - 150) / 1500);
      return 1;
    }

    bumps(dt) {
      this.bumpT -= dt;
      const rs = this.riders;
      for (let i = 0; i < rs.length; i++) {
        const a = rs[i]; if (!a.active || a.air) continue;
        for (let j = i + 1; j < rs.length; j++) {
          const b = rs[j]; if (!b.active || b.air) continue;
          if (a.cop && b.cop && a.copState === 'parked') continue;
          const ds = b.s - a.s, dd = b.d - a.d;
          if (Math.abs(ds) > 1.9 || Math.abs(dd) > 0.85) continue;
          const ov = 0.85 - Math.abs(dd), sg = Math.sign(dd) || 1, wa = a.bike.weight, wb = b.bike.weight, ra = wb / (wa + wb), rb = wa / (wa + wb);
          if (!a.remote) { a.d -= sg * ov * ra; a.pushV -= sg * 1.6 * ra; }
          if (!b.remote) { b.d += sg * ov * rb; b.pushV += sg * 1.6 * rb; }
          if (Math.abs(dd) < 0.45) { const rear = ds > 0 ? a : b, front = ds > 0 ? b : a; if (!rear.remote && rear.blazeT <= 0) rear.v = Math.min(rear.v, front.v - 0.5); }
          // a blazing bike flattens whoever it touches
          for (const [x, y] of [[a, b], [b, a]]) if (x.blazeT > 0 && y.blazeT <= 0 && !x.remote && y.active && this.time - (y.blzT || -9) > 0.5 && (y.blzT = this.time)) this.deliver(x, y, { dmg: 200, push: 6, side: Math.sign(y.d - x.d) || 1, kind: 'blaze', sfx: 'kick', knock: true });
          if (this.bumpT <= 0) { this.bumpT = 0.25; this.emit('bump', { who: a, other: b }); }
        }
      }
    }

    // --- fighting ---
    findTarget(att, side, reach) {
      let best = null, bestD = 1e9;
      for (const o of this.riders) {
        if (o === att || !o.active) continue;
        if (o.cop && o.copState === 'parked') continue;
        const ds = o.s - att.s, dd = (o.d - att.d) * side;
        if (ds < -1.6 || ds > 1.7 || dd < 0.3 || dd > reach) continue;
        const sc = Math.abs(ds) + dd * 0.5;
        if (sc < bestD) { bestD = sc; best = o; }
      }
      return best;
    }
    hit(att, tgt, atk) {
      const D = atk.def;
      const info = { dmg: D.dmg * (0.9 + Math.random() * 0.2), push: D.push, side: atk.side, bike: D.bike || 0, kind: atk.kind, sfx: D.sfx, steal: false };
      if (atk.kind === 'punch' && !att.weapon && tgt.weapon && tgt.atk && tgt.atk.t < tgt.atk.def.wind + 0.05) {
        info.steal = true; this.giveWeapon(att, tgt.weapon);
        this.emit('steal', { who: att, from: tgt, w: tgt.weapon });
      }
      this.deliver(att, tgt, info);
    }
    // apply a hit locally, or send it to the machine that owns the target
    deliver(att, tgt, info) {
      if (tgt.remote && this.net) this.net.sendHit(att, tgt, info);
      else tgt.takeHit(att, info);
      att.meter('frenzy', tgt.cop ? 9 : info.kind === 'gun' ? 0.6 : 6);
      this.emit('hit', { who: att, tgt, info });
    }
    // shotgun: the nearest rider in a cone ahead on that side
    shoot(att, side) {
      const W = RR.WEAPONS.shotgun;
      let best = null, bs = 1e9;
      for (const o of this.riders) {
        if (o === att || !o.active || (o.cop && o.copState === 'parked')) continue;
        const ds = o.s - att.s, dd = o.d - att.d;
        if (ds < -3 || ds > W.reach || Math.abs(dd) > 2.5 + Math.max(0, ds) * 0.18 || dd * side < -1.2) continue;
        const sc = Math.abs(ds) + Math.abs(dd) * 2;
        if (sc < bs) { bs = sc; best = o; }
      }
      this.emit('shoot', { who: att, tgt: best, side });
      if (best) this.deliver(att, best, { dmg: W.dmg, push: W.push, side: Math.sign(best.d - att.d) || side, kind: 'shot', sfx: 'shotgun', knock: true });
    }
    // frenzy machine gun: nearest rider (or cop) in range, preferring those ahead
    gunTarget(att) {
      let best = null, bs = 1e9;
      for (const o of this.riders) {
        if (o === att || !o.active || (o.cop && o.copState === 'parked')) continue;
        const ds = o.s - att.s, dd = o.d - att.d, dist = Math.hypot(ds, dd);
        if (dist > RR.SPECIALS.gunRange) continue;
        const sc = dist + (ds < 0 ? 20 : 0);
        if (sc < bs) { bs = sc; best = o; }
      }
      return best;
    }
    gunHit(att, tgt) {
      this.emit('gun', { who: att, tgt });
      this.deliver(att, tgt, { dmg: RR.SPECIALS.gunDmg, push: 0.35, side: Math.sign(tgt.d - att.d) || 1, kind: 'gun', sfx: null });
    }
    // glowing crates on the road hand out a shotgun
    checkPickup(r) {
      r.pickT = Math.max(0, r.pickT - 1 / 60);
      if (r.pickT > 0 || r.cop) return;
      for (const p of this.track.pickups) {
        if (Math.abs(p.s - r.s) < 1.8 && Math.abs(p.d - r.d) < 1.5) {
          if (r.weapon === 'shotgun' && r.ammo >= 3) return;
          r.giveShotgun(); r.pickT = 2; this.emit('pickup', { who: r });
          return;
        }
      }
    }
    // a hit that arrived over the network
    netHit(att, tgt, info) {
      if (!tgt || tgt.remote) return;
      if (info.steal && tgt.weapon && att && !att.remote) { /* thief is remote; just drop it */ }
      tgt.takeHit(att, info);
      this.emit('hit', { who: att, tgt, info, net: true });
    }
    giveWeapon(r, w) {
      if (r.remote) { if (this.net) this.net.sendWeapon(r, w); return; }
      r.weapon = w; this.emit('weapon', { who: r, w });
    }

    copsCheck() {
      if (this.mode === 'shootout') return; // nobody gets nicked in the shootout
      for (const c of this.riders) {
        if (!c.cop || c.remote || c.crash || c.copState !== 'chase') continue;
        const p = c.ai.prey;
        if (!p || p.out) continue;
        if (p.crash && p.crash.phase !== 'fly') {
          const ds = p.crash.r.s - c.s, dd = p.crash.r.d - c.d;
          if (Math.abs(ds) < 9 && Math.abs(dd) < 7 && c.v < 16) {
            p.out = 'busted'; c.copState = 'done'; c.siren = false; c.ai.prey = null;
            if (p.remote && this.net) this.net.sendBusted(p);
            this.emit('busted', { who: p, cop: c });
          }
        }
      }
    }
    finishCheck() {
      for (const r of this.riders) {
        if (r.cop || r.finished || r.out) continue;
        if (r.remote) { if (r.finishedRemote) { r.finished = true; r.finishTime = this.time; r.place = ++this.finishCount; this.emit('finish', { who: r, place: r.place }); } continue; }
        if (r.s >= this.track.finishS && !r.crash) {
          r.finished = true; r.finishTime = this.time; r.place = ++this.finishCount;
          this.emit('finish', { who: r, place: r.place });
        }
      }
    }
    standings() {
      const list = this.riders.filter(r => !r.cop);
      list.sort((a, b) => {
        if (!!a.out !== !!b.out) return a.out ? 1 : -1;
        if (a.finished !== b.finished) return a.finished ? -1 : 1;
        if (a.finished) return a.finishTime - b.finishTime;
        return b.progress - a.progress;
      });
      list.forEach((r, i) => { r.pos = i + 1; });
      this.order = list;
    }
    finishRace() {
      if (this.over) return;
      this.over = true;
      const tr = this.track;
      this.results = this.order.map((r, i) => ({
        id: r.id, name: r.name, place: i + 1, human: r.human, slot: r.slot, view: r.view, out: r.out || null, bike: r.bike.name,
        time: r.finished ? r.finishTime : r.out ? null : this.time + (tr.finishS - r.progress) / Math.max(20, r.bike.top * 0.8), finished: r.finished, knockoffs: r.knockoffs,
      }));
      this.emit('raceOver', { results: this.results });
    }

    dispose() {
      this.world.dispose();
    }
  }
  RR.Race = Race;
})();
