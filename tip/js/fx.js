// Tractor Tippin': particles. Dust, smoke and splats (soft) and sparks/stars (glowing) as pooled point
// clouds, plus floating "Z"s over sleeping tractors and dizzy stars.
(() => {
  'use strict';
  const TT = window.TT;
  let T;

  class Pool {
    constructor(scene, max, additive) {
      this.max = max; this.n = 0;
      this.p = new Float32Array(max * 3); this.v = new Float32Array(max * 3); this.c = new Float32Array(max * 3);
      this.life = new Float32Array(max); this.age = new Float32Array(max); this.size = new Float32Array(max); this.grav = new Float32Array(max); this.drag = new Float32Array(max); this.grow = new Float32Array(max);
      this.a = new Float32Array(max); this.sz = new Float32Array(max);
      const g = this.geo = new T.BufferGeometry();
      g.setAttribute('position', new T.BufferAttribute(this.p, 3).setUsage(T.DynamicDrawUsage));
      g.setAttribute('color', new T.BufferAttribute(this.c, 3).setUsage(T.DynamicDrawUsage));
      g.setAttribute('alpha', new T.BufferAttribute(this.a, 1).setUsage(T.DynamicDrawUsage));
      g.setAttribute('size', new T.BufferAttribute(this.sz, 1).setUsage(T.DynamicDrawUsage));
      this.mat = new T.ShaderMaterial({
        transparent: true, depthWrite: false, blending: additive ? T.AdditiveBlending : T.NormalBlending, vertexColors: true,
        uniforms: { scale: { value: 600 } },
        vertexShader: `attribute float alpha; attribute float size; varying float vA; varying vec3 vC; uniform float scale;
          void main(){ vA = alpha; vC = color; vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_PointSize = size * scale / max(0.5, -mv.z); gl_Position = projectionMatrix * mv; }`,
        fragmentShader: `varying float vA; varying vec3 vC; void main(){ vec2 q = gl_PointCoord - 0.5; float d = dot(q, q) * 4.0; if (d > 1.0) discard; gl_FragColor = vec4(vC, vA * (1.0 - d * d)); }`,
      });
      this.points = new T.Points(g, this.mat); this.points.frustumCulled = false; this.points.renderOrder = 5;
      scene.add(this.points);
    }
    spawn(x, y, z, vx, vy, vz, life, size, r, g, b, grav = 0, drag = 0, grow = 1.5) {
      const i = this.n < this.max ? this.n++ : (Math.random() * this.max) | 0;
      this.p[i * 3] = x; this.p[i * 3 + 1] = y; this.p[i * 3 + 2] = z;
      this.v[i * 3] = vx; this.v[i * 3 + 1] = vy; this.v[i * 3 + 2] = vz;
      this.c[i * 3] = r; this.c[i * 3 + 1] = g; this.c[i * 3 + 2] = b;
      this.life[i] = life; this.age[i] = 0; this.size[i] = size; this.grav[i] = grav; this.drag[i] = drag; this.grow[i] = grow;
    }
    update(dt) {
      let n = this.n;
      for (let i = 0; i < n; i++) {
        this.age[i] += dt;
        if (this.age[i] >= this.life[i]) {
          n--;
          for (const arr of [this.p, this.v, this.c]) { arr[i * 3] = arr[n * 3]; arr[i * 3 + 1] = arr[n * 3 + 1]; arr[i * 3 + 2] = arr[n * 3 + 2]; }
          for (const arr of [this.life, this.age, this.size, this.grav, this.drag, this.grow]) arr[i] = arr[n];
          i--; continue;
        }
        const k = Math.exp(-this.drag[i] * dt);
        this.v[i * 3] *= k; this.v[i * 3 + 2] *= k; this.v[i * 3 + 1] = this.v[i * 3 + 1] * k - this.grav[i] * dt;
        this.p[i * 3] += this.v[i * 3] * dt; this.p[i * 3 + 1] += this.v[i * 3 + 1] * dt; this.p[i * 3 + 2] += this.v[i * 3 + 2] * dt;
        const f = this.age[i] / this.life[i];
        this.a[i] = f < 0.1 ? f * 10 : 1 - (f - 0.1) / 0.9;
        this.sz[i] = this.size[i] * (1 + f * (this.grow[i] - 1));
      }
      this.n = n;
      const g = this.geo; g.setDrawRange(0, n);
      for (const k of ['position', 'color', 'alpha', 'size']) g.attributes[k].needsUpdate = true;
    }
  }

  let zTex = null, starTex = null;
  function letterTex(ch, color) {
    const cv = document.createElement('canvas'); cv.width = cv.height = 64;
    const g = cv.getContext('2d');
    g.font = 'bold 50px Arial Black, Impact, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.lineWidth = 7; g.strokeStyle = 'rgba(0,0,0,0.65)'; g.strokeText(ch, 32, 34); g.fillStyle = color; g.fillText(ch, 32, 34);
    const t = new T.CanvasTexture(cv); t.colorSpace = T.SRGBColorSpace; return t;
  }

  class FX {
    constructor(scene) {
      T = window.THREE;
      this.scene = scene;
      this.soft = new Pool(scene, 1200, false); this.glow = new Pool(scene, 500, true);
      zTex = zTex || letterTex('Z', '#e8f0ff'); starTex = starTex || letterTex('★', '#ffe14a');
      this.sprites = [];
      for (let i = 0; i < 40; i++) {
        const s = new T.Sprite(new T.SpriteMaterial({ map: zTex, transparent: true, depthWrite: false, fog: false }));
        s.visible = false; s.renderOrder = 6; scene.add(s); this.sprites.push({ s, life: 0, age: 0 });
      }
    }
    setScale(h) { this.soft.mat.uniforms.scale.value = h * 0.6; this.glow.mat.uniforms.scale.value = h * 0.6; }
    dust(p, n, col = [0.55, 0.47, 0.36], size = 0.9, up = 1.2, spread = 2) {
      for (let i = 0; i < n; i++) this.soft.spawn(p.x + (Math.random() - 0.5) * 0.8, p.y + 0.2, p.z + (Math.random() - 0.5) * 0.8, (Math.random() - 0.5) * spread, Math.random() * up, (Math.random() - 0.5) * spread, 0.7 + Math.random() * 0.8, size, col[0], col[1], col[2], -0.2, 1.6, 2.5);
    }
    smoke(p, n, dark = 0.18, size = 0.7, vx = 0, vz = 0) {
      for (let i = 0; i < n; i++) { const c = dark + Math.random() * 0.08; this.soft.spawn(p.x + (Math.random() - 0.5) * 0.2, p.y, p.z + (Math.random() - 0.5) * 0.2, vx + (Math.random() - 0.5) * 0.6, 1.4 + Math.random() * 1.2, vz + (Math.random() - 0.5) * 0.6, 1.1 + Math.random() * 0.8, size, c, c, c * 1.05, -0.3, 0.8, 3); }
    }
    backfire(p) {
      for (let i = 0; i < 10; i++) this.glow.spawn(p.x, p.y, p.z, (Math.random() - 0.5) * 3, Math.random() * 3 + 1, (Math.random() - 0.5) * 3, 0.18 + Math.random() * 0.12, 0.45, 1, 0.55 + Math.random() * 0.3, 0.1, 0, 3, 2);
      this.smoke(p, 6, 0.08, 0.9);
    }
    burst(p, n, col, speed = 5, size = 0.25, grav = 12, life = 0.9, vary = 0.15) {
      for (let i = 0; i < n; i++) {
        const a = Math.random() * Math.PI * 2, u = 0.3 + Math.random() * 0.7, v = 1 - vary + Math.random() * vary * 2;
        this.soft.spawn(p.x, p.y, p.z, Math.cos(a) * speed * u, Math.random() * speed * 0.9 + 1.5, Math.sin(a) * speed * u, life * (0.6 + Math.random() * 0.6), size * (0.6 + Math.random() * 0.8), col[0] * v, col[1] * v, col[2] * v, grav, 0.8, 1);
      }
    }
    sparkle(p, n = 18, col = [1, 0.85, 0.3]) {
      for (let i = 0; i < n; i++) { const a = Math.random() * Math.PI * 2, s = 2 + Math.random() * 4; this.glow.spawn(p.x, p.y, p.z, Math.cos(a) * s, Math.random() * 5 + 2, Math.sin(a) * s, 0.5 + Math.random() * 0.4, 0.28, col[0], col[1], col[2], 6, 1.5, 0.5); }
    }
    beam(p, col) { for (let i = 0; i < 3; i++) this.glow.spawn(p.x + (Math.random() - 0.5) * 6, p.y, p.z + (Math.random() - 0.5) * 2, 0, 6 + Math.random() * 4, 0, 1.2, 0.5, col[0], col[1], col[2], 0, 0.3, 1); }
    // a Z drifting up from a sleeping tractor
    zzz(p, scale = 1, tex) {
      const z = this.sprites.find(q => q.life <= 0); if (!z) return;
      z.life = 2.2; z.age = 0; z.x = p.x; z.y = p.y; z.z = p.z; z.k = scale; z.ph = Math.random() * 6; z.s.visible = true;
      z.s.material.map = tex === 'star' ? starTex : zTex;
    }
    update(dt) {
      this.soft.update(dt); this.glow.update(dt);
      for (const z of this.sprites) {
        if (z.life <= 0) continue;
        z.age += dt; z.life -= dt;
        if (z.life <= 0) { z.s.visible = false; continue; }
        const f = z.age / 2.2;
        z.s.position.set(z.x + Math.sin(z.age * 2.2 + z.ph) * 0.35, z.y + z.age * 0.8, z.z);
        const s = (0.4 + f * 0.6) * z.k; z.s.scale.set(s, s, 1);
        z.s.material.opacity = f < 0.15 ? f / 0.15 : 1 - (f - 0.15) / 0.85;
      }
    }
    dispose() { for (const z of this.sprites) z.s.material.dispose(); this.soft.geo.dispose(); this.glow.geo.dispose(); this.soft.mat.dispose(); this.glow.mat.dispose(); }
  }
  TT.FX = FX;
})();
