// Get-up minigame, shown while the referee counts over the player.
// Orbs appear one at a time with a ring closing in; tap the orb as the ring meets it.
// Each clean hit lifts the fighter further off the canvas; a miss costs a step.
// Every knockdown needs more hits, and the ring closes faster.
(() => {
  'use strict';
  const BK = window.BK, ctx = BK.ctx, D = BK.draw;
  const { clamp, lerp } = BK;
  const ORB_R = 50, PERFECT = 0.085, GOOD = 0.19;

  const G = BK.getup = { active: false, feedback: [] };

  G.start = (fighter, onDone) => {
    const n = fighter.kdTotal;
    Object.assign(G, {
      active: true, done: false, fighter, onDone,
      needed: Math.min(7, 2 + n + (BK.settings.difficulty === 2 ? 1 : 0)),
      approach: Math.max(0.55, 1.05 - 0.13 * (n - 1) - 0.05 * BK.settings.difficulty),
      progress: 0, orb: null, gap: 0.5, last: null, feedback: [], streak: 0,
    });
  };
  G.stop = () => { G.active = false; G.orb = null; };

  function spawn() {
    let x, y, tries = 0;
    do { x = BK.rnd(430, 1170); y = BK.rnd(300, 640); tries++; }
    while (G.last && Math.hypot(x - G.last.x, y - G.last.y) < 240 && tries < 20);
    G.orb = { x, y, t: 0 };
    G.last = { x, y };
  }

  G.update = dt => {
    for (const f of G.feedback) f.t += dt;
    G.feedback = G.feedback.filter(f => f.t < 0.7);
    if (!G.active || G.done) return;
    if (!G.orb) { G.gap -= dt; if (G.gap <= 0) spawn(); return; }
    G.orb.t += dt;
    if (G.orb.t > G.approach + GOOD) miss('MISSED');
  };

  function hit(label) {
    G.progress++; G.streak++;
    G.feedback.push({ text: label, x: G.orb.x, y: G.orb.y, t: 0, good: true, burst: true });
    BK.audio.tick(true);
    BK.vibrate(15);
    G.fighter.liftTarget = 0.12 + 0.5 * G.progress / G.needed;
    G.orb = null; G.gap = 0.22;
    if (G.progress >= G.needed) { G.done = true; G.onDone(); }
  }
  function miss(label) {
    G.progress = Math.max(0, G.progress - 1); G.streak = 0;
    G.feedback.push({ text: label, x: G.orb.x, y: G.orb.y, t: 0, good: false });
    BK.audio.tick(false);
    G.fighter.liftTarget = G.progress ? 0.12 + 0.5 * G.progress / G.needed : 0;
    G.orb = null; G.gap = 0.35;
  }

  // Touch: must land on the orb. Keyboard: timing only.
  G.tap = (x, y, keyboard) => {
    if (!G.active || G.done || !G.orb) return false;
    const o = G.orb;
    if (!keyboard && Math.hypot(x - o.x, y - o.y) > ORB_R * 2) return false;
    const d = Math.abs(o.t - G.approach);
    if (d < PERFECT) hit('PERFECT');
    else if (d < GOOD) hit('GOOD');
    else miss(o.t < G.approach ? 'TOO EARLY' : 'TOO LATE');
    return true;
  };

  G.draw = () => {
    if (!G.active) return;
    // progress meter
    const mw = 460, mx = BK.W / 2 - mw / 2, my = 250;
    BK.strokeText('TAP THE ORBS TO GET UP', BK.W / 2, my - 28, BK.FONT.ui(32), BK.PAL.bone, 6);
    const seg = mw / G.needed;
    for (let i = 0; i < G.needed; i++) {
      D.slant(mx + i * seg + 4, my, seg - 8, 18, 6);
      ctx.fillStyle = i < G.progress ? BK.PAL.brass : 'rgba(239,230,210,0.15)'; ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,0.6)'; ctx.lineWidth = 2; ctx.stroke();
    }
    const o = G.orb;
    if (o) {
      const k = clamp(o.t / G.approach, 0, 1.3);
      const ringR = lerp(ORB_R * 3.4, ORB_R, Math.min(1, k));
      const close = Math.abs(o.t - G.approach) < GOOD;
      const appear = Math.min(1, o.t / 0.12);
      ctx.save();
      ctx.globalAlpha = appear;
      // glow
      const glow = ctx.createRadialGradient(o.x, o.y, ORB_R * 0.5, o.x, o.y, ORB_R * 2.2);
      glow.addColorStop(0, close ? 'rgba(255,214,120,0.55)' : 'rgba(217,164,65,0.3)'); glow.addColorStop(1, 'rgba(217,164,65,0)');
      ctx.fillStyle = glow; D.circle(o.x, o.y, ORB_R * 2.2); ctx.fill();
      // orb body
      const g = ctx.createRadialGradient(o.x - 14, o.y - 16, 4, o.x, o.y, ORB_R);
      g.addColorStop(0, '#fff1c8'); g.addColorStop(0.45, BK.PAL.brass); g.addColorStop(1, '#6d4a14');
      D.circle(o.x, o.y, ORB_R * appear); ctx.fillStyle = g; ctx.fill();
      ctx.strokeStyle = BK.PAL.ink; ctx.lineWidth = 4; ctx.stroke();
      // closing ring
      ctx.strokeStyle = close ? '#fff' : BK.PAL.bone; ctx.lineWidth = close ? 7 : 5;
      D.circle(o.x, o.y, ringR); ctx.stroke();
      D.text('TAP', o.x, o.y + 2, BK.FONT.display(26), BK.PAL.ink);
      ctx.restore();
    }
    for (const f of G.feedback) {
      const a = 1 - f.t / 0.7;
      ctx.save(); ctx.globalAlpha = a;
      if (f.burst) { ctx.strokeStyle = BK.PAL.brass; ctx.lineWidth = 6 * a; D.circle(f.x, f.y, ORB_R + f.t * 180); ctx.stroke(); }
      ctx.lineWidth = 6; ctx.strokeStyle = BK.PAL.ink; ctx.font = BK.FONT.display(36); ctx.textAlign = 'center';
      ctx.strokeText(f.text, f.x, f.y - 70 - f.t * 40);
      ctx.fillStyle = f.good ? BK.PAL.brass : '#e2584f'; ctx.fillText(f.text, f.x, f.y - 70 - f.t * 40);
      ctx.restore();
    }
  };
})();
