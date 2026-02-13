/**
 * Simple Damage Effect - 通用伤害效果
 *
 * 适用于所有"命中即造成伤害"的武功，包括：
 * - MoveKind=1 固定位置 (FixedPosition)
 * - MoveKind=2~8 飞行攻击 (SingleMove, LineMove, CircleMove, HeartMove, SpiralMove, SectorMove)
 * - MoveKind=16 追踪敌人 (FollowEnemy)
 * - MoveKind=17 投掷 (Throw)
 * - MoveKind=22 固定位置变体 (FixedWall)
 * - MoveKind=18 随机扇形 (RandomSector)
 * - MoveKind=10 墙体 (WallMove)
 * - MoveKind=14 V形 (VMove)
 *
 * 这些武功的 apply 逻辑完全相同：调用 dealDamage 计算伤害。
 * 消耗（蓝量等）已在 magicHandler.ts 中统一扣除，无需 onCast。
 */

import { dealDamage } from "./common";
import type { ApplyContext, MagicEffect } from "./types";

/**
 * 通用伤害效果实例（单例，所有简单伤害武功共用）
 */
export const simpleDamageEffect: MagicEffect = {
  apply(ctx: ApplyContext): number {
    return dealDamage(ctx);
  },
};
