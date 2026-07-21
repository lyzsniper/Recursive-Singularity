// Galaxy scene — "Galactic Atlas" (Milky Way) ported from
// kimi-star/galactic-atlas.html to the COSMOS scene contract.
// Procedural barred-spiral galaxy: points-based core/arms/clouds/dust,
// raymarched nebulae, Sagittarius A* with accretion disk + lensing shell,
// miniature solar system, POI fly-to navigation, UnrealBloom grading.

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import {
  makeStarTexture, makeFlareTexture, makeGlowTexture, makeSunTexture,
  makeEarthTexture, makeMarsTexture, makeJupiterTexture, makeSaturnTexture,
  makeRockyTexture, makeRingTexture, makeLabel
} from './textures.js';

/* ------------------------------------------------------------------ */
/* Scene-scoped CSS (selectors prefixed .galaxy-)                      */
/* ------------------------------------------------------------------ */
const CSS = `
  .galaxy-vignette{
    position:absolute; inset:0; pointer-events:none;
    background:radial-gradient(ellipse at center, transparent 52%, rgba(0,0,12,0.55) 100%);
  }
  .galaxy-hud{
    position:absolute; left:28px; top:50%; transform:translateY(-50%);
    pointer-events:auto;
    width:268px; padding:24px 22px 18px;
    transition:width .35s ease, padding .35s ease;
  }
  .galaxy-hud-toggle{
    position:absolute; top:12px; right:12px;
    width:26px; height:26px; border-radius:8px;
    background:rgba(120,170,255,0.08);
    border:1px solid rgba(140,180,255,0.22);
    color:rgba(200,220,255,0.75); font-size:13px; line-height:1;
    cursor:pointer; transition:background .2s, color .2s;
  }
  .galaxy-hud-toggle:hover{ background:rgba(120,170,255,0.20); color:#fff; }
  .galaxy-hud.collapsed{ width:62px; padding:18px 12px; }
  .galaxy-hud.collapsed .galaxy-brand, .galaxy-hud.collapsed .panel-title,
  .galaxy-hud.collapsed .panel-sub, .galaxy-hud.collapsed .galaxy-poi,
  .galaxy-hud.collapsed .galaxy-keys{ display:none; }
  .galaxy-hud.collapsed .galaxy-hud-toggle{ position:static; display:block; margin:0 auto; }
  .galaxy-brand{ font-size:10px; letter-spacing:4px; color:#8fb8ff; margin-bottom:5px; }
  .galaxy-hud .panel-title{ font-size:16px; letter-spacing:2px; }
  .galaxy-hud .panel-sub{ margin:4px 0 18px; }
  .galaxy-poi{
    display:flex; align-items:center; gap:12px;
    width:100%; padding:11px 12px; margin-bottom:7px;
    background:rgba(255,255,255,0.03);
    border:1px solid transparent; border-radius:12px;
    cursor:pointer; color:#cfe0ff; text-align:left;
    font-family:inherit; transition:background .25s, border-color .25s, transform .25s;
  }
  .galaxy-poi:hover{ background:rgba(120,170,255,0.10); border-color:rgba(140,180,255,0.25); transform:translateX(4px); }
  .galaxy-poi.active{ background:rgba(120,170,255,0.14); border-color:rgba(140,190,255,0.45); }
  .galaxy-poi .galaxy-dot{ width:9px; height:9px; border-radius:50%; background:var(--c); box-shadow:0 0 10px var(--c); flex:none; }
  .galaxy-poi .galaxy-lbl{ font-size:13px; letter-spacing:1px; font-weight:600; }
  .galaxy-poi small{ display:block; font-size:10px; font-weight:400; color:rgba(180,200,240,0.5); letter-spacing:1px; margin-top:2px; }
  .galaxy-poi .galaxy-key{
    margin-left:auto; flex:none;
    font-size:9px; letter-spacing:1px; color:rgba(170,200,255,0.55);
    border:1px solid rgba(140,180,255,0.28); border-radius:5px;
    padding:2px 6px;
  }
  .galaxy-keys{ margin-top:12px; font-size:9px; letter-spacing:2px; color:rgba(170,195,245,0.35); }
  .galaxy-info{
    position:absolute; right:28px; bottom:28px; width:336px;
    padding:22px 24px 18px;
    opacity:0; transform:translateY(24px); pointer-events:none !important;
    transition:opacity .6s ease, transform .6s ease;
  }
  .galaxy-info.visible{ opacity:1; transform:none; pointer-events:auto !important; }
  .galaxy-info-close{
    position:absolute; top:8px; right:14px;
    background:none; border:none; color:rgba(200,215,255,0.5);
    font-size:22px; line-height:1; cursor:pointer; transition:color .2s;
  }
  .galaxy-info-close:hover{ color:#fff; }
  .galaxy-info-type{ font-size:9px; letter-spacing:3px; color:#8fb8ff; margin-bottom:6px; }
  .galaxy-info h2{ font-size:21px; font-weight:600; letter-spacing:1px; color:#f4f8ff; margin-bottom:12px; }
  .galaxy-stat{
    display:flex; justify-content:space-between; align-items:baseline; gap:12px;
    font-size:11px; padding:5px 0; letter-spacing:.5px;
    border-bottom:1px solid rgba(140,180,255,0.10);
    color:rgba(190,205,240,0.62);
  }
  .galaxy-stat b{ color:#e8f0ff; font-weight:600; text-align:right; }
  .galaxy-info-desc{ margin-top:12px; font-size:12px; line-height:1.7; color:rgba(205,220,250,0.78); }
  .galaxy-info-desc-en{ margin-top:8px; font-size:11px; line-height:1.6; color:rgba(205,220,250,0.5); }
  .galaxy-enter{ display:none; margin-top:14px; width:100%; white-space:normal; }
  .galaxy-enter.show{ display:block; }
  .galaxy-hint{
    position:absolute; bottom:18px; left:50%; transform:translateX(-50%);
    font-size:10px; letter-spacing:3px; color:rgba(180,200,245,0.35);
    pointer-events:none !important; white-space:nowrap;
  }
  .galaxy-credit{
    position:absolute; top:100px; right:22px;
    font-size:9px; letter-spacing:2px; color:rgba(170,195,245,0.30);
    pointer-events:none !important;
  }
  @media (max-width: 760px){
    .galaxy-hud{ left:12px; width:224px; padding:16px 14px; }
    .galaxy-hud.collapsed{ width:52px; padding:12px 9px; }
    .galaxy-info{ right:12px; left:12px; width:auto; bottom:14px; }
    .galaxy-hint{ display:none; }
    .galaxy-credit{ display:none; }
  }
`;

const POI_DEFS = [
  { key: 'center', color: '#ffd27d', zh: '银河中心', en: 'Galactic Center · Sagittarius A*', num: '1' },
  { key: 'nebula', color: '#c98fff', zh: '猎户座大星云', en: 'Orion Nebula · Volumetric Cloud', num: '2' },
  { key: 'sol', color: '#7fd4ff', zh: '太阳系', en: 'Solar System · Orion Arm', num: '3' },
  { key: 'macro', color: '#9fffcf', zh: '宏观全景', en: 'Macro View · Whole Galaxy', num: '4' },
];

export function createScene(ctx) {
  const renderer = ctx.renderer;

  // Global renderer state we touch and must restore in dispose().
  const prevClearColor = renderer.getClearColor(new THREE.Color());
  const prevClearAlpha = renderer.getClearAlpha();
  renderer.setClearColor(0x02030a, 1); // very dark navy, never pure black

  /* ---------- DOM: styles + HUD ---------- */
  const styleEl = document.createElement('style');
  styleEl.textContent = CSS;
  document.head.appendChild(styleEl);

  const hudRoot = document.createElement('div');
  hudRoot.style.cssText = 'position:absolute;inset:0;pointer-events:none;';
  ctx.hud.appendChild(hudRoot);

  const vignette = document.createElement('div');
  vignette.className = 'galaxy-vignette';
  hudRoot.appendChild(vignette);

  const nav = document.createElement('nav');
  nav.className = 'glass galaxy-hud';
  nav.innerHTML =
    '<button class="galaxy-hud-toggle" title="折叠面板 Collapse">&laquo;</button>' +
    '<div class="galaxy-brand">STELLAR CARTOGRAPHY · 星际测绘</div>' +
    '<div class="panel-title">GALACTIC ATLAS</div>' +
    '<div class="panel-sub">银河星图 · MILKY WAY · INTERACTIVE CHART</div>' +
    POI_DEFS.map(p =>
      '<button class="galaxy-poi" data-key="' + p.key + '">' +
      '<span class="galaxy-dot" style="--c:' + p.color + '"></span>' +
      '<span class="galaxy-lbl">' + p.zh + '<small>' + p.en + '</small></span>' +
      '<span class="galaxy-key">' + p.num + '</span>' +
      '</button>'
    ).join('') +
    '<div class="galaxy-keys">按键 1–4 · 点击目的地飞行 — KEYS 1–4 · CLICK TO FLY</div>';
  hudRoot.appendChild(nav);

  const infoEl = document.createElement('aside');
  infoEl.className = 'glass galaxy-info';
  infoEl.innerHTML =
    '<button class="galaxy-info-close" title="关闭 Close">&times;</button>' +
    '<div class="galaxy-info-type"></div>' +
    '<h2 class="galaxy-info-name"></h2>' +
    '<div class="galaxy-info-stats"></div>' +
    '<p class="galaxy-info-desc"></p>' +
    '<p class="galaxy-info-desc-en"></p>' +
    '<button class="btn galaxy-enter" type="button"></button>';
  hudRoot.appendChild(infoEl);

  const hintEl = document.createElement('div');
  hintEl.className = 'galaxy-hint';
  hintEl.textContent = '拖动旋转 · 滚轮缩放 · 按 1–4 导航 — DRAG TO ORBIT · SCROLL TO ZOOM · PRESS 1–4';
  hudRoot.appendChild(hintEl);

  const creditEl = document.createElement('div');
  creditEl.className = 'galaxy-credit';
  creditEl.textContent = 'PROCEDURAL WEBGL · THREE.JS · 程序化生成';
  hudRoot.appendChild(creditEl);

  const infoType = infoEl.querySelector('.galaxy-info-type');
  const infoName = infoEl.querySelector('.galaxy-info-name');
  const infoStats = infoEl.querySelector('.galaxy-info-stats');
  const infoDesc = infoEl.querySelector('.galaxy-info-desc');
  const infoDescEn = infoEl.querySelector('.galaxy-info-desc-en');
  const infoEnter = infoEl.querySelector('.galaxy-enter');
  const hudToggle = nav.querySelector('.galaxy-hud-toggle');
  const buttons = Array.from(nav.querySelectorAll('.galaxy-poi'));

  /* ---------- Scene / camera / controls ---------- */
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(55, ctx.width / ctx.height, 0.5, 40000);

  const controls = new OrbitControls(camera, ctx.canvas);
  controls.enableDamping = true;
  controls.dampingFactor = 0.06;
  controls.minDistance = 350;      // hard clamp: cannot dive into the core gas
  controls.maxDistance = 2800;     // hard clamp: cannot escape the charted galaxy
  controls.minPolarAngle = 0.06;
  controls.maxPolarAngle = Math.PI * 0.94;
  controls.target.set(0, 0, 0);

  /* ---------- Post-processing: RenderPass -> UnrealBloom -> filmic output.
     The final pass applies the ACES curve + gamma in one place so every
     layer (custom shaders included) is graded identically. ---------- */
  const isWebGL2 = renderer.capabilities.isWebGL2;
  const composerTarget = new THREE.WebGLRenderTarget(ctx.width, ctx.height, {
    type: isWebGL2 ? THREE.HalfFloatType : THREE.UnsignedByteType
  });
  if (isWebGL2) composerTarget.samples = 4;
  const composer = new EffectComposer(renderer, composerTarget);
  composer.addPass(new RenderPass(scene, camera));
  const bloomPass = new UnrealBloomPass(
    new THREE.Vector2(ctx.width, ctx.height), 1.05, 0.55, 0.15
  );
  composer.addPass(bloomPass);
  const outputPass = new ShaderPass({
    uniforms: { tDiffuse: { value: null }, uExposure: { value: 1.15 } },
    vertexShader: [
      'varying vec2 vUv;',
      'void main() {',
      '  vUv = uv;',
      '  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);',
      '}'
    ].join('\n'),
    fragmentShader: [
      'uniform sampler2D tDiffuse;',
      'uniform float uExposure;',
      'varying vec2 vUv;',
      'vec3 acesFilm(vec3 x) {',
      '  return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0);',
      '}',
      'void main() {',
      '  vec3 c = texture2D(tDiffuse, vUv).rgb;',
      '  c = acesFilm(c * uExposure);',
      '  c = pow(c, vec3(1.0 / 2.2));',
      '  gl_FragColor = vec4(c, 1.0);',
      '}'
    ].join('\n')
  });
  composer.addPass(outputPass);

  // Built-in materials must not be tone-mapped twice: the output pass above
  // is the single place where the filmic curve is applied.
  function noTone(m) { m.toneMapped = false; return m; }

  /* ---------- Shared procedural textures ---------- */
  const starTex = makeStarTexture();
  const flareTex = makeFlareTexture();
  const glowTex = makeGlowTexture();

  /* ---------- Galaxy scale architecture (logical units) ---------- */
  const GALAXY_R = 1200;   // galactic radius
  const CORE_R = 230;      // luminous bulge radius (~19% of galaxy radius)
  const ARM_COUNT = 4;     // four major spiral arms
  const WIND = 0.0042;     // log-spiral winding: theta = armOffset + r * WIND
  const BAR_A = 0.5;       // central bar position angle (radians)

  function gauss() { return (Math.random() + Math.random() + Math.random() - 1.5) * 1.15; }
  function clamp01(x) { return x < 0 ? 0 : (x > 1 ? 1 : x); }
  function sstep(a, b, x) { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); }

  /* ---------- Point-layer factory: one shared shader family for every
     particle layer. Per-particle size/color, perspective-correct point
     scaling, optional slow size pulsation for the diffuse cloud layer. --- */
  const galaxyLayers = []; // {points, mat, geo, full, baseOp, rot, isCore}

  function makePointsMaterial(opts) {
    const vertex = [
      'attribute float aSize;',
      'attribute vec3 aColor;',
      opts.pulse ? 'attribute float aSeed;' : '',
      'uniform float uScale;',
      'uniform float uSizeMul;',
      'uniform float uTime;',
      'varying vec3 vColor;',
      'void main() {',
      '  vColor = aColor;',
      '  vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);',
      '  float sz = aSize;',
      opts.pulse ? '  sz *= 1.0 + 0.10 * sin(uTime * 0.7 + aSeed);' : '',
      '  gl_PointSize = min(sz * uScale * uSizeMul / max(-mvPosition.z, 0.1), 110.0);',
      '  gl_Position = projectionMatrix * mvPosition;',
      '}'
    ].join('\n');
    return new THREE.ShaderMaterial({
      uniforms: {
        uMap: { value: opts.tex },
        uScale: { value: 1 },
        uOpacity: { value: opts.opacity },
        uSizeMul: { value: 1 },
        uTime: { value: 0 }
      },
      vertexShader: vertex,
      fragmentShader: [
        'uniform sampler2D uMap;',
        'uniform float uOpacity;',
        'varying vec3 vColor;',
        'void main() {',
        '  vec4 tex = texture2D(uMap, gl_PointCoord);',
        '  gl_FragColor = vec4(vColor * tex.rgb, tex.a * uOpacity);',
        '}'
      ].join('\n'),
      transparent: true,
      depthWrite: false,
      blending: opts.blending
    });
  }

  function buildLayer(opts) {
    const count = opts.count;
    const pos = new Float32Array(count * 3);
    const col = new Float32Array(count * 3);
    const siz = new Float32Array(count);
    const seed = opts.pulse ? new Float32Array(count) : null;
    const out = { x: 0, y: 0, z: 0, r: 1, g: 1, b: 1, s: 1 };
    for (let i = 0; i < count; i++) {
      opts.gen(i, out);
      pos[i * 3] = out.x; pos[i * 3 + 1] = out.y; pos[i * 3 + 2] = out.z;
      col[i * 3] = out.r; col[i * 3 + 1] = out.g; col[i * 3 + 2] = out.b;
      siz[i] = out.s;
      if (seed) seed[i] = Math.random() * 6.2832;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('aColor', new THREE.BufferAttribute(col, 3));
    geo.setAttribute('aSize', new THREE.BufferAttribute(siz, 1));
    if (seed) geo.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
    const mat = makePointsMaterial(opts);
    const points = new THREE.Points(geo, mat);
    points.frustumCulled = false;
    points.renderOrder = opts.renderOrder;
    scene.add(points);
    const layer = {
      points, mat, geo, full: count,
      baseOp: opts.opacity, rot: opts.rot || 0, isCore: !!opts.isCore
    };
    galaxyLayers.push(layer);
    return layer;
  }

  /* ---------- Background deep-space starfield ---------- */
  buildLayer({
    count: 5000, tex: starTex, opacity: 0.75, renderOrder: 0, rot: 0,
    blending: THREE.AdditiveBlending, pulse: false,
    gen: function (i, o) {
      const th = Math.random() * Math.PI * 2, ph = Math.acos(2 * Math.random() - 1);
      const r = 7000 + Math.random() * 5000;
      o.x = r * Math.sin(ph) * Math.cos(th);
      o.y = r * Math.cos(ph);
      o.z = r * Math.sin(ph) * Math.sin(th);
      const b = Math.random();
      const bright = 0.25 + 0.75 * b * b; // mostly dim, a few bright
      o.r = (0.72 + 0.28 * Math.random()) * bright;
      o.g = (0.78 + 0.22 * Math.random()) * bright;
      o.b = (0.92 + 0.08 * Math.random()) * bright;
      o.s = 2.0 + Math.random() * (b > 0.97 ? 9.0 : 3.0);
    }
  });

  /* ---------- Galactic core: hotspot + bar + elliptical bulge ---------- */
  buildLayer({
    count: 30000, tex: starTex, opacity: 1.0, renderOrder: 1, rot: 0.013,
    blending: THREE.AdditiveBlending, pulse: false, isCore: true,
    gen: function (i, o) {
      let rr, x, y, z;
      if (i < 1800) {                       // white-hot central hotspot
        rr = 46 * Math.pow(Math.random(), 2.0);
        const th0 = Math.random() * Math.PI * 2;
        x = Math.cos(th0) * rr; z = Math.sin(th0) * rr;
        y = gauss() * 12;
        const hb = 0.88 + Math.random() * 0.10;
        o.r = hb; o.g = hb * 0.98; o.b = hb * 0.92;
        o.s = 3.5 + Math.random() * 3.5;
      } else if (Math.random() < 0.30) {    // central bar
        const along = (Math.random() * 2 - 1) * 360;
        const across = gauss() * 40;
        const ca = Math.cos(BAR_A), sa = Math.sin(BAR_A);
        x = along * ca - across * sa; z = along * sa + across * ca;
        y = gauss() * 42;
        const bb = 0.55 + Math.random() * 0.28;
        o.r = 1.0 * bb; o.g = 0.86 * bb; o.b = 0.64 * bb;
        o.s = 2.0 + Math.random() * 2.4;
      } else {                              // elliptical bulge
        rr = CORE_R * Math.pow(Math.random(), 2.5);
        const th = Math.random() * Math.PI * 2;
        x = Math.cos(th) * rr; z = Math.sin(th) * rr;
        y = gauss() * (14 + 62 * (1 - rr / CORE_R)) * 0.9;
        const t = clamp01(rr / CORE_R);
        const p = Math.random();
        let pr, pg, pb;
        if (p < 0.30) { pr = 1.00; pg = 0.97; pb = 0.90; }      // warm white
        else if (p < 0.55) { pr = 1.00; pg = 0.85; pb = 0.55; } // pale gold
        else if (p < 0.78) { pr = 1.00; pg = 0.92; pb = 0.76; } // soft cream
        else if (p < 0.93) { pr = 1.00; pg = 0.78; pb = 0.58; } // peach
        else { pr = 1.00; pg = 0.68; pb = 0.42; }               // orange-yellow
        const bb2 = (0.42 + 0.50 * (1 - t)) * (0.85 + Math.random() * 0.3);
        o.r = pr * bb2; o.g = pg * bb2; o.b = pb * bb2;
        o.s = 2.2 + (1 - t) * 3.2 + Math.random() * 2.0;
      }
      o.x = x; o.y = y; o.z = z;
    }
  });

  /* ---------- Main spiral arms: four logarithmic ribbons ---------- */
  buildLayer({
    count: 70000, tex: starTex, opacity: 1.0, renderOrder: 1, rot: 0.011,
    blending: THREE.AdditiveBlending, pulse: false,
    gen: function (i, o) {
      const arm = (Math.random() * ARM_COUNT) | 0;
      const armOff = arm * (Math.PI * 2 / ARM_COUNT);
      const r = GALAXY_R * (0.05 + 0.95 * Math.pow(Math.random(), 0.85));
      const t = r / GALAXY_R;
      let theta = armOff + r * WIND;
      if (Math.random() < 0.12) theta += 0.38 + r * 0.0009; // secondary spur
      const role = Math.random();
      let spread, cr, cg, cb, sz;
      if (role < 0.42) {                    // dense bright centerline
        spread = 5 + r * 0.045;
        const b0 = 0.88 + Math.random() * 0.16;
        cr = (0.82 + Math.random() * 0.10) * b0; cg = 0.88 * b0; cb = 1.00 * b0;
        sz = 2.2 + Math.random() * 2.6;
      } else if (role < 0.80) {             // cyan-blue mid cloud
        spread = 9 + r * 0.085;
        const p1 = Math.random();
        cr = 0.34 + 0.24 * p1; cg = 0.55 + 0.20 * p1; cb = 1.00;
        sz = 1.8 + Math.random() * 2.0;
      } else {                              // violet diffuse skirt
        spread = 15 + r * 0.15;
        const p2 = Math.random();
        cr = 0.48 + 0.24 * p2; cg = 0.30 + 0.18 * p2; cb = 0.98;
        sz = 2.6 + Math.random() * 2.8;
      }
      // inner-arm stars warm up toward the bulge
      const warm = 1 - sstep(0.10, 0.38, t);
      cr += (1.00 - cr) * warm * 0.85;
      cg += (0.86 - cg) * warm * 0.85;
      cb += (0.66 - cb) * warm * 0.85;
      const sp = Math.random();
      if (sp < 0.025) { cr = 1.00; cg = 0.55; cb = 0.36; }      // red giants
      else if (sp < 0.050) { cr = 1.00; cg = 0.62; cb = 0.85; } // pink HII knots
      const jit = 0.85 + Math.random() * 0.30;
      o.r = cr * jit; o.g = cg * jit; o.b = cb * jit;
      o.x = Math.cos(theta) * r + gauss() * spread;
      o.z = Math.sin(theta) * r + gauss() * spread;
      o.y = gauss() * (9 + 62 * Math.exp(-r / 190)) * (1 - t * 0.5)
          + Math.sin(theta * 1.5 + r * 0.003) * 20 * t * t;     // outer warp
      o.s = sz;
    }
  });

  /* ---------- Diffuse cloud layer: huge soft sprites tracing the arms --- */
  buildLayer({
    count: 12000, tex: glowTex, opacity: 0.046, renderOrder: 1, rot: 0.011,
    blending: THREE.AdditiveBlending, pulse: true,
    gen: function (i, o) {
      if (Math.random() < 0.22) {           // warm core envelope
        const rr = CORE_R * 1.35 * Math.pow(Math.random(), 1.8);
        const th0 = Math.random() * Math.PI * 2;
        o.x = Math.cos(th0) * rr; o.z = Math.sin(th0) * rr;
        o.y = gauss() * 50;
        const b0 = 0.38 + Math.random() * 0.30;
        o.r = 0.62 * b0; o.g = 0.46 * b0; o.b = 0.28 * b0;
        o.s = 55 + Math.random() * 70;
        return;
      }
      const arm = (Math.random() * ARM_COUNT) | 0;
      const armOff = arm * (Math.PI * 2 / ARM_COUNT);
      const r = GALAXY_R * (0.06 + 0.94 * Math.pow(Math.random(), 0.75));
      const t = r / GALAXY_R;
      let theta = armOff + r * WIND;
      if (Math.random() < 0.12) theta += 0.38 + r * 0.0009;
      const spread = 22 + r * 0.16;
      o.x = Math.cos(theta) * r + gauss() * spread;
      o.z = Math.sin(theta) * r + gauss() * spread;
      o.y = gauss() * (14 + 40 * Math.exp(-r / 220));
      const p = Math.random();
      let cr, cg, cb;
      if (p < 0.34) { cr = 0.30; cg = 0.55; cb = 1.00; }       // cyan
      else if (p < 0.62) { cr = 0.25; cg = 0.45; cb = 0.95; }  // azure
      else if (p < 0.86) { cr = 0.55; cg = 0.32; cb = 0.95; }  // violet
      else if (p < 0.95) { cr = 0.80; cg = 0.30; cb = 0.85; }  // magenta
      else { cr = 0.95; cg = 0.45; cb = 0.70; }                // pink
      const warm = 1 - sstep(0.08, 0.30, t);
      cr += (0.85 - cr) * warm * 0.7; cg += (0.62 - cg) * warm * 0.7; cb += (0.38 - cb) * warm * 0.7;
      const b1 = 0.24 + Math.random() * 0.28;
      o.r = cr * b1; o.g = cg * b1; o.b = cb * b1;
      o.s = 26 + Math.random() * 64 + t * 30;
    }
  });

  /* ---------- Stellar nurseries: compact bright clusters along arms --- */
  (function () {
    const CLUSTERS = 230, PER = 39, COUNT = CLUSTERS * PER;
    const pos = new Float32Array(COUNT * 3);
    const col = new Float32Array(COUNT * 3);
    const siz = new Float32Array(COUNT);
    let idx = 0;
    for (let c = 0; c < CLUSTERS; c++) {
      const arm = (Math.random() * ARM_COUNT) | 0;
      const r = GALAXY_R * (0.20 + 0.75 * Math.random());
      const th = arm * (Math.PI * 2 / ARM_COUNT) + r * WIND + gauss() * 0.05;
      const cx = Math.cos(th) * r, cz = Math.sin(th) * r, cy = gauss() * 12;
      const hue = Math.random();
      let br, bg, bb;
      if (hue < 0.45) { br = 0.75; bg = 0.88; bb = 1.00; }      // blue-white
      else if (hue < 0.75) { br = 0.55; bg = 0.85; bb = 1.00; } // cyan
      else if (hue < 0.92) { br = 1.00; bg = 0.62; bb = 0.88; } // pink
      else { br = 1.00; bg = 0.95; bb = 0.85; }                 // white
      const n = PER + ((Math.random() * 10) | 0) - 5;
      for (let k = 0; k < n && idx < COUNT; k++, idx++) {
        const d = Math.abs(gauss()) * 14 + 2;
        const a = Math.random() * Math.PI * 2, ph = Math.acos(2 * Math.random() - 1);
        pos[idx * 3] = cx + Math.sin(ph) * Math.cos(a) * d;
        pos[idx * 3 + 1] = cy + Math.cos(ph) * d * 0.6;
        pos[idx * 3 + 2] = cz + Math.sin(ph) * Math.sin(a) * d;
        const bright = (0.90 + Math.random() * 0.50) * (0.85 + Math.random() * 0.30);
        col[idx * 3] = br * bright; col[idx * 3 + 1] = bg * bright; col[idx * 3 + 2] = bb * bright;
        siz[idx] = (k === 0) ? 8 + Math.random() * 6 : 2.2 + Math.random() * 3.5;
      }
    }
    // fill any remainder with lone bright field stars along the arms
    for (; idx < COUNT; idx++) {
      const arm2 = (Math.random() * ARM_COUNT) | 0;
      const r2 = GALAXY_R * (0.25 + 0.70 * Math.random());
      const th2 = arm2 * (Math.PI * 2 / ARM_COUNT) + r2 * WIND;
      pos[idx * 3] = Math.cos(th2) * r2 + gauss() * 20;
      pos[idx * 3 + 1] = gauss() * 14;
      pos[idx * 3 + 2] = Math.sin(th2) * r2 + gauss() * 20;
      col[idx * 3] = 0.95; col[idx * 3 + 1] = 0.97; col[idx * 3 + 2] = 1.0;
      siz[idx] = 3.0 + Math.random() * 3.0;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('aColor', new THREE.BufferAttribute(col, 3));
    geo.setAttribute('aSize', new THREE.BufferAttribute(siz, 1));
    const mat = makePointsMaterial({
      tex: starTex, opacity: 1.0, blending: THREE.AdditiveBlending, pulse: false
    });
    const points = new THREE.Points(geo, mat);
    points.frustumCulled = false;
    points.renderOrder = 1;
    scene.add(points);
    galaxyLayers.push({ points, mat, geo, full: COUNT, baseOp: 1.0, rot: 0.011 });
  })();

  /* ---------- Galactic halo: dim flattened sphere, slowest rotation --- */
  buildLayer({
    count: 12000, tex: starTex, opacity: 0.55, renderOrder: 1, rot: 0.004,
    blending: THREE.AdditiveBlending, pulse: false,
    gen: function (i, o) {
      const rr = GALAXY_R * 0.85 * Math.pow(Math.random(), 0.42);
      const th = Math.random() * Math.PI * 2, ph = Math.acos(2 * Math.random() - 1);
      o.x = rr * Math.sin(ph) * Math.cos(th);
      o.y = rr * Math.cos(ph) * 0.75;
      o.z = rr * Math.sin(ph) * Math.sin(th);
      const b = (0.20 + Math.random() * 0.22);
      if (Math.random() < 0.5) { o.r = 0.95 * b; o.g = 0.85 * b; o.b = 0.65 * b; }
      else { o.r = 0.65 * b; o.g = 0.75 * b; o.b = 1.00 * b; }
      o.s = 1.5 + Math.random() * 2.0;
    }
  });

  /* ---------- Foreground bright stars + diffraction-cross flares ------ */
  buildLayer({
    count: 1500, tex: starTex, opacity: 1.0, renderOrder: 1, rot: 0.011,
    blending: THREE.AdditiveBlending, pulse: false,
    gen: function (i, o) {
      const r = GALAXY_R * 1.05 * Math.sqrt(Math.random());
      const th = Math.random() * Math.PI * 2;
      o.x = Math.cos(th) * r; o.z = Math.sin(th) * r;
      o.y = gauss() * 30;
      const p = Math.random();
      const b = 0.85 + Math.random() * 0.35;
      if (p < 0.55) { o.r = 1.00 * b; o.g = 1.00 * b; o.b = 1.00 * b; }
      else if (p < 0.80) { o.r = 0.70 * b; o.g = 0.85 * b; o.b = 1.00 * b; }
      else { o.r = 1.00 * b; o.g = 0.88 * b; o.b = 0.62 * b; }
      o.s = 4.0 + Math.random() * 6.0;
    }
  });
  buildLayer({
    count: 380, tex: flareTex, opacity: 1.0, renderOrder: 1, rot: 0.011,
    blending: THREE.AdditiveBlending, pulse: false,
    gen: function (i, o) {
      const r = GALAXY_R * 1.05 * Math.sqrt(Math.random());
      const th = Math.random() * Math.PI * 2;
      o.x = Math.cos(th) * r; o.z = Math.sin(th) * r;
      o.y = gauss() * 26;
      const b = 0.90 + Math.random() * 0.40;
      o.r = b; o.g = b * (0.92 + Math.random() * 0.08); o.b = b * (0.85 + Math.random() * 0.15);
      o.s = 8.0 + Math.random() * 8.0;
    }
  });

  /* ---------- Dust lanes: dark soft particles, normal blending -------- */
  buildLayer({
    count: 16000, tex: glowTex, opacity: 0.68, renderOrder: 2, rot: 0.011,
    blending: THREE.NormalBlending, pulse: false,
    gen: function (i, o) {
      const p = Math.random();
      let cr, cg, cb;
      if (p < 0.30) { cr = 0.050; cg = 0.050; cb = 0.100; }      // very dark navy
      else if (p < 0.55) { cr = 0.070; cg = 0.050; cb = 0.120; } // charcoal violet
      else if (p < 0.80) { cr = 0.090; cg = 0.060; cb = 0.080; } // dark brown-gray
      else { cr = 0.060; cg = 0.070; cb = 0.130; }               // muted indigo
      const jit = 0.70 + Math.random() * 0.60;
      o.r = cr * jit; o.g = cg * jit; o.b = cb * jit;
      if (i < 1400) {                       // dust streaks crossing the bulge
        const s = i % 3;
        const ang = 0.4 + s * 0.9;
        const along = (Math.random() * 2 - 1) * CORE_R * 1.15;
        const across = gauss() * 26;
        const ca = Math.cos(ang), sa = Math.sin(ang);
        o.x = along * ca - across * sa;
        o.z = along * sa + across * ca;
        o.y = gauss() * 20;
        o.s = 12 + Math.random() * 14;
        return;
      }
      const arm = (Math.random() * ARM_COUNT) | 0;
      const armOff = arm * (Math.PI * 2 / ARM_COUNT);
      const r = GALAXY_R * (0.05 + 0.85 * Math.pow(Math.random(), 1.35)); // inner-weighted
      const t = r / GALAXY_R;
      const theta = armOff + r * WIND - (0.10 + 0.05 * (1 - t));          // inner-edge offset
      const spread = (6 + r * 0.07) * 0.6;
      o.x = Math.cos(theta) * r + gauss() * spread;
      o.z = Math.sin(theta) * r + gauss() * spread;
      o.y = gauss() * (7 + 30 * Math.exp(-r / 200)) * (1 - t * 0.4);
      o.s = (18 + Math.random() * 37) * (1.15 - t * 0.45);
    }
  });

  /* ---------- Core glow sprites + galactic halo glow ------------------ */
  const glowSprites = [];
  function addGlowSprite(color, scale, opacity, x, y, z, isCore) {
    const sp = new THREE.Sprite(noTone(new THREE.SpriteMaterial({
      map: glowTex, color, transparent: true, opacity,
      blending: THREE.AdditiveBlending, depthWrite: false
    })));
    sp.scale.set(scale, scale, 1);
    sp.position.set(x || 0, y || 0, z || 0);
    sp.renderOrder = 1;
    scene.add(sp);
    glowSprites.push({ sp, baseOp: opacity, isCore: !!isCore });
    return sp;
  }
  addGlowSprite(0xffdfae, 260, 0.32, 0, 0, 0, true);   // warm bulge glow
  addGlowSprite(0xfff6e0, 110, 0.50, 0, 0, 0, true);   // white-hot hotspot
  addGlowSprite(0x2a3f6e, 2500, 0.028, 0, 0, 0);       // faint galactic halo glow

  /* ---------- Sagittarius A*: black sphere + accretion disk + warped
     far-side arc + photon glow + gravitational lensing shell ---------- */
  const blackHole = new THREE.Mesh(
    new THREE.SphereGeometry(10, 48, 48),
    noTone(new THREE.MeshBasicMaterial({ color: 0x000000 }))
  );
  scene.add(blackHole);

  const photonGlow = new THREE.Sprite(noTone(new THREE.SpriteMaterial({
    map: glowTex, color: 0xfff3d8, transparent: true, opacity: 0.25,
    blending: THREE.AdditiveBlending, depthWrite: false
  })));
  photonGlow.scale.set(22, 22, 1);
  photonGlow.renderOrder = 2;
  scene.add(photonGlow);

  const diskMat = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 } },
    vertexShader: [
      'varying vec3 vPos;',
      'void main() {',
      '  vPos = position;',
      '  vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);',
      '  gl_Position = projectionMatrix * mvPosition;',
      '}'
    ].join('\n'),
    fragmentShader: [
      'uniform float uTime;',
      'varying vec3 vPos;',
      'float hash21(vec2 p) {',
      '  p = fract(p * vec2(234.34, 435.345));',
      '  p += dot(p, p + 34.23);',
      '  return fract(p.x * p.y);',
      '}',
      'float noise2(vec2 p) {',
      '  vec2 i = floor(p); vec2 f = fract(p);',
      '  vec2 u = f * f * (3.0 - 2.0 * f);',
      '  float a = hash21(i);',
      '  float b = hash21(i + vec2(1.0, 0.0));',
      '  float c = hash21(i + vec2(0.0, 1.0));',
      '  float d = hash21(i + vec2(1.0, 1.0));',
      '  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);',
      '}',
      'float fbm2(vec2 p) {',
      '  float v = 0.0; float a = 0.5;',
      '  for (int i = 0; i < 3; i++) { v += a * noise2(p); p = p * 2.13 + vec2(13.7, 7.9); a *= 0.5; }',
      '  return v;',
      '}',
      'void main() {',
      '  float r = length(vPos.xy);',
      '  float ang = atan(vPos.y, vPos.x);',
      '  float t = (r - 12.0) / 33.0;',
      '  float swirl = ang - uTime * 26.0 * pow(r, -1.5);', // Keplerian differential rotation
      '  vec2 p1 = vec2(cos(swirl), sin(swirl)) * r * 0.22;',
      '  float n = fbm2(p1);',
      '  float streak = fbm2(vec2(swirl * 2.5, r * 0.5) + vec2(uTime * 0.03, 0.0));',
      '  vec3 hot  = vec3(1.0, 0.88, 0.70);',
      '  vec3 mid  = vec3(1.0, 0.52, 0.16);',
      '  vec3 edge = vec3(0.40, 0.09, 0.03);',
      '  vec3 col = mix(hot, mid, smoothstep(0.02, 0.45, t));',
      '  col = mix(col, edge, smoothstep(0.45, 1.0, t));',
      '  float bright = 0.45 + 0.6 * n + 0.3 * streak;',
      '  float dop = 0.8 + 0.45 * sin(ang + 0.8);', // relativistic-beaming asymmetry
      '  float alpha = smoothstep(0.0, 0.10, t) * (1.0 - smoothstep(0.70, 1.0, t));',
      '  gl_FragColor = vec4(col * bright * dop * 1.05, alpha);',
      '}'
    ].join('\n'),
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending
  });
  const disk = new THREE.Mesh(new THREE.RingGeometry(12, 45, 128, 1), diskMat);
  disk.rotation.set(-Math.PI / 2 + 0.35, 0, 0.18);
  disk.renderOrder = 2;
  scene.add(disk);

  // Warped far-side arc: the gravitationally lensed image of the disk's
  // far side, arcing above the event horizon.
  const diskArc = new THREE.Mesh(new THREE.RingGeometry(13, 38, 128, 1, Math.PI * 0.15, Math.PI * 1.1), diskMat);
  diskArc.rotation.set(-Math.PI / 2 + 0.85, 0.3, 0);
  diskArc.position.y = 7;
  diskArc.renderOrder = 2;
  scene.add(diskArc);

  // Gravitational lensing shell: samples a render-target of the scene
  // with a 1/r^2 screen-space deflection around the black hole.
  const rt = new THREE.WebGLRenderTarget(2, 2, {
    minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, format: THREE.RGBAFormat
  });
  const lensMat = new THREE.ShaderMaterial({
    uniforms: {
      tDiffuse: { value: rt.texture },
      uResolution: { value: new THREE.Vector2(2, 2) },
      uCenter: { value: new THREE.Vector2(0.5, 0.5) },
      uStrength: { value: 0.0006 }
    },
    vertexShader: [
      'varying vec3 vNormW;',
      'varying vec3 vViewW;',
      'void main() {',
      '  vec4 wp = modelMatrix * vec4(position, 1.0);',
      '  vNormW = normalize(mat3(modelMatrix) * normal);',
      '  vViewW = cameraPosition - wp.xyz;',
      '  vec4 mvPosition = viewMatrix * wp;',
      '  gl_Position = projectionMatrix * mvPosition;',
      '}'
    ].join('\n'),
    fragmentShader: [
      'uniform sampler2D tDiffuse;',
      'uniform vec2 uResolution;',
      'uniform vec2 uCenter;',
      'uniform float uStrength;',
      'varying vec3 vNormW;',
      'varying vec3 vViewW;',
      'void main() {',
      '  vec2 uv = gl_FragCoord.xy / uResolution;',
      '  float aspect = uResolution.x / uResolution.y;',
      '  vec2 d = uv - uCenter;',
      '  d.x *= aspect;',
      '  float dist = length(d) + 0.00001;',
      '  float pull = uStrength / (dist * dist + 0.004);',
      '  pull = min(pull, 0.22);',
      '  vec2 off = (d / dist) * pull;',
      '  off.x /= aspect;',
      '  vec3 col = texture2D(tDiffuse, uv - off).rgb;',
      '  vec3 nrm = normalize(vNormW);',
      '  vec3 vdir = normalize(vViewW);',
      '  float fres = abs(dot(nrm, vdir));',
      '  float ring = exp(-pow((fres - 0.30) * 4.5, 2.0));', // Einstein-ring shimmer at the limb
      '  col += vec3(0.55, 0.75, 1.0) * ring * 0.7;',
      '  float alpha = smoothstep(0.03, 0.30, fres);',
      '  gl_FragColor = vec4(col, alpha * 0.96);',
      '}'
    ].join('\n'),
    transparent: true,
    depthWrite: false
  });
  const lensSphere = new THREE.Mesh(new THREE.SphereGeometry(24, 48, 48), lensMat);
  lensSphere.renderOrder = 5;
  lensSphere.visible = false;
  scene.add(lensSphere);

  /* ---------- Famous nebulae: eight raymarched fBM volumes ------------ */
  const NEBULA_POS = new THREE.Vector3(-360, 30, 375); // Orion Nebula (POI anchor)

  const nebulaVert = [
    'varying vec3 vWorldPos;',
    'void main() {',
    '  vec4 wp = modelMatrix * vec4(position, 1.0);',
    '  vWorldPos = wp.xyz;',
    '  vec4 mvPosition = viewMatrix * wp;',
    '  gl_Position = projectionMatrix * mvPosition;',
    '}'
  ].join('\n');
  const nebulaFrag = [
    'uniform float uTime;',
    'uniform vec3 uCenter;',
    'uniform float uRadius;',
    'uniform float uSeed;',
    'uniform float uShell;',
    'uniform float uEmission;',
    'uniform vec3 uColA;',
    'uniform vec3 uColB;',
    'uniform vec3 uColCore;',
    'varying vec3 vWorldPos;',
    'float hash13(vec3 p) {',
    '  p = fract(p * 0.1031);',
    '  p += dot(p, p.zyx + 31.32);',
    '  return fract((p.x + p.y) * p.z);',
    '}',
    'float noise3(vec3 p) {',
    '  vec3 i = floor(p);',
    '  vec3 f = fract(p);',
    '  vec3 u = f * f * (3.0 - 2.0 * f);',
    '  return mix(',
    '    mix(mix(hash13(i + vec3(0.0, 0.0, 0.0)), hash13(i + vec3(1.0, 0.0, 0.0)), u.x),',
    '        mix(hash13(i + vec3(0.0, 1.0, 0.0)), hash13(i + vec3(1.0, 1.0, 0.0)), u.x), u.y),',
    '    mix(mix(hash13(i + vec3(0.0, 0.0, 1.0)), hash13(i + vec3(1.0, 0.0, 1.0)), u.x),',
    '        mix(hash13(i + vec3(0.0, 1.0, 1.0)), hash13(i + vec3(1.0, 1.0, 1.0)), u.x), u.y),',
    '    u.z);',
    '}',
    'float fbm3(vec3 p) {',
    '  float v = 0.0; float a = 0.5;',
    '  for (int i = 0; i < 4; i++) {',
    '    v += a * noise3(p);',
    '    p = p * 2.03 + vec3(17.3, 9.1, 4.7);',
    '    a *= 0.5;',
    '  }',
    '  return v;',
    '}',
    'float density(vec3 lp) {',
    '  float r = length(lp);',
    '  float fall = mix(smoothstep(1.0, 0.2, r), exp(-pow((r - 0.55) * 3.2, 2.0)), uShell);',
    '  if (fall <= 0.001) return 0.0;',
    '  vec3 q = lp * 2.6 + vec3(uSeed * 0.37, uSeed * 0.53, uSeed * 0.71);',
    '  float w = fbm3(q * 0.7 + vec3(0.0, uTime * 0.015, 0.0));',
    '  float d = fbm3(q + (w - 0.5) * 1.4 + vec3(uTime * 0.008, 0.0, 0.0));',
    '  d = max(d - 0.41, 0.0) * 2.4;',
    '  return d * fall;',
    '}',
    'void main() {',
    '  vec3 ro = cameraPosition;',
    '  vec3 rd = normalize(vWorldPos - ro);',
    '  vec3 oc = ro - uCenter;',
    '  float b = dot(oc, rd);',
    '  float c = dot(oc, oc) - uRadius * uRadius;',
    '  float h = b * b - c;',
    '  if (h < 0.0) discard;',
    '  h = sqrt(h);',
    '  float t0 = max(-b - h, 0.0);',
    '  float t1 = -b + h;',
    '  const int STEPS = 26;',
    '  float dt = (t1 - t0) / float(STEPS);',
    '  vec3 col = vec3(0.0);',
    '  float t = t0 + dt * 0.5;',
    '  for (int i = 0; i < STEPS; i++) {',
    '    vec3 pos = ro + rd * t;',
    '    vec3 lp = (pos - uCenter) / uRadius;',
    '    float dens = density(lp);',
    '    if (dens > 0.001) {',
    '      float hue = fbm3(lp * 1.8 + vec3(uSeed));',
    '      vec3 nc = mix(uColA, uColB, hue);',
    '      nc = mix(nc, uColCore, clamp(dens * dens * 3.0, 0.0, 0.75));',
    '      col += nc * dens * dt * 0.028;',
    '    }',
    '    t += dt;',
    '  }',
    '  float core = exp(-pow(length(cross(uCenter - ro, rd)) / (uRadius * 0.35), 2.0));',
    '  col += uColCore * core * 0.05;',
    '  col = 1.0 - exp(-col * 1.0);', // soft shoulder: compress the hot core, keep the wisps
    '  gl_FragColor = vec4(col * uEmission, 1.0);',
    '}'
  ].join('\n');

  const NEBULAS = [
    { name: 'ORION NEBULA', pos: NEBULA_POS, radius: 78, seed: 3.1, shell: 0, emission: 1.15,
      colA: [0.10, 0.25, 0.95], colB: [0.75, 0.20, 0.85], colCore: [1.00, 0.45, 0.15], glow: 0xb07fff },
    { name: 'EAGLE NEBULA', arm: 1, r: 660, radius: 64, seed: 13.7, shell: 0, emission: 1.4,
      colA: [0.05, 0.55, 0.60], colB: [0.85, 0.60, 0.20], colCore: [1.00, 0.85, 0.45], glow: 0x6fd8c0 },
    { name: 'CARINA NEBULA', arm: 2, r: 720, radius: 84, seed: 27.1, shell: 0, emission: 1.5,
      colA: [0.75, 0.15, 0.45], colB: [0.95, 0.45, 0.15], colCore: [1.00, 0.75, 0.40], glow: 0xff7f9a },
    { name: 'LAGOON NEBULA', arm: 0, r: 430, radius: 62, seed: 41.3, shell: 0, emission: 1.5,
      colA: [0.85, 0.20, 0.35], colB: [0.45, 0.20, 0.85], colCore: [1.00, 0.60, 0.45], glow: 0xff8fa8 },
    { name: 'TRIFID NEBULA', arm: 0, r: 505, radius: 52, seed: 55.9, shell: 0, emission: 1.45,
      colA: [0.80, 0.18, 0.30], colB: [0.20, 0.45, 0.95], colCore: [0.85, 0.90, 1.00], glow: 0xd88fff },
    { name: 'CRAB NEBULA', arm: 3, r: 880, radius: 46, seed: 69.2, shell: 0, emission: 1.35,
      colA: [0.25, 0.55, 0.95], colB: [0.85, 0.35, 0.20], colCore: [0.90, 0.95, 1.00], glow: 0x8fc8ff },
    { name: 'RING NEBULA', arm: 2, r: 545, radius: 34, seed: 83.4, shell: 1, emission: 1.5,
      colA: [0.15, 0.75, 0.60], colB: [0.35, 0.35, 0.90], colCore: [0.95, 0.98, 1.00], glow: 0x7fffd8 },
    { name: 'ROSETTE NEBULA', arm: 1, r: 810, radius: 70, seed: 97.6, shell: 0, emission: 1.4,
      colA: [0.85, 0.20, 0.30], colB: [0.90, 0.45, 0.55], colCore: [1.00, 0.80, 0.70], glow: 0xff9fb0 }
  ];

  const nebulaMats = [];
  const nebGlowSprites = [];
  const nebStarPos = [], nebStarCol = [], nebStarSiz = [];

  NEBULAS.forEach(function (nb, idx) {
    if (!nb.pos) {
      const th = nb.arm * (Math.PI * 2 / ARM_COUNT) + nb.r * WIND;
      nb.pos = new THREE.Vector3(Math.cos(th) * nb.r + 25, 12 + (idx % 3) * 14, Math.sin(th) * nb.r + 25);
    }
    const mat = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uCenter: { value: nb.pos },
        uRadius: { value: nb.radius },
        uSeed: { value: nb.seed },
        uShell: { value: nb.shell },
        uEmission: { value: nb.emission },
        uColA: { value: new THREE.Vector3(nb.colA[0], nb.colA[1], nb.colA[2]) },
        uColB: { value: new THREE.Vector3(nb.colB[0], nb.colB[1], nb.colB[2]) },
        uColCore: { value: new THREE.Vector3(nb.colCore[0], nb.colCore[1], nb.colCore[2]) }
      },
      vertexShader: nebulaVert,
      fragmentShader: nebulaFrag,
      transparent: true,
      depthWrite: false,
      side: THREE.BackSide,
      blending: THREE.AdditiveBlending
    });
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(nb.radius, 40, 40), mat);
    mesh.position.copy(nb.pos);
    mesh.renderOrder = 2;
    scene.add(mesh);
    nebulaMats.push(mat);

    const glow = new THREE.Sprite(noTone(new THREE.SpriteMaterial({
      map: glowTex, color: nb.glow, transparent: true, opacity: 0.18,
      blending: THREE.AdditiveBlending, depthWrite: false
    })));
    glow.position.copy(nb.pos);
    glow.scale.set(nb.radius * 1.5, nb.radius * 1.5, 1);
    glow.renderOrder = 1;
    scene.add(glow);
    nebGlowSprites.push({ sp: glow, baseOp: 0.18 });

    for (let s = 0; s < 26; s++) {
      const rr = nb.radius * 0.9 * Math.pow(Math.random(), 1.6);
      const sth = Math.random() * Math.PI * 2, sph = Math.acos(2 * Math.random() - 1);
      nebStarPos.push(
        nb.pos.x + rr * Math.sin(sph) * Math.cos(sth),
        nb.pos.y + rr * Math.cos(sph),
        nb.pos.z + rr * Math.sin(sph) * Math.sin(sth)
      );
      const pb = 0.9 + Math.random() * 0.5, pr = Math.random();
      if (pr < 0.5) nebStarCol.push(pb, pb * 0.95, pb);
      else if (pr < 0.8) nebStarCol.push(pb * 0.7, pb * 0.85, pb);
      else nebStarCol.push(pb, pb * 0.7, pb * 0.9);
      nebStarSiz.push(1.5 + Math.random() * 3.0);
    }

    const lbl = makeLabel(nb.name);
    lbl.position.copy(nb.pos).add(new THREE.Vector3(0, nb.radius + 24, 0));
    lbl.scale.set(52, 11.5, 1);
    scene.add(lbl);
  });

  // All nebulae's embedded young stars, merged into a single draw call.
  (function () {
    const N = nebStarSiz.length;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(nebStarPos), 3));
    geo.setAttribute('aColor', new THREE.BufferAttribute(new Float32Array(nebStarCol), 3));
    geo.setAttribute('aSize', new THREE.BufferAttribute(new Float32Array(nebStarSiz), 1));
    const mat = makePointsMaterial({ tex: starTex, opacity: 1.0, blending: THREE.AdditiveBlending, pulse: false });
    const pts = new THREE.Points(geo, mat);
    pts.frustumCulled = false;
    pts.renderOrder = 3;
    scene.add(pts);
    galaxyLayers.push({ points: pts, mat, geo, full: N, baseOp: 1.0, rot: 0 });
  })();

  /* ---------- The solar system: miniature system in the Orion Arm ----- */
  const SOL_POS = new THREE.Vector3(700, 15, 420);
  const solGroup = new THREE.Group();
  solGroup.position.copy(SOL_POS);
  solGroup.visible = false;
  scene.add(solGroup);

  scene.add(noTone(new THREE.AmbientLight(0x3a4a66, 0.55)));
  const sunLight = new THREE.PointLight(0xfff1dd, 1.5, 0, 0);
  solGroup.add(sunLight);

  const sun = new THREE.Mesh(
    new THREE.SphereGeometry(9, 48, 48),
    noTone(new THREE.MeshBasicMaterial({ map: makeSunTexture() }))
  );
  solGroup.add(sun);

  const sunGlow = new THREE.Sprite(noTone(new THREE.SpriteMaterial({
    map: glowTex, color: 0xffdca6, transparent: true, opacity: 0.7,
    blending: THREE.AdditiveBlending, depthWrite: false
  })));
  sunGlow.scale.set(40, 40, 1);
  solGroup.add(sunGlow);

  const sunCorona = new THREE.Sprite(noTone(new THREE.SpriteMaterial({
    map: glowTex, color: 0xff9a4d, transparent: true, opacity: 0.25,
    blending: THREE.AdditiveBlending, depthWrite: false
  })));
  sunCorona.scale.set(80, 80, 1);
  solGroup.add(sunCorona);

  const orbitMat = noTone(new THREE.LineBasicMaterial({ color: 0x4a5a7a, transparent: true, opacity: 0.35 }));
  const planets = [];

  function addPlanet(cfg) {
    const g = new THREE.Group();
    solGroup.add(g);
    const mesh = new THREE.Mesh(
      new THREE.SphereGeometry(cfg.r, 32, 32),
      noTone(new THREE.MeshStandardMaterial({ map: cfg.tex, roughness: 0.95, metalness: 0.0 }))
    );
    g.add(mesh);
    const pts = [];
    for (let i = 0; i <= 128; i++) {
      const a = i / 128 * Math.PI * 2;
      pts.push(new THREE.Vector3(Math.cos(a) * cfg.dist, 0, Math.sin(a) * cfg.dist));
    }
    solGroup.add(new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(pts), orbitMat));
    const p = {
      group: g, mesh, dist: cfg.dist, speed: cfg.speed,
      angle: Math.random() * Math.PI * 2, spin: cfg.spin || 0.4
    };
    planets.push(p);
    return p;
  }

  addPlanet({ r: 0.55, dist: 15, speed: 0.90, tex: makeRockyTexture('#8a8a8a', '#5c5c5c', 11) }); // Mercury
  addPlanet({ r: 0.90, dist: 21, speed: 0.70, tex: makeRockyTexture('#d9b06a', '#b98a3e', 22) }); // Venus
  const earth = addPlanet({ r: 1.05, dist: 30, speed: 0.55, spin: 0.8, tex: makeEarthTexture() });  // Earth
  addPlanet({ r: 0.70, dist: 38, speed: 0.45, tex: makeMarsTexture() });                            // Mars
  addPlanet({ r: 3.60, dist: 54, speed: 0.25, tex: makeJupiterTexture() });                         // Jupiter
  const saturn = addPlanet({ r: 3.00, dist: 74, speed: 0.18, tex: makeSaturnTexture() });           // Saturn

  // Earth's atmosphere: additive fresnel rim shell.
  const atmoMat = new THREE.ShaderMaterial({
    vertexShader: [
      'varying vec3 vN;',
      'varying vec3 vV;',
      'void main() {',
      '  vN = normalize(normalMatrix * normal);',
      '  vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);',
      '  vV = normalize(-mvPosition.xyz);',
      '  gl_Position = projectionMatrix * mvPosition;',
      '}'
    ].join('\n'),
    fragmentShader: [
      'varying vec3 vN;',
      'varying vec3 vV;',
      'void main() {',
      '  float f = pow(1.0 - abs(dot(normalize(vN), normalize(vV))), 2.6);',
      '  gl_FragColor = vec4(vec3(0.45, 0.72, 1.0) * f * 1.6, f);',
      '}'
    ].join('\n'),
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending
  });
  earth.group.add(new THREE.Mesh(new THREE.SphereGeometry(1.05 * 1.22, 32, 32), atmoMat));

  const saturnRing = new THREE.Mesh(
    new THREE.RingGeometry(3.9, 7.0, 128, 1),
    noTone(new THREE.MeshBasicMaterial({
      map: makeRingTexture(), transparent: true, opacity: 0.95,
      side: THREE.DoubleSide, depthWrite: false
    }))
  );
  saturnRing.rotation.x = -Math.PI / 2;
  saturnRing.renderOrder = 1;
  saturn.group.add(saturnRing);
  saturn.group.rotation.z = 0.32;

  const moon = new THREE.Mesh(
    new THREE.SphereGeometry(0.28, 16, 16),
    noTone(new THREE.MeshStandardMaterial({ map: makeRockyTexture('#9a9a9a', '#6e6e6e', 33), roughness: 1 }))
  );
  solGroup.add(moon);
  let moonAngle = 0;

  // Beacon so the system can be spotted from the macro view.
  const solBeacon = new THREE.Sprite(noTone(new THREE.SpriteMaterial({
    map: glowTex, color: 0x7fd4ff, transparent: true, opacity: 0.5,
    blending: THREE.AdditiveBlending, depthWrite: false
  })));
  solBeacon.position.copy(SOL_POS);
  solBeacon.scale.set(26, 26, 1);
  solBeacon.renderOrder = 1;
  scene.add(solBeacon);

  /* ---------- Labels ---------- */
  const lblBH = makeLabel('SAGITTARIUS A*');
  lblBH.position.set(0, 46, 0);
  scene.add(lblBH);
  const lblSol = makeLabel('SOLAR SYSTEM');
  lblSol.position.copy(SOL_POS).add(new THREE.Vector3(0, 34, 0));
  scene.add(lblSol);

  /* ---------- Cross-scene hotspots: invisible hit proxies around
     Sagittarius A* and the solar system, raycast on the shared canvas
     with drag-vs-click discrimination. Click warps to the target scene. - */
  const raycaster = new THREE.Raycaster();
  const pointerNdc = new THREE.Vector2();
  const proxyMat = new THREE.MeshBasicMaterial({ visible: false, side: THREE.DoubleSide });
  const bhProxy = new THREE.Mesh(new THREE.SphereGeometry(62, 12, 12), proxyMat); // covers sphere + disk + label
  bhProxy.userData.route = 'blackhole';
  scene.add(bhProxy);
  const solProxy = new THREE.Mesh(new THREE.SphereGeometry(100, 12, 12), proxyMat);
  solProxy.position.copy(SOL_POS).add(new THREE.Vector3(0, 16, 0)); // covers system + label
  solProxy.userData.route = 'solar';
  scene.add(solProxy);
  const hitProxies = [bhProxy, solProxy];

  function pickHotspot(e) {
    const rect = ctx.canvas.getBoundingClientRect();
    pointerNdc.set(
      ((e.clientX - rect.left) / rect.width) * 2 - 1,
      -((e.clientY - rect.top) / rect.height) * 2 + 1
    );
    raycaster.setFromCamera(pointerNdc, camera);
    const hits = raycaster.intersectObjects(hitProxies, false);
    return hits.length ? hits[0].object : null;
  }
  let downX = 0, downY = 0, downProxy = null;
  const onHotspotDown = function (e) {
    downX = e.clientX; downY = e.clientY;
    downProxy = pickHotspot(e);
  };
  const onHotspotUp = function (e) {
    if (!downProxy) return;
    const proxy = downProxy;
    downProxy = null;
    if (Math.hypot(e.clientX - downX, e.clientY - downY) > 6) return; // drag, not a click
    if (pickHotspot(e) === proxy) {
      ctx.sfx('blip');
      ctx.navigate(proxy.userData.route);
    }
  };
  const onHotspotMove = function (e) {
    if (e.buttons) return; // don't fight the orbit cursor while dragging
    ctx.canvas.style.cursor = pickHotspot(e) ? 'pointer' : '';
  };
  ctx.canvas.addEventListener('pointerdown', onHotspotDown);
  ctx.canvas.addEventListener('pointerup', onHotspotUp);
  ctx.canvas.addEventListener('pointermove', onHotspotMove);

  /* ---------- Macro camera: framing derived from the galaxy radius ---- */
  function setMacroCamera() {
    const tilt = 31 * Math.PI / 180; // galaxy plane tilted ~31° to the camera
    const tanV = Math.tan(THREE.MathUtils.degToRad(camera.fov * 0.5));
    const tanH = tanV * camera.aspect;
    const need = Math.max(
      (GALAXY_R * 1.04) / tanH,  // fit the full disk width
      (GALAXY_R * 0.60) / tanV   // fit the projected disk height at this tilt
    );
    const dist = THREE.MathUtils.clamp(need / 0.80, 1500, 6500);
    return new THREE.Vector3(0, Math.sin(tilt) * dist, Math.cos(tilt) * dist);
  }

  /* ---------- Points of interest + view modes ------------------------- */
  const POIS = {
    center: {
      name: '银河中心 · Sagittarius A*',
      type: '超大质量黑洞 · SUPERMASSIVE BLACK HOLE',
      pos: new THREE.Vector3(70, 42, 100),
      target: new THREE.Vector3(0, 0, 0),
      stats: [['质量 Mass', '4.3 × 10⁶ M☉'], ['史瓦西直径 Schwarzschild Ø', '≈ 23.6 M km'], ['距太阳 Distance from Sol', '26,000 ly']],
      desc: '银河系中心的致密射电源——一颗质量相当于四百万个太阳的黑洞。坠落等离子体形成接近光速旋转的炽热吸积盘，引力将其后方的星光弯曲成闪烁的爱因斯坦环。',
      descEn: 'The compact radio source anchoring the Milky Way — a black hole weighing four million Suns. Infalling plasma forms an incandescent accretion disk orbiting at nearly light speed, while gravity bends the starlight behind it into a shimmering Einstein ring.'
    },
    nebula: {
      name: '猎户座大星云 · Orion Nebula',
      type: '发射星云 · EMISSION NEBULA · M42',
      pos: new THREE.Vector3(-220, 80, 250),
      target: NEBULA_POS.clone(),
      stats: [['直径 Diameter', '≈ 24 ly'], ['距太阳 Distance from Sol', '1,344 ly'], ['类型 Type', '恒星育婴室 Stellar nursery']],
      desc: '一片巨大的电离氢云，新恒星正在其中诞生。该体积由实时光线步进渲染：分形布朗运动雕刻出致密的气体与尘埃柱，年轻炽热的恒星激发周围等离子体，发出蓝紫色辉光。',
      descEn: 'A vast cloud of ionized hydrogen where new stars are being born. This volume is raymarched in real time: fractional Brownian motion carves dense pillars of gas and dust, glowing blue-violet where young hot stars excite the surrounding plasma.'
    },
    sol: {
      name: '太阳系 · Solar System',
      type: '行星系统 · PLANETARY SYSTEM · ORION ARM',
      pos: new THREE.Vector3(700, 48, 505),
      target: SOL_POS.clone(),
      stats: [['恒星 Star', '太阳 Sol (G2V)'], ['行星 Planets', '8'], ['年龄 Age', '4.6 × 10⁹ yr']],
      desc: '我们的家园星系，坐落在距银河中心约 26,000 光年的猎户-天鹅支臂上。微缩渲染包含发光的太阳、拥有蓝色海洋与绿色大陆的程序化地球，以及带有环带系统的土星。',
      descEn: 'Our home system, tucked into the Orion–Cygnus spur some 26,000 light-years from the galactic core. The miniature rendering includes the glowing Sun, a procedural Earth with blue oceans and green continents, and Saturn with its banded ring system.'
    },
    macro: {
      name: '银河系 · Milky Way',
      type: '棒旋星系 · BARRED SPIRAL GALAXY',
      pos: new THREE.Vector3(0, 900, 1750), // recomputed by setMacroCamera()
      target: new THREE.Vector3(0, 0, 0),
      stats: [['直径 Diameter', '≈ 105,700 ly'], ['恒星 Stars', '100 – 400 billion'], ['年龄 Age', '13.6 × 10⁹ yr']],
      desc: '一个由超过 15 万粒子分层渲染的棒旋星系：致密温暖的核心与中央棒、四条对数旋臂、弥漫电离云、数百个恒星育婴室、剪影于亮带之前的暗尘埃带，以及分布在旋臂上的八个编录星云——猎户、鹰状、船底、礁湖、三叶、蟹状、环状与玫瑰星云。',
      descEn: 'A barred spiral galaxy rendered as more than 150,000 particles in layered systems: a dense warm core and central bar, four logarithmic spiral arms, diffuse ionized clouds, hundreds of stellar nurseries, dark dust lanes silhouetted against the luminous ribbons, and eight cataloged nebulae — Orion, Eagle, Carina, Lagoon, Trifid, Crab, Ring and Rosette — glowing along the arms.'
    }
  };
  POIS.macro.pos = setMacroCamera();

  // Per-view targets: galaxy opacity, bloom strength, solar-system reveal,
  // and orbit-distance clamps.
  const VIEW = {
    macro:  { galaxy: 1.00, bloom: 1.05, sol: 0, minD: 350, maxD: Math.max(2800, POIS.macro.pos.length() * 1.25) },
    center: { galaxy: 0.05, bloom: 0.70, sol: 0, minD: 30,  maxD: 500 },
    nebula: { galaxy: 0.30, bloom: 1.15, sol: 0, minD: 30,  maxD: 700 },
    sol:    { galaxy: 0.30, bloom: 1.00, sol: 1, minD: 6,   maxD: 260 }
  };
  const cur = { galaxy: 1.0, bloom: 1.05, sol: 0 };
  let mode = 'macro';

  function applyTransitions(dt) {
    const tgt = VIEW[mode];
    const k = Math.min(1, dt * 2.2);
    cur.galaxy += (tgt.galaxy - cur.galaxy) * k;
    cur.bloom += (tgt.bloom - cur.bloom) * k;
    cur.sol += (tgt.sol - cur.sol) * k;
    for (let i = 0; i < galaxyLayers.length; i++) {
      const Li = galaxyLayers[i];
      Li.mat.uniforms.uOpacity.value = Li.baseOp * cur.galaxy * (Li.isCore ? cur.galaxy : 1);
    }
    for (let j = 0; j < glowSprites.length; j++) {
      const gj = glowSprites[j];
      gj.sp.material.opacity = gj.baseOp * cur.galaxy * (gj.isCore ? cur.galaxy : 1);
    }
    for (let ng = 0; ng < nebGlowSprites.length; ng++) {
      nebGlowSprites[ng].sp.material.opacity = nebGlowSprites[ng].baseOp * (0.35 + 0.65 * cur.galaxy);
    }
    solBeacon.material.opacity = 0.5 * cur.galaxy;
    bloomPass.strength = cur.bloom;
    solGroup.visible = cur.sol > 0.02;
    const ss = 0.25 + 0.75 * cur.sol;
    solGroup.scale.set(ss, ss, ss);
  }

  /* ---------- UI: info panel, nav buttons, keyboard, collapse --------- */
  let hudCollapsed = false;

  function setActiveButton(key) {
    buttons.forEach(function (b) { b.classList.toggle('active', b.dataset.key === key); });
  }
  // Cross-scene "Enter" buttons: only the black hole and solar system POIs
  // have a dedicated scene to warp into.
  const ENTER_ROUTES = {
    center: { route: 'blackhole', label: '进入黑洞视界 · Enter the Black Hole' },
    sol: { route: 'solar', label: '进入太阳系 · Enter the Solar System' }
  };
  function showInfo(key) {
    const p = POIS[key];
    infoType.textContent = p.type;
    infoName.textContent = p.name;
    infoStats.innerHTML = p.stats.map(function (s) {
      return '<div class="galaxy-stat"><span>' + s[0] + '</span><b>' + s[1] + '</b></div>';
    }).join('');
    infoDesc.textContent = p.desc;
    infoDescEn.textContent = p.descEn;
    const enter = ENTER_ROUTES[key] || null;
    infoEnter.classList.toggle('show', !!enter);
    infoEnter.dataset.route = enter ? enter.route : '';
    if (enter) infoEnter.textContent = enter.label;
    infoEl.classList.add('visible');
  }
  infoEnter.addEventListener('click', function () {
    const route = infoEnter.dataset.route;
    if (!route) return;
    ctx.sfx('blip');
    ctx.navigate(route);
  });
  const onInfoClose = function () { infoEl.classList.remove('visible'); };
  infoEl.querySelector('.galaxy-info-close').addEventListener('click', onInfoClose);

  function setHudCollapsed(collapsed) {
    hudCollapsed = collapsed;
    nav.classList.toggle('collapsed', collapsed);
    hudToggle.innerHTML = collapsed ? '&raquo;' : '&laquo;';
    hudToggle.title = collapsed ? '展开面板 Expand' : '折叠面板 Collapse';
  }
  hudToggle.addEventListener('click', function () {
    setHudCollapsed(!nav.classList.contains('collapsed'));
  });
  if (window.innerWidth < 760) setHudCollapsed(true);

  function persist() {
    ctx.persistState({
      cam: camera.position.toArray(),
      tgt: controls.target.toArray(),
      poi: mode,
      hud: hudCollapsed
    });
  }
  controls.addEventListener('end', persist);

  /* ---------- Cinematic camera flight: smootherstep easing, gentle arc,
     controls disabled while flying, info panel revealed on arrival. ---- */
  let flight = null;
  function flyTo(key, dur) {
    const poi = POIS[key];
    const dist = camera.position.distanceTo(poi.pos);
    flight = {
      key,
      t: 0,
      dur: dur || Math.min(Math.max(dist / 900, 2.2), 5.0),
      fromPos: camera.position.clone(),
      toPos: poi.pos.clone(),
      fromTgt: controls.target.clone(),
      toTgt: poi.target.clone(),
      arc: Math.min(dist * 0.10, 260)
    };
    mode = key;
    controls.enabled = false;
    infoEl.classList.remove('visible');
    setActiveButton(key);
  }
  function updateFlight(dt) {
    if (!flight) return;
    flight.t += dt / flight.dur;
    const t = Math.min(flight.t, 1);
    const k = t * t * t * (t * (t * 6 - 15) + 10); // smootherstep easing
    camera.position.lerpVectors(flight.fromPos, flight.toPos, k);
    camera.position.y += Math.sin(k * Math.PI) * flight.arc; // gentle cinematic arc
    controls.target.lerpVectors(flight.fromTgt, flight.toTgt, k);
    camera.lookAt(controls.target);
    if (flight.t >= 1) {
      const key = flight.key;
      flight = null;
      controls.minDistance = VIEW[key].minD;
      controls.maxDistance = VIEW[key].maxD;
      controls.enabled = true;
      showInfo(key);
      persist();
    }
  }

  buttons.forEach(function (b) {
    b.addEventListener('click', function () { ctx.sfx('blip'); flyTo(b.dataset.key); });
  });
  const onKeyDown = function (e) {
    const map = { '1': 'center', '2': 'nebula', '3': 'sol', '4': 'macro' };
    if (map[e.key]) { ctx.sfx('blip'); flyTo(map[e.key]); }
  };
  document.addEventListener('keydown', onKeyDown);

  /* ---------- Quality scaling: thin the particle layers with
     setDrawRange and slightly enlarge the survivors; bloom renders at
     reduced resolution on medium/low. ---------- */
  const QUALITY = {
    high:   { factor: 1.0, sizeMul: 1.0,  bloomScale: 1.0 },
    medium: { factor: 0.6, sizeMul: 1.22, bloomScale: 0.5 },
    low:    { factor: 0.3, sizeMul: 1.45, bloomScale: 0.25 },
    potato: { factor: 0.15, sizeMul: 1.65, bloomScale: 0.25 }
  };
  let qualityLevel = 'high';
  function applyQuality(level) {
    qualityLevel = QUALITY[level] ? level : 'high';
    const q = QUALITY[qualityLevel];
    for (let i = 0; i < galaxyLayers.length; i++) {
      const L = galaxyLayers[i];
      L.geo.setDrawRange(0, Math.floor(L.full * q.factor));
      L.mat.uniforms.uSizeMul.value = q.sizeMul;
    }
    applyBloomScale();
  }
  const dbs = new THREE.Vector2();
  function applyBloomScale() {
    renderer.getDrawingBufferSize(dbs);
    const s = QUALITY[qualityLevel].bloomScale;
    bloomPass.setSize(Math.max(2, dbs.x * s | 0), Math.max(2, dbs.y * s | 0));
  }

  /* ---------- Resize / point-scale bookkeeping ------------------------ */
  function updateScales() {
    renderer.getDrawingBufferSize(dbs);
    rt.setSize(Math.max(2, dbs.x * 0.5 | 0), Math.max(2, dbs.y * 0.5 | 0)); // half-res lens pass
    lensMat.uniforms.uResolution.value.copy(dbs);
    const uScale = dbs.y / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov * 0.5)));
    for (let i = 0; i < galaxyLayers.length; i++) {
      galaxyLayers[i].mat.uniforms.uScale.value = uScale;
    }
  }
  let resizeTimer = null;
  function resize(w, h, pixelRatio) {
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    composer.setPixelRatio(pixelRatio);
    composer.setSize(w, h);
    applyBloomScale();
    updateScales();
    POIS.macro.pos = setMacroCamera();
    VIEW.macro.maxD = Math.max(2800, POIS.macro.pos.length() * 1.25);
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function () {
      // Keep macro framing on window resize — unless the camera was restored
      // from a shared URL, in which case the user's view is authoritative.
      if (mode === 'macro' && !flight && !restoredFromUrl) flyTo('macro', 0.9);
    }, 250);
  }

  /* ---------- Initial state / intro glide ------------------------------ */
  camera.position.copy(POIS.macro.pos).multiplyScalar(1.15);
  camera.lookAt(0, 0, 0);
  controls.target.set(0, 0, 0);
  updateScales();
  applyQuality(ctx.quality || 'high');

  let introTimer = null;
  let restoredFromUrl = !!ctx.initialState;
  controls.addEventListener('start', function () { restoredFromUrl = false; });
  if (ctx.initialState) {
    setState(ctx.initialState);
  } else {
    setActiveButton('macro');
    introTimer = setTimeout(function () { flyTo('macro', 2.8); }, 250);
  }

  /* ---------- Frame update / render ------------------------------------ */
  let time = 0;
  let readySignaled = false;
  const _v = new THREE.Vector3();

  function update(dt) {
    dt = Math.min(dt, 0.05);
    time += dt;

    // Differential rotation: core fastest, arms moderate, halo slowest.
    for (let i = 0; i < galaxyLayers.length; i++) {
      const L = galaxyLayers[i];
      L.points.rotation.y += dt * L.rot;
      L.mat.uniforms.uTime.value = time;
    }
    for (let nm = 0; nm < nebulaMats.length; nm++) nebulaMats[nm].uniforms.uTime.value = time;
    diskMat.uniforms.uTime.value = time;

    const s = 40 + Math.sin(time * 1.7) * 1.8;
    sunGlow.scale.set(s, s, 1);

    for (let p = 0; p < planets.length; p++) {
      const pl = planets[p];
      pl.angle += dt * pl.speed * 0.4;
      pl.group.position.set(Math.cos(pl.angle) * pl.dist, 0, Math.sin(pl.angle) * pl.dist);
      pl.mesh.rotation.y += dt * pl.spin;
    }
    moonAngle += dt * 1.7;
    moon.position.set(
      earth.group.position.x + Math.cos(moonAngle) * 2.3,
      Math.sin(moonAngle * 0.9) * 0.35,
      earth.group.position.z + Math.sin(moonAngle) * 2.3
    );

    applyTransitions(dt);
    updateFlight(dt);
    if (!flight) controls.update();
  }

  function render() {
    // Gravitational-lensing pre-pass: only near the black hole.
    const nearCore = camera.position.length() < 420;
    if (nearCore) {
      _v.set(0, 0, 0).project(camera);
      if (_v.z < 1) {
        lensMat.uniforms.uCenter.value.set(_v.x * 0.5 + 0.5, _v.y * 0.5 + 0.5);
        lensSphere.visible = false;
        renderer.setRenderTarget(rt);
        renderer.render(scene, camera);
        renderer.setRenderTarget(null);
        lensSphere.visible = true;
      } else {
        lensSphere.visible = false;
      }
    } else {
      lensSphere.visible = false;
    }

    composer.render();
    if (!readySignaled) { readySignaled = true; ctx.onReady(); }
  }

  /* ---------- State ----------------------------------------------------- */
  function getState() {
    return {
      cam: camera.position.toArray(),
      tgt: controls.target.toArray(),
      poi: mode,
      hud: hudCollapsed
    };
  }
  function setState(state) {
    if (!state || typeof state !== 'object') return;
    if (Array.isArray(state.cam) && state.cam.length === 3) camera.position.fromArray(state.cam);
    if (Array.isArray(state.tgt) && state.tgt.length === 3) controls.target.fromArray(state.tgt);
    const key = (state.poi && POIS[state.poi]) ? state.poi : 'macro';
    mode = key;
    cur.galaxy = VIEW[key].galaxy;
    cur.bloom = VIEW[key].bloom;
    cur.sol = VIEW[key].sol;
    controls.minDistance = VIEW[key].minD;
    controls.maxDistance = VIEW[key].maxD;
    setActiveButton(key);
    showInfo(key);
    setHudCollapsed(!!state.hud);
    camera.lookAt(controls.target);
    controls.update();
  }

  /* ---------- Dispose ---------------------------------------------------- */
  let disposed = false;
  function dispose() {
    if (disposed) return;
    disposed = true;
    clearTimeout(introTimer);
    clearTimeout(resizeTimer);
    document.removeEventListener('keydown', onKeyDown);
    controls.removeEventListener('end', persist);
    controls.dispose();
    ctx.canvas.removeEventListener('pointerdown', onHotspotDown);
    ctx.canvas.removeEventListener('pointerup', onHotspotUp);
    ctx.canvas.removeEventListener('pointermove', onHotspotMove);
    ctx.canvas.style.cursor = '';

    // Geometries, materials and material maps (dispose is idempotent).
    scene.traverse(function (o) {
      if (o.geometry) o.geometry.dispose();
      if (o.material) {
        const ms = Array.isArray(o.material) ? o.material : [o.material];
        ms.forEach(function (m) {
          if (m.map) m.map.dispose();
          m.dispose();
        });
      }
    });
    starTex.dispose();
    flareTex.dispose();
    glowTex.dispose();
    rt.dispose();
    composer.dispose();

    renderer.setClearColor(prevClearColor, prevClearAlpha);

    styleEl.remove();
    hudRoot.remove();
  }

  return { camera, controls, update, render, resize, setQuality: applyQuality, getState, setState, flyTo, dispose };
}
