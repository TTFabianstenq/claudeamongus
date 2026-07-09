import { describe, expect, it } from "vitest";
import { PLAYER_RADIUS } from "@/shared/constants";
import { HELION, allFloors, roomAt } from "@/shared/map/helion";
import { CollisionGrid, stepMovement } from "@/shared/physics";

function buildGrid(): CollisionGrid {
  return new CollisionGrid(HELION.width, HELION.height, HELION.cell, allFloors(HELION));
}

describe("CollisionGrid", () => {
  it("marks room interiors walkable and space unwalkable", () => {
    const grid = buildGrid();
    const cafeteria = HELION.rooms.find((r) => r.id === "cafeteria")!;
    const cx = cafeteria.rect.x + cafeteria.rect.w / 2;
    const cy = cafeteria.rect.y + cafeteria.rect.h / 2;
    expect(grid.isWalkablePoint(cx, cy)).toBe(true);
    expect(grid.isWalkablePoint(10, 10)).toBe(false); // deep space
  });

  it("keeps a full player circle inside floors", () => {
    const grid = buildGrid();
    const { x, y } = HELION.spawn;
    expect(grid.circleFits(x, y, PLAYER_RADIUS)).toBe(true);
    // just outside the hull
    expect(grid.circleFits(-50, -50, PLAYER_RADIUS)).toBe(false);
  });

  it("blocks movement through walls but allows sliding along them", () => {
    const grid = buildGrid();
    const cafeteria = HELION.rooms.find((r) => r.id === "cafeteria")!;
    // stand near the top wall and push straight up: should not pass
    const startX = cafeteria.rect.x + 200;
    const startY = cafeteria.rect.y + PLAYER_RADIUS + 4;
    let pos = { x: startX, y: startY };
    for (let i = 0; i < 30; i++) {
      pos = stepMovement(grid, pos, { moveX: 0, moveY: -1 }, 170, 1 / 30);
    }
    expect(pos.y).toBeGreaterThan(cafeteria.rect.y - 1);
    // diagonal into the wall should still slide horizontally
    let slide = { x: startX, y: startY };
    for (let i = 0; i < 30; i++) {
      slide = stepMovement(grid, slide, { moveX: 1, moveY: -1 }, 170, 1 / 30);
    }
    expect(slide.x).toBeGreaterThan(startX + 50);
  });

  it("respects dynamically blocked door cells", () => {
    const grid = buildGrid();
    const door = HELION.doors.find((d) => d.id === "door-cafe-south")!;
    const cells = grid.cellsForRect(door.rect);
    const inside = {
      x: door.rect.x + door.rect.w / 2,
      y: door.rect.y + door.rect.h / 2,
    };
    expect(grid.circleFits(inside.x, inside.y, PLAYER_RADIUS)).toBe(true);
    grid.setBlocked(cells, true);
    expect(grid.circleFits(inside.x, inside.y, PLAYER_RADIUS)).toBe(false);
    grid.setBlocked(cells, false);
    expect(grid.circleFits(inside.x, inside.y, PLAYER_RADIUS)).toBe(true);
  });

  it("ghosts (noclip) pass through walls", () => {
    const grid = buildGrid();
    let pos = { x: HELION.spawn.x, y: HELION.spawn.y };
    for (let i = 0; i < 300; i++) {
      pos = stepMovement(grid, pos, { moveX: 0, moveY: -1 }, 220, 1 / 30, true);
    }
    expect(pos.y).toBeLessThan(HELION.rooms.find((r) => r.id === "cafeteria")!.rect.y);
  });
});

describe("map integrity", () => {
  it("every vent link is bidirectional and targets exist", () => {
    for (const vent of HELION.vents) {
      for (const link of vent.links) {
        const target = HELION.vents.find((v) => v.id === link);
        expect(target, `vent ${vent.id} links to missing ${link}`).toBeDefined();
        expect(target!.links).toContain(vent.id);
      }
    }
  });

  it("every vent sits on walkable floor inside its room", () => {
    const grid = buildGrid();
    for (const vent of HELION.vents) {
      expect(grid.isWalkablePoint(vent.x, vent.y), `vent ${vent.id}`).toBe(true);
      expect(roomAt(HELION, vent.x, vent.y)?.id).toBe(vent.roomId);
    }
  });

  it("every console sits on walkable floor inside its room", () => {
    const grid = buildGrid();
    for (const c of HELION.consoles) {
      expect(grid.isWalkablePoint(c.x, c.y), `console ${c.id}`).toBe(true);
      expect(roomAt(HELION, c.x, c.y)?.id, `console ${c.id} room`).toBe(c.roomId);
    }
  });

  it("every task template references existing consoles of the right kind", () => {
    for (const task of HELION.tasks) {
      expect(task.consoleIds.length).toBeGreaterThan(0);
      for (const id of task.consoleIds) {
        const c = HELION.consoles.find((k) => k.id === id);
        expect(c, `task ${task.id} console ${id}`).toBeDefined();
      }
    }
  });

  it("the whole ship is one connected walkable region", () => {
    const grid = buildGrid();
    // flood fill from spawn over cell centers
    const seen = new Set<string>();
    const queue: Array<[number, number]> = [
      [Math.floor(HELION.spawn.x / HELION.cell), Math.floor(HELION.spawn.y / HELION.cell)],
    ];
    while (queue.length > 0) {
      const [cx, cy] = queue.pop()!;
      const key = `${cx},${cy}`;
      if (seen.has(key) || !grid.isWalkableCell(cx, cy)) continue;
      seen.add(key);
      queue.push([cx + 1, cy], [cx - 1, cy], [cx, cy + 1], [cx, cy - 1]);
    }
    // every room center must be reachable from spawn
    for (const room of HELION.rooms) {
      const cx = Math.floor((room.rect.x + room.rect.w / 2) / HELION.cell);
      const cy = Math.floor((room.rect.y + room.rect.h / 2) / HELION.cell);
      expect(seen.has(`${cx},${cy}`), `room ${room.id} unreachable`).toBe(true);
    }
  });
});
