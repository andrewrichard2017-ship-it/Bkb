// Bubble Odyssey: pre-rendered sprites. Every bubble (six colours, the specials, the power-up shots and the
// Blips inside their bubbles) is painted once into a small canvas at the current zoom, then stamped.
(() => {
  'use strict';
  const BB = window.BB, TAU = Math.PI * 2;
  BB.PAL = [
    { name: 'red', base: '#ff3b5c', light: '#ffc0cb', dark: '#9e0828', glow: '#ff6a85' },
    { name: 'blue', base: '#2d8bff', light: '#b5dcff', dark: '#0a3796', glow: '#5aa8ff' },
    { name: 'yellow', base: '#ffcf24', light: '#fff8c2', dark: '#b06d00', glow: '#ffe066' },
    { name: 'green', base: '#2fd16a', light: '#c2fad2', dark: '#0b7232', glow: '#5fe68c' },
    { name: 'purple', base: '#a65bff', light: '#e6d0ff', dark: '#4a12a0', glow: '#c08aff' },
    { name: 'orange', base: '#ff861a', light: '#ffd9ad', dark: '#a33f00', glow: '#ffa64d' },
  ];
  const PAD = 1.32;     // sprite half-size in bubble radii (room for the shadow)
  BB.SPRITE_PAD = PAD;
  const mk = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
  const rgba = (hex, a) => { const n = parseInt(hex.slice(1), 16); return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`; };
  BB.rgba = rgba;

  function canvasFor(rp) { const S = Math.ceil(rp * PAD * 2); const cv = mk(S, S), c = cv.getContext('2d'); c.translate(S / 2, S / 2); return [cv, c]; }
  function shadow(c, r) {
    const sh = c.createRadialGradient(r * 0.08, r * 0.22, r * 0.55, r * 0.08, r * 0.22, r * 1.25);
    sh.addColorStop(0, 'rgba(0,0,10,0.34)'); sh.addColorStop(1, 'rgba(0,0,10,0)');
    c.fillStyle = sh; c.beginPath(); c.arc(r * 0.08, r * 0.22, r * 1.25, 0, TAU); c.fill();
  }
  function body(c, r, col, alpha = 1) {
    c.save(); c.globalAlpha = alpha;
    const g = c.createRadialGradient(-r * 0.36, -r * 0.42, r * 0.04, -r * 0.1, -r * 0.12, r * 1.18);
    g.addColorStop(0, col.light); g.addColorStop(0.33, col.base); g.addColorStop(0.82, col.dark); g.addColorStop(1, '#14061a');
    c.fillStyle = g; c.beginPath(); c.arc(0, 0, r, 0, TAU); c.fill();
    // light bouncing up from below
    c.save(); c.beginPath(); c.arc(0, 0, r, 0, TAU); c.clip();
    const g2 = c.createRadialGradient(r * 0.2, r * 0.75, 0, r * 0.2, r * 0.75, r * 0.75);
    g2.addColorStop(0, rgba(col.light, 0.55)); g2.addColorStop(1, rgba(col.light, 0));
    c.fillStyle = g2; c.fillRect(-r, -r, r * 2, r * 2);
    c.restore();
    c.lineWidth = Math.max(1, r * 0.06); c.strokeStyle = 'rgba(10,0,20,0.35)';
    c.beginPath(); c.arc(0, 0, r * 0.97, 0, TAU); c.stroke();
    c.restore();
  }
  function gloss(c, r, a = 1) {
    c.save(); c.translate(-r * 0.3, -r * 0.44); c.rotate(-0.5);
    const hg = c.createLinearGradient(0, -r * 0.22, 0, r * 0.24);
    hg.addColorStop(0, `rgba(255,255,255,${0.95 * a})`); hg.addColorStop(1, `rgba(255,255,255,${0.08 * a})`);
    c.fillStyle = hg; c.beginPath(); c.ellipse(0, 0, r * 0.42, r * 0.22, 0, 0, TAU); c.fill();
    c.restore();
    c.fillStyle = `rgba(255,255,255,${0.85 * a})`; c.beginPath(); c.arc(-r * 0.6, -r * 0.05, r * 0.065, 0, TAU); c.fill();
    c.fillStyle = `rgba(255,255,255,${0.3 * a})`; c.beginPath(); c.ellipse(r * 0.42, r * 0.5, r * 0.16, r * 0.08, -0.7, 0, TAU); c.fill();
  }
  // colour-blind symbols: heart, drop, star, leaf, diamond, square
  function symbol(c, i, s) {
    c.save(); c.beginPath();
    if (i === 0) { c.moveTo(0, s * 0.8); c.bezierCurveTo(-s * 1.3, -s * 0.1, -s * 0.5, -s * 1.05, 0, -s * 0.38); c.bezierCurveTo(s * 0.5, -s * 1.05, s * 1.3, -s * 0.1, 0, s * 0.8); }
    else if (i === 1) { c.moveTo(0, -s); c.bezierCurveTo(s * 0.4, -s * 0.4, s * 0.75, 0, s * 0.75, s * 0.25); c.arc(0, s * 0.25, s * 0.75, 0, Math.PI); c.bezierCurveTo(-s * 0.75, 0, -s * 0.4, -s * 0.4, 0, -s); }
    else if (i === 2) { for (let k = 0; k < 10; k++) { const a = -Math.PI / 2 + k * Math.PI / 5, rr = k % 2 ? s * 0.42 : s; c.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); } }
    else if (i === 3) { c.moveTo(-s * 0.8, s * 0.8); c.quadraticCurveTo(-s, -s * 0.9, s * 0.85, -s * 0.85); c.quadraticCurveTo(s * 0.9, s, -s * 0.8, s * 0.8); }
    else if (i === 4) { c.moveTo(0, -s); c.lineTo(s * 0.8, 0); c.lineTo(0, s); c.lineTo(-s * 0.8, 0); }
    else { c.rect(-s * 0.7, -s * 0.7, s * 1.4, s * 1.4); }
    c.closePath();
    c.fillStyle = 'rgba(255,255,255,0.7)'; c.strokeStyle = 'rgba(30,0,40,0.45)'; c.lineWidth = Math.max(1, s * 0.16);
    c.stroke(); c.fill(); c.restore();
  }
  function blip(c, r, closed) {
    // a Blip: round, fluffy, big eyes
    const s = r * 0.62;
    c.save();
    c.fillStyle = '#ffeccc';
    c.beginPath(); c.ellipse(-s * 0.62, -s * 0.72, s * 0.28, s * 0.36, -0.5, 0, TAU); c.ellipse(s * 0.62, -s * 0.72, s * 0.28, s * 0.36, 0.5, 0, TAU); c.fill();
    c.fillStyle = '#ffb3c6';
    c.beginPath(); c.ellipse(-s * 0.62, -s * 0.72, s * 0.13, s * 0.2, -0.5, 0, TAU); c.ellipse(s * 0.62, -s * 0.72, s * 0.13, s * 0.2, 0.5, 0, TAU); c.fill();
    const g = c.createRadialGradient(-s * 0.3, -s * 0.35, s * 0.1, 0, 0, s * 1.05);
    g.addColorStop(0, '#fffaf0'); g.addColorStop(1, '#f2c98f');
    c.fillStyle = g; c.beginPath(); c.arc(0, s * 0.05, s, 0, TAU); c.fill();
    if (closed) {
      c.strokeStyle = '#2a1830'; c.lineWidth = s * 0.12; c.lineCap = 'round';
      for (const ex of [-0.38, 0.38]) { c.beginPath(); c.arc(s * ex, -s * 0.02, s * 0.2, 0.2, Math.PI - 0.2); c.stroke(); }
    } else {
      for (const ex of [-0.38, 0.38]) {
        c.fillStyle = '#2a1830'; c.beginPath(); c.ellipse(s * ex, -s * 0.05, s * 0.21, s * 0.27, 0, 0, TAU); c.fill();
        c.fillStyle = '#fff'; c.beginPath(); c.arc(s * ex - s * 0.07, -s * 0.15, s * 0.08, 0, TAU); c.fill();
      }
    }
    c.fillStyle = 'rgba(255,110,150,0.55)';
    c.beginPath(); c.ellipse(-s * 0.68, s * 0.3, s * 0.17, s * 0.1, 0, 0, TAU); c.ellipse(s * 0.68, s * 0.3, s * 0.17, s * 0.1, 0, 0, TAU); c.fill();
    c.strokeStyle = '#2a1830'; c.lineWidth = s * 0.09; c.lineCap = 'round';
    c.beginPath(); c.arc(0, s * 0.3, s * 0.17, 0.25, Math.PI - 0.25); c.stroke();
    c.restore();
  }
  function bubbleShell(c, r, col) {
    // a see-through bubble around a Blip
    const g = c.createRadialGradient(-r * 0.3, -r * 0.4, r * 0.2, 0, 0, r);
    g.addColorStop(0, rgba(col.light, 0.12)); g.addColorStop(0.7, rgba(col.base, 0.32)); g.addColorStop(1, rgba(col.dark, 0.85));
    c.fillStyle = g; c.beginPath(); c.arc(0, 0, r, 0, TAU); c.fill();
    c.lineWidth = Math.max(1.5, r * 0.13); c.strokeStyle = rgba(col.base, 0.95);
    c.beginPath(); c.arc(0, 0, r * 0.93, 0, TAU); c.stroke();
    c.lineWidth = Math.max(1, r * 0.05); c.strokeStyle = rgba(col.light, 0.7);
    c.beginPath(); c.arc(0, 0, r * 0.84, 0, TAU); c.stroke();
  }

  const S = BB.sprites = { rp: 0, sym: null };
  S.build = (rp, sym) => {
    if (Math.abs(rp - S.rp) < 0.5 && sym === S.sym) return;
    S.rp = rp; S.sym = sym;
    const r = rp * 0.98;
    S.color = BB.PAL.map((col, i) => { const [cv, c] = canvasFor(rp); shadow(c, r); body(c, r, col); gloss(c, r); if (sym) symbol(c, i, r * 0.34); return cv; });
    S.crit = BB.PAL.map((col, i) => [false, true].map(closed => { const [cv, c] = canvasFor(rp); shadow(c, r); c.save(); c.beginPath(); c.arc(0, 0, r, 0, TAU); c.clip(); c.fillStyle = rgba(col.dark, 0.55); c.fillRect(-r, -r, 2 * r, 2 * r); blip(c, r, closed); c.restore(); bubbleShell(c, r, col); gloss(c, r, 0.9); if (sym) { c.save(); c.translate(r * 0.62, r * 0.6); symbol(c, i, r * 0.2); c.restore(); } return cv; }));
    S.ice = BB.PAL.map((col, i) => {
      const [cv, c] = canvasFor(rp); shadow(c, r); body(c, r, col); if (sym) symbol(c, i, r * 0.3);
      c.save(); c.beginPath(); c.arc(0, 0, r, 0, TAU); c.clip();
      c.fillStyle = 'rgba(220,245,255,0.42)'; c.fillRect(-r, -r, 2 * r, 2 * r);
      c.strokeStyle = 'rgba(255,255,255,0.75)'; c.lineWidth = Math.max(1, r * 0.06);
      c.beginPath(); c.moveTo(-r, -r * 0.2); c.lineTo(-r * 0.2, -r * 0.5); c.lineTo(r * 0.3, -r); c.moveTo(-r * 0.2, -r * 0.5); c.lineTo(r * 0.05, r * 0.15); c.lineTo(r, r * 0.05); c.moveTo(r * 0.05, r * 0.15); c.lineTo(-r * 0.3, r); c.stroke();
      c.restore();
      c.lineWidth = Math.max(1.5, r * 0.14); c.strokeStyle = 'rgba(225,248,255,0.9)'; c.beginPath(); c.arc(0, 0, r * 0.92, 0, TAU); c.stroke();
      gloss(c, r, 1.1);
      return cv;
    });
    S.cham = BB.PAL.map((col, i) => {
      const [cv, c] = canvasFor(rp); shadow(c, r); body(c, r, col); if (sym) symbol(c, i, r * 0.28);
      for (let k = 0; k < 12; k++) { const a = k / 12 * TAU; c.fillStyle = BB.PAL[k % 6].base; c.strokeStyle = 'rgba(255,255,255,0.8)'; c.lineWidth = Math.max(1, r * 0.03); c.beginPath(); c.arc(Math.cos(a) * r * 0.74, Math.sin(a) * r * 0.74, r * 0.13, 0, TAU); c.fill(); c.stroke(); }
      gloss(c, r);
      return cv;
    });
    { // stone
      const [cv, c] = canvasFor(rp); shadow(c, r);
      const g = c.createRadialGradient(-r * 0.35, -r * 0.4, r * 0.05, 0, 0, r * 1.1);
      g.addColorStop(0, '#d9d6d0'); g.addColorStop(0.5, '#8e8a84'); g.addColorStop(1, '#3b3834');
      c.fillStyle = g; c.beginPath(); c.arc(0, 0, r, 0, TAU); c.fill();
      const rnd = BB.rng(7);
      for (let k = 0; k < 7; k++) { const a = rnd() * TAU, d = rnd() * r * 0.65, s2 = r * (0.08 + rnd() * 0.14); c.fillStyle = 'rgba(40,36,32,0.45)'; c.beginPath(); c.arc(Math.cos(a) * d, Math.sin(a) * d, s2, 0, TAU); c.fill(); c.fillStyle = 'rgba(255,255,255,0.25)'; c.beginPath(); c.arc(Math.cos(a) * d - s2 * 0.3, Math.sin(a) * d - s2 * 0.3, s2 * 0.5, 0, TAU); c.fill(); }
      c.strokeStyle = 'rgba(30,26,22,0.6)'; c.lineWidth = Math.max(1, r * 0.06);
      c.beginPath(); c.moveTo(-r * 0.2, -r * 0.95); c.lineTo(-r * 0.05, -r * 0.4); c.lineTo(-r * 0.35, r * 0.1); c.moveTo(-r * 0.05, -r * 0.4); c.lineTo(r * 0.4, -r * 0.1); c.stroke();
      c.lineWidth = Math.max(1, r * 0.06); c.strokeStyle = 'rgba(0,0,0,0.4)'; c.beginPath(); c.arc(0, 0, r * 0.97, 0, TAU); c.stroke();
      S.stone = cv;
    }
    { // bomb
      const [cv, c] = canvasFor(rp); shadow(c, r);
      const g = c.createRadialGradient(-r * 0.35, -r * 0.4, r * 0.05, 0, 0, r * 1.1);
      g.addColorStop(0, '#6d7290'); g.addColorStop(0.4, '#2a2d42'); g.addColorStop(1, '#06070e');
      c.fillStyle = g; c.beginPath(); c.arc(0, r * 0.08, r * 0.9, 0, TAU); c.fill();
      c.fillStyle = '#ff3b3b'; c.beginPath(); c.arc(0, r * 0.08, r * 0.9, -0.28, 0.28); c.arc(0, r * 0.08, r * 0.62, 0.28, -0.28, true); c.fill();
      c.fillStyle = '#4b4f66'; c.fillRect(-r * 0.24, -r * 0.92, r * 0.48, r * 0.3);
      c.strokeStyle = '#c8a46a'; c.lineWidth = r * 0.12; c.lineCap = 'round';
      c.beginPath(); c.moveTo(0, -r * 0.92); c.quadraticCurveTo(r * 0.15, -r * 1.2, r * 0.42, -r * 1.12); c.stroke();
      gloss(c, r * 0.9, 0.7);
      S.bomb = cv;
    }
    { // star bubble
      const [cv, c] = canvasFor(rp); shadow(c, r);
      body(c, r, { light: '#fffbe0', base: '#ffc928', dark: '#b8730a' });
      c.save(); c.beginPath();
      for (let k = 0; k < 10; k++) { const a = -Math.PI / 2 + k * Math.PI / 5, rr = k % 2 ? r * 0.27 : r * 0.62; c.lineTo(Math.cos(a) * rr, Math.sin(a) * rr + r * 0.04); }
      c.closePath(); c.fillStyle = '#fff'; c.strokeStyle = '#c47a00'; c.lineWidth = Math.max(1, r * 0.08); c.lineJoin = 'round'; c.stroke(); c.fill(); c.restore();
      gloss(c, r, 0.8);
      S.star = cv;
    }
    { // rainbow shot
      const [cv, c] = canvasFor(rp); shadow(c, r);
      c.save(); c.beginPath(); c.arc(0, 0, r, 0, TAU); c.clip();
      for (let k = 0; k < 6; k++) { c.fillStyle = BB.PAL[k].base; c.beginPath(); c.moveTo(0, 0); c.arc(0, 0, r, k / 6 * TAU - 1.2, (k + 1) / 6 * TAU - 1.2); c.fill(); }
      const g = c.createRadialGradient(0, 0, 0, 0, 0, r); g.addColorStop(0, 'rgba(255,255,255,0.95)'); g.addColorStop(0.35, 'rgba(255,255,255,0.25)'); g.addColorStop(1, 'rgba(0,0,0,0.3)');
      c.fillStyle = g; c.fillRect(-r, -r, 2 * r, 2 * r); c.restore();
      c.lineWidth = Math.max(1, r * 0.06); c.strokeStyle = 'rgba(255,255,255,0.7)'; c.beginPath(); c.arc(0, 0, r * 0.97, 0, TAU); c.stroke();
      gloss(c, r);
      S.rainbow = cv;
    }
    { // lightning shot
      const [cv, c] = canvasFor(rp); shadow(c, r);
      body(c, r, { light: '#ffffff', base: '#4fd8ff', dark: '#1046b8' });
      c.beginPath(); c.moveTo(r * 0.12, -r * 0.75); c.lineTo(-r * 0.38, r * 0.08); c.lineTo(-r * 0.02, r * 0.08); c.lineTo(-r * 0.18, r * 0.78); c.lineTo(r * 0.4, -r * 0.12); c.lineTo(r * 0.04, -r * 0.12); c.closePath();
      c.fillStyle = '#fff9c4'; c.strokeStyle = '#1a3a8a'; c.lineWidth = Math.max(1, r * 0.07); c.lineJoin = 'round'; c.stroke(); c.fill();
      gloss(c, r, 0.8);
      S.zap = cv;
    }
    { // fireball core
      const [cv, c] = canvasFor(rp);
      const g = c.createRadialGradient(0, 0, 0, 0, 0, r * 1.25);
      g.addColorStop(0, '#fffbe6'); g.addColorStop(0.3, '#ffd24a'); g.addColorStop(0.6, '#ff7a1a'); g.addColorStop(0.85, 'rgba(230,40,10,0.6)'); g.addColorStop(1, 'rgba(200,20,0,0)');
      c.fillStyle = g; c.beginPath(); c.arc(0, 0, r * 1.25, 0, TAU); c.fill();
      S.fire = cv;
    }
    { // soft glow dot, tinted at draw time with globalAlpha
      const [cv, c] = canvasFor(rp);
      const g = c.createRadialGradient(0, 0, 0, 0, 0, r * 1.3); g.addColorStop(0, 'rgba(255,255,255,0.9)'); g.addColorStop(0.4, 'rgba(255,255,255,0.35)'); g.addColorStop(1, 'rgba(255,255,255,0)');
      c.fillStyle = g; c.fillRect(-r * 1.3, -r * 1.3, r * 2.6, r * 2.6);
      S.glow = cv;
    }
    S.glows = BB.PAL.map(col => { const [cv, c] = canvasFor(rp); const g = c.createRadialGradient(0, 0, 0, 0, 0, r * 1.3); g.addColorStop(0, rgba(col.glow, 0.9)); g.addColorStop(0.5, rgba(col.glow, 0.3)); g.addColorStop(1, rgba(col.glow, 0)); c.fillStyle = g; c.fillRect(-r * 1.3, -r * 1.3, r * 2.6, r * 2.6); return cv; });
  };
  // the sprite for a board cell or a shot
  S.forCell = (v, t, key) => {
    const K = BB.K;
    switch (v.k) {
      case K.STONE: return S.stone;
      case K.BOMB: return S.bomb;
      case K.STAR: return S.star;
      case K.ICE: return S.ice[v.c] || S.color[0];
      case K.CHAM: return S.cham[v.c] || S.color[0];
      case K.CRIT: { const blink = ((t * 0.7 + (key || 0) * 0.37) % 3.2) > 3.05; return (S.crit[v.c] || S.crit[0])[blink ? 1 : 0]; }
      default: return S.color[v.c] || S.rainbow;
    }
  };
  S.forShot = s => s.power === 'rainbow' ? S.rainbow : s.power === 'bomb' ? S.bomb : s.power === 'zap' ? S.zap : s.power === 'fire' ? S.fire : S.color[s.color] || S.rainbow;
  S.forPower = k => k === 'rainbow' ? S.rainbow : k === 'bomb' ? S.bomb : k === 'zap' ? S.zap : k === 'fire' ? S.fire : null;
  S.drawBlip = blip;
})();
