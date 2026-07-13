'use client';

/** The study safe: three-number dial, ratchet ticks, heavy clunk. */

import { useState } from 'react';
import { motion } from 'framer-motion';
import { useGame } from '@/game/state/gameStore';
import { requestPointerLock } from '@/game/hooks/useInput';
import { AudioEngine } from '@/game/audio/engine';

export default function SafeOverlay() {
  const [dials, setDials] = useState<[number, number, number]>([0, 0, 0]);
  const [wrong, setWrong] = useState(0);
  const run = useGame((s) => s.run);

  const close = () => {
    const g = useGame.getState();
    g.setOverlay(null);
    if (g.phase === 'playing') requestPointerLock();
  };

  const spin = (i: number, dir: 1 | -1) => {
    AudioEngine.play('safe_tick', { volume: 0.7, rate: 0.9 + Math.random() * 0.2 });
    setDials((d) => {
      const next = [...d] as [number, number, number];
      next[i] = (next[i] + dir + 10) % 10;
      return next;
    });
  };

  const tryOpen = () => {
    if (!run) return;
    const ok = dials.every((d, i) => d === run.safeCode[i]);
    if (ok) {
      AudioEngine.play('safe_open', { volume: 1 });
      useGame.getState().setFlag('safeOpen');
      close();
    } else {
      AudioEngine.play('door_locked', { volume: 0.7 });
      setWrong((w) => w + 1);
    }
  };

  return (
    <motion.div
      className="screen overlay-screen"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
    >
      <motion.div
        key={wrong}
        className="panel keypad-panel"
        animate={wrong > 0 ? { x: [0, -7, 7, -4, 4, 0] } : {}}
        transition={{ duration: 0.3 }}
      >
        <h2 className="panel-title">The study safe</h2>
        <p className="panel-sub">Left, right, left — the way you&apos;d scold a child.</p>
        <div className="safe-dials">
          {dials.map((d, i) => (
            <div key={i} className="safe-dial">
              <button className="dial-btn" onClick={() => spin(i, 1)}>
                ▲
              </button>
              <span className="dial-value">{d}</span>
              <button className="dial-btn" onClick={() => spin(i, -1)}>
                ▼
              </button>
            </div>
          ))}
        </div>
        <div className="menu-nav">
          <button className="menu-btn" onClick={tryOpen}>
            Pull the handle
          </button>
          <button className="menu-btn ghost" onClick={close}>
            Leave it
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
