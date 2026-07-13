'use client';

/**
 * Run preparation: synthesises the entire soundscape (first run only),
 * lets the world warm up behind it, then waits for a click — the gesture
 * that grants pointer lock and unlocks audio.
 */

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { AudioEngine } from '@/game/audio/engine';
import { useGame } from '@/game/state/gameStore';
import { requestPointerLock } from '@/game/hooks/useInput';

const TIPS = [
  'It hears better than it sees.',
  'Thunder swallows footsteps.',
  'Crouch-open a door to peek through the gap.',
  'It learns the hiding places you favour.',
  'A thrown bottle is a voice, telling it where to go.',
  'The lights stutter when it is near.',
  'Locked does not always mean impassable.',
];

export default function LoadingScreen() {
  const [progress, setProgress] = useState(0);
  const [ready, setReady] = useState(false);
  const [tip] = useState(() => TIPS[Math.floor(Math.random() * TIPS.length)]);
  const pendingLoad = useGame((s) => s.pendingLoad);

  useEffect(() => {
    let alive = true;
    AudioEngine.init((p) => {
      if (alive) setProgress(p);
    }).then(() => {
      if (alive) {
        setProgress(1);
        // Give the world a beat to compile shaders behind the veil.
        window.setTimeout(() => alive && setReady(true), 600);
      }
    });
    return () => {
      alive = false;
    };
  }, []);

  const enter = () => {
    if (!ready) return;
    AudioEngine.unlock();
    const g = useGame.getState();
    if (g.pendingLoad) {
      // Loaded game: skip the intro and resume where the save left off.
      g.setPhase('playing');
      g.clearPendingLoad();
      requestPointerLock();
    } else {
      g.setPhase('intro');
    }
  };

  return (
    <motion.div
      className="screen loading-screen"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={enter}
    >
      <div className="grain" aria-hidden />
      <div className="loading-inner">
        <h2 className="loading-title">HOLLOWMOOR</h2>
        <div className="loading-bar">
          <div className="loading-fill" style={{ width: `${Math.round(progress * 100)}%` }} />
        </div>
        <p className="loading-status">
          {!ready
            ? progress < 1
              ? 'The house is tuning its voice…'
              : 'Settling the dust…'
            : pendingLoad
              ? 'Click — return to where you left it.'
              : 'Click — step inside.'}
        </p>
        <p className="loading-tip">{tip}</p>
      </div>
    </motion.div>
  );
}
