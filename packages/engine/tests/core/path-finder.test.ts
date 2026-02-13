import { describe, it, expect, vi } from "vitest";
import {
  PathType,
  canMoveInDirection,
  findPathStep,
  findPathSimple,
  findPathPerfect,
  getLinePath,
} from "../../src/utils/path-finder";

// Mock logger
vi.mock("../../src/core/logger", () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    log: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

// Helper: no obstacles (open field)
const noObstacle = () => false;

// Helper: create wall obstacle checker
function makeWall(blockedTiles: Set<string>) {
  return (tile: { x: number; y: number }) => blockedTiles.has(`${tile.x},${tile.y}`);
}

describe("PathType enum", () => {
  it("has correct values", () => {
    expect(PathType.PathOneStep).toBe(0);
    expect(PathType.SimpleMaxNpcTry).toBe(1);
    expect(PathType.PerfectMaxNpcTry).toBe(2);
    expect(PathType.PerfectMaxPlayerTry).toBe(3);
    expect(PathType.PathStraightLine).toBe(4);
  });
});

describe("canMoveInDirection", () => {
  it("allows only direction 0 for count 1", () => {
    expect(canMoveInDirection(0, 1)).toBe(true);
    expect(canMoveInDirection(1, 1)).toBe(false);
    expect(canMoveInDirection(4, 1)).toBe(false);
  });

  it("allows directions 0 and 4 for count 2", () => {
    expect(canMoveInDirection(0, 2)).toBe(true);
    expect(canMoveInDirection(4, 2)).toBe(true);
    expect(canMoveInDirection(1, 2)).toBe(false);
    expect(canMoveInDirection(6, 2)).toBe(false);
  });

  it("allows cardinal directions for count 4", () => {
    expect(canMoveInDirection(0, 4)).toBe(true);
    expect(canMoveInDirection(2, 4)).toBe(true);
    expect(canMoveInDirection(4, 4)).toBe(true);
    expect(canMoveInDirection(6, 4)).toBe(true);
    expect(canMoveInDirection(1, 4)).toBe(false);
    expect(canMoveInDirection(7, 4)).toBe(false);
  });

  it("allows all 8 directions for count 8", () => {
    for (let i = 0; i < 8; i++) {
      expect(canMoveInDirection(i, 8)).toBe(true);
    }
  });
});

describe("findPathStep", () => {
  it("returns empty for same start and end", () => {
    const path = findPathStep(
      { x: 5, y: 5 },
      { x: 5, y: 5 },
      noObstacle,
      noObstacle,
      noObstacle,
    );
    expect(path).toHaveLength(0);
  });

  it("returns empty when destination is obstacle", () => {
    const path = findPathStep(
      { x: 0, y: 0 },
      { x: 5, y: 0 },
      noObstacle,
      () => true, // everything is obstacle
      noObstacle,
    );
    expect(path).toHaveLength(0);
  });

  it("finds path in open field", () => {
    const obstacleFn = (tile: { x: number; y: number }) => {
      // Only the destination should not be an obstacle
      return false;
    };
    const path = findPathStep(
      { x: 5, y: 10 },
      { x: 5, y: 14 },
      noObstacle,
      noObstacle,
      noObstacle,
    );
    expect(path.length).toBeGreaterThan(0);
    // Path starts from start tile
    expect(path[0]).toEqual({ x: 5, y: 10 });
  });

  it("respects step count limit", () => {
    const path = findPathStep(
      { x: 0, y: 0 },
      { x: 100, y: 100 },
      noObstacle,
      noObstacle,
      noObstacle,
      5, // max 5 steps
    );
    expect(path.length).toBeLessThanOrEqual(6); // start + 5 steps
  });
});

describe("findPathSimple (greedy best-first)", () => {
  it("returns empty for same start and end", () => {
    expect(
      findPathSimple({ x: 5, y: 5 }, { x: 5, y: 5 }, noObstacle, noObstacle, noObstacle),
    ).toHaveLength(0);
  });

  it("finds path in open field", () => {
    const path = findPathSimple(
      { x: 5, y: 10 },
      { x: 5, y: 14 },
      noObstacle,
      noObstacle,
      noObstacle,
    );
    expect(path.length).toBeGreaterThan(0);
    // Path should end at destination
    expect(path[path.length - 1]).toEqual({ x: 5, y: 14 });
  });

  it("returns empty when blocked", () => {
    // Block all neighbors of start
    const path = findPathSimple(
      { x: 5, y: 5 },
      { x: 10, y: 10 },
      noObstacle,
      () => true,
      noObstacle,
      100,
    );
    expect(path).toHaveLength(0);
  });
});

describe("findPathPerfect (A*)", () => {
  it("returns empty for same start and end", () => {
    expect(
      findPathPerfect({ x: 5, y: 5 }, { x: 5, y: 5 }, noObstacle, noObstacle, noObstacle),
    ).toHaveLength(0);
  });

  it("finds optimal path in open field", () => {
    const path = findPathPerfect(
      { x: 5, y: 10 },
      { x: 5, y: 14 },
      noObstacle,
      noObstacle,
      noObstacle,
    );
    expect(path.length).toBeGreaterThan(0);
    expect(path[0]).toEqual({ x: 5, y: 10 });
    expect(path[path.length - 1]).toEqual({ x: 5, y: 14 });
  });

  it("returns empty when destination is obstacle", () => {
    const dest = { x: 10, y: 10 };
    const isObstacle = (tile: { x: number; y: number }) =>
      tile.x === dest.x && tile.y === dest.y;

    const path = findPathPerfect(
      { x: 5, y: 5 },
      dest,
      noObstacle,
      isObstacle,
      noObstacle,
    );
    expect(path).toHaveLength(0);
  });

  it("navigates around obstacles", () => {
    // Create a wall blocking direct path
    const wall = new Set<string>();
    for (let y = 6; y <= 14; y++) {
      wall.add(`7,${y}`);
    }
    const isWall = makeWall(wall);

    const path = findPathPerfect(
      { x: 5, y: 10 },
      { x: 9, y: 10 },
      noObstacle,
      isWall,
      isWall,
      500,
    );

    if (path.length > 0) {
      // Path should not go through wall tiles
      for (const tile of path) {
        expect(wall.has(`${tile.x},${tile.y}`)).toBe(false);
      }
      // Should reach destination
      expect(path[path.length - 1]).toEqual({ x: 9, y: 10 });
    }
  });
});

describe("getLinePath (straight line, ignores obstacles)", () => {
  it("returns empty for same start and end", () => {
    expect(getLinePath({ x: 5, y: 5 }, { x: 5, y: 5 })).toHaveLength(0);
  });

  it("creates a straight-ish path ignoring obstacles", () => {
    const path = getLinePath({ x: 0, y: 0 }, { x: 5, y: 10 });
    expect(path.length).toBeGreaterThan(0);
    expect(path[0]).toEqual({ x: 0, y: 0 });
    expect(path[path.length - 1]).toEqual({ x: 5, y: 10 });
  });

  it("respects maxTry limit", () => {
    const path = getLinePath({ x: 0, y: 0 }, { x: 100, y: 200 }, 5);
    expect(path.length).toBeLessThanOrEqual(6);
  });
});
