'use client';

/**
 * Inventory + journal. Items render as inline SVG sketches; batteries and
 * bandages are usable from here; collected notes can be re-read.
 */

import { motion } from 'framer-motion';
import { useGame } from '@/game/state/gameStore';
import { ITEMS, ItemId, NoteId } from '@/game/types';
import { requestPointerLock } from '@/game/hooks/useInput';
import { AudioEngine } from '@/game/audio/engine';
import { getNote } from '@/game/levels/notes';
import { ItemIcon } from '@/components/ui/icons';
import { NOTE_ORDER } from '@/game/levels/notes';

export default function InventoryPanel() {
  const inventory = useGame((s) => s.inventory);
  const notes = useGame((s) => s.notesFound);
  const run = useGame((s) => s.run);

  const close = () => {
    AudioEngine.play('ui_click', { volume: 0.6 });
    useGame.getState().setOverlay(null);
    requestPointerLock();
  };

  const use = (id: ItemId) => {
    const g = useGame.getState();
    if (id === 'bandage') g.useBandage();
    if (id === 'battery') g.useBattery();
  };

  const entries = Object.entries(inventory) as [ItemId, number][];
  const sortedNotes = NOTE_ORDER.filter((n) => notes.includes(n));

  return (
    <motion.div
      className="screen overlay-screen"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
    >
      <div className="panel wide inventory-panel">
        <h2 className="panel-title">Pockets</h2>
        {entries.length === 0 ? (
          <p className="panel-sub">Rain, lint, and nothing useful.</p>
        ) : (
          <div className="inv-grid">
            {entries.map(([id, count]) => (
              <button
                key={id}
                className={`inv-item ${id === 'bandage' || id === 'battery' ? 'usable' : ''}`}
                onClick={() => use(id)}
                title={ITEMS[id].desc}
              >
                <ItemIcon item={id} />
                <span className="inv-name">{ITEMS[id].name}</span>
                {ITEMS[id].stack && count > 1 && <span className="inv-count">×{count}</span>}
                {(id === 'bandage' || id === 'battery') && <span className="inv-use">use</span>}
              </button>
            ))}
          </div>
        )}

        <h3 className="setting-group">Papers found</h3>
        {sortedNotes.length === 0 ? (
          <p className="panel-sub">No writings yet. The house keeps its words hidden.</p>
        ) : (
          <div className="note-list">
            {sortedNotes.map((n: NoteId) => (
              <button
                key={n}
                className="note-link"
                onClick={() => {
                  AudioEngine.play('paper', { volume: 0.7 });
                  useGame.getState().openNote(n);
                }}
              >
                {run ? getNote(n, run).title : n}
              </button>
            ))}
          </div>
        )}

        <div className="menu-nav">
          <button className="menu-btn" onClick={close}>
            Close (Tab)
          </button>
        </div>
      </div>
    </motion.div>
  );
}
