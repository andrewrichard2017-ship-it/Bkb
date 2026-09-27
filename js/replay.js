// Instant replay of knockdowns and knockouts.
// Every frame of live action is recorded (fighters, referee, particles) into a short rolling
// buffer. On a knockdown the moment is played back TV-style: normal speed into the punch,
// heavy slow motion through the impact, a tight dutch-angle camera pushing in, letterbox bars,
// a washed-out grade and a REPLAY tag. Tap to skip.
(() => {
  'use strict';
  const BK = window.BK, ctx = BK.ctx, D = BK.draw, W = BK.W, H = BK.H, PAL = BK.PAL, F = BK.FONT;
  const { clamp, lerp } = BK;
  const KEEP = 3.2;        // seconds of history kept
  const BEFORE = 1.15, AFTER = 1.0;

  const RP = BK.replay = { buf: [], active: false };

  RP.clear = () => { RP.buf = []; RP.active = false; };

  RP.record = (t, g) => {
    if (RP.active) return;
    RP.buf.push({
      t,
      ents: [g.p1.snapshot(), g.p2.snapshot(), g.ref.snapshot()],
      parts: BK.fx.parts.map(p => [p.x, p.y, p.r, p.kind, Math.min(1, p.life / p.max * 2)]),
    });
    while (RP.buf.length && RP.buf[0].t < t - KEEP) RP.buf.shift();
  };

  // tHit: recorded time of the punch; focus: fighter who went down (for framing)
  RP.start = (tHit, victimIdx, attackerIdx, onDone) => {
    const frames = RP.buf.filter(f => f.t >= tHit - BEFORE && f.t <= tHit + AFTER);
    if (frames.length < 10) { onDone(); return; }
    RP.frames = frames; RP.tHit = tHit; RP.play = frames[0].t; RP.end = frames[frames.length - 1].t;
    RP.victim = victimIdx; RP.attacker = attackerIdx; RP.onDone = onDone; RP.active = true; RP.age = 0;
    RP.impactPlayed = false;
    const hit = frames.find(f => f.t >= tHit) || frames[frames.length - 1];
    const v = hit.ents[victimIdx], a = hit.ents[attackerIdx];
    RP.focus = { x: (v.headX + a.sx) / 2, y: v.headY + 40 };
    RP.tilt = (Math.random() < 0.5 ? -1 : 1) * 0.07;
  };

  RP.skip = () => { if (RP.active) { RP.active = false; RP.onDone(); } };

  // Speed ramps: real time into the punch, ~5x slow through the impact, then easing back up.
  function speed(rel) {
    if (rel < -0.22) return 0.9;
    if (rel < 0.35) return 0.2;
    return 0.6;
  }

  RP.update = dt => {
    if (!RP.active) return;
    RP.age += dt;
    const rel = RP.play - RP.tHit;
    RP.play += dt * speed(rel);
    if (!RP.impactPlayed && RP.play >= RP.tHit) {
      RP.impactPlayed = true;
      BK.audio.punch('counter'); BK.audio.thump(); BK.cam.shake = 10;
    }
    if (RP.play >= RP.end) { RP.active = false; RP.onDone(); }
  };

  function frameAt(t) {
    const fr = RP.frames;
    let i = 0;
    while (i < fr.length - 1 && fr[i + 1].t <= t) i++;
    return fr[i];
  }

  RP.drawWorld = (drawStage, gt) => {
    const f = frameAt(RP.play);
    const k = clamp((RP.play - RP.frames[0].t) / (RP.end - RP.frames[0].t), 0, 1);
    const zoom = lerp(1.55, 2.05, BK.easeInOut(k));
    ctx.save();
    ctx.translate(W / 2 + (Math.random() - 0.5) * BK.cam.shake, H / 2 + (Math.random() - 0.5) * BK.cam.shake);
    ctx.rotate(RP.tilt);
    ctx.scale(zoom, zoom);
    ctx.translate(-RP.focus.x, -RP.focus.y);
    drawStage(() => {
      f.ents.slice().sort((a, b) => a.z - b.z).forEach(e => BK.drawFigure(e));
      for (const [x, y, r, kind, a] of f.parts) {
        ctx.globalAlpha = a;
        ctx.fillStyle = kind === 'blood' ? '#9c1620' : kind === 'spark' ? PAL.bone : 'rgba(225,238,245,0.9)';
        D.circle(x, y, r); ctx.fill();
      }
      ctx.globalAlpha = 1;
    }, gt);
    ctx.restore();
    // washed-out TV replay grade
    ctx.save();
    ctx.globalCompositeOperation = 'saturation';
    ctx.fillStyle = 'rgba(128,128,128,0.5)'; ctx.fillRect(-W, -H, W * 3, H * 3);
    ctx.restore();
    ctx.fillStyle = 'rgba(40,30,20,0.12)'; ctx.fillRect(-W, -H, W * 3, H * 3);
  };

  RP.drawOverlay = () => {
    const bar = Math.min(1, RP.age * 5) * 96;
    ctx.fillStyle = '#000';
    ctx.fillRect(-W, -H, W * 3, H + bar); ctx.fillRect(-W, H - bar, W * 3, H + bar);
    // scanlines
    ctx.fillStyle = 'rgba(0,0,0,0.12)';
    for (let y = bar; y < H - bar; y += 6) ctx.fillRect(-W, y, W * 3, 2);
    const on = Math.floor(RP.age * 2.5) % 2 === 0;
    ctx.fillStyle = on ? '#e2584f' : 'rgba(226,88,79,0.3)'; D.circle(90, 48, 12); ctx.fill();
    D.text('REPLAY', 114, 50, F.display(40), PAL.bone, 'left');
    const rel = RP.play - RP.tHit, slow = rel > -0.22 && rel < 0.35;
    if (slow) D.text('SLOW MOTION', W - 60, 50, F.ui(28), PAL.brass, 'right');
    D.text('TAP TO SKIP', W / 2, H - 46, F.ui(26), 'rgba(239,230,210,0.7)');
  };
})();
