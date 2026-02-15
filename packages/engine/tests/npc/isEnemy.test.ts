/**
 * isEnemy tests - 敌我关系判断（纯函数）
 */
import { describe, expect, it } from "vitest";
import { isEnemy } from "../../src/npc/npc-query-helpers";

// Minimal mock for CharacterBase
function mockChar(overrides: {
  isPlayer?: boolean;
  isFighter?: boolean;
  isFighterFriend?: boolean;
  isPartner?: boolean;
  group?: number;
}) {
  return {
    isPlayer: overrides.isPlayer ?? false,
    isFighter: overrides.isFighter ?? false,
    isFighterFriend: overrides.isFighterFriend ?? false,
    isPartner: overrides.isPartner ?? false,
    group: overrides.group ?? 0,
  } as never;
}

describe("isEnemy", () => {
  it("non-fighters are not enemies", () => {
    const civilian = mockChar({});
    const player = mockChar({ isPlayer: true });
    expect(isEnemy(civilian, player)).toBe(false);
  });

  it("two civilians are not enemies", () => {
    const a = mockChar({});
    const b = mockChar({});
    expect(isEnemy(a, b)).toBe(false);
  });

  it("player vs hostile fighter are enemies", () => {
    const player = mockChar({ isPlayer: true });
    const enemy = mockChar({ isFighter: true });
    expect(isEnemy(player, enemy)).toBe(true);
  });

  it("is commutative (enemy vs player)", () => {
    const player = mockChar({ isPlayer: true });
    const enemy = mockChar({ isFighter: true });
    expect(isEnemy(enemy, player)).toBe(true);
  });

  it("player vs partner are NOT enemies", () => {
    const player = mockChar({ isPlayer: true });
    const partner = mockChar({ isFighter: true, isPartner: true });
    expect(isEnemy(player, partner)).toBe(false);
  });

  it("player vs fighter friend are NOT enemies", () => {
    const player = mockChar({ isPlayer: true });
    const friend = mockChar({ isFighter: true, isFighterFriend: true });
    expect(isEnemy(player, friend)).toBe(false);
  });

  it("fighter friend vs hostile fighter are enemies", () => {
    const friend = mockChar({ isFighter: true, isFighterFriend: true });
    const enemy = mockChar({ isFighter: true });
    expect(isEnemy(friend, enemy)).toBe(true);
  });

  it("two fighters from same group are NOT enemies", () => {
    const a = mockChar({ isFighter: true, group: 1 });
    const b = mockChar({ isFighter: true, group: 1 });
    expect(isEnemy(a, b)).toBe(false);
  });

  it("two fighters from different groups ARE enemies", () => {
    const a = mockChar({ isFighter: true, group: 1 });
    const b = mockChar({ isFighter: true, group: 2 });
    expect(isEnemy(a, b)).toBe(true);
  });

  it("partner vs hostile fighter: partner is treated as friend", () => {
    const partner = mockChar({ isFighter: true, isPartner: true });
    const enemy = mockChar({ isFighter: true });
    // partner is isPartner=true, so b check: b.isPartner=true → (b.isPlayer || b.isFighterFriend) is false → first condition doesn't apply
    // But a check: a is isPartner=true but not isPlayer/isFighterFriend, so first condition skips
    // Falls to group check: 0 !== 0 → false
    expect(isEnemy(partner, enemy)).toBe(false);
  });
});
