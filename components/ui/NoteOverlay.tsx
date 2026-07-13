'use client';

/** Full-screen note reader — aged paper over the darkened world. */

import { motion } from 'framer-motion';
import { useGame } from '@/game/state/gameStore';
import { getNote } from '@/game/levels/notes';
import { requestPointerLock } from '@/game/hooks/useInput';
import { AudioEngine } from '@/game/audio/engine';

export default function NoteOverlay() {
  const noteId = useGame((s) => s.currentNote);
  const run = useGame((s) => s.run);
  if (!noteId || !run) return null;
  const note = getNote(noteId, run);

  const close = () => {
    AudioEngine.play('paper', { volume: 0.6 });
    const g = useGame.getState();
    g.setOverlay(null);
    useGame.setState({ currentNote: null });
    if (g.phase === 'playing') requestPointerLock();
  };

  return (
    <motion.div
      className="screen overlay-screen"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.25 }}
      onClick={close}
    >
      <motion.div
        className="note-paper"
        initial={{ y: 26, rotate: -1.5, opacity: 0 }}
        animate={{ y: 0, rotate: -0.6, opacity: 1 }}
        transition={{ duration: 0.35 }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="note-title">{note.title}</h3>
        {note.body.split('\n\n').map((para, i) => (
          <p key={i} className="note-body">
            {para}
          </p>
        ))}
        <button className="menu-btn ghost note-close" onClick={close}>
          Put it down
        </button>
      </motion.div>
    </motion.div>
  );
}
