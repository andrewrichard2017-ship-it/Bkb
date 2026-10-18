// Records a smooth gameplay video of any of the games for store listings (CrazyGames preview videos).
// The page runs on a fake clock: every frame the clock moves on exactly 1/30 s, the game draws, and the
// frame is screenshotted, so the video is smooth however slow the machine (or software WebGL) is.
// A driver script plays the game: it runs in the page after load and can set
//   window.__rec.setup = async () => {...}   once, before recording (start a level, skip menus)
//   window.__rec.tick = t => {...}            before every frame (t = seconds since recording began)
//   window.__rec.warm = 1.5                   seconds to run before the first recorded frame
// window.__step(ms) moves the fake clock on; await window.__sleep(ms) waits real time (for loads).
// Usage (serve the repo first: python3 -m http.server 8123):
//   node tools/record.js --url=bubble/ --driver=bubble/tools/rec-driver.js --w=1920 --h=1080 --secs=20 --out=bubble/promo/preview-landscape.mp4
// --upscale=1920x1080 renders at --w/--h and scales the video up (for the 3D games, which are slow without a GPU).
// Needs Playwright (npm i -g playwright) and ffmpeg.
const fs = require('fs'), path = require('path'), os = require('os'), { execFileSync } = require('child_process');
const { chromium } = require('playwright');

const arg = (k, d) => { const a = process.argv.find(x => x.startsWith(`--${k}=`)); return a ? a.slice(k.length + 3) : d; };
const url = `http://127.0.0.1:${arg('port', '8123')}/${arg('url', '')}`;
const W = +arg('w', 1920), H = +arg('h', 1080), secs = +arg('secs', 20), FPS = 30;
const out = path.resolve(arg('out', 'preview.mp4')), driver = fs.readFileSync(arg('driver'), 'utf8');
const upscale = arg('upscale', '');                  // e.g. 1920x1080: render smaller (3D is slow in software), scale up at the end

// the fake clock: requestAnimationFrame, timers, performance.now and Date.now all follow window.__step()
const CLOCK = `(() => {
  let now = 0, id = 0; const t0 = Date.now(), raf = new Map(), timers = new Map(), realTimeout = window.setTimeout.bind(window);
  window.__sleep = ms => new Promise(res => realTimeout(res, ms));   // real time, for drivers waiting on loads
  window.requestAnimationFrame = cb => { raf.set(++id, cb); return id; };
  window.cancelAnimationFrame = i => raf.delete(i);
  const add = (fn, ms, args, every) => { timers.set(++id, { fn, at: now + Math.max(0, +ms || 0), args, every: every ? Math.max(1, +ms || 0) : 0 }); return id; };
  window.setTimeout = (fn, ms, ...args) => add(fn, ms, args, false);
  window.setInterval = (fn, ms, ...args) => add(fn, ms, args, true);
  window.clearTimeout = window.clearInterval = i => timers.delete(i);
  performance.now = () => now;
  Date.now = () => t0 + now;
  window.__rec = { warm: 1, setup: null, tick: null };
  window.__step = ms => {
    now += ms;
    for (const [i, t] of [...timers].sort((a, b) => a[1].at - b[1].at)) {
      if (t.at > now) continue;
      if (t.every) t.at += t.every * Math.max(1, Math.ceil((now - t.at) / t.every)); else timers.delete(i);
      try { typeof t.fn === 'function' ? t.fn(...t.args) : eval(t.fn); } catch (e) { console.error(e); }
    }
    const cbs = [...raf.values()]; raf.clear();
    for (const cb of cbs) try { cb(now); } catch (e) { console.error(e); }
  };
})();`;

(async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rec-'));
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] });
  const page = await browser.newPage({ viewport: { width: W, height: H } });
  page.on('pageerror', e => console.error('page:', e.message));
  await page.addInitScript(CLOCK);
  await page.goto(url, { waitUntil: 'load' });
  for (let i = 0; i < 10; i++) await page.evaluate(() => window.__step(1000 / 30));
  await page.evaluate(driver);
  await page.evaluate(async () => { if (window.__rec.setup) await window.__rec.setup(); });
  const step = 1000 / FPS, warm = await page.evaluate(() => window.__rec.warm || 0);
  for (let i = 0; i < warm * FPS; i++) await page.evaluate(ms => { if (window.__rec.tick) window.__rec.tick(-1); window.__step(ms); }, step);
  const frames = Math.round(secs * FPS);
  for (let f = 0; f < frames; f++) {
    await page.evaluate(([ms, t]) => { if (window.__rec.tick) window.__rec.tick(t); window.__step(ms); }, [step, f / FPS]);
    await page.screenshot({ path: path.join(dir, `${String(f).padStart(5, '0')}.jpg`), type: 'jpeg', quality: 92, timeout: 0 });   // software 3D can take a while
    if (f % 60 === 0) process.stdout.write(`\rframe ${f}/${frames}`);
  }
  await browser.close();
  fs.mkdirSync(path.dirname(out), { recursive: true });
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', String(FPS), '-i', path.join(dir, '%05d.jpg'), ...(upscale ? ['-vf', `scale=${upscale.replace('x', ':')}:flags=lanczos`] : []), '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '20', '-preset', 'slow', '-movflags', '+faststart', path.join(dir, 'out.mp4')]);
  fs.copyFileSync(path.join(dir, 'out.mp4'), out);   // only a finished video lands in the repo
  fs.rmSync(dir, { recursive: true, force: true });
  console.log(`\r${path.relative(process.cwd(), out)}  ${(fs.statSync(out).size / 1e6).toFixed(1)} MB`);
})();
