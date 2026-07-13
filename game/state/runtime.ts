/**
 * Mutable per-frame runtime state, shared between systems without touching
 * React. Everything here is transient — the save system snapshots the few
 * fields it needs (positions, habits) and the rest is rebuilt on load.
 */

import * as THREE from 'three';
import { EnemyStateName, FloorId, HabitMemory, NoiseEvent, NoiseKind } from '@/game/types';

export interface Interactable {
  id: string;
  /** World position used for range/facing tests. */
  pos: THREE.Vector3;
  radius: number;
  prompt: string | (() => string);
  action: () => void;
  enabled?: () => boolean;
  /** Higher wins when several candidates overlap. */
  priority?: number;
}

export interface HiddenState {
  kind: 'wardrobe' | 'bed' | 'pantry';
  id: string;
  /** Eye position while hidden. */
  eye: THREE.Vector3;
  /** Where to restore the player on exit. */
  exit: THREE.Vector3;
  enteredSeen: boolean; // the Keeper watched the player hide
}

class Runtime {
  paused = true;

  player = {
    pos: new THREE.Vector3(),
    vel: new THREE.Vector3(),
    yaw: 0,
    pitch: 0,
    floor: 'ground' as FloorId,
    roomId: null as string | null,
    crouched: false,
    sprinting: false,
    onGround: true,
    speed2d: 0,
    leaning: 0,
    flashlightOn: false,
    flashlightDir: new THREE.Vector3(0, 0, -1),
    hidden: null as HiddenState | null,
    holdingBreath: false,
    grabbedProp: null as string | null,
    inVent: false,
    onRoof: false,
    dead: false,
  };

  enemy = {
    active: false,
    pos: new THREE.Vector3(-2.5, -2.9, 3),
    floor: 'basement' as FloorId,
    state: 'dormant' as EnemyStateName,
    /** 0..1 – how close to detecting the player (drives UI dread). */
    awareness: 0,
    aggression: 0.35,
    targetDoorId: null as string | null,
    /** Set by the brain when it wants a door opened/broken this frame. */
    doorRequests: [] as { id: string; action: 'open' | 'bang' | 'break' }[],
  };

  /** Recent sounds — consumed by the Keeper's hearing. */
  noises: NoiseEvent[] = [];

  weather = {
    rain: 0.7, // 0..1 current intensity
    wind: 0.4,
    lightning: 0, // flash luminance 0..1, decays fast
    thunderMask: 0, // recent-thunder noise masking, decays
    fogDensity: 0.032,
  };

  /** Camera shake impulse (damage, door slams, thunder). */
  shake = 0;

  /** Requested scripted climb (attic ladder); consumed by the player. */
  pendingClimb: { from: THREE.Vector3; to: THREE.Vector3 } | null = null;

  habits: HabitMemory = {
    hideCounts: { wardrobe: 0, bed: 0, pantry: 0 },
    roomHeat: {},
    timesSpotted: 0,
    deaths: 0,
  };

  interactables = new Map<string, Interactable>();

  /** Live door angle lookup so AI vision can respect ajar doors. */
  doorAngles = new Map<string, number>();

  reset(): void {
    this.noises.length = 0;
    this.player.pos.set(0, 0, 0);
    this.player.vel.set(0, 0, 0);
    this.player.hidden = null;
    this.player.dead = false;
    this.player.grabbedProp = null;
    this.player.flashlightOn = false;
    this.player.onRoof = false;
    this.enemy.active = false;
    this.enemy.state = 'dormant';
    this.enemy.awareness = 0;
    this.enemy.doorRequests.length = 0;
    this.shake = 0;
    this.interactables.clear();
    this.doorAngles.clear();
  }
}

export const RT = new Runtime();

/** Emit a sound the Keeper can hear. */
export function emitNoise(
  x: number,
  y: number,
  z: number,
  loudness: number,
  kind: NoiseKind,
  fromPlayer = true
): void {
  // Thunder masks noise — moving during a storm's roar is a real tactic.
  const masked = loudness * (1 - RT.weather.thunderMask * 0.75);
  if (masked < 0.02) return;
  RT.noises.push({ x, y, z, loudness: masked, kind, t: performance.now() / 1000, fromPlayer });
  if (RT.noises.length > 32) RT.noises.splice(0, RT.noises.length - 32);
}

export function registerInteractable(i: Interactable): () => void {
  RT.interactables.set(i.id, i);
  return () => {
    RT.interactables.delete(i.id);
  };
}

/** Record where the player spends time so the Keeper learns their habits. */
export function heatRoom(roomId: string | null, dt: number): void {
  if (!roomId) return;
  RT.habits.roomHeat[roomId] = Math.min(600, (RT.habits.roomHeat[roomId] ?? 0) + dt);
}
