// Road Rumble: controls. any standard pad, keyboard (one or two players) and touch.
//
//   PS5 pad:  R2 / ✕  throttle        L2  brake               left stick / D-pad  steer
//             □  hit left             ○  hit right            △  kick (towards the nearest rider)
//             R1 nitro                L1 look behind          R3 / touchpad  change camera
//             D-pad ↑ (or L3) Turbo Blaze special      D-pad ↓  Frenzy special      right stick  swing the camera round
//             Options  pause          menus: D-pad / stick to move, ✕ select, ○ back, L1/R1 change
(() => {
  'use strict';
  const RR = window.RR, { clamp } = RR.math;
  const B = { cross: 0, circle: 1, square: 2, triangle: 3, l1: 4, r1: 5, l2: 6, r2: 7, share: 8, options: 9, l3: 10, r3: 11, up: 12, down: 13, left: 14, right: 15, ps: 16, pad: 17 };
  const NAMES = Object.fromEntries(Object.entries(B).map(([k, v]) => [v, k]));
  const DEAD = 0.18;
  const blankPlayer = () => ({ throttle: 0, brake: 0, steer: 0, atkL: false, atkR: false, kick: false, kickSide: 0, nitro: false, look: false, cam: false, mash: false, pause: false, turbo: false, frenzy: false, camX: 0, camY: 0 });

  const IN = RR.input = {
    pads: [], padCount: 0, players: [blankPlayer(), blankPlayer()], menu: [], twoLocal: false,
    lastPadUse: -99, lastKeyUse: -99, lastTouchUse: -99, toast: null,
    keys: new Set(), pressedKeys: new Set(),
  };

  // ---- keyboard ----
  addEventListener('keydown', e => {
    if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
    if (!e.repeat) IN.pressedKeys.add(e.code);
    IN.keys.add(e.code); IN.lastKeyUse = performance.now() / 1000;
    if (/^(Arrow|Space)/.test(e.code)) e.preventDefault();
    RR.audio.init();
  });
  addEventListener('keyup', e => IN.keys.delete(e.code));
  addEventListener('blur', () => IN.keys.clear());
  const K = c => IN.keys.has(c), P = c => IN.pressedKeys.has(c);
  const anyK = (...c) => c.some(K), anyP = (...c) => c.some(P);
  const SCHEMES = {
    all: { up: ['KeyW', 'ArrowUp'], down: ['KeyS', 'ArrowDown'], left: ['KeyA', 'ArrowLeft'], right: ['KeyD', 'ArrowRight'], l: ['KeyJ', 'KeyZ', 'KeyF'], r: ['KeyK', 'KeyX', 'KeyG'], kick: ['KeyL', 'KeyC', 'KeyH'], nitro: ['Space', 'KeyN'], look: ['KeyB'], cam: ['KeyV'], turbo: ['KeyT'], frenzy: ['KeyR'] },
    wasd: { up: ['KeyW'], down: ['KeyS'], left: ['KeyA'], right: ['KeyD'], l: ['KeyF'], r: ['KeyG'], kick: ['KeyH'], nitro: ['KeyQ'], look: ['KeyE'], cam: ['KeyV'], turbo: ['Digit1'], frenzy: ['Digit2'] },
    arrows: { up: ['ArrowUp'], down: ['ArrowDown'], left: ['ArrowLeft'], right: ['ArrowRight'], l: ['Comma', 'Numpad1'], r: ['Period', 'Numpad2'], kick: ['Slash', 'Numpad3'], nitro: ['ShiftRight', 'Numpad0'], look: ['Numpad5', 'ControlRight'], cam: ['Numpad9'], turbo: ['Numpad7', 'Home'], frenzy: ['Numpad8', 'End'] },
  };
  function readKeys(sc, out) {
    const S = SCHEMES[sc];
    if (anyK(...S.up)) out.throttle = 1;
    if (anyK(...S.down)) out.brake = 1;
    if (anyK(...S.left)) out.steer -= 1;
    if (anyK(...S.right)) out.steer += 1;
    if (anyP(...S.l)) out.atkL = true;
    if (anyP(...S.r)) out.atkR = true;
    if (anyP(...S.kick)) out.kick = true;
    if (anyK(...S.nitro)) out.nitro = true;
    if (anyK(...S.look)) out.look = true;
    if (anyP(...S.cam)) out.cam = true;
    if (anyP(...S.up, ...S.l, ...S.r)) out.mash = true;
    if (anyP(...S.turbo)) out.turbo = true;
    if (anyP(...S.frenzy)) out.frenzy = true;
  }

  // ---- gamepads ----
  function livePads() {
    const out = [];
    try { for (const p of (navigator.getGamepads ? navigator.getGamepads() : [])) if (p && p.connected) out.push(p); } catch (e) { /* none */ }
    return out.slice(0, 4);
  }
  addEventListener('gamepadconnected', () => RR.audio.init());
  function updatePads(t) {
    const live = livePads();
    if (live.length !== IN.padCount) {
      IN.toast = live.length > IN.padCount ? `🎮 Controller ${live.length} connected` : live.length ? 'Controller disconnected' : 'Controller disconnected';
      IN.padCount = live.length;
    }
    IN.pads = live.map((p, i) => {
      const s = IN.pads[i] && IN.pads[i].index === p.index ? IN.pads[i] : { index: p.index, prev: [], held: {}, pressed: {}, flickX: 0, flickY: 0 };
      s.raw = p; s.pressed = {};
      p.buttons.forEach((b, j) => {
        const name = NAMES[j]; if (!name) return;
        const on = b.pressed || b.value > 0.4;
        s.held[name] = on; s[name + 'V'] = b.value;
        if (on && !s.prev[j]) s.pressed[name] = true;
        s.prev[j] = on;
      });
      s.bp = Object.assign({}, s.pressed); // real button presses (not stick flicks)
      let x = p.axes[0] || 0, y = p.axes[1] || 0;
      if (Math.hypot(x, y) < DEAD) x = y = 0;
      s.x = x; s.y = y;
      let rx = p.axes[2] || 0, ry = p.axes[3] || 0;
      if (Math.hypot(rx, ry) < 0.2) rx = ry = 0;
      s.rx = rx; s.ry = ry;
      const fx = x > 0.6 ? 1 : x < -0.6 ? -1 : 0, fy = y > 0.6 ? 1 : y < -0.6 ? -1 : 0;
      if (fx && fx !== s.flickX) s.pressed[fx > 0 ? 'right' : 'left'] = true;
      if (fy && fy !== s.flickY) s.pressed[fy > 0 ? 'down' : 'up'] = true;
      s.flickX = fx; s.flickY = fy;
      if (Object.keys(s.pressed).length || Math.abs(x) > 0.3 || s.held.r2) IN.lastPadUse = t;
      return s;
    });
  }
  function readPad(s, out) {
    const h = s.held, e = s.pressed;
    let st = s.x; if (h.left) st = -1; if (h.right) st = 1;
    out.steer += st;
    out.throttle = Math.max(out.throttle, h.r2 ? Math.max(0.35, s.r2V || 1) : 0, h.cross ? 1 : 0);
    out.brake = Math.max(out.brake, h.l2 ? Math.max(0.35, s.l2V || 1) : 0, s.y > 0.7 && !h.r2 && !h.cross ? 0.6 : 0);
    if (e.square) out.atkL = true;
    if (e.circle) out.atkR = true;
    if (e.triangle) { out.kick = true; out.kickSide = Math.abs(s.x) > 0.5 ? Math.sign(s.x) : 0; }
    if (h.r1) out.nitro = true;
    if (h.l1) out.look = true;
    if (e.r3 || e.pad) out.cam = true;
    if (e.cross || e.r2 || e.square || e.circle) out.mash = true;
    if (e.options) out.pause = true;
    if (s.bp.up || s.bp.l3) out.turbo = true;
    if (s.bp.down) out.frenzy = true;
    if (Math.abs(s.rx) > Math.abs(out.camX)) out.camX = s.rx;
    if (Math.abs(s.ry) > Math.abs(out.camY)) out.camY = s.ry;
  }

  // ---- touch (auto-throttle; drag the left half to steer, buttons on the right) ----
  const touch = { steer: 0, brake: false, l: false, r: false, kick: false, nitro: false, id: null, x0: 0, enabled: false };
  IN.touch = touch;
  function buildTouch() {
    const el = document.getElementById('touch');
    if (!el) return;
    const zone = el.querySelector('.steer');
    zone.addEventListener('pointerdown', e => { touch.id = e.pointerId; touch.x0 = e.clientX; zone.setPointerCapture(e.pointerId); IN.lastTouchUse = performance.now() / 1000; RR.audio.init(); });
    zone.addEventListener('pointermove', e => { if (e.pointerId === touch.id) touch.steer = clamp((e.clientX - touch.x0) / 70, -1, 1); });
    const up = e => { if (e.pointerId === touch.id) { touch.id = null; touch.steer = 0; } };
    zone.addEventListener('pointerup', up); zone.addEventListener('pointercancel', up);
    el.querySelectorAll('[data-k]').forEach(b => {
      const k = b.dataset.k;
      b.addEventListener('pointerdown', e => { e.preventDefault(); touch[k] = k === 'brake' || k === 'nitro' ? true : 'press'; b.classList.add('on'); IN.lastTouchUse = performance.now() / 1000; RR.audio.init(); });
      const rel = () => { if (k === 'brake' || k === 'nitro') touch[k] = false; b.classList.remove('on'); };
      b.addEventListener('pointerup', rel); b.addEventListener('pointercancel', rel); b.addEventListener('pointerleave', rel);
    });
  }
  function readTouch(out) {
    out.steer += touch.steer;
    out.throttle = Math.max(out.throttle, touch.brake ? 0 : 1);
    if (touch.brake) out.brake = 1;
    if (touch.l === 'press') { out.atkL = true; out.mash = true; touch.l = false; }
    if (touch.r === 'press') { out.atkR = true; out.mash = true; touch.r = false; }
    if (touch.kick === 'press') { out.kick = true; touch.kick = false; }
    if (touch.nitro) out.nitro = true;
    if (touch.turbo === 'press') { out.turbo = true; touch.turbo = false; }
    if (touch.frenzy === 'press') { out.frenzy = true; touch.frenzy = false; }
  }

  // ---- per frame ----
  IN.update = (t, ctx = {}) => {
    updatePads(t);
    const two = IN.twoLocal = !!ctx.twoLocal;
    const [p0, p1] = IN.players = [blankPlayer(), blankPlayer()];
    const pads = IN.pads;
    if (!two) {
      pads.forEach(s => readPad(s, p0));
      readKeys('all', p0);
      if (touch.enabled) readTouch(p0);
    } else {
      if (pads[0]) readPad(pads[0], p0);
      if (pads[1]) readPad(pads[1], p1);
      if (pads.length >= 2) readKeys('all', p0);
      else if (pads.length === 1) readKeys('all', p1);
      else { readKeys('wasd', p0); readKeys('arrows', p1); }
      if (touch.enabled && !pads[0]) readTouch(p0);
    }
    for (const p of IN.players) { p.steer = clamp(p.steer, -1, 1); if (p.kick && !p.kickSide && p.steer) p.kickSide = 0; }
    if (P('Escape') || P('KeyP')) p0.pause = true;
    // menu events
    const m = IN.menu = [];
    const kbWho = two && pads.length === 1 ? 1 : 0;
    const add = (a, who) => m.push({ a, who });
    if (P('ArrowUp') || P('KeyW')) add('up', P('KeyW') && two && !pads.length ? 0 : kbWho);
    if (P('ArrowDown') || P('KeyS')) add('down', P('KeyS') && two && !pads.length ? 0 : kbWho);
    if (P('ArrowLeft') || P('KeyA')) add('left', P('KeyA') && two && !pads.length ? 0 : P('ArrowLeft') && two && !pads.length ? 1 : kbWho);
    if (P('ArrowRight') || P('KeyD')) add('right', P('KeyD') && two && !pads.length ? 0 : P('ArrowRight') && two && !pads.length ? 1 : kbWho);
    if (P('Enter') || P('NumpadEnter') || P('Space')) add('ok', kbWho);
    if (P('Escape') || P('Backspace')) add('back', kbWho);
    pads.forEach((s, i) => {
      const e = s.pressed, who = two ? i : 0;
      for (const d of ['up', 'down', 'left', 'right']) if (e[d]) add(d, who);
      if (e.cross) add('ok', who);
      if (e.circle) add('back', who);
      if (e.options) add('start', who);
      if (e.l1) add('l1', who);
      if (e.r1) add('r1', who);
      if (e.triangle) add('y', who);
      if (e.square) add('x', who);
    });
    IN.pressedKeys.clear();
  };
  // which device drives player i (for labels)
  IN.deviceFor = i => {
    const n = IN.padCount;
    if (!IN.twoLocal) return n ? 'pad' : RR.isTouch ? 'touch' : 'keys';
    if (n >= 2) return 'pad';
    if (n === 1) return i === 0 ? 'pad' : 'keys';
    return i === 0 ? 'keys-wasd' : 'keys-arrows';
  };
  IN.padActive = t => IN.padCount > 0 && t - IN.lastPadUse < 6;
  IN.rumble = (player, strong, weak, ms) => {
    if (!RR.settings.vibrate) return;
    const s = IN.twoLocal ? IN.pads[player] : IN.pads[0];
    const p = s && s.raw;
    if (p && p.vibrationActuator) {
      try { p.vibrationActuator.playEffect('dual-rumble', { duration: ms, strongMagnitude: clamp(strong, 0, 1), weakMagnitude: clamp(weak, 0, 1) }).catch(() => {}); } catch (e) { /* unsupported */ }
    } else if (touch.enabled && player === 0 && navigator.vibrate && strong > 0.5) { try { navigator.vibrate(Math.min(ms, 120)); } catch (e) { /* ignore */ } }
  };
  IN.init = buildTouch;
})();
