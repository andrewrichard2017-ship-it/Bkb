// Synthesised sound: punches, whooshes, the ring bell, crowd ambience and the referee's count.
// Everything is generated with Web Audio so there are no sound files to ship.
(() => {
  'use strict';
  const BK = window.BK;
  const A = BK.audio = { ctx: null, master: null, crowd: null, excitement: 0 };

  A.init = () => {
    if (A.ctx) { if (A.ctx.state === 'suspended') A.ctx.resume(); return; }
    try { A.ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { A.ctx = null; return; }
    const c = A.ctx;
    A.master = c.createGain(); A.master.gain.value = BK.settings.sound ? 0.9 : 0;
    A.master.connect(c.destination);

    // Crowd bed: looping noise through two band filters, level follows excitement.
    const len = c.sampleRate * 3, buf = c.createBuffer(1, len, c.sampleRate), d = buf.getChannelData(0);
    let b = 0;
    for (let i = 0; i < len; i++) { b = b * 0.97 + (Math.random() * 2 - 1) * 0.03; d[i] = b * 6 + (Math.random() * 2 - 1) * 0.08; }
    A.noiseBuf = buf;
    const src = c.createBufferSource(); src.buffer = buf; src.loop = true;
    const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 700; bp.Q.value = 0.5;
    A.crowd = c.createGain(); A.crowd.gain.value = 0.05;
    src.connect(bp).connect(A.crowd).connect(A.master);
    src.start();
  };

  A.setEnabled = on => { if (A.master) A.master.gain.setTargetAtTime(on ? 0.9 : 0, A.ctx.currentTime, 0.05); if (!on) A.hush(); };

  A.update = dt => {
    A.excitement = Math.max(0, A.excitement - dt * 0.18);
    if (A.crowd) A.crowd.gain.setTargetAtTime(0.05 + A.excitement * 0.28, A.ctx.currentTime, 0.2);
  };
  A.excite = v => { A.excitement = Math.min(1, A.excitement + v); };

  function noiseBurst(len, freq, type, gain, t0 = 0) {
    const c = A.ctx, t = c.currentTime + t0;
    const buf = c.createBuffer(1, Math.floor(c.sampleRate * len), c.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 2.5);
    const s = c.createBufferSource(); s.buffer = buf;
    const f = c.createBiquadFilter(); f.type = type; f.frequency.value = freq;
    const g = c.createGain(); g.gain.value = gain;
    s.connect(f).connect(g).connect(A.master); s.start(t);
    return f;
  }
  function tone(f0, f1, len, gain, type = 'sine', t0 = 0) {
    const c = A.ctx, t = c.currentTime + t0;
    const o = c.createOscillator(), g = c.createGain(); o.type = type;
    o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f1, t + len);
    g.gain.setValueAtTime(gain, t); g.gain.exponentialRampToValueAtTime(0.0008, t + len);
    o.connect(g).connect(A.master); o.start(t); o.stop(t + len + 0.02);
  }

  // kind: 'jab' | 'power' | 'blocked' | 'counter'
  A.punch = kind => {
    if (!A.ctx) return;
    if (kind === 'blocked') { noiseBurst(0.08, 1400, 'bandpass', 0.5); tone(260, 120, 0.08, 0.25, 'triangle'); return; }
    const heavy = kind !== 'jab';
    noiseBurst(heavy ? 0.16 : 0.1, heavy ? 520 : 800, 'lowpass', heavy ? 1.0 : 0.7);
    tone(heavy ? 120 : 160, 42, heavy ? 0.2 : 0.12, heavy ? 0.8 : 0.5);
    if (kind === 'counter') tone(90, 30, 0.35, 0.7, 'sine', 0.01);
  };
  A.whoosh = () => {
    if (!A.ctx) return;
    const f = noiseBurst(0.18, 600, 'bandpass', 0.35);
    f.frequency.exponentialRampToValueAtTime(2400, A.ctx.currentTime + 0.15);
  };
  A.thump = () => { if (A.ctx) { noiseBurst(0.3, 200, 'lowpass', 1.2); tone(70, 28, 0.4, 0.9); } };

  // Boxing bell: inharmonic partials with a long decay, struck `times` times.
  A.bell = (times = 1) => {
    if (!A.ctx) return;
    for (let i = 0; i < times; i++) {
      const t0 = i * 0.32;
      [[760, 0.35], [1240, 0.18], [2050, 0.12], [3140, 0.06]].forEach(([f, g]) => tone(f, f * 0.995, 1.6, g, 'sine', t0));
      noiseBurst(0.02, 3000, 'highpass', 0.3, t0);
    }
  };
  A.roar = (amt = 0.6) => {
    A.excite(amt);
    if (!A.ctx) return;
    const c = A.ctx, t = c.currentTime;
    const s = c.createBufferSource(); s.buffer = A.noiseBuf;
    const f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 900; f.Q.value = 0.7;
    const g = c.createGain(); g.gain.setValueAtTime(0.001, t); g.gain.linearRampToValueAtTime(0.5 * amt, t + 0.25);
    g.gain.exponentialRampToValueAtTime(0.001, t + 2.6);
    s.connect(f).connect(g).connect(A.master); s.start(t); s.stop(t + 2.7);
  };
  A.slap = () => { if (A.ctx) { noiseBurst(0.07, 2500, 'highpass', 0.9); tone(420, 180, 0.06, 0.3, 'triangle'); } };
  A.glug = () => { if (A.ctx) { tone(160, 90, 0.12, 0.5); tone(120, 70, 0.1, 0.35, 'sine', 0.1); } };
  // ---------- voices ----------
  // Grunts are synthesised: a buzzy glottal source through three vowel formant filters, plus breath noise.
  // Each fighter has a pitch and a formant scale (bigger man = lower, darker voice).
  const VOWELS = { uh: [640, 1190, 2390], ah: [760, 1150, 2450], oh: [540, 860, 2400], oo: [320, 800, 2240], eh: [560, 1750, 2480], hn: [260, 1900, 2700] };
  // [vowel, length s, pitch multiplier at start, pitch fall, loudness, breathiness]
  const GRUNTS = {
    effortSmall: [['hn', 0.09, 1.1, 0.85, 0.35, 0.3], ['uh', 0.08, 1.15, 0.8, 0.3, 0.5]],
    effort:      [['uh', 0.11, 1.2, 0.8, 0.45, 0.4], ['hn', 0.1, 1.15, 0.85, 0.4, 0.3], ['eh', 0.1, 1.25, 0.75, 0.4, 0.6]],
    effortBig:   [['ah', 0.18, 1.3, 0.7, 0.6, 0.5], ['uh', 0.16, 1.25, 0.72, 0.6, 0.45], ['eh', 0.17, 1.35, 0.68, 0.55, 0.55]],
    effortHuge:  [['ah', 0.36, 1.45, 0.6, 0.85, 0.5]],
    block:       [['hn', 0.08, 1.0, 0.9, 0.3, 0.4]],
    hurtSmall:   [['uh', 0.1, 1.1, 0.75, 0.35, 0.6]],
    hurt:        [['uh', 0.15, 1.2, 0.65, 0.5, 0.6], ['oh', 0.14, 1.15, 0.7, 0.5, 0.7]],
    hurtBody:    [['oo', 0.2, 1.0, 0.6, 0.55, 0.9], ['oh', 0.22, 1.05, 0.55, 0.55, 0.85]],
    hurtBig:     [['ah', 0.26, 1.35, 0.55, 0.7, 0.6], ['uh', 0.24, 1.3, 0.55, 0.7, 0.55], ['oh', 0.25, 1.25, 0.6, 0.65, 0.65]],
    down:        [['oh', 0.7, 1.1, 0.5, 0.7, 0.6], ['uh', 0.65, 1.05, 0.55, 0.7, 0.7]],
  };
  A.voice = (v, kind) => {
    if (!A.ctx || !v) return;
    const [vowel, len0, p0, fall, loud, breath0] = BK.pick(GRUNTS[kind] || GRUNTS.effort);
    const c = A.ctx, t = c.currentTime + 0.005;
    const len = len0 * BK.rnd(0.9, 1.15), pitch = v.pitch * BK.rnd(0.94, 1.06), breath = breath0 * (0.6 + v.breath);
    const out = c.createGain();
    out.gain.setValueAtTime(0.0001, t);
    out.gain.exponentialRampToValueAtTime(loud * 0.5, t + 0.018);
    out.gain.setValueAtTime(loud * 0.5, t + len * 0.35);
    out.gain.exponentialRampToValueAtTime(0.0001, t + len);
    out.connect(A.master);
    // voiced part
    const osc = c.createOscillator(); osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(pitch * p0, t);
    osc.frequency.exponentialRampToValueAtTime(pitch * p0 * fall, t + len);
    const vib = c.createOscillator(), vibG = c.createGain(); // rough, strained voice
    vib.frequency.value = 28; vibG.gain.value = pitch * 0.04; vib.connect(vibG).connect(osc.frequency);
    VOWELS[vowel].forEach((f, i) => {
      const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = f * v.formant; bp.Q.value = [7, 9, 11][i];
      const g = c.createGain(); g.gain.value = [1.6, 0.9, 0.35][i];
      osc.connect(bp).connect(g).connect(out);
    });
    // breath
    const n = c.createBufferSource(); n.buffer = A.noiseBuf;
    const nf = c.createBiquadFilter(); nf.type = 'bandpass'; nf.frequency.value = VOWELS[vowel][1] * v.formant; nf.Q.value = 0.8;
    const ng = c.createGain(); ng.gain.value = breath * 1.4;
    n.connect(nf).connect(ng).connect(out);
    osc.start(t); vib.start(t); n.start(t, Math.random() * 2);
    osc.stop(t + len + 0.05); vib.stop(t + len + 0.05); n.stop(t + len + 0.05);
  };

  A.tick = (good) => { if (A.ctx) tone(good ? 880 : 220, good ? 1320 : 160, 0.12, 0.35, good ? 'triangle' : 'square'); };

  A.say = text => {
    if (!BK.settings.sound) return;
    try {
      const ss = window.speechSynthesis;
      if (!ss) return;
      const u = new SpeechSynthesisUtterance(text);
      u.rate = 1.15; u.pitch = 0.75; u.volume = 1;
      ss.speak(u);
    } catch (e) { /* speech is optional */ }
  };
  A.hush = () => { try { window.speechSynthesis && window.speechSynthesis.cancel(); } catch (e) { /* optional */ } };
})();
