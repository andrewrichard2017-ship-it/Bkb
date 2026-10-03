'use strict';
// The colouring school game: pick a picture (js/stencils.js), then pick a colour and tap a space
// in the picture to fill it, or switch to the crayon and colour freehand. The black lines are
// drawn over the top of the colour, so they always stay crisp.

const Colouring = (() => {
  const $ = id => document.getElementById(id);
  const PW = 1000, PH = 750; // the page, in pixels
  const COLOURS = ['#ef4444', '#f97316', '#facc15', '#a3e635', '#22c55e', '#14b8a6', '#7dd3fc', '#3b82f6', '#8b5cf6', '#ec4899',
    '#f9a8d4', '#92400e', '#f5c99b', '#9ca3af', '#1f2937', '#ffffff'];
  const MAX_UNDO = 8;
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const buzz = ms => { try { if (navigator.vibrate) navigator.vibrate(ms); } catch (e) { /* ignore */ } };

  const view = $('colCanvas'), vctx = view.getContext('2d'), wrap = $('colWrap');
  const line = document.createElement('canvas'), paint = document.createElement('canvas');
  line.width = paint.width = PW; line.height = paint.height = PH;
  const lctx = line.getContext('2d', { willReadFrequently: true }), pctx = paint.getContext('2d', { willReadFrequently: true });
  let cfg = null, run = 0, pic = null, labels = null, regions = null, colour = COLOURS[0], tool = 'fill', undo = [], filled = new Set(),
    big = 0, drawing = null, dirty = true, starAt = 0, done = false, actions = 0, box = { x: 0, y: 0, s: 1 };

  // ---------- the picture picker ----------
  function start(opts) {
    cfg = opts; run++; done = false;
    $('colPick').hidden = false; $('colPaint').hidden = true;
    $('colTitle').textContent = 'Pick a picture!';
    const grid = $('colGrid');
    if (!grid.children.length) {
      for (const p of Stencil.PICS) {
        const b = document.createElement('button'), img = new Image();
        b.className = 'colCard';
        img.alt = ''; img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(Stencil.svg(p));
        b.append(img, Object.assign(document.createElement('b'), { textContent: p.name }));
        b.addEventListener('click', () => { cfg.sound.click(); choose(p); });
        grid.appendChild(b);
      }
    }
    cfg.say(['dr_pick'], 'Pick a picture to colour in!');
  }
  function stop() { run++; drawing = null; }

  // ---------- load a picture and find all its spaces ----------
  function choose(p) {
    const r = ++run;
    pic = p; undo = []; filled = new Set(); actions = 0; starAt = 0; done = false;
    $('colPick').hidden = true; $('colPaint').hidden = false;
    $('colTitle').textContent = p.name;
    $('colDone').disabled = false;
    palette(); resize();
    const img = new Image();
    img.onload = () => {
      if (r !== run) return;
      lctx.fillStyle = '#fff'; lctx.fillRect(0, 0, PW, PH); lctx.drawImage(img, 0, 0, PW, PH);
      pctx.fillStyle = '#fff'; pctx.fillRect(0, 0, PW, PH);
      findSpaces(); dirty = true;
      requestAnimationFrame(t => loop(r, t));
    };
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(Stencil.svg(p));
    cfg.hush();
    cfg.say(['dr_' + p.id, 'dr_how'], p.say + ' Pick a colour, then tap the picture to colour it in!');
  }
  // Every pixel that isn't a black line gets the number of the space it's in; then each space
  // grows a couple of pixels under its lines, so a fill reaches right up to the ink.
  function findSpaces() {
    const d = lctx.getImageData(0, 0, PW, PH).data, N = PW * PH;
    labels = new Int32Array(N);
    const ink = new Uint8Array(N);
    for (let i = 0; i < N; i++) ink[i] = d[i * 4] + d[i * 4 + 1] + d[i * 4 + 2] < 3 * 170 ? 1 : 0;
    const stack = new Int32Array(N);
    let n = 0;
    for (let s = 0; s < N; s++) {
      if (ink[s] || labels[s]) continue;
      n++; let sp = 0; stack[sp++] = s; labels[s] = n;
      while (sp) {
        const i = stack[--sp], x = i % PW;
        if (x > 0 && !ink[i - 1] && !labels[i - 1]) { labels[i - 1] = n; stack[sp++] = i - 1; }
        if (x < PW - 1 && !ink[i + 1] && !labels[i + 1]) { labels[i + 1] = n; stack[sp++] = i + 1; }
        if (i >= PW && !ink[i - PW] && !labels[i - PW]) { labels[i - PW] = n; stack[sp++] = i - PW; }
        if (i < N - PW && !ink[i + PW] && !labels[i + PW]) { labels[i + PW] = n; stack[sp++] = i + PW; }
      }
    }
    for (let pass = 0; pass < 3; pass++) {
      const grow = [];
      for (let i = 0; i < N; i++) {
        if (labels[i]) continue;
        const x = i % PW;
        const l = (x > 0 && labels[i - 1]) || (x < PW - 1 && labels[i + 1]) || (i >= PW && labels[i - PW]) || (i < N - PW && labels[i + PW]);
        if (l) grow.push(i, l);
      }
      for (let k = 0; k < grow.length; k += 2) labels[grow[k]] = grow[k + 1];
    }
    // each space's pixels, packed together, with its bounding box
    const count = new Int32Array(n + 1);
    for (let i = 0; i < N; i++) count[labels[i]]++;
    const start = new Int32Array(n + 2);
    for (let l = 1; l <= n + 1; l++) start[l] = start[l - 1] + count[l - 1];
    const px = new Int32Array(N), at = start.slice();
    const bx0 = new Int32Array(n + 1).fill(PW), by0 = new Int32Array(n + 1).fill(PH), bx1 = new Int32Array(n + 1), by1 = new Int32Array(n + 1);
    for (let i = 0; i < N; i++) {
      const l = labels[i]; px[at[l]++] = i;
      if (!l) continue;
      const x = i % PW, y = (i / PW) | 0;
      if (x < bx0[l]) bx0[l] = x; if (x > bx1[l]) bx1[l] = x; if (y < by0[l]) by0[l] = y; if (y > by1[l]) by1[l] = y;
    }
    regions = { n, start, count, px, bx0, by0, bx1, by1 };
    big = 0; for (let l = 1; l <= n; l++) if (count[l] > 150) big++;
  }

  // ---------- colouring ----------
  function hex(c) { return [1, 3, 5].map(i => parseInt(c.slice(i, i + 2), 16)); }
  function fill(l) {
    const R = regions, x0 = R.bx0[l], y0 = R.by0[l], w = R.bx1[l] - x0 + 1, h = R.by1[l] - y0 + 1;
    if (w <= 0 || h <= 0) return;
    const im = pctx.getImageData(x0, y0, w, h), [r, g, b] = hex(colour), dd = im.data;
    pushUndo({ x: x0, y: y0, im: pctx.getImageData(x0, y0, w, h), l });
    for (let k = R.start[l], e = k + R.count[l]; k < e; k++) {
      const i = R.px[k], o = ((((i / PW) | 0) - y0) * w + (i % PW - x0)) * 4;
      dd[o] = r; dd[o + 1] = g; dd[o + 2] = b; dd[o + 3] = 255;
    }
    pctx.putImageData(im, x0, y0);
    if (R.count[l] > 150) filled.add(l);
    actions++; dirty = true;
    cfg.sound.pop(); buzz(10);
  }
  function pushUndo(u) { undo.push(u); if (undo.length > MAX_UNDO) undo.shift(); }
  function doUndo() {
    const u = undo.pop();
    if (!u) return cfg.sound.nope();
    pctx.putImageData(u.im, u.x, u.y);
    if (u.l && u.wasNew) filled.delete(u.l);
    dirty = true; cfg.sound.click();
  }
  function toPage(e) {
    const r = view.getBoundingClientRect();
    return { x: (e.clientX - r.left - box.x) / box.s, y: (e.clientY - r.top - box.y) / box.s };
  }
  view.addEventListener('pointerdown', e => {
    e.preventDefault();
    if (!labels || done) return;
    const p = toPage(e);
    if (p.x < 0 || p.y < 0 || p.x >= PW || p.y >= PH) return;
    if (tool === 'fill') {
      // a tap on a line fills the nearest space next to it
      let l = 0;
      for (let rad = 0; rad <= 6 && !l; rad += 2) for (const [dx, dy] of [[0, 0], [rad, 0], [-rad, 0], [0, rad], [0, -rad]]) {
        const x = Math.round(p.x + dx), y = Math.round(p.y + dy);
        if (x >= 0 && y >= 0 && x < PW && y < PH && labels[y * PW + x]) { l = labels[y * PW + x]; break; }
      }
      if (l) { const wasNew = !filled.has(l); fill(l); undo[undo.length - 1].wasNew = wasNew; }
      return;
    }
    try { view.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
    pushUndo({ x: 0, y: 0, im: pctx.getImageData(0, 0, PW, PH) });
    drawing = { last: p }; actions++;
    stroke(p);
  });
  view.addEventListener('pointermove', e => { if (drawing) stroke(toPage(e)); });
  for (const ev of ['pointerup', 'pointercancel', 'lostpointercapture']) view.addEventListener(ev, () => { drawing = null; });
  function stroke(p) {
    const a = drawing.last;
    pctx.strokeStyle = colour; pctx.lineWidth = 26; pctx.lineCap = pctx.lineJoin = 'round';
    pctx.beginPath(); pctx.moveTo(a.x, a.y); pctx.lineTo(p.x + 0.01, p.y); pctx.stroke();
    drawing.last = p; dirty = true;
    if (Math.random() < 0.2) cfg.sound.scribble();
  }

  // ---------- the palette ----------
  function palette() {
    const pal = $('colPal'); pal.innerHTML = '';
    for (const col of COLOURS) {
      const b = document.createElement('button');
      b.className = 'colSw' + (col === colour ? ' sel' : ''); b.style.background = col; b.setAttribute('aria-label', 'Colour');
      b.addEventListener('click', () => { colour = col; cfg.sound.click(); for (const x of pal.children) x.classList.toggle('sel', x === b); });
      pal.appendChild(b);
    }
    $('colFill').classList.toggle('sel', tool === 'fill'); $('colCrayon').classList.toggle('sel', tool === 'crayon');
  }
  $('colFill').addEventListener('click', () => { tool = 'fill'; cfg.sound.click(); palette(); });
  $('colCrayon').addEventListener('click', () => { tool = 'crayon'; cfg.sound.click(); palette(); });
  $('colUndo').addEventListener('click', () => { if (!done) doUndo(); });
  $('colDone').addEventListener('click', async () => {
    if (done || !labels) return;
    // a few spaces coloured in before it counts as finished
    if (filled.size < Math.min(6, Math.ceil(big * 0.3)) && actions < 10) {
      cfg.sound.nope(); cfg.hush(); cfg.say(['dr_more'], 'Keep going! Colour in some more of the picture.'); return;
    }
    done = true; $('colDone').disabled = true;
    const r = run;
    // a small copy goes up on the classroom wall
    try {
      const t = document.createElement('canvas'); t.width = 240; t.height = 180;
      const tc = t.getContext('2d');
      tc.drawImage(paint, 0, 0, 240, 180); tc.globalCompositeOperation = 'multiply'; tc.drawImage(line, 0, 0, 240, 180);
      cfg.saveArt(t.toDataURL('image/jpeg', 0.75));
    } catch (e) { /* no room to save it */ }
    cfg.sound.fanfare(); buzz([40, 60, 40]); starAt = performance.now(); dirty = true;
    cfg.hush(); await cfg.say(['p_star_draw_' + cfg.id], 'What a beautiful picture, ' + cfg.name + '! You get a gold star!');
    await sleep(700);
    if (r === run) cfg.finished();
  });

  // ---------- drawing it on screen ----------
  function resize() {
    const r = wrap.getBoundingClientRect(), dpr = Math.min(2, devicePixelRatio || 1);
    const w = Math.max(50, r.width), h = Math.max(50, r.height);
    view.width = Math.round(w * dpr); view.height = Math.round(h * dpr);
    const s = Math.min(w / PW, h / PH) * 0.98;
    box = { x: (w - PW * s) / 2, y: (h - PH * s) / 2, s, w, h, dpr };
    dirty = true;
  }
  new ResizeObserver(() => { if (!$('colPaint').hidden) resize(); }).observe(wrap);
  function loop(r, now) {
    if (r !== run) return;
    requestAnimationFrame(t => loop(r, t));
    if (!dirty && !starAt) return;
    dirty = false;
    const c = vctx, { x, y, s, w, h, dpr } = box;
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    c.fillStyle = '#e0f2fe'; c.fillRect(0, 0, w, h);
    c.fillStyle = 'rgba(0,0,0,.15)'; c.fillRect(x + 4, y + 6, PW * s, PH * s);
    c.drawImage(paint, x, y, PW * s, PH * s);
    c.globalCompositeOperation = 'multiply'; c.drawImage(line, x, y, PW * s, PH * s); c.globalCompositeOperation = 'source-over';
    if (starAt) {
      const k = Math.min(1, (now - starAt) / 600), rad = Math.min(w, h) * 0.22 * (0.3 + 0.7 * k);
      c.save(); c.translate(w / 2, h / 2); c.rotate((1 - k) * 2);
      for (const [q, col, o] of [[rad * 1.12, '#b45309', 0], [rad, '#fbbf24', 0], [rad * 0.45, '#fde68a', -rad * 0.1]]) {
        c.fillStyle = col; c.beginPath();
        for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? q * 0.45 : q; c.lineTo(o + Math.cos(a) * rr, o * 1.2 + Math.sin(a) * rr); }
        c.closePath(); c.fill();
      }
      c.restore();
    }
  }

  return { start, stop, again: () => cfg && cfg.say(pic && !$('colPaint').hidden ? ['dr_how'] : ['dr_pick'], pic && !$('colPaint').hidden ? 'Pick a colour, then tap the picture to colour it in!' : 'Pick a picture to colour in!') };
})();
