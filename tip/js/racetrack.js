// Tractor Tippin': race tracks. A closed loop of road through the track's points, the ground around it,
// walls or soft verges, a start line and the scenery for each style: 'desert' (a dirt loop round a red rock
// butte), 'stadium' (a floodlit oval with grandstands) and 'country' (farm roads past the corn at night).
// It answers the same questions as the farm (height, surface, collide...) so the cars drive on it unchanged.
(() => {
  'use strict';
  const TT = window.TT, { clamp, lerp, smooth, wrapAngle } = TT.math, { fbm2 } = TT.noise;
  let T, M;

  class RaceWorld {
    constructor(level, renderer, quality) {
      T = window.THREE; M = TT.models;
      this.level = level; this.theme = TT.THEMES[level.theme]; this.q = quality; this.seed = level.seed; this.race = true;
      this.scene = new T.Scene(); this.anim = []; this.lamps = [];
      // what the farm has that a track doesn't
      Object.assign(this, { circles: [], boxes: [], fields: [], muds: [], tracks: [], bales: [], pumpkins: [], tractorSpots: [], pond: null, gateOpen: false, flats: [] });
      this.W = level.width; this.walls = !!level.walls;
      this.buildTrack();
      this.gate = { x: 1e5, z: 1e5, w: 1 }; this.home = { x: 1e5, z: 1e5, a: 0 }; this.silo = { x: 1e5, z: 1e5, r: 1 };
      this.makeGrid([0, 1, 2, 3, 4, 5, 6, 7]);
      this.buildSky(renderer);
      this.buildLights();
      this.buildGround();
      this.buildRoad();
      const R = TT.rng(level.seed);
      if (level.style === 'desert') this.dressDesert(R);
      else if (level.style === 'stadium') this.dressStadium(R);
      else this.dressCountry(R);
    }

    // ------------------------------------------------------------ the centre line
    buildTrack() {
      const curve = new T.CatmullRomCurve3(this.level.pts.map(([x, z]) => new T.Vector3(x, 0, z)), true, 'centripetal');
      const L = curve.getLength(), N = Math.max(200, Math.round(L / 2));
      const pts = curve.getSpacedPoints(N);
      const xs = new Float32Array(N), zs = new Float32Array(N), hs = new Float32Array(N);
      for (let i = 0; i < N; i++) { xs[i] = pts[i].x; zs[i] = pts[i].z; }
      for (let i = 0; i < N; i++) { const j = (i + 1) % N, k = (i - 1 + N) % N; hs[i] = Math.atan2(xs[j] - xs[k], zs[j] - zs[k]); }
      this.track = { N, xs, zs, hs, L, ds: L / N };
      let ext = 0; for (let i = 0; i < N; i++) ext = Math.max(ext, Math.abs(xs[i]), Math.abs(zs[i]));
      this.H = ext + this.W + 20;
      // a coarse grid of "nearest centre-line sample" so lookups are quick
      const G = this.grid = { cell: 6, n: Math.ceil((this.H + 160) * 2 / 6), o: this.H + 160 };
      G.idx = new Int16Array(G.n * G.n);
      for (let gj = 0; gj < G.n; gj++) for (let gi = 0; gi < G.n; gi++) {
        const x = gi * G.cell - G.o, z = gj * G.cell - G.o; let best = 0, bd = 1e12;
        for (let i = 0; i < N; i += 2) { const d = (xs[i] - x) ** 2 + (zs[i] - z) ** 2; if (d < bd) { bd = d; best = i; } }
        G.idx[gj * G.n + gi] = best;
      }
      // which side is inside the loop (+1: left)
      let cx = 0, cz = 0; for (let i = 0; i < N; i++) { cx += xs[i]; cz += zs[i]; }
      this.inSide = Math.sign(this.nearest(cx / N, cz / N).lat) || 1;
    }
    // nearest point on the centre line: { i, s (distance along), lat (left of the line is +), d }
    nearest(x, z, hint) {
      const T2 = this.track, N = T2.N;
      let i0;
      if (hint !== undefined && hint >= 0) i0 = hint;
      else { const G = this.grid, gi = clamp(Math.round((x + G.o) / G.cell), 0, G.n - 1), gj = clamp(Math.round((z + G.o) / G.cell), 0, G.n - 1); i0 = G.idx[gj * G.n + gi]; }
      let best = i0, bd = 1e12;
      for (let k = -14; k <= 14; k++) { const i = (i0 + k + N) % N, d = (T2.xs[i] - x) ** 2 + (T2.zs[i] - z) ** 2; if (d < bd) { bd = d; best = i; } }
      const a = T2.hs[best], dx = x - T2.xs[best], dz = z - T2.zs[best];
      const along = dx * Math.sin(a) + dz * Math.cos(a), lat = dx * Math.cos(a) - dz * Math.sin(a);
      let s = best * T2.ds + along; s = ((s % T2.L) + T2.L) % T2.L;
      return { i: best, s, lat, d: Math.abs(lat) };
    }
    // a point on the track at distance s along it and lat to the left
    at(s, lat = 0, out = {}) {
      const T2 = this.track, f = (((s % T2.L) + T2.L) % T2.L) / T2.ds, i = Math.floor(f) % T2.N, j = (i + 1) % T2.N, t = f - Math.floor(f);
      const x = lerp(T2.xs[i], T2.xs[j], t), z = lerp(T2.zs[i], T2.zs[j], t), a = T2.hs[i] + wrapAngle(T2.hs[j] - T2.hs[i]) * t;
      out.x = x + Math.cos(a) * lat; out.z = z - Math.sin(a) * lat; out.a = a;
      return out;
    }
    headingAt(s) { return this.at(s, 0, {}).a; }
    // starting grid: order = the slots from the front row back
    makeGrid(order) {
      this.spawn = [];
      order.forEach((slot, k) => { const row = Math.floor(k / 2), p = this.at(-10 - row * 8, (k % 2 ? -1 : 1) * this.W * 0.22); this.spawn[slot] = { x: p.x, z: p.z, a: p.a }; });
      for (let i = 0; i < 8; i++) if (!this.spawn[i]) { const p = this.at(-60 - i * 8, 0); this.spawn[i] = { x: p.x, z: p.z, a: p.a }; }
    }

    // ------------------------------------------------------------ what the cars ask
    rawHeight(x, z) { return fbm2(x * 0.01, z * 0.01, this.seed, 3) * 2.5; }
    height(x, z) {
      const n = this.nearest(x, z), edge = this.W / 2 + (this.level.style === 'stadium' ? 40 : 10);
      if (n.d < edge) return 0;
      const hill = this.level.style === 'stadium' ? 0 : this.rawHeight(x, z) * smooth(clamp((n.d - edge) / 25, 0, 1)) + smooth(clamp((n.d - edge - 30) / 120, 0, 1)) * (this.level.style === 'desert' ? 10 : 6);
      return hill;
    }
    // 0 road, 4 off the road (dirt or grass: slower and slidier)
    surface(x, z) { return this.nearest(x, z).d < this.W / 2 + 0.6 ? 0 : 4; }
    collide(o, r) {
      let hit = 0;
      for (const c of this.circles) {
        const dx = o.x - c.x, dz = o.z - c.z, d = Math.hypot(dx, dz), m = c.r + r;
        if (d < m && d > 1e-4) { o.x = c.x + dx / d * m; o.z = c.z + dz / d * m; hit = Math.max(hit, m - d); o.nx = dx / d; o.nz = dz / d; }
      }
      return hit;
    }
    // walls (the oval) or a hard limit well out past the verge; called instead of the farm fence
    bounds(car) {
      const n = this.nearest(car.x, car.z, car.race ? car.race.i : undefined), lim = (this.walls ? this.W / 2 : this.W / 2 + 26) - car.spec.radius;
      if (car.race) car.race.i = n.i;
      if (n.d <= lim) return;
      const a = this.track.hs[n.i], lx = Math.cos(a), lz = -Math.sin(a), sg = Math.sign(n.lat), push = n.d - lim;
      car.x -= lx * sg * push; car.z -= lz * sg * push;
      const vl = (car.vx * lx + car.vz * lz) * sg;
      if (vl > 0) { car.vx -= lx * sg * vl * 1.4; car.vz -= lz * sg * vl * 1.4; if (vl > 5 && car.bumpT <= 0) { car.bumpT = 0.4; car.game.emit('bump', { p: car, hard: clamp(vl / 15, 0, 1) }); } }
    }
    clearLine() { return 1; }
    setGateOpen() { }
    mow() { return 0; }
    smashBale() { }
    smashPumpkin() { }

    // ------------------------------------------------------------ ground and road
    buildGround() {
      const st = this.level.style, size = 2 * (this.H + 150), cell = { high: 2.5, medium: 3, low: 4 }[this.q.name] || 3, n = Math.round(size / cell);
      const g = new T.PlaneGeometry(size, size, n, n); g.rotateX(-Math.PI / 2);
      const pos = g.attributes.position, cols = new Float32Array(pos.count * 3), c = new T.Color();
      const A = new T.Color(this.theme.grass[0]), B = new T.Color(this.theme.grass[1]), apron = new T.Color(st === 'stadium' ? '#3a3a3e' : st === 'desert' ? '#a8754a' : '#5a4632'), rock = new T.Color('#9a5a3a');
      for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i), z = pos.getZ(i), nn = this.nearest(x, z), h = this.height(x, z);
        pos.setY(i, h);
        c.copy(A).lerp(B, fbm2(x * 0.04, z * 0.04, this.seed + 3, 2) * 0.5 + 0.5).multiplyScalar(0.88 + fbm2(x * 0.3, z * 0.3, 7, 1) * 0.1);
        if (st === 'desert' && h > 3) c.lerp(rock, clamp((h - 3) / 6, 0, 0.8));
        const e = nn.d - this.W / 2;
        if (e < (st === 'stadium' ? 6 : 3)) c.lerp(apron, smooth(clamp(1 - e / (st === 'stadium' ? 6 : 3), 0, 1)) * 0.8);
        if (st === 'country' && e > 4 && e < 40 && fbm2(x * 0.015, z * 0.015, this.seed + 9, 2) > 0.1) c.lerp(new T.Color('#4a3524'), 0.6); // ploughed fields
        cols[i * 3] = c.r; cols[i * 3 + 1] = c.g; cols[i * 3 + 2] = c.b;
      }
      g.setAttribute('color', new T.BufferAttribute(cols, 3)); g.computeVertexNormals();
      const detail = M.canvasTex(128, 128, (cx, w, h) => { const R = TT.rng(5); cx.fillStyle = '#d8d8d8'; cx.fillRect(0, 0, w, h); for (let i = 0; i < 1600; i++) { const v = R.int(150, 255); cx.fillStyle = `rgb(${v},${v},${v})`; cx.fillRect(R() * w, R() * h, R.range(1, 2.5), R.range(1, 4)); } }, true);
      detail.repeat.set(size / 7, size / 7);
      const mesh = new T.Mesh(g, new T.MeshStandardMaterial({ vertexColors: true, map: detail, roughness: 0.95 }));
      mesh.receiveShadow = true; this.scene.add(mesh);
    }
    buildRoad() {
      const T2 = this.track, N = T2.N, W = this.W, st = this.level.style;
      const tex = M.canvasTex(256, 256, (g, w, h) => {
        const R = TT.rng(11), base = st === 'desert' ? '#b8855a' : '#3a3a3e';
        g.fillStyle = base; g.fillRect(0, 0, w, h);
        for (let i = 0; i < 3000; i++) { const v = R.range(-25, 25); g.fillStyle = `rgba(${v > 0 ? 255 : 0},${v > 0 ? 255 : 0},${v > 0 ? 255 : 0},${Math.abs(v) / 400})`; g.fillRect(R() * w, R() * h, 2, 2); }
        if (st === 'desert') { g.fillStyle = 'rgba(90,55,30,0.35)'; for (const x of [70, 90, 166, 186]) g.fillRect(x, 0, 8, h); }
        else {
          g.fillStyle = '#f2f2f2'; g.fillRect(4, 0, 8, h); g.fillRect(w - 12, 0, 8, h);
          if (st === 'country') { g.fillStyle = '#f2c230'; g.fillRect(w / 2 - 4, 0, 8, h * 0.55); }
        }
      }, true);
      const p = [], uv = [], idx = [];
      for (let i = 0; i <= N; i++) {
        const k = i % N, a = T2.hs[k], lx = Math.cos(a), lz = -Math.sin(a);
        for (const sg of [1, -1]) { const x = T2.xs[k] + lx * sg * W / 2, z = T2.zs[k] + lz * sg * W / 2; p.push(x, 0.04, z); uv.push(sg > 0 ? 0 : 1, i * T2.ds / W); }
        if (i < N) { const b = i * 2; idx.push(b, b + 1, b + 2, b + 1, b + 3, b + 2); }
      }
      const g = new T.BufferGeometry();
      g.setAttribute('position', new T.Float32BufferAttribute(p, 3)); g.setAttribute('uv', new T.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals();
      const road = new T.Mesh(g, new T.MeshStandardMaterial({ map: tex, roughness: st === 'desert' ? 0.95 : 0.8 }));
      road.receiveShadow = true; this.scene.add(road);
      // chequered start line and a gantry over it
      const s0 = this.at(0, 0, {});
      const chk = M.canvasTex(256, 32, (cx, w, h) => { for (let i = 0; i < 16; i++) for (let j = 0; j < 2; j++) { cx.fillStyle = (i + j) % 2 ? '#111' : '#f4f4f4'; cx.fillRect(i * 16, j * 16, 16, 16); } });
      const line = new T.Mesh(new T.PlaneGeometry(W, 2), new T.MeshStandardMaterial({ map: chk, roughness: 0.7, polygonOffset: true, polygonOffsetFactor: -2 }));
      line.rotation.set(-Math.PI / 2, s0.a, 0, 'YXZ'); // flat, stretched across the road
      line.position.set(s0.x, 0.06, s0.z); this.scene.add(line);
      const k = new M.Kit(), lx = Math.cos(s0.a), lz = -Math.sin(s0.a);
      for (const sg of [-1, 1]) k.add('metal', M.BOX(), '#d8d8d8', [s0.x + lx * sg * (W / 2 + 1), 3.5, s0.z + lz * sg * (W / 2 + 1)], [0, s0.a, 0], [0.5, 7, 0.5]);
      k.add('paint', M.BOX(), '#c41a1a', [s0.x, 7, s0.z], [0, s0.a, 0], [W + 3, 1.6, 0.6]);
      this.scene.add(k.build({ paint: M.paint(0.5, 0.1) }, !!this.q.shadows));
      for (const sg of [-1, 1]) {
        const ban = M.decalMesh(M.textDecal(this.level.name.toUpperCase(), '#ffffff', '#c41a1a', 512, 64, 'bold 44px Impact, Arial Black, sans-serif'), W + 2.5, 1.3, { transparent: false, depthWrite: true });
        ban.position.set(s0.x - Math.sin(s0.a) * 0.32 * sg, 7, s0.z - Math.cos(s0.a) * 0.32 * sg); ban.rotation.y = s0.a + (sg > 0 ? Math.PI : 0); this.scene.add(ban);
      }
      for (const sg of [-1, 1]) this.circles.push({ x: s0.x + lx * sg * (W / 2 + 1), z: s0.z + lz * sg * (W / 2 + 1), r: 0.5, kind: 'post' });
      // walls along both sides (the oval)
      if (this.walls) for (const sg of [1, -1]) {
        const wp = [], wi = [];
        for (let i = 0; i <= N; i++) {
          const kk = i % N, a = T2.hs[kk], x = T2.xs[kk] + Math.cos(a) * sg * (W / 2 + 0.3), z = T2.zs[kk] - Math.sin(a) * sg * (W / 2 + 0.3);
          wp.push(x, 0, z, x, 1.3, z);
          if (i < N) { const b = i * 2; wi.push(b, b + 2, b + 1, b + 1, b + 2, b + 3); }
        }
        const wg = new T.BufferGeometry(); wg.setAttribute('position', new T.Float32BufferAttribute(wp, 3)); wg.setIndex(wi); wg.computeVertexNormals();
        const wtex = M.canvasTex(64, 64, cx => { cx.fillStyle = '#e8e8e8'; cx.fillRect(0, 0, 64, 64); cx.fillStyle = '#c41a1a'; cx.fillRect(0, 40, 64, 12); }, true);
        const uvs = []; for (let i = 0; i <= N; i++) uvs.push(i * T2.ds / 4, 0, i * T2.ds / 4, 1);
        wg.setAttribute('uv', new T.Float32BufferAttribute(uvs, 2));
        const wm = new T.Mesh(wg, new T.MeshStandardMaterial({ map: wtex, roughness: 0.7, side: T.DoubleSide })); wm.receiveShadow = true; this.scene.add(wm);
      }
    }
    // a point well off the track for scenery: lat beyond the verge, not on top of any other bit of track
    offTrack(R, minOff, maxOff, side) {
      for (let k = 0; k < 40; k++) {
        const s = R() * this.track.L, sg = side || (R() < 0.5 ? -1 : 1), lat = sg * (this.W / 2 + R.range(minOff, maxOff)), p = this.at(s, lat, {});
        if (this.nearest(p.x, p.z).d > this.W / 2 + minOff - 0.5) return p;
      }
      return null;
    }
    instanced(geo, mat, list, shadows = true) {
      if (!list.length) return null;
      const im = new T.InstancedMesh(geo, mat, list.length), m4 = new T.Matrix4(), q = new T.Quaternion(), c = new T.Color();
      list.forEach((o, i) => { q.setFromEuler(new T.Euler(0, o.a || 0, 0)); m4.compose(new T.Vector3(o.x, o.y !== undefined ? o.y : this.height(o.x, o.z), o.z), q, new T.Vector3(o.sx || o.s || 1, o.sy || o.s || 1, o.sz || o.s || 1)); im.setMatrixAt(i, m4); if (o.c) im.setColorAt(i, c.set(o.c)); });
      im.castShadow = shadows && !!this.q.shadows; im.receiveShadow = true; this.scene.add(im);
      return im;
    }

    // ------------------------------------------------------------ dressing
    dressDesert(R) {
      // the big butte in the middle, and mesas all round
      const mk = new M.Kit(), mesas = [{ x: -15, z: -10, r: 28, h: 34 }];
      for (let i = 0; i < 14; i++) { const p = this.offTrack(R, 40, 140); if (p) mesas.push({ x: p.x, z: p.z, r: R.range(10, 26), h: R.range(14, 40) }); }
      for (const m of mesas) {
        if (this.nearest(m.x, m.z).d < m.r + this.W / 2 + 6) continue;
        const y = this.height(m.x, m.z) - 1;
        for (let k = 0; k < 4; k++) mk.add('m', M.CYL(14, 0.94), k % 2 ? '#b8603a' : '#a4502e', [m.x, y + m.h * (k + 0.5) / 4, m.z], [0, k, 0], [m.r * (1 - k * 0.06), m.h / 4, m.r * (1 - k * 0.06)]);
        mk.add('m', M.CYL(14), '#c8784a', [m.x, y + m.h, m.z], [0, 0, 0], [m.r * 0.78, 0.4, m.r * 0.78]);
        this.circles.push({ x: m.x, z: m.z, r: m.r, kind: 'rock' });
      }
      this.scene.add(mk.build({ m: new T.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, flatShading: true }) }, !!this.q.shadows));
      // cactus and rocks along the verges
      const ck = new M.Kit();
      ck.add('m', M.CYL(8, 0.85), '#3a7a3a', [0, 1.8, 0], [0, 0, 0], [0.35, 3.6, 0.35]);
      ck.add('m', M.CYL(8, 0.8), '#3a7a3a', [0.65, 2.0, 0], [0, 0, 0], [0.22, 1.4, 0.22]); ck.add('m', M.CYL(8), '#3a7a3a', [0.4, 1.4, 0], [0, 0, Math.PI / 2], [0.2, 0.6, 0.2]);
      ck.add('m', M.CYL(8, 0.8), '#3a7a3a', [-0.6, 2.6, 0], [0, 0, 0], [0.2, 1.2, 0.2]); ck.add('m', M.CYL(8), '#3a7a3a', [-0.35, 2.1, 0], [0, 0, Math.PI / 2], [0.18, 0.5, 0.18]);
      const cacti = [], rocks = [];
      for (let i = 0; i < 90; i++) { const p = this.offTrack(R, 4, 60); if (p) { cacti.push({ x: p.x, z: p.z, a: R() * 6, s: R.range(0.7, 1.3) }); if (this.nearest(p.x, p.z).d < this.W / 2 + 26) this.circles.push({ x: p.x, z: p.z, r: 0.5, kind: 'cactus' }); } }
      for (let i = 0; i < 70; i++) { const p = this.offTrack(R, 5, 90); if (p) rocks.push({ x: p.x, z: p.z, a: R() * 6, s: R.range(0.6, 2.2), c: R.pick(['#9a5a3a', '#b8704a', '#8a4a30']) }); }
      this.instanced(ck.geometry('m'), M.MAT.matte, cacti);
      const rg = M.geo('ico0', () => new T.IcosahedronGeometry(1, 0));
      this.instanced(rg, new T.MeshStandardMaterial({ roughness: 0.95, flatShading: true }), rocks);
      for (const r of rocks) if (r.s > 1.4 && this.nearest(r.x, r.z).d < this.W / 2 + 26) this.circles.push({ x: r.x, z: r.z, r: r.s * 0.9, kind: 'rock' });
      // tyre stacks on the outside of the bends
      this.tyres(R, 1);
    }
    tyres(R, side) {
      const T2 = this.track, list = [];
      for (let i = 0; i < T2.N; i += 4) {
        const bend = wrapAngle(T2.hs[(i + 6) % T2.N] - T2.hs[i]);
        if (Math.abs(bend) < 0.12) continue;
        const p = this.at(i * T2.ds, Math.sign(bend) < 0 ? (this.W / 2 + 3) : -(this.W / 2 + 3), {}); // outside of the bend
        list.push({ x: p.x, z: p.z, a: p.a, c: list.length % 2 ? '#e8e8e8' : '#c41a1a' });
        this.circles.push({ x: p.x, z: p.z, r: 0.9, kind: 'tyres' });
      }
      const tk = new M.Kit(); for (let j = 0; j < 3; j++) tk.add('m', M.TORUS(Math.PI * 2, 0.45), '#ffffff', [0, 0.25 + j * 0.42, 0], [Math.PI / 2, 0, 0], 0.55);
      this.instanced(tk.geometry('m'), M.MAT.matte, list);
    }
    dressStadium(R) {
      const T2 = this.track, out = -this.inSide, stands = [], crowd = [], cols = ['#e8433a', '#f2c230', '#3a8ae8', '#f4f4f4', '#3ac85a', '#ff7ad9', '#7a4ae8'];
      for (let i = 0; i < T2.N; i += 2) {
        const s = i * T2.ds;
        for (let tier = 0; tier < 5; tier++) {
          const p = this.at(s, out * (this.W / 2 + 6 + tier * 2.6), {});
          stands.push({ x: p.x, z: p.z, y: 0.6 + tier * 1.3, a: p.a, sx: 2.6, sy: 1.2 + tier * 2.6, sz: T2.ds * 2 + 0.2, c: tier % 2 ? '#5a5a66' : '#6a6a78' });
          if (R() < 0.85) for (const k of [-0.6, 0.6]) { const q = this.at(s + k * T2.ds, out * (this.W / 2 + 6 + tier * 2.6), {}); crowd.push({ x: q.x, z: q.z, y: 1.3 + tier * 2.6 + 0.35, a: q.a, sx: 0.55, sy: 0.7, sz: 0.55, c: R.pick(cols) }); }
        }
      }
      // stands as instanced boxes; y given is the box centre so offset by half height
      for (const s of stands) s.y = s.sy / 2;
      this.instanced(M.BOX(), new T.MeshStandardMaterial({ roughness: 0.8 }), stands);
      this.instanced(M.BOX(), new T.MeshStandardMaterial({ roughness: 0.8 }), crowd, false);
      // floodlight towers with glowing heads
      const fk = new M.Kit();
      for (let i = 0; i < 8; i++) {
        const p = this.at(i / 8 * T2.L, out * (this.W / 2 + 22), {}), y = 26;
        fk.rod('metal', [p.x, 0, p.z], [p.x, y, p.z], 0.45, '#888', 8);
        fk.add('metal', M.BOX(), '#666', [p.x, y + 1, p.z], [0, p.a, 0], [5, 2.4, 0.6]);
        fk.add('glow', M.BOX(), '#fffbe8', [p.x - Math.sin(p.a + Math.PI / 2 * out) * 0.35, y + 1, p.z - Math.cos(p.a + Math.PI / 2 * out) * 0.35], [0, p.a, 0], [4.6, 2.0, 0.1]);
      }
      this.scene.add(fk.build({}, false));
      // infield grass is the ground colour; add a few banners on the inside wall
      for (let i = 0; i < 6; i++) {
        const p = this.at((i + 0.5) / 6 * T2.L, this.inSide * (this.W / 2 + 0.5), {});
        const b = M.decalMesh(M.textDecal(['TIPPIN\' OIL', 'BIG MO HAULAGE', 'HAY THERE!', 'FARM FRESH', 'PISTON BOWL', 'MOO JUICE'][i], '#111', '#f2c230', 512, 64, 'bold 46px Impact, Arial Black, sans-serif'), 9, 1.1, { transparent: false, depthWrite: true });
        b.position.set(p.x, 0.7, p.z); b.rotation.y = p.a + (this.inSide > 0 ? -Math.PI / 2 : Math.PI / 2); this.scene.add(b);
      }
    }
    dressCountry(R) {
      // corn beside the road, barns, bales, trees, and a few sleeping tractors watching the race
      const k = new M.Kit();
      k.add('m', M.CYL(5, 0.5), '#5f8a2e', [0, 1.2, 0], [0, 0, 0], [0.045, 2.4, 0.045]);
      for (let i = 0; i < 4; i++) { const a = i * 2.4; k.add('m', M.CONE(4), i % 2 ? '#6c9a32' : '#4f7a26', [Math.cos(a) * 0.3, 0.6 + i * 0.4, Math.sin(a) * 0.3], [0, -a, 1.1], [0.08, 0.95, 0.015]); }
      k.add('m', M.CONE(5), '#d8c070', [0, 2.55, 0], [0, 0, 0], [0.09, 0.45, 0.09]);
      const corn = [], n = { high: 2600, medium: 1800, low: 1000 }[this.q.name] || 1800;
      for (let i = 0; i < n * 3 && corn.length < n; i++) {
        const p = this.offTrack(R, 5, 30); if (!p) continue;
        if (fbm2(p.x * 0.015, p.z * 0.015, this.seed + 9, 2) > 0.1) corn.push({ x: p.x + R.range(-0.5, 0.5), z: p.z + R.range(-0.5, 0.5), a: R() * 6, s: R.range(0.8, 1.15) });
      }
      this.instanced(k.geometry('m'), M.MAT.matte2, corn);
      const trees = [];
      const oak = new M.Kit();
      oak.add('m', M.CYL(7, 0.7), '#5a4030', [0, 1.6, 0], [0, 0, 0], [0.35, 3.2, 0.35]);
      for (const [x, y, z, r] of [[0, 4.6, 0, 2.4], [1.3, 4.1, 0.4, 1.7], [-1.2, 4.2, -0.5, 1.8], [0.2, 5.6, -0.6, 1.6]]) oak.add('m', M.geo('ico1', () => new T.IcosahedronGeometry(1, 1)), '#3d6a2a', [x, y, z], [0, 0, 0], r);
      for (let i = 0; i < 140; i++) { const p = this.offTrack(R, 8, 110); if (!p) continue; trees.push({ x: p.x, z: p.z, s: R.range(0.9, 1.5), a: R() * 6 }); if (this.nearest(p.x, p.z).d < this.W / 2 + 26) this.circles.push({ x: p.x, z: p.z, r: 0.9, kind: 'tree' }); }
      this.instanced(oak.geometry('m'), new T.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, flatShading: true }), trees);
      // barns with a lamp over the door
      const bk = new M.Kit();
      for (let i = 0; i < 5; i++) {
        const p = this.offTrack(R, 22, 50); if (!p) continue;
        const a = p.a + Math.PI / 2;
        bk.add('paint', M.BOX(), '#a8261f', [p.x, 3.2, p.z], [0, a, 0], [12, 6.4, 14]);
        bk.add('roof', M.profile([['M', -6.3, 6.3], ['L', 6.3, 6.3], ['L', 4.6, 8.8], ['L', 0, 10.2], ['L', -4.6, 8.8]], 14.6, 0.05, 1), '#3d3a3a', [p.x, 0, p.z], [0, a + Math.PI / 2, 0]);
        bk.add('glow', M.SPH(8, 6), '#ffd27a', [p.x + Math.sin(a) * 7.2, 5.6, p.z + Math.cos(a) * 7.2], [0, 0, 0], 0.25);
        this.circles.push({ x: p.x, z: p.z, r: 8.5, kind: 'barn' });
      }
      this.scene.add(bk.build({ paint: M.paint(0.75, 0.02), roof: M.paint(0.85, 0.05) }, !!this.q.shadows));
      // hay bales on the outside of the tight bends, and tractors asleep in the fields
      const bales = [], T2 = this.track;
      for (let i = 0; i < T2.N; i += 3) {
        const bend = wrapAngle(T2.hs[(i + 6) % T2.N] - T2.hs[i]); if (Math.abs(bend) < 0.15) continue;
        const p = this.at(i * T2.ds, Math.sign(bend) < 0 ? this.W / 2 + 2.5 : -(this.W / 2 + 2.5), {});
        bales.push({ x: p.x, z: p.z, y: this.height(p.x, p.z) + 0.85, a: p.a + Math.PI / 2 }); this.circles.push({ x: p.x, z: p.z, r: 1.0, kind: 'bale' });
      }
      const hb = new M.Kit(); hb.add('m', M.CYL(16), '#c9a24a', [0, 0, 0], [0, 0, Math.PI / 2], [0.9, 1.3, 0.9]);
      this.instanced(hb.geometry('m'), M.MAT.matte, bales);
      this.sleepers = [];
      for (let i = 0; i < 6; i++) {
        const p = this.offTrack(R, 9, 20); if (!p) continue;
        const rig = new M.TractorRig(i, { shadows: !!this.q.shadows });
        rig.root.position.set(p.x, this.height(p.x, p.z), p.z); rig.root.rotation.y = p.a + Math.PI / 2 * (R() < 0.5 ? 1 : -1);
        this.scene.add(rig.root); this.circles.push({ x: p.x, z: p.z, r: 1.8, kind: 'tractor' });
        const ph = R() * 6; this.anim.push(t => rig.pose(0, 0, Math.sin(t * 1.7 + ph) * 0.025, 0));
      }
    }

    update(t, dt) { for (const f of this.anim) f(t, dt); }
    dispose() {
      this.scene.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material) for (const m of [].concat(o.material)) { if (m.map) m.map.dispose(); m.dispose(); } });
      if (this.envRT) this.envRT.dispose();
    }
  }
  // the sky, moon, lights and per-view shadow follow come straight from the farm
  for (const k of ['buildSky', 'buildLights', 'frame', 'pointLight']) RaceWorld.prototype[k] = function () { return TT.World.prototype[k].apply(this, arguments); };

  TT.RaceWorld = RaceWorld;
})();
