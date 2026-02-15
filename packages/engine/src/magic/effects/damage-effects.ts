/**
 * Damage Effects - 伤害类武功效果集合
 */

import { logger } from "../../core/logger";
import { dealDamage } from "./common";
import type { ApplyContext, CastContext, EndContext, MagicEffect } from "./types";

/**
 * 区域类型枚举
 */
export enum RegionType {
  Square = 1,
  Cross = 2,
  Rectangle = 3,
  IsoscelesTriangle = 4,
  VType = 5,
  RegionFile = 6,
}

/**
 * 通用伤害效果实例（单例，所有简单伤害武功共用）
 */
export const simpleDamageEffect: MagicEffect = {
  apply(ctx: ApplyContext): number {
    return dealDamage(ctx);
  },
};

/**
 * 超级模式效果 - MoveKind=15 (SuperMode)
 */
export const superModeEffect: MagicEffect = {
  onCast(ctx: CastContext): void {
    if (ctx.magic.vibratingScreen > 0) {
      ctx.vibrateScreen?.(ctx.magic.vibratingScreen);
    }
  },

  apply(ctx: ApplyContext): number {
    return dealDamage(ctx);
  },

  onEnd(_ctx: EndContext): void {
    // 由 MagicManager 处理超级模式退出
  },
};

/**
 * 区域武功效果
 */
export const regionBasedEffect: MagicEffect = {
  onCast(ctx: CastContext): void {
    const { magic, audioManager } = ctx;
    logger.log(`[RegionBased] Cast: ${magic.name}, region=${magic.region}`);

    if (magic.flyingSound && audioManager) {
      audioManager.playSound(magic.flyingSound);
    }
  },

  apply(ctx: ApplyContext): number {
    const { magic } = ctx;

    const damage = dealDamage(ctx);

    logger.log(`[RegionBased] Apply: ${magic.name} dealt ${damage} damage`);

    return damage;
  },

  onEnd(ctx: EndContext): void {
    const { magic, audioManager } = ctx;

    if (magic.vanishSound && audioManager) {
      audioManager.playSound(magic.vanishSound);
    }
  },
};
