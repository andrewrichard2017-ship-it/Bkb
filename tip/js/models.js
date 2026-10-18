// Tractor Tippin': the characters, built from primitives at load time. Cartoon vehicles with their eyes in
// the windshield and a mouth on the front bumper: Rusty the tow truck, Dash the race car, the sleepy
// cow-like tractors and Thrasher the combine harvester.
// Local frame: forward is +Z, up +Y; a vehicle's origin is on the ground in the middle of its wheelbase.
(() => {
  'use strict';
  const TT = window.TT;
  let T;

  // ---- geometry cache (all non-indexed so they can be merged) ----
  const cache = {};
  const ni = g => g.index ? g.toNonIndexed() : g;
  const geo = (key, make) => cache[key] || (cache[key] = ni(make()));
  const BOX = () => geo('box', () => new T.BoxGeometry(1, 1, 1));
  const CYL = (seg = 14, top = 1, open = false) => geo('cyl' + seg + '_' + top + open, () => new T.CylinderGeometry(top, 1, 1, seg, 1, open));
  const SPH = (w = 14, h = 10) => geo('sph' + w + '_' + h, () => new T.SphereGeometry(1, w, h));
  const HEMI = (w = 14) => geo('hemi' + w, () => new T.SphereGeometry(1, w, 7, 0, Math.PI * 2, 0, Math.PI / 2));
  const CONE = (seg = 10) => geo('cone' + seg, () => new T.ConeGeometry(1, 1, seg));
  const TORUS = (arc = Math.PI * 2, tube = 0.3) => geo('torus' + arc.toFixed(2) + tube, () => new T.TorusGeometry(1, tube, 8, 20, arc));
  const ARCH = () => geo('arch', () => new T.CylinderGeometry(1, 1, 1, 18, 1, true, 0, Math.PI).rotateZ(Math.PI / 2));

  // Side-profile extrusion: cmds trace the outline in (forward z, up y); width is along x.
  // ['M', z, y] ['L', z, y] ['Q', cz, cy, z, y]
  function profile(cmds, width, bevel = 0.06, segs = 3) {
    const sh = new T.Shape();
    for (const c of cmds) {
      if (c[0] === 'M') sh.moveTo(c[1], c[2]);
      else if (c[0] === 'L') sh.lineTo(c[1], c[2]);
      else sh.quadraticCurveTo(c[1], c[2], c[3], c[4]);
    }
    const depth = Math.max(0.01, width - bevel * 2);
    const g = new T.ExtrudeGeometry(sh, { depth, bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel, bevelSegments: segs, curveSegments: 10 });
    g.rotateY(-Math.PI / 2);
    g.translate(depth / 2, 0, 0);
    g.computeVertexNormals();
    return ni(g);
  }
  // A tube along a curve that tapers from r0 to r1 (Thrasher's horns).
  function taperTube(points, r0, r1, seg = 16, rad = 8) {
    const curve = new T.CatmullRomCurve3(points.map(p => new T.Vector3(...p)));
    const frames = curve.computeFrenetFrames(seg, false);
    const pos = [], idx = [];
    for (let i = 0; i <= seg; i++) {
      const u = i / seg, p = curve.getPointAt(u), r = r0 + (r1 - r0) * u, N = frames.normals[i], B = frames.binormals[i];
      for (let j = 0; j <= rad; j++) {
        const a = j / rad * Math.PI * 2, c = Math.cos(a), s = Math.sin(a);
        pos.push(p.x + r * (c * N.x + s * B.x), p.y + r * (c * N.y + s * B.y), p.z + r * (c * N.z + s * B.z));
      }
    }
    for (let i = 0; i < seg; i++) for (let j = 0; j < rad; j++) {
      const a = i * (rad + 1) + j, b = a + rad + 1;
      idx.push(a, b, a + 1, b, b + 1, a + 1);
    }
    const g = new T.BufferGeometry();
    g.setAttribute('position', new T.Float32BufferAttribute(pos, 3));
    g.setIndex(idx); g.computeVertexNormals();
    return ni(g);
  }

  // ---- merge builder with one bucket per material ----
  class Kit {
    constructor() { this.b = {}; this._m = new T.Matrix4(); this._nm = new T.Matrix3(); this._v = new T.Vector3(); this._c = new T.Color(); }
    bucket(k) { return this.b[k] || (this.b[k] = { p: [], n: [], c: [], uv: [] }); }
    // add(material key, geometry, colour, position, rotation [x,y,z], scale [x,y,z] or number)
    add(k, g, color, p = [0, 0, 0], r = [0, 0, 0], s = 1) {
      if (typeof s === 'number') s = [s, s, s];
      this._m.compose(new T.Vector3(p[0], p[1], p[2]), new T.Quaternion().setFromEuler(new T.Euler(r[0], r[1], r[2], 'XYZ')), new T.Vector3(s[0], s[1], s[2]));
      return this.addMatrix(k, g, color, this._m);
    }
    addMatrix(k, g, color, m) {
      const B = this.bucket(k), pos = g.attributes.position, nor = g.attributes.normal, uv = g.attributes.uv, v = this._v;
      this._nm.getNormalMatrix(m);
      const col = this._c.set(color);
      const flip = m.determinant() < 0;
      for (let i = 0; i < pos.count; i++) {
        const j = flip ? i - (i % 3) + (2 - (i % 3)) : i; // keep winding when mirrored
        v.fromBufferAttribute(pos, j).applyMatrix4(m); B.p.push(v.x, v.y, v.z);
        v.fromBufferAttribute(nor, j).applyMatrix3(this._nm).normalize(); B.n.push(v.x, v.y, v.z);
        B.c.push(col.r, col.g, col.b);
        if (uv) B.uv.push(uv.getX(j), uv.getY(j)); else B.uv.push(0, 0);
      }
      return this;
    }
    // a rod from a to b
    rod(k, a, b, r, color, seg = 8, rTop) {
      const A = new T.Vector3(...a), Bv = new T.Vector3(...b), d = Bv.clone().sub(A), L = d.length();
      const q = new T.Quaternion().setFromUnitVectors(new T.Vector3(0, 1, 0), d.normalize());
      return this.addMatrix(k, CYL(seg, rTop === undefined ? 1 : rTop / r), color, new T.Matrix4().compose(A.clone().add(Bv).multiplyScalar(0.5), q, new T.Vector3(r, L, r)));
    }
    // mirrored copy on both sides of x
    pair(k, g, color, p, r = [0, 0, 0], s = 1) { this.add(k, g, color, p, r, s); return this.add(k, g, color, [-p[0], p[1], p[2]], [r[0], -r[1], -r[2]], s); }
    geometry(k) {
      const B = this.b[k]; if (!B) return null;
      const g = new T.BufferGeometry();
      g.setAttribute('position', new T.Float32BufferAttribute(B.p, 3));
      g.setAttribute('normal', new T.Float32BufferAttribute(B.n, 3));
      g.setAttribute('color', new T.Float32BufferAttribute(B.c, 3));
      g.setAttribute('uv', new T.Float32BufferAttribute(B.uv, 2));
      g.computeBoundingSphere();
      return g;
    }
    build(mats, shadows = true) {
      const grp = new T.Group();
      for (const k of Object.keys(this.b)) {
        const m = new T.Mesh(this.geometry(k), mats[k] || MAT[k] || MAT.matte);
        m.castShadow = shadows && k !== 'glow'; m.receiveShadow = shadows;
        m.name = k; grp.add(m);
      }
      return grp;
    }
  }

  // ---- materials ----
  const MAT = {};
  const std = o => new T.MeshStandardMaterial(Object.assign({ vertexColors: true }, o));
  function initMaterials() {
    MAT.matte = std({ roughness: 0.8, metalness: 0.02 });
    MAT.matte2 = std({ roughness: 0.8, metalness: 0.02, side: T.DoubleSide });
    MAT.rubber = std({ roughness: 0.92, metalness: 0 });
    MAT.chrome = std({ roughness: 0.22, metalness: 0.95 });
    MAT.metal = std({ roughness: 0.5, metalness: 0.6 });
    MAT.glow = new T.MeshBasicMaterial({ vertexColors: true, toneMapped: false });
    MAT.glass = std({ roughness: 0.08, metalness: 0.4, color: 0xffffff });
    MAT.tractor = std({ roughness: 0.55, metalness: 0.1, side: T.DoubleSide });
  }
  const paint = (rough = 0.3, metal = 0.3, extra = {}) => std(Object.assign({ roughness: rough, metalness: metal }, extra));

  // ---- canvas helpers ----
  function canvasTex(w, h, draw, repeat) {
    const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
    const g = cv.getContext('2d'); draw(g, w, h);
    const t = new T.CanvasTexture(cv); t.colorSpace = T.SRGBColorSpace; t.anisotropy = 4;
    if (repeat) { t.wrapS = t.wrapT = T.RepeatWrapping; }
    return t;
  }
  // Rusty's paint: rust brown with patches of faded teal and dark pitting
  function rustTexture() {
    return canvasTex(256, 256, (g, w, h) => {
      const R = TT.rng(77);
      g.fillStyle = '#7d4a2a'; g.fillRect(0, 0, w, h);
      const soft = (x, y, r, col) => { for (const ox of [-w, 0, w]) for (const oy of [-h, 0, h]) { const gr = g.createRadialGradient(x + ox, y + oy, r * 0.3, x + ox, y + oy, r); gr.addColorStop(0, col); gr.addColorStop(1, col.replace(/[\d.]+\)$/, '0)')); g.fillStyle = gr; g.fillRect(x + ox - r, y + oy - r, r * 2, r * 2); } };
      for (let i = 0; i < 14; i++) soft(R() * w, R() * h, R.range(30, 70), `rgba(${R.int(140, 165)},${R.int(78, 95)},${R.int(40, 52)},0.55)`);
      for (let i = 0; i < 6; i++) soft(R() * w, R() * h, R.range(28, 55), 'rgba(92,140,132,0.85)');
      for (let i = 0; i < 10; i++) soft(R() * w, R() * h, R.range(10, 22), 'rgba(58,30,14,0.55)');
      for (let i = 0; i < 500; i++) { g.fillStyle = `rgba(40,20,8,${R.range(0.1, 0.35)})`; g.fillRect(R() * w, R() * h, 2, 2); }
    }, true);
  }
  function blob(g, R, x, y, r) {
    g.beginPath();
    const n = 9;
    for (let i = 0; i <= n; i++) { const a = i / n * Math.PI * 2, rr = r * R.range(0.6, 1.2); g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); }
    g.fill();
  }
  function cowTexture() {
    return canvasTex(128, 128, (g, w, h) => {
      const R = TT.rng(9);
      g.fillStyle = '#f4f1e8'; g.fillRect(0, 0, w, h);
      g.fillStyle = '#1d1b1a';
      for (let i = 0; i < 7; i++) blob(g, R, R() * w, R() * h, R.range(9, 20));
    }, true);
  }
  // Dash's side decal: lightning stripe and his number in a roundel
  function dashDecal(flip) {
    return canvasTex(512, 160, (g, w, h) => {
      g.save(); if (flip) { g.translate(w, 0); g.scale(-1, 1); }
      const grad = g.createLinearGradient(0, 0, w, 0);
      grad.addColorStop(0, '#ff7a00'); grad.addColorStop(0.55, '#ffc400'); grad.addColorStop(1, '#ffe14a');
      g.fillStyle = grad; g.strokeStyle = '#c41010'; g.lineWidth = 6;
      g.beginPath(); // bolt pointing forward (to the right of the canvas)
      g.moveTo(10, 70); g.lineTo(250, 52); g.lineTo(230, 82); g.lineTo(500, 40); g.lineTo(300, 112); g.lineTo(318, 88); g.lineTo(10, 104); g.closePath();
      g.fill(); g.stroke();
      g.restore();
      // roundel stays readable on both sides
      g.fillStyle = '#ffffff'; g.beginPath(); g.arc(w * 0.5, h * 0.5, 62, 0, Math.PI * 2); g.fill();
      g.lineWidth = 8; g.strokeStyle = '#ffcc00'; g.stroke();
      g.fillStyle = '#111'; g.font = 'bold 82px Impact, Arial Black, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText('88', w * 0.5, h * 0.53);
    });
  }
  // stock-car side decals: 'flames' (Blower), 'swoosh' (Chatter)
  function sideDecal(style, num, flip, cols) {
    return canvasTex(512, 160, (g, w, h) => {
      g.save(); if (flip) { g.translate(w, 0); g.scale(-1, 1); }
      if (style === 'flames') {
        g.fillStyle = cols[0]; g.strokeStyle = cols[1]; g.lineWidth = 5;
        g.beginPath(); g.moveTo(500, 60);
        for (let i = 0; i < 6; i++) { const x = 470 - i * 70; g.quadraticCurveTo(x + 20, 20 + (i % 2) * 18, x - 30, 55); g.quadraticCurveTo(x - 10, 80, x - 40, 105); }
        g.lineTo(500, 110); g.closePath(); g.fill(); g.stroke();
      } else {
        const gr = g.createLinearGradient(0, 0, w, 0); gr.addColorStop(0, cols[0]); gr.addColorStop(1, cols[1]);
        g.fillStyle = gr; g.beginPath(); g.moveTo(0, 110); g.bezierCurveTo(150, 40, 330, 150, 512, 50); g.lineTo(512, 90); g.bezierCurveTo(330, 170, 150, 80, 0, 140); g.closePath(); g.fill();
        g.fillStyle = cols[2]; g.beginPath(); g.moveTo(0, 90); g.bezierCurveTo(150, 20, 330, 120, 512, 25); g.lineTo(512, 45); g.bezierCurveTo(330, 140, 150, 50, 0, 108); g.closePath(); g.fill();
      }
      g.restore();
      if (num) {
        g.fillStyle = '#ffffff'; g.beginPath(); g.arc(w * 0.5, h * 0.5, 58, 0, Math.PI * 2); g.fill();
        g.lineWidth = 7; g.strokeStyle = cols[1]; g.stroke();
        g.fillStyle = '#111'; g.font = 'bold 78px Impact, Arial Black, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(num, w * 0.5, h * 0.53);
      }
    });
  }
  // a round number/badge sticker
  function roundel(text, bg, fg, ring, font = 'bold 74px Impact, Arial Black, sans-serif') {
    return canvasTex(160, 160, g => {
      g.fillStyle = bg; g.beginPath(); g.arc(80, 80, 72, 0, Math.PI * 2); g.fill();
      if (ring) { g.lineWidth = 8; g.strokeStyle = ring; g.stroke(); }
      g.fillStyle = fg; g.font = font; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, 80, 86);
    });
  }
  function starDecal(col) {
    return canvasTex(128, 128, g => {
      g.fillStyle = col; g.beginPath();
      for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? 24 : 58; g.lineTo(64 + Math.cos(a) * r, 64 + Math.sin(a) * r); }
      g.closePath(); g.fill();
    });
  }
  function flowerDecal(flip) {
    return canvasTex(512, 96, g => {
      const R = TT.rng(31);
      for (let i = 0; i < 9; i++) {
        const x = 30 + i * 55 + R.range(-10, 10), y = 48 + R.range(-18, 18), r = R.range(12, 20), c = R.pick(['#ffd23a', '#ff7ad9', '#ff8a3a', '#ffffff', '#b07aff']);
        g.fillStyle = c; for (let k = 0; k < 6; k++) { const a = k / 6 * Math.PI * 2; g.beginPath(); g.arc(x + Math.cos(a) * r * 0.7, y + Math.sin(a) * r * 0.7, r * 0.5, 0, Math.PI * 2); g.fill(); }
        g.fillStyle = '#5a3a1a'; g.beginPath(); g.arc(x, y, r * 0.35, 0, Math.PI * 2); g.fill();
      }
      const px = flip ? 120 : 392; g.strokeStyle = '#ffffff'; g.lineWidth = 5; g.beginPath(); g.arc(px, 48, 26, 0, Math.PI * 2); g.moveTo(px, 22); g.lineTo(px, 74); g.moveTo(px, 48); g.lineTo(px - 18, 66); g.moveTo(px, 48); g.lineTo(px + 18, 66); g.stroke();
    });
  }
  function textDecal(text, color, bg, w = 256, h = 64, font = 'bold 40px Impact, Arial Black, sans-serif') {
    return canvasTex(w, h, (g) => {
      if (bg) { g.fillStyle = bg; g.fillRect(0, 0, w, h); }
      g.fillStyle = color; g.font = font; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, w / 2, h / 2 + 2);
    });
  }
  function decalMesh(tex, w, h, opts = {}) {
    const m = new T.Mesh(new T.PlaneGeometry(w, h), new T.MeshStandardMaterial({ map: tex, transparent: true, roughness: 0.35, metalness: 0.1, polygonOffset: true, polygonOffsetFactor: -2, depthWrite: false, ...opts }));
    m.renderOrder = 2;
    return m;
  }

  // ---- faces: eyes in the windshield and a mouth on the bumper, drawn on canvases ----
  const MOODS = {
    normal: { up: 0.2, tilt: 0, low: 0.06, iris: 0.6 },
    happy: { up: 0.14, tilt: -0.06, low: 0.3, iris: 0.62 },
    sneaky: { up: 0.44, tilt: 0.1, low: 0.18, iris: 0.58 },
    scared: { up: 0, tilt: -0.16, low: 0, iris: 0.45 },
    angry: { up: 0.4, tilt: 0.36, low: 0.12, iris: 0.55 },
    furious: { up: 0.3, tilt: 0.48, low: 0.16, iris: 0.42 },
    sleepy: { up: 0.62, tilt: -0.04, low: 0.1, iris: 0.6 },
    sleep: { up: 1, tilt: 0, low: 0, iris: 0.6 },
    dizzy: { up: 0.16, tilt: 0, low: 0.06, iris: 0.6, dizzy: true },
  };
  class Face {
    // o: { lid: paint colour, iris, glow (iris glows), mouth: true, teeth: 'buck'|'jaw'|'none', mouthW/H }
    constructor(o) {
      this.o = o;
      this.cv = document.createElement('canvas'); this.cv.width = 256; this.cv.height = 128;
      this.tex = new T.CanvasTexture(this.cv); this.tex.colorSpace = T.SRGBColorSpace; this.tex.anisotropy = 4;
      this.mat = new T.MeshStandardMaterial({ map: this.tex, roughness: 0.25, metalness: 0.1, emissive: 0xffffff, emissiveMap: this.tex, emissiveIntensity: o.night ? 0.28 : 0.12 });
      if (o.mouth) {
        this.mcv = document.createElement('canvas'); this.mcv.width = 256; this.mcv.height = 96;
        this.mtex = new T.CanvasTexture(this.mcv); this.mtex.colorSpace = T.SRGBColorSpace;
        this.mmat = new T.MeshStandardMaterial({ map: this.mtex, transparent: true, roughness: 0.4, emissive: 0xffffff, emissiveMap: this.mtex, emissiveIntensity: o.night ? 0.15 : 0.05, polygonOffset: true, polygonOffsetFactor: -2 });
      }
      this.key = ''; this.mkey = ''; this.mood = 'normal'; this.lx = 0; this.ly = 0; this.blinkT = 2 + Math.random() * 3; this.blink = 0; this.spin = 0;
      this.set('normal', 0, 0); this.draw(); this.drawMouth();
    }
    set(mood, lx = 0, ly = 0, mouth) { this.mood = mood; this.lx = lx; this.ly = ly; this.mouthMood = mouth || mood; }
    update(dt) {
      this.blinkT -= dt;
      if (this.blinkT < 0) { this.blink = 0.14; this.blinkT = 2.5 + Math.random() * 4; }
      this.blink = Math.max(0, this.blink - dt);
      this.spin += dt * 8;
      const M = MOODS[this.mood] || MOODS.normal;
      const lx = Math.round(this.lx * 8) / 8, ly = Math.round(this.ly * 8) / 8;
      const key = this.mood + lx + ',' + ly + (this.blink > 0 ? 'b' : '') + (M.dizzy ? Math.floor(this.spin) : '');
      if (key !== this.key) { this.key = key; this.draw(); }
      if (this.mcv && this.mouthMood !== this.mkey) { this.mkey = this.mouthMood; this.drawMouth(); }
    }
    draw() {
      const g = this.cv.getContext('2d'), w = 256, h = 128, o = this.o;
      const M = MOODS[this.mood] || MOODS.normal, closed = this.blink > 0 && this.mood !== 'sleep' && this.mood !== 'scared';
      g.fillStyle = o.lid; g.fillRect(0, 0, w, h);
      // a soft dark rim like the edge of the windshield
      const rim = g.createLinearGradient(0, 0, 0, h); rim.addColorStop(0, 'rgba(0,0,0,0.35)'); rim.addColorStop(0.15, 'rgba(0,0,0,0)'); rim.addColorStop(0.85, 'rgba(0,0,0,0)'); rim.addColorStop(1, 'rgba(0,0,0,0.3)');
      g.fillStyle = rim; g.fillRect(0, 0, w, h);
      const rx = w * 0.205, ry = h * 0.41, cy = h * 0.53;
      for (const side of [-1, 1]) {
        const cx = w / 2 + side * w * 0.218;
        g.save();
        g.beginPath(); g.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2); g.clip();
        const sc = g.createRadialGradient(cx - rx * 0.2, cy - ry * 0.3, 4, cx, cy, rx * 1.1);
        sc.addColorStop(0, '#ffffff'); sc.addColorStop(0.75, '#f1f1ee'); sc.addColorStop(1, '#bdbdb8');
        g.fillStyle = sc; g.fillRect(cx - rx, cy - ry, rx * 2, ry * 2);
        // iris and pupil
        const ir = ry * M.iris, ix = cx + this.lx * rx * 0.45, iy = cy + this.ly * ry * 0.32 + ry * 0.04;
        if (M.dizzy) {
          g.strokeStyle = '#222'; g.lineWidth = 5; g.beginPath();
          for (let a = 0; a < 14; a += 0.2) { const r = a * 2.3; g.lineTo(cx + Math.cos(a + this.spin * side) * r, cy + Math.sin(a + this.spin * side) * r); }
          g.stroke();
        } else {
          const ig = g.createRadialGradient(ix, iy, ir * 0.2, ix, iy, ir);
          ig.addColorStop(0, o.irisLight || o.iris); ig.addColorStop(0.7, o.iris); ig.addColorStop(1, '#101010');
          g.fillStyle = ig; g.beginPath(); g.arc(ix, iy, ir, 0, Math.PI * 2); g.fill();
          g.fillStyle = '#060606'; g.beginPath(); g.arc(ix, iy, ir * (this.mood === 'scared' ? 0.35 : 0.5), 0, Math.PI * 2); g.fill();
          g.fillStyle = 'rgba(255,255,255,0.95)'; g.beginPath(); g.arc(ix - ir * 0.35, iy - ir * 0.4, ir * 0.22, 0, Math.PI * 2); g.fill();
          g.beginPath(); g.arc(ix + ir * 0.3, iy + ir * 0.3, ir * 0.09, 0, Math.PI * 2); g.fill();
        }
        // upper lid: a line across the eye, tilted down towards the middle when angry
        const up = closed ? 1.02 : M.up, tilt = M.tilt;
        const yIn = cy - ry + up * ry * 2 + tilt * ry, yOut = cy - ry + up * ry * 2 - tilt * ry * 0.4;
        const xIn = cx - side * rx * 1.05, xOut = cx + side * rx * 1.05;
        g.fillStyle = o.lid;
        g.beginPath(); g.moveTo(xIn, cy - ry - 4); g.lineTo(xOut, cy - ry - 4); g.lineTo(xOut, yOut); g.quadraticCurveTo(cx, (yIn + yOut) / 2 + ry * 0.08, xIn, yIn); g.closePath(); g.fill();
        g.strokeStyle = 'rgba(0,0,0,0.55)'; g.lineWidth = 4;
        g.beginPath(); g.moveTo(xOut, yOut); g.quadraticCurveTo(cx, (yIn + yOut) / 2 + ry * 0.08, xIn, yIn); g.stroke();
        if (M.low > 0 && !closed) {
          const yl = cy + ry - M.low * ry * 2;
          g.fillStyle = o.lid;
          g.beginPath(); g.moveTo(cx - rx, cy + ry + 4); g.lineTo(cx - rx, yl + ry * 0.2); g.quadraticCurveTo(cx, yl - ry * 0.15, cx + rx, yl + ry * 0.2); g.lineTo(cx + rx, cy + ry + 4); g.closePath(); g.fill();
        }
        g.restore();
        g.strokeStyle = 'rgba(0,0,0,0.6)'; g.lineWidth = 3;
        g.beginPath(); g.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2); g.stroke();
      }
      this.tex.needsUpdate = true;
    }
    drawMouth() {
      if (!this.mcv) return;
      const g = this.mcv.getContext('2d'), w = 256, h = 96, o = this.o, m = this.mouthMood;
      g.clearRect(0, 0, w, h);
      const cx = w / 2, cy = h * 0.42, mw = w * 0.4;
      g.lineJoin = 'round'; g.lineCap = 'round';
      const dark = '#2a0c0c', lip = 'rgba(0,0,0,0.75)';
      if (m === 'sleep' || m === 'sleepy') {
        g.strokeStyle = lip; g.lineWidth = 6; g.beginPath(); g.moveTo(cx - mw * 0.5, cy + 6); g.quadraticCurveTo(cx, cy + 14, cx + mw * 0.5, cy + 6); g.stroke();
      } else if (m === 'scared') {
        g.fillStyle = dark; g.beginPath(); g.ellipse(cx, cy + 10, mw * 0.32, h * 0.32, 0, 0, Math.PI * 2); g.fill();
        g.fillStyle = '#d9555a'; g.beginPath(); g.ellipse(cx, cy + 26, mw * 0.2, h * 0.12, 0, 0, Math.PI * 2); g.fill();
        g.strokeStyle = lip; g.lineWidth = 4; g.beginPath(); g.ellipse(cx, cy + 10, mw * 0.32, h * 0.32, 0, 0, Math.PI * 2); g.stroke();
      } else if (m === 'angry' || m === 'furious' || o.teeth === 'jaw') {
        const W = mw * (o.teeth === 'jaw' ? 1.15 : 0.9), top = cy - 8, bot = cy + 26;
        g.fillStyle = dark; g.beginPath(); g.moveTo(cx - W, top + 6); g.quadraticCurveTo(cx, top - 10, cx + W, top + 6); g.quadraticCurveTo(cx + W * 0.9, bot + 8, cx, bot + 10); g.quadraticCurveTo(cx - W * 0.9, bot + 8, cx - W, top + 6); g.fill();
        g.fillStyle = '#f4f2ea';
        g.fillRect(cx - W * 0.85, top + 2, W * 1.7, 13); g.fillRect(cx - W * 0.7, bot - 9, W * 1.4, 11);
        g.strokeStyle = '#555'; g.lineWidth = 2;
        for (let x = -W * 0.8; x <= W * 0.8; x += W * 0.2) { g.beginPath(); g.moveTo(cx + x, top + 2); g.lineTo(cx + x, top + 15); g.stroke(); g.beginPath(); g.moveTo(cx + x, bot - 9); g.lineTo(cx + x, bot + 2); g.stroke(); }
        g.strokeStyle = lip; g.lineWidth = 5; g.beginPath(); g.moveTo(cx - W, top + 6); g.quadraticCurveTo(cx, top - 10, cx + W, top + 6); g.stroke();
      } else {
        // a big friendly grin
        const open = m === 'happy' || m === 'sneaky' || o.teeth === 'buck';
        g.fillStyle = dark;
        g.beginPath(); g.moveTo(cx - mw, cy - 8); g.quadraticCurveTo(cx, cy + (open ? 4 : -2), cx + mw, cy - 8); g.quadraticCurveTo(cx + mw * 0.8, cy + (open ? 40 : 18), cx, cy + (open ? 42 : 20)); g.quadraticCurveTo(cx - mw * 0.8, cy + (open ? 40 : 18), cx - mw, cy - 8); g.fill();
        if (open) { g.fillStyle = '#d24e55'; g.beginPath(); g.ellipse(cx, cy + 30, mw * 0.45, 10, 0, 0, Math.PI * 2); g.fill(); }
        if (o.teeth === 'buck') { g.fillStyle = '#fbf6e2'; g.strokeStyle = '#6b5a3a'; g.lineWidth = 2; for (const s of [-1, 1]) { g.beginPath(); g.rect(cx + s * 2 + (s < 0 ? -22 : 0), cy - 4, 22, 30); g.fill(); g.stroke(); } }
        else if (open) { g.fillStyle = '#f4f2ea'; g.fillRect(cx - mw * 0.7, cy - 4, mw * 1.4, 9); }
        g.strokeStyle = lip; g.lineWidth = 5;
        g.beginPath(); g.moveTo(cx - mw, cy - 8); g.quadraticCurveTo(cx, cy + (open ? 4 : -2), cx + mw, cy - 8); g.stroke();
        g.lineWidth = 4; g.beginPath(); g.moveTo(cx - mw - 6, cy - 14); g.quadraticCurveTo(cx - mw + 2, cy - 6, cx - mw + 4, cy - 2); g.stroke();
        g.beginPath(); g.moveTo(cx + mw + 6, cy - 14); g.quadraticCurveTo(cx + mw - 2, cy - 6, cx + mw - 4, cy - 2); g.stroke();
      }
      this.mtex.needsUpdate = true;
    }
    dispose() { this.tex.dispose(); this.mat.dispose(); if (this.mtex) { this.mtex.dispose(); this.mmat.dispose(); } }
  }
  // a face plane: centre, width, height, tilt back from vertical (radians)
  function facePlane(mat, c, w, h, tilt = 0, yaw = 0) {
    const m = new T.Mesh(new T.PlaneGeometry(w, h), mat);
    m.position.set(c[0], c[1], c[2]); m.rotation.set(-tilt, yaw, 0, 'YXZ');
    return m;
  }

  // ---- wheels ----
  function wheelKit(k, r, w, hub, hubR = 0.55, lugs = 0) {
    k.add('rubber', CYL(18), '#1c1c1e', [0, 0, 0], [0, 0, Math.PI / 2], [r, w, r]);
    k.add(hub.mat || 'chrome', CYL(14), hub.color, [0, 0, 0], [0, 0, Math.PI / 2], [r * hubR, w * 1.04, r * hubR]);
    k.add('matte', CYL(10), hub.cap || '#333', [0, 0, 0], [0, 0, Math.PI / 2], [r * 0.18, w * 1.1, r * 0.18]);
    for (let i = 0; i < lugs; i++) {
      const a = i / lugs * Math.PI * 2;
      k.add('rubber', BOX(), '#1c1c1e', [0, Math.sin(a) * r, Math.cos(a) * r], [a, 0, 0], [w * 0.98, r * 0.12, r * 0.22]);
    }
  }
  function wheel(r, w, hub, hubR, lugs) {
    const k = new Kit(); wheelKit(k, r, w, hub, hubR, lugs);
    const spin = k.build({});
    const pivot = new T.Group(); pivot.add(spin);
    return { pivot, spin, r };
  }

  // ================================================================ player vehicles
  class CarRig {
    // id: 'rusty' | 'dash'; o: { night, halloween, tag (css colour or null), shadows }
    constructor(id, o = {}) {
      this.id = id; this.o = o;
      this.root = new T.Group(); this.body = new T.Group(); this.root.add(this.body);
      this.wheels = []; this.mats = [];
      const L = TT.CARS[id] || TT.CARS.dash;
      if (id === 'rusty') this.buildRusty(o); else this['build' + (L.body || 'stock')[0].toUpperCase() + (L.body || 'stock').slice(1)](o, L);
      // headlight beam
      if (o.headlight) {
        const L = this.light = new T.SpotLight(0xfff1d0, o.headlight, 55, 0.5, 0.55, 1.4);
        L.position.set(0, this.lampY, this.lampZ); L.target.position.set(0, -2, this.lampZ + 16);
        this.body.add(L); this.body.add(L.target);
      }
      if (o.tag) {
        const g = new T.ConeGeometry(0.35, 0.6, 4); g.rotateX(Math.PI);
        this.tag = new T.Mesh(g, new T.MeshBasicMaterial({ color: o.tag, toneMapped: false }));
        this.tag.position.y = this.height + 1.1; this.root.add(this.tag);
      }
      const blob = new T.Mesh(new T.CircleGeometry(1, 20), new T.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.35, depthWrite: false }));
      blob.rotation.x = -Math.PI / 2; blob.position.y = 0.04; blob.scale.set(this.halfW + 0.2, this.halfL + 0.2, 1);
      this.root.add(blob); this.blob = blob;
      this.root.traverse(m => { if (m.isMesh && m !== blob && o.shadows) m.castShadow = true; });
      this.swing = 0; this.swingV = 0; this.spinAng = 0;
    }
    addWheel(r, w, x, z, hub, front, hubR, lugs) {
      const W = wheel(r, w, hub, hubR, lugs);
      W.pivot.position.set(x, r, z); W.front = front; this.body.add(W.pivot); this.wheels.push(W);
      return W;
    }
    // the face: windshield eyes (centre, size, tilt back from vertical) and a bumper mouth
    addFace(L, paintCol, eye, mouth, o, extra = {}) {
      const face = this.face = new Face(Object.assign({ lid: paintCol, iris: L.iris, irisLight: L.irisLight || '#ffffff', mouth: true, night: o.night }, extra));
      this.body.add(facePlane(face.mat, eye[0], eye[1], eye[2], eye[3]));
      this.body.add(facePlane(face.mmat, mouth[0], mouth[1], mouth[2], mouth[3] || 0));
    }
    decal(tex, w, h, pos, rot) { const d = decalMesh(tex, w, h); d.position.set(...pos); d.rotation.set(...rot); this.body.add(d); return d; }
    sides(texFn, w, h, x, y, z) { for (const s of [-1, 1]) this.decal(texFn(s > 0), w, h, [s * x, y, z], [0, s * Math.PI / 2, 0]); }
    halloweenHat(y, z) { // a witch's hat for anyone without a costume of their own
      const k = new Kit();
      k.add('matte', CYL(20), '#1b1426', [0, y, z], [0, 0, 0], [0.6, 0.04, 0.6]);
      k.add('matte', CONE(16), '#1b1426', [0, y + 0.45, z - 0.05], [0.18, 0, 0.1], [0.34, 0.9, 0.34]);
      k.add('matte', CYL(16, 0.92), '#ff7a1a', [0, y + 0.13, z], [0.05, 0, 0.02], [0.33, 0.12, 0.33]);
      this.body.add(k.build({}, false));
    }

    // ---- stock cars: Dash, Chatter, Blower
    buildStock(o, L) {
      const red = L.paint;
      const mat = paint(0.32, 0.2);
      const k = new Kit();
      // lower body: low nose, long hood, short tail with a lip
      k.add('paint', profile([['M', -2.08, 0.26], ['L', 2.0, 0.26], ['Q', 2.2, 0.28, 2.18, 0.45], ['Q', 2.12, 0.62, 1.7, 0.68], ['L', 0.8, 0.8], ['L', -1.15, 0.82], ['L', -1.95, 0.8], ['Q', -2.15, 0.78, -2.15, 0.6], ['Q', -2.16, 0.32, -2.08, 0.26]], 1.86, 0.12, 4), red);
      // cabin
      k.add('paint', profile([['M', -1.25, 0.78], ['L', 0.95, 0.78], ['Q', 0.55, 0.98, 0.2, 1.17], ['Q', 0.0, 1.2, -0.45, 1.18], ['Q', -0.7, 1.15, -1.25, 0.86]], 1.38, 0.1, 3), red);
      // side skirts, splitter, spoiler
      k.pair('matte', BOX(), '#1a1a1a', [0.9, 0.3, 0], [0, 0, 0], [0.12, 0.14, 2.9]);
      k.add('matte', BOX(), '#1a1a1a', [0, 0.27, 2.12], [0, 0, 0], [1.6, 0.06, 0.25]);
      if (!L.blower) {
        k.add('paint', BOX(), red, [0, 1.06, -1.95], [0.12, 0, 0], [1.7, 0.05, 0.36]);
        k.pair('paint', BOX(), red, [0.72, 0.94, -1.95], [0, 0, 0], [0.05, 0.26, 0.3]);
      } else { // a supercharger bursting out of the bonnet
        k.add('chrome', BOX(), '#bbb', [0, 0.92, 1.05], [0, 0, 0], [0.6, 0.28, 0.75]);
        for (const x of [-0.18, 0.18]) { k.add('chrome', CYL(12), '#ccc', [x, 1.22, 1.1], [0, 0, 0], [0.13, 0.35, 0.13]); k.add('matte', CYL(12), '#222', [x, 1.4, 1.1], [0, 0, 0], [0.1, 0.02, 0.1]); }
        for (let i = 0; i < 4; i++) k.pair('chrome', CYL(8), '#999', [0.97, 0.38, 0.6 - i * 0.18], [0, 0, Math.PI / 2], [0.05, 0.25, 0.05]);
      }
      // side windows and rear window (dark glass)
      k.pair('glass', BOX(), '#0d1726', [0.705, 0.98, -0.25], [0, 0, 0], [0.02, 0.26, 1.2]);
      k.add('glass', BOX(), '#0d1726', [0, 1.0, -0.98], [-0.95, 0, 0], [1.15, 0.02, 0.42]);
      // sticker headlights and tail lights
      k.pair('glow', SPH(10, 6), '#fff1b0', [0.62, 0.55, 2.07], [0, 0, 0], [0.2, 0.08, 0.05]);
      k.pair('glow', BOX(), '#ff2a2a', [0.66, 0.66, -2.15], [0, 0, 0], [0.32, 0.08, 0.02]);
      k.pair('chrome', CYL(8), '#aaa', [0.35, 0.33, -2.15], [Math.PI / 2, 0, 0], [0.06, 0.1, 0.06]);
      // wheel arches
      for (const z of [1.33, -1.33]) k.pair('matte', ARCH(), '#111', [0.82, 0.36, z], [0, 0, 0], [0.42, 0.34, 0.42]);
      const g = k.build({ paint: mat }, false);
      this.body.add(g); this.mats.push(mat);
      // decals
      this.sides(f => L.decal === 'bolt' ? dashDecal(f) : sideDecal(L.decal, L.num, f, L.decalCols), 2.6, 0.8, 0.945, 0.56, 0.05);
      if (L.num) this.decal(textDecal(L.num, '#111', null, 128, 128, 'bold 90px Impact, Arial Black, sans-serif'), 0.55, 0.55, [0, 1.235, -0.15], [-Math.PI / 2, 0, 0]);
      if (L.hood && !L.blower) this.decal(textDecal(L.hood, L.hoodCol || '#ffd23a', null, 256, 48, 'bold 30px Impact, Arial Black, sans-serif'), 1.0, 0.19, [0, 0.79, 1.35], [-Math.PI / 2 + 0.12, 0, 0]);
      this.addFace(L, red, [[0, 1.06, 0.63], 1.28, 0.8, 1.09], [[0, 0.45, 2.31], 1.2, 0.4, 0.3], o);
      for (const z of [1.33, -1.33]) for (const s of [-1, 1]) this.addWheel(L.blower && z < 0 ? 0.4 : 0.36, L.blower && z < 0 ? 0.38 : 0.3, s * 0.84, z, { color: L.rim || '#c8c8c8', mat: 'chrome', cap: red }, z > 0, 0.6);
      if (o.halloween && this.id !== 'dash') this.halloweenHat(1.22, -0.2);
      if (o.halloween && this.id === 'dash') { // little devil horns
        const hk = new Kit();
        hk.pair('paint', CONE(10), '#8a0a0a', [0.35, 1.37, 0.0], [0, 0, -0.35], [0.1, 0.38, 0.1]);
        this.body.add(hk.build({ paint: paint(0.3, 0.2) }, false));
      }
      Object.assign(this, { halfW: 0.95, halfL: 2.2, height: 1.2, lampY: 0.55, lampZ: 2.1 });
    }
    buildRusty(o) {
      const rt = rustTexture(); rt.repeat.set(0.8, 0.8);
      const rust = new T.MeshStandardMaterial({ map: rt, roughness: 0.8, metalness: 0.2, vertexColors: true });
      const k = new Kit(), brown = '#ffffff';
      // chassis and running boards
      k.add('matte', BOX(), '#2a2420', [0, 0.62, -0.1], [0, 0, 0], [1.2, 0.24, 4.7]);
      k.pair('rust', BOX(), brown, [0.82, 0.58, 0.05], [0, 0, 0], [0.32, 0.06, 1.1]);
      // long rounded hood
      k.add('rust', profile([['M', 0.42, 0.72], ['L', 0.42, 1.32], ['L', 1.75, 1.28], ['Q', 2.3, 1.24, 2.38, 0.98], ['L', 2.4, 0.72]], 1.1, 0.1, 3), brown);
      // fat pontoon front fenders over the wheels
      for (const s of [-1, 1]) k.add('rust', profile([['M', 0.45, 0.6], ['Q', 0.55, 1.18, 1.45, 1.12], ['Q', 2.3, 1.08, 2.4, 0.62], ['L', 2.1, 0.55], ['Q', 1.7, 0.98, 1.3, 0.98], ['Q', 0.9, 0.98, 0.75, 0.55]], 0.46, 0.08, 3), brown, [s * 0.76, 0, 0]);
      // grille and bumper
      k.add('chrome', BOX(), '#8e8a80', [0, 0.92, 2.42], [0, 0, 0], [0.95, 0.42, 0.06]);
      for (let i = -3; i <= 3; i++) k.add('matte', BOX(), '#2b2622', [i * 0.12, 0.92, 2.455], [0, 0, 0], [0.04, 0.38, 0.02]);
      k.add('rust', BOX(), brown, [0, 0.58, 2.48], [0, 0, 0], [2.0, 0.2, 0.18]);
      // cab with a rounded roof
      k.add('rust', profile([['M', -0.85, 0.72], ['L', 0.48, 0.72], ['L', 0.5, 1.34], ['L', 0.38, 1.92], ['Q', 0.3, 2.06, 0.05, 2.07], ['L', -0.6, 2.07], ['Q', -0.85, 2.06, -0.86, 1.85]], 1.72, 0.1, 3), brown);
      k.pair('glass', BOX(), '#0e1520', [0.87, 1.62, -0.18], [0, 0, 0], [0.02, 0.38, 0.75]);
      k.add('glass', BOX(), '#0e1520', [0, 1.65, -0.97], [0, 0, 0], [1.1, 0.36, 0.02]);
      // flat bed with toolboxes
      k.add('rust', BOX(), brown, [0, 0.84, -1.75], [0, 0, 0], [1.9, 0.18, 1.85]);
      k.pair('rust', BOX(), brown, [0.82, 1.05, -1.75], [0, 0, 0], [0.26, 0.3, 1.6]);
      k.pair('rust', ARCH(), brown, [0.82, 0.5, -1.65], [0, 0, 0], [0.5, 0.4, 0.5]);
      // tow boom: A-frame, arm, winch
      k.rod('matte', [0.62, 0.95, -1.35], [0, 2.35, -2.05], 0.06, '#2e2a26');
      k.rod('matte', [-0.62, 0.95, -1.35], [0, 2.35, -2.05], 0.06, '#2e2a26');
      k.rod('matte', [0, 0.95, -1.2], [0, 2.35, -2.05], 0.07, '#2e2a26');
      k.rod('matte', [0, 2.35, -2.05], [0, 2.15, -2.75], 0.07, '#2e2a26');
      k.add('matte', CYL(12), '#3a332c', [0, 1.1, -1.25], [0, 0, Math.PI / 2], [0.16, 0.5, 0.16]);
      k.add('chrome', CYL(10), '#777', [0, 2.15, -2.76], [0, 0, Math.PI / 2], [0.09, 0.14, 0.09]);
      // round headlights on the fenders (one works, one is out) and the roof beacon
      for (const s of [-1, 1]) k.add('rust', CYL(12), brown, [s * 0.78, 1.2, 1.9], [Math.PI / 2, 0, 0], [0.17, 0.2, 0.17]);
      k.add('glow', CYL(12), '#fff3c2', [0.78, 1.2, 2.01], [Math.PI / 2, 0, 0], [0.13, 0.02, 0.13]);
      k.add('matte', CYL(12), '#4a4a40', [-0.78, 1.2, 2.01], [Math.PI / 2, 0, 0], [0.13, 0.02, 0.13]);
      k.add('chrome', CYL(10), '#888', [0, 2.12, -0.35], [0, 0, 0], [0.12, 0.08, 0.12]);
      k.add('glow', SPH(10, 6), '#ffa31a', [0, 2.2, -0.35], [0, 0, 0], [0.11, 0.12, 0.11]);
      // side mirrors and a rusty exhaust stack
      k.pair('chrome', BOX(), '#999', [1.02, 1.55, 0.35], [0, 0, 0], [0.04, 0.2, 0.14]);
      k.rod('chrome', [0.92, 0.75, -0.85], [0.92, 2.0, -0.85], 0.05, '#6d5a48');
      // buck teeth hanging over the bumper
      k.pair('matte', BOX(), '#fbf6e2', [0.09, 0.62, 2.6], [0.12, 0, 0], [0.16, 0.24, 0.07]);
      const g = k.build({ rust }, false);
      this.body.add(g); this.mats.push(rust);
      // hook on a swinging cable
      const hook = this.hook = new T.Group(); hook.position.set(0, 2.15, -2.8);
      const hk = new Kit();
      hk.rod('matte', [0, 0, 0], [0, -0.95, 0], 0.02, '#222');
      hk.add('chrome', TORUS(Math.PI * 1.4, 0.28), '#8a8a8a', [0, -1.12, 0], [0, Math.PI / 2, -0.4], 0.16);
      hook.add(hk.build({}, false)); this.body.add(hook);
      // face: windshield eyes and a goofy grin above the teeth
      const face = this.face = new Face({ lid: '#93593a', iris: TT.CARS.rusty.iris, irisLight: '#d5e6a0', mouth: true, teeth: 'buck', night: o.night });
      this.body.add(facePlane(face.mat, [0, 1.65, 0.55], 1.5, 0.6, 0.2));
      this.body.add(facePlane(face.mmat, [0, 0.62, 2.58], 1.25, 0.42, 0));
      for (const [z, front] of [[1.62, true], [-1.6, false]]) for (const s of [-1, 1]) this.addWheel(0.42, 0.32, s * 0.86, z, { color: '#8d6a4e', mat: 'metal', cap: '#4a3a2a' }, front, 0.62);
      if (o.halloween) { // witch hat
        const hk2 = new Kit();
        hk2.add('matte', CYL(20), '#1b1426', [0, 2.12, -0.2], [0, 0, 0], [0.75, 0.04, 0.75]);
        hk2.add('matte', CONE(16), '#1b1426', [0, 2.65, -0.25], [0.18, 0, 0.1], [0.42, 1.05, 0.42]);
        hk2.add('matte', CYL(16, 0.92), '#7c3cc6', [0, 2.27, -0.21], [0.05, 0, 0.02], [0.4, 0.14, 0.4]);
        this.body.add(hk2.build({}, false));
      }
      Object.assign(this, { halfW: 1.05, halfL: 2.6, height: 2.1, lampY: 1.2, lampZ: 2.1 });
    }
    // ---- Sunny: a rounded blue sports coupe
    buildSports(o, L) {
      const c = L.paint, k = new Kit();
      k.add('paint', profile([['M', -2.1, 0.25], ['L', 1.95, 0.25], ['Q', 2.18, 0.27, 2.15, 0.45], ['Q', 2.08, 0.68, 1.55, 0.7], ['L', 0.8, 0.74], ['L', -1.55, 0.8], ['Q', -2.15, 0.8, -2.16, 0.55], ['Q', -2.17, 0.3, -2.1, 0.25]], 1.82, 0.14, 4), c);
      k.add('paint', profile([['M', -1.95, 0.74], ['L', 0.85, 0.74], ['Q', 0.45, 0.98, 0.05, 1.12], ['Q', -0.35, 1.17, -0.75, 1.08], ['Q', -1.55, 0.9, -1.95, 0.8]], 1.34, 0.1, 3), c);
      k.pair('paint', SPH(16, 10), c, [0.6, 0.72, 1.4], [0, 0, 0], [0.33, 0.17, 0.55]);
      k.pair('paint', SPH(16, 10), c, [0.62, 0.74, -1.3], [0, 0, 0], [0.35, 0.17, 0.62]);
      k.pair('glow', SPH(12, 8), '#fffbe0', [0.6, 0.76, 1.92], [0, 0, 0], [0.16, 0.13, 0.06]);
      k.add('glow', BOX(), '#ff3030', [0, 0.62, -2.18], [0, 0, 0], [1.3, 0.06, 0.02]);
      k.pair('glass', BOX(), '#0d1726', [0.68, 0.92, -0.35], [0, 0, 0], [0.02, 0.2, 1.1]);
      k.add('matte', BOX(), '#1a1a1a', [0, 0.27, 2.1], [0, 0, 0], [1.4, 0.06, 0.2]);
      for (const z of [1.3, -1.3]) k.pair('matte', ARCH(), '#111', [0.82, 0.35, z], [0, 0, 0], [0.41, 0.33, 0.41]);
      this.body.add(k.build({ paint: paint(0.25, 0.3) }, false));
      this.decal(textDecal('❧ ❦ ☙', '#1a3a6a', null, 256, 64, 'bold 46px Georgia, serif'), 0.8, 0.2, [0, 0.83, -1.72], [-Math.PI / 2 + 0.15, 0, 0]);
      this.addFace(L, c, [[0, 1.15, 0.46], 1.22, 0.62, 1.13], [[0, 0.46, 2.3], 1.15, 0.38, 0.35], o);
      for (const z of [1.3, -1.3]) for (const sd of [-1, 1]) this.addWheel(0.35, 0.28, sd * 0.83, z, { color: '#d8d8d8', mat: 'chrome', cap: '#333' }, z > 0, 0.62);
      if (o.halloween) this.halloweenHat(1.18, -0.3);
      Object.assign(this, { halfW: 0.92, halfL: 2.2, height: 1.2, lampY: 0.72, lampZ: 1.95 });
    }
    // ---- Pepe: a tiny round bubble car
    buildBubble(o, L) {
      const c = L.paint, k = new Kit();
      k.add('paint', profile([['M', -1.45, 0.22], ['L', 1.4, 0.22], ['Q', 1.56, 0.25, 1.53, 0.5], ['Q', 1.46, 0.76, 1.05, 0.8], ['L', -1.2, 0.82], ['Q', -1.5, 0.8, -1.51, 0.5], ['Q', -1.52, 0.25, -1.45, 0.22]], 1.5, 0.15, 4), c);
      k.add('paint', profile([['M', -1.25, 0.78], ['L', 0.95, 0.78], ['Q', 0.72, 1.25, 0.2, 1.42], ['Q', -0.6, 1.5, -1.0, 1.3], ['Q', -1.3, 1.12, -1.25, 0.78]], 1.3, 0.12, 3), c);
      k.pair('chrome', CYL(14), '#ccc', [0.46, 0.64, 1.55], [Math.PI / 2, 0, 0], [0.16, 0.06, 0.16]);
      k.pair('glow', CYL(14), '#fff6cc', [0.46, 0.64, 1.585], [Math.PI / 2, 0, 0], [0.12, 0.02, 0.12]);
      k.add('chrome', BOX(), '#cfcfcf', [0, 0.33, 1.63], [0, 0, 0], [1.3, 0.08, 0.08]);
      k.add('chrome', BOX(), '#cfcfcf', [0, 0.33, -1.63], [0, 0, 0], [1.3, 0.08, 0.08]);
      k.pair('glass', BOX(), '#0d1726', [0.66, 1.08, -0.2], [0, 0, 0], [0.02, 0.26, 1.0]);
      // a little luggage rack on the roof
      k.add('chrome', BOX(), '#bbb', [0, 1.56, -0.45], [0, 0, 0], [0.8, 0.03, 0.7]);
      k.add('matte', BOX(), '#7a4a2a', [0, 1.66, -0.45], [0, 0, 0], [0.6, 0.18, 0.45]);
      this.body.add(k.build({ paint: paint(0.3, 0.15) }, false));
      this.decal(canvasTex(96, 48, g => { g.fillStyle = '#1a9a3a'; g.fillRect(0, 0, 32, 48); g.fillStyle = '#fff'; g.fillRect(32, 0, 32, 48); g.fillStyle = '#d42020'; g.fillRect(64, 0, 32, 48); }), 0.42, 0.22, [0, 0.82, 1.15], [-Math.PI / 2 + 0.3, 0, 0]);
      this.addFace(L, c, [[0, 1.19, 0.65], 1.1, 0.9, 0.86], [[0, 0.46, 1.66], 1.0, 0.34, 0.3], o);
      for (const z of [0.98, -0.98]) for (const sd of [-1, 1]) this.addWheel(0.3, 0.22, sd * 0.66, z, { color: '#f2f2f2', mat: 'matte', cap: '#999' }, z > 0, 0.6);
      if (o.halloween) this.halloweenHat(1.5, -0.4);
      Object.assign(this, { halfW: 0.78, halfL: 1.55, height: 1.55, lampY: 0.64, lampZ: 1.55 });
    }
    // ---- Groovy: a flower-power camper van
    buildVan(o, L) {
      const k = new Kit(), lo = L.paint, hi = L.paint2;
      k.add('paint', profile([['M', -2.1, 0.3], ['L', 2.05, 0.3], ['Q', 2.22, 0.32, 2.22, 0.6], ['L', 2.22, 1.02], ['L', -2.12, 1.02], ['L', -2.12, 0.38]], 1.9, 0.12, 3), lo);
      k.add('paint', profile([['M', -2.1, 1.0], ['L', 2.2, 1.0], ['L', 2.12, 1.68], ['Q', 2.0, 2.0, 1.6, 2.02], ['L', -1.8, 2.02], ['Q', -2.1, 2.0, -2.12, 1.68]], 1.9, 0.12, 3), hi);
      k.pair('chrome', CYL(14), '#ddd', [0.66, 0.84, 2.33], [Math.PI / 2, 0, 0], [0.17, 0.05, 0.17]);
      k.pair('glow', CYL(14), '#fff6cc', [0.66, 0.84, 2.36], [Math.PI / 2, 0, 0], [0.13, 0.02, 0.13]);
      k.add('chrome', BOX(), '#ccc', [0, 0.4, 2.36], [0, 0, 0], [1.9, 0.1, 0.1]);
      k.pair('glass', BOX(), '#16243a', [0.965, 1.5, -0.35], [0, 0, 0], [0.02, 0.38, 2.7]);
      k.add('matte', BOX(), '#6a4a2a', [0, 2.12, -0.4], [0, 0, 0], [1.5, 0.06, 2.3]);
      k.add('matte', BOX(), '#c8762a', [0, 2.26, -0.6], [0, 0, 0], [0.9, 0.22, 0.8]);
      this.body.add(k.build({ paint: paint(0.55, 0.05) }, false));
      // flowers down the sides
      this.sides(f => flowerDecal(f), 3.4, 0.62, 0.965, 0.66, -0.1);
      this.addFace(L, hi, [[0, 1.43, 2.3], 1.55, 0.6, 0.12], [[0, 0.58, 2.36], 1.1, 0.36, 0], o);
      for (const z of [1.45, -1.45]) for (const sd of [-1, 1]) this.addWheel(0.38, 0.26, sd * 0.86, z, { color: '#f1e6c8', mat: 'matte', cap: '#888' }, z > 0, 0.6);
      if (o.halloween) this.halloweenHat(2.42, -0.6);
      Object.assign(this, { halfW: 1.0, halfL: 2.25, height: 2.1, lampY: 0.84, lampZ: 2.3 });
    }
    // ---- Nippy: a tiny forklift with headphones on
    buildForklift(o, L) {
      const c = L.paint, k = new Kit();
      k.add('paint', profile([['M', -1.0, 0.2], ['L', 0.85, 0.2], ['L', 0.9, 0.78], ['L', -1.0, 0.82]], 1.2, 0.12, 3), c);
      k.add('paint', profile([['M', -0.75, 0.76], ['L', 0.55, 0.76], ['L', 0.45, 1.45], ['Q', 0.4, 1.56, 0.25, 1.56], ['L', -0.6, 1.56], ['Q', -0.76, 1.5, -0.75, 1.35]], 1.05, 0.1, 3), c);
      k.add('matte', BOX(), '#333', [0, 0.45, -1.08], [0, 0, 0], [1.1, 0.45, 0.2]);
      for (const x of [-0.36, 0.36]) k.add('metal', BOX(), '#555', [x, 0.9, 1.0], [0, 0, 0], [0.08, 1.5, 0.1]);
      k.add('metal', BOX(), '#555', [0, 0.35, 1.06], [0, 0, 0], [0.8, 0.12, 0.1]);
      for (const x of [-0.26, 0.26]) k.add('metal', BOX(), '#777', [x, 0.12, 1.5], [0, 0, 0], [0.12, 0.05, 0.9]);
      // headphones
      k.add('matte', TORUS(Math.PI, 0.12), '#2a2a2a', [0, 1.4, -0.1], [0, 0, 0], [0.62, 0.5, 0.5]);
      k.pair('matte', CYL(14), '#2a2a2a', [0.6, 1.35, -0.1], [0, 0, Math.PI / 2], [0.2, 0.14, 0.2]);
      k.pair('paint', CYL(14), '#ffd23a', [0.68, 1.35, -0.1], [0, 0, Math.PI / 2], [0.14, 0.03, 0.14]);
      k.add('matte', CYL(8), '#2a2a2a', [0.55, 1.18, 0.25], [0.9, 0, 0], [0.02, 0.4, 0.02]);
      this.body.add(k.build({ paint: paint(0.35, 0.15) }, false));
      this.addFace(L, c, [[0, 1.12, 0.6], 0.9, 0.62, 0.14], [[0, 0.5, 0.97], 0.8, 0.3, 0], o);
      for (const z of [0.6, -0.65]) for (const sd of [-1, 1]) this.addWheel(0.22, 0.18, sd * 0.55, z, { color: '#ddd', mat: 'matte', cap: '#666' }, z < 0, 0.6);
      if (o.halloween) this.halloweenHat(1.6, -0.1);
      Object.assign(this, { halfW: 0.62, halfL: 1.15, height: 1.7, lampY: 0.9, lampZ: 0.9 });
    }
    // ---- Big Mo: a big red truck cab (no trailer)
    buildTruck(o, L) {
      const c = L.paint, k = new Kit();
      k.add('matte', BOX(), '#222', [0, 0.75, 0.3], [0, 0, 0], [1.2, 0.35, 5.6]);
      k.add('paint', profile([['M', -0.3, 0.9], ['L', 1.9, 0.9], ['L', 2.0, 2.4], ['Q', 1.95, 3.0, 1.4, 3.05], ['L', -0.3, 3.05]], 2.3, 0.12, 3), c);
      k.add('paint', profile([['M', 1.9, 0.9], ['L', 3.0, 0.9], ['Q', 3.12, 0.95, 3.12, 1.3], ['L', 3.06, 1.75], ['L', 1.9, 1.88]], 1.7, 0.1, 3), c);
      k.add('paint', BOX(), c, [0, 2.0, -1.0], [0, 0, 0], [2.3, 2.2, 1.4]);
      k.add('paint', BOX(), '#f2d25a', [0, 2.0, -0.3], [0, 0, 0], [2.32, 0.1, 2.75]);
      k.add('chrome', BOX(), '#c8c8c8', [0, 1.3, 3.15], [0, 0, 0], [1.3, 0.8, 0.05]);
      k.add('chrome', BOX(), '#c8c8c8', [0, 0.62, 3.22], [0, 0, 0], [2.3, 0.3, 0.22]);
      k.pair('chrome', CYL(12), '#d8d8d8', [1.05, 2.5, 1.6], [0, 0, 0], [0.1, 2.4, 0.1]);
      k.pair('chrome', CYL(14), '#d8d8d8', [1.05, 0.85, 0.6], [Math.PI / 2, 0, 0], [0.32, 1.1, 0.32]);
      k.pair('paint', ARCH(), c, [1.05, 0.55, 2.4], [0, 0, 0], [0.7, 0.45, 0.7]);
      k.pair('glow', BOX(), '#fff3c2', [0.75, 1.15, 3.13], [0, 0, 0], [0.32, 0.22, 0.03]);
      k.pair('glow', SPH(8, 6), '#ffb030', [0.95, 3.12, 1.55], [0, 0, 0], 0.07);
      k.pair('glass', BOX(), '#0d1726', [1.165, 2.2, 1.2], [0, 0, 0], [0.02, 0.6, 0.9]);
      k.add('matte', BOX(), '#333', [0, 1.02, -2.2], [0, 0, 0], [1.6, 0.12, 1.2]);
      this.body.add(k.build({ paint: paint(0.35, 0.25) }, false));
      this.sides(() => textDecal('BIG MO', '#f2d25a', null, 256, 64, 'bold 46px Impact, Arial Black, sans-serif'), 1.3, 0.32, 1.165, 1.45, -1.0);
      this.addFace(L, c, [[0, 2.27, 2.12], 2.0, 0.66, -0.07], [[0, 1.25, 3.18], 1.25, 0.5, 0], o);
      this.addWheel(0.55, 0.4, 1.05, 2.4, { color: '#ccc', mat: 'chrome', cap: c }, true, 0.55);
      this.addWheel(0.55, 0.4, -1.05, 2.4, { color: '#ccc', mat: 'chrome', cap: c }, true, 0.55);
      for (const z of [-0.95, -2.15]) for (const sd of [-1, 1]) this.addWheel(0.55, 0.55, sd * 0.95, z, { color: '#ccc', mat: 'chrome', cap: '#333' }, false, 0.55, 10);
      if (o.halloween) this.halloweenHat(3.1, 0.5);
      Object.assign(this, { halfW: 1.25, halfL: 2.95, height: 3.2, lampY: 1.15, lampZ: 3.1 });
    }
    // ---- Ace, Marshal, Longhorn: rounded 1950s cars
    buildVintage(o, L) {
      const c = L.paint, len = L.len || 1, k = new Kit();
      k.add('paint', profile([['M', -2.35, 0.3], ['L', 2.3, 0.3], ['Q', 2.45, 0.35, 2.42, 0.62], ['Q', 2.35, 0.86, 1.7, 0.88], ['L', 0.9, 0.92], ['L', -1.6, 0.92], ['Q', -2.4, 0.9, -2.42, 0.6], ['Q', -2.43, 0.35, -2.35, 0.3]], 1.95, 0.16, 4), c, [0, 0, 0], [0, 0, 0], [1, 1, len]);
      k.add('paint', profile([['M', -1.5, 0.88], ['L', 0.95, 0.88], ['Q', 0.6, 1.2, 0.2, 1.33], ['L', -0.7, 1.34], ['Q', -1.2, 1.3, -1.5, 0.95]], 1.5, 0.1, 3), L.roof || c);
      k.add('chrome', BOX(), '#d8d8d8', [0, 0.42, 2.62 * len], [0, 0, 0], [2.0, 0.14, 0.16]);
      k.add('chrome', BOX(), '#d8d8d8', [0, 0.42, -2.62 * len], [0, 0, 0], [2.0, 0.14, 0.16]);
      k.add('chrome', BOX(), '#cfcfcf', [0, 0.6, 2.6 * len], [0, 0, 0], [1.45, 0.24, 0.05]);
      k.pair('chrome', CYL(12), '#ddd', [0.7, 0.74, 2.55 * len], [Math.PI / 2, 0, 0], [0.14, 0.06, 0.14]);
      k.pair('glow', CYL(12), '#fff6cc', [0.7, 0.74, 2.58 * len], [Math.PI / 2, 0, 0], [0.1, 0.02, 0.1]);
      k.pair('glow', BOX(), '#ff3030', [0.75, 0.7, -2.6 * len], [0, 0, 0], [0.22, 0.12, 0.03]);
      k.pair('glass', BOX(), '#0d1726', [0.755, 1.1, -0.3], [0, 0, 0], [0.02, 0.2, 1.3]);
      k.pair('chrome', BOX(), '#ccc', [0.99, 0.6, 0], [0, 0, 0], [0.02, 0.04, 4.2 * len]);
      if (L.fins) k.pair('paint', BOX(), c, [0.85, 1.0, -2.1 * len], [0.3, 0, 0], [0.06, 0.32, 0.7]);
      if (L.siren) { k.add('chrome', BOX(), '#bbb', [0, 1.4, -0.2], [0, 0, 0], [0.3, 0.06, 0.2]); }
      this.body.add(k.build({ paint: paint(L.metal ? 0.22 : 0.28, L.metal ? 0.6 : 0.25) }, false));
      if (L.siren) { // a red light on the roof that flashes
        const fl = this.flasher = new T.Mesh(SPH(12, 8), new T.MeshBasicMaterial({ color: 0xff2020, toneMapped: false }));
        fl.scale.set(0.16, 0.14, 0.16); fl.position.set(0, 1.5, -0.2); this.body.add(fl);
        this.sides(() => canvasTex(256, 96, g => { g.fillStyle = '#f4f4f4'; g.beginPath(); g.ellipse(128, 48, 124, 44, 0, 0, Math.PI * 2); g.fill(); }), 2.0, 0.6, 0.985, 0.62, 0.1);
        this.sides(() => starDecal('#e8b830'), 0.42, 0.42, 0.99, 0.66, 0.35);
      }
      if (L.num) this.sides(() => roundel(L.num, '#ffffff', '#111', L.ring || '#c8a848'), 0.6, 0.6, 0.99, 0.64, 0.1);
      if (L.badge) this.decal(textDecal(L.badge, L.badgeCol || '#f2d25a', null, 256, 64, 'italic bold 42px Georgia, serif'), 0.9, 0.22, [0, 0.93, 1.6 * len], [-Math.PI / 2 + 0.1, 0, 0]);
      if (L.horns) { // longhorns on the grille
        const hk = new Kit();
        for (const sd of [-1, 1]) hk.add('bone', taperTube([[sd * 0.25, 0.95, 2.58 * len], [sd * 0.8, 1.03, 2.72 * len], [sd * 1.35, 1.15, 2.62 * len], [sd * 1.6, 1.35, 2.42 * len]], 0.08, 0.015, 14, 8), '#f0e6cc');
        this.body.add(hk.build({ bone: std({ roughness: 0.5 }) }, false));
      }
      this.addFace(L, L.roof || c, [[0, 1.31, 0.6], 1.34, 0.55, Math.atan2(0.75, 0.45)], [[0, 0.6, 2.63 * len], 1.3, 0.42, 0.15], o);
      for (const z of [1.5 * len, -1.45 * len]) for (const sd of [-1, 1]) {
        this.addWheel(0.38, 0.28, sd * 0.86, z, { color: '#f4f4f4', mat: 'matte', cap: '#bbb' }, z > 0, 0.72); // whitewalls
      }
      if (o.halloween) this.halloweenHat(1.4, -0.3);
      Object.assign(this, { halfW: 1.0, halfL: 2.6 * len, height: 1.4, lampY: 0.74, lampZ: 2.55 * len });
    }
    // s: { speed, steer, pitch, roll, hop, dt, accel, mood, lookX, lookY, flash }
    update(s, dt) {
      if (this.flasher) this.flasher.material.color.setHex(Math.floor(performance.now() / 300) % 2 ? 0xff2020 : 0x2050ff);
      if (s.mood === 'normal' && TT.CARS[this.id] && TT.CARS[this.id].mood) s.mood = TT.CARS[this.id].mood;
      this.spinAng += s.speed * dt;
      for (const W of this.wheels) {
        W.spin.rotation.x = this.spinAng / W.r;
        if (W.front) W.pivot.rotation.y = -s.steer * 0.45;
      }
      this.body.rotation.set(s.pitch || 0, 0, s.roll || 0);
      this.body.position.y = s.hop || 0;
      if (this.honk > 0) { // a little jump when the horn goes
        this.honk = Math.max(0, this.honk - dt); const k = Math.sin((1 - this.honk / 0.35) * Math.PI);
        this.body.scale.set(1 - k * 0.03, 1 + k * 0.09, 1 - k * 0.03);
      } else this.body.scale.set(1, 1, 1);
      if (this.hook) { // pendulum
        this.swingV += (-(s.accel || 0) * 0.06 - this.swing * 18) * dt; this.swingV *= Math.exp(-1.5 * dt);
        this.swing += this.swingV * dt * 10; this.hook.rotation.x = this.swing;
      }
      this.face.set(s.mood || 'normal', s.lookX || 0, s.lookY || 0, s.mouth);
      this.face.update(dt);
      if (this.tag) { this.tag.rotation.y += dt * 2; this.tag.position.y = this.height + 1.1 + Math.sin(this.spinAng * 0.1) * 0.05; }
      this.body.visible = !(s.flash && Math.floor(performance.now() / 80) % 2);
    }
    dispose() { this.face.dispose(); this.root.traverse(m => { if (m.isMesh) { m.geometry.dispose(); } }); }
  }

  // ================================================================ tractors (sleepy, a bit cow-like)
  const TRACTOR_COLORS = [
    { body: '#3f8f3a', trim: '#f2c230' }, { body: '#d9661f', trim: '#2d2d2d' }, { body: '#2f69b3', trim: '#e9e9e9' },
    { body: '#b52f2a', trim: '#efe2c4' }, { body: '#2d9a8c', trim: '#f2c230' }, { body: '#f4f1e8', trim: '#222222', cow: true },
    { body: '#7d9a2a', trim: '#f0e6c0' }, { body: '#c9a227', trim: '#3a3a3a' },
  ];
  let cowTex = null;
  class TractorRig {
    // o: { color index, ghost, shadows }
    constructor(ci, o = {}) {
      const C = TRACTOR_COLORS[ci % TRACTOR_COLORS.length];
      this.root = new T.Group();
      this.tip = new T.Group(); this.tip.position.set(0, 0.2, -1.35); this.root.add(this.tip);
      const inner = this.inner = new T.Group(); inner.position.set(0, -0.2, 1.35); this.tip.add(inner);
      const k = new Kit(), bodyKey = C.cow ? 'cow' : 'tractor';
      // hood and engine
      k.add('matte', BOX(), '#2a2622', [0, 0.5, 0.4], [0, 0, 0], [0.5, 0.3, 1.6]);
      k.add(bodyKey, profile([['M', -0.25, 0.55], ['L', 1.32, 0.55], ['L', 1.32, 1.05], ['Q', 1.3, 1.22, 1.1, 1.22], ['L', -0.25, 1.2]], 0.8, 0.08, 3), C.body);
      // muzzle with nostrils, eyes, little ear-lamps and a cowbell
      k.add('matte', SPH(14, 10), '#efd9c0', [0, 0.72, 1.4], [0, 0, 0], [0.32, 0.18, 0.14]);
      k.pair('matte', SPH(8, 6), '#3a2420', [0.1, 0.73, 1.52], [0, 0, 0], [0.045, 0.035, 0.02]);
      k.pair('matte', SPH(14, 10), '#ffffff', [0.19, 1.02, 1.32], [0, 0, 0], 0.15);
      k.pair('matte', SPH(10, 8), '#111111', [0.19, 1.0, 1.45], [0, 0, 0], [0.07, 0.075, 0.04]);
      k.pair(bodyKey, CONE(8), C.body, [0.48, 1.12, 1.1], [0, 0, -1.2], [0.08, 0.22, 0.12]);
      k.add('metal', CYL(10, 0.55), '#b88a2a', [0, 0.4, 1.42], [0, 0, 0], [0.09, 0.14, 0.09]);
      k.rod('matte', [0, 0.47, 1.42], [0, 0.6, 1.4], 0.015, '#3a2a1a');
      // exhaust stack
      k.rod('metal', [0.22, 1.2, 0.85], [0.22, 1.85, 0.85], 0.055, '#3c3c3c');
      k.add('metal', CYL(8), '#3c3c3c', [0.22, 1.88, 0.85], [0.3, 0, 0], [0.07, 0.03, 0.07]);
      // rear fenders, seat and steering wheel
      k.pair(bodyKey, ARCH(), C.body, [0.72, 0.72, -0.7], [0, 0, 0], [0.82, 0.46, 0.82]);
      k.pair(bodyKey, BOX(), C.body, [0.72, 1.53, -0.7], [0, 0, 0], [0.48, 0.05, 0.1]);
      k.add(bodyKey, BOX(), C.body, [0, 0.82, -0.7], [0, 0, 0], [0.98, 0.42, 1.1]);
      k.add('matte', BOX(), '#202020', [0, 1.1, -0.85], [0, 0, 0], [0.5, 0.1, 0.45]);
      k.add('matte', BOX(), '#202020', [0, 1.35, -1.08], [-0.2, 0, 0], [0.5, 0.45, 0.08]);
      k.rod('matte', [0, 1.1, -0.2], [0, 1.45, -0.42], 0.03, '#333');
      k.add('matte', TORUS(Math.PI * 2, 0.15), '#222', [0, 1.47, -0.44], [-1.1, 0, 0], 0.17);
      k.add('matte', BOX(), '#2a2622', [0, 0.45, -1.3], [0, 0, 0], [0.25, 0.12, 0.4]);
      const mats = {};
      if (o.ghost) {
        const gm = new T.MeshStandardMaterial({ color: 0xaaffcc, emissive: 0x2aff8a, emissiveIntensity: 0.55, transparent: true, opacity: 0.55, roughness: 0.4, depthWrite: false, side: T.DoubleSide });
        for (const key of ['matte', 'tractor', 'cow', 'metal', 'rubber', 'chrome']) mats[key] = gm;
        this.ghostMat = gm;
      } else if (C.cow) { cowTex = cowTex || cowTexture(); mats.cow = new T.MeshStandardMaterial({ map: cowTex, roughness: 0.6, vertexColors: true, side: T.DoubleSide }); }
      const body = k.build(mats, !!o.shadows && !o.ghost); inner.add(body);
      // eyelids (one mesh, hinged on the line through both eyes)
      const lk = new Kit();
      lk.pair(bodyKey, HEMI(14), C.body, [0.19, 0, 0], [Math.PI / 2, 0, 0], 0.162);
      this.lids = lk.build(mats, false); this.lids.position.set(0, 1.02, 1.32); inner.add(this.lids);
      // wheels
      const rw = new Kit(); for (const s of [-1, 1]) { rw.add('rubber', CYL(18), '#1c1c1e', [s * 0.74, 0, 0], [0, 0, Math.PI / 2], [0.72, 0.42, 0.72]); rw.add('matte', CYL(14), C.trim, [s * 0.75, 0, 0], [0, 0, Math.PI / 2], [0.42, 0.44, 0.42]); for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; rw.add('rubber', BOX(), '#1c1c1e', [s * 0.74, Math.sin(a) * 0.73, Math.cos(a) * 0.73], [a, 0, 0], [0.42, 0.1, 0.16]); } }
      this.rear = rw.build(mats, !!o.shadows && !o.ghost); this.rear.position.set(0, 0.72, -0.7); inner.add(this.rear);
      const fw = new Kit(); for (const s of [-1, 1]) { fw.add('rubber', CYL(14), '#1c1c1e', [s * 0.5, 0, 0], [0, 0, Math.PI / 2], [0.36, 0.22, 0.36]); fw.add('matte', CYL(12), C.trim, [s * 0.51, 0, 0], [0, 0, Math.PI / 2], [0.2, 0.24, 0.2]); }
      this.front = fw.build(mats, !!o.shadows && !o.ghost); this.front.position.set(0, 0.36, 1.05); inner.add(this.front);
      const blob = new T.Mesh(new T.CircleGeometry(1, 16), new T.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: o.ghost ? 0.15 : 0.32, depthWrite: false }));
      blob.rotation.x = -Math.PI / 2; blob.position.y = 0.04; blob.scale.set(1.1, 1.8, 1); this.root.add(blob); this.blob = blob;
      this.exhaust = new T.Vector3(0.22, 1.95, 0.85);
    }
    // eyes: 0 closed .. 1 wide open; tip: 0 upright .. 1 on its back
    pose(eyes, tip, bob, wheelSpin) {
      this.lids.rotation.x = -eyes * 1.45;
      this.lids.visible = eyes < 0.98;
      const a = tip * 2.35, k = clamp01(tip);
      this.tip.rotation.x = -a;
      this.tip.position.y = 0.2 + k * k * 0.58;
      this.inner.position.y = -0.2 + bob;
      this.rear.rotation.x = wheelSpin; this.front.rotation.x = wheelSpin * 2;
      this.blob.scale.set(1.1, 1.8 - tip * 0.2, 1); this.blob.position.z = -tip * 1.4;
    }
    exhaustWorld(out) { return this.inner.localToWorld(out.copy(this.exhaust)); }
  }

  // ================================================================ Thrasher the combine harvester
  class ThrasherRig {
    constructor(o = {}) {
      const hw = !!o.halloween;
      const red = hw ? '#2b1838' : '#c4221c', trim = hw ? '#ff7a1a' : '#f2d25a', bone = '#efe6cc';
      this.root = new T.Group(); this.body = new T.Group(); this.root.add(this.body);
      const k = new Kit();
      // main body, chassis, grain tank
      k.add('paint', profile([['M', -4.2, 1.0], ['L', 1.25, 1.0], ['L', 1.25, 3.4], ['L', -3.5, 3.4], ['Q', -4.2, 3.4, -4.2, 2.7]], 3.0, 0.12, 3), red);
      k.add('matte', BOX(), '#262321', [0, 0.85, -1.4], [0, 0, 0], [2.3, 0.5, 5.2]);
      k.add('paint', BOX(), red, [0, 3.85, -1.3], [0, 0, 0], [2.7, 0.9, 3.0]);
      k.add('matte', BOX(), '#2a2018', [0, 4.31, -1.3], [0, 0, 0], [2.4, 0.04, 2.7]);
      k.add('paint', BOX(), trim, [0, 4.3, -1.3], [0, 0, 0], [2.78, 0.08, 3.08]);
      k.pair('paint', BOX(), trim, [1.52, 2.0, -1.5], [0, 0, 0], [0.02, 0.18, 5.2]);
      // engine grille and tail lights at the back
      k.add('matte', BOX(), '#1d1d1d', [0, 2.4, -4.27], [0, 0, 0], [2.2, 1.2, 0.04]);
      for (let i = 0; i < 6; i++) k.add('chrome', BOX(), '#666', [0, 1.95 + i * 0.18, -4.3], [0, 0, 0], [2.1, 0.04, 0.02]);
      k.pair('glow', BOX(), '#ff2020', [1.25, 1.3, -4.25], [0, 0, 0], [0.25, 0.18, 0.04]);
      // cab: posts, roof, glass sides
      for (const [x, z] of [[1.05, 0.95], [-1.05, 0.95], [1.05, 2.45], [-1.05, 2.45]]) k.add('paint', BOX(), red, [x, 3.35, z], [0, 0, 0], [0.12, 2.1, 0.12]);
      k.add('paint', BOX(), red, [0, 4.45, 1.7], [0, 0, 0], [2.4, 0.18, 1.95]);
      k.add('paint', BOX(), trim, [0, 4.36, 1.7], [0, 0, 0], [2.42, 0.05, 1.97]);
      k.pair('glass', BOX(), '#0d1520', [1.06, 3.4, 1.7], [0, 0, 0], [0.03, 1.8, 1.4]);
      k.add('paint', BOX(), red, [0, 2.4, 1.7], [0, 0, 0], [2.2, 0.2, 1.6]);
      // feeder house down to the header
      k.add('paint', BOX(), red, [0, 1.55, 1.95], [0.5, 0, 0], [1.5, 1.0, 1.7]);
      // header: back wall, floor, end plates, stripe and the cutter-bar teeth
      k.add('paint', BOX(), red, [0, 1.05, 2.72], [0, 0, 0], [6.6, 1.3, 0.16]);
      k.add('paint', BOX(), trim, [0, 1.62, 2.82], [0, 0, 0], [6.62, 0.12, 0.04]);
      k.add('paint', BOX(), red, [0, 0.42, 3.5], [0, 0, 0], [6.6, 0.14, 1.65]);
      k.pair('paint', BOX(), red, [3.28, 0.95, 3.45], [0, 0, 0], [0.12, 1.15, 1.75]);
      for (let x = -3.15; x <= 3.16; x += 0.3) k.add('chrome', CONE(4), '#d8d8d8', [x, 0.42, 4.42], [Math.PI / 2, 0, 0], [0.09, 0.3, 0.05]);
      // bull horns curling up from the ends of the header
      this.horns = [];
      for (const s of [-1, 1]) {
        k.add('paint', CYL(12), red, [s * 3.3, 0.95, 4.1], [Math.PI / 2 - 0.5, 0, 0], [0.3, 0.3, 0.3]);
        // each horn on its own pivot at its root so it can spin like a drill when he charges
        const hk = new Kit(), px = s * 3.3, py = 0.9, pz = 4.15;
        hk.add('bone', taperTube([[0, 0, 0], [s * 0.35, 0.55, 0.7], [s * 0.65, 1.55, 0.9], [s * 0.5, 2.3, 0.5]], 0.26, 0.03, 18, 10), bone);
        const h = hk.build({ bone: std({ roughness: 0.5, metalness: 0 }) }, !!o.shadows); h.position.set(px, py, pz); this.horns.push(h);
      }
      // reel arms
      for (const s of [-1, 1]) k.rod('paint', [s * 2.95, 2.75, 1.3], [s * 2.95, 1.85, 3.75], 0.09, red);
      // exhaust stack and unloading auger
      k.rod('metal', [1.0, 3.4, -2.9], [1.0, 5.25, -2.9], 0.13, '#3a3a3a');
      k.add('metal', CYL(10), '#333', [1.0, 5.3, -2.9], [0.35, 0, 0], [0.18, 0.04, 0.18]);
      k.rod('paint', [-1.55, 3.95, -3.6], [-1.55, 3.95, 1.0], 0.2, hw ? '#3d2450' : '#d6d0c4');
      k.rod('paint', [-1.55, 3.95, 1.0], [-1.55, 3.3, 1.35], 0.16, hw ? '#3d2450' : '#d6d0c4');
      // headlights (dark until he wakes; the glow is a separate mesh)
      for (const x of [-0.75, -0.3, 0.3, 0.75]) k.add('chrome', BOX(), '#555', [x, 4.6, 2.55], [0, 0, 0], [0.32, 0.22, 0.12]);
      k.pair('chrome', CYL(12), '#555', [1.3, 2.9, 1.3], [Math.PI / 2, 0, 0], [0.2, 0.14, 0.2]);
      // snorting nostrils either side of the feeder
      k.pair('matte', CYL(10), '#111', [1.0, 2.15, 1.4], [Math.PI / 2, 0, 0], [0.13, 0.05, 0.13]);
      const pmat = paint(hw ? 0.35 : 0.45, hw ? 0.4 : 0.25);
      const g = k.build({ paint: pmat, bone: std({ roughness: 0.5, metalness: 0 }) }, !!o.shadows);
      this.body.add(g);
      for (const h of this.horns) this.body.add(h);
      this.hornSpin = 0;
      const lk = new Kit();
      for (const x of [-0.75, -0.3, 0.3, 0.75]) lk.add('glow', BOX(), '#fff5cf', [x, 4.6, 2.62], [0, 0, 0], [0.26, 0.16, 0.02]);
      lk.pair('glow', CYL(12), '#fff5cf', [1.3, 2.9, 1.38], [Math.PI / 2, 0, 0], [0.16, 0.02, 0.16]);
      this.lamps = lk.build({}, false); this.lamps.visible = false; this.body.add(this.lamps);
      // the reel (spins when he's awake)
      const rk = new Kit();
      rk.add('metal', CYL(10), '#444', [0, 0, 0], [0, 0, Math.PI / 2], [0.1, 6.0, 0.1]);
      for (let i = 0; i < 6; i++) {
        const a = i / 6 * Math.PI * 2, y = Math.sin(a) * 0.8, z = Math.cos(a) * 0.8;
        rk.add('paint', BOX(), hw ? '#ff7a1a' : '#e8b020', [0, y, z], [a, 0, 0], [5.9, 0.12, 0.08]);
        for (const x of [-2.8, 0, 2.8]) rk.rod('metal', [x, 0, 0], [x, y, z], 0.03, '#555');
        for (let x = -2.6; x <= 2.6; x += 0.65) rk.rod('metal', [x, y, z], [x, y * 1.25 - 0.1, z * 1.25], 0.015, '#888');
      }
      this.reel = rk.build({ paint: paint(0.5, 0.2) }, !!o.shadows); this.reel.position.set(0, 1.85, 3.75); this.body.add(this.reel);
      // wheels
      this.wheels = [];
      for (const s of [-1, 1]) {
        const F = wheel(1.15, 0.75, { color: hw ? '#ff7a1a' : '#f2d25a', mat: 'matte', cap: '#333' }, 0.55, 16); F.pivot.position.set(s * 1.9, 1.15, 0.55); this.body.add(F.pivot); this.wheels.push(F);
        const R = wheel(0.7, 0.45, { color: hw ? '#ff7a1a' : '#f2d25a', mat: 'matte', cap: '#333' }, 0.55, 10); R.pivot.position.set(s * 1.35, 0.7, -3.35); R.rear = true; this.body.add(R.pivot); this.wheels.push(R);
      }
      // face: big angry windshield eyes
      const face = this.face = new Face({ lid: red, iris: hw ? '#ff8a1a' : '#e3c21a', irisLight: hw ? '#ffe08a' : '#fff59a', mouth: true, teeth: 'jaw', night: true });
      face.mat.emissiveIntensity = hw ? 0.45 : 0.3;
      this.body.add(facePlane(face.mat, [0, 3.45, 2.53], 2.05, 1.6, -0.12));
      this.body.add(facePlane(face.mmat, [0, 2.2, 2.62], 1.7, 0.56, 0.3));
      if (hw) { // jack-o'-lantern on the cab roof
        const jk = new Kit();
        for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; jk.add('pumpkin', SPH(12, 10), '#e8661a', [Math.cos(a) * 0.32, 5.15, 1.7 + Math.sin(a) * 0.32], [0, -a, 0], [0.42, 0.55, 0.3]); }
        jk.add('matte', CYL(6, 0.7), '#3c5a1a', [0, 5.75, 1.7], [0.2, 0, 0.1], [0.08, 0.3, 0.08]);
        this.body.add(jk.build({ pumpkin: paint(0.6, 0) }, false));
        const jf = new T.Mesh(new T.PlaneGeometry(0.9, 0.7), new T.MeshBasicMaterial({ map: jackFace(), transparent: true, toneMapped: false }));
        jf.position.set(0, 5.15, 2.46); this.body.add(jf);
      }
      if (o.headlight) {
        const L = this.light = new T.SpotLight(hw ? 0xffb060 : 0xfff2d0, 0, 70, 0.55, 0.5, 1.3);
        L.position.set(0, 4.6, 2.7); L.target.position.set(0, 0, 18);
        this.body.add(L); this.body.add(L.target);
      }
      const blob = new T.Mesh(new T.CircleGeometry(1, 20), new T.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.4, depthWrite: false }));
      blob.rotation.x = -Math.PI / 2; blob.position.y = 0.05; blob.scale.set(3.4, 4.8, 1); blob.position.z = 0; this.root.add(blob);
      this.spinAng = 0; this.exhaust = new T.Vector3(1.0, 5.4, -2.9);
      this.nostrils = [new T.Vector3(1.0, 2.15, 1.5), new T.Vector3(-1.0, 2.15, 1.5)];
    }
    // s: { speed, reel, awake, mood, lookX, lookY, pitch, roll, steer }
    update(s, dt) {
      this.spinAng += s.speed * dt;
      for (const W of this.wheels) { W.spin.rotation.x = this.spinAng / W.r; if (W.rear) W.pivot.rotation.y = s.steer * 0.5; }
      this.reel.rotation.x -= (s.reel || 0) * dt;
      // horns spin while he charges, then settle back upright
      if (s.charge) this.hornSpin += dt * 16;
      else { const rest = Math.round(this.hornSpin / (Math.PI * 2)) * Math.PI * 2; this.hornSpin += (rest - this.hornSpin) * Math.min(1, dt * 5); }
      this.horns.forEach((h, i) => { h.rotation.z = (i ? 1 : -1) * this.hornSpin; });
      this.lamps.visible = !!s.awake;
      if (this.light) this.light.intensity = s.awake ? 2600 : 0;
      this.body.rotation.set(s.pitch || 0, 0, s.roll || 0);
      this.body.position.y = s.bounce || 0;
      this.face.set(s.mood || 'sleep', s.lookX || 0, s.lookY || 0, s.mouth);
      this.face.update(dt);
    }
    world(v, out) { return this.body.localToWorld(out.copy(v)); }
  }
  function jackFace() {
    return canvasTex(128, 96, (g, w, h) => {
      g.fillStyle = '#ffd040'; g.shadowColor = '#ff8a00'; g.shadowBlur = 12;
      g.beginPath(); g.moveTo(18, 38); g.lineTo(42, 16); g.lineTo(50, 42); g.closePath(); g.fill();
      g.beginPath(); g.moveTo(110, 38); g.lineTo(86, 16); g.lineTo(78, 42); g.closePath(); g.fill();
      g.beginPath(); g.moveTo(14, 56); g.lineTo(30, 66); g.lineTo(40, 58); g.lineTo(52, 70); g.lineTo(64, 60); g.lineTo(76, 70); g.lineTo(88, 58); g.lineTo(98, 66); g.lineTo(114, 56); g.quadraticCurveTo(64, 104, 14, 56); g.fill();
    });
  }

  const clamp01 = x => x < 0 ? 0 : x > 1 ? 1 : x;
  function init() { T = window.THREE; initMaterials(); }

  TT.models = {
    init, Kit, MAT, geo, BOX, CYL, SPH, HEMI, CONE, TORUS, ARCH, profile, taperTube, canvasTex, blob, textDecal, decalMesh, paint, jackFace,
    CarRig, TractorRig, ThrasherRig, Face, TRACTOR_COLORS,
  };
})();
