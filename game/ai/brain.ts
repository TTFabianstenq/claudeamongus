/**
 * The Keeper's mind.
 *
 * A utility-driven state machine over a real navigation mesh — nothing is
 * scripted and it never teleports. The brain perceives through simulated
 * senses only (vision cone + occlusion raycasts supplied by the body,
 * distance/wall-attenuated hearing), keeps memory (last known position,
 * velocity prediction, learned player habits), and plans with A*.
 *
 * States: dormant → idle/patrol/roam ↔ listen/suspicious → investigate →
 * search (incl. checking hiding spots) ↔ track → chase → attack, plus
 * breakdoor and return.
 */

import * as THREE from 'three';
import { EnemyStateName, FLOOR_Y, FloorId } from '@/game/types';
import { NavGrid, NavPoint, NavFloor, PATROL_ROOMS, YARD_POINTS } from '@/game/ai/navgrid';
import { HIDE_SPOTS, HideSpot, roomAt } from '@/game/levels/layout';
import { RNG } from '@/game/utils/rng';
import { RT } from '@/game/state/runtime';
import { clamp, clamp01, dist2d } from '@/game/utils/math';
import { DIFFICULTY, DifficultyConfig } from '@/game/state/settingsStore';
import { Difficulty } from '@/game/types';

export interface BrainSenses {
  /** 0..1 — how clearly the body can see the player right now. */
  visibility: number;
  playerPos: THREE.Vector3;
  playerFloor: FloorId;
  playerHiddenId: string | null;
  playerHiddenSeen: boolean;
  playerSpeed: number;
}

export interface DoorInfo {
  open: boolean;
  locked: boolean;
  broken: boolean;
  breakable: boolean;
  exists: boolean;
}

export interface BrainHooks {
  doorInfo: (id: string) => DoorInfo;
  secretOpen: (id: string) => boolean;
  requestDoor: (id: string, action: 'open' | 'bang' | 'break') => void;
  cue: (sound: 'alert' | 'scream' | 'growl' | 'found') => void;
  /** The Keeper rips the player out of a hiding place. */
  dragOut: (spotId: string) => void;
}

export interface BrainOutput {
  state: EnemyStateName;
  /** Where the body should move to this frame (world), or null to hold. */
  moveTarget: THREE.Vector3 | null;
  speed: number;
  /** Yaw the head/body should face (radians) when holding position. */
  faceYaw: number | null;
  attack: boolean;
  /** 0..1 for UI dread + music. */
  awareness: number;
}

interface Memory {
  lastKnown: THREE.Vector3 | null;
  lastKnownFloor: NavFloor;
  lastSeenAt: number;
  predicted: THREE.Vector3 | null;
  playerVel: THREE.Vector3;
}

const navFloorOf = (f: FloorId): NavFloor => (f === 'attic' ? 'upper' : f);

export class KeeperBrain {
  state: EnemyStateName = 'dormant';
  private stateTime = 0;
  private suspicion = 0; // 0..100
  private path: NavPoint[] = [];
  private pathIdx = 0;
  private repathTimer = 0;
  private waitTimer = 0;
  private target: { x: number; z: number; floor: NavFloor } | null = null;
  private mem: Memory = {
    lastKnown: null,
    lastKnownFloor: 'ground',
    lastSeenAt: -999,
    predicted: null,
    playerVel: new THREE.Vector3(),
  };
  private searchQueue: { x: number; y: number; z: number; floor: NavFloor; spot?: HideSpot }[] = [];
  private scanTimer = 0;
  private blockedDoors = new Map<string, number>(); // id -> expiry time
  private bangDoor: string | null = null;
  private bangCount = 0;
  private lastVisitedRooms: string[] = [];
  private noiseCursor = 0;
  private faceYaw: number | null = null;
  private prevPlayerPos = new THREE.Vector3();
  private stuckTimer = 0;
  private lastPos = new THREE.Vector3();
  private diff: DifficultyConfig;

  constructor(
    private grid: NavGrid,
    private rng: RNG,
    difficulty: Difficulty,
    private hooks: BrainHooks
  ) {
    this.diff = DIFFICULTY[difficulty];
  }

  /** Restore a saved coarse state. */
  restore(state: EnemyStateName): void {
    this.state = state === 'dormant' ? 'dormant' : 'roam';
  }

  private setState(s: EnemyStateName): void {
    if (this.state === s) return;
    this.state = s;
    this.stateTime = 0;
    if (s === 'chase') this.hooks.cue('scream');
    else if (s === 'investigate' || s === 'suspicious') this.hooks.cue('alert');
    else if (s === 'search') this.hooks.cue('growl');
  }

  private aggression(): number {
    return clamp01(RT.enemy.aggression);
  }

  private speedFor(state: EnemyStateName): number {
    const a = this.aggression();
    const s = this.diff.speed * (1 + a * 0.12);
    switch (state) {
      case 'patrol':
        return 1.15 * s;
      case 'roam':
      case 'return':
        return 1.35 * s;
      case 'investigate':
        return 1.75 * s;
      case 'search':
        return 1.45 * s;
      case 'track':
        return 2.7 * s;
      case 'chase':
        return 3.4 * s;
      default:
        return 0;
    }
  }

  /* ---------------- pathing ---------------- */

  private doorPassable = (id: string): boolean => {
    if (id === 'secret_bookcase' || id === 'secret_shelf') return this.hooks.secretOpen(id);
    const now = performance.now() / 1000;
    const blockedUntil = this.blockedDoors.get(id);
    if (blockedUntil && blockedUntil > now) return false;
    const d = this.hooks.doorInfo(id);
    if (!d.exists) return true; // opening without a live door (arches)
    if (d.broken || d.open) return true;
    if (!d.locked) return true;
    // Locked: only worth pathing through if we're angry enough to break it.
    return d.breakable && (this.state === 'chase' || this.state === 'track');
  };

  private planTo(x: number, z: number, floor: NavFloor, fromPos: THREE.Vector3): boolean {
    const from = {
      floor: navFloorOf(RT.enemy.floor),
      x: fromPos.x,
      z: fromPos.z,
    };
    const path = this.grid.findPath(from, { floor, x, z }, this.doorPassable);
    if (!path || path.length === 0) return false;
    this.path = path;
    this.pathIdx = 0;
    this.target = { x, z, floor };
    return true;
  }

  /* ---------------- hearing ---------------- */

  private listen(pos: THREE.Vector3, now: number): void {
    for (; this.noiseCursor < RT.noises.length; this.noiseCursor++) {
      const n = RT.noises[this.noiseCursor];
      if (now - n.t > 4) continue;
      const d = Math.hypot(n.x - pos.x, n.y - pos.y, n.z - pos.z);
      // Wall/floor attenuation approximation: same-floor noises carry.
      const floorGap = Math.abs(n.y - pos.y);
      const floorPenalty = floorGap > 1.6 ? 0.45 : 1;
      const range = 6 + n.loudness * 22 * this.diff.perception;
      if (d > range) continue;
      const strength = clamp01(1 - d / range) * n.loudness * floorPenalty;
      if (strength < 0.04) continue;

      if (this.state === 'dormant') {
        if (n.loudness > 0.55) this.setState('idle');
        continue;
      }

      const jitter = (1 - strength) * 2.2;
      const nx = n.x + (this.rng.next() - 0.5) * jitter;
      const nz = n.z + (this.rng.next() - 0.5) * jitter;
      const nFloor: NavFloor =
        n.y < FLOOR_Y.ground - 0.8 ? 'basement' : n.y < FLOOR_Y.upper - 0.8 ? 'ground' : 'upper';

      this.suspicion = clamp(this.suspicion + strength * 55 * this.diff.suspicion, 0, 100);

      const urgent =
        n.kind === 'glass' || n.kind === 'lure' || n.kind === 'machine' || strength > 0.5;
      if (this.state === 'chase' || this.state === 'attack') continue;
      if (this.state === 'track' && !urgent) continue;

      if (urgent || this.suspicion > 55) {
        if (this.planTo(nx, nz, nFloor, pos)) this.setState('investigate');
      } else if (
        this.suspicion > 25 &&
        (this.state === 'patrol' || this.state === 'roam' || this.state === 'idle')
      ) {
        this.faceYaw = Math.atan2(n.x - pos.x, -(n.z - pos.z));
        this.setState('listen');
        this.waitTimer = 1.2 + this.rng.next() * 1.4;
      }
    }
  }

  /* ---------------- search planning ---------------- */

  private buildSearchQueue(center: THREE.Vector3, floor: NavFloor): void {
    this.searchQueue = [];
    const room = roomAt(floor, center.x, center.z);
    // 1. The exact spot.
    this.searchQueue.push({ x: center.x, y: center.y, z: center.z, floor });
    // 2. Hiding places nearby, ordered by how often the player uses that kind.
    const spots = HIDE_SPOTS.filter(
      (h) => h.floor === floor && dist2d(h.checkFrom[0], h.checkFrom[2], center.x, center.z) < 11
    )
      .map((h) => ({
        h,
        w:
          (RT.habits.hideCounts[h.kind] ?? 0) * 2 +
          this.rng.next() -
          dist2d(h.checkFrom[0], h.checkFrom[2], center.x, center.z) * 0.08,
      }))
      .sort((a, b) => b.w - a.w)
      .slice(0, 2 + Math.round(this.aggression() * 2));
    for (const { h } of spots) {
      this.searchQueue.push({
        x: h.checkFrom[0],
        y: FLOOR_Y[h.floor],
        z: h.checkFrom[2],
        floor: navFloorOf(h.floor),
        spot: h,
      });
    }
    // 3. A couple of corners of the room they vanished in.
    if (room) {
      const [x0, z0, x1, z1] = room.rect;
      for (let i = 0; i < 2; i++) {
        this.searchQueue.push({
          x: x0 + this.rng.next() * (x1 - x0),
          y: FLOOR_Y[floor],
          z: z0 + this.rng.next() * (z1 - z0),
          floor,
        });
      }
    }
  }

  private pickRoamTarget(pos: THREE.Vector3): { x: number; z: number; floor: NavFloor } {
    // Weighted patrol: prefer rooms the player haunts (learned heat), avoid
    // the rooms just visited, occasionally drift outdoors.
    const a = this.aggression();
    if (this.rng.chance(0.14)) {
      const p = this.rng.pick(YARD_POINTS);
      return { x: p.x, z: p.z, floor: 'ground' };
    }
    let best: { x: number; z: number; floor: NavFloor; id: string } | null = null;
    let bestW = -Infinity;
    for (const room of PATROL_ROOMS) {
      let w = this.rng.next() * 2;
      w += Math.min(3, (RT.habits.roomHeat[room.id] ?? 0) * 0.015) * (0.5 + a);
      if (this.lastVisitedRooms.includes(room.id)) w -= 3;
      if (room.floor === navFloorOf(RT.player.floor)) w += a * 1.6; // pressure
      const d = dist2d(room.x, room.z, pos.x, pos.z);
      w -= d * 0.02;
      if (w > bestW) {
        bestW = w;
        best = { x: room.x, z: room.z, floor: room.floor, id: room.id };
      }
    }
    if (best) {
      this.lastVisitedRooms.push(best.id);
      if (this.lastVisitedRooms.length > 4) this.lastVisitedRooms.shift();
      return best;
    }
    return { x: 2.5, z: 0, floor: 'ground' };
  }

  /* ---------------- main tick ---------------- */

  tick(dt: number, pos: THREE.Vector3, senses: BrainSenses): BrainOutput {
    const now = performance.now() / 1000;
    this.stateTime += dt;
    this.repathTimer -= dt;
    this.faceYaw = null;

    // --- vision → suspicion / detection ---
    const vis = senses.visibility;
    if (vis > 0.01 && this.state !== 'dormant') {
      const gain = vis * 90 * this.diff.suspicion * (0.7 + this.aggression() * 0.6);
      this.suspicion = clamp(this.suspicion + gain * dt, 0, 100);
      this.mem.lastKnown = senses.playerPos.clone();
      this.mem.lastKnownFloor = navFloorOf(senses.playerFloor);
      this.mem.lastSeenAt = now;
      this.mem.playerVel
        .copy(senses.playerPos)
        .sub(this.prevPlayerPos)
        .divideScalar(Math.max(dt, 0.001));
      if (this.suspicion >= 100 && this.state !== 'chase' && this.state !== 'attack') {
        RT.habits.timesSpotted += 1;
        this.setState('chase');
      } else if (
        this.suspicion > 45 &&
        (this.state === 'patrol' ||
          this.state === 'roam' ||
          this.state === 'idle' ||
          this.state === 'listen')
      ) {
        this.faceYaw = Math.atan2(senses.playerPos.x - pos.x, -(senses.playerPos.z - pos.z));
        this.setState('suspicious');
        this.waitTimer = 0.7;
      }
    } else {
      this.suspicion = clamp(this.suspicion - dt * (this.state === 'chase' ? 2 : 7), 0, 100);
    }
    this.prevPlayerPos.copy(senses.playerPos);

    // --- hearing ---
    this.listen(pos, now);

    // --- door negotiation on the current path ---
    let doorHold = false;
    const next = this.path[this.pathIdx];
    if (next?.doorId && next.doorId !== 'secret_bookcase' && next.doorId !== 'secret_shelf') {
      const dDoor = dist2d(pos.x, pos.z, next.x, next.z);
      if (dDoor < 1.0) {
        const info = this.hooks.doorInfo(next.doorId);
        if (info.exists && !info.open && !info.broken) {
          doorHold = true;
          if (!info.locked) {
            this.hooks.requestDoor(next.doorId, 'open');
            this.waitTimer = Math.max(this.waitTimer, 0.35);
          } else if (info.breakable && (this.state === 'chase' || this.state === 'track')) {
            if (this.bangDoor !== next.doorId) {
              this.bangDoor = next.doorId;
              this.bangCount = 0;
            }
            if (this.waitTimer <= 0) {
              this.bangCount++;
              this.hooks.requestDoor(next.doorId, this.bangCount >= 3 ? 'break' : 'bang');
              this.waitTimer = 0.75;
            }
          } else {
            // Locked and not worth breaking: remember and go around.
            this.blockedDoors.set(next.doorId, now + 25);
            this.path = [];
            this.repathTimer = 0;
          }
        }
      }
    }

    // --- stuck detection ---
    if (this.path.length > 0 && !doorHold && this.waitTimer <= 0) {
      if (pos.distanceTo(this.lastPos) < 0.03 * dt * 60) this.stuckTimer += dt;
      else this.stuckTimer = 0;
      if (this.stuckTimer > 1.6) {
        this.stuckTimer = 0;
        this.path = [];
        this.repathTimer = 0;
      }
    }
    this.lastPos.copy(pos);

    // --- state logic ---
    this.waitTimer -= dt;
    const speedState = this.state;

    switch (this.state) {
      case 'dormant':
        break;

      case 'idle':
        if (this.stateTime > 2.5) this.setState(this.rng.chance(0.5) ? 'patrol' : 'roam');
        break;

      case 'listen':
        if (this.waitTimer <= 0) {
          this.setState(this.suspicion > 40 ? 'suspicious' : 'patrol');
        }
        break;

      case 'suspicious':
        if (this.waitTimer <= 0) {
          if (this.mem.lastKnown && now - this.mem.lastSeenAt < 6) {
            if (
              this.planTo(this.mem.lastKnown.x, this.mem.lastKnown.z, this.mem.lastKnownFloor, pos)
            ) {
              this.setState('investigate');
            } else {
              this.setState('roam');
            }
          } else if (this.suspicion > 20 && this.path.length > 0) {
            this.setState('investigate');
          } else {
            // nothing concrete to investigate — go back to walking the rounds
            this.setState('patrol');
          }
        }
        break;

      case 'patrol':
      case 'roam':
      case 'return':
        if (this.path.length === 0 || this.pathIdx >= this.path.length) {
          const t = this.pickRoamTarget(pos);
          if (!this.planTo(t.x, t.z, t.floor, pos)) this.path = [];
          if (this.state === 'return') this.setState('roam');
        }
        break;

      case 'investigate':
        if (this.pathIdx >= this.path.length) {
          // Arrived where the noise was: look around, then search the area.
          if (this.mem.lastKnown && now - this.mem.lastSeenAt < 10) {
            this.buildSearchQueue(this.mem.lastKnown, this.mem.lastKnownFloor);
          } else {
            this.buildSearchQueue(pos.clone(), navFloorOf(RT.enemy.floor));
          }
          this.scanTimer = 1.4;
          this.setState('search');
        }
        break;

      case 'search': {
        if (this.scanTimer > 0) {
          this.scanTimer -= dt;
          // slow sweeping gaze
          this.faceYaw = (now * 0.7) % (Math.PI * 2);
          break;
        }
        if (this.pathIdx >= this.path.length || this.path.length === 0) {
          const nextPoint = this.searchQueue.shift();
          if (!nextPoint) {
            this.setState('return');
            break;
          }
          if (nextPoint.spot) {
            const spot = nextPoint.spot;
            // If we're already close, check the hiding place.
            if (dist2d(pos.x, pos.z, nextPoint.x, nextPoint.z) < 1.4) {
              this.hooks.cue('growl');
              if (senses.playerHiddenId === spot.id) {
                this.hooks.dragOut(spot.id);
                this.suspicion = 100;
                this.setState('chase');
              }
              this.scanTimer = 1.1;
              break;
            }
          }
          if (!this.planTo(nextPoint.x, nextPoint.z, nextPoint.floor, pos)) {
            // unreachable — skip it
            break;
          }
          // Re-queue spot points so the proximity check above fires on arrival.
          if (nextPoint.spot) this.searchQueue.unshift(nextPoint);
          else this.scanTimer = 0;
        }
        // Player hid while being watched → go straight to the exact spot.
        if (senses.playerHiddenId && senses.playerHiddenSeen) {
          const spot = HIDE_SPOTS.find((h) => h.id === senses.playerHiddenId);
          if (spot) {
            this.searchQueue = [
              {
                x: spot.checkFrom[0],
                y: FLOOR_Y[spot.floor],
                z: spot.checkFrom[2],
                floor: navFloorOf(spot.floor),
                spot,
              },
            ];
          }
        }
        break;
      }

      case 'track': {
        // Heading to last known + a velocity-predicted overshoot.
        if (vis > 0.25) {
          this.setState('chase');
          break;
        }
        if (this.pathIdx >= this.path.length || this.path.length === 0) {
          if (this.mem.predicted) {
            const p = this.mem.predicted;
            this.mem.predicted = null;
            if (this.planTo(p.x, p.z, this.mem.lastKnownFloor, pos)) break;
          }
          if (this.mem.lastKnown) {
            this.buildSearchQueue(this.mem.lastKnown, this.mem.lastKnownFloor);
          }
          this.scanTimer = 0.9;
          this.setState('search');
        }
        break;
      }

      case 'chase': {
        const dPlayer = pos.distanceTo(senses.playerPos);
        if (vis > 0.02 || dPlayer < 3) {
          // Repath to the player at ~3 Hz while we can see them.
          if (this.repathTimer <= 0) {
            this.repathTimer = 0.33;
            this.planTo(
              senses.playerPos.x,
              senses.playerPos.z,
              navFloorOf(senses.playerFloor),
              pos
            );
          }
          if (dPlayer < 1.5 && this.waitTimer <= 0 && !senses.playerHiddenId) {
            this.setState('attack');
            this.waitTimer = 0.45;
          }
        } else if (now - this.mem.lastSeenAt > 2.2) {
          // Lost sight: run to last known, predict ahead along their velocity.
          if (this.mem.lastKnown) {
            const v = this.mem.playerVel;
            const speed = Math.hypot(v.x, v.z);
            this.mem.predicted =
              speed > 1
                ? this.mem.lastKnown
                    .clone()
                    .add(new THREE.Vector3(v.x, 0, v.z).normalize().multiplyScalar(4))
                : null;
            this.planTo(this.mem.lastKnown.x, this.mem.lastKnown.z, this.mem.lastKnownFloor, pos);
          }
          this.setState('track');
        }
        break;
      }

      case 'attack':
        if (this.waitTimer <= 0) {
          this.setState('chase');
          this.waitTimer = 0.9; // swing cooldown before next attack window
        }
        break;

      case 'breakdoor':
        // handled inline via door negotiation; treated as chase pause
        this.setState('chase');
        break;
    }

    // --- follow path ---
    let moveTarget: THREE.Vector3 | null = null;
    if (
      !doorHold &&
      this.waitTimer <= 0 &&
      this.scanTimer <= 0 &&
      this.pathIdx < this.path.length
    ) {
      const wp = this.path[this.pathIdx];
      const d = dist2d(pos.x, pos.z, wp.x, wp.z);
      const arrive = wp.stair ? 0.45 : 0.38;
      if (d < arrive) {
        this.pathIdx++;
        if (this.pathIdx < this.path.length) {
          const nwp = this.path[this.pathIdx];
          moveTarget = new THREE.Vector3(nwp.x, nwp.y, nwp.z);
        }
      } else {
        moveTarget = new THREE.Vector3(wp.x, wp.y, wp.z);
      }
    }

    const awareness =
      this.state === 'chase' || this.state === 'attack' || this.state === 'track'
        ? 1
        : this.state === 'search' || this.state === 'investigate'
          ? Math.max(0.55, this.suspicion / 100)
          : this.suspicion / 100;

    return {
      state: this.state,
      moveTarget,
      speed: this.speedFor(speedState),
      faceYaw: this.faceYaw,
      attack: this.state === 'attack' && this.stateTime < 0.05,
      awareness: clamp01(awareness),
    };
  }

  /** Force the Keeper awake (grace timer, scripted loud events). */
  wake(): void {
    if (this.state === 'dormant') this.setState('idle');
  }
}
