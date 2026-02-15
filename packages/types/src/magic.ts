/**
 * 武功系统类型定义
 * 用于前后端共享的 Zod Schema
 */
import { z } from "zod";

// ========== 枚举定义 ==========

/**
 * 武功移动类型
 */
export const MagicMoveKindEnum = z.enum([
  "NoMove", // 0 - 不移动
  "FixedPosition", // 1 - 固定位置
  "SingleMove", // 2 - 单个移动
  "LineMove", // 3 - 直线移动
  "CircleMove", // 4 - 圆形移动
  "HeartMove", // 5 - 心形移动
  "SpiralMove", // 6 - 螺旋移动
  "SectorMove", // 7 - 扇形移动
  "RandomSector", // 8 - 随机扇形
  "FixedWall", // 9 - 固定墙
  "WallMove", // 10 - 墙移动
  "RegionBased", // 11 - 区域类型
  "FollowCharacter", // 13 - 跟随自身
  "SuperMode", // 15 - 超级模式
  "FollowEnemy", // 16 - 跟随敌人
  "Throw", // 17 - 投掷
  "Kind19", // 19 - 持续留痕
  "Transport", // 20 - 传送
  "PlayerControl", // 21 - 玩家控制
  "Summon", // 22 - 召唤 NPC
  "TimeStop", // 23 - 时间停止
  "VMove", // 24 - V字移动
]);

export type MagicMoveKind = z.infer<typeof MagicMoveKindEnum>;

/** 字符串枚举值到数字的映射 */
export const MagicMoveKindValues: Record<MagicMoveKind, number> = {
  NoMove: 0,
  FixedPosition: 1,
  SingleMove: 2,
  LineMove: 3,
  CircleMove: 4,
  HeartMove: 5,
  SpiralMove: 6,
  SectorMove: 7,
  RandomSector: 8,
  FixedWall: 9,
  WallMove: 10,
  RegionBased: 11,
  FollowCharacter: 13,
  SuperMode: 15,
  FollowEnemy: 16,
  Throw: 17,
  Kind19: 19,
  Transport: 20,
  PlayerControl: 21,
  Summon: 22,
  TimeStop: 23,
  VMove: 24,
};

/** 数字到字符串枚举值的映射 */
export const MagicMoveKindFromValue: Record<number, MagicMoveKind> = Object.fromEntries(
  Object.entries(MagicMoveKindValues).map(([k, v]) => [v, k as MagicMoveKind])
) as Record<number, MagicMoveKind>;

/**
 * 武功特殊效果类型
 */
export const MagicSpecialKindEnum = z.enum([
  "None", // 0 - 无特殊效果
  "AddLifeOrFrozen", // 1 - MoveKind=13时加生命 / 其他时冰冻
  "AddThewOrPoison", // 2 - MoveKind=13时加体力 / 其他时中毒
  "BuffOrPetrify", // 3 - MoveKind=13时持续BUFF / 其他时石化
  "InvisibleHide", // 4 - 隐身(攻击时消失)
  "InvisibleShow", // 5 - 隐身(攻击时可见)
  "Buff", // 6 - 持续效果
  "ChangeCharacter", // 7 - 变身
  "RemoveAbnormal", // 8 - 解除异常状态
  "ChangeFlyIni", // 9 - 改变飞行ini
]);

export type MagicSpecialKind = z.infer<typeof MagicSpecialKindEnum>;

export const MagicSpecialKindValues: Record<MagicSpecialKind, number> = {
  None: 0,
  AddLifeOrFrozen: 1,
  AddThewOrPoison: 2,
  BuffOrPetrify: 3,
  InvisibleHide: 4,
  InvisibleShow: 5,
  Buff: 6,
  ChangeCharacter: 7,
  RemoveAbnormal: 8,
  ChangeFlyIni: 9,
};

export const MagicSpecialKindFromValue: Record<number, MagicSpecialKind> = Object.fromEntries(
  Object.entries(MagicSpecialKindValues).map(([k, v]) => [v, k as MagicSpecialKind])
) as Record<number, MagicSpecialKind>;

/**
 * 武功使用者类型
 */
export const MagicUserTypeEnum = z.enum([
  "player", // 玩家专用
  "npc", // NPC专用
]);

export type MagicUserType = z.infer<typeof MagicUserTypeEnum>;

/**
 * 门派从属
 */
export const MagicBelongEnum = z.enum([
  "Neutral", // 0 - 杂派/无门派限制
  "WuLin", // 1 - 武林
  "LuoYeGu", // 2 - 落叶谷
  "CangJianShan", // 3 - 藏剑山庄
  "ZhenXingLou", // 4 - 真星楼
  "WuYouJiao", // 5 - 无忧教
  "YueZhongTian", // 6 - 月重天
  "NvErTang", // 7 - 女儿堂
  "FeiLongBao", // 8 - 飞龙堡
]);

export type MagicBelong = z.infer<typeof MagicBelongEnum>;

export const MagicBelongValues: Record<MagicBelong, number> = {
  Neutral: 0,
  WuLin: 1,
  LuoYeGu: 2,
  CangJianShan: 3,
  ZhenXingLou: 4,
  WuYouJiao: 5,
  YueZhongTian: 6,
  NvErTang: 7,
  FeiLongBao: 8,
};

export const MagicBelongFromValue: Record<number, MagicBelong> = Object.fromEntries(
  Object.entries(MagicBelongValues).map(([k, v]) => [v, k as MagicBelong])
) as Record<number, MagicBelong>;

/** 门派中文名映射 */
export const MagicBelongLabels: Record<MagicBelong, string> = {
  Neutral: "杂派",
  WuLin: "武林",
  LuoYeGu: "落叶谷",
  CangJianShan: "藏剑山庄",
  ZhenXingLou: "真星楼",
  WuYouJiao: "无忧教",
  YueZhongTian: "月重天",
  NvErTang: "女儿堂",
  FeiLongBao: "飞龙堡",
};

/**
 * 区域类型（MoveKind=11 RegionBased 时使用）
 * 决定武功效果的形状
 */
export const MagicRegionTypeEnum = z.enum([
  "Square", // 1 - 方形区域
  "Cross", // 2 - 十字区域
  "Rectangle", // 3 - 矩形区域
  "IsoscelesTriangle", // 4 - 等腰三角形
  "VType", // 5 - V形区域
  "RegionFile", // 6 - 使用外部区域文件
]);

export type MagicRegionType = z.infer<typeof MagicRegionTypeEnum>;

/** 区域类型枚举值到数字的映射 */
export const MagicRegionTypeValues: Record<MagicRegionType, number> = {
  Square: 1,
  Cross: 2,
  Rectangle: 3,
  IsoscelesTriangle: 4,
  VType: 5,
  RegionFile: 6,
};

/** 数字到区域类型枚举值的映射 */
export const MagicRegionTypeFromValue: Record<number, MagicRegionType> = Object.fromEntries(
  Object.entries(MagicRegionTypeValues).map(([k, v]) => [v, k as MagicRegionType])
) as Record<number, MagicRegionType>;

/** 区域类型中文名映射 */
export const MagicRegionTypeLabels: Record<MagicRegionType, string> = {
  Square: "方形区域",
  Cross: "十字区域",
  Rectangle: "矩形区域",
  IsoscelesTriangle: "等腰三角形",
  VType: "V形区域",
  RegionFile: "外部区域文件",
};

// ========== 等级配置 Schema ==========

/**
 * 武功等级配置
 */
export const MagicLevelSchema = z.object({
  level: z.number().int().min(1).max(10),
  effect: z.number().int().default(0), // 效果值（伤害/治疗）
  manaCost: z.number().int().default(0), // 内力消耗
  levelupExp: z.number().int().nullable().optional(), // 升级经验，10级为空
  speed: z.number().int().optional(), // 覆盖速度
  moveKind: MagicMoveKindEnum.optional(), // 覆盖移动类型
  lifeFrame: z.number().int().optional(), // 覆盖生命帧数
});

export type MagicLevel = z.infer<typeof MagicLevelSchema>;

// ========== AttackFile Schema ==========

/**
 * 攻击配置（嵌套的武功配置）
 * AttackFile 是武功的一个嵌套属性，存储攻击阶段的配置
 */
export const AttackFileSchema = z.object({
  // 基础属性
  name: z.string().default(""),
  intro: z.string().default(""),

  // 运动属性
  moveKind: MagicMoveKindEnum.default("SingleMove"),
  speed: z.number().int().min(0).max(32).default(8),
  region: z.number().int().min(0).max(4).default(0),

  // 特效属性
  specialKind: MagicSpecialKindEnum.default("None"),
  specialKindValue: z.number().int().default(0),
  specialKindMilliSeconds: z.number().int().default(0),
  alphaBlend: z.number().int().default(0),
  flyingLum: z.number().int().min(0).max(31).default(0),
  vanishLum: z.number().int().min(0).max(31).default(0),

  // 帧相关
  waitFrame: z.number().int().min(0).default(0),
  lifeFrame: z.number().int().min(0).default(4),

  // 资源文件
  flyingImage: z.string().nullable().optional(),
  flyingSound: z.string().nullable().optional(),
  vanishImage: z.string().nullable().optional(),
  vanishSound: z.string().nullable().optional(),

  // 穿透属性
  passThrough: z.number().int().default(0),
  passThroughWall: z.number().int().default(0),

  // 追踪属性
  traceEnemy: z.number().int().default(0),
  traceSpeed: z.number().int().default(0),

  // 范围效果
  rangeRadius: z.number().int().default(0),
  attackAll: z.number().int().default(0),

  // 弹跳
  bounce: z.number().int().default(0),
  bounceHurt: z.number().int().default(0),

  // 其他
  vibratingScreen: z.number().int().default(0),
});

export type AttackFile = z.infer<typeof AttackFileSchema>;

// ========== 武功主 Schema ==========

/**
 * 武功基础信息 Schema
 */
export const MagicBaseSchema = z.object({
  // 基础标识
  id: z.string().uuid(),
  gameId: z.string().uuid(),
  userType: MagicUserTypeEnum, // 使用者类型
  key: z.string().min(1), // 唯一标识符（gameId + key 唯一）

  // 基础属性
  name: z.string().min(1), // 武功名称
  intro: z.string().default(""), // 武功介绍

  // 运动属性
  moveKind: MagicMoveKindEnum.default("SingleMove"),
  speed: z.number().int().min(0).max(32).default(8),
  region: z.number().int().min(0).max(4).default(0),

  // 特效属性
  specialKind: MagicSpecialKindEnum.default("None"),
  alphaBlend: z.number().int().default(0), // 是否透明混合
  flyingLum: z.number().int().min(0).max(31).default(0),
  vanishLum: z.number().int().min(0).max(31).default(0),

  // 帧相关
  waitFrame: z.number().int().min(0).default(0),
  lifeFrame: z.number().int().min(0).default(4),

  // 资源文件
  image: z.string().nullable().optional(), // 武功施放图像
  icon: z.string().nullable().optional(), // 图标
  flyingImage: z.string().nullable().optional(), // 飞行图像
  flyingSound: z.string().nullable().optional(), // 飞行音效
  vanishImage: z.string().nullable().optional(), // 消失图像
  vanishSound: z.string().nullable().optional(), // 消失音效
  superModeImage: z.string().nullable().optional(), // 超级模式图像

  // 从属关系（仅玩家武功）
  belong: MagicBelongEnum.nullable().optional(), // 门派从属
  actionFile: z.string().nullable().optional(), // 动作文件
  attackFile: AttackFileSchema.nullable().optional(), // 攻击配置（嵌套武功对象）

  // 等级配置（仅玩家武功）
  levels: z.array(MagicLevelSchema).nullable().optional(),

  // 时间戳
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
});

export type MagicBase = z.infer<typeof MagicBaseSchema>;

/**
 * 武功完整 Schema（包含高级属性）
 */
export const MagicSchema = MagicBaseSchema.extend({
  // ===== 效果与消耗（基础值，可被等级配置覆盖）=====
  effect: z.number().int().default(0), // 主效果值（伤害/治疗）
  effect2: z.number().int().default(0), // 效果2
  effect3: z.number().int().default(0), // 效果3
  effectExt: z.number().int().default(0), // 效果扩展值
  effectMana: z.number().int().default(0), // 内力效果值
  manaCost: z.number().int().default(0), // 内力消耗
  thewCost: z.number().int().default(0), // 体力消耗
  lifeCost: z.number().int().default(0), // 生命消耗
  levelupExp: z.number().int().default(0), // 升级所需经验

  // ===== 数量与等级 =====
  count: z.number().int().default(0), // 弹丸/分身数量
  maxCount: z.number().int().default(0), // 同屏最大数量
  maxLevel: z.number().int().default(0), // 最大等级
  effectLevel: z.number().int().default(0), // 效果等级（覆盖时使用）

  // ===== 特殊效果相关 =====
  specialKindValue: z.number().int().default(0),
  specialKindMilliSeconds: z.number().int().default(0),
  noSpecialKindEffect: z.number().int().default(0), // 禁用特效动画

  // ===== 穿透属性 =====
  passThrough: z.number().int().default(0),
  passThroughWall: z.number().int().default(0),
  passThroughWithDestroyEffect: z.number().int().default(0), // 穿透但播放销毁特效
  solid: z.number().int().default(0), // 实体（阻挡其他武功）
  bodyRadius: z.number().int().default(0), // 武功碰撞体半径

  // ===== 追踪属性 =====
  traceEnemy: z.number().int().default(0),
  traceSpeed: z.number().int().default(0),
  traceEnemyDelayMilliseconds: z.number().int().default(0), // 追踪延迟(ms)

  // ===== 冷却时间 =====
  coldMilliSeconds: z.number().int().default(0),

  // ===== 时间/持续 =====
  keepMilliseconds: z.number().int().default(0), // 武功保持时间(ms)
  changeToFriendMilliseconds: z.number().int().default(0), // 转为友方的时间(ms)

  // ===== 范围效果 =====
  rangeRadius: z.number().int().default(0),
  attackAll: z.number().int().default(0),
  rangeEffect: z.number().int().default(0), // 范围效果开关
  rangeAddLife: z.number().int().default(0), // 范围回复生命
  rangeAddMana: z.number().int().default(0), // 范围回复内力
  rangeAddThew: z.number().int().default(0), // 范围回复体力
  rangeSpeedUp: z.number().int().default(0), // 范围加速
  rangeFreeze: z.number().int().default(0), // 范围冰冻
  rangePoison: z.number().int().default(0), // 范围中毒
  rangePetrify: z.number().int().default(0), // 范围石化
  rangeDamage: z.number().int().default(0), // 范围伤害
  rangeTimeInterval: z.number().int().default(0), // 范围效果时间间隔(ms)

  // ===== 弹跳/球体/弹飞 =====
  bounce: z.number().int().default(0),
  bounceHurt: z.number().int().default(0),
  ball: z.number().int().default(0), // 球体模式
  bounceFly: z.number().int().default(0), // 弹飞模式
  bounceFlySpeed: z.number().int().default(32), // 弹飞速度
  bounceFlyEndHurt: z.number().int().default(0), // 弹飞结束伤害
  bounceFlyTouchHurt: z.number().int().default(0), // 弹飞触碰伤害
  bounceFlyEndMagic: z.string().nullable().optional(), // 弹飞结束时触发的武功
  magicDirectionWhenBounceFlyEnd: z.number().int().default(0), // 弹飞结束武功方向
  sticky: z.number().int().default(0), // 粘附效果

  // ===== 起始位置 =====
  beginAtMouse: z.number().int().default(0),
  beginAtUser: z.number().int().default(0),
  beginAtUserAddDirectionOffset: z.number().int().default(0),
  beginAtUserAddUserDirectionOffset: z.number().int().default(0),

  // ===== 移动/轨迹 =====
  randomMoveDegree: z.number().int().default(0), // 随机移动偏转角度
  followMouse: z.number().int().default(0), // 跟随鼠标移动
  meteorMove: z.number().int().default(0), // 流星式移动
  meteorMoveDir: z.number().int().default(5), // 流星移动方向
  moveBack: z.number().int().default(0), // 后退移动
  moveImitateUser: z.number().int().default(0), // 模仿使用者移动方向

  // ===== 圆周/圆形运动 =====
  circleMoveClockwise: z.number().int().default(0),
  circleMoveAnticlockwise: z.number().int().default(0),
  roundMoveClockwise: z.number().int().default(0),
  roundMoveAnticlockwise: z.number().int().default(0),
  roundMoveCount: z.number().int().default(1), // 圆形运动数量
  roundMoveDegreeSpeed: z.number().int().default(1), // 圆形运动角速度
  roundRadius: z.number().int().default(1), // 圆形运动半径

  // ===== 携带使用者 =====
  carryUser: z.number().int().default(0),
  carryUserSpriteIndex: z.number().int().default(0),
  hideUserWhenCarry: z.number().int().default(0),

  // ===== 爆炸/生命结束 =====
  noExplodeWhenLifeFrameEnd: z.number().int().default(0),
  explodeWhenLifeFrameEnd: z.number().int().default(0),
  noInterruption: z.number().int().default(0), // 武功不可被打断
  discardOppositeMagic: z.number().int().default(0), // 抵消对方武功
  exchangeUser: z.number().int().default(0), // 交换使用者位置

  // ===== Buff/Debuff 百分比 =====
  attackAddPercent: z.number().int().default(0),
  defendAddPercent: z.number().int().default(0),
  evadeAddPercent: z.number().int().default(0),
  speedAddPercent: z.number().int().default(0),
  morphMilliseconds: z.number().int().default(0), // 变身持续时间(ms)
  weakMilliseconds: z.number().int().default(0), // 虚弱持续时间(ms)
  weakAttackPercent: z.number().int().default(0), // 虚弱时攻击削减百分比
  weakDefendPercent: z.number().int().default(0), // 虚弱时防御削减百分比
  blindMilliseconds: z.number().int().default(0), // 致盲持续时间(ms)

  // ===== 禁用/限制 =====
  disableUse: z.number().int().default(0), // 禁用使用（不可主动释放）
  lifeFullToUse: z.number().int().default(0), // 满生命才能使用
  disableMoveMilliseconds: z.number().int().default(0), // 命中后禁止移动(ms)
  disableSkillMilliseconds: z.number().int().default(0), // 命中后禁止技能(ms)

  // ===== 副作用/恢复 =====
  sideEffectProbability: z.number().int().default(0), // 副作用触发概率(0-100)
  sideEffectPercent: z.number().int().default(0), // 副作用百分比
  sideEffectType: z.number().int().default(0), // 副作用类型(0=Life,1=Mana,2=Thew)
  restoreProbability: z.number().int().default(0), // 恢复触发概率(0-100)
  restorePercent: z.number().int().default(0), // 恢复百分比
  restoreType: z.number().int().default(0), // 恢复类型(0=Life,1=Mana,2=Thew)
  dieAfterUse: z.number().int().default(0), // 使用后死亡

  // ===== 基础属性加成 =====
  lifeMax: z.number().int().default(0),
  thewMax: z.number().int().default(0),
  manaMax: z.number().int().default(0),
  attack: z.number().int().default(0),
  attack2: z.number().int().default(0),
  attack3: z.number().int().default(0),
  defend: z.number().int().default(0),
  defend2: z.number().int().default(0),
  defend3: z.number().int().default(0),
  evade: z.number().int().default(0),

  // ===== 恢复速度加成 =====
  addLifeRestorePercent: z.number().int().default(0),
  addManaRestorePercent: z.number().int().default(0),
  addThewRestorePercent: z.number().int().default(0),

  // ===== 寄生相关 =====
  parasitic: z.number().int().default(0),
  parasiticMagic: z.string().nullable().optional(),
  parasiticInterval: z.number().int().default(1000),
  parasiticMaxEffect: z.number().int().default(0), // 寄生最大累计效果

  // ===== 跳跃/跳跃到目标 =====
  leapTimes: z.number().int().default(0), // 跳跃次数
  leapFrame: z.number().int().default(0), // 跳跃帧数
  effectReducePercentage: z.number().int().default(0), // 每次跳跃效果衰减
  leapImage: z.string().nullable().optional(), // 跳跃图像资源
  jumpToTarget: z.number().int().default(0), // 跳跃到目标开关
  jumpMoveSpeed: z.number().int().default(32), // 跳跃移动速度

  // ===== 复活尸体 =====
  reviveBodyRadius: z.number().int().default(0),
  reviveBodyMaxCount: z.number().int().default(0),
  reviveBodyLifeMilliSeconds: z.number().int().default(0),

  // ===== 连击/命中 =====
  hitCountToChangeMagic: z.number().int().default(0),
  hitCountFlyRadius: z.number().int().default(0),
  hitCountFlyAngleSpeed: z.number().int().default(0),
  hitCountFlyingImage: z.string().nullable().optional(),
  hitCountVanishImage: z.string().nullable().optional(),

  // ===== 关联武功 =====
  explodeMagicFile: z.string().nullable().optional(),
  flyMagic: z.string().nullable().optional(),
  flyInterval: z.number().int().default(0),
  flyIni: z.string().nullable().optional(), // 飞行INI配置路径
  flyIni2: z.string().nullable().optional(), // 飞行INI配置路径2
  randMagicFile: z.string().nullable().optional(), // 随机触发的武功
  randMagicProbability: z.number().int().default(0), // 随机武功触发概率
  secondMagicFile: z.string().nullable().optional(), // 第二段武功
  secondMagicDelay: z.number().int().default(0), // 第二段武功延迟(ms)
  magicToUseWhenKillEnemy: z.string().nullable().optional(),
  magicDirectionWhenKillEnemy: z.number().int().default(0),
  changeMagic: z.string().nullable().optional(), // 连击变化武功
  jumpEndMagic: z.string().nullable().optional(), // 跳跃结束时触发的武功
  magicToUseWhenBeAttacked: z.string().nullable().optional(),
  magicDirectionWhenBeAttacked: z.number().int().default(0),
  magicWhenNewPos: z.string().nullable().optional(), // 到达新位置时触发的武功
  replaceMagic: z.string().nullable().optional(), // 替换武功
  specialKind9ReplaceFlyIni: z.string().nullable().optional(),
  specialKind9ReplaceFlyIni2: z.string().nullable().optional(),

  // ===== 震屏 =====
  vibratingScreen: z.number().int().default(0),

  // ===== NPC 相关 =====
  npcFile: z.string().nullable().optional(),
  npcIni: z.string().nullable().optional(), // NPC配置INI路径

  // ===== 资源/标签 =====
  useActionFile: z.string().nullable().optional(), // 使用时角色动作文件
  regionFile: z.string().nullable().optional(), // 外部区域定义文件
  goodsName: z.string().nullable().optional(), // 关联物品名称
  type: z.string().nullable().optional(), // 武功类型标签
});

export type Magic = z.infer<typeof MagicSchema>;

// ========== API Schema ==========

/**
 * 创建武功输入
 */
export const CreateMagicInputSchema = z.object({
  gameId: z.string().uuid(),
  userType: MagicUserTypeEnum,
  key: z.string().min(1), // 唯一标识符
  name: z.string().min(1),
  intro: z.string().optional(),
  moveKind: MagicMoveKindEnum.optional(),
  specialKind: MagicSpecialKindEnum.optional(),
  belong: MagicBelongEnum.nullable().optional(),
});

export type CreateMagicInput = z.infer<typeof CreateMagicInputSchema>;

/**
 * 更新武功输入
 */
export const UpdateMagicInputSchema = MagicSchema.partial().extend({
  id: z.string().uuid(),
  gameId: z.string().uuid(),
});

export type UpdateMagicInput = z.infer<typeof UpdateMagicInputSchema>;

/**
 * 删除武功输入
 */
export const DeleteMagicInputSchema = z.object({
  id: z.string().uuid(),
  gameId: z.string().uuid(),
});

export type DeleteMagicInput = z.infer<typeof DeleteMagicInputSchema>;

/**
 * 列出武功输入
 */
export const ListMagicInputSchema = z.object({
  gameId: z.string().uuid(),
  userType: MagicUserTypeEnum.optional(),
});

export type ListMagicInput = z.infer<typeof ListMagicInputSchema>;

/**
 * 导入武功输入（单个）
 */
export const ImportMagicInputSchema = z.object({
  gameId: z.string().uuid(),
  userType: MagicUserTypeEnum,
  fileName: z.string().min(1), // 文件名+扩展名，作为 key
  iniContent: z.string(), // 主武功 INI 文件内容
  attackFileContent: z.string().optional(), // AttackFile INI 内容（可选）
});

export type ImportMagicInput = z.infer<typeof ImportMagicInputSchema>;

/**
 * 批量导入武功单项
 */
export const BatchImportMagicItemSchema = z.object({
  fileName: z.string(), // 文件名（用于日志和识别）
  iniContent: z.string(), // 主武功 INI 文件内容
  attackFileContent: z.string().optional(), // AttackFile INI 内容（可选，自动识别为飞行武功）
  userType: MagicUserTypeEnum.optional(), // 每个文件可单独指定类型（用于自动识别）
});

export type BatchImportMagicItem = z.infer<typeof BatchImportMagicItemSchema>;

/**
 * 批量导入武功输入
 */
export const BatchImportMagicInputSchema = z.object({
  gameId: z.string().uuid(),
  userType: MagicUserTypeEnum.optional(), // 全局类型（可选，作为默认值）
  items: z.array(BatchImportMagicItemSchema).min(1).max(100), // 限制最多 100 个
});

export type BatchImportMagicInput = z.infer<typeof BatchImportMagicInputSchema>;

/**
 * 批量导入结果
 */
export const BatchImportMagicResultSchema = z.object({
  success: z.array(
    z.object({
      fileName: z.string(),
      id: z.string().uuid(),
      name: z.string(),
      isFlyingMagic: z.boolean(), // 是否识别为飞行武功
    })
  ),
  failed: z.array(
    z.object({
      fileName: z.string(),
      error: z.string(),
    })
  ),
});

export type BatchImportMagicResult = z.infer<typeof BatchImportMagicResultSchema>;

/**
 * 获取武功输入
 */
export const GetMagicInputSchema = z.object({
  id: z.string().uuid(),
  gameId: z.string().uuid(),
});

export type GetMagicInput = z.infer<typeof GetMagicInputSchema>;

/**
 * 武功列表项 - 用于列表展示的精简版本
 */
export const MagicListItemSchema = z.object({
  id: z.string().uuid(),
  key: z.string(), // 唯一标识符
  name: z.string(),
  userType: MagicUserTypeEnum,
  moveKind: MagicMoveKindEnum,
  belong: MagicBelongEnum.nullable(),
  icon: z.string().nullable().optional(), // 图标路径（用于侧边栏显示）
  updatedAt: z.string(),
});

export type MagicListItem = z.infer<typeof MagicListItemSchema>;

// ========== 辅助函数 ==========

/**
 * 根据 MoveKind 判断应该显示哪些字段
 */
export function getVisibleFieldsByMoveKind(moveKind: MagicMoveKind): string[] {
  // 基础字段 - 始终显示
  const baseFields = [
    "name",
    "intro",
    "moveKind",
    "specialKind",
    "alphaBlend",
    "flyingLum",
    "vanishLum",
    "image",
    "icon",
    "flyingImage",
    "flyingSound",
    "vanishImage",
    "vanishSound",
  ];

  // 移动相关字段 - 根据 moveKind 决定
  const motionFields = ["speed", "waitFrame", "lifeFrame"];

  // 区域类型专用字段
  const regionFields = moveKind === "RegionBased" ? ["region", "rangeRadius"] : [];

  const additionalFields: Record<MagicMoveKind, string[]> = {
    NoMove: [],
    FixedPosition: [],
    SingleMove: ["passThrough", "passThroughWall", "traceEnemy", "traceSpeed"],
    LineMove: ["passThrough"],
    CircleMove: ["rangeRadius", "attackAll"],
    HeartMove: [],
    SpiralMove: [],
    SectorMove: ["rangeRadius"],
    RandomSector: ["rangeRadius"],
    FixedWall: [],
    WallMove: ["passThrough"],
    RegionBased: [], // 已在 regionFields 中处理
    FollowCharacter: ["specialKindValue", "specialKindMilliSeconds"],
    SuperMode: ["superModeImage"],
    FollowEnemy: ["traceEnemy", "traceSpeed"],
    Throw: ["bounce", "bounceHurt"],
    Kind19: [],
    Transport: [],
    PlayerControl: [],
    Summon: ["npcFile"],
    TimeStop: [],
    VMove: [],
  };

  return [...baseFields, ...motionFields, ...regionFields, ...(additionalFields[moveKind] || [])];
}

/**
 * 创建默认等级配置
 */
export function createDefaultLevels(): MagicLevel[] {
  return Array.from({ length: 10 }, (_, i) => ({
    level: i + 1,
    effect: 100 * (i + 1),
    manaCost: 10 + i * 5,
    levelupExp: i < 9 ? 1000 * (i + 1) : null,
    speed: undefined,
    moveKind: undefined,
    lifeFrame: undefined,
  }));
}

/**
 * 创建默认攻击配置
 */
export function createDefaultAttackFile(): AttackFile {
  return {
    name: "",
    intro: "",
    moveKind: "SingleMove",
    speed: 8,
    region: 0,
    specialKind: "None",
    specialKindValue: 0,
    specialKindMilliSeconds: 0,
    alphaBlend: 0,
    flyingLum: 0,
    vanishLum: 0,
    waitFrame: 0,
    lifeFrame: 4,
    flyingImage: null,
    flyingSound: null,
    vanishImage: null,
    vanishSound: null,
    passThrough: 0,
    passThroughWall: 0,
    traceEnemy: 0,
    traceSpeed: 0,
    rangeRadius: 0,
    attackAll: 0,
    bounce: 0,
    bounceHurt: 0,
    vibratingScreen: 0,
  };
}

/**
 * 创建默认武功
 */
export function createDefaultMagic(
  gameId: string,
  userType: MagicUserType = "player",
  key?: string
): Omit<Magic, "id" | "createdAt" | "updatedAt"> {
  return {
    gameId,
    userType,
    key: key ?? `magic_${Date.now()}`,
    name: "新武功",
    intro: "",
    moveKind: "SingleMove",
    speed: 8,
    region: 0,
    specialKind: "None",
    alphaBlend: 0,
    flyingLum: 0,
    vanishLum: 0,
    waitFrame: 0,
    lifeFrame: 4,
    image: null,
    icon: null,
    flyingImage: null,
    flyingSound: null,
    vanishImage: null,
    vanishSound: null,
    superModeImage: null,
    belong: userType === "player" ? "Neutral" : null,
    actionFile: null,
    attackFile: null,
    levels: userType === "player" ? createDefaultLevels() : null,
    // 效果与消耗
    effect: 0,
    effect2: 0,
    effect3: 0,
    effectExt: 0,
    effectMana: 0,
    manaCost: 0,
    thewCost: 0,
    lifeCost: 0,
    levelupExp: 0,
    // 数量与等级
    count: 0,
    maxCount: 0,
    maxLevel: 0,
    effectLevel: 0,
    // 特殊效果
    specialKindValue: 0,
    specialKindMilliSeconds: 0,
    noSpecialKindEffect: 0,
    // 穿透
    passThrough: 0,
    passThroughWall: 0,
    passThroughWithDestroyEffect: 0,
    solid: 0,
    bodyRadius: 0,
    // 追踪
    traceEnemy: 0,
    traceSpeed: 0,
    traceEnemyDelayMilliseconds: 0,
    // 冷却/时间
    coldMilliSeconds: 0,
    keepMilliseconds: 0,
    changeToFriendMilliseconds: 0,
    // 范围效果
    rangeRadius: 0,
    attackAll: 0,
    rangeEffect: 0,
    rangeAddLife: 0,
    rangeAddMana: 0,
    rangeAddThew: 0,
    rangeSpeedUp: 0,
    rangeFreeze: 0,
    rangePoison: 0,
    rangePetrify: 0,
    rangeDamage: 0,
    rangeTimeInterval: 0,
    // 弹跳/球体
    bounce: 0,
    bounceHurt: 0,
    ball: 0,
    bounceFly: 0,
    bounceFlySpeed: 32,
    bounceFlyEndHurt: 0,
    bounceFlyTouchHurt: 0,
    bounceFlyEndMagic: null,
    magicDirectionWhenBounceFlyEnd: 0,
    sticky: 0,
    // 起始位置
    beginAtMouse: 0,
    beginAtUser: 0,
    beginAtUserAddDirectionOffset: 0,
    beginAtUserAddUserDirectionOffset: 0,
    // 移动/轨迹
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
    // 携带使用者
    carryUser: 0,
    carryUserSpriteIndex: 0,
    hideUserWhenCarry: 0,
    // 爆炸/打断
    noExplodeWhenLifeFrameEnd: 0,
    explodeWhenLifeFrameEnd: 0,
    noInterruption: 0,
    discardOppositeMagic: 0,
    exchangeUser: 0,
    // Buff/Debuff
    attackAddPercent: 0,
    defendAddPercent: 0,
    evadeAddPercent: 0,
    speedAddPercent: 0,
    morphMilliseconds: 0,
    weakMilliseconds: 0,
    weakAttackPercent: 0,
    weakDefendPercent: 0,
    blindMilliseconds: 0,
    // 禁用/限制
    disableUse: 0,
    lifeFullToUse: 0,
    disableMoveMilliseconds: 0,
    disableSkillMilliseconds: 0,
    // 副作用/恢复
    sideEffectProbability: 0,
    sideEffectPercent: 0,
    sideEffectType: 0,
    restoreProbability: 0,
    restorePercent: 0,
    restoreType: 0,
    dieAfterUse: 0,
    // 基础属性加成
    lifeMax: 0,
    thewMax: 0,
    manaMax: 0,
    attack: 0,
    attack2: 0,
    attack3: 0,
    defend: 0,
    defend2: 0,
    defend3: 0,
    evade: 0,
    // 恢复速度加成
    addLifeRestorePercent: 0,
    addManaRestorePercent: 0,
    addThewRestorePercent: 0,
    // 寄生
    parasitic: 0,
    parasiticMagic: null,
    parasiticInterval: 1000,
    parasiticMaxEffect: 0,
    // 跳跃
    leapTimes: 0,
    leapFrame: 0,
    effectReducePercentage: 0,
    leapImage: null,
    jumpToTarget: 0,
    jumpMoveSpeed: 32,
    // 复活尸体
    reviveBodyRadius: 0,
    reviveBodyMaxCount: 0,
    reviveBodyLifeMilliSeconds: 0,
    // 连击
    hitCountToChangeMagic: 0,
    hitCountFlyRadius: 0,
    hitCountFlyAngleSpeed: 0,
    hitCountFlyingImage: null,
    hitCountVanishImage: null,
    // 关联武功
    explodeMagicFile: null,
    flyMagic: null,
    flyInterval: 0,
    flyIni: null,
    flyIni2: null,
    randMagicFile: null,
    randMagicProbability: 0,
    secondMagicFile: null,
    secondMagicDelay: 0,
    magicToUseWhenKillEnemy: null,
    magicDirectionWhenKillEnemy: 0,
    changeMagic: null,
    jumpEndMagic: null,
    magicToUseWhenBeAttacked: null,
    magicDirectionWhenBeAttacked: 0,
    magicWhenNewPos: null,
    replaceMagic: null,
    specialKind9ReplaceFlyIni: null,
    specialKind9ReplaceFlyIni2: null,
    // 震屏
    vibratingScreen: 0,
    // NPC/资源
    npcFile: null,
    npcIni: null,
    useActionFile: null,
    regionFile: null,
    goodsName: null,
    type: null,
  };
}

// ========== MoveKind 标签 ==========

export const MagicMoveKindLabels: Record<MagicMoveKind, string> = {
  NoMove: "不移动",
  FixedPosition: "固定位置",
  SingleMove: "单体飞行",
  LineMove: "直线多发",
  CircleMove: "圆形扩散",
  HeartMove: "心形移动",
  SpiralMove: "螺旋移动",
  SectorMove: "扇形发射",
  RandomSector: "随机扇形",
  FixedWall: "固定墙",
  WallMove: "墙体移动",
  RegionBased: "区域类型",
  FollowCharacter: "跟随自身",
  SuperMode: "超级模式",
  FollowEnemy: "跟随敌人",
  Throw: "投掷",
  Kind19: "持续留痕",
  Transport: "传送",
  PlayerControl: "玩家控制",
  Summon: "召唤NPC",
  TimeStop: "时间停止",
  VMove: "V字移动",
};

export const MagicSpecialKindLabels: Record<MagicSpecialKind, string> = {
  None: "无",
  AddLifeOrFrozen: "加生命/冰冻",
  AddThewOrPoison: "加体力/中毒",
  BuffOrPetrify: "持续效果/石化",
  InvisibleHide: "隐身(攻击消失)",
  InvisibleShow: "隐身(攻击可见)",
  Buff: "持续效果",
  ChangeCharacter: "变身",
  RemoveAbnormal: "解除异常",
  ChangeFlyIni: "改变飞行",
};
