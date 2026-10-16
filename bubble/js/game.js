// Bubble Odyssey: one game session, with no drawing so tools/sim.js can play it. Launchers (one per player;
// two in co-op, sharing the board and the shots), shots in flight, scoring and combos, the fever meter that
// hands out power-ups, rows pushing in, bosses, and winning or losing. Everything that happens is emitted
// as an event; main.js turns events into sound and effects, net.js sends them to the other player.
(() => {
  'use strict';
  const BB = window.BB, { K, ROW_H, WIDTH } = BB, { clamp } = BB.math;
  const SPEED = 46;                                   // board units per second
  const LINE_Y = 1 + 13 * ROW_H + 1;                  // the danger line (bottom of row 13)
  const LAUNCH_Y = LINE_Y + 3.4;
  const BOARD_H = LAUNCH_Y + 2.6;
  const MIN_A = 0.17, MAX_A = Math.PI - 0.17;
  const FEVER_MAX = 34;
  const POWERS = ['bomb', 'fire', 'rainbow', 'zap'];
  Object.assign(BB, { SPEED, LINE_Y, LAUNCH_Y, BOARD_H, MIN_A, MAX_A, FEVER_MAX, POWERS });

  class Game {
    // cfg: { mode: 'career' | 'endless', level, players: [{ name, remote }], role: null | 'host' | 'guest', state? }
    constructor(cfg) {
      this.cfg = cfg; this.mode = cfg.mode; this.role = cfg.role || null;
      this.mirror = this.role === 'guest';             // the guest only shows what the host decides
      this.coop = cfg.players.length > 1;
      this.spec = cfg.mode === 'endless' ? Object.assign(BB.endlessSpec(), cfg.seed ? { seed: cfg.seed } : {}) : BB.level(cfg.level);
      this.rnd = cfg.rnd || Math.random;
      const L = BB.buildLevel(this.spec);
      this.board = L.board; this.queue = L.queue; this.rowMaker = L.rowMaker;
      this.goal = this.spec.goal;
      this.critTotal = L.critters; this.freed = 0;
      this.total = this.board.count() + this.queue.reduce((s, row) => s + row.length, 0);
      this.shotsLeft = this.goal === 'endless' ? Infinity : Math.round(this.spec.shots * (this.coop ? 1.15 : 1));
      this.shotsStart = this.shotsLeft;
      this.fired = 0; this.sincePush = 0; this.score = 0; this.combo = 0; this.bestCombo = 0; this.fever = 0;
      this.boss = this.goal === 'boss' ? { hp: this.spec.hp, max: this.spec.hp } : null;
      this.shots = []; this.shotId = 0;
      this.state = 'intro'; this.t = 0; this.introT = cfg.headless ? 0 : 2.2; this.bonusT = 0; this.result = null;
      this.listeners = [];
      const xs = this.coop ? [WIDTH * 0.29, WIDTH * 0.71] : [WIDTH / 2];
      this.players = cfg.players.map((p, i) => ({
        slot: i, name: p.name || 'Player ' + (i + 1), remote: !!p.remote, x: xs[i], y: LAUNCH_Y, angle: Math.PI / 2,
        cur: this.newColor(), next: this.newColor(), power: null, powerFrom: null, flying: null, aimShots: 0, swapT: 0, kick: 0,
      }));
      if (cfg.state) this.applyState(cfg.state, true);
    }
    on(fn) { this.listeners.push(fn); }
    emit(type, e = {}) { e.type = type; for (const fn of this.listeners) fn(e, this); }

    newColor() {
      const cs = this.board.colors();
      const pool = cs.length ? cs : [...Array(this.spec.col).keys()];
      return pool[Math.floor(this.rnd() * pool.length)];
    }
    // colours that have gone from the board can't be shot any more
    refreshColors() {
      const cs = this.board.colors();
      if (!cs.length) return;
      for (const p of this.players) {
        if (!cs.includes(p.cur)) p.cur = this.newColor();
        if (!cs.includes(p.next)) p.next = this.newColor();
      }
    }

    // ---- player actions ----
    aim(p, a) { p.angle = clamp(a, MIN_A, MAX_A); }
    canFire(p) { return (this.state === 'play' || this.state === 'intro') && !p.flying && (p.power || (this.shotsLeft > 0 && p.cur >= 0)); }
    fire(p, opts = {}) {
      if (!this.canFire(p)) return null;
      if (this.state === 'intro') this.begin();
      const power = p.power;
      const shot = this.spawnShot(p, { id: opts.id, angle: p.angle, color: opts.color !== undefined ? opts.color : power ? -1 : p.cur, power, fromInv: p.powerFrom === 'inv' }, true);
      if (power) { p.power = null; p.powerFrom = null; } else { if (!this.mirror) this.shotsLeft--; p.cur = p.next; p.next = this.mirror ? -1 : this.newColor(); }
      if (p.aimShots > 0) p.aimShots--;
      this.emit('fire', { p, shot });
      return shot;
    }
    // a shot in the air (also how the guest shows shots the host fired: net is true then)
    spawnShot(p, o, quiet) {
      const shot = { id: o.id || (this.role === 'guest' ? 'g' : 'h') + (++this.shotId), owner: p.slot, x: p.x, y: p.y, dx: Math.cos(o.angle), dy: -Math.sin(o.angle), bounces: 0,
        color: o.color, power: o.power || null, fromInv: !!o.fromInv, t: 0, angle: o.angle };
      p.angle = o.angle; p.flying = shot; p.kick = 1;
      this.shots.push(shot);
      if (!quiet) this.emit('fire', { p, shot, net: true });
      return shot;
    }
    swap(p) {
      if (p.power || p.next < 0 || this.state === 'won' || this.state === 'lost') return false;
      [p.cur, p.next] = [p.next, p.cur]; p.swapT = 1;
      this.emit('swap', { p });
      return true;
    }
    // arm a power-up from the backpack (career) for the next shot; again to put it back
    arm(p, k) {
      if (p.power && p.powerFrom !== 'inv') return false;
      if (p.power === k) { p.power = null; p.powerFrom = null; this.emit('arm', { p, k: null }); this.checkEnd(); return true; }
      p.power = k; p.powerFrom = 'inv';
      this.emit('arm', { p, k });
      return true;
    }
    addShots(n) { this.shotsLeft += n; this.emit('shots', { n }); }
    begin() { if (this.state === 'intro') { this.state = 'play'; this.emit('begin'); } }

    // ---- the frame ----
    update(dt) {
      this.t += dt;
      for (const p of this.players) { p.kick = Math.max(0, p.kick - dt * 5); p.swapT = Math.max(0, p.swapT - dt * 4); }
      if (this.state === 'intro') { this.introT -= dt; if (this.introT <= 0) this.begin(); }
      for (const s of this.shots.slice()) this.moveShot(s, dt);
      if (this.state === 'won' && !this.mirror) this.bonusTick(dt);
    }
    moveShot(s, dt) {
      s.t += dt;
      if (s.parked) return;
      if (s.power === 'fire') {
        let left = SPEED * 1.1 * dt;
        s.burned = s.burned || { pops: [], cracks: [], drops: [], booms: [], freed: 0 };
        while (left > 0) {
          const d = Math.min(0.3, left); left -= d;
          s.x += s.dx * d; s.y += s.dy * d;
          if (s.x < 1) { s.x = 2 - s.x; s.dx = -s.dx; s.bounces++; this.emit('bounce', { shot: s }); } else if (s.x > WIDTH - 1) { s.x = 2 * (WIDTH - 1) - s.x; s.dx = -s.dx; s.bounces++; this.emit('bounce', { shot: s }); }
          const before = s.burned.pops.length;
          if (this.board.burn(s.x, s.y, s.burned)) this.emit('burn', { shot: s, pops: s.burned.pops.slice(before), booms: s.burned.booms });
          if (s.y < -1.5) { this.finishFire(s); return; }
        }
        return;
      }
      const b0 = s.bounces;
      const hit = BB.stepShot(this.board, s, SPEED * dt);
      if (s.bounces !== b0) this.emit('bounce', { shot: s });
      if (!hit) { if (s.y > BOARD_H + 2) this.removeShot(s); return; }
      if (this.mirror) { s.parked = true; return; }   // the host says where it lands
      const [r, c] = this.board.snapCell(s.x, s.y);
      const res = this.board.land(r, c, s, this.rnd);
      this.removeShot(s);
      this.afterLand(s, res);
    }
    finishFire(s) {
      this.removeShot(s);
      if (this.mirror) return;
      const res = Object.assign({ r: -1, c: -1, x: s.x, y: 0, color: -1, power: 'fire', star: false, zap: null, placed: false }, s.burned);
      this.board.dropLoose(res);
      this.afterLand(s, res);
    }
    removeShot(s) {
      const i = this.shots.indexOf(s); if (i >= 0) this.shots.splice(i, 1);
      const p = this.players[s.owner]; if (p && p.flying === s) p.flying = null;
    }

    // scoring and everything that follows a shot settling
    afterLand(s, res) {
      if (this.state !== 'play' && this.state !== 'intro') return;
      const p = this.players[s.owner];
      this.fired++;
      const popped = res.pops.length, dropped = res.drops.length;
      if (popped + dropped > 0) this.combo++; else this.combo = 0;
      this.bestCombo = Math.max(this.bestCombo, this.combo);
      const mult = this.combo > 1 ? Math.min(4, 1 + (this.combo - 1) * 0.5) : 1;
      const dropBonus = dropped >= 5 ? dropped * dropped * 2 : 0;
      const pts = Math.round((popped * 10 + dropped * 20 + dropBonus + res.cracks.length * 5) * mult) + res.freed * 150;
      this.score += pts;
      this.freed += res.freed;
      // fever: busy shots fill it; when it's full the shooter's next shot is a power-up
      let fever = null;
      if (!s.power) {
        this.fever += popped + dropped * 1.5 + res.freed * 3;
        if (this.fever >= FEVER_MAX && !p.power) { this.fever = 0; p.power = POWERS[Math.floor(this.rnd() * POWERS.length)]; p.powerFrom = 'fever'; fever = p.power; }
        this.fever = Math.min(this.fever, FEVER_MAX);
      }
      let dmg = 0;
      if (this.boss) { dmg = popped + dropped * 2; this.boss.hp = Math.max(0, this.boss.hp - dmg); }
      const cham = this.board.cycle(this.board.colors());
      // new rows
      let pushed = 0;
      const every = this.pushEvery();
      if (every && !this.goalMet()) {
        this.sincePush++;
        if (this.sincePush >= every) { this.sincePush = 0; if (this.pushRow()) pushed++; }
      }
      while (this.board.count() === 0 && this.queue.length) { this.pushRow(); pushed++; }
      if (this.goal === 'endless') this.endlessRamp();
      this.refreshColors();
      const ev = { p, shot: s, res, pts, mult, combo: this.combo, fever, dmg, pushed, cham };
      this.emit('land', ev);
      if (fever) this.emit('fever', { p, power: fever });
      this.checkEnd();
      return ev;
    }
    pushEvery() { return this.spec.push || 0; }
    pushRow() {
      let row = this.queue.length ? this.queue.shift() : null;
      if (!row && this.goal !== 'boss' && this.goal !== 'endless') return false;
      const b = this.board;
      b.pushRow((c, w) => { if (row) { if (row.length !== w) row = row.slice(0, w).concat(new Array(Math.max(0, w - row.length)).fill(null).map(() => ({ c: Math.floor(this.rnd() * this.spec.col), k: K.N }))); return row[c] && Object.assign({}, row[c]); } return this.rowMaker(c, w); });
      this.emit('push', {});
      return true;
    }
    endlessRamp() {
      const sc = this.score, sp = this.spec;
      sp.col = Math.min(6, 4 + Math.floor(sc / 3000));
      sp.push = Math.max(3, 7 - Math.floor(sc / 5000));
      sp.clump = Math.max(0.3, 0.5 - sc / 60000);
      const lvl = Math.min(1, sc / 20000);
      Object.assign(sp, { stone: sc > 4000 ? 3 * lvl + 1 : 0, ice: sc > 2500 ? 5 * lvl + 1 : 0, bomb: sc > 6000 ? 2 : 0, star: sc > 8000 ? 1 : 0, cham: sc > 10000 ? 3 : 0 });
    }
    shotsUntilPush() { const e = this.pushEvery(); if (!e || (!this.queue.length && this.goal !== 'boss' && this.goal !== 'endless')) return 0; return e - this.sincePush; }

    goalMet() {
      if (this.goal === 'clear') return this.board.count() === 0 && !this.queue.length;
      if (this.goal === 'rescue') return this.freed >= this.critTotal;
      if (this.goal === 'boss') return this.boss.hp <= 0;
      return false;
    }
    progress() {
      if (this.goal === 'clear') return 1 - (this.board.count() + this.queue.reduce((s, row) => s + row.filter(v => v).length, 0)) / Math.max(1, this.total);
      if (this.goal === 'rescue') return this.freed / Math.max(1, this.critTotal);
      if (this.goal === 'boss') return 1 - this.boss.hp / this.boss.max;
      return 0;
    }
    checkEnd() {
      if (this.mirror || (this.state !== 'play' && this.state !== 'intro')) return;
      if (this.goalMet()) return this.win();
      if (this.board.over()) return this.lose('line');
      if (this.shotsLeft <= 0 && !this.shots.length && !this.players.some(p => p.power)) return this.lose('shots');
    }
    win() {
      this.state = 'won'; this.bonusT = 0.9;
      for (const s of this.shots.slice()) this.removeShot(s);
      // whatever is left falls for points
      const res = { pops: [], cracks: [], drops: [], booms: [], freed: 0 };
      this.board.each((v, r, c) => res.drops.push(this.board.info(r, c, v)));
      this.board.rows = [];
      const pts = res.drops.length * 20;
      this.score += pts;
      this.emit('win', { res, pts });
    }
    // after a win, shots you didn't need are worth 100 each
    bonusTick(dt) {
      this.bonusT -= dt;
      if (this.bonusT > 0) return;
      if (this.shotsLeft > 0 && this.shotsLeft !== Infinity) {
        this.shotsLeft--; this.score += 100; this.bonusT = this.shotsLeft > 20 ? 0.05 : 0.11;
        this.emit('bonus', { p: this.players[this.shotsLeft % this.players.length], pts: 100 });
        return;
      }
      if (!this.result) { this.result = this.results(true); this.emit('over', { result: this.result }); }
    }
    lose(reason) {
      this.state = 'lost';
      for (const s of this.shots.slice()) this.removeShot(s);
      this.result = this.results(false, reason);
      this.emit('lose', { reason });
      this.emit('over', { result: this.result });
    }
    results(won, reason) {
      const st = this.spec.stars;
      const stars = !won ? 0 : 1 + (this.score >= st[0] ? 1 : 0) + (this.score >= st[1] ? 1 : 0);
      return { won, reason: reason || null, stars, score: this.score, level: this.spec.n, mode: this.mode, coop: this.coop, combo: this.bestCombo, freed: this.freed, shotsUsed: this.fired };
    }
    // continue after losing: more shots, or blast the bottom rows clear
    revive(kind) {
      if (this.state !== 'lost') return false;
      if (kind === 'shots') this.shotsLeft += 5;
      else {
        const res = { pops: [], cracks: [], drops: [], booms: [], freed: 0 };
        const lim = this.board.limit - 4;
        this.board.each((v, r, c) => { if (r >= lim) { res.pops.push(this.board.info(r, c, v)); if (v.k === K.CRIT) res.freed++; this.board.rows[r][c] = null; } });
        this.board.dropLoose(res);
        this.freed += res.freed;
        this.emit('land', { p: this.players[0], shot: { power: 'bomb' }, res, pts: 0, mult: 1, combo: 0, revive: true });
        if (this.shotsLeft <= 0) this.shotsLeft = 3;
      }
      this.state = 'play'; this.result = null;
      this.refreshColors();
      this.emit('revive', { kind });
      if (this.goalMet()) this.win();
      return true;
    }

    // ---- online: the host's view of everything the guest needs ----
    snapshot() {
      return { b: this.board.toCodes(), q: this.queue.map(row => row.map(v => v ? 1 + v.k * 8 + (v.c + 1) : 0)), sc: this.score, sl: this.shotsLeft === Infinity ? -1 : this.shotsLeft,
        f: this.fever, cb: this.combo, fr: this.freed, ct: this.critTotal, tot: this.total, sp: this.sincePush, fi: this.fired, hp: this.boss ? this.boss.hp : 0, st: this.state,
        col: this.spec.col, push: this.spec.push, pl: this.players.map(p => [p.cur, p.next, p.power, p.powerFrom]) };
    }
    applyState(s, all) {
      this.board.fromCodes(s.b);
      this.queue = s.q.map(row => row.map(n => n ? { k: (n - 1) >> 3, c: ((n - 1) & 7) - 1 } : null));
      this.score = s.sc; this.shotsLeft = s.sl < 0 ? Infinity : s.sl; this.fever = s.f; this.combo = s.cb; this.freed = s.fr; this.critTotal = s.ct; this.total = s.tot;
      this.sincePush = s.sp; this.fired = s.fi; this.spec.col = s.col; this.spec.push = s.push;
      if (this.boss) this.boss.hp = s.hp;
      if (all && s.st === 'play') this.state = 'play';
      s.pl.forEach((v, i) => { const p = this.players[i]; if (!p) return; [p.cur, p.next, p.power, p.powerFrom] = v; });
    }
  }
  BB.Game = Game;
})();
