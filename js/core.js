// Shared namespace, constants, canvas/view/camera and small drawing helpers.
// Three coordinate spaces are used throughout:
//   world  - the ring, fighters, particles (1600x900, moved by the camera)
//   hud    - overlays and menus (1600x900, fixed, letterboxed to the screen)
//   screen - CSS pixels, used only for the touch controls
(() => {
  'use strict';
  const BK = window.BK = {};

  BK.W = 1600; BK.H = 900;
  BK.RING = { backY: 440, frontY: 790, backL: 390, backR: 1210, frontL: 170, frontR: 1430 };
  BK.Z_MIN = 0.03; BK.Z_MAX = 0.9; BK.U_MIN = 0.05; BK.U_MAX = 0.95;

  BK.PAL = {
    arena: '#120f0e',
    bone: '#efe6d2',
    brass: '#d9a441',
    blood: '#b3202a',
    navy: '#23386b',
    teal: '#3a9c95',
    ink: '#1a100c',
    canvas: '#d8cfb8',
    panel: 'rgba(16,12,11,0.9)',
  };
  BK.FONT = {
    display: (px) => `400 ${px}px "Anton", Impact, sans-serif`,
    ui: (px, w = 600) => `${w} ${px}px "Barlow Condensed", "Arial Narrow", sans-serif`,
  };

  // ---------- math ----------
  const lerp = BK.lerp = (a, b, t) => a + (b - a) * t;
  const clamp = BK.clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  BK.easeOut = t => 1 - Math.pow(1 - clamp(t, 0, 1), 3);
  BK.easeInOut = t => { t = clamp(t, 0, 1); return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; };
  BK.rnd = (a, b) => a + Math.random() * (b - a);
  BK.pick = arr => arr[Math.floor(Math.random() * arr.length)];
  BK.ringL = z => lerp(BK.RING.backL, BK.RING.frontL, z);
  BK.ringR = z => lerp(BK.RING.backR, BK.RING.frontR, z);
  BK.toScreenX = (u, z) => lerp(BK.ringL(z), BK.ringR(z), u);
  BK.toScreenY = z => lerp(BK.RING.backY, BK.RING.frontY, z);
  BK.depthScale = z => lerp(0.74, 1.0, z);
  let seed = 7;
  BK.srand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  BK.shade = (hex, f) => {
    const n = parseInt(hex.slice(1), 16);
    const r = Math.min(255, Math.round(((n >> 16) & 255) * f));
    const g = Math.min(255, Math.round(((n >> 8) & 255) * f));
    const b = Math.min(255, Math.round((n & 255) * f));
    return `rgb(${r},${g},${b})`;
  };
  BK.fmtClock = s => { s = Math.max(0, Math.ceil(s)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };

  // ---------- canvas, view (hud) and camera (world) ----------
  const canvas = BK.canvas = document.getElementById('game');
  const ctx = BK.ctx = canvas.getContext('2d');
  BK.screen = { w: 0, h: 0, dpr: 1, safe: { l: 0, r: 0, t: 0, b: 0 } };
  BK.view = { s: 1, ox: 0, oy: 0 };

  BK.resize = () => {
    const sc = BK.screen;
    sc.dpr = Math.min(window.devicePixelRatio || 1, 2);
    sc.w = canvas.clientWidth; sc.h = canvas.clientHeight;
    canvas.width = Math.round(sc.w * sc.dpr); canvas.height = Math.round(sc.h * sc.dpr);
    // Notch / gesture-bar insets, read from a probe element (custom properties don't resolve env()).
    let probe = document.getElementById('safe-probe');
    if (!probe) {
      probe = document.createElement('div'); probe.id = 'safe-probe';
      probe.style.cssText = 'position:fixed;visibility:hidden;pointer-events:none;padding:env(safe-area-inset-top,0px) env(safe-area-inset-right,0px) env(safe-area-inset-bottom,0px) env(safe-area-inset-left,0px)';
      document.body.appendChild(probe);
    }
    const cs = getComputedStyle(probe), px = v => parseFloat(v) || 0;
    sc.safe = { l: px(cs.paddingLeft), r: px(cs.paddingRight), t: px(cs.paddingTop), b: px(cs.paddingBottom) };
    const s = Math.min(sc.w / BK.W, sc.h / BK.H);
    BK.view = { s, ox: (sc.w - BK.W * s) / 2, oy: (sc.h - BK.H * s) / 2 };
  };
  window.addEventListener('resize', BK.resize);
  BK.toHud = (cx, cy) => ({ x: (cx - BK.view.ox) / BK.view.s, y: (cy - BK.view.oy) / BK.view.s });

  BK.cam = { x: BK.W / 2, y: BK.H / 2, zoom: 1, tx: BK.W / 2, ty: BK.H / 2, tz: 1, shake: 0, kick: 0 };
  BK.updateCamera = dt => {
    const c = BK.cam, k = 1 - Math.pow(0.02, dt);
    c.zoom = lerp(c.zoom, c.tz, k);
    c.x = lerp(c.x, c.tx, k); c.y = lerp(c.y, c.ty, k);
    const hw = BK.W / 2 / c.zoom, hh = BK.H / 2 / c.zoom;
    c.x = clamp(c.x, hw, BK.W - hw); c.y = clamp(c.y, hh, BK.H - hh);
    c.shake = Math.max(0, c.shake - dt * 40);
    c.kick = Math.max(0, c.kick - dt * 0.5);
  };
  BK.applyCamera = () => {
    const c = BK.cam;
    const sx = (Math.random() - 0.5) * c.shake, sy = (Math.random() - 0.5) * c.shake;
    ctx.translate(BK.W / 2 + sx, BK.H / 2 + sy);
    if (c.roll) ctx.rotate(c.roll); // rocking view while you're out on your feet
    ctx.scale(c.zoom + c.kick, c.zoom + c.kick);
    ctx.translate(-c.x, -c.y);
  };

  // ---------- persistence (per-device only, always optional) ----------
  const load = (k, d) => { try { const v = JSON.parse(localStorage.getItem(k)); return v ? Object.assign({}, d, v) : d; } catch (e) { return d; } };
  const save = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* storage blocked */ } };
  BK.settings = load('bkb.settings', { difficulty: 1, rounds: 3, sound: true, vibrate: true, player: 'michael', cpu: 'johnjoe', players: 1, arena: 'hall' });
  BK.record = load('bkb.record', { w: 0, l: 0, d: 0, ko: 0 });
  BK.saveSettings = () => save('bkb.settings', BK.settings);
  BK.saveRecord = () => save('bkb.record', BK.record);
  BK.DIFFS = ['EASY', 'NORMAL', 'HARD'];
  BK.ROUND_OPTS = [1, 3, 5];
  BK.ROUND_LEN = 90;

  // side: 0 = red corner (the phone itself buzzes for them), 1 = blue (their pad rumbles)
  BK.vibrate = (ms, side = 0) => { if (!BK.settings.vibrate) return; if (side === 0) { try { navigator.vibrate && navigator.vibrate(ms); } catch (e) { /* unsupported */ } } if (BK.pad) BK.pad.rumble(ms, side); };

  // ---------- drawing helpers (all take the shared ctx) ----------
  const D = BK.draw = {};
  D.OUT = 3.5; // outline width
  // Two-segment limb with a dark outline pass so fighters read clearly on small screens.
  D.limb = (ax, ay, bx, by, cx, cy, w1, w2, color, outline = true) => {
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    if (outline) {
      ctx.strokeStyle = BK.PAL.ink;
      ctx.lineWidth = w1 + D.OUT * 2; ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.stroke();
      ctx.lineWidth = w2 + D.OUT * 2; ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(cx, cy); ctx.stroke();
    }
    ctx.strokeStyle = color;
    ctx.lineWidth = w1; ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.stroke();
    ctx.lineWidth = w2; ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(cx, cy); ctx.stroke();
  };
  D.poly = pts => {
    ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
    ctx.closePath();
  };
  D.rr = (x, y, w, h, r) => {
    r = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  };
  D.circle = (x, y, r) => { ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); };
  D.fillOut = (fill, w = 3) => { ctx.fillStyle = fill; ctx.fill(); ctx.strokeStyle = BK.PAL.ink; ctx.lineWidth = w; ctx.lineJoin = 'round'; ctx.stroke(); };
  D.text = (str, x, y, font, color, align = 'center', base = 'middle') => {
    ctx.font = font; ctx.fillStyle = color; ctx.textAlign = align; ctx.textBaseline = base; ctx.fillText(str, x, y);
  };
  // Parallelogram, used for the fight-game style bars.
  D.slant = (x, y, w, h, sk) => D.poly([[x + sk, y], [x + w + sk, y], [x + w, y + h], [x, y + h]]);
})();
