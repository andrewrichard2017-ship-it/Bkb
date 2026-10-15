// Road Rumble: a point-to-point road generated from a seed. Everything lives in road space:
// s = metres along the road, d = metres right of the centre line (negative = oncoming side), h = height.
// The same seed gives the same road, roadside props and traffic on every machine (online races rely on it).
(() => {
  'use strict';
  const RR = window.RR, { clamp, lerp, smooth } = RR.math, N = RR.noise;
  const DS = 2;                 // sample spacing
  const H = RR.ROAD_HALF;
  const RIDE_LIMIT = H + 9.5;   // how far off the tarmac a rider can get before the ground stops him

  // what can be hit, and how big it is (half sizes along s and d)
  const SOLID = {
    pine: 0.45, oak: 0.6, palm: 0.35, cactus: 0.45, rock: 0.9, pole: 0.25, lamp: 0.22, sign: 0.2, chevron: 0.18,
    hydrant: 0.25, mailbox: 0.2, boulder: 1.4, post: 0.18,
  };
  RR.CAR_TYPES = {
    sedan: { len: 4.6, w: 1.85, h: 1.45 }, hatch: { len: 4.0, w: 1.75, h: 1.5 }, sports: { len: 4.4, w: 1.9, h: 1.22 },
    pickup: { len: 5.3, w: 2.0, h: 1.85 }, van: { len: 5.0, w: 2.0, h: 2.2 }, truck: { len: 9.5, w: 2.5, h: 3.4 }, bus: { len: 11.5, w: 2.55, h: 3.1 },
    taxi: { len: 4.6, w: 1.85, h: 1.45 },
  };
  const CAR_COLOURS = [0xb71c1c, 0x1565c0, 0xeeeeee, 0x212121, 0x9e9e9e, 0x2e7d32, 0xf9a825, 0x6d4c41, 0x4527a0, 0x00838f, 0xd84315, 0x37474f, 0xc0c0c0, 0x0d2a4a];

  class Track {
    constructor(def, levelIdx, opts = {}) {
      this.def = def; this.themeId = def.theme; this.theme = RR.THEMES[def.theme];
      const lv = RR.LEVELS[levelIdx] || RR.LEVELS[0];
      this.level = levelIdx;
      this.length = opts.length || lv.length;
      this.startS = 160;
      this.finishS = this.startS + this.length;
      this.total = this.finishS + 700;
      this.seed = (def.seed * 7 + levelIdx * 131 + (opts.seedOffset || 0)) >>> 0;
      const n = this.n = Math.ceil(this.total / DS) + 2;
      this.x = new Float32Array(n); this.y = new Float32Array(n); this.z = new Float32Array(n);
      this.hd = new Float32Array(n); this.k = new Float32Array(n); this.sl = new Float32Array(n);
      this.limR = new Float32Array(n); this.limL = new Float32Array(n);
      const rng = RR.rng(this.seed);
      this.buildCurvature(rng);
      this.buildElevation(rng);
      this.integrate();
      this.buildBase();
      this.props = []; this.rails = []; this.obstacles = []; this.people = []; this.pickups = [];
      this.buildTowns(RR.rng(this.seed + 55));
      this.buildLimits(rng);
      this.placeProps(RR.rng(this.seed + 99));
      this.obstacles.sort((a, b) => a.s - b.s);
      this.buildTraffic(RR.rng(this.seed + 7), lv.traffic * (opts.trafficScale || 1));
      if (opts.noTraffic) this.cars = [];
      if (opts.noCrates) { this.pickups = []; this.props = this.props.filter(p => p.kind !== 'crate'); }
    }

    // ---- shape ----
    buildCurvature(rng) {
      const k = this.k, n = this.n, th = this.themeId;
      const cfg = { coast: [240, 650, 0.35], forest: [230, 430, 0.22], valley: [280, 800, 0.4], desert: [360, 900, 0.55], city: [240, 520, 0.45] }[th];
      let i = Math.ceil((this.startS + 120) / DS), hd = 0;
      while (i < n) {
        const straight = rng() < cfg[2];
        let segN = Math.round((straight ? rng.range(80, 380) : rng.range(150, 520)) / DS);
        if (!straight) {
          let R = rng.range(cfg[0], cfg[1]), sign = rng() < 0.5 ? -1 : 1;
          const ramp = Math.min(Math.floor(segN / 3), 30);
          const turn = (segN - ramp) * DS / R;
          // keep the road heading roughly forward so it never doubles back over itself
          if (Math.abs(hd + sign * turn) > 1.1) sign = -sign;
          if (Math.abs(hd + sign * turn) > 1.1) R = Math.max(R, (segN - ramp) * DS / Math.max(0.15, 1.1 - Math.abs(hd)));
          for (let j = 0; j < segN && i + j < n; j++) {
            const w = j < ramp ? smooth(j / ramp) : j > segN - ramp ? smooth((segN - j) / ramp) : 1;
            k[i + j] = sign / R * w; hd += k[i + j] * DS;
          }
        }
        i += segN;
      }
      // straight run-in to the finish line
      for (let j = 0; j < n; j++) {
        const s = j * DS, e = Math.abs(s - this.finishS);
        if (e < 220) k[j] *= smooth(clamp((e - 80) / 140, 0, 1));
      }
    }

    buildElevation(rng) {
      const th = this.theme, n = this.n, y = this.y, seed = this.seed;
      const base = this.themeId === 'coast' ? 42 : 30;
      const target = new Float32Array(n);
      for (let i = 0; i < n; i++) {
        const s = i * DS;
        target[i] = base + th.relief * N.fbm1(s / 420, seed, 3) * 1.6 + th.relief * 0.45 * N.fbm1(s / 140, seed + 5, 2);
      }
      // limit gradients to ~8.5 %, then smooth the kinks out
      y[0] = target[0];
      for (let i = 1; i < n; i++) y[i] = y[i - 1] + clamp(target[i] - y[i - 1], -0.085 * DS, 0.085 * DS);
      const tmp = new Float32Array(n);
      for (let pass = 0; pass < 4; pass++) {
        for (let i = 0; i < n; i++) { let a = 0, c = 0; for (let j = -6; j <= 6; j++) { const q = i + j; if (q >= 0 && q < n) { a += y[q]; c++; } } tmp[i] = a / c; }
        y.set(tmp);
      }
      // flat grid and flat finish
      const y0 = y[Math.round(this.startS / DS)];
      for (let i = 0; i < n; i++) {
        const s = i * DS, env = smooth(clamp((s - (this.startS + 30)) / 220, 0, 1));
        y[i] = y0 + (y[i] - y0) * env;
      }
      // crests that throw you into the air (only on straight bits)
      const jumps = Math.floor(this.length / 1300 * (th.jumps || 0.8));
      this.jumps = [];
      for (let tries = 0; tries < jumps * 25 && this.jumps.length < jumps; tries++) {
        const c = rng.range(this.startS + 450, this.finishS - 250);
        let ok = true;
        for (let s = c - 90; s <= c + 90; s += 10) if (Math.abs(this.k[Math.round(s / DS)]) > 0.0007) { ok = false; break; }
        for (const j of this.jumps) if (Math.abs(j.s - c) < 400) ok = false;
        if (!ok) continue;
        const hgt = rng.range(3.2, 5.5), w = rng.range(22, 32);
        this.jumps.push({ s: c, h: hgt, w });
        for (let i = 0; i < n; i++) { const u = (i * DS - c) / w; if (Math.abs(u) < 4) y[i] += hgt * Math.exp(-u * u); }
      }
      for (let i = 0; i < n; i++) this.sl[i] = (y[Math.min(n - 1, i + 1)] - y[Math.max(0, i - 1)]) / (2 * DS);
    }

    integrate() {
      const { x, z, hd, k, n } = this;
      for (let i = 1; i < n; i++) {
        hd[i] = hd[i - 1] + k[i - 1] * DS;
        const m = (hd[i] + hd[i - 1]) / 2;
        x[i] = x[i - 1] + Math.sin(m) * DS;
        z[i] = z[i - 1] - Math.cos(m) * DS;
      }
      let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity, ys = 0;
      for (let i = 0; i < n; i++) { x0 = Math.min(x0, x[i]); x1 = Math.max(x1, x[i]); z0 = Math.min(z0, z[i]); z1 = Math.max(z1, z[i]); ys += this.y[i]; }
      this.bbox = { x0, x1, z0, z1 };
      this.meanY = ys / n;
    }

    // A smooth "lie of the land" height field: road heights splatted into a coarse grid and blurred.
    buildBase() {
      const C = 50, M = 1800, b = this.bbox;
      const gx0 = b.x0 - M, gz0 = b.z0 - M, nx = Math.ceil((b.x1 - b.x0 + 2 * M) / C) + 1, nz = Math.ceil((b.z1 - b.z0 + 2 * M) / C) + 1;
      let val = new Float32Array(nx * nz), wt = new Float32Array(nx * nz);
      for (let i = 0; i < this.n; i += 4) {
        const gx = Math.round((this.x[i] - gx0) / C), gz = Math.round((this.z[i] - gz0) / C), q = gz * nx + gx;
        val[q] += this.y[i]; wt[q] += 1;
      }
      const blur = (a) => {
        const o = new Float32Array(a.length);
        for (let pass = 0; pass < 2; pass++) {
          const src = pass ? o.slice() : a, dst = o;
          for (let zz = 0; zz < nz; zz++) for (let xx = 0; xx < nx; xx++) {
            let s = 0;
            for (let j = -3; j <= 3; j++) {
              const X = pass ? xx : clamp(xx + j, 0, nx - 1), Z = pass ? clamp(zz + j, 0, nz - 1) : zz;
              s += src[Z * nx + X] * [0.05, 0.1, 0.2, 0.3, 0.2, 0.1, 0.05][j + 3];
            }
            dst[zz * nx + xx] = s;
          }
        }
        return o;
      };
      for (let r = 0; r < 3; r++) { val = blur(val); wt = blur(wt); }
      const base = new Float32Array(nx * nz), w0 = 0.002;
      for (let q = 0; q < base.length; q++) base[q] = (val[q] + this.meanY * w0) / (wt[q] + w0);
      this.baseGrid = { C, gx0, gz0, nx, nz, base };
    }
    baseAt(x, z) {
      const g = this.baseGrid;
      const fx = clamp((x - g.gx0) / g.C, 0, g.nx - 1.001), fz = clamp((z - g.gz0) / g.C, 0, g.nz - 1.001);
      const ix = fx | 0, iz = fz | 0, tx = fx - ix, tz = fz - iz, b = g.base, nx = g.nx;
      return lerp(lerp(b[iz * nx + ix], b[iz * nx + ix + 1], tx), lerp(b[(iz + 1) * nx + ix], b[(iz + 1) * nx + ix + 1], tx), tz);
    }

    // ---- sampling ----
    idx(s) { const f = clamp(s / DS, 0, this.n - 1.001); return f; }
    _lerp(a, s) { const f = this.idx(s), i = f | 0; return a[i] + (a[i + 1] - a[i]) * (f - i); }
    height(s) { return this._lerp(this.y, s); }
    heading(s) { return this._lerp(this.hd, s); }
    curv(s) { return this._lerp(this.k, s); }
    slope(s) { return this._lerp(this.sl, s); }
    limitR(s) { return this.limR[Math.round(this.idx(s))]; }
    limitL(s) { return this.limL[Math.round(this.idx(s))]; }
    // world position of a road-space point; out is a THREE.Vector3 or {x,y,z}
    pos(s, d, h, out) {
      const f = this.idx(s), i = f | 0, t = f - i;
      const hd = this.hd[i] + (this.hd[i + 1] - this.hd[i]) * t;
      const x = this.x[i] + (this.x[i + 1] - this.x[i]) * t, z = this.z[i] + (this.z[i + 1] - this.z[i]) * t;
      const y = this.y[i] + (this.y[i + 1] - this.y[i]) * t;
      out.x = x + Math.cos(hd) * d; out.y = y + h; out.z = z + Math.sin(hd) * d;
      return out;
    }

    // Height of the ground (not the road) at a road-space point. Shared by the terrain mesh and prop placement.
    ground(s, d, x, z) {
      const e = Math.abs(d) - H, yr = this.height(s);
      if (e < 0) return yr - 0.12;
      const coastSea = this.themeId === 'coast' && d > 0;
      const tw = coastSea ? 0 : this.townW(s);
      let start = coastSea ? 4 : this.themeId === 'city' ? 7 : 10.5;
      const len = coastSea ? 9 : 48;
      const ditch = e > 1.2 && e < start ? 0.25 * Math.sin(Math.PI * clamp((e - 1.2) / (start - 1.2), 0, 1)) * (1 - tw) : 0;
      start = lerp(start, 34, tw);
      const shoulder = yr - 0.12 - ditch;
      if (e < start) return shoulder;
      if (x === undefined) { const p = this.pos(s, d, 0, {}); x = p.x; z = p.z; }
      return lerp(shoulder, this.natural(x, z, d), smooth(clamp((e - start) / len, 0, 1)));
    }
    // Natural lie of the land away from the road (pure function of world position + side).
    natural(x, z, d) {
      const th = this.theme, id = this.themeId, seed = this.seed, e = Math.max(0, Math.abs(d) - H);
      const base = this.baseAt(x, z);
      const n1 = N.fbm2(x / 650, z / 650, seed, 3), n2 = N.fbm2(x / 180, z / 180, seed + 9, 2);
      switch (id) {
        case 'coast':
          if (d > 0) return lerp(base - 6, -14 + n2 * 2, smooth(clamp(e / 30, 0, 1)));
          return base + th.hills * n1 + 10 * n2 + Math.min(e, 1600) * 0.11;
        case 'forest': return base + th.hills * n1 + 14 * n2 + Math.min(e, 1800) * (0.2 + 0.12 * n1);
        case 'valley': return base + th.hills * n1 + 8 * n2 + Math.min(e, 1800) * 0.045;
        case 'desert': {
          const m = N.fbm2(x / 420, z / 420, seed + 3, 2);
          const mesa = e > 70 ? smooth(clamp((m - 0.12) / 0.06, 0, 1)) * (38 + 30 * n1) * smooth(clamp((e - 70) / 120, 0, 1)) : 0;
          return base + th.hills * n1 + 5 * n2 + mesa + Math.min(e, 1800) * 0.03;
        }
        default: return base - 0.15 + (e > 400 ? (e - 400) * 0.02 : 0);
      }
    }

    // ---- small towns along the country roads ----
    buildTowns(rng) {
      const id = this.themeId; this.towns = [];
      if (id === 'city') return;
      const gap = { coast: 1500, forest: 2300, valley: 1700, desert: 1900 }[id];
      if (id !== 'forest') this.towns.push({ s0: this.startS - 160, s1: this.startS + 120, name: rng.int(0, 7) });
      let s = this.startS + 650;
      while (s < this.finishS - 420) {
        const len = rng.range(240, 420);
        if (rng() < 0.85) this.towns.push({ s0: s, s1: s + len, name: rng.int(0, 7) });
        s += len + gap * rng.range(0.7, 1.3);
      }
    }
    // 0..1: how much of a town this point of road is in (ramps over 60 m at each end)
    townW(s) {
      let w = 0;
      for (const t of this.towns) if (s > t.s0 - 60 && s < t.s1 + 60) w = Math.max(w, smooth(clamp((s - t.s0 + 60) / 60, 0, 1)) * smooth(clamp((t.s1 + 60 - s) / 60, 0, 1)));
      return w;
    }
    inTown(s, pad = 0) { return this.towns.some(t => s > t.s0 - pad && s < t.s1 + pad); }

    // ---- walls (guard rails, buildings, banks) ----
    buildLimits(rng) {
      const { n, limR, limL, themeId } = this;
      const lim = themeId === 'city' ? H + 4.6 : RIDE_LIMIT;
      for (let i = 0; i < n; i++) { limR[i] = lim; limL[i] = -lim; }
      const rail = (s0, s1, side) => {
        this.rails.push({ s0, s1, side });
        for (let i = Math.max(0, Math.floor(s0 / DS)); i <= Math.min(n - 1, Math.ceil(s1 / DS)); i++) { if (side > 0) limR[i] = H + 1.55; else limL[i] = -(H + 1.55); }
      };
      if (themeId === 'coast') rail(this.startS + 60, this.total, 1);
      // kerbs in town, and crowd barriers round the start and finish
      for (let i = 0; i < n; i++) {
        const s = i * DS;
        if (this.inTown(s, 10)) { limR[i] = Math.min(limR[i], H + 4.6); limL[i] = Math.max(limL[i], -(H + 4.6)); }
        if (Math.abs(s - this.startS + 8) < 40 || Math.abs(s - this.finishS + 8) < 50) { limR[i] = Math.min(limR[i], H + 2.6); limL[i] = Math.max(limL[i], -(H + 2.6)); }
      }
      if (themeId === 'forest' || themeId === 'coast') {
        // guard rails round the outside of the tighter bends
        let i = 0;
        while (i < n) {
          if (Math.abs(this.k[i]) > 1 / 420) {
            const sign = Math.sign(this.k[i]); let j = i;
            while (j < n && Math.abs(this.k[j]) > 1 / 700 && Math.sign(this.k[j]) === sign) j++;
            const side = sign > 0 ? -1 : 1; // outside of a right-hander is the left
            if (!(themeId === 'coast' && side > 0)) rail(i * DS - 30, j * DS + 30, side);
            i = j + 1;
          } else i++;
        }
      }
    }

    // ---- roadside props ----
    addProp(s, d, kind, sc = 1, rot = 0, v = 0) {
      if (s < 0 || s > this.total) return;
      this.props.push({ s, d, kind, sc, rot, v });
      const r = SOLID[kind];
      if (r && Math.abs(d) < RIDE_LIMIT + 1.5) this.obstacles.push({ s, d, hs: r * sc, hd: r * sc, kind });
    }
    railAt(s, side) { return this.rails.some(r => r.side === side && s >= r.s0 && s <= r.s1); }
    placeProps(rng) {
      const id = this.themeId, T = this.total, P = (s, d, k, sc, rot, v) => this.addProp(s, d, k, sc, rot, v);
      const side = () => rng() < 0.5 ? -1 : 1;
      const clearOfStart = s => Math.abs(s - this.startS) > 40 && Math.abs(s - this.finishS) > 40;
      // curve warning chevrons on the outside of bends
      for (let i = 0; i < this.n; i += 9) {
        const k = this.k[i];
        if (Math.abs(k) > 1 / 400 && id !== 'city') { const sd = k > 0 ? -1 : 1; if (!this.railAt(i * DS, sd)) P(i * DS, sd * (H + 2.2), 'chevron', 1, k > 0 ? 0 : Math.PI); }
      }
      // distance-to-go boards every kilometre
      for (let s = this.startS + 1000; s < this.finishS - 200; s += 1000) P(this.finishS - Math.round((this.finishS - s) / 1000) * 1000, -(H + 3.2), 'kmsign', 1, 0, Math.round((this.finishS - s) / 1000));

      if (id === 'city') return this.placeCity(rng);
      for (let s = 20; s < T; s += 4) {
        // near the road: things you can crash into
        if (rng() < { coast: 0.12, forest: 0.42, valley: 0.14, desert: 0.08 }[id] && !this.inTown(s, 20)) {
          const sd = id === 'coast' ? -1 : side();
          if (this.railAt(s, sd)) continue;
          const d = sd * (H + rng.range(3.2, 9.5));
          if (!clearOfStart(s)) continue;
          const kind = { coast: rng() < 0.6 ? 'palm' : 'rock', forest: rng() < 0.85 ? 'pine' : 'rock', valley: rng() < 0.7 ? 'oak' : 'rock', desert: rng() < 0.6 ? 'cactus' : 'rock' }[id];
          P(s, d, kind, rng.range(0.75, 1.3), rng.range(0, 6.28), rng.int(0, 3));
        }
        // further out: scenery only
        const far = { coast: 0.35, forest: 1.3, valley: 0.4, desert: 0.18 }[id];
        let q = far;
        while (q > 0) {
          if (rng() < q) {
            const sd = id === 'coast' ? -1 : side();
            let d = sd * (H + 11 + Math.pow(rng(), 1.6) * 190);
            if (this.inTown(s, 10) && Math.abs(d) < H + 45) d = sd * (H + 45 + rng() * 100);
            const kind = {
              coast: rng.pick(['palm', 'bush', 'bush', 'rock', 'palm']),
              forest: rng() < 0.9 ? 'pine' : 'rock',
              valley: rng.pick(['oak', 'oak', 'bush', 'poplar']),
              desert: rng.pick(['cactus', 'bush', 'boulder', 'rock']),
            }[id];
            P(s + rng.range(0, 4), d, kind, rng.range(0.8, 1.6), rng.range(0, 6.28), rng.int(0, 3));
          }
          q -= 1;
        }
      }
      // telegraph poles
      if (id !== 'forest') {
        const pd = id === 'coast' ? -(H + 4.5) : H + 4.8;
        for (let s = 30; s < T; s += 48) if (!this.railAt(s, Math.sign(pd)) && clearOfStart(s) && !this.inTown(s, 8)) P(s, pd, 'pole', 1, 0, 0);
      }
      // houses, barns, cabins, shacks
      const bcount = Math.floor(T / { coast: 160, forest: 420, valley: 220, desert: 520 }[id]);
      for (let b = 0; b < bcount; b++) {
        const s = rng.range(80, T - 40), sd = id === 'coast' ? -1 : side();
        const d = sd * (H + rng.range(16, 60));
        const kind = { coast: rng() < 0.6 ? 'beach' : 'house', forest: 'cabin', valley: rng() < 0.4 ? 'barn' : rng() < 0.5 ? 'farm' : 'house', desert: 'shack' }[id];
        if (this.inTown(s, 30)) continue;
        this.props.push({ s, d, kind, sc: rng.range(0.9, 1.2), rot: 0, turn: rng.range(-0.25, 0.25), v: rng.int(0, 7) });
        if (kind === 'barn') { if (rng() < 0.6) P(s + 14, d + sd * 4, 'silo', 1, 0, 0); if (rng() < 0.5) this.props.push({ s: s - 16, d: d + sd * 6, kind: 'windmill', sc: 1, rot: 0, v: 0 }); }
        if (kind !== 'shack' && kind !== 'cabin' && rng() < 0.5) P(s - 3, sd * (H + 3.4), 'mailbox', 1, sd > 0 ? -Math.PI / 2 : Math.PI / 2, 0);
      }
      if (id === 'valley') {
        // vineyard blocks: rows parallel to the road
        for (let b = 0; b < T / 450; b++) {
          const s0 = rng.range(100, T - 300), len = rng.range(80, 220), sd = side(), d0 = H + rng.range(14, 30);
          for (let r = 0; r < 12; r++) this.props.push({ s: s0, d: sd * (d0 + r * 3), kind: 'vines', sc: len, rot: 0, v: 0 });
        }
        // fences along the fields
        for (let s = 40; s < T; s += 4) if (N.noise1(s / 300, this.seed) > 0.1) { this.props.push({ s, d: H + 10.5, kind: 'fence', sc: 1, rot: 0, v: 0 }); this.props.push({ s, d: -(H + 10.5), kind: 'fence', sc: 1, rot: 0, v: 0 }); }
      }
      if (id === 'coast') {
        for (let s = 60; s < T; s += 30) if (rng() < 0.5 && !this.inTown(s, 10)) P(s, -(H + rng.range(2.5, 6)), 'bush', rng.range(0.6, 1.1), rng.range(0, 6), 0);
      }
      this.placeLife(rng);
    }
    // billboards, landmarks, animals, machines, towns, crowds and the shotgun crates
    placeLife(rng) {
      const id = this.themeId, T = this.total, push = (o) => this.props.push(Object.assign({ sc: 1, rot: 0, v: 0 }, o));
      const side = () => rng() < 0.5 ? -1 : 1, free = s => !this.inTown(s, 40) && Math.abs(s - this.startS) > 80;
      for (let s = 300; s < T; s += rng.range(500, 900)) {
        const sd = id === 'coast' ? -1 : side();
        if (free(s)) push({ s, d: sd * (H + 12.5), kind: 'billboard', v: rng.int(0, 7), turn: sd * 0.45 });
      }
      if (id !== 'forest') for (let s = 40; s < T; s += 50) for (const sd of [-1, 1]) if (!this.railAt(s, sd) && !this.inTown(s, 10)) push({ s, d: sd * (H + 2.4), kind: 'delineator' });
      if (id === 'valley') {
        for (let s = 200; s < T; s += rng.range(250, 450)) push({ s, d: side() * (H + rng.range(160, 600)), kind: 'turbine', sc: rng.range(0.8, 1.1) });
        for (let s = 300; s < T; s += rng.range(350, 700)) if (free(s)) { const sd = side(), d0 = H + rng.range(25, 60); for (let k = 0; k < rng.int(3, 7); k++) push({ s: s + rng.range(-20, 20), d: sd * (d0 + rng.range(-8, 8)), kind: 'cow', rot: rng() * 6.28, v: rng.int(0, 2) }); }
        for (let s = 200; s < T; s += rng.range(300, 600)) if (free(s)) { const sd = side(); for (let k = 0; k < 5; k++) push({ s: s + k * 7, d: sd * (H + 20 + rng.range(0, 30)), kind: 'haybale', rot: rng() * 3 }); }
      }
      if (id === 'desert') {
        for (let s = 250; s < T; s += rng.range(400, 800)) if (free(s)) { const sd = side(); for (let k = 0; k < rng.int(2, 4); k++) push({ s: s + k * rng.range(18, 35), d: sd * (H + rng.range(35, 160)), kind: 'pumpjack', rot: rng() * 6 }); }
        for (let s = 800; s < T; s += rng.range(1500, 2600)) push({ s, d: side() * (H + rng.range(120, 300)), kind: 'arch', sc: rng.range(0.9, 1.4) });
      }
      if (id === 'coast') {
        for (let s = 100; s < T; s += rng.range(180, 320)) push({ s, d: H + rng.range(140, 900), kind: 'boat' });
        for (let s = 1200; s < T; s += rng.range(2500, 3500)) if (free(s)) push({ s, d: H + 6.5, kind: 'lighthouse' });
      }
      if (id === 'forest') {
        for (let s = 300; s < T; s += rng.range(350, 600)) if (free(s)) { const sd = side(); push({ s, d: sd * (H + rng.range(12, 30)), kind: rng() < 0.5 ? 'tent' : 'logpile', rot: rng() * 6 }); }
      }
      for (const t of this.towns) this.placeTown(t, rng);
      this.placeCrowds(rng);
    }
    // cheering crowds behind barriers at the start and finish, and the shotgun crates on the road
    placeCrowds(rng) {
      for (const [c, a, b] of [[this.startS, -40, 22], [this.finishS, -50, 30]]) {
        for (let s = c + a; s < c + b; s += 4.2) for (const sd of [-1, 1]) this.props.push({ s, d: sd * (H + 3.0), kind: 'barrier', sc: 1, rot: 0, v: (s / 4.2 | 0) % 2 });
        for (let s = c + a + 1; s < c + b; s += 1.3) for (const sd of [-1, 1]) for (let row = 0; row < 3; row++) if (rng() < 0.75) this.person(s + rng.range(-0.4, 0.4), sd * (H + 3.8 + row * 0.95), 'cheer', rng);
      }
      for (let s = this.startS + 600; s < this.finishS - 200; s += rng.range(900, 1400)) {
        const d = rng.pick([1.8, 5.4, -1.8, 3.6]);
        this.pickups.push({ s, d }); this.props.push({ s, d, kind: 'crate', sc: 1, rot: 0, v: 0 });
      }
    }
    person(s, d, kind, rng, o = {}) {
      const S = RR.scenery;
      this.people.push(Object.assign({ s, d, kind, a: s, b: s, v: 0, ph: rng() * 9, shirt: rng.pick(S.SHIRTS), pants: rng.pick(S.PANTS), skin: rng.pick(S.SKIN), hair: rng.pick(S.HAIR), turn: kind === 'stand' ? rng.range(-0.8, 0.8) : 0 }, o));
    }
    placeTown(t, rng) {
      const id = this.themeId, push = (o) => this.props.push(Object.assign({ sc: 1, rot: 0, v: 0 }, o));
      const types = { coast: ['store', 'store', 'diner', 'motel', 'gas', 'beach'], forest: ['store', 'cabin', 'diner', 'motel', 'bar', 'gas', 'church'], valley: ['store', 'store', 'diner', 'church', 'gas', 'house', 'motel'], desert: ['store', 'bar', 'motel', 'gas', 'diner', 'store'] }[id];
      const W = { store: [9, 16], diner: [13, 16], gas: [16, 18], motel: [24, 34], church: [12, 14], bar: [12, 15], house: [12, 13], beach: [11, 12], cabin: [10, 11] };
      const DEP = { store: 12, diner: 9, gas: 15, motel: 9, church: 14, bar: 10 };
      push({ s: t.s0 - 28, d: H + 3.6, kind: 'welcome', v: t.name, turn: Math.PI / 2 });
      this.obstacles.push({ s: t.s0 - 28, d: H + 3.6, hs: 0.3, hd: 2, kind: 'sign' });
      for (const sd of id === 'coast' ? [-1] : [-1, 1]) {
        let s = t.s0 + rng.range(0, 8);
        while (s < t.s1 - 8) {
          const type = rng.pick(types), w = rng.range(...W[type]);
          if (s + w > t.s1) break;
          const mid = s + w / 2;
          if (DEP[type]) push({ s: mid, d: sd * (H + 6.6 + DEP[type] / 2), kind: 'tb', type, sc: w, depth: DEP[type], v: rng.int(0, 11) });
          else push({ s: mid, d: sd * (H + 11.5), kind: type, sc: 0.95, v: rng.int(0, 7) });
          if (rng() < 0.5 && type !== 'gas' && Math.abs(mid - this.startS) > 60) {
            const ty = rng.pick(['sedan', 'hatch', 'pickup', 'van']), ct = RR.CAR_TYPES[ty];
            push({ s: mid, d: sd * (H + 1.35), kind: 'parked', rot: sd > 0 ? 0 : Math.PI, type: ty, color: rng.pick(CAR_COLOURS) });
            this.obstacles.push({ s: mid, d: sd * (H + 1.35), hs: ct.len / 2, hd: ct.w / 2, kind: 'parked' });
          }
          if (rng() < 0.35) push({ s: s + w - 1, d: sd * (H + 5.3), kind: rng.pick(['bench', 'bin', 'planter']) });
          s += w + rng.range(2, 7);
        }
        for (let q = t.s0 + 8; q < t.s1; q += 30) this.addProp(q, sd * (H + 3.2), 'lamp', 1, sd > 0 ? Math.PI : 0, 0);
        for (let k = 0; k < (t.s1 - t.s0) / 10; k++) {
          const v = rng.range(1.1, 1.7) * (rng() < 0.5 ? -1 : 1);
          if (rng() < 0.7) this.person(rng.range(t.s0, t.s1), sd * (H + rng.range(5.0, 5.8)), 'walk', rng, { a: t.s0, b: t.s1, v });
          else this.person(rng.range(t.s0, t.s1), sd * (H + rng.range(5.2, 6.0)), 'stand', rng);
        }
      }
      if (id !== 'coast' && rng() < 0.6) push({ s: (t.s0 + t.s1) / 2, d: (rng() < 0.5 ? -1 : 1) * (H + 40), kind: 'watertower' });
    }
    placeCity(rng) {
      const T = this.total, P = (s, d, k, sc, rot, v) => this.addProp(s, d, k, sc, rot, v);
      for (const sd of [-1, 1]) {
        let s = 10;
        while (s < T) {
          const block = rng.range(70, 150);
          // buildings along the block, then a cross street gap
          let b = s;
          while (b < s + block) {
            const w = rng.range(14, 30);
            const hgt = rng() < 0.15 ? rng.range(40, 90) : rng.range(10, 32);
            this.props.push({ s: b + w / 2, d: sd * (H + 6.2 + 7), kind: 'building', sc: w, rot: 0, v: rng.int(0, 5), h: hgt, depth: 14 });
            if (rng() < 0.25) this.props.push({ s: b + w / 2, d: sd * (H + 6.2), kind: 'neon', sc: 1, rot: 0, v: rng.int(0, 4), h: rng.range(3.5, 6) });
            b += w;
          }
          // a street lamp every 30 m, parked cars along the kerb
          for (let q = s + 6; q < s + block - 4; q += 30) P(q, sd * (H + 3.2), 'lamp', 1, sd > 0 ? Math.PI : 0, 0);
          for (let q = s + 10; q < s + block - 8; q += rng.range(7, 16)) {
            if (rng() < 0.45 && Math.abs(q - this.startS) > 60 && Math.abs(q - this.finishS) > 60) {
              const type = rng.pick(['sedan', 'hatch', 'van', 'taxi', 'sedan']);
              const ct = RR.CAR_TYPES[type];
              this.props.push({ s: q, d: sd * (H + 1.35), kind: 'parked', sc: 1, rot: sd > 0 ? 0 : Math.PI, v: 0, type, color: rng.pick(CAR_COLOURS) });
              this.obstacles.push({ s: q, d: sd * (H + 1.35), hs: ct.len / 2, hd: ct.w / 2, kind: 'parked' });
              q += ct.len;
            }
          }
          if (rng() < 0.4) P(s + rng.range(10, block - 10), sd * (H + 2.6), 'hydrant', 1, 0, 0);
          this.props.push({ s: s + block + 9, d: sd * (H + 7), kind: 'crossing', sc: 18, rot: 0, v: 0 });
          // traffic lights at the corner, a bus stop, trees, people on the pavement
          this.props.push({ s: s + block + 1, d: sd * (H + 3.0), kind: 'trafficlight', sc: 1, rot: 0, v: 0 });
          this.obstacles.push({ s: s + block + 1, d: sd * (H + 3.0), hs: 0.2, hd: 0.2, kind: 'pole' });
          if (rng() < 0.5) this.props.push({ s: s + rng.range(20, block - 20), d: sd * (H + 5.4), kind: 'busstop', sc: 1, rot: 0, v: 0 });
          for (let q = s + 21; q < s + block - 6; q += 30) if (rng() < 0.6) { this.props.push({ s: q, d: sd * (H + 3.4), kind: 'planter', sc: 1, rot: 0, v: 0 }); this.obstacles.push({ s: q, d: sd * (H + 3.4), hs: 0.6, hd: 0.6, kind: 'planter' }); }
          for (let k = 0; k < block / 9; k++) {
            if (rng() < 0.75) this.person(rng.range(s, s + block), sd * (H + rng.range(5.0, 5.8)), 'walk', rng, { a: s, b: s + block, v: rng.range(1.1, 1.7) * (rng() < 0.5 ? -1 : 1) });
            else this.person(rng.range(s, s + block), sd * (H + rng.range(5.0, 5.9)), 'stand', rng);
          }
          // taller blocks behind the street front
          for (let b2 = s; b2 < s + block;) { const w = rng.range(18, 34); this.props.push({ s: b2 + w / 2, d: sd * (H + 6.2 + 14 + 5 + 9), kind: 'building', sc: w, rot: 0, v: rng.int(0, 5), h: rng.range(26, 75), depth: 18, back: true }); b2 += w + rng.range(0, 6); }
          s += block + 18;
        }
      }
      this.placeCrowds(rng);
      // distant skyline
      for (let i = 0; i < T / 60; i++) {
        const sd = rng() < 0.5 ? -1 : 1;
        this.props.push({ s: rng.range(0, T), d: sd * (H + rng.range(70, 420)), kind: 'tower', sc: rng.range(18, 40), rot: rng.range(0, 1), v: rng.int(0, 5), h: rng.range(40, 160), depth: rng.range(18, 40) });
      }
    }

    // ---- obstacles ----
    // calls fn(ob) for every obstacle overlapping [s - r, s + r]
    obstaclesNear(s, r, fn) {
      const a = this.obstacles; let lo = 0, hi = a.length;
      while (lo < hi) { const m = (lo + hi) >> 1; if (a[m].s < s - r - 6) lo = m + 1; else hi = m; }
      for (let i = lo; i < a.length && a[i].s <= s + r + 6; i++) if (Math.abs(a[i].s - s) < r + a[i].hs) fn(a[i]);
    }

    // ---- traffic (deterministic: a car's position is a pure function of race time) ----
    buildTraffic(rng, density) {
      const city = this.themeId === 'city';
      const lanes = city
        ? [{ d: 5.4, v: 13 }, { d: 1.8, v: 18 }, { d: -1.8, v: -18 }, { d: -5.4, v: -13 }]
        : [{ d: 5.4, v: 18 }, { d: 1.8, v: 25 }, { d: -1.8, v: -25 }, { d: -5.4, v: -19 }];
      this.cars = [];
      const kinds = city ? ['sedan', 'hatch', 'taxi', 'taxi', 'van', 'bus', 'sedan', 'pickup'] : ['sedan', 'hatch', 'sports', 'pickup', 'van', 'sedan', 'truck', 'pickup'];
      for (const lane of lanes) {
        const outer = Math.abs(lane.d) > 3;
        let s = lane.v > 0 ? this.startS + 90 + rng.range(0, 80) : rng.range(0, 120);
        while (s < this.total - 20) {
          let type = rng.pick(kinds);
          if (!outer && (type === 'truck' || type === 'bus')) type = 'sedan';
          const ct = RR.CAR_TYPES[type];
          this.cars.push({ s0: s, d: lane.d, v: lane.v, type, len: ct.len, w: ct.w, h: ct.h, color: type === 'taxi' ? 0xffc107 : rng.pick(CAR_COLOURS), s: s, horn: rng.range(0.85, 1.2), honked: 0 });
          s += ct.len + rng.range(70, 280) / density * (city ? 0.7 : 1);
        }
      }
    }
    // update car positions for race time t; keeps this.cars sorted by s for range queries
    updateTraffic(t) {
      const T = this.total, cars = this.cars;
      for (const c of cars) { let s = (c.s0 + c.v * (t + 12)) % T; if (s < 0) s += T; c.s = s; }
      for (let i = 1; i < cars.length; i++) { const c = cars[i]; let j = i - 1; while (j >= 0 && cars[j].s > c.s) { cars[j + 1] = cars[j]; j--; } cars[j + 1] = c; }
    }
    carsNear(s, r, fn) {
      const a = this.cars; let lo = 0, hi = a.length;
      while (lo < hi) { const m = (lo + hi) >> 1; if (a[m].s < s - r) lo = m + 1; else hi = m; }
      for (let i = lo; i < a.length && a[i].s <= s + r; i++) fn(a[i]);
    }
  }
  Track.DS = DS;
  RR.Track = Track;
  RR.RIDE_LIMIT = RIDE_LIMIT;
})();
