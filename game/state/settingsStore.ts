/**
 * Player-facing settings, persisted independently of save games.
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Difficulty, Quality, QUALITY, QualityConfig } from '@/game/types';

export interface SettingsState {
  sensitivity: number; // 0.3 .. 2.5
  invertY: boolean;
  fov: number; // 60 .. 95
  headBob: number; // 0 .. 1
  masterVolume: number;
  musicVolume: number;
  sfxVolume: number;
  ambienceVolume: number;
  quality: Quality;
  difficulty: Difficulty;
  showHints: boolean;
  crosshair: boolean;
  set: (partial: Partial<Omit<SettingsState, 'set'>>) => void;
}

export const useSettings = create<SettingsState>()(
  persist(
    (set) => ({
      sensitivity: 1,
      invertY: false,
      fov: 72,
      headBob: 1,
      masterVolume: 0.8,
      musicVolume: 0.7,
      sfxVolume: 1,
      ambienceVolume: 0.9,
      quality: 'high',
      difficulty: 'standard',
      showHints: true,
      crosshair: true,
      set: (partial) => set(partial),
    }),
    { name: 'hollowmoor-settings', version: 1 }
  )
);

export function qualityConfig(): QualityConfig {
  return QUALITY[useSettings.getState().quality];
}

export interface DifficultyConfig {
  /** Multiplier on the Keeper's perception ranges. */
  perception: number;
  /** Multiplier on the Keeper's movement speeds. */
  speed: number;
  /** Damage per hit. */
  attackDamage: number;
  /** Seconds of grace after a game starts before the Keeper wakes at all. */
  graceTime: number;
  /** How quickly suspicion builds. */
  suspicion: number;
  batteryDrainScale: number;
}

export const DIFFICULTY: Record<Difficulty, DifficultyConfig> = {
  mercy: {
    perception: 0.72,
    speed: 0.85,
    attackDamage: 25,
    graceTime: 180,
    suspicion: 0.7,
    batteryDrainScale: 0.65,
  },
  standard: {
    perception: 1,
    speed: 1,
    attackDamage: 34,
    graceTime: 90,
    suspicion: 1,
    batteryDrainScale: 1,
  },
  nightmare: {
    perception: 1.25,
    speed: 1.1,
    attackDamage: 50,
    graceTime: 40,
    suspicion: 1.35,
    batteryDrainScale: 1.35,
  },
};
