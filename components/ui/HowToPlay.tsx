'use client';

/** Controls & survival manual. */

import { motion } from 'framer-motion';
import { useGame } from '@/game/state/gameStore';
import { AudioEngine } from '@/game/audio/engine';

const CONTROLS: [string, string][] = [
  ['W A S D', 'Move'],
  ['Mouse', 'Look'],
  ['Shift', 'Sprint (drains stamina) / hold breath while hidden'],
  ['Ctrl or C', 'Crouch — quieter, fits through crawl vents'],
  ['Space', 'Jump, or vault waist-high obstacles'],
  ['Q / E', 'Lean around corners'],
  ['Left click', 'Interact · throw a held object'],
  ['Right click', 'Grab / set down physics objects'],
  ['G', 'Throw a held object'],
  ['F', 'Flashlight (eats batteries)'],
  ['Tab', 'Pockets & journal'],
  ['Esc', 'Pause'],
];

const LORE = [
  'Escape the property. There is more than one way out — the chained gate, the car in the garage, and something older beneath the cellar.',
  'The Keeper is not scripted. It patrols, listens, remembers, and searches. Noise is your enemy: run on carpet not boards, close doors softly, let thunder cover you.',
  'It checks hiding places — starting with the kind you use most.',
  'Locks rarely have only one answer. Vents, bookcases and crowbars open paths keys will not.',
  'Every run shuffles the keys, tools, codes and the safe. What you learned last night may be a lie tonight.',
];

export default function HowToPlay() {
  const close = () => {
    AudioEngine.play('ui_click', { volume: 0.6 });
    const g = useGame.getState();
    g.setOverlay(g.phase === 'playing' ? 'pause' : null);
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
        <h2 className="panel-title">How to survive</h2>
        <div className="howto-cols">
          <div>
            <h3 className="setting-group">Controls</h3>
            <table className="controls-table">
              <tbody>
                {CONTROLS.map(([key, what]) => (
                  <tr key={key}>
                    <td className="key-cell">{key}</td>
                    <td>{what}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div>
            <h3 className="setting-group">The rules of the house</h3>
            {LORE.map((l, i) => (
              <p key={i} className="howto-lore">
                {l}
              </p>
            ))}
          </div>
        </div>
        <div className="menu-nav">
          <button className="menu-btn" onClick={close}>
            Understood
          </button>
        </div>
      </div>
    </motion.div>
  );
}
