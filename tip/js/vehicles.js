// Tractor Tippin': things that move. Car = a player's truck or race car (arcade handling with sliding),
// Tractor = a sleeping tractor (sleep → startled → tipped over → back on its wheels), Thrasher = the combine
// that wakes when the farm gets too noisy and hunts you down.
// Headings: a = 0 faces +Z; forward is (sin a, cos a); increasing a turns left; left is (cos a, -sin a).
(() => {
  'use strict';
  const TT = window.TT, { clamp, lerp, damp, dampAngle, wrapAngle, smooth } = TT.math;
  const fwdX = a => Math.sin(a), fwdZ = a => Math.cos(a);

  // ================================================================ player vehicle
  class Car {
    constructor(game, h) {
      this.game = game; this.slot = h.slot; this.name = h.name || (h.slot ? 'Player 2' : 'Player 1');
      this.carId = h.car; this.spec = TT.CARS[h.car]; this.remote = !!h.remote; this.view = h.view;
      const sp = game.world.spawn[h.slot] || game.world.spawn[0];
      Object.assign(this, { x: sp.x, z: sp.z, a: sp.a, y: game.world.height(sp.x, sp.z), vx: 0, vz: 0, vf: 0, turnRate: 0 });
      this.inp = { throttle: 0, brake: 0, steer: 0, honk: false, boost: false, drift: false };
      this.boost = this.spec.boostTime; this.boosting = false; this.hornCD = 0;
      this.dents = 0; this.invuln = 0; this.hop = 0; this.hopV = 0; this.stunT = 0; this.spin = 0;
      this.escaped = false; this.caught = false; this.tips = 0; this.pumpkins = 0; this.happyT = 0;
      this.pitch = 0; this.roll = 0; this.accel = 0; this.steerVis = 0; this.surf = 0; this.splashT = 0; this.bumpT = 0;
      const two = game.humans > 1;
      this.rig = new TT.models.CarRig(h.car, { night: game.world.theme.night, halloween: !!game.level.halloween, tag: two ? TT.PLAYER_COLORS[h.slot] : null, shadows: !!game.quality.shadows, headlight: game.world.theme.night ? 1600 : 700 });
      game.world.scene.add(this.rig.root);
      this.net = null; this.mood = 'normal'; this.lookX = 0; this.lookY = 0;
    }
    get active() { return !this.escaped && !this.caught; }
    get speed() { return Math.hypot(this.vx, this.vz); }

    // local physics, fixed step
    step(dt, canDrive) {
      const S = this.spec, w = this.game.world, inp = this.inp;
      this.hornCD -= dt; this.invuln = Math.max(0, this.invuln - dt); this.happyT -= dt; this.bumpT -= dt;
      let throttle = inp.throttle, brake = inp.brake, steer = inp.steer;
      if (!canDrive || this.stunT > 0 || this.caught) { throttle = 0; brake = this.caught ? 1 : 0; steer = this.stunT > 0 ? 0 : steer * 0.3; }
      if (this.escaped) { throttle = 0.6; brake = 0; steer = 0; }
      this.stunT = Math.max(0, this.stunT - dt);
      // horn
      if (inp.honk && canDrive && this.hornCD <= 0 && this.active && this.stunT <= 0) {
        this.hornCD = 0.45;
        this.game.emit('horn', { p: this });
        this.game.honk(this);
      }
      inp.honk = false;
      // boost
      const wantBoost = inp.boost && canDrive && this.active && this.stunT <= 0 && this.boost > 0.05;
      if (wantBoost && !this.boosting) this.game.emit('boost', { p: this });
      this.boosting = wantBoost;
      if (this.boosting) { this.boost = Math.max(0, this.boost - dt); throttle = 1; brake = 0; }
      else this.boost = Math.min(S.boostTime, this.boost + dt * 0.2);
      // ground
      const surf = this.surf = w.surface(this.x, this.z);
      let top = S.top, accel = S.accel, grip = S.grip;
      if (surf === 1) top *= 0.8;
      else if (surf === 2) { top *= 0.5; accel *= 0.6; grip *= 0.45; }
      else if (surf === 3) { top *= 0.35; accel *= 0.5; grip *= 0.6; }
      if (this.boosting) { top *= S.boostMul; accel *= 1.9; }
      // steering: rate grows with speed, flips in reverse
      const fx0 = fwdX(this.a), fz0 = fwdZ(this.a);
      let vf = this.vx * fx0 + this.vz * fz0;
      const sp = Math.abs(vf);
      const auth = clamp(sp / 3, 0, 1) * (1 - 0.32 * clamp(sp / 26, 0, 1));
      let turn = -steer * S.turn * auth * (inp.drift ? 1.4 : 1);
      if (vf < -0.3) turn = -turn;
      this.turnRate = damp(this.turnRate, turn, 14, dt);
      if (this.hop <= 0) this.a = wrapAngle(this.a + this.turnRate * dt);
      this.a += this.spin * dt; this.spin = damp(this.spin, 0, 2.5, dt);
      const fx = fwdX(this.a), fz = fwdZ(this.a), rx = -Math.cos(this.a), rz = Math.sin(this.a);
      vf = this.vx * fx + this.vz * fz;
      let vr = this.vx * rx + this.vz * rz;
      const v0 = vf;
      if (this.hop <= 0) {
        if (throttle > 0) {
          if (vf < -0.5) vf += S.brake * throttle * dt;
          else if (vf < top) vf += accel * throttle * (1 - Math.pow(clamp(vf / top, 0, 1), 2) * 0.85) * dt;
        }
        if (brake > 0) {
          if (vf > 0.5) vf -= S.brake * brake * dt;
          else if (vf > -S.rev) vf -= accel * 0.95 * brake * (1 - Math.pow(clamp(-vf / S.rev, 0, 1), 2) * 0.85) * dt;
        }
        if (!throttle && !brake) { vf *= Math.exp(-0.5 * dt); vf -= Math.sign(vf) * Math.min(Math.abs(vf), 2.2 * dt); }
        if (vf > top * 1.02) vf = damp(vf, top, 1.6, dt);
        if (vf < -S.rev * 1.02) vf = damp(vf, -S.rev, 1.6, dt);
        // lateral grip; the handbrake lets it slide
        const g = inp.drift ? grip * 0.18 : grip, keep = Math.exp(-g * dt);
        vf += Math.sign(vf || 1) * Math.abs(vr) * (1 - keep) * 0.25;
        vr *= keep;
      }
      this.accel = (vf - v0) / dt;
      this.vx = fx * vf + rx * vr; this.vz = fz * vf + rz * vr; this.vf = vf;
      this.x += this.vx * dt; this.z += this.vz * dt;
      // hop after a hit
      if (this.hop > 0 || this.hopV > 0) { this.hopV -= 22 * dt; this.hop = Math.max(0, this.hop + this.hopV * dt); if (this.hop === 0) { this.hopV = 0; this.game.emit('land', { p: this }); } }
      this.bounds();
      // buildings, trees, bales
      const hit = w.collide(this, S.radius);
      if (hit) {
        const vn = this.vx * this.nx + this.vz * this.nz;
        if (vn < 0) { this.vx -= this.nx * vn * 1.35; this.vz -= this.nz * vn * 1.35; }
        if (-vn > 5 && this.bumpT <= 0) { this.bumpT = 0.4; this.game.emit('bump', { p: this, hard: clamp(-vn / 15, 0, 1) }); }
      }
      if (surf === 3 && sp > 3) { this.splashT -= dt; if (this.splashT <= 0) { this.splashT = 0.35; this.game.emit('splash', { p: this }); } }
      this.ground(dt);
    }
    // the fence, and the gate when it's open
    bounds() {
      const w = this.game.world, H = w.H, r = this.spec.radius, g = w.gate;
      const lane = w.gateOpen && Math.abs(this.x - g.x) < g.w / 2 - r * 0.5;
      if (this.z < -H + r && !(lane || this.escaped)) {
        if (this.z > -H - 1) { this.z = -H + r; if (this.vz < 0) this.vz *= -0.3; }
      }
      if (this.z < -H + 0.5 && (lane || this.escaped)) { // in the gateway: keep between the posts
        const lim = g.w / 2 - r;
        if (this.z > -H - 2) { if (this.x < g.x - lim) { this.x = g.x - lim; this.vx = Math.abs(this.vx) * 0.3; } if (this.x > g.x + lim) { this.x = g.x + lim; this.vx = -Math.abs(this.vx) * 0.3; } }
        if (!this.escaped && this.z < -H - 3) this.game.escape(this);
        return;
      }
      if (this.x < -H + r) { this.x = -H + r; if (this.vx < 0) this.vx *= -0.3; }
      if (this.x > H - r) { this.x = H - r; if (this.vx > 0) this.vx *= -0.3; }
      if (this.z > H - r) { this.z = H - r; if (this.vz > 0) this.vz *= -0.3; }
    }
    ground(dt) {
      const w = this.game.world, a = this.a, fx = fwdX(a), fz = fwdZ(a), lx = Math.cos(a), lz = -Math.sin(a);
      const L = this.rig.halfL * 0.8, W = this.rig.halfW;
      const hF = w.height(this.x + fx * L, this.z + fz * L), hB = w.height(this.x - fx * L, this.z - fz * L);
      const hL = w.height(this.x + lx * W, this.z + lz * W), hR = w.height(this.x - lx * W, this.z - lz * W);
      this.y = (hF + hB + hL + hR) / 4 - (this.surf === 3 ? 0.3 : 0);
      const pt = -Math.atan2(hF - hB, L * 2) - clamp(this.accel * 0.006, -0.06, 0.06);
      const rt = Math.atan2(hL - hR, W * 2) - clamp(this.turnRate * Math.abs(this.vf) * 0.0045, -0.09, 0.09);
      this.pitch = damp(this.pitch, pt, 10, dt); this.roll = damp(this.roll, rt, 10, dt);
    }
    // where the other side says this car is (online); smoothed
    netStep(dt) {
      const n = this.net; if (!n || !n.cur) return;
      n.age += dt;
      const s = n.cur, k = Math.min(n.age, 0.25);
      const tx = s[0] + s[3] * k, tz = s[1] + s[4] * k;
      if (Math.hypot(tx - this.x, tz - this.z) > 8) { this.x = tx; this.z = tz; this.a = s[2]; }
      this.x = damp(this.x, tx, 12, dt); this.z = damp(this.z, tz, 12, dt); this.a = dampAngle(this.a, s[2], 12, dt);
      this.vx = s[3]; this.vz = s[4]; this.vf = s[5]; this.inp.steer = s[6]; this.boosting = !!s[7]; this.hop = s[8]; this.stunT = s[9];
      this.surf = this.game.world.surface(this.x, this.z);
      this.ground(dt);
    }
    netState() { const r = v => Math.round(v * 100) / 100; return [r(this.x), r(this.z), r(this.a), r(this.vx), r(this.vz), r(this.vf), r(this.inp.steer), this.boosting ? 1 : 0, r(this.hop), r(this.stunT)]; }
    knock(nx, nz, power) { // hit by Thrasher
      this.vx = nx * power; this.vz = nz * power; this.hopV = 6.5; this.hop = 0.01; this.stunT = 0.9; this.spin = (Math.random() < 0.5 ? -1 : 1) * 7; this.invuln = 2.5;
    }
    // face: scared when Thrasher's close, sneaky near sleeping tractors, dizzy when hit
    think(dt) {
      const g = this.game, th = g.thrasher;
      let mood = 'normal', tx = null, tz = null;
      const dTh = Math.hypot(th.x - this.x, th.z - this.z);
      if (this.caught || this.stunT > 0) mood = 'dizzy';
      else if (th.awake && dTh < 35) { mood = 'scared'; tx = th.x; tz = th.z; }
      else if (this.happyT > 0 || this.escaped) mood = 'happy';
      else {
        let best = null, bd = 18;
        for (const t of g.tractors) if (t.state === 'sleep') { const d = Math.hypot(t.x - this.x, t.z - this.z); if (d < bd) { bd = d; best = t; } }
        if (best) { mood = Math.abs(this.vf) < TT.SNEAK ? 'sneaky' : 'normal'; tx = best.x; tz = best.z; }
        else if (this.boosting) mood = 'happy';
      }
      this.mood = mood;
      let lx = 0, ly = 0;
      if (tx !== null) {
        const dx = tx - this.x, dz = tz - this.z, d = Math.hypot(dx, dz) || 1;
        const l = (dx * Math.cos(this.a) - dz * Math.sin(this.a)) / d, f = (dx * Math.sin(this.a) + dz * Math.cos(this.a)) / d;
        lx = clamp(l * 1.2, -1, 1); ly = f < 0 ? -0.5 : 0.1;
      } else lx = clamp(-this.steerVis * 0.8, -1, 1);
      this.lookX = damp(this.lookX, lx, 8, dt); this.lookY = damp(this.lookY, ly, 8, dt);
    }
    render(dt) {
      const R = this.rig;
      this.steerVis = damp(this.steerVis, this.inp.steer, 10, dt);
      this.think(dt);
      R.root.position.set(this.x, this.y, this.z); R.root.rotation.y = this.a;
      R.update({ speed: this.vf, steer: this.steerVis, pitch: this.pitch, roll: this.roll, hop: this.hop, accel: this.accel, mood: this.mood, lookX: this.lookX, lookY: this.lookY, flash: this.invuln > 0 && this.invuln < 2.3 && !this.caught }, dt);
      R.root.visible = !(this.escaped && this.z < -this.game.world.H - 40);
    }
    dispose() { this.rig.dispose(); }
  }

  // ================================================================ tractors
  const T_STATES = ['sleep', 'wary', 'startle', 'tipping', 'tipped', 'righting'];
  class Tractor {
    constructor(game, spot, i) {
      this.game = game; this.i = i; this.x = spot.x; this.z = spot.z; this.a = spot.a;
      this.state = 'sleep'; this.t = Math.random() * 3; this.by = null; this.ghost = !!game.level.ghosts;
      this.rig = new TT.models.TractorRig(spot.c, { ghost: this.ghost, shadows: !!game.quality.shadows });
      this.rig.root.position.set(this.x, game.world.height(this.x, this.z), this.z); this.rig.root.rotation.y = this.a;
      game.world.scene.add(this.rig.root);
      this.eyes = 0; this.tip = 0; this.spinV = 0; this.wheel = 0; this.ph = Math.random() * 6; this.zT = Math.random() * 3; this.fade = 1;
      this.y = game.world.height(this.x, this.z);
    }
    get code() { return T_STATES.indexOf(this.state); }
    set(state, by) {
      if (state === this.state) return;
      const prev = this.state;
      this.state = state; this.t = 0;
      const g = this.game;
      if (state === 'startle') { this.by = by || null; g.emit('moo', { tr: this }); }
      else if (state === 'wary') g.emit('wary', { tr: this, p: by || null, prev });
      else if (state === 'tipped' && prev === 'tipping') { this.spinV = 9; g.emit('tipLand', { tr: this }); }
      else if (state === 'tipped' && prev !== 'tipping') { this.spinV = 3; this.tip = 1; }
      else if (state === 'righting') g.emit('righting', { tr: this });
    }
    // authority: timers move it along
    update(dt) {
      this.t += dt;
      const g = this.game;
      switch (this.state) {
        case 'wary': if (this.t > 7) this.set('sleep'); break;
        case 'startle': if (this.t > 0.5) this.set('tipping'); break;
        case 'tipping': if (this.t > 0.7) { this.set('tipped'); g.tipped(this); } break;
        case 'tipped': if (this.t > g.recoverTime) this.set('righting'); break;
        case 'righting': if (this.t > 1.3) this.set('sleep'); break;
      }
    }
    // guest: state from the host
    netSet(code, t) {
      const s = T_STATES[code] || 'sleep';
      if (s !== this.state) {
        if (s === 'tipped' && this.state === 'startle') this.set('tipping');
        this.set(s);
      }
      if (Math.abs(this.t - t) > 0.5) this.t = t;
    }
    render(dt, t) {
      const st = this.state;
      let eyes = 0, tip = 0, bob = 0;
      if (st === 'sleep') { eyes = Math.max(0, this.eyes - dt * 1.5); bob = Math.sin(t * 1.7 + this.ph) * 0.025; }
      else if (st === 'wary') { eyes = this.t > 5.5 ? lerp(0.55, 0, (this.t - 5.5) / 1.5) : 0.55; bob = this.t < 0.6 ? Math.abs(Math.sin(this.t * 18)) * 0.12 : 0; }
      else if (st === 'startle') { eyes = 1; bob = Math.sin(Math.PI * clamp(this.t / 0.5, 0, 1)) * 0.65; }
      else if (st === 'tipping') { eyes = 1; const k = clamp(this.t / 0.7, 0, 1); tip = k * k * (1 + 0.15 * Math.sin(k * Math.PI)); bob = (1 - k) * 0.3; }
      else if (st === 'tipped') { eyes = 1; tip = 1 - 0.06 * Math.max(0, Math.sin(this.t * 9)) * Math.exp(-this.t * 1.5); }
      else if (st === 'righting') { const k = clamp(this.t / 1.1, 0, 1); tip = 1 - smooth(k) - 0.1 * Math.sin(k * Math.PI) * (k > 0.8 ? 1 : 0); eyes = 0.8; bob = k > 0.85 ? Math.sin((k - 0.85) * 40) * 0.05 : 0; }
      this.eyes = st === 'sleep' ? eyes : damp(this.eyes, eyes, 14, dt);
      this.tip = st === 'tipping' || st === 'righting' ? tip : damp(this.tip, tip, 12, dt);
      this.spinV = damp(this.spinV, st === 'tipped' ? 0.6 : 0, 0.5, dt);
      this.wheel += this.spinV * dt;
      this.rig.pose(this.eyes, clamp(this.tip, -0.1, 1.05), bob, this.wheel);
      if (this.ghost) { // ghosts fade away while they're down
        const f = st === 'tipped' ? clamp(1 - (this.t - 1) / 1.5, 0.12, 1) : st === 'righting' ? lerp(0.12, 1, clamp(this.t / 1.1, 0, 1)) : 1;
        this.fade = f; this.rig.ghostMat.opacity = 0.55 * f; this.rig.inner.position.y += Math.sin(t * 1.3 + this.ph) * 0.15 + 0.25;
      }
    }
    dispose() { }
  }

  // ================================================================ Thrasher
  const TH_STATES = ['sleep', 'wake', 'chase', 'search', 'home', 'gloat'];
  class Thrasher {
    constructor(game) {
      this.game = game; const h = game.world.home;
      Object.assign(this, { x: h.x, z: h.z, a: h.a, v: 0, state: 'sleep', t: 0, target: null, lostT: 0, lastX: h.x, lastZ: h.z, chargeT: 0, chargeCD: 3, stuckT: 0, revT: 0, mowT: 0, snortT: 2, steer: 0, avoidSide: 1, sx: h.x, sz: h.z });
      this.top = game.mode === 'tipoff' ? 14.5 : game.level.tSpeed;
      this.rig = new TT.models.ThrasherRig({ halloween: !!game.level.halloween, shadows: !!game.quality.shadows, headlight: true });
      game.world.scene.add(this.rig.root);
      this.y = game.world.height(this.x, this.z); this.pitch = 0; this.roll = 0; this.reel = 0; this.mood = 'sleep'; this.lookX = 0; this.lookY = 0; this.net = null;
    }
    get awake() { return this.state !== 'sleep'; }
    get hunting() { return this.state === 'chase' || this.state === 'wake' || this.state === 'gloat'; }
    get code() { return TH_STATES.indexOf(this.state); }
    set(s) {
      if (s === this.state) return;
      const prev = this.state; this.state = s; this.t = 0;
      if (s === 'wake') this.game.emit('roar', { wake: true });
      if ((s === 'search' || s === 'home') && prev === 'chase') this.game.emit('giveup', { home: s === 'home' });
      if (s === 'sleep') this.game.emit('thrasherSleep', {});
    }
    wake() { if (this.state === 'sleep' || this.state === 'home') this.set(this.state === 'home' ? 'chase' : 'wake'); }
    // can Thrasher see player p? Hiding in corn, slowly, works from a distance.
    sees(p) {
      if (!p.active) return false;
      const d = Math.hypot(p.x - this.x, p.z - this.z);
      if (d > 90) return false;
      if (p.surf === 1 && Math.abs(p.vf) < TT.SNEAK + 1 && d > 16) return false;
      return true;
    }
    update(dt) {
      const g = this.game, w = g.world;
      this.t += dt; this.chargeCD -= dt; this.chargeT -= dt;
      let tx = this.x, tz = this.z, want = 0, aim = null;
      const players = g.players.filter(p => p.active);
      const nearest = () => { let b = null, bd = 1e9; for (const p of players) { if (!this.sees(p)) continue; const d = Math.hypot(p.x - this.x, p.z - this.z); if (d < bd) { bd = d; b = p; } } return b; };
      switch (this.state) {
        case 'sleep': this.v = damp(this.v, 0, 4, dt); break;
        case 'wake': this.v = 0; if (this.t > 2.3) this.set('chase'); break;
        case 'gloat': this.v = damp(this.v, 0, 3, dt); if (this.t > 1.6) this.set('chase'); break;
        case 'chase': {
          // stick with who he's after unless someone else is a lot closer
          let p = nearest();
          const cur = this.target && this.sees(this.target) ? this.target : null;
          if (cur && p && p !== cur && Math.hypot(p.x - this.x, p.z - this.z) > Math.hypot(cur.x - this.x, cur.z - this.z) * 0.6) p = cur;
          if (!players.length) { this.set('home'); break; }
          if (p) {
            this.target = p; this.lostT = 0; this.lastX = p.x; this.lastZ = p.z;
            const d = Math.hypot(p.x - this.x, p.z - this.z), lead = Math.min(1.1, d / Math.max(8, this.top));
            tx = p.x + p.vx * lead; tz = p.z + p.vz * lead; want = this.top;
            aim = p;
          } else {
            this.lostT += dt; tx = this.lastX; tz = this.lastZ; want = this.top * 0.7;
            if (this.lostT > (g.mode === 'tipoff' ? 2 : 4)) { this.set(g.mode === 'tipoff' ? 'chase' : 'search'); this.target = players[Math.floor(Math.random() * players.length)]; this.lostT = 0; if (g.mode === 'tipoff') { this.lastX = this.target.x; this.lastZ = this.target.z; } }
          }
          break;
        }
        case 'search': {
          const p = nearest();
          if (p && Math.hypot(p.x - this.x, p.z - this.z) < 45) { this.set('chase'); this.target = p; break; }
          // wander round the last place he saw you
          const a = this.t * 0.6;
          tx = this.lastX + Math.cos(a) * 14; tz = this.lastZ + Math.sin(a) * 14; want = this.top * 0.55;
          if (this.t > 9) { this.set('home'); g.alarm = g.threshold * 0.35; }
          break;
        }
        case 'home': {
          const h = w.home, d = Math.hypot(h.x - this.x, h.z - this.z);
          const p = nearest();
          if (p && Math.hypot(p.x - this.x, p.z - this.z) < 22) { this.set('chase'); this.target = p; break; }
          tx = h.x; tz = h.z; want = d > 10 ? this.top * 0.6 : d * 0.5;
          if (d < 2.5) { this.a = dampAngle(this.a, h.a, 2, dt); this.v = damp(this.v, 0, 3, dt); if (Math.abs(wrapAngle(this.a - h.a)) < 0.1 && this.v < 0.5) this.set('sleep'); want = -1; }
          break;
        }
      }
      if (this.state === 'chase' || this.state === 'search' || (this.state === 'home' && want >= 0)) this.drive(dt, tx, tz, want, aim);
      // move, then push out of buildings and trees; smash bales, pumpkins and corn on the way
      this.x += fwdX(this.a) * this.v * dt; this.z += fwdZ(this.a) * this.v * dt;
      this.collideWorld(dt, true);
      this.ground(dt);
      this.reel = damp(this.reel, this.awake ? 3 + Math.abs(this.v) * 0.25 : 0, 2, dt);
    }
    drive(dt, tx, tz, want, aim) {
      const g = this.game, w = g.world;
      const dx = tx - this.x, dz = tz - this.z, d = Math.hypot(dx, dz);
      let diff = wrapAngle(Math.atan2(dx, dz) - this.a);
      // steer round trees, buildings and tractors in front
      const L = 9 + Math.abs(this.v) * 0.9, fx = fwdX(this.a), fz = fwdZ(this.a), lx = Math.cos(this.a), lz = -Math.sin(this.a);
      let bias = 0;
      const avoid = (ox, oz, r) => {
        const rx = ox - this.x, rz = oz - this.z, f = rx * fx + rz * fz; if (f < 0 || f > L) return;
        const s = rx * lx + rz * lz, m = r + 3.6; if (Math.abs(s) > m) return;
        // dead ahead: keep going round the side he already picked instead of dithering
        const side = Math.abs(s) < 0.8 ? -this.avoidSide : Math.sign(s);
        if (Math.abs(s) >= 0.8) this.avoidSide = -Math.sign(s);
        bias += -side * (1 - f / L) * (1 - Math.abs(s) / m) * 2.4;
      };
      for (const c of w.circles) avoid(c.x, c.z, c.r);
      for (const b of w.boxes) avoid(b.x, b.z, Math.max(b.hw, b.hd));
      for (const t of g.tractors) avoid(t.x, t.z, 1.8);
      // keep off the fence
      const H = w.H - 6, ax = this.x + fx * L * 0.6, az = this.z + fz * L * 0.6;
      if (Math.abs(ax) > H || Math.abs(az) > H) { const toC = wrapAngle(Math.atan2(-this.x, -this.z) - this.a); bias += Math.sign(toC) * 1.4; }
      diff = clamp(diff + bias, -Math.PI, Math.PI);
      // charge when lined up and close
      if (aim && this.state === 'chase' && d < 30 && Math.abs(diff) < 0.22 && this.chargeCD <= 0) { this.chargeT = 2.2; this.chargeCD = g.mode === 'tipoff' ? 5 : 6.5; g.emit('charge', {}); }
      let tgt = want * (Math.abs(diff) > 1.3 ? 0.45 : Math.abs(diff) > 0.6 ? 0.72 : 1);
      if (this.chargeT > 0) tgt = want * 1.38;
      // stuck against something: back up and turn
      if (this.revT > 0) { this.revT -= dt; this.v = damp(this.v, -5, 3, dt); this.a += -Math.sign(diff || 1) * 0.9 * dt; this.steer = -Math.sign(diff); return; }
      // stuck: wants to go but has hardly moved in 1.2 s (wedged on a tree or a building)
      this.stuckT += dt;
      if (this.stuckT > 1.2) {
        const moved = Math.hypot(this.x - this.sx, this.z - this.sz);
        if (tgt > 4 && moved < 4) { this.revT = 1.3; this.avoidSide = -this.avoidSide; }
        this.stuckT = 0; this.sx = this.x; this.sz = this.z;
      }
      const turnMax = 1.25 - clamp(Math.abs(this.v) / 30, 0, 0.5);
      const turn = clamp(diff * 2.2, -1, 1) * turnMax;
      this.steer = damp(this.steer, clamp(diff * 2, -1, 1), 6, dt);
      this.a = wrapAngle(this.a + turn * dt * clamp(Math.abs(this.v) / 3 + 0.25, 0, 1));
      this.v = this.v < tgt ? Math.min(tgt, this.v + 6.5 * dt) : Math.max(tgt, this.v - 10 * dt);
    }
    // body circles: rear, middle, header
    circles() {
      const fx = fwdX(this.a), fz = fwdZ(this.a);
      return [[this.x - fx * 2.6, this.z - fz * 2.6, 2.0], [this.x + fx * 0.4, this.z + fz * 0.4, 2.1], [this.x + fx * 3.5, this.z + fz * 3.5, 3.0]];
    }
    collideWorld(dt, authority) {
      const g = this.game, w = g.world;
      let hit = 0;
      for (const [cx, cz, r] of this.circles()) {
        const o = { x: cx, z: cz };
        const h = w.collide(o, r, true);
        if (h) { this.x += o.x - cx; this.z += o.z - cz; hit = Math.max(hit, h); }
        for (const b of w.bales) if (b.alive && Math.hypot(b.x - cx, b.z - cz) < b.r + r - 0.3) { w.smashBale(b); g.emit('bale', { b }); }
        for (const p of w.pumpkins) if (p.alive && Math.hypot(p.x - cx, p.z - cz) < p.r + r - 0.4) { w.smashPumpkin(p); g.emit('pumpkin', { pk: p, p: null }); }
        for (const t of g.tractors) {
          const dx = cx - t.x, dz = cz - t.z, d = Math.hypot(dx, dz), m = r + TT.TRACTOR_R;
          if (d < m && d > 0.01) { this.x += dx / d * (m - d) * 0.6; this.z += dz / d * (m - d) * 0.6; hit = Math.max(hit, m - d); }
        }
      }
      if (hit > 0.05) this.v *= Math.exp(-3 * dt);
      const H = w.H - 3.2;
      this.x = clamp(this.x, -H, H); this.z = clamp(this.z, -H, H);
      // mow the corn under the header
      if (Math.abs(this.v) > 1) { this.mowT -= dt; if (this.mowT <= 0) { this.mowT = 0.12; const fx = fwdX(this.a), fz = fwdZ(this.a); if (w.mow(this.x + fx * 3.8, this.z + fz * 3.8, 3.4)) g.emit('mow', { x: this.x + fx * 4.2, z: this.z + fz * 4.2 }); } }
    }
    ground(dt) {
      const w = this.game.world, fx = fwdX(this.a), fz = fwdZ(this.a), lx = Math.cos(this.a), lz = -Math.sin(this.a);
      const hF = w.height(this.x + fx * 2.5, this.z + fz * 2.5), hB = w.height(this.x - fx * 3, this.z - fz * 3);
      const hL = w.height(this.x + lx * 1.9, this.z + lz * 1.9), hR = w.height(this.x - lx * 1.9, this.z - lz * 1.9);
      this.y = (hF + hB + hL + hR) / 4;
      this.pitch = damp(this.pitch, -Math.atan2(hF - hB, 5.5), 6, dt); this.roll = damp(this.roll, Math.atan2(hL - hR, 3.8), 6, dt);
    }
    // local box test against a circle at (px, pz) of radius r. Returns push-out {x, z} in world or null.
    contact(px, pz, r) {
      const dx = px - this.x, dz = pz - this.z, s = Math.sin(this.a), c = Math.cos(this.a);
      const lf = dx * s + dz * c, ll = dx * c - dz * s;
      const boxes = [[-4.5, 2.6, 2.15], [2.6, 4.7, 3.45]];
      let best = null;
      for (const [f0, f1, hw] of boxes) {
        if (lf < f0 - r || lf > f1 + r || Math.abs(ll) > hw + r) continue;
        // smallest way out
        const outs = [[f1 + r - lf, 0], [f0 - r - lf, 0], [0, hw + r - ll], [0, -hw - r - ll]];
        let o = outs[0]; for (const q of outs) if (Math.abs(q[0] + q[1]) < Math.abs(o[0] + o[1])) o = q;
        const pf = o[0], pl = o[1];
        const wx = pf * s + pl * c, wz = pf * c - pl * s;
        if (!best || Math.hypot(wx, wz) > Math.hypot(best.x, best.z)) best = { x: wx, z: wz, front: f0 > 0 || lf > 1 };
      }
      return best;
    }
    netState() { const r = v => Math.round(v * 100) / 100; return [r(this.x), r(this.z), r(this.a), r(this.v), this.code, this.chargeT > 0 ? 1 : 0, r(this.steer), this.target ? this.target.slot : -1]; }
    netStep(dt) {
      const n = this.net; if (!n || !n.cur) return;
      n.age += dt;
      const s = n.cur, k = Math.min(n.age, 0.25);
      const tx = s[0] + fwdX(s[2]) * s[3] * k, tz = s[1] + fwdZ(s[2]) * s[3] * k;
      if (Math.hypot(tx - this.x, tz - this.z) > 10) { this.x = tx; this.z = tz; this.a = s[2]; }
      this.x = damp(this.x, tx, 10, dt); this.z = damp(this.z, tz, 10, dt); this.a = dampAngle(this.a, s[2], 10, dt); this.v = s[3];
      const st = TH_STATES[s[4]] || 'sleep';
      if (st !== this.state) this.set(st);
      if (s[5] && this.chargeT <= 0) { this.chargeT = 2.2; this.game.emit('charge', {}); } else if (!s[5]) this.chargeT = 0;
      this.steer = s[6]; this.target = this.game.players.find(p => p.slot === s[7]) || null;
      this.t += dt;
      this.collideWorld(dt, false);
      this.ground(dt);
      this.reel = damp(this.reel, this.awake ? 3 + Math.abs(this.v) * 0.25 : 0, 2, dt);
    }
    render(dt, t) {
      const g = this.game;
      let mood = 'sleep';
      if (this.state === 'wake') mood = this.t < 0.6 ? 'sleepy' : 'furious';
      else if (this.state === 'chase') mood = this.chargeT > 0 ? 'furious' : 'angry';
      else if (this.state === 'gloat') mood = 'sneaky';
      else if (this.state === 'search') mood = 'angry';
      else if (this.state === 'home') mood = 'sleepy';
      this.mood = mood;
      let lx = 0;
      const p = this.target;
      if (p && this.awake) { const dx = p.x - this.x, dz = p.z - this.z, d = Math.hypot(dx, dz) || 1; lx = clamp((dx * Math.cos(this.a) - dz * Math.sin(this.a)) / d * 1.3, -1, 1); }
      else if (this.state === 'search') lx = Math.sin(t * 1.5);
      this.lookX = damp(this.lookX, lx, 6, dt);
      const R = this.rig;
      const bounce = this.state === 'wake' && this.t > 0.5 && this.t < 2 ? Math.abs(Math.sin(this.t * 14)) * 0.15 : this.awake ? Math.abs(Math.sin(t * 9)) * 0.03 * Math.min(1, Math.abs(this.v) / 5) : Math.sin(t * 1.2) * 0.02;
      R.root.position.set(this.x, this.y, this.z); R.root.rotation.y = this.a;
      R.update({ speed: this.v, reel: this.reel, awake: this.awake && !(this.state === 'wake' && this.t < 0.6), mood, lookX: this.lookX, lookY: 0.2, pitch: this.pitch, roll: this.roll, steer: this.steer, bounce, mouth: mood === 'sleep' ? 'sleep' : 'angry' }, dt);
    }
  }

  TT.Car = Car; TT.Tractor = Tractor; TT.Thrasher = Thrasher;
  TT.T_STATES = T_STATES; TT.TH_STATES = TH_STATES;
})();
