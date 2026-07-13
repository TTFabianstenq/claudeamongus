/**
 * Navigation grid + A* for the Keeper.
 *
 * Three 2D grids (basement / ground incl. yard / upper) generated from the
 * same declarative level data the renderer uses, connected by stair portal
 * edges. Cells carry door tags so the planner knows when a route requires
 * opening (or breaking) a door, and secret passages are modelled as doors
 * the Keeper cannot operate until the player has opened them.
 *
 * The Keeper never teleports: every movement is a walk along a path found
 * here, including stair flights (interpolated waypoints with correct Y).
 */

import { FLOOR_Y, FloorId, StairDef } from '@/game/types';
import {
  ALL_WALL_BOXES,
  DOORS,
  EXTERIOR,
  FURNITURE,
  FURN_SPECS,
  HOUSE_RECT,
  ROOMS,
  STAIRS,
  STAIR_HOLES,
} from '@/game/levels/layout';

export const CELL = 0.5;
const ENEMY_RADIUS = 0.34;

export type NavFloor = Exclude<FloorId, 'attic'>;
const NAV_FLOORS: NavFloor[] = ['basement', 'ground', 'upper'];

interface GridSpec {
  x0: number;
  z0: number;
  w: number;
  h: number;
}

const GRID_SPECS: Record<NavFloor, GridSpec> = {
  ground: { x0: -30, z0: -30, w: 120, h: 122 },
  upper: { x0: -10.5, z0: -8.5, w: 30, h: 35 },
  basement: { x0: -6.5, z0: -6.5, w: 27, h: 28 },
};

export interface NavPoint {
  x: number;
  y: number;
  z: number;
  floor: NavFloor;
  doorId?: string;
  stair?: boolean;
}

interface PortalEdge {
  from: number; // global node id
  to: number;
  cost: number;
  waypoints: NavPoint[]; // interpolated stair points from -> to
}

/** Pseudo-door ids used for secret passages (openable only by the player). */
export const SECRET_BOOKCASE = 'secret_bookcase';
export const SECRET_SHELF = 'secret_shelf';

export class NavGrid {
  private walk: Record<NavFloor, Uint8Array>;
  private door: Record<NavFloor, (string | undefined)[]>;
  private offsets: Record<NavFloor, number>;
  private total: number;
  private portals = new Map<number, PortalEdge[]>();

  constructor() {
    this.walk = {} as Record<NavFloor, Uint8Array>;
    this.door = {} as Record<NavFloor, (string | undefined)[]>;
    this.offsets = {} as Record<NavFloor, number>;
    let off = 0;
    for (const f of NAV_FLOORS) {
      const spec = GRID_SPECS[f];
      this.offsets[f] = off;
      off += spec.w * spec.h;
      this.walk[f] = new Uint8Array(spec.w * spec.h);
      this.door[f] = new Array(spec.w * spec.h);
    }
    this.total = off;
    this.build();
  }

  /* ---------------- construction ---------------- */

  private idx(floor: NavFloor, ix: number, iz: number): number {
    const spec = GRID_SPECS[floor];
    return iz * spec.w + ix;
  }

  private inBounds(floor: NavFloor, ix: number, iz: number): boolean {
    const spec = GRID_SPECS[floor];
    return ix >= 0 && iz >= 0 && ix < spec.w && iz < spec.h;
  }

  cellOf(floor: NavFloor, x: number, z: number): [number, number] {
    const spec = GRID_SPECS[floor];
    return [Math.floor((x - spec.x0) / CELL), Math.floor((z - spec.z0) / CELL)];
  }

  worldOf(floor: NavFloor, ix: number, iz: number): [number, number] {
    const spec = GRID_SPECS[floor];
    return [spec.x0 + (ix + 0.5) * CELL, spec.z0 + (iz + 0.5) * CELL];
  }

  private setRect(
    floor: NavFloor,
    x0: number,
    z0: number,
    x1: number,
    z1: number,
    value: 0 | 1
  ): void {
    const [ix0, iz0] = this.cellOf(floor, Math.min(x0, x1), Math.min(z0, z1));
    const [ix1, iz1] = this.cellOf(floor, Math.max(x0, x1), Math.max(z0, z1));
    for (let iz = Math.max(0, iz0); iz <= iz1; iz++) {
      for (let ix = Math.max(0, ix0); ix <= ix1; ix++) {
        if (this.inBounds(floor, ix, iz)) this.walk[floor][this.idx(floor, ix, iz)] = value;
      }
    }
  }

  private tagRect(
    floor: NavFloor,
    x0: number,
    z0: number,
    x1: number,
    z1: number,
    id: string
  ): void {
    const [ix0, iz0] = this.cellOf(floor, Math.min(x0, x1), Math.min(z0, z1));
    const [ix1, iz1] = this.cellOf(floor, Math.max(x0, x1), Math.max(z0, z1));
    for (let iz = Math.max(0, iz0); iz <= iz1; iz++) {
      for (let ix = Math.max(0, ix0); ix <= ix1; ix++) {
        if (!this.inBounds(floor, ix, iz)) continue;
        const i = this.idx(floor, ix, iz);
        this.walk[floor][i] = 1;
        this.door[floor][i] = id;
      }
    }
  }

  private build(): void {
    // 1. Base walkable areas.
    const f = EXTERIOR.fence;
    this.setRect('ground', f.x0 + 0.5, f.z0 + 0.5, f.x1 - 0.5, f.z1 - 0.5, 1);
    for (const room of ROOMS) {
      if (room.floor === 'upper' || room.floor === 'basement') {
        this.setRect(room.floor, room.rect[0], room.rect[1], room.rect[2], room.rect[3], 1);
      }
    }

    // 2. Walls (only boxes intersecting the walking band block movement).
    for (const box of ALL_WALL_BOXES) {
      if (box.floor === 'attic') continue;
      const floor = box.floor as NavFloor;
      const baseY = FLOOR_Y[floor];
      const y0 = box.cy - box.height / 2 - baseY;
      const y1 = box.cy + box.height / 2 - baseY;
      if (y1 < 0.25 || y0 > 1.7) continue;
      // Rasterise the rotated box footprint (walls are axis-ish; use AABB).
      // Inflate across the thickness only: wall segments already meet at
      // corners, and inflating along the length would choke archways.
      const hl = box.len / 2 + 0.05;
      const ht = box.thick / 2 + ENEMY_RADIUS;
      const c = Math.abs(Math.cos(box.rotY));
      const s = Math.abs(Math.sin(box.rotY));
      const ex = hl * c + ht * s;
      const ez = hl * s + ht * c;
      this.setRect(floor, box.cx - ex, box.cz - ez, box.cx + ex, box.cz + ez, 0);
    }

    // 3. Door openings re-opened and tagged.
    for (const d of DOORS) {
      if (d.floor === 'attic') continue;
      const floor = d.floor as NavFloor;
      const hw = (d.width ?? 0.92) / 2 + 0.1;
      const across = 0.45;
      const alongX = Math.abs(Math.cos(d.rotY)) > 0.5;
      if (alongX) {
        this.tagRect(
          floor,
          d.pos[0] - hw,
          d.pos[1] - across,
          d.pos[0] + hw,
          d.pos[1] + across,
          d.id
        );
      } else {
        this.tagRect(
          floor,
          d.pos[0] - across,
          d.pos[1] - hw,
          d.pos[0] + across,
          d.pos[1] + hw,
          d.id
        );
      }
    }
    // Secret passages — tagged as doors the Keeper cannot open itself.
    this.tagRect('ground', -4.45, -6.5, -3.55, -5.5, SECRET_BOOKCASE);
    this.tagRect('basement', 3.55, -3.5, 4.45, -2.5, SECRET_SHELF);

    // 4. Furniture blockers.
    for (const furn of FURNITURE) {
      const spec = FURN_SPECS[furn.kind];
      if (!spec.blocksNav || furn.floor === 'attic') continue;
      const floor = furn.floor as NavFloor;
      const rot = furn.rotY ?? 0;
      const hw = spec.size[0] / 2 + 0.15;
      const hd = spec.size[1] / 2 + 0.15;
      const c = Math.abs(Math.cos(rot));
      const s = Math.abs(Math.sin(rot));
      const ex = hw * c + hd * s;
      const ez = hw * s + hd * c;
      this.setRect(
        floor,
        furn.pos[0] - ex,
        furn.pos[1] - ez,
        furn.pos[0] + ex,
        furn.pos[1] + ez,
        0
      );
    }

    // 5. Stair voids on upper floors blocked (except the arrival strip).
    for (const hole of STAIR_HOLES) {
      if (hole.floor === 'attic') continue;
      const floor = hole.floor as NavFloor;
      this.setRect(floor, hole.rect[0], hole.rect[1], hole.rect[2], hole.rect[3], 0);
    }
    // Stair flights block the lower floor footprint (except the base strip).
    for (const st of STAIRS) {
      const [fx, fz] = this.stairForward(st);
      const hw = st.width / 2 + 0.2;
      const px = Math.abs(fz) * hw + Math.abs(fx) * 0; // perpendicular extents
      const pz = Math.abs(fx) * hw;
      // Block from 0.6m past the base to the far end.
      const a: [number, number] = [st.base[0] + fx * 0.6, st.base[1] + fz * 0.6];
      const b: [number, number] = [st.base[0] + fx * st.length, st.base[1] + fz * st.length];
      this.setRect(
        st.lower as NavFloor,
        Math.min(a[0], b[0]) - px,
        Math.min(a[1], b[1]) - pz,
        Math.max(a[0], b[0]) + px,
        Math.max(a[1], b[1]) + pz,
        0
      );
    }

    // 6. Stair portal edges with interpolated waypoints.
    for (const st of STAIRS) {
      this.addStairPortal(st);
    }
  }

  private stairForward(st: StairDef): [number, number] {
    // dir 0 = +X, PI/2 = -Z (matches level convention).
    return [Math.cos(st.dir), -Math.sin(st.dir)];
  }

  private addStairPortal(st: StairDef): void {
    const lower = st.lower as NavFloor;
    const upper = st.upper as NavFloor;
    const [fx, fz] = this.stairForward(st);
    const baseX = st.base[0] - fx * 0.4;
    const baseZ = st.base[1] - fz * 0.4;
    const topX = st.base[0] + fx * (st.length + 0.4);
    const topZ = st.base[1] + fz * (st.length + 0.4);

    const [bix, biz] = this.cellOf(lower, baseX, baseZ);
    const [tix, tiz] = this.cellOf(upper, topX, topZ);
    // Force both portal cells walkable.
    this.walk[lower][this.idx(lower, bix, biz)] = 1;
    this.walk[upper][this.idx(upper, tix, tiz)] = 1;
    const fromId = this.offsets[lower] + this.idx(lower, bix, biz);
    const toId = this.offsets[upper] + this.idx(upper, tix, tiz);

    const y0 = FLOOR_Y[lower];
    const y1 = FLOOR_Y[upper];
    const steps = 7;
    const up: NavPoint[] = [];
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      up.push({
        x: baseX + (topX - baseX) * t,
        y: y0 + (y1 - y0) * Math.min(1, Math.max(0, (t * (st.length + 0.8) - 0.4) / st.length)),
        z: baseZ + (topZ - baseZ) * t,
        floor: t < 0.5 ? lower : upper,
        stair: true,
      });
    }
    const down = up.slice().reverse();
    const cost = Math.hypot(topX - baseX, topZ - baseZ) + Math.abs(y1 - y0) * 1.5;

    const push = (from: number, to: number, waypoints: NavPoint[]) => {
      const list = this.portals.get(from) ?? [];
      list.push({ from, to, cost, waypoints });
      this.portals.set(from, list);
    };
    push(fromId, toId, up);
    push(toId, fromId, down);
  }

  /* ---------------- queries ---------------- */

  isWalkable(floor: NavFloor, x: number, z: number): boolean {
    const [ix, iz] = this.cellOf(floor, x, z);
    if (!this.inBounds(floor, ix, iz)) return false;
    return this.walk[floor][this.idx(floor, ix, iz)] === 1;
  }

  doorAt(floor: NavFloor, x: number, z: number): string | undefined {
    const [ix, iz] = this.cellOf(floor, x, z);
    if (!this.inBounds(floor, ix, iz)) return undefined;
    return this.door[floor][this.idx(floor, ix, iz)];
  }

  /** Snap to the nearest walkable cell centre (spiral search). */
  nearest(floor: NavFloor, x: number, z: number, maxR = 12): [number, number] | null {
    const [ix, iz] = this.cellOf(floor, x, z);
    for (let r = 0; r <= maxR; r++) {
      for (let dz = -r; dz <= r; dz++) {
        for (let dx = -r; dx <= r; dx++) {
          if (Math.max(Math.abs(dx), Math.abs(dz)) !== r) continue;
          const nx = ix + dx;
          const nz = iz + dz;
          if (!this.inBounds(floor, nx, nz)) continue;
          if (this.walk[floor][this.idx(floor, nx, nz)] === 1) {
            return this.worldOf(floor, nx, nz);
          }
        }
      }
    }
    return null;
  }

  /** Straight-line walkability check on one floor (DDA), for path smoothing. */
  lineClear(floor: NavFloor, ax: number, az: number, bx: number, bz: number): boolean {
    const dist = Math.hypot(bx - ax, bz - az);
    const steps = Math.max(1, Math.ceil(dist / (CELL * 0.5)));
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const x = ax + (bx - ax) * t;
      const z = az + (bz - az) * t;
      const [ix, iz] = this.cellOf(floor, x, z);
      if (!this.inBounds(floor, ix, iz)) return false;
      const idx = this.idx(floor, ix, iz);
      if (this.walk[floor][idx] !== 1) return false;
      if (this.door[floor][idx]) return false; // never smooth through doorways
    }
    return true;
  }

  private globalToLocal(id: number): { floor: NavFloor; ix: number; iz: number } {
    for (let i = NAV_FLOORS.length - 1; i >= 0; i--) {
      const f = NAV_FLOORS[i];
      if (id >= this.offsets[f]) {
        const local = id - this.offsets[f];
        const spec = GRID_SPECS[f];
        return { floor: f, ix: local % spec.w, iz: Math.floor(local / spec.w) };
      }
    }
    throw new Error('bad node id');
  }

  /**
   * A* over all floors. `doorPassable` lets the brain treat locked doors it
   * cannot break (and un-opened secret passages) as walls.
   */
  findPath(
    from: { floor: NavFloor; x: number; z: number },
    to: { floor: NavFloor; x: number; z: number },
    doorPassable: (id: string) => boolean
  ): NavPoint[] | null {
    const start = this.nearest(from.floor, from.x, from.z, 8);
    const goal = this.nearest(to.floor, to.x, to.z, 8);
    if (!start || !goal) return null;
    const [six, siz] = this.cellOf(from.floor, start[0], start[1]);
    const [gix, giz] = this.cellOf(to.floor, goal[0], goal[1]);
    const startId = this.offsets[from.floor] + this.idx(from.floor, six, siz);
    const goalId = this.offsets[to.floor] + this.idx(to.floor, gix, giz);
    if (startId === goalId) {
      return [{ x: goal[0], y: FLOOR_Y[to.floor], z: goal[1], floor: to.floor }];
    }

    const gScore = new Float32Array(this.total).fill(Infinity);
    const cameFrom = new Int32Array(this.total).fill(-1);
    const cameVia = new Map<number, PortalEdge>();
    const closed = new Uint8Array(this.total);

    // Binary heap of [f, id].
    const heap: number[] = [];
    const hf: number[] = [];
    const heapPush = (id: number, fv: number) => {
      heap.push(id);
      hf.push(fv);
      let i = heap.length - 1;
      while (i > 0) {
        const p = (i - 1) >> 1;
        if (hf[p] <= hf[i]) break;
        [heap[p], heap[i]] = [heap[i], heap[p]];
        [hf[p], hf[i]] = [hf[i], hf[p]];
        i = p;
      }
    };
    const heapPop = (): number => {
      const top = heap[0];
      const last = heap.pop()!;
      const lastF = hf.pop()!;
      if (heap.length > 0) {
        heap[0] = last;
        hf[0] = lastF;
        let i = 0;
        for (;;) {
          const l = i * 2 + 1;
          const r = l + 1;
          let m = i;
          if (l < heap.length && hf[l] < hf[m]) m = l;
          if (r < heap.length && hf[r] < hf[m]) m = r;
          if (m === i) break;
          [heap[m], heap[i]] = [heap[i], heap[m]];
          [hf[m], hf[i]] = [hf[i], hf[m]];
          i = m;
        }
      }
      return top;
    };

    const heuristic = (id: number): number => {
      const { floor, ix, iz } = this.globalToLocal(id);
      const [x, z] = this.worldOf(floor, ix, iz);
      const dy = Math.abs(FLOOR_Y[floor] - FLOOR_Y[to.floor]);
      return Math.hypot(x - goal[0], z - goal[1]) + dy * 2;
    };

    gScore[startId] = 0;
    heapPush(startId, heuristic(startId));
    let iterations = 0;

    while (heap.length > 0 && iterations++ < 60000) {
      const current = heapPop();
      if (current === goalId) break;
      if (closed[current]) continue;
      closed[current] = 1;

      const { floor, ix, iz } = this.globalToLocal(current);
      const spec = GRID_SPECS[floor];

      // 8-connected neighbours.
      for (let dz = -1; dz <= 1; dz++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (dx === 0 && dz === 0) continue;
          const nx = ix + dx;
          const nz = iz + dz;
          if (nx < 0 || nz < 0 || nx >= spec.w || nz >= spec.h) continue;
          const nIdx = this.idx(floor, nx, nz);
          if (this.walk[floor][nIdx] !== 1) continue;
          const doorId = this.door[floor][nIdx];
          if (doorId && !doorPassable(doorId)) continue;
          if (dx !== 0 && dz !== 0) {
            // No corner cutting.
            if (
              this.walk[floor][this.idx(floor, ix + dx, iz)] !== 1 ||
              this.walk[floor][this.idx(floor, ix, iz + dz)] !== 1
            ) {
              continue;
            }
          }
          const nId = this.offsets[floor] + nIdx;
          if (closed[nId]) continue;
          const stepCost = (dx !== 0 && dz !== 0 ? 1.414 : 1) * CELL + (doorId ? 0.6 : 0);
          const tentative = gScore[current] + stepCost;
          if (tentative < gScore[nId]) {
            gScore[nId] = tentative;
            cameFrom[nId] = current;
            cameVia.delete(nId);
            heapPush(nId, tentative + heuristic(nId));
          }
        }
      }

      // Stair portals.
      const edges = this.portals.get(current);
      if (edges) {
        for (const e of edges) {
          if (closed[e.to]) continue;
          const tentative = gScore[current] + e.cost;
          if (tentative < gScore[e.to]) {
            gScore[e.to] = tentative;
            cameFrom[e.to] = current;
            cameVia.set(e.to, e);
            heapPush(e.to, tentative + heuristic(e.to));
          }
        }
      }
    }

    if (cameFrom[goalId] === -1 && startId !== goalId) return null;

    // Reconstruct.
    const raw: NavPoint[] = [];
    let cur = goalId;
    while (cur !== -1) {
      const via = cameVia.get(cur);
      if (via) {
        for (let i = via.waypoints.length - 1; i >= 0; i--) raw.push(via.waypoints[i]);
        cur = via.from;
        continue;
      }
      const { floor, ix, iz } = this.globalToLocal(cur);
      const [x, z] = this.worldOf(floor, ix, iz);
      const idx = this.idx(floor, ix, iz);
      raw.push({ x, y: FLOOR_Y[floor], z, floor, doorId: this.door[floor][idx] });
      cur = cameFrom[cur];
    }
    raw.reverse();

    // Smooth: drop intermediate points with clear straight lines (same floor,
    // never across doorways or stairs).
    const smoothed: NavPoint[] = [];
    let i = 0;
    while (i < raw.length) {
      smoothed.push(raw[i]);
      if (raw[i].stair || raw[i].doorId) {
        i++;
        continue;
      }
      let j = i + 1;
      let best = i + 1;
      while (
        j < raw.length &&
        !raw[j].stair &&
        !raw[j].doorId &&
        raw[j].floor === raw[i].floor &&
        this.lineClear(raw[i].floor, raw[i].x, raw[i].z, raw[j].x, raw[j].z)
      ) {
        best = j;
        j++;
      }
      i = Math.max(best, i + 1);
    }
    return smoothed;
  }
}

/** Rooms the Keeper can roam (per floor) with centres, for patrol planning. */
export const PATROL_ROOMS = ROOMS.filter((r) => r.floor !== 'attic' && r.id !== 'tunnelroom').map(
  (r) => ({
    id: r.id,
    floor: r.floor as NavFloor,
    x: (r.rect[0] + r.rect[2]) / 2,
    z: (r.rect[1] + r.rect[3]) / 2,
  })
);

/** Outdoor patrol anchors (porch, driveway, yard corners, shed). */
export const YARD_POINTS: { x: number; z: number }[] = [
  { x: 7, z: 12 },
  { x: 7, z: 22 },
  { x: -6, z: 12 },
  { x: -14, z: 2 },
  { x: -21, z: -16 },
  { x: 14, z: -4 },
  { x: 2, z: -14 },
  { x: -14, z: 16 },
];

let sharedGrid: NavGrid | null = null;
export function getNavGrid(): NavGrid {
  if (!sharedGrid) sharedGrid = new NavGrid();
  return sharedGrid;
}

export { HOUSE_RECT };
