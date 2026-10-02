'use strict';
// Stage two: inside the school. The class sits at their tables and the player's desk has a paper
// menu of today's work. "My name" is colouring in the letters of CHILD_NAME one at a time: each
// letter says its sound, then the whole name is sounded out and said, and a gold star goes in
// the star book. Change CHILD_NAME to use another name; every letter a-z has a sound below.
const CHILD_NAME = 'Kellan';

// Letter sounds for the speech voice, each with picture words. A repeated letter (the two Ls in
// Kellan) gets the next word in its list.
const PHONICS = {
  a: { say: 'ah', words: [['apple', '🍎'], ['ant', '🐜']] },
  b: { say: 'buh', words: [['ball', '⚽'], ['bee', '🐝']] },
  c: { say: 'kuh', words: [['cat', '🐱'], ['cake', '🎂']] },
  d: { say: 'duh', words: [['dog', '🐶'], ['duck', '🦆']] },
  e: { say: 'eh', words: [['egg', '🥚'], ['elephant', '🐘']] },
  f: { say: 'fuh', words: [['fish', '🐟'], ['frog', '🐸']] },
  g: { say: 'guh', words: [['goat', '🐐'], ['grapes', '🍇']] },
  h: { say: 'huh', words: [['hat', '🎩'], ['horse', '🐴']] },
  i: { say: 'ih', words: [['insect', '🐛'], ['iguana', '🦎']] },
  j: { say: 'juh', words: [['juice', '🧃'], ['jeans', '👖']] },
  k: { say: 'kuh', words: [['kite', '🪁'], ['key', '🔑']] },
  l: { say: 'luh', words: [['lion', '🦁'], ['leaf', '🍃']] },
  m: { say: 'muh', words: [['moon', '🌙'], ['monkey', '🐒']] },
  n: { say: 'nuh', words: [['nose', '👃'], ['nut', '🥜']] },
  o: { say: 'o', words: [['octopus', '🐙'], ['orange', '🍊']] },
  p: { say: 'puh', words: [['pig', '🐷'], ['penguin', '🐧']] },
  q: { say: 'kwuh', words: [['queen', '👑']] },
  r: { say: 'ruh', words: [['rabbit', '🐰'], ['rainbow', '🌈']] },
  s: { say: 'suh', words: [['sun', '☀️'], ['snake', '🐍']] },
  t: { say: 'tuh', words: [['tiger', '🐯'], ['tree', '🌳']] },
  u: { say: 'uh', words: [['umbrella', '☂️'], ['up', '⬆️']] },
  v: { say: 'vuh', words: [['van', '🚐'], ['volcano', '🌋']] },
  w: { say: 'wuh', words: [['whale', '🐳'], ['web', '🕸️']] },
  x: { say: 'ks', words: [['fox', '🦊'], ['box', '📦']] },
  y: { say: 'yuh', words: [['yo-yo', '🪀'], ['yak', '🐃']] },
  z: { say: 'zuh', words: [['zebra', '🦓'], ['zip', '🤐']] },
};
const CRAYONS = ['#ef4444', '#f97316', '#facc15', '#22c55e', '#3b82f6', '#a855f7', '#ec4899'];

const School = (() => {
  const $ = id => document.getElementById(id);
  const root = $('school');
  const LETTER_FONT = 'Andika, Fredoka, "Trebuchet MS", sans-serif';
  let cfg = null, onExit = null, kids = [], screen = '';
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const buzz = ms => { try { if (navigator.vibrate) navigator.vibrate(ms); } catch (e) { /* ignore */ } };

  // ---------- speech ----------
  const syn = window.speechSynthesis;
  let voice = null;
  function pickVoice() {
    if (!syn) return;
    const vs = syn.getVoices();
    voice = vs.find(v => /en[-_]GB/i.test(v.lang)) || vs.find(v => /en[-_]IE/i.test(v.lang)) || vs.find(v => /^en/i.test(v.lang)) || null;
  }
  if (syn) { pickVoice(); syn.onvoiceschanged = pickVoice; }
  function say(text, rate) {
    return new Promise(res => {
      if (!syn || cfg.save.muted) return setTimeout(res, 500);
      let done = false;
      const fin = () => { if (!done) { done = true; res(); } };
      try {
        const u = new SpeechSynthesisUtterance(text);
        if (voice) u.voice = voice;
        u.lang = voice ? voice.lang : 'en-GB'; u.rate = rate || 0.85; u.pitch = 1.15;
        u.onend = fin; u.onerror = fin;
        syn.speak(u);
      } catch (e) { fin(); }
      setTimeout(fin, 1000 + text.length * 130);
    });
  }
  const hush = () => { if (syn) syn.cancel(); };

  // ---------- screens ----------
  function show(id) {
    screen = id;
    for (const el of root.querySelectorAll('.screen')) el.hidden = el.id !== id;
    if (id === 'classScreen') drawClass();
    if (id === 'traceScreen') startTrace();
    if (id === 'bookScreen') renderBook(false);
  }
  function open(classKids, exit, opts) {
    cfg = opts; onExit = exit; kids = classKids.slice(0, 12);
    root.hidden = false;
    $('menuHello').textContent = 'Today’s work for ' + CHILD_NAME;
    $('tNameSub').textContent = CHILD_NAME;
    show('classScreen');
  }
  function close() {
    hush(); T.run++;
    root.hidden = true; screen = '';
    if (onExit) onExit();
  }

  // ---------- the classroom ----------
  const cc = $('classCanvas');
  function drawClass() {
    const r = root.getBoundingClientRect(), W = r.width, H = r.height, dpr = Math.min(2, devicePixelRatio || 1);
    cc.width = Math.round(W * dpr); cc.height = Math.round(H * dpr);
    const c = cc.getContext('2d'); c.setTransform(dpr, 0, 0, dpr, 0, 0);
    const R = H > W ? H * 0.5 : H * 0.62, s = Math.min(R / 300, W / 520), rr = Scene.rr;
    // wall and floor
    c.fillStyle = '#cfe6f5'; c.fillRect(0, 0, W, R * 0.8);
    c.fillStyle = '#c98f55'; c.fillRect(0, R * 0.8, W, R * 0.2 + 2);
    c.fillStyle = '#9b6a3c'; c.fillRect(0, R * 0.8, W, 5 * s);
    // alphabet frieze
    const n = 26, cw = W / n;
    c.font = '700 ' + Math.min(cw * 0.5, 16 * s) + 'px ' + LETTER_FONT; c.textAlign = 'center'; c.textBaseline = 'middle';
    for (let i = 0; i < n; i++) {
      c.fillStyle = CRAYONS[i % CRAYONS.length]; c.fillRect(i * cw + 1, R * 0.02, cw - 2, R * 0.08);
      c.fillStyle = '#fff'; const ch = String.fromCharCode(65 + i);
      c.fillText(ch + ch.toLowerCase(), i * cw + cw / 2, R * 0.065);
    }
    // window with the bus parked outside
    const wx = W * 0.04, wy = R * 0.17, ww = Math.min(W * 0.2, 150 * s), wh = R * 0.4;
    c.fillStyle = '#fff'; c.fillRect(wx - 5 * s, wy - 5 * s, ww + 10 * s, wh + 10 * s);
    c.fillStyle = '#8fd0ff'; c.fillRect(wx, wy, ww, wh);
    c.fillStyle = '#7cc95b'; c.fillRect(wx, wy + wh * 0.7, ww, wh * 0.3);
    c.fillStyle = BUS_COLORS[cfg.color()] || BUS_COLORS.yellow;
    rr(c, wx + ww * 0.12, wy + wh * 0.5, ww * 0.7, wh * 0.26, 4 * s); c.fill();
    c.fillStyle = '#bfe3f5';
    for (let k = 0; k < 4; k++) c.fillRect(wx + ww * (0.16 + k * 0.15), wy + wh * 0.54, ww * 0.1, wh * 0.08);
    c.fillStyle = '#1f2937'; for (const f of [0.28, 0.66]) { c.beginPath(); c.arc(wx + ww * f, wy + wh * 0.77, ww * 0.05, 0, 7); c.fill(); }
    c.fillStyle = '#fff'; c.fillRect(wx + ww / 2 - 2 * s, wy, 4 * s, wh); c.fillRect(wx, wy + wh / 2 - 2 * s, ww, 4 * s);
    // whiteboard
    const bx = W * 0.3, by = R * 0.15, bw = W * 0.4, bh = R * 0.36;
    c.fillStyle = '#9ca3af'; rr(c, bx - 6 * s, by - 6 * s, bw + 12 * s, bh + 12 * s, 6 * s); c.fill();
    c.fillStyle = '#fbfdff'; c.fillRect(bx, by, bw, bh);
    const day = new Date().toLocaleDateString('en-GB', { weekday: 'long' });
    c.font = '700 ' + Math.min(bh * 0.2, bw / 11) + 'px ' + LETTER_FONT;
    c.fillStyle = '#2563eb'; c.fillText('Good morning, ' + CHILD_NAME + '!', bx + bw / 2, by + bh * 0.32);
    c.font = '600 ' + Math.min(bh * 0.15, bw / 14) + 'px ' + LETTER_FONT;
    c.fillStyle = '#dc2626'; c.fillText('Today is ' + day, bx + bw / 2, by + bh * 0.68);
    c.fillStyle = '#6b7280'; c.fillRect(bx + bw * 0.1, by + bh, bw * 0.8, 5 * s);
    // teacher beside the board
    const tx = Math.min(W * 0.82, bx + bw + 50 * s), tb = R * 0.92;
    c.fillStyle = '#334155'; c.fillRect(tx - 9 * s, tb - 50 * s, 7 * s, 50 * s); c.fillRect(tx + 2 * s, tb - 50 * s, 7 * s, 50 * s);
    c.fillStyle = '#0d9488'; rr(c, tx - 16 * s, tb - 112 * s, 32 * s, 66 * s, 10 * s); c.fill();
    c.strokeStyle = '#0d9488'; c.lineWidth = 8 * s; c.lineCap = 'round';
    c.beginPath(); c.moveTo(tx - 12 * s, tb - 100 * s); c.lineTo(tx - 32 * s, tb - 128 * s); c.stroke();
    c.save(); c.translate(tx, tb - 128 * s); c.scale(1.3 * s, 1.3 * s); c.scale(-1, 1);
    Scene.head(c, { skin: '#f1c27d', hair: '#7c2d12', style: 5, bag: '#0d9488' }); c.restore();
    // the class at their tables
    const per = 4, tables = Math.max(1, Math.ceil(kids.length / per)), ty = R * 0.86;
    const span = W * 0.9, tw = Math.min(span / tables - 16 * s, 230 * s);
    for (let t = 0; t < tables; t++) {
      const cx = W * 0.05 + span * (t + 0.5) / tables, group = kids.slice(t * per, t * per + per);
      group.forEach((look, i) => {
        const kx = cx - tw / 2 + tw * (i + 0.5) / group.length, ky = ty - 30 * s;
        c.fillStyle = look.shirt; rr(c, kx - 13 * s, ky + 6 * s, 26 * s, 26 * s, 9 * s); c.fill();
        c.save(); c.translate(kx, ky - 8 * s); c.scale(1.05 * s, 1.05 * s); Scene.head(c, look); c.restore();
      });
      c.fillStyle = '#f1c27d'; rr(c, cx - tw / 2, ty, tw, 12 * s, 3 * s); c.fill();
      c.fillStyle = '#b07a43'; c.fillRect(cx - tw / 2 + 8 * s, ty + 12 * s, 6 * s, R * 0.14); c.fillRect(cx + tw / 2 - 14 * s, ty + 12 * s, 6 * s, R * 0.14);
    }
    // my desk in front, with a pot of crayons
    const g = c.createLinearGradient(0, R, 0, H);
    g.addColorStop(0, '#e2b07a'); g.addColorStop(1, '#c48a50');
    c.fillStyle = g; c.fillRect(0, R, W, H - R);
    c.fillStyle = '#f0c896'; c.fillRect(0, R, W, 6 * s);
    const px = W * 0.9, py = R + 10 * s;
    CRAYONS.slice(0, 5).forEach((col, i) => {
      c.save(); c.translate(px - 12 * s + i * 6 * s, py + 4 * s); c.rotate((i - 2) * 0.12);
      c.fillStyle = col; c.fillRect(-3 * s, -46 * s, 6 * s, 46 * s);
      c.beginPath(); c.moveTo(-3 * s, -46 * s); c.lineTo(0, -54 * s); c.lineTo(3 * s, -46 * s); c.fill(); c.restore();
    });
    c.fillStyle = '#2563eb'; rr(c, px - 20 * s, py - 6 * s, 40 * s, 44 * s, 6 * s); c.fill();
  }

  // ---------- name tracing ----------
  const tc = $('traceCanvas'), tctx = tc.getContext('2d'), wrap = $('traceWrap');
  const T = { run: 0, i: 0, colors: [], color: CRAYONS[0], drawing: false, last: null, done: false, phase: 'trace',
    fillT: 0, scribbleT: 0, idleT: 0 };
  let L = null; // layout + per-letter canvases

  function crayonRow() {
    const row = $('crayons'); row.innerHTML = '';
    CRAYONS.forEach(col => {
      const b = document.createElement('button');
      b.className = 'crayon'; b.style.setProperty('--c', col); b.setAttribute('aria-label', 'Crayon');
      b.addEventListener('pointerdown', e => { e.preventDefault(); T.color = col; markCrayon(); cfg.sound.click(); });
      row.appendChild(b);
    });
  }
  function markCrayon() { for (const b of $('crayons').children) b.classList.toggle('sel', b.style.getPropertyValue('--c') === T.color); }
  function strip() {
    const el = $('nameStrip'); el.innerHTML = '';
    [...CHILD_NAME].forEach((ch, i) => {
      const s = document.createElement('span');
      s.textContent = ch;
      if (i < T.i || T.phase !== 'trace') s.style.color = T.colors[i];
      else if (i === T.i) s.className = 'now';
      el.appendChild(s);
    });
  }
  function wordFor(i) {
    const ch = CHILD_NAME[i].toLowerCase(), p = PHONICS[ch];
    if (!p) return null;
    let seen = 0;
    for (let k = 0; k < i; k++) if (CHILD_NAME[k].toLowerCase() === ch) seen++;
    const [word, pic] = p.words[seen % p.words.length];
    return { say: p.say, word, pic, ch: CHILD_NAME[i] };
  }

  function startTrace() {
    const run = ++T.run;
    T.i = 0; T.colors = []; T.phase = 'trace'; T.done = false;
    T.color = CRAYONS[0];
    crayonRow(); markCrayon(); $('crayons').hidden = false; $('soundCard').hidden = true;
    const go = () => { if (run === T.run) { layout(); letter(); } };
    if (document.fonts && document.fonts.load) {
      Promise.race([document.fonts.load('700 80px Andika'), sleep(1500)]).then(go, go);
    } else go();
    requestAnimationFrame(t => loop(run, t));
  }
  function layout() {
    const r = wrap.getBoundingClientRect(), dpr = Math.min(2, devicePixelRatio || 1);
    const w = Math.max(50, r.width), h = Math.max(50, r.height);
    tc.width = Math.round(w * dpr); tc.height = Math.round(h * dpr);
    tctx.font = '700 100px ' + LETTER_FONT;
    let widest = 0, asc = 0, desc = 0;
    for (const ch of CHILD_NAME) {
      const m = tctx.measureText(ch);
      widest = Math.max(widest, m.width); asc = Math.max(asc, m.actualBoundingBoxAscent || 72); desc = Math.max(desc, m.actualBoundingBoxDescent || 0);
    }
    const xm = tctx.measureText('x'), xh = (xm.actualBoundingBoxAscent || 50) / 100;
    const capH = asc / 100;
    let F = Math.min(h * 0.82 / (capH + Math.max(desc / 100, 0.22) + 0.25), w * 0.8 / (widest / 100 + 0.25));
    const base = h * 0.5 + F * (capH - Math.max(desc / 100, 0.22)) / 2;
    L = { w, h, dpr, F, base, top: base - capH * F, mid: base - xh * F, low: base + 0.22 * F, fat: F * 0.09 };
  }
  function shapeCanvas(ch, fat, color) {
    const cv = document.createElement('canvas'); cv.width = tc.width; cv.height = tc.height;
    const c = cv.getContext('2d'); c.setTransform(L.dpr, 0, 0, L.dpr, 0, 0);
    c.font = '700 ' + L.F + 'px ' + LETTER_FONT; c.textAlign = 'center'; c.textBaseline = 'alphabetic';
    c.lineJoin = 'round'; c.lineCap = 'round'; c.fillStyle = c.strokeStyle = color; c.lineWidth = fat;
    c.fillText(ch, L.w / 2, L.base); c.strokeText(ch, L.w / 2, L.base);
    return cv;
  }
  function letter() {
    const ch = CHILD_NAME[T.i];
    T.mask = shapeCanvas(ch, L.fat, '#000');
    // the outline the child colours inside
    const o = shapeCanvas(ch, L.fat + 6, '#334155'), oc = o.getContext('2d');
    oc.setTransform(1, 0, 0, 1, 0, 0);
    oc.drawImage(shapeCanvas(ch, L.fat, '#ffffff'), 0, 0);
    T.outline = o;
    T.paint = document.createElement('canvas'); T.paint.width = tc.width; T.paint.height = tc.height;
    T.colored = document.createElement('canvas'); T.colored.width = tc.width; T.colored.height = tc.height;
    T.tint = null; T.fillT = 0; T.done = false; T.idleT = 0; T.dirty = true;
    // coverage grid: which cells are inside the letter, and which have been coloured
    const g = Math.max(4, Math.round(L.F / 40)), gw = Math.ceil(L.w / g), gh = Math.ceil(L.h / g);
    const d = T.mask.getContext('2d').getImageData(0, 0, T.mask.width, T.mask.height).data;
    const cells = new Uint8Array(gw * gh);
    let total = 0;
    for (let y = 0; y < gh; y++) for (let x = 0; x < gw; x++) {
      const px = Math.min(T.mask.width - 1, Math.round((x + 0.5) * g * L.dpr)), py = Math.min(T.mask.height - 1, Math.round((y + 0.5) * g * L.dpr));
      if (d[(py * T.mask.width + px) * 4 + 3] > 128) { cells[y * gw + x] = 1; total++; }
    }
    T.grid = { g, gw, gh, cells, got: new Uint8Array(gw * gh), total, count: 0 };
    T.color = CRAYONS[T.i % CRAYONS.length]; markCrayon();
    strip();
    const p = wordFor(T.i);
    if (p) say(p.say);
  }
  function pos(e) { const r = tc.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; }
  function strokeTo(p) {
    if (T.done || T.phase !== 'trace') return;
    const a = T.last || p, brush = L.fat * 1.7 + 10, c = T.paint.getContext('2d');
    c.setTransform(L.dpr, 0, 0, L.dpr, 0, 0);
    c.strokeStyle = T.color; c.lineWidth = brush; c.lineCap = 'round'; c.lineJoin = 'round';
    c.beginPath(); c.moveTo(a.x, a.y); c.lineTo(p.x + 0.01, p.y); c.stroke();
    const G = T.grid, rad = brush / 2, dist = Math.hypot(p.x - a.x, p.y - a.y), steps = Math.max(1, Math.ceil(dist / (G.g / 2)));
    for (let s = 0; s <= steps; s++) {
      const x = a.x + (p.x - a.x) * s / steps, y = a.y + (p.y - a.y) * s / steps;
      const x0 = Math.max(0, Math.floor((x - rad) / G.g)), x1 = Math.min(G.gw - 1, Math.floor((x + rad) / G.g));
      const y0 = Math.max(0, Math.floor((y - rad) / G.g)), y1 = Math.min(G.gh - 1, Math.floor((y + rad) / G.g));
      for (let gy = y0; gy <= y1; gy++) for (let gx = x0; gx <= x1; gx++) {
        const k = gy * G.gw + gx;
        if (!G.cells[k] || G.got[k]) continue;
        if (Math.hypot((gx + 0.5) * G.g - x, (gy + 0.5) * G.g - y) <= rad) { G.got[k] = 1; G.count++; }
      }
    }
    T.last = p; T.dirty = true; T.idleT = 0;
    if ((T.scribbleT -= dist) <= 0) { T.scribbleT = 40; cfg.sound.scribble(); }
    if (G.count / G.total >= 0.72) letterDone();
  }
  tc.addEventListener('pointerdown', e => {
    e.preventDefault(); if (!L) return;
    try { tc.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
    T.drawing = true; T.last = null; strokeTo(pos(e));
  });
  tc.addEventListener('pointermove', e => { if (T.drawing) strokeTo(pos(e)); });
  for (const ev of ['pointerup', 'pointercancel', 'lostpointercapture']) tc.addEventListener(ev, () => { T.drawing = false; T.last = null; });

  async function letterDone() {
    T.done = true; T.drawing = false;
    const run = T.run, i = T.i, p = wordFor(i);
    T.colors[i] = T.color;
    T.tint = shapeCanvas(CHILD_NAME[i], L.fat, T.color);
    cfg.sound.board(i); buzz(25);
    strip();
    if (p) {
      const card = $('soundCard');
      card.querySelector('.pic').textContent = p.pic;
      card.querySelector('.lt').textContent = p.ch;
      card.querySelector('.lt').style.color = T.color;
      card.querySelector('.wd').textContent = p.word;
      card.hidden = false; card.classList.remove('pop'); void card.offsetWidth; card.classList.add('pop');
      await sleep(350);
      await say(p.say); await sleep(150); await say(p.say + ', ' + p.word + '!');
      await sleep(500);
      card.hidden = true;
    } else await sleep(900);
    if (run !== T.run) return;
    if (++T.i < CHILD_NAME.length) letter();
    else blend(run);
  }

  // all the letters together: sound them out, then say the name
  async function blend(run) {
    T.phase = 'blend'; T.bounce = -1; T.all = false;
    $('crayons').hidden = true; strip();
    await sleep(500);
    for (let i = 0; i < CHILD_NAME.length; i++) {
      if (run !== T.run) return;
      T.bounce = i; T.bounceAt = performance.now();
      const p = wordFor(i);
      await say(p ? p.say : CHILD_NAME[i], 0.8);
      await sleep(120);
    }
    if (run !== T.run) return;
    T.bounce = -1; T.all = true; T.bounceAt = performance.now();
    await say(CHILD_NAME, 0.65); await sleep(250);
    T.bounceAt = performance.now();
    await say(CHILD_NAME + '!', 0.9);
    if (run !== T.run) return;
    cfg.sound.fanfare(); buzz([40, 60, 40]);
    T.phase = 'star'; T.starAt = performance.now();
    await say('Well done, ' + CHILD_NAME + '! You get a gold star!', 0.9);
    await sleep(600);
    if (run !== T.run) return;
    cfg.save.nameStars = (cfg.save.nameStars || 0) + 1; cfg.persist();
    show('bookScreen'); renderBook(true);
  }

  function star(c, x, y, r, fill) {
    c.beginPath();
    for (let k = 0; k < 10; k++) {
      const a = -Math.PI / 2 + k * Math.PI / 5, rad = k % 2 ? r * 0.45 : r;
      c.lineTo(x + Math.cos(a) * rad, y + Math.sin(a) * rad);
    }
    c.closePath(); c.fillStyle = fill; c.fill();
  }

  function loop(run, now) {
    if (run !== T.run || screen !== 'traceScreen') return;
    requestAnimationFrame(t => loop(run, t));
    if (!L || !T.outline) return;
    const c = tctx, { w, h, dpr } = L;
    c.setTransform(dpr, 0, 0, dpr, 0, 0); c.clearRect(0, 0, w, h);
    // handwriting lines: top, dashed middle, baseline
    c.lineWidth = 2; c.strokeStyle = '#93c5fd';
    c.beginPath(); c.moveTo(0, L.top); c.lineTo(w, L.top); c.moveTo(0, L.low); c.lineTo(w, L.low); c.stroke();
    c.setLineDash([12, 10]); c.beginPath(); c.moveTo(0, L.mid); c.lineTo(w, L.mid); c.stroke(); c.setLineDash([]);
    c.strokeStyle = '#ef4444'; c.lineWidth = 3; c.beginPath(); c.moveTo(0, L.base); c.lineTo(w, L.base); c.stroke();
    c.setTransform(1, 0, 0, 1, 0, 0);
    if (T.phase === 'trace') {
      c.drawImage(T.outline, 0, 0);
      if (T.dirty) {
        const k = T.colored.getContext('2d');
        k.globalCompositeOperation = 'source-over'; k.clearRect(0, 0, T.colored.width, T.colored.height);
        k.drawImage(T.paint, 0, 0); k.globalCompositeOperation = 'destination-in'; k.drawImage(T.mask, 0, 0);
        k.globalCompositeOperation = 'source-over'; T.dirty = false;
      }
      c.drawImage(T.colored, 0, 0);
      if (T.tint) { T.fillT = Math.min(1, T.fillT + 0.06); c.globalAlpha = T.fillT; c.drawImage(T.tint, 0, 0); c.globalAlpha = 1; }
      // a finger to show where to start, if nothing has been coloured for a while
      T.idleT += 1 / 60;
      if (!T.done && T.grid.count === 0 && T.idleT > 1.2) {
        c.setTransform(dpr, 0, 0, dpr, 0, 0);
        c.font = Math.round(L.F * 0.3) + 'px sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
        c.fillText('👆', w / 2 + L.F * 0.12, L.mid + L.F * 0.2 + Math.sin(now / 200) * 8);
      }
    } else {
      // the whole name, bouncing letter by letter
      c.setTransform(dpr, 0, 0, dpr, 0, 0);
      let F = L.F;
      c.font = '700 ' + F + 'px ' + LETTER_FONT;
      const fit = w * 0.9 / c.measureText(CHILD_NAME).width;
      if (fit < 1) { F *= fit; c.font = '700 ' + F + 'px ' + LETTER_FONT; }
      const total = c.measureText(CHILD_NAME).width;
      let x = (w - total) / 2;
      c.textAlign = 'left'; c.textBaseline = 'alphabetic'; c.lineJoin = 'round'; c.lineWidth = L.fat * F / L.F;
      const t = (now - (T.bounceAt || now)) / 1000;
      [...CHILD_NAME].forEach((ch, i) => {
        const up = (T.all || T.bounce === i) ? Math.max(0, Math.sin(Math.min(1, t * 2.2) * Math.PI)) * F * 0.18 : 0;
        c.fillStyle = c.strokeStyle = T.colors[i] || '#334155';
        c.fillText(ch, x, L.base - up); c.strokeText(ch, x, L.base - up);
        x += c.measureText(ch).width;
      });
      if (T.phase === 'star') {
        const k = Math.min(1, (now - T.starAt) / 600), r = Math.min(w, h) * 0.18 * (0.3 + 0.7 * k);
        c.save(); c.translate(w / 2, h * 0.28); c.rotate((1 - k) * 2);
        star(c, 0, 0, r * 1.12, '#b45309'); star(c, 0, 0, r, '#fbbf24'); star(c, -r * 0.1, -r * 0.12, r * 0.45, '#fde68a');
        c.restore();
      }
    }
  }

  // ---------- star book ----------
  function renderBook(fresh) {
    const n = cfg.save.nameStars || 0, per = 12, page = Math.max(0, Math.ceil(n / per) - 1);
    $('bookTitle').textContent = CHILD_NAME + '’s Star Book';
    $('bookCount').textContent = n === 0 ? 'Colour in your name to get your first gold star!'
      : n + (n === 1 ? ' gold star' : ' gold stars') + ' for writing my name';
    const grid = $('bookStars'); grid.innerHTML = '';
    for (let k = 0; k < per; k++) {
      const idx = page * per + k, slot = document.createElement('div');
      slot.className = 'slot' + (idx < n ? ' got' : '') + (fresh && idx === n - 1 ? ' new' : '');
      slot.innerHTML = '<svg viewBox="0 0 40 40"><path d="M20 2l5.3 11.6 12.7 1.3-9.5 8.5 2.7 12.5L20 29.6 8.8 35.9l2.7-12.5L2 14.9l12.7-1.3z"/></svg>';
      grid.appendChild(slot);
    }
    if (fresh) setTimeout(() => cfg.sound.sparkle(), 450);
  }

  // ---------- buttons ----------
  const tap = (id, fn) => $(id).addEventListener('click', () => { cfg.sound.click(); fn(); });
  tap('tName', () => show('traceScreen'));
  tap('tBook', () => show('bookScreen'));
  tap('tBus', close);
  tap('trBack', () => { hush(); T.run++; show('classScreen'); });
  tap('trSay', () => { const p = T.phase === 'trace' && wordFor(T.i); if (p) say(p.say); else say(CHILD_NAME, 0.8); });
  tap('bookBack', () => show('classScreen'));
  $('tNum').addEventListener('click', () => { cfg.sound.nope(); const s = $('tNumSub'); s.textContent = 'Coming soon!'; s.classList.add('wiggle'); setTimeout(() => s.classList.remove('wiggle'), 500); });
  new ResizeObserver(() => {
    if (screen === 'classScreen') drawClass();
    if (screen === 'traceScreen' && T.phase === 'trace' && T.grid && T.grid.count === 0 && !T.done) { layout(); letter(); }
    else if (screen === 'traceScreen' && T.phase !== 'trace') layout();
  }).observe(root);

  return { open };
})();
