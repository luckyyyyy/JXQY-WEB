/**
 * Magic Effect System - 武功效果系统类型定义
 *
 * 每种武功由几个生命周期函数组成：
 * - onCast: 释放时触发（扣蓝、触发超级模式等）
 * - apply: 作用时触发（对目标造成伤害/治疗等）
 * - onEnd: 结束时触发（清理状态等）
 */

import type { AudioManager } from "@/engine/audio";
import type { Npc } from "@/engine/character/npc";
import type { NpcManager } from "@/engine/character/npcManager";
import type { Vector2 } from "@/engine/core/types";
import type { ScreenEffects } from "@/engine/effects";
import type { GuiManager } from "@/engine/gui/guiManager";
import type { Player } from "@/engine/player/player";
import type { MagicSprite } from "../magicSprite";
import type { MagicData } from "../types";

/**
 * 角色引用 - 可以是玩家或 NPC
 */
export type CharacterRef =
  | { type: "player"; player: Player }
  | { type: "npc"; npc: Npc; id: string };

/**
 * 释放上下文 - onCast 时可用的信息
 */
export interface CastContext {
  /** 施法者 */
  caster: CharacterRef;
  /** 武功数据 */
  magic: MagicData;
  /** 施法位置 */
  origin: Vector2;
  /** 目标位置 */
  destination: Vector2;
  /** 目标角色（如果有） */
  target?: CharacterRef;

  // 依赖服务
  guiManager: GuiManager;
  screenEffects: ScreenEffects;
  audioManager: AudioManager;
}

/**
 * 作用上下文 - apply 时可用的信息
 */
export interface ApplyContext {
  /** 施法者 */
  caster: CharacterRef;
  /** 目标角色 */
  target: CharacterRef;
  /** 武功数据 */
  magic: MagicData;
  /** 武功精灵 */
  sprite: MagicSprite;

  // 依赖服务
  guiManager: GuiManager;
  screenEffects: ScreenEffects;
  audioManager: AudioManager;
}

/**
 * 结束上下文 - onEnd 时可用的信息
 */
export interface EndContext {
  /** 施法者 */
  caster: CharacterRef;
  /** 武功数据 */
  magic: MagicData;
  /** 武功精灵 */
  sprite: MagicSprite;

  // 依赖服务
  guiManager: GuiManager;
  screenEffects: ScreenEffects;
  audioManager: AudioManager;
}

/**
 * 精灵更新上下文 - 用于精灵运动/碰撞等
 */
export interface SpriteUpdateContext {
  sprite: MagicSprite;
  deltaMs: number;
  npcManager: NpcManager;
  player: Player;
  isMapObstacle?: (tileX: number, tileY: number) => boolean;
}

/**
 * 武功效果定义
 *
 * 每种 MoveKind 的武功实现这个接口
 */
export interface MagicEffect {
  /**
   * 释放时调用（扣蓝、触发特殊状态等）
   */
  onCast?: (ctx: CastContext) => void;

  /**
   * 作用时调用（对目标造成效果）
   * - 普通攻击：命中敌人时
   * - 治疗类：立即或持续作用
   * - 全屏攻击：对每个敌人调用
   * @returns 实际造成的伤害值（用于吸血等效果）
   */
  apply?: (ctx: ApplyContext) => number;

  /**
   * 结束时调用（清理 BUFF、状态等）
   */
  onEnd?: (ctx: EndContext) => void;
}

// ========== 辅助函数 ==========

/**
 * 从 CharacterRef 获取生命值
 */
export function getLife(ref: CharacterRef): number {
  return ref.type === "player" ? ref.player.life : (ref.npc.life ?? 0);
}

/**
 * 设置生命值
 */
export function setLife(ref: CharacterRef, value: number): void {
  if (ref.type === "player") {
    ref.player.life = value;
  } else {
    ref.npc.life = value;
  }
}

/**
 * 获取最大生命值
 */
export function getLifeMax(ref: CharacterRef): number {
  return ref.type === "player" ? ref.player.lifeMax : (ref.npc.lifeMax ?? ref.npc.life ?? 100);
}

/**
 * 获取内力
 */
export function getMana(ref: CharacterRef): number {
  return ref.type === "player" ? ref.player.mana : 0;
}

/**
 * 设置内力
 */
export function setMana(ref: CharacterRef, value: number): void {
  if (ref.type === "player") {
    ref.player.mana = value;
  }
}

/**
 * 获取最大内力
 */
export function getManaMax(ref: CharacterRef): number {
  return ref.type === "player" ? ref.player.manaMax : 0;
}

/**
 * 获取体力
 */
export function getThew(ref: CharacterRef): number {
  return ref.type === "player" ? ref.player.thew : 0;
}

/**
 * 设置体力
 */
export function setThew(ref: CharacterRef, value: number): void {
  if (ref.type === "player") {
    ref.player.thew = value;
  }
}

/**
 * 获取最大体力
 */
export function getThewMax(ref: CharacterRef): number {
  return ref.type === "player" ? ref.player.thewMax : 0;
}

/**
 * 获取攻击力 (使用 realAttack，考虑 BUFF 加成)
 * C# Reference: MagicManager.GetEffectAmount uses belongCharacter.RealAttack
 */
export function getAttack(ref: CharacterRef): number {
  return ref.type === "player" ? (ref.player.realAttack ?? 0) : (ref.npc.realAttack ?? 0);
}

/**
 * 获取防御力
 */
export function getDefend(ref: CharacterRef): number {
  return ref.type === "player" ? (ref.player.defend ?? 0) : (ref.npc.defend ?? 0);
}

/**
 * 获取位置
 */
export function getPosition(ref: CharacterRef): Vector2 {
  return ref.type === "player" ? ref.player.pixelPosition : ref.npc.pixelPosition;
}

/**
 * 获取角色 ID
 */
export function getCharacterId(ref: CharacterRef): string {
  return ref.type === "player" ? "player" : ref.id;
}
