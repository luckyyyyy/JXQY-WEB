/**
 * Magic Defaults — factory functions for creating default magic data
 *
 * Extracted from magic/types.ts to isolate the 300-line initialization code
 * that most consumers don't need.
 */

import type { MagicData, MagicItemInfo } from "./magic-data";
import {
  MagicAddonEffect,
  MagicMoveKind,
  MagicSpecialKind,
  RestorePropertyType,
  SideEffectDamageType,
} from "./magic-enums";

/**
 * 默认武功数据
 */
export function createDefaultMagicData(): MagicData {
  return {
    fileName: "",
    name: "",
    intro: "",
    speed: 8,
    moveKind: MagicMoveKind.NoMove,
    region: 0,
    specialKind: MagicSpecialKind.None,
    specialKindValue: 0,
    specialKindMilliSeconds: 0,
    noSpecialKindEffect: 0,
    alphaBlend: 0,
    flyingLum: 0,
    vanishLum: 0,
    waitFrame: 0,
    lifeFrame: 4,
    belong: 0,

    // 关联武功默认值
    randMagicProbability: 0,
    flyInterval: 0,
    secondMagicDelay: 0,
    magicDirectionWhenKillEnemy: 0,
    magicDirectionWhenBounceFlyEnd: 0,
    magicDirectionWhenBeAttacked: 0,

    // 效果值
    effect: 0,
    effect2: 0,
    effect3: 0,
    effectExt: 0,
    effectMana: 0,

    // 消耗
    manaCost: 0,
    thewCost: 0,
    lifeCost: 0,

    // 升级
    levelupExp: 0,
    currentLevel: 1,
    effectLevel: 0,
    maxLevel: 10,

    // 冷却和时间
    coldMilliSeconds: 0,
    keepMilliseconds: 0,
    changeToFriendMilliseconds: 0,

    // 计数
    count: 1,
    maxCount: 0,

    // 标志
    passThrough: 0,
    passThroughWithDestroyEffect: 0,
    passThroughWall: 0,
    attackAll: 0,
    noInterruption: 0,
    vibratingScreen: 0,
    bodyRadius: 0,
    solid: 0,
    noExplodeWhenLifeFrameEnd: 0,
    explodeWhenLifeFrameEnd: 0,
    discardOppositeMagic: 0,
    exchangeUser: 0,

    // 起始位置
    beginAtMouse: 0,
    beginAtUser: 0,
    beginAtUserAddDirectionOffset: 0,
    beginAtUserAddUserDirectionOffset: 0,

    // 移动
    randomMoveDegree: 0,
    followMouse: 0,
    meteorMove: 0,
    meteorMoveDir: 5,
    moveBack: 0,
    moveImitateUser: 0,

    // 圆周运动
    circleMoveClockwise: 0,
    circleMoveAnticlockwise: 0,
    roundMoveClockwise: 0,
    roundMoveAnticlockwise: 0,
    roundMoveCount: 1,
    roundMoveDegreeSpeed: 1,
    roundRadius: 1,

    // 携带
    carryUser: 0,
    carryUserSpriteIndex: 0,
    hideUserWhenCarry: 0,

    // 弹跳
    bounce: 0,
    bounceHurt: 0,
    ball: 0,
    bounceFly: 0,
    bounceFlySpeed: 32,
    bounceFlyEndHurt: 0,
    bounceFlyTouchHurt: 0,
    sticky: 0,

    // 追踪
    traceEnemy: 0,
    traceSpeed: 0,
    traceEnemyDelayMilliseconds: 0,

    // 禁用
    disableUse: 0,
    lifeFullToUse: 0,
    disableMoveMilliseconds: 0,
    disableSkillMilliseconds: 0,

    // 附加效果
    additionalEffect: MagicAddonEffect.None,

    // 副作用
    sideEffectProbability: 0,
    sideEffectPercent: 0,
    sideEffectType: SideEffectDamageType.Life,

    // 恢复
    restoreProbability: 0,
    restorePercent: 0,
    restoreType: RestorePropertyType.Life,
    dieAfterUse: 0,

    // 寄生
    parasitic: 0,
    parasiticInterval: 1000,
    parasiticMaxEffect: 0,

    // 范围效果
    rangeEffect: 0,
    rangeAddLife: 0,
    rangeAddMana: 0,
    rangeAddThew: 0,
    rangeSpeedUp: 0,
    rangeFreeze: 0,
    rangePoison: 0,
    rangePetrify: 0,
    rangeDamage: 0,
    rangeRadius: 0,
    rangeTimeInterval: 0,

    // 属性加成
    attackAddPercent: 0,
    defendAddPercent: 0,
    evadeAddPercent: 0,
    speedAddPercent: 0,

    // 变身
    morphMilliseconds: 0,

    // 虚弱
    weakMilliseconds: 0,
    weakAttackPercent: 0,
    weakDefendPercent: 0,

    // 致盲
    blindMilliseconds: 0,

    // 跳跃
    leapTimes: 0,
    leapFrame: 0,
    effectReducePercentage: 0,

    // 复活尸体
    reviveBodyRadius: 0,
    reviveBodyMaxCount: 0,
    reviveBodyLifeMilliSeconds: 0,

    // 跳跃到目标
    jumpToTarget: 0,
    jumpMoveSpeed: 32,

    // 恢复加成
    addThewRestorePercent: 0,
    addManaRestorePercent: 0,
    addLifeRestorePercent: 0,

    // 连击变化
    hitCountToChangeMagic: 0,
    hitCountFlyRadius: 0,
    hitCountFlyAngleSpeed: 0,

    // 基础属性加成
    lifeMax: 0,
    thewMax: 0,
    manaMax: 0,
    attack: 0,
    defend: 0,
    evade: 0,
    attack2: 0,
    defend2: 0,
    attack3: 0,
    defend3: 0,
  };
}

/**
 * 创建默认武功项信息
 */
export function createDefaultMagicItemInfo(
  magic: MagicData | null = null,
  level = 1
): MagicItemInfo {
  return {
    magic,
    level,
    exp: 0,
    remainColdMilliseconds: 0,
    hideCount: 1,
    lastIndexWhenHide: 0,
  };
}
