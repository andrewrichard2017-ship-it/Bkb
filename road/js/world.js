// Road Rumble: turns a Track into a Three.js scene. Sky, light, fog, the road, terrain and props are built in
// 240 m chunks streamed in ahead of the riders (and dropped behind them), so long tracks load quickly.
(() => {
  'use strict';
  const RR = window.RR, { clamp, lerp, smooth } = RR.math, N = RR.noise;
  const H = RR.ROAD_HALF, CHUNK = 240, AHEAD = 1700, BEHIND = 260;
  const COLS = [0, 1.2, 2.5, 4, 6, 8.5, 10.5, 13, 17, 23, 31, 42, 56, 75, 100, 130, 165, 205, 250];
  const TILE = 600, CELL = 60;
  let T;

  // ---- textures (made once) ----
  const TEX = {};
  function canvas(w, h, draw) { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); return c; }
  function makeTextures(renderer) {
    const aniso = renderer.capabilities.getMaxAnisotropy();
    const road = (city) => {
      const c = canvas(256, 1024, (x, w, h) => {
        x.fillStyle = city ? '#2f3034' : '#3b3c3f'; x.fillRect(0, 0, w, h);
        for (let i = 0; i < 9000; i++) { const v = 40 + Math.random() * 50 | 0; x.fillStyle = `rgba(${v},${v},${v + 3},${0.25 + Math.random() * 0.4})`; x.fillRect(Math.random() * w, Math.random() * h, 1 + Math.random() * 2, 1 + Math.random() * 2); }
        const W = 2 * H + 1.0, px = m => (m + W / 2) / W * w; // metres across -> pixels
        // worn tyre tracks
        for (const lc of RR.LANES) for (const o of [-0.55, 0.55]) { x.fillStyle = 'rgba(15,15,18,0.22)'; x.fillRect(px(lc + o) - 6, 0, 12, h); }
        for (let i = 0; i < 26; i++) { x.fillStyle = 'rgba(20,20,22,0.35)'; x.fillRect(Math.random() * w, Math.random() * h, 2 + Math.random() * 30, 1 + Math.random() * 2); } // patches & cracks
        x.fillStyle = '#e8e4d6'; x.fillRect(px(-H + 0.2) - 3, 0, 5, h); x.fillRect(px(H - 0.2) - 2, 0, 5, h);
        x.fillStyle = '#e8b420'; x.fillRect(px(-0.14) - 2, 0, 4, h); x.fillRect(px(0.14) - 2, 0, 4, h);
        x.fillStyle = '#e8e4d6';
        for (const lc of [-3.6, 3.6]) for (let y = 0; y < h; y += 512) x.fillRect(px(lc) - 2, y + 64, 4, 256);
      });
      const t = new T.CanvasTexture(c); t.wrapS = T.ClampToEdgeWrapping; t.wrapT = T.RepeatWrapping; t.anisotropy = aniso; t.colorSpace = T.SRGBColorSpace;
      return t;
    };
    TEX.road = road(false); TEX.roadCity = road(true);
    const facade = (lit) => {
      const c = canvas(512, 512, (x, w, h) => {
        x.fillStyle = lit ? '#000' : '#d8d8d8'; x.fillRect(0, 0, w, h);
        for (let r = 0; r < 8; r++) for (let q = 0; q < 8; q++) {
          const X = q * 64 + 12, Y = r * 64 + 14;
          if (lit) { if (Math.random() < 0.42) { x.fillStyle = Math.random() < 0.7 ? `hsl(${38 + Math.random() * 14},90%,${55 + Math.random() * 20}%)` : `hsl(${190 + Math.random() * 30},70%,70%)`; x.fillRect(X, Y, 40, 36); } }
          else { x.fillStyle = '#2a3440'; x.fillRect(X, Y, 40, 36); x.fillStyle = '#9aa4ae'; x.fillRect(X + 19, Y, 2, 36); }
        }
      });
      const t = new T.CanvasTexture(c); t.wrapS = t.wrapT = T.RepeatWrapping; t.colorSpace = T.SRGBColorSpace; t.anisotropy = aniso;
      return t;
    };
    TEX.facade = facade(false); TEX.facadeLit = facade(true);
    TEX.pool = new T.CanvasTexture(canvas(64, 64, (x) => { const g = x.createRadialGradient(32, 32, 0, 32, 32, 32); g.addColorStop(0, 'rgba(255,205,130,1)'); g.addColorStop(0.5, 'rgba(255,180,95,0.45)'); g.addColorStop(1, 'rgba(255,170,80,0)'); x.fillStyle = g; x.fillRect(0, 0, 64, 64); }));
    TEX.cloud = new T.CanvasTexture(canvas(256, 128, (x) => {
      for (let i = 0; i < 26; i++) { const cx = 40 + Math.random() * 176, cy = 54 + Math.random() * 34, r = 16 + Math.random() * 30; const g = x.createRadialGradient(cx, cy, 0, cx, cy, r); g.addColorStop(0, 'rgba(255,255,255,0.5)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, 256, 128); }
    }));
    TEX.glare = new T.CanvasTexture(canvas(128, 128, (x) => { const g = x.createRadialGradient(64, 64, 0, 64, 64, 64); g.addColorStop(0, 'rgba(255,250,235,1)'); g.addColorStop(0.15, 'rgba(255,230,190,0.5)'); g.addColorStop(1, 'rgba(255,200,150,0)'); x.fillStyle = g; x.fillRect(0, 0, 128, 128); }));
    TEX.water = (() => {
      const c = canvas(256, 256, (x, w, h) => {
        const img = x.createImageData(w, h);
        for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
          const n = N.fbm2(i / 32, j / 32, 5, 3) * 0.5 + N.fbm2(i / 9, j / 9, 9, 2) * 0.25; // tileable enough at this scale
          const nx = N.fbm2((i + 1) / 32, j / 32, 5, 3) * 0.5 - n * 0.6, ny = N.fbm2(i / 32, (j + 1) / 32, 5, 3) * 0.5 - n * 0.6;
          const q = (j * w + i) * 4; img.data[q] = 128 + nx * 900; img.data[q + 1] = 128 + ny * 900; img.data[q + 2] = 255; img.data[q + 3] = 255;
        }
        x.putImageData(img, 0, 0);
      });
      const t = new T.CanvasTexture(c); t.wrapS = t.wrapT = T.RepeatWrapping; return t;
    })();
  }
  const signTex = {};
  function textTexture(key, w, h, draw) {
    if (signTex[key]) return signTex[key];
    const t = new T.CanvasTexture(canvas(w, h, draw)); t.colorSpace = T.SRGBColorSpace; t.anisotropy = 4;
    return (signTex[key] = t);
  }

  // ---- sky ----
  function skyMaterial(th) {
    return new T.ShaderMaterial({
      side: T.BackSide, depthWrite: false, fog: false,
      uniforms: {
        top: { value: new T.Color(th.skyTop) }, hor: { value: new T.Color(th.skyHorizon) }, sun: { value: new T.Color(th.sun) },
        sunDir: { value: new T.Vector3(...th.sunDir).normalize() }, night: { value: th.night ? 1 : 0 },
      },
      vertexShader: `varying vec3 vDir; void main(){ vDir = normalize(position); vec4 p = modelViewMatrix * vec4(position,1.0); gl_Position = projectionMatrix * p; gl_Position.z = gl_Position.w; }`,
      fragmentShader: `uniform vec3 top; uniform vec3 hor; uniform vec3 sun; uniform vec3 sunDir; uniform float night; varying vec3 vDir;
        float h(vec3 p){ return fract(sin(dot(p, vec3(12.9898,78.233,45.164))) * 43758.5453); }
        void main(){
          vec3 d = normalize(vDir); float y = d.y;
          float t = pow(clamp(y, 0.0, 1.0), 0.55);
          vec3 c = mix(hor, top, t);
          c = mix(c, hor * 0.82, smoothstep(0.0, -0.25, y));
          float sd = max(dot(d, sunDir), 0.0);
          c += sun * (pow(sd, 900.0) * 6.0 + pow(sd, 18.0) * 0.35 + pow(sd, 4.0) * 0.12) * (1.0 - night * 0.6);
          if (night > 0.5) { vec3 q = floor(d * 380.0); float s = step(0.9975, h(q)) * smoothstep(0.05, 0.4, y); c += vec3(s) * 0.9; }
          gl_FragColor = vec4(c, 1.0);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`,
    });
  }

  class World {
    constructor(track, renderer, quality) {
      T = window.THREE;
      if (!TEX.road) makeTextures(renderer);
      this.track = track; this.th = track.theme; this.renderer = renderer; this.quality = quality;
      const th = this.th, scene = this.scene = new T.Scene();
      scene.fog = new T.Fog(th.fog, th.fogNear, th.fogFar);
      scene.background = new T.Color(th.fog);
      // sky + environment map for reflections
      this.sky = new T.Mesh(new T.SphereGeometry(1, 32, 16), skyMaterial(th));
      this.sky.scale.setScalar(th.fogFar * 1.6); this.sky.renderOrder = -10; this.sky.frustumCulled = false;
      scene.add(this.sky);
      const envScene = new T.Scene(); const envSky = new T.Mesh(new T.SphereGeometry(1, 32, 16), skyMaterial(th)); envSky.scale.setScalar(100); envScene.add(envSky);
      const ground = new T.Mesh(new T.CircleGeometry(100, 16), new T.MeshBasicMaterial({ color: new T.Color(th.hemiGround).multiplyScalar(0.6) })); ground.rotation.x = -Math.PI / 2; ground.position.y = -2; envScene.add(ground);
      const pm = new T.PMREMGenerator(renderer);
      this.env = pm.fromScene(envScene, 0.02).texture; pm.dispose();
      scene.environment = this.env;
      scene.environmentIntensity = th.night ? 0.35 : 0.8;
      // light
      this.hemi = new T.HemisphereLight(th.hemiSky, th.hemiGround, th.hemiI); scene.add(this.hemi);
      this.sun = new T.DirectionalLight(th.sun, th.sunI);
      this.sunDir = new T.Vector3(...th.sunDir).normalize();
      if (quality.shadows) {
        this.sun.castShadow = true;
        const sz = quality.shadows;
        this.sun.shadow.mapSize.set(sz, sz);
        const cam = this.sun.shadow.camera; cam.left = -45; cam.right = 45; cam.top = 45; cam.bottom = -45; cam.near = 1; cam.far = 400;
        this.sun.shadow.bias = -0.0004; this.sun.shadow.normalBias = 0.04;
      }
      scene.add(this.sun); scene.add(this.sun.target);
      // sun glare + clouds
      if (!th.night) {
        const gl = new T.Sprite(new T.SpriteMaterial({ map: TEX.glare, fog: false, depthWrite: false, blending: T.AdditiveBlending, transparent: true, opacity: 0.8 }));
        gl.scale.setScalar(th.fogFar * 0.5); this.glare = gl; scene.add(gl);
      }
      this.clouds = new T.Group(); scene.add(this.clouds);
      const rng = RR.rng(track.seed + 3);
      for (let i = 0; i < (th.night ? 6 : 26); i++) {
        const sp = new T.Sprite(new T.SpriteMaterial({ map: TEX.cloud, fog: false, depthWrite: false, transparent: true, opacity: th.night ? 0.12 : rng.range(0.45, 0.85), color: th.night ? 0x8080a0 : 0xffffff }));
        const s = rng.range(0, track.total), p = track.pos(s, rng.range(-1400, 1400), rng.range(260, 520), new T.Vector3());
        sp.position.copy(p); sp.scale.set(rng.range(400, 900), rng.range(120, 220), 1); this.clouds.add(sp);
      }
      // water
      if (th.sea) {
        TEX.water.repeat.set(220, 220);
        this.water = new T.Mesh(new T.PlaneGeometry(9000, 9000), new T.MeshStandardMaterial({ color: 0x1d5f86, roughness: 0.12, metalness: 0.1, normalMap: TEX.water, normalScale: new T.Vector2(0.35, 0.35) }));
        this.water.rotation.x = -Math.PI / 2; this.water.position.y = 0; this.water.receiveShadow = false; scene.add(this.water);
      }
      // materials
      const M = RR.models.MAT;
      this.mat = {
        road: new T.MeshStandardMaterial({ map: th.night ? TEX.roadCity : TEX.road, roughness: th.night ? 0.55 : 0.88, metalness: 0.0, envMapIntensity: th.night ? 0.6 : 0.3 }),
        terrain: new T.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, flatShading: true }),
        props: new T.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, flatShading: true }),
        smooth: M.paint, chrome: M.chrome, glow: M.glow,
        building: new T.MeshStandardMaterial({ vertexColors: true, map: TEX.facade, roughness: 0.8, emissive: th.night ? 0xffffff : 0x000000, emissiveMap: th.night ? TEX.facadeLit : null, emissiveIntensity: th.night ? 1.3 : 0 }),
        pool: new T.MeshBasicMaterial({ map: TEX.pool, transparent: true, depthWrite: false, blending: T.AdditiveBlending, fog: true, polygonOffset: true, polygonOffsetFactor: -2 }),
      };
      this.chunks = new Map(); this.tiles = new Map();
      this.buildArches();
      this.buildTraffic();
      this._v = new T.Vector3();
    }

    // ---- streaming ----
    // views: [{s, cam}] — makes sure chunks around every view exist, builds at most `budget` new ones
    stream(views, budget = 1) {
      const need = new Set(), order = [];
      for (const v of views) {
        const c0 = Math.max(0, Math.floor((v.s - BEHIND) / CHUNK)), c1 = Math.min(Math.floor(this.track.total / CHUNK), Math.floor((v.s + AHEAD) / CHUNK));
        for (let c = c0; c <= c1; c++) { if (!need.has(c)) { need.add(c); order.push({ c, d: Math.abs(c * CHUNK + CHUNK / 2 - v.s) }); } }
      }
      order.sort((a, b) => a.d - b.d);
      for (const { c } of order) { if (!this.chunks.has(c) && budget-- > 0) this.chunks.set(c, this.buildChunk(c)); }
      for (const [c, ch] of this.chunks) if (!need.has(c) && !views.some(v => Math.abs(c * CHUNK - v.s) < AHEAD + CHUNK * 2)) { this.disposeGroup(ch); this.chunks.delete(c); }
      // far terrain tiles around the cameras
      let tb = budget > 0 ? 1 : 0;
      const wantT = new Set();
      for (const v of views) {
        const p = v.cam ? v.cam.position : this.track.pos(v.s, 0, 0, this._v);
        const tx0 = Math.floor((p.x - 2100) / TILE), tx1 = Math.floor((p.x + 2100) / TILE), tz0 = Math.floor((p.z - 2100) / TILE), tz1 = Math.floor((p.z + 2100) / TILE);
        for (let tx = tx0; tx <= tx1; tx++) for (let tz = tz0; tz <= tz1; tz++) wantT.add(tx + ',' + tz);
      }
      for (const k of wantT) if (!this.tiles.has(k) && tb-- > 0) { const [tx, tz] = k.split(',').map(Number); this.tiles.set(k, this.buildTile(tx, tz)); }
      for (const [k, t] of this.tiles) if (!wantT.has(k)) { this.disposeGroup(t); this.tiles.delete(k); }
    }
    prebuild(s) { for (let i = 0; i < 14; i++) this.stream([{ s }], 3); }
    disposeGroup(g) { this.scene.remove(g); g.traverse(o => { if (o.isMesh && o.userData.own) o.geometry.dispose(); }); }

    // ---- one 240 m chunk: road, terrain ribbons, props ----
    buildChunk(c) {
      const tr = this.track, th = this.th, g = new T.Group(), DS = RR.Track.DS;
      const s0 = c * CHUNK, s1 = Math.min(tr.total, s0 + CHUNK);
      const own = (geom, mat, shadow, recv = true) => { const m = new T.Mesh(geom, mat); m.userData.own = true; m.castShadow = shadow; m.receiveShadow = recv; g.add(m); return m; };
      const p = new T.Vector3();
      // road ribbon
      {
        const rows = Math.round((s1 - s0) / DS) + 1, pos = [], uv = [], idx = [];
        for (let r = 0; r < rows; r++) {
          const s = s0 + r * DS;
          for (const d of [-H - 0.5, H + 0.5]) { tr.pos(s, d, 0.02, p); pos.push(p.x, p.y, p.z); uv.push(d < 0 ? 0 : 1, s / 16); }
          if (r) { const a = (r - 1) * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
        }
        const geom = new T.BufferGeometry(); geom.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); geom.setAttribute('uv', new T.Float32BufferAttribute(uv, 2)); geom.setIndex(idx); geom.computeVertexNormals();
        own(geom, this.mat.road, false);
      }
      // terrain ribbons (each side)
      {
        const step = 2 * DS, rows = Math.round((s1 - s0) / step) + 1, ncol = COLS.length;
        const pos = [], col = [], idx = []; const C = new T.Color(), C2 = new T.Color();
        const cg = new T.Color(th.grass), cg2 = new T.Color(th.grass2), cd = new T.Color(th.dirt), crk = new T.Color(th.rock);
        const csnow = new T.Color(0xf4f6fa), csand = new T.Color(0xd8c49a);
        let base = 0;
        for (const side of [-1, 1]) {
          for (let r = 0; r < rows; r++) {
            const s = Math.min(s0 + r * step, tr.total);
            for (let q = 0; q < ncol; q++) {
              const d = side * (H + COLS[q]);
              tr.pos(s, d, 0, p);
              const y = tr.ground(s, d, p.x, p.z);
              pos.push(p.x, y, p.z);
              this.terrainColour(C, s, d, p.x, y, p.z, COLS[q], cg, cg2, cd, crk, csnow, csand, C2);
              col.push(C.r, C.g, C.b);
              if (r && q) {
                const a = base + (r - 1) * ncol + q - 1, b = a + 1, cc = a + ncol, dd = cc + 1;
                if (side > 0) idx.push(a, b, cc, b, dd, cc); else idx.push(a, cc, b, b, cc, dd);
              }
            }
          }
          base += rows * ncol;
        }
        const geom = new T.BufferGeometry(); geom.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); geom.setAttribute('color', new T.Float32BufferAttribute(col, 3)); geom.setIndex(idx); geom.computeVertexNormals();
        own(geom, this.mat.terrain, false);
      }
      // props
      const flat = new RR.models.Merge(), smoothM = new RR.models.Merge(), chrome = new RR.models.Merge(), glow = new RR.models.Merge(), bld = new RR.models.Merge(true), pool = new RR.models.Merge(true);
      const B = { flat, smooth: smoothM, chrome, glow, bld, pool };
      for (const pr of tr.props) if (pr.s >= s0 && pr.s < s1) this.addProp(B, pr);
      for (const rl of tr.rails) if (rl.s1 > s0 && rl.s0 < s1) this.addRail(B, Math.max(rl.s0, s0), Math.min(rl.s1, s1), rl.side);
      if (!flat.empty) own(flat.build(), this.mat.props, true);
      if (!smoothM.empty) own(smoothM.build(), this.mat.smooth, true);
      if (!chrome.empty) own(chrome.build(), this.mat.chrome, true);
      if (!glow.empty) own(glow.build(), this.mat.glow, false, false);
      if (!bld.empty) own(bld.build(), this.mat.building, this.quality.shadows >= 2048);
      if (!pool.empty) own(pool.build(), this.mat.pool, false, false);
      // km boards
      for (const pr of tr.props) if (pr.kind === 'kmsign' && pr.s >= s0 && pr.s < s1) g.add(this.kmSign(pr));
      this.scene.add(g);
      return g;
    }
    terrainColour(C, s, d, x, y, z, e, cg, cg2, cd, crk, csnow, csand, C2) {
      const th = this.th, id = this.track.themeId;
      const n = N.noise2(x / 23, z / 23, 4) * 0.5 + N.noise2(x / 70, z / 70, 8) * 0.5;
      C.copy(cg).lerp(cg2, clamp(0.5 + n * 0.8, 0, 1));
      if (e < 2.4) C.copy(cd).multiplyScalar(0.8 + 0.2 * n);                  // gravel shoulder
      else if (e < 5) C.lerp(cd, 0.35);
      if (id === 'city') { C.setHex(e < 3.8 ? 0x8d8a86 : 0x6b6966).multiplyScalar(0.92 + 0.1 * n); return; }
      const yr = this.track.height(s);
      if (id === 'coast') {
        if (d > 0 && e > 5) C.copy(crk).multiplyScalar(0.85 + 0.25 * n);
        if (y < 2.5) C.copy(csand);
      }
      if (id === 'forest' && y - yr > 70 + n * 30) C.copy(crk).lerp(csnow, clamp((y - yr - 110 - n * 30) / 30, 0, 1));
      if (id === 'desert') {
        const band = Math.sin(y * 0.55 + n * 2) * 0.5 + 0.5;
        if (y - yr > 6 && e > 60) C.copy(crk).lerp(C2.setHex(0xd9925a), band * 0.6).multiplyScalar(0.85 + band * 0.2);
      }
      if (id === 'valley' && e > 30 && n > 0.25) C.lerp(C2.setHex(0x3f6b25), 0.4);
    }

    // world transform for a prop
    _place(pr, out) {
      const tr = this.track; const x = tr.pos(pr.s, pr.d, 0, out);
      x.y = tr.ground(pr.s, pr.d, x.x, x.z);
      return x;
    }
    addProp(B, pr) {
      const G = RR.models.geo, tr = this.track, p = this._place(pr, new T.Vector3()), sc = pr.sc, hd = tr.heading(pr.s);
      const yaw = -hd + pr.rot, rng = RR.rng(Math.floor(pr.s * 13 + pr.d * 7) + 11), J = 0.18;
      const at = (dx, dy, dz) => { // local offset rotated by yaw
        const c = Math.cos(yaw), s = Math.sin(yaw);
        return [p.x + dx * c + dz * s, p.y + dy, p.z - dx * s + dz * c];
      };
      switch (pr.kind) {
        case 'pine': {
          const h = 9 * sc, gc = [0x23472b, 0x2c5a30, 0x1d3d26, 0x335f2d][pr.v];
          B.flat.add(G.CYL(5), 0x4a3424, at(0, h * 0.12, 0), [0, 0, 0], [0.22 * sc, h * 0.25, 0.22 * sc]);
          for (let i = 0; i < 3; i++) B.flat.add(G.CONE(7), gc, at(0, h * (0.32 + i * 0.22), 0), [0, rng() * 3, 0], [h * (0.3 - i * 0.07), h * 0.42, h * (0.3 - i * 0.07)], J);
          break;
        }
        case 'oak': case 'poplar': {
          const h = (pr.kind === 'poplar' ? 11 : 6.5) * sc, gc = [0x4f7a2c, 0x5d8a35, 0x46702a, 0x6b8f3a][pr.v];
          B.flat.add(G.CYL(5), 0x5a4030, at(0, h * 0.25, 0), [0, 0, 0], [0.25 * sc, h * 0.5, 0.25 * sc]);
          if (pr.kind === 'poplar') B.flat.add(G.ICO(0), gc, at(0, h * 0.62, 0), [0, rng() * 3, 0], [1.4 * sc, h * 0.45, 1.4 * sc], J);
          else for (let i = 0; i < 3; i++) B.flat.add(G.ICO(0), gc, at(rng.range(-1.2, 1.2) * sc, h * (0.65 + rng() * 0.2), rng.range(-1.2, 1.2) * sc), [rng() * 3, rng() * 3, 0], h * 0.32, J);
          break;
        }
        case 'palm': {
          const h = 8 * sc; let x = 0, y = 0, z = 0; const lean = rng.range(0.05, 0.22), dir = rng() * 6.28;
          for (let i = 0; i < 5; i++) {
            const nx = x + Math.cos(dir) * lean * h * 0.2 * (1 + i * 0.3), ny = y + h * 0.2, nz = z + Math.sin(dir) * lean * h * 0.2 * (1 + i * 0.3);
            B.flat.rod(at(x, y, z), at(nx, ny, nz), (0.24 - i * 0.025) * sc, 0x8a6a48, 6); x = nx; y = ny; z = nz;
          }
          for (let f = 0; f < 7; f++) {
            const a = f / 7 * Math.PI * 2 + rng(), L = 3.2 * sc;
            B.flat.add(G.BOX(), [0x3f7a2a, 0x4d8c30, 0x356b24][f % 3], at(x + Math.cos(a) * L * 0.42, y - 0.55 * sc, z + Math.sin(a) * L * 0.42), [0.42, Math.PI / 2 - a + yaw, 0], [0.75 * sc, 0.06 * sc, L], 0.15);
          }
          break;
        }
        case 'cactus': {
          const h = 4.2 * sc, c = 0x4f7d3a;
          B.flat.add(G.CYL(7), c, at(0, h / 2, 0), [0, 0, 0], [0.28 * sc, h, 0.28 * sc]);
          B.flat.add(G.SPH(7, 5), c, at(0, h, 0), [0, 0, 0], 0.28 * sc);
          for (const sd of [-1, 1]) if (rng() < 0.8) {
            const ay = h * rng.range(0.35, 0.6), ah = h * rng.range(0.25, 0.4);
            B.flat.add(G.CYL(6), c, at(sd * 0.45 * sc, ay, 0), [0, 0, Math.PI / 2], [0.18 * sc, 0.6 * sc, 0.18 * sc]);
            B.flat.add(G.CYL(6), c, at(sd * 0.72 * sc, ay + ah / 2, 0), [0, 0, 0], [0.18 * sc, ah, 0.18 * sc]);
          }
          break;
        }
        case 'rock': case 'boulder': {
          const r = (pr.kind === 'boulder' ? 2.6 : 1.1) * sc;
          B.flat.add(G.ICO(0), this.th.rock, at(0, r * 0.35, 0), [rng() * 3, rng() * 3, rng() * 3], [r, r * rng.range(0.6, 0.9), r * rng.range(0.8, 1.2)], 0.25);
          break;
        }
        case 'bush': B.flat.add(G.ICO(0), this.track.themeId === 'desert' ? 0x8d7a4a : 0x4b6d2c, at(0, 0.5 * sc, 0), [rng() * 3, rng() * 3, 0], [1.2 * sc, 0.8 * sc, 1.1 * sc], 0.25); break;
        case 'pole': {
          B.flat.add(G.CYL(6), 0x5a4636, at(0, 4.5, 0), [0, 0, 0], [0.13, 9, 0.13]);
          B.flat.add(G.BOX(), 0x5a4636, at(0, 8.4, 0), [0, 0, 0], [2.2, 0.14, 0.14]);
          for (const sx of [-0.9, 0, 0.9]) B.flat.add(G.CYL(5), 0x6f7a80, at(sx, 8.55, 0), [0, 0, 0], [0.05, 0.16, 0.05]);
          break;
        }
        case 'lamp': {
          const sd = Math.sign(pr.d);
          B.chrome.add(G.CYL(8), 0x4a4e54, at(0, 3.6, 0), [0, 0, 0], [0.09, 7.2, 0.09]);
          const arm0 = at(0, 7.1, 0), arm1 = tr.pos(pr.s, pr.d - sd * 2.6, 0, new T.Vector3()); arm1.y = p.y + 7.25;
          B.chrome.rod(arm0, [arm1.x, arm1.y, arm1.z], 0.06, 0x4a4e54, 6);
          B.glow.add(G.BOX(), 0xffe3a8, [arm1.x, arm1.y - 0.12, arm1.z], [0, yaw, 0], [0.7, 0.1, 0.35]);
          // pool of light on the road
          const pc = tr.pos(pr.s, pr.d - sd * 3.4, 0.05, new T.Vector3());
          B.pool.add(QUAD(), 0xffffff, [pc.x, pc.y, pc.z], [-Math.PI / 2, 0, 0], [17, 17, 1]);
          break;
        }
        case 'chevron': {
          B.flat.add(G.BOX(), 0x9a9a9a, at(0, 0.6, 0), [0, 0, 0], [0.08, 1.2, 0.08]);
          B.flat.add(G.BOX(), 0x111111, at(0, 1.35, 0), [0, 0, 0], [0.9, 0.6, 0.05]);
          for (const k of [-0.22, 0.12]) {
            B.glow.add(G.BOX(), 0xffc400, at(k * (pr.rot ? -1 : 1), 1.48, -0.03), [0, 0, 0.75 * (pr.rot ? -1 : 1)], [0.08, 0.32, 0.02]);
            B.glow.add(G.BOX(), 0xffc400, at(k * (pr.rot ? -1 : 1), 1.22, -0.03), [0, 0, -0.75 * (pr.rot ? -1 : 1)], [0.08, 0.32, 0.02]);
          }
          break;
        }
        case 'mailbox': B.flat.add(G.BOX(), 0x5a4636, at(0, 0.55, 0), [0, 0, 0], [0.1, 1.1, 0.1]); B.smooth.add(G.BOX(), 0x30475e, at(0, 1.15, 0), [0, 0, 0], [0.3, 0.28, 0.5]); break;
        case 'hydrant': B.smooth.add(G.CYL(8), 0xc62828, at(0, 0.4, 0), [0, 0, 0], [0.16, 0.8, 0.16]); B.smooth.add(G.SPH(8, 6), 0xc62828, at(0, 0.8, 0), [0, 0, 0], 0.17); break;
        case 'house': case 'cabin': case 'barn': case 'shack': this.addHouse(B, pr, p, yaw, rng); break;
        case 'silo': B.smooth.add(G.CYL(14), 0xb8bcc0, [p.x, p.y + 7, p.z], [0, 0, 0], [2.6, 14, 2.6]); B.chrome.add(G.SPH(14, 8), 0xc0c4c8, [p.x, p.y + 14, p.z], [0, 0, 0], [2.6, 1.6, 2.6]); break;
        case 'vines': {
          for (let s = pr.s; s < pr.s + pr.sc; s += 8) {
            const q = tr.pos(s + 4, pr.d, 0, new T.Vector3()); q.y = tr.ground(s + 4, pr.d, q.x, q.z);
            B.flat.add(G.BOX(), [0x4e7a2a, 0x5b8a30][(s / 8 | 0) % 2], [q.x, q.y + 0.7, q.z], [0, -tr.heading(s + 4), 0], [0.9, 1.4, 7.6], 0.1);
          }
          break;
        }
        case 'fence': {
          B.flat.add(G.BOX(), 0x8a7458, at(0, 0.6, 0), [0, 0, 0], [0.12, 1.2, 0.12]);
          for (const y of [0.55, 1.05]) B.flat.add(G.BOX(), 0x9b8466, at(0, y, 2), [0, 0, 0], [0.06, 0.1, 4.05]);
          break;
        }
        case 'building': case 'tower': this.addBuilding(B, pr, p); break;
        case 'neon': {
          const c = [0xff2d95, 0x00e5ff, 0xffd400, 0x7cff4f][pr.v];
          const q = tr.pos(pr.s, pr.d, 0, new T.Vector3());
          B.glow.add(G.BOX(), c, [q.x, tr.height(pr.s) + pr.h, q.z], [0, -hd, 0], [0.12, 1.1, 4.5]);
          break;
        }
        case 'crossing': {
          for (let i = -8; i <= 8; i++) { const q = tr.pos(pr.s, i * 0.9, 0.035, new T.Vector3()); B.flat.add(G.BOX(), 0xd8d8d0, [q.x, q.y, q.z], [0, -hd, 0], [0.5, 0.02, 3.2]); }
          break;
        }
        case 'parked': {
          const parts = carPartsCached(pr.type);
          const m = new T.Matrix4().compose(new T.Vector3(p.x, tr.height(pr.s), p.z), new T.Quaternion().setFromEuler(new T.Euler(0, -hd + pr.rot, 0)), new T.Vector3(1, 1, 1));
          B.smooth.addMatrix(parts.body, pr.type === 'taxi' ? 0xffc107 : pr.color, m);
          B.flat.addMatrixKeep(parts.det, m);
          break;
        }
      }
    }
    addHouse(B, pr, p, yaw, rng) {
      const G = RR.models.geo, kind = pr.kind, sc = pr.sc;
      const at = (dx, dy, dz) => { const c = Math.cos(yaw), s = Math.sin(yaw); return [p.x + dx * c + dz * s, p.y + dy, p.z - dx * s + dz * c]; };
      const W = (kind === 'barn' ? 12 : kind === 'shack' ? 6 : 9) * sc, D = (kind === 'barn' ? 16 : kind === 'shack' ? 5 : 8) * sc, Hh = (kind === 'barn' ? 6 : kind === 'shack' ? 3 : 3.4) * sc;
      const wall = { house: [0xe8dcc8, 0xc9dbe6, 0xf2e2a8, 0xe3c4c4, 0xffffff][pr.v], cabin: 0x6b4a32, barn: 0xa3302a, shack: 0x8f9296 }[kind];
      const roof = { house: [0x6b3a2e, 0x3d4a5a, 0x5a5a5a, 0x7a4a32, 0x404040][pr.v], cabin: 0x2f4a32, barn: 0x4a4a4a, shack: 0x6f7377 }[kind];
      B.flat.add(G.BOX(), wall, at(0, Hh / 2 - 0.3, 0), [0, 0, 0], [W, Hh + 0.6, D]);
      if (kind === 'shack') B.flat.add(G.BOX(), roof, at(0, Hh + 0.3, 0), [0, 0, 0.12], [W + 0.6, 0.15, D + 0.6]);
      else {
        const rh = (kind === 'barn' ? 4 : 2.2) * sc;
        B.flat.add(G.CYL(3), roof, at(0, Hh + rh / 2 - 0.01, 0), [Math.PI / 2, 0, Math.PI / 2], [rh * 1.15, D + 0.6, (W / 2 + 0.4) * 1.1]);
      }
      const win = this.th.night ? 0xffd27a : 0x22303c, wg = this.th.night ? B.glow : B.flat;
      for (const dz of [-D * 0.25, D * 0.25]) wg.add(G.BOX(), win, at(W / 2 + 0.02, Hh * 0.55, dz), [0, 0, 0], [0.06, 1.0 * sc, 1.2 * sc]);
      B.flat.add(G.BOX(), kind === 'barn' ? 0xf2f2f2 : 0x4a3426, at(W / 2 + 0.02, (kind === 'barn' ? 2.2 : 1.0) * sc, 0), [0, 0, 0], [0.06, (kind === 'barn' ? 4.4 : 2.0) * sc, (kind === 'barn' ? 4 : 1.0) * sc]);
      if (kind === 'cabin' || kind === 'house') B.flat.add(G.BOX(), 0x6a5a50, at(-W * 0.25, Hh + 2.2 * sc, D * 0.25), [0, 0, 0], [0.6, 2.2, 0.6]);
    }
    addBuilding(B, pr, p) {
      const tr = this.track, hd = tr.heading(pr.s), w = pr.sc, h = pr.h, dep = pr.depth;
      const yaw = -hd + (pr.rot || 0), base = tr.height(pr.s) - 0.2;
      const col = new T.Color([0xc9b8a0, 0x9fa8b3, 0xb5a090, 0x8a8f99, 0xd8d0c0][pr.v]);
      const c = Math.cos(yaw), s = Math.sin(yaw), cx = p.x, cz = p.z;
      const corner = (dx, dz) => [cx + dx * c + dz * s, cz - dx * s + dz * c];
      const hw = dep / 2, hl = w / 2; // dep across (x), w along road (z)
      const pts = [corner(-hw, -hl), corner(hw, -hl), corner(hw, hl), corner(-hw, hl)];
      for (let i = 0; i < 4; i++) {
        const a = pts[i], b = pts[(i + 1) % 4], L = Math.hypot(b[0] - a[0], b[1] - a[1]);
        B.bld.quad([a[0], base, a[1]], [b[0], base, b[1]], [b[0], base + h, b[1]], [a[0], base + h, a[1]], col, [0, 0, L / 15, 0, L / 15, h / 22, 0, h / 22]);
      }
      B.bld.quad([pts[0][0], base + h, pts[0][1]], [pts[1][0], base + h, pts[1][1]], [pts[2][0], base + h, pts[2][1]], [pts[3][0], base + h, pts[3][1]], new T.Color(0x3a3a3e), [0.99, 0.99, 0.99, 0.99, 0.99, 0.99, 0.99, 0.99]);
    }
    addRail(B, s0, s1, side) {
      const G = RR.models.geo, tr = this.track, d = side * (H + 1.65);
      for (let s = s0; s < s1; s += 4) {
        const q = tr.pos(s + 2, d, 0, new T.Vector3()), hd = tr.heading(s + 2), sl = tr.slope(s + 2);
        B.chrome.add(G.BOX(), 0xb9bec4, [q.x, q.y + 0.62, q.z], [Math.atan(sl), -hd, 0], [0.06, 0.32, 4.02]);
        const pp = tr.pos(s, d + side * 0.12, 0, new T.Vector3());
        B.flat.add(G.BOX(), 0x6d7076, [pp.x, pp.y + 0.38, pp.z], [0, -hd, 0], [0.12, 0.8, 0.12]);
      }
    }
    kmSign(pr) {
      const km = pr.v, tex = textTexture('km' + km, 256, 128, (x, w, h) => {
        x.fillStyle = '#106b3a'; x.fillRect(0, 0, w, h); x.strokeStyle = '#fff'; x.lineWidth = 6; x.strokeRect(6, 6, w - 12, h - 12);
        x.fillStyle = '#fff'; x.font = 'bold 40px Arial'; x.textAlign = 'center'; x.fillText('FINISH', w / 2, 52); x.font = 'bold 46px Arial'; x.fillText(km + ' KM', w / 2, 104);
      });
      const g = new T.Group(), tr = this.track, p = this._place(pr, new T.Vector3());
      const board = new T.Mesh(new T.PlaneGeometry(3.2, 1.6), new T.MeshStandardMaterial({ map: tex, roughness: 0.6 }));
      board.position.set(0, 3.1, 0); g.add(board);
      for (const x of [-1.2, 1.2]) { const post = new T.Mesh(new T.BoxGeometry(0.12, 3.2, 0.12), RR.models.MAT.chrome); post.position.set(x, 1.6, 0.05); g.add(post); }
      g.position.copy(p); g.rotation.y = -tr.heading(pr.s) - 0.25;
      return g;
    }
    buildArches() {
      const tr = this.track;
      const banner = (label, check) => textTexture('arch' + label, 512, 128, (x, w, h) => {
        if (check) { for (let i = 0; i < 32; i++) for (let j = 0; j < 8; j++) { x.fillStyle = (i + j) % 2 ? '#111' : '#f4f4f4'; x.fillRect(i * 16, j * 16, 16, 16); } x.fillStyle = 'rgba(0,0,0,0.55)'; x.fillRect(0, 26, w, 76); }
        else { const g = x.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#d32f2f'); g.addColorStop(1, '#7f1010'); x.fillStyle = g; x.fillRect(0, 0, w, h); }
        x.fillStyle = check ? '#ffd600' : '#fff'; x.font = 'bold 76px Impact, Arial Black, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
        const tw = x.measureText(label).width; if (tw > w * 0.86) x.font = `bold ${Math.floor(76 * w * 0.86 / tw)}px Impact, Arial Black, sans-serif`;
        x.fillText(label, w / 2, h / 2 + 4);
      });
      for (const [s, label, check] of [[tr.startS, 'ROAD RUMBLE', false], [tr.finishS, 'FINISH', true]]) {
        const g = new T.Group(), p = tr.pos(s, 0, 0, new T.Vector3());
        for (const sx of [-1, 1]) { const post = new T.Mesh(new T.BoxGeometry(0.5, 7, 0.5), RR.models.MAT.chrome); post.position.set(sx * (H + 1.2), 3.5, 0); post.castShadow = true; g.add(post); }
        const mat = new T.MeshStandardMaterial({ map: banner(label, check), roughness: 0.7, side: T.DoubleSide });
        const b = new T.Mesh(new T.BoxGeometry(2 * H + 2.9, 1.6, 0.25), [RR.models.MAT.matte, RR.models.MAT.matte, RR.models.MAT.matte, RR.models.MAT.matte, mat, mat]);
        b.position.set(0, 6.6, 0); b.castShadow = true; g.add(b);
        // line on the road
        const line = new T.Mesh(new T.PlaneGeometry(2 * H, 1.2), new T.MeshBasicMaterial({ map: banner('', true), polygonOffset: true, polygonOffsetFactor: -3 }));
        line.rotation.x = -Math.PI / 2; line.position.y = 0.05; g.add(line);
        g.position.copy(p); g.rotation.y = -tr.heading(s);
        this.scene.add(g);
      }
    }

    // ---- far terrain tiles (world aligned) ----
    buildTile(tx, tz) {
      const tr = this.track, n = TILE / CELL + 1, x0 = tx * TILE, z0 = tz * TILE;
      const pos = new Float32Array(n * n * 3), col = new Float32Array(n * n * 3), minE = new Float32Array(n * n).fill(1e9), sgn = new Float32Array(n * n), rY = new Float32Array(n * n);
      // nearest road distance for each vertex (sweep road samples near this tile)
      const R = 300, DS = RR.Track.DS;
      for (let i = 0; i < tr.n; i += 3) {
        const sx = tr.x[i], sz = tr.z[i];
        if (sx < x0 - R || sx > x0 + TILE + R || sz < z0 - R || sz > z0 + TILE + R) continue;
        const c = Math.cos(tr.hd[i]), s = Math.sin(tr.hd[i]);
        const i0 = Math.max(0, Math.floor((sx - R - x0) / CELL)), i1 = Math.min(n - 1, Math.ceil((sx + R - x0) / CELL));
        const j0 = Math.max(0, Math.floor((sz - R - z0) / CELL)), j1 = Math.min(n - 1, Math.ceil((sz + R - z0) / CELL));
        for (let j = j0; j <= j1; j++) for (let ii = i0; ii <= i1; ii++) {
          const dx = x0 + ii * CELL - sx, dz = z0 + j * CELL - sz, dd = Math.hypot(dx, dz), q = j * n + ii;
          if (dd < minE[q]) { minE[q] = dd; sgn[q] = dx * c + dz * s; rY[q] = tr.y[i]; }
        }
      }
      const C = new T.Color(), C2 = new T.Color(), th = this.th;
      const cg = new T.Color(th.grass), cg2 = new T.Color(th.grass2), cd = new T.Color(th.dirt), crk = new T.Color(th.rock), csnow = new T.Color(0xf4f6fa), csand = new T.Color(0xd8c49a);
      for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
        const q = j * n + i, x = x0 + i * CELL, z = z0 + j * CELL;
        const d = minE[q] < 1e8 ? Math.sign(sgn[q] || 1) * minE[q] : (tr.themeId === 'coast' ? 3000 : 3000);
        let y = tr.natural(x, z, d);
        if (minE[q] < 245) y = Math.min(y, minE[q] < 125 ? rY[q] : y) - 15;
        pos[q * 3] = x; pos[q * 3 + 1] = y; pos[q * 3 + 2] = z;
        this.terrainColour(C, 0, d, x, y, z, Math.abs(d) - H, cg, cg2, cd, crk, csnow, csand, C2);
        col[q * 3] = C.r; col[q * 3 + 1] = C.g; col[q * 3 + 2] = C.b;
      }
      const idx = [];
      for (let j = 0; j < n - 1; j++) for (let i = 0; i < n - 1; i++) { const a = j * n + i, b = a + 1, c2 = a + n, d2 = c2 + 1; idx.push(a, c2, b, b, c2, d2); }
      const geom = new T.BufferGeometry(); geom.setAttribute('position', new T.BufferAttribute(pos, 3)); geom.setAttribute('color', new T.BufferAttribute(col, 3)); geom.setIndex(idx); geom.computeVertexNormals();
      const m = new T.Mesh(geom, this.mat.terrain); m.userData.own = true; m.receiveShadow = false;
      const g = new T.Group(); g.add(m); this.scene.add(g);
      return g;
    }

    // ---- traffic ----
    buildTraffic() {
      this.carMeshes = {};
      const types = new Set(this.track.cars.map(c => c.type));
      for (const type of types) {
        const parts = carPartsCached(type), cap = 48;
        const body = new T.InstancedMesh(parts.body, new T.MeshStandardMaterial({ roughness: 0.25, metalness: 0.35, vertexColors: true }), cap);
        const det = new T.InstancedMesh(parts.det, RR.models.MAT.matte, cap);
        const lit = new T.InstancedMesh(parts.lit, RR.models.MAT.glow, cap);
        for (const m of [body, det, lit]) { m.frustumCulled = false; m.castShadow = m !== lit; m.count = 0; this.scene.add(m); }
        body.setColorAt(0, new T.Color(1, 1, 1));
        this.carMeshes[type] = { body, det, lit, n: 0 };
      }
      this._m = new T.Matrix4(); this._q = new T.Quaternion(); this._e = new T.Euler(0, 0, 0, 'YXZ'); this._s = new T.Vector3(1, 1, 1); this._c = new T.Color();
    }
    updateTraffic(views) {
      const tr = this.track;
      for (const k in this.carMeshes) this.carMeshes[k].n = 0;
      const p = this._v;
      for (const c of tr.cars) {
        let near = false;
        for (const v of views) if (c.s > v.s - 260 && c.s < v.s + 1100) { near = true; break; }
        if (!near) continue;
        const cm = this.carMeshes[c.type]; if (cm.n >= 48) continue;
        tr.pos(c.s, c.d, 0, p);
        const back = c.v < 0, sl = tr.slope(c.s);
        this._e.set(Math.atan(sl) * (back ? -1 : 1), -tr.heading(c.s) + (back ? Math.PI : 0), 0, 'YXZ');
        this._m.compose(p, this._q.setFromEuler(this._e), this._s);
        cm.body.setMatrixAt(cm.n, this._m); cm.det.setMatrixAt(cm.n, this._m); cm.lit.setMatrixAt(cm.n, this._m);
        cm.body.setColorAt(cm.n, this._c.set(c.color));
        cm.n++;
      }
      for (const k in this.carMeshes) {
        const cm = this.carMeshes[k];
        for (const m of [cm.body, cm.det, cm.lit]) { m.count = cm.n; m.instanceMatrix.needsUpdate = true; }
        if (cm.body.instanceColor) cm.body.instanceColor.needsUpdate = true;
      }
    }

    // per view, before rendering: sky, sun and shadow box follow the camera / focus point
    frame(cam, focus, t) {
      this.sky.position.copy(cam.position);
      if (this.glare) this.glare.position.copy(cam.position).addScaledVector(this.sunDir, this.th.fogFar * 1.4);
      this.sun.position.copy(focus).addScaledVector(this.sunDir, 150);
      this.sun.target.position.copy(focus);
      if (this.water) { this.water.position.x = Math.round(cam.position.x / 40) * 40; this.water.position.z = Math.round(cam.position.z / 40) * 40; TEX.water.offset.set(t * 0.004, t * 0.0025); }
    }
    dispose() {
      for (const [, ch] of this.chunks) this.disposeGroup(ch);
      for (const [, t] of this.tiles) this.disposeGroup(t);
      this.env.dispose();
      this.scene.traverse(o => { if (o.isInstancedMesh) o.dispose(); });
    }
  }

  // geometry helpers that need THREE at call time
  let quadGeo = null;
  function QUAD() { return quadGeo || (quadGeo = new T.PlaneGeometry(1, 1).toNonIndexed()); }
  const carCache = {};
  function carPartsCached(type) { return carCache[type] || (carCache[type] = RR.models.carParts(type)); }

  // Merge extras used by the world: raw quads (with UVs) and adding a geometry keeping its own vertex colours.
  const install = () => {
    const P = RR.models.Merge.prototype;
    if (P.quad) return;
    P.quad = function (a, b, c, d, col, uv) {
      const e1 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], e2 = [d[0] - a[0], d[1] - a[1], d[2] - a[2]];
      let nx = e1[1] * e2[2] - e1[2] * e2[1], ny = e1[2] * e2[0] - e1[0] * e2[2], nz = e1[0] * e2[1] - e1[1] * e2[0];
      const L = Math.hypot(nx, ny, nz) || 1; nx /= L; ny /= L; nz /= L;
      const V = [a, b, c, a, c, d], U = [0, 1, 2, 0, 2, 3];
      for (let i = 0; i < 6; i++) {
        this.p.push(V[i][0], V[i][1], V[i][2]); this.n.push(nx, ny, nz); this.c.push(col.r, col.g, col.b);
        if (this.uv) this.uv.push(uv[U[i] * 2], uv[U[i] * 2 + 1]);
      }
    };
    P.addMatrixKeep = function (g, m) {
      const pos = g.attributes.position, nor = g.attributes.normal, col = g.attributes.color, v = this._v;
      this._nm.getNormalMatrix(m);
      for (let i = 0; i < pos.count; i++) {
        v.fromBufferAttribute(pos, i).applyMatrix4(m); this.p.push(v.x, v.y, v.z);
        v.fromBufferAttribute(nor, i).applyMatrix3(this._nm).normalize(); this.n.push(v.x, v.y, v.z);
        this.c.push(col.getX(i), col.getY(i), col.getZ(i));
        if (this.uv) this.uv.push(0, 0);
      }
    };
  };
  RR.World = World;
  RR.worldInstall = install;
})();
