// A fighter: movement, punching, defence, damage, knockdowns and how they're drawn.
(() => {
  'use strict';
  const BK = window.BK, ctx = BK.ctx, D = BK.draw, P = BK.PUNCHES;
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
      this.headSnap = 0; this.headSnapV = 0; this.walk = 0; this.moving = 0; this.t = Math.random() * 10;
      this.down = false; this.downT = 0; this.lift = 0; this.liftTarget = 0; this.rising = false;
      this.celebrate = false; this.regenDelay = 0; this.dripT = 0;
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
      this.t += dt;
      this.flash = Math.max(0, this.flash - dt);
      this.counterWindow = Math.max(0, this.counterWindow - dt);
      if (this.ghostHp > this.hp) this.ghostHp = Math.max(this.hp, this.ghostHp - 28 * dt);
      else this.ghostHp = this.hp;
      // head snap spring
      this.headSnapV += (-this.headSnap * 140 - this.headSnapV * 13) * dt;
      this.headSnap += this.headSnapV * dt;

      if (this.damage > 0.65 && !this.down) {
        this.dripT -= dt;
        if (this.dripT <= 0) { this.dripT = BK.rnd(0.6, 1.6); BK.fx.drip(this.headX + this.dir * 10 * this.fs, this.headY + 10 * this.fs, this.sy + 4); }
      }

      if (this.down) {
        this.downT += dt;
        // slide so the body lands inside the ropes rather than through them
        const tail = this.sx - this.dir * 250 * this.fs, w = BK.ringR(this.z) - BK.ringL(this.z);
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
        BK.audio.punch('blocked');
        BK.fx.impact(hx - from.dir * 20 * this.fs, hy + 20 * this.fs, from.dir, this.sy, 'blocked', 0.8);
        if (p.through > 0.3) BK.fx.popup('GUARD BROKEN', this.headX, this.headY - 50, BK.PAL.bone, 30);
      } else {
        this.hp = Math.max(0, this.hp - dmg);
        this.damage = Math.min(1, this.damage + dmg / 240);
        this.stun = p.stun * (counter ? 1.3 : 1);
        this.knock = from.dir * (p.power ? 0.26 : 0.14);
        this.headSnapV -= p.snap * (counter ? 1.5 : 1) * 30;
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

    // ---------------- drawing ----------------
    draw() {
      const s = this.fs;
      ctx.save();
      ctx.translate(this.sx, this.sy);

      const lying = this.down ? BK.easeOut(this.downT / 0.5) * (1 - this.lift) : 0;
      ctx.fillStyle = 'rgba(40,25,10,0.3)';
      ctx.beginPath(); ctx.ellipse(-this.dir * 110 * s * lying, 0, (70 + 110 * lying) * s, 15 * s, 0, 0, Math.PI * 2); ctx.fill();

      ctx.scale(s * this.dir, s);
      if (this.down) {
        // fall backward, bounce once on the canvas
        const bounce = this.downT > 0.5 && this.downT < 0.75 && !this.rising ? Math.sin((this.downT - 0.5) / 0.25 * Math.PI) * 0.06 : 0;
        ctx.translate(-lying * 30, 0);
        ctx.rotate(-(Math.PI / 2 * 0.96) * lying + bounce);
      }

      const moving = Math.min(1, this.moving * 1.5);
      const walkSwing = Math.sin(this.walk) * 16 * moving;
      const idle = this.down ? 0 : Math.sin(this.t * (this.stamina < 30 ? 8 : 5)) * 3;
      const bob = idle - Math.abs(Math.sin(this.walk)) * 4 * moving;
      const ext = this.punchExt(), type = this.punch ? this.punch.type : null;
      let lean = 0, shiftX = 0;
      if (this.stun > 0) lean -= 0.2;
      if (type === 'jab') lean += ext * 0.05;
      if (type === 'cross') lean += ext * 0.13;
      if (type === 'hook') lean += ext * 0.16;
      if (type === 'upper') lean += (this.punch.t < this.punch.hitAt ? -0.06 : 0.1) * ext;
      if (this.slip) { const k = Math.sin(Math.PI * this.slip.t / this.slip.dur); lean -= 0.42 * k; shiftX -= 18 * k; }
      if (this.blocking) lean += 0.05;
      if (this.stagger > 0) lean += Math.sin(this.t * 6) * 0.12 - 0.08;
      if (this.celebrate) lean -= 0.06;

      const hipY = -120;
      this.drawLeg(-8, -30 - walkSwing, false);
      const upper = fn => {
        ctx.save();
        ctx.translate(shiftX, hipY); ctx.rotate(lean); ctx.translate(0, -hipY + bob);
        fn(); ctx.restore();
      };
      upper(() => this.drawArm(false, ext, type));
      this.drawLeg(8, 30 + walkSwing, true);
      upper(() => {
        this.drawTorso();
        ctx.save();
        ctx.translate(4, -214); ctx.rotate(this.headSnap); ctx.translate(-4, 214);
        this.drawHead(this.damage, this.stun > 0 || this.down || this.stagger > 0);
        ctx.restore();
        this.drawArm(true, ext, type);
      });
      ctx.restore();

      if (this.flash > 0) { // impact ring at the head
        ctx.save();
        ctx.globalAlpha = this.flash / 0.12 * 0.7;
        ctx.strokeStyle = BK.PAL.bone; ctx.lineWidth = 4;
        D.circle(this.headX, this.headY, 40 * this.fs * (1.4 - this.flash / 0.12 * 0.4)); ctx.stroke();
        ctx.restore();
      }
    }

    drawLeg(hx, fx, front) {
      const L = this.look, hipY = -120;
      const kx = (hx + fx) / 2 + 10, ky = hipY / 2 + 4;
      D.limb(hx, hipY, kx, ky, fx, -10, 31, 27, front ? L.pants : L.pantsShade);
      if (L.pantsStripe) {
        ctx.strokeStyle = front ? L.pantsStripe : BK.shade('#e8e8e8', 0.75); ctx.lineWidth = 3.5; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(hx + 3, hipY + 6); ctx.lineTo(kx + 3, ky); ctx.lineTo(fx + 2, -16); ctx.stroke();
        // cuffed ankle, like tracksuit bottoms
        ctx.fillStyle = BK.shade(L.pants, 0.8); D.rr(fx - 13, -30, 26, 9, 4); ctx.fill();
      } else {
        // denim seam + a hint of fade on the thigh
        ctx.strokeStyle = 'rgba(255,255,255,0.13)'; ctx.lineWidth = 8;
        ctx.beginPath(); ctx.moveTo(hx + 4, hipY + 10); ctx.lineTo(kx + 2, ky); ctx.stroke();
      }
      // footwear
      ctx.fillStyle = L.bootSole; D.rr(fx - 17, -8, 49, 9, 3); ctx.fill();
      D.rr(fx - 15, -27, 44, 21, 9);
      D.fillOut(front ? L.boots : BK.shade(L.boots, 0.82), 3);
      if (L.desertBoots) {
        ctx.fillStyle = BK.shade(L.boots, 1.12); D.rr(fx - 13, -40, 22, 16, 6); ctx.fill(); ctx.stroke();
        ctx.strokeStyle = BK.shade(L.boots, 0.6); ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(fx + 2, -24); ctx.lineTo(fx + 12, -18); ctx.moveTo(fx + 6, -28); ctx.lineTo(fx + 16, -21); ctx.stroke();
      } else {
        ctx.fillStyle = 'rgba(255,255,255,0.18)'; D.rr(fx + 4, -23, 18, 4, 2); ctx.fill();
      }
    }

    drawTorso() {
      const L = this.look;
      const sh = -208, hip = -120;
      if (L.top === 'tank') {
        // bare shoulders and chest, then the vest
        D.poly([[-31, sh + 2], [31, sh + 2], [27, hip + 4], [-27, hip + 4]]);
        D.fillOut(L.skin);
        ctx.fillStyle = L.skinShade; D.circle(20, sh + 12, 11); ctx.fill(); // front delt
        const g = ctx.createLinearGradient(-28, 0, 28, 0);
        g.addColorStop(0, L.topShade); g.addColorStop(0.45, L.topColor); g.addColorStop(1, L.topColor);
        D.poly([[-24, sh + 1], [-14, sh + 1], [-7, sh + 22], [11, sh + 22], [16, sh + 1], [24, sh + 1],
                [27, sh + 30], [26, hip + 6], [-26, hip + 6], [-27, sh + 30]]);
        D.fillOut(g, 3);
        for (const [x, y, rx, ry, c] of L.stains) {
          ctx.fillStyle = c; ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0.4, 0, Math.PI * 2); ctx.fill();
        }
        // rib-knit texture
        ctx.strokeStyle = 'rgba(0,0,0,0.05)'; ctx.lineWidth = 1;
        for (let x = -20; x <= 22; x += 6) { ctx.beginPath(); ctx.moveTo(x, sh + 26); ctx.lineTo(x, hip + 4); ctx.stroke(); }
        // tracksuit waistband with drawcord
        D.rr(-28, hip - 3, 56, 13, 4); D.fillOut(L.pants, 2.5);
        ctx.fillStyle = '#ddd'; ctx.fillRect(-3, hip + 3, 2, 12); ctx.fillRect(4, hip + 3, 2, 11);
      } else {
        // hoodie: hood bunched behind the neck, boxy body, kangaroo pocket, ribbed hem
        ctx.beginPath(); ctx.ellipse(-18, sh + 2, 22, 14, -0.3, 0, Math.PI * 2); D.fillOut(L.topShade);
        const g = ctx.createLinearGradient(-34, 0, 34, 0);
        g.addColorStop(0, L.topShade); g.addColorStop(0.4, L.topColor); g.addColorStop(1, BK.shade(L.topColor, 1.1));
        D.poly([[-34, sh - 2], [30, sh - 2], [35, hip + 14], [-35, hip + 14]]);
        D.fillOut(g);
        D.rr(-12, hip - 34, 42, 27, 7); D.fillOut(L.topShade, 2.5);
        ctx.fillStyle = BK.shade(L.topColor, 0.72); D.rr(-35, hip + 5, 70, 10, 3); ctx.fill();
        ctx.strokeStyle = 'rgba(0,0,0,0.25)'; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(-6, sh + 8); ctx.quadraticCurveTo(-2, sh + 40, -12, hip - 10); ctx.stroke();
        // drawstrings with aglets
        ctx.strokeStyle = '#e7dcc6'; ctx.lineWidth = 2.5; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(10, sh + 6); ctx.lineTo(12, sh + 38); ctx.moveTo(19, sh + 6); ctx.lineTo(22, sh + 33); ctx.stroke();
        ctx.fillStyle = '#9a8f7c'; ctx.fillRect(10.5, sh + 37, 3, 5); ctx.fillRect(20.5, sh + 32, 3, 5);
        // jeans waist + belt
        ctx.fillStyle = '#2b2118'; ctx.fillRect(-31, hip + 14, 62, 6);
      }
      // neck
      D.rr(-6, sh - 22, 19, 28, 7); D.fillOut(L.skinShade, 2.5);
    }

    drawHead(dmg, dazed) {
      const L = this.look;
      const hx = 6, hy = -240, r = 25;
      // skull + jaw
      ctx.beginPath(); ctx.arc(hx, hy, r, 0, Math.PI * 2);
      ctx.moveTo(hx + 26, hy + 12); ctx.ellipse(hx + 10, hy + 12, 16, 13, 0, 0, Math.PI * 2);
      ctx.strokeStyle = INK; ctx.lineWidth = 7; ctx.stroke();
      const g = ctx.createRadialGradient(hx + 8, hy - 8, 4, hx, hy, 34);
      g.addColorStop(0, BK.shade(L.skin, 1.08)); g.addColorStop(1, L.skinShade);
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(hx, hy, r, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(hx + 10, hy + 12, 16, 13, 0, 0, Math.PI * 2); ctx.fill();
      // nose
      ctx.fillStyle = L.skin;
      ctx.beginPath(); ctx.moveTo(hx + 22, hy - 5); ctx.lineTo(hx + 32, hy + 6); ctx.lineTo(hx + 22, hy + 9); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = INK; ctx.lineWidth = 2; ctx.stroke();
      // ear
      ctx.fillStyle = L.skinShade; ctx.beginPath(); ctx.ellipse(hx - 6, hy + 2, 5.5, 8.5, 0, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = INK; ctx.lineWidth = 2; ctx.stroke();

      // bruising and swelling grow with accumulated damage
      if (dmg > 0.12) {
        ctx.fillStyle = `rgba(92,40,90,${Math.min(0.55, dmg * 0.7)})`;
        ctx.beginPath(); ctx.ellipse(hx + 15, hy + 3, 7 + dmg * 5, 5 + dmg * 4, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = `rgba(170,60,60,${Math.min(0.4, dmg * 0.5)})`;
        ctx.beginPath(); ctx.ellipse(hx + 16, hy + 14, 7, 5, 0, 0, Math.PI * 2); ctx.fill();
      }
      const swollen = dmg > 0.8;
      if (dazed && !swollen) {
        ctx.strokeStyle = INK; ctx.lineWidth = 2.5; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(hx + 12, hy - 5); ctx.lineTo(hx + 18, hy + 1); ctx.moveTo(hx + 18, hy - 5); ctx.lineTo(hx + 12, hy + 1); ctx.stroke();
      } else if (swollen) {
        ctx.fillStyle = `rgba(120,60,110,0.8)`; ctx.beginPath(); ctx.ellipse(hx + 15, hy - 2, 7, 5, 0, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = INK; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(hx + 10, hy - 1); ctx.lineTo(hx + 20, hy - 1); ctx.stroke();
      } else {
        ctx.fillStyle = '#f4eee4'; ctx.beginPath(); ctx.ellipse(hx + 15, hy - 2, 4, 3.4, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#1b1411'; ctx.beginPath(); ctx.ellipse(hx + 17, hy - 2, 2.2, 2.8, 0, 0, Math.PI * 2); ctx.fill();
      }
      // brow
      ctx.strokeStyle = L.bald ? '#5a3b28' : L.hair; ctx.lineWidth = 4; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(hx + 9, hy - 10); ctx.lineTo(hx + 23, hy - 9); ctx.stroke();
      // mouth: gritted, or open when hurt
      if (dazed) { ctx.fillStyle = '#3a1512'; ctx.beginPath(); ctx.ellipse(hx + 21, hy + 16, 4, 3, 0, 0, Math.PI * 2); ctx.fill(); }
      else { ctx.strokeStyle = BK.shade(L.skin, 0.55); ctx.lineWidth = 2.2; ctx.beginPath(); ctx.moveTo(hx + 16, hy + 16); ctx.lineTo(hx + 24, hy + 15); ctx.stroke(); }

      if (L.bald) {
        ctx.fillStyle = 'rgba(255,245,230,0.6)';
        ctx.beginPath(); ctx.ellipse(hx + 1, hy - 15, 11, 5, -0.35, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = 'rgba(60,40,30,0.28)';
        ctx.beginPath(); ctx.ellipse(hx + 10, hy + 15, 15, 9, 0, 0, Math.PI); ctx.fill();
        ctx.fillStyle = 'rgba(60,40,30,0.2)'; // shaved sides
        ctx.beginPath(); ctx.ellipse(hx - 10, hy + 2, 10, 13, 0, 0, Math.PI * 2); ctx.fill();
      } else {
        ctx.fillStyle = L.hair;
        ctx.beginPath(); ctx.arc(hx - 1, hy - 4, r + 1.5, Math.PI * 0.95, Math.PI * 1.97); ctx.fill();
        ctx.beginPath(); ctx.ellipse(hx - 12, hy + 1, 13, 17, 0, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.moveTo(hx + 12, hy - 22); ctx.lineTo(hx + 22, hy - 16); ctx.lineTo(hx + 8, hy - 14); ctx.fill();
        ctx.fillStyle = 'rgba(58,39,24,0.25)';
        ctx.beginPath(); ctx.ellipse(hx + 10, hy + 15, 14, 8, 0, 0, Math.PI); ctx.fill();
      }
      // cut over the eye, then a trickle of blood
      if (dmg > 0.45) {
        ctx.strokeStyle = '#8e111a'; ctx.lineWidth = 3; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(hx + 12, hy - 14); ctx.lineTo(hx + 21, hy - 12); ctx.stroke();
      }
      if (dmg > 0.62) {
        ctx.strokeStyle = 'rgba(160,20,28,0.85)'; ctx.lineWidth = 2.5;
        ctx.beginPath(); ctx.moveTo(hx + 20, hy - 11); ctx.quadraticCurveTo(hx + 24, hy + 2, hx + 21, hy + 12); ctx.stroke();
      }
    }

    // Draw just the head, centred, for HUD portraits.
    drawPortrait(x, y, scale, flip) {
      ctx.save();
      ctx.translate(x, y); ctx.scale(scale * (flip ? -1 : 1), scale); ctx.translate(-8, 234);
      D.rr(-6, -230, 19, 28, 7); D.fillOut(this.look.skinShade, 2.5);
      this.drawHead(this.damage, this.down);
      ctx.restore();
    }

    armPose(front, ext, type) {
      const shX = front ? 14 : -12, shY = -198;
      if (this.down) {
        return front ? { sh: [shX, shY], el: [40, -170], fi: [70, -150] } : { sh: [shX, shY], el: [-10, -160], fi: [20, -130] };
      }
      if (this.celebrate) {
        const w = Math.sin(this.t * 7) * 6;
        return front ? { sh: [shX, shY], el: [38, -250], fi: [30, -305 + w] } : { sh: [shX, shY], el: [-26, -250], fi: [-14, -305 - w] };
      }
      if (this.blocking) {
        return front ? { sh: [shX, shY], el: [40, -186], fi: [40, -252] } : { sh: [shX, shY], el: [28, -182], fi: [32, -230] };
      }
      const tired = this.stamina < 30 ? (30 - this.stamina) / 30 * 26 : 0;
      const bobA = Math.sin(this.t * 5 + (front ? 0 : 1.5)) * 3;
      let fi = front ? [44, -228 + bobA + tired] : [26, -234 + bobA + tired];
      let el = front ? [30, -168 + tired * 0.5] : [8, -166 + tired * 0.5];
      let sh = [shX, shY];
      const mine = type && ((front && P[type].hand === 'front') || (!front && P[type].hand === 'rear'));
      if (mine && ext > 0) {
        const windup = this.punch.t < this.punch.hitAt;
        if (!front) sh = [shX + 16 * ext, shY];
        let tf, te;
        if (type === 'jab' || type === 'cross') {
          tf = [type === 'jab' ? 138 : 150, -222];
          te = [(sh[0] + tf[0]) / 2, (shY + tf[1]) / 2 + 4];
        } else if (type === 'hook') {
          tf = [104, -234]; te = [62, -208];
        } else {
          tf = [92, -262]; te = [58, -196];
        }
        fi = [lerp(fi[0], tf[0], ext), lerp(fi[1], tf[1], ext)];
        el = [lerp(el[0], te[0], ext), lerp(el[1], te[1], ext)];
        if (type === 'upper' && windup) fi[1] += 48 * Math.sin(ext * Math.PI);
        if (type === 'hook' && windup) el[1] -= 14 * Math.sin(ext * Math.PI);
      }
      return { sh, el, fi };
    }

    drawArm(front, ext, type) {
      const L = this.look;
      const { sh, el, fi } = this.armPose(front, ext, type);
      const armCol = L.sleeves ? (front ? L.sleeves : L.topShade) : (front ? L.skin : L.skinShade);
      D.limb(sh[0], sh[1], el[0], el[1], fi[0], fi[1], L.sleeves ? 24 : 19, L.sleeves ? 21 : 16, armCol);
      if (!L.sleeves) { // bicep highlight on bare arms
        ctx.strokeStyle = 'rgba(255,230,200,0.25)'; ctx.lineWidth = 6; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(lerp(sh[0], el[0], 0.25), lerp(sh[1], el[1], 0.25) - 3); ctx.lineTo(lerp(sh[0], el[0], 0.7), lerp(sh[1], el[1], 0.7) - 3); ctx.stroke();
      }
      const [fx, fy] = fi;
      const wx = lerp(el[0], fx, 0.7), wy = lerp(el[1], fy, 0.7);
      if (L.sleeves) { // cuff then bare wrist
        ctx.strokeStyle = front ? L.skin : L.skinShade; ctx.lineWidth = 13; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(wx, wy); ctx.lineTo(fx, fy); ctx.stroke();
        D.circle(wx, wy, 11); D.fillOut(BK.shade(L.topColor, 0.8), 2.5);
      }
      // fist
      D.circle(fx, fy, 13);
      if (L.wraps) {
        D.fillOut(front ? L.wraps : L.wrapShade, 3);
        ctx.strokeStyle = front ? L.wraps : L.wrapShade; ctx.lineWidth = 15; ctx.lineCap = 'butt';
        const ax = lerp(wx, fx, 0.4), ay = lerp(wy, fy, 0.4);
        ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(fx, fy); ctx.stroke();
        ctx.strokeStyle = 'rgba(0,0,0,0.28)'; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(fx - 9, fy - 6); ctx.lineTo(fx + 6, fy + 9); ctx.moveTo(fx - 3, fy - 12); ctx.lineTo(fx + 11, fy + 2); ctx.stroke();
        ctx.fillStyle = 'rgba(255,255,255,0.2)'; D.circle(fx + 3, fy - 5, 4); ctx.fill();
      } else {
        D.fillOut(front ? L.skin : L.skinShade, 3);
        ctx.strokeStyle = 'rgba(0,0,0,0.25)'; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(fx + 7, fy - 9); ctx.lineTo(fx + 7, fy + 9); ctx.stroke();
        if (this.damage > 0.3) { ctx.fillStyle = 'rgba(150,30,30,0.5)'; D.circle(fx + 8, fy - 2, 3.5); ctx.fill(); } // split knuckles
      }
    }
  }

  BK.Fighter = Fighter;
})();
