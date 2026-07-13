'use client';

/**
 * Title screen. Lightning-lit serif title over an animated storm backdrop,
 * difficulty selection, continue/load, settings and the manual.
 */

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useGame } from '@/game/state/gameStore';
import { useSettings } from '@/game/state/settingsStore';
import { anySaveExists, latestSave } from '@/game/state/save';
import { AudioEngine } from '@/game/audio/engine';
import { Difficulty } from '@/game/types';

const DIFF_LABELS: { id: Difficulty; name: string; desc: string }[] = [
  { id: 'mercy', name: 'Mercy', desc: 'It is slower, blinder, and gives you time.' },
  { id: 'standard', name: 'Standard', desc: 'The intended nightmare.' },
  { id: 'nightmare', name: 'Nightmare', desc: 'It is faster than you. Do not be heard.' },
];

export default function MainMenu() {
  const [pickingDifficulty, setPickingDifficulty] = useState(false);
  const [hasSave, setHasSave] = useState(false);
  const settings = useSettings();

  useEffect(() => {
    setHasSave(anySaveExists());
  }, []);

  const startNew = (d: Difficulty) => {
    AudioEngine.unlock();
    AudioEngine.play('ui_click', { volume: 0.7 });
    settings.set({ difficulty: d });
    useGame.getState().newGame(d);
  };

  const continueGame = () => {
    const save = latestSave();
    if (!save) return;
    AudioEngine.unlock();
    AudioEngine.play('ui_click', { volume: 0.7 });
    useGame.getState().loadGame(save);
  };

  return (
    <motion.div
      className="screen menu-screen"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.6 }}
    >
      <div className="storm-bg" aria-hidden />
      <div className="grain" aria-hidden />

      <motion.div
        className="menu-inner"
        initial={{ y: 24, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.25, duration: 0.9 }}
      >
        <p className="menu-over">a survival horror story</p>
        <h1 className="menu-title">HOLLOWMOOR</h1>
        <p className="menu-sub">The gate was open an hour ago.</p>

        {!pickingDifficulty ? (
          <nav className="menu-nav">
            <button className="menu-btn" onClick={() => setPickingDifficulty(true)}>
              New Game
            </button>
            <button className="menu-btn" disabled={!hasSave} onClick={continueGame}>
              Continue
            </button>
            <button
              className="menu-btn"
              disabled={!hasSave}
              onClick={() => useGame.getState().setOverlay('saves')}
            >
              Load Game
            </button>
            <button className="menu-btn" onClick={() => useGame.getState().setOverlay('settings')}>
              Settings
            </button>
            <button className="menu-btn" onClick={() => useGame.getState().setOverlay('howto')}>
              How to Survive
            </button>
          </nav>
        ) : (
          <div className="menu-nav">
            {DIFF_LABELS.map((d) => (
              <button key={d.id} className="menu-btn diff-btn" onClick={() => startNew(d.id)}>
                <span>{d.name}</span>
                <small>{d.desc}</small>
              </button>
            ))}
            <button className="menu-btn ghost" onClick={() => setPickingDifficulty(false)}>
              Back
            </button>
          </div>
        )}

        <p className="menu-foot">
          Headphones recommended · a pointer-locked first-person game · everything you hear, it
          hears too
        </p>
      </motion.div>
    </motion.div>
  );
}
