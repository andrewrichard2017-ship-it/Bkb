// Bubble Odyssey: drawing a game. Fits the board to the screen (HUD bars above and below on phones held
// upright, side panels when there's room), then draws the frame, the bubbles, launchers and aim guides,
// shots in flight, the boss, the effects and the HUD. Also keeps the HUD's tap areas for input.js.
(() => {
  'use strict';
  const BB = window.BB, TAU = Math.PI * 2, { clamp } = BB.math;
  const { WIDTH, ROW_H, LINE_Y, LAUNCH_Y, BOARD_H, FEVER_MAX } = BB;
  const FONT = BB.FONT, S = BB.sprites, P = BB.SPRITE_PAD;
  const V = BB.view = { W: 0, H: 0, dpr: 1, s: 20, ox: 0, oy: 0, head: 0, mode: 'stack', hits: [], panels: {} };
  const R = BB.render = {};
  const POWER_KEYS = ['bomb', 'fire', 'rainbow', 'zap', 'aim', 'plus5'];
  const POWER_INFO = {
    bomb: { name: 'Bomb', price: 40, blurb: 'Blows up everything around where it lands.' },
    fire: { name: 'Fireball', price: 60, blurb: 'Burns straight through every bubble in its path.' },
    rainbow: { name: 'Rainbow', price: 45, blurb: 'Matches any colour it touches, two or more.' },
    zap: { name: 'Lightning', price: 50, blurb: 'Clears the row it hits and the row below it.' },
    aim: { name: 'Laser Sight', price: 30, blurb: 'Full aim line with a landing marker for 10 shots.' },
    plus5: { name: '+5 Shots', price: 35, blurb: 'Five extra shots, right now.' },
  };
  BB.POWER_KEYS = POWER_KEYS; BB.POWER_INFO = POWER_INFO;
  const ACCENT = { meadow: '#7fe05a', reef: '#3fe0ff', candy: '#ff7ac8', caves: '#a98bff', nebula: '#c77dff' };
  const PCOL = ['#ffd84a', '#4fe3ff'];
  let canvas, ctx;

  R.init = cv => { canvas = cv; ctx = cv.getContext('2d'); R.resize(); };
  R.resize = () => {
    V.W = innerWidth; V.H = innerHeight; V.dpr = Math.min(devicePixelRatio || 1, 2);
    canvas.width = Math.round(V.W * V.dpr); canvas.height = Math.round(V.H * V.dpr);
    BB.bg.resize(V.W, V.H, V.dpr);
    V.dirty = true;
  };
  R.ctx = () => ctx;

  // ---------------------------------------------------------------- layout
  R.layout = game => {
    const head = game && game.boss ? 6.6 : 1.1, powers = !!(game && game.mode !== 'versus' && !game.coop);
    const bw = WIDTH + 1.4, bh = BOARD_H + head + 0.5, pad = 8;
    const W = V.W, H = V.H;
    const sSide = (H - pad * 2) / bh, room = (W - bw * sSide) / 2;
    if (W > H * 1.1 && room >= 170) {
      V.mode = 'side'; V.s = sSide;
      const pw = Math.min(330, room - 22);
      V.panels = { left: { x: (W - bw * V.s) / 2 - pw - 12, y: pad, w: pw, h: H - pad * 2 }, right: { x: (W + bw * V.s) / 2 + 12, y: pad, w: pw, h: H - pad * 2 } };
      V.oy = (H - bh * V.s) / 2 + head * V.s;
    } else {
      V.mode = 'stack';
      const topH = 60, botH = powers ? 74 : 8;
      V.s = Math.min((W - pad * 2) / bw, (H - topH - botH - pad * 3) / bh);
      const used = bh * V.s, free = H - topH - botH - pad * 3 - used, top = topH + pad * 2 + free * 0.3;
      V.panels = { top: { x: pad, y: pad, w: W - pad * 2, h: topH }, bottom: powers ? { x: pad, y: Math.min(H - botH - pad, top + used + pad * 1.5), w: W - pad * 2, h: botH } : null };
      V.oy = top + head * V.s;
    }
    V.ox = (W - WIDTH * V.s) / 2; V.head = head; V.powers = powers;
    S.build(V.s * V.dpr, !!BB.settings.symbols);
    V.dirty = false; V.layoutFor = game;
  };
  // board units <-> screen (CSS px)
  R.toScreen = (x, y) => ({ x: V.ox + x * V.s, y: V.oy + y * V.s });
  R.toBoard = (sx, sy) => ({ x: (sx - V.ox) / V.s, y: (sy - V.oy) / V.s });
  const boardT = (shake = 0) => {
    const sx = shake ? (Math.random() - 0.5) * shake * 0.6 : 0, sy = shake ? (Math.random() - 0.5) * shake * 0.6 : 0;
    const k = V.s * V.dpr; ctx.setTransform(k, 0, 0, k, (V.ox + sx * V.s) * V.dpr, (V.oy + sy * V.s) * V.dpr);
  };
  const screenT = () => ctx.setTransform(V.dpr, 0, 0, V.dpr, 0, 0);

  function rr(c, x, y, w, h, r) { c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); }
  R.rr = rr;
  function glass(c, x, y, w, h, r, a = 0.55) {
    rr(c, x, y, w, h, r);
    const g = c.createLinearGradient(0, y, 0, y + h); g.addColorStop(0, `rgba(30,24,70,${a})`); g.addColorStop(1, `rgba(10,8,30,${a + 0.1})`);
    c.fillStyle = g; c.fill();
    c.strokeStyle = 'rgba(255,255,255,0.18)'; c.lineWidth = 1.5; c.stroke();
  }
  function txt(c, s, x, y, size, col = '#fff', align = 'left', weight = 700, stroke = true) {
    c.font = `${weight} ${size}px ${FONT}`; c.textAlign = align; c.textBaseline = 'middle';
    if (stroke) { c.lineJoin = 'round'; c.lineWidth = Math.max(2, size * 0.18); c.strokeStyle = 'rgba(15,5,35,0.8)'; c.strokeText(s, x, y); }
    c.fillStyle = col; c.fillText(s, x, y);
  }
  R.txt = txt;

  // ---------------------------------------------------------------- the frame
  R.frame = (game, fx, t, dt) => {
    screenT();
    ctx.clearRect(0, 0, V.W, V.H);
    BB.bg.draw(ctx, dt);
    if (!game) return;
    if (V.dirty || V.layoutFor !== game) R.layout(game);
    V.hits = [];
    const world = BB.WORLDS[game.spec.world] || BB.WORLDS[0], acc = ACCENT[world.id] || '#fff';
    boardT();
    drawFrame(game, acc);
    if (game.boss) drawBoss(game, t, world.boss);
    boardT(fx.shake);
    drawGrid(game, t);
    drawLine(game, t);
    for (const p of game.players) drawGuide(game, p, t);
    for (const p of game.players) drawLauncher(game, p, t, acc);
    drawShots(game, t);
    fx.draw(ctx, S, t);
    if (game.state === 'intro') drawIntro(game, t);
    screenT();
    if (fx.flash > 0) { ctx.fillStyle = `rgba(255,250,230,${fx.flash * 0.5})`; ctx.fillRect(0, 0, V.W, V.H); }
    drawHud(game, t);
    if (R.toast && R.toast.t > 0) drawToast(dt);
  };

  function drawFrame(game, acc) {
    const x0 = -0.7, y0 = -V.head, w = WIDTH + 1.4, h = BOARD_H + V.head + 0.4;
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.45)'; ctx.shadowBlur = 30 * V.dpr; ctx.shadowOffsetY = 6 * V.dpr;
    rr(ctx, x0, y0, w, h, 1.2);
    const g = ctx.createLinearGradient(0, y0, 0, y0 + h); g.addColorStop(0, 'rgba(12,10,40,0.62)'); g.addColorStop(1, 'rgba(6,6,22,0.72)');
    ctx.fillStyle = g; ctx.fill();
    ctx.restore();
    ctx.lineWidth = 0.12; ctx.strokeStyle = BB.rgba(acc, 0.55); rr(ctx, x0, y0, w, h, 1.2); ctx.stroke();
    ctx.lineWidth = 0.05; ctx.strokeStyle = 'rgba(255,255,255,0.25)'; rr(ctx, x0 + 0.18, y0 + 0.18, w - 0.36, h - 0.36, 1.0); ctx.stroke();
    // the ceiling everything hangs from
    const cg = ctx.createLinearGradient(0, -0.55, 0, 0.05); cg.addColorStop(0, BB.rgba(acc, 0.95)); cg.addColorStop(1, BB.rgba(acc, 0.35));
    ctx.fillStyle = cg; rr(ctx, -0.35, -0.5, WIDTH + 0.7, 0.5, 0.25); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.45)'; ctx.fillRect(-0.1, -0.42, WIDTH + 0.2, 0.08);
    // launcher deck
    const dg = ctx.createLinearGradient(0, LINE_Y, 0, BOARD_H + 0.4); dg.addColorStop(0, 'rgba(255,255,255,0.0)'); dg.addColorStop(1, BB.rgba(acc, 0.14));
    ctx.fillStyle = dg; ctx.fillRect(x0 + 0.2, LINE_Y, w - 0.4, BOARD_H + 0.2 - LINE_Y);
  }
  function drawGrid(game, t) {
    const b = game.board, off = game.pushAnim > 0 ? -ROW_H * game.pushAnim : 0, low = b.lowest();
    const danger = low >= b.limit - 2;
    for (let r = 0; r < b.rows.length; r++) {
      const row = b.rows[r], y = b.y(r) + off;
      const wob = danger && r >= low - 1 ? Math.sin(t * 30 + r) * 0.05 : 0;
      for (let c = 0; c < row.length; c++) {
        const v = row[c]; if (!v) continue;
        const x = b.x(r, c) + wob;
        if (v.k === BB.K.STAR) { const pulse = 1.15 + Math.sin(t * 4 + c) * 0.12; ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.55; ctx.drawImage(S.glows[2], x - P * pulse, y - P * pulse, P * 2 * pulse, P * 2 * pulse); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; }
        ctx.drawImage(S.forCell(v, t, r * 16 + c), x - P, y - P, P * 2, P * 2);
        if (v.k === BB.K.BOMB) spark(x + 0.42, y - 1.12, t + c);
      }
    }
  }
  function spark(x, y, t) {
    const f = 0.35 + Math.abs(Math.sin(t * 17)) * 0.3;
    ctx.globalCompositeOperation = 'lighter';
    ctx.drawImage(S.glows[5], x - f * 1.4, y - f * 1.4, f * 2.8, f * 2.8);
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = '#fffbe0'; ctx.beginPath(); ctx.arc(x, y, 0.12, 0, TAU); ctx.fill();
  }
  function drawLine(game, t) {
    const low = game.board.lowest(), lim = game.board.limit, near = clamp((low - (lim - 5)) / 4, 0, 1);
    ctx.save();
    ctx.setLineDash([0.5, 0.45]); ctx.lineDashOffset = -t * 1.2;
    ctx.lineWidth = 0.12 + near * 0.1;
    ctx.strokeStyle = near > 0.5 ? `rgba(255,70,90,${0.55 + 0.45 * Math.sin(t * 8)})` : `rgba(255,255,255,${0.22 + near * 0.4})`;
    ctx.beginPath(); ctx.moveTo(0.2, LINE_Y); ctx.lineTo(WIDTH - 0.2, LINE_Y); ctx.stroke();
    ctx.restore();
  }

  // dotted aim guide (longer with the Laser Sight)
  function drawGuide(game, p, t) {
    if (game.state !== 'play' && game.state !== 'intro') return;
    if (p.flying) return;
    const local = !p.remote, show = local ? p.aiming !== false : true;
    if (!show) return;
    const tr = BB.traceShot(game.board, p.x, p.y, p.angle);
    const full = local && (p.aimShots > 0 || BB.settings.guide === 'long');
    let maxD = full ? 999 : 24;
    if (!full) { let firstBounce = -1; for (let i = 1; i < tr.pts.length - 1; i++) { const a = tr.pts[i - 1], b = tr.pts[i], c2 = tr.pts[i + 1]; if ((b.x - a.x) * (c2.x - b.x) < 0) { firstBounce = i; break; } } if (firstBounce > 0) maxD = Math.min(maxD, firstBounce * 0.5 + 7); }
    if (!local) maxD = 9;
    const col = p.power ? '#ffffff' : (BB.PAL[p.cur] || BB.PAL[0]).light;
    const total = Math.min(maxD, (tr.pts.length - 1) * 0.5), phase = (t * 5) % 1.1;
    ctx.fillStyle = col;
    for (let d = 1.6 + phase; d < total; d += 1.1) {
      const i = d / 0.5, i0 = Math.floor(i), f = i - i0, a = tr.pts[i0], b = tr.pts[Math.min(i0 + 1, tr.pts.length - 1)];
      const x = a.x + (b.x - a.x) * f, y = a.y + (b.y - a.y) * f;
      ctx.globalAlpha = (local ? 0.9 : 0.4) * clamp((total - d) / 4, 0.15, 1);
      ctx.beginPath(); ctx.arc(x, y, local ? 0.2 : 0.16, 0, TAU); ctx.fill();
    }
    ctx.globalAlpha = 1;
    if (full && tr.cell && p.power !== 'fire') {
      const [r, c] = tr.cell, x = game.board.x(r, c), y = game.board.y(r);
      ctx.globalAlpha = 0.4 + 0.15 * Math.sin(t * 6);
      ctx.drawImage(p.power ? S.forPower(p.power) : S.color[p.cur], x - P, y - P, P * 2, P * 2);
      ctx.globalAlpha = 1;
      ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.lineWidth = 0.08; ctx.beginPath(); ctx.arc(x, y, 1.02, 0, TAU); ctx.stroke();
    }
  }

  function drawLauncher(game, p, t, acc) {
    const x = p.x, y = p.y, side = game.coop ? (p.slot === 0 ? -1 : 1) : 1, pc = game.coop ? PCOL[p.slot] : acc;
    // fever ring
    const fv = clamp(game.fever / FEVER_MAX, 0, 1);
    ctx.lineWidth = 0.32; ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.beginPath(); ctx.arc(x, y, 2.05, 0, TAU); ctx.stroke();
    if (fv > 0) {
      const g = ctx.createLinearGradient(x - 2, y, x + 2, y); g.addColorStop(0, '#ff4f8b'); g.addColorStop(0.5, '#ffd84a'); g.addColorStop(1, '#4fe3ff');
      ctx.strokeStyle = g; ctx.lineCap = 'round'; ctx.lineWidth = 0.26 + (fv > 0.85 ? Math.sin(t * 10) * 0.06 : 0);
      ctx.beginPath(); ctx.arc(x, y, 2.05, -Math.PI / 2, -Math.PI / 2 + fv * TAU); ctx.stroke(); ctx.lineCap = 'butt';
    }
    // pedestal
    const pg = ctx.createRadialGradient(x - 0.6, y - 0.4, 0.2, x, y, 1.9); pg.addColorStop(0, '#ffffff'); pg.addColorStop(0.3, BB.rgba(pc, 0.95)); pg.addColorStop(1, '#1b1240');
    ctx.fillStyle = pg; ctx.beginPath(); ctx.arc(x, y, 1.75, 0, TAU); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.lineWidth = 0.08; ctx.stroke();
    // barrel
    const a = p.angle, kick = p.kick * 0.35;
    ctx.save(); ctx.translate(x, y); ctx.rotate(-a);
    const bg = ctx.createLinearGradient(0, -0.6, 0, 0.6); bg.addColorStop(0, '#f4f0ff'); bg.addColorStop(0.5, '#9b8fd0'); bg.addColorStop(1, '#3a2f70');
    ctx.fillStyle = bg; rr(ctx, 0.4 - kick, -0.62, 2.55, 1.24, 0.45); ctx.fill();
    ctx.fillStyle = BB.rgba(pc, 0.95); rr(ctx, 2.55 - kick, -0.72, 0.5, 1.44, 0.22); ctx.fill();
    ctx.restore();
    // loaded bubble
    const spr = p.power ? S.forPower(p.power) : S.color[p.cur];
    const sc = 1 + Math.sin(p.swapT * Math.PI) * 0.25;
    if (p.power) { ctx.globalCompositeOperation = 'lighter'; const gp = 1.6 + Math.sin(t * 8) * 0.2; ctx.drawImage(S.glow, x - P * gp, y - P * gp, P * 2 * gp, P * 2 * gp); ctx.globalCompositeOperation = 'source-over'; }
    if (!p.flying && spr) { ctx.drawImage(spr, x - P * sc, y - P * sc, P * 2 * sc, P * 2 * sc); if (p.power === 'bomb') spark(x + 0.4, y - 1.05, t); }
    // next bubble
    const nx = x + side * 3.25, ny = y + 0.8;
    ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.beginPath(); ctx.arc(nx, ny, 1.0, 0, TAU); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.22)'; ctx.lineWidth = 0.07; ctx.stroke();
    if (p.next >= 0 && S.color[p.next]) ctx.drawImage(S.color[p.next], nx - P * 0.72, ny - P * 0.72, P * 1.44, P * 1.44);
    // swap arrows hint
    ctx.strokeStyle = 'rgba(255,255,255,0.45)'; ctx.lineWidth = 0.09;
    ctx.beginPath(); ctx.arc((x + nx) / 2, y + 0.4, 1.0, side > 0 ? 3.6 : -0.45, side > 0 ? 5.6 : 1.55); ctx.stroke();
    if (!p.remote) V.hits.push({ id: 'swap:' + p.slot, ...rectOf(Math.min(x, nx) - 1.4, y - 1.8, Math.abs(nx - x) + 2.8, 3.6) });
    // co-op name tags
    if (game.coop) {
      ctx.font = `700 0.85px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      const label = (p.remote ? '🌐 ' : '') + p.name;
      ctx.lineWidth = 0.18; ctx.strokeStyle = 'rgba(10,5,30,0.9)'; ctx.strokeText(label, x, y + 2.35); ctx.fillStyle = pc; ctx.fillText(label, x, y + 2.35);
    }
    // shots left (shared in co-op, so drawn once in the middle)
    if (!game.coop || p.slot === 0) {
      const sx = game.coop ? WIDTH / 2 : x - 3.3, sy = game.coop ? y + 0.4 : y + 0.8;
      const n = game.shotsLeft, low = n !== Infinity && n <= 5;
      ctx.fillStyle = low ? `rgba(255,60,90,${0.75 + 0.25 * Math.sin(t * 8)})` : 'rgba(255,255,255,0.14)';
      ctx.beginPath(); ctx.arc(sx, sy, 1.05, 0, TAU); ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 0.07; ctx.stroke();
      ctx.font = `700 ${n === Infinity ? 1.2 : n > 99 ? 0.75 : 0.95}px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillStyle = '#fff'; ctx.fillText(n === Infinity ? '∞' : String(n), sx, sy + 0.04);
      ctx.font = `600 0.42px ${FONT}`; ctx.fillStyle = 'rgba(255,255,255,0.7)'; ctx.fillText('SHOTS', sx, sy + 1.45);
    }
  }
  const rectOf = (x, y, w, h) => { const a = R.toScreen(x, y); return { x: a.x, y: a.y, w: w * V.s, h: h * V.s }; };

  function drawShots(game, t) {
    for (const s of game.shots) {
      const spr = S.forShot(s);
      if (s.power === 'fire') {
        const f = 1.5 + Math.sin(t * 30) * 0.12;
        ctx.globalCompositeOperation = 'lighter'; ctx.drawImage(S.glows[5], s.x - P * f * 1.3, s.y - P * f * 1.3, P * 2.6 * f, P * 2.6 * f); ctx.globalCompositeOperation = 'source-over';
        ctx.drawImage(spr, s.x - P * f, s.y - P * f, P * 2 * f, P * 2 * f);
        continue;
      }
      if (s.power) { ctx.globalCompositeOperation = 'lighter'; ctx.drawImage(S.glow, s.x - P * 1.5, s.y - P * 1.5, P * 3, P * 3); ctx.globalCompositeOperation = 'source-over'; }
      ctx.drawImage(spr, s.x - P, s.y - P, P * 2, P * 2);
      if (s.power === 'bomb') spark(s.x + 0.4, s.y - 1.05, t);
    }
  }

  // ---------------------------------------------------------------- bosses
  function drawBoss(game, t, B) {
    const b = game.boss, hurt = game.bossHurt || 0, roar = game.bossRoar || 0, cx = WIDTH / 2, cy = -2.6, k0 = 0.8;
    const sq = 1 + Math.sin(t * 2.2) * 0.03 + hurt * 0.12, sx = 1 / sq;
    const jx = hurt > 0 ? (Math.random() - 0.5) * hurt * 0.8 : 0;
    // health bar
    const hp = clamp(b.hp / b.max, 0, 1);
    ctx.fillStyle = 'rgba(0,0,0,0.5)'; rr(ctx, 4.4, -V.head + 0.35, 13.2, 0.9, 0.45); ctx.fill();
    const hg = ctx.createLinearGradient(4.4, 0, 17.6, 0); hg.addColorStop(0, '#ff3b5c'); hg.addColorStop(1, '#ffb13b');
    if (hp > 0) { ctx.fillStyle = hg; rr(ctx, 4.5, -V.head + 0.45, 13 * hp, 0.7, 0.35); ctx.fill(); }
    ctx.font = `700 0.62px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#fff';
    ctx.fillText(`${B.name.toUpperCase()}  ·  ${Math.ceil(b.hp)} / ${b.max}`, cx, -V.head + 0.82);
    ctx.save(); ctx.translate(cx + jx, cy); ctx.scale(sx * k0, sq * k0);
    const body = (path) => { const g = ctx.createRadialGradient(-1.5, -1.6, 0.3, 0, 0, 5.4); g.addColorStop(0, B.belly); g.addColorStop(0.35, B.body); g.addColorStop(1, B.dark); ctx.fillStyle = g; path(); ctx.fill(); ctx.strokeStyle = 'rgba(20,5,30,0.55)'; ctx.lineWidth = 0.12; ctx.stroke(); };
    const k = B.kind;
    if (k === 'crab') {
      for (const d of [-1, 1]) { // claws
        ctx.save(); ctx.translate(d * 5.4, 0.2 + Math.sin(t * 3 + d) * 0.25); ctx.rotate(d * (0.3 + Math.sin(t * 2.4) * 0.12 + roar * 0.4));
        body(() => { ctx.beginPath(); ctx.ellipse(0, 0, 1.5, 1.1, 0, 0, TAU); });
        ctx.fillStyle = B.dark; ctx.beginPath(); ctx.moveTo(d * 0.4, -0.2); ctx.lineTo(d * 1.7, -0.9 - roar * 0.5); ctx.lineTo(d * 1.2, 0.1); ctx.fill();
        ctx.restore();
      }
      for (const d of [-1, 1]) { ctx.strokeStyle = B.dark; ctx.lineWidth = 0.28; ctx.beginPath(); ctx.moveTo(d * 1.3, -1.8); ctx.lineTo(d * 1.6, -3.0); ctx.stroke(); }
    }
    if (k === 'squid') for (let i = 0; i < 8; i++) { const a = (i / 7 - 0.5) * 2.6; ctx.strokeStyle = B.dark; ctx.lineWidth = 0.55; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(Math.sin(a) * 3.5, 1.2); ctx.quadraticCurveTo(Math.sin(a) * 6 + Math.sin(t * 2 + i) * 0.8, 2.2, Math.sin(a) * 7.2 + Math.sin(t * 2.5 + i) * 1.2, 1.8 + Math.cos(t * 2 + i) * 0.5); ctx.stroke(); }
    if (k === 'toad') body(() => { ctx.beginPath(); ctx.ellipse(0, 0.6, 5.6, 2.3, 0, 0, TAU); ctx.ellipse(-2.2, -1.2, 1.4, 1.3, 0, 0, TAU); ctx.ellipse(2.2, -1.2, 1.4, 1.3, 0, 0, TAU); });
    else if (k === 'crab') body(() => { ctx.beginPath(); ctx.ellipse(0, 0.3, 4.4, 2.4, 0, 0, TAU); });
    else if (k === 'gum') body(() => { ctx.beginPath(); ctx.moveTo(-4.6, 2.2); ctx.quadraticCurveTo(-4.8, -3.2, 0, -3.3); ctx.quadraticCurveTo(4.8, -3.2, 4.6, 2.2); ctx.closePath(); });
    else if (k === 'golem') body(() => { ctx.beginPath(); ctx.moveTo(-5, 2.2); ctx.lineTo(-5.2, -0.6); ctx.lineTo(-3.6, -2.6); ctx.lineTo(-1, -3.2); ctx.lineTo(1.6, -3.0); ctx.lineTo(4.2, -2.2); ctx.lineTo(5.3, 0); ctx.lineTo(5, 2.2); ctx.closePath(); });
    else body(() => { ctx.beginPath(); ctx.ellipse(0, -0.6, 4.2, 3.0, 0, Math.PI, 0); ctx.lineTo(4.2, 1.4); ctx.quadraticCurveTo(0, 2.4, -4.2, 1.4); ctx.closePath(); });
    // decorations
    if (k === 'toad') { ctx.fillStyle = 'rgba(30,90,30,0.45)'; for (const [wx, wy, wr] of [[-3.6, 0.6, 0.35], [3.3, 0.9, 0.3], [-1, 1.6, 0.25], [1.4, 1.4, 0.3], [4.4, 0, 0.22]]) { ctx.beginPath(); ctx.arc(wx, wy, wr, 0, TAU); ctx.fill(); } ctx.fillStyle = '#ffd84a'; ctx.beginPath(); ctx.moveTo(-1.2, -1.9); ctx.lineTo(-1.2, -3.1); ctx.lineTo(-0.6, -2.4); ctx.lineTo(0, -3.3); ctx.lineTo(0.6, -2.4); ctx.lineTo(1.2, -3.1); ctx.lineTo(1.2, -1.9); ctx.fill(); }
    if (k === 'gum') { const rnd = BB.rng(3); for (let i = 0; i < 26; i++) { ctx.fillStyle = ['#fff', '#7fd4ff', '#ffe14f', '#9b7bff'][i % 4]; ctx.save(); ctx.translate((rnd() - 0.5) * 7.6, -2.6 + rnd() * 4.4); ctx.rotate(rnd() * TAU); ctx.fillRect(-0.22, -0.07, 0.44, 0.14); ctx.restore(); } }
    if (k === 'golem') for (const [gx, gy, gh, gc] of [[-2.8, -2.4, 1.6, '#5ff0ff'], [-0.6, -3.0, 2.2, '#ff6ff0'], [2.0, -2.7, 1.8, '#8cff9a'], [3.9, -1.9, 1.2, '#5ff0ff']]) { ctx.fillStyle = gc; ctx.beginPath(); ctx.moveTo(gx - 0.45, gy + 0.4); ctx.lineTo(gx, gy - gh); ctx.lineTo(gx + 0.45, gy + 0.4); ctx.fill(); ctx.fillStyle = 'rgba(255,255,255,0.4)'; ctx.beginPath(); ctx.moveTo(gx - 0.2, gy + 0.2); ctx.lineTo(gx, gy - gh + 0.3); ctx.lineTo(gx + 0.05, gy + 0.2); ctx.fill(); }
    if (k === 'squid') { ctx.fillStyle = 'rgba(255,255,255,0.18)'; for (const [sx2, sy2, sr] of [[-2.5, -1.8, 0.4], [2.2, -2.3, 0.3], [0.4, -2.9, 0.35], [3.3, -0.8, 0.25]]) { ctx.beginPath(); ctx.arc(sx2, sy2, sr, 0, TAU); ctx.fill(); } }
    // face: eyes follow the nearest shot (or the first launcher)
    const tgt = game.shots[0] || game.players[0];
    const eyes = k === 'squid' ? [[-1.8, -0.9, 0.85], [0, -1.5, 1.0], [1.8, -0.9, 0.85]] : k === 'toad' ? [[-2.2, -1.3, 0.9], [2.2, -1.3, 0.9]] : k === 'crab' ? [[-1.6, -3.2, 0.75], [1.6, -3.2, 0.75]] : [[-1.6, -0.9, 0.9], [1.6, -0.9, 0.9]];
    for (const [ex, ey, er] of eyes) {
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(ex, ey, er, 0, TAU); ctx.fill(); ctx.strokeStyle = 'rgba(20,5,30,0.6)'; ctx.lineWidth = 0.1; ctx.stroke();
      if (hurt > 0.2) { ctx.strokeStyle = '#2a1030'; ctx.lineWidth = 0.22; ctx.beginPath(); ctx.moveTo(ex - er * 0.5, ey - er * 0.5); ctx.lineTo(ex + er * 0.5, ey + er * 0.5); ctx.moveTo(ex + er * 0.5, ey - er * 0.5); ctx.lineTo(ex - er * 0.5, ey + er * 0.5); ctx.stroke(); continue; }
      const dx = tgt.x - (cx + ex * k0), dy = tgt.y - (cy + ey * k0), d = Math.hypot(dx, dy) || 1;
      ctx.fillStyle = '#1a0a28'; ctx.beginPath(); ctx.arc(ex + dx / d * er * 0.42, ey + dy / d * er * 0.42, er * 0.45, 0, TAU); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(ex + dx / d * er * 0.42 - er * 0.15, ey + dy / d * er * 0.42 - er * 0.15, er * 0.13, 0, TAU); ctx.fill();
      // angry brows
      ctx.strokeStyle = '#1a0a28'; ctx.lineWidth = 0.28; ctx.lineCap = 'round'; const sgn = ex < 0 ? 1 : ex > 0 ? -1 : 0;
      ctx.beginPath(); ctx.moveTo(ex - er * 0.9, ey - er * 1.05 - sgn * 0.25); ctx.lineTo(ex + er * 0.9, ey - er * 1.05 + sgn * 0.25); ctx.stroke();
    }
    // mouth
    const my = k === 'crab' ? 0.9 : k === 'toad' ? 0.9 : 0.8, open = Math.max(roar, hurt * 0.6);
    ctx.fillStyle = '#3a0a1a'; ctx.beginPath(); ctx.ellipse(0, my, k === 'toad' ? 3.2 : 1.6, 0.25 + open * 0.9, 0, 0, TAU); ctx.fill();
    if (open > 0.1) { ctx.fillStyle = '#fff'; for (const tx of [-0.8, 0, 0.8]) { ctx.beginPath(); ctx.moveTo(tx - 0.25, my - 0.2 - open * 0.6); ctx.lineTo(tx, my + 0.15 - open * 0.4); ctx.lineTo(tx + 0.25, my - 0.2 - open * 0.6); ctx.fill(); } }
    if (hurt > 0) { ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = hurt * 0.5; ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.ellipse(0, 0, 5.4, 3.2, 0, 0, TAU); ctx.fill(); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; }
    ctx.restore();
  }

  function drawIntro(game, t) {
    const sp = game.spec, u = clamp(game.t / 0.35, 0, 1), out = clamp(game.introT / 0.3, 0, 1);
    const a = Math.min(u, out), y = 11.5 + (1 - BB.math.easeOutBack(u)) * 4;
    ctx.globalAlpha = a;
    const tipLines = sp.tip ? wrap(sp.tip, 0.78, 17.5) : [];
    const h = 5.2 + tipLines.length * 0.95;
    ctx.fillStyle = 'rgba(14,10,44,0.86)'; rr(ctx, 1.6, y - 2.6, WIDTH - 3.2, h, 1); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.3)'; ctx.lineWidth = 0.08; ctx.stroke();
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const title = game.goal === 'endless' ? 'ENDLESS' : 'LEVEL ' + sp.n;
    ctx.font = `700 1.9px ${FONT}`; ctx.lineWidth = 0.3; ctx.strokeStyle = 'rgba(20,5,40,0.9)'; ctx.strokeText(title, WIDTH / 2, y - 1.2); ctx.fillStyle = '#ffe14f'; ctx.fillText(title, WIDTH / 2, y - 1.2);
    ctx.font = `600 0.95px ${FONT}`; ctx.fillStyle = '#fff'; ctx.fillText(R.goalText(game), WIDTH / 2, y + 0.6);
    ctx.font = `600 0.72px ${FONT}`; ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.fillText(game.goal === 'endless' ? 'Rows keep coming. How long can you last?' : `${game.shotsLeft} shots${game.spec.push ? ` · a new row every ${game.spec.push} shots` : ''}`, WIDTH / 2, y + 1.65);
    ctx.fillStyle = '#9fe8ff';
    tipLines.forEach((l, i) => ctx.fillText(l, WIDTH / 2, y + 2.75 + i * 0.95));
    ctx.globalAlpha = 1;
  }
  function wrap(s, size, maxW) {
    ctx.font = `600 ${size}px ${FONT}`;
    const out = []; let line = '';
    for (const w of s.split(' ')) { const test = line ? line + ' ' + w : w; if (ctx.measureText(test).width > maxW && line) { out.push(line); line = w; } else line = test; }
    if (line) out.push(line);
    return out;
  }
  R.goalText = game => {
    if (game.goal === 'clear') return 'Clear every bubble';
    if (game.goal === 'rescue') return `Free all ${game.critTotal} Blips`;
    if (game.goal === 'boss') return `Defeat ${(BB.WORLDS[game.spec.world] || BB.WORLDS[0]).boss.name}`;
    return 'Score as much as you can';
  };

  // ---------------------------------------------------------------- HUD (CSS pixels)
  function drawHud(game, t) {
    const pn = V.panels, sp = game.spec, world = BB.WORLDS[sp.world] || BB.WORLDS[0];
    const title = game.goal === 'endless' ? 'ENDLESS' : 'LEVEL ' + sp.n, sub = game.goal === 'endless' ? 'Best ' + BB.fmt(game.coop ? BB.save.endlessCoop : BB.save.endless) : world.name;
    const pushIn = game.shotsUntilPush();
    if (V.mode === 'stack') {
      const T = pn.top;
      glass(ctx, T.x, T.y, T.w, T.h, 16);
      const bx = T.x + 6, by = T.y + 6, bs = T.h - 12;
      pauseBtn(bx, by, bs);
      const narrow = T.w < 420;
      txt(ctx, title, bx + bs + 10, T.y + T.h * 0.36, narrow ? 17 : 20, '#ffe14f');
      txt(ctx, sub, bx + bs + 10, T.y + T.h * 0.72, narrow ? 11 : 13, 'rgba(255,255,255,0.75)', 'left', 600, false);
      const gx = T.x + T.w * (narrow ? 0.5 : 0.47);
      goalBlock(game, gx, T.y + T.h / 2, narrow ? 15 : 18, pushIn, 'center');
      scoreBlock(game, T.x + T.w - 10, T.y + T.h * 0.36, narrow ? Math.min(110, T.w * 0.26) : 150, narrow ? 17 : 20, 'right');
      if (pn.bottom) powerRow(game, pn.bottom, t);
    } else {
      const L = pn.left, Rt = pn.right;
      glass(ctx, L.x, L.y, L.w, Math.min(L.h, 236), 18);
      pauseBtn(L.x + 10, L.y + 10, 48);
      txt(ctx, title, L.x + 70, L.y + 26, 24, '#ffe14f');
      txt(ctx, sub, L.x + 70, L.y + 50, 14, 'rgba(255,255,255,0.75)', 'left', 600, false);
      goalBlock(game, L.x + 16, L.y + 102, 22, pushIn, 'left');
      txt(ctx, 'SCORE', L.x + 16, L.y + 168, 13, 'rgba(255,255,255,0.6)', 'left', 600, false);
      scoreBlock(game, L.x + 16, L.y + 194, L.w - 32, 28, 'left');
      if (V.powers) powerGrid(game, Rt, t);
      else if (game.coop) { glass(ctx, Rt.x, Rt.y, Rt.w, 120, 18); txt(ctx, 'TEAM PLAY', Rt.x + 16, Rt.y + 28, 18, '#9fe8ff'); txt(ctx, 'Shots, score and fever are shared.', Rt.x + 16, Rt.y + 58, 13, 'rgba(255,255,255,0.75)', 'left', 600, false); txt(ctx, 'Fill the fever ring for power-ups.', Rt.x + 16, Rt.y + 80, 13, 'rgba(255,255,255,0.75)', 'left', 600, false); }
    }
  }
  function pauseBtn(x, y, s) {
    ctx.fillStyle = 'rgba(255,255,255,0.12)'; rr(ctx, x, y, s, s, s * 0.28); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.25)'; ctx.lineWidth = 1.5; ctx.stroke();
    ctx.fillStyle = '#fff'; rr(ctx, x + s * 0.33, y + s * 0.28, s * 0.12, s * 0.44, 2); ctx.fill(); rr(ctx, x + s * 0.55, y + s * 0.28, s * 0.12, s * 0.44, 2); ctx.fill();
    V.hits.push({ id: 'pause', x, y, w: s, h: s });
  }
  function goalBlock(game, x, y, size, pushIn, align) {
    let label, icon = game.goal;
    if (game.goal === 'clear') label = Math.floor(game.progress() * 100) + '%';
    else if (game.goal === 'rescue') label = `${game.freed} / ${game.critTotal}`;
    else if (game.goal === 'boss') label = `${Math.ceil(game.boss.hp)} HP`;
    else label = 'x' + Math.max(1, game.combo);
    const iw = size * 1.6;
    ctx.font = `700 ${size}px ${FONT}`;
    const tw = ctx.measureText(label).width, total = iw + 8 + tw;
    const x0 = align === 'center' ? x - total / 2 : x;
    goalIcon(icon, x0 + iw / 2, y - (pushIn ? 6 : 0), iw * 0.5);
    txt(ctx, label, x0 + iw + 8, y - (pushIn ? 6 : 0), size, '#fff');
    if (pushIn) txt(ctx, `▼ new row in ${pushIn}`, align === 'center' ? x : x0, y + size * 0.75, Math.max(11, size * 0.6), pushIn <= 1 ? '#ff7a8a' : 'rgba(255,255,255,0.7)', align, 600, false);
  }
  function goalIcon(kind, x, y, r) {
    ctx.save(); ctx.translate(x, y);
    if (kind === 'rescue') { ctx.scale(r / 1, r / 1); ctx.drawImage(S.crit[1][0], -P, -P, P * 2, P * 2); }
    else if (kind === 'boss') { ctx.fillStyle = '#ff3b5c'; ctx.beginPath(); ctx.moveTo(0, r * 0.9); ctx.bezierCurveTo(-r * 1.5, -r * 0.1, -r * 0.6, -r * 1.3, 0, -r * 0.45); ctx.bezierCurveTo(r * 0.6, -r * 1.3, r * 1.5, -r * 0.1, 0, r * 0.9); ctx.fill(); }
    else if (kind === 'clear') { const sz = r * 0.62; [[-0.55, 0.35, 0], [0.55, 0.35, 1], [0, -0.55, 2]].forEach(([ox, oy, ci]) => ctx.drawImage(S.color[ci], ox * r - sz * P, oy * r - sz * P, sz * P * 2, sz * P * 2)); }
    else { ctx.fillStyle = '#ffe14f'; BB.draw.star4(ctx, r); }
    ctx.restore();
  }
  function scoreBlock(game, x, y, w, size, align) {
    const sc = BB.fmt(game.score);
    txt(ctx, sc, x, y, size, '#fff', align);
    if (game.goal === 'endless') return;
    const st = game.spec.stars, max = st[1] * 1.15, by = y + size * 0.85, bx = align === 'right' ? x - w : x;
    ctx.fillStyle = 'rgba(0,0,0,0.4)'; rr(ctx, bx, by - 4, w, 8, 4); ctx.fill();
    const f = clamp(game.score / max, 0, 1);
    if (f > 0) { const g = ctx.createLinearGradient(bx, 0, bx + w, 0); g.addColorStop(0, '#ffb13b'); g.addColorStop(1, '#ffe14f'); ctx.fillStyle = g; rr(ctx, bx, by - 4, Math.max(8, w * f), 8, 4); ctx.fill(); }
    // star marks: one for winning (at the start), then the 2- and 3-star scores
    [0, st[0], st[1]].forEach((v, i) => {
      const sx = bx + clamp(v / max, 0.04, 1) * w - (i === 2 ? 6 : 0), on = i === 0 ? game.state === 'won' || game.goalMet() : game.score >= v;
      ctx.save(); ctx.translate(sx, by); ctx.fillStyle = on ? '#ffe14f' : 'rgba(255,255,255,0.35)'; ctx.strokeStyle = 'rgba(20,5,40,0.8)'; ctx.lineWidth = 2;
      ctx.beginPath(); for (let k = 0; k < 10; k++) { const a = -Math.PI / 2 + k * Math.PI / 5, r = k % 2 ? 3.4 : 8; ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r); } ctx.closePath(); ctx.stroke(); ctx.fill(); ctx.restore();
    });
  }
  function powerButton(game, k, x, y, s, t, i) {
    const p = game.players[0], n = BB.save.inv[k] || 0, armed = p && p.power === k && p.powerFrom === 'inv';
    const busy = p && p.power && p.powerFrom !== 'inv';
    ctx.save();
    if (armed) { ctx.shadowColor = '#ffe14f'; ctx.shadowBlur = 18; }
    ctx.fillStyle = armed ? 'rgba(255,225,80,0.35)' : 'rgba(255,255,255,0.1)'; ctx.beginPath(); ctx.arc(x, y, s / 2, 0, TAU); ctx.fill();
    ctx.restore();
    ctx.strokeStyle = armed ? '#ffe14f' : 'rgba(255,255,255,0.28)'; ctx.lineWidth = armed ? 3 : 1.5; ctx.beginPath(); ctx.arc(x, y, s / 2, 0, TAU); ctx.stroke();
    ctx.globalAlpha = n > 0 && !busy ? 1 : 0.45;
    powerIcon(k, x, y, s * 0.36, t);
    ctx.globalAlpha = 1;
    // count (or price when you've none)
    const bx = x + s * 0.32, by = y + s * 0.32;
    ctx.fillStyle = n > 0 ? '#ff3b5c' : '#3a8a3a'; ctx.beginPath(); ctx.arc(bx, by, Math.max(9, s * 0.2), 0, TAU); ctx.fill();
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5; ctx.stroke();
    txt(ctx, n > 0 ? String(n) : '+', bx, by + 0.5, Math.max(11, s * 0.22), '#fff', 'center', 700, false);
    if (!BB.isTouch) txt(ctx, String(i + 1), x - s * 0.36, y - s * 0.36, 11, 'rgba(255,255,255,0.55)', 'center', 600, false);
    V.hits.push({ id: 'pw:' + k, x: x - s / 2, y: y - s / 2, w: s, h: s });
  }
  function powerIcon(k, x, y, r, t) {
    const spr = S.forPower(k);
    if (spr) { const sz = r * P / 1 * 1.0; ctx.drawImage(spr, x - sz, y - sz, sz * 2, sz * 2); return; }
    if (k === 'aim') {
      ctx.strokeStyle = '#ff5a6a'; ctx.lineWidth = Math.max(2, r * 0.16);
      ctx.beginPath(); ctx.arc(x, y, r * 0.75, 0, TAU); ctx.moveTo(x - r, y); ctx.lineTo(x - r * 0.35, y); ctx.moveTo(x + r * 0.35, y); ctx.lineTo(x + r, y); ctx.moveTo(x, y - r); ctx.lineTo(x, y - r * 0.35); ctx.moveTo(x, y + r * 0.35); ctx.lineTo(x, y + r); ctx.stroke();
      ctx.fillStyle = '#ff5a6a'; ctx.beginPath(); ctx.arc(x, y, r * 0.16, 0, TAU); ctx.fill();
    } else { ctx.drawImage(S.color[3], x - r * P, y - r * P, r * P * 2, r * P * 2); txt(ctx, '+5', x, y + 1, r * 0.95, '#fff', 'center', 700); }
  }
  R.powerIcon = powerIcon;
  function powerRow(game, B, t) {
    const n = POWER_KEYS.length, s = Math.min(56, (B.w - 20) / n - 8, B.h - 10), gap = Math.min(18, (B.w - n * s) / (n + 1));
    const total = n * s + (n - 1) * gap, x0 = B.x + (B.w - total) / 2 + s / 2, y = B.y + B.h / 2;
    POWER_KEYS.forEach((k, i) => powerButton(game, k, x0 + i * (s + gap), y, s, t, i));
  }
  function powerGrid(game, B, t) {
    const cols = 2, s = Math.min(70, (B.w - 40) / cols), rowH = s + 34;
    glass(ctx, B.x, B.y, B.w, 50 + Math.ceil(POWER_KEYS.length / cols) * rowH, 18);
    txt(ctx, 'POWER-UPS', B.x + 16, B.y + 26, 17, '#9fe8ff');
    POWER_KEYS.forEach((k, i) => {
      const cx = B.x + B.w * (i % cols === 0 ? 0.28 : 0.72), cy = B.y + 50 + Math.floor(i / cols) * rowH + s / 2;
      powerButton(game, k, cx, cy, s, t, i);
      txt(ctx, POWER_INFO[k].name, cx, cy + s / 2 + 13, 12, 'rgba(255,255,255,0.75)', 'center', 600, false);
    });
  }
  // little messages ("Not enough coins", "Controller connected")
  R.toast = null;
  R.showToast = (msg, col = '#fff') => { R.toast = { msg, col, t: 2.2 }; };
  function drawToast(dt) {
    const T = R.toast; T.t -= dt;
    ctx.font = `700 16px ${FONT}`;
    const w = ctx.measureText(T.msg).width + 36, x = (V.W - w) / 2, y = V.H * 0.42;
    ctx.globalAlpha = clamp(T.t * 3, 0, 1);
    glass(ctx, x, y, w, 40, 20, 0.8);
    txt(ctx, T.msg, V.W / 2, y + 20, 16, T.col, 'center');
    ctx.globalAlpha = 1;
  }
  R.drawToastOnly = dt => { screenT(); if (R.toast && R.toast.t > 0) drawToast(dt); };
})();
