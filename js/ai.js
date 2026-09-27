// CPU opponent. Manages range, throws combinations, reacts to incoming punches,
// takes counters when it slips, and backs off when tired or hurt.
(() => {
  'use strict';
  const BK = window.BK;
  const { clamp } = BK;

  const LEVELS = [
    { react: 0.18, rate: 0.75, block: 0.25, slip: 0.05, combo: 0.15, counter: 0.3 },
    { react: 0.32, rate: 1.0, block: 0.42, slip: 0.12, combo: 0.35, counter: 0.6 },
    { react: 0.5, rate: 1.35, block: 0.55, slip: 0.22, combo: 0.55, counter: 0.9 },
  ];
  const COMBOS = [['jab', 'jab', 'cross'], ['jab', 'cross', 'hook'], ['jab', 'upper'], ['cross', 'hook'], ['jab', 'cross'], ['hook', 'upper']];

  class AI {
    constructor(me, foe) { this.me = me; this.foe = foe; this.reset(); }
    reset() {
      this.lv = LEVELS[BK.settings.difficulty];
      this.cool = 1.2; this.blockT = 0; this.retreatT = 0; this.queue = []; this.sideStep = 0; this.sideT = 0;
      this.seenPunch = null;
    }
    input(dt) {
      const me = this.me, foe = this.foe, lv = this.lv;
      const inp = { mx: 0, my: 0 };
      if (foe.down) return inp;
      this.cool -= dt; this.blockT -= dt; this.retreatT -= dt; this.sideT -= dt;

      const dx = foe.sx - me.sx, dist = Math.abs(dx), dz = foe.z - me.z;
      const hurt = me.hp < 30 || me.stagger > 0, tired = me.stamina < 22;
      const foeHurt = foe.hp < 30 || foe.stagger > 0;
      const next = this.queue[0] || 'jab';
      const want = (next === 'hook' || next === 'upper' ? 118 : 150) * me.fs;

      // depth alignment plus the odd sidestep to work angles
      if (this.sideT <= 0) { this.sideStep = Math.random() < 0.35 ? BK.pick([-1, 1]) * 0.6 : 0; this.sideT = BK.rnd(0.6, 1.4); }
      inp.my = Math.abs(dz) > 0.03 ? clamp(dz * 7, -1, 1) : this.sideStep;

      if ((hurt || tired) && !foeHurt && Math.random() < 0.02) this.retreatT = 1.0;
      if (this.retreatT > 0) inp.mx = -Math.sign(dx) * 0.9;
      else if (dist > want + 25) inp.mx = Math.sign(dx) * (foeHurt ? 1 : 0.85);
      else if (dist < want - 55) inp.mx = -Math.sign(dx) * 0.5;

      // clinch: tie him up when hurt or gassed, and throw short digs once locked
      if (me.clinch) {
        this.cool -= dt; this.blockT -= dt;
        // tie his arms up when he starts digging
        if (foe.punch && foe.punch !== this.seenPunch) { this.seenPunch = foe.punch; if (Math.random() < lv.react + 0.15) this.blockT = BK.rnd(0.5, 0.9); }
        if (this.blockT > 0) { inp.block = true; return inp; }
        if (this.cool <= 0 && Math.random() < 0.5) { inp[BK.pick(['hook', 'upper', 'jab'])] = true; this.cool = BK.rnd(0.35, 0.8); }
        return inp;
      }
      this.clinchCool = (this.clinchCool || 0) - dt;
      if ((hurt || tired) && this.clinchCool <= 0 && !me.grab && dist < 150 * me.fs && Math.abs(dz) < 0.1 && Math.random() < dt * 0.6) {
        inp.clinch = true; this.clinchCool = 3.5; return inp;
      }
      if (foe.grab && foe.grab !== this.seenGrab) {
        this.seenGrab = foe.grab;
        if (Math.random() < lv.react + 0.1) { if (Math.random() < 0.5) inp.slip = true; else this.blockT = 0.5; }
      }
      // defence: read a punch the moment it starts
      const fp = foe.punch;
      if (fp && fp !== this.seenPunch) {
        this.seenPunch = fp;
        if (dist < 230 * me.fs && Math.random() < lv.react + (hurt ? 0.15 : 0)) {
          if (Math.random() < lv.slip / (lv.slip + lv.block)) inp.slip = true;
          else this.blockT = BK.rnd(0.35, 0.6);
        }
      }
      if (this.retreatT > 0 && tired) this.blockT = Math.max(this.blockT, 0.2);
      inp.block = this.blockT > 0;

      // offence
      const inRange = dist < (next === 'hook' || next === 'upper' ? 138 : 178) * me.fs && Math.abs(dz) < 0.1;
      if (me.counterWindow > 0 && inRange && !me.punch && Math.random() < lv.counter) {
        inp[BK.pick(['cross', 'hook'])] = true; inp.block = false; this.blockT = 0; return inp;
      }
      if (!inp.block && !me.punch && inRange) {
        if (this.queue.length) { inp[this.queue.shift()] = true; this.cool = BK.rnd(0.5, 1.1) / lv.rate; }
        else if (this.cool <= 0 && me.stamina > 12) {
          if (Math.random() < lv.combo * (foeHurt ? 1.6 : 1)) this.queue = BK.pick(COMBOS).slice();
          else this.queue = [Math.random() < 0.55 ? 'jab' : BK.pick(['cross', 'hook', 'upper'])];
          inp[this.queue.shift()] = true;
          this.cool = BK.rnd(0.5, 1.2) / lv.rate;
          if (Math.random() < (foe.blockW > 0.5 ? 0.6 : 0.2)) inp.body = true; // go downstairs against a high guard
        }
      }
      if (!inRange && dist > 260 * me.fs) this.queue = [];
      return inp;
    }
  }
  BK.AI = AI;
})();
