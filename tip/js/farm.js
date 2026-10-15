// Tractor Tippin': the farm. Everything is generated from the level's seed, so both machines in an online
// game build exactly the same place: rolling fields inside a fence with one gate, a barn (Thrasher sleeps
// outside its doors), a farmhouse, silo, windmill, corn fields, hay bales, mud, a pond, trees and the night
// sky. The Halloween farm adds pumpkins, jack-o'-lanterns, a graveyard, scarecrows, dead trees and bats.
(() => {
  'use strict';
  const TT = window.TT, { clamp, lerp, smooth } = TT.math, { fbm2 } = TT.noise;
  let T, M;

  const distSeg = (px, pz, ax, az, bx, bz) => {
    const dx = bx - ax, dz = bz - az, L = dx * dx + dz * dz || 1;
    const t = clamp(((px - ax) * dx + (pz - az) * dz) / L, 0, 1);
    return Math.hypot(px - ax - dx * t, pz - az - dz * t);
  };

  class World {
    constructor(level, renderer, quality) {
      T = window.THREE; M = TT.models;
      this.level = level; this.theme = TT.THEMES[level.theme]; this.q = quality;
      this.H = level.size; this.seed = level.seed;
      this.scene = new T.Scene();
      this.circles = []; this.boxes = []; this.flats = []; this.fields = []; this.muds = []; this.tracks = []; this.keep = [];
      this.anim = []; this.lamps = []; this.bales = []; this.pumpkins = []; this.disposables = [];
      this.gateOpenT = 0; this.gateOpen = false;
      const R = TT.rng(level.seed);
      this.layout(R);
      this.buildTerrain();
      this.buildSky(renderer);
      this.buildLights();
      this.buildFence();
      this.buildBuildings();
      // separate sequences: how much corn and how many trees depend on the graphics setting, and the
      // graveyard (which you can bump into) must come out the same on both machines online
      this.buildCorn(TT.rng(level.seed + 101));
      this.buildBales();
      this.buildTrees(TT.rng(level.seed + 202));
      if (level.halloween) this.buildHalloween(TT.rng(level.seed + 303)); else this.buildFireflies(TT.rng(level.seed + 404));
    }

    // ------------------------------------------------------------ layout
    layout(R) {
      const H = this.H, L = this.level;
      const gx = Math.round(R.range(-0.3, 0.3) * H);
      this.gate = { x: gx, z: -H, w: 10 };
      this.spawn = [{ x: gx - 2.6, z: -H + 8, a: 0 }, { x: gx + 2.6, z: -H + 8, a: 0 }];
      const bx = Math.round(R.range(-0.38, 0.38) * H);
      this.barn = { x: bx, z: H - 22, hw: 8.5, hd: 11.5 };
      this.home = { x: bx, z: H - 33.5 - 6, a: Math.PI };
      const side = bx > 0 ? -1 : 1;
      this.silo = { x: bx + side * 13.5, z: H - 17, r: 3.3 };
      const hx = Math.round(-Math.sign(bx || 1) * H * 0.56);
      this.house = { x: hx, z: H - 17, hw: 7, hd: 5.5 };
      this.mill = { x: hx + (hx > 0 ? -17 : 17), z: H - 11 };
      const flat = (x, z, r) => this.flats.push({ x, z, r, h: this.rawHeight(x, z) });
      flat(bx, H - 26, 22); flat(hx, H - 18, 13); flat(gx, -H + 4, 12); flat(this.silo.x, this.silo.z, 7); flat(this.mill.x, this.mill.z, 6);
      this.boxes.push(box(bx, H - 22, 8.3, 11.3, 0, 'barn'), box(hx, H - 17, 6.8, 5.3, 0, 'house'));
      this.circles.push({ x: this.silo.x, z: this.silo.z, r: 3.3, kind: 'silo' }, { x: this.mill.x, z: this.mill.z, r: 1.6, kind: 'mill' });
      this.keep.push({ x: gx, z: -H + 12, r: 20 }, { x: bx, z: H - 26, r: 26 }, { x: hx, z: H - 17, r: 15 }, { x: this.silo.x, z: this.silo.z, r: 8 }, { x: this.mill.x, z: this.mill.z, r: 6 });
      // dirt tracks
      const mid = { x: lerp(gx, bx, 0.5) + R.range(-0.2, 0.2) * H, z: R.range(-0.15, 0.15) * H };
      this.tracks.push([[gx, -H - 30], [gx, -H + 18], [mid.x, mid.z], [bx, H - 36], [bx, H - 30]]);
      this.tracks.push([[bx, H - 36], [lerp(bx, hx, 0.5), H - 34], [hx, H - 26], [hx, H - 22]]);
      const inKeep = (x, z, pad = 0) => this.keep.some(k => Math.hypot(x - k.x, z - k.z) < k.r + pad);
      const inside = (x, z, m) => Math.abs(x) < H - m && Math.abs(z) < H - m;
      this.inKeep = inKeep;
      // pond
      if (L.pond) for (let i = 0; i < 80; i++) {
        const r = R.range(9, 13), x = R.range(-H + 20, H - 20), z = R.range(-H + 30, H - 30);
        if (inKeep(x, z, r + 4)) continue;
        this.pond = { x, z, r, h: this.rawHeight(x, z) };
        this.keep.push({ x, z, r: r + 4 }); break;
      }
      // corn fields
      for (let n = 0; n < (L.corn || 0); n++) for (let i = 0; i < 200; i++) {
        const w = Math.round(R.range(22, 38)), d = Math.round(R.range(18, 30));
        const x = R.range(-H + 10 + w / 2, H - 10 - w / 2), z = R.range(-H + 24 + d / 2, H - 14 - d / 2);
        const corners = [[x - w / 2, z - d / 2], [x + w / 2, z - d / 2], [x - w / 2, z + d / 2], [x + w / 2, z + d / 2], [x, z]];
        if (corners.some(c => inKeep(c[0], c[1], 4))) continue;
        if (this.keep.some(k => Math.abs(k.x - x) < w / 2 + k.r && Math.abs(k.z - z) < d / 2 + k.r && Math.hypot(clamp(k.x, x - w / 2, x + w / 2) - k.x, clamp(k.z, z - d / 2, z + d / 2) - k.z) < k.r + 3)) continue;
        if (this.fields.some(f => Math.abs(f.x - x) < (f.w + w) / 2 + 9 && Math.abs(f.z - z) < (f.d + d) / 2 + 9)) continue;
        const cols = Math.ceil(w / 2), rows = Math.ceil(d / 2);
        this.fields.push({ x, z, w, d, cols, rows, mowed: new Uint8Array(cols * rows) });
        break;
      }
      const inField = (x, z, pad = 0) => this.fields.find(f => Math.abs(x - f.x) < f.w / 2 + pad && Math.abs(z - f.z) < f.d / 2 + pad);
      // mud
      for (let n = 0; n < (L.mud || 0); n++) for (let i = 0; i < 60; i++) {
        const r = R.range(3, 7), x = R.range(-H + 8, H - 8), z = R.range(-H + 20, H - 8);
        if (inKeep(x, z, r) || inField(x, z, r)) continue;
        this.muds.push({ x, z, r }); break;
      }
      // tractors, in little herds
      const spots = this.tractorSpots = [];
      const N = L.tractors, herds = Math.ceil(N / 3), centres = [];
      for (let i = 0; i < 400 && centres.length < herds; i++) {
        const x = R.range(-H + 16, H - 16), z = R.range(-H + 30, H - 20);
        if (inKeep(x, z, 6) || centres.some(c => Math.hypot(c.x - x, c.z - z) < 30)) continue;
        if (Math.hypot(x - this.home.x, z - this.home.z) < 30) continue;
        centres.push({ x, z });
      }
      let ci = 0;
      for (let i = 0; i < 3000 && spots.length < N; i++) {
        const c = centres[ci % centres.length];
        const a = R() * Math.PI * 2, d = R.range(0, 9), x = c.x + Math.cos(a) * d, z = c.z + Math.sin(a) * d;
        if (!inside(x, z, 8) || inKeep(x, z, 3) || spots.some(s => Math.hypot(s.x - x, s.z - z) < 6.2)) continue;
        if (this.pond && Math.hypot(x - this.pond.x, z - this.pond.z) < this.pond.r + 3) continue;
        if (this.muds.some(m => Math.hypot(m.x - x, m.z - z) < m.r + 2)) continue;
        spots.push({ x, z, a: R() * Math.PI * 2, c: R.int(0, 7) }); ci++;
      }
      // clear the corn round any tractor that ended up in a field
      for (const s of spots) { const f = inField(s.x, s.z, 3); if (f) this.clearCorn(f, s.x, s.z, 6); }
      // hay bales: a few rows and some singles
      const nb = L.bales || 0, ok = (x, z, r) => inside(x, z, 6) && !inKeep(x, z, r) && !inField(x, z, r) && !spots.some(s => Math.hypot(s.x - x, s.z - z) < 5.5) && !this.bales.some(b => Math.hypot(b.x - x, b.z - z) < 2.2) && !(this.pond && Math.hypot(x - this.pond.x, z - this.pond.z) < this.pond.r + 2);
      for (let i = 0; i < 600 && this.bales.length < nb; i++) {
        const x = R.range(-H + 8, H - 8), z = R.range(-H + 22, H - 8);
        if (R() < 0.45) {
          const a = R() * Math.PI, n = R.int(3, 6), row = [];
          for (let j = 0; j < n; j++) { const bx2 = x + Math.cos(a) * j * 2.0, bz = z + Math.sin(a) * j * 2.0; if (ok(bx2, bz, 1.5)) row.push({ x: bx2, z: bz, a: a + Math.PI / 2 }); else break; }
          if (row.length >= 3) for (const b of row) if (this.bales.length < nb) this.bales.push(Object.assign(b, { r: 1.1, alive: true, top: R() < 0.25 }));
        } else if (ok(x, z, 2)) this.bales.push({ x, z, a: R() * Math.PI, r: 1.1, alive: true, top: false });
      }
      // trees inside the fence (mostly near the edges)
      this.innerTrees = [];
      for (let i = 0; i < 800 && this.innerTrees.length < (L.trees || 0); i++) {
        const edge = R() < 0.75, x = edge ? (R() < 0.5 ? -1 : 1) * R.range(H - 9, H - 4) : R.range(-H + 10, H - 10), z = edge ? R.range(-H + 20, H - 6) : R.range(-H + 25, H - 10);
        const [tx, tz] = R() < 0.5 ? [x, z] : [z, x];
        if (!inside(tx, tz, 3) || inKeep(tx, tz, 4) || inField(tx, tz, 3) || spots.some(s => Math.hypot(s.x - tx, s.z - tz) < 9)) continue;
        if (this.tracks.some(tr => tr.some((p, k) => k && distSeg(tx, tz, tr[k - 1][0], tr[k - 1][1], p[0], p[1]) < 4))) continue;
        if (this.bales.some(b => Math.hypot(b.x - tx, b.z - tz) < 4)) continue;
        if (this.pond && Math.hypot(tx - this.pond.x, tz - this.pond.z) < this.pond.r + 4) continue;
        if (Math.abs(tx - this.gate.x) < 12 && tz < -H + 15) continue;
        this.innerTrees.push({ x: tx, z: tz, s: R.range(0.85, 1.35), kind: R() < 0.7 ? 0 : 1 });
        this.circles.push({ x: tx, z: tz, r: 0.9, kind: 'tree' });
      }
      // pumpkins (Halloween): a couple of patches and a scatter
      if (L.pumpkins) {
        const patches = [];
        for (let i = 0; i < 100 && patches.length < 3; i++) {
          const x = R.range(-H + 20, H - 20), z = R.range(-H + 25, H - 25);
          if (inKeep(x, z, 6) || inField(x, z, 8) || patches.some(p => Math.hypot(p.x - x, p.z - z) < 30)) continue;
          patches.push({ x, z });
        }
        for (let i = 0; i < 3000 && this.pumpkins.length < L.pumpkins; i++) {
          const p = patches.length && R() < 0.7 ? patches[i % patches.length] : null;
          const a = R() * Math.PI * 2, d = p ? R.range(0, 11) : 0;
          const x = p ? p.x + Math.cos(a) * d : R.range(-H + 8, H - 8), z = p ? p.z + Math.sin(a) * d : R.range(-H + 15, H - 8);
          if (!inside(x, z, 5) || inKeep(x, z, 1) || inField(x, z, 1) || spots.some(s => Math.hypot(s.x - x, s.z - z) < 3.2) || this.pumpkins.some(q => Math.hypot(q.x - x, q.z - z) < 2.4) || this.bales.some(b => Math.hypot(b.x - x, b.z - z) < 2.5)) continue;
          if (this.circles.some(c => Math.hypot(c.x - x, c.z - z) < c.r + 1.5)) continue;
          this.pumpkins.push({ x, z, s: R.range(0.75, 1.3), a: R() * 6.28, alive: true, c: R() });
        }
      }
      for (const b of this.bales) b.hidx = -1;
    }
    clearCorn(f, x, z, r) {
      for (let j = 0; j < f.rows; j++) for (let i = 0; i < f.cols; i++) {
        const cx = f.x - f.w / 2 + (i + 0.5) * 2, cz = f.z - f.d / 2 + (j + 0.5) * 2;
        if (Math.hypot(cx - x, cz - z) < r) f.mowed[j * f.cols + i] = 2;
      }
    }

    // ------------------------------------------------------------ ground height and surface
    rawHeight(x, z) {
      const H = this.H;
      let h = fbm2(x * 0.011, z * 0.011, this.seed, 3) * 1.7;
      const out = Math.max(Math.abs(x), Math.abs(z)) - H;
      if (out > 3) h += smooth(clamp((out - 3) / 80, 0, 1)) * (7 + fbm2(x * 0.007, z * 0.007, this.seed + 5, 3) * 12);
      return h;
    }
    height(x, z) {
      let h = this.rawHeight(x, z);
      for (const f of this.flats) {
        const d = Math.hypot(x - f.x, z - f.z);
        if (d < f.r + 12) h = lerp(h, f.h, smooth(clamp(1 - (d - f.r) / 12, 0, 1)));
      }
      const p = this.pond;
      if (p) { const d = Math.hypot(x - p.x, z - p.z); if (d < p.r + 4) h = lerp(h, p.h, smooth(clamp(1 - (d - p.r) / 4, 0, 1))) - 1.3 * smooth(clamp(1 - d / p.r, 0, 1)); }
      return h;
    }
    // 0 grass, 1 corn, 2 mud, 3 pond
    surface(x, z) {
      const p = this.pond;
      if (p && Math.hypot(x - p.x, z - p.z) < p.r - 0.8) return 3;
      for (const m of this.muds) if (Math.hypot(x - m.x, z - m.z) < m.r) return 2;
      const f = this.fieldAt(x, z);
      if (f) { const i = Math.floor((x - f.x + f.w / 2) / 2), j = Math.floor((z - f.z + f.d / 2) / 2); if (!f.mowed[j * f.cols + i]) return 1; }
      return 0;
    }
    fieldAt(x, z) { for (const f of this.fields) if (Math.abs(x - f.x) < f.w / 2 && Math.abs(z - f.z) < f.d / 2) return f; return null; }
    // push a circle out of buildings, trees, silo and standing bales. Returns how hard it hit (0 = no contact).
    collide(o, r, skipBales) {
      let hit = 0, nx = 0, nz = 0;
      for (const c of this.circles) {
        const dx = o.x - c.x, dz = o.z - c.z, d = Math.hypot(dx, dz), m = c.r + r;
        if (d < m && d > 1e-4) { o.x = c.x + dx / d * m; o.z = c.z + dz / d * m; hit = Math.max(hit, m - d); nx = dx / d; nz = dz / d; }
      }
      if (!skipBales) for (const b of this.bales) {
        if (!b.alive) continue;
        const dx = o.x - b.x, dz = o.z - b.z, d = Math.hypot(dx, dz), m = b.r + r;
        if (d < m && d > 1e-4) { o.x = b.x + dx / d * m; o.z = b.z + dz / d * m; hit = Math.max(hit, m - d); nx = dx / d; nz = dz / d; }
      }
      for (const b of this.boxes) {
        const dx = o.x - b.x, dz = o.z - b.z;
        const lx = dx * b.c + dz * b.s, lz = -dx * b.s + dz * b.c;
        const cx = clamp(lx, -b.hw, b.hw), cz = clamp(lz, -b.hd, b.hd);
        let ex = lx - cx, ez = lz - cz, d = Math.hypot(ex, ez);
        if (d >= r) continue;
        if (d < 1e-4) { // centre inside the box: push out the shortest way
          const px = b.hw - Math.abs(lx), pz = b.hd - Math.abs(lz);
          if (px < pz) { ex = Math.sign(lx) || 1; ez = 0; } else { ex = 0; ez = Math.sign(lz) || 1; }
          d = 0;
        } else { ex /= d; ez /= d; }
        const nlx = cx + ex * r, nlz = cz + ez * r;
        o.x = b.x + nlx * b.c - nlz * b.s; o.z = b.z + nlx * b.s + nlz * b.c;
        hit = Math.max(hit, r - d); nx = ex * b.c - ez * b.s; nz = ex * b.s + ez * b.c;
      }
      o.nx = nx; o.nz = nz;
      return hit;
    }

    // how far along (x0,z0)->(x1,z1) the camera can go before it's inside a building (0..1)
    clearLine(x0, z0, x1, z1, y0, y1) {
      const inBox = (x, z, y) => {
        for (const b of this.boxes) {
          if (b.kind !== 'barn' && b.kind !== 'house') continue;
          const dx = x - b.x, dz = z - b.z, lx = dx * b.c + dz * b.s, lz = -dx * b.s + dz * b.c;
          if (Math.abs(lx) < b.hw + 0.6 && Math.abs(lz) < b.hd + 0.6 && y < this.height(b.x, b.z) + (b.kind === 'barn' ? 12 : 9)) return true;
        }
        for (const c of this.circles) if ((c.kind === 'silo' || c.kind === 'tree') && Math.hypot(x - c.x, z - c.z) < c.r + (c.kind === 'tree' ? 1.2 : 0.6) && y < this.height(c.x, c.z) + (c.kind === 'silo' ? 16 : 6)) return true;
        return false;
      };
      for (let i = 1; i <= 10; i++) {
        const t = i / 10;
        if (inBox(x0 + (x1 - x0) * t, z0 + (z1 - z0) * t, y0 + (y1 - y0) * t)) return Math.max(0.15, (i - 1.5) / 10);
      }
      return 1;
    }

    // ------------------------------------------------------------ terrain
    buildTerrain() {
      const H = this.H, size = 2 * (H + 110), cell = { high: 1.6, medium: 2.0, low: 2.8 }[this.q.name] || 2;
      const n = Math.round(size / cell);
      const g = new T.PlaneGeometry(size, size, n, n); g.rotateX(-Math.PI / 2);
      const pos = g.attributes.position, cols = new Float32Array(pos.count * 3), th = this.theme;
      const gA = new T.Color(th.grass[0]), gB = new T.Color(th.grass[1]), dirt = new T.Color('#6b5236'), soil = new T.Color('#4a3524'), soil2 = new T.Color('#3a2a1c'),
        mud = new T.Color('#33251a'), wheat = new T.Color(this.level.halloween ? '#7a5a2a' : '#8f7f3c'), yard = new T.Color('#6d5a40'), bed = new T.Color('#2a2a20'), c = new T.Color();
      for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i), z = pos.getZ(i);
        pos.setY(i, this.height(x, z));
        const k = fbm2(x * 0.05, z * 0.05, this.seed + 9, 2) * 0.5 + 0.5;
        c.copy(gA).lerp(gB, k).multiplyScalar(0.85 + fbm2(x * 0.3, z * 0.3, 3, 1) * 0.12);
        const out = Math.max(Math.abs(x), Math.abs(z)) - H;
        if (out > 6) { const s = fbm2(x * 0.012, z * 0.012, this.seed + 21, 2); if (s > 0.15) c.lerp(wheat, clamp((s - 0.15) * 4, 0, 0.85)); }
        for (const tr of this.tracks) for (let j = 1; j < tr.length; j++) {
          const d = distSeg(x, z, tr[j - 1][0], tr[j - 1][1], tr[j][0], tr[j][1]);
          if (d < 3.2) c.lerp(dirt, smooth(clamp((3.2 - d) / 1.6, 0, 1)) * 0.85);
        }
        for (const f of this.flats) { const d = Math.hypot(x - f.x, z - f.z); if (d < f.r * 0.8) c.lerp(yard, smooth(clamp((f.r * 0.8 - d) / 6, 0, 1)) * 0.6); }
        for (const f of this.fields) {
          const dx = Math.abs(x - f.x) - f.w / 2, dz = Math.abs(z - f.z) - f.d / 2;
          if (dx < 1.5 && dz < 1.5) { const row = Math.sin((z - f.z) / 1.4 * Math.PI * 2) > 0; c.lerp(row ? soil : soil2, smooth(clamp(Math.min(-dx, -dz) / 1.5 + 0.5, 0, 1))); }
        }
        for (const m of this.muds) { const d = Math.hypot(x - m.x, z - m.z); if (d < m.r + 1.5) c.lerp(mud, smooth(clamp((m.r + 1.5 - d) / 2.5, 0, 1))); }
        if (this.pond) { const d = Math.hypot(x - this.pond.x, z - this.pond.z); if (d < this.pond.r + 1) c.lerp(bed, smooth(clamp((this.pond.r + 1 - d) / 2, 0, 1))); }
        cols[i * 3] = c.r; cols[i * 3 + 1] = c.g; cols[i * 3 + 2] = c.b;
      }
      g.setAttribute('color', new T.BufferAttribute(cols, 3));
      g.computeVertexNormals();
      const detail = M.canvasTex(128, 128, (cx, w, h) => {
        const R = TT.rng(5);
        cx.fillStyle = '#d8d8d8'; cx.fillRect(0, 0, w, h);
        for (let i = 0; i < 1600; i++) { const v = R.int(150, 255); cx.fillStyle = `rgb(${v},${v},${v})`; cx.fillRect(R() * w, R() * h, R.range(1, 2.5), R.range(1, 4)); }
      }, true);
      detail.repeat.set(size / 7, size / 7);
      const mat = new T.MeshStandardMaterial({ vertexColors: true, map: detail, roughness: 0.95, metalness: 0 });
      const mesh = new T.Mesh(g, mat); mesh.receiveShadow = true; this.scene.add(mesh);
      this.terrain = mesh;
      // muddy puddle sheen and the pond surface
      for (const m of this.muds) {
        const p = new T.Mesh(new T.CircleGeometry(m.r * 0.7, 20), new T.MeshStandardMaterial({ color: 0x2a1d12, roughness: 0.15, metalness: 0.2, transparent: true, opacity: 0.7, depthWrite: false }));
        p.rotation.x = -Math.PI / 2; p.position.set(m.x, this.height(m.x, m.z) + 0.05, m.z); p.renderOrder = 1; this.scene.add(p);
      }
      if (this.pond) {
        const p = this.pond, w = new T.Mesh(new T.CircleGeometry(p.r + 0.5, 32), new T.MeshStandardMaterial({ color: 0x1a3550, roughness: 0.05, metalness: 0.6, transparent: true, opacity: 0.88 }));
        w.rotation.x = -Math.PI / 2; w.position.set(p.x, p.h - 0.35, p.z); this.scene.add(w);
        this.water = w; p.y = p.h - 0.35;
        // reeds and lily pads
        const k = new M.Kit(), R = TT.rng(this.seed + 3);
        for (let i = 0; i < 40; i++) { const a = R() * 6.28, d = p.r + R.range(-0.8, 0.6), x = p.x + Math.cos(a) * d, z = p.z + Math.sin(a) * d; k.rod('matte', [x, p.y - 0.3, z], [x + R.range(-0.2, 0.2), p.y + R.range(0.8, 1.6), z + R.range(-0.2, 0.2)], 0.03, '#4a5a2a', 4); }
        for (let i = 0; i < 10; i++) { const a = R() * 6.28, d = R.range(1, p.r - 2); k.add('matte', M.CYL(10), '#3a6a2a', [p.x + Math.cos(a) * d, p.y + 0.02, p.z + Math.sin(a) * d], [0, 0, 0], [R.range(0.3, 0.6), 0.02, R.range(0.3, 0.6)]); }
        this.scene.add(k.build({}, false));
      }
    }

    // ------------------------------------------------------------ sky, moon, stars, lights
    buildSky(renderer) {
      const th = this.theme;
      this.scene.fog = new T.FogExp2(th.fog, th.fogD);
      this.scene.background = new T.Color(th.fog);
      const sky = new T.Mesh(new T.SphereGeometry(900, 32, 16), new T.ShaderMaterial({
        side: T.BackSide, depthWrite: false, fog: false,
        uniforms: { top: { value: new T.Color(th.sky[0]) }, mid: { value: new T.Color(th.sky[1]) }, fogc: { value: new T.Color(th.fog) } },
        vertexShader: 'varying vec3 vD; void main(){ vD = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
        fragmentShader: 'uniform vec3 top; uniform vec3 mid; uniform vec3 fogc; varying vec3 vD; void main(){ float y = vD.y; vec3 c = mix(fogc, mid, smoothstep(0.0, 0.12, y)); c = mix(c, top, smoothstep(0.1, 0.65, y)); gl_FragColor = vec4(c, 1.0); }',
      }));
      sky.renderOrder = -10; sky.frustumCulled = false; this.scene.add(sky); this.sky = sky;
      // stars
      if (th.stars > 0) {
        const R = TT.rng(42), n = Math.round(900 * th.stars), p = new Float32Array(n * 3);
        for (let i = 0; i < n; i++) {
          const a = R() * Math.PI * 2, y = R.range(0.08, 1), r = Math.sqrt(1 - y * y);
          p[i * 3] = Math.cos(a) * r * 850; p[i * 3 + 1] = y * 850; p[i * 3 + 2] = Math.sin(a) * r * 850;
        }
        const g = new T.BufferGeometry(); g.setAttribute('position', new T.BufferAttribute(p, 3));
        const st = new T.Points(g, new T.PointsMaterial({ color: 0xffffff, size: 1.6, sizeAttenuation: false, fog: false, transparent: true, opacity: 0.85, depthWrite: false }));
        st.frustumCulled = false; st.renderOrder = -9; sky.add(st);
      }
      // moon with a soft halo
      const mtex = M.canvasTex(256, 256, (g, w) => {
        const c = new T.Color(th.moon), col = `${Math.round(c.r * 255)},${Math.round(c.g * 255)},${Math.round(c.b * 255)}`;
        const halo = g.createRadialGradient(w / 2, w / 2, w * 0.18, w / 2, w / 2, w / 2);
        halo.addColorStop(0, `rgba(${col},0.45)`); halo.addColorStop(1, `rgba(${col},0)`);
        g.fillStyle = halo; g.fillRect(0, 0, w, w);
        g.fillStyle = `rgb(${col})`; g.beginPath(); g.arc(w / 2, w / 2, w * 0.2, 0, Math.PI * 2); g.fill();
        const R = TT.rng(8);
        for (let i = 0; i < 9; i++) { g.fillStyle = 'rgba(0,0,0,0.08)'; g.beginPath(); g.arc(w / 2 + R.range(-0.13, 0.13) * w, w / 2 + R.range(-0.13, 0.13) * w, R.range(4, 14), 0, Math.PI * 2); g.fill(); }
      });
      const moon = new T.Mesh(new T.PlaneGeometry(th.moonSize * 9, th.moonSize * 9), new T.MeshBasicMaterial({ map: mtex, transparent: true, fog: false, depthWrite: false, toneMapped: false }));
      moon.renderOrder = -8; moon.frustumCulled = false; this.scene.add(moon); this.moon = moon;
      this.moonDir = new T.Vector3(...th.moonPos).normalize();
      // a soft environment for shiny paint
      const pm = new T.PMREMGenerator(renderer), es = new T.Scene();
      es.add(new T.Mesh(new T.SphereGeometry(10, 16, 8), sky.material.clone()));
      const glow = new T.Mesh(new T.SphereGeometry(1.2, 12, 8), new T.MeshBasicMaterial({ color: new T.Color(th.moon).multiplyScalar(6) }));
      glow.position.copy(this.moonDir).multiplyScalar(8); es.add(glow);
      const rt = pm.fromScene(es, 0.04); pm.dispose();
      this.scene.environment = rt.texture; this.envRT = rt;
      this.scene.environmentIntensity = th.night ? 0.7 : 0.9;
    }
    buildLights() {
      const th = this.theme, q = this.q;
      this.scene.add(new T.HemisphereLight(th.hemi[0], th.hemi[1], th.hemi[2]));
      const sun = this.sun = new T.DirectionalLight(th.light[0], th.light[1]);
      if (q.shadows) {
        sun.castShadow = true; sun.shadow.mapSize.set(q.shadows, q.shadows);
        const s = sun.shadow.camera; s.left = -55; s.right = 55; s.top = 55; s.bottom = -55; s.near = 1; s.far = 260;
        sun.shadow.bias = -0.0006; sun.shadow.normalBias = 0.04;
      }
      this.scene.add(sun); this.scene.add(sun.target);
    }
    // per view, before rendering: sky follows the camera, the shadow box follows the action
    frame(cam, focus) {
      this.sky.position.copy(cam.position);
      this.moon.position.copy(cam.position).addScaledVector(this.moonDir, 780); this.moon.lookAt(cam.position);
      const f = focus || cam.position, snap = 110 / (this.q.shadows || 1024);
      const fx = Math.round(f.x / snap) * snap, fz = Math.round(f.z / snap) * snap;
      this.sun.target.position.set(fx, f.y || 0, fz);
      this.sun.position.set(fx, f.y || 0, fz).addScaledVector(this.moonDir, 120);
      if (this.sun.position.y < 40) this.sun.position.y = 40;
    }
    pointLight(color, intensity, dist, x, y, z, flicker) {
      if (this.q.name === 'low') return null;
      const L = new T.PointLight(color, intensity, dist, 2); L.position.set(x, y, z); this.scene.add(L);
      if (flicker) { const base = intensity, ph = Math.random() * 10; this.anim.push(t => { L.intensity = base * (0.8 + 0.2 * Math.sin(t * 13 + ph) * Math.sin(t * 7.3 + ph * 2)); }); }
      return L;
    }

    // ------------------------------------------------------------ fence and gate
    buildFence() {
      const H = this.H, g = this.gate, wood = this.level.halloween ? '#4a3f36' : '#8a6a48';
      const posts = [], rails = [];
      const side = (ax, az, bx, bz) => {
        const L = Math.hypot(bx - ax, bz - az), n = Math.ceil(L / 3.2);
        for (let i = 0; i <= n; i++) {
          const t = i / n, x = lerp(ax, bx, t), z = lerp(az, bz, t);
          const inGate = Math.abs(z + H) < 0.1 && Math.abs(x - g.x) < g.w / 2 + 0.2;
          if (!inGate) posts.push([x, z]);
          if (i < n) {
            const t2 = (i + 1) / n, x2 = lerp(ax, bx, t2), z2 = lerp(az, bz, t2), mx = (x + x2) / 2;
            if (Math.abs(z + H) < 0.1 && Math.abs(mx - g.x) < g.w / 2 + 1.6) continue;
            rails.push([x, z, x2, z2]);
          }
        }
      };
      side(-H, -H, H, -H); side(H, -H, H, H); side(H, H, -H, H); side(-H, H, -H, -H);
      const pg = M.BOX(), m4 = new T.Matrix4(), q = new T.Quaternion(), e = new T.Euler();
      const pm = new T.InstancedMesh(pg, M.MAT.matte, posts.length);
      const col = new T.Color(wood);
      posts.forEach(([x, z], i) => { m4.compose(new T.Vector3(x, this.height(x, z) + 0.6, z), q.identity(), new T.Vector3(0.18, 1.4, 0.18)); pm.setMatrixAt(i, m4); pm.setColorAt(i, col); });
      const rm = new T.InstancedMesh(pg, M.MAT.matte, rails.length * 2);
      let k = 0;
      for (const [x1, z1, x2, z2] of rails) for (const y of [0.55, 1.05]) {
        const L = Math.hypot(x2 - x1, z2 - z1), h1 = this.height(x1, z1), h2 = this.height(x2, z2);
        e.set(0, -Math.atan2(z2 - z1, x2 - x1), Math.atan2(h2 - h1, L)); q.setFromEuler(e);
        m4.compose(new T.Vector3((x1 + x2) / 2, (h1 + h2) / 2 + y, (z1 + z2) / 2), q, new T.Vector3(L + 0.1, 0.14, 0.07)); rm.setMatrixAt(k, m4); rm.setColorAt(k, col.clone().multiplyScalar(0.9 + (k % 3) * 0.05)); k++;
      }
      for (const im of [pm, rm]) { im.castShadow = !!this.q.shadows; im.receiveShadow = true; this.scene.add(im); }
      // the gate: two white panels on big posts, lanterns, and an arch with a sign
      const gy = this.height(g.x, g.z), kit = new M.Kit(), white = this.level.halloween ? '#bdb3a0' : '#efe9dc';
      for (const s of [-1, 1]) {
        kit.add('matte', M.BOX(), wood, [g.x + s * (g.w / 2 + 0.25), gy + 1.1, g.z], [0, 0, 0], [0.4, 2.2, 0.4]);
        kit.add('matte', M.BOX(), wood, [g.x + s * (g.w / 2 + 0.25), gy + 2.6, g.z], [0, 0, 0], [0.3, 5.2, 0.3]);
        kit.add('metal', M.BOX(), '#222', [g.x + s * (g.w / 2 + 0.25), gy + 2.35, g.z - 0.25], [0, 0, 0], [0.22, 0.3, 0.22]);
        kit.add('glow', M.BOX(), '#ffcf7a', [g.x + s * (g.w / 2 + 0.25), gy + 2.35, g.z - 0.37], [0, 0, 0], [0.16, 0.22, 0.02]);
      }
      kit.add('matte', M.BOX(), wood, [g.x, gy + 5.05, g.z], [0, 0, 0], [g.w + 1.4, 0.35, 0.3]);
      this.scene.add(kit.build({}, !!this.q.shadows));
      const sign = M.decalMesh(M.textDecal(this.level.halloween ? 'HAUNTED HARVEST' : 'SUNNY ACRES FARM', '#2a1a0a', '#e8d6a8', 512, 96, 'bold 58px Georgia, serif'), 5.4, 1.0, { transparent: false, depthWrite: true });
      sign.position.set(g.x, gy + 4.35, g.z - 0.2); sign.rotation.y = Math.PI; this.scene.add(sign);
      const sign2 = sign.clone(); sign2.position.z = g.z + 0.2; sign2.rotation.y = 0; this.scene.add(sign2);
      this.panels = [];
      for (const s of [-1, 1]) {
        const pk = new M.Kit(), L = g.w / 2 - 0.1;
        for (const y of [0.35, 0.75, 1.15, 1.5]) pk.add('matte', M.BOX(), white, [-s * L / 2, y, 0], [0, 0, 0], [L, 0.12, 0.08]);
        pk.add('matte', M.BOX(), white, [-s * 0.1, 0.95, 0], [0, 0, 0], [0.12, 1.4, 0.1]);
        pk.add('matte', M.BOX(), white, [-s * (L - 0.06), 0.95, 0], [0, 0, 0], [0.12, 1.4, 0.1]);
        pk.add('matte', M.BOX(), white, [-s * L / 2, 0.95, 0], [0, 0, s * Math.atan2(1.15, L)], [Math.hypot(L, 1.15), 0.1, 0.07]);
        const p = pk.build({}, !!this.q.shadows);
        p.position.set(g.x + s * (g.w / 2), gy, g.z); p.userData.s = s;
        this.scene.add(p); this.panels.push(p);
      }
      // beacon shown when the gate opens
      const bm = new T.Mesh(new T.CylinderGeometry(1.6, 3.2, 60, 20, 1, true), new T.MeshBasicMaterial({ color: 0x4dff7a, transparent: true, opacity: 0, blending: T.AdditiveBlending, depthWrite: false, side: T.DoubleSide, fog: false }));
      bm.position.set(g.x, gy + 30, g.z - 2); this.scene.add(bm); this.beacon = bm;
      const arrow = M.decalMesh(M.textDecal('▼ EXIT ▼', '#4dff7a', null, 256, 64, 'bold 46px Impact, Arial Black, sans-serif'), 4, 1, { emissive: 0x4dff7a, emissiveIntensity: 1 });
      arrow.position.set(g.x, gy + 6.4, g.z); arrow.visible = false; this.scene.add(arrow); this.exitSign = arrow;
      this.gateLight = this.pointLight(0x4dff7a, 0, 26, g.x, gy + 4, g.z + 3);
      this.anim.push((t, dt) => {
        this.gateOpenT = clamp(this.gateOpenT + (this.gateOpen ? dt : -dt) * 0.8, 0, 1);
        const a = smooth(this.gateOpenT) * 1.75;
        for (const p of this.panels) p.rotation.y = p.userData.s * -a;
        this.beacon.material.opacity = this.gateOpenT * (0.16 + 0.06 * Math.sin(t * 4));
        this.exitSign.visible = this.gateOpenT > 0.5; this.exitSign.lookAt(this.exitSign.position.x, this.exitSign.position.y, this.exitSign.position.z + 1);
        this.exitSign.position.y = gy + 6.4 + Math.sin(t * 3) * 0.2;
        if (this.gateLight) this.gateLight.intensity = this.gateOpenT * 90;
      });
      this.circles.push({ x: g.x - g.w / 2 - 0.25, z: g.z, r: 0.35, kind: 'post' }, { x: g.x + g.w / 2 + 0.25, z: g.z, r: 0.35, kind: 'post' });
    }
    setGateOpen(on) { this.gateOpen = on; }

    // ------------------------------------------------------------ buildings
    buildBuildings() {
      const sh = !!this.q.shadows, hw = !!this.level.halloween;
      const b = this.barn, by = this.height(b.x, b.z), red = hw ? '#6a1e1e' : '#a8261f', trim = hw ? '#cfc3ad' : '#f2ede2', roof = hw ? '#2a2630' : '#3d3a3a';
      const k = new M.Kit();
      // walls and a gambrel roof (profile extruded front to back)
      k.add('paint', M.BOX(), red, [b.x, by + 3.2, b.z], [0, 0, 0], [16, 6.6, 22]);
      const gam = M.profile([['M', -8.3, 6.4], ['L', 8.3, 6.4], ['L', 6.2, 9.6], ['L', 0, 11.6], ['L', -6.2, 9.6]], 22.6, 0.05, 1);
      k.add('roof', gam, roof, [b.x, by, b.z], [0, Math.PI / 2, 0]);
      k.add('paint', M.profile([['M', -7.9, 6.4], ['L', 7.9, 6.4], ['L', 5.9, 9.4], ['L', 0, 11.3], ['L', -5.9, 9.4]], 21.8, 0.02, 1), red, [b.x, by, b.z], [0, Math.PI / 2, 0]);
      // front: big doorway, X-braced doors folded open, hay loft, trim
      const fz = b.z - 11.02;
      k.add('matte', M.BOX(), '#120d0a', [b.x, by + 2.6, fz - 0.01], [0, 0, 0], [7.2, 5.2, 0.1]);
      for (const s of [-1, 1]) {
        const dx = b.x + s * 5.4;
        k.add('matte', M.BOX(), trim, [dx, by + 2.6, fz - 0.12], [0, 0, 0], [3.4, 5.2, 0.14]);
        k.add('paint', M.BOX(), red, [dx, by + 2.6, fz - 0.2], [0, 0, 0], [3.0, 4.8, 0.04]);
        k.add('matte', M.BOX(), trim, [dx, by + 2.6, fz - 0.24], [0, 0, 0.99], [5.6, 0.22, 0.04]);
        k.add('matte', M.BOX(), trim, [dx, by + 2.6, fz - 0.24], [0, 0, -0.99], [5.6, 0.22, 0.04]);
        k.add('matte', M.BOX(), trim, [b.x + s * 7.95, by + 3.2, b.z], [0, 0, 0], [0.25, 6.6, 22.1]);
      }
      k.add('matte', M.BOX(), trim, [b.x, by + 5.3, fz - 0.05], [0, 0, 0], [7.6, 0.3, 0.12]);
      k.add('matte', M.BOX(), '#120d0a', [b.x, by + 8.2, fz - 0.05], [0, 0, 0], [2.6, 2.4, 0.08]);
      k.add('matte', M.BOX(), trim, [b.x, by + 8.2, fz - 0.1], [0, 0, 0], [2.9, 0.18, 0.05]);
      k.add('matte', M.BOX(), trim, [b.x, by + 9.45, fz - 0.1], [0, 0, 0], [2.9, 0.18, 0.05]);
      k.add('matte', M.BOX(), trim, [b.x, by + 6.95, fz - 0.1], [0, 0, 0], [2.9, 0.18, 0.05]);
      k.add('matte', M.BOX(), '#222', [b.x, by + 6.0, fz - 0.6], [0, 0, 0], [0.5, 0.25, 0.8]);
      k.add('glow', M.SPH(10, 6), '#ffd27a', [b.x, by + 5.85, fz - 0.9], [0, 0, 0], [0.22, 0.18, 0.22]);
      // weathervane rooster
      k.rod('metal', [b.x, by + 11.6, b.z], [b.x, by + 13.2, b.z], 0.04, '#333');
      k.add('metal', M.BOX(), '#333', [b.x, by + 13.3, b.z], [0, 0.6, 0], [0.9, 0.5, 0.05]);
      // square hay bales stacked by the door
      for (let i = 0; i < 4; i++) for (let j = 0; j < 3 - (i > 1 ? 1 : 0); j++) k.add('hay', M.BOX(), '#c8a24a', [b.x - 6.5 + (i % 2) * 1.25, by + 0.3 + j * 0.6, fz - 2.5 - Math.floor(i / 2) * 0.6], [0, 0.05 * j, 0], [1.2, 0.58, 0.55]);
      this.boxes.push(box(b.x - 5.9, fz - 2.8, 1.3, 0.7, 0, 'hay'));
      // water trough
      k.add('metal', M.BOX(), '#7a8a8a', [b.x + 6.5, by + 0.4, fz - 3], [0, 0, 0], [2.6, 0.8, 0.9]);
      k.add('matte', M.BOX(), '#1d3550', [b.x + 6.5, by + 0.78, fz - 3], [0, 0, 0], [2.4, 0.04, 0.7]);
      this.boxes.push(box(b.x + 6.5, fz - 3, 1.35, 0.5, 0, 'trough'));
      // silo
      const s = this.silo, sy = this.height(s.x, s.z);
      k.add('metal', M.CYL(24), hw ? '#5a5a66' : '#9fb0b8', [s.x, sy + 7, s.z], [0, 0, 0], [3.2, 14, 3.2]);
      for (let y = 1; y < 14; y += 1.6) k.add('metal', M.CYL(24), '#7d8d95', [s.x, sy + y, s.z], [0, 0, 0], [3.25, 0.12, 3.25]);
      k.add('metal', M.HEMI(24), hw ? '#4a4a55' : '#b8c4c8', [s.x, sy + 14, s.z], [0, 0, 0], [3.25, 2.4, 3.25]);
      for (let y = 0.5; y < 14; y += 0.45) k.add('metal', M.BOX(), '#444', [s.x, sy + y, s.z - 3.3], [0, 0, 0], [0.6, 0.05, 0.05]);
      // farmhouse
      const h = this.house, hy = this.height(h.x, h.z), wall = hw ? '#9a9080' : '#efe6d2', hroof = hw ? '#2a2025' : '#6a2a22';
      k.add('paint', M.BOX(), wall, [h.x, hy + 2.6, h.z], [0, 0, 0], [13.5, 5.2, 10.5]);
      k.add('roof', M.profile([['M', -5.8, 5.1], ['L', 5.8, 5.1], ['L', 0, 8.6]], 14.4, 0.05, 1), hroof, [h.x, hy, h.z], [0, 0, 0]);
      k.add('matte', M.BOX(), '#5a3a2a', [h.x + 3.5, hy + 8, h.z + 2], [0, 0, 0], [0.9, 2.6, 0.9]);
      const hz = h.z - 5.26;
      for (const x of [-4.5, -2, 2, 4.5]) for (const y of [1.6, 3.9]) { if (y < 2 && Math.abs(x) < 2.5) continue; k.add('glow', M.BOX(), hw ? '#ff9a3a' : '#ffd88a', [h.x + x, hy + y, hz], [0, 0, 0], [1.1, 1.2, 0.05]); k.add('matte', M.BOX(), '#3a2a20', [h.x + x, hy + y, hz - 0.02], [0, 0, 0], [0.08, 1.2, 0.05]); }
      k.add('matte', M.BOX(), '#4a2a1a', [h.x, hy + 1.2, hz - 0.03], [0, 0, 0], [1.2, 2.3, 0.06]);
      k.add('matte', M.BOX(), '#8a7a6a', [h.x, hy + 0.15, hz - 1.4], [0, 0, 0], [13.5, 0.3, 2.8]);
      k.add('roof', M.BOX(), hroof, [h.x, hy + 3.0, hz - 1.5], [-0.12, 0, 0], [13.8, 0.15, 3.2]);
      for (const x of [-6.4, -2, 2, 6.4]) k.add('matte', M.BOX(), wall, [h.x + x, hy + 1.5, hz - 2.7], [0, 0, 0], [0.18, 2.9, 0.18]);
      this.scene.add(k.build({ paint: M.paint(0.75, 0.02), roof: M.paint(0.85, 0.05), hay: M.paint(0.9, 0) }, sh));
      this.pointLight(0xffc070, 120, 34, b.x, by + 5.5, fz - 2.5, false);
      this.pointLight(0xffb060, 90, 26, h.x, hy + 3, hz - 3, false);
      // windmill (the rotor turns)
      const m = this.mill, my = this.height(m.x, m.z), wk = new M.Kit(), steel = hw ? '#4a4a50' : '#8a9096';
      for (const [dx, dz] of [[-1.3, -1.3], [1.3, -1.3], [1.3, 1.3], [-1.3, 1.3]]) wk.rod('metal', [m.x + dx, my, m.z + dz], [m.x + dx * 0.2, my + 11, m.z + dz * 0.2], 0.08, steel, 6);
      for (let y = 2; y < 11; y += 3) wk.add('metal', M.BOX(), steel, [m.x, my + y, m.z], [0, 0, 0], [2.6 * (1 - y / 13.5), 0.08, 2.6 * (1 - y / 13.5)]);
      wk.add('metal', M.BOX(), steel, [m.x, my + 11.2, m.z], [0, 0, 0], [0.9, 0.5, 0.9]);
      wk.add('metal', M.BOX(), steel, [m.x, my + 11.4, m.z + 2], [0, 0, 0], [0.08, 1.4, 2.6]);
      this.scene.add(wk.build({}, sh));
      const rk = new M.Kit();
      for (let i = 0; i < 14; i++) { const a = i / 14 * Math.PI * 2; rk.add('metal', M.BOX(), hw ? '#6a6a70' : '#c8ccd0', [Math.cos(a) * 1.4, Math.sin(a) * 1.4, 0], [0, 0.35, a], [1.7, 0.36, 0.03]); }
      rk.add('metal', M.CYL(10), steel, [0, 0, 0], [Math.PI / 2, 0, 0], [0.3, 0.4, 0.3]);
      const rotor = rk.build({}, sh); rotor.position.set(m.x, my + 11.3, m.z - 0.6); this.scene.add(rotor);
      this.anim.push((t, dt) => { rotor.rotation.z += dt * 1.1; });
    }

    // ------------------------------------------------------------ corn
    buildCorn(R) {
      if (!this.fields.length) return;
      const hw = !!this.level.halloween, k = new M.Kit();
      const stalk = hw ? '#8a7340' : '#5f8a2e', leaf = hw ? '#9a7a3a' : '#6c9a32', leaf2 = hw ? '#7a5e2e' : '#4f7a26', tassel = '#d8c070';
      k.add('m', M.CYL(5, 0.5), stalk, [0, 1.2, 0], [0, 0, 0], [0.045, 2.4, 0.045]);
      for (let i = 0; i < 5; i++) { const a = i * 2.4; k.add('m', M.CONE(4), i % 2 ? leaf : leaf2, [Math.cos(a) * 0.32, 0.55 + i * 0.36, Math.sin(a) * 0.32], [0, -a, 1.1], [0.08, 0.95, 0.015]); }
      k.add('m', M.CONE(5), tassel, [0, 2.55, 0], [0, 0, 0], [0.09, 0.45, 0.09]);
      k.add('m', M.CYL(6, 0.6), hw ? '#c8a050' : '#d8c860', [0.1, 1.25, 0], [0, 0, 0.35], [0.07, 0.35, 0.07]);
      const geo = k.geometry('m');
      const sp = { high: [1.0, 1.35], medium: [1.25, 1.5], low: [1.6, 1.9] }[this.q.name] || [1.25, 1.5];
      const list = [];
      for (const f of this.fields) for (let z = -f.d / 2 + 0.6; z < f.d / 2; z += sp[1]) for (let x = -f.w / 2 + 0.5; x < f.w / 2; x += sp[0]) {
        const wx = f.x + x + R.range(-0.2, 0.2), wz = f.z + z + R.range(-0.12, 0.12);
        const i = clamp(Math.floor((wx - f.x + f.w / 2) / 2), 0, f.cols - 1), j = clamp(Math.floor((wz - f.z + f.d / 2) / 2), 0, f.rows - 1);
        if (f.mowed[j * f.cols + i]) continue;
        list.push({ f, cell: j * f.cols + i, x: wx, z: wz, s: R.range(0.8, 1.15), a: R() * 6.28, l: R.range(-0.08, 0.08) });
      }
      const im = this.corn = new T.InstancedMesh(geo, M.MAT.matte2, list.length);
      const m4 = new T.Matrix4(), q = new T.Quaternion(), e = new T.Euler();
      list.forEach((c, i) => { e.set(c.l, c.a, c.l * 0.5); q.setFromEuler(e); m4.compose(new T.Vector3(c.x, this.height(c.x, c.z) - 0.05, c.z), q, new T.Vector3(c.s, c.s, c.s)); im.setMatrixAt(i, m4); c.i = i; });
      im.castShadow = !!this.q.shadows; im.receiveShadow = true; this.scene.add(im);
      for (const f of this.fields) f.inst = {};
      for (const c of list) (c.f.inst[c.cell] || (c.f.inst[c.cell] = [])).push(c);
      this.cornList = list;
    }
    // Thrasher mows through the corn: cells inside r of (x, z) are cut to stubble
    mow(x, z, r) {
      let n = 0;
      for (const f of this.fields) {
        if (Math.abs(x - f.x) > f.w / 2 + r || Math.abs(z - f.z) > f.d / 2 + r) continue;
        const i0 = clamp(Math.floor((x - r - f.x + f.w / 2) / 2), 0, f.cols - 1), i1 = clamp(Math.floor((x + r - f.x + f.w / 2) / 2), 0, f.cols - 1);
        const j0 = clamp(Math.floor((z - r - f.z + f.d / 2) / 2), 0, f.rows - 1), j1 = clamp(Math.floor((z + r - f.z + f.d / 2) / 2), 0, f.rows - 1);
        for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
          const idx = j * f.cols + i; if (f.mowed[idx]) continue;
          const cx = f.x - f.w / 2 + (i + 0.5) * 2, cz = f.z - f.d / 2 + (j + 0.5) * 2;
          if (Math.hypot(cx - x, cz - z) > r + 1) continue;
          f.mowed[idx] = 1; n++;
          for (const c of f.inst[idx] || []) this.stubble(c);
        }
      }
      if (n) this.corn.instanceMatrix.needsUpdate = true;
      return n;
    }
    stubble(c) {
      const m4 = new T.Matrix4(), q = new T.Quaternion().setFromEuler(new T.Euler(0, c.a, 0));
      m4.compose(new T.Vector3(c.x, this.height(c.x, c.z) - 0.05, c.z), q, new T.Vector3(c.s, 0.12, c.s));
      this.corn.setMatrixAt(c.i, m4);
    }

    // ------------------------------------------------------------ hay bales
    buildBales() {
      if (!this.bales.length) return;
      const k = new M.Kit();
      k.add('m', M.CYL(16), '#c9a24a', [0, 0, 0], [0, 0, Math.PI / 2], [0.9, 1.3, 0.9]);
      for (const s of [-1, 1]) { k.add('m', M.CYL(16), '#a8843a', [s * 0.651, 0, 0], [0, 0, Math.PI / 2], [0.86, 0.01, 0.86]); k.add('m', M.TORUS(Math.PI * 2, 0.06), '#8a6a2a', [s * 0.66, 0, 0], [0, Math.PI / 2, 0], 0.5); k.add('m', M.TORUS(Math.PI * 2, 0.08), '#8a6a2a', [s * 0.66, 0, 0], [0, Math.PI / 2, 0], 0.22); }
      for (const x of [-0.35, 0.35]) k.add('m', M.TORUS(Math.PI * 2, 0.012), '#e8d8a0', [x, 0, 0], [0, Math.PI / 2, 0], 0.905);
      const n = this.bales.length + this.bales.filter(b => b.top).length;
      const im = this.baleMesh = new T.InstancedMesh(k.geometry('m'), M.MAT.matte, n);
      const m4 = new T.Matrix4(), q = new T.Quaternion();
      let i = 0;
      for (const b of this.bales) {
        const y = this.height(b.x, b.z) + 0.85;
        q.setFromEuler(new T.Euler(0, b.a, 0)); m4.compose(new T.Vector3(b.x, y, b.z), q, new T.Vector3(1, 1, 1)); im.setMatrixAt(i, m4); b.idx = [i++];
        if (b.top) { m4.compose(new T.Vector3(b.x, y + 1.7, b.z), q, new T.Vector3(1, 1, 1)); im.setMatrixAt(i, m4); b.idx.push(i++); }
      }
      im.castShadow = !!this.q.shadows; im.receiveShadow = true; this.scene.add(im);
    }
    smashBale(b) {
      if (!b.alive) return;
      b.alive = false;
      const m4 = new T.Matrix4().makeScale(0, 0, 0);
      for (const i of b.idx) this.baleMesh.setMatrixAt(i, m4);
      this.baleMesh.instanceMatrix.needsUpdate = true;
    }

    // ------------------------------------------------------------ trees (inside and a wood all round)
    buildTrees(R) {
      const H = this.H, hw = !!this.level.halloween, sh = !!this.q.shadows;
      const outer = [], n = { high: 230, medium: 170, low: 110 }[this.q.name] || 170;
      for (let i = 0; i < n * 4 && outer.length < n; i++) {
        const a = R() * Math.PI * 2, d = R.range(H + 7, H + 85), x = Math.cos(a) * d * 1.15, z = Math.sin(a) * d * 1.15;
        if (Math.max(Math.abs(x), Math.abs(z)) < H + 6) continue;
        if (Math.abs(x - this.gate.x) < 14 && z < -H) continue;
        outer.push({ x, z, s: R.range(0.9, 1.7), kind: hw ? (R() < 0.45 ? 2 : R() < 0.5 ? 0 : 1) : R() < 0.6 ? 0 : 1 });
      }
      const all = [...this.innerTrees.map(t => ({ ...t, kind: hw && R() < 0.5 ? 2 : t.kind })), ...outer];
      // oak: trunk + lumpy canopy; pine: stacked cones; dead: bare branches
      const oak = new M.Kit(), pine = new M.Kit(), dead = new M.Kit();
      oak.add('m', M.CYL(7, 0.7), '#5a4030', [0, 1.6, 0], [0, 0, 0], [0.35, 3.2, 0.35]);
      for (const [x, y, z, r] of [[0, 4.6, 0, 2.4], [1.3, 4.1, 0.4, 1.7], [-1.2, 4.2, -0.5, 1.8], [0.2, 5.6, -0.6, 1.6], [-0.4, 4.0, 1.2, 1.6]]) oak.add('m', M.geo('ico1', () => new T.IcosahedronGeometry(1, 1)), hw ? '#a8561e' : '#3d6a2a', [x, y, z], [0, 0, 0], r);
      pine.add('m', M.CYL(6, 0.7), '#4a3424', [0, 1, 0], [0, 0, 0], [0.3, 2, 0.3]);
      for (const [y, r, h] of [[2.6, 2.2, 3], [4.2, 1.7, 2.6], [5.6, 1.2, 2.2]]) pine.add('m', M.CONE(8), '#24502e', [0, y, 0], [0, 0, 0], [r, h, r]);
      dead.add('m', M.CYL(6, 0.5), '#3a3230', [0, 2.2, 0], [0, 0, 0.05], [0.3, 4.4, 0.3]);
      for (const [a, y, l, up] of [[0.3, 2.8, 2.2, 0.7], [2.2, 3.4, 1.9, 0.9], [4.0, 2.4, 2.0, 0.5], [5.3, 3.9, 1.5, 1.0], [1.2, 4.2, 1.3, 1.2]]) dead.rod('m', [0, y, 0], [Math.cos(a) * l, y + l * up, Math.sin(a) * l], 0.1, '#3a3230', 5, 0.03);
      const kits = [oak, pine, dead], m4 = new T.Matrix4(), q = new T.Quaternion(), c = new T.Color();
      for (let kind = 0; kind < 3; kind++) {
        const list = all.filter(t => t.kind === kind); if (!list.length) continue;
        const mat = kind === 0 ? new T.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, flatShading: true }) : M.MAT.matte;
        const im = new T.InstancedMesh(kits[kind].geometry('m'), mat, list.length);
        list.forEach((t, i) => {
          q.setFromEuler(new T.Euler(0, (t.x * 7.1 + t.z * 3.3) % 6.28, 0));
          m4.compose(new T.Vector3(t.x, this.height(t.x, t.z) - 0.2, t.z), q, new T.Vector3(t.s, t.s * (0.9 + ((t.x * 13) % 1 + 1) % 1 * 0.3), t.s)); im.setMatrixAt(i, m4);
          c.setHSL(0, 0, 0.8 + ((t.z * 17.3) % 1 + 1) % 1 * 0.35); im.setColorAt(i, c);
        });
        im.castShadow = sh; im.receiveShadow = true; this.scene.add(im);
      }
    }

    // ------------------------------------------------------------ night life
    buildFireflies(R) {
      if (!this.theme.night) return;
      const n = 160, p = new Float32Array(n * 3), base = [];
      for (let i = 0; i < n; i++) { const x = R.range(-this.H, this.H), z = R.range(-this.H, this.H); base.push([x, this.height(x, z) + R.range(0.5, 2.5), z, R() * 10]); }
      const g = new T.BufferGeometry(); g.setAttribute('position', new T.BufferAttribute(p, 3));
      const mat = new T.PointsMaterial({ color: 0xd8ff6a, size: 0.25, transparent: true, opacity: 0.9, blending: T.AdditiveBlending, depthWrite: false });
      const pts = new T.Points(g, mat); pts.frustumCulled = false; this.scene.add(pts);
      this.anim.push(t => {
        for (let i = 0; i < n; i++) { const b = base[i]; p[i * 3] = b[0] + Math.sin(t * 0.3 + b[3]) * 2; p[i * 3 + 1] = b[1] + Math.sin(t * 0.7 + b[3] * 2) * 0.5; p[i * 3 + 2] = b[2] + Math.cos(t * 0.25 + b[3]) * 2; }
        g.attributes.position.needsUpdate = true; mat.opacity = 0.6 + 0.4 * Math.sin(t * 2.3);
      });
    }
    buildHalloween(R) {
      const sh = !!this.q.shadows, H = this.H;
      // smashable pumpkins
      const pk = new M.Kit();
      for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; pk.add('m', M.SPH(10, 8), '#ffffff', [Math.cos(a) * 0.22, 0.38, Math.sin(a) * 0.22], [0, -a, 0], [0.3, 0.38, 0.2]); }
      pk.add('m', M.CYL(5, 0.6), '#3c5a1a', [0, 0.8, 0], [0.2, 0, 0.1], [0.06, 0.22, 0.06]);
      const pg = pk.geometry('m');
      const cols = pg.attributes.color; for (let i = 0; i < cols.count; i++) if (cols.getX(i) > 0.9) cols.setXYZ(i, 1, 1, 1);
      const im = this.pumpkinMesh = new T.InstancedMesh(pg, M.paint(0.6, 0), this.pumpkins.length);
      const m4 = new T.Matrix4(), q = new T.Quaternion(), c = new T.Color();
      this.pumpkins.forEach((p, i) => {
        p.y = this.height(p.x, p.z) - 0.05; p.i = i; p.r = 0.55 * p.s;
        q.setFromEuler(new T.Euler(0, p.a, 0)); m4.compose(new T.Vector3(p.x, p.y, p.z), q, new T.Vector3(p.s, p.s * 0.9, p.s)); im.setMatrixAt(i, m4);
        c.setHSL(0.06 + p.c * 0.03, 0.9, 0.42 + p.c * 0.1); im.setColorAt(i, c);
      });
      im.castShadow = sh; im.receiveShadow = true; this.scene.add(im);
      // jack-o'-lanterns: by the gate, the barn door and the porch (glowing faces, a few flickering lights)
      const face = M.jackFace(), jk = new M.Kit(), spots = [];
      const g = this.gate, b = this.barn, h = this.house;
      for (const s of [-1, 1]) spots.push([g.x + s * (g.w / 2 + 1.2), g.z + 1.2, 0]);
      spots.push([b.x - 3.2, b.z - 12.6, Math.PI], [b.x + 3.2, b.z - 12.6, Math.PI], [h.x - 2.2, h.z - 7.2, Math.PI], [h.x + 2.2, h.z - 7.2, Math.PI]);
      for (let i = 0; i < 6; i++) { const t = this.tractorSpots[i % this.tractorSpots.length]; if (t) spots.push([t.x + 3.5, t.z + 2, R() * 6]); }
      const fm = new T.MeshBasicMaterial({ map: face, transparent: true, toneMapped: false, depthWrite: false });
      spots.forEach(([x, z, a], i) => {
        const y = this.height(x, z) - 0.05, s = 1.25;
        for (let j = 0; j < 8; j++) { const aa = j / 8 * Math.PI * 2; jk.add('m', M.SPH(10, 8), '#e8661a', [x + Math.cos(aa) * 0.22 * s, y + 0.38 * s, z + Math.sin(aa) * 0.22 * s], [0, -aa, 0], [0.3 * s, 0.38 * s, 0.2 * s]); }
        jk.add('m', M.CYL(5, 0.6), '#3c5a1a', [x, y + 0.8 * s, z], [0.2, 0, 0.1], [0.06 * s, 0.22 * s, 0.06 * s]);
        // the face looks back towards the gate side of the farm
        const fp = new T.Mesh(new T.PlaneGeometry(0.62 * s, 0.46 * s), fm);
        fp.position.set(x + Math.sin(a) * 0.54 * s, y + 0.4 * s, z + Math.cos(a) * 0.54 * s); fp.rotation.y = a;
        this.scene.add(fp);
        this.circles.push({ x, z, r: 0.5, kind: 'jack' });
        if (i < 3 || i === 4) this.pointLight(0xff8a2a, 26, 13, x, y + 0.9, z - 0.5, true);
      });
      this.scene.add(jk.build({ m: M.paint(0.6, 0) }, sh));
      // graveyard beside the farmhouse
      const gk = new M.Kit(), gx = h.x + (h.x > 0 ? -18 : 18), gz = h.z - 4;
      for (let i = 0; i < 4; i++) for (let j = 0; j < 3; j++) {
        const x = gx + (i - 1.5) * 2.6 + R.range(-0.3, 0.3), z = gz + (j - 1) * 2.8, y = this.height(x, z), tilt = R.range(-0.15, 0.15);
        if ((i + j) % 2) { gk.add('m', M.BOX(), '#6a6a72', [x, y + 0.55, z], [tilt, 0, tilt * 0.5], [0.8, 1.1, 0.2]); gk.add('m', M.CYL(12), '#6a6a72', [x, y + 1.1, z], [Math.PI / 2 + tilt, 0, 0], [0.4, 0.2, 0.4]); }
        else { gk.add('m', M.BOX(), '#5a5a62', [x, y + 0.75, z], [tilt, 0, 0], [0.16, 1.5, 0.16]); gk.add('m', M.BOX(), '#5a5a62', [x, y + 1.05, z], [tilt, 0, 0], [0.8, 0.16, 0.16]); }
        gk.add('m', M.BOX(), '#2e2a20', [x, y + 0.03, z + 1.1], [0, 0, 0], [0.9, 0.08, 1.7]);
        this.circles.push({ x, z, r: 0.55, kind: 'grave' });
      }
      for (let i = -3; i <= 3; i++) for (const s of [-1, 1]) gk.add('m', M.BOX(), '#1d1d22', [gx + i * 1.7, this.height(gx + i * 1.7, gz + s * 5) + 0.6, gz + s * 5], [0, 0, 0], [0.06, 1.2, 0.06]);
      this.keep.push({ x: gx, z: gz, r: 8 });
      // scarecrows in the corn
      const scare = [];
      for (const f of this.fields) scare.push([f.x, f.z]);
      for (let i = 0; i < 3; i++) { const t = this.tractorSpots[(i * 3 + 1) % this.tractorSpots.length]; if (t) scare.push([t.x - 4, t.z + 4]); }
      for (const [x, z] of scare) {
        const y = this.height(x, z);
        gk.add('m', M.BOX(), '#5a4030', [x, y + 1.5, z], [0, 0, 0], [0.12, 3, 0.12]);
        gk.add('m', M.BOX(), '#5a4030', [x, y + 2.3, z], [0, 0, 0], [2, 0.1, 0.1]);
        gk.add('m', M.BOX(), '#6a3a6a', [x, y + 2.0, z], [0, 0, 0], [0.9, 1.0, 0.35]);
        gk.add('m', M.SPH(10, 8), '#d8a040', [x, y + 2.85, z], [0, 0, 0], [0.3, 0.32, 0.3]);
        gk.add('m', M.CYL(12), '#2a1a10', [x, y + 3.12, z], [0, 0, 0], [0.5, 0.04, 0.5]);
        gk.add('m', M.CONE(10), '#2a1a10', [x, y + 3.45, z], [0.1, 0, 0.12], [0.28, 0.65, 0.28]);
        this.circles.push({ x, z, r: 0.35, kind: 'scarecrow' });
      }
      this.scene.add(gk.build({}, sh));
      // bats circling the moon side of the farm and the barn roof
      const bk = new M.Kit();
      bk.add('m', M.SPH(6, 4), '#111', [0, 0, 0], [0, 0, 0], [0.12, 0.1, 0.22]);
      bk.add('m', M.CONE(3), '#111', [0.36, 0.05, 0], [0, 0, -1.4], [0.18, 0.6, 0.02]);
      bk.add('m', M.CONE(3), '#111', [-0.36, 0.05, 0], [0, 0, 1.4], [0.18, 0.6, 0.02]);
      const nb = 26, bats = new T.InstancedMesh(bk.geometry('m'), M.MAT.matte, nb), bd = [];
      for (let i = 0; i < nb; i++) bd.push({ cx: i < 12 ? b.x : R.range(-H, H) * 0.6, cz: i < 12 ? b.z : R.range(-H, H) * 0.6, r: R.range(6, 22), y: R.range(10, 22), sp: R.range(0.5, 1.1) * (R() < 0.5 ? 1 : -1), ph: R() * 6.28, s: R.range(1.4, 2.4) });
      bats.frustumCulled = false; this.scene.add(bats);
      this.anim.push(t => {
        for (let i = 0; i < nb; i++) {
          const o = bd[i], a = o.ph + t * o.sp, f = Math.sin(t * 14 + o.ph * 3);
          m4.compose(new T.Vector3(o.cx + Math.cos(a) * o.r, o.y + Math.sin(t * 1.3 + o.ph) * 1.5, o.cz + Math.sin(a) * o.r), q.setFromEuler(new T.Euler(0, -a + (o.sp > 0 ? 0 : Math.PI), 0)), new T.Vector3(o.s, o.s * f, o.s));
          bats.setMatrixAt(i, m4);
        }
        bats.instanceMatrix.needsUpdate = true;
      });
      // low glowing mist puffs drifting over the fields
      const mist = M.canvasTex(128, 128, (cx, w) => { const gr = cx.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2); gr.addColorStop(0, 'rgba(170,140,220,0.35)'); gr.addColorStop(1, 'rgba(170,140,220,0)'); cx.fillStyle = gr; cx.fillRect(0, 0, w, w); });
      const mm = new T.SpriteMaterial({ map: mist, transparent: true, depthWrite: false, fog: true });
      const sprites = [];
      for (let i = 0; i < 26; i++) { const sp = new T.Sprite(mm); const x = R.range(-H, H), z = R.range(-H, H); sp.position.set(x, this.height(x, z) + 1.2, z); sp.scale.set(18, 5, 1); this.scene.add(sp); sprites.push([sp, x, z, R() * 6]); }
      this.anim.push(t => { for (const [sp, x, z, ph] of sprites) { sp.position.x = x + Math.sin(t * 0.08 + ph) * 8; sp.position.z = z + Math.cos(t * 0.06 + ph) * 8; } });
    }
    smashPumpkin(p) {
      if (!p.alive) return;
      p.alive = false;
      this.pumpkinMesh.setMatrixAt(p.i, new T.Matrix4().makeScale(0, 0, 0));
      this.pumpkinMesh.instanceMatrix.needsUpdate = true;
    }

    update(t, dt) {
      for (const f of this.anim) f(t, dt);
      if (this.water) this.water.material.roughness = 0.05 + 0.03 * Math.sin(t);
    }
    dispose() {
      this.scene.traverse(o => {
        if (o.geometry && !o.geometry.userData.shared) o.geometry.dispose();
        if (o.material) for (const m of [].concat(o.material)) { if (m.map) m.map.dispose(); m.dispose(); }
      });
      if (this.envRT) this.envRT.dispose();
    }
  }
  function box(x, z, hw, hd, a, kind) { return { x, z, hw, hd, a, c: Math.cos(a), s: Math.sin(a), kind }; }

  TT.World = World;
})();
