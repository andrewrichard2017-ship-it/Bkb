// Keyboard + multi-touch input. Touch layout: floating joystick on the left half,
// a 3x2 button cluster on the right (SLIP HOOK UPPER / BLOCK JAB CROSS).
(() => {
  'use strict';
  const BK = window.BK, ctx = BK.ctx, D = BK.draw;
  const { clamp } = BK;
  const IN = BK.input = { keys: {}, pressed: {}, stick: null, vec: { x: 0, y: 0 }, held: {}, pointers: new Map() };

  const KEYMAP = { j: 'jab', k: 'cross', u: 'hook', i: 'upper', o: 'ko', c: 'clinch', ' ': 'slip', shift: 'slip' };
  // BODY and BLOCK are held; the rest are taps.
  const BTNS = [
    { id: 'clinch', label: 'CLINCH', col: 0, row: 0, color: '#4f6b3a' },
    { id: 'slip', label: 'SLIP', col: 1, row: 0, color: BK.PAL.teal },
    { id: 'hook', label: 'HOOK', col: 2, row: 0, color: '#8a5a2b' },
    { id: 'upper', label: 'UPPER', col: 3, row: 0, color: '#8a5a2b' },
    { id: 'body', label: 'BODY', col: 0, row: 1, color: '#6a3f78', hold: true },
    { id: 'block', label: 'BLOCK', col: 1, row: 1, color: BK.PAL.navy, hold: true },
    { id: 'jab', label: 'JAB', col: 2, row: 1, color: '#9a6a34' },
    { id: 'cross', label: 'CROSS', col: 3, row: 1, color: BK.PAL.blood },
  ];

  IN.layout = () => {
    const sc = BK.screen, U = Math.min(sc.w, sc.h);
    const r = clamp(U * 0.08, 27, 50), gap = r * 2.25;
    const right = sc.w - sc.safe.r - 18 - r, bottom = sc.h - sc.safe.b - 16 - r;
    // buttons depend on the fighter: DUCK / SWAY / COMBO, no sway for Digger
    // (out on his feet everyone gets a plain SWAY: a drunken dodge)
    const me = BK.game.p1, L = me ? me.look : {}, rocked = !!(me && me.oof);
    const swayLabel = rocked ? 'SWAY' : L.sway === 'duck' ? 'DUCK' : L.sway === 'combo' ? 'COMBO' : 'SWAY';
    const buttons = BTNS
      .filter(b => !(b.id === 'slip' && L.sway === 'none' && !rocked) && !(b.id === 'clinch' && L.noClinch))
      .map(b => ({ ...b, label: b.id === 'slip' ? swayLabel : b.label, weak: b.id === 'slip' && L.sway === 'combo' && !rocked && me.stamina < 40, x: right - (3 - b.col) * gap, y: bottom - (1 - b.row) * gap * 0.95 }));
    if (BK.game.koReady()) buttons.push({ id: 'ko', label: L.super === 'duster' ? 'DUSTER' : 'SUPER', color: L.super === 'duster' ? '#8d8f96' : '#c98a1e', x: right - gap * 1.5, y: bottom - gap * 2.1, big: 1.3 });
    return {
      r,
      buttons,
      stickR: clamp(U * 0.12, 40, 80),
      stickHome: { x: sc.safe.l + 30 + clamp(U * 0.12, 40, 80) * 1.3, y: sc.h - sc.safe.b - 30 - clamp(U * 0.12, 40, 80) * 1.3 },
    };
  };

  window.addEventListener('keydown', e => {
    const k = e.key.toLowerCase();
    if (!IN.keys[k]) IN.pressed[k] = true;
    IN.keys[k] = true;
    if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(k)) e.preventDefault();
    if (!BK.game.controlsActive() && !e.repeat && BK.game.state !== 'knockdown' && !(BK.game.twoPlayer && BK.game.state === 'fight')) {
      const d = { arrowup: [0, -1], arrowdown: [0, 1], arrowleft: [-1, 0], arrowright: [1, 0] }[k];
      if (d) { BK.ui.nav(d[0], d[1]); return; }
      if (k === 'enter' && BK.ui.cursorOn && BK.ui.activate()) return;
    }
    BK.game.onKey(k);
  });
  window.addEventListener('keyup', e => { IN.keys[e.key.toLowerCase()] = false; });

  const canvas = BK.canvas;
  canvas.addEventListener('pointerdown', e => {
    e.preventDefault();
    BK.audio.init();
    const hud = BK.toHud(e.clientX, e.clientY);
    if (BK.game.onTap(hud.x, hud.y, e)) return; // menus, pause, get-up bar
    if (!BK.game.controlsActive()) return;
    try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* optional */ }
    const lay = IN.layout();
    for (const b of lay.buttons) {
      if (Math.hypot(e.clientX - b.x, e.clientY - b.y) < lay.r * 1.12 * (b.big || 1)) {
        IN.pointers.set(e.pointerId, { kind: 'btn', id: b.id });
        IN.held[b.id] = true;
        if (!b.hold) IN.pressed['btn_' + b.id] = true;
        return;
      }
    }
    if (e.clientX < BK.screen.w * 0.5) {
      IN.stick = { ox: e.clientX, oy: e.clientY };
      IN.pointers.set(e.pointerId, { kind: 'stick' });
    }
  });
  canvas.addEventListener('pointermove', e => {
    const p = IN.pointers.get(e.pointerId);
    if (!p || p.kind !== 'stick' || !IN.stick) return;
    const max = IN.layout().stickR;
    let dx = e.clientX - IN.stick.ox, dy = e.clientY - IN.stick.oy;
    const d = Math.hypot(dx, dy);
    if (d > max) { // origin follows the thumb
      IN.stick.ox += dx * (1 - max / d); IN.stick.oy += dy * (1 - max / d);
      dx = e.clientX - IN.stick.ox; dy = e.clientY - IN.stick.oy;
    }
    const dd = Math.hypot(dx, dy);
    IN.vec = dd < max * 0.15 ? { x: 0, y: 0 } : { x: dx / max, y: dy / max };
  });
  const release = e => {
    const p = IN.pointers.get(e.pointerId);
    if (!p) return;
    if (p.kind === 'stick') { IN.stick = null; IN.vec = { x: 0, y: 0 }; } else IN.held[p.id] = false;
    IN.pointers.delete(e.pointerId);
  };
  canvas.addEventListener('pointerup', release);
  canvas.addEventListener('pointercancel', release);
  canvas.addEventListener('contextmenu', e => e.preventDefault());

  IN.releaseAll = () => { IN.pointers.clear(); IN.stick = null; IN.vec = { x: 0, y: 0 }; IN.held = {}; IN.pressed = {}; };

  // Player 2 on the keyboard (two-player mode): arrows move, 1-4 jab/cross/hook/upper,
  // 5 sway, 6 clinch, hold 7 body, hold 8 block, 9 super.
  const KEYMAP2 = { 1: 'jab', 2: 'cross', 3: 'hook', 4: 'upper', 5: 'slip', 6: 'clinch', 9: 'ko' };
  IN.player2 = () => {
    const K = IN.keys;
    let mx = 0, my = 0;
    if (K.arrowleft) mx -= 1; if (K.arrowright) mx += 1; if (K.arrowup) my -= 1; if (K.arrowdown) my += 1;
    const inp = { mx, my, block: !!K['8'], body: !!K['7'] };
    for (const [key, act] of Object.entries(KEYMAP2)) if (IN.pressed[key]) { inp[act] = true; delete IN.pressed[key]; }
    const pd = BK.pad.fight(1);
    if (pd) {
      if (Math.hypot(pd.mx, pd.my) > 0) { inp.mx = pd.mx; inp.my = pd.my; }
      for (const k of ['jab', 'cross', 'hook', 'upper', 'slip', 'clinch', 'ko']) if (pd[k]) inp[k] = true;
      inp.block = inp.block || pd.block; inp.body = inp.body || pd.body;
    }
    return inp;
  };

  IN.player = () => {
    const K = IN.keys, two = BK.game.twoPlayer;
    let mx = IN.vec.x, my = IN.vec.y;
    if (K.a || (K.arrowleft && !two)) mx -= 1;
    if (K.d || (K.arrowright && !two)) mx += 1;
    if (K.w || (K.arrowup && !two)) my -= 1;
    if (K.s || (K.arrowdown && !two)) my += 1;
    const m = Math.hypot(mx, my); if (m > 1) { mx /= m; my /= m; }
    const inp = { mx, my, block: !!(K.l || IN.held.block), body: !!(K.b || IN.held.body) };
    for (const [key, act] of Object.entries(KEYMAP)) if (IN.pressed[key]) inp[act] = true;
    for (const b of BTNS) if (IN.pressed['btn_' + b.id]) inp[b.id] = true;
    if (IN.pressed.btn_ko) inp.ko = true;
    // consume our keys; in two-player leave player 2's (digits) for their reader
    if (two) { for (const k of Object.keys(IN.pressed)) if (!/^[0-9]$/.test(k)) delete IN.pressed[k]; } else IN.pressed = {};
    const pd = BK.pad.fight(0);
    if (pd) { // controller: merge sticks and buttons
      if (Math.hypot(pd.mx, pd.my) > 0) { mx = pd.mx; my = pd.my; }
      inp.mx = mx; inp.my = my;
      for (const k of ['jab', 'cross', 'hook', 'upper', 'slip', 'clinch', 'ko']) if (pd[k]) inp[k] = true;
      inp.block = inp.block || pd.block; inp.body = inp.body || pd.body;
    }
    return inp;
  };

  // Compact button legend while a controller is in use (screen space, bottom right).
  IN.drawPadHint = player => {
    const sc = BK.screen, L = player.look;
    const rows = [['✕ Jab', '○ Cross', '□ Hook', '△ Upper'], [L.noClinch ? 'L1 —' : 'L1 Clinch', 'R1 Body', `L2 ${L.sway === 'duck' ? 'Duck' : L.sway === 'combo' ? 'Combo' : L.sway === 'none' ? '—' : 'Sway'}`, 'R2 Block']];
    if (BK.game.koReady()) rows.push([`R3  ${BK.superName(L)}  ▶`]);
    ctx.save(); ctx.textAlign = 'right'; ctx.textBaseline = 'bottom'; ctx.globalAlpha = 0.75;
    let y = sc.h - sc.safe.b - 14;
    for (let i = rows.length - 1; i >= 0; i--) {
      ctx.font = BK.FONT.ui(i === 2 ? 22 : 15);
      ctx.fillStyle = i === 2 ? '#f0c75a' : BK.PAL.bone;
      ctx.fillText(rows[i].join('    '), sc.w - sc.safe.r - 18, y);
      y -= i === 2 ? 30 : 20;
    }
    ctx.restore();
  };

  IN.draw = (player) => {
    if (BK.pad.active(BK.game.t)) { IN.drawPadHint(player); return; } // controller in use: no touch buttons
    const lay = IN.layout();
    ctx.save();
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (const b of lay.buttons) {
      const down = IN.held[b.id];
      const cost = BK.PUNCHES[b.id] ? BK.PUNCHES[b.id].cost : 0;
      const weak = b.weak || (cost && player.stamina < cost * 1.5);
      ctx.globalAlpha = b.big ? 0.95 : down ? 0.95 : weak ? 0.3 : 0.62;
      const pulse = b.big ? 1 + Math.sin(performance.now() / 90) * 0.06 : 1;
      const rr = lay.r * (down ? 0.92 : 1) * (b.big || 1) * pulse;
      if (b.big) { // glow
        const gl = ctx.createRadialGradient(b.x, b.y, rr * 0.6, b.x, b.y, rr * 1.8);
        gl.addColorStop(0, 'rgba(255,200,90,0.55)'); gl.addColorStop(1, 'rgba(255,200,90,0)');
        ctx.fillStyle = gl; D.circle(b.x, b.y, rr * 1.8); ctx.fill();
      }
      const g = ctx.createRadialGradient(b.x - rr * 0.3, b.y - rr * 0.4, rr * 0.1, b.x, b.y, rr);
      g.addColorStop(0, BK.shade(b.color, 1.35)); g.addColorStop(1, b.color);
      D.circle(b.x, b.y, rr); ctx.fillStyle = g; ctx.fill();
      ctx.globalAlpha = 0.9; ctx.strokeStyle = BK.PAL.bone; ctx.lineWidth = 2; ctx.stroke();
      if (player.chainReady && BK.PUNCHES[b.id] && !b.big) { // next punch is ready: chain it
        ctx.globalAlpha = 0.9; ctx.strokeStyle = '#f0c75a'; ctx.lineWidth = 5;
        D.circle(b.x, b.y, rr + 5); ctx.stroke();
      }
      ctx.globalAlpha = 1;
      ctx.font = BK.FONT.display(Math.round(lay.r * (b.big ? 0.5 : b.label.length > 5 ? 0.32 : b.label.length > 4 ? 0.36 : 0.42)));
      ctx.fillStyle = BK.PAL.bone; ctx.fillText(b.label, b.x, b.y + 1);
    }
    const max = lay.stickR, st = IN.stick;
    const ox = st ? st.ox : lay.stickHome.x, oy = st ? st.oy : lay.stickHome.y;
    ctx.globalAlpha = st ? 0.55 : 0.28;
    ctx.strokeStyle = BK.PAL.bone; ctx.lineWidth = 3;
    D.circle(ox, oy, max); ctx.stroke();
    ctx.fillStyle = BK.PAL.bone;
    D.circle(ox + IN.vec.x * max, oy + IN.vec.y * max, max * 0.45); ctx.fill();
    if (!st) {
      ctx.globalAlpha = 0.6;
      ctx.font = BK.FONT.ui(15);
      ctx.fillText('DRAG TO MOVE', ox, oy - max - 16);
    }
    ctx.restore();
  };
})();
