import {
  DOOR_CLOSE_SECONDS,
  DOOR_SABOTAGE_COOLDOWN_SECONDS,
  O2_DEPLETION_SECONDS,
  REACTOR_MELTDOWN_SECONDS,
  SABOTAGE_COOLDOWN_SECONDS,
  USE_RADIUS,
} from "@/shared/constants";
import { consoleById, type MapDef } from "@/shared/map/helion";
import type { CollisionGrid } from "@/shared/physics";
import { dist } from "@/shared/physics";
import type { ActiveSabotage, DoorState, SabotageKind } from "@/shared/types";
import type { ServerPlayer } from "./ServerPlayer";

export type SabotageResult = { ok: true } | { ok: false; error: string };

/**
 * Owns non-door sabotages (lights / reactor / o2 / comms) and door closures.
 * Critical sabotages carry a deadline; if it expires the impostors win —
 * the GameRoom polls `meltdownExpired()` each tick.
 */
export class SabotageService {
  active: ActiveSabotage | null = null;
  doors: DoorState[] = [];
  private sabotageReadyAt = 0;
  private doorReadyAt = new Map<string, number>();
  /** playerIds currently holding each reactor pad */
  private reactorHolders = new Map<string, Set<string>>();
  private doorCells = new Map<string, number[]>();

  constructor(
    private readonly map: MapDef,
    private readonly grid: CollisionGrid,
  ) {
    this.doors = map.doors.map((d) => ({ id: d.id, closedUntil: 0 }));
    for (const d of map.doors) {
      this.doorCells.set(d.id, grid.cellsForRect(d.rect));
    }
  }

  resetCooldowns(now: number): void {
    this.sabotageReadyAt = now + 10_000;
    this.doorReadyAt.clear();
  }

  clearAll(now: number): void {
    this.active = null;
    this.reactorHolders.clear();
    for (const door of this.doors) {
      if (door.closedUntil > now) this.openDoor(door.id);
    }
  }

  get commsDown(): boolean {
    return this.active?.kind === "comms";
  }

  get lightsOut(): boolean {
    return this.active?.kind === "lights";
  }

  get criticalActive(): boolean {
    return this.active?.kind === "reactor" || this.active?.kind === "o2";
  }

  trigger(kind: Exclude<SabotageKind, "doors">, now: number): SabotageResult {
    if (this.active) return { ok: false, error: "A sabotage is already active" };
    if (now < this.sabotageReadyAt) return { ok: false, error: "Sabotage on cooldown" };
    const deadline =
      kind === "reactor"
        ? now + REACTOR_MELTDOWN_SECONDS * 1000
        : kind === "o2"
          ? now + O2_DEPLETION_SECONDS * 1000
          : null;
    const fixed: Record<string, boolean> = {};
    if (kind === "reactor") {
      fixed["fix-reactor-a"] = false;
      fixed["fix-reactor-b"] = false;
      this.reactorHolders.set("fix-reactor-a", new Set());
      this.reactorHolders.set("fix-reactor-b", new Set());
    } else if (kind === "o2") {
      fixed["fix-o2-a"] = false;
      fixed["fix-o2-b"] = false;
    }
    this.active = { kind, deadline, fixed };
    this.sabotageReadyAt = now + SABOTAGE_COOLDOWN_SECONDS * 1000;
    return { ok: true };
  }

  closeDoors(roomId: string, now: number): SabotageResult {
    const room = this.map.rooms.find((r) => r.id === roomId);
    if (!room || !room.sealable) return { ok: false, error: "Room has no sealable doors" };
    const ready = this.doorReadyAt.get(roomId) ?? 0;
    if (now < ready) return { ok: false, error: "Doors on cooldown" };
    const roomDoors = this.map.doors.filter((d) => d.roomId === roomId);
    if (roomDoors.length === 0) return { ok: false, error: "Room has no doors" };
    const until = now + DOOR_CLOSE_SECONDS * 1000;
    for (const d of roomDoors) {
      const state = this.doors.find((s) => s.id === d.id);
      if (state && state.closedUntil <= now) {
        state.closedUntil = until;
        this.grid.setBlocked(this.doorCells.get(d.id) ?? [], true);
      }
    }
    this.doorReadyAt.set(
      roomId,
      now + (DOOR_CLOSE_SECONDS + DOOR_SABOTAGE_COOLDOWN_SECONDS) * 1000,
    );
    return { ok: true };
  }

  closedDoorIds(roomId: string, now: number): string[] {
    return this.map.doors
      .filter((d) => d.roomId === roomId)
      .map((d) => d.id)
      .filter((id) => (this.doors.find((s) => s.id === id)?.closedUntil ?? 0) > now);
  }

  private openDoor(id: string): void {
    const state = this.doors.find((s) => s.id === id);
    if (!state) return;
    state.closedUntil = 0;
    this.grid.setBlocked(this.doorCells.get(id) ?? [], false);
  }

  /** Reopens any expired doors; returns true if a door changed state. */
  tickDoors(now: number): boolean {
    let changed = false;
    for (const door of this.doors) {
      if (door.closedUntil !== 0 && door.closedUntil <= now) {
        this.openDoor(door.id);
        changed = true;
      }
    }
    return changed;
  }

  meltdownExpired(now: number): boolean {
    return (
      this.active !== null && this.active.deadline !== null && now >= this.active.deadline
    );
  }

  /**
   * One-shot fixes: light panel, o2 keypads, comms retune.
   * Returns "fixed" when the whole sabotage clears.
   */
  fix(player: ServerPlayer, kind: string, panelId: string): SabotageResult & { cleared?: boolean } {
    if (!this.active || this.active.kind !== kind) {
      return { ok: false, error: "That system is not sabotaged" };
    }
    const panel = consoleById(this.map, panelId);
    if (!panel || panel.kind !== kind) return { ok: false, error: "Unknown panel" };
    if (dist(player.x, player.y, panel.x, panel.y) > USE_RADIUS) {
      return { ok: false, error: "Too far from panel" };
    }
    if (kind === "reactor") return { ok: false, error: "Reactor pads must be held" };

    if (kind === "lights" || kind === "comms") {
      this.active = null;
      player.stats.sabotagesFixed += 1;
      return { ok: true, cleared: true };
    }
    // o2: each keypad completes once; both clear it
    if (this.active.fixed[panelId]) return { ok: false, error: "Keypad already entered" };
    this.active.fixed[panelId] = true;
    player.stats.sabotagesFixed += 1;
    if (Object.values(this.active.fixed).every(Boolean)) {
      this.active = null;
      return { ok: true, cleared: true };
    }
    return { ok: true, cleared: false };
  }

  /** Reactor pads: held simultaneously by (possibly the same? no — two) players. */
  holdReactor(player: ServerPlayer, panelId: string, on: boolean): { cleared: boolean } {
    if (!this.active || this.active.kind !== "reactor") return { cleared: false };
    const panel = consoleById(this.map, panelId);
    if (!panel || panel.kind !== "reactor") return { cleared: false };
    if (on && dist(player.x, player.y, panel.x, panel.y) > USE_RADIUS) return { cleared: false };
    const holders = this.reactorHolders.get(panelId);
    if (!holders) return { cleared: false };
    if (on) holders.add(player.id);
    else holders.delete(player.id);
    this.active.fixed[panelId] = holders.size > 0;

    const allHeld = ["fix-reactor-a", "fix-reactor-b"].every(
      (id) => (this.reactorHolders.get(id)?.size ?? 0) > 0,
    );
    if (allHeld) {
      player.stats.sabotagesFixed += 1;
      this.active = null;
      this.reactorHolders.clear();
      return { cleared: true };
    }
    return { cleared: false };
  }

  /** Drops any reactor holds from a player (disconnect / death / movement). */
  releaseHolds(playerId: string): void {
    for (const holders of this.reactorHolders.values()) holders.delete(playerId);
    if (this.active?.kind === "reactor") {
      for (const id of ["fix-reactor-a", "fix-reactor-b"]) {
        this.active.fixed[id] = (this.reactorHolders.get(id)?.size ?? 0) > 0;
      }
    }
  }
}
