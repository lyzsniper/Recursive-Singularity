// SINGULARITY · 黑洞 — Three.js r160 port of the PlayCanvas 1.75 black-hole
// scene (kimi-blackhole/index.html). See shaders.js / points.js / lensing.js
// for the ported pieces; this file is the scene assembly + shell contract.

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';

import { HAZE_VS, HAZE_FS, DISK_VS, DISK_FS, JET_VS, JET_FS, STAR_VS, STAR_FS } from './shaders.js';
import { createSeedPoints, createStarPoints } from './points.js';
import { LensingShader, createLensingController } from './lensing.js';

const COUNTS = { haze: 20000, disk: 40000, jet: 6000, star: 9000 };
const QUALITY_SCALE = { high: 1.0, medium: 0.5, low: 0.25, potato: 0.15 };
// Bloom mip-chain resolution per level; 0 disables the pass entirely.
const BLOOM_SCALE = { high: 1.0, medium: 0.5, low: 0.5, potato: 0 };

const SCENE_CSS = `
.bh-title{
  position:absolute; top:84px; left:20px; padding:12px 18px 11px;
  user-select:none; pointer-events:none;
}
.bh-hint{
  position:absolute; bottom:16px; left:50%; transform:translateX(-50%);
  font-size:11px; letter-spacing:2px; opacity:0.5; white-space:nowrap;
  user-select:none; pointer-events:none;
}
@media (max-width: 760px){
  .bh-title{ top:auto; bottom:56px; left:12px; padding:9px 13px 8px; }
  .bh-hint{ font-size:9px; letter-spacing:1px; }
}
`;

// Procedural radial-gradient texture (CORS-proof, same stops as the original).
function makeGlowTexture(size = 256) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g2d = c.getContext('2d');
  const grad = g2d.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  for (const [stop, alpha] of [[0, 1], [0.18, 0.85], [0.45, 0.28], [0.75, 0.06], [1, 0]]) {
    grad.addColorStop(stop, `rgba(255,255,255,${alpha})`);
  }
  g2d.fillStyle = grad;
  g2d.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(c);
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.generateMipmaps = false;
  return tex;
}

export function createScene(ctx) {
  const disposables = [];

  // ---------- scene / camera ----------
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0.004, 0.004, 0.012); // original clear color

  const camera = new THREE.PerspectiveCamera(55, ctx.width / ctx.height, 0.1, 4000);
  // Original start: yaw 40, pitch 22, distance 26 -> camera just below the
  // disk plane looking slightly up (mirrors symmetrically to the same shot).
  camera.position.set(16.71, -7.46, 18.47);

  const controls = new OrbitControls(camera, ctx.canvas);
  controls.target.set(0, 0, 0);
  controls.enableDamping = true;
  controls.minDistance = 4;   // original zoom limits
  controls.maxDistance = 160;
  controls.update();

  // ---------- event horizon: pure black sphere that writes depth ----------
  const holeGeo = new THREE.SphereGeometry(1.15, 64, 32); // radius 1.15, matches scale 2.3 sphere
  const holeMat = new THREE.MeshBasicMaterial({ color: 0x000000 });
  const hole = new THREE.Mesh(holeGeo, holeMat);
  hole.name = 'EventHorizon';
  scene.add(hole);
  disposables.push(holeGeo, holeMat);

  // ---------- core glow: additive camera-facing sprite ----------
  const glowTex = makeGlowTexture();
  const glowMat = new THREE.SpriteMaterial({
    map: glowTex,
    color: new THREE.Color(0.85, 0.70, 0.50), // original emissive tint
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    toneMapped: false, // keep the original's raw color math
  });
  const glow = new THREE.Sprite(glowMat);
  glow.name = 'CoreGlow';
  glow.scale.set(3.4, 3.4, 1);
  scene.add(glow);
  disposables.push(glowTex, glowMat);

  // ---------- point-sprite layers (one draw call each) ----------
  const timeU = () => ({ value: 0 });
  const pointScaleU = () => ({ value: 1000 });

  const hazeUniforms = {
    uTime: timeU(), uPointScale: pointScaleU(),
    uInner: { value: 1.6 }, uOuter: { value: 11.0 },
    uInflow: { value: 0.38 }, uK: { value: 6.0 },
  };
  const haze = createSeedPoints('AccretionHaze', COUNTS.haze, HAZE_VS, HAZE_FS, hazeUniforms);
  scene.add(haze);

  const diskUniforms = {
    uTime: timeU(), uPointScale: pointScaleU(),
    uInner: { value: 1.6 }, uOuter: { value: 9.0 },
    uInflow: { value: 0.55 }, uK: { value: 6.0 },
  };
  const disk = createSeedPoints('KeplerianDisk', COUNTS.disk, DISK_VS, DISK_FS, diskUniforms);
  scene.add(disk);

  const jetUniforms = { uTime: timeU(), uPointScale: pointScaleU() };
  const jet = createSeedPoints('RelativisticJets', COUNTS.jet, JET_VS, JET_FS, jetUniforms, i => i % 2);
  scene.add(jet);

  const starUniforms = { uTime: timeU(), uPixelRatio: { value: ctx.pixelRatio } };
  const stars = createStarPoints('Starfield', COUNTS.star, STAR_VS, STAR_FS, starUniforms);
  scene.add(stars);

  const layers = [haze, disk, jet, stars];
  for (const l of layers) disposables.push(l.geometry, l.material);
  const timedLayers = [hazeUniforms, diskUniforms, jetUniforms, starUniforms];

  // ---------- post-processing: RenderPass -> bloom -> gravitational lensing ----------
  // EffectComposer's default buffers are HalfFloatType (HDR) end-to-end, and
  // UnrealBloomPass keeps its own mip chain half-float too. Bloom sits before
  // the lensing pass so the glow itself is gravitationally lensed.
  const composer = new EffectComposer(ctx.renderer);
  composer.setPixelRatio(ctx.pixelRatio);
  composer.setSize(ctx.width, ctx.height);
  composer.addPass(new RenderPass(scene, camera));
  const bloomPass = new UnrealBloomPass(
    new THREE.Vector2(ctx.width, ctx.height),
    0.3,  // strength — low, tasteful glow
    0.3,  // radius
    1.5,  // threshold on HDR luminance: disk/photon ring bloom, stars + shadow don't
  );
  composer.addPass(bloomPass);
  const lensingPass = new ShaderPass(LensingShader);
  composer.addPass(lensingPass);
  const lensCtl = createLensingController(camera, lensingPass);

  // ---------- HUD ----------
  const style = document.createElement('style');
  style.textContent = SCENE_CSS;
  document.head.appendChild(style);

  const hudRoot = document.createElement('div');
  hudRoot.innerHTML = `
    <div class="bh-title glass">
      <div class="panel-title">SINGULARITY · 黑洞</div>
      <div class="panel-sub">Active Accretion · 活动吸积盘</div>
    </div>
    <div class="bh-hint">拖拽 旋转 · 滚轮 缩放 · 右键 平移 &nbsp;—&nbsp; DRAG ORBIT · WHEEL ZOOM · RIGHT-DRAG PAN</div>
  `;
  ctx.hud.appendChild(hudRoot);

  // ---------- per-frame state ----------
  let time = 0;
  let readySignaled = false;
  let viewW = ctx.width;  // ctx.width/height are creation-time snapshots;
  let viewH = ctx.height; // these stay current via resize()
  const dbSize = new THREE.Vector2();

  function updatePointScale() {
    // gl_PointSize = uPointScale * worldSize / viewDepth  (device pixels)
    ctx.renderer.getDrawingBufferSize(dbSize);
    const pointScale = camera.projectionMatrix.elements[5] * dbSize.y * 0.5;
    hazeUniforms.uPointScale.value = pointScale;
    diskUniforms.uPointScale.value = pointScale;
    jetUniforms.uPointScale.value = pointScale;
  }
  updatePointScale();

  let qualityLevel = 'high';
  function applyBloomSize() {
    // composer.setSize() resets every pass to full resolution, so the scaled
    // bloom resolution must be re-applied after it (and on quality changes).
    ctx.renderer.getDrawingBufferSize(dbSize);
    const s = BLOOM_SCALE[qualityLevel] ?? 1.0;
    bloomPass.setSize(Math.max(2, dbSize.x * s | 0), Math.max(2, dbSize.y * s | 0));
  }

  function applyQuality(level) {
    const f = QUALITY_SCALE[level] ?? 1.0;
    haze.geometry.setDrawRange(0, Math.floor(COUNTS.haze * f));
    disk.geometry.setDrawRange(0, Math.floor(COUNTS.disk * f));
    jet.geometry.setDrawRange(0, Math.floor(COUNTS.jet * f));
    stars.geometry.setDrawRange(0, Math.floor(COUNTS.star * f));
    qualityLevel = QUALITY_SCALE[level] != null ? level : 'high';
    bloomPass.enabled = (BLOOM_SCALE[qualityLevel] ?? 1.0) > 0; // potato: bloom off, lensing stays
    if (bloomPass.enabled) applyBloomSize();
  }
  applyQuality(ctx.quality);

  function getState() {
    return { cam: camera.position.toArray(), tgt: controls.target.toArray() };
  }
  function setState(state) {
    if (!state) return;
    if (Array.isArray(state.cam)) camera.position.fromArray(state.cam);
    if (Array.isArray(state.tgt)) controls.target.fromArray(state.tgt);
    controls.update();
  }
  setState(ctx.initialState);

  controls.addEventListener('end', () => ctx.persistState(getState()));

  // ---------- scene instance (contract) ----------
  return {
    camera,   // exposed for headless smoke tests / debugging
    controls,
    composer,

    update(dt) {
      time += dt;
      for (const u of timedLayers) u.uTime.value = time;
      controls.update();
      updatePointScale();
      lensCtl.update(time, viewW, viewH);
    },

    render() {
      composer.render();
      if (!readySignaled) {
        readySignaled = true;
        ctx.onReady();
      }
    },

    resize(width, height, pixelRatio) {
      viewW = width;
      viewH = height;
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      composer.setPixelRatio(pixelRatio);
      composer.setSize(width, height);
      if (bloomPass.enabled) applyBloomSize();
      starUniforms.uPixelRatio.value = pixelRatio;
      updatePointScale();
    },

    setQuality: applyQuality,
    getState,
    setState,

    dispose() {
      controls.dispose();
      bloomPass.dispose(); // composer.dispose() frees shared targets, not passes
      composer.dispose();
      for (const d of disposables) d.dispose();
      style.remove();
      hudRoot.remove();
    },
  };
}
