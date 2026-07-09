import { z } from "zod";
import {
  CHAT_MAX_LENGTH,
  MAX_ROOM_PLAYERS,
  NAME_MAX_LENGTH,
  NAME_MIN_LENGTH,
  PLAYER_COLORS,
  HATS,
  ROOM_CODE_LENGTH,
} from "./constants";
import type {
  ChatMessage,
  GameEvent,
  GameOverPayload,
  GameSnapshot,
  GameStartPayload,
  LobbyState,
  PublicRoomInfo,
} from "./types";

/**
 * Every client -> server payload is validated with one of these schemas
 * before it reaches game logic. Anything that fails validation is dropped
 * and counted against the sender's strike budget.
 */

const colorIds = PLAYER_COLORS.map((c) => c.id) as [string, ...string[]];
const hatIds = HATS.map((h) => h.id) as [string, ...string[]];

export const nameSchema = z
  .string()
  .trim()
  .min(NAME_MIN_LENGTH)
  .max(NAME_MAX_LENGTH)
  .regex(/^[\p{L}\p{N} _\-'.]+$/u, "Name contains invalid characters");

export const colorSchema = z.enum(colorIds);
export const hatSchema = z.enum(hatIds);
export const roomCodeSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(new RegExp(`^[A-Z]{${ROOM_CODE_LENGTH}}$`));

export const settingsSchema = z
  .object({
    isPublic: z.boolean(),
    maxPlayers: z.number().int().min(4).max(MAX_ROOM_PLAYERS),
    impostorCount: z.number().int().min(1).max(3),
    playerSpeed: z.number().min(0.5).max(3),
    crewVision: z.number().min(0.25).max(5),
    impostorVision: z.number().min(0.25).max(5),
    killCooldown: z.number().min(10).max(60),
    killRange: z.enum(["short", "normal", "long"]),
    discussionTime: z.number().int().min(0).max(120),
    votingTime: z.number().int().min(15).max(300),
    emergencyMeetings: z.number().int().min(0).max(9),
    commonTasks: z.number().int().min(0).max(2),
    shortTasks: z.number().int().min(0).max(5),
    longTasks: z.number().int().min(0).max(3),
    visualTasks: z.boolean(),
    confirmEjects: z.boolean(),
    anonymousVotes: z.boolean(),
  })
  .strict();

export const createRoomSchema = z
  .object({
    name: nameSchema,
    color: colorSchema,
    hat: hatSchema,
    isPublic: z.boolean(),
  })
  .strict();

export const joinRoomSchema = z
  .object({
    code: roomCodeSchema,
    name: nameSchema,
    color: colorSchema,
    hat: hatSchema,
  })
  .strict();

export const rejoinSchema = z
  .object({
    code: roomCodeSchema,
    playerId: z.string().min(8).max(64),
    resumeToken: z.string().min(16).max(128),
  })
  .strict();

export const readySchema = z.object({ ready: z.boolean() }).strict();
export const cosmeticSchema = z.object({ color: colorSchema, hat: hatSchema }).strict();

export const inputSchema = z
  .object({
    seq: z.number().int().min(0).max(1_000_000_000),
    /** client wall time; used for staleness rejection only */
    t: z.number().int().min(0),
    moveX: z.number().min(-1).max(1),
    moveY: z.number().min(-1).max(1),
  })
  .strict();

export const killSchema = z.object({ targetId: z.string().min(1).max(64) }).strict();
export const reportSchema = z.object({ bodyId: z.string().min(1).max(64) }).strict();
export const ventSchema = z.object({ ventId: z.string().min(1).max(32) }).strict();
export const ventMoveSchema = z.object({ toVentId: z.string().min(1).max(32) }).strict();
export const taskOpenSchema = z.object({ taskId: z.string().min(1).max(64) }).strict();
export const taskCompleteSchema = z.object({ taskId: z.string().min(1).max(64) }).strict();
export const sabotageSchema = z
  .object({ kind: z.enum(["lights", "reactor", "o2", "comms"]) })
  .strict();
export const doorSabotageSchema = z.object({ roomId: z.string().min(1).max(32) }).strict();
export const fixSchema = z
  .object({
    kind: z.enum(["lights", "reactor", "o2", "comms"]),
    panelId: z.string().min(1).max(32),
  })
  .strict();
export const voteSchema = z
  .object({ targetId: z.union([z.string().min(1).max(64), z.literal("skip")]) })
  .strict();
export const chatSchema = z
  .object({ text: z.string().trim().min(1).max(CHAT_MAX_LENGTH) })
  .strict();

export interface Ack<T = Record<string, never>> {
  ok: boolean;
  error?: string;
  data?: T;
}

/** Client -> server events. */
export interface ClientToServerEvents {
  "room:create": (
    payload: z.infer<typeof createRoomSchema>,
    ack: (res: Ack<{ code: string; playerId: string; resumeToken: string }>) => void,
  ) => void;
  "room:join": (
    payload: z.infer<typeof joinRoomSchema>,
    ack: (res: Ack<{ code: string; playerId: string; resumeToken: string }>) => void,
  ) => void;
  "room:rejoin": (
    payload: z.infer<typeof rejoinSchema>,
    ack: (res: Ack<{ code: string; playerId: string; resumeToken: string }>) => void,
  ) => void;
  "room:leave": () => void;
  "room:list": (ack: (res: Ack<{ rooms: PublicRoomInfo[] }>) => void) => void;
  "lobby:ready": (payload: z.infer<typeof readySchema>) => void;
  "lobby:cosmetic": (payload: z.infer<typeof cosmeticSchema>, ack: (res: Ack) => void) => void;
  "lobby:settings": (payload: z.infer<typeof settingsSchema>, ack: (res: Ack) => void) => void;
  "lobby:start": (ack: (res: Ack) => void) => void;
  "game:input": (payload: z.infer<typeof inputSchema>) => void;
  "game:kill": (payload: z.infer<typeof killSchema>, ack: (res: Ack) => void) => void;
  "game:report": (payload: z.infer<typeof reportSchema>, ack: (res: Ack) => void) => void;
  "game:emergency": (ack: (res: Ack) => void) => void;
  "game:ventEnter": (payload: z.infer<typeof ventSchema>, ack: (res: Ack) => void) => void;
  "game:ventMove": (payload: z.infer<typeof ventMoveSchema>, ack: (res: Ack) => void) => void;
  "game:ventExit": (ack: (res: Ack) => void) => void;
  "game:taskOpen": (payload: z.infer<typeof taskOpenSchema>, ack: (res: Ack) => void) => void;
  "game:taskComplete": (
    payload: z.infer<typeof taskCompleteSchema>,
    ack: (res: Ack) => void,
  ) => void;
  "game:taskClose": () => void;
  "game:sabotage": (payload: z.infer<typeof sabotageSchema>, ack: (res: Ack) => void) => void;
  "game:doorSabotage": (
    payload: z.infer<typeof doorSabotageSchema>,
    ack: (res: Ack) => void,
  ) => void;
  "game:fix": (payload: z.infer<typeof fixSchema>, ack: (res: Ack) => void) => void;
  "game:fixHold": (payload: z.infer<typeof fixSchema>) => void;
  "game:fixRelease": (payload: z.infer<typeof fixSchema>) => void;
  "meeting:vote": (payload: z.infer<typeof voteSchema>, ack: (res: Ack) => void) => void;
  "chat:send": (payload: z.infer<typeof chatSchema>, ack: (res: Ack) => void) => void;
}

/** Server -> client events. */
export interface ServerToClientEvents {
  "room:state": (state: LobbyState) => void;
  "room:closed": (reason: string) => void;
  "game:starting": (payload: { countdown: number }) => void;
  "game:started": (payload: GameStartPayload) => void;
  "game:snapshot": (snapshot: GameSnapshot) => void;
  "game:event": (event: GameEvent) => void;
  "game:over": (payload: GameOverPayload) => void;
  "game:taskUpdate": (payload: { tasks: import("./types").TaskAssignment[] }) => void;
  "chat:message": (message: ChatMessage) => void;
  "server:error": (payload: { code: string; message: string }) => void;
}

export interface SocketAuthData {
  /** signed short-lived token from /api/socket-token */
  token: string;
}
