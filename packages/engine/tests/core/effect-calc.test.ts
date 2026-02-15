import { describe, it, expect } from "vitest";
import {
  getEffectAmount,
  addMagicEffect,
  getCharacterDeathExp,
  type EffectCharacter,
} from "../../src/magic/effect-calc";

function makeCharacter(overrides: Partial<EffectCharacter> = {}): EffectCharacter {
  return {
    isPlayer: true,
    realAttack: 100,
    attack2: 50,
    attack3: 30,
    ...overrides,
  };
}

describe("getEffectAmount", () => {
  it("uses magic.effect for player when effect > 0", () => {
    const magic = { effect: 80, effect2: 0, effect3: 0, effectExt: 10 };
    const char = makeCharacter({ realAttack: 100 });
    // baseEffect = magic.effect + effectExt = 80 + 10 = 90
    expect(getEffectAmount(magic, char, "effect")).toBe(90);
  });

  it("uses realAttack when magic.effect == 0 for player", () => {
    const magic = { effect: 0, effect2: 0, effect3: 0, effectExt: 5 };
    const char = makeCharacter({ realAttack: 100 });
    // baseEffect = realAttack + effectExt = 100 + 5 = 105
    expect(getEffectAmount(magic, char, "effect")).toBe(105);
  });

  it("uses realAttack for NPC regardless of magic.effect", () => {
    const magic = { effect: 80, effect2: 0, effect3: 0, effectExt: 0 };
    const char = makeCharacter({ isPlayer: false, realAttack: 50 });
    expect(getEffectAmount(magic, char, "effect")).toBe(50);
  });

  it("handles effect2", () => {
    const magic = { effect: 0, effect2: 60, effect3: 0, effectExt: 0 };
    const char = makeCharacter();
    // effect2 > 0 and isPlayer -> use magic.effect2
    expect(getEffectAmount(magic, char, "effect2")).toBe(60);
  });

  it("handles effect3", () => {
    const magic = { effect: 0, effect2: 0, effect3: 40, effectExt: 0 };
    const char = makeCharacter();
    expect(getEffectAmount(magic, char, "effect3")).toBe(40);
  });

  it("applies percent bonus for player", () => {
    const magic = { effect: 100, effect2: 0, effect3: 0, effectExt: 0 };
    const char = makeCharacter({
      getAddMagicEffectPercent: () => 50, // +50%
      getAddMagicEffectAmount: () => 0,
    });
    // 100 + floor(100 * 50 / 100) = 100 + 50 = 150
    expect(getEffectAmount(magic, char, "effect")).toBe(150);
  });

  it("applies flat amount bonus for player", () => {
    const magic = { effect: 100, effect2: 0, effect3: 0, effectExt: 0 };
    const char = makeCharacter({
      getAddMagicEffectPercent: () => 0,
      getAddMagicEffectAmount: () => 25,
    });
    expect(getEffectAmount(magic, char, "effect")).toBe(125);
  });
});

describe("addMagicEffect", () => {
  it("returns effect unchanged for NPC", () => {
    const char = makeCharacter({ isPlayer: false });
    expect(addMagicEffect(char, 100)).toBe(100);
  });

  it("applies both percent and flat amount", () => {
    const char = makeCharacter({
      getAddMagicEffectPercent: () => 20,
      getAddMagicEffectAmount: () => 10,
    });
    // 100 + floor(100 * 20 / 100) + 10 = 100 + 20 + 10 = 130
    expect(addMagicEffect(char, 100)).toBe(130);
  });

  it("handles missing bonus methods gracefully", () => {
    const char = makeCharacter();
    // No getAddMagicEffectPercent/Amount defined → defaults to 0
    expect(addMagicEffect(char, 100)).toBe(100);
  });
});

describe("getCharacterDeathExp", () => {
  it("calculates exp from levels", () => {
    expect(getCharacterDeathExp({ level: 10 }, { level: 5 })).toBe(50);
  });

  it("adds expBonus when present", () => {
    expect(getCharacterDeathExp({ level: 10 }, { level: 5, expBonus: 100 })).toBe(150);
  });

  it("returns minimum of 4", () => {
    expect(getCharacterDeathExp({ level: 1 }, { level: 1 })).toBe(4);
  });

  it("returns 4 for very low values", () => {
    expect(getCharacterDeathExp({ level: 1 }, { level: 2 })).toBe(4);
  });

  it("handles null/undefined inputs", () => {
    expect(getCharacterDeathExp(null as never, null as never)).toBe(1);
  });
});
