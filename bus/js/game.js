'use strict';
// Bus Driver: state, rules, controls and the main loop.
(() => {
  const MAX_V = 220, SLOW_V = 100, REV_V = 90, ACCEL = 120, BRAKE = 420, EASE = 220, COAST = 160;
  const ALIGN = 70, SLOW_ZONE = 420, SEATS = 10, TAU = Math.PI * 2;
  const HI = ['Hi!', 'Hello!', 'Yay!', 'Thank you!', 'Morning!', 'Hiya!'];
  const BYE = ['Bye!', 'Thanks!', 'See you!', 'Bye bye!'];
  const NOTE_COLS = ['#ef4444', '#f59e0b', '#22c55e', '#3b82f6', '#a855f7', '#ec4899'];

  const cv = document.getElementById('game'), cx = cv.getContext('2d', { alpha: false });
  const view = document.getElementById('view');
  const $ = id => document.getElementById(id);
  const pick = a => a[Math.floor(Math.random() * a.length)];
  const approach = (v, to, step) => v < to ? Math.min(to, v + step) : Math.max(to, v - step);

  // ---------- saved progress ----------
  // Each player (PROFILES, in school.js) keeps their own stars, bus colour and school progress.
  const SAVE_KEY = 'busDriver.v1';
  const save = { muted: false, player: PROFILES[0].id, players: {} };
  try {
    const old = JSON.parse(localStorage.getItem(SAVE_KEY)) || {};
    if (old.players) Object.assign(save, old);
    else { // saved before there were players: that progress was Kellan's
      const { muted, ...progress } = old;
      save.muted = !!muted; save.players[PROFILES[0].id] = progress;
    }
  } catch (e) { /* private mode */ }
  for (const p of PROFILES) save.players[p.id] = Object.assign({ stars: 0, color: 'yellow' }, save.players[p.id]);
  const persist = () => { try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch (e) { /* ignore */ } };
  let profile = PROFILES.find(p => p.id === save.player) || PROFILES[0];
  let me = save.players[profile.id]; // the current player's progress

  // ---------- state ----------
  const S = {
    mode: 'title', t: 0, day: 1, color: me.color,
    bus: { x: 0, v: 0, mode: 'stop', engine: false, starting: 0, doorsOpen: false, door: 0, wipers: false, wiperPh: 0,
      wiperA: BUS.wiperRest, wheelA: 0, dist: 0, bounce: 0, drops: [], wasMoving: false, revBeep: 0 },
    stops: [], route: null, onBus: [], walkers: [], unloading: null, delivered: 0, pendingDay: false,
    raining: false, rain: 0, weatherT: 45, dropT: 0,
    radio: false, song: 0,
    puffs: [], notes: [], rainP: [], confetti: [], puffT: 0, noteT: 0,
    classKids: [], classReady: false,
    toast: null, flash: null, boardT: 0, exitT: 0, beepT: 0, horn: false,
  };

  function makeKid() {
    return { look: { skin: pick(KID.skin), hair: pick(KID.hair), style: Math.floor(Math.random() * 6),
      shirt: pick(KID.shirt), pants: pick(KID.pants), bag: pick(KID.bag) },
    state: 'wait', x: 0, ry: 26, face: -1, phase: Math.random() * TAU, hop: 0, jumpT: 0, alpha: 1, bubble: null, wave: false };
  }

  function newRoute() {
    const b = S.bus, door = b.x + BUS.door;
    let free = SEATS - S.onBus.length;
    const n = free > 0 ? 3 + (S.day > 1 && Math.random() < 0.5 ? 1 : 0) : 0;
    const route = { startX: door, stops: [], school: null };
    let x = door + 1000 + Math.random() * 300;
    for (let i = 0; i < n && free > 0; i++) {
      const left = n - i - 1, cnt = Math.max(1, Math.min(free - left, 1 + Math.floor(Math.random() * 3)));
      const st = { x, school: false, kids: [] };
      for (let j = 0; j < cnt; j++) { const k = makeKid(); k.x = x - 40 - j * 30; k.ry = 26 + (j % 2) * 9; st.kids.push(k); }
      free -= cnt; route.stops.push(st); S.stops.push(st);
      x += 1500 + Math.random() * 600;
    }
    route.school = { x: x + 300, school: true, kids: [], done: false };
    route.stops.push(route.school); S.stops.push(route.school);
    S.route = route;
  }
  function startDay() {
    S.pendingDay = false; S.day++;
    newRoute();
    toast('Day ' + S.day + '! More kids are waiting! 🚏', 3);
  }

  const seatTaken = s => S.onBus.some(k => k.seat === s);
  const freeSeat = () => { for (let s = 0; s < SEATS; s++) if (!seatTaken(s)) return s; return -1; };
  const isPending = s => s.school ? S.onBus.length > 0 && !s.done : s.kids.some(k => k.state === 'wait') && S.onBus.length < SEATS;
  const boarding = () => S.stops.some(s => s.kids.some(k => k.state === 'toBus' || k.state === 'climb'));
  const brakeDist = v => v * v / (2 * BRAKE);

  // The stop the bus should head for: one just missed behind it, else the next one ahead.
  function goal(doorX) {
    let ahead = null, behind = null;
    for (const s of S.stops) {
      if (!s.pending) continue;
      const d = s.x - doorX;
      if (d >= -ALIGN) { if (!ahead || d < ahead.x - doorX) ahead = s; }
      else if (!behind || d > behind.x - doorX) behind = s;
    }
    if (behind && doorX - behind.x < 700) return behind;
    return ahead || (behind && doorX - behind.x < 2500 ? behind : null);
  }

  // ---------- messages ----------
  function toast(text, dur) { S.toast = { text, t: 0, dur: dur || 2.2 }; }
  function nope(text, btn) { Sound.nope(); toast(text); if (btn) S.flash = { btn, t: 2 }; buzz(30); }
  const buzz = ms => { try { if (navigator.vibrate) navigator.vibrate(ms); } catch (e) { /* ignore */ } };

  // ---------- controls ----------
  function drive(mode) {
    const b = S.bus;
    if (!b.engine) return b.starting > 0 ? null : nope('Turn the key to start the engine!', 'engine');
    if (b.doorsOpen) return nope('Close the doors first!', 'close');
    if (S.walkers.length) return nope('Wait! The kids are crossing the road.');
    if (b.mode !== mode) { b.mode = mode; Sound.gear(); }
  }
  const ACT = {
    engine() {
      const b = S.bus;
      if (b.starting > 0) return;
      if (b.engine) { b.engine = false; b.mode = 'stop'; Sound.engineStop(); }
      else { b.starting = 0.9; Sound.engineStart(); }
    },
    go() { drive('drive'); },
    back() { drive('reverse'); },
    stop() { S.bus.mode = 'stop'; Sound.click(); },
    open() {
      const b = S.bus;
      if (b.doorsOpen) return Sound.click();
      if (b.v !== 0) return nope('Stop the bus first!', 'stop');
      b.doorsOpen = true; b.mode = 'stop'; Sound.door(true);
      S.boardT = 0.5; S.exitT = 0.4;
      const doorX = b.x + BUS.door;
      if (!S.stops.some(s => s.aligned)) {
        const near = S.stops.find(s => s.pending && Math.abs(s.x - doorX) < 600);
        if (near) toast(near.x > doorX ? 'Drive a little closer to the bus stop!' : 'Back up a little to the bus stop!', 2.6);
      }
    },
    close() {
      const b = S.bus;
      if (!b.doorsOpen) return Sound.click();
      if (boarding()) return nope('Wait! Someone is getting on.');
      if (S.walkers.some(k => k.state === 'exit')) return nope('Wait! Someone is getting off.');
      b.doorsOpen = false; Sound.door(false);
      if (S.onBus.length) S.unloading = null;
      if (S.pendingDay) startDay();
    },
    wipers() { S.bus.wipers = !S.bus.wipers; Sound.click(); },
    radio() {
      S.radio = !S.radio;
      if (S.radio) { Sound.radioOn(S.song); toast('📻 ' + SONGS[S.song].name, 2.4); } else Sound.radioOff();
    },
    next() {
      if (!S.radio) return ACT.radio();
      S.song = (S.song + 1) % SONGS.length;
      Sound.radioOn(S.song); toast('📻 ' + SONGS[S.song].name, 2.4);
    },
  };
  function hornDown() {
    if (S.horn) return;
    S.horn = true; Sound.hornOn(); S.beepT = 0.6;
    const doorX = S.bus.x + BUS.door;
    for (const s of S.stops) if (Math.abs(s.x - doorX) < 900) for (const k of s.kids) if (k.state === 'wait') k.jumpT = 0.9;
  }
  function hornUp() { if (!S.horn) return; S.horn = false; Sound.hornOff(); }

  const BTN = {
    engine: $('bEngine'), go: $('bGo'), back: $('bBack'), stop: $('bStop'), open: $('bOpen'), close: $('bClose'),
    wipers: $('bWipers'), radio: $('bRadio'), next: $('bNext'),
  };
  function press(el) { el.classList.add('press'); setTimeout(() => el.classList.remove('press'), 140); }
  for (const [name, el] of Object.entries(BTN)) {
    el.addEventListener('pointerdown', e => {
      e.preventDefault();
      if (S.mode !== 'play') return;
      buzz(12); ACT[name]();
    });
  }
  const horn = $('bHorn');
  horn.addEventListener('pointerdown', e => { e.preventDefault(); if (S.mode !== 'play') return; try { horn.setPointerCapture(e.pointerId); } catch (err) { /* synthetic event */ } buzz(15); hornDown(); });
  for (const ev of ['pointerup', 'pointercancel', 'lostpointercapture']) horn.addEventListener(ev, hornUp);
  document.addEventListener('contextmenu', e => e.preventDefault());

  const KEYS = { ArrowRight: 'go', ArrowUp: 'go', ArrowLeft: 'back', ArrowDown: 'stop', ' ': 'stop', s: 'stop',
    e: 'engine', k: 'engine', o: 'open', c: 'close', w: 'wipers', r: 'radio', n: 'next' };
  addEventListener('keydown', e => {
    if (S.mode === 'title' && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); return start(); }
    if (S.mode !== 'play' || e.repeat) return;
    const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    if (key === 'h' || key === 'b') { hornDown(); horn.classList.add('press'); return; }
    const a = KEYS[key];
    if (a) { e.preventDefault(); press(BTN[a]); ACT[a](); }
  });
  addEventListener('keyup', e => {
    const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    if (key === 'h' || key === 'b') { hornUp(); horn.classList.remove('press'); }
  });
  addEventListener('blur', hornUp);

  // ---------- corner buttons ----------
  const muteBtn = $('bMute');
  const showMute = () => { muteBtn.textContent = save.muted ? '🔇' : '🔊'; };
  muteBtn.addEventListener('click', () => { save.muted = !save.muted; Sound.setMuted(save.muted); showMute(); persist(); });
  showMute();
  const fsEl = document.documentElement;
  const canFs = !!(fsEl.requestFullscreen || fsEl.webkitRequestFullscreen);
  function fullscreen(on) {
    try {
      if (on) { const p = (fsEl.requestFullscreen || fsEl.webkitRequestFullscreen).call(fsEl); if (p && p.catch) p.catch(() => {}); }
      else if (document.fullscreenElement || document.webkitFullscreenElement) (document.exitFullscreen || document.webkitExitFullscreen).call(document);
    } catch (e) { /* not allowed here */ }
  }
  let homeT = 0;
  $('bHome').addEventListener('click', () => {
    if (S.mode !== 'play') return;
    if (performance.now() - homeT < 2500) { persist(); location.reload(); return; }
    homeT = performance.now(); toast('Tap 🏠 again to change player', 2.5);
  });
  if (canFs) $('bFull').addEventListener('click', () => fullscreen(!(document.fullscreenElement || document.webkitFullscreenElement)));
  else $('bFull').hidden = true;

  // ---------- title screen: who's playing, then pick a bus ----------
  const sw = $('swatches'), who = $('players');
  PROFILES.forEach((p, i) => {
    const b = document.createElement('button');
    b.className = 'player'; b.style.setProperty('--pc', p.color);
    b.innerHTML = '<span class="num">' + (i + 1) + '</span><span class="nm">' + p.name + '</span><span class="st">⭐ ' + save.players[p.id].stars + '</span>';
    b.addEventListener('click', () => choose(p));
    who.appendChild(b);
  });
  function choose(p) {
    profile = p; me = save.players[p.id]; save.player = p.id; persist();
    School.player = p;
    S.color = me.color;
    for (const el of sw.children) el.classList.toggle('sel', el.dataset.c === S.color);
    $('hello').textContent = 'Hi ' + p.name + '! Pick your bus';
    $('hello').style.color = p.color;
    $('starLine').textContent = me.stars > 0 ? '⭐ ' + me.stars + (me.stars === 1 ? ' kid' : ' kids') + ' taken to school so far!' : '';
    $('pickPlayer').hidden = true; $('pickBus').hidden = false;
  }
  $('changePlayer').addEventListener('click', () => { $('pickBus').hidden = true; $('pickPlayer').hidden = false; });
  for (const [name, col] of Object.entries(BUS_COLORS)) {
    const b = document.createElement('button');
    b.className = 'sw'; b.dataset.c = name; b.setAttribute('aria-label', name + ' bus');
    b.innerHTML = `<svg viewBox="0 0 44 26"><rect x="1" y="2" width="42" height="18" rx="5" fill="${col}" stroke="#1f2937" stroke-width="1.5"/>`
      + `<rect x="5" y="5" width="7" height="7" rx="1.5" fill="#bfe3f5"/><rect x="14" y="5" width="7" height="7" rx="1.5" fill="#bfe3f5"/>`
      + `<rect x="23" y="5" width="7" height="7" rx="1.5" fill="#bfe3f5"/><rect x="33" y="5" width="8" height="9" rx="2" fill="#bfe3f5"/>`
      + `<circle cx="11" cy="21" r="4" fill="#1f2937"/><circle cx="33" cy="21" r="4" fill="#1f2937"/></svg>`;
    b.classList.toggle('sel', name === S.color);
    b.addEventListener('click', () => {
      S.color = me.color = name; persist();
      for (const el of sw.children) el.classList.toggle('sel', el === b);
    });
    sw.appendChild(b);
  }
  function start() {
    if (S.mode === 'play' || $('pickBus').hidden) return;
    Sound.unlock(); Sound.setMuted(save.muted);
    School.preload(); // the school voice clips load while you drive
    $('title').hidden = true;
    S.mode = 'play';
    if (canFs && matchMedia('(pointer: coarse)').matches) fullscreen(true);
    toast('Turn the key to start the engine! 🔑', 3.2);
  }
  $('play').addEventListener('click', start);

  // ---------- update ----------
  function update(dt) {
    const b = S.bus;
    if (S.flash && (S.flash.t -= dt) <= 0) S.flash = null;
    if (S.toast && (S.toast.t += dt) > S.toast.dur) S.toast = null;
    if (b.starting > 0 && (b.starting -= dt) <= 0) { b.starting = 0; b.engine = true; }
    b.door = approach(b.door, b.doorsOpen ? 1 : 0, dt * 2.4);

    for (const s of S.stops) s.pending = isPending(s);
    let doorX = b.x + BUS.door;
    const g = goal(doorX);

    // speed
    let target = 0;
    if (b.engine && !b.doorsOpen && b.door === 0) {
      if (b.mode === 'drive') target = g && g.x > doorX && g.x - doorX < SLOW_ZONE ? SLOW_V : MAX_V;
      else if (b.mode === 'reverse') target = -REV_V;
    }
    if (g && b.mode === 'drive' && g.x > doorX && g.x - doorX < SLOW_ZONE && g.x - doorX > ALIGN && g.announced !== true) {
      g.announced = true;
      toast(g.school ? 'Here comes the school! 🏫' : 'Bus stop! Get ready to stop! 🚏', 2.4);
    }
    b.target = target;
    if (target > b.v) b.v = Math.min(target, b.v + (b.v < 0 ? BRAKE : ACCEL) * dt);
    else if (target < b.v) b.v = Math.max(target, b.v - (b.v > 0 ? (!b.engine ? COAST : target > 0 ? EASE : BRAKE) : ACCEL) * dt);
    if (Math.abs(b.v) > 40) b.wasMoving = true;
    if (b.v === 0 && b.wasMoving) { b.wasMoving = false; Sound.airBrake(); }
    b.x += b.v * dt;
    if (b.x < 0) { b.x = 0; if (b.v < 0) { b.v = 0; b.mode = 'stop'; toast("That's the end of the road!"); } }
    b.wheelA += b.v * dt / 24;
    b.dist += Math.abs(b.v) * dt;
    b.bounce = b.engine ? Math.sin(S.t * 38) * 0.5 + Math.sin(b.dist * 0.07) * Math.min(1, Math.abs(b.v) / 120) * 1.3 : 0;
    if (b.v < -5) { if ((b.revBeep -= dt) <= 0) { Sound.reverseBeep(); b.revBeep = 0.7; } } else b.revBeep = 0;
    doorX = b.x + BUS.door;

    // which stop are we at?
    let here = null;
    for (const s of S.stops) { s.aligned = Math.abs(doorX - s.x) <= ALIGN; if (s.aligned) here = s; }
    const parked = b.v === 0 && b.door >= 1;
    if (here && parked && !here.school) {
      if ((S.boardT -= dt) <= 0) {
        const k = here.kids.find(k => k.state === 'wait');
        const coming = here.kids.filter(k => k.state === 'toBus' || k.state === 'climb').length;
        if (k && S.onBus.length + coming < SEATS) { k.state = 'toBus'; S.boardT = 0.5; }
        else if (k && !coming && !S.fullWarned) { S.fullWarned = true; toast('The bus is full! Off to school!', 2.6); }
      }
    }
    if (here && parked && here.school && !here.done) {
      if ((S.onBus.length || S.walkers.length) && !S.unloading) { S.unloading = here; S.classKids = []; }
      if (S.onBus.length && (S.exitT -= dt) <= 0) {
        S.onBus.sort((a, c) => a.seat - c.seat);
        const k = S.onBus.shift();
        Object.assign(k, { state: 'exit', x: doorX, ry: 96, ct: 0, alpha: 0, face: 1, zebra: here.x + ZEBRA, bubble: { text: pick(BYE), t: 1.6 } });
        S.walkers.push(k); Sound.bye(); S.exitT = 0.55;
      }
      if (!S.unloading && !S.onBus.length && !S.walkers.length) {
        here.done = true;
        toast('No kids on the bus! Pick some up at the bus stops.', 3);
        S.pendingDay = true;
      }
    }
    if (S.unloading && !S.onBus.length && !S.walkers.length) finishSchool();

    // missed the school completely: put another one up ahead
    if (S.route && !S.route.school.done && b.x > S.route.school.x + 1400) {
      toast('Oops, we drove past the school! There’s another one ahead.', 3.2);
      newRoute();
    }
    // forget stops far behind
    if (S.stops.length > 12) S.stops = S.stops.filter(s => s.x > b.x - 4000 || S.route.stops.includes(s));

    if (S.classReady && b.v !== 0) hideClassBtn();
    updateKids(dt, doorX);
    updateWeather(dt);
    updateParticles(dt);

    S.beepT = S.horn ? 0.4 : Math.max(0, S.beepT - dt);
    Sound.engineSet(Math.min(1, Math.abs(b.v) / MAX_V), S.radio);
    Sound.rainLevel(S.rain);
    Sound.radioTick();
  }

  function finishSchool() {
    const n = S.delivered;
    S.unloading.done = true; S.unloading = null; S.delivered = 0;
    me.stars += n; persist();
    Sound.fanfare(); buzz([40, 60, 40]);
    toast('Hooray! ' + n + (n === 1 ? ' kid is' : ' kids are') + ' at school! ⭐ +' + n, 3.6);
    for (let i = 0; i < 140; i++) {
      S.confetti.push({ x: Math.random() * W, y: -Math.random() * H * 0.6, vx: (Math.random() - 0.5) * 120, vy: 60 + Math.random() * 120,
        r: Math.random() * TAU, vr: (Math.random() - 0.5) * 10, col: pick(NOTE_COLS), life: 3 + Math.random() });
    }
    if (n > 0) { S.classReady = true; setTimeout(() => { if (S.classReady) classBtn.hidden = false; }, 1600); }
    if (S.bus.doorsOpen) S.pendingDay = true; else startDay();
  }

  // ---------- stage two: inside the school ----------
  const classBtn = $('goClass');
  function hideClassBtn() { S.classReady = false; classBtn.hidden = true; }
  classBtn.addEventListener('click', () => {
    if (S.mode !== 'play') return;
    hideClassBtn(); hornUp();
    const b = S.bus;
    if (b.engine) { b.engine = false; b.mode = 'stop'; Sound.engineStop(); }
    if (S.radio) { S.radio = false; Sound.radioOff(); }
    S.mode = 'class'; S.toast = null;
    School.open(S.classKids, () => {
      S.mode = 'play';
      toast(S.bus.doorsOpen ? 'Home time! Close the doors and start the engine.' : 'Home time! Start the engine.', 3.2);
    }, { save: me, persist, muted: () => save.muted, name: profile.name, id: profile.id, sound: Sound, color: () => S.color });
  });

  function updateKids(dt, doorX) {
    const b = S.bus;
    for (const s of S.stops) {
      if (s.school) continue;
      let q = 0;
      for (const k of s.kids) {
        if (k.bubble && (k.bubble.t -= dt) <= 0) k.bubble = null;
        if (k.jumpT > 0) { k.jumpT -= dt; k.hop = Math.abs(Math.sin(k.jumpT * Math.PI * 2.4)) * 12; } else k.hop = 0;
        if (k.state === 'wait') {
          const qx = s.x - 40 - q * 30, qry = 26 + (q % 2) * 9; q++;
          k.walking = Math.abs(k.x - qx) > 1;
          k.x = approach(k.x, qx, 60 * dt); k.ry = approach(k.ry, qry, 30 * dt);
          k.face = k.walking ? 1 : -1;
          const d = s.x - doorX;
          k.wave = k.jumpT > 0 || (b.engine && d > -200 && d < 1100);
          if (k.walking) k.phase += dt * 12;
        } else if (k.state === 'toBus') {
          k.wave = false; k.walking = true; k.phase += dt * 13;
          k.face = doorX >= k.x ? 1 : -1;
          k.x = approach(k.x, doorX, 120 * dt); k.ry = approach(k.ry, 46, 60 * dt);
          if (Math.abs(k.x - doorX) < 1 && k.ry === 46) { k.state = 'climb'; k.ct = 0; k.walking = false; }
        } else if (k.state === 'climb') {
          k.ct += dt;
          const f = Math.min(1, k.ct / 0.45);
          k.ry = 46 + f * 52; k.alpha = 1 - f * 0.9; k.sc = 1 - f * 0.15;
          if (f >= 1) {
            k.state = 'seated'; k.seat = freeSeat(); k.alpha = 1; k.sc = 1; k.hop = 0;
            k.bubble = { text: pick(HI), t: 1.8 };
            S.onBus.push(k); Sound.board(S.onBus.length); buzz(20);
          }
        }
      }
      s.kids = s.kids.filter(k => k.state !== 'seated');
    }
    for (const k of S.onBus) if (k.bubble && (k.bubble.t -= dt) <= 0) k.bubble = null;
    for (const k of S.walkers) {
      if (k.bubble && (k.bubble.t -= dt) <= 0) k.bubble = null;
      if (k.state === 'exit') {
        k.ct += dt;
        const f = Math.min(1, k.ct / 0.45);
        k.ry = 96 - f * 62; k.alpha = 0.2 + f * 0.8;
        if (f >= 1) k.state = 'walk';
      } else if (k.state === 'walk') {
        k.walking = true; k.phase += dt * 13; k.face = 1;
        k.x = approach(k.x, k.zebra, 110 * dt);
        if (k.x === k.zebra) k.state = 'cross';
      } else if (k.state === 'cross') {
        k.phase += dt * 11;
        k.ry = approach(k.ry, GROUND.farPave + 4, 80 * dt);
        k.sc = 1 - (k.ry - 34) / (GROUND.farPave - 30) * 0.25;
        if (k.ry === GROUND.farPave + 4) { k.state = 'enter'; k.ct = 0; k.walking = false; }
      } else if (k.state === 'enter') {
        k.ct += dt; k.alpha = Math.max(0, 1 - k.ct / 0.4);
        if (k.ct >= 0.4) { k.state = 'gone'; S.delivered++; S.classKids.push(k.look); }
      }
    }
    S.walkers = S.walkers.filter(k => k.state !== 'gone');
  }

  function updateWeather(dt) {
    const b = S.bus;
    S.weatherT -= dt * (b.engine ? 1 : 0.4);
    if (S.weatherT <= 0) {
      S.raining = !S.raining;
      S.weatherT = S.raining ? 22 + Math.random() * 15 : 40 + Math.random() * 35;
      if (S.raining && !b.wipers) toast("It's raining! Turn on the wipers! 🌧️", 3);
    }
    S.rain = approach(S.rain, S.raining ? 1 : 0, dt / 4);
    // wipers: one full sweep there and back per cycle
    if (b.wipers || b.wiperPh > 0) {
      const before = b.wiperPh;
      b.wiperPh += dt * 4.6;
      if (before < Math.PI && b.wiperPh >= Math.PI) Sound.swish();
      if (b.wiperPh >= TAU) { Sound.swish(); b.wiperPh = b.wipers ? b.wiperPh - TAU : 0; }
    }
    b.wiperA = BUS.wiperRest - (1 - Math.cos(b.wiperPh)) / 2 * BUS.wiperSweep;
    // drops on the windows
    if (S.rain > 0.15 && b.drops.length < 40) {
      S.dropT -= dt * S.rain * 10;
      while (S.dropT <= 0) {
        S.dropT += 1;
        const drv = Math.random() < 0.45, w = Math.floor(Math.random() * 5);
        b.drops.push(drv
          ? { x: 303 + Math.random() * 46, y: -125 + Math.random() * 52, r: 2 + Math.random() * 2.5, life: 1, drv }
          : { x: 19 + w * 45 + Math.random() * 32, y: -123 + Math.random() * 40, r: 1.8 + Math.random() * 2, life: 1, drv });
      }
    }
    const [px, py] = BUS.pivot;
    b.drops = b.drops.filter(d => {
      d.life -= dt * (S.rain > 0.15 ? 0.1 : 0.5); d.y += dt * 2.5;
      if (d.drv) {
        const dx = d.x - px, dy = d.y - py;
        if (Math.hypot(dx, dy) < BUS.wiperLen + 3 && Math.abs(Math.atan2(dy, dx) - b.wiperA) < 0.14) return false;
      }
      return d.life > 0;
    });
    // falling rain, in view units
    const want = Math.round(S.rain * 130);
    while (S.rainP.length < want) S.rainP.push({ x: Math.random() * VW, y: Math.random() * VH });
    if (S.rainP.length > want) S.rainP.length = want;
    for (const p of S.rainP) {
      p.y += 640 * dt; p.x -= (120 + b.v * 0.6) * dt;
      if (p.y > VH) { p.y -= VH + Math.random() * 40; p.x = Math.random() * VW; }
      if (p.x < -20) p.x += VW + 40; else if (p.x > VW + 20) p.x -= VW + 40;
    }
  }

  function updateParticles(dt) {
    const b = S.bus;
    if (b.engine) {
      S.puffT -= dt;
      if (S.puffT <= 0) {
        S.puffT = b.target > b.v + 5 ? 0.12 : 0.3;
        S.puffs.push({ x: b.x - 12, ry: GROUND.body + 4, r: 5, life: 1 });
      }
    }
    for (const p of S.puffs) { p.ry += 16 * dt; p.r += 10 * dt; p.x -= 15 * dt; p.life -= dt * 0.8; }
    S.puffs = S.puffs.filter(p => p.life > 0);
    if (S.radio && (S.noteT -= dt) <= 0) {
      S.noteT = 0.6;
      S.notes.push({ x: b.x + 30 + Math.random() * 210, ry: GROUND.body + 150, life: 1, ch: pick(['♪', '♫', '♬']), col: pick(NOTE_COLS), ph: Math.random() * 6 });
    }
    for (const n of S.notes) { n.ry += 30 * dt; n.life -= dt * 0.45; }
    S.notes = S.notes.filter(n => n.life > 0);
    for (const p of S.confetti) { p.vy += 160 * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.r += p.vr * dt; p.life -= dt; }
    S.confetti = S.confetti.filter(p => p.life > 0 && p.y < H + 20);
  }

  // ---------- hints: the button the player should press next pulses ----------
  function hint() {
    const b = S.bus;
    if (S.mode !== 'play') return '';
    if (S.flash) return S.flash.btn;
    if (boarding() || S.walkers.length || S.classReady) return '';
    const doorX = b.x + BUS.door, here = S.stops.find(s => s.aligned);
    if (b.doorsOpen) {
      if (b.door < 1) return '';
      if (here && !here.school && here.kids.length && S.onBus.length < SEATS) return '';
      if (here && here.school && S.onBus.length) return '';
      return 'close';
    }
    if (!b.engine) return b.starting > 0 ? '' : 'engine';
    const g = goal(doorX);
    if (!g) return b.mode === 'drive' ? '' : 'go';
    const d = g.x - doorX;
    if (Math.abs(d) <= ALIGN) return b.v === 0 ? 'open' : 'stop';
    if (d > 0) {
      if (b.v < 0 || (b.v > 0 && d < brakeDist(b.v) + 45)) return 'stop';
      return b.mode === 'drive' ? '' : 'go';
    }
    if (b.v > 0 || (b.v < 0 && -d < brakeDist(-b.v) + 20)) return 'stop';
    return b.mode === 'reverse' ? '' : 'back';
  }
  let shownHint = '', shownWipe = false;
  const lit = {};
  function setLit(name, on) { if (lit[name] !== on) { lit[name] = on; BTN[name].classList.toggle('on', on); } }
  function syncButtons() {
    const b = S.bus, h = hint();
    if (h !== shownHint) {
      if (shownHint) BTN[shownHint].classList.remove('hint');
      if (h) BTN[h].classList.add('hint');
      shownHint = h;
    }
    const wipe = S.mode === 'play' && S.rain > 0.4 && !b.wipers;
    if (wipe !== shownWipe) { BTN.wipers.classList.toggle('hint2', wipe); shownWipe = wipe; }
    setLit('engine', b.engine || (b.starting > 0 && S.t % 0.3 < 0.15));
    setLit('go', b.engine && b.mode === 'drive');
    setLit('back', b.engine && b.mode === 'reverse');
    setLit('stop', b.mode === 'stop');
    setLit('open', b.doorsOpen);
    setLit('close', !b.doorsOpen);
    setLit('wipers', b.wipers);
    setLit('radio', S.radio);
    document.body.classList.toggle('radio-on', S.radio);
    // the steering wheel sways a little as we drive
    const deg = Math.round(Math.sin(S.t * 1.6) * 9 * Math.min(1, Math.abs(b.v) / 100) * 2) / 2;
    if (deg !== wheelDeg) { wheelDeg = deg; wheelEl.style.transform = 'rotate(' + deg + 'deg)'; }
  }
  const wheelEl = $('wheel');
  let wheelDeg = 0;

  // ---------- drawing ----------
  let W = 0, H = 0, DPR = 1, K = 1, VW = 760, VH = 420;
  function resize() {
    const r = view.getBoundingClientRect();
    W = Math.max(1, r.width); H = Math.max(1, r.height);
    DPR = Math.min(2, window.devicePixelRatio || 1);
    cv.width = Math.round(W * DPR); cv.height = Math.round(H * DPR);
    K = Math.min(H / 420, W / (H > W ? 620 : 700));
    VW = W / K; VH = H / K;
  }
  new ResizeObserver(resize).observe(view);
  resize();

  function draw() {
    const b = S.bus;
    const busX = Math.max(24, Math.min(280, VW * 0.2 - 60));
    const V = { W: VW, H: VH, cam: b.x - busX, busX, t: S.t };
    cx.setTransform(DPR * K, 0, 0, DPR * K, 0, 0);
    Scene.draw(cx, S, V);
    cx.setTransform(DPR, 0, 0, DPR, 0, 0);
    hud(V);
  }

  function pill(x, y, text, u, bg) {
    cx.font = '700 ' + Math.round(19 * u) + 'px Fredoka, sans-serif';
    const w = cx.measureText(text).width + 22 * u, h = 34 * u;
    cx.fillStyle = bg || 'rgba(17,24,39,.55)'; Scene.rr(cx, x, y, w, h, h / 2); cx.fill();
    cx.fillStyle = '#fff'; cx.textAlign = 'left'; cx.textBaseline = 'middle';
    cx.fillText(text, x + 11 * u, y + h / 2 + 1);
    return w;
  }
  function hud(V) {
    const u = Math.max(0.7, Math.min(1.3, Math.min(W / 760, H / 300)));
    cx.textBaseline = 'middle';
    // counters
    const x0 = 10 * u, y0 = 10 * u;
    const w1 = pill(x0, y0, '🧒 ' + S.onBus.length, u);
    const w2 = pill(x0 + w1 + 8 * u, y0, '⭐ ' + me.stars, u);
    pill(x0 + w1 + w2 + 16 * u, y0, profile.name, u, profile.color);
    // route progress: stops, the school, and where the bus is
    const r = S.route;
    if (r && S.mode === 'play') {
      const pw = Math.min(W * 0.36, 300 * u), px = (W - pw) / 2, py = 27 * u, span = r.school.x - r.startX;
      cx.fillStyle = 'rgba(17,24,39,.4)'; Scene.rr(cx, px - 16 * u, py - 15 * u, pw + 44 * u, 30 * u, 15 * u); cx.fill();
      cx.fillStyle = 'rgba(255,255,255,.75)'; cx.fillRect(px, py - 2 * u, pw, 4 * u);
      for (const s of r.stops) {
        if (s.school) continue;
        cx.fillStyle = s.kids.length ? '#facc15' : '#22c55e';
        cx.beginPath(); cx.arc(px + (s.x - r.startX) / span * pw, py, 7 * u, 0, TAU); cx.fill();
      }
      cx.font = Math.round(20 * u) + 'px sans-serif'; cx.textAlign = 'center';
      cx.fillText('🏫', px + pw + 8 * u, py + 1);
      const f = Math.max(0, Math.min(1, (S.bus.x + BUS.door - r.startX) / span));
      cx.fillStyle = BUS_COLORS[S.color]; cx.strokeStyle = '#1f2937'; cx.lineWidth = 2;
      Scene.rr(cx, px + f * pw - 11 * u, py - 8 * u, 22 * u, 13 * u, 3 * u); cx.fill(); cx.stroke();
      cx.fillStyle = '#1f2937';
      cx.beginPath(); cx.arc(px + f * pw - 5 * u, py + 6 * u, 3 * u, 0, TAU); cx.arc(px + f * pw + 6 * u, py + 6 * u, 3 * u, 0, TAU); cx.fill();
    }
    // arrow to the next stop when it's off screen
    if (S.mode === 'play') {
      const g = goal(S.bus.x + BUS.door);
      if (g) {
        const sx = (g.x - V.cam) * K, y = H * 0.45, right = sx > W + 10;
        if (right || sx < -10) {
          const ax = right ? W - 34 * u : 34 * u, bob = Math.sin(S.t * 5) * 5 * u * (right ? 1 : -1);
          cx.fillStyle = g.school ? '#60a5fa' : '#facc15'; cx.strokeStyle = '#1f2937'; cx.lineWidth = 3;
          cx.beginPath(); cx.arc(ax + bob, y, 24 * u, 0, TAU); cx.fill(); cx.stroke();
          cx.fillStyle = '#1f2937'; cx.font = '700 ' + Math.round(24 * u) + 'px Fredoka, sans-serif'; cx.textAlign = 'center';
          cx.fillText(right ? '➜' : '⬅', ax + bob, y + 1);
          cx.font = Math.round(22 * u) + 'px sans-serif';
          cx.fillText(g.school ? '🏫' : '🚏', ax + bob + (right ? -46 : 46) * u, y + 1);
        }
      }
    }
    // message
    const m = S.toast;
    if (m) {
      const a = Math.min(1, m.t / 0.2, (m.dur - m.t) / 0.3);
      let fs = Math.round(21 * u);
      cx.font = '700 ' + fs + 'px Fredoka, sans-serif';
      let tw = cx.measureText(m.text).width;
      if (tw > W - 60) { fs = Math.floor(fs * (W - 60) / tw); cx.font = '700 ' + fs + 'px Fredoka, sans-serif'; tw = cx.measureText(m.text).width; }
      const bw = tw + 36 * u, bh = fs + 22 * u, bx = (W - bw) / 2, by = 54 * u + (1 - a) * -10;
      cx.globalAlpha = Math.max(0, a);
      cx.fillStyle = 'rgba(0,0,0,.2)'; Scene.rr(cx, bx, by + 4, bw, bh, bh / 2); cx.fill();
      cx.fillStyle = '#fff'; Scene.rr(cx, bx, by, bw, bh, bh / 2); cx.fill();
      cx.fillStyle = '#1f2937'; cx.textAlign = 'center'; cx.fillText(m.text, W / 2, by + bh / 2 + 1);
      cx.globalAlpha = 1;
    }
    for (const p of S.confetti) {
      cx.save(); cx.translate(p.x, p.y); cx.rotate(p.r); cx.fillStyle = p.col; cx.fillRect(-5, -3, 10, 6); cx.restore();
    }
  }

  // ---------- main loop ----------
  newRoute();
  let last = performance.now();
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    S.t += dt;
    if (S.mode === 'class') { Sound.rainLevel(0); requestAnimationFrame(frame); return; } // the school screen covers the road
    if (S.mode === 'play') update(dt);
    else { for (const s of S.stops) s.pending = isPending(s); updateKids(dt, S.bus.x + BUS.door); }
    syncButtons();
    draw();
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
})();
