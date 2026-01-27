/**
 * 跟随敌人效果 - MoveKind=16 (FollowEnemy)
 *
 * 追踪敌人的武功
 */

import type { MagicEffect, ApplyContext } from "./types";
import { dealDamage } from "./common";

/**
 * 创建跟随敌人效果
 */
export function createFollowEnemyEffect(): MagicEffect {
  return {
    // 注意：消耗已在 magicHandler.ts 中扣除，不需要 onCast

    /**
     * 命中时：造成伤害
     */
    apply(ctx: ApplyContext): void {
      dealDamage(ctx);
    },
  };
}

/**
 * 跟随敌人效果实例
 */
export const followEnemyEffect = createFollowEnemyEffect();
