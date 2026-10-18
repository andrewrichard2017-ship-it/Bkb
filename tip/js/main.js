// Tractor Tippin': boot, the main loop, chase cameras and split screen, turning game events into sound,
// rumble, particles and HUD messages, the title-screen flyover and the showroom for picking a car.
(() => {
  'use strict';
  const TT = window.TT, { clamp, lerp, damp, dampAngle, smooth } = TT.math;
  const STEP = 1 / 60;
  const G = TT.game = { game: null, views: [], paused: false, t: 0, attract: false, room: null, ready: false };
  let T, renderer, canvas, acc = 0, last = 0, fx = null, room = null, snoreT = 0, zT = 0, smokeT = 0, musicKey = '';
  const tmp = {};
  const pick = a => a[Math.floor(Math.random() * a.length)];

  function pickQuality() {
    let q = TT.settings.quality;
    if (q === 'auto') q = TT.isMobile ? 'low' : 'high';
    return { name: q, shadows: { high: 2048, medium: 1024, low: 0 }[q], ratio: Math.min(devicePixelRatio || 1, { high: 2, medium: 1.5, low: 1.15 }[q]), aa: q !== 'low' };
  }

  function boot() {
    T = window.THREE;
    if (!T) { document.getElementById('loading').textContent = 'Could not load the 3D engine.'; return; }
    canvas = document.getElementById('game');
    G.quality = pickQuality();
    renderer = G.renderer = new T.WebGLRenderer({ canvas, antialias: G.quality.aa, powerPreference: 'high-performance' });
    renderer.setPixelRatio(G.quality.ratio);
    renderer.outputColorSpace = T.SRGBColorSpace;
    renderer.toneMapping = T.ACESFilmicToneMapping;
    renderer.shadowMap.enabled = true; renderer.shadowMap.type = T.PCFSoftShadowMap;
    renderer.setScissorTest(true);
    Object.assign(tmp, { v: new T.Vector3(), v2: new T.Vector3(), v3: new T.Vector3() });
    TT.models.init();
    TT.input.init(); TT.hud.init(); TT.menu.init();
    addEventListener('resize', resize); resize();
    G.startAttract();
    document.getElementById('loading').style.display = 'none';
    G.ready = true;
    requestAnimationFrame(loop);
  }
  function resize() { renderer.setSize(innerWidth, innerHeight, false); layoutViews(); }
  G.applyQuality = () => { const q = pickQuality(); G.quality = q; renderer.setPixelRatio(q.ratio); resize(); };

  // ---- games ----
  function loadingScreen(on, text) { const el = document.getElementById('loading'); el.textContent = text || 'LOADING…'; el.style.display = on ? 'grid' : 'none'; }
  G.start = cfg => {
    if (cfg.mode !== 'attract') loadingScreen(true, 'DRIVING OUT TO ' + cfg.level.name.toUpperCase() + '…');
    return new Promise(res => setTimeout(() => {
      G.clear();
      const game = G.game = new TT.Game(cfg, renderer, G.quality);
      fx = new TT.FX(game.world.scene);
      G.attract = cfg.mode === 'attract';
      G.views = [];
      if (G.attract) G.views.push(makeView(null, 0));
      else for (const p of game.players) if (!p.remote && p.view !== null && p.view !== undefined) G.views.push(makeView(p, p.view));
      const th = game.thrasher;
      if (!G.attract && th.controller === 'local' && th.view !== null && th.view !== undefined) G.views.push(makeView(th, th.view));
      G.views.sort((a, b) => a.index - b.index);
      renderer.toneMappingExposure = game.world.theme.exposure;
      layoutViews();
      for (const v of G.views) updateCam(v, 1, true);
      if (!G.attract) TT.hud.setup(G.views, game); else TT.hud.hide();
      musicKey = '';
      G.paused = false; acc = 0;
      loadingScreen(false);
      res(game);
    }, 30));
  };
  G.clear = () => {
    if (!G.game) return;
    TT.audio.stopLoops();
    if (fx) fx.dispose();
    G.game.dispose(); G.game = null; G.views = []; fx = null;
  };
  G.startAttract = () => {
    const lv = TT.isOctober ? TT.HALLOWEEN : TT.LEVELS[Math.floor(Math.random() * TT.LEVELS.length)];
    TT.hud.hide();
    return G.start({ mode: 'attract', level: lv, humans: [], role: 'solo' }).then(g => { TT.audio.music(lv.halloween ? 'spooky' : 'calm'); return g; });
  };
  G.togglePause = on => {
    if (!G.game || G.attract) return;
    const online = TT.net.active && G.game.net;
    G.paused = online ? false : on === undefined ? !G.paused : on;
    TT.audio.setPaused(on === undefined ? G.paused : !!on);
  };

  // ---- views and cameras ----
  function makeView(car, index) {
    const cam = new T.PerspectiveCamera(60, 1, 0.3, 2400);
    return { car, index, cam, mode: TT.settings.camera || 0, yaw: car ? car.a : 0, orbit: 0, orbitP: 0, shake: 0, fov: 60, pos: new T.Vector3(), look: new T.Vector3(), rect: { x: 0, y: 0, w: 1, h: 1 }, camYaw: 0, att: { t: 0, i: 0 }, frozen: false };
  }
  function layoutViews() {
    const W = innerWidth, Hh = innerHeight, n = G.views.length;
    G.views.forEach((v, i) => {
      v.rect = n === 2 ? { x: 0, y: i === 0 ? 0 : Hh / 2, w: W, h: Hh / 2 } : { x: 0, y: 0, w: W, h: Hh };
      v.cam.aspect = v.rect.w / v.rect.h; v.cam.updateProjectionMatrix();
    });
    if (TT.hud.layout && G.game && !G.attract) TT.hud.layout(G.views);
  }
  const MODES = [{ back: 7.2, up: 3.0, fov: 60 }, { back: 11, up: 4.6, fov: 58 }, { back: 14, up: 13, fov: 55 }];
  function updateCam(v, dt, snap) {
    const game = G.game, w = game.world, cam = v.cam;
    if (G.attract) return attractCam(v, dt);
    const car = v.car, size = car.isThrasher ? 1.9 : car.carId === 'rusty' ? 1.15 : 1;
    const M = MODES[v.mode % 3];
    let back = M.back * size, up = M.up * size * (car.isThrasher ? 1.3 : 1), fov = M.fov;
    // which way the camera faces: the way you're driving (stays behind you when reversing)
    let yaw = car.a;
    if (car.escaped) v.frozen = v.frozen || car.z < -w.H - 10;
    if (!snap) v.yaw = dampAngle(v.yaw, yaw, car.caught ? 0.4 : 4.2, dt); else v.yaw = yaw;
    v.orbit = v.orbit || 0;
    let cy = v.yaw + v.orbit + (car.inp.look ? Math.PI : 0);
    if (car.caught) cy += G.t * 0.3;
    const sp = Math.abs(car.vf);
    back += sp * 0.08; fov += clamp(sp * 0.35, 0, 10) + (car.boosting ? 8 : 0);
    up += v.orbitP * 3;
    const px = car.x - Math.sin(cy) * back, pz = car.z - Math.cos(cy) * back;
    const ground = Math.max(w.height(px, pz), w.height(lerp(px, car.x, 0.5), lerp(pz, car.z, 0.5)));
    const want = tmp.v.set(px, Math.max(car.y + up, ground + 1.2), pz);
    // don't let buildings, the silo or trees get between the camera and the car
    const k = w.clearLine(car.x, car.z, px, pz, car.y + 1, want.y);
    if (k < 1) { want.x = lerp(car.x, px, k); want.z = lerp(car.z, pz, k); want.y = Math.max(want.y, car.y + up * 0.8); }
    // countdown: swoop down from above the gate
    if (game.state === 'countdown' && !snap) {
      const k = smooth(clamp((game.time + 3.6) / 3.3, 0, 1));
      const hi = tmp.v2.set(car.x - Math.sin(cy) * 30, car.y + 30, car.z - Math.cos(cy) * 30);
      want.lerp(hi, 1 - k);
    }
    if (v.frozen) { /* stay put outside the gate and watch them drive off */ }
    else if (snap || game.state === 'countdown') v.pos.copy(want);
    else v.pos.lerp(want, 1 - Math.exp(-8 * dt));
    cam.position.copy(v.pos);
    const ahead = car.inp.look ? -3 : 4;
    v.look.set(car.x + Math.sin(cy) * ahead, car.y + 1.2 * size + (v.mode === 2 ? -1 : 0), car.z + Math.cos(cy) * ahead);
    if (v.frozen) v.look.set(car.x, car.y + 1, car.z);
    cam.up.set(0, 1, 0); cam.lookAt(v.look);
    v.shake = Math.max(0, v.shake - dt * 2.4);
    if (v.shake > 0) { const s = v.shake * v.shake * 0.35; cam.position.x += (Math.random() - 0.5) * s; cam.position.y += (Math.random() - 0.5) * s; cam.rotateZ((Math.random() - 0.5) * s * 0.15); }
    v.fov = snap ? fov : damp(v.fov, fov, 3, dt);
    if (Math.abs(cam.fov - v.fov) > 0.01) { cam.fov = v.fov; cam.updateProjectionMatrix(); }
    v.camYaw = Math.atan2(v.look.x - cam.position.x, v.look.z - cam.position.z);
    v.focus = tmp.v3.set(car.x, car.y, car.z).clone();
  }
  // title screen: drift round the sleeping herds and Thrasher's barn
  function attractCam(v, dt) {
    const game = G.game, w = game.world, cam = v.cam, a = v.att;
    a.t -= dt;
    if (a.t <= 0) {
      a.t = 11; a.i = (a.i + 1) % 3;
      const spots = w.tractorSpots;
      a.target = a.i === 2 ? { x: w.home.x, z: w.home.z } : spots[Math.floor(Math.random() * spots.length)] || { x: 0, z: 0 };
      a.ang = Math.random() * Math.PI * 2; a.r = a.i === 2 ? 26 : 16;
    }
    a.ang += dt * 0.08;
    const tx = a.target.x, tz = a.target.z, ty = w.height(tx, tz);
    v.pos.set(tx + Math.cos(a.ang) * a.r, ty + (a.i === 2 ? 9 : 5), tz + Math.sin(a.ang) * a.r);
    v.pos.y = Math.max(v.pos.y, w.height(v.pos.x, v.pos.z) + 2);
    cam.position.copy(v.pos); cam.lookAt(tx, ty + 1.2, tz);
    if (cam.fov !== 50) { cam.fov = 50; cam.updateProjectionMatrix(); }
    v.focus = tmp.v3.set(tx, ty, tz).clone(); v.camYaw = 0;
  }

  // ---- events -> sound, rumble, particles, HUD ----
  function nearest(x, z) { let best = null, bd = 1e9; for (const v of G.views) { const d = Math.hypot(v.cam.position.x - x, v.cam.position.z - z); if (d < bd) { bd = d; best = v; } } return { v: best, d: bd }; }
  const viewOf = p => p && G.views.find(v => v.car === p);
  const volAt = (x, z, range = 70) => clamp(1 - nearest(x, z).d / range, 0, 1);
  const panAt = (x, z) => { const n = nearest(x, z); if (!n.v || G.views.length > 1) return 0; const c = n.v.cam, dx = x - c.position.x, dz = z - c.position.z, yaw = n.v.camYaw; return clamp((dx * -Math.cos(yaw) + dz * Math.sin(yaw)) / (Math.hypot(dx, dz) || 1), -1, 1) * 0.8; };
  function events() {
    const game = G.game, msg = TT.hud.message, A = TT.audio, w = game.world, hw = !!game.level.halloween;
    const tv = G.views.find(v => v.car && v.car.isThrasher); // a player driving Thrasher (hunt)
    for (const e of game.events) {
      const pv = viewOf(e.p);
      switch (e.type) {
        case 'count': A.sfx('beep'); TT.hud.countdown(e.n); break;
        case 'go': A.sfx('go'); TT.hud.countdown(0); for (const v of G.views) TT.input.rumble(v.index, 0.3, 0.6, 200); break;
        case 'horn': { const p = e.p; A.sfx(p.carId === 'rusty' ? 'hornRusty' : 'hornDash', { vol: pv ? 0.9 : Math.max(0.25, volAt(p.x, p.z, 120)), pan: pv ? 0 : panAt(p.x, p.z) }); if (pv) TT.input.rumble(pv.index, 0.1, 0.4, 120); p.rig.honk = 0.35; break; }
        case 'honkResult': if (pv && e.n >= 2) msg(pv.index, TT.LINES.combo[Math.min(e.n, 5)], { big: true, color: '#ffd23a' }); break;
        case 'moo': { const t = e.tr, vol = volAt(t.x, t.z); if (vol > 0.02) A.sfx(t.ghost ? 'boo' : 'moo', { vol: 0.3 + vol * 0.7, pan: panAt(t.x, t.z) }); if (fx) fx.dust(tmp.v.set(t.x, t.y, t.z), 6, [0.5, 0.45, 0.35], 0.8, 1, 3); break; }
        case 'tipLand': {
          const t = e.tr, vol = volAt(t.x, t.z);
          if (vol > 0.02) { A.sfx('tip', { vol: 0.3 + vol * 0.7, pan: panAt(t.x, t.z) }); A.sfx('backfire', { vol: vol * 0.7, delay: 0.25 }); }
          if (fx) {
            const p = tmp.v.set(t.x - Math.sin(t.a) * 1.4, t.y + 0.2, t.z - Math.cos(t.a) * 1.4);
            fx.dust(p, 18, hw ? [0.45, 0.4, 0.5] : [0.55, 0.48, 0.36], 1.2, 2.2, 5);
            const ex = t.rig.exhaustWorld(new T.Vector3()); setTimeout(() => fx && fx.backfire(ex), 250);
            if (t.ghost) fx.sparkle(tmp.v.set(t.x, t.y + 1.5, t.z), 30, [0.4, 1, 0.6]);
          }
          for (const v of G.views) { const d = Math.hypot(v.car ? v.car.x - t.x : 99, v.car ? v.car.z - t.z : 99); if (d < 25) { TT.input.rumble(v.index, 0.6 * (1 - d / 25), 0.4, 200); v.shake = Math.max(v.shake, 0.25 * (1 - d / 25)); } }
          break;
        }
        case 'tip': {
          if (pv) { msg(pv.index, pick(hw ? TT.LINES.halloweenTip : TT.LINES.tip), { big: true, color: '#ffd23a' }); TT.input.rumble(pv.index, 0.3, 0.8, 160); }
          if (fx && e.tr) fx.sparkle(tmp.v.set(e.tr.x, e.tr.y + 2, e.tr.z), 22);
          if (G.views.length && !G.attract) {
            const left = game.goal - game.teamTips;
            if ((game.mode === 'story' || game.mode === 'hunt') && left > 0 && left <= 2) for (const v of G.views) if (v !== tv) msg(v.index, left === 1 ? 'ONE MORE TO OPEN THE GATE!' : 'TWO MORE TO OPEN THE GATE!', { color: '#9fe0ff' });
            if (tv) msg(tv.index, left > 0 ? `THEY TIPPED ONE! ${left} TO GO` : 'THEY\'VE OPENED THE GATE!', { color: '#ffb13b' });
          }
          break;
        }
        case 'wary': {
          const t = e.tr;
          if (!e.net && t) { const vol = volAt(t.x, t.z, 50); if (vol > 0.02) A.sfx('grumble', { vol: 0.3 + vol * 0.7 }); }
          if (pv) msg(pv.index, pick(TT.LINES.wary), { color: '#ffb13b' });
          break;
        }
        case 'grumble': { const t = e.tr; A.sfx('grumble', { vol: 0.3 + volAt(t.x, t.z, 50) * 0.6 }); break; }
        case 'righting': { const t = e.tr, vol = volAt(t.x, t.z, 50); if (vol > 0.05) A.sfx('grumble', { vol: vol * 0.5 }); if (fx) fx.dust(tmp.v.set(t.x, t.y, t.z), 8); break; }
        case 'roar': {
          A.sfx('roar', { vol: 1 });
          if (!G.attract) for (const v of G.views) { msg(v.index, v === tv ? 'GO GET \'EM!' : pick(TT.LINES.wake), { big: true, color: '#ff5a3a', hold: 1 }); TT.input.rumble(v.index, 1, 0.6, 700); v.shake = 0.5; }
          if (fx) { const th = game.thrasher; th.rig.world(th.rig.exhaust, tmp.v2); fx.smoke(tmp.v2, 20, 0.08, 1.4); }
          break;
        }
        case 'charge': {
          const th = game.thrasher, vol = volAt(th.x, th.z, 90);
          A.sfx('snort', { vol: 0.4 + vol * 0.6 }); A.sfx('roar', { vol: vol * 0.55, delay: 0.3 });
          if (fx) for (const n of th.rig.nostrils) { th.rig.world(n, tmp.v2); fx.smoke(tmp.v2, 8, 0.75, 0.6); }
          for (const v of G.views) if (v.car && th.target === v.car && !G.attract) msg(v.index, 'HE\'S CHARGING!', { color: '#ff5a3a' });
          if (tv) { TT.input.rumble(tv.index, 0.7, 0.5, 400); tv.shake = Math.max(tv.shake, 0.3); }
          break;
        }
        case 'bigRoar': { // a player-driven Thrasher roared
          const th = game.thrasher;
          A.sfx('roar', { vol: Math.max(0.5, volAt(th.x, th.z, 120)) });
          if (fx) for (const n of th.rig.nostrils) { th.rig.world(n, tmp.v2); fx.smoke(tmp.v2, 14, 0.75, 0.9); }
          if (tv) { msg(tv.index, e.n ? `ROAAAR! WOKE ${e.n} UP` : 'ROAAAR!', { big: true, color: '#ff5a3a' }); TT.input.rumble(tv.index, 1, 0.8, 600); tv.shake = 0.6; }
          for (const v of G.views) if (v !== tv && v.car && Math.hypot(v.car.x - th.x, v.car.z - th.z) < 40) { msg(v.index, 'THRASHER ROARED! THE HERD\'S AWAKE', { color: '#ff7a5a' }); TT.input.rumble(v.index, 0.6, 0.3, 300); v.shake = Math.max(v.shake, 0.3); }
          break;
        }
        case 'giveup': if (!G.attract && game.mode === 'story') for (const v of G.views) msg(v.index, e.home ? 'THRASHER\'S GIVEN UP… FOR NOW' : 'HE LOST YOU! KEEP QUIET', { color: '#9fe0ff' }); break;
        case 'hit': {
          const p = e.p;
          A.sfx('hit', { vol: pv ? 1 : 0.4 + volAt(p.x, p.z) * 0.6 });
          if (pv) { pv.shake = 1; TT.input.rumble(pv.index, 1, 1, 450); TT.hud.hit(pv.index); msg(pv.index, game.mode !== 'tipoff' ? `${pick(TT.LINES.hit)} ${game.maxDents - p.dents} LEFT` : e.lost ? `OUCH! −${e.lost} TIPS` : 'OUCH!', { big: true, color: '#ff5a3a' }); }
          if (tv) { msg(tv.index, `WHAM! GOT ${p.name.toUpperCase()}`, { big: true, color: '#ffd23a' }); TT.input.rumble(tv.index, 0.9, 0.6, 300); tv.shake = Math.max(tv.shake, 0.4); }
          if (fx) { fx.dust(tmp.v.set(p.x, p.y, p.z), 14, [0.5, 0.45, 0.4], 1, 2, 5); fx.sparkle(tmp.v.set(p.x, p.y + 1, p.z), 14, [1, 0.95, 0.7]); }
          break;
        }
        case 'caught': {
          const p = e.p;
          A.sfx('caught', { vol: pv ? 1 : 0.6 });
          if (pv) { pv.shake = 1; TT.input.rumble(pv.index, 1, 1, 800); TT.hud.hit(pv.index); msg(pv.index, 'CAUGHT!', { big: true, color: '#ff3b2f', hold: 2 }); }
          for (const v of G.views) if (v !== pv) msg(v.index, v === tv ? `CAUGHT ${p.name.toUpperCase()}!` : `THRASHER GOT ${p.name.toUpperCase()}!`, v === tv ? { big: true, color: '#ffd23a', hold: 1 } : { color: '#ff5a3a' });
          if (tv) TT.input.rumble(tv.index, 1, 0.8, 500);
          break;
        }
        case 'land': if (pv) TT.input.rumble(pv.index, 0.5, 0.3, 150); if (fx) fx.dust(tmp.v.set(e.p.x, e.p.y, e.p.z), 8); break;
        case 'bump': { const p = e.p, vol = pv ? 1 : volAt(p.x, p.z, 40); if (vol > 0.05) A.sfx('bump', { vol: (0.3 + e.hard * 0.7) * vol }); if (pv) { TT.input.rumble(pv.index, e.hard, 0.3, 120); pv.shake = Math.max(pv.shake, e.hard * 0.5); } break; }
        case 'boost': { const p = e.p; if (pv || volAt(p.x, p.z, 40) > 0.1) A.sfx('boost', { vol: pv ? 0.8 : 0.4 }); if (pv) TT.input.rumble(pv.index, 0.2, 0.5, 250); break; }
        case 'splash': if (fx) fx.burst(tmp.v.set(e.p.x, e.p.y + 0.3, e.p.z), 10, [0.5, 0.65, 0.85], 4, 0.25, 10, 0.7); if (pv) A.sfx('splash', { vol: 0.5 }); break;
        case 'bale': { const b = e.b, vol = volAt(b.x, b.z); if (vol > 0.02) A.sfx('bale', { vol: 0.3 + vol * 0.7 }); if (fx) { const p = tmp.v.set(b.x, w.height(b.x, b.z) + 1, b.z); fx.burst(p, 40, [0.85, 0.7, 0.32], 7, 0.3, 9, 1.4); fx.dust(p, 10, [0.75, 0.65, 0.4], 1.3, 2, 4); } break; }
        case 'pumpkin': {
          const pk = e.pk, vol = pv ? 1 : volAt(pk.x, pk.z, 50);
          if (vol > 0.03) A.sfx('splat', { vol: 0.3 + vol * 0.6 });
          if (pv) { A.sfx('candy', { vol: 0.6, delay: 0.08 }); TT.input.rumble(pv.index, 0.2, 0.4, 80); }
          if (fx) fx.burst(tmp.v.set(pk.x, pk.y + 0.4, pk.z), 22, [1, 0.5, 0.1], 5, 0.25, 12, 0.9);
          break;
        }
        case 'mow': if (fx && Math.random() < 0.7) fx.burst(tmp.v.set(e.x, w.height(e.x, e.z) + 1.2, e.z), 5, game.level.halloween ? [0.6, 0.48, 0.25] : [0.4, 0.62, 0.2], 6, 0.2, 9, 1); break;
        case 'gateOpen': A.sfx('gate'); if (!G.attract) for (const v of G.views) msg(v.index, v === tv ? 'THE GATE\'S OPEN! GUARD IT!' : 'GATE\'S OPEN! GET OUT!', { big: true, color: v === tv ? '#ff5a3a' : '#4dff7a', hold: 1 }); break;
        case 'escape': { const p = e.p; A.sfx('escape', { vol: pv ? 1 : 0.5 }); if (pv) { msg(pv.index, 'ESCAPED!', { big: true, color: '#4dff7a', hold: 2 }); TT.input.rumble(pv.index, 0.3, 0.8, 300); } for (const v of G.views) if (v !== pv) msg(v.index, v === tv ? `${p.name.toUpperCase()} GOT AWAY!` : `${p.name.toUpperCase()} GOT OUT!`, { color: v === tv ? '#ff5a3a' : '#4dff7a' }); break; }
        case 'over': if (!G.attract) { const g = game; setTimeout(() => { if (G.game === g) TT.menu.gameOver(e.results, g); }, game.mode === 'story' ? 1600 : 900); } break;
      }
      if (TT.net.active && game.role === 'host' && !e.net) TT.net.relayEvent(e);
    }
    game.events.length = 0;
  }

  // ---- continuous sound, smoke and Zs ----
  function ambience(dt) {
    const game = G.game, th = game.thrasher, A = TT.audio, w = game.world;
    const two = G.views.length > 1;
    if (!G.attract) for (const v of G.views) {
      const c = v.car; if (c.isThrasher) continue; // his diesel is the Thrasher loop below
      A.engine(v.index, { kind: c.carId, speed: c.vf, top: c.spec.top, throttle: game.state === 'play' ? c.inp.throttle : 0.1, boost: c.boosting, gain: G.paused ? 0 : two ? 0.65 : 1 });
    }
    // Thrasher's diesel, by distance to the nearest camera
    const n = nearest(th.x, th.z);
    A.thrasher({ vol: G.paused ? 0 : clamp(1 - n.d / 110, 0, 1) * (G.attract ? 0.5 : 1), awake: th.awake && th.state !== 'wake' || (th.state === 'wake' && th.t > 0.6), speed: clamp(Math.abs(th.v) / 16, 0, 1), pan: panAt(th.x, th.z) });
    // snoring and Zs from sleeping tractors near the action
    snoreT -= dt; zT -= dt; smokeT -= dt;
    if (zT <= 0) {
      zT = 0.45;
      for (const t of game.tractors) {
        if (t.state !== 'sleep' || Math.random() > 0.3) continue;
        if (nearest(t.x, t.z).d > 70) continue;
        fx.zzz(tmp.v.set(t.x + Math.sin(t.a) * 1.2, t.y + 2.0, t.z + Math.cos(t.a) * 1.2), 1);
      }
      if (th.state === 'sleep' && nearest(th.x, th.z).d < 90 && Math.random() < 0.5) fx.zzz(tmp.v.set(th.x + Math.sin(th.a) * 2.5, th.y + 5.2, th.z + Math.cos(th.a) * 2.5), 2.2);
      for (const v of G.views) if (v.car && (v.car.caught || v.car.stunT > 0)) fx.zzz(tmp.v.set(v.car.x + (Math.random() - 0.5) * 1.5, v.car.y + v.car.rig.height + 0.4, v.car.z + (Math.random() - 0.5) * 1.5), 0.8, 'star');
    }
    if (snoreT <= 0 && !G.paused) {
      snoreT = 2.6;
      let best = null, bd = 22;
      for (const t of game.tractors) if (t.state === 'sleep') { const d = nearest(t.x, t.z).d; if (d < bd) { bd = d; best = t; } }
      if (best) A.sfx('snore', { vol: (1 - bd / 22) * (G.attract ? 0.5 : 0.8), pan: panAt(best.x, best.z) });
      else if (th.state === 'sleep' && nearest(th.x, th.z).d < 40) A.sfx('snore', { vol: 0.9, pan: panAt(th.x, th.z) });
    }
    // exhaust smoke
    if (smokeT <= 0) {
      smokeT = 0.09;
      if (th.awake && nearest(th.x, th.z).d < 120) { th.rig.world(th.rig.exhaust, tmp.v2); fx.smoke(tmp.v2, 1, 0.1, Math.abs(th.v) > 8 ? 1.1 : 0.8); }
      for (const t of game.tractors) if (t.state === 'tipped' && t.t < 6 && Math.random() < 0.25 && nearest(t.x, t.z).d < 60) { t.rig.exhaustWorld(tmp.v2); fx.smoke(tmp.v2, 1, 0.15, 0.5); }
      for (const p of game.players) {
        if (p.escaped && p.z < -w.H - 30) continue;
        const sp = Math.abs(p.vf);
        if (sp > 6 && p.hop <= 0 && nearest(p.x, p.z).d < 60) {
          const s = p.surf, back = tmp.v.set(p.x - Math.sin(p.a) * p.rig.halfL * 0.8, p.y, p.z - Math.cos(p.a) * p.rig.halfL * 0.8);
          if (s === 2) fx.burst(back, 2, [0.25, 0.18, 0.1], 3, 0.18, 10, 0.6);
          else if (s === 1) fx.burst(back.setY(p.y + 1), 1, hw(game) ? [0.6, 0.48, 0.25] : [0.4, 0.62, 0.2], 3, 0.18, 6, 0.8);
          else if (Math.random() < 0.5) fx.dust(back, 1, hw(game) ? [0.35, 0.33, 0.38] : [0.5, 0.46, 0.38], 0.7, 0.6, 1);
        }
        if (p.boosting) fx.sparkle(tmp.v.set(p.x - Math.sin(p.a) * p.rig.halfL, p.y + 0.6, p.z - Math.cos(p.a) * p.rig.halfL), 2, [0.5, 0.8, 1]);
      }
      if (game.gateOpen && Math.random() < 0.6) fx.beam(tmp.v.set(w.gate.x, w.height(w.gate.x, w.gate.z) + 0.5, w.gate.z - 2), [0.3, 1, 0.5]);
    }
    // music follows Thrasher
    const hunt = th.hunting || th.state === 'search';
    const want = game.level.halloween ? (hunt && !G.attract ? 'spookyChase' : 'spooky') : (hunt && !G.attract ? 'chase' : 'calm');
    if (want !== musicKey) { musicKey = want; A.music(want); }
  }
  const hw = game => !!game.level.halloween;

  // ---- loop ----
  function loop(now) {
    requestAnimationFrame(loop);
    const t = now / 1000; let dt = Math.min(0.1, t - (last || t)); last = t; G.t = t;
    const game = G.game;
    TT.input.update(t, { twoLocal: game && !G.attract && G.views.length === 2 });
    TT.menu.update(dt);
    if (game) {
      if (!G.paused) {
        for (const v of G.views) {
          if (G.attract) continue;
          const p = TT.input.players[G.views.length === 2 ? v.index : 0], c = v.car;
          Object.assign(c.inp, { throttle: p.throttle, brake: p.brake, steer: p.steer, boost: p.boost, drift: p.drift, look: p.look });
          if (p.honk) c.inp.honk = true;
          v.orbit = damp(v.orbit || 0, p.camX * 2.4, p.camX ? 6 : 4, dt); v.orbitP = damp(v.orbitP || 0, -p.camY, 5, dt);
          if (p.cam) { v.mode = (v.mode + 1) % 3; TT.settings.camera = v.mode; TT.saveSettings(); }
        }
        acc += dt; let n = 0;
        while (acc >= STEP && n < 5) { game.update(STEP); acc -= STEP; n++; }
        if (n === 5) acc = 0;
        if (TT.net.active && game.net) TT.net.tick(dt, game);
      }
      events();
      const rdt = G.paused ? 0 : dt;
      for (const p of game.players) p.render(rdt);
      for (const tr of game.tractors) tr.render(rdt, t);
      game.thrasher.render(rdt, t);
      for (const v of G.views) updateCam(v, dt);
      game.world.update(t, rdt);
      if (fx) { ambience(rdt); fx.update(rdt); }
      if (!G.attract) TT.hud.update(dt, G.views, game);
    }
    render();
  }
  function render() {
    const W = innerWidth, Hh = innerHeight;
    if (room && room.visible) {
      renderer.setViewport(0, 0, W, Hh); renderer.setScissor(0, 0, W, Hh);
      renderer.toneMappingExposure = 1.1;
      room.update(G.t); renderer.render(room.scene, room.cam);
      return;
    }
    const game = G.game;
    if (!game) { renderer.setScissor(0, 0, W, Hh); renderer.setClearColor(0x0b0d18); renderer.clear(); return; }
    renderer.toneMappingExposure = game.world.theme.exposure;
    for (const v of G.views) {
      const R = v.rect, y = Hh - R.y - R.h;
      renderer.setViewport(R.x, y, R.w, R.h); renderer.setScissor(R.x, y, R.w, R.h);
      game.world.frame(v.cam, v.focus);
      if (fx) fx.setScale(R.h);
      for (const p of game.players) if (p.rig.tag) p.rig.tag.visible = p !== v.car;
      renderer.render(game.world.scene, v.cam);
    }
  }

  // ---- showroom (picking a car) ----
  G.showRoom = ids => { room = room || makeRoom(); room.set(ids); room.visible = true; G.room = room; };
  G.hideRoom = () => { if (room) room.visible = false; };
  function makeRoom() {
    const scene = new T.Scene(); scene.background = new T.Color(0x0e1426); scene.fog = new T.Fog(0x0e1426, 12, 34);
    const cam = new T.PerspectiveCamera(36, 1, 0.1, 120);
    const ground = new T.Mesh(new T.CircleGeometry(30, 48), new T.MeshStandardMaterial({ color: 0x2f3a22, roughness: 0.95 }));
    ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; scene.add(ground);
    const dirt = new T.Mesh(new T.CircleGeometry(4.2, 40), new T.MeshStandardMaterial({ color: 0x5a4632, roughness: 1 }));
    dirt.rotation.x = -Math.PI / 2; dirt.position.y = 0.01; dirt.receiveShadow = true; scene.add(dirt);
    // bales and a bit of fence round the edge
    const k = new TT.models.Kit(), M = TT.models;
    for (let i = 0; i < 9; i++) { const a = Math.PI * 0.15 + i / 8 * Math.PI * 0.7 + Math.PI; k.add('matte', M.CYL(16), '#c9a24a', [Math.cos(a) * 7, 0.85, Math.sin(a) * 7], [0, -a, Math.PI / 2], [0.9, 1.3, 0.9]); }
    for (let i = -6; i <= 6; i++) k.add('matte', M.BOX(), '#7a5a3a', [i * 2.2, 0.7, -10], [0, 0, 0], [0.18, 1.4, 0.18]);
    for (const y of [0.55, 1.05]) k.add('matte', M.BOX(), '#7a5a3a', [0, y, -10], [0, 0, 0], [26.4, 0.14, 0.07]);
    // the barn wall behind
    k.add('matte', M.BOX(), '#8a2a22', [0, 4, -14], [0, 0, 0], [24, 8, 0.4]);
    for (let i = -5; i <= 5; i++) k.add('matte', M.BOX(), '#6a1e18', [i * 2.2, 4, -13.78], [0, 0, 0], [0.08, 8, 0.05]);
    k.add('glow', M.SPH(10, 6), '#ffd27a', [0, 6.2, -13.4], [0, 0, 0], [0.3, 0.22, 0.3]);
    scene.add(k.build({}, true));
    scene.add(new T.HemisphereLight(0x8aa0d8, 0x2a2014, 1.0));
    const key = new T.SpotLight(0xffe0b0, 520, 40, 0.55, 0.5, 1.5); key.position.set(3, 9, 6); key.castShadow = true; key.shadow.mapSize.set(1024, 1024); scene.add(key);
    const lamp = new T.PointLight(0xffc070, 60, 20, 2); lamp.position.set(0, 6, -12.6); scene.add(lamp);
    const rim = new T.SpotLight(0x8fb0ff, 500, 40, 0.6, 0.6, 1.5); rim.position.set(-6, 5, -6); scene.add(rim);
    const pm = new T.PMREMGenerator(renderer), es = new T.Scene();
    es.add(new T.Mesh(new T.SphereGeometry(10, 16, 8), new T.MeshBasicMaterial({ side: T.BackSide, color: 0x334466 })));
    const lt = new T.Mesh(new T.BoxGeometry(6, 0.4, 0.4), new T.MeshBasicMaterial({ color: 0xffffff })); lt.position.set(0, 6, 3); es.add(lt);
    scene.environment = pm.fromScene(es, 0.04).texture; pm.dispose();
    let models = [], key2 = '';
    return {
      scene, cam, visible: false,
      set(ids) {
        const kk = ids.join(',');
        if (kk === key2) return; key2 = kk;
        for (const m of models) { scene.remove(m.root); m.dispose(); }
        models = ids.map((id, i) => {
          const r = new TT.models.CarRig(id, { night: true, shadows: true, headlight: 0, halloween: TT.menu.ctx && TT.menu.ctx.halloween });
          r.blob.visible = false; scene.add(r.root);
          return r;
        });
      },
      update(t) {
        const W = innerWidth, Hh = innerHeight, wide = W / Hh > 1.2, two = models.length > 1;
        cam.aspect = W / Hh; cam.updateProjectionMatrix();
        if (two) { cam.position.set(0, 3.2, 13.5); cam.lookAt(0, wide ? -0.2 : 0.2, 0); }
        else { cam.position.set(wide ? -1.6 : 0, 2.4, 9.5); cam.lookAt(wide ? -1.6 : 0, 0.9, 0); }
        models.forEach((m, i) => {
          const x = two ? (i ? 2.9 : -2.9) : wide ? -2.9 : 0;
          m.root.position.set(x, 0, two && wide ? -0.5 : 0); m.root.rotation.y = t * 0.5 + (i ? Math.PI : 0);
          m.update({ speed: 0, steer: Math.sin(t * 0.8) * 0.4, mood: 'happy', lookX: Math.sin(t * 0.7) * 0.6, lookY: 0 }, 1 / 60);
        });
      },
    };
  }

  addEventListener('load', boot);
})();
