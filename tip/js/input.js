// Tractor Tippin': controls. PS5 DualSense / PS4 / any standard pad, keyboard (one or two players) and touch.
//
//   PS5 pad:  R2 (or stick up) drive     L2 (or stick down) brake / reverse     left stick / D-pad  steer
//             ✕  HONK (tip the tractor)  ○ or R1  boost (hold)                  □  handbrake slide (hold)
//             L1 look behind             △, R3 or touchpad  change camera       right stick  swing the camera round
//             Options  pause             menus: D-pad / stick to move, ✕ select, ○ back
(() => {
  'use strict';
  const TT = window.TT, { clamp } = TT.math;
  const B = { cross: 0, circle: 1, square: 2, triangle: 3, l1: 4, r1: 5, l2: 6, r2: 7, share: 8, options: 9, l3: 10, r3: 11, up: 12, down: 13, left: 14, right: 15, ps: 16, pad: 17 };
  const NAMES = Object.fromEntries(Object.entries(B).map(([k, v]) => [v, k]));
  const DEAD = 0.18;
  const blank = () => ({ throttle: 0, brake: 0, steer: 0, honk: false, boost: false, drift: false, look: false, cam: false, pause: false, camX: 0, camY: 0 });

  const IN = TT.input = {
    pads: [], padCount: 0, players: [blank(), blank()], menu: [], twoLocal: false,
    lastPadUse: -99, toast: null, keys: new Set(), pressedKeys: new Set(),
  };

  // ---- keyboard ----
  addEventListener('keydown', e => {
    if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
    if (!e.repeat) IN.pressedKeys.add(e.code);
    IN.keys.add(e.code);
    if (/^(Arrow|Space)/.test(e.code)) e.preventDefault();
    TT.audio.init();
  });
  addEventListener('keyup', e => IN.keys.delete(e.code));
  addEventListener('blur', () => IN.keys.clear());
  const K = c => IN.keys.has(c), P = c => IN.pressedKeys.has(c);
  const anyK = c => c.some(K), anyP = c => c.some(P);
  const SCHEMES = {
    all: { up: ['KeyW', 'ArrowUp'], down: ['KeyS', 'ArrowDown'], left: ['KeyA', 'ArrowLeft'], right: ['KeyD', 'ArrowRight'], honk: ['Space', 'KeyJ', 'KeyH'], boost: ['ShiftLeft', 'ShiftRight', 'KeyK'], drift: ['KeyL', 'ControlLeft'], look: ['KeyB'], cam: ['KeyC', 'KeyV'] },
    wasd: { up: ['KeyW'], down: ['KeyS'], left: ['KeyA'], right: ['KeyD'], honk: ['KeyF', 'Space'], boost: ['KeyG', 'ShiftLeft'], drift: ['KeyQ'], look: ['KeyE'], cam: ['KeyV'] },
    arrows: { up: ['ArrowUp'], down: ['ArrowDown'], left: ['ArrowLeft'], right: ['ArrowRight'], honk: ['Period', 'Numpad0', 'Numpad1'], boost: ['Slash', 'ShiftRight', 'Numpad2'], drift: ['Comma', 'Numpad3'], look: ['ControlRight', 'Numpad5'], cam: ['Semicolon', 'Numpad9'] },
  };
  function readKeys(sc, out) {
    const S = SCHEMES[sc];
    if (anyK(S.up)) out.throttle = 1;
    if (anyK(S.down)) out.brake = 1;
    if (anyK(S.left)) out.steer -= 1;
    if (anyK(S.right)) out.steer += 1;
    if (anyP(S.honk)) out.honk = true;
    if (anyK(S.boost)) out.boost = true;
    if (anyK(S.drift)) out.drift = true;
    if (anyK(S.look)) out.look = true;
    if (anyP(S.cam)) out.cam = true;
  }

  // ---- gamepads ----
  function livePads() {
    const out = [];
    try { for (const p of (navigator.getGamepads ? navigator.getGamepads() : [])) if (p && p.connected) out.push(p); } catch (e) { /* none */ }
    return out.slice(0, 4);
  }
  addEventListener('gamepadconnected', () => TT.audio.init());
  function updatePads(t) {
    const live = livePads();
    if (live.length !== IN.padCount) {
      IN.toast = live.length > IN.padCount ? `🎮 Controller ${live.length} connected` : 'Controller disconnected';
      IN.padCount = live.length;
    }
    IN.pads = live.map((p, i) => {
      const s = IN.pads[i] && IN.pads[i].index === p.index ? IN.pads[i] : { index: p.index, prev: [], held: {}, pressed: {}, flickX: 0, flickY: 0 };
      s.raw = p; s.pressed = {};
      p.buttons.forEach((b, j) => {
        const name = NAMES[j]; if (!name) return;
        const on = b.pressed || b.value > 0.3;
        s.held[name] = on; s[name + 'V'] = b.value;
        if (on && !s.prev[j]) s.pressed[name] = true;
        s.prev[j] = on;
      });
      s.bp = Object.assign({}, s.pressed);
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
    const h = s.held, e = s.bp;
    let st = s.x; if (h.left) st = -1; if (h.right) st = 1;
    out.steer += st;
    const stickUp = s.y < -0.55 || h.up, stickDown = s.y > 0.55 || h.down;
    out.throttle = Math.max(out.throttle, h.r2 ? Math.max(0.3, s.r2V || 1) : 0, stickUp ? 1 : 0);
    out.brake = Math.max(out.brake, h.l2 ? Math.max(0.3, s.l2V || 1) : 0, stickDown ? 1 : 0);
    if (e.cross) out.honk = true;
    if (h.circle || h.r1) out.boost = true;
    if (h.square) out.drift = true;
    if (h.l1) out.look = true;
    if (e.triangle || e.r3 || e.pad) out.cam = true;
    if (e.options) out.pause = true;
    if (Math.abs(s.rx) > Math.abs(out.camX)) out.camX = s.rx;
    if (Math.abs(s.ry) > Math.abs(out.camY)) out.camY = s.ry;
  }

  // ---- touch: drag the left half to steer; GAS / REVERSE / HONK / BOOST on the right ----
  const touch = { steer: 0, gas: false, rev: false, honk: false, boost: false, id: null, x0: 0, enabled: false };
  IN.touch = touch;
  function buildTouch() {
    const el = document.getElementById('touch');
    if (!el) return;
    const zone = el.querySelector('.steer'), knob = el.querySelector('.knob');
    zone.addEventListener('pointerdown', e => { touch.id = e.pointerId; touch.x0 = e.clientX; zone.setPointerCapture(e.pointerId); TT.audio.init(); if (knob) { knob.style.left = e.clientX + 'px'; knob.style.top = e.clientY + 'px'; knob.classList.add('on'); } });
    zone.addEventListener('pointermove', e => { if (e.pointerId === touch.id) { touch.steer = clamp((e.clientX - touch.x0) / 60, -1, 1); if (knob) knob.style.transform = `translate(-50%,-50%) translateX(${touch.steer * 40}px)`; } });
    const up = e => { if (e.pointerId === touch.id) { touch.id = null; touch.steer = 0; if (knob) { knob.classList.remove('on'); knob.style.transform = 'translate(-50%,-50%)'; } } };
    zone.addEventListener('pointerup', up); zone.addEventListener('pointercancel', up);
    el.querySelectorAll('[data-k]').forEach(b => {
      const k = b.dataset.k, held = k !== 'honk';
      b.addEventListener('pointerdown', e => { e.preventDefault(); touch[k] = held ? true : 'press'; b.classList.add('on'); TT.audio.init(); });
      const rel = () => { if (held) touch[k] = false; b.classList.remove('on'); };
      b.addEventListener('pointerup', rel); b.addEventListener('pointercancel', rel); b.addEventListener('pointerleave', rel);
    });
  }
  function readTouch(out) {
    out.steer += touch.steer;
    if (touch.gas) out.throttle = 1;
    if (touch.rev) out.brake = 1;
    if (touch.honk === 'press') { out.honk = true; touch.honk = false; }
    if (touch.boost) out.boost = true;
  }

  // ---- per frame ----
  IN.update = (t, ctx = {}) => {
    updatePads(t);
    const two = IN.twoLocal = !!ctx.twoLocal;
    const [p0, p1] = IN.players = [blank(), blank()];
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
    }
    for (const p of IN.players) p.steer = clamp(p.steer, -1, 1);
    if (P('Escape') || P('KeyP')) p0.pause = true;
    // menu events (who = which player, for two-player picking)
    const m = IN.menu = [];
    const kbWho = two && pads.length === 1 ? 1 : 0, split = two && !pads.length;
    const add = (a, who) => m.push({ a, who });
    if (P('ArrowUp') || P('KeyW')) add('up', split && P('KeyW') ? 0 : split ? 1 : kbWho);
    if (P('ArrowDown') || P('KeyS')) add('down', split && P('KeyS') ? 0 : split ? 1 : kbWho);
    if (P('KeyA')) add('left', split ? 0 : kbWho);
    if (P('KeyD')) add('right', split ? 0 : kbWho);
    if (P('ArrowLeft')) add('left', split ? 1 : kbWho);
    if (P('ArrowRight')) add('right', split ? 1 : kbWho);
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
    });
    IN.pressedKeys.clear();
  };
  IN.padActive = t => IN.padCount > 0 && t - IN.lastPadUse < 8;
  IN.rumble = (player, strong, weak, ms) => {
    if (!TT.settings.vibrate) return;
    const s = IN.twoLocal ? IN.pads[player] : IN.pads[0];
    const p = s && s.raw;
    if (p && p.vibrationActuator) {
      try { p.vibrationActuator.playEffect('dual-rumble', { duration: ms, strongMagnitude: clamp(strong, 0, 1), weakMagnitude: clamp(weak, 0, 1) }).catch(() => {}); } catch (e) { /* unsupported */ }
    } else if (touch.enabled && player === 0 && navigator.vibrate && strong > 0.5) { try { navigator.vibrate(Math.min(ms, 120)); } catch (e) { /* ignore */ } }
  };
  IN.init = buildTouch;
})();
