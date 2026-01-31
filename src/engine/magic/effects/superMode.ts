/**
 * 超级模式效果 - MoveKind=15 (SuperMode)
 *
 * 全屏攻击类武功：
 * - onCast: 进入超级模式，播放全屏动画
 * - apply: 对每个视野内的敌人造成伤害
 * - onEnd: 退出超级模式
 */

import { logger } from "@/engine/core/logger";
import { dealDamage } from "./common";
import type { ApplyContext, CastContext, EndContext, MagicEffect } from "./types";

/**
 * SuperMode 状态回调
 */
export interface SuperModeCallbacks {
  onEnterSuperMode: (sprite: unknown) => void;
  onExitSuperMode: () => void;
}

/**
 * 创建超级模式效果
 */
export function createSuperModeEffect(_callbacks?: SuperModeCallbacks): MagicEffect {
  return {
    /**
     * 释放时：进入超级模式
     * 注意：消耗已在 magicHandler.ts 中扣除
     */
    onCast(ctx: CastContext): void {
      // 震屏效果
      if (ctx.magic.vibratingScreen > 0) {
        // TODO: ctx.screenEffects.shake?.(ctx.magic.vibratingScreen);
        logger.log(`[SuperMode] Screen shake: ${ctx.magic.vibratingScreen}`);
      }
    },

    /**
     * 对每个敌人造成伤害
     * MagicManager 会对视野内每个敌人调用此函数
     * @returns 实际造成的伤害值
     */
    apply(ctx: ApplyContext): number {
      return dealDamage(ctx);
    },

    /**
     * 结束时：退出超级模式
     */
    onEnd(_ctx: EndContext): void {
      // 由 MagicManager 处理超级模式退出
    },
  };
}

/**
 * 超级模式效果实例
 */
export const superModeEffect = createSuperModeEffect();
