// Bare Knuckle Boxing — prototype
// World is drawn in a fixed 1600x900 logical space and scaled to fit the screen.
// Touch: left side = floating joystick, right side = Jab / Cross / Block buttons.
// Keyboard (for desktop testing): WASD / arrows move, J jab, K cross, L block.
(() => {
  'use strict';

  const W = 1600, H = 900;
  const RING = { backY: 440, frontY: 790, backL: 390, backR: 1210, frontL: 170, frontR: 1430 };
  const Z_MIN = 0.02, Z_MAX = 0.9, U_MIN = 0.05, U_MAX = 0.95;

  const PAL = {
    arena: '#120f0e',
    bone: '#efe6d2',
    brass: '#d9a441',
    blood: '#b3202a',
    canvas: '#d8cfb8',
  };

  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  let cssW = 0, cssH = 0, dpr = 1, view = { s: 1, ox: 0, oy: 0 };

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    cssW = canvas.clientWidth; cssH = canvas.clientHeight;
    canvas.width = Math.round(cssW * dpr); canvas.height = Math.round(cssH * dpr);
    const s = Math.min(cssW / W, cssH / H);
    view = { s, ox: (cssW - W * s) / 2, oy: (cssH - H * s) / 2 };
  }
  window.addEventListener('resize', resize);

  // ---------- helpers ----------
  const lerp = (a, b, t) => a + (b - a) * t;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const ringL = z => lerp(RING.backL, RING.frontL, z);
  const ringR = z => lerp(RING.backR, RING.frontR, z);
  const toScreenX = (u, z) => lerp(ringL(z), ringR(z), u);
  const toScreenY = z => lerp(RING.backY, RING.frontY, z);
  const depthScale = z => lerp(0.74, 1.0, z);
  // Deterministic random so the crowd doesn't shuffle every frame.
  let seed = 7;
  const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

  // ---------- audio (tiny synth thud, starts after first tap) ----------
  let actx = null;
  function initAudio() {
    if (actx) return;
    try { actx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { actx = null; }
  }
  function thud(power, blocked) {
    if (!actx) return;
    const t = actx.currentTime;
    const len = 0.12;
    const buf = actx.createBuffer(1, actx.sampleRate * len, actx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 3);
    const src = actx.createBufferSource(); src.buffer = buf;
    const f = actx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = blocked ? 700 : 350 + power * 30;
    const g = actx.createGain(); g.gain.setValueAtTime(blocked ? 0.35 : 0.8, t);
    src.connect(f).connect(g).connect(actx.destination);
    src.start(t);
    const o = actx.createOscillator(); const og = actx.createGain();
    o.frequency.setValueAtTime(blocked ? 180 : 110, t); o.frequency.exponentialRampToValueAtTime(45, t + 0.12);
    og.gain.setValueAtTime(blocked ? 0.2 : 0.6, t); og.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
    o.connect(og).connect(actx.destination); o.start(t); o.stop(t + 0.16);
  }

  // ---------- character looks ----------
  const MICHAEL = {
    name: 'MICHAEL McDONAGH',
    skin: '#e3b08a', skinShade: '#c98f69',
    hair: '#3a2718',
    top: 'tank', topColor: '#f1ede2', topShade: '#d9d3c3',
    stains: [[-10, -170, 9, 6, 'rgba(142,104,48,0.45)'], [12, -150, 6, 8, 'rgba(120,70,40,0.4)'],
             [-4, -135, 11, 5, 'rgba(160,130,60,0.35)'], [16, -190, 5, 4, 'rgba(110,60,40,0.45)']],
    pants: '#4d525c', pantsShade: '#3b3f47', pantsStripe: '#e8e8e8',
    boots: '#c9ad7f', bootSole: '#6d5a3e',
    wraps: '#c1272d', wrapShade: '#8e1a1f',
    sleeves: null,
    bald: false,
  };
  const BALDY = {
    name: 'BALDY CAN BOX',
    skin: '#d9a07c', skinShade: '#b98260',
    hair: null,
    top: 'hoodie', topColor: '#6e4a2c', topShade: '#553821',
    stains: [],
    pants: '#3d5d8f', pantsShade: '#2e4870', pantsStripe: null,
    boots: '#18181a', bootSole: '#050505',
    wraps: null, wrapShade: null,
    sleeves: '#6e4a2c',
    bald: true,
  };

  // ---------- fighter ----------
  class Fighter {
    constructor(look, u, z, dir) {
      this.look = look;
      this.startU = u; this.startZ = z; this.startDir = dir;
      this.reset();
    }
    reset() {
      this.u = this.startU; this.z = this.startZ; this.dir = this.startDir;
      this.hp = 100; this.ghostHp = 100;
      this.punch = null; this.blocking = false;
      this.stun = 0; this.knock = 0; this.flash = 0;
      this.walk = 0; this.moving = 0; this.t = Math.random() * 10;
      this.ko = false; this.koT = 0;
    }
    get sx() { return toScreenX(this.u, this.z); }
    get sy() { return toScreenY(this.z); }
    get fs() { return depthScale(this.z) * 1.38; }

    update(dt, input, opp) {
      this.t += dt;
      this.flash = Math.max(0, this.flash - dt);
      if (this.ghostHp > this.hp) this.ghostHp = Math.max(this.hp, this.ghostHp - 30 * dt);
      if (this.ko) { this.koT += dt; return; }

      // knockback drift
      if (this.knock) {
        this.u = clamp(this.u + this.knock * dt, U_MIN, U_MAX);
        this.knock *= Math.pow(0.02, dt);
        if (Math.abs(this.knock) < 0.005) this.knock = 0;
      }
      if (this.stun > 0) { this.stun -= dt; this.punch = null; this.blocking = false; this.moving = 0; return; }

      // face the opponent
      const dx = opp.sx - this.sx;
      if (Math.abs(dx) > 8) this.dir = Math.sign(dx);

      this.blocking = !!input.block && !this.punch;

      // movement (slower while punching or blocking)
      let spd = this.punch ? 0.25 : this.blocking ? 0.45 : 1;
      const mx = input.mx || 0, my = input.my || 0;
      const mag = Math.min(1, Math.hypot(mx, my));
      const widthAtZ = ringR(this.z) - ringL(this.z);
      this.u = clamp(this.u + mx * 330 * spd * dt / widthAtZ, U_MIN, U_MAX);
      this.z = clamp(this.z + my * 0.62 * spd * dt, Z_MIN, Z_MAX);
      this.moving = mag * spd;
      // walk cycle direction relative to facing, so stepping back plays the legs in reverse
      const fwd = (mx * this.dir) >= 0 ? 1 : -1;
      this.walk += dt * 11 * this.moving * fwd;

      // start punches
      if (!this.punch && !this.blocking) {
        if (input.jab) this.punch = { type: 'jab', t: 0, dur: 0.30, hitAt: 0.11, dmg: 6, reach: 168, hit: false };
        else if (input.cross) this.punch = { type: 'cross', t: 0, dur: 0.46, hitAt: 0.2, dmg: 11, reach: 178, hit: false };
      }
      if (this.punch) {
        const p = this.punch;
        p.t += dt;
        if (!p.hit && p.t >= p.hitAt) { p.hit = true; this.tryHit(opp, p); }
        if (p.t >= p.dur) this.punch = null;
      }
    }

    punchExt() {
      const p = this.punch;
      if (!p) return 0;
      return p.t < p.hitAt ? p.t / p.hitAt : Math.max(0, 1 - (p.t - p.hitAt) / (p.dur - p.hitAt));
    }

    tryHit(opp, p) {
      if (opp.ko) return;
      const dx = (opp.sx - this.sx) * this.dir;
      const dz = Math.abs(opp.z - this.z);
      if (dx > 0 && dx < p.reach * this.fs && dz < 0.12) opp.takeHit(p, this);
    }

    takeHit(p, from) {
      const facingAttacker = this.dir === -from.dir;
      if (this.blocking && facingAttacker) {
        this.hp = Math.max(0, this.hp - p.dmg * 0.15);
        this.knock = from.dir * 0.08;
        thud(p.dmg, true);
        spawnSparks(this, from, true);
      } else {
        this.hp = Math.max(0, this.hp - p.dmg);
        this.stun = p.type === 'cross' ? 0.36 : 0.22;
        this.knock = from.dir * (p.type === 'cross' ? 0.28 : 0.15);
        this.flash = 0.12;
        thud(p.dmg, false);
        spawnSparks(this, from, false);
        shake = p.type === 'cross' ? 10 : 5;
      }
      if (this.hp <= 0) { this.ko = true; this.koT = 0; this.punch = null; this.blocking = false; }
    }

    draw() {
      const L = this.look, s = this.fs;
      ctx.save();
      ctx.translate(this.sx, this.sy);

      // shadow
      ctx.fillStyle = 'rgba(40,25,10,0.28)';
      ctx.beginPath(); ctx.ellipse(0, 0, 70 * s, 14 * s, 0, 0, Math.PI * 2); ctx.fill();

      ctx.scale(s * this.dir, s);

      // knockout fall
      if (this.ko) {
        const k = Math.min(1, this.koT / 0.6);
        const e = 1 - Math.pow(1 - k, 3);
        ctx.translate(-e * 40, 0);
        ctx.rotate(-e * Math.PI / 2 * 0.96);
      }

      const walkSwing = Math.sin(this.walk) * 16 * Math.min(1, this.moving * 1.5);
      const bob = this.ko ? 0 : Math.sin(this.t * 5) * 3 + Math.abs(Math.sin(this.walk)) * -4 * this.moving;
      const hitLean = this.stun > 0 ? -0.18 : 0;
      const ext = this.punchExt();
      const type = this.punch ? this.punch.type : null;
      const punchLean = type === 'cross' ? ext * 0.12 : type === 'jab' ? ext * 0.05 : 0;

      const hipY = -120;
      // ---- legs ----
      const leg = (hx, fx, front) => {
        const kx = (hx + fx) / 2 + 10, ky = hipY / 2 + 4;
        limb(hx, hipY, kx, ky, fx, 0, 30, 26, front ? L.pants : L.pantsShade);
        if (L.pantsStripe) {
          ctx.strokeStyle = L.pantsStripe; ctx.lineWidth = 3; ctx.lineCap = 'round';
          ctx.beginPath(); ctx.moveTo(hx + 2, hipY + 6); ctx.lineTo(kx + 2, ky); ctx.lineTo(fx + 1, -14); ctx.stroke();
        }
        boot(fx, front);
      };
      const boot = (fx, front) => {
        ctx.fillStyle = L.bootSole;
        roundRect(fx - 16, -7, 46, 8, 3); ctx.fill();
        ctx.fillStyle = front ? L.boots : shade(L.boots, 0.85);
        roundRect(fx - 15, -24, 42, 19, 8); ctx.fill();
        if (L.top === 'tank') { // desert boot laces / collar
          ctx.strokeStyle = shade(L.boots, 0.7); ctx.lineWidth = 2;
          ctx.beginPath(); ctx.moveTo(fx + 4, -22); ctx.lineTo(fx + 14, -14); ctx.stroke();
        }
      };
      leg(-8, -30 - walkSwing, false);

      // rear arm drawn behind torso
      ctx.save();
      ctx.translate(0, hipY); ctx.rotate(hitLean + punchLean); ctx.translate(0, -hipY + bob);
      this.drawArm(false, ext, type);
      ctx.restore();

      leg(8, 30 + walkSwing, true);

      // ---- upper body ----
      ctx.save();
      ctx.translate(0, hipY); ctx.rotate(hitLean + punchLean); ctx.translate(0, -hipY + bob);
      this.drawTorso();
      this.drawHead();
      this.drawArm(true, ext, type);
      ctx.restore();
      ctx.restore();
    }

    drawTorso() {
      const L = this.look;
      const sh = -208, hip = -120;
      if (L.top === 'tank') {
        // bare shoulders then a white vest over them
        ctx.fillStyle = L.skin;
        poly([[-30, sh + 4], [30, sh + 4], [26, hip + 4], [-26, hip + 4]]); ctx.fill();
        ctx.fillStyle = L.topColor;
        poly([[-24, sh + 2], [-14, sh + 2], [-8, sh + 22], [10, sh + 22], [16, sh + 2], [24, sh + 2],
              [27, sh + 30], [26, hip + 6], [-26, hip + 6], [-27, sh + 30]]);
        ctx.fill();
        ctx.fillStyle = L.topShade;
        poly([[-27, sh + 30], [-12, sh + 30], [-10, hip + 6], [-26, hip + 6]]); ctx.fill();
        for (const [x, y, rx, ry, c] of L.stains) {
          ctx.fillStyle = c; ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0.4, 0, Math.PI * 2); ctx.fill();
        }
        // tracksuit waistband
        ctx.fillStyle = L.pants; roundRect(-27, hip - 2, 54, 12, 4); ctx.fill();
        ctx.fillStyle = '#ddd'; ctx.fillRect(-4, hip + 2, 2, 10); ctx.fillRect(3, hip + 2, 2, 10);
      } else {
        // hoodie: boxy torso, hood bunched behind the neck, kangaroo pocket
        ctx.fillStyle = L.topShade;
        ctx.beginPath(); ctx.ellipse(-16, sh + 2, 20, 13, -0.3, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = L.topColor;
        poly([[-34, sh], [32, sh], [34, hip + 12], [-34, hip + 12]]); ctx.fill();
        ctx.fillStyle = L.topShade;
        poly([[-34, sh + 10], [-18, sh + 10], [-18, hip + 12], [-34, hip + 12]]); ctx.fill();
        roundRect(-14, hip - 32, 40, 26, 6); ctx.fill();
        ctx.fillStyle = shade(L.topColor, 0.7); ctx.fillRect(-34, hip + 4, 68, 8);
        // drawstrings
        ctx.strokeStyle = '#e7dcc6'; ctx.lineWidth = 2.5; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(10, sh + 6); ctx.lineTo(12, sh + 36); ctx.moveTo(18, sh + 6); ctx.lineTo(21, sh + 32); ctx.stroke();
        // jeans waist
        ctx.fillStyle = L.pants; ctx.fillRect(-30, hip + 12, 60, 6);
      }
      // neck
      ctx.fillStyle = L.skinShade; roundRect(-6, sh - 20, 18, 24, 6); ctx.fill();
    }

    drawHead() {
      const L = this.look;
      const hx = 6, hy = -240, r = 25;
      // ear side
      ctx.fillStyle = L.skin;
      ctx.beginPath(); ctx.arc(hx, hy, r, 0, Math.PI * 2); ctx.fill();
      // jaw / chin forward
      ctx.beginPath(); ctx.ellipse(hx + 10, hy + 12, 16, 13, 0, 0, Math.PI * 2); ctx.fill();
      // nose
      ctx.beginPath(); ctx.moveTo(hx + 22, hy - 4); ctx.lineTo(hx + 31, hy + 6); ctx.lineTo(hx + 22, hy + 8); ctx.fill();
      // ear
      ctx.fillStyle = L.skinShade;
      ctx.beginPath(); ctx.ellipse(hx - 6, hy + 2, 5, 8, 0, 0, Math.PI * 2); ctx.fill();
      // eye + brow
      ctx.fillStyle = '#1b1411';
      ctx.beginPath(); ctx.ellipse(hx + 15, hy - 2, 2.6, 3, 0, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = L.bald ? '#5a3b28' : L.hair; ctx.lineWidth = 3.5; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(hx + 9, hy - 10); ctx.lineTo(hx + 22, hy - 8); ctx.stroke();
      // mouth
      ctx.strokeStyle = shade(L.skin, 0.6); ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(hx + 17, hy + 16); ctx.lineTo(hx + 24, hy + 15); ctx.stroke();

      if (L.bald) {
        // shiny dome + stubble shadow
        ctx.fillStyle = 'rgba(255,245,230,0.55)';
        ctx.beginPath(); ctx.ellipse(hx + 2, hy - 16, 11, 5, -0.3, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = 'rgba(60,40,30,0.25)';
        ctx.beginPath(); ctx.ellipse(hx + 10, hy + 16, 15, 9, 0, 0, Math.PI); ctx.fill();
      } else {
        // short dark crop
        ctx.fillStyle = L.hair;
        ctx.beginPath(); ctx.arc(hx - 1, hy - 4, r + 1, Math.PI * 0.95, Math.PI * 1.95); ctx.fill();
        ctx.beginPath(); ctx.ellipse(hx - 12, hy + 2, 12, 16, 0, 0, Math.PI * 2); ctx.fill();
      }
      if (this.stun > 0 || this.ko) {
        ctx.strokeStyle = '#1b1411'; ctx.lineWidth = 2.5;
        ctx.beginPath(); ctx.moveTo(hx + 12, hy - 5); ctx.lineTo(hx + 18, hy + 1); ctx.moveTo(hx + 18, hy - 5); ctx.lineTo(hx + 12, hy + 1); ctx.stroke();
      }
    }

    drawArm(front, ext, type) {
      const L = this.look;
      const shX = front ? 14 : -12, shY = -198;
      let fist, elbow;
      if (this.ko) {
        fist = front ? [40, -150] : [20, -145]; elbow = front ? [30, -175] : [5, -170];
      } else if (this.blocking) {
        fist = front ? [40, -250] : [30, -228]; elbow = front ? [38, -185] : [26, -180];
      } else {
        const bob = Math.sin(this.t * 5 + (front ? 0 : 1.5)) * 3;
        fist = front ? [44, -228 + bob] : [26, -234 + bob];
        elbow = front ? [30, -168] : [8, -166];
        const punching = (front && type === 'jab') || (!front && type === 'cross');
        if (punching && ext > 0) {
          const reach = type === 'jab' ? 138 : 150;
          const tx = reach, ty = -222;
          fist = [lerp(fist[0], tx, ext), lerp(fist[1], ty, ext)];
          elbow = [lerp(elbow[0], (shX + tx) / 2, ext), lerp(elbow[1], (shY + ty) / 2 + 4, ext)];
        }
      }
      const sleeve = L.sleeves || L.skin;
      const sleeveBack = L.sleeves ? L.topShade : L.skinShade;
      limb(shX, shY, elbow[0], elbow[1], fist[0], fist[1], L.sleeves ? 22 : 18, L.sleeves ? 20 : 15, front ? sleeve : sleeveBack);
      if (L.sleeves) { // cuff + bare wrist
        const cx = lerp(elbow[0], fist[0], 0.72), cy = lerp(elbow[1], fist[1], 0.72);
        ctx.strokeStyle = front ? L.skin : L.skinShade; ctx.lineWidth = 13; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(fist[0], fist[1]); ctx.stroke();
        ctx.fillStyle = shade(L.topColor, 0.8);
        ctx.beginPath(); ctx.arc(cx, cy, 11, 0, Math.PI * 2); ctx.fill();
      }
      // fist
      const [fx, fy] = fist;
      if (L.wraps) {
        ctx.strokeStyle = front ? L.wraps : L.wrapShade; ctx.lineWidth = 14; ctx.lineCap = 'round';
        const wx = lerp(elbow[0], fx, 0.75), wy = lerp(elbow[1], fy, 0.75);
        ctx.beginPath(); ctx.moveTo(wx, wy); ctx.lineTo(fx, fy); ctx.stroke();
        ctx.fillStyle = front ? L.wraps : L.wrapShade;
        ctx.beginPath(); ctx.arc(fx, fy, 12, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = 'rgba(0,0,0,0.25)'; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(fx - 8, fy - 6); ctx.lineTo(fx + 6, fy + 8); ctx.moveTo(fx - 2, fy - 11); ctx.lineTo(fx + 10, fy + 2); ctx.stroke();
      } else {
        ctx.fillStyle = front ? L.skin : L.skinShade;
        ctx.beginPath(); ctx.arc(fx, fy, 12, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = 'rgba(0,0,0,0.2)'; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(fx + 6, fy - 8); ctx.lineTo(fx + 6, fy + 8); ctx.stroke();
      }
    }
  }

  // ---------- drawing primitives ----------
  function limb(ax, ay, bx, by, cx, cy, w1, w2, color) {
    ctx.strokeStyle = color; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.lineWidth = w1; ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.stroke();
    ctx.lineWidth = w2; ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(cx, cy); ctx.stroke();
  }
  function poly(pts) {
    ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
    ctx.closePath();
  }
  function roundRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }
  function shade(hex, f) {
    const n = parseInt(hex.slice(1), 16);
    const r = Math.round(((n >> 16) & 255) * f), g = Math.round(((n >> 8) & 255) * f), b = Math.round((n & 255) * f);
    return `rgb(${r},${g},${b})`;
  }

  // ---------- effects ----------
  let sparks = [], shake = 0;
  function spawnSparks(target, from, blocked) {
    const x = target.sx - from.dir * 22 * target.fs, y = target.sy - 228 * target.fs;
    for (let i = 0; i < (blocked ? 5 : 10); i++) {
      const a = (from.dir > 0 ? Math.PI : 0) + (Math.random() - 0.5) * 2.2 + Math.PI;
      const v = 150 + Math.random() * 250;
      sparks.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 80, life: 0.35, max: 0.35, blocked });
    }
  }
  function updateSparks(dt) {
    for (const p of sparks) { p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 900 * dt; p.life -= dt; }
    sparks = sparks.filter(p => p.life > 0);
  }
  function drawSparks() {
    for (const p of sparks) {
      ctx.globalAlpha = p.life / p.max;
      ctx.fillStyle = p.blocked ? PAL.bone : '#f4d9a0';
      ctx.beginPath(); ctx.arc(p.x, p.y, 3.5, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  // ---------- arena ----------
  const crowd = [];
  for (let row = 0; row < 7; row++) {
    const y = 150 + row * 44;
    const n = 26 + row * 3;
    for (let i = 0; i < n; i++) {
      crowd.push({ x: (i + rand() * 0.6) * (W / n), y: y + rand() * 12, r: 13 + row * 1.6,
        c: `hsl(${20 + rand() * 30},${10 + rand() * 20}%,${8 + row * 2.4 + rand() * 6}%)`, ph: rand() * 6 });
    }
  }

  function drawArena(t) {
    const bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, '#0b0908'); bg.addColorStop(0.55, '#1c1512'); bg.addColorStop(1, '#0d0a09');
    ctx.fillStyle = bg; ctx.fillRect(-W, -H, W * 3, H * 3);

    for (const c of crowd) {
      const jump = Math.max(0, Math.sin(t * 3 + c.ph)) * 3;
      ctx.fillStyle = c.c;
      ctx.beginPath(); ctx.arc(c.x, c.y - jump, c.r, 0, Math.PI * 2); ctx.fill();
      ctx.fillRect(c.x - c.r * 1.3, c.y - jump + c.r * 0.7, c.r * 2.6, 40);
    }

    // overhead light cone
    const g = ctx.createRadialGradient(W / 2, 560, 60, W / 2, 560, 760);
    g.addColorStop(0, 'rgba(255,236,190,0.22)'); g.addColorStop(1, 'rgba(255,236,190,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);

    // apron (front skirt of the ring)
    ctx.fillStyle = '#2a1512';
    poly([[RING.frontL - 30, RING.frontY], [RING.frontR + 30, RING.frontY], [RING.frontR + 30, H], [RING.frontL - 30, H]]); ctx.fill();
    ctx.fillStyle = PAL.blood;
    ctx.fillRect(RING.frontL - 30, RING.frontY + 4, RING.frontR - RING.frontL + 60, 6);
    ctx.font = '600 44px "Anton", Impact, sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = 'rgba(239,230,210,0.85)';
    ctx.fillText('BARE  KNUCKLE', W / 2, RING.frontY + 60);

    // canvas floor
    const floor = ctx.createLinearGradient(0, RING.backY, 0, RING.frontY);
    floor.addColorStop(0, '#b9ae95'); floor.addColorStop(1, PAL.canvas);
    ctx.fillStyle = floor;
    poly([[RING.backL, RING.backY], [RING.backR, RING.backY], [RING.frontR, RING.frontY], [RING.frontL, RING.frontY]]); ctx.fill();
    // scuffs + centre logo
    ctx.fillStyle = 'rgba(120,95,70,0.12)';
    ctx.beginPath(); ctx.ellipse(W / 2, 620, 250, 70, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(179,32,42,0.35)'; ctx.lineWidth = 6;
    ctx.beginPath(); ctx.ellipse(W / 2, 620, 150, 44, 0, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = 'rgba(179,32,42,0.35)';
    ctx.font = '600 40px "Anton", Impact, sans-serif';
    ctx.save(); ctx.translate(W / 2, 620); ctx.scale(1, 0.32); ctx.fillText('BKB', 0, 0); ctx.restore();
  }

  const POST_H_FRONT = 170, POST_H_BACK = 128;
  const ROPES = [['#b3202a', 0.34], ['#efe6d2', 0.6], ['#23386b', 0.86]];
  const corner = (u, z) => ({ x: toScreenX(u, z), y: toScreenY(z), h: lerp(POST_H_BACK, POST_H_FRONT, z) });
  const C = { bl: corner(0, 0), br: corner(1, 0), fl: corner(0, 1), fr: corner(1, 1) };

  function rope(a, b, frac, color, w) {
    ctx.strokeStyle = color; ctx.lineWidth = w; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(a.x, a.y - a.h * frac); ctx.lineTo(b.x, b.y - b.h * frac); ctx.stroke();
  }
  function post(c, w) {
    ctx.fillStyle = '#1a1a1d'; ctx.fillRect(c.x - w / 2, c.y - c.h - 8, w, c.h + 8);
    ctx.fillStyle = PAL.blood; ctx.fillRect(c.x - w / 2 - 3, c.y - c.h * 0.95, w + 6, c.h * 0.7);
  }
  function drawBackRopes() {
    post(C.bl, 16); post(C.br, 16);
    for (const [col, f] of ROPES) {
      rope(C.bl, C.br, f, col, 5);
      rope(C.bl, C.fl, f, col, 6);
      rope(C.br, C.fr, f, col, 6);
    }
  }
  function drawFrontRopes() {
    post(C.fl, 22); post(C.fr, 22);
    for (const [col, f] of ROPES) rope(C.fl, C.fr, f, col, 7);
  }

  // ---------- HUD ----------
  function drawHealth(f, left) {
    const bw = 600, bh = 30, y = 46;
    const x = left ? 60 : W - 60 - bw;
    ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillRect(x - 4, y - 4, bw + 8, bh + 8);
    ctx.fillStyle = '#3a1113'; ctx.fillRect(x, y, bw, bh);
    const gw = bw * f.ghostHp / 100, hw = bw * f.hp / 100;
    ctx.fillStyle = PAL.bone;
    ctx.fillRect(left ? x : x + bw - gw, y, gw, bh);
    const grad = ctx.createLinearGradient(x, 0, x + bw, 0);
    if (left) { grad.addColorStop(0, PAL.blood); grad.addColorStop(1, PAL.brass); }
    else { grad.addColorStop(0, PAL.brass); grad.addColorStop(1, PAL.blood); }
    ctx.fillStyle = grad;
    ctx.fillRect(left ? x : x + bw - hw, y, hw, bh);
    // segment ticks every 10 HP
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    for (let i = 1; i < 10; i++) ctx.fillRect(x + (bw * i) / 10 - 1, y, 2, bh);

    ctx.font = '400 30px "Anton", Impact, sans-serif';
    ctx.textBaseline = 'top';
    ctx.textAlign = left ? 'left' : 'right';
    ctx.fillStyle = PAL.bone;
    ctx.fillText(f.look.name, left ? x : x + bw, y + bh + 12);
    ctx.font = '600 22px "Barlow Condensed", "Arial Narrow", sans-serif';
    ctx.fillStyle = PAL.brass;
    const hpTxt = `${Math.ceil(f.hp)} HP`;
    ctx.textAlign = left ? 'right' : 'left';
    ctx.fillText(hpTxt, left ? x + bw : x, y + bh + 16);
  }

  // ---------- input ----------
  const keys = {};
  const pressed = {}; // edge-triggered
  window.addEventListener('keydown', e => {
    const k = e.key.toLowerCase();
    if (!keys[k]) pressed[k] = true;
    keys[k] = true;
    if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(k)) e.preventDefault();
    onAnyTap();
  });
  window.addEventListener('keyup', e => { keys[e.key.toLowerCase()] = false; });

  const touch = { stick: null, stickVec: { x: 0, y: 0 }, buttons: {} };
  const pointers = new Map();

  function buttonLayout() {
    const U = Math.min(cssW, cssH);
    const r = clamp(U * 0.1, 34, 64);
    const pad = r * 0.5 + 16;
    const bx = cssW - pad - r, by = cssH - pad - r;
    return {
      r,
      cross: { x: bx, y: by, label: 'CROSS', color: PAL.blood },
      jab: { x: bx - r * 2.3, y: by + r * 0.15, label: 'JAB', color: '#8a5a2b' },
      block: { x: bx - r * 0.4, y: by - r * 2.25, label: 'BLOCK', color: '#23386b' },
    };
  }

  canvas.addEventListener('pointerdown', e => {
    e.preventDefault();
    onAnyTap();
    if (state !== 'fight') return;
    canvas.setPointerCapture && canvas.setPointerCapture(e.pointerId);
    const x = e.clientX, y = e.clientY;
    const lay = buttonLayout();
    for (const name of ['jab', 'cross', 'block']) {
      const b = lay[name];
      if (Math.hypot(x - b.x, y - b.y) < lay.r * 1.15) {
        pointers.set(e.pointerId, { kind: 'btn', name });
        touch.buttons[name] = true;
        if (name !== 'block') pressed['touch_' + name] = true;
        return;
      }
    }
    if (x < cssW * 0.5) {
      touch.stick = { id: e.pointerId, ox: x, oy: y, x, y };
      pointers.set(e.pointerId, { kind: 'stick' });
    }
  });
  canvas.addEventListener('pointermove', e => {
    const p = pointers.get(e.pointerId);
    if (!p || p.kind !== 'stick' || !touch.stick) return;
    const max = clamp(Math.min(cssW, cssH) * 0.12, 40, 80);
    let dx = e.clientX - touch.stick.ox, dy = e.clientY - touch.stick.oy;
    const d = Math.hypot(dx, dy);
    if (d > max) { // drag the origin along so the stick follows the thumb
      touch.stick.ox += dx * (1 - max / d); touch.stick.oy += dy * (1 - max / d);
      dx = e.clientX - touch.stick.ox; dy = e.clientY - touch.stick.oy;
    }
    touch.stick.x = e.clientX; touch.stick.y = e.clientY;
    const dd = Math.hypot(dx, dy);
    touch.stickVec = dd < max * 0.15 ? { x: 0, y: 0 } : { x: dx / max, y: dy / max };
  });
  const release = e => {
    const p = pointers.get(e.pointerId);
    if (!p) return;
    if (p.kind === 'stick') { touch.stick = null; touch.stickVec = { x: 0, y: 0 }; }
    else touch.buttons[p.name] = false;
    pointers.delete(e.pointerId);
  };
  canvas.addEventListener('pointerup', release);
  canvas.addEventListener('pointercancel', release);
  canvas.addEventListener('contextmenu', e => e.preventDefault());

  function playerInput() {
    let mx = 0, my = 0;
    if (keys['a'] || keys['arrowleft']) mx -= 1;
    if (keys['d'] || keys['arrowright']) mx += 1;
    if (keys['w'] || keys['arrowup']) my -= 1;
    if (keys['s'] || keys['arrowdown']) my += 1;
    mx += touch.stickVec.x; my += touch.stickVec.y;
    const m = Math.hypot(mx, my); if (m > 1) { mx /= m; my /= m; }
    const inp = {
      mx, my,
      jab: !!(pressed['j'] || pressed['touch_jab']),
      cross: !!(pressed['k'] || pressed['touch_cross']),
      block: !!(keys['l'] || touch.buttons.block),
    };
    for (const k in pressed) delete pressed[k];
    return inp;
  }

  function drawControls() {
    if (state !== 'fight') return;
    const lay = buttonLayout();
    ctx.save();
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (const name of ['jab', 'cross', 'block']) {
      const b = lay[name], down = touch.buttons[name];
      ctx.globalAlpha = down ? 0.9 : 0.55;
      ctx.fillStyle = b.color;
      ctx.beginPath(); ctx.arc(b.x, b.y, lay.r * (down ? 0.93 : 1), 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 0.85; ctx.strokeStyle = PAL.bone; ctx.lineWidth = 2;
      ctx.stroke();
      ctx.globalAlpha = 1; ctx.fillStyle = PAL.bone;
      ctx.font = `400 ${Math.round(lay.r * 0.42)}px "Anton", Impact, sans-serif`;
      ctx.fillText(b.label, b.x, b.y + 1);
    }
    // joystick
    const max = clamp(Math.min(cssW, cssH) * 0.12, 40, 80);
    const st = touch.stick;
    const ox = st ? st.ox : 40 + max * 1.4, oy = st ? st.oy : cssH - 40 - max * 1.4;
    ctx.globalAlpha = st ? 0.5 : 0.25;
    ctx.strokeStyle = PAL.bone; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(ox, oy, max, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = PAL.bone;
    const kx = ox + touch.stickVec.x * max, ky = oy + touch.stickVec.y * max;
    ctx.beginPath(); ctx.arc(kx, ky, max * 0.45, 0, Math.PI * 2); ctx.fill();
    if (!st) {
      ctx.globalAlpha = 0.6; ctx.fillStyle = PAL.bone;
      ctx.font = '600 15px "Barlow Condensed", "Arial Narrow", sans-serif';
      ctx.fillText('DRAG TO MOVE', ox, oy - max - 16);
    }
    ctx.restore();
  }

  // ---------- CPU opponent ----------
  const ai = { cool: 1.0, blockT: 0, retreatT: 0 };
  function cpuInput(me, foe, dt) {
    const inp = { mx: 0, my: 0, jab: false, cross: false, block: false };
    if (foe.ko) return inp;
    ai.cool -= dt; ai.blockT -= dt; ai.retreatT -= dt;
    const dx = foe.sx - me.sx, dist = Math.abs(dx), dz = foe.z - me.z;
    const ideal = 140 * me.fs;
    if (Math.abs(dz) > 0.03) inp.my = clamp(dz * 7, -1, 1);
    if (ai.retreatT > 0) inp.mx = -Math.sign(dx) * 0.8;
    else if (dist > ideal + 20) inp.mx = Math.sign(dx);
    else if (dist < ideal - 50) inp.mx = -Math.sign(dx) * 0.6;
    // react to incoming punches sometimes
    if (foe.punch && foe.punch.t < 0.05 && dist < 220 && Math.random() < 0.35) ai.blockT = 0.45;
    inp.block = ai.blockT > 0;
    if (!inp.block && ai.cool <= 0 && dist < 175 * me.fs && Math.abs(dz) < 0.1) {
      if (Math.random() < 0.65) inp.jab = true; else inp.cross = true;
      ai.cool = 0.55 + Math.random() * 0.9;
      if (Math.random() < 0.2) ai.retreatT = 0.5;
    }
    return inp;
  }

  // ---------- game state ----------
  const p1 = new Fighter(MICHAEL, 0.28, 0.5, 1);
  const p2 = new Fighter(BALDY, 0.72, 0.5, -1);
  let state = 'title'; // title | fight | ko
  let koTimer = 0, winner = null, roundIntro = 0;

  function startFight() {
    p1.reset(); p2.reset(); sparks = [];
    ai.cool = 1.2; ai.blockT = 0; ai.retreatT = 0;
    winner = null; koTimer = 0; roundIntro = 1.2;
    state = 'fight';
  }

  function onAnyTap() {
    initAudio();
    if (actx && actx.state === 'suspended') actx.resume();
    if (state === 'title') { goFullscreen(); startFight(); }
    else if (state === 'ko' && koTimer > 1.5) startFight();
  }

  function goFullscreen() {
    const el = document.documentElement;
    try {
      const req = el.requestFullscreen || el.webkitRequestFullscreen;
      if (req && !document.fullscreenElement) {
        const pr = req.call(el, { navigationUI: 'hide' });
        if (pr && pr.then) pr.then(() => {
          try { screen.orientation && screen.orientation.lock && screen.orientation.lock('landscape').catch(() => {}); } catch (e) {}
        }).catch(() => {});
      }
    } catch (e) { /* fullscreen is optional */ }
  }

  // ---------- main loop ----------
  let last = performance.now(), clock = 0;
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now; clock += dt;

    if (state === 'fight' || state === 'ko') {
      const idle = { mx: 0, my: 0 };
      const canAct = state === 'fight' && roundIntro <= 0;
      const i1 = canAct ? playerInput() : (playerInput(), idle);
      const i2 = canAct ? cpuInput(p2, p1, dt) : idle;
      roundIntro -= dt;
      p1.update(dt, i1, p2);
      p2.update(dt, i2, p1);
      separate(p1, p2);
      if (state === 'fight' && (p1.ko || p2.ko)) { state = 'ko'; winner = p1.ko ? p2 : p1; koTimer = 0; shake = 16; }
      if (state === 'ko') koTimer += dt;
    }
    updateSparks(dt);
    shake = Math.max(0, shake - dt * 40);

    render();
    requestAnimationFrame(frame);
  }

  function separate(a, b) {
    if (a.ko || b.ko) return;
    if (Math.abs(a.z - b.z) > 0.14) return;
    const minD = 76 * (a.fs + b.fs) / 2;
    const dx = b.sx - a.sx, d = Math.abs(dx);
    if (d < minD) {
      const push = (minD - d) / 2, sgn = dx === 0 ? 1 : Math.sign(dx);
      const wa = ringR(a.z) - ringL(a.z), wb = ringR(b.z) - ringL(b.z);
      a.u = clamp(a.u - sgn * push / wa, U_MIN, U_MAX);
      b.u = clamp(b.u + sgn * push / wb, U_MIN, U_MAX);
    }
  }

  function render() {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = PAL.arena; ctx.fillRect(0, 0, cssW, cssH);

    const sx = (Math.random() - 0.5) * shake, sy = (Math.random() - 0.5) * shake;
    ctx.save();
    ctx.translate(view.ox + sx, view.oy + sy);
    ctx.scale(view.s, view.s);

    drawArena(clock);
    drawBackRopes();
    const fighters = [p1, p2].sort((a, b) => a.z - b.z);
    for (const f of fighters) f.draw();
    drawSparks();
    drawFrontRopes();

    drawHealth(p1, true);
    drawHealth(p2, false);
    drawBanner();
    ctx.restore();

    drawControls();
  }

  function drawBanner() {
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    if (state === 'title') {
      ctx.fillStyle = 'rgba(12,9,8,0.72)'; ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = PAL.brass;
      ctx.font = '600 26px "Barlow Condensed", "Arial Narrow", sans-serif';
      ctx.fillText('NO GLOVES  ·  NO ROUNDS  ·  LAST MAN STANDING', W / 2, 250);
      ctx.fillStyle = PAL.bone;
      ctx.font = '400 150px "Anton", Impact, sans-serif';
      ctx.fillText('BARE KNUCKLE', W / 2, 360);
      ctx.font = '400 54px "Anton", Impact, sans-serif';
      ctx.fillStyle = PAL.bone;
      ctx.fillText('McDONAGH', W / 2 - 230, 500);
      ctx.fillStyle = PAL.blood; ctx.fillText('VS', W / 2, 500);
      ctx.fillStyle = PAL.bone; ctx.fillText('BALDY', W / 2 + 200, 500);
      const pulse = 0.55 + Math.sin(clock * 4) * 0.35;
      ctx.globalAlpha = pulse; ctx.fillStyle = PAL.brass;
      ctx.font = '600 38px "Barlow Condensed", "Arial Narrow", sans-serif';
      ctx.fillText('TAP TO FIGHT', W / 2, 640);
      ctx.globalAlpha = 1;
      ctx.fillStyle = 'rgba(239,230,210,0.6)';
      ctx.font = '500 24px "Barlow Condensed", "Arial Narrow", sans-serif';
      ctx.fillText('Left thumb: move   ·   Right thumb: Jab, Cross, Block   ·   Keyboard: WASD + J K L', W / 2, 720);
    } else if (state === 'fight' && roundIntro > 0) {
      ctx.globalAlpha = Math.min(1, roundIntro * 2);
      ctx.fillStyle = PAL.bone; ctx.font = '400 120px "Anton", Impact, sans-serif';
      ctx.fillText(roundIntro > 0.5 ? 'READY' : 'FIGHT!', W / 2, 330);
      ctx.globalAlpha = 1;
    } else if (state === 'ko') {
      const a = Math.min(1, koTimer * 3);
      ctx.globalAlpha = a;
      ctx.fillStyle = PAL.blood; ctx.font = '400 170px "Anton", Impact, sans-serif';
      ctx.fillText('K.O.', W / 2, 300);
      ctx.fillStyle = PAL.bone; ctx.font = '400 46px "Anton", Impact, sans-serif';
      ctx.fillText(`${winner.look.name} WINS`, W / 2, 410);
      if (koTimer > 1.5) {
        ctx.globalAlpha = 0.55 + Math.sin(clock * 4) * 0.35; ctx.fillStyle = PAL.brass;
        ctx.font = '600 34px "Barlow Condensed", "Arial Narrow", sans-serif';
        ctx.fillText('TAP FOR A REMATCH', W / 2, 480);
      }
      ctx.globalAlpha = 1;
    }
  }

  resize();
  const fontsReady = document.fonts && document.fonts.load
    ? Promise.all([document.fonts.load('40px "Anton"'), document.fonts.load('600 20px "Barlow Condensed"')]).catch(() => {})
    : Promise.resolve();
  // Don't wait forever for fonts on a slow connection.
  Promise.race([fontsReady, new Promise(r => setTimeout(r, 1500))]).then(() => requestAnimationFrame(t => { last = t; frame(t); }));
})();
