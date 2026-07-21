// Full integration smoke test: loads the app once, then cycles through every
// route in one page session — this exercises the scene dispose/re-activate
// path that single-route shots cannot reach.
// Usage: node tests/smoke.js [port] [outDir]
// Requires cosmos/ served over HTTP: python -m http.server 8801 --directory cosmos
const path = require('path');
const fs = require('fs');
const { chromium } = require(path.join(process.env.NODE_GYP_ROOT || 'C:/nvm4w/nodejs/node_modules/omniroute/node_modules', 'playwright'));

const ROUTES = ['solar', 'galaxy', 'blackhole'];

(async () => {
  const port = process.argv[2] || 8801;
  const outDir = process.argv[3] || __dirname;
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

  let failed = false;
  // Visit each route twice in sequence: A→B→C→A exercises swap + dispose.
  const sequence = [...ROUTES, ...ROUTES];
  for (let i = 0; i < sequence.length; i++) {
    const route = sequence[i];
    await page.goto(`http://127.0.0.1:${port}/index.html#/${route}`, { waitUntil: 'load', timeout: 30000 });
    if (i > 0) {
      // simulate in-app navigation instead of full reload for half the steps
      if (i % 2 === 1) await page.evaluate(r => window.cosmos.goto(r), route);
    }
    try {
      // Match BOTH the target scene and readiness — data-ready alone can be
      // a stale "1" left over from the previous scene.
      await page.waitForFunction(
        r => document.body.dataset.scene === r && document.body.dataset.ready === '1',
        route,
        { timeout: 40000 }
      );
    } catch {
      failed = true;
      console.log(`FAIL ${route}: never became ready`);
    }
    await page.waitForTimeout(1200);
    const stats = await page.evaluate(() => ({
      scene: document.body.getAttribute('data-scene'),
      ready: document.body.getAttribute('data-ready'),
      fps: document.getElementById('fps') && document.getElementById('fps').textContent,
      hash: location.hash.slice(0, 40),
      errs: window.__errors,
    }));
    if (stats.scene !== route) { failed = true; console.log(`FAIL ${route}: data-scene=${stats.scene}`); }
    if (stats.errs && stats.errs.length) { failed = true; console.log(`FAIL ${route}: __errors=`, stats.errs); }
    const shot = path.join(outDir, `.smoke-${route}.png`);
    await page.screenshot({ path: shot });
    console.log(`ok   ${route} (${i >= ROUTES.length ? 'revisit' : 'first'})`, JSON.stringify(stats));
  }

  if (errors.length) {
    failed = true;
    console.log('consoleErrors:', JSON.stringify(errors.slice(0, 10)));
  }
  await browser.close();
  console.log(failed ? 'SMOKE: FAILED' : 'SMOKE: PASSED');
  process.exit(failed ? 1 : 0);
})();
