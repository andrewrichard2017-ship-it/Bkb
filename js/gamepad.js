// Controller support (Gamepad API). Built around a DualSense / DualShock on Android Chrome,
// which reports the standard layout; any standard-mapping pad works the same way.
//
//   Left stick / D-pad  move            L1  sway / duck / combo     L2 (hold)  block
//   Cross  jab                          R1  clinch                  R2 (hold)  body shot
//   Circle cross                        R3 (or L1+R1)  super punch
//   Square hook                         Options  pause             Share  skip replay / walkout
//   Triangle uppercut
//   Menus: Cross confirm, Circle back/skip, D-pad left/right = your fighter, L1/R1 = CPU fighter,
//          Triangle = tournament. Corner: Cross / Circle / Square pick diesel / slaps / beer.
(() => {
  'use strict';
  const BK = window.BK;
  const B = { cross: 0, circle: 1, square: 2, triangle: 3, l1: 4, r1: 5, l2: 6, r2: 7, share: 8, options: 9, l3: 10, r3: 11, up: 12, down: 13, left: 14, right: 15 };
  const NAMES = Object.fromEntries(Object.entries(B).map(([k, v]) => [v, k]));
  const DEAD = 0.22;

  const GP = BK.pad = { connected: false, id: '', held: {}, pressed: {}, mx: 0, my: 0, toast: 0, lastUse: -99 };
  let prev = [];

  function first() {
    try {
      const pads = navigator.getGamepads ? navigator.getGamepads() : [];
      for (const p of pads) if (p && p.connected) return p;
    } catch (e) { /* no gamepad support */ }
    return null;
  }

  window.addEventListener('gamepadconnected', e => {
    GP.connected = true; GP.id = e.gamepad ? e.gamepad.id : ''; GP.toast = 3.5;
    BK.audio.init();
  });
  window.addEventListener('gamepaddisconnected', () => { GP.connected = false; GP.held = {}; GP.pressed = {}; GP.mx = GP.my = 0; GP.toast = 3.5; });

  // Called once per frame before input is read. Turns button presses into edge events.
  GP.update = (dt, t) => {
    GP.toast = Math.max(0, GP.toast - dt);
    const p = first();
    if (!p) { if (GP.connected) { GP.connected = false; GP.held = {}; } return; }
    if (!GP.connected) { GP.connected = true; GP.id = p.id; GP.toast = 3.5; }
    const pressed = {}, held = {};
    p.buttons.forEach((b, i) => {
      const on = b.pressed || b.value > 0.5, name = NAMES[i];
      if (!name) return;
      held[name] = on;
      if (on && !prev[i]) pressed[name] = true;
      prev[i] = on;
    });
    let mx = p.axes[0] || 0, my = p.axes[1] || 0;
    if (Math.hypot(mx, my) < DEAD) mx = my = 0;
    if (held.left) mx -= 1; if (held.right) mx += 1; if (held.up) my -= 1; if (held.down) my += 1;
    const m = Math.hypot(mx, my); if (m > 1) { mx /= m; my /= m; }
    GP.mx = mx; GP.my = my; GP.held = held; GP.pressed = pressed;
    if (m > 0 || Object.keys(pressed).length) GP.lastUse = t;
    // both bumpers together also fire the super punch
    if (pressed.l1 && held.r1 || pressed.r1 && held.l1) { pressed.r3 = true; delete pressed.l1; delete pressed.r1; }
    GP.menu(pressed);
  };

  // Fight input merged into the player's input each frame (edges are consumed here).
  GP.fight = () => {
    const h = GP.held, e = GP.pressed;
    const inp = { mx: GP.mx, my: GP.my, block: !!h.l2, body: !!h.r2 };
    if (e.cross) inp.jab = true;
    if (e.circle) inp.cross = true;
    if (e.square) inp.hook = true;
    if (e.triangle) inp.upper = true;
    if (e.l1) inp.slip = true;
    if (e.r1) inp.clinch = true;
    if (e.r3) inp.ko = true;
    GP.pressed = {};
    return inp;
  };

  // Everything outside the fight itself is driven through the same handlers the keyboard uses.
  GP.menu = e => {
    const g = BK.game;
    if (!g) return;
    const any = e.cross || e.circle || e.square || e.triangle || e.options || e.share;
    if (BK.replay.active || g.state === 'walkout') { if (any) g.onKey('enter'); return; }
    if (e.options) { g.onKey('escape'); return; }
    if (g.paused) { if (e.cross) g.onKey('enter'); return; }
    switch (g.state) {
      case 'title':
        if (e.left || e.right) g.cycleFighter('player');
        if (e.l1 || e.r1) g.cycleFighter('cpu');
        if (e.cross) g.toTape();
        if (e.triangle) g.startTournament();
        break;
      case 'knockdown':
        if (e.cross) BK.getup.tap(0, 0, true);
        break;
      case 'cornerGame':
        if (e.cross || e.up) BK.corner.key('1');
        if (e.circle || e.right) BK.corner.key('2');
        if (e.square || e.down) BK.corner.key('3');
        if (BK.corner.applied && (e.cross || e.options)) BK.corner.key('enter');
        break;
      case 'corner':
        if (e.cross) g.workCorner();
        if (e.circle) g.nextRound();
        break;
      case 'fight':
        break; // handled by GP.fight
      default:
        if (e.cross) g.onKey('enter');
    }
  };

  // Rumble through the controller (DualSense on Chrome supports dual-rumble).
  GP.rumble = pattern => {
    const p = first();
    if (!p || !p.vibrationActuator || !BK.settings.vibrate) return;
    const ms = Array.isArray(pattern) ? pattern.reduce((a, b) => a + b, 0) : pattern;
    try { p.vibrationActuator.playEffect('dual-rumble', { duration: Math.min(400, ms), strongMagnitude: Math.min(1, ms / 120), weakMagnitude: Math.min(1, ms / 60) }).catch(() => {}); } catch (e) { /* unsupported */ }
  };
  // Controller was used more recently than the touch screen?
  GP.active = t => GP.connected && t - GP.lastUse < 4;
})();
