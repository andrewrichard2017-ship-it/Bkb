'use strict';
// Home time, after the train: get changed out of school clothes, tidy the toys into the toy box,
// help Mammy cook the dinner (pick pizza, spaghetti or stew; each has its own cooking games), then
// a little scene of eating it together and goodnight. One stage leads to the next.
// tools/make_voice.py reads DRESS, TOYS, FOODS and DISHES from here for the voice clips; lines
// starting m_ are Mammy's and get her own voice.

const DRESS = [
  { cat: 'socks', ask: 'Pick your socks!', icon: '🧦', items: [['white', 'White socks'], ['stripy', 'Stripy socks'], ['spotty', 'Spotty socks'], ['rainbow', 'Rainbow socks']] },
  { cat: 'trousers', ask: 'Pick your trousers!', icon: '👖', items: [['jeans', 'Blue jeans'], ['shorts', 'Red shorts'], ['joggers', 'Grey joggers'], ['skirt', 'A purple skirt']] },
  { cat: 'top', ask: 'Pick your top!', icon: '👕', items: [['stripes', 'A stripy T-shirt'], ['hoodie', 'An orange hoodie'], ['jersey', 'A football jersey'], ['dino', 'A dinosaur T-shirt']] },
  { cat: 'shoes', ask: 'Pick your shoes!', icon: '👟', items: [['trainers', 'Trainers'], ['wellies', 'Green wellies'], ['boots', 'Football boots'], ['sparkly', 'Light-up shoes']] },
  { cat: 'hat', ask: 'Pick a hat!', icon: '🧢', items: [['cap', 'A red cap'], ['bobble', 'A bobble hat'], ['cowboy', 'A cowboy hat'], ['crown', 'A crown']] },
];
const TOYS = [
  { id: 'teddy', name: 'teddy bear', pic: '🧸', say: "It's soft and cuddly, and you give it a big hug at bedtime." },
  { id: 'ball', name: 'ball', pic: '⚽', say: "It's round and bouncy, and you kick it." },
  { id: 'car', name: 'toy car', pic: '🚗', say: "It has four wheels and goes vroom, vroom!" },
  { id: 'dinosaur', name: 'dinosaur', pic: '🦖', say: "It has a long tail and big sharp teeth, and goes roar!" },
  { id: 'robot', name: 'robot', pic: '🤖', say: "It's made of metal and goes beep, boop!" },
  { id: 'rocket', name: 'rocket', pic: '🚀', say: "It zooms up, up, up into space!" },
  { id: 'duck', name: 'rubber duck', pic: '🦆', say: "It floats in the bath and goes quack, quack!" },
  { id: 'drum', name: 'drum', pic: '🥁', say: "You bang it with sticks. Boom, boom, boom!" },
  { id: 'kite', name: 'kite', pic: '🪁', say: "It flies high up in the sky on a long string when it's windy." },
  { id: 'puzzle', name: 'jigsaw', pic: '🧩', say: "It has lots of pieces that fit together to make a picture." },
  { id: 'train', name: 'toy train', pic: '🚂', say: "It goes choo choo along the track, just like your train!" },
  { id: 'yoyo', name: 'yo-yo', pic: '🪀', say: "It goes up and down, up and down, on a string." },
];
const TOYS_PER_GO = 6;
const FOODS = {
  tomatoes: { pic: '🍅', name: 'tomatoes', is: "Those are tomatoes." },
  cheese: { pic: '🧀', name: 'cheese', is: "That's cheese." },
  corn: { pic: '🌽', name: 'sweetcorn', is: "That's sweetcorn." },
  onion: { pic: '🧅', name: 'an onion', is: "That's an onion." },
  meat: { pic: '🥩', name: 'meat', is: "That's meat." },
  potatoes: { pic: '🥔', name: 'potatoes', is: "Those are potatoes." },
  carrots: { pic: '🥕', name: 'carrots', is: "Those are carrots." },
  banana: { pic: '🍌', name: 'a banana', is: "That's a banana." },
  apple: { pic: '🍎', name: 'an apple', is: "That's an apple." },
  egg: { pic: '🥚', name: 'an egg', is: "That's an egg." },
  bread: { pic: '🍞', name: 'bread', is: "That's bread." },
  milk: { pic: '🥛', name: 'milk', is: "That's milk." },
  strawberries: { pic: '🍓', name: 'strawberries', is: "Those are strawberries." },
  grapes: { pic: '🍇', name: 'grapes', is: "Those are grapes." },
  broccoli: { pic: '🥦', name: 'broccoli', is: "That's broccoli." },
};
const DISHES = {
  pizza: { name: 'Pizza', pic: '🍕', sub: 'Spread, top & bake', need: ['tomatoes', 'cheese', 'corn'], steps: ['find', 'sauce', 'toppings', 'bake', 'serve'],
    intro: "Pizza! Yummy! First, let's find the food we need." },
  spaghetti: { name: 'Spaghetti', pic: '🍝', sub: 'Chop & stir the sauce', need: ['onion', 'tomatoes', 'meat'], steps: ['find', 'chop', 'stir', 'serve'], chop: ['onion', 'tomatoes'],
    intro: "Spaghetti bolognese! Yummy! First, let's find the food we need." },
  stew: { name: 'Stew', pic: '🍲', sub: 'Chop & stir the pot', need: ['potatoes', 'carrots', 'onion'], steps: ['find', 'chop', 'stir', 'serve'], chop: ['potatoes', 'carrots', 'onion'],
    intro: "Stew! Yummy! First, let's find the food we need." },
};

const Home = (() => {
  const $ = id => document.getElementById(id);
  const root = $('home'), cv = $('hCanvas'), cx = cv.getContext('2d'), wrap = $('hWrap'), tray = $('hTray');
  const TAU = Math.PI * 2;
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const buzz = ms => { try { if (navigator.vibrate) navigator.vibrate(ms); } catch (e) { /* ignore */ } };
  const pick = a => a[Math.floor(Math.random() * a.length)];
  const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const rr = (...a) => Scene.rr(...a);
  function dot(c, x, y, r) { c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill(); }
  function emoji(c, ch, x, y, size) { c.fillStyle = '#000'; c.font = Math.round(size) + 'px sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(ch, x, y); }
  const LOOKS = { kellan: { skin: '#f1c27d', hair: '#4a2f1b', style: 0, bag: '#2563eb' }, alaina: { skin: '#f1c27d', hair: '#8b5a2b', style: 1, bag: '#ec4899' } };
  const MAMMY = { skin: '#f1c27d', hair: '#7c2d12', style: 5, shirt: '#ec4899', pants: '#1e3a8a', bag: '#ec4899' };

  let cfg = null, onDone = null, run = 0, game = null, W = 1, H = 1, DPR = 1, starAt = 0, outfit = {}, dish = null, mammyLine = null;
  const look = () => LOOKS[cfg.id] || LOOKS.kellan;
  const the = f => 'the ' + FOODS[f].name.replace(/^an? /, '');

  // ---------- the shell: one canvas, a tray of buttons under it, a stage at a time ----------
  function open(opts, done) {
    cfg = opts; onDone = done; outfit = {}; dish = null; starAt = 0; mammyLine = null;
    root.hidden = false; $('hEnd').hidden = true;
    const r = ++run;
    resize();
    let last = performance.now();
    const frame = now => {
      if (r !== run) return;
      const dt = Math.min(0.05, (now - last) / 1000); last = now;
      if (mammyLine && (mammyLine.t -= dt) <= 0) mammyLine = null;
      cx.setTransform(DPR, 0, 0, DPR, 0, 0);
      if (game && game.draw) game.draw(cx, dt, now / 1000);
      if (starAt) bigStar(cx, W / 2, H * 0.42, Math.min(W, H) * 0.22 * (0.3 + 0.7 * Math.min(1, (now - starAt) / 600)), (1 - Math.min(1, (now - starAt) / 600)) * 2);
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
    dress();
  }
  function finish(next) { run++; cfg.hush(); root.hidden = true; game = null; if (onDone) onDone(next); }
  $('hNext').addEventListener('click', () => { cfg.sound.click(); finish('bus'); });
  $('hSchool').addEventListener('click', () => { cfg.sound.click(); finish('school'); });
  $('hSay').addEventListener('click', () => { cfg.sound.click(); if (game && game.again) game.again(); });

  function resize() {
    const r = wrap.getBoundingClientRect();
    W = Math.max(50, r.width); H = Math.max(50, r.height); DPR = Math.min(2, devicePixelRatio || 1);
    cv.width = Math.round(W * DPR); cv.height = Math.round(H * DPR);
    if (game && game.resize) game.resize();
  }
  new ResizeObserver(() => { if (!root.hidden) resize(); }).observe(wrap);
  function prompt(text) { $('hPrompt').textContent = text; }
  function dots(n, i) { $('hDots').innerHTML = Array.from({ length: n }, (_, k) => '<i class="' + (k < i ? 'done' : k === i ? 'now' : '') + '"></i>').join(''); }
  function stage(g, title) {
    game = g; tray.innerHTML = ''; prompt(title || ''); $('hDots').innerHTML = '';
    if (g.start) g.start();
    if (g.resize) g.resize();
  }
  const say = (keys, text) => cfg.say(keys, text);
  function mammy(key, text) { mammyLine = { text: shortLine(text), t: 3.2 }; return say([key], text); }
  const shortLine = t => t.split(/(?<=[!?.])\s/)[0];
  async function goldStar(kind, key, text) {
    const r = run;
    cfg.sound.fanfare(); buzz([40, 60, 40]); starAt = performance.now();
    await say([key], text); await sleep(600);
    starAt = 0;
    if (r !== run) return false;
    cfg.star(kind);
    return true;
  }
  function bigStar(c, x, y, r, rot) {
    c.save(); c.translate(x, y); c.rotate(rot || 0);
    for (const [rad, col, o] of [[r * 1.12, '#b45309', 0], [r, '#fbbf24', 0], [r * 0.45, '#fde68a', -r * 0.1]]) {
      c.fillStyle = col; c.beginPath();
      for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, q = i % 2 ? rad * 0.45 : rad; c.lineTo(o + Math.cos(a) * q, o * 1.2 + Math.sin(a) * q); }
      c.closePath(); c.fill();
    }
    c.restore();
  }
  function pos(e) { const r = cv.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; }
  cv.addEventListener('pointerdown', e => {
    e.preventDefault();
    if (!game || !game.down || starAt) return;
    try { cv.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
    game.down(pos(e));
  });
  cv.addEventListener('pointermove', e => { if (game && game.move) game.move(pos(e)); });
  for (const ev of ['pointerup', 'pointercancel']) cv.addEventListener(ev, e => { if (game && game.up) game.up(pos(e)); });

  // sparkles where something good happened
  let fx = [];
  function burst(x, y) { for (let i = 0; i < 16; i++) { const a = Math.random() * TAU, s = 60 + Math.random() * 140; fx.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 1, col: pick(['#fbbf24', '#f472b6', '#60a5fa', '#34d399']) }); } }
  function drawFx(c, dt) {
    for (const p of fx) { p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 200 * dt; p.life -= dt * 1.4; c.globalAlpha = Math.max(0, p.life); c.fillStyle = p.col; dot(c, p.x, p.y, 4); }
    c.globalAlpha = 1; fx = fx.filter(p => p.life > 0);
  }

  // ---------- the player, as a paper doll ----------
  // Drawn standing on (0, 0), about 345 tall, y up is negative.
  const LEGS = [-30, 6];
  const CLOTHES = {
    socks: {
      box: [-36, -66, 72, 66],
      draw(c, id, t) {
        for (const x of LEGS) {
          c.save(); c.beginPath(); c.rect(x - 1, -60, 26, 52); c.ellipse(x + 12 + (x < 0 ? -6 : 6), -8, 18, 9, 0, 0, TAU); c.clip();
          c.fillStyle = { white: '#f8fafc', stripy: '#ef4444', spotty: '#2563eb', rainbow: '#ef4444' }[id]; c.fillRect(x - 30, -64, 90, 70);
          if (id === 'stripy') { c.fillStyle = '#fff'; for (let y = -60; y < 0; y += 12) c.fillRect(x - 30, y, 90, 6); }
          if (id === 'spotty') { c.fillStyle = '#fff'; for (let y = -54; y < 0; y += 11) for (let xx = x - 12; xx < x + 40; xx += 11) dot(c, xx + (y % 2 ? 5 : 0), y, 2.6); }
          if (id === 'rainbow') ['#ef4444', '#f59e0b', '#facc15', '#22c55e', '#3b82f6', '#a855f7'].forEach((col, k) => { c.fillStyle = col; c.fillRect(x - 30, -60 + k * 10, 90, 10); });
          c.restore();
          if (id === 'white') { c.strokeStyle = '#cbd5e1'; c.lineWidth = 2; c.beginPath(); c.moveTo(x - 1, -60); c.lineTo(x - 1, -12); c.moveTo(x + 25, -60); c.lineTo(x + 25, -12); c.moveTo(x - 1, -60); c.lineTo(x + 25, -60); c.stroke(); }
        }
      },
    },
    trousers: {
      box: [-60, -174, 120, 166],
      draw(c, id) {
        if (id === 'skirt') {
          c.fillStyle = '#a855f7'; c.beginPath(); c.moveTo(-41, -170); c.lineTo(41, -170); c.lineTo(58, -98); c.lineTo(-58, -98); c.closePath(); c.fill();
          c.strokeStyle = '#7e22ce'; c.lineWidth = 3; c.beginPath(); for (const x of [-24, 0, 24]) { c.moveTo(x * 0.8, -165); c.lineTo(x * 1.3, -100); } c.stroke();
          return;
        }
        const col = { jeans: '#2563eb', shorts: '#ef4444', joggers: '#9ca3af' }[id], end = id === 'shorts' ? -100 : -14;
        c.fillStyle = col; rr(c, -41, -172, 82, 40, 10); c.fill();
        for (const x of LEGS) { c.fillRect(x - 3, -150, 30, end + 150); }
        if (id === 'jeans') { c.strokeStyle = '#93c5fd'; c.lineWidth = 2; c.setLineDash([5, 4]); c.beginPath(); for (const x of LEGS) { c.moveTo(x + 21, -140); c.lineTo(x + 21, end - 4); } c.stroke(); c.setLineDash([]); }
        if (id === 'joggers') { c.fillStyle = '#6b7280'; for (const x of LEGS) c.fillRect(x - 3, end - 12, 30, 12); c.fillRect(-41, -172, 82, 8); }
        if (id === 'shorts') { c.fillStyle = '#fff'; for (const x of LEGS) c.fillRect(x + (x < 0 ? -3 : 23), -150, 4, 50); }
        c.fillStyle = 'rgba(0,0,0,.25)'; c.fillRect(-1.5, -150, 3, 24);
      },
    },
    shoes: {
      box: [-42, -78, 84, 80],
      draw(c, id, t) {
        for (const x of LEGS) {
          const cx = x + 12 + (x < 0 ? -6 : 6);
          if (id === 'wellies') { c.fillStyle = '#16a34a'; c.fillRect(cx - 15, -74, 30, 60); c.fillStyle = '#15803d'; c.fillRect(cx - 16, -76, 32, 9); }
          c.fillStyle = { trainers: '#f8fafc', wellies: '#16a34a', boots: '#111827', sparkly: '#f472b6' }[id];
          rr(c, cx - 21, -22, 42, 22, 10); c.fill();
          c.fillStyle = id === 'boots' ? '#9ca3af' : '#475569'; c.fillRect(cx - 21, -5, 42, 5);
          if (id === 'trainers') { c.fillStyle = '#3b82f6'; c.fillRect(cx - 10, -18, 20, 4); c.fillRect(cx - 6, -12, 14, 4); }
          if (id === 'boots') { c.fillStyle = '#fff'; c.fillRect(cx - 12, -16, 24, 3); c.fillStyle = '#d1d5db'; for (const k of [-14, -4, 6, 14]) dot(c, cx + k, 1, 2.4); }
          if (id === 'sparkly') ['#facc15', '#60a5fa', '#34d399'].forEach((col, k) => { c.fillStyle = Math.floor(t * 4 + k) % 3 === 0 ? col : 'rgba(255,255,255,.6)'; dot(c, cx - 12 + k * 12, -3, 3); });
        }
      },
    },
    top: {
      box: [-72, -268, 144, 122],
      draw(c, id) {
        const col = { stripes: '#1e3a8a', hoodie: '#f97316', jersey: '#16a34a', dino: '#14b8a6' }[id], long = id === 'hoodie';
        c.strokeStyle = col; c.lineCap = 'round';
        for (const s of [-1, 1]) {
          c.lineWidth = long ? 24 : 27; c.beginPath(); c.moveTo(s * 36, -244);
          c.lineTo(s * (long ? 50 : 45), long ? -160 : -205); c.stroke();
        }
        if (id === 'hoodie') { c.fillStyle = '#ea580c'; c.beginPath(); c.ellipse(0, -262, 34, 14, 0, 0, TAU); c.fill(); }
        c.fillStyle = col; rr(c, -42, -262, 84, 112, 20); c.fill();
        c.save(); rr(c, -42, -262, 84, 112, 20); c.clip();
        if (id === 'stripes') { c.fillStyle = '#fff'; for (let y = -250; y < -150; y += 18) c.fillRect(-50, y, 100, 8); }
        if (id === 'hoodie') { c.fillStyle = '#ea580c'; rr(c, -26, -196, 52, 26, 8); c.fill(); c.strokeStyle = '#fff'; c.lineWidth = 2.5; c.beginPath(); c.moveTo(-8, -255); c.lineTo(-9, -225); c.moveTo(8, -255); c.lineTo(9, -225); c.stroke(); }
        c.restore();
        if (id === 'stripes') { c.strokeStyle = '#fff'; c.lineWidth = 6; for (const s of [-1, 1]) { c.beginPath(); c.moveTo(s * 39, -232); c.lineTo(s * 43, -215); c.stroke(); } }
        if (id === 'jersey') { c.fillStyle = '#fff'; c.font = '700 46px Fredoka, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('9', 0, -205); c.fillRect(-14, -262, 28, 6); }
        if (id === 'dino') emoji(c, '🦖', 0, -205, 46);
        c.lineCap = 'butt';
      },
    },
    hat: {
      box: [-64, -378, 128, 66],
      draw(c, id) {
        if (id === 'cap') {
          c.fillStyle = '#dc2626'; c.beginPath(); c.ellipse(0, -326, 37, 28, 0, Math.PI, 0); c.fill();
          c.beginPath(); c.ellipse(30, -326, 30, 7, 0, 0, TAU); c.fill(); c.fillStyle = '#fff'; dot(c, 0, -353, 4);
        } else if (id === 'bobble') {
          c.fillStyle = '#2563eb'; c.beginPath(); c.ellipse(0, -322, 38, 34, 0, Math.PI, 0); c.fill();
          c.fillStyle = '#93c5fd'; rr(c, -40, -330, 80, 14, 6); c.fill(); c.fillStyle = '#fff'; dot(c, 0, -358, 12);
        } else if (id === 'cowboy') {
          c.fillStyle = '#92400e'; c.beginPath(); c.ellipse(0, -326, 62, 11, 0, 0, TAU); c.fill();
          rr(c, -30, -368, 60, 44, 14); c.fill(); c.fillStyle = '#451a03'; c.fillRect(-30, -340, 60, 8);
        } else {
          c.fillStyle = '#facc15'; c.beginPath(); c.moveTo(-34, -326); c.lineTo(-34, -362); c.lineTo(-17, -344); c.lineTo(0, -370); c.lineTo(17, -344); c.lineTo(34, -362); c.lineTo(34, -326); c.closePath(); c.fill();
          c.fillStyle = '#ef4444'; dot(c, 0, -340, 5); c.fillStyle = '#3b82f6'; dot(c, -20, -336, 4); dot(c, 20, -336, 4);
        }
      },
    },
  };
  function doll(c, L, o, t) {
    // legs, feet, arms, underwear
    c.fillStyle = L.skin;
    for (const x of LEGS) { c.fillRect(x, -152, 24, 142); c.beginPath(); c.ellipse(x + 12 + (x < 0 ? -6 : 6), -8, 17, 9, 0, 0, TAU); c.fill(); }
    c.strokeStyle = L.skin; c.lineWidth = 19; c.lineCap = 'round';
    for (const s of [-1, 1]) { c.beginPath(); c.moveTo(s * 36, -244); c.lineTo(s * 50, -158); c.stroke(); }
    c.lineCap = 'butt';
    c.fillStyle = L.skin; for (const s of [-1, 1]) dot(c, s * 51, -150, 11);
    c.fillRect(-9, -280, 18, 24);
    c.fillStyle = '#f8fafc'; rr(c, -38, -168, 76, 36, 10); c.fill(); rr(c, -36, -258, 72, 104, 18); c.fill();
    for (const cat of ['socks', 'trousers', 'shoes', 'top']) if (o[cat]) CLOTHES[cat].draw(c, o[cat], t);
    c.save(); c.translate(0, -308); c.scale(2.6, 2.6); Scene.head(c, L); c.restore();
    if (o.hat) CLOTHES.hat.draw(c, o.hat, t);
  }

  // ---------- 1. get changed ----------
  function dress() {
    let cat = 0, ready = false;
    const L = look();
    const tabs = document.createElement('div'), items = document.createElement('div'), go = document.createElement('button');
    tabs.className = 'hTabs'; items.className = 'hItems'; go.className = 'hGo'; go.textContent = 'I’m dressed! ⭐'; go.hidden = true;
    function render() {
      tabs.innerHTML = '';
      DRESS.forEach((d, k) => {
        const b = document.createElement('button');
        b.className = 'hTab' + (k === cat ? ' sel' : '') + (outfit[d.cat] ? ' got' : '');
        b.textContent = d.icon; b.setAttribute('aria-label', d.cat);
        b.addEventListener('click', () => { cfg.sound.click(); cat = k; render(); say(['d_cat_' + d.cat], d.ask); });
        tabs.appendChild(b);
      });
      items.innerHTML = '';
      const d = DRESS[cat], [bx, by, bw, bh] = CLOTHES[d.cat].box;
      for (const [id, name] of d.items) {
        const b = document.createElement('button'), pc = document.createElement('canvas'), dpr = Math.min(2, devicePixelRatio || 1), S = 80;
        b.className = 'hItem' + (outfit[d.cat] === id ? ' sel' : ''); b.setAttribute('aria-label', name);
        pc.width = S * dpr; pc.height = S * dpr;
        const c = pc.getContext('2d'), k = Math.min(S / bw, S / bh) * 0.86;
        c.setTransform(dpr * k, 0, 0, dpr * k, dpr * (S / 2 - (bx + bw / 2) * k), dpr * (S / 2 - (by + bh / 2) * k));
        if (d.cat === 'hat') { c.save(); c.translate(0, -308); c.scale(2.6, 2.6); c.fillStyle = 'rgba(0,0,0,.08)'; dot(c, 0, 0, 13); c.restore(); }
        CLOTHES[d.cat].draw(c, id, 0);
        b.appendChild(pc);
        b.addEventListener('click', () => choose(d, id, name));
        items.appendChild(b);
      }
      go.hidden = !ready;
      prompt(ready ? 'All dressed!' : d.ask);
      dots(DRESS.length, DRESS.filter(x => outfit[x.cat]).length);
    }
    function choose(d, id, name) {
      const first = !outfit[d.cat];
      outfit[d.cat] = id; cfg.sound.sparkle(); buzz(15);
      burst(W / 2, H * 0.5);
      cfg.hush(); say(['d_' + d.cat + '_' + id], name + '!');
      ready = DRESS.every(x => outfit[x.cat]);
      if (first && !ready) { const k = DRESS.findIndex(x => !outfit[x.cat]); setTimeout(() => { if (game === g) { cat = k; render(); } }, 900); }
      render();
    }
    go.addEventListener('click', async () => {
      if (go.disabled) return;
      go.disabled = true; cfg.sound.click();
      cfg.save.outfit = Object.assign({}, outfit); cfg.persist();
      if (await goldStar('dress', 'd_star_' + cfg.id, 'You look brilliant, ' + cfg.name + '! You get a gold star!')) toys();
    });
    const g = {
      start() {
        tray.append(tabs, items, go); render();
        say(['h_hello_' + cfg.id], 'Welcome home, ' + cfg.name + "! Let's get changed out of your school clothes. Pick your socks!");
      },
      again() { say(['d_cat_' + DRESS[cat].cat], DRESS[cat].ask); },
      draw(c, dt, t) {
        c.fillStyle = '#e0f2fe'; c.fillRect(0, 0, W, H);
        c.fillStyle = '#bae6fd'; for (let x = 20; x < W; x += 60) for (let y = 20; y < H * 0.8; y += 60) dot(c, x + (y % 120 ? 30 : 0), y, 5);
        c.fillStyle = '#c98f55'; c.fillRect(0, H * 0.86, W, H * 0.14);
        const sc = Math.min(H * 0.9 / 385, W * 0.9 / 150), x = W / 2, y = H * 0.94;
        c.fillStyle = '#f9a8d4'; c.beginPath(); c.ellipse(x, y, 90 * sc, 16 * sc, 0, 0, TAU); c.fill();
        c.save(); c.translate(x, y); c.scale(sc, sc); doll(c, L, outfit, t); c.restore();
        drawFx(c, dt);
      },
    };
    stage(g, DRESS[0].ask);
  }

  // ---------- 2. tidy up: find each toy from its description and put it in the toy box ----------
  function toys() {
    const first = (cfg.save.toyNext || 0) % TOYS.length, list = [];
    for (let k = 0; k < TOYS_PER_GO; k++) list.push(TOYS[(first + k) % TOYS.length]);
    const items = shuffle(list.map(t => ({ t, x: 0, y: 0, hx: 0, hy: 0, placed: false, in: 0, sx: 0, sy: 0 })));
    const order = shuffle(items.slice());
    let i = 0, drag = null, box = null, s = 50, idle = 0, busy = false, laid = false;
    function layout() {
      const land = W > H * 1.1, fy = H * 0.4;
      s = clamp(Math.min(W, H) * 0.13, 34, 96);
      box = land ? { x: W * 0.72, y: H * 0.5, w: W * 0.25, h: H * 0.44 } : { x: W * 0.28, y: H * 0.74, w: W * 0.44, h: H * 0.23 };
      const area = land ? { x: W * 0.04, y: fy + s * 0.6, w: W * 0.64, h: H - fy - s * 1.2 } : { x: W * 0.06, y: fy + s * 0.6, w: W * 0.88, h: H * 0.72 - fy - s * 1.1 };
      const cols = land ? 3 : 3, rows = 2;
      items.forEach((it, k) => {
        const col = k % cols, row = Math.floor(k / cols);
        it.hx = area.x + area.w * (col + 0.5) / cols + ((k * 37) % 11 - 5) * s * 0.06;
        it.hy = area.y + area.h * (row + 0.5) / rows + ((k * 53) % 7 - 3) * s * 0.06;
        if (!laid || !it.moved) { it.x = it.hx; it.y = it.hy; }
      });
      laid = true;
    }
    const target = () => order[i];
    function ask() {
      const it = target();
      prompt(it.t.name); dots(order.length, i); idle = 0;
      say(['to_find_' + it.t.id], 'Can you find the ' + it.t.name + '? ' + it.t.say + ' Put it in the toy box!');
    }
    const inBox = p => box && p.x > box.x - s * 0.3 && p.x < box.x + box.w + s * 0.3 && p.y > box.y - s * 0.8 && p.y < box.y + box.h;
    const g = {
      start() { layout(); setTimeout(() => { if (game === g) { say(['to_intro'], "Uh oh! There are toys all over the floor. Let's tidy up!"); setTimeout(() => { if (game === g) ask(); }, 3200); } }, 400); prompt("Tidy up time!"); },
      resize: layout,
      again() { if (target()) ask(); },
      down(p) {
        if (busy) return;
        let hit = null;
        for (const it of items) if (!it.placed && Math.hypot(p.x - it.x, p.y - it.y) < s * 0.7) hit = it;
        if (!hit) return;
        items.splice(items.indexOf(hit), 1); items.push(hit);
        drag = { it: hit, dx: hit.x - p.x, dy: hit.y - p.y, sx: p.x, sy: p.y, ox: hit.x, oy: hit.y, moved: false }; idle = 0;
        cfg.sound.pop();
      },
      move(p) {
        if (!drag) return;
        if (Math.hypot(p.x - drag.sx, p.y - drag.sy) > 8) drag.moved = true;
        drag.it.x = clamp(p.x + drag.dx, s / 2, W - s / 2); drag.it.y = clamp(p.y + drag.dy, H * 0.35, H - s / 2);
      },
      async up(p) {
        if (!drag) return;
        const d = drag, it = d.it; drag = null;
        if (!d.moved) { it.x = d.ox; it.y = d.oy; cfg.hush(); say(['to_is_' + it.t.id], "That's the " + it.t.name + '.'); return; }
        it.moved = true;
        if (!inBox({ x: it.x, y: it.y })) return;
        if (it !== target()) {
          it.x = d.ox; it.y = d.oy; cfg.sound.nope(); buzz(30); cfg.hush();
          say(['to_is_' + it.t.id, 'p_again'], "That's the " + it.t.name + '. Have another go!');
          return;
        }
        busy = true; it.placed = true; it.sx = it.x; it.sy = it.y; it.in = 0.001;
        cfg.sound.sparkle(); buzz(25); burst(box.x + box.w / 2, box.y);
        const r = run;
        cfg.hush(); await say(['to_yes_' + it.t.id], 'Yes! The ' + it.t.name + ' goes in the toy box!');
        await sleep(300);
        if (r !== run || game !== g) return;
        busy = false;
        if (++i < order.length) return ask();
        dots(order.length, order.length);
        cfg.save.toyNext = (first + TOYS_PER_GO) % TOYS.length; cfg.persist();
        if (await goldStar('toys', 'to_star_' + cfg.id, 'What a tidy bedroom! Well done, ' + cfg.name + '! You get a gold star!')) chooseDinner();
      },
      draw(c, dt, t) {
        const fy = H * 0.4;
        // bedroom: wall, window with the evening outside, bed, floor and rug
        c.fillStyle = '#fef3c7'; c.fillRect(0, 0, W, fy);
        c.fillStyle = '#fde68a'; for (let x = 0; x < W; x += 40) c.fillRect(x, 0, 18, fy);
        const wx = W * 0.08, ww = Math.min(W * 0.22, 170), wh = fy * 0.6;
        c.fillStyle = '#fff'; c.fillRect(wx - 6, fy * 0.15 - 6, ww + 12, wh + 12);
        const sky = c.createLinearGradient(0, fy * 0.15, 0, fy * 0.15 + wh); sky.addColorStop(0, '#f472b6'); sky.addColorStop(1, '#fdba74');
        c.fillStyle = sky; c.fillRect(wx, fy * 0.15, ww, wh); c.fillStyle = '#fff'; c.fillRect(wx + ww / 2 - 3, fy * 0.15, 6, wh);
        c.fillStyle = '#a16207'; c.fillRect(0, fy, W, H - fy);
        c.strokeStyle = 'rgba(0,0,0,.12)'; c.lineWidth = 2; c.beginPath(); for (let y = fy + 30; y < H; y += 30) { c.moveTo(0, y); c.lineTo(W, y); } c.stroke();
        const bx = W * 0.52, bw = Math.min(W * 0.36, 300);
        c.fillStyle = '#60a5fa'; rr(c, bx, fy - 46, bw, 60, 10); c.fill(); c.fillStyle = '#fff'; rr(c, bx + 8, fy - 58, bw * 0.28, 22, 10); c.fill();
        c.fillStyle = '#7c2d12'; c.fillRect(bx - 8, fy - 80, 12, 100); c.fillRect(bx + bw - 4, fy - 60, 12, 80);
        c.fillStyle = 'rgba(236,72,153,.35)'; c.beginPath(); c.ellipse(W * 0.38, fy + (H - fy) * 0.5, W * 0.3, (H - fy) * 0.3, 0, 0, TAU); c.fill();
        // the toy box, open
        if (box) {
          c.fillStyle = '#92400e'; c.save(); c.translate(box.x, box.y); c.rotate(-0.25); rr(c, 0, -box.h * 0.5, box.w, box.h * 0.45, 10); c.fill(); c.restore();
          c.fillStyle = '#451a03'; rr(c, box.x, box.y, box.w, box.h * 0.2, 8); c.fill();
          for (const it of items) if (it.placed && it.in >= 1) emoji(c, it.t.pic, box.x + box.w * (0.2 + 0.6 * ((items.indexOf(it) * 37) % 10) / 10), box.y + box.h * 0.08, s * 0.7);
          c.fillStyle = '#b45309'; rr(c, box.x, box.y + box.h * 0.12, box.w, box.h * 0.88, 10); c.fill();
          c.fillStyle = '#fbbf24'; c.font = '700 ' + Math.round(box.h * 0.22) + 'px Fredoka, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
          c.fillText('TOYS', box.x + box.w / 2, box.y + box.h * 0.56);
        }
        idle += dt;
        for (const it of items) {
          if (it.placed) {
            if (it.in > 0 && it.in < 1) {
              it.in = Math.min(1, it.in + dt * 2.2);
              const k = it.in, tx = box.x + box.w / 2, ty = box.y;
              emoji(c, it.t.pic, it.sx + (tx - it.sx) * k, it.sy + (ty - it.sy) * k - Math.sin(k * Math.PI) * s, s * (1 - k * 0.4));
            }
            continue;
          }
          const lift = drag && drag.it === it, wig = !drag && !busy && idle > 9 && it === target() ? Math.sin(t * 14) * 0.2 : 0;
          c.fillStyle = 'rgba(0,0,0,.18)'; c.beginPath(); c.ellipse(it.x, it.y + s * 0.45, s * 0.4, s * 0.1, 0, 0, TAU); c.fill();
          c.save(); c.translate(it.x, it.y - (lift ? 6 : 0)); c.rotate(wig); emoji(c, it.t.pic, 0, 0, s * (lift ? 1.15 : 1)); c.restore();
        }
        drawFx(c, dt);
      },
    };
    stage(g, 'Tidy up time!');
  }

  // ---------- 3. dinner with Mammy ----------
  function kitchen(c, t) {
    const ty = H * 0.66;
    c.fillStyle = '#fef9c3'; c.fillRect(0, 0, W, ty);
    c.strokeStyle = 'rgba(0,0,0,.06)'; c.lineWidth = 2; c.beginPath();
    for (let y = ty * 0.45; y < ty; y += 26) { c.moveTo(0, y); c.lineTo(W, y); }
    for (let x = 0; x < W; x += 26) { c.moveTo(x, ty * 0.45); c.lineTo(x, ty); }
    c.stroke();
    const wx = W * 0.4, ww = Math.min(W * 0.24, 200), wh = ty * 0.34;
    c.fillStyle = '#fff'; c.fillRect(wx - 6, ty * 0.06 - 6, ww + 12, wh + 12);
    const sky = c.createLinearGradient(0, ty * 0.06, 0, ty * 0.06 + wh); sky.addColorStop(0, '#7c3aed'); sky.addColorStop(1, '#fb923c');
    c.fillStyle = sky; c.fillRect(wx, ty * 0.06, ww, wh); c.fillStyle = '#fff'; c.fillRect(wx + ww / 2 - 3, ty * 0.06, 6, wh);
    c.fillStyle = '#e5e7eb'; c.fillRect(0, ty, W, 12); c.fillStyle = '#0d9488'; c.fillRect(0, ty + 12, W, H - ty);
    c.strokeStyle = 'rgba(0,0,0,.2)'; c.beginPath(); for (let x = 60; x < W; x += 120) { c.moveTo(x, ty + 20); c.lineTo(x, H); } c.stroke();
    c.fillStyle = '#fbbf24'; for (let x = 30; x < W; x += 120) c.fillRect(x + 50, ty + 40, 20, 6);
  }
  function mammyFig(c, x, y, sc, t, wave) {
    Scene.kid(c, { look: MAMMY, face: 1, wave: !!wave, phase: 1, alpha: 1 }, x, y, sc, t);
    c.fillStyle = '#fff'; rr(c, x - 8 * sc, y - 36 * sc, 16 * sc, 20 * sc, 3 * sc); c.fill();
    if (mammyLine) { // keep the bubble on screen
      const k = Math.min(1.4, sc / 1.6); c.font = '700 16px Fredoka, "Trebuchet MS", sans-serif';
      const half = (c.measureText(mammyLine.text).width + 18) * k / 2 + 6;
      Scene.bubble(c, mammyLine.text, clamp(x + 6 * sc, half, W - half), y - 74 * sc, k);
    }
  }
  // where the cooking happens, leaving room for Mammy on the left
  function area() {
    const land = W > H * 1.1;
    return land ? { x: W * 0.24, y: H * 0.04, w: W * 0.74, h: H * 0.92, land } : { x: W * 0.04, y: H * 0.03, w: W * 0.92, h: H * 0.7, land };
  }
  function drawMammy(c, t, wave) {
    const land = W > H * 1.1, sc = land ? Math.min(H * 0.62 / 70, W * 0.18 / 30) : Math.min(W * 0.2 / 30, H * 0.22 / 70);
    mammyFig(c, land ? W * 0.12 : W * 0.14, H * 0.98, sc, t, wave);
  }

  function chooseDinner() {
    const g = {
      start() {
        const row = document.createElement('div'); row.className = 'hCards';
        for (const [id, d] of Object.entries(DISHES)) {
          const b = document.createElement('button'); b.className = 'hCard';
          b.innerHTML = '<span class="pic">' + d.pic + '</span><b>' + d.name + '</b><small>' + d.sub + '</small>';
          b.addEventListener('click', () => {
            if (dish) return;
            dish = Object.assign({ id }, d); cfg.sound.sparkle(); cfg.hush();
            b.classList.add('sel');
            const r = run;
            mammy('m_dish_' + id, d.intro).then(() => { if (r === run) cook(0); });
          });
          row.appendChild(b);
        }
        tray.appendChild(row);
        setTimeout(() => { if (game === g) mammy('m_pick', 'What will we make for dinner? You pick!'); }, 400);
      },
      again() { mammy('m_pick', 'What will we make for dinner? You pick!'); },
      draw(c, dt, t) {
        kitchen(c, t);
        const sc = Math.min(H * 0.7 / 70, W * 0.3 / 30);
        mammyFig(c, W * 0.5, H * 0.98, sc, t, true);
        drawFx(c, dt);
      },
    };
    stage(g, 'What’s for dinner?');
  }

  function cook(k) {
    const step = dish.steps[k], next = () => { if (k + 1 < dish.steps.length) cook(k + 1); };
    ({ find, chop, stir, sauce, toppings, bake, serve })[step](next);
  }

  // find each food Mammy needs in the cupboard
  function find(next) {
    const need = dish.need.slice(), others = shuffle(Object.keys(FOODS).filter(f => !need.includes(f))).slice(0, 5);
    const cells = shuffle(need.concat(others)).map(f => ({ f, got: false, fly: 0 }));
    let i = 0, busy = false, A = null, cw = 0, chh = 0, cols = 4;
    const bowl = () => A.land ? { x: A.x + A.w * 0.88, y: A.y + A.h * 0.5 } : { x: A.x + A.w * 0.75, y: A.y + A.h * 0.9 };
    const cellAt = k => ({ x: A.x + (k % cols + 0.5) * cw, y: A.y + (Math.floor(k / cols) + 0.5) * chh });
    function layout() {
      A = area(); cols = A.land ? 4 : 3;
      const pw = A.land ? A.w * 0.74 : A.w, ph = A.land ? A.h : A.h * 0.78;
      cw = pw / cols; chh = ph / Math.ceil(cells.length / cols);
    }
    const ask = () => { const f = need[i]; dots(need.length, i); prompt('Find ' + the(f)); mammy('m_need_' + f, 'We need ' + FOODS[f].name + '! Can you find ' + the(f) + '?'); };
    const g = {
      start() { layout(); ask(); },
      resize: layout,
      again: ask,
      async down(p) {
        if (busy) return;
        const k = cells.findIndex((cl, j) => { const q = cellAt(j); return !cl.got && Math.abs(p.x - q.x) < cw / 2 && Math.abs(p.y - q.y) < chh / 2; });
        if (k < 0) return;
        const cl = cells[k];
        if (cl.f !== need[i]) { cfg.sound.nope(); buzz(30); cfg.hush(); say(['fw_' + cl.f, 'p_again'], FOODS[cl.f].is + ' Have another go!'); return; }
        busy = true; cl.got = true; cl.fly = 0.001; cl.k = k; cfg.sound.sparkle(); buzz(20);
        const r = run;
        cfg.hush(); await mammy('m_yes', 'Yes, that’s it! Thank you!');
        if (r !== run || game !== g) return;
        busy = false;
        if (++i < need.length) ask(); else { dots(need.length, need.length); next(); }
      },
      draw(c, dt, t) {
        kitchen(c, t);
        // the open cupboard
        const pw = cw * cols, ph = chh * Math.ceil(cells.length / cols);
        c.fillStyle = '#92400e'; rr(c, A.x - 8, A.y - 8, pw + 16, ph + 16, 12); c.fill();
        c.fillStyle = '#fde68a'; rr(c, A.x, A.y, pw, ph, 8); c.fill();
        c.fillStyle = '#b45309'; for (let r = 1; r < Math.ceil(cells.length / cols); r++) c.fillRect(A.x, A.y + r * chh - 4, pw, 8);
        const sz = Math.min(cw, chh) * 0.62;
        cells.forEach((cl, k) => { if (!cl.got) { const q = cellAt(k); emoji(c, FOODS[cl.f].pic, q.x, q.y, sz); } });
        // the bowl, with what's been found
        const b = bowl(), br = Math.min(A.w, A.h) * 0.12;
        const got = cells.filter(cl => cl.got && cl.fly >= 1);
        got.forEach((cl, j) => emoji(c, FOODS[cl.f].pic, b.x + (j - (got.length - 1) / 2) * br * 0.55, b.y - br * 0.35, br * 0.8));
        c.fillStyle = '#60a5fa'; c.beginPath(); c.ellipse(b.x, b.y - br * 0.1, br * 1.2, br * 0.3, 0, 0, TAU); c.fill();
        c.beginPath(); c.moveTo(b.x - br * 1.2, b.y - br * 0.1); c.quadraticCurveTo(b.x, b.y + br * 1.3, b.x + br * 1.2, b.y - br * 0.1); c.fill();
        for (const cl of cells) if (cl.fly > 0 && cl.fly < 1) {
          cl.fly = Math.min(1, cl.fly + dt * 2.5); const q = cellAt(cl.k), e = cl.fly;
          emoji(c, FOODS[cl.f].pic, q.x + (b.x - q.x) * e, q.y + (b.y - br * 0.4 - q.y) * e - Math.sin(e * Math.PI) * 60, sz * (1 - e * 0.3));
        }
        drawMammy(c, t);
        drawFx(c, dt);
      },
    };
    stage(g, '');
  }

  // a pot on the hob, used by chop, stir and serve
  function pot(c, x, y, r, t, fill, heat) {
    c.fillStyle = heat ? '#f97316' : '#6b7280'; c.beginPath(); c.ellipse(x, y + r * 0.62, r * 1.05, r * 0.2, 0, 0, TAU); c.fill();
    c.fillStyle = '#9ca3af'; rr(c, x - r, y - r * 0.2, r * 2, r * 0.8, r * 0.18); c.fill();
    c.fillStyle = '#4b5563'; c.fillRect(x - r * 1.35, y - r * 0.05, r * 0.36, r * 0.12); c.fillRect(x + r, y - r * 0.05, r * 0.36, r * 0.12);
    c.fillStyle = '#6b7280'; c.beginPath(); c.ellipse(x, y - r * 0.2, r, r * 0.3, 0, 0, TAU); c.fill();
    c.fillStyle = fill; c.beginPath(); c.ellipse(x, y - r * 0.18, r * 0.88, r * 0.24, 0, 0, TAU); c.fill();
  }
  const SAUCE = { pizza: '#dc2626', spaghetti: '#b91c1c', stew: '#92400e' };

  // tap to chop each vegetable; the pieces slide into the pot
  function chop(next) {
    const veg = dish.chop.slice();
    let i = 0, cuts = 0, slide = 0, knife = 0, A = null, pics = {}, inPot = [];
    const CUTS = 4;
    const ask = () => { dots(veg.length, i); prompt('Chop ' + the(veg[i])); mammy('m_chop_' + veg[i], "Let's chop " + the(veg[i]) + '! Tap, tap, tap!'); };
    function geo() {
      A = area();
      return A.land ? { bx: A.x + A.w * 0.36, by: A.y + A.h * 0.55, s: Math.min(A.w * 0.4, A.h * 0.6), px: A.x + A.w * 0.82, py: A.y + A.h * 0.62, pr: Math.min(A.w * 0.14, A.h * 0.24) }
        : { bx: A.x + A.w * 0.5, by: A.y + A.h * 0.36, s: Math.min(A.w * 0.7, A.h * 0.44), px: A.x + A.w * 0.5, py: A.y + A.h * 0.86, pr: Math.min(A.w * 0.2, A.h * 0.12) };
    }
    function picFor(f, s) { // the vegetable drawn once, to slice up
      const key = f + Math.round(s);
      if (pics[key]) return pics[key];
      const p = document.createElement('canvas'), d = Math.min(2, devicePixelRatio || 1); p.width = p.height = Math.round(s * d);
      const c = p.getContext('2d'); c.scale(d, d); emoji(c, FOODS[f].pic, s / 2, s / 2, s * 0.8);
      return (pics[key] = p);
    }
    const g = {
      start() { geo(); ask(); },
      resize: geo,
      again: ask,
      down(p) {
        if (slide || i >= veg.length) return;
        const G = geo();
        if (Math.abs(p.x - G.bx) > G.s * 0.7 || Math.abs(p.y - G.by) > G.s * 0.6) return;
        cuts++; knife = 1; cfg.sound.chop(); buzz(15);
        if (cuts >= CUTS) {
          slide = 0.001; const r = run;
          setTimeout(() => {
            if (r !== run || game !== g) return;
            inPot.push(veg[i]); cuts = 0; slide = 0;
            if (++i < veg.length) ask(); else { dots(veg.length, veg.length); cfg.sound.sparkle(); next(); }
          }, 900);
        }
      },
      draw(c, dt, t) {
        kitchen(c, t);
        const G = geo(), s = G.s;
        pot(c, G.px, G.py, G.pr, t, SAUCE[dish.id], true);
        inPot.forEach((f, j) => emoji(c, FOODS[f].pic, G.px + (j - (inPot.length - 1) / 2) * G.pr * 0.5, G.py - G.pr * 0.32, G.pr * 0.45));
        c.fillStyle = '#d6a76c'; rr(c, G.bx - s * 0.6, G.by - s * 0.42, s * 1.2, s * 0.84, s * 0.08); c.fill();
        c.fillStyle = '#b07a43'; dot(c, G.bx + s * 0.5, G.by - s * 0.3, s * 0.03);
        if (i < veg.length) {
          const pic = picFor(veg[i], s * 0.75), n = cuts + 1, pw = pic.width / n, sz = s * 0.75;
          if (slide) slide = Math.min(1, slide + dt * 1.6);
          for (let k = 0; k < n; k++) {
            const gap = (k - (n - 1) / 2) * s * 0.06, dx = G.bx - sz / 2 + k * sz / n + gap, dy = G.by - sz / 2;
            const tx = dx + (G.px - G.bx) * slide, ty = dy + (G.py - G.pr * 0.6 - G.by) * slide;
            c.drawImage(pic, k * pw, 0, pw, pic.height, tx, ty, sz / n, sz);
          }
          // Mammy's knife comes down with every tap
          knife = Math.max(0, knife - dt * 5);
          c.save(); c.translate(G.bx + s * 0.1 + (cuts - 1.5) * s * 0.08, G.by - s * 0.45 + knife * s * 0.25); c.rotate(-0.6); emoji(c, '🔪', 0, 0, s * 0.35); c.restore();
        }
        drawMammy(c, t);
        drawFx(c, dt);
      },
    };
    stage(g, '');
  }

  // stir the pot round and round
  function stir(next) {
    let turned = 0, last = null, sp = null, done = false, A = null, ang = 0, held = false;
    const NEED = TAU * 4;
    function geo() { A = area(); return { x: A.x + A.w / 2, y: A.y + A.h * 0.58, r: Math.min(A.w * 0.34, A.h * (A.land ? 0.5 : 0.38)) }; }
    const ask = () => mammy('m_stir', 'Stir the pot! Round and round and round!');
    const g = {
      start() { geo(); prompt('Stir the pot'); ask(); dots(4, 0); },
      resize: geo, again: ask,
      down(p) { last = null; held = true; this.move(p); },
      move(p) {
        if (done || !held) return;
        const P = geo(); sp = p;
        const a = Math.atan2((p.y - (P.y - P.r * 0.18)) / 0.35, p.x - P.x), d = Math.hypot(p.x - P.x, (p.y - P.y) / 0.5);
        if (d > P.r * 1.6) { last = null; return; }
        if (last !== null) {
          let da = a - last; if (da > Math.PI) da -= TAU; if (da < -Math.PI) da += TAU;
          turned += Math.abs(da); ang += da;
          const q = Math.floor(turned / TAU);
          if (q > Math.floor((turned - Math.abs(da)) / TAU)) { cfg.sound.pop(); dots(4, Math.min(4, q)); }
        }
        last = a;
        if (turned >= NEED) {
          done = true; sp = null; cfg.sound.sparkle(); burst(P.x, P.y - P.r * 0.3);
          const r = run;
          mammy('m_stirred', "That smells delicious! Well done!").then(() => { if (r === run && game === g) next(); });
        }
      },
      up() { last = null; sp = null; held = false; },
      draw(c, dt, t) {
        kitchen(c, t);
        const P = geo(), k = Math.min(1, turned / NEED);
        pot(c, P.x, P.y, P.r, t, SAUCE[dish.id], true);
        // bits going round in the sauce
        const bits = dish.id === 'spaghetti' ? ['#fde68a', '#7f1d1d', '#fde68a', '#f87171'] : ['#f97316', '#fef3c7', '#f97316', '#fef9c3'];
        for (let j = 0; j < 10; j++) {
          const a = ang * 0.8 + j * TAU / 10, rr2 = P.r * (0.25 + (j % 3) * 0.2);
          c.fillStyle = bits[j % 4]; dot(c, P.x + Math.cos(a) * rr2, P.y - P.r * 0.18 + Math.sin(a) * rr2 * 0.26, P.r * 0.06);
        }
        // steam rises as it cooks
        c.fillStyle = 'rgba(255,255,255,.55)';
        for (let j = 0; j < 3 + k * 5; j++) { const yy = ((t * 30 + j * 37) % 80); dot(c, P.x + Math.sin(j * 2 + t) * P.r * 0.5, P.y - P.r * 0.5 - yy, 6 + yy * 0.12); }
        // the wooden spoon follows the finger
        const s = sp || { x: P.x + Math.cos(t * 2) * P.r * 0.4, y: P.y - P.r * 0.18 + Math.sin(t * 2) * P.r * 0.1 };
        c.strokeStyle = '#b45309'; c.lineWidth = Math.max(6, P.r * 0.08); c.lineCap = 'round';
        c.beginPath(); c.moveTo(s.x, s.y); c.lineTo(s.x + P.r * 0.3, s.y - P.r * 0.9); c.stroke(); c.lineCap = 'butt';
        c.fillStyle = '#b45309'; c.beginPath(); c.ellipse(s.x, s.y, P.r * 0.1, P.r * 0.06, 0, 0, TAU); c.fill();
        if (!sp && !done) emoji(c, '👆', s.x + 20, s.y + 30, P.r * 0.3);
        // how far there is to go
        c.strokeStyle = 'rgba(0,0,0,.15)'; c.lineWidth = 10; c.beginPath(); c.arc(P.x, A.y + 30, 18, 0, TAU); c.stroke();
        c.strokeStyle = '#22c55e'; c.beginPath(); c.arc(P.x, A.y + 30, 18, -Math.PI / 2, -Math.PI / 2 + TAU * k); c.stroke();
        drawMammy(c, t);
        drawFx(c, dt);
      },
    };
    stage(g, 'Stir the pot');
  }

  // pizza: rub the sauce on
  let pizzaPaint = null, toppingsOn = [];
  function pizzaGeo() { const A = area(); return { x: A.x + A.w / 2, y: A.y + A.h * 0.52, r: Math.min(A.w, A.h) * 0.4 }; }
  function drawPizza(c, P, baked) {
    c.fillStyle = baked ? '#c2782e' : '#e6b86a'; dot(c, P.x, P.y, P.r);
    c.fillStyle = baked ? '#e9b05d' : '#f5d6a0'; dot(c, P.x, P.y, P.r * 0.86);
    if (pizzaPaint) c.drawImage(pizzaPaint, P.x - P.r, P.y - P.r, P.r * 2, P.r * 2);
    for (const tp of toppingsOn) {
      const x = P.x + tp.x * P.r, y = P.y + tp.y * P.r;
      if (tp.k === 'cheese') { c.fillStyle = baked ? '#fbbf24' : '#fde68a'; c.save(); c.translate(x, y); c.rotate(tp.a); rr(c, -P.r * 0.1, -P.r * 0.03, P.r * 0.2, P.r * 0.06, P.r * 0.03); c.fill(); c.restore(); }
      else { c.fillStyle = '#facc15'; for (let j = 0; j < 4; j++) dot(c, x + Math.cos(tp.a + j * 1.6) * P.r * 0.04, y + Math.sin(tp.a + j * 1.6) * P.r * 0.04, P.r * 0.025); }
    }
  }
  function sauce(next) {
    toppingsOn = [];
    const N = 24, grid = new Uint8Array(N * N);
    let total = 0, got = 0, done = false, last = null, ctxP = null;
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) if (Math.hypot((x + 0.5) / N * 2 - 1, (y + 0.5) / N * 2 - 1) < 0.84) { grid[y * N + x] = 1; total++; }
    pizzaPaint = document.createElement('canvas'); pizzaPaint.width = pizzaPaint.height = 400;
    ctxP = pizzaPaint.getContext('2d');
    const ask = () => mammy('m_sauce', 'Now spread the tomato sauce all over the pizza. Rub it round and round!');
    function paint(p) {
      const P = pizzaGeo(), u = (p.x - P.x) / P.r, v = (p.y - P.y) / P.r;
      if (Math.hypot(u, v) > 1.1) { last = null; return; }
      const q = { x: (u + 1) * 200, y: (v + 1) * 200 };
      ctxP.save(); ctxP.beginPath(); ctxP.arc(200, 200, 172, 0, TAU); ctxP.clip();
      ctxP.strokeStyle = '#dc2626'; ctxP.lineWidth = 70; ctxP.lineCap = 'round';
      ctxP.beginPath(); ctxP.moveTo((last || q).x, (last || q).y); ctxP.lineTo(q.x + 0.1, q.y); ctxP.stroke(); ctxP.restore();
      const gx0 = Math.floor((q.x - 35) / 400 * N), gx1 = Math.floor((q.x + 35) / 400 * N), gy0 = Math.floor((q.y - 35) / 400 * N), gy1 = Math.floor((q.y + 35) / 400 * N);
      for (let y = Math.max(0, gy0); y <= Math.min(N - 1, gy1); y++) for (let x = Math.max(0, gx0); x <= Math.min(N - 1, gx1); x++) {
        const k = y * N + x; if (grid[k] === 1) { grid[k] = 2; got++; }
      }
      last = q;
      if (Math.random() < 0.3) cfg.sound.scribble();
      if (!done && got / total > 0.75) {
        done = true; cfg.sound.sparkle(); burst(P.x, P.y);
        ctxP.fillStyle = '#dc2626'; ctxP.beginPath(); ctxP.arc(200, 200, 172, 0, TAU); ctxP.fill();
        setTimeout(() => { if (game === g) next(); }, 900);
      }
    }
    const g = {
      start() { prompt('Spread the sauce'); ask(); },
      again: ask,
      down(p) { last = null; if (!done) paint(p); },
      move(p) { if (!done && g.held) paint(p); },
      draw(c, dt, t) { kitchen(c, t); drawPizza(c, pizzaGeo(), false); drawMammy(c, t); drawFx(c, dt); },
    };
    // only paint while the finger is down
    const down = g.down; g.down = p => { g.held = true; down(p); }; g.up = () => { g.held = false; last = null; };
    stage(g, 'Spread the sauce');
  }
  function toppings(next) {
    const PLAN = ['cheese', 'cheese', 'cheese', 'cheese', 'cheese', 'cheese', 'corn', 'corn', 'corn', 'corn', 'corn'];
    let done = false;
    const ask = () => { const k = PLAN[toppingsOn.length]; prompt(k === 'cheese' ? 'Tap on the cheese' : 'Tap on the sweetcorn'); mammy(k === 'cheese' ? 'm_cheese' : 'm_corn', k === 'cheese' ? 'Now tap the pizza to put on the cheese!' : 'Now the sweetcorn! Tap, tap, tap!'); };
    const g = {
      start() { ask(); dots(PLAN.length, 0); }, again: ask,
      down(p) {
        if (done) return;
        const P = pizzaGeo(), u = (p.x - P.x) / P.r, v = (p.y - P.y) / P.r;
        if (Math.hypot(u, v) > 0.85) return;
        const k = PLAN[toppingsOn.length];
        toppingsOn.push({ x: u, y: v, a: Math.random() * TAU, k }); cfg.sound.pop(); buzz(10);
        dots(PLAN.length, toppingsOn.length);
        if (toppingsOn.length === PLAN.length) { done = true; cfg.sound.sparkle(); burst(P.x, P.y); setTimeout(() => { if (game === g) next(); }, 900); }
        else if (PLAN[toppingsOn.length] !== k) ask();
      },
      draw(c, dt, t) { kitchen(c, t); drawPizza(c, pizzaGeo(), false); drawMammy(c, t); drawFx(c, dt); },
    };
    stage(g, '');
  }
  function bake(next) {
    let phase = 'wait', k = 0, A = null, ticks = 0;
    const COOK = 4;
    function geo() { A = area(); const s = Math.min(A.w * (A.land ? 0.5 : 0.8), A.h * 0.8); return { x: A.x + A.w * (A.land ? 0.62 : 0.5), y: A.y + A.h * 0.5, s }; }
    const ask = () => mammy('m_bake', 'Into the oven it goes! Tap the oven door.');
    const g = {
      start() { prompt('Bake the pizza'); ask(); }, resize: geo, again: ask,
      down(p) {
        if (phase !== 'wait') return;
        const O = geo();
        if (Math.abs(p.x - O.x) > O.s / 2 || Math.abs(p.y - O.y) > O.s / 2) return;
        phase = 'in'; k = 0; cfg.sound.door(true);
      },
      draw(c, dt, t) {
        kitchen(c, t);
        const O = geo(), s = O.s;
        c.fillStyle = '#374151'; rr(c, O.x - s / 2, O.y - s / 2, s, s, s * 0.06); c.fill();
        c.fillStyle = '#1f2937'; for (let j = 0; j < 4; j++) dot(c, O.x - s * 0.3 + j * s * 0.2, O.y - s * 0.4, s * 0.04);
        const win = { x: O.x - s * 0.38, y: O.y - s * 0.28, w: s * 0.76, h: s * 0.56 };
        const glow = phase === 'cook' || phase === 'in' ? 0.6 + Math.sin(t * 8) * 0.1 : 0.1;
        c.fillStyle = 'rgba(251,146,60,' + glow + ')'; rr(c, win.x, win.y, win.w, win.h, s * 0.04); c.fill();
        c.fillStyle = '#9ca3af'; c.fillRect(O.x - s * 0.3, O.y - s * 0.34, s * 0.6, s * 0.03);
        const P0 = { x: A.land ? A.x + A.w * 0.16 : O.x, y: A.land ? O.y + s * 0.2 : O.y + s * 0.62, r: s * 0.18 };
        const P1 = { x: O.x, y: O.y + s * 0.08, r: s * 0.24 };
        if (phase === 'in') { k = Math.min(1, k + dt * 1.6); if (k >= 1) { phase = 'cook'; k = 0; ticks = 0; mammy('m_wait', 'Now we wait for it to cook. Tick, tock!'); } }
        if (phase === 'cook') {
          k += dt / COOK;
          if (Math.floor(k * COOK * 2) > ticks) { ticks++; cfg.sound.tick(); }
          if (k >= 1) { phase = 'out'; k = 0; cfg.sound.bell(); burst(O.x, O.y); mammy('m_ding', "Ding! The pizza's ready!").then(() => { if (game === g) next(); }); }
          c.strokeStyle = '#fbbf24'; c.lineWidth = 8; c.beginPath(); c.arc(O.x + s * 0.4, O.y - s * 0.4, s * 0.08, -Math.PI / 2, -Math.PI / 2 + TAU * k); c.stroke();
        }
        const e = phase === 'wait' ? 0 : phase === 'out' ? 1 : phase === 'in' ? k : 1;
        const P = { x: P0.x + (P1.x - P0.x) * e, y: P0.y + (P1.y - P0.y) * e, r: P0.r + (P1.r - P0.r) * e };
        c.save(); if (phase === 'cook') { c.beginPath(); c.rect(win.x, win.y, win.w, win.h); c.clip(); }
        drawPizza(c, P, phase === 'out'); c.restore();
        if (phase === 'wait') emoji(c, '👆', O.x + s * 0.1, O.y + s * 0.15 + Math.sin(t * 6) * 6, s * 0.18);
        drawMammy(c, t);
        drawFx(c, dt);
      },
    };
    stage(g, 'Bake the pizza');
  }

  // a plate with dinner on it; amt is how much is left
  function plate(c, x, y, r, amt, t) {
    c.fillStyle = 'rgba(0,0,0,.12)'; c.beginPath(); c.ellipse(x, y + r * 0.08, r * 1.02, r * 0.5, 0, 0, TAU); c.fill();
    c.fillStyle = '#fff'; c.beginPath(); c.ellipse(x, y, r, r * 0.48, 0, 0, TAU); c.fill();
    c.strokeStyle = '#bfdbfe'; c.lineWidth = Math.max(2, r * 0.05); c.beginPath(); c.ellipse(x, y, r * 0.8, r * 0.38, 0, 0, TAU); c.stroke();
    if (amt <= 0) return;
    c.save(); c.translate(x, y); c.scale(Math.sqrt(amt), Math.sqrt(amt));
    if (dish.id === 'pizza') {
      for (const [a, b] of [[-0.5, 0.25], [0.15, 0.9]]) {
        c.fillStyle = '#c2782e'; c.beginPath(); c.moveTo(0, -r * 0.05); c.arc(0, -r * 0.05, r * 0.62, a, b); c.closePath(); c.fill();
        c.fillStyle = '#dc2626'; c.beginPath(); c.moveTo(0, -r * 0.05); c.arc(0, -r * 0.05, r * 0.5, a, b); c.closePath(); c.fill();
        c.fillStyle = '#fbbf24'; dot(c, Math.cos((a + b) / 2) * r * 0.3, -r * 0.05 + Math.sin((a + b) / 2) * r * 0.2, r * 0.07);
      }
    } else if (dish.id === 'spaghetti') {
      c.strokeStyle = '#fcd34d'; c.lineWidth = Math.max(2, r * 0.05);
      for (let j = 0; j < 7; j++) { c.beginPath(); c.ellipse(Math.sin(j * 2) * r * 0.15, -r * 0.08, r * (0.4 - j * 0.03), r * 0.16, j * 0.4, 0, TAU); c.stroke(); }
      c.fillStyle = '#b91c1c'; c.beginPath(); c.ellipse(0, -r * 0.16, r * 0.26, r * 0.1, 0, 0, TAU); c.fill();
      c.fillStyle = '#7f1d1d'; dot(c, -r * 0.1, -r * 0.18, r * 0.06); dot(c, r * 0.12, -r * 0.14, r * 0.06);
    } else {
      c.fillStyle = '#92400e'; c.beginPath(); c.ellipse(0, -r * 0.04, r * 0.6, r * 0.26, 0, 0, TAU); c.fill();
      c.fillStyle = '#f97316'; dot(c, -r * 0.25, -r * 0.06, r * 0.07); dot(c, r * 0.2, -r * 0.1, r * 0.07);
      c.fillStyle = '#fef3c7'; dot(c, 0, -r * 0.02, r * 0.09); dot(c, r * 0.35, 0, r * 0.08); dot(c, -r * 0.4, -r * 0.1, r * 0.07);
    }
    c.restore();
  }
  // serve: drag dinner from the pot (or the pizza) onto each plate
  function serve(next) {
    const plates = [{ who: cfg.name, amt: 0 }, { who: 'Mammy', amt: 0 }];
    let drag = null, A = null, done = false;
    function geo() {
      A = area();
      const src = { x: A.x + A.w / 2, y: A.y + A.h * 0.3, r: Math.min(A.w, A.h) * 0.22 };
      const pr = Math.min(A.w * 0.2, A.h * 0.22);
      plates.forEach((p, k) => { p.x = A.x + A.w * (k ? 0.72 : 0.28); p.y = A.y + A.h * 0.8; p.r = pr; });
      return src;
    }
    const ask = () => mammy('m_serve', 'Dinner is ready! Put some on each plate.');
    const g = {
      start() { geo(); prompt('Serve the dinner'); ask(); dots(2, 0); }, resize: geo, again: ask,
      down(p) {
        if (done) return;
        const S = geo();
        if (Math.hypot(p.x - S.x, p.y - S.y) < S.r * 1.1) { drag = { x: p.x, y: p.y }; cfg.sound.pop(); }
      },
      move(p) { if (drag) { drag.x = p.x; drag.y = p.y; } },
      up() {
        if (!drag) return;
        const d = drag; drag = null;
        const pl = plates.find(q => !q.amt && Math.hypot(d.x - q.x, d.y - q.y) < q.r * 1.1);
        if (!pl) return;
        pl.amt = 1; cfg.sound.sparkle(); buzz(20); burst(pl.x, pl.y);
        const n = plates.filter(q => q.amt).length; dots(2, n);
        if (n === plates.length && !done) {
          done = true;
          goldStar('dinner', 'k_star_' + cfg.id, "Dinner's ready! You're a great cook, " + cfg.name + '! You get a gold star!').then(ok => { if (ok) eat(); });
        }
      },
      draw(c, dt, t) {
        kitchen(c, t);
        const S = geo();
        if (dish.id === 'pizza') drawPizza(c, S, true); else pot(c, S.x, S.y + S.r * 0.3, S.r, t, SAUCE[dish.id], false);
        c.font = '700 ' + Math.round(Math.max(13, A.h * 0.045)) + 'px Fredoka, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
        for (const p of plates) { plate(c, p.x, p.y, p.r, p.amt, t); c.fillStyle = '#1f2937'; c.fillText(p.who, p.x, p.y + p.r * 0.75); }
        if (drag) { c.globalAlpha = 0.9; plate(c, drag.x, drag.y, S.r * 0.6, 1, t); c.globalAlpha = 1; }
        else if (!done && !plates.every(p => p.amt)) { const q = plates.find(p => !p.amt); const k = (t % 1.6) / 1.6; emoji(c, '👆', S.x + (q.x - S.x) * k, S.y + (q.y - S.y) * k + 20, A.h * 0.1); }
        drawMammy(c, t);
        drawFx(c, dt);
      },
    };
    stage(g, 'Serve the dinner');
  }

  // ---------- 4. eat it together, then goodnight ----------
  function eat() {
    const amt = [1, 1];
    let bites = 0, nextBite = 1.2, fork = null, bub = [], ended = false;
    const LINES = [['Mmm!', 'Yummy!'], ['Is it nice?', 'Well done!'], ['Yum yum!', 'Thank you, Mammy!'], ['Delicious!', 'All gone!']];
    const g = {
      start() { prompt('Dinner time!'); setTimeout(() => { if (game === g) mammy('m_yum', 'Mmm, this is delicious! Well done!'); }, 600); },
      draw(c, dt, t) {
        // the kitchen in the evening, the two of them at the table
        kitchen(c, t);
        c.fillStyle = 'rgba(30,20,60,.18)'; c.fillRect(0, 0, W, H);
        const ty = H * 0.68, msc = Math.min(H * 0.55 / 70, W * 0.16 / 30), dsc = msc * 70 * 0.85 / 345;
        const mx = W * 0.3, kx = W * 0.7;
        c.fillStyle = '#7c2d12'; rr(c, mx - 26 * msc, ty - 40 * msc, 52 * msc, 46 * msc, 6 * msc); c.fill(); // chair backs
        rr(c, kx - 26 * msc, ty - 40 * msc, 52 * msc, 46 * msc, 6 * msc); c.fill();
        Scene.kid(c, { look: MAMMY, face: 1, wave: false, phase: 1, alpha: 1 }, mx, ty + 22 * msc, msc, t);
        c.save(); c.translate(kx, ty + 160 * dsc); c.scale(-dsc, dsc); doll(c, look(), cfg.save.outfit || outfit, t); c.restore();
        c.fillStyle = '#f5f5f4'; rr(c, W * 0.05, ty, W * 0.9, H * 0.07, 10); c.fill();
        c.fillStyle = '#b45309'; c.fillRect(W * 0.05, ty + H * 0.07, W * 0.9, H - ty);
        c.fillStyle = '#ef4444'; for (let x = W * 0.05; x < W * 0.95; x += 40) c.fillRect(x, ty + H * 0.07, 20, H * 0.05);
        const pr = Math.min(W * 0.13, H * 0.16);
        const pX = [mx + W * 0.06, kx - W * 0.06];
        pX.forEach((x, k) => plate(c, x, ty + H * 0.03, pr, amt[k], t));
        // bites, turn about
        if (!ended && (nextBite -= dt) <= 0) {
          const k = bites % 2;
          fork = { k, t: 0, from: { x: pX[k], y: ty }, to: k ? { x: kx - 10 * dsc, y: ty - 140 * dsc } : { x: mx + 6 * msc, y: ty - 32 * msc } };
          nextBite = 1.1;
        }
        if (fork) {
          fork.t += dt * 2;
          const e = fork.t < 1 ? fork.t : 2 - fork.t;
          emoji(c, '🍴', fork.from.x + (fork.to.x - fork.from.x) * e, fork.from.y + (fork.to.y - fork.from.y) * e, pr * 0.5);
          if (fork.t >= 1 && !fork.bit) {
            fork.bit = true; amt[fork.k] = Math.max(0, amt[fork.k] - 0.25); cfg.sound.pop();
            const line = LINES[Math.floor(bites / 2) % LINES.length][fork.k ? 1 : 0];
            bub.push({ text: line, x: fork.k ? kx : mx, y: fork.k ? ty - 235 * dsc : ty - 52 * msc, t: 1.4 });
            bites++;
          }
          if (fork.t >= 2) fork = null;
        }
        for (const b of bub) { b.t -= dt; c.globalAlpha = Math.min(1, b.t * 3); Scene.bubble(c, b.text, b.x, b.y, Math.max(1, msc / 2)); }
        c.globalAlpha = 1; bub = bub.filter(b => b.t > 0);
        if (!ended && amt[0] <= 0 && amt[1] <= 0 && !fork) {
          ended = true;
          const r = run;
          setTimeout(async () => {
            if (r !== run) return;
            await say(['e_allgone'], 'All gone! What a yummy dinner!');
            if (r !== run) return;
            night();
          }, 500);
        }
        drawFx(c, dt);
      },
    };
    stage(g, 'Dinner time!');
  }
  function night() {
    $('hEndMsg').textContent = 'Goodnight, ' + cfg.name + '! 🌙';
    $('hEnd').hidden = false;
    say(['g_night_' + cfg.id], 'Goodnight, ' + cfg.name + '! See you tomorrow!');
  }

  return { open };
})();
