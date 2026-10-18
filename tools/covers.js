// Renders store covers (CrazyGames wants 1920×1080, 800×1200 and 800×800) for one game.
//   python3 -m http.server 8123      (from the repo root, in another terminal)
//   node tools/covers.js --game=bubble [--world=candy]
//       Bubble Odyssey's art is drawn from its own sprites by bubble/tools/cover.html.
//   node tools/covers.js --game=boxing --img=promo/art.jpg [--landscape=cx,cy,zoom] [--portrait=…] [--square=…]
//   node tools/covers.js --game=road --img=road/promo/art.jpg …
//       A clean game frame (record one with tools/record.js and a driver, HUD off) under the game's logo,
//       cropped around cx,cy (0-1 across the frame) and zoomed in by zoom, by tools/cover-art.html.
// Needs Playwright (npm i -g playwright).
const path = require('path'), fs = require('fs');
const { chromium } = require('playwright');

const arg = (k, d) => { const a = process.argv.find(x => x.startsWith(`--${k}=`)); return a ? a.slice(k.length + 3) : d; };
const game = arg('game', 'bubble'), port = arg('port', '8123');
const SIZES = [['landscape', 1920, 1080, '0.5,0.5,1'], ['portrait', 800, 1200, '0.5,0.5,1.25'], ['square', 800, 800, '0.5,0.5,1.1']];
const OUT = path.join(__dirname, '..', { bubble: 'bubble/promo', boxing: 'promo', road: 'road/promo' }[game]);

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch();
  for (const [name, w, h, crop] of SIZES) {
    const page = await browser.newPage({ viewport: { width: w, height: h } });
    page.on('pageerror', e => console.error(name, e.message));
    let url;
    if (game === 'bubble') url = `bubble/tools/cover.html?w=${w}&h=${h}&world=${arg('world', 'candy')}`;
    else {
      const [cx, cy, zoom] = arg(name, crop).split(',');
      url = `tools/cover-art.html?game=${game}&img=${encodeURIComponent('../' + arg('img'))}&w=${w}&h=${h}&cx=${cx}&cy=${cy}&zoom=${zoom}`;
    }
    await page.goto(`http://127.0.0.1:${port}/${url}`);
    await page.waitForSelector('body[data-ready="1"]', { timeout: 15000 });
    const file = path.join(OUT, `cover-${name}-${w}x${h}.png`);
    await page.screenshot({ path: file });
    console.log(path.relative(process.cwd(), file));
    await page.close();
  }
  await browser.close();
})();
