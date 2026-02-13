/**
 * Region Based Effects - MoveKind=11 区域类武功
 * Region 相关方法
 *
 * Region 值决定区域形状：
 * 1: Square - 方形区域
 * 2: Cross - 十字区域
 * 3: Rectangle - 矩形区域
 * 4: IsoscelesTriangle - 等腰三角形
 * 5: VType - V形区域
 * 6: RegionFile - 使用外部区域文件定义
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

/**
 * 创建区域武功效果
 */
export function createRegionBasedEffect(): MagicEffect {
  return { ...regionBasedEffect };
}
