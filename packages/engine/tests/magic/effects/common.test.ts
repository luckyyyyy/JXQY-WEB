/**
 * Magic effects common tests - heal/restore/deductCost
 * 武功效果通用函数
 */
import { describe, expect, it } from "vitest";
import { healTarget, restoreMana, restoreThew, deductCost } from "../../../src/magic/effects/common";
import type { CharacterRef, CastContext } from "../../../src/magic/effects/types";

// Create a mock player CharacterRef with settable stats
function mockPlayerRef(stats: {
  life: number;
  lifeMax: number;
  mana: number;
  manaMax: number;
  thew: number;
  thewMax: number;
}): CharacterRef {
  return {
    type: "player",
    player: {
      life: stats.life,
      lifeMax: stats.lifeMax,
      mana: stats.mana,
      manaMax: stats.manaMax,
      thew: stats.thew,
      thewMax: stats.thewMax,
    },
  } as CharacterRef;
}

function mockNpcRef(stats: { life: number; lifeMax: number }): CharacterRef {
  return {
    type: "npc",
    npc: {
      life: stats.life,
      lifeMax: stats.lifeMax,
    },
    id: "test-npc",
  } as CharacterRef;
}

describe("healTarget", () => {
  it("heals up to max", () => {
    const ref = mockPlayerRef({ life: 50, lifeMax: 100, mana: 0, manaMax: 0, thew: 0, thewMax: 0 });
    const healed = healTarget(ref, 30);
    expect(healed).toBe(30);
    expect(ref.player.life).toBe(80);
  });

  it("clamps to lifeMax", () => {
    const ref = mockPlayerRef({ life: 90, lifeMax: 100, mana: 0, manaMax: 0, thew: 0, thewMax: 0 });
    const healed = healTarget(ref, 50);
    expect(healed).toBe(10); // only 10 actually healed
    expect(ref.player.life).toBe(100);
  });

  it("returns 0 when already full", () => {
    const ref = mockPlayerRef({ life: 100, lifeMax: 100, mana: 0, manaMax: 0, thew: 0, thewMax: 0 });
    const healed = healTarget(ref, 50);
    expect(healed).toBe(0);
  });

  it("works on NPC ref", () => {
    const ref = mockNpcRef({ life: 30, lifeMax: 80 });
    const healed = healTarget(ref, 25);
    expect(healed).toBe(25);
    expect(ref.npc.life).toBe(55);
  });
});

describe("restoreMana", () => {
  it("restores mana up to max", () => {
    const ref = mockPlayerRef({ life: 100, lifeMax: 100, mana: 20, manaMax: 100, thew: 0, thewMax: 0 });
    const restored = restoreMana(ref, 50);
    expect(restored).toBe(50);
    expect(ref.player.mana).toBe(70);
  });

  it("clamps to manaMax", () => {
    const ref = mockPlayerRef({ life: 100, lifeMax: 100, mana: 80, manaMax: 100, thew: 0, thewMax: 0 });
    const restored = restoreMana(ref, 50);
    expect(restored).toBe(20);
    expect(ref.player.mana).toBe(100);
  });
});

describe("restoreThew", () => {
  it("restores thew up to max", () => {
    const ref = mockPlayerRef({ life: 100, lifeMax: 100, mana: 0, manaMax: 0, thew: 30, thewMax: 100 });
    const restored = restoreThew(ref, 40);
    expect(restored).toBe(40);
    expect(ref.player.thew).toBe(70);
  });

  it("clamps to thewMax", () => {
    const ref = mockPlayerRef({ life: 100, lifeMax: 100, mana: 0, manaMax: 0, thew: 90, thewMax: 100 });
    const restored = restoreThew(ref, 30);
    expect(restored).toBe(10);
    expect(ref.player.thew).toBe(100);
  });
});

describe("deductCost", () => {
  it("deducts mana cost", () => {
    const ref = mockPlayerRef({ life: 100, lifeMax: 100, mana: 50, manaMax: 100, thew: 100, thewMax: 100 });
    const ctx = {
      caster: ref,
      magic: { manaCost: 30, thewCost: 0, lifeCost: 0 },
      guiManager: {},
    } as unknown as CastContext;

    deductCost(ctx);
    expect(ref.player.mana).toBe(20);
  });

  it("deducts thew cost", () => {
    const ref = mockPlayerRef({ life: 100, lifeMax: 100, mana: 100, manaMax: 100, thew: 50, thewMax: 100 });
    const ctx = {
      caster: ref,
      magic: { manaCost: 0, thewCost: 20, lifeCost: 0 },
      guiManager: {},
    } as unknown as CastContext;

    deductCost(ctx);
    expect(ref.player.thew).toBe(30);
  });

  it("deducts life cost (clamps to 1)", () => {
    const ref = mockPlayerRef({ life: 10, lifeMax: 100, mana: 0, manaMax: 0, thew: 0, thewMax: 0 });
    const ctx = {
      caster: ref,
      magic: { manaCost: 0, thewCost: 0, lifeCost: 50 },
      guiManager: {},
    } as unknown as CastContext;

    deductCost(ctx);
    expect(ref.player.life).toBe(1); // clamped to 1, not 0
  });

  it("deducts all costs simultaneously", () => {
    const ref = mockPlayerRef({ life: 100, lifeMax: 100, mana: 100, manaMax: 100, thew: 100, thewMax: 100 });
    const ctx = {
      caster: ref,
      magic: { manaCost: 10, thewCost: 20, lifeCost: 5 },
      guiManager: {},
    } as unknown as CastContext;

    deductCost(ctx);
    expect(ref.player.mana).toBe(90);
    expect(ref.player.thew).toBe(80);
    expect(ref.player.life).toBe(95);
  });

  it("clamps mana to 0", () => {
    const ref = mockPlayerRef({ life: 100, lifeMax: 100, mana: 5, manaMax: 100, thew: 100, thewMax: 100 });
    const ctx = {
      caster: ref,
      magic: { manaCost: 50, thewCost: 0, lifeCost: 0 },
      guiManager: {},
    } as unknown as CastContext;

    deductCost(ctx);
    expect(ref.player.mana).toBe(0);
  });
});
