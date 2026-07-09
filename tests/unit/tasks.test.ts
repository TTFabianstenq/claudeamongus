import { describe, expect, it } from "vitest";
import { ServerPlayer } from "@/server/engine/ServerPlayer";
import { TaskService } from "@/server/engine/TaskService";
import { HELION, consoleById } from "@/shared/map/helion";
import { DEFAULT_SETTINGS } from "@/shared/types";

function makePlayer(id: string, role: "crewmate" | "impostor" = "crewmate"): ServerPlayer {
  const p = new ServerPlayer({
    id,
    resumeToken: "t",
    socketId: "s",
    userId: null,
    name: id,
    color: "red",
    hat: "none",
  });
  p.role = role;
  return p;
}

function moveTo(player: ServerPlayer, consoleId: string): void {
  const c = consoleById(HELION, consoleId)!;
  player.x = c.x;
  player.y = c.y;
}

describe("TaskService", () => {
  it("assigns the configured number of tasks per player", () => {
    const service = new TaskService(HELION);
    const players = [makePlayer("a"), makePlayer("b")];
    service.assign(players, { ...DEFAULT_SETTINGS, commonTasks: 1, shortTasks: 3, longTasks: 2 });
    for (const p of players) {
      expect(p.tasks).toHaveLength(6);
      expect(p.tasks.filter((t) => t.length === "common")).toHaveLength(1);
      expect(p.tasks.filter((t) => t.length === "short")).toHaveLength(3);
      expect(p.tasks.filter((t) => t.length === "long")).toHaveLength(2);
    }
    // common tasks are shared
    const commonA = players[0]!.tasks.find((t) => t.length === "common")!;
    const commonB = players[1]!.tasks.find((t) => t.length === "common")!;
    expect(commonA.id).toBe(commonB.id);
  });

  it("rejects opening a console from too far away", () => {
    const service = new TaskService(HELION);
    const player = makePlayer("a");
    service.assign([player], DEFAULT_SETTINGS);
    const task = player.tasks[0]!;
    player.x = 0;
    player.y = 0;
    const result = service.open(player, task.id, Date.now());
    expect(result.ok).toBe(false);
  });

  it("rejects completion that happens faster than the minigame minimum", () => {
    const service = new TaskService(HELION);
    const player = makePlayer("a");
    service.assign([player], DEFAULT_SETTINGS);
    const task = player.tasks[0]!;
    moveTo(player, task.consoleIds[0]!);
    const t0 = Date.now();
    expect(service.open(player, task.id, t0).ok).toBe(true);
    const early = service.complete(player, task.id, t0 + 50, false);
    expect(early.ok).toBe(false);
    expect(task.done).toBe(false);
  });

  it("completes stages in order and finishes multi-console tasks", () => {
    const service = new TaskService(HELION);
    const player = makePlayer("a");
    // deterministic: give the player the garbage task (2 consoles) directly
    player.tasks = [
      {
        id: "task-garbage",
        kind: "garbage",
        length: "short",
        visual: true,
        consoleIds: ["garbage-cafeteria", "garbage-storage"],
        stage: 0,
        done: false,
      },
    ];
    let now = 1_000_000;
    moveTo(player, "garbage-cafeteria");
    expect(service.open(player, "task-garbage", now).ok).toBe(true);
    now += 5_000;
    const first = service.complete(player, "task-garbage", now, false);
    expect(first.ok).toBe(true);
    expect(player.tasks[0]!.stage).toBe(1);
    expect(player.tasks[0]!.done).toBe(false);
    // wrong console (still at cafeteria, stage now expects storage)
    expect(service.open(player, "task-garbage", now).ok).toBe(false);
    moveTo(player, "garbage-storage");
    expect(service.open(player, "task-garbage", now).ok).toBe(true);
    now += 5_000;
    const second = service.complete(player, "task-garbage", now, false);
    expect(second.ok).toBe(true);
    expect(player.tasks[0]!.done).toBe(true);
    // visual task fires the broadcast payload
    expect(second.ok && second.visual).toEqual({ kind: "garbage", playerId: "a" });
  });

  it("blocks completion while comms are sabotaged", () => {
    const service = new TaskService(HELION);
    const player = makePlayer("a");
    player.tasks = [
      {
        id: "task-swipe",
        kind: "cardSwipe",
        length: "common",
        visual: false,
        consoleIds: ["swipe-admin"],
        stage: 0,
        done: false,
      },
    ];
    moveTo(player, "swipe-admin");
    const t0 = Date.now();
    service.open(player, "task-swipe", t0);
    const blocked = service.complete(player, "task-swipe", t0 + 5000, true);
    expect(blocked.ok).toBe(false);
  });

  it("impostor fake tasks never count toward crew progress", () => {
    const service = new TaskService(HELION);
    const crew = makePlayer("crew");
    const impostor = makePlayer("bad", "impostor");
    service.assign([crew, impostor], {
      ...DEFAULT_SETTINGS,
      commonTasks: 0,
      shortTasks: 1,
      longTasks: 0,
    });
    const task = impostor.tasks[0]!;
    moveTo(impostor, task.consoleIds[0]!);
    const t0 = Date.now();
    service.open(impostor, task.id, t0);
    const result = service.complete(impostor, task.id, t0 + 60_000, false);
    expect(result.ok).toBe(true);
    // visual suppressed for impostors, progress unchanged
    expect(result.ok && result.visual).toBeNull();
    expect(service.progress([crew, impostor])).toBe(0);
    expect(service.allCrewTasksDone([crew, impostor])).toBe(false);
  });

  it("cancels an open minigame when the player walks away", () => {
    const service = new TaskService(HELION);
    const player = makePlayer("a");
    player.tasks = [
      {
        id: "task-swipe",
        kind: "cardSwipe",
        length: "common",
        visual: false,
        consoleIds: ["swipe-admin"],
        stage: 0,
        done: false,
      },
    ];
    moveTo(player, "swipe-admin");
    service.open(player, "task-swipe", Date.now());
    expect(player.openTask).not.toBeNull();
    player.x += 200;
    service.cancelIfMoved(player);
    expect(player.openTask).toBeNull();
  });
});
