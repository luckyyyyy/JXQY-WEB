import { describe, it, expect, vi } from "vitest";
import { AttrInt, AttrString } from "../../src/character/attr-types";

// Mock logger to avoid localStorage issues in Node
vi.mock("../../src/core/logger", () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    log: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe("AttrInt", () => {
  describe("fixed value", () => {
    it("parses integer string", () => {
      const attr = new AttrInt("123");
      expect(attr.getOneValue()).toBe(123);
      expect(attr.isRand()).toBe(false);
    });

    it("accepts numeric input", () => {
      const attr = new AttrInt(42);
      expect(attr.getOneValue()).toBe(42);
      expect(attr.isRand()).toBe(false);
    });

    it("returns 0 for non-numeric string", () => {
      const attr = new AttrInt("abc");
      expect(attr.getOneValue()).toBe(0);
    });

    it("getMaxValue equals getMinValue for fixed", () => {
      const attr = new AttrInt("50");
      expect(attr.getMaxValue()).toBe(50);
      expect(attr.getMinValue()).toBe(50);
    });
  });

  describe("range value (>)", () => {
    it("parses range format", () => {
      const attr = new AttrInt("10>20");
      expect(attr.isRand()).toBe(true);
      expect(attr.getMinValue()).toBe(10);
      expect(attr.getMaxValue()).toBe(20);
    });

    it("auto-swaps reversed range", () => {
      const attr = new AttrInt("20>10");
      expect(attr.getMinValue()).toBe(10);
      expect(attr.getMaxValue()).toBe(20);
    });

    it("generates values within range", () => {
      const attr = new AttrInt("1>100");
      for (let i = 0; i < 50; i++) {
        const val = attr.getOneValue();
        expect(val).toBeGreaterThanOrEqual(1);
        expect(val).toBeLessThanOrEqual(100);
      }
    });
  });

  describe("list value (,)", () => {
    it("parses comma-separated values", () => {
      const attr = new AttrInt("1,3,5,7");
      expect(attr.isRand()).toBe(true);
      expect(attr.getMinValue()).toBe(1);
      expect(attr.getMaxValue()).toBe(7);
    });

    it("generates values from the list", () => {
      const attr = new AttrInt("10,20,30");
      const validValues = new Set([10, 20, 30]);
      for (let i = 0; i < 50; i++) {
        expect(validValues.has(attr.getOneValue())).toBe(true);
      }
    });
  });

  describe("getString", () => {
    it("returns value for fixed", () => {
      expect(new AttrInt("42").getString()).toBe("42");
    });

    it("returns list for comma-separated", () => {
      expect(new AttrInt("1,3,5").getString()).toBe("1,3,5");
    });
  });

  describe("getUIString", () => {
    it("adds + for positive fixed values", () => {
      expect(new AttrInt("10").getUIString()).toBe("+10");
    });

    it("shows negative values as-is", () => {
      expect(new AttrInt("-5").getUIString()).toBe("-5");
    });

    it("shows 0 as '0'", () => {
      expect(new AttrInt("0").getUIString()).toBe("0");
    });
  });

  describe("getNonRandom", () => {
    it("returns fixed AttrInt from random", () => {
      const attr = new AttrInt("10>20");
      const nonRand = attr.getNonRandom();
      expect(nonRand.isRand()).toBe(false);
      const val = nonRand.getOneValue();
      expect(val).toBeGreaterThanOrEqual(10);
      expect(val).toBeLessThanOrEqual(20);
    });
  });
});

describe("AttrString", () => {
  describe("fixed value", () => {
    it("returns the string value", () => {
      const attr = new AttrString("hello");
      expect(attr.getOneValue()).toBe("hello");
      expect(attr.isRand()).toBe(false);
    });

    it("trims whitespace", () => {
      const attr = new AttrString("  hello  ");
      expect(attr.getOneValue()).toBe("hello");
    });
  });

  describe("list value", () => {
    it("returns random value from list", () => {
      const attr = new AttrString("a,b,c");
      expect(attr.isRand()).toBe(true);
      const validValues = new Set(["a", "b", "c"]);
      for (let i = 0; i < 50; i++) {
        expect(validValues.has(attr.getOneValue())).toBe(true);
      }
    });
  });

  describe("weighted list", () => {
    it("parses weight syntax", () => {
      const attr = new AttrString("rare[1],common[9]");
      expect(attr.isRand()).toBe(true);
    });

    it("respects weights (statistical test)", () => {
      // common should appear much more often than rare
      const attr = new AttrString("rare[1],common[99]");
      let commonCount = 0;
      const iterations = 1000;
      for (let i = 0; i < iterations; i++) {
        if (attr.getOneValue() === "common") commonCount++;
      }
      // common should be ~99% of the time
      expect(commonCount).toBeGreaterThan(iterations * 0.9);
    });

    it("handles NaN weights as default 1", () => {
      const attr = new AttrString("a[abc],b");
      expect(attr.isRand()).toBe(true);
      // Both should appear since both have weight 1
      const values = new Set<string>();
      for (let i = 0; i < 50; i++) {
        values.add(attr.getOneValue());
      }
      expect(values.has("a")).toBe(true);
      expect(values.has("b")).toBe(true);
    });
  });

  describe("getString", () => {
    it("returns fixed value string", () => {
      expect(new AttrString("hello").getString()).toBe("hello");
    });

    it("returns weighted format string", () => {
      expect(new AttrString("a[2],b[3]").getString()).toBe("a[2],b[3]");
    });

    it("omits weight for NaN weights", () => {
      expect(new AttrString("a,b").getString()).toBe("a,b");
    });
  });
});
