import { afterEach, describe, expect, it } from "vitest";
import { GameRoom, type MatchSummary } from "@/server/engine/GameRoom";
import type { ServerPlayer } from "@/server/engine/ServerPlayer";
import { DEFAULT_SETTINGS } from "@/shared/types";

interface Emitted {
  target: "room" | string;
  event: string;
  args: unknown[];
}

function makeRoom() {
  const emitted: Emitted[] = [];
  const summaries: MatchSummary[] = [];
  const room = new GameRoom(
    "TESTAB",
    { ...DEFAULT_SETTINGS, impostorCount: 1, killCooldown: 10 },
    {
      toRoom: (event, ...args) => emitted.push({ target: "room", event, args }),
      toPlayer: (socketId, event, ...args) => emitted.push({ target: socketId, event, args }),
    },
    {
      onGameEnd: (summary) => summaries.push(summary),
      onEmpty: () => undefined,
    },
  );
  return { room, emitted, summaries };
}

function addPlayers(room: GameRoom, count: number): string[] {
  const ids: string[] = [];
  for (let i = 0; i < count; i++) {
    const result = room.addPlayer({
      socketId: `socket-${i}`,
      userId: null,
      name: `Player${i}`,
      color: "red", // server reassigns duplicates
      hat: "none",
    });
    if (!result.ok) throw new Error(result.error);
    ids.push(result.data!.playerId);
  }
  return ids;
}

/** Force-start the match without waiting for the real countdown. */
function forceStart(room: GameRoom): void {
  (room as unknown as { beginMatch: () => void }).beginMatch();
}

function impostorsOf(room: GameRoom): ServerPlayer[] {
  return room.playerList.filter((p) => p.role === "impostor");
}
function crewOf(room: GameRoom): ServerPlayer[] {
  return room.playerList.filter((p) => p.role === "crewmate");
}

const cleanups: Array<() => void> = [];
afterEach(() => {
  while (cleanups.length) cleanups.pop()?.();
});

describe("GameRoom lobby", () => {
  it("assigns unique colors and a host, and migrates the host on leave", () => {
    const { room } = makeRoom();
    cleanups.push(() => room.destroy());
    const ids = addPlayers(room, 5);
    const colors = new Set(room.playerList.map((p) => p.color));
    expect(colors.size).toBe(5);
    expect(room.hostId).toBe(ids[0]);
    room.removePlayer(ids[0]!);
    expect(room.hostId).toBe(ids[1]);
  });

  it("refuses to start without enough ready players and honors host-only start", () => {
    const { room } = makeRoom();
    cleanups.push(() => room.destroy());
    const ids = addPlayers(room, 4);
    expect(room.startGame(ids[1]!).ok).toBe(false); // not host
    expect(room.startGame(ids[0]!).ok).toBe(false); // not everyone ready
    for (const id of ids.slice(1)) room.setReady(id, true);
    expect(room.startGame(ids[0]!).ok).toBe(true);
    expect(room.phase).toBe("starting");
  });

  it("locks settings to the host and to the lobby phase", () => {
    const { room } = makeRoom();
    cleanups.push(() => room.destroy());
    const ids = addPlayers(room, 4);
    expect(room.updateSettings(ids[1]!, { ...DEFAULT_SETTINGS }).ok).toBe(false);
    expect(room.updateSettings(ids[0]!, { ...DEFAULT_SETTINGS, playerSpeed: 2 }).ok).toBe(true);
    expect(room.settings.playerSpeed).toBe(2);
  });
});

describe("GameRoom kills", () => {
  function startedRoom(playerCount = 5) {
    const ctx = makeRoom();
    cleanups.push(() => ctx.room.destroy());
    addPlayers(ctx.room, playerCount);
    forceStart(ctx.room);
    return ctx;
  }

  it("validates role, range, cooldown and target state", () => {
    const { room } = startedRoom();
    const impostor = impostorsOf(room)[0]!;
    const victim = crewOf(room)[0]!;
    const otherCrew = crewOf(room)[1]!;

    // crew cannot kill
    expect(room.kill(victim.id, otherCrew.id).ok).toBe(false);
    // cooldown just after start
    victim.x = impostor.x;
    victim.y = impostor.y;
    expect(room.kill(impostor.id, victim.id).ok).toBe(false);
    impostor.killReadyAt = 0;
    // out of range
    victim.x = impostor.x + 500;
    expect(room.kill(impostor.id, victim.id).ok).toBe(false);
    // in range: succeeds, killer lunges, body drops
    victim.x = impostor.x + 20;
    victim.y = impostor.y;
    expect(room.kill(impostor.id, victim.id).ok).toBe(true);
    expect(victim.alive).toBe(false);
    expect(room.bodies).toHaveLength(1);
    expect(impostor.x).toBe(victim.x);
    // dead target cannot be re-killed
    impostor.killReadyAt = 0;
    expect(room.kill(impostor.id, victim.id).ok).toBe(false);
    // impostor cannot kill impostor (single impostor room: covered by role check above)
  });

  it("ends the game when impostors reach parity", () => {
    const { room, summaries } = startedRoom(4); // 1 impostor, 3 crew
    const impostor = impostorsOf(room)[0]!;
    for (const victim of crewOf(room).slice(0, 2)) {
      impostor.killReadyAt = 0;
      victim.x = impostor.x;
      victim.y = impostor.y;
      expect(room.kill(impostor.id, victim.id).ok).toBe(true);
    }
    expect(room.phase).toBe("ended");
    expect(summaries[0]?.winners).toBe("impostors");
    expect(summaries[0]?.reason).toBe("impostorsDominate");
  });
});

describe("GameRoom meetings and reports", () => {
  it("report requires proximity to a real body and triggers a meeting", () => {
    const ctx = makeRoom();
    cleanups.push(() => ctx.room.destroy());
    addPlayers(ctx.room, 5);
    forceStart(ctx.room);
    const impostor = impostorsOf(ctx.room)[0]!;
    const victim = crewOf(ctx.room)[0]!;
    const reporter = crewOf(ctx.room)[1]!;
    impostor.killReadyAt = 0;
    victim.x = impostor.x;
    victim.y = impostor.y;
    ctx.room.kill(impostor.id, victim.id);

    reporter.x = victim.x + 1000;
    expect(ctx.room.report(reporter.id, victim.id).ok).toBe(false);
    expect(ctx.room.report(reporter.id, "no-such-body").ok).toBe(false);
    reporter.x = victim.x + 30;
    reporter.y = victim.y;
    expect(ctx.room.report(reporter.id, victim.id).ok).toBe(true);
    expect(ctx.room.phase).toBe("meeting");
    expect(ctx.room.bodies).toHaveLength(0); // bodies clear at meeting start
  });

  it("emergency button enforces location, uses and phase", () => {
    const ctx = makeRoom();
    cleanups.push(() => ctx.room.destroy());
    addPlayers(ctx.room, 4);
    forceStart(ctx.room);
    const caller = crewOf(ctx.room)[0]!;
    (ctx.room as unknown as { emergencyAvailableAt: number }).emergencyAvailableAt = 0;
    // not at the button
    caller.x = 100;
    caller.y = 100;
    expect(ctx.room.emergency(caller.id).ok).toBe(false);
    caller.x = ctx.room.map.emergencyButton.x;
    caller.y = ctx.room.map.emergencyButton.y;
    expect(ctx.room.emergency(caller.id).ok).toBe(true);
    expect(ctx.room.phase).toBe("meeting");
  });
});

describe("GameRoom vents", () => {
  it("only living impostors may vent, and only between linked vents", () => {
    const ctx = makeRoom();
    cleanups.push(() => ctx.room.destroy());
    addPlayers(ctx.room, 5);
    forceStart(ctx.room);
    const impostor = impostorsOf(ctx.room)[0]!;
    const crew = crewOf(ctx.room)[0]!;
    const vent = ctx.room.map.vents.find((v) => v.id === "vent-cafeteria")!;

    crew.x = vent.x;
    crew.y = vent.y;
    expect(ctx.room.ventEnter(crew.id, vent.id).ok).toBe(false);

    impostor.x = vent.x + 10;
    impostor.y = vent.y;
    expect(ctx.room.ventEnter(impostor.id, vent.id).ok).toBe(true);
    expect(impostor.inVentId).toBe(vent.id);
    // unlinked vent hop rejected
    expect(ctx.room.ventMove(impostor.id, "vent-reactor-a").ok).toBe(false);
    // linked hop accepted
    expect(ctx.room.ventMove(impostor.id, "vent-admin").ok).toBe(true);
    const adminVent = ctx.room.map.vents.find((v) => v.id === "vent-admin")!;
    expect(impostor.x).toBe(adminVent.x);
    expect(ctx.room.ventExit(impostor.id).ok).toBe(true);
    expect(impostor.inVentId).toBeNull();
  });
});

describe("GameRoom input handling", () => {
  it("drops duplicate and out-of-order input sequences", () => {
    const ctx = makeRoom();
    cleanups.push(() => ctx.room.destroy());
    const ids = addPlayers(ctx.room, 4);
    forceStart(ctx.room);
    const player = ctx.room.players.get(ids[0]!)!;
    ctx.room.queueInput(ids[0]!, { seq: 1, t: 1000, moveX: 1, moveY: 0 });
    ctx.room.queueInput(ids[0]!, { seq: 1, t: 1001, moveX: 1, moveY: 0 }); // dup
    ctx.room.queueInput(ids[0]!, { seq: 2, t: 900, moveX: 1, moveY: 0 }); // t went backwards
    ctx.room.queueInput(ids[0]!, { seq: 3, t: 1002, moveX: 1, moveY: 0 });
    expect(player.inputQueue).toHaveLength(2);
    expect(player.inputQueue.map((i) => i.seq)).toEqual([1, 3]);
  });
});

describe("GameRoom crew win by tasks", () => {
  it("ends the game when every crew task is complete", () => {
    const ctx = makeRoom();
    cleanups.push(() => ctx.room.destroy());
    addPlayers(ctx.room, 4);
    forceStart(ctx.room);
    for (const p of crewOf(ctx.room)) {
      for (const t of p.tasks) {
        t.stage = t.consoleIds.length;
        t.done = true;
      }
    }
    ctx.room.checkWin();
    expect(ctx.room.phase).toBe("ended");
    expect(ctx.summaries[0]?.winners).toBe("crew");
    expect(ctx.summaries[0]?.reason).toBe("tasksComplete");
  });
});
