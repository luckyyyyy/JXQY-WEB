/**
 * 跟随角色效果 - MoveKind=13 (FollowCharacter)
 *
 * 这类武功作用于自己，根据 SpecialKind 有不同效果：
 * - 1: 加生命 (清心咒)
 * - 2: 加体力
 * - 3,6: 持续 BUFF (金钟罩等)
 * - 4: 隐身（攻击时消失）
 * - 5: 隐身（攻击时显现）
 * - 7: 变身
 * - 8: 解除异常状态
 * - 9: 替换飞行INI (FlyIniChangeBy)
 *
 */

import { logger } from "../../core/logger";
import { MagicSpecialKind } from "../types";
import { healTarget, restoreThew } from "./common";
import type { ApplyContext, CharacterRef, MagicEffect } from "./types";
import { getAttack } from "./types";

/**
 * 计算自身增益效果值
 */
function calculateEffectAmount(
  target: CharacterRef,
  magic: { effect: number; effectExt: number }
): number {
  let amount = magic.effect;
  if (amount === 0) {
    amount = getAttack(target);
  }
  return amount + magic.effectExt;
}

function canApplyToFriendlyTarget(caster: CharacterRef, target: CharacterRef): boolean {
  return caster.type === "player" && target.type === "npc" && target.npc.isFighterFriend;
}

function getEffectTarget(caster: CharacterRef, target: CharacterRef): CharacterRef {
  return canApplyToFriendlyTarget(caster, target) ? target : caster;
}

export const followCharacterEffect: MagicEffect = {
  // 注意：消耗已在 magicCaster.ts 中扣除，不需要 onCast

  /**
   * 作用时：根据 SpecialKind 产生不同效果
   * 注意：target 就是 caster 自己
   * @returns 实际造成的伤害值（跟随角色类武功不造成伤害，返回0）
   */
  apply(ctx: ApplyContext): number {
    const { caster, target, magic, sprite, guiManager } = ctx;
    const effectTarget = getEffectTarget(caster, target);

    const effectAmount = calculateEffectAmount(effectTarget, magic);

    switch (magic.specialKind) {
      // 加生命（清心咒等）
      case MagicSpecialKind.AddLifeOrFrozen:
        healTarget(effectTarget, effectAmount, guiManager);
        break;

      // 加体力
      case MagicSpecialKind.AddThewOrPoison:
        restoreThew(effectTarget, effectAmount, guiManager);
        break;

      // 持续 BUFF（金钟罩等）
      case MagicSpecialKind.BuffOrPetrify:
      case MagicSpecialKind.Buff:
        {
          const character = effectTarget.type === "player" ? effectTarget.player : effectTarget.npc;
          const existingSprite = character
            .getMagicSpritesInEffect()
            .find((s) => s.magic.name === magic.name && !s.isDestroyed);

          if (existingSprite) {
            existingSprite.resetPlay();
            sprite.isDestroyed = true;
          } else {
            character.addMagicSpriteInEffect(sprite);
          }
        }
        break;

      // 隐身（攻击时消失）
      // user.InvisibleByMagicTime = effectAmount; user.IsVisibleWhenAttack = false;
      case MagicSpecialKind.InvisibleHide:
        if (effectTarget.type === "player") {
          effectTarget.player.statusEffects.invisibleByMagicTime = effectAmount;
          effectTarget.player.statusEffects.isVisibleWhenAttack = false;
          logger.log(
            `[FollowCharacter] InvisibleHide: duration=${effectAmount}ms, visibleWhenAttack=false`
          );
        } else {
          effectTarget.npc.statusEffects.invisibleByMagicTime = effectAmount;
          effectTarget.npc.statusEffects.isVisibleWhenAttack = false;
        }
        break;

      // 隐身（攻击时显现）
      // user.InvisibleByMagicTime = effectAmount; user.IsVisibleWhenAttack = true;
      case MagicSpecialKind.InvisibleShow:
        if (effectTarget.type === "player") {
          effectTarget.player.statusEffects.invisibleByMagicTime = effectAmount;
          effectTarget.player.statusEffects.isVisibleWhenAttack = true;
          logger.log(
            `[FollowCharacter] InvisibleShow: duration=${effectAmount}ms, visibleWhenAttack=true`
          );
        } else {
          effectTarget.npc.statusEffects.invisibleByMagicTime = effectAmount;
          effectTarget.npc.statusEffects.isVisibleWhenAttack = true;
        }
        break;

      // 变身
      // user.ChangeCharacterBy(sprite);
      case MagicSpecialKind.ChangeCharacter:
        if (effectTarget.type === "player") {
          effectTarget.player.changeCharacterBy(sprite);
          logger.log(`[FollowCharacter] ChangeCharacter: effect=${magic.effect}`);
        } else {
          effectTarget.npc.changeCharacterBy(sprite);
        }
        break;

      // 解除异常状态
      // user.RemoveAbnormalState();
      case MagicSpecialKind.RemoveAbnormal:
        if (effectTarget.type === "player") {
          effectTarget.player.removeAbnormalState();
          logger.log(`[FollowCharacter] RemoveAbnormalState`);
        } else {
          effectTarget.npc.removeAbnormalState();
        }
        break;

      // 改变飞行INI
      // user.FlyIniChangeBy(sprite);
      case MagicSpecialKind.ChangeFlyIni:
        if (effectTarget.type === "player") {
          effectTarget.player.flyIniChangeBy(sprite);
          logger.log(`[FollowCharacter] FlyIniChangeBy`);
        } else {
          effectTarget.npc.flyIniChangeBy(sprite);
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
    // InvisibleByMagicTime 会在 Character.Update 中自动减少，到 0 时自动恢复可见
    // 这里不需要额外处理，因为 invisibleByMagicTime 会自然到期
    if (
      magic.specialKind === MagicSpecialKind.InvisibleHide ||
      magic.specialKind === MagicSpecialKind.InvisibleShow
    ) {
      // 隐身效果由 StatusEffectsManager.update 自动处理
      // invisibleByMagicTime 到 0 时自动恢复可见
      logger.log(`[FollowCharacter] Invisible effect ended naturally`);
    }

    // 移除变身效果
    // _changeCharacterByMagicSpriteTime 会在 Character.Update 中自动减少
    if (magic.specialKind === MagicSpecialKind.ChangeCharacter) {
      // 变身效果由 StatusEffectsManager.update 自动处理
      // changeCharacterByMagicSpriteTime 到 0 时自动恢复
      logger.log(`[FollowCharacter] ChangeCharacter effect ended naturally`);
    }
  },
};
