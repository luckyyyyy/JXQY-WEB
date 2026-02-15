/**
 * Direction calculation utilities
 * 方向计算工具
 *
 * Utils.GetDirection8List, Utils.GetDirection32List
 * 方向从 South (0,1) 开始，顺时针 0-7 (8方向) 或 0-31 (32方向)
 */
import type { Direction, Vector2 } from "../core/types";
import { vectorLength } from "./math";

// ========== 8方向偏移常量 ==========

/**
 * 8方向像素偏移（用于计算目标位置）
 * 返回的向量 * 某个距离
 * 方向从 South 开始，顺时针 0-7
 */
const DIRECTION_PIXEL_OFFSETS: readonly Vector2[] = [
  { x: 0, y: 32 }, // 0: South
  { x: -23, y: 23 }, // 1: SouthWest (约 32 * 0.707)
  { x: -32, y: 0 }, // 2: West
  { x: -23, y: -23 }, // 3: NorthWest
  { x: 0, y: -32 }, // 4: North
  { x: 23, y: -23 }, // 5: NorthEast
  { x: 32, y: 0 }, // 6: East
  { x: 23, y: 23 }, // 7: SouthEast
];

/**
 * 8方向瓦片偏移（用于查找相邻瓦片）
 * 方向从 South 开始，顺时针 0-7
 */
const DIRECTION_TILE_OFFSETS: readonly Vector2[] = [
  { x: 0, y: 1 }, // 0: South
  { x: -1, y: 1 }, // 1: SouthWest
  { x: -1, y: 0 }, // 2: West
  { x: -1, y: -1 }, // 3: NorthWest
  { x: 0, y: -1 }, // 4: North
  { x: 1, y: -1 }, // 5: NorthEast
  { x: 1, y: 0 }, // 6: East
  { x: 1, y: 1 }, // 7: SouthEast
];

// ========== 方向索引计算 ==========

/**
 * 获取方向索引 (支持任意方向数)
 * @param direction 方向向量
 * @param directionCount 方向数量 (通常为 8 或 32)
 * @returns 方向索引 (0 到 directionCount-1)
 */
export function getDirectionIndex(direction: Vector2, directionCount: number): number {
  if (
    (direction.x === 0 && direction.y === 0) ||
    directionCount < 1 ||
    !Number.isFinite(direction.x) ||
    !Number.isFinite(direction.y)
  )
    return 0;

  const TWO_PI = Math.PI * 2;

  // Normalize
  const length = vectorLength(direction);
  const normX = direction.x / length;
  const normY = direction.y / length;

  // Calculate angle from South (0, 1) - matches Vector2.Dot(direction, new Vector2(0, 1))
  // acos returns 0 when direction is (0,1), PI when direction is (0,-1)
  let angle = Math.acos(normY);
  // if (direction.X > 0) angle = twoPi - angle;
  if (normX > 0) angle = TWO_PI - angle;

  // 2*PI / (2*directionCount) = PI / directionCount
  const halfAnglePerDirection = Math.PI / directionCount;
  let region = Math.floor(angle / halfAnglePerDirection);
  if (region % 2 !== 0) region++;
  region %= 2 * directionCount;
  return region / 2;
}

/**
 * Get direction from one tile to another (8 directions)
 * This implementation matches Utils.GetDirectionIndex
 */
export function getDirection(from: Vector2, to: Vector2): Direction {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  return getDirectionFromVector({ x: dx, y: dy });
}

/**
 * Get 8-direction index from a direction vector
 * Direction 0 points South (down), clockwise
 * Reference: Utils.GetDirectionIndex()
 */
export function getDirectionFromVector(direction: Vector2): Direction {
  return getDirectionIndex(direction, 8) as Direction;
}

/**
 * Get direction vector for movement
 * 获取方向对应的移动向量
 * 方向从 South (0,1) 开始，顺时针 0-7
 */
export function getDirectionVector(direction: Direction): Vector2 {
  // 与 getDirection8 / DIRECTION_TILE_OFFSETS 一致
  return DIRECTION_TILE_OFFSETS[direction] || { x: 0, y: 1 };
}

// ========== 8方向和32方向向量 ==========

/**
 * 获取8方向向量（归一化）
 * Reference: Utils.GetDirection8List()
 * 方向从 South 开始，顺时针
 */
export function getDirection8(index: number): Vector2 {
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
 * Reference: Utils.GetDirection32List()
 * 重要：原版使用 (-sin, cos) 而不是 (cos, sin)
 * 这使得 index=0 指向 South (0, 1)，顺时针旋转
 */
export function getDirection32List(): Vector2[] {
  const list: Vector2[] = [];
  const angle = (Math.PI * 2) / 32;
  for (let i = 0; i < 32; i++) {
    list.push({
      x: -Math.sin(angle * i),
      y: Math.cos(angle * i),
    });
  }
  return list;
}

// ========== 方向偏移获取 ==========

/**
 * 获取8方向像素偏移
 * @param directionIndex 方向索引 (0-7, South 开始顺时针)
 * @returns 像素偏移向量
 */
export function getDirectionPixelOffset(directionIndex: number): Vector2 {
  return DIRECTION_PIXEL_OFFSETS[directionIndex % 8];
}

/**
 * 获取8方向瓦片偏移
 * @param directionIndex 方向索引 (0-7, South 开始顺时针)
 * @returns 瓦片偏移向量
 */
export function getDirectionTileOffset(directionIndex: number): Vector2 {
  return DIRECTION_TILE_OFFSETS[directionIndex % 8];
}

/**
 * 根据方向计算目标像素位置
 * @param origin 起始位置
 * @param directionIndex 方向索引 (0-7)
 * @returns 目标位置（origin + 偏移）
 */
export function getPositionInDirection(origin: Vector2, directionIndex: number): Vector2 {
  const offset = getDirectionPixelOffset(directionIndex);
  return {
    x: origin.x + offset.x,
    y: origin.y + offset.y,
  };
}

/**
 * 根据方向查找相邻瓦片
 * @param tile 当前瓦片坐标
 * @param directionIndex 方向索引 (0-7)
 * @returns 相邻瓦片坐标
 */
export function getNeighborTileInDirection(tile: Vector2, directionIndex: number): Vector2 {
  const offset = getDirectionTileOffset(directionIndex);
  return {
    x: tile.x + offset.x,
    y: tile.y + offset.y,
  };
}

/**
 * 获取8方向偏移（用于墙类武功）
 * 根据方向索引返回用于创建武功墙的偏移量
 */
export function getDirectionOffset8(direction: Vector2): Vector2 {
  const directionIndex = getDirectionIndex(direction, 8);
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

/**
 * 获取V字移动的偏移
 * uses origin - i * offset
 * 方向 0 = South (下)
 */
export function getVOffsets(directionIndex: number): Vector2[] {
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
