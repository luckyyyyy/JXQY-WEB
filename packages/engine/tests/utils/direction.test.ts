import { describe, it, expect } from "vitest";
import {
  getDirectionIndex,
  getDirection,
  getDirectionFromVector,
  getDirectionVector,
  getDirection8,
  getDirection32List,
  getDirectionPixelOffset,
  getDirectionTileOffset,
  getPositionInDirection,
  getNeighborTileInDirection,
} from "../../src/utils/direction";

describe("getDirectionIndex", () => {
  it("returns 0 for South direction (0, 1)", () => {
    expect(getDirectionIndex({ x: 0, y: 1 }, 8)).toBe(0);
  });

  it("returns 4 for North direction (0, -1)", () => {
    expect(getDirectionIndex({ x: 0, y: -1 }, 8)).toBe(4);
  });

  it("returns 2 for West direction (-1, 0)", () => {
    expect(getDirectionIndex({ x: -1, y: 0 }, 8)).toBe(2);
  });

  it("returns 6 for East direction (1, 0)", () => {
    expect(getDirectionIndex({ x: 1, y: 0 }, 8)).toBe(6);
  });

  it("returns 0 for zero vector", () => {
    expect(getDirectionIndex({ x: 0, y: 0 }, 8)).toBe(0);
  });

  it("returns 0 when directionCount < 1", () => {
    expect(getDirectionIndex({ x: 1, y: 0 }, 0)).toBe(0);
  });

  it("handles 32-direction correctly", () => {
    // South should still be 0
    expect(getDirectionIndex({ x: 0, y: 1 }, 32)).toBe(0);
    // North should be 16
    expect(getDirectionIndex({ x: 0, y: -1 }, 32)).toBe(16);
  });
});

describe("getDirection", () => {
  it("returns South for downward movement", () => {
    expect(getDirection({ x: 0, y: 0 }, { x: 0, y: 5 })).toBe(0); // South
  });

  it("returns North for upward movement", () => {
    expect(getDirection({ x: 0, y: 5 }, { x: 0, y: 0 })).toBe(4); // North
  });

  it("returns East for rightward movement", () => {
    expect(getDirection({ x: 0, y: 0 }, { x: 5, y: 0 })).toBe(6); // East
  });

  it("returns West for leftward movement", () => {
    expect(getDirection({ x: 5, y: 0 }, { x: 0, y: 0 })).toBe(2); // West
  });
});

describe("getDirectionFromVector", () => {
  it("maps South correctly", () => {
    expect(getDirectionFromVector({ x: 0, y: 1 })).toBe(0);
  });

  it("maps SouthWest correctly", () => {
    expect(getDirectionFromVector({ x: -1, y: 1 })).toBe(1);
  });
});

describe("getDirectionVector", () => {
  it("returns correct vector for each direction", () => {
    expect(getDirectionVector(4)).toEqual({ x: 0, y: 1 }); // South
    expect(getDirectionVector(0)).toEqual({ x: 0, y: -1 }); // North
    expect(getDirectionVector(2)).toEqual({ x: 1, y: 0 }); // East
    expect(getDirectionVector(6)).toEqual({ x: -1, y: 0 }); // West
  });

  it("returns fallback for invalid direction", () => {
    expect(getDirectionVector(99 as never)).toEqual({ x: 0, y: 1 });
  });
});

describe("getDirection8", () => {
  it("returns South for index 0", () => {
    const d = getDirection8(0);
    expect(d.x).toBeCloseTo(0);
    expect(d.y).toBeCloseTo(1);
  });

  it("returns North for index 4", () => {
    const d = getDirection8(4);
    expect(d.x).toBeCloseTo(0);
    expect(d.y).toBeCloseTo(-1);
  });

  it("wraps around at 8", () => {
    const d0 = getDirection8(0);
    const d8 = getDirection8(8);
    expect(d8.x).toBeCloseTo(d0.x);
    expect(d8.y).toBeCloseTo(d0.y);
  });
});

describe("getDirection32List", () => {
  it("returns 32 entries", () => {
    expect(getDirection32List()).toHaveLength(32);
  });

  it("first entry points South (0, 1)", () => {
    const list = getDirection32List();
    expect(list[0].x).toBeCloseTo(0);
    expect(list[0].y).toBeCloseTo(1);
  });

  it("entry 16 points North (0, -1)", () => {
    const list = getDirection32List();
    expect(list[16].x).toBeCloseTo(0);
    expect(list[16].y).toBeCloseTo(-1);
  });

  it("all entries are unit vectors", () => {
    const list = getDirection32List();
    for (const v of list) {
      const len = Math.sqrt(v.x * v.x + v.y * v.y);
      expect(len).toBeCloseTo(1);
    }
  });
});

describe("getDirectionPixelOffset", () => {
  it("returns South offset for index 0", () => {
    expect(getDirectionPixelOffset(0)).toEqual({ x: 0, y: 32 });
  });

  it("returns North offset for index 4", () => {
    expect(getDirectionPixelOffset(4)).toEqual({ x: 0, y: -32 });
  });

  it("wraps around modulo 8", () => {
    expect(getDirectionPixelOffset(8)).toEqual(getDirectionPixelOffset(0));
  });
});

describe("getDirectionTileOffset", () => {
  it("returns South tile offset for index 0", () => {
    expect(getDirectionTileOffset(0)).toEqual({ x: 0, y: 1 });
  });

  it("returns North tile offset for index 4", () => {
    expect(getDirectionTileOffset(4)).toEqual({ x: 0, y: -1 });
  });
});

describe("getPositionInDirection", () => {
  it("adds offset to origin", () => {
    const result = getPositionInDirection({ x: 100, y: 100 }, 0); // South
    expect(result).toEqual({ x: 100, y: 132 });
  });
});

describe("getNeighborTileInDirection", () => {
  it("returns neighbor tile with offset", () => {
    const result = getNeighborTileInDirection({ x: 5, y: 5 }, 6); // East
    expect(result).toEqual({ x: 6, y: 5 });
  });
});
