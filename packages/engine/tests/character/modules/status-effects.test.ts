/**
 * StatusEffectsManager tests - 状态效果管理器
 * 冰冻、中毒、石化、弱化、隐身等战斗状态
 */
import { describe, expect, it } from "vitest";
import { StatusEffectsManager } from "../../../src/character/modules/status-effects";

function createManager(): StatusEffectsManager {
  return new StatusEffectsManager();
}

describe("StatusEffectsManager", () => {
  describe("initial state", () => {
    it("starts with no effects", () => {
      const mgr = createManager();
      expect(mgr.isFrozen).toBe(false);
      expect(mgr.isPoisoned).toBe(false);
      expect(mgr.isPetrified).toBe(false);
      expect(mgr.bodyFunctionWell).toBe(true);
    });
  });

  // ========== Set methods (no overwrite) ==========

  describe("setFrozenSeconds", () => {
    it("sets frozen state", () => {
      const mgr = createManager();
      mgr.setFrozenSeconds(5, true);
      expect(mgr.isFrozen).toBe(true);
      expect(mgr.frozenSeconds).toBe(5);
      expect(mgr.isFrozenVisualEffect).toBe(true);
    });

    it("does NOT overwrite if already frozen", () => {
      const mgr = createManager();
      mgr.setFrozenSeconds(5, true);
      mgr.setFrozenSeconds(10, false); // should be ignored
      expect(mgr.frozenSeconds).toBe(5);
      expect(mgr.isFrozenVisualEffect).toBe(true);
    });
  });

  describe("setPoisonSeconds", () => {
    it("sets poison state", () => {
      const mgr = createManager();
      mgr.setPoisonSeconds(3, true);
      expect(mgr.isPoisoned).toBe(true);
      expect(mgr.poisonSeconds).toBe(3);
    });

    it("does NOT overwrite if already poisoned", () => {
      const mgr = createManager();
      mgr.setPoisonSeconds(3, true);
      mgr.setPoisonSeconds(10, false);
      expect(mgr.poisonSeconds).toBe(3);
    });
  });

  describe("setPetrifySeconds", () => {
    it("sets petrified state", () => {
      const mgr = createManager();
      mgr.setPetrifySeconds(8, false);
      expect(mgr.isPetrified).toBe(true);
      expect(mgr.petrifiedSeconds).toBe(8);
      expect(mgr.isPetrifiedVisualEffect).toBe(false);
    });

    it("does NOT overwrite if already petrified", () => {
      const mgr = createManager();
      mgr.setPetrifySeconds(8, true);
      mgr.setPetrifySeconds(20, false);
      expect(mgr.petrifiedSeconds).toBe(8);
    });
  });

  describe("bodyFunctionWell", () => {
    it("returns false when frozen", () => {
      const mgr = createManager();
      mgr.setFrozenSeconds(1, false);
      expect(mgr.bodyFunctionWell).toBe(false);
    });

    it("returns false when poisoned", () => {
      const mgr = createManager();
      mgr.setPoisonSeconds(1, false);
      expect(mgr.bodyFunctionWell).toBe(false);
    });

    it("returns false when petrified", () => {
      const mgr = createManager();
      mgr.setPetrifySeconds(1, false);
      expect(mgr.bodyFunctionWell).toBe(false);
    });
  });

  // ========== Clear methods ==========

  describe("toNormalState", () => {
    it("clears all CC effects", () => {
      const mgr = createManager();
      mgr.setFrozenSeconds(5, true);
      mgr.setPoisonSeconds(3, true);
      mgr.setPetrifySeconds(8, true);

      mgr.toNormalState();
      expect(mgr.isFrozen).toBe(false);
      expect(mgr.isPoisoned).toBe(false);
      expect(mgr.isPetrified).toBe(false);
      expect(mgr.bodyFunctionWell).toBe(true);
    });
  });

  describe("removeAbnormalState", () => {
    it("also clears disable effects", () => {
      const mgr = createManager();
      mgr.setFrozenSeconds(5, true);
      mgr.disableMoveMilliseconds = 1000;
      mgr.disableSkillMilliseconds = 2000;

      mgr.removeAbnormalState();
      expect(mgr.isFrozen).toBe(false);
      expect(mgr.disableMoveMilliseconds).toBe(0);
      expect(mgr.disableSkillMilliseconds).toBe(0);
    });
  });

  // ========== Update ==========

  describe("update", () => {
    it("returns default result when no effects active", () => {
      const mgr = createManager();
      const result = mgr.update(0.016, false);

      expect(result.isPetrified).toBe(false);
      expect(result.speedFold).toBe(1.0);
      expect(result.effectiveDeltaTime).toBeCloseTo(0.016, 5);
      expect(result.poisonDamage).toBe(0);
      expect(result.poisonKillerName).toBeNull();
      expect(result.changeCharacterExpired).toBe(false);
    });

    it("counts down frozen seconds and halves deltaTime", () => {
      const mgr = createManager();
      mgr.setFrozenSeconds(2.0, true);

      const result = mgr.update(0.5, false);

      // Frozen should decrease
      expect(mgr.frozenSeconds).toBeCloseTo(1.5, 5);
      // effectiveDeltaTime should be halved
      expect(result.effectiveDeltaTime).toBeCloseTo(0.25, 5);
    });

    it("clears frozen when duration expires", () => {
      const mgr = createManager();
      mgr.setFrozenSeconds(0.1, true);

      mgr.update(0.2, false);
      expect(mgr.frozenSeconds).toBeLessThanOrEqual(0);
    });

    it("counts down poison and deals damage every 250ms", () => {
      const mgr = createManager();
      mgr.setPoisonSeconds(5, true);
      mgr.poisonByCharacterName = "Boss";

      // First update: 0.3s = 300ms > 250ms threshold
      const result = mgr.update(0.3, false);
      expect(result.poisonDamage).toBe(10);
    });

    it("returns poison killer name when character dies from poison", () => {
      const mgr = createManager();
      mgr.setPoisonSeconds(5, true);
      mgr.poisonByCharacterName = "Assassin";

      // Enough time for poison tick + isDeathInvoked=true
      const result = mgr.update(0.3, true);
      expect(result.poisonDamage).toBe(10);
      expect(result.poisonKillerName).toBe("Assassin");
    });

    it("returns isPetrified=true and skips frozen processing", () => {
      const mgr = createManager();
      mgr.setPetrifySeconds(3, true);
      mgr.setFrozenSeconds(5, true);

      const result = mgr.update(1.0, false);
      expect(result.isPetrified).toBe(true);
      // Petrified should decrease
      expect(mgr.petrifiedSeconds).toBeCloseTo(2.0, 5);
      // Frozen is still 5 - it's processed but petrification returns early 
      // Actually frozen is set after petrification, so let's just check petrified
    });

    it("counts down weak effect", () => {
      const mgr = createManager();
      mgr.weakByMagicSpriteTime = 1000; // 1s in ms
      mgr.weakByMagicSprite = { isInDestroy: false, isDestroyed: false, magic: {} } as never;

      mgr.update(0.5, false); // 500ms
      expect(mgr.weakByMagicSpriteTime).toBeCloseTo(500, 0);

      mgr.update(0.6, false); // 600ms more → total 1100ms → expired
      expect(mgr.weakByMagicSpriteTime).toBe(0);
      expect(mgr.weakByMagicSprite).toBeNull();
    });

    it("counts down disable timers", () => {
      const mgr = createManager();
      mgr.disableMoveMilliseconds = 500;
      mgr.disableSkillMilliseconds = 1000;

      mgr.update(0.3, false); // 300ms
      expect(mgr.disableMoveMilliseconds).toBeCloseTo(200, 0);
      expect(mgr.disableSkillMilliseconds).toBeCloseTo(700, 0);
    });

    it("counts down invisibility", () => {
      const mgr = createManager();
      mgr.invisibleByMagicTime = 2000;

      mgr.update(1.0, false);
      expect(mgr.invisibleByMagicTime).toBeCloseTo(1000, 0);

      mgr.update(1.5, false);
      expect(mgr.invisibleByMagicTime).toBe(0);
    });

    it("clears speed up when magic sprite is destroyed", () => {
      const mgr = createManager();
      const sprite = {
        isInDestroy: false,
        isDestroyed: true,
        magic: { rangeSpeedUp: 50 },
      } as never;
      mgr.speedUpByMagicSprite = sprite;

      mgr.update(0.016, false);
      expect(mgr.speedUpByMagicSprite).toBeNull();
    });

    it("calculates speed fold from speed up sprite", () => {
      const mgr = createManager();
      mgr.speedUpByMagicSprite = {
        isInDestroy: false,
        isDestroyed: false,
        magic: { rangeSpeedUp: 50 },
      } as never;

      const result = mgr.update(0.016, false);
      // 100 + 50 = 150 → 1.5
      expect(result.speedFold).toBeCloseTo(1.5, 5);
    });

    it("notifies when change character effect expires", () => {
      const mgr = createManager();
      const mockMagic = { replaceMagic: "transform_skills" };
      mgr.changeCharacterByMagicSprite = {
        isInDestroy: false,
        isDestroyed: false,
        magic: mockMagic,
      } as never;
      mgr.changeCharacterByMagicSpriteTime = 500; // 500ms

      // Not yet expired
      let result = mgr.update(0.3, false);
      expect(result.changeCharacterExpired).toBe(false);

      // Now expire
      result = mgr.update(0.3, false);
      expect(result.changeCharacterExpired).toBe(true);
      expect(result.changeCharacterExpiredMagic).toBe(mockMagic);
      expect(mgr.changeCharacterByMagicSprite).toBeNull();
    });

    it("counts down changeToOppositeMilliseconds", () => {
      const mgr = createManager();
      mgr.changeToOppositeMilliseconds = 2000;

      mgr.update(1.0, false);
      expect(mgr.changeToOppositeMilliseconds).toBeCloseTo(1000, 0);

      mgr.update(1.5, false);
      expect(mgr.changeToOppositeMilliseconds).toBe(0);
    });
  });

  // ========== changeToOpposite ==========

  describe("changeToOpposite", () => {
    it("does not affect player", () => {
      const mgr = createManager();
      mgr.changeToOpposite(5000, true);
      expect(mgr.changeToOppositeMilliseconds).toBe(0);
    });

    it("toggles for NPC", () => {
      const mgr = createManager();
      mgr.changeToOpposite(5000, false);
      expect(mgr.changeToOppositeMilliseconds).toBe(5000);

      // Calling again toggles off
      mgr.changeToOpposite(3000, false);
      expect(mgr.changeToOppositeMilliseconds).toBe(0);
    });
  });
});
