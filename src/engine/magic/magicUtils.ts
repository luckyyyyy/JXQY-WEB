/**
 * MagicUtils - 武功系统辅助函数
 * 提取自 MagicManager，对应 C# Utils.cs 中的方向计算等
 */

import type { Vector2 } from "../core/types";

// 全局常量 - 对应 C# Globals
export const MAGIC_BASE_SPEED = 100; // C#: Globals.MagicBasespeed = 100

/**
 * 向量归一化
 */
export function normalizeVector(v: Vector2): Vector2 {
  const len = Math.sqrt(v.x * v.x + v.y * v.y);
  if (len === 0) return { x: 0, y: 0 };
  return { x: v.x / len, y: v.y / len };
}

/**
 * 获取方向索引 (8方向或其他)
 * C# Reference: Utils.GetDirectionIndex
 * 方向从 South (0,1) 开始，顺时针 0-7
 */
export function getDirectionIndex(direction: Vector2, directionCount: number): number {
  if ((direction.x === 0 && direction.y === 0) || directionCount < 1) return 0;

  const TWO_PI = Math.PI * 2;

  // Normalize
  const length = Math.sqrt(direction.x * direction.x + direction.y * direction.y);
  const normX = direction.x / length;
  const normY = direction.y / length;

  // Calculate angle from South (0, 1) - matches C# Vector2.Dot(direction, new Vector2(0, 1))
  // acos returns 0 when direction is (0,1), PI when direction is (0,-1)
  let angle = Math.acos(normY);
  // C#: if (direction.X > 0) angle = twoPi - angle;
  if (normX > 0) angle = TWO_PI - angle;

  // 2*PI / (2*directionCount) = PI / directionCount
  const halfAnglePerDirection = Math.PI / directionCount;
  let region = Math.floor(angle / halfAnglePerDirection);
  if (region % 2 !== 0) region++;
  region %= 2 * directionCount;
  return region / 2;
}

/**
 * 获取8方向向量
 * C# Reference: Utils.GetDirection8List()
 * 方向从 South 开始，顺时针
 */
export function getDirection8(index: number): Vector2 {
  // C# direction list (normalized):
  // 0: (0, 1)    South
  // 1: (-1, 1)   Southwest (normalized: -0.707, 0.707)
  // 2: (-1, 0)   West
  // 3: (-1, -1)  Northwest (normalized: -0.707, -0.707)
  // 4: (0, -1)   North
  // 5: (1, -1)   Northeast (normalized: 0.707, -0.707)
  // 6: (1, 0)    East
  // 7: (1, 1)    Southeast (normalized: 0.707, 0.707)
  const sqrt2 = Math.SQRT1_2; // 1/sqrt(2)
  const directions: Vector2[] = [
    { x: 0, y: 1 }, // 0: South
    { x: -sqrt2, y: sqrt2 }, // 1: Southwest
    { x: -1, y: 0 }, // 2: West
    { x: -sqrt2, y: -sqrt2 }, // 3: Northwest
    { x: 0, y: -1 }, // 4: North
    { x: sqrt2, y: -sqrt2 }, // 5: Northeast
    { x: 1, y: 0 }, // 6: East
    { x: sqrt2, y: sqrt2 }, // 7: Southeast
  ];
  return directions[index % 8];
}

/**
 * 获取32方向列表
 * C# Reference: Utils.GetDirection32List()
 * 重要：C# 使用 (-sin, cos) 而不是 (cos, sin)
 * 这使得 index=0 指向 South (0, 1)，顺时针旋转
 */
export function getDirection32List(): Vector2[] {
  const list: Vector2[] = [];
  const angle = (Math.PI * 2) / 32;
  for (let i = 0; i < 32; i++) {
    // C#: new Vector2((float)-Math.Sin(angle * i), (float)Math.Cos(angle * i))
    list.push({
      x: -Math.sin(angle * i),
      y: Math.cos(angle * i),
    });
  }
  return list;
}

/**
 * 计算速度比率（用于斜向移动）
 * C# Reference: MagicManager.GetSpeedRatio
 */
export function getSpeedRatio(direction: Vector2): number {
  // 根据Y方向调整速度，使45度方向看起来速度一致
  return 1 - 0.5 * Math.abs(direction.y);
}

/**
 * 获取V字移动的偏移
 * C# Reference: AddVMoveMagicSprite uses origin - i * offset
 * 我们使用 origin + offset * i，所以这里取反
 * 方向 0 = South (下)
 */
export function getVOffsets(directionIndex: number): Vector2[] {
  // C# offsets (negated because C# uses subtraction):
  // case 0: origin - new Vector2(32, 16), origin - new Vector2(-32, 16)
  // We use addition, so negate: (-32, -16), (32, -16)
  const offsets: Vector2[][] = [
    [
      { x: -32, y: -16 },
      { x: 32, y: -16 },
    ], // 0: South - V形两翼在上方
    [
      { x: 0, y: -32 },
      { x: 64, y: 0 },
    ], // 1: Southwest
    [
      { x: 32, y: -16 },
      { x: 32, y: 16 },
    ], // 2: West
    [
      { x: 0, y: 32 },
      { x: 64, y: 0 },
    ], // 3: Northwest
    [
      { x: -32, y: 16 },
      { x: 32, y: 16 },
    ], // 4: North - V形两翼在下方
    [
      { x: -64, y: 0 },
      { x: 0, y: 32 },
    ], // 5: Northeast
    [
      { x: -32, y: -16 },
      { x: -32, y: 16 },
    ], // 6: East
    [
      { x: -64, y: 0 },
      { x: 0, y: -32 },
    ], // 7: Southeast
  ];
  return offsets[directionIndex] || offsets[0];
}

/**
 * 获取8方向偏移（用于墙类武功）
 * C# Reference: MagicManager.GetDirectionOffsetOf8
 * 根据方向索引返回用于创建武功墙的偏移量
 */
export function getDirectionOffset8(direction: Vector2): Vector2 {
  const directionIndex = getDirectionIndex(direction, 8);
  // C# 实现：
  // case 0, 4: (64, 0)
  // case 2, 6: (0, 32)
  // case 1, 5: (32, 16)
  // case 3, 7: (-32, 16)
  switch (directionIndex) {
    case 0:
    case 4:
      return { x: 64, y: 0 };
    case 2:
    case 6:
      return { x: 0, y: 32 };
    case 1:
    case 5:
      return { x: 32, y: 16 };
    case 3:
    case 7:
      return { x: -32, y: 16 };
    default:
      return { x: 64, y: 0 };
  }
}
