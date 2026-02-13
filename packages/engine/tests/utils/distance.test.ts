import { describe, it, expect } from "vitest";
import { distance, getViewTileDistance } from "../../src/utils/distance";

describe("distance", () => {
  it("returns 0 for same point", () => {
    expect(distance({ x: 5, y: 5 }, { x: 5, y: 5 })).toBe(0);
  });

  it("calculates horizontal distance", () => {
    expect(distance({ x: 0, y: 0 }, { x: 3, y: 0 })).toBe(3);
  });

  it("calculates vertical distance", () => {
    expect(distance({ x: 0, y: 0 }, { x: 0, y: 4 })).toBe(4);
  });

  it("calculates diagonal distance (3-4-5 triangle)", () => {
    expect(distance({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(5);
  });

  it("handles negative coordinates", () => {
    expect(distance({ x: -3, y: -4 }, { x: 0, y: 0 })).toBe(5);
  });

  it("is commutative", () => {
    const a = { x: 1, y: 2 };
    const b = { x: 4, y: 6 };
    expect(distance(a, b)).toBe(distance(b, a));
  });
});

describe("getViewTileDistance", () => {
  it("returns 0 for same tile", () => {
    expect(getViewTileDistance({ x: 5, y: 5 }, { x: 5, y: 5 })).toBe(0);
  });

  it("calculates horizontal tile distance", () => {
    // Same row, 3 tiles apart
    expect(getViewTileDistance({ x: 0, y: 0 }, { x: 3, y: 0 })).toBe(3);
  });

  it("calculates vertical tile distance (even rows)", () => {
    // 2 rows apart (same parity), distance = |dy|/2
    expect(getViewTileDistance({ x: 0, y: 0 }, { x: 0, y: 4 })).toBe(2);
  });

  it("handles odd/even row parity adjustment", () => {
    // Different parity rows
    const d1 = getViewTileDistance({ x: 0, y: 0 }, { x: 0, y: 1 });
    expect(d1).toBeGreaterThan(0);
  });

  it("is roughly commutative for same-parity tiles", () => {
    const d1 = getViewTileDistance({ x: 2, y: 4 }, { x: 5, y: 8 });
    const d2 = getViewTileDistance({ x: 5, y: 8 }, { x: 2, y: 4 });
    expect(d1).toBe(d2);
  });
});
