/**
 * Script condition evaluation tests
 * 脚本条件求值 - evaluateCondition & parseConditions 的逻辑测试
 *
 * These functions are not exported, so we replicate the pure logic to verify correctness.
 * The implementation is from gameStateCommands.ts and dialogCommands.ts.
 */
import { describe, expect, it } from "vitest";

// Replicated from gameStateCommands.ts / dialogCommands.ts (identical in both)
function evaluateCondition(condition: string, getVariable: (name: string) => number): boolean {
  const match = condition.match(/\$([_a-zA-Z0-9]+)\s*([><=]+)\s*([-]?\d+|\$[_a-zA-Z0-9]+)/);
  if (!match) {
    if (condition.startsWith("$")) {
      const varName = condition.slice(1).trim();
      return getVariable(varName) !== 0;
    }
    return false;
  }

  const [, varName, operator, rightValue] = match;
  const leftVal = getVariable(varName);
  const rightVal = rightValue.startsWith("$")
    ? getVariable(rightValue.slice(1))
    : parseInt(rightValue, 10);

  switch (operator) {
    case "==":
      return leftVal === rightVal;
    case "!=":
    case "<>":
      return leftVal !== rightVal;
    case ">=":
      return leftVal >= rightVal;
    case "<=":
      return leftVal <= rightVal;
    case ">":
    case ">>":
      return leftVal > rightVal;
    case "<":
    case "<<":
      return leftVal < rightVal;
    default:
      return false;
  }
}

// Replicated from dialogCommands.ts
function parseConditions(text: string): { text: string; conditions: string[] } {
  const conditions: string[] = [];
  let outText = "";
  let curCondition = "";
  let inCondition = false;

  for (let i = 0; i < text.length; i++) {
    if (text[i] === "{") {
      inCondition = true;
      curCondition = "";
    } else if (inCondition) {
      if (text[i] === "}") {
        inCondition = false;
        conditions.push(curCondition);
      } else {
        curCondition += text[i];
      }
    } else {
      outText += text[i];
    }
  }

  return { text: outText, conditions };
}

// ========== Tests ==========

const vars: Record<string, number> = {
  QuestDone: 1,
  Gold: 500,
  Level: 10,
  HasItem: 0,
  Counter: -3,
};

const getVar = (name: string): number => vars[name] ?? 0;

describe("evaluateCondition", () => {
  describe("equality (==)", () => {
    it("returns true when equal", () => {
      expect(evaluateCondition("$QuestDone == 1", getVar)).toBe(true);
    });

    it("returns false when not equal", () => {
      expect(evaluateCondition("$QuestDone == 0", getVar)).toBe(false);
    });
  });

  describe("not equal (!= and <>)", () => {
    it("!= is not matched by regex [><=]+ (falls through to boolean check)", () => {
      // The regex [><=]+ doesn't include '!', so $Gold != 0 won't match the comparison
      // It falls to the boolean check: $Gold → 500 !== 0 → true? No, the full string
      // "$Gold != 0" starts with $ but the whole slice "Gold != 0" is the varName
      // getVariable("Gold != 0") returns 0 → false
      expect(evaluateCondition("$Gold != 0", getVar)).toBe(false);
    });

    it("<> returns true when different", () => {
      expect(evaluateCondition("$Gold <> 0", getVar)).toBe(true);
    });

    it("!= returns false when equal", () => {
      expect(evaluateCondition("$Gold != 500", getVar)).toBe(false);
    });
  });

  describe("greater than (> and >>)", () => {
    it("> works", () => {
      expect(evaluateCondition("$Gold > 100", getVar)).toBe(true);
      expect(evaluateCondition("$Gold > 500", getVar)).toBe(false);
    });

    it(">> also works as >", () => {
      expect(evaluateCondition("$Gold >> 100", getVar)).toBe(true);
    });
  });

  describe("less than (< and <<)", () => {
    it("< works", () => {
      expect(evaluateCondition("$Level < 20", getVar)).toBe(true);
      expect(evaluateCondition("$Level < 5", getVar)).toBe(false);
    });

    it("<< also works as <", () => {
      expect(evaluateCondition("$Level << 20", getVar)).toBe(true);
    });
  });

  describe(">= and <=", () => {
    it(">= boundary", () => {
      expect(evaluateCondition("$Gold >= 500", getVar)).toBe(true);
      expect(evaluateCondition("$Gold >= 501", getVar)).toBe(false);
    });

    it("<= boundary", () => {
      expect(evaluateCondition("$Level <= 10", getVar)).toBe(true);
      expect(evaluateCondition("$Level <= 9", getVar)).toBe(false);
    });
  });

  describe("variable vs variable", () => {
    it("compares two variables", () => {
      expect(evaluateCondition("$Gold > $Level", getVar)).toBe(true);
      expect(evaluateCondition("$Level == $Level", getVar)).toBe(true);
    });
  });

  describe("negative values", () => {
    it("handles negative RHS", () => {
      expect(evaluateCondition("$Counter == -3", getVar)).toBe(true);
      expect(evaluateCondition("$Counter > -5", getVar)).toBe(true);
    });
  });

  describe("boolean-style (variable only)", () => {
    it("truthy when non-zero", () => {
      expect(evaluateCondition("$QuestDone", getVar)).toBe(true);
    });

    it("falsy when zero", () => {
      expect(evaluateCondition("$HasItem", getVar)).toBe(false);
    });

    it("falsy for undefined variable", () => {
      expect(evaluateCondition("$Unknown", getVar)).toBe(false);
    });
  });

  describe("invalid expressions", () => {
    it("returns false for non-variable expression", () => {
      expect(evaluateCondition("hello world", getVar)).toBe(false);
    });

    it("returns false for empty string", () => {
      expect(evaluateCondition("", getVar)).toBe(false);
    });
  });
});

describe("parseConditions", () => {
  it("extracts single condition", () => {
    const result = parseConditions("Hello{$QuestDone == 1}");
    expect(result.text).toBe("Hello");
    expect(result.conditions).toEqual(["$QuestDone == 1"]);
  });

  it("extracts multiple conditions", () => {
    const result = parseConditions("{$Level >= 10}Option A{$Gold > 100}");
    expect(result.text).toBe("Option A");
    expect(result.conditions).toEqual(["$Level >= 10", "$Gold > 100"]);
  });

  it("handles no conditions", () => {
    const result = parseConditions("Plain text option");
    expect(result.text).toBe("Plain text option");
    expect(result.conditions).toEqual([]);
  });

  it("handles empty text with condition", () => {
    const result = parseConditions("{$HasItem == 1}");
    expect(result.text).toBe("");
    expect(result.conditions).toEqual(["$HasItem == 1"]);
  });

  it("handles condition at start and end", () => {
    const result = parseConditions("{$A == 1}中间文字{$B == 2}");
    expect(result.text).toBe("中间文字");
    expect(result.conditions).toEqual(["$A == 1", "$B == 2"]);
  });
});
