/**
 * Map Trap Manager - Handles trap configuration and triggering
 * Extracted from GameManager
 *
 * Based on C#'s MapBase trap management (LoadTrap, SetMapTrap, RunTileTrapScript)
 *
 * 数据结构（参考 C#）：
 * - mapTraps: Map<string, Map<number, string>> 对应 C# 的 _traps
 *   - 从 Traps.ini 资源文件加载（游戏启动时）
 *   - key 是地图名，value 是 (trapIndex -> scriptFile) 的映射
 *   - 不需要存档，因为配置从资源文件读取
 *
 * - ignoredTrapIndices: Set<number> 对应 C# 的 _ingnoredTrapsIndex
 *   - 存储已触发的陷阱索引
 *   - 需要存档，存档时写入 TrapIndexIgnore.ini
 *
 * C# 文件结构：
 * - Traps.ini: 陷阱配置（地图 + index -> 脚本文件）
 *   [map_001]
 *   1=Trap01.txt
 *   2=CustomTrap.txt
 *
 * - TrapIndexIgnore.ini: 已触发的陷阱索引列表（存档时保存）
 *   [Init]
 *   0=1
 *   1=3
 *   2=5
 */
import { logger } from "../core/logger";
import type { JxqyMapData } from "../core/mapTypes";
import type { Vector2 } from "../core/types";
import { resourceLoader } from "../resource/resourceLoader";
import type { ScriptExecutor } from "../script/executor";
import type { TrapData } from "./storage";

/**
 * Manages trap configurations and triggering for maps
 */
export class MapTrapManager {
  // Trap management (like C#'s _ingnoredTrapsIndex and _traps)
  private ignoredTrapIndices: Set<number> = new Set();
  private mapTraps: Map<string, Map<number, string>> = new Map(); // mapName -> (trapIndex -> scriptFile)
  private isInRunMapTrap: boolean = false; // C#'s _isInRunMapTrap - prevents trap re-triggering

  /**
   * Clear ignored trap indices (called when loading a new map)
   */
  clearIgnoredTraps(): void {
    this.ignoredTrapIndices.clear();
  }

  /**
   * Clear all trap mappings and ignored list
   */
  clearAll(): void {
    this.ignoredTrapIndices.clear();
    this.mapTraps.clear();
  }

  /**
   * Check if currently executing a trap script
   */
  isInTrapExecution(): boolean {
    return this.isInRunMapTrap;
  }

  /**
   * Set trap execution flag
   */
  setInTrapExecution(value: boolean): void {
    this.isInRunMapTrap = value;
  }

  /**
   * Load trap configuration from Traps.ini
   * Based on C#'s MapBase.LoadTrap
   * Uses unified resourceLoader for text data fetching
   */
  async loadTraps(
    basePath: string,
    parseIni: (content: string) => Record<string, Record<string, string>>
  ): Promise<void> {
    try {
      const trapsPath = `${basePath}/Traps.ini`;

      const content = await resourceLoader.loadText(trapsPath);
      if (!content) {
        logger.warn(`[MapTrapManager] Traps.ini not found at ${trapsPath}`);
        return;
      }

      const sections = parseIni(content);

      // Clear existing trap mappings and ignored list (like C# does)
      this.ignoredTrapIndices.clear();
      this.mapTraps.clear();
      // 重置陷阱执行标志，避免读档后陷阱无法触发
      this.isInRunMapTrap = false;

      // Load trap mappings for each map
      for (const mapName in sections) {
        const trapMapping = new Map<number, string>();
        const section = sections[mapName];

        for (const key in section) {
          const trapIndex = parseInt(key, 10);
          const scriptFile = section[key];
          if (!Number.isNaN(trapIndex)) {
            trapMapping.set(trapIndex, scriptFile);
          }
        }

        if (trapMapping.size > 0) {
          this.mapTraps.set(mapName, trapMapping);
        }
      }

      logger.log(`[MapTrapManager] Loaded trap config for ${this.mapTraps.size} maps`);
    } catch (error) {
      logger.error(`[MapTrapManager] Error loading traps:`, error);
    }
  }

  /**
   * Set trap script for a map (called by SetTrap/SetMapTrap script commands)
   * Based on C#'s MapBase.SetMapTrap
   */
  setMapTrap(
    trapIndex: number,
    trapFileName: string,
    currentMapName: string,
    targetMapName?: string
  ): void {
    const targetMap = targetMapName || currentMapName;
    if (!targetMap) return;

    // If setting for current map, remove from ignored list (re-activate)
    if (!targetMapName || targetMapName === currentMapName) {
      this.ignoredTrapIndices.delete(trapIndex);
    }

    // Get or create trap mapping for this map
    if (!this.mapTraps.has(targetMap)) {
      this.mapTraps.set(targetMap, new Map());
    }
    const traps = this.mapTraps.get(targetMap)!;

    if (!trapFileName) {
      // Remove trap
      traps.delete(trapIndex);
    } else {
      // Set/update trap
      traps.set(trapIndex, trapFileName);
    }
  }

  /**
   * Get trap script file name for a given index
   * 参考 C# MapBase.GetMapTrapFileName()
   *
   * 注意：如果 Traps.ini 中没有配置，返回 null（不触发陷阱）
   * C# 的逻辑是：只有在 _traps 中明确配置的陷阱才会触发
   */
  getTrapScriptFileName(trapIndex: number, currentMapName: string): string | null {
    // Check if trap is in ignored list
    if (this.ignoredTrapIndices.has(trapIndex)) {
      return null;
    }

    // 检查 Traps.ini 中是否有此地图和索引的配置
    const mapTraps = this.mapTraps.get(currentMapName);

    if (mapTraps?.has(trapIndex)) {
      const scriptFile = mapTraps.get(trapIndex)!;
      // Empty string means trap is removed (via SetTrap with empty filename)
      if (scriptFile === "") return null;
      return scriptFile;
    }

    // 没有配置则不触发（参考 C# GetMapTrapFileName 返回 null）
    return null;
  }

  /**
   * Check if tile has a trap script
   * C# Reference: MapBase.Instance.HasTrapScript(TilePosition)
   * Used for jump obstacle check - if there's a trap, can't jump
   *
   * Note: This requires mapData which is held by GameManager/CollisionChecker
   * For now, this method is provided for the interface, but actual implementation
   * should be called with mapData context
   */
  hasTrapScript(_tile: Vector2): boolean {
    // This is a simplified version - the full check requires mapData
    // In practice, Character.updateJumping should use this.engine to access
    // the full trap check through GameManager
    return false;
  }

  /**
   * Check if tile has a trap script (with mapData context)
   * Used by checkTrap and other methods that have access to mapData
   */
  hasTrapScriptWithMapData(
    tile: Vector2,
    mapData: JxqyMapData | null,
    currentMapName: string
  ): boolean {
    if (!mapData) return false;

    const tileIndex = tile.x + tile.y * mapData.mapColumnCounts;
    const tileInfo = mapData.tileInfos[tileIndex];

    if (tileInfo && tileInfo.trapIndex > 0) {
      const trapScriptName = this.getTrapScriptFileName(tileInfo.trapIndex, currentMapName);
      return trapScriptName !== null;
    }
    return false;
  }

  /**
   * Check and trigger trap at tile
   * Based on C#'s MapBase.RunTileTrapScript
   *
   * @param onTrapTriggered - Callback when trap is triggered (before script runs)
   * @returns true if a trap was triggered
   */
  checkTrap(
    tile: Vector2,
    mapData: JxqyMapData | null,
    currentMapName: string,
    scriptExecutor: ScriptExecutor,
    getScriptBasePath: () => string,
    onTrapTriggered?: () => void
  ): boolean {
    if (!mapData) {
      return false;
    }

    // C#: Don't run trap if already in trap script execution
    if (this.isInRunMapTrap) {
      return false;
    }

    // Don't run traps if waiting for input (dialog, selection, etc.)
    if (scriptExecutor.isWaitingForInput()) {
      return false;
    }

    const tileIndex = tile.x + tile.y * mapData.mapColumnCounts;
    const tileInfo = mapData.tileInfos[tileIndex];

    if (tileInfo && tileInfo.trapIndex > 0) {
      const trapIndex = tileInfo.trapIndex;

      // Get trap script file name (handles ignored traps and custom mappings)
      const trapScriptName = this.getTrapScriptFileName(trapIndex, currentMapName);
      if (!trapScriptName) {
        // 陷阱不触发的原因已在 getTrapScriptFileName 中处理，这里不再重复打印
        return false;
      }

      // 只在实际触发时打印日志
      logger.log(
        `[MapTrapManager] Triggering trap ${trapIndex} at tile (${tile.x}, ${tile.y}) on map "${currentMapName}"`
      );

      // Add to ignored list so it won't trigger again (until re-activated by SetTrap)
      this.ignoredTrapIndices.add(trapIndex);

      // Set flag to prevent re-triggering during map transitions
      this.isInRunMapTrap = true;

      // C#: Globals.ThePlayer.StandingImmediately()
      // Player should stop immediately when trap is triggered
      if (onTrapTriggered) {
        onTrapTriggered();
      }

      const basePath = getScriptBasePath();
      const scriptPath = `${basePath}/${trapScriptName}`;
      logger.log(`[MapTrapManager] Running trap script: ${scriptPath}`);
      scriptExecutor.runScript(scriptPath);

      return true;
    }

    return false;
  }

  /**
   * Log trap info for debugging
   */
  debugLogTraps(mapData: JxqyMapData | null, currentMapName: string): void {
    if (!mapData) return;

    // Show trap tiles from map file
    const trapsInMap: { tile: string; trapIndex: number }[] = [];
    for (let i = 0; i < mapData.tileInfos.length; i++) {
      const tileInfo = mapData.tileInfos[i];
      if (tileInfo.trapIndex > 0) {
        const x = i % mapData.mapColumnCounts;
        const y = Math.floor(i / mapData.mapColumnCounts);
        trapsInMap.push({ tile: `(${x},${y})`, trapIndex: tileInfo.trapIndex });
      }
    }

    // Show trap scripts configured for this map
    const mapTraps = this.mapTraps.get(currentMapName);
    if (mapTraps && mapTraps.size > 0) {
      logger.log(`[MapTrapManager] Trap scripts for "${currentMapName}":`);
      mapTraps.forEach((scriptFile, trapIndex) => {
        logger.log(`[MapTrapManager]   Trap ${trapIndex} -> ${scriptFile}`);
      });
    } else {
      logger.log(`[MapTrapManager] No trap scripts configured for "${currentMapName}"`);
    }
  }

  // ============= Save/Load Methods =============

  /**
   * 收集陷阱数据用于存档
   * 参考 C# MapBase.SaveTrap() 和 MapBase.SaveTrapIndexIgnoreList()
   *
   * 存档时需要保存两部分：
   * 1. mapTraps - 动态修改的陷阱配置（通过 SetMapTrap 命令添加/修改的）
   * 2. ignoreList - 已触发（被忽略）的陷阱索引列表
   */
  collectTrapData(): TrapData {
    // 收集已忽略（已触发）的陷阱索引
    const ignoreList = Array.from(this.ignoredTrapIndices);

    // 收集动态陷阱配置（mapTraps）
    const mapTraps: Record<string, Record<number, string>> = {};
    for (const [mapName, traps] of this.mapTraps) {
      const trapObj: Record<number, string> = {};
      for (const [trapIndex, scriptFile] of traps) {
        trapObj[trapIndex] = scriptFile;
      }
      mapTraps[mapName] = trapObj;
    }

    logger.log(
      `[MapTrapManager] Collected ${ignoreList.length} ignored trap indices, ` +
        `${Object.keys(mapTraps).length} map trap configs`
    );
    return { ignoreList, mapTraps };
  }

  /**
   * 从存档数据恢复陷阱状态
   * 参考 C# MapBase.LoadTrap() 和 MapBase.LoadTrapIndexIgnoreList()
   *
   * C# 行为：
   * - LoadTrap() 会清空 _traps 后再从存档的 Traps.ini 加载完整配置
   * - LoadTrapIndexIgnoreList() 从存档加载已忽略的陷阱索引
   *
   * 因为 C# 存档的 Traps.ini 包含完整的陷阱配置（原始 + 脚本修改），
   * 所以加载时直接替换。我们的实现也需要完全替换 mapTraps。
   */
  loadFromSaveData(data: TrapData): void {
    // 如果存档有 mapTraps，则完全替换（而不是合并）
    // 这与 C# 的 LoadTrap() 清空后加载行为一致
    if (data.mapTraps) {
      this.mapTraps.clear();
      for (const mapName in data.mapTraps) {
        const trapObj = data.mapTraps[mapName];
        const traps = new Map<number, string>();
        for (const trapIndexStr in trapObj) {
          const trapIndex = parseInt(trapIndexStr, 10);
          const scriptFile = trapObj[trapIndexStr];
          // 只添加非空的脚本文件（空字符串表示陷阱被删除）
          if (scriptFile) {
            traps.set(trapIndex, scriptFile);
          }
        }
        if (traps.size > 0) {
          this.mapTraps.set(mapName, traps);
        }
      }
      logger.log(`[MapTrapManager] Replaced mapTraps with ${Object.keys(data.mapTraps).length} map configs from save`);
    }
    // 如果存档没有 mapTraps（旧存档），保留已从 Traps.ini 加载的配置

    // 清空并恢复 ignoreList
    this.ignoredTrapIndices.clear();

    // 恢复已忽略的陷阱索引
    for (const index of data.ignoreList) {
      this.ignoredTrapIndices.add(index);
    }

    logger.log(
      `[MapTrapManager] Restored ${data.ignoreList.length} ignored trap indices from save`
    );
  }

  /**
   * 获取已忽略的陷阱索引列表（用于调试）
   */
  getIgnoredIndices(): number[] {
    return Array.from(this.ignoredTrapIndices);
  }

  /**
   * 获取所有地图的陷阱配置（用于调试）
   */
  getAllTraps(): Map<string, Map<number, string>> {
    return this.mapTraps;
  }
}

// Singleton instance
let trapManagerInstance: MapTrapManager | null = null;

export function getMapTrapManager(): MapTrapManager {
  if (!trapManagerInstance) {
    trapManagerInstance = new MapTrapManager();
  }
  return trapManagerInstance;
}
