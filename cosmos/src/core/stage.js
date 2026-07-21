// Stage: owns the shared WebGLRenderer, the animation loop, resize, and FPS
// accounting. Scenes receive ticks from here and draw through the renderer.

import * as THREE from 'three';

export class Stage {
  constructor(canvas) {
    this.canvas = canvas;
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      powerPreference: 'high-performance',
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;

    this.scene = null;          // active scene instance
    this.clock = new THREE.Clock();
    this.elapsed = 0;
    this.paused = false;
    this._fpsFrames = 0;
    this._fpsTime = 0;
    this.fps = 0;
    this.onFps = null;          // (fps) => void, sampled ~2x/s
    this._disposed = false;

    window.addEventListener('resize', () => this._resize());

    // Offscreen pause: rAF already stops in hidden tabs, but be explicit and
    // reset the clock on return so the sim does not lurch.
    document.addEventListener('visibilitychange', () => {
      this.paused = document.hidden;
      if (!this.paused) this.clock.getDelta();
    });

    // WebGL context loss: prevent the default (which kills the context for
    // good) and ask the user to refresh; auto-reload if it comes back.
    canvas.addEventListener('webglcontextlost', e => {
      e.preventDefault();
      const fb = document.getElementById('fallback');
      fb.querySelector('h2').textContent = 'RENDERING CONTEXT LOST';
      fb.querySelector('p').textContent = '显卡渲染上下文丢失，请刷新页面恢复。Graphics context lost — please refresh.';
      fb.classList.add('show');
      fb.dataset.error = '1';
    });
    canvas.addEventListener('webglcontextrestored', () => location.reload());

    this._resize();
  }

  setScene(sceneInstance) {
    this.scene = sceneInstance;
    this.clock.getDelta();
    this._resize();
  }

  setPixelRatio(ratio) {
    this.renderer.setPixelRatio(ratio);
    this._resize();
  }

  get width() { return window.innerWidth; }
  get height() { return window.innerHeight; }
  get pixelRatio() { return this.renderer.getPixelRatio(); }

  _resize() {
    this.renderer.setSize(this.width, this.height, false);
    if (this.scene && this.scene.resize) {
      this.scene.resize(this.width, this.height, this.pixelRatio);
    }
  }

  start() {
    const loop = () => {
      if (this._disposed) return;
      requestAnimationFrame(loop);
      const dt = Math.min(this.clock.getDelta(), 0.1);
      if (this.paused) return;
      this.elapsed += dt;
      if (this.scene) {
        try {
          if (this.scene.update) this.scene.update(dt, this.elapsed);
          this.scene.render(dt);
        } catch (err) {
          // Surface render errors once via the global error contract.
          window.__errors = window.__errors || [];
          window.__errors.push(String(err && err.stack || err));
          this._disposed = true;
          document.getElementById('fallback').classList.add('show');
          document.getElementById('fallback').dataset.error = '1';
          document.getElementById('fallback-detail').textContent = String(err && err.stack || err);
          return;
        }
      }
      this._fpsFrames++;
      this._fpsTime += dt;
      if (this._fpsTime >= 0.5) {
        this.fps = this._fpsFrames / this._fpsTime;
        this._fpsFrames = 0;
        this._fpsTime = 0;
        if (this.onFps) this.onFps(this.fps);
      }
    };
    requestAnimationFrame(loop);
  }
}
