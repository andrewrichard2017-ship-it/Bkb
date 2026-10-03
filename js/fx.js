// Particles (sweat, blood, block sparks), blood left on the canvas, and floating callouts.
(() => {
  'use strict';
  const BK = window.BK, ctx = BK.ctx, D = BK.draw;
  const FX = BK.fx = { parts: [], decals: [], popups: [] };

  FX.clear = () => { FX.parts = []; FX.decals = []; FX.popups = []; };

  // x,y: impact point in world coords. dir: direction the punch travels. floorY: canvas height under the fighter.
  FX.impact = (x, y, dir, floorY, kind, amount = 1) => {
    const n = Math.round((kind === 'blocked' ? 6 : 10) * amount);
    for (let i = 0; i < n; i++) {
      const a = (dir > 0 ? 0 : Math.PI) + BK.rnd(-0.9, 0.9) - 0.35;
      const v = BK.rnd(160, 420) * (kind === 'blocked' ? 0.7 : 1);
      FX.parts.push({ kind: kind === 'blocked' ? 'spark' : 'sweat', x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 60,
        life: BK.rnd(0.3, 0.55), max: 0.55, r: BK.rnd(2, 4.5), floorY });
    }
  };
  FX.blood = (x, y, dir, floorY, amount = 1) => {
    const n = Math.round(9 * amount);
    for (let i = 0; i < n; i++) {
      const a = (dir > 0 ? 0 : Math.PI) + BK.rnd(-0.7, 0.5) * (dir > 0 ? 1 : -1) - 0.25 * dir;
      const v = BK.rnd(120, 340);
      FX.parts.push({ kind: 'blood', x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 90,
        life: 2, max: 2, r: BK.rnd(2.5, 5), floorY: floorY + BK.rnd(-18, 18) });
    }
  };
  // Gerry: a gob of spit that flies at the other man's face
  FX.spit = (x, y, dir, opp, floorY) => {
    const tx = opp.headX, ty = opp.headY, d = Math.max(60, Math.abs(tx - x)), v = d * 3.2;
    FX.parts.push({ kind: 'spit', x, y, vx: dir * v, vy: (ty - y) * 3.2 - 40, life: 0.32, max: 0.32, r: 4, floorY });
    for (let i = 0; i < 3; i++) FX.parts.push({ kind: 'spit', x, y, vx: dir * v * BK.rnd(0.6, 1), vy: (ty - y) * 3 + BK.rnd(-60, 20), life: 0.3, max: 0.3, r: 2, floorY });
  };
  // the kettle: an arc of scalding water, then steam coming off him
  FX.water = (x, y, dir, floorY, amount = 1) => {
    for (let i = 0; i < 26 * amount; i++) {
      const a = (dir > 0 ? 0 : Math.PI) + BK.rnd(-0.55, 0.15) * (dir > 0 ? 1 : -1);
      const v = BK.rnd(220, 520);
      FX.parts.push({ kind: 'water', x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - BK.rnd(80, 200), life: BK.rnd(0.5, 0.9), max: 0.9, r: BK.rnd(2.5, 5.5), floorY: floorY + BK.rnd(-16, 16) });
    }
  };
  FX.steam = (x, y, dir, floorY) => {
    for (let i = 0; i < 22; i++) FX.parts.push({ kind: 'steam', x: x + BK.rnd(-30, 30), y: y + BK.rnd(-40, 40), vx: BK.rnd(-25, 25) - dir * 10, vy: BK.rnd(-90, -40),
      life: BK.rnd(0.9, 1.8), max: 1.8, r: BK.rnd(8, 18), floorY, nog: true });
  };
  FX.drip = (x, y, floorY) => FX.parts.push({ kind: 'blood', x, y, vx: BK.rnd(-10, 10), vy: 20, life: 3, max: 3, r: 2.5, floorY });

  FX.popup = (text, x, y, color = BK.PAL.brass, size = 46) => {
    FX.popups.push({ text, x, y, color, size, t: 0, life: 1.1 });
  };

  FX.update = dt => {
    for (const p of FX.parts) {
      p.x += p.vx * dt; p.y += p.vy * dt; p.vy += p.nog ? -30 * dt : 980 * dt; p.life -= dt;
      if (p.kind === 'steam') p.r += 14 * dt;
      if (p.kind === 'water' && p.vy > 0 && p.y >= p.floorY) p.life = Math.min(p.life, 0.08);
      if (p.kind === 'blood' && p.vy > 0 && p.y >= p.floorY) {
        p.life = 0;
        if (FX.decals.length < 320) FX.decals.push({ x: p.x, y: p.floorY, rx: p.r * BK.rnd(1.6, 3.4), ry: p.r * BK.rnd(0.6, 1.1), a: BK.rnd(0.5, 0.85) });
      }
    }
    FX.parts = FX.parts.filter(p => p.life > 0);
    for (const p of FX.popups) p.t += dt;
    FX.popups = FX.popups.filter(p => p.t < p.life);
  };

  FX.drawDecals = () => {
    for (const d of FX.decals) {
      ctx.fillStyle = `rgba(120,14,20,${d.a})`;
      ctx.beginPath(); ctx.ellipse(d.x, d.y, d.rx, d.ry, 0, 0, Math.PI * 2); ctx.fill();
    }
  };
  FX.drawParticles = () => {
    for (const p of FX.parts) {
      const a = Math.min(1, p.life / p.max * 2);
      ctx.globalAlpha = a;
      if (p.kind === 'steam') { ctx.globalAlpha = a * 0.35; ctx.fillStyle = '#ece8e2'; D.circle(p.x, p.y, p.r); ctx.fill(); continue; }
      ctx.fillStyle = p.kind === 'blood' ? '#9c1620' : p.kind === 'spark' ? BK.PAL.bone : p.kind === 'spit' ? 'rgba(200,232,140,0.95)' : p.kind === 'water' ? 'rgba(210,235,245,0.9)' : 'rgba(225,238,245,0.9)';
      D.circle(p.x, p.y, p.r); ctx.fill();
    }
    ctx.globalAlpha = 1;
  };
  FX.drawPopups = () => {
    for (const p of FX.popups) {
      const k = p.t / p.life;
      const pop = p.t < 0.12 ? 1 + (0.12 - p.t) * 4 : 1;
      ctx.save();
      ctx.globalAlpha = k < 0.7 ? 1 : 1 - (k - 0.7) / 0.3;
      ctx.translate(p.x, p.y - k * 60);
      ctx.scale(pop, pop);
      ctx.font = BK.FONT.display(p.size); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.lineWidth = 7; ctx.strokeStyle = BK.PAL.ink; ctx.lineJoin = 'round';
      ctx.strokeText(p.text, 0, 0);
      ctx.fillStyle = p.color; ctx.fillText(p.text, 0, 0);
      ctx.restore();
    }
  };
})();
