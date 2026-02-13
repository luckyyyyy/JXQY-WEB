/**
 * MapBase obstacle detection tests
 * 地图障碍检测 - barrier bitmask 逻辑
 */
import { describe, expect, it, vi } from "vitest";
import { MapBase } from "../../src/map/map-base";

vi.mock("../../src/core/logger", () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock("../../src/core/engineAccess", () => ({
  EngineAccess: class {},
}));

// Barrier constants (from mapBase.ts)
const NONE = 0x00;
const OBSTACLE = 0x80;
const TRANS = 0x40;
const CAN_OVER = 0x20;

function createMapBase(
  columns: number,
  rows: number,
  barriers: number[]
): MapBase {
  const map = new MapBase();
  map.setMapData({
    mapColumnCounts: columns,
    mapRowCounts: rows,
    barriers,
    traps: new Array(columns * rows).fill(0),
  } as never);
  return map;
}

describe("MapBase", () => {
  describe("isTileInMapRange", () => {
    const map = createMapBase(10, 10, []);

    it("returns true for valid coordinates", () => {
      expect(map.isTileInMapRange(0, 0)).toBe(true);
      expect(map.isTileInMapRange(5, 5)).toBe(true);
      expect(map.isTileInMapRange(9, 9)).toBe(true);
    });

    it("returns false for out of range", () => {
      expect(map.isTileInMapRange(-1, 0)).toBe(false);
      expect(map.isTileInMapRange(0, -1)).toBe(false);
      expect(map.isTileInMapRange(10, 0)).toBe(false);
      expect(map.isTileInMapRange(0, 10)).toBe(false);
    });
  });

  describe("isTileInMapViewRange", () => {
    const map = createMapBase(10, 10, []);

    it("excludes row 0 (first row)", () => {
      expect(map.isTileInMapViewRange(5, 0)).toBe(false);
    });

    it("excludes last row", () => {
      // MapRowCounts=10, so row 9 is excluded (row < 10-1 = row < 9)
      expect(map.isTileInMapViewRange(5, 9)).toBe(false);
    });

    it("includes valid middle rows", () => {
      expect(map.isTileInMapViewRange(5, 1)).toBe(true);
      expect(map.isTileInMapViewRange(5, 8)).toBe(true);
    });

    it("returns false for out of column range", () => {
      expect(map.isTileInMapViewRange(-1, 5)).toBe(false);
      expect(map.isTileInMapViewRange(10, 5)).toBe(false);
    });
  });

  describe("isObstacle", () => {
    it("returns true for OBSTACLE tiles", () => {
      const barriers = new Array(100).fill(NONE);
      barriers[5 + 3 * 10] = OBSTACLE; // (5, 3)
      const map = createMapBase(10, 10, barriers);

      expect(map.isObstacle(5, 3)).toBe(true);
    });

    it("returns false for NONE tiles", () => {
      const barriers = new Array(100).fill(NONE);
      const map = createMapBase(10, 10, barriers);

      expect(map.isObstacle(5, 3)).toBe(false);
    });

    it("returns true for out-of-view-range (boundary)", () => {
      const map = createMapBase(10, 10, new Array(100).fill(NONE));
      expect(map.isObstacle(5, 0)).toBe(true); // row 0 excluded
    });

    it("does NOT treat TRANS as obstacle", () => {
      const barriers = new Array(100).fill(NONE);
      barriers[5 + 3 * 10] = TRANS;
      const map = createMapBase(10, 10, barriers);

      expect(map.isObstacle(5, 3)).toBe(false);
    });
  });

  describe("isObstacleForCharacter", () => {
    it("treats OBSTACLE as blocking", () => {
      const barriers = new Array(100).fill(NONE);
      barriers[5 + 3 * 10] = OBSTACLE;
      const map = createMapBase(10, 10, barriers);

      expect(map.isObstacleForCharacter(5, 3)).toBe(true);
    });

    it("treats TRANS as blocking for characters", () => {
      const barriers = new Array(100).fill(NONE);
      barriers[5 + 3 * 10] = TRANS;
      const map = createMapBase(10, 10, barriers);

      expect(map.isObstacleForCharacter(5, 3)).toBe(true);
    });

    it("treats NONE as passable", () => {
      const barriers = new Array(100).fill(NONE);
      const map = createMapBase(10, 10, barriers);

      expect(map.isObstacleForCharacter(5, 3)).toBe(false);
    });

    it("treats CAN_OVER as blocking for walking", () => {
      const barriers = new Array(100).fill(NONE);
      barriers[5 + 3 * 10] = CAN_OVER;
      const map = createMapBase(10, 10, barriers);

      // CAN_OVER (0x20) & (OBSTACLE+TRANS) = 0x20 & 0xC0 = 0 → not blocked
      expect(map.isObstacleForCharacter(5, 3)).toBe(false);
    });
  });

  describe("isObstacleForCharacterJump", () => {
    it("CAN_OVER is passable for jumping", () => {
      const barriers = new Array(100).fill(NONE);
      barriers[5 + 3 * 10] = CAN_OVER;
      const map = createMapBase(10, 10, barriers);

      expect(map.isObstacleForCharacterJump(5, 3)).toBe(false);
    });

    it("OBSTACLE blocks jumping", () => {
      const barriers = new Array(100).fill(NONE);
      barriers[5 + 3 * 10] = OBSTACLE;
      const map = createMapBase(10, 10, barriers);

      expect(map.isObstacleForCharacterJump(5, 3)).toBe(true);
    });

    it("NONE is passable for jumping", () => {
      const barriers = new Array(100).fill(NONE);
      const map = createMapBase(10, 10, barriers);

      expect(map.isObstacleForCharacterJump(5, 3)).toBe(false);
    });

    it("OBSTACLE + CAN_OVER (0xA0) is passable for jumping", () => {
      const barriers = new Array(100).fill(NONE);
      barriers[5 + 3 * 10] = OBSTACLE | CAN_OVER; // 0xA0
      const map = createMapBase(10, 10, barriers);

      // barrier=0xA0, CAN_OVER bit is set → passable
      expect(map.isObstacleForCharacterJump(5, 3)).toBe(false);
    });
  });

  describe("isObstacleForMagic", () => {
    it("TRANS is passable for magic", () => {
      const barriers = new Array(100).fill(NONE);
      barriers[5 + 3 * 10] = TRANS;
      const map = createMapBase(10, 10, barriers);

      expect(map.isObstacleForMagic(5, 3)).toBe(false);
    });

    it("OBSTACLE blocks magic", () => {
      const barriers = new Array(100).fill(NONE);
      barriers[5 + 3 * 10] = OBSTACLE;
      const map = createMapBase(10, 10, barriers);

      expect(map.isObstacleForMagic(5, 3)).toBe(true);
    });

    it("NONE is passable for magic", () => {
      const barriers = new Array(100).fill(NONE);
      const map = createMapBase(10, 10, barriers);

      expect(map.isObstacleForMagic(5, 3)).toBe(false);
    });

    it("CAN_OVER blocks magic (not TRANS)", () => {
      const barriers = new Array(100).fill(NONE);
      barriers[5 + 3 * 10] = CAN_OVER;
      const map = createMapBase(10, 10, barriers);

      expect(map.isObstacleForMagic(5, 3)).toBe(true);
    });
  });

  describe("static view calculation", () => {
    it("getStartTileInViewStatic clamps to 0", () => {
      const start = MapBase.getStartTileInViewStatic(100, 100);
      // pixelToTile(100,100) gives some tile, minus 20, clamped to 0
      expect(start.x).toBeGreaterThanOrEqual(0);
      expect(start.y).toBeGreaterThanOrEqual(0);
    });

    it("getEndTileInViewStatic clamps to map size", () => {
      const end = MapBase.getEndTileInViewStatic(800, 600, 50, 50);
      expect(end.x).toBeLessThanOrEqual(50);
      expect(end.y).toBeLessThanOrEqual(50);
    });
  });

  describe("debugGetTileBarrierInfo", () => {
    it("returns barrier info string", () => {
      const barriers = new Array(100).fill(NONE);
      barriers[5 + 3 * 10] = OBSTACLE | TRANS;
      const map = createMapBase(10, 10, barriers);

      const info = map.debugGetTileBarrierInfo(5, 3);
      expect(info).toContain("OBSTACLE");
      expect(info).toContain("TRANS");
      expect(info).toContain("isCharObstacle=true");
    });

    it("returns out of range message", () => {
      const map = createMapBase(10, 10, new Array(100).fill(NONE));
      const info = map.debugGetTileBarrierInfo(5, 0); // row 0 = out of view
      expect(info).toContain("越界");
    });
  });
});
