// Road Rumble: shared namespace, maths helpers, seeded noise, settings and the career save.
(() => {
  'use strict';
  const RR = window.RR = window.RR || {};

  RR.VERSION = 1;
  const clamp = (x, a, b) => x < a ? a : x > b ? b : x;
  const lerp = (a, b, t) => a + (b - a) * t;
  const M = RR.math = {
    clamp, lerp,
    smooth: t => t * t * (3 - 2 * t),
    // frame-rate independent approach of a to b (rate = 1/seconds)
    damp: (a, b, rate, dt) => lerp(a, b, 1 - Math.exp(-rate * dt)),
    wrapAngle: a => { while (a > Math.PI) a -= Math.PI * 2; while (a < -Math.PI) a += Math.PI * 2; return a; },
    sign: x => x < 0 ? -1 : 1,
  };

  // Seeded RNG (mulberry32) so both sides of an online race build the same track and traffic.
  RR.rng = seed => {
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

  // Value noise. hash2 is a cheap integer hash -> [0,1).
  const hash2 = (x, y, seed) => {
    let h = (x * 374761393 + y * 668265263 + seed * 2246822519) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  };
  const noise1 = (x, seed = 0) => {
    const i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f);
    return lerp(hash2(i, 0, seed), hash2(i + 1, 0, seed), u) * 2 - 1;
  };
  const noise2 = (x, y, seed = 0) => {
    const ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy;
    const ux = fx * fx * (3 - 2 * fx), uy = fy * fy * (3 - 2 * fy);
    const a = hash2(ix, iy, seed), b = hash2(ix + 1, iy, seed), c = hash2(ix, iy + 1, seed), d = hash2(ix + 1, iy + 1, seed);
    return lerp(lerp(a, b, ux), lerp(c, d, ux), uy) * 2 - 1;
  };
  RR.noise = {
    hash2, noise1, noise2,
    fbm1: (x, seed = 0, oct = 4) => { let s = 0, a = 0.5, f = 1, n = 0; for (let i = 0; i < oct; i++) { s += a * noise1(x * f, seed + i * 17); n += a; a *= 0.5; f *= 2.03; } return s / n; },
    fbm2: (x, y, seed = 0, oct = 4) => { let s = 0, a = 0.5, f = 1, n = 0; for (let i = 0; i < oct; i++) { s += a * noise2(x * f, y * f, seed + i * 31); n += a; a *= 0.5; f *= 2.03; } return s / n; },
  };

  // ---- settings (per device) ----
  const SETTINGS_KEY = 'roadrumble.settings';
  const defaults = { quality: 'auto', units: 'kmh', music: true, musicVolume: 0.55, volume: 0.85, vibrate: true, camera: 0, name: '' };
  RR.settings = Object.assign({}, defaults);
  try { Object.assign(RR.settings, JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}')); } catch (e) { /* private mode */ }
  RR.saveSettings = () => { try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(RR.settings)); } catch (e) { /* ignore */ } };

  // ---- career save ----
  const CAREER_KEY = 'roadrumble.career';
  const freshCareer = () => ({ money: 1000, level: 1, owned: ['rust'], bike: 'rust', qualified: {}, wins: 0, races: 0, knockoffs: 0, busted: 0 });
  RR.career = freshCareer();
  try { Object.assign(RR.career, JSON.parse(localStorage.getItem(CAREER_KEY) || '{}')); } catch (e) { /* ignore */ }
  RR.saveCareer = () => { try { localStorage.setItem(CAREER_KEY, JSON.stringify(RR.career)); } catch (e) { /* ignore */ } };
  RR.resetCareer = () => { RR.career = freshCareer(); RR.saveCareer(); };

  RR.fmtMoney = n => '$' + Math.round(n).toLocaleString('en-US');
  RR.fmtTime = t => { const m = Math.floor(t / 60), s = t - m * 60; return m + ':' + (s < 10 ? '0' : '') + s.toFixed(2); };
  RR.ordinal = n => n + (n % 100 >= 11 && n % 100 <= 13 ? 'th' : ['th', 'st', 'nd', 'rd'][n % 10] || 'th');
  RR.speedText = v => RR.settings.units === 'mph' ? Math.round(v * 2.23694) : Math.round(v * 3.6);
  RR.speedUnit = () => RR.settings.units === 'mph' ? 'MPH' : 'KM/H';
  RR.isTouch = matchMedia('(pointer: coarse)').matches;
  RR.isMobile = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
})();
