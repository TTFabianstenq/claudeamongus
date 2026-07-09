import type { Server as HttpServer } from "node:http";
import { Server, type Socket } from "socket.io";
import type { ZodType } from "zod";
import {
  chatSchema,
  cosmeticSchema,
  createRoomSchema,
  doorSabotageSchema,
  fixSchema,
  inputSchema,
  joinRoomSchema,
  killSchema,
  readySchema,
  rejoinSchema,
  reportSchema,
  settingsSchema,
  sabotageSchema,
  taskCompleteSchema,
  taskOpenSchema,
  ventMoveSchema,
  ventSchema,
  voteSchema,
  type Ack,
  type ClientToServerEvents,
  type ServerToClientEvents,
} from "@/shared/protocol";
import { AntiCheat } from "@/server/engine/AntiCheat";
import type { GameRoom, MatchSummary } from "@/server/engine/GameRoom";
import { RoomManager } from "@/server/engine/RoomManager";
import { verifySocketToken, type SocketIdentity } from "@/server/auth/socketToken";

type IoServer = Server<ClientToServerEvents, ServerToClientEvents>;
type IoSocket = Socket<ClientToServerEvents, ServerToClientEvents>;

interface SocketSession {
  identity: SocketIdentity;
  guard: AntiCheat;
  roomCode: string | null;
  playerId: string | null;
}

export interface GatewayDeps {
  persistMatch: (summary: MatchSummary) => Promise<void>;
}

/**
 * Transport layer: authenticates sockets, validates every inbound packet
 * against its zod schema, applies rate limits, and forwards clean intents
 * to the room engine. Nothing in the engine trusts raw socket data.
 */
export class SocketGateway {
  readonly io: IoServer;
  readonly rooms: RoomManager;
  private sessions = new Map<string, SocketSession>();

  constructor(httpServer: HttpServer, deps: GatewayDeps) {
    const origins = (process.env.SOCKET_CORS_ORIGINS ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    this.io = new Server(httpServer, {
      path: "/socket",
      transports: ["websocket", "polling"],
      maxHttpBufferSize: 8_192,
      cors: origins.length > 0 ? { origin: origins, credentials: true } : undefined,
    });

    this.rooms = new RoomManager({
      createEmitter: (code) => ({
        toRoom: (event, ...args) =>
          (this.io.to(`room:${code}`) as unknown as { emit: (e: string, ...a: unknown[]) => void }).emit(
            event,
            ...args,
          ),
        toPlayer: (socketId, event, ...args) =>
          (this.io.to(socketId) as unknown as { emit: (e: string, ...a: unknown[]) => void }).emit(
            event,
            ...args,
          ),
      }),
      onGameEnd: (summary) => {
        void deps.persistMatch(summary).catch((error) => {
          console.error("[persist] failed to store match", error);
        });
      },
    });

    this.io.use(async (socket, next) => {
      const token = (socket.handshake.auth as { token?: unknown }).token;
      if (typeof token !== "string") return next(new Error("Missing auth token"));
      const identity = await verifySocketToken(token);
      if (!identity) return next(new Error("Invalid auth token"));
      this.sessions.set(socket.id, {
        identity,
        guard: new AntiCheat(),
        roomCode: null,
        playerId: null,
      });
      next();
    });

    this.io.on("connection", (socket) => this.bind(socket));
  }

  async close(): Promise<void> {
    this.rooms.destroy();
    await this.io.close();
  }

  private session(socket: IoSocket): SocketSession | null {
    return this.sessions.get(socket.id) ?? null;
  }

  private currentRoom(session: SocketSession): GameRoom | null {
    return session.roomCode ? this.rooms.get(session.roomCode) : null;
  }

  /**
   * Wraps a handler with: rate limiting, zod validation, strike accounting
   * and kick-on-abuse. Handlers only ever see validated payloads.
   */
  private guarded<T>(
    socket: IoSocket,
    event: string,
    schema: ZodType<T> | null,
    handler: (payload: T, ack: (res: Ack<never>) => void) => void,
  ): (...args: unknown[]) => void {
    return (...args: unknown[]) => {
      const session = this.session(socket);
      if (!session) return;
      const maybeAck = args.find((a) => typeof a === "function") as
        | ((res: Ack<never>) => void)
        | undefined;
      const ack = (res: Ack<never>) => {
        try {
          maybeAck?.(res);
        } catch {
          // client supplied a throwing ack — ignore
        }
      };
      if (!session.guard.allow(event)) {
        ack({ ok: false, error: "Rate limit exceeded" });
        if (session.guard.shouldKick) socket.disconnect(true);
        return;
      }
      let payload = undefined as T;
      if (schema) {
        const parsed = schema.safeParse(args[0]);
        if (!parsed.success) {
          session.guard.strike(2);
          ack({ ok: false, error: "Invalid payload" });
          if (session.guard.shouldKick) socket.disconnect(true);
          return;
        }
        payload = parsed.data;
      }
      try {
        handler(payload, ack);
      } catch (error) {
        console.error(`[gateway] handler error for ${event}`, error);
        ack({ ok: false, error: "Internal error" });
      }
    };
  }

  private bind(socket: IoSocket): void {
    const requireRoom = (
      ack: (res: Ack<never>) => void,
      fn: (room: GameRoom, playerId: string) => { ok: boolean; error?: string } | void,
    ) => {
      const session = this.session(socket);
      const room = session ? this.currentRoom(session) : null;
      if (!session || !room || !session.playerId) {
        ack({ ok: false, error: "Not in a room" });
        return;
      }
      const result = fn(room, session.playerId);
      if (result) {
        if (result.ok) ack({ ok: true } as Ack<never>);
        else {
          ack({ ok: false, error: result.error ?? "Rejected" });
        }
      }
    };

    socket.on(
      "room:create",
      this.guarded(socket, "room:create", createRoomSchema, (payload, ack) => {
        const session = this.session(socket);
        if (!session) return;
        if (session.roomCode) this.leaveRoom(socket);
        const room = this.rooms.create(payload.isPublic);
        const result = room.addPlayer({
          socketId: socket.id,
          userId: session.identity.guest ? null : session.identity.sub,
          name: payload.name,
          color: payload.color,
          hat: payload.hat,
        });
        if (!result.ok) {
          this.rooms.remove(room.code);
          ack({ ok: false, error: result.error });
          return;
        }
        session.roomCode = room.code;
        session.playerId = result.data?.playerId ?? null;
        void socket.join(`room:${room.code}`);
        room.broadcastLobby();
        ack({
          ok: true,
          data: { code: room.code, ...result.data },
        } as unknown as Ack<never>);
      }),
    );

    socket.on(
      "room:join",
      this.guarded(socket, "room:join", joinRoomSchema, (payload, ack) => {
        const session = this.session(socket);
        if (!session) return;
        if (session.roomCode) this.leaveRoom(socket);
        const room = this.rooms.get(payload.code);
        if (!room) {
          ack({ ok: false, error: "Room not found" });
          return;
        }
        const result = room.addPlayer({
          socketId: socket.id,
          userId: session.identity.guest ? null : session.identity.sub,
          name: payload.name,
          color: payload.color,
          hat: payload.hat,
        });
        if (!result.ok) {
          ack({ ok: false, error: result.error });
          return;
        }
        session.roomCode = room.code;
        session.playerId = result.data?.playerId ?? null;
        void socket.join(`room:${room.code}`);
        room.broadcastLobby();
        ack({ ok: true, data: { code: room.code, ...result.data } } as unknown as Ack<never>);
      }),
    );

    socket.on(
      "room:rejoin",
      this.guarded(socket, "room:rejoin", rejoinSchema, (payload, ack) => {
        const session = this.session(socket);
        if (!session) return;
        const room = this.rooms.get(payload.code);
        if (!room) {
          ack({ ok: false, error: "Room no longer exists" });
          return;
        }
        const result = room.rejoin(payload.playerId, payload.resumeToken, socket.id);
        if (!result.ok) {
          ack({ ok: false, error: result.error });
          return;
        }
        session.roomCode = room.code;
        session.playerId = payload.playerId;
        void socket.join(`room:${room.code}`);
        room.broadcastLobby();
        ack({ ok: true, data: { code: room.code, ...result.data } } as unknown as Ack<never>);
      }),
    );

    socket.on("room:leave", () => this.leaveRoom(socket));

    socket.on(
      "room:list",
      this.guarded(socket, "room:list", null, (_payload, ack) => {
        ack({ ok: true, data: { rooms: this.rooms.listPublic() } } as unknown as Ack<never>);
      }),
    );

    socket.on(
      "lobby:ready",
      this.guarded(socket, "lobby:ready", readySchema, (payload) => {
        const session = this.session(socket);
        const room = session ? this.currentRoom(session) : null;
        if (room && session?.playerId) room.setReady(session.playerId, payload.ready);
      }),
    );

    socket.on(
      "lobby:cosmetic",
      this.guarded(socket, "lobby:cosmetic", cosmeticSchema, (payload, ack) => {
        requireRoom(ack, (room, playerId) => room.setCosmetic(playerId, payload.color, payload.hat));
      }),
    );

    socket.on(
      "lobby:settings",
      this.guarded(socket, "lobby:settings", settingsSchema, (payload, ack) => {
        requireRoom(ack, (room, playerId) => room.updateSettings(playerId, payload));
      }),
    );

    socket.on(
      "lobby:start",
      this.guarded(socket, "lobby:start", null, (_payload, ack) => {
        requireRoom(ack, (room, playerId) => room.startGame(playerId));
      }),
    );

    socket.on(
      "game:input",
      this.guarded(socket, "game:input", inputSchema, (payload) => {
        const session = this.session(socket);
        const room = session ? this.currentRoom(session) : null;
        if (room && session?.playerId) room.queueInput(session.playerId, payload);
      }),
    );

    socket.on(
      "game:kill",
      this.guarded(socket, "game:kill", killSchema, (payload, ack) => {
        requireRoom(ack, (room, playerId) => room.kill(playerId, payload.targetId));
      }),
    );

    socket.on(
      "game:report",
      this.guarded(socket, "game:report", reportSchema, (payload, ack) => {
        requireRoom(ack, (room, playerId) => room.report(playerId, payload.bodyId));
      }),
    );

    socket.on(
      "game:emergency",
      this.guarded(socket, "game:emergency", null, (_payload, ack) => {
        requireRoom(ack, (room, playerId) => room.emergency(playerId));
      }),
    );

    socket.on(
      "game:ventEnter",
      this.guarded(socket, "game:ventEnter", ventSchema, (payload, ack) => {
        requireRoom(ack, (room, playerId) => room.ventEnter(playerId, payload.ventId));
      }),
    );

    socket.on(
      "game:ventMove",
      this.guarded(socket, "game:ventMove", ventMoveSchema, (payload, ack) => {
        requireRoom(ack, (room, playerId) => room.ventMove(playerId, payload.toVentId));
      }),
    );

    socket.on(
      "game:ventExit",
      this.guarded(socket, "game:ventExit", null, (_payload, ack) => {
        requireRoom(ack, (room, playerId) => room.ventExit(playerId));
      }),
    );

    socket.on(
      "game:taskOpen",
      this.guarded(socket, "game:taskOpen", taskOpenSchema, (payload, ack) => {
        requireRoom(ack, (room, playerId) => room.taskOpen(playerId, payload.taskId));
      }),
    );

    socket.on(
      "game:taskComplete",
      this.guarded(socket, "game:taskComplete", taskCompleteSchema, (payload, ack) => {
        requireRoom(ack, (room, playerId) => room.taskComplete(playerId, payload.taskId));
      }),
    );

    socket.on("game:taskClose", () => {
      const session = this.session(socket);
      const room = session ? this.currentRoom(session) : null;
      if (room && session?.playerId) room.taskClose(session.playerId);
    });

    socket.on(
      "game:sabotage",
      this.guarded(socket, "game:sabotage", sabotageSchema, (payload, ack) => {
        requireRoom(ack, (room, playerId) => room.triggerSabotage(playerId, payload.kind));
      }),
    );

    socket.on(
      "game:doorSabotage",
      this.guarded(socket, "game:doorSabotage", doorSabotageSchema, (payload, ack) => {
        requireRoom(ack, (room, playerId) => room.triggerDoorSabotage(playerId, payload.roomId));
      }),
    );

    socket.on(
      "game:fix",
      this.guarded(socket, "game:fix", fixSchema, (payload, ack) => {
        requireRoom(ack, (room, playerId) => room.fix(playerId, payload.kind, payload.panelId));
      }),
    );

    socket.on(
      "game:fixHold",
      this.guarded(socket, "game:fixHold", fixSchema, (payload) => {
        const session = this.session(socket);
        const room = session ? this.currentRoom(session) : null;
        if (room && session?.playerId) room.fixHold(session.playerId, payload.panelId, true);
      }),
    );

    socket.on(
      "game:fixRelease",
      this.guarded(socket, "game:fixRelease", fixSchema, (payload) => {
        const session = this.session(socket);
        const room = session ? this.currentRoom(session) : null;
        if (room && session?.playerId) room.fixHold(session.playerId, payload.panelId, false);
      }),
    );

    socket.on(
      "meeting:vote",
      this.guarded(socket, "meeting:vote", voteSchema, (payload, ack) => {
        requireRoom(ack, (room, playerId) => room.vote(playerId, payload.targetId));
      }),
    );

    socket.on(
      "chat:send",
      this.guarded(socket, "chat:send", chatSchema, (payload, ack) => {
        requireRoom(ack, (room, playerId) => room.chat(playerId, payload.text));
      }),
    );

    socket.on("disconnect", () => {
      const session = this.session(socket);
      if (session?.roomCode) {
        const room = this.rooms.get(session.roomCode);
        room?.handleDisconnect(socket.id);
      }
      this.sessions.delete(socket.id);
    });
  }

  private leaveRoom(socket: IoSocket): void {
    const session = this.session(socket);
    if (!session?.roomCode) return;
    const room = this.rooms.get(session.roomCode);
    if (room && session.playerId) room.removePlayer(session.playerId);
    void socket.leave(`room:${session.roomCode}`);
    session.roomCode = null;
    session.playerId = null;
  }
}
