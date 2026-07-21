// Scale-warp transition: a 2D canvas star-streak tunnel that covers the
// scene swap. Total ~1.6s: streaks accelerate for 0.9s, a white flash peaks
// while onMidpoint() swaps the scene underneath, then the flash decays.

export function playWarp({ onMidpoint, onDone }) {
  const canvas = document.createElement('canvas');
  canvas.id = 'warpfx';
  document.body.appendChild(canvas);
  const g = canvas.getContext('2d');
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const W = window.innerWidth, H = window.innerHeight;
  canvas.width = W * dpr;
  canvas.height = H * dpr;
  g.scale(dpr, dpr);
  const cx = W / 2, cy = H / 2;

  // Star streaks: each has an angle and a depth that shrinks over time.
  const stars = Array.from({ length: 260 }, () => ({
    a: Math.random() * Math.PI * 2,
    z: 0.15 + Math.random() * 0.85,
    speed: 0.55 + Math.random() * 0.45,
  }));

  const DUR_IN = 900, DUR_OUT = 700;
  const t0 = performance.now();
  let midFired = false;
  let last = t0;

  function frame(now) {
    const t = now - t0;
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now;
    const phase = t < DUR_IN ? 0 : 1;
    // Acceleration curve: streaks stretch as the warp ramps up.
    const ramp = phase === 0 ? (t / DUR_IN) : Math.max(0, 1 - (t - DUR_IN) / DUR_OUT);
    const velocity = 0.25 + ramp * ramp * 3.2;

    g.clearRect(0, 0, W, H);
    g.fillStyle = `rgba(2,3,10,${Math.min(1, ramp * 1.6)})`;
    g.fillRect(0, 0, W, H);

    g.lineCap = 'round';
    for (const s of stars) {
      s.z -= dt * velocity * s.speed;
      if (s.z <= 0.02) { s.z = 1; s.a = Math.random() * Math.PI * 2; }
      const r1 = (1 / s.z - 1) * 40;
      const r0 = (1 / Math.min(s.z + dt * velocity * s.speed * 6, 1) - 1) * 40;
      const alpha = Math.min(1, (1 - s.z) * 2.2) * (0.35 + ramp * 0.65);
      g.strokeStyle = `rgba(190,215,255,${alpha})`;
      g.lineWidth = Math.max(0.5, (1 - s.z) * 2.2);
      g.beginPath();
      g.moveTo(cx + Math.cos(s.a) * r0, cy + Math.sin(s.a) * r0);
      g.lineTo(cx + Math.cos(s.a) * r1, cy + Math.sin(s.a) * r1);
      g.stroke();
    }

    // White flash peaks exactly at the swap moment.
    const flash = phase === 0
      ? Math.pow(t / DUR_IN, 3) * 0.9
      : Math.max(0, 1 - (t - DUR_IN) / DUR_OUT);
    if (flash > 0.01) {
      g.fillStyle = `rgba(230,240,255,${Math.min(1, flash)})`;
      g.fillRect(0, 0, W, H);
    }

    if (!midFired && t >= DUR_IN) {
      midFired = true;
      Promise.resolve(onMidpoint && onMidpoint()).catch(() => {});
    }
    if (t < DUR_IN + DUR_OUT) requestAnimationFrame(frame);
    else {
      canvas.remove();
      if (onDone) onDone();
    }
  }
  requestAnimationFrame(frame);
}
