// Bubble Odyssey: the five world backdrops. Each paints a still layer once (sky, hills, coral, crystals,
// planets) into an offscreen canvas when the size or world changes, then animates a few things on top every
// frame (clouds and butterflies, light rays and fish, falling sprinkles, glowing crystals, twinkling stars).
(() => {
  'use strict';
  const BB = window.BB, TAU = Math.PI * 2;
  const BG = BB.bg = { id: null, cv: null, w: 0, h: 0, dpr: 1, parts: [], t: 0 };
  const mk = (w, h) => { const c = document.createElement('canvas'); c.width = Math.max(1, w); c.height = Math.max(1, h); return c; };
  const lin = (c, x0, y0, x1, y1, stops) => { const g = c.createLinearGradient(x0, y0, x1, y1); for (const [o, col] of stops) g.addColorStop(o, col); return g; };
  const rad = (c, x, y, r0, r1, stops, x1 = x, y1 = y) => { const g = c.createRadialGradient(x, y, r0, x1, y1, r1); for (const [o, col] of stops) g.addColorStop(o, col); return g; };
  function hills(c, w, h, base, amp, seed, fill, n = 3) {
    const rnd = BB.rng(seed), ph = [rnd() * TAU, rnd() * TAU, rnd() * TAU], fr = [1.3 + rnd(), 2.6 + rnd() * 2, 5 + rnd() * 3];
    c.beginPath(); c.moveTo(0, h);
    for (let x = 0; x <= w + 8; x += 8) {
      const u = x / w;
      let y = base;
      for (let i = 0; i < n; i++) y -= Math.sin(u * fr[i] * TAU / 2 + ph[i]) * amp / (i + 1);
      c.lineTo(x, y);
    }
    c.lineTo(w, h); c.closePath(); c.fillStyle = fill; c.fill();
  }
  function cloudSprite(scale, tint = '#ffffff', shade = 'rgba(160,190,230,0.55)', seed = 1) {
    const w = Math.ceil(260 * scale), h = Math.ceil(110 * scale), cv = mk(w, h), c = cv.getContext('2d'), rnd = BB.rng(seed);
    const puffs = [];
    for (let i = 0; i < 7; i++) puffs.push([w * (0.18 + i * 0.11) + rnd() * 10 * scale, h * (0.62 - Math.sin(i / 6 * Math.PI) * 0.28), h * (0.2 + Math.sin(i / 6 * Math.PI) * 0.18 + rnd() * 0.06)]);
    c.fillStyle = shade; for (const [x, y, r] of puffs) { c.beginPath(); c.arc(x, y + r * 0.18, r, 0, TAU); c.fill(); }
    c.fillStyle = tint; for (const [x, y, r] of puffs) { c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill(); }
    c.fillStyle = 'rgba(255,255,255,0.6)'; for (const [x, y, r] of puffs) { c.beginPath(); c.arc(x - r * 0.25, y - r * 0.3, r * 0.45, 0, TAU); c.fill(); }
    return cv;
  }
  function glowDot(c, x, y, r, col, a) { c.globalAlpha = a; c.fillStyle = rad(c, x, y, 0, r, [[0, col], [1, 'rgba(0,0,0,0)']]); c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill(); c.globalAlpha = 1; }

  const THEMES = {
    meadow: {
      paint(c, w, h, m) {
        c.fillStyle = lin(c, 0, 0, 0, h, [[0, '#3fa9ff'], [0.42, '#8fd6ff'], [0.72, '#ffe9bd'], [1, '#ffd49a']]); c.fillRect(0, 0, w, h);
        c.fillStyle = rad(c, w * 0.8, h * 0.17, 0, m * 0.5, [[0, 'rgba(255,252,225,0.95)'], [0.18, 'rgba(255,240,180,0.5)'], [1, 'rgba(255,240,180,0)']]); c.fillRect(0, 0, w, h);
        c.fillStyle = '#fff8d6'; c.beginPath(); c.arc(w * 0.8, h * 0.17, m * 0.065, 0, TAU); c.fill();
        hills(c, w, h, h * 0.66, h * 0.07, 3, lin(c, 0, h * 0.5, 0, h, [[0, '#a9dcb0'], [1, '#8cc7a0']]));
        hills(c, w, h, h * 0.74, h * 0.06, 8, lin(c, 0, h * 0.6, 0, h, [[0, '#7fd06a'], [1, '#4f9e48']]));
        // round trees on the middle hills
        const rnd = BB.rng(11);
        for (let i = 0; i < 14; i++) {
          const x = rnd() * w, y = h * (0.7 + rnd() * 0.06), s = m * (0.018 + rnd() * 0.016);
          c.fillStyle = '#7a5530'; c.fillRect(x - s * 0.18, y - s * 0.4, s * 0.36, s * 1.4);
          c.fillStyle = '#3f8f3a'; c.beginPath(); c.arc(x, y - s, s, 0, TAU); c.arc(x - s * 0.6, y - s * 0.6, s * 0.7, 0, TAU); c.arc(x + s * 0.6, y - s * 0.6, s * 0.7, 0, TAU); c.fill();
          c.fillStyle = 'rgba(255,255,255,0.18)'; c.beginPath(); c.arc(x - s * 0.3, y - s * 1.3, s * 0.45, 0, TAU); c.fill();
        }
        hills(c, w, h, h * 0.86, h * 0.05, 21, lin(c, 0, h * 0.75, 0, h, [[0, '#56b947'], [1, '#2f7d30']]));
        for (let i = 0; i < 260; i++) {
          const x = rnd() * w, y = h * (0.84 + rnd() * 0.16), s = m * (0.003 + rnd() * 0.004);
          c.fillStyle = ['#ffffff', '#ffd1e8', '#fff07a', '#ff9ec7', '#c9b8ff'][i % 5];
          c.beginPath(); c.arc(x, y, s, 0, TAU); c.fill();
        }
      },
      init(w, h, m) {
        const rnd = BB.rng(5), P = [];
        for (let i = 0; i < 5; i++) P.push({ k: 'cloud', cv: cloudSprite(m / 900 * (0.8 + rnd() * 0.7), '#ffffff', 'rgba(150,185,230,0.5)', i + 1), x: rnd() * w, y: h * (0.06 + rnd() * 0.36), v: 4 + rnd() * 9 });
        for (let i = 0; i < 5; i++) P.push({ k: 'fly', x: rnd() * w, y: h * (0.55 + rnd() * 0.35), ph: rnd() * TAU, col: ['#ffb347', '#ff7ac8', '#7ad7ff', '#fff07a', '#c49bff'][i], s: m * 0.012 });
        for (let i = 0; i < 26; i++) P.push({ k: 'pollen', x: rnd() * w, y: rnd() * h, v: 6 + rnd() * 12, ph: rnd() * TAU });
        return P;
      },
      draw(c, w, h, t, dt, P) {
        for (const p of P) {
          if (p.k === 'cloud') { p.x += p.v * dt; if (p.x > w + 20) p.x = -p.cv.width; c.drawImage(p.cv, p.x, p.y); }
          else if (p.k === 'fly') {
            const x = p.x + Math.sin(t * 0.4 + p.ph) * w * 0.08 + Math.sin(t * 1.7 + p.ph) * 12, y = p.y + Math.sin(t * 0.9 + p.ph * 2) * 18, f = Math.abs(Math.sin(t * 14 + p.ph));
            c.fillStyle = p.col; c.globalAlpha = 0.9;
            c.beginPath(); c.ellipse(x - p.s * 0.6 * f, y, p.s * f, p.s * 0.8, -0.3, 0, TAU); c.ellipse(x + p.s * 0.6 * f, y, p.s * f, p.s * 0.8, 0.3, 0, TAU); c.fill();
            c.fillStyle = '#3a2a1a'; c.fillRect(x - 1, y - p.s * 0.6, 2, p.s * 1.2); c.globalAlpha = 1;
          } else { p.y -= p.v * dt; if (p.y < -5) p.y = h + 5; glowDot(c, p.x + Math.sin(t + p.ph) * 10, p.y, 4, 'rgba(255,255,220,0.9)', 0.35 + 0.3 * Math.sin(t * 2 + p.ph)); }
        }
      },
    },
    reef: {
      paint(c, w, h, m) {
        c.fillStyle = lin(c, 0, 0, 0, h, [[0, '#22b4e0'], [0.35, '#0d78b4'], [0.75, '#064579'], [1, '#032a4c']]); c.fillRect(0, 0, w, h);
        c.fillStyle = rad(c, w * 0.5, -h * 0.1, 0, h * 0.7, [[0, 'rgba(200,250,255,0.45)'], [1, 'rgba(200,250,255,0)']]); c.fillRect(0, 0, w, h);
        hills(c, w, h, h * 0.8, h * 0.06, 4, 'rgba(4,40,80,0.55)');
        // sand
        hills(c, w, h, h * 0.92, h * 0.025, 9, lin(c, 0, h * 0.86, 0, h, [[0, '#f0d898'], [1, '#b8955a']]), 2);
        const rnd = BB.rng(17);
        const coral = (x, y, len, ang, wd, col, depth) => {
          if (depth <= 0 || len < 3) return;
          const x2 = x + Math.cos(ang) * len, y2 = y + Math.sin(ang) * len;
          c.strokeStyle = col; c.lineWidth = wd; c.lineCap = 'round';
          c.beginPath(); c.moveTo(x, y); c.quadraticCurveTo(x + Math.cos(ang + 0.4) * len * 0.5, y + Math.sin(ang + 0.4) * len * 0.5, x2, y2); c.stroke();
          coral(x2, y2, len * 0.72, ang - 0.45 - rnd() * 0.3, wd * 0.72, col, depth - 1);
          coral(x2, y2, len * 0.72, ang + 0.45 + rnd() * 0.3, wd * 0.72, col, depth - 1);
        };
        const cols = ['#ff6f91', '#ff9a4d', '#c77dff', '#ff5e7e', '#ffc04d'];
        for (let i = 0; i < 11; i++) {
          const side = i % 2 ? rnd() * w * 0.28 : w - rnd() * w * 0.28, y = h * (0.9 + rnd() * 0.06);
          coral(side, y, m * (0.05 + rnd() * 0.05), -Math.PI / 2 + (rnd() - 0.5) * 0.5, m * 0.014, cols[i % cols.length], 5);
        }
        for (let i = 0; i < 6; i++) { // brain coral and rocks
          const x = rnd() * w, y = h * (0.93 + rnd() * 0.04), r = m * (0.03 + rnd() * 0.03);
          c.fillStyle = i % 2 ? '#2f4a6a' : '#ff8fa8'; c.beginPath(); c.ellipse(x, y, r * 1.4, r, 0, Math.PI, 0); c.fill();
          c.strokeStyle = 'rgba(0,0,0,0.18)'; c.lineWidth = 2; for (let k = 1; k < 4; k++) { c.beginPath(); c.ellipse(x, y, r * 1.4 * k / 4, r * k / 4, 0, Math.PI, 0); c.stroke(); }
        }
        for (let i = 0; i < 120; i++) { c.fillStyle = 'rgba(255,255,255,0.18)'; c.beginPath(); c.arc(rnd() * w, h * (0.92 + rnd() * 0.08), 1 + rnd() * 1.5, 0, TAU); c.fill(); }
      },
      init(w, h, m) {
        const rnd = BB.rng(6), P = [];
        for (let i = 0; i < 6; i++) P.push({ k: 'ray', x: w * (i / 5) + rnd() * 60, wd: m * (0.05 + rnd() * 0.08), ph: rnd() * TAU });
        for (let i = 0; i < 10; i++) P.push({ k: 'weed', x: rnd() * w, len: h * (0.12 + rnd() * 0.16), ph: rnd() * TAU, col: rnd() < 0.5 ? '#2fbf71' : '#1f9e5c' });
        for (let i = 0; i < 7; i++) P.push({ k: 'fish', x: rnd() * w, y: h * (0.2 + rnd() * 0.6), v: (rnd() < 0.5 ? -1 : 1) * (18 + rnd() * 30), s: m * (0.012 + rnd() * 0.012), col: ['#ffb347', '#ffe066', '#ff7aa8', '#7fe0ff', '#ffffff'][i % 5], ph: rnd() * TAU });
        for (let i = 0; i < 34; i++) P.push({ k: 'bub', x: rnd() * w, y: rnd() * h, v: 20 + rnd() * 40, r: 1.5 + rnd() * 4.5, ph: rnd() * TAU });
        return P;
      },
      draw(c, w, h, t, dt, P) {
        c.globalCompositeOperation = 'lighter';
        for (const p of P) if (p.k === 'ray') {
          const a = 0.06 + 0.05 * Math.sin(t * 0.5 + p.ph), sx = p.x + Math.sin(t * 0.2 + p.ph) * 30;
          c.fillStyle = lin(c, 0, 0, 0, h * 0.85, [[0, `rgba(210,250,255,${a})`], [1, 'rgba(210,250,255,0)']]);
          c.beginPath(); c.moveTo(sx, 0); c.lineTo(sx + p.wd, 0); c.lineTo(sx + p.wd * 2.6 + h * 0.25, h * 0.85); c.lineTo(sx + h * 0.25, h * 0.85); c.fill();
        }
        c.globalCompositeOperation = 'source-over';
        for (const p of P) {
          if (p.k === 'weed') {
            c.strokeStyle = p.col; c.lineWidth = 6; c.lineCap = 'round';
            c.beginPath(); c.moveTo(p.x, h);
            const sw = Math.sin(t * 1.1 + p.ph) * 22;
            c.bezierCurveTo(p.x + sw, h - p.len * 0.35, p.x - sw, h - p.len * 0.7, p.x + sw * 1.4, h - p.len); c.stroke();
          } else if (p.k === 'fish') {
            p.x += p.v * dt; if (p.x < -60) p.x = w + 60; if (p.x > w + 60) p.x = -60;
            const d = Math.sign(p.v), y = p.y + Math.sin(t * 0.8 + p.ph) * 10, wag = Math.sin(t * 9 + p.ph) * 0.35;
            c.save(); c.translate(p.x, y); c.scale(d, 1); c.globalAlpha = 0.85;
            for (let k = 0; k < 3; k++) {
              const ox = -k * p.s * 3.2, oy = (k % 2 ? 1 : -1) * k * p.s * 1.4;
              c.fillStyle = p.col; c.beginPath(); c.ellipse(ox, oy, p.s * 1.4, p.s * 0.75, 0, 0, TAU); c.fill();
              c.beginPath(); c.moveTo(ox - p.s * 1.1, oy); c.lineTo(ox - p.s * 2.1, oy - p.s * (0.7 + wag)); c.lineTo(ox - p.s * 2.1, oy + p.s * (0.7 - wag)); c.fill();
              c.fillStyle = '#102030'; c.beginPath(); c.arc(ox + p.s * 0.7, oy - p.s * 0.15, p.s * 0.18, 0, TAU); c.fill();
            }
            c.restore();
          } else if (p.k === 'bub') {
            p.y -= p.v * dt; if (p.y < -10) { p.y = h + 10; p.x = Math.random() * w; }
            const x = p.x + Math.sin(t * 2 + p.ph) * 6;
            c.strokeStyle = 'rgba(220,250,255,0.55)'; c.lineWidth = 1.2; c.beginPath(); c.arc(x, p.y, p.r, 0, TAU); c.stroke();
            c.fillStyle = 'rgba(255,255,255,0.6)'; c.beginPath(); c.arc(x - p.r * 0.35, p.y - p.r * 0.35, p.r * 0.3, 0, TAU); c.fill();
          }
        }
      },
    },
    candy: {
      paint(c, w, h, m) {
        c.fillStyle = lin(c, 0, 0, 0, h, [[0, '#ff9fd8'], [0.45, '#d6a6ff'], [1, '#8fdcff']]); c.fillRect(0, 0, w, h);
        c.fillStyle = rad(c, w * 0.2, h * 0.2, 0, m * 0.5, [[0, 'rgba(255,255,255,0.6)'], [1, 'rgba(255,255,255,0)']]); c.fillRect(0, 0, w, h);
        const rnd = BB.rng(23);
        // candy hills with stripes
        hills(c, w, h, h * 0.76, h * 0.06, 31, lin(c, 0, h * 0.6, 0, h, [[0, '#ffd6ef'], [1, '#ffb0d8']]));
        // lollipop trees
        for (let i = 0; i < 9; i++) {
          const x = (i + 0.5) / 9 * w + (rnd() - 0.5) * 40, y = h * (0.74 + rnd() * 0.05), s = m * (0.03 + rnd() * 0.025);
          c.fillStyle = '#fff'; c.fillRect(x - s * 0.08, y - s * 1.6, s * 0.16, s * 1.9);
          const col = ['#ff5fa2', '#7fd4ff', '#ffd23f', '#9b7bff', '#5fe0a0'][i % 5];
          c.fillStyle = col; c.beginPath(); c.arc(x, y - s * 2.1, s * 0.75, 0, TAU); c.fill();
          c.strokeStyle = 'rgba(255,255,255,0.85)'; c.lineWidth = s * 0.12;
          c.beginPath(); for (let a = 0; a < 12; a += 0.2) { const rr = s * 0.07 * a; c.lineTo(x + Math.cos(a) * rr, y - s * 2.1 + Math.sin(a) * rr); } c.stroke();
        }
        hills(c, w, h, h * 0.88, h * 0.04, 37, lin(c, 0, h * 0.8, 0, h, [[0, '#fff0f8'], [1, '#ffc6e4']]));
        // gumdrops
        for (let i = 0; i < 14; i++) {
          const x = rnd() * w, y = h * (0.9 + rnd() * 0.08), s = m * (0.012 + rnd() * 0.014), col = ['#ff5f7e', '#5fd0ff', '#ffe35f', '#a77bff', '#6ff0a8'][i % 5];
          c.fillStyle = col; c.beginPath(); c.moveTo(x - s, y); c.quadraticCurveTo(x - s, y - s * 1.6, x, y - s * 1.6); c.quadraticCurveTo(x + s, y - s * 1.6, x + s, y); c.fill();
          c.fillStyle = 'rgba(255,255,255,0.55)'; c.beginPath(); c.arc(x - s * 0.35, y - s * 1.05, s * 0.25, 0, TAU); c.fill();
        }
      },
      init(w, h, m) {
        const rnd = BB.rng(8), P = [];
        for (let i = 0; i < 4; i++) P.push({ k: 'cloud', cv: cloudSprite(m / 800 * (0.9 + rnd() * 0.6), '#fff4fb', 'rgba(255,170,215,0.6)', 20 + i), x: rnd() * w, y: h * (0.05 + rnd() * 0.4), v: 5 + rnd() * 8 });
        const cols = ['#ff4f8b', '#4fc3ff', '#ffe14f', '#9d6bff', '#52e3a0', '#ffffff'];
        for (let i = 0; i < 48; i++) P.push({ k: 'spr', x: rnd() * w, y: rnd() * h, v: 18 + rnd() * 26, rot: rnd() * TAU, vr: (rnd() - 0.5) * 4, col: cols[i % cols.length], s: m * (0.006 + rnd() * 0.004) });
        for (let i = 0; i < 9; i++) P.push({ k: 'heart', x: rnd() * w, y: rnd() * h, v: 10 + rnd() * 12, ph: rnd() * TAU, s: m * (0.008 + rnd() * 0.01) });
        return P;
      },
      draw(c, w, h, t, dt, P) {
        for (const p of P) {
          if (p.k === 'cloud') { p.x += p.v * dt; if (p.x > w + 20) p.x = -p.cv.width; c.drawImage(p.cv, p.x, p.y); }
          else if (p.k === 'spr') {
            p.y += p.v * dt; p.rot += p.vr * dt; if (p.y > h + 10) { p.y = -10; p.x = Math.random() * w; }
            c.save(); c.translate(p.x, p.y); c.rotate(p.rot); c.fillStyle = p.col; c.globalAlpha = 0.85; c.fillRect(-p.s * 1.6, -p.s * 0.45, p.s * 3.2, p.s * 0.9); c.restore();
          } else {
            p.y -= p.v * dt; if (p.y < -20) { p.y = h + 20; p.x = Math.random() * w; }
            const x = p.x + Math.sin(t + p.ph) * 14, s = p.s;
            c.globalAlpha = 0.5 + 0.3 * Math.sin(t * 2 + p.ph); c.fillStyle = '#fff';
            c.beginPath(); c.moveTo(x, p.y + s); c.bezierCurveTo(x - s * 1.6, p.y - s * 0.2, x - s * 0.6, p.y - s * 1.4, x, p.y - s * 0.5); c.bezierCurveTo(x + s * 0.6, p.y - s * 1.4, x + s * 1.6, p.y - s * 0.2, x, p.y + s); c.fill();
          }
        }
        c.globalAlpha = 1;
      },
    },
    caves: {
      paint(c, w, h, m) {
        c.fillStyle = lin(c, 0, 0, 0, h, [[0, '#2a1650'], [0.55, '#1a0d36'], [1, '#0b0618']]); c.fillRect(0, 0, w, h);
        const rnd = BB.rng(41);
        // back walls
        for (const [col, d] of [['#21123f', 0.18], ['#170b30', 0.1]]) {
          c.fillStyle = col;
          c.beginPath(); c.moveTo(0, 0); for (let y = 0; y <= h; y += 20) c.lineTo(w * d + Math.sin(y * 0.02 + d * 9) * w * 0.04 + rnd() * 10, y); c.lineTo(0, h); c.fill();
          c.beginPath(); c.moveTo(w, 0); for (let y = 0; y <= h; y += 20) c.lineTo(w * (1 - d) - Math.sin(y * 0.017 + d * 5) * w * 0.04 - rnd() * 10, y); c.lineTo(w, h); c.fill();
        }
        // stalactites and stalagmites
        for (let i = 0; i < 26; i++) {
          const x = rnd() * w, len = h * (0.05 + rnd() * 0.12), wd = m * (0.015 + rnd() * 0.025);
          c.fillStyle = lin(c, 0, 0, 0, len, [[0, '#120828'], [1, '#2f1c55']]);
          c.beginPath(); c.moveTo(x - wd, 0); c.lineTo(x + wd, 0); c.lineTo(x + wd * 0.1, len); c.fill();
        }
        hills(c, w, h, h * 0.92, h * 0.03, 43, '#0f0820');
        // crystal clusters
        BG.crystals = [];
        const cc = [['#5ff0ff', '#1a7ab0'], ['#ff6ff0', '#8a2a9a'], ['#8cff9a', '#1f8a4a'], ['#b08aff', '#4a2ab0']];
        for (let i = 0; i < 9; i++) {
          const left = i % 2 === 0, x = left ? rnd() * w * 0.26 : w - rnd() * w * 0.26, y = h * (0.6 + rnd() * 0.36), s = m * (0.03 + rnd() * 0.035), [hi, lo] = cc[i % cc.length];
          BG.crystals.push({ x, y: y - s, r: s * 3, col: hi });
          c.fillStyle = rad(c, x, y - s, 0, s * 3, [[0, BB.rgba(hi, 0.35)], [1, BB.rgba(hi, 0)]]); c.fillRect(x - s * 3, y - s * 4, s * 6, s * 6);
          for (let k = 0; k < 5; k++) {
            const a = -Math.PI / 2 + (k - 2) * 0.32 + (rnd() - 0.5) * 0.2, len = s * (1.2 + rnd() * 1.4), wd = s * 0.28;
            c.save(); c.translate(x + (k - 2) * wd * 0.9, y); c.rotate(a + Math.PI / 2);
            c.fillStyle = lin(c, -wd, 0, wd, 0, [[0, lo], [0.5, hi], [1, lo]]);
            c.beginPath(); c.moveTo(-wd, 0); c.lineTo(-wd, -len); c.lineTo(0, -len - wd * 1.3); c.lineTo(wd, -len); c.lineTo(wd, 0); c.fill();
            c.fillStyle = 'rgba(255,255,255,0.35)'; c.beginPath(); c.moveTo(-wd * 0.6, -wd); c.lineTo(-wd * 0.6, -len); c.lineTo(-wd * 0.1, -len - wd * 0.6); c.lineTo(-wd * 0.1, -wd); c.fill();
            c.restore();
          }
        }
      },
      init(w, h, m) {
        const rnd = BB.rng(9), P = [];
        for (let i = 0; i < 30; i++) P.push({ k: 'ff', x: rnd() * w, y: rnd() * h, ph: rnd() * TAU, sp: 0.2 + rnd() * 0.5, col: ['rgba(140,255,240,1)', 'rgba(255,150,255,1)', 'rgba(200,255,150,1)'][i % 3] });
        return P;
      },
      draw(c, w, h, t, dt, P) {
        c.globalCompositeOperation = 'lighter';
        for (const cr of BG.crystals || []) glowDot(c, cr.x, cr.y, cr.r, BB.rgba(cr.col, 0.5), 0.25 + 0.2 * Math.sin(t * 1.3 + cr.x));
        for (const p of P) { const x = p.x + Math.sin(t * p.sp + p.ph) * 40, y = p.y + Math.cos(t * p.sp * 1.3 + p.ph) * 30; glowDot(c, x, y, 7, p.col, 0.35 + 0.35 * Math.sin(t * 3 + p.ph)); }
        c.globalCompositeOperation = 'source-over';
      },
    },
    nebula: {
      paint(c, w, h, m) {
        c.fillStyle = lin(c, 0, 0, w * 0.3, h, [[0, '#0a0420'], [0.5, '#150a38'], [1, '#07031a']]); c.fillRect(0, 0, w, h);
        const rnd = BB.rng(51);
        c.globalCompositeOperation = 'lighter';
        const neb = ['rgba(255,60,190,0.22)', 'rgba(70,190,255,0.18)', 'rgba(150,80,255,0.25)', 'rgba(255,120,80,0.12)'];
        for (let i = 0; i < 9; i++) { const x = rnd() * w, y = rnd() * h, r = m * (0.25 + rnd() * 0.4); c.fillStyle = rad(c, x, y, 0, r, [[0, neb[i % 4]], [1, 'rgba(0,0,0,0)']]); c.fillRect(x - r, y - r, r * 2, r * 2); }
        c.globalCompositeOperation = 'source-over';
        for (let i = 0; i < 420; i++) { const s = rnd() < 0.92 ? rnd() * 1.2 + 0.3 : rnd() * 2 + 1.2; c.fillStyle = `rgba(255,255,255,${0.3 + rnd() * 0.7})`; c.beginPath(); c.arc(rnd() * w, rnd() * h, s, 0, TAU); c.fill(); }
        // a ringed planet and a moon
        const px = w * 0.84, py = h * 0.78, pr = m * 0.13;
        c.strokeStyle = 'rgba(255,200,160,0.35)'; c.lineWidth = pr * 0.12; c.beginPath(); c.ellipse(px, py, pr * 1.9, pr * 0.45, -0.35, Math.PI, TAU); c.stroke();
        c.fillStyle = rad(c, px - pr * 0.4, py - pr * 0.4, pr * 0.1, pr * 1.1, [[0, '#ffc59a'], [0.5, '#e0607a'], [1, '#3a1050']], px, py); c.beginPath(); c.arc(px, py, pr, 0, TAU); c.fill();
        c.strokeStyle = 'rgba(255,220,190,0.6)'; c.lineWidth = pr * 0.12; c.beginPath(); c.ellipse(px, py, pr * 1.9, pr * 0.45, -0.35, 0, Math.PI); c.stroke();
        const mx = w * 0.13, my = h * 0.2, mr = m * 0.04;
        c.fillStyle = rad(c, mx - mr * 0.4, my - mr * 0.4, mr * 0.1, mr * 1.1, [[0, '#e8f0ff'], [1, '#4a5a8a']], mx, my); c.beginPath(); c.arc(mx, my, mr, 0, TAU); c.fill();
      },
      init(w, h, m) {
        const rnd = BB.rng(10), P = [];
        for (let i = 0; i < 46; i++) P.push({ k: 'tw', x: rnd() * w, y: rnd() * h, ph: rnd() * TAU, s: 1 + rnd() * 2 });
        P.push({ k: 'shoot', t: 2 + rnd() * 3, x: 0, y: 0, vx: 0, vy: 0, life: 0 });
        return P;
      },
      draw(c, w, h, t, dt, P) {
        for (const p of P) {
          if (p.k === 'tw') {
            const a = 0.5 + 0.5 * Math.sin(t * 2.2 + p.ph);
            c.fillStyle = `rgba(255,255,255,${a})`; c.fillRect(p.x - p.s * 2.5, p.y - 0.5, p.s * 5, 1); c.fillRect(p.x - 0.5, p.y - p.s * 2.5, 1, p.s * 5);
          } else {
            p.t -= dt;
            if (p.t <= 0 && p.life <= 0) { p.life = 0.9; p.x = Math.random() * w * 0.8; p.y = Math.random() * h * 0.4; p.vx = 600 + Math.random() * 300; p.vy = 220 + Math.random() * 120; p.t = 3 + Math.random() * 5; }
            if (p.life > 0) {
              p.life -= dt; p.x += p.vx * dt; p.y += p.vy * dt;
              c.strokeStyle = lin(c, p.x, p.y, p.x - p.vx * 0.12, p.y - p.vy * 0.12, [[0, `rgba(255,255,255,${Math.min(1, p.life * 2)})`], [1, 'rgba(255,255,255,0)']]);
              c.lineWidth = 2; c.beginPath(); c.moveTo(p.x, p.y); c.lineTo(p.x - p.vx * 0.12, p.y - p.vy * 0.12); c.stroke();
            }
          }
        }
      },
    },
  };
  BG.ids = Object.keys(THEMES);

  BG.set = id => { if (!THEMES[id]) id = 'meadow'; if (id === BG.id && BG.cv) return; BG.id = id; BG.rebuild(); };
  BG.resize = (w, h, dpr) => { BG.w = w; BG.h = h; BG.dpr = Math.min(dpr, 1.5); if (BG.id) BG.rebuild(); };
  BG.rebuild = () => {
    const { w, h, dpr } = BG, th = THEMES[BG.id], m = Math.max(w, h);
    if (!w || !h) return;
    BG.cv = mk(Math.round(w * dpr), Math.round(h * dpr));
    const c = BG.cv.getContext('2d'); c.scale(dpr, dpr);
    th.paint(c, w, h, m);
    BG.parts = th.init(w, h, m);
  };
  BG.draw = (c, dt) => {
    BG.t += dt;
    if (!BG.cv) return;
    c.drawImage(BG.cv, 0, 0, BG.w, BG.h);
    THEMES[BG.id].draw(c, BG.w, BG.h, BG.t, dt, BG.parts);
  };
})();
