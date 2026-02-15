/**
 * Math utilities
 * 数学工具函数
 */
import type { Vector2 } from "../core/types";

/**
 * Linear interpolation between two values
 * 线性插值
 */
export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/**
 * Clamp value between min and max
 * 限制值在范围内
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * Calculate vector length
 * 计算向量长度
 */
export function vectorLength(v: Vector2): number {
  return Math.sqrt(v.x * v.x + v.y * v.y);
}

/**
 * Normalize vector to unit length
 * 归一化向量
 */
export function normalizeVector(v: Vector2): Vector2 {
  const len = vectorLength(v);
  if (len === 0) return { x: 0, y: 0 };
  return { x: v.x / len, y: v.y / len };
}

/**
 * 计算速度比率（用于斜向移动时的等视速度补偿）
 * @param direction 归一化的方向向量
 * @returns 速度比率 (0.5 到 1.0)
 */
export function getSpeedRatio(direction: Vector2): number {
  // 根据Y方向调整速度，使45度方向看起来速度一致
  return 1 - 0.5 * Math.abs(direction.y);
}

/**
 * Rectangle type for collision detection
 */
export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Check if two rectangles intersect (AABB collision)
 * / Rectangle.Intersects
 */
export function isBoxCollide(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}

/**
 * Generate unique ID
 * 生成唯一 ID
 */
export function generateId(): string {
  return crypto.randomUUID();
}
