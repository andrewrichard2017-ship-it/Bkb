// Bubble Odyssey: shared namespace, maths helpers, seeded random numbers, settings and the save.
(() => {
  'use strict';
  const BB = window.BB = window.BB || {};

  const clamp = (x, a, b) => x < a ? a : x > b ? b : x;
  const lerp = (a, b, t) => a + (b - a) * t;
  BB.math = {
    clamp, lerp,
    smooth: t => t * t * (3 - 2 * t),
    damp: (a, b, rate, dt) => lerp(a, b, 1 - Math.exp(-rate * dt)),
    easeOutBack: t => { const c = 1.70158; t -= 1; return 1 + (c + 1) * t * t * t + c * t * t; },
    easeOut: t => 1 - (1 - t) * (1 - t),
  };

  // Seeded RNG (mulberry32): a level always builds the same board from its seed.
  BB.rng = seed => {
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
    r.shuffle = arr => { for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; } return arr; };
    return r;
  };

  const store = (() => { try { return window.localStorage || null; } catch (e) { return null; } })();
  const load = (k, d) => { try { return Object.assign(d, JSON.parse((store && store.getItem(k)) || '{}')); } catch (e) { return d; } };
  const keep = (k, v) => { try { if (store) store.setItem(k, JSON.stringify(v)); } catch (e) { /* private mode */ } };

  // ---- settings (per device) ----
  const SETTINGS_KEY = 'bubbleodyssey.settings';
  BB.settings = load(SETTINGS_KEY, { music: true, musicVolume: 0.5, volume: 0.85, vibrate: true, symbols: false, guide: 'normal', name: '' });
  BB.saveSettings = () => keep(SETTINGS_KEY, BB.settings);

  // ---- progress: stars and best scores per level (solo and co-op), coins, power-ups, endless bests ----
  const SAVE_KEY = 'bubbleodyssey.save';
  const fresh = () => ({ stars: {}, best: {}, coop: {}, coopBest: {}, coins: 150, inv: { bomb: 2, fire: 1, rainbow: 2, zap: 1, aim: 1, plus5: 1 }, endless: 0, endlessCoop: 0, seenHelp: {} });
  BB.save = load(SAVE_KEY, fresh());
  BB.save.inv = Object.assign(fresh().inv, BB.save.inv);
  BB.saveProgress = () => keep(SAVE_KEY, BB.save);
  BB.resetProgress = () => { BB.save = fresh(); BB.saveProgress(); };

  BB.isTouch = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;
  BB.isMobile = typeof navigator !== 'undefined' && /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
  BB.fmt = n => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
})();
