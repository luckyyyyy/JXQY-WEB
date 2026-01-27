/**
 * 投掷效果 - MoveKind=17 (Throw)
 *
 * 投掷类武功（暗器等）
 */

import type { MagicEffect, ApplyContext } from "./types";
import { dealDamage } from "./common";

/**
 * 创建投掷效果
 */
export function createThrowEffect(): MagicEffect {
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
 * 投掷效果实例
 */
export const throwEffect = createThrowEffect();
