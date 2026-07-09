import { TASK_MIN_DURATION_MS, USE_RADIUS } from "@/shared/constants";
import { consoleById, type MapDef } from "@/shared/map/helion";
import { dist } from "@/shared/physics";
import { shuffle } from "@/shared/rng";
import type { RoomSettings, TaskAssignment, TaskKind } from "@/shared/types";
import type { ServerPlayer } from "./ServerPlayer";

export type TaskResult =
  { ok: true; visual: { kind: TaskKind; playerId: string } | null } | { ok: false; error: string };

/**
 * Assigns tasks at game start and validates every open/complete attempt.
 * Impostors receive a plausible fake task list; completing a fake task only
 * updates the impostor's own UI and never counts toward the crew task bar.
 */
export class TaskService {
  constructor(private readonly map: MapDef) {}

  assign(players: ServerPlayer[], settings: RoomSettings): void {
    const commons = this.map.tasks.filter((t) => t.length === "common");
    const shorts = this.map.tasks.filter((t) => t.length === "short");
    const longs = this.map.tasks.filter((t) => t.length === "long");

    // Common tasks are shared: every crewmate gets the same ones.
    const chosenCommons = shuffle(commons).slice(0, settings.commonTasks);

    for (const player of players) {
      const assignments: TaskAssignment[] = [];
      for (const t of chosenCommons) assignments.push(this.toAssignment(t.id));
      for (const t of shuffle(shorts).slice(0, settings.shortTasks)) {
        assignments.push(this.toAssignment(t.id));
      }
      for (const t of shuffle(longs).slice(0, settings.longTasks)) {
        assignments.push(this.toAssignment(t.id));
      }
      player.tasks = assignments;
    }
  }

  private toAssignment(templateId: string): TaskAssignment {
    const template = this.map.tasks.find((t) => t.id === templateId);
    if (!template) throw new Error(`Unknown task template ${templateId}`);
    let consoleIds = template.consoleIds;
    if (template.kind === "wires") {
      // wires panels are completed in a random order per player
      consoleIds = shuffle(consoleIds);
    }
    return {
      id: template.id,
      kind: template.kind,
      length: template.length,
      visual: template.visual,
      consoleIds,
      stage: 0,
      done: false,
    };
  }

  /** The effective minigame kind of a task's current stage (dl/ul differ). */
  stageKind(task: TaskAssignment): TaskKind {
    if (task.kind === "download" && task.stage > 0) return "upload";
    return task.kind;
  }

  open(player: ServerPlayer, taskId: string, now: number): TaskResult {
    const task = player.tasks.find((t) => t.id === taskId);
    if (!task) return { ok: false, error: "No such task" };
    if (task.done) return { ok: false, error: "Task already complete" };
    const consoleId = task.consoleIds[task.stage];
    if (!consoleId) return { ok: false, error: "Task has no active console" };
    const console_ = consoleById(this.map, consoleId);
    if (!console_) return { ok: false, error: "Unknown console" };
    if (dist(player.x, player.y, console_.x, console_.y) > USE_RADIUS) {
      return { ok: false, error: "Too far from console" };
    }
    player.openTask = { taskId, consoleId, openedAt: now, x: player.x, y: player.y };
    return { ok: true, visual: null };
  }

  /**
   * Validates a completion attempt. Enforces: a matching open console, the
   * per-minigame minimum duration (bots can't instant-complete), and that
   * the player hasn't wandered away mid-minigame.
   */
  complete(player: ServerPlayer, taskId: string, now: number, commsDown: boolean): TaskResult {
    const open = player.openTask;
    if (!open || open.taskId !== taskId) return { ok: false, error: "Task not open" };
    const task = player.tasks.find((t) => t.id === taskId);
    if (!task || task.done) return { ok: false, error: "Invalid task" };
    if (commsDown) return { ok: false, error: "Comms are down" };

    const kind = this.stageKind(task);
    const minMs = TASK_MIN_DURATION_MS[kind] ?? 500;
    if (now - open.openedAt < minMs) {
      player.openTask = null;
      return { ok: false, error: "Completed too quickly" };
    }
    if (dist(player.x, player.y, open.x, open.y) > 60) {
      player.openTask = null;
      return { ok: false, error: "Moved away from console" };
    }

    task.stage += 1;
    player.openTask = null;
    if (task.stage >= task.consoleIds.length) {
      task.done = true;
      if (player.role === "crewmate") player.stats.tasksCompleted += 1;
      const visual =
        task.visual && player.role === "crewmate" ? { kind: task.kind, playerId: player.id } : null;
      return { ok: true, visual };
    }
    return { ok: true, visual: null };
  }

  /** Cancels an open minigame when the player moves too far from it. */
  cancelIfMoved(player: ServerPlayer): void {
    const open = player.openTask;
    if (open && dist(player.x, player.y, open.x, open.y) > 60) {
      player.openTask = null;
    }
  }

  /** Global crew progress in [0, 1]. Ghost crew tasks still count. */
  progress(players: ServerPlayer[]): number {
    let total = 0;
    let done = 0;
    for (const p of players) {
      if (p.role !== "crewmate") continue;
      for (const t of p.tasks) {
        total += 1;
        if (t.done) done += 1;
      }
    }
    return total === 0 ? 1 : done / total;
  }

  allCrewTasksDone(players: ServerPlayer[]): boolean {
    let total = 0;
    let done = 0;
    for (const p of players) {
      if (p.role !== "crewmate") continue;
      for (const t of p.tasks) {
        total += 1;
        if (t.done) done += 1;
      }
    }
    return total > 0 && done === total;
  }
}
