// Bubble Odyssey: effects, all in board units. Pops (a flash, a ring and droplets), bubbles falling off the
// board, freed Blips flying away, bomb blasts, lightning, sparkles, floating points and big banners.
(() => {
  'use strict';
  const BB = window.BB, TAU = Math.PI * 2;
  const FONT = '"Fredoka", "Baloo 2", "Arial Rounded MT Bold", sans-serif';
  BB.FONT = FONT;

  class FX {
    constructor() { this.clear(); }
    clear() { this.parts = []; this.falls = []; this.texts = []; this.rings = []; this.blips = []; this.bolts = []; this.flashes = []; this.orbs = []; this.banners = []; this.shake = 0; this.flash = 0; }
    col(c) { return BB.PAL[c] || { base: '#ffffff', light: '#ffffff', glow: '#ffffff' }; }
    pop(x, y, color, k, delay = 0) {
      const col = this.col(color), stone = k === BB.K.STONE;
      this.flashes.push({ x, y, color, k, t: -delay, max: 0.2 });
      this.rings.push({ x, y, t: -delay, max: 0.35, col: stone ? '#cfcac0' : col.light, r0: 0.8, r1: 2.1, w: 0.22 });
      for (let i = 0; i < 7; i++) {
        const a = Math.random() * TAU, v = 4 + Math.random() * 7;
        this.parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 2, g: 18, t: -delay, max: 0.45 + Math.random() * 0.3, s: 0.18 + Math.random() * 0.2, col: stone ? '#8e8a84' : i % 3 ? col.base : col.light, kind: 'dot' });
      }
      if (Math.random() < 0.6) this.parts.push({ x, y, vx: (Math.random() - 0.5) * 3, vy: -3 - Math.random() * 3, g: 0, t: -delay, max: 0.6, s: 0.35, col: '#ffffff', kind: 'star', rot: Math.random() * TAU });
    }
    crack(x, y) {
      for (let i = 0; i < 6; i++) { const a = Math.random() * TAU, v = 3 + Math.random() * 5; this.parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, g: 14, t: 0, max: 0.5, s: 0.2, col: '#e8faff', kind: 'shard', rot: Math.random() * TAU }); }
      this.rings.push({ x, y, t: 0, max: 0.3, col: '#e8faff', r0: 0.9, r1: 1.6, w: 0.12 });
    }
    drop(info, delay = 0) {
      this.falls.push({ x: info.x, y: info.y, v: { c: info.color, k: info.k }, vx: (Math.random() - 0.5) * 6, vy: -2 - Math.random() * 4, rot: 0, vr: (Math.random() - 0.5) * 6, t: -delay, key: info.r * 16 + info.c });
    }
    blip(x, y, color) { this.blips.push({ x, y, vx: (Math.random() - 0.5) * 3, vy: -6, t: 0, max: 2.2, color, ph: Math.random() * TAU }); }
    boom(x, y) {
      this.rings.push({ x, y, t: 0, max: 0.5, col: '#fff3b0', r0: 1, r1: 6, w: 0.6 });
      this.rings.push({ x, y, t: -0.05, max: 0.6, col: '#ff7a2a', r0: 1, r1: 5, w: 0.35 });
      for (let i = 0; i < 22; i++) { const a = Math.random() * TAU, v = 6 + Math.random() * 12; this.parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, g: 8, t: 0, max: 0.5 + Math.random() * 0.4, s: 0.25 + Math.random() * 0.35, col: ['#fff3b0', '#ffb347', '#ff6a2a', '#5a5a6a'][i % 4], kind: 'dot' }); }
      this.shake = Math.max(this.shake, 0.6); this.flash = Math.max(this.flash, 0.35);
    }
    zap(y, x0, x1) {
      const pts = []; for (let x = x0; x <= x1 + 0.01; x += 1.1) pts.push([x, y + (Math.random() - 0.5) * 1.2]);
      this.bolts.push({ pts, t: 0, max: 0.45 });
      for (let i = 0; i < 14; i++) this.parts.push({ x: x0 + Math.random() * (x1 - x0), y, vx: (Math.random() - 0.5) * 8, vy: (Math.random() - 0.5) * 8, g: 0, t: 0, max: 0.4, s: 0.2, col: '#bff4ff', kind: 'dot' });
      this.flash = Math.max(this.flash, 0.25);
    }
    sparkle(x, y, n = 8, col = '#fff6b0', spread = 1.2) {
      for (let i = 0; i < n; i++) { const a = Math.random() * TAU, v = 2 + Math.random() * 5; this.parts.push({ x: x + Math.cos(a) * spread * Math.random(), y: y + Math.sin(a) * spread * Math.random(), vx: Math.cos(a) * v, vy: Math.sin(a) * v - 1, g: 4, t: 0, max: 0.6 + Math.random() * 0.5, s: 0.22 + Math.random() * 0.25, col, kind: 'star', rot: Math.random() * TAU }); }
    }
    trail(x, y, col) { this.parts.push({ x: x + (Math.random() - 0.5) * 0.6, y: y + (Math.random() - 0.5) * 0.6, vx: 0, vy: 0, g: 0, t: 0, max: 0.25, s: 0.4, col, kind: 'soft' }); }
    flame(x, y) { this.parts.push({ x: x + (Math.random() - 0.5), y: y + (Math.random() - 0.5), vx: (Math.random() - 0.5) * 2, vy: 2 + Math.random() * 2, g: -3, t: 0, max: 0.35, s: 0.7 + Math.random() * 0.5, col: Math.random() < 0.5 ? '#ffb347' : '#ff5a1a', kind: 'soft' }); }
    orb(x, y, tx, ty, col) { this.orbs.push({ x0: x, y0: y, tx, ty, t: -Math.random() * 0.15, max: 0.55, col }); }
    text(x, y, str, o = {}) { this.texts.push({ x, y, str, t: 0, max: o.life || 1.1, size: o.size || 1.1, col: o.col || '#ffffff', vy: o.vy === undefined ? -2.2 : o.vy }); }
    banner(str, o = {}) { this.banners.push({ str, sub: o.sub || '', t: 0, max: o.life || 1.4, col: o.col || '#ffe14f', size: o.size || 2.6, y: o.y || 11 }); }

    update(dt) {
      const step = (list, fn) => { for (let i = list.length - 1; i >= 0; i--) { const e = list[i]; e.t += dt; if (fn(e) === false) list.splice(i, 1); } };
      step(this.parts, p => { if (p.t < 0) return; p.vy += p.g * dt; p.x += p.vx * dt; p.y += p.vy * dt; if (p.rot !== undefined) p.rot += dt * 4; return p.t < p.max; });
      step(this.falls, f => { if (f.t < 0) return; f.vy += 70 * dt; f.x += f.vx * dt; f.y += f.vy * dt; f.rot += f.vr * dt; if (f.x < 1 || f.x > BB.WIDTH - 1) f.vx = -f.vx * 0.6; return f.y < BB.BOARD_H + 1.5; });
      step(this.blips, b => { b.vy = Math.max(-11, b.vy - 6 * dt); b.x += (b.vx + Math.sin(b.t * 5 + b.ph) * 2) * dt; b.y += b.vy * dt; return b.t < b.max; });
      for (const list of [this.rings, this.bolts, this.flashes, this.orbs, this.texts, this.banners]) step(list, e => e.t < e.max);
      this.shake = Math.max(0, this.shake - dt * 2.2); this.flash = Math.max(0, this.flash - dt * 1.6);
    }

    // drawn in board units (the caller sets the transform)
    draw(c, S, t) {
      const P = BB.SPRITE_PAD;
      for (const f of this.falls) {
        if (f.t < 0) { c.drawImage(S.forCell(f.v, t, f.key), f.x - P, f.y - P, P * 2, P * 2); continue; }
        c.save(); c.translate(f.x, f.y); c.rotate(f.rot); c.globalAlpha = Math.max(0, Math.min(1, (BB.BOARD_H + 1.5 - f.y) / 3));
        c.drawImage(S.forCell(f.v, t, f.key), -P, -P, P * 2, P * 2); c.restore();
      }
      c.globalAlpha = 1;
      for (const fl of this.flashes) {
        if (fl.t < 0) { c.drawImage(S.forCell({ c: fl.color, k: fl.k }, t), fl.x - P, fl.y - P, P * 2, P * 2); continue; }
        const u = fl.t / fl.max, s = P * (1 + u * 0.55);
        c.globalAlpha = 1 - u; c.drawImage(S.forCell({ c: fl.color, k: fl.k }, t), fl.x - s, fl.y - s, s * 2, s * 2);
        c.globalAlpha = (1 - u) * 0.8; c.drawImage(S.glow, fl.x - s * 1.2, fl.y - s * 1.2, s * 2.4, s * 2.4);
      }
      c.globalAlpha = 1;
      for (const r of this.rings) {
        if (r.t < 0) continue;
        const u = r.t / r.max;
        c.globalAlpha = (1 - u) * 0.9; c.strokeStyle = r.col; c.lineWidth = r.w * (1 - u * 0.6);
        c.beginPath(); c.arc(r.x, r.y, r.r0 + (r.r1 - r.r0) * BB.math.easeOut(u), 0, TAU); c.stroke();
      }
      for (const p of this.parts) {
        if (p.t < 0) continue;
        const u = p.t / p.max, a = 1 - u;
        c.globalAlpha = a;
        if (p.kind === 'soft') { c.globalCompositeOperation = 'lighter'; c.fillStyle = p.col; c.beginPath(); c.arc(p.x, p.y, p.s * (1 - u * 0.5), 0, TAU); c.fill(); c.globalCompositeOperation = 'source-over'; }
        else if (p.kind === 'star') { c.save(); c.translate(p.x, p.y); c.rotate(p.rot); c.fillStyle = p.col; star4(c, p.s * (1 - u * 0.4)); c.restore(); }
        else if (p.kind === 'shard') { c.save(); c.translate(p.x, p.y); c.rotate(p.rot); c.fillStyle = p.col; c.beginPath(); c.moveTo(0, -p.s); c.lineTo(p.s * 0.5, p.s); c.lineTo(-p.s * 0.5, p.s * 0.6); c.fill(); c.restore(); }
        else { c.fillStyle = p.col; c.beginPath(); c.arc(p.x, p.y, p.s * (1 - u * 0.5), 0, TAU); c.fill(); }
      }
      c.globalAlpha = 1;
      for (const b of this.bolts) {
        const a = 1 - b.t / b.max;
        c.lineCap = 'round'; c.lineJoin = 'round';
        for (const [w, col] of [[0.9, `rgba(80,200,255,${a * 0.5})`], [0.35, `rgba(230,250,255,${a})`]]) {
          c.strokeStyle = col; c.lineWidth = w; c.beginPath();
          b.pts.forEach(([x, y], i) => { const j = (Math.random() - 0.5) * 0.4; if (i) c.lineTo(x, y + j); else c.moveTo(x, y + j); }); c.stroke();
        }
      }
      for (const o of this.orbs) {
        if (o.t < 0) continue;
        const u = BB.math.smooth(Math.min(1, o.t / o.max)), x = o.x0 + (o.tx - o.x0) * u, y = o.y0 + (o.ty - o.y0) * u - Math.sin(u * Math.PI) * 4;
        c.globalCompositeOperation = 'lighter'; c.globalAlpha = 0.9; c.drawImage(S.glows[o.col] || S.glow, x - 1, y - 1, 2, 2); c.globalCompositeOperation = 'source-over';
      }
      c.globalAlpha = 1;
      for (const b of this.blips) {
        const a = Math.min(1, (b.max - b.t) * 2), flap = Math.sin(b.t * 22) * 0.5 + 0.5;
        c.save(); c.translate(b.x, b.y); c.globalAlpha = a;
        c.fillStyle = 'rgba(255,255,255,0.85)';
        c.beginPath(); c.ellipse(-0.75, -0.2, 0.55, 0.25 + flap * 0.25, -0.6 - flap * 0.5, 0, TAU); c.ellipse(0.75, -0.2, 0.55, 0.25 + flap * 0.25, 0.6 + flap * 0.5, 0, TAU); c.fill();
        S.drawBlip(c, 1, false);
        c.fillStyle = '#ff5c8a'; heart(c, 0.95, -1.1, 0.32 + Math.sin(b.t * 8) * 0.05);
        c.restore();
      }
      c.globalAlpha = 1;
      c.textAlign = 'center'; c.textBaseline = 'middle'; c.lineJoin = 'round';
      for (const tx of this.texts) {
        const u = tx.t / tx.max, s = tx.size * (u < 0.15 ? BB.math.easeOutBack(u / 0.15) : 1);
        c.globalAlpha = u > 0.7 ? (1 - u) / 0.3 : 1;
        c.font = `700 ${s}px ${FONT}`;
        const y = tx.y + tx.vy * tx.t;
        c.lineWidth = s * 0.22; c.strokeStyle = 'rgba(20,6,40,0.85)'; c.strokeText(tx.str, tx.x, y);
        c.fillStyle = tx.col; c.fillText(tx.str, tx.x, y);
      }
      for (const bn of this.banners) {
        const u = bn.t / bn.max, s = bn.size * (u < 0.18 ? BB.math.easeOutBack(u / 0.18) : 1);
        c.globalAlpha = u > 0.75 ? (1 - u) / 0.25 : 1;
        c.font = `700 ${s}px ${FONT}`;
        c.lineWidth = s * 0.2; c.strokeStyle = 'rgba(30,6,50,0.9)'; c.strokeText(bn.str, BB.WIDTH / 2, bn.y);
        const g = c.createLinearGradient(0, bn.y - s / 2, 0, bn.y + s / 2); g.addColorStop(0, '#ffffff'); g.addColorStop(0.5, bn.col); g.addColorStop(1, bn.col);
        c.fillStyle = g; c.fillText(bn.str, BB.WIDTH / 2, bn.y);
        if (bn.sub) { c.font = `600 ${s * 0.42}px ${FONT}`; c.lineWidth = s * 0.1; c.strokeText(bn.sub, BB.WIDTH / 2, bn.y + s * 0.85); c.fillStyle = '#fff'; c.fillText(bn.sub, BB.WIDTH / 2, bn.y + s * 0.85); }
      }
      c.globalAlpha = 1;
    }
  }
  function star4(c, s) { c.beginPath(); c.moveTo(0, -s); c.quadraticCurveTo(0, 0, s, 0); c.quadraticCurveTo(0, 0, 0, s); c.quadraticCurveTo(0, 0, -s, 0); c.quadraticCurveTo(0, 0, 0, -s); c.fill(); }
  function heart(c, x, y, s) { c.beginPath(); c.moveTo(x, y + s); c.bezierCurveTo(x - s * 1.6, y - s * 0.2, x - s * 0.6, y - s * 1.4, x, y - s * 0.5); c.bezierCurveTo(x + s * 0.6, y - s * 1.4, x + s * 1.6, y - s * 0.2, x, y + s); c.fill(); }
  BB.FX = FX; BB.draw = { star4, heart };
})();
