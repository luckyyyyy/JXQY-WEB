import { describe, it, expect } from "vitest";
import { lerp, clamp, vectorLength, normalizeVector, getSpeedRatio } from "../../src/utils/math";

describe("lerp", () => {
  it("returns start value when t=0", () => {
    expect(lerp(10, 20, 0)).toBe(10);
  });

  it("returns end value when t=1", () => {
    expect(lerp(10, 20, 1)).toBe(20);
  });

  it("returns midpoint when t=0.5", () => {
    expect(lerp(0, 100, 0.5)).toBe(50);
  });

  it("handles negative values", () => {
    expect(lerp(-10, 10, 0.5)).toBe(0);
  });

  it("extrapolates beyond 0-1 range", () => {
    expect(lerp(0, 10, 2)).toBe(20);
    expect(lerp(0, 10, -1)).toBe(-10);
  });
});

describe("clamp", () => {
  it("returns value when within range", () => {
    expect(clamp(5, 0, 10)).toBe(5);
  });

  it("clamps to min", () => {
    expect(clamp(-5, 0, 10)).toBe(0);
  });

  it("clamps to max", () => {
    expect(clamp(15, 0, 10)).toBe(10);
  });

  it("handles equal min and max", () => {
    expect(clamp(5, 3, 3)).toBe(3);
  });

  it("handles boundary values", () => {
    expect(clamp(0, 0, 10)).toBe(0);
    expect(clamp(10, 0, 10)).toBe(10);
  });
});

describe("vectorLength", () => {
  it("returns 0 for zero vector", () => {
    expect(vectorLength({ x: 0, y: 0 })).toBe(0);
  });

  it("returns correct length for axis-aligned vectors", () => {
    expect(vectorLength({ x: 3, y: 0 })).toBe(3);
    expect(vectorLength({ x: 0, y: 4 })).toBe(4);
  });

  it("returns correct length for 3-4-5 triangle", () => {
    expect(vectorLength({ x: 3, y: 4 })).toBe(5);
  });

  it("handles negative components", () => {
    expect(vectorLength({ x: -3, y: -4 })).toBe(5);
  });
});

describe("normalizeVector", () => {
  it("returns zero vector for zero input", () => {
    const result = normalizeVector({ x: 0, y: 0 });
    expect(result.x).toBe(0);
    expect(result.y).toBe(0);
  });

  it("normalizes to unit length", () => {
    const result = normalizeVector({ x: 3, y: 4 });
    expect(result.x).toBeCloseTo(0.6);
    expect(result.y).toBeCloseTo(0.8);
  });

  it("preserves direction", () => {
    const result = normalizeVector({ x: -5, y: 0 });
    expect(result.x).toBeCloseTo(-1);
    expect(result.y).toBeCloseTo(0);
  });

  it("unit vector stays unchanged", () => {
    const result = normalizeVector({ x: 1, y: 0 });
    expect(result.x).toBeCloseTo(1);
    expect(result.y).toBeCloseTo(0);
  });
});

describe("getSpeedRatio", () => {
  it("returns 1.0 for horizontal direction", () => {
    expect(getSpeedRatio({ x: 1, y: 0 })).toBe(1);
    expect(getSpeedRatio({ x: -1, y: 0 })).toBe(1);
  });

  it("returns 0.5 for pure vertical direction", () => {
    expect(getSpeedRatio({ x: 0, y: 1 })).toBe(0.5);
    expect(getSpeedRatio({ x: 0, y: -1 })).toBe(0.5);
  });

  it("returns value between 0.5 and 1.0 for diagonal", () => {
    const ratio = getSpeedRatio({ x: 0.707, y: 0.707 });
    expect(ratio).toBeGreaterThan(0.5);
    expect(ratio).toBeLessThan(1);
  });
});
