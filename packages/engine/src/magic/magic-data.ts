/**
 * Magic Data Interfaces — core data shapes for the magic system
 *
 * Based on JxqyHD Engine/Magic.cs
 * Extracted from magic/types.ts for focused imports.
 */

import type { Vector2 } from "../core/types";
import type {
  MagicAddonEffect,
  MagicMoveKind,
  MagicSpecialKind,
  RestorePropertyType,
  SideEffectDamageType,
} from "./magic-enums";

/**
 * 武功数据类的核心属性
 */
export interface MagicData {
  // 基础信息
  fileName: string; // 文件名
  name: string; // 武功名称
  intro: string; // 武功介绍
  type?: string; // 类型

  // 运动属性
  speed: number; // 速度
  moveKind: MagicMoveKind; // 移动类型
  region: number; // 区域

  // 特效属性
  specialKind: MagicSpecialKind; // 特殊效果
  specialKindValue: number; // 特殊效果值
  specialKindMilliSeconds: number; // 特殊效果持续时间
  noSpecialKindEffect: number; // 禁用特效动画
  alphaBlend: number; // 透明混合
  flyingLum: number; // 飞行亮度
  vanishLum: number; // 消失亮度

  // 图像资源
  image?: string; // 武功图像
  icon?: string; // 图标
  flyingImage?: string; // 飞行图像
  vanishImage?: string; // 消失图像
  superModeImage?: string; // 超级模式图像
  leapImage?: string; // 跳跃图像
  useActionFile?: string; // 使用动作文件
  hitCountFlyingImage?: string; // 连击飞行图像
  hitCountVanishImage?: string; // 连击消失图像

  // 声音资源
  flyingSound?: string; // 飞行声音
  vanishSound?: string; // 消失声音

  // 帧相关
  waitFrame: number; // 等待帧数
  lifeFrame: number; // 生命帧数

  // 从属关系
  belong: number; // 从属
  actionFile?: string; // 动作文件
  attackFile?: string; // 攻击文件

  // 关联武功
  explodeMagicFile?: string; // 爆炸武功
  randMagicFile?: string; // 随机武功
  randMagicProbability: number; // 随机武功概率
  flyMagic?: string; // 飞行武功
  flyInterval: number; // 飞行间隔
  secondMagicFile?: string; // 第二武功
  secondMagicDelay: number; // 第二武功延迟
  magicToUseWhenKillEnemy?: string; // 杀敌时使用的武功
  magicDirectionWhenKillEnemy: number; // 杀敌武功方向
  bounceFlyEndMagic?: string; // 弹飞结束武功
  magicDirectionWhenBounceFlyEnd: number; // 弹飞结束武功方向
  changeMagic?: string; // 变化武功
  parasiticMagic?: string; // 寄生武功
  jumpEndMagic?: string; // 跳跃结束武功
  regionFile?: string; // 区域文件
  magicToUseWhenBeAttacked?: string; // 被攻击时使用的武功
  magicDirectionWhenBeAttacked: number; // 被攻击武功方向
  magicWhenNewPos?: string; // 新位置武功
  replaceMagic?: string; // 替换武功

  // 效果值
  effect: number; // 主效果 - 伤害/治疗量
  effect2: number; // 效果2
  effect3: number; // 效果3
  effectExt: number; // 效果扩展
  effectMana: number; // 内力效果

  // 消耗
  manaCost: number; // 内力消耗
  thewCost: number; // 体力消耗
  lifeCost: number; // 生命消耗

  // 升级
  levelupExp: number; // 升级所需经验
  currentLevel: number; // 当前等级
  effectLevel: number; // 效果等级
  maxLevel: number; // 最大等级

  // 冷却
  coldMilliSeconds: number; // 冷却时间
  keepMilliseconds: number; // 保持时间
  changeToFriendMilliseconds: number; // 转友时间

  // 计数
  count: number; // 数量
  maxCount: number; // 最大数量

  // 杂项标志
  passThrough: number; // 穿透
  passThroughWithDestroyEffect: number; // 穿透带销毁特效
  passThroughWall: number; // 穿墙
  attackAll: number; // 攻击全部
  noInterruption: number; // 不打断
  vibratingScreen: number; // 震屏
  bodyRadius: number; // 身体半径
  solid: number; // 实体
  noExplodeWhenLifeFrameEnd: number; // 生命结束不爆炸
  explodeWhenLifeFrameEnd: number; // 生命结束爆炸
  discardOppositeMagic: number; // 抵消对方武功
  exchangeUser: number; // 交换使用者

  // 起始位置
  beginAtMouse: number; // 从鼠标位置开始
  beginAtUser: number; // 从使用者位置开始
  beginAtUserAddDirectionOffset: number; // 从使用者位置加方向偏移开始
  beginAtUserAddUserDirectionOffset: number; // 从使用者位置加使用者方向偏移开始

  // 移动相关
  randomMoveDegree: number; // 随机移动角度
  followMouse: number; // 跟随鼠标
  meteorMove: number; // 流星移动
  meteorMoveDir: number; // 流星移动方向
  moveBack: number; // 后退移动
  moveImitateUser: number; // 模仿使用者移动

  // 圆周运动
  circleMoveClockwise: number; // 顺时针圆周移动
  circleMoveAnticlockwise: number; // 逆时针圆周移动
  roundMoveClockwise: number; // 顺时针圆形移动
  roundMoveAnticlockwise: number; // 逆时针圆形移动
  roundMoveCount: number; // 圆形移动数量
  roundMoveDegreeSpeed: number; // 圆形移动角速度
  roundRadius: number; // 圆形半径

  // 携带使用者
  carryUser: number; // 携带使用者
  carryUserSpriteIndex: number; // 携带使用者精灵索引
  hideUserWhenCarry: number; // 携带时隐藏使用者

  // 弹跳相关
  bounce: number; // 弹跳
  bounceHurt: number; // 弹跳伤害
  ball: number; // 球
  bounceFly: number; // 弹飞
  bounceFlySpeed: number; // 弹飞速度
  bounceFlyEndHurt: number; // 弹飞结束伤害
  bounceFlyTouchHurt: number; // 弹飞触碰伤害
  sticky: number; // 粘附

  // 跟踪属性
  traceEnemy: number; // 追踪敌人
  traceSpeed: number; // 追踪速度
  traceEnemyDelayMilliseconds: number; // 追踪延迟

  // 禁用属性
  disableUse: number; // 禁用使用
  lifeFullToUse: number; // 满生命使用
  disableMoveMilliseconds: number; // 禁用移动时间
  disableSkillMilliseconds: number; // 禁用技能时间

  // 附加效果
  additionalEffect: MagicAddonEffect; // 附加效果

  // 副作用
  sideEffectProbability: number; // 副作用概率
  sideEffectPercent: number; // 副作用百分比
  sideEffectType: SideEffectDamageType; // 副作用类型

  // 恢复
  restoreProbability: number; // 恢复概率
  restorePercent: number; // 恢复百分比
  restoreType: RestorePropertyType; // 恢复类型
  dieAfterUse: number; // 使用后死亡

  // 寄生
  parasitic: number; // 寄生
  parasiticInterval: number; // 寄生间隔
  parasiticMaxEffect: number; // 寄生最大效果

  // 范围效果
  rangeEffect: number; // 范围效果
  rangeAddLife: number; // 范围加生命
  rangeAddMana: number; // 范围加内力
  rangeAddThew: number; // 范围加体力
  rangeSpeedUp: number; // 范围加速
  rangeFreeze: number; // 范围冰冻
  rangePoison: number; // 范围中毒
  rangePetrify: number; // 范围石化
  rangeDamage: number; // 范围伤害
  rangeRadius: number; // 范围半径
  rangeTimeInterval: number; // 范围时间间隔

  // 属性加成
  attackAddPercent: number; // 攻击加成百分比
  defendAddPercent: number; // 防御加成百分比
  evadeAddPercent: number; // 闪避加成百分比
  speedAddPercent: number; // 速度加成百分比

  // 变身
  morphMilliseconds: number; // 变身时间

  // 虚弱
  weakMilliseconds: number; // 虚弱时间
  weakAttackPercent: number; // 虚弱攻击百分比
  weakDefendPercent: number; // 虚弱防御百分比

  // 致盲
  blindMilliseconds: number; // 致盲时间

  // SpecialKind=9 飞行ini替换
  specialKind9ReplaceFlyIni?: string;
  specialKind9ReplaceFlyIni2?: string;

  // 跳跃
  leapTimes: number; // 跳跃次数
  leapFrame: number; // 跳跃帧
  effectReducePercentage: number; // 效果减少百分比

  // 复活尸体
  reviveBodyRadius: number; // 复活尸体半径
  reviveBodyMaxCount: number; // 复活尸体最大数量
  reviveBodyLifeMilliSeconds: number; // 复活尸体存活时间

  // NPC 相关
  npcFile?: string; // NPC 文件
  npcIni?: string; // NPC 配置

  // 跳跃到目标
  jumpToTarget: number; // 跳跃到目标
  jumpMoveSpeed: number; // 跳跃移动速度

  // 恢复加成
  addThewRestorePercent: number; // 体力恢复加成百分比
  addManaRestorePercent: number; // 内力恢复加成百分比
  addLifeRestorePercent: number; // 生命恢复加成百分比

  // 连击变化
  hitCountToChangeMagic: number; // 连击变化所需次数
  hitCountFlyRadius: number; // 连击飞行半径
  hitCountFlyAngleSpeed: number; // 连击飞行角速度

  // 基础属性加成
  lifeMax: number; // 生命上限加成
  thewMax: number; // 体力上限加成
  manaMax: number; // 内力上限加成
  attack: number; // 攻击加成
  defend: number; // 防御加成
  evade: number; // 闪避加成
  attack2: number; // 攻击2加成
  defend2: number; // 防御2加成
  attack3: number; // 攻击3加成
  defend3: number; // 防御3加成

  // 飞行配置
  flyIni?: string; // 飞行ini
  flyIni2?: string; // 飞行ini2

  // 物品
  goodsName?: string; // 物品名称

  // 等级数据 (用于不同等级的武功)
  levels?: Map<number, Partial<MagicData>>;
}

/**
 * 武功列表项信息
 */
export interface MagicItemInfo {
  magic: MagicData | null; // 武功数据
  level: number; // 等级
  exp: number; // 经验值
  remainColdMilliseconds: number; // 剩余冷却时间
  hideCount: number; // 隐藏计数
  lastIndexWhenHide: number; // 隐藏时的索引
}

/**
 * 武功使用参数
 */
export interface UseMagicParams {
  userId: string; // 使用者ID
  magic: MagicData; // 武功数据
  origin: Vector2; // 起点
  destination: Vector2; // 终点
  targetId?: string; // 目标ID
}

/**
 * Kind19 武功信息 - 持续留痕武功
 * 角色移动时在原位置留下武功痕迹，持续一段时间后消失
 */
export interface Kind19MagicInfo {
  /** 剩余持续时间（毫秒） */
  keepMilliseconds: number;
  /** 武功数据 */
  magic: MagicData;
  /** 所属角色 ID */
  belongCharacterId: string;
  /** 上一次的瓦片位置 */
  lastTilePosition: Vector2;
}
