// The venue: crowd, lighting rig, ring canvas, ropes and corner posts.
(() => {
  'use strict';
  const BK = window.BK, ctx = BK.ctx, D = BK.draw, W = BK.W, H = BK.H, R = BK.RING;
  const { lerp } = BK;
  const AR = BK.arena = { flashes: [], fans: [] };

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
})();
