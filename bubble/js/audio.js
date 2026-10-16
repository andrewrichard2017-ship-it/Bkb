// Bubble Odyssey sound. Everything is synthesised with Web Audio (no sample files): pops that climb in pitch
// through a combo, bounces, drops, ice, bombs, lightning, the Blips' happy squeak, fanfares, and a little
// looping tune for each world. Every public function is a safe no-op until init() runs (it needs a tap/key).
(() => {
  'use strict';
  const BB = window.BB;
  let ctx = null, master, sfxBus, musicBus, delayIn, noiseBuf;
  const mtof = m => 440 * Math.pow(2, (m - 69) / 12);
  const A = BB.audio = { ready: false };

  function env(g, t, dur, vol, a = 0.004) { g.setValueAtTime(0.0001, t); g.linearRampToValueAtTime(vol, t + a); g.exponentialRampToValueAtTime(0.0001, t + Math.max(dur, a + 0.01)); }
  function tone(dest, t, type, f, dur, vol, o = {}) {
    const s = ctx.createOscillator(), g = ctx.createGain();
    s.type = type; s.frequency.setValueAtTime(f, t);
    if (o.to) s.frequency.exponentialRampToValueAtTime(o.to, t + (o.gt || dur));
    if (o.det) s.detune.value = o.det;
    let out = s;
    if (o.lp) { const fl = ctx.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.setValueAtTime(o.lp, t); if (o.lpTo) fl.frequency.exponentialRampToValueAtTime(o.lpTo, t + dur); fl.Q.value = o.q || 0.7; s.connect(fl); out = fl; }
    env(g.gain, t, dur, vol, o.a);
    out.connect(g); g.connect(dest);
    if (o.send && delayIn) { const sg = ctx.createGain(); sg.gain.value = o.send; g.connect(sg); sg.connect(delayIn); }
    s.start(t); s.stop(t + dur + 0.05);
  }
  function noise(dest, t, dur, vol, type, f, o = {}) {
    const s = ctx.createBufferSource(), fl = ctx.createBiquadFilter(), g = ctx.createGain();
    s.buffer = noiseBuf; fl.type = type; fl.frequency.setValueAtTime(f, t); fl.Q.value = o.q || 1;
    if (o.to) fl.frequency.exponentialRampToValueAtTime(o.to, t + dur);
    env(g.gain, t, dur, vol, o.a || 0.003);
    s.connect(fl); fl.connect(g); g.connect(dest);
    s.start(t, Math.random() * 1.5); s.stop(t + dur + 0.05);
  }

  A.init = () => {
    if (ctx) { if (ctx.state !== 'running' && !document.hidden) ctx.resume().catch(() => {}); return; }
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
    try { ctx = new AC({ latencyHint: 'interactive' }); } catch (e) { try { ctx = new AC(); } catch (e2) { return; } }
    const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -12; comp.ratio.value = 4; comp.attack.value = 0.003; comp.release.value = 0.2;
    master = ctx.createGain(); comp.connect(master); master.connect(ctx.destination);
    sfxBus = ctx.createGain(); musicBus = ctx.createGain(); sfxBus.connect(comp); musicBus.connect(comp);
    // a soft echo for sparkles and the melody
    delayIn = ctx.createGain(); const dl = ctx.createDelay(1), fb = ctx.createGain(), dlf = ctx.createBiquadFilter();
    dl.delayTime.value = 0.27; fb.gain.value = 0.32; dlf.type = 'lowpass'; dlf.frequency.value = 2600;
    delayIn.connect(dl); dl.connect(dlf); dlf.connect(fb); fb.connect(dl); dlf.connect(comp);
    const len = ctx.sampleRate * 2; noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0); for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    const b = ctx.createBufferSource(); b.buffer = ctx.createBuffer(1, 1, ctx.sampleRate); b.connect(ctx.destination); b.start(0);
    document.addEventListener('visibilitychange', () => { if (ctx) (document.hidden ? ctx.suspend() : ctx.resume()).catch(() => {}); });
    A.ready = true; A.levels();
    if (song) startSong();
  };
  A.levels = () => {
    if (!ctx) return;
    const S = BB.settings;
    sfxBus.gain.setTargetAtTime(S.volume, ctx.currentTime, 0.05);
    musicBus.gain.setTargetAtTime(S.music ? S.musicVolume * 0.42 : 0, ctx.currentTime, 0.1);
  };

  // ---- effects ----
  const SFX = {
    shoot(t) { noise(sfxBus, t, 0.16, 0.25, 'bandpass', 700, { to: 2600, q: 1.4 }); tone(sfxBus, t, 'triangle', 330, 0.09, 0.18, { to: 520 }); },
    bounce(t) { tone(sfxBus, t, 'sine', 1300, 0.05, 0.12, { to: 900 }); },
    stick(t) { tone(sfxBus, t, 'sine', 240, 0.08, 0.3, { to: 150 }); noise(sfxBus, t, 0.03, 0.1, 'highpass', 3000); },
    pop(t, o) {
      const n = Math.min(o.n || 3, 10), base = 72 + Math.min(o.combo || 0, 8) * 2;
      for (let i = 0; i < n; i++) { const tt = t + i * 0.035, f = mtof(base + [0, 4, 7, 12, 16, 19, 24, 28, 31, 36][i]); tone(sfxBus, tt, 'sine', f * 1.6, 0.08, 0.22, { to: f * 0.7 }); noise(sfxBus, tt, 0.02, 0.07, 'highpass', 5000); }
    },
    drop(t, o) { const n = Math.min(o.n || 3, 8); for (let i = 0; i < n; i++) tone(sfxBus, t + 0.12 + i * 0.05 + Math.random() * 0.03, 'triangle', mtof(84 - i * 2 + Math.random() * 3), 0.12, 0.12, { to: mtof(70 - i * 2), send: 0.2 }); },
    crack(t) { noise(sfxBus, t, 0.12, 0.3, 'highpass', 2500); tone(sfxBus, t, 'square', 1800, 0.05, 0.06, { to: 2600 }); },
    boom(t) { noise(sfxBus, t, 0.7, 0.6, 'lowpass', 1400, { to: 90 }); tone(sfxBus, t, 'sine', 110, 0.5, 0.6, { to: 38 }); },
    zap(t) { tone(sfxBus, t, 'sawtooth', 1600, 0.35, 0.16, { to: 120, lp: 4000 }); noise(sfxBus, t, 0.3, 0.2, 'bandpass', 3000, { to: 600, q: 3 }); },
    fire(t) { noise(sfxBus, t, 0.6, 0.35, 'bandpass', 400, { to: 1600, q: 0.8, a: 0.05 }); tone(sfxBus, t, 'sawtooth', 90, 0.5, 0.12, { to: 160, lp: 600 }); },
    rainbow(t) { [72, 76, 79, 84, 88].forEach((m, i) => tone(sfxBus, t + i * 0.05, 'sine', mtof(m), 0.25, 0.14, { send: 0.4 })); },
    fever(t) { [67, 71, 74, 79, 83, 86, 91].forEach((m, i) => tone(sfxBus, t + i * 0.06, 'triangle', mtof(m), 0.3, 0.16, { send: 0.5 })); noise(sfxBus, t, 0.6, 0.08, 'highpass', 6000, { a: 0.2 }); },
    combo(t, o) { const m = 79 + Math.min(o.n || 2, 8) * 2; tone(sfxBus, t, 'sine', mtof(m), 0.35, 0.18, { send: 0.4 }); tone(sfxBus, t + 0.07, 'sine', mtof(m + 7), 0.35, 0.14, { send: 0.4 }); },
    free(t) { tone(sfxBus, t, 'sine', 700, 0.28, 0.2, { to: 1500, gt: 0.2 }); tone(sfxBus, t + 0.18, 'sine', 1300, 0.18, 0.14, { to: 1900 }); },
    swap(t) { tone(sfxBus, t, 'sine', 660, 0.06, 0.15); tone(sfxBus, t + 0.05, 'sine', 880, 0.06, 0.15); },
    push(t) { tone(sfxBus, t, 'sine', 90, 0.35, 0.45, { to: 55 }); noise(sfxBus, t, 0.25, 0.15, 'lowpass', 500); },
    warn(t) { tone(sfxBus, t, 'square', 880, 0.08, 0.08, { lp: 2500 }); tone(sfxBus, t + 0.14, 'square', 880, 0.08, 0.08, { lp: 2500 }); },
    win(t) { [60, 64, 67, 72, 76, 79, 84].forEach((m, i) => tone(sfxBus, t + i * 0.08, 'triangle', mtof(m), 0.4, 0.2, { send: 0.3 })); [72, 76, 79].forEach(m => tone(sfxBus, t + 0.6, 'sine', mtof(m), 1.2, 0.12, { send: 0.3 })); },
    lose(t) { [67, 66, 65, 62].forEach((m, i) => tone(sfxBus, t + i * 0.28, 'triangle', mtof(m), i === 3 ? 0.9 : 0.3, 0.2, { to: i === 3 ? mtof(58) : undefined, lp: 1800 })); },
    star(t, o) { const m = 84 + (o.n || 0) * 3; tone(sfxBus, t, 'sine', mtof(m), 0.6, 0.25, { send: 0.5 }); tone(sfxBus, t, 'triangle', mtof(m + 12), 0.3, 0.08); },
    coin(t) { tone(sfxBus, t, 'square', mtof(88), 0.07, 0.08, { lp: 5000 }); tone(sfxBus, t + 0.07, 'square', mtof(95), 0.25, 0.08, { lp: 5000 }); },
    bonus(t) { tone(sfxBus, t, 'sine', mtof(84 + Math.floor(Math.random() * 5) * 2), 0.1, 0.12, { send: 0.3 }); },
    bossHit(t) { tone(sfxBus, t, 'square', 160, 0.18, 0.12, { to: 90, lp: 900 }); },
    roar(t) { tone(sfxBus, t, 'sawtooth', 80, 0.7, 0.22, { to: 55, lp: 700 }); noise(sfxBus, t, 0.6, 0.2, 'bandpass', 300, { q: 2 }); },
    select(t) { tone(sfxBus, t, 'sine', 900, 0.05, 0.1); },
    confirm(t) { tone(sfxBus, t, 'sine', 660, 0.07, 0.14); tone(sfxBus, t + 0.06, 'sine', 990, 0.1, 0.14); },
    back(t) { tone(sfxBus, t, 'sine', 600, 0.07, 0.12, { to: 400 }); },
  };
  A.sfx = (name, o = {}) => { if (!ctx || !SFX[name]) return; try { SFX[name](ctx.currentTime + (o.delay || 0), o); } catch (e) { /* ignore */ } };

  // ---- music: a four-bar loop per world (chords, bass, an arpeggio, light drums) ----
  const SONGS = {
    title: { bpm: 100, root: 55, chords: [[0, 4, 7], [-3, 0, 4], [-7, -3, 0], [-5, -1, 2]], arp: [0, 1, 2, 1, 2, 3, 2, 1], wave: 'triangle' },
    meadow: { bpm: 112, root: 60, chords: [[0, 4, 7], [7, 11, 14], [9, 12, 16], [5, 9, 12]], arp: [0, 1, 2, 3, 2, 1, 2, 1], wave: 'triangle' },
    reef: { bpm: 94, root: 57, chords: [[0, 3, 7], [-4, 0, 3], [3, 7, 10], [-2, 2, 5]], arp: [0, 2, 1, 3, 2, 1, 0, 2], wave: 'sine' },
    candy: { bpm: 126, root: 65, chords: [[0, 4, 7], [-3, 0, 4], [-7, -3, 0], [-5, -1, 2]], arp: [0, 2, 1, 2, 3, 2, 1, 2], wave: 'square' },
    caves: { bpm: 88, root: 50, chords: [[0, 3, 7], [-4, 0, 3], [-7, -4, 0], [-5, -1, 2]], arp: [0, 1, 2, 1, 3, 2, 1, 0], wave: 'sine' },
    nebula: { bpm: 100, root: 52, chords: [[0, 3, 7], [-4, 0, 3], [3, 7, 10], [-2, 2, 5]], arp: [0, 2, 3, 2, 1, 2, 3, 1], wave: 'triangle' },
  };
  let song = null, timer = null, nextT = 0, step = 0;
  function startSong() {
    clearInterval(timer);
    if (!ctx || !song) return;
    nextT = ctx.currentTime + 0.1; step = 0;
    timer = setInterval(schedule, 50);
  }
  function schedule() {
    if (!ctx || !song || ctx.state !== 'running') return;
    const S = SONGS[song], st = 60 / S.bpm / 4;
    while (nextT < ctx.currentTime + 0.25) {
      const bar = Math.floor(step / 16) % 4, s16 = step % 16, ch = S.chords[bar], t = nextT;
      if (s16 === 0) for (const n of ch) tone(musicBus, t, 'sine', mtof(S.root + n), st * 15, 0.045, { a: 0.3, lp: 1200 });
      if (s16 === 0 || s16 === 8 || s16 === 11) tone(musicBus, t, 'triangle', mtof(S.root - 12 + ch[0] - (ch[0] > 4 ? 12 : 0)), st * 3, 0.16, { lp: 600 });
      if (s16 % 2 === 0) { const i = S.arp[(s16 / 2) % 8], n = i < 3 ? ch[i] : ch[0] + 12; tone(musicBus, t, S.wave, mtof(S.root + 12 + n), st * 1.6, S.wave === 'square' ? 0.025 : 0.05, { lp: 2800, send: 0.35 }); }
      if (s16 === 0 || s16 === 8) tone(musicBus, t, 'sine', 120, 0.14, 0.22, { to: 45 });
      if (s16 % 4 === 2) noise(musicBus, t, 0.04, 0.05, 'highpass', 7000);
      if (s16 === 4 || s16 === 12) noise(musicBus, t, 0.09, 0.05, 'bandpass', 1800, { q: 0.8 });
      nextT += st; step++;
    }
  }
  A.music = id => { if (id === song) return; song = SONGS[id] ? id : null; if (ctx) { if (song) startSong(); else clearInterval(timer); } };
})();
