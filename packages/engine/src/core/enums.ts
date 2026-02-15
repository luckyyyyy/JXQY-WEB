/**
 * Core enums used broadly across engine modules (sprite, runtime, script, magic, etc.)
 */

export enum CharacterState {
  Stand = 0,
  Stand1 = 1,
  Walk = 2,
  Run = 3,
  Jump = 4,
  FightStand = 5,
  FightWalk = 6,
  FightRun = 7,
  FightJump = 8,
  Attack = 9,
  Attack1 = 10,
  Attack2 = 11,
  Magic = 12,
  Hurt = 13,
  Death = 14,
  Sit = 15,
  Special = 16,
}

/**
 * 8方向枚举，从 South 开始顺时针
 * 与原版 C# 一致：direction 0 = (0,1) = South
 */
export enum Direction {
  South = 0,
  SouthWest = 1,
  West = 2,
  NorthWest = 3,
  North = 4,
  NorthEast = 5,
  East = 6,
  SouthEast = 7,
}
