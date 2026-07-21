// COSMOS shell: hash router + scene manager + warp transitions + intro
// overview + error/readiness contract.
//
// Routes:  #/blackhole  #/galaxy  #/solar  (default: #/solar)
// URL state: a scene may persist serializable state via ctx.persistState(),
// encoded as  #/<route>?s=<base64url JSON>  and handed back as ctx.initialState.
// In-scene hotspots call ctx.navigate(route) for the scale-warp transition.
//
// Machine-readable contract (used by tests/shot.js):
//   window.__errors           array of runtime errors
//   body[data-scene]          current route id
//   body[data-ready]          "1" once the scene reported ready and 45 frames passed
//   #fallback.show[data-error] fatal error overlay

import { Stage } from './core/stage.js';
import { QualityGovernor } from './core/quality.js';
import { audio } from './core/audio.js';
import { initHud } from './ui/hud.js';
import { playWarp } from './ui/warp.js';

window.__errors = [];
function trapError(message) {
  window.__errors.push(String(message));
  const fb = document.getElementById('fallback');
  fb.classList.add('show');
  fb.dataset.error = '1';
  document.getElementById('fallback-detail').textContent = window.__errors.join('\n\n');
}
window.addEventListener('error', e => trapError(e.error && e.error.stack || e.message));
window.addEventListener('unhandledrejection', e => trapError(e.reason && e.reason.stack || e.reason));

const ROUTES = {
  blackhole: () => import('./scenes/blackhole/index.js'),
  galaxy: () => import('./scenes/galaxy/index.js'),
  solar: () => import('./scenes/solar/index.js'),
};
const ROUTE_NAMES = { blackhole: '黑洞', galaxy: '银河系', solar: '太阳系' };
const DEFAULT_ROUTE = 'solar';

const stage = new Stage(document.getElementById('stage'));
const governor = new QualityGovernor(stage, document.getElementById('quality'));
const hud = initHud({ onQualitySample: fps => governor.sample(fps) });
stage.onFps = fps => hud.setFps(fps);

const hudRoot = document.getElementById('scene-hud');
const fade = document.getElementById('fade');
const loading = document.getElementById('loading');
const intro = document.getElementById('intro');

let current = null;        // active scene instance
let currentRoute = null;
let readyFrames = 0;
let sceneReady = false;
let swapToken = 0;
let warping = false;

/* ---------- Intro overview: auto-dismiss once the first scene is ready
   and at least ~3s of the scale animation has played; click skips. ------ */
const introStart = performance.now();
let introDone = false;
function dismissIntro() {
  if (introDone) return;
  introDone = true;
  intro.classList.add('hide');
  setTimeout(() => intro.remove(), 900);
}
intro.addEventListener('pointerdown', dismissIntro);
function maybeDismissIntro() {
  const elapsedMs = performance.now() - introStart;
  const remaining = Math.max(0, 3000 - elapsedMs);
  setTimeout(dismissIntro, remaining);
}

function parseHash() {
  const raw = location.hash.replace(/^#\/?/, '');
  const [path, query] = raw.split('?');
  const route = ROUTES[path] ? path : DEFAULT_ROUTE;
  let state = null;
  if (query) {
    const m = query.match(/(?:^|&)s=([^&]*)/);
    if (m) {
      try { state = JSON.parse(decodeURIComponent(escape(atob(m[1])))); } catch { /* ignore */ }
    }
  }
  return { route, state };
}

let persistTimer = 0;
function persistState(route, state) {
  clearTimeout(persistTimer);
  persistTimer = setTimeout(() => {
    try {
      const encoded = btoa(unescape(encodeURIComponent(JSON.stringify(state))));
      history.replaceState(null, '', `#/${route}?s=${encoded}`);
    } catch { /* state not serializable — skip */ }
  }, 300);
}

function markFrame() {
  if (sceneReady && readyFrames < 45) {
    readyFrames++;
    if (readyFrames === 45) document.body.dataset.ready = '1';
  }
}

async function activate(route, state, { useFade = true, preloaded = null } = {}) {
  const token = ++swapToken;
  // Reset the readiness contract synchronously so observers never see the
  // previous scene's stale data-ready="1" mid-swap.
  document.body.dataset.ready = '0';
  sceneReady = false;
  readyFrames = 0;
  if (useFade) {
    fade.classList.add('on');
    await new Promise(r => setTimeout(r, 380)); // let the fade cover the swap
    if (token !== swapToken) return;
  }

  if (current) {
    try { current.dispose(); } catch (err) { console.warn('dispose failed', err); }
    current = null;
  }
  hudRoot.innerHTML = '';
  stage.setScene(null);

  try {
    const mod = await (preloaded || ROUTES[route]());
    if (token !== swapToken) return;
    const scene = await mod.createScene({
      renderer: stage.renderer,
      canvas: stage.canvas,
      width: stage.width,
      height: stage.height,
      pixelRatio: stage.pixelRatio,
      quality: governor.level,
      hud: hudRoot,
      initialState: state,
      persistState: s => persistState(route, s),
      navigate: target => warpTo(target),
      sfx: name => { if (name === 'warp') audio.whoosh(); else audio.blip(); },
      onReady: () => {
        if (token !== swapToken) return;
        sceneReady = true;
        loading.classList.add('hide');
        if (!introDone) maybeDismissIntro();
      },
    });
    if (token !== swapToken) { try { scene.dispose(); } catch { /* noop */ } return; }

    current = scene;
    currentRoute = route;
    governor.onLevelChange = level => { if (current && current.setQuality) current.setQuality(level); };
    if (scene.setQuality) scene.setQuality(governor.level);
    stage.setScene(scene);
    document.body.dataset.scene = route;
    hud.setActiveRoute(route);
    document.title = `COSMOS · ${ROUTE_NAMES[route]}`;
  } catch (err) {
    trapError(err && err.stack || err);
  } finally {
    if (token === swapToken && useFade) fade.classList.remove('on');
  }
}

// Scale-warp transition between scenes (streak tunnel + flash), with the
// target scene module preloaded while the tunnel plays.
function warpTo(route) {
  if (!ROUTES[route] || route === currentRoute || warping) return;
  warping = true;
  audio.whoosh();
  const preloaded = ROUTES[route](); // start fetching/parsing immediately
  history.replaceState(null, '', `#/${route}`);
  playWarp({
    onMidpoint: async () => {
      await activate(route, null, { useFade: false, preloaded });
      warping = false;
    },
  });
}

function onHashChange() {
  const { route, state } = parseHash();
  if (route === currentRoute && !state) return;
  if (warping) return; // warpTo owns the hash during transitions
  activate(route, state);
}

window.addEventListener('hashchange', onHashChange);

// Frame counter for the readiness contract, hooked into the stage loop.
(function countFrames() {
  requestAnimationFrame(countFrames);
  markFrame();
})();

if (!location.hash) history.replaceState(null, '', `#/${DEFAULT_ROUTE}`);
onHashChange();
stage.start();

// Exposed for debugging and headless smoke tests.
window.cosmos = {
  stage,
  get scene() { return current; },
  get route() { return currentRoute; },
  goto(route) { location.hash = `#/${route}`; },
  warpTo,
  dismissIntro,
};
