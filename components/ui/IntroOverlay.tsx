'use client';

/** Opening text crawl — sets the scene, then hands over control. */

import { motion } from 'framer-motion';
import { useGame } from '@/game/state/gameStore';
import { requestPointerLock } from '@/game/hooks/useInput';
import { AudioEngine } from '@/game/audio/engine';

const LINES = [
  'Your car died a mile back, where the pines close over Braecken Lane.',
  'Hollowmoor House was the only light — one bulb, guttering over a porch.',
  'You knocked. Nobody. The door stood unlocked, so you stepped out of the rain.',
  'Behind you, down the long drive, a chain rattled through the gate.',
  'You did not hear anyone chain it.',
];

export default function IntroOverlay() {
  const begin = () => {
    AudioEngine.unlock();
    useGame.getState().setPhase('playing');
    requestPointerLock();
  };

  return (
    <motion.div
      className="screen intro-screen"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: 1.2 } }}
    >
      <div className="grain" aria-hidden />
      <div className="intro-inner">
        {LINES.map((line, i) => (
          <motion.p
            key={i}
            className="intro-line"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.8 + i * 1.1, duration: 1 }}
          >
            {line}
          </motion.p>
        ))}
        <motion.button
          className="menu-btn intro-begin"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8 + LINES.length * 1.1, duration: 1 }}
          onClick={begin}
        >
          Find a way out
        </motion.button>
      </div>
    </motion.div>
  );
}
