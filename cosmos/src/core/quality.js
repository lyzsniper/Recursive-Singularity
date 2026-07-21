// QualityGovernor: maps quality levels to pixel-ratio caps and notifies the
// active scene. In 'auto' mode it steps down when FPS sags and steps back up
// after sustained headroom. Levels (best → worst): high, medium, low, potato.

const LEVELS = ['potato', 'low', 'medium', 'high'];
const PIXEL_RATIO_CAP = {
  high: () => Math.min(window.devicePixelRatio || 1, 2),
  medium: () => Math.min(window.devicePixelRatio || 1, 1.5),
  low: () => 1,
  potato: () => 0.75,
};

// Coarse-pointer small screens start one notch down in auto mode.
function isMobile() {
  return window.matchMedia('(pointer: coarse)').matches && Math.min(window.innerWidth, window.innerHeight) < 820;
}

export class QualityGovernor {
  constructor(stage, selectEl) {
    this.stage = stage;
    this.selectEl = selectEl;
    this.mode = 'auto';
    this.level = 'high';
    this.onLevelChange = null; // (level) => void
    this._slowTime = 0;
    this._fastTime = 0;

    selectEl.addEventListener('change', () => {
      this.mode = selectEl.value;
      this._slowTime = 0;
      this._fastTime = 0;
      if (this.mode !== 'auto') this._apply(this.mode);
      else this._apply(this._autoStartLevel());
    });

    this._apply(this._autoStartLevel());
  }

  _autoStartLevel() {
    return isMobile() ? 'low' : 'high';
  }

  _apply(level) {
    this.level = level;
    this.stage.setPixelRatio(PIXEL_RATIO_CAP[level]());
    if (this.onLevelChange) this.onLevelChange(level);
  }

  // Called with each FPS sample (~2x/s).
  sample(fps) {
    if (this.mode !== 'auto') return;
    const idx = LEVELS.indexOf(this.level);
    if (fps < 42 && idx > 0) {
      this._slowTime += 0.5;
      this._fastTime = 0;
      if (this._slowTime >= 2) {
        this._apply(LEVELS[idx - 1]);
        this._slowTime = 0;
      }
    } else if (fps > 58 && idx < LEVELS.length - 1) {
      // Never auto-step above the auto start level (mobile stays capped).
      const cap = LEVELS.indexOf(this._autoStartLevel());
      if (idx >= cap) { this._fastTime = 0; return; }
      this._fastTime += 0.5;
      this._slowTime = 0;
      if (this._fastTime >= 8) {
        this._apply(LEVELS[idx + 1]);
        this._fastTime = 0;
      }
    } else {
      this._slowTime = 0;
      this._fastTime = 0;
    }
  }
}
