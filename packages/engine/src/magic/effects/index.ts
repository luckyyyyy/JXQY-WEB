/**
 * Magic Effects System - 武功效果系统
 *
 * 导出效果类型、注册表和所有效果实现
 */

// 通用效果函数
export {
  addMagicEffect,
  dealDamage,
  deductCost,
  getEffectAmount,
  healTarget,
  restoreMana,
  restoreThew,
} from "./common";
export { createFollowCharacterEffect, followCharacterEffect } from "./follow-character";

// 各种效果实现
export { createRegionBasedEffect, RegionType, regionBasedEffect } from "./region-based";
// 效果注册表
export { getEffect, getRegisteredMoveKinds, registerEffect } from "./registry";
// 通用伤害效果（替代原 fixedPosition, normalAttack, followEnemy, throw 四个相同实现）
export { simpleDamageEffect } from "./simple-damage";
export {
  controlCharacterEffect,
  createControlCharacterEffect,
  createKind19Effect,
  createSummonEffect,
  createTransportEffect,
  kind19Effect,
  summonEffect,
  transportEffect,
} from "./special-move-kinds";
export { createSuperModeEffect, superModeEffect } from "./super-mode";
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
