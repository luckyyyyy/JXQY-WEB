/**
 * Passive Effects System - 被动效果系统
 *
 * 处理装备到修炼栏的武功被动效果
 */

// 管理器
export { PassiveManager } from "./passiveManager";
// 类型定义
export type {
  AttackContext,
  DamagedContext,
  HitContext,
  KillContext,
  PassiveEffect,
  PassiveManagerConfig,
  UpdateContext,
} from "./types";
export { PassiveTrigger } from "./types";

// 修炼武功效果
export {
  clearAttackMagicCache,
  preloadXiuLianAttackMagic,
  xiuLianAttackEffect,
  xiuLianExpEffect,
} from "./xiuLianEffect";
