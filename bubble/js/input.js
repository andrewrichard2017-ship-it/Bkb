// Bubble Odyssey: controls. Touch (drag to aim, let go to shoot), mouse (point and click), keyboard (one
// player, or two sharing: WASD and the arrows) and gamepads (PS5 DualSense, Xbox or any standard pad).
//
//   Touch / mouse:  aim at where you want it to go, release to shoot. Tap the launcher or the next bubble to swap.
//   Keyboard:       ← → (or A D) aim, hold Shift to aim finely, ↑ / Space shoot, ↓ / X swap, 1-6 power-ups, Esc pause
//   Two players:    P1  A D aim, W shoot, S swap      P2  ← → aim, ↑ shoot, ↓ swap
//   Pad:            left stick / D-pad aim (right stick points straight at the angle), ✕ shoot, ○ swap,
//                   △ cycle the power-up for the next shot, L1 +5 shots, R1 Laser Sight, Options pause
(() => {
  'use strict';
  const BB = window.BB, { clamp } = BB.math;
  const B = { cross: 0, circle: 1, square: 2, triangle: 3, l1: 4, r1: 5, l2: 6, r2: 7, share: 8, options: 9, l3: 10, r3: 11, up: 12, down: 13, left: 14, right: 15 };
  const NAMES = Object.fromEntries(Object.entries(B).map(([k, v]) => [v, k]));
  const IN = BB.input = { pads: [], padCount: 0, menu: [], keys: new Set(), pressed: new Set(), ptrs: new Map(), toast: null, lastPad: -99 };

  addEventListener('keydown', e => {
    if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
    if (!e.repeat) IN.pressed.add(e.code);
    IN.keys.add(e.code);
    if (/^(Arrow|Space|Tab)/.test(e.code)) e.preventDefault();
    BB.audio.init();
  });
  addEventListener('keyup', e => IN.keys.delete(e.code));
  addEventListener('blur', () => IN.keys.clear());
  const K = c => IN.keys.has(c), Pr = c => IN.pressed.has(c);
  const SCHEMES = {
    all: { l: ['ArrowLeft', 'KeyA'], r: ['ArrowRight', 'KeyD'], fire: ['ArrowUp', 'KeyW', 'Space', 'Enter'], swap: ['ArrowDown', 'KeyS', 'KeyX', 'KeyC'] },
    wasd: { l: ['KeyA'], r: ['KeyD'], fire: ['KeyW', 'Space'], swap: ['KeyS'] },
    arrows: { l: ['ArrowLeft'], r: ['ArrowRight'], fire: ['ArrowUp', 'Enter', 'NumpadEnter'], swap: ['ArrowDown'] },
  };

  // ---- pads ----
  addEventListener('gamepadconnected', () => BB.audio.init());
  function livePads() { const out = []; try { for (const p of (navigator.getGamepads ? navigator.getGamepads() : [])) if (p && p.connected) out.push(p); } catch (e) { /* none */ } return out.slice(0, 4); }
  function updatePads(t) {
    const live = livePads();
    if (live.length !== IN.padCount) { IN.toast = live.length > IN.padCount ? `🎮 Controller ${live.length} connected` : 'Controller disconnected'; IN.padCount = live.length; }
    IN.pads = live.map((p, i) => {
      const s = IN.pads[i] && IN.pads[i].index === p.index ? IN.pads[i] : { index: p.index, prev: [], held: {}, flickX: 0, flickY: 0 };
      s.raw = p; s.pressed = {};
      p.buttons.forEach((b, j) => { const n = NAMES[j]; if (!n) return; const on = b.pressed || b.value > 0.4; s.held[n] = on; if (on && !s.prev[j]) s.pressed[n] = true; s.prev[j] = on; });
      let x = p.axes[0] || 0, y = p.axes[1] || 0; if (Math.hypot(x, y) < 0.2) x = y = 0; s.x = x; s.y = y;
      let rx = p.axes[2] || 0, ry = p.axes[3] || 0; if (Math.hypot(rx, ry) < 0.35) rx = ry = 0; s.rx = rx; s.ry = ry;
      s.menuP = Object.assign({}, s.pressed);
      const fx = x > 0.6 ? 1 : x < -0.6 ? -1 : 0, fy = y > 0.6 ? 1 : y < -0.6 ? -1 : 0;
      if (fx && fx !== s.flickX) s.menuP[fx > 0 ? 'right' : 'left'] = true;
      if (fy && fy !== s.flickY) s.menuP[fy > 0 ? 'down' : 'up'] = true;
      s.flickX = fx; s.flickY = fy;
      if (Object.keys(s.pressed).length || Math.abs(x) > 0.3) IN.lastPad = t;
      return s;
    });
  }

  // ---- pointer (touch and mouse) on the game canvas ----
  IN.init = canvas => {
    const local = () => { const G = BB.main, g = G.game; return g && !G.attract ? g.players.filter(p => !p.remote) : []; };
    const owner = (x) => { const ps = local(); if (ps.length < 2) return ps[0]; const b = BB.render.toBoard(x, 0).x; return b < BB.WIDTH / 2 ? ps[0] : ps[1]; };
    const aimAt = (p, x, y) => { const b = BB.render.toBoard(x, y); if (b.y > p.y - 0.4) return false; BB.main.aim(p, Math.atan2(p.y - b.y, b.x - p.x)); return true; };
    canvas.addEventListener('pointerdown', e => {
      BB.audio.init();
      if (BB.menu.active || !BB.main.game || BB.main.attract) return;
      e.preventDefault();
      const hit = BB.view.hits.find(h => e.clientX >= h.x && e.clientX <= h.x + h.w && e.clientY >= h.y && e.clientY <= h.y + h.h);
      if (hit) { IN.ptrs.set(e.pointerId, { button: hit.id }); BB.main.hudTap(hit.id); return; }
      const p = owner(e.clientX); if (!p) return;
      try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
      p.ctl = e.pointerType === 'mouse' ? 'mouse' : 'touch'; p.aiming = true;
      IN.ptrs.set(e.pointerId, { p, ok: aimAt(p, e.clientX, e.clientY) });
    });
    canvas.addEventListener('pointermove', e => {
      const g = BB.main.game; if (!g || BB.menu.active || BB.main.attract) return;
      const d = IN.ptrs.get(e.pointerId);
      if (d && d.p) { d.ok = aimAt(d.p, e.clientX, e.clientY); d.p.aiming = d.ok; return; }
      if (e.pointerType === 'mouse' && !d) { const p = owner(e.clientX); if (p) { p.ctl = 'mouse'; p.aiming = aimAt(p, e.clientX, e.clientY); } }
    });
    const up = (e, cancel) => {
      const d = IN.ptrs.get(e.pointerId); IN.ptrs.delete(e.pointerId);
      if (!d || !d.p) return;
      if (d.p.ctl === 'touch') d.p.aiming = false;
      if (!cancel && d.ok && aimAt(d.p, e.clientX, e.clientY)) BB.main.fire(d.p);
    };
    canvas.addEventListener('pointerup', e => up(e, false));
    canvas.addEventListener('pointercancel', e => up(e, true));
    canvas.addEventListener('contextmenu', e => e.preventDefault());
  };

  // ---- every frame ----
  IN.update = (t, dt) => {
    updatePads(t);
    const G = BB.main, g = G.game, playing = g && !G.attract && !BB.menu.active && !G.paused;
    const ps = playing ? g.players.filter(p => !p.remote) : [];
    const pads = IN.pads, two = ps.length > 1;
    const ctl = []; // [{ scheme | pad, p }]
    if (ps.length) {
      if (!two) { ctl.push({ scheme: 'all', p: ps[0] }); pads.forEach(s => ctl.push({ pad: s, p: ps[0] })); }
      else {
        pads.forEach((s, i) => { if (ps[i]) ctl.push({ pad: s, p: ps[i] }); });
        if (pads.length >= 2) ctl.push({ scheme: 'all', p: ps[0] });
        else if (pads.length === 1) ctl.push({ scheme: 'all', p: ps[1] });
        else { ctl.push({ scheme: 'wasd', p: ps[0] }); ctl.push({ scheme: 'arrows', p: ps[1] }); }
      }
    }
    for (const c of ctl) {
      const p = c.p;
      let turn = 0, fire = false, swap = false;
      if (c.scheme) {
        const S = SCHEMES[c.scheme];
        if (S.l.some(K)) turn += 1;
        if (S.r.some(K)) turn -= 1;
        if (S.fire.some(Pr)) fire = true;
        if (S.swap.some(Pr)) swap = true;
        if (turn) { p.ctl = 'keys'; p.aiming = true; }
        const fine = K('ShiftLeft') || K('ShiftRight');
        if (turn) { p.turnT = (p.turnT || 0) + dt; G.aim(p, p.angle + turn * dt * (fine ? 0.35 : Math.min(2.4, 0.9 + p.turnT * 2.2))); } else if (c.scheme !== 'all' || !(K('ArrowLeft') || K('ArrowRight') || K('KeyA') || K('KeyD'))) p.turnT = 0;
        if (!two) { const keys = ['Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5', 'Digit6']; keys.forEach((k, i) => { if (Pr(k)) G.hudTap('pw:' + BB.POWER_KEYS[i]); }); }
      } else {
        const s = c.pad, h = s.held, e = s.pressed;
        let ax = s.x; if (h.left) ax = -1; if (h.right) ax = 1;
        if (Math.abs(ax) > 0) { p.ctl = 'pad'; p.aiming = true; G.aim(p, p.angle - ax * Math.abs(ax) * dt * 2.2); }
        if (s.rx || s.ry) { if (s.ry < -0.2) { p.ctl = 'pad'; p.aiming = true; G.aim(p, Math.atan2(-s.ry, s.rx)); } }
        if (e.cross || e.r2) fire = true;
        if (e.circle || e.square) swap = true;
        if (!two) { if (e.triangle) G.cyclePower(); if (e.l1) G.hudTap('pw:plus5'); if (e.r1) G.hudTap('pw:aim'); }
      }
      if (swap) G.swap(p);
      if (fire) G.fire(p);
    }
    // pause
    const pausedNow = playing && (Pr('Escape') || Pr('KeyP') || pads.some(s => s.pressed.options));
    if (pausedNow) G.hudTap('pause');
    // menu events (not the key that just opened the pause menu, or it would close it again)
    const m = IN.menu = [];
    if (pausedNow) { IN.pressed.clear(); return; }
    const add = (a, who = 0) => m.push({ a, who });
    if (Pr('ArrowUp') || Pr('KeyW')) add('up'); if (Pr('ArrowDown') || Pr('KeyS')) add('down');
    if (Pr('ArrowLeft') || Pr('KeyA')) add('left'); if (Pr('ArrowRight') || Pr('KeyD')) add('right');
    if (Pr('Enter') || Pr('NumpadEnter') || Pr('Space')) add('ok');
    if (Pr('Escape') || Pr('Backspace')) add('back');
    pads.forEach((s, i) => { const e = s.menuP; for (const d of ['up', 'down', 'left', 'right']) if (e[d]) add(d, i); if (e.cross) add('ok', i); if (e.circle) add('back', i); if (e.options) add('start', i); if (e.l1) add('l1', i); if (e.r1) add('r1', i); });
    IN.pressed.clear();
  };
  IN.padActive = t => IN.padCount > 0 && t - IN.lastPad < 10;
  IN.rumble = (strong, weak, ms, who = 0) => {
    if (!BB.settings.vibrate) return;
    const s = IN.pads[who] || IN.pads[0], p = s && s.raw;
    if (p && p.vibrationActuator) { try { p.vibrationActuator.playEffect('dual-rumble', { duration: ms, strongMagnitude: clamp(strong, 0, 1), weakMagnitude: clamp(weak, 0, 1) }).catch(() => {}); } catch (e) { /* unsupported */ } }
    else if (BB.isTouch && navigator.vibrate && strong > 0.3) { try { navigator.vibrate(Math.min(ms, 80)); } catch (e) { /* ignore */ } }
  };
})();
