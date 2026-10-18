// Road Rumble: boot, the main loop, cameras and split screen, and turning race events into sound, rumble,
// sparks and HUD messages.
(() => {
  'use strict';
  const RR = window.RR, { clamp, lerp, damp } = RR.math;
  const STEP = 1 / 60;
  const G = RR.game = { race: null, views: [], paused: false, t: 0, attract: false, garage: null, ready: false };
  let T, renderer, canvas, acc = 0, last = 0, fx = null, garageScene = null;
  const tmp = {};

  // ---- quality ----
  function pickQuality() {
    let q = RR.settings.quality;
    if (q === 'auto') q = RR.isMobile ? 'low' : 'high';
    return {
      name: q,
      shadows: { high: 2048, medium: 1024, low: 0 }[q],
      ratio: Math.min(devicePixelRatio || 1, { high: 2, medium: 1.5, low: 1.15 }[q]),
      aa: q !== 'low',
    };
  }

  function boot() {
    T = window.THREE;
    if (!T) { document.getElementById('loading').textContent = 'Could not load the 3D engine.'; return; }
    canvas = document.getElementById('game');
    G.quality = pickQuality();
    renderer = G.renderer = new T.WebGLRenderer({ canvas, antialias: G.quality.aa, powerPreference: 'high-performance' });
    renderer.setPixelRatio(G.quality.ratio);
    renderer.outputColorSpace = T.SRGBColorSpace;
    renderer.toneMapping = T.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.0;
    renderer.shadowMap.enabled = true; renderer.shadowMap.type = T.PCFSoftShadowMap;
    renderer.setScissorTest(true);
    Object.assign(tmp, { v: new T.Vector3(), v2: new T.Vector3(), v3: new T.Vector3(), e: new T.Euler(0, 0, 0, 'YXZ'), q: new T.Quaternion() });
    RR.models.init(); RR.worldInstall();
    RR.input.init(); RR.hud.init(); RR.menu.init();
    addEventListener('resize', resize); resize();
    G.startAttract();
    document.getElementById('loading').style.display = 'none';
    G.ready = true;
    requestAnimationFrame(loop);
  }
  function resize() {
    renderer.setSize(innerWidth, innerHeight, false);
    layoutViews();
  }
  G.applyQuality = () => {
    const q = pickQuality();
    const reload = q.shadows !== G.quality.shadows;
    G.quality = q; renderer.setPixelRatio(q.ratio); resize();
    return reload;
  };

  // ---- races ----
  function loadingScreen(on, text) { const el = document.getElementById('loading'); el.textContent = text || 'LOADING…'; el.style.display = on ? 'grid' : 'none'; }
  G.startRace = (cfg) => {
    loadingScreen(true, 'LOADING ' + RR.TRACKS[cfg.trackIndex].name.toUpperCase() + '…');
    return new Promise(res => setTimeout(() => {
      G.clearRace();
      const race = G.race = new RR.Race(cfg, renderer, G.quality);
      fx = new RR.FX(race.world.scene);
      G.attract = cfg.mode === 'attract';
      G.views = [];
      if (G.attract) G.views.push(makeView(race.riders[0], 0));
      else for (const h of race.humans) if (h.view !== null && h.view !== undefined && !h.remote) G.views.push(makeView(h, h.view));
      G.views.sort((a, b) => a.index - b.index);
      if (race.track.theme.night) for (const v of G.views) if (!G.attract) addHeadlight(v);
      renderer.toneMappingExposure = race.track.theme.night ? 1.35 : 1.0;
      layoutViews();
      for (const v of G.views) snapCam(v);
      if (!G.attract) { RR.hud.setup(G.views, race); RR.audio.music('race'); }
      else RR.hud.hide();
      G.paused = false; acc = 0;
      loadingScreen(false);
      res(race);
    }, 30));
  };
  G.clearRace = () => {
    if (!G.race) return;
    RR.audio.stopEngines(); RR.audio.siren(0);
    G.race.dispose(); G.race = null; G.views = []; fx = null;
  };
  G.startAttract = () => {
    const ti = Math.floor(Math.random() * RR.TRACKS.length);
    RR.hud.hide();
    RR.audio.music('menu');
    return G.startRace({ trackIndex: ti, level: 2, mode: 'attract', humans: [], seed: Date.now() % 1000 });
  };
  G.togglePause = (on) => {
    if (!G.race || G.attract) return;
    G.paused = on === undefined ? !G.paused : on;
    RR.audio.setPaused(G.paused);
    RR.ads.gameplay(!G.paused);
  };

  // ---- views and cameras ----
  function makeView(rider, index) {
    const cam = new T.PerspectiveCamera(62, 1, 0.3, 4000);
    return { rider, index, cam, mode: RR.settings.camera || 0, orbit: 0, orbitP: 0, shake: 0, fov: 62, back: 5.5, camD: rider.d, camH: 2, rect: { x: 0, y: 0, w: 1, h: 1 }, cine: { t: 0, kind: 0, who: 0 }, s: rider.s };
  }
  function layoutViews() {
    const W = innerWidth, Hh = innerHeight, n = G.views.length;
    G.views.forEach((v, i) => {
      v.rect = n === 2 ? { x: 0, y: i === 0 ? 0 : Hh / 2, w: W, h: Hh / 2 } : { x: 0, y: 0, w: W, h: Hh };
      v.cam.aspect = v.rect.w / v.rect.h; v.cam.updateProjectionMatrix();
    });
    RR.hud.layout && RR.hud.layout(G.views);
  }
  function addHeadlight(v) {
    const L = new T.SpotLight(0xfff0d0, 2200, 110, 0.45, 0.5, 1.5);
    v.light = L; G.race.world.scene.add(L); G.race.world.scene.add(L.target);
  }
  function focusOf(r, out) {
    const tr = G.race.track;
    if (r.crash) { const c = r.crash, o = c.phase === 'run' || c.phase === 'lie' || c.phase === 'mount' ? c.r : c.r; return tr.pos(o.s, o.d, (c.phase === 'fly' ? o.h : 0) + 0.6, out); }
    const p = tr.pos(r.s, r.d, 0, out); p.y = r.Y + 0.9; return p;
  }
  function snapCam(v) { v.camD = v.rider.d; v.camH = 2; updateCam(v, 1, true); }
  function updateCam(v, dt, snap) {
    const race = G.race, tr = race.track, r = v.rider, cam = v.cam;
    if (G.attract) return cinematic(v, dt);
    const sp = r.crash ? 0 : r.v;
    const modes = [{ back: 4.3, h: 1.7, fov: 58 }, { back: 7.5, h: 2.8, fov: 56 }, { back: 3.0, h: 1.3, fov: 62 }, { back: 0, h: 0, fov: 72 }];
    const M = modes[v.mode % 4];
    let fov = M.fov + clamp(sp * 0.17, 0, 14) + (r.nitroT > 0 ? 7 : 0);
    const focus = focusOf(r, tmp.v3);
    if (race.state === 'countdown' && race.time < -1.1) {
      // swing round from the front to behind during the countdown
      const k = clamp((race.time + 4.2) / 3.1, 0, 1), a = Math.PI * (1 - RR.math.smooth(k));
      const back = lerp(7, M.back || 5.4, k);
      const p = tr.pos(r.s - Math.cos(a) * back, r.d + Math.sin(a) * back * 0.6, 0, tmp.v); p.y = tr.height(r.s) + lerp(1.4, M.h || 1.9, k);
      cam.position.copy(p); cam.up.set(0, 1, 0); cam.lookAt(focus);
    } else if (r.crash && r.crash.phase !== 'mount') {
      const o = r.crash.r;
      const p = tr.pos(o.s - 7, o.d * 0.6, 0, tmp.v); p.y = Math.max(tr.height(o.s - 7), tr.height(o.s)) + 3.2;
      if (snap) cam.position.copy(p); else cam.position.lerp(p, 1 - Math.exp(-4 * dt));
      cam.up.set(0, 1, 0); cam.lookAt(focus);
      fov = 58;
    } else if (v.mode % 4 === 3 && !r.lookBack) {
      // helmet cam
      const p = tr.pos(r.s + 0.05, r.d, 0, tmp.v); p.y = r.Y + r.model.D.seat + 0.78;
      cam.position.copy(p);
      const ahead = tr.pos(r.s + 30, r.d + Math.tan(r.phi) * 30, 0, tmp.v2); ahead.y = tr.height(r.s + 30) + 1.2;
      cam.up.set(0, 1, 0); cam.lookAt(ahead); cam.rotateZ(r.lean * 0.6); cam.rotateY(-v.orbit);
    } else {
      // right stick swings the camera round the bike (a = yaw, v.orbitP = height)
      const look = r.lookBack, a = v.orbit, k = Math.min(1, Math.abs(a) * 1.5);
      const back = (M.back + sp * 0.014 + k * 1.2) * (look ? -1.3 : 1);
      v.camD = snap ? r.d : damp(v.camD, r.d - Math.sin(r.phi) * 1.5, 6, dt);
      const cs = r.s - back * Math.cos(a), cd = v.camD - back * Math.sin(a);
      const p = tr.pos(cs, cd, 0, tmp.v);
      const ground = Math.max(tr.height(cs), r.Y - 0.6);
      v.camH = snap ? ground + M.h : damp(v.camH, ground + M.h + (r.air ? 0.4 : 0) + v.orbitP * 3, 7, dt);
      p.y = Math.max(v.camH, tr.height(cs) + 0.6);
      cam.position.copy(p);
      const la = look ? tr.pos(r.s, r.d, 0, tmp.v2) : tr.pos(r.s + (7 + sp * 0.12) * (1 - k), r.d * 0.85 + v.camD * 0.15, 0, tmp.v2);
      la.y = look ? r.Y + 1.1 : r.Y + 0.95 + (tr.height(r.s + 7 + sp * 0.12) - tr.height(r.s)) * 0.5 * (1 - k);
      cam.up.set(0, 1, 0); cam.lookAt(la);
      cam.rotateZ(r.lean * -0.18 * (look ? -1 : 1));
    }
    // shake: hits, crashes, rough ground, speed
    v.shake = Math.max(0, v.shake - dt * 2.2);
    const sh = v.shake * v.shake * 0.25 + (r.offroad && !r.crash ? 0.02 * Math.min(1, sp / 20) : 0) + (sp > 45 ? (sp - 45) * 0.0006 : 0);
    if (sh > 0) { cam.position.x += (Math.random() - 0.5) * sh; cam.position.y += (Math.random() - 0.5) * sh; cam.rotateZ((Math.random() - 0.5) * sh * 0.2); }
    v.fov = snap ? fov : damp(v.fov, fov, 3, dt);
    if (Math.abs(cam.fov - v.fov) > 0.01) { cam.fov = v.fov; cam.updateProjectionMatrix(); }
    v.s = r.crash ? r.crash.r.s : r.s;
    if (v.light) {
      const lp = tr.pos(r.s + 0.6, r.d, 0, tmp.v); lp.y = r.Y + 1.0; v.light.position.copy(lp);
      const lt = tr.pos(r.s + 25, r.d + Math.tan(r.phi) * 25, 0, tmp.v2); lt.y = tr.height(r.s + 25); v.light.target.position.copy(lt);
      v.light.visible = !r.crash;
    }
  }
  // title-screen camera work over an all-AI race
  function cinematic(v, dt) {
    const race = G.race, tr = race.track, c = v.cine, cam = v.cam;
    c.t -= dt;
    let r = race.riders[c.who];
    if (c.t <= 0 || !r || r.crash) {
      c.t = 6 + Math.random() * 3; c.kind = (c.kind + 1 + Math.floor(Math.random() * 3)) % 4;
      const cands = race.riders.filter(x => !x.cop && !x.crash);
      const lead = cands.sort((a, b) => b.s - a.s);
      r = lead[Math.min(lead.length - 1, Math.floor(Math.random() * 4))]; c.who = race.riders.indexOf(r);
      c.side = Math.random() < 0.5 ? -1 : 1; c.fixS = r.s + 60 + r.v * 1.5; c.fixD = c.side * (RR.ROAD_HALF + 4);
    }
    const focus = focusOf(r, tmp.v3);
    let p;
    if (c.kind === 0) { p = tr.pos(r.s - 5.5, r.d, 0, tmp.v); p.y = r.Y + 1.7; }
    else if (c.kind === 1) { p = tr.pos(r.s + 2, r.d + c.side * 5, 0, tmp.v); p.y = r.Y + 1.0; }
    else if (c.kind === 2) { p = tr.pos(c.fixS, c.fixD, 0, tmp.v); p.y = tr.height(c.fixS) + 1.2; if (r.s > c.fixS + 25) c.t = 0; }
    else { p = tr.pos(r.s - 14, r.d + c.side * 6, 0, tmp.v); p.y = r.Y + 9; }
    cam.position.copy(p); cam.up.set(0, 1, 0); cam.lookAt(focus);
    if (cam.fov !== 55) { cam.fov = 55; cam.updateProjectionMatrix(); }
    v.rider = r; v.s = r.s;
  }

  // ---- events -> sound, rumble, sparks, HUD ----
  function nearestView(p) {
    let best = null, bd = 1e9;
    for (const v of G.views) { const d = v.cam.position.distanceTo(p); if (d < bd) { bd = d; best = v; } }
    return { v: best, d: bd };
  }
  function viewOf(r) { return G.views.find(v => v.rider === r && !G.attract); }
  function events() {
    const race = G.race, tr = race.track, msg = RR.hud.message;
    for (const e of race.events) {
      const who = e.who, wv = who ? viewOf(who) : null;
      const pos = who ? focusOf(who, tmp.v3) : null;
      const near = pos ? nearestView(pos) : { d: 1e9 };
      const vol = clamp(1 - near.d / 70, 0, 1);
      switch (e.type) {
        case 'count': RR.audio.sfx('beep'); RR.hud.countdown(e.n); break;
        case 'go': if (!G.attract) RR.ads.gameplay(true); RR.audio.sfx('go'); RR.hud.countdown(0); for (const v of G.views) RR.input.rumble(v.index, 0.3, 0.6, 200); break;
        case 'swing': break;
        case 'whiff': if (vol > 0.05) RR.audio.sfx('whiff', { vol: vol * 0.6 }); break;
        case 'hit': {
          const tp = focusOf(e.tgt, tmp.v2); tp.y += 0.4;
          const nv = nearestView(tp), hv = clamp(1 - nv.d / 70, 0, 1);
          if (hv > 0.02 && e.info.kind !== 'gun') RR.audio.sfx(e.info.sfx || 'punch', { vol: 0.5 + hv * 0.5 });
          if (fx) fx.hitFlash(tp);
          const tv = viewOf(e.tgt);
          if (tv && e.info.kind === 'gun') { tv.shake = Math.min(0.6, tv.shake + 0.08); RR.input.rumble(tv.index, 0.3, 0.5, 60); }
          else if (tv) { tv.shake = Math.min(1, tv.shake + 0.55); RR.input.rumble(tv.index, 0.85, 0.6, 170); RR.hud.flash(tv.index, e.info.side); if (!who.human && Math.random() < 0.3) msg(tv.index, `${who.name}: ${pick(RR.TAUNTS.hit)}`, { taunt: true }); }
          if (wv) { wv.shake = Math.min(1, wv.shake + 0.2); RR.input.rumble(wv.index, 0.2, 0.7, 90); }
          break;
        }
        case 'steal': if (wv) msg(wv.index, `GRABBED ${RR.WEAPONS[e.w].name}!`, { big: false, color: '#ffd54f' }); RR.audio.sfx('steal', { vol: Math.max(vol, wv ? 1 : 0) }); break;
        case 'weapon': if (wv) { msg(wv.index, `GOT ${RR.WEAPONS[e.w].name}!`, { color: '#ffd54f' }); RR.audio.sfx('steal'); } break;
        case 'crash': {
          if (vol > 0.02) RR.audio.sfx(e.cause === 'knock' ? 'thud' : 'crash', { vol: 0.4 + vol * 0.6 });
          if (fx && pos && e.cause !== 'knock') fx.sparkBurst(pos, 40, 6);
          if (wv) {
            wv.shake = 1; RR.input.rumble(wv.index, 1, 1, 450);
            msg(wv.index, who.out === 'wrecked' ? 'BIKE WRECKED!' : e.cause === 'shot' ? 'SHOT OFF!' : e.cause === 'knock' ? 'KNOCKED OFF!' : 'WIPEOUT!', { big: true, color: '#ff5252' });
            if (who.out === 'wrecked') RR.audio.sfx('wrecked');
          }
          if (e.by && e.by.human) {
            const bv = viewOf(e.by);
            if (bv) { msg(bv.index, `KNOCKED OFF ${who.name.toUpperCase()}!`, { big: true, color: '#ffd54f' }); RR.input.rumble(bv.index, 0.4, 0.9, 200); }
          }
          if (who.human && e.by && !e.by.human) for (const v of G.views) if (v.rider === who && Math.random() < 0.6) msg(v.index, `${e.by.name}: ${pick(RR.TAUNTS.knock)}`, { taunt: true });
          break;
        }
        case 'thud': if (vol > 0.05) RR.audio.sfx('thud', { vol: vol * 0.7 }); if (fx) fx.puff(tr.pos(e.s, e.d, 0, tmp.v2), 5, [0.55, 0.5, 0.45], 0.5); break;
        case 'bikeBounce': if (vol > 0.05) RR.audio.sfx('land', { vol: vol * 0.6 }); if (fx) fx.sparkBurst(tr.pos(e.s, e.d, 0.1, tmp.v2), 12, 4); break;
        case 'land': if (wv && e.impact > 4) { RR.audio.sfx('land', { vol: clamp(e.impact / 14, 0.3, 1) }); RR.input.rumble(wv.index, clamp(e.impact / 15, 0.2, 1), 0.3, 120); wv.shake = Math.min(1, wv.shake + e.impact / 30); } if (fx && pos && e.impact > 5) fx.puff(tr.pos(who.s, who.d, 0, tmp.v2), 6, [0.6, 0.58, 0.55], 0.6); break;
        case 'scrape': if (fx && pos && Math.random() < 0.5) fx.sparkBurst(tr.pos(who.s, who.d + e.side * 0.4, 0.4, tmp.v2), 3, 3); if (wv) RR.input.rumble(wv.index, 0.3, 0.3, 60); break;
        case 'bump': if (vol > 0.05) RR.audio.sfx('kick', { vol: vol * 0.35, rate: 0.7 }); { const a = viewOf(e.who), b = e.other && viewOf(e.other); if (a) RR.input.rumble(a.index, 0.3, 0.2, 80); if (b) RR.input.rumble(b.index, 0.3, 0.2, 80); } break;
        case 'horn': if (wv || vol > 0.4) { RR.audio.sfx(e.car.type === 'truck' || e.car.type === 'bus' ? 'truckhorn' : 'horn', { vol: wv ? 0.8 : vol * 0.5, rate: e.car.horn }); if (wv && e.car.v < 0) RR.audio.sfx('pass', { vol: 0.7 }); } break;
        case 'nitro': if (vol > 0.05 || wv) RR.audio.sfx('nitro', { vol: wv ? 1 : vol }); if (wv) RR.input.rumble(wv.index, 0.6, 0.4, 300); break;
        case 'copGo': for (const v of G.views) if (v.rider === e.prey) msg(v.index, 'COPS!', { big: true, color: '#64b5f6' }); break;
        case 'busted': if (wv) { msg(wv.index, 'BUSTED!', { big: true, color: '#64b5f6', hold: 3 }); RR.audio.sfx('busted'); RR.input.rumble(wv.index, 0.8, 0.8, 600); } break;
        case 'finish': if (wv) { msg(wv.index, `${RR.ordinal(e.place).toUpperCase()} PLACE!`, { big: true, color: e.place <= RR.QUALIFY ? '#ffd54f' : '#ffffff', hold: 3 }); RR.audio.sfx('finish'); RR.input.rumble(wv.index, 0.5, 0.8, 400); } break;
        case 'shoot': {
          const a = focusOf(who, tmp.v2).clone(); a.y += 0.5;
          const b = e.tgt ? focusOf(e.tgt, tmp.v3).clone() : tr.pos(who.s + 25, who.d + e.side * 3, 1.2, tmp.v3).clone();
          if (fx) fx.tracer(a, b, 10, 0.05);
          RR.audio.sfx('shotgun', { vol: wv ? 1 : Math.max(0.2, vol) });
          if (wv) { wv.shake = Math.min(1, wv.shake + 0.4); RR.input.rumble(wv.index, 1, 0.6, 180); }
          break;
        }
        case 'gun': {
          const a = focusOf(who, tmp.v2).clone(); a.y += 0.6;
          const b = e.tgt ? focusOf(e.tgt, tmp.v3).clone() : a.clone();
          if (fx && e.tgt) { fx.tracer(a, b, 1, 0.02); fx.hitFlash(b); }
          if (vol > 0.05 || wv) RR.audio.sfx('gun', { vol: wv ? 0.55 : vol * 0.5 });
          if (wv) RR.input.rumble(wv.index, 0.15, 0.4, 50);
          break;
        }
        case 'blaze': if (wv) { msg(wv.index, 'TURBO BLAZE!', { big: true, color: '#ff8a00' }); RR.input.rumble(wv.index, 0.8, 1, 500); wv.shake = 0.6; } RR.audio.sfx('nitro', { vol: wv ? 1 : vol, rate: 0.8 }); break;
        case 'frenzy': if (wv) { msg(wv.index, 'FRENZY!', { big: true, color: '#ff1744' }); RR.input.rumble(wv.index, 1, 0.8, 400); } RR.audio.sfx('busted', { vol: wv ? 0.8 : vol, rate: 1.4 }); break;
        case 'smash': if (fx && pos) fx.sparkBurst(pos, 16, 6); if (vol > 0.05) RR.audio.sfx('metal', { vol: 0.4 + vol * 0.4, rate: 0.7 }); if (e.car && (wv || vol > 0.3)) RR.audio.sfx('horn', { vol: 0.6, rate: e.car.horn }); if (wv) RR.input.rumble(wv.index, 0.7, 0.5, 150); break;
        case 'pickup': if (wv) { msg(wv.index, 'SHOTGUN! ×3', { color: '#ffd54f' }); RR.audio.sfx('steal'); RR.input.rumble(wv.index, 0.3, 0.8, 150); } break;
        case 'raceOver': if (!G.attract) setTimeout(() => RR.menu.raceOver(e.results, race), 50); break;
      }
      if (RR.net && RR.net.active && race.role === 'host') RR.net.relayEvent(e);
    }
    race.events.length = 0;
  }
  const pick = a => a[Math.floor(Math.random() * a.length)];

  // continuous sound per view
  function sound(dt) {
    const race = G.race;
    if (G.attract || !race) return;
    const two = G.views.length > 1;
    let siren = 0, sirenPan = 0;
    for (const v of G.views) {
      const r = v.rider, i = v.index;
      RR.audio.engine(i, { speed: r.v, top: r.bike.top, throttle: race.state === 'countdown' ? (r.inp.throttle ? 0.6 : 0.1) : r.inp.throttle, nitro: r.nitroT > 0, offroad: r.offroad, airborne: r.air, crashed: !!r.crash || !!r.out, gain: G.paused ? 0 : two ? 0.62 : 1, pan: 0 });
      // nearest rival engine
      let best = null, bd = 80;
      for (const o of race.riders) { if (o === r || o.crash || (o.cop && o.copState === 'parked')) continue; const d = Math.hypot(o.s - r.s, o.d - r.d); if (d < bd) { bd = d; best = o; } }
      RR.audio.pack(i, best ? { dist: bd, speed: best.v, closing: (best.s > r.s ? r.v - best.v : best.v - r.v), pan: clamp((best.d - r.d) / 8, -1, 1) } : null);
      RR.audio.scrape(i, r.crash && r.crash.sliding ? 0.8 : r.wallT > 0 ? 0.6 : 0);
      if (r.copSkin && !r.crash) { siren = Math.max(siren, 0.45); }
      for (const o of race.riders) if (o.cop && o.siren) { const d = Math.abs(o.s - r.s); const x = clamp(1 - d / 260, 0, 1); if (x > siren) { siren = x; sirenPan = clamp((o.d - r.d) / 10, -1, 1); } }
    }
    RR.audio.siren(G.paused ? 0 : siren, sirenPan);
  }
  // continuous effects: dust off-road, sparks under sliding bikes, nitro flames
  function effects(dt) {
    const race = G.race, tr = race.track;
    for (const r of race.riders) {
      const near = G.views.some(v => Math.abs(v.s - r.s) < 120);
      if (!near) continue;
      if (r.crash && r.crash.sliding && Math.random() < 0.8) fx.sparkBurst(tr.pos(r.crash.b.s, r.crash.b.d, 0.1, tmp.v2), 2, 3, 0, 0);
      if (!r.crash && r.offroad && r.v > 6 && !r.air && Math.random() < 0.6) {
        const p = tr.pos(r.s - 0.8, r.d, 0, tmp.v2); const th = tr.themeId;
        fx.puff(p, 1, th === 'desert' ? [0.75, 0.55, 0.38] : th === 'coast' ? [0.7, 0.62, 0.5] : [0.45, 0.4, 0.32], 0.7);
      }
      if (!r.crash && r.nitroT > 0) { const p = tr.pos(r.s - 0.95, r.d + 0.12, 0, tmp.v2); p.y = r.Y + 0.45; fx.flame(p, 0, 0); }
      if (!r.crash && r.blazeT > 0) for (const off of [-0.7, 0.72]) { const p = tr.pos(r.s + off, r.d, 0, tmp.v2); p.y = r.Y + 0.25; fx.fire(p, 0, 0); }
    }
    fx.update(dt);
  }

  // ---- loop ----
  function loop(now) {
    requestAnimationFrame(loop);
    const t = now / 1000; let dt = Math.min(0.1, t - (last || t)); last = t; G.t = t;
    const race = G.race;
    RR.input.update(t, { twoLocal: race && !G.attract && G.views.length === 2 });
    RR.menu.update(dt);
    if (race) {
      if (!G.paused) {
        // local players' controls
        for (const v of G.views) {
          if (G.attract) continue;
          const p = RR.input.players[G.views.length === 2 ? v.index : 0], r = v.rider;
          Object.assign(r.inp, { throttle: p.throttle, brake: p.brake, steer: p.steer, nitro: p.nitro });
          if (p.turbo) r.inp.turbo = true; if (p.frenzy) r.inp.frenzy = true;
          v.orbit = damp(v.orbit || 0, p.camX * 2.6, p.camX ? 6 : 4, dt); v.orbitP = damp(v.orbitP || 0, p.camY, 5, dt);
          if (p.atkL) r.inp.atkL = true; if (p.atkR) r.inp.atkR = true; if (p.kick) { r.inp.kick = true; r.inp.kickSide = p.kickSide; }
          r.inp.mash = p.mash; r.lookBack = p.look;
          if (p.cam) { v.mode = (v.mode + 1) % 4; RR.settings.camera = v.mode; RR.saveSettings(); }
          if (r.finished || r.out) { r.inp.throttle = 0; }
        }
        acc += dt; let n = 0;
        while (acc >= STEP && n < 5) { race.update(STEP); acc -= STEP; n++; for (const v of G.views) { const r = v.rider; r.inp.mash = false; } }
        if (n === 5) acc = 0;
        if (RR.net && RR.net.active) RR.net.tick(dt, race);
      }
      events();
      if (fx) effects(G.paused ? 0 : dt);
      sound(dt);
      for (const r of race.riders) r.render(G.paused ? 0 : dt, tmp);
      for (const v of G.views) updateCam(v, dt);
      race.world.stream(G.views, 1);
      race.world.updateTraffic(G.views);
      race.world.animate(G.t, G.views);
      if (!G.attract) RR.hud.update(dt, G.views, race);
    }
    render();
  }
  function render() {
    const W = innerWidth, Hh = innerHeight;
    if (G.garage && G.garage.visible) {
      renderer.setViewport(0, 0, W, Hh); renderer.setScissor(0, 0, W, Hh);
      G.garage.update(G.t); renderer.render(G.garage.scene, G.garage.cam);
      return;
    }
    const race = G.race;
    if (!race) { renderer.setScissor(0, 0, W, Hh); renderer.setClearColor(0x0d0d10); renderer.clear(); return; }
    for (const v of G.views) {
      const R = v.rect, y = Hh - R.y - R.h;
      renderer.setViewport(R.x, y, R.w, R.h); renderer.setScissor(R.x, y, R.w, R.h);
      race.world.frame(v.cam, focusOf(v.rider, tmp.v3), G.t);
      // hide other riders that are right on top of this camera
      for (const r of race.riders) r.model.root.visible = r === v.rider || r.model.bike.position.distanceToSquared(v.cam.position) > 6.5;
      renderer.render(race.world.scene, v.cam);
    }
  }

  // ---- garage turntable (bike shop / bike select) ----
  G.showGarage = (bikeId, look) => {
    if (!garageScene) garageScene = makeGarage();
    garageScene.set(bikeId, look);
    garageScene.visible = true; G.garage = garageScene;
  };
  G.hideGarage = () => { if (garageScene) garageScene.visible = false; };
  function makeGarage() {
    const scene = new T.Scene(); scene.background = new T.Color(0x101014);
    scene.fog = new T.Fog(0x101014, 8, 22);
    const cam = new T.PerspectiveCamera(36, 1, 0.1, 100);
    const floor = new T.Mesh(new T.CircleGeometry(12, 48), new T.MeshStandardMaterial({ color: 0x2a2a2e, roughness: 0.35, metalness: 0.2 }));
    floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);
    const disc = new T.Mesh(new T.CylinderGeometry(1.7, 1.75, 0.08, 48), new T.MeshStandardMaterial({ color: 0x3a3a40, roughness: 0.4, metalness: 0.6 }));
    disc.position.y = 0.04; disc.receiveShadow = true; scene.add(disc);
    scene.add(new T.HemisphereLight(0x8090b0, 0x201810, 0.9));
    const key = new T.SpotLight(0xffe2c0, 220, 30, 0.5, 0.6, 1.4); key.position.set(3, 6, 3); key.castShadow = true; key.shadow.mapSize.set(1024, 1024); scene.add(key);
    const rim = new T.SpotLight(0x7fb0ff, 160, 30, 0.6, 0.6, 1.4); rim.position.set(-4, 4, -3); scene.add(rim);
    const pm = new T.PMREMGenerator(renderer); const es = new T.Scene(); es.add(new T.HemisphereLight(0xffffff, 0x222222, 2));
    const box = new T.Mesh(new T.BoxGeometry(10, 10, 10), new T.MeshBasicMaterial({ side: T.BackSide, color: 0x303038 })); es.add(box);
    const strip = new T.Mesh(new T.BoxGeometry(6, 0.3, 0.3), new T.MeshBasicMaterial({ color: 0xffffff })); strip.position.set(0, 4.5, 0); es.add(strip);
    scene.environment = pm.fromScene(es, 0.04).texture; pm.dispose();
    let model = null, cur = '';
    const g = {
      scene, cam, visible: false,
      set(bikeId, look) {
        const key2 = bikeId + JSON.stringify(look || {});
        if (key2 === cur) return; cur = key2;
        if (model) scene.remove(model.root);
        model = new RR.models.RacerModel(bikeId === 'cop' ? RR.COP_BIKE : RR.bike(bikeId), look || RR.PLAYER_LOOKS[0], {});
        model.root.position.y = 0.08; model.rider.visible = !!look;
        model.blob.visible = false;
        model.pose({ mode: 'ride', tuck: 0.3 });
        scene.add(model.root);
      },
      update(t) {
        const W = innerWidth, Hh = innerHeight; cam.aspect = W / Hh; cam.updateProjectionMatrix();
        const wide = W / Hh > 1.2;
        cam.position.set(wide ? -1.2 : 0, 1.6, 5.4); cam.lookAt(wide ? -1.2 : 0, 0.65, 0);
        if (model) { model.root.rotation.y = t * 0.45; model.root.position.x = wide ? -2.1 : 0; disc.position.x = model.root.position.x; disc.rotation.y = t * 0.45; }
      },
    };
    return g;
  }

  addEventListener('load', boot);
})();
