import { describe, it, expect } from "vitest";
import { generateId } from "../../src/utils/id";

describe("generateId", () => {
  it("returns a non-empty string", () => {
    const id = generateId();
    expect(id).toBeTruthy();
    expect(typeof id).toBe("string");
  });

  it("generates unique IDs", () => {
    const ids = new Set<string>();
    for (let i = 0; i < 100; i++) {
      ids.add(generateId());
    }
    expect(ids.size).toBe(100);
  });

  it("contains a hyphen separator", () => {
    const id = generateId();
    expect(id).toContain("-");
  });
});
