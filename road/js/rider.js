// Road Rumble: a racer. Riding physics in road space, attacks, crashes (flying off, running back to the bike),
// the AI that drives rivals and cops, and posing the 3D model each frame.
(() => {
  'use strict';
  const RR = window.RR, { clamp, lerp, damp } = RR.math;
  const H = RR.ROAD_HALF, G = RR.G;
  const rand = (a, b) => a + Math.random() * (b - a);

  class Rider {
    constructor(race, o) {
      this.race = race; this.id = o.id; this.name = o.name;
      this.bike = o.bike; this.look = o.look; this.cop = !!o.cop;
      this.human = !!o.human; this.view = o.view === undefined ? null : o.view; this.remote = !!o.remote; this.slot = o.slot ?? null;
      this.rival = o.rival || null;
      this.s = o.s; this.d = o.d; this.v = 0; this.Y = race.track.height(o.s); this.vy = 0; this.air = false;
      this.steer = 0; this.vlat = 0; this.pushV = 0; this.phi = 0; this.lean = 0; this.pitch = 0;
      this.hp = 100; this.dmg = 0; this.weapon = o.weapon || null;
      this.nitro = this.bike.nitro || 0; this.nitroT = 0;
      this.atk = null; this.atkCD = 0; this.hitT = 0; this.hitSide = 0; this.wobble = 0;
      this.crash = null; this.finished = false; this.finishTime = 0; this.place = 0; this.out = null; // 'busted' | 'wrecked'
      this.knockoffs = 0; this.offroad = false; this.wallT = 0; this.landT = 0;
      this.pace = 1; this.inp = { throttle: 0, brake: 0, steer: 0, atkL: false, atkR: false, kick: false, nitro: false, mash: false };
      this.ai = this.human ? null : { pref: rand(0.8, 6.2), targetD: o.d, laneT: Math.random() * 0.3, prey: null, preyT: 0, cd: 0, skill: this.rival ? this.rival.skill : 1, aggro: this.rival ? this.rival.aggro : (this.cop ? 1 : 0.5) };
      if (this.cop) { this.copState = 'parked'; this.siren = false; }
      this.model = new RR.models.RacerModel(this.bike, this.look, { cop: this.cop });
      this.model.setWeapon(this.weapon);
      this.wheelA = 0; this.runPh = 0; this.anim = 0;
      this.net = null; // remote interpolation buffer
    }

    get active() { return !this.crash && !this.out; }
    get progress() { return this.crash ? Math.max(this.crash.b.s, this.s) : this.s; }
    get weaponDef() { return this.weapon ? RR.WEAPONS[this.weapon] : null; }

    // ------------------------------------------------------------------ riding
    step(dt) {
      if (this.remote) return this.remoteStep(dt);
      if (this.crash) return this.crashStep(dt);
      if (this.out) { this.v = Math.max(0, this.v - 12 * dt); return; }
      const tr = this.race.track, b = this.bike, inp = this.inp;
      if (!this.human || this.finished) this.aiControl(dt);
      const k = tr.curv(this.s);
      this.offroad = this.d > H + 0.4 || this.d < -H - 0.4;
      if (inp.nitro && this.nitro > 0 && this.nitroT <= 0 && !this.air && this.v > 8) { this.nitro--; this.nitroT = 3; this.race.emit('nitro', { who: this }); }
      this.nitroT = Math.max(0, this.nitroT - dt);
      const top = b.top * this.pace * (this.offroad ? 0.58 : 1) * (this.nitroT > 0 ? 1.22 : 1) * (this.dmg > 75 ? 0.93 : 1);
      if (!this.air) {
        let a;
        if (inp.throttle > 0.02 && this.v <= top) a = b.accel * inp.throttle * Math.max(0.05, 1 - Math.pow(this.v / top, 3)) * (this.nitroT > 0 ? 1.7 : 1);
        else if (this.v > top) a = -(this.v - top) * (this.offroad ? 2.2 : 0.9) - 1;
        else a = -1.4 - this.v * 0.012;
        a -= inp.brake * 17 + G * tr.slope(this.s) * 0.5;
        if (this.wobble > 0) a -= 3;
        this.v = Math.max(0, this.v + a * dt);
      }
      // steering: sideways speed you can make, against the bend pushing you to the outside
      const hand = b.handling * (this.air ? 0.3 : 1) * (this.offroad ? 0.8 : 1);
      this.steer = damp(this.steer, inp.steer, 10, dt);
      const latMax = (2.6 * Math.min(1, this.v / 8) + this.v * 0.16) * hand;
      const cf = k * this.v * this.v * 0.6;
      this.vlat = this.steer * latMax - cf;
      this.pushV = damp(this.pushV, 0, 3.2, dt);
      this.d += (this.vlat + this.pushV) * dt;
      if (this.wobble > 0) { this.wobble -= dt; this.d += Math.sin(this.race.time * 31 + this.id) * 1.4 * dt * this.wobble; }
      // walls: guard rails, banks, buildings
      const lr = tr.limitR(this.s), ll = tr.limitL(this.s);
      if (this.d > lr || this.d < ll) {
        const side = this.d > lr ? 1 : -1, into = (this.vlat + this.pushV) * side;
        this.d = side > 0 ? lr : ll;
        if (into > 11 && this.v > 25) return this.startCrash('wall', { side: -side });
        this.pushV = -side * Math.max(1.5, into * 0.4);
        this.v *= 1 - 0.6 * dt; this.wallT = 0.15;
        this.race.emit('scrape', { who: this, side });
      }
      this.wallT = Math.max(0, this.wallT - dt);
      // forwards and up/down (crests launch you)
      const ns = this.s + this.v * dt, yr = tr.height(ns);
      if (this.air) {
        this.vy -= G * dt; this.Y += this.vy * dt;
        if (this.Y <= yr) {
          const impact = tr.slope(ns) * this.v - this.vy;
          this.air = false; this.Y = yr; this.vy = this.v * tr.slope(ns);
          this.landT = Math.min(1, impact / 10);
          this.race.emit('land', { who: this, impact });
          if (impact > 13) { this.wobble = 0.6; this.dmg += 2; }
        }
      } else {
        // leave the ground only where the road falls away faster than gravity (crests / jumps)
        const kap = (tr.slope(ns + 2) - tr.slope(ns - 2)) / 4;
        if (this.v > 18 && -kap * this.v * this.v > G * 1.35) { this.air = true; this.vy = this.v * tr.slope(this.s); this.Y += this.vy * dt; }
        else { this.Y = yr; this.vy = this.v * tr.slope(ns); }
      }
      this.s = ns;
      this.landT = Math.max(0, this.landT - dt * 2);
      this.phi = clamp(Math.atan2(this.vlat + this.pushV * 0.6, Math.max(this.v, 5)), -0.6, 0.6);
      const leanT = clamp(-(Math.atan(k * this.v * this.v / G) * 0.55 + this.steer * 0.34 * Math.min(1, this.v / 18)), -0.78, 0.78);
      this.lean = damp(this.lean, leanT, 7, dt);
      const pt = this.air ? Math.atan2(this.vy, Math.max(this.v, 1)) * 0.6 + 0.06 : Math.atan(tr.slope(this.s));
      this.pitch = damp(this.pitch, pt, this.air ? 3 : 12, dt);
      if (!this.air) this.collide(dt);
      this.combat(dt);
      if (this.hp < 100 && this.hitT <= 0) this.hp = Math.min(100, this.hp + 1.2 * dt);
      this.hitT = Math.max(0, this.hitT - dt);
    }

    collide() {
      const tr = this.race.track;
      if (this.ai) tr.carsNear(this.s, 30, car => { if (Math.abs(car.d - this.d) < car.w / 2 + 0.9 && car.s > this.s && (car.s - this.s - car.len / 2) < (this.v - car.v) * 0.8) this.ai.danger = true; });
      // roadside things
      let hit = null;
      tr.obstaclesNear(this.s, 1.2, ob => { if (!hit && Math.abs(this.d - ob.d) < ob.hd + 0.32 && Math.abs(this.s - ob.s) < ob.hs + 0.7) hit = ob; });
      if (hit && this.v > 6) return this.startCrash('obstacle', { side: this.d > hit.d ? 1 : -1, ob: hit });
      if (hit) { this.v = 0; this.s = hit.s - hit.hs - 0.8; return; }
      // traffic
      tr.carsNear(this.s - 14, 28, car => {
        if (this.crash) return;
        const ds = car.s - this.s, dd = car.d - this.d;
        if (Math.abs(ds) < car.len / 2 + 0.95 && Math.abs(dd) < car.w / 2 + 0.33) {
          const rv = this.v - car.v;
          if (car.v > 0 && Math.abs(rv) < 7) { // nudged a car going our way
            if (ds > 0) { this.v = Math.max(0, car.v - 2); this.s = car.s - car.len / 2 - 0.96; } else { this.v = car.v + 2; }
            this.pushV = -Math.sign(dd || 1) * 2.5; this.wobble = 0.5; this.dmg += 1;
            this.race.emit('bump', { who: this, car });
          } else this.startCrash('car', { side: dd > 0 ? -1 : 1, car, rv });
        } else if (Math.abs(ds) < car.len / 2 + 6 && Math.abs(dd) < car.w / 2 + 1.6 && this.race.time - car.honked > 3 && Math.abs(this.v - car.v) > 8) {
          car.honked = this.race.time; this.race.emit('horn', { who: this, car });
        }
      });
    }

    // ------------------------------------------------------------------ fighting
    startAttack(kind, side) {
      if (this.atk || this.atkCD > 0 || this.crash || this.out) return;
      const def = kind === 'weapon' ? this.weaponDef : RR.ATTACKS[kind];
      if (!def) return;
      this.atk = { kind, side, t: 0, def, done: false };
      this.race.emit('swing', { who: this });
    }
    combat(dt) {
      this.atkCD = Math.max(0, this.atkCD - dt);
      const inp = this.inp;
      if (this.human && !this.finished) {
        if (inp.kick) this.startAttack('kick', inp.kickSide || this.nearSide());
        else if (inp.atkL) this.startAttack(this.weapon ? 'weapon' : 'punch', -1);
        else if (inp.atkR) this.startAttack(this.weapon ? 'weapon' : 'punch', 1);
      }
      inp.atkL = inp.atkR = inp.kick = false;
      const a = this.atk;
      if (!a) return;
      a.t += dt;
      const D = a.def;
      if (!a.done && a.t >= D.wind && a.t <= D.wind + D.hit) {
        const tgt = this.race.findTarget(this, a.side, D.reach);
        if (tgt) { a.done = true; this.race.hit(this, tgt, a); }
      }
      if (a.t >= D.wind + D.hit && !a.done) { a.done = true; a.missed = true; this.race.emit('whiff', { who: this }); }
      if (a.t >= D.wind + D.hit + D.rec) { this.atk = null; this.atkCD = 0.05; }
    }
    // which side the nearest rider is on (for the kick button)
    nearSide() {
      let best = 9, side = 1;
      for (const o of this.race.riders) {
        if (o === this || !o.active) continue;
        const ds = Math.abs(o.s - this.s), dd = o.d - this.d;
        if (ds < 4 && Math.abs(dd) < best) { best = Math.abs(dd); side = Math.sign(dd) || 1; }
      }
      return side;
    }
    // applied by the race when a hit lands on a rider simulated here
    takeHit(from, info) {
      if (this.crash || this.out) return;
      const ratio = clamp((from ? from.bike.weight : 1) / this.bike.weight, 0.6, 1.6);
      this.hp -= info.dmg * (this.cop ? 0.8 : 1);
      this.pushV += info.side * info.push * ratio;
      this.v *= 0.985; this.hitT = 0.35; this.hitSide = info.side; this.wobble = Math.max(this.wobble, 0.25);
      if (info.bike) this.dmg += info.bike;
      if (this.atk && this.atk.t < this.atk.def.wind) this.atk = null; // knocked out of his swing
      if (info.steal) { this.weapon = null; }
      if (this.hp <= 0) { this.hp = 0; this.startCrash('knock', { side: info.side, by: from }); }
    }

    // ------------------------------------------------------------------ crashing
    startCrash(cause, o = {}) {
      if (this.crash || this.out) return;
      const tr = this.race.track, v = this.v, side = o.side || (Math.random() < 0.5 ? -1 : 1);
      const car = cause === 'car', knock = cause === 'knock';
      const h0 = this.Y - tr.height(this.s);
      this.crash = {
        t: 0, cause, phase: 'fly', by: o.by || null, lieT: 0, runBoost: 0, side,
        r: { s: this.s, d: this.d, h: h0 + 0.95, vs: v * (car ? 0.35 : 0.82), vd: side * rand(1, 3.5) + this.vlat * 0.4, vh: (car ? 5.5 : 2.4) + v * (car ? 0.09 : 0.05),
          rx: this.pitch, ry: this.phi, rz: this.lean, wx: -rand(3, 7) * Math.min(1.5, v / 30), wy: rand(-3, 3), wz: side * rand(1, 4), bounces: 0 },
        b: { s: this.s, d: this.d, h: h0, vs: v * (car ? 0.15 : 0.75), vd: side * rand(0.4, 2) + this.vlat * 0.3, vh: 0.8 + v * 0.025,
          rx: this.pitch, ry: this.phi, rz: this.lean, wx: 0, wy: rand(-2, 2) * Math.min(1.5, v / 25), wz: (this.lean < 0 ? -1 : 1) * rand(2, 4), bounces: 0, bike: true },
      };
      this.dmg += (knock ? 3 + v * 0.08 : 10 + v * 0.38) * this.bike.armor;
      if (!knock) this.hp = Math.max(0, this.hp - (car ? 22 : 14));
      if (this.dmg >= 100) { this.dmg = 100; this.out = 'wrecked'; }
      // an empty-handed attacker picks up the weapon of the rider he knocked off
      if (knock && o.by) o.by.knockoffs++;
      if (knock && o.by && this.weapon && !o.by.weapon) { this.race.giveWeapon(o.by, this.weapon); this.weapon = null; }
      this.atk = null; this.air = false; this.v = 0; this.nitroT = 0;
      this.race.emit('crash', { who: this, cause, by: o.by || null, speed: v });
    }
    crashStep(dt) {
      const c = this.crash, tr = this.race.track;
      c.t += dt;
      const body = (o, mu) => {
        o.vh -= G * dt; o.h += o.vh * dt; o.s += o.vs * dt; o.d += o.vd * dt;
        const lr = tr.limitR(o.s) + (o.bike ? 0 : 0.5), ll = tr.limitL(o.s) - (o.bike ? 0 : 0.5);
        if (o.d > lr) { o.d = lr; o.vd = -Math.abs(o.vd) * 0.3; } else if (o.d < ll) { o.d = ll; o.vd = Math.abs(o.vd) * 0.3; }
        o.rx += o.wx * dt; o.ry += o.wy * dt; o.rz += o.wz * dt;
        if (o.h <= 0) {
          o.h = 0;
          if (o.vh < -2.2) { o.vh *= -0.3; o.bounces++; this.race.emit(o.bike ? 'bikeBounce' : 'thud', { who: this, s: o.s, d: o.d, v: Math.hypot(o.vs, o.vd) }); } else o.vh = 0;
          const sp = Math.hypot(o.vs, o.vd);
          if (sp > 0) { const dec = Math.min(sp, mu * G * dt); o.vs -= o.vs / sp * dec; o.vd -= o.vd / sp * dec; }
          const k = Math.exp(-(o.bike ? 1.5 : 2.5) * dt); o.wx *= k; o.wy *= k; o.wz *= k;
        }
        return Math.hypot(o.vs, o.vd);
      };
      const bs = body(c.b, 0.42);
      // a sliding bike lies down on its side
      if (c.b.h <= 0.05) { const want = c.b.rz >= 0 ? Math.PI / 2 : -Math.PI / 2; c.b.rz = damp(c.b.rz, want, 4, dt); c.b.rx = damp(c.b.rx, 0, 4, dt); c.b.wz *= 0.9; }
      c.sliding = bs > 3 && c.b.h <= 0.1;
      if (c.phase === 'fly' || c.phase === 'lie') {
        const rs = body(c.r, 0.9);
        if (c.phase === 'fly' && c.r.h <= 0 && rs < 1.2 && c.t > 0.7) { c.phase = 'lie'; c.lieT = 0; }
        if (c.phase === 'lie') {
          c.lieT += dt;
          c.r.rx = damp(c.r.rx, -Math.PI / 2, 5, dt); c.r.rz = damp(c.r.rz, 0, 5, dt);
          if (c.lieT > 0.9 && !this.out && bs < 1.5) { c.phase = 'run'; c.r.rx = 0; c.r.rz = 0; c.r.h = 0; }
        }
      } else if (c.phase === 'run') {
        // run back to the bike (mash to run faster)
        if (this.human && this.inp.mash) c.runBoost = Math.min(3, c.runBoost + 0.6);
        c.runBoost = Math.max(0, c.runBoost - dt * 1.5);
        const ds = c.b.s - c.r.s, dd = c.b.d + c.side * 0.7 - c.r.d, dist = Math.hypot(ds, dd);
        const sp = 6.2 + c.runBoost + (this.ai ? this.ai.skill * 0.6 : 0);
        if (dist > 0.35) { c.r.s += ds / dist * sp * dt; c.r.d += dd / dist * sp * dt; }
        c.r.ry = Math.atan2(dd, -ds) * -1 + Math.PI;
        this.runPh += dt * sp * 2.2;
        if (dist < 0.9 && bs < 0.5) { c.phase = 'mount'; c.mountT = 0; }
      } else if (c.phase === 'mount') {
        c.mountT += dt;
        if (c.mountT > 0.45) this.remount();
      }
      if (this.out) c.phase = c.phase === 'run' ? 'lie' : c.phase;
      this.s = c.r.s; this.d = c.r.d;
    }
    remount() {
      const c = this.crash, tr = this.race.track;
      this.s = c.b.s; this.d = clamp(c.b.d, tr.limitL(c.b.s) + 0.3, tr.limitR(c.b.s) - 0.3);
      // traffic coming? get back on at the side of the road
      let busy = false;
      tr.carsNear(this.s, 70, car => { const ds = car.s - this.s; if (Math.abs(car.d - this.d) < car.w / 2 + 1.2 && (car.v > 0 ? ds > -70 && ds < 8 : ds > -8 && ds < 70)) busy = true; });
      if (busy) this.d = (this.d >= 0 ? 1 : -1) * Math.min(RR.ROAD_HALF + 0.9, this.d >= 0 ? tr.limitR(this.s) - 0.3 : -tr.limitL(this.s) - 0.3);
      this.Y = tr.height(this.s); this.vy = 0; this.v = 0; this.air = false; this.pushV = 0; this.lean = 0; this.phi = 0;
      if (c.cause === 'knock') this.hp = Math.max(this.hp, 50);
      this.hp = Math.max(this.hp, 20);
      this.crash = null;
      this.race.emit('remount', { who: this });
    }

    // ------------------------------------------------------------------ AI
    aiControl(dt) {
      const ai = this.ai || (this.ai = { pref: 3, targetD: this.d, laneT: 0, prey: null, preyT: 0, cd: 0, skill: 1, aggro: 0 });
      const tr = this.race.track, b = this.bike, inp = this.inp, race = this.race;
      if (this.cop && this.copState === 'parked') { inp.throttle = 0; inp.brake = 1; inp.steer = 0; this.copWatch(); return; }
      let want = b.top * this.pace;
      if (this.finished) want = Math.min(want, this.human ? 14 : 24);
      // slow for the bends ahead
      const look = 30 + this.v * 1.8;
      let kmax = 0;
      for (let q = 8; q < look; q += 10) kmax = Math.max(kmax, Math.abs(tr.curv(this.s + q)));
      if (kmax > 1e-4) {
        const h = b.handling, A = 0.6 * kmax, Bq = 0.8 * 0.16 * h, C = 0.8 * 2.6 * h;
        const vs = (Bq + Math.sqrt(Bq * Bq + 4 * A * C)) / (2 * A);
        want = Math.min(want, vs * (0.93 + ai.skill * 0.08));
      }
      // pick a fight / chase
      ai.preyT -= dt;
      let down = null;
      if (this.cop) { this.copChase(ai); if (ai.prey && ai.prey.crash) down = ai.prey.crash; }
      else if (ai.preyT <= 0) {
        ai.preyT = rand(3, 7); ai.prey = null;
        if (Math.random() < ai.aggro * 0.8) {
          let best = 30;
          for (const o of race.riders) {
            if (o === this || !o.active || o.finished || o.cop) continue;
            const ds = Math.abs(o.s - this.s), w = o.human ? ds : ds * 2.2;
            if (w < best && (o.human || Math.random() < 0.5)) { best = w; ai.prey = o; }
          }
        }
      }
      const prey = ai.prey && ai.prey.active ? ai.prey : null;
      if (prey && !this.finished) {
        const ds = prey.s - this.s;
        if (Math.abs(ds) < 60) want = clamp(prey.v + clamp(ds * 0.7, -5, this.cop ? 18 : 6), 0, b.top * (this.cop ? 1 : this.pace * 1.04));
      }
      // racing line
      ai.laneT -= dt;
      if (ai.laneT > 0.05 && ai.danger) { ai.danger = false; ai.laneT = 0; }
      if (ai.laneT <= 0) { ai.laneT = 0.16 + (1.1 - ai.skill) * 0.6 + Math.random() * 0.1; ai.targetD = this.chooseLine(prey, look); }
      if (down) { // a cop pulls up beside the rider he knocked down
        const ds = down.r.s - this.s;
        want = clamp(ds * 0.9, 0, 34);
        ai.targetD = clamp(down.r.d + (down.r.d > 0 ? -1.8 : 1.8), tr.limitL(this.s) + 0.5, tr.limitR(this.s) - 0.5);
      }
      // don't run up the back of the car ahead in our line
      let follow = 1e9;
      tr.carsNear(this.s, look + 10, car => {
        if (car.v <= 0 || car.s < this.s || Math.abs(car.d - this.d) > car.w / 2 + 0.85) return;
        const gap = car.s - car.len / 2 - this.s - 2.5;
        follow = Math.min(follow, car.v + Math.max(-6, gap) * 0.55);
      });
      if (follow < want) want = Math.max(0, follow);
      if (ai.blocked) want = Math.min(want, ai.blocked);
      const k = tr.curv(this.s), latMax = (2.6 * Math.min(1, this.v / 8) + this.v * 0.16) * b.handling;
      const err = ai.targetD - this.d;
      const vlatWant = clamp(err * 2.4, -9, 9) - this.pushV * 0.5;
      inp.steer = clamp((vlatWant + k * this.v * this.v * 0.6) / Math.max(latMax, 0.5), -1, 1);
      inp.throttle = this.v < want ? 1 : 0;
      inp.brake = this.v > want + 2 ? clamp((this.v - want) / 10, 0, 1) : 0;
      inp.nitro = this.nitro > 0 && !prey && kmax < 0.002 && Math.random() < dt * 0.15;
      // swing at whoever is alongside
      ai.cd -= dt;
      if (ai.cd <= 0 && !this.atk && !this.finished) {
        for (const o of race.riders) {
          if (o === this || !o.active || o.finished) continue;
          if (o.cop && this.cop) continue;
          const ds = o.s - this.s, dd = o.d - this.d, reach = (this.weapon ? this.weaponDef.reach : 1.9);
          if (Math.abs(ds) < 1.5 && Math.abs(dd) > 0.35 && Math.abs(dd) < reach) {
            const keen = this.cop ? (o.human ? 1 : 0) : (o.human || o.cop ? 1 : 0.4) * ai.aggro;
            if (Math.random() < keen * 0.6) {
              const kind = this.weapon ? 'weapon' : Math.random() < 0.3 ? 'kick' : 'punch';
              this.startAttack(kind, Math.sign(dd));
            }
            ai.cd = rand(0.35, 0.9) / Math.max(0.3, ai.aggro);
            break;
          }
        }
        if (ai.cd <= 0) ai.cd = 0.15;
      }
    }
    chooseLine(prey, look) {
      const tr = this.race.track, ai = this.ai;
      const lr = tr.limitR(this.s) - 0.9, ll = tr.limitL(this.s) + 0.9;
      let best = null, bestCost = 1e9; ai.blocked = 0;
      const block = {};
      for (const c of [-5.6, -3.6, -1.8, 0, 1.8, 3.6, 5.6, this.d]) {
        let cost = Math.abs(c - this.d) * 0.08 + Math.abs(c - ai.pref) * 0.05 + (c < 0 ? 0.25 : 0);
        if (c > H - 0.3 || c < -H + 0.3) cost += 3;
        if (c > lr || c < ll) cost += 30;
        const lo = Math.min(c, this.d), hi = Math.max(c, this.d);
        tr.carsNear(this.s - 6, look + 12, car => {
          const ds = car.s - this.s, rv = this.v - car.v;
          if (ds < -car.len / 2 - 1.5) return;
          if (rv < 0.5 && ds > 4) return;
          const ttc = Math.max(0, ds - car.len / 2 - 1.5) / Math.max(rv, 0.5);
          const m = car.w / 2 + 0.9;
          if (Math.abs(car.d - c) < m + 0.2) {
            if (ttc < 3.4) { cost += (3.4 - ttc) * (car.v < 0 ? 9 : 4); if (ttc < 1.0) block[c] = Math.max(0, car.v - 3); }
          } else if (car.d + m > lo && car.d - m < hi && ttc < 1.3) cost += (1.3 - ttc) * 9; // would cut across its nose
        });
        // don't ride up the back of another bike
        for (const o of this.race.riders) if (o !== this && o.active && o.s > this.s && o.s - this.s < 9 && o.v < this.v && Math.abs(o.d - c) < 1.0) cost += 0.8;
        tr.obstaclesNear(this.s + look / 2, look / 2, ob => { if (ob.s > this.s && Math.abs(ob.d - c) < ob.hd + 1.0) cost += 6; });
        if (prey) { const want = prey.d + (prey.d > this.d ? -1.3 : 1.3); cost += Math.abs(c - want) * 0.25 - 0.5; }
        if (cost < bestCost) { bestCost = cost; best = c; }
      }
      if (block[best] !== undefined) ai.blocked = Math.max(1, block[best]);
      return best;
    }
    // ---- cops ----
    copWatch() {
      for (const o of this.race.riders) {
        if (!o.human || !o.active || o.finished) continue;
        const ds = o.s - this.s;
        if (ds > -25 && ds < 45) { this.copState = 'chase'; this.siren = true; this.ai.prey = o; this.race.emit('copGo', { who: this, prey: o }); return; }
      }
    }
    copChase(ai) {
      const p = ai.prey;
      if (!p || p.finished || p.out || p.s - this.s > 450) { if (this.copState !== 'done') { this.copState = 'done'; this.siren = false; ai.prey = null; this.pace = 0.5; } return; }
      ai.preyT = 1;
      if (p.crash && p.crash.phase !== 'fly') {
        // pull up next to the man on the ground
        const ds = p.crash.r.s - this.s;
        ai.prey = p; ai.stopAt = ds;
      }
    }

    // ------------------------------------------------------------------ remote (network) riders
    remoteStep(dt) {
      const n = this.net;
      if (!n || !n.cur) return;
      // move towards the newest state, extrapolating a little with speed
      n.age += dt;
      const tgt = n.cur, ext = Math.min(n.age, 0.25);
      const ts = tgt.s + tgt.v * ext;
      const blend = 1 - Math.exp(-12 * dt);
      if (Math.abs(ts - this.s) > 25) this.s = ts; else this.s += (ts - this.s) * blend + this.v * dt * (1 - blend);
      this.d += (tgt.d - this.d) * blend;
      this.v = tgt.v; this.lean += (tgt.lean - this.lean) * blend; this.phi = tgt.phi; this.hp = tgt.hp; this.dmg = tgt.dmg;
      this.Y += (this.race.track.height(this.s) + tgt.air - this.Y) * blend;
      this.pitch = Math.atan(this.race.track.slope(this.s)) + (tgt.air > 0.2 ? 0.1 : 0);
      this.air = tgt.air > 0.1;
      this.nitroT = tgt.nitro ? 1 : 0;
      if (tgt.atk && (!this.atk || this.atk.t > tgt.atk[2] + 0.05 || this.atk.kind !== tgt.atk[0])) {
        const def = tgt.atk[0] === 'weapon' ? this.weaponDef || RR.WEAPONS.club : RR.ATTACKS[tgt.atk[0]];
        this.atk = { kind: tgt.atk[0], side: tgt.atk[1], t: tgt.atk[2], def, done: true };
      }
      if (this.atk) { this.atk.t += dt; if (this.atk.t > this.atk.def.wind + this.atk.def.hit + this.atk.def.rec) this.atk = null; }
      if (tgt.crash) {
        const c = this.crash || (this.crash = { t: 0, phase: 'fly', r: {}, b: {}, side: 1 });
        const lerpB = (o, a) => { if (o.s === undefined) Object.assign(o, { s: a[0], d: a[1], h: a[2], rx: a[3], ry: a[4], rz: a[5] }); else { o.s += (a[0] - o.s) * blend; o.d += (a[1] - o.d) * blend; o.h += (a[2] - o.h) * blend; o.rx = a[3]; o.ry = a[4]; o.rz = a[5]; } };
        lerpB(c.r, tgt.crash.r); lerpB(c.b, tgt.crash.b); c.phase = tgt.crash.ph; c.sliding = tgt.crash.sl; c.t += dt;
        this.runPh += dt * 14;
      } else if (this.crash) this.crash = null;
      if (tgt.weapon !== undefined) this.weapon = tgt.weapon;
      this.finishedRemote = tgt.fin; this.out = tgt.out || null;
    }
    // compact state for the network
    packState() {
      const r2 = x => Math.round(x * 100) / 100;
      const st = { s: r2(this.s), d: r2(this.d), v: r2(this.v), lean: r2(this.lean), phi: r2(this.phi), hp: Math.round(this.hp), dmg: Math.round(this.dmg),
        air: r2(this.air ? this.Y - this.race.track.height(this.s) : 0), nitro: this.nitroT > 0 ? 1 : 0, weapon: this.weapon, fin: this.finished, out: this.out };
      if (this.atk) st.atk = [this.atk.kind, this.atk.side, r2(this.atk.t)];
      if (this.crash) { const c = this.crash, b = o => [r2(o.s), r2(o.d), r2(o.h), r2(o.rx), r2(o.ry), r2(o.rz)]; st.crash = { r: b(c.r), b: b(c.b), ph: c.phase, sl: !!c.sliding }; }
      if (this.cop) st.siren = this.siren;
      return st;
    }

    // ------------------------------------------------------------------ drawing
    render(dt, tmp) {
      const m = this.model, tr = this.race.track, T = window.THREE;
      this.anim += dt;
      const D = m.D;
      if (!this.crash) {
        const p = tr.pos(this.s, this.d, 0, tmp.v); p.y = this.Y;
        let bump = 0;
        if (this.offroad && !this.air) bump = (Math.sin(this.anim * 37) * 0.03 + Math.sin(this.anim * 23) * 0.025) * Math.min(1, this.v / 15);
        p.y += bump - this.landT * 0.08;
        tmp.e.set(this.pitch, -(tr.heading(this.s) + this.phi), this.lean, 'YXZ');
        m.bike.position.copy(p); m.bike.quaternion.setFromEuler(tmp.e);
        m.rider.position.copy(p); m.rider.quaternion.copy(m.bike.quaternion);
        m.rider.visible = true;
        m.blob.position.set(p.x, tr.height(this.s) + 0.03, p.z); m.blob.rotation.set(-Math.PI / 2, 0, -(tr.heading(this.s) + this.phi), 'YXZ');
        m.blob.scale.setScalar(this.air ? Math.max(0.3, 1 - (this.Y - tr.height(this.s)) * 0.15) : 1);
        this.wheelA -= this.v / D.wr * dt;
        m.wheelF.rotation.x = m.wheelR.rotation.x = this.wheelA;
        m.pose(this.ridePose());
      } else {
        const c = this.crash;
        // bike
        let p = tr.pos(c.b.s, c.b.d, c.b.h, tmp.v);
        if (c.b.h <= 0.05) p.y += 0.25 * Math.abs(Math.sin(c.b.rz));
        tmp.e.set(c.b.rx, -(tr.heading(c.b.s)) + c.b.ry, c.b.rz, 'YXZ');
        m.bike.position.copy(p); m.bike.quaternion.setFromEuler(tmp.e);
        m.blob.position.set(p.x, tr.height(c.b.s) + 0.03, p.z);
        // rider
        p = tr.pos(c.r.s, c.r.d, c.r.h, tmp.v);
        if (c.phase === 'mount') {
          m.rider.position.copy(m.bike.position); tmp.e.set(0, -(tr.heading(c.b.s)) + c.b.ry, 0, 'YXZ'); m.rider.quaternion.setFromEuler(tmp.e);
          m.bike.quaternion.copy(m.rider.quaternion);
          m.pose(this.ridePose());
        } else {
          tmp.e.set(c.r.rx, -(tr.heading(c.r.s)) + c.r.ry, c.r.rz, 'YXZ');
          m.rider.quaternion.setFromEuler(tmp.e);
          if (c.phase === 'run') { m.rider.position.copy(p); m.rider.position.y = tr.height(c.r.s) + (c.r.h || 0); }
          else { // body spins about the hips
            tmp.v2.set(0, -0.95, 0).applyQuaternion(m.rider.quaternion);
            m.rider.position.copy(p).add(tmp.v2);
            if (c.phase === 'lie') m.rider.position.y = Math.max(m.rider.position.y, tr.height(c.r.s) + 0.12 - 0.95 * Math.cos(c.r.rx));
          }
          m.pose(this.offPose(c));
        }
      }
      if (m.red) { const on = this.siren && Math.floor(this.anim * 8) % 2; m.red.visible = this.siren ? !!on : false; m.blue.visible = this.siren ? !on : false; }
      m.setWeapon(this.weapon);
    }
    ridePose() {
      const T = window.THREE, D = this.model.D, a = this.atk;
      const P = { mode: 'ride', tuck: clamp(this.v / (this.bike.top || 60), 0, 1), twist: 0, roll: this.lean * 0.35, look: 0 };
      if (this.hitT > 0) P.roll += this.hitSide * this.hitT * 1.0;
      if (this.weapon && !a) P.armR = new T.Vector3(0.36, D.seat + 0.42, 0.12);
      if (this.finished && this.place === 1 && this.human) { P.armR = new T.Vector3(0.3, D.seat + 1.1 + Math.sin(this.anim * 9) * 0.1, 0.15); P.tuck = 0; }
      if (a) {
        const D2 = a.def, t = a.t, side = a.side;
        const w = t < D2.wind ? t / D2.wind : t < D2.wind + D2.hit ? 1 : Math.max(0, 1 - (t - D2.wind - D2.hit) / D2.rec);
        const windup = t < D2.wind;
        if (a.kind === 'kick') {
          const S = side < 0 ? 'footL' : 'footR';
          P[S] = windup ? new T.Vector3(side * (0.3 + 0.1 * w), D.seat - 0.05, 0.05) : new T.Vector3(side * (0.35 + 0.75 * w), D.seat - 0.2 + 0.1 * w, 0.1);
          P.roll -= side * 0.3 * w; P.look = -side * 0.5;
        } else if (a.kind === 'punch') {
          const S = side < 0 ? 'armL' : 'armR';
          P[S] = windup ? new T.Vector3(side * 0.25, D.seat + 0.55, 0.1) : new T.Vector3(side * (0.35 + 0.65 * w), D.seat + 0.45, -0.1 - 0.1 * w);
          P.twist = -side * 0.4 * w; P.roll -= side * 0.15 * w; P.look = -side * 0.6;
        } else {
          P.armR = windup ? new T.Vector3(0.3 * side, D.seat + 0.95, 0.3) : new T.Vector3(side * (0.3 + 0.8 * w), D.seat + 0.4 - 0.2 * w, -0.2);
          P.twist = -side * 0.5 * w; P.roll -= side * 0.2 * w; P.look = -side * 0.6;
        }
      }
      return P;
    }
    offPose(c) {
      const T = window.THREE, t = c.t;
      if (c.phase === 'run') {
        const ph = this.runPh, s1 = Math.sin(ph), s2 = Math.sin(ph + Math.PI);
        return { mode: 'run', twist: 0, footL: new T.Vector3(-0.13, 0.08 + Math.max(0, s1) * 0.28, -s1 * 0.4), footR: new T.Vector3(0.13, 0.08 + Math.max(0, s2) * 0.28, -s2 * 0.4),
          armL: new T.Vector3(-0.3, 0.95, s1 * 0.3 - 0.05), armR: new T.Vector3(0.3, 0.95, s2 * 0.3 - 0.05) };
      }
      const f = c.phase === 'fly' ? 1 : 0.15;
      return { mode: 'stand', pitch: 0,
        armL: new T.Vector3(-0.75, 1.35 + Math.sin(t * 13) * 0.3 * f, -0.1 + Math.cos(t * 11) * 0.2 * f), armR: new T.Vector3(0.75, 1.3 + Math.sin(t * 12 + 1) * 0.3 * f, -0.1),
        footL: new T.Vector3(-0.35, 0.05 + Math.sin(t * 10) * 0.2 * f, -0.1), footR: new T.Vector3(0.38, 0.1 + Math.cos(t * 9) * 0.2 * f, 0.1) };
    }
  }
  RR.Rider = Rider;
})();
