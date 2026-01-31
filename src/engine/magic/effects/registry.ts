/**
 * 效果注册表 - 根据 MoveKind 映射到对应的效果
 */

import { MagicMoveKind } from "../types";
import { fixedPositionEffect } from "./fixedPosition";
import { followCharacterEffect } from "./followCharacter";
import { followEnemyEffect } from "./followEnemy";
import { normalAttackEffect } from "./normalAttack";
import { regionBasedEffect } from "./regionBased";
import {
  controlCharacterEffect,
  kind19Effect,
  summonEffect,
  transportEffect,
} from "./specialMoveKinds";
import { superModeEffect } from "./superMode";
import { throwEffect } from "./throw";
import type { MagicEffect } from "./types";

/**
 * MoveKind -> MagicEffect 映射表
 */
const effectRegistry: Partial<Record<MagicMoveKind, MagicEffect>> = {
  // 固定位置类
  [MagicMoveKind.FixedPosition]: fixedPositionEffect,
  [MagicMoveKind.FixedWall]: fixedPositionEffect,

  // 普通飞行攻击类
  [MagicMoveKind.SingleMove]: normalAttackEffect,
  [MagicMoveKind.LineMove]: normalAttackEffect,
  [MagicMoveKind.CircleMove]: normalAttackEffect,
  [MagicMoveKind.HeartMove]: normalAttackEffect,
  [MagicMoveKind.SpiralMove]: normalAttackEffect,
  [MagicMoveKind.SectorMove]: normalAttackEffect,
  [MagicMoveKind.RandomSector]: normalAttackEffect,
  [MagicMoveKind.WallMove]: normalAttackEffect,
  [MagicMoveKind.VMove]: normalAttackEffect,

  // 区域类
  [MagicMoveKind.RegionBased]: regionBasedEffect,

  // 自身增益类
  [MagicMoveKind.FollowCharacter]: followCharacterEffect,
  [MagicMoveKind.TimeStop]: followCharacterEffect,

  // 全屏攻击类
  [MagicMoveKind.SuperMode]: superModeEffect,

  // 追踪类
  [MagicMoveKind.FollowEnemy]: followEnemyEffect,

  // 投掷类
  [MagicMoveKind.Throw]: throwEffect,

  // 特殊类型
  [MagicMoveKind.Kind19]: kind19Effect,
  [MagicMoveKind.Transport]: transportEffect,
  [MagicMoveKind.PlayerControl]: controlCharacterEffect,
  [MagicMoveKind.Summon]: summonEffect,
};

/**
 * 获取指定 MoveKind 的效果
 */
export function getEffect(moveKind: MagicMoveKind): MagicEffect | undefined {
  return effectRegistry[moveKind];
}

/**
 * 注册自定义效果（用于扩展）
 */
export function registerEffect(moveKind: MagicMoveKind, effect: MagicEffect): void {
  effectRegistry[moveKind] = effect;
}

/**
 * 获取所有已注册的效果类型
 */
export function getRegisteredMoveKinds(): MagicMoveKind[] {
  return Object.keys(effectRegistry).map(Number) as MagicMoveKind[];
}
