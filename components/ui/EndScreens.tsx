'use client';

/** Death and the three escapes — with run statistics. */

import { useEffect } from 'react';
import { motion } from 'framer-motion';
import { useGame } from '@/game/state/gameStore';
import { latestSave } from '@/game/state/save';
import { RT } from '@/game/state/runtime';
import { formatTime } from '@/game/utils/math';
import { AudioEngine } from '@/game/audio/engine';
import { EndingId } from '@/game/types';

const ENDING_TEXT: Record<EndingId, { title: string; body: string }> = {
  gate: {
    title: 'THROUGH THE GATE',
    body: 'The chain lies in the mud behind you. You walk the middle of Braecken Lane, in the rain, in the open, where nothing can stand quietly at your shoulder. You do not look back at the light on the porch. It was never for you.',
  },
  car: {
    title: 'THE LONG DRIVE',
    body: 'The engine catches on the third try and the headlamps carve the storm open. In the mirror, at the end of the drive, something tall stands in the garage doorway — not chasing. Waiting. It has all the time in the world, and now, so do you.',
  },
  tunnel: {
    title: 'UNDER THE MOOR',
    body: 'The Vessers dug in secret and prayed they would never need it. You climb out through a badger-gnawed grate half a mile beyond the fence, lungs full of earth-smell, and the house is just a black tooth against the clouds. Counting, somewhere inside. One. Two. Three.',
  },
};

export default function EndScreens() {
  const phase = useGame((s) => s.phase);
  const ending = useGame((s) => s.ending);
  const timePlayed = useGame((s) => s.timePlayed);
  const difficulty = useGame((s) => s.difficulty);
  const notes = useGame((s) => s.notesFound.length);
  const dead = phase === 'dead';

  useEffect(() => {
    if (!dead && ending) {
      AudioEngine.stopAllLoops();
      AudioEngine.play('victory_tone', { volume: 0.8 });
    }
  }, [dead, ending]);

  const retry = () => {
    const save = latestSave();
    const g = useGame.getState();
    AudioEngine.play('ui_click', { volume: 0.7 });
    if (save) g.loadGame(save);
    else g.newGame(g.difficulty);
  };

  const info = !dead && ending ? ENDING_TEXT[ending] : null;

  return (
    <motion.div
      className={`screen end-screen ${dead ? 'dead' : 'victory'}`}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: dead ? 0.15 : 1.4 }}
      exit={{ opacity: 0 }}
    >
      <div className="grain" aria-hidden />
      <motion.div
        className="end-inner"
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: dead ? 1.1 : 0.8, duration: 0.9 }}
      >
        <h1 className={`end-title ${dead ? 'red' : ''}`}>
          {dead ? 'IT KEEPS YOU NOW' : info?.title}
        </h1>
        <p className="end-body">
          {dead
            ? 'The last thing you hear is counting — soft, patient, very close. The house adds you to its rounds.'
            : info?.body}
        </p>
        <div className="end-stats">
          <span>{formatTime(timePlayed)} survived</span>
          <span>{difficulty}</span>
          <span>{notes} of 8 papers found</span>
          <span>
            {RT.habits.deaths} death{RT.habits.deaths === 1 ? '' : 's'} this night
          </span>
        </div>
        <div className="menu-nav">
          {dead && (
            <button className="menu-btn" onClick={retry}>
              Rise again
            </button>
          )}
          {!dead && (
            <button
              className="menu-btn"
              onClick={() => useGame.getState().newGame(useGame.getState().difficulty)}
            >
              Another night (new layout)
            </button>
          )}
          <button className="menu-btn ghost" onClick={() => useGame.getState().backToMenu()}>
            Main menu
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
