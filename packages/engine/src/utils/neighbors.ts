/**
 * Neighbor tile utilities for isometric pathfinding
 * 邻居瓦片工具 - 用于等角地图寻路
 */
import type { Vector2 } from "../core/types";

/**
 * Get neighboring tiles (8-direction)
 * Matches PathFinder.FindAllNeighbors exactly
 *
 * Direction indices:
 * 3  4  5
 * 2     6
 * 1  0  7
 */
export function getNeighbors(tile: Vector2): Vector2[] {
  const x = tile.x;
  const y = tile.y;

  if (Math.floor(y) % 2 === 0) {
    // Even row
    return [
      { x: x, y: y + 2 }, // 0: South
      { x: x - 1, y: y + 1 }, // 1: SouthWest
      { x: x - 1, y: y }, // 2: West
      { x: x - 1, y: y - 1 }, // 3: NorthWest
      { x: x, y: y - 2 }, // 4: North
      { x: x, y: y - 1 }, // 5: NorthEast
      { x: x + 1, y: y }, // 6: East
      { x: x, y: y + 1 }, // 7: SouthEast
    ];
  } else {
    // Odd row
    return [
      { x: x, y: y + 2 }, // 0: South
      { x: x, y: y + 1 }, // 1: SouthWest
      { x: x - 1, y: y }, // 2: West
      { x: x, y: y - 1 }, // 3: NorthWest
      { x: x, y: y - 2 }, // 4: North
      { x: x + 1, y: y - 1 }, // 5: NorthEast
      { x: x + 1, y: y }, // 6: East
      { x: x + 1, y: y + 1 }, // 7: SouthEast
    ];
  }
}

