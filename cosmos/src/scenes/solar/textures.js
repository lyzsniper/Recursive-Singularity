// Procedural texture factory for the HELIO solar-system scene.
// Ported from kimi-sun/index.html (Three.js r128) — painters are byte-for-byte
// the same algorithms; only the texture colorSpace API was updated for r160.

import * as THREE from 'three';

/* ---------- Seeded RNG + value noise ---------- */
export function mulberry32(a) {
  return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

function makeNoise(seed) {
  const rand = mulberry32(seed);
  const p = new Uint8Array(256);
  let i, j, t;
  for (i = 0; i < 256; i++) p[i] = i;
  for (i = 255; i > 0; i--) { j = (rand() * (i + 1)) | 0; t = p[i]; p[i] = p[j]; p[j] = t; }
  const perm = new Uint8Array(512);
  for (i = 0; i < 512; i++) perm[i] = p[i & 255];
  function fade(x) { return x * x * (3 - 2 * x); }
  function n2(x, y) {
    const X = Math.floor(x), Y = Math.floor(y);
    const xf = x - X, yf = y - Y, xi = X & 255, yi = Y & 255;
    const u = fade(xf), v = fade(yf);
    const aa = perm[xi + perm[yi]] / 255, ba = perm[xi + 1 + perm[yi]] / 255;
    const ab = perm[xi + perm[yi + 1]] / 255, bb = perm[xi + 1 + perm[yi + 1]] / 255;
    return aa + (ba - aa) * u + (ab - aa) * v + (aa - ba - ab + bb) * u * v;
  }
  function fbm(x, y, oct) {
    oct = oct || 5;
    let a = 0.5, f = 1, s = 0, n = 0;
    for (let i = 0; i < oct; i++) { s += a * n2(x * f, y * f); n += a; a *= 0.5; f *= 2.03; }
    return s / n;
  }
  return { n2, fbm };
}

// Seamless (x-wrapping) fbm so equirectangular textures have no visible seam.
function sfbm(nz, u, v, f, oct) {
  const a = nz.fbm(u * f, v * f, oct);
  const b = nz.fbm((u - 1) * f, v * f, oct);
  return a + (b - a) * u;
}

/* ---------- Color helpers ---------- */
function hex(h) { return [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]; }
function mixc(a, b, t) {
  t = Math.max(0, Math.min(1, t));
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}
function clamp255(v) { return v < 0 ? 0 : v > 255 ? 255 : v; }

/* ---------- Per-pixel texture painter ---------- */
function paintTexture(w, h, painter) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(w, h), d = img.data;
  for (let y = 0; y < h; y++) {
    const v = y / h;
    for (let x = 0; x < w; x++) {
      const col = painter(x / w, v);
      const i = (y * w + x) * 4;
      d[i] = clamp255(col[0]);
      d[i + 1] = clamp255(col[1]);
      d[i + 2] = clamp255(col[2]);
      d[i + 3] = col.length > 3 ? clamp255(col[3]) : 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

function addCraters(ctx, w, h, count, rng) {
  for (let i = 0; i < count; i++) {
    const x = rng() * w, y = h * 0.07 + rng() * h * 0.86;
    const r = 1 + rng() * rng() * (w * 0.018 + 4);
    const dark = 0.10 + rng() * 0.20, light = 0.05 + rng() * 0.10;
    const offsets = [0];
    if (x < r * 2) offsets.push(w);
    if (x > w - r * 2) offsets.push(-w);
    for (let k = 0; k < offsets.length; k++) {
      const cx = x + offsets[k];
      ctx.beginPath(); ctx.arc(cx, y, r, 0, 6.2832);
      ctx.fillStyle = 'rgba(0,0,0,' + dark.toFixed(3) + ')'; ctx.fill();
      ctx.beginPath(); ctx.arc(cx - r * 0.22, y - r * 0.22, r * 0.88, 0, 6.2832);
      ctx.strokeStyle = 'rgba(255,255,255,' + light.toFixed(3) + ')';
      ctx.lineWidth = Math.max(1, r * 0.16); ctx.stroke();
    }
  }
}

/* ---------- Planet surface painters (u,v in [0,1] equirectangular) ---------- */
function paintMercury(nz) {
  return function (u, v) {
    const n = sfbm(nz, u, v, 5, 5), m = sfbm(nz, u, v, 16, 4);
    const g = 96 + (n - 0.5) * 92 + (m - 0.5) * 42;
    return [g, g * 0.99, g * 0.96];
  };
}

function paintMoon(nz) {
  const nz2 = makeNoise(913);
  return function (u, v) {
    const n = sfbm(nz, u, v, 6, 5);
    let g = 122 + (n - 0.5) * 82;
    const maria = sfbm(nz2, u, v, 3, 4);
    if (maria > 0.56) g *= 1 - (maria - 0.56) * 1.15;
    return [g, g, g * 1.02];
  };
}

function paintVenus(nz) {
  return function (u, v) {
    const s1 = sfbm(nz, u, v, 3, 5);
    const swirl = 1 - Math.abs(2 * sfbm(nz, u, v + s1 * 0.45, 6, 5) - 1);
    const t = swirl * 0.7 + sfbm(nz, u, v, 12, 4) * 0.3;
    return mixc([212, 174, 116], [242, 222, 172], t);
  };
}

function paintEarth(nz) {
  return function (u, v) {
    const e = sfbm(nz, u, v, 5, 6) + 0.25 * sfbm(nz, u, v, 14, 4) - 0.12;
    const moist = sfbm(nz, u, v, 7, 4);
    let r, g, b;
    if (e > 0.52) {
      const t = (e - 0.52) / 0.48;
      if (moist > 0.55) { r = 58 + t * 82; g = 108 + t * 62; b = 48 + t * 32; }
      else { r = 152 + t * 62; g = 118 + t * 42; b = 68 + t * 30; }
      if (t > 0.55) { r = 118 + t * 105; g = 112 + t * 95; b = 108 + t * 85; }
    } else {
      const d = Math.max(0, (0.52 - e) / 0.52);
      r = 12 + 22 * (1 - d); g = 46 + 52 * (1 - d); b = 112 + 92 * (1 - d);
      if (e > 0.47) { r = 26; g = 112; b = 162; }
    }
    const polar = Math.abs(v - 0.5) * 2;
    let ice = 0;
    if (polar > 0.86) ice = 1;
    else if (polar > 0.79) ice = (polar - 0.79) / 0.07 * (0.35 + 0.65 * sfbm(nz, u, v, 10, 3));
    if (ice > 0.25) {
      r = r * (1 - ice) + 236 * ice;
      g = g * (1 - ice) + 241 * ice;
      b = b * (1 - ice) + 246 * ice;
    }
    return [r, g, b];
  };
}

function paintClouds(nz) {
  return function (u, v) {
    const c = sfbm(nz, u, v, 5, 5) + 0.3 * sfbm(nz, u, v, 13, 4);
    const a = Math.max(0, Math.min(1, (c - 0.52) * 3.4));
    return [255, 255, 255, a * 225];
  };
}

function paintMars(nz) {
  return function (u, v) {
    const n = sfbm(nz, u, v, 5, 5), d = sfbm(nz, u, v, 9, 4);
    let c = mixc([146, 72, 42], [208, 122, 70], n);
    if (d > 0.6) c = mixc(c, [102, 50, 34], (d - 0.6) * 2);
    const polar = Math.abs(v - 0.5) * 2;
    if (polar > 0.9) c = mixc(c, [236, 231, 223], Math.min(1, (polar - 0.9) * 10) * 0.9);
    return c;
  };
}

const J_BANDS = [
  [0.00, '#9c8468'], [0.06, '#8a7358'], [0.11, '#c9b795'], [0.17, '#a0805e'],
  [0.23, '#e0d2b2'], [0.30, '#b08a64'], [0.36, '#e8ddc4'], [0.43, '#c3a37c'],
  [0.50, '#dccaa9'], [0.56, '#9a7a58'], [0.63, '#cbb691'], [0.70, '#a58560'],
  [0.77, '#d5c5a4'], [0.84, '#94805f'], [0.91, '#c0ae8c'], [0.96, '#a08a68'], [1.00, '#9c8468']
].map(function (b) { return [b[0], hex(b[1])]; });

const S_BANDS = [
  [0.00, '#c4b28a'], [0.125, '#b3a078'], [0.25, '#d6c8a0'], [0.375, '#c9b88e'],
  [0.50, '#e0d4b0'], [0.625, '#cfc09a'], [0.75, '#bbaa82'], [0.875, '#d2c4a0'], [1.00, '#c4b48e']
].map(function (b) { return [b[0], hex(b[1])]; });

function bandSample(bands, v) {
  for (let i = 0; i < bands.length - 1; i++) {
    const a = bands[i], b = bands[i + 1];
    if (v >= a[0] && v <= b[0]) return mixc(a[1], b[1], (v - a[0]) / (b[0] - a[0]));
  }
  return bands[bands.length - 1][1];
}

function paintJupiter(nz) {
  return function (u, v) {
    const turb = (sfbm(nz, u, v, 7, 5) - 0.5) * 0.09;
    const vv = Math.min(0.999, Math.max(0.001, v + turb));
    let c = bandSample(J_BANDS, vv);
    const br = 0.9 + sfbm(nz, u, v, 26, 3) * 0.2;
    c = [c[0] * br, c[1] * br, c[2] * br];
    // Great Red Spot
    const dx = u - 0.7, dy = (v - 0.64) * 1.9;
    const d = Math.sqrt(dx * dx + dy * dy);
    if (d < 0.085) {
      c = mixc(c, [198, 86, 58], Math.min(1, (1 - d / 0.085) * 1.6));
      if (d > 0.06) c = mixc(c, [142, 52, 40], (d - 0.06) / 0.025 * 0.5);
    }
    return c;
  };
}

function paintSaturn(nz) {
  return function (u, v) {
    const turb = (sfbm(nz, u, v, 6, 4) - 0.5) * 0.045;
    const vv = Math.min(0.999, Math.max(0.001, v + turb));
    const c = bandSample(S_BANDS, vv);
    const br = 0.94 + sfbm(nz, u, v, 22, 3) * 0.12;
    return [c[0] * br, c[1] * br, c[2] * br];
  };
}

function paintUranus(nz) {
  return function (u, v) {
    const band = Math.sin(v * Math.PI * 6) * 0.5 + 0.5;
    const n = sfbm(nz, u, v, 4, 4);
    let c = mixc([138, 198, 212], [180, 228, 233], n * 0.72 + band * 0.14);
    if (v < 0.12 || v > 0.88) c = mixc(c, [202, 236, 239], 0.35);
    return c;
  };
}

function paintNeptune(nz) {
  return function (u, v) {
    const n = sfbm(nz, u, v, 5, 5);
    let c = mixc([36, 68, 168], [72, 122, 216], n);
    const streak = Math.max(0, sfbm(nz, u, v, 20, 3) - 0.7) * 3;
    c = mixc(c, [222, 232, 246], Math.min(1, streak) * 0.5);
    const dx = u - 0.62, dy = (v - 0.42) * 2.1;
    const d = Math.sqrt(dx * dx + dy * dy);
    if (d < 0.07) c = mixc(c, [22, 40, 100], (1 - d / 0.07) * 0.8);
    return c;
  };
}

function paintSun(nz) {
  const nz2 = makeNoise(555);
  return function (u, v) {
    const g = sfbm(nz, u, v, 18, 4), g2 = sfbm(nz, u, v, 6, 3);
    let c = mixc([255, 148, 48], [255, 216, 122], g * 0.7 + g2 * 0.3);
    const sp = sfbm(nz2, u, v, 3, 3);
    if (sp > 0.7) c = mixc(c, [184, 72, 30], Math.min(1, (sp - 0.7) * 4) * 0.7);
    return c;
  };
}

/* ---------- Texture bundle ---------- */
export function buildTextures(maxAniso, ringInner, ringOuter) {
  function makeBodyTexture(w, h, seed, painterFn, craters) {
    const nz = makeNoise(seed);
    const c = paintTexture(w, h, painterFn(nz));
    if (craters) addCraters(c.getContext('2d'), w, h, craters, mulberry32(seed * 7 + 1));
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = maxAniso;
    return t;
  }

  const TEX = {
    mercury: makeBodyTexture(512, 256, 11, paintMercury, 150),
    venus: makeBodyTexture(512, 256, 23, paintVenus, 0),
    earth: makeBodyTexture(1024, 512, 42, paintEarth, 0),
    clouds: makeBodyTexture(512, 256, 77, paintClouds, 0),
    mars: makeBodyTexture(512, 256, 55, paintMars, 0),
    jupiter: makeBodyTexture(1024, 512, 66, paintJupiter, 0),
    saturn: makeBodyTexture(512, 256, 88, paintSaturn, 0),
    uranus: makeBodyTexture(512, 256, 99, paintUranus, 0),
    neptune: makeBodyTexture(512, 256, 111, paintNeptune, 0),
    moon: makeBodyTexture(512, 256, 123, paintMoon, 170),
    sun: makeBodyTexture(512, 256, 7, paintSun, 0)
  };

  // Saturn ring texture: radial bands mapped onto RingGeometry's planar UVs.
  (function buildRingTexture() {
    const nz = makeNoise(2024);
    const innerFrac = ringInner / ringOuter;
    const c = paintTexture(512, 512, function (u, v) {
      const dx = u - 0.5, dy = v - 0.5;
      const r = Math.sqrt(dx * dx + dy * dy) * 2;
      if (r > 1 || r < innerFrac) return [0, 0, 0, 0];
      const t = (r - innerFrac) / (1 - innerFrac);
      let a = 0.25 + 0.65 * nz.fbm(t * 22, 3.7, 4);
      if (Math.abs(t - 0.68) < 0.035) a *= 0.15;   // Cassini division
      if (Math.abs(t - 0.40) < 0.020) a *= 0.5;    // secondary gap
      a *= Math.min(1, t / 0.06);                  // inner fade
      a *= Math.min(1, (1 - t) / 0.08);            // outer fade
      const shade = 0.75 + 0.25 * nz.fbm(t * 9, 8.1, 3);
      return [212 * shade, 196 * shade, 168 * shade, Math.max(0, Math.min(1, a)) * 255];
    });
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = maxAniso;
    TEX.ring = t;
  })();

  return TEX;
}
