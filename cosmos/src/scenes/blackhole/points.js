// Single-draw-call GPU point-sprite layers, mirroring the original
// createPointsMesh / createPointsMaterial / spawnPointsEntity helpers:
// one BufferGeometry + one ShaderMaterial + one THREE.Points per layer,
// additive blending (ONE, ONE equivalent — fragment outputs premultiplied
// rgb with alpha = 1), depthWrite off, frustum culling off.

import * as THREE from 'three';

const LAYER_DEFAULTS = {
  blending: THREE.AdditiveBlending,
  depthWrite: false,
  depthTest: true,
  transparent: true,
};

// Seeded layer (haze / disk / jet): every vertex is just a vec4 aSeed; all
// motion lives in the vertex shader. A dummy `position` attribute is kept
// only because WebGLRenderer derives the draw count from it.
export function createSeedPoints(name, count, vertexShader, fragmentShader, uniforms, seedW) {
  const geometry = new THREE.BufferGeometry();
  const seeds = new Float32Array(count * 4);
  for (let i = 0; i < count; i++) {
    const o = i * 4;
    seeds[o] = Math.random();
    seeds[o + 1] = Math.random();
    seeds[o + 2] = Math.random();
    seeds[o + 3] = seedW ? seedW(i) : Math.random();
  }
  geometry.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 4));
  geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(count * 3), 3));

  const material = new THREE.ShaderMaterial({
    vertexShader,
    fragmentShader,
    uniforms,
    ...LAYER_DEFAULTS,
  });

  const points = new THREE.Points(geometry, material);
  points.name = name;
  points.frustumCulled = false;
  return points;
}

// Starfield layer: explicit position / color / size attributes.
export function createStarPoints(name, count, vertexShader, fragmentShader, uniforms) {
  const geometry = new THREE.BufferGeometry();
  const pos = new Float32Array(count * 3);
  const col = new Float32Array(count * 3);
  const size = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    // uniform direction on a sphere shell
    const u = Math.random() * 2 - 1;
    const phi = Math.random() * Math.PI * 2;
    const s = Math.sqrt(1 - u * u);
    const radius = 420 + Math.random() * 520;
    const o = i * 3;
    pos[o] = s * Math.cos(phi) * radius;
    pos[o + 1] = u * radius;
    pos[o + 2] = s * Math.sin(phi) * radius;
    // color palette: mostly white, some blue / warm / faint red
    const b = 0.35 + Math.random() * 0.65;
    const p = Math.random();
    let cr, cg, cb;
    if (p < 0.60) { cr = 1.00; cg = 1.00; cb = 1.00; }
    else if (p < 0.80) { cr = 0.65; cg = 0.75; cb = 1.00; }
    else if (p < 0.95) { cr = 1.00; cg = 0.80; cb = 0.55; }
    else { cr = 1.00; cg = 0.50; cb = 0.40; }
    col[o] = cr * b;
    col[o + 1] = cg * b;
    col[o + 2] = cb * b;
    size[i] = 1 + Math.random() * 2.4; // multiplied by uPixelRatio in the shader
  }
  geometry.setAttribute('aPos', new THREE.BufferAttribute(pos, 3));
  geometry.setAttribute('aColor', new THREE.BufferAttribute(col, 3));
  geometry.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
  geometry.setAttribute('position', new THREE.BufferAttribute(pos, 3)); // draw-count + raycast sanity

  const material = new THREE.ShaderMaterial({
    vertexShader,
    fragmentShader,
    uniforms,
    ...LAYER_DEFAULTS,
  });

  const points = new THREE.Points(geometry, material);
  points.name = name;
  points.frustumCulled = false;
  return points;
}
