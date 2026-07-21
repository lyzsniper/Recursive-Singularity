# Scene Module Contract

Every scene lives at `cosmos/src/scenes/<id>/index.js` and is loaded lazily by
the shell router. Scene ids: `solar`, `galaxy`, `blackhole`.

## Module shape

```js
import * as THREE from 'three';
// Addons are available via the importmap:
//   import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
//   import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
//   import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
//   import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
//   import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';

export function createScene(ctx) { /* ... return instance; may be async */ }
```

## ctx (provided by the shell)

- `renderer: THREE.WebGLRenderer` — shared, already configured (sRGB output,
  ACES tone mapping). Do **not** change global renderer state that outlives
  your scene; if you must, restore it in `dispose()`.
- `canvas: HTMLCanvasElement` — the shared full-window canvas.
- `width, height, pixelRatio: number` — current viewport.
- `quality: 'high' | 'medium' | 'low' | 'potato'` — current level.
  Scenes should treat `potato` as one notch below `low` (≈15% particle
  density, cheapest effects) for weak/mobile GPUs.
- `hud: HTMLElement` — `#scene-hud`, a full-screen overlay container with
  `pointer-events:none` (children re-enable with `pointer-events:auto`, already
  handled by shell CSS). Mount your panels here; the shell empties it on swap.
- `initialState: object | null` — decoded from the URL, pass to `setState`.
- `persistState(state)` — throttled; encodes state into the URL hash.
- `navigate(route)` — trigger the shell's scale-warp transition to another
  scene (`'solar' | 'galaxy' | 'blackhole'`). Use for in-scene hotspots.
- `sfx(name)` — play a shell sound: `'blip'` (UI click) or `'warp'`.
- `onReady()` — call once, after your first successful frame has rendered.

## Scene instance

```js
{
  update(dt, elapsed),          // advance simulation; dt clamped to <= 0.1s
  render(dt),                   // draw: renderer.render(...) or composer.render()
  resize(width, height, pixelRatio),
  setQuality(level),            // adjust particle counts / dpr-heavy effects
  getState(),                   // -> JSON-serializable object (camera pos/target, UI toggles)
  setState(state),              // apply a state produced by getState()
  dispose(),                    // remove DOM, listeners, geometries, materials
}
```

## Rules

1. **No network fetches.** All textures must be procedural (canvas-generated)
   or shader-based. The only allowed imports are `three` and `three/addons/…`
   (vendored under `cosmos/vendor/three/`).
2. **Shared UI language.** Use the shell's design-system classes: `.glass`,
   `.btn`, `.panel-title`, `.panel-sub`. Scene-specific CSS goes in a
   `<style>` element you create and remove in `dispose()`; prefix all scene
   selectors with your scene id (e.g. `.solar-…`) to avoid collisions.
3. **Bilingual labels** (中文 + English), matching the shell's tone.
4. **Camera controls:** use `OrbitControls` on `ctx.canvas`; call
   `controls.dispose()` in `dispose()`.
5. **Persist camera state**: on `controls` 'end' event, call
   `ctx.persistState({ cam: [...pos], tgt: [...target], … })`; honor
   `ctx.initialState` in `setState`.
6. **Cleanup discipline:** everything you create (geometries, materials,
   textures, render targets, DOM, event listeners) must be released in
   `dispose()` — the shell reuses the renderer across scenes.
7. `update()` must tolerate `dt = 0` and large `elapsed` values.
