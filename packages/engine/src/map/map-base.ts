/**
 * MapBase - 地图基类
 *
 * 完全实现
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

import { getEngineContext } from "../core/engine-context";
import { logger } from "../core/logger";
// ============= 障碍类型常量（定义在 core/map-constants.ts，此处导入以供本模块内部使用并 re-export）=============
import {
  CAN_OVER,
  CAN_OVER_OBSTACLE,
  CAN_OVER_TRANS,
  NONE,
  OBSTACLE,
  TRANS,
} from "../core/map-constants";
import type { Vector2 } from "../core/types";
import { resolveScriptPath } from "../resource/resource-paths";
import { pixelToTile, tileToPixel } from "../utils";
import type { MiuMapData } from "./types";
export { CAN_OVER, CAN_OVER_OBSTACLE, CAN_OVER_TRANS, NONE, OBSTACLE, TRANS };

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
 *
 *
 * 所有状态都在实例上，通过 engine.map 访问
 */
export class MapBase {
  protected get engine() {
    return getEngineContext();
  }

  // ============= 地图数据 =============
  private _mapData: MiuMapData | null = null;
  private _isOk: boolean = false;

  // ============= 文件信息（实例字段） =============
  private _mapFileNameWithoutExtension: string = "";
  private _mapFileName: string = "";
  private _mapTime: number = 0;

  // ============= 图层控制（实例字段） =============
  /** layer1, layer2, layer3, trap, obstacle */
  private _isLayerDraw: boolean[] = [true, true, true, false, false];

  // ============= 视图范围（实例字段） =============
  private _viewBeginX: number = 0;
  private _viewBeginY: number = 0;
  private _viewWidth: number = 800;
  private _viewHeight: number = 600;

  // ============= 陷阱系统（实例字段） =============
  /**
   * 地图陷阱基础表 mapName -> (trapIndex -> scriptFile)
   * 来源：MMF 文件内嵌的 trapTable，每次进入地图时由 initTrapsForMap 重建。
   * 仅作为"陷阱兜底全量数据"使用，不进存档（读档时由 MMF 重新解析）。
   */
  private _mapTrapTable: Map<string, Map<number, string>> = new Map();
  /**
   * 持久化陷阱缓存 mapName -> (trapIndex -> scriptFile)
   * 跨地图常驻：脚本通过 SetTrap 直接写入；SaveMapTrap 把 snapshot 整体提交到这里。
   * 进存档（groups.trap）。进入地图时合并到 snapshot，触发流程只看 snapshot。
   */
  private _groupTrap: Map<string, Map<number, string>> = new Map();
  /**
   * 当前地图的运行时陷阱表 trapIndex -> scriptFile
   * 切地图时清空，再 clone(_groupTrap[新图]) 作为初始值。
   * - SetMapTrap 写这里（不持久，直到 SaveMapTrap 才进 group）。
   * - 陷阱触发成功后写入 "" 表示"本地图内不再触发"。
   * 进存档（snapshot.trap）。
   */
  private _snapshotTrap: Map<number, string> = new Map();
  /** 是否正在执行陷阱脚本 */
  private _isInRunMapTrap: boolean = false;
  /** 当前正在执行的陷阱索引（-1 = 无） */
  private _currentTrapIndex: number = -1;

  /**
   * 设置地图数据（由外部加载后设置）
   */
  setMapData(mapData: MiuMapData | null): void {
    this._mapData = mapData;
    this._isOk = mapData !== null;
  }

  // ============= 公共属性 =============

  get isOk(): boolean {
    return this._isOk;
  }

  get mapData(): MiuMapData | null {
    return this._mapData;
  }

  get mapFileNameWithoutExtension(): string {
    return this._mapFileNameWithoutExtension;
  }

  set mapFileNameWithoutExtension(value: string) {
    this._mapFileNameWithoutExtension = value;
  }

  get mapFileName(): string {
    return this._mapFileName;
  }

  set mapFileName(value: string) {
    this._mapFileName = value;
  }

  get mapTime(): number {
    return this._mapTime;
  }

  set mapTime(value: number) {
    this._mapTime = value;
  }

  // 视图属性
  get viewWidth(): number {
    return this._viewWidth;
  }

  set viewWidth(value: number) {
    this._viewWidth = value < 0 ? 0 : value;
  }

  get viewHeight(): number {
    return this._viewHeight;
  }

  set viewHeight(value: number) {
    this._viewHeight = value < 0 ? 0 : value;
  }

  get viewBeginX(): number {
    return this._viewBeginX;
  }

  set viewBeginX(value: number) {
    if (!this._mapData) {
      this._viewBeginX = 0;
      return;
    }
    if (value <= 0) {
      this._viewBeginX = 0;
    } else if (value + this._viewWidth > this._mapData.mapPixelWidth) {
      this._viewBeginX = this._mapData.mapPixelWidth - this._viewWidth;
    } else {
      this._viewBeginX = value;
    }
    if (this._viewBeginX < 0) this._viewBeginX = 0;
  }

  get viewBeginY(): number {
    return this._viewBeginY;
  }

  set viewBeginY(value: number) {
    if (!this._mapData) {
      this._viewBeginY = 0;
      return;
    }
    if (value <= 0) {
      this._viewBeginY = 0;
    } else if (value + this._viewHeight > this._mapData.mapPixelHeight) {
      this._viewBeginY = this._mapData.mapPixelHeight - this._viewHeight;
    } else {
      this._viewBeginY = value;
    }
    if (this._viewBeginY < 0) this._viewBeginY = 0;
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
   *
   * 内部使用 core/utils.ts 的实现
   */
  static toTilePosition(pixelX: number, pixelY: number, boundCheck: boolean = true): Vector2 {
    if (boundCheck && (pixelX < 0 || pixelY < 0)) {
      return { x: 0, y: 0 };
    }
    return pixelToTile(pixelX, pixelY);
  }

  /**
   * 瓦片坐标 → 像素坐标（瓦片中心）
   *
   * 内部使用 core/utils.ts 的实现
   */
  static toPixelPosition(col: number, row: number, boundCheck: boolean = true): Vector2 {
    if (boundCheck && (col < 0 || row < 0)) {
      return { x: 0, y: 0 };
    }
    return tileToPixel(col, row);
  }

  // ============= 视图范围计算 =============

  /**
   * 静态方法：获取视图内的起始瓦片
   */
  static getStartTileInViewStatic(viewBeginX: number, viewBeginY: number): Vector2 {
    const start = MapBase.toTilePosition(viewBeginX, viewBeginY);
    start.x = Math.max(0, start.x - 20);
    start.y = Math.max(0, start.y - 20);
    return start;
  }

  /**
   * 静态方法：获取视图内的结束瓦片
   */
  static getEndTileInViewStatic(
    viewEndX: number,
    viewEndY: number,
    mapColumnCounts: number,
    mapRowCounts: number
  ): Vector2 {
    const end = MapBase.toTilePosition(viewEndX, viewEndY);
    end.x = Math.min(mapColumnCounts, end.x + 20);
    end.y = Math.min(mapRowCounts, end.y + 20);
    return end;
  }

  // ============= 瓦片范围检查 =============

  /**
   * 检查瓦片是否在地图范围内
   *
   */
  isTileInMapRange(x: number, y: number): boolean {
    if (!this._mapData) return false;
    return x >= 0 && x < this._mapData.mapColumnCounts && y >= 0 && y < this._mapData.mapRowCounts;
  }

  /**
   * 检查瓦片是否在地图视图范围内（用于碰撞检测）
   *
   *
   * 原始逻辑：
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
   * 获取瓦片的障碍类型
   */
  private getBarrierType(col: number, row: number): number {
    if (!this._mapData) return 0xff;
    const tileIndex = col + row * this._mapData.mapColumnCounts;
    return this._mapData.barriers[tileIndex] ?? 0xff;
  }

  /**
   * 获取瓦片的陷阱索引
   */
  private getTrapIndex(col: number, row: number): number {
    if (!this._mapData) return 0;
    const tileIndex = col + row * this._mapData.mapColumnCounts;
    return this._mapData.traps[tileIndex] ?? 0;
  }

  /**
   * 检查是否为障碍物（仅检查 Obstacle 标志）
   *
   */
  isObstacle(col: number, row: number): boolean {
    if (!this.isTileInMapViewRange(col, row)) {
      return true; // 越界视为障碍
    }
    const barrier = this.getBarrierType(col, row); // 原始 byte，与 C++ 一致：无掩码，精确值比较自然忽略低位噪声
    // C++ exact-value: toObstacle(0x80) | toJumpOpaque(0xA0) 阻挡硬碰撞
    return barrier === OBSTACLE || barrier === CAN_OVER_OBSTACLE;
  }

  /**
   * 检查是否为角色障碍（检查 Obstacle + Trans）
   *
   *
   * 用于普通行走碰撞检测
   */
  isObstacleForCharacter(col: number, row: number): boolean {
    if (!this.isTileInMapViewRange(col, row)) {
      return true; // 越界视为障碍
    }
    const barrier = this.getBarrierType(col, row); // 原始 byte，与 C++ 一致
    // C++ exact-value: canWalk 被 toTrans(0x40)/toJumpTrans(0x60)/toObstacle(0x80)/toJumpOpaque(0xA0) 阻挡
    return (
      barrier === TRANS ||
      barrier === CAN_OVER_TRANS ||
      barrier === OBSTACLE ||
      barrier === CAN_OVER_OBSTACLE
    );
  }

  /**
   * 纯函数版障碍检测（不依赖 MapBase 实例）
   *
   * 用于 Dashboard 场景编辑器等不启动引擎的场景
   */
  static isObstacleAt(mapData: MiuMapData, col: number, row: number): boolean {
    if (col < 0 || row < 0 || col >= mapData.mapColumnCounts || row >= mapData.mapRowCounts) {
      return true;
    }
    const idx = col + row * mapData.mapColumnCounts;
    const barrier = mapData.barriers[idx] ?? 0xff; // 原始 byte，与 C++ 一致
    // C++ exact-value: same as isObstacleForCharacter
    return (
      barrier === TRANS ||
      barrier === CAN_OVER_TRANS ||
      barrier === OBSTACLE ||
      barrier === CAN_OVER_OBSTACLE
    );
  }

  /**
   * 纯函数版硬障碍检测（仅 OBSTACLE，不含 TRANS）
   *
   * 对应实例方法 isObstacle()，用于寻路算法的 isHardObstacle 回调
   */
  static isHardObstacleAt(mapData: MiuMapData, col: number, row: number): boolean {
    if (col < 0 || row < 0 || col >= mapData.mapColumnCounts || row >= mapData.mapRowCounts) {
      return true;
    }
    const idx = col + row * mapData.mapColumnCounts;
    const barrier = mapData.barriers[idx] ?? 0xff; // 原始 byte，与 C++ 一致
    // C++ exact-value: toObstacle(0x80) | toJumpOpaque(0xA0)
    return barrier === OBSTACLE || barrier === CAN_OVER_OBSTACLE;
  }

  /**
   * 调试方法：获取瓦片的障碍信息
   */
  debugGetTileBarrierInfo(col: number, row: number): string {
    if (!this.isTileInMapViewRange(col, row)) {
      return `tile(${col},${row}) 越界`;
    }
    const bt = this.getBarrierType(col, row); // 原始 byte
    const flags: string[] = [];
    if (bt === NONE) flags.push("NONE");
    if (bt === OBSTACLE) flags.push("OBSTACLE");
    if (bt === CAN_OVER_OBSTACLE) flags.push("CAN_OVER_OBSTACLE");
    if (bt === TRANS) flags.push("TRANS");
    if (bt === CAN_OVER_TRANS) flags.push("CAN_OVER_TRANS");
    if (bt === CAN_OVER) flags.push("CAN_OVER");
    if (flags.length === 0) flags.push(`unknown(0x${bt.toString(16)})`);
    const isCharObstacle =
      bt === TRANS || bt === CAN_OVER_TRANS || bt === OBSTACLE || bt === CAN_OVER_OBSTACLE;
    return `tile(${col},${row}) barrierType=0x${bt.toString(16)} [${flags.join("|") || "0"}] isCharObstacle=${isCharObstacle}`;
  }

  /**
   * 检查是否为角色跳跃障碍
   *
   *
   * 跳跃时可以越过 CanOver (0x20) 标志的瓦片
   */
  isObstacleForCharacterJump(col: number, row: number): boolean {
    if (!this.isTileInMapViewRange(col, row)) {
      return true; // 越界视为障碍
    }
    const barrier = this.getBarrierType(col, row); // 原始 byte，与 C++ 一致
    // C++ exact-value: canJump 只被 toTrans(0x40) 和 toObstacle(0x80) 阻挡
    // toJumpTrans(0x60) 和 toJumpOpaque(0xA0) 均允许跳跃越过
    return barrier === TRANS || barrier === OBSTACLE;
  }

  /**
   * 检查是否为武功障碍
   *
   *
   * 武功可以穿过 Trans (0x40) 标志的瓦片
   */
  isObstacleForMagic(col: number, row: number): boolean {
    if (!this.isTileInMapViewRange(col, row)) {
      return true; // 越界视为障碍
    }
    const barrier = this.getBarrierType(col, row); // 原始 byte，与 C++ 一致
    // C++ exact-value: canFly 只被 toObstacle(0x80) 和 toJumpOpaque(0xA0) 阻挡
    // NONE(0x00)/CAN_OVER(0x20)/TRANS(0x40)/CAN_OVER_TRANS(0x60) 均允许武功通过
    return barrier === OBSTACLE || barrier === CAN_OVER_OBSTACLE;
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
      const engine = this.engine;
      if (engine.npcManager.isObstacle(tile.x, tile.y)) {
        return false;
      }
      // Obj 障碍
      const objManager = this.engine.objManager;
      if (objManager.isObstacle(tile.x, tile.y)) {
        return false;
      }
    } catch {
      // engine not initialized
      // 引擎未初始化，只检查地图障碍
    }

    return true;
  }

  // ============= 坐标转换（实例方法，兼容接口）=============

  /**
   * 检查瓦片是否为跳跃障碍（别名，兼容接口）
   */
  isObstacleForJump(x: number, y: number): boolean {
    return this.isObstacleForCharacterJump(x, y);
  }

  // ============= 陷阱系统 =============

  /**
   * 获取瓦片的陷阱索引
   *
   * @returns 陷阱索引，0 表示无陷阱
   */
  getTileTrapIndex(col: number, row: number): number {
    if (!this.isTileInMapViewRange(col, row)) {
      return 0;
    }
    return this.getTrapIndex(col, row);
  }

  /**
   * 获取瓦片的陷阱索引（Vector2 重载）
   */
  getTileTrapIndexVector(tilePosition: Vector2): number {
    return this.getTileTrapIndex(tilePosition.x, tilePosition.y);
  }

  /**
   * 进入地图时初始化陷阱状态
   *
   * 切地图（运行中）/ 新游戏 / 读档 Phase 2 都会走这里：
   * 1. 重建 _mapTrapTable[mapName]：从 MMF 内嵌的 trapTable 读取全量基础数据
   * 2. 重置 _snapshotTrap：clone(_groupTrap[mapName])
   *    （group 是跨地图常驻的；读档 Phase 4 会再覆盖一次正确的 snapshot）
   *
   * @param mapName 当前地图名（不含扩展名）
   */
  initTrapsForMap(mapName: string): void {
    // 1) MMF 基础全量
    const baseTable = new Map<number, string>();
    if (this._mapData && this._mapData.trapTable.length > 0) {
      for (const entry of this._mapData.trapTable) {
        baseTable.set(entry.trapIndex, entry.scriptPath);
      }
    }
    if (baseTable.size > 0) {
      this._mapTrapTable.set(mapName, baseTable);
    } else {
      this._mapTrapTable.delete(mapName);
    }

    // 2) snapshot = clone(group[mapName])
    this._snapshotTrap.clear();
    const group = this._groupTrap.get(mapName);
    if (group) {
      for (const [k, v] of group) this._snapshotTrap.set(k, v);
    }

    logger.log(
      `[MapBase] initTrapsForMap "${mapName}": base=${baseTable.size}, snapshot(=group)=${this._snapshotTrap.size}`
    );
  }

  /**
   * 根据 snapshot → mapTable 顺序解析最终生效的脚本路径
   *
   * - snapshot 有 index 记录：以 snapshot 的值为准（""=屏蔽，非空=覆盖 MMF）
   * - 否则查 _mapTrapTable[map]（MMF 全量）
   *
   * group 只是持久化缓存，不参与触发判断（进入地图时已合并到 snapshot）。
   *
   * @returns 实际要执行的脚本文件名；null 表示不应触发
   */
  private resolveTrapScript(_mapName: string, index: number): string | null {
    if (this._snapshotTrap.has(index)) {
      const s = this._snapshotTrap.get(index)!;
      return s === "" ? null : s;
    }
    const base = this._mapTrapTable.get(_mapName);
    if (base?.has(index)) {
      const s = base.get(index)!;
      return s === "" ? null : s;
    }
    return null;
  }

  /**
   * SetMapTrap 脚本命令：写当前地图的运行时 snapshot。
   * 若 group 中已有该 index 的记录（包括 ""），则同时更新 group 保持持久缓存一致。
   */
  setMapTrap(index: number, trapFileName: string): void {
    this._snapshotTrap.set(index, trapFileName);
    const cur = this._mapFileNameWithoutExtension;
    if (cur) {
      const g = this._groupTrap.get(cur);
      if (g?.has(index)) {
        g.set(index, trapFileName);
      }
    }
  }

  /**
   * SetTrap 脚本命令：直接写指定地图的持久化缓存（跨地图常驻、立即进存档）
   * 写入 group，下次进入该地图时合并到 snapshot 生效。
   */
  setTrap(mapName: string, index: number, trapFileName: string): void {
    if (!mapName) return;
    let g = this._groupTrap.get(mapName);
    if (!g) {
      g = new Map();
      this._groupTrap.set(mapName, g);
    }
    g.set(index, trapFileName);
  }

  /**
   * SaveMapTrap 脚本命令：把当前 snapshot 整体提交到 _groupTrap[currentMap]
   * 实现"脚本运行时把临时改动持久化"的语义。
   */
  commitSnapshotToGroup(): void {
    const cur = this._mapFileNameWithoutExtension;
    if (!cur) return;
    const g = new Map<number, string>();
    for (const [k, v] of this._snapshotTrap) g.set(k, v);
    this._groupTrap.set(cur, g);
    logger.log(`[MapBase] SaveMapTrap committed ${g.size} entries to group["${cur}"]`);
  }

  /**
   * 检查瓦片是否有可触发的陷阱脚本
   */
  hasTrapScript(tilePosition: Vector2): boolean {
    const index = this.getTileTrapIndexVector(tilePosition);
    if (index === 0) return false;
    const map = this._mapFileNameWithoutExtension;
    if (!map) return false;
    return this.resolveTrapScript(map, index) !== null;
  }

  /**
   * 运行瓦片陷阱脚本
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

    const mapName = this._mapFileNameWithoutExtension;
    if (!mapName) return false;

    const trapScriptName = this.resolveTrapScript(mapName, trapIndex);
    if (!trapScriptName) return false;

    logger.log(
      `[MapBase] Triggering trap ${trapIndex} at tile (${tilePosition.x}, ${tilePosition.y})`
    );

    onTrapTriggered?.();

    this._isInRunMapTrap = true;
    this._currentTrapIndex = trapIndex;

    // 标记"本地图内已触发"：写入 snapshot[N] = ""
    // group 只是持久化缓存，不参与触发流程，无需清空。
    this._snapshotTrap.set(trapIndex, "");

    const basePath = getScriptBasePath();
    const scriptPath = resolveScriptPath(basePath, trapScriptName);
    logger.log(`[MapBase] Running trap script: ${scriptPath}`);
    runScript(scriptPath);

    return true;
  }

  /**
   * 检查是否正在执行陷阱脚本
   */
  get isInRunMapTrap(): boolean {
    return this._isInRunMapTrap;
  }

  /**
   * 设置陷阱执行状态
   */
  set isInRunMapTrap(value: boolean) {
    this._isInRunMapTrap = value;
    if (!value) this._currentTrapIndex = -1;
  }

  /**
   * 当前正在执行的陷阱索引（-1 = 无陷阱执行中）
   */
  get currentTrapIndex(): number {
    return this._currentTrapIndex;
  }

  /**
   * 清空所有陷阱状态（新游戏时调用）
   */
  clearAll(): void {
    this._mapTrapTable.clear();
    this._groupTrap.clear();
    this._snapshotTrap.clear();
    this._currentTrapIndex = -1;
    this._isInRunMapTrap = false;
  }

  /**
   * 检查瓦片是否有陷阱脚本（带外部 mapData 参数）
   * 用于 GameManager 等没有直接访问 MapBase.Instance 的场景
   */
  hasTrapScriptWithMapData(
    tile: Vector2,
    mapData: MiuMapData | null,
    currentMapName: string
  ): boolean {
    if (!mapData) return false;
    const tileIndex = tile.x + tile.y * mapData.mapColumnCounts;
    const trapIndex = mapData.traps[tileIndex];
    if (trapIndex <= 0) return false;
    return this.resolveTrapScript(currentMapName, trapIndex) !== null;
  }

  /**
   * 检查并触发陷阱
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
  checkTrap(
    tile: Vector2,
    mapData: MiuMapData | null,
    currentMapName: string,
    _isScriptRunning: () => boolean,
    isWaitingForInput: () => boolean,
    getScriptBasePath: () => string,
    runScript: (scriptPath: string) => void,
    onTrapTriggered?: () => void
  ): boolean {
    if (!mapData) return false;

    // Don't run trap if already in trap script execution
    if (this._isInRunMapTrap) return false;

    // Don't run traps if waiting for input (dialog, selection, etc.)
    if (isWaitingForInput()) return false;

    const tileIndex = tile.x + tile.y * mapData.mapColumnCounts;
    const trapIndex = mapData.traps[tileIndex];
    if (trapIndex <= 0) return false;

    const trapScriptName = this.resolveTrapScript(currentMapName, trapIndex);
    if (!trapScriptName) return false;

    logger.log(
      `[MapBase] Triggering trap ${trapIndex} at tile (${tile.x}, ${tile.y}) on map "${currentMapName}"`
    );

    this._isInRunMapTrap = true;
    this._currentTrapIndex = trapIndex;

    // 标记"本地图内已触发"。group 只是持久化缓存，不参与触发流程，无需清空。
    this._snapshotTrap.set(trapIndex, "");

    onTrapTriggered?.();

    const basePath = getScriptBasePath();
    const scriptPath = resolveScriptPath(basePath, trapScriptName);
    logger.log(`[MapBase] Running trap script: ${scriptPath}`);
    runScript(scriptPath);

    return true;
  }

  /**
   * 调试输出陷阱信息
   */
  debugLogTraps(mapData: MiuMapData | null, currentMapName: string): void {
    if (!mapData) return;
    const totalTiles = mapData.mapColumnCounts * mapData.mapRowCounts;
    let tileCount = 0;
    for (let i = 0; i < totalTiles; i++) {
      if (mapData.traps[i] > 0) tileCount++;
    }
    const baseSize = this._mapTrapTable.get(currentMapName)?.size ?? 0;
    const groupSize = this._groupTrap.get(currentMapName)?.size ?? 0;
    logger.debug(
      `[MapBase] Traps "${currentMapName}": ${tileCount} tiles, base=${baseSize}, group=${groupSize}, snapshot=${this._snapshotTrap.size}`
    );
  }

  // ============= 图层控制 =============

  /**
   * 设置图层是否绘制
   *
   */
  setLayerDraw(layer: number, isDraw: boolean): void {
    if (layer < 0 || layer > MAX_LAYER - 1) return;
    this._isLayerDraw[layer] = isDraw;
  }

  /**
   * 检查图层是否绘制
   *
   */
  isLayerDraw(layer: number): boolean {
    if (layer < 0 || layer > MAX_LAYER - 1) return false;
    return this._isLayerDraw[layer];
  }

  /**
   * 切换图层绘制状态
   *
   */
  switchLayerDraw(layer: number): void {
    this.setLayerDraw(layer, !this.isLayerDraw(layer));
  }

  // ============= 地图加载/释放 =============

  /**
   * 设置地图信息（地图加载后调用）
   * 的后半部分
   */
  setMapInfo(mapFileName: string): void {
    const pathParts = mapFileName.split("/");
    const fileName = pathParts[pathParts.length - 1];
    this._mapFileName = fileName;
    this._mapFileNameWithoutExtension = fileName.replace(/\.[^.]+$/, "");
    logger.log(`[MapBase] Map info set: ${this._mapFileNameWithoutExtension}`);
  }

  /**
   * 释放地图资源
   *
   */
  free(): void {
    this._mapData = null;
    this._isOk = false;
  }

  /**
   * 获取随机位置
   *
   */
  getRandPosition(tilePosition: Vector2, max: number): Vector2 {
    const randPosition: Vector2 = { x: 0, y: 0 };
    let maxTry = 10;

    do {
      maxTry--;
      randPosition.x = tilePosition.x + Math.floor(Math.random() * (2 * max + 1)) - max;
      randPosition.y = tilePosition.y + Math.floor(Math.random() * (2 * max + 1)) - max;
    } while (!this.isTileInMapRange(randPosition.x, randPosition.y) && maxTry >= 0);

    return maxTry < 0 ? { x: 0, y: 0 } : randPosition;
  }

  // ============= 陷阱数据存档/读档 =============

  /** 调试用：返回当前 snapshot 中已记录的 trap index 列表 */
  getSnapshotTrapIndices(): number[] {
    return Array.from(this._snapshotTrap.keys());
  }

  /** 调试用：返回当前 _snapshotTrap 的完整 KV 拷贝 */
  getSnapshotTrapEntries(): Record<number, string> {
    const out: Record<number, string> = {};
    for (const [k, v] of this._snapshotTrap) out[k] = v;
    return out;
  }

  /** 调试用：返回指定地图（默认当前地图）的 _groupTrap KV 拷贝 */
  getGroupTrapEntries(mapName?: string): Record<number, string> {
    const name = mapName ?? this._mapFileNameWithoutExtension;
    if (!name) return {};
    const m = this._groupTrap.get(name);
    if (!m) return {};
    const out: Record<number, string> = {};
    for (const [k, v] of m) out[k] = v;
    return out;
  }

  /**
   * 从存档数据恢复陷阱状态
   *
   * 调用时机：读档 Phase 4（Phase 2 已经在 initTrapsForMap 中重建了 _mapTrapTable，
   * 此时 _groupTrap 还是空的，_snapshotTrap 也基于空的 group 初始化为空）。
   * 此方法用存档里的 group 和 snapshot 覆盖。
   *
   * @param groups 持久化缓存（mapName → { trapIndex → scriptFile }）
   * @param snapshot 当前地图运行时表
   *   - 新格式：Record<number, string>（""=屏蔽，非空=覆盖）
   *   - 旧格式（兼容）：number[]，每个元素按 idx→"" 处理
   */
  loadTrapsFromSave(
    groups: Record<string, Record<number, string>> | undefined,
    snapshot: Record<number, string> | number[] | undefined
  ): void {
    // 重建 _groupTrap
    this._groupTrap.clear();
    if (groups) {
      for (const mapName in groups) {
        const obj = groups[mapName];
        const m = new Map<number, string>();
        for (const k in obj) {
          m.set(parseInt(k, 10), obj[k]);
        }
        if (m.size > 0) this._groupTrap.set(mapName, m);
      }
      logger.debug(`[MapBase] Restored group trap for ${this._groupTrap.size} maps`);
    }

    // 重建 _snapshotTrap
    this._snapshotTrap.clear();
    if (Array.isArray(snapshot)) {
      // 旧存档格式：number[] 表示"已触发的 index 列表"，统一按 ""=屏蔽恢复
      for (const idx of snapshot) {
        this._snapshotTrap.set(idx, "");
      }
      logger.debug(`[MapBase] Restored ${snapshot.length} snapshot trap entries (legacy)`);
    } else if (snapshot) {
      for (const k in snapshot) {
        this._snapshotTrap.set(parseInt(k, 10), snapshot[k]);
      }
      logger.debug(`[MapBase] Restored ${Object.keys(snapshot).length} snapshot trap entries`);
    }
  }

  /**
   * 收集陷阱数据用于存档
   * @returns snapshot: 当前地图运行时表（Record<idx,script>），groups: 持久化缓存
   */
  collectTrapDataForSave(): {
    snapshot: Record<number, string>;
    groups: Record<string, Record<number, string>>;
  } {
    const groups: Record<string, Record<number, string>> = {};
    for (const [mapName, m] of this._groupTrap) {
      if (m.size > 0) {
        const obj: Record<number, string> = {};
        for (const [idx, script] of m) obj[idx] = script;
        groups[mapName] = obj;
      }
    }

    const snapshot: Record<number, string> = {};
    for (const [idx, script] of this._snapshotTrap) snapshot[idx] = script;

    return { snapshot, groups };
  }

  /**
   * 重置所有陷阱状态（新游戏/读档时在 Phase 1 调用）
   */
  resetTrapState(): void {
    this._mapTrapTable.clear();
    this._groupTrap.clear();
    this._snapshotTrap.clear();
    this._currentTrapIndex = -1;
    this._isInRunMapTrap = false;
  }
}
