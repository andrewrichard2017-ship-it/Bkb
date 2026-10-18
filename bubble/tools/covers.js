// Renders the store covers from tools/cover.html into bubble/promo/ (CrazyGames wants all three sizes).
//   python3 -m http.server 8123      (from the repo root, in another terminal)
//   node bubble/tools/covers.js      (needs Playwright: npm i -g playwright)
// Options: --world=candy (meadow, reef, candy, caves, nebula), --port=8123
const path = require('path');
const { chromium } = require('playwright');

const arg = (k, d) => (process.argv.find(a => a.startsWith(`--${k}=`)) || '').split('=')[1] || d;
const world = arg('world', 'candy'), port = arg('port', '8123');
const SIZES = [['landscape', 1920, 1080], ['portrait', 800, 1200], ['square', 800, 800]];
const OUT = path.join(__dirname, '..', 'promo');

(async () => {
  require('fs').mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch();
  for (const [name, w, h] of SIZES) {
    const page = await browser.newPage({ viewport: { width: w, height: h } });
    page.on('pageerror', e => console.error(name, e.message));
    await page.goto(`http://127.0.0.1:${port}/bubble/tools/cover.html?w=${w}&h=${h}&world=${world}`);
    await page.waitForSelector('body[data-ready="1"]', { timeout: 15000 });
    const file = path.join(OUT, `cover-${name}-${w}x${h}.png`);
    await page.screenshot({ path: file });
    console.log(path.relative(process.cwd(), file));
    await page.close();
  }
  await browser.close();
})();
