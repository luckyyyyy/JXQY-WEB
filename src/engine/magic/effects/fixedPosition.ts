/**
 * 固定位置效果 - MoveKind=1 (FixedPosition), MoveKind=22 (FixedAtDestination)
 *
 * 在目标位置产生效果的武功（陷阱、法阵等）
 */

import type { MagicEffect, ApplyContext } from "./types";
import { dealDamage } from "./common";

/**
 * 创建固定位置效果
 */
export function createFixedPositionEffect(): MagicEffect {
  return {
    // 注意：消耗已在 magicHandler.ts 中扣除，不需要 onCast

    /**
     * 敌人进入范围时：造成伤害
     */
    apply(ctx: ApplyContext): void {
      dealDamage(ctx);
    },
  };
}

/**
 * 固定位置效果实例
 */
export const fixedPositionEffect = createFixedPositionEffect();
