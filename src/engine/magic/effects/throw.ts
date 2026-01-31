/**
 * 投掷效果 - MoveKind=17 (Throw)
 *
 * 投掷类武功（暗器等）
 */

import { dealDamage } from "./common";
import type { ApplyContext, MagicEffect } from "./types";

/**
 * 创建投掷效果
 */
export function createThrowEffect(): MagicEffect {
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
 * 投掷效果实例
 */
export const throwEffect = createThrowEffect();
