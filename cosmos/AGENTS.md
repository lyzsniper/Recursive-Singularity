# COSMOS — Agent Notes

Unified three.js r160 app integrating the three legacy demos (`kimi-sun`,
`kimi-star`, `kimi-blackhole`) into one shell. See `README.md` for run/test
commands and the directory map.

## Hard rules

- **Scene interface**: every scene implements `src/scenes/CONTRACT.md`
  (`createScene(ctx)` → `{update, render, resize, setQuality, getState, setState, dispose}`).
  Read it before touching any scene.
- **No runtime network fetches.** three.js is vendored under `vendor/three/`
  (importmap: `three`, `three/addons/`); all textures are procedural. Do not
  add CDN scripts or image fetches.
- **The renderer is shared.** The shell (`src/core/stage.js`) owns it: sRGB
  output, ACES tone mapping. Scenes must not change global renderer state
  without restoring it in `dispose()` (see how `scenes/solar` saves/restores
  `useLegacyLights` and `scenes/galaxy` saves/restores clear color).
- **Cleanup discipline**: `dispose()` must release controls, geometries,
  materials, textures, composer render targets, DOM nodes and listeners —
  the smoke test revisits each scene in one session and will leak/fail otherwise.
- **Style**: new code is modern ESM (`const`/`let`, classes where useful).
  Scene CSS selectors are prefixed (`solar-`, `galaxy-`, `bh-`) and injected
  via a `<style>` element removed on dispose. UI is bilingual (中文 + English)
  and reuses the shell classes `.glass` / `.btn` / `.panel-title` / `.panel-sub`.

## Machine-readable contract (used by tests/)

- `body[data-scene]` = current route id; `body[data-ready="1"]` after the
  scene calls `ctx.onReady()` and 45 frames pass.
- `window.__errors` collects runtime errors; fatal ones show `#fallback`.
- `window.cosmos` exposes `{ stage, scene, route, goto(route) }`; scene
  instances also expose `camera` and `controls` for headless tests
  (`scenes/galaxy` additionally exposes `flyTo(key, dur)` — use a tiny
  `dur` to skip long flights in headless runs).
- Tests disable the browser cache via CDP — keep that, the dev server sends
  no cache headers and stale-module heuristics cause confusing failures.

## Gotchas learned during integration

- `page.goto()` to a URL that differs only in hash (or not at all) does NOT
  reload the page; force real reloads in tests via `about:blank` first.
- Moving a camera beyond its OrbitControls min/max distance does not snap —
  it glides back over subsequent frames (damping + per-frame clamp lerp),
  which can look like a restore failure in tests.
- `scenes/galaxy` recomputes its macro framing on resize; a restored-from-URL
  camera must win over that (`restoredFromUrl` flag) — do not remove it.
- `data-ready` must be reset to "0" SYNCHRONOUSLY at the start of a scene
  swap (before any await/fade), otherwise tests and observers match the
  previous scene's stale "1". Tests must also match `data-scene` AND
  `data-ready` together (see `tests/smoke.js`).
- The intro overlay (`#intro`) auto-dismisses ~3s after the first scene is
  ready, or on click (`window.cosmos.dismissIntro()` forces it in headless
  screenshots — without it, early screenshots capture the intro, not the scene).
- Cross-scene navigation goes through `ctx.navigate(route)` → `warpTo()`
  (star-tunnel overlay + module preloading). `warpTo` owns the hash during
  the transition; do not call `location.hash` assignment for in-scene jumps.
- Audio is procedural WebAudio (`src/core/audio.js`), gated by the first
  user gesture; headless test runs stay silent unless they synthesize input.
- Headless SwiftShader renders at ~10–20 FPS with dt clamped to 0.1 s;
  FPS numbers in test output are not representative of real hardware.
