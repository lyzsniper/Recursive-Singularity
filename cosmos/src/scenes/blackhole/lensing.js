// Gravitational lensing post-effect wiring, ported from the PlayCanvas
// LensingEffect (pc.PostEffect) + lensingController script.
//
// In Three.js the effect is a ShaderPass inside an EffectComposer; the pass
// samples `tDiffuse` with a standard 0..1 `vUv` (bottom-left origin — same
// convention as the original vUv0, so the ported math is unchanged).
// The controller below projects the singularity into screen space each frame
// and feeds the pass uniforms; when the singularity is behind the camera the
// pass is disabled and EffectComposer hands the scene straight through.

import * as THREE from 'three';
import { LENS_VS, LENS_FS } from './shaders.js';

export const LensingShader = {
  uniforms: {
    tDiffuse: { value: null },
    uCenter: { value: new THREE.Vector2(0.5, 0.5) },
    uAspect: { value: 1 },
    uRadius: { value: 0.1 },   // screen-space Einstein radius (aspect-corrected)
    uHorizon: { value: 0.05 }, // screen-space photon-capture radius
    uStrength: { value: 1 },
    uTime: { value: 0 },
  },
  vertexShader: LENS_VS,
  fragmentShader: LENS_FS,
};

export function createLensingController(camera, lensingPass, opts = {}) {
  const ringRadius = opts.ringRadius ?? 2.7;    // world-space Einstein ring radius
  const horizonRadius = opts.horizonRadius ?? 1.13; // world-space capture radius
  const strength = opts.strength ?? 1.0;

  const uniforms = lensingPass.uniforms;
  const clip = new THREE.Vector4();
  const fwd = new THREE.Vector3();
  const side = new THREE.Vector3();
  const UP = new THREE.Vector3(0, 1, 0);
  const c = [0, 0];
  const p = [0, 0];

  // world -> GL uv (bottom-left origin, matches the ShaderPass vUv)
  function project(x, y, z, out) {
    clip.set(x, y, z, 1)
      .applyMatrix4(camera.matrixWorldInverse)
      .applyMatrix4(camera.projectionMatrix);
    if (clip.w <= 1e-4) return false; // behind camera
    out[0] = (clip.x / clip.w) * 0.5 + 0.5;
    out[1] = (clip.y / clip.w) * 0.5 + 0.5;
    return true;
  }

  return {
    // width/height: CSS viewport size (same aspect as the drawing buffer)
    update(time, width, height) {
      uniforms.uTime.value = time;
      const aspect = width / Math.max(height, 1);
      uniforms.uAspect.value = aspect;

      camera.updateMatrixWorld();

      if (!project(0, 0, 0, c)) {
        // singularity behind the camera: pass the scene through untouched
        lensingPass.enabled = false;
        return;
      }
      lensingPass.enabled = true;
      uniforms.uCenter.value.set(c[0], c[1]);

      // project a radius along a view-perpendicular axis for a stable screen radius
      camera.getWorldDirection(fwd);
      side.crossVectors(fwd, UP);
      if (side.lengthSq() < 1e-6) side.set(1, 0, 0);
      else side.normalize();

      if (project(side.x * ringRadius, side.y * ringRadius, side.z * ringRadius, p)) {
        const dx = (p[0] - c[0]) * aspect;
        const dy = p[1] - c[1];
        uniforms.uRadius.value = Math.min(Math.sqrt(dx * dx + dy * dy), 2.0);
      }
      if (project(side.x * horizonRadius, side.y * horizonRadius, side.z * horizonRadius, p)) {
        const hx = (p[0] - c[0]) * aspect;
        const hy = p[1] - c[1];
        uniforms.uHorizon.value = Math.min(Math.sqrt(hx * hx + hy * hy), 1.5);
      }
      uniforms.uStrength.value = strength;
    },
  };
}
