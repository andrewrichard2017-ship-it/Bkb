// Tractor Tippin': shared namespace, maths helpers, seeded random numbers and noise, settings and the save.
(() => {
  'use strict';
  const TT = window.TT = window.TT || {};

  const clamp = (x, a, b) => x < a ? a : x > b ? b : x;
  const lerp = (a, b, t) => a + (b - a) * t;
  const wrapAngle = a => { while (a > Math.PI) a -= Math.PI * 2; while (a < -Math.PI) a += Math.PI * 2; return a; };
  TT.math = {
    clamp, lerp, wrapAngle,
    smooth: t => t * t * (3 - 2 * t),
    // frame-rate independent approach of a to b (rate = 1/seconds)
    damp: (a, b, rate, dt) => lerp(a, b, 1 - Math.exp(-rate * dt)),
    dampAngle: (a, b, rate, dt) => a + wrapAngle(b - a) * (1 - Math.exp(-rate * dt)),
    sign: x => x < 0 ? -1 : 1,
  };

  // Seeded RNG (mulberry32): both machines in an online game build the same farm from the same seed.
  TT.rng = seed => {
    let a = (seed >>> 0) || 1;
    const r = () => {
      a = (a + 0x6D2B79F5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    r.range = (lo, hi) => lo + (hi - lo) * r();
    r.int = (lo, hi) => Math.floor(lo + (hi - lo + 1) * r());
    r.pick = arr => arr[Math.floor(r() * arr.length)];
    r.chance = p => r() < p;
    return r;
  };

  // Value noise for the rolling ground.
  const hash2 = (x, y, seed) => {
    let h = (x * 374761393 + y * 668265263 + seed * 2246822519) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  };
  const noise2 = (x, y, seed = 0) => {
    const ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy;
    const ux = fx * fx * (3 - 2 * fx), uy = fy * fy * (3 - 2 * fy);
    const a = hash2(ix, iy, seed), b = hash2(ix + 1, iy, seed), c = hash2(ix, iy + 1, seed), d = hash2(ix + 1, iy + 1, seed);
    return lerp(lerp(a, b, ux), lerp(c, d, ux), uy) * 2 - 1;
  };
  TT.noise = {
    hash2, noise2,
    fbm2: (x, y, seed = 0, oct = 4) => { let s = 0, a = 0.5, f = 1, n = 0; for (let i = 0; i < oct; i++) { s += a * noise2(x * f, y * f, seed + i * 31); n += a; a *= 0.5; f *= 2.03; } return s / n; },
  };

  // ---- settings (per device) ----
  const SETTINGS_KEY = 'tractortippin.settings';
  const defaults = { quality: 'auto', music: true, musicVolume: 0.5, volume: 0.85, vibrate: true, camera: 0, name: '', car: 'rusty', car2: 'dash' };
  TT.settings = Object.assign({}, defaults);
  try { Object.assign(TT.settings, JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}')); } catch (e) { /* private mode */ }
  TT.saveSettings = () => { try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(TT.settings)); } catch (e) { /* ignore */ } };

  // ---- progress: stars per level, best Tip-Off score ----
  const SAVE_KEY = 'tractortippin.save';
  const fresh = () => ({ stars: {}, best: {}, tipoff: 0 });
  TT.save = fresh();
  try { Object.assign(TT.save, JSON.parse(localStorage.getItem(SAVE_KEY) || '{}')); } catch (e) { /* ignore */ }
  TT.saveProgress = () => { try { localStorage.setItem(SAVE_KEY, JSON.stringify(TT.save)); } catch (e) { /* ignore */ } };
  TT.resetProgress = () => { TT.save = fresh(); TT.saveProgress(); };

  TT.fmtTime = t => { t = Math.max(0, t); const m = Math.floor(t / 60), s = Math.floor(t - m * 60); return m + ':' + (s < 10 ? '0' : '') + s; };
  TT.isTouch = matchMedia('(pointer: coarse)').matches;
  TT.isMobile = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
  TT.isOctober = new Date().getMonth() === 9;
})();
