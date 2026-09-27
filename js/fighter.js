// A fighter: movement, punching, defence, damage, knockdowns and how they're drawn.
(() => {
  'use strict';
  const BK = window.BK, ctx = BK.ctx, D = BK.draw, P = BK.PUNCHES, PI = Math.PI;
  const { lerp, clamp } = BK;
  const INK = BK.PAL.ink;

  class Fighter {
    constructor(key, side) {
      this.key = key; this.look = BK.FIGHTERS[key]; this.side = side;
      const a = this.look.attr;
      this.powerMul = a.POWER / 84;
      this.speedMul = a.SPEED / 80;
      this.chinMul = 83 / a.CHIN;
      this.stamMul = 81 / a.STAMINA;
      this.resetFight();
    }

    resetFight() {
      this.hp = 100; this.maxHp = 100; this.ghostHp = 100; this.stamina = 100;
      this.damage = 0; this.kdTotal = 0; this.ko = false;
      this.stats = { thrown: 0, landed: 0, pthrown: 0, planded: 0, counters: 0, kd: 0 };
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
      // animation state
      this.pose = BK.rig.make(); this.tpose = BK.rig.make(); this.tmp = BK.rig.make();
      this.blockW = 0; this.hurtW = 0; this.hurtKind = 'head'; this.sq = 0; this.sqV = 0;
      this.impact = 0; this.impactHand = 'front'; this.blinkT = BK.rnd(1, 4); this.sweat = 0;
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
      this.logic(dt, input, opp);
      this.animate(dt);
    }

    logic(dt, input, opp) {
      this.t += dt;
      this.flash = Math.max(0, this.flash - dt);
      this.counterWindow = Math.max(0, this.counterWindow - dt);
      if (this.ghostHp > this.hp) this.ghostHp = Math.max(this.hp, this.ghostHp - 28 * dt);
      else this.ghostHp = this.hp;

      if (this.damage > 0.65 && !this.down) {
        this.dripT -= dt;
        if (this.dripT <= 0) { this.dripT = BK.rnd(0.6, 1.6); BK.fx.drip(this.headX + this.dir * 10 * this.fs, this.headY + 10 * this.fs, this.sy + 4); }
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
      if (!this.punch) this.stamina = Math.min(100, this.stamina + (this.blocking ? 6 : 15) / this.stamMul * dt);
      this.regenDelay -= dt;
      if (this.regenDelay <= 0 && this.hp < this.maxHp) this.hp = Math.min(this.maxHp, this.hp + 0.5 * dt);

      if (this.stun > 0) { this.stun -= dt; this.punch = null; this.blocking = false; this.slip = null; this.moving = 0; return; }

      const dx = opp.sx - this.sx;
      if (Math.abs(dx) > 8 && !this.celebrate) this.dir = Math.sign(dx);

      if (this.slip) { this.slip.t += dt; if (this.slip.t >= this.slip.dur) this.slip = null; }
      const staggered = this.stagger > 0;
      if (staggered) this.stagger -= dt;

      this.blocking = !!input.block && !this.punch && !this.slip && !staggered;

      // movement
      let spd = this.punch ? 0.25 : this.blocking ? 0.45 : this.slip ? 0.3 : 1;
      if (staggered) spd *= 0.4;
      if (this.stamina < 20) spd *= 0.75;
      spd *= 0.9 + 0.1 * this.speedMul;
      let mx = input.mx || 0, my = input.my || 0;
      if (staggered) { mx += Math.sin(this.t * 5) * 0.5; my += Math.cos(this.t * 4) * 0.4; }
      const mag = Math.min(1, Math.hypot(mx, my));
      const w = BK.ringR(this.z) - BK.ringL(this.z);
      this.u = clamp(this.u + mx * 330 * spd * dt / w, BK.U_MIN, BK.U_MAX);
      this.z = clamp(this.z + my * 0.62 * spd * dt, BK.Z_MIN, BK.Z_MAX);
      this.moving = mag * spd;
      this.walk += dt * 11 * this.moving * ((mx * this.dir) >= 0 ? 1 : -1);

      // slip
      if (input.slip && !this.punch && !this.slip && !staggered && this.stamina > 4) {
        this.slip = { t: 0, dur: 0.4 };
        this.stamina -= 5 * this.stamMul;
      }
      // punches
      const want = ['jab', 'cross', 'hook', 'upper'].find(k => input[k]);
      if (want && !this.punch && !this.blocking && !this.slip && !staggered) this.throwPunch(want);

      if (this.punch) {
        const p = this.punch;
        p.t += dt;
        if (!p.resolved && p.t >= p.hitAt) { p.resolved = true; this.resolve(opp, p); }
        if (p.t >= p.dur) this.punch = null;
      }
    }

    throwPunch(type) {
      const d = P[type];
      const tired = this.stamina < 25 ? 1.2 : 1;
      const sp = this.speedMul * 0.5 + 0.5;
      this.punch = { type, ...d, dur: d.dur * tired / sp, hitAt: d.hitAt * tired / sp, t: 0, resolved: false };
      this.stamina = Math.max(0, this.stamina - d.cost * this.stamMul);
      this.stats.thrown++; if (d.power) this.stats.pthrown++;
    }

    punchExt() {
      const p = this.punch;
      if (!p) return 0;
      return p.t < p.hitAt ? p.t / p.hitAt : Math.max(0, 1 - (p.t - p.hitAt) / (p.dur - p.hitAt));
    }

    resolve(opp, p) {
      const dx = (opp.sx - this.sx) * this.dir;
      const inRange = !opp.down && dx > 0 && dx < p.reach * this.fs && Math.abs(opp.z - this.z) < 0.12;
      if (!inRange) { this.whiff(); return; }
      if (opp.slip && opp.slip.t < 0.3) {
        this.whiff();
        opp.counterWindow = 0.8;
        BK.fx.popup('SLIPPED', opp.headX, opp.headY - 40, BK.PAL.bone, 34);
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
      const blocked = this.blocking && facing;
      const counter = !blocked && ((this.punch && !this.punch.resolved) || from.counterWindow > 0);
      const staminaF = 0.55 + 0.45 * Math.min(1, from.stamina / 60);
      let dmg = p.dmg * from.powerMul * staminaF * this.chinMul * (counter ? 1.6 : 1);
      if (this.stagger > 0) dmg *= 1.25;
      from.counterWindow = 0;
      const hx = this.sx - from.dir * 18 * this.fs, hy = this.headY;

      if (blocked) {
        dmg *= p.through;
        this.hp = Math.max(0, this.hp - dmg);
        this.stamina = Math.max(0, this.stamina - p.dmg * 0.45);
        this.knock = from.dir * 0.07;
        this.sqV += 3; from.impact = 0.6; from.impactHand = p.hand;
        BK.game.hitstop(0.03);
        BK.audio.punch('blocked');
        BK.fx.impact(hx - from.dir * 20 * this.fs, hy + 20 * this.fs, from.dir, this.sy, 'blocked', 0.8);
        if (p.through > 0.3) BK.fx.popup('GUARD BROKEN', this.headX, this.headY - 50, BK.PAL.bone, 30);
      } else {
        this.hp = Math.max(0, this.hp - dmg);
        this.damage = Math.min(1, this.damage + dmg / 240);
        this.stun = p.stun * (counter ? 1.3 : 1);
        this.knock = from.dir * (p.power ? 0.26 : 0.14);
        this.hurtW = Math.min(1.3, 0.7 + p.snap * (counter ? 1.8 : 1.2));
        this.hurtKind = p.type === 'upper' ? 'up' : 'head';
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
        if (p.power) from.stats.planded++;
        BK.fx.impact(hx, hy, from.dir, this.sy, 'sweat', p.power ? 1.3 : 0.8);
        if (p.power && (this.damage > 0.3 || counter) && Math.random() < 0.7) BK.fx.blood(hx, hy + 6, from.dir, this.sy, counter ? 1.6 : 1);
        if (counter) {
          from.stats.counters++;
          BK.fx.popup('COUNTER!', this.headX, this.headY - 50, BK.PAL.brass, 48);
          BK.audio.punch('counter');
        } else BK.audio.punch(p.power ? 'power' : 'jab');
        BK.cam.shake = Math.max(BK.cam.shake, counter ? 14 : p.power ? 9 : 4);
        BK.audio.excite(dmg / 40);
        if (this.side === 0) BK.vibrate(p.power ? 45 : 20);
        if (this.hp > 0 && this.hp < 28 && p.power && this.stagger <= 0 && Math.random() < 0.45) {
          this.stagger = 1.1;
          BK.fx.popup('HURT!', this.headX, this.headY - 90, BK.PAL.blood, 40);
          BK.audio.roar(0.3);
        }
      }
      if (this.hp <= 0) BK.game.onKnockdown(this, from);
    }

    knockDown() {
      this.down = true; this.downT = 0; this.lift = 0; this.liftTarget = 0; this.rising = false;
      this.punch = null; this.slip = null; this.blocking = false; this.stun = 0; this.stagger = 0;
      this.kdTotal++; this.kdRound++;
    }
    getUp(hp) {
      this.rising = true;
      this.maxHp = Math.max(45, this.maxHp - 12);
      this.hp = Math.min(this.maxHp, hp);
      this.ghostHp = this.hp;
      this.stamina = Math.max(this.stamina, 55);
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
      if (this.slip) R.mixInto(T, PO.slip, Math.sin(PI * clamp(this.slip.t / this.slip.dur, 0, 1)), U);
      if (this.punch) this.punchPose(T);
      if (this.stagger > 0) {
        R.mix(this.tmp, PO.staggerA, PO.staggerB, (Math.sin(this.t * 4.5) + 1) / 2, U);
        R.mixInto(T, this.tmp, Math.min(1, this.stagger * 3), U);
      }
      if (this.hurtW > 0.01) R.mixInto(T, this.hurtKind === 'up' ? PO.hurtUp : PO.hurt, Math.min(1, this.hurtW), U);
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
    punchPose(T) {
      const R = BK.rig, PO = BK.POSES, U = R.UPPER, p = this.punch;
      const A = PO[p.type + 'A'], X = PO[p.type + 'X'];
      const tA = p.hitAt * 0.5, hold = p.hitAt + (p.power ? 0.075 : 0.045);
      if (p.t < tA) R.mixInto(T, A, BK.easeInOut(p.t / tA), U);
      else if (p.t < p.hitAt) {
        const k = (p.t - tA) / (p.hitAt - tA);
        R.mixInto(T, R.mix(this.tmp, A, X, 1 - Math.pow(1 - k, 3), U), 1, U);
      } else if (p.t < hold) {
        R.mixInto(T, X, 1, U);
        const k = (p.t - p.hitAt) / (hold - p.hitAt);
        T.lean += 3 * Math.sin(k * PI); T.px += 3 * Math.sin(k * PI); // follow-through
      } else R.mixInto(T, X, 1 - BK.easeInOut((p.t - hold) / (p.dur - hold)), U);
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

    draw() {
      const s = this.fs, ly = this.lying;
      ctx.save();
      ctx.translate(this.sx, this.sy);
      ctx.fillStyle = 'rgba(40,25,10,0.3)';
      ctx.beginPath(); ctx.ellipse(-this.dir * 130 * s * ly, 0, (64 + 120 * ly) * s, 14 * s, 0, 0, Math.PI * 2); ctx.fill();
      ctx.scale(s * this.dir, s);
      BK.rig.draw(this.look, this.pose, this.drawState());
      ctx.restore();

      if (this.flash > 0) { // impact ring at the head
        ctx.save();
        ctx.globalAlpha = this.flash / 0.12 * 0.7;
        ctx.strokeStyle = BK.PAL.bone; ctx.lineWidth = 4;
        D.circle(this.headX, this.headY, 40 * this.fs * (1.4 - this.flash / 0.12 * 0.4)); ctx.stroke();
        ctx.restore();
      }
    }

    drawState() {
      return { damage: this.damage, dazed: this.stun > 0 || this.down || this.stagger > 0, blink: this.blinkT < 0, sweat: this.sweat };
    }

    drawPortrait(x, y, scale, flip) {
      ctx.save();
      ctx.translate(x, y - 8 * scale); ctx.scale(scale * (flip ? -1 : 1), scale);
      BK.rig.drawHead(this.look, this.drawState());
      ctx.restore();
    }
  }

  BK.Fighter = Fighter;
})();
