/**
 * Game-wide tuning constants shared by the authoritative server and the
 * client-side prediction code. Changing a value here changes both sides,
 * which keeps the simulation deterministic.
 */

export const TICK_RATE = 30; // server simulation ticks per second
export const TICK_MS = 1000 / TICK_RATE;
export const SNAPSHOT_RATE = 15; // state broadcasts per second
export const SNAPSHOT_EVERY_TICKS = TICK_RATE / SNAPSHOT_RATE;

export const PLAYER_RADIUS = 15;
export const BASE_MOVE_SPEED = 170; // world units / second at 1.0x
export const GHOST_SPEED_MULT = 1.25;

/** Interpolation delay applied to remote entities for latency smoothing. */
export const INTERP_DELAY_MS = 100;
/** Max inputs the server will consume from one client per tick (burst). */
export const MAX_INPUTS_PER_TICK = 6;
/** Inputs older than this many ms are dropped (replay/dup protection). */
export const INPUT_STALENESS_MS = 2000;

export const USE_RADIUS = 80; // consoles, buttons, vents
export const REPORT_RADIUS = 110;
export const KILL_RANGES = { short: 64, normal: 100, long: 140 } as const;

export const CREW_VISION_BASE = 260;
export const IMPOSTOR_VISION_BASE = 380;
export const LIGHTS_OUT_VISION_MULT = 0.28;

export const MEETING_REVEAL_SECONDS = 6;
export const EJECT_SECONDS = 5;
export const START_COUNTDOWN_SECONDS = 5;
export const EMERGENCY_COOLDOWN_SECONDS = 20;

export const REACTOR_MELTDOWN_SECONDS = 40;
export const O2_DEPLETION_SECONDS = 40;
export const DOOR_CLOSE_SECONDS = 10;
export const SABOTAGE_COOLDOWN_SECONDS = 25;
export const DOOR_SABOTAGE_COOLDOWN_SECONDS = 18;

export const DISCONNECT_GRACE_SECONDS = 60;
export const LOBBY_IDLE_TIMEOUT_MS = 30 * 60 * 1000;

export const MIN_PLAYERS_TO_START = 4;
export const MAX_ROOM_PLAYERS = 15;
export const ROOM_CODE_LENGTH = 6;

export const CHAT_MAX_LENGTH = 160;
export const NAME_MIN_LENGTH = 1;
export const NAME_MAX_LENGTH = 16;

/** Minimum wall-clock ms a task minigame must be open before completion is accepted. */
export const TASK_MIN_DURATION_MS: Record<string, number> = {
  wires: 1200,
  cardSwipe: 600,
  fuelEngine: 2200,
  download: 4000,
  upload: 4000,
  alignEngine: 800,
  unlockManifolds: 2000,
  startReactor: 5000,
  garbage: 1200,
  asteroids: 6000,
};

export const PLAYER_COLORS = [
  { id: "red", name: "Red", hex: "#e2434b", dark: "#8f1e2b" },
  { id: "blue", name: "Blue", hex: "#3151cb", dark: "#1a2e8a" },
  { id: "green", name: "Green", hex: "#1a9160", dark: "#0d5a3a" },
  { id: "pink", name: "Pink", hex: "#ed66bb", dark: "#a83a8a" },
  { id: "orange", name: "Orange", hex: "#ef7d22", dark: "#b3540e" },
  { id: "yellow", name: "Yellow", hex: "#f0e14d", dark: "#b8a92e" },
  { id: "black", name: "Black", hex: "#48494e", dark: "#26272b" },
  { id: "white", name: "White", hex: "#d6dff1", dark: "#8d95a5" },
  { id: "purple", name: "Purple", hex: "#7237c1", dark: "#48207e" },
  { id: "brown", name: "Brown", hex: "#79593a", dark: "#4d3722" },
  { id: "cyan", name: "Cyan", hex: "#41ffdd", dark: "#20a98f" },
  { id: "lime", name: "Lime", hex: "#57ef3a", dark: "#33991f" },
  { id: "maroon", name: "Maroon", hex: "#711e2f", dark: "#48101d" },
  { id: "rose", name: "Rose", hex: "#f1c1d2", dark: "#c58aa2" },
  { id: "banana", name: "Banana", hex: "#f0f2b8", dark: "#c0c283" },
] as const;

export type PlayerColorId = (typeof PLAYER_COLORS)[number]["id"];

export const HATS = [
  { id: "none", name: "None" },
  { id: "halo", name: "Halo" },
  { id: "antenna", name: "Antenna" },
  { id: "tophat", name: "Top Hat" },
  { id: "beanie", name: "Beanie" },
  { id: "crown", name: "Crown" },
  { id: "leaf", name: "Sprout" },
  { id: "horns", name: "Horns" },
  { id: "cap", name: "Ball Cap" },
  { id: "chef", name: "Chef Hat" },
] as const;

export type HatId = (typeof HATS)[number]["id"];

export function colorHex(id: string): string {
  return PLAYER_COLORS.find((c) => c.id === id)?.hex ?? "#e2434b";
}
export function colorDarkHex(id: string): string {
  return PLAYER_COLORS.find((c) => c.id === id)?.dark ?? "#8f1e2b";
}
