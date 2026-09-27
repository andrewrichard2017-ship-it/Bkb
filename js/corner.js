// Between-rounds corner scene: 15 seconds on the stool, pick one boost.
//   DIESEL - dip your hands in a bucket of diesel      +5% power
//   SLAPS  - your cornerman slaps you awake            +7% chin
//   BEER   - a pint to settle the nerves               +10% stamina
// Boosts stack across rounds for the rest of the fight. The CPU's corner picks one too.
(() => {
  'use strict';
  const BK = window.BK, ctx = BK.ctx, D = BK.draw, W = BK.W, PAL = BK.PAL, F = BK.FONT;
  const { clamp, lerp } = BK;
  const DEG = Math.PI / 180;
  const SCENE = 15, ACTION = 3.2;

  BK.CORNER_BOOSTS = {
    diesel: { stat: 'power', amt: 5, title: 'DIP HANDS IN DIESEL', effect: '+5% POWER', blurb: 'Old-school hardening. Stings!' },
    slaps: { stat: 'chin', amt: 7, title: 'TAKE A FEW SLAPS', effect: '+7% CHIN', blurb: 'Wakes you up. Harder to hurt.' },
    beer: { stat: 'stamina', amt: 10, title: 'DRINK A BEER', effect: '+10% STAMINA', blurb: 'Settles the nerves. Longer tank.' },
  };
  BK.applyBoost = (f, key) => { const b = BK.CORNER_BOOSTS[key]; f.buffs[b.stat] += b.amt; f.applyAttrs(); };

  const CORNERMAN = {
    skin: '#c98f6a', skinShade: '#a8734f', hair: '#b9b5ae',
    top: 'shirt', topColor: '#7a1f1f', topShade: '#5c1717', stains: [], bowtie: false, print: 'CORNER',
    pants: '#2a2a30', pantsShade: '#1e1e22', pantsStripe: null, boots: '#141414', bootSole: '#050505',
    sleeves: 'short', legs: 'trousers', shoes: 'shoe', fist: 'bare', head: 'grey',
  };

  // stage layout (HUD space)
  const FLOOR = 720, FX = 430, CX = 800, S = 1.9;
  const C = BK.corner = { active: false };

  C.start = (fighter, cpu, cpuBoost, onDone) => {
    Object.assign(C, {
      active: true, fighter, cpu, cpuBoost, onDone, t: 0, choice: null, actT: 0, applied: false,
      pose: BK.rig.make(), cmPose: BK.rig.make(), cmX: CX, pops: [], slapHit: 0, headKick: 0, oiled: false, level: 1, bubbles: [],
    });
  };

  function choose(key) {
    if (C.choice || C.t >= SCENE) return;
    C.choice = key; C.actT = 0;
    BK.audio.tick(true);
  }
  function finish() { if (!C.active) return; C.active = false; C.onDone(); }

  C.key = k => {
    if (k === '1') choose('diesel');
    else if (k === '2') choose('slaps');
    else if (k === '3') choose('beer');
    else if ((k === 'enter' || k === ' ') && (C.applied || C.t >= SCENE)) finish();
  };
  C.tap = () => true; // cards and buttons are canvas buttons; swallow everything else

  // torso-space point -> fighter-space point, for pinning props to hands
  function fromTorso(p, x, y) {
    const a = p.lean * DEG, px = p.px, py = -120 + p.py;
    return { x: px + x * Math.cos(a) - y * Math.sin(a), y: py + x * Math.sin(a) + y * Math.cos(a) };
  }
  const pop = (text, x, y, color = PAL.brass, size = 44) => C.pops.push({ text, x, y, color, size, t: 0 });

  C.update = dt => {
    if (!C.active) return;
    C.t += dt;
    for (const p of C.pops) p.t += dt;
    C.pops = C.pops.filter(p => p.t < 1);
    for (const b of C.bubbles) { b.y -= 40 * dt; b.t += dt; }
    C.bubbles = C.bubbles.filter(b => b.t < 0.8);
    C.headKick *= Math.pow(0.02, dt);

    const R = BK.rig, PO = BK.POSES, T = C.pose, M = C.cmPose;
    R.copy(PO.sit, T); R.copy(PO.cmStand, M);
    T.py += Math.sin(C.t * 3) * 1.5; T.lean += Math.sin(C.t * 3) * 1.5; // heavy breathing

    // the cornerman steps in to slap or hand over the pint, then steps back
    const near = C.choice === 'slaps' ? 690 : C.choice === 'beer' ? 730 : CX;
    const stepIn = C.choice && C.actT < ACTION - 0.3 ? near : CX;
    C.cmX += (stepIn - C.cmX) * Math.min(1, dt * 6);
    if (C.choice) {
      C.actT += dt;
      const t = C.actT;
      if (C.choice === 'diesel') {
        const k = t < 0.5 ? BK.easeInOut(t / 0.5) : t < 2.4 ? 1 : 1 - BK.easeInOut((t - 2.4) / 0.6);
        const dip = { lean: 38, head: 20, fX: 80, fY: -22 + Math.sin(t * 12) * 3, fB: 1, rX: 72, rY: -18 + Math.cos(t * 12) * 3, rB: 1 };
        for (const key in dip) T[key] = lerp(T[key], dip[key], k);
        if (t > 0.5 && t < 2.4) {
          if (Math.random() < dt * 14) C.bubbles.push({ x: FX + BK.rnd(110, 170), y: FLOOR - 70, t: 0 });
          if (Math.random() < dt * 2) BK.audio.tick(false);
        }
        if (t > 0.6) C.oiled = true;
        if (t > 1.2 && t - dt <= 1.2) pop('STINGS!', FX + 60, FLOOR - 330, PAL.bone, 40);
      } else if (C.choice === 'slaps') {
        // three slaps: wind up, crack, recover
        for (const at of [0.4, 1.2, 2.0]) {
          const u = (t - at) / 0.22;
          if (u > -1.4 && u < 0) R.mix(M, M, PO.cmSlapBack, BK.easeOut(u + 1.4 > 1 ? 1 : u + 1.4));
          if (u >= 0 && u < 1.6) R.mix(M, PO.cmSlapThru, PO.cmStand, clamp((u - 0.6) / 1, 0, 1));
          if (t >= at && t - dt < at) {
            C.headKick = 1; BK.audio.slap(); BK.vibrate(20);
            pop('SLAP!', FX + 70, FLOOR - 360, PAL.bone, 52);
          }
        }
        T.head -= 34 * C.headKick; T.lean -= 8 * C.headKick;
      } else if (C.choice === 'beer') {
        if (t < 0.7) R.mix(M, M, PO.cmHold, BK.easeOut(t / 0.35));
        else R.mix(M, PO.cmHold, PO.cmStand, clamp((t - 0.7) / 0.4, 0, 1));
        const k = t < 0.7 ? 0 : t < 1.0 ? BK.easeInOut((t - 0.7) / 0.3) : t < 2.6 ? 1 : 1 - BK.easeInOut((t - 2.6) / 0.5);
        const drink = { rX: 36, rY: -100, rB: 1, head: -30, lean: -8 };
        if (t > 0.7) { T.rX = lerp(PO.sit.rX + 30, drink.rX, k); T.rY = lerp(-60, drink.rY, k); }
        T.head = lerp(T.head, drink.head, k); T.lean = lerp(T.lean, drink.lean, k);
        if (t > 1.0 && t < 2.6) C.level = Math.max(0, 1 - (t - 1.0) / 1.5);
        for (const at of [1.3, 1.8, 2.3]) if (t >= at && t - dt < at) { BK.audio.glug(); pop('GLUG', FX + 40, FLOOR - 380, '#e8b64a', 34); }
      }
      if (!C.applied && t >= ACTION) {
        C.applied = true;
        BK.applyBoost(C.fighter, C.choice);
        BK.audio.roar(0.3);
      }
    }
    if (C.t >= SCENE) finish();
  };

  // ---------- drawing ----------
  function drawBucket(x, y) {
    ctx.save(); ctx.translate(x, y);
    D.poly([[-44, -86], [44, -86], [36, 0], [-36, 0]]); D.fillOut('#1d1d20', 5);
    ctx.fillStyle = '#2b2a28'; ctx.beginPath(); ctx.ellipse(0, -86, 44, 12, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    const g = ctx.createLinearGradient(-30, 0, 30, 0); // oily rainbow sheen
    g.addColorStop(0, 'rgba(120,60,160,0.5)'); g.addColorStop(0.5, 'rgba(60,160,120,0.5)'); g.addColorStop(1, 'rgba(200,160,40,0.5)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(0, -84, 34, 8, 0, 0, Math.PI * 2); ctx.fill();
    ctx.save(); ctx.translate(0, -44); ctx.rotate(-0.04);
    D.text('DIESEL', 0, 0, F.display(24), '#c9302c');
    ctx.restore();
    ctx.restore();
  }
  function drawPint(x, y, level, tilt) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(tilt);
    const glass = () => D.poly([[-16, -52], [16, -52], [12, 0], [-12, 0]]);
    ctx.save(); glass(); ctx.clip();
    ctx.fillStyle = 'rgba(220,235,240,0.35)'; ctx.fillRect(-20, -60, 40, 64);
    const top = lerp(0, -46, level);
    ctx.fillStyle = '#d99a2b'; ctx.fillRect(-20, top, 40, 60);
    if (level > 0.05) { ctx.fillStyle = '#f6eed8'; ctx.fillRect(-20, top - 8, 40, 9); }
    ctx.fillStyle = 'rgba(255,255,255,0.4)'; ctx.fillRect(-10, -48, 4, 44);
    ctx.restore();
    glass(); ctx.strokeStyle = PAL.ink; ctx.lineWidth = 3; ctx.stroke();
    ctx.restore();
  }
  function drawStool(x, y) {
    ctx.save(); ctx.translate(x, y);
    ctx.strokeStyle = PAL.ink; ctx.lineWidth = 12; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(-50, -110); ctx.lineTo(-70, 0); ctx.moveTo(50, -110); ctx.lineTo(70, 0); ctx.stroke();
    ctx.strokeStyle = '#7a5230'; ctx.lineWidth = 7;
    ctx.beginPath(); ctx.moveTo(-50, -110); ctx.lineTo(-70, 0); ctx.moveTo(50, -110); ctx.lineTo(70, 0); ctx.stroke();
    D.rr(-80, -128, 160, 24, 8); D.fillOut('#8b5e34', 5);
    ctx.restore();
  }
  function card(key, i, cx, cy) {
    const b = BK.CORNER_BOOSTS[key], w = 470, h = 132, x = cx - w / 2, y = cy - h / 2;
    const chosen = C.choice === key, dimmed = C.choice && !chosen;
    ctx.save(); ctx.globalAlpha = dimmed ? 0.3 : 1;
    D.slant(x, y, w - 16, h, 16);
    ctx.fillStyle = chosen ? 'rgba(120,30,34,0.95)' : 'rgba(28,21,19,0.95)'; ctx.fill();
    ctx.strokeStyle = chosen ? PAL.bone : 'rgba(217,164,65,0.75)'; ctx.lineWidth = 2.5; ctx.stroke();
    // icon
    ctx.save(); ctx.translate(x + 64, cy + 4);
    if (key === 'diesel') { ctx.scale(0.55, 0.55); drawBucket(0, 58); }
    else if (key === 'slaps') {
      ctx.rotate(-0.3); D.rr(-22, -30, 44, 56, 16); D.fillOut('#e3b08a', 4);
      for (let k = 0; k < 4; k++) { D.rr(-22 + k * 11, -52, 10, 30, 5); D.fillOut('#e3b08a', 3); }
      ctx.strokeStyle = PAL.bone; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(34, -14, 12, -1, 1); ctx.stroke(); ctx.beginPath(); ctx.arc(34, -14, 22, -0.9, 0.9); ctx.stroke();
    } else drawPint(0, 30, 1, 0);
    ctx.restore();
    D.text(`${i + 1}`, x + 22, y + 24, F.ui(20), 'rgba(239,230,210,0.5)');
    D.text(b.title, x + 124, cy - 30, F.display(29), PAL.bone, 'left');
    D.text(b.effect, x + 124, cy + 10, F.display(30), PAL.brass, 'left');
    D.text(b.blurb, x + 124, cy + 44, F.ui(22, 500), 'rgba(239,230,210,0.75)', 'left');
    ctx.restore();
    if (!C.choice) BK.ui.buttons.push({ x, y, w, h, onTap: () => choose(key) });
  }

  C.draw = g => {
    if (!C.active) return;
    const f = C.fighter;
    ctx.fillStyle = 'rgba(10,7,6,0.84)'; ctx.fillRect(-W, -900, W * 3, 2700);
    D.slant(110, 60, 1380, 790, 24); ctx.fillStyle = PAL.panel; ctx.fill();
    ctx.strokeStyle = 'rgba(217,164,65,0.45)'; ctx.lineWidth = 2; ctx.stroke();

    // corner of the ring: padded post, ropes, canvas
    ctx.save();
    ctx.beginPath(); ctx.rect(140, 90, 820, FLOOR - 90 + 40); ctx.clip();
    const floor = ctx.createLinearGradient(0, FLOOR - 40, 0, FLOOR + 60);
    floor.addColorStop(0, '#8d846f'); floor.addColorStop(1, '#bdb39b');
    ctx.fillStyle = floor; ctx.fillRect(140, FLOOR - 30, 820, 80);
    D.rr(186, 150, 44, FLOOR - 150, 6); D.fillOut('#1a1a1d', 4);
    D.rr(176, 190, 64, 360, 10); D.fillOut(f.cornerColor, 4);
    [['#b3202a', 560], ['#efe6d2', 440], ['#23386b', 320]].forEach(([c, y]) => {
      ctx.strokeStyle = PAL.ink; ctx.lineWidth = 14; ctx.beginPath(); ctx.moveTo(230, y); ctx.lineTo(980, y + 30); ctx.stroke();
      ctx.strokeStyle = c; ctx.lineWidth = 9; ctx.beginPath(); ctx.moveTo(230, y); ctx.lineTo(980, y + 30); ctx.stroke();
    });
    drawStool(FX - 10, FLOOR);
    // fighter on the stool
    ctx.save(); ctx.translate(FX, FLOOR); ctx.scale(S, S);
    BK.rig.draw(f.look, C.pose, { damage: f.damage, dazed: C.headKick > 0.4, blink: (C.t % 3.3) < 0.12, sweat: f.sweat, blood: f.blood });
    ctx.restore();
    if (C.choice === 'diesel') drawBucket(FX + 145, FLOOR + 8); // in front, so the hands go in
    // hands glisten after the diesel
    if (C.oiled) for (const [hx, hy] of [[C.pose.fX, C.pose.fY], [C.pose.rX, C.pose.rY]]) {
      const p = fromTorso(C.pose, hx, hy);
      ctx.fillStyle = 'rgba(40,30,20,0.35)'; D.circle(FX + p.x * S, FLOOR + p.y * S, 22); ctx.fill();
      ctx.fillStyle = 'rgba(180,220,200,0.45)'; ctx.beginPath(); ctx.ellipse(FX + p.x * S - 6, FLOOR + p.y * S - 8, 9, 4, -0.5, 0, Math.PI * 2); ctx.fill();
    }
    for (const b of C.bubbles) { ctx.strokeStyle = `rgba(200,220,210,${1 - b.t / 0.8})`; ctx.lineWidth = 2; D.circle(b.x, b.y, 5); ctx.stroke(); }
    // cornerman
    ctx.save(); ctx.translate(C.cmX, FLOOR); ctx.scale(-S, S);
    BK.rig.draw(CORNERMAN, C.cmPose, { damage: 0, dazed: false, blink: (C.t % 2.9) < 0.12, sweat: 0 });
    ctx.restore();
    // the pint: in the cornerman's hand, then the fighter's
    if (C.choice === 'beer' && C.actT < 3.1) {
      if (C.actT < 0.85) { const p = fromTorso(C.cmPose, C.cmPose.fX, C.cmPose.fY); drawPint(C.cmX - p.x * S, FLOOR + p.y * S - 10, 1, 0); }
      else { const p = fromTorso(C.pose, C.pose.rX, C.pose.rY); drawPint(FX + p.x * S + 10, FLOOR + p.y * S - 10, C.level, C.actT > 1 && C.actT < 2.6 ? -1.1 : -0.2); }
    }
    ctx.restore();
    for (const p of C.pops) {
      ctx.save(); ctx.globalAlpha = 1 - p.t; BK.strokeText(p.text, p.x, p.y - p.t * 50, F.display(p.size), p.color, 7); ctx.restore();
    }

    // header + countdown
    D.text(g.twoPlayer ? `${f.corner}  ·  ${f.look.short}` : 'YOUR CORNER', 560, 118, F.display(52), PAL.bone);
    D.text(`BETWEEN ROUNDS ${g.round} AND ${g.round + 1}  ·  PICK ONE`, 560, 162, F.ui(24), PAL.brass);
    const left = Math.max(0, SCENE - C.t);
    ctx.lineWidth = 8; ctx.strokeStyle = 'rgba(239,230,210,0.15)'; D.circle(1390, 128, 40); ctx.stroke();
    ctx.strokeStyle = left < 4 ? '#e2584f' : PAL.brass; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.arc(1390, 128, 40, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * left / SCENE); ctx.stroke();
    D.text(String(Math.ceil(left)), 1390, 131, F.display(40), PAL.bone);

    // options, then the outcome
    const keys = Object.keys(BK.CORNER_BOOSTS);
    if (!C.applied) keys.forEach((k, i) => card(k, i, 1215, 300 + i * 160));
    else {
      const b = BK.CORNER_BOOSTS[C.choice], cb = BK.CORNER_BOOSTS[C.cpuBoost];
      BK.strokeText(b.effect, 1215, 300, F.display(72), PAL.brass, 10);
      D.text('for the rest of the fight', 1215, 360, F.ui(28, 500), PAL.bone);
      const fb = f.buffs;
      D.text(`TOTAL  ·  POWER +${fb.power}%  ·  CHIN +${fb.chin}%  ·  STAMINA +${fb.stamina}%`, 1215, 430, F.ui(22), 'rgba(239,230,210,0.8)');
      if (cb) D.text(`${C.cpu.look.short}'S CORNER: ${cb.effect}`, 1215, 480, F.ui(24), '#8fa6dc');
      BK.ui.button(1215, 640, 440, 96, `START ROUND ${g.round + 1}`, finish, 'primary');
    }
    if (!C.choice && C.t > SCENE - 4) BK.strokeText('CHOOSE!', 560, 230, F.display(48), '#e2584f', 8);
  };
})();
