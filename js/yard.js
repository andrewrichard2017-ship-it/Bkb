// The tyre yard: an outdoor venue out the back of a tyre and exhaust place, at night under floodlights.
// It uses the same ring coordinates as the hall, so the fight, the walkout and the referee play the same;
// only the scenery changes. The posts are stacks of tyres, the ropes are ratchet straps, a handful of
// hooded onlookers stand round the edge, and the fighters walk out of the two workshop shutters.
(() => {
  'use strict';
  const BK = window.BK, ctx = BK.ctx, D = BK.draw, W = BK.W, H = BK.H, R = BK.RING;
  const { lerp, clamp } = BK;
  const YD = BK.VENUES.yard = { flashes: [], open: [0.3, 0.3] };

  // own random stream, so building the yard doesn't shift anyone else's BK.srand() sequence
  let seed = 4242;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

  const zAt = y => (y - R.backY) / (R.frontY - R.backY);
  const scaleAt = y => BK.depthScale(zAt(y));
  // The walkout starts at the top of BK.RAMP; the shutters sit there and the back wall meets the yard just below.
  const GROUND = BK.toScreenY(BK.RAMP.top[1]) + 4;
  const DOOR_X = [BK.toScreenX(BK.RAMP.top[0], BK.RAMP.top[1]), BK.toScreenX(1 - BK.RAMP.top[0], BK.RAMP.top[1])];
  const DOOR_W = 124, DOOR_H = 170, UNIT_EDGE = 310, FENCE_TOP = 104;
  const POLES = [440, 1160], POLE_TOP = 22;

  // ---------- small drawing helpers (take a context, so they work on the pre-rendered layer too) ----------
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

  // A tyre lying flat, seen from the front and a little above. y is its bottom edge.
  function tyreFlat(c, x, y, w, h, stripe) {
    rr(c, x - w / 2, y - h, w, h, h * 0.45); c.fillStyle = '#1d1d1f'; c.fill();
    c.strokeStyle = '#0c0c0d'; c.lineWidth = Math.max(1, w * 0.012);
    c.beginPath();
    for (let i = 1; i < 9; i++) { const tx = x - w / 2 + (w * i) / 9; c.moveTo(tx, y - h * 0.18); c.lineTo(tx, y - h * 0.82); }
    c.stroke();
    if (stripe) { c.fillStyle = stripe; c.fillRect(x - w / 2 + h * 0.3, y - h * 0.58, w - h * 0.6, Math.max(2, h * 0.14)); }
    c.fillStyle = 'rgba(255,255,255,0.07)'; c.fillRect(x - w / 2 + h * 0.4, y - h + 1, w - h * 0.8, Math.max(1, h * 0.1));
  }
  // A stack of flat tyres; returns the y of the top.
  function tyreStack(c, x, y, w, n, h, stripe) {
    for (let i = 0; i < n; i++) tyreFlat(c, x + (i % 2 ? 1 : -1) * w * 0.02, y - i * h * 0.92, w, h, stripe);
    const top = y - (n - 1) * h * 0.92 - h;
    ell(c, x, top + h * 0.12, w * 0.49, h * 0.5); c.fillStyle = '#262628'; c.fill();
    ell(c, x, top + h * 0.14, w * 0.27, h * 0.27); c.fillStyle = '#070707'; c.fill();
    return top;
  }
  // A tyre standing on its tread, face on. y is where it touches the ground.
  function tyreUp(c, x, y, r, rim) {
    const cy = y - r;
    ell(c, x, cy, r, r); c.fillStyle = '#1b1b1d'; c.fill();
    c.strokeStyle = '#2c2c2f'; c.lineWidth = r * 0.08; ell(c, x, cy, r * 0.9, r * 0.9); c.stroke();
    if (rim) {
      ell(c, x, cy, r * 0.56, r * 0.56); c.fillStyle = '#80858b'; c.fill();
      ell(c, x, cy, r * 0.2, r * 0.2); c.fillStyle = '#4a4e53'; c.fill();
    } else { ell(c, x, cy, r * 0.52, r * 0.52); c.fillStyle = '#080808'; c.fill(); }
    c.fillStyle = 'rgba(255,255,255,0.06)';
    c.beginPath(); c.arc(x, cy, r * 0.95, Math.PI * 1.1, Math.PI * 1.6); c.arc(x, cy, r * 0.75, Math.PI * 1.6, Math.PI * 1.1, true); c.fill();
  }

  // ---------- the static yard, pre-rendered once ----------
  const S = 1.25;
  const bg = document.createElement('canvas');
  bg.width = W * S; bg.height = H * S;
  (() => {
    const c = bg.getContext('2d');
    c.scale(S, S);
    // night sky with a sodium glow low down
    const sky = c.createLinearGradient(0, 0, 0, GROUND);
    sky.addColorStop(0, '#0d1119'); sky.addColorStop(0.55, '#1e2430'); sky.addColorStop(1, '#4a3f3a');
    c.fillStyle = sky; c.fillRect(0, 0, W, GROUND + 2);
    const moon = c.createRadialGradient(1020, 44, 4, 1020, 44, 60);
    moon.addColorStop(0, 'rgba(230,228,215,0.9)'); moon.addColorStop(0.25, 'rgba(230,228,215,0.25)'); moon.addColorStop(1, 'rgba(230,228,215,0)');
    c.fillStyle = moon; c.fillRect(960, 0, 120, 110);
    // rooftops over the back fence, a few lights still on
    c.fillStyle = '#10131a';
    poly(c, [[860, GROUND], [860, 92], [930, 70], [1000, 92], [1000, 84], [1090, 84], [1090, 60], [1140, 60], [1140, 88], [1240, 76], [1300, 92], [1300, GROUND]]); c.fill();
    c.fillStyle = 'rgba(255,196,110,0.55)';
    for (const [x, y] of [[902, 96], [1030, 98], [1104, 72], [1112, 92], [1210, 98]]) c.fillRect(x, y, 7, 9);
    // mountain of scrap tyres behind the fence
    c.fillStyle = '#121214';
    c.beginPath(); c.moveTo(430, GROUND); c.quadraticCurveTo(470, 60, 640, 48); c.quadraticCurveTo(800, 44, 880, 120); c.lineTo(900, GROUND); c.closePath(); c.fill();
    for (let i = 0; i < 38; i++) {
      const x = 470 + rnd() * 400, y = 70 + rnd() * 70, r = 9 + rnd() * 9;
      if (y < 44 + Math.abs(x - 660) * 0.22) continue;
      c.strokeStyle = 'rgba(70,70,76,0.5)'; c.lineWidth = 3; ell(c, x, y, r, r * (0.35 + rnd() * 0.6)); c.stroke();
    }

    // palisade fence between the two workshop units
    c.fillStyle = '#26302d'; c.fillRect(UNIT_EDGE, 124, W - UNIT_EDGE * 2, 6); c.fillRect(UNIT_EDGE, 170, W - UNIT_EDGE * 2, 6);
    for (let x = UNIT_EDGE + 4; x < W - UNIT_EDGE; x += 17) {
      c.fillStyle = (Math.floor(x / 17) % 5) ? '#35423e' : '#2c3834';
      poly(c, [[x, GROUND], [x, FENCE_TOP + 8], [x + 3, FENCE_TOP], [x + 6, FENCE_TOP + 6], [x + 9, FENCE_TOP], [x + 12, FENCE_TOP + 8], [x + 12, GROUND]]); c.fill();
    }

    // the two workshop units, each with a roller shutter at the top of a walkout path
    for (const side of [0, 1]) {
      const x0 = side ? W - UNIT_EDGE : -20, x1 = side ? W + 20 : UNIT_EDGE;
      c.fillStyle = '#3f4955'; c.fillRect(x0, -20, x1 - x0, GROUND + 20);
      for (let x = x0; x < x1; x += 11) { c.fillStyle = 'rgba(255,255,255,0.05)'; c.fillRect(x, -20, 3, GROUND + 20); c.fillStyle = 'rgba(0,0,0,0.18)'; c.fillRect(x + 6, -20, 3, GROUND + 20); }
      const grime = c.createLinearGradient(0, GROUND - 60, 0, GROUND);
      grime.addColorStop(0, 'rgba(20,16,12,0)'); grime.addColorStop(1, 'rgba(20,16,12,0.55)');
      c.fillStyle = grime; c.fillRect(x0, GROUND - 60, x1 - x0, 60);
      c.fillStyle = '#5a5751'; c.fillRect(x0, GROUND - 16, x1 - x0, 16); // block plinth
      c.fillStyle = '#23292f'; c.fillRect(side ? x0 : x1 - 12, -20, 12, GROUND + 20); // corner post
      // door frame (the shutter itself is drawn live)
      const dx = DOOR_X[side];
      c.fillStyle = '#262a2e'; c.fillRect(dx - DOOR_W / 2 - 8, GROUND - DOOR_H - 10, DOOR_W + 16, DOOR_H + 10);
      // sign board
      const sx = side ? W - UNIT_EDGE + 12 : 168;
      rr(c, sx, 34, 130, 86, 4); c.fillStyle = '#e9e3d2'; c.fill(); c.strokeStyle = '#1b1b1b'; c.lineWidth = 3; c.stroke();
      c.fillStyle = side ? '#23386b' : '#b3202a'; c.fillRect(sx + 6, 40, 118, 8); c.fillRect(sx + 6, 106, 118, 8);
      // oil streak and rust under the sign
      c.fillStyle = 'rgba(96,56,30,0.35)'; c.fillRect(sx + 20, 120, 4, 26); c.fillRect(sx + 96, 120, 3, 18);
    }

    // the yard: wet tarmac
    const gr = c.createLinearGradient(0, GROUND, 0, H);
    gr.addColorStop(0, '#2b2a28'); gr.addColorStop(0.4, '#3a3834'); gr.addColorStop(1, '#46423c');
    c.fillStyle = gr; c.fillRect(0, GROUND, W, H - GROUND);
    for (let i = 0; i < 260; i++) { // grit
      const y = GROUND + rnd() * (H - GROUND), x = rnd() * W;
      c.fillStyle = rnd() < 0.5 ? 'rgba(0,0,0,0.18)' : 'rgba(255,255,255,0.05)';
      c.fillRect(x, y, 2 + rnd() * 3 * scaleAt(y), 1 + rnd() * 2);
    }
    // faded yellow bay lines and tyre tracks
    c.strokeStyle = 'rgba(210,180,60,0.22)'; c.lineWidth = 5;
    c.beginPath(); c.moveTo(10, 250); c.lineTo(290, 250); c.moveTo(1310, 250); c.lineTo(1590, 250); c.stroke();
    c.strokeStyle = 'rgba(0,0,0,0.16)'; c.lineWidth = 14;
    c.beginPath(); c.moveTo(560, GROUND + 6); c.bezierCurveTo(700, 260, 1050, 280, 1250, GROUND + 10);
    c.moveTo(600, GROUND + 6); c.bezierCurveTo(740, 280, 1030, 300, 1290, GROUND + 14); c.stroke();
    // puddles catching the floodlights, and oil stains
    for (const [x, y, rx] of [[620, 262, 90], [1040, 290, 70], [190, 700, 100], [1430, 760, 110], [780, 845, 150]]) {
      const pg = c.createLinearGradient(0, y - rx * 0.12, 0, y + rx * 0.12);
      pg.addColorStop(0, 'rgba(150,160,175,0.28)'); pg.addColorStop(1, 'rgba(40,46,56,0.35)');
      c.fillStyle = pg; ell(c, x, y, rx, rx * 0.12); c.fill();
      c.fillStyle = 'rgba(255,225,170,0.25)'; ell(c, x - rx * 0.2, y - rx * 0.02, rx * 0.35, rx * 0.025); c.fill();
    }
    for (let i = 0; i < 14; i++) {
      const x = rnd() * W, y = GROUND + 30 + rnd() * (H - GROUND - 30), r = (18 + rnd() * 40) * scaleAt(y);
      c.fillStyle = 'rgba(8,8,10,0.28)'; ell(c, x, y, r, r * 0.3); c.fill();
    }
    c.strokeStyle = 'rgba(0,0,0,0.3)'; c.lineWidth = 1.5; // cracks
    for (let i = 0; i < 10; i++) {
      let x = rnd() * W, y = GROUND + 20 + rnd() * (H - GROUND - 20);
      c.beginPath(); c.moveTo(x, y);
      for (let j = 0; j < 5; j++) { x += (rnd() - 0.5) * 60; y += rnd() * 12; c.lineTo(x, y); }
      c.stroke();
    }
    const bench = () => { // workbench against the fence, tools hung on a pegboard above it
      rr(c, 588, 126, 170, 62, 3); c.fillStyle = '#7d6446'; c.fill();
      c.fillStyle = 'rgba(0,0,0,0.35)';
      for (let x = 596; x < 752; x += 10) for (let y = 132; y < 184; y += 10) c.fillRect(x, y, 2, 2);
      line(c, [[606, 140], [606, 176]], '#a4aab0', 4); ell(c, 606, 138, 5, 5); c.strokeStyle = '#a4aab0'; c.lineWidth = 3; c.stroke();
      line(c, [[622, 138], [622, 178]], '#a4aab0', 4); line(c, [[636, 140], [636, 172]], '#a4aab0', 3);
      line(c, [[656, 142], [656, 180]], '#5e3b22', 5); c.fillStyle = '#6d7277'; c.fillRect(648, 136, 18, 9); // hammer
      line(c, [[684, 136], [720, 176]], '#8d9298', 4); line(c, [[720, 136], [684, 176]], '#8d9298', 4); // wheel brace
      line(c, [[736, 138], [740, 178]], '#c23a2a', 6); // pry bar
      c.fillStyle = '#5b4128'; c.fillRect(580, 200, 186, 10); c.fillRect(588, 210, 8, 26); c.fillRect(750, 210, 8, 26);
      c.fillStyle = '#4a3521'; c.fillRect(592, 224, 164, 5);
      c.fillStyle = '#5d6166'; c.fillRect(584, 190, 22, 10); c.fillRect(578, 184, 10, 16); // vice
      rr(c, 690, 176, 54, 24, 3); c.fillStyle = '#a82a22'; c.fill(); c.fillStyle = '#6e1a15'; c.fillRect(690, 186, 54, 2);
      c.fillStyle = '#c9c9c9'; c.fillRect(708, 172, 18, 4);
      line(c, [[640, 199], [676, 196]], '#9aa0a6', 4); // spanner left on the bench
    };
    const changer = () => { // tyre changing machine
      c.fillStyle = '#8e2a22'; rr(c, 476, 192, 58, 36, 4); c.fill();
      c.fillStyle = '#5d1a15'; c.fillRect(476, 206, 58, 3);
      c.fillStyle = '#6e7278'; c.fillRect(526, 132, 8, 62); c.fillRect(496, 132, 36, 7); c.fillRect(498, 139, 5, 26);
      tyreFlat(c, 505, 192, 60, 15);
      ell(c, 505, 179, 18, 4); c.fillStyle = '#8b9095'; c.fill();
    };
    const drums = () => {
      for (const [x, y, col] of [[800, 234, '#27427a'], [846, 238, '#27427a'], [823, 246, '#7a2a1f']]) {
        rr(c, x - 20, y - 56, 40, 56, 4); c.fillStyle = col; c.fill();
        c.fillStyle = 'rgba(0,0,0,0.25)'; c.fillRect(x - 20, y - 40, 40, 3); c.fillRect(x - 20, y - 18, 40, 3);
        c.fillStyle = 'rgba(255,255,255,0.12)'; c.fillRect(x - 14, y - 54, 5, 52);
        ell(c, x, y - 56, 20, 5); c.fillStyle = BK.shade(col, 1.25); c.fill();
      }
    };
    const pallets = () => {
      c.fillStyle = '#7a6448';
      for (let i = 0; i < 3; i++) {
        const x = 890 + i * 26;
        poly(c, [[x, 230], [x + 22, 128], [x + 48, 128], [x + 26, 230]]); c.fill();
        c.strokeStyle = 'rgba(0,0,0,0.3)'; c.lineWidth = 2;
        c.beginPath(); for (let k = 1; k < 5; k++) { const t = k / 5; c.moveTo(lerp(x, x + 22, t), lerp(230, 128, t)); c.lineTo(lerp(x + 26, x + 48, t), lerp(230, 128, t)); } c.stroke();
      }
    };
    const compressor = () => {
      rr(c, 1080, 200, 76, 28, 14); c.fillStyle = '#b3312a'; c.fill();
      c.fillStyle = 'rgba(255,255,255,0.14)'; c.fillRect(1090, 204, 56, 4);
      c.fillStyle = '#3b3f44'; c.fillRect(1096, 182, 34, 20); c.fillStyle = '#25282c'; c.fillRect(1100, 186, 26, 3);
      ell(c, 1086, 230, 6, 6); c.fillStyle = '#111'; c.fill(); ell(c, 1150, 230, 6, 6); c.fill();
      c.strokeStyle = '#d6b21f'; c.lineWidth = 3;
      for (let i = 0; i < 3; i++) { ell(c, 1172, 214, 14 - i * 3, 9 - i * 2); c.stroke(); }
    };
    const poles = () => {
      for (const x of POLES) {
        c.fillStyle = '#1b1d20'; c.fillRect(x - 5, POLE_TOP, 10, 228 - POLE_TOP);
        c.fillStyle = '#26292d'; c.fillRect(x - 12, 222, 24, 8);
        c.fillStyle = '#1b1d20'; c.fillRect(x - 34, POLE_TOP - 2, 68, 6);
        for (const o of [-22, 22]) { rr(c, x + o - 13, POLE_TOP - 16, 26, 18, 3); c.fillStyle = '#2a2d31'; c.fill(); c.fillStyle = '#fff3d4'; c.fillRect(x + o - 10, POLE_TOP - 2, 20, 4); }
      }
    };
    // along the fence, back to front
    tyreStack(c, 332, 212, 64, 5, 19, null); tyreStack(c, 378, 224, 64, 3, 19, null);
    tyreStack(c, 1238, 214, 64, 6, 19, null); tyreStack(c, 1284, 226, 64, 3, 19, null);
    poles(); changer(); bench(); pallets();
    for (let i = 0; i < 5; i++) tyreUp(c, 978 + i * 22, 232, 27, i === 2);
    compressor(); drums();
    // walkout lanes: a line of tyres down each side from the shutter to the corner
    for (const side of [0, 1]) {
      const m = u => (side === 0 ? u : 1 - u);
      const ax = BK.toScreenX(m(BK.RAMP.top[0]), BK.RAMP.top[1]), ay = GROUND;
      const bx = BK.toScreenX(m(BK.RAMP.bottom[0]), BK.RAMP.bottom[1]), by = BK.toScreenY(BK.RAMP.bottom[1]);
      const L = Math.hypot(bx - ax, by - ay), px = -(by - ay) / L, py = (bx - ax) / L;
      for (const k of [0.16, 0.38, 0.6, 0.8]) {
        const x = lerp(ax, bx, k), y = lerp(ay, by, k), s = scaleAt(y);
        for (const sg of [-1, 1]) tyreStack(c, x + sg * px * 78 * s, y + sg * py * 78 * s, 58 * s, sg * (side ? -1 : 1) > 0 ? 2 : 1, 17 * s, null);
      }
    }
    // big piles out at each side, a roll cab and a trolley jack
    tyreStack(c, 42, 440, 74, 8, 22, null); tyreStack(c, 108, 474, 70, 3, 21, null);
    tyreStack(c, W - 42, 440, 74, 8, 22, null); tyreStack(c, W - 108, 474, 70, 3, 21, null);
    tyreUp(c, 70, 520, 36, true);
    rr(c, 150, 468, 76, 70, 4); c.fillStyle = '#9b2b24'; c.fill();
    c.fillStyle = '#5e1914'; for (let i = 0; i < 4; i++) c.fillRect(150, 482 + i * 14, 76, 2);
    c.fillStyle = '#c8cbcf'; for (let i = 0; i < 4; i++) c.fillRect(176, 474 + i * 14, 24, 3);
    c.fillStyle = '#111'; ell(c, 158, 541, 5, 4); c.fill(); ell(c, 218, 541, 5, 4); c.fill();
    c.fillStyle = '#b3302a'; rr(c, 206, 598, 92, 16, 4); c.fill();
    c.fillStyle = '#6a6e73'; c.fillRect(284, 588, 16, 12);
    line(c, [[214, 602], [168, 540]], '#b3302a', 6);
    c.fillStyle = '#111'; ell(c, 216, 616, 7, 5); c.fill(); ell(c, 288, 616, 7, 5); c.fill();
    line(c, [[1330, 836], [1404, 812]], '#8d9298', 6); line(c, [[1352, 806], [1382, 842]], '#8d9298', 6); // wheel brace dropped on the floor
  })();

  // ---------- onlookers, hoods up ----------
  const HOODS = ['#6d6e72', '#1f2024', '#2a3350', '#4b4f38', '#512a2e', '#3b3d43', '#595046', '#1f2a24'];
  const LEGS = ['#2a2b2f', '#4a4c52', '#1c1d20', '#33405a', '#3a3a3a'];
  const SPOTS = [[522, 332], [612, 306], [694, 356], [800, 318], [906, 348], [988, 302], [1072, 338], [622, 412], [982, 414],
    [124, 620], [58, 700], [1402, 616], [1532, 650]];
  const CROWD = SPOTS.map(([x, y], i) => ({
    x, y, dir: x < 300 ? 1 : x > 1300 ? -1 : (rnd() < 0.5 ? -1 : 1), hood: HOODS[i % HOODS.length], legs: LEGS[Math.floor(rnd() * LEGS.length)],
    ph: rnd() * 6, phone: rnd() < 0.3, cheer: rnd() < 0.65, pockets: rnd() < 0.5,
  }));
  const BARREL = { x: 1468, y: 566, barrel: true };
  const BACK_ITEMS = CROWD.concat([BARREL]).sort((a, b) => a.y - b.y);

  function hooded(o, t, ex) {
    const k = scaleAt(o.y) * 0.88, fog = 0.5 + 0.5 * clamp((o.y - GROUND) / 500, 0, 1);
    const hype = o.cheer && ex > 0.35;
    const hop = hype ? Math.max(0, Math.sin(t * 7 + o.ph)) * 12 * ex : 0;
    const sway = Math.sin(t * 1.4 + o.ph) * 2;
    const hood = BK.shade(o.hood, fog), legs = BK.shade(o.legs, fog), dark = BK.shade(o.hood, fog * 0.72);
    ctx.fillStyle = 'rgba(0,0,0,0.3)'; ell(ctx, o.x, o.y, 34 * k, 7 * k); ctx.fill();
    ctx.save(); ctx.translate(o.x, o.y - hop * k); ctx.scale(k, k);
    const d = o.dir;
    ctx.fillStyle = legs; rr(ctx, -21, -132, 19, 130, 8); ctx.fill(); rr(ctx, 2, -132, 19, 130, 8); ctx.fill();
    ctx.fillStyle = BK.shade('#d9d5cc', fog); ell(ctx, -12 + d * 3, -3, 14, 6); ctx.fill(); ell(ctx, 12 + d * 3, -3, 14, 6); ctx.fill();
    ctx.save(); ctx.rotate(sway * 0.01);
    rr(ctx, -40, -240, 80, 118, 26); ctx.fillStyle = hood; ctx.fill();
    ctx.fillStyle = dark; rr(ctx, -22, -170, 44, 26, 8); ctx.fill(); ctx.fillRect(-40, -130, 80, 8);
    const sl = 19, S = [-34, -224], S2 = [34, -224];
    const arm = (sh, el, hd) => { line(ctx, [sh, el, hd], hood, sl); ctx.fillStyle = BK.shade('#b07f62', fog * 0.85); ell(ctx, hd[0], hd[1], 7, 7); ctx.fill(); };
    const pump = Math.sin(t * 7 + o.ph) * 10;
    if (hype) { arm(S, [-54, -276], [-44, -324 + pump]); arm(S2, [54, -276], [44, -324 - pump]); }
    else if (o.pockets) { line(ctx, [S, [-44, -182], [-14, -158]], hood, sl); line(ctx, [S2, [44, -182], [14, -158]], hood, sl); }
    else { arm(S, [-44, -178], [-42, -130]); arm(S2, [44, -178], [42, -130]); }
    if (o.phone && !hype) { // filming it, phone up at face height
      const hx = d * 18;
      arm(d > 0 ? S2 : S, [d * 46, -236], [hx, -266]);
      ctx.fillStyle = '#0d0e10'; rr(ctx, hx - 9, -296, 18, 32, 3); ctx.fill();
      if (Math.sin(t * 3 + o.ph) > 0.2) { ctx.fillStyle = '#fffbe8'; ell(ctx, hx - 4, -290, 2.2, 2.2); ctx.fill(); }
    }
    // hood up, face in shadow
    ctx.fillStyle = hood; ell(ctx, 0, -266, 30, 35); ctx.fill();
    poly(ctx, [[-10, -296], [0, -304], [10, -296]]); ctx.fill();
    ctx.fillStyle = '#0c0a09'; ell(ctx, d * 3, -259, 17, 22); ctx.fill();
    ctx.fillStyle = BK.shade('#7a5240', fog * 0.8); ell(ctx, d * 3, -242, 10, 5); ctx.fill();
    line(ctx, [[-7, -238], [-9, -212]], BK.shade('#d9d5cc', fog), 2); line(ctx, [[7, -238], [9, -212]], BK.shade('#d9d5cc', fog), 2);
    ctx.fillStyle = 'rgba(255,236,200,0.1)'; ell(ctx, -d * 14, -276, 10, 22); ctx.fill(); // floodlight catching the hood
    ctx.restore();
    ctx.restore();
  }

  // oil drum with a fire going in it
  function barrel(o, t) {
    const k = scaleAt(o.y) * 0.95, x = o.x, y = o.y;
    const glow = ctx.createRadialGradient(x, y - 90 * k, 10, x, y - 90 * k, 220 * k);
    glow.addColorStop(0, 'rgba(255,150,60,0.28)'); glow.addColorStop(1, 'rgba(255,150,60,0)');
    ctx.fillStyle = glow; ctx.fillRect(x - 220 * k, y - 310 * k, 440 * k, 440 * k);
    ctx.fillStyle = 'rgba(0,0,0,0.3)'; ell(ctx, x, y, 38 * k, 8 * k); ctx.fill();
    rr(ctx, x - 30 * k, y - 90 * k, 60 * k, 90 * k, 5 * k); ctx.fillStyle = '#5a3322'; ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.fillRect(x - 30 * k, y - 64 * k, 60 * k, 4 * k); ctx.fillRect(x - 30 * k, y - 30 * k, 60 * k, 4 * k);
    ctx.fillStyle = 'rgba(255,150,70,0.35)'; ctx.fillRect(x - 24 * k, y - 88 * k, 8 * k, 84 * k);
    ell(ctx, x, y - 90 * k, 30 * k, 7 * k); ctx.fillStyle = '#1a0e08'; ctx.fill();
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 5; i++) {
      const fx = x + (i - 2) * 9 * k + Math.sin(t * 9 + i * 2) * 4 * k, fh = (40 + 26 * Math.abs(Math.sin(t * 6.3 + i * 1.7))) * k;
      ctx.fillStyle = i % 2 ? 'rgba(255,190,70,0.55)' : 'rgba(255,110,40,0.5)';
      ctx.beginPath(); ctx.moveTo(fx - 10 * k, y - 90 * k); ctx.quadraticCurveTo(fx - 8 * k, y - 90 * k - fh * 0.6, fx, y - 90 * k - fh);
      ctx.quadraticCurveTo(fx + 8 * k, y - 90 * k - fh * 0.6, fx + 10 * k, y - 90 * k); ctx.closePath(); ctx.fill();
    }
    for (let i = 0; i < 4; i++) { // embers
      const p = (t * 0.6 + i * 0.27) % 1;
      ctx.fillStyle = `rgba(255,170,80,${0.8 * (1 - p)})`;
      ell(ctx, x + Math.sin(t * 2 + i * 3) * 18 * k, y - (100 + p * 160) * k, 2 * k, 2 * k); ctx.fill();
    }
    ctx.restore();
  }

  // ---------- roller shutters: up for whoever is walking out, amber beacon going ----------
  const wo = () => BK.walkout;
  const doorLit = side => { const w = wo(); return !!(w && w.active && w.phase === (side === 0 ? 'red' : 'blue')); };
  function doorTarget(side) {
    const w = wo();
    if (!w || !w.active) return 0.35;
    if (doorLit(side)) return 1;
    // blue's shutter starts up as red reaches the ring, so he's never stood waiting in front of a closed door
    if (side === 1 && w.phase === 'red' && w.t > 4.2) return 1;
    return side === 0 ? 0.35 : 0.05;
  }
  function drawDoor(side, t) {
    const x = DOOR_X[side], top = GROUND - DOOR_H, l = x - DOOR_W / 2, open = YD.open[side], lit = doorLit(side);
    // inside the workshop
    const ins = ctx.createLinearGradient(0, top, 0, GROUND);
    ins.addColorStop(0, lit ? '#5b4630' : '#1a1512'); ins.addColorStop(1, lit ? '#a37a4a' : '#2a2119');
    ctx.fillStyle = ins; ctx.fillRect(l, top, DOOR_W, DOOR_H);
    ctx.fillStyle = 'rgba(0,0,0,0.5)'; // a ramp and a stack of tyres inside
    ctx.fillRect(l + 8, GROUND - 26, DOOR_W * 0.5, 4);
    for (let i = 0; i < 3; i++) { rr(ctx, l + DOOR_W - 44, GROUND - 16 - i * 14, 36, 13, 6); ctx.fill(); }
    if (lit) {
      const bl = ctx.createRadialGradient(x, GROUND - DOOR_H * 0.45, 5, x, GROUND - DOOR_H * 0.45, DOOR_H);
      bl.addColorStop(0, 'rgba(255,225,170,0.55)'); bl.addColorStop(1, 'rgba(255,225,170,0)');
      ctx.fillStyle = bl; ctx.fillRect(x - DOOR_H, top - 40, DOOR_H * 2, DOOR_H + 120);
      for (let i = 0; i < 5; i++) { // exhaust haze rolling out of the door
        const sx = x + Math.sin(t * 0.7 + i * 1.7) * DOOR_W * 0.5 + i * 14 * (side ? -1 : 1), sy = GROUND - 12 - i * 8;
        const sm = ctx.createRadialGradient(sx, sy, 2, sx, sy, 70);
        sm.addColorStop(0, 'rgba(210,205,195,0.2)'); sm.addColorStop(1, 'rgba(210,205,195,0)');
        ctx.fillStyle = sm; ctx.fillRect(sx - 90, sy - 90, 180, 180);
      }
    }
    // shutter slats from the top down to however far it's open
    const sh = DOOR_H * (1 - open);
    ctx.fillStyle = '#6d747b'; ctx.fillRect(l, top, DOOR_W, sh);
    ctx.fillStyle = 'rgba(0,0,0,0.28)';
    for (let y = top + 6; y < top + sh; y += 8) ctx.fillRect(l, y, DOOR_W, 2);
    if (sh > 6) { ctx.fillStyle = '#3c4146'; ctx.fillRect(l, top + sh - 6, DOOR_W, 6); }
    ctx.fillStyle = '#2e3236'; ctx.fillRect(l - 6, top - 14, DOOR_W + 12, 16); // roller box
    // amber beacon over the door
    const on = lit ? 0.5 + 0.5 * Math.sin(t * 14) : 0;
    rr(ctx, x - 9, top - 30, 18, 16, 6); ctx.fillStyle = on > 0 ? `rgb(${200 + 55 * on | 0},${120 + 60 * on | 0},30)` : '#6e4a1c'; ctx.fill();
    if (lit) {
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      const bg2 = ctx.createRadialGradient(x, top - 22, 2, x, top - 22, 90);
      bg2.addColorStop(0, `rgba(255,170,40,${0.5 * on})`); bg2.addColorStop(1, 'rgba(255,170,40,0)');
      ctx.fillStyle = bg2; ctx.fillRect(x - 90, top - 112, 180, 180);
      ctx.restore();
    }
    ctx.fillStyle = side ? '#4d74d6' : '#e0404a'; ctx.globalAlpha = lit ? 1 : 0.55;
    ctx.fillRect(l - 6, top - 2, 6, DOOR_H + 2); ctx.fillRect(l + DOOR_W, top - 2, 6, DOOR_H + 2); // corner-coloured tape down the frame
    ctx.globalAlpha = 1;
  }

  YD.update = (dt, excitement) => {
    for (const side of [0, 1]) YD.open[side] += (doorTarget(side) - YD.open[side]) * (1 - Math.pow(0.03, dt));
    // phones going off in the crowd
    if (Math.random() < (0.3 + excitement * 3) * dt) {
      const o = BK.pick(CROWD);
      YD.flashes.push({ x: o.x + o.dir * 18 * scaleAt(o.y) * 0.88, y: o.y - 290 * scaleAt(o.y) * 0.88, t: 0 });
    }
    for (const f of YD.flashes) f.t += dt;
    YD.flashes = YD.flashes.filter(f => f.t < 0.15);
  };

  YD.drawBackdrop = (t, excitement) => {
    ctx.fillStyle = '#0d1119'; ctx.fillRect(-W, -H, W * 3, H * 3);
    ctx.drawImage(bg, 0, 0, W, H);
    for (const side of [0, 1]) {
      const sx = side ? W - UNIT_EDGE + 12 : 168;
      D.text('TYRES', sx + 65, 70, BK.FONT.display(34), '#1b1b1b');
      D.text(side ? 'PUNCTURES' : 'PART WORN', sx + 65, 97, BK.FONT.ui(18), '#3a2a22');
      drawDoor(side, t);
    }
    for (const o of BACK_ITEMS) { if (o.barrel) barrel(o, t); else hooded(o, t, excitement); }
    for (const f of YD.flashes) {
      const a = 1 - f.t / 0.15, g = ctx.createRadialGradient(f.x, f.y, 0, f.x, f.y, 30);
      g.addColorStop(0, `rgba(255,255,255,${a})`); g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g; ctx.fillRect(f.x - 30, f.y - 30, 60, 60);
    }
  };

  // ---------- the fighting area: a concrete pad marked out in spray paint ----------
  const STAINS = [];
  for (let i = 0; i < 16; i++) STAINS.push({ u: 0.08 + rnd() * 0.84, z: 0.06 + rnd() * 0.88, r: 16 + rnd() * 44, a: 0.08 + rnd() * 0.12 });
  const pad = () => D.poly([[R.backL, R.backY], [R.backR, R.backY], [R.frontR, R.frontY], [R.frontL, R.frontY]]);
  YD.drawRing = () => {
    // the pad sits a little proud of the yard
    ctx.fillStyle = '#23211e';
    D.poly([[R.backL - 10, R.backY - 3], [R.backR + 10, R.backY - 3], [R.backR + 10, R.backY + 8], [R.backL - 10, R.backY + 8]]); ctx.fill();
    ctx.fillStyle = '#2b2824';
    D.poly([[R.frontL - 8, R.frontY], [R.frontR + 8, R.frontY], [R.frontR + 14, R.frontY + 16], [R.frontL - 14, R.frontY + 16]]); ctx.fill();
    const fl = ctx.createLinearGradient(0, R.backY, 0, R.frontY);
    fl.addColorStop(0, '#6f6a61'); fl.addColorStop(1, '#948c7e');
    ctx.fillStyle = fl; pad(); ctx.fill();
    ctx.save(); pad(); ctx.clip();
    for (const s of STAINS) {
      const x = BK.toScreenX(s.u, s.z), y = BK.toScreenY(s.z), k = BK.depthScale(s.z);
      ctx.fillStyle = `rgba(20,18,16,${s.a})`; ell(ctx, x, y, s.r * k, s.r * k * 0.3); ctx.fill();
    }
    ctx.strokeStyle = 'rgba(0,0,0,0.18)'; ctx.lineWidth = 2; // expansion joints
    ctx.beginPath();
    for (const u of [0.25, 0.5, 0.75]) { ctx.moveTo(BK.toScreenX(u, 0), R.backY); ctx.lineTo(BK.toScreenX(u, 1), R.frontY); }
    ctx.moveTo(BK.ringL(0.5), BK.toScreenY(0.5)); ctx.lineTo(BK.ringR(0.5), BK.toScreenY(0.5));
    ctx.stroke();
    const pool = ctx.createRadialGradient(W / 2, 600, 40, W / 2, 600, 640);
    pool.addColorStop(0, 'rgba(255,238,200,0.26)'); pool.addColorStop(1, 'rgba(255,238,200,0)');
    ctx.fillStyle = pool; ctx.fillRect(0, R.backY, W, R.frontY - R.backY);
    ctx.restore();
    // sprayed boundary and centre mark
    ctx.strokeStyle = 'rgba(236,232,220,0.5)'; ctx.lineWidth = 5; ctx.lineJoin = 'round';
    const ins = (u, z) => [BK.toScreenX(u, z), BK.toScreenY(z)];
    D.poly([ins(0.03, 0.04), ins(0.97, 0.04), ins(0.97, 0.97), ins(0.03, 0.97)]); ctx.stroke();
    ctx.strokeStyle = 'rgba(179,32,42,0.5)'; ctx.lineWidth = 7;
    ctx.beginPath(); ctx.ellipse(W / 2, 620, 150, 44, 0, 0, Math.PI * 2); ctx.stroke();
    ctx.save(); ctx.translate(W / 2, 620); ctx.scale(1, 0.32);
    D.text('BKB', 0, 0, BK.FONT.display(80), 'rgba(179,32,42,0.5)');
    ctx.restore();
    // stencilled on the tarmac out front
    ctx.save(); ctx.translate(W / 2, R.frontY + 62); ctx.scale(1, 0.55);
    D.text('BARE  KNUCKLE', 0, 0, BK.FONT.display(60), 'rgba(236,232,220,0.3)');
    ctx.restore();
  };

  // ---------- posts are stacks of tyres, ropes are ratchet straps ----------
  const POST_H_FRONT = 170, POST_H_BACK = 128;
  const STRAPS = [['#e2a51c', 0.34], ['#d9d3c2', 0.6], ['#dd6b1f', 0.86]];
  const corner = (u, z, stripe) => ({ x: BK.toScreenX(u, z), y: BK.toScreenY(z), h: lerp(POST_H_BACK, POST_H_FRONT, z), z, stripe });
  const C = { bl: corner(0, 0, '#c8303a'), br: corner(1, 0, '#3d5fb0'), fl: corner(0, 1, '#d9d3c2'), fr: corner(1, 1, '#d9d3c2') };
  function post(c) {
    const n = 6, h = (c.h + 8) / (n * 0.92), w = h * 3;
    ctx.fillStyle = 'rgba(0,0,0,0.35)'; ell(ctx, c.x, c.y + 4, w * 0.6, h * 0.35); ctx.fill();
    tyreStack(ctx, c.x, c.y + h * 0.35, w, n, h, c.stripe);
  }
  function strap(a, b, frac, color, w) {
    const sag = 9, ax = a.x, ay = a.y - a.h * frac, bx = b.x, by = b.y - b.h * frac;
    ctx.lineCap = 'butt';
    ctx.strokeStyle = BK.PAL.ink; ctx.lineWidth = w + 3;
    ctx.beginPath(); ctx.moveTo(ax, ay); ctx.quadraticCurveTo((ax + bx) / 2, (ay + by) / 2 + sag, bx, by); ctx.stroke();
    ctx.strokeStyle = color; ctx.lineWidth = w;
    ctx.beginPath(); ctx.moveTo(ax, ay); ctx.quadraticCurveTo((ax + bx) / 2, (ay + by) / 2 + sag, bx, by); ctx.stroke();
    ctx.lineCap = 'round';
  }
  YD.drawBackRopes = () => {
    post(C.bl); post(C.br);
    for (const [col, f] of STRAPS) { strap(C.bl, C.br, f, col, 5); strap(C.bl, C.fl, f, col, 6); strap(C.br, C.fr, f, col, 6); }
  };
  YD.drawFrontRopes = () => {
    post(C.fl); post(C.fr);
    for (const [col, f] of STRAPS) strap(C.fl, C.fr, f, col, 7);
  };

  // Hooded lads along the front, backs to us, a couple filming on their phones.
  const FRONT = [];
  for (let i = 0; i < 12; i++) {
    const left = i < 6, j = i % 6;
    FRONT.push({ x: left ? 50 + j * 96 + rnd() * 24 : 1090 + j * 96 + rnd() * 24, r: 30 + rnd() * 8, ph: rnd() * 6,
      bang: rnd() < 0.6, phone: rnd() < 0.3, hood: BK.shade(HOODS[Math.floor(rnd() * HOODS.length)], 0.45) });
  }
  YD.drawFrontRow = (t, excitement) => {
    for (const f of FRONT) {
      const y = 874 + Math.sin(f.ph) * 6, up = excitement > 0.3 && f.bang && !f.phone;
      const bob = up ? Math.max(0, Math.sin(t * 9 + f.ph)) * 8 : 0;
      ctx.strokeStyle = f.hood; ctx.lineWidth = f.r * 0.55; ctx.lineCap = 'round';
      if (up) {
        ctx.beginPath(); ctx.moveTo(f.x - f.r * 0.8, y + f.r); ctx.lineTo(f.x - f.r * 1.1, y - f.r * 2.2 - bob);
        ctx.moveTo(f.x + f.r * 0.8, y + f.r); ctx.lineTo(f.x + f.r * 1.1, y - f.r * 2.2 + bob); ctx.stroke();
      }
      if (f.phone) { // arm up, screen facing back at us
        const px = f.x + f.r * 0.9, py = y - f.r * 2.1;
        ctx.beginPath(); ctx.moveTo(f.x + f.r * 0.7, y + f.r); ctx.lineTo(px, py + 10); ctx.stroke();
        D.rr(px - 13, py - 24, 26, 44, 4); ctx.fillStyle = '#0b0b0d'; ctx.fill();
        const sc = ctx.createLinearGradient(0, py - 20, 0, py + 16);
        sc.addColorStop(0, '#9fb6d8'); sc.addColorStop(1, '#6f7f9a');
        ctx.fillStyle = sc; ctx.fillRect(px - 10, py - 20, 20, 36);
        ctx.fillStyle = 'rgba(40,30,28,0.7)'; ctx.fillRect(px - 6, py - 6, 12, 14); // the fight, tiny
      }
      ctx.fillStyle = f.hood;
      ctx.beginPath(); ctx.ellipse(f.x, y + f.r * 1.9, f.r * 1.6, f.r * 1.2, 0, 0, Math.PI * 2); ctx.fill();
      ell(ctx, f.x, y - bob * 0.5, f.r * 1.05, f.r * 1.2); ctx.fill();
      poly(ctx, [[f.x - f.r * 0.35, y - bob * 0.5 - f.r * 1.08], [f.x, y - bob * 0.5 - f.r * 1.34], [f.x + f.r * 0.35, y - bob * 0.5 - f.r * 1.08]]); ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.lineWidth = 2; // hood seam
      ctx.beginPath(); ctx.moveTo(f.x, y - bob * 0.5 - f.r * 1.25); ctx.lineTo(f.x, y - bob * 0.5 + f.r * 0.9); ctx.stroke();
      ctx.fillStyle = 'rgba(210,220,240,0.13)'; // floodlight rim
      ctx.beginPath(); ctx.arc(f.x, y - bob * 0.5, f.r * 1.05, Math.PI * 1.15, Math.PI * 1.85); ctx.lineTo(f.x, y - bob * 0.5); ctx.fill();
    }
  };

  // Floodlight beams and a bit of drizzle falling through them.
  const RAIN = [];
  for (let i = 0; i < 70; i++) RAIN.push({ x: rnd() * W, y: rnd() * H, v: 700 + rnd() * 400, l: 14 + rnd() * 16 });
  YD.drawAtmosphere = t => {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const px of POLES) for (const o of [-22, 22]) {
      const x = px + o, tx = W / 2 + (px - W / 2) * 0.35 + o * 3;
      const g = ctx.createLinearGradient(0, POLE_TOP, 0, 780);
      g.addColorStop(0, 'rgba(255,238,200,0.07)'); g.addColorStop(1, 'rgba(255,238,200,0)');
      ctx.fillStyle = g;
      D.poly([[x - 10, POLE_TOP], [x + 10, POLE_TOP], [tx + 170, 780], [tx - 170, 780]]); ctx.fill();
      const gl = ctx.createRadialGradient(x, POLE_TOP, 2, x, POLE_TOP, 50);
      gl.addColorStop(0, 'rgba(255,245,220,0.6)'); gl.addColorStop(1, 'rgba(255,245,220,0)');
      ctx.fillStyle = gl; ctx.fillRect(x - 50, POLE_TOP - 50, 100, 100);
    }
    ctx.strokeStyle = 'rgba(200,210,225,0.12)'; ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (const r of RAIN) {
      const y = (r.y + t * r.v) % (H + 40) - 20, x = (r.x + y * 0.12) % W;
      ctx.moveTo(x, y); ctx.lineTo(x + r.l * 0.12, y + r.l);
    }
    ctx.stroke();
    ctx.restore();
  };
})();
