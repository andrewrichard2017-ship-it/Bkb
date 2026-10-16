// Bubble Odyssey balance tool: a greedy bot plays every career level many times using the real game code,
// then suggests shots and 2-/3-star scores. Run:  node bubble/tools/sim.js [first] [last] [runs]
// Paste the printed TUNE array into js/levels.js.
'use strict';
global.window = global;
const path = require('path');
for (const f of ['core', 'board', 'levels', 'game']) require(path.join(__dirname, '..', 'js', f + '.js'));
const BB = global.BB;

function evalShot(game, p, ang, color, power, trace) {
  const b = game.board.clone();
  let res;
  if (power === 'fire') {
    const s = { x: p.x, y: p.y, dx: Math.cos(ang), dy: -Math.sin(ang) };
    res = { pops: [], cracks: [], drops: [], booms: [], freed: 0 };
    while (s.y > -1.5) { s.x += s.dx * 0.3; s.y += s.dy * 0.3; if (s.x < 1) { s.x = 2 - s.x; s.dx = -s.dx; } else if (s.x > 21) { s.x = 42 - s.x; s.dx = -s.dx; } b.burn(s.x, s.y, res); }
    b.dropLoose(res);
  } else {
    if (!trace.cell) return -1e9;
    res = b.land(trace.cell[0], trace.cell[1], { color, power }, () => 0.5);
  }
  const g = game.goal;
  let v = res.pops.length + res.drops.length * 1.6 + res.cracks.length * 0.4 + res.freed * (g === 'rescue' ? 14 : 2);
  if (g === 'boss') v = res.pops.length + res.drops.length * 2.2 + res.cracks.length * 0.3;
  if (res.placed && trace.cell) {
    const [r, c] = trace.cell;
    v += b.nbrs(r, c).filter(([a, cc]) => { const q = b.get(a, cc); return q && q.c === color; }).length * 0.35;
  }
  const low = b.lowest();
  v -= Math.max(0, low - 8) * (game.pushEvery() ? 1.2 : 0.6);
  if (b.over()) v -= 200;
  return v;
}

function play(n, shots, seed, skill, noise = 0.02) {
  const rnd = BB.rng(seed);
  const game = new BB.Game({ mode: 'career', level: n, players: [{ name: 'bot' }], headless: true, rnd });
  if (shots) game.shotsLeft = shots;
  game.begin();
  const p = game.players[0];
  let guard = 0;
  while (game.state === 'play' && guard++ < 600) {
    const cands = [];
    const N = 64;
    for (let i = 0; i <= N; i++) {
      const a = BB.MIN_A + (BB.MAX_A - BB.MIN_A) * i / N;
      const tr = BB.traceShot(game.board, p.x, p.y, a);
      if (p.power) cands.push({ a, v: evalShot(game, p, a, -1, p.power, tr), swap: false });
      else {
        cands.push({ a, v: evalShot(game, p, a, p.cur, null, tr), swap: false });
        if (p.next !== p.cur) cands.push({ a, v: evalShot(game, p, a, p.next, null, tr), swap: true });
      }
    }
    cands.sort((x, y) => y.v - x.v);
    // not a perfect player: sometimes takes the 2nd/3rd best idea, and aims a touch off
    const pick = rnd() < skill ? cands[0] : cands[Math.min(cands.length - 1, 1 + Math.floor(rnd() * 3))];
    if (pick.swap) game.swap(p);
    game.aim(p, pick.a + (rnd() - 0.5) * noise);
    game.fire(p);
    while (p.flying) game.update(1 / 60);
  }
  while (game.state === 'won' && !game.result) game.update(1 / 20);
  return { won: game.state === 'won', score: game.score, used: game.fired, left: game.shotsLeft };
}

const pct = (arr, q) => { const s = arr.slice().sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.floor(q * s.length))]; };
const first = +(process.argv[2] || 1), last = +(process.argv[3] || BB.LEVEL_COUNT), runs = +(process.argv[4] || 10);
const out = [];
// "casual" = an average player (often not the best idea, a shaky aim); "sharp" = a good player
const CASUAL = [0.15, 0.06], SHARP = [0.6, 0.015];
for (let n = first; n <= last; n++) {
  const w = Math.floor((n - 1) / 10), within = ((n - 1) % 10) / 9;
  // pass 1: how many shots does a casual player need, with plenty to spare?
  const a = [];
  for (let i = 0; i < runs; i++) a.push(play(n, 400, 77 + i * 131 + n, ...CASUAL));
  const wonA = a.filter(r => r.won);
  const need = wonA.length ? pct(wonA.map(r => r.used), 0.75) : 60;
  // more room early on, tighter towards the end of each world and in later worlds
  const slack = 1.3 - w * 0.06 - within * 0.06;
  const shots = Math.max(15, Math.ceil(need * slack) + 8 - w);
  // pass 2: scores with that many shots
  const casual = [], sharp = [];
  for (let i = 0; i < runs; i++) { casual.push(play(n, shots, 991 + i * 37 + n, ...CASUAL)); sharp.push(play(n, shots, 5 + i * 53 + n, ...SHARP)); }
  const cw = casual.filter(r => r.won), sw = sharp.filter(r => r.won);
  const t2 = cw.length ? Math.round(pct(cw.map(r => r.score), 0.5) / 50) * 50 : 0;
  const t3 = sw.length ? Math.round(pct(sw.map(r => r.score), 0.5) / 50) * 50 : 0;
  const spec = BB.level(n);
  out.push([shots, t2, Math.max(t3, t2 + 250)]);
  console.error(`L${n} ${spec.goal.padEnd(6)} need~${need} shots=${shots}  casual wins ${cw.length}/${runs}  sharp wins ${sw.length}/${runs}  2*=${t2} 3*=${Math.max(t3, t2 + 250)}  (bubbles ${BB.buildLevel(spec).board.count()})`);
}
console.log('  const TUNE = [\n' + out.map((t, i) => `    [${t.join(', ')}],` + ((first + i) % 10 === 0 ? ' // ' + BB.WORLDS[Math.floor((first + i - 1) / 10)].name : '')).join('\n') + '\n  ];');
