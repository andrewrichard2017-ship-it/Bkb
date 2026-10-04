'use strict';
// Home time: drive the steam train home with the class on board. Shovel coal to keep the steam
// up, toot the whistle at the cows, the cars at the level crossing and the boat under the bridge,
// put the lights on in the tunnel, then stop at the home station and open the doors.
// The track runs left to right in world units; T.x is the front of the engine.

const Train = (() => {
  const $ = id => document.getElementById(id);
  const TAU = Math.PI * 2;
  const pick = a => a[Math.floor(Math.random() * a.length)];
  const approach = (v, to, step) => v < to ? Math.min(to, v + step) : Math.max(to, v - step);
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const buzz = ms => { try { if (navigator.vibrate) navigator.vibrate(ms); } catch (e) { /* ignore */ } };
  const FONT = 'Fredoka, "Trebuchet MS", sans-serif';

  // the train
  const LOCO = 236, CAR = 180, GAP = 14, CARS = 2, LEN = LOCO + CARS * (CAR + GAP);
  const MIN_V = 70, MAX_V = 250, REV_V = 70, ACCEL = 75, BRAKE = 260;
  // the line home
  const START = 700, COWS = [1520, 1820, 2180], FIELD = [1340, 2420], CROSS = 3150, TUN = [4250, 4980],
    BRIDGE = [5720, 6320], TOWN = [6750, 7850], HOME = 8800, PLAT = [8000, 9010], BUFFER = 9060;
  const ZONE = BUFFER - LEN + 30; // stop with the front past here and every carriage is at the platform
  const ADULTS = [{ skin: '#f1c27d', hair: '#4a2f1b', style: 0, shirt: '#0ea5e9', pants: '#1e3a8a', bag: '#0ea5e9' },
    { skin: '#c68642', hair: '#111111', style: 5, shirt: '#f97316', pants: '#374151', bag: '#f97316' },
    { skin: '#fbd9bd', hair: '#d9a441', style: 1, shirt: '#a855f7', pants: '#0f766e', bag: '#a855f7' }];
  const CHEER = ['Choo choo!', 'Yay!', 'Woo!', 'Toot toot!'];

  const root = $('train'), cv = $('trCanvas'), cx = cv.getContext('2d', { alpha: false }), view = $('trView');
  let cfg = null, onDone = null, run = 0, T = null;

  function fresh() {
    return {
      x: START, v: 0, mode: 'stop', steam: 0.75, fire: 0, lights: false, rainbow: false, doors: false, door: 0,
      whistle: false, wheelA: 0, chuffD: 0, clackD: 0, t: 0, phase: 'drive',
      riders: cfg.kids.slice(0, CARS * 4), walkers: [], puffs: [], sparks: [], bubbles: [], later: [],
      barrier: 0, dingT: 0, said: {}, toast: null, flash: null, starAt: 0, hue: 0, wasMoving: false,
      boatX: BRIDGE[0] + 260,
    };
  }

  function open(opts, done) {
    cfg = opts; onDone = done;
    T = fresh();
    root.hidden = false;
    const r = ++run;
    resize();
    let last = performance.now();
    const frame = now => {
      if (r !== run) return;
      const dt = Math.min(0.05, (now - last) / 1000); last = now;
      update(dt); syncButtons(); draw();
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
    toast('All aboard! 🚂', 3);
    setTimeout(() => { if (r === run) cfg.say(['t_aboard'], 'All aboard! Press the green Go button to drive the train home!'); }, 600);
  }
  function close(skipped) {
    run++; whistleUp(); root.hidden = true; cfg.hush();
    if (onDone) onDone(skipped);
  }
  skipButton($('trSkip'), () => { if (active()) { cfg.sound.click(); close(true); } });

  // ---------- messages ----------
  function toast(text, dur) { T.toast = { text, t: 0, dur: dur || 2.4 }; }
  function nope(text, btn) { cfg.sound.nope(); toast(text); if (btn) T.flash = { btn, t: 2 }; buzz(30); }
  function once(key, fn) { if (!T.said[key]) { T.said[key] = true; fn(); } }
  const later = (s, fn) => T.later.push({ t: s, fn });
  function bubble(text, x, y) { T.bubbles.push({ text, x, y, t: 1.8 }); }

  // ---------- controls ----------
  function drive(mode) {
    if (T.phase !== 'drive') return;
    if (T.doors) return nope('Close the doors first!', 'doors');
    if (T.mode !== mode) { T.mode = mode; cfg.sound.gear(); }
  }
  const ACT = {
    go() { drive('drive'); },
    back() { drive('reverse'); },
    stop() { T.mode = 'stop'; cfg.sound.click(); },
    coal() {
      if (T.fire > 0.6) return;
      T.fire = 1; T.steam = Math.min(1, T.steam + 0.35); cfg.sound.shovel();
      for (let i = 0; i < 10; i++) T.sparks.push({ x: T.x - LOCO + 191, y: 162, vx: (Math.random() - 0.5) * 60, vy: 80 + Math.random() * 90, life: 1 });
      if (T.steam > 0.5) T.lowWarned = false;
    },
    lights() { T.lights = !T.lights; cfg.sound.click(); },
    bell() {
      cfg.sound.bell(); bubble('Ding ding!', T.x - LOCO + 40, 186);
      riderBubbles(2, ['Yay!', 'Woo!', 'Hooray!']);
    },
    rainbow() { T.rainbow = !T.rainbow; cfg.sound.sparkle(); if (T.rainbow) toast('🌈 Rainbow smoke!', 2); },
    doors() {
      if (T.doors) {
        if (T.phase !== 'drive') return cfg.sound.click();
        T.doors = false; cfg.sound.door(false); return;
      }
      if (T.v !== 0) return nope('Stop the train first!', 'stop');
      if (T.x < ZONE) return nope(T.phase === 'drive' && T.x > PLAT[0] ? 'Drive up to the end of the platform!' : 'We’re not home yet! Keep driving!');
      T.doors = true; T.mode = 'stop'; cfg.sound.door(true);
      if (T.phase === 'drive') arrive();
    },
  };
  function riderBubbles(n, words) {
    const seats = T.riders.map((_, i) => i).sort(() => Math.random() - 0.5).slice(0, n);
    seats.forEach((s, k) => later(k * 0.35, () => { const [x, y] = seatPos(s); bubble(pick(words), x, y + 30); }));
  }
  function whistleDown() {
    if (T.whistle) return;
    T.whistle = true; cfg.sound.whistleOn(); buzz(15);
    // whoever can see the train answers it
    const near = x => Math.abs(x - (T.x - LOCO / 2)) < 900;
    COWS.forEach((x, i) => { if (near(x)) later(0.5 + i * 0.4, () => { bubble('Moo!', x + 30, 150); if (i === 0 || !near(COWS[0])) cfg.sound.moo(); }); });
    if (near(CROSS)) later(0.6, () => { bubble('Beep beep!', CROSS - 8, 6); cfg.sound.carBeep(); });
    if (near(T.boatX)) later(0.7, () => { bubble('Toot toot!', T.boatX, 30); cfg.sound.boatHorn(); });
    if (near(PLAT[0] + 300)) later(0.4, () => bubble('Hello!', PLAT[0] + 320, 135));
    riderBubbles(2, CHEER);
  }
  function whistleUp() { if (!T || !T.whistle) return; T.whistle = false; cfg.sound.whistleOff(); }

  const BTN = { go: $('tGo'), back: $('tBack'), stop: $('tStop'), coal: $('tCoal'), lights: $('tLights'), bell: $('tBell'),
    rainbow: $('tRainbow'), doors: $('tDoors') };
  const active = () => T && !root.hidden;
  function press(el) { el.classList.add('press'); setTimeout(() => el.classList.remove('press'), 140); }
  for (const [name, el] of Object.entries(BTN)) {
    el.addEventListener('pointerdown', e => { e.preventDefault(); if (!active()) return; buzz(12); ACT[name](); });
  }
  const wBtn = $('tWhistle');
  wBtn.addEventListener('pointerdown', e => { e.preventDefault(); if (!active()) return; try { wBtn.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ } whistleDown(); });
  for (const ev of ['pointerup', 'pointercancel', 'lostpointercapture']) wBtn.addEventListener(ev, whistleUp);
  const KEYS = { ArrowRight: 'go', ArrowUp: 'go', ArrowLeft: 'back', ArrowDown: 'stop', ' ': 'stop', s: 'stop', c: 'coal', l: 'lights',
    b: 'bell', r: 'rainbow', o: 'doors', d: 'doors' };
  addEventListener('keydown', e => {
    if (!active() || e.repeat) return;
    const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    if (key === 'h' || key === 't' || key === 'w') { whistleDown(); wBtn.classList.add('press'); return; }
    const a = KEYS[key];
    if (a) { e.preventDefault(); press(BTN[a]); ACT[a](); }
  });
  addEventListener('keyup', e => {
    const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    if (key === 'h' || key === 't' || key === 'w') { whistleUp(); wBtn.classList.remove('press'); }
  });
  addEventListener('blur', whistleUp);

  // ---------- home: the kids get off and run to the grown-ups ----------
  async function arrive() {
    T.phase = 'unload'; const r = run;
    toast('Home sweet home! 🏠', 3);
    await sleep(700);
    const doorX = i => T.x - LOCO - (i + 1) * (CAR + GAP) + 90;
    while (T.riders.length) {
      if (r !== run) return;
      const look = T.riders.pop(), car = Math.floor(T.riders.length / 4);
      T.walkers.push({ look, x: doorX(car), ry: 46, to: PLAT[0] + 150 + Math.random() * 300, state: 'out', ct: 0, alpha: 0, face: -1, phase: Math.random() * 6,
        walking: false, wave: false, bubble: pick(['Hi Mum!', 'Hi Dad!', 'I’m home!', 'Hello!']) });
      cfg.sound.bye();
      await sleep(550);
    }
    while (T.walkers.some(k => k.state !== 'home')) { if (r !== run) return; await sleep(200); }
    await sleep(700);
    if (r !== run) return;
    T.phase = 'star'; T.starAt = performance.now();
    cfg.sound.fanfare(); buzz([40, 60, 40]);
    await cfg.say(['p_star_train_' + cfg.id], 'You drove the train all the way home, ' + cfg.name + '! You get a gold star!');
    await sleep(500);
    if (r !== run) return;
    T.phase = 'end';
    close(); // on into the house
  }

  // ---------- update ----------
  function update(dt) {
    T.t += dt;
    if (T.flash && (T.flash.t -= dt) <= 0) T.flash = null;
    if (T.toast && (T.toast.t += dt) > T.toast.dur) T.toast = null;
    for (const l of T.later) l.t -= dt;
    const due = T.later.filter(l => l.t <= 0);
    T.later = T.later.filter(l => l.t > 0);
    for (const l of due) l.fn();
    T.door = approach(T.door, T.doors ? 1 : 0, dt * 2.4);

    // steam: it runs down as we go; coal brings it back. Speed follows the steam.
    T.steam = Math.max(0, T.steam - dt * (0.008 + 0.03 * Math.abs(T.v) / MAX_V));
    T.fire = Math.max(0, T.fire - dt * 0.8);
    const top = MIN_V + (MAX_V - MIN_V) * Math.min(1, T.steam * 1.4);
    let target = 0;
    if (T.phase === 'drive' && !T.doors) {
      if (T.mode === 'drive') {
        target = T.x > HOME - 1100 ? Math.min(top, 110) : top;
        target = Math.min(target, Math.sqrt(2 * BRAKE * 0.8 * Math.max(0, BUFFER - T.x))); // the buffers stop us gently
      } else if (T.mode === 'reverse') target = T.x > START - 200 ? -REV_V : 0;
    }
    if (target > T.v) T.v = Math.min(target, T.v + (T.v < 0 ? BRAKE : ACCEL) * dt);
    else if (target < T.v) T.v = Math.max(target, T.v - (T.v > 0 ? (T.mode === 'drive' ? BRAKE * 0.8 : BRAKE) : ACCEL) * dt);
    if (Math.abs(T.v) > 30) T.wasMoving = true;
    if (T.v === 0 && T.wasMoving) {
      T.wasMoving = false; cfg.sound.airBrake();
      if (T.x >= BUFFER - 1 && T.mode === 'drive') { T.mode = 'stop'; toast('End of the line! 🏠', 2.4); }
    }
    T.x = Math.min(BUFFER, T.x + T.v * dt);
    T.wheelA += T.v * dt / 26;
    // chuff with every quarter turn of the wheels, clickety-clack over the rail joints
    const d = Math.abs(T.v * dt);
    if (Math.abs(T.v) > 2) {
      if ((T.chuffD -= d) <= 0) {
        T.chuffD = 41; cfg.sound.chuff(Math.min(1, Math.abs(T.v) / MAX_V));
        T.puffs.push({ x: T.x - LOCO + 191, y: 168, r: 8, vx: -10, vy: 50 + Math.abs(T.v) * 0.15, life: 1, hue: (T.hue += 40) % 360 });
      }
      if ((T.clackD -= d) <= 0) { T.clackD = 120; if (!(T.x > BRIDGE[0] && T.x < BRIDGE[1])) cfg.sound.clack(); }
    } else if (Math.random() < dt * 2) T.puffs.push({ x: T.x - LOCO + 191, y: 168, r: 6, vx: -6, vy: 30, life: 0.8, hue: (T.hue += 40) % 360 });
    if (T.whistle && Math.random() < dt * 30) T.puffs.push({ x: T.x - LOCO + 84, y: 164, r: 5, vx: -20 + Math.random() * 10, vy: 120, life: 0.6, white: true });
    for (const p of T.puffs) { p.x += p.vx * dt; p.y += p.vy * dt; p.vy *= 1 - dt * 0.6; p.r += 14 * dt; p.life -= dt * 0.45; }
    T.puffs = T.puffs.filter(p => p.life > 0);
    for (const p of T.sparks) { p.x += p.vx * dt; p.y += p.vy * dt; p.vy -= 120 * dt; p.life -= dt * 1.4; }
    T.sparks = T.sparks.filter(p => p.life > 0);
    for (const b of T.bubbles) b.t -= dt;
    T.bubbles = T.bubbles.filter(b => b.t > 0);

    // the level crossing: barriers down while the train is near
    const closeBy = T.x > CROSS - 900 && T.x - LEN < CROSS + 120;
    T.barrier = approach(T.barrier, closeBy ? 1 : 0, dt * 0.9);
    if (T.barrier > 0.3 && Math.abs(CROSS - (T.x - LOCO)) < 1200 && (T.dingT -= dt) <= 0) { T.dingT = 0.55; cfg.sound.crossDing(); }
    T.boatX += dt * 22 * Math.sin(T.t * 0.05 + 1);

    // the things to look out for on the way
    if (T.phase === 'drive') {
      if (T.x > START + 30 && T.v > 0) once('off', () => toast('Choo choo! Off we go! 🚂', 2.4));
      if (T.steam < 0.22 && !T.lowWarned) {
        T.lowWarned = true; toast('Low on steam! Shovel some coal! 🔥', 3.2);
        once('coal', () => cfg.say(['t_coal'], "We're running out of steam! Shovel some coal on the fire!"));
      }
      if (T.x > FIELD[0] - 500) once('cows', () => toast('Look, cows! Toot the whistle! 🐮', 3));
      if (T.x > CROSS - 900) once('cross', () => toast('Level crossing! The cars have to wait. 🚗', 3));
      if (T.x > TUN[0] - 800) once('tunnel', () => {
        toast(T.lights ? 'Here comes a tunnel! 🚇' : 'Tunnel ahead! Turn on the lights! 💡', 3.2);
        if (!T.lights) cfg.say(['t_tunnel'], 'Here comes a tunnel! Turn on the lights!');
      });
      if (T.x > BRIDGE[0] - 500) once('bridge', () => toast('Over the river! Wave at the boat! ⛵', 3));
      if (T.x > HOME - 1300) once('home', () => {
        toast('There’s your station! Get ready to stop! 🏠', 3.2);
        cfg.say(['t_station'], "There's your home station! Stop the train at the platform!");
      });
      if (T.x >= ZONE && T.v === 0) once('doors', () => cfg.say(['t_doors'], 'Open the doors!'));
    }
    for (const k of T.walkers) {
      if (k.state === 'out') {
        k.ct += dt; k.alpha = Math.min(1, k.ct / 0.4); k.ry = 46 - Math.min(1, k.ct / 0.4) * 22;
        if (k.ct > 0.4) { k.state = 'walk'; k.walking = true; k.ct = 0; }
      } else if (k.state === 'walk') {
        k.phase += dt * 13; k.face = k.to > k.x ? 1 : -1;
        k.x = approach(k.x, k.to, 110 * dt);
        if (k.x === k.to) { k.state = 'hi'; k.walking = false; k.ct = 0; k.wave = true; bubble(k.bubble, k.x, 110); cfg.sound.board(T.walkers.indexOf(k)); }
      } else if (k.state === 'hi') {
        k.ct += dt; k.hop = Math.abs(Math.sin(k.ct * 7)) * 8;
        if (k.ct > 1.6) { k.state = 'home'; k.hop = 0; }
      }
    }

  }

  // ---------- hints: the button to press next pulses ----------
  function hint() {
    if (T.flash) return T.flash.btn;
    if (T.phase !== 'drive') return '';
    if (T.x >= ZONE) return T.v === 0 ? 'doors' : 'stop';
    if (T.doors) return 'doors';
    if (T.steam < 0.22) return 'coal';
    if (!T.lights && T.x > TUN[0] - 800 && T.x - LEN < TUN[1]) return 'lights';
    if (T.x > PLAT[0] && T.mode === 'stop') return 'go';
    return T.mode === 'drive' ? '' : 'go';
  }
  let shown = '';
  const lit = {};
  const gauge = $('steamArc'), gaugeLen = 2 * Math.PI * 44 * 0.75;
  let lastSteam = -1;
  function syncButtons() {
    const h = hint();
    if (h !== shown) { if (shown) BTN[shown].classList.remove('hint'); if (h) BTN[h].classList.add('hint'); shown = h; }
    const set = (n, on) => { if (lit[n] !== on) { lit[n] = on; BTN[n].classList.toggle('on', on); } };
    set('go', T.mode === 'drive'); set('back', T.mode === 'reverse'); set('stop', T.mode === 'stop');
    set('lights', T.lights); set('rainbow', T.rainbow); set('doors', T.doors); set('coal', T.fire > 0.3);
    const s = Math.round(T.steam * 100) / 100;
    if (s !== lastSteam) {
      lastSteam = s;
      gauge.style.strokeDasharray = (gaugeLen * s) + ' 999';
      gauge.style.stroke = s < 0.22 ? '#ef4444' : s < 0.5 ? '#f59e0b' : '#22c55e';
    }
  }

  // ---------- drawing ----------
  let W = 1, H = 1, DPR = 1, K = 1, VW = 760, VH = 420;
  function resize() {
    const r = view.getBoundingClientRect();
    W = Math.max(1, r.width); H = Math.max(1, r.height);
    DPR = Math.min(2, window.devicePixelRatio || 1);
    cv.width = Math.round(W * DPR); cv.height = Math.round(H * DPR);
    K = Math.min(H / 420, W / (H > W ? 620 : 700));
    VW = W / K; VH = H / K;
  }
  new ResizeObserver(() => { if (!root.hidden) resize(); }).observe(view);

  const rr = (...a) => Scene.rr(...a), mix = (...a) => Scene.mix(...a);
  function dot(c, x, y, r) { c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill(); }
  let cam = 0, R = 0; // camera left edge and the rail line, in view units
  const sx = x => x - cam;
  const seen = (a, b) => b - cam > -60 && a - cam < VW + 60;

  function sky(c, p) {
    const g = c.createLinearGradient(0, 0, 0, R - 150);
    g.addColorStop(0, mix('#4fb3ff', '#e879a6', p)); g.addColorStop(1, mix('#d4f0ff', '#fed7aa', p));
    c.fillStyle = g; c.fillRect(0, 0, VW, VH);
    const sy = 80 + p * Math.max(60, R - 330);
    c.fillStyle = mix('#ffe066', '#fb923c', p); dot(c, VW - 110, sy, 40 + p * 8);
    c.fillStyle = 'rgba(255,255,255,.25)'; dot(c, VW - 110, sy, 56 + p * 10);
    // clouds
    const cell = 380, off = cam * 0.1 + T.t * 6;
    c.fillStyle = mix('#ffffff', '#fde4ef', p);
    for (let i = Math.floor(off / cell) - 1; i <= Math.floor((off + VW) / cell) + 1; i++) {
      const r = Math.abs(Math.sin(i * 12.9898) * 43758.5) % 1, x = i * cell + r * 160 - off, y = 40 + r * Math.max(40, R - 330), s = 0.7 + r * 0.6;
      dot(c, x, y, 22 * s); dot(c, x + 26 * s, y - 12 * s, 28 * s); dot(c, x + 54 * s, y, 22 * s); c.fillRect(x, y, 54 * s, 22 * s);
    }
  }
  function hills(c, par, col, base, amp, f1, f2, ph) {
    const off = cam * par;
    c.fillStyle = col; c.beginPath(); c.moveTo(0, VH);
    for (let x = 0; x <= VW + 20; x += 20) { const wx = x + off; c.lineTo(x, base - amp * (0.65 + 0.35 * Math.sin(wx * f1 + ph)) - amp * 0.3 * Math.sin(wx * f2 + ph * 2)); }
    c.lineTo(VW + 20, VH); c.closePath(); c.fill();
  }

  function cow(c, x, y, i) {
    const graze = (Math.sin(T.t * 1.3 + i * 2) + 1) / 2 * 8, f = i % 2 ? -1 : 1;
    c.save(); c.translate(sx(x), y); c.scale(0.8 * f, 0.8);
    c.fillStyle = '#1f2937';
    for (const lx of [-24, -12, 14, 26]) c.fillRect(lx - 3, -24, 6, 24);
    c.strokeStyle = '#1f2937'; c.lineWidth = 3; c.beginPath(); c.moveTo(-34, -40); c.quadraticCurveTo(-46, -30, -42, -14); c.stroke();
    c.fillStyle = '#fff'; c.beginPath(); c.ellipse(0, -38, 36, 19, 0, 0, TAU); c.fill();
    c.fillStyle = '#1f2937'; c.beginPath(); c.ellipse(-12, -44, 10, 8, 0.4, 0, TAU); c.ellipse(14, -32, 9, 7, -0.3, 0, TAU); c.fill();
    c.save(); c.translate(36, -44 + graze);
    c.fillStyle = '#fff'; c.beginPath(); c.ellipse(4, 0, 13, 11, 0.3, 0, TAU); c.fill();
    c.fillStyle = '#f9a8d4'; c.beginPath(); c.ellipse(12, 6, 8, 6, 0.3, 0, TAU); c.fill();
    c.fillStyle = '#1f2937'; dot(c, 5, -3, 2); c.fillStyle = '#e5e7eb'; c.beginPath(); c.ellipse(-6, -8, 6, 3, -0.6, 0, TAU); c.fill();
    c.restore(); c.restore();
  }
  function car(c, x, y, col) { // front on, waiting at the crossing
    c.save(); c.translate(sx(x), y);
    c.fillStyle = '#111827'; c.fillRect(-30, -10, 12, 10); c.fillRect(18, -10, 12, 10);
    c.fillStyle = col; rr(c, -24, -56, 48, 24, 8); c.fill(); rr(c, -36, -38, 72, 30, 8); c.fill();
    c.fillStyle = '#bfe3f5'; rr(c, -19, -52, 38, 16, 4); c.fill();
    c.fillStyle = '#fef08a'; dot(c, -25, -24, 6); dot(c, 25, -24, 6);
    c.fillStyle = '#374151'; rr(c, -12, -28, 24, 8, 3); c.fill();
    c.restore();
  }
  function boat(c, x, y) {
    c.save(); c.translate(sx(x), y + Math.sin(T.t * 2) * 2); c.rotate(Math.sin(T.t * 1.6) * 0.04);
    c.fillStyle = '#fff'; c.beginPath(); c.moveTo(2, -10); c.lineTo(2, -62); c.lineTo(34, -12); c.closePath(); c.fill();
    c.fillStyle = '#f87171'; c.beginPath(); c.moveTo(-2, -12); c.lineTo(-2, -50); c.lineTo(-24, -12); c.closePath(); c.fill();
    c.fillStyle = '#7c2d12'; c.fillRect(-1, -64, 3, 56);
    c.fillStyle = '#2563eb'; c.beginPath(); c.moveTo(-40, -10); c.lineTo(40, -10); c.lineTo(30, 6); c.lineTo(-30, 6); c.closePath(); c.fill();
    c.restore();
  }
  function stationSign(c, x, text, col) {
    const X = sx(x), top = R - 230;
    c.fillStyle = '#4b5563'; c.fillRect(X - 52, top, 6, 200); c.fillRect(X + 46, top, 6, 200);
    c.fillStyle = col; rr(c, X - 66, top - 6, 132, 38, 8); c.fill();
    c.strokeStyle = '#fff'; c.lineWidth = 3; rr(c, X - 61, top - 1, 122, 28, 6); c.stroke();
    c.fillStyle = '#fff'; c.font = '700 20px ' + FONT; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(text, X, top + 13);
  }

  // the far side of the line, behind the train
  function farSide(c) {
    const fy = R - 36; // where the far-side things stand
    // the school we left from
    if (seen(150, 700)) {
      const X = sx(220);
      c.fillStyle = '#f87171'; c.fillRect(X, fy - 150, 380, 150);
      c.fillStyle = '#9a3412'; c.beginPath(); c.moveTo(X - 14, fy - 148); c.lineTo(X + 190, fy - 220); c.lineTo(X + 394, fy - 148); c.fill();
      c.fillStyle = '#fff'; rr(c, X + 120, fy - 138, 140, 30, 6); c.fill();
      c.fillStyle = '#1d4ed8'; c.font = '700 20px ' + FONT; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('SCHOOL', X + 190, fy - 122);
      c.fillStyle = '#bfe3f5'; for (let k = 0; k < 5; k++) c.fillRect(X + 22 + k * 72, fy - 92, 46, 36);
    }
    if (seen(300, 560)) stationSign(c, 440, 'School', '#1d4ed8');
    // the field with the cows
    if (seen(FIELD[0], FIELD[1])) {
      c.strokeStyle = '#92400e'; c.lineWidth = 4;
      c.beginPath();
      for (let x = FIELD[0]; x <= FIELD[1]; x += 80) { c.moveTo(sx(x), fy - 4); c.lineTo(sx(x), fy - 40); }
      c.moveTo(sx(FIELD[0]), fy - 32); c.lineTo(sx(FIELD[1]), fy - 32); c.moveTo(sx(FIELD[0]), fy - 16); c.lineTo(sx(FIELD[1]), fy - 16);
      c.stroke();
      COWS.forEach((x, i) => cow(c, x, fy - 50 - (i % 2) * 14, i));
      Scene.trees(c, sx(FIELD[1] + 40), fy - 10, 3);
    }
    // the level crossing: the road runs off up the hill
    if (seen(CROSS - 200, CROSS + 200)) {
      const X = sx(CROSS), hz = R - 150;
      c.fillStyle = '#6b7280'; c.beginPath(); c.moveTo(X - 60, R - 8); c.lineTo(X + 60, R - 8); c.lineTo(X + 18, hz); c.lineTo(X - 18, hz); c.closePath(); c.fill();
      c.strokeStyle = '#f8fafc'; c.lineWidth = 3; c.setLineDash([10, 10]); c.beginPath(); c.moveTo(X, R - 10); c.lineTo(X, hz); c.stroke(); c.setLineDash([]);
    }
    // the hill the tunnel goes through
    if (seen(TUN[0] - 320, TUN[1] + 320)) {
      const a = sx(TUN[0] - 300), b = sx(TUN[1] + 300), m = (a + b) / 2, top = Math.max(20, R - 360);
      c.fillStyle = '#4d7c0f'; c.beginPath(); c.moveTo(a, R); c.bezierCurveTo(a + 160, top, b - 160, top, b, R); c.closePath(); c.fill();
      c.fillStyle = '#65a30d'; c.beginPath(); c.moveTo(a + 60, R); c.bezierCurveTo(a + 200, top + 40, b - 200, top + 40, b - 60, R); c.closePath(); c.fill();
      Scene.trees(c, m - 120, top + 70, 9);
    }
    // the river runs away from the bridge, with the bridge's red sides behind the train
    if (seen(BRIDGE[0] - 100, BRIDGE[1] + 100)) {
      const a = sx(BRIDGE[0]), b = sx(BRIDGE[1]), hz = R - 150;
      c.fillStyle = '#38bdf8'; c.beginPath(); c.moveTo(a + 40, R); c.lineTo(b - 40, R); c.lineTo((a + b) / 2 + 60, hz); c.lineTo((a + b) / 2 + 10, hz); c.closePath(); c.fill();
      c.strokeStyle = '#b91c1c'; c.lineWidth = 6; c.beginPath();
      c.moveTo(a, R - 10); c.lineTo(b, R - 10); c.moveTo(a + 20, R - 72); c.lineTo(b - 20, R - 72);
      for (let x = a + 20; x < b - 20; x += 60) { c.moveTo(x, R - 72); c.lineTo(x + 30, R - 10); c.lineTo(x + 60, R - 72); }
      c.moveTo(a, R - 10); c.lineTo(a + 20, R - 72); c.moveTo(b, R - 10); c.lineTo(b - 20, R - 72);
      c.stroke();
    }
    // the town, and home
    for (let x = TOWN[0], i = 0; x < TOWN[1]; x += 280, i++) {
      if (!seen(x - 60, x + 280)) continue;
      if (i % 3 === 2) Scene.trees(c, sx(x), fy - 10, i); else Scene.house(c, sx(x), fy - 10, i + 4);
    }
    if (seen(PLAT[0] - 200, PLAT[1] + 300)) {
      Scene.house(c, sx(PLAT[0] + 520), fy - 10, 2);
      Scene.trees(c, sx(PLAT[0] + 120), fy - 10, 7);
      stationSign(c, HOME - 120, 'Home', '#16a34a');
    }
  }

  // the near side of the level crossing, in front of the train: a car waits at the barrier
  function crossing(c) {
    if (!seen(CROSS - 200, CROSS + 200)) return;
    const X = sx(CROSS);
    car(c, CROSS - 8, VH - 2, '#ef4444');
    // barrier on its post, with flashing lights
    const px = X + 82, py = R + 2, a = -Math.PI / 2 - Math.PI / 2 * T.barrier;
    c.fillStyle = '#e5e7eb'; c.fillRect(px - 4, py, 8, VH - py);
    c.save(); c.translate(px, py); c.rotate(a);
    for (let k = 0; k < 6; k++) { c.fillStyle = k % 2 ? '#fff' : '#dc2626'; c.fillRect(k * 22, -4, 22, 8); }
    c.restore();
    c.fillStyle = '#111827'; rr(c, px - 22, py + 12, 44, 18, 9); c.fill();
    const on = T.barrier > 0.05 ? Math.floor(T.t * 3.6) % 2 : -1;
    c.fillStyle = on === 0 ? '#f87171' : '#7f1d1d'; dot(c, px - 12, py + 21, 6);
    c.fillStyle = on === 1 ? '#f87171' : '#7f1d1d'; dot(c, px + 12, py + 21, 6);
  }

  function track(c) {
    c.fillStyle = '#a8a29e'; c.fillRect(0, R - 6, VW, 16);
    c.fillStyle = '#6b4f2a';
    for (let x = Math.floor(cam / 34) * 34; x < cam + VW + 34; x += 34) {
      if (x > BRIDGE[0] && x < BRIDGE[1]) continue;
      c.fillRect(sx(x), R - 2, 20, 8);
    }
    c.fillStyle = '#6b7280'; c.fillRect(0, R - 4, VW, 4);
    c.fillStyle = '#d1d5db'; c.fillRect(0, R - 4, VW, 1.5);
  }
  function nearSide(c) {
    c.fillStyle = mix('#65a30d', '#9a6a2a', progress() * 0.35); c.fillRect(0, R + 10, VW, VH - R - 10);
    // flowers
    for (let x = Math.floor(cam / 90) * 90; x < cam + VW + 90; x += 90) {
      const r = Math.abs(Math.sin(x * 0.123) * 999) % 1;
      c.fillStyle = ['#fde047', '#f472b6', '#fff'][Math.floor(r * 3)]; dot(c, sx(x + r * 60), R + 20 + r * (VH - R - 30), 3.5);
    }
    if (seen(CROSS - 80, CROSS + 80)) {
      const X = sx(CROSS);
      c.fillStyle = '#6b7280'; c.fillRect(X - 70, R + 6, 140, VH - R);
      c.fillStyle = '#4b5563'; c.fillRect(X - 70, R - 6, 140, 16);
      c.fillStyle = '#9ca3af'; c.fillRect(X - 70, R - 4, 140, 4);
    }
    if (seen(BRIDGE[0], BRIDGE[1])) {
      const a = sx(BRIDGE[0]), b = sx(BRIDGE[1]);
      c.fillStyle = '#38bdf8'; c.fillRect(a, R + 10, b - a, VH - R);
      c.strokeStyle = 'rgba(255,255,255,.6)'; c.lineWidth = 2; c.beginPath();
      for (let k = 0; k < 6; k++) { const wx = a + ((k * 97 + T.t * 20) % (b - a)), wy = R + 22 + (k % 3) * 12; c.moveTo(wx, wy); c.quadraticCurveTo(wx + 8, wy - 4, wx + 16, wy); }
      c.stroke();
      c.fillStyle = '#b91c1c'; c.fillRect(a, R + 4, b - a, 12);
      c.fillStyle = '#78716c'; c.fillRect(a + (b - a) / 3 - 12, R + 16, 24, VH - R); c.fillRect(a + (b - a) * 2 / 3 - 12, R + 16, 24, VH - R);
      boat(c, T.boatX, VH - 8);
    }
  }
  function platform(c, a, b) {
    if (!seen(a, b)) return;
    const A = sx(a), B = sx(b);
    c.fillStyle = '#d6d3d1'; c.fillRect(A, R - 30, B - A, 20);
    c.fillStyle = '#facc15'; c.fillRect(A, R - 30, B - A, 4);
    c.fillStyle = '#9a3412'; c.fillRect(A, R - 10, B - A, VH - R + 10);
    c.strokeStyle = 'rgba(0,0,0,.15)'; c.lineWidth = 2; c.beginPath();
    for (let y = R; y < VH; y += 14) { c.moveTo(A, y); c.lineTo(B, y); }
    c.stroke();
  }

  // ---------- the train ----------
  function seatPos(i) { // a window seat, in world x and height above the rail
    const car = Math.floor(i / 4), j = i % 4, rx = T.x - LOCO - (car + 1) * (CAR + GAP);
    return [rx + [24, 58, 122, 156][j], 108];
  }
  function wheel(c, x, y, r, col) {
    c.fillStyle = '#111827'; dot(c, x, y, r);
    c.fillStyle = col; dot(c, x, y, r - 3);
    c.strokeStyle = '#111827'; c.lineWidth = Math.max(2, r / 7); c.beginPath();
    for (let k = 0; k < 6; k++) { const a = T.wheelA + k * Math.PI / 3; c.moveTo(x, y); c.lineTo(x + Math.cos(a) * (r - 3), y + Math.sin(a) * (r - 3)); }
    c.stroke();
    c.fillStyle = '#fbbf24'; dot(c, x, y, r * 0.22);
  }
  function loco(c, x0) {
    const col = BUS_COLORS[cfg.color] || BUS_COLORS.yellow, dark = '#1f2937';
    c.fillStyle = dark; c.fillRect(x0 + 4, R - 44, 226, 14);
    // cow catcher
    c.fillStyle = '#374151'; c.beginPath(); c.moveTo(x0 + 214, R - 40); c.lineTo(x0 + 248, R - 6); c.lineTo(x0 + 214, R - 6); c.closePath(); c.fill();
    // boiler, smokebox, chimney and dome
    c.fillStyle = col; rr(c, x0 + 74, R - 114, 150, 72, [8, 30, 30, 8]); c.fill();
    c.fillStyle = 'rgba(255,255,255,.25)'; c.fillRect(x0 + 80, R - 106, 130, 8);
    c.fillStyle = '#fbbf24'; c.fillRect(x0 + 112, R - 114, 7, 72); c.fillRect(x0 + 160, R - 114, 7, 72);
    c.fillStyle = dark; rr(c, x0 + 196, R - 116, 30, 76, 10); c.fill();
    c.fillRect(x0 + 180, R - 162, 22, 50); rr(c, x0 + 174, R - 172, 34, 12, 4); c.fill();
    c.fillStyle = '#fbbf24'; c.beginPath(); c.arc(x0 + 140, R - 114, 15, Math.PI, 0); c.fill();
    // the lamp on the front
    c.fillStyle = dark; rr(c, x0 + 212, R - 140, 20, 24, 4); c.fill();
    c.fillStyle = T.lights ? '#fef08a' : '#e5e7eb'; dot(c, x0 + 226, R - 128, 7);
    // cab, with the driver at the window
    c.fillStyle = col; rr(c, x0 + 4, R - 142, 80, 100, 6); c.fill();
    c.fillStyle = dark; rr(c, x0 - 4, R - 154, 96, 14, 6); c.fill();
    c.fillStyle = '#bfe3f5'; rr(c, x0 + 26, R - 132, 46, 42, 6); c.fill();
    c.save(); rr(c, x0 + 26, R - 132, 46, 42, 6); c.clip();
    c.translate(x0 + 52, R - 106); c.scale(1.05, 1.05);
    Scene.head(c, { skin: '#f1c27d', hair: '#4a2f1b', style: 4, bag: cfg.color2 });
    c.restore();
    c.fillStyle = 'rgba(255,255,255,.35)'; c.fillRect(x0 + 30, R - 128, 8, 34);
    c.fillStyle = '#9ca3af'; rr(c, x0 + 82, R - 164, 8, 12, 2); c.fill(); // whistle
    // the fire glows when it's fed
    c.fillStyle = 'rgba(251,146,60,' + (0.35 + T.fire * 0.65) + ')'; rr(c, x0 + 14, R - 58, 52, 12, 4); c.fill();
    // cylinder and wheels with the rods going round
    c.fillStyle = dark; rr(c, x0 + 180, R - 52, 34, 24, 5); c.fill();
    wheel(c, x0 + 36, R - 15, 15, '#dc2626'); wheel(c, x0 + 207, R - 15, 15, '#dc2626');
    wheel(c, x0 + 100, R - 27, 27, '#dc2626'); wheel(c, x0 + 156, R - 27, 27, '#dc2626');
    const a = T.wheelA, p1 = [x0 + 100 + Math.cos(a) * 14, R - 27 + Math.sin(a) * 14], p2 = [x0 + 156 + Math.cos(a) * 14, R - 27 + Math.sin(a) * 14];
    c.strokeStyle = '#d1d5db'; c.lineWidth = 6; c.lineCap = 'round';
    c.beginPath(); c.moveTo(p1[0], p1[1]); c.lineTo(p2[0], p2[1]); c.moveTo(p2[0], p2[1]); c.lineTo(x0 + 190, R - 40); c.stroke();
    c.lineCap = 'butt';
  }
  function carriage(c, rx, idx) {
    const col = cfg.color2, dark = '#1f2937';
    c.strokeStyle = dark; c.lineWidth = 5; c.beginPath(); c.moveTo(rx + CAR, R - 38); c.lineTo(rx + CAR + GAP, R - 38); c.stroke();
    for (const wx of [30, 58, 122, 150]) wheel(c, rx + wx, R - 13, 13, '#4b5563');
    c.fillStyle = dark; c.fillRect(rx + 8, R - 38, CAR - 16, 10);
    c.fillStyle = col; rr(c, rx, R - 142, CAR, 106, 12); c.fill();
    c.fillStyle = '#fef3c7'; c.fillRect(rx, R - 130, CAR, 46);
    c.fillStyle = dark; rr(c, rx - 4, R - 152, CAR + 8, 14, 7); c.fill();
    [10, 44, 108, 142].forEach((wx, j) => {
      const i = idx * 4 + j;
      c.fillStyle = '#bfe3f5'; rr(c, rx + wx, R - 126, 28, 36, 5); c.fill();
      const look = T.riders[i];
      if (look) {
        c.save(); rr(c, rx + wx, R - 126, 28, 36, 5); c.clip();
        c.translate(rx + wx + 14, R - 102 - Math.abs(Math.sin(T.t * 9 + i)) * Math.min(1, Math.abs(T.v) / 120) * 2.5); c.scale(0.9, 0.9);
        Scene.head(c, look);
        c.restore();
      }
    });
    // the door, in the middle
    c.fillStyle = mix(col.length === 7 ? col : '#2563eb', '#000000', 0.25); rr(c, rx + 76, R - 130, 28, 92, 4); c.fill();
    if (T.door > 0) { c.fillStyle = '#1f2937'; c.fillRect(rx + 78, R - 128, 24 * T.door, 88); }
    c.fillStyle = '#fbbf24'; dot(c, rx + 99, R - 84, 2.5);
  }
  function trainBody(c) {
    const x0 = sx(T.x - LOCO);
    for (let i = 0; i < CARS; i++) carriage(c, x0 - (i + 1) * (CAR + GAP), i);
    loco(c, x0);
  }
  // inside the tunnel it's dark, unless the lights are on
  function tunnel(c, pass) {
    if (!seen(TUN[0], TUN[1])) return;
    const a = sx(TUN[0]), b = sx(TUN[1]), top = R - 190;
    if (pass === 'bore') {
      c.fillStyle = '#3b2a20'; c.fillRect(a, top, b - a, 190);
      c.strokeStyle = 'rgba(0,0,0,.25)'; c.lineWidth = 2; c.beginPath();
      for (let y = top + 20; y < R; y += 22) { c.moveTo(a, y); c.lineTo(b, y); }
      c.stroke();
      return;
    }
    if (pass === 'dark') {
      c.save(); c.beginPath(); c.rect(a, top, b - a, 196); c.clip();
      c.fillStyle = 'rgba(8,8,20,.86)';
      c.beginPath(); c.rect(a, top, b - a, 196);
      const lx = sx(T.x) - 6, ly = R - 128;
      if (T.lights) { c.moveTo(lx, ly); c.lineTo(lx + 460, R + 20); c.lineTo(lx + 460, top - 10); c.closePath(); }
      c.fill('evenodd');
      if (T.lights) {
        const g = c.createLinearGradient(lx, 0, lx + 460, 0);
        g.addColorStop(0, 'rgba(254,240,138,.45)'); g.addColorStop(1, 'rgba(254,240,138,0)');
        c.fillStyle = g; c.beginPath(); c.moveTo(lx, ly); c.lineTo(lx + 460, R + 20); c.lineTo(lx + 460, top - 10); c.closePath(); c.fill();
        // the carriage lights are on too
        c.fillStyle = 'rgba(254,240,138,.35)';
        for (let i = 0; i < CARS; i++) { const rx = sx(T.x - LOCO - (i + 1) * (CAR + GAP)); for (const wx of [10, 44, 108, 142]) c.fillRect(rx + wx, R - 126, 28, 36); }
        c.fillStyle = '#fef08a'; dot(c, lx + 6, ly, 9);
      }
      c.restore();
      return;
    }
    // the stone mouths of the tunnel, in front of the train
    for (const X of [a, b]) {
      c.fillStyle = '#78716c'; c.fillRect(X - 14, top - 14, 28, 204);
      c.fillStyle = '#a8a29e'; c.fillRect(X - 14, top - 14, 28, 6);
    }
    c.fillStyle = '#78716c'; c.fillRect(a - 14, top - 14, b - a + 28, 16);
  }
  function smoke(c) {
    for (const p of T.puffs) {
      const a = Math.max(0, Math.min(1, p.life)) * 0.75;
      c.fillStyle = p.white ? 'rgba(255,255,255,' + a + ')' : T.rainbow ? 'hsla(' + p.hue + ',90%,65%,' + a + ')' : 'rgba(203,213,225,' + a + ')';
      dot(c, sx(p.x), R - p.y, p.r);
    }
    c.fillStyle = '#fb923c';
    for (const p of T.sparks) { c.globalAlpha = Math.max(0, p.life); dot(c, sx(p.x), R - p.y, 3); }
    c.globalAlpha = 1;
  }
  function people(c) {
    // the grown-ups waiting on the home platform
    if (seen(PLAT[0], PLAT[0] + 600)) {
      ADULTS.forEach((look, i) => {
        const x = PLAT[0] + 210 + i * 110;
        Scene.kid(c, { look, face: -1, wave: T.phase !== 'drive' || Math.abs(T.x - HOME) < 1400, phase: i * 2, alpha: 1 }, sx(x), R - 20, 1.5, T.t);
      });
    }
    for (const k of T.walkers) Scene.kid(c, k, sx(k.x), R - k.ry, 1, T.t);
  }
  const progress = () => Math.max(0, Math.min(1, (T.x - START) / (HOME - START)));

  function draw() {
    const c = cx;
    // follow the engine; at home, pan back to watch the kids run to the grown-ups
    const want = T.phase === 'drive' ? T.x - VW * 0.68 : Math.min(T.x - VW * 0.68, PLAT[0] + 380 - VW / 2);
    T.cam = T.cam == null ? want : T.cam + (want - T.cam) * 0.04;
    cam = T.cam; R = VH - 58;
    c.setTransform(DPR * K, 0, 0, DPR * K, 0, 0);
    const p = progress();
    sky(c, p);
    const tall = Math.max(0, VH - 420);
    hills(c, 0.12, mix('#a7d98b', '#c59a7a', p * 0.6), R - 150, 85 + tall * 0.18, 0.0031, 0.0083, 1);
    hills(c, 0.3, mix('#78c35c', '#9a8a55', p * 0.5), R - 126, 45 + tall * 0.08, 0.0057, 0.016, 2.3);
    c.fillStyle = mix('#6dbb4f', '#8a8a4a', p * 0.4); c.fillRect(0, R - 140, VW, 142);
    farSide(c);
    tunnel(c, 'bore');
    track(c);
    nearSide(c);
    trainBody(c);
    tunnel(c, 'dark');
    tunnel(c, 'mouth');
    platform(c, -200, 820);
    platform(c, PLAT[0], PLAT[1]);
    if (seen(BUFFER, BUFFER + 50)) { c.fillStyle = '#dc2626'; c.fillRect(sx(BUFFER) + 18, R - 70, 14, 64); c.fillStyle = '#111827'; dot(c, sx(BUFFER) + 16, R - 50, 7); }
    crossing(c);
    people(c);
    smoke(c);
    for (const b of T.bubbles) {
      c.globalAlpha = Math.min(1, b.t * 3);
      Scene.bubble(c, b.text, sx(b.x), R - b.y);
    }
    c.globalAlpha = 1;
    if (T.whistle) Scene.bubble(c, 'TOOT TOOT!', sx(T.x - LOCO + 86), R - 190, 1.2);
    c.setTransform(DPR, 0, 0, DPR, 0, 0);
    hud();
  }

  function pill(x, y, text, u, bg) {
    const c = cx;
    c.font = '700 ' + Math.round(19 * u) + 'px ' + FONT;
    const w = c.measureText(text).width + 22 * u, h = 34 * u;
    c.fillStyle = bg || 'rgba(17,24,39,.55)'; rr(c, x, y, w, h, h / 2); c.fill();
    c.fillStyle = '#fff'; c.textAlign = 'left'; c.textBaseline = 'middle'; c.fillText(text, x + 11 * u, y + h / 2 + 1);
    return w;
  }
  function hud() {
    const c = cx, u = Math.max(0.7, Math.min(1.3, Math.min(W / 760, H / 300)));
    const w1 = pill(10 * u, 10 * u, '🧒 ' + T.riders.length, u);
    pill(18 * u + w1, 10 * u, cfg.name, u, cfg.color2);
    // the way home: school, the train, home
    const narrow = W < 560, pw = Math.min(W * (narrow ? 0.62 : 0.36), 300 * u), px = (W - pw) / 2, py = (narrow ? 64 : 27) * u, f = progress();
    c.fillStyle = 'rgba(17,24,39,.4)'; rr(c, px - 40 * u, py - 15 * u, pw + 80 * u, 30 * u, 15 * u); c.fill();
    c.fillStyle = 'rgba(255,255,255,.75)'; c.fillRect(px, py - 2 * u, pw, 4 * u);
    c.font = Math.round(20 * u) + 'px sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText('🏫', px - 22 * u, py + 1); c.fillText('🏠', px + pw + 22 * u, py + 1);
    c.fillText('🚂', px + f * pw, py);
    const m = T.toast;
    if (m) {
      const a = Math.min(1, m.t / 0.2, (m.dur - m.t) / 0.3);
      let fs = Math.round(21 * u);
      c.font = '700 ' + fs + 'px ' + FONT;
      let tw = c.measureText(m.text).width;
      if (tw > W - 60) { fs = Math.floor(fs * (W - 60) / tw); c.font = '700 ' + fs + 'px ' + FONT; tw = c.measureText(m.text).width; }
      const bw = tw + 36 * u, bh = fs + 22 * u, bx = (W - bw) / 2, by = (narrow ? 92 : 54) * u + (1 - a) * -10;
      c.globalAlpha = Math.max(0, a);
      c.fillStyle = 'rgba(0,0,0,.2)'; rr(c, bx, by + 4, bw, bh, bh / 2); c.fill();
      c.fillStyle = '#fff'; rr(c, bx, by, bw, bh, bh / 2); c.fill();
      c.fillStyle = '#1f2937'; c.textAlign = 'center'; c.fillText(m.text, W / 2, by + bh / 2 + 1);
      c.globalAlpha = 1;
    }
    if (T.starAt) {
      const k = Math.min(1, (performance.now() - T.starAt) / 600), r = Math.min(W, H) * 0.2 * (0.3 + 0.7 * k);
      c.save(); c.translate(W / 2, H * 0.45); c.rotate((1 - k) * 2);
      for (const [rad, col, ox] of [[r * 1.12, '#b45309', 0], [r, '#fbbf24', 0], [r * 0.45, '#fde68a', -r * 0.1]]) {
        c.fillStyle = col; c.beginPath();
        for (let i = 0; i < 10; i++) { const an = -Math.PI / 2 + i * Math.PI / 5, q = i % 2 ? rad * 0.45 : rad; c.lineTo(ox + Math.cos(an) * q, ox * 1.2 + Math.sin(an) * q); }
        c.closePath(); c.fill();
      }
      c.restore();
    }
  }

  return { open };
})();
