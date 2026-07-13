/**
 * LocalStorage save system — three manual slots plus a rolling autosave.
 * A save captures game-store state plus the handful of runtime fields that
 * matter (player/Keeper positions, learned habits) so a loaded game resumes
 * exactly where it was, Keeper included. Never trusts stored JSON blindly.
 */

import { FLOOR_Y, SaveData, SaveMeta } from '@/game/types';
import { useGame } from '@/game/state/gameStore';
import { RT } from '@/game/state/runtime';
import { roomAt } from '@/game/levels/layout';

const KEY_PREFIX = 'hollowmoor-save-';
export const AUTOSAVE_SLOT = 0;
export const SAVE_SLOTS = [1, 2, 3];

export function canSaveNow(): boolean {
  const s = useGame.getState();
  if (s.phase !== 'playing') return false;
  // No saving mid-chase: the Keeper must not be hunting you.
  return !['chase', 'track', 'attack', 'breakdoor'].includes(RT.enemy.state);
}

export function buildSave(): SaveData {
  const s = useGame.getState();
  return {
    version: 2,
    savedAt: Date.now(),
    seed: s.seed,
    difficulty: s.difficulty,
    timePlayed: s.timePlayed,
    phase: 'playing',
    player: {
      pos: [RT.player.pos.x, RT.player.pos.y, RT.player.pos.z],
      yaw: RT.player.yaw,
      health: s.health,
      stamina: s.stamina,
      battery: s.battery,
    },
    inventory: { ...s.inventory },
    notesFound: [...s.notesFound],
    flags: { ...s.flags },
    doors: Object.fromEntries(Object.entries(s.doors).map(([k, v]) => [k, { ...v }])),
    objectives: s.objectives.map((o) => ({ ...o })),
    takenSpawns: [...s.takenSpawns],
    searchedContainers: [...s.searchedContainers],
    brokenWindows: [...s.brokenWindows],
    litRooms: Object.entries(s.litRooms)
      .filter(([, v]) => v)
      .map(([k]) => k),
    enemy: {
      pos: [RT.enemy.pos.x, RT.enemy.pos.y, RT.enemy.pos.z],
      floor: RT.enemy.floor,
      state: RT.enemy.active ? 'roam' : 'dormant',
      aggression: RT.enemy.aggression,
    },
    habits: {
      hideCounts: { ...RT.habits.hideCounts },
      roomHeat: { ...RT.habits.roomHeat },
      timesSpotted: RT.habits.timesSpotted,
      deaths: RT.habits.deaths,
    },
  };
}

export function writeSave(slot: number): boolean {
  try {
    const data = buildSave();
    localStorage.setItem(KEY_PREFIX + slot, JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}

export function readSave(slot: number): SaveData | null {
  try {
    const raw = localStorage.getItem(KEY_PREFIX + slot);
    if (!raw) return null;
    const data = JSON.parse(raw) as SaveData;
    if (data.version !== 2 || data.phase !== 'playing') return null;
    if (!data.player || !Array.isArray(data.player.pos) || typeof data.seed !== 'number') {
      return null;
    }
    return data;
  } catch {
    return null;
  }
}

export function deleteSave(slot: number): void {
  try {
    localStorage.removeItem(KEY_PREFIX + slot);
  } catch {
    /* storage unavailable */
  }
}

export function saveMeta(slot: number): SaveMeta | null {
  const data = readSave(slot);
  if (!data) return null;
  const [x, , z] = data.player.pos;
  const y = data.player.pos[1];
  const floor =
    y < FLOOR_Y.ground - 0.8
      ? 'basement'
      : y < FLOOR_Y.upper - 0.8
        ? 'ground'
        : y < FLOOR_Y.attic - 0.8
          ? 'upper'
          : 'attic';
  const room = roomAt(floor, x, z);
  return {
    slot,
    savedAt: data.savedAt,
    timePlayed: data.timePlayed,
    difficulty: data.difficulty,
    location: room ? room.name : floor === 'ground' ? 'The Grounds' : 'Hollowmoor House',
  };
}

export function anySaveExists(): boolean {
  return [AUTOSAVE_SLOT, ...SAVE_SLOTS].some((s) => readSave(s) !== null);
}

export function latestSave(): SaveData | null {
  let best: SaveData | null = null;
  for (const slot of [AUTOSAVE_SLOT, ...SAVE_SLOTS]) {
    const s = readSave(slot);
    if (s && (!best || s.savedAt > best.savedAt)) best = s;
  }
  return best;
}
