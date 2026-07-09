"use client";

import {
  CREW_VISION_BASE,
  IMPOSTOR_VISION_BASE,
  INTERP_DELAY_MS,
  KILL_RANGES,
  LIGHTS_OUT_VISION_MULT,
  BASE_MOVE_SPEED,
  GHOST_SPEED_MULT,
  REPORT_RADIUS,
  TICK_RATE,
  USE_RADIUS,
} from "@/shared/constants";
import { HELION, allFloors, ventById } from "@/shared/map/helion";
import { CollisionGrid, dist, stepMovement } from "@/shared/physics";
import type { DeadBody, GameSnapshot, GameStartPayload, SnapshotPlayer } from "@/shared/types";
import type { GameSocket } from "@/game/net/socket";
import { emitAck } from "@/game/net/socket";
import { inputManager } from "@/game/input/InputManager";
import { soundManager } from "@/game/audio/SoundManager";
import { useGameStore, type ActionContext } from "@/game/store/gameStore";
import { useLobbyStore } from "@/game/store/lobbyStore";

interface InterpEntry {
  t: number;
  x: number;
  y: number;
  facing: number;
  moving: boolean;
  alive: boolean;
  inVent: boolean;
  connected: boolean;
}

export interface RenderPlayer {
  id: string;
  x: number;
  y: number;
  facing: number;
  moving: boolean;
  alive: boolean;
  inVent: boolean;
  connected: boolean;
  isMe: boolean;
}

export interface RenderState {
  meId: string;
  meX: number;
  meY: number;
  meAlive: boolean;
  players: RenderPlayer[];
  bodies: DeadBody[];
  closedDoors: Set<string>;
  vision: number;
  lightsOut: boolean;
}

/**
 * Client-side prediction + entity interpolation over the authoritative
 * snapshots. Local inputs are applied immediately with the same shared
 * physics as the server, then reconciled against `ackSeq`; remote players
 * render ~100 ms in the past for smooth motion regardless of jitter.
 */
export class GameClient {
  readonly map = HELION;
  private grid = new CollisionGrid(this.map.width, this.map.height, this.map.cell, allFloors(this.map));

  private me = { x: 0, y: 0, facing: 1, moving: false };
  private myId = "";
  private amAlive = true;
  private role: "crewmate" | "impostor" = "crewmate";

  private seq = 0;
  private pendingInputs: Array<{ seq: number; moveX: number; moveY: number }> = [];
  private inputAccumulator = 0;
  private lastFrameAt = 0;

  private buffers = new Map<string, InterpEntry[]>();
  private latestSnapshot: GameSnapshot | null = null;
  private clockOffset = 0;
  private clockInitialized = false;
  private closedDoors = new Set<string>();
  private vision = CREW_VISION_BASE;
  private contextThrottle = 0;
  private disposers: Array<() => void> = [];

  constructor(private readonly socket: GameSocket) {}

  start(payload: GameStartPayload, myId: string): void {
    this.myId = myId;
    this.role = payload.role;
    this.amAlive = true;
    this.me = { x: payload.spawn.x, y: payload.spawn.y, facing: 1, moving: false };
    this.seq = 0;
    this.pendingInputs = [];
    this.buffers.clear();
    this.latestSnapshot = null;
    this.clockInitialized = false;
    for (const id of this.closedDoors) {
      const door = this.map.doors.find((d) => d.id === id);
      if (door) this.grid.setBlocked(this.grid.cellsForRect(door.rect), false);
    }
    this.closedDoors.clear();
    this.bindSnapshotHandler();
  }

  private bindSnapshotHandler(): void {
    this.dispose();
    const onSnapshot = (snapshot: GameSnapshot) => this.onSnapshot(snapshot);
    this.socket.on("game:snapshot", onSnapshot);
    this.disposers.push(() => this.socket.off("game:snapshot", onSnapshot));
  }

  dispose(): void {
    for (const d of this.disposers) d();
    this.disposers = [];
  }

  get serverNow(): number {
    return Date.now() + this.clockOffset;
  }

  // ------------------------------------------------------------- snapshots

  private onSnapshot(snapshot: GameSnapshot): void {
    this.latestSnapshot = snapshot;

    // clock sync: exponential smoothing avoids jumps from jittery packets
    const sample = snapshot.now - Date.now();
    if (!this.clockInitialized) {
      this.clockOffset = sample;
      this.clockInitialized = true;
    } else {
      this.clockOffset += (sample - this.clockOffset) * 0.1;
    }

    // door diff -> collision grid (prediction stays honest about doors)
    const nowClosed = new Set(
      snapshot.doors.filter((d) => d.closedUntil > snapshot.now).map((d) => d.id),
    );
    for (const id of nowClosed) {
      if (!this.closedDoors.has(id)) {
        const door = this.map.doors.find((d) => d.id === id);
        if (door) this.grid.setBlocked(this.grid.cellsForRect(door.rect), true);
      }
    }
    for (const id of this.closedDoors) {
      if (!nowClosed.has(id)) {
        const door = this.map.doors.find((d) => d.id === id);
        if (door) this.grid.setBlocked(this.grid.cellsForRect(door.rect), false);
      }
    }
    this.closedDoors = nowClosed;

    // remote interpolation buffers
    for (const p of snapshot.players) {
      if (p.id === this.myId) {
        this.reconcile(p, snapshot.ackSeq);
        continue;
      }
      let buffer = this.buffers.get(p.id);
      if (!buffer) {
        buffer = [];
        this.buffers.set(p.id, buffer);
      }
      buffer.push({
        t: snapshot.now,
        x: p.x,
        y: p.y,
        facing: p.facing,
        moving: p.moving,
        alive: p.alive,
        inVent: p.inVent,
        connected: p.connected,
      });
      while (buffer.length > 30) buffer.shift();
    }
    // prune buffers of players no longer visible
    const visible = new Set(snapshot.players.map((p) => p.id));
    for (const id of this.buffers.keys()) {
      if (!visible.has(id)) this.buffers.delete(id);
    }

    const store = useGameStore.getState();
    store.setSnapshotState(snapshot);
    const meSnap = snapshot.players.find((p) => p.id === this.myId);
    if (meSnap && meSnap.alive !== this.amAlive) {
      this.amAlive = meSnap.alive;
      store.setAmDead(!meSnap.alive);
    }
  }

  /** Server position + replay of unacknowledged inputs = corrected prediction. */
  private reconcile(serverMe: SnapshotPlayer, ackSeq: number): void {
    this.pendingInputs = this.pendingInputs.filter((i) => i.seq > ackSeq);
    if (useGameStore.getState().inVentId) {
      this.me.x = serverMe.x;
      this.me.y = serverMe.y;
      return;
    }
    let pos = { x: serverMe.x, y: serverMe.y };
    const speed = this.currentSpeed();
    for (const input of this.pendingInputs) {
      pos = stepMovement(this.grid, pos, input, speed, 1 / TICK_RATE, !this.amAlive);
    }
    // snap only when the correction is meaningful; avoids micro-jitter
    if (dist(pos.x, pos.y, this.me.x, this.me.y) > 0.5) {
      this.me.x = pos.x;
      this.me.y = pos.y;
    }
  }

  private currentSpeed(): number {
    const settings = useGameStore.getState().settings;
    const base = BASE_MOVE_SPEED * settings.playerSpeed;
    return this.amAlive ? base : base * GHOST_SPEED_MULT;
  }

  // ------------------------------------------------------------- frame

  /** Called once per animation frame by the canvas component. */
  update(nowMs: number): void {
    if (this.lastFrameAt === 0) this.lastFrameAt = nowMs;
    const dt = Math.min(0.1, (nowMs - this.lastFrameAt) / 1000);
    this.lastFrameAt = nowMs;

    this.inputAccumulator += dt;
    const inputInterval = 1 / TICK_RATE;
    while (this.inputAccumulator >= inputInterval) {
      this.inputAccumulator -= inputInterval;
      this.sampleInput();
    }

    // smooth vision changes (lights sabotage fading in/out)
    const store = useGameStore.getState();
    const settings = store.settings;
    let target: number;
    if (!this.amAlive) {
      target = CREW_VISION_BASE * 2.2;
    } else if (this.role === "impostor") {
      target = IMPOSTOR_VISION_BASE * settings.impostorVision;
    } else {
      const mult = store.sabotage?.kind === "lights" ? LIGHTS_OUT_VISION_MULT : 1;
      target = CREW_VISION_BASE * settings.crewVision * mult;
    }
    this.vision += (target - this.vision) * Math.min(1, dt * 4);

    this.contextThrottle += dt;
    if (this.contextThrottle > 0.12) {
      this.contextThrottle = 0;
      this.computeContext();
    }
  }

  private movementLocked(): boolean {
    const store = useGameStore.getState();
    return (
      !store.inGame ||
      store.meeting !== null ||
      store.gameOver !== null ||
      store.openPanel !== null ||
      store.inVentId !== null
    );
  }

  private sampleInput(): void {
    if (this.movementLocked()) {
      this.me.moving = false;
      return;
    }
    const vec = inputManager.getMoveVector();
    if (vec.x === 0 && vec.y === 0) {
      this.me.moving = false;
      return;
    }
    this.seq += 1;
    const input = { seq: this.seq, t: Date.now(), moveX: vec.x, moveY: vec.y };
    this.pendingInputs.push(input);
    if (this.pendingInputs.length > 120) this.pendingInputs.shift();
    this.socket.emit("game:input", input);

    const next = stepMovement(this.grid, this.me, input, this.currentSpeed(), 1 / TICK_RATE, !this.amAlive);
    this.me.moving = next.x !== this.me.x || next.y !== this.me.y;
    if (vec.x !== 0) this.me.facing = vec.x > 0 ? 1 : -1;
    this.me.x = next.x;
    this.me.y = next.y;
    if (this.me.moving && this.amAlive) soundManager.play("footstep");
  }

  // ------------------------------------------------------------- context

  /** Determines which HUD actions are currently possible (client-side hint;
   *  the server re-validates everything). */
  private computeContext(): void {
    const store = useGameStore.getState();
    if (!store.inGame || store.meeting || store.gameOver) {
      store.setContext({ useTarget: null, ventId: null, killTargetId: null, reportBodyId: null });
      return;
    }
    const { x, y } = this.me;
    const context: ActionContext = {
      useTarget: null,
      ventId: null,
      killTargetId: null,
      reportBodyId: null,
    };

    // nearest actionable task console
    let bestDist = USE_RADIUS;
    for (const task of store.tasks) {
      if (task.done) continue;
      const consoleId = task.consoleIds[task.stage];
      if (!consoleId) continue;
      const c = this.map.consoles.find((k) => k.id === consoleId);
      if (!c) continue;
      const d = dist(x, y, c.x, c.y);
      if (d < bestDist) {
        bestDist = d;
        context.useTarget = { type: "task", taskId: task.id, label: c.label };
      }
    }

    // sabotage fix panels take priority over tasks
    if (store.sabotage && this.amAlive) {
      const kind = store.sabotage.kind;
      for (const c of this.map.consoles) {
        if (c.kind !== kind) continue;
        if (kind === "o2" && store.sabotage.fixed[c.id]) continue;
        if (dist(x, y, c.x, c.y) <= USE_RADIUS) {
          context.useTarget = { type: "fix", kind, panelId: c.id, label: c.label };
          break;
        }
      }
    }

    if (this.amAlive && !store.sabotage) {
      const btn = this.map.emergencyButton;
      if (dist(x, y, btn.x, btn.y) <= USE_RADIUS && !context.useTarget) {
        context.useTarget = { type: "emergency" };
      }
    }
    const adminTable = this.map.consoles.find((c) => c.id === "device-admin-map");
    if (adminTable && dist(x, y, adminTable.x, adminTable.y) <= USE_RADIUS && !context.useTarget) {
      context.useTarget = { type: "admin" };
    }
    const camConsole = this.map.consoles.find((c) => c.id === "device-cameras");
    if (camConsole && dist(x, y, camConsole.x, camConsole.y) <= USE_RADIUS && !context.useTarget) {
      context.useTarget = { type: "cameras" };
    }

    if (this.role === "impostor" && this.amAlive) {
      for (const vent of this.map.vents) {
        if (dist(x, y, vent.x, vent.y) <= USE_RADIUS) {
          context.ventId = vent.id;
          break;
        }
      }
      // nearest kill target among interpolated remote players
      const range = KILL_RANGES[store.settings.killRange];
      let best = range;
      for (const [id, buffer] of this.buffers) {
        if (store.mates.includes(id)) continue;
        const last = buffer[buffer.length - 1];
        if (!last || !last.alive || last.inVent) continue;
        const d = dist(x, y, last.x, last.y);
        if (d < best) {
          best = d;
          context.killTargetId = id;
        }
      }
    }

    if (this.amAlive && this.latestSnapshot) {
      let bestBody = REPORT_RADIUS;
      for (const body of this.latestSnapshot.bodies) {
        const d = dist(x, y, body.x, body.y);
        if (d < bestBody) {
          bestBody = d;
          context.reportBodyId = body.id;
        }
      }
    }

    const prev = store.context;
    if (JSON.stringify(prev) !== JSON.stringify(context)) {
      store.setContext(context);
    }
  }

  // ------------------------------------------------------------- actions

  async useAction(): Promise<void> {
    const store = useGameStore.getState();
    const target = store.context.useTarget;
    if (!target) return;
    soundManager.play("click");
    if (target.type === "task") {
      const task = store.tasks.find((t) => t.id === target.taskId);
      if (!task) return;
      const res = await emitAck(this.socket, "game:taskOpen", { taskId: task.id });
      if (res.ok) {
        store.setOpenPanel({ type: "task", taskId: task.id, kind: this.stageKind(task.id) });
      }
    } else if (target.type === "fix") {
      store.setOpenPanel({ type: "fix", kind: target.kind, panelId: target.panelId });
    } else if (target.type === "emergency") {
      await emitAck(this.socket, "game:emergency");
    } else if (target.type === "admin") {
      store.setOpenPanel({ type: "admin" });
    } else if (target.type === "cameras") {
      store.setOpenPanel({ type: "cameras" });
    }
  }

  private stageKind(taskId: string): import("@/shared/types").TaskKind {
    const task = useGameStore.getState().tasks.find((t) => t.id === taskId);
    if (!task) return "wires";
    if (task.kind === "download" && task.stage > 0) return "upload";
    return task.kind;
  }

  async killAction(): Promise<void> {
    const targetId = useGameStore.getState().context.killTargetId;
    if (!targetId) return;
    const res = await emitAck(this.socket, "game:kill", { targetId });
    if (res.ok) soundManager.play("kill");
  }

  async reportAction(): Promise<void> {
    const bodyId = useGameStore.getState().context.reportBodyId;
    if (!bodyId) return;
    await emitAck(this.socket, "game:report", { bodyId });
  }

  async ventAction(): Promise<void> {
    const store = useGameStore.getState();
    if (store.inVentId) {
      const res = await emitAck(this.socket, "game:ventExit");
      if (res.ok) {
        store.setInVent(null);
        soundManager.play("vent");
      }
      return;
    }
    const ventId = store.context.ventId;
    if (!ventId) return;
    const res = await emitAck(this.socket, "game:ventEnter", { ventId });
    if (res.ok) {
      store.setInVent(ventId);
      soundManager.play("vent");
      const vent = ventById(this.map, ventId);
      if (vent) {
        this.me.x = vent.x;
        this.me.y = vent.y;
      }
    }
  }

  async ventMoveTo(toVentId: string): Promise<void> {
    const store = useGameStore.getState();
    if (!store.inVentId) return;
    const res = await emitAck(this.socket, "game:ventMove", { toVentId });
    if (res.ok) {
      store.setInVent(toVentId);
      soundManager.play("vent");
      const vent = ventById(this.map, toVentId);
      if (vent) {
        this.me.x = vent.x;
        this.me.y = vent.y;
      }
    }
  }

  // ------------------------------------------------------------- render state

  getRenderState(): RenderState {
    const renderTime = this.serverNow - INTERP_DELAY_MS;
    const players: RenderPlayer[] = [];
    for (const [id, buffer] of this.buffers) {
      const interpolated = this.sampleBuffer(buffer, renderTime);
      if (interpolated) players.push({ id, isMe: false, ...interpolated });
    }
    players.push({
      id: this.myId,
      x: this.me.x,
      y: this.me.y,
      facing: this.me.facing,
      moving: this.me.moving,
      alive: this.amAlive,
      inVent: useGameStore.getState().inVentId !== null,
      connected: true,
      isMe: true,
    });
    return {
      meId: this.myId,
      meX: this.me.x,
      meY: this.me.y,
      meAlive: this.amAlive,
      players,
      bodies: this.latestSnapshot?.bodies ?? [],
      closedDoors: this.closedDoors,
      vision: this.vision,
      lightsOut: useGameStore.getState().sabotage?.kind === "lights",
    };
  }

  private sampleBuffer(
    buffer: InterpEntry[],
    t: number,
  ): Omit<InterpEntry, "t"> | null {
    if (buffer.length === 0) return null;
    const first = buffer[0];
    const last = buffer[buffer.length - 1];
    if (!first || !last) return null;
    if (t <= first.t) return first;
    if (t >= last.t) return last;
    for (let i = 0; i < buffer.length - 1; i++) {
      const a = buffer[i];
      const b = buffer[i + 1];
      if (!a || !b) continue;
      if (t >= a.t && t <= b.t) {
        const span = b.t - a.t;
        const alpha = span <= 0 ? 1 : (t - a.t) / span;
        return {
          x: a.x + (b.x - a.x) * alpha,
          y: a.y + (b.y - a.y) * alpha,
          facing: b.facing,
          moving: b.moving,
          alive: b.alive,
          inVent: b.inVent,
          connected: b.connected,
        };
      }
    }
    return last;
  }

  get myPosition(): { x: number; y: number } {
    return { x: this.me.x, y: this.me.y };
  }
}

let activeClient: GameClient | null = null;

export function createGameClient(socket: GameSocket): GameClient {
  activeClient?.dispose();
  activeClient = new GameClient(socket);
  return activeClient;
}

export function getGameClient(): GameClient | null {
  return activeClient;
}

export function getMyPlayerId(): string {
  return useLobbyStore.getState().myPlayerId ?? "";
}
