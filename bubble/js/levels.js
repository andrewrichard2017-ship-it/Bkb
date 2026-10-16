// Bubble Odyssey: the five worlds, the 50 career levels, the shapes they're built from, and the generator
// that turns a level's recipe into a board (and the rows that arrive later). Everything here comes from the
// level's seed, so a level is always the same board, on every device.
(() => {
  'use strict';
  const BB = window.BB, { K, ROW_H, WIDTH } = BB;

  BB.WORLDS = [
    { id: 'meadow', name: 'Sunny Meadow', blurb: 'Rolling hills, lazy clouds and the first Blips to rescue.',
      boss: { name: 'Grumbletoad', kind: 'toad', body: '#5fbf4a', dark: '#2e7a2a', belly: '#d9f2a0' } },
    { id: 'reef', name: 'Coral Reef', blurb: 'Down where the light ripples. Watch out for ice and bombs.',
      boss: { name: 'Captain Clawdia', kind: 'crab', body: '#ff6a4d', dark: '#b8332a', belly: '#ffd0b0' } },
    { id: 'candy', name: 'Candy Clouds', blurb: 'Sugar-spun skies. Stars and chameleon bubbles appear.',
      boss: { name: 'Gumdrop Giant', kind: 'gum', body: '#ff7ac8', dark: '#b8408a', belly: '#ffe0f2' } },
    { id: 'caves', name: 'Crystal Caves', blurb: 'Glittering darkness, six colours and heavy stone.',
      boss: { name: 'Crystal Golem', kind: 'golem', body: '#8a7cff', dark: '#4a3fb0', belly: '#d6d0ff' } },
    { id: 'nebula', name: 'Cosmic Nebula', blurb: 'The final frontier. Everything at once.',
      boss: { name: 'The Void Squid', kind: 'squid', body: '#b05cff', dark: '#5a1fa0', belly: '#f0d8ff' } },
  ];

  // Recipe for each level. g: goal (c = clear the board, r = rescue the Blips, b = beat the boss),
  // s: shape, rows, col: colours, clump: how much neighbouring bubbles share a colour (higher = easier),
  // crit/stone/ice/bomb/star/cham: how many special bubbles, push: a new row every N shots,
  // extra: rows waiting above the ceiling, hp: boss health. shots and star scores are filled in below.
  const R = [
    // ---- Sunny Meadow ----
    { g: 'c', s: 'block', rows: 4, col: 3, clump: 0.78, tip: 'Match 3 or more of the same colour to pop them.' },
    { g: 'c', s: 'vee', rows: 6, col: 3, clump: 0.72, tip: 'Bounce shots off the walls to reach tricky spots.' },
    { g: 'r', s: 'block', rows: 6, col: 3, clump: 0.7, crit: 3, tip: 'Pop the bubbles holding Blips, or drop them, to set them free.' },
    { g: 'c', s: 'heart', rows: 9, col: 4, clump: 0.66, tip: 'Pop the bubbles holding others up and they all fall. Drops score double.' },
    { g: 'r', s: 'columns', rows: 7, col: 4, clump: 0.62, crit: 4 },
    { g: 'c', s: 'diamond', rows: 8, col: 4, clump: 0.6, stone: 4, tip: 'Stone bubbles can\'t be popped. Knock them loose so they fall.' },
    { g: 'r', s: 'zigzag', rows: 8, col: 4, clump: 0.56, crit: 5, stone: 3 },
    { g: 'c', s: 'chandelier', rows: 9, col: 4, clump: 0.56, tip: 'Cut the stems and whole bunches fall.' },
    { g: 'r', s: 'block', rows: 7, col: 4, clump: 0.55, crit: 5, push: 8, extra: 3, tip: 'Every few shots a new row pushes in. Don\'t let them reach the line.' },
    { g: 'b', s: 'block', rows: 6, col: 4, clump: 0.55, push: 6, hp: 50, tip: 'Every bubble you pop or drop hurts the boss. Drops hurt twice as much.' },
    // ---- Coral Reef ----
    { g: 'c', s: 'wave', rows: 8, col: 4, clump: 0.55, ice: 6, tip: 'Ice bubbles crack the first time they\'re matched, then pop the second.' },
    { g: 'r', s: 'ring', rows: 9, col: 4, clump: 0.52, crit: 5, ice: 4 },
    { g: 'c', s: 'tri', rows: 8, col: 4, clump: 0.5, push: 9, extra: 3 },
    { g: 'r', s: 'columns', rows: 8, col: 4, clump: 0.5, crit: 5, bomb: 3, tip: 'Pop bubbles next to a bomb and it blows up everything around it.' },
    { g: 'c', s: 'stripes', rows: 7, col: 5, clump: 0.5 },
    { g: 'r', s: 'diamond', rows: 9, col: 5, clump: 0.46, crit: 6, ice: 5, bomb: 2 },
    { g: 'c', s: 'heart', rows: 9, col: 5, clump: 0.46, ice: 6, push: 9, extra: 2 },
    { g: 'r', s: 'chandelier', rows: 10, col: 5, clump: 0.45, crit: 6, stone: 4 },
    { g: 'c', s: 'zigzag', rows: 9, col: 5, clump: 0.45, bomb: 3, push: 8, extra: 3 },
    { g: 'b', s: 'block', rows: 7, col: 5, clump: 0.46, push: 6, hp: 80, ice: 3 },
    // ---- Candy Clouds ----
    { g: 'c', s: 'block', rows: 8, col: 5, clump: 0.45, star: 2, tip: 'Hit a star and every bubble of your colour pops.' },
    { g: 'r', s: 'smile', rows: 10, col: 5, clump: 0.45, crit: 6, star: 2 },
    { g: 'c', s: 'ring', rows: 9, col: 5, clump: 0.44, cham: 5, tip: 'Chameleon bubbles change colour after every shot.' },
    { g: 'r', s: 'vee', rows: 8, col: 5, clump: 0.42, crit: 6, ice: 6, push: 8, extra: 3 },
    { g: 'c', s: 'arch', rows: 9, col: 5, clump: 0.42, bomb: 3, star: 1 },
    { g: 'r', s: 'columns', rows: 9, col: 5, clump: 0.42, crit: 7, cham: 4 },
    { g: 'c', s: 'hourglass', rows: 10, col: 5, clump: 0.42, stone: 6, bomb: 2 },
    { g: 'r', s: 'block', rows: 8, col: 5, clump: 0.4, crit: 7, ice: 8, push: 7, extra: 4 },
    { g: 'c', s: 'diamond', rows: 10, col: 5, clump: 0.4, cham: 6, star: 1, push: 8, extra: 3 },
    { g: 'b', s: 'block', rows: 7, col: 5, clump: 0.42, push: 5, hp: 110, star: 1, bomb: 1 },
    // ---- Crystal Caves ----
    { g: 'c', s: 'block', rows: 8, col: 6, clump: 0.42, tip: 'Six colours from here on. Plan your swaps!' },
    { g: 'r', s: 'chandelier', rows: 10, col: 5, clump: 0.4, crit: 7, stone: 6 },
    { g: 'c', s: 'wave', rows: 9, col: 6, clump: 0.4, ice: 8 },
    { g: 'r', s: 'ring', rows: 10, col: 6, clump: 0.38, crit: 7, bomb: 3 },
    { g: 'c', s: 'tri', rows: 9, col: 6, clump: 0.38, stone: 6, push: 7, extra: 4 },
    { g: 'r', s: 'heart', rows: 10, col: 6, clump: 0.37, crit: 8, ice: 6, cham: 3 },
    { g: 'c', s: 'zigzag', rows: 10, col: 6, clump: 0.37, bomb: 3, star: 2, push: 7, extra: 3 },
    { g: 'r', s: 'block', rows: 9, col: 6, clump: 0.36, crit: 8, stone: 8, push: 7, extra: 4 },
    { g: 'c', s: 'hourglass', rows: 10, col: 6, clump: 0.35, ice: 8, cham: 5, push: 7, extra: 3 },
    { g: 'b', s: 'block', rows: 8, col: 6, clump: 0.36, push: 5, hp: 140, stone: 3, bomb: 1 },
    // ---- Cosmic Nebula ----
    { g: 'c', s: 'star', rows: 10, col: 6, clump: 0.36, star: 2 },
    { g: 'r', s: 'arch', rows: 10, col: 6, clump: 0.35, crit: 8, cham: 5 },
    { g: 'c', s: 'block', rows: 9, col: 6, clump: 0.35, ice: 10, bomb: 3, push: 7, extra: 4 },
    { g: 'r', s: 'diamond', rows: 10, col: 6, clump: 0.34, crit: 8, stone: 8, star: 2 },
    { g: 'c', s: 'chandelier', rows: 10, col: 6, clump: 0.34, cham: 6, push: 6, extra: 4 },
    { g: 'r', s: 'wave', rows: 10, col: 6, clump: 0.33, crit: 9, ice: 8, bomb: 3, push: 7, extra: 4 },
    { g: 'c', s: 'ring', rows: 10, col: 6, clump: 0.32, stone: 8, cham: 6, star: 2, push: 6, extra: 4 },
    { g: 'r', s: 'columns', rows: 10, col: 6, clump: 0.32, crit: 9, ice: 10, stone: 6, push: 6, extra: 5 },
    { g: 'c', s: 'heart', rows: 10, col: 6, clump: 0.3, ice: 8, bomb: 4, cham: 6, push: 6, extra: 5 },
    { g: 'b', s: 'block', rows: 8, col: 6, clump: 0.32, push: 4, hp: 180, ice: 3, stone: 2, cham: 2 },
  ];
  // [shots, 2-star score, 3-star score] per level, from tools/sim.js (a greedy bot plays each level many times)
  const TUNE = [
    [18, 2200, 2450],
    [24, 2750, 3000],
    [15, 3000, 3250],
    [25, 4700, 4950],
    [21, 3750, 4000],
    [16, 4400, 4650],
    [17, 3700, 3950],
    [27, 3800, 4100],
    [23, 4550, 4850],
    [17, 2750, 3050], // Sunny Meadow
    [43, 5200, 5450],
    [16, 3950, 4200],
    [33, 4900, 5150],
    [15, 3450, 3700],
    [26, 3150, 3650],
    [27, 4200, 4550],
    [49, 5600, 6000],
    [25, 4300, 5500],
    [50, 4700, 5400],
    [25, 4000, 4250], // Coral Reef
    [24, 4350, 5750],
    [18, 4750, 5400],
    [37, 3700, 4600],
    [17, 4450, 4900],
    [18, 4100, 4700],
    [27, 4650, 6200],
    [15, 3000, 3250],
    [28, 5900, 7200],
    [47, 5550, 7150],
    [27, 4600, 5500], // Candy Clouds
    [48, 5250, 6650],
    [29, 4800, 5050],
    [46, 4300, 5800],
    [15, 3800, 4100],
    [70, 7700, 9000],
    [28, 4800, 5500],
    [52, 4850, 5750],
    [37, 7750, 8000],
    [59, 6750, 8000],
    [32, 5350, 5700], // Crystal Caves
    [16, 4850, 5100],
    [15, 5700, 6600],
    [67, 7300, 8600],
    [16, 5300, 6500],
    [48, 4900, 6750],
    [15, 3800, 4050],
    [86, 8700, 8950],
    [34, 6900, 8200],
    [48, 5100, 5750],
    [37, 7850, 8350], // Cosmic Nebula
  ];

  // ---- shapes: is the cell at (x, y) in board units (x 1..21, y from the ceiling) part of the pattern? ----
  const MID = WIDTH / 2;
  const SHAPES = {
    block: () => true,
    stripes: () => true,
    vee: (x, y, r, n) => Math.abs(x - MID) <= 10.6 * (1 - r / (n + 1)) + 0.6,
    tri: (x, y, r, n) => Math.abs(x - MID) <= 1.5 + 9.5 * r / Math.max(1, n - 1),
    diamond: (x, y, r, n) => { const cy = 1 + (n - 1) * ROW_H / 2; return Math.abs(x - MID) / 10.4 + Math.abs(y - cy) / (cy + 0.6) <= 1.05; },
    heart: (x, y, r, n) => {
      const h = 1 + (n - 1) * ROW_H, u = (x - MID) / 8.6, v = 1.12 - ((y - 1) / (h - 1)) * 2.16;
      const a = u * u + v * v - 1; return a * a * a - u * u * v * v * v <= 0;
    },
    columns: x => ((x + 1) % 7) < 4.5,
    zigzag: (x, y) => ((x + Math.abs(((y * 0.9) % 8) - 4) * 2.2) % 9) < 5.8,
    chandelier: (x, y, r, n) => {
      const stems = [4, 11, 18], blobY = 1 + (n - 3.2) * ROW_H;
      if (y < blobY - 2) return stems.some(s => Math.abs(x - s) < 1.6) || r === 0;
      return stems.some(s => Math.hypot(x - s, (y - blobY) * 1.05) < 3.6);
    },
    ring: (x, y, r, n) => { const cy = 1 + (n - 1) * ROW_H / 2, d = Math.hypot((x - MID) / 1.05, y - cy); return d < cy + 0.4 && d > cy - 4.4 || r === 0; },
    wave: (x, y, r, n) => { const h = 1 + (n - 1) * ROW_H; return y < 3 || Math.abs(y - (h * 0.55 + Math.sin(x * 0.55) * 3.2)) < 3.9; },
    smile: (x, y, r, n) => {
      const cy = 1 + (n - 1) * ROW_H / 2, d = Math.hypot(x - MID, y - cy);
      if (d > cy + 0.5) return false;
      if (Math.hypot(x - MID + 3.6, y - cy + 3) < 1.6 || Math.hypot(x - MID - 3.6, y - cy + 3) < 1.6) return false;
      const m = Math.hypot(x - MID, y - cy + 1.5); return !(m > 4.8 && m < 6.6 && y > cy + 1);
    },
    arch: (x, y, r, n) => { const h = 1 + (n - 1) * ROW_H, d = Math.hypot((x - MID) * 0.95, y + 2); return r === 0 || (d < h + 2.4 && d > h - 4.6); },
    hourglass: (x, y, r, n) => { const h = 1 + (n - 1) * ROW_H, t = Math.abs(y / h - 0.5) * 2; return Math.abs(x - MID) <= 2 + 8.8 * t; },
    star: (x, y, r, n) => {
      const cy = 1 + (n - 1) * ROW_H / 2, a = Math.atan2(y - cy, x - MID), d = Math.hypot(x - MID, y - cy);
      const rad = cy * (0.62 + 0.38 * Math.pow(Math.abs(Math.cos(2.5 * (a + Math.PI / 2))), 2.2)) + 0.8;
      return d < rad || r === 0 && Math.abs(x - MID) < 3;
    },
  };

  // make sure every part of the pattern hangs from the ceiling: hang loose bits on stems
  function connect(board) {
    for (let guard = 0; guard < 30; guard++) {
      const loose = board.floating();
      if (!loose.length) return;
      // the top-most loose cell grows a stem straight up
      loose.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
      let [r, c] = loose[0];
      const tx = board.x(r, c);
      while (r > 0) {
        const up = board.nbrs(r, c).filter(([a]) => a === r - 1);
        up.sort((p, q) => Math.abs(board.x(p[0], p[1]) - tx) - Math.abs(board.x(q[0], q[1]) - tx));
        [r, c] = up[0];
        if (board.get(r, c)) break;
        board.set(r, c, { c: 0, k: K.N });
      }
    }
  }

  // colours: patches grown around random seed points (bigger patches = easier), with a few strays
  function paint(board, rnd, cols, clump, pattern) {
    const cells = [];
    board.each((v, r, c) => cells.push({ v, x: board.x(r, c), y: board.y(r), r }));
    if (pattern === 'stripes') { for (const e of cells) e.v.c = Math.floor(e.r / 2 + (rnd() < 0.12 ? 1 : 0)) % cols; return; }
    const n = Math.max(cols, Math.round(cells.length * (1 - clump) * 0.42) + 2);
    const order = rnd.shuffle([...Array(cols).keys()]);
    const seeds = [];
    for (let i = 0; i < n; i++) { const e = cells[Math.floor(rnd() * cells.length)]; seeds.push({ x: e.x + rnd() - 0.5, y: e.y + rnd() - 0.5, c: order[i % cols] }); }
    for (const e of cells) {
      let best = seeds[0], bd = 1e9;
      for (const s of seeds) { const d = (s.x - e.x) ** 2 + (s.y - e.y) ** 2 * 1.3; if (d < bd) { bd = d; best = s; } }
      e.v.c = rnd() < (1 - clump) * 0.3 ? Math.floor(rnd() * cols) : best.c;
    }
  }
  function sprinkle(board, rnd, spec) {
    const cells = [];
    board.each((v, r, c) => cells.push([r, c]));
    rnd.shuffle(cells);
    const used = new Set(), low = board.lowest();
    const pick = (n, ok) => {
      const out = [];
      for (const [r, c] of cells) {
        if (out.length >= n) break;
        if (used.has(r * 16 + c) || !ok(r, c, out)) continue;
        used.add(r * 16 + c); out.push([r, c]);
      }
      return out;
    };
    const mark = (list, k) => { for (const [r, c] of list) { const v = board.get(r, c); v.k = k; if (!BB.hasColor(k)) v.c = -1; } };
    const apart = (r, c, list) => list.every(([a, b]) => Math.hypot(board.x(a, b) - board.x(r, c), board.y(a) - board.y(r)) > 3.5);
    // Blips sit lower down and spread out (if there's room)
    const crit = pick(spec.crit, (r, c, out) => r >= Math.min(2, low) && apart(r, c, out));
    mark(crit.concat(pick(spec.crit - crit.length, () => true)), K.CRIT);
    mark(pick(spec.stone, r => r > 0), K.STONE);
    mark(pick(spec.bomb, r => r > 0 && r >= low / 3), K.BOMB);
    mark(pick(spec.star, r => r > 0), K.STAR);
    mark(pick(spec.ice, () => true), K.ICE);
    mark(pick(spec.cham, () => true), K.CHAM);
  }

  // a row that arrives later (pushes and bosses): same palette and specials, scaled to one row
  BB.makeRowMaker = (spec, rnd) => {
    let prev = [];
    return (c, w) => {
      const per = n => (n || 0) / Math.max(4, spec.rows) / 11;
      if (c === 0) prev = [];
      const col = c > 0 && rnd() < spec.clump ? prev[c - 1] : Math.floor(rnd() * spec.col);
      prev[c] = col;
      const x = rnd();
      let k = K.N, acc = 0;
      for (const [kk, pp] of [[K.STONE, per(spec.stone)], [K.ICE, per(spec.ice)], [K.BOMB, per(spec.bomb) * 0.7], [K.STAR, per(spec.star) * 0.6], [K.CHAM, per(spec.cham)]]) { acc += pp; if (x < acc) { k = kk; break; } }
      return { c: BB.hasColor(k) ? col : -1, k };
    };
  };

  BB.LEVEL_COUNT = R.length;
  BB.level = n => {
    const base = R[n - 1];
    const w = Math.floor((n - 1) / 10);
    const tune = TUNE[n - 1] || [0, 0, 0];
    const spec = Object.assign({ n, world: w, clump: 0.5, crit: 0, stone: 0, ice: 0, bomb: 0, star: 0, cham: 0, push: 0, extra: 0, hp: 0 }, base);
    spec.goal = { c: 'clear', r: 'rescue', b: 'boss' }[base.g];
    spec.seed = 1000 + n * 7919;
    spec.shots = tune[0] || BB.guessShots(spec);
    spec.stars = [tune[1] || 0, tune[2] || 0];
    return spec;
  };
  // fallback before tuning: roughly one shot per three bubbles plus some slack
  BB.guessShots = spec => Math.round(spec.rows * 10 / (2.4 + spec.col * 0.1) + spec.extra * 3 + (spec.goal === 'boss' ? spec.hp / 2 : 6));

  // Build the board for a level (or endless) from its recipe. Returns { board, queue: [rows...], rowMaker, critters }.
  BB.buildLevel = spec => {
    const rnd = BB.rng(spec.seed);
    const board = new BB.Board(14);
    const shape = SHAPES[spec.s] || SHAPES.block;
    for (let r = 0; r < spec.rows; r++)
      for (let c = 0, w = board.width(r); c < w; c++)
        if (shape(board.x(r, c), board.y(r), r, spec.rows)) board.set(r, c, { c: 0, k: K.N });
    // keep the outline tidy: no lonely bubbles poking out
    board.each((v, r, c) => { if (r > 0 && board.nbrs(r, c).filter(([a, b]) => board.get(a, b)).length === 0) board.rows[r][c] = null; });
    connect(board);
    paint(board, rnd, spec.col, spec.clump, spec.s);
    sprinkle(board, rnd, spec);
    board.trim();
    const rowMaker = BB.makeRowMaker(spec, rnd);
    const queue = [];
    for (let i = 0; i < (spec.extra || 0); i++) { const tmp = new BB.Board(); tmp.par = board.par ^ ((i + 1) & 1); const row = []; for (let c = 0, wd = tmp.width(0); c < wd; c++) row.push(rowMaker(c, wd)); queue.push(row); }
    return { board, queue, rowMaker, critters: board.critters() };
  };

  // Endless: rows keep coming, with more colours and more specials as the score climbs.
  BB.endlessSpec = () => ({ n: 0, world: 0, goal: 'endless', s: 'block', rows: 6, col: 4, clump: 0.5, crit: 0, stone: 0, ice: 0, bomb: 0, star: 0, cham: 0, push: 7, extra: 0, hp: 0, shots: 0, stars: [0, 0], seed: (Math.random() * 1e9) >>> 0 });
})();
