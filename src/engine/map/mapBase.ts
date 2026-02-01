/**
 * MapBase - 地图基类
 *
 * 完全对应 C# Engine/Map/MapBase.cs + JxqyMap.cs 实现
 *
 * 功能包含：
 * - 坐标转换（ToTilePosition, ToPixelPosition）
 * - 视图范围计算（GetStartTileInView, GetEndTileInView）
 * - 瓦片/碰撞检测（IsObstacle, IsObstacleForCharacter, IsObstacleForCharacterJump, IsObstacleForMagic）
 * - 陷阱系统（LoadTrap, SetMapTrap, GetMapTrap, HasTrapScript, RunTileTrapScript）
 * - 图层控制（SetLayerDraw, IsLayerDraw, SwitchLayerDraw）
 * - 地图加载/释放
 *
 * 注意：渲染由 renderer.ts 处理，MapBase 专注于逻辑
 */

import { getEngineContext } from "../core/engineContext";
import { logger } from "../core/logger";
import type { JxqyMapData, MapTileInfo } from "../core/mapTypes";
import type { Vector2 } from "../core/types";
import { parseIni, pixelToTile, tileToPixel } from "../core/utils";
import { resourceLoader } from "../resource/resourceLoader";

// ============= 障碍类型常量 (C# BarrierType) =============
/** 无障碍 */
const NONE = 0x00;
/** 完全障碍 */
const OBSTACLE = 0x80;
/** 可跳过的障碍 */
const CAN_OVER_OBSTACLE = 0xa0;
/** 透明障碍（武功可穿，人不能过） */
const TRANS = 0x40;
/** 可跳过的透明障碍 */
const CAN_OVER_TRANS = 0x60;
/** 可跳过 */
const CAN_OVER = 0x20;

// ============= 图层常量 =============
/** 最大图层数 */
export const MAX_LAYER = 5;
/** 图层索引：layer1, layer2, layer3, trap, obstacle */
export const LAYER_INDEX = {
  LAYER1: 0,
  LAYER2: 1,
  LAYER3: 2,
  TRAP: 3,
  OBSTACLE: 4,
} as const;

/**
 * 地图基类 - 单例模式
 * 对应 C# MapBase + JxqyMap
 */
export class MapBase {
  /** 单例实例 (对应 C# MapBase.Instance) */
  private static _instance: MapBase | null = null;

  // ============= 地图数据 =============
  private _mapData: JxqyMapData | null = null;
  private _isOk: boolean = false;

  // ============= 静态文件信息 (对应 C# 的静态字段) =============
  private static _mapFileNameWithoutExtension: string = "";
  private static _mapFileName: string = "";
  private static _mapTime: number = 0;

  // ============= 图层控制 (对应 C# _isLayerDraw) =============
  /** layer1, layer2, layer3, trap, obstacle */
  private static _isLayerDraw: boolean[] = [true, true, true, false, false];

  // ============= 视图范围 (对应 C# 的静态字段) =============
  private static _viewBeginX: number = 0;
  private static _viewBeginY: number = 0;
  private static _viewWidth: number = 800;
  private static _viewHeight: number = 600;

  // ============= 陷阱系统 (对应 C# 的静态字段) =============
  /** 地图陷阱配置 mapName -> (trapIndex -> scriptFile) */
  private static _traps: Map<string, Map<number, string>> = new Map();
  /** 已忽略（已触发）的陷阱索引 */
  private static _ignoredTrapsIndex: Set<number> = new Set();
  /** 是否正在执行陷阱脚本 */
  private static _isInRunMapTrap: boolean = false;

  // ============= 构造函数（私有，使用单例） =============
  private constructor() {}

  /**
   * 获取单例实例
   */
  static get Instance(): MapBase {
    if (!MapBase._instance) {
      MapBase._instance = new MapBase();
    }
    return MapBase._instance;
  }

  /**
   * 设置地图数据（由外部加载后设置）
   */
  setMapData(mapData: JxqyMapData | null): void {
    this._mapData = mapData;
    this._isOk = mapData !== null;
  }

  // ============= 公共属性 =============

  get isOk(): boolean {
    return this._isOk;
  }

  get mapData(): JxqyMapData | null {
    return this._mapData;
  }

  static get MapFileNameWithoutExtension(): string {
    return MapBase._mapFileNameWithoutExtension;
  }

  static set MapFileNameWithoutExtension(value: string) {
    MapBase._mapFileNameWithoutExtension = value;
  }

  static get MapFileName(): string {
    return MapBase._mapFileName;
  }

  static set MapFileName(value: string) {
    MapBase._mapFileName = value;
  }

  static get MapTime(): number {
    return MapBase._mapTime;
  }

  static set MapTime(value: number) {
    MapBase._mapTime = value;
  }

  // 视图属性
  static get ViewWidth(): number {
    return MapBase._viewWidth;
  }

  static set ViewWidth(value: number) {
    MapBase._viewWidth = value < 0 ? 0 : value;
  }

  static get ViewHeight(): number {
    return MapBase._viewHeight;
  }

  static set ViewHeight(value: number) {
    MapBase._viewHeight = value < 0 ? 0 : value;
  }

  get viewBeginX(): number {
    return MapBase._viewBeginX;
  }

  set viewBeginX(value: number) {
    if (!this._mapData) {
      MapBase._viewBeginX = 0;
      return;
    }
    if (value <= 0) {
      MapBase._viewBeginX = 0;
    } else if (value + MapBase._viewWidth > this._mapData.mapPixelWidth) {
      MapBase._viewBeginX = this._mapData.mapPixelWidth - MapBase._viewWidth;
    } else {
      MapBase._viewBeginX = value;
    }
    if (MapBase._viewBeginX < 0) MapBase._viewBeginX = 0;
  }

  get viewBeginY(): number {
    return MapBase._viewBeginY;
  }

  set viewBeginY(value: number) {
    if (!this._mapData) {
      MapBase._viewBeginY = 0;
      return;
    }
    if (value <= 0) {
      MapBase._viewBeginY = 0;
    } else if (value + MapBase._viewHeight > this._mapData.mapPixelHeight) {
      MapBase._viewBeginY = this._mapData.mapPixelHeight - MapBase._viewHeight;
    } else {
      MapBase._viewBeginY = value;
    }
    if (MapBase._viewBeginY < 0) MapBase._viewBeginY = 0;
  }

  get mapPixelWidth(): number {
    return this._mapData?.mapPixelWidth ?? 0;
  }

  get mapPixelHeight(): number {
    return this._mapData?.mapPixelHeight ?? 0;
  }

  get mapColumnCounts(): number {
    return this._mapData?.mapColumnCounts ?? 0;
  }

  get mapRowCounts(): number {
    return this._mapData?.mapRowCounts ?? 0;
  }

  // ============= 坐标转换（静态方法） =============

  /**
   * 像素坐标 → 瓦片坐标
   * 对应 C# MapBase.ToTilePosition
   * 内部使用 core/utils.ts 的实现
   */
  static ToTilePosition(pixelX: number, pixelY: number, boundCheck: boolean = true): Vector2 {
    if (boundCheck && (pixelX < 0 || pixelY < 0)) {
      return { x: 0, y: 0 };
    }
    return pixelToTile(pixelX, pixelY);
  }

  /**
   * 像素坐标 → 瓦片坐标（Vector2 重载）
   */
  static ToTilePositionFromVector(pixelPosition: Vector2, boundCheck: boolean = true): Vector2 {
    return MapBase.ToTilePosition(pixelPosition.x, pixelPosition.y, boundCheck);
  }

  /**
   * 瓦片坐标 → 像素坐标（瓦片中心）
   * 对应 C# MapBase.ToPixelPosition
   * 内部使用 core/utils.ts 的实现
   */
  static ToPixelPosition(col: number, row: number, boundCheck: boolean = true): Vector2 {
    if (boundCheck && (col < 0 || row < 0)) {
      return { x: 0, y: 0 };
    }
    return tileToPixel(col, row);
  }

  /**
   * 瓦片坐标 → 像素坐标（Vector2 重载）
   */
  static ToPixelPositionFromVector(tilePosition: Vector2, boundCheck: boolean = true): Vector2 {
    return MapBase.ToPixelPosition(tilePosition.x, tilePosition.y, boundCheck);
  }

  // ============= 视图范围计算 =============

  /**
   * 获取当前视图内的起始瓦片
   * 对应 C# MapBase.GetStartTileInView
   */
  getStartTileInView(): Vector2 {
    return MapBase.GetStartTileInViewStatic(this.viewBeginX, this.viewBeginY);
  }

  /**
   * 获取当前视图内的结束瓦片
   * 对应 C# MapBase.GetEndTileInView
   */
  getEndTileInView(): Vector2 {
    return MapBase.GetEndTileInViewStatic(
      this.viewBeginX + MapBase._viewWidth,
      this.viewBeginY + MapBase._viewHeight,
      this.mapColumnCounts,
      this.mapRowCounts
    );
  }

  /**
   * 静态方法：获取视图内的起始瓦片
   */
  static GetStartTileInViewStatic(viewBeginX: number, viewBeginY: number): Vector2 {
    const start = MapBase.ToTilePosition(viewBeginX, viewBeginY);
    start.x = Math.max(0, start.x - 20);
    start.y = Math.max(0, start.y - 20);
    return start;
  }

  /**
   * 静态方法：获取视图内的结束瓦片
   */
  static GetEndTileInViewStatic(
    viewEndX: number,
    viewEndY: number,
    mapColumnCounts: number,
    mapRowCounts: number
  ): Vector2 {
    const end = MapBase.ToTilePosition(viewEndX, viewEndY);
    end.x = Math.min(mapColumnCounts, end.x + 20);
    end.y = Math.min(mapRowCounts, end.y + 20);
    return end;
  }

  // ============= 瓦片范围检查 =============

  /**
   * 检查瓦片是否在地图范围内
   * 对应 C# MapBase.IsTileInMapRange
   */
  isTileInMapRange(x: number, y: number): boolean {
    if (!this._mapData) return false;
    return x >= 0 && x < this._mapData.mapColumnCounts && y >= 0 && y < this._mapData.mapRowCounts;
  }

  /**
   * 检查瓦片是否在地图范围内（Vector2 重载）
   */
  isTileInMapRangeVector(tilePosition: Vector2): boolean {
    return this.isTileInMapRange(tilePosition.x, tilePosition.y);
  }

  /**
   * 检查瓦片是否在地图视图范围内（用于碰撞检测）
   * 对应 C# MapBase.IsTileInMapViewRange
   *
   * C# 原始逻辑：
   * return (col < MapColumnCounts && row < MapRowCounts - 1 && col >= 0 && row > 0);
   *
   * 注意：row 必须 > 0（不是 >= 0），row 必须 < MapRowCounts - 1（不是 < MapRowCounts）
   * 这排除了第一行（row=0）和最后一行（row=MapRowCounts-1）
   */
  isTileInMapViewRange(col: number, row: number): boolean {
    if (!this._mapData) return false;
    return (
      col >= 0 &&
      col < this._mapData.mapColumnCounts &&
      row > 0 &&
      row < this._mapData.mapRowCounts - 1
    );
  }

  // ============= 障碍检测 =============

  /**
   * 获取瓦片信息
   */
  private getTileInfo(col: number, row: number): MapTileInfo | null {
    if (!this._mapData) return null;
    const tileIndex = col + row * this._mapData.mapColumnCounts;
    return this._mapData.tileInfos[tileIndex] ?? null;
  }

  /**
   * 检查是否为障碍物（仅检查 Obstacle 标志）
   * 对应 C# JxqyMap.IsObstacle
   */
  isObstacle(col: number, row: number): boolean {
    if (!this.isTileInMapViewRange(col, row)) {
      return true; // 越界视为障碍
    }
    const tileInfo = this.getTileInfo(col, row);
    if (tileInfo) {
      // C#: if ((type & Obstacle) == 0) return false;
      return (tileInfo.barrierType & OBSTACLE) !== 0;
    }
    return true;
  }

  /**
   * 检查是否为障碍物（Vector2 重载）
   */
  isObstacleVector(tilePosition: Vector2): boolean {
    return this.isObstacle(tilePosition.x, tilePosition.y);
  }

  /**
   * 检查是否为角色障碍（检查 Obstacle + Trans）
   * 对应 C# JxqyMap.IsObstacleForCharacter
   *
   * 用于普通行走碰撞检测
   */
  isObstacleForCharacter(col: number, row: number): boolean {
    if (!this.isTileInMapViewRange(col, row)) {
      return true; // 越界视为障碍
    }
    const tileInfo = this.getTileInfo(col, row);
    if (tileInfo) {
      // C#: if ((type & (Obstacle + Trans)) == 0) return false;
      return (tileInfo.barrierType & (OBSTACLE + TRANS)) !== 0;
    }
    return true;
  }

  /**
   * 检查是否为角色障碍（Vector2 重载）
   */
  isObstacleForCharacterVector(tilePosition: Vector2): boolean {
    return this.isObstacleForCharacter(tilePosition.x, tilePosition.y);
  }

  /**
   * 检查是否为角色跳跃障碍
   * 对应 C# JxqyMap.IsObstacleForCharacterJump
   *
   * 跳跃时可以越过 CanOver (0x20) 标志的瓦片
   */
  isObstacleForCharacterJump(col: number, row: number): boolean {
    if (!this.isTileInMapViewRange(col, row)) {
      return true; // 越界视为障碍
    }
    const tileInfo = this.getTileInfo(col, row);
    if (tileInfo) {
      // C#: if (type == None || (type & CanOver) != 0) return false;
      const barrier = tileInfo.barrierType;
      if (barrier === NONE || (barrier & CAN_OVER) !== 0) {
        return false; // 可跳过
      }
    }
    return true;
  }

  /**
   * 检查是否为角色跳跃障碍（Vector2 重载）
   */
  isObstacleForCharacterJumpVector(tilePosition: Vector2): boolean {
    return this.isObstacleForCharacterJump(tilePosition.x, tilePosition.y);
  }

  /**
   * 检查是否为武功障碍
   * 对应 C# JxqyMap.IsObstacleForMagic
   *
   * 武功可以穿过 Trans (0x40) 标志的瓦片
   */
  isObstacleForMagic(col: number, row: number): boolean {
    if (!this.isTileInMapViewRange(col, row)) {
      return true; // 越界视为障碍
    }
    const tileInfo = this.getTileInfo(col, row);
    if (tileInfo) {
      // C#: if (type == None || (type & Trans) != 0) return false;
      const barrier = tileInfo.barrierType;
      if (barrier === NONE || (barrier & TRANS) !== 0) {
        return false; // 武功可通过
      }
    }
    return true;
  }

  /**
   * 检查是否为武功障碍（Vector2 重载）
   */
  isObstacleForMagicVector(tilePosition: Vector2): boolean {
    return this.isObstacleForMagic(tilePosition.x, tilePosition.y);
  }

  // ============= 聚合碰撞检测 =============

  /**
   * 检查瓦片是否可行走（聚合检测：地图 + NPC + Obj）
   * 从 MapService 移入
   */
  isTileWalkable(tile: Vector2): boolean {
    if (!this._mapData) return false;

    // 地图障碍
    if (this.isObstacleForCharacter(tile.x, tile.y)) {
      return false;
    }

    // NPC 障碍
    try {
      const ctx = getEngineContext();
      if (ctx.npcManager?.isObstacle(tile.x, tile.y)) {
        return false;
      }
      // Obj 障碍
      const objManager = ctx.getManager("obj");
      if (objManager?.isObstacle(tile.x, tile.y)) {
        return false;
      }
    } catch {
      // 引擎未初始化，只检查地图障碍
    }

    return true;
  }

  // ============= 坐标转换（实例方法，兼容接口）=============

  /**
   * 像素坐标 → 瓦片坐标（实例方法）
   */
  toTilePosition(pixelX: number, pixelY: number): Vector2 {
    return MapBase.ToTilePosition(pixelX, pixelY);
  }

  /**
   * 瓦片坐标 → 像素坐标（实例方法）
   */
  toPixelPosition(tileX: number, tileY: number): Vector2 {
    return MapBase.ToPixelPosition(tileX, tileY);
  }

  /**
   * 检查瓦片是否为跳跃障碍（别名，兼容接口）
   */
  isObstacleForJump(x: number, y: number): boolean {
    return this.isObstacleForCharacterJump(x, y);
  }

  // ============= 陷阱系统 =============

  /**
   * 获取瓦片的陷阱索引
   * 对应 C# JxqyMap.GetTileTrapIndex
   * @returns 陷阱索引，0 表示无陷阱
   */
  getTileTrapIndex(col: number, row: number): number {
    if (!this.isTileInMapViewRange(col, row)) {
      return 0;
    }
    const tileInfo = this.getTileInfo(col, row);
    return tileInfo?.trapIndex ?? 0;
  }

  /**
   * 获取瓦片的陷阱索引（Vector2 重载）
   */
  getTileTrapIndexVector(tilePosition: Vector2): number {
    return this.getTileTrapIndex(tilePosition.x, tilePosition.y);
  }

  /**
   * 从文件加载陷阱配置
   * 对应 C# MapBase.LoadTrap
   */
  static async LoadTrap(filePath: string): Promise<void> {
    // 清空已忽略的陷阱列表
    MapBase._ignoredTrapsIndex.clear();
    MapBase._traps.clear();

    try {
      const content = await resourceLoader.loadText(filePath);
      if (!content) {
        logger.warn(`[MapBase] Traps config not found: ${filePath}`);
        return;
      }

      const sections = parseIni(content);

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
          MapBase._traps.set(mapName, trapMapping);
        }
      }

      logger.log(`[MapBase] Loaded trap config for ${MapBase._traps.size} maps`);
    } catch (error) {
      logger.error(`[MapBase] Error loading traps:`, error);
    }
  }

  /**
   * 保存陷阱配置到文件（在 Web 环境中主要用于调试）
   * 对应 C# MapBase.SaveTrap
   */
  static SaveTrap(): string {
    let output = "";
    for (const [mapName, traps] of MapBase._traps) {
      output += `[${mapName}]\n`;
      for (const [trapIndex, scriptFile] of traps) {
        output += `${trapIndex}=${scriptFile}\n`;
      }
      output += "\n";
    }
    return output;
  }

  /**
   * 加载已忽略的陷阱索引列表
   * 对应 C# MapBase.LoadTrapIndexIgnoreList
   */
  static LoadTrapIndexIgnoreList(data: number[]): void {
    MapBase._ignoredTrapsIndex.clear();
    for (const index of data) {
      MapBase._ignoredTrapsIndex.add(index);
    }
    logger.log(`[MapBase] Loaded ${data.length} ignored trap indices`);
  }

  /**
   * 获取已忽略的陷阱索引列表（用于存档）
   * 对应 C# MapBase.SaveTrapIndexIgnoreList
   */
  static GetIgnoredTrapIndices(): number[] {
    return Array.from(MapBase._ignoredTrapsIndex);
  }

  /**
   * 清空已忽略的陷阱列表（加载新地图时调用）
   * 对应 C# JxqyMap.LoadMapFromBuffer 中的 _ingnoredTrapsIndex.Clear()
   */
  static ClearIgnoredTraps(): void {
    MapBase._ignoredTrapsIndex.clear();
  }

  /**
   * 设置地图陷阱
   * 对应 C# MapBase.SetMapTrap
   */
  setMapTrap(index: number, trapFileName: string, mapName?: string): void {
    const targetMap = mapName || MapBase._mapFileNameWithoutExtension;
    if (!targetMap) return;

    // 如果是当前地图，从忽略列表中移除以重新激活
    if (!mapName || mapName === MapBase._mapFileNameWithoutExtension) {
      MapBase._ignoredTrapsIndex.delete(index);
    }

    // 获取或创建陷阱映射
    if (!MapBase._traps.has(targetMap)) {
      MapBase._traps.set(targetMap, new Map());
    }
    const traps = MapBase._traps.get(targetMap)!;

    if (!trapFileName) {
      // 移除陷阱
      traps.delete(index);
    } else {
      // 设置/更新陷阱
      traps.set(index, trapFileName);
    }
  }

  /**
   * 获取地图陷阱脚本解析器
   * 对应 C# MapBase.GetMapTrap
   * @returns 脚本文件名，如果没有返回 null
   */
  getMapTrapFileName(index: number, mapName?: string): string | null {
    const targetMap = mapName || MapBase._mapFileNameWithoutExtension;
    if (!targetMap) return null;

    const traps = MapBase._traps.get(targetMap);
    if (traps?.has(index)) {
      const scriptFile = traps.get(index)!;
      // 空字符串表示陷阱被移除
      return scriptFile || null;
    }
    return null;
  }

  /**
   * 检查瓦片是否有陷阱脚本
   * 对应 C# MapBase.HasTrapScript
   */
  hasTrapScript(tilePosition: Vector2): boolean {
    const index = this.getTileTrapIndexVector(tilePosition);
    if (index === 0) return false;

    const trapFileName = this.getMapTrapFileName(index);
    if (!trapFileName) return false;

    // 检查是否在忽略列表中
    if (MapBase._ignoredTrapsIndex.has(index)) {
      return false;
    }

    return true;
  }

  /**
   * 运行瓦片陷阱脚本
   * 对应 C# MapBase.RunTileTrapScript
   *
   * @param tilePosition 瓦片位置
   * @param runScript 执行脚本的回调函数
   * @param onTrapTriggered 陷阱触发时的回调（在脚本运行前）
   * @returns 是否触发了陷阱
   */
  runTileTrapScript(
    tilePosition: Vector2,
    getScriptBasePath: () => string,
    runScript: (scriptPath: string) => void,
    onTrapTriggered?: () => void
  ): boolean {
    const trapIndex = this.getTileTrapIndexVector(tilePosition);
    if (trapIndex === 0) return false;

    // 检查是否在忽略列表中
    if (MapBase._ignoredTrapsIndex.has(trapIndex)) {
      return false;
    }

    const trapScriptName = this.getMapTrapFileName(trapIndex);
    if (!trapScriptName) return false;

    logger.log(
      `[MapBase] Triggering trap ${trapIndex} at tile (${tilePosition.x}, ${tilePosition.y})`
    );

    // C#: Globals.ThePlayer.StandingImmediately()
    onTrapTriggered?.();

    // C#: _isInRunMapTrap = true
    MapBase._isInRunMapTrap = true;

    // 添加到忽略列表（不会再次触发）
    MapBase._ignoredTrapsIndex.add(trapIndex);

    // 运行脚本
    const basePath = getScriptBasePath();
    const scriptPath = `${basePath}/${trapScriptName}`;
    logger.log(`[MapBase] Running trap script: ${scriptPath}`);
    runScript(scriptPath);

    return true;
  }

  /**
   * 检查是否正在执行陷阱脚本
   */
  static get IsInRunMapTrap(): boolean {
    return MapBase._isInRunMapTrap;
  }

  /**
   * 设置陷阱执行状态
   */
  static set IsInRunMapTrap(value: boolean) {
    MapBase._isInRunMapTrap = value;
  }

  /**
   * 清空所有陷阱状态（新游戏时调用）
   */
  static ClearAll(): void {
    MapBase._ignoredTrapsIndex.clear();
    MapBase._traps.clear();
    MapBase._isInRunMapTrap = false;
  }

  /**
   * 检查瓦片是否有陷阱脚本（带外部 mapData 参数）
   * 用于 GameManager 等没有直接访问 MapBase.Instance 的场景
   */
  static HasTrapScriptWithMapData(
    tile: Vector2,
    mapData: JxqyMapData | null,
    currentMapName: string
  ): boolean {
    if (!mapData) return false;

    const tileIndex = tile.x + tile.y * mapData.mapColumnCounts;
    const tileInfo = mapData.tileInfos[tileIndex];

    if (tileInfo && tileInfo.trapIndex > 0) {
      const trapIndex = tileInfo.trapIndex;

      // 检查是否在忽略列表中
      if (MapBase._ignoredTrapsIndex.has(trapIndex)) {
        return false;
      }

      // 检查是否有配置的脚本
      const traps = MapBase._traps.get(currentMapName);
      if (traps?.has(trapIndex)) {
        const scriptFile = traps.get(trapIndex)!;
        return scriptFile !== "";
      }
    }
    return false;
  }

  /**
   * 检查并触发陷阱
   * 对应 C# MapBase.RunTileTrapScript 的完整流程
   *
   * @param tile 瓦片位置
   * @param mapData 地图数据
   * @param currentMapName 当前地图名称
   * @param isScriptRunning 脚本是否正在运行的检查函数
   * @param isWaitingForInput 是否等待用户输入
   * @param getScriptBasePath 获取脚本基础路径
   * @param runScript 运行脚本的函数
   * @param onTrapTriggered 陷阱触发时的回调
   * @returns 是否触发了陷阱
   */
  static CheckTrap(
    tile: Vector2,
    mapData: JxqyMapData | null,
    currentMapName: string,
    isScriptRunning: () => boolean,
    isWaitingForInput: () => boolean,
    getScriptBasePath: () => string,
    runScript: (scriptPath: string) => void,
    onTrapTriggered?: () => void
  ): boolean {
    if (!mapData) {
      return false;
    }

    // C#: Don't run trap if already in trap script execution
    if (MapBase._isInRunMapTrap) {
      return false;
    }

    // Don't run traps if waiting for input (dialog, selection, etc.)
    if (isWaitingForInput()) {
      return false;
    }

    const tileIndex = tile.x + tile.y * mapData.mapColumnCounts;
    const tileInfo = mapData.tileInfos[tileIndex];

    if (tileInfo && tileInfo.trapIndex > 0) {
      const trapIndex = tileInfo.trapIndex;

      // 检查是否在忽略列表中
      if (MapBase._ignoredTrapsIndex.has(trapIndex)) {
        return false;
      }

      // 获取陷阱脚本文件名
      const traps = MapBase._traps.get(currentMapName);
      if (!traps?.has(trapIndex)) {
        return false;
      }
      const trapScriptName = traps.get(trapIndex)!;
      if (!trapScriptName) {
        return false;
      }

      logger.log(
        `[MapBase] Triggering trap ${trapIndex} at tile (${tile.x}, ${tile.y}) on map "${currentMapName}"`
      );

      // 添加到忽略列表
      MapBase._ignoredTrapsIndex.add(trapIndex);

      // 设置陷阱执行标志
      MapBase._isInRunMapTrap = true;

      // C#: Globals.ThePlayer.StandingImmediately()
      onTrapTriggered?.();

      // 运行脚本
      const basePath = getScriptBasePath();
      const scriptPath = `${basePath}/${trapScriptName}`;
      logger.log(`[MapBase] Running trap script: ${scriptPath}`);
      runScript(scriptPath);

      return true;
    }

    return false;
  }

  /**
   * 调试输出陷阱信息
   */
  static DebugLogTraps(mapData: JxqyMapData | null, currentMapName: string): void {
    if (!mapData) return;

    // 显示地图文件中的陷阱瓦片
    const trapsInMap: { tile: string; trapIndex: number }[] = [];
    for (let i = 0; i < mapData.tileInfos.length; i++) {
      const tileInfo = mapData.tileInfos[i];
      if (tileInfo.trapIndex > 0) {
        const x = i % mapData.mapColumnCounts;
        const y = Math.floor(i / mapData.mapColumnCounts);
        trapsInMap.push({ tile: `(${x},${y})`, trapIndex: tileInfo.trapIndex });
      }
    }

    // 显示此地图配置的陷阱脚本
    const mapTraps = MapBase._traps.get(currentMapName);
    if (mapTraps && mapTraps.size > 0) {
      logger.debug(`[MapBase] Trap scripts for "${currentMapName}": ${mapTraps.size} configured`);
    } else {
      logger.debug(`[MapBase] No trap scripts configured for "${currentMapName}"`);
    }
  }

  // ============= 图层控制 =============

  /**
   * 设置图层是否绘制
   * 对应 C# MapBase.SetLayerDraw
   */
  static SetLayerDraw(layer: number, isDraw: boolean): void {
    if (layer < 0 || layer > MAX_LAYER - 1) return;
    MapBase._isLayerDraw[layer] = isDraw;
  }

  /**
   * 检查图层是否绘制
   * 对应 C# MapBase.IsLayerDraw
   */
  static IsLayerDraw(layer: number): boolean {
    if (layer < 0 || layer > MAX_LAYER - 1) return false;
    return MapBase._isLayerDraw[layer];
  }

  /**
   * 切换图层绘制状态
   * 对应 C# MapBase.SwitchLayerDraw
   */
  static SwitchLayerDraw(layer: number): void {
    MapBase.SetLayerDraw(layer, !MapBase.IsLayerDraw(layer));
  }

  // ============= 地图加载/释放 =============

  /**
   * 设置地图信息（地图加载后调用）
   * 对应 C# MapBase.LoadMap 的后半部分
   */
  setMapInfo(mapFileName: string): void {
    const pathParts = mapFileName.split("/");
    const fileName = pathParts[pathParts.length - 1];
    MapBase._mapFileName = fileName;
    MapBase._mapFileNameWithoutExtension = fileName.replace(/\.[^.]+$/, "");
    logger.log(`[MapBase] Map info set: ${MapBase._mapFileNameWithoutExtension}`);
  }

  /**
   * 释放地图资源
   * 对应 C# MapBase.Free
   */
  static Free(): void {
    const instance = MapBase._instance;
    if (instance) {
      instance._mapData = null;
      instance._isOk = false;
    }
  }

  /**
   * 获取随机位置
   * 对应 C# MapBase.GetRandPositon
   */
  getRandPosition(tilePosition: Vector2, max: number): Vector2 {
    let randPosition: Vector2 = { x: 0, y: 0 };
    let maxTry = 10;

    do {
      maxTry--;
      randPosition.x = tilePosition.x + Math.floor(Math.random() * (2 * max + 1)) - max;
      randPosition.y = tilePosition.y + Math.floor(Math.random() * (2 * max + 1)) - max;
    } while (!this.isTileInMapRangeVector(randPosition) && maxTry >= 0);

    return maxTry < 0 ? { x: 0, y: 0 } : randPosition;
  }

  // ============= 陷阱数据存档/读档 =============

  /**
   * 获取所有陷阱配置（用于存档）
   */
  static GetAllTraps(): Map<string, Map<number, string>> {
    return MapBase._traps;
  }

  /**
   * 设置所有陷阱配置（从存档恢复）
   */
  static SetAllTraps(traps: Map<string, Map<number, string>>): void {
    MapBase._traps = traps;
  }

  /**
   * 从存档数据恢复陷阱状态
   */
  static LoadTrapsFromSave(
    mapTraps: Record<string, Record<number, string>> | undefined,
    ignoreList: number[]
  ): void {
    // 恢复陷阱配置
    if (mapTraps) {
      MapBase._traps.clear();
      for (const mapName in mapTraps) {
        const trapObj = mapTraps[mapName];
        const traps = new Map<number, string>();
        for (const trapIndexStr in trapObj) {
          const trapIndex = parseInt(trapIndexStr, 10);
          const scriptFile = trapObj[trapIndexStr];
          if (scriptFile) {
            traps.set(trapIndex, scriptFile);
          }
        }
        if (traps.size > 0) {
          MapBase._traps.set(mapName, traps);
        }
      }
      logger.debug(`[MapBase] Restored trap config for ${MapBase._traps.size} maps`);
    }

    // 恢复已忽略的陷阱索引
    MapBase._ignoredTrapsIndex.clear();
    for (const index of ignoreList) {
      MapBase._ignoredTrapsIndex.add(index);
    }
    logger.debug(`[MapBase] Restored ${ignoreList.length} ignored trap indices`);
  }

  /**
   * 收集陷阱数据用于存档
   */
  static CollectTrapDataForSave(): {
    mapTraps: Record<string, Record<number, string>>;
    ignoreList: number[];
  } {
    const mapTraps: Record<string, Record<number, string>> = {};
    for (const [mapName, traps] of MapBase._traps) {
      const trapObj: Record<number, string> = {};
      for (const [trapIndex, scriptFile] of traps) {
        trapObj[trapIndex] = scriptFile;
      }
      mapTraps[mapName] = trapObj;
    }

    const ignoreList = Array.from(MapBase._ignoredTrapsIndex);

    return { mapTraps, ignoreList };
  }
}
