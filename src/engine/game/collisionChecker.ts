/**
 * Collision Checker - Handles tile walkability and obstacle detection
 * Extracted from GameManager
 *
 * 委托给 MapBase 处理地图障碍检测，额外处理 NPC 和 Obj 碰撞
 * Based on C#'s JxqyMap.IsObstacleForCharacter and IsObstacle
 */

import type { NpcManager } from "../character/npcManager";
import { getEngineContext } from "../core/engineContext";
import { logger } from "../core/logger";
import type { JxqyMapData } from "../core/mapTypes";
import type { Vector2 } from "../core/types";
import { MapBase } from "../map/mapBase";
import type { ObjManager } from "../obj";

/**
 * Handles collision detection for tiles
 * 封装 MapBase 的障碍检测，并额外处理 NPC/Obj 碰撞
 */
export class CollisionChecker {
  private mapData: JxqyMapData | null = null;

  /**
   * 获取 NpcManager（通过 IEngineContext）
   */
  private get npcManager(): NpcManager {
    const ctx = getEngineContext();
    return ctx.getNpcManager() as NpcManager;
  }

  /**
   * 获取 ObjManager（通过 IEngineContext）
   */
  private get objManager(): ObjManager {
    const ctx = getEngineContext();
    return ctx.getObjManager() as ObjManager;
  }

  /**
   * Update map data reference
   * 同时更新 MapBase 单例的地图数据
   */
  setMapData(mapData: JxqyMapData | null): void {
    this.mapData = mapData;
    MapBase.Instance.setMapData(mapData);
  }

  /**
   * Check if a tile is walkable
   * Matches C# JxqyMap.IsObstacleForCharacter logic
   *
   * Checks:
   * - Map bounds (using C# IsTileInMapViewRange logic)
   * - Barrier type (Obstacle + Trans flags) - 委托给 MapBase
   * - NPC collision
   * - Object collision
   */
  isTileWalkable(tile: Vector2): boolean {
    if (!this.mapData) return false; // No map data = obstacle

    // 使用 MapBase 检查地图障碍
    if (MapBase.Instance.isObstacleForCharacter(tile.x, tile.y)) {
      return false;
    }

    // Check NPC collision
    if (this.npcManager?.isObstacle(tile.x, tile.y)) {
      return false;
    }

    // Check Obj collision
    if (this.objManager?.isObstacle(tile.x, tile.y)) {
      return false;
    }

    return true;
  }

  /**
   * Check if a tile is a map obstacle for character movement
   * Matches C# JxqyMap.IsObstacleForCharacter logic - checks BOTH Obstacle (0x80) AND Trans (0x40)
   * Does NOT check NPC/Obj - this is for pathfinding neighbor filtering
   *
   * Used by PathFinder.FindNeighbors to filter walkable neighbors
   */
  isMapObstacleForCharacter(tile: Vector2): boolean {
    // 委托给 MapBase
    return MapBase.Instance.isObstacleForCharacter(tile.x, tile.y);
  }

  /**
   * Check if a tile is a hard obstacle (used for diagonal blocking in pathfinding)
   * Matches C# JxqyMap.IsObstacle logic - ONLY checks map barrier (0x80)
   * Does NOT check NPC/Obj - this is intentional per C# PathFinder.GetObstacleIndexList
   *
   * Used for diagonal blocking: if a diagonal neighbor has this flag,
   * the adjacent cardinal directions are also blocked
   */
  isMapOnlyObstacle(tile: Vector2): boolean {
    // 委托给 MapBase
    return MapBase.Instance.isObstacle(tile.x, tile.y);
  }

  /**
   * Check if a tile is an obstacle for MAGIC (武功)
   * C# Reference: JxqyMap.IsObstacleForMagic
   *
   * Key point: Magic can pass through Trans (0x40) tiles
   */
  isObstacleForMagic(tile: Vector2): boolean {
    // 委托给 MapBase
    return MapBase.Instance.isObstacleForMagic(tile.x, tile.y);
  }

  /**
   * Check if a tile is an obstacle for character JUMP
   * Matches C# JxqyMap.IsObstacleForCharacterJump logic
   *
   * Key difference from IsObstacleForCharacter:
   * - Normal walking: blocked by Obstacle | Trans
   * - Jumping: can pass through if CanOver (0x20) flag is set
   */
  isMapObstacleForJump(tile: Vector2): boolean {
    // 委托给 MapBase
    return MapBase.Instance.isObstacleForCharacterJump(tile.x, tile.y);
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

    logger.log(`\n========== BARRIER DATA DEBUG ==========`);
    logger.log(`Map size: ${cols} columns x ${rows} rows`);
    logger.log(`Valid range: col [0, ${cols - 1}], row (0, ${rows - 2}]`);
    logger.log(
      `  (C# IsTileInMapViewRange: col >= 0 && col < ${cols} && row > 0 && row < ${rows - 1})`
    );

    // Print walkability map using actual isTileWalkable (includes boundary check)
    logger.log(`\n--- Walkability map (using isTileWalkable, includes boundary) ---`);
    logger.log(`Legend: . = walkable, X = obstacle/boundary`);

    // Print first few rows (top edge)
    logger.log(`\n--- Top edge (rows 0-5) ---`);
    for (let y = 0; y <= Math.min(5, rows - 1); y++) {
      let rowStr = `Row ${y.toString().padStart(3)}: `;
      for (let x = 0; x < cols; x++) {
        const walkable = this.isTileWalkable({ x, y });
        rowStr += walkable ? "." : "X";
      }
      logger.log(rowStr);
    }

    // Print last few rows (bottom edge)
    logger.log(`\n--- Bottom edge (rows ${rows - 6} to ${rows - 1}) ---`);
    for (let y = Math.max(0, rows - 6); y < rows; y++) {
      let rowStr = `Row ${y.toString().padStart(3)}: `;
      for (let x = 0; x < cols; x++) {
        const walkable = this.isTileWalkable({ x, y });
        rowStr += walkable ? "." : "X";
      }
      logger.log(rowStr);
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
    logger.log(`\nTotal walkable tiles: ${walkableCount}`);
    logger.log(`Total obstacle tiles: ${obstacleCount}`);
    logger.log(`========================================\n`);
  }
}
