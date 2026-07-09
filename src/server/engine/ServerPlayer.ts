import type { HatId, PlayerColorId } from "@/shared/constants";
import type { Role, TaskAssignment } from "@/shared/types";

export interface QueuedInput {
  seq: number;
  t: number;
  moveX: number;
  moveY: number;
}

export interface PlayerMatchStats {
  kills: number;
  tasksCompleted: number;
  bodiesReported: number;
  emergenciesCalled: number;
  sabotagesFixed: number;
}

/**
 * Authoritative per-player state. Everything gameplay-relevant lives here on
 * the server; clients only ever see filtered projections of it.
 */
export class ServerPlayer {
  readonly id: string;
  readonly resumeToken: string;
  socketId: string | null;
  userId: string | null;
  name: string;
  color: PlayerColorId;
  hat: HatId;

  ready = false;
  connected = true;
  disconnectedAt: number | null = null;

  x = 0;
  y = 0;
  facing = 1;
  moving = false;
  lastSeq = -1;
  lastInputT = 0;
  inputQueue: QueuedInput[] = [];

  role: Role = "crewmate";
  alive = true;
  inVentId: string | null = null;
  killReadyAt = 0;
  emergenciesUsed = 0;
  tasks: TaskAssignment[] = [];
  openTask: { taskId: string; consoleId: string; openedAt: number; x: number; y: number } | null =
    null;

  stats: PlayerMatchStats = {
    kills: 0,
    tasksCompleted: 0,
    bodiesReported: 0,
    emergenciesCalled: 0,
    sabotagesFixed: 0,
  };

  constructor(opts: {
    id: string;
    resumeToken: string;
    socketId: string;
    userId: string | null;
    name: string;
    color: PlayerColorId;
    hat: HatId;
  }) {
    this.id = opts.id;
    this.resumeToken = opts.resumeToken;
    this.socketId = opts.socketId;
    this.userId = opts.userId;
    this.name = opts.name;
    this.color = opts.color;
    this.hat = opts.hat;
  }

  get isGhost(): boolean {
    return !this.alive;
  }

  resetForGame(spawn: { x: number; y: number }): void {
    this.x = spawn.x;
    this.y = spawn.y;
    this.facing = 1;
    this.moving = false;
    this.lastSeq = -1;
    this.inputQueue = [];
    this.alive = true;
    this.inVentId = null;
    this.emergenciesUsed = 0;
    this.tasks = [];
    this.openTask = null;
    this.stats = {
      kills: 0,
      tasksCompleted: 0,
      bodiesReported: 0,
      emergenciesCalled: 0,
      sabotagesFixed: 0,
    };
  }
}
