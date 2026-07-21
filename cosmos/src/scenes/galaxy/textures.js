// Procedural texture factory for the galaxy scene — every map is generated
// on <canvas>, zero external image assets. Ported from galactic-atlas.html.
import * as THREE from 'three';

function makeCanvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
function mulberry32(a) {
  return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
function clamp01(x) { return x < 0 ? 0 : (x > 1 ? 1 : x); }
function sstep(a, b, x) { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); }

// Tileable-in-x 2D value noise (so equirectangular planet maps have no seam).
function makeValueNoise(seed, px, py) {
  const rand = mulberry32(seed);
  const grid = [];
  for (let y = 0; y <= py; y++) {
    const row = [];
    for (let x = 0; x < px; x++) row.push(rand());
    row.push(row[0]); // wrap column
    grid.push(row);
  }
  return function (u, v) {
    u = ((u % px) + px) % px;
    v = v < 0 ? 0 : (v > py ? py : v);
    const x0 = Math.floor(u), y0 = Math.floor(v);
    const fx = u - x0, fy = v - y0;
    const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
    const y1 = Math.min(y0 + 1, py);
    const a = grid[y0][x0], b = grid[y0][x0 + 1], c = grid[y1][x0], d = grid[y1][x0 + 1];
    return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
  };
}
function makeFBM(seed, octaves, basePX, basePY) {
  const layers = []; let f = 1;
  for (let o = 0; o < octaves; o++) {
    const px = Math.max(1, Math.round(basePX * f)), py = Math.max(1, Math.round(basePY * f));
    layers.push({ n: makeValueNoise(seed + o * 131, px, py), px, py });
    f *= 2;
  }
  return function (u, v) {
    let val = 0, amp = 0.5, tot = 0;
    for (let o = 0; o < layers.length; o++) {
      const L = layers[o];
      val += amp * L.n(u * L.px, v * L.py);
      tot += amp; amp *= 0.5;
    }
    return val / tot;
  };
}

export function makeStarTexture() {
  const c = makeCanvas(64, 64), x = c.getContext('2d');
  const g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0.0, 'rgba(255,255,255,1)');
  g.addColorStop(0.25, 'rgba(255,255,255,0.7)');
  g.addColorStop(0.6, 'rgba(255,255,255,0.12)');
  g.addColorStop(1.0, 'rgba(255,255,255,0)');
  x.fillStyle = g; x.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}
export function makeFlareTexture() {
  const c = makeCanvas(128, 128), x = c.getContext('2d');
  const g = x.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0.0, 'rgba(255,255,255,1)');
  g.addColorStop(0.12, 'rgba(255,255,255,0.85)');
  g.addColorStop(0.35, 'rgba(255,255,255,0.18)');
  g.addColorStop(1.0, 'rgba(255,255,255,0)');
  x.fillStyle = g; x.fillRect(0, 0, 128, 128);
  x.globalCompositeOperation = 'lighter';
  const h = x.createLinearGradient(0, 64, 128, 64);
  h.addColorStop(0.0, 'rgba(255,255,255,0)');
  h.addColorStop(0.5, 'rgba(255,255,255,0.5)');
  h.addColorStop(1.0, 'rgba(255,255,255,0)');
  x.fillStyle = h; x.fillRect(0, 62, 128, 4);
  const v = x.createLinearGradient(64, 0, 64, 128);
  v.addColorStop(0.0, 'rgba(255,255,255,0)');
  v.addColorStop(0.5, 'rgba(255,255,255,0.5)');
  v.addColorStop(1.0, 'rgba(255,255,255,0)');
  x.fillStyle = v; x.fillRect(62, 0, 4, 128);
  return new THREE.CanvasTexture(c);
}
export function makeGlowTexture() {
  const c = makeCanvas(128, 128), x = c.getContext('2d');
  const g = x.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0.0, 'rgba(255,255,255,1)');
  g.addColorStop(0.18, 'rgba(255,255,255,0.55)');
  g.addColorStop(0.45, 'rgba(255,255,255,0.14)');
  g.addColorStop(1.0, 'rgba(255,255,255,0)');
  x.fillStyle = g; x.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(c);
}
export function makeSunTexture() {
  const c = makeCanvas(256, 128), x = c.getContext('2d');
  x.fillStyle = '#f5a83d'; x.fillRect(0, 0, 256, 128);
  const rand = mulberry32(1234);
  const palette = ['#ffd97a', '#fff3c4', '#ff8c3a', '#e87d2b', '#ffc95e'];
  for (let i = 0; i < 1100; i++) {
    x.globalAlpha = 0.05 + rand() * 0.13;
    x.fillStyle = palette[(rand() * palette.length) | 0];
    x.beginPath();
    x.arc(rand() * 256, rand() * 128, 0.5 + rand() * 3.2, 0, Math.PI * 2);
    x.fill();
  }
  for (let j = 0; j < 12; j++) { // sunspots
    x.globalAlpha = 0.10 + rand() * 0.08;
    x.fillStyle = '#c96a1e';
    x.beginPath();
    x.arc(rand() * 256, 20 + rand() * 88, 3 + rand() * 7, 0, Math.PI * 2);
    x.fill();
  }
  x.globalAlpha = 1;
  return new THREE.CanvasTexture(c);
}
export function makeEarthTexture() {
  const w = 512, h = 256, c = makeCanvas(w, h), x = c.getContext('2d');
  const img = x.createImageData(w, h), d = img.data;
  const land = makeFBM(7, 5, 8, 4), detail = makeFBM(99, 3, 24, 12), clouds = makeFBM(55, 4, 10, 5);
  for (let j = 0; j < h; j++) {
    const v = j / h, lat = Math.abs(v - 0.5) * 2;
    for (let i = 0; i < w; i++) {
      const u = i / w;
      const hh = land(u, v) + (detail(u, v) - 0.5) * 0.14;
      const sea = 0.52; let r, g, b;
      if (hh < sea) {
        const dd = (sea - hh) / sea;
        r = 10 + 26 * (1 - dd); g = 34 + 58 * (1 - dd); b = 95 + 85 * (1 - dd);
        if (hh > sea - 0.025) { r = 26; g = 96; b = 158; } // shallow shelf
      } else {
        const e = Math.min((hh - sea) * 5.5, 1);
        r = 42 + 105 * e; g = 112 - 25 * e; b = 48 + 35 * e;
        if (e < 0.12) { r = 58; g = 118; b = 58; }          // lush lowland
        if (e > 0.72) { r = 148; g = 142; b = 136; }        // mountain rock
      }
      const ice = sstep(0.80, 0.94, lat + (detail(u, v) - 0.5) * 0.12);
      r += (236 - r) * ice; g += (242 - g) * ice; b += (248 - b) * ice;
      const ca = sstep(0, 0.5, Math.max(0, clouds(u, v) - 0.58) * 2.0) * 0.55;
      r += (255 - r) * ca; g += (255 - g) * ca; b += (255 - b) * ca;
      const k = (j * w + i) * 4;
      d[k] = r; d[k + 1] = g; d[k + 2] = b; d[k + 3] = 255;
    }
  }
  x.putImageData(img, 0, 0);
  return new THREE.CanvasTexture(c);
}
export function makeMarsTexture() {
  const w = 256, h = 128, c = makeCanvas(w, h), x = c.getContext('2d');
  const img = x.createImageData(w, h), d = img.data;
  const fbm = makeFBM(31, 4, 8, 4), det = makeFBM(77, 3, 20, 10);
  for (let j = 0; j < h; j++) {
    const v = j / h, lat = Math.abs(v - 0.5) * 2;
    for (let i = 0; i < w; i++) {
      const u = i / w;
      const n = fbm(u, v), m = det(u, v);
      let r = 178 - 55 * n, g = 84 - 30 * n, b = 58 - 22 * n;
      if (m > 0.62) { r *= 0.72; g *= 0.72; b *= 0.72; }   // dark maria
      const ice = sstep(0.88, 0.97, lat);
      r += (240 - r) * ice; g += (236 - g) * ice; b += (228 - b) * ice;
      const k = (j * w + i) * 4;
      d[k] = r; d[k + 1] = g; d[k + 2] = b; d[k + 3] = 255;
    }
  }
  x.putImageData(img, 0, 0);
  return new THREE.CanvasTexture(c);
}
export function makeJupiterTexture() {
  const w = 512, h = 256, c = makeCanvas(w, h), x = c.getContext('2d');
  const img = x.createImageData(w, h), d = img.data;
  const fbm = makeFBM(21, 4, 12, 6);
  for (let j = 0; j < h; j++) {
    const v = j / h;
    for (let i = 0; i < w; i++) {
      const u = i / w;
      const n = fbm(u, v);
      const band = Math.sin((v * 9 + n * 2.2) * Math.PI);
      const t = band * 0.5 + 0.5;
      let r = 232 - 42 * t, g = 214 - 62 * t, b = 182 - 74 * t;
      if (t > 0.72) { const s = (t - 0.72) / 0.28; r += (172 - r) * s * 0.7; g += (116 - g) * s * 0.7; b += (78 - b) * s * 0.7; }
      const dx = (u - 0.68) / 0.055, dy = (v - 0.60) / 0.038, q = dx * dx + dy * dy;
      if (q < 1) { const sp = (1 - q) * 0.9; r += (196 - r) * sp; g += (74 - g) * sp; b += (52 - b) * sp; }
      const k = (j * w + i) * 4;
      d[k] = r; d[k + 1] = g; d[k + 2] = b; d[k + 3] = 255;
    }
  }
  x.putImageData(img, 0, 0);
  return new THREE.CanvasTexture(c);
}
export function makeSaturnTexture() {
  const w = 512, h = 256, c = makeCanvas(w, h), x = c.getContext('2d');
  const img = x.createImageData(w, h), d = img.data;
  const fbm = makeFBM(43, 3, 10, 5);
  for (let j = 0; j < h; j++) {
    const v = j / h;
    for (let i = 0; i < w; i++) {
      const u = i / w;
      const band = Math.sin((v * 7 + fbm(u, v) * 1.4) * Math.PI);
      const t = band * 0.5 + 0.5;
      let r = 226 - 20 * t, g = 208 - 22 * t, b = 172 - 26 * t;
      if (v > 0.28 && v < 0.32) { r *= 0.82; g *= 0.82; b *= 0.82; }
      const k = (j * w + i) * 4;
      d[k] = r; d[k + 1] = g; d[k + 2] = b; d[k + 3] = 255;
    }
  }
  x.putImageData(img, 0, 0);
  return new THREE.CanvasTexture(c);
}
export function makeRockyTexture(base, spot, seed) {
  const c = makeCanvas(256, 128), x = c.getContext('2d');
  x.fillStyle = base; x.fillRect(0, 0, 256, 128);
  const rand = mulberry32(seed);
  for (let i = 0; i < 650; i++) {
    x.globalAlpha = 0.06 + rand() * 0.16;
    x.fillStyle = rand() > 0.5 ? spot : base;
    x.beginPath();
    x.arc(rand() * 256, rand() * 128, 0.5 + rand() * 5, 0, Math.PI * 2);
    x.fill();
  }
  x.globalAlpha = 1;
  return new THREE.CanvasTexture(c);
}
export function makeRingTexture() {
  const c = makeCanvas(512, 512), x = c.getContext('2d');
  x.clearRect(0, 0, 512, 512);
  const n1 = makeValueNoise(5, 64, 1);
  const cx = 256, inner = 143, outer = 250; // 143px == geometry inner 3.9 / outer 7.0 * 256
  for (let r = inner; r <= outer; r++) {
    const t = (r - inner) / (outer - inner);
    let a = (0.25 + 0.65 * n1(r * 0.09, 0.5)) * sstep(0, 0.06, t) * (1 - sstep(0.90, 1, t));
    if (t > 0.60 && t < 0.68) a *= 0.12; // Cassini division
    x.strokeStyle = 'rgba(216,200,172,' + a.toFixed(3) + ')';
    x.lineWidth = 1.1;
    x.beginPath(); x.arc(cx, cx, r, 0, Math.PI * 2); x.stroke();
  }
  return new THREE.CanvasTexture(c);
}
export function makeLabel(text) {
  const c = makeCanvas(512, 112), x = c.getContext('2d');
  x.font = '600 44px "Segoe UI", Arial, sans-serif';
  x.textAlign = 'center'; x.textBaseline = 'middle';
  x.shadowColor = 'rgba(120,190,255,0.9)'; x.shadowBlur = 18;
  x.fillStyle = 'rgba(235,244,255,0.95)';
  x.fillText(text, 256, 48);
  x.shadowBlur = 0;
  x.fillStyle = 'rgba(120,190,255,0.6)';
  x.fillRect(166, 88, 180, 3);
  const tex = new THREE.CanvasTexture(c);
  const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false });
  mat.toneMapped = false;
  const sprite = new THREE.Sprite(mat);
  sprite.scale.set(66, 14.5, 1);
  sprite.renderOrder = 6;
  return sprite;
}
