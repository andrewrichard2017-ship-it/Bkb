// A fighter: movement, punching, defence, damage, knockdowns and how they're drawn.
(() => {
  'use strict';
  const BK = window.BK, ctx = BK.ctx, D = BK.draw, P = BK.PUNCHES, PI = Math.PI;
  const { lerp, clamp } = BK;
  const INK = BK.PAL.ink;

  class Fighter {
    // alt: use the fighter's alternate colours (both corners picked the same man)
    constructor(key, side, alt) {
      const base = BK.FIGHTERS[key];
      this.key = key; this.side = side;
      this.look = alt && base.alt ? Object.assign({}, base, base.alt) : base;
      this.corner = BK.CORNERS[side].corner; this.cornerColor = BK.CORNERS[side].color;
      this.voiceT = 0;
      this.resetFight();
    }

    // Attribute multipliers, including boosts picked up in the corner (percent).
    applyAttrs() {
      const a = this.look.attr, b = this.buffs;
      this.powerMul = a.POWER / 84 * (1 + b.power / 100);
      this.speedMul = a.SPEED / 80;
      this.chinMul = 83 / a.CHIN / (1 + b.chin / 100);
      this.stamMul = 81 / a.STAMINA / (1 + b.stamina / 100);
    }

    resetFight() {
      this.hp = 100; this.maxHp = 100; this.ghostHp = 100; this.stamina = 100; this.maxSta = 100;
      this.damage = 0; this.kdTotal = 0; this.ko = false;
      this.stats = { thrown: 0, landed: 0, pthrown: 0, planded: 0, counters: 0, kd: 0 };
      this.sweat = 0; this.blood = 0; // build up over the whole fight
      this.fistBlood = 0;
      this.bodyDmg = 0;               // accumulated body shots: slows stamina recovery
      this.cuts = [];                 // cuts opened on the face; they keep bleeding
      this.buffs = { power: 0, chin: 0, stamina: 0 };
      this.applyAttrs();
      this.resetRound();
    }
    resetRound() {
      this.u = this.side === 0 ? 0.3 : 0.7; this.z = 0.5; this.dir = this.side === 0 ? 1 : -1;
      this.kdRound = 0; this.roundDmg = 0; this.roundLanded = 0;
      this.punch = null; this.blocking = false; this.slip = null; this.counterWindow = 0;
      this.stun = 0; this.stagger = 0; this.knock = 0; this.flash = 0;
      this.walk = 0; this.moving = 0; this.t = Math.random() * 10;
      this.down = false; this.downT = 0; this.lift = 0; this.liftTarget = 0; this.rising = false;
      this.celebrate = false; this.regenDelay = 0; this.dripT = 0;
      this.grab = null; this.clinch = null; this.combo = []; this.superUsed = false;
      this.buffer = []; this.chainHits = 0;
      this.oof = null; // out on his feet: { t } while it lasts
      this.ropeDuck = 0; this.extraPose = null; this.extraW = 1;
      // animation state
      this.pose = BK.rig.make(); this.tpose = BK.rig.make(); this.tmp = BK.rig.make(); this.tmp2 = BK.rig.make();
      this.blockW = 0; this.hurtW = 0; this.hurtKind = 'head'; this.sq = 0; this.sqV = 0;
      this.impact = 0; this.impactHand = 'front'; this.blinkT = BK.rnd(1, 4);
    }

    // Grunts: throttled so a flurry doesn't turn into noise.
    grunt(kind, force) {
      if (!force && this.t - this.voiceT < 0.14) return;
      this.voiceT = this.t;
      BK.audio.voice(this.look.voice, kind);
    }

    get sx() { return BK.toScreenX(this.u, this.z); }
    get sy() { return BK.toScreenY(this.z); }
    get fs() { return BK.depthScale(this.z) * 1.38; }
    get headX() { return this.sx + this.dir * 8 * this.fs; }
    get headY() { return this.sy - 238 * this.fs; }
    get busy() { return this.down || this.stun > 0; }

    // Steer toward a ring position; returns a movement input.
    steer(u, z) {
      const tx = BK.toScreenX(u, z);
      return { mx: clamp((tx - this.sx) / 40, -1, 1), my: clamp((z - this.z) * 8, -1, 1) };
    }

    update(dt, input, opp) {
      this.opp = opp;
      this.logic(dt, input, opp);
      this.animate(dt);
    }

    logic(dt, input, opp) {
      this.t += dt;
      this.flash = Math.max(0, this.flash - dt);
      this.counterWindow = Math.max(0, this.counterWindow - dt);
      if (this.ghostHp > this.hp) this.ghostHp = Math.max(this.hp, this.ghostHp - 28 * dt);
      else this.ghostHp = this.hp;

      if (!this.down) this.sweat = Math.min(1, this.sweat + dt * 0.004 * (1 + this.moving));
      for (const c of this.cuts) c.age += dt;
      if (this.cuts.length && !this.down) this.blood = Math.min(1, this.blood + dt * 0.003 * this.cuts.length); // cuts bleed onto the top
      if (this.cuts.length && !this.down) {
        this.dripT -= dt;
        if (this.dripT <= 0) { this.dripT = BK.rnd(0.3, 1.2) / this.cuts.length; this.blood = Math.min(1, this.blood + 0.01); BK.fx.drip(this.headX + this.dir * 10 * this.fs, this.headY + 10 * this.fs, this.sy + 4); }
      }

      if (this.down) {
        this.downT += dt;
        // slide so the body lands inside the ropes rather than through them
        const tail = this.sx - this.dir * 300 * this.fs, w = BK.ringR(this.z) - BK.ringL(this.z);
        if (tail < BK.ringL(this.z) + 30) this.u += Math.min(0.02, (BK.ringL(this.z) + 30 - tail) / w) * dt * 10;
        if (tail > BK.ringR(this.z) - 30) this.u -= Math.min(0.02, (tail - BK.ringR(this.z) + 30) / w) * dt * 10;
        this.u = clamp(this.u, BK.U_MIN, BK.U_MAX);
        if (this.rising) this.liftTarget = 1;
        this.lift += (this.liftTarget - this.lift) * Math.min(1, dt * (this.rising ? 3.2 : 5));
        if (this.rising && this.lift > 0.985) { this.down = false; this.rising = false; this.lift = 0; this.downT = 0; }
        return;
      }

      if (this.knock) {
        this.u = clamp(this.u + this.knock * dt, BK.U_MIN, BK.U_MAX);
        this.knock *= Math.pow(0.02, dt);
        if (Math.abs(this.knock) < 0.005) this.knock = 0;
      }

      // recovery
      const bodyF = clamp(1 - this.bodyDmg / 220, 0.5, 1);
      if (!this.punch && !this.slip && !this.combo.length) this.stamina = Math.min(this.maxSta, this.stamina + (this.blocking ? 6 : 15) / this.stamMul * bodyF * (this.look.regen || 1) * dt);
      this.regenDelay -= dt;
      if (this.regenDelay <= 0 && this.hp < this.maxHp && !this.oof) this.hp = Math.min(this.maxHp, this.hp + 0.5 * dt);

      if (this.clinch) { this.clinchLogic(dt, input, opp); return; }
      if (this.stun > 0) { this.stun -= dt; this.punch = null; this.blocking = false; this.slip = null; this.grab = null; this.combo = []; this.buffer = []; this.moving = 0; return; }

      const dx = opp.sx - this.sx;
      if (Math.abs(dx) > 8 && !this.celebrate) this.dir = Math.sign(dx);

      if (this.slip) {
        this.slip.t += dt;
        if (this.slip.t >= this.slip.dur) { // come back with a punch: a cross off the lean, a hook out of the roll
          const kind = this.slip.kind; this.slip = null;
          if (!this.punch && this.stagger <= 0 && !this.clinch) this.throwPunch(kind === 'duck' ? 'hook' : 'cross', { auto: true });
        }
      }
      const staggered = this.stagger > 0;
      if (staggered) this.stagger -= dt;

      this.blocking = !!input.block && !this.punch && !this.slip && !staggered && !this.oof;

      // movement
      let spd = this.punch ? 0.25 : this.blocking ? 0.45 : this.slip || this.grab ? 0.3 : 1;
      if (staggered) spd *= 0.4;
      if (this.stamina < 20) spd *= 0.75;
      spd *= (0.9 + 0.1 * this.speedMul) * (this.look.move || 1);
      let mx = input.mx || 0, my = input.my || 0;
      if (staggered) { mx += Math.sin(this.t * 5) * 0.5; my += Math.cos(this.t * 4) * 0.4; }
      if (this.oof) { // out on his feet: legs gone, every step lurches somewhere he didn't mean
        spd *= 0.4;
        mx = mx * 0.5 + Math.sin(this.t * 2.1 + Math.sin(this.t * 0.7) * 2) * 0.9;
        my = my * 0.5 + Math.cos(this.t * 1.6) * 0.5;
      }
      const mag = Math.min(1, Math.hypot(mx, my));
      const w = BK.ringR(this.z) - BK.ringL(this.z);
      this.u = clamp(this.u + mx * 330 * spd * dt / w, BK.U_MIN, BK.U_MAX);
      this.z = clamp(this.z + my * 0.62 * spd * dt, BK.Z_MIN, BK.Z_MAX);
      this.moving = mag * spd;
      this.walk += dt * 11 * this.moving * ((mx * this.dir) >= 0 ? 1 : -1);
      if (this.oof) { this.buffer.length = 0; this.combo = []; this.slip = null; this.grab = null; return; } // can't throw, sway or grab

      // slip
      const sway = this.look.sway;
      if (input.slip && sway === 'combo' && !this.punch && !this.combo.length && !staggered && this.stamina >= 40) {
        // Skinny Arthur: automatic jab, cross, left hook for 40% of the bar
        this.stamina -= 40;
        this.combo = ['jab', 'cross', 'hook'];
        BK.fx.popup('COMBO!', this.headX, this.headY - 60, BK.PAL.brass, 40);
      }
      if (this.combo.length && !staggered && this.canThrow(this.combo[0])) this.throwPunch(this.combo.shift(), { auto: true, fast: true });
      if (input.slip && (sway === 'lean' || sway === 'duck') && !this.punch && !this.slip && !staggered && this.stamina > 4) {
        const duck = sway === 'duck';
        this.slip = { t: 0, dur: duck ? 0.5 : 0.4, kind: duck ? 'duck' : 'lean' };
        this.stamina = Math.max(0, this.stamina - 15 * this.stamMul); // sway + the punch that comes back
      }
      // clinch attempt: a visible reach-in the other fighter can block or sway away from
      if (this.grab) {
        if (this.grab.t === 0) this.grunt('effortSmall');
        this.grab.t += dt;
        if (this.grab.t >= this.grab.dur) { this.grab = null; this.resolveGrab(opp); }
      } else if (input.clinch && !this.look.noClinch && !this.punch && !this.slip && !this.combo.length && this.stamina > 3) {
        this.grab = { t: 0, dur: 0.38 };
        this.stamina -= 3;
      }
      // punches (hold BODY to go downstairs)
      // A tap is remembered briefly (buffered) and thrown as soon as it can be, so combos flow
      const superReady = input.ko && this.superAvailable(opp);
      const want = superReady ? (this.look.super || 'ko') : ['jab', 'cross', 'hook', 'upper'].find(k => input[k]);
      // Up to three taps queue up in order, so mashing jab-cross-hook throws exactly that.
      if (want && this.buffer.length < 3) this.buffer.push({ type: want, body: !!input.body && !P[want].super, t: 0.9 });
      for (const q of this.buffer) q.t -= dt;
      while (this.buffer.length && this.buffer[0].t <= 0) this.buffer.shift();
      const b = this.buffer[0];
      if (b && !this.blocking && !this.slip && !this.grab && !this.combo.length && !staggered && this.canThrow(b.type)) {
        this.buffer.shift();
        this.throwPunch(b.type, { body: b.body });
      }
      this.tickPunch(dt, opp);
    }

    // Super punch is on offer when the opponent is under 8% health (Digger's only once a round).
    superAvailable(opp) { return opp.hp < 8 && !opp.down && !opp.oof && !(this.look.superOnce && this.superUsed); }

    // Free, or far enough through the current punch to chain the next one.
    // Switching hands chains straight after the impact; the same hand needs more of the recovery.
    canThrow(type) {
      const p = this.punch;
      if (!p) return true;
      if (!p.resolved || p.super || P[type].super || p.clinch) return false;
      return p.t >= this.chainAt(p, type);
    }
    chainAt(p, type) { return P[type].hand !== p.hand ? p.hitAt + 0.05 : p.hitAt + (p.dur - p.hitAt) * 0.65; }
    // For the touch buttons: is a follow-up punch ready right now?
    get chainReady() { const p = this.punch; return !!(p && p.resolved && !p.super && !p.clinch && p.t >= p.hitAt + 0.05 && p.t < p.dur); }

    tickPunch(dt, opp) {
      const p = this.punch;
      if (!p) return;
      p.t += dt;
      if (!p.resolved && p.t >= p.hitAt) { p.resolved = true; this.resolve(opp, p); }
      if (p.t >= p.dur) this.punch = null;
    }

    // Locked up: no movement, no guard. Punches become short digs to the body.
    clinchLogic(dt, input, opp) {
      const c = this.clinch;
      c.t += dt;
      this.slip = null; this.grab = null; this.moving = 0; this.stun = 0;
      this.blocking = !!input.block && !this.punch; // tie his arms up
      if (c.role === 'holder') { // leaning on him buys time
        this.stamina = Math.min(this.maxSta, this.stamina + 14 * dt);
        this.stagger = Math.max(0, this.stagger - dt * 1.5);
      } else this.stamina = Math.max(0, this.stamina - 3 * dt);
      const want = ['jab', 'cross', 'hook', 'upper'].find(k => input[k]);
      if (want && !this.punch && !this.blocking) this.throwPunch(want, { clinch: true, body: true });
      this.tickPunch(dt, opp);
    }

    resolveGrab(opp) {
      const dx = (opp.sx - this.sx) * this.dir;
      if (opp.down || opp.clinch || opp.oof || dx <= 0 || dx > 175 * this.fs || Math.abs(opp.z - this.z) > 0.14) { BK.audio.whoosh(); return; }
      if (opp.slip && opp.slip.t < 0.35) {
        opp.counterWindow = 0.8; this.stun = 0.3;
        BK.fx.popup('SWAYED', opp.headX, opp.headY - 40, BK.PAL.bone, 36);
        BK.audio.whoosh();
        return;
      }
      if (opp.blocking && opp.dir === -this.dir) {
        this.knock = -this.dir * 0.14; this.stun = 0.18;
        BK.fx.popup('CLINCH BLOCKED', opp.headX, opp.headY - 40, BK.PAL.bone, 32);
        BK.audio.punch('blocked');
        return;
      }
      BK.game.startClinch(this, opp);
    }

    throwPunch(type, opt = {}) {
      if (P[type].super) { BK.game.onKoPunch(this, type); this.superUsed = true; }
      const d = P[type];
      const prev = this.punch;
      const chain = prev && !opt.clinch ? (prev.chain || 0) + 1 : 0;
      if (!prev) this.chainHits = 0;
      const tired = this.stamina < 25 ? 1.2 : 1;
      const sp = (this.speedMul * 0.5 + 0.5) * (opt.clinch ? 1.35 : 1) * (opt.fast ? 1.2 : 1);
      this.punch = { type, ...d, dur: d.dur * tired / sp, hitAt: d.hitAt * tired / sp, t: 0, resolved: false, body: !!opt.body, clinch: !!opt.clinch,
        chain, from: BK.rig.copy(this.pose, {}) }; // start from wherever the arm is now
      if (opt.clinch) { this.punch.dmg = d.dmg * 0.28; this.punch.reach = 999; }
      if (!opt.auto) this.stamina = Math.max(0, this.stamina - d.cost * this.stamMul * (opt.clinch ? 0.5 : 1));
      this.stats.thrown++; if (d.power) this.stats.pthrown++;
      if (P[type].super) this.grunt('effortHuge', true);
      else if (opt.clinch) { if (Math.random() < 0.5) this.grunt('effortSmall'); }
      else if (d.power ? Math.random() < 0.85 : Math.random() < 0.4) this.grunt(d.power ? 'effortBig' : 'effort');
    }

    punchExt() {
      const p = this.punch;
      if (!p) return 0;
      return p.t < p.hitAt ? p.t / p.hitAt : Math.max(0, 1 - (p.t - p.hitAt) / (p.dur - p.hitAt));
    }

    resolve(opp, p) {
      if (p.clinch) { if (opp.clinch) opp.receive(p, this); else this.whiff(); return; }
      const dx = (opp.sx - this.sx) * this.dir;
      const inRange = !opp.down && dx > 0 && dx < p.reach * this.fs && Math.abs(opp.z - this.z) < 0.12;
      if (!inRange) { this.whiff(); return; }
      const sl = opp.slip, ducking = sl && sl.kind === 'duck';
      if (sl && !p.body && sl.t < (ducking ? 0.38 : 0.3)) {
        if (ducking && p.type === 'upper') { // ran straight into it
          BK.fx.popup('CAUGHT DUCKING', opp.headX, opp.headY - 60, BK.PAL.brass, 36);
          opp.receive({ ...p, dmg: p.dmg * 1.4 }, this);
          return;
        }
        this.whiff();
        opp.counterWindow = ducking ? 1.0 : 0.8; // rolling under loads up a bigger counter
        BK.fx.popup(ducking ? 'DUCKED' : 'SLIPPED', opp.headX, opp.headY - 40, BK.PAL.bone, 34);
        return;
      }
      opp.receive(p, this);
    }

    whiff() {
      this.stamina = Math.max(0, this.stamina - this.punch.cost * 0.5 * this.stamMul);
      BK.audio.whoosh();
    }

    receive(p, from) {
      const facing = this.dir === -from.dir;
      const blocked = this.blocking && facing && !p.super && !p.clinch;
      const counter = !blocked && !p.clinch && ((this.punch && !this.punch.resolved) || from.counterWindow > 0);
      const through = p.body ? Math.max(p.through, 0.45) : p.through; // a high guard leaves the body open
      const staminaF = 0.55 + 0.45 * Math.min(1, from.stamina / 60);
      let dmg = p.dmg * from.powerMul * staminaF * this.chinMul * (counter ? 1.6 : 1);
      if (this.stagger > 0) dmg *= 1.25;
      if (p.chain) dmg *= 1 + 0.08 * Math.min(4, p.chain); // combos hit a little harder
      from.counterWindow = 0;
      const hx = this.sx - from.dir * 18 * this.fs, hy = p.body ? this.sy - 150 * this.fs : this.headY;
      const floor = p.clinch ? Math.min(this.hp, 1) : 0; // clinch digs can hurt, never finish
      if (p.clinch && this.blocking) { // arms tied up: the dig is smothered
        from.stamina = Math.max(0, from.stamina - 2);
        if (Math.random() < 0.4) BK.fx.popup('TIED UP', this.headX, this.headY - 40, BK.PAL.bone, 30);
        BK.audio.punch('blocked');
        return;
      }
      if (p.body) { // body shots: less to the head, but they sap the legs and the lungs
        this.stamina = Math.max(0, this.stamina - dmg * (blocked ? 0.6 : 1.8));
        if (!blocked) this.bodyDmg += dmg;
        dmg *= 0.35;
      }

      if (blocked) {
        dmg *= through;
        this.hp = Math.max(floor, this.hp - dmg);
        this.stamina = Math.max(0, this.stamina - p.dmg * 0.45);
        this.knock = from.dir * 0.07;
        this.sqV += 3; from.impact = 0.6; from.impactHand = p.hand;
        BK.game.hitstop(0.03);
        BK.audio.punch('blocked');
        if (Math.random() < 0.35) this.grunt('block');
        BK.fx.impact(hx - from.dir * 20 * this.fs, hy + 20 * this.fs, from.dir, this.sy, 'blocked', 0.8);
        if (through > 0.3) BK.fx.popup(p.body ? 'TO THE BODY' : 'GUARD BROKEN', this.headX, this.headY - 50, BK.PAL.bone, 30);
      } else {
        this.hp = Math.max(floor, this.hp - dmg);
        if (!p.body) this.damage = Math.min(1, this.damage + dmg / 240);
        this.stun = p.clinch ? 0.08 : p.stun * (counter ? 1.3 : 1);
        this.knock = p.clinch ? 0 : from.dir * (p.power ? 0.26 : 0.14);
        this.hurtW = Math.min(1.3, (p.clinch ? 0.35 : 0.7) + p.snap * (counter ? 1.8 : 1.2));
        this.hurtKind = p.body ? 'body' : p.type === 'upper' ? 'up' : 'head';
        this.sqV += (p.power ? 9 : 5) * (counter ? 1.4 : 1);
        from.impact = 1; from.impactHand = p.hand;
        this.sweat = Math.min(1, this.sweat + 0.04);
        BK.game.hitstop(counter ? 0.13 : p.power ? 0.085 : 0.045);
        BK.cam.kick = counter ? 0.06 : p.power ? 0.035 : 0.015;
        this.flash = 0.12;
        this.regenDelay = 3;
        if (this.punch) this.punch = null;
        this.slip = null;
        from.stats.landed++; from.roundLanded++; from.roundDmg += dmg;
        from.chainHits = p.chain ? from.chainHits + 1 : 1;
        if (from.chainHits >= 3 && !p.clinch) BK.fx.popup(`${from.chainHits}-HIT COMBO!`, from.headX, from.headY - 110, '#f0c75a', 36 + Math.min(4, from.chainHits) * 3);
        if (p.power) from.stats.planded++;
        BK.fx.impact(hx, hy, from.dir, this.sy, 'sweat', p.power ? 1.3 : 0.8);
        if (p.body && !p.clinch && p.power) BK.fx.popup('BODY SHOT', this.sx, this.sy - 200 * this.fs, BK.PAL.bone, 30);
        const bleeding = this.cuts.length > 0;
        if (!p.body && ((p.power && (this.damage > 0.25 || counter)) || (bleeding && Math.random() < 0.6))) {
          BK.fx.blood(hx, hy + 6, from.dir, this.sy, (counter ? 2.2 : p.power ? 1.5 : 0.8) * (1 + this.cuts.length * 0.25));
          this.blood = Math.min(1, this.blood + (p.power ? 0.07 : 0.03));
          if (bleeding) from.fistBlood = Math.min(1, (from.fistBlood || 0) + 0.12);
        }
        if (!p.body && !p.clinch) this.openCuts(from);
        if (counter) {
          from.stats.counters++;
          BK.fx.popup('COUNTER!', this.headX, this.headY - 50, BK.PAL.brass, 48);
          BK.audio.punch('counter');
        } else BK.audio.punch(p.power ? 'power' : 'jab');
        BK.cam.shake = Math.max(BK.cam.shake, counter ? 14 : p.power ? 9 : 4);
        if (p.type === 'duster') { // brass on bone
          BK.fx.impact(hx, hy, from.dir, this.sy, 'blocked', 2);
        }
        this.grunt(p.clinch ? 'hurtSmall' : p.body ? 'hurtBody' : p.power || counter ? 'hurtBig' : 'hurt', p.power);
        if (this.damage > 0.5 && !p.body) from.blood = Math.min(1, from.blood + 0.012); // his blood on your hands and vest
        BK.audio.excite(dmg / 40);
        BK.vibrate(p.power ? 45 : 20, this.side);
        if (!p.clinch && this.hp > 0 && this.hp < 28 && p.power && this.stagger <= 0 && Math.random() < 0.45) {
          this.stagger = 1.1;
          BK.fx.popup('HURT!', this.headX, this.headY - 90, BK.PAL.blood, 40);
          BK.audio.roar(0.3);
        }
      }
      if (this.oof && !blocked) { // nothing left to stop it: every clean one opens him up more
        this.blood = Math.min(1, this.blood + 0.03);
        if (!p.body) BK.fx.blood(this.headX, this.headY + 10 * this.fs, from.dir, this.sy, 1.4);
      }
      if (this.hp <= 0 && !p.clinch) BK.game.onZeroHp(this, from, p.type);
    }

    // Cuts open as the face takes damage; each one keeps bleeding for the rest of the fight.
    openCuts(from) {
      const SITES = [
        { at: 0.35, name: 'brow', x: 20, y: -45, len: 11, ang: 0.15 },
        { at: 0.45, name: 'nose', x: 31, y: -19, len: 0, ang: 0 },
        { at: 0.55, name: 'lip', x: 27, y: -9, len: 6, ang: -0.3 },
        { at: 0.65, name: 'cheek', x: 22, y: -26, len: 10, ang: 0.5 },
        { at: 0.8, name: 'forehead', x: 8, y: -54, len: 14, ang: -0.2 },
      ];
      for (const c of SITES) {
        if (this.damage >= c.at && !this.cuts.some(k => k.name === c.name)) {
          this.cuts.push({ ...c, age: 0 });
          BK.fx.popup(c.name === 'nose' ? 'BLOODY NOSE!' : 'CUT!', this.headX, this.headY - 60, '#e2584f', 42);
          BK.fx.blood(this.headX, this.headY, from.dir, this.sy, 2.5);
          this.blood = Math.min(1, this.blood + 0.05);
          break;
        }
      }
    }

    knockDown() {
      this.down = true; this.downT = 0; this.lift = 0; this.liftTarget = 0; this.rising = false;
      this.punch = null; this.slip = null; this.blocking = false; this.stun = 0; this.stagger = 0;
      this.grab = null; this.clinch = null; this.combo = [];
      this.kdTotal++; this.kdRound++;
      this.grunt('down', true);
    }
    getUp(hp) {
      this.rising = true;
      this.maxHp = Math.max(45, this.maxHp - 12);
      this.hp = Math.min(this.maxHp, hp);
      this.ghostHp = this.hp;
      this.stamina = Math.min(this.maxSta, Math.max(this.stamina, 55));
      this.stagger = 0.8;
    }

    // ---------------- animation ----------------
    // Builds the target pose from game state, then eases the displayed pose toward it.
    animate(dt) {
      const R = BK.rig, PO = BK.POSES, T = this.tpose, U = R.UPPER;
      R.copy(PO.guard, T);
      const tired = clamp((32 - this.stamina) / 32, 0, 1);
      if (tired > 0) R.mixInto(T, PO.tired, tired, U);

      // boxer's bounce and footwork
      const m = Math.min(1, this.moving * 1.5), ph = this.walk;
      T.py += Math.sin(this.t * (tired > 0.5 ? 7 : 5)) * 2.5 * (1 - m * 0.6) - Math.abs(Math.sin(ph)) * 3 * m;
      T.ffX += Math.sin(ph) * 18 * m; T.ffY -= Math.max(0, Math.cos(ph)) * 10 * m;
      T.rfX -= Math.sin(ph) * 18 * m; T.rfY -= Math.max(0, -Math.cos(ph)) * 10 * m;
      T.lean += tired * Math.sin(this.t * 7) * 2; // heaving breaths

      this.blockW += ((this.blocking ? 1 : 0) - this.blockW) * Math.min(1, dt * 18);
      if (this.blockW > 0.01) R.mixInto(T, PO.block, this.blockW, U);
      if (this.slip) {
        const k = clamp(this.slip.t / this.slip.dur, 0, 1);
        if (this.slip.kind === 'duck') { // dip under, roll across, come up the other side
          R.mixInto(T, PO.duck, Math.sin(PI * k), U);
          T.px += Math.sin(2 * PI * k) * 12; T.lean += Math.sin(2 * PI * k) * 8;
        } else R.mixInto(T, PO.slip, Math.sin(PI * k), U);
      }
      if (this.grab) R.mixInto(T, PO.grab, BK.easeOut(this.grab.t / this.grab.dur), U);
      if (this.clinch) R.mixInto(T, this.clinch.role === 'holder' ? PO.clinchHold : PO.clinchHeld, Math.min(1, this.clinch.t * 6), U);
      if (this.punch) {
        this.punchPose(T);
        if (this.punch.body) { // same punch, aimed at the ribs: dip the knees and drop the fist
          const w = this.punchExt(), front = P[this.punch.type].hand === 'front';
          T[front ? 'fY' : 'rY'] += 58 * w; T.py += 12 * w; T.lean += 8 * w;
        }
      }
      if (this.oof) {
        const UF = R.SUPER; // upper body plus the feet
        R.mix(this.tmp, PO.oofA, PO.oofB, (Math.sin(this.t * 2.3) + 1) / 2, UF);
        R.mixInto(T, this.tmp, 1, UF);
        const lift = Math.pow(Math.max(0, Math.sin(this.t * 1.3)), 3) * 0.45; // tries to get the hands up, can't hold them
        T.fY += (PO.guard.fY - T.fY) * lift; T.rY += (PO.guard.rY - T.rY) * lift;
        T.rot = Math.sin(this.t * 2.3) * 3.5; T.rotX = 0;
        T.ffX += Math.sin(this.t * 3.1) * 10 * Math.min(1, this.moving * 2); T.rfX -= Math.sin(this.t * 3.1) * 10 * Math.min(1, this.moving * 2);
      }
      if (this.stagger > 0) {
        R.mix(this.tmp, PO.staggerA, PO.staggerB, (Math.sin(this.t * 4.5) + 1) / 2, U);
        R.mixInto(T, this.tmp, Math.min(1, this.stagger * 3), U);
      }
      if (this.hurtW > 0.01) R.mixInto(T, this.hurtKind === 'up' ? PO.hurtUp : this.hurtKind === 'body' ? PO.hurtBody : PO.hurt, Math.min(1, this.hurtW), U);
      if (this.ropeDuck) R.mixInto(T, PO.duck, this.ropeDuck, U);
      if (this.extraPose) R.mixInto(T, PO[this.extraPose], this.extraW == null ? 1 : this.extraW, U);
      if (this.celebrate && !this.down) {
        R.mix(this.tmp, PO.victoryA, PO.victoryB, (Math.sin(this.t * 7) + 1) / 2, U);
        R.mixInto(T, this.tmp, 1, U);
      }
      if (this.down) this.downPose(T);

      // squash & stretch spring, fist swelling on contact
      this.sqV += (-this.sq * 300 - this.sqV * 16) * dt;
      this.sq += this.sqV * dt;
      T.sqx = 1 + this.sq * 0.09; T.sqy = 1 - this.sq * 0.07;
      if (this.impact > 0) { T[this.impactHand === 'front' ? 'fZ' : 'rZ'] += this.impact * 0.3; this.impact = Math.max(0, this.impact - dt * 9); }
      this.hurtW = Math.max(0, this.hurtW - dt * 3.4);

      // Punches and hits snap straight to the target; everything else eases in.
      const snap = this.punch || this.hurtW > 0.25 || this.down;
      R.mixInto(this.pose, T, snap ? 1 : 1 - Math.exp(-dt * 20));
      this.blinkT -= dt;
      if (this.blinkT < -0.12) this.blinkT = BK.rnd(1.5, 4.5);
    }

    // wind-up -> snap to full extension -> held follow-through -> eased recovery
    // Supers also swing through a mid pose (an arc, not a straight line) and are aimed at the opponent's head.
    punchPose(T) {
      const R = BK.rig, PO = BK.POSES, p = this.punch, U = p.super ? R.SUPER : R.UPPER;
      const A = PO[p.type + 'A'], M = PO[p.type + 'M'], X = p.super ? this.aimed(PO[p.type + 'X']) : PO[p.type + 'X'];
      const tA = p.hitAt * (p.chain ? 0.35 : 0.5), hold = p.hitAt + (p.super ? 0.12 : p.power ? 0.075 : 0.045);
      if (p.t < tA) R.mixInto(T, R.mix(this.tmp, p.from, A, BK.easeInOut(p.t / tA), U), 1, U);
      else if (p.t < p.hitAt) {
        const k = (p.t - tA) / (p.hitAt - tA), e = 1 - Math.pow(1 - k, 3);
        if (M) { R.mix(this.tmp, A, M, e, U); R.mix(this.tmp2, M, X, e, U); R.mix(this.tmp, this.tmp, this.tmp2, e, U); }
        else R.mix(this.tmp, A, X, e, U);
        R.mixInto(T, this.tmp, 1, U);
      } else if (p.t < hold) {
        R.mixInto(T, X, 1, U);
        const k = (p.t - p.hitAt) / (hold - p.hitAt);
        T.lean += 3 * Math.sin(k * PI); T.px += 3 * Math.sin(k * PI); // follow-through
      } else R.mixInto(T, X, 1 - BK.easeInOut((p.t - hold) / (p.dur - hold)), U);
    }

    // Moves a super's contact pose so the fist lands on the near side of the other man's head: steps in (or
    // sits back) to get the arm the right length, then points the fist at him. Frozen at the moment of contact,
    // so the follow-through doesn't chase him as he's knocked away.
    aimed(X) {
      const p = this.punch, o = this.opp;
      if (p.aimQ) return p.aimQ;
      const Q = Object.assign(p.aimTmp || (p.aimTmp = {}), X);
      if (o && !o.down) {
        const fs = this.fs, DEG = PI / 180;
        const gx = (o.headX - this.sx) * this.dir / fs - 30 * o.fs / fs - 12 * X.rZ; // wrist, just short of his face
        const gy = (o.headY - this.sy) / fs + (p.aimY || 0);
        const c = Math.cos(Q.lean * DEG), s = Math.sin(Q.lean * DEG);
        const shx = -12 + Q.rsh, shy = -80;
        const Sx = Q.px + shx * c - shy * s, Sy = -120 + Q.py + shx * s + shy * c; // rear shoulder
        const ideal = BK.rig.REACH * (p.aim || 0.9), dy = Sy - gy;
        const shift = clamp(gx - Sx - Math.sqrt(Math.max(0, ideal * ideal - dy * dy)), -45, 85);
        Q.px += shift; Q.ffX += Math.max(0, shift) * 0.6;
        const ddx = gx - Q.px, ddy = gy - (-120 + Q.py);
        Q.rX = ddx * c + ddy * s; Q.rY = -ddx * s + ddy * c;
      }
      if (p.t >= p.hitAt) p.aimQ = Object.assign({}, Q);
      return Q;
    }

    // knocked down: recoil, topple, bounce, lie; then prop -> kneel -> stand as lift rises
    downPose(T) {
      const R = BK.rig, PO = BK.POSES, t = this.downT, L = this.lift;
      if (L > 0.02) {
        const keys = [[0, PO.lying], [0.4, PO.prop], [0.72, PO.kneel], [1, PO.guard]];
        for (let i = 1; i < keys.length; i++) {
          if (L <= keys[i][0] || i === keys.length - 1) {
            const k = clamp((L - keys[i - 1][0]) / (keys[i][0] - keys[i - 1][0]), 0, 1);
            R.mix(T, keys[i - 1][1], keys[i][1], BK.easeInOut(k));
            break;
          }
        }
        return;
      }
      if (t < 0.16) R.mix(T, T, PO.hurtBig, BK.easeOut(t / 0.16));
      else {
        const k = clamp((t - 0.16) / 0.34, 0, 1);
        R.mix(T, PO.hurtBig, PO.lying, k * k); // gravity: accelerate into the canvas
        if (t > 0.5) T.rot += Math.sin(clamp((t - 0.5) / 0.22, 0, 1) * PI) * 7; // bounce
        if (this.ko) T.head -= 8;
        else T.fY += Math.sin(this.t * 3) * 4; // groggy arm
      }
    }

    // ---------------- drawing ----------------
    get lying() { return clamp(-this.pose.rot / 86, 0, 1); }

    // Everything needed to draw this fighter on one frame (also what the replay records).
    snapshot() {
      // a super is drawn in front of the other man, so the fist lands on his face rather than disappearing behind him
      const z = this.z + (this.punch && this.punch.super ? 0.004 : 0);
      return { look: this.look, sx: this.sx, sy: this.sy, z, fs: this.fs, dir: this.dir,
        pose: BK.rig.copy(this.pose, {}), st: this.drawState(), flash: this.flash, headX: this.headX, headY: this.headY };
    }
    draw() { BK.drawFigure(this.snapshot()); }

    drawState() {
      return { damage: this.damage, dazed: this.stun > 0 || this.down || this.stagger > 0, blink: this.blinkT < 0, sweat: this.sweat, blood: this.blood,
        cuts: this.cuts.map(c => ({ ...c })), fistBlood: this.fistBlood || 0 };
    }

    drawPortrait(x, y, scale, flip) {
      ctx.save();
      ctx.translate(x, y - 8 * scale); ctx.scale(scale * (flip ? -1 : 1), scale);
      BK.rig.drawHead(this.look, this.drawState());
      ctx.restore();
    }
  }

  // Draw any recorded or live figure: shadow, cutout body, impact ring.
  BK.drawFigure = f => {
    const s = f.fs, ly = clamp(-f.pose.rot / 86, 0, 1);
    ctx.save();
    ctx.translate(f.sx, f.sy);
    ctx.fillStyle = 'rgba(40,25,10,0.3)';
    ctx.beginPath(); ctx.ellipse(-f.dir * 130 * s * ly, 0, ((f.shadow || 64) + 120 * ly) * s, 14 * s, 0, 0, Math.PI * 2); ctx.fill();
    ctx.scale(s * f.dir, s);
    BK.rig.draw(f.look, f.pose, f.st);
    if (f.extra) f.extra();
    ctx.restore();
    if (f.flash > 0) {
      ctx.save();
      ctx.globalAlpha = f.flash / 0.12 * 0.7;
      ctx.strokeStyle = BK.PAL.bone; ctx.lineWidth = 4;
      D.circle(f.headX, f.headY, 40 * f.fs * (1.4 - f.flash / 0.12 * 0.4)); ctx.stroke();
      ctx.restore();
    }
  };

  BK.Fighter = Fighter;
})();
