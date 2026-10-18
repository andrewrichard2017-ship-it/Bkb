// Road Rumble sound. Everything is synthesised with Web Audio: no sample files to load.
// Every public function is a safe no-op until init() has created the AudioContext.
(function () {
  'use strict';
  const RR = window.RR || (window.RR = {});

  const IDLE = 1500, RED = 11500;
  const GEAR_TOP = [0.32, 0.48, 0.62, 0.75, 0.88, 1]; // share of top speed each gear reaches at redline
  const E1 = 41.2, E2 = 82.41, E3 = 164.81;

  let ctx = null, sfxBus = null, loopBus = null, musicBus = null, noiseBuf = null, hasPan = false;
  let engCurve, fuzzCurve, softCurve;
  let paused = false, muted = false, lastVol = -1, lastMus = -1, lastPaused = null, live = 0;
  const sims = [], packSims = [], engines = [], packs = [], scrapes = [], viewGain = [];
  let sirenV = null;

  const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
  const num = (v, d) => (typeof v === 'number' && isFinite(v)) ? v : d;
  const rnd = (a, b) => a + Math.random() * (b - a);
  const clock = () => (typeof performance !== 'undefined' ? performance.now() : Date.now()) / 1000;
  const glide = (param, v, tau) => param.setTargetAtTime(v, ctx.currentTime, tau || 0.04);
  const setPan = (n, x) => { if (n.pan) glide(n.pan, clamp(num(x, 0), -1, 1), 0.05); };

  // ---- node helpers: each pushes onto `ls` so a voice can be released in one go ----
  function G(ls, v) { const n = ctx.createGain(); n.gain.value = v; ls.push(n); return n; }
  function F(ls, type, f, q) {
    const n = ctx.createBiquadFilter(); n.type = type; n.frequency.value = f; n.Q.value = q == null ? 1 : q;
    ls.push(n); return n;
  }
  function O(ls, type, f) { const n = ctx.createOscillator(); n.type = type; n.frequency.value = f; ls.push(n); n.start(); return n; }
  function N(ls) {
    const n = ctx.createBufferSource(); n.buffer = noiseBuf; n.loop = true;
    ls.push(n); n.start(0, Math.random() * 1.9); return n;
  }
  function P(ls, pan) {
    if (!hasPan) return G(ls, 1); // old Safari: no panning
    const n = ctx.createStereoPanner(); n.pan.value = pan || 0; ls.push(n); return n;
  }
  function S(ls, curve, os) { const n = ctx.createWaveShaper(); n.curve = curve; n.oversample = os || 'none'; ls.push(n); return n; }
  function wire() { for (let i = 0; i < arguments.length - 1; i++) arguments[i].connect(arguments[i + 1]); }
  function release(ls) {
    for (const n of ls) {
      try { if (n.stop) n.stop(); } catch (e) { /* never started */ }
      try { n.disconnect(); } catch (e) { /* already gone */ }
    }
    ls.length = 0;
  }

  // Soft-clip curve; a little bias gives the fuzz its even (grungy) harmonics.
  function curve(k, bias) {
    const n = 2048, c = new Float32Array(n), off = Math.tanh(k * bias);
    const norm = Math.max(Math.abs(Math.tanh(k * (1 + bias)) - off), Math.abs(Math.tanh(k * (bias - 1)) - off));
    for (let i = 0; i < n; i++) c[i] = (Math.tanh(k * (i / (n - 1) * 2 - 1 + bias)) - off) / norm;
    return c;
  }
  // Gain that roughly evens out the loudness of noise through narrow vs wide filters.
  function nc(type, f, q) {
    const ny = ctx.sampleRate / 2;
    const bw = type === 'lowpass' ? f : type === 'highpass' ? ny - f : f / (q || 1);
    return Math.min(10, Math.sqrt(ny / Math.max(40, bw)));
  }

  // ---- one-shot building blocks (they clean themselves up when they end) ----
  function env(p, t, dur, vol, a, sus) {
    a = a || 0.003; sus = sus || 0;
    p.setValueAtTime(0.0001, t);
    p.linearRampToValueAtTime(vol, t + a);
    if (sus) p.setValueAtTime(vol, t + a + sus);
    p.exponentialRampToValueAtTime(0.0001, t + Math.max(dur, a + sus + 0.01));
  }
  // o: { to: end freq, gt: glide time, a: attack, sus: hold time, det: cents }
  function tone(d, t, type, f, dur, vol, o) {
    o = o || {};
    const s = ctx.createOscillator(), g = ctx.createGain();
    s.type = type; s.frequency.setValueAtTime(f, t);
    if (o.to) s.frequency.exponentialRampToValueAtTime(o.to, t + (o.gt || dur));
    if (o.det) s.detune.value = o.det;
    env(g.gain, t, dur, vol, o.a, o.sus);
    s.connect(g); g.connect(d);
    s.start(t); s.stop(t + dur + 0.03);
    s.onended = () => { s.disconnect(); g.disconnect(); };
    return s;
  }
  // Filtered noise burst. o: { to: end freq, gt, q, a, sus }
  function noise(d, t, dur, vol, type, f, o) {
    o = o || {};
    const s = ctx.createBufferSource(), fl = ctx.createBiquadFilter(), g = ctx.createGain(), q = o.q == null ? 1 : o.q;
    s.buffer = noiseBuf; s.loop = dur > 1.8;
    fl.type = type; fl.Q.value = q; fl.frequency.setValueAtTime(f, t);
    if (o.to) fl.frequency.exponentialRampToValueAtTime(o.to, t + (o.gt || dur));
    env(g.gain, t, dur, vol * nc(type, o.to ? Math.sqrt(f * o.to) : f, q), o.a || 0.002, o.sus);
    s.connect(fl); fl.connect(g); g.connect(d);
    s.start(t, Math.random() * Math.max(0, 1.9 - dur)); s.stop(t + dur + 0.03);
    s.onended = () => { s.disconnect(); fl.disconnect(); g.disconnect(); };
    return s;
  }

  // ---- context ----
  function build() {
    hasPan = typeof ctx.createStereoPanner === 'function';
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -16; comp.knee.value = 8; comp.ratio.value = 6;
    comp.attack.value = 0.003; comp.release.value = 0.2;
    const master = ctx.createGain(); master.gain.value = 0.8;
    const lim = ctx.createDynamicsCompressor(); // brick wall so nothing clips
    lim.threshold.value = -1; lim.knee.value = 0; lim.ratio.value = 20;
    lim.attack.value = 0.001; lim.release.value = 0.1;
    wire(comp, master, lim, ctx.destination);
    sfxBus = ctx.createGain(); loopBus = ctx.createGain(); musicBus = ctx.createGain();
    for (const b of [sfxBus, loopBus, musicBus]) { b.gain.value = 0; b.connect(comp); }

    const len = Math.floor(ctx.sampleRate * 2);
    noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    engCurve = curve(2.2, 0); fuzzCurve = curve(9, 0.12); softCurve = curve(1.4, 0);

    // A silent blip inside the gesture unlocks iOS.
    const src = ctx.createBufferSource(); src.buffer = ctx.createBuffer(1, 1, ctx.sampleRate);
    src.connect(ctx.destination); src.start(0);

    if (typeof document !== 'undefined' && document.addEventListener) {
      document.addEventListener('visibilitychange', () => {
        if (!ctx) return;
        try { const p = document.hidden ? ctx.suspend() : ctx.resume(); if (p && p.catch) p.catch(() => {}); } catch (e) { /* ignore */ }
      });
    }
    levels(true);
  }
  function resume() {
    if (ctx.state === 'running' || (typeof document !== 'undefined' && document.hidden)) return;
    try { const p = ctx.resume(); if (p && p.catch) p.catch(() => {}); } catch (e) { /* ignore */ }
  }
  function init() {
    if (ctx) { resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    try { ctx = new AC({ latencyHint: 'interactive' }); } catch (e) {
      try { ctx = new AC(); } catch (e2) { ctx = null; return; }
    }
    try { build(); } catch (e) { ctx = null; throw e; }
    resume();
    if (want) music(want);
  }

  // Settings are read live; this only touches the gains when something changed.
  function levels(force) {
    const st = RR.settings || {};
    const vol = muted ? 0 : clamp(num(st.volume, 0.8), 0, 1);
    const mus = muted || st.music === false ? 0 : clamp(num(st.musicVolume, 0.6), 0, 1);
    if (!force && vol === lastVol && mus === lastMus && paused === lastPaused) return;
    lastVol = vol; lastMus = mus; lastPaused = paused;
    glide(sfxBus.gain, vol, 0.03);
    glide(loopBus.gain, paused ? 0 : vol, paused ? 0.06 : 0.15);
    glide(musicBus.gain, mus * 0.55 * (paused ? 0.35 : 1), 0.12);
  }
  function musicOn() {
    const st = RR.settings || {};
    return st.music !== false && num(st.musicVolume, 0.6) > 0;
  }

  // ---- gearbox: runs even without audio so the HUD tacho always works ----
  function newSim() { return { rpm: IDLE, gear: 0, lock: 0, cut: 0, thr: 0, last: 0, lift: false }; }
  function gearbox(s, speed, top, thr, air, crashed) {
    const now = clock(), dt = s.last ? clamp(now - s.last, 0, 0.1) : 0.016;
    s.last = now;
    s.lock = Math.max(0, s.lock - dt); s.cut = Math.max(0, s.cut - dt);
    s.lift = s.thr > 0.6 && thr < 0.15 && s.rpm > 6500; // throttle snapped shut at high revs
    s.thr = thr;
    const wheel = g => speed / (top * GEAR_TOP[g]) * RED;
    let target, tau;
    if (crashed) {
      s.gear = 0; target = IDLE + rnd(-80, 80); tau = 0.35;
    } else {
      if (!air && s.lock <= 0) {
        if (s.gear < 5 && wheel(s.gear) > RED * 0.96) { s.gear++; s.lock = 0.3; s.cut = 0.12; }
        else if (s.gear > 0 && wheel(s.gear - 1) < RED * 0.7) { s.gear--; s.lock = 0.15; }
      }
      target = Math.max(IDLE, wheel(s.gear));
      if (s.gear === 0) target = Math.max(target, IDLE + thr * 4500); // clutch slipping off the line
      if (air) target = Math.max(target, IDLE + thr * (RED - IDLE)); // rear wheel spinning free
      if (target >= RED) target = RED - Math.random() * 400; // limiter bounce
      tau = target > s.rpm ? (air ? 0.12 : 0.06) : (s.cut > 0 ? 0.035 : air ? 0.25 : 0.08);
    }
    s.rpm += (target - s.rpm) * (1 - Math.exp(-dt / tau));
  }

  // ---- player engine: detuned saw/square at firing frequency + sub, distorted and filtered ----
  function makeEngine() {
    const ls = [], v = { ls, popAt: 0 };
    v.out = G(ls, 0); v.pan = P(ls, 0); wire(v.out, v.pan, loopBus);
    v.am = G(ls, 1); v.drive = G(ls, 0.5); v.lp = F(ls, 'lowpass', 400, 2); v.eng = G(ls, 0);
    wire(v.am, v.drive, S(ls, engCurve), v.lp, v.eng, v.out);
    v.o1 = O(ls, 'sawtooth', 50); v.o2 = O(ls, 'square', 50); v.sub = O(ls, 'triangle', 25);
    v.o2.detune.value = 9;
    wire(v.o1, G(ls, 0.5), v.am); wire(v.o2, G(ls, 0.3), v.am); wire(v.sub, G(ls, 0.35), v.am);
    // Cam-rate wobble: lumpy at idle, smoothing out as it revs.
    v.lfo = O(ls, 'sine', 12); v.lfoAmt = G(ls, 0.4); wire(v.lfo, v.lfoAmt, v.am.gain);
    const src = N(ls);
    v.intake = F(ls, 'bandpass', 500, 1.2); v.intakeG = G(ls, 0); wire(src, v.intake, v.intakeG, v.lp);
    v.nitroG = G(ls, 0); wire(src, F(ls, 'highpass', 2500, 0.7), v.nitroG, v.out);
    v.offG = G(ls, 0); wire(src, F(ls, 'lowpass', 150, 3), v.offG, v.out);
    v.wind = F(ls, 'bandpass', 600, 0.6); v.windG = G(ls, 0); wire(src, v.wind, v.windG, v.out);
    return v;
  }
  function engine(i, p) {
    i |= 0; if (i < 0 || i > 3) return;
    const s = sims[i] || (sims[i] = newSim());
    if (!p) { if (ctx && engines[i]) glide(engines[i].out.gain, 0, 0.1); return; }
    const speed = Math.abs(num(p.speed, 0)), top = Math.max(5, num(p.top, 80));
    const crashed = !!p.crashed, air = !!p.airborne, nitro = !!p.nitro && !crashed;
    const thr = crashed ? 0 : clamp(num(p.throttle, 0), 0, 1);
    gearbox(s, speed, top, thr, air, crashed);
    if (!ctx) return;
    levels();
    const v = engines[i] || (engines[i] = makeEngine());
    const t = ctx.currentTime, n = clamp((s.rpm - IDLE) / (RED - IDLE), 0, 1);
    const th = s.cut > 0 ? 0.1 : thr;
    const f = s.rpm / 30 * (nitro ? 1.05 : 1) * rnd(0.997, 1.003); // firing freq, with a little roughness
    glide(v.o1.frequency, f, 0.02); glide(v.o2.frequency, f, 0.02); glide(v.sub.frequency, f / 2, 0.02);
    glide(v.lfo.frequency, f / 4 * rnd(0.97, 1.03), 0.03);
    glide(v.lfoAmt.gain, 0.42 - 0.32 * n, 0.05);
    glide(v.drive.gain, 0.5 + th * 2.5 + n * 0.8, 0.04);
    glide(v.lp.frequency, 260 + s.rpm * 0.09 + th * (700 + n * 2400) + (nitro ? 1200 : 0), 0.04);
    glide(v.eng.gain, crashed ? 0.07 : 0.15 + th * 0.09 + n * 0.05, crashed ? 0.4 : 0.05);
    const fi = 300 + n * 1800;
    glide(v.intake.frequency, fi, 0.05);
    glide(v.intakeG.gain, (0.01 + th * 0.035) * (0.4 + n) * nc('bandpass', fi, 1.2), 0.05);
    glide(v.nitroG.gain, nitro ? 0.12 : 0, 0.08);
    glide(v.offG.gain, p.offroad && !air ? 0.22 * nc('lowpass', 150) * Math.min(1, speed / 12) * rnd(0.5, 1.4) : 0, 0.03);
    const fw = 450 + speed * 14, w = Math.min(1, speed / 85);
    glide(v.wind.frequency, fw, 0.1);
    glide(v.windG.gain, w * w * 0.2 * nc('bandpass', fw, 0.6), 0.1);
    const g = clamp(num(p.gain, 1), 0, 1);
    viewGain[i] = g;
    glide(v.out.gain, g, 0.05);
    setPan(v.pan, p.pan);
    if (s.lift && !crashed && t > v.popAt) { // overrun pops and crackles
      v.popAt = t + 0.8;
      for (let k = 0; k < 3; k++) noise(v.out, t + rnd(0.04, 0.45), 0.03, rnd(0.1, 0.2), 'bandpass', rnd(500, 900), { q: 2 });
    }
  }
  function engineInfo(i) {
    const s = sims[i | 0];
    return { rpm: s ? Math.round(s.rpm) : IDLE, gear: s ? s.gear + 1 : 1 };
  }

  // ---- nearest rival: thinner engine, Doppler-shifted, fading with distance ----
  function makePack() {
    const ls = [], v = { ls };
    v.out = G(ls, 0); v.pan = P(ls, 0); v.lp = F(ls, 'lowpass', 1200, 1);
    const mix = G(ls, 0.35);
    v.o1 = O(ls, 'sawtooth', 100); v.o2 = O(ls, 'square', 100); v.o2.detune.value = -12;
    v.o1.connect(mix); v.o2.connect(mix);
    wire(mix, G(ls, 1.6), S(ls, engCurve), F(ls, 'highpass', 160, 0.7), v.lp, v.out, v.pan, loopBus);
    return v;
  }
  function pack(i, p) {
    if (!ctx) return;
    i |= 0; if (i < 0 || i > 3) return;
    const dist = p ? Math.max(0, num(p.dist, 999)) : 999;
    if (dist > 80) { if (packs[i]) glide(packs[i].out.gain, 0, 0.12); return; }
    levels();
    const v = packs[i] || (packs[i] = makePack());
    const s = packSims[i] || (packSims[i] = newSim());
    const speed = Math.abs(num(p.speed, 0));
    gearbox(s, speed, Math.max(78, speed * 1.08), 0.9, false, false);
    const dop = 343 / (343 - clamp(num(p.closing, 0), -60, 60) * 0.6), near = 1 - dist / 80;
    const f = s.rpm / 30 * dop;
    glide(v.o1.frequency, f, 0.05); glide(v.o2.frequency, f, 0.05);
    glide(v.lp.frequency, 700 + near * 2200, 0.08);
    glide(v.out.gain, near * near * 0.3 * (viewGain[i] == null ? 1 : viewGain[i]), 0.08);
    setPan(v.pan, p.pan);
  }

  // ---- metal sliding on asphalt ----
  function makeScrape() {
    const ls = [], v = { ls };
    v.out = G(ls, 0); v.out.connect(loopBus);
    const src = N(ls);
    v.bp = F(ls, 'bandpass', 2800, 0.9);
    wire(src, v.bp, G(ls, 0.35 * nc('bandpass', 2800, 0.9)), v.out);
    wire(src, F(ls, 'bandpass', 1250, 12), G(ls, 0.25 * nc('bandpass', 1250, 12)), v.out); // metallic ring
    wire(src, F(ls, 'lowpass', 400, 1), G(ls, 0.12 * nc('lowpass', 400)), v.out); // grind
    return v;
  }
  function scrape(i, x) {
    if (!ctx) return;
    i |= 0; if (i < 0 || i > 3) return;
    x = clamp(num(x, 0), 0, 1);
    if (x <= 0.001) { if (scrapes[i]) glide(scrapes[i].out.gain, 0, 0.06); return; }
    levels();
    const v = scrapes[i] || (scrapes[i] = makeScrape());
    glide(v.bp.frequency, rnd(2200, 4000), 0.02);
    glide(v.out.gain, x * (viewGain[i] == null ? 1 : viewGain[i]) * rnd(0.5, 1.4), 0.012); // jitter = sparks
  }

  // ---- police siren: classic wail ----
  function makeSiren() {
    const ls = [], v = { ls };
    v.out = G(ls, 0); v.pan = P(ls, 0);
    const o = O(ls, 'sawtooth', 950), o2 = O(ls, 'square', 950), lfo = O(ls, 'triangle', 0.4), amt = G(ls, 400);
    o2.detune.value = 6;
    wire(lfo, amt, o.frequency); amt.connect(o2.frequency);
    const mix = G(ls, 0.5); o.connect(mix); wire(o2, G(ls, 0.3), mix);
    wire(mix, F(ls, 'lowpass', 2600, 1), v.out, v.pan, loopBus);
    return v;
  }
  function siren(x, pan) {
    if (!ctx) return;
    x = clamp(num(x, 0), 0, 1);
    if (x <= 0.001) { if (sirenV) glide(sirenV.out.gain, 0, 0.1); return; }
    levels();
    const v = sirenV || (sirenV = makeSiren());
    glide(v.out.gain, x * 0.22, 0.08);
    setPan(v.pan, pan);
  }

  function setPaused(b) { paused = !!b; if (ctx) levels(); }
  // silent while an ad plays (ads.js)
  function setMuted(b) { muted = !!b; if (ctx) levels(true); }
  function stopEngines() {
    sims.length = 0; packSims.length = 0;
    if (!ctx) return;
    const all = engines.concat(packs, scrapes, sirenV ? [sirenV] : []).filter(Boolean);
    engines.length = packs.length = scrapes.length = 0; sirenV = null;
    for (const v of all) glide(v.out.gain, 0, 0.04);
    setTimeout(() => all.forEach(v => release(v.ls)), 300);
  }

  // ---- one-shots: fn(dest, time, rate, nodeList) returns its length in seconds ----
  const SFX = {
    shotgun(d, t, r) {
      noise(d, t, 0.03, 1.0, 'highpass', 3000 * r); // crack
      noise(d, t, 0.45, 1.1, 'lowpass', 1400 * r, { to: 160 });
      tone(d, t, 'sine', 95 * r, 0.35, 1.0, { to: 38 * r, gt: 0.12 });
      noise(d, t + 0.06, 0.6, 0.25, 'bandpass', 700 * r, { q: 0.7 }); // echo tail
      return 0.7;
    },
    gun(d, t, r) {
      noise(d, t, 0.025, 0.8, 'highpass', 2400 * r);
      noise(d, t, 0.08, 0.6, 'bandpass', 900 * r, { q: 1.1 });
      tone(d, t, 'square', 140 * r, 0.05, 0.35, { to: 70 * r });
      return 0.1;
    },
    punch(d, t, r) {
      tone(d, t, 'sine', 150 * r, 0.16, 0.9, { to: 55 * r, gt: 0.08 });
      tone(d, t, 'triangle', 260 * r, 0.07, 0.3, { to: 110 * r });
      noise(d, t, 0.08, 0.6, 'bandpass', 1900 * r, { to: 700, q: 0.9 });
      noise(d, t, 0.12, 0.45, 'lowpass', 500 * r);
      return 0.2;
    },
    kick(d, t, r) {
      tone(d, t, 'sine', 115 * r, 0.24, 1, { to: 40 * r, gt: 0.12 });
      tone(d, t, 'triangle', 190 * r, 0.1, 0.35, { to: 75 * r });
      noise(d, t, 0.16, 0.55, 'lowpass', 650 * r, { to: 200 });
      noise(d, t, 0.06, 0.4, 'bandpass', 1300 * r, { q: 1.2 });
      return 0.28;
    },
    club(d, t, r) {
      noise(d, t, 0.05, 0.75, 'bandpass', 2600 * r, { q: 2.2 }); // crack
      tone(d, t, 'sine', 540 * r, 0.1, 0.3, { to: 480 * r }); // hollow wood knock
      tone(d, t, 'sine', 1180 * r, 0.05, 0.15);
      tone(d, t, 'sine', 130 * r, 0.14, 0.7, { to: 50 * r, gt: 0.08 });
      noise(d, t, 0.1, 0.3, 'lowpass', 600 * r);
      return 0.18;
    },
    metal(d, t, r) {
      [1, 2.76, 5.4, 8.93].forEach((m, k) => // bar partials ring on
        tone(d, t, k ? 'sine' : 'triangle', 420 * r * m * rnd(0.99, 1.01), 1.1 / (1 + k * 0.6), 0.28 / (1 + k * 0.5)));
      noise(d, t, 0.04, 0.6, 'highpass', 2200);
      tone(d, t, 'sine', 160 * r, 0.12, 0.7, { to: 60 * r, gt: 0.07 });
      return 1.15;
    },
    chain(d, t, r) {
      noise(d, t, 0.07, 0.5, 'bandpass', 1500 * r);
      tone(d, t, 'sine', 140 * r, 0.11, 0.55, { to: 60 * r });
      for (let k = 0; k < 7; k++) { // the links jangling
        const tk = t + 0.01 + k * 0.017 + rnd(0, 0.01);
        noise(d, tk, 0.025, rnd(0.25, 0.4), 'bandpass', rnd(3500, 7500) * r, { q: 5 });
        tone(d, tk, 'sine', rnd(2800, 5200) * r, 0.05, 0.05);
      }
      return 0.2;
    },
    whiff(d, t, r) { noise(d, t, 0.2, 0.45, 'bandpass', 450 * r, { to: 1900 * r, q: 1.6, a: 0.07 }); return 0.22; },
    crash(d, t, r) {
      noise(d, t, 0.7, 0.8, 'lowpass', 3500 * r, { to: 350 });
      tone(d, t, 'sine', 95 * r, 0.35, 1, { to: 35, gt: 0.2 });
      for (let k = 0; k < 6; k++) noise(d, t + rnd(0, 0.18), rnd(0.04, 0.1), rnd(0.35, 0.6), 'bandpass', rnd(1200, 4200), { q: 3 });
      tone(d, t, 'triangle', 690 * r, 0.45, 0.07); tone(d, t, 'triangle', 1130 * r, 0.35, 0.05);
      [0.38, 0.62].forEach((dt, k) => { // bounces
        tone(d, t + dt, 'sine', 80 * r, 0.16, 0.6 / (k + 1), { to: 40 });
        noise(d, t + dt, 0.18, 0.35 / (k + 1), 'bandpass', 1800, { q: 1.5 });
      });
      return 0.9;
    },
    thud(d, t, r) {
      tone(d, t, 'sine', 95 * r, 0.2, 0.9, { to: 40, gt: 0.12 });
      noise(d, t, 0.12, 0.45, 'lowpass', 450 * r);
      noise(d, t, 0.1, 0.15, 'bandpass', 2600); // gravel
      return 0.22;
    },
    land(d, t, r) {
      tone(d, t, 'sine', 75 * r, 0.28, 0.9, { to: 36, gt: 0.15 });
      noise(d, t, 0.16, 0.4, 'lowpass', 320 * r);
      noise(d, t, 0.03, 0.2, 'highpass', 3200); // clack
      tone(d, t + 0.04, 'triangle', 190 * r, 0.14, 0.1, { to: 120 * r }); // spring
      return 0.3;
    },
    horn(d, t, r, ls) {
      const lp = F(ls, 'lowpass', 2200, 1); lp.connect(d);
      tone(lp, t, 'square', 400 * r, 0.5, 0.17, { a: 0.01, sus: 0.42, det: -4 });
      tone(lp, t, 'square', 500 * r, 0.5, 0.14, { a: 0.01, sus: 0.42, det: 5 });
      return 0.55;
    },
    truckhorn(d, t, r, ls) {
      const lp = F(ls, 'lowpass', 1400, 2); lp.connect(d);
      [155, 196, 233].forEach(f => tone(lp, t, 'sawtooth', f * 0.96 * r, 1.15, 0.12, { to: f * r, gt: 0.12, a: 0.04, sus: 0.95 }));
      return 1.2;
    },
    beep(d, t) { tone(d, t, 'square', 880, 0.2, 0.1, { sus: 0.12 }); tone(d, t, 'sine', 880, 0.2, 0.25, { sus: 0.12 }); return 0.25; },
    go(d, t) { tone(d, t, 'square', 1320, 0.6, 0.1, { sus: 0.4 }); tone(d, t, 'sine', 1320, 0.6, 0.25, { sus: 0.4 }); return 0.65; },
    finish(d, t, r, ls) {
      const lp = F(ls, 'lowpass', 3200, 1); lp.connect(d);
      [659, 831, 988].forEach((f, k) => tone(lp, t + k * 0.09, 'sawtooth', f, 0.14, 0.16, { sus: 0.06 }));
      [659, 831, 988, 1319].forEach(f => {
        tone(lp, t + 0.27, 'sawtooth', f, 0.9, 0.1, { sus: 0.35, det: rnd(-8, 8) });
        tone(lp, t + 0.27, 'square', f / 2, 0.9, 0.04, { sus: 0.35 });
      });
      tone(d, t + 0.27, 'sine', 120, 0.3, 0.7, { to: 45, gt: 0.1 });
      noise(d, t + 0.27, 1.1, 0.25, 'highpass', 5500, { q: 0.4 });
      return 1.3;
    },
    cash(d, t) {
      noise(d, t, 0.04, 0.5, 'bandpass', 1600, { q: 2 }); // "ka": the drawer
      tone(d, t, 'square', 260, 0.04, 0.1, { to: 180 });
      [2093, 2637, 3136, 4229].forEach((f, k) => tone(d, t + 0.08, 'sine', f, 0.7 - k * 0.1, 0.16 - k * 0.025)); // "ching"
      noise(d, t + 0.08, 0.15, 0.15, 'highpass', 6000);
      return 0.8;
    },
    steal(d, t, r) {
      noise(d, t, 0.22, 0.45, 'bandpass', 400 * r, { to: 2600 * r, q: 1.4, a: 0.08 });
      noise(d, t + 0.17, 0.05, 0.5, 'bandpass', 1500 * r, { q: 1.2 });
      tone(d, t + 0.17, 'sine', 210 * r, 0.09, 0.5, { to: 90 * r });
      tone(d, t + 0.2, 'triangle', 700 * r, 0.14, 0.12, { to: 1400 * r });
      return 0.4;
    },
    busted(d, t, r, ls) {
      const lp = F(ls, 'lowpass', 2500, 1), low = F(ls, 'lowpass', 600, 2);
      lp.connect(d); low.connect(d);
      const o = tone(lp, t, 'sawtooth', 700, 0.32, 0.18, { a: 0.01, sus: 0.26 });
      o.frequency.linearRampToValueAtTime(1400, t + 0.15); o.frequency.linearRampToValueAtTime(800, t + 0.3);
      tone(low, t + 0.34, 'square', 110, 0.55, 0.35, { to: 52, a: 0.02, sus: 0.15 }); // bwomp
      tone(low, t + 0.34, 'square', 111.5, 0.55, 0.25, { to: 53, a: 0.02, sus: 0.15 });
      return 0.95;
    },
    wrecked(d, t, r, ls) {
      for (let k = 0; k < 9; k++) noise(d, t + k * 0.08 + rnd(0, 0.04), rnd(0.08, 0.16), rnd(0.3, 0.5), 'bandpass', rnd(500, 2600), { q: 4 });
      const lp = F(ls, 'lowpass', 700, 2); lp.connect(d);
      tone(lp, t, 'sawtooth', 95 * r, 0.9, 0.3, { to: 32, sus: 0.2 });
      tone(d, t, 'sine', 70, 0.4, 0.7, { to: 35 });
      [1, 2.76].forEach(m => tone(d, t + 0.1, 'triangle', 330 * m * r, 0.6, 0.06));
      return 1;
    },
    nitro(d, t, r) {
      noise(d, t, 0.55, 0.55, 'bandpass', 300 * r, { to: 3200 * r, q: 0.8, a: 0.06 });
      noise(d, t, 0.04, 0.35, 'highpass', 4000); // ignition pop
      tone(d, t, 'sine', 85, 0.22, 0.6, { to: 48 });
      return 0.6;
    },
    select(d, t) { tone(d, t, 'square', 1250, 0.035, 0.08); tone(d, t, 'sine', 2500, 0.025, 0.08); return 0.06; },
    confirm(d, t) {
      tone(d, t, 'square', 660, 0.1, 0.1, { sus: 0.04 });
      tone(d, t + 0.07, 'square', 990, 0.16, 0.1, { sus: 0.06 }); tone(d, t + 0.07, 'sine', 1980, 0.12, 0.06);
      return 0.25;
    },
    back(d, t) { tone(d, t, 'square', 560, 0.08, 0.09); tone(d, t + 0.06, 'square', 380, 0.12, 0.09); return 0.2; },
    pass(d, t, r, ls) {
      noise(d, t, 0.5, 0.5, 'bandpass', 1500 * r, { to: 450 * r, q: 1.1, a: 0.22 });
      const lp = F(ls, 'lowpass', 800, 1); lp.connect(d);
      tone(lp, t, 'sawtooth', 170 * r, 0.5, 0.12, { to: 105 * r, a: 0.22 });
      return 0.55;
    },
  };
  const STEADY = { select: 1, confirm: 1, back: 1, beep: 1, go: 1, finish: 1, cash: 1 }; // no random pitch
  function sfx(name, o) {
    if (!ctx || !SFX[name] || live > 28) return;
    levels();
    if (lastVol <= 0.001) return;
    o = o || {};
    const vol = Math.max(0, num(o.vol, 1));
    if (vol <= 0.001) return;
    const rate = clamp(num(o.rate, 1), 0.25, 4) * (STEADY[name] ? 1 : rnd(0.94, 1.06));
    const ls = [], out = G(ls, vol), pn = P(ls, clamp(num(o.pan, 0), -1, 1));
    wire(out, pn, sfxBus);
    const dur = SFX[name](out, ctx.currentTime, rate, ls) || 1;
    live++;
    setTimeout(() => { live--; release(ls); }, (dur + 0.4) * 1000);
  }

  // ---- music: a lookahead timer schedules 16th-note steps just ahead of the audio clock ----
  const KEY = { e: 0, f: 1, g: 3, a: 5, b: 7, c: 8, d: 10 };
  // One bar per string: letter = power chord (lower case = palm-muted chug), '-' = let it ring, '.' = rest.
  function riff(str) {
    const out = [];
    for (let i = 0; i < 16; i++) {
      const ch = str[i], k = ch.toLowerCase();
      if (!(k in KEY)) { out.push(null); continue; }
      let len = 1;
      while (str[i + len] === '-') len++;
      out.push({ s: KEY[k], len, mute: ch === k });
    }
    return out;
  }
  const RACE = [
    'e.eeG-e.eeA-e.D-', 'e.eeG-e.eeA-G-A-', 'e.eeG-e.eeA-e.D-', 'e.eeG-e.eeB---B-',
    'C-.cC-.cD-.dD-.d', 'E-.eE-.eG-.gA-.a', 'C-.cC-.cD-.dD-.d', 'E-.eE-.eB---B-B-',
  ].map(riff);
  const RACE_KICK = [1, 0, 0, 0, 0, 0, 0, 1, 1, 0, 1, 0, 0, 0, 0, 0];
  const MENU = [[0, 3], [8, 4], [3, 4], [10, 4], [0, 3], [8, 4], [5, 3], [7, 4]]; // Em C G D Em C Am B as [root, third]
  const ARP = [[0, 7, 12, -1, 12, 7, -1, 7], [0, 12, 7, -1, 19, -1, 12, 7]]; // -1 = the third, an octave up

  let song = null, want = null, timer = 0;
  function newSong(mode, fade) {
    const race = mode === 'race', ls = [], t = ctx.currentTime;
    const s = { mode, ls, n: 0, next: t + 0.06, dt: 60 / (race ? 140 : 100) / 4, root: 0 };
    s.bus = G(ls, fade ? 0.0001 : 1); s.bus.connect(musicBus);
    if (fade) s.bus.gain.setTargetAtTime(1, t, 0.35);
    s.drums = G(ls, 1); s.drums.connect(s.bus);
    s.gtr = G(ls, race ? 0.9 : 0.8);
    s.glp = F(ls, 'lowpass', race ? 2600 : 1800, 0.8);
    wire(s.gtr, S(ls, race ? fuzzCurve : softCurve, race ? '2x' : 'none'), F(ls, 'highpass', 90, 0.7), s.glp, G(ls, race ? 0.22 : 0.3), s.bus);
    s.bass = F(ls, 'lowpass', race ? 480 : 380, 2); s.bass.connect(s.bus);
    return s;
  }
  function dropSong(s) {
    glide(s.bus.gain, 0, 0.3);
    setTimeout(() => release(s.ls), 2500);
  }

  function kick(s, t, v) { tone(s.drums, t, 'sine', 160, 0.3, v * 0.9, { to: 42, gt: 0.08 }); noise(s.drums, t, 0.015, v * 0.12, 'highpass', 2500); }
  function snare(s, t, v) { noise(s.drums, t, 0.17, v * 0.35, 'highpass', 1500, { q: 0.5 }); tone(s.drums, t, 'triangle', 230, 0.08, v * 0.3, { to: 165 }); }
  function hat(s, t, v, open) { noise(s.drums, t, open ? 0.25 : 0.045, v * 0.1, 'highpass', 7500, { q: 0.4 }); }
  function cymbal(s, t, v) { noise(s.drums, t, 1.6, v * 0.12, 'highpass', 4800, { q: 0.3 }); }
  function chord(s, t, semi, len, mute) {
    const f = E2 * Math.pow(2, semi / 12), dur = mute ? s.dt * 0.9 : len * s.dt * 0.95, sus = dur * 0.6;
    tone(s.gtr, t, 'sawtooth', f, dur, 0.45, { sus, det: -7 });
    tone(s.gtr, t, 'sawtooth', f * 1.4983, dur, 0.35, { sus, det: 6 });
    if (!mute) tone(s.gtr, t, 'sawtooth', f * 2, dur, 0.18, { sus });
    s.glp.frequency.setTargetAtTime(mute ? 850 : 2600, t, 0.008);
  }
  function bass(s, t, semi, steps) {
    const f = E1 * Math.pow(2, semi / 12), dur = steps * s.dt * 0.9;
    tone(s.bass, t, 'sawtooth', f, dur, 0.5, { sus: dur * 0.5, a: 0.005 });
    tone(s.bass, t, 'triangle', f * 2, dur, 0.2, { sus: dur * 0.5, a: 0.005 }); // so phone speakers hear it
  }
  function pluck(s, t, semi) {
    const f = E3 * Math.pow(2, semi / 12);
    tone(s.gtr, t, 'triangle', f, 0.9, 0.4);
    tone(s.gtr, t, 'sawtooth', f, 0.35, 0.12, { det: 4 });
  }

  function raceStep(s, n, t) {
    const bar = n >> 4, i = n & 15, b = bar >= 4, fill = (bar & 3) === 3 && i >= 12;
    if (i === 0 && (bar === 0 || bar === 4)) cymbal(s, t, 1);
    if (fill) { // snare roll into the next section
      snare(s, t, 0.5 + (i - 12) * 0.17);
      if (i === 12 || i === 14) kick(s, t, 0.8);
    } else {
      if (RACE_KICK[i] || (b && i === 14)) kick(s, t, 1);
      if (i === 4 || i === 12) snare(s, t, 1);
      if (!(i & 1)) hat(s, t, b ? (i & 2 ? 1 : 0.5) : (i & 3 ? 0.6 : 1), b && (i & 2) > 0);
    }
    const ev = RACE[bar][i];
    if (ev) { s.root = ev.s; chord(s, t, ev.s, ev.len, ev.mute); }
    if (!(i & 1)) bass(s, t, s.root, 2);
  }
  function menuStep(s, n, t) {
    const bar = n >> 4, i = n & 15, ch = MENU[bar], fill = (bar & 3) === 3 && i >= 12;
    if (i === 0 && bar === 0) cymbal(s, t, 0.5);
    if (i === 0 || i === 10) kick(s, t, 0.7); // half-time
    if (i === 8) snare(s, t, 0.6);
    if (fill && i > 12) snare(s, t, 0.2 + (i - 13) * 0.12);
    if (!(i & 1) || (fill && i > 12)) hat(s, t, i & 2 ? 0.25 : 0.4, false);
    if (!(i & 1)) {
      const k = ARP[bar >= 4 ? 1 : 0][i >> 1];
      pluck(s, t, ch[0] + (k < 0 ? 12 + ch[1] : k));
    }
    if (i === 0 || i === 10) bass(s, t, ch[0], i === 0 ? 8 : 6);
  }
  function tick() {
    if (!ctx || !song) return;
    levels();
    const s = song, t = ctx.currentTime;
    if (!musicOn() || s.next < t - 0.25) s.next = t + 0.05; // off, or fell behind (tab was hidden): skip ahead
    if (!musicOn()) return;
    while (s.next < t + 0.12) {
      (s.mode === 'race' ? raceStep : menuStep)(s, s.n, s.next);
      s.next += s.dt; s.n = (s.n + 1) & 127; // 8 bars of 16 steps
    }
  }
  function music(mode) {
    mode = mode === 'race' || mode === 'menu' ? mode : null;
    want = mode; // remembered, so music asked for before init() starts once it can
    if (!ctx) return;
    const cur = song ? song.mode : null;
    if (cur === mode) return;
    if (song) dropSong(song);
    song = mode ? newSong(mode, !!cur) : null;
    if (song && !timer) timer = setInterval(safe('music', tick), 25);
    if (!song && timer) { clearInterval(timer); timer = 0; }
  }

  // ---- public API: wrapped so a sound bug can never take the game down ----
  const warned = {};
  function safe(name, fn) {
    return function () {
      try { return fn.apply(null, arguments); } catch (e) {
        if (!warned[name] && typeof console !== 'undefined') { warned[name] = 1; console.warn('RR.audio.' + name, e); }
      }
    };
  }
  const api = {
    init: safe('init', init),
    applySettings: safe('applySettings', () => { if (ctx) levels(true); }),
    setPaused: safe('setPaused', setPaused),
    setMuted: safe('setMuted', setMuted),
    engine: safe('engine', engine),
    engineInfo,
    stopEngines: safe('stopEngines', stopEngines),
    pack: safe('pack', pack),
    scrape: safe('scrape', scrape),
    siren: safe('siren', siren),
    sfx: safe('sfx', sfx),
    music: safe('music', music),
  };
  Object.defineProperty(api, 'ready', { enumerable: true, get: () => !!ctx && ctx.state === 'running' });
  RR.audio = api;
})();
