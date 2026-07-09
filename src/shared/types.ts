import type { HatId, PlayerColorId } from "./constants";

export type GamePhase = "lobby" | "starting" | "playing" | "meeting" | "ended";
export type MeetingStage = "reveal" | "discussion" | "voting" | "results" | "eject";
export type Role = "crewmate" | "impostor";
export type SabotageKind = "lights" | "reactor" | "o2" | "comms" | "doors";
export type TaskKind =
  | "wires"
  | "cardSwipe"
  | "fuelEngine"
  | "download"
  | "upload"
  | "alignEngine"
  | "unlockManifolds"
  | "startReactor"
  | "garbage"
  | "asteroids";
export type TaskLength = "common" | "short" | "long";
export type WinReason =
  | "tasksComplete"
  | "impostorsEjected"
  | "impostorsDominate"
  | "sabotageMeltdown"
  | "crewQuit"
  | "impostorQuit";
export type Team = "crew" | "impostors";
export type ChatChannel = "lobby" | "meeting" | "ghost";

export interface RoomSettings {
  isPublic: boolean;
  maxPlayers: number;
  impostorCount: number;
  playerSpeed: number; // 0.5 - 3.0 multiplier
  crewVision: number; // 0.25 - 5.0
  impostorVision: number; // 0.25 - 5.0
  killCooldown: number; // seconds
  killRange: "short" | "normal" | "long";
  discussionTime: number; // seconds
  votingTime: number; // seconds
  emergencyMeetings: number; // per player
  commonTasks: number;
  shortTasks: number;
  longTasks: number;
  visualTasks: boolean;
  confirmEjects: boolean;
  anonymousVotes: boolean;
}

export const DEFAULT_SETTINGS: RoomSettings = {
  isPublic: false,
  maxPlayers: 10,
  impostorCount: 2,
  playerSpeed: 1.0,
  crewVision: 1.0,
  impostorVision: 1.5,
  killCooldown: 30,
  killRange: "normal",
  discussionTime: 30,
  votingTime: 60,
  emergencyMeetings: 1,
  commonTasks: 1,
  shortTasks: 3,
  longTasks: 1,
  visualTasks: true,
  confirmEjects: true,
  anonymousVotes: false,
};

/** A player as seen in the lobby. */
export interface LobbyPlayer {
  id: string;
  name: string;
  color: PlayerColorId;
  hat: HatId;
  isHost: boolean;
  ready: boolean;
  connected: boolean;
  authenticated: boolean;
}

export interface LobbyState {
  code: string;
  phase: GamePhase;
  hostId: string;
  settings: RoomSettings;
  players: LobbyPlayer[];
  countdown: number | null; // seconds remaining in "starting" phase
}

export interface PublicRoomInfo {
  code: string;
  hostName: string;
  players: number;
  maxPlayers: number;
  inGame: boolean;
}

/** Per-entity data inside a snapshot. Role data is stripped per-recipient. */
export interface SnapshotPlayer {
  id: string;
  x: number;
  y: number;
  /** movement direction for animation: -1 left, 1 right */
  facing: number;
  /** true while the player has nonzero velocity (walk animation) */
  moving: boolean;
  alive: boolean;
  inVent: boolean;
  connected: boolean;
}

export interface DeadBody {
  id: string; // equals the dead player's id
  playerId: string;
  x: number;
  y: number;
  color: PlayerColorId;
}

export interface ActiveSabotage {
  kind: Exclude<SabotageKind, "doors">;
  /** unix ms deadline for critical sabotages (reactor / o2); null otherwise */
  deadline: number | null;
  /** progress flags, e.g. which reactor pad is held / which o2 code entered */
  fixed: Record<string, boolean>;
}

export interface DoorState {
  id: string;
  closedUntil: number; // unix ms; 0 = open
}

export interface CameraFeedPlayer {
  color: PlayerColorId;
  x: number;
  y: number;
  moving: boolean;
}

export interface GameSnapshot {
  tick: number;
  now: number; // server unix ms (clock sync)
  ackSeq: number; // last input sequence processed for the recipient
  players: SnapshotPlayer[];
  bodies: DeadBody[];
  sabotage: ActiveSabotage | null;
  doors: DoorState[];
  taskBar: number; // 0..1 global crew task progress
  killCooldownAt: number; // recipient-only: unix ms when kill is ready (impostors)
  emergenciesLeft: number; // recipient-only
  /** live room occupancy — only while the recipient stands at the admin table */
  admin: Record<string, number> | null;
  /** camera feeds — only while the recipient stands at the security console */
  cameras: Array<{ camId: string; players: CameraFeedPlayer[] }> | null;
}

export interface TaskAssignment {
  id: string;
  kind: TaskKind;
  length: TaskLength;
  visual: boolean;
  /** Ordered console ids; the task advances one stage per console. */
  consoleIds: string[];
  stage: number; // next console index to complete
  done: boolean;
}

export interface GameStartPayload {
  role: Role;
  /** ids of fellow impostors (only for impostors; empty for crew) */
  mates: string[];
  tasks: TaskAssignment[];
  settings: RoomSettings;
  players: Array<{
    id: string;
    name: string;
    color: PlayerColorId;
    hat: HatId;
  }>;
  spawn: { x: number; y: number };
}

export interface VoteRevealEntry {
  targetId: string | "skip";
  /** voter ids; empty when votes are anonymous */
  voters: string[];
  count: number;
}

export interface MeetingState {
  stage: MeetingStage;
  calledBy: string;
  reportedBody: string | null; // player id of the body, null for emergency
  endsAt: number; // unix ms end of current stage
  /** which players have cast a vote (targets hidden until reveal) */
  voted: string[];
  reveal: VoteRevealEntry[] | null;
  ejected: string | null;
  ejectedRole: Role | null; // only set when confirmEjects is on
  tieOrSkip: boolean;
}

export interface GameOverPayload {
  winners: Team;
  reason: WinReason;
  impostorIds: string[];
  players: Array<{
    id: string;
    name: string;
    color: PlayerColorId;
    role: Role;
    alive: boolean;
  }>;
}

export interface ChatMessage {
  id: string;
  channel: ChatChannel;
  fromId: string;
  fromName: string;
  fromColor: PlayerColorId;
  text: string;
  at: number;
}

export type GameEvent =
  | { type: "playerKilled"; victimId: string; killerId: string; x: number; y: number }
  | { type: "bodyReported"; reporterId: string; bodyId: string }
  | { type: "emergencyCalled"; byId: string }
  | { type: "meetingUpdate"; meeting: MeetingState }
  | {
      type: "playerEjected";
      playerId: string;
      role: Role | null;
      remainingImpostors: number | null;
    }
  | { type: "meetingEnded" }
  | { type: "taskProgress"; taskBar: number; visual: { kind: TaskKind; playerId: string } | null }
  | { type: "sabotageStarted"; sabotage: ActiveSabotage }
  | { type: "sabotageFixed"; kind: SabotageKind }
  | { type: "sabotageProgress"; sabotage: ActiveSabotage }
  | { type: "doorsClosed"; doorIds: string[]; until: number }
  | { type: "playerVented"; playerId: string; ventId: string; entered: boolean }
  | { type: "playerLeft"; playerId: string }
  | { type: "playerDisconnected"; playerId: string; connected: boolean };
