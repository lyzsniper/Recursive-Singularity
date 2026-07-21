// HELIO — interactive 3D solar system, ported from kimi-sun/index.html (r128 UMD)
// to the COSMOS scene-module contract (see ../CONTRACT.md).
//
// Textures are procedural (see ./textures.js); for Earth/Moon we additionally
// try local bundled downloads from the three.js examples (MIT, see
// cosmos/assets/planets/) and fall back to the procedural painters on error.
// No runtime network fetches beyond same-origin static assets.

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { mulberry32, buildTextures } from './textures.js';

const SUN_R = 12;
const BASE_ORBIT = 0.18;          // rad/s at 1× for a 1-year period
const RING_INNER = 7.4, RING_OUTER = 12.8;

const STAR_COUNT = 2600;
const BELT_COUNT = 2200;
const QUALITY_SCALE = { high: 1, medium: 0.6, low: 0.3, potato: 0.15 };

const PLANETS = [
  { key: 'mercury', name: 'Mercury', cn: '水星', type: 'Rocky Planet', typeCn: '岩质行星', radius: 1.1, dist: 26, period: 0.241, rotDays: 58.6, tilt: 0.03, seg: 32, rough: 1,
    info: { dist: '57.9 million km', day: '58.6 Earth days', year: '88 Earth days',
            fact: 'Mercury swings from −180 °C at night to 430 °C by day — the wildest temperature range of any planet.' } },
  { key: 'venus', name: 'Venus', cn: '金星', type: 'Rocky Planet', typeCn: '岩质行星', radius: 2.1, dist: 36, period: 0.615, rotDays: 243, tilt: 177.4, seg: 40, rough: 1,
    info: { dist: '108.2 million km', day: '243 Earth days', year: '225 Earth days',
            fact: 'Venus spins backwards (its 177° tilt means the Sun rises in the west) and its CO₂ greenhouse makes it the hottest planet at ~465 °C.' } },
  { key: 'earth', name: 'Earth', cn: '地球', type: 'Rocky Planet', typeCn: '岩质行星', radius: 2.3, dist: 48, period: 1, rotDays: 1, tilt: 23.4, seg: 48, rough: 0.7,
    info: { dist: '149.6 million km', day: '23.9 hours', year: '365.25 days',
            fact: 'The only known world with liquid-water oceans on the surface — and life. Its magnetic field shields the atmosphere from the solar wind.' } },
  { key: 'mars', name: 'Mars', cn: '火星', type: 'Rocky Planet', typeCn: '岩质行星', radius: 1.5, dist: 60, period: 1.881, rotDays: 1.03, tilt: 25.2, seg: 36, rough: 1,
    info: { dist: '227.9 million km', day: '24.6 hours', year: '687 Earth days',
            fact: 'Home to Olympus Mons, a shield volcano nearly three times the height of Mount Everest.' } },
  { key: 'jupiter', name: 'Jupiter', cn: '木星', type: 'Gas Giant', typeCn: '气态巨行星', radius: 7.2, dist: 84, period: 11.86, rotDays: 0.41, tilt: 3.1, seg: 64, rough: 0.95,
    info: { dist: '778.5 million km', day: '9.9 hours', year: '11.9 Earth years',
            fact: 'The Great Red Spot is a storm wider than Earth that has been raging for at least 190 years.' } },
  { key: 'saturn', name: 'Saturn', cn: '土星', type: 'Gas Giant', typeCn: '气态巨行星', radius: 6.0, dist: 108, period: 29.45, rotDays: 0.44, tilt: 26.7, seg: 64, rough: 0.95, rings: true,
    info: { dist: '1.43 billion km', day: '10.7 hours', year: '29.4 Earth years',
            fact: 'Saturn’s rings are 280,000 km wide yet only about 10 metres thick — mostly water ice.' } },
  { key: 'uranus', name: 'Uranus', cn: '天王星', type: 'Ice Giant', typeCn: '冰质巨行星', radius: 3.8, dist: 130, period: 84.02, rotDays: 0.72, tilt: 97.8, seg: 48, rough: 0.95,
    info: { dist: '2.87 billion km', day: '17.2 hours', year: '84 Earth years',
            fact: 'Uranus rolls around the Sun on its side — likely knocked over by an ancient giant impact.' } },
  { key: 'neptune', name: 'Neptune', cn: '海王星', type: 'Ice Giant', typeCn: '冰质巨行星', radius: 3.6, dist: 148, period: 164.8, rotDays: 0.67, tilt: 28.3, seg: 48, rough: 0.95,
    info: { dist: '4.50 billion km', day: '16.1 hours', year: '164.8 Earth years',
            fact: 'Neptune’s supersonic winds reach 2,100 km/h — the fastest in the Solar System.' } }
];

const HUD_CSS = `
  .solar-title{ position:fixed; top:20px; left:20px; padding:14px 22px; }
  .solar-title .panel-title{ font-size:19px; letter-spacing:4px; }
  .solar-presets{ position:fixed; top:92px; right:20px; display:flex; gap:8px; padding:10px; }
  .solar-presets .btn{ display:flex; flex-direction:column; align-items:center; line-height:1.25; }
  .solar-presets .btn small{ font-size:9px; letter-spacing:2px; opacity:0.5; font-weight:400; }
  .solar-time-panel{
    position:fixed; left:20px; bottom:20px;
    display:flex; align-items:center; gap:16px; padding:12px 20px 12px 12px;
  }
  .solar-play-btn{
    width:44px; height:44px; border-radius:50%; flex:0 0 auto;
    border:1px solid rgba(255,179,92,0.5); cursor:pointer;
    background:radial-gradient(circle at 35% 30%, rgba(255,200,130,0.35), rgba(255,150,60,0.12));
    color:#ffd9a0; font-size:15px; line-height:1;
    transition:box-shadow .25s, transform .25s;
  }
  .solar-play-btn:hover{ box-shadow:0 0 18px rgba(255,179,92,0.5); transform:scale(1.06); }
  .solar-speed-wrap{ display:flex; flex-direction:column; gap:4px; }
  .solar-speed-wrap label{ font-size:10px; letter-spacing:2.5px; text-transform:uppercase; opacity:0.55; }
  .solar-speed-slider{
    -webkit-appearance:none; appearance:none; width:190px; height:4px; border-radius:2px;
    background:linear-gradient(90deg, var(--accent-warm), rgba(110,168,255,0.35));
    outline:none; cursor:pointer;
  }
  .solar-speed-slider::-webkit-slider-thumb{
    -webkit-appearance:none; appearance:none; width:15px; height:15px; border-radius:50%;
    background:#fff; border:2px solid var(--accent-warm);
    box-shadow:0 0 10px rgba(255,179,92,0.8); cursor:pointer;
  }
  .solar-speed-slider::-moz-range-thumb{
    width:13px; height:13px; border-radius:50%;
    background:#fff; border:2px solid var(--accent-warm);
    box-shadow:0 0 10px rgba(255,179,92,0.8); cursor:pointer;
  }
  .solar-speed-label{
    font-family:'Orbitron', monospace; font-size:14px; min-width:56px; text-align:right;
    color:#ffd9a0; text-shadow:0 0 12px rgba(255,179,92,0.5);
  }
  .solar-hint{
    position:fixed; bottom:24px; left:50%; transform:translateX(-50%);
    font-size:11px; letter-spacing:2.5px; text-transform:uppercase; opacity:0.5; pointer-events:none;
  }
  .solar-unfocus{ position:fixed; bottom:86px; left:50%; transform:translateX(-50%); }
  .solar-hidden{ display:none !important; }
  .solar-info-card{
    position:fixed; top:50%; right:24px; width:330px;
    padding:26px 24px 22px;
    transform:translate(130%, -50%);
    transition:transform .6s cubic-bezier(.22,1,.36,1);
  }
  .solar-info-card.visible{ transform:translate(0, -50%); }
  .solar-card-close{
    position:absolute; top:8px; right:14px; background:none; border:none;
    color:var(--text); font-size:24px; cursor:pointer; opacity:0.55; transition:opacity .2s;
  }
  .solar-card-close:hover{ opacity:1; }
  .solar-card-name{
    font-family:'Orbitron', monospace; font-size:26px; font-weight:700; letter-spacing:2px; margin-bottom:8px;
    background:linear-gradient(90deg, #fff, #9dbfff);
    -webkit-background-clip:text; background-clip:text; -webkit-text-fill-color:transparent;
  }
  .solar-badge{
    display:inline-block; font-size:11px; font-weight:600; letter-spacing:2px; text-transform:uppercase;
    padding:4px 12px; border-radius:20px; border:1px solid var(--accent); color:var(--accent); margin-bottom:16px;
  }
  .solar-row{
    display:flex; justify-content:space-between; align-items:baseline; gap:12px;
    padding:9px 0; border-bottom:1px solid rgba(140,170,255,0.12); font-size:14px;
  }
  .solar-row span{ opacity:0.6; letter-spacing:0.5px; }
  .solar-row b{ font-weight:600; text-align:right; }
  .solar-card-fact{
    margin-top:16px; font-size:14px; line-height:1.55; opacity:0.88;
    border-left:2px solid var(--accent-warm); padding-left:12px; font-style:italic;
  }
  .solar-tooltip{
    position:fixed; display:none; pointer-events:none;
    padding:5px 13px; font-size:12px; font-weight:600; letter-spacing:2px; text-transform:uppercase;
  }
  @media (max-width: 760px){
    .solar-title{ top:12px; left:12px; padding:10px 16px; }
    .solar-title .panel-title{ font-size:14px; letter-spacing:3px; }
    .solar-presets{ top:auto; bottom:96px; right:12px; flex-direction:column; padding:8px; gap:6px; }
    .solar-presets .btn{ font-size:11px; padding:8px 11px; }
    .solar-time-panel{ left:12px; bottom:12px; gap:10px; padding:10px 14px 10px 10px; }
    .solar-play-btn{ width:38px; height:38px; font-size:13px; }
    .solar-speed-slider{ width:110px; }
    .solar-speed-label{ font-size:12px; min-width:46px; }
    .solar-hint{ display:none; }
    .solar-unfocus{ bottom:auto; top:74px; left:12px; transform:none; font-size:11px; }
    .solar-info-card{
      top:auto; bottom:0; right:0; left:0; width:100%; max-height:48vh; overflow-y:auto;
      border-radius:18px 18px 0 0; transform:translateY(130%);
    }
    .solar-info-card.visible{ transform:translateY(0); }
    .solar-card-name{ font-size:20px; }
  }
`;

export function createScene(ctx) {
  const renderer = ctx.renderer;
  const canvas = ctx.canvas;

  /* ---------- Renderer state (saved and restored in dispose) ---------- */
  const prevLegacyLights = renderer.useLegacyLights;
  const prevShadowEnabled = renderer.shadowMap.enabled;
  const prevShadowType = renderer.shadowMap.type;
  // The original targeted r128's legacy light falloff; reproduce it exactly.
  renderer.useLegacyLights = true;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  let quality = QUALITY_SCALE[ctx.quality] ? ctx.quality : 'high';
  const qScale = () => QUALITY_SCALE[quality];

  /* ---------- Scene / Camera / Controls ---------- */
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x02030a);

  const camera = new THREE.PerspectiveCamera(55, ctx.width / ctx.height, 0.1, 5000);
  camera.position.set(0, 140, 400);

  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.dampingFactor = 0.06;
  controls.minDistance = 16;      // keeps the camera out of the Sun
  controls.maxDistance = 420;     // keeps the camera inside the starfield
  controls.autoRotate = false;
  controls.autoRotateSpeed = 0.7;
  controls.enabled = false;       // during intro fly-in

  const maxAniso = renderer.capabilities.getMaxAnisotropy();

  /* ---------- Lighting ---------- */
  const sunLight = new THREE.PointLight(0xfff1dd, 1.35, 600, 1);
  sunLight.position.set(0, 0, 0);
  sunLight.castShadow = true;
  sunLight.shadow.mapSize.width = 1024;
  sunLight.shadow.mapSize.height = 1024;
  sunLight.shadow.camera.near = SUN_R + 3;
  sunLight.shadow.camera.far = 450;
  sunLight.shadow.bias = -0.004;
  scene.add(sunLight);
  scene.add(new THREE.AmbientLight(0x3a4560, 0.7));

  /* ---------- Procedural textures ---------- */
  const TEX = buildTextures(maxAniso, RING_INNER, RING_OUTER);

  /* ---------- Optional real Earth/Moon textures (bundled local assets) ---------- */
  // Downloaded from the three.js r160 examples (MIT License) into
  // cosmos/assets/planets/. They load in the background after the first frame
  // (ctx.onReady is never gated on them); on error the procedural painters
  // above stay in place. extraTextures tracks non-map textures for dispose().
  const extraTextures = [];
  function tryLoadTexture(url, srgb, apply) {
    new THREE.TextureLoader().load(url, function (tex) {
      if (srgb) tex.colorSpace = THREE.SRGBColorSpace;
      tex.anisotropy = maxAniso;
      apply(tex);
    }, undefined, function () {
      console.warn('[solar] texture unavailable, keeping procedural fallback:', url);
    });
  }
  // The specular map marks oceans bright; inverted it becomes a roughness map
  // (oceans smooth → sun glint, land rough) for MeshStandardMaterial.
  function invertToCanvas(tex) {
    const img = tex.image;
    const c = document.createElement('canvas');
    c.width = img.width; c.height = img.height;
    const g = c.getContext('2d');
    g.drawImage(img, 0, 0);
    g.globalCompositeOperation = 'difference';
    g.fillStyle = '#ffffff';
    g.fillRect(0, 0, c.width, c.height);
    tex.image = c;
    tex.needsUpdate = true;
    return tex;
  }

  /* ---------- Quality-scalable sphere registry ---------- */
  const sphereSpecs = [];   // { mesh, r, w, h } — w/h are the high-quality segs
  function scaledSegs(w, h) {
    const q = qScale();
    return [Math.max(12, Math.round(w * q)), Math.max(8, Math.round(h * q))];
  }
  function sphereMesh(r, baseW, baseH, material) {
    const [w, h] = scaledSegs(baseW, baseH);
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(r, w, h), material);
    sphereSpecs.push({ mesh, r, w: baseW, h: baseH });
    return mesh;
  }

  /* ---------- Starfield (shader points with twinkle) ---------- */
  let starMat, starGeo;
  (function buildStars() {
    const N = STAR_COUNT;
    const pos = new Float32Array(N * 3);
    const size = new Float32Array(N);
    const phase = new Float32Array(N);
    const col = new Float32Array(N * 3);
    const rng = mulberry32(4242);
    const palette = [[1, 1, 1], [0.8, 0.86, 1], [1, 0.9, 0.75], [0.9, 0.95, 1], [1, 0.82, 0.82]];
    for (let i = 0; i < N; i++) {
      const z = rng() * 2 - 1, th = rng() * Math.PI * 2;
      const rr = Math.sqrt(1 - z * z);
      const dx = rr * Math.cos(th), dz = rr * Math.sin(th);
      let dy = z;
      if (rng() < 0.35) { dy *= 0.22; }             // milky-way band
      const rad = 550 + rng() * 700;
      pos[i * 3] = dx * rad; pos[i * 3 + 1] = dy * rad; pos[i * 3 + 2] = dz * rad;
      size[i] = 1.2 + rng() * 2.4 + (rng() < 0.04 ? 1.6 : 0);
      phase[i] = rng();
      const pc = palette[(rng() * palette.length) | 0];
      col[i * 3] = pc[0]; col[i * 3 + 1] = pc[1]; col[i * 3 + 2] = pc[2];
    }
    starGeo = new THREE.BufferGeometry();
    starGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    starGeo.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
    starGeo.setAttribute('aPhase', new THREE.BufferAttribute(phase, 1));
    starGeo.setAttribute('aColor', new THREE.BufferAttribute(col, 3));
    starGeo.setDrawRange(0, Math.round(N * qScale()));
    starMat = new THREE.ShaderMaterial({
      uniforms: { uTime: { value: 0 } },
      vertexShader: [
        'attribute float aSize;',
        'attribute float aPhase;',
        'attribute vec3 aColor;',
        'uniform float uTime;',
        'varying vec3 vColor;',
        'varying float vTw;',
        'void main(){',
        '  vColor = aColor;',
        '  float tw = 0.72 + 0.28 * sin(uTime * (0.6 + aPhase * 1.7) + aPhase * 17.0);',
        '  vTw = tw;',
        '  vec4 mv = modelViewMatrix * vec4(position, 1.0);',
        '  gl_PointSize = aSize * tw;',
        '  gl_Position = projectionMatrix * mv;',
        '}'
      ].join('\n'),
      fragmentShader: [
        'varying vec3 vColor;',
        'varying float vTw;',
        'void main(){',
        '  float d = length(gl_PointCoord - vec2(0.5));',
        '  float a = smoothstep(0.5, 0.05, d);',
        '  gl_FragColor = vec4(vColor, a * vTw);',
        '}'
      ].join('\n'),
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending
    });
    const stars = new THREE.Points(starGeo, starMat);
    stars.name = 'starfield';
    stars.frustumCulled = false;
    scene.add(stars);
  })();

  /* ---------- Nebula / glow sprites ---------- */
  function glowSprite(stops, scale, opacity, position) {
    const s = 256;
    const c = document.createElement('canvas'); c.width = s; c.height = s;
    const g2d = c.getContext('2d');
    const g = g2d.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    for (let i = 0; i < stops.length; i++) g.addColorStop(stops[i][0], stops[i][1]);
    g2d.fillStyle = g; g2d.fillRect(0, 0, s, s);
    const tex = new THREE.CanvasTexture(c);
    const mat = new THREE.SpriteMaterial({
      map: tex, transparent: true, opacity: opacity,
      blending: THREE.AdditiveBlending, depthWrite: false
    });
    const sp = new THREE.Sprite(mat);
    sp.scale.set(scale, scale, 1);
    if (position) sp.position.copy(position);
    scene.add(sp);
    return sp;
  }
  glowSprite([[0, 'rgba(96,64,160,0.55)'], [0.5, 'rgba(60,40,110,0.18)'], [1, 'rgba(40,20,80,0)']], 950, 0.10, new THREE.Vector3(-650, 140, -520));
  glowSprite([[0, 'rgba(32,96,128,0.55)'], [0.5, 'rgba(20,60,90,0.16)'], [1, 'rgba(10,30,50,0)']], 850, 0.09, new THREE.Vector3(620, -90, -660));
  glowSprite([[0, 'rgba(128,48,96,0.5)'], [0.5, 'rgba(80,30,70,0.14)'], [1, 'rgba(50,15,40,0)']], 780, 0.08, new THREE.Vector3(120, 260, 720));

  /* ---------- The Sun ---------- */
  const sunMesh = sphereMesh(SUN_R, 64, 48, new THREE.MeshBasicMaterial({ map: TEX.sun }));
  scene.add(sunMesh);

  const coronaMat = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 } },
    vertexShader: [
      'varying vec3 vNormal;',
      'varying vec3 vView;',
      'void main(){',
      '  vec4 wp = modelMatrix * vec4(position, 1.0);',
      '  vNormal = normalize(mat3(modelMatrix) * normal);',
      '  vView = cameraPosition - wp.xyz;',
      '  gl_Position = projectionMatrix * viewMatrix * wp;',
      '}'
    ].join('\n'),
    fragmentShader: [
      'uniform float uTime;',
      'varying vec3 vNormal;',
      'varying vec3 vView;',
      'void main(){',
      '  float f = pow(1.0 - abs(dot(normalize(vNormal), normalize(vView))), 2.2);',
      '  vec3 col = mix(vec3(1.0, 0.45, 0.10), vec3(1.0, 0.85, 0.45), f);',
      '  float pulse = 0.9 + 0.1 * sin(uTime * 1.7);',
      '  gl_FragColor = vec4(col * f * 1.5 * pulse, f * 0.9);',
      '}'
    ].join('\n'),
    side: THREE.BackSide, transparent: true,
    blending: THREE.AdditiveBlending, depthWrite: false
  });
  scene.add(sphereMesh(SUN_R * 1.45, 48, 32, coronaMat));

  glowSprite([[0, 'rgba(255,240,200,1)'], [0.25, 'rgba(255,200,110,0.55)'], [0.6, 'rgba(255,150,60,0.16)'], [1, 'rgba(255,120,40,0)']], SUN_R * 7, 0.95, new THREE.Vector3(0, 0, 0));
  glowSprite([[0, 'rgba(255,220,160,0.6)'], [0.4, 'rgba(255,170,80,0.18)'], [1, 'rgba(255,140,50,0)']], SUN_R * 15, 0.4, new THREE.Vector3(0, 0, 0));

  /* ---------- Build planets ---------- */
  const bodies = [];
  const clickables = [];
  let earthBody = null, moonBody = null, cloudMesh = null, moonOrbit = null, moonMesh = null;
  let atmoMat = null, earthMat = null, cloudMat = null, moonMat = null;

  function registerBody(cfg, group, mesh) {
    const body = {
      name: cfg.name, cn: cfg.cn || '', type: cfg.type, typeCn: cfg.typeCn || '', info: cfg.info,
      radius: cfg.radius, dist: cfg.dist || 0,
      orbitSpeed: cfg.period ? BASE_ORBIT / cfg.period : 0,
      rotSpeed: cfg.rotDays ? 0.35 / cfg.rotDays : 0,
      a0: Math.random() * Math.PI * 2,
      group: group, mesh: mesh,
      getPos: function (v) { return mesh.getWorldPosition(v); }
    };
    mesh.userData.body = body;
    clickables.push(mesh);
    bodies.push(body);
    return body;
  }

  // The Sun as a clickable body
  registerBody({
    name: 'Sun', cn: '太阳', type: 'G-type Main-Sequence Star', typeCn: 'G型主序星', radius: SUN_R, dist: 0, period: 0, rotDays: 0,
    info: { dist: '0 km — system center', day: '~27 Earth days (equator)', year: '—',
            fact: 'The Sun holds 99.86 % of the Solar System’s mass; its core burns at 15 million °C.' }
  }, sunMesh, sunMesh);

  PLANETS.forEach(function (p) {
    const group = new THREE.Group();
    const tiltGroup = new THREE.Group();
    tiltGroup.rotation.z = p.tilt * Math.PI / 180;

    const mesh = sphereMesh(p.radius, p.seg, Math.max(16, p.seg * 0.75 | 0),
      new THREE.MeshStandardMaterial({ map: TEX[p.key], roughness: p.rough, metalness: 0 }));
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    tiltGroup.add(mesh);

    if (p.rings) {
      const ring = new THREE.Mesh(
        new THREE.RingGeometry(RING_INNER, RING_OUTER, 128, 1),
        new THREE.MeshStandardMaterial({
          map: TEX.ring, transparent: true, side: THREE.DoubleSide,
          roughness: 0.9, metalness: 0
        })
      );
      ring.rotation.x = -Math.PI / 2;
      ring.castShadow = true;
      ring.receiveShadow = true;
      tiltGroup.add(ring);
    }

    if (p.key === 'earth') {
      earthMat = mesh.material;
      cloudMesh = sphereMesh(p.radius * 1.02, 48, 32,
        new THREE.MeshStandardMaterial({ map: TEX.clouds, transparent: true, depthWrite: false, roughness: 1 }));
      cloudMat = cloudMesh.material;
      tiltGroup.add(cloudMesh);
      // atmosphere rim
      atmoMat = new THREE.ShaderMaterial({
        uniforms: { uTime: { value: 0 } },
        vertexShader: coronaMat.vertexShader,
        fragmentShader: [
          'varying vec3 vNormal;',
          'varying vec3 vView;',
          'void main(){',
          '  float f = pow(1.0 - abs(dot(normalize(vNormal), normalize(vView))), 2.6);',
          '  vec3 col = mix(vec3(0.15, 0.4, 1.0), vec3(0.5, 0.75, 1.0), f);',
          '  gl_FragColor = vec4(col * f * 1.2, f * 0.55);',
          '}'
        ].join('\n'),
        side: THREE.BackSide, transparent: true,
        blending: THREE.AdditiveBlending, depthWrite: false
      });
      group.add(sphereMesh(p.radius * 1.18, 48, 32, atmoMat));
    }

    group.add(tiltGroup);
    scene.add(group);
    const body = registerBody(p, group, mesh);
    if (p.key === 'earth') earthBody = body;
  });

  // The Moon (orbits Earth)
  (function buildMoon() {
    moonOrbit = new THREE.Group();
    earthBody.group.add(moonOrbit);
    moonMesh = sphereMesh(0.62, 32, 24,
      new THREE.MeshStandardMaterial({ map: TEX.moon, roughness: 1, metalness: 0 }));
    moonMat = moonMesh.material;
    moonMesh.castShadow = true;
    moonMesh.receiveShadow = true;
    moonOrbit.add(moonMesh);
    moonBody = registerBody({
      name: 'Moon', cn: '月球', type: 'Natural Satellite', typeCn: '天然卫星', radius: 0.62, dist: 0, period: 0, rotDays: 27.3,
      info: { dist: '384,400 km from Earth', day: '27.3 Earth days', year: '27.3 days (tidally locked)',
              fact: 'The Moon always shows Earth the same face — and drifts 3.8 cm farther away every year.' }
    }, moonOrbit, moonMesh);
  })();

  // Real Earth/Moon textures (bundled under cosmos/assets/planets/, MIT —
  // three.js examples). Swap in when loaded; procedural maps stay on error.
  function swapMap(mat, tex) {
    if (mat.map) mat.map.dispose();   // replaced procedural texture
    mat.map = tex;
    mat.needsUpdate = true;
  }
  tryLoadTexture('./assets/planets/earth_atmos_2048.jpg', true, function (tex) {
    swapMap(earthMat, tex);
  });
  tryLoadTexture('./assets/planets/earth_clouds_1024.png', true, function (tex) {
    swapMap(cloudMat, tex);
  });
  tryLoadTexture('./assets/planets/earth_specular_2048.jpg', false, function (tex) {
    earthMat.roughnessMap = invertToCanvas(tex);
    earthMat.roughness = 1.0;
    earthMat.needsUpdate = true;
    extraTextures.push(tex);
  });
  tryLoadTexture('./assets/planets/moon_1024.jpg', true, function (tex) {
    swapMap(moonMat, tex);
  });

  /* ---------- Orbit lines ---------- */
  PLANETS.forEach(function (p) {
    const pts = [];
    for (let i = 0; i < 160; i++) {
      const a = i / 160 * Math.PI * 2;
      pts.push(new THREE.Vector3(Math.cos(a) * p.dist, 0, -Math.sin(a) * p.dist));
    }
    const line = new THREE.LineLoop(
      new THREE.BufferGeometry().setFromPoints(pts),
      new THREE.LineBasicMaterial({ color: 0x55688a, transparent: true, opacity: 0.32 })
    );
    scene.add(line);
  });

  /* ---------- Asteroid belt (instanced) ---------- */
  const beltGroup = new THREE.Group();
  let beltMesh = null;
  (function buildBelt() {
    const geo = new THREE.DodecahedronGeometry(1, 0);
    const posAttr = geo.attributes.position;
    const jr = mulberry32(808);
    for (let i = 0; i < posAttr.count; i++) {
      posAttr.setXYZ(i,
        posAttr.getX(i) * (0.75 + jr() * 0.55),
        posAttr.getY(i) * (0.75 + jr() * 0.55),
        posAttr.getZ(i) * (0.75 + jr() * 0.55));
    }
    geo.computeVertexNormals();
    const mat = new THREE.MeshStandardMaterial({ color: 0x9a8f82, roughness: 1, metalness: 0, flatShading: true });
    beltMesh = new THREE.InstancedMesh(geo, mat, BELT_COUNT);
    const dummy = new THREE.Object3D();
    const rng = mulberry32(1337);
    const c = new THREE.Color();
    for (let j = 0; j < BELT_COUNT; j++) {
      const r = 66 + rng() * 12;
      const a = rng() * Math.PI * 2;
      dummy.position.set(Math.cos(a) * r, (rng() - 0.5) * 2.6, -Math.sin(a) * r);
      const s = 0.06 + rng() * rng() * 0.34;
      dummy.scale.set(s * (0.6 + rng() * 0.9), s * (0.5 + rng()), s * (0.6 + rng() * 0.9));
      dummy.rotation.set(rng() * Math.PI, rng() * Math.PI, rng() * Math.PI);
      dummy.updateMatrix();
      beltMesh.setMatrixAt(j, dummy.matrix);
      const g = 0.55 + rng() * 0.5;
      beltMesh.setColorAt(j, c.setRGB(g, g * (0.92 + rng() * 0.12), g * (0.85 + rng() * 0.12)));
    }
    beltMesh.instanceMatrix.needsUpdate = true;
    if (beltMesh.instanceColor) beltMesh.instanceColor.needsUpdate = true;
    beltMesh.count = Math.round(BELT_COUNT * qScale());
    beltGroup.add(beltMesh);
  })();
  scene.add(beltGroup);

  /* ============================================================
     Camera fly-to system (eased LERP)
     ============================================================ */
  const fly = {
    active: false, t: 0, dur: 1.4,
    fromPos: new THREE.Vector3(), fromTg: new THREE.Vector3(),
    posFn: null, tgFn: null, onDone: null
  };
  function easeInOutCubic(t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }
  function flyTo(opts) {
    fly.active = true; fly.t = 0;
    fly.dur = opts.dur || 1.4;
    fly.fromPos.copy(camera.position);
    fly.fromTg.copy(controls.target);
    fly.posFn = typeof opts.pos === 'function' ? opts.pos : function () { return opts.pos; };
    fly.tgFn = typeof opts.target === 'function' ? opts.target : function () { return opts.target; };
    fly.onDone = opts.onDone || null;
    controls.enabled = false;
  }

  let focused = null;
  const prevFocusPos = new THREE.Vector3();
  const focusDelta = new THREE.Vector3();

  /* ============================================================
     HUD (design-system classes + .solar- scoped CSS)
     ============================================================ */
  const styleEl = document.createElement('style');
  styleEl.textContent = HUD_CSS;
  document.head.appendChild(styleEl);

  const hud = ctx.hud;
  const hudEls = [];
  function mount(html) {
    const tmp = document.createElement('div');
    tmp.innerHTML = html.trim();
    const el = tmp.firstElementChild;
    hud.appendChild(el);
    hudEls.push(el);
    return el;
  }

  mount(`
    <header class="glass solar-title">
      <h1 class="panel-title">HELIO · 太阳系</h1>
      <p class="panel-sub">Interactive Solar System</p>
    </header>`);

  const presetsEl = mount(`
    <nav class="glass solar-presets">
      <button class="btn" data-preset="top">俯视<small>TOP-DOWN</small></button>
      <button class="btn" data-preset="earth">地月系<small>EARTH–MOON</small></button>
      <button class="btn" data-preset="cinematic">电影轨道<small>CINEMATIC</small></button>
    </nav>`);

  const timePanelEl = mount(`
    <div class="glass solar-time-panel">
      <button class="solar-play-btn" title="暂停 Pause (Space)">❚❚</button>
      <div class="solar-speed-wrap">
        <label>时间倍率 · Time Warp</label>
        <input type="range" class="solar-speed-slider" min="0" max="100" step="0.5" value="37">
      </div>
      <div class="solar-speed-label">1.0×</div>
    </div>`);

  const unfocusBtn = mount(`<button class="btn solar-unfocus solar-hidden">⟲ &nbsp;返回全景 · System View</button>`);

  const infoCard = mount(`
    <aside class="glass solar-info-card">
      <button class="solar-card-close" title="关闭 Close">×</button>
      <h2 class="solar-card-name"></h2>
      <span class="solar-badge solar-card-type"></span>
      <div class="solar-row"><span>距日距离 · Distance</span><b data-f="dist"></b></div>
      <div class="solar-row"><span>自转周期 · Day Length</span><b data-f="day"></b></div>
      <div class="solar-row"><span>公转周期 · Orbital Period</span><b data-f="year"></b></div>
      <p class="solar-card-fact"></p>
    </aside>`);

  const tooltip = mount(`<div class="glass solar-tooltip"></div>`);
  mount(`<div class="solar-hint">拖动旋转 Drag · 滚轮缩放 Scroll · 点击行星聚焦 Click a planet</div>`);

  const playBtn = timePanelEl.querySelector('.solar-play-btn');
  const speedSlider = timePanelEl.querySelector('.solar-speed-slider');
  const speedLabel = timePanelEl.querySelector('.solar-speed-label');
  const presetBtns = presetsEl.querySelectorAll('.btn');
  const cardClose = infoCard.querySelector('.solar-card-close');
  const cardName = infoCard.querySelector('.solar-card-name');
  const cardType = infoCard.querySelector('.solar-card-type');
  const cardDist = infoCard.querySelector('[data-f="dist"]');
  const cardDay = infoCard.querySelector('[data-f="day"]');
  const cardYear = infoCard.querySelector('[data-f="year"]');
  const cardFact = infoCard.querySelector('.solar-card-fact');

  /* ---------- Time controls ---------- */
  let playing = true;
  let speed = 1;

  function sliderToSpeed(v) { return 0.1 * Math.pow(500, v / 100); }  // 0.1× … 50×, log scale
  function speedToSlider(s) { return 100 * Math.log(s / 0.1) / Math.log(500); }
  function refreshSpeed() {
    speed = sliderToSpeed(parseFloat(speedSlider.value));
    speedLabel.textContent = (speed >= 10 ? speed.toFixed(0) : speed.toFixed(1)) + '×';
  }
  speedSlider.addEventListener('input', refreshSpeed);
  refreshSpeed();

  function setPlaying(v) {
    playing = v;
    playBtn.innerHTML = playing ? '❚❚' : '▶';
    playBtn.title = playing ? '暂停 Pause (Space)' : '播放 Play (Space)';
  }
  function togglePlay() { setPlaying(!playing); }
  playBtn.addEventListener('click', togglePlay);

  /* ---------- Info card / focus ---------- */
  function showCard(body) {
    cardName.textContent = body.cn ? body.name + ' ' + body.cn : body.name;
    cardType.textContent = body.typeCn ? body.type + ' · ' + body.typeCn : body.type;
    cardDist.textContent = body.info.dist;
    cardDay.textContent = body.info.day;
    cardYear.textContent = body.info.year;
    cardFact.textContent = body.info.fact;
    infoCard.classList.add('visible');
  }
  function hideCard() { infoCard.classList.remove('visible'); }

  function setActivePreset(name) {
    presetBtns.forEach(function (b) {
      b.classList.toggle('active', b.getAttribute('data-preset') === name);
    });
  }

  function focusBody(body) {
    focused = body;
    controls.autoRotate = false;
    setActivePreset(null);
    const p = body.getPos(new THREE.Vector3());
    prevFocusPos.copy(p);
    const dir = camera.position.clone().sub(p);
    if (dir.lengthSq() < 1e-4) dir.set(1, 0.4, 1);
    dir.normalize();
    dir.y = Math.max(dir.y, 0.35);
    dir.normalize();
    const dist = body.radius * 4.5 + 2.2;
    flyTo({
      pos: function () { return body.getPos(new THREE.Vector3()).addScaledVector(dir, dist); },
      target: function () { return body.getPos(new THREE.Vector3()); },
      dur: 1.3,
      onDone: function () {
        controls.minDistance = body.radius * 1.7 + 0.4;
        prevFocusPos.copy(body.getPos(new THREE.Vector3()));
      }
    });
    showCard(body);
    unfocusBtn.classList.remove('solar-hidden');
  }

  function unfocus() {
    focused = null;
    controls.autoRotate = false;
    setActivePreset(null);
    hideCard();
    unfocusBtn.classList.add('solar-hidden');
    flyTo({
      pos: new THREE.Vector3(0, 52, 158),
      target: new THREE.Vector3(0, 0, 0),
      dur: 1.4,
      onDone: function () { controls.minDistance = 16; }
    });
  }
  unfocusBtn.addEventListener('click', unfocus);
  cardClose.addEventListener('click', unfocus);

  presetBtns.forEach(function (btn) {
    btn.addEventListener('click', function () {
      const preset = btn.getAttribute('data-preset');
      hideCard();
      unfocusBtn.classList.add('solar-hidden');
      if (preset === 'earth') {
        setActivePreset('earth');
        focusBody(earthBody);
        setActivePreset('earth');
      } else if (preset === 'top') {
        focused = null; controls.autoRotate = false;
        flyTo({
          pos: new THREE.Vector3(0, 235, 0.02),
          target: new THREE.Vector3(0, 0, 0),
          dur: 1.5,
          onDone: function () { controls.minDistance = 16; }
        });
        setActivePreset('top');
      } else if (preset === 'cinematic') {
        focused = null;
        flyTo({
          pos: new THREE.Vector3(138, 24, 72),
          target: new THREE.Vector3(0, 5, 0),
          dur: 1.6,
          onDone: function () {
            controls.minDistance = 16;
            controls.autoRotate = true;
          }
        });
        setActivePreset('cinematic');
      }
    });
  });

  function onKeydown(e) {
    if (e.code === 'Space') { e.preventDefault(); togglePlay(); }
    if (e.code === 'Escape' && focused) unfocus();
  }
  window.addEventListener('keydown', onKeydown);

  /* ---------- Raycasting: hover tooltip + click-to-focus ---------- */
  const raycaster = new THREE.Raycaster();
  const mouse = new THREE.Vector2();
  let downPos = null;
  const prevCursor = canvas.style.cursor;
  canvas.style.cursor = 'grab';

  function onPointerDown(e) {
    downPos = { x: e.clientX, y: e.clientY };
  }
  function onPointerUp(e) {
    if (!downPos) return;
    const dx = e.clientX - downPos.x, dy = e.clientY - downPos.y;
    downPos = null;
    if (dx * dx + dy * dy > 36 || fly.active) return;   // it was a drag, not a click
    mouse.set((e.clientX / window.innerWidth) * 2 - 1, -(e.clientY / window.innerHeight) * 2 + 1);
    raycaster.setFromCamera(mouse, camera);
    const hits = raycaster.intersectObjects(clickables, false);
    if (hits.length && hits[0].object.userData.body) focusBody(hits[0].object.userData.body);
  }
  function onPointerMove(e) {
    if (e.pointerType === 'touch') return;
    if (fly.active) { tooltip.style.display = 'none'; return; }
    mouse.set((e.clientX / window.innerWidth) * 2 - 1, -(e.clientY / window.innerHeight) * 2 + 1);
    raycaster.setFromCamera(mouse, camera);
    const hits = raycaster.intersectObjects(clickables, false);
    if (hits.length && hits[0].object.userData.body) {
      const b = hits[0].object.userData.body;
      tooltip.textContent = b.cn ? b.name + ' ' + b.cn : b.name;
      tooltip.style.display = 'block';
      tooltip.style.left = (e.clientX + 14) + 'px';
      tooltip.style.top = (e.clientY + 12) + 'px';
      canvas.style.cursor = 'pointer';
    } else {
      tooltip.style.display = 'none';
      canvas.style.cursor = 'grab';
    }
  }
  canvas.addEventListener('pointerdown', onPointerDown);
  canvas.addEventListener('pointerup', onPointerUp);
  canvas.addEventListener('pointermove', onPointerMove);

  /* ---------- Simulation state ---------- */
  let simTime = 0;
  let lastElapsed = 0;
  let readySignaled = false;

  /* ---------- Scene instance (contract) ---------- */
  const api = {
    camera,   // exposed for headless smoke tests / debugging
    controls,
    update(dt, elapsed) {
      lastElapsed = elapsed;
      const eff = playing ? speed : 0;
      simTime += dt * eff;

      // Orbits + rotations (counter-clockwise seen from the north ecliptic pole)
      for (let i = 0; i < bodies.length; i++) {
        const b = bodies[i];
        if (b.orbitSpeed) {
          const a = b.a0 + simTime * b.orbitSpeed;
          b.group.position.set(Math.cos(a) * b.dist, 0, -Math.sin(a) * b.dist);
        }
        if (b.rotSpeed) b.mesh.rotation.y = simTime * b.rotSpeed;
      }
      // Moon around Earth
      const ma = 1.3 + simTime * 0.9;
      moonOrbit.position.set(Math.cos(ma) * 4.2, 0, -Math.sin(ma) * 4.2);
      cloudMesh.rotation.y = simTime * (0.35 * 1.3);
      sunMesh.rotation.y = simTime * 0.02;
      beltGroup.rotation.y = simTime * 0.05;

      // Camera fly-to
      if (fly.active) {
        fly.t += dt / fly.dur;
        const e = easeInOutCubic(Math.min(1, fly.t));
        camera.position.lerpVectors(fly.fromPos, fly.posFn(), e);
        controls.target.lerpVectors(fly.fromTg, fly.tgFn(), e);
        if (fly.t >= 1) {
          fly.active = false;
          controls.enabled = true;
          if (fly.onDone) fly.onDone();
        }
      } else if (focused) {
        // Follow the focused body as it orbits
        const p = focused.getPos(new THREE.Vector3());
        focusDelta.copy(p).sub(prevFocusPos);
        camera.position.add(focusDelta);
        controls.target.copy(p);
        prevFocusPos.copy(p);
      }

      controls.update();
    },

    render() {
      // Shader clocks (real time so twinkle/shimmer continue while paused)
      starMat.uniforms.uTime.value = lastElapsed;
      coronaMat.uniforms.uTime.value = lastElapsed;
      renderer.render(scene, camera);
      if (!readySignaled) { readySignaled = true; ctx.onReady(); }
    },

    resize(w, h) {
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    },

    setQuality(level) {
      if (!QUALITY_SCALE[level] || level === quality) return;
      quality = level;
      const q = qScale();
      // Rebuild sphere geometries at the scaled segment counts.
      for (const spec of sphereSpecs) {
        const w = Math.max(12, Math.round(spec.w * q));
        const h = Math.max(8, Math.round(spec.h * q));
        spec.mesh.geometry.dispose();
        spec.mesh.geometry = new THREE.SphereGeometry(spec.r, w, h);
      }
      // Scale starfield density and belt population without reallocating.
      starGeo.setDrawRange(0, Math.round(STAR_COUNT * q));
      beltMesh.count = Math.round(BELT_COUNT * q);
    },

    getState() {
      return {
        cam: camera.position.toArray(),
        tgt: controls.target.toArray(),
        playing: playing,
        speed: speed
      };
    },

    setState(state) {
      if (!state) return;
      fly.active = false;
      focused = null;
      controls.autoRotate = false;
      controls.minDistance = 16;
      controls.enabled = true;
      hideCard();
      unfocusBtn.classList.add('solar-hidden');
      setActivePreset(null);
      if (Array.isArray(state.cam)) camera.position.fromArray(state.cam);
      if (Array.isArray(state.tgt)) controls.target.fromArray(state.tgt);
      if (typeof state.playing === 'boolean') setPlaying(state.playing);
      if (typeof state.speed === 'number' && state.speed > 0) {
        speedSlider.value = String(Math.max(0, Math.min(100, speedToSlider(state.speed))));
        refreshSpeed();
      }
      controls.update();
    },

    dispose() {
      // Listeners + controls
      window.removeEventListener('keydown', onKeydown);
      canvas.removeEventListener('pointerdown', onPointerDown);
      canvas.removeEventListener('pointerup', onPointerUp);
      canvas.removeEventListener('pointermove', onPointerMove);
      controls.dispose();
      canvas.style.cursor = prevCursor;

      // GPU resources: every geometry, material and texture in the scene graph
      scene.traverse(function (obj) {
        if (obj.geometry) obj.geometry.dispose();
        if (obj.material) {
          const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
          mats.forEach(function (m) {
            if (m.map) m.map.dispose();
            m.dispose();
          });
        }
      });
      if (sunLight.shadow && sunLight.shadow.map) {
        sunLight.shadow.map.dispose();
        sunLight.shadow.map = null;
      }
      // Non-map textures (e.g. the inverted Earth roughness map)
      extraTextures.forEach(function (t) { t.dispose(); });

      // DOM
      styleEl.remove();
      hudEls.forEach(function (el) { el.remove(); });

      // Restore shared renderer state
      renderer.useLegacyLights = prevLegacyLights;
      renderer.shadowMap.enabled = prevShadowEnabled;
      renderer.shadowMap.type = prevShadowType;
    }
  };

  // Persist camera state after every orbit interaction.
  controls.addEventListener('end', function () { ctx.persistState(api.getState()); });

  // Cinematic intro fly-in (skipped when restoring persisted state)
  if (ctx.initialState) {
    api.setState(ctx.initialState);
  } else {
    flyTo({
      pos: new THREE.Vector3(0, 52, 158),
      target: new THREE.Vector3(0, 0, 0),
      dur: 2.4,
      onDone: function () { controls.minDistance = 16; }
    });
  }

  return api;
}
