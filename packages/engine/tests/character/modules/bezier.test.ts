/**
 * Bezier curve utilities tests
 * 贝塞尔曲线工具 - 用于角色跳跃移动
 */
import { describe, expect, it } from "vitest";
import { bezier2D } from "../../../src/character/modules/bezier";

describe("bezier2D", () => {
  it("returns start and end points for a straight line", () => {
    const controlPoints = [
      { x: 0, y: 0 },
      { x: 100, y: 100 },
    ];
    const result = bezier2D(controlPoints, 3);

    expect(result).toHaveLength(3);
    // First point = start
    expect(result[0].x).toBeCloseTo(0, 5);
    expect(result[0].y).toBeCloseTo(0, 5);
    // Last point = end
    expect(result[2].x).toBeCloseTo(100, 5);
    expect(result[2].y).toBeCloseTo(100, 5);
    // Middle point should be midpoint for linear
    expect(result[1].x).toBeCloseTo(50, 5);
    expect(result[1].y).toBeCloseTo(50, 5);
  });

  it("produces a quadratic bezier curve (3 control points)", () => {
    // Quadratic with control point (0,0), (50,100), (100,0)
    const controlPoints = [
      { x: 0, y: 0 },
      { x: 50, y: 100 },
      { x: 100, y: 0 },
    ];
    const result = bezier2D(controlPoints, 5);

    expect(result).toHaveLength(5);
    // t=0: start
    expect(result[0].x).toBeCloseTo(0, 5);
    expect(result[0].y).toBeCloseTo(0, 5);
    // t=0.5: midpoint of quadratic = (50, 50)
    expect(result[2].x).toBeCloseTo(50, 5);
    expect(result[2].y).toBeCloseTo(50, 5);
    // t=1: end
    expect(result[4].x).toBeCloseTo(100, 5);
    expect(result[4].y).toBeCloseTo(0, 5);
  });

  it("produces a cubic bezier curve (4 control points)", () => {
    const controlPoints = [
      { x: 0, y: 0 },
      { x: 0, y: 100 },
      { x: 100, y: 100 },
      { x: 100, y: 0 },
    ];
    const result = bezier2D(controlPoints, 5);

    expect(result).toHaveLength(5);
    expect(result[0].x).toBeCloseTo(0, 5);
    expect(result[0].y).toBeCloseTo(0, 5);
    expect(result[4].x).toBeCloseTo(100, 5);
    expect(result[4].y).toBeCloseTo(0, 5);
    // Midpoint of this S-curve at t=0.5: (50, 75)
    expect(result[2].x).toBeCloseTo(50, 5);
    expect(result[2].y).toBeCloseTo(75, 5);
  });

  it("returns a single point when outputPointCount is 1", () => {
    const controlPoints = [
      { x: 10, y: 20 },
      { x: 90, y: 80 },
    ];
    // outputPointCount=1 → step = 1/0 = Infinity → t = 0*Infinity = NaN
    // This is an edge case: the function produces NaN coordinates
    const result = bezier2D(controlPoints, 1);
    expect(result).toHaveLength(1);
    expect(result[0].x).toBeNaN();
    expect(result[0].y).toBeNaN();
  });

  it("maintains curve symmetry for symmetric control points", () => {
    const controlPoints = [
      { x: 0, y: 0 },
      { x: 50, y: 200 },
      { x: 100, y: 0 },
    ];
    const result = bezier2D(controlPoints, 11);

    // Result should be symmetric around midpoint
    for (let i = 0; i < 5; i++) {
      expect(result[i].y).toBeCloseTo(result[10 - i].y, 4);
      expect(result[i].x + result[10 - i].x).toBeCloseTo(100, 4);
    }
  });

  it("simulates a jump trajectory (typical game use case)", () => {
    // Start at (100, 300), arc through (200, 100), land at (300, 300)
    const controlPoints = [
      { x: 100, y: 300 },
      { x: 200, y: 0 },
      { x: 300, y: 300 },
    ];
    const result = bezier2D(controlPoints, 21);

    // Should go up then come back down
    expect(result[0].y).toBeCloseTo(300, 5);
    expect(result[20].y).toBeCloseTo(300, 5);
    // Peak should be higher than start (lower y in screen coords)
    expect(result[10].y).toBeLessThan(300);
  });
});
