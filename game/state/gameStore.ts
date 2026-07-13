/**
 * The authoritative game state: phase, inventory, puzzle flags, doors,
 * objectives, vitals. World entities mutate it through actions; the save
 * system serialises it. Per-frame transient data lives in `runtime.ts`.
 */

import { create } from 'zustand';
import {
  Difficulty,
  DoorState,
  EndingId,
  GameFlags,
  GamePhase,
  ItemId,
  ITEMS,
  NoteId,
  Objective,
  Overlay,
  SaveData,
} from '@/game/types';
import { DOORS } from '@/game/levels/layout';
import { generateRun, RunConfig } from '@/game/levels/randomizer';
import { newGameSeed } from '@/game/utils/rng';
import { useHud } from '@/game/state/hudStore';
import { RT } from '@/game/state/runtime';

function initialDoors(): Record<string, DoorState> {
  const doors: Record<string, DoorState> = {};
  for (const d of DOORS) {
    doors[d.id] = { open: d.open ?? false, locked: !!d.lockId, broken: false };
  }
  return doors;
}

function initialFlags(): GameFlags {
  return {
    panelOpened: false,
    fuseInstalled: false,
    powerOn: false,
    generatorFueled: false,
    generatorOn: false,
    garagePower: false,
    garageOpen: false,
    gateChainCut: false,
    gateOpen: false,
    shelfMoved: false,
    bookcaseOpen: false,
    hatchPried: false,
    hatchOpen: false,
    safeOpen: false,
    carUnlocked: false,
    backDoorPried: false,
    atticLadder: false,
    radioOn: false,
    sawGate: false,
    sawCar: false,
    sawHatch: false,
    sawPanel: false,
    sawGenerator: false,
    keeperAwake: false,
  };
}

const ROOT_OBJECTIVE: Objective = {
  id: 'obj_escape',
  text: 'Find a way off the Hollowmoor property',
  done: false,
};

export interface GameState {
  phase: GamePhase;
  overlay: Overlay;
  difficulty: Difficulty;
  seed: number;
  run: RunConfig | null;
  ending: EndingId | null;
  timePlayed: number;
  /** Save data waiting to be applied by the world on mount. */
  pendingLoad: SaveData | null;
  /** Bumped every new game so the canvas remounts a fresh world. */
  worldEpoch: number;

  health: number;
  stamina: number;
  battery: number;

  inventory: Partial<Record<ItemId, number>>;
  notesFound: NoteId[];
  currentNote: NoteId | null;
  keypadTarget: 'hatch' | null;

  flags: GameFlags;
  doors: Record<string, DoorState>;
  objectives: Objective[];
  takenSpawns: string[];
  searchedContainers: string[];
  brokenWindows: string[];
  litRooms: Record<string, boolean>;

  // --- actions ---
  newGame: (difficulty: Difficulty) => void;
  loadGame: (save: SaveData) => void;
  clearPendingLoad: () => void;
  setPhase: (phase: GamePhase) => void;
  setOverlay: (overlay: Overlay) => void;
  openKeypad: (target: 'hatch') => void;
  backToMenu: () => void;
  tick: (dt: number) => void;

  setVitals: (health: number, stamina: number, battery: number) => void;
  damage: (amount: number) => void;
  heal: (amount: number) => void;

  addItem: (id: ItemId, silent?: boolean) => void;
  removeItem: (id: ItemId) => void;
  hasItem: (id: ItemId) => boolean;
  countItem: (id: ItemId) => number;
  useBandage: () => boolean;
  useBattery: () => boolean;

  collectNote: (id: NoteId) => void;
  openNote: (id: NoteId) => void;

  setDoor: (id: string, patch: Partial<DoorState>) => void;
  setFlag: (key: keyof GameFlags, value?: boolean) => void;
  takeSpawn: (id: string) => void;
  markSearched: (id: string) => void;
  breakWindow: (id: string) => void;
  toggleRoomLight: (roomId: string) => void;

  addObjective: (id: string, text: string) => void;
  completeObjective: (id: string) => void;

  die: () => void;
  win: (ending: EndingId) => void;
}

const toast = (text: string, kind?: 'item' | 'info' | 'objective') =>
  useHud.getState().toast(text, kind);

export const useGame = create<GameState>()((set, get) => ({
  phase: 'menu',
  overlay: null,
  difficulty: 'standard',
  seed: 0,
  run: null,
  ending: null,
  timePlayed: 0,
  pendingLoad: null,
  worldEpoch: 0,

  health: 100,
  stamina: 100,
  battery: 100,

  inventory: {},
  notesFound: [],
  currentNote: null,
  keypadTarget: null,

  flags: initialFlags(),
  doors: initialDoors(),
  objectives: [ROOT_OBJECTIVE],
  takenSpawns: [],
  searchedContainers: [],
  brokenWindows: [],
  litRooms: {},

  newGame: (difficulty) => {
    const seed = newGameSeed();
    RT.reset();
    set((s) => ({
      phase: 'loading',
      overlay: null,
      difficulty,
      seed,
      run: generateRun(seed),
      ending: null,
      timePlayed: 0,
      pendingLoad: null,
      worldEpoch: s.worldEpoch + 1,
      health: 100,
      stamina: 100,
      battery: 100,
      inventory: {},
      notesFound: [],
      currentNote: null,
      keypadTarget: null,
      flags: initialFlags(),
      doors: initialDoors(),
      objectives: [{ ...ROOT_OBJECTIVE }],
      takenSpawns: [],
      searchedContainers: [],
      brokenWindows: [],
      litRooms: {},
    }));
  },

  loadGame: (save) => {
    RT.reset();
    RT.habits = save.habits;
    RT.enemy.aggression = save.enemy.aggression;
    set((s) => ({
      phase: 'loading',
      overlay: null,
      difficulty: save.difficulty,
      seed: save.seed,
      run: generateRun(save.seed),
      ending: null,
      timePlayed: save.timePlayed,
      pendingLoad: save,
      worldEpoch: s.worldEpoch + 1,
      health: save.player.health,
      stamina: save.player.stamina,
      battery: save.player.battery,
      inventory: { ...save.inventory },
      notesFound: [...save.notesFound],
      currentNote: null,
      keypadTarget: null,
      flags: { ...save.flags },
      doors: Object.fromEntries(Object.entries(save.doors).map(([k, v]) => [k, { ...v }])),
      objectives: save.objectives.map((o) => ({ ...o })),
      takenSpawns: [...save.takenSpawns],
      searchedContainers: [...save.searchedContainers],
      brokenWindows: [...save.brokenWindows],
      litRooms: Object.fromEntries(save.litRooms.map((r) => [r, true])),
    }));
  },

  clearPendingLoad: () => set({ pendingLoad: null }),

  setPhase: (phase) => set({ phase }),
  setOverlay: (overlay) => set({ overlay }),
  openKeypad: (target) => set({ overlay: 'keypad', keypadTarget: target }),

  backToMenu: () => {
    RT.reset();
    set({ phase: 'menu', overlay: null, currentNote: null });
  },

  tick: (dt) => set((s) => ({ timePlayed: s.timePlayed + dt })),

  setVitals: (health, stamina, battery) => set({ health, stamina, battery }),

  damage: (amount) => {
    const s = get();
    if (s.phase !== 'playing') return;
    const health = Math.max(0, s.health - amount);
    set({ health });
    useHud.getState().flashDamage();
    RT.shake = Math.min(1.5, RT.shake + 0.7);
    if (health <= 0) get().die();
  },

  heal: (amount) => set((s) => ({ health: Math.min(100, s.health + amount) })),

  addItem: (id, silent) => {
    set((s) => ({
      inventory: { ...s.inventory, [id]: (s.inventory[id] ?? 0) + 1 },
    }));
    if (!silent) toast(`Taken: ${ITEMS[id].name}`, 'item');

    // Objective ripples from key pickups.
    const g = get();
    if (id === 'bolt_cutters' && g.flags.sawGate) {
      g.completeObjective('obj_cutters');
    }
    if (id === 'key_car' && g.flags.sawCar) g.completeObjective('obj_carkey');
  },

  removeItem: (id) =>
    set((s) => {
      const n = (s.inventory[id] ?? 0) - 1;
      const inventory = { ...s.inventory };
      if (n <= 0) delete inventory[id];
      else inventory[id] = n;
      return { inventory };
    }),

  hasItem: (id) => (get().inventory[id] ?? 0) > 0,
  countItem: (id) => get().inventory[id] ?? 0,

  useBandage: () => {
    const s = get();
    if (!s.hasItem('bandage') || s.health >= 100) return false;
    s.removeItem('bandage');
    s.heal(40);
    toast('You bind the wound.', 'info');
    return true;
  },

  useBattery: () => {
    const s = get();
    if (!s.hasItem('battery') || s.battery > 95) return false;
    s.removeItem('battery');
    set({ battery: 100 });
    toast('Fresh battery in the flashlight.', 'item');
    return true;
  },

  collectNote: (id) => {
    if (get().notesFound.includes(id)) return;
    set((s) => ({ notesFound: [...s.notesFound, id] }));
    if (id === 'note_code_a' || id === 'note_code_b') {
      const g = get();
      if (g.notesFound.includes('note_code_a') && g.notesFound.includes('note_code_b')) {
        g.completeObjective('obj_code');
        if (g.flags.sawHatch) toast('You have both halves of the hatch code.', 'objective');
      }
    }
    if (id === 'note_safe') get().completeObjective('obj_safenote');
  },

  openNote: (id) => set({ currentNote: id, overlay: 'note' }),

  setDoor: (id, patch) =>
    set((s) => ({ doors: { ...s.doors, [id]: { ...s.doors[id], ...patch } } })),

  setFlag: (key, value = true) => {
    const before = get().flags[key];
    if (before === value) return;
    set((s) => ({ flags: { ...s.flags, [key]: value } }));
    const g = get();

    switch (key) {
      case 'sawGate':
        g.addObjective('obj_cutters', 'Find something to cut the gate chain');
        if (g.hasItem('bolt_cutters')) g.completeObjective('obj_cutters');
        break;
      case 'sawCar':
        g.addObjective('obj_carkey', 'Find the car key');
        g.addObjective('obj_garage', 'Get power to the garage door');
        if (g.hasItem('key_car')) g.completeObjective('obj_carkey');
        break;
      case 'sawHatch':
        g.addObjective('obj_code', 'Find both halves of the hatch code');
        if (!g.flags.hatchPried) g.addObjective('obj_pry', 'Pry the hatch plate open');
        if (g.notesFound.includes('note_code_a') && g.notesFound.includes('note_code_b')) {
          g.completeObjective('obj_code');
        }
        break;
      case 'sawPanel':
        g.addObjective('obj_power', 'Restore mains power at the cellar panel');
        break;
      case 'powerOn':
        g.completeObjective('obj_power');
        g.completeObjective('obj_garage');
        set((s) => ({ flags: { ...s.flags, garagePower: true } }));
        toast('The house hums back to life.', 'objective');
        break;
      case 'generatorOn':
        g.completeObjective('obj_garage');
        set((s) => ({ flags: { ...s.flags, garagePower: true } }));
        break;
      case 'gateChainCut':
        g.completeObjective('obj_cutters');
        break;
      case 'hatchPried':
        g.completeObjective('obj_pry');
        break;
      case 'safeOpen':
        g.completeObjective('obj_safenote');
        break;
      default:
        break;
    }
  },

  takeSpawn: (id) => set((s) => ({ takenSpawns: [...s.takenSpawns, id] })),
  markSearched: (id) =>
    set((s) =>
      s.searchedContainers.includes(id) ? s : { searchedContainers: [...s.searchedContainers, id] }
    ),
  breakWindow: (id) =>
    set((s) => (s.brokenWindows.includes(id) ? s : { brokenWindows: [...s.brokenWindows, id] })),

  toggleRoomLight: (roomId) =>
    set((s) => ({ litRooms: { ...s.litRooms, [roomId]: !s.litRooms[roomId] } })),

  addObjective: (id, text) => {
    if (get().objectives.some((o) => o.id === id)) return;
    set((s) => ({ objectives: [...s.objectives, { id, text, done: false }] }));
    toast(text, 'objective');
  },

  completeObjective: (id) => {
    const o = get().objectives.find((x) => x.id === id);
    if (!o || o.done) return;
    set((s) => ({
      objectives: s.objectives.map((x) => (x.id === id ? { ...x, done: true } : x)),
    }));
  },

  die: () => {
    if (get().phase !== 'playing') return;
    RT.player.dead = true;
    RT.habits.deaths += 1;
    set({ phase: 'dead', overlay: null });
  },

  win: (ending) => {
    if (get().phase !== 'playing') return;
    set((s) => ({
      phase: 'victory',
      ending,
      overlay: null,
      objectives: s.objectives.map((o) => (o.id === 'obj_escape' ? { ...o, done: true } : o)),
    }));
  },
}));

/** Convenience: is the world simulation running this frame? */
export function worldActive(): boolean {
  const s = useGame.getState();
  return s.phase === 'playing' && s.overlay === null;
}
