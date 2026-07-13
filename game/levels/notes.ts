/**
 * All readable documents in the game. Entirely original writing.
 * Code notes are templated with the run's randomised digits.
 */

import { NoteId } from '@/game/types';
import { RunConfig } from '@/game/levels/randomizer';

export interface NoteContent {
  title: string;
  body: string;
}

export function getNote(id: NoteId, run: RunConfig): NoteContent {
  switch (id) {
    case 'note_welcome':
      return {
        title: 'Delivery slip — return to sender',
        body:
          `Hollowmoor House, Braecken Lane\n\n` +
          `Third attempt. Nobody answers, but the lamps burn and the walks are swept, ` +
          `so somebody keeps this place. Left the parcel under the bench.\n\n` +
          `If the Vessers have moved on, the postmaster should strike this route. ` +
          `The drive gate was chained tonight. It was open an hour ago. ` +
          `I did not hear anyone chain it.`,
      };
    case 'note_keeper':
      return {
        title: 'Journal of E. Vesser — last page',
        body:
          `It was our groundskeeper once. I believe that, even now. It still walks his rounds — ` +
          `cellar, stair, landing, cellar again — the way he did for thirty years, ` +
          `only it does not carry the lantern anymore. It does not need one.\n\n` +
          `It listens. Lord help us, it listens better than it sees. We learned to walk ` +
          `in stockinged feet, to let the thunder cover the stairs.\n\n` +
          `We dug the passage out of the old coal room years ago, for storms. ` +
          `Margaret has the numbers split in two, half in my study things, half put away upstairs. ` +
          `If you have found this room, you are close. Do not run. Running is a sound.`,
      };
    case 'note_safe':
      return {
        title: "Margaret's reminder card",
        body:
          `E. keeps forgetting, so I am writing it plain and hiding it badly:\n\n` +
          `The study safe turns to ${run.safeCode[0]}, then ${run.safeCode[1]}, then ${run.safeCode[2]}.\n\n` +
          `Left, right, left — the way you'd scold a child, he says. ` +
          `Whatever matters most, that is where it sleeps.`,
      };
    case 'note_code_a':
      return {
        title: 'Ledger corner, torn',
        body:
          `…coal room hatch fitted with the number lock, as agreed.\n\n` +
          `First half of the figure: ${run.hatchCode.slice(0, 2)}\n\n` +
          `Margaret keeps the rest with the winter things, up where the dust settles. ` +
          `Do not write them together again. It reads what we leave out.`,
      };
    case 'note_code_b':
      return {
        title: 'Sewing tin slip',
        body:
          `Second half, as E. asked: ${run.hatchCode.slice(2)}\n\n` +
          `Stitched the first half into his ledger like a hem. ` +
          `Two halves make a door. God willing we never need it.`,
      };
    case 'note_cellar':
      return {
        title: 'Chalk on a shelf board',
        body:
          `THE SHELF ON THE EAST WALL IS LIGHTER THAN IT LOOKS.\n\n` +
          `(beneath, in older chalk)\n` +
          `it counts the steps when it walks. count with it. ` +
          `when the counting stops, be somewhere small.`,
      };
    case 'note_child':
      return {
        title: "A child's drawing",
        body:
          `A crayon house with three floors. Every window is filled in black except one.\n\n` +
          `In the garden stands a tall thin figure, taller than the door it is drawn beside. ` +
          `Where a face should be, the paper has been rubbed through.\n\n` +
          `At the bottom, in careful letters:\n` +
          `"MR GREY DOES NOT LIKE THE LIGHTS ON. TOMMY HID IN THE WARDROBE AND MR GREY FOUND HIM. ` +
          `HE ALWAYS FINDS THE SAME PLACE TWICE."`,
      };
    case 'note_generator':
      return {
        title: 'Maintenance tag',
        body:
          `Generator serviced in autumn. Runs loud — warn the house before you pull the cord, ` +
          `it wakes the whole property.\n\n` +
          `Mains panel in the cellar is missing its main fuse again. Third one this year. ` +
          `They do not blow. They are REMOVED. I have stopped asking who by.\n\n` +
          `Panel cover is wired shut. Bring cutters.`,
      };
  }
}

export const NOTE_ORDER: NoteId[] = [
  'note_welcome',
  'note_cellar',
  'note_generator',
  'note_child',
  'note_safe',
  'note_code_a',
  'note_code_b',
  'note_keeper',
];
