/**
 * 通用效果 - 基础伤害/治疗函数
 *
 * 这些是被各种 MoveKind 效果复用的基础函数
 */

import type { Character } from "../../character/character";
import { getEffectAmount } from "../effect-calc";
export { type IEffectCharacter, getEffectAmount, addMagicEffect } from "../effect-calc";
import type { ApplyContext, CastContext, CharacterRef } from "./types";
import {
  getLife,
  getLifeMax,
  getMana,
  getManaMax,
  getThew,
  getThewMax,
  setLife,
  setMana,
  setThew,
} from "./types";


/**
 * 从 CharacterRef 获取 Character 实例
 */
function getCharacterInstance(ref: CharacterRef): Character {
  if (ref.type === "player") {
    return ref.player;
  }
  return ref.npc;
}

/**
 * 扣除施法消耗（内力、体力、生命）
 */
export function deductCost(ctx: CastContext): void {
  const { caster, magic, guiManager } = ctx;

  // 扣内力
  if (magic.manaCost > 0) {
    const currentMana = getMana(caster);
    const newMana = Math.max(0, currentMana - magic.manaCost);
    setMana(caster, newMana);
  }

  // 扣体力
  if (magic.thewCost > 0) {
    const currentThew = getThew(caster);
    const newThew = Math.max(0, currentThew - magic.thewCost);
    setThew(caster, newThew);
  }

  // 扣生命
  if (magic.lifeCost > 0) {
    const currentLife = getLife(caster);
    const newLife = Math.max(1, currentLife - magic.lifeCost);
    setLife(caster, newLife);
  }
}



/**
 * 对目标造成伤害
 *
 * + MagicManager.GetEffectAmount
 * 使用 Character.takeDamageFromMagic 来处理：
 * - 命中率计算 (基于闪避)
 * - 多类型伤害 (damage, damage2, damage3, damageMana)
 * - 最小伤害 (MinimalDamage = 5)
 */
export function dealDamage(ctx: ApplyContext): number {
  const { caster, target, magic, sprite } = ctx;

  // 获取 Character 实例
  const targetChar = getCharacterInstance(target);
  const casterChar = getCharacterInstance(caster);

  // amount = _canLeap ? _currentEffect : MagicManager.GetEffectAmount(BelongMagic, BelongCharacter);
  // 跳跃武功使用 sprite 上存储的当前效果值（会随跳跃次数递减）
  // 普通武功使用 getEffectAmount 计算
  let damage: number;
  let damage2: number;
  let damage3: number;
  let damageMana: number;

  if (sprite && magic.leapTimes > 0) {
    // 跳跃武功：使用 sprite 的 currentEffect（可能已递减）
    damage = sprite.currentEffect;
    damage2 = sprite.currentEffect2;
    damage3 = sprite.currentEffect3;
    damageMana = sprite.currentEffectMana;
  } else {
    // 普通武功：使用 getEffectAmount（包含 AddMagicEffect 加成）
    damage = getEffectAmount(magic, casterChar, "effect");
    damage2 = getEffectAmount(magic, casterChar, "effect2");
    damage3 = getEffectAmount(magic, casterChar, "effect3");
    damageMana = magic.effectMana || 0;
  }

  // 使用 Character.takeDamageFromMagic 来处理完整的伤害计算
  // 包括命中率、防御减免、最小伤害等
  const actualDamage = targetChar.takeDamageFromMagic(
    damage,
    damage2,
    damage3,
    damageMana,
    casterChar
  );

  // 返回实际造成的伤害值
  return actualDamage;
}

/**
 * 治疗目标
 */
export function healTarget(
  target: CharacterRef,
  amount: number,
  _guiManager?: { showMessage: (msg: string) => void }
): number {
  const currentLife = getLife(target);
  const maxLife = getLifeMax(target);
  const newLife = Math.min(maxLife, currentLife + amount);
  const actualHealed = newLife - currentLife;

  setLife(target, newLife);

  return actualHealed;
}

/**
 * 恢复内力
 */
export function restoreMana(
  target: CharacterRef,
  amount: number,
  _guiManager?: { showMessage: (msg: string) => void }
): number {
  const currentMana = getMana(target);
  const maxMana = getManaMax(target);
  const newMana = Math.min(maxMana, currentMana + amount);
  const actualRestored = newMana - currentMana;

  setMana(target, newMana);

  return actualRestored;
}

/**
 * 恢复体力
 */
export function restoreThew(
  target: CharacterRef,
  amount: number,
  _guiManager?: { showMessage: (msg: string) => void }
): number {
  const currentThew = getThew(target);
  const maxThew = getThewMax(target);
  const newThew = Math.min(maxThew, currentThew + amount);
  const actualRestored = newThew - currentThew;

  setThew(target, newThew);

  return actualRestored;
}
