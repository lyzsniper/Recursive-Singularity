// Ported GLSL from the PlayCanvas "SINGULARITY" scene (kimi-blackhole/index.html).
// The math is verbatim; only the engine glue changed:
//   matrix_view            -> viewMatrix          (built-in ShaderMaterial uniform)
//   matrix_projection      -> projectionMatrix    (built-in)
//   matrix_viewProjection  -> projectionMatrix * viewMatrix
//   view_position          -> cameraPosition      (built-in, world space; models sit at origin)
// Three.js (WebGL2, non-raw ShaderMaterial) auto-prepends precision, the
// attribute->in / varying->out compatibility defines, and declares
// position/normal/uv + the matrices above, so bodies stay GLSL1-style.

// ---- Accretion haze: large soft sprites, slow sub-Keplerian swirl ----
export const HAZE_VS = /* glsl */ `
attribute vec4 aSeed; // x: radius norm, y: angle0, z/w: randoms
uniform float uTime;
uniform float uInner;
uniform float uOuter;
uniform float uInflow;
uniform float uK;
uniform float uPointScale;
varying vec4 vColor;
vec3 temperature(float t) { // t: 0 = inner (hot) .. 1 = outer (cold)
    vec3 hot  = vec3(0.80, 0.86, 1.00) * 1.4;
    vec3 mid  = vec3(1.00, 0.42, 0.09) * 0.9;
    vec3 cold = vec3(0.32, 0.05, 0.02);
    if (t < 0.22) return mix(hot, mid, t / 0.22);
    return mix(mid, cold, (t - 0.22) / 0.78);
}
void main(void) {
    float r0 = mix(uInner + 0.5, uOuter, pow(aSeed.x, 1.25));
    float cycle = (r0 - uInner) / uInflow;
    float age = mod(uTime + aSeed.w * cycle, cycle);
    float r = r0 - uInflow * age;

    float omega = uK * 0.62 * pow(r, -1.5); // slightly sub-Keplerian flow
    float theta = aSeed.y * 6.2831853 + omega * uTime;

    float turb = sin(theta * 2.0 + uTime * 0.8 + aSeed.z * 31.0);
    float rt = r + turb * 0.08 * r;
    float y = (aSeed.z - 0.5) * (0.34 + 0.55 * r / uOuter) + turb * 0.12;
    vec3 pos = vec3(cos(theta) * rt, y, sin(theta) * rt);

    float t = clamp((r - uInner) / (uOuter - uInner), 0.0, 1.0);
    float heat = pow(uInner / r, 1.3);
    vec3 col = temperature(t) * (0.25 + 1.6 * heat);

    float life = age / cycle;
    float alpha = smoothstep(0.0, 0.12, life) * (1.0 - smoothstep(0.70, 1.0, life));
    vColor = vec4(col, alpha * 0.16); // faint: hundreds overlap additively

    vec4 mvPosition = viewMatrix * vec4(pos, 1.0);
    gl_Position = projectionMatrix * mvPosition;
    float size = mix(0.55, 1.35, aSeed.z) * (1.0 + 0.5 * heat);
    gl_PointSize = clamp(uPointScale * size / max(-mvPosition.z, 0.1), 1.0, 220.0);
}
`;

export const HAZE_FS = /* glsl */ `
varying vec4 vColor;
void main(void) {
    vec2 d = gl_PointCoord - vec2(0.5);
    float a = exp(-dot(d, d) * 7.0); // wide gaussian puff
    gl_FragColor = vec4(vColor.rgb * (a * vColor.a), 1.0); // premultiplied for ONE,ONE
}
`;

// ---- Keplerian disk streaks: omega = sqrt(GM) * r^-1.5 + spiral inflow ----
export const DISK_VS = /* glsl */ `
attribute vec4 aSeed; // x: radius norm, y: angle0, z/w: randoms
uniform float uTime;
uniform float uInner;     // ISCO radius
uniform float uOuter;     // outer disk radius
uniform float uInflow;    // radial inflow speed (world units / s)
uniform float uK;         // Kepler constant sqrt(GM)
uniform float uPointScale;
varying vec4 vColor;
vec3 temperature(float t) { // t: 0 = inner (hot) .. 1 = outer (cold)
    vec3 hot  = vec3(0.75, 0.85, 1.00) * 3.2;  // blinding white-blue
    vec3 mid  = vec3(1.00, 0.45, 0.10) * 1.5;  // fierce orange
    vec3 cold = vec3(0.40, 0.06, 0.02);        // dull red
    if (t < 0.22) return mix(hot, mid, t / 0.22);
    return mix(mid, cold, (t - 0.22) / 0.78);
}
void main(void) {
    float r0 = mix(uInner + 0.25, uOuter, pow(aSeed.x, 1.6));
    float cycle = (r0 - uInner) / uInflow;     // time to spiral from r0 to the ISCO
    float age = mod(uTime + aSeed.w * cycle, cycle);
    float r = r0 - uInflow * age;              // inward radial pull

    float omega = uK * pow(r, -1.5);           // Keplerian angular velocity
    float theta = aSeed.y * 6.2831853 + omega * uTime;

    // turbulence: radius wobble + vertical churn, thicker at large r
    float turb = sin(theta * 3.0 + uTime * 1.9 + aSeed.z * 43.0);
    float rt = r + turb * 0.045 * r;
    float y = (aSeed.z - 0.5) * (0.10 + 0.22 * r / uOuter) + turb * 0.05;
    vec3 pos = vec3(cos(theta) * rt, y, sin(theta) * rt);

    float t = clamp((r - uInner) / (uOuter - uInner), 0.0, 1.0);
    vec3 col = temperature(t);

    // gravitational heating ~ 1/r plus doppler-style beaming asymmetry
    float heat = pow(uInner / r, 1.35);
    vec3 tangent = normalize(vec3(-sin(theta), 0.0, cos(theta)));
    vec3 toCam = normalize(cameraPosition - pos);
    // clamped: the receding side dims but never dies (was going negative)
    float doppler = clamp(1.0 + 0.85 * dot(tangent, toCam), 0.30, 2.6);
    col *= (0.55 + 2.4 * heat) * doppler;

    // fade at birth and as matter crosses the ISCO
    float life = age / cycle;
    float alpha = smoothstep(0.0, 0.10, life) * (1.0 - smoothstep(0.72, 1.0, life));
    vColor = vec4(col, alpha * 0.85);

    vec4 mvPosition = viewMatrix * vec4(pos, 1.0);
    gl_Position = projectionMatrix * mvPosition;
    float size = mix(0.06, 0.17, aSeed.z) * (1.0 + 0.8 * heat);
    gl_PointSize = clamp(uPointScale * size / max(-mvPosition.z, 0.1), 1.0, 72.0);
}
`;

export const DISK_FS = /* glsl */ `
varying vec4 vColor;
void main(void) {
    vec2 d = gl_PointCoord - vec2(0.5);
    float a = smoothstep(0.5, 0.08, length(d));
    gl_FragColor = vec4(vColor.rgb * (a * vColor.a), 1.0); // premultiplied for ONE,ONE blend
}
`;

// ---- Relativistic jets: both poles in one mesh, aSeed.w picks the sign ----
export const JET_VS = /* glsl */ `
attribute vec4 aSeed; // x: height phase, y: angle0, z: lateral rand, w: pole (0/1)
uniform float uTime;
uniform float uPointScale;
varying vec4 vColor;
void main(void) {
    float pole = aSeed.w < 0.5 ? 1.0 : -1.0;
    float H = 44.0;                             // beam length (world units)
    float h = mod(aSeed.x * H + uTime * 12.0, H); // height along the beam

    // collimated: narrow foot, slow widening, gentle helical twist
    float spread = 0.16 + h * 0.030;
    float ang = aSeed.y * 6.2831853 + pole * (h * 0.22 + uTime * 0.5);
    float rad = spread * aSeed.z;
    vec3 pos = vec3(cos(ang) * rad, pole * (0.9 + h), sin(ang) * rad);

    // hot white-blue foot cooling to deep indigo at the tip
    vec3 col = mix(vec3(0.75, 0.85, 1.00) * 2.2, vec3(0.22, 0.30, 0.95), pow(h / H, 0.6));
    col *= 0.45 + 1.8 * exp(-h * 0.16);
    float fade = 1.0 - h / H;
    vColor = vec4(col, fade * fade * 0.75);

    vec4 mvPosition = viewMatrix * vec4(pos, 1.0);
    gl_Position = projectionMatrix * mvPosition;
    float size = mix(0.30, 0.08, pow(h / H, 0.7));
    gl_PointSize = clamp(uPointScale * size / max(-mvPosition.z, 0.1), 1.0, 26.0);
}
`;

export const JET_FS = /* glsl */ `
varying vec4 vColor;
void main(void) {
    vec2 d = gl_PointCoord - vec2(0.5);
    float a = smoothstep(0.5, 0.10, length(d));
    gl_FragColor = vec4(vColor.rgb * (a * vColor.a), 1.0); // premultiplied for ONE,ONE
}
`;

// ---- Background starfield with twinkle ----
export const STAR_VS = /* glsl */ `
attribute vec3 aPos;
attribute vec3 aColor;
attribute float aSize;
uniform float uTime;
uniform float uPixelRatio;
varying vec3 vColor;
void main(void) {
    gl_Position = projectionMatrix * viewMatrix * vec4(aPos, 1.0);
    float tw = 0.72 + 0.28 * sin(uTime * (0.6 + fract(aSize * 7.31) * 2.2) + aPos.x * 12.9 + aPos.y * 7.7);
    vColor = aColor * tw;
    gl_PointSize = aSize * uPixelRatio;
}
`;

export const STAR_FS = /* glsl */ `
varying vec3 vColor;
void main(void) {
    vec2 d = gl_PointCoord - vec2(0.5);
    float a = smoothstep(0.5, 0.1, length(d));
    gl_FragColor = vec4(vColor * a, 1.0);
}
`;

// ---- Screen-space gravitational lensing (ShaderPass fragment) ----
// vUv / tDiffuse follow the Three.js ShaderPass convention; the math body is
// verbatim from the PlayCanvas pc.PostEffect version (uv origin bottom-left
// in both engines, so no flip is needed).
export const LENS_VS = /* glsl */ `
varying vec2 vUv;
void main(void) {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

export const LENS_FS = /* glsl */ `
varying vec2 vUv;
uniform sampler2D tDiffuse;
uniform vec2 uCenter;
uniform float uAspect;
uniform float uRadius;    // screen-space Einstein radius (aspect-corrected)
uniform float uHorizon;   // screen-space photon-capture radius
uniform float uStrength;
uniform float uTime;
void main(void) {
    vec2 uv = vUv;
    vec2 d = uv - uCenter;
    d.x *= uAspect;
    float r = max(length(d), 1e-5);
    vec2 dir = d / r;

    // frame-dragging swirl, stronger near the singularity
    float swirl = uStrength * 0.24 * uRadius / (r + uRadius * 0.8);
    float cs = cos(swirl);
    float sn = sin(swirl);
    vec2 sdir = vec2(dir.x * cs - dir.y * sn, dir.x * sn + dir.y * cs);

    // gravitational deflection: a ray passing at radius r picks up light
    // from radius r + R^2/r. Continuous everywhere (minimum 2R at r = R);
    // the fold at r = R is the primary/secondary image pair. Unlike a
    // (1 - bend) mapping it never crosses zero -> no ring artifacts.
    float bend = uStrength * uRadius * uRadius / r;
    float rl = r + bend;

    // photons skimming the capture zone wrap around the hole: rotate the
    // sample direction up to pi as r -> 0. This is what paints the far
    // side of the disk as arcs above and below the shadow.
    float wrap = uStrength * 2.5 * pow(max(1.0 - r / uRadius, 0.0), 2.0);
    float wc = cos(wrap);
    float ws = sin(wrap);
    vec2 wdir = vec2(sdir.x * wc - sdir.y * ws, sdir.x * ws + sdir.y * wc);
    vec2 lensed = wdir * rl;

    vec2 sampleUv = uCenter + vec2(lensed.x / uAspect, lensed.y);
    sampleUv = clamp(sampleUv, vec2(0.001), vec2(0.999));

    // chromatic aberration, amplified by the bending field
    float ca = 0.0012 + 0.004 * min(bend, 3.0);
    vec2 caOff = vec2(dir.x / uAspect, dir.y) * ca;
    vec3 col;
    col.r = texture2D(tDiffuse, clamp(sampleUv + caOff, vec2(0.001), vec2(0.999))).r;
    col.g = texture2D(tDiffuse, sampleUv).g;
    col.b = texture2D(tDiffuse, clamp(sampleUv - caOff, vec2(0.001), vec2(0.999))).b;

    // photon capture: inside the horizon no light escapes
    float capture = smoothstep(uHorizon * 0.92, uHorizon * 1.08 + 1e-5, r);
    col *= capture;

    // Einstein ring shimmer
    float ringWidth = uRadius * 0.085 + 1e-4;
    float ring = exp(-pow((r - uRadius) / ringWidth, 2.0));
    ring *= 0.85 + 0.15 * sin(uTime * 6.0 + atan(dir.y, dir.x) * 5.0);
    col += vec3(1.15, 1.05, 0.85) * ring * 0.85 * capture;

    // hot glow clinging to the photon sphere
    float pglow = exp(-max(r - uHorizon, 0.0) / (uRadius * 0.30 + 1e-4));
    col += vec3(1.0, 0.62, 0.30) * pglow * 0.30 * capture;

    // vignette
    vec2 vc = uv - vec2(0.5);
    col *= 1.0 - 0.38 * dot(vc, vc);

    // dither against color banding
    float n = fract(sin(dot(uv + uTime * 0.01, vec2(12.9898, 78.233))) * 43758.5453);
    col += (n - 0.5) * 0.012;

    gl_FragColor = vec4(col, 1.0);
}
`;
