// Cutout character rig.
//
// A pose is a flat set of numbers (so any two poses can be blended):
//   px, py      pelvis offset from its rest point (0, -120)
//   lean, head  torso and head rotation in degrees (+ = forward / chin down)
//   rot, rotX   whole-body rotation about a ground point (used for falls)
//   sqx, sqy    squash & stretch, scaled from the feet
//   fX,fY,fB,fZ front fist target (torso space), elbow bend (-1..1), fist scale
//   rX,rY,rB,rZ rear fist, same
//   rsh         rear shoulder shift (torso turning into a cross)
//   ffX,ffY     front foot on the ground; rfX,rfY rear foot
// Arms and legs are solved with two-bone IK. The elbow bend is continuous: values
// between -1 and 1 shorten the limb, which reads as the elbow swinging through depth.
//
// Parts are Bezier shapes, cel-shaded against one light (shadow band + highlight rim)
// and outlined, for a bold cartoon look.
(() => {
  'use strict';
  const BK = window.BK, ctx = BK.ctx, INK = BK.PAL.ink;
  const { lerp, clamp } = BK;
  const DEG = Math.PI / 180, PI = Math.PI;

  // ---------------- poses ----------------
  const FIELDS = ['px', 'py', 'lean', 'head', 'rot', 'rotX', 'sqx', 'sqy', 'fX', 'fY', 'fB', 'fZ', 'rX', 'rY', 'rB', 'rZ', 'rsh', 'ffX', 'ffY', 'rfX', 'rfY'];
  const UPPER = ['px', 'py', 'lean', 'head', 'fX', 'fY', 'fB', 'fZ', 'rX', 'rY', 'rB', 'rZ', 'rsh'];
  const GUARD = { px: 0, py: 5, lean: 6, head: 2, rot: 0, rotX: 0, sqx: 1, sqy: 1,
    fX: 56, fY: -98, fB: 0.6, fZ: 1, rX: 36, rY: -104, rB: 0.7, rZ: 1, rsh: 0,
    ffX: 32, ffY: 0, rfX: -34, rfY: 0 };
  const P = BK.POSES = {};
  const def = (name, o, base = GUARD) => (P[name] = Object.assign({}, base, o));

  def('guard', {});
  def('tired', { fX: 52, fY: -76, rX: 32, rY: -80, lean: 12, head: 8, py: 9 });
  def('block', { fX: 40, fY: -124, fB: 0.8, rX: 34, rY: -116, rB: 0.7, head: 12, lean: 12, py: 10, fZ: 1.1, rZ: 1.05 });
  def('slip', { lean: -24, px: -18, py: 16, head: -8, fX: 36, fY: -100, rX: 24, rY: -104 });
  def('hurt', { lean: -18, head: -26, px: -14, py: 6, fX: 42, fY: -82, fB: 0.9, rX: 22, rY: -86 });
  def('hurtUp', { lean: -22, head: -40, px: -12, py: 2, fX: 40, fY: -78, fB: 0.9, rX: 18, rY: -84 });
  def('staggerA', { lean: -14, px: -10, py: 12, head: -16, fX: 40, fY: -64, fB: 0.9, rX: 14, rY: -58, rB: 0.9 });
  def('staggerB', { lean: 10, px: 6, py: 14, head: 14, fX: 46, fY: -70, fB: 0.9, rX: 22, rY: -62, rB: 0.9 });
  // punches: A = anticipation (wind-up), X = extension
  def('jabA', { fX: 40, fY: -96, lean: 2, px: -3 });
  def('jabX', { fX: 108, fY: -112, fB: 0.08, fZ: 1.08, lean: 11, px: 8, head: 5, rX: 34, rY: -108 });
  def('crossA', { rX: 16, rY: -102, rsh: -6, lean: -5, px: -5, head: 0 });
  def('crossX', { rX: 112, rY: -110, rB: 0.06, rZ: 1.1, rsh: 22, lean: 17, px: 16, head: 6, fX: 32, fY: -114, fB: 0.8 });
  def('hookA', { fX: 18, fY: -98, fB: 1, lean: -7, px: -5, head: -2 });
  def('hookX', { fX: 76, fY: -110, fB: -0.85, fZ: 1.35, lean: 15, px: 8, head: 6, rX: 34, rY: -108 });
  def('upperA', { rX: 8, rY: -46, rB: 1, py: 18, lean: -9, px: -6, head: -4 });
  def('upperX', { rX: 74, rY: -118, rB: 1, rZ: 1.25, rsh: 12, py: -4, lean: 8, px: 10, head: -8 });
  // body shot reaction and the clinch
  def('hurtBody', { lean: 24, head: 18, px: -6, py: 14, fX: 40, fY: -44, fB: 1, rX: 26, rY: -38, rB: 1 });
  def('grab', { fX: 100, fY: -96, fB: 0.3, rX: 92, rY: -86, rB: 0.3, lean: 18, px: 10, head: 8 });
  def('clinchHold', { fX: 104, fY: -102, fB: 0.8, rX: 96, rY: -80, rB: 0.8, lean: 24, px: 14, head: 18 });
  def('clinchHeld', { fX: 72, fY: -84, fB: 0.9, rX: 62, rY: -70, rB: 0.9, lean: 18, px: 8, head: 12 });
  // corner stool
  def('sit', { px: -4, py: 58, lean: 4, head: 2, ffX: 56, ffY: 0, rfX: 40, rfY: 0, fX: 54, fY: -22, fB: 1, rX: 42, rY: -18, rB: 1 });
  def('cmStand', { fX: 20, fY: -8, fB: 1, rX: -6, rY: -8, rB: 1, lean: 4, py: 2, ffX: 22, rfX: -22 });
  def('cmHold', { fX: 96, fY: -56, fB: 0.3, rX: -6, rY: -8, rB: 1, lean: 12, py: 4, ffX: 26, rfX: -22 });
  def('cmSlapBack', { fX: -24, fY: -96, fB: 0.6, rX: 20, rY: -40, rB: 1, lean: -6, py: 2, ffX: 26, rfX: -24 });
  def('cmSlapThru', { fX: 118, fY: -62, fB: 0.1, rX: 20, rY: -40, rB: 1, lean: 14, py: 4, ffX: 30, rfX: -24 });
  // KO punch: a looping overhand haymaker, loaded way back
  def('koA', { rX: -46, rY: -126, rB: -0.6, rsh: -10, lean: -16, px: -14, py: 10, head: -6, fX: 40, fY: -112 });
  def('koX', { rX: 120, rY: -100, rB: 0.05, rZ: 1.6, rsh: 26, lean: 26, px: 26, py: 12, head: 10, fX: 22, fY: -96, fB: 1 });
  def('cardHold', { fX: 26, fY: -168, fB: 0.5, rX: 8, rY: -166, rB: 0.5, head: -6, lean: -2, py: 0, ffX: 22, rfX: -22 });
  // falling and getting up
  def('hurtBig', { lean: -32, head: -38, px: -26, py: 4, fX: 30, fY: -48, fB: 1, rX: -8, rY: -56, rB: 1, ffX: 44, rfX: -62 });
  def('lying', { rot: -86, rotX: -36, lean: -2, head: -14, px: -2, py: -20, fX: 40, fY: -40, fB: 1, rX: -6, rY: -30, rB: 1, ffX: 16, rfX: -8, ffY: 0, rfY: 0 });
  def('prop', { rot: -52, rotX: -30, lean: 16, head: 14, py: 18, fX: 50, fY: -40, fB: 1, rX: 34, rY: -24, rB: 1, ffX: 36, rfX: -20 });
  def('kneel', { rot: 0, py: 54, px: -2, lean: 24, head: 14, fX: 44, fY: -60, fB: 0.9, rX: 30, rY: -52, ffX: 36, ffY: 0, rfX: -58, rfY: 0 });
  def('victoryA', { fX: 30, fY: -172, fB: 0.2, rX: 6, rY: -170, rB: 0.2, head: -12, lean: -6, py: 0 });
  def('victoryB', { fX: 36, fY: -150, fB: 0.8, rX: 12, rY: -152, rB: 0.8, head: -6, lean: -2, py: 6 });
  // referee
  def('refStand', { fX: 22, fY: -6, fB: 1, rX: -6, rY: -6, rB: 1, lean: 2, head: 0, py: 2, ffX: 20, rfX: -20 });
  def('refCountUp', { fX: 44, fY: -150, fB: 0.7, rX: -10, rY: -20, lean: 22, py: 22, head: 10, ffX: 34, rfX: -34 });
  def('refCountDown', { fX: 88, fY: -30, fB: 0.3, rX: -10, rY: -20, lean: 30, py: 24, head: 16, ffX: 34, rfX: -34 });
  def('refWaveA', { fX: 70, fY: -150, fB: 0.3, rX: -10, rY: -150, rB: 0.3, head: -4, py: 4, ffX: 26, rfX: -26 });
  def('refWaveB', { fX: -8, fY: -150, fB: 0.3, rX: 60, rY: -150, rB: 0.3, head: -4, py: 4, ffX: 26, rfX: -26 });
  def('refBox', { fX: 96, fY: -80, fB: 0.2, rX: -70, rY: -80, rB: 0.2, lean: 4, py: 4, ffX: 26, rfX: -26 });

  const R = BK.rig = { FIELDS, UPPER };
  R.make = () => Object.assign({}, GUARD);
  R.copy = (src, dst) => { for (const k of FIELDS) dst[k] = src[k]; return dst; };
  R.mix = (dst, a, b, t, fields = FIELDS) => { for (const k of fields) dst[k] = a[k] + (b[k] - a[k]) * t; return dst; };
  R.mixInto = (dst, b, t, fields = FIELDS) => { if (t <= 0) return dst; for (const k of fields) dst[k] += (b[k] - dst[k]) * t; return dst; };

  // ---------------- IK ----------------
  const UA = 46, FA = 44, TH = 67, SH = 63;
  function arm(sx, sy, tx, ty, bend) {
    let dx = tx - sx, dy = ty - sy, d = Math.hypot(dx, dy) || 1;
    const max = UA + FA - 0.5;
    if (d > max) { tx = sx + dx / d * max; ty = sy + dy / d * max; dx = tx - sx; dy = ty - sy; d = max; }
    const ux = dx / d, uy = dy / d;
    const x = (UA * UA - FA * FA + d * d) / (2 * d), h = Math.sqrt(Math.max(0, UA * UA - x * x));
    return { ex: sx + ux * x - uy * h * bend, ey: sy + uy * x + ux * h * bend, fx: tx, fy: ty };
  }
  function leg(hx, hy, fx, fy) {
    let dx = fx - hx, dy = fy - hy, d = Math.hypot(dx, dy) || 1;
    const max = TH + SH - 0.5;
    if (d > max) { fx = hx + dx / d * max; fy = hy + dy / d * max; dx = fx - hx; dy = fy - hy; d = max; }
    const ux = dx / d, uy = dy / d;
    const x = (TH * TH - SH * SH + d * d) / (2 * d), h = Math.sqrt(Math.max(0, TH * TH - x * x));
    return { kx: hx + ux * x + uy * h, ky: hy + uy * x - ux * h, ax: fx, ay: fy }; // knee always forward
  }

  // ---------------- cel shading ----------------
  const LIGHT = [-0.28, -1];
  function lightLocal() {
    const m = ctx.getTransform(), det = m.a * m.d - m.b * m.c || 1;
    let x = (m.d * LIGHT[0] - m.c * LIGHT[1]) / det, y = (-m.b * LIGHT[0] + m.a * LIGHT[1]) / det;
    const n = Math.hypot(x, y) || 1; return [x / n, y / n];
  }
  const toneCache = {};
  const tones = base => toneCache[base] || (toneCache[base] = { base, shade: BK.shade(base, 0.74), hi: BK.shade(base, 1.2) });
  // path: function that builds the path in the current transform
  function cel(path, color, opt = {}) {
    const t = tones(color), [lx, ly] = lightLocal();
    const so = opt.shadow ?? 7, ho = opt.rim ?? 2.4;
    ctx.save();
    path(); ctx.clip();
    ctx.fillStyle = t.shade; ctx.fillRect(-600, -600, 1200, 1200);
    ctx.translate(lx * so, ly * so); path(); ctx.clip(); ctx.translate(-lx * so, -ly * so);
    ctx.fillStyle = opt.noRim ? t.base : t.hi; ctx.fillRect(-600, -600, 1200, 1200);
    if (!opt.noRim) { ctx.translate(-lx * ho, -ly * ho); path(); ctx.fillStyle = t.base; ctx.fill(); }
    ctx.restore();
    if (opt.detail) { ctx.save(); path(); ctx.clip(); opt.detail(); ctx.restore(); }
    if (opt.outline !== 0) { path(); ctx.strokeStyle = INK; ctx.lineWidth = opt.outline || 4; ctx.lineJoin = 'round'; ctx.stroke(); }
  }
  R.cel = cel;

  // tapered limb along +x with muscle bulges on either side
  const limbPath = (len, w0, w1, bA = 0, bB = 0, at = 0.4) => () => {
    const a = w0 / 2, b = w1 / 2;
    ctx.beginPath();
    ctx.moveTo(0, -a);
    ctx.bezierCurveTo(len * at, -a - bA, len * Math.min(0.95, at + 0.3), -b - bA * 0.3, len, -b);
    ctx.arc(len, 0, b, -PI / 2, PI / 2);
    ctx.bezierCurveTo(len * Math.min(0.95, at + 0.3), b + bB * 0.3, len * at, a + bB, 0, a);
    ctx.arc(0, 0, a, PI / 2, PI * 1.5);
    ctx.closePath();
  };
  function bone(ax, ay, bx, by, fn) {
    const len = Math.hypot(bx - ax, by - ay);
    ctx.save(); ctx.translate(ax, ay); ctx.rotate(Math.atan2(by - ay, bx - ax)); fn(len); ctx.restore();
  }
  const line = (x0, y0, x1, y1, col, w) => { ctx.strokeStyle = col; ctx.lineWidth = w; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke(); };
  const ellipse = (x, y, rx, ry, r = 0) => () => { ctx.beginPath(); ctx.ellipse(x, y, rx, ry, r, 0, PI * 2); };
  const rrect = (x, y, w, h, r) => () => BK.draw.rr(x, y, w, h, r);

  // Wet highlights on skin; strength grows with sweat.
  function sheen(st, spots) {
    if (!st.sweat || st.sweat < 0.12) return;
    ctx.fillStyle = `rgba(255,252,240,${Math.min(0.55, st.sweat * 0.6)})`;
    for (const [x, y, rx, ry, r] of spots) { ctx.beginPath(); ctx.ellipse(x, y, rx, ry, r || 0, 0, PI * 2); ctx.fill(); }
  }
  // Blood soaking into clothes, in a fixed spatter pattern so it builds up rather than flickering.
  const SPATTER = [[8, -60, 4, 3], [14, -44, 3, 5], [-2, -52, 5, 3], [20, -24, 3, 3], [4, -34, 2.5, 4], [-10, -64, 3, 2.5],
    [12, -72, 2.5, 2], [-6, -20, 4, 3], [24, -50, 2, 3], [0, -8, 3, 2], [16, -12, 3.5, 2.5], [-14, -40, 2.5, 2.5]];
  function spatter(st, color) {
    const n = Math.floor((st.blood || 0) * SPATTER.length);
    ctx.fillStyle = color;
    for (let i = 0; i < n; i++) { const [x, y, rx, ry] = SPATTER[i]; ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0.6, 0, PI * 2); ctx.fill(); }
  }

  // ---------------- parts ----------------
  function drawLeg(L, hip, ik, front) {
    const pants = front ? L.pants : L.pantsShade;
    bone(hip[0], hip[1], ik.kx, ik.ky, len => {
      cel(limbPath(len + 4, 36, 28, 5, 4, 0.35), pants, {
        detail: () => {
          if (L.legs === 'track') { line(4, -4, len, -4, L.pantsStripe, 3); line(4, 2, len, 2, L.pantsStripe, 3); }
          if (L.legs === 'jeans') { ctx.fillStyle = 'rgba(255,255,255,0.14)'; ctx.beginPath(); ctx.ellipse(len * 0.72, -3, 14, 7, 0, 0, PI * 2); ctx.fill(); }
          if (L.legs === 'trousers') line(0, -1, len, -1, 'rgba(255,255,255,0.12)', 2);
        },
      });
    });
    bone(ik.kx, ik.ky, ik.ax, ik.ay, len => {
      cel(limbPath(len, 28, 23, 2, 4, 0.3), pants, {
        detail: () => {
          if (L.legs === 'track') { line(0, -4, len, -4, L.pantsStripe, 3); line(0, 2, len, 2, L.pantsStripe, 3); }
          ctx.strokeStyle = 'rgba(0,0,0,0.22)'; ctx.lineWidth = 2; // fabric folds behind the knee
          ctx.beginPath(); ctx.moveTo(6, 9); ctx.quadraticCurveTo(12, 3, 18, 10); ctx.stroke();
        },
      });
      if (L.legs === 'track') { // elastic cuff gathered at the ankle
        cel(rrect(len - 12, -13, 14, 26, 5), BK.shade(L.pants, 0.85), { outline: 3, detail: () => { for (let i = 0; i < 3; i++) line(len - 9 + i * 4, -12, len - 9 + i * 4, 12, 'rgba(0,0,0,0.25)', 1.5); } });
      } else if (L.legs === 'jeans') {
        cel(rrect(len - 8, -14, 10, 28, 3), BK.shade(L.pants, 0.9), { outline: 3 });
      }
    });
    drawShoe(L, ik.ax, ik.ay, front);
  }

  function drawShoe(L, x, y, front) {
    ctx.save(); ctx.translate(x, y);
    if (L.shoes === 'desert') {
      // crepe sole, suede upper, two eyelets
      cel(rrect(-17, 6, 50, 9, 3), '#d9c09a', { outline: 3, noRim: true });
      cel(() => {
        ctx.beginPath(); ctx.moveTo(-15, 8); ctx.lineTo(-14, -12); ctx.quadraticCurveTo(-4, -18, 8, -12);
        ctx.quadraticCurveTo(20, -6, 30, -1); ctx.quadraticCurveTo(35, 3, 32, 8); ctx.closePath();
      }, front ? L.boots : BK.shade(L.boots, 0.85), { detail: () => {
        ctx.fillStyle = 'rgba(90,60,30,0.18)'; for (let i = 0; i < 12; i++) ctx.fillRect(-12 + (i * 37) % 40, -10 + (i * 13) % 16, 2, 2); // suede nap
        line(-2, -10, 22, 1, 'rgba(70,45,20,0.5)', 2);
      } });
      ctx.fillStyle = '#3b2a1a'; BK.draw.circle(6, -10, 1.8); ctx.fill(); BK.draw.circle(12, -7, 1.8); ctx.fill();
      line(6, -10, 13, -13, '#5b4028', 1.8);
    } else {
      cel(rrect(-15, 5, 47, 8, 3), '#0a0a0b', { outline: 3, noRim: true });
      cel(() => {
        ctx.beginPath(); ctx.moveTo(-14, 7); ctx.lineTo(-13, -8); ctx.quadraticCurveTo(0, -12, 12, -7);
        ctx.quadraticCurveTo(26, -3, 31, 2); ctx.quadraticCurveTo(33, 6, 30, 7); ctx.closePath();
      }, front ? L.boots : BK.shade(L.boots, 0.8), { detail: () => line(6, -6, 24, -1, 'rgba(255,255,255,0.35)', 2.5) });
    }
    ctx.restore();
  }

  function drawPelvis(L, x, y) {
    ctx.save(); ctx.translate(x, y);
    cel(() => {
      ctx.beginPath(); ctx.moveTo(-27, -14); ctx.lineTo(27, -14); ctx.quadraticCurveTo(31, 6, 25, 20);
      ctx.lineTo(-25, 20); ctx.quadraticCurveTo(-31, 6, -27, -14); ctx.closePath();
    }, L.pants, { detail: () => {
      if (L.legs === 'track') { line(-2, -12, 0, 18, 'rgba(0,0,0,0.2)', 2); }
      if (L.legs === 'jeans') { line(8, -6, 12, 14, 'rgba(255,220,150,0.35)', 1.5); } // fly stitching
    } });
    if (L.top !== 'hoodie') {
      const band = L.legs === 'track' ? BK.shade(L.pants, 0.8) : '#2b2118';
      cel(rrect(-28, -17, 56, 11, 4), band, { outline: 3, noRim: true });
      if (L.legs === 'track') { line(4, -8, 5, 6, '#e8e8e8', 2); line(10, -8, 12, 5, '#e8e8e8', 2); }
      else { cel(rrect(14, -17, 10, 11, 2), '#b9a06a', { outline: 2, noRim: true }); }
    }
    ctx.restore();
  }

  function drawTorso(L, st) {
    if (L.top === 'tank') {
      // bare skin: V-taper back, pec, deltoid
      cel(() => {
        ctx.beginPath(); ctx.moveTo(-23, 2);
        ctx.bezierCurveTo(-31, -20, -33, -52, -27, -74);
        ctx.quadraticCurveTo(-18, -88, -2, -89); ctx.lineTo(14, -89);
        ctx.quadraticCurveTo(28, -86, 30, -70);
        ctx.bezierCurveTo(36, -58, 34, -42, 26, -36);
        ctx.quadraticCurveTo(23, -18, 22, 2); ctx.closePath();
      }, L.skin, { detail: () => sheen(st, [[24, -74, 4, 7, 0.4], [-22, -70, 3, 6]]) });
      // vest: deep armholes, thin straps, scooped neck
      cel(() => {
        ctx.beginPath(); ctx.moveTo(-25, 4);
        ctx.bezierCurveTo(-31, -24, -31, -50, -20, -66);
        ctx.lineTo(-13, -88); ctx.lineTo(-5, -88);
        ctx.quadraticCurveTo(0, -72, 12, -70);
        ctx.lineTo(16, -86); ctx.lineTo(23, -84);
        ctx.quadraticCurveTo(20, -66, 29, -52);
        ctx.bezierCurveTo(33, -38, 25, -20, 25, 4);
        ctx.closePath();
      }, L.topColor, { detail: () => {
        ctx.strokeStyle = 'rgba(0,0,0,0.06)'; ctx.lineWidth = 1.2;
        for (let x = -28; x <= 30; x += 5) { ctx.beginPath(); ctx.moveTo(x, -90); ctx.lineTo(x + 2, 6); ctx.stroke(); }
        for (const [x, y, rx, ry, c] of L.stains) { ctx.fillStyle = c; ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0.4, 0, PI * 2); ctx.fill(); }
        ctx.strokeStyle = 'rgba(0,0,0,0.12)'; ctx.lineWidth = 2; // sag folds
        ctx.beginPath(); ctx.moveTo(-18, -10); ctx.quadraticCurveTo(0, -4, 20, -12); ctx.stroke();
        if (st.sweat > 0.3) { ctx.fillStyle = `rgba(160,150,120,${(st.sweat - 0.3) * 0.5})`; ctx.beginPath(); ctx.ellipse(4, -48, 16, 22, 0, 0, PI * 2); ctx.fill(); }
        spatter(st, 'rgba(150,18,26,0.8)');
      } });
    } else if (L.top === 'hoodie') {
      cel(ellipse(-20, -84, 23, 15, -0.3), L.topShade);
      cel(() => {
        ctx.beginPath(); ctx.moveTo(-33, 16); ctx.lineTo(-35, -48);
        ctx.quadraticCurveTo(-35, -84, -12, -89); ctx.lineTo(14, -89);
        ctx.quadraticCurveTo(33, -85, 34, -62); ctx.lineTo(37, 16); ctx.closePath();
      }, L.topColor, { detail: () => {
        ctx.fillStyle = BK.shade(L.topColor, 0.7); ctx.fillRect(-40, 5, 80, 12); // ribbed hem
        ctx.strokeStyle = 'rgba(0,0,0,0.2)'; ctx.lineWidth = 1;
        for (let x = -34; x < 38; x += 4) { ctx.beginPath(); ctx.moveTo(x, 6); ctx.lineTo(x, 16); ctx.stroke(); }
        ctx.strokeStyle = 'rgba(0,0,0,0.22)'; ctx.lineWidth = 2.2; // folds
        ctx.beginPath(); ctx.moveTo(-26, -8); ctx.quadraticCurveTo(-8, -2, 4, -14); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(-28, -48); ctx.quadraticCurveTo(-14, -38, -2, -46); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(-6, -84); ctx.quadraticCurveTo(-4, -70, -12, -60); ctx.stroke();
        if (st.sweat > 0.25) { // sweat soaking through
          ctx.fillStyle = `rgba(30,18,10,${(st.sweat - 0.25) * 0.45})`;
          ctx.beginPath(); ctx.ellipse(8, -56, 18, 16, 0, 0, PI * 2); ctx.fill();
          ctx.beginPath(); ctx.ellipse(-24, -60, 8, 12, 0, 0, PI * 2); ctx.fill();
        }
        spatter(st, 'rgba(70,10,12,0.75)');
      } });
      cel(() => { ctx.beginPath(); ctx.moveTo(2, -30); ctx.lineTo(34, -30); ctx.lineTo(36, 2); ctx.lineTo(4, 2); ctx.quadraticCurveTo(10, -14, 2, -30); ctx.closePath(); },
        BK.shade(L.topColor, 0.9), { outline: 3 });
      line(12, -86, 14, -54, '#e7dcc6', 2.8); line(21, -86, 24, -58, '#e7dcc6', 2.8);
      ctx.fillStyle = '#9a8f7c'; ctx.fillRect(12.5, -55, 3.5, 6); ctx.fillRect(22.5, -59, 3.5, 6);
    } else {
      // referee: white shirt tucked into black trousers, bow tie
      cel(() => {
        ctx.beginPath(); ctx.moveTo(-26, 4); ctx.lineTo(-30, -60); ctx.quadraticCurveTo(-28, -86, -8, -89);
        ctx.lineTo(14, -89); ctx.quadraticCurveTo(30, -85, 30, -64); ctx.lineTo(26, 4); ctx.closePath();
      }, L.topColor, { detail: () => {
        if (L.bowtie === false) return;
        line(14, -86, 12, 2, 'rgba(0,0,0,0.18)', 1.5);
        ctx.fillStyle = 'rgba(0,0,0,0.25)'; for (let y = -76; y < 0; y += 16) { BK.draw.circle(16, y, 1.8); ctx.fill(); }
        ctx.strokeStyle = 'rgba(0,0,0,0.12)'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(-20, -6); ctx.quadraticCurveTo(0, -12, 22, -4); ctx.stroke();
      } });
      if (L.bowtie !== false) {
        ctx.fillStyle = '#111'; ctx.beginPath(); ctx.moveTo(10, -86); ctx.lineTo(22, -92); ctx.lineTo(22, -80); ctx.closePath(); ctx.fill();
        ctx.beginPath(); ctx.moveTo(10, -86); ctx.lineTo(-1, -92); ctx.lineTo(-1, -80); ctx.closePath(); ctx.fill();
      }
      if (L.print) { ctx.save(); ctx.translate(8, -50); ctx.rotate(-0.05); const m = ctx.getTransform(); if (m.a * m.d - m.b * m.c < 0) ctx.scale(-1, 1); BK.draw.text(L.print, 0, 0, BK.FONT.display(15), '#d9a441'); ctx.restore(); }
    }
  }

  function drawHead(L, st) {
    // neck
    cel(() => { ctx.beginPath(); ctx.moveTo(-9, 8); ctx.lineTo(15, 8); ctx.lineTo(13, -18); ctx.lineTo(-6, -18); ctx.closePath(); }, L.skinShade, { outline: 3.5 });
    // skull + square jaw in one silhouette
    const head = () => {
      ctx.beginPath(); ctx.moveTo(-17, -10);
      ctx.bezierCurveTo(-29, -24, -28, -56, -4, -60);
      ctx.bezierCurveTo(16, -63, 29, -52, 29, -40);
      ctx.lineTo(30, -32); ctx.lineTo(29, -16);
      ctx.quadraticCurveTo(32, -6, 28, 0);
      ctx.quadraticCurveTo(24, 5, 12, 4);
      ctx.quadraticCurveTo(-2, 2, -17, -10); ctx.closePath();
    };
    cel(head, L.skin, { detail: () => {
      // stubble / beard shadow along the jaw
      ctx.fillStyle = L.head === 'bald' ? 'rgba(50,34,24,0.34)' : 'rgba(58,39,24,0.15)';
      ctx.beginPath(); ctx.moveTo(-10, -12); ctx.quadraticCurveTo(10, -18, 32, -12); ctx.lineTo(32, 8); ctx.lineTo(-10, 8); ctx.closePath(); ctx.fill();
      // bruising
      const d = st.damage;
      if (d > 0.12) {
        ctx.fillStyle = `rgba(92,40,90,${Math.min(0.55, d * 0.7)})`; ctx.beginPath(); ctx.ellipse(19, -30, 8 + d * 5, 6 + d * 4, 0, 0, PI * 2); ctx.fill();
        ctx.fillStyle = `rgba(170,60,60,${Math.min(0.42, d * 0.5)})`; ctx.beginPath(); ctx.ellipse(20, -18, 8, 5, 0, 0, PI * 2); ctx.fill();
      }
      sheen(st, [[22, -48, 4, 2.5, -0.2], [26, -24, 2, 3], [10, -8, 5, 2]]);
      if (L.head === 'bald') { // dome shine
        ctx.fillStyle = 'rgba(255,248,235,0.6)'; ctx.beginPath(); ctx.ellipse(4, -52, 12, 5, -0.25, 0, PI * 2); ctx.fill();
        ctx.fillStyle = 'rgba(255,248,235,0.35)'; ctx.beginPath(); ctx.ellipse(18, -48, 4, 2.5, -0.4, 0, PI * 2); ctx.fill();
      }
    } });
    // ear (cauliflower on the old pro)
    cel(ellipse(-5, -28, 6.5, 9.5), L.skinShade, { outline: 3, noRim: true });
    if (L.head === 'bald') { cel(ellipse(-7, -32, 3.5, 3.5), L.skinShade, { outline: 2, noRim: true }); }
    // nose
    cel(() => {
      ctx.beginPath(); ctx.moveTo(27, -36);
      if (L.head === 'bald') { ctx.quadraticCurveTo(34, -30, 38, -22); ctx.quadraticCurveTo(36, -17, 29, -18); }
      else { ctx.lineTo(37, -22); ctx.quadraticCurveTo(35, -18, 29, -19); }
      ctx.closePath();
    }, L.skin, { outline: 3, noRim: true });
    // eye
    const swollen = st.damage > 0.8, blink = st.blink;
    if (st.dazed && !swollen) {
      line(15, -37, 22, -30, INK, 3); line(22, -37, 15, -30, INK, 3);
    } else if (swollen || blink) {
      if (swollen) { ctx.fillStyle = 'rgba(120,60,110,0.85)'; ctx.beginPath(); ctx.ellipse(19, -33, 8, 6, 0, 0, PI * 2); ctx.fill(); }
      line(13, -33, 24, -33, INK, 2.5);
    } else {
      ctx.fillStyle = '#f6f0e6'; ctx.beginPath(); ctx.ellipse(19, -33, 5, 4, 0, 0, PI * 2); ctx.fill();
      ctx.strokeStyle = INK; ctx.lineWidth = 1.5; ctx.stroke();
      ctx.fillStyle = '#1b1411'; ctx.beginPath(); ctx.ellipse(21.5, -33, 2.4, 3, 0, 0, PI * 2); ctx.fill();
    }
    // heavy brow
    ctx.strokeStyle = L.head === 'hair' ? L.hair : L.head === 'grey' ? '#8d887f' : '#4a3020';
    ctx.lineWidth = L.head === 'bald' ? 6 : 5; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(11, -42); ctx.lineTo(27, -39); ctx.stroke();
    // mouth
    if (st.dazed) { ctx.fillStyle = '#3a1512'; ctx.beginPath(); ctx.ellipse(24, -9, 4, 3.5, 0, 0, PI * 2); ctx.fill(); }
    else line(20, -10, 28, -11, BK.shade(L.skin, 0.5), 2.5);
    // hair
    if (L.head === 'hair') {
      cel(() => {
        ctx.beginPath(); ctx.moveTo(-20, -18);
        ctx.bezierCurveTo(-32, -36, -24, -62, 0, -64);
        ctx.lineTo(8, -70); ctx.lineTo(12, -63); ctx.lineTo(20, -66); ctx.lineTo(22, -58); ctx.lineTo(30, -56);
        ctx.quadraticCurveTo(28, -50, 22, -48); ctx.lineTo(24, -45);
        ctx.quadraticCurveTo(10, -50, 2, -44);
        ctx.quadraticCurveTo(-2, -34, 0, -22); // sideburn
        ctx.quadraticCurveTo(-10, -16, -20, -18); ctx.closePath();
      }, L.hair, { outline: 3.5, detail: () => {
        ctx.strokeStyle = 'rgba(255,255,255,0.12)'; ctx.lineWidth = 2;
        for (let i = 0; i < 5; i++) { ctx.beginPath(); ctx.moveTo(-14 + i * 7, -58 + i); ctx.quadraticCurveTo(-8 + i * 7, -52, -12 + i * 6, -40); ctx.stroke(); }
      } });
    } else if (L.head === 'grey') {
      cel(() => {
        ctx.beginPath(); ctx.moveTo(-20, -16); ctx.bezierCurveTo(-30, -34, -24, -60, -2, -62);
        ctx.quadraticCurveTo(10, -63, 16, -58); ctx.quadraticCurveTo(4, -54, 0, -44);
        ctx.quadraticCurveTo(-2, -30, 0, -22); ctx.quadraticCurveTo(-10, -14, -20, -16); ctx.closePath();
      }, '#b9b5ae', { outline: 3 });
      line(22, -15, 30, -16, '#9a958d', 4); // moustache
    }
    // cut and blood
    if (st.damage > 0.45) line(15, -45, 25, -43, '#8e111a', 3);
    if (st.damage > 0.62) {
      ctx.strokeStyle = 'rgba(160,20,28,0.9)'; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.moveTo(24, -43); ctx.quadraticCurveTo(29, -30, 26, -18); ctx.stroke();
    }
  }

  function drawArm(L, pose, front, st) {
    const shX = front ? 14 : -12 + pose.rsh, shY = -80;
    const tx = front ? pose.fX : pose.rX, ty = front ? pose.fY : pose.rY;
    const k = arm(shX, shY, tx, ty, front ? pose.fB : pose.rB);
    const z = front ? pose.fZ : pose.rZ;
    const skin = front ? L.skin : L.skinShade;
    const sleeveCol = L.sleeves === 'long' ? (front ? L.topColor : L.topShade) : null;
    // upper arm
    bone(shX, shY, k.ex, k.ey, len => {
      if (L.sleeves === 'long') {
        cel(limbPath(len + 4, 30, 26, 3, 3, 0.4), sleeveCol, { detail: () => {
          ctx.strokeStyle = 'rgba(0,0,0,0.22)'; ctx.lineWidth = 2;
          ctx.beginPath(); ctx.moveTo(len * 0.6, -12); ctx.quadraticCurveTo(len * 0.7, 0, len * 0.62, 12); ctx.stroke();
        } });
      } else {
        cel(ellipse(2, 0, 16, 15), skin); // deltoid
        cel(limbPath(len + 2, 25, 19, 6, 3, 0.42), skin, { detail: () => {
          sheen(st, [[len * 0.45, -7, len * 0.18, 2.5]]);
          ctx.strokeStyle = 'rgba(90,50,30,0.25)'; ctx.lineWidth = 2; // bicep/tricep split
          ctx.beginPath(); ctx.moveTo(len * 0.25, 2); ctx.quadraticCurveTo(len * 0.55, 5, len * 0.85, 2); ctx.stroke();
        } });
        if (L.sleeves === 'short') cel(limbPath(len * 0.55, 30, 27, 2, 2, 0.4), front ? L.topColor : BK.shade(L.topColor, 0.85), { outline: 3.5 });
      }
    });
    // forearm + fist
    bone(k.ex, k.ey, k.fx, k.fy, len => {
      if (L.sleeves === 'long') {
        cel(limbPath(len * 0.8, 27, 24, 2, 2, 0.4), sleeveCol);
        cel(rrect(len * 0.72, -13, 11, 26, 4), BK.shade(L.topColor, 0.72), { outline: 3 });
        ctx.save(); ctx.translate(len * 0.78, 0); cel(limbPath(len * 0.22, 15, 14), skin, { outline: 3 }); ctx.restore();
      } else {
        cel(limbPath(len, 22, 15, 4, 3, 0.25), skin, { detail: () => line(len * 0.2, -3, len * 0.7, -2, 'rgba(255,235,210,0.25)', 3) });
      }
      ctx.save(); ctx.translate(len, 0); ctx.scale(z, z);
      drawFist(L, front, st);
      ctx.restore();
    });
  }

  function drawFist(L, front, st) {
    const fist = () => {
      ctx.beginPath(); ctx.moveTo(-6, -13);
      ctx.quadraticCurveTo(14, -17, 22, -10); ctx.quadraticCurveTo(28, 0, 22, 11);
      ctx.quadraticCurveTo(10, 16, -6, 12); ctx.quadraticCurveTo(-11, 0, -6, -13); ctx.closePath();
    };
    if (L.fist === 'wraps') {
      const c = front ? L.wraps : L.wrapShade;
      cel(rrect(-16, -10, 16, 20, 4), c, { outline: 3.5, detail: () => { line(-14, -10, -6, 10, 'rgba(0,0,0,0.25)', 1.5); line(-8, -10, 0, 10, 'rgba(0,0,0,0.25)', 1.5); } });
      cel(fist, c, { outline: 4, detail: () => {
        ctx.strokeStyle = 'rgba(0,0,0,0.28)'; ctx.lineWidth = 1.6;
        for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.moveTo(-6 + i * 7, -14); ctx.lineTo(2 + i * 7, 14); ctx.stroke(); }
        ctx.strokeStyle = 'rgba(255,255,255,0.25)'; ctx.beginPath(); ctx.moveTo(-2, -14); ctx.lineTo(6, 14); ctx.stroke();
      } });
      line(18, -6, 18, 6, 'rgba(0,0,0,0.3)', 1.6);
    } else {
      const c = L.fist === 'glove' ? (front ? '#3b4a8c' : '#2d3970') : (front ? L.skin : L.skinShade);
      cel(fist, c, { outline: 4, detail: () => {
        ctx.strokeStyle = 'rgba(0,0,0,0.3)'; ctx.lineWidth = 1.6;
        for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.moveTo(14, -9 + i * 7); ctx.lineTo(23, -8 + i * 7); ctx.stroke(); }
        if (L.fist === 'bare' && st.damage > 0.3) { ctx.fillStyle = 'rgba(150,30,30,0.6)'; BK.draw.circle(20, -4, 3); ctx.fill(); BK.draw.circle(21, 4, 2.5); ctx.fill(); }
      } });
      // thumb wrapped over the fingers
      ctx.strokeStyle = INK; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-2, 6); ctx.quadraticCurveTo(8, 4, 14, 8); ctx.stroke();
    }
  }

  // ---------------- whole figure ----------------
  // Draws in fighter space: facing +x, feet on y = 0. The caller applies position/scale/facing.
  R.draw = (L, pose, st) => {
    ctx.save();
    ctx.scale(pose.sqx, pose.sqy);
    if (pose.rot) { ctx.translate(pose.rotX, 0); ctx.rotate(pose.rot * DEG); ctx.translate(-pose.rotX, 0); }
    const pelX = pose.px, pelY = -120 + pose.py;
    const hipF = [pelX + 9, pelY + 6], hipR = [pelX - 9, pelY + 6];
    const legR = leg(hipR[0], hipR[1], pose.rfX, pose.rfY - 10);
    const legF = leg(hipF[0], hipF[1], pose.ffX, pose.ffY - 10);
    const torso = fn => { ctx.save(); ctx.translate(pelX, pelY); ctx.rotate(pose.lean * DEG); fn(); ctx.restore(); };

    drawLeg(L, hipR, legR, false);
    torso(() => drawArm(L, pose, false, st));
    drawLeg(L, hipF, legF, true);
    drawPelvis(L, pelX, pelY);
    torso(() => {
      drawTorso(L, st);
      ctx.save(); ctx.translate(4, -86); ctx.rotate(pose.head * DEG);
      drawHead(L, st);
      ctx.restore();
      drawArm(L, pose, true, st);
    });
    ctx.restore();
  };
  // Head only, centred near the origin, for portraits.
  R.drawHead = (L, st) => { ctx.save(); ctx.translate(-4, 30); drawHead(L, st); ctx.restore(); };
})();
