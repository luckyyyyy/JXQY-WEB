/**
 * Effect Calculation - 效果计算纯函数
 *
 * 从 magic/effects/common.ts 提取的纯计算函数
 * 放在 core/ 中以消除 character ↔ magic 循环依赖
 */

/**
 * 用于 getEffectAmount 的最小角色接口
 * 允许继承链中间层使用
 */
export interface EffectCharacter {
  isPlayer: boolean;
  realAttack: number;
  attack2: number;
  attack3: number;
  getAddMagicEffectPercent?(): number;
  getAddMagicEffectAmount?(): number;
}

/**
 * MagicManager.GetEffectAmount
 * 计算武功效果值（含装备加成）
 *
 * @param magic 武功数据
 * @param belongCharacter 归属角色（用于计算加成）
 * @param effectType 效果类型: 'effect' | 'effect2' | 'effect3'
 */
export function getEffectAmount(
  magic: {
    effect: number;
    effect2: number;
    effect3: number;
    effectExt: number;
    name?: string;
    type?: string;
  },
  belongCharacter: EffectCharacter,
  effectType: "effect" | "effect2" | "effect3" = "effect"
): number {
  const isPlayer = belongCharacter.isPlayer;

  let baseEffect: number;
  if (effectType === "effect") {
    // (magic.Effect == 0 || !belongCharacter.IsPlayer) ? RealAttack : magic.Effect
    baseEffect = magic.effect === 0 || !isPlayer ? belongCharacter.realAttack : magic.effect;
    // effectExt 只加在 effect 上
    baseEffect += magic.effectExt || 0;
  } else if (effectType === "effect2") {
    baseEffect = magic.effect2 === 0 || !isPlayer ? belongCharacter.attack2 : magic.effect2;
  } else {
    baseEffect = magic.effect3 === 0 || !isPlayer ? belongCharacter.attack3 : magic.effect3;
  }

  // AddMagicEffect - 应用装备等加成
  return addMagicEffect(belongCharacter, baseEffect);
}

/**
 * MagicManager.AddMagicEffect
 * 应用武功效果加成（百分比 + 固定值）
 */
export function addMagicEffect(belongCharacter: EffectCharacter, effect: number): number {
  // 只有玩家有装备加成
  if (!belongCharacter.isPlayer) {
    return effect;
  }

  // 获取角色的加成属性
  const percent = belongCharacter.getAddMagicEffectPercent?.() ?? 0;
  const amount = belongCharacter.getAddMagicEffectAmount?.() ?? 0;

  // 还有按武功名称/类型的加成 (GetAddMagicEffectInfoWithName/Type)
  // 低优先级功能，暂未实现

  if (percent > 0) {
    effect += Math.floor((effect * percent) / 100);
  }
  effect += amount;

  return effect;
}

/**
 * 计算击杀经验
 */
export function getCharacterDeathExp(
  killer: { level: number },
  dead: { level: number; expBonus?: number }
): number {
  if (!killer || !dead) return 1;
  const exp = killer.level * dead.level + (dead.expBonus ?? 0);
  return exp < 4 ? 4 : exp;
}
