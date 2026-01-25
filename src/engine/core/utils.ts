/**
 * Utility functions for game engine
 */
import type { Vector2, Direction } from "./types";
import { TILE_WIDTH, TILE_HEIGHT } from "./types";

/**
 * Convert tile position to pixel position (isometric)
 */
export function tileToPixel(tileX: number, tileY: number): Vector2 {
  const baseX = (tileY % 2) * 32 + TILE_WIDTH * tileX;
  const baseY = 16 * tileY;
  return { x: baseX, y: baseY };
}

/**
 * Convert pixel position to tile position (isometric)
 */
export function pixelToTile(pixelX: number, pixelY: number): Vector2 {
  if (pixelX < 0 || pixelY < 0) return { x: 0, y: 0 };

  let nx = Math.floor(pixelX / TILE_WIDTH);
  let ny = 1 + Math.floor(pixelY / (TILE_HEIGHT)) * 2;

  // Calculate real position (isometric adjustment)
  const dx = pixelX - nx * TILE_WIDTH;
  const dy = pixelY - Math.floor(ny / 2) * TILE_HEIGHT;

  if (dx < 32) {
    if (dy < (32 - dx) / 2) {
      ny--;
    } else if (dy > dx / 2 + 16) {
      ny++;
    }
  }
  if (dx > 32) {
    if (dy < (dx - 32) / 2) {
      nx++;
      ny--;
    } else if (dy > (64 - dx) / 2 + 16) {
      nx++;
      ny++;
    }
  }

  return { x: nx, y: ny };
}

/**
 * Get direction from one tile to another
 * This implementation matches C# Utils.GetDirectionIndex
 */
export function getDirection(from: Vector2, to: Vector2): Direction {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  return getDirectionFromVector({ x: dx, y: dy });
}

/**
 * Get direction index from a direction vector (matches C# GetDirectionIndex)
 * Direction 0 points South (down), angles measured from South going counter-clockwise
 */
export function getDirectionFromVector(direction: Vector2): Direction {
  if (direction.x === 0 && direction.y === 0) return 4; // Default South

  const TWO_PI = Math.PI * 2;
  const directionCount = 8;

  // Normalize
  const length = Math.sqrt(direction.x * direction.x + direction.y * direction.y);
  const normX = direction.x / length;
  const normY = direction.y / length;

  // Calculate angle from South (0, 1) - matches C# Vector2.Dot(direction, new Vector2(0, 1))
  let angle = Math.acos(normY);
  if (normX > 0) angle = TWO_PI - angle;

  // 2*PI / (2*directionCount)
  const halfAnglePerDirection = Math.PI / directionCount;
  let region = Math.floor(angle / halfAnglePerDirection);
  if (region % 2 !== 0) region++;
  region %= 2 * directionCount;
  return (region / 2) as Direction;
}

/**
 * Get direction vector for movement
 */
export function getDirectionVector(direction: Direction): Vector2 {
  const vectors: Vector2[] = [
    { x: 0, y: -1 },  // North
    { x: 1, y: -1 },  // NorthEast
    { x: 1, y: 0 },   // East
    { x: 1, y: 1 },   // SouthEast
    { x: 0, y: 1 },   // South
    { x: -1, y: 1 },  // SouthWest
    { x: -1, y: 0 },  // West
    { x: -1, y: -1 }, // NorthWest
  ];
  return vectors[direction] || { x: 0, y: 1 };
}

/**
 * Calculate distance between two positions
 */
export function distance(a: Vector2, b: Vector2): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Calculate tile distance (Manhattan distance in tile space)
 */
export function tileDistance(a: Vector2, b: Vector2): number {
  return Math.abs(b.x - a.x) + Math.abs(b.y - a.y);
}

/**
 * Linear interpolation between two values
 */
export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/**
 * Clamp value between min and max
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * Parse INI file content to object
 */
export function parseIni(content: string): Record<string, Record<string, string>> {
  const result: Record<string, Record<string, string>> = {};
  let currentSection = "";

  const lines = content.split("\n");
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
      currentSection = trimmed.slice(1, -1);
      result[currentSection] = {};
    } else if (trimmed.includes("=") && currentSection) {
      const [key, ...valueParts] = trimmed.split("=");
      result[currentSection][key.trim()] = valueParts.join("=").trim();
    }
  }

  return result;
}

/**
 * Generate unique ID
 */
export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Get neighboring tiles (8-direction)
 * Matches C# PathFinder.FindAllNeighbors exactly
 */
export function getNeighbors(tile: Vector2): Vector2[] {
  const x = tile.x;
  const y = tile.y;
  // Direction indices:
  // 3  4  5
  // 2     6
  // 1  0  7
  if (Math.floor(y) % 2 === 0) {
    // Even row
    return [
      { x: x, y: y + 2 },      // 0: South
      { x: x - 1, y: y + 1 },  // 1: SouthWest
      { x: x - 1, y: y },      // 2: West
      { x: x - 1, y: y - 1 },  // 3: NorthWest
      { x: x, y: y - 2 },      // 4: North
      { x: x, y: y - 1 },      // 5: NorthEast
      { x: x + 1, y: y },      // 6: East
      { x: x, y: y + 1 },      // 7: SouthEast
    ];
  } else {
    // Odd row
    return [
      { x: x, y: y + 2 },      // 0: South
      { x: x, y: y + 1 },      // 1: SouthWest
      { x: x - 1, y: y },      // 2: West
      { x: x, y: y - 1 },      // 3: NorthWest
      { x: x, y: y - 2 },      // 4: North
      { x: x + 1, y: y - 1 },  // 5: NorthEast
      { x: x + 1, y: y },      // 6: East
      { x: x + 1, y: y + 1 },  // 7: SouthEast
    ];
  }
}

/**
 * Get tile position cost using pixel distance (matches C# GetTilePositionCost)
 */
function getTilePositionCost(fromTile: Vector2, toTile: Vector2): number {
  const fromPixel = tileToPixel(fromTile.x, fromTile.y);
  const toPixel = tileToPixel(toTile.x, toTile.y);
  return distance(fromPixel, toPixel);
}

/**
 * A* pathfinding - matches C# FindPathPerfect
 */
export function findPath(
  start: Vector2,
  end: Vector2,
  isWalkable: (tile: Vector2) => boolean,
  maxIterations: number = 500
): Vector2[] {
  if (start.x === end.x && start.y === end.y) {
    return [];
  }

  // Check if end is walkable
  if (!isWalkable(end)) {
    return [];
  }

  const key = (v: Vector2) => `${v.x},${v.y}`;
  const cameFrom = new Map<string, Vector2>();
  const costSoFar = new Map<string, number>();
  const frontier: Array<{ tile: Vector2; priority: number }> = [];

  frontier.push({ tile: start, priority: 0 });
  costSoFar.set(key(start), 0);

  let tryCount = 0;

  while (frontier.length > 0 && tryCount < maxIterations) {
    tryCount++;

    // Get node with lowest priority (using simple sort for now)
    frontier.sort((a, b) => a.priority - b.priority);
    const current = frontier.shift()!.tile;

    // Found destination
    if (current.x === end.x && current.y === end.y) {
      break;
    }

    // Skip if obstacle (but not start)
    if ((current.x !== start.x || current.y !== start.y) && !isWalkable(current)) {
      continue;
    }

    // Check all neighbors
    for (const next of getNeighbors(current)) {
      const nextKey = key(next);
      const newCost = (costSoFar.get(key(current)) ?? 0) + getTilePositionCost(current, next);

      if (!costSoFar.has(nextKey) || newCost < costSoFar.get(nextKey)!) {
        costSoFar.set(nextKey, newCost);
        const priority = newCost + getTilePositionCost(end, next);
        frontier.push({ tile: next, priority });
        cameFrom.set(nextKey, current);
      }
    }
  }

  // Reconstruct path
  if (!cameFrom.has(key(end))) {
    return []; // No path found
  }

  const path: Vector2[] = [end];
  let current = end;
  while (current.x !== start.x || current.y !== start.y) {
    const prev = cameFrom.get(key(current));
    if (!prev) break;
    path.unshift(prev);
    current = prev;
  }

  return path;
}

/**
 * Decode GB2312/GBK encoded buffer to string
 * Used for reading Chinese text from game resource files
 */
export function decodeGb2312(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  
  try {
    // Try GB2312 first (for Chinese text)
    const decoder = new TextDecoder('gb2312');
    return decoder.decode(bytes);
  } catch {
    try {
      // Fallback to GBK
      const decoder = new TextDecoder('gbk');
      return decoder.decode(bytes);
    } catch {
      // Last resort: UTF-8
      const decoder = new TextDecoder('utf-8');
      return decoder.decode(bytes);
    }
  }
}
