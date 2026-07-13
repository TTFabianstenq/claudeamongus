'use client';

/**
 * The hatch's mechanical number lock. Wrong tries beep — and beeps carry.
 */

import { useState } from 'react';
import { motion } from 'framer-motion';
import { useGame } from '@/game/state/gameStore';
import { requestPointerLock } from '@/game/hooks/useInput';
import { AudioEngine } from '@/game/audio/engine';
import { emitNoise, RT } from '@/game/state/runtime';

export default function KeypadOverlay() {
  const [entry, setEntry] = useState('');
  const [shakeKey, setShakeKey] = useState(0);
  const run = useGame((s) => s.run);

  const close = () => {
    const g = useGame.getState();
    g.setOverlay(null);
    useGame.setState({ keypadTarget: null });
    if (g.phase === 'playing') requestPointerLock();
  };

  const press = (d: string) => {
    if (entry.length >= 4) return;
    AudioEngine.play('keypad_beep', { volume: 0.7, rate: 0.95 + Math.random() * 0.1 });
    const next = entry + d;
    setEntry(next);
    if (next.length === 4 && run) {
      window.setTimeout(() => {
        const g = useGame.getState();
        if (next === run.hatchCode) {
          AudioEngine.play('keypad_ok', { volume: 0.8 });
          AudioEngine.play('hatch_open', { volume: 0.9 });
          g.setFlag('hatchOpen');
          close();
        } else {
          AudioEngine.play('keypad_err', { volume: 0.8 });
          const p = RT.player.pos;
          emitNoise(p.x, p.y + 1, p.z, 0.5, 'machine');
          setEntry('');
          setShakeKey((k) => k + 1);
        }
      }, 260);
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
        key={shakeKey}
        className="panel keypad-panel"
        animate={shakeKey > 0 ? { x: [0, -8, 8, -5, 5, 0] } : {}}
        transition={{ duration: 0.35 }}
      >
        <h2 className="panel-title">Number lock</h2>
        <p className="panel-sub">Two halves make a door.</p>
        <div className="keypad-display">
          {Array.from({ length: 4 }, (_, i) => (
            <span key={i} className="keypad-digit">
              {entry[i] ?? '·'}
            </span>
          ))}
        </div>
        <div className="keypad-grid">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', '⌫'].map((k, i) =>
            k === '' ? (
              <span key={i} />
            ) : k === '⌫' ? (
              <button
                key={i}
                className="keypad-btn"
                onClick={() => {
                  AudioEngine.play('keypad_beep', { volume: 0.5, rate: 0.8 });
                  setEntry((e) => e.slice(0, -1));
                }}
              >
                ⌫
              </button>
            ) : (
              <button key={i} className="keypad-btn" onClick={() => press(k)}>
                {k}
              </button>
            )
          )}
        </div>
        <div className="menu-nav">
          <button className="menu-btn ghost" onClick={close}>
            Step back
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
