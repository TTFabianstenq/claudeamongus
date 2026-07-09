import { beforeEach, describe, expect, it } from "vitest";
import { SabotageService } from "@/server/engine/SabotageService";
import { ServerPlayer } from "@/server/engine/ServerPlayer";
import {
  DOOR_CLOSE_SECONDS,
  REACTOR_MELTDOWN_SECONDS,
  SABOTAGE_COOLDOWN_SECONDS,
} from "@/shared/constants";
import { HELION, allFloors, consoleById } from "@/shared/map/helion";
import { CollisionGrid } from "@/shared/physics";

function makePlayer(id: string): ServerPlayer {
  return new ServerPlayer({
    id,
    resumeToken: "t",
    socketId: "s",
    userId: null,
    name: id,
    color: "red",
    hat: "none",
  });
}

function atPanel(player: ServerPlayer, panelId: string): void {
  const c = consoleById(HELION, panelId)!;
  player.x = c.x;
  player.y = c.y;
}

describe("SabotageService", () => {
  let grid: CollisionGrid;
  let service: SabotageService;
  const t0 = 10_000_000;

  beforeEach(() => {
    grid = new CollisionGrid(HELION.width, HELION.height, HELION.cell, allFloors(HELION));
    service = new SabotageService(HELION, grid);
  });

  it("enforces the global sabotage cooldown and one-at-a-time", () => {
    expect(service.trigger("lights", t0).ok).toBe(true);
    expect(service.trigger("comms", t0 + 1000).ok).toBe(false); // one active
    const player = makePlayer("fixer");
    atPanel(player, "fix-lights");
    expect(service.fix(player, "lights", "fix-lights").ok).toBe(true);
    // still cooling down
    expect(service.trigger("comms", t0 + 2000).ok).toBe(false);
    expect(service.trigger("comms", t0 + SABOTAGE_COOLDOWN_SECONDS * 1000 + 1).ok).toBe(true);
  });

  it("reactor melts down when the deadline passes", () => {
    service.trigger("reactor", t0);
    expect(service.meltdownExpired(t0 + 1000)).toBe(false);
    expect(service.meltdownExpired(t0 + REACTOR_MELTDOWN_SECONDS * 1000 + 1)).toBe(true);
  });

  it("reactor clears only when both pads are held simultaneously", () => {
    service.trigger("reactor", t0);
    const a = makePlayer("a");
    const b = makePlayer("b");
    atPanel(a, "fix-reactor-a");
    atPanel(b, "fix-reactor-b");
    expect(service.holdReactor(a, "fix-reactor-a", true).cleared).toBe(false);
    // a releases, b holds -> still not cleared
    service.releaseHolds(a.id);
    expect(service.holdReactor(b, "fix-reactor-b", true).cleared).toBe(false);
    // both held -> cleared
    expect(service.holdReactor(a, "fix-reactor-a", true).cleared).toBe(true);
    expect(service.active).toBeNull();
  });

  it("rejects reactor holds from out of range", () => {
    service.trigger("reactor", t0);
    const far = makePlayer("far");
    far.x = 2000;
    far.y = 1000;
    service.holdReactor(far, "fix-reactor-a", true);
    expect(service.active?.fixed["fix-reactor-a"]).toBe(false);
  });

  it("o2 requires both keypads, each exactly once", () => {
    service.trigger("o2", t0);
    const player = makePlayer("a");
    atPanel(player, "fix-o2-a");
    const first = service.fix(player, "o2", "fix-o2-a");
    expect(first.ok).toBe(true);
    expect(first.cleared).toBe(false);
    // same keypad again is rejected
    expect(service.fix(player, "o2", "fix-o2-a").ok).toBe(false);
    atPanel(player, "fix-o2-b");
    const second = service.fix(player, "o2", "fix-o2-b");
    expect(second.ok).toBe(true);
    expect(second.cleared).toBe(true);
    expect(service.active).toBeNull();
  });

  it("rejects fixes from too far away and for un-sabotaged systems", () => {
    const player = makePlayer("a");
    atPanel(player, "fix-comms");
    expect(service.fix(player, "comms", "fix-comms").ok).toBe(false); // nothing active
    service.trigger("comms", t0);
    player.x = 0;
    player.y = 0;
    expect(service.fix(player, "comms", "fix-comms").ok).toBe(false); // too far
    atPanel(player, "fix-comms");
    expect(service.fix(player, "comms", "fix-comms").ok).toBe(true);
  });

  it("closes and auto-reopens doors, blocking the grid meanwhile", () => {
    const door = HELION.doors.find((d) => d.roomId === "cafeteria")!;
    const inside = { x: door.rect.x + door.rect.w / 2, y: door.rect.y + door.rect.h / 2 };
    expect(grid.circleFits(inside.x, inside.y, 10)).toBe(true);
    expect(service.closeDoors("cafeteria", t0).ok).toBe(true);
    expect(grid.circleFits(inside.x, inside.y, 10)).toBe(false);
    // per-room cooldown
    expect(service.closeDoors("cafeteria", t0 + 1000).ok).toBe(false);
    // reopens after the timer
    service.tickDoors(t0 + DOOR_CLOSE_SECONDS * 1000 + 1);
    expect(grid.circleFits(inside.x, inside.y, 10)).toBe(true);
  });

  it("rejects door sabotage for non-sealable rooms", () => {
    expect(service.closeDoors("reactor", t0).ok).toBe(false);
    expect(service.closeDoors("nowhere", t0).ok).toBe(false);
  });
});
