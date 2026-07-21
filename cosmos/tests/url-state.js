// URL-state round-trip check: nudge the camera, let persistState encode it
// into the hash, then reload and confirm the state is applied back.
// Usage: node tests/url-state.js [port]
const path = require('path');
const { chromium } = require(path.join(process.env.NODE_GYP_ROOT || 'C:/nvm4w/nodejs/node_modules/omniroute/node_modules', 'playwright'));

(async () => {
  const port = process.argv[2] || 8801;
  const browser = await chromium.launch({
    args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--disable-gpu-sandbox']
  });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  // Disable browser cache: the dev server sends no cache headers and Chromium
  // would otherwise heuristic-cache ES modules and serve stale code.
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Network.setCacheDisabled', { cacheDisabled: true });
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));

  let failed = false;
  for (const route of ['solar', 'galaxy', 'blackhole']) {
    await page.goto(`http://127.0.0.1:${port}/index.html#/${route}`, { waitUntil: 'load', timeout: 30000 });
    await page.waitForSelector('body[data-ready="1"]', { timeout: 40000 });
    const before = await page.evaluate(() => {
      const s = window.cosmos.scene;
      const cam = (s.camera || (s.getState && s.getState().cam)) ? true : false;
      return { hasGetState: !!(s && s.getState), cam };
    });
    // move the camera inward (stays inside zoom clamps for every scene)
    // and fire the persist trigger
    const moved = await page.evaluate(() => {
      const s = window.cosmos.scene;
      if (!s.camera) return null;
      s.camera.position.sub(s.controls ? s.controls.target : { x: 0, y: 0, z: 0 }).multiplyScalar(0.87)
        .add(s.controls ? s.controls.target : { x: 0, y: 0, z: 0 });
      if (s.controls) { s.controls.update && s.controls.update(); s.controls.dispatchEvent({ type: 'end' }); }
      return s.camera.position.toArray();
    });
    await page.waitForTimeout(700); // persistState is throttled (300ms)
    const hash = await page.evaluate(() => location.hash);
    const encoded = hash.includes('?s=');
    if (!encoded) { failed = true; console.log(`FAIL ${route}: state not persisted. hash=${hash}`); continue; }
    // force a REAL reload (a goto to the same URL is a no-op) with the encoded hash
    await page.goto('about:blank');
    await page.goto(`http://127.0.0.1:${port}/index.html${hash}`, { waitUntil: 'load', timeout: 30000 });
    await page.waitForSelector('body[data-ready="1"]', { timeout: 40000 });
    const applied = await page.evaluate(exp => {
      const s = window.cosmos.scene;
      if (!s || !s.camera) return false;
      const p = s.camera.position;
      const dist = Math.hypot(p.x - exp[0], p.y - exp[1], p.z - exp[2]);
      return dist < 0.05 * Math.hypot(exp[0], exp[1], exp[2]) + 0.01;
    }, moved);
    console.log(`${encoded && applied ? 'ok  ' : 'FAIL'} ${route}: persisted=${encoded} restored=${applied} meta=${JSON.stringify(before)}`);
    if (!applied) failed = true;
  }
  if (errors.length) { failed = true; console.log('pageErrors:', errors.slice(0, 5)); }
  await browser.close();
  console.log(failed ? 'URL-STATE: FAILED' : 'URL-STATE: PASSED');
  process.exit(failed ? 1 : 0);
})();
