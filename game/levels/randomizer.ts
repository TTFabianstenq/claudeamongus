/**
 * Per-run randomisation. A single seed deterministically decides:
 *  - where every key item and tool spawns (from hand-authored candidate pools)
 *  - the safe combination and the cellar hatch keypad code
 *  - what the safe protects
 *  - which spare spots hold batteries / bandages
 *
 * Every layout is verified solvable by construction: each pool only contains
 * locations reachable without the item being placed (see comments).
 */

import { ItemId, NoteId } from '@/game/types';
import { RNG } from '@/game/utils/rng';
import { SPAWN_POINTS } from '@/game/levels/layout';

export type SpawnContent =
  { type: 'item'; id: ItemId } | { type: 'note'; id: NoteId } | { type: 'empty' };

export interface RunConfig {
  seed: number;
  contents: Record<string, SpawnContent>;
  safeCode: [number, number, number];
  hatchCode: string;
  /** What the safe protects this run. */
  safeLoot: ItemId;
}

/**
 * Candidate pools. Solvability invariants:
 *  - key_study never spawns inside the study (which it unlocks) — but the
 *    study is also reachable keylessly via the washroom vent or the library
 *    bookcase, so even study spots would be legal for other items.
 *  - key_basement only spawns in always-open ground-floor areas.
 *  - key_master never spawns inside the master bedroom.
 *  - fuse/crowbar/bolt cutter pools avoid the forgotten room (behind their
 *    own puzzle chain).
 */
const POOLS: Partial<Record<ItemId, string[]>> = {
  key_study: ['sp_mas_night1', 'sp_kit_counter1', 'sp_foy_console', 'sp_lau_shelf', 'sp_din_side'],
  key_master: ['sp_study_desk', 'sp_lib_desk', 'sp_lou_chest', 'sp_hall_table', 'sp_study_file'],
  key_basement: ['sp_kit_counter2', 'sp_bath1_cab', 'sp_sto_shelf1', 'sp_chi_toy', 'sp_foy_bench'],
  key_car: ['sp_mas_dresser', 'sp_gar_bench', 'sp_study_file', 'sp_gue_dresser'],
  fuse: ['sp_cel_shelf1', 'sp_gar_shelf', 'sp_sew_table', 'sp_att_trunk', 'sp_sto_shelf2'],
  gas_can: ['sp_gar_floor', 'sp_shed_floor', 'sp_sto_crates'],
  crowbar: ['sp_boi_floor', 'sp_gar_bench', 'sp_sto_crates', 'sp_shed_shelf'],
  bolt_cutters: ['sp_boi_bench', 'sp_gar_shelf', 'sp_shed_shelf', 'sp_cel_shelf2'],
  wire_cutters: [
    'sp_kit_counter1',
    'sp_gar_bench',
    'sp_sew_table',
    'sp_study_file',
    'sp_lau_shelf',
  ],
};

const NOTE_POOLS: Partial<Record<NoteId, string[]>> = {
  note_safe: ['sp_mas_night2', 'sp_chi_desk', 'sp_bath2_cab', 'sp_lou_chest'],
  note_code_a: ['sp_study_desk', 'sp_lib_desk', 'sp_boi_bench', 'sp_hall_table'],
  note_code_b: ['sp_att_trunk', 'sp_mas_dresser', 'sp_att_crates', 'sp_cel_shelf1'],
};

/** Lore notes with fixed homes. */
const FIXED_NOTES: [NoteId, string][] = [
  ['note_welcome', 'sp_porch'],
  ['note_keeper', 'sp_tun_desk'],
  ['note_cellar', 'sp_cel_shelf2'],
  ['note_child', 'sp_chi_toy'],
  ['note_generator', 'sp_gar_bench'],
];

export function generateRun(seed: number): RunConfig {
  const rng = new RNG(seed).fork('run');
  const contents: Record<string, SpawnContent> = {};
  const taken = new Set<string>();

  const place = (content: SpawnContent, pool: string[]): void => {
    for (const id of rng.shuffle(pool)) {
      if (!taken.has(id)) {
        taken.add(id);
        contents[id] = content;
        return;
      }
    }
    // Pools are sized so this cannot happen, but never strand a key item.
    const free = SPAWN_POINTS.find((s) => !taken.has(s.id));
    if (free) {
      taken.add(free.id);
      contents[free.id] = content;
    }
  };

  // The safe protects either the car key or the bolt cutters this run.
  const safeLoot: ItemId = rng.chance(0.5) ? 'key_car' : 'bolt_cutters';

  // Keys and tools, most constrained first.
  const order: ItemId[] = [
    'key_basement',
    'key_study',
    'key_master',
    'gas_can',
    'crowbar',
    'fuse',
    'wire_cutters',
  ];
  for (const item of order) place({ type: 'item', id: item }, POOLS[item]!);
  if (safeLoot !== 'key_car') place({ type: 'item', id: 'key_car' }, POOLS.key_car!);
  if (safeLoot !== 'bolt_cutters') {
    place({ type: 'item', id: 'bolt_cutters' }, POOLS.bolt_cutters!);
  }

  // Puzzle notes.
  for (const [note, pool] of Object.entries(NOTE_POOLS) as [NoteId, string[]][]) {
    place({ type: 'note', id: note }, pool);
  }
  for (const [note, spot] of FIXED_NOTES) {
    if (!taken.has(spot)) {
      taken.add(spot);
      contents[spot] = { type: 'note', id: note };
    }
  }

  // Consumables into leftover spots.
  const leftovers = rng.shuffle(SPAWN_POINTS.filter((s) => !taken.has(s.id)).map((s) => s.id));
  let batteries = 5;
  let bandages = 4;
  for (const id of leftovers) {
    if (batteries > 0) {
      contents[id] = { type: 'item', id: 'battery' };
      batteries--;
    } else if (bandages > 0) {
      contents[id] = { type: 'item', id: 'bandage' };
      bandages--;
    } else {
      contents[id] = { type: 'empty' };
    }
    taken.add(id);
  }

  const safeCode: [number, number, number] = [rng.int(0, 9), rng.int(0, 9), rng.int(0, 9)];
  let hatchCode = '';
  for (let i = 0; i < 4; i++) hatchCode += rng.int(0, 9).toString();

  return { seed, contents, safeCode, hatchCode, safeLoot };
}
