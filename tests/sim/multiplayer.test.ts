import { createServer, type Server as HttpServer } from "node:http";
import { io as ioc, type Socket as ClientSocket } from "socket.io-client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { SocketGateway } from "@/server/net/SocketGateway";
import type { MatchSummary } from "@/server/engine/GameRoom";
import { signSocketToken } from "@/server/auth/socketToken";
import { BASE_MOVE_SPEED } from "@/shared/constants";
import type { GameSnapshot, GameStartPayload, GameEvent, LobbyState } from "@/shared/types";
import type { Ack } from "@/shared/protocol";

process.env.AUTH_SECRET = "test-secret-for-simulation-tests";

/**
 * End-to-end multiplayer simulation over real websockets: four clients
 * join a room, play a match (movement, kill, report, meeting, votes) and
 * the anti-cheat rejects spoofed packets along the way.
 */

let http: HttpServer;
let gateway: SocketGateway;
let port = 0;
const persisted: MatchSummary[] = [];

interface TestClient {
  socket: ClientSocket;
  playerId: string;
  resumeToken: string;
  started: GameStartPayload | null;
  snapshots: GameSnapshot[];
  events: GameEvent[];
  lobby: LobbyState | null;
}

const clients: TestClient[] = [];

function emitAck<T>(socket: ClientSocket, event: string, ...args: unknown[]): Promise<Ack<T>> {
  return new Promise((resolve) => {
    socket.emit(event, ...args, (res: Ack<T>) => resolve(res));
  });
}

async function connectClient(name: string): Promise<TestClient> {
  const token = await signSocketToken({ sub: `guest:${name}`, name, guest: true });
  const socket = ioc(`http://127.0.0.1:${port}`, {
    path: "/socket",
    transports: ["websocket"],
    auth: { token },
    reconnection: false,
  });
  const client: TestClient = {
    socket,
    playerId: "",
    resumeToken: "",
    started: null,
    snapshots: [],
    events: [],
    lobby: null,
  };
  socket.on("game:started", (payload: GameStartPayload) => {
    client.started = payload;
  });
  socket.on("game:snapshot", (snapshot: GameSnapshot) => {
    client.snapshots.push(snapshot);
    if (client.snapshots.length > 100) client.snapshots.shift();
  });
  socket.on("game:event", (event: GameEvent) => {
    client.events.push(event);
  });
  socket.on("room:state", (state: LobbyState) => {
    client.lobby = state;
  });
  await new Promise<void>((resolve, reject) => {
    socket.once("connect", () => resolve());
    socket.once("connect_error", (err) => reject(err));
  });
  clients.push(client);
  return client;
}

function waitFor<T>(probe: () => T | null | undefined | false, timeoutMs = 8000): Promise<T> {
  return new Promise((resolve, reject) => {
    const started = Date.now();
    const timer = setInterval(() => {
      const value = probe();
      if (value) {
        clearInterval(timer);
        resolve(value);
      } else if (Date.now() - started > timeoutMs) {
        clearInterval(timer);
        reject(new Error("waitFor timed out"));
      }
    }, 25);
  });
}

beforeAll(async () => {
  http = createServer();
  gateway = new SocketGateway(http, {
    persistMatch: async (summary) => {
      persisted.push(summary);
    },
  });
  await new Promise<void>((resolve) => http.listen(0, "127.0.0.1", resolve));
  const address = http.address();
  if (typeof address === "object" && address) port = address.port;
});

afterAll(async () => {
  for (const c of clients) c.socket.disconnect();
  await gateway.close();
  await new Promise<void>((resolve) => http.close(() => resolve()));
});

describe("multiplayer simulation", () => {
  it("rejects sockets without a valid token", async () => {
    const socket = ioc(`http://127.0.0.1:${port}`, {
      path: "/socket",
      transports: ["websocket"],
      auth: { token: "forged-token" },
      reconnection: false,
    });
    const error = await new Promise<Error>((resolve) => {
      socket.once("connect_error", (err) => resolve(err));
    });
    expect(error.message).toMatch(/invalid/i);
    socket.disconnect();
  });

  it("plays a full match: lobby, start, movement, anti-cheat, kill, meeting, vote", async () => {
    const [alice, bob, carol, dave] = await Promise.all([
      connectClient("Alice"),
      connectClient("Bob"),
      connectClient("Carol"),
      connectClient("Dave"),
    ]);

    // --- lobby -----------------------------------------------------------
    const created = await emitAck<{ code: string; playerId: string; resumeToken: string }>(
      alice!.socket,
      "room:create",
      { name: "Alice", color: "red", hat: "none", isPublic: true },
    );
    expect(created.ok).toBe(true);
    const code = created.data!.code;
    alice!.playerId = created.data!.playerId;
    alice!.resumeToken = created.data!.resumeToken;
    expect(code).toMatch(/^[A-Z]{6}$/);

    for (const [client, name] of [
      [bob, "Bob"],
      [carol, "Carol"],
      [dave, "Dave"],
    ] as const) {
      const joined = await emitAck<{ code: string; playerId: string; resumeToken: string }>(
        client!.socket,
        "room:join",
        { name, color: "blue", hat: "none", code },
      );
      expect(joined.ok).toBe(true);
      client!.playerId = joined.data!.playerId;
      client!.resumeToken = joined.data!.resumeToken;
    }

    // duplicate colors were resolved by the server
    const lobby = await waitFor(() =>
      alice!.lobby && alice!.lobby.players.length === 4 ? alice!.lobby : null,
    );
    expect(new Set(lobby.players.map((p) => p.color)).size).toBe(4);

    // the public room browser lists it
    const listed = await emitAck<{ rooms: Array<{ code: string }> }>(alice!.socket, "room:list");
    expect(listed.data!.rooms.some((r) => r.code === code)).toBe(true);

    // malformed packet is rejected without crashing the server
    const bad = await emitAck(alice!.socket, "lobby:settings", { hacked: true });
    expect(bad.ok).toBe(false);

    // --- start -----------------------------------------------------------
    for (const c of [bob, carol, dave]) c!.socket.emit("lobby:ready", { ready: true });
    await waitFor(() => (alice!.lobby?.players.filter((p) => p.ready).length === 3 ? true : null));
    const started = await emitAck(alice!.socket, "lobby:start");
    expect(started.ok).toBe(true);

    // skip the human-friendly countdown
    const room = gateway.rooms.get(code)!;
    (room as unknown as { countdownEndsAt: number }).countdownEndsAt = Date.now() - 1;

    await waitFor(() => (clients.every((c) => c.started) ? true : null));
    const impostors = clients.filter((c) => c.started!.role === "impostor");
    const crew = clients.filter((c) => c.started!.role === "crewmate");
    expect(impostors).toHaveLength(1); // 4 players -> capped at 1 impostor
    expect(crew).toHaveLength(3);
    // crew never receives mate ids
    for (const c of crew) expect(c.started!.mates).toEqual([]);

    // --- movement + anti-cheat -------------------------------------------
    const mover = crew[0]!;
    const moverPlayer = room.players.get(mover.playerId)!;
    const startX = moverPlayer.x;

    // teleport attempt: out-of-range move vector fails schema validation
    mover.socket.emit("game:input", { seq: 1, t: Date.now(), moveX: 9999, moveY: 0 });
    // legit movement: one second of inputs to the right
    for (let i = 2; i < 32; i++) {
      mover.socket.emit("game:input", { seq: i, t: Date.now() + i, moveX: 1, moveY: 0 });
    }
    await waitFor(() => (room.players.get(mover.playerId)!.x > startX ? true : null));
    await new Promise((r) => setTimeout(r, 300));
    const travelled = room.players.get(mover.playerId)!.x - startX;
    // 30 inputs at tick dt = exactly 1 simulated second of max speed (plus wall clipping)
    expect(travelled).toBeGreaterThan(0);
    expect(travelled).toBeLessThanOrEqual(BASE_MOVE_SPEED * room.settings.playerSpeed * 1.05);

    // replayed sequence numbers are ignored
    const beforeReplay = room.players.get(mover.playerId)!.x;
    for (let i = 0; i < 20; i++) {
      mover.socket.emit("game:input", { seq: 5, t: Date.now(), moveX: 1, moveY: 0 });
    }
    await new Promise((r) => setTimeout(r, 250));
    expect(room.players.get(mover.playerId)!.x).toBe(beforeReplay);

    // --- kill --------------------------------------------------------------
    const impostorClient = impostors[0]!;
    const victimClient = crew[1]!;
    const impostorPlayer = room.players.get(impostorClient.playerId)!;
    const victimPlayer = room.players.get(victimClient.playerId)!;

    // fake kill from a crewmate is rejected
    const fakeKill = await emitAck(mover.socket, "game:kill", {
      targetId: victimClient.playerId,
    });
    expect(fakeKill.ok).toBe(false);

    // impostor kill out of range is rejected
    victimPlayer.x = impostorPlayer.x + 800;
    impostorPlayer.killReadyAt = 0;
    const farKill = await emitAck(impostorClient.socket, "game:kill", {
      targetId: victimClient.playerId,
    });
    expect(farKill.ok).toBe(false);

    // in range: succeeds and the victim learns via event
    victimPlayer.x = impostorPlayer.x + 20;
    victimPlayer.y = impostorPlayer.y;
    const kill = await emitAck(impostorClient.socket, "game:kill", {
      targetId: victimClient.playerId,
    });
    expect(kill.ok).toBe(true);
    await waitFor(() => (victimClient.events.some((e) => e.type === "playerKilled") ? true : null));

    // ghosts are hidden from living players' snapshots but see everyone
    victimClient.snapshots.length = 0;
    mover.snapshots.length = 0;
    await waitFor(() =>
      victimClient.snapshots.length > 2 && mover.snapshots.length > 2 ? true : null,
    );
    const livingView = mover.snapshots[mover.snapshots.length - 1]!;
    expect(livingView.players.some((p) => p.id === victimClient.playerId)).toBe(false);
    const ghostView = victimClient.snapshots[victimClient.snapshots.length - 1]!;
    expect(ghostView.players.length).toBe(4);

    // --- report + meeting ---------------------------------------------------
    const reporter = crew[2]!;
    const reporterPlayer = room.players.get(reporter.playerId)!;
    reporterPlayer.x = victimPlayer.x + 10;
    reporterPlayer.y = victimPlayer.y;
    const report = await emitAck(reporter.socket, "game:report", {
      bodyId: victimClient.playerId,
    });
    expect(report.ok).toBe(true);

    const meetingEvent = await waitFor(() => {
      const e = reporter.events.find((ev) => ev.type === "meetingUpdate");
      return e && e.type === "meetingUpdate" ? e : null;
    });
    expect(meetingEvent.meeting.reportedBody).toBe(victimClient.playerId);

    // fast-forward reveal+discussion straight to voting
    room.meeting.state!.stage = "voting";
    room.meeting.state!.endsAt = Date.now() + 60_000;

    // the ghost's vote is rejected
    const ghostVote = await emitAck(victimClient.socket, "meeting:vote", { targetId: "skip" });
    expect(ghostVote.ok).toBe(false);

    // everyone alive votes the impostor out
    for (const c of [mover, reporter, impostorClient]) {
      const vote = await emitAck(c.socket, "meeting:vote", {
        targetId: c === impostorClient ? "skip" : impostorClient.playerId,
      });
      expect(vote.ok).toBe(true);
    }
    // double vote rejected
    const dup = await emitAck(mover.socket, "meeting:vote", { targetId: "skip" });
    expect(dup.ok).toBe(false);

    // all votes are in -> results -> eject -> crew win (last impostor ejected)
    await waitFor(
      () =>
        reporter.events.some(
          (e) => e.type === "playerEjected" && e.playerId === impostorClient.playerId,
        )
          ? true
          : null,
      15_000,
    );
    await waitFor(() => (room.phase === "ended" ? true : null), 15_000);
    expect(persisted).toHaveLength(1);
    expect(persisted[0]!.winners).toBe("crew");
    expect(persisted[0]!.reason).toBe("impostorsEjected");
    const winner = persisted[0]!.players.find((p) => p.displayName === "Alice");
    expect(winner).toBeDefined();
  }, 30_000);

  it("supports reconnection with a resume token", async () => {
    const host = await connectClient("Resumer");
    const created = await emitAck<{ code: string; playerId: string; resumeToken: string }>(
      host.socket,
      "room:create",
      { name: "Resumer", color: "lime", hat: "crown", isPublic: false },
    );
    expect(created.ok).toBe(true);

    const rejoiner = await connectClient("Resumer2");
    const rejoin = await emitAck(rejoiner.socket, "room:rejoin", {
      code: created.data!.code,
      playerId: created.data!.playerId,
      resumeToken: created.data!.resumeToken,
    });
    expect(rejoin.ok).toBe(true);

    const badRejoin = await emitAck(rejoiner.socket, "room:rejoin", {
      code: created.data!.code,
      playerId: created.data!.playerId,
      resumeToken: "wrong-token-wrong-token",
    });
    expect(badRejoin.ok).toBe(false);
  });
});
