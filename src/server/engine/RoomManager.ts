import { LOBBY_IDLE_TIMEOUT_MS, ROOM_CODE_LENGTH } from "@/shared/constants";
import { randomRoomCode } from "@/shared/rng";
import type { PublicRoomInfo, RoomSettings } from "@/shared/types";
import { DEFAULT_SETTINGS } from "@/shared/types";
import { GameRoom, type GameRoomHooks, type RoomEmitter } from "./GameRoom";

export interface RoomManagerDeps {
  createEmitter: (code: string) => RoomEmitter;
  onGameEnd: GameRoomHooks["onGameEnd"];
}

/**
 * Registry of live rooms. Rooms are in-memory (a match is ephemeral); only
 * results are persisted. Idle rooms are reaped to avoid leaks.
 */
export class RoomManager {
  private rooms = new Map<string, GameRoom>();
  private reaper: ReturnType<typeof setInterval>;

  constructor(private readonly deps: RoomManagerDeps) {
    this.reaper = setInterval(() => this.reapIdle(), 60_000);
  }

  destroy(): void {
    clearInterval(this.reaper);
    for (const room of this.rooms.values()) room.destroy();
    this.rooms.clear();
  }

  create(isPublic: boolean): GameRoom {
    let code = randomRoomCode(ROOM_CODE_LENGTH);
    while (this.rooms.has(code)) code = randomRoomCode(ROOM_CODE_LENGTH);
    const settings: RoomSettings = { ...DEFAULT_SETTINGS, isPublic };
    const room = new GameRoom(code, settings, this.deps.createEmitter(code), {
      onGameEnd: this.deps.onGameEnd,
      onEmpty: (c) => this.remove(c),
    });
    this.rooms.set(code, room);
    return room;
  }

  get(code: string): GameRoom | null {
    return this.rooms.get(code.toUpperCase()) ?? null;
  }

  remove(code: string): void {
    const room = this.rooms.get(code);
    if (room) {
      room.destroy();
      this.rooms.delete(code);
    }
  }

  listPublic(): PublicRoomInfo[] {
    const out: PublicRoomInfo[] = [];
    for (const room of this.rooms.values()) {
      if (!room.settings.isPublic) continue;
      if (room.isEmpty) continue;
      const host = room.players.get(room.hostId);
      out.push({
        code: room.code,
        hostName: host?.name ?? "Unknown",
        players: room.players.size,
        maxPlayers: room.settings.maxPlayers,
        inGame: room.phase !== "lobby",
      });
    }
    return out.slice(0, 50);
  }

  get count(): number {
    return this.rooms.size;
  }

  private reapIdle(): void {
    for (const room of this.rooms.values()) {
      if (room.isEmpty || room.idleMs > LOBBY_IDLE_TIMEOUT_MS) {
        this.remove(room.code);
      }
    }
  }
}
