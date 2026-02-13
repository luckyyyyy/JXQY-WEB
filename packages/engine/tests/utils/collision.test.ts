import { describe, it, expect } from "vitest";
import { isBoxCollide, type Rect } from "../../src/utils/collision";

describe("isBoxCollide", () => {
  it("detects overlapping rectangles", () => {
    const a: Rect = { x: 0, y: 0, width: 10, height: 10 };
    const b: Rect = { x: 5, y: 5, width: 10, height: 10 };
    expect(isBoxCollide(a, b)).toBe(true);
  });

  it("detects no collision for separated rectangles", () => {
    const a: Rect = { x: 0, y: 0, width: 10, height: 10 };
    const b: Rect = { x: 20, y: 20, width: 10, height: 10 };
    expect(isBoxCollide(a, b)).toBe(false);
  });

  it("detects edge-touching as no collision", () => {
    const a: Rect = { x: 0, y: 0, width: 10, height: 10 };
    const b: Rect = { x: 10, y: 0, width: 10, height: 10 };
    expect(isBoxCollide(a, b)).toBe(false);
  });

  it("detects containment", () => {
    const outer: Rect = { x: 0, y: 0, width: 100, height: 100 };
    const inner: Rect = { x: 10, y: 10, width: 5, height: 5 };
    expect(isBoxCollide(outer, inner)).toBe(true);
    expect(isBoxCollide(inner, outer)).toBe(true);
  });

  it("is commutative", () => {
    const a: Rect = { x: 0, y: 0, width: 10, height: 10 };
    const b: Rect = { x: 5, y: 5, width: 10, height: 10 };
    expect(isBoxCollide(a, b)).toBe(isBoxCollide(b, a));
  });

  it("handles negative coordinates", () => {
    const a: Rect = { x: -10, y: -10, width: 15, height: 15 };
    const b: Rect = { x: -5, y: -5, width: 10, height: 10 };
    expect(isBoxCollide(a, b)).toBe(true);
  });

  it("handles zero-size rectangles (point)", () => {
    const a: Rect = { x: 5, y: 5, width: 0, height: 0 };
    const b: Rect = { x: 0, y: 0, width: 10, height: 10 };
    // With strict < and >, a zero-size rect at (5,5) still satisfies:
    // 5 < 10 && 5 > 0 && 5 < 10 && 5 > 0 → true
    expect(isBoxCollide(a, b)).toBe(true);
  });
});
