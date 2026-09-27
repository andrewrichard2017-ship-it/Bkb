// The hall venue: crowd, lighting rig, ring canvas, ropes and corner posts. Also the venue switch (bottom).
(() => {
  'use strict';
  const BK = window.BK, ctx = BK.ctx, D = BK.draw, W = BK.W, H = BK.H, R = BK.RING;
  const { lerp } = BK;
  const AR = { flashes: [], fans: [] };

  // ---------- crowd, pre-rendered once (it reads as a soft background at any zoom) ----------
  const CX0 = -420, CW = W + 840, CH = 480, CS = 1.5;
  const crowdCanvas = document.createElement('canvas');
  crowdCanvas.width = CW * CS; crowdCanvas.height = CH * CS;
  (() => {
    const c = crowdCanvas.getContext('2d');
    c.scale(CS, CS); c.translate(-CX0, 0);
    const shirts = ['#3a2a22', '#2a2f3a', '#4a3a2a', '#2e3a2e', '#3a2230', '#57504a', '#6b2a2a', '#23324f'];
    for (let row = 0; row < 9; row++) {
      const y = 120 + row * 38, r = 10 + row * 1.5, n = Math.round((CW / (r * 2.6)));
      const light = 0.35 + row * 0.07;
      for (let i = 0; i < n; i++) {
        const x = CX0 + (i + BK.srand() * 0.5) * (CW / n), yy = y + BK.srand() * 10;
        c.fillStyle = BK.shade(shirts[Math.floor(BK.srand() * shirts.length)], light);
        c.beginPath(); c.ellipse(x, yy + r * 1.9, r * 1.45, r * 1.3, 0, 0, Math.PI * 2); c.fill();
        c.fillStyle = `hsl(${18 + BK.srand() * 18},${25 + BK.srand() * 20}%,${12 + row * 3.2 + BK.srand() * 8}%)`;
        c.beginPath(); c.arc(x, yy, r, 0, Math.PI * 2); c.fill();
        if (BK.srand() < 0.12) AR.fans.push({ x, y: yy, r, ph: BK.srand() * 6, col: c.fillStyle, row });
      }
    }
    // atmospheric falloff toward the back
    const g = c.createLinearGradient(0, 80, 0, CH);
    g.addColorStop(0, 'rgba(12,9,8,0.92)'); g.addColorStop(0.5, 'rgba(12,9,8,0.35)'); g.addColorStop(1, 'rgba(12,9,8,0.1)');
    c.fillStyle = g; c.fillRect(CX0, 0, CW, CH);
  })();

  AR.update = (dt, excitement) => {
    const rate = 0.6 + excitement * 10;
    if (Math.random() < rate * dt) AR.flashes.push({ x: BK.rnd(-300, W + 300), y: BK.rnd(140, 430), t: 0 });
    for (const f of AR.flashes) f.t += dt;
    AR.flashes = AR.flashes.filter(f => f.t < 0.18);
  };

  AR.drawBackdrop = (t, excitement) => {
    const bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, '#0a0807'); bg.addColorStop(0.5, '#1a1311'); bg.addColorStop(1, '#0d0a09');
    ctx.fillStyle = bg; ctx.fillRect(-W, -H, W * 3, H * 3);

    ctx.drawImage(crowdCanvas, CX0, 0, CW, CH);
    // fans on their feet when the crowd is up
    for (const f of AR.fans) {
      const up = Math.max(0, Math.sin(t * 7 + f.ph)) * (4 + excitement * 14);
      if (excitement < 0.15 && up < 3) continue;
      ctx.fillStyle = f.col;
      D.circle(f.x, f.y - up, f.r); ctx.fill();
      if (excitement > 0.35) { // arms in the air
        ctx.strokeStyle = f.col; ctx.lineWidth = f.r * 0.55; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(f.x - f.r, f.y - up + f.r); ctx.lineTo(f.x - f.r * 1.6, f.y - up - f.r * 1.6);
        ctx.moveTo(f.x + f.r, f.y - up + f.r); ctx.lineTo(f.x + f.r * 1.6, f.y - up - f.r * 1.6); ctx.stroke();
      }
    }
    for (const f of AR.flashes) {
      const a = 1 - f.t / 0.18;
      const g = ctx.createRadialGradient(f.x, f.y, 0, f.x, f.y, 40);
      g.addColorStop(0, `rgba(255,255,255,${a})`); g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g; ctx.fillRect(f.x - 40, f.y - 40, 80, 80);
    }

    // lighting truss
    ctx.strokeStyle = '#2b2b2f'; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(-200, 60); ctx.lineTo(W + 200, 60); ctx.moveTo(-200, 92); ctx.lineTo(W + 200, 92); ctx.stroke();
    ctx.lineWidth = 2; ctx.beginPath();
    for (let x = -200; x < W + 200; x += 32) { ctx.moveTo(x, 60); ctx.lineTo(x + 16, 92); ctx.lineTo(x + 32, 60); }
    ctx.stroke();
    for (let i = 0; i < 6; i++) {
      const x = 330 + i * 188;
      ctx.fillStyle = '#16161a'; D.rr(x - 18, 90, 36, 30, 6); ctx.fill();
      ctx.fillStyle = '#fff4d8'; ctx.beginPath(); ctx.ellipse(x, 120, 13, 4, 0, 0, Math.PI * 2); ctx.fill();
    }
    AR.drawRamps(t); // in front of the truss so the arches read clearly
  };

  // ---------- entrance ramps ----------
  // Each corner has a raised walkway from an entrance arch up in the stands down to its back corner.
  // The path is in ring coordinates (u across, z depth; negative z is behind the ring) so fighters can walk it.
  BK.RAMP = { top: [-0.9, -0.72], bottom: [0.0, -0.06] };
  const rampPts = side => {
    const m = u => (side === 0 ? u : 1 - u);
    const pt = (u, z) => ({ x: BK.toScreenX(m(u), z), y: BK.toScreenY(z), s: BK.depthScale(z) });
    return [pt(...BK.RAMP.top), pt(...BK.RAMP.bottom)];
  };
  function drawRamp(side, t, lit) {
    const [a, b] = rampPts(side);
    const dx = b.x - a.x, dy = b.y - a.y, L = Math.hypot(dx, dy), px = -dy / L, py = dx / L;
    const wa = 64 * a.s * 1.38, wb = 92 * b.s * 1.38;
    const col = side === 0 ? '#e0404a' : '#4d74d6';
    // side skirt (the ramp is raised)
    ctx.fillStyle = '#0c0a09';
    D.poly([[a.x + px * wa, a.y + py * wa], [b.x + px * wb, b.y + py * wb], [b.x + px * wb, b.y + py * wb + 26], [a.x + px * wa, a.y + py * wa + 18]]); ctx.fill();
    // walkway
    const g = ctx.createLinearGradient(a.x, a.y, b.x, b.y);
    g.addColorStop(0, lit ? '#4a3f37' : '#3a322c'); g.addColorStop(1, lit ? '#6e5f52' : '#554941');
    ctx.fillStyle = g;
    D.poly([[a.x - px * wa, a.y - py * wa], [a.x + px * wa, a.y + py * wa], [b.x + px * wb, b.y + py * wb], [b.x - px * wb, b.y - py * wb]]); ctx.fill();
    // deck plates
    ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.lineWidth = 2;
    for (let i = 1; i < 8; i++) {
      const k = i / 8, w = lerp(wa, wb, k), x = lerp(a.x, b.x, k), y = lerp(a.y, b.y, k);
      ctx.beginPath(); ctx.moveTo(x - px * w, y - py * w); ctx.lineTo(x + px * w, y + py * w); ctx.stroke();
    }
    // LED edge strips, chasing toward the ring while a fighter is walking out
    for (const sgn of [-1, 1]) {
      for (let i = 0; i <= 16; i++) {
        const k = i / 16, w = lerp(wa, wb, k), x = lerp(a.x, b.x, k) + sgn * px * w, y = lerp(a.y, b.y, k) + sgn * py * w;
        const on = lit ? (Math.sin(t * 12 - i * 0.9) > 0 ? 1 : 0.35) : 0.35;
        ctx.fillStyle = col; ctx.globalAlpha = on;
        D.circle(x, y, 3.2 * lerp(a.s, b.s, k) * 1.38); ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
    // entrance arch at the top of the ramp
    const aw = 120 * a.s * 1.38, ah = 190 * a.s * 1.38, ax = a.x, ay = a.y;
    ctx.fillStyle = '#060505';
    ctx.beginPath(); ctx.moveTo(ax - aw / 2, ay); ctx.lineTo(ax - aw / 2, ay - ah * 0.75);
    ctx.quadraticCurveTo(ax, ay - ah * 1.05, ax + aw / 2, ay - ah * 0.75); ctx.lineTo(ax + aw / 2, ay); ctx.closePath(); ctx.fill();
    if (lit) { // backlight and smoke pouring out of the tunnel
      const bl = ctx.createRadialGradient(ax, ay - ah * 0.4, 5, ax, ay - ah * 0.4, ah * 0.9);
      bl.addColorStop(0, 'rgba(255,230,190,0.55)'); bl.addColorStop(1, 'rgba(255,230,190,0)');
      ctx.fillStyle = bl; ctx.fillRect(ax - ah, ay - ah * 1.4, ah * 2, ah * 1.6);
      for (let i = 0; i < 5; i++) {
        const sx = ax + Math.sin(t * 0.7 + i * 1.7) * aw * 0.6 + i * 12 * (side ? -1 : 1), sy = ay - 10 - i * 6;
        const sm = ctx.createRadialGradient(sx, sy, 2, sx, sy, 60 * a.s * 1.38);
        sm.addColorStop(0, 'rgba(220,215,205,0.22)'); sm.addColorStop(1, 'rgba(220,215,205,0)');
        ctx.fillStyle = sm; ctx.fillRect(sx - 90, sy - 90, 180, 180);
      }
    }
    ctx.strokeStyle = col; ctx.lineWidth = 4; ctx.globalAlpha = lit ? 1 : 0.5;
    ctx.beginPath(); ctx.moveTo(ax - aw / 2, ay); ctx.lineTo(ax - aw / 2, ay - ah * 0.75);
    ctx.quadraticCurveTo(ax, ay - ah * 1.05, ax + aw / 2, ay - ah * 0.75); ctx.lineTo(ax + aw / 2, ay); ctx.stroke();
    ctx.globalAlpha = 1;
    D.text(side === 0 ? 'RED' : 'BLUE', ax, ay - ah * 1.02, BK.FONT.display(Math.round(22 * a.s * 1.38 + 4)), lit ? col : 'rgba(239,230,210,0.35)');
  }
  AR.drawRamps = t => {
    const wo = BK.walkout, lit = side => wo && wo.active && wo.phase === (side === 0 ? 'red' : 'blue');
    drawRamp(0, t, lit(0)); drawRamp(1, t, lit(1));
  };

  AR.drawRing = () => {
    // apron
    ctx.fillStyle = '#26110f';
    D.poly([[R.frontL - 34, R.frontY], [R.frontR + 34, R.frontY], [R.frontR + 34, H + 40], [R.frontL - 34, H + 40]]); ctx.fill();
    const ap = ctx.createLinearGradient(0, R.frontY, 0, H);
    ap.addColorStop(0, 'rgba(255,220,180,0.08)'); ap.addColorStop(1, 'rgba(0,0,0,0.3)');
    ctx.fillStyle = ap; ctx.fillRect(R.frontL - 34, R.frontY, R.frontR - R.frontL + 68, H - R.frontY + 40);
    ctx.fillStyle = BK.PAL.blood; ctx.fillRect(R.frontL - 34, R.frontY + 4, R.frontR - R.frontL + 68, 6);
    D.text('BARE  KNUCKLE', W / 2, R.frontY + 58, BK.FONT.display(46), 'rgba(239,230,210,0.88)');
    D.text('CHAMPIONSHIP  FIGHTING', W / 2, R.frontY + 94, BK.FONT.ui(20), 'rgba(217,164,65,0.8)');
    // ring side (visible thickness under the back edge)
    ctx.fillStyle = '#1d0d0b';
    D.poly([[R.backL - 14, R.backY - 4], [R.backR + 14, R.backY - 4], [R.backR + 14, R.backY + 12], [R.backL - 14, R.backY + 12]]); ctx.fill();

    // canvas
    const floor = ctx.createLinearGradient(0, R.backY, 0, R.frontY);
    floor.addColorStop(0, '#a99f88'); floor.addColorStop(1, BK.PAL.canvas);
    ctx.fillStyle = floor;
    D.poly([[R.backL, R.backY], [R.backR, R.backY], [R.frontR, R.frontY], [R.frontL, R.frontY]]); ctx.fill();
    // pool of light on the canvas
    const pool = ctx.createRadialGradient(W / 2, 620, 40, W / 2, 620, 620);
    pool.addColorStop(0, 'rgba(255,244,214,0.3)'); pool.addColorStop(1, 'rgba(255,244,214,0)');
    ctx.fillStyle = pool;
    D.poly([[R.backL, R.backY], [R.backR, R.backY], [R.frontR, R.frontY], [R.frontL, R.frontY]]); ctx.fill();
    // scuffs, centre logo
    ctx.fillStyle = 'rgba(110,85,60,0.1)';
    ctx.beginPath(); ctx.ellipse(W / 2, 620, 260, 72, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(179,32,42,0.4)'; ctx.lineWidth = 6;
    ctx.beginPath(); ctx.ellipse(W / 2, 620, 150, 44, 0, 0, Math.PI * 2); ctx.stroke();
    ctx.save(); ctx.translate(W / 2, 620); ctx.scale(1, 0.32);
    D.text('BKB', 0, 0, BK.FONT.display(80), 'rgba(179,32,42,0.4)');
    ctx.restore();
    // ring edge highlight
    ctx.strokeStyle = 'rgba(255,255,255,0.12)'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(R.frontL, R.frontY); ctx.lineTo(R.frontR, R.frontY); ctx.stroke();
  };

  const POST_H_FRONT = 170, POST_H_BACK = 128;
  const ROPES = [['#b3202a', 0.34], ['#efe6d2', 0.6], ['#23386b', 0.86]];
  const corner = (u, z, pad) => ({ x: BK.toScreenX(u, z), y: BK.toScreenY(z), h: lerp(POST_H_BACK, POST_H_FRONT, z), pad });
  // Red corner back-left, blue corner back-right, neutral corners at the front.
  const C = { bl: corner(0, 0, '#b3202a'), br: corner(1, 0, '#23386b'), fl: corner(0, 1, '#e9e2d0'), fr: corner(1, 1, '#e9e2d0') };

  function rope(a, b, frac, color, w) {
    const sag = 6;
    ctx.strokeStyle = BK.PAL.ink; ctx.lineWidth = w + 3; ctx.lineCap = 'round';
    const ax = a.x, ay = a.y - a.h * frac, bx = b.x, by = b.y - b.h * frac;
    ctx.beginPath(); ctx.moveTo(ax, ay); ctx.quadraticCurveTo((ax + bx) / 2, (ay + by) / 2 + sag, bx, by); ctx.stroke();
    ctx.strokeStyle = color; ctx.lineWidth = w;
    ctx.beginPath(); ctx.moveTo(ax, ay); ctx.quadraticCurveTo((ax + bx) / 2, (ay + by) / 2 + sag, bx, by); ctx.stroke();
  }
  function post(c, w) {
    D.rr(c.x - w / 2, c.y - c.h - 10, w, c.h + 10, 3); D.fillOut('#1a1a1d', 3);
    D.rr(c.x - w / 2 - 5, c.y - c.h * 0.95, w + 10, c.h * 0.72, 6); D.fillOut(c.pad, 3);
    ctx.fillStyle = 'rgba(255,255,255,0.18)'; ctx.fillRect(c.x - w / 2 - 1, c.y - c.h * 0.93, 4, c.h * 0.68);
  }
  AR.drawBackRopes = () => {
    post(C.bl, 16); post(C.br, 16);
    for (const [col, f] of ROPES) { rope(C.bl, C.br, f, col, 5); rope(C.bl, C.fl, f, col, 6); rope(C.br, C.fr, f, col, 6); }
  };
  AR.drawFrontRopes = () => {
    post(C.fl, 22); post(C.fr, 22);
    for (const [col, f] of ROPES) rope(C.fl, C.fr, f, col, 7);
  };

  // Ringside front row, silhouetted at the bottom corners, slapping the apron when excited.
  const FRONT = [];
  for (let i = 0; i < 16; i++) {
    const left = i < 8, j = i % 8;
    FRONT.push({ x: left ? 40 + j * 70 + BK.srand() * 20 : 1070 + j * 70 + BK.srand() * 20, r: 30 + BK.srand() * 8, ph: BK.srand() * 6, bang: BK.srand() < 0.6 });
  }
  AR.drawFrontRow = (t, excitement) => {
    for (const f of FRONT) {
      const y = 872 + Math.sin(f.ph) * 6;
      const up = excitement > 0.3 && f.bang;
      const slap = up ? Math.max(0, Math.sin(t * 11 + f.ph)) : 0;
      ctx.fillStyle = '#0c0908';
      if (up) { // arms up on the apron edge
        ctx.strokeStyle = '#0c0908'; ctx.lineWidth = f.r * 0.5; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(f.x - f.r * 0.8, y + f.r); ctx.lineTo(f.x - f.r * 0.9, 800 + slap * 22);
        ctx.moveTo(f.x + f.r * 0.8, y + f.r); ctx.lineTo(f.x + f.r * 0.9, 800 + (1 - slap) * 22); ctx.stroke();
      }
      ctx.beginPath(); ctx.ellipse(f.x, y + f.r * 1.9, f.r * 1.6, f.r * 1.2, 0, 0, Math.PI * 2); ctx.fill();
      D.circle(f.x, y - slap * 6, f.r); ctx.fill();
      ctx.fillStyle = 'rgba(255,236,190,0.12)'; // rim light from the ring
      ctx.beginPath(); ctx.arc(f.x, y - slap * 6, f.r, Math.PI * 1.15, Math.PI * 1.85); ctx.lineTo(f.x, y - slap * 6); ctx.fill();
    }
  };

  // Light beams and haze over everything in the world layer.
  AR.drawAtmosphere = t => {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 6; i++) {
      const x = 330 + i * 188, sway = Math.sin(t * 0.3 + i) * 30;
      const g = ctx.createLinearGradient(0, 120, 0, 760);
      g.addColorStop(0, 'rgba(255,236,190,0.1)'); g.addColorStop(1, 'rgba(255,236,190,0)');
      ctx.fillStyle = g;
      D.poly([[x - 12, 122], [x + 12, 122], [W / 2 + (x - W / 2) * 0.5 + 120 + sway, 760], [W / 2 + (x - W / 2) * 0.5 - 120 + sway, 760]]);
      ctx.fill();
    }
    ctx.restore();
  };

  // ---------- venues ----------
  // Every venue draws the same layers over the same ring coordinates, so fighters, the walkout and the
  // referee don't care which one is up. js/yard.js adds the tyre yard; BK.settings.arena picks one.
  BK.VENUES = { hall: AR };
  BK.ARENAS = [['hall', 'THE HALL'], ['yard', 'TYRE YARD']];
  const venue = () => BK.VENUES[BK.settings.arena] || AR;
  BK.arena = {};
  for (const k of ['update', 'drawBackdrop', 'drawRing', 'drawBackRopes', 'drawFrontRopes', 'drawFrontRow', 'drawAtmosphere']) {
    BK.arena[k] = (...a) => venue()[k](...a);
  }
})();
