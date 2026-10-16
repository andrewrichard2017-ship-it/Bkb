// Bubble Odyssey: the bubble board. Pure game logic with no drawing, so tools/sim.js can run it in Node:
// a hex grid hanging from the ceiling, moving a shot and snapping it into place, matching, the special
// bubbles (stone, ice, bomb, star, chameleon, trapped Blips), the power-up shots, and dropping whatever
// comes loose. Board units: bubble radius 1, grid 22 wide, rows alternate 11 and 10 bubbles.
(() => {
  'use strict';
  const BB = window.BB;
  const COLS = 11, ROW_H = Math.sqrt(3), WIDTH = COLS * 2;
  const K = { N: 0, STONE: 1, ICE: 2, BOMB: 3, STAR: 4, CHAM: 5, CRIT: 6 };
  const HIT = 1.66;            // a moving shot sticks when it gets this close to a bubble (2 = touching)
  const BLAST = 4.1;           // bombs clear everything within two rings
  const FIRE = 1.9;            // the fireball burns what it brushes past
  Object.assign(BB, { K, COLS, ROW_H, WIDTH, HIT });
  const hasColor = k => k === K.N || k === K.ICE || k === K.CHAM || k === K.CRIT;
  BB.hasColor = hasColor;

  class Board {
    constructor(limit = 14) { this.rows = []; this.par = 0; this.limit = limit; }
    long(r) { return ((r + this.par) & 1) === 0; }
    width(r) { return this.long(r) ? COLS : COLS - 1; }
    x(r, c) { return 1 + 2 * c + (this.long(r) ? 0 : 1); }
    y(r) { return 1 + r * ROW_H; }
    get(r, c) { const row = this.rows[r]; return row && c >= 0 && c < row.length ? row[c] : null; }
    set(r, c, v) {
      while (this.rows.length <= r) this.rows.push(new Array(this.width(this.rows.length)).fill(null));
      this.rows[r][c] = v;
    }
    trim() { while (this.rows.length && this.rows[this.rows.length - 1].every(v => !v)) this.rows.pop(); }
    clone() { const b = new Board(this.limit); b.par = this.par; b.rows = this.rows.map(row => row.map(v => v && Object.assign({}, v))); return b; }
    each(fn) { for (let r = 0; r < this.rows.length; r++) { const row = this.rows[r]; for (let c = 0; c < row.length; c++) if (row[c]) fn(row[c], r, c); } }
    nbrs(r, c) {
      const lo = this.long(r) ? c - 1 : c, out = [];
      const add = (rr, cc) => { if (rr >= 0 && cc >= 0 && cc < this.width(rr)) out.push([rr, cc]); };
      add(r, c - 1); add(r, c + 1); add(r - 1, lo); add(r - 1, lo + 1); add(r + 1, lo); add(r + 1, lo + 1);
      return out;
    }
    supported(r, c) { return r === 0 || this.nbrs(r, c).some(([a, b]) => this.get(a, b)); }
    count() { let n = 0; this.each(() => n++); return n; }
    critters() { let n = 0; this.each(v => { if (v.k === K.CRIT) n++; }); return n; }
    lowest() { for (let r = this.rows.length - 1; r >= 0; r--) if (this.rows[r].some(v => v)) return r; return -1; }
    colors() { const s = new Set(); this.each(v => { if (hasColor(v.k)) s.add(v.c); }); return [...s].sort((a, b) => a - b); }
    over() { return this.lowest() >= this.limit; }
    info(r, c, v) { return { r, c, x: this.x(r, c), y: this.y(r), color: v.c, k: v.k }; }

    // is a moving bubble at (x, y) touching anything?
    touching(x, y) {
      const r0 = Math.floor((y - 1) / ROW_H) - 1, h2 = HIT * HIT;
      for (let r = Math.max(0, r0); r <= r0 + 2 && r < this.rows.length; r++) {
        const row = this.rows[r], yy = this.y(r) - y;
        if (yy * yy >= h2) continue;
        for (let c = 0; c < row.length; c++) {
          if (!row[c]) continue;
          const xx = this.x(r, c) - x;
          if (xx * xx + yy * yy < h2) return true;
        }
      }
      return false;
    }
    // the free, supported cell nearest to (x, y): where a shot that stopped there settles
    snapCell(x, y) {
      const r0 = Math.max(0, Math.round((y - 1) / ROW_H));
      for (const span of [1, 2, 4]) {
        let best = null, bd = 1e9;
        for (let r = Math.max(0, r0 - span); r <= r0 + span; r++) {
          for (let c = 0, w = this.width(r); c < w; c++) {
            if (this.get(r, c) || !this.supported(r, c)) continue;
            const dx = this.x(r, c) - x, dy = this.y(r) - y, d = dx * dx + dy * dy;
            if (d < bd) { bd = d; best = [r, c]; }
          }
        }
        if (best) return best;
      }
      return [0, Math.max(0, Math.min(COLS - 1, Math.round((x - 1) / 2)))];
    }
    group(r, c, color) {
      const seen = new Set([r * 16 + c]), out = [[r, c]];
      for (let i = 0; i < out.length; i++) {
        for (const [a, b] of this.nbrs(out[i][0], out[i][1])) {
          const key = a * 16 + b, v = this.get(a, b);
          if (seen.has(key) || !v || !hasColor(v.k) || v.c !== color) continue;
          seen.add(key); out.push([a, b]);
        }
      }
      return out;
    }
    // everything no longer hanging from the ceiling
    floating() {
      const seen = new Set(), stack = [];
      const row0 = this.rows[0] || [];
      for (let c = 0; c < row0.length; c++) if (row0[c]) { seen.add(c); stack.push([0, c]); }
      while (stack.length) {
        const [r, c] = stack.pop();
        for (const [a, b] of this.nbrs(r, c)) { const key = a * 16 + b; if (!seen.has(key) && this.get(a, b)) { seen.add(key); stack.push([a, b]); } }
      }
      const out = [];
      this.each((v, r, c) => { if (!seen.has(r * 16 + c)) out.push([r, c]); });
      return out;
    }

    // ---- resolving a shot ----
    // Pops (or cracks) a list of cells; bombs that are hit, or next to anything that pops, go off too.
    // how: 'match' and 'star' only crack ice; 'blast' (bombs, lightning, fire) smashes everything.
    popCells(list, res, how) {
      const fuses = [];
      for (const [r, c] of list) {
        const v = this.get(r, c); if (!v) continue;
        if (v.k === K.ICE && how !== 'blast') { v.k = K.N; res.cracks.push(this.info(r, c, v)); continue; }
        this.rows[r][c] = null;
        res.pops.push(this.info(r, c, v));
        if (v.k === K.CRIT) res.freed++;
        if (v.k === K.BOMB && !v.lit) { v.lit = true; fuses.push([r, c]); }
        for (const [a, b] of this.nbrs(r, c)) { const n = this.get(a, b); if (n && n.k === K.BOMB && !n.lit) { n.lit = true; fuses.push([a, b]); } }
      }
      for (const [r, c] of fuses) this.explode(r, c, res);
    }
    explode(r, c, res) {
      const x0 = this.x(r, c), y0 = this.y(r), list = [];
      res.booms.push({ x: x0, y: y0 });
      this.each((v, rr, cc) => { const dx = this.x(rr, cc) - x0, dy = this.y(rr) - y0; if (dx * dx + dy * dy <= BLAST * BLAST) list.push([rr, cc]); });
      this.popCells(list, res, 'blast');
    }
    // A shot of { color, power } settles at (r, c). Returns what happened, for scoring, effects and the network.
    land(r, c, shot, rnd = Math.random) {
      const res = { r, c, x: this.x(r, c), y: this.y(r), color: shot.color, power: shot.power || null, pops: [], cracks: [], drops: [], booms: [], freed: 0, star: false, zap: null, placed: false };
      const P = shot.power;
      if (P === 'bomb') {
        this.set(r, c, { c: -1, k: K.BOMB, lit: true });
        this.explode(r, c, res);
        res.pops = res.pops.filter(p => !(p.r === r && p.c === c));   // the shot itself isn't a board bubble
      } else if (P === 'zap') {
        res.zap = [r, r - 1];
        const list = [];
        for (const rr of res.zap) for (let cc = 0, w = this.width(rr); rr >= 0 && cc < w; cc++) if (this.get(rr, cc)) list.push([rr, cc]);
        this.popCells(list, res, 'blast');
      } else if (P === 'rainbow') {
        this.set(r, c, { c: -1, k: K.N });
        const groups = [], seen = new Set();
        for (const [a, b] of this.nbrs(r, c)) {
          const v = this.get(a, b);
          if (!v || !hasColor(v.k) || seen.has(v.c)) continue;
          seen.add(v.c);
          const g = this.group(a, b, v.c);
          if (g.length >= 2) groups.push(g);
        }
        if (groups.length) {
          this.rows[r][c] = null;
          for (const g of groups) this.popCells(g, res, 'match');
        } else {
          const cs = [...seen];   // nothing to join: it settles as a neighbour's colour (or any colour)
          this.rows[r][c].c = cs.length ? cs[0] : Math.floor(rnd() * 3);
          res.placed = true;
        }
      } else {
        this.set(r, c, { c: shot.color, k: K.N });
        res.placed = true;
        const stars = this.nbrs(r, c).filter(([a, b]) => { const v = this.get(a, b); return v && v.k === K.STAR; });
        if (stars.length) {
          // a star next to where it lands pops every bubble of the shot's colour
          res.star = true; res.placed = false;
          const list = [[r, c], ...stars];
          this.each((v, rr, cc) => { if (hasColor(v.k) && v.c === shot.color && !(rr === r && cc === c)) list.push([rr, cc]); });
          this.popCells(list, res, 'star');
        } else {
          const g = this.group(r, c, shot.color);
          if (g.length >= 3) { res.placed = false; this.popCells(g, res, 'match'); }
        }
      }
      this.dropLoose(res);
      return res;
    }
    // the fireball burns through whatever it touches on its way up
    burn(x, y, res) {
      const r0 = Math.floor((y - 1) / ROW_H) - 1, list = [];
      for (let r = Math.max(0, r0); r <= r0 + 2 && r < this.rows.length; r++)
        for (let c = 0; c < this.rows[r].length; c++) {
          if (!this.rows[r][c]) continue;
          const dx = this.x(r, c) - x, dy = this.y(r) - y;
          if (dx * dx + dy * dy < FIRE * FIRE) list.push([r, c]);
        }
      if (list.length) this.popCells(list, res, 'blast');
      return list.length;
    }
    dropLoose(res) {
      for (const [r, c] of this.floating()) {
        const v = this.get(r, c);
        res.drops.push(this.info(r, c, v));
        if (v.k === K.CRIT) res.freed++;
        this.rows[r][c] = null;
      }
      this.trim();
    }
    // chameleons take the next colour after every shot
    cycle(colors) {
      if (!colors.length) return false;
      let any = false;
      this.each(v => { if (v.k === K.CHAM) { const i = colors.indexOf(v.c); v.c = colors[(i + 1) % colors.length]; any = true; } });
      return any;
    }
    // a new row slides in at the top and pushes everything down
    pushRow(make) {
      this.par ^= 1;
      const w = this.width(0), row = [];
      for (let c = 0; c < w; c++) row.push(make(c, w));
      this.rows.unshift(row);
    }

    // ---- compact form for the network: one number per cell ----
    toCodes() { return { par: this.par, rows: this.rows.map(row => row.map(v => v ? 1 + v.k * 8 + (v.c + 1) : 0)) }; }
    fromCodes(o) {
      this.par = o.par;
      this.rows = o.rows.map(row => row.map(n => n ? { k: (n - 1) >> 3, c: ((n - 1) & 7) - 1 } : null));
    }
  }
  BB.Board = Board;

  // Moves a shot { x, y, dx, dy, bounces } by dist, bouncing off the side walls. Returns 'ceil' or 'hit' when it sticks.
  BB.stepShot = (board, s, dist) => {
    let left = dist;
    while (left > 0) {
      const d = Math.min(0.25, left); left -= d;
      s.x += s.dx * d; s.y += s.dy * d;
      if (s.x < 1) { s.x = 2 - s.x; s.dx = -s.dx; s.bounces++; } else if (s.x > WIDTH - 1) { s.x = 2 * (WIDTH - 1) - s.x; s.dx = -s.dx; s.bounces++; }
      if (s.y <= 1) { s.y = 1; return 'ceil'; }
      if (board.touching(s.x, s.y)) return 'hit';
    }
    return null;
  };
  // Where would a shot fired from (x, y) at angle ang (radians, 0 = right, PI/2 = straight up) end up?
  BB.traceShot = (board, x, y, ang, maxLen = 220) => {
    const s = { x, y, dx: Math.cos(ang), dy: -Math.sin(ang), bounces: 0 };
    const pts = [{ x, y }];
    let len = 0, hit = null;
    while (len < maxLen && !hit) { hit = BB.stepShot(board, s, 0.5); len += 0.5; pts.push({ x: s.x, y: s.y }); }
    return { pts, cell: hit ? board.snapCell(s.x, s.y) : null, end: { x: s.x, y: s.y }, bounces: s.bounces };
  };
})();
