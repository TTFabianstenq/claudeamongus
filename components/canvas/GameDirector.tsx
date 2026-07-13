'use client';

/**
 * Invisible systems conductor: play-time ticking, autosave, adaptive
 * aggression, contextual hints for stuck players, random house ambience
 * (creaks, pipe clanks, distant sounds), and clean-up of the pending
 * save-load snapshot once the world has consumed it.
 */

import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGame, worldActive } from '@/game/state/gameStore';
import { useSettings } from '@/game/state/settingsStore';
import { useHud } from '@/game/state/hudStore';
import { RT } from '@/game/state/runtime';
import { AudioEngine } from '@/game/audio/engine';
import { AUTOSAVE_SLOT, canSaveNow, writeSave } from '@/game/state/save';
import { clamp01 } from '@/game/utils/math';
import { FLOOR_Y } from '@/game/types';

const HINTS: { id: string; after: number; when: () => boolean; text: string }[] = [
  {
    id: 'hint_gate',
    after: 150,
    when: () => !useGame.getState().flags.sawGate,
    text: 'Hint: the front gate is worth a look — bring a light.',
  },
  {
    id: 'hint_basement',
    after: 320,
    when: () => !useGame.getState().flags.sawPanel,
    text: 'Hint: the cellar holds the mains panel. The cellar door key is somewhere on the ground floor.',
  },
  {
    id: 'hint_study',
    after: 460,
    when: () =>
      !useGame.getState().flags.bookcaseOpen && !useGame.getState().doors.door_study?.open,
    text: 'Hint: the study has more ways in than its locked door. Try the washroom vent, or the library shelves.',
  },
  {
    id: 'hint_hide',
    after: 240,
    when: () => RT.habits.hideCounts.wardrobe + RT.habits.hideCounts.bed === 0,
    text: 'Hint: wardrobes and beds are hiding places. It checks the ones you favour.',
  },
];

export default function GameDirector() {
  const hintShown = useRef(new Set<string>());
  const autosaveTimer = useRef(60);
  const ambienceTimer = useRef(7);
  const aggressionTimer = useRef(10);

  // The pending load snapshot is consumed by Player/Enemy mount effects and
  // finally cleared by the loading screen when the run actually starts.

  useFrame((state, rawDt) => {
    if (!worldActive()) return;
    const dt = Math.min(rawDt, 0.1);
    const g = useGame.getState();
    g.tick(dt);

    /* --- hints --- */
    if (useSettings.getState().showHints) {
      for (const h of HINTS) {
        if (g.timePlayed > h.after && !hintShown.current.has(h.id) && h.when()) {
          hintShown.current.add(h.id);
          useHud.getState().setHint(h.text);
          window.setTimeout(() => useHud.getState().setHint(null), 9000);
          break;
        }
      }
    }

    /* --- autosave (only when calm) --- */
    autosaveTimer.current -= dt;
    if (autosaveTimer.current <= 0) {
      autosaveTimer.current = 90;
      if (canSaveNow()) writeSave(AUTOSAVE_SLOT);
    }

    /* --- adaptive aggression: the longer you survive and the more you
       collect, the bolder it gets; dying eases it off slightly. --- */
    aggressionTimer.current -= dt;
    if (aggressionTimer.current <= 0) {
      aggressionTimer.current = 12;
      const items = Object.values(g.inventory).reduce((a, b) => a + (b ?? 0), 0);
      const progress =
        (g.flags.powerOn ? 0.1 : 0) +
        (g.flags.gateChainCut ? 0.12 : 0) +
        (g.flags.hatchPried ? 0.1 : 0) +
        (g.flags.safeOpen ? 0.08 : 0);
      RT.enemy.aggression = clamp01(
        0.3 +
          items * 0.025 +
          progress +
          RT.habits.timesSpotted * 0.03 +
          g.timePlayed / 1800 -
          RT.habits.deaths * 0.04
      );
    }

    /* --- ambient dread: random creaks/clanks positioned near the player --- */
    ambienceTimer.current -= dt;
    if (ambienceTimer.current <= 0) {
      ambienceTimer.current = 6 + Math.random() * 14;
      const p = RT.player.pos;
      const angle = Math.random() * Math.PI * 2;
      const dist = 4 + Math.random() * 7;
      const pos: [number, number, number] = [
        p.x + Math.cos(angle) * dist,
        p.y + (Math.random() < 0.3 ? 2.6 : 0.5),
        p.z + Math.sin(angle) * dist,
      ];
      const inBasement = RT.player.floor === 'basement';
      const roll = Math.random();
      if (inBasement || roll < 0.3) {
        AudioEngine.play3d('pipe_clank', pos, { volume: 0.4 + Math.random() * 0.3 });
      } else if (roll < 0.8) {
        AudioEngine.play3d('house_creak', pos, {
          volume: 0.35 + Math.random() * 0.35,
          rate: 0.8 + Math.random() * 0.4,
        });
      } else if (RT.enemy.active) {
        // A distant trace of it — always real, always positional.
        AudioEngine.play3d('keeper_step', [RT.enemy.pos.x, RT.enemy.pos.y, RT.enemy.pos.z], {
          volume: 0.5,
          occlusion: RT.enemy.floor === RT.player.floor ? 0.8 : 0.35,
        });
      }
    }
  });

  return null;
}

export { FLOOR_Y };
