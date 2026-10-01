'use strict';
// Drawing for the world view. Units are world units: the view is at least 420 tall and the
// ground runs along its bottom edge, so heights in GROUND are measured up from the bottom.
// The bus is drawn from its rear-bottom corner, facing right, with y going up as negative.

const BUS = { len: 360, door: 271, wheels: [72, 205], pivot: [304, -72], wiperLen: 50, wiperRest: -0.06, wiperSweep: 1.4 };
const GROUND = { farPave: 184, roadTop: 170, lane: 116, kerb: 58, body: 98 };
const BUS_COLORS = { yellow: '#ffc629', red: '#ef4444', blue: '#3b82f6', green: '#22c55e' };
const ZEBRA = 160; // the school crossing, measured from the school's stop mark
const KID = {
  skin: ['#fbd9bd', '#f1c27d', '#e0ac69', '#c68642', '#8d5524', '#5c3a21'],
  hair: ['#2b1d14', '#4a2f1b', '#8b5a2b', '#d9a441', '#f0d27a', '#b5533c', '#111111'],
  shirt: ['#ff5a5f', '#ffb400', '#00a699', '#3b82f6', '#a855f7', '#22c55e', '#f97316', '#ec4899'],
  pants: ['#1e3a8a', '#374151', '#6b4f2a', '#0f766e', '#7c2d12', '#be185d'],
  bag: ['#ef4444', '#2563eb', '#16a34a', '#f59e0b', '#9333ea', '#0891b2'],
};

const Scene = (() => {
  const TAU = Math.PI * 2;
  const FONT = 'Fredoka, "Trebuchet MS", sans-serif';
  const rnd = (i, s) => { const x = Math.sin(i * 127.1 + s * 311.7) * 43758.5453; return x - Math.floor(x); };
  const hexes = {};
  const rgb = h => hexes[h] || (hexes[h] = [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16)));
  function mix(a, b, t) {
    const A = rgb(a), B = rgb(b);
    return 'rgb(' + A.map((v, i) => Math.round(v + (B[i] - v) * t)).join(',') + ')';
  }
  function rr(c, x, y, w, h, r) {
    const [a, b, d, e] = Array.isArray(r) ? r : [r, r, r, r];
    c.beginPath(); c.moveTo(x + a, y);
    c.lineTo(x + w - b, y); c.quadraticCurveTo(x + w, y, x + w, y + b);
    c.lineTo(x + w, y + h - d); c.quadraticCurveTo(x + w, y + h, x + w - d, y + h);
    c.lineTo(x + e, y + h); c.quadraticCurveTo(x, y + h, x, y + h - e);
    c.lineTo(x, y + a); c.quadraticCurveTo(x, y, x + a, y); c.closePath();
  }
  function dot(c, x, y, r) { c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill(); }
  const pick = (arr, i, s) => arr[Math.floor(rnd(i, s) * arr.length)];

  // ---------------- background ----------------
  function sky(c, V, rain) {
    const g = c.createLinearGradient(0, 0, 0, V.H - GROUND.farPave);
    g.addColorStop(0, mix('#4fb3ff', '#6b7785', rain));
    g.addColorStop(1, mix('#d4f0ff', '#aab4be', rain));
    c.fillStyle = g; c.fillRect(0, 0, V.W, V.H);
    if (rain >= 1) return;
    // a smiley sun
    c.save(); c.globalAlpha = 1 - rain; c.translate(V.W - 90, 80);
    c.save(); c.rotate(V.t * 0.3); c.fillStyle = '#ffe066';
    for (let i = 0; i < 10; i++) { c.rotate(TAU / 10); c.beginPath(); c.moveTo(-6, -44); c.lineTo(0, -60); c.lineTo(6, -44); c.fill(); }
    c.restore();
    c.fillStyle = '#ffd43b'; dot(c, 0, 0, 38);
    c.fillStyle = '#7a4a00'; dot(c, -12, -6, 4); dot(c, 12, -6, 4);
    c.strokeStyle = '#7a4a00'; c.lineWidth = 3.5; c.lineCap = 'round';
    c.beginPath(); c.arc(0, 4, 15, 0.2 * Math.PI, 0.8 * Math.PI); c.stroke();
    c.fillStyle = 'rgba(255,120,80,.45)'; dot(c, -22, 8, 6); dot(c, 22, 8, 6);
    c.restore();
  }
  function clouds(c, V, rain) {
    const cell = 360, off = V.cam * 0.1 + V.t * 8, room = Math.max(70, V.H - 420);
    c.fillStyle = mix('#ffffff', '#8b95a1', rain);
    for (let i = Math.floor(off / cell) - 1; i <= Math.floor((off + V.W) / cell) + 1; i++) {
      const x = i * cell + rnd(i, 3) * 160 - off, y = 34 + rnd(i, 4) * room, s = 0.7 + rnd(i, 5) * 0.7;
      dot(c, x, y, 22 * s); dot(c, x + 26 * s, y - 12 * s, 28 * s); dot(c, x + 54 * s, y, 22 * s);
      c.fillRect(x, y, 54 * s, 22 * s);
    }
  }
  function hills(c, V, par, col, base, amp, f1, f2, ph) {
    const off = V.cam * par;
    c.fillStyle = col; c.beginPath(); c.moveTo(0, V.H);
    for (let x = 0; x <= V.W + 20; x += 20) {
      const wx = x + off;
      c.lineTo(x, base - amp * (0.65 + 0.35 * Math.sin(wx * f1 + ph)) - amp * 0.3 * Math.sin(wx * f2 + ph * 2));
    }
    c.lineTo(V.W + 20, V.H); c.closePath(); c.fill();
  }

  const HOUSE = ['#f87171', '#fbbf24', '#60a5fa', '#a78bfa', '#f472b6', '#34d399', '#fb923c', '#fde68a'];
  const SHOPS = ['CAFE', 'TOYS', 'BAKERY', 'SHOP', 'BOOKS', 'ICE CREAM', 'PETS', 'SWEETS'];
  function scenery(c, V, S) {
    const cell = 280, base = V.H - GROUND.farPave;
    for (let i = Math.floor((V.cam - 320) / cell); i <= Math.floor((V.cam + V.W + 40) / cell); i++) {
      const wx = i * cell;
      if (wx < -700) continue;
      if (S.stops.some(s => s.school && wx > s.x - 360 && wx < s.x + 560)) continue;
      const x = wx - V.cam, r = rnd(i, 1);
      if (r < 0.42) house(c, x + 20 + rnd(i, 2) * 40, base, i);
      else if (r < 0.68) trees(c, x, base, i);
      else if (r < 0.87) shop(c, x + 20, base, i);
      else playground(c, x, base, i);
    }
  }
  function house(c, x, base, i) {
    const w = 150 + rnd(i, 6) * 50, h = 82 + rnd(i, 7) * 40, col = pick(HOUSE, i, 8);
    c.fillStyle = '#8a5a44'; c.fillRect(x + w * 0.7, base - h - 52, 16, 34); // chimney
    c.fillStyle = col; c.fillRect(x, base - h, w, h);
    c.fillStyle = rnd(i, 9) < 0.5 ? '#9a3412' : '#475569';
    c.beginPath(); c.moveTo(x - 12, base - h + 2); c.lineTo(x + w / 2, base - h - 54); c.lineTo(x + w + 12, base - h + 2); c.fill();
    const dx = x + (rnd(i, 10) < 0.5 ? w * 0.18 : w * 0.62);
    c.fillStyle = pick(['#1d4ed8', '#b91c1c', '#065f46', '#7c3aed'], i, 11); rr(c, dx, base - 48, 28, 48, [12, 12, 0, 0]); c.fill();
    c.fillStyle = '#facc15'; dot(c, dx + 22, base - 24, 2.5);
    for (const wx of [x + (dx - x < w / 2 ? w * 0.6 : w * 0.12), x + (dx - x < w / 2 ? w * 0.6 : w * 0.12) + 42]) {
      if (wx + 34 > x + w - 6) continue;
      c.fillStyle = '#fff'; c.fillRect(wx - 3, base - h + 18, 40, 36);
      c.fillStyle = '#bfe3f5'; c.fillRect(wx, base - h + 21, 34, 30);
      c.fillStyle = '#fff'; c.fillRect(wx + 15, base - h + 21, 4, 30); c.fillRect(wx, base - h + 34, 34, 4);
    }
  }
  function trees(c, x, base, i) {
    const n = 2 + Math.floor(rnd(i, 12) * 2);
    for (let k = 0; k < n; k++) {
      const tx = x + 40 + k * 80 + rnd(i, 13 + k) * 30, s = 0.8 + rnd(i, 17 + k) * 0.5;
      c.fillStyle = '#7c4a24'; c.fillRect(tx - 6 * s, base - 50 * s, 12 * s, 50 * s);
      c.fillStyle = k % 2 ? '#2f9e44' : '#40a24f';
      dot(c, tx, base - 80 * s, 34 * s); dot(c, tx - 24 * s, base - 62 * s, 24 * s); dot(c, tx + 24 * s, base - 62 * s, 24 * s);
      if (rnd(i, 21 + k) < 0.4) { c.fillStyle = '#ef4444'; dot(c, tx - 10 * s, base - 84 * s, 4); dot(c, tx + 14 * s, base - 70 * s, 4); dot(c, tx + 2 * s, base - 98 * s, 4); }
    }
  }
  function shop(c, x, base, i) {
    const w = 200, h = 110, col = pick(HOUSE, i, 22);
    c.fillStyle = col; c.fillRect(x, base - h, w, h);
    c.fillStyle = 'rgba(0,0,0,.15)'; c.fillRect(x, base - h, w, 8);
    c.fillStyle = '#fff'; rr(c, x + 30, base - h + 12, w - 60, 26, 6); c.fill();
    c.fillStyle = '#1f2937'; c.font = '700 18px ' + FONT; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText(pick(SHOPS, i, 23), x + w / 2, base - h + 26);
    const a = pick(['#ef4444', '#2563eb', '#16a34a', '#9333ea'], i, 24);
    for (let k = 0; k < 8; k++) {
      c.fillStyle = k % 2 ? '#fff' : a;
      c.beginPath(); c.moveTo(x + k * 25, base - h + 44); c.lineTo(x + k * 25 + 25, base - h + 44);
      c.lineTo(x + k * 25 + 25, base - h + 58); c.arc(x + k * 25 + 12.5, base - h + 58, 12.5, 0, Math.PI); c.fill();
    }
    c.fillStyle = '#bfe3f5'; c.fillRect(x + 12, base - 44, 110, 36);
    c.fillStyle = '#7c2d12'; c.fillRect(x + 140, base - 50, 34, 50);
  }
  function playground(c, x, base, i) {
    c.fillStyle = '#8bd36a'; c.fillRect(x, base - 6, 280, 6);
    // swing frame
    c.strokeStyle = '#ef4444'; c.lineWidth = 6; c.lineCap = 'round';
    c.beginPath(); c.moveTo(x + 30, base); c.lineTo(x + 60, base - 90); c.lineTo(x + 150, base - 90); c.lineTo(x + 180, base); c.stroke();
    c.strokeStyle = '#555'; c.lineWidth = 2;
    for (const sx of [x + 85, x + 125]) {
      c.beginPath(); c.moveTo(sx, base - 90); c.lineTo(sx, base - 30); c.stroke();
      c.fillStyle = '#1d4ed8'; c.fillRect(sx - 10, base - 32, 20, 5);
    }
    // slide
    c.fillStyle = '#facc15'; c.beginPath(); c.moveTo(x + 200, base - 70); c.lineTo(x + 214, base - 70); c.lineTo(x + 270, base); c.lineTo(x + 250, base); c.fill();
    c.strokeStyle = '#2563eb'; c.lineWidth = 4;
    c.beginPath(); c.moveTo(x + 200, base); c.lineTo(x + 200, base - 74); c.moveTo(x + 214, base); c.lineTo(x + 214, base - 74); c.stroke();
  }
  function school(c, s, V, t) {
    const x = s.x - V.cam, base = V.H - GROUND.farPave, ex = x + ZEBRA;
    if (x > V.W + 80 || x + 560 < 0) return;
    c.fillStyle = '#c2410c'; c.fillRect(x + 40, base - 140, 460, 140); // wings
    c.fillStyle = '#9a3412'; c.fillRect(x + 34, base - 150, 472, 12);
    c.fillStyle = '#ea580c'; c.fillRect(ex - 60, base - 205, 120, 205); // entrance tower
    c.fillStyle = '#9a3412'; c.beginPath(); c.moveTo(ex - 72, base - 203); c.lineTo(ex, base - 250); c.lineTo(ex + 72, base - 203); c.fill();
    // bell
    c.fillStyle = '#facc15'; c.beginPath(); c.arc(ex, base - 222, 9, Math.PI, 0); c.lineTo(ex + 11, base - 214); c.lineTo(ex - 11, base - 214); c.fill();
    // clock
    c.fillStyle = '#fff'; dot(c, ex, base - 168, 18);
    c.strokeStyle = '#1f2937'; c.lineWidth = 3; c.beginPath();
    c.moveTo(ex, base - 168); c.lineTo(ex, base - 180); c.moveTo(ex, base - 168); c.lineTo(ex + 8, base - 164); c.stroke();
    // sign
    c.fillStyle = '#fff'; rr(c, ex - 54, base - 140, 108, 28, 8); c.fill();
    c.fillStyle = '#1d4ed8'; c.font = '700 21px ' + FONT; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText('SCHOOL', ex, base - 125);
    // doors
    c.fillStyle = '#1d4ed8'; rr(c, ex - 28, base - 66, 56, 66, [26, 26, 0, 0]); c.fill();
    c.fillStyle = '#93c5fd'; c.fillRect(ex - 1.5, base - 60, 3, 60);
    // windows with paintings in them
    const art = ['#ef4444', '#facc15', '#22c55e', '#3b82f6', '#a855f7'];
    for (let k = 0; k < 7; k++) {
      const wx = x + (k < 1 ? 56 : 160 + k * 46);
      if (k > 0 && wx < ex + 66) continue;
      c.fillStyle = '#fff'; c.fillRect(wx - 3, base - 118, 40, 46);
      c.fillStyle = '#dbeafe'; c.fillRect(wx, base - 115, 34, 40);
      c.fillStyle = art[k % 5]; dot(c, wx + 12, base - 100, 6); c.fillRect(wx + 18, base - 90, 10, 10);
    }
    // flag
    c.fillStyle = '#9ca3af'; c.fillRect(x + 478, base - 230, 4, 90);
    c.fillStyle = '#ef4444'; c.beginPath(); c.moveTo(x + 482, base - 228);
    for (let k = 0; k <= 6; k++) c.lineTo(x + 482 + k * 7, base - 228 + Math.sin(t * 5 + k) * 3);
    for (let k = 6; k >= 0; k--) c.lineTo(x + 482 + k * 7, base - 206 + Math.sin(t * 5 + k) * 3);
    c.fill();
  }
  function lamps(c, V, rain) {
    const base = V.H - GROUND.farPave + 4, gap = 560;
    for (let i = Math.floor((V.cam - 40) / gap); i <= Math.floor((V.cam + V.W + 40) / gap); i++) {
      const x = i * gap + 120 - V.cam;
      c.fillStyle = '#4b5563'; c.fillRect(x - 3, base - 150, 6, 150);
      c.fillRect(x - 3, base - 150, 26, 5);
      c.fillStyle = rain > 0.3 ? '#fff3b0' : '#e5e7eb'; rr(c, x + 14, base - 148, 16, 9, 3); c.fill();
      if (rain > 0.3) {
        c.fillStyle = 'rgba(255,240,170,' + (0.25 * rain) + ')';
        c.beginPath(); c.moveTo(x + 16, base - 140); c.lineTo(x - 10, base - 10); c.lineTo(x + 56, base - 10); c.lineTo(x + 28, base - 140); c.fill();
      }
    }
  }

  // ---------------- road ----------------
  function road(c, V, rain) {
    const B = V.H;
    c.fillStyle = '#d6cfc2'; c.fillRect(0, B - GROUND.farPave, V.W, 14);
    c.fillStyle = '#a8a196'; c.fillRect(0, B - GROUND.roadTop - 3, V.W, 3);
    c.fillStyle = mix('#5a5f69', '#3f444c', rain); c.fillRect(0, B - GROUND.roadTop, V.W, GROUND.roadTop - GROUND.kerb);
    if (rain > 0) { c.fillStyle = 'rgba(180,200,230,' + (0.12 * rain) + ')'; c.fillRect(0, B - 100, V.W, 30); }
    c.fillStyle = '#f5f5f5';
    const o = ((V.cam % 90) + 90) % 90;
    for (let x = -o; x < V.W; x += 90) c.fillRect(x, B - GROUND.lane - 2, 48, 5);
    c.fillStyle = '#b8b0a3'; c.fillRect(0, B - GROUND.kerb, V.W, 8);
    c.fillStyle = '#ddd5c7'; c.fillRect(0, B - GROUND.kerb + 8, V.W, GROUND.kerb - 8);
    c.fillStyle = '#cac1b2';
    const p = ((V.cam % 64) + 64) % 64;
    for (let x = -p; x < V.W; x += 64) c.fillRect(x, B - GROUND.kerb + 8, 2, GROUND.kerb - 8);
    c.fillRect(0, B - 26, V.W, 2);
    // start of the road: a barrier behind the depot
    const bx = -70 - V.cam;
    if (bx > -60) {
      for (let k = 0; k < 6; k++) { c.fillStyle = k % 2 ? '#fff' : '#ef4444'; c.fillRect(bx, B - 160 + k * 16, 14, 16); }
    }
  }
  function marks(c, s, V, S) {
    const x = s.x - V.cam, B = V.H;
    if (x < -200 || x > V.W + 400) return;
    c.strokeStyle = '#facc15'; c.lineWidth = 3; c.setLineDash([14, 10]);
    c.strokeRect(x - 285, B - 110, 380, 46); c.setLineDash([]);
    c.fillStyle = '#facc15'; c.font = '700 24px ' + FONT; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText(s.school ? 'SCHOOL' : 'BUS STOP', x - 95, B - 86);
    if (s.school) { // zebra crossing
      const zx = x + ZEBRA;
      c.fillStyle = '#fff';
      for (let y = B - GROUND.roadTop + 4; y < B - GROUND.kerb - 6; y += 16) c.fillRect(zx - 28, y, 56, 9);
      beacon(c, zx - 44, B - GROUND.farPave + 6, 70, V.t);
    }
    // where the door should line up, on the kerb
    const ok = s.aligned && S.bus.v === 0;
    c.fillStyle = ok ? 'rgba(34,197,94,' + (0.6 + 0.3 * Math.sin(V.t * 8)) + ')' : 'rgba(250,204,21,.6)';
    rr(c, x - 30, B - GROUND.kerb, 60, 10, 4); c.fill();
  }
  function beacon(c, x, y, h, t) {
    for (let k = 0; k < h; k += 10) { c.fillStyle = (k / 10) % 2 ? '#fff' : '#111'; c.fillRect(x - 2.5, y - k - 10, 5, 10); }
    const on = Math.sin(t * 5) > 0;
    c.fillStyle = on ? '#ffa31a' : '#c2410c'; dot(c, x, y - h - 8, 9);
    if (on) { c.fillStyle = 'rgba(255,163,26,.3)'; dot(c, x, y - h - 8, 16); }
  }
  function sign(c, s, V, t) {
    const x = s.x + 62 - V.cam, B = V.H;
    if (x < -40 || x > V.W + 40) return;
    c.fillStyle = '#6b7280'; c.fillRect(x - 3, B - 126, 6, 112);
    c.fillStyle = 'rgba(0,0,0,.15)'; c.beginPath(); c.ellipse(x, B - 14, 10, 3, 0, 0, TAU); c.fill();
    if (s.school) {
      c.fillStyle = '#1d4ed8'; rr(c, x - 30, B - 158, 60, 34, 6); c.fill();
      c.fillStyle = '#fff'; c.font = '700 13px ' + FONT; c.textAlign = 'center'; c.textBaseline = 'middle';
      c.fillText('SCHOOL', x, B - 141);
      beacon(c, x + ZEBRA - 62 + 44, B - 8, 90, t);
    } else {
      c.fillStyle = '#fff'; dot(c, x, B - 142, 20);
      c.strokeStyle = '#dc2626'; c.lineWidth = 5; c.beginPath(); c.arc(x, B - 142, 18, 0, TAU); c.stroke();
      c.fillStyle = '#1f2937'; rr(c, x - 10, B - 150, 20, 13, 3); c.fill();
      c.fillStyle = '#bfe3f5'; c.fillRect(x - 7, B - 148, 6, 5); c.fillRect(x + 1, B - 148, 6, 5);
      dot(c, x - 5, B - 136, 2.5); dot(c, x + 5, B - 136, 2.5);
      c.fillStyle = '#fde047'; rr(c, x - 9, B - 108, 18, 24, 3); c.fill();
    }
  }
  // the bouncing arrow over a stop that still needs the bus
  function arrow(c, s, V) {
    const x = s.x - V.cam, y = V.H - 262 + Math.sin(V.t * 5) * 8;
    if (x < -30 || x > V.W + 30) return;
    c.fillStyle = s.school ? '#60a5fa' : '#facc15'; c.strokeStyle = '#1f2937'; c.lineWidth = 4; c.lineJoin = 'round';
    c.beginPath(); c.moveTo(x - 12, y - 40); c.lineTo(x + 12, y - 40); c.lineTo(x + 12, y - 16); c.lineTo(x + 24, y - 16);
    c.lineTo(x, y + 8); c.lineTo(x - 24, y - 16); c.lineTo(x - 12, y - 16); c.closePath(); c.fill(); c.stroke();
  }

  // ---------------- kids ----------------
  function head(c, L) { // centred on the face, radius 13, looking right
    c.fillStyle = L.hair;
    if (L.style === 5) { rr(c, -15, -8, 28, 26, 8); c.fill(); }
    if (L.style === 1) { dot(c, -15, 2, 6); dot(c, 15, 2, 6); }
    if (L.style === 3) dot(c, -6, -15, 7);
    c.fillStyle = L.skin; dot(c, 0, 0, 13);
    if (L.style === 2) {
      c.fillStyle = L.hair;
      for (let a = -3.3; a <= 0.2; a += 0.5) dot(c, Math.cos(a) * 12, Math.sin(a) * 12 - 1, 6.5);
    } else if (L.style === 4) {
      c.fillStyle = L.bag; c.beginPath(); c.ellipse(0, -5, 14, 10, 0, Math.PI, 0); c.fill();
      rr(c, 4, -8, 17, 4, 2); c.fill();
    } else {
      c.fillStyle = L.hair; c.beginPath(); c.ellipse(0, -4, 14, 10.5, 0, Math.PI, 0); c.fill();
      c.beginPath(); c.ellipse(-8, -5, 6, 6, 0, 0, TAU); c.fill();
    }
    c.fillStyle = '#1f2937'; dot(c, -2.5, -1, 2); dot(c, 6, -1, 2);
    c.fillStyle = 'rgba(255,105,120,.35)'; dot(c, -6, 4, 3); dot(c, 9, 4, 3);
    c.strokeStyle = '#7a2e1f'; c.lineWidth = 1.7; c.lineCap = 'round';
    c.beginPath(); c.arc(2, 3, 4.5, 0.15 * Math.PI, 0.85 * Math.PI); c.stroke();
  }
  // a whole kid standing on (x, y), sc for perspective, k.face 1 = facing right
  function kid(c, k, x, y, sc, t) {
    const L = k.look;
    c.save(); c.translate(x, y); c.globalAlpha = k.alpha == null ? 1 : k.alpha;
    c.fillStyle = 'rgba(0,0,0,.16)'; c.beginPath(); c.ellipse(0, 0, 13 * sc, 3.5 * sc, 0, 0, TAU); c.fill();
    c.translate(0, -(k.hop || 0)); c.scale(sc * (k.face || 1), sc);
    const sw = k.walking ? Math.sin(k.phase) * 0.5 : 0;
    for (const [lx, a] of [[-4, sw], [4, -sw]]) {
      c.save(); c.translate(lx, -18); c.rotate(a);
      c.fillStyle = L.pants; c.fillRect(-3.5, 0, 7, 15);
      c.fillStyle = '#1f2937'; rr(c, -4, 13, 10, 5, 2); c.fill();
      c.restore();
    }
    c.fillStyle = L.bag; rr(c, -18, -42, 10, 21, 4); c.fill();
    c.fillStyle = L.shirt; rr(c, -10, -43, 20, 27, 7); c.fill();
    const arm = (sx, a) => {
      c.save(); c.translate(sx, -38); c.rotate(a);
      c.strokeStyle = L.shirt; c.lineWidth = 5.5; c.lineCap = 'round';
      c.beginPath(); c.moveTo(0, 0); c.lineTo(0, 12); c.stroke();
      c.fillStyle = L.skin; dot(c, 0, 15, 3.2);
      c.restore();
    };
    arm(-6, -sw * 0.8);
    arm(6, k.wave ? Math.PI * 0.9 + Math.sin(t * 11 + k.phase) * 0.35 : sw * 0.8);
    c.save(); c.translate(0, -56); head(c, L); c.restore();
    c.restore();
  }
  function bubble(c, text, x, y, scale) {
    c.save(); c.translate(x, y); if (scale) c.scale(scale, scale);
    c.font = '700 16px ' + FONT; c.textAlign = 'center'; c.textBaseline = 'middle';
    const w = c.measureText(text).width + 18;
    c.fillStyle = '#fff'; c.strokeStyle = '#1f2937'; c.lineWidth = 2.5;
    rr(c, -w / 2, -30, w, 26, 12); c.fill(); c.stroke();
    c.beginPath(); c.moveTo(-6, -5); c.lineTo(0, 4); c.lineTo(6, -5); c.fill();
    c.beginPath(); c.moveTo(-6, -4); c.lineTo(0, 4); c.lineTo(6, -4); c.stroke();
    c.fillStyle = '#1f2937'; c.fillText(text, 0, -16);
    c.restore();
  }

  // ---------------- the bus ----------------
  function seatPos(seat) { // seat 0 is the front window
    const w = 4 - (seat >> 1);
    return [16 + w * 45 + 12 + (seat & 1) * 14, -94];
  }
  function bus(c, S, x, y, t) {
    const b = S.bus, col = BUS_COLORS[S.color] || BUS_COLORS.yellow;
    const dark = mix(col, '#000000', 0.3), light = mix(col, '#ffffff', 0.4);
    c.save(); c.translate(x, y + b.bounce);
    c.fillStyle = 'rgba(0,0,0,.22)'; c.beginPath(); c.ellipse(182, 30 - b.bounce, 196, 7, 0, 0, TAU); c.fill();
    // headlight beam in the rain
    if (b.engine && S.rain > 0.2) {
      const g = c.createLinearGradient(360, 0, 520, 0);
      g.addColorStop(0, 'rgba(255,245,190,' + 0.5 * S.rain + ')'); g.addColorStop(1, 'rgba(255,245,190,0)');
      c.fillStyle = g; c.beginPath(); c.moveTo(358, -30); c.lineTo(520, -60); c.lineTo(520, 20); c.lineTo(358, -18); c.fill();
    }
    // body
    const g = c.createLinearGradient(0, -140, 0, 0);
    g.addColorStop(0, light); g.addColorStop(0.12, col); g.addColorStop(1, col);
    rr(c, 0, -140, 360, 140, [12, 30, 8, 8]); c.fillStyle = g; c.fill();
    c.lineWidth = 3; c.strokeStyle = dark; c.stroke();
    // window band + passenger windows with the kids in them
    c.fillStyle = '#1f2937'; rr(c, 10, -130, 232, 56, 8); c.fill();
    const bob = S.radio ? 1 : 0;
    for (let w = 0; w < 5; w++) {
      const wx = 16 + w * 45;
      c.save(); rr(c, wx, -126, 38, 46, 6); c.fillStyle = '#bfe3f5'; c.fill(); c.clip();
      for (const k of S.onBus) {
        const [hx, hy] = seatPos(k.seat);
        if (hx < wx || hx > wx + 38) continue;
        const dy = bob ? Math.abs(Math.sin(t * 7 + k.seat)) * -4 : Math.sin(b.dist * 0.05 + k.seat) * 1.2;
        c.save(); c.translate(hx, hy + dy); c.scale(0.8, 0.8);
        c.fillStyle = k.look.shirt; rr(c, -12, 12, 24, 22, 8); c.fill();
        head(c, k.look); c.restore();
      }
      c.fillStyle = 'rgba(255,255,255,.35)'; c.beginPath(); c.moveTo(wx + 4, -126); c.lineTo(wx + 16, -126); c.lineTo(wx + 4, -104); c.fill();
      c.restore();
    }
    c.fillStyle = '#1f2937'; c.font = '700 17px ' + FONT; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText('SCHOOL BUS', 126, -59);
    c.fillStyle = '#1f2937'; c.fillRect(1.5, -46, 357, 6); c.fillRect(1.5, -30, 330, 3);
    // door
    c.fillStyle = '#1f2937'; rr(c, 247, -130, 48, 128, 4); c.fill();
    c.fillStyle = '#3b3f4a'; c.fillRect(250, -127, 42, 124);
    c.fillStyle = '#6b7280'; c.fillRect(250, -16, 42, 4); c.fillRect(250, -32, 42, 3);
    const pw = 21 * (1 - 0.82 * b.door);
    for (const px of [250, 292 - pw]) {
      c.fillStyle = col; c.fillRect(px, -127, pw, 124);
      c.fillStyle = '#bfe3f5'; c.fillRect(px + 2, -123, pw - 4, 64);
      c.fillStyle = dark; c.fillRect(px, -56, pw, 3);
      c.strokeStyle = '#1f2937'; c.lineWidth = 1.5; c.strokeRect(px, -127, pw, 124);
    }
    // driver's window, the driver, rain drops and the wiper
    c.save(); rr(c, 300, -128, 52, 58, [6, 18, 4, 4]); c.fillStyle = '#bfe3f5'; c.fill(); c.strokeStyle = '#1f2937'; c.lineWidth = 3; c.stroke(); c.clip();
    c.fillStyle = '#2563eb'; rr(c, 312, -84, 30, 24, 8); c.fill();
    c.save(); c.translate(326, -98);
    head(c, { skin: '#e0ac69', hair: '#3b2a1a', style: 0, bag: '#1e3a8a' });
    c.fillStyle = '#1e3a8a'; c.beginPath(); c.ellipse(0, -7, 14, 9, 0, Math.PI, 0); c.fill(); rr(c, 2, -9, 18, 4, 2); c.fill();
    c.restore();
    c.strokeStyle = '#111'; c.lineWidth = 4; c.beginPath(); c.ellipse(344, -78, 4, 11, 0.3, 0, TAU); c.stroke();
    c.fillStyle = 'rgba(255,255,255,.35)'; c.beginPath(); c.moveTo(306, -128); c.lineTo(322, -128); c.lineTo(304, -100); c.fill();
    c.restore();
    for (const d of b.drops) {
      c.fillStyle = 'rgba(220,240,255,.85)'; dot(c, d.x, d.y, d.r);
      c.fillStyle = 'rgba(255,255,255,.95)'; dot(c, d.x - d.r * 0.35, d.y - d.r * 0.35, d.r * 0.35);
    }
    const [px, py] = BUS.pivot, a = b.wiperA;
    c.strokeStyle = '#111827'; c.lineWidth = 2.5; c.lineCap = 'round';
    c.beginPath(); c.moveTo(px, py); c.lineTo(px + Math.cos(a) * BUS.wiperLen, py + Math.sin(a) * BUS.wiperLen); c.stroke();
    c.lineWidth = 4; c.beginPath();
    c.moveTo(px + Math.cos(a) * 14, py + Math.sin(a) * 14); c.lineTo(px + Math.cos(a) * BUS.wiperLen, py + Math.sin(a) * BUS.wiperLen); c.stroke();
    c.fillStyle = '#111827'; dot(c, px, py, 3.5);
    // front and back
    c.fillStyle = '#374151'; rr(c, 349, -62, 9, 26, 3); c.fill();
    c.fillStyle = b.engine ? '#fff7c2' : '#e5e7eb'; dot(c, 353, -24, 7);
    c.strokeStyle = '#9ca3af'; c.lineWidth = 2; c.beginPath(); c.arc(353, -24, 7, 0, TAU); c.stroke();
    c.fillStyle = '#9ca3af'; rr(c, 332, -13, 32, 11, 4); c.fill(); rr(c, -6, -13, 34, 11, 4); c.fill();
    c.fillStyle = b.v < 0 ? '#fff' : '#ef4444'; rr(c, 1, -62, 8, 16, 2); c.fill();
    c.fillStyle = '#f59e0b'; rr(c, 1, -82, 8, 10, 2); c.fill();
    c.fillStyle = '#4b5563'; c.fillRect(-12, -8, 14, 5);
    // wheels
    for (const wx of BUS.wheels) {
      c.fillStyle = '#111827'; c.beginPath(); c.arc(wx, 0, 32, Math.PI, 0); c.fill();
      c.save(); c.translate(wx, 6 - b.bounce * 0.6);
      c.fillStyle = '#1f2937'; dot(c, 0, 0, 24);
      c.fillStyle = '#d1d5db'; dot(c, 0, 0, 13);
      c.rotate(b.wheelA); c.fillStyle = '#6b7280';
      for (let k = 0; k < 5; k++) { c.rotate(TAU / 5); dot(c, 0, -8, 2.2); }
      dot(c, 0, 0, 4.5);
      c.restore();
    }
    c.restore();
  }

  // ---------------- particles ----------------
  function puffs(c, S, V) {
    for (const p of S.puffs) {
      c.fillStyle = 'rgba(160,165,175,' + 0.5 * p.life + ')';
      dot(c, p.x - V.cam, V.H - p.ry, p.r);
    }
  }
  function notes(c, S, V) {
    c.font = '700 26px ' + FONT; c.textAlign = 'center'; c.textBaseline = 'middle';
    for (const n of S.notes) {
      c.globalAlpha = Math.min(1, n.life * 2);
      c.fillStyle = n.col; c.fillText(n.ch, n.x - V.cam + Math.sin(n.life * 6 + n.ph) * 8, V.H - n.ry);
    }
    c.globalAlpha = 1;
  }
  function rainFx(c, S, V) {
    if (!S.rainP.length) return;
    c.strokeStyle = 'rgba(210,225,245,.7)'; c.lineWidth = 1.6; c.beginPath();
    for (const p of S.rainP) { c.moveTo(p.x, p.y); c.lineTo(p.x - 4, p.y + 16); }
    c.stroke();
  }

  // ---------------- the whole view ----------------
  function draw(c, S, V) {
    const B = V.H, rain = S.rain, t = V.t;
    sky(c, V, rain);
    clouds(c, V, rain);
    const tall = Math.max(0, V.H - 420);
    hills(c, V, 0.12, mix('#a7d98b', '#7d9481', rain), B - GROUND.farPave - 12, 85 + tall * 0.18, 0.0031, 0.0083, 1);
    hills(c, V, 0.3, mix('#78c35c', '#5f7d62', rain), B - GROUND.farPave, 45 + tall * 0.08, 0.0057, 0.016, 2.3);
    c.fillStyle = mix('#6dbb4f', '#56735a', rain); c.fillRect(0, B - GROUND.farPave - 14, V.W, 16);
    scenery(c, V, S);
    for (const s of S.stops) if (s.school) school(c, s, V, t);
    lamps(c, V, rain);
    road(c, V, rain);
    for (const s of S.stops) marks(c, s, V, S);
    puffs(c, S, V);
    bus(c, S, V.busX, B - GROUND.body, t);

    // near pavement: signs, kids, bubbles
    for (const s of S.stops) sign(c, s, V, t);
    const people = [];
    for (const s of S.stops) for (const k of s.kids) people.push(k);
    for (const k of S.walkers) people.push(k);
    people.sort((a, b) => b.ry - a.ry);
    for (const k of people) {
      const x = k.x - V.cam;
      if (x < -40 || x > V.W + 40) continue;
      kid(c, k, x, B - k.ry, k.sc || 1, t);
    }
    for (const k of people) if (k.bubble) bubble(c, k.bubble.text, k.x - V.cam, B - k.ry - 74 * (k.sc || 1));
    for (const k of S.onBus) if (k.bubble) {
      const [hx, hy] = seatPos(k.seat);
      bubble(c, k.bubble.text, V.busX + hx, B - GROUND.body + hy - 16);
    }
    for (const s of S.stops) if (s.pending && !(s.aligned && S.bus.v === 0)) arrow(c, s, V);
    if (S.beepT > 0) bubble(c, 'BEEP BEEP!', V.busX + 330, B - GROUND.body - 150, 1.25);
    notes(c, S, V);
    rainFx(c, S, V);
  }

  return { draw, rr, mix };
})();
