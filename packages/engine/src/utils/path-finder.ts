/**
 * Path utilities — tile geometry, direction walking, ball bouncing
 *
 * A* / greedy / straight-line pathfinding has been moved to Rust WASM.
 * See: packages/engine-wasm/src/pathfinder.rs + wasm/wasm-path-finder.ts
 *
 * This file retains:
 * - PathType enum (used by many modules)
 * - canMoveInDirection (direction constraint check)
 * - findNeighborInDirection / findDistanceTileInDirection
 * - bouncingAtPoint / bouncingAtWall (MagicSprite reflection)
 * - findPathInDirection (greedy direction-walk fallback, uses TS obstacle callbacks)
 */

import type { Vector2 } from "../core/types";
import { getDirectionFromVector, getNeighbors, tileToPixel, vectorLength } from "./";

/**
 * PathFinder.PathType enum
 */
export enum PathType {
  PathOneStep = 0, // Simple greedy, ~10 steps
  SimpleMaxNpcTry = 1, // Greedy best-first, maxTry=100
  PerfectMaxNpcTry = 2, // A* for NPC, maxTry=100
  PerfectMaxPlayerTry = 3, // A* for player, maxTry=500
  PathStraightLine = 4, // Direct line, ignores obstacles
  End = 5, // Use character's default PathType
}

/**
 * Check if can move in a specific direction given canMoveDirectionCount
 */
export function canMoveInDirection(direction: number, canMoveDirectionCount: number): boolean {
  // Direction layout:
  // 3  4  5
  // 2     6
  // 1  0  7
  switch (canMoveDirectionCount) {
    case 1:
      return direction === 0;
    case 2:
      return direction === 0 || direction === 4;
    case 4:
      return direction === 0 || direction === 2 || direction === 4 || direction === 6;
    default:
      return direction < canMoveDirectionCount;
  }
}

/**
 * Get obstacle index list for diagonal blocking (used by findPathInDirection)
 *
 * Direction layout:
 * 3  4  5
 * 2     6
 * 1  0  7
 */
function getObstacleIndexList(
  neighbors: Vector2[],
  isObstacle: (tile: Vector2) => boolean,
  isHardObstacle: (tile: Vector2) => boolean
): Set<number> {
  const removeList = new Set<number>();

  for (let i = 0; i < neighbors.length; i++) {
    if (isObstacle(neighbors[i])) {
      removeList.add(i);

      if (isHardObstacle(neighbors[i])) {
        switch (i) {
          case 1:
            removeList.add(0);
            removeList.add(2);
            break;
          case 3:
            removeList.add(2);
            removeList.add(4);
            break;
          case 5:
            removeList.add(4);
            removeList.add(6);
            break;
          case 7:
            removeList.add(0);
            removeList.add(6);
            break;
        }
      }
    }
  }

  return removeList;
}

/**
 * Find neighbor in a specific direction (0-7)
 */
export function findNeighborInDirection(tilePosition: Vector2, direction: number): Vector2 {
  if (direction < 0 || direction > 7) {
    return { x: 0, y: 0 };
  }
  return getNeighbors(tilePosition)[direction];
}

/**
 * Find tile at a distance in a direction
 */
export function findDistanceTileInDirection(
  tilePosition: Vector2,
  direction: Vector2,
  tileDistance: number
): Vector2 {
  if ((direction.x === 0 && direction.y === 0) || tileDistance < 1) {
    return tilePosition;
  }

  let neighbor = tilePosition;
  const dirIndex = getDirectionFromVector(direction);

  for (let i = 0; i < tileDistance; i++) {
    neighbor = findNeighborInDirection(neighbor, dirIndex);
  }

  return neighbor;
}

// ============= Ball 弹跳计算 =============

/**
 * 计算在点上弹跳后的方向
 *
 * @param direction 当前移动方向（已归一化或零向量）
 * @param worldPosition 武功当前像素位置
 * @param targetWorldPosition 碰撞目标的像素位置
 * @returns 弹跳后的方向向量
 */
export function bouncingAtPoint(
  direction: Vector2,
  worldPosition: Vector2,
  targetWorldPosition: Vector2
): Vector2 {
  // if (direction == Vector2.Zero || worldPosition == targetWorldPosition)
  //       return worldPosition - targetWorldPosition;
  if (
    (direction.x === 0 && direction.y === 0) ||
    (worldPosition.x === targetWorldPosition.x && worldPosition.y === targetWorldPosition.y)
  ) {
    return {
      x: worldPosition.x - targetWorldPosition.x,
      y: worldPosition.y - targetWorldPosition.y,
    };
  }

  // var normal = Vector2.Normalize(worldPosition - targetWorldPosition);
  //     return Vector2.Reflect(direction, normal);
  const normal = {
    x: worldPosition.x - targetWorldPosition.x,
    y: worldPosition.y - targetWorldPosition.y,
  };
  const normalLen = vectorLength(normal);

  if (normalLen === 0) {
    return { x: -direction.x, y: -direction.y };
  }

  const nx = normal.x / normalLen;
  const ny = normal.y / normalLen;

  // Vector2.Reflect: v - 2 * dot(v, n) * n
  const dot = direction.x * nx + direction.y * ny;
  return {
    x: direction.x - 2 * dot * nx,
    y: direction.y - 2 * dot * ny,
  };
}

/**
 * 计算在墙上弹跳后的方向
 *
 * @param direction 当前移动方向（已归一化或零向量）
 * @param worldPosition 武功当前像素位置
 * @param targetTilePosition 碰撞墙壁的格子位置
 * @param isMapObstacle 检查格子是否为障碍的函数
 * @returns 弹跳后的方向向量
 */
export function bouncingAtWall(
  direction: Vector2,
  worldPosition: Vector2,
  targetTilePosition: Vector2,
  isMapObstacle: (tile: Vector2) => boolean
): Vector2 {
  // if (direction == Vector2.Zero) return direction;
  if (direction.x === 0 && direction.y === 0) {
    return { ...direction };
  }

  // var dir = Utils.GetDirectionIndex(direction, 8);
  const dirIndex = getDirectionFromVector(direction);

  // var checks = new[]{(dir + 2)%8, (dir + 6)%8, (dir + 1)%8, (dir + 7)%8};
  const checks = [(dirIndex + 2) % 8, (dirIndex + 6) % 8, (dirIndex + 1) % 8, (dirIndex + 7) % 8];

  // var neighbors = FindAllNeighbors(targetTilePosition);
  const neighbors = getNeighbors(targetTilePosition);

  // Find which neighbor is an obstacle
  let foundIndex = 8;
  for (const checkDir of checks) {
    if (isMapObstacle(neighbors[checkDir])) {
      foundIndex = checkDir;
      break;
    }
  }

  // if (get == 8) return BouncingAtPoint(direction, worldPosition, MapBase.ToPixelPosition(targetTilePosition));
  if (foundIndex === 8) {
    const targetPixel = tileToPixel(targetTilePosition.x, targetTilePosition.y);
    return bouncingAtPoint(direction, worldPosition, targetPixel);
  }

  const targetPixel = tileToPixel(targetTilePosition.x, targetTilePosition.y);
  const neighborPixel = tileToPixel(neighbors[foundIndex].x, neighbors[foundIndex].y);

  const diffX = targetPixel.x - neighborPixel.x;
  const diffY = targetPixel.y - neighborPixel.y;

  // Rotate 90 degrees: (x, y) -> (-y, x)
  const normal = { x: -diffY, y: diffX };
  const normalLen = vectorLength(normal);

  if (normalLen === 0) {
    return { x: -direction.x, y: -direction.y };
  }

  const nx = normal.x / normalLen;
  const ny = normal.y / normalLen;

  // Vector2.Reflect: v - 2 * dot(v, n) * n
  const dot = direction.x * nx + direction.y * ny;
  return {
    x: direction.x - 2 * dot * nx,
    y: direction.y - 2 * dot * ny,
  };
}

/**
 * Find a path by walking in the direction from start to target.
 * Returns both the path and the destination.
 *
 * @param startTile Starting tile position (player's position)
 * @param targetTile Target tile position (clicked position, used to calculate direction)
 * @param isMapObstacle Function to check if a tile is a map obstacle
 * @param isHardObstacle Function to check if a tile is a hard obstacle (for diagonal blocking)
 * @param maxSteps Maximum steps to search (default 50)
 * @returns Object with path array and destination tile
 */
export function findPathInDirection(
  startTile: Vector2,
  targetTile: Vector2,
  isMapObstacle: (tile: Vector2) => boolean,
  isHardObstacle: (tile: Vector2) => boolean,
  maxSteps: number = 50
): { path: Vector2[]; destination: Vector2 | null } {
  if (startTile.x === targetTile.x && startTile.y === targetTile.y) {
    return { path: [], destination: null };
  }

  // 计算从起点到目标的主方向
  const startPixel = tileToPixel(startTile.x, startTile.y);
  const targetPixel = tileToPixel(targetTile.x, targetTile.y);

  const mainDirection = getDirectionFromVector({
    x: targetPixel.x - startPixel.x,
    y: targetPixel.y - startPixel.y,
  });

  // 从玩家位置开始，沿目标方向尽可能走远
  // 当主方向被阻挡时，尝试相邻方向（优先靠近主方向的）
  let currentTile = startTile;
  const path: Vector2[] = [{ ...startTile }]; // 路径包含起点
  let stepsWithoutProgress = 0;
  const maxStepsWithoutProgress = 5; // 连续5步无法前进就停止

  for (let step = 0; step < maxSteps && stepsWithoutProgress < maxStepsWithoutProgress; step++) {
    const neighbors = getNeighbors(currentTile);

    // 使用 getObstacleIndexList 来正确处理对角阻挡
    // 这防止穿墙：如果对角方向是硬障碍物，会阻挡相邻的直线方向
    const blockedDirections = getObstacleIndexList(neighbors, isMapObstacle, isHardObstacle);

    // 按方向优先级尝试：主方向 → 左偏1 → 右偏1 → 左偏2 → 右偏2
    const directionsToTry = [
      mainDirection,
      (mainDirection + 7) % 8, // 左偏1（顺时针为正，所以-1等于+7）
      (mainDirection + 1) % 8, // 右偏1
      (mainDirection + 6) % 8, // 左偏2
      (mainDirection + 2) % 8, // 右偏2
    ];

    let moved = false;
    for (const dir of directionsToTry) {
      // 检查方向是否被阻挡（包括对角阻挡规则）
      if (!blockedDirections.has(dir)) {
        const nextTile = neighbors[dir];
        currentTile = nextTile;
        path.push({ ...nextTile });
        moved = true;
        stepsWithoutProgress = 0;
        break;
      }
    }

    if (!moved) {
      stepsWithoutProgress++;

      // 如果主方向和相邻方向都不通，尝试更大范围的偏转
      // 这处理了需要稍微绕一下的情况
      const widerDirections = [
        (mainDirection + 5) % 8, // 左偏3
        (mainDirection + 3) % 8, // 右偏3
      ];

      for (const dir of widerDirections) {
        if (!blockedDirections.has(dir)) {
          const nextTile = neighbors[dir];
          currentTile = nextTile;
          path.push({ ...nextTile });
          stepsWithoutProgress = 0;
          break;
        }
      }
    }
  }

  // 如果路径长度大于1（不只有起点），说明我们找到了可走的点
  if (path.length > 1) {
    const destination = path[path.length - 1];
    return { path, destination };
  }

  return { path: [], destination: null };
}
