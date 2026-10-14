// Road Rumble: procedural low-poly models. Bikes, riders, weapons and traffic are built from primitives and
// merged into a few meshes each (vertex colours), so a whole bike is a handful of draw calls.
// Local frames: forward is -Z, up +Y, right +X; a bike's origin is on the ground midway between the wheels.
(() => {
  'use strict';
  const RR = window.RR;
  let T; // THREE, bound in init()

  const cache = {};
  const geo = (key, make) => cache[key] || (cache[key] = (g => g.index ? g.toNonIndexed() : g)(make()));
  const BOX = () => geo('box', () => new T.BoxGeometry(1, 1, 1));
  const CYL = (seg = 12, top = 1) => geo('cyl' + seg + '_' + top, () => new T.CylinderGeometry(top, 1, 1, seg));
  const SPH = (w = 12, h = 8) => geo('sph' + w + '_' + h, () => new T.SphereGeometry(1, w, h));
  const ICO = (d = 0) => geo('ico' + d, () => new T.IcosahedronGeometry(1, d));
  const CONE = (seg = 8) => geo('cone' + seg, () => new T.ConeGeometry(1, 1, seg));
  const TORUS = () => geo('torus', () => new T.TorusGeometry(1, 0.32, 8, 22));

  // ---- merge builder ----
  class Merge {
    constructor(withUV) { this.p = []; this.n = []; this.c = []; this.uv = withUV ? [] : null; this._m = new T.Matrix4(); this._nm = new T.Matrix3(); this._v = new T.Vector3(); this._col = new T.Color(); }
    // add(geometry, colour, position[x,y,z], rotation[x,y,z], scale[x,y,z] or number)
    add(g, color, p = [0, 0, 0], r = [0, 0, 0], s = [1, 1, 1], jitter = 0) {
      const m = this._m;
      if (typeof s === 'number') s = [s, s, s];
      m.compose(new T.Vector3(p[0], p[1], p[2]), new T.Quaternion().setFromEuler(new T.Euler(r[0], r[1], r[2], 'YXZ')), new T.Vector3(s[0], s[1], s[2]));
      return this.addMatrix(g, color, m, jitter);
    }
    addMatrix(g, color, m, jitter = 0) {
      const pos = g.attributes.position, nor = g.attributes.normal, uv = g.attributes.uv, v = this._v;
      this._nm.getNormalMatrix(m);
      const col = this._col.set(color);
      if (jitter) { const f = 1 + (Math.random() - 0.5) * jitter; col.r *= f; col.g *= f; col.b *= f; }
      for (let i = 0; i < pos.count; i++) {
        v.fromBufferAttribute(pos, i).applyMatrix4(m); this.p.push(v.x, v.y, v.z);
        v.fromBufferAttribute(nor, i).applyMatrix3(this._nm).normalize(); this.n.push(v.x, v.y, v.z);
        this.c.push(col.r, col.g, col.b);
        if (this.uv) { if (uv) this.uv.push(uv.getX(i), uv.getY(i)); else this.uv.push(0, 0); }
      }
      return this;
    }
    // a tube between two points (cylinder oriented along a->b)
    rod(a, b, r, color, seg = 8, rTop) {
      const A = new T.Vector3(...a), B = new T.Vector3(...b), d = B.clone().sub(A), L = d.length();
      const q = new T.Quaternion().setFromUnitVectors(new T.Vector3(0, 1, 0), d.normalize());
      const m = new T.Matrix4().compose(A.clone().add(B).multiplyScalar(0.5), q, new T.Vector3(r, L, r));
      return this.addMatrix(CYL(seg, rTop === undefined ? 1 : rTop / r), color, m);
    }
    get empty() { return this.p.length === 0; }
    build() {
      const g = new T.BufferGeometry();
      g.setAttribute('position', new T.Float32BufferAttribute(this.p, 3));
      g.setAttribute('normal', new T.Float32BufferAttribute(this.n, 3));
      g.setAttribute('color', new T.Float32BufferAttribute(this.c, 3));
      if (this.uv) g.setAttribute('uv', new T.Float32BufferAttribute(this.uv, 2));
      g.computeBoundingSphere();
      return g;
    }
  }

  // ---- shared materials ----
  const MAT = {};
  function initMaterials() {
    const std = o => new T.MeshStandardMaterial(Object.assign({ vertexColors: true }, o));
    MAT.paint = std({ roughness: 0.28, metalness: 0.25 });
    MAT.chrome = std({ roughness: 0.18, metalness: 1.0 });
    MAT.matte = std({ roughness: 0.75, metalness: 0.05 });
    MAT.cloth = std({ roughness: 0.62, metalness: 0.0 });
    MAT.helmet = std({ roughness: 0.18, metalness: 0.15 });
    MAT.glow = new T.MeshBasicMaterial({ vertexColors: true, toneMapped: false });
    MAT.flat = std({ roughness: 0.9, metalness: 0, flatShading: true });
    MAT.glass = new T.MeshStandardMaterial({ color: 0x1a2430, roughness: 0.05, metalness: 0.6, transparent: true, opacity: 0.55 });
  }

  // ---- wheels ----
  function wheelGeo(r, w, style) {
    const m = new Merge();
    const tyre = 0x161616, rim = style === 'cruiser' || style === 'rat' ? 0xc8c8c8 : style === 'super' ? 0x222222 : 0x8a8a8a;
    m.add(TORUS(), tyre, [0, 0, 0], [0, Math.PI / 2, 0], [r - w * 0.5, r - w * 0.5, w * 1.6]);
    m.add(CYL(16), rim, [0, 0, 0], [0, 0, Math.PI / 2], [r * 0.7, w * 0.7, r * 0.7]);
    m.add(CYL(12), 0x9a9a9a, [0, 0, 0], [0, 0, Math.PI / 2], [r * 0.48, w * 0.95, r * 0.48]); // brake disc
    for (let i = 0; i < 5; i++) m.add(BOX(), rim, [0, 0, 0], [i * Math.PI * 2 / 5, 0, 0], [w * 0.45, r * 1.42, 0.03]);
    m.add(CYL(8), 0x333333, [0, 0, 0], [0, 0, Math.PI / 2], [0.05, w * 1.3, 0.05]);
    return m.build();
  }

  // ---- bikes ----
  const BIKE_GEOMS = {};
  function bikeGeoms(spec) {
    const key = spec.id;
    if (BIKE_GEOMS[key]) return BIKE_GEOMS[key];
    const st = spec.style, P = spec.paint, Tr = spec.trim;
    const paint = new Merge(), chrome = new Merge(), matte = new Merge(), glow = new Merge();
    const D = {
      rat: { wb: 1.38, wr: 0.32, tw: 0.11, seat: 0.84, grip: [0.36, 1.1, -0.4], peg: [0.2, 0.42, 0.22], tuck: 0.35 },
      sport: { wb: 1.4, wr: 0.3, tw: 0.1, seat: 0.86, grip: [0.31, 0.98, -0.42], peg: [0.2, 0.46, 0.24], tuck: 0.75 },
      cruiser: { wb: 1.62, wr: 0.33, tw: 0.13, seat: 0.74, grip: [0.42, 1.14, -0.36], peg: [0.26, 0.38, -0.25], tuck: 0.12 },
      super: { wb: 1.42, wr: 0.3, tw: 0.11, seat: 0.88, grip: [0.3, 0.97, -0.44], peg: [0.2, 0.5, 0.26], tuck: 0.85 },
      cop: { wb: 1.56, wr: 0.32, tw: 0.12, seat: 0.82, grip: [0.38, 1.1, -0.38], peg: [0.24, 0.42, 0.05], tuck: 0.25 },
    }[st];
    const { wb, wr } = D, fz = -wb / 2, rz = wb / 2;
    // fork, swingarm, frame
    const head = [0, st === 'cruiser' ? 1.02 : 1.0, fz + (st === 'cruiser' ? 0.32 : 0.16)];
    for (const sx of [-0.085, 0.085]) {
      chrome.rod([sx, wr, fz], [sx, head[1], head[2]], st === 'cruiser' ? 0.032 : 0.028, 0xd8d8d8);
      matte.rod([sx * 1.4, wr, rz], [sx * 1.4, wr + 0.12, 0.05], 0.035, 0x222222);
    }
    matte.rod([0, head[1] - 0.05, head[2]], [0, wr + 0.2, -0.05], 0.04, st === 'rat' ? 0x3a3a3a : 0x222222);
    matte.rod([0, head[1], head[2] + 0.05], [0, D.seat - 0.06, 0.25], 0.035, 0x262626);
    chrome.rod([0.1, wr + 0.15, rz - 0.25], [0.1, D.seat - 0.05, 0.28], 0.03, 0xe0b000); // shock
    // engine
    if (st === 'cruiser' || st === 'cop') {
      matte.add(BOX(), 0x2a2a2a, [0, wr + 0.16, 0.02], [0, 0, 0], [0.3, 0.3, 0.5]);
      for (const a of [-0.45, 0.45]) {
        chrome.add(CYL(10), 0xcfcfcf, [0, wr + 0.42, 0.02 + a * 0.28], [a, 0, 0], [0.11, 0.42, 0.11]);
        for (let f = 0; f < 4; f++) chrome.add(CYL(10), 0xbdbdbd, [0, wr + 0.3 + f * 0.07, 0.02 + a * (0.18 + f * 0.05)], [a, 0, 0], [0.135, 0.025, 0.135]);
      }
    } else {
      matte.add(BOX(), st === 'rat' ? 0x4a4440 : 0x2b2b2b, [0, wr + 0.14, 0], [0.15, 0, 0], [0.32, 0.34, 0.46]);
      for (let f = 0; f < 3; f++) chrome.add(BOX(), 0xa0a0a0, [0, wr + 0.34 + f * 0.05, -0.08], [0.2, 0, 0], [0.36, 0.025, 0.28]);
    }
    // tank, seat, tail
    const tankY = st === 'cruiser' ? 0.9 : D.seat + 0.08;
    paint.add(SPH(14, 10), P, [0, tankY, -0.12 - (st === 'cruiser' ? 0.15 : 0)], [0.08, 0, 0], [0.21, 0.15, st === 'cruiser' ? 0.38 : 0.31]);
    if (st !== 'rat') paint.add(BOX(), Tr, [0, tankY + 0.02, -0.12 - (st === 'cruiser' ? 0.15 : 0)], [0.08, 0, 0], [0.43, 0.035, 0.35]);
    matte.add(BOX(), st === 'cruiser' ? 0x3b2416 : 0x141414, [0, D.seat, 0.28], [-0.05, 0, 0], [st === 'cruiser' ? 0.34 : 0.24, 0.08, st === 'cruiser' ? 0.5 : 0.36]);
    if (st === 'sport' || st === 'super') {
      paint.add(st === 'super' ? CONE(4) : SPH(10, 8), P, [0, D.seat + 0.07, 0.62], st === 'super' ? [-Math.PI / 2 - 0.28, Math.PI / 4, 0] : [-0.25, 0, 0], st === 'super' ? [0.2, 0.55, 0.13] : [0.13, 0.1, 0.3]);
      glow.add(BOX(), 0xff1a1a, [0, D.seat + 0.07, rz + 0.2], [0, 0, 0], [0.14, 0.04, 0.03]);
    } else {
      paint.add(BOX(), st === 'rat' ? 0x5a4a3a : P, [0, wr + 0.38, rz + 0.04], [-0.35, 0, 0], [0.2, 0.03, 0.5]); // rear fender
      glow.add(BOX(), 0xff1a1a, [0, wr + 0.48, rz + 0.3], [0, 0, 0], [0.1, 0.06, 0.04]);
    }
    // front: fairing or naked headlight
    if (st === 'sport' || st === 'super') {
      const nose = fz + 0.08;
      paint.add(st === 'super' ? CONE(4) : SPH(12, 10), P, [0, 0.9, nose], st === 'super' ? [-Math.PI / 2, Math.PI / 4, 0] : [0.15, 0, 0], st === 'super' ? [0.27, 0.7, 0.2] : [0.25, 0.21, 0.4]);
      paint.add(BOX(), P, [0, wr + 0.27, -0.12], [0.18, 0, 0], [0.4, 0.38, 0.62]);              // side panels
      paint.add(BOX(), Tr, [0, wr + 0.3, -0.12], [0.18, 0, 0], [0.41, 0.06, 0.5]);              // stripe
      matte.add(SPH(10, 6), 0x0c1418, [0, 1.08, fz + 0.2], [0.75, 0, 0], [0.17, 0.03, 0.2]);    // screen
      glow.add(BOX(), 0xfff3d0, [-0.08, 0.9, nose - 0.33], [0.2, 0.25, 0], [0.09, 0.05, 0.04]);
      glow.add(BOX(), 0xfff3d0, [0.08, 0.9, nose - 0.33], [0.2, -0.25, 0], [0.09, 0.05, 0.04]);
      if (st === 'super') {
        glow.add(BOX(), Tr, [0.205, wr + 0.3, -0.12], [0.18, 0, 0], [0.01, 0.03, 0.55]);
        glow.add(BOX(), Tr, [-0.205, wr + 0.3, -0.12], [0.18, 0, 0], [0.01, 0.03, 0.55]);
      }
      chrome.rod([0.13, wr + 0.05, 0.1], [0.12, D.seat - 0.02, rz + 0.12], 0.05, 0x9a9a9a, 10, 0.06);
      chrome.rod([-0.13, wr + 0.05, 0.1], [-0.12, D.seat - 0.02, rz + 0.12], 0.05, 0x9a9a9a, 10, 0.06);
    } else {
      chrome.add(CYL(14), 0xd8d8d8, [0, 0.95, fz - 0.06], [Math.PI / 2, 0, 0], [0.1, 0.1, 0.1]);
      glow.add(CYL(14), 0xfff6dc, [0, 0.95, fz - 0.115], [Math.PI / 2, 0, 0], [0.085, 0.01, 0.085]);
      if (st === 'cop') {
        matte.add(BOX(), 0xf0f0f0, [0, 0.98, fz + 0.05], [0.2, 0, 0], [0.5, 0.36, 0.3]);
        matte.add(BOX(), 0x9fb8c8, [0, 1.3, fz + 0.15], [-0.35, 0, 0], [0.46, 0.4, 0.02]);
        for (const sx of [-0.3, 0.3]) { paint.add(BOX(), 0xf4f4f4, [sx, wr + 0.32, rz - 0.05], [0, 0, 0], [0.18, 0.34, 0.5]); paint.add(BOX(), Tr, [sx * 1.02, wr + 0.32, rz - 0.05], [0, 0, 0], [0.18, 0.06, 0.51]); }
      }
      // exhaust
      const ey = st === 'rat' ? 0.3 : 0.08;
      chrome.rod([0.15, wr + 0.08, -0.05], [0.18, wr + ey, rz + 0.25], 0.042, 0xc8c8c8);
      if (st === 'cruiser' || st === 'cop') chrome.rod([0.17, wr - 0.04, -0.15], [0.21, wr - 0.02, rz + 0.3], 0.042, 0xc8c8c8);
    }
    if (st === 'cruiser') { paint.add(SPH(12, 6), P, [0, wr + 0.16, fz], [0, 0, 0], [0.13, 0.12, 0.42]); }
    // bars
    const g = D.grip;
    matte.rod([-g[0], g[1], g[2]], [g[0], g[1], g[2]], 0.017, 0x111111);
    chrome.rod([0, head[1], head[2]], [0, g[1] - 0.02, g[2] + 0.03], 0.02, 0xcccccc);
    for (const sx of [-1, 1]) {
      matte.add(CYL(8), 0x0a0a0a, [sx * g[0], g[1], g[2]], [0, 0, Math.PI / 2], [0.024, 0.12, 0.024]);
      chrome.rod([sx * (g[0] - 0.12), g[1], g[2]], [sx * (g[0] - 0.05), g[1] + 0.2, g[2] + 0.06], 0.008, 0xcccccc); // mirror stalk
      chrome.add(SPH(8, 6), 0xdddddd, [sx * (g[0] - 0.04), g[1] + 0.22, g[2] + 0.06], [0, 0, 0], [0.06, 0.04, 0.02]);
    }
    for (const sx of [-1, 1]) matte.add(BOX(), 0x1a1a1a, [sx * D.peg[0], D.peg[1], D.peg[2]], [0, 0, 0], [0.12, 0.03, 0.05]);
    const lights = st === 'cop' ? (() => {
      const red = new Merge(), blue = new Merge();
      red.add(BOX(), 0xff1010, [-0.2, 1.22, rz - 0.05], [0, 0, 0], [0.12, 0.09, 0.09]);
      blue.add(BOX(), 0x2060ff, [0.2, 1.22, rz - 0.05], [0, 0, 0], [0.12, 0.09, 0.09]);
      red.add(BOX(), 0xff1010, [-0.12, 0.93, fz - 0.14], [0, 0, 0], [0.05, 0.05, 0.02]);
      blue.add(BOX(), 0x2060ff, [0.12, 0.93, fz - 0.14], [0, 0, 0], [0.05, 0.05, 0.02]);
      return { red: red.build(), blue: blue.build() };
    })() : null;
    return (BIKE_GEOMS[key] = {
      D, paint: paint.build(), chrome: chrome.build(), matte: matte.build(), glow: glow.build(), lights,
      wheelF: wheelGeo(wr, D.tw, st), wheelR: wheelGeo(wr, st === 'cruiser' ? D.tw * 1.4 : D.tw * 1.15, st),
    });
  }

  // ---- rider ----
  const LIMB = { upper: 0.3, fore: 0.3, thigh: 0.45, shin: 0.46 };
  function limbGeo(len, r0, r1, axis, end, color, endColor) {
    // tapered limb along -Z (arms) or -Y (legs), from 0 to -len
    const m = new Merge(), down = axis === 'y';
    const rot = down ? [Math.PI, 0, 0] : [-Math.PI / 2, 0, 0];
    m.add(CYL(10, r1 / r0), color, down ? [0, -len / 2, 0] : [0, 0, -len / 2], rot, [r0, len, r0]);
    m.add(SPH(10, 8), color, [0, 0, 0], [0, 0, 0], r0 * 1.02);
    if (end === 'glove') m.add(SPH(10, 8), endColor, [0, 0, -len - 0.02], [0, 0, 0], [0.058, 0.05, 0.075]);
    if (end === 'boot') { m.add(BOX(), endColor, [0, -len - 0.03, -0.06], [0, 0, 0], [0.11, 0.12, 0.27]); m.add(BOX(), 0x050505, [0, -len - 0.085, -0.06], [0, 0, 0], [0.115, 0.03, 0.28]); }
    if (end === 'knee') m.add(SPH(8, 6), endColor, [0, -0.02, 0], [0, 0, 0], r0 * 1.15);
    return m.build();
  }
  function riderMeshes(look, cop) {
    const jacket = look.jacket, legs = look.legs, helmet = look.helmet;
    const torso = new Merge();
    torso.add(SPH(14, 10), legs, [0, 0.02, 0.02], [0, 0, 0], [0.17, 0.12, 0.15]);                    // hips
    torso.add(CYL(14, 1.18), jacket, [0, 0.27, 0], [0, 0, 0], [0.155, 0.42, 0.12]);                  // body
    torso.add(SPH(14, 10), jacket, [0, 0.47, 0], [0, 0, 0], [0.2, 0.1, 0.13]);                       // shoulders
    torso.add(CYL(8), 0x1a1a1a, [0, 0.58, 0], [0, 0, 0], [0.055, 0.1, 0.055]);                       // neck
    torso.add(BOX(), cop ? 0xf2f2f2 : (look.stripe || 0x0a0a0a), [0, 0.3, 0.115], [0, 0, 0], [0.05, 0.4, 0.02]); // back stripe
    if (cop) torso.add(BOX(), 0xe0c050, [0.08, 0.38, -0.12], [0, 0, 0], [0.06, 0.06, 0.02]);       // badge
    const head = new Merge();
    head.add(SPH(16, 12), helmet, [0, 0, 0], [0, 0, 0], [0.155, 0.16, 0.175]);
    head.add(SPH(14, 8), 0x0b0b0e, [0, 0.0, -0.09], [0.15, 0, 0], [0.125, 0.07, 0.1]);             // visor
    head.add(BOX(), cop ? 0x1d3a8a : 0x0a0a0a, [0, 0.13, 0.0], [0, 0, 0], [0.035, 0.03, 0.3]);      // crest stripe
    head.add(BOX(), 0x111111, [0, -0.13, -0.03], [0.3, 0, 0], [0.16, 0.06, 0.18]);                    // chin
    return {
      torso: torso.build(), head: head.build(),
      upper: limbGeo(LIMB.upper, 0.062, 0.055, 'z', null, jacket),
      fore: limbGeo(LIMB.fore, 0.055, 0.047, 'z', 'glove', jacket, 0x121212),
      thigh: limbGeo(LIMB.thigh, 0.085, 0.068, 'y', 'knee', legs, legs),
      shin: limbGeo(LIMB.shin, 0.065, 0.055, 'y', 'boot', legs, 0x1a1410),
    };
  }

  // ---- weapons (held in the hand, pointing along -Z of the forearm) ----
  const WEAPON_GEOMS = {};
  function weaponGeo(kind) {
    if (WEAPON_GEOMS[kind]) return WEAPON_GEOMS[kind];
    const m = new Merge();
    switch (kind) {
      case 'chain':
        for (let i = 0; i < 11; i++) {
          const t = i / 10, z = -0.05 - t * 0.62, y = -Math.sin(t * Math.PI) * 0.12 - t * t * 0.18;
          m.add(TORUS(), 0xb0b0b8, [0, y, z], [0, i % 2 ? Math.PI / 2 : 0, Math.PI / 2], [0.028, 0.028, 0.04]);
        }
        break;
      case 'club': m.rod([0, 0, 0.06], [0, 0, -0.62], 0.025, 0x6d4425, 8, 0.045); break;
      case 'bat': m.rod([0, 0, 0.08], [0, 0, -0.72], 0.022, 0xd9b77e, 10, 0.042); break;
      case 'pipe': m.rod([0, 0, 0.08], [0, 0, -0.68], 0.026, 0x8c8f92, 10); break;
      case 'baton':
        m.rod([0, 0, 0.06], [0, 0, -0.58], 0.022, 0x111111, 8);
        m.rod([0, 0, -0.04], [0, 0.09, -0.04], 0.016, 0x111111, 6);
        break;
      case 'shotgun':
        m.rod([0, 0, 0.1], [0, 0, -0.75], 0.022, 0x2a2a2a, 8);
        m.rod([0.03, -0.01, -0.05], [0.03, -0.01, -0.72], 0.02, 0x2a2a2a, 8);
        m.add(BOX(), 0x6d4425, [0, -0.05, 0.12], [0.3, 0, 0], [0.07, 0.12, 0.3]);
        m.add(BOX(), 0x6d4425, [0, -0.04, -0.3], [0, 0, 0], [0.08, 0.07, 0.2]);
        break;
      case 'smg':
        m.add(BOX(), 0x1c1c1c, [0, 0.02, -0.12], [0, 0, 0], [0.07, 0.11, 0.38]);
        m.rod([0, 0.04, -0.3], [0, 0.04, -0.58], 0.018, 0x111111, 8);
        m.add(BOX(), 0x1c1c1c, [0, -0.12, -0.12], [0.15, 0, 0], [0.05, 0.22, 0.07]);
        m.add(BOX(), 0x333333, [0, -0.02, 0.1], [0, 0, 0], [0.05, 0.08, 0.16]);
        break;
      case 'crowbar':
        m.rod([0, 0, 0.06], [0, 0, -0.6], 0.018, 0x8b1a1a, 6);
        m.rod([0, 0, -0.6], [0, 0.08, -0.7], 0.018, 0x8b1a1a, 6);
        break;
    }
    return (WEAPON_GEOMS[kind] = m.build());
  }

  // ---- two-bone IK ----
  const _dir = { v: null };
  function ik(A, Tg, l1, l2, pole, outElbow, outHand) {
    const dir = (_dir.v || (_dir.v = new T.Vector3())).copy(Tg).sub(A);
    let d = dir.length();
    d = Math.min(Math.max(d, Math.abs(l1 - l2) + 0.01), l1 + l2 - 0.002);
    dir.normalize();
    const a = (l1 * l1 - l2 * l2 + d * d) / (2 * d), h = Math.sqrt(Math.max(0, l1 * l1 - a * a));
    const p = pole.clone().addScaledVector(dir, -pole.dot(dir));
    if (p.lengthSq() < 1e-6) p.set(0, 1, 0);
    p.normalize();
    outElbow.copy(A).addScaledVector(dir, a).addScaledVector(p, h);
    outHand.copy(A).addScaledVector(dir, d);
  }

  // A racer: bike group + rider group with posable limbs.
  class RacerModel {
    constructor(spec, look, opts = {}) {
      const g = bikeGeoms(spec);
      this.D = g.D;
      this.root = new T.Group();
      this.bike = new T.Group(); this.root.add(this.bike);
      const mk = (geom, mat, parent, shadow = true) => { const m = new T.Mesh(geom, mat); m.castShadow = shadow; parent.add(m); return m; };
      mk(g.paint, MAT.paint, this.bike); mk(g.chrome, MAT.chrome, this.bike); mk(g.matte, MAT.matte, this.bike); mk(g.glow, MAT.glow, this.bike, false);
      this.wheelF = mk(g.wheelF, MAT.matte, this.bike); this.wheelF.position.set(0, g.D.wr, -g.D.wb / 2);
      this.wheelR = mk(g.wheelR, MAT.matte, this.bike); this.wheelR.position.set(0, g.D.wr, g.D.wb / 2);
      if (g.lights) { this.red = mk(g.lights.red, MAT.glow, this.bike, false); this.blue = mk(g.lights.blue, MAT.glow, this.bike, false); }
      // rider
      const rm = riderMeshes(look, opts.cop);
      this.rider = new T.Group(); this.root.add(this.rider);
      this.torso = mk(rm.torso, MAT.cloth, this.rider);
      this.head = mk(rm.head, MAT.helmet, this.rider);
      this.limbs = {};
      for (const side of ['L', 'R']) {
        this.limbs['upper' + side] = mk(rm.upper, MAT.cloth, this.rider);
        this.limbs['fore' + side] = mk(rm.fore, MAT.cloth, this.rider);
        this.limbs['thigh' + side] = mk(rm.thigh, MAT.cloth, this.rider);
        this.limbs['shin' + side] = mk(rm.shin, MAT.cloth, this.rider);
      }
      this.weaponMesh = null; this.weaponKind = null;
      // blob shadow (cheap, always on)
      this.blob = new T.Mesh(BLOB_GEO, BLOB_MAT); this.blob.rotation.x = -Math.PI / 2; this.blob.renderOrder = 1;
      this.root.add(this.blob);
      this.tmp = { A: new T.Vector3(), E: new T.Vector3(), Hd: new T.Vector3(), T: new T.Vector3(), P: new T.Vector3(), m: new T.Matrix4(), q: new T.Quaternion(), e: new T.Euler(0, 0, 0, 'YXZ') };
      this.spin = 0;
    }
    setWeapon(kind) {
      if (kind === this.weaponKind) return;
      if (this.weaponMesh) { this.weaponMesh.parent.remove(this.weaponMesh); this.weaponMesh = null; }
      this.weaponKind = kind;
      if (kind) {
        this.weaponMesh = new T.Mesh(weaponGeo(kind), MAT.matte); this.weaponMesh.castShadow = true;
        this.weaponMesh.position.set(0, 0, -LIMB.fore - 0.02); this.weaponMesh.rotation.x = kind === 'shotgun' || kind === 'smg' ? 0 : 0.5;
        this.limbs.foreR.add(this.weaponMesh);
      }
    }
    // orient a limb mesh (rest axis -Z for arms, -Y for legs) from a to b
    _limb(mesh, a, b, axis) {
      const d = this.tmp.T.copy(b).sub(a).normalize();
      mesh.position.copy(a);
      mesh.quaternion.setFromUnitVectors(axis, d);
    }
    // pose: { mode: 'ride'|'fly'|'lie'|'run'|'stand', tuck, steer, lean, twist, look, armL:{x,y,z}|null, armR, footL, footR, t }
    pose(p) {
      const t = this.tmp, D = this.D;
      const riding = p.mode === 'ride';
      // pelvis & torso
      const pel = riding ? t.P.set(0, D.seat + 0.06, 0.26) : t.P.set(0, 0.95, 0);
      let pitch, roll = p.roll || 0, yaw = p.twist || 0;
      if (riding) pitch = -(0.2 + (D.tuck) * (p.tuck || 0)) - (p.lunge || 0);
      else if (p.mode === 'run') pitch = -0.25; else pitch = p.pitch || 0;
      this.torso.position.copy(pel);
      t.e.set(pitch, yaw, roll, 'YXZ');
      this.torso.quaternion.setFromEuler(t.e);
      this.torso.updateMatrix();
      const M = this.torso.matrix;
      this.head.position.set(0, 0.72, -0.02).applyMatrix4(M);
      t.e.set(-pitch * 0.7 + (p.headPitch || 0), p.look || 0, 0, 'YXZ');
      this.head.quaternion.copy(this.torso.quaternion).multiply(t.q.setFromEuler(t.e));
      // arms
      for (const side of [-1, 1]) {
        const S = side < 0 ? 'L' : 'R';
        const sh = t.A.set(side * 0.2, 0.47, 0).applyMatrix4(M);
        let target = side < 0 ? p.armL : p.armR;
        if (!target) target = riding ? t.T.set(side * D.grip[0], D.grip[1], D.grip[2]) : t.T.set(side * 0.28, 0.7, -0.1);
        const tgt = target.isVector3 ? target.clone() : new T.Vector3(target.x, target.y, target.z);
        ik(sh, tgt, LIMB.upper, LIMB.fore, new T.Vector3(side * 0.9, -0.5, 0.4), t.E, t.Hd);
        this._limb(this.limbs['upper' + S], sh, t.E, NEG_Z);
        this._limb(this.limbs['fore' + S], t.E, t.Hd, NEG_Z);
      }
      // legs
      for (const side of [-1, 1]) {
        const S = side < 0 ? 'L' : 'R';
        const hip = t.A.set(side * 0.11, -0.02, 0.02).applyMatrix4(M);
        let foot = side < 0 ? p.footL : p.footR;
        if (!foot) foot = riding ? new T.Vector3(side * D.peg[0], D.peg[1] + 0.04, D.peg[2]) : new T.Vector3(side * 0.13, 0.06, 0);
        ik(hip, foot, LIMB.thigh, LIMB.shin, new T.Vector3(side * 0.35, 0.2, -1), t.E, t.Hd);
        this._limb(this.limbs['thigh' + S], hip, t.E, NEG_Y);
        this._limb(this.limbs['shin' + S], t.E, t.Hd, NEG_Y);
      }
    }
    dispose() { this.root.traverse(o => { if (o.isMesh && o.geometry !== BLOB_GEO) { /* geometries are shared per bike type */ } }); }
  }
  let NEG_Z, NEG_Y, BLOB_GEO, BLOB_MAT;

  // ---- traffic ----
  // One InstancedMesh set per car type: painted body (instance colour), fixed-colour details, lights.
  function carParts(type) {
    const c = RR.CAR_TYPES[type], L = c.len, W = c.w, Hh = c.h;
    const body = new Merge(), det = new Merge(), lit = new Merge();
    const wr = type === 'truck' || type === 'bus' ? 0.5 : 0.34;
    const glass = 0x1b2430, black = 0x141414, chromeC = 0xb8b8b8;
    const wheel = (x, z) => { det.add(CYL(14), black, [x, wr, z], [0, 0, Math.PI / 2], [wr, 0.26, wr]); det.add(CYL(10), 0x9a9a9a, [x * 1.04, wr, z], [0, 0, Math.PI / 2], [wr * 0.55, 0.22, wr * 0.55]); };
    const wx = W / 2 - 0.12;
    if (type === 'truck') {
      body.add(BOX(), 0xffffff, [0, 1.45, -L / 2 + 1.2], [0, 0, 0], [W, 2.3, 2.3]);              // cab
      det.add(BOX(), glass, [0, 2.05, -L / 2 + 0.04], [0, 0, 0], [W * 0.88, 0.8, 0.06]);
      det.add(BOX(), 0xe8e8e8, [0, 1.95, L / 2 - 3.5], [0, 0, 0], [W + 0.04, 2.9, 6.8]);         // trailer box
      det.add(BOX(), black, [0, 0.55, 0], [0, 0, 0], [W * 0.9, 0.35, L - 0.4]);
      for (const z of [-L / 2 + 1.1, L / 2 - 2.2, L / 2 - 1.0]) { wheel(wx, z); wheel(-wx, z); }
      lit.add(BOX(), 0xfff2c0, [W / 2 - 0.25, 0.85, -L / 2 - 0.02], [0, 0, 0], [0.3, 0.18, 0.04]);
      lit.add(BOX(), 0xfff2c0, [-W / 2 + 0.25, 0.85, -L / 2 - 0.02], [0, 0, 0], [0.3, 0.18, 0.04]);
      lit.add(BOX(), 0xff2020, [W / 2 - 0.2, 0.9, L / 2 + 0.02], [0, 0, 0], [0.2, 0.25, 0.04]);
      lit.add(BOX(), 0xff2020, [-W / 2 + 0.2, 0.9, L / 2 + 0.02], [0, 0, 0], [0.2, 0.25, 0.04]);
    } else if (type === 'bus') {
      body.add(BOX(), 0xffffff, [0, 1.75, 0], [0, 0, 0], [W, 2.6, L]);
      det.add(BOX(), glass, [0, 2.1, 0], [0, 0, 0], [W + 0.02, 0.9, L - 1.6]);
      det.add(BOX(), glass, [0, 1.9, -L / 2 - 0.01], [0, 0, 0], [W * 0.9, 1.3, 0.04]);
      det.add(BOX(), black, [0, 0.42, 0], [0, 0, 0], [W - 0.1, 0.4, L - 0.6]);
      for (const z of [-L / 2 + 2.2, L / 2 - 2.6]) { wheel(wx, z); wheel(-wx, z); }
      lit.add(BOX(), 0xfff2c0, [W / 2 - 0.3, 0.8, -L / 2 - 0.02], [0, 0, 0], [0.3, 0.18, 0.04]);
      lit.add(BOX(), 0xfff2c0, [-W / 2 + 0.3, 0.8, -L / 2 - 0.02], [0, 0, 0], [0.3, 0.18, 0.04]);
      lit.add(BOX(), 0xff2020, [W / 2 - 0.2, 0.9, L / 2 + 0.02], [0, 0, 0], [0.2, 0.3, 0.04]);
      lit.add(BOX(), 0xff2020, [-W / 2 + 0.2, 0.9, L / 2 + 0.02], [0, 0, 0], [0.2, 0.3, 0.04]);
      lit.add(BOX(), 0xffb000, [0, 2.95, -L / 2 - 0.02], [0, 0, 0], [1.4, 0.25, 0.04]);
    } else {
      // cars, pickups and vans: lower body, cabin, bumpers
      const van = type === 'van', pick = type === 'pickup', sport = type === 'sports';
      const bodyH = van ? Hh - 0.35 : sport ? 0.55 : 0.68, bodyY = wr + bodyH / 2 + 0.02;
      body.add(BOX(), 0xffffff, [0, bodyY, 0], [0, 0, 0], [W, bodyH, L]);
      if (!van) {
        const cabL = pick ? L * 0.36 : type === 'hatch' ? L * 0.58 : sport ? L * 0.42 : L * 0.5, cabZ = pick ? -L * 0.08 : type === 'hatch' ? L * 0.08 : sport ? L * 0.05 : 0;
        const cabH = Hh - bodyH - wr;
        body.add(BOX(), 0xffffff, [0, bodyY + bodyH / 2 + cabH / 2, cabZ], [0, 0, 0], [W * 0.86, cabH, cabL]);
        det.add(BOX(), glass, [0, bodyY + bodyH / 2 + cabH * 0.5, cabZ], [0, 0, 0], [W * 0.87, cabH * 0.62, cabL * 0.82]);
        det.add(BOX(), glass, [0, bodyY + bodyH / 2 + cabH * 0.45, cabZ - cabL / 2 - 0.12], [-0.5, 0, 0], [W * 0.8, cabH * 0.75, 0.05]);
        if (pick) det.add(BOX(), 0x262626, [0, bodyY + bodyH / 2 - 0.02, L * 0.25], [0, 0, 0], [W * 0.84, 0.06, L * 0.42]);
        if (type === 'taxi') lit.add(BOX(), 0xfff7b0, [0, bodyY + bodyH / 2 + cabH + 0.08, cabZ], [0, 0, 0], [0.5, 0.14, 0.22]);
      } else {
        det.add(BOX(), glass, [0, bodyY + bodyH * 0.25, -L / 2 + 0.05], [-0.25, 0, 0], [W * 0.88, bodyH * 0.35, 0.06]);
        det.add(BOX(), glass, [0, bodyY + bodyH * 0.25, -L * 0.2], [0, 0, 0], [W + 0.02, bodyH * 0.3, L * 0.3]);
      }
      det.add(BOX(), black, [0, wr + 0.12, -L / 2], [0, 0, 0], [W + 0.04, 0.2, 0.14]);
      det.add(BOX(), black, [0, wr + 0.12, L / 2], [0, 0, 0], [W + 0.04, 0.2, 0.14]);
      det.add(BOX(), 0x202020, [0, bodyY, -L / 2 - 0.01], [0, 0, 0], [W * 0.4, bodyH * 0.45, 0.04]);
      const wz = L / 2 - (sport ? 0.8 : 0.85);
      for (const z of [-wz, wz]) { wheel(wx, z); wheel(-wx, z); }
      for (const sx of [-1, 1]) {
        lit.add(BOX(), 0xfff2c0, [sx * (W / 2 - 0.25), bodyY + bodyH * 0.15, -L / 2 - 0.02], [0, 0, 0], [0.34, 0.14, 0.04]);
        lit.add(BOX(), 0xff1a1a, [sx * (W / 2 - 0.2), bodyY + bodyH * 0.2, L / 2 + 0.02], [0, 0, 0], [0.3, 0.16, 0.04]);
        det.add(BOX(), chromeC, [sx * (W / 2 + 0.06), bodyY + bodyH / 2 + 0.25, -L * 0.12], [0, 0, 0], [0.1, 0.08, 0.06]);
      }
    }
    return { body: body.build(), det: det.build(), lit: lit.build() };
  }

  function init() {
    T = window.THREE;
    NEG_Z = new T.Vector3(0, 0, -1); NEG_Y = new T.Vector3(0, -1, 0);
    initMaterials();
    // soft round blob for under-bike shadows
    const c = document.createElement('canvas'); c.width = c.height = 64;
    const x = c.getContext('2d'), gr = x.createRadialGradient(32, 32, 2, 32, 32, 31);
    gr.addColorStop(0, 'rgba(0,0,0,0.55)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
    x.fillStyle = gr; x.fillRect(0, 0, 64, 64);
    const tex = new T.CanvasTexture(c);
    BLOB_GEO = new T.PlaneGeometry(1.1, 2.6);
    BLOB_MAT = new T.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4 });
  }

  RR.models = {
    init, Merge, MAT, RacerModel, carParts, weaponGeo, ik, LIMB,
    geo: { BOX, CYL, SPH, ICO, CONE, TORUS },
    get BLOB_GEO() { return BLOB_GEO; }, get BLOB_MAT() { return BLOB_MAT; },
  };
})();
