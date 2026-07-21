// HUD wiring: nav active state, FPS readout, mute toggle, nav click blips.

import { audio } from '../core/audio.js';

export function initHud({ onQualitySample }) {
  const fpsEl = document.getElementById('fps');
  const muteBtn = document.getElementById('mute');

  const syncMuteIcon = muted => { muteBtn.textContent = muted ? '🔇' : '🔊'; };
  syncMuteIcon(audio.muted);
  audio.onMuteChange(syncMuteIcon);
  muteBtn.addEventListener('click', () => audio.toggle());

  document.querySelectorAll('#nav a').forEach(a => {
    a.addEventListener('click', () => audio.blip());
  });

  return {
    setActiveRoute(route) {
      document.querySelectorAll('#nav a').forEach(a => {
        a.classList.toggle('active', a.dataset.route === route);
      });
    },
    setFps(fps) {
      fpsEl.textContent = `${Math.round(fps)} FPS`;
      if (onQualitySample) onQualitySample(fps);
    },
  };
}
