/**
 * Utility functions for game engine
 */
import type { Direction, Vector2 } from "./types";
import { TILE_HEIGHT, TILE_WIDTH } from "./types";

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
  let ny = 1 + Math.floor(pixelY / TILE_HEIGHT) * 2;

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
    { x: 0, y: -1 }, // North
    { x: 1, y: -1 }, // NorthEast
    { x: 1, y: 0 }, // East
    { x: 1, y: 1 }, // SouthEast
    { x: 0, y: 1 }, // South
    { x: -1, y: 1 }, // SouthWest
    { x: -1, y: 0 }, // West
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
 * Calculate view tile distance in isometric coordinates
 * C# Reference: PathFinder.GetViewTileDistance -> GetTileDistanceOff
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

  // C#: If start and end tiles are not both at even row or odd row,
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
 * Handles both `;` and `//` style comments
 */
export function parseIni(content: string): Record<string, Record<string, string>> {
  const result: Record<string, Record<string, string>> = {};
  let currentSection = "";

  const lines = content.split(/\r?\n/);
  for (const rawLine of lines) {
    // Remove comments (both ; and // styles)
    let line = rawLine;
    const semicolonIdx = line.indexOf(";");
    if (semicolonIdx >= 0) {
      line = line.substring(0, semicolonIdx);
    }
    const commentIdx = line.indexOf("//");
    if (commentIdx >= 0) {
      line = line.substring(0, commentIdx);
    }
    const trimmed = line.trim();

    if (!trimmed) continue;

    // Section header [SectionName]
    if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
      currentSection = trimmed.slice(1, -1).trim();
      if (!result[currentSection]) {
        result[currentSection] = {};
      }
      continue;
    }

    // Key=Value
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx > 0 && currentSection) {
      const key = trimmed.substring(0, eqIdx).trim();
      const value = trimmed.substring(eqIdx + 1).trim();
      result[currentSection][key] = value;
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

/**
 * Get walkable neighbors with diagonal blocking logic
 * Matches C# PathFinder.FindNeighbors + GetObstacleIndexList
 *
 * Key insight: In isometric maps, when moving "straight" (N/S/E/W which skip 2 tiles),
 * you actually pass through intermediate tiles. If those intermediate tiles are blocked,
 * the straight movement should also be blocked.
 *
 * Direction layout:
 * 3  4  5
 * 2     6
 * 1  0  7
 *
 * - If direction 1 (SouthWest) is obstacle → block 0 (South) and 2 (West)
 * - If direction 3 (NorthWest) is obstacle → block 2 (West) and 4 (North)
 * - If direction 5 (NorthEast) is obstacle → block 4 (North) and 6 (East)
 * - If direction 7 (SouthEast) is obstacle → block 0 (South) and 6 (East)
 */
export function getWalkableNeighbors(
  tile: Vector2,
  isWalkable: (t: Vector2) => boolean,
  isMapObstacle?: (t: Vector2) => boolean
): Vector2[] {
  const allNeighbors = getNeighbors(tile);
  const blockedDirections = new Set<number>();

  // Check each neighbor and apply diagonal blocking rules
  for (let i = 0; i < allNeighbors.length; i++) {
    const neighbor = allNeighbors[i];
    if (!isWalkable(neighbor)) {
      blockedDirections.add(i);

      // Apply diagonal blocking: if a diagonal direction is a "hard" obstacle,
      // also block the adjacent cardinal directions
      // C# checks MapBase.Instance.IsObstacle (not IsObstacleForCharacter)
      // IsObstacle is the raw map barrier, IsObstacleForCharacter also checks NPCs/Objs
      const isHardObstacle = isMapObstacle ? isMapObstacle(neighbor) : !isWalkable(neighbor);

      if (isHardObstacle) {
        switch (i) {
          case 1: // SouthWest → block South(0) and West(2)
            blockedDirections.add(0);
            blockedDirections.add(2);
            break;
          case 3: // NorthWest → block West(2) and North(4)
            blockedDirections.add(2);
            blockedDirections.add(4);
            break;
          case 5: // NorthEast → block North(4) and East(6)
            blockedDirections.add(4);
            blockedDirections.add(6);
            break;
          case 7: // SouthEast → block South(0) and East(6)
            blockedDirections.add(0);
            blockedDirections.add(6);
            break;
        }
      }
    }
  }

  // Return only non-blocked neighbors
  return allNeighbors.filter((_, i) => !blockedDirections.has(i));
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
 * C# Reference: Collider.IsBoxCollide / Rectangle.Intersects
 */
export function isBoxCollide(a: Rect, b: Rect): boolean {
  return (
    a.x < b.x + b.width &&
    a.x + a.width > b.x &&
    a.y < b.y + b.height &&
    a.y + a.height > b.y
  );
}

/**
 * Decode GB2312/GBK encoded buffer to string
 * Used ONLY for reading Chinese text from BINARY game resource files (map, MPC)
 * NOTE: Text files (.ini, .txt) in resources/ are now UTF-8, use response.text() instead
 */
export function decodeGb2312(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);

  try {
    // Try GBK (superset of GB2312, better compatibility)
    const decoder = new TextDecoder("gbk");
    return decoder.decode(bytes);
  } catch {
    try {
      // Fallback to GB2312
      const decoder = new TextDecoder("gb2312");
      return decoder.decode(bytes);
    } catch {
      // Last resort: UTF-8
      const decoder = new TextDecoder("utf-8");
      return decoder.decode(bytes);
    }
  }
}
