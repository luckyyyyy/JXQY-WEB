/**
 * Special Move Kind Effects - 特殊移动类型武功效果
 *
 * 包含以下 MoveKind:
 * - Kind19: 持续留痕武功 (使用 KeepMilliseconds)
 * - Transport (20): 传送武功
 * - ControlCharacter (21): 控制角色武功
 * - Summon (22): 召唤 NPC 武功
 */

import { logger } from "../../core/logger";
import type { ApplyContext, CastContext, EndContext, MagicEffect } from "./types";

/**
 * Kind19 武功效果 - 持续留痕武功
 * case 19 + MagicManager.Update _kind19Magics
 *
 * 角色移动时持续在原位置留下武功痕迹（如火焰脚印、毒雾路径等），
 * 痕迹存在 keepMilliseconds 毫秒后消失。
 * 痕迹可对经过的敌人造成伤害。
 *
 * 实现说明：
 * - onCast: MagicManager.addKind19MagicSprite 将武功加入 kind19Magics 列表
 * - update: MagicManager.updateKind19Magics 检测角色移动，在旧位置生成固定位置武功
 * - apply: 痕迹武功对敌人造成伤害（使用标准 FixedPosition 武功的伤害逻辑）
 * - onEnd: 当 keepMilliseconds 到期时自动移除
 */
export const kind19Effect: MagicEffect = {
  onCast(ctx: CastContext): void {
    const { magic, caster, audioManager } = ctx;
    logger.log(
      `[Kind19] Cast: ${magic.name}, keepMilliseconds=${magic.keepMilliseconds}, caster=${caster?.type || "unknown"}`
    );

    // 播放释放音效
    if (magic.flyingSound && audioManager) {
      audioManager.playSound(magic.flyingSound);
    }

    // Kind19 的实际逻辑在 MagicManager.addKind19MagicSprite 中处理
    // 它会将武功加入 kind19Magics 列表，在 update 循环中追踪角色移动
  },

  apply(ctx: ApplyContext): number {
    // Kind19 产生的痕迹是 FixedPosition 武功，使用标准伤害计算
    // 这里 apply 只在痕迹武功命中敌人时调用
    const { magic, target } = ctx;
    logger.debug(`[Kind19] Apply: ${magic.name}, target=${target?.type || "none"}`);
    // 返回 0 表示使用默认伤害计算
    return 0;
  },

  onEnd(ctx: EndContext): void {
    const { magic, audioManager } = ctx;
    logger.log(`[Kind19] End: ${magic.name}`);

    // 播放消失音效
    if (magic.vanishSound && audioManager) {
      audioManager.playSound(magic.vanishSound);
    }
  },
};

/**
 * Transport 武功效果 - 传送
 * case 20
 */
export const transportEffect: MagicEffect = {
  onCast(ctx: CastContext): void {
    const { magic, caster, destination, audioManager } = ctx;
    logger.log(`[Transport] Cast: ${magic.name}`);

    if (magic.flyingSound && audioManager) {
      audioManager.playSound(magic.flyingSound);
    }

    // 检查是否已在传送中（防止重复传送）
    // 使用 user.IsInTransport 标记
    // 在 Web 版本中，可以通过 Player 状态管理
  },

  apply(ctx: ApplyContext): number {
    // 传送不造成伤害，只是移动角色
    logger.log(`[Transport] Apply: ${ctx.magic.name}`);
    return 0;
  },

  onEnd(ctx: EndContext): void {
    const { magic, caster, audioManager } = ctx;
    logger.log(`[Transport] End: ${magic.name}`);

    // 传送结束后，将角色移动到目标位置
    // 并清除传送状态

    if (magic.vanishSound && audioManager) {
      audioManager.playSound(magic.vanishSound);
    }
  },
};

/**
 * ControlCharacter 武功效果 - 控制角色
 * case 21
 * 玩家可以控制目标角色，前提是目标等级不超过武功 MaxLevel
 */
export const controlCharacterEffect: MagicEffect = {
  onCast(ctx: CastContext): void {
    const { magic, caster, target, audioManager } = ctx;
    logger.log(`[ControlCharacter] Cast: ${magic.name}`);

    if (magic.flyingSound && audioManager) {
      audioManager.playSound(magic.flyingSound);
    }

    // 验证条件：
    // 1. 施法者是玩家
    // 2. 有目标
    // 3. 目标未死亡
    // 4. 目标等级 <= magic.maxLevel
    if (caster.type === "player" && target) {
      // 设置 player.controledCharacter = target
      logger.log(`[ControlCharacter] Player now controls target`);
    }
  },

  apply(ctx: ApplyContext): number {
    // 控制武功不造成伤害
    logger.log(`[ControlCharacter] Apply: ${ctx.magic.name}`);
    return 0;
  },

  onEnd(ctx: EndContext): void {
    const { magic, audioManager } = ctx;
    logger.log(`[ControlCharacter] End: ${magic.name}`);

    if (magic.vanishSound && audioManager) {
      audioManager.playSound(magic.vanishSound);
    }
  },
};

/**
 * Summon 武功效果 - 召唤 NPC
 * case 22
 * 在目标位置召唤一个 NPC
 */
export const summonEffect: MagicEffect = {
  onCast(ctx: CastContext): void {
    const { magic, destination, audioManager } = ctx;
    logger.log(`[Summon] Cast: ${magic.name}, npcFile=${magic.npcFile}`);

    if (magic.flyingSound && audioManager) {
      audioManager.playSound(magic.flyingSound);
    }

    // 召唤逻辑在 MagicManager 中处理
    // 需要访问 NpcManager 来创建和添加 NPC
  },

  apply(ctx: ApplyContext): number {
    // 召唤武功不造成伤害
    logger.log(`[Summon] Apply: ${ctx.magic.name}`);
    return 0;
  },

  onEnd(ctx: EndContext): void {
    const { magic, audioManager } = ctx;
    logger.log(`[Summon] End: ${magic.name}`);

    if (magic.vanishSound && audioManager) {
      audioManager.playSound(magic.vanishSound);
    }
  },
};

// 工厂函数
export function createKind19Effect(): MagicEffect {
  return { ...kind19Effect };
}

export function createTransportEffect(): MagicEffect {
  return { ...transportEffect };
}

export function createControlCharacterEffect(): MagicEffect {
  return { ...controlCharacterEffect };
}

export function createSummonEffect(): MagicEffect {
  return { ...summonEffect };
}
