// The heap: a bare-knuckle meet on a gravel flat under a huge dark spoil heap, on a grey overcast day.
// Same ring coordinates as the hall, so everything plays the same; no ring, they fight on the gravel.
// A loose circle of lads in everyday clothes stands round (arms folded, hands in pockets, a few filming),
// and each fighter walks in from beside a car parked at the edge of the site, hazards flashing.
(() => {
  'use strict';
  const BK = window.BK, ctx = BK.ctx, D = BK.draw, W = BK.W, H = BK.H, R = BK.RING;
  const { lerp, clamp } = BK;
  // the walkout starts lower than in the hall (rampTop), so the flat is shallow and the heap stands tall behind the fight
  const HP = BK.VENUES.heap = { flashes: [], ropes: false, daylight: true, rampTop: [-0.6, -0.45] };

  // own random stream, so building the scene doesn't shift anyone else's BK.srand() sequence
  let seed = 90210;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

  const zAt = y => (y - R.backY) / (R.frontY - R.backY);
  const scaleAt = y => BK.depthScale(zAt(y));
  // the cars are parked where the walkout starts, on the far edge of the flat at the foot of the heap
  const TOP = HP.rampTop;
  const GROUND = BK.toScreenY(TOP[1]) + 6;
  const CAR_X = [BK.toScreenX(TOP[0], TOP[1]), BK.toScreenX(1 - TOP[0], TOP[1])];

  const poly = (c, pts) => { c.beginPath(); c.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) c.lineTo(pts[i][0], pts[i][1]); c.closePath(); };
  const rr = (c, x, y, w, h, r) => {
    r = Math.min(r, w / 2, h / 2);
    c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r);
    c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath();
  };
  const ell = (c, x, y, rx, ry) => { c.beginPath(); c.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), 0, 0, Math.PI * 2); };
  const line = (c, pts, col, w) => {
    c.strokeStyle = col; c.lineWidth = w; c.lineCap = 'round'; c.lineJoin = 'round';
    c.beginPath(); c.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) c.lineTo(pts[i][0], pts[i][1]); c.stroke();
  };

  // ---------- the static scene, pre-rendered once ----------
  // heap silhouette, left to right; it fills the back of the picture like in the video
  const HEAP = [[-30, -18], [40, 28], [130, 78], [230, 117], [360, 151], [520, 172], [690, 182], [860, 192], [960, 213],
    [1000, 218], [1030, 200], [1120, 177], [1230, 174], [1300, 190], [1370, 179], [1440, 122], [1520, 52], [1600, -6], [1640, -18]].map(([x, h]) => [x, GROUND - h]);
  const heapTopAt = x => { for (let i = 1; i < HEAP.length; i++) if (x <= HEAP[i][0]) { const [x0, y0] = HEAP[i - 1], [x1, y1] = HEAP[i]; return lerp(y0, y1, (x - x0) / (x1 - x0)); } return GROUND; };
  const S = 1.25;
  const bg = document.createElement('canvas');
  bg.width = W * S; bg.height = H * S;
  (() => {
    const c = bg.getContext('2d');
    c.scale(S, S);
    // flat grey overcast sky
    const sky = c.createLinearGradient(0, 0, 0, GROUND);
    sky.addColorStop(0, '#dcdfe2'); sky.addColorStop(1, '#eceeef');
    c.fillStyle = sky; c.fillRect(0, 0, W, GROUND + 4);
    for (let i = 0; i < 14; i++) { // soft cloud banks
      const x = rnd() * W, y = 10 + rnd() * (GROUND - 160), r = 80 + rnd() * 160;
      const cl = c.createRadialGradient(x, y, 4, x, y, r);
      cl.addColorStop(0, 'rgba(200,204,208,0.35)'); cl.addColorStop(1, 'rgba(200,204,208,0)');
      c.fillStyle = cl; c.fillRect(x - r, y - r, r * 2, r * 2);
    }
    // distant low hills and a line of trees, peeping out either side of the heap
    c.fillStyle = '#7c857d';
    c.beginPath(); c.moveTo(0, GROUND); c.lineTo(0, GROUND - 60); c.quadraticCurveTo(90, GROUND - 76, 200, GROUND - 60); c.lineTo(200, GROUND); c.closePath(); c.fill();
    c.fillStyle = '#3d4a38';
    for (let i = 0; i < 16; i++) {
      const x = 1400 + i * 14 + rnd() * 10, h = 36 + rnd() * 40;
      c.beginPath(); c.moveTo(x - 12, GROUND); c.quadraticCurveTo(x - 10, GROUND - h * 0.7, x, GROUND - h); c.quadraticCurveTo(x + 10, GROUND - h * 0.7, x + 12, GROUND); c.fill();
    }
    // the heap: near-black with a rust-brown cast, lighter where it catches the sky
    const hg = c.createLinearGradient(0, GROUND - 220, 0, GROUND + 18);
    hg.addColorStop(0, '#241917'); hg.addColorStop(0.7, '#2f1f1b'); hg.addColorStop(1, '#3d2821');
    c.fillStyle = hg; poly(c, HEAP); c.fill();
    c.save(); poly(c, HEAP); c.clip();
    for (let i = 0; i < 900; i++) { // loose spoil: specks and clods
      const x = rnd() * W, y = GROUND - 230 + rnd() * 240;
      if (y < heapTopAt(x)) continue;
      c.fillStyle = rnd() < 0.5 ? 'rgba(90,60,48,0.35)' : 'rgba(8,5,4,0.35)';
      c.fillRect(x, y, 1 + rnd() * 3, 1 + rnd() * 2);
    }
    c.strokeStyle = 'rgba(80,52,42,0.25)'; c.lineWidth = 2; // rain runnels down the slope
    for (let i = 0; i < 40; i++) {
      const x = 60 + rnd() * 1480, top = heapTopAt(x) + 6;
      c.beginPath(); c.moveTo(x, top); c.lineTo(x + (rnd() - 0.5) * 30, top + 40 + rnd() * (GROUND - top - 30)); c.stroke();
    }
    const rim = c.createLinearGradient(0, GROUND - 220, 0, GROUND - 100); // the ridge catching the light
    rim.addColorStop(0, 'rgba(140,120,110,0.25)'); rim.addColorStop(1, 'rgba(140,120,110,0)');
    c.strokeStyle = rim; c.lineWidth = 5;
    c.beginPath(); c.moveTo(HEAP[1][0], HEAP[1][1]); for (let i = 2; i < HEAP.length - 1; i++) c.lineTo(HEAP[i][0], HEAP[i][1]); c.stroke();
    c.restore();
    // haze where the heap meets the flat
    const hz = c.createLinearGradient(0, GROUND - 60, 0, GROUND + 20);
    hz.addColorStop(0, 'rgba(200,196,192,0)'); hz.addColorStop(1, 'rgba(200,196,192,0.22)');
    c.fillStyle = hz; c.fillRect(0, GROUND - 60, W, 80);

    // the flat: reddish spoil at the foot of the heap, grey shale gravel across the middle, darker near us
    const gr = c.createLinearGradient(0, GROUND, 0, H);
    gr.addColorStop(0, '#4a2f27'); gr.addColorStop(0.12, '#5a463d'); gr.addColorStop(0.35, '#6d645c'); gr.addColorStop(0.75, '#5e5249'); gr.addColorStop(1, '#4a3a31');
    c.fillStyle = gr; c.fillRect(0, GROUND, W, H - GROUND);
    for (let i = 0; i < 14; i++) { // rust-coloured patches of spoil washed down
      const x = rnd() * W, y = GROUND + 30 + rnd() * (H - GROUND - 30), r = (60 + rnd() * 160) * scaleAt(y);
      c.fillStyle = `rgba(92,48,34,${0.15 + rnd() * 0.15})`; ell(c, x, y, r, r * 0.22); c.fill();
    }
    // the grey concrete pad off to the right, half buried
    c.fillStyle = '#9d9a94';
    poly(c, [[1010, GROUND + 14], [1330, GROUND + 4], [1560, GROUND + 8], [1500, GROUND + 30], [1180, GROUND + 44], [1030, GROUND + 36]]); c.fill();
    c.fillStyle = 'rgba(60,50,45,0.25)'; poly(c, [[1030, GROUND + 36], [1180, GROUND + 44], [1500, GROUND + 30], [1480, GROUND + 38], [1170, GROUND + 50], [1036, GROUND + 42]]); c.fill();
    // gravel: thousands of little stones, bigger nearer the camera
    for (let i = 0; i < 5200; i++) {
      const y = GROUND + Math.pow(rnd(), 0.8) * (H - GROUND), x = rnd() * W, s = scaleAt(y);
      const v = rnd();
      c.fillStyle = v < 0.35 ? 'rgba(170,164,156,0.55)' : v < 0.7 ? 'rgba(30,24,22,0.35)' : 'rgba(120,96,84,0.45)';
      ell(c, x, y, (0.8 + rnd() * 2.2) * s, (0.5 + rnd() * 1.2) * s); c.fill();
    }
    c.strokeStyle = 'rgba(30,22,18,0.18)'; c.lineWidth = 10; // tyre tracks across the flat
    c.beginPath(); c.moveTo(-20, GROUND + 60); c.bezierCurveTo(400, GROUND + 20, 900, GROUND + 50, 1620, GROUND + 20); c.moveTo(-20, GROUND + 78); c.bezierCurveTo(420, GROUND + 38, 900, GROUND + 70, 1620, GROUND + 38); c.stroke();
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
  const SPOTS = [[470, 344], [590, 324], [700, 364], [820, 330], [930, 356], [1040, 326], [1140, 360], [640, 424], [1000, 426],
    [140, 600], [60, 690], [1440, 600], [1540, 680]];
  const CROWD = SPOTS.map(([x, y], i) => Object.assign({ x, y, dir: x < 300 ? 1 : x > 1300 ? -1 : (rnd() < 0.5 ? -1 : 1),
    skin: SKIN[i % SKIN.length], hair: HAIR[Math.floor(rnd() * HAIR.length)], ph: rnd() * 6, cheer: rnd() < 0.6 }, LOOKS[i % LOOKS.length])).sort((a, b) => a.y - b.y);

  function bystander(o, t, ex) {
    const k = scaleAt(o.y) * 0.88, d = o.dir;
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
      if (o) { const k = scaleAt(o.y) * 0.88; HP.flashes.push({ x: o.x + o.dir * 12 * k, y: o.y - 286 * k, t: 0 }); }
    }
    for (const f of HP.flashes) f.t += dt;
    HP.flashes = HP.flashes.filter(f => f.t < 0.15);
  };

  HP.drawBackdrop = (t, excitement) => {
    ctx.fillStyle = '#dcdfe2'; ctx.fillRect(-W, -H, W * 3, H * 3);
    ctx.drawImage(bg, 0, 0, W, H);
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
  HP.drawFrontRow = (t, excitement) => {
    for (const f of FRONT) {
      const y = 874 + Math.sin(f.ph) * 6, up = excitement > 0.3 && f.bang && !f.phone;
      const bob = up ? Math.max(0, Math.sin(t * 9 + f.ph)) * 8 : 0;
      ctx.strokeStyle = f.top; ctx.lineWidth = f.r * 0.55; ctx.lineCap = 'round';
      if (up) {
        ctx.beginPath(); ctx.moveTo(f.x - f.r * 0.8, y + f.r); ctx.lineTo(f.x - f.r * 1.1, y - f.r * 2.2 - bob);
        ctx.moveTo(f.x + f.r * 0.8, y + f.r); ctx.lineTo(f.x + f.r * 1.1, y - f.r * 2.2 + bob); ctx.stroke();
      }
      if (f.phone) {
        const px = f.x + f.r * 0.9, py = y - f.r * 2.1;
        ctx.beginPath(); ctx.moveTo(f.x + f.r * 0.7, y + f.r); ctx.lineTo(px, py + 10); ctx.stroke();
        D.rr(px - 13, py - 24, 26, 44, 4); ctx.fillStyle = '#0b0b0d'; ctx.fill();
        ctx.fillStyle = '#b9c7d8'; ctx.fillRect(px - 10, py - 20, 20, 36);
        ctx.fillStyle = 'rgba(60,50,45,0.7)'; ctx.fillRect(px - 6, py - 6, 12, 14);
      }
      ctx.fillStyle = f.top; ctx.beginPath(); ctx.ellipse(f.x, y + f.r * 1.9, f.r * 1.6, f.r * 1.2, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = f.skin; ell(ctx, f.x, y + f.r * 0.9, f.r * 0.45, f.r * 0.4); ctx.fill(); // neck
      ell(ctx, f.x, y - bob * 0.5, f.r * 0.95, f.r * 1.05); ctx.fill();
      ctx.fillStyle = f.hair; ctx.beginPath(); ctx.ellipse(f.x, y - bob * 0.5 - f.r * 0.1, f.r * 0.97, f.r * 0.95, 0, Math.PI * 0.95, Math.PI * 2.05); ctx.fill();
    }
  };

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
