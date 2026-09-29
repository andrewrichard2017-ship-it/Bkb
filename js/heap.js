// The heap: a bare-knuckle meet on a gravel flat under a huge dark spoil heap, on a grey overcast day.
// Same ring coordinates as the hall, so everything plays the same; no ring, they fight on the gravel.
// A loose circle of lads in everyday clothes stands round (arms folded, hands in pockets, a few filming),
// and each fighter walks in from beside a car parked at the edge of the site, hazards flashing.
(() => {
  'use strict';
  const BK = window.BK, ctx = BK.ctx, D = BK.draw, W = BK.W, H = BK.H, R = BK.RING;
  const { lerp, clamp } = BK;
  const circleOn = (c, x, y, r) => { c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); };
  const rrOn = (c, x, y, w, h, r) => { r = Math.min(r, w / 2, h / 2); c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); };
  // The walkout starts lower than in the hall (rampTop), so the flat is shallow and the heap fills the top of the
  // picture behind the fight, like it does from the edge of the crowd.
  const HP = BK.VENUES.heap = { flashes: [], ropes: false, daylight: true, rampTop: [-0.35, -0.3], floor: 'gravel', light: { dx: -0.12, dy: 0, rim: 'rgba(230,235,240,0.22)', shadow: 0.22, spread: 1.6 } }; // overcast: soft, faint, wide shadows

  // own random stream, so building the scene doesn't shift anyone else's BK.srand() sequence
  let seed = 90210;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

  const zAt = y => (y - R.backY) / (R.frontY - R.backY);
  const scaleAt = y => BK.depthScale(zAt(y));
  // the cars are parked where the walkout starts, on the far edge of the flat at the foot of the heap
  const TOP = HP.rampTop;
  const GROUND = BK.toScreenY(TOP[1]) + 6;
  const CAR_X = [BK.toScreenX(TOP[0], TOP[1]), BK.toScreenX(1 - TOP[0], TOP[1])];
  // Phones wider than 16:9 see past the sides of the 1600-wide stage, so the scene is built out to either side.
  const MX = 480, X0 = -MX, X1 = W + MX;

  const poly = (c, pts) => { c.beginPath(); c.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) c.lineTo(pts[i][0], pts[i][1]); c.closePath(); };
  const rr = (c, x, y, w, h, r) => {
    r = Math.min(r, w / 2, h / 2);
    c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r);
    c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath();
  };
  const ell = (c, x, y, rx, ry, rot = 0) => { c.beginPath(); c.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), rot, 0, Math.PI * 2); };
  const line = (c, pts, col, w) => {
    c.strokeStyle = col; c.lineWidth = w; c.lineCap = 'round'; c.lineJoin = 'round';
    c.beginPath(); c.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) c.lineTo(pts[i][0], pts[i][1]); c.stroke();
  };

  // ---------- the heap's shape: a big humped ridge with a ragged, tipped-spoil skyline ----------
  const bump = (x, c, w, h) => h * Math.exp(-((x - c) * (x - c)) / (2 * w * w));
  const noise = x => Math.sin(x * 0.021) * 6 + Math.sin(x * 0.057 + 1.3) * 3.5 + Math.sin(x * 0.13 + 0.4) * 1.8;
  const heapH = x => {
    const h = bump(x, 1000, 330, 250) + bump(x, 470, 300, 215) + bump(x, 1330, 200, 150) + bump(x, 1610, 150, 60) + bump(x, 80, 180, 70);
    return Math.max(0, Math.min(280, h) + noise(x) * Math.min(1, h / 60));
  };
  const heapTop = x => GROUND + 8 - heapH(x);
  const HEAP = [[X0, GROUND + 10]];
  for (let x = X0; x <= X1; x += 5) HEAP.push([x, heapTop(x)]);
  HEAP.push([X1, GROUND + 10]);

  // ---------- the static scene, pre-rendered once ----------
  const S = 1.1;
  const bg = document.createElement('canvas');
  bg.width = Math.round((X1 - X0) * S); bg.height = Math.round(H * S);
  (() => {
    const c = bg.getContext('2d');
    c.scale(S, S); c.translate(-X0, 0);
    const WW = X1 - X0;
    // overcast sky: a low grey lid, brighter towards the horizon, with soft darker cloud masses
    const sky = c.createLinearGradient(0, 0, 0, GROUND);
    sky.addColorStop(0, '#b9c0c6'); sky.addColorStop(0.55, '#d3d8dc'); sky.addColorStop(1, '#e7e9ea');
    c.fillStyle = sky; c.fillRect(X0, 0, WW, GROUND + 10);
    for (let i = 0; i < 40; i++) {
      const x = X0 + rnd() * WW, y = rnd() * (GROUND - 120), rx = 120 + rnd() * 260, ry = rx * (0.25 + rnd() * 0.2);
      const dark = rnd() < 0.55, cl = c.createRadialGradient(x, y, 4, x, y, rx);
      cl.addColorStop(0, dark ? 'rgba(150,158,166,0.28)' : 'rgba(245,246,247,0.35)'); cl.addColorStop(1, 'rgba(200,205,210,0)');
      c.save(); c.translate(x, y); c.scale(1, ry / rx); c.translate(-x, -y); c.fillStyle = cl; c.fillRect(x - rx, y - rx, rx * 2, rx * 2); c.restore();
    }
    // far country: a pale hill line with a couple of pylons, then the treeline, greyed by distance
    c.fillStyle = '#a9b0ae';
    c.beginPath(); c.moveTo(X0, GROUND); for (let x = X0; x <= X1; x += 20) c.lineTo(x, GROUND - 70 - Math.sin(x * 0.003) * 22 - Math.sin(x * 0.011) * 8); c.lineTo(X1, GROUND); c.closePath(); c.fill();
    c.strokeStyle = 'rgba(95,102,104,0.55)'; c.lineWidth = 2;
    for (const px of [-260, 120, 1780]) {
      const b = GROUND - 70 - Math.sin(px * 0.003) * 22, t = b - 70;
      c.beginPath(); c.moveTo(px - 10, b); c.lineTo(px, t); c.lineTo(px + 10, b); c.moveTo(px - 14, t + 12); c.lineTo(px + 14, t + 12); c.moveTo(px - 10, t + 24); c.lineTo(px + 10, t + 24); c.stroke();
    }
    const trees = (from, to, base, hMin, hMax, cols) => {
      for (let x = from; x < to; x += 7 + rnd() * 9) {
        const h = hMin + rnd() * (hMax - hMin), w = h * (0.35 + rnd() * 0.25);
        c.fillStyle = cols[Math.floor(rnd() * cols.length)];
        c.beginPath(); c.moveTo(x - w, base); c.quadraticCurveTo(x - w * 1.1, base - h * 0.55, x - w * 0.2, base - h); c.quadraticCurveTo(x + w * 0.4, base - h * 1.05, x + w * 0.9, base - h * 0.5); c.quadraticCurveTo(x + w * 1.2, base - h * 0.1, x + w, base); c.closePath(); c.fill();
      }
    };
    trees(X0, X1, GROUND + 2, 40, 80, ['#6f7c70', '#76836f', '#687468']); // distant, hazy
    trees(X0, 120, GROUND + 4, 60, 120, ['#3b4a37', '#44533d', '#34422f']);
    trees(1440, X1, GROUND + 4, 60, 130, ['#3b4a37', '#44533d', '#34422f', '#4c5a3f']);

    // the heap: tipped spoil, near-black with a rust cast; lit from the bright sky above, so tops are lighter
    const hg = c.createLinearGradient(0, GROUND - 280, 0, GROUND + 10);
    hg.addColorStop(0, '#3a2a25'); hg.addColorStop(0.35, '#2b1e1a'); hg.addColorStop(0.85, '#241915'); hg.addColorStop(1, '#3a261f');
    c.fillStyle = hg; poly(c, HEAP); c.fill();
    c.save(); poly(c, HEAP); c.clip();
    // tipping layers: bands that follow the skyline down the face
    for (let d = 14; d < 260; d += 10 + rnd() * 14) {
      c.strokeStyle = rnd() < 0.5 ? 'rgba(90,62,50,0.22)' : 'rgba(10,6,5,0.25)'; c.lineWidth = 2 + rnd() * 5;
      c.beginPath(); let first = true;
      for (let x = X0; x <= X1; x += 12) { const y = heapTop(x) + d * (0.55 + 0.45 * Math.min(1, heapH(x) / 200)) + Math.sin(x * 0.02 + d) * 3; if (first) { c.moveTo(x, y); first = false; } else c.lineTo(x, y); }
      c.stroke();
    }
    // gullies washed down the slope, light on one side and shadow on the other
    for (let i = 0; i < 70; i++) {
      const x = X0 + 100 + rnd() * (WW - 200), top = heapTop(x) + 8, len = (GROUND - top) * (0.4 + rnd() * 0.6);
      if (len < 20) continue;
      const lean = (rnd() - 0.5) * 30;
      line(c, [[x, top], [x + lean * 0.5, top + len * 0.5], [x + lean, top + len]], 'rgba(8,5,4,0.35)', 2 + rnd() * 2);
      line(c, [[x + 3, top], [x + 3 + lean * 0.5, top + len * 0.5], [x + 3 + lean, top + len]], 'rgba(120,88,72,0.18)', 1.5);
    }
    // clods and lumps: a lit top-left, a shadow bottom-right
    for (let i = 0; i < 2600; i++) {
      const x = X0 + rnd() * WW, top = heapTop(x);
      const y = top + Math.pow(rnd(), 0.7) * (GROUND + 8 - top);
      if (y > GROUND + 8) continue;
      const r = 1 + rnd() * (y > GROUND - 40 ? 4.5 : 2.6);
      c.fillStyle = 'rgba(6,4,3,0.4)'; ell(c, x + r * 0.35, y + r * 0.3, r, r * 0.7); c.fill();
      c.fillStyle = rnd() < 0.7 ? 'rgba(92,66,54,0.5)' : 'rgba(130,100,84,0.45)'; ell(c, x, y, r * 0.8, r * 0.55); c.fill();
    }
    // sky light catching the upper slopes, and the skyline rim
    const lit = c.createLinearGradient(0, GROUND - 280, 0, GROUND - 120);
    lit.addColorStop(0, 'rgba(190,176,168,0.2)'); lit.addColorStop(1, 'rgba(190,176,168,0)');
    c.fillStyle = lit; c.fillRect(X0, 0, WW, GROUND);
    c.strokeStyle = 'rgba(170,150,140,0.35)'; c.lineWidth = 3;
    c.beginPath(); for (let i = 1; i < HEAP.length - 1; i++) { const [x, y] = HEAP[i]; if (i === 1) c.moveTo(x, y + 2); else c.lineTo(x, y + 2); } c.stroke();
    // weeds and moss taking hold on the lower slopes
    for (let i = 0; i < 260; i++) {
      const x = X0 + rnd() * WW, top = heapTop(x);
      if (GROUND - top < 30) continue;
      const y = GROUND + 4 - rnd() * Math.min(90, (GROUND - top) * 0.5);
      c.strokeStyle = rnd() < 0.5 ? 'rgba(78,92,52,0.55)' : 'rgba(104,108,60,0.45)'; c.lineWidth = 1.5;
      c.beginPath(); for (let k = 0; k < 4; k++) { const a = -Math.PI / 2 + (rnd() - 0.5) * 1.2; c.moveTo(x + k * 1.5, y); c.lineTo(x + k * 1.5 + Math.cos(a) * 7, y + Math.sin(a) * 7); } c.stroke();
    }
    c.restore();
    // the talus apron where the heap slumps onto the flat, and haze in the distance
    const ap = c.createLinearGradient(0, GROUND - 26, 0, GROUND + 22);
    ap.addColorStop(0, 'rgba(84,50,38,0)'); ap.addColorStop(0.6, 'rgba(84,50,38,0.55)'); ap.addColorStop(1, 'rgba(84,50,38,0)');
    c.fillStyle = ap; c.fillRect(X0, GROUND - 26, WW, 48);
    const hz = c.createLinearGradient(0, GROUND - 90, 0, GROUND + 12);
    hz.addColorStop(0, 'rgba(205,208,210,0)'); hz.addColorStop(1, 'rgba(205,208,210,0.28)');
    c.fillStyle = hz; c.fillRect(X0, GROUND - 90, WW, 102);

    // the flat: reddish spoil washed down near the heap, grey shale gravel across the middle, darker near us
    const gr = c.createLinearGradient(0, GROUND, 0, H);
    gr.addColorStop(0, '#553729'); gr.addColorStop(0.1, '#5f4a3f'); gr.addColorStop(0.32, '#716860'); gr.addColorStop(0.7, '#62574e'); gr.addColorStop(1, '#4a3b32');
    c.fillStyle = gr; c.fillRect(X0, GROUND + 8, WW, H - GROUND);
    for (let i = 0; i < 30; i++) { // rust-coloured and dark patches
      const y = GROUND + 20 + rnd() * (H - GROUND - 20), x = X0 + rnd() * WW, r = (80 + rnd() * 220) * scaleAt(y), red = rnd() < 0.6;
      c.fillStyle = red ? `rgba(98,50,34,${0.12 + rnd() * 0.14})` : `rgba(28,22,20,${0.1 + rnd() * 0.12})`; ell(c, x, y, r, r * 0.2); c.fill();
    }
    // the grey concrete pad off to the right, half buried, cracked
    const pad = [[1010, GROUND + 18], [1330, GROUND + 8], [1640, GROUND + 12], [1580, GROUND + 38], [1180, GROUND + 52], [1030, GROUND + 42]];
    c.fillStyle = '#a19e98'; poly(c, pad); c.fill();
    c.fillStyle = 'rgba(60,50,45,0.3)'; poly(c, [[1030, GROUND + 42], [1180, GROUND + 52], [1580, GROUND + 38], [1570, GROUND + 46], [1176, GROUND + 60], [1036, GROUND + 50]]); c.fill();
    line(c, [[1120, GROUND + 22], [1180, GROUND + 34], [1250, GROUND + 30]], 'rgba(60,55,50,0.5)', 1.5);
    line(c, [[1400, GROUND + 14], [1440, GROUND + 30]], 'rgba(60,55,50,0.5)', 1.5);
    // ruts: two worn wheel tracks swinging across, each a dark trough with a lighter lip
    for (const off of [0, 20]) {
      const pts = t => [X0 + t * WW, GROUND + 70 + off + Math.sin(t * 5 + 0.6) * 26 + t * 30];
      c.beginPath(); for (let t = 0; t <= 1; t += 0.01) { const [x, y] = pts(t); t ? c.lineTo(x, y) : c.moveTo(x, y); }
      c.strokeStyle = 'rgba(30,22,18,0.28)'; c.lineWidth = 12; c.stroke();
      c.beginPath(); for (let t = 0; t <= 1; t += 0.01) { const [x, y] = pts(t); t ? c.lineTo(x, y + 7) : c.moveTo(x, y + 7); }
      c.strokeStyle = 'rgba(150,140,128,0.2)'; c.lineWidth = 3; c.stroke();
    }
    // puddles holding the grey sky
    for (const [x, y, rx] of [[330, GROUND + 90, 70], [1450, GROUND + 150, 90], [-200, GROUND + 260, 120], [1860, GROUND + 330, 140], [120, 780, 110]]) {
      const pg = c.createLinearGradient(0, y - rx * 0.14, 0, y + rx * 0.14);
      pg.addColorStop(0, 'rgba(205,210,214,0.75)'); pg.addColorStop(1, 'rgba(140,148,156,0.7)');
      c.fillStyle = 'rgba(40,30,24,0.35)'; ell(c, x, y + 2, rx * 1.06, rx * 0.16); c.fill();
      c.fillStyle = pg; ell(c, x, y, rx, rx * 0.13); c.fill();
    }
    // gravel: many thousands of stones, each with a lit face and a shadow, bigger nearer the camera
    for (let i = 0; i < 11000; i++) {
      const y = GROUND + 10 + Math.pow(rnd(), 0.85) * (H - GROUND), x = X0 + rnd() * WW, s = scaleAt(y);
      const r = (0.7 + rnd() * rnd() * 3.4) * s, v = rnd();
      c.fillStyle = 'rgba(20,15,12,0.35)'; ell(c, x + r * 0.4, y + r * 0.35, r, r * 0.55); c.fill();
      c.fillStyle = v < 0.45 ? 'rgba(168,162,154,0.7)' : v < 0.75 ? 'rgba(120,110,100,0.7)' : 'rgba(128,88,70,0.65)';
      ell(c, x, y, r, r * 0.6, (rnd() - 0.5) * 0.8); c.fill();
    }
    for (let i = 0; i < 90; i++) { // bigger rocks and lumps of shale
      const y = GROUND + 30 + rnd() * (H - GROUND - 30), x = X0 + rnd() * WW, s = scaleAt(y), r = (5 + rnd() * 9) * s;
      c.fillStyle = 'rgba(20,14,12,0.45)'; ell(c, x + r * 0.5, y + r * 0.35, r * 1.2, r * 0.45); c.fill();
      c.fillStyle = rnd() < 0.5 ? '#6e675f' : '#4d3d34'; ell(c, x, y - r * 0.2, r, r * 0.62, (rnd() - 0.5) * 0.6); c.fill();
      c.fillStyle = 'rgba(210,205,198,0.25)'; ell(c, x - r * 0.3, y - r * 0.45, r * 0.45, r * 0.2); c.fill();
    }
    for (let i = 0; i < 140; i++) { // tufts of weed pushing through the stones
      const y = GROUND + 12 + rnd() * (H - GROUND), x = X0 + rnd() * WW, s = scaleAt(y);
      if (x > 200 && x < 1400 && y > R.backY - 20 && y < R.frontY + 20) continue; // not where they fight
      c.strokeStyle = rnd() < 0.5 ? 'rgba(86,98,56,0.6)' : 'rgba(112,112,64,0.55)'; c.lineWidth = 1.6 * s;
      c.beginPath(); for (let k = 0; k < 5; k++) { const a = -Math.PI / 2 + (rnd() - 0.5) * 1.3; c.moveTo(x + k * 2 * s, y); c.lineTo(x + k * 2 * s + Math.cos(a) * 11 * s, y + Math.sin(a) * 11 * s); } c.stroke();
    }
    // overcast light: no hard shadows, a soft darkening towards the bottom of the picture
    const vg = c.createLinearGradient(0, H - 260, 0, H);
    vg.addColorStop(0, 'rgba(20,14,12,0)'); vg.addColorStop(1, 'rgba(20,14,12,0.28)');
    c.fillStyle = vg; c.fillRect(X0, H - 260, WW, 260);
  })();

  // ---------- the cars the fighters arrive in ----------
  const CARS = [{ body: '#2e3338', trim: '#1b1e21', van: false }, { body: '#d9dad6', trim: '#9ea09d', van: true }];
  const wo = () => BK.walkout;
  const carLit = side => { const w = wo(); return !!(w && w.active && w.phase === (side === 0 ? 'red' : 'blue')); };
  function drawCar(side, t) {
    const car = CARS[side], x = CAR_X[side] + (side ? 30 : -30), y = GROUND - 2, d = side ? -1 : 1; // nose points at the ring
    const L = car.van ? 170 : 150, Ht = car.van ? 82 : 58;
    ctx.fillStyle = 'rgba(0,0,0,0.28)'; ell(ctx, x, y + 2, L * 0.55, 7); ctx.fill();
    ctx.save(); ctx.translate(x, y); ctx.scale(d, 1);
    // body
    if (car.van) {
      rr(ctx, -L / 2, -Ht, L * 0.72, Ht - 10, 8); ctx.fillStyle = car.body; ctx.fill();
      poly(ctx, [[-L / 2 + L * 0.7, -Ht + 4], [L / 2 - 12, -Ht * 0.55], [L / 2, -Ht * 0.45], [L / 2, -12], [-L / 2 + L * 0.7, -12]]); ctx.fill();
      ctx.fillStyle = '#2a3036'; poly(ctx, [[-L / 2 + L * 0.72, -Ht + 10], [L / 2 - 16, -Ht * 0.56], [L / 2 - 16, -Ht * 0.4], [-L / 2 + L * 0.72, -Ht * 0.4]]); ctx.fill();
      ctx.fillStyle = 'rgba(0,0,0,0.12)'; ctx.fillRect(-L / 2 + 6, -Ht * 0.52, L * 0.62, 3);
    } else {
      rr(ctx, -L / 2, -Ht * 0.62, L, Ht * 0.5, 10); ctx.fillStyle = car.body; ctx.fill();
      poly(ctx, [[-L * 0.34, -Ht * 0.6], [-L * 0.24, -Ht], [L * 0.16, -Ht], [L * 0.32, -Ht * 0.6]]); ctx.fill();
      ctx.fillStyle = '#5d6a74'; poly(ctx, [[-L * 0.3, -Ht * 0.64], [-L * 0.22, -Ht * 0.92], [-0.02 * L, -Ht * 0.92], [-0.02 * L, -Ht * 0.64]]); ctx.fill();
      poly(ctx, [[0.02 * L, -Ht * 0.64], [0.02 * L, -Ht * 0.92], [L * 0.14, -Ht * 0.92], [L * 0.27, -Ht * 0.64]]); ctx.fill();
    }
    ctx.fillStyle = car.trim; ctx.fillRect(-L / 2, -18, L, 6);
    for (const wx of [-L * 0.3, L * 0.3]) { ell(ctx, wx, -10, 13, 13); ctx.fillStyle = '#121212'; ctx.fill(); ell(ctx, wx, -10, 6, 6); ctx.fillStyle = '#7a7e82'; ctx.fill(); }
    // hazards blinking while their man walks in
    const on = carLit(side) && Math.sin(t * 9) > 0;
    for (const lx of [L / 2 - 6, -L / 2 + 6]) {
      ctx.fillStyle = on ? '#ffb13b' : '#8a5a22'; ctx.fillRect(lx - 4, -Ht * 0.5 - (car.van ? 8 : 0), 8, 6);
      if (on) {
        ctx.save(); ctx.globalCompositeOperation = 'lighter';
        const g = ctx.createRadialGradient(lx, -Ht * 0.47, 1, lx, -Ht * 0.47, 36);
        g.addColorStop(0, 'rgba(255,170,60,0.55)'); g.addColorStop(1, 'rgba(255,170,60,0)');
        ctx.fillStyle = g; ctx.fillRect(lx - 36, -Ht * 0.47 - 36, 72, 72);
        ctx.restore();
      }
    }
    ctx.restore();
  }

  // ---------- the crowd: a loose circle of lads in their everyday gear ----------
  const SKIN = ['#e0ad8a', '#d49a78', '#c98d6a', '#e8bc9c', '#b37a58'];
  const HAIR = ['#1c1512', '#3a2718', '#5a4230', '#8a8580', '#2a2320'];
  // top: colour, sleeves ('short' | 'long' | 'none'), hood down on the back for hoodies
  const LOOKS = [
    { top: '#9fa6ab', sleeves: 'none', legs: '#1d1d21', pose: 'hips' },               // grey vest, black shorts
    { top: '#1e2126', sleeves: 'long', legs: '#1b1d22', pose: 'phone' },              // black jacket, filming
    { top: '#2a2d33', sleeves: 'long', legs: '#4c6488', pose: 'phone' },              // dark top and jeans, filming
    { top: '#2f8f86', sleeves: 'short', legs: '#3d5474', pose: 'fold' },              // teal t-shirt, arms folded
    { top: '#2f3f5e', sleeves: 'short', legs: '#2c3440', pose: 'pockets' },           // navy t-shirt
    { top: '#c9c9c6', sleeves: 'long', legs: '#bdbdb8', pose: 'fold', hood: true },   // grey tracksuit
    { top: '#e39a54', sleeves: 'short', legs: '#1d1d21', pose: 'hips' },              // orange t-shirt
    { top: '#5a6048', sleeves: 'long', legs: '#3a3f47', pose: 'pockets', hood: true },
    { top: '#7a2a2c', sleeves: 'short', legs: '#2c3440', pose: 'fold' },
  ];
  const SPOTS = [[480, 372], [600, 358], [715, 384], [830, 362], [945, 380], [1055, 360], [1160, 382], [650, 428], [1010, 430],
    [140, 600], [60, 690], [1440, 600], [1540, 680]];
  const CROWD = SPOTS.map(([x, y], i) => Object.assign({ x, y, dir: x < 300 ? 1 : x > 1300 ? -1 : (rnd() < 0.5 ? -1 : 1),
    skin: SKIN[i % SKIN.length], hair: HAIR[Math.floor(rnd() * HAIR.length)], ph: rnd() * 6, cheer: rnd() < 0.6, sc: 0.93 + rnd() * 0.14 }, LOOKS[i % LOOKS.length])).sort((a, b) => a.y - b.y);

  function bystander(o, t, ex) {
    const k = scaleAt(o.y) * 0.88 * o.sc, d = o.dir;
    const hype = o.cheer && ex > 0.35 && o.pose !== 'phone';
    const hop = hype ? Math.max(0, Math.sin(t * 7 + o.ph)) * 10 * ex : 0;
    ctx.fillStyle = 'rgba(30,22,18,0.3)'; ell(ctx, o.x, o.y, 34 * k, 7 * k); ctx.fill();
    ctx.save(); ctx.translate(o.x, o.y - hop * k); ctx.scale(k, k);
    const top = o.top, dark = BK.shade(top, 0.78), skin = o.skin;
    // legs and trainers
    const shorts = o.legs === '#1d1d21' && o.sleeves !== 'long';
    ctx.fillStyle = o.legs; rr(ctx, -21, -132, 19, shorts ? 62 : 130, 8); ctx.fill(); rr(ctx, 2, -132, 19, shorts ? 62 : 130, 8); ctx.fill();
    if (shorts) { ctx.fillStyle = skin; rr(ctx, -19, -74, 15, 70, 6); ctx.fill(); rr(ctx, 4, -74, 15, 70, 6); ctx.fill(); }
    ctx.fillStyle = '#e8e6e0'; ell(ctx, -12 + d * 3, -3, 14, 6); ctx.fill(); ell(ctx, 12 + d * 3, -3, 14, 6); ctx.fill();
    // body
    rr(ctx, -38, -236, 76, 114, 22); ctx.fillStyle = top; ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,0.14)'; rr(ctx, 6, -234, 32, 110, 18); ctx.fill(); // shade on the side away from the sky
    ctx.fillStyle = 'rgba(255,255,255,0.08)'; rr(ctx, -34, -234, 20, 60, 12); ctx.fill();
    if (o.sleeves === 'none') { ctx.fillStyle = skin; ell(ctx, -36, -222, 10, 12); ctx.fill(); ell(ctx, 36, -222, 10, 12); ctx.fill(); }
    ctx.fillStyle = dark; ctx.fillRect(-38, -130, 76, 8);
    const arm = (sh, el, hd) => {
      const sleeve = o.sleeves === 'long' ? top : o.sleeves === 'short' ? top : skin;
      line(ctx, [sh, el], sleeve, 18);
      line(ctx, [el, hd], o.sleeves === 'long' ? top : skin, 15);
      ctx.fillStyle = skin; ell(ctx, hd[0], hd[1], 7, 7); ctx.fill();
    };
    const S1 = [-32, -222], S2 = [32, -222], pump = Math.sin(t * 7 + o.ph) * 10;
    if (hype) { arm(S1, [-50, -270], [-40, -318 + pump]); arm(S2, [50, -270], [40, -318 - pump]); }
    else if (o.pose === 'fold') { line(ctx, [S1, [-40, -176]], top, 18); line(ctx, [S2, [40, -176]], top, 18); line(ctx, [[-40, -176], [22, -186]], o.sleeves === 'long' ? top : skin, 15); line(ctx, [[40, -176], [-22, -180]], dark, 15); }
    else if (o.pose === 'hips') { arm(S1, [-52, -178], [-32, -140]); arm(S2, [52, -178], [32, -140]); }
    else if (o.pose === 'phone') {
      arm(d > 0 ? S1 : S2, [-d * 40, -176], [-d * 36, -132]);
      const hx = d * 16; arm(d > 0 ? S2 : S1, [d * 44, -234], [hx, -264]);
      ctx.fillStyle = '#0d0e10'; rr(ctx, hx - 9, -294, 18, 32, 3); ctx.fill();
    } else { line(ctx, [S1, [-42, -180], [-18, -150]], top, 17); line(ctx, [S2, [42, -180], [18, -150]], top, 17); } // pockets
    if (o.hood) { ctx.fillStyle = dark; ell(ctx, 0, -232, 30, 12); ctx.fill(); } // hood down on the shoulders
    // head: face and short hair
    ctx.fillStyle = skin; rr(ctx, -8, -252, 16, 18, 5); ctx.fill();
    ell(ctx, d * 2, -272, 22, 26); ctx.fill();
    ctx.fillStyle = o.hair; ctx.beginPath(); ctx.ellipse(d * 1, -284, 23, 16, 0, Math.PI, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,0.55)'; ell(ctx, d * 9, -273, 2, 2.5); ctx.fill(); ell(ctx, d * -5, -273, 2, 2.5); ctx.fill();
    ctx.fillStyle = 'rgba(90,40,30,0.35)'; ctx.fillRect(d * 2 - 6, -258, 12, 2);
    ctx.restore();
  }

  HP.update = (dt, excitement) => {
    if (Math.random() < (0.2 + excitement * 2) * dt) { // someone's phone flash
      const o = BK.pick(CROWD.filter(c => c.pose === 'phone'));
      if (o) { const k = scaleAt(o.y) * 0.88 * o.sc; HP.flashes.push({ x: o.x + o.dir * 12 * k, y: o.y - 286 * k, t: 0 }); }
    }
    for (const f of HP.flashes) f.t += dt;
    HP.flashes = HP.flashes.filter(f => f.t < 0.15);
  };

  HP.drawBackdrop = (t, excitement) => {
    ctx.fillStyle = '#b9c0c6'; ctx.fillRect(-W, -H, W * 3, H * 2); // above and below the built scene, just in case
    ctx.fillStyle = '#4a3b32'; ctx.fillRect(-W, H - 2, W * 3, H * 2);
    ctx.drawImage(bg, X0, 0, X1 - X0, H);
    drawCar(0, t); drawCar(1, t);
    for (const o of CROWD) bystander(o, t, excitement);
    for (const f of HP.flashes) {
      const a = 1 - f.t / 0.15, g = ctx.createRadialGradient(f.x, f.y, 0, f.x, f.y, 26);
      g.addColorStop(0, `rgba(255,255,255,${a})`); g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g; ctx.fillRect(f.x - 26, f.y - 26, 52, 52);
    }
  };

  // the fighting patch: just gravel, kicked about and flattened where they've been at it
  const SCUFFS = [];
  for (let i = 0; i < 18; i++) SCUFFS.push({ u: 0.1 + rnd() * 0.8, z: 0.1 + rnd() * 0.8, r: 20 + rnd() * 50, a: 0.06 + rnd() * 0.1, light: rnd() < 0.5 });
  HP.drawRing = () => {
    ctx.save(); ctx.translate(W / 2, BK.toScreenY(0.5)); ctx.scale(1, 0.34);
    const worn = ctx.createRadialGradient(0, 0, 60, 0, 0, 760);
    worn.addColorStop(0, 'rgba(150,140,128,0.3)'); worn.addColorStop(1, 'rgba(150,140,128,0)');
    ctx.fillStyle = worn; ctx.fillRect(-800, -800, 1600, 1600);
    ctx.restore();
    for (const s of SCUFFS) {
      const x = BK.toScreenX(s.u, s.z), y = BK.toScreenY(s.z), k = BK.depthScale(s.z);
      ctx.fillStyle = s.light ? `rgba(180,172,160,${s.a})` : `rgba(40,30,24,${s.a})`;
      ell(ctx, x, y, s.r * k, s.r * k * 0.28); ctx.fill();
    }
  };
  HP.drawBackRopes = () => {};
  HP.drawFrontRopes = () => {};

  // lads along the front with their backs to us, a couple filming
  const FRONT = [];
  for (let i = 0; i < 12; i++) {
    const left = i < 6, j = i % 6, lk = LOOKS[Math.floor(rnd() * LOOKS.length)];
    FRONT.push({ x: left ? 50 + j * 96 + rnd() * 24 : 1090 + j * 96 + rnd() * 24, r: 30 + rnd() * 8, ph: rnd() * 6,
      bang: rnd() < 0.6, phone: rnd() < 0.3, top: BK.shade(lk.top, 0.55), hair: BK.shade(HAIR[Math.floor(rnd() * HAIR.length)], 0.8), skin: BK.shade(SKIN[i % SKIN.length], 0.6) });
  }
  HP.drawFrontRow = (t, excitement, c = ctx) => {
    for (const f of FRONT) {
      const y = 874 + Math.sin(f.ph) * 6, up = excitement > 0.3 && f.bang && !f.phone;
      const bob = up ? Math.max(0, Math.sin(t * 9 + f.ph)) * 8 : 0;
      c.strokeStyle = f.top; c.lineWidth = f.r * 0.55; c.lineCap = 'round';
      if (up) {
        c.beginPath(); c.moveTo(f.x - f.r * 0.8, y + f.r); c.lineTo(f.x - f.r * 1.1, y - f.r * 2.2 - bob);
        c.moveTo(f.x + f.r * 0.8, y + f.r); c.lineTo(f.x + f.r * 1.1, y - f.r * 2.2 + bob); c.stroke();
      }
      if (f.phone) {
        const px = f.x + f.r * 0.9, py = y - f.r * 2.1;
        c.beginPath(); c.moveTo(f.x + f.r * 0.7, y + f.r); c.lineTo(px, py + 10); c.stroke();
        rrOn(c, px - 13, py - 24, 26, 44, 4); c.fillStyle = '#0b0b0d'; c.fill();
        c.fillStyle = '#b9c7d8'; c.fillRect(px - 10, py - 20, 20, 36);
        c.fillStyle = 'rgba(60,50,45,0.7)'; c.fillRect(px - 6, py - 6, 12, 14);
      }
      c.fillStyle = f.top; c.beginPath(); c.ellipse(f.x, y + f.r * 1.9, f.r * 1.6, f.r * 1.2, 0, 0, Math.PI * 2); c.fill();
      c.fillStyle = f.skin; ell(ctx, f.x, y + f.r * 0.9, f.r * 0.45, f.r * 0.4); c.fill(); // neck
      ell(ctx, f.x, y - bob * 0.5, f.r * 0.95, f.r * 1.05); c.fill();
      c.fillStyle = f.hair; c.beginPath(); c.ellipse(f.x, y - bob * 0.5 - f.r * 0.1, f.r * 0.97, f.r * 0.95, 0, Math.PI * 0.95, Math.PI * 2.05); c.fill();
    }
  };  // same, into another context (the blur buffer)
  HP.drawFrontRowTo = (c, t, ex) =>   HP.drawFrontRow(t, ex, c);


  // grey daylight: a flat wash and a bit of dust blowing across
  const DUST = [];
  for (let i = 0; i < 36; i++) DUST.push({ x: rnd() * W, y: 200 + rnd() * 650, v: 30 + rnd() * 50, r: 1 + rnd() * 2, ph: rnd() * 6 });
  HP.drawAtmosphere = t => {
    ctx.fillStyle = 'rgba(210,212,214,0.06)'; ctx.fillRect(-W, -H, W * 3, H * 3);
    ctx.fillStyle = 'rgba(150,130,115,0.35)';
    for (const p of DUST) {
      const x = (p.x + t * p.v) % (W + 40) - 20, y = p.y + Math.sin(t * 1.3 + p.ph) * 8;
      ell(ctx, x, y, p.r * 1.8, p.r); ctx.fill();
    }
  };
})();
