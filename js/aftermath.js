// After a knockout: a 10-second cut scene. The winner stands over the man on the floor shouting
// "FIGHT FUCKING NOW!" and keeps putting the boot in (stamps, kicks and punches on the ground) before
// the result screen. Only when the loser is actually down; letterboxed; tap / any button to skip.
(() => {
  'use strict';
  const BK = window.BK, ctx = BK.ctx, D = BK.draw, W = BK.W, H = BK.H, PAL = BK.PAL, F = BK.FONT;
  const { lerp, clamp } = BK;

  const LEN = 10, WALK = 1.4, BEAT = 0.75, END = 9.3;
  const MOVES = ['stomp', 'kick', 'pound', 'pound', 'kick', 'stomp', 'kick', 'pound', 'stomp', 'kick'];
  const SHOUTS = [[0.4, 3.0], [5.6, 7.6]]; // when the speech bubble is up
  const AM = BK.aftermath = { active: false };

  AM.start = (g, winner, loser) => {
    Object.assign(AM, { active: true, g, w: winner, l: loser, t: 0, hitIdx: -1, from: { u: winner.u, z: winner.z }, pose: BK.rig.make() });
    const w = winner;
    w.celebrate = false; w.extraPose = null; w.punch = null; w.blocking = false; w.slip = null; w.stagger = 0; w.stun = 0;
    w.cutPose = AM.pose; w.cutW = 0;
    // the referee backs off to the far side of the body, waving it off
    g.ref.mode = 'wave'; g.ref.u = clamp(loser.u + loser.dir * 0.24, BK.U_MIN, BK.U_MAX); g.ref.z = clamp(loser.z - 0.12, BK.Z_MIN, BK.Z_MAX);
  };
  AM.skip = () => { if (AM.active) AM.done = true; };
  function stop() {
    AM.active = false; AM.done = false;
    if (AM.w) { AM.w.cutPose = null; AM.w.cutW = 0; }
  }

  // where he stands: just in front of the body (nearer the camera), by the loser's hips, facing along him
  // toward his head. The body lies away from where the loser was facing, head furthest out.
  function spot() {
    const l = AM.l, z = clamp(l.z + 0.06, BK.Z_MIN, BK.Z_MAX), x = l.sx - l.dir * 40 * l.fs;
    const u = clamp((x - BK.ringL(z)) / (BK.ringR(z) - BK.ringL(z)), BK.U_MIN, BK.U_MAX);
    return { u, z };
  }
  const target = () => { // on the body, where the blows land
    const l = AM.l, k = AM.hitIdx % 3 === 2 ? 0.85 : 0.55; // mostly the ribs, now and then the head
    return { x: l.sx - l.dir * lerp(60, 230, k) * l.fs, y: l.sy - 40 * l.fs };
  };

  AM.update = dt => {
    if (!AM.active) return true;
    const g = AM.g, w = AM.w, l = AM.l, R = BK.rig, PO = BK.POSES;
    const T = (AM.t += dt);
    l.update(dt, { mx: 0, my: 0 }, w); // lying there
    // walk over to him
    const s = spot(), k = BK.easeInOut(Math.min(1, T / WALK));
    const px = w.sx;
    w.u = lerp(AM.from.u, s.u, k); w.z = lerp(AM.from.z, s.z, k);
    w.t += dt; w.moving = T < WALK ? 1 : 0; w.walk += dt * 11 * w.moving;
    w.dir = T < WALK ? (Math.abs(w.sx - px) > 0.2 ? Math.sign(w.sx - px) : w.dir) : -l.dir; // then face along the body
    // the beating: one move per beat, wind-up -> strike -> recover
    w.cutW = 0;
    if (T >= WALK && T < END) {
      const beat = Math.floor((T - WALK) / BEAT), bt = (T - WALK) % BEAT, move = MOVES[beat % MOVES.length];
      const A = PO[move + 'A'], X = PO[move + 'X'];
      if (bt < 0.3) { R.mix(AM.pose, PO.guard, A, BK.easeInOut(bt / 0.3), R.SUPER); w.cutW = 1; }
      else if (bt < 0.4) { R.mix(AM.pose, A, X, (bt - 0.3) / 0.1, R.SUPER); w.cutW = 1; }
      else { R.mix(AM.pose, X, PO.guard, BK.easeInOut((bt - 0.4) / (BEAT - 0.4)), R.SUPER); w.cutW = 1; }
      if (bt >= 0.4 && AM.hitIdx < beat) { AM.hitIdx = beat; impact(move); }
    } else if (T >= END) { w.celebrate = true; } // steps back, arms up
    w.animate(dt);
    g.ref.t += dt; g.ref.animate(dt);
    if (AM.done || T >= LEN) { stop(); return true; }
    return false;
  };

  function impact(move) {
    const w = AM.w, l = AM.l, p = target();
    BK.fx.blood(p.x, p.y, w.dir, l.sy, move === 'stomp' ? 1.6 : 1.1);
    l.blood = Math.min(1, l.blood + 0.03);
    l.sqV += move === 'stomp' ? 6 : 4; l.flash = 0.12; // the body jolts
    BK.audio.punch('power'); if (move === 'stomp') BK.audio.thump();
    BK.audio.roar(0.4); BK.audio.excite(0.2);
    BK.cam.shake = Math.max(BK.cam.shake, move === 'stomp' ? 12 : 7);
    w.grunt(Math.random() < 0.5 ? 'effortBig' : 'effort', true);
    if (Math.random() < 0.5) l.grunt('hurtBody');
  }

  AM.camera = c => {
    if (!AM.active) return;
    const w = AM.w, l = AM.l;
    c.tx = (w.sx + (l.sx - l.dir * 150 * l.fs)) / 2; c.ty = w.sy - 110; c.tz = 1.3;
  };

  // speech bubble over the winner: placed from his head on screen but drawn in HUD space, kept below the letterbox
  function bubble() {
    const on = SHOUTS.some(([a, b]) => AM.t >= a && AM.t <= b);
    if (!on) return;
    const w = AM.w, c = BK.cam, z = c.zoom;
    const pop = Math.min(1, SHOUTS.reduce((m, [a]) => (AM.t >= a ? AM.t - a : m), 0) * 8);
    let x = (w.headX + w.dir * 60 * w.fs - c.x) * z + W / 2, y = (w.headY - 90 * w.fs - c.y) * z + H / 2;
    ctx.font = F.display(40);
    const text = 'FIGHT FUCKING NOW!', tw = ctx.measureText(text).width + 44;
    x = clamp(x, tw / 2 + 20, W - tw / 2 - 20); y = clamp(y, 150, H - 220);
    const hx = (w.headX - c.x) * z + W / 2, hy = (w.headY - c.y) * z + H / 2; // the tail points at his mouth
    ctx.save(); ctx.translate(x, y); ctx.scale(pop, pop);
    const tx = clamp(hx - x, -tw / 2 + 30, tw / 2 - 30), ty = Math.max(70, hy - y - 20);
    ctx.beginPath(); ctx.moveTo(tx - 18, 30); ctx.lineTo(tx + (hx - x - tx) * 0.5, ty); ctx.lineTo(tx + 18, 30); ctx.closePath(); D.fillOut('#fbf8f0', 5);
    D.rr(-tw / 2, -40, tw, 80, 28); D.fillOut('#fbf8f0', 5);
    D.text(text, 0, 2, F.display(40), '#b3202a');
    ctx.restore();
  }
  AM.drawWorld = () => {};

  // letterbox bars and a skip hint (HUD space)
  AM.drawHud = () => {
    if (!AM.active) return;
    const a = Math.min(1, AM.t * 3) * Math.min(1, (LEN - AM.t) * 3);
    ctx.fillStyle = `rgba(0,0,0,${0.92 * a})`;
    ctx.fillRect(-W, -H, W * 3, H + 90); ctx.fillRect(-W, H - 90, W * 3, H + 90);
    D.text(`${AM.w.look.name} WON'T LEAVE IT`, W / 2, 48, F.display(36), `rgba(226,88,79,${a})`);
    bubble();
    D.text('TAP TO SKIP', W - 60, H - 44, F.ui(22), `rgba(239,230,210,${0.55 * a})`, 'right');
  };
})();
