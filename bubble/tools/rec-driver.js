// Plays Bubble Odyssey for tools/record.js: a greedy bot (the same scoring idea as tools/sim.js) aims
// smoothly at its best shot and fires. Level 21 (Candy Clouds, Blips and star bubbles) for the first half,
// then the Candy boss (level 30) for the rest.
(() => {
  const BB = window.BB, G = BB.main, R = window.__rec;
  const SWITCH = +(new URLSearchParams(location.search).get('switch') || 10);
  let plan = null, wait = 0, phase = 0;

  function value(game, p, ang, color, power) {
    const tr = BB.traceShot(game.board, p.x, p.y, ang);
    if (!tr.cell || power === 'fire') return power === 'fire' ? 3 : -1e9;
    const b = game.board.clone();
    const res = b.land(tr.cell[0], tr.cell[1], { color, power }, () => 0.5);
    let v = res.pops.length + res.drops.length * 2 + res.freed * 8 + res.cracks.length * 0.4;
    if (res.placed) v += b.nbrs(tr.cell[0], tr.cell[1]).filter(([r, c]) => { const q = b.get(r, c); return q && q.c === color; }).length * 0.35;
    if (b.over()) v -= 200;
    return v;
  }
  function choose(game, p) {
    let best = { v: -1e9 };
    for (let i = 0; i <= 90; i++) {
      const a = BB.MIN_A + (BB.MAX_A - BB.MIN_A) * i / 90;
      if (p.power) { const v = value(game, p, a, -1, p.power); if (v > best.v) best = { a, v, swap: false }; continue; }
      const v1 = value(game, p, a, p.cur, null); if (v1 > best.v) best = { a, v: v1, swap: false };
      if (p.next !== p.cur) { const v2 = value(game, p, a, p.next, null); if (v2 > best.v + 0.5) best = { a, v: v2, swap: true }; }
    }
    return best;
  }
  const start = n => { G.start({ mode: 'career', level: n, players: [{ name: 'Bubbler' }] }); G.game.introT = 0.4; plan = null; wait = 0.5; };

  R.warm = 1.2;
  R.setup = () => { BB.save.inv = { bomb: 3, fire: 2, rainbow: 3, zap: 2, aim: 1, plus5: 1 }; start(21); };
  R.tick = t => {
    const g = G.game, dt = 1 / 30; if (!g) return;
    if (phase === 0 && t >= SWITCH) { phase = 1; start(30); return; }
    if (t >= 0 && phase === 0 && Math.abs(t - 5) < dt / 2) G.usePower('rainbow');
    if (t >= 0 && phase === 1 && Math.abs(t - SWITCH - 3.5) < dt / 2) G.usePower('bomb');
    const p = g.players[0]; p.ctl = 'mouse'; p.aiming = true;
    if (g.state !== 'play' && g.state !== 'intro') return;
    if (wait > 0) { wait -= dt; return; }
    if (p.flying) return;
    if (!plan) { plan = choose(g, p); plan.from = p.angle; plan.t = 0; plan.dur = 0.22 + Math.min(0.35, Math.abs(plan.a - p.angle) * 0.4); if (plan.swap) g.swap(p); }
    plan.t += dt;
    const k = Math.min(1, plan.t / plan.dur), e = k * k * (3 - 2 * k);
    g.aim(p, plan.from + (plan.a - plan.from) * e);
    if (k >= 1) { G.fire(p); plan = null; wait = 0.12; }
  };
})();
