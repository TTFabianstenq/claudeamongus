import { PLAYER_RADIUS } from "./constants";

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Vec2 {
  x: number;
  y: number;
}

export function dist(ax: number, ay: number, bx: number, by: number): number {
  const dx = ax - bx;
  const dy = ay - by;
  return Math.hypot(dx, dy);
}

export function pointInRect(x: number, y: number, r: Rect): boolean {
  return x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h;
}

export function normalize(x: number, y: number): Vec2 {
  const len = Math.hypot(x, y);
  if (len < 1e-6) return { x: 0, y: 0 };
  return { x: x / len, y: y / len };
}

/**
 * Walkability is a rasterized grid built from the map's floor rectangles.
 * Both the server and the client build the identical grid from the same
 * map definition, so prediction matches authority exactly.
 */
export class CollisionGrid {
  readonly cell: number;
  readonly cols: number;
  readonly rows: number;
  readonly width: number;
  readonly height: number;
  private walkable: Uint8Array;
  /** dynamic blockers (closed doors): counts per cell so overlaps stack */
  private blocked: Uint16Array;

  constructor(width: number, height: number, cell: number, floors: Rect[]) {
    this.cell = cell;
    this.width = width;
    this.height = height;
    this.cols = Math.ceil(width / cell);
    this.rows = Math.ceil(height / cell);
    this.walkable = new Uint8Array(this.cols * this.rows);
    this.blocked = new Uint16Array(this.cols * this.rows);
    for (const f of floors) this.fill(f, 1);
  }

  private fill(r: Rect, value: number): void {
    const x0 = Math.max(0, Math.floor(r.x / this.cell));
    const y0 = Math.max(0, Math.floor(r.y / this.cell));
    const x1 = Math.min(this.cols - 1, Math.ceil((r.x + r.w) / this.cell) - 1);
    const y1 = Math.min(this.rows - 1, Math.ceil((r.y + r.h) / this.cell) - 1);
    for (let cy = y0; cy <= y1; cy++) {
      for (let cx = x0; cx <= x1; cx++) {
        this.walkable[cy * this.cols + cx] = value;
      }
    }
  }

  cellsForRect(r: Rect): number[] {
    const out: number[] = [];
    const x0 = Math.max(0, Math.floor(r.x / this.cell));
    const y0 = Math.max(0, Math.floor(r.y / this.cell));
    const x1 = Math.min(this.cols - 1, Math.ceil((r.x + r.w) / this.cell) - 1);
    const y1 = Math.min(this.rows - 1, Math.ceil((r.y + r.h) / this.cell) - 1);
    for (let cy = y0; cy <= y1; cy++) {
      for (let cx = x0; cx <= x1; cx++) out.push(cy * this.cols + cx);
    }
    return out;
  }

  setBlocked(cells: number[], on: boolean): void {
    for (const idx of cells) {
      const current = this.blocked[idx] ?? 0;
      this.blocked[idx] = on ? current + 1 : Math.max(0, current - 1);
    }
  }

  isWalkableCell(cx: number, cy: number): boolean {
    if (cx < 0 || cy < 0 || cx >= this.cols || cy >= this.rows) return false;
    const idx = cy * this.cols + cx;
    return this.walkable[idx] === 1 && (this.blocked[idx] ?? 0) === 0;
  }

  isWalkablePoint(x: number, y: number): boolean {
    return this.isWalkableCell(Math.floor(x / this.cell), Math.floor(y / this.cell));
  }

  /** True when a circle of `radius` centered at (x, y) fits entirely on floor. */
  circleFits(x: number, y: number, radius: number): boolean {
    const x0 = Math.floor((x - radius) / this.cell);
    const y0 = Math.floor((y - radius) / this.cell);
    const x1 = Math.floor((x + radius) / this.cell);
    const y1 = Math.floor((y + radius) / this.cell);
    for (let cy = y0; cy <= y1; cy++) {
      for (let cx = x0; cx <= x1; cx++) {
        if (this.isWalkableCell(cx, cy)) continue;
        // circle vs cell AABB precise check
        const rx0 = cx * this.cell;
        const ry0 = cy * this.cell;
        const nearestX = Math.max(rx0, Math.min(x, rx0 + this.cell));
        const nearestY = Math.max(ry0, Math.min(y, ry0 + this.cell));
        if (dist(x, y, nearestX, nearestY) < radius) return false;
      }
    }
    return true;
  }
}

export interface MoveInput {
  moveX: number;
  moveY: number;
}

/**
 * Advances a player one step. Axis-separated so players slide along walls.
 * Identical on server (authoritative) and client (prediction).
 */
export function stepMovement(
  grid: CollisionGrid,
  pos: Vec2,
  input: MoveInput,
  speed: number,
  dt: number,
  noclip = false,
): Vec2 {
  const dir = normalize(input.moveX, input.moveY);
  if (dir.x === 0 && dir.y === 0) return pos;
  let nx = pos.x + dir.x * speed * dt;
  let ny = pos.y;
  if (noclip) {
    nx = Math.max(0, Math.min(grid.width, nx));
  } else if (!grid.circleFits(nx, ny, PLAYER_RADIUS)) {
    nx = pos.x;
  }
  ny = pos.y + dir.y * speed * dt;
  if (noclip) {
    ny = Math.max(0, Math.min(grid.height, ny));
  } else if (!grid.circleFits(nx, ny, PLAYER_RADIUS)) {
    ny = pos.y;
  }
  return { x: nx, y: ny };
}
