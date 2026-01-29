/**
 * PathFinder - A* and other pathfinding algorithms
 * C# Reference: JxqyHD/Engine/PathFinder.cs
 *
 * This module implements multiple pathfinding strategies to match C# behavior:
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

import type { Vector2 } from "./types";
import { tileToPixel, getNeighbors, distance, getDirectionFromVector } from "./utils";

/**
 * C# PathFinder.PathType enum
 */
export enum PathType {
  PathOneStep = 0,         // Simple greedy, ~10 steps
  SimpleMaxNpcTry = 1,     // Greedy best-first, maxTry=100
  PerfectMaxNpcTry = 2,    // A* for NPC, maxTry=100
  PerfectMaxPlayerTry = 3, // A* for player, maxTry=500
  PathStraightLine = 4,    // Direct line, ignores obstacles
  End = 5,                 // Use character's default PathType
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
 * C# Reference: PathFinder.GetTilePositionCost
 */
function getTilePositionCost(fromTile: Vector2, toTile: Vector2): number {
  const fromPixel = tileToPixel(fromTile.x, fromTile.y);
  const toPixel = tileToPixel(toTile.x, toTile.y);
  return distance(fromPixel, toPixel);
}

/**
 * Get obstacle index list for diagonal blocking
 * C# Reference: PathFinder.GetObstacleIndexList
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

      // C#: if (MapBase.Instance.IsObstacle(neighborList[i]))
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
 * C# Reference: PathFinder.CanMoveInDirection
 */
function canMoveInDirection(direction: number, canMoveDirectionCount: number): boolean {
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
 * C# Reference: PathFinder.FindNeighbors
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
    const isDestination = destination &&
      allNeighbors[j].x === destination.x &&
      allNeighbors[j].y === destination.y;

    if (isDestination || (!removeList.has(j) && canMoveInDirection(j, canMoveDirectionCount))) {
      result.push(allNeighbors[j]);
    }
  }

  return result;
}

/**
 * Reconstruct path from cameFrom map
 * C# Reference: PathFinder.GetPath
 * Returns path in TILE positions (not pixel positions)
 *
 * Note: C# version returns pixel positions, but our TypeScript Character.moveAlongPath
 * expects tile positions and converts them internally.
 */
function getPath(
  cameFrom: Map<string, Vector2>,
  startTile: Vector2,
  endTile: Vector2
): Vector2[] {
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
 * C# Reference: PathFinder.FindPathStep
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

  // C#: if (MapBase.Instance.IsObstacleForCharacter(endTile)) return null;
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
      (direction + 1) % 8, (direction + 8 - 1) % 8,
      (direction + 2) % 8, (direction + 8 - 2) % 8,
      (direction + 3) % 8, (direction + 8 - 3) % 8,
      (direction + 4) % 8,
    ];

    let foundIndex = -1;
    for (const dir of directionOrder) {
      const position = neighbors[dir];
      const posKey = key(position);

      if (removeList.has(dir) ||
          hasObstacle(position) ||
          visited.has(posKey)) {
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
 * C# Reference: PathFinder.FindPathSimple
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
    const current = frontier.shift()!.tile;

    if (current.x === endTile.x && current.y === endTile.y) {
      break;
    }

    // C#: if (finder.HasObstacle(current) && current != startTile) continue;
    if ((current.x !== startTile.x || current.y !== startTile.y) && hasObstacle(current)) {
      continue;
    }

    const neighbors = findNeighbors(current, isMapObstacle, isHardObstacle, canMoveDirectionCount, endTile);

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
 * C# Reference: PathFinder.FindPathPerfect
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

  if (isMapObstacle(endTile)) {
    return [];
  }

  const key = (v: Vector2) => `${v.x},${v.y}`;
  const cameFrom = new Map<string, Vector2>();
  const costSoFar = new Map<string, number>();
  const frontier: PathNode[] = [];

  frontier.push({ tile: startTile, priority: 0 });
  costSoFar.set(key(startTile), 0);

  let tryCount = 0;

  while (frontier.length > 0) {
    if (maxTryCount !== -1 && tryCount++ > maxTryCount) break;

    // Get node with lowest priority
    frontier.sort((a, b) => a.priority - b.priority);
    const current = frontier.shift()!.tile;
    const currentKey = key(current);

    if (current.x === endTile.x && current.y === endTile.y) {
      break;
    }

    // C#: if (finder.HasObstacle(current) && current != startTile) continue;
    if ((current.x !== startTile.x || current.y !== startTile.y) && hasObstacle(current)) {
      continue;
    }

    const neighbors = findNeighbors(current, isMapObstacle, isHardObstacle, canMoveDirectionCount, endTile);

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

  return getPath(cameFrom, startTile, endTile);
}

/**
 * Get straight line path (ignores obstacles)
 * C# Reference: PathFinder.GetLinePath
 *
 * Used for flying characters that can move through obstacles
 * Always returns tile positions (the tilePosition param is ignored for consistency)
 */
export function getLinePath(
  startTile: Vector2,
  endTile: Vector2,
  maxTry: number = 100
): Vector2[] {
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
    const current = frontier.shift()!.tile;

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
 * C# Reference: PathFinder.FindPath(finder, startTile, endTile, type)
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
      return findPathStep(startTile, endTile, hasObstacle, isMapObstacle, isHardObstacle, 10, canMoveDirectionCount);

    case PathType.SimpleMaxNpcTry:
      return findPathSimple(startTile, endTile, hasObstacle, isMapObstacle, isHardObstacle, 100, canMoveDirectionCount);

    case PathType.PerfectMaxNpcTry:
      return findPathPerfect(startTile, endTile, hasObstacle, isMapObstacle, isHardObstacle, 100, canMoveDirectionCount);

    case PathType.PerfectMaxPlayerTry:
      return findPathPerfect(startTile, endTile, hasObstacle, isMapObstacle, isHardObstacle, 500, canMoveDirectionCount);

    case PathType.PathStraightLine:
      return getLinePath(startTile, endTile, 100);

    default:
      // Default to perfect player pathfinding
      return findPathPerfect(startTile, endTile, hasObstacle, isMapObstacle, isHardObstacle, 500, canMoveDirectionCount);
  }
}

/**
 * Find neighbor in a specific direction (0-7)
 * C# Reference: PathFinder.FindNeighborInDirection
 */
export function findNeighborInDirection(tilePosition: Vector2, direction: number): Vector2 {
  if (direction < 0 || direction > 7) {
    return { x: 0, y: 0 };
  }
  return getNeighbors(tilePosition)[direction];
}

/**
 * Find tile at a distance in a direction
 * C# Reference: PathFinder.FindDistanceTileInDirection
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

/**
 * Check if there are map obstacles in a tile position list
 * C# Reference: PathFinder.HasMapObstacalInTilePositionList
 */
export function hasMapObstacleInTilePositionList(
  tilePositionList: Vector2[],
  isMapObstacle: (tile: Vector2) => boolean
): boolean {
  if (!tilePositionList || tilePositionList.length === 0) {
    return true;
  }

  for (const tilePosition of tilePositionList) {
    if (isMapObstacle(tilePosition)) {
      return true;
    }
  }

  return false;
}
