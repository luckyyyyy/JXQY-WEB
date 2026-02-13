import { describe, it, expect } from "vitest";
import { calculateLevelUp, getLevelDetail, type LevelDetail } from "../../../src/character/level/level-manager";

function makeLevelConfig(): Map<number, LevelDetail> {
  const config = new Map<number, LevelDetail>();
  config.set(1, {
    level: 1,
    lifeMax: 100,
    thewMax: 50,
    manaMax: 30,
    attack: 10,
    attack2: 5,
    attack3: 3,
    defend: 8,
    defend2: 4,
    defend3: 2,
    evade: 5,
    levelUpExp: 100,
    newMagic: "",
    newGood: "",
  });
  config.set(2, {
    level: 2,
    lifeMax: 150,
    thewMax: 60,
    manaMax: 45,
    attack: 15,
    attack2: 8,
    attack3: 5,
    defend: 12,
    defend2: 6,
    defend3: 3,
    evade: 7,
    levelUpExp: 250,
    newMagic: "fireball",
    newGood: "sword",
  });
  config.set(3, {
    level: 3,
    lifeMax: 220,
    thewMax: 75,
    manaMax: 65,
    attack: 22,
    attack2: 12,
    attack3: 8,
    defend: 18,
    defend2: 9,
    defend3: 5,
    evade: 10,
    levelUpExp: 500,
    newMagic: "",
    newGood: "",
  });
  return config;
}

describe("getLevelDetail", () => {
  it("returns detail for existing level", () => {
    const config = makeLevelConfig();
    const detail = getLevelDetail(config, 1);
    expect(detail).not.toBeNull();
    expect(detail!.lifeMax).toBe(100);
    expect(detail!.attack).toBe(10);
  });

  it("returns null for non-existing level", () => {
    const config = makeLevelConfig();
    expect(getLevelDetail(config, 99)).toBeNull();
  });

  it("returns null for null config", () => {
    expect(getLevelDetail(null, 1)).toBeNull();
  });
});

describe("calculateLevelUp", () => {
  it("calculates stat deltas between levels", () => {
    const config = makeLevelConfig();
    const result = calculateLevelUp(config, 1, 2);
    expect(result).not.toBeNull();
    expect(result!.lifeMaxDelta).toBe(50); // 150 - 100
    expect(result!.thewMaxDelta).toBe(10); // 60 - 50
    expect(result!.manaMaxDelta).toBe(15); // 45 - 30
    expect(result!.attackDelta).toBe(5); // 15 - 10
    expect(result!.attack2Delta).toBe(3); // 8 - 5
    expect(result!.attack3Delta).toBe(2); // 5 - 3
    expect(result!.defendDelta).toBe(4); // 12 - 8
    expect(result!.defend2Delta).toBe(2); // 6 - 4
    expect(result!.defend3Delta).toBe(1); // 3 - 2
    expect(result!.evadeDelta).toBe(2); // 7 - 5
    expect(result!.newLevelUpExp).toBe(250);
    expect(result!.newMagic).toBe("fireball");
    expect(result!.newGood).toBe("sword");
  });

  it("calculates multi-level jump", () => {
    const config = makeLevelConfig();
    const result = calculateLevelUp(config, 1, 3);
    expect(result).not.toBeNull();
    expect(result!.lifeMaxDelta).toBe(120); // 220 - 100
    expect(result!.attackDelta).toBe(12); // 22 - 10
  });

  it("returns null for invalid levels", () => {
    const config = makeLevelConfig();
    expect(calculateLevelUp(config, 1, 99)).toBeNull();
    expect(calculateLevelUp(config, 99, 1)).toBeNull();
  });

  it("returns null for null config", () => {
    expect(calculateLevelUp(null, 1, 2)).toBeNull();
  });

  it("handles same level (zero deltas)", () => {
    const config = makeLevelConfig();
    const result = calculateLevelUp(config, 2, 2);
    expect(result).not.toBeNull();
    expect(result!.lifeMaxDelta).toBe(0);
    expect(result!.attackDelta).toBe(0);
  });
});
