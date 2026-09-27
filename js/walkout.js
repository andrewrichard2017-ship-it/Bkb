// Fight-night walkout before round 1.
//   Red corner walks the aisle behind the ring under a spotlight, ducks through the ropes (if there are any) and
//   parades with arms up while the announcer calls him; then the blue corner does the same.
//   The referee calls them to the centre to touch gloves - but one of them might refuse.
// Tap to skip.
(() => {
  'use strict';
  const BK = window.BK, ctx = BK.ctx, D = BK.draw, W = BK.W, H = BK.H, PAL = BK.PAL, F = BK.FONT;
  const { lerp, clamp } = BK;

  // top of the entrance ramp -> down to the corner -> through the ropes -> out into the ring
  const PATH = [[-0.9, -0.72, 0], [0.0, -0.06, 2.8], [0.08, 0.07, 0.9], [0.28, 0.46, 1.4]];
  const ENTRANCE = 6.2, MEET = 1.4, TOUCH = 1.8, BACK = 1.3;

  const WO = BK.walkout = { active: false };

  WO.start = g => {
    const touch = Math.random() < 0.65;
    Object.assign(WO, { active: true, g, t: 0, touch, refuser: touch ? null : (Math.random() < 0.5 ? g.p1 : g.p2),
      said: {}, touched: false });
    for (const [f, side] of [[g.p1, 0], [g.p2, 1]]) {
      f.celebrate = false; f.extraPose = null; f.ropeDuck = 0;
      place(f, side, 0);
    }
    g.ref.u = 0.5; g.ref.z = 0.14; g.ref.mode = 'follow';
    BK.audio.walkoutBeat(8);
  };

  const mirror = (side, u) => (side === 0 ? u : 1 - u);
  // position along the entrance path at time t (seconds into this fighter's entrance)
  function place(f, side, t) {
    let acc = 0;
    for (let i = 1; i < PATH.length; i++) {
      const [u0, z0] = PATH[i - 1], [u1, z1, dur] = PATH[i];
      if (t <= acc + dur || i === PATH.length - 1) {
        const k = BK.easeInOut(clamp((t - acc) / dur, 0, 1));
        f.u = mirror(side, lerp(u0, u1, k)); f.z = lerp(z0, z1, k);
        return i === 2 ? Math.sin(Math.PI * k) : 0; // duck under the ropes on the way in
      }
      acc += dur;
    }
    return 0;
  }
  const pathLen = PATH.slice(1).reduce((s, p) => s + p[2], 0);

  function step(f, dt, moving, faceX) {
    const px = f.sx;
    f.t += dt;
    f.moving = moving ? 1 : 0;
    f.walk += dt * 11 * f.moving;
    if (faceX != null && Math.abs(faceX - f.sx) > 4) f.dir = Math.sign(faceX - f.sx);
    else if (Math.abs(f.sx - px) > 0.2) f.dir = Math.sign(f.sx - px);
    f.animate(dt);
  }

  WO.skip = () => { if (WO.active) finish(); };
  function finish() {
    const g = WO.g;
    WO.active = false;
    for (const f of [g.p1, g.p2]) { f.celebrate = false; f.extraPose = null; f.ropeDuck = 0; }
    g.beginRound();
  }

  WO.update = dt => {
    if (!WO.active) return;
    const g = WO.g, a = g.p1, b = g.p2, ref = g.ref;
    const T = (WO.t += dt);
    const say = (key, fn) => { if (!WO.said[key]) { WO.said[key] = true; fn(); } };

    // entrances
    for (const [f, side] of [[a, 0], [b, 1]]) {
      const t0 = side * ENTRANCE, t = T - t0;
      if (T < 2 * ENTRANCE) {
        if (t < 0) { place(f, side, 0); step(f, dt, false); continue; }
        if (t < ENTRANCE) {
          const duck = place(f, side, t);
          f.ropeDuck = BK.arena.hasRopes() ? duck : 0; // no ropes to duck through in the yard
          f.celebrate = t > pathLen - 1.2; // arms up once he's in the ring
          step(f, dt, t < pathLen, t >= pathLen ? W / 2 : null);
          say('in' + side, () => {
            BK.audio.announce(`In the ${side ? 'blue' : 'red'} corner. ${f.look.name.toLowerCase()}!`);
            BK.audio.roar(0.7);
          });
          continue;
        }
        f.celebrate = false; f.ropeDuck = 0;
        step(f, dt, false, (side ? a : b).sx);
      }
    }
    ref.t += dt; ref.animate(dt);
    if (T < 2 * ENTRANCE) { WO.phase = T < ENTRANCE ? 'red' : 'blue'; return; }

    // referee calls them to the middle
    const m = T - 2 * ENTRANCE;
    WO.phase = 'meet';
    const walk = (f, from, to, k) => { f.u = lerp(from[0], to[0], k); f.z = lerp(from[1], to[1], k); };
    if (m < MEET) {
      const k = BK.easeInOut(m / MEET);
      walk(a, [0.28, 0.46], [0.41, 0.5], k); walk(b, [0.72, 0.46], [0.59, 0.5], k);
      step(a, dt, true, b.sx); step(b, dt, true, a.sx);
      return;
    }
    // touch gloves, or refuse
    const tt = m - MEET;
    if (tt < TOUCH) {
      WO.phase = 'touch';
      const w = tt < 0.35 ? tt / 0.35 : tt < 1.1 ? 1 : Math.max(0, 1 - (tt - 1.1) / 0.5);
      for (const f of [a, b]) {
        f.extraPose = WO.refuser === f ? 'refuse' : 'touch';
        f.extraW = w;
      }
      if (tt > 0.4 && !WO.touched) {
        WO.touched = true;
        if (WO.touch) {
          BK.audio.punch('blocked');
          BK.fx.popup('TOUCH GLOVES', (a.sx + b.sx) / 2, a.headY - 70, PAL.bone, 42);
          BK.audio.roar(0.3);
        } else {
          const r = WO.refuser;
          BK.fx.popup('NO TOUCH!', r.headX, r.headY - 70, '#e2584f', 48);
          BK.audio.roar(0.8);
          r.grunt('effortSmall', true);
        }
      }
      step(a, dt, false, b.sx); step(b, dt, false, a.sx);
      return;
    }
    // back to their marks
    const bk = tt - TOUCH;
    WO.phase = 'back';
    a.extraPose = b.extraPose = null;
    const k = BK.easeInOut(Math.min(1, bk / BACK));
    walk(a, [0.41, 0.5], [0.3, 0.5], k); walk(b, [0.59, 0.5], [0.7, 0.5], k);
    step(a, dt, true, b.sx); step(b, dt, true, a.sx);
    if (bk >= BACK) finish();
  };

  WO.walker = () => {
    const g = WO.g;
    return WO.phase === 'red' ? g.p1 : WO.phase === 'blue' ? g.p2 : null;
  };

  WO.camera = c => {
    const f = WO.walker(), g = WO.g;
    if (f) { c.tx = f.sx; c.ty = f.sy - 170; c.tz = 1.35; }
    else { c.tx = (g.p1.sx + g.p2.sx) / 2; c.ty = g.p1.sy - 150; c.tz = 1.3; }
  };

  // spotlight on the fighter walking out (world space)
  WO.drawWorld = () => {
    const f = WO.walker();
    if (!f) return;
    const x = f.sx, y = f.sy - 120 * f.fs;
    const g = ctx.createRadialGradient(x, y, 90, x, y, 420);
    g.addColorStop(0, 'rgba(8,6,5,0)'); g.addColorStop(1, 'rgba(8,6,5,0.62)');
    ctx.fillStyle = g; ctx.fillRect(-W, -H, W * 3, H * 3);
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    const cone = ctx.createLinearGradient(0, 0, 0, f.sy);
    cone.addColorStop(0, 'rgba(255,240,200,0.18)'); cone.addColorStop(1, 'rgba(255,240,200,0.03)');
    ctx.fillStyle = cone;
    D.poly([[x - 30, 0], [x + 30, 0], [x + 140, f.sy + 10], [x - 140, f.sy + 10]]); ctx.fill();
    ctx.restore();
  };

  // lower-third name card (HUD space)
  WO.drawHud = () => {
    const f = WO.walker();
    if (f) {
      const g = WO.g, t = WO.t - (f === g.p1 ? 0 : ENTRANCE);
      const a = clamp(t * 3, 0, 1) * clamp((ENTRANCE - t) * 3, 0, 1);
      ctx.save(); ctx.globalAlpha = a;
      D.slant(300, 640, 1000, 150, 26); ctx.fillStyle = 'rgba(16,12,11,0.88)'; ctx.fill();
      ctx.fillStyle = f.cornerColor; ctx.fillRect(310, 640, 14, 150);
      D.text(`IN THE ${f.corner}`, 360, 672, F.ui(28), PAL.brass, 'left');
      D.text(f.look.name, 360, 722, F.display(64), PAL.bone, 'left');
      D.text(`${f.look.tape.RECORD}  ·  ${f.look.tape.WEIGHT}  ·  ${f.look.tape.STYLE.toUpperCase()}`, 360, 770, F.ui(24, 500), 'rgba(239,230,210,0.8)', 'left');
      ctx.restore();
    }
    D.text('TAP TO SKIP', W - 60, H - 40, F.ui(22), 'rgba(239,230,210,0.55)', 'right');
  };
})();
