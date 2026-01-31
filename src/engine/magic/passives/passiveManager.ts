/**
 * PassiveManager - 被动效果管理器
 *
 * 管理修炼武功的被动效果触发
 */

import { logger } from "@/engine/core/logger";
import type { MagicData, MagicItemInfo } from "../types";
import type {
  AttackContext,
  DamagedContext,
  HitContext,
  KillContext,
  PassiveEffect,
  PassiveManagerConfig,
  UpdateContext,
} from "./types";
import { PassiveTrigger } from "./types";
import { preloadXiuLianAttackMagic, xiuLianAttackEffect, xiuLianExpEffect } from "./xiuLianEffect";

/**
 * 默认配置
 */
const DEFAULT_CONFIG: PassiveManagerConfig = {
  xiuLianIndex: 49,
};

/**
 * 被动效果管理器
 */
export class PassiveManager {
  private effects: PassiveEffect[] = [];
  private config: PassiveManagerConfig;

  // 当前修炼武功
  private _xiuLianMagic: MagicItemInfo | null = null;

  constructor(config: Partial<PassiveManagerConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };

    // 注册默认被动效果
    this.registerEffect(xiuLianAttackEffect);
    this.registerEffect(xiuLianExpEffect);
  }

  /**
   * 注册被动效果
   */
  registerEffect(effect: PassiveEffect): void {
    this.effects.push(effect);
  }

  /**
   * 移除被动效果
   */
  removeEffect(name: string): void {
    this.effects = this.effects.filter((e) => e.name !== name);
  }

  /**
   * 获取当前修炼武功
   */
  get xiuLianMagic(): MagicItemInfo | null {
    return this._xiuLianMagic;
  }

  /**
   * 设置修炼武功
   */
  async setXiuLianMagic(magic: MagicItemInfo | null): Promise<void> {
    this._xiuLianMagic = magic;

    // 预加载 AttackFile
    if (magic) {
      await preloadXiuLianAttackMagic(magic);
    }

    logger.log(`[PassiveManager] XiuLian magic set to: ${magic?.magic?.name ?? "none"}`);
  }

  /**
   * 触发攻击效果
   * @returns 要释放的武功（如果有）
   */
  triggerOnAttack(ctx: AttackContext): MagicData | null {
    if (!this._xiuLianMagic) return null;

    for (const effect of this.effects) {
      if (effect.trigger === PassiveTrigger.OnAttack && effect.onAttack) {
        const magic = effect.onAttack(ctx, this._xiuLianMagic);
        if (magic) {
          return magic;
        }
      }
    }
    return null;
  }

  /**
   * 触发命中效果
   */
  triggerOnHit(ctx: HitContext): void {
    if (!this._xiuLianMagic) return;

    for (const effect of this.effects) {
      if (effect.trigger === PassiveTrigger.OnHit && effect.onHit) {
        effect.onHit(ctx, this._xiuLianMagic);
      }
    }
  }

  /**
   * 触发击杀效果
   */
  triggerOnKill(ctx: KillContext): void {
    if (!this._xiuLianMagic) return;

    for (const effect of this.effects) {
      if (effect.trigger === PassiveTrigger.OnKill && effect.onKill) {
        effect.onKill(ctx, this._xiuLianMagic);
      }
    }
  }

  /**
   * 触发受伤效果
   */
  triggerOnDamaged(ctx: DamagedContext): void {
    if (!this._xiuLianMagic) return;

    for (const effect of this.effects) {
      if (effect.trigger === PassiveTrigger.OnDamaged && effect.onDamaged) {
        effect.onDamaged(ctx, this._xiuLianMagic);
      }
    }
  }

  /**
   * 更新（每帧调用）
   */
  update(ctx: UpdateContext): void {
    if (!this._xiuLianMagic) return;

    for (const effect of this.effects) {
      if (effect.trigger === PassiveTrigger.OnUpdate && effect.onUpdate) {
        effect.onUpdate(ctx, this._xiuLianMagic);
      }
    }
  }

  /**
   * 清除状态
   */
  clear(): void {
    this._xiuLianMagic = null;
  }
}
