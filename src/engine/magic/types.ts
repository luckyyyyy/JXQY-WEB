/**
 * Magic Types - based on JxqyHD Engine/Magic.cs
 * 武功系统类型定义
 */

import type { Vector2 } from "../core/types";

/**
 * 武功移动类型 - 对应 C# MoveKind
 * 决定武功的运动轨迹
 *
 * C# MagicManager.cs 中的 switch (magic.MoveKind) 参考
 */
export enum MagicMoveKind {
  NoMove = 0,              // 不移动
  FixedPosition = 1,       // 固定位置 (AddFixedPositionMagicSprite)
  SingleMove = 2,          // 单个移动 - 向鼠标方向飞，**自由方向** (GetMoveMagicSprite)
  LineMove = 3,            // 直线移动 - 多个，按等级增加数量 (AddLineMoveMagicSprite)
  CircleMove = 4,          // 圆形移动 (AddCircleMoveMagicSprite)
  HeartMove = 5,           // 心形移动 (AddHeartMoveMagicSprite)
  SpiralMove = 6,          // 螺旋移动 (AddSpiralMoveMagicSprite)
  SectorMove = 7,          // 扇形移动 (AddSectorMoveMagicSprite)
  RandomSector = 8,        // 随机扇形 (AddRandomSectorMoveMagicSprite)
  FixedWall = 9,           // 固定墙 (AddFixedWallMagicSprite)
  WallMove = 10,           // 墙移动 (AddWallMoveMagicSprite)
  RegionBased = 11,        // 区域类型 - 根据 Region 决定具体类型
  // 12 unused
  FollowCharacter = 13,    // 跟随角色 (AddFollowCharacterMagicSprite)
  // 14 unused
  SuperMode = 15,          // 超级模式 (AddSuperModeMagic)
  FollowEnemy = 16,        // 跟随敌人 (AddFollowEnemyMagicSprite)
  Throw = 17,              // 投掷 (AddThrowMagicSprite)
  // 18 empty
  Kind19 = 19,             // 特殊类型19
  Transport = 20,          // 传送
  PlayerControl = 21,      // 玩家控制
  FixedAtDestination = 22, // 固定在目标位置
  TimeStop = 23,           // 时间停止 (same as FollowCharacter)
  VMove = 24,              // V字移动 (AddVMoveMagicSprite)
}

/**
 * 武功特殊效果类型 - 对应 C# SpecialKind
 *
 * 注意：这些值在 MoveKind=13 (FollowCharacter) 时有特殊含义
 * C# Reference: MagicManager.AddFollowCharacterMagicSprite switch (magic.SpecialKind)
 *
 * 在 MoveKind=13 (自身增益类武功) 时:
 * - 1: 加生命 (清心咒)
 * - 2: 加体力
 * - 3,6: 持续效果 (金钟罩等BUFF)
 * - 4: 隐身 (攻击时消失)
 * - 5: 隐身 (攻击时可见)
 * - 7: 变身
 * - 8: 解除异常状态
 * - 9: 改变飞行ini
 */
export enum MagicSpecialKind {
  None = 0,
  // MoveKind=13 时: 加生命; 其他: 冰冻
  AddLifeOrFrozen = 1,
  // MoveKind=13 时: 加体力; 其他: 中毒
  AddThewOrPoison = 2,
  // MoveKind=13 时: 持续效果; 其他: 石化
  BuffOrPetrify = 3,
  // MoveKind=13 时: 隐身(攻击时消失)
  InvisibleHide = 4,
  // MoveKind=13 时: 隐身(攻击时可见)
  InvisibleShow = 5,
  // MoveKind=13 时: 持续效果
  Buff = 6,
  // 变身
  ChangeCharacter = 7,
  // 解除异常状态
  RemoveAbnormal = 8,
  // 改变飞行ini
  ChangeFlyIni = 9,
}

/**
 * 附加效果 - 对应 C# Magic.AddonEffect
 */
export enum MagicAddonEffect {
  None = 0,
  Frozen = 1,
  Poison = 2,
  Petrified = 3,
}

/**
 * 副作用伤害类型
 */
export enum SideEffectDamageType {
  Life = 0,
  Mana = 1,
  Thew = 2,
}

/**
 * 恢复属性类型
 */
export enum RestorePropertyType {
  Life = 0,
  Mana = 1,
  Thew = 2,
}

/**
 * 武功数据 - 对应 C# Magic 类的核心属性
 */
export interface MagicData {
  // 基础信息
  fileName: string;          // 文件名 (C#: FileName)
  name: string;              // 武功名称 (C#: Name)
  intro: string;             // 武功介绍 (C#: Intro)
  type?: string;             // 类型 (C#: Type)

  // 运动属性
  speed: number;             // 速度 (C#: Speed)
  moveKind: MagicMoveKind;   // 移动类型 (C#: MoveKind)
  region: number;            // 区域 (C#: Region)

  // 特效属性
  specialKind: MagicSpecialKind;    // 特殊效果 (C#: SpecialKind)
  specialKindValue: number;         // 特殊效果值 (C#: SpecialKindValue)
  specialKindMilliSeconds: number;  // 特殊效果持续时间 (C#: SpecialKindMilliSeconds)
  alphaBlend: number;               // 透明混合 (C#: AlphaBlend)
  flyingLum: number;                // 飞行亮度 (C#: FlyingLum)
  vanishLum: number;                // 消失亮度 (C#: VanishLum)

  // 图像资源
  image?: string;            // 武功图像 (C#: Image -> Asf)
  icon?: string;             // 图标 (C#: Icon -> Asf)
  flyingImage?: string;      // 飞行图像 (C#: FlyingImage -> Asf)
  vanishImage?: string;      // 消失图像 (C#: VanishImage -> Asf)
  superModeImage?: string;   // 超级模式图像 (C#: SuperModeImage -> Asf)
  leapImage?: string;        // 跳跃图像 (C#: LeapImage -> Asf)
  useActionFile?: string;    // 使用动作文件 (C#: UseActionFile -> Asf)

  // 声音资源
  flyingSound?: string;      // 飞行声音 (C#: FlyingSound)
  vanishSound?: string;      // 消失声音 (C#: VanishSound)

  // 帧相关
  waitFrame: number;         // 等待帧数 (C#: WaitFrame)
  lifeFrame: number;         // 生命帧数 (C#: LifeFrame)

  // 从属关系
  belong: number;            // 从属 (C#: Belong)
  actionFile?: string;       // 动作文件 (C#: ActionFile)
  attackFile?: string;       // 攻击文件 (C#: AttackFile -> Magic filename)

  // 效果值
  effect: number;            // 主效果 (C#: Effect) - 伤害/治疗量
  effect2: number;           // 效果2 (C#: Effect2)
  effect3: number;           // 效果3 (C#: Effect3)
  effectExt: number;         // 效果扩展 (C#: EffectExt)
  effectMana: number;        // 内力效果 (C#: EffectMana)

  // 消耗
  manaCost: number;          // 内力消耗 (C#: ManaCost)
  thewCost: number;          // 体力消耗 (C#: ThewCost)
  lifeCost: number;          // 生命消耗 (C#: LifeCost)

  // 升级
  levelupExp: number;        // 升级所需经验 (C#: LevelupExp)
  currentLevel: number;      // 当前等级 (C#: CurrentLevel)
  effectLevel: number;       // 效果等级 (C#: EffectLevel)
  maxLevel: number;          // 最大等级 (C#: MaxLevel)

  // 冷却
  coldMilliSeconds: number;  // 冷却时间 (C#: ColdMilliSeconds)

  // 计数
  count: number;             // 数量 (C#: Count)
  maxCount: number;          // 最大数量 (C#: MaxCount)

  // 杂项标志
  passThrough: number;       // 穿透 (C#: PassThrough)
  passThroughWall: number;   // 穿墙 (C#: PassThroughWall)
  attackAll: number;         // 攻击全部 (C#: AttackAll)
  noInterruption: number;    // 不打断 (C#: NoInterruption)
  vibratingScreen: number;   // 震屏 (C#: VibratingScreen)
  bodyRadius: number;        // 身体半径 (C#: BodyRadius)

  // 跟踪属性
  traceEnemy: number;        // 追踪敌人 (C#: TraceEnemy)
  traceSpeed: number;        // 追踪速度 (C#: TraceSpeed)
  traceEnemyDelayMilliseconds: number; // 追踪延迟 (C#: TraceEnemyDelayMilliseconds)

  // 弹跳属性
  bounce: number;            // 弹跳 (C#: Bounce)
  bounceHurt: number;        // 弹跳伤害 (C#: BounceHurt)
  ball: number;              // 球 (C#: Ball)

  // 禁用属性
  disableUse: number;        // 禁用使用 (C#: DisableUse)
  lifeFullToUse: number;     // 满生命使用 (C#: LifeFullToUse)

  // 附加效果
  additionalEffect: MagicAddonEffect; // 附加效果 (C#: AdditionalEffect)

  // 副作用
  sideEffectProbability: number;  // 副作用概率
  sideEffectPercent: number;      // 副作用百分比
  sideEffectType: SideEffectDamageType; // 副作用类型

  // 恢复
  restoreProbability: number;     // 恢复概率
  restorePercent: number;         // 恢复百分比
  restoreType: RestorePropertyType; // 恢复类型

  // 范围效果
  rangeEffect: number;       // 范围效果 (C#: RangeEffect)
  rangeAddLife: number;      // 范围加生命 (C#: RangeAddLife)
  rangeAddMana: number;      // 范围加内力 (C#: RangeAddMana)
  rangeAddThew: number;      // 范围加体力 (C#: RangeAddThew)
  rangeDamage: number;       // 范围伤害 (C#: RangeDamage)
  rangeRadius: number;       // 范围半径 (C#: RangeRadius)
  rangeTimeInterval: number; // 范围时间间隔 (C#: RangeTimeInerval)

  // 跳跃
  leapTimes: number;         // 跳跃次数 (C#: LeapTimes)
  leapFrame: number;         // 跳跃帧 (C#: LeapFrame)
  effectReducePercentage: number; // 效果减少百分比 (C#: EffectReducePercentage)

  // 等级数据 (用于不同等级的武功)
  levels?: Map<number, Partial<MagicData>>;
}

/**
 * 武功列表项信息 - 对应 C# MagicListManager.MagicItemInfo
 */
export interface MagicItemInfo {
  magic: MagicData | null;           // 武功数据 (C#: TheMagic)
  level: number;                     // 等级 (C#: Level)
  exp: number;                       // 经验值 (C#: Exp)
  remainColdMilliseconds: number;    // 剩余冷却时间 (C#: RemainColdMilliseconds)
  hideCount: number;                 // 隐藏计数 (C#: HideCount)
  lastIndexWhenHide: number;         // 隐藏时的索引 (C#: LastIndexWhenHide)
}

/**
 * @deprecated Use MagicSprite class instead
 * MagicSpriteState interface is replaced by MagicSprite class which extends Sprite
 * See: src/engine/magic/magicSprite.ts
 */
// Old MagicSpriteState interface removed - now using MagicSprite class

/**
 * 武功使用参数
 */
export interface UseMagicParams {
  userId: string;                    // 使用者ID
  magic: MagicData;                  // 武功数据
  origin: Vector2;                   // 起点
  destination: Vector2;              // 终点
  targetId?: string;                 // 目标ID
}

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
    alphaBlend: 0,
    flyingLum: 0,
    vanishLum: 0,
    waitFrame: 0,
    lifeFrame: 4,
    belong: 0,
    effect: 0,
    effect2: 0,
    effect3: 0,
    effectExt: 0,
    effectMana: 0,
    manaCost: 0,
    thewCost: 0,
    lifeCost: 0,
    levelupExp: 0,
    currentLevel: 1,
    effectLevel: 0,
    maxLevel: 10,
    coldMilliSeconds: 0,
    count: 1,
    maxCount: 0,
    passThrough: 0,
    passThroughWall: 0,
    attackAll: 0,
    noInterruption: 0,
    vibratingScreen: 0,
    bodyRadius: 0,
    traceEnemy: 0,
    traceSpeed: 0,
    traceEnemyDelayMilliseconds: 0,
    bounce: 0,
    bounceHurt: 0,
    ball: 0,
    disableUse: 0,
    lifeFullToUse: 0,
    additionalEffect: MagicAddonEffect.None,
    sideEffectProbability: 0,
    sideEffectPercent: 0,
    sideEffectType: SideEffectDamageType.Life,
    restoreProbability: 0,
    restorePercent: 0,
    restoreType: RestorePropertyType.Life,
    rangeEffect: 0,
    rangeAddLife: 0,
    rangeAddMana: 0,
    rangeAddThew: 0,
    rangeDamage: 0,
    rangeRadius: 0,
    rangeTimeInterval: 0,
    leapTimes: 0,
    leapFrame: 0,
    effectReducePercentage: 0,
  };
}

/**
 * 创建默认武功项信息
 */
export function createDefaultMagicItemInfo(magic: MagicData | null = null, level: number = 1): MagicItemInfo {
  return {
    magic,
    level,
    exp: 0,
    remainColdMilliseconds: 0,
    hideCount: 1,
    lastIndexWhenHide: 0,
  };
}
