/**
 * PathFinder - A* and other pathfinding algorithms
 * Reference: JxqyHD/Engine/PathFinder.cs
 *
 * This module implements multiple pathfinding strategies to match
 * - PathOneStep: Simple greedy algorithm, walks ~10 steps
 * - SimpleMaxNpcTry: Greedy best-first search, maxTry=100
 * - PerfectMaxNpcTry: A* algorithm for NPCs, maxTry=100
 * - PerfectMaxPlayerTry: A* algorithm for player, maxTry=500
 * - PathStraightLine: Direct line, ignores obstacles (for flyers)
 *
 * NOTE: All functions return paths in TILE coordinates (not pixel coordinates).
 * The caller (Character.walkTo/runTo) should use these tile positions directly.
 * moveAlongPath will convert tile positions to pixel positions for rendering.
 */

import { distance, getDirectionFromVector, getNeighbors, tileToPixel } from "./";
import { logger } from "../core/logger";
import type { Vector2 } from "../core/types";

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
 * Priority queue node for pathfinding
 */
interface PathNode {
  tile: Vector2;
  priority: number;
}

/**
 * Get tile position cost using pixel distance
 */
function getTilePositionCost(fromTile: Vector2, toTile: Vector2): number {
  const fromPixel = tileToPixel(fromTile.x, fromTile.y);
  const toPixel = tileToPixel(toTile.x, toTile.y);
  return distance(fromPixel, toPixel);
}

/**
 * Get obstacle index list for diagonal blocking
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

      // if (MapBase.Instance.IsObstacle(neighborList[i]))
      // Apply diagonal blocking only for hard obstacles
      if (isHardObstacle(neighbors[i])) {
        switch (i) {
          case 1: // SouthWest → block South(0) and West(2)
            removeList.add(0);
            removeList.add(2);
            break;
          case 3: // NorthWest → block West(2) and North(4)
            removeList.add(2);
            removeList.add(4);
            break;
          case 5: // NorthEast → block North(4) and East(6)
            removeList.add(4);
            removeList.add(6);
            break;
          case 7: // SouthEast → block South(0) and East(6)
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
 * Find non-obstacle neighbors at a location
 *
 * @param location Tile position
 * @param isMapObstacle Check if tile is a map obstacle (MapBase.Instance.IsObstacleForCharacter)
 * @param isHardObstacle Check if tile is a hard obstacle (MapBase.Instance.IsObstacle)
 * @param canMoveDirectionCount How many directions the character can move (default 8)
 * @param destination Optional destination tile - always allow this tile
 */
function findNeighbors(
  location: Vector2,
  isMapObstacle: (tile: Vector2) => boolean,
  isHardObstacle: (tile: Vector2) => boolean,
  canMoveDirectionCount: number = 8,
  destination?: Vector2
): Vector2[] {
  const allNeighbors = getNeighbors(location);
  const removeList = getObstacleIndexList(allNeighbors, isMapObstacle, isHardObstacle);

  const result: Vector2[] = [];
  for (let j = 0; j < allNeighbors.length; j++) {
    // Always allow destination tile
    const isDestination =
      destination && allNeighbors[j].x === destination.x && allNeighbors[j].y === destination.y;

    if (isDestination || (!removeList.has(j) && canMoveInDirection(j, canMoveDirectionCount))) {
      result.push(allNeighbors[j]);
    }
  }

  return result;
}

/**
 * Reconstruct path from cameFrom map
 * Returns path in TILE positions (not pixel positions)
 *
 * Note: version returns pixel positions, but our TypeScript Character.moveAlongPath
 * expects tile positions and converts them internally.
 */
function getPath(cameFrom: Map<string, Vector2>, startTile: Vector2, endTile: Vector2): Vector2[] {
  const key = (v: Vector2) => `${v.x},${v.y}`;
  const endKey = key(endTile);

  if (!cameFrom.has(endKey)) {
    return [];
  }

  const path: Vector2[] = [];
  let current = endTile;
  // Return tile positions, not pixel positions
  path.unshift({ x: current.x, y: current.y });

  while (current.x !== startTile.x || current.y !== startTile.y) {
    const prev = cameFrom.get(key(current));
    if (!prev) break;
    path.unshift({ x: prev.x, y: prev.y });
    current = prev;
  }

  return path;
}

/**
 * Simple greedy step-by-step pathfinding
 *
 * Algorithm: Greedy movement towards target, preferring directions closer to target
 * Used for simple short-distance movement
 */
export function findPathStep(
  startTile: Vector2,
  endTile: Vector2,
  hasObstacle: (tile: Vector2) => boolean,
  isMapObstacle: (tile: Vector2) => boolean,
  isHardObstacle: (tile: Vector2) => boolean,
  stepCount: number = 10,
  canMoveDirectionCount: number = 8
): Vector2[] {
  if (startTile.x === endTile.x && startTile.y === endTile.y) {
    return [];
  }

  // if (MapBase.Instance.IsObstacleForCharacter(endTile)) return null;
  if (isMapObstacle(endTile)) {
    return [];
  }

  const path: Vector2[] = [];
  const visited = new Set<string>();
  const key = (v: Vector2) => `${v.x},${v.y}`;

  const endPixel = tileToPixel(endTile.x, endTile.y);
  // Return tile positions, not pixel positions
  path.push({ x: startTile.x, y: startTile.y });

  let current = startTile;
  let maxTry = 100; // For performance

  while (maxTry-- > 0) {
    const currentPixel = tileToPixel(current.x, current.y);
    const direction = getDirectionFromVector({
      x: endPixel.x - currentPixel.x,
      y: endPixel.y - currentPixel.y,
    });

    const neighbors = getNeighbors(current);
    const removeList = getObstacleIndexList(neighbors, isMapObstacle, isHardObstacle);

    // Try directions in order of preference (closest to target direction first)
    const directionOrder = [
      direction,
      (direction + 1) % 8,
      (direction + 8 - 1) % 8,
      (direction + 2) % 8,
      (direction + 8 - 2) % 8,
      (direction + 3) % 8,
      (direction + 8 - 3) % 8,
      (direction + 4) % 8,
    ];

    let foundIndex = -1;
    for (const dir of directionOrder) {
      const position = neighbors[dir];
      const posKey = key(position);

      if (removeList.has(dir) || hasObstacle(position) || visited.has(posKey)) {
        continue;
      }
      if (!canMoveInDirection(dir, canMoveDirectionCount)) {
        continue;
      }

      foundIndex = dir;
      break;
    }

    if (foundIndex === -1) {
      break;
    }

    current = neighbors[foundIndex];
    // Return tile positions, not pixel positions
    path.push({ x: current.x, y: current.y });
    visited.add(key(current));

    if (path.length > stepCount || (current.x === endTile.x && current.y === endTile.y)) {
      break;
    }
  }

  return path.length < 2 ? [] : path;
}

/**
 * Greedy best-first search (Simple)
 *
 * Algorithm: Prioritizes tiles closest to target (by heuristic only)
 * Faster but doesn't guarantee optimal path
 */
export function findPathSimple(
  startTile: Vector2,
  endTile: Vector2,
  hasObstacle: (tile: Vector2) => boolean,
  isMapObstacle: (tile: Vector2) => boolean,
  isHardObstacle: (tile: Vector2) => boolean,
  maxTry: number = 100,
  canMoveDirectionCount: number = 8
): Vector2[] {
  if (startTile.x === endTile.x && startTile.y === endTile.y) {
    return [];
  }

  if (isMapObstacle(endTile)) {
    return [];
  }

  const key = (v: Vector2) => `${v.x},${v.y}`;
  const cameFrom = new Map<string, Vector2>();
  const frontier: PathNode[] = [];

  frontier.push({ tile: startTile, priority: 0 });
  let tryCount = 0;

  while (frontier.length > 0) {
    if (tryCount++ > maxTry) break;

    // Get node with lowest priority
    frontier.sort((a, b) => a.priority - b.priority);
    const currentNode = frontier.shift();
    if (!currentNode) break;
    const current = currentNode.tile;

    if (current.x === endTile.x && current.y === endTile.y) {
      break;
    }

    // if (finder.HasObstacle(current) && current != startTile) continue;
    if ((current.x !== startTile.x || current.y !== startTile.y) && hasObstacle(current)) {
      continue;
    }

    const neighbors = findNeighbors(
      current,
      isMapObstacle,
      isHardObstacle,
      canMoveDirectionCount,
      endTile
    );

    for (const neighbor of neighbors) {
      const neighborKey = key(neighbor);
      if (!cameFrom.has(neighborKey)) {
        const priority = getTilePositionCost(neighbor, endTile);
        frontier.push({ tile: neighbor, priority });
        cameFrom.set(neighborKey, current);
      }
    }
  }

  return getPath(cameFrom, startTile, endTile);
}

/**
 * A* pathfinding algorithm (Perfect)
 *
 * Algorithm: A* with both g-cost (path so far) and h-cost (heuristic to target)
 * Guarantees optimal path if one exists
 */
export function findPathPerfect(
  startTile: Vector2,
  endTile: Vector2,
  hasObstacle: (tile: Vector2) => boolean,
  isMapObstacle: (tile: Vector2) => boolean,
  isHardObstacle: (tile: Vector2) => boolean,
  maxTryCount: number = 500,
  canMoveDirectionCount: number = 8
): Vector2[] {
  if (startTile.x === endTile.x && startTile.y === endTile.y) {
    return [];
  }

  // 检查目标位置是否是障碍物
  if (isMapObstacle(endTile)) {
    return [];
  }

  // 检查起点是否是障碍物（不应该发生，但用于调试）
  if (isMapObstacle(startTile)) {
    logger.debug(
      `[PathFinder.findPathPerfect] 起点是障碍物（异常）: startTile=(${startTile.x}, ${startTile.y})`
    );
  }

  const key = (v: Vector2) => `${v.x},${v.y}`;
  const cameFrom = new Map<string, Vector2>();
  const costSoFar = new Map<string, number>();
  const frontier: PathNode[] = [];

  frontier.push({ tile: startTile, priority: 0 });
  costSoFar.set(key(startTile), 0);

  let tryCount = 0;
  let noNeighborsCount = 0;

  // 用于调试：记录探索的边界范围
  let minX = startTile.x,
    maxX = startTile.x;
  let minY = startTile.y,
    maxY = startTile.y;
  let lastExplored: Vector2 | null = null;

  while (frontier.length > 0) {
    if (maxTryCount !== -1 && tryCount++ > maxTryCount) {
      // 计算探索范围与目标的关系
      // const exploredInTargetDirection =
      //   (endTile.y < startTile.y && minY < startTile.y) || // 目标在北，有向北探索
      //   (endTile.y > startTile.y && maxY > startTile.y) || // 目标在南，有向南探索
      //   (endTile.x < startTile.x && minX < startTile.x) || // 目标在西，有向西探索
      //   (endTile.x > startTile.x && maxX > startTile.x); // 目标在东，有向东探索

      break;
    }

    // Get node with lowest priority
    frontier.sort((a, b) => a.priority - b.priority);
    const currentNode = frontier.shift();
    if (!currentNode) break;
    const current = currentNode.tile;
    const currentKey = key(current);

    // 更新探索边界
    if (current.x < minX) minX = current.x;
    if (current.x > maxX) maxX = current.x;
    if (current.y < minY) minY = current.y;
    if (current.y > maxY) maxY = current.y;
    lastExplored = current;

    if (current.x === endTile.x && current.y === endTile.y) {
      break;
    }

    // if (finder.HasObstacle(current) && current != startTile) continue;
    if ((current.x !== startTile.x || current.y !== startTile.y) && hasObstacle(current)) {
      continue;
    }

    const neighbors = findNeighbors(
      current,
      isMapObstacle,
      isHardObstacle,
      canMoveDirectionCount,
      endTile
    );

    if (neighbors.length === 0 && tryCount <= 3) {
      noNeighborsCount++;
      logger.debug(
        `[PathFinder.findPathPerfect] 当前位置无可用邻居: current=(${current.x}, ${current.y}), tryCount=${tryCount}`
      );
    }

    for (const next of neighbors) {
      const nextKey = key(next);
      const newCost = (costSoFar.get(currentKey) ?? 0) + getTilePositionCost(current, next);

      if (!costSoFar.has(nextKey) || newCost < costSoFar.get(nextKey)!) {
        costSoFar.set(nextKey, newCost);
        const priority = newCost + getTilePositionCost(endTile, next);
        frontier.push({ tile: next, priority });
        cameFrom.set(nextKey, current);
      }
    }
  }

  const path = getPath(cameFrom, startTile, endTile);

  if (path.length === 0 && tryCount > 0) {
  }

  return path;
}

/**
 * Get straight line path (ignores obstacles)
 *
 * Used for flying characters that can move through obstacles
 * Always returns tile positions (the tilePosition param is ignored for consistency)
 */
export function getLinePath(startTile: Vector2, endTile: Vector2, maxTry: number = 100): Vector2[] {
  if (startTile.x === endTile.x && startTile.y === endTile.y) {
    return [];
  }

  const path: Vector2[] = [];
  const frontier: PathNode[] = [];
  frontier.push({ tile: startTile, priority: 0 });

  while (frontier.length > 0) {
    if (maxTry-- < 0) break;

    // Get node with lowest priority
    frontier.sort((a, b) => a.priority - b.priority);
    const currentNode = frontier.shift();
    if (!currentNode) break;
    const current = currentNode.tile;

    // Return tile positions
    path.push({ x: current.x, y: current.y });

    if (current.x === endTile.x && current.y === endTile.y) {
      break;
    }

    // Add all neighbors without obstacle checking
    const neighbors = getNeighbors(current);
    for (const neighbor of neighbors) {
      frontier.push({ tile: neighbor, priority: getTilePositionCost(neighbor, endTile) });
    }
  }

  return path;
}

/**
 * Main pathfinding entry point
 * Reference: PathFinder.FindPath(finder, startTile, endTile, type)
 *
 * @param startTile Starting tile position
 * @param endTile Target tile position
 * @param type PathType to use
 * @param hasObstacle Check if character has obstacle at tile (includes NPC/Obj)
 * @param isMapObstacle Check if tile is a map obstacle (MapBase.Instance.IsObstacleForCharacter)
 * @param isHardObstacle Check if tile is a hard obstacle (MapBase.Instance.IsObstacle, for diagonal blocking)
 * @param canMoveDirectionCount How many directions the character can move (default 8)
 * @returns Path in TILE positions, or empty array if no path found
 */
export function findPath(
  startTile: Vector2,
  endTile: Vector2,
  type: PathType,
  hasObstacle: (tile: Vector2) => boolean,
  isMapObstacle: (tile: Vector2) => boolean,
  isHardObstacle: (tile: Vector2) => boolean,
  canMoveDirectionCount: number = 8
): Vector2[] {
  switch (type) {
    case PathType.PathOneStep:
      return findPathStep(
        startTile,
        endTile,
        hasObstacle,
        isMapObstacle,
        isHardObstacle,
        10,
        canMoveDirectionCount
      );

    case PathType.SimpleMaxNpcTry:
      return findPathSimple(
        startTile,
        endTile,
        hasObstacle,
        isMapObstacle,
        isHardObstacle,
        100,
        canMoveDirectionCount
      );

    case PathType.PerfectMaxNpcTry:
      return findPathPerfect(
        startTile,
        endTile,
        hasObstacle,
        isMapObstacle,
        isHardObstacle,
        100,
        canMoveDirectionCount
      );

    case PathType.PerfectMaxPlayerTry:
      return findPathPerfect(
        startTile,
        endTile,
        hasObstacle,
        isMapObstacle,
        isHardObstacle,
        500,
        canMoveDirectionCount
      );

    case PathType.PathStraightLine:
      return getLinePath(startTile, endTile, 100);

    default:
      // Default to perfect player pathfinding
      return findPathPerfect(
        startTile,
        endTile,
        hasObstacle,
        isMapObstacle,
        isHardObstacle,
        500,
        canMoveDirectionCount
      );
  }
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
  const normalX = worldPosition.x - targetWorldPosition.x;
  const normalY = worldPosition.y - targetWorldPosition.y;
  const normalLen = Math.sqrt(normalX * normalX + normalY * normalY);

  if (normalLen === 0) {
    return { x: -direction.x, y: -direction.y };
  }

  const nx = normalX / normalLen;
  const ny = normalY / normalLen;

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
  const normalX = -diffY;
  const normalY = diffX;
  const normalLen = Math.sqrt(normalX * normalX + normalY * normalY);

  if (normalLen === 0) {
    return { x: -direction.x, y: -direction.y };
  }

  const nx = normalX / normalLen;
  const ny = normalY / normalLen;

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
