// Headless smoke screenshot for the SINGULARITY page.
// Usage: node shot.js <outfile> [waitFrames] [evalJs]
const path = require('path');
const { chromium } = require(path.join(process.env.NODE_GYP_ROOT || 'C:/nvm4w/nodejs/node_modules/omniroute/node_modules', 'playwright'));

(async () => {
  const out = process.argv[2] || '.shot-current.png';
  const evalJs = process.argv[4];
  const browser = await chromium.launch({
    args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--disable-gpu-sandbox']
  });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errors = [];
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', e => errors.push(String(e)));
  await page.goto('http://127.0.0.1:8791/index.html', { waitUntil: 'load', timeout: 30000 });
  try {
    await page.waitForSelector('body[data-ready="1"]', { timeout: 30000 });
  } catch (e) {
    const err = await page.evaluate(() => window.__pcErrors || []);
    console.log('NOT READY. __pcErrors =', JSON.stringify(err));
  }
  if (evalJs) await page.evaluate(evalJs);
  await page.waitForTimeout(Number(process.argv[3] || 1500));
  await page.screenshot({ path: out });
  const stats = await page.evaluate(() => ({
    ready: document.body.getAttribute('data-ready'),
    fps: document.getElementById('fps') && document.getElementById('fps').textContent,
    errs: window.__pcErrors
  }));
  console.log('stats:', JSON.stringify(stats), 'consoleErrors:', JSON.stringify(errors.slice(0, 5)));
  await browser.close();
})();
