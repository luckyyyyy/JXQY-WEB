/**
 * Neighbor tile utilities for isometric pathfinding
 * 邻居瓦片工具 - 用于等角地图寻路
 */
import type { Vector2 } from "../core/types";

// Pre-allocated reusable buffer - avoids 8 object + 1 array allocation per call
// IMPORTANT: returned array is shared; do NOT store the reference across calls
const _buf: Vector2[] = Array.from({ length: 8 }, () => ({ x: 0, y: 0 }));

/**
 * Get neighboring tiles (8-direction)
 * Matches PathFinder.FindAllNeighbors exactly
 *
 * Direction indices:
 * 3  4  5
 * 2     6
 * 1  0  7
 *
 * NOTE: Returns a shared pre-allocated array. Consume immediately;
 * do not store the returned reference.
 */
export function getNeighbors(tile: Vector2): Vector2[] {
  const x = tile.x;
  const y = tile.y;

  if (Math.floor(y) % 2 === 0) {
    // Even row
    _buf[0].x = x;
    _buf[0].y = y + 2; // South
    _buf[1].x = x - 1;
    _buf[1].y = y + 1; // SouthWest
    _buf[2].x = x - 1;
    _buf[2].y = y; // West
    _buf[3].x = x - 1;
    _buf[3].y = y - 1; // NorthWest
    _buf[4].x = x;
    _buf[4].y = y - 2; // North
    _buf[5].x = x;
    _buf[5].y = y - 1; // NorthEast
    _buf[6].x = x + 1;
    _buf[6].y = y; // East
    _buf[7].x = x;
    _buf[7].y = y + 1; // SouthEast
  } else {
    // Odd row
    _buf[0].x = x;
    _buf[0].y = y + 2; // South
    _buf[1].x = x;
    _buf[1].y = y + 1; // SouthWest
    _buf[2].x = x - 1;
    _buf[2].y = y; // West
    _buf[3].x = x;
    _buf[3].y = y - 1; // NorthWest
    _buf[4].x = x;
    _buf[4].y = y - 2; // North
    _buf[5].x = x + 1;
    _buf[5].y = y - 1; // NorthEast
    _buf[6].x = x + 1;
    _buf[6].y = y; // East
    _buf[7].x = x + 1;
    _buf[7].y = y + 1; // SouthEast
  }

  return _buf;
}
