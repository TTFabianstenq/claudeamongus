/**
 * Shared type vocabulary for HOLLOWMOOR.
 *
 * Everything in the game — geometry, physics colliders, the enemy nav grid,
 * loot randomisation and the save file — is derived from the declarative
 * level data typed here, so this module is deliberately dependency-free
 * (it must be importable from Node for the level validation script).
 */

export type Vec2 = [number, number];
export type Vec3 = [number, number, number];

/* ------------------------------------------------------------------ */
/* World structure                                                     */
/* ------------------------------------------------------------------ */

export type FloorId = 'basement' | 'ground' | 'upper' | 'attic';

/** Y of the walkable floor surface per storey. */
export const FLOOR_Y: Record<FloorId, number> = {
  basement: -2.9,
  ground: 0,
  upper: 3.1,
  attic: 6.1,
};

/** Interior wall height per storey. */
export const WALL_H: Record<FloorId, number> = {
  basement: 2.55,
  ground: 2.9,
  upper: 2.7,
  attic: 2.3,
};

export const WALL_T = 0.16; // wall thickness

export type FloorMat = 'wood' | 'darkwood' | 'tile' | 'concrete' | 'carpet' | 'grass' | 'asphalt';

export type WallMat = 'plaster' | 'wallpaper' | 'wainscot' | 'brick' | 'concrete' | 'planks';

export interface Opening {
  /** Distance along the wall from `from` to the opening centre. */
  at: number;
  width: number;
  /** Bottom of the opening above the floor (0 = door). */
  bottom?: number;
  /** Top of the opening above the floor. Defaults to door height. */
  top?: number;
}

export interface WallDef {
  floor: FloorId;
  from: Vec2;
  to: Vec2;
  mat?: WallMat;
  height?: number;
  openings?: Opening[];
}

export interface RoomDef {
  id: string;
  name: string;
  floor: FloorId;
  /** [x0, z0, x1, z1] inner rectangle. */
  rect: [number, number, number, number];
  floorMat: FloorMat;
  wallMat?: WallMat;
  /** Rooms without ceilings (attic uses the roof, exterior none). */
  ceiling?: boolean;
  /** Creaky floorboards chance while walking (upper wooden floors). */
  creaky?: boolean;
}

export type DoorKind = 'interior' | 'exterior' | 'closet' | 'metal';

export interface DoorDef {
  id: string;
  floor: FloorId;
  /** Hinge position. */
  pos: Vec2;
  /** Wall direction the door sits in (radians, 0 = +X). */
  rotY: number;
  width?: number;
  height?: number;
  /** Item required to unlock, if locked. */
  lockId?: string;
  kind?: DoorKind;
  /** Locked doors the Keeper may smash while chasing. */
  breakable?: boolean;
  /** Starts open. */
  open?: boolean;
}

export interface WindowDef {
  id: string;
  floor: FloorId;
  pos: Vec2;
  rotY: number;
  width?: number;
  boarded?: boolean;
}

export interface StairDef {
  id: string;
  lower: FloorId;
  upper: FloorId;
  /** Centre of the bottom step. */
  base: Vec2;
  /** Direction of ascent (radians, 0 = +X, PI/2 = -Z). */
  dir: number;
  length: number;
  width: number;
}

/* ------------------------------------------------------------------ */
/* Furniture                                                           */
/* ------------------------------------------------------------------ */

export type FurnKind =
  | 'sofa'
  | 'armchair'
  | 'coffeetable'
  | 'diningtable'
  | 'chair'
  | 'sideboard'
  | 'bookshelf'
  | 'shelf'
  | 'counter'
  | 'stove'
  | 'icebox'
  | 'sink'
  | 'toilet'
  | 'bathtub'
  | 'cabinet'
  | 'washer'
  | 'desk'
  | 'bed'
  | 'singlebed'
  | 'wardrobe'
  | 'dresser'
  | 'nightstand'
  | 'toychest'
  | 'trunk'
  | 'crate'
  | 'cratestack'
  | 'workbench'
  | 'boiler'
  | 'fusebox'
  | 'generator'
  | 'car'
  | 'piano'
  | 'radio'
  | 'clock'
  | 'coatstand'
  | 'mannequin'
  | 'rockinghorse'
  | 'rockingchair'
  | 'mirror'
  | 'lamp'
  | 'rug'
  | 'pantry'
  | 'barrel'
  | 'firewood'
  | 'bin'
  | 'safe';

export interface FurnDef {
  id: string;
  kind: FurnKind;
  floor: FloorId;
  pos: Vec2;
  rotY?: number;
}

export interface FurnSpec {
  /** Footprint width/depth/height used for nav blocking and colliders. */
  size: Vec3;
  /** Blocks the Keeper's navigation grid. */
  blocksNav: boolean;
  /** Gets a physics collider. */
  solid: boolean;
}

/* ------------------------------------------------------------------ */
/* Lights, loot, hiding, misc entities                                 */
/* ------------------------------------------------------------------ */

export interface LightFixtureDef {
  id: string;
  floor: FloorId;
  /** XZ position; hangs from the ceiling of its room. */
  pos: Vec2;
  room: string;
  color?: string;
  intensity?: number;
  /** 0..1 – persistent flicker (bad wiring). */
  flicker?: number;
  /** Works without mains power (battery lantern / pull-cord bulb). */
  offGrid?: boolean;
}

/** A place where randomised loot may appear. */
export interface SpawnPointDef {
  id: string;
  floor: FloorId;
  pos: Vec3;
  /** If set, the item is inside a container (drawer, crate…) with this furniture id. */
  container?: string;
  /** Human description used for hints. */
  where: string;
}

export type HideKind = 'wardrobe' | 'bed' | 'pantry';

export interface VentDef {
  id: string;
  floor: FloorId;
  /** The two grate positions (crawl path runs between them). */
  a: Vec2;
  b: Vec2;
}

/* ------------------------------------------------------------------ */
/* Items                                                               */
/* ------------------------------------------------------------------ */

export type ItemId =
  | 'key_study'
  | 'key_master'
  | 'key_basement'
  | 'key_car'
  | 'fuse'
  | 'gas_can'
  | 'crowbar'
  | 'bolt_cutters'
  | 'wire_cutters'
  | 'battery'
  | 'bandage';

export interface ItemInfo {
  name: string;
  desc: string;
  stack: boolean;
}

export const ITEMS: Record<ItemId, ItemInfo> = {
  key_study: {
    name: 'Study Key',
    desc: 'A small brass key. The tag reads "E.V. — study".',
    stack: false,
  },
  key_master: {
    name: 'Bedroom Key',
    desc: 'A worn iron key for the master bedroom.',
    stack: false,
  },
  key_basement: {
    name: 'Cellar Key',
    desc: 'Heavy, cold, smells of rust and earth.',
    stack: false,
  },
  key_car: { name: 'Car Key', desc: 'The key to the estate car in the garage.', stack: false },
  fuse: {
    name: 'Fuse',
    desc: 'A 30A ceramic fuse. The panel downstairs is missing one.',
    stack: false,
  },
  gas_can: {
    name: 'Fuel Can',
    desc: 'Sloshes about half full. Enough for the generator.',
    stack: false,
  },
  crowbar: { name: 'Crowbar', desc: 'Pry boards, hatches and stuck things.', stack: false },
  bolt_cutters: {
    name: 'Bolt Cutters',
    desc: 'Will go through a chain link like butter.',
    stack: false,
  },
  wire_cutters: {
    name: 'Wire Cutters',
    desc: 'For snipping wire — like the wire holding the fuse panel shut.',
    stack: false,
  },
  battery: { name: 'Battery', desc: 'A chunky D-cell for the flashlight.', stack: true },
  bandage: { name: 'Bandage', desc: 'Gauze and tape. Stops the bleeding.', stack: true },
};

export type NoteId =
  | 'note_welcome'
  | 'note_keeper'
  | 'note_safe'
  | 'note_code_a'
  | 'note_code_b'
  | 'note_cellar'
  | 'note_child'
  | 'note_generator';

/* ------------------------------------------------------------------ */
/* Game state                                                          */
/* ------------------------------------------------------------------ */

export type Difficulty = 'mercy' | 'standard' | 'nightmare';
export type GamePhase = 'menu' | 'loading' | 'intro' | 'playing' | 'dead' | 'victory';
export type Overlay =
  null | 'pause' | 'settings' | 'inventory' | 'note' | 'saves' | 'howto' | 'keypad' | 'safe';

export type EndingId = 'gate' | 'car' | 'tunnel';

export type EnemyStateName =
  | 'dormant'
  | 'idle'
  | 'patrol'
  | 'listen'
  | 'suspicious'
  | 'investigate'
  | 'search'
  | 'track'
  | 'chase'
  | 'attack'
  | 'breakdoor'
  | 'return'
  | 'roam';

export interface DoorState {
  open: boolean;
  locked: boolean;
  broken: boolean;
}

export interface GameFlags {
  panelOpened: boolean; // fuse panel wire snipped
  fuseInstalled: boolean;
  powerOn: boolean;
  generatorFueled: boolean;
  generatorOn: boolean;
  garagePower: boolean; // derived convenience flag
  garageOpen: boolean;
  gateChainCut: boolean;
  gateOpen: boolean;
  shelfMoved: boolean; // basement secret shelf
  bookcaseOpen: boolean; // library passage
  hatchPried: boolean;
  hatchOpen: boolean;
  safeOpen: boolean;
  carUnlocked: boolean;
  backDoorPried: boolean;
  atticLadder: boolean;
  radioOn: boolean;
  sawGate: boolean;
  sawCar: boolean;
  sawHatch: boolean;
  sawPanel: boolean;
  sawGenerator: boolean;
  keeperAwake: boolean;
}

export interface Objective {
  id: string;
  text: string;
  done: boolean;
}

/** Learned player habits — persisted so the Keeper remembers across saves. */
export interface HabitMemory {
  hideCounts: Record<HideKind, number>;
  roomHeat: Record<string, number>;
  timesSpotted: number;
  deaths: number;
}

export interface SaveData {
  version: 2;
  savedAt: number;
  seed: number;
  difficulty: Difficulty;
  timePlayed: number;
  phase: 'playing';
  player: {
    pos: Vec3;
    yaw: number;
    health: number;
    stamina: number;
    battery: number;
  };
  inventory: Partial<Record<ItemId, number>>;
  notesFound: NoteId[];
  flags: GameFlags;
  doors: Record<string, DoorState>;
  objectives: Objective[];
  takenSpawns: string[];
  searchedContainers: string[];
  brokenWindows: string[];
  litRooms: string[];
  enemy: {
    pos: Vec3;
    floor: FloorId;
    state: EnemyStateName;
    aggression: number;
  };
  habits: HabitMemory;
}

export interface SaveMeta {
  slot: number;
  savedAt: number;
  timePlayed: number;
  difficulty: Difficulty;
  location: string;
}

/* ------------------------------------------------------------------ */
/* Noise events (heard by the Keeper)                                  */
/* ------------------------------------------------------------------ */

export type NoiseKind =
  | 'footstep'
  | 'door'
  | 'doorSlam'
  | 'drawer'
  | 'impact'
  | 'glass'
  | 'lure'
  | 'machine'
  | 'creak'
  | 'breath';

export interface NoiseEvent {
  x: number;
  y: number;
  z: number;
  loudness: number; // 0..1.5, 1 ≈ running footstep
  kind: NoiseKind;
  t: number;
  fromPlayer: boolean;
}

/* ------------------------------------------------------------------ */
/* Quality settings                                                    */
/* ------------------------------------------------------------------ */

export type Quality = 'low' | 'medium' | 'high' | 'ultra';

export interface QualityConfig {
  dprMax: number;
  shadows: boolean;
  shadowMapSize: number;
  moonShadow: boolean;
  ssao: boolean;
  bloom: boolean;
  smaa: boolean;
  volumetrics: boolean;
  reflections: boolean;
  rainCount: number;
  grassCount: number;
  dustCount: number;
  maxLights: number;
}

export const QUALITY: Record<Quality, QualityConfig> = {
  low: {
    dprMax: 0.85,
    shadows: false,
    shadowMapSize: 512,
    moonShadow: false,
    ssao: false,
    bloom: true,
    smaa: false,
    volumetrics: false,
    reflections: false,
    rainCount: 900,
    grassCount: 600,
    dustCount: 80,
    maxLights: 3,
  },
  medium: {
    dprMax: 1,
    shadows: true,
    shadowMapSize: 1024,
    moonShadow: false,
    ssao: true,
    bloom: true,
    smaa: true,
    volumetrics: true,
    reflections: false,
    rainCount: 1800,
    grassCount: 1400,
    dustCount: 160,
    maxLights: 4,
  },
  high: {
    dprMax: 1.5,
    shadows: true,
    shadowMapSize: 2048,
    moonShadow: true,
    ssao: true,
    bloom: true,
    smaa: true,
    volumetrics: true,
    reflections: true,
    rainCount: 2600,
    grassCount: 2400,
    dustCount: 240,
    maxLights: 6,
  },
  ultra: {
    dprMax: 2,
    shadows: true,
    shadowMapSize: 2048,
    moonShadow: true,
    ssao: true,
    bloom: true,
    smaa: true,
    volumetrics: true,
    reflections: true,
    rainCount: 3600,
    grassCount: 3600,
    dustCount: 320,
    maxLights: 8,
  },
};
