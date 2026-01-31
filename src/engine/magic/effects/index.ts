/**
 * Magic Effects System - 武功效果系统
 *
 * 导出效果类型、注册表和所有效果实现
 */

// 通用效果函数
export {
  addMagicEffect,
  calculateDamage,
  dealDamage,
  deductCost,
  getEffectAmount,
  healTarget,
  restoreMana,
  restoreThew,
} from "./common";
export { createFixedPositionEffect, fixedPositionEffect } from "./fixedPosition";
export { createFollowCharacterEffect, followCharacterEffect } from "./followCharacter";
export { createFollowEnemyEffect, followEnemyEffect } from "./followEnemy";

// 各种效果实现
export { createNormalAttackEffect, normalAttackEffect } from "./normalAttack";
export { createRegionBasedEffect, RegionType, regionBasedEffect } from "./regionBased";
// 效果注册表
export { getEffect, getRegisteredMoveKinds, registerEffect } from "./registry";
export {
  controlCharacterEffect,
  createControlCharacterEffect,
  createKind19Effect,
  createSummonEffect,
  createTransportEffect,
  kind19Effect,
  summonEffect,
  transportEffect,
} from "./specialMoveKinds";
export { createSuperModeEffect, superModeEffect } from "./superMode";
export { createThrowEffect, throwEffect } from "./throw";
// 类型定义
export type {
  ApplyContext,
  CastContext,
  CharacterRef,
  EndContext,
  MagicEffect,
  SpriteUpdateContext,
} from "./types";
export {
  getAttack,
  getCharacterId,
  getDefend,
  getLife,
  getLifeMax,
  getMana,
  getManaMax,
  getPosition,
  getThew,
  getThewMax,
  setLife,
  setMana,
  setThew,
} from "./types";
