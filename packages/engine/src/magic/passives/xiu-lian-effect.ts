/**
 * 修炼武功效果 - XiuLian Effect
 *
 * 实现装备到修炼栏的武功的被动效果：
 * - 普通攻击时释放 AttackFile 武功
 * - 击杀敌人时获得修炼经验
 *
 * 注意：AttackFile 在 addMagic 时预加载，战斗中同步获取
 */

import { logger } from "../../core/logger";
import { CharacterState } from "../../core/types";
import { getMagic, preloadMagicAsf } from "../magic-loader";
import type { MagicData, MagicItemInfo } from "../types";
import type { AttackContext, KillContext, PassiveEffect } from "./types";
import { PassiveTrigger } from "./types";

/**
 * 清除 AttackFile 武功缓存（委托给 magicLoader）
 */
export function clearAttackMagicCache(): void {
  // 缓存现在由 resourceLoader 管理，无需本地清理
}

/**
 * 修炼武功攻击效果
 *
 * 当普通攻击（Attack2 状态）时，释放修炼武功的 AttackFile
 */
export const xiuLianAttackEffect: PassiveEffect = {
  name: "xiuLianAttack",
  trigger: PassiveTrigger.OnAttack,

  /**
   * 同步获取 AttackFile 武功（已在 addMagic 时预加载）
   */
  onAttack(ctx: AttackContext, xiuLianMagic: MagicItemInfo): MagicData | null {
    const magic = xiuLianMagic.magic;
    if (!magic) return null;

    // 只在 Attack2 状态触发（普通攻击的第二段）
    // 参考: if (State == (int)CharacterState.Attack2 && ...)
    if (ctx.attackState !== CharacterState.Attack2) {
      return null;
    }

    // 检查是否有 AttackFile
    if (!magic.attackFile) {
      return null;
    }

    // 同步获取缓存（已在 addMagic 时预加载）
    const attackMagic = getMagic(magic.attackFile);
    if (!attackMagic) {
      logger.warn(`[XiuLian] AttackFile not preloaded: ${magic.attackFile}`);
      return null;
    }

    return attackMagic;
  },
};

/**
 * 预加载修炼武功的 AttackFile
 * 在装备修炼武功时调用（仅在初始化时使用，战斗中不用）
 */
export async function preloadXiuLianAttackMagic(xiuLianMagic: MagicItemInfo): Promise<void> {
  const magic = xiuLianMagic.magic;
  if (!magic?.attackFile) return;

  const attackMagic = getMagic(magic.attackFile);
  if (attackMagic) {
    await preloadMagicAsf(attackMagic);
  }
}

/**
 * 修炼经验获得效果
 *
 * 击杀敌人时，修炼武功获得经验
 */
export const xiuLianExpEffect: PassiveEffect = {
  name: "xiuLianExp",
  trigger: PassiveTrigger.OnKill,

  onKill(ctx: KillContext, xiuLianMagic: MagicItemInfo): void {
    // 参考: AddMagicExp(XiuLianMagic, (int)(amount * Utils.XiuLianMagicExpFraction))
    const expFraction = 0.3; // 修炼武功获得 30% 经验
    const xiuLianExp = Math.floor(ctx.expGained * expFraction);

    if (xiuLianExp > 0 && xiuLianMagic) {
      xiuLianMagic.exp += xiuLianExp;
      logger.log(
        `[XiuLian] ${xiuLianMagic.magic?.name} gained ${xiuLianExp} exp (total: ${xiuLianMagic.exp})`
      );
    }
  },
};
