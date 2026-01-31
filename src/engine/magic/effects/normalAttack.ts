/**
 * 普通攻击效果 - MoveKind 2,3,4,5,6,7,8 等飞行武功
 *
 * 特点：释放时扣蓝，命中时造成伤害
 */

import { dealDamage } from "./common";
import type { ApplyContext, MagicEffect } from "./types";

/**
 * 创建普通攻击效果
 */
export function createNormalAttackEffect(): MagicEffect {
  return {
    // 注意：消耗已在 magicHandler.ts 中扣除，不需要 onCast

    /**
     * 命中时：造成伤害
     * @returns 实际造成的伤害值
     */
    apply(ctx: ApplyContext): number {
      return dealDamage(ctx);
    },
  };
}

/**
 * 普通攻击效果实例
 * 用于 MoveKind: SingleMove, LineMove, CircleMove, HeartMove, SpiralMove, SectorMove 等
 */
export const normalAttackEffect = createNormalAttackEffect();
