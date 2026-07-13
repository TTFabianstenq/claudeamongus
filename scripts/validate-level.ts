/**
 * Level sanity checker — run with `npm run validate:level`.
 *
 * Verifies that the Keeper's nav grid is fully connected: every patrol room
 * must be reachable from the player spawn, and key gameplay spots must be
 * walkable. Fails loudly if a wall/door/furniture edit breaks traversal.
 */

import { getNavGrid, PATROL_ROOMS, NavFloor } from '../game/ai/navgrid';
import {
  PLAYER_SPAWN,
  SPAWN_POINTS,
  HIDE_SPOTS,
  FURNITURE,
  ROOM_BY_ID,
} from '../game/levels/layout';
import { pointInRect } from '../game/utils/math';

let failures = 0;
const fail = (msg: string) => {
  failures++;
  console.error(`  ✗ ${msg}`);
};
const ok = (msg: string) => console.log(`  ✓ ${msg}`);

const grid = getNavGrid();
const allDoors = () => true;
const start = { floor: 'ground' as NavFloor, x: PLAYER_SPAWN[0], z: PLAYER_SPAWN[2] };

console.log('Room reachability (all doors open):');
for (const room of PATROL_ROOMS) {
  const path = grid.findPath(start, { floor: room.floor, x: room.x, z: room.z }, allDoors);
  if (!path) fail(`no path to ${room.id} (${room.floor})`);
  else ok(`${room.id} (${room.floor}) — ${path.length} waypoints`);
}

console.log('\nHide spot check positions walkable:');
for (const h of HIDE_SPOTS) {
  if (h.floor === 'attic') continue;
  const near = grid.nearest(h.floor as NavFloor, h.checkFrom[0], h.checkFrom[2], 3);
  if (!near) fail(`hide spot ${h.id} check position unreachable`);
  else ok(h.id);
}

console.log('\nSpawn point rooms exist:');
for (const s of SPAWN_POINTS) {
  if (s.container && !FURNITURE.some((f) => f.id === s.container)) {
    fail(`spawn ${s.id} references missing container ${s.container}`);
  }
}
ok(`${SPAWN_POINTS.length} spawn points checked`);

console.log('\nFurniture inside its room (or exterior):');
for (const f of FURNITURE) {
  if (f.id.startsWith('shed_')) continue; // exterior woodshed
  const inRoom = Object.values(ROOM_BY_ID).some(
    (r) => r.floor === f.floor && pointInRect(f.pos[0], f.pos[1], r.rect, 0.3)
  );
  if (!inRoom) fail(`furniture ${f.id} at (${f.pos}) is outside every ${f.floor} room`);
}
ok(`${FURNITURE.length} furniture pieces checked`);

console.log('\nYard reachability (front door open):');
const yardPath = grid.findPath(start, { floor: 'ground', x: 7, z: 20 }, allDoors);
if (!yardPath) fail('cannot reach driveway from foyer');
else ok(`driveway reachable — ${yardPath.length} waypoints`);

const shedPath = grid.findPath(start, { floor: 'ground', x: -21.5, z: -20 }, allDoors);
if (!shedPath) fail('cannot reach woodshed interior');
else ok(`woodshed reachable — ${shedPath.length} waypoints`);

if (failures > 0) {
  console.error(`\n${failures} validation failure(s).`);
  process.exit(1);
}
console.log('\nLevel OK.');
