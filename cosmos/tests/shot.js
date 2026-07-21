// Headless smoke screenshot for the COSMOS app.
// Usage: node tests/shot.js <route> <outfile> [waitMs] [evalJs] [port]
//   route   solar | galaxy | blackhole
//   evalJs  runs in-page after readiness (e.g. camera repositioning)
// Requires the cosmos/ directory served over HTTP (default port 8801):
//   python -m http.server 8801 -d cosmos
const path = require('path');
const { chromium } = require(path.join(process.env.NODE_GYP_ROOT || 'C:/nvm4w/nodejs/node_modules/omniroute/node_modules', 'playwright'));

(async () => {
  const route = process.argv[2] || 'solar';
  const out = process.argv[3] || `.shot-${route}.png`;
  const waitMs = Number(process.argv[4] || 1500);
  const evalJs = process.argv[5];
  const port = process.argv[6] || 8801;

  const browser = await chromium.launch({
    args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--disable-gpu-sandbox']
  });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  // Disable browser cache: the dev server sends no cache headers and Chromium
  // would otherwise heuristic-cache ES modules and serve stale code.
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Network.setCacheDisabled', { cacheDisabled: true });
  const errors = [];
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', e => errors.push(String(e)));
  await page.goto(`http://127.0.0.1:${port}/index.html#/${route}`, { waitUntil: 'load', timeout: 30000 });
  let ready = true;
  try {
    await page.waitForSelector('body[data-ready="1"]', { timeout: 40000 });
  } catch (e) {
    ready = false;
    const err = await page.evaluate(() => window.__errors || []);
    console.log('NOT READY. __errors =', JSON.stringify(err));
  }
  if (evalJs) await page.evaluate(evalJs);
  await page.waitForTimeout(waitMs);
  await page.screenshot({ path: out });
  const stats = await page.evaluate(() => ({
    scene: document.body.getAttribute('data-scene'),
    ready: document.body.getAttribute('data-ready'),
    fps: document.getElementById('fps') && document.getElementById('fps').textContent,
    errs: window.__errors,
  }));
  console.log('stats:', JSON.stringify(stats), 'consoleErrors:', JSON.stringify(errors.slice(0, 5)));
  await browser.close();
  process.exit(ready ? 0 : 1);
})();
