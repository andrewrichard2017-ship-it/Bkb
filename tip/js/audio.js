// Tractor Tippin' sound. Everything is synthesised with Web Audio (no sample files): horns, engines, the
// tractors' startled moo, Thrasher's roar, and four little tunes (farm and spooky, each calm and chase).
// Every public function is a safe no-op until init() has created the AudioContext (it needs a tap/key/button).
(() => {
  'use strict';
  const TT = window.TT;
  let ctx = null, master = null, sfxBus = null, loopBus = null, musicBus = null, noiseBuf = null, distCurve = null;
  let paused = false;
  const engines = [];
  let thr = null;

  const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
  const mtof = m => 440 * Math.pow(2, (m - 69) / 12);
  const glide = (p, v, tau = 0.05) => { if (ctx) p.setTargetAtTime(v, ctx.currentTime, tau); };

  function env(p, t, dur, vol, a = 0.004, sus = 0) {
    p.setValueAtTime(0.0001, t);
    p.linearRampToValueAtTime(vol, t + a);
    if (sus) p.setValueAtTime(vol, t + a + sus);
    p.exponentialRampToValueAtTime(0.0001, t + Math.max(dur, a + sus + 0.01));
  }
  // one oscillator note. o: { to, gt, a, sus, det, vib: [rate, cents], filter: [type, f, q, toF] }
  function tone(dest, t, type, f, dur, vol, o = {}) {
    const s = ctx.createOscillator(), g = ctx.createGain();
    s.type = type; s.frequency.setValueAtTime(f, t);
    if (o.to) s.frequency.exponentialRampToValueAtTime(o.to, t + (o.gt || dur));
    if (o.det) s.detune.value = o.det;
    let out = s, extra = [];
    if (o.vib) { const l = ctx.createOscillator(), lg = ctx.createGain(); l.frequency.value = o.vib[0]; lg.gain.value = o.vib[1]; l.connect(lg); lg.connect(s.detune); l.start(t); l.stop(t + dur + 0.05); extra.push(l, lg); }
    if (o.filter) {
      const fl = ctx.createBiquadFilter(); fl.type = o.filter[0]; fl.frequency.setValueAtTime(o.filter[1], t); fl.Q.value = o.filter[2] || 1;
      if (o.filter[3]) fl.frequency.exponentialRampToValueAtTime(o.filter[3], t + (o.filter[4] || dur));
      out.connect(fl); out = fl; extra.push(fl);
    }
    env(g.gain, t, dur, vol, o.a, o.sus);
    out.connect(g); g.connect(dest);
    s.start(t); s.stop(t + dur + 0.05);
    s.onended = () => { s.disconnect(); g.disconnect(); for (const n of extra) n.disconnect(); };
    return s;
  }
  function noise(dest, t, dur, vol, type, f, o = {}) {
    const s = ctx.createBufferSource(), fl = ctx.createBiquadFilter(), g = ctx.createGain();
    s.buffer = noiseBuf; s.loop = true;
    fl.type = type; fl.Q.value = o.q || 1; fl.frequency.setValueAtTime(f, t);
    if (o.to) fl.frequency.exponentialRampToValueAtTime(o.to, t + (o.gt || dur));
    env(g.gain, t, dur, vol, o.a || 0.003, o.sus);
    s.connect(fl); fl.connect(g); g.connect(dest);
    s.start(t, Math.random() * 1.5); s.stop(t + dur + 0.05);
    s.onended = () => { s.disconnect(); fl.disconnect(); g.disconnect(); };
  }
  function shaped(dest, amount) {
    const ws = ctx.createWaveShaper(); ws.curve = distCurve; ws.oversample = '2x';
    const g = ctx.createGain(); g.gain.value = amount; g.connect(ws); ws.connect(dest); return g;
  }

  // ---- context ----
  function init() {
    if (ctx) { if (ctx.state !== 'running' && !document.hidden) ctx.resume().catch(() => {}); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    try { ctx = new AC({ latencyHint: 'interactive' }); } catch (e) { try { ctx = new AC(); } catch (e2) { return; } }
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14; comp.knee.value = 8; comp.ratio.value = 5; comp.attack.value = 0.003; comp.release.value = 0.2;
    master = ctx.createGain(); master.gain.value = 0.85;
    comp.connect(master); master.connect(ctx.destination);
    sfxBus = ctx.createGain(); loopBus = ctx.createGain(); musicBus = ctx.createGain();
    for (const b of [sfxBus, loopBus, musicBus]) b.connect(comp);
    const len = ctx.sampleRate * 2;
    noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    distCurve = new Float32Array(1024);
    for (let i = 0; i < 1024; i++) { const x = i / 511.5 - 1; distCurve[i] = Math.tanh(x * 3.5); }
    const b = ctx.createBufferSource(); b.buffer = ctx.createBuffer(1, 1, ctx.sampleRate); b.connect(ctx.destination); b.start(0);
    document.addEventListener('visibilitychange', () => { if (!ctx) return; (document.hidden ? ctx.suspend() : ctx.resume()).catch(() => {}); });
    levels();
    if (pendingSong) { const s = pendingSong; pendingSong = null; music(s); }
  }
  function levels() {
    if (!ctx) return;
    const S = TT.settings;
    glide(sfxBus.gain, S.volume, 0.05);
    glide(loopBus.gain, paused ? 0 : S.volume * 0.9, 0.08);
    glide(musicBus.gain, S.music ? S.musicVolume * 0.55 * (paused ? 0.5 : 1) : 0, 0.15);
  }

  // ---- one-shots ----
  const SFX = {
    hornRusty(t, d, v) { // "ah-OO-gah"
      const g = shaped(d, v * 0.5);
      for (const det of [0, 9]) tone(g, t, 'sawtooth', 200, 0.85, 0.5, { to: 330, gt: 0.22, sus: 0.42, a: 0.02, det, vib: [7, 14], filter: ['bandpass', 900, 1.8, 1400, 0.3] });
      tone(g, t + 0.55, 'sawtooth', 330, 0.35, 0.5, { to: 250, gt: 0.3, filter: ['lowpass', 1600, 1, 600] });
    },
    hornDash(t, d, v) { // beep beep
      for (const k of [0, 0.19]) for (const f of [523, 659]) tone(d, t + k, 'square', f, 0.14, v * 0.16, { sus: 0.08, filter: ['lowpass', 2600, 1] });
    },
    hornToot(t, d, v) { for (const k of [0, 0.15]) tone(d, t + k, 'square', 880, 0.1, v * 0.13, { sus: 0.05, filter: ['lowpass', 3000, 1] }); },
    hornTune(t, d, v) { // a cheeky five-note tune
      [[67, 0], [67, 0.13], [67, 0.26], [72, 0.4], [76, 0.62]].forEach(([m, k]) => tone(d, t + k, 'square', mtof(m), k > 0.5 ? 0.3 : 0.11, v * 0.13, { sus: 0.04, filter: ['lowpass', 2600, 1] }));
    },
    hornSiren(t, d, v) { tone(d, t, 'sawtooth', 620, 1.3, v * 0.14, { to: 1200, gt: 0.55, sus: 0.6, a: 0.05, filter: ['bandpass', 1300, 2] }); tone(d, t + 0.65, 'sawtooth', 1200, 0.6, v * 0.12, { to: 650, gt: 0.55, filter: ['bandpass', 1100, 2] }); },
    hornAir(t, d, v) { const g = shaped(d, v * 0.4); for (const f of [185, 233, 277]) tone(g, t, 'sawtooth', f, 1.1, 0.35, { a: 0.04, sus: 0.7, filter: ['lowpass', 1800, 1] }); },
    hornLow(t, d, v) { for (const [f, k] of [[147, 0], [196, 0.32]]) tone(d, t + k, 'sawtooth', f, 0.42, v * 0.18, { a: 0.03, sus: 0.25, filter: ['lowpass', 1100, 1.5] }); },
    moo(t, d, v) { // startled tractor: half cow, half engine
      const g = shaped(d, v * 0.45);
      tone(g, t, 'sawtooth', 150, 0.95, 0.6, { to: 92, gt: 0.9, a: 0.05, vib: [5, 22], filter: ['bandpass', 420, 3, 950, 0.45] });
      tone(g, t, 'square', 75, 0.9, 0.25, { to: 46, gt: 0.9, a: 0.05 });
    },
    boo(t, d, v) { // ghost tractor
      tone(d, t, 'sine', 380, 1.3, v * 0.35, { to: 300, gt: 1.2, a: 0.25, vib: [6, 60] });
      tone(d, t + 0.05, 'triangle', 570, 1.2, v * 0.12, { to: 450, gt: 1.1, a: 0.3, vib: [5.5, 50] });
    },
    backfire(t, d, v) {
      noise(d, t, 0.18, v * 0.9, 'lowpass', 1400, { to: 300 });
      tone(d, t, 'sine', 110, 0.2, v * 0.8, { to: 40 });
    },
    tip(t, d, v) { // heavy landing on its back
      tone(d, t, 'sine', 95, 0.45, v * 0.9, { to: 38 });
      noise(d, t, 0.35, v * 0.55, 'lowpass', 600, { to: 150 });
      noise(d, t + 0.02, 0.18, v * 0.25, 'bandpass', 2400, { q: 4 });
      tone(d, t + 0.03, 'square', 320, 0.12, v * 0.1, { to: 180 });
    },
    grumble(t, d, v) {
      const g = shaped(d, v * 0.4);
      tone(g, t, 'sawtooth', 88, 0.22, 0.6, { to: 72, filter: ['lowpass', 500, 2] });
      tone(g, t + 0.28, 'sawtooth', 80, 0.32, 0.6, { to: 62, filter: ['lowpass', 450, 2] });
    },
    snore(t, d, v) { noise(d, t, 1.4, v * 0.25, 'bandpass', 260, { q: 3, a: 0.7, to: 380, gt: 1.2 }); },
    roar(t, d, v) { // Thrasher wakes up / charges: engine roar plus a low bull-horn blast
      const g = shaped(d, v * 0.7);
      tone(g, t, 'sawtooth', 48, 1.7, 0.7, { to: 78, gt: 0.6, a: 0.12, sus: 0.4 });
      tone(g, t, 'sawtooth', 51, 1.7, 0.5, { to: 70, gt: 0.7, a: 0.15, sus: 0.4 });
      noise(d, t, 1.5, v * 0.5, 'lowpass', 300, { to: 1100, gt: 0.5, a: 0.1, sus: 0.3 });
      for (const f of [98, 117]) tone(d, t + 0.2, 'square', f, 1.1, v * 0.13, { sus: 0.6, a: 0.05, filter: ['lowpass', 900, 1] });
    },
    snort(t, d, v) { noise(d, t, 0.35, v * 0.5, 'bandpass', 700, { q: 1.5, to: 300 }); noise(d, t + 0.4, 0.3, v * 0.4, 'bandpass', 650, { q: 1.5, to: 280 }); },
    hit(t, d, v) {
      noise(d, t, 0.3, v * 0.7, 'bandpass', 1600, { q: 1.2, to: 600 });
      tone(d, t, 'square', 140, 0.25, v * 0.3, { to: 55 });
      tone(d, t, 'sine', 70, 0.35, v * 0.8, { to: 35 });
      tone(d, t + 0.05, 'triangle', 880, 0.3, v * 0.15, { to: 760 });
    },
    caught(t, d, v) { // wah wah wahhh
      SFX.hit(t, d, v);
      const n = [[311, 0.45], [294, 0.45], [277, 0.45], [262, 1.1]];
      let k = 0.45;
      for (const [f, l] of n) { tone(d, t + k, 'sawtooth', f, l, v * 0.22, { a: 0.03, sus: l * 0.6, vib: [5, l > 1 ? 40 : 10], filter: ['lowpass', 1200, 1, 500] }); k += l * 0.92; }
    },
    escape(t, d, v) { [60, 64, 67, 72, 76, 79, 84].forEach((m, i) => tone(d, t + i * 0.07, 'square', mtof(m), 0.25, v * 0.12, { filter: ['lowpass', 3000, 1] })); tone(d, t + 0.5, 'triangle', mtof(84), 0.8, v * 0.25); },
    gate(t, d, v) { tone(d, t, 'sawtooth', 620, 0.7, v * 0.12, { to: 880, gt: 0.35, vib: [11, 70], filter: ['bandpass', 1400, 6] }); },
    boost(t, d, v) { noise(d, t, 0.6, v * 0.5, 'bandpass', 400, { q: 2, to: 2600, gt: 0.5 }); },
    beep(t, d, v) { tone(d, t, 'square', 660, 0.18, v * 0.18, { sus: 0.1 }); },
    go(t, d, v) { tone(d, t, 'square', 988, 0.5, v * 0.2, { sus: 0.3 }); tone(d, t, 'square', 1318, 0.5, v * 0.1, { sus: 0.3 }); },
    select(t, d, v) { tone(d, t, 'triangle', 880, 0.08, v * 0.25); },
    confirm(t, d, v) { tone(d, t, 'triangle', 660, 0.1, v * 0.3); tone(d, t + 0.07, 'triangle', 990, 0.14, v * 0.3); },
    back(t, d, v) { tone(d, t, 'triangle', 520, 0.1, v * 0.3, { to: 380 }); },
    splat(t, d, v) { noise(d, t, 0.25, v * 0.8, 'lowpass', 900, { to: 200 }); tone(d, t, 'sine', 160, 0.2, v * 0.6, { to: 50 }); noise(d, t + 0.03, 0.12, v * 0.3, 'bandpass', 2500, { q: 2 }); },
    candy(t, d, v) { tone(d, t, 'square', 1175, 0.08, v * 0.12); tone(d, t + 0.07, 'square', 1568, 0.16, v * 0.12); },
    bale(t, d, v) { noise(d, t, 0.45, v * 0.6, 'highpass', 1800, { to: 900 }); tone(d, t, 'sine', 90, 0.2, v * 0.5, { to: 45 }); },
    splash(t, d, v) { noise(d, t, 0.6, v * 0.5, 'bandpass', 1200, { q: 1, to: 400 }); },
    star(t, d, v) { tone(d, t, 'triangle', 1568, 0.5, v * 0.3); tone(d, t, 'sine', 3136, 0.4, v * 0.1); },
    win(t, d, v) { [[67, 0], [72, 0.15], [76, 0.3], [79, 0.45], [84, 0.65]].forEach(([m, k]) => tone(d, t + k, 'square', mtof(m), k > 0.6 ? 0.8 : 0.18, v * 0.13, { filter: ['lowpass', 2800, 1] })); },
    lose(t, d, v) { SFX.caught(t, d, v * 0.6); },
    bump(t, d, v) { tone(d, t, 'sine', 120, 0.15, v * 0.5, { to: 60 }); noise(d, t, 0.1, v * 0.3, 'bandpass', 900); },
    zap(t, d, v) { tone(d, t, 'square', 1800, 0.25, v * 0.1, { to: 300 }); },
  };
  function sfx(name, o = {}) {
    if (!ctx || !SFX[name]) return;
    const t = ctx.currentTime + (o.delay || 0) + 0.005;
    let dest = sfxBus;
    if (o.pan && ctx.createStereoPanner) { const p = ctx.createStereoPanner(); p.pan.value = clamp(o.pan, -1, 1); p.connect(sfxBus); dest = p; setTimeout(() => p.disconnect(), 4000); }
    SFX[name](t, dest, o.vol == null ? 1 : o.vol);
  }

  // ---- engines (one per local player) ----
  function makeEngine(i) {
    const out = ctx.createGain(); out.gain.value = 0; out.connect(loopBus);
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 500; lp.Q.value = 2; lp.connect(out);
    const chug = ctx.createGain(); chug.gain.value = 0.7; chug.connect(lp);
    const a = ctx.createOscillator(); a.type = 'sawtooth'; a.frequency.value = 40;
    const b = ctx.createOscillator(); b.type = 'square'; b.frequency.value = 20;
    const bg = ctx.createGain(); bg.gain.value = 0.5;
    a.connect(chug); b.connect(bg); bg.connect(chug);
    const lfo = ctx.createOscillator(); lfo.type = 'sine'; lfo.frequency.value = 10;
    const lg = ctx.createGain(); lg.gain.value = 0.3; lfo.connect(lg); lg.connect(chug.gain);
    a.start(); b.start(); lfo.start();
    return engines[i] = { out, lp, a, b, lfo, kind: '' };
  }
  function engine(i, o) {
    if (!ctx) return;
    const e = engines[i] || makeEngine(i);
    const rusty = o.kind === 'rusty', k = clamp(Math.abs(o.speed) / o.top, 0, 1.6);
    const base = rusty ? 34 : 52, range = rusty ? 62 : 150;
    const f = base + range * k + (o.throttle > 0 ? 6 : 0) + (o.boost ? 18 : 0);
    glide(e.a.frequency, f, 0.08); glide(e.b.frequency, f * 0.5, 0.08);
    glide(e.lfo.frequency, rusty ? f * 0.25 : f * 0.5, 0.08);
    glide(e.lp.frequency, 260 + 900 * k + o.throttle * 500 + (o.boost ? 900 : 0), 0.08);
    glide(e.out.gain, o.gain * (0.05 + 0.06 * o.throttle + 0.05 * k + (o.boost ? 0.05 : 0)), 0.1);
  }

  // ---- Thrasher's diesel and reel ----
  function makeThrasher() {
    const out = ctx.createGain(); out.gain.value = 0; out.connect(loopBus);
    const pan = ctx.createStereoPanner ? ctx.createStereoPanner() : ctx.createGain(); pan.connect(out);
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 220; lp.connect(pan);
    const sh = shaped(lp, 0.6);
    const a = ctx.createOscillator(); a.type = 'sawtooth'; a.frequency.value = 28; a.connect(sh); a.start();
    const b = ctx.createOscillator(); b.type = 'sawtooth'; b.frequency.value = 28.6; b.connect(sh); b.start();
    const n = ctx.createBufferSource(); n.buffer = noiseBuf; n.loop = true;
    const nf = ctx.createBiquadFilter(); nf.type = 'bandpass'; nf.frequency.value = 900; nf.Q.value = 0.8;
    const ng = ctx.createGain(); ng.gain.value = 0;
    n.connect(nf); nf.connect(ng); ng.connect(pan); n.start();
    const whirL = ctx.createOscillator(); whirL.frequency.value = 3; const whirG = ctx.createGain(); whirG.gain.value = 0;
    whirL.connect(whirG); whirG.connect(ng.gain); whirL.start();
    return thr = { out, pan, lp, a, b, ng, whirL, whirG };
  }
  // o: { vol 0..1 (distance), awake, speed 0..1, pan }
  function thrasher(o) {
    if (!ctx) return;
    const h = thr || makeThrasher();
    const f = o.awake ? 30 + o.speed * 26 : 22;
    glide(h.a.frequency, f, 0.15); glide(h.b.frequency, f * 1.02, 0.15);
    glide(h.lp.frequency, o.awake ? 260 + o.speed * 500 : 150, 0.15);
    glide(h.out.gain, o.vol * (o.awake ? 0.5 : 0.12), 0.2);
    glide(h.ng.gain, o.awake ? 0.05 : 0, 0.2); glide(h.whirG.gain, o.awake ? 0.05 : 0, 0.2);
    glide(h.whirL.frequency, 2 + o.speed * 6, 0.2);
    if (h.pan.pan) glide(h.pan.pan, clamp(o.pan || 0, -1, 1), 0.1);
  }
  function stopLoops() {
    if (!ctx) return;
    for (const e of engines) if (e) glide(e.out.gain, 0, 0.05);
    if (thr) glide(thr.out.gain, 0, 0.1);
  }

  // ---- music ----
  // Steps are eighth notes. Each song has a chord per bar (8 steps) and plays its parts from that.
  const SONGS = {
    calm: { bpm: 100, roots: [43, 40, 36, 38], minor: [0, 1, 0, 0],
      mel: [62, 63, 64, 0, 67, 0, 64, 0, 62, 63, 64, 0, 59, 0, 0, 0, 64, 65, 66, 67, 0, 71, 0, 67, 66, 0, 69, 0, 66, 0, 62, 0], lead: 'pizz', bass: 'pizzBass', shaker: true },
    chase: { bpm: 152, roots: [43, 43, 36, 43, 38, 38, 43, 43], minor: [0, 0, 0, 0, 0, 0, 0, 0], banjo: true, bass: 'bass', drums: true },
    spooky: { bpm: 76, roots: [38, 34, 31, 33], minor: [1, 0, 1, 0], major3: [0, 0, 0, 1], organ: true,
      mel: [74, 0, 0, 77, 76, 0, 74, 0, 72, 0, 0, 0, 70, 0, 0, 0, 70, 0, 72, 74, 72, 0, 70, 69, 69, 0, 0, 73, 0, 0, 0, 0], lead: 'bell', bass: 'pizzBass' },
    spookyChase: { bpm: 144, roots: [38, 38, 34, 33], minor: [1, 1, 0, 0], major3: [0, 0, 0, 1], organStabs: true, bass: 'bass', drums: true,
      mel: [74, 73, 72, 71, 70, 0, 69, 0, 74, 73, 72, 71, 70, 0, 74, 0, 70, 69, 68, 67, 66, 0, 69, 0, 73, 0, 76, 0, 73, 0, 69, 0], lead: 'bell' },
  };
  let song = null, songName = '', step = 0, nextT = 0, timer = null, pendingSong = null;
  const INST = {
    pizz(t, m, v) { tone(musicBus, t, 'triangle', mtof(m), 0.16, v * 0.35); tone(musicBus, t, 'sine', mtof(m + 12), 0.08, v * 0.1); },
    pizzBass(t, m, v) { tone(musicBus, t, 'triangle', mtof(m), 0.3, v * 0.45); },
    bass(t, m, v) { tone(musicBus, t, 'triangle', mtof(m), 0.22, v * 0.55); tone(musicBus, t, 'sine', mtof(m), 0.25, v * 0.3); },
    banjo(t, m, v) { tone(musicBus, t, 'square', mtof(m), 0.2, v * 0.09, { filter: ['lowpass', 3200, 1, 900, 0.15] }); tone(musicBus, t, 'triangle', mtof(m), 0.12, v * 0.12); },
    bell(t, m, v) { tone(musicBus, t, 'sine', mtof(m), 1.1, v * 0.22); tone(musicBus, t, 'sine', mtof(m + 24) * 1.003, 0.4, v * 0.06); },
    organ(t, ms, dur, v) { for (const m of ms) for (const [k, g] of [[1, 0.1], [2, 0.05], [3, 0.025]]) tone(musicBus, t, 'sine', mtof(m) * k, dur, v * g, { a: 0.25, sus: dur * 0.6 }); },
    kick(t, v) { tone(musicBus, t, 'sine', 120, 0.18, v * 0.7, { to: 45 }); },
    snare(t, v) { noise(musicBus, t, 0.12, v * 0.25, 'bandpass', 2200, { q: 0.8 }); },
    hat(t, v) { noise(musicBus, t, 0.04, v * 0.12, 'highpass', 7000); },
  };
  function chordOf(S, bar) {
    const i = bar % S.roots.length, r = S.roots[i];
    const third = S.minor[i] ? 3 : 4;
    return [r, r + third, r + 7];
  }
  function playStep(S, n, t) {
    const bar = Math.floor(n / 8), s = n % 8, ch = chordOf(S, bar), r = ch[0], spb = 60 / S.bpm / 2;
    const B = INST[S.bass];
    if (S.bass === 'pizzBass') { if (s === 0) B(t, r, 1); if (s === 4) B(t, r + 7, 0.8); }
    else { if (s === 0 || s === 3) B(t, r, 1); if (s === 4 || s === 7 && S.drums) B(t, r + (s === 4 ? 7 : 12), 0.8); }
    if (S.mel && S.lead) { const m = S.mel[n % S.mel.length]; if (m) INST[S.lead](t, m, s % 2 ? 0.75 : 1); }
    if (S.banjo) {
      const roll = [ch[0] + 24, ch[1] + 24, ch[2] + 24, ch[0] + 36, ch[2] + 24, ch[1] + 24, ch[0] + 36, ch[2] + 24];
      INST.banjo(t, roll[s], 1); INST.banjo(t + spb / 2, roll[(s + 3) % 8], 0.6);
      if (s === 2 || s === 6) for (const m of ch) INST.banjo(t, m + 12, 0.5);
    }
    if (S.organ && s === 0) INST.organ(t, ch.map(m => m + 12), spb * 8, 1);
    if (S.organStabs && (s === 0 || s === 3)) INST.organ(t, ch.map(m => m + 12), spb * 1.2, 1.2);
    if (S.drums) { if (s === 0 || s === 4) INST.kick(t, 1); if (s === 2 || s === 6) INST.snare(t, 1); INST.hat(t, s % 2 ? 0.6 : 1); }
    if (S.shaker && s % 2 === 1) INST.hat(t, 0.5);
  }
  function tick() {
    if (!ctx || !song) return;
    const spb = 60 / song.bpm / 2;
    if (nextT < ctx.currentTime) nextT = ctx.currentTime + 0.05;
    while (nextT < ctx.currentTime + 0.2) { playStep(song, step, nextT); step++; nextT += spb; }
  }
  function music(name) {
    if (!ctx) { pendingSong = name; return; }
    if (name === songName) return;
    songName = name; song = SONGS[name] || null; step = 0; nextT = ctx.currentTime + 0.1;
    clearInterval(timer);
    if (song) timer = setInterval(tick, 40);
  }

  TT.audio = {
    init, sfx, engine, thrasher, music, levels,
    get ready() { return !!ctx; },
    setPaused(p) { paused = p; levels(); if (p) stopLoops(); },
    stopLoops,
  };
})();
