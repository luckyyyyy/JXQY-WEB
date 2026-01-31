/**
 * 跟随角色效果 - MoveKind=13 (FollowCharacter)
 *
 * 这类武功作用于自己，根据 SpecialKind 有不同效果：
 * - 1: 加生命 (清心咒)
 * - 2: 加体力
 * - 3,6: 持续 BUFF (金钟罩等)
 * - 4,5: 隐身
 * - 7: 变身
 * - 8: 解除异常状态
 */

import { logger } from "@/engine/core/logger";
import { MagicSpecialKind } from "../types";
import { healTarget, restoreThew } from "./common";
import type { ApplyContext, CharacterRef, MagicEffect } from "./types";
import { getAttack } from "./types";

/**
 * 计算自身增益效果值
 */
function calculateEffectAmount(
  caster: CharacterRef,
  magic: { effect: number; effectExt: number }
): number {
  let amount = magic.effect;
  if (amount === 0) {
    amount = getAttack(caster);
  }
  return amount + magic.effectExt;
}

/**
 * 创建跟随角色效果
 */
export function createFollowCharacterEffect(): MagicEffect {
  return {
    // 注意：消耗已在 magicHandler.ts 中扣除，不需要 onCast

    /**
     * 作用时：根据 SpecialKind 产生不同效果
     * 注意：target 就是 caster 自己
     * @returns 实际造成的伤害值（跟随角色类武功不造成伤害，返回0）
     */
    apply(ctx: ApplyContext): number {
      const { caster, magic, sprite, guiManager } = ctx;

      const effectAmount = calculateEffectAmount(caster, magic);

      switch (magic.specialKind) {
        // 加生命（清心咒等）
        case MagicSpecialKind.AddLifeOrFrozen:
          healTarget(caster, effectAmount, guiManager);
          break;

        // 加体力
        case MagicSpecialKind.AddThewOrPoison:
          restoreThew(caster, effectAmount, guiManager);
          break;

        // 持续 BUFF（金钟罩等）
        case MagicSpecialKind.BuffOrPetrify:
        case MagicSpecialKind.Buff:
          // BUFF 精灵由 MagicManager 管理，这里添加到角色
          if (caster.type === "player") {
            caster.player.addMagicSpriteInEffect(sprite);
          }
          break;

        // 隐身（攻击时消失）
        case MagicSpecialKind.InvisibleHide:
          if (caster.type === "player") {
            // TODO: caster.player.setInvisible(true, true);
            logger.log(`[FollowCharacter] InvisibleHide not implemented`);
          }
          break;

        // 隐身（攻击时可见）
        case MagicSpecialKind.InvisibleShow:
          if (caster.type === "player") {
            // TODO: caster.player.setInvisible(true, false);
            logger.log(`[FollowCharacter] InvisibleShow not implemented`);
          }
          break;

        // 变身
        case MagicSpecialKind.ChangeCharacter:
          // TODO: 实现变身逻辑
          logger.log(`[FollowCharacter] Transform not implemented`);
          break;

        // 解除异常状态
        case MagicSpecialKind.RemoveAbnormal:
          if (caster.type === "player") {
            // TODO: caster.player.clearAbnormalStates();
            logger.log(`[FollowCharacter] RemoveAbnormal not implemented`);
          }
          break;

        default:
          break;
      }

      // 跟随角色类武功不造成伤害
      return 0;
    },

    /**
     * 结束时：移除 BUFF 效果
     */
    onEnd(ctx): void {
      const { caster, magic, sprite } = ctx;

      // 移除 BUFF
      if (
        magic.specialKind === MagicSpecialKind.BuffOrPetrify ||
        magic.specialKind === MagicSpecialKind.Buff
      ) {
        if (caster.type === "player") {
          caster.player.removeMagicSpriteInEffect(sprite);
        }
      }

      // 移除隐身
      if (
        magic.specialKind === MagicSpecialKind.InvisibleHide ||
        magic.specialKind === MagicSpecialKind.InvisibleShow
      ) {
        if (caster.type === "player") {
          // TODO: caster.player.setInvisible(false, false);
          logger.log(`[FollowCharacter] Remove invisible not implemented`);
        }
      }
    },
  };
}

/**
 * 跟随角色效果实例
 */
export const followCharacterEffect = createFollowCharacterEffect();
