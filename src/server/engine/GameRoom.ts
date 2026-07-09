import {
  BASE_MOVE_SPEED,
  CREW_VISION_BASE,
  DISCONNECT_GRACE_SECONDS,
  EMERGENCY_COOLDOWN_SECONDS,
  GHOST_SPEED_MULT,
  IMPOSTOR_VISION_BASE,
  KILL_RANGES,
  LIGHTS_OUT_VISION_MULT,
  MAX_INPUTS_PER_TICK,
  MIN_PLAYERS_TO_START,
  PLAYER_COLORS,
  SNAPSHOT_EVERY_TICKS,
  START_COUNTDOWN_SECONDS,
  TICK_MS,
  TICK_RATE,
  USE_RADIUS,
  REPORT_RADIUS,
  type HatId,
  type PlayerColorId,
} from "@/shared/constants";
import { HELION, allFloors, ventById, type MapDef } from "@/shared/map/helion";
import { CollisionGrid, dist, stepMovement } from "@/shared/physics";
import { randomToken, shuffle } from "@/shared/rng";
import type {
  ChatMessage,
  DeadBody,
  GameEvent,
  GameOverPayload,
  GameSnapshot,
  GameStartPayload,
  LobbyState,
  GamePhase,
  RoomSettings,
  Team,
  WinReason,
} from "@/shared/types";
import { MeetingService } from "./MeetingService";
import { SabotageService } from "./SabotageService";
import { ServerPlayer } from "./ServerPlayer";
import { TaskService } from "./TaskService";

export interface RoomEmitter {
  toRoom<E extends string>(event: E, ...args: unknown[]): void;
  toPlayer<E extends string>(socketId: string, event: E, ...args: unknown[]): void;
}

export interface MatchSummary {
  code: string;
  mapId: string;
  startedAt: Date;
  endedAt: Date;
  winners: Team;
  reason: WinReason;
  settings: RoomSettings;
  players: Array<{
    userId: string | null;
    displayName: string;
    color: string;
    role: "crewmate" | "impostor";
    won: boolean;
    died: boolean;
    kills: number;
    tasksCompleted: number;
    bodiesReported: number;
    emergenciesCalled: number;
    sabotagesFixed: number;
  }>;
}

export interface GameRoomHooks {
  onGameEnd: (summary: MatchSummary) => void;
  onEmpty: (code: string) => void;
}

type Result<T = Record<string, never>> = { ok: true; data?: T } | { ok: false; error: string };

const ok = <T>(data?: T): Result<T> => ({ ok: true, data });
const err = (error: string): Result<never> => ({ ok: false, error });

/**
 * One lobby/match. Fully authoritative: clients only send intents; every
 * position, kill, vote, task and sabotage is validated and simulated here.
 */
export class GameRoom {
  readonly code: string;
  readonly map: MapDef = HELION;
  settings: RoomSettings;
  phase: GamePhase = "lobby";
  hostId = "";

  players = new Map<string, ServerPlayer>();
  bodies: DeadBody[] = [];

  readonly grid: CollisionGrid;
  readonly tasks: TaskService;
  readonly sabotage: SabotageService;
  readonly meeting = new MeetingService();

  private tick = 0;
  private interval: ReturnType<typeof setInterval> | null = null;
  private countdownEndsAt = 0;
  private emergencyAvailableAt = 0;
  private endedResetAt = 0;
  private startedAt = new Date();
  private impostorIds: string[] = [];
  private lastActivityAt = Date.now();

  constructor(
    code: string,
    settings: RoomSettings,
    private readonly emitter: RoomEmitter,
    private readonly hooks: GameRoomHooks,
  ) {
    this.code = code;
    this.settings = settings;
    this.grid = new CollisionGrid(this.map.width, this.map.height, this.map.cell, allFloors(this.map));
    this.tasks = new TaskService(this.map);
    this.sabotage = new SabotageService(this.map, this.grid);
    this.interval = setInterval(() => this.onTick(), TICK_MS);
  }

  destroy(): void {
    if (this.interval) clearInterval(this.interval);
    this.interval = null;
  }

  get playerList(): ServerPlayer[] {
    return [...this.players.values()];
  }

  get isEmpty(): boolean {
    return this.players.size === 0;
  }

  get idleMs(): number {
    return Date.now() - this.lastActivityAt;
  }

  // ---------------------------------------------------------------- lobby

  addPlayer(opts: {
    socketId: string;
    userId: string | null;
    name: string;
    color: string;
    hat: string;
  }): Result<{ playerId: string; resumeToken: string }> {
    if (this.phase !== "lobby") return err("Game already in progress");
    if (this.players.size >= this.settings.maxPlayers) return err("Room is full");
    const color = this.claimColor(opts.color as PlayerColorId);
    if (!color) return err("No colors left");
    const player = new ServerPlayer({
      id: randomToken(12),
      resumeToken: randomToken(24),
      socketId: opts.socketId,
      userId: opts.userId,
      name: opts.name,
      color,
      hat: opts.hat as HatId,
    });
    const spawn = this.lobbySpawn(this.players.size);
    player.x = spawn.x;
    player.y = spawn.y;
    this.players.set(player.id, player);
    if (!this.hostId) this.hostId = player.id;
    this.touch();
    this.broadcastLobby();
    return ok({ playerId: player.id, resumeToken: player.resumeToken });
  }

  rejoin(
    playerId: string,
    resumeToken: string,
    socketId: string,
  ): Result<{ playerId: string; resumeToken: string }> {
    const player = this.players.get(playerId);
    if (!player) return err("Player no longer in room");
    if (player.resumeToken !== resumeToken) return err("Invalid resume token");
    player.socketId = socketId;
    player.connected = true;
    player.disconnectedAt = null;
    this.touch();
    this.broadcastLobby();
    this.emitEvent({ type: "playerDisconnected", playerId, connected: true });
    if (this.phase === "playing" || this.phase === "meeting") {
      this.emitter.toPlayer(socketId, "game:started", this.startPayloadFor(player));
      if (this.meeting.state) {
        this.emitter.toPlayer(socketId, "game:event", {
          type: "meetingUpdate",
          meeting: this.meeting.state,
        } satisfies GameEvent);
      }
    }
    return ok({ playerId, resumeToken });
  }

  handleDisconnect(socketId: string): void {
    const player = this.playerList.find((p) => p.socketId === socketId);
    if (!player) return;
    if (this.phase === "lobby" || this.phase === "ended") {
      this.removePlayer(player.id);
      return;
    }
    player.connected = false;
    player.disconnectedAt = Date.now();
    player.inputQueue = [];
    player.moving = false;
    this.sabotage.releaseHolds(player.id);
    this.emitEvent({ type: "playerDisconnected", playerId: player.id, connected: false });
    this.broadcastLobby();
  }

  removePlayer(playerId: string): void {
    const player = this.players.get(playerId);
    if (!player) return;
    this.players.delete(playerId);
    this.sabotage.releaseHolds(playerId);
    this.bodies = this.bodies.filter((b) => b.playerId !== playerId);
    if (this.hostId === playerId) {
      this.hostId = this.playerList[0]?.id ?? "";
    }
    this.emitEvent({ type: "playerLeft", playerId });
    if (this.isEmpty) {
      this.hooks.onEmpty(this.code);
      return;
    }
    if (this.phase === "playing" || this.phase === "meeting") {
      this.emitTaskBar();
      this.checkWin();
    }
    this.broadcastLobby();
  }

  setReady(playerId: string, ready: boolean): void {
    const player = this.players.get(playerId);
    if (!player || this.phase !== "lobby") return;
    player.ready = ready;
    this.touch();
    this.broadcastLobby();
  }

  setCosmetic(playerId: string, color: string, hat: string): Result {
    const player = this.players.get(playerId);
    if (!player) return err("Not in room");
    if (this.phase !== "lobby") return err("Cosmetics are locked in game");
    const taken = this.playerList.some((p) => p.id !== playerId && p.color === color);
    if (taken) return err("Color already taken");
    player.color = color as PlayerColorId;
    player.hat = hat as HatId;
    this.broadcastLobby();
    return ok();
  }

  updateSettings(playerId: string, settings: RoomSettings): Result {
    if (playerId !== this.hostId) return err("Only the host can change settings");
    if (this.phase !== "lobby") return err("Settings are locked in game");
    const maxImpostors = Math.max(1, Math.floor((this.settings.maxPlayers - 1) / 2));
    this.settings = {
      ...settings,
      impostorCount: Math.min(settings.impostorCount, maxImpostors),
    };
    this.touch();
    this.broadcastLobby();
    return ok();
  }

  startGame(playerId: string): Result {
    if (playerId !== this.hostId) return err("Only the host can start");
    if (this.phase !== "lobby") return err("Already started");
    const connected = this.playerList.filter((p) => p.connected);
    if (connected.length < MIN_PLAYERS_TO_START) {
      return err(`Need at least ${MIN_PLAYERS_TO_START} players`);
    }
    const notReady = connected.filter((p) => p.id !== this.hostId && !p.ready);
    if (notReady.length > 0) return err("Everyone must be ready");
    this.phase = "starting";
    this.countdownEndsAt = Date.now() + START_COUNTDOWN_SECONDS * 1000;
    this.touch();
    this.emitter.toRoom("game:starting", { countdown: START_COUNTDOWN_SECONDS });
    this.broadcastLobby();
    return ok();
  }

  // ---------------------------------------------------------------- game start

  private beginMatch(): void {
    const now = Date.now();
    this.phase = "playing";
    this.startedAt = new Date();
    this.bodies = [];
    this.meeting.state = null;
    this.sabotage.clearAll(now);
    this.sabotage.resetCooldowns(now);
    this.emergencyAvailableAt = now + EMERGENCY_COOLDOWN_SECONDS * 1000;

    const players = this.playerList;
    const impostorCount = Math.min(
      this.settings.impostorCount,
      Math.max(1, Math.floor((players.length - 1) / 2)),
    );
    // crypto-strength shuffle so clients can't predict roles
    const order = shuffle(players, () => {
      const buf = new Uint32Array(1);
      globalThis.crypto.getRandomValues(buf);
      return (buf[0] ?? 0) / 4294967296;
    });
    this.impostorIds = order.slice(0, impostorCount).map((p) => p.id);

    players.forEach((player) => {
      const spawn = this.gameSpawn(players.indexOf(player), players.length);
      player.resetForGame(spawn);
      player.role = this.impostorIds.includes(player.id) ? "impostor" : "crewmate";
      player.killReadyAt = now + this.settings.killCooldown * 1000;
    });
    this.tasks.assign(players, this.settings);

    for (const player of players) {
      if (player.socketId && player.connected) {
        this.emitter.toPlayer(player.socketId, "game:started", this.startPayloadFor(player));
      }
    }
    this.broadcastLobby();
    this.emitTaskBar();
  }

  private startPayloadFor(player: ServerPlayer): GameStartPayload {
    return {
      role: player.role,
      mates:
        player.role === "impostor"
          ? this.impostorIds.filter((id) => id !== player.id)
          : [],
      tasks: player.tasks,
      settings: this.settings,
      players: this.playerList.map((p) => ({
        id: p.id,
        name: p.name,
        color: p.color,
        hat: p.hat,
      })),
      spawn: { x: player.x, y: player.y },
    };
  }

  // ---------------------------------------------------------------- inputs

  queueInput(playerId: string, input: { seq: number; t: number; moveX: number; moveY: number }): void {
    const player = this.players.get(playerId);
    if (!player) return;
    if (this.phase !== "playing") return;
    if (input.seq <= player.lastSeq) return; // duplicate / replayed packet
    if (input.t < player.lastInputT) return; // out-of-order client timestamp
    const queuedSeq = player.inputQueue[player.inputQueue.length - 1]?.seq ?? player.lastSeq;
    if (input.seq <= queuedSeq) return; // duplicate within the queue
    player.lastInputT = input.t;
    if (player.inputQueue.length >= 60) player.inputQueue.shift();
    player.inputQueue.push(input);
  }

  // ---------------------------------------------------------------- actions

  kill(killerId: string, targetId: string): Result {
    const killer = this.players.get(killerId);
    const target = this.players.get(targetId);
    const now = Date.now();
    if (!killer || !target) return err("Unknown player");
    if (this.phase !== "playing" || this.meeting.active) return err("Cannot kill now");
    if (killer.role !== "impostor") return err("Only impostors can kill");
    if (!killer.alive) return err("You are dead");
    if (killer.inVentId) return err("Cannot kill from a vent");
    if (!target.alive) return err("Target is already dead");
    if (target.role === "impostor") return err("Cannot kill an impostor");
    if (now < killer.killReadyAt) return err("Kill on cooldown");
    const range = KILL_RANGES[this.settings.killRange];
    if (dist(killer.x, killer.y, target.x, target.y) > range) return err("Target out of range");

    target.alive = false;
    target.openTask = null;
    this.sabotage.releaseHolds(target.id);
    this.bodies.push({ id: target.id, playerId: target.id, x: target.x, y: target.y, color: target.color });
    // the killer lunges onto the victim, like the original
    killer.x = target.x;
    killer.y = target.y;
    killer.killReadyAt = now + this.settings.killCooldown * 1000;
    killer.stats.kills += 1;

    const event: GameEvent = {
      type: "playerKilled",
      victimId: target.id,
      killerId: killer.id,
      x: target.x,
      y: target.y,
    };
    if (target.socketId) this.emitter.toPlayer(target.socketId, "game:event", event);
    if (killer.socketId) this.emitter.toPlayer(killer.socketId, "game:event", event);
    this.checkWin();
    return ok();
  }

  report(reporterId: string, bodyId: string): Result {
    const reporter = this.players.get(reporterId);
    if (!reporter) return err("Unknown player");
    if (this.phase !== "playing" || this.meeting.active) return err("Cannot report now");
    if (!reporter.alive) return err("Ghosts cannot report");
    if (reporter.inVentId) return err("Cannot report from a vent");
    const body = this.bodies.find((b) => b.id === bodyId);
    if (!body) return err("No body found");
    if (dist(reporter.x, reporter.y, body.x, body.y) > REPORT_RADIUS) {
      return err("Too far from the body");
    }
    reporter.stats.bodiesReported += 1;
    this.emitEvent({ type: "bodyReported", reporterId, bodyId });
    this.startMeeting(reporterId, bodyId);
    return ok();
  }

  emergency(callerId: string): Result {
    const caller = this.players.get(callerId);
    const now = Date.now();
    if (!caller) return err("Unknown player");
    if (this.phase !== "playing" || this.meeting.active) return err("Cannot call a meeting now");
    if (!caller.alive) return err("Ghosts cannot call meetings");
    if (caller.inVentId) return err("Cannot call from a vent");
    if (this.sabotage.criticalActive) return err("Fix the sabotage first");
    if (caller.emergenciesUsed >= this.settings.emergencyMeetings) {
      return err("No emergency meetings left");
    }
    if (now < this.emergencyAvailableAt) return err("Emergency button is recharging");
    const btn = this.map.emergencyButton;
    if (dist(caller.x, caller.y, btn.x, btn.y) > USE_RADIUS) return err("Not at the button");
    caller.emergenciesUsed += 1;
    caller.stats.emergenciesCalled += 1;
    this.emitEvent({ type: "emergencyCalled", byId: callerId });
    this.startMeeting(callerId, null);
    return ok();
  }

  ventEnter(playerId: string, ventId: string): Result {
    const player = this.players.get(playerId);
    if (!player) return err("Unknown player");
    if (this.phase !== "playing" || this.meeting.active) return err("Cannot vent now");
    if (player.role !== "impostor" || !player.alive) return err("Cannot use vents");
    if (player.inVentId) return err("Already in a vent");
    const vent = ventById(this.map, ventId);
    if (!vent) return err("Unknown vent");
    if (dist(player.x, player.y, vent.x, vent.y) > USE_RADIUS) return err("Too far from vent");
    player.inVentId = ventId;
    player.x = vent.x;
    player.y = vent.y;
    player.inputQueue = [];
    player.openTask = null;
    this.emitVentEvent({ type: "playerVented", playerId, ventId, entered: true });
    return ok();
  }

  ventMove(playerId: string, toVentId: string): Result {
    const player = this.players.get(playerId);
    if (!player || !player.inVentId) return err("Not in a vent");
    if (this.phase !== "playing" || this.meeting.active) return err("Cannot vent now");
    const current = ventById(this.map, player.inVentId);
    const target = ventById(this.map, toVentId);
    if (!current || !target) return err("Unknown vent");
    if (!current.links.includes(toVentId)) return err("Vents are not connected");
    player.inVentId = toVentId;
    player.x = target.x;
    player.y = target.y;
    return ok();
  }

  ventExit(playerId: string): Result {
    const player = this.players.get(playerId);
    if (!player || !player.inVentId) return err("Not in a vent");
    const vent = ventById(this.map, player.inVentId);
    if (!vent) return err("Unknown vent");
    const ventId = player.inVentId;
    player.inVentId = null;
    player.x = vent.x;
    player.y = vent.y;
    this.emitVentEvent({ type: "playerVented", playerId, ventId, entered: false });
    return ok();
  }

  taskOpen(playerId: string, taskId: string): Result {
    const player = this.players.get(playerId);
    if (!player) return err("Unknown player");
    if (this.phase !== "playing" || this.meeting.active) return err("Cannot do tasks now");
    if (player.inVentId) return err("Cannot do tasks from a vent");
    if (this.sabotage.commsDown) return err("Comms are down");
    const result = this.tasks.open(player, taskId, Date.now());
    return result.ok ? ok() : err(result.error);
  }

  taskComplete(playerId: string, taskId: string): Result {
    const player = this.players.get(playerId);
    if (!player) return err("Unknown player");
    if (this.phase !== "playing" || this.meeting.active) return err("Cannot do tasks now");
    const result = this.tasks.complete(player, taskId, Date.now(), this.sabotage.commsDown);
    if (!result.ok) return err(result.error);
    if (player.socketId) {
      this.emitter.toPlayer(player.socketId, "game:taskUpdate", { tasks: player.tasks });
    }
    if (player.role === "crewmate") {
      this.emitTaskBar(this.settings.visualTasks ? result.visual : null);
      this.checkWin();
    }
    return ok();
  }

  taskClose(playerId: string): void {
    const player = this.players.get(playerId);
    if (player) player.openTask = null;
  }

  triggerSabotage(playerId: string, kind: "lights" | "reactor" | "o2" | "comms"): Result {
    const player = this.players.get(playerId);
    if (!player) return err("Unknown player");
    if (this.phase !== "playing" || this.meeting.active) return err("Cannot sabotage now");
    if (player.role !== "impostor") return err("Only impostors can sabotage");
    if (!player.alive) return err("Ghost impostors cannot sabotage");
    const result = this.sabotage.trigger(kind, Date.now());
    if (!result.ok) return err(result.error);
    if (this.sabotage.active) {
      this.emitEvent({ type: "sabotageStarted", sabotage: this.sabotage.active });
    }
    return ok();
  }

  triggerDoorSabotage(playerId: string, roomId: string): Result {
    const player = this.players.get(playerId);
    if (!player) return err("Unknown player");
    if (this.phase !== "playing" || this.meeting.active) return err("Cannot sabotage now");
    if (player.role !== "impostor" || !player.alive) return err("Only impostors can sabotage");
    const now = Date.now();
    const result = this.sabotage.closeDoors(roomId, now);
    if (!result.ok) return err(result.error);
    const doorIds = this.sabotage.closedDoorIds(roomId, now);
    this.emitEvent({ type: "doorsClosed", doorIds, until: now + 10_000 });
    return ok();
  }

  fix(playerId: string, kind: "lights" | "reactor" | "o2" | "comms", panelId: string): Result {
    const player = this.players.get(playerId);
    if (!player) return err("Unknown player");
    if (this.phase !== "playing" || this.meeting.active) return err("Cannot fix now");
    if (!player.alive) return err("Ghosts cannot fix sabotages");
    const result = this.sabotage.fix(player, kind, panelId);
    if (!result.ok) return err(result.error);
    if (result.cleared) {
      this.emitEvent({ type: "sabotageFixed", kind });
    } else if (this.sabotage.active) {
      this.emitEvent({ type: "sabotageProgress", sabotage: this.sabotage.active });
    }
    return ok();
  }

  fixHold(playerId: string, panelId: string, on: boolean): void {
    const player = this.players.get(playerId);
    if (!player || !player.alive) return;
    if (this.phase !== "playing" || this.meeting.active) return;
    const result = this.sabotage.holdReactor(player, panelId, on);
    if (result.cleared) {
      this.emitEvent({ type: "sabotageFixed", kind: "reactor" });
    } else if (this.sabotage.active) {
      this.emitEvent({ type: "sabotageProgress", sabotage: this.sabotage.active });
    }
  }

  vote(voterId: string, targetId: string): Result {
    const voter = this.players.get(voterId);
    if (!voter) return err("Unknown player");
    const result = this.meeting.castVote(voter, targetId, this.playerList);
    if (!result.ok) return err(result.error);
    if (this.meeting.state) {
      this.emitEvent({ type: "meetingUpdate", meeting: this.meeting.state });
    }
    return ok();
  }

  chat(playerId: string, text: string): Result {
    const player = this.players.get(playerId);
    if (!player) return err("Unknown player");
    const channel =
      this.phase === "lobby" || this.phase === "ended"
        ? "lobby"
        : !player.alive
          ? "ghost"
          : this.meeting.active
            ? "meeting"
            : null;
    if (!channel) return err("Chat is only available in meetings");
    const message: ChatMessage = {
      id: randomToken(8),
      channel,
      fromId: player.id,
      fromName: player.name,
      fromColor: player.color,
      text,
      at: Date.now(),
    };
    if (channel === "ghost") {
      for (const p of this.playerList) {
        if (!p.alive && p.socketId && p.connected) {
          this.emitter.toPlayer(p.socketId, "chat:message", message);
        }
      }
    } else {
      this.emitter.toRoom("chat:message", message);
    }
    this.touch();
    return ok();
  }

  // ---------------------------------------------------------------- meetings

  private startMeeting(calledBy: string, reportedBody: string | null): void {
    this.phase = "meeting";
    this.bodies = [];
    this.sabotage.clearAll(Date.now());
    // everyone gathers back at the table, like the original
    const players = this.playerList;
    players.forEach((player, i) => {
      const spawn = this.gameSpawn(i, players.length);
      player.x = spawn.x;
      player.y = spawn.y;
      player.inputQueue = [];
      player.moving = false;
      player.inVentId = null;
      player.openTask = null;
    });
    const state = this.meeting.start(calledBy, reportedBody, Date.now());
    this.emitEvent({ type: "meetingUpdate", meeting: state });
  }

  private endMeeting(): void {
    const now = Date.now();
    this.phase = "playing";
    this.emergencyAvailableAt = now + EMERGENCY_COOLDOWN_SECONDS * 1000;
    for (const player of this.playerList) {
      if (player.role === "impostor") {
        player.killReadyAt = now + this.settings.killCooldown * 1000;
      }
    }
    this.emitEvent({ type: "meetingEnded" });
    this.checkWin();
  }

  // ---------------------------------------------------------------- tick

  private onTick(): void {
    const now = Date.now();
    this.tick += 1;

    if (this.phase === "starting" && now >= this.countdownEndsAt) {
      this.beginMatch();
      return;
    }

    if (this.phase === "ended" && this.endedResetAt !== 0 && now >= this.endedResetAt) {
      this.endedResetAt = 0;
      this.returnToLobby();
      return;
    }

    if (this.phase === "playing") {
      this.simulateMovement();
      if (this.sabotage.tickDoors(now)) {
        // doors reopened; clients learn via snapshot doors array
      }
      if (this.sabotage.meltdownExpired(now)) {
        this.endGame("impostors", "sabotageMeltdown");
        return;
      }
      this.expireDisconnected(now);
    }

    if (this.phase === "meeting") {
      const transition = this.meeting.tick(now, this.playerList, this.settings);
      if (transition !== "none" && this.meeting.state) {
        if (transition === "eject") {
          this.applyEjection();
        }
        this.emitEvent({ type: "meetingUpdate", meeting: this.meeting.state });
      }
      if (transition === "done") {
        this.endMeeting();
      }
      this.expireDisconnected(now);
    }

    if (this.tick % SNAPSHOT_EVERY_TICKS === 0 && (this.phase === "playing" || this.phase === "meeting")) {
      this.broadcastSnapshots(now);
    }
  }

  private simulateMovement(): void {
    const speed = BASE_MOVE_SPEED * this.settings.playerSpeed;
    const dt = 1 / TICK_RATE;
    for (const player of this.players.values()) {
      if (player.inVentId) {
        player.moving = false;
        continue;
      }
      let consumed = 0;
      let moved = false;
      while (player.inputQueue.length > 0 && consumed < MAX_INPUTS_PER_TICK) {
        const input = player.inputQueue.shift();
        if (!input) break;
        consumed += 1;
        player.lastSeq = input.seq;
        const effSpeed = player.alive ? speed : speed * GHOST_SPEED_MULT;
        const next = stepMovement(
          this.grid,
          { x: player.x, y: player.y },
          input,
          effSpeed,
          dt,
          !player.alive, // ghosts pass through walls
        );
        if (next.x !== player.x || next.y !== player.y) moved = true;
        if (input.moveX !== 0) player.facing = input.moveX > 0 ? 1 : -1;
        player.x = next.x;
        player.y = next.y;
      }
      player.moving = moved;
      if (moved) {
        this.tasks.cancelIfMoved(player);
        if (player.alive) this.touch();
      }
    }
  }

  private expireDisconnected(now: number): void {
    for (const player of this.playerList) {
      if (!player.connected && player.disconnectedAt !== null) {
        if (now - player.disconnectedAt > DISCONNECT_GRACE_SECONDS * 1000) {
          this.removePlayer(player.id);
        }
      }
    }
  }

  // ---------------------------------------------------------------- snapshots

  private broadcastSnapshots(now: number): void {
    for (const recipient of this.players.values()) {
      if (!recipient.socketId || !recipient.connected) continue;
      this.emitter.toPlayer(recipient.socketId, "game:snapshot", this.snapshotFor(recipient, now));
    }
  }

  private visionRadius(recipient: ServerPlayer): number {
    if (!recipient.alive) return Number.POSITIVE_INFINITY;
    if (recipient.role === "impostor") {
      return IMPOSTOR_VISION_BASE * this.settings.impostorVision;
    }
    const mult = this.sabotage.lightsOut ? LIGHTS_OUT_VISION_MULT : 1;
    return CREW_VISION_BASE * this.settings.crewVision * mult;
  }

  /**
   * Personalized, vision-culled snapshot. Ghosts are hidden from the living;
   * vented impostors are hidden from crew; players outside ~2x vision are
   * culled server-side so a modified client gains no map-wide wallhack.
   */
  private snapshotFor(recipient: ServerPlayer, now: number): GameSnapshot {
    const cullRadius = this.visionRadius(recipient) * 2;
    const players = this.playerList
      .filter((p) => {
        if (p.id === recipient.id) return true;
        if (!recipient.alive) return true; // ghosts see everyone
        if (!p.alive) return false; // ghosts hidden from the living
        if (p.inVentId && recipient.role !== "impostor") return false;
        if (this.phase === "meeting") return true;
        return dist(recipient.x, recipient.y, p.x, p.y) <= cullRadius;
      })
      .map((p) => ({
        id: p.id,
        x: Math.round(p.x * 10) / 10,
        y: Math.round(p.y * 10) / 10,
        facing: p.facing,
        moving: p.moving,
        alive: p.alive,
        inVent: p.inVentId !== null,
        connected: p.connected,
      }));
    const bodies = this.bodies.filter(
      (b) => !recipient.alive || dist(recipient.x, recipient.y, b.x, b.y) <= cullRadius,
    );
    return {
      tick: this.tick,
      now,
      ackSeq: recipient.lastSeq,
      players,
      bodies,
      sabotage: this.sabotage.active,
      doors: this.sabotage.doors,
      taskBar: this.sabotage.commsDown ? 0 : this.tasks.progress(this.playerList),
      killCooldownAt: recipient.role === "impostor" ? recipient.killReadyAt : 0,
      emergenciesLeft: Math.max(0, this.settings.emergencyMeetings - recipient.emergenciesUsed),
    };
  }

  // ---------------------------------------------------------------- win / end

  private applyEjection(): void {
    const state = this.meeting.state;
    if (!state) return;
    if (state.ejected) {
      const player = this.players.get(state.ejected);
      if (player) {
        player.alive = false;
        player.openTask = null;
        this.sabotage.releaseHolds(player.id);
        this.emitEvent({
          type: "playerEjected",
          playerId: player.id,
          role: this.settings.confirmEjects ? player.role : null,
          remainingImpostors: this.settings.confirmEjects
            ? this.playerList.filter((p) => p.role === "impostor" && p.alive).length
            : null,
        });
      }
    }
  }

  checkWin(): void {
    if (this.phase !== "playing" && this.phase !== "meeting") return;
    const players = this.playerList;
    const aliveImpostors = players.filter((p) => p.role === "impostor" && p.alive).length;
    const aliveCrew = players.filter((p) => p.role === "crewmate" && p.alive).length;
    const impostorsPresent = players.some((p) => p.role === "impostor");
    const crewPresent = players.some((p) => p.role === "crewmate");

    if (this.tasks.allCrewTasksDone(players) && crewPresent) {
      this.endGame("crew", "tasksComplete");
      return;
    }
    if (!impostorsPresent) {
      this.endGame("crew", "impostorQuit");
      return;
    }
    if (!crewPresent) {
      this.endGame("impostors", "crewQuit");
      return;
    }
    if (aliveImpostors === 0) {
      this.endGame("crew", "impostorsEjected");
      return;
    }
    // during a meeting the impostors must wait for the eject to resolve
    if (this.phase === "playing" && aliveImpostors >= aliveCrew) {
      this.endGame("impostors", "impostorsDominate");
    }
  }

  private endGame(winners: Team, reason: WinReason): void {
    if (this.phase === "ended") return;
    this.phase = "ended";
    this.meeting.state = null;
    this.sabotage.clearAll(Date.now());
    const payload: GameOverPayload = {
      winners,
      reason,
      impostorIds: this.impostorIds,
      players: this.playerList.map((p) => ({
        id: p.id,
        name: p.name,
        color: p.color,
        role: p.role,
        alive: p.alive,
      })),
    };
    this.emitter.toRoom("game:over", payload);
    this.endedResetAt = Date.now() + 12_000;

    this.hooks.onGameEnd({
      code: this.code,
      mapId: this.map.id,
      startedAt: this.startedAt,
      endedAt: new Date(),
      winners,
      reason,
      settings: this.settings,
      players: this.playerList.map((p) => ({
        userId: p.userId,
        displayName: p.name,
        color: p.color,
        role: p.role,
        won: (winners === "impostors") === (p.role === "impostor"),
        died: !p.alive,
        kills: p.stats.kills,
        tasksCompleted: p.stats.tasksCompleted,
        bodiesReported: p.stats.bodiesReported,
        emergenciesCalled: p.stats.emergenciesCalled,
        sabotagesFixed: p.stats.sabotagesFixed,
      })),
    });
  }

  private returnToLobby(): void {
    this.phase = "lobby";
    this.bodies = [];
    for (const player of this.playerList) {
      player.ready = false;
      player.alive = true;
      player.role = "crewmate";
      player.inVentId = null;
      player.tasks = [];
      const spawn = this.lobbySpawn(this.playerList.indexOf(player));
      player.x = spawn.x;
      player.y = spawn.y;
    }
    this.broadcastLobby();
  }

  // ---------------------------------------------------------------- helpers

  buildLobbyState(): LobbyState {
    return {
      code: this.code,
      phase: this.phase,
      hostId: this.hostId,
      settings: this.settings,
      players: this.playerList.map((p) => ({
        id: p.id,
        name: p.name,
        color: p.color,
        hat: p.hat,
        isHost: p.id === this.hostId,
        ready: p.ready,
        connected: p.connected,
        authenticated: p.userId !== null,
      })),
      countdown:
        this.phase === "starting"
          ? Math.max(0, Math.ceil((this.countdownEndsAt - Date.now()) / 1000))
          : null,
    };
  }

  broadcastLobby(): void {
    this.emitter.toRoom("room:state", this.buildLobbyState());
  }

  private emitEvent(event: GameEvent): void {
    this.emitter.toRoom("game:event", event);
  }

  /** Vent activity is privileged: only impostors and ghosts learn who vented. */
  private emitVentEvent(event: GameEvent): void {
    for (const p of this.playerList) {
      if ((p.role === "impostor" || !p.alive) && p.socketId && p.connected) {
        this.emitter.toPlayer(p.socketId, "game:event", event);
      }
    }
  }

  private emitTaskBar(visual: { kind: import("@/shared/types").TaskKind; playerId: string } | null = null): void {
    this.emitEvent({
      type: "taskProgress",
      taskBar: this.tasks.progress(this.playerList),
      visual,
    });
  }

  private claimColor(preferred: PlayerColorId): PlayerColorId | null {
    const taken = new Set(this.playerList.map((p) => p.color));
    if (!taken.has(preferred)) return preferred;
    for (const c of PLAYER_COLORS) {
      if (!taken.has(c.id)) return c.id;
    }
    return null;
  }

  private lobbySpawn(index: number): { x: number; y: number } {
    return this.gameSpawn(index, Math.max(1, this.players.size + 1));
  }

  private gameSpawn(index: number, total: number): { x: number; y: number } {
    const { x, y, radius } = this.map.spawn;
    const angle = (index / Math.max(1, total)) * Math.PI * 2 - Math.PI / 2;
    return { x: x + Math.cos(angle) * radius, y: y + Math.sin(angle) * radius + 60 };
  }

  private touch(): void {
    this.lastActivityAt = Date.now();
  }
}
