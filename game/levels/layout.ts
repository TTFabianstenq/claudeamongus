/**
 * The Hollowmoor estate — the entire level as declarative data.
 *
 * Renderer, physics colliders and the Keeper's navigation grid are all
 * generated from these tables, so the world is consistent by construction:
 * a doorway declared here is simultaneously a hole in the wall mesh, a gap
 * in the collider set, a hinged physics door and a traversable nav cell.
 *
 * This module is deliberately three.js-free so the Node validation script
 * can load it.
 */

import {
  DoorDef,
  FLOOR_Y,
  FloorId,
  FurnDef,
  FurnKind,
  FurnSpec,
  HideKind,
  LightFixtureDef,
  Opening,
  RoomDef,
  SpawnPointDef,
  StairDef,
  Vec2,
  Vec3,
  VentDef,
  WALL_H,
  WALL_T,
  WallDef,
  WindowDef,
} from '@/game/types';
import { pointInRect } from '@/game/utils/math';

/* ------------------------------------------------------------------ */
/* Rooms                                                               */
/* ------------------------------------------------------------------ */

export const ROOMS: RoomDef[] = [
  // Ground floor — shell x[-10,10] z[-8,8], front of the house faces +Z.
  {
    id: 'library',
    name: 'Library',
    floor: 'ground',
    rect: [-10, -8, -4, -3],
    floorMat: 'darkwood',
    wallMat: 'wainscot',
  },
  {
    id: 'dining',
    name: 'Dining Room',
    floor: 'ground',
    rect: [-10, -3, -4, 2],
    floorMat: 'wood',
    wallMat: 'wallpaper',
  },
  {
    id: 'living',
    name: 'Living Room',
    floor: 'ground',
    rect: [-10, 2, -4, 8],
    floorMat: 'wood',
    wallMat: 'wallpaper',
  },
  {
    id: 'study',
    name: 'Study',
    floor: 'ground',
    rect: [-4, -8, 1, -4],
    floorMat: 'darkwood',
    wallMat: 'wainscot',
  },
  {
    id: 'kitchen',
    name: 'Kitchen',
    floor: 'ground',
    rect: [-4, -4, 1, 2],
    floorMat: 'tile',
    wallMat: 'plaster',
  },
  {
    id: 'foyer',
    name: 'Foyer',
    floor: 'ground',
    rect: [-4, 2, 1, 8],
    floorMat: 'wood',
    wallMat: 'wainscot',
  },
  {
    id: 'bath1',
    name: 'Washroom',
    floor: 'ground',
    rect: [1, -8, 4, -5.5],
    floorMat: 'tile',
    wallMat: 'plaster',
  },
  {
    id: 'hall',
    name: 'Hallway',
    floor: 'ground',
    rect: [1, -5.5, 4, 8],
    floorMat: 'wood',
    wallMat: 'wainscot',
  },
  {
    id: 'storage',
    name: 'Storage Room',
    floor: 'ground',
    rect: [4, -8, 10, -5],
    floorMat: 'concrete',
    wallMat: 'planks',
  },
  {
    id: 'laundry',
    name: 'Laundry',
    floor: 'ground',
    rect: [4, -5, 10, -2],
    floorMat: 'tile',
    wallMat: 'plaster',
  },
  {
    id: 'garage',
    name: 'Garage',
    floor: 'ground',
    rect: [4, -2, 10, 8],
    floorMat: 'concrete',
    wallMat: 'brick',
  },

  // Upper floor — shell x[-10,4] z[-8,8].
  {
    id: 'child',
    name: "Child's Bedroom",
    floor: 'upper',
    rect: [-10, -8, -4, -3],
    floorMat: 'carpet',
    wallMat: 'wallpaper',
    creaky: true,
  },
  {
    id: 'guest',
    name: 'Guest Bedroom',
    floor: 'upper',
    rect: [-4, -8, 1, -3],
    floorMat: 'wood',
    wallMat: 'wallpaper',
    creaky: true,
  },
  {
    id: 'sewing',
    name: 'Sewing Room',
    floor: 'upper',
    rect: [1, -8, 4, -3],
    floorMat: 'wood',
    wallMat: 'plaster',
    creaky: true,
  },
  {
    id: 'bath2',
    name: 'Bathroom',
    floor: 'upper',
    rect: [-10, -3, -7, 2],
    floorMat: 'tile',
    wallMat: 'plaster',
  },
  {
    id: 'uphall',
    name: 'Upstairs Hall',
    floor: 'upper',
    rect: [-7, -3, 4, 2],
    floorMat: 'wood',
    wallMat: 'wallpaper',
    creaky: true,
  },
  {
    id: 'master',
    name: 'Master Bedroom',
    floor: 'upper',
    rect: [-10, 2, -4, 8],
    floorMat: 'carpet',
    wallMat: 'wallpaper',
    creaky: true,
  },
  {
    id: 'lounge',
    name: 'Upstairs Lounge',
    floor: 'upper',
    rect: [-4, 2, 4, 8],
    floorMat: 'wood',
    wallMat: 'wallpaper',
    creaky: true,
  },

  // Basement — x[-6,4] z[-6,6.5] plus the hidden annex x[4,6].
  {
    id: 'cellar',
    name: 'Cellar',
    floor: 'basement',
    rect: [-6, -6, 1, 0],
    floorMat: 'concrete',
    wallMat: 'concrete',
  },
  {
    id: 'boiler',
    name: 'Boiler Room',
    floor: 'basement',
    rect: [-6, 0, 1, 6],
    floorMat: 'concrete',
    wallMat: 'concrete',
  },
  {
    id: 'bcorridor',
    name: 'Cellar Corridor',
    floor: 'basement',
    rect: [1, -6, 4, 6.5],
    floorMat: 'concrete',
    wallMat: 'brick',
  },
  {
    id: 'tunnelroom',
    name: 'Forgotten Room',
    floor: 'basement',
    rect: [4, -6, 6, -1],
    floorMat: 'concrete',
    wallMat: 'brick',
  },

  // Attic.
  {
    id: 'attic',
    name: 'Attic',
    floor: 'attic',
    rect: [-8, -6, 2, 6],
    floorMat: 'darkwood',
    wallMat: 'planks',
    ceiling: false,
    creaky: true,
  },
];

export const ROOM_BY_ID: Record<string, RoomDef> = Object.fromEntries(ROOMS.map((r) => [r.id, r]));

/* ------------------------------------------------------------------ */
/* Doors                                                               */
/* ------------------------------------------------------------------ */

const D = (
  id: string,
  floor: FloorId,
  pos: Vec2,
  rotY: number,
  extra: Partial<DoorDef> = {}
): DoorDef => ({ id, floor, pos, rotY, width: 0.92, height: 2.06, kind: 'interior', ...extra });

/**
 * Door `pos` is the centre of the doorway; `rotY` is the direction ALONG the
 * wall the door sits in (0 = +X). Locked doors list the key item id.
 */
export const DOORS: DoorDef[] = [
  // Ground floor
  D('front_door', 'ground', [-1.5, 8], 0, { kind: 'exterior', width: 1.0 }),
  D('back_door', 'ground', [8.5, -8], 0, { kind: 'exterior', lockId: 'PRY', width: 1.0 }),
  D('door_livdin', 'ground', [-7, 2], 0),
  D('door_dinlib', 'ground', [-7, -3], 0),
  D('door_kitfoyer', 'ground', [-1.5, 2], 0),
  D('door_kithall', 'ground', [1, 0.5], Math.PI / 2),
  D('door_study', 'ground', [1, -4.6], Math.PI / 2, { lockId: 'key_study', breakable: true }),
  D('door_bath1', 'ground', [2.5, -5.5], 0, { breakable: true }),
  D('door_laundry', 'ground', [4, -3.5], Math.PI / 2, { breakable: true }),
  D('door_storage', 'ground', [7, -5], 0, { breakable: true }),
  D('door_garage', 'ground', [7, -2], 0, { breakable: true }),
  D('door_cellar', 'ground', [-0.5, -1.1], Math.PI / 2, {
    lockId: 'key_basement',
    breakable: true,
    width: 0.88,
  }),
  // Upper floor
  D('door_child', 'upper', [-6, -3], 0, { breakable: true }),
  D('door_guest', 'upper', [-1.5, -3], 0, { breakable: true }),
  D('door_sewing', 'upper', [2.5, -3], 0, { width: 0.86, breakable: true }),
  D('door_bath2', 'upper', [-7, -0.5], Math.PI / 2, { width: 0.86, breakable: true }),
  D('door_master', 'upper', [-4, 5], Math.PI / 2, { lockId: 'key_master', breakable: true }),
  D('door_roof', 'upper', [4, 0.5], Math.PI / 2, { kind: 'exterior', width: 0.86 }),
  // Basement
  D('door_cellarroom', 'basement', [1, -3], Math.PI / 2, { kind: 'metal' }),
  D('door_boiler', 'basement', [1, 3], Math.PI / 2, { kind: 'metal' }),
  // Woodshed (exterior structure)
  D('door_shed', 'ground', [-21, -18.7], 0, { kind: 'exterior', width: 0.9 }),
];

export const DOOR_BY_ID: Record<string, DoorDef> = Object.fromEntries(DOORS.map((d) => [d.id, d]));

/* ------------------------------------------------------------------ */
/* Windows                                                             */
/* ------------------------------------------------------------------ */

const W = (
  id: string,
  floor: FloorId,
  pos: Vec2,
  rotY: number,
  width = 1.3,
  boarded = false
): WindowDef => ({
  id,
  floor,
  pos,
  rotY,
  width,
  boarded,
});

export const WINDOWS: WindowDef[] = [
  // Ground — these are breakable (noise / distraction).
  W('win_liv_s1', 'ground', [-8, 8], 0, 1.4),
  W('win_liv_s2', 'ground', [-6, 8], 0, 1.4),
  W('win_liv_w', 'ground', [-10, 5], Math.PI / 2, 1.5),
  W('win_din_w1', 'ground', [-10, -1.5], Math.PI / 2, 1.2),
  W('win_din_w2', 'ground', [-10, 0.5], Math.PI / 2, 1.2),
  W('win_lib_w', 'ground', [-10, -5.5], Math.PI / 2, 1.3),
  W('win_lib_n1', 'ground', [-8, -8], 0, 1.3),
  W('win_lib_n2', 'ground', [-6, -8], 0, 1.3),
  W('win_study_n', 'ground', [-2.5, -8], 0, 1.2),
  W('win_bath1_n', 'ground', [2.5, -8], 0, 0.7),
  W('win_storage_n', 'ground', [6.5, -8], 0, 1.2, true),
  W('win_laundry_e', 'ground', [10, -3.5], Math.PI / 2, 1.0),
  W('win_garage_e1', 'ground', [10, 2], Math.PI / 2, 1.0),
  W('win_garage_e2', 'ground', [10, 5], Math.PI / 2, 1.0),
  W('win_foyer_s', 'ground', [0.2, 8], 0, 0.8),
  // Upper — visual only.
  W('win_master_s1', 'upper', [-8, 8], 0, 1.4),
  W('win_master_s2', 'upper', [-5.5, 8], 0, 1.4),
  W('win_master_w', 'upper', [-10, 5], Math.PI / 2, 1.4),
  W('win_bath2_w', 'upper', [-10, -0.5], Math.PI / 2, 0.9),
  W('win_child_w', 'upper', [-10, -5], Math.PI / 2, 1.2),
  W('win_child_n', 'upper', [-7, -8], 0, 1.2),
  W('win_guest_n', 'upper', [-1.5, -8], 0, 1.2),
  W('win_sewing_n', 'upper', [2.5, -8], 0, 1.0),
  W('win_lounge_s1', 'upper', [-1, 8], 0, 1.4),
  W('win_lounge_s2', 'upper', [2, 8], 0, 1.4),
  W('win_lounge_e', 'upper', [4, 5], Math.PI / 2, 1.2),
  // Attic gable.
  W('win_attic_e', 'attic', [2, 0], Math.PI / 2, 0.9),
];

export const WINDOW_BY_ID: Record<string, WindowDef> = Object.fromEntries(
  WINDOWS.map((w) => [w.id, w])
);

/* ------------------------------------------------------------------ */
/* Walls                                                               */
/* ------------------------------------------------------------------ */

interface WallSrc {
  floor: FloorId;
  from: Vec2;
  to: Vec2;
  mat?: WallDef['mat'];
  height?: number;
  doors?: string[];
  windows?: string[];
  extra?: Opening[];
}

const DOOR_TOP = 2.06;
const WIN_BOTTOM = 0.95;
const WIN_TOP = 2.2;

/** Project a point onto the wall axis to get its distance from `from`. */
function along(from: Vec2, to: Vec2, p: Vec2): number {
  const dx = to[0] - from[0];
  const dz = to[1] - from[1];
  const len = Math.hypot(dx, dz);
  return ((p[0] - from[0]) * dx + (p[1] - from[1]) * dz) / len;
}

function resolveWall(src: WallSrc): WallDef {
  const openings: Opening[] = [...(src.extra ?? [])];
  for (const id of src.doors ?? []) {
    const d = DOOR_BY_ID[id];
    openings.push({
      at: along(src.from, src.to, d.pos),
      width: (d.width ?? 0.92) + 0.08,
      top: (d.height ?? DOOR_TOP) + 0.02,
    });
  }
  for (const id of src.windows ?? []) {
    const w = WINDOW_BY_ID[id];
    openings.push({
      at: along(src.from, src.to, w.pos),
      width: w.width ?? 1.3,
      bottom: WIN_BOTTOM,
      top: WIN_TOP,
    });
  }
  openings.sort((a, b) => a.at - b.at);
  return {
    floor: src.floor,
    from: src.from,
    to: src.to,
    mat: src.mat,
    height: src.height,
    openings,
  };
}

const HPI = Math.PI / 2;

const WALL_SRC: WallSrc[] = [
  /* ---------------- Ground floor ---------------- */
  // Shell
  {
    floor: 'ground',
    from: [-10, 8],
    to: [10, 8],
    mat: 'planks',
    doors: ['front_door'],
    windows: ['win_liv_s1', 'win_liv_s2', 'win_foyer_s'],
    // Garage vehicle door — rendered/simulated by the GarageDoor entity.
    extra: [{ at: 17, width: 3.2, top: 2.35 }],
  },
  {
    floor: 'ground',
    from: [-10, -8],
    to: [10, -8],
    mat: 'planks',
    doors: ['back_door'],
    windows: ['win_lib_n1', 'win_lib_n2', 'win_study_n', 'win_bath1_n', 'win_storage_n'],
  },
  {
    floor: 'ground',
    from: [-10, -8],
    to: [-10, 8],
    mat: 'planks',
    windows: ['win_lib_w', 'win_din_w1', 'win_din_w2', 'win_liv_w'],
  },
  {
    floor: 'ground',
    from: [10, -8],
    to: [10, 8],
    mat: 'planks',
    windows: ['win_laundry_e', 'win_garage_e1', 'win_garage_e2'],
  },
  // Interior spine x = -4
  {
    floor: 'ground',
    from: [-4, -8],
    to: [-4, 8],
    mat: 'wainscot',
    extra: [
      { at: 2, width: 1.06, top: DOOR_TOP }, // hidden bookcase passage (library z=-6)
      { at: 7, width: 1.6, top: 2.25 }, // dining-kitchen arch (z=-1)
      { at: 13, width: 1.9, top: 2.3 }, // living-foyer arch (z=5)
    ],
  },
  // Interior spine x = 1
  {
    floor: 'ground',
    from: [1, -8],
    to: [1, 8],
    mat: 'wainscot',
    doors: ['door_study', 'door_kithall'],
    extra: [
      { at: 1.5, width: 0.72, top: 0.95 }, // washroom-study crawl vent (z=-6.5)
      { at: 13, width: 2.1, top: 2.3 }, // foyer-hall arch (z=5)
    ],
  },
  // Interior spine x = 4
  { floor: 'ground', from: [4, -8], to: [4, 8], mat: 'brick', doors: ['door_laundry'] },
  // Cross walls
  { floor: 'ground', from: [1, -5.5], to: [4, -5.5], mat: 'plaster', doors: ['door_bath1'] },
  { floor: 'ground', from: [4, -5], to: [10, -5], mat: 'plaster', doors: ['door_storage'] },
  { floor: 'ground', from: [4, -2], to: [10, -2], mat: 'brick', doors: ['door_garage'] },
  { floor: 'ground', from: [-4, -4], to: [1, -4], mat: 'wainscot' },
  { floor: 'ground', from: [-10, -3], to: [-4, -3], mat: 'wallpaper', doors: ['door_dinlib'] },
  { floor: 'ground', from: [-10, 2], to: [-4, 2], mat: 'wallpaper', doors: ['door_livdin'] },
  { floor: 'ground', from: [-4, 2], to: [1, 2], mat: 'wainscot', doors: ['door_kitfoyer'] },
  // Cellar-stair closet carved out of the kitchen's NE corner
  { floor: 'ground', from: [-0.5, -4], to: [-0.5, -0.5], mat: 'plaster', doors: ['door_cellar'] },
  { floor: 'ground', from: [-0.5, -0.5], to: [1, -0.5], mat: 'plaster' },

  /* ---------------- Upper floor ---------------- */
  {
    floor: 'upper',
    from: [-10, 8],
    to: [4, 8],
    mat: 'planks',
    windows: ['win_master_s1', 'win_master_s2', 'win_lounge_s1', 'win_lounge_s2'],
  },
  {
    floor: 'upper',
    from: [-10, -8],
    to: [4, -8],
    mat: 'planks',
    windows: ['win_child_n', 'win_guest_n', 'win_sewing_n'],
  },
  {
    floor: 'upper',
    from: [-10, -8],
    to: [-10, 8],
    mat: 'planks',
    windows: ['win_child_w', 'win_bath2_w', 'win_master_w'],
  },
  {
    floor: 'upper',
    from: [4, -8],
    to: [4, 8],
    mat: 'planks',
    doors: ['door_roof'],
    windows: ['win_lounge_e'],
  },
  {
    floor: 'upper',
    from: [-10, -3],
    to: [4, -3],
    mat: 'wallpaper',
    doors: ['door_child', 'door_guest', 'door_sewing'],
  },
  { floor: 'upper', from: [-7, -3], to: [-7, 2], mat: 'plaster', doors: ['door_bath2'] },
  { floor: 'upper', from: [-10, 2], to: [-4, 2], mat: 'wallpaper' },
  { floor: 'upper', from: [-4, 2], to: [-4, 8], mat: 'wallpaper', doors: ['door_master'] },
  {
    floor: 'upper',
    from: [-4, 2],
    to: [4, 2],
    mat: 'wallpaper',
    extra: [{ at: 4, width: 2.6, top: 2.3 }],
  },

  /* ---------------- Basement ---------------- */
  { floor: 'basement', from: [-6, -6], to: [-6, 6], mat: 'concrete' },
  { floor: 'basement', from: [-6, -6], to: [6, -6], mat: 'concrete' },
  { floor: 'basement', from: [-6, 6], to: [1, 6], mat: 'concrete' },
  { floor: 'basement', from: [1, 6], to: [1, 6.5], mat: 'concrete' },
  { floor: 'basement', from: [1, 6.5], to: [4, 6.5], mat: 'brick' },
  { floor: 'basement', from: [4, -1], to: [4, 6.5], mat: 'brick' },
  {
    floor: 'basement',
    from: [4, -6],
    to: [4, -1],
    mat: 'brick',
    // Hidden shelf passage into the forgotten room.
    extra: [{ at: 3, width: 1.12, top: 2.0 }],
  },
  { floor: 'basement', from: [6, -6], to: [6, -1], mat: 'brick' },
  { floor: 'basement', from: [4, -1], to: [6, -1], mat: 'brick' },
  {
    floor: 'basement',
    from: [1, -6],
    to: [1, 6],
    mat: 'concrete',
    doors: ['door_cellarroom', 'door_boiler'],
  },
  {
    floor: 'basement',
    from: [-6, 0],
    to: [1, 0],
    mat: 'concrete',
    extra: [{ at: 2, width: 0.72, top: 0.95 }], // cellar-boiler crawl vent (x=-4)
  },

  /* ---------------- Attic ---------------- */
  { floor: 'attic', from: [-8, -6], to: [-8, 6], mat: 'planks' },
  { floor: 'attic', from: [2, -6], to: [2, 6], mat: 'planks', windows: ['win_attic_e'] },
  { floor: 'attic', from: [-8, -6], to: [2, -6], mat: 'planks', height: 1.25 },
  { floor: 'attic', from: [-8, 6], to: [2, 6], mat: 'planks', height: 1.25 },
];

export const WALLS: WallDef[] = WALL_SRC.map(resolveWall);

/* ------------------------------------------------------------------ */
/* Wall → box decomposition (shared by renderer, physics and navgrid)  */
/* ------------------------------------------------------------------ */

export interface WallBox {
  /** Centre position in world space. */
  cx: number;
  cy: number;
  cz: number;
  /** Extents: length along the wall, thickness, height. */
  len: number;
  thick: number;
  height: number;
  rotY: number;
  mat: NonNullable<WallDef['mat']>;
  floor: FloorId;
}

export function wallToBoxes(wall: WallDef): WallBox[] {
  const [x0, z0] = wall.from;
  const [x1, z1] = wall.to;
  const dx = x1 - x0;
  const dz = z1 - z0;
  const len = Math.hypot(dx, dz);
  const rotY = Math.atan2(-dz, dx);
  const baseY = FLOOR_Y[wall.floor];
  const H = wall.height ?? WALL_H[wall.floor];
  const mat = wall.mat ?? 'plaster';
  const boxes: WallBox[] = [];

  const emit = (a: number, b: number, y0: number, y1: number) => {
    if (b - a < 0.01 || y1 - y0 < 0.01) return;
    const mid = (a + b) / 2;
    boxes.push({
      cx: x0 + (dx / len) * mid,
      cz: z0 + (dz / len) * mid,
      cy: baseY + (y0 + y1) / 2,
      len: b - a,
      thick: WALL_T,
      height: y1 - y0,
      rotY,
      mat,
      floor: wall.floor,
    });
  };

  const ops = (wall.openings ?? []).slice().sort((a, b) => a.at - b.at);
  let cursor = 0;
  for (const op of ops) {
    const a = op.at - op.width / 2;
    const b = op.at + op.width / 2;
    emit(cursor, a, 0, H); // solid segment before opening
    const bottom = op.bottom ?? 0;
    const top = op.top ?? DOOR_TOP;
    if (bottom > 0.01) emit(a, b, 0, bottom); // sill
    if (top < H - 0.01) emit(a, b, top, H); // lintel
    cursor = b;
  }
  emit(cursor, len, 0, H);
  return boxes;
}

export const ALL_WALL_BOXES: WallBox[] = WALLS.flatMap(wallToBoxes);

/* ------------------------------------------------------------------ */
/* Stairs & floor holes                                                */
/* ------------------------------------------------------------------ */

export const STAIRS: StairDef[] = [
  // Main staircase: hall (ground) up to the landing (upper), ascending north.
  {
    id: 'stair_main',
    lower: 'ground',
    upper: 'upper',
    base: [2.7, 5.5],
    dir: HPI,
    length: 4.0,
    width: 1.5,
  },
  // Cellar stairs: cellar (basement) up to the kitchen closet, ascending south.
  {
    id: 'stair_cellar',
    lower: 'basement',
    upper: 'ground',
    base: [0.25, -3.9],
    dir: -HPI,
    length: 3.0,
    width: 1.34,
  },
];

/** Holes cut into floor slabs (stairwells, attic hatch). [x0,z0,x1,z1] */
export const STAIR_HOLES: { floor: FloorId; rect: [number, number, number, number] }[] = [
  { floor: 'upper', rect: [1.9, 1.4, 4.0, 5.7] }, // main stair void
  { floor: 'ground', rect: [-0.42, -4, 0.92, -0.8] }, // cellar stair void (inside closet)
  { floor: 'attic', rect: [-1.7, -1.15, -0.3, 0.15] }, // attic hatch
];

/** Attic hatch ladder (scripted climb, not a physical stair). */
export const ATTIC_HATCH = {
  pos: [-1, -0.5] as Vec2,
  upperY: FLOOR_Y.upper,
  atticY: FLOOR_Y.attic,
};

/* ------------------------------------------------------------------ */
/* Furniture                                                           */
/* ------------------------------------------------------------------ */

export const FURN_SPECS: Record<FurnKind, FurnSpec> = {
  sofa: { size: [2.1, 0.95, 0.95], blocksNav: true, solid: true },
  armchair: { size: [0.95, 0.95, 1.0], blocksNav: true, solid: true },
  coffeetable: { size: [1.2, 0.65, 0.45], blocksNav: true, solid: true },
  diningtable: { size: [2.6, 1.2, 0.78], blocksNav: true, solid: true },
  chair: { size: [0.5, 0.5, 0.95], blocksNav: false, solid: true },
  sideboard: { size: [1.7, 0.5, 0.95], blocksNav: true, solid: true },
  bookshelf: { size: [1.5, 0.42, 2.2], blocksNav: true, solid: true },
  shelf: { size: [1.6, 0.45, 1.9], blocksNav: true, solid: true },
  counter: { size: [1.8, 0.65, 0.92], blocksNav: true, solid: true },
  stove: { size: [0.75, 0.68, 0.92], blocksNav: true, solid: true },
  icebox: { size: [0.85, 0.75, 1.75], blocksNav: true, solid: true },
  sink: { size: [0.7, 0.5, 0.85], blocksNav: true, solid: true },
  toilet: { size: [0.45, 0.7, 0.78], blocksNav: true, solid: true },
  bathtub: { size: [1.7, 0.8, 0.62], blocksNav: true, solid: true },
  cabinet: { size: [0.8, 0.4, 0.9], blocksNav: false, solid: true },
  washer: { size: [0.7, 0.7, 0.95], blocksNav: true, solid: true },
  desk: { size: [1.5, 0.75, 0.78], blocksNav: true, solid: true },
  bed: { size: [1.7, 2.1, 0.62], blocksNav: true, solid: true },
  singlebed: { size: [1.05, 2.0, 0.58], blocksNav: true, solid: true },
  wardrobe: { size: [1.25, 0.68, 2.1], blocksNav: true, solid: true },
  dresser: { size: [1.25, 0.55, 1.25], blocksNav: true, solid: true },
  nightstand: { size: [0.5, 0.45, 0.62], blocksNav: false, solid: true },
  toychest: { size: [0.95, 0.5, 0.55], blocksNav: false, solid: true },
  trunk: { size: [1.1, 0.6, 0.6], blocksNav: false, solid: true },
  crate: { size: [0.75, 0.75, 0.7], blocksNav: false, solid: true },
  cratestack: { size: [1.5, 0.85, 1.5], blocksNav: true, solid: true },
  workbench: { size: [2.0, 0.75, 0.95], blocksNav: true, solid: true },
  boiler: { size: [1.3, 1.3, 2.0], blocksNav: true, solid: true },
  fusebox: { size: [0.6, 0.2, 0.8], blocksNav: false, solid: false },
  generator: { size: [1.1, 0.65, 0.95], blocksNav: true, solid: true },
  car: { size: [1.95, 4.4, 1.5], blocksNav: true, solid: true },
  piano: { size: [1.5, 0.65, 1.25], blocksNav: true, solid: true },
  radio: { size: [0.6, 0.35, 0.85], blocksNav: false, solid: true },
  clock: { size: [0.55, 0.35, 2.05], blocksNav: false, solid: true },
  coatstand: { size: [0.4, 0.4, 1.8], blocksNav: false, solid: false },
  mannequin: { size: [0.45, 0.45, 1.7], blocksNav: false, solid: true },
  rockinghorse: { size: [0.9, 0.35, 0.85], blocksNav: false, solid: true },
  rockingchair: { size: [0.7, 0.95, 1.05], blocksNav: false, solid: true },
  mirror: { size: [0.8, 0.12, 1.7], blocksNav: false, solid: true },
  lamp: { size: [0.35, 0.35, 1.55], blocksNav: false, solid: false },
  rug: { size: [2.6, 1.8, 0.02], blocksNav: false, solid: false },
  pantry: { size: [1.1, 0.62, 2.05], blocksNav: true, solid: true },
  barrel: { size: [0.62, 0.62, 0.85], blocksNav: false, solid: true },
  firewood: { size: [1.1, 0.5, 0.7], blocksNav: false, solid: true },
  bin: { size: [0.55, 0.55, 0.75], blocksNav: false, solid: true },
  safe: { size: [0.7, 0.6, 0.85], blocksNav: false, solid: true },
};

const F = (id: string, kind: FurnKind, floor: FloorId, pos: Vec2, rotY = 0): FurnDef => ({
  id,
  kind,
  floor,
  pos,
  rotY,
});

export const FURNITURE: FurnDef[] = [
  // Living room
  F('liv_sofa', 'sofa', 'ground', [-7, 6.8], Math.PI),
  F('liv_arm1', 'armchair', 'ground', [-9, 5.2], HPI),
  F('liv_arm2', 'armchair', 'ground', [-6.2, 4.4], -2.2),
  F('liv_coffee', 'coffeetable', 'ground', [-7, 5.2]),
  F('liv_piano', 'piano', 'ground', [-9.2, 3.0], HPI),
  F('liv_shelf', 'bookshelf', 'ground', [-4.6, 3.2], -HPI),
  F('liv_lamp', 'lamp', 'ground', [-4.8, 7.3]),
  F('liv_rug', 'rug', 'ground', [-7, 5.6]),
  // Dining room
  F('din_table', 'diningtable', 'ground', [-7, -0.5]),
  F('din_chair1', 'chair', 'ground', [-8.2, -1.4]),
  F('din_chair2', 'chair', 'ground', [-7, -1.4]),
  F('din_chair3', 'chair', 'ground', [-5.8, -1.4], 0.3),
  F('din_chair4', 'chair', 'ground', [-8.2, 0.4], Math.PI),
  F('din_chair5', 'chair', 'ground', [-5.8, 0.4], Math.PI),
  F('din_side', 'sideboard', 'ground', [-9.6, -0.5], HPI),
  F('din_clock', 'clock', 'ground', [-4.35, 0.8], -HPI),
  // Kitchen
  F('kit_counter1', 'counter', 'ground', [-3.05, -3.4], 0),
  F('kit_stove', 'stove', 'ground', [-1.6, -3.4], 0),
  F('kit_counter2', 'counter', 'ground', [-0.85, -2.9], -HPI),
  F('kit_sink', 'sink', 'ground', [-3.6, 0.35], HPI),
  F('kit_icebox', 'icebox', 'ground', [-3.55, 1.45], HPI),
  F('kit_pantry', 'pantry', 'ground', [-2.5, 1.55], 0),
  F('kit_table', 'coffeetable', 'ground', [-1.6, -0.6]),
  // Foyer
  F('foy_console', 'sideboard', 'ground', [-3.4, 7.45], 0),
  F('foy_coat', 'coatstand', 'ground', [0.55, 7.5]),
  F('foy_bench', 'trunk', 'ground', [0.55, 6.5], HPI),
  // Library
  F('lib_shelf1', 'bookshelf', 'ground', [-9.55, -4.4], HPI),
  F('lib_shelf2', 'bookshelf', 'ground', [-9.55, -6.6], HPI),
  F('lib_shelf3', 'bookshelf', 'ground', [-7, -7.55], 0),
  F('lib_shelf_secret', 'bookshelf', 'ground', [-4.28, -6.0], -HPI), // hides the passage
  F('lib_desk', 'desk', 'ground', [-6.4, -5.2], 0.35),
  F('lib_chair', 'chair', 'ground', [-6.5, -5.9], 0.35),
  F('lib_lamp', 'lamp', 'ground', [-4.6, -3.5]),
  // Study
  F('study_desk', 'desk', 'ground', [-2.4, -7.4], 0),
  F('study_chair', 'chair', 'ground', [-2.4, -6.7], Math.PI),
  F('study_safe', 'safe', 'ground', [-3.55, -7.5], 0),
  F('study_file', 'cabinet', 'ground', [-3.6, -4.6], HPI),
  F('study_shelf', 'bookshelf', 'ground', [0.55, -6.2], -HPI),
  // Washroom (ground)
  F('bath1_sink', 'sink', 'ground', [1.5, -7.6], 0),
  F('bath1_toilet', 'toilet', 'ground', [3.4, -7.6], 0),
  F('bath1_cab', 'cabinet', 'ground', [3.6, -6.2], -HPI),
  // Hall
  F('hall_table', 'cabinet', 'ground', [1.4, -4.8], HPI),
  F('hall_clock', 'clock', 'ground', [3.65, 6.9], -HPI),
  // Laundry
  F('lau_washer', 'washer', 'ground', [5.0, -4.55], 0),
  F('lau_basin', 'sink', 'ground', [6.0, -4.6], 0),
  F('lau_shelf', 'shelf', 'ground', [9.55, -3.5], -HPI),
  F('lau_bin', 'bin', 'ground', [4.6, -2.5]),
  // Storage room
  F('sto_shelf1', 'shelf', 'ground', [5.0, -7.55], 0),
  F('sto_shelf2', 'shelf', 'ground', [9.55, -6.5], -HPI),
  F('sto_crates', 'cratestack', 'ground', [6.8, -6.8], 0.2),
  F('sto_barrel', 'barrel', 'ground', [4.7, -5.6]),
  // Garage
  F('gar_car', 'car', 'ground', [7.2, 3.4], 0),
  F('gar_bench', 'workbench', 'ground', [5.2, -1.4], 0),
  F('gar_shelf', 'shelf', 'ground', [9.6, -0.8], -HPI),
  F('gar_gen', 'generator', 'ground', [4.7, 0.4], HPI),
  F('gar_crate', 'crate', 'ground', [9.4, 6.8]),
  F('gar_bin', 'bin', 'ground', [4.6, 7.2]),
  // Master bedroom
  F('mas_bed', 'bed', 'upper', [-8.4, 5.4], HPI),
  F('mas_ward', 'wardrobe', 'upper', [-4.6, 3.0], -HPI),
  F('mas_dresser', 'dresser', 'upper', [-9.6, 2.8], HPI),
  F('mas_night1', 'nightstand', 'upper', [-9.6, 6.9]),
  F('mas_night2', 'nightstand', 'upper', [-7.1, 6.9]),
  F('mas_chair', 'armchair', 'upper', [-5, 7.2], Math.PI * 0.8),
  F('mas_mirror', 'mirror', 'upper', [-6.2, 2.15], Math.PI),
  // Child's bedroom
  F('chi_bed', 'singlebed', 'upper', [-9.3, -6.9], 0),
  F('chi_ward', 'wardrobe', 'upper', [-4.5, -6.5], -HPI),
  F('chi_toy', 'toychest', 'upper', [-9.5, -4.2], HPI),
  F('chi_desk', 'desk', 'upper', [-6.8, -7.5], 0),
  F('chi_horse', 'rockinghorse', 'upper', [-5.4, -4.0], -0.7),
  // Guest bedroom
  F('gue_bed', 'bed', 'upper', [-2.6, -6.8], 0),
  F('gue_ward', 'wardrobe', 'upper', [0.5, -7.5], Math.PI),
  F('gue_dresser', 'dresser', 'upper', [-3.6, -4.2], HPI),
  // Sewing room
  F('sew_table', 'desk', 'upper', [2.5, -7.4], 0),
  F('sew_mann', 'mannequin', 'upper', [1.5, -4.0]),
  F('sew_shelf', 'shelf', 'upper', [3.6, -4.5], -HPI),
  F('sew_crate', 'crate', 'upper', [1.4, -6.2]),
  // Upstairs bathroom
  F('bath2_tub', 'bathtub', 'upper', [-9.0, 1.3], 0),
  F('bath2_sink', 'sink', 'upper', [-9.6, -1.5], HPI),
  F('bath2_toilet', 'toilet', 'upper', [-9.6, -2.4], HPI),
  F('bath2_cab', 'cabinet', 'upper', [-7.4, -2.6], Math.PI),
  // Upstairs hall & lounge
  F('hall2_shelf', 'bookshelf', 'upper', [-6.5, -2.75], 0),
  F('lou_sofa', 'sofa', 'upper', [-1.5, 7.4], Math.PI),
  F('lou_radio', 'radio', 'upper', [-3.6, 6.6], HPI),
  F('lou_shelf', 'bookshelf', 'upper', [-3.7, 3.4], -HPI),
  F('lou_chest', 'trunk', 'upper', [0.8, 7.4]),
  F('lou_arm', 'armchair', 'upper', [1.2, 3.2], 2.6),
  // Basement — cellar
  F('cel_shelf1', 'shelf', 'basement', [-5.5, -3.0], HPI),
  F('cel_shelf2', 'shelf', 'basement', [-2.5, -5.5], 0),
  F('cel_ward', 'wardrobe', 'basement', [0.5, -5.4], Math.PI),
  F('cel_crates', 'cratestack', 'basement', [-4.5, -0.8], 0.3),
  F('cel_barrel1', 'barrel', 'basement', [-0.3, -2.2]),
  F('cel_barrel2', 'barrel', 'basement', [-1.0, -2.6]),
  // Basement — boiler room
  F('boi_boiler', 'boiler', 'basement', [-4.8, 4.8], 0),
  F('boi_bench', 'workbench', 'basement', [-0.2, 5.5], 0),
  F('boi_fuse', 'fusebox', 'basement', [-5.9, 1.6], HPI),
  F('boi_crate', 'crate', 'basement', [-2.8, 5.4]),
  F('boi_firewood', 'firewood', 'basement', [-5.6, 3.0], HPI),
  // Basement — corridor & forgotten room
  F('cor_crate', 'crate', 'basement', [3.5, 4.8]),
  F('tun_crates', 'cratestack', 'basement', [5.3, -5.3], 0.15),
  F('tun_desk', 'desk', 'basement', [5.35, -1.7], Math.PI),
  // Attic
  F('att_ward', 'wardrobe', 'attic', [-7.4, 4.6], HPI),
  F('att_trunk', 'trunk', 'attic', [1.2, 4.8], -0.4),
  F('att_crates', 'cratestack', 'attic', [-6.8, -4.6], 0.5),
  F('att_chair', 'rockingchair', 'attic', [0.4, -3.8], -2.4),
  F('att_mirror', 'mirror', 'attic', [-7.6, 0.4], HPI),
  F('att_crate', 'crate', 'attic', [-3.5, 3.9]),
  // Woodshed (exterior)
  F('shed_firewood', 'firewood', 'ground', [-22.3, -20.2], 0),
  F('shed_shelf', 'shelf', 'ground', [-20.2, -21.1], Math.PI),
  F('shed_barrel', 'barrel', 'ground', [-22.5, -18.9]),
];

export const FURN_BY_ID: Record<string, FurnDef> = Object.fromEntries(
  FURNITURE.map((f) => [f.id, f])
);

/* ------------------------------------------------------------------ */
/* Hiding spots (derived from furniture)                               */
/* ------------------------------------------------------------------ */

export interface HideSpot {
  id: string; // furniture id
  kind: HideKind;
  floor: FloorId;
  /** Where the player ends up while hidden. */
  inside: Vec3;
  /** Where the Keeper stands to check the spot. */
  checkFrom: Vec3;
}

function hideSpotFor(f: FurnDef, kind: HideKind): HideSpot {
  const y = FLOOR_Y[f.floor];
  const rot = f.rotY ?? 0;
  // Furniture "front" faces -Z in local space before rotY.
  const fx = Math.sin(rot);
  const fz = -Math.cos(rot);
  const eyeY = kind === 'bed' ? y + 0.32 : y + 1.35;
  return {
    id: f.id,
    kind,
    floor: f.floor,
    inside: [f.pos[0], eyeY, f.pos[1]],
    checkFrom: [f.pos[0] + fx * 1.1, y, f.pos[1] + fz * 1.1],
  };
}

export const HIDE_SPOTS: HideSpot[] = FURNITURE.flatMap((f) => {
  if (f.kind === 'wardrobe') return [hideSpotFor(f, 'wardrobe')];
  if (f.kind === 'bed' || f.kind === 'singlebed') return [hideSpotFor(f, 'bed')];
  if (f.kind === 'pantry') return [hideSpotFor(f, 'pantry')];
  return [];
});

/* ------------------------------------------------------------------ */
/* Lights                                                              */
/* ------------------------------------------------------------------ */

const L = (
  id: string,
  room: string,
  pos: Vec2,
  extra: Partial<LightFixtureDef> = {}
): LightFixtureDef => ({
  id,
  floor: ROOM_BY_ID[room].floor,
  pos,
  room,
  color: '#ffd9a0',
  intensity: 1,
  ...extra,
});

export const LIGHTS: LightFixtureDef[] = [
  L('l_living', 'living', [-7, 5], { intensity: 1.2 }),
  L('l_dining', 'dining', [-7, -0.5], { intensity: 1.1 }),
  L('l_kitchen', 'kitchen', [-1.8, -1], { color: '#fff2d5' }),
  L('l_foyer', 'foyer', [-1.5, 5], { intensity: 1.3 }),
  L('l_library', 'library', [-7, -5.5], { color: '#ffca87', flicker: 0.15 }),
  L('l_study', 'study', [-1.5, -6], { color: '#ffca87' }),
  L('l_bath1', 'bath1', [2.5, -6.7], { color: '#ffffff', intensity: 0.8, flicker: 0.3 }),
  L('l_hall_n', 'hall', [2.5, -3], { intensity: 0.9 }),
  L('l_hall_s', 'hall', [2, 6.5], { intensity: 0.9 }),
  L('l_laundry', 'laundry', [7, -3.5], { color: '#ffffff', flicker: 0.2 }),
  L('l_storage', 'storage', [7, -6.5], { intensity: 0.7, flicker: 0.45 }),
  L('l_garage_1', 'garage', [7, 1], { color: '#fff6e0', intensity: 0.9 }),
  L('l_garage_2', 'garage', [7, 5.5], { color: '#fff6e0', intensity: 0.9, flicker: 0.2 }),
  L('l_master', 'master', [-7, 5], { intensity: 1.1 }),
  L('l_child', 'child', [-7, -5.5], { color: '#ffd0c0' }),
  L('l_guest', 'guest', [-1.5, -5.5]),
  L('l_sewing', 'sewing', [2.5, -5.5], { flicker: 0.25 }),
  L('l_bath2', 'bath2', [-8.5, -0.5], { color: '#ffffff', intensity: 0.8 }),
  L('l_uphall', 'uphall', [-1.5, -0.5], { intensity: 0.9 }),
  L('l_lounge', 'lounge', [0, 5], { intensity: 1.1 }),
  // Basement bulbs hang off the old always-live circuit: dim and unreliable.
  L('l_cellar', 'cellar', [-2.5, -3], {
    offGrid: true,
    intensity: 0.55,
    flicker: 0.5,
    color: '#ffc890',
  }),
  L('l_boiler', 'boiler', [-2.5, 3], {
    offGrid: true,
    intensity: 0.55,
    flicker: 0.55,
    color: '#ffc890',
  }),
  L('l_bcorr', 'bcorridor', [2.5, 0.5], {
    offGrid: true,
    intensity: 0.5,
    flicker: 0.6,
    color: '#ffc890',
  }),
  L('l_tunnel', 'tunnelroom', [5, -3.5], {
    offGrid: true,
    intensity: 0.4,
    flicker: 0.7,
    color: '#ff9860',
  }),
  L('l_attic', 'attic', [-3, 0], {
    offGrid: true,
    intensity: 0.45,
    flicker: 0.4,
    color: '#ffbe7a',
  }),
];

/** Wall switches. Toggling one is visible to the Keeper. */
export const SWITCHES: { id: string; room: string; floor: FloorId; pos: Vec3 }[] = [
  { id: 'sw_living', room: 'living', floor: 'ground', pos: [-4.3, 1.3, 4.1] },
  { id: 'sw_dining', room: 'dining', floor: 'ground', pos: [-6.2, 1.3, 1.85] },
  { id: 'sw_kitchen', room: 'kitchen', floor: 'ground', pos: [-2.3, 1.3, 1.85] },
  { id: 'sw_foyer', room: 'foyer', floor: 'ground', pos: [-0.7, 1.3, 7.85] },
  { id: 'sw_library', room: 'library', floor: 'ground', pos: [-6.2, 1.3, -3.15] },
  { id: 'sw_study', room: 'study', floor: 'ground', pos: [0.85, 1.3, -5.35] },
  { id: 'sw_hall', room: 'hall', floor: 'ground', pos: [1.15, 1.3, 1.3] },
  { id: 'sw_garage', room: 'garage', floor: 'ground', pos: [7.9, 1.3, -1.85] },
  { id: 'sw_laundry', room: 'laundry', floor: 'ground', pos: [4.85, 1.3, -2.15] },
  { id: 'sw_master', room: 'master', floor: 'upper', pos: [-4.3, 1.3, 4.2] },
  { id: 'sw_uphall', room: 'uphall', floor: 'upper', pos: [3.2, 1.3, -2.85] },
  { id: 'sw_lounge', room: 'lounge', floor: 'upper', pos: [3.85, 1.3, 2.9] },
  { id: 'sw_child', room: 'child', floor: 'upper', pos: [-5.3, 1.3, -3.15] },
  { id: 'sw_guest', room: 'guest', floor: 'upper', pos: [-0.8, 1.3, -3.15] },
];

/* ------------------------------------------------------------------ */
/* Loot spawn points                                                   */
/* ------------------------------------------------------------------ */

const S = (
  id: string,
  floor: FloorId,
  pos: Vec3,
  where: string,
  container?: string
): SpawnPointDef => ({ id, floor, pos, where, container });

const gy = FLOOR_Y.ground;
const uy = FLOOR_Y.upper;
const by = FLOOR_Y.basement;
const ay = FLOOR_Y.attic;

export const SPAWN_POINTS: SpawnPointDef[] = [
  // Containers (drawer/box searches)
  S('sp_kit_counter1', 'ground', [-3.05, gy + 0.75, -3.4], 'a kitchen drawer', 'kit_counter1'),
  S('sp_kit_counter2', 'ground', [-0.85, gy + 0.75, -2.9], 'a kitchen drawer', 'kit_counter2'),
  S('sp_din_side', 'ground', [-9.6, gy + 0.8, -0.5], 'the dining sideboard', 'din_side'),
  S('sp_foy_console', 'ground', [-3.4, gy + 0.8, 7.45], 'the foyer console', 'foy_console'),
  S('sp_foy_bench', 'ground', [0.55, gy + 0.5, 6.5], 'the foyer bench', 'foy_bench'),
  S('sp_lib_desk', 'ground', [-6.4, gy + 0.7, -5.2], 'the library desk', 'lib_desk'),
  S('sp_study_desk', 'ground', [-2.4, gy + 0.7, -7.4], 'the study desk', 'study_desk'),
  S('sp_study_file', 'ground', [-3.6, gy + 0.7, -4.6], 'the filing cabinet', 'study_file'),
  S('sp_bath1_cab', 'ground', [3.6, gy + 0.6, -6.2], 'the washroom cabinet', 'bath1_cab'),
  S('sp_hall_table', 'ground', [1.4, gy + 0.7, -4.8], 'the hall cabinet', 'hall_table'),
  S('sp_lau_shelf', 'ground', [9.55, gy + 1.1, -3.5], 'the laundry shelf', 'lau_shelf'),
  S('sp_sto_shelf1', 'ground', [5.0, gy + 1.1, -7.55], 'a storage shelf', 'sto_shelf1'),
  S('sp_sto_shelf2', 'ground', [9.55, gy + 1.1, -6.5], 'a storage shelf', 'sto_shelf2'),
  S('sp_sto_crates', 'ground', [6.8, gy + 0.9, -6.8], 'the storage crates', 'sto_crates'),
  S('sp_gar_bench', 'ground', [5.2, gy + 0.8, -1.4], 'the garage workbench', 'gar_bench'),
  S('sp_gar_shelf', 'ground', [9.6, gy + 1.1, -0.8], 'the garage shelf', 'gar_shelf'),
  S('sp_car_glove', 'ground', [6.5, gy + 0.9, 2.4], "the car's glovebox", 'gar_car'),
  S('sp_mas_night1', 'upper', [-9.6, uy + 0.65, 6.9], 'a bedside drawer', 'mas_night1'),
  S('sp_mas_night2', 'upper', [-7.1, uy + 0.65, 6.9], 'a bedside drawer', 'mas_night2'),
  S('sp_mas_dresser', 'upper', [-9.6, uy + 0.9, 2.8], 'the master dresser', 'mas_dresser'),
  S('sp_chi_toy', 'upper', [-9.5, uy + 0.5, -4.2], 'the toy chest', 'chi_toy'),
  S('sp_chi_desk', 'upper', [-6.8, uy + 0.7, -7.5], "the child's desk", 'chi_desk'),
  S('sp_gue_dresser', 'upper', [-3.6, uy + 0.9, -4.2], 'the guest dresser', 'gue_dresser'),
  S('sp_sew_table', 'upper', [2.5, uy + 0.7, -7.4], 'the sewing table', 'sew_table'),
  S('sp_bath2_cab', 'upper', [-7.4, uy + 0.6, -2.6], 'the bathroom cabinet', 'bath2_cab'),
  S('sp_lou_chest', 'upper', [0.8, uy + 0.5, 7.4], 'the lounge chest', 'lou_chest'),
  S('sp_cel_shelf1', 'basement', [-5.5, by + 1.1, -3.0], 'a cellar shelf', 'cel_shelf1'),
  S('sp_cel_shelf2', 'basement', [-2.5, by + 1.1, -5.5], 'a cellar shelf', 'cel_shelf2'),
  S('sp_boi_bench', 'basement', [-0.2, by + 0.8, 5.5], 'the boiler-room workbench', 'boi_bench'),
  S('sp_att_trunk', 'attic', [1.2, ay + 0.5, 4.8], 'the attic trunk', 'att_trunk'),
  S('sp_att_crates', 'attic', [-6.8, ay + 0.9, -4.6], 'the attic crates', 'att_crates'),
  S('sp_shed_shelf', 'ground', [-20.2, 1.1, -21.1], 'the woodshed shelf', 'shed_shelf'),
  // Open pickups (visible items lying about)
  S('sp_gar_floor', 'ground', [8.9, gy + 0.08, 0.2], 'the garage floor'),
  S('sp_boi_floor', 'basement', [-3.9, by + 0.08, 5.3], 'beside the boiler'),
  S('sp_roof_stash', 'ground', [8.4, 3.13, 6.2], 'a stash on the garage roof'),
  S('sp_porch', 'ground', [1.1, 0.1, 9.2], 'under the porch bench'),
  S('sp_tun_desk', 'basement', [5.35, by + 0.82, -1.7], 'the forgotten desk'),
  S('sp_shed_floor', 'ground', [-22.4, 0.08, -19.9], 'the woodshed floor'),
];

export const SPAWN_BY_ID: Record<string, SpawnPointDef> = Object.fromEntries(
  SPAWN_POINTS.map((s) => [s.id, s])
);

/* ------------------------------------------------------------------ */
/* Vents                                                               */
/* ------------------------------------------------------------------ */

export const VENTS: VentDef[] = [
  { id: 'vent_study', floor: 'ground', a: [0.6, -6.5], b: [1.4, -6.5] },
  { id: 'vent_boiler', floor: 'basement', a: [-4, -0.45], b: [-4, 0.45] },
];

/* ------------------------------------------------------------------ */
/* Exterior                                                            */
/* ------------------------------------------------------------------ */

export const EXTERIOR = {
  /** Iron fence perimeter (walkable yard is inside). */
  fence: { x0: -28, z0: -28, x1: 28, z1: 28, height: 2.5 },
  /** Front gate on the south fence. */
  gate: { x0: 5.6, x1: 8.6, z: 28 },
  driveway: { x0: 5.4, z0: 8, x1: 8.8, z1: 28.4 },
  walkway: { x0: -2.2, z0: 8, x1: -0.8, z1: 12.5 },
  porch: { x0: -3.2, z0: 8, x1: 1.6, z1: 10.2 },
  shed: { x0: -23.4, z0: -21.6, x1: -19.8, z1: -18.8, doorAt: -21 },
  garageRoof: { x0: 4, z0: -2, x1: 10, z1: 8, y: 3.02, parapet: 0.42 },
  /** Where the player escapes for each ending trigger. */
  gateExit: [7.1, 0, 30.5] as Vec3,
} as const;

/** House footprint per floor (used by nav + exterior checks). */
export const HOUSE_RECT: Record<Exclude<FloorId, 'attic'>, [number, number, number, number]> = {
  ground: [-10, -8, 10, 8],
  upper: [-10, -8, 4, 8],
  basement: [-6, -6, 6, 6.5],
};

/* ------------------------------------------------------------------ */
/* Queries                                                             */
/* ------------------------------------------------------------------ */

export function roomAt(floor: FloorId, x: number, z: number): RoomDef | null {
  for (const r of ROOMS) {
    if (r.floor === floor && pointInRect(x, z, r.rect)) return r;
  }
  return null;
}

export function floorIdAtY(y: number): FloorId {
  if (y < FLOOR_Y.ground - 0.8) return 'basement';
  if (y < FLOOR_Y.upper - 0.8) return 'ground';
  if (y < FLOOR_Y.attic - 0.8) return 'upper';
  return 'attic';
}

export function isOutside(x: number, z: number): boolean {
  return !pointInRect(x, z, HOUSE_RECT.ground);
}

/** Player spawn: just inside the front door, facing into the house. */
export const PLAYER_SPAWN: Vec3 = [-1.5, 0, 6.6];
export const PLAYER_SPAWN_YAW = 0; // yaw 0 faces -Z (north, into the house)

/** The Keeper starts dormant in the boiler room. */
export const ENEMY_SPAWN: { pos: Vec3; floor: FloorId } = {
  pos: [-2.5, FLOOR_Y.basement, 3],
  floor: 'basement',
};

/** Rect subtraction used for floor slabs with stair holes. */
export function subtractHole(
  rect: [number, number, number, number],
  hole: [number, number, number, number]
): [number, number, number, number][] {
  const [rx0, rz0, rx1, rz1] = rect;
  const hx0 = Math.max(rx0, hole[0]);
  const hz0 = Math.max(rz0, hole[1]);
  const hx1 = Math.min(rx1, hole[2]);
  const hz1 = Math.min(rz1, hole[3]);
  if (hx0 >= hx1 || hz0 >= hz1) return [rect];
  const out: [number, number, number, number][] = [];
  if (hz0 > rz0) out.push([rx0, rz0, rx1, hz0]); // south band
  if (hz1 < rz1) out.push([rx0, hz1, rx1, rz1]); // north band
  if (hx0 > rx0) out.push([rx0, hz0, hx0, hz1]); // west band
  if (hx1 < rx1) out.push([hx1, hz0, rx1, hz1]); // east band
  return out;
}

/** Floor slab rects (room rects minus stair holes) per floor. */
export function floorSlabs(
  floor: FloorId
): { rect: [number, number, number, number]; mat: RoomDef['floorMat'] }[] {
  const holes = STAIR_HOLES.filter((h) => h.floor === floor).map((h) => h.rect);
  const out: { rect: [number, number, number, number]; mat: RoomDef['floorMat'] }[] = [];
  for (const room of ROOMS.filter((r) => r.floor === floor)) {
    let rects: [number, number, number, number][] = [room.rect];
    for (const hole of holes) {
      rects = rects.flatMap((r) => subtractHole(r, hole));
    }
    for (const rect of rects) out.push({ rect, mat: room.floorMat });
  }
  return out;
}
