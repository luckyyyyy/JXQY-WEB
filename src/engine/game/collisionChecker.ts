/**
 * Collision Checker - Handles tile walkability and obstacle detection
 * Extracted from GameManager
 *
 * Based on C#'s JxqyMap.IsObstacleForCharacter and IsObstacle
 */
import type { Vector2 } from "../core/types";
import type { JxqyMapData } from "../core/mapTypes";
import type { NpcManager } from "../character/npcManager";
import type { ObjManager } from "../obj";

// Barrier type constants (from C# BarrierType enum)
const OBSTACLE = 0x80;
const TRANS = 0x40;
const CAN_OVER = 0x20;  // C#: CanOver - tiles that can be jumped over

/**
 * Handles collision detection for tiles
 */
export class CollisionChecker {
  private mapData: JxqyMapData | null = null;
  private npcManager: NpcManager | null = null;
  private objManager: ObjManager | null = null;

  /**
   * Update map data reference
   */
  setMapData(mapData: JxqyMapData | null): void {
    this.mapData = mapData;
  }

  /**
   * Set manager references
   */
  setManagers(npcManager: NpcManager, objManager: ObjManager): void {
    this.npcManager = npcManager;
    this.objManager = objManager;
  }

  /**
   * Check if a tile is walkable
   * Matches C# JxqyMap.IsObstacleForCharacter logic
   *
   * Checks:
   * - Map bounds (using C# IsTileInMapViewRange logic)
   * - Barrier type (Obstacle + Trans flags)
   * - NPC collision
   * - Object collision
   */
  isTileWalkable(tile: Vector2): boolean {
    if (!this.mapData) return false; // No map data = obstacle

    // Check map bounds using C# IsTileInMapViewRange logic:
    // C#: return (col < MapColumnCounts && row < MapRowCounts - 1 && col >= 0 && row > 0);
    // Note: row must be > 0 (not >= 0), and row must be < MapRowCounts - 1 (not < MapRowCounts)
    // This excludes the first row (row=0) and last row (row=MapRowCounts-1) from walkable area
    if (
      tile.x < 0 ||
      tile.x >= this.mapData.mapColumnCounts ||
      tile.y <= 0 ||  // C#: row > 0 means row must be at least 1
      tile.y >= this.mapData.mapRowCounts - 1  // C#: row < MapRowCounts - 1
    ) {
      return false; // Out of bounds = obstacle
    }

    // Check tile barrier using C# logic:
    // IsObstacleForCharacter checks: (type & (Obstacle + Trans)) == 0
    // If result is 0, it's walkable (return false from IsObstacleForCharacter)
    // If result is non-zero, it's obstacle (return true from IsObstacleForCharacter)
    const tileIndex = tile.x + tile.y * this.mapData.mapColumnCounts;
    const tileInfo = this.mapData.tileInfos[tileIndex];
    if (tileInfo) {
      const barrier = tileInfo.barrierType;
      // C#: if ((type & (Obstacle + Trans)) == 0) return false; else return true;
      // So for walkability (opposite of obstacle): if ((type & (Obstacle + Trans)) != 0) return false;
      if ((barrier & (OBSTACLE + TRANS)) !== 0) {
        return false; // Has Obstacle or Trans flag = not walkable
      }
    }

    // Check NPC collision
    if (this.npcManager && this.npcManager.isObstacle(tile.x, tile.y)) {
      return false;
    }

    // Check Obj collision
    if (this.objManager && this.objManager.isObstacle(tile.x, tile.y)) {
      return false;
    }

    return true;
  }

  /**
   * Check if a tile is a map-only obstacle (used for diagonal blocking in pathfinding)
   * Matches C# JxqyMap.IsObstacle logic - ONLY checks map barrier (0x80)
   * Does NOT check NPC/Obj - this is intentional per C# PathFinder.GetObstacleIndexList
   */
  isMapOnlyObstacle(tile: Vector2): boolean {
    if (!this.mapData) return true; // No map data = obstacle

    // Check map bounds
    if (
      tile.x < 0 ||
      tile.x >= this.mapData.mapColumnCounts ||
      tile.y <= 0 ||
      tile.y >= this.mapData.mapRowCounts - 1
    ) {
      return true; // Out of bounds = obstacle
    }

    // Check ONLY the Obstacle flag (0x80), NOT Trans (0x40) and NOT NPC/Obj
    // C# IsObstacle: if ((type & Obstacle) == 0) return false;
    const tileIndex = tile.x + tile.y * this.mapData.mapColumnCounts;
    const tileInfo = this.mapData.tileInfos[tileIndex];
    if (tileInfo) {
      const barrier = tileInfo.barrierType;
      if ((barrier & OBSTACLE) !== 0) {
        return true; // Has Obstacle flag = map obstacle
      }
    }

    return false;
  }

  /**
   * Check if a tile is an obstacle for character JUMP
   * Matches C# JxqyMap.IsObstacleForCharacterJump logic
   * 
   * C# Code:
   * if (IsTileInMapViewRange(col, row)) {
   *     var type = _tileInfos[col + row * MapColumnCounts].BarrierType;
   *     if (type == None || (type & CanOver) != 0)
   *         return false;  // Not an obstacle for jump
   * }
   * return true;  // Is an obstacle for jump
   * 
   * Key difference from IsObstacleForCharacter:
   * - Normal walking: blocked by Obstacle | Trans
   * - Jumping: can pass through if CanOver (0x20) flag is set
   */
  isMapObstacleForJump(tile: Vector2): boolean {
    if (!this.mapData) return true; // No map data = obstacle

    // Check map bounds (C# IsTileInMapViewRange)
    if (
      tile.x < 0 ||
      tile.x >= this.mapData.mapColumnCounts ||
      tile.y <= 0 ||
      tile.y >= this.mapData.mapRowCounts - 1
    ) {
      return true; // Out of bounds = obstacle for jump
    }

    const tileIndex = tile.x + tile.y * this.mapData.mapColumnCounts;
    const tileInfo = this.mapData.tileInfos[tileIndex];
    if (tileInfo) {
      const barrier = tileInfo.barrierType;
      // C#: if (type == None || (type & CanOver) != 0) return false;
      // None = 0x00, CanOver = 0x20
      if (barrier === 0 || (barrier & CAN_OVER) !== 0) {
        return false; // Not an obstacle for jump (can jump through/over)
      }
    }

    return true; // Is an obstacle for jump
  }

  /**
   * Create walkability checker function (for pathfinding)
   */
  createWalkabilityChecker(): (tile: Vector2) => boolean {
    return (tile: Vector2) => this.isTileWalkable(tile);
  }

  /**
   * Create map-only obstacle checker function (for diagonal blocking in pathfinding)
   */
  createMapObstacleChecker(): (tile: Vector2) => boolean {
    return (tile: Vector2) => this.isMapOnlyObstacle(tile);
  }

  /**
   * Debug: Print barrier data for map analysis
   */
  debugPrintBarrierData(): void {
    if (!this.mapData) return;

    const cols = this.mapData.mapColumnCounts;
    const rows = this.mapData.mapRowCounts;

    console.log(`\n========== BARRIER DATA DEBUG ==========`);
    console.log(`Map size: ${cols} columns x ${rows} rows`);
    console.log(`Valid range: col [0, ${cols - 1}], row (0, ${rows - 2}]`);
    console.log(`  (C# IsTileInMapViewRange: col >= 0 && col < ${cols} && row > 0 && row < ${rows - 1})`);

    // Print walkability map using actual isTileWalkable (includes boundary check)
    console.log(`\n--- Walkability map (using isTileWalkable, includes boundary) ---`);
    console.log(`Legend: . = walkable, X = obstacle/boundary`);

    // Print first few rows (top edge)
    console.log(`\n--- Top edge (rows 0-5) ---`);
    for (let y = 0; y <= Math.min(5, rows - 1); y++) {
      let rowStr = `Row ${y.toString().padStart(3)}: `;
      for (let x = 0; x < cols; x++) {
        const walkable = this.isTileWalkable({ x, y });
        rowStr += walkable ? '.' : 'X';
      }
      console.log(rowStr);
    }

    // Print last few rows (bottom edge)
    console.log(`\n--- Bottom edge (rows ${rows - 6} to ${rows - 1}) ---`);
    for (let y = Math.max(0, rows - 6); y < rows; y++) {
      let rowStr = `Row ${y.toString().padStart(3)}: `;
      for (let x = 0; x < cols; x++) {
        const walkable = this.isTileWalkable({ x, y });
        rowStr += walkable ? '.' : 'X';
      }
      console.log(rowStr);
    }

    // Count walkable tiles
    let walkableCount = 0;
    let obstacleCount = 0;
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        if (this.isTileWalkable({ x, y })) {
          walkableCount++;
        } else {
          obstacleCount++;
        }
      }
    }
    console.log(`\nTotal walkable tiles: ${walkableCount}`);
    console.log(`Total obstacle tiles: ${obstacleCount}`);
    console.log(`========================================\n`);
  }
}
