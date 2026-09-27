// Synthesised sound: punches, whooshes, the ring bell, crowd ambience; recorded referee lines and count.
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
    const lim = c.createDynamicsCompressor();
    lim.threshold.value = -10; lim.knee.value = 6; lim.ratio.value = 8; lim.attack.value = 0.003; lim.release.value = 0.15;
    A.master.connect(lim).connect(c.destination);

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
    A.loadClips();
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
  // Grunts are synthesised to sound as human as a synth can: a glottal-like source (harmonics rolling
  // off like a real voice), random pitch jitter, a breathy "h" onset, vowel formants that glide rather
  // than hold, breath noise shaped by the same formants, and a touch of strain on the big efforts.
  // Each fighter has a pitch and a formant scale (bigger man = lower, darker voice).
  const VOWELS = { uh: [620, 1180, 2400], ah: [760, 1180, 2450], oh: [520, 880, 2400], oo: [340, 820, 2250], eh: [560, 1700, 2450], hn: [280, 1500, 2600] };
  // [from vowel, to vowel, length s, start pitch x, end pitch x, loudness, breath, strain]
  const GRUNTS = {
    effortSmall: [['hn', 'uh', 0.09, 1.05, 0.9, 0.5, 0.5, 0], ['uh', 'uh', 0.08, 1.1, 0.85, 0.45, 0.7, 0]],
    effort:      [['uh', 'uh', 0.12, 1.12, 0.82, 0.6, 0.6, 0.15], ['hn', 'uh', 0.11, 1.08, 0.86, 0.55, 0.5, 0.1], ['eh', 'uh', 0.11, 1.15, 0.8, 0.55, 0.7, 0.15]],
    effortBig:   [['ah', 'uh', 0.2, 1.22, 0.74, 0.8, 0.7, 0.35], ['uh', 'ah', 0.18, 1.18, 0.76, 0.8, 0.6, 0.3], ['eh', 'ah', 0.19, 1.25, 0.72, 0.75, 0.75, 0.35]],
    effortHuge:  [['ah', 'ah', 0.42, 1.3, 0.7, 1.0, 0.7, 0.55]],
    block:       [['hn', 'hn', 0.09, 1.0, 0.9, 0.45, 0.6, 0]],
    hurtSmall:   [['uh', 'oh', 0.12, 1.05, 0.8, 0.5, 0.9, 0.1]],
    hurt:        [['uh', 'oh', 0.17, 1.15, 0.7, 0.7, 0.8, 0.2], ['oh', 'uh', 0.16, 1.1, 0.72, 0.7, 0.9, 0.2]],
    hurtBody:    [['oo', 'uh', 0.24, 0.98, 0.66, 0.75, 1.3, 0.1], ['oh', 'oo', 0.26, 1.0, 0.62, 0.75, 1.2, 0.1]],
    hurtBig:     [['ah', 'uh', 0.3, 1.3, 0.62, 0.9, 0.8, 0.45], ['uh', 'ah', 0.28, 1.25, 0.64, 0.9, 0.8, 0.4], ['oh', 'ah', 0.3, 1.2, 0.66, 0.85, 0.85, 0.4]],
    down:        [['oh', 'uh', 0.8, 1.08, 0.58, 0.9, 0.9, 0.2], ['uh', 'oo', 0.75, 1.02, 0.6, 0.9, 1.0, 0.2]],
  };
  let glottal = null, strainCurve = null;
  function voiceParts(c) {
    if (!glottal) { // harmonics falling off ~12 dB/octave, like vocal folds
      const n = 48, re = new Float32Array(n), im = new Float32Array(n);
      for (let k = 1; k < n; k++) im[k] = 1 / Math.pow(k, 1.9) * (k % 2 ? 1 : 0.85);
      glottal = c.createPeriodicWave(re, im);
      strainCurve = new Float32Array(1024);
      for (let i = 0; i < 1024; i++) { const x = i / 511.5 - 1; strainCurve[i] = Math.tanh(x * 2.2) / Math.tanh(2.2); }
    }
  }
  A.voice = (v, kind) => {
    if (!A.ctx || !v) return;
    const c = A.ctx; voiceParts(c);
    const [va, vb, len0, p0, p1, loud, breath0, strain] = BK.pick(GRUNTS[kind] || GRUNTS.effort);
    const t = c.currentTime + 0.005, len = len0 * BK.rnd(0.88, 1.15);
    const pitch = v.pitch * BK.rnd(0.93, 1.07), breath = breath0 * (0.7 + v.breath), fs = v.formant * BK.rnd(0.97, 1.03);
    const onset = 0.035; // the "h" before the voice kicks in

    const out = c.createGain();
    out.gain.setValueAtTime(0.0001, t);
    out.gain.exponentialRampToValueAtTime(loud * 1.3, t + onset + 0.02);
    out.gain.exponentialRampToValueAtTime(loud * 0.9, t + onset + len * 0.5);
    out.gain.exponentialRampToValueAtTime(0.0001, t + onset + len);
    const shaper = c.createWaveShaper(); shaper.curve = strainCurve;
    const drive = c.createGain(); drive.gain.value = 1 + strain * 3;
    const trim = c.createGain(); trim.gain.value = 1 / (1 + strain * 1.5);
    const post = c.createBiquadFilter(); post.type = 'lowpass'; post.frequency.value = 3800;
    drive.connect(shaper).connect(trim).connect(post).connect(out);
    out.connect(A.master);

    // formant bank the voice and breath both pass through, gliding from one vowel to the next
    const bank = c.createGain();
    VOWELS[va].forEach((f, i) => {
      const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = [5, 7, 9][i];
      bp.frequency.setValueAtTime(f * fs, t);
      bp.frequency.linearRampToValueAtTime(VOWELS[vb][i] * fs, t + onset + len);
      const g = c.createGain(); g.gain.value = [2.2, 1.1, 0.45][i];
      bank.connect(bp).connect(g).connect(drive);
    });

    // voiced source with a quick rise then fall, plus random jitter so it never sounds like a tone
    const osc = c.createOscillator(); osc.setPeriodicWave(glottal);
    osc.frequency.setValueAtTime(pitch * p0 * 0.94, t + onset * 0.5);
    osc.frequency.linearRampToValueAtTime(pitch * p0, t + onset + 0.03);
    osc.frequency.exponentialRampToValueAtTime(pitch * p1, t + onset + len);
    const jit = c.createBufferSource(); jit.buffer = A.noiseBuf;
    const jitF = c.createBiquadFilter(); jitF.type = 'lowpass'; jitF.frequency.value = 40;
    const jitG = c.createGain(); jitG.gain.value = pitch * (0.08 + strain * 0.1);
    jit.connect(jitF).connect(jitG).connect(osc.frequency);
    const voiced = c.createGain();
    voiced.gain.setValueAtTime(0.0001, t);
    voiced.gain.setValueAtTime(0.0001, t + onset * 0.6);
    voiced.gain.exponentialRampToValueAtTime(1, t + onset + 0.02);
    osc.connect(voiced).connect(bank);

    // breath: strong at the onset ("h"), then riding under the voice
    const n = c.createBufferSource(); n.buffer = A.noiseBuf;
    const nh = c.createBiquadFilter(); nh.type = 'highpass'; nh.frequency.value = 400;
    const ng = c.createGain();
    ng.gain.setValueAtTime(breath * 2.2, t);
    ng.gain.exponentialRampToValueAtTime(breath * 0.8, t + onset + 0.03);
    n.connect(nh).connect(ng).connect(bank);

    const end = t + onset + len + 0.06;
    osc.start(t); jit.start(t, Math.random() * 2); n.start(t, Math.random() * 2);
    osc.stop(end); jit.stop(end); n.stop(end);
  };

  A.tick = (good) => { if (A.ctx) tone(good ? 880 : 220, good ? 1320 : 160, 0.12, 0.35, good ? 'triangle' : 'square'); };

  let bestVoice;
  function pickVoice() {
    if (bestVoice) return bestVoice;
    try {
      const vs = window.speechSynthesis.getVoices().filter(v => /^en/i.test(v.lang));
      if (!vs.length) return null;
      const score = v => (/natural|neural|enhanced|premium|online/i.test(v.name) ? 5 : 0) + (/google/i.test(v.name) ? 3 : 0)
        + (/male|daniel|george|arthur|oliver|james|david|guy|ryan|thomas|liam|connor/i.test(v.name) && !/female/i.test(v.name) ? 3 : 0)
        + (/en-(IE|GB)/i.test(v.lang) ? 2 : 0) - (/female|samantha|karen|victoria|zira|susan/i.test(v.name) ? 3 : 0) - (v.localService === false ? 0 : 0);
      bestVoice = vs.slice().sort((a, b) => score(b) - score(a))[0];
    } catch (e) { bestVoice = null; }
    return bestVoice;
  }
  try { window.speechSynthesis && window.speechSynthesis.addEventListener('voiceschanged', () => { bestVoice = null; }); } catch (e) { /* optional */ }
  function speak(text, rate, pitch, interrupt) {
    if (!BK.settings.sound) return;
    try {
      const ss = window.speechSynthesis;
      if (!ss) return;
      if (interrupt) ss.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.rate = rate; u.pitch = pitch; u.volume = 1;
      const v = pickVoice(); if (v) u.voice = v;
      ss.speak(u);
    } catch (e) { /* speech is optional */ }
  }
  A.say = text => speak(text, 1.0, 0.85);
  // ---------- recorded clips (referee lines and the count) ----------
  // Decoded into Web Audio so they follow the sound setting and the master volume. If decoding isn't
  // possible (e.g. opened straight from disk) they fall back to a plain <audio> element.
  const CLIPS = ['ref-real-boss', 'ref-started-it', 'ref-keep-it-going'];
  for (let n = 1; n <= 10; n++) CLIPS.push(`count-${n}`);
  const clipBuf = {}, clipEl = {};
  A.loadClips = () => {
    for (const name of CLIPS) {
      const url = `audio/${name}.mp3`;
      if (!clipEl[name]) { try { clipEl[name] = new Audio(url); clipEl[name].preload = 'auto'; } catch (e) { /* optional */ } }
      if (!A.ctx || clipBuf[name]) continue;
      fetch(url).then(r => r.arrayBuffer()).then(b => A.ctx.decodeAudioData(b)).then(buf => { clipBuf[name] = buf; }).catch(() => {});
    }
  };
  // Plays a clip and returns its length in seconds (0 if unavailable).
  A.clip = name => {
    if (!BK.settings.sound) return 0;
    const buf = clipBuf[name];
    if (A.ctx && buf) {
      const s = A.ctx.createBufferSource(); s.buffer = buf;
      const g = A.ctx.createGain(); g.gain.value = 1.6; // a touch louder than the crowd
      s.connect(g).connect(A.master); s.start();
      return buf.duration;
    }
    const el = clipEl[name];
    if (el) { try { el.currentTime = 0; el.volume = 1; el.play().catch(() => {}); } catch (e) { /* optional */ } return el.duration || 3; }
    return 0;
  };
  A.announce = text => speak(text, 0.88, 0.8, true);
  // Walkout beat: kick, snare and a low bass line for a few bars.
  A.walkoutBeat = bars => {
    if (!A.ctx) return;
    const step = 0.26;
    for (let i = 0; i < bars * 8; i++) {
      const t0 = i * step;
      if (i % 4 === 0 || i % 8 === 6) tone(110, 40, 0.18, 0.7, 'sine', t0);
      if (i % 4 === 2) noiseBurst(0.1, 1800, 'bandpass', 0.35, t0);
      if (i % 2 === 0) tone([55, 55, 65, 49][Math.floor(i / 8) % 4], [55, 55, 65, 49][Math.floor(i / 8) % 4] * 0.99, 0.22, 0.25, 'triangle', t0);
    }
  };
  A.hush = () => { try { window.speechSynthesis && window.speechSynthesis.cancel(); } catch (e) { /* optional */ } };
})();
