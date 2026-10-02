'use strict';
// Every sound is made on the fly with Web Audio, so there are no audio files to load.
const Sound = (() => {
  let ctx = null, out = null, sfx = null, music = null, noise = null, muted = false;
  let engine = null, horn = null, rain = null, radio = null;
  let lastEngine = -1, lastDuck = null, lastRain = -1;

  function init() {
    if (ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    try { ctx = new AC(); } catch (e) { ctx = null; return; }
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14; comp.ratio.value = 4;
    out = ctx.createGain(); out.gain.value = muted ? 0 : 0.9;
    out.connect(comp); comp.connect(ctx.destination);
    sfx = ctx.createGain(); sfx.connect(out);
    music = ctx.createGain(); music.gain.value = 0.6; music.connect(out);
    const len = ctx.sampleRate * 2;
    noise = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = noise.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) ctx.suspend(); else ctx.resume();
    });
  }
  function unlock() { init(); if (ctx && ctx.state !== 'running') ctx.resume(); }
  function setMuted(m) {
    muted = m;
    if (out) out.gain.setTargetAtTime(m ? 0 : 0.9, ctx.currentTime, 0.05);
  }

  // A plucked/enveloped oscillator note.
  function tone(type, f, t, dur, vol, opt) {
    opt = opt || {};
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(f, t);
    if (opt.slide) o.frequency.exponentialRampToValueAtTime(opt.slide, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + (opt.attack || 0.01));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(opt.dest || sfx);
    o.start(t); o.stop(t + dur + 0.05);
  }
  // A burst of filtered noise: air brakes, wipers, door hiss.
  function hiss(t, dur, vol, type, f, q, slide, dest) {
    const s = ctx.createBufferSource(); s.buffer = noise;
    const fl = ctx.createBiquadFilter(); fl.type = type; fl.frequency.setValueAtTime(f, t); fl.Q.value = q;
    if (slide) fl.frequency.exponentialRampToValueAtTime(slide, t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + Math.min(0.03, dur / 3));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(fl); fl.connect(g); g.connect(dest || sfx);
    s.start(t, Math.random() * 1.5, dur + 0.05);
  }
  const now = () => ctx.currentTime;

  // ---- engine ----
  function engineStart() {
    if (!ctx) return;
    const t = now();
    for (let i = 0; i < 4; i++) { // the starter motor turning over
      hiss(t + i * 0.15, 0.12, 0.22, 'lowpass', 420, 1);
      tone('square', 48, t + i * 0.15, 0.1, 0.07);
    }
    if (engine) return;
    const t0 = t + 0.6;
    const o1 = ctx.createOscillator(); o1.type = 'sawtooth';
    const o2 = ctx.createOscillator(); o2.type = 'square';
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 320; lp.Q.value = 2;
    const chug = ctx.createGain(); chug.gain.value = 0.6;
    const lfo = ctx.createOscillator(); lfo.frequency.value = 9;
    const lfoAmt = ctx.createGain(); lfoAmt.gain.value = 0.4;
    lfo.connect(lfoAmt); lfoAmt.connect(chug.gain);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(0.11, t0 + 0.2);
    o1.frequency.setValueAtTime(30, t0); o1.frequency.linearRampToValueAtTime(75, t0 + 0.3); o1.frequency.linearRampToValueAtTime(42, t0 + 0.9);
    o2.frequency.setValueAtTime(15, t0); o2.frequency.linearRampToValueAtTime(37, t0 + 0.3); o2.frequency.linearRampToValueAtTime(21, t0 + 0.9);
    o1.connect(lp); o2.connect(lp); lp.connect(chug); chug.connect(g); g.connect(sfx);
    o1.start(t0); o2.start(t0); lfo.start(t0);
    engine = { o1, o2, lfo, lp, g, ready: t0 + 0.95 };
    lastEngine = -1;
  }
  function engineStop() {
    if (!engine) return;
    const e = engine, t = now(); engine = null;
    for (const p of [e.o1.frequency, e.o2.frequency, e.g.gain]) { p.cancelScheduledValues(t); p.setValueAtTime(p.value, t); }
    e.o1.frequency.linearRampToValueAtTime(16, t + 0.8);
    e.o2.frequency.linearRampToValueAtTime(8, t + 0.8);
    e.g.gain.exponentialRampToValueAtTime(0.0001, t + 0.9);
    for (const o of [e.o1, e.o2, e.lfo]) o.stop(t + 1);
    hiss(t + 0.6, 0.4, 0.12, 'lowpass', 600, 1);
  }
  // speed 0..1; duck pulls the engine down while the radio plays
  function engineSet(speed, duck) {
    if (!engine || now() < engine.ready) return;
    if (Math.abs(speed - lastEngine) < 0.02 && duck === lastDuck) return;
    lastEngine = speed; lastDuck = duck;
    const t = now(), f = 42 + speed * 40;
    engine.o1.frequency.setTargetAtTime(f, t, 0.15);
    engine.o2.frequency.setTargetAtTime(f / 2, t, 0.15);
    engine.lfo.frequency.setTargetAtTime(9 + speed * 10, t, 0.2);
    engine.lp.frequency.setTargetAtTime(320 + speed * 320, t, 0.2);
    engine.g.gain.setTargetAtTime((0.09 + speed * 0.05) * (duck ? 0.55 : 1), t, 0.2);
  }

  // ---- horn: held for as long as the button is ----
  function hornOn() {
    if (!ctx || horn) return;
    const t = now(), g = ctx.createGain(), lp = ctx.createBiquadFilter();
    lp.type = 'lowpass'; lp.frequency.value = 1900;
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.2, t + 0.02);
    const os = [370, 466].map(f => {
      const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f;
      o.connect(lp); o.start(t); return o;
    });
    lp.connect(g); g.connect(sfx);
    horn = { g, os, t0: t };
  }
  function hornOff() {
    if (!horn) return;
    const h = horn; horn = null;
    const t = Math.max(now(), h.t0 + 0.2);
    h.g.gain.setValueAtTime(0.2, t); h.g.gain.exponentialRampToValueAtTime(0.0001, t + 0.06);
    for (const o of h.os) o.stop(t + 0.1);
  }

  // ---- one-shots ----
  const fx = fn => (...a) => { if (ctx) fn(now(), ...a); };
  const door = fx((t, open) => {
    hiss(t, 0.5, 0.3, 'bandpass', 2600, 0.8, 1100);
    if (open) { tone('sine', 880, t + 0.05, 0.45, 0.13); tone('sine', 660, t + 0.32, 0.6, 0.13); }
    else { tone('sine', 660, t + 0.05, 0.3, 0.1); tone('sine', 660, t + 0.3, 0.3, 0.1); }
    tone('sine', 110, t + 0.5, 0.18, 0.25, { slide: 55 });
  });
  const airBrake = fx(t => hiss(t, 0.55, 0.22, 'bandpass', 3200, 0.9, 1400));
  const swish = fx(t => hiss(t, 0.22, 0.06, 'bandpass', 1500, 1.4, 700));
  const gear = fx(t => { tone('square', 140, t, 0.06, 0.05); hiss(t, 0.08, 0.1, 'lowpass', 900, 1); });
  const click = fx(t => tone('sine', 1200, t, 0.05, 0.08));
  const nope = fx(t => { tone('triangle', 330, t, 0.16, 0.16); tone('triangle', 247, t + 0.17, 0.25, 0.16); });
  const reverseBeep = fx(t => tone('square', 1050, t, 0.28, 0.035, { attack: 0.005 }));
  // a happy rising chime, a little higher for each kid that gets on
  const board = fx((t, n) => {
    const f = 523 * Math.pow(2, ((n % 6) * 2) / 12);
    tone('triangle', f, t, 0.18, 0.16); tone('triangle', f * 1.26, t + 0.08, 0.18, 0.16); tone('triangle', f * 1.5, t + 0.16, 0.35, 0.16);
  });
  const bye = fx(t => { tone('triangle', 784, t, 0.18, 0.12); tone('triangle', 659, t + 0.1, 0.3, 0.12); });
  const fanfare = fx(t => {
    [[523, 0, .18], [659, .18, .18], [784, .36, .18], [1047, .54, .5], [784, .9, .16], [1047, 1.06, .8]].forEach(([f, d, l]) => {
      tone('triangle', f, t + d, l + 0.1, 0.2); tone('square', f, t + d, l, 0.04);
    });
  });
  const scribble = fx(t => hiss(t, 0.08, 0.05, 'bandpass', 2600 + Math.random() * 1600, 2.5));
  const sparkle = fx(t => [1319, 1568, 1976, 2637, 3136].forEach((f, i) => tone('sine', f, t + i * 0.07, 0.35, 0.09)));
  const tuneIn = fx(t => hiss(t, 0.3, 0.08, 'bandpass', 2000, 0.5, 4000, music));

  // ---- rain on the roof ----
  function rainLevel(l) {
    if (!ctx || Math.abs(l - lastRain) < 0.02) return;
    lastRain = l;
    if (!rain) {
      const s = ctx.createBufferSource(); s.buffer = noise; s.loop = true;
      const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 1100;
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 7000;
      const g = ctx.createGain(); g.gain.value = 0;
      s.connect(hp); hp.connect(lp); lp.connect(g); g.connect(sfx); s.start();
      rain = g;
    }
    rain.gain.setTargetAtTime(l * 0.07, now(), 0.3);
  }

  // ---- radio ----
  const NOTE = n => {
    const m = /^([A-G])(#?)(\d)$/.exec(n);
    const midi = (+m[3] + 1) * 12 + { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }[m[1]] + (m[2] ? 1 : 0);
    return 440 * Math.pow(2, (midi - 69) / 12);
  };
  const BASS = { C: ['C3', 'G2'], F: ['F2', 'C3'], G: ['G2', 'D3'], D: ['D3', 'A2'] };
  function compile(song) {
    const ev = [];
    let t = 0;
    for (const [n, d] of song.notes) { if (n !== 'R') ev.push({ t, k: 'm', f: NOTE(n), d }); t += d; }
    const len = t;
    t = 0;
    for (const [c, d] of song.chords) {
      ev.push({ t, k: 'b', f: NOTE(BASS[c][0]), d: Math.min(d, song.tick * 1.5) });
      if (d >= 2) ev.push({ t: t + d / 2, k: 'b', f: NOTE(BASS[c][1]), d: Math.min(d / 2, song.tick * 1.5) });
      t += d;
    }
    for (let b = 0; b < len; b += song.tick) ev.push({ t: b, k: 't' });
    ev.sort((a, b) => a.t - b.t);
    return { ev, len, gap: song.tick * 2, spb: 60 / song.bpm };
  }
  function play(e, t, spb, dest) {
    if (e.k === 'm') {
      const dur = Math.max(0.18, e.d * spb * 0.95);
      tone('triangle', e.f, t, dur, 0.3, { dest });
      tone('sine', e.f * 2, t, dur * 0.6, 0.06, { dest });
    } else if (e.k === 'b') {
      tone('triangle', e.f, t, Math.min(0.5, e.d * spb), 0.32, { dest });
    } else hiss(t, 0.04, 0.03, 'highpass', 7000, 0.7, 0, dest);
  }
  function radioOn(i) {
    if (!ctx) return;
    radioOff();
    tuneIn();
    const g = ctx.createGain(); g.connect(music);
    radio = { song: compile(SONGS[i]), g, idx: 0, start: now() + 0.35 };
  }
  function radioOff() {
    if (!radio) return;
    const r = radio; radio = null;
    r.g.gain.setTargetAtTime(0, now(), 0.04);
    setTimeout(() => r.g.disconnect(), 600);
  }
  // Called every frame: books the next few notes ahead of time.
  function radioTick() {
    if (!radio) return;
    const r = radio, s = r.song, t = now();
    if (r.start + s.ev[r.idx].t * s.spb < t - 0.5) r.start = t + 0.05 - s.ev[r.idx].t * s.spb; // fell behind: carry on from here
    for (;;) {
      const e = s.ev[r.idx], when = r.start + e.t * s.spb;
      if (when > t + 0.3) break;
      play(e, when, s.spb, r.g);
      if (++r.idx >= s.ev.length) { r.idx = 0; r.start += (s.len + s.gap) * s.spb; }
    }
  }

  // recorded voice clips
  function decode(ab) {
    init();
    return new Promise((res, rej) => ctx.decodeAudioData(ab, res, rej));
  }
  function voice(buf) {
    const s = ctx.createBufferSource(), g = ctx.createGain();
    s.buffer = buf; g.gain.value = 1.4;
    s.connect(g); g.connect(out); s.start();
    return s;
  }

  return { unlock, setMuted, decode, voice, engineStart, engineStop, engineSet, hornOn, hornOff, door, airBrake, swish, gear, click,
    nope, reverseBeep, board, bye, fanfare, scribble, sparkle, rainLevel, radioOn, radioOff, radioTick };
})();
