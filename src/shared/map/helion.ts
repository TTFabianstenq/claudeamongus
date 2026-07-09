import type { Rect } from "../physics";
import type { SabotageKind, TaskKind, TaskLength } from "../types";

/**
 * "HSS Helion" — an original map layout inspired by the classic
 * cross-shaped ship. All geometry is hand-authored vector data; the
 * renderer draws everything procedurally so no external assets exist.
 *
 * Coordinates are world units (roughly pixels at zoom 1). The walkable
 * area is the union of every `floors` rect; walls are simply the absence
 * of floor. Doorways are formed by connector rects between rooms.
 */

export interface MapRoom {
  id: string;
  name: string;
  rect: Rect;
  /** floor tint used by the renderer */
  tint: string;
  /** true when the impostor "doors" sabotage can seal this room */
  sealable: boolean;
}

export interface MapDoor {
  id: string;
  roomId: string;
  rect: Rect;
  /** door rendering orientation */
  vertical: boolean;
}

export interface MapVent {
  id: string;
  roomId: string;
  x: number;
  y: number;
  links: string[];
}

export interface MapConsole {
  id: string;
  kind: TaskKind | "emergency" | "admin" | "cameras" | SabotageKind;
  roomId: string;
  x: number;
  y: number;
  /** label shown when highlighted */
  label: string;
}

export interface MapCamera {
  id: string;
  x: number;
  y: number;
  label: string;
}

export interface TaskTemplate {
  id: string;
  kind: TaskKind;
  length: TaskLength;
  visual: boolean;
  name: string;
  /** ordered console ids the task walks through */
  consoleIds: string[];
}

export interface MapDef {
  id: string;
  name: string;
  width: number;
  height: number;
  cell: number;
  rooms: MapRoom[];
  corridors: Rect[];
  doors: MapDoor[];
  vents: MapVent[];
  consoles: MapConsole[];
  cameras: MapCamera[];
  tasks: TaskTemplate[];
  spawn: { x: number; y: number; radius: number };
  emergencyButton: { x: number; y: number };
}

const rooms: MapRoom[] = [
  {
    id: "upperEngine",
    name: "Upper Engine",
    rect: { x: 120, y: 120, w: 280, h: 240 },
    tint: "#2b3550",
    sealable: true,
  },
  {
    id: "reactor",
    name: "Reactor",
    rect: { x: 60, y: 520, w: 220, h: 340 },
    tint: "#33294d",
    sealable: false,
  },
  {
    id: "lowerEngine",
    name: "Lower Engine",
    rect: { x: 120, y: 1040, w: 280, h: 240 },
    tint: "#2b3550",
    sealable: true,
  },
  {
    id: "security",
    name: "Security",
    rect: { x: 500, y: 560, w: 200, h: 240 },
    tint: "#2e3b44",
    sealable: true,
  },
  {
    id: "medbay",
    name: "MedBay",
    rect: { x: 640, y: 340, w: 240, h: 200 },
    tint: "#27424a",
    sealable: true,
  },
  {
    id: "electrical",
    name: "Electrical",
    rect: { x: 620, y: 880, w: 260, h: 220 },
    tint: "#453a26",
    sealable: true,
  },
  {
    id: "cafeteria",
    name: "Cafeteria",
    rect: { x: 980, y: 100, w: 440, h: 400 },
    tint: "#39404f",
    sealable: true,
  },
  {
    id: "storage",
    name: "Storage",
    rect: { x: 1020, y: 860, w: 280, h: 340 },
    tint: "#3d3a30",
    sealable: true,
  },
  {
    id: "admin",
    name: "Admin",
    rect: { x: 1380, y: 640, w: 260, h: 200 },
    tint: "#40323f",
    sealable: false,
  },
  {
    id: "o2",
    name: "O2",
    rect: { x: 1560, y: 420, w: 200, h: 160 },
    tint: "#2c443a",
    sealable: false,
  },
  {
    id: "weapons",
    name: "Weapons",
    rect: { x: 1620, y: 120, w: 260, h: 220 },
    tint: "#42303a",
    sealable: false,
  },
  {
    id: "navigation",
    name: "Navigation",
    rect: { x: 2040, y: 500, w: 200, h: 240 },
    tint: "#2e3d55",
    sealable: false,
  },
  {
    id: "shields",
    name: "Shields",
    rect: { x: 1620, y: 900, w: 240, h: 220 },
    tint: "#2f4438",
    sealable: false,
  },
  {
    id: "comms",
    name: "Communications",
    rect: { x: 1340, y: 1220, w: 260, h: 160 },
    tint: "#463327",
    sealable: false,
  },
];

const corridors: Rect[] = [
  // west spine: upper engine <-> lower engine
  { x: 300, y: 360, w: 100, h: 680 },
  // reactor doorway stub
  { x: 280, y: 660, w: 20, h: 80 },
  // security connector
  { x: 400, y: 640, w: 100, h: 100 },
  // north-west corridor: upper engine <-> cafeteria
  { x: 400, y: 200, w: 580, h: 100 },
  // medbay doorway stub
  { x: 740, y: 300, w: 80, h: 40 },
  // south-west corridor: lower engine <-> storage
  { x: 400, y: 1120, w: 620, h: 100 },
  // electrical doorway stub
  { x: 700, y: 1100, w: 80, h: 20 },
  // mid spine: cafeteria <-> storage
  { x: 1120, y: 500, w: 100, h: 360 },
  // admin west connector
  { x: 1220, y: 700, w: 160, h: 100 },
  // cafeteria <-> weapons corridor
  { x: 1420, y: 220, w: 200, h: 80 },
  // weapons <-> o2/nav corridor (vertical)
  { x: 1700, y: 340, w: 120, h: 140 },
  // east corridor to navigation
  { x: 1760, y: 480, w: 280, h: 100 },
  // east spine down from nav corridor
  { x: 1900, y: 580, w: 100, h: 260 },
  // south-east corridor toward shields
  { x: 1760, y: 740, w: 140, h: 100 },
  // shields doorway stub
  { x: 1760, y: 840, w: 100, h: 60 },
  // admin east connector
  { x: 1640, y: 700, w: 120, h: 100 },
  // storage <-> shields corridor
  { x: 1300, y: 1060, w: 320, h: 100 },
  // comms doorway stub
  { x: 1440, y: 1160, w: 80, h: 60 },
];

const doors: MapDoor[] = [
  {
    id: "door-cafe-west",
    roomId: "cafeteria",
    rect: { x: 920, y: 200, w: 60, h: 100 },
    vertical: true,
  },
  {
    id: "door-cafe-south",
    roomId: "cafeteria",
    rect: { x: 1120, y: 500, w: 100, h: 60 },
    vertical: false,
  },
  {
    id: "door-cafe-east",
    roomId: "cafeteria",
    rect: { x: 1420, y: 220, w: 60, h: 80 },
    vertical: true,
  },
  {
    id: "door-storage",
    roomId: "storage",
    rect: { x: 1120, y: 800, w: 100, h: 60 },
    vertical: false,
  },
  {
    id: "door-upper-engine",
    roomId: "upperEngine",
    rect: { x: 300, y: 360, w: 100, h: 60 },
    vertical: false,
  },
  {
    id: "door-lower-engine",
    roomId: "lowerEngine",
    rect: { x: 300, y: 980, w: 100, h: 60 },
    vertical: false,
  },
  {
    id: "door-electrical",
    roomId: "electrical",
    rect: { x: 700, y: 1100, w: 80, h: 20 },
    vertical: false,
  },
  { id: "door-medbay", roomId: "medbay", rect: { x: 740, y: 300, w: 80, h: 40 }, vertical: false },
  {
    id: "door-security",
    roomId: "security",
    rect: { x: 440, y: 640, w: 40, h: 100 },
    vertical: true,
  },
];

const vents: MapVent[] = [
  { id: "vent-reactor-a", roomId: "reactor", x: 120, y: 600, links: ["vent-upper-engine"] },
  { id: "vent-upper-engine", roomId: "upperEngine", x: 340, y: 200, links: ["vent-reactor-a"] },
  { id: "vent-reactor-b", roomId: "reactor", x: 120, y: 800, links: ["vent-lower-engine"] },
  { id: "vent-lower-engine", roomId: "lowerEngine", x: 340, y: 1200, links: ["vent-reactor-b"] },
  {
    id: "vent-medbay",
    roomId: "medbay",
    x: 690,
    y: 500,
    links: ["vent-electrical", "vent-security"],
  },
  {
    id: "vent-electrical",
    roomId: "electrical",
    x: 660,
    y: 930,
    links: ["vent-medbay", "vent-security"],
  },
  {
    id: "vent-security",
    roomId: "security",
    x: 560,
    y: 760,
    links: ["vent-medbay", "vent-electrical"],
  },
  { id: "vent-cafeteria", roomId: "cafeteria", x: 1380, y: 460, links: ["vent-admin"] },
  { id: "vent-admin", roomId: "admin", x: 1600, y: 800, links: ["vent-cafeteria"] },
  {
    id: "vent-weapons",
    roomId: "weapons",
    x: 1840,
    y: 170,
    links: ["vent-navigation", "vent-shields"],
  },
  {
    id: "vent-navigation",
    roomId: "navigation",
    x: 2200,
    y: 700,
    links: ["vent-weapons", "vent-shields"],
  },
  {
    id: "vent-shields",
    roomId: "shields",
    x: 1820,
    y: 1080,
    links: ["vent-weapons", "vent-navigation"],
  },
];

const consoles: MapConsole[] = [
  // wires panels (a wires task chains three of these)
  {
    id: "wires-electrical",
    kind: "wires",
    roomId: "electrical",
    x: 700,
    y: 910,
    label: "Fix Wiring",
  },
  { id: "wires-storage", kind: "wires", roomId: "storage", x: 1090, y: 900, label: "Fix Wiring" },
  { id: "wires-security", kind: "wires", roomId: "security", x: 540, y: 600, label: "Fix Wiring" },
  {
    id: "wires-cafeteria",
    kind: "wires",
    roomId: "cafeteria",
    x: 1010,
    y: 150,
    label: "Fix Wiring",
  },
  {
    id: "wires-navigation",
    kind: "wires",
    roomId: "navigation",
    x: 2090,
    y: 540,
    label: "Fix Wiring",
  },
  // admin card swipe
  { id: "swipe-admin", kind: "cardSwipe", roomId: "admin", x: 1430, y: 700, label: "Swipe Card" },
  // fuel: pick up at storage, deliver to an engine
  {
    id: "fuel-storage",
    kind: "fuelEngine",
    roomId: "storage",
    x: 1060,
    y: 1150,
    label: "Get Fuel",
  },
  {
    id: "fuel-upper",
    kind: "fuelEngine",
    roomId: "upperEngine",
    x: 160,
    y: 320,
    label: "Fuel Engine",
  },
  {
    id: "fuel-lower",
    kind: "fuelEngine",
    roomId: "lowerEngine",
    x: 160,
    y: 1080,
    label: "Fuel Engine",
  },
  // download / upload
  {
    id: "dl-electrical",
    kind: "download",
    roomId: "electrical",
    x: 840,
    y: 910,
    label: "Download Data",
  },
  {
    id: "dl-weapons",
    kind: "download",
    roomId: "weapons",
    x: 1660,
    y: 150,
    label: "Download Data",
  },
  {
    id: "dl-navigation",
    kind: "download",
    roomId: "navigation",
    x: 2200,
    y: 540,
    label: "Download Data",
  },
  { id: "dl-comms", kind: "download", roomId: "comms", x: 1380, y: 1260, label: "Download Data" },
  {
    id: "dl-cafeteria",
    kind: "download",
    roomId: "cafeteria",
    x: 1010,
    y: 460,
    label: "Download Data",
  },
  { id: "ul-admin", kind: "upload", roomId: "admin", x: 1600, y: 680, label: "Upload Data" },
  // align engine
  {
    id: "align-upper",
    kind: "alignEngine",
    roomId: "upperEngine",
    x: 370,
    y: 150,
    label: "Align Engine",
  },
  {
    id: "align-lower",
    kind: "alignEngine",
    roomId: "lowerEngine",
    x: 370,
    y: 1250,
    label: "Align Engine",
  },
  // reactor
  {
    id: "manifolds-reactor",
    kind: "unlockManifolds",
    roomId: "reactor",
    x: 210,
    y: 560,
    label: "Unlock Manifolds",
  },
  {
    id: "simon-reactor",
    kind: "startReactor",
    roomId: "reactor",
    x: 100,
    y: 700,
    label: "Start Reactor",
  },
  // garbage: cafeteria chute then storage chute (visual at storage)
  {
    id: "garbage-cafeteria",
    kind: "garbage",
    roomId: "cafeteria",
    x: 1390,
    y: 150,
    label: "Empty Garbage",
  },
  {
    id: "garbage-storage",
    kind: "garbage",
    roomId: "storage",
    x: 1260,
    y: 1170,
    label: "Empty Chute",
  },
  // asteroids (visual)
  {
    id: "asteroids-weapons",
    kind: "asteroids",
    roomId: "weapons",
    x: 1770,
    y: 200,
    label: "Clear Asteroids",
  },
  // devices
  { id: "device-admin-map", kind: "admin", roomId: "admin", x: 1540, y: 780, label: "Admin Table" },
  {
    id: "device-cameras",
    kind: "cameras",
    roomId: "security",
    x: 610,
    y: 690,
    label: "Security Cams",
  },
  // sabotage fix panels
  {
    id: "fix-lights",
    kind: "lights",
    roomId: "electrical",
    x: 760,
    y: 1060,
    label: "Restore Lights",
  },
  {
    id: "fix-reactor-a",
    kind: "reactor",
    roomId: "reactor",
    x: 100,
    y: 560,
    label: "Hold Scanner",
  },
  {
    id: "fix-reactor-b",
    kind: "reactor",
    roomId: "reactor",
    x: 100,
    y: 830,
    label: "Hold Scanner",
  },
  { id: "fix-o2-a", kind: "o2", roomId: "o2", x: 1620, y: 460, label: "O2 Keypad" },
  { id: "fix-o2-b", kind: "o2", roomId: "admin", x: 1610, y: 810, label: "O2 Keypad" },
  { id: "fix-comms", kind: "comms", roomId: "comms", x: 1470, y: 1300, label: "Retune Comms" },
];

const cameras: MapCamera[] = [
  { id: "cam-west", x: 350, y: 700, label: "West Spine" },
  { id: "cam-north", x: 700, y: 250, label: "North Hall" },
  { id: "cam-mid", x: 1170, y: 540, label: "Mid Hall" },
  { id: "cam-east", x: 1950, y: 530, label: "Nav Hall" },
];

const tasks: TaskTemplate[] = [
  {
    id: "task-swipe",
    kind: "cardSwipe",
    length: "common",
    visual: false,
    name: "Admin: Swipe Card",
    consoleIds: ["swipe-admin"],
  },
  {
    id: "task-wires-1",
    kind: "wires",
    length: "common",
    visual: false,
    name: "Fix Wiring",
    consoleIds: ["wires-electrical", "wires-storage", "wires-navigation"],
  },
  {
    id: "task-wires-2",
    kind: "wires",
    length: "short",
    visual: false,
    name: "Fix Wiring",
    consoleIds: ["wires-security", "wires-cafeteria", "wires-electrical"],
  },
  {
    id: "task-align-upper",
    kind: "alignEngine",
    length: "short",
    visual: false,
    name: "Upper Engine: Align Output",
    consoleIds: ["align-upper"],
  },
  {
    id: "task-align-lower",
    kind: "alignEngine",
    length: "short",
    visual: false,
    name: "Lower Engine: Align Output",
    consoleIds: ["align-lower"],
  },
  {
    id: "task-manifolds",
    kind: "unlockManifolds",
    length: "short",
    visual: false,
    name: "Reactor: Unlock Manifolds",
    consoleIds: ["manifolds-reactor"],
  },
  {
    id: "task-garbage",
    kind: "garbage",
    length: "short",
    visual: true,
    name: "Empty the Garbage",
    consoleIds: ["garbage-cafeteria", "garbage-storage"],
  },
  {
    id: "task-dl-electrical",
    kind: "download",
    length: "short",
    visual: false,
    name: "Electrical: Download Data",
    consoleIds: ["dl-electrical", "ul-admin"],
  },
  {
    id: "task-dl-weapons",
    kind: "download",
    length: "short",
    visual: false,
    name: "Weapons: Download Data",
    consoleIds: ["dl-weapons", "ul-admin"],
  },
  {
    id: "task-dl-nav",
    kind: "download",
    length: "short",
    visual: false,
    name: "Navigation: Download Data",
    consoleIds: ["dl-navigation", "ul-admin"],
  },
  {
    id: "task-dl-comms",
    kind: "download",
    length: "short",
    visual: false,
    name: "Comms: Download Data",
    consoleIds: ["dl-comms", "ul-admin"],
  },
  {
    id: "task-dl-cafeteria",
    kind: "download",
    length: "short",
    visual: false,
    name: "Cafeteria: Download Data",
    consoleIds: ["dl-cafeteria", "ul-admin"],
  },
  {
    id: "task-fuel-upper",
    kind: "fuelEngine",
    length: "long",
    visual: false,
    name: "Fuel the Upper Engine",
    consoleIds: ["fuel-storage", "fuel-upper"],
  },
  {
    id: "task-fuel-lower",
    kind: "fuelEngine",
    length: "long",
    visual: false,
    name: "Fuel the Lower Engine",
    consoleIds: ["fuel-storage", "fuel-lower"],
  },
  {
    id: "task-simon",
    kind: "startReactor",
    length: "long",
    visual: false,
    name: "Reactor: Start Sequence",
    consoleIds: ["simon-reactor"],
  },
  {
    id: "task-asteroids",
    kind: "asteroids",
    length: "long",
    visual: true,
    name: "Weapons: Clear Asteroids",
    consoleIds: ["asteroids-weapons"],
  },
];

export const HELION: MapDef = {
  id: "helion",
  name: "HSS Helion",
  width: 2400,
  height: 1440,
  cell: 20,
  rooms,
  corridors,
  doors,
  vents,
  consoles,
  cameras,
  tasks,
  spawn: { x: 1200, y: 320, radius: 110 },
  emergencyButton: { x: 1200, y: 300 },
};

export function allFloors(map: MapDef): Rect[] {
  return [...map.rooms.map((r) => r.rect), ...map.corridors];
}

export function roomAt(map: MapDef, x: number, y: number): MapRoom | null {
  for (const room of map.rooms) {
    const r = room.rect;
    if (x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h) return room;
  }
  return null;
}

export function consoleById(map: MapDef, id: string): MapConsole | null {
  return map.consoles.find((c) => c.id === id) ?? null;
}

export function ventById(map: MapDef, id: string): MapVent | null {
  return map.vents.find((v) => v.id === id) ?? null;
}
