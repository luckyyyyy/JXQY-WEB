/**
 * 通用效果 - 基础伤害/治疗函数
 *
 * 这些是被各种 MoveKind 效果复用的基础函数
 */

import type { ApplyContext, CastContext, CharacterRef } from "./types";
import type { Character } from "../../character/character";
import {
  getLife,
  setLife,
  getLifeMax,
  getMana,
  setMana,
  getManaMax,
  getThew,
  setThew,
  getThewMax,
  getAttack,
  getDefend,
  getCharacterId,
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
 * 计算伤害值 (旧版 - 不包含命中率)
 * @deprecated Use dealDamage which handles hit rate calculation via takeDamageFromMagic
 */
export function calculateDamage(
  caster: CharacterRef,
  target: CharacterRef,
  magic: { effect: number; effectExt: number }
): number {
  const attack = getAttack(caster);
  const defend = getDefend(target);

  // 基础伤害 = 武功效果 + 攻击力 - 防御力
  let damage = magic.effect + magic.effectExt + attack - defend;

  // 随机浮动 ±10%
  const variance = 0.1;
  const randomFactor = 1 + (Math.random() * 2 - 1) * variance;
  damage = Math.floor(damage * randomFactor);

  return Math.max(1, damage); // 最小 1 点伤害
}

/**
 * 对目标造成伤害
 *
 * C# Reference: MagicSprite.CharacterHited
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

  // 计算各类型伤害
  // C#: damage = BelongMagic.Effect + BelongCharacter.Attack
  const attack = getAttack(caster);
  const damage = magic.effect + (magic.effectExt || 0) + attack;
  const damage2 = magic.effect2 || 0;
  const damage3 = magic.effect3 || 0;
  const damageMana = magic.effectMana || 0;

  // 使用 Character.takeDamageFromMagic 来处理完整的伤害计算
  // 包括命中率、防御减免、最小伤害等
  targetChar.takeDamageFromMagic(damage, damage2, damage3, damageMana, casterChar);

  // 返回基础伤害值（实际伤害在 takeDamageFromMagic 中计算）
  return damage;
}

/**
 * 治疗目标
 */
export function healTarget(
  target: CharacterRef,
  amount: number,
  guiManager?: { showMessage: (msg: string) => void }
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
  guiManager?: { showMessage: (msg: string) => void }
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
  guiManager?: { showMessage: (msg: string) => void }
): number {
  const currentThew = getThew(target);
  const maxThew = getThewMax(target);
  const newThew = Math.min(maxThew, currentThew + amount);
  const actualRestored = newThew - currentThew;

  setThew(target, newThew);

  return actualRestored;
}
