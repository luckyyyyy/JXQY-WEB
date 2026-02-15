/**
 * Magic Enums — movement types, special effects, and constants
 *
 * Based on JxqyHD Engine/Magic.cs
 * Extracted from magic/types.ts for focused imports.
 */

// ========== 全局常量 ==========

/**
 * 武功基础速度
 * Globals.MagicBasespeed = 100
 */
export const MAGIC_BASE_SPEED = 100;

/**
 * 武功移动类型
 * 决定武功的运动轨迹
 *
 * MagicManager.cs 中的 switch (magic.MoveKind) 参考
 */
export enum MagicMoveKind {
  NoMove = 0, // 不移动
  FixedPosition = 1, // 固定位置 (AddFixedPositionMagicSprite)
  SingleMove = 2, // 单个移动 - 向鼠标方向飞，**自由方向** (GetMoveMagicSprite)
  LineMove = 3, // 直线移动 - 多个，按等级增加数量 (AddLineMoveMagicSprite)
  CircleMove = 4, // 圆形移动 (AddCircleMoveMagicSprite)
  HeartMove = 5, // 心形移动 (AddHeartMoveMagicSprite)
  SpiralMove = 6, // 螺旋移动 (AddSpiralMoveMagicSprite)
  SectorMove = 7, // 扇形移动 (AddSectorMoveMagicSprite)
  RandomSector = 8, // 随机扇形 (AddRandomSectorMoveMagicSprite)
  FixedWall = 9, // 固定墙 (AddFixedWallMagicSprite)
  WallMove = 10, // 墙移动 (AddWallMoveMagicSprite)
  RegionBased = 11, // 区域类型 - 根据 Region 决定具体类型
  // 12 unused
  FollowCharacter = 13, // 跟随角色 (AddFollowCharacterMagicSprite)
  // 14 unused
  SuperMode = 15, // 超级模式 (AddSuperModeMagic)
  FollowEnemy = 16, // 跟随敌人 (AddFollowEnemyMagicSprite)
  Throw = 17, // 投掷 (AddThrowMagicSprite)
  // 18 empty
  Kind19 = 19, // 特殊类型19 - 持续留痕武功
  Transport = 20, // 传送
  PlayerControl = 21, // 玩家控制角色
  Summon = 22, // 召唤 NPC
  TimeStop = 23, // 时间停止 (same as FollowCharacter)
  VMove = 24, // V字移动 (AddVMoveMagicSprite)
}

/**
 * 武功特殊效果类型
 *
 * 注意：这些值在 MoveKind=13 (FollowCharacter) 时有特殊含义
 * switch (magic.SpecialKind)
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
 * 附加效果
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
