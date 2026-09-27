// Get-up minigame, shown while the referee counts over a human fighter.
// Rhythm bar: a marker sweeps back and forth; press (✕ on a pad, Space/Enter, or tap anywhere)
// while it's inside the gold zone. Each hit lifts the fighter further off the canvas and moves the
// zone; a miss costs a step and briefly locks you out, so mashing doesn't work.
// The first two knockdowns are deliberately forgiving; after that the zone shrinks and the marker speeds up.
(() => {
  'use strict';
  const BK = window.BK, ctx = BK.ctx, D = BK.draw, PAL = BK.PAL, F = BK.FONT;
  const { clamp } = BK;

  // per knockdown: hits needed, zone width (share of the bar), marker speed (bar lengths per second)
  const LEVELS = [
    { needed: 2, zone: 0.34, speed: 0.45 },
    { needed: 3, zone: 0.28, speed: 0.55 },
    { needed: 4, zone: 0.17, speed: 0.85 },
    { needed: 5, zone: 0.12, speed: 1.05 },
  ];
  const BAR = { x: 450, y: 650, w: 700, h: 44 };

  const G = BK.getup = { active: false, feedback: [] };

  G.start = (fighter, onDone) => {
    const lv = LEVELS[clamp(fighter.kdTotal - 1, 0, LEVELS.length - 1)];
    const hard = BK.settings.difficulty === 2 && fighter.kdTotal > 2 ? 1.1 : 1; // hard mode only bites from the 3rd
    Object.assign(G, {
      active: true, done: false, fighter, onDone,
      needed: lv.needed, zoneW: lv.zone / hard, speed: lv.speed * hard,
      progress: 0, pos: 0, dir: 1, lock: 0, pause: 0.6, shake: 0, feedback: [],
    });
    newZone();
  };
  G.stop = () => { G.active = false; };

  // keep the new zone away from the marker, so every hit needs a fresh, timed press
  function newZone() {
    const half = G.zoneW / 2 + 0.04;
    let c, tries = 0;
    do { c = BK.rnd(half, 1 - half); tries++; }
    while (Math.abs(c - G.pos) < G.zoneW && tries < 20);
    G.zone = c;
  }

  G.update = dt => {
    for (const f of G.feedback) f.t += dt;
    G.feedback = G.feedback.filter(f => f.t < 0.8);
    G.shake = Math.max(0, G.shake - dt * 3);
    if (!G.active || G.done) return;
    G.lock = Math.max(0, G.lock - dt);
    if (G.pause > 0) { G.pause -= dt; return; }
    G.pos += G.dir * G.speed * dt;
    if (G.pos >= 1) { G.pos = 1; G.dir = -1; }
    if (G.pos <= 0) { G.pos = 0; G.dir = 1; }
  };

  // Any tap / press counts (no position check). Returns true when the input was used.
  G.tap = () => {
    if (!G.active || G.done) return false;
    if (G.lock > 0 || G.pause > 0) return true;
    const off = Math.abs(G.pos - G.zone), half = G.zoneW / 2;
    const x = BAR.x + G.pos * BAR.w;
    if (off <= half) {
      G.progress++;
      G.feedback.push({ text: off < half * 0.35 ? 'PERFECT' : 'GOOD', x, good: true, t: 0 });
      BK.audio.tick(true); BK.vibrate(15, G.fighter.side);
      G.fighter.liftTarget = 0.12 + 0.5 * G.progress / G.needed;
      if (G.progress >= G.needed) { G.done = true; G.onDone(); return true; }
      G.pause = 0.25; newZone();
    } else {
      G.progress = Math.max(0, G.progress - 1);
      G.feedback.push({ text: (G.zone - G.pos) * G.dir > 0 ? 'TOO EARLY' : 'TOO LATE', x, good: false, t: 0 });
      BK.audio.tick(false);
      G.lock = 0.45; G.shake = 1;
      G.fighter.liftTarget = G.progress ? 0.12 + 0.5 * G.progress / G.needed : 0;
    }
    return true;
  };

  G.draw = () => {
    if (!G.active) return;
    const pad = BK.pad && BK.pad.slotFor(G.fighter.side) >= 0;
    const who = BK.game.twoPlayer ? `${G.fighter.side ? 'BLUE' : 'RED'} CORNER: ` : '';
    BK.strokeText(`${who}${pad ? 'PRESS ✕' : 'TAP'} IN THE GOLD TO GET UP`, BK.W / 2, BAR.y - 64, F.ui(32), PAL.bone, 6);

    // progress pips
    const pw = 46, gap = 12, total = G.needed * pw + (G.needed - 1) * gap, px0 = BK.W / 2 - total / 2;
    for (let i = 0; i < G.needed; i++) {
      D.slant(px0 + i * (pw + gap), BAR.y - 36, pw, 14, 5);
      ctx.fillStyle = i < G.progress ? PAL.brass : 'rgba(239,230,210,0.18)'; ctx.fill();
    }

    ctx.save(); ctx.translate((Math.random() - 0.5) * 14 * G.shake, 0);
    // track
    D.rr(BAR.x - 6, BAR.y - 6, BAR.w + 12, BAR.h + 12, 12); ctx.fillStyle = 'rgba(12,9,8,0.85)'; ctx.fill();
    ctx.strokeStyle = 'rgba(239,230,210,0.35)'; ctx.lineWidth = 2; ctx.stroke();
    // gold zone with a brighter "perfect" core
    const zx = BAR.x + (G.zone - G.zoneW / 2) * BAR.w, zw = G.zoneW * BAR.w;
    const g = ctx.createLinearGradient(zx, 0, zx + zw, 0);
    g.addColorStop(0, 'rgba(217,164,65,0.55)'); g.addColorStop(0.5, 'rgba(240,199,90,0.95)'); g.addColorStop(1, 'rgba(217,164,65,0.55)');
    D.rr(zx, BAR.y, zw, BAR.h, 8); ctx.fillStyle = g; ctx.fill();
    ctx.fillStyle = 'rgba(255,245,210,0.55)';
    ctx.fillRect(BAR.x + (G.zone - G.zoneW * 0.175) * BAR.w, BAR.y + 4, G.zoneW * 0.35 * BAR.w, BAR.h - 8);
    // marker (dimmed while locked out after a miss)
    const mx = BAR.x + G.pos * BAR.w, inZone = Math.abs(G.pos - G.zone) <= G.zoneW / 2;
    ctx.globalAlpha = G.lock > 0 ? 0.35 : 1;
    ctx.fillStyle = inZone ? '#fff' : PAL.bone;
    if (inZone) { ctx.shadowColor = 'rgba(255,230,150,0.9)'; ctx.shadowBlur = 16; }
    D.rr(mx - 5, BAR.y - 12, 10, BAR.h + 24, 4); ctx.fill();
    ctx.restore();

    for (const f of G.feedback) {
      ctx.save(); ctx.globalAlpha = 1 - f.t / 0.8;
      BK.strokeText(f.text, clamp(f.x, BAR.x + 90, BAR.x + BAR.w - 90), BAR.y + BAR.h + 42 + f.t * 20, F.display(34), f.good ? PAL.brass : '#e2584f', 6);
      ctx.restore();
    }
  };
})();
