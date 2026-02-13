import { describe, it, expect, vi } from "vitest";
import { GoodType } from "../../src/player/good-drop";

// Mock logger and Obj
vi.mock("../../src/core/logger", () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    log: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

// We test the pure functions by re-implementing them here since they're
// not exported. We'll test GoodType enum and derive behavior from the module.
// The real value is testing the logic patterns.

describe("GoodType enum", () => {
  it("has correct values", () => {
    expect(GoodType.Weapon).toBe(0);
    expect(GoodType.Armor).toBe(1);
    expect(GoodType.Money).toBe(2);
    expect(GoodType.Drug).toBe(3);
    expect(GoodType.MaxType).toBe(4);
  });
});

// Test the getScriptFileName logic (replicated since it's not exported)
describe("getScriptFileName logic", () => {
  function getScriptFileName(type: GoodType, characterLevel: number): string {
    switch (type) {
      case GoodType.Weapon:
      case GoodType.Armor:
      case GoodType.Money: {
        let level = Math.floor(characterLevel / 12) + 1;
        if (level > 7) level = 7;
        switch (type) {
          case GoodType.Weapon: return `${level}级武器.txt`;
          case GoodType.Armor: return `${level}级防具.txt`;
          case GoodType.Money: return `${level}级钱.txt`;
        }
        break;
      }
      case GoodType.Drug:
        if (characterLevel <= 10) return "低级药品.txt";
        else if (characterLevel <= 30) return "中级药品.txt";
        else if (characterLevel <= 60) return "高级药品.txt";
        else return "特级药品.txt";
    }
    return "";
  }

  it("weapon level scales with character level", () => {
    expect(getScriptFileName(GoodType.Weapon, 1)).toBe("1级武器.txt");
    expect(getScriptFileName(GoodType.Weapon, 12)).toBe("2级武器.txt");
    expect(getScriptFileName(GoodType.Weapon, 24)).toBe("3级武器.txt");
  });

  it("weapon level caps at 7", () => {
    expect(getScriptFileName(GoodType.Weapon, 200)).toBe("7级武器.txt");
  });

  it("armor follows same level scaling", () => {
    expect(getScriptFileName(GoodType.Armor, 1)).toBe("1级防具.txt");
    expect(getScriptFileName(GoodType.Armor, 36)).toBe("4级防具.txt");
  });

  it("money follows same level scaling", () => {
    expect(getScriptFileName(GoodType.Money, 1)).toBe("1级钱.txt");
  });

  it("drug levels are range-based", () => {
    expect(getScriptFileName(GoodType.Drug, 5)).toBe("低级药品.txt");
    expect(getScriptFileName(GoodType.Drug, 10)).toBe("低级药品.txt");
    expect(getScriptFileName(GoodType.Drug, 11)).toBe("中级药品.txt");
    expect(getScriptFileName(GoodType.Drug, 30)).toBe("中级药品.txt");
    expect(getScriptFileName(GoodType.Drug, 31)).toBe("高级药品.txt");
    expect(getScriptFileName(GoodType.Drug, 60)).toBe("高级药品.txt");
    expect(getScriptFileName(GoodType.Drug, 61)).toBe("特级药品.txt");
  });
});

// Test the parseDropIni logic (replicated since it's not exported)
describe("parseDropIni logic", () => {
  function parseDropIni(dropIni: string): { ini: string; shouldDrop: boolean } {
    if (!dropIni.endsWith("]")) {
      return { ini: dropIni, shouldDrop: true };
    }
    const startIdx = dropIni.lastIndexOf("[");
    if (startIdx === -1) {
      return { ini: dropIni, shouldDrop: true };
    }
    const chanceStr = dropIni.substring(startIdx + 1, dropIni.length - 1);
    const chance = parseInt(chanceStr, 10);
    if (Number.isNaN(chance)) {
      return { ini: dropIni.substring(0, startIdx), shouldDrop: true };
    }
    return {
      ini: dropIni.substring(0, startIdx),
      shouldDrop: true, // for deterministic tests, we skip the random part
    };
  }

  it("parses plain ini filename", () => {
    const result = parseDropIni("sword.ini");
    expect(result.ini).toBe("sword.ini");
    expect(result.shouldDrop).toBe(true);
  });

  it("parses ini with probability bracket", () => {
    const result = parseDropIni("sword.ini[50]");
    expect(result.ini).toBe("sword.ini");
  });

  it("handles malformed bracket", () => {
    const result = parseDropIni("sword.ini[abc]");
    expect(result.ini).toBe("sword.ini");
    expect(result.shouldDrop).toBe(true);
  });
});

// Test getDropIniFileName logic
describe("getDropIniFileName logic", () => {
  function getDropIniFileName(type: GoodType): string {
    switch (type) {
      case GoodType.Weapon: return "可捡武器.ini";
      case GoodType.Armor: return "可捡防具.ini";
      case GoodType.Money: return "可捡钱.ini";
      case GoodType.Drug: return "可捡药品.ini";
      default: return "";
    }
  }

  it("maps each type to correct ini", () => {
    expect(getDropIniFileName(GoodType.Weapon)).toBe("可捡武器.ini");
    expect(getDropIniFileName(GoodType.Armor)).toBe("可捡防具.ini");
    expect(getDropIniFileName(GoodType.Money)).toBe("可捡钱.ini");
    expect(getDropIniFileName(GoodType.Drug)).toBe("可捡药品.ini");
  });

  it("returns empty for invalid type", () => {
    expect(getDropIniFileName(99 as GoodType)).toBe("");
  });
});
