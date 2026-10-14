// Road Rumble: buildings, towns, roadside life, people and the sky. Facades are canvas textures (brick, glass,
// shopfronts, siding...) mapped by the metre; everything static is merged per chunk by world.js.
(() => {
  'use strict';
  const RR = window.RR, { clamp, lerp } = RR.math, N = RR.noise;
  let T, aniso = 4;
  const TEX = {}, MATS = {}, COL = {};
  const C = hex => COL[hex] || (COL[hex] = new T.Color(hex));
  const rnd = Math.random, pickR = a => a[Math.floor(rnd() * a.length)];

  // ------------------------------------------------------------------ textures
  function cv(w, h, draw) { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); return c; }
  function tex(c, repeat = true) {
    const t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace; t.anisotropy = aniso;
    if (repeat) t.wrapS = t.wrapT = T.RepeatWrapping;
    return t;
  }
  const grad = (x, x0, y0, w, h, a, b) => { const g = x.createLinearGradient(0, y0, 0, y0 + h); g.addColorStop(0, a); g.addColorStop(1, b); x.fillStyle = g; x.fillRect(x0, y0, w, h); };
  const speckle = (x, w, h, n, a) => { for (let i = 0; i < n; i++) { const v = rnd() * 255 | 0; x.fillStyle = `rgba(${v},${v},${v},${a})`; x.fillRect(rnd() * w, rnd() * h, 2, 2); } };
  const glass = (x, X, Y, w, h) => {
    grad(x, X, Y, w, h, '#7d93a8', '#26323f');
    x.fillStyle = 'rgba(255,255,255,0.12)'; x.beginPath(); x.moveTo(X, Y + h * 0.6); x.lineTo(X + w * 0.5, Y); x.lineTo(X + w * 0.75, Y); x.lineTo(X, Y + h); x.fill();
  };
  const SHOPS = ['DINER', 'PIZZA', 'BAR', 'TATTOO', 'PAWN', 'LIQUOR', 'GROCERY', 'BIKES', 'HARDWARE', 'DONUTS', 'LAUNDRY', 'RECORDS', 'PHARMACY', 'CAFE', 'BAKERY', 'TACOS', 'ARCADE', 'HOTEL', 'GYM', 'BARBER'];
  const NEON_COLS = ['#ff3d9a', '#33e6ff', '#ffe14d', '#7dff5a', '#ff7a33', '#c77dff'];

  function makeTextures() {
    // glass office tower: 8 x 8 panels (3 m x 3.5 m)
    const office = lit => cv(512, 512, (x) => {
      x.fillStyle = lit ? '#000' : '#59626c'; x.fillRect(0, 0, 512, 512);
      for (let r = 0; r < 8; r++) {
        const floorLit = rnd() < 0.55;
        for (let c = 0; c < 8; c++) {
          const X = c * 64 + 3, Y = r * 64 + 3;
          if (lit) { if (rnd() < (floorLit ? 0.6 : 0.12)) { x.fillStyle = rnd() < 0.7 ? '#ffd79a' : '#d6ebff'; x.fillRect(X, Y, 58, 46); if (rnd() < 0.4) { x.fillStyle = 'rgba(0,0,0,0.5)'; for (let b = 0; b < 46; b += 6) x.fillRect(X, Y + b, 58, 2); } } }
          else { grad(x, X, Y, 58, 46, '#a9c2d6', '#34485c'); x.fillStyle = 'rgba(255,255,255,0.08)'; x.fillRect(X, Y, 58, 10); x.fillStyle = '#48515a'; x.fillRect(X - 3, Y + 46, 64, 15); }
        }
      }
    });
    // brick apartments: 4 bays x 4 floors (3.5 m x 3.2 m)
    const brick = lit => cv(512, 512, (x) => {
      if (lit) { x.fillStyle = '#000'; x.fillRect(0, 0, 512, 512); }
      else {
        x.fillStyle = '#7d6e64'; x.fillRect(0, 0, 512, 512);
        for (let y = 0; y < 512; y += 8) for (let X = -24; X < 512; X += 24) { x.fillStyle = `hsl(${8 + rnd() * 14},${34 + rnd() * 16}%,${28 + rnd() * 12}%)`; x.fillRect(X + (y / 8 % 2) * 12 + 1, y + 1, 22, 6); }
      }
      for (let f = 0; f < 4; f++) for (let b = 0; b < 4; b++) {
        const X = b * 128 + 34, Y = f * 128 + 24, W = 60, Hh = 76;
        if (lit) { if (rnd() < 0.5) { x.fillStyle = rnd() < 0.8 ? '#ffc977' : '#bfe0ff'; x.fillRect(X, Y, W, Hh); if (rnd() < 0.5) { x.fillStyle = 'rgba(80,20,10,0.6)'; x.fillRect(X, Y, W * 0.35, Hh); } } continue; }
        x.fillStyle = '#cdbfae'; x.fillRect(X - 6, Y - 10, W + 12, 9); x.fillRect(X - 7, Y + Hh, W + 14, 7);
        x.fillStyle = '#e9e4da'; x.fillRect(X - 3, Y - 3, W + 6, Hh + 6);
        glass(x, X, Y, W, Hh);
        if (rnd() < 0.4) { x.fillStyle = pickR(['#a33', '#e8d8b0', '#3a5', '#557']); x.fillRect(X + 2, Y + 2, W * 0.3, Hh - 4); }
        x.fillStyle = '#e9e4da'; x.fillRect(X + W / 2 - 2, Y, 4, Hh); x.fillRect(X, Y + Hh * 0.45, W, 4);
      }
    });
    // concrete block: ribbon windows (4 m bays, 3.5 m floors)
    const concrete = lit => cv(512, 512, (x) => {
      if (lit) { x.fillStyle = '#000'; x.fillRect(0, 0, 512, 512); } else { x.fillStyle = '#b8b0a3'; x.fillRect(0, 0, 512, 512); speckle(x, 512, 512, 3000, 0.08); x.fillStyle = 'rgba(0,0,0,0.12)'; for (let i = 0; i < 512; i += 128) x.fillRect(i, 0, 2, 512); }
      for (let f = 0; f < 4; f++) for (let s = 0; s < 16; s++) {
        const X = s * 32 + 2, Y = f * 128 + 44;
        if (lit) { if (rnd() < 0.45) { x.fillStyle = rnd() < 0.75 ? '#ffd28a' : '#cfe6ff'; x.fillRect(X, Y, 28, 52); } }
        else { glass(x, X, Y, 28, 52); }
      }
    });
    // shopfronts: 4 shops of 6 m, 4.5 m tall
    const shop = (lit, names) => cv(1024, 256, (x) => {
      for (let i = 0; i < 4; i++) {
        const X = i * 256, name = names[i], ncol = NEON_COLS[i % NEON_COLS.length];
        if (lit) {
          x.fillStyle = '#000'; x.fillRect(X, 0, 256, 256);
          const g = x.createLinearGradient(0, 80, 0, 230); g.addColorStop(0, '#ffdca0'); g.addColorStop(1, '#a86a2a'); x.fillStyle = g; x.fillRect(X + 18, 80, 150, 150);
          x.fillStyle = '#7a5a30'; x.fillRect(X + 186, 92, 52, 150);
          x.shadowColor = ncol; x.shadowBlur = 18; x.fillStyle = ncol; x.font = 'bold 36px Arial Black, Arial'; x.textAlign = 'center'; x.textBaseline = 'middle';
          x.fillText(name, X + 128, 34, 230); x.shadowBlur = 0;
          continue;
        }
        x.fillStyle = ['#8e3b2e', '#d9cfb8', '#2f6f73', '#c19a3c', '#59606a', '#7b4b6e'][i % 6]; x.fillRect(X, 0, 256, 256);
        speckle(x, 256, 256, 300, 0.06);
        x.fillStyle = '#1d1d22'; x.fillRect(X + 6, 8, 244, 54);
        x.fillStyle = '#f2ead8'; x.font = 'bold 34px Arial Black, Arial'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(name, X + 128, 36, 230);
        x.fillStyle = '#2a2a2a'; x.fillRect(X + 14, 76, 158, 158);
        glass(x, X + 18, 80, 150, 150);
        x.fillStyle = 'rgba(255,220,160,0.25)'; for (let k = 0; k < 3; k++) x.fillRect(X + 26, 150 + k * 24, 134, 6);
        x.fillStyle = '#2a2a2a'; x.fillRect(X + 182, 88, 60, 168);
        glass(x, X + 188, 96, 48, 152);
        x.fillStyle = '#3a3330'; x.fillRect(X, 238, 256, 18);
      }
    });
    const shopNames = [0, 1, 2].map(() => { const a = SHOPS.slice().sort(() => rnd() - 0.5); return a.slice(0, 4); });
    // house siding (8 m x 3 m, two windows), cabin logs, stucco, barn planks, shingles, corrugated metal
    const siding = cv(512, 256, (x) => {
      x.fillStyle = '#f1ede4'; x.fillRect(0, 0, 512, 256);
      for (let y = 0; y < 256; y += 14) { x.fillStyle = 'rgba(0,0,0,0.13)'; x.fillRect(0, y + 12, 512, 2); x.fillStyle = 'rgba(255,255,255,0.4)'; x.fillRect(0, y, 512, 2); }
      for (const X of [86, 330]) {
        x.fillStyle = '#5b6168'; x.fillRect(X - 26, 62, 20, 120); x.fillRect(X + 102, 62, 20, 120);
        x.fillStyle = '#fbfaf6'; x.fillRect(X - 6, 56, 108, 132);
        glass(x, X, 62, 96, 120);
        x.fillStyle = '#fbfaf6'; x.fillRect(X + 46, 62, 4, 120); x.fillRect(X, 118, 96, 4);
      }
    });
    const logs = cv(512, 256, (x) => {
      for (let y = 0; y < 256; y += 32) { const g = x.createLinearGradient(0, y, 0, y + 32); g.addColorStop(0, '#5a3b22'); g.addColorStop(0.4, '#8a5f3a'); g.addColorStop(1, '#3b2414'); x.fillStyle = g; x.fillRect(0, y, 512, 32); }
      speckle(x, 512, 256, 900, 0.08);
      x.fillStyle = '#d8cbb0'; x.fillRect(200, 76, 112, 116); glass(x, 206, 82, 100, 104); x.fillStyle = '#d8cbb0'; x.fillRect(254, 82, 4, 104);
    });
    const stucco = cv(512, 256, (x) => {
      x.fillStyle = '#f3ece0'; x.fillRect(0, 0, 512, 256); speckle(x, 512, 256, 2500, 0.07);
      for (const X of [70, 320]) {
        x.fillStyle = '#ffffff'; x.beginPath(); x.moveTo(X - 6, 200); x.lineTo(X - 6, 100); x.arc(X + 56, 100, 62, Math.PI, 0); x.lineTo(X + 118, 200); x.fill();
        x.save(); x.beginPath(); x.moveTo(X, 194); x.lineTo(X, 100); x.arc(X + 56, 100, 56, Math.PI, 0); x.lineTo(X + 112, 194); x.clip(); glass(x, X, 40, 112, 160); x.restore();
      }
    });
    const planks = cv(256, 256, (x) => {
      x.fillStyle = '#e9e0d4'; x.fillRect(0, 0, 256, 256);
      for (let X = 0; X < 256; X += 32) { x.fillStyle = 'rgba(0,0,0,0.25)'; x.fillRect(X, 0, 3, 256); x.fillStyle = `rgba(0,0,0,${rnd() * 0.08})`; x.fillRect(X + 3, 0, 29, 256); }
      speckle(x, 256, 256, 600, 0.06);
    });
    const shingles = cv(256, 256, (x) => {
      x.fillStyle = '#d0d0d0'; x.fillRect(0, 0, 256, 256);
      for (let y = 0; y < 256; y += 16) for (let X = -32; X < 256; X += 32) { const v = 150 + rnd() * 60 | 0; x.fillStyle = `rgb(${v},${v},${v})`; x.fillRect(X + (y / 16 % 2) * 16 + 1, y + 1, 30, 14); }
    });
    const metal = cv(256, 256, (x) => {
      for (let X = 0; X < 256; X += 16) { const g = x.createLinearGradient(X, 0, X + 16, 0); g.addColorStop(0, '#9aa0a6'); g.addColorStop(0.5, '#d6dadd'); g.addColorStop(1, '#80868c'); x.fillStyle = g; x.fillRect(X, 0, 16, 256); }
      for (let i = 0; i < 30; i++) { x.fillStyle = `rgba(120,70,30,${rnd() * 0.25})`; x.fillRect(rnd() * 256, rnd() * 256, 10 + rnd() * 30, 4 + rnd() * 40); }
    });
    // billboard adverts (2 x 4) and neon shop signs (2 x 4)
    const ADS = [
      ['#c62828', 'FIZZ COLA', 'ICE COLD · 99¢', '#fff'], ['#1a237e', "BIG JIM'S DINER", 'NEXT EXIT · OPEN 24H', '#ffeb3b'],
      ['#151515', 'CHROME KINGS', 'CUSTOM BIKES & PARTS', '#ff9800'], ['#2e7d32', 'LUCKY 7 MOTEL', 'COLOR TV · VACANCY', '#fff'],
      ['#f9a825', 'BAIL BONDS', 'CALL 555-0199 · 24/7', '#111'], ['#6a1b9a', 'RUMBLE RADIO 98.1', 'LOUD. FAST. ROCK.', '#fff'],
      ['#00838f', 'SUNSET BEACH', 'SURF · SAND · SUN', '#fff'], ['#bf360c', 'HOT WINGS', 'EAT HERE · GET GAS', '#ffecb3'],
    ];
    const ads = cv(1024, 1024, (x) => {
      ADS.forEach(([bg, t1, t2, fg], i) => {
        const X = (i % 2) * 512, Y = Math.floor(i / 2) * 256;
        const g = x.createLinearGradient(X, Y, X + 512, Y + 256); g.addColorStop(0, bg); g.addColorStop(1, '#000'); x.fillStyle = g; x.fillRect(X, Y, 512, 256);
        x.fillStyle = 'rgba(255,255,255,0.12)'; for (let k = 0; k < 9; k++) { x.beginPath(); x.moveTo(X + 430, Y + 128); x.arc(X + 430, Y + 128, 220, k * 0.7, k * 0.7 + 0.3); x.fill(); }
        x.fillStyle = fg; x.textAlign = 'left'; x.textBaseline = 'middle';
        x.font = 'bold 62px Impact, Arial Black, Arial'; x.fillText(t1, X + 26, Y + 104, 460);
        x.font = 'bold 30px Arial'; x.fillText(t2, X + 28, Y + 178, 460);
        x.strokeStyle = '#eee'; x.lineWidth = 10; x.strokeRect(X + 5, Y + 5, 502, 246);
      });
    });
    const NEON = ['DINER', 'MOTEL', 'GAS', 'BAR', 'EAT', 'VACANCY', 'LIQUOR', 'HOTEL'];
    const neon = cv(1024, 512, (x) => {
      x.fillStyle = '#0a0a0c'; x.fillRect(0, 0, 1024, 512);
      NEON.forEach((t, i) => {
        const X = (i % 2) * 512, Y = Math.floor(i / 2) * 128, col = NEON_COLS[i % NEON_COLS.length];
        x.strokeStyle = col; x.lineWidth = 5; x.shadowColor = col; x.shadowBlur = 16; x.strokeRect(X + 10, Y + 10, 492, 108);
        x.fillStyle = col; x.font = 'bold 76px Arial Black, Arial'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(t, X + 256, Y + 66, 470); x.shadowBlur = 0;
      });
    });
    const TOWNS = ['SEABREEZE', 'PINE HOLLOW', 'MILLBROOK', 'DRY GULCH', 'ROCKVILLE', 'CEDAR FALLS', 'HARVEST', 'COPPER RIDGE'];
    const signs = cv(1024, 512, (x) => {
      TOWNS.forEach((t, i) => {
        const X = (i % 2) * 512, Y = Math.floor(i / 2) * 128;
        x.fillStyle = '#0f6b3a'; x.fillRect(X, Y, 512, 128); x.strokeStyle = '#fff'; x.lineWidth = 6; x.strokeRect(X + 8, Y + 8, 496, 112);
        x.fillStyle = '#fff'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.font = 'bold 26px Arial'; x.fillText('WELCOME TO', X + 256, Y + 34);
        x.font = 'bold 50px Arial'; x.fillText(t, X + 256, Y + 80, 470);
      });
    });
    Object.assign(TEX, {
      office: tex(office(false)), officeLit: tex(office(true)), brick: tex(brick(false)), brickLit: tex(brick(true)), concrete: tex(concrete(false)), concreteLit: tex(concrete(true)),
      shop: shopNames.map(n => tex(shop(false, n))), shopLit: shopNames.map(n => tex(shop(true, n))),
      siding: tex(siding), logs: tex(logs), stucco: tex(stucco), planks: tex(planks), roof: tex(shingles), metal: tex(metal),
      ads: tex(ads, false), neon: tex(neon, false), signs: tex(signs, false),
    });
    S.TOWNS = TOWNS; S.ADS = ADS.length;
  }
  // tile size (metres) of each facade texture
  const TILE = { office: [24, 28], brick: [14, 12.8], concrete: [16, 14], shop0: [24, 4.5], shop1: [24, 4.5], shop2: [24, 4.5], siding: [8, 3], logs: [6, 3], stucco: [8, 3.2], planks: [4, 4], roof: [4, 4], metal: [4, 4] };

  function material(key, night) {
    const id = key + (night ? 'N' : 'D');
    if (MATS[id]) return MATS[id];
    let m;
    if (key === 'neon') m = new T.MeshBasicMaterial({ map: TEX.neon, toneMapped: false });
    else if (key === 'ads' || key === 'signs') m = new T.MeshStandardMaterial({ map: TEX[key], roughness: 0.6, emissive: night ? 0xffffff : 0x000000, emissiveMap: night ? TEX[key] : null, emissiveIntensity: night ? 0.35 : 0 });
    else {
      const shopI = key.startsWith('shop') ? +key[4] : -1;
      const map = shopI >= 0 ? TEX.shop[shopI] : TEX[key];
      const lit = night ? (shopI >= 0 ? TEX.shopLit[shopI] : TEX[key + 'Lit']) : null;
      m = new T.MeshStandardMaterial({ vertexColors: true, map, roughness: key === 'office' ? 0.3 : key === 'metal' ? 0.5 : 0.85, metalness: key === 'office' ? 0.4 : key === 'metal' ? 0.5 : 0,
        emissive: lit ? 0xffffff : 0x000000, emissiveMap: lit || null, emissiveIntensity: lit ? 1.25 : 0 });
    }
    return (MATS[id] = m);
  }

  // ------------------------------------------------------------------ geometry helpers
  // local -> world on the ground plane; front of a building is local -x
  const frame = (x, z, yaw) => { const c = Math.cos(yaw), s = Math.sin(yaw); return (lx, lz) => [x + lx * c + lz * s, z - lx * s + lz * c]; };
  function wall(M, a, b, y0, y1, ctr, col, tw, th, u0 = 0, v0 = 0) {
    let ex = b[0] - a[0], ez = b[1] - a[1];
    const mx = (a[0] + b[0]) / 2 - ctr[0], mz = (a[1] + b[1]) / 2 - ctr[1];
    if (-ez * mx + ex * mz < 0) { const t = a; a = b; b = t; ex = -ex; ez = -ez; }
    const L = Math.hypot(ex, ez), u1 = u0 + L / tw, v1 = v0 + (y1 - y0) / th;
    M.quad([a[0], y0, a[1]], [b[0], y0, b[1]], [b[0], y1, b[1]], [a[0], y1, a[1]], col, [u0, v0, u1, v0, u1, v1, u0, v1]);
  }
  // a panel showing one region of an atlas, facing away from `behind`
  function panel(M, a, b, y0, y1, behind, uv) {
    let ex = b[0] - a[0], ez = b[1] - a[1];
    const mx = (a[0] + b[0]) / 2 - behind[0], mz = (a[1] + b[1]) / 2 - behind[1];
    if (-ez * mx + ex * mz < 0) { const t = a; a = b; b = t; }
    M.quad([a[0], y0, a[1]], [b[0], y0, b[1]], [b[0], y1, b[1]], [a[0], y1, a[1]], C(0xffffff), [uv[0], uv[1], uv[2], uv[1], uv[2], uv[3], uv[0], uv[3]]);
  }
  function quadUp(M, pts, y, col, uvs = 4) {
    let [a, b, c, d] = pts;
    const e1x = b[0] - a[0], e1z = b[1] - a[1], e2x = d[0] - a[0], e2z = d[1] - a[1];
    if (e1z * e2x - e1x * e2z < 0) { const t = b; b = d; d = t; }
    const uv = [a[0] / uvs, a[1] / uvs, b[0] / uvs, b[1] / uvs, c[0] / uvs, c[1] / uvs, d[0] / uvs, d[1] / uvs];
    M.quad([a[0], y, a[1]], [b[0], y, b[1]], [c[0], y, c[1]], [d[0], y, d[1]], col, uv);
  }
  // box walls in local frame: x from lx0..lx1 (front = lx0 side), z from lz0..lz1
  function box(B, L, o) {
    const { lx0, lx1, lz0, lz1, y0, y1 } = o, col = C(o.col || 0xffffff);
    const P = [L(lx0, lz0), L(lx0, lz1), L(lx1, lz1), L(lx1, lz0)], ctr = L((lx0 + lx1) / 2, (lz0 + lz1) / 2);
    const faces = [o.front, o.side, o.back || o.side, o.side];
    for (let i = 0; i < 4; i++) {
      const key = faces[i]; if (!key) continue;
      const M = TILE[key] ? B.tex(key) : B.flat, t = TILE[key] || [4, 4];
      wall(M, P[i], P[(i + 1) % 4], y0, y1, ctr, i === 0 ? C(o.frontCol || o.col || 0xffffff) : col, t[0], t[1], i === 0 ? (o.u0 || 0) : 0, o.v0 || 0);
    }
    if (o.roof !== false) quadUp(o.roof ? B.tex(o.roof) : B.flat, P, y1, C(o.roofCol || 0x3b3b40));
    return P;
  }
  // pitched roof: ridge along local z
  function gable(B, L, lx0, lx1, lz0, lz1, y, rh, ov, roofCol, gableKey, gableCol) {
    const xm = (lx0 + lx1) / 2, hw = (lx1 - lx0) / 2, ye = y - ov * rh / hw;
    const R = B.tex('roof'), rc = C(roofCol), ctr = L(xm, (lz0 + lz1) / 2);
    const slope = Math.hypot(hw + ov, rh + ov * rh / hw);
    for (const sd of [-1, 1]) {
      const eave = xm + sd * (hw + ov);
      const a = L(eave, lz0 - ov), b = L(eave, lz1 + ov), c = L(xm, lz1 + ov), d = L(xm, lz0 - ov);
      let A = [a[0], ye, a[1]], Bv = [b[0], ye, b[1]], Cv = [c[0], y + rh, c[1]], Dv = [d[0], y + rh, d[1]];
      const out = L(xm + sd, (lz0 + lz1) / 2); const ox = out[0] - ctr[0], oz = out[1] - ctr[1];
      // normal of (B-A)x(D-A) must point outwards/up
      const e1 = [Bv[0] - A[0], Bv[1] - A[1], Bv[2] - A[2]], e2 = [Dv[0] - A[0], Dv[1] - A[1], Dv[2] - A[2]];
      const nx = e1[1] * e2[2] - e1[2] * e2[1], nz = e1[0] * e2[1] - e1[1] * e2[0];
      const len = (lz1 - lz0 + 2 * ov) / 4, sl = slope / 4;
      if (nx * ox + nz * oz < 0) R.quad(A, Dv, Cv, Bv, rc, [0, 0, 0, sl, len, sl, len, 0]); else R.quad(A, Bv, Cv, Dv, rc, [0, 0, len, 0, len, sl, 0, sl]);
    }
    // gable ends
    const G = gableKey ? B.tex(gableKey) : B.flat, gc = C(gableCol || 0xffffff), t = TILE[gableKey] || [4, 4];
    for (const z of [lz0, lz1]) {
      const a = L(lx0, z), b = L(lx1, z), c = L(xm, z), out = L(xm, z + (z === lz0 ? -1 : 1));
      const A = [a[0], y, a[1]], Bv = [b[0], y, b[1]], Cv = [c[0], y + rh, c[1]];
      const e1 = [Bv[0] - A[0], 0, Bv[2] - A[2]], e2 = [Cv[0] - A[0], Cv[1] - A[1], Cv[2] - A[2]];
      const nx = e1[1] * e2[2] - e1[2] * e2[1], nz = e1[0] * e2[1] - e1[1] * e2[0];
      const ox = out[0] - c[0], oz = out[1] - c[1], W = hw * 2 / t[0], Hh = rh / t[1];
      if (nx * ox + nz * oz < 0) G.tri(A, Cv, Bv, gc, [0, 0, W / 2, Hh, W, 0]); else G.tri(A, Bv, Cv, gc, [0, 0, W, 0, W / 2, Hh]);
    }
  }
  const at3 = (L, lx, y, lz) => { const q = L(lx, lz); return [q[0], y, q[1]]; };

  // ------------------------------------------------------------------ building kinds
  const STYLES = ['office', 'brick', 'concrete', 'brick', 'office'];
  function cityBuilding(B, pr, ctx) {
    const G = RR.models.geo, { p, rng } = ctx, w = pr.sc, h = pr.h, dep = pr.depth;
    const yaw = -ctx.hd + (pr.d < 0 ? Math.PI : 0), L = frame(p.x, p.z, yaw), base = ctx.base - 0.3;
    const front = pr.kind === 'building' && !pr.back;
    const style = STYLES[pr.v % 5], col = [0xffffff, 0xf0e6dc, 0xe6eef5, 0xfff2e0, 0xdfe7ff][pr.v % 5];
    const shopKey = 'shop' + rng.int(0, 2);
    const hx = dep / 2, hz = w / 2;
    let y = base;
    if (style !== 'office' && h > 10 && front) {
      box(B, L, { lx0: -hx, lx1: hx, lz0: -hz, lz1: hz, y0: y, y1: y + 4.6, front: shopKey, side: style, col, frontCol: 0xffffff, u0: rng.int(0, 3) * 0.25, roof: false });
      // awnings and a hanging sign
      const n = Math.max(1, Math.floor(w / 6));
      for (let i = 0; i < n; i++) if (rng() < 0.7) B.smooth.add(G.BOX(), rng.pick([0xb71c1c, 0x1b5e20, 0x0d47a1, 0xf57f17, 0x4a148c, 0x37474f]), at3(L, -hx - 0.7, y + 3.55, -hz + (i + 0.5) * w / n), [0, yaw, 0.35], [1.6, 0.1, w / n - 0.8]);
      y += 4.6;
    }
    const setback = h > 42 && front;
    const top1 = setback ? base + h * 0.62 : base + h;
    box(B, L, { lx0: -hx, lx1: hx, lz0: -hz, lz1: hz, y0: y, y1: top1, front: style, side: style, col, v0: (y - base) / TILE[style][1] });
    let rx = hx, rz = hz, top = top1;
    if (setback) { rx = hx * 0.7; rz = hz * 0.72; top = base + h; box(B, L, { lx0: -rx, lx1: rx, lz0: -rz, lz1: rz, y0: top1, y1: top, front: 'office', side: 'office', col: 0xe8f0ff }); }
    // parapet
    for (const [a, b, c, d] of [[-hx, hx, -hz, -hz + 0.3], [-hx, hx, hz - 0.3, hz], [-hx, -hx + 0.3, -hz, hz], [hx - 0.3, hx, -hz, hz]]) {
      const q = L((a + b) / 2, (c + d) / 2); B.flat.add(G.BOX(), 0x55565c, [q[0], top1 + 0.45, q[1]], [0, yaw, 0], [b - a, 0.9, d - c]);
    }
    // rooftop clutter
    for (let i = 0; i < rng.int(1, 3); i++) B.flat.add(G.BOX(), 0x8a8d92, at3(L, rng.range(-rx + 1.5, rx - 1.5), top + 0.7, rng.range(-rz + 1.5, rz - 1.5)), [0, yaw, 0], [rng.range(1.5, 3), 1.4, rng.range(1.5, 3)]);
    if (style === 'brick' && rng() < 0.55) {
      const q = at3(L, rng.range(-rx + 2, rx - 2), top, rng.range(-rz + 2, rz - 2));
      for (const [dx, dz] of [[-0.9, -0.9], [0.9, -0.9], [-0.9, 0.9], [0.9, 0.9]]) B.flat.add(G.BOX(), 0x3a3a3a, [q[0] + dx, top + 1.2, q[2] + dz], [0, 0, 0], [0.15, 2.4, 0.15]);
      B.flat.add(G.CYL(10), 0x7a5a3a, [q[0], top + 3.6, q[2]], [0, 0, 0], [1.4, 2.6, 1.4]);
      B.flat.add(G.CONE(10), 0x4a3a2a, [q[0], top + 5.3, q[2]], [0, 0, 0], [1.5, 0.9, 1.5]);
    }
    if (h > 35 && rng() < 0.6) { const q = at3(L, 0, top, 0); B.chrome.add(G.CYL(6), 0x9a9a9a, [q[0], top + 6, q[2]], [0, 0, 0], [0.18, 12, 0.18]); B.glow.add(G.SPH(6, 4), 0xff2020, [q[0], top + 12.2, q[2]], [0, 0, 0], 0.35); }
    // fire escape
    if (style === 'brick' && rng() < 0.5 && front) {
      const z = rng.range(-hz + 3, hz - 3);
      for (let f = base + 7.8; f < top1 - 1; f += 3.2) {
        B.flat.add(G.BOX(), 0x1e1e1e, at3(L, -hx - 0.6, f, z), [0, yaw, 0], [1.2, 0.08, 3.6]);
        B.flat.add(G.BOX(), 0x1e1e1e, at3(L, -hx - 1.18, f + 0.5, z), [0, yaw, 0], [0.04, 1.0, 3.6]);
        B.flat.add(G.BOX(), 0x1e1e1e, at3(L, -hx - 0.6, f + 1.6, z), [0, yaw, 0.0], [0.5, 0.06, 3.3]);
      }
    }
    // neon blade sign / rooftop billboard
    if (front && rng() < 0.4) { const c = rng.pick([0xff2d95, 0x00e5ff, 0xffd400, 0x7cff4f, 0xff7a33]); B.glow.add(G.BOX(), c, at3(L, -hx - 0.7, base + rng.range(6, 10), rng.range(-hz + 1, hz - 1)), [0, yaw, 0], [0.9, 3.6, 0.18]); }
    if (front && h < 32 && rng() < 0.2) billboard(B, L, -hx + 2, top, 0, 10, 4.2, rng.int(0, 7), true);
  }
  // a billboard; local -x faces the road
  function billboard(B, L, lx, y, lz, w, h, ad, onRoof) {
    const G = RR.models.geo;
    const legH = onRoof ? 1.5 : 4.5, by = y + legH;
    for (const z of [-w * 0.32, w * 0.32]) { const q = L(lx + 0.3, lz + z); B.flat.add(G.BOX(), 0x5a5048, [q[0], y + legH / 2 + 0.1, q[1]], [0, 0, 0], [0.3, legH + 0.2, 0.3]); }
    const a = L(lx, lz - w / 2), b = L(lx, lz + w / 2), behind = L(lx + 1, lz);
    const col = ad % 2, row = Math.floor(ad / 2);
    panel(B.tex('ads'), a, b, by, by + h, behind, [col * 0.5, 1 - (row + 1) * 0.25, col * 0.5 + 0.5, 1 - row * 0.25]);
    const back = L(lx + 0.2, lz); B.flat.add(G.BOX(), 0x2f2f33, [back[0], by + h / 2, back[1]], [0, Math.atan2(b[0] - a[0], b[1] - a[1]), 0], [0.3, h + 0.3, w + 0.3]);
    for (let i = 0; i < 3; i++) { const q = at3(L, lx - 0.8, by - 0.2, lz - w / 3 + i * w / 3); B.glow.add(G.BOX(), 0xfff2c0, q, [0, 0, 0], [0.25, 0.12, 0.25]); }
  }
  function neonSign(B, L, lx, y, lz, w, idx, behindDx = 1) {
    const a = L(lx, lz - w / 2), b = L(lx, lz + w / 2), behind = L(lx + behindDx, lz), h = w * 0.25;
    const col = idx % 2, row = Math.floor(idx / 2);
    panel(B.tex('neon'), a, b, y, y + h, behind, [col * 0.5, 1 - (row + 1) * 0.25, col * 0.5 + 0.5, 1 - row * 0.25]);
    panel(B.tex('neon'), b, a, y, y + h, L(lx - behindDx, lz), [col * 0.5, 1 - (row + 1) * 0.25, col * 0.5 + 0.5, 1 - row * 0.25]);
  }
  function chimney(B, L, lx, lz, y, h) { const G = RR.models.geo; B.flat.add(G.BOX(), 0x7a4a3a, at3(L, lx, y + h / 2, lz), [0, 0, 0], [0.8, h, 0.8]); }

  function house(B, pr, ctx) {
    const G = RR.models.geo, { p, rng, night } = ctx, sc = pr.sc, kind = pr.kind;
    const yaw = -ctx.hd + (pr.d < 0 ? Math.PI : 0) + (pr.turn || 0), L = frame(p.x, p.z, yaw), y0 = p.y - 0.3;
    const pastel = [0xf4efe6, 0xc9dbe6, 0xf2e2a8, 0xe3c4c4, 0xcfe3c8, 0xe8d5f0, 0xffffff, 0xd8c4a8][pr.v % 8];
    const roofC = [0x5a3a30, 0x3d4a5a, 0x5a5a5a, 0x7a4a32, 0x404040, 0x2f4a32][pr.v % 6];
    if (kind === 'cabin') {
      const hx = 4 * sc, hz = 3.5 * sc, h = 3 * sc;
      box(B, L, { lx0: -hx, lx1: hx, lz0: -hz, lz1: hz, y0, y1: y0 + h, front: 'logs', side: 'logs', roof: false });
      gable(B, L, -hx, hx, -hz, hz, y0 + h, 3 * sc, 0.6, [0x2f4a32, 0x5a3a2a, 0x3a3a3a][pr.v % 3], 'logs');
      chimney(B, L, hx * 0.5, hz * 0.5, y0, h + 3.6 * sc);
      porch(B, L, -hx, -hz * 0.8, hz * 0.8, y0, 0x6a4a30);
      for (let i = 0; i < 6; i++) B.flat.add(G.CYL(7), 0x7a5232, at3(L, hx + 0.6, y0 + 0.25 + Math.floor(i / 3) * 0.45, -1 + (i % 3) * 0.48), [Math.PI / 2, yaw, 0], [0.22, 1.8, 0.22]);
    } else if (kind === 'barn') {
      const hx = 6 * sc, hz = 8 * sc, h = 5 * sc;
      box(B, L, { lx0: -hx, lx1: hx, lz0: -hz, lz1: hz, y0, y1: y0 + h, front: 'planks', side: 'planks', col: 0xb3352c, roof: false });
      gable(B, L, -hx, hx, -hz, hz, y0 + h, 4.5 * sc, 0.5, 0x4a4a4a, 'planks', 0xb3352c);
      for (const z of [-2, 2]) B.flat.add(G.BOX(), 0xf2f2f2, at3(L, -hx - 0.05, y0 + 2.2, z), [0, yaw, 0], [0.1, 4.4, 0.25]);
      B.flat.add(G.BOX(), 0xf2f2f2, at3(L, -hx - 0.06, y0 + 4.4, 0), [0, yaw, 0], [0.1, 0.25, 4.2]);
      B.flat.add(G.BOX(), 0xf2f2f2, at3(L, -hx - 0.07, y0 + 2.2, 0), [0, yaw, 0.85], [0.08, 5.6, 0.22]);
      B.flat.add(G.BOX(), 0xf2f2f2, at3(L, -hx - 0.07, y0 + 2.2, 0), [0, yaw, -0.85], [0.08, 5.6, 0.22]);
    } else if (kind === 'shack') {
      const hx = 3 * sc, hz = 2.6 * sc, h = 2.8 * sc;
      box(B, L, { lx0: -hx, lx1: hx, lz0: -hz, lz1: hz, y0, y1: y0 + h, front: 'metal', side: 'metal', col: 0xd8c8b8, roof: false });
      B.flat.add(G.BOX(), 0x8a7d70, at3(L, 0, y0 + h + 0.2, 0), [0, yaw, 0.1], [hx * 2 + 0.8, 0.12, hz * 2 + 0.8]);
    } else if (kind === 'beach') {
      const hx = 4.5 * sc, hz = 5 * sc, h = 3.2 * sc;
      box(B, L, { lx0: -hx, lx1: hx, lz0: -hz, lz1: hz, y0, y1: y0 + h * 2, front: 'stucco', side: 'stucco', col: pastel, roofCol: 0xd8cfc0 });
      B.flat.add(G.BOX(), 0x9a7a5a, at3(L, -hx - 1.5, y0 + h, 0), [0, yaw, 0], [3, 0.2, hz * 2]);
      for (const z of [-hz + 0.3, hz - 0.3]) B.flat.add(G.BOX(), 0xffffff, at3(L, -hx - 2.9, y0 + h / 2, z), [0, 0, 0], [0.2, h, 0.2]);
      B.flat.add(G.BOX(), 0xffffff, at3(L, -hx - 2.9, y0 + h + 0.55, 0), [0, yaw, 0], [0.08, 0.9, hz * 2]);
      B.smooth.add(G.BOX(), [0x1e88e5, 0xef5350, 0x26a69a][pr.v % 3], at3(L, -hx - 1.2, y0 + h * 2 - 0.4, 0), [0, yaw, 0.3], [2.2, 0.08, hz * 1.4]);
    } else { // house / farmhouse
      const floors = kind === 'farm' || rng() < 0.4 ? 2 : 1, hx = 4.5 * sc, hz = 5.5 * sc, h = 3 * floors;
      box(B, L, { lx0: -hx, lx1: hx, lz0: -hz, lz1: hz, y0, y1: y0 + h, front: 'siding', side: 'siding', col: pastel, roof: false });
      gable(B, L, -hx, hx, -hz, hz, y0 + h, 2.4 + floors * 0.4, 0.55, roofC, 'siding', pastel);
      porch(B, L, -hx, -hz * 0.7, hz * 0.4, y0, 0xffffff);
      B.flat.add(G.BOX(), 0x5a3a2a, at3(L, -hx - 0.04, y0 + 1.05, -hz * 0.15), [0, yaw, 0], [0.08, 2.1, 1.0]); // door
      chimney(B, L, hx * 0.4, hz * 0.6, y0, h + 3.4);
      if (rng() < 0.5) { // garage
        box(B, L, { lx0: -hx + 0.5, lx1: hx - 1, lz0: hz, lz1: hz + 4.5, y0, y1: y0 + 2.8, front: 'siding', side: 'siding', col: pastel, roofCol: roofC });
        B.flat.add(G.BOX(), 0xe8e8e8, at3(L, -hx + 0.46, y0 + 1.1, hz + 2.25), [0, yaw, 0], [0.06, 2.2, 3.4]);
      }
      if (rng() < 0.5) for (let z = -hz - 1; z < hz + 1; z += 1.4) B.flat.add(G.BOX(), 0xf5f5f5, at3(L, -hx - 4, y0 + 0.5, z), [0, yaw, 0], [0.08, 1, 0.12]); // picket fence
      if (night) B.glow.add(G.BOX(), 0xffcf80, at3(L, -hx - 0.03, y0 + 1.7, hz * 0.45), [0, yaw, 0], [0.04, 1, 1.2]);
    }
  }
  function porch(B, L, lx, lz0, lz1, y0, col) {
    const G = RR.models.geo, mid = (lz0 + lz1) / 2, len = lz1 - lz0, a = L(0, 0), b = L(0, 1), rot = Math.atan2(b[0] - a[0], b[1] - a[1]);
    B.flat.add(G.BOX(), 0x8a7a68, at3(L, lx - 1.1, y0 + 0.25, mid), [0, rot, 0], [2.2, 0.3, len]);
    for (const z of [lz0 + 0.2, lz1 - 0.2]) B.flat.add(G.BOX(), col, at3(L, lx - 2.0, y0 + 1.5, z), [0, 0, 0], [0.16, 2.6, 0.16]);
    B.flat.add(G.BOX(), 0x6a6a6a, at3(L, lx - 1.1, y0 + 2.85, mid), [0, rot, -0.2], [2.4, 0.12, len + 0.3]);
  }

  // shops, diners, gas stations, motels and churches in the small towns
  function townBuilding(B, pr, ctx) {
    const G = RR.models.geo, { p, rng, night, theme } = ctx, w = pr.sc, dep = pr.depth || 12, t = pr.type;
    const yaw = -ctx.hd + (pr.d < 0 ? Math.PI : 0), L = frame(p.x, p.z, yaw), y0 = ctx.base - 0.25;
    const hx = dep / 2, hz = w / 2, a2 = (() => { const a = L(0, 0), b = L(0, 1); return Math.atan2(b[0] - a[0], b[1] - a[1]); })();
    const upper = { desert: 'stucco', coast: 'stucco', forest: 'logs', valley: 'brick' }[theme] || 'brick';
    const wallCol = upper === 'stucco' ? [0xf5d7b0, 0xe8c4a0, 0xd9e6f2, 0xf2e6c9][pr.v % 4] : 0xffffff;
    const shopKey = 'shop' + (pr.v % 3);
    if (t === 'store') {
      const floors = rng() < 0.5 ? 2 : 1;
      box(B, L, { lx0: -hx, lx1: hx, lz0: -hz, lz1: hz, y0, y1: y0 + 4.6, front: shopKey, side: upper, col: wallCol, frontCol: 0xffffff, u0: rng.int(0, 3) * 0.25, roof: floors === 1 ? null : false, roofCol: 0x4a4a4e });
      let top = y0 + 4.6;
      if (floors === 2) { box(B, L, { lx0: -hx, lx1: hx, lz0: -hz, lz1: hz, y0: top, y1: top + 3.4, front: upper, side: upper, col: wallCol, v0: 0.4, roofCol: 0x4a4a4e }); top += 3.4; }
      if (theme === 'desert' || theme === 'forest') { // western false front
        const q = L(-hx - 0.05, 0);
        B.flat.add(G.BOX(), theme === 'desert' ? 0xc9a27a : 0x7a5434, [q[0], top + 1.1, q[1]], [0, a2, 0], [0.25, 2.2, w]);
      }
      for (let i = 0; i < Math.floor(w / 6); i++) if (rng() < 0.6) B.smooth.add(G.BOX(), rng.pick([0xb71c1c, 0x1b5e20, 0x0d47a1, 0xf57f17, 0x6d4c41]), at3(L, -hx - 0.7, y0 + 3.5, -hz + (i + 0.5) * 6), [0, yaw, 0.35], [1.6, 0.1, 5.2]);
    } else if (t === 'diner') {
      box(B, L, { lx0: -hx, lx1: hx, lz0: -hz, lz1: hz, y0, y1: y0 + 4.4, front: shopKey, side: 'metal', col: 0xffffff, roofCol: 0x9aa0a6 });
      B.chrome.add(G.BOX(), 0xd8d8d8, at3(L, -hx - 0.05, y0 + 4.2, 0), [0, a2, 0], [0.12, 0.4, w + 0.2]);
      B.glow.add(G.BOX(), 0xff2d95, at3(L, -hx - 0.08, y0 + 3.9, 0), [0, a2, 0], [0.06, 0.12, w]);
      neonSign(B, L, -hx + 1, y0 + 4.8, 0, 6, 0);
    } else if (t === 'gas') {
      // canopy over pumps, shop behind, price sign
      const cz = 0;
      for (const [x, z] of [[-hx + 1, -5], [-hx + 1, 5], [-hx + 7, -5], [-hx + 7, 5]]) B.flat.add(G.BOX(), 0xeeeeee, at3(L, x, y0 + 2.5, z), [0, 0, 0], [0.4, 5, 0.4]);
      B.smooth.add(G.BOX(), 0xf4f4f4, at3(L, -hx + 4, y0 + 5.3, cz), [0, a2, 0], [9, 0.7, 13]);
      B.smooth.add(G.BOX(), 0xd32f2f, at3(L, -hx + 4, y0 + 5.3, cz), [0, a2, 0], [9.1, 0.25, 13.1]);
      B.glow.add(G.BOX(), 0xfff4d0, at3(L, -hx + 4, y0 + 4.92, cz), [0, a2, 0], [7, 0.04, 11]);
      for (const z of [-3, 3]) { B.flat.add(G.BOX(), 0x9a9a9a, at3(L, -hx + 4, y0 + 0.15, z), [0, a2, 0], [1.4, 0.3, 4]); for (const zz of [-1, 1]) B.smooth.add(G.BOX(), 0xc62828, at3(L, -hx + 4, y0 + 1.1, z + zz), [0, a2, 0], [0.6, 1.6, 0.8]); }
      box(B, L, { lx0: hx - 6, lx1: hx, lz0: -5, lz1: 5, y0, y1: y0 + 3.8, front: shopKey, side: 'concrete', col: 0xffffff, roofCol: 0x55555a });
      const q = L(-hx - 1, hz - 1.5); B.flat.add(G.BOX(), 0x666666, [q[0], y0 + 4, q[1]], [0, 0, 0], [0.35, 8, 0.35]);
      neonSign(B, L, -hx - 1, y0 + 8, hz - 1.5, 4, 2, 0.3);
    } else if (t === 'motel') {
      box(B, L, { lx0: -hx, lx1: hx, lz0: -hz, lz1: hz, y0, y1: y0 + 3.2, front: upper === 'brick' ? 'siding' : upper, side: upper === 'brick' ? 'siding' : upper, col: wallCol, roof: false });
      gable(B, L, -hx, hx, -hz, hz, y0 + 3.2, 1.6, 0.8, 0x5a4a3a, null, wallCol);
      for (let z = -hz + 2; z < hz - 1; z += 4) {
        B.flat.add(G.BOX(), [0x2e7d32, 0xc62828, 0x1565c0, 0xf9a825][Math.floor(z) & 3], at3(L, -hx - 0.04, y0 + 1.05, z), [0, a2, 0], [0.08, 2.1, 1.0]);
        B.glow.add(G.BOX(), 0xffe0a0, at3(L, -hx - 0.06, y0 + 2.4, z + 0.8), [0, a2, 0], [0.05, 0.18, 0.18]);
      }
      const q = L(-hx - 3, -hz + 2); B.flat.add(G.BOX(), 0x555555, [q[0], y0 + 4.5, q[1]], [0, 0, 0], [0.35, 9, 0.35]);
      neonSign(B, L, -hx - 3, y0 + 8.6, -hz + 2, 5, 1, 0.3); neonSign(B, L, -hx - 3, y0 + 7, -hz + 2, 4, 5, 0.3);
    } else if (t === 'church') {
      box(B, L, { lx0: -hx, lx1: hx, lz0: -hz, lz1: hz, y0, y1: y0 + 5, front: 'siding', side: 'siding', col: 0xffffff, roof: false });
      gable(B, L, -hx, hx, -hz, hz, y0 + 5, 4, 0.4, 0x3a3a40, 'siding', 0xffffff);
      box(B, L, { lx0: -hx - 2.6, lx1: -hx + 0.4, lz0: -1.5, lz1: 1.5, y0, y1: y0 + 11, front: 'siding', side: 'siding', col: 0xffffff, roofCol: 0x3a3a40 });
      B.flat.add(G.CONE(4), 0x3a3a40, at3(L, -hx - 1.1, y0 + 14, 0), [0, yaw + Math.PI / 4, 0], [2.3, 6, 2.3]);
      B.flat.add(G.BOX(), 0xd4af37, at3(L, -hx - 1.1, y0 + 17.6, 0), [0, a2, 0], [0.12, 1.4, 0.12]);
      B.flat.add(G.BOX(), 0xd4af37, at3(L, -hx - 1.1, y0 + 17.8, 0), [0, a2, 0], [0.12, 0.12, 0.8]);
    } else if (t === 'bar') {
      box(B, L, { lx0: -hx, lx1: hx, lz0: -hz, lz1: hz, y0, y1: y0 + 4, front: 'logs', side: 'logs', roofCol: 0x2a2a2a });
      neonSign(B, L, -hx - 0.3, y0 + 4.3, 0, 5, 3);
      for (let i = 0; i < 4; i++) choppers(B, L, -hx - 2.2, -hz + 2 + i * 1.6, y0 + 0.25, a2 + 0.4);
    }
    if (night && t !== 'gas') B.glow.add(G.BOX(), 0xffd890, at3(L, -hx - 2, y0 + 0.02, 0), [0, a2, 0], [3, 0.02, w * 0.7]);
  }
  function choppers(B, L, lx, lz, y, rot) {
    const G = RR.models.geo, q = L(lx, lz);
    for (const dz of [-0.75, 0.75]) B.flat.add(G.CYL(10), 0x111111, [q[0] + Math.sin(rot) * dz, y + 0.33, q[1] + Math.cos(rot) * dz], [0, rot, Math.PI / 2], [0.33, 0.12, 0.33]);
    B.chrome.add(G.BOX(), 0xb0b0b0, [q[0], y + 0.6, q[1]], [0, rot, 0], [0.25, 0.35, 1.3]);
    B.smooth.add(G.SPH(8, 6), rnd() < 0.5 ? 0x111111 : 0x8b0000, [q[0], y + 0.85, q[1]], [0, rot, 0], [0.2, 0.14, 0.32]);
  }

  // ------------------------------------------------------------------ animated props
  const ANIM_GEO = {};
  function animGeo() {
    if (ANIM_GEO.ok) return ANIM_GEO;
    const G = RR.models.geo, M = RR.models.Merge;
    let m = new M(); m.add(G.CYL(10, 0.55), 0xf2f2f2, [0, 30, 0], [0, 0, 0], [1.4, 60, 1.4]); m.add(G.BOX(), 0xf2f2f2, [0, 60.8, 0.6], [0, 0, 0], [1.8, 1.8, 4.5]); ANIM_GEO.tower = m.build();
    // blades radiate from the hub
    m = new M(); for (let i = 0; i < 3; i++) { const a = i * Math.PI * 2 / 3; m.add(G.BOX(), 0xfafafa, [Math.sin(a) * 11.5, Math.cos(a) * 11.5, 0], [0, 0, -a], [0.9, 23, 0.25]); } m.add(G.SPH(10, 8), 0xf0f0f0, [0, 0, 0], [0, 0, 0], [0.9, 0.9, 1.4]); ANIM_GEO.rotor = m.build();
    // pump jack
    m = new M(); m.add(G.BOX(), 0x555555, [0, 0.3, 0], [0, 0, 0], [1.6, 0.6, 7]); m.rod([0, 0.6, -0.8], [0, 4.2, 0], 0.12, 0x444444); m.rod([0, 0.6, 0.8], [0, 4.2, 0], 0.12, 0x444444); m.add(G.CYL(8), 0x6a6a6a, [0, 0.9, -3.0], [0, 0, 0], [0.18, 1.2, 0.18]); ANIM_GEO.jackBase = m.build();
    m = new M(); m.add(G.BOX(), 0xd4a017, [0, 0, 0], [0, 0, 0], [0.4, 0.45, 6.4]); m.add(G.BOX(), 0xd4a017, [0, -0.6, -3.3], [0.3, 0, 0], [0.5, 1.5, 0.7]); m.add(G.BOX(), 0x333333, [0, -0.5, 3.0], [0, 0, 0], [0.6, 1.0, 0.8]); ANIM_GEO.jackBeam = m.build();
    // farm windmill
    m = new M(); for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) m.rod([x, 0, z], [x * 0.2, 11, z * 0.2], 0.07, 0x777777, 5); m.add(G.BOX(), 0x777777, [0, 11, 0.3], [0, 0, 0], [0.5, 0.5, 1]); m.add(G.BOX(), 0x999999, [0, 11, 1.8], [0, 0, 0], [0.05, 0.9, 2]); ANIM_GEO.mill = m.build();
    m = new M(); for (let i = 0; i < 14; i++) { const a = i / 14 * Math.PI * 2; m.add(G.BOX(), 0xbbbbbb, [Math.sin(a) * 1.0, Math.cos(a) * 1.0, 0], [0, 0, -a], [0.32, 1.7, 0.03]); } ANIM_GEO.fan = m.build();
    // sailboat
    m = new M(); m.add(G.BOX(), 0xf4f4f4, [0, 0.4, 0], [0, 0, 0], [2.2, 0.9, 7]); m.add(G.CONE(4), 0xf4f4f4, [0, 0.4, -4.3], [-Math.PI / 2, Math.PI / 4, 0], [1.5, 2.2, 0.62]); m.add(G.BOX(), 0x1d3557, [0, 0.95, 0], [0, 0, 0], [2.25, 0.18, 7.05]); m.rod([0, 0.8, -0.8], [0, 10, -0.8], 0.08, 0xcccccc);
    m.add(G.BOX(), 0xffffff, [0, 5.3, 0.9], [0, 0, 0], [0.05, 8.6, 3.2]); ANIM_GEO.boat = m.build();
    ANIM_GEO.ok = true;
    return ANIM_GEO;
  }
  function animated(B, pr, ctx) {
    const A = animGeo(), { p, rng } = ctx, MAT = RR.models.MAT, g = new T.Group();
    const mesh = (geo, mat, shadow = false) => { const m = new T.Mesh(geo, mat); m.castShadow = shadow; return m; };
    g.position.set(p.x, p.y - 0.2, p.z); g.rotation.y = -ctx.hd + (pr.rot || 0);
    if (pr.kind === 'turbine') {
      const s = pr.sc; g.scale.setScalar(s); g.rotation.y = rng() * 0.6 - 0.3 + 0.8;
      g.add(mesh(A.tower, MAT.flat)); const r = mesh(A.rotor, MAT.flat); r.position.set(0, 60.8, -2.0); g.add(r);
      const sp = rng.range(0.5, 0.9); g.userData.tick = t => { r.rotation.z = t * sp + pr.s; };
    } else if (pr.kind === 'pumpjack') {
      g.add(mesh(A.jackBase, MAT.flat, true)); const b = mesh(A.jackBeam, MAT.flat, true); b.position.set(0, 4.4, 0); g.add(b);
      const sp = rng.range(1.2, 1.8); g.userData.tick = t => { b.rotation.x = Math.sin(t * sp + pr.s) * 0.35; };
    } else if (pr.kind === 'windmill') {
      g.add(mesh(A.mill, MAT.flat, true)); const f = mesh(A.fan, MAT.flat); f.position.set(0, 11, -0.3); g.add(f);
      const sp = rng.range(1.5, 3); g.userData.tick = t => { f.rotation.z = t * sp; };
    } else if (pr.kind === 'boat') {
      g.position.y = 0; g.add(mesh(A.boat, MAT.flat)); g.rotation.y = rng() * 6.28;
      const ph = rng() * 6; g.userData.tick = t => { g.position.y = Math.sin(t * 1.1 + ph) * 0.25; g.rotation.z = Math.sin(t * 0.9 + ph) * 0.06; };
    } else return false;
    B.anim.push(g);
    return true;
  }

  // ------------------------------------------------------------------ small things
  function small(B, pr, ctx) {
    const G = RR.models.geo, { p, rng, night } = ctx, hd = ctx.hd;
    const yaw = -hd + (pr.d < 0 ? Math.PI : 0) + (pr.turn || 0), L = frame(p.x, p.z, yaw), y = p.y;
    const a2 = (() => { const a = L(0, 0), b = L(0, 1); return Math.atan2(b[0] - a[0], b[1] - a[1]); })();
    switch (pr.kind) {
      case 'billboard': billboard(B, L, 0, y, 0, 9, 4, pr.v % S.ADS, false); return true;
      case 'welcome': {
        for (const z of [-1.6, 1.6]) B.flat.add(G.BOX(), 0x8a8a8a, at3(L, 0.05, y + 1.3, z), [0, 0, 0], [0.12, 2.6, 0.12]);
        const i = pr.v % 8, col = i % 2, row = Math.floor(i / 2);
        panel(B.tex('signs'), L(0, -2), L(0, 2), y + 1.6, y + 3.6, L(1, 0), [col * 0.5, 1 - (row + 1) * 0.25, col * 0.5 + 0.5, 1 - row * 0.25]);
        B.flat.add(G.BOX(), 0x1f3a2a, at3(L, 0.06, y + 2.6, 0), [0, a2, 0], [0.06, 2, 4]);
        return true;
      }
      case 'lighthouse': {
        for (let i = 0; i < 6; i++) B.smooth.add(G.CYL(14, 0.95), i % 2 ? 0xc62828 : 0xf5f5f5, at3(L, 0, y + 1.5 + i * 3, 0), [0, 0, 0], [2.4 - i * 0.18, 3, 2.4 - i * 0.18]);
        B.chrome.add(G.CYL(10), 0x333333, at3(L, 0, y + 19, 0), [0, 0, 0], [1.4, 0.5, 1.4]);
        B.glow.add(G.CYL(10), 0xfff2b0, at3(L, 0, y + 20.2, 0), [0, 0, 0], [1.0, 1.8, 1.0]);
        B.flat.add(G.CONE(10), 0x222222, at3(L, 0, y + 21.8, 0), [0, 0, 0], [1.5, 1.6, 1.5]);
        box(B, L, { lx0: 2.5, lx1: 8, lz0: -3, lz1: 3, y0: y - 0.2, y1: y + 3, front: 'stucco', side: 'stucco', col: 0xffffff, roof: false });
        gable(B, L, 2.5, 8, -3, 3, y + 3, 2, 0.3, 0xa33a2a, null, 0xffffff);
        return true;
      }
      case 'cow': {
        const c = pr.v % 3 === 0 ? 0x3b2a1e : pr.v % 3 === 1 ? 0xf2f2f2 : 0x8a5a3a, r = pr.rot;
        const Lc = frame(p.x, p.z, r);
        B.flat.add(G.BOX(), c, at3(Lc, 0, y + 1.0, 0), [0, r, 0], [0.75, 0.75, 1.7]);
        if (pr.v % 3 === 1) B.flat.add(G.BOX(), 0x111111, at3(Lc, 0.39, y + 1.05, 0.2), [0, r, 0], [0.02, 0.45, 0.6]);
        B.flat.add(G.BOX(), c, at3(Lc, 0, y + 0.95, -1.05), [0.4, r, 0], [0.4, 0.45, 0.6]);
        for (const [x, z] of [[-0.25, -0.6], [0.25, -0.6], [-0.25, 0.6], [0.25, 0.6]]) B.flat.add(G.BOX(), c, at3(Lc, x, y + 0.32, z), [0, r, 0], [0.15, 0.65, 0.15]);
        return true;
      }
      case 'haybale': B.flat.add(G.CYL(12), 0xd8b45a, [p.x, y + 0.65, p.z], [0, pr.rot, Math.PI / 2], [0.7, 1.3, 0.7], 0.12); return true;
      case 'arch': {
        const c = ctx.theme === 'desert' ? 0xa4553a : 0x8a8070, s = pr.sc;
        for (const z of [-7, 7]) B.flat.add(G.ICO(0), c, at3(L, 0, y + 5 * s, z * s), [0.3, z, 0.2], [3 * s, 7 * s, 3 * s], 0.2);
        B.flat.add(G.ICO(0), c, at3(L, 0, y + 11 * s, 0), [0.1, 0, 0.3], [3 * s, 2.4 * s, 10 * s], 0.2);
        return true;
      }
      case 'tent': B.smooth.add(G.CONE(4), rng.pick([0xe65100, 0x2e7d32, 0x1565c0, 0xfbc02d]), [p.x, y + 0.9, p.z], [0, pr.rot, 0], [1.7, 1.8, 1.7]); return true;
      case 'logpile': for (let i = 0; i < 9; i++) B.flat.add(G.CYL(7), 0x7a5232, at3(L, -1 + (i % 4) * 0.5 + Math.floor(i / 4) * 0.25, y + 0.25 + Math.floor(i / 4) * 0.45, 0), [Math.PI / 2, a2, 0], [0.24, 5, 0.24]); return true;
      case 'watertower': {
        for (const [x, z] of [[-2, -2], [2, -2], [-2, 2], [2, 2]]) B.flat.add(G.BOX(), 0x6a6a6a, at3(L, x * 0.8, y + 6, z * 0.8), [0, 0, 0], [0.3, 12, 0.3]);
        B.smooth.add(G.CYL(16), 0xd0d4d8, [p.x, y + 15, p.z], [0, 0, 0], [3.6, 6, 3.6]);
        B.smooth.add(G.CONE(16), 0x8a9096, [p.x, y + 19.2, p.z], [0, 0, 0], [3.8, 2.4, 3.8]);
        return true;
      }
      case 'busstop': {
        B.flat.add(G.BOX(), 0x2f3a45, at3(L, 0.6, y + 1.2, 0), [0, a2, 0], [0.1, 2.4, 3.6]);
        B.flat.add(G.BOX(), 0x2f3a45, at3(L, 0, y + 2.45, 0), [0, a2, 0], [1.6, 0.1, 3.8]);
        B.flat.add(G.BOX(), 0x6d4c41, at3(L, 0.25, y + 0.5, 0), [0, a2, 0], [0.5, 0.08, 3]);
        B.glow.add(G.BOX(), night ? 0xfff0c0 : 0xd8e8f0, at3(L, 0.54, y + 1.5, -1.2), [0, a2, 0], [0.04, 1.4, 1]);
        return true;
      }
      case 'bench': B.flat.add(G.BOX(), 0x6d4c41, at3(L, 0, y + 0.5, 0), [0, a2, 0], [0.5, 0.08, 1.8]); B.flat.add(G.BOX(), 0x6d4c41, at3(L, 0.22, y + 0.8, 0), [0, a2, 0], [0.06, 0.5, 1.8]); B.flat.add(G.BOX(), 0x222222, at3(L, 0, y + 0.25, 0), [0, a2, 0], [0.4, 0.5, 1.6]); return true;
      case 'bin': B.smooth.add(G.CYL(10), 0x2e7d32, [p.x, y + 0.5, p.z], [0, 0, 0], [0.3, 1, 0.3]); return true;
      case 'planter': B.flat.add(G.BOX(), 0x8d8a86, [p.x, y + 0.3, p.z], [0, a2, 0], [1.2, 0.6, 1.2]); B.flat.add(G.CYL(5), 0x5a4030, [p.x, y + 1.6, p.z], [0, 0, 0], [0.12, 2.4, 0.12]); B.flat.add(G.ICO(0), 0x3f7a2a, [p.x, y + 3.4, p.z], [rnd(), rnd(), 0], [1.6, 1.4, 1.6], 0.15); return true;
      case 'trafficlight': {
        B.chrome.add(G.CYL(8), 0x333840, at3(L, 0, y + 2.9, 0), [0, 0, 0], [0.12, 5.8, 0.12]);
        const end = L(-4.5, 0); B.chrome.rod([...at3(L, 0, y + 5.6, 0)], [end[0], y + 5.6, end[1]], 0.08, 0x333840, 6);
        for (const lx of [-3.5, -1.2]) {
          B.flat.add(G.BOX(), 0x1a1a1a, at3(L, lx, y + 5.0, 0), [0, a2, 0], [0.35, 1.1, 0.35]);
          const lit = Math.floor(pr.s) % 3;
          [0xff2020, 0xffb000, 0x20ff60].forEach((c, k) => (k === lit ? B.glow : B.flat).add(G.SPH(6, 4), k === lit ? c : 0x262626, at3(L, lx, y + 5.35 - k * 0.33, 0.19), [0, 0, 0], 0.11));
        }
        return true;
      }
      case 'delineator': B.flat.add(G.BOX(), 0xf2f2f2, [p.x, y + 0.5, p.z], [0, a2, 0], [0.1, 1, 0.1]); B.glow.add(G.BOX(), pr.d > 0 ? 0xff3a1a : 0xffc400, at3(L, -0.03, y + 0.85, 0), [0, a2, 0], [0.06, 0.18, 0.06]); return true;
      case 'barrier': for (let z = -2; z <= 2; z += 1) B.chrome.add(G.BOX(), 0xbfc4c8, at3(L, 0, y + 0.55, z), [0, a2, 0], [0.06, 1.1, 0.06]); B.chrome.add(G.BOX(), 0xbfc4c8, at3(L, 0, y + 1.05, 0), [0, a2, 0], [0.06, 0.06, 4.1]); B.smooth.add(G.BOX(), pr.v ? 0xd32f2f : 0x1565c0, at3(L, -0.04, y + 0.75, 0), [0, a2, 0], [0.02, 0.5, 4]); return true;
      case 'crate': {
        // shotgun pickup: glowing crate floating over the road
        B.glow.add(G.BOX(), 0xffb300, [p.x, ctx.base + 1.0, p.z], [0, a2 + 0.6, 0], [0.9, 0.9, 0.9]);
        B.flat.add(G.BOX(), 0x5a3a20, [p.x, ctx.base + 1.0, p.z], [0, a2 + 0.6, 0], [0.98, 0.5, 0.98]);
        B.pool.add(QUADG(), 0xffffff, [p.x, ctx.base + 0.05, p.z], [-Math.PI / 2, 0, 0], [4, 4, 1]);
        return true;
      }
    }
    return false;
  }
  let quadG = null; const QUADG = () => quadG || (quadG = new T.PlaneGeometry(1, 1).toNonIndexed());

  // entry point from world.js. ctx: { p (ground position), hd, base (road height), rng, night, theme }
  function prop(B, pr, ctx) {
    switch (pr.kind) {
      case 'building': case 'tower': cityBuilding(B, pr, ctx); return true;
      case 'house': case 'cabin': case 'barn': case 'shack': case 'beach': case 'farm': house(B, pr, ctx); return true;
      case 'tb': townBuilding(B, pr, ctx); return true;
      case 'turbine': case 'pumpjack': case 'windmill': case 'boat': return animated(B, pr, ctx);
    }
    return small(B, pr, ctx);
  }

  // ------------------------------------------------------------------ people
  // Instanced pedestrians and crowds: body, head, hair, arms and legs, posed each frame near the cameras.
  class People {
    constructor(scene, list, track, cap) {
      const G = RR.models.geo, M = RR.models.Merge;
      this.list = list; this.track = track; this.cap = cap;
      const geo = (fn) => { const m = new M(); fn(m); return m.build(); };
      const body = geo(m => { m.add(G.BOX(), 0xffffff, [0, 1.2, 0], [0, 0, 0], [0.44, 0.62, 0.26]); m.add(G.BOX(), 0xffffff, [0, 0.9, 0], [0, 0, 0], [0.4, 0.14, 0.24]); });
      const head = geo(m => { m.add(G.SPH(8, 6), 0xffffff, [0, 1.66, 0], [0, 0, 0], 0.125); m.add(G.CYL(6), 0xffffff, [0, 1.52, 0], [0, 0, 0], [0.06, 0.1, 0.06]); });
      const hair = geo(m => m.add(G.SPH(8, 6), 0xffffff, [0, 1.72, 0.025], [0, 0, 0], [0.135, 0.09, 0.14]));
      const arm = geo(m => { m.add(G.BOX(), 0xffffff, [0, -0.29, 0], [0, 0, 0], [0.11, 0.58, 0.11]); m.add(G.SPH(6, 4), 0xffffff, [0, -0.62, 0], [0, 0, 0], 0.06); });
      const leg = geo(m => { m.add(G.BOX(), 0xffffff, [0, -0.42, 0], [0, 0, 0], [0.15, 0.84, 0.16]); m.add(G.BOX(), 0x777777, [0, -0.86, -0.05], [0, 0, 0], [0.15, 0.08, 0.27]); });
      const mat = new T.MeshStandardMaterial({ roughness: 0.8, vertexColors: true });
      const mk = (g, n) => { const im = new T.InstancedMesh(g, mat, n); im.frustumCulled = false; im.castShadow = true; im.count = 0; im.setColorAt(0, new T.Color(1, 1, 1)); scene.add(im); return im; };
      this.m = { body: mk(body, cap), head: mk(head, cap), hair: mk(hair, cap), arm: mk(arm, cap * 2), leg: mk(leg, cap * 2) };
      this._m = new T.Matrix4(); this._l = new T.Matrix4(); this._q = new T.Quaternion(); this._e = new T.Euler(); this._p = new T.Vector3(); this._s = new T.Vector3(1, 1, 1); this._c = new T.Color(); this._o = new T.Vector3();
    }
    update(t, views) {
      const tr = this.track, M = this.m;
      let n = 0;
      for (const P of this.list) {
        if (n >= this.cap) break;
        let s = P.s, walk = 0;
        if (P.kind === 'walk') { const span = P.b - P.a; let u = ((P.s - P.a) + P.v * t) % (2 * span); if (u < 0) u += 2 * span; s = P.a + (u < span ? u : 2 * span - u); walk = u < span ? 1 : -1; }
        let near = false;
        for (const v of views) if (s > v.s - 60 && s < v.s + 260) { near = true; break; }
        if (!near) continue;
        tr.pos(s, P.d, 0, this._p); this._p.y = tr.ground(s, P.d, this._p.x, this._p.z);
        const hd = tr.heading(s);
        let yaw = -hd + (walk ? (walk * Math.sign(P.v) > 0 ? 0 : Math.PI) : (P.d > 0 ? Math.PI / 2 : -Math.PI / 2)) + (P.turn || 0);
        const ph = t * (P.kind === 'walk' ? Math.abs(P.v) * 4.2 : 3) + P.ph;
        let bob = 0, swing = 0, armL = 0, armR = 0, armZ = 0.08;
        if (P.kind === 'walk') { swing = Math.sin(ph) * 0.5; bob = Math.abs(Math.cos(ph)) * 0.05; armL = -swing * 0.8; armR = swing * 0.8; }
        else if (P.kind === 'cheer') { const w = Math.sin(ph * 2.2); armZ = 2.5 + w * 0.35; bob = Math.max(0, Math.sin(ph * 1.7)) * 0.18; }
        else { armL = armR = Math.sin(ph * 0.5) * 0.05; }
        this._p.y += bob;
        this._q.setFromEuler(this._e.set(0, yaw, 0));
        this._m.compose(this._p, this._q, this._s);
        for (const k of ['body', 'head', 'hair']) M[k].setMatrixAt(n, this._m);
        M.body.setColorAt(n, this._c.set(P.shirt)); M.head.setColorAt(n, this._c.set(P.skin)); M.hair.setColorAt(n, this._c.set(P.hair));
        const limb = (im, i, x, y, rx, rz, col) => {
          this._l.compose(this._o.set(x, y, 0), this._q.setFromEuler(this._e.set(rx, 0, rz)), this._s);
          im.setMatrixAt(i, this._l.premultiply(this._m)); im.setColorAt(i, this._c.set(col));
        };
        limb(M.arm, n * 2, -0.27, 1.48, armL, -armZ, P.shirt); limb(M.arm, n * 2 + 1, 0.27, 1.48, armR, armZ, P.shirt);
        limb(M.leg, n * 2, -0.1, 0.86, swing, 0, P.pants); limb(M.leg, n * 2 + 1, 0.1, 0.86, -swing, 0, P.pants);
        n++;
      }
      for (const k in M) { const im = M[k]; im.count = k === 'arm' || k === 'leg' ? n * 2 : n; im.instanceMatrix.needsUpdate = true; if (im.instanceColor) im.instanceColor.needsUpdate = true; }
    }
  }

  // ------------------------------------------------------------------ sky dressing: clouds, horizon backdrop, birds
  function cloudTex(kind) {
    const c = cv(512, 256, (x) => {
      if (kind === 'cirrus') {
        for (let i = 0; i < 40; i++) { const y = 80 + rnd() * 100, X = rnd() * 400; const g = x.createLinearGradient(X, 0, X + 200, 0); g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.5, 'rgba(255,255,255,0.35)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(X, y, 200, 2 + rnd() * 4); }
        return;
      }
      const blobs = [];
      for (let i = 0; i < 34; i++) { const t = i / 34; blobs.push([60 + t * 390 + (rnd() - 0.5) * 40, 160 - Math.sin(t * Math.PI) * (70 + rnd() * 40) + rnd() * 20, 24 + Math.sin(t * Math.PI) * 50 * rnd() + 20]); }
      for (const [X, Y, R] of blobs) { const g = x.createRadialGradient(X, Y, 0, X, Y, R); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.7, 'rgba(255,255,255,0.8)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.beginPath(); x.arc(X, Y, R, 0, 7); x.fill(); }
      // shade the underside
      x.globalCompositeOperation = 'source-atop';
      const g = x.createLinearGradient(0, 60, 0, 220); g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(1, 'rgba(110,120,150,0.75)'); x.fillStyle = g; x.fillRect(0, 0, 512, 256);
    });
    const t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace; return t;
  }
  // a panorama strip of distant mountains / mesas / skyline, drawn per theme
  function backdropTex(id, th) {
    const W = 2048, Hh = 256;
    const sky = new T.Color(th.skyHorizon), fog = new T.Color(th.fog);
    const mix = (hex, k) => { const c = new T.Color(hex).lerp(fog, k); return '#' + c.getHexString(); };
    const c = cv(W, Hh, (x) => {
      const ridge = (base, amp, oct, col, seed, jag = 1, mesa = false, from = 0, to = 1) => {
        x.fillStyle = col; x.beginPath(); x.moveTo(0, Hh);
        for (let i = 0; i <= W; i += 4) {
          const u = i / W;
          let h = 0;
          if (u >= from && u <= to) {
            const e = Math.min(1, (u - from) * 12, (to - u) * 12);
            h = (N.fbm1(u * oct, seed, 4) * 0.5 + 0.5) * amp * jag;
            if (mesa) h = h > amp * 0.35 ? amp * 0.6 + (h - amp * 0.35) * 0.1 : h * 0.3;
            h *= e;
          }
          x.lineTo(i, Hh - base - h);
        }
        x.lineTo(W, Hh); x.fill();
      };
      switch (id) {
        case 'forest':
          ridge(40, 190, 22, mix(0x8fa3b8, 0.55), 3, 1); ridge(30, 120, 30, mix(0x5d7a8c, 0.45), 7, 1); ridge(20, 70, 40, mix(0x2e4a3a, 0.35), 11);
          x.globalCompositeOperation = 'source-atop'; { const g = x.createLinearGradient(0, 0, 0, 120); g.addColorStop(0, 'rgba(255,255,255,0.9)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, W, 120); }
          break;
        case 'valley': ridge(30, 90, 10, mix(0x7c93b0, 0.55), 4); ridge(20, 60, 16, mix(0x5b7c55, 0.45), 9); break;
        case 'desert': ridge(30, 160, 9, mix(0xb76a4a, 0.5), 5, 1, true); ridge(20, 110, 14, mix(0x9c4a32, 0.35), 8, 1, true); break;
        case 'coast': ridge(25, 120, 9, mix(0x8a9a8a, 0.55), 6, 1, false, 0.55, 0.95); ridge(18, 80, 15, mix(0x6a7d5a, 0.4), 2, 1, false, 0.6, 0.9); break;
        case 'city': {
          for (let layer = 0; layer < 2; layer++) {
            for (let i = 0; i < W;) {
              const w = 12 + rnd() * 30, h = 30 + rnd() * (layer ? 120 : 180);
              x.fillStyle = layer ? '#14121e' : '#221d30'; x.fillRect(i, Hh - h, w, h);
              if (layer) for (let k = 0; k < h * w / 40; k++) if (rnd() < 0.35) { x.fillStyle = rnd() < 0.8 ? 'rgba(255,210,140,0.9)' : 'rgba(170,220,255,0.9)'; x.fillRect(i + 2 + rnd() * (w - 4), Hh - h + 3 + rnd() * (h - 6), 2, 2); }
              if (layer && h > 110 && rnd() < 0.4) { x.fillStyle = '#ff2a2a'; x.fillRect(i + w / 2 - 1, Hh - h - 4, 3, 3); }
              i += w + rnd() * 4;
            }
          }
          const g = x.createLinearGradient(0, Hh - 90, 0, Hh); g.addColorStop(0, 'rgba(255,140,60,0)'); g.addColorStop(1, 'rgba(255,140,60,0.35)'); x.fillStyle = g; x.fillRect(0, Hh - 90, W, 90);
          break;
        }
      }
    });
    const t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace; t.wrapS = T.RepeatWrapping; return t;
  }

  class Sky {
    constructor(scene, track, quality) {
      const th = track.theme, id = track.themeId, low = quality.name === 'low';
      this.scene = scene; this.th = th;
      // horizon panorama on a big cylinder that travels with the camera
      const R = 3200, Hh = 900;
      const geo = new T.CylinderGeometry(R, R, Hh, 64, 1, true);
      const mat = new T.MeshBasicMaterial({ map: backdropTex(id, th), transparent: true, side: T.BackSide, fog: false, depthWrite: false });
      this.ring = new T.Mesh(geo, mat); this.ring.renderOrder = -9; this.ring.frustumCulled = false;
      scene.add(this.ring);
      // clouds wrap around the camera so there are always some overhead
      const n = low ? 14 : th.night ? 10 : { coast: 30, forest: 38, valley: 28, desert: 14 }[id] || 24;
      const texs = [cloudTex('cu'), cloudTex('cu'), cloudTex('cu'), cloudTex('cirrus')];
      const tint = new T.Color(th.night ? 0x5a5070 : 0xffffff).lerp(new T.Color(th.skyHorizon), th.night ? 0.2 : 0.35);
      this.clouds = [];
      const rng = RR.rng(track.seed + 5);
      for (let i = 0; i < n; i++) {
        const cirrus = rng() < (id === 'desert' ? 0.6 : 0.2);
        const sp = new T.Sprite(new T.SpriteMaterial({ map: texs[cirrus ? 3 : rng.int(0, 2)], fog: false, depthWrite: false, transparent: true, color: tint, opacity: th.night ? 0.25 : cirrus ? 0.6 : rng.range(0.7, 0.95) }));
        const w = cirrus ? rng.range(900, 1600) : rng.range(380, 900);
        sp.scale.set(w, w * (cirrus ? 0.25 : 0.42), 1); sp.renderOrder = -8;
        this.clouds.push({ sp, x: rng.range(-3500, 3500), z: rng.range(-3500, 3500), y: cirrus ? rng.range(900, 1300) : rng.range(380, 750), drift: rng.range(2, 6) });
        scene.add(sp);
      }
      // birds: a few flocks of flapping Vs (gulls by the sea)
      this.birds = null;
      if (!low && !th.night) {
        const M = new RR.models.Merge(), G = RR.models.geo;
        M.add(G.BOX(), 0xffffff, [-0.35, 0, 0], [0, 0, 0.35], [0.7, 0.04, 0.22]); M.add(G.BOX(), 0xffffff, [0.35, 0, 0], [0, 0, -0.35], [0.7, 0.04, 0.22]);
        const im = new T.InstancedMesh(M.build(), new T.MeshBasicMaterial({ color: id === 'coast' ? 0xf4f4f4 : 0x1e1e22, fog: true }), 36);
        im.frustumCulled = false; scene.add(im); this.birds = im;
        this.flocks = [0, 1, 2].map(k => ({ x: rng.range(-400, 400), z: rng.range(-400, 400), y: rng.range(40, 110), dir: rng() * 6.28, n: 12, ph: rng() * 9 }));
      }
      this._m = new T.Matrix4(); this._q = new T.Quaternion(); this._e = new T.Euler(); this._p = new T.Vector3(); this._s = new T.Vector3(1, 1, 1);
    }
    frame(cam, t) {
      const cx = cam.position.x, cz = cam.position.z;
      this.ring.position.set(cx, cam.position.y + 280, cz);
      const span = 7000;
      for (const c of this.clouds) {
        let x = ((c.x + t * c.drift - cx) % span + span * 1.5) % span - span / 2, z = ((c.z - cz) % span + span * 1.5) % span - span / 2;
        c.sp.position.set(cx + x, cam.position.y * 0.3 + c.y, cz + z);
      }
      if (this.birds) {
        let i = 0;
        for (const f of this.flocks) {
          const fx = cx + ((f.x + Math.cos(f.dir) * t * 9 - cx) % 1600 + 2400) % 1600 - 800, fz = cz + ((f.z + Math.sin(f.dir) * t * 9 - cz) % 1600 + 2400) % 1600 - 800;
          for (let k = 0; k < f.n; k++) {
            const row = Math.ceil(k / 2), side = k % 2 ? 1 : -1;
            const flap = Math.sin(t * 7 + k + f.ph);
            this._p.set(fx + Math.cos(f.dir) * -row * 4 + Math.sin(f.dir) * side * row * 3, cam.position.y * 0.5 + f.y + Math.sin(t + k) * 1.5, fz + Math.sin(f.dir) * -row * 4 - Math.cos(f.dir) * side * row * 3);
            this._q.setFromEuler(this._e.set(0, -f.dir + Math.PI / 2, 0));
            this._s.set(1.6, 1 + flap * 0.8, 1.6);
            this._m.compose(this._p, this._q, this._s); this.birds.setMatrixAt(i++, this._m);
          }
        }
        this.birds.count = i; this.birds.instanceMatrix.needsUpdate = true;
      }
    }
  }

  // ------------------------------------------------------------------ setup
  const S = RR.scenery = {
    init(renderer) {
      if (T) return; T = window.THREE; aniso = Math.min(8, renderer.capabilities.getMaxAnisotropy());
      const P = RR.models.Merge.prototype;
      P.tri = function (a, b, c, col, uv) {
        const e1 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], e2 = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
        let nx = e1[1] * e2[2] - e1[2] * e2[1], ny = e1[2] * e2[0] - e1[0] * e2[2], nz = e1[0] * e2[1] - e1[1] * e2[0];
        const L = Math.hypot(nx, ny, nz) || 1; nx /= L; ny /= L; nz /= L;
        for (const [v, k] of [[a, 0], [b, 1], [c, 2]]) { this.p.push(v[0], v[1], v[2]); this.n.push(nx, ny, nz); this.c.push(col.r, col.g, col.b); if (this.uv) this.uv.push(uv[k * 2], uv[k * 2 + 1]); }
      };
      makeTextures();
    },
    material, prop, People, Sky,
    TEX_KEYS: () => Object.keys(TILE).concat(['ads', 'neon', 'signs']),
    SHIRTS: [0xd32f2f, 0x1976d2, 0x388e3c, 0xfbc02d, 0xf57c00, 0x7b1fa2, 0xffffff, 0x212121, 0x00897b, 0xc2185b, 0x5d4037, 0x90a4ae],
    PANTS: [0x1f2a44, 0x222222, 0x3e3a33, 0x4e5b6e, 0x6d5c45, 0x1a237e],
    SKIN: [0xf1c27d, 0xe0ac69, 0xc68642, 0x8d5524, 0xffdbac, 0x5c3a21],
    HAIR: [0x1b1b1b, 0x3b2314, 0x6a4423, 0xc9a35a, 0x8a8a8a, 0xa0342a],
  };
})();
