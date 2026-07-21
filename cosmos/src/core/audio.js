// Procedural WebAudio: ambient space drone + UI sound effects.
// No audio assets — everything is synthesized, matching the project's
// no-network-fetches rule. The AudioContext is created lazily on the first
// user gesture (browser autoplay policy). Mute state persists in localStorage.

let ctx = null;
let master = null;
let droneNodes = null;
let muted = localStorage.getItem('cosmos-muted') === '1';
const listeners = new Set();

function ensureContext() {
  if (ctx) return true;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return false;
  ctx = new AC();
  master = ctx.createGain();
  master.gain.value = muted ? 0 : 1;
  master.connect(ctx.destination);
  startDrone();
  return true;
}

function startDrone() {
  // Brown noise through a slowly-breathing lowpass — the classic space hum.
  const len = ctx.sampleRate * 4;
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buf.getChannelData(0);
  let last = 0;
  for (let i = 0; i < len; i++) {
    const white = Math.random() * 2 - 1;
    last = (last + 0.02 * white) / 1.02;
    data[i] = last * 3.5;
  }
  const noise = ctx.createBufferSource();
  noise.buffer = buf;
  noise.loop = true;

  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 220;
  filter.Q.value = 0.6;

  const lfo = ctx.createOscillator();
  lfo.frequency.value = 0.05;
  const lfoGain = ctx.createGain();
  lfoGain.gain.value = 120;
  lfo.connect(lfoGain).connect(filter.frequency);

  const noiseGain = ctx.createGain();
  noiseGain.gain.value = 0.05;
  noise.connect(filter).connect(noiseGain).connect(master);

  // Faint two-tone pad, a perfect fifth, very slow tremolo.
  const padGain = ctx.createGain();
  padGain.gain.value = 0.014;
  const trem = ctx.createOscillator();
  trem.frequency.value = 0.08;
  const tremGain = ctx.createGain();
  tremGain.gain.value = 0.008;
  trem.connect(tremGain).connect(padGain.gain);
  [55, 82.4].forEach(f => {
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = f;
    osc.connect(padGain);
    osc.start();
  });
  padGain.connect(master);

  noise.start();
  lfo.start();
  trem.start();
  droneNodes = { noise, lfo, trem };
}

export const audio = {
  get muted() { return muted; },

  // Call from any user-gesture handler; safe to call repeatedly.
  unlock() {
    if (!ensureContext()) return;
    if (ctx.state === 'suspended') ctx.resume();
  },

  setMuted(value) {
    muted = !!value;
    localStorage.setItem('cosmos-muted', muted ? '1' : '0');
    if (master) master.gain.linearRampToValueAtTime(muted ? 0 : 1, ctx.currentTime + 0.2);
    listeners.forEach(fn => fn(muted));
  },
  toggle() { this.setMuted(!muted); },
  onMuteChange(fn) { listeners.add(fn); },

  // Short UI blip.
  blip() {
    if (!ctx || muted) return;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(620, t);
    osc.frequency.exponentialRampToValueAtTime(880, t + 0.07);
    gain.gain.setValueAtTime(0.08, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.12);
    osc.connect(gain).connect(master);
    osc.start(t);
    osc.stop(t + 0.13);
  },

  // Rising noise sweep for scene warps (~1s).
  whoosh() {
    if (!ctx || muted) return;
    const t = ctx.currentTime;
    const len = ctx.sampleRate * 1;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.Q.value = 1.2;
    filter.frequency.setValueAtTime(180, t);
    filter.frequency.exponentialRampToValueAtTime(3200, t + 0.85);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.22, t + 0.5);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 1.0);
    src.connect(filter).connect(gain).connect(master);
    src.start(t);
    src.stop(t + 1.05);
  },
};

// Unlock on the first gesture anywhere.
const unlock = () => audio.unlock();
window.addEventListener('pointerdown', unlock, { once: false });
window.addEventListener('keydown', unlock, { once: false });
