/**
 * Magic effect registry tests
 * 武功效果注册表
 */
import { describe, expect, it } from "vitest";
import { getEffect, getRegisteredMoveKinds, registerEffect } from "../../../src/magic/effects/registry";
import { MagicMoveKind } from "../../../src/magic/types";
import type { MagicEffect } from "../../../src/magic/effects/types";

describe("magic effect registry", () => {
  describe("getEffect", () => {
    it("returns effect for SingleMove", () => {
      expect(getEffect(MagicMoveKind.SingleMove)).toBeDefined();
    });

    it("returns effect for FollowCharacter", () => {
      expect(getEffect(MagicMoveKind.FollowCharacter)).toBeDefined();
    });

    it("returns effect for SuperMode", () => {
      expect(getEffect(MagicMoveKind.SuperMode)).toBeDefined();
    });

    it("returns effect for RegionBased", () => {
      expect(getEffect(MagicMoveKind.RegionBased)).toBeDefined();
    });

    it("returns undefined for unregistered MoveKind", () => {
      expect(getEffect(MagicMoveKind.NoMove)).toBeUndefined();
    });

    it("all line/circle/sector move types use simpleDamage", () => {
      const lineMoveEffect = getEffect(MagicMoveKind.LineMove);
      expect(getEffect(MagicMoveKind.CircleMove)).toBe(lineMoveEffect);
      expect(getEffect(MagicMoveKind.HeartMove)).toBe(lineMoveEffect);
      expect(getEffect(MagicMoveKind.SpiralMove)).toBe(lineMoveEffect);
      expect(getEffect(MagicMoveKind.SectorMove)).toBe(lineMoveEffect);
      expect(getEffect(MagicMoveKind.SingleMove)).toBe(lineMoveEffect);
    });

    it("FollowCharacter and TimeStop use same effect", () => {
      expect(getEffect(MagicMoveKind.FollowCharacter)).toBe(
        getEffect(MagicMoveKind.TimeStop)
      );
    });
  });

  describe("getRegisteredMoveKinds", () => {
    it("returns all registered move kinds", () => {
      const kinds = getRegisteredMoveKinds();
      expect(kinds.length).toBeGreaterThan(10);
      expect(kinds).toContain(MagicMoveKind.SingleMove);
      expect(kinds).toContain(MagicMoveKind.FollowCharacter);
      expect(kinds).toContain(MagicMoveKind.SuperMode);
      expect(kinds).toContain(MagicMoveKind.Transport);
    });

    it("does NOT contain NoMove", () => {
      const kinds = getRegisteredMoveKinds();
      expect(kinds).not.toContain(MagicMoveKind.NoMove);
    });
  });

  describe("registerEffect", () => {
    it("registers a custom effect", () => {
      const customEffect: MagicEffect = {
        apply: () => 42,
      };

      registerEffect(MagicMoveKind.NoMove, customEffect);
      expect(getEffect(MagicMoveKind.NoMove)).toBe(customEffect);

      // Clean up - re-register undefined won't work, but NoMove wasn't original
    });
  });
});
