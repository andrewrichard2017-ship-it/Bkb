// Corner minigame, played between rounds.
//   1. CUTMAN  - cuts and swellings pop up on a close-up of your face; tap each before it bleeds.
//   2. BREATHE - a breathing ring swells toward a target; tap as it lines up, three times.
// The better the corner, the more health comes back and the more the swelling goes down.
(() => {
  'use strict';
  const BK = window.BK, ctx = BK.ctx, D = BK.draw, W = BK.W, PAL = BK.PAL, F = BK.FONT;
  const { clamp } = BK;

  const FRAME = { x: 500, y: 470, r: 270 };            // close-up medallion in HUD space
  const HEAD = { x: FRAME.x - 16, y: FRAME.y + 6 * 5.2, s: 5.2 }; // head anchor so the face sits centred
  const RING = { x: 1130, y: 470, target: 150 };      // breathing ring
  // spots on the face (head-local coords) where damage can show up
  const FACE = [[18, -46], [25, -31], [21, -17], [8, -52], [11, -36], [28, -42], [3, -26], [15, -6], [-4, -44], [0, -12]];
  const toHud = (hx, hy) => ({ x: HEAD.x + (hx - 4) * HEAD.s, y: HEAD.y - 8 * HEAD.s + (hy + 30) * HEAD.s });

  const C = BK.corner = { active: false };

  C.start = (fighter, onDone) => {
    const total = clamp(3 + Math.round(fighter.damage * 6), 3, 8);
    const spots = FACE.slice().sort(() => Math.random() - 0.5).slice(0, total).map(([x, y], i) => {
      const p = toHud(x + BK.rnd(-3, 3), y + BK.rnd(-3, 3));
      return { x: p.x, y: p.y, at: 0.9 + i * 0.62, t: 0, state: 'wait' };
    });
    Object.assign(C, {
      active: true, fighter, onDone, phase: 'cuts', t: 0,
      spots, total, cleaned: 0, life: 1.3 - 0.12 * BK.settings.difficulty,
      breaths: [], breath: null, splashes: [], result: null,
    });
  };

  function nextBreath() {
    if (C.breaths.length >= 3) { finish(); return; }
    C.breath = { t: 0, judged: false };
  }
  const INHALE = 1.3, EXHALE = 0.8;
  const breathR = b => b.t < INHALE ? 50 + 180 * BK.easeInOut(b.t / INHALE) : 230 - 180 * BK.easeInOut((b.t - INHALE) / EXHALE);

  function finish() {
    const f = C.fighter, c = C.cleaned / C.total;
    const b = C.breaths.reduce((s, v) => s + v, 0) / 3;
    const score = c * 0.6 + b * 0.4;
    const hp = Math.round(12 + 16 * c + 12 * b);
    f.hp = Math.min(f.maxHp, f.hp + hp); f.ghostHp = f.hp;
    f.maxHp = Math.min(100, f.maxHp + Math.round(5 * c));
    f.damage = Math.max(0, f.damage - (0.05 + 0.15 * c));
    f.stamina = 100;
    const grade = score >= 0.85 ? 'GREAT CORNER' : score >= 0.6 ? 'GOOD WORK' : score >= 0.35 ? 'DECENT' : 'SLOPPY';
    C.result = { hp, grade, score, c, b };
    C.phase = 'done'; C.breath = null;
    BK.audio.roar(score * 0.4);
    C.onDone(C.result);
  }

  C.update = dt => {
    if (!C.active) return;
    C.t += dt;
    for (const s of C.splashes) s.t += dt;
    C.splashes = C.splashes.filter(s => s.t < 0.6);
    if (C.phase === 'cuts') {
      let open = 0;
      for (const s of C.spots) {
        if (s.state === 'wait' && C.t >= s.at) s.state = 'live';
        if (s.state === 'live') {
          s.t += dt;
          if (s.t > C.life) { s.state = 'missed'; s.mt = 0; BK.audio.tick(false); }
        }
        if (s.state === 'missed') s.mt += dt;
        if (s.state !== 'cleaned' && s.state !== 'missed') open++;
      }
      if (!open && C.spots.every(s => s.state === 'cleaned' || s.mt > 0.5)) { C.phase = 'breatheIntro'; C.t = 0; }
    } else if (C.phase === 'breatheIntro') {
      if (C.t > 1.1) { C.phase = 'breathe'; nextBreath(); }
    } else if (C.phase === 'breathe' && C.breath) {
      const b = C.breath;
      b.t += dt;
      if (!b.judged && b.t > INHALE) judge(null);
      if (b.t > INHALE + EXHALE) nextBreath();
    }
  };

  function judge(r) {
    const b = C.breath;
    b.judged = true;
    const d = r === null ? 999 : Math.abs(r - RING.target);
    const v = d < 14 ? 1 : d < 30 ? 0.6 : 0;
    C.breaths.push(v);
    b.label = v === 1 ? 'PERFECT' : v ? 'GOOD' : r === null ? 'MISSED' : r < RING.target ? 'TOO EARLY' : 'TOO LATE';
    b.good = v > 0;
    BK.audio.tick(v > 0);
    if (v) BK.vibrate(15);
  }

  // Returns true when the tap was used by the minigame.
  C.tap = (x, y, keyboard) => {
    if (!C.active) return false;
    if (C.phase === 'cuts') {
      const live = C.spots.filter(s => s.state === 'live');
      let best = null, bd = 1e9;
      for (const s of live) { const d = keyboard ? s.t : Math.hypot(x - s.x, y - s.y); if (d < bd) { bd = d; best = s; } }
      if (best && (keyboard || bd < 80)) {
        best.state = 'cleaned'; C.cleaned++;
        C.fighter.damage = Math.max(0, C.fighter.damage - 0.025); // swelling visibly goes down
        C.splashes.push({ x: best.x, y: best.y, t: 0 });
        BK.audio.whoosh(); BK.audio.tick(true); BK.vibrate(12);
      }
      return true;
    }
    if (C.phase === 'breathe' && C.breath && !C.breath.judged && C.breath.t < INHALE) { judge(breathR(C.breath)); return true; }
    return C.phase !== 'done';
  };

  C.draw = g => {
    if (!C.active) return;
    const f = C.fighter;
    ctx.fillStyle = 'rgba(10,7,6,0.8)'; ctx.fillRect(-W, -900, W * 3, 2700);
    D.slant(150, 90, 1300, 740, 24); ctx.fillStyle = PAL.panel; ctx.fill();
    ctx.strokeStyle = 'rgba(217,164,65,0.45)'; ctx.lineWidth = 2; ctx.stroke();
    D.text(`IN THE CORNER  ·  BETWEEN ROUNDS ${g.round} AND ${g.round + 1}`, W / 2, 135, F.ui(26), PAL.brass);

    // close-up of your fighter, breathing
    const breathe = C.phase === 'breathe' && C.breath ? (breathR(C.breath) - 50) / 180 : Math.sin(C.t * 3) * 0.2;
    ctx.save();
    D.circle(FRAME.x, FRAME.y, FRAME.r); ctx.fillStyle = '#221917'; ctx.fill();
    ctx.lineWidth = 6; ctx.strokeStyle = f.look.cornerColor; ctx.stroke();
    D.circle(FRAME.x, FRAME.y, FRAME.r - 6); ctx.clip();
    const sc = HEAD.s * (1 + breathe * 0.02);
    f.drawPortrait(HEAD.x, HEAD.y, sc, false);
    ctx.restore();

    if (C.phase === 'cuts') {
      for (const s of C.spots) {
        if (s.state === 'live') {
          const k = s.t / C.life, pop = Math.min(1, s.t / 0.12);
          ctx.save(); ctx.translate(s.x, s.y); ctx.scale(pop, pop);
          const gl = ctx.createRadialGradient(0, 0, 4, 0, 0, 40);
          gl.addColorStop(0, '#d63a3a'); gl.addColorStop(0.6, '#8e111a'); gl.addColorStop(1, 'rgba(142,17,26,0)');
          ctx.fillStyle = gl; D.circle(0, 0, 40); ctx.fill();
          ctx.fillStyle = 'rgba(255,220,220,0.7)'; D.circle(-8, -8, 5); ctx.fill();
          // time left
          ctx.strokeStyle = k > 0.7 ? '#e2584f' : PAL.brass; ctx.lineWidth = 7; ctx.lineCap = 'round';
          ctx.beginPath(); ctx.arc(0, 0, 50, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (1 - k)); ctx.stroke();
          ctx.restore();
        } else if (s.state === 'missed' && s.mt < 0.5) {
          ctx.strokeStyle = `rgba(160,20,28,${1 - s.mt * 2})`; ctx.lineWidth = 8; ctx.lineCap = 'round';
          ctx.beginPath(); ctx.moveTo(s.x, s.y); ctx.lineTo(s.x + 4, s.y + 30 + s.mt * 160); ctx.stroke();
        }
      }
      for (const sp of C.splashes) { // sponge splash
        const a = 1 - sp.t / 0.6;
        ctx.fillStyle = `rgba(190,225,240,${a})`;
        for (let i = 0; i < 9; i++) { const ang = i / 9 * Math.PI * 2; D.circle(sp.x + Math.cos(ang) * (20 + sp.t * 160), sp.y + Math.sin(ang) * (20 + sp.t * 160), 6 * a + 2); ctx.fill(); }
        BK.strokeText('CLEANED', sp.x, sp.y - 70 - sp.t * 40, F.display(30), PAL.bone, 6);
      }
      D.text('CUTMAN', RING.x, 270, F.display(64), PAL.bone);
      ctx.font = F.ui(30, 500); ctx.fillStyle = PAL.bone; ctx.textAlign = 'center';
      ctx.fillText('Tap each cut before it bleeds.', RING.x, 340);
      ctx.fillText('Every one you clean heals you', RING.x, 380);
      ctx.fillText('and brings the swelling down.', RING.x, 420);
      D.text(`${C.cleaned} / ${C.total} CLEANED`, RING.x, 520, F.display(48), PAL.brass);
    } else if (C.phase === 'breatheIntro' || C.phase === 'breathe') {
      D.text('BREATHE', RING.x, 200, F.display(64), PAL.bone);
      D.text('Tap as the ring meets the gold line', RING.x, 250, F.ui(28, 500), PAL.bone);
      ctx.strokeStyle = PAL.brass; ctx.lineWidth = 8; D.circle(RING.x, RING.y + 60, RING.target); ctx.stroke();
      ctx.strokeStyle = 'rgba(217,164,65,0.25)'; ctx.lineWidth = 36; D.circle(RING.x, RING.y + 60, RING.target); ctx.stroke();
      if (C.breath) {
        const r = breathR(C.breath), close = Math.abs(r - RING.target) < 30 && !C.breath.judged && C.breath.t < INHALE;
        ctx.strokeStyle = close ? '#fff' : PAL.bone; ctx.lineWidth = close ? 8 : 5;
        D.circle(RING.x, RING.y + 60, r); ctx.stroke();
        D.text(C.breath.t < INHALE ? 'IN...' : 'OUT...', RING.x, RING.y + 60, F.display(40), 'rgba(239,230,210,0.7)');
        if (C.breath.label) BK.strokeText(C.breath.label, RING.x, RING.y + 60 - RING.target - 50, F.display(36), C.breath.good ? PAL.brass : '#e2584f', 6);
      }
      for (let i = 0; i < 3; i++) {
        const v = C.breaths[i];
        D.circle(RING.x - 50 + i * 50, 790, 14);
        ctx.fillStyle = v === undefined ? 'rgba(239,230,210,0.15)' : v === 1 ? PAL.brass : v ? '#b88a3a' : '#7a2a2a'; ctx.fill();
      }
    } else if (C.phase === 'done') {
      const r = C.result;
      BK.strokeText(r.grade, RING.x, 250, F.display(r.grade.length > 10 ? 64 : 76), r.score >= 0.6 ? PAL.brass : PAL.bone, 10);
      D.text(`+${r.hp} HEALTH`, RING.x, 350, F.display(56), PAL.bone);
      D.text(`${Math.round(r.c * 100)}% OF CUTS CLEANED  ·  BREATHING ${Math.round(r.b * 100)}%`, RING.x, 410, F.ui(26), PAL.brass);
      D.text(r.c > 0.7 ? 'The swelling is going down.' : 'That eye is still closing.', RING.x, 460, F.ui(28, 500), PAL.bone);
      BK.ui.button(RING.x, 700, 440, 96, `START ROUND ${g.round + 1}`, () => { C.active = false; g.nextRound(); }, 'primary');
    }
  };
})();
