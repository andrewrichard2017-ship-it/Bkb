// HUD (health, stamina, clock), tappable canvas buttons, and every menu / overlay screen.
(() => {
  'use strict';
  const BK = window.BK, ctx = BK.ctx, D = BK.draw, W = BK.W, H = BK.H, PAL = BK.PAL, F = BK.FONT;
  const { clamp, lerp } = BK;

  // ---------- canvas buttons ----------
  const UI = BK.ui = { buttons: [] };
  UI.begin = () => { UI.buttons = []; };
  UI.tap = (x, y) => {
    UI.cursorOn = false; // a touch hides the controller cursor
    for (let i = UI.buttons.length - 1; i >= 0; i--) {
      const b = UI.buttons[i];
      if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) { b.onTap(); BK.audio.tick(true); return true; }
    }
    return false;
  };

  // ---------- cursor for controllers and keyboards ----------
  // Buttons are re-registered every frame, so the cursor remembers a point and snaps to the
  // button nearest it. D-pad / stick / arrows move it to the best button in that direction.
  UI.focusPt = null; UI.cursorOn = false;
  const centre = b => ({ x: b.x + b.w / 2, y: b.y + b.h / 2 });
  const navigable = () => UI.buttons.filter(b => b.w < BK.W * 2);
  UI.focused = () => {
    const bs = navigable();
    if (!bs.length) return null;
    if (UI.focusPt) {
      let best = null, bd = 1e9;
      for (const b of bs) { const c = centre(b), d = Math.hypot(c.x - UI.focusPt.x, c.y - UI.focusPt.y); if (d < bd) { bd = d; best = b; } }
      if (bd < 80) return best;
    }
    return bs.find(b => b.primary) || bs[0];
  };
  UI.nav = (dx, dy) => {
    UI.cursorOn = true;
    const cur = UI.focused();
    if (!cur) return;
    const c = centre(cur);
    UI.focusPt = c; // reveal on the current button, then move from it
    let best = null, bs = 1e9;
    for (const b of navigable()) {
      if (b === cur) continue;
      const o = centre(b), vx = o.x - c.x, vy = o.y - c.y;
      const along = vx * dx + vy * dy; // must lie in the pressed direction
      if (along < 20) continue;
      const across = Math.abs(vx * dy) + Math.abs(vy * dx);
      const score = along + across * 2.2;
      if (score < bs) { bs = score; best = b; }
    }
    if (best) { UI.focusPt = centre(best); BK.audio.tick(true); }
  };
  UI.activate = () => {
    const b = UI.focused();
    if (!b) return false;
    UI.cursorOn = true; UI.focusPt = centre(b);
    b.onTap(); BK.audio.tick(true);
    return true;
  };
  UI.drawCursor = () => {
    if (!UI.cursorOn) return;
    const b = UI.focused();
    if (!b) return;
    const pulse = 0.7 + Math.sin(performance.now() / 160) * 0.3;
    ctx.save(); ctx.globalAlpha = pulse;
    ctx.strokeStyle = '#f0c75a'; ctx.lineWidth = 5; ctx.lineJoin = 'round';
    D.rr(b.x - 2, b.y - 2, b.w + 4, b.h + 4, 12); ctx.stroke();
    ctx.restore();
  };
  // style: 'primary' | 'secondary'
  UI.button = (cx, cy, w, h, label, onTap, style = 'secondary', sub = null) => {
    const x = cx - w / 2, y = cy - h / 2;
    UI.buttons.push({ x: x - 6, y: y - 6, w: w + 12, h: h + 12, onTap, primary: style === 'primary' });
    D.slant(x, y, w - 14, h, 14);
    if (style === 'primary') {
      const g = ctx.createLinearGradient(0, y, 0, y + h);
      g.addColorStop(0, '#c7303a'); g.addColorStop(1, '#861820');
      ctx.fillStyle = g;
    } else ctx.fillStyle = 'rgba(28,21,19,0.92)';
    ctx.fill();
    ctx.strokeStyle = style === 'primary' ? PAL.bone : 'rgba(217,164,65,0.7)'; ctx.lineWidth = 2.5; ctx.stroke();
    if (sub) {
      D.text(sub, cx, cy - h * 0.2, F.ui(Math.round(h * 0.26)), PAL.brass);
      D.text(label, cx, cy + h * 0.18, F.display(Math.round(h * 0.36)), PAL.bone);
    } else D.text(label, cx, cy + 2, F.display(Math.round(h * 0.46)), PAL.bone);
  };

  function panel(x, y, w, h) {
    D.slant(x, y, w, h, 24);
    ctx.fillStyle = PAL.panel; ctx.fill();
    ctx.strokeStyle = 'rgba(217,164,65,0.45)'; ctx.lineWidth = 2; ctx.stroke();
  }
  function dim(a = 0.6) { ctx.fillStyle = `rgba(10,7,6,${a})`; ctx.fillRect(-W, -H, W * 3, H * 3); }
  function strokeText(str, x, y, font, fill, sw = 8) {
    ctx.font = font; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round'; ctx.lineWidth = sw; ctx.strokeStyle = PAL.ink; ctx.strokeText(str, x, y);
    ctx.fillStyle = fill; ctx.fillText(str, x, y);
  }
  BK.strokeText = strokeText;

  // ---------- in-fight HUD ----------
  function fighterBar(f, left) {
    const bw = 520, x = left ? 140 : W - 140 - bw, y = 32, h = 32, sk = left ? 12 : -12;
    // portrait medallion
    const px = left ? 80 : W - 80, py = 72;
    D.circle(px, py, 50); ctx.fillStyle = '#1c1512'; ctx.fill();
    ctx.lineWidth = 4; ctx.strokeStyle = f.cornerColor; ctx.stroke();
    ctx.save(); D.circle(px, py, 46); ctx.clip();
    f.drawPortrait(px, py + 12, 1.55, !left);
    ctx.restore();

    // health
    D.slant(x - 4, y - 4, bw + 8, h + 8, sk); ctx.fillStyle = 'rgba(0,0,0,0.7)'; ctx.fill();
    const seg = (a, b, fill) => { // a..b in HP units, drawn from the fighter's side
      const x0 = left ? x + bw * a / 100 : x + bw - bw * b / 100;
      D.slant(x0, y, bw * (b - a) / 100, h, sk); ctx.fillStyle = fill; ctx.fill();
    };
    seg(0, 100, '#3a1113');
    if (f.maxHp < 100) seg(f.maxHp, 100, 'rgba(0,0,0,0.75)');
    seg(0, f.ghostHp, PAL.bone);
    const g = ctx.createLinearGradient(x, 0, x + bw, 0);
    const lo = f.hp < 30 ? '#e2584f' : PAL.blood;
    if (left) { g.addColorStop(0, lo); g.addColorStop(1, PAL.brass); } else { g.addColorStop(0, PAL.brass); g.addColorStop(1, lo); }
    if (f.hp > 0) seg(0, f.hp, g);
    if (f.hp < 30 && f.hp > 0 && Math.sin(performance.now() / 120) > 0) seg(0, f.hp, 'rgba(255,255,255,0.25)');
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    for (let i = 1; i < 10; i++) { D.slant(x + bw * i / 10 - 1, y, 2, h, sk); ctx.fill(); }
    // stamina
    const sw = bw * 0.72, sx = left ? x : x + bw - sw, sy = y + h + 8;
    D.slant(sx, sy, sw, 10, sk * 0.3); ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fill();
    const sv = sw * f.stamina / 100;
    D.slant(left ? sx : sx + sw - sv, sy, sv, 10, sk * 0.3);
    ctx.fillStyle = f.stamina < 25 ? '#c98a2e' : PAL.teal; ctx.fill();
    // name + knockdown pips
    D.text(f.look.name + (BK.game.twoPlayer ? (left ? '  ·  P1' : '  ·  P2') : ''), left ? x : x + bw, sy + 32, F.display(28), PAL.bone, left ? 'left' : 'right');
    for (let i = 0; i < f.kdTotal; i++) {
      const cx = left ? x + bw - 14 - i * 26 : x + 14 + i * 26;
      D.circle(cx, sy + 32, 9); ctx.fillStyle = PAL.blood; ctx.fill(); ctx.strokeStyle = PAL.bone; ctx.lineWidth = 2; ctx.stroke();
    }
    D.text('STA', left ? sx + sw + 12 : sx - 12, sy + 6, F.ui(16), PAL.teal, left ? 'left' : 'right');
    const b = f.buffs, tags = [b.power && `PWR +${b.power}%`, b.chin && `CHIN +${b.chin}%`, b.stamina && `STA +${b.stamina}%`].filter(Boolean);
    if (tags.length) D.text(tags.join('   '), left ? x : x + bw, sy + 62, F.ui(20), PAL.brass, left ? 'left' : 'right');
  }

  BK.hud = {};
  BK.hud.draw = g => {
    fighterBar(g.p1, true); fighterBar(g.p2, false);
    // centre plate
    D.slant(706, 16, 188, 104, 0);
    ctx.fillStyle = 'rgba(16,12,11,0.92)'; ctx.fill();
    ctx.strokeStyle = 'rgba(217,164,65,0.6)'; ctx.lineWidth = 2; ctx.stroke();
    D.text(`ROUND ${g.round} / ${g.totalRounds}`, W / 2, 38, F.ui(22), PAL.brass);
    const low = g.clock <= 10 && g.state === 'fight';
    D.text(BK.fmtClock(g.clock), W / 2, 84, F.display(56), low ? '#e2584f' : PAL.bone);
    for (const f of [g.p1, g.p2]) {
      if (!g.koReadyFor(f) || (f.punch && BK.PUNCHES[f.punch.type].super)) continue;
      const a = 0.6 + Math.sin(performance.now() / 110) * 0.4;
      ctx.save(); ctx.globalAlpha = a;
      const who = g.twoPlayer ? `${f.side ? 'BLUE' : 'RED'}: ` : '';
      BK.strokeText(`${who}HE'S OUT ON HIS FEET  ·  ${f.look.super === 'duster' ? 'KNUCKLE DUSTER' : 'SUPER PUNCH'} READY`, W / 2, 210 + f.side * 50, F.display(40), PAL.brass, 8);
      ctx.restore();
    }
    // pause button
    UI.buttons.push({ x: W / 2 - 40, y: 124, w: 80, h: 60, onTap: () => g.pause() });
    D.circle(W / 2, 150, 22); ctx.fillStyle = 'rgba(16,12,11,0.85)'; ctx.fill();
    ctx.strokeStyle = 'rgba(239,230,210,0.6)'; ctx.lineWidth = 2; ctx.stroke();
    ctx.fillStyle = PAL.bone; ctx.fillRect(W / 2 - 8, 140, 5, 20); ctx.fillRect(W / 2 + 3, 140, 5, 20);
  };

  BK.hud.vignette = () => {
    const g = ctx.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, H * 1.05);
    g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,0.55)');
    ctx.fillStyle = g; ctx.fillRect(-W, -H, W * 3, H * 3);
  };

  BK.hud.banner = (text, sub, a, color = PAL.bone, size = 130) => {
    ctx.save(); ctx.globalAlpha = clamp(a, 0, 1);
    const sc = 1 + Math.max(0, 1 - a) * 0.3;
    ctx.translate(W / 2, 330); ctx.scale(sc, sc);
    strokeText(text, 0, 0, F.display(size), color, 12);
    if (sub) strokeText(sub, 0, size * 0.62, F.ui(34), PAL.brass, 6);
    ctx.restore();
  };

  BK.hud.count = (n, sub) => {
    const pulse = 1 + Math.max(0, 0.25 - (performance.now() % 1000) / 1000);
    ctx.save(); ctx.translate(W / 2, 400); ctx.scale(pulse, pulse);
    strokeText(String(n), 0, 0, F.display(170), n >= 8 ? '#e2584f' : PAL.bone, 14);
    ctx.restore();
    if (sub) strokeText(sub, W / 2, 510, F.ui(34), PAL.brass, 6);
  };

  // ---------- title ----------
  BK.hud.title = g => {
    const grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, 'rgba(10,7,6,0.9)'); grad.addColorStop(0.5, 'rgba(10,7,6,0.45)'); grad.addColorStop(1, 'rgba(10,7,6,0.92)');
    ctx.fillStyle = grad; ctx.fillRect(-W, -H, W * 3, H * 3);
    D.text('NO GLOVES  ·  NO MERCY  ·  ONE WINNER', W / 2, 110, F.ui(28), PAL.brass);
    strokeText('BARE KNUCKLE', W / 2, 215, F.display(172), PAL.bone, 14);
    // pick your man and the CPU's (tap to cycle)
    const pick = (f, x, who, which) => {
      UI.button(x, 330, 400, 96, `${f.look.name}  ›`, () => g.cycleFighter(which), 'secondary', who);
      D.circle(x + (which === 'player' ? -250 : 250), 330, 52); ctx.fillStyle = '#1c1512'; ctx.fill();
      ctx.lineWidth = 4; ctx.strokeStyle = f.cornerColor; ctx.stroke();
      ctx.save(); D.circle(x + (which === 'player' ? -250 : 250), 330, 48); ctx.clip();
      f.drawPortrait(x + (which === 'player' ? -250 : 250), 342, 1.6, which !== 'player');
      ctx.restore();
    };
    const two = BK.settings.players === 2;
    pick(g.p1, W / 2 - 290, two ? 'PLAYER 1  ·  RED CORNER' : 'YOU  ·  RED CORNER', 'player');
    pick(g.p2, W / 2 + 290, two ? 'PLAYER 2  ·  BLUE CORNER' : 'CPU  ·  BLUE CORNER', 'cpu');
    D.text('VS', W / 2, 332, F.display(48), PAL.blood);

    if (g.showControls) { BK.hud.controls(g); return; }
    UI.button(W / 2 - 230, 470, 420, 100, 'QUICK FIGHT', () => g.toTape(), 'primary');
    UI.button(W / 2 + 230, 470, 420, 100, 'TOURNAMENT', () => g.startTournament(), 'primary', 'BEAT EVERYONE');
    UI.button(W / 2 + 660, 470, 300, 100, 'CONTROLS', () => { g.showControls = true; });
    const s = BK.settings;
    const row = [
      ['PLAYERS', s.players === 2 ? '2' : '1', () => g.togglePlayers()],
      ['DIFFICULTY', BK.DIFFS[s.difficulty], () => { s.difficulty = (s.difficulty + 1) % 3; }],
      ['ROUNDS', String(s.rounds), () => { s.rounds = BK.ROUND_OPTS[(BK.ROUND_OPTS.indexOf(s.rounds) + 1) % BK.ROUND_OPTS.length]; }],
      ['ARENA', (BK.ARENAS.find(a => a[0] === s.arena) || BK.ARENAS[0])[1], () => { const i = BK.ARENAS.findIndex(a => a[0] === s.arena); s.arena = BK.ARENAS[(i + 1) % BK.ARENAS.length][0]; }],
      ['SOUND', s.sound ? 'ON' : 'OFF', () => { s.sound = !s.sound; BK.audio.setEnabled(s.sound); }],
      ['VIBRATION', s.vibrate ? 'ON' : 'OFF', () => { s.vibrate = !s.vibrate; BK.vibrate(40); }],
    ];
    row.forEach(([sub, val, fn], i) => UI.button(W / 2 + (i - 2.5) * 238, 620, 222, 92, val, () => { fn(); BK.saveSettings(); }, 'secondary', sub));
    if (two) {
      const n = BK.pad.count, msg = n >= 2 ? 'Two controllers connected: pad 1 is red, pad 2 is blue' : n === 1 ? 'One controller: it takes the blue corner, touch screen / keyboard the red' : 'Connect a controller for player 2 (or use arrows + 1-9 on a keyboard)';
      D.text(msg, W / 2, 690, F.ui(22), PAL.brass);
    }
    const r = BK.record;
    D.text((r.w + r.l + r.d ? `YOUR RECORD  ${r.w}-${r.l}-${r.d}  (${r.ko} KO)` : 'YOUR FIRST FIGHT') + (r.champs ? `  ·  ${r.champs}x TOURNAMENT CHAMPION` : ''), W / 2, 735, F.ui(30), PAL.bone);
    if (BK.pad.connected) D.text('Controller: stick moves  ·  ✕ jab  ○ cross  □ hook  △ upper  ·  L1 clinch  R1 body  L2 sway  R2 block  R3 super  ·  D-pad + ✕ works the menus', W / 2, 800, F.ui(22, 500), 'rgba(239,230,210,0.75)');
    else D.text('Left thumb moves  ·  Right thumb punches, blocks and slips  ·  Keys: WASD, J K U I, hold B body, L block, Space sway, C clinch  ·  PS5 / PS4 controllers work too', W / 2, 800, F.ui(22, 500), 'rgba(239,230,210,0.65)');
  };

  // ---------- tale of the tape ----------
  BK.hud.tape = g => {
    dim(0.78);
    D.text('TALE OF THE TAPE', W / 2, 90, F.display(64), PAL.brass);
    const a = g.p1, b = g.p2;
    [[a, 250, false], [b, W - 250, true]].forEach(([f, x, flip]) => {
      D.circle(x, 225, 92); ctx.fillStyle = '#1c1512'; ctx.fill(); ctx.lineWidth = 6; ctx.strokeStyle = f.cornerColor; ctx.stroke();
      ctx.save(); D.circle(x, 225, 86); ctx.clip(); f.drawPortrait(x, 250, 3.1, flip); ctx.restore();
      D.text(f.corner, x, 345, F.ui(24), f === a ? '#e2584f' : '#6f8fd6');
      D.text(f.look.name, x, 385, F.display(38), PAL.bone);
    });
    const keys = Object.keys(a.look.tape);
    keys.forEach((k, i) => {
      const y = 170 + i * 44;
      D.text(a.look.tape[k], W / 2 - 95, y, F.ui(30, 500), PAL.bone, 'right');
      D.text(k, W / 2, y, F.ui(24), PAL.brass);
      D.text(b.look.tape[k], W / 2 + 95, y, F.ui(30, 500), PAL.bone, 'left');
    });
    Object.keys(a.look.attr).forEach((k, i) => {
      const y = 480 + i * 56, va = a.look.attr[k], vb = b.look.attr[k];
      D.text(k, W / 2, y, F.ui(24), PAL.brass);
      const L = 380;
      ctx.fillStyle = 'rgba(239,230,210,0.12)'; ctx.fillRect(W / 2 - 70 - L, y - 10, L, 20); ctx.fillRect(W / 2 + 70, y - 10, L, 20);
      ctx.fillStyle = va >= vb ? PAL.brass : 'rgba(239,230,210,0.55)'; ctx.fillRect(W / 2 - 70 - L * va / 100, y - 10, L * va / 100, 20);
      ctx.fillStyle = vb >= va ? PAL.brass : 'rgba(239,230,210,0.55)'; ctx.fillRect(W / 2 + 70, y - 10, L * vb / 100, 20);
      D.text(String(va), W / 2 - 80 - L - 10, y, F.ui(26), PAL.bone, 'right');
      D.text(String(vb), W / 2 + 80 + L + 10, y, F.ui(26), PAL.bone, 'left');
    });
    const pulse = 0.55 + Math.sin(performance.now() / 250) * 0.35;
    ctx.globalAlpha = pulse; D.text('TAP TO WALK OUT', W / 2, 770, F.ui(34), PAL.brass); ctx.globalAlpha = 1;
    UI.buttons.push({ x: -W, y: -H, w: W * 3, h: H * 3, onTap: () => g.startFight() });
  };

  // ---------- corner (between rounds) ----------
  function statRows(a, b) {
    const acc = f => f.stats.thrown ? Math.round(100 * f.stats.landed / f.stats.thrown) + '%' : '-';
    return [
      ['PUNCHES LANDED', `${a.stats.landed}/${a.stats.thrown}`, `${b.stats.landed}/${b.stats.thrown}`, a.stats.landed, b.stats.landed],
      ['ACCURACY', acc(a), acc(b), a.stats.landed / (a.stats.thrown || 1), b.stats.landed / (b.stats.thrown || 1)],
      ['POWER PUNCHES', `${a.stats.planded}/${a.stats.pthrown}`, `${b.stats.planded}/${b.stats.pthrown}`, a.stats.planded, b.stats.planded],
      ['COUNTERS', String(a.stats.counters), String(b.stats.counters), a.stats.counters, b.stats.counters],
      ['KNOCKDOWNS', String(b.kdTotal), String(a.kdTotal), b.kdTotal, a.kdTotal],
    ];
  }
  function drawStats(a, b, x, y, w) {
    D.text(a.look.short, x, y, F.display(30), PAL.bone, 'left');
    D.text(b.look.short, x + w, y, F.display(30), PAL.bone, 'right');
    statRows(a, b).forEach(([label, va, vb, na, nb], i) => {
      const ry = y + 52 + i * 52;
      D.text(label, x + w / 2, ry - 8, F.ui(22), PAL.brass);
      D.text(va, x, ry, F.ui(32), na > nb ? PAL.bone : 'rgba(239,230,210,0.6)', 'left');
      D.text(vb, x + w, ry, F.ui(32), nb > na ? PAL.bone : 'rgba(239,230,210,0.6)', 'right');
      const tot = na + nb || 1, bw = w * 0.5;
      ctx.fillStyle = 'rgba(239,230,210,0.12)'; ctx.fillRect(x + w / 2 - bw / 2, ry + 12, bw, 6);
      ctx.fillStyle = PAL.blood; ctx.fillRect(x + w / 2 - bw / 2, ry + 12, bw * na / tot, 6);
      ctx.fillStyle = '#4b68b8'; ctx.fillRect(x + w / 2 - bw / 2 + bw * na / tot, ry + 12, bw * nb / tot, 6);
    });
  }
  function drawCards(g, x, y, w) {
    D.text('JUDGES\' SCORECARDS', x + w / 2, y, F.ui(24), PAL.brass);
    const totals = g.cardTotals();
    BK.JUDGES.forEach((name, j) => {
      const ry = y + 44 + j * 44;
      D.text(name, x, ry, F.ui(28, 500), PAL.bone, 'left');
      const [ta, tb] = totals[j];
      D.text(g.roundLog.length ? `${ta} – ${tb}` : '–', x + w, ry, F.display(30), PAL.bone, 'right');
    });
  }

  BK.hud.corner = g => {
    dim(0.55);
    panel(200, 110, 1200, 700);
    D.text(`END OF ROUND ${g.round}`, W / 2, 170, F.display(64), PAL.bone);
    D.text(g.round + 1 === g.totalRounds ? 'FINAL ROUND COMING UP' : `ROUND ${g.round + 1} OF ${g.totalRounds} COMING UP`, W / 2, 222, F.ui(26), PAL.brass);
    drawStats(g.p1, g.p2, 270, 280, 560);
    drawCards(g, 920, 290, 420);
    // cornerman
    D.text('YOUR CORNER', 1130, 500, F.ui(24), PAL.brass);
    ctx.font = F.ui(28, 500); ctx.fillStyle = PAL.bone; ctx.textAlign = 'center';
    wrap(g.tip, 1130, 545, 420, 34);
    UI.button(W / 2 - 140, 735, 460, 90, 'TO THE CORNER', () => g.workCorner(), 'primary');
    UI.button(W / 2 + 250, 735, 260, 80, 'SKIP', () => g.nextRound());
    D.text('Diesel, slaps or a beer: pick a boost', W / 2 - 140, 796, F.ui(22, 500), 'rgba(239,230,210,0.7)');
  };
  function wrap(text, x, y, maxW, lh) {
    const words = text.split(' '); let line = '', yy = y;
    for (const w of words) {
      const t = line ? line + ' ' + w : w;
      if (ctx.measureText(t).width > maxW && line) { ctx.fillText(line, x, yy); line = w; yy += lh; } else line = t;
    }
    ctx.fillText(line, x, yy);
  }

  // ---------- result ----------
  BK.hud.result = g => {
    dim(0.55);
    panel(200, 70, 1200, 770);
    const r = g.result, won = r.winner === g.p1;
    D.text(won ? 'VICTORY' : r.winner ? 'DEFEAT' : 'NO WINNER', W / 2, 120, F.ui(30), won ? PAL.brass : '#e2584f');
    strokeText(r.method, W / 2, 200, F.display(r.method.length > 12 ? 78 : 104), r.method.includes('KNOCKOUT') || r.method === 'TKO' ? '#e2584f' : PAL.bone, 10);
    D.text(r.winner ? `${r.winner.look.name} WINS` : 'THE JUDGES CAN\'T SEPARATE THEM', W / 2, 282, F.display(40), PAL.bone);
    D.text(r.detail, W / 2, 326, F.ui(28), PAL.brass);
    drawStats(g.p1, g.p2, 270, 390, 560);
    if (g.roundLog.length) drawCards(g, 920, 400, 420);
    const rec = BK.record;
    D.text(`YOUR RECORD  ${rec.w}-${rec.l}-${rec.d}  (${rec.ko} KO)`, 1130, 600, F.ui(28), PAL.bone);
    if (g.tour) {
      const t = g.tour;
      D.text(`TOURNAMENT  ·  FIGHT ${t.index + 1} OF ${t.order.length}`, 1130, 650, F.ui(26), PAL.brass);
      if (won) UI.button(W / 2, 765, 520, 88, t.index + 1 >= t.order.length ? 'CLAIM THE TITLE' : 'CONTINUE  ·  +10 HEALTH', () => g.tourNext(), 'primary');
      else UI.button(W / 2, 765, 520, 88, 'KNOCKED OUT OF THE TOURNAMENT', () => g.toTitle());
    } else {
      UI.button(W / 2 - 220, 765, 380, 88, 'REMATCH', () => g.toTape(), 'primary');
      UI.button(W / 2 + 220, 765, 380, 88, 'MAIN MENU', () => g.toTitle());
    }
  };

  // ---------- tournament ----------
  function medallion(key, x, y, r, state) {
    const f = BK.game.p1.key === key ? BK.game.p1 : new BK.Fighter(key, 1);
    D.circle(x, y, r); ctx.fillStyle = '#1c1512'; ctx.fill();
    ctx.lineWidth = 5; ctx.strokeStyle = state === 'next' ? PAL.brass : state === 'beaten' ? '#555' : 'rgba(239,230,210,0.35)'; ctx.stroke();
    ctx.save(); D.circle(x, y, r - 4); ctx.clip();
    ctx.globalAlpha = state === 'beaten' ? 0.35 : 1;
    f.drawPortrait(x, y + r * 0.22, r / 30, true);
    ctx.restore();
    if (state === 'beaten') { ctx.strokeStyle = '#e2584f'; ctx.lineWidth = 8; ctx.beginPath(); ctx.moveTo(x - r * 0.6, y - r * 0.6); ctx.lineTo(x + r * 0.6, y + r * 0.6); ctx.moveTo(x + r * 0.6, y - r * 0.6); ctx.lineTo(x - r * 0.6, y + r * 0.6); ctx.stroke(); }
  }
  BK.hud.ladder = g => {
    dim(0.72);
    const t = g.tour, next = t.order[t.index];
    D.text('TOURNAMENT', W / 2, 90, F.display(72), PAL.brass);
    D.text(`FIGHT ${t.index + 1} OF ${t.order.length}  ·  WIN THEM ALL TO TAKE THE TITLE`, W / 2, 148, F.ui(28), PAL.bone);
    const n = t.order.length, gap = 250, x0 = W / 2 - (n - 1) * gap / 2;
    t.order.forEach((k, i) => {
      const x = x0 + i * gap, state = i < t.index ? 'beaten' : i === t.index ? 'next' : 'later';
      medallion(k, x, 330, state === 'next' ? 92 : 72, state);
      D.text(BK.FIGHTERS[k].name, x, 450, F.display(28), state === 'later' ? 'rgba(239,230,210,0.6)' : PAL.bone);
      D.text(state === 'beaten' ? 'BEATEN' : state === 'next' ? 'NEXT UP' : i === n - 1 ? 'FINAL' : `FIGHT ${i + 1}`, x, 486, F.ui(22), state === 'next' ? PAL.brass : 'rgba(239,230,210,0.6)');
    });
    // your health going in
    const bw = 600, bx = W / 2 - bw / 2, by = 560;
    D.text(`${g.p1.look.name}  ·  HEALTH GOING IN`, W / 2, by - 24, F.ui(26), PAL.bone);
    D.slant(bx, by, bw, 30, 12); ctx.fillStyle = '#3a1113'; ctx.fill();
    D.slant(bx, by, bw * t.hp / 100, 30, 12); ctx.fillStyle = t.hp < 35 ? '#e2584f' : PAL.brass; ctx.fill();
    D.text(`${Math.round(t.hp)}%`, bx + bw + 40, by + 16, F.display(32), PAL.bone, 'left');
    D.text('+10 health after every win. Lose and you\'re out.', W / 2, by + 70, F.ui(24, 500), 'rgba(239,230,210,0.7)');
    UI.button(W / 2, 760, 520, 92, `FIGHT ${BK.FIGHTERS[next].short}`, () => g.toTape(), 'primary');
  };
  BK.hud.champion = g => {
    dim(0.55);
    D.text('UNDISPUTED', W / 2, 150, F.ui(34), PAL.brass);
    strokeText('TOURNAMENT CHAMPION', W / 2, 240, F.display(96), PAL.brass, 12);
    medallion(g.p1.key, W / 2, 440, 120, 'next');
    D.text(g.p1.look.name, W / 2, 610, F.display(56), PAL.bone);
    D.text(`Beat ${g.tour.order.length} men in a row`, W / 2, 665, F.ui(28, 500), 'rgba(239,230,210,0.8)');
    UI.button(W / 2, 770, 420, 90, 'MAIN MENU', () => g.toTitle(), 'primary');
  };

  BK.hud.pause = g => {
    if (g.showControls) { BK.hud.controls(g); return; }
    dim(0.7);
    strokeText('PAUSED', W / 2, 210, F.display(110), PAL.bone, 12);
    D.text(`ROUND ${g.round} OF ${g.totalRounds}  ·  ${g.p1.look.name} vs ${g.p2.look.name}`, W / 2, 290, F.ui(26), PAL.brass);
    UI.button(W / 2, 400, 460, 92, 'RESUME', () => g.resume(), 'primary');
    UI.button(W / 2 - 240, 520, 440, 84, 'CONTROLS', () => { g.showControls = true; });
    UI.button(W / 2 + 240, 520, 440, 84, BK.settings.sound ? 'SOUND: ON' : 'SOUND: OFF', () => { BK.settings.sound = !BK.settings.sound; BK.audio.setEnabled(BK.settings.sound); BK.saveSettings(); });
    UI.button(W / 2 - 240, 630, 440, 84, BK.settings.vibrate ? 'RUMBLE: ON' : 'RUMBLE: OFF', () => { BK.settings.vibrate = !BK.settings.vibrate; BK.saveSettings(); });
    UI.button(W / 2 + 240, 630, 440, 84, 'QUIT FIGHT', () => g.toTitle());
    D.text('Options resumes  ·  ○ back', W / 2, 720, F.ui(22), 'rgba(239,230,210,0.6)');
  };

  // Button assignments, reachable from the pause menu and the title screen.
  BK.hud.controls = g => {
    dim(0.8);
    D.text('CONTROLS', W / 2, 80, F.display(64), PAL.brass);
    const col = (x, title, rows) => {
      D.text(title, x, 150, F.ui(26), PAL.brass);
      rows.forEach(([k, v], i) => {
        D.text(k, x - 16, 196 + i * 40, F.display(26), PAL.bone, 'right');
        D.text(v, x + 16, 196 + i * 40, F.ui(26, 500), 'rgba(239,230,210,0.85)', 'left');
      });
    };
    col(330, 'CONTROLLER', [['Left stick / D-pad', 'Move'], ['✕', 'Jab'], ['○', 'Cross'], ['□', 'Hook'], ['△', 'Uppercut'], ['L1', 'Clinch'], ['R1 (hold)', 'Body shot'], ['L2', 'Sway / duck / combo'], ['R2 (hold)', 'Block'], ['R3', 'Super punch'], ['Options', 'Pause'], ['D-pad + ✕', 'Menus (○ back)']]);
    col(900, 'TOUCH', [['Left half', 'Drag to move'], ['JAB CROSS HOOK UPPER', 'Punches'], ['CLINCH', 'Clinch'], ['BODY (hold)', 'Body shot'], ['SWAY / DUCK / COMBO', 'Sway'], ['BLOCK (hold)', 'Block'], ['SUPER / DUSTER', 'Super punch'], ['⏸ under the clock', 'Pause']]);
    col(1440, 'KEYBOARD', [['WASD', 'Move'], ['J K U I', 'Punches'], ['C', 'Clinch'], ['B (hold)', 'Body shot'], ['Space', 'Sway'], ['L (hold)', 'Block'], ['O', 'Super punch'], ['P / Esc', 'Pause'], ['Player 2', 'Arrows, 1-9']]);
    UI.button(W / 2, 790, 360, 80, 'BACK', () => { g.showControls = false; }, 'primary');
  };
})();
