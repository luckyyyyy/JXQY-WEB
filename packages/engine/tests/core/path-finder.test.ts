import { describe, it, expect } from "vitest";
import {
  PathType,
  canMoveInDirection,
} from "../../src/utils/path-finder";

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
