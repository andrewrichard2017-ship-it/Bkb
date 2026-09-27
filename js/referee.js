// The third man in the ring: shadows the action, counts knockdowns, waves fights off.
// Drawn with the same cutout rig as the fighters.
(() => {
  'use strict';
  const BK = window.BK, ctx = BK.ctx;
  const { clamp } = BK;

  class Referee {
    constructor() { this.pose = BK.rig.make(); this.tpose = BK.rig.make(); this.reset(); }
    reset() {
      this.u = 0.5; this.z = 0.08; this.dir = 1; this.t = 0; this.walk = 0; this.moving = 0;
      this.mode = 'follow'; this.victim = null; this.gesture = 0; this.gestureKind = null;
      BK.rig.copy(BK.POSES.refStand, this.pose);
    }
    get sx() { return BK.toScreenX(this.u, this.z); }
    get sy() { return BK.toScreenY(this.z); }
    get fs() { return BK.depthScale(this.z) * 1.34; }

    uAt(x, z) { return (x - BK.ringL(z)) / (BK.ringR(z) - BK.ringL(z)); }

    countGesture() { this.gesture = 0.5; this.gestureKind = 'count'; }
    waveOff() { this.mode = 'wave'; this.gestureKind = 'wave'; }
    box() { this.gesture = 0.8; this.gestureKind = 'box'; }

    update(dt, a, b) {
      this.t += dt;
      this.gesture = Math.max(0, this.gesture - dt);
      let tu, tz;
      if ((this.mode === 'count' || this.mode === 'wave') && this.victim) {
        const v = this.victim;
        tz = clamp(v.z - 0.14, BK.Z_MIN, BK.Z_MAX);
        tu = clamp(this.uAt(v.sx - v.dir * 120 * v.fs, tz), BK.U_MIN, BK.U_MAX);
        this.dir = Math.sign(v.sx - v.dir * 120 * v.fs - this.sx) || this.dir;
      } else {
        const mu = (a.u + b.u) / 2, minZ = Math.min(a.z, b.z);
        tz = minZ - 0.32; tu = mu;
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
      this.animate(dt);
    }

    animate(dt) {
      const R = BK.rig, PO = BK.POSES, T = this.tpose, U = R.UPPER;
      R.copy(PO.refStand, T);
      if (this.mode === 'wave') R.mix(T, PO.refWaveA, PO.refWaveB, (Math.sin(this.t * 13) + 1) / 2);
      else if (this.mode === 'count') {
        // arm rises, then chops down toward the fighter on each count
        const k = this.gestureKind === 'count' && this.gesture > 0 ? Math.sin((1 - this.gesture / 0.5) * Math.PI) : 0;
        R.mix(T, PO.refCountUp, PO.refCountDown, k);
      } else if (this.gestureKind === 'box' && this.gesture > 0) R.mixInto(T, PO.refBox, Math.min(1, this.gesture * 3), U);
      const m = this.moving, ph = this.walk;
      T.ffX += Math.sin(ph) * 16 * m; T.ffY -= Math.max(0, Math.cos(ph)) * 8 * m;
      T.rfX -= Math.sin(ph) * 16 * m; T.rfY -= Math.max(0, -Math.cos(ph)) * 8 * m;
      T.py -= Math.abs(Math.sin(ph)) * 3 * m;
      R.mixInto(this.pose, T, 1 - Math.exp(-dt * 14));
    }

    snapshot() {
      return { look: BK.REF_LOOK, sx: this.sx, sy: this.sy, z: this.z, fs: this.fs, dir: this.dir, shadow: 55,
        pose: BK.rig.copy(this.pose, {}), st: { damage: 0, dazed: false, blink: (this.t % 3.7) < 0.12, sweat: 0 }, flash: 0 };
    }
    draw() { BK.drawFigure(this.snapshot()); }
  }
  BK.Referee = Referee;
})();
