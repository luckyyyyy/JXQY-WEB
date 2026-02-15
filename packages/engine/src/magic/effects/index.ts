/**
 * Magic Effects System - 武功效果系统
 *
 * 导出效果类型、注册表和所有效果实现
 */

// 通用效果函数
export {
  addMagicEffect,
  applyStatusEffect,
  dealDamage,
  deductCost,
  getEffectAmount,
  healTarget,
  restoreMana,
  restoreThew,
} from "./common";
export {
  RegionType,
  regionBasedEffect,
  simpleDamageEffect,
  superModeEffect,
} from "./damage-effects";
export { followCharacterEffect } from "./follow-character";

// 效果注册表
export { getEffect, getRegisteredMoveKinds, registerEffect } from "./registry";
export {
  controlCharacterEffect,
  kind19Effect,
  summonEffect,
  transportEffect,
} from "./special-move-kinds";
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
