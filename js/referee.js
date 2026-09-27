// The third man in the ring: shadows the action, counts knockdowns, waves fights off.
(() => {
  'use strict';
  const BK = window.BK, ctx = BK.ctx, D = BK.draw;
  const { clamp, lerp } = BK;

  class Referee {
    constructor() { this.reset(); }
    reset() {
      this.u = 0.5; this.z = 0.08; this.dir = 1; this.t = 0; this.walk = 0; this.moving = 0;
      this.mode = 'follow'; this.victim = null; this.gesture = 0; this.gestureKind = null;
    }
    get sx() { return BK.toScreenX(this.u, this.z); }
    get sy() { return BK.toScreenY(this.z); }
    get fs() { return BK.depthScale(this.z) * 1.32; }

    uAt(x, z) { return (x - BK.ringL(z)) / (BK.ringR(z) - BK.ringL(z)); }

    countGesture() { this.gesture = 0.45; this.gestureKind = 'count'; }
    waveOff() { this.mode = 'wave'; this.gestureKind = 'wave'; }
    box() { this.gesture = 0.8; this.gestureKind = 'box'; }

    update(dt, a, b) {
      this.t += dt;
      this.gesture = Math.max(0, this.gesture - dt);
      let tu, tz;
      if ((this.mode === 'count' || this.mode === 'wave') && this.victim) {
        const v = this.victim;
        tz = clamp(v.z - 0.14, BK.Z_MIN, BK.Z_MAX);
        tu = clamp(this.uAt(v.sx - v.dir * 110 * v.fs, tz), BK.U_MIN, BK.U_MAX);
        this.dir = Math.sign(v.sx - v.dir * 110 * v.fs - this.sx) || this.dir;
      } else {
        const mu = (a.u + b.u) / 2, minZ = Math.min(a.z, b.z);
        tz = minZ - 0.32;
        tu = mu;
        if (tz < BK.Z_MIN + 0.02) { tz = BK.Z_MIN + 0.02; tu = mu + (mu < 0.5 ? 0.3 : -0.3); }
        tu = clamp(tu, BK.U_MIN, BK.U_MAX);
        const midX = (a.sx + b.sx) / 2;
        if (Math.abs(midX - this.sx) > 10) this.dir = Math.sign(midX - this.sx);
      }
      const tx = BK.toScreenX(tu, tz);
      const mx = clamp((tx - this.sx) / 60, -1, 1), mz = clamp((tz - this.z) * 6, -1, 1);
      const w = BK.ringR(this.z) - BK.ringL(this.z);
      const spd = this.mode === 'follow' ? 250 : 380;
      this.u = clamp(this.u + mx * spd * dt / w, BK.U_MIN, BK.U_MAX);
      this.z = clamp(this.z + mz * 0.5 * dt, BK.Z_MIN, BK.Z_MAX);
      this.moving = Math.min(1, Math.hypot(mx, mz));
      this.walk += dt * 10 * this.moving;
    }

    draw() {
      const s = this.fs;
      ctx.save();
      ctx.translate(this.sx, this.sy);
      ctx.fillStyle = 'rgba(40,25,10,0.25)';
      ctx.beginPath(); ctx.ellipse(0, 0, 55 * s, 12 * s, 0, 0, Math.PI * 2); ctx.fill();
      ctx.scale(s * this.dir, s);

      const counting = this.mode === 'count' || this.mode === 'wave';
      const crouch = counting ? 14 : 0;
      const sw = Math.sin(this.walk) * 14 * this.moving;
      const shirt = '#f3f1ec', trousers = '#18181b', skin = '#e6b995';
      // legs
      D.limb(-6, -118 + crouch, 4 - sw / 2, -60 + crouch / 2, -20 - sw, -10, 24, 21, '#101013');
      D.limb(6, -118 + crouch, 16 + sw / 2, -60 + crouch / 2, 22 + sw, -10, 24, 21, trousers);
      for (const fx of [-20 - sw, 22 + sw]) { D.rr(fx - 13, -20, 38, 18, 8); D.fillOut('#0b0b0c', 3); }

      ctx.save();
      ctx.translate(0, crouch);
      // back arm
      const g = this.gesture, kind = this.gestureKind;
      let backEl = [-12, -160], backFi = [-8, -128];
      let frontEl = [26, -160], frontFi = [34, -128];
      if (this.mode === 'wave') {
        const w = Math.sin(this.t * 14) * 18;
        backEl = [-4, -230]; backFi = [20 + w, -270];
        frontEl = [30, -230]; frontFi = [4 - w, -270];
      } else if (counting) {
        // arm pumps down toward the fighter on each count
        const k = kind === 'count' ? Math.sin((1 - g / 0.45) * Math.PI) : 0;
        frontEl = [40, lerp(-200, -170, k)]; frontFi = [lerp(56, 76, k), lerp(-250, -150, k)];
      } else if (kind === 'box' && g > 0) {
        frontEl = [44, -190]; frontFi = [80, -200];
        backEl = [-30, -185]; backFi = [-60, -200];
      }
      D.limb(-12, -198, backEl[0], backEl[1], backFi[0], backFi[1], 16, 13, '#d9d6cf');
      D.circle(backFi[0], backFi[1], 8); D.fillOut('#2d3970', 2.5);
      // torso: white shirt, black bow tie
      D.poly([[-28, -210], [26, -210], [24, -116], [-24, -116]]); D.fillOut(shirt);
      ctx.fillStyle = 'rgba(0,0,0,0.08)'; ctx.fillRect(-28, -205, 12, 90);
      ctx.strokeStyle = 'rgba(0,0,0,0.2)'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(10, -204); ctx.lineTo(8, -118); ctx.stroke();
      ctx.fillStyle = '#111';
      D.poly([[4, -206], [16, -212], [16, -200]]); ctx.fill();
      D.poly([[4, -206], [-6, -212], [-6, -200]]); ctx.fill();
      ctx.fillStyle = trousers; ctx.fillRect(-25, -122, 50, 8);
      // head
      D.rr(-5, -226, 16, 22, 6); D.fillOut(BK.shade(skin, 0.9), 2.5);
      D.circle(4, -244, 22); D.fillOut(skin, 3.5);
      ctx.fillStyle = '#b9b5ae'; // grey hair
      ctx.beginPath(); ctx.arc(2, -248, 23, Math.PI * 0.95, Math.PI * 1.9); ctx.fill();
      ctx.beginPath(); ctx.ellipse(-10, -242, 11, 14, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#1b1411'; D.circle(16, -246, 2.5); ctx.fill();
      ctx.strokeStyle = '#7a756e'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(10, -253); ctx.lineTo(21, -252); ctx.stroke();
      ctx.strokeStyle = '#8a5a44'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(16, -232); ctx.lineTo(22, -233); ctx.stroke();
      // front arm (latex gloves)
      D.limb(14, -198, frontEl[0], frontEl[1], frontFi[0], frontFi[1], 17, 14, shirt);
      D.circle(frontFi[0], frontFi[1], 8.5); D.fillOut('#3b4a8c', 2.5);
      ctx.restore();
      ctx.restore();
    }
  }
  BK.Referee = Referee;
})();
