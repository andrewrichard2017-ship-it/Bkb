// Controller support (Gamepad API), up to two pads. Built around a DualSense / DualShock on
// Android Chrome, which reports the standard layout; any standard-mapping pad works the same way.
//
//   Left stick / D-pad  move            L1  clinch                  L2  sway / duck / combo
//   Cross  jab                          R1 (hold)  body shot        R2 (hold)  block
//   Circle cross                        R3  super punch
//   Square hook                         Options  pause menu        Share  skip replay / walkout
//   Triangle uppercut
//   Menus: D-pad / stick moves a cursor over the buttons, Cross selects, Circle goes back.
//          Title shortcuts: L1 / R1 cycle the red / blue fighter, Triangle = tournament.
//
// Who drives what: one player -> any pad is player 1. Two players -> with two pads, the first is
// the red corner and the second the blue; with one pad, the pad takes the blue corner and the
// touch screen / keyboard the red.
(() => {
  'use strict';
  const BK = window.BK;
  const B = { cross: 0, circle: 1, square: 2, triangle: 3, l1: 4, r1: 5, l2: 6, r2: 7, share: 8, options: 9, l3: 10, r3: 11, up: 12, down: 13, left: 14, right: 15 };
  const NAMES = Object.fromEntries(Object.entries(B).map(([k, v]) => [v, k]));
  const DEAD = 0.22;

  const GP = BK.pad = { count: 0, connected: false, toast: 0, toastText: '', lastUse: -99, pads: [] };
  const blank = () => ({ held: {}, pressed: {}, mx: 0, my: 0, prev: [], raw: null });

  function livePads() {
    const out = [];
    try {
      const pads = navigator.getGamepads ? navigator.getGamepads() : [];
      for (const p of pads) if (p && p.connected) out.push(p);
    } catch (e) { /* no gamepad support */ }
    return out.slice(0, 2);
  }
  const toast = text => { GP.toast = 3.5; GP.toastText = text; };
  window.addEventListener('gamepadconnected', () => { BK.audio.init(); });

  // Which pad slot drives a given side (0 = red, 1 = blue)? -1 = none.
  GP.slotFor = side => {
    const two = BK.game && BK.game.twoPlayer;
    if (!two) return side === 0 && GP.count > 0 ? 0 : -1;
    if (GP.count >= 2) return side;
    if (GP.count === 1) return side === 1 ? 0 : -1;
    return -1;
  };

  // Called once per frame before input is read. Turns button presses into edge events per pad.
  GP.update = (dt, t) => {
    GP.toast = Math.max(0, GP.toast - dt);
    const live = livePads();
    if (live.length !== GP.count) {
      toast(live.length > GP.count ? `🎮  CONTROLLER ${live.length} CONNECTED` : live.length ? 'CONTROLLER DISCONNECTED  ·  1 LEFT' : 'CONTROLLER DISCONNECTED');
      GP.count = live.length; GP.connected = live.length > 0;
      GP.pads = live.map((_, i) => GP.pads[i] || blank());
    }
    live.forEach((p, i) => {
      const s = GP.pads[i]; s.raw = p;
      const pressed = {}, held = {};
      p.buttons.forEach((b, j) => {
        const on = b.pressed || b.value > 0.5, name = NAMES[j];
        if (!name) return;
        held[name] = on;
        if (on && !s.prev[j]) pressed[name] = true;
        s.prev[j] = on;
      });
      let mx = p.axes[0] || 0, my = p.axes[1] || 0;
      if (Math.hypot(mx, my) < DEAD) mx = my = 0;
      if (held.left) mx -= 1; if (held.right) mx += 1; if (held.up) my -= 1; if (held.down) my += 1;
      const m = Math.hypot(mx, my); if (m > 1) { mx /= m; my /= m; }
      s.mx = mx; s.my = my; s.held = held;
      // stick flicks count as D-pad presses in menus
      const fx = mx > 0.6 ? 1 : mx < -0.6 ? -1 : 0, fy = my > 0.6 ? 1 : my < -0.6 ? -1 : 0;
      if (fx && fx !== s.flickX) pressed[fx > 0 ? 'right' : 'left'] = true;
      if (fy && fy !== s.flickY) pressed[fy > 0 ? 'down' : 'up'] = true;
      s.flickX = fx; s.flickY = fy;
      s.pressed = Object.assign(s.pressed, pressed); // edges accumulate until the fight input reads them
      if (m > 0 || Object.keys(pressed).length) GP.lastUse = t;
      GP.menu(pressed, i);
    });
  };

  // Fight input for the pad driving a side (edges are consumed here).
  GP.fight = side => {
    const slot = GP.slotFor(side), s = GP.pads[slot];
    if (slot < 0 || !s) return null;
    const h = s.held, e = s.pressed;
    const inp = { mx: s.mx, my: s.my, block: !!h.r2, body: !!h.r1 };
    if (e.cross) inp.jab = true;
    if (e.circle) inp.cross = true;
    if (e.square) inp.hook = true;
    if (e.triangle) inp.upper = true;
    if (e.l2) inp.slip = true;
    if (e.l1) inp.clinch = true;
    if (e.r3) inp.ko = true;
    s.pressed = {};
    return inp;
  };

  // Everything outside the fight itself goes through the same handlers the keyboard uses.
  GP.menu = (e, slot) => {
    const g = BK.game;
    if (!g) return;
    const two = g.twoPlayer, mySide = two ? (GP.count >= 2 ? slot : 1) : 0;
    const any = e.cross || e.circle || e.square || e.triangle || e.options || e.share;
    if (BK.replay.active || g.state === 'walkout' || g.state === 'aftermath') { if (any) g.onKey('enter'); return; }
    if (e.options) { // pause menu (in a fight), or closes the controls screen elsewhere
      if (g.paused || ['fight', 'knockdown', 'roundIntro'].includes(g.state)) g.togglePause();
      else if (g.showControls) g.showControls = false;
      return;
    }
    if (g.state === 'knockdown' && !g.paused) { if (e.cross && g.kd && g.kd.victim.side === mySide) BK.getup.tap(0, 0, true); return; }
    if (g.state === 'fight' && !g.paused) return; // handled by GP.fight
    if (g.state === 'cornerGame' && two && BK.corner.fighter && BK.corner.fighter.side !== mySide) return; // not your corner
    // every other screen: cursor over the buttons
    if (e.up) BK.ui.nav(0, -1);
    if (e.down) BK.ui.nav(0, 1);
    if (e.left) BK.ui.nav(-1, 0);
    if (e.right) BK.ui.nav(1, 0);
    if (e.cross) { if (!BK.ui.activate()) g.onKey('enter'); }
    if (e.circle) { // back
      if (g.showControls) g.showControls = false;
      else if (g.paused) g.resume();
      else if (g.state === 'corner') g.nextRound();
      else if (g.state === 'tape' || g.state === 'ladder') g.toTitle();
    }
    if (g.state === 'title' && !g.showControls) { // shortcuts
      if (e.l1 || e.r1) g.cycleFighter(e.l1 ? 'player' : 'cpu');
      if (e.triangle) g.startTournament();
    }
  };

  // Rumble the pad driving a side (DualSense on Chrome supports dual-rumble).
  GP.rumble = (pattern, side = 0) => {
    const slot = GP.slotFor(side), s = GP.pads[slot];
    const p = s && s.raw;
    if (!p || !p.vibrationActuator || !BK.settings.vibrate) return;
    const ms = Array.isArray(pattern) ? pattern.reduce((a, b) => a + b, 0) : pattern;
    try { p.vibrationActuator.playEffect('dual-rumble', { duration: Math.min(400, ms), strongMagnitude: Math.min(1, ms / 120), weakMagnitude: Math.min(1, ms / 60) }).catch(() => {}); } catch (e) { /* unsupported */ }
  };
  // Is a pad driving the red corner and in recent use? (hides the touch buttons)
  GP.active = t => GP.slotFor(0) >= 0 && t - GP.lastUse < 4;
})();
