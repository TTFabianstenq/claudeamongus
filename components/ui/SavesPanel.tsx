'use client';

/**
 * Save slots: three manual slots plus the rolling autosave. Saving is
 * blocked while the Keeper hunts.
 */

import { useCallback, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useGame } from '@/game/state/gameStore';
import {
  AUTOSAVE_SLOT,
  SAVE_SLOTS,
  canSaveNow,
  deleteSave,
  readSave,
  saveMeta,
  writeSave,
} from '@/game/state/save';
import { SaveMeta } from '@/game/types';
import { formatTime } from '@/game/utils/math';
import { AudioEngine } from '@/game/audio/engine';
import { useHud } from '@/game/state/hudStore';

export default function SavesPanel() {
  const phase = useGame((s) => s.phase);
  const [metas, setMetas] = useState<(SaveMeta | null)[]>([]);
  const inGame = phase === 'playing';

  const refresh = useCallback(() => {
    setMetas([AUTOSAVE_SLOT, ...SAVE_SLOTS].map((slot) => saveMeta(slot)));
  }, []);

  useEffect(refresh, [refresh]);

  const close = () => {
    AudioEngine.play('ui_click', { volume: 0.6 });
    const g = useGame.getState();
    g.setOverlay(g.phase === 'playing' ? 'pause' : null);
  };

  const doSave = (slot: number) => {
    if (!inGame) return;
    if (!canSaveNow()) {
      useHud.getState().toast('Not now. It is too close.');
      AudioEngine.play('keypad_err', { volume: 0.5 });
      return;
    }
    if (writeSave(slot)) {
      AudioEngine.play('keypad_ok', { volume: 0.5 });
      refresh();
    }
  };

  const doLoad = (slot: number) => {
    const save = readSave(slot);
    if (!save) return;
    AudioEngine.play('ui_click', { volume: 0.7 });
    useGame.getState().loadGame(save);
  };

  const doDelete = (slot: number) => {
    deleteSave(slot);
    AudioEngine.play('ui_click', { volume: 0.5 });
    refresh();
  };

  return (
    <motion.div
      className="screen overlay-screen"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.25 }}
    >
      <div className="panel wide">
        <h2 className="panel-title">Saved games</h2>
        {inGame && !canSaveNow() && (
          <p className="panel-sub danger">You cannot stop to write while it hunts.</p>
        )}
        <div className="save-list">
          {[AUTOSAVE_SLOT, ...SAVE_SLOTS].map((slot, i) => {
            const meta = metas[i];
            return (
              <div key={slot} className="save-row">
                <div className="save-info">
                  <strong>{slot === AUTOSAVE_SLOT ? 'Autosave' : `Slot ${slot}`}</strong>
                  {meta ? (
                    <span>
                      {meta.location} · {formatTime(meta.timePlayed)} · {meta.difficulty} ·{' '}
                      {new Date(meta.savedAt).toLocaleString()}
                    </span>
                  ) : (
                    <span>empty</span>
                  )}
                </div>
                <div className="save-actions">
                  {inGame && slot !== AUTOSAVE_SLOT && (
                    <button className="chip" onClick={() => doSave(slot)}>
                      Save
                    </button>
                  )}
                  {meta && (
                    <button className="chip" onClick={() => doLoad(slot)}>
                      Load
                    </button>
                  )}
                  {meta && slot !== AUTOSAVE_SLOT && (
                    <button className="chip ghost" onClick={() => doDelete(slot)}>
                      Delete
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
        <div className="menu-nav">
          <button className="menu-btn" onClick={close}>
            Back
          </button>
        </div>
      </div>
    </motion.div>
  );
}
