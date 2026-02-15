/**
 * Distance calculation utilities
 * 距离计算工具
 */
import type { Vector2 } from "../core/types";

/**
 * Calculate distance between two positions (Euclidean)
 * 计算两点间欧几里得距离
 */
export function distance(a: Vector2, b: Vector2): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Calculate distance from raw dx, dy deltas (avoids Vector2 allocation in hot paths)
 * 从原始 dx, dy 差值计算欧几里得距离
 */
export function distanceFromDelta(dx: number, dy: number): number {
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Squared Euclidean distance - avoids Math.sqrt for comparison-only usage
 * 平方欧几里得距离 - 仅用于距离比较时省去 sqrt
 */
export function distanceSquared(a: Vector2, b: Vector2): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  return dx * dx + dy * dy;
}

/**
 * Calculate view tile distance in isometric coordinates
 * > GetTileDistanceOff
 *
 * In isometric maps, the distance calculation must account for
 * the staggered row layout (even/odd rows have different neighbor offsets)
 *
 * This is used for vision radius, attack range, dialog radius, etc.
 */
export function getViewTileDistance(startTile: Vector2, endTile: Vector2): number {
  if (startTile.x === endTile.x && startTile.y === endTile.y) return 0;

  let startX = Math.floor(startTile.x);
  let startY = Math.floor(startTile.y);
  const endX = Math.floor(endTile.x);
  const endY = Math.floor(endTile.y);

  // If start and end tiles are not both at even row or odd row,
  // adjust the start position
  if (endY % 2 !== startY % 2) {
    // Change row to match parity
    startY += endY < startY ? 1 : -1;

    // Add column adjustment based on row parity
    if (endY % 2 === 0) {
      startX += endX > startX ? 1 : 0;
    } else {
      startX += endX < startX ? -1 : 0;
    }
  }

  const offX = Math.abs(startX - endX);
  const offY = Math.abs(startY - endY) / 2;

  return offX + offY;
}
