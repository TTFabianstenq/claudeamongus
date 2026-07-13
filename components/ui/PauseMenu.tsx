'use client';

/** Pause overlay. The world is frozen while any overlay is open. */

import { motion } from 'framer-motion';
import { useGame } from '@/game/state/gameStore';
import { requestPointerLock } from '@/game/hooks/useInput';
import { AudioEngine } from '@/game/audio/engine';
import { canSaveNow } from '@/game/state/save';
import { formatTime } from '@/game/utils/math';

export default function PauseMenu() {
  const timePlayed = useGame((s) => s.timePlayed);
  const difficulty = useGame((s) => s.difficulty);

  const resume = () => {
    AudioEngine.play('ui_click', { volume: 0.6 });
    useGame.getState().setOverlay(null);
    requestPointerLock();
  };

  return (
    <motion.div
      className="screen overlay-screen"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.25 }}
    >
      <div className="panel">
        <h2 className="panel-title">Paused</h2>
        <p className="panel-sub">
          {formatTime(timePlayed)} inside · {difficulty}
        </p>
        <div className="menu-nav">
          <button className="menu-btn" onClick={resume}>
            Resume
          </button>
          <button
            className="menu-btn"
            onClick={() => useGame.getState().setOverlay('saves')}
            title={canSaveNow() ? '' : 'It is too close to stop now'}
          >
            Save / Load
          </button>
          <button className="menu-btn" onClick={() => useGame.getState().setOverlay('settings')}>
            Settings
          </button>
          <button className="menu-btn" onClick={() => useGame.getState().setOverlay('howto')}>
            Controls
          </button>
          <button className="menu-btn ghost" onClick={() => useGame.getState().backToMenu()}>
            Abandon to Menu
          </button>
        </div>
      </div>
    </motion.div>
  );
}
