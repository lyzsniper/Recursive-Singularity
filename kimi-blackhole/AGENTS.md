# SINGULARITY — Active Accretion Disk

## Project overview

A single-file interactive WebGL visualization of a black hole ("SINGULARITY") with an
active accretion disk, relativistic jets, screen-space gravitational lensing, and a
background starfield. There is **no build system, no package manifest, and no test
suite** — the entire application is one self-contained HTML file:

- `index.html` — the whole app: markup, CSS HUD overlay, engine bootstrap, shaders,
  and scene setup, all inline.
- `.*.png` (hidden dot-files, e.g. `.smoke.png`, `.jet-a.png`, `.disk-only.png`) —
  smoke-test screenshots captured during development/verification. They are hidden
  files committed to git on purpose; treat them as visual regression references.

The runtime dependency is the **PlayCanvas engine 1.75.0** (the legacy 1.x API with
`pc.createScript` and `pc.PostEffect`), loaded from CDN at runtime — first from
`https://unpkg.com/playcanvas@1.75.0/build/playcanvas.min.js`, with a
`cdn.jsdelivr.net` fallback via `document.write` if `window.pc` is missing. There is
no local copy of the engine and no bundler; the page requires network access to a
CDN at load time (a `#fallback` overlay reports engine-load failure).

## How the code is organized (index.html)

Top-down inside one IIFE, in numbered banner sections:

1. **Section 0** — full-screen `pc.Application` boilerplate (fill-window canvas,
   pixel ratio capped at 2, ambient light off).
2. **Section 1** — procedural radial-gradient textures generated via 2D canvas
   (`glowTex` for the core-glow billboard) — deliberately CORS-proof, no image fetches.
3. **Section 2** — script definitions via `pc.createScript`:
   - `orbitControls` — inertia-based orbit/pan/zoom camera (mouse + touch, damping).
   - `lensingController` — projects world-space singularity into screen space and
     feeds uniforms to the lensing post-effect each frame; disables the effect when
     the singularity is behind the camera.
   - `systemDriver` — pushes per-frame uniforms (`uTime`, `uPointScale`) into every
     material listed in `pointMaterials`, plus `uTime` into the star material.
   - `billboard` — keeps the core-glow quad facing the camera.
4. **Section 3** — custom `pc.PostEffect` (`LensingEffect`) with inline GLSL:
   deflection via the continuous map `r -> r + R²/r` (the fold at r = R is the
   primary/secondary image pair; never crosses zero, so no ring artifacts), a
   wrap rotation (up to ~143°) near the capture zone that paints the far side of
   the disk as arcs above/below the shadow, frame-dragging swirl, photon-capture
   horizon, Einstein-ring shimmer, chromatic aberration, vignette, dither.
   Note the comment: the normalized `rect` is intentionally NOT passed to
   `pc.drawQuadWithShader` — a PlayCanvas 1.75 quirk.
5. **Sections 4–5** — camera entity + post-effect wiring; event-horizon sphere
   (pure black, depth-writing occluder) and additive core-glow billboard.
6. **Section 6** — shared point-sprite helpers (`createPointsMesh` /
   `createPointsMaterial` / `spawnPointsEntity`) + accretion haze: 20,000 large
   soft sprites, one draw call, slow sub-Keplerian swirl and gaussian falloff —
   the disk's volumetric body.
7. **Section 7** — accretion disk streak layer: 40,000 GPU point-sprites in ONE
   draw call with a custom vertex shader implementing the Keplerian vortex law
   (`omega ~ r^-1.5`), spiral inflow, turbulence, 1/r gravitational heating, and
   doppler-style beaming asymmetry (clamped so the receding side dims but never
   goes black).
8. **Section 8** — relativistic jets: 6,000 GPU point-sprites in ONE draw call;
   both poles share a single mesh (`aSeed.w` picks the pole sign). Collimated
   narrow foot, slow widening, helical twist, white-blue foot cooling to indigo.
9. **Section 9** — starfield: 9,000 stars as `pc.PRIMITIVE_POINTS`, one draw call,
   with a twinkle vertex shader.
10. **Sections 10–12** — system driver entity, HTML FPS counter + readiness flag
    (`data-ready="1"` on `<body>` after 45 frames), `window.app` exposed for console
    debugging, `app.start()`.

## Conventions worth knowing

- **Legacy PlayCanvas 1.x API only.** Use `pc.createScript`, prototype methods
  (`initialize`, `update`), `pc.PostEffect`, `pc.Curve`/`pc.CurveSet`,
  `pc.StandardMaterial`. Do NOT "modernize" to the ES-module PlayCanvas 2.x API —
  the pinned CDN build will not support it.
- **ES5-era JavaScript style** inside the IIFE: `var`, function expressions, string-
  joined GLSL arrays, banner comments (`// ===== 3. Title =====`). Match this style
  when editing.
- **Error observability for headless checks**: an early error trap pushes runtime
  errors into `window.__pcErrors` and shows `#fallback` with `data-error="1"`.
  Successful startup is signaled by `document.body[data-ready="1"]` after 45 frames.
  Preserve these hooks — they are the machine-readable contract for smoke tests.
- **Do NOT use `pc.ParticleSystemComponent`.** In the pinned 1.75 build it is
  broken: emitters simulate (state advances, mesh instances register in the World
  layer) but never rasterize anything — verified on both the GPU and CPU paths,
  headless SwiftShader and real D3D11 hardware alike. Every particle layer in this
  scene is a hand-rolled GPU point-sprite mesh instead.
- **GPU discipline**: particle layers are additive-blended (`pc.BLEND_ADDITIVEALPHA`,
  premultiplied output in the fragment shader), `depthWrite: false`, unsorted, and
  batched into single-draw-call point meshes via the
  `createPointsMesh` / `createPointsMaterial` / `spawnPointsEntity` helpers
  (Section 6). Reuse those helpers for any new point-sprite layer, and wire its
  material into `systemDriver.pointMaterials` so `uTime`/`uPointScale` update.
- All assets are procedural (canvas-generated textures); do not add external image
  fetches without considering CORS.

## Build, run, and test

- **Build**: none. Editing `index.html` is the whole workflow.
- **Run**: serve the directory over HTTP (e.g. `python -m http.server` or
  `npx serve`) and open `index.html`. Opening via `file://` may also work since
  everything is inline/procedural, but a local server is the safe path. CDN access
  is required for the engine.
- **Test**: there is no automated test suite. Verification is done by headless
  smoke screenshots (the committed `.smoke*.png` / `.jet-*.png` files are artifacts
  of those runs). `shot.js` is the harness: serve the directory on port 8791
  (`python -m http.server 8791`), then `node shot.js <outfile> [waitMs] [evalJs]`
  (Playwright from the global `omniroute` install; `evalJs` runs in-page after
  readiness, e.g. to reposition the camera via
  `app.root.findByName('Camera').script.orbitControls`). The readiness/error
  contract for automation is:
  - success: `<body data-ready="1">` appears after ~45 frames;
  - failure: `#fallback` visible with `data-error="1"`, details in `window.__pcErrors`.
  When making rendering changes, capture a fresh screenshot and compare against the
  relevant `.smoke*.png` reference before committing.

## Deployment

Static hosting only — copy `index.html` to any static web server. No CI/CD, no
server-side component, no environment variables.

## Security considerations

- Third-party code is loaded from public CDNs (unpkg / jsDelivr) **without SRI
  hashes** — a known, accepted trade-off; keep the pinned `1.75.0` version.
- The page takes no user input, sets no cookies, and makes no network requests other
  than the engine script. `contextmenu` and touch defaults are prevented on the
  canvas for interaction handling.
- `window.app` is intentionally exposed globally for debugging; it is harmless here
  (no secrets) but do not add sensitive state to it.
