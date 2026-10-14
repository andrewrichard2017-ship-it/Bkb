// Road Rumble: particles. Sparks (additive) and dust/smoke (soft) as pooled point clouds.
(() => {
  'use strict';
  const RR = window.RR;

  class Pool {
    constructor(scene, max, additive) {
      const T = window.THREE;
      this.max = max; this.n = 0;
      this.p = new Float32Array(max * 3); this.v = new Float32Array(max * 3); this.c = new Float32Array(max * 3);
      this.life = new Float32Array(max); this.age = new Float32Array(max); this.size = new Float32Array(max); this.grav = new Float32Array(max); this.drag = new Float32Array(max);
      this.a = new Float32Array(max); this.sz = new Float32Array(max);
      const g = this.geo = new T.BufferGeometry();
      g.setAttribute('position', new T.BufferAttribute(this.p, 3).setUsage(T.DynamicDrawUsage));
      g.setAttribute('color', new T.BufferAttribute(this.c, 3).setUsage(T.DynamicDrawUsage));
      g.setAttribute('alpha', new T.BufferAttribute(this.a, 1).setUsage(T.DynamicDrawUsage));
      g.setAttribute('size', new T.BufferAttribute(this.sz, 1).setUsage(T.DynamicDrawUsage));
      const mat = new T.ShaderMaterial({
        transparent: true, depthWrite: false, blending: additive ? T.AdditiveBlending : T.NormalBlending, vertexColors: true,
        uniforms: { scale: { value: 600 } },
        vertexShader: `attribute float alpha; attribute float size; varying float vA; varying vec3 vC; uniform float scale;
          void main(){ vA = alpha; vC = color; vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_PointSize = size * scale / max(0.5, -mv.z); gl_Position = projectionMatrix * mv; }`,
        fragmentShader: `varying float vA; varying vec3 vC; void main(){ vec2 q = gl_PointCoord - 0.5; float d = dot(q, q) * 4.0; if (d > 1.0) discard; gl_FragColor = vec4(vC, vA * (1.0 - d)); }`,
      });
      this.points = new T.Points(g, mat); this.points.frustumCulled = false; this.points.renderOrder = 5;
      scene.add(this.points);
    }
    spawn(x, y, z, vx, vy, vz, life, size, r, g, b, grav = 0, drag = 0) {
      let i = this.n < this.max ? this.n++ : (Math.random() * this.max) | 0;
      this.p[i * 3] = x; this.p[i * 3 + 1] = y; this.p[i * 3 + 2] = z;
      this.v[i * 3] = vx; this.v[i * 3 + 1] = vy; this.v[i * 3 + 2] = vz;
      this.c[i * 3] = r; this.c[i * 3 + 1] = g; this.c[i * 3 + 2] = b;
      this.life[i] = life; this.age[i] = 0; this.size[i] = size; this.grav[i] = grav; this.drag[i] = drag;
    }
    update(dt) {
      let n = this.n;
      for (let i = 0; i < n; i++) {
        this.age[i] += dt;
        if (this.age[i] >= this.life[i]) { // swap-remove
          n--;
          for (const arr of [this.p, this.v, this.c]) { arr[i * 3] = arr[n * 3]; arr[i * 3 + 1] = arr[n * 3 + 1]; arr[i * 3 + 2] = arr[n * 3 + 2]; }
          for (const arr of [this.life, this.age, this.size, this.grav, this.drag]) arr[i] = arr[n];
          i--; continue;
        }
        const k = Math.exp(-this.drag[i] * dt);
        this.v[i * 3] *= k; this.v[i * 3 + 2] *= k; this.v[i * 3 + 1] = this.v[i * 3 + 1] * k - this.grav[i] * dt;
        this.p[i * 3] += this.v[i * 3] * dt; this.p[i * 3 + 1] += this.v[i * 3 + 1] * dt; this.p[i * 3 + 2] += this.v[i * 3 + 2] * dt;
        const f = this.age[i] / this.life[i];
        this.a[i] = 1 - f; this.sz[i] = this.size[i] * (this.grav[i] > 0 ? 1 - f * 0.5 : 1 + f * 1.5);
      }
      this.n = n;
      const g = this.geo; g.setDrawRange(0, n);
      for (const k of ['position', 'color', 'alpha', 'size']) g.attributes[k].needsUpdate = true;
    }
  }

  class FX {
    constructor(scene) { this.sparks = new Pool(scene, 700, true); this.dust = new Pool(scene, 600, false); }
    sparkBurst(p, n, speed, dirX = 0, dirZ = 0) {
      for (let i = 0; i < n; i++) {
        const a = Math.random() * Math.PI * 2, u = Math.random();
        this.sparks.spawn(p.x, p.y, p.z, Math.cos(a) * speed * u + dirX, Math.random() * speed * 0.8 + 1, Math.sin(a) * speed * u + dirZ, 0.25 + Math.random() * 0.45, 0.05 + Math.random() * 0.05, 1, 0.75 + Math.random() * 0.25, 0.35, 9.8, 1.5);
      }
    }
    hitFlash(p) {
      for (let i = 0; i < 10; i++) {
        const a = Math.random() * Math.PI * 2;
        this.sparks.spawn(p.x, p.y, p.z, Math.cos(a) * 4, (Math.random() - 0.3) * 4, Math.sin(a) * 4, 0.16, 0.12, 1, 0.95, 0.8, 0, 6);
      }
    }
    puff(p, n, col, size, vx = 0, vz = 0, up = 1.2) {
      for (let i = 0; i < n; i++) this.dust.spawn(p.x + (Math.random() - 0.5) * 0.6, p.y + 0.2, p.z + (Math.random() - 0.5) * 0.6, vx + (Math.random() - 0.5) * 2, Math.random() * up, vz + (Math.random() - 0.5) * 2, 0.6 + Math.random() * 0.7, size, col[0], col[1], col[2], -0.3, 1.8);
    }
    flame(p, vx, vz) {
      this.sparks.spawn(p.x, p.y, p.z, vx + (Math.random() - 0.5), Math.random() * 0.5, vz + (Math.random() - 0.5), 0.12 + Math.random() * 0.1, 0.18, 0.35, 0.55, 1, 0, 3);
    }
    // Turbo Blaze: fire streaming off a wheel
    fire(p, vx, vz) {
      for (let i = 0; i < 2; i++) {
        const r = Math.random();
        this.sparks.spawn(p.x + (Math.random() - 0.5) * 0.3, p.y + Math.random() * 0.25, p.z + (Math.random() - 0.5) * 0.3, vx * 0.6 + (Math.random() - 0.5) * 1.4, 0.8 + Math.random() * 2, vz * 0.6 + (Math.random() - 0.5) * 1.4,
          0.16 + Math.random() * 0.2, 0.18 + Math.random() * 0.16, 1, 0.28 + r * 0.32, 0.03, -2, 2.5);
      }
    }
    // bullets / buckshot: a quick bright streak from a to b, plus a muzzle flash
    tracer(a, b, n = 1, spread = 0) {
      const dx = b.x - a.x, dy = b.y - a.y, dz = b.z - a.z, L = Math.hypot(dx, dy, dz) || 1, sp = 140;
      for (let i = 0; i < n; i++) {
        const j = () => (Math.random() - 0.5) * spread * sp;
        this.sparks.spawn(a.x, a.y, a.z, dx / L * sp + j(), dy / L * sp + j(), dz / L * sp + j(), Math.min(0.25, L / sp), 0.09, 1, 0.92, 0.6, 0, 0);
      }
      for (let i = 0; i < 6; i++) this.sparks.spawn(a.x, a.y, a.z, (Math.random() - 0.5) * 3, (Math.random() - 0.5) * 3, (Math.random() - 0.5) * 3, 0.06, 0.22, 1, 0.85, 0.4, 0, 0);
    }
    update(dt) { this.sparks.update(dt); this.dust.update(dt); }
  }
  RR.FX = FX;
})();
