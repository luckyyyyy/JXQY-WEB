/**
 * Passive Effects System - 被动效果系统类型定义
 *
 * 处理装备到修炼栏的武功被动效果
 */

import type { Npc } from "@/engine/character/npc";
import type { Vector2 } from "@/engine/core/types";
import type { Player } from "@/engine/player/player";
import type { MagicData, MagicItemInfo } from "../types";

/**
 * 被动效果触发时机
 */
export enum PassiveTrigger {
  /** 普通攻击时 */
  OnAttack = "onAttack",
  /** 攻击命中时 */
  OnHit = "onHit",
  /** 击杀敌人时 */
  OnKill = "onKill",
  /** 受到伤害时 */
  OnDamaged = "onDamaged",
  /** 每帧更新 */
  OnUpdate = "onUpdate",
}

/**
 * 攻击上下文 - onAttack 时使用
 */
export interface AttackContext {
  /** 攻击者 */
  attacker: Player;
  /** 攻击起点 */
  origin: Vector2;
  /** 攻击目标位置 */
  destination: Vector2;
  /** 攻击状态（Attack1, Attack2 等） */
  attackState: number;
}

/**
 * 命中上下文 - onHit 时使用
 */
export interface HitContext {
  /** 攻击者 */
  attacker: Player;
  /** 被击中的目标 */
  target: Npc;
  /** 造成的伤害 */
  damage: number;
  /** 攻击位置 */
  position: Vector2;
}

/**
 * 击杀上下文 - onKill 时使用
 */
export interface KillContext {
  /** 攻击者 */
  attacker: Player;
  /** 被击杀的目标 */
  target: Npc;
  /** 获得的经验值 */
  expGained: number;
}

/**
 * 受伤上下文 - onDamaged 时使用
 */
export interface DamagedContext {
  /** 受伤者 */
  victim: Player;
  /** 攻击者（可能为空） */
  attacker?: Npc;
  /** 受到的伤害 */
  damage: number;
}

/**
 * 更新上下文 - onUpdate 时使用
 */
export interface UpdateContext {
  /** 玩家 */
  player: Player;
  /** 帧间隔（毫秒） */
  deltaMs: number;
}

/**
 * 被动效果定义
 */
export interface PassiveEffect {
  /** 效果名称 */
  name: string;

  /** 触发时机 */
  trigger: PassiveTrigger;

  /**
   * 攻击时触发
   * 返回要释放的武功（如果有）
   */
  onAttack?: (ctx: AttackContext, xiuLianMagic: MagicItemInfo) => MagicData | null;

  /**
   * 命中时触发
   */
  onHit?: (ctx: HitContext, xiuLianMagic: MagicItemInfo) => void;

  /**
   * 击杀时触发
   */
  onKill?: (ctx: KillContext, xiuLianMagic: MagicItemInfo) => void;

  /**
   * 受伤时触发
   */
  onDamaged?: (ctx: DamagedContext, xiuLianMagic: MagicItemInfo) => void;

  /**
   * 每帧更新
   */
  onUpdate?: (ctx: UpdateContext, xiuLianMagic: MagicItemInfo) => void;
}

/**
 * 被动效果管理器配置
 */
export interface PassiveManagerConfig {
  /** 修炼栏索引（默认 49） */
  xiuLianIndex: number;
}
