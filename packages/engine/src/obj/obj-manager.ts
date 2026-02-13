/**
 * ObjManager - based on JxqyHD Engine/ObjManager.cs
 * Manages interactive objects on the map (herbs, tombstones, chests, etc.)
 *
 * Object file format (.obj):
 * @see storage.ts for ObjSaveItem interface
 * [Head]
 * Map=xxx.map
 * Count=n
 *
 * [OBJ000]
 * ObjName=name
 * ObjFile=obj-xxx.ini    <- Reference to objres file
 * Kind=0                  <- 0=Dynamic, 1=Static, 2=Body, 5=Door, 6=Trap, 7=Drop
 * MapX=x
 * MapY=y
 * Dir=0
 * OffX=0
 * OffY=0
 * ScriptFile=xxx.txt
 * ...
 *
 * ObjRes file format (ini/objres/xxx.ini):
 * [Common]
 * Image=moc001_xxx.asf   <- ASF image in asf/object/
 * Sound=xxx.wav
 *
 * === Obj State Persistence ===
 * When objects are modified (script changed, removed, etc.), we save their state
 * in memory. When reloading the same map, we restore the saved state.
 * This prevents issues like re-opening chests after map transitions.
 *
 * === 3D Spatial Audio ===
 * Objects with Kind=LoopingSound (3) or Kind=RandSound (4) play positional audio.
 * The audio position is relative to the player (listener) for 3D effect.
 * Reference: Obj.UpdateSound(), Obj.PlaySound(), Obj.PlayRandSound()
 */

import type { AudioManager } from "../audio";
import { ResourcePath } from "../resource/resource-paths";
import { EngineAccess } from "../core/engine-access";
import { logger } from "../core/logger";
import type { Vector2 } from "../core/types";
import { getGameSlug } from "../resource/resource-loader";
import { loadAsf } from "../resource/format/asf";
import type { ObjSaveItem } from "../storage/storage";
import type { IRenderer } from "../renderer/i-renderer";
import { Obj, type ObjKind, ObjState } from "./obj";
import { getObjConfigFromCache, getObjResFromCache, type ObjResInfo } from "./obj-config-loader";

// Re-export types
export { Obj, ObjKind, ObjState } from "./obj";
export type { ObjResInfo } from "./obj-config-loader";

/**
 * Saved state for an Obj (persists across map changes)
 * Only stores modifications from the original state
 */
interface ObjSavedState {
  scriptFile: string; // Current script file (empty = no script)
  isRemoved: boolean; // Whether the object was removed
  currentFrameIndex: number; // Current animation frame (e.g., opened box)
}

export class ObjManager extends EngineAccess {
  // private static LinkedList<Obj> _list = new LinkedList<Obj>();
  // 使用数组而不是 Map，，允许多个对象（包括同类尸体）
  private objects: Obj[] = [];
  private fileName: string = "";

  /**
   * Obj 分组存储
   * 模拟 C# 原版的 save/game/{fileName} 文件系统
   * 脚本调用 SaveObj() 时将当前 Obj 列表序列化存入，LoadObj() 时优先从此读取
   */
  private objGroups: Map<string, ObjSaveItem[]> = new Map();

  // === 性能优化：预计算视野内物体 ===
  // ObjManager._objInView, UpdateObjsInView()
  // 在 Update 阶段预计算，Render 阶段直接使用
  private _objsInView: Obj[] = [];
  private _objsByRow: Map<number, Obj[]> = new Map();

  private get audioManager(): AudioManager {
    return this.engine.audio;
  }

  /**
   * Saved Obj states - persists across map changes
   * Key format: "mapFileName_objId" (e.g., "jue001.obj_OBJ001_宝箱_25_58")
   * This allows the same obj file to be used on different maps
   */
  private savedObjStates: Map<string, ObjSavedState> = new Map();

  /**
   * Get the storage key for an obj state
   */
  private getObjStateKey(objId: string): string {
    return `${this.fileName}_${objId}`;
  }

  /**
   * Save the current state of an obj (call when modified)
   * Note: This preserves the frame from existing saved state to avoid
   * overwriting target frames set by openBox/closeBox
   */
  private saveObjState(obj: Obj): void {
    const key = this.getObjStateKey(obj.id);
    const existing = this.savedObjStates.get(key);
    // Preserve the frame from existing saved state if it exists
    // This prevents SetObjScript from overwriting the frame set by OpenBox/CloseBox
    const frameToSave = existing?.currentFrameIndex ?? obj.currentFrameIndex;
    this.savedObjStates.set(key, {
      scriptFile: obj.scriptFile,
      isRemoved: obj.isRemoved,
      currentFrameIndex: frameToSave,
    });
  }

  /**
   * Save the state of an obj with a specific frame (for openBox/closeBox)
   * This saves the target frame rather than current frame
   */
  private saveObjStateWithFrame(obj: Obj, targetFrame: number): void {
    const key = this.getObjStateKey(obj.id);
    this.savedObjStates.set(key, {
      scriptFile: obj.scriptFile,
      isRemoved: obj.isRemoved,
      currentFrameIndex: targetFrame,
    });
  }

  /**
   * Restore saved state to an obj (call after loading)
   * @returns true if state was restored
   */
  private restoreObjState(obj: Obj): boolean {
    const key = this.getObjStateKey(obj.id);
    const saved = this.savedObjStates.get(key);
    if (saved) {
      obj.scriptFile = saved.scriptFile;
      obj.isRemoved = saved.isRemoved;
      obj.currentFrameIndex = saved.currentFrameIndex;
      return true;
    }
    return false;
  }

  /**
   * Load objects for a given scene key
   *  - tries groups store first (saved by SaveObj), then Scene API
   */
  async load(fileName: string): Promise<boolean> {
    logger.log(`[ObjManager] Loading obj file: ${fileName}`);
    this.clearAll();
    this.fileName = fileName;

    // 1. 优先从 Obj 分组存储加载（模拟 C# 的 save/game/ 目录）
    const storedData = this.objGroups.get(fileName);
    if (storedData) {
      logger.log(`[ObjManager] Loading ${storedData.length} Objs from groups: ${fileName}`);
      for (const objData of storedData) {
        if (objData.isRemoved) continue;
        await this.createObjFromSaveData(objData);
      }
      logger.log(`[ObjManager] Loaded ${this.objects.length} objects from groups`);
      return true;
    }

    // 2. 从 Scene API 加载（数据库存储的 OBJ JSON 数据）
    const gameSlug = getGameSlug();
    const sceneKey = this.engine.getCurrentMapName();
    if (gameSlug && sceneKey) {
      try {
        const apiUrl = `/game/${gameSlug}/api/scenes/obj/${encodeURIComponent(sceneKey)}/${encodeURIComponent(fileName)}`;
        const response = await fetch(apiUrl);
        if (response.ok) {
          const entries: Array<Record<string, unknown>> = await response.json();
          if (entries.length > 0) {
            logger.log(`[ObjManager] Loading ${entries.length} objs from API: ${apiUrl}`);
            const loadPromises: Promise<void>[] = [];
            for (let i = 0; i < entries.length; i++) {
              const e = entries[i];
              const sectionName = `OBJ${String(i).padStart(3, "0")}`;
              loadPromises.push(this.createObjFromJsonEntry(sectionName, e));
            }
            await Promise.all(loadPromises);
          }
          logger.log(`[ObjManager] Loaded ${this.objects.length} objects from API: ${fileName}`);
          return true;
        }
      } catch (error) {
        logger.error(`[ObjManager] Scene API error for ${fileName}:`, error);
      }
    } else {
      logger.warn(`[ObjManager] Cannot load from API: gameSlug=${gameSlug}, sceneKey=${sceneKey}`);
    }

    logger.error(`[ObjManager] Failed to load obj file: ${fileName}`);
    return false;
  }

  /**
  /**
   * 为 Obj 加载资源（objres 配置和 ASF 纹理）
   * 统一的资源加载逻辑，供各创建方法调用
   */
  private async loadObjResources(obj: Obj): Promise<void> {
    if (!obj.objFileName) return;

    // 从 API 缓存加载 objres 配置
    const resInfo = getObjResFromCache(obj.objFileName);
    if (!resInfo) return;

    obj.objFile.set(ObjState.Common, resInfo);

    // 加载 ASF 纹理
    if (resInfo.imagePath) {
      const asfPath = ResourcePath.asfObject(resInfo.imagePath);
      const asf = await loadAsf(asfPath);
      if (asf) {
        obj.setAsfTexture(asf);
      }
    }

    // 从 objres 设置音效（如果 obj ini 中没有设置）
    if (resInfo.soundPath && !obj.wavFile) {
      obj.wavFile = resInfo.soundPath;
    }
  }

  /**
   * Add a single object
   * public static void AddObj(Obj obj) { if (obj != null) _list.AddLast(obj); }
   */
  addObj(obj: Obj): void {
    if (obj) {
      this.objects.push(obj);
    }
  }

  /**
   * 从 API 缓存创建 Obj 并添加到指定位置
   * 用于脚本命令 AddObj
   */
  async addObjByFile(
    fileName: string,
    tileX: number,
    tileY: number,
    direction: number
  ): Promise<void> {
    try {
      const config = getObjConfigFromCache(fileName);
      if (!config) {
        logger.warn(`[ObjManager] addObjByFile: config not found in cache for ${fileName}`);
        return;
      }

      const obj = new Obj();
      obj.loadFromConfig(config);
      obj.setTilePosition(tileX, tileY);
      obj.dir = direction;
      obj.id = `added_${fileName}_${tileX}_${tileY}_${Date.now()}`;
      obj.fileName = fileName;

      // 从 config 中直接加载资源（API 缓存已合并 objres）
      if (config.image) {
        const resInfo: ObjResInfo = { imagePath: config.image, soundPath: config.sound };
        obj.objFile.set(ObjState.Common, resInfo);

        const asfPath = ResourcePath.asfObject(config.image);
        const asf = await loadAsf(asfPath);
        if (asf) {
          obj.setAsfTexture(asf);
        }
      }

      if (config.sound && !obj.wavFile) {
        obj.wavFile = config.sound;
      }

      this.objects.push(obj);
    } catch (error) {
      logger.error(`Error adding obj from file ${fileName}:`, error);
    }
  }

  /**
   * Get object by name
   * public static Obj GetObj(string objName)
   */
  getObj(name: string): Obj | undefined {
    for (const obj of this.objects) {
      if (obj.objName === name) {
        return obj;
      }
    }
    return undefined;
  }

  /**
   * Get object by id
   */
  getObjById(id: string): Obj | undefined {
    return this.objects.find((obj) => obj.id === id);
  }

  /**
   * Get objects at tile position
   * public static List<Obj> getObj(Vector2 tilePos)
   */
  getObjsAtPosition(tile: Vector2): Obj[] {
    const result: Obj[] = [];
    for (const obj of this.objects) {
      if (obj.tilePosition.x === tile.x && obj.tilePosition.y === tile.y) {
        result.push(obj);
      }
    }
    return result;
  }

  /**
   * Check if tile has obstacle
   * Matches ObjManager.IsObstacle
   */
  isObstacle(tileX: number, tileY: number): boolean {
    for (const obj of this.objects) {
      if (obj.isRemoved) continue; // Skip removed objects
      if (obj.tilePosition.x === tileX && obj.tilePosition.y === tileY) {
        if (obj.isObstacle) {
          return true;
        }
      }
    }
    return false;
  }

  // === 性能优化：预计算视野内物体 ===

  /**
   * 在 Update 阶段预计算视野内物体（每帧调用一次）
   * Reference: ObjManager.UpdateObjsInView()
   * 同时按行分组，供交错渲染使用
   */
  updateObjsInView(viewRect: { x: number; y: number; width: number; height: number }): void {
    // 清空上一帧的缓存
    this._objsInView.length = 0;
    this._objsByRow.clear();

    const padding = 200;
    const viewLeft = viewRect.x - padding;
    const viewRight = viewRect.x + viewRect.width + padding;
    const viewTop = viewRect.y - padding;
    const viewBottom = viewRect.y + viewRect.height + padding;

    for (const obj of this.objects) {
      if (!obj.isShow || obj.isRemoved) continue;

      const pixelPos = obj.positionInWorld;

      if (
        pixelPos.x >= viewLeft &&
        pixelPos.x <= viewRight &&
        pixelPos.y >= viewTop &&
        pixelPos.y <= viewBottom
      ) {
        this._objsInView.push(obj);

        // 同时按行分组（用于交错渲染）
        const row = obj.tilePosition.y;
        let list = this._objsByRow.get(row);
        if (!list) {
          list = [];
          this._objsByRow.set(row, list);
        }
        list.push(obj);
      }
    }
  }

  /**
   * 获取预计算的视野内物体列表（只读）
   * property
   * 在 Render 阶段使用，避免重复计算
   */
  get objsInView(): readonly Obj[] {
    return this._objsInView;
  }

  /**
   * 获取指定行的物体列表（用于交错渲染）
   * 返回预计算的结果，避免每帧重建 Map
   */
  getObjsAtRow(row: number): readonly Obj[] {
    return this._objsByRow.get(row) ?? [];
  }

  /**
   * Get all objects in view area
   * 注意：渲染时优先使用预计算的 objsInView 和 getObjsAtRow
   */
  getObjsInView(viewRect: { x: number; y: number; width: number; height: number }): Obj[] {
    const result: Obj[] = [];
    for (const obj of this.objects) {
      if (!obj.isShow || obj.isRemoved) continue;

      // Calculate pixel position
      const pixelPos = obj.positionInWorld;

      // Check if in view (with some padding for large objects)
      const padding = 200;
      if (
        pixelPos.x >= viewRect.x - padding &&
        pixelPos.x <= viewRect.x + viewRect.width + padding &&
        pixelPos.y >= viewRect.y - padding &&
        pixelPos.y <= viewRect.y + viewRect.height + padding
      ) {
        result.push(obj);
      }
    }
    return result;
  }

  /**
   * Get all objects
   * public static LinkedList<Obj> ObjList { get { return _list; } }
   */
  getAllObjs(): Obj[] {
    return [...this.objects];
  }

  /**
   * Delete object by name
   * public static void DeleteObj(string objName)
   */
  deleteObj(name: string): void {
    for (let i = this.objects.length - 1; i >= 0; i--) {
      const obj = this.objects[i];
      if (obj.objName === name) {
        obj.isRemoved = true; // sets IsRemoved = true
        this.saveObjState(obj); // Persist state for map reload
        this.objects.splice(i, 1);
        logger.log(`[ObjManager] Deleted obj by name: ${name}`);
        // 不 break，会删除所有同名对象
      }
    }
  }

  /**
   * Delete object by id
   * = true
   */
  deleteObjById(id: string): void {
    const index = this.objects.findIndex((obj) => obj.id === id);
    if (index !== -1) {
      const obj = this.objects[index];
      obj.isRemoved = true; // sets IsRemoved = true
      this.saveObjState(obj); // Persist state for map reload
      this.objects.splice(index, 1);
      logger.log(`[ObjManager] Deleted obj by id: ${id} (${obj.objName})`);
    }
  }

  /**
   * Open a box (play animation forward)
   * -> PlayFrames(FrameEnd - CurrentFrameIndex)
   */
  openBox(objNameOrId: string): void {
    const obj = this.getObj(objNameOrId) || this.getObjById(objNameOrId);
    if (obj) {
      const targetFrame = obj.openBox();
      // Save target frame (not current frame) for proper state restoration
      this.saveObjStateWithFrame(obj, targetFrame);
      logger.log(`[ObjManager] OpenBox: ${obj.objName}, targetFrame=${targetFrame}`);
    }
  }

  /**
   * Close a box (play animation backward)
   * -> PlayFrames(CurrentFrameIndex - FrameBegin, true)
   */
  closeBox(objNameOrId: string): void {
    const obj = this.getObj(objNameOrId) || this.getObjById(objNameOrId);
    if (obj) {
      const targetFrame = obj.closeBox();
      // Save target frame (not current frame) for proper state restoration
      this.saveObjStateWithFrame(obj, targetFrame);
      logger.log(`[ObjManager] CloseBox: ${obj.objName}, targetFrame=${targetFrame}`);
    }
  }

  /**
   * Set script file for an object
   * target.ScriptFile = scriptFileName
   * When scriptFile is empty, the object becomes non-interactive
   */
  setObjScript(objNameOrId: string, scriptFile: string): void {
    // Try by name first, then by id
    const obj = this.getObj(objNameOrId) || this.getObjById(objNameOrId);
    if (obj) {
      obj.scriptFile = scriptFile;
      this.saveObjState(obj); // Persist state for map reload
      logger.log(`[ObjManager] SetObjScript: ${obj.objName} -> "${scriptFile}"`);
    } else {
      logger.warn(`[ObjManager] SetObjScript: Object not found: ${objNameOrId}`);
    }
  }

  /**
   * Clear all bodies (dead NPCs)
   * public static void ClearBody()
   */
  clearBodies(): void {
    for (let i = this.objects.length - 1; i >= 0; i--) {
      if (this.objects[i].isBody) {
        this.objects.splice(i, 1);
      }
    }
  }

  /**
   * Clear all objects
   * public static void ClearAllObjAndFileName()
   */
  clearAll(): void {
    // Stop all object sounds before clearing
    this.stopAllObjSounds();
    this.objects.length = 0;
    this.fileName = "";
    this.savedObjStates.clear();
  }

  /**
   * Debug: Print all obstacle objects
   */
  debugPrintObstacleObjs(): void {
    logger.log(`[ObjManager] Total objects: ${this.objects.length}, fileName: ${this.fileName}`);
    for (const obj of this.objects) {
      if (obj.isObstacle) {
        logger.log(
          `  Obstacle: "${obj.objName}" at (${obj.tilePosition.x}, ${obj.tilePosition.y}), kind=${obj.kind}, removed=${obj.isRemoved}`
        );
      }
    }
  }

  /**
   * Get current file name
   */
  getFileName(): string {
    return this.fileName;
  }

  /**
   * Set file name (用于从 JSON 存档加载时设置)
   */
  setFileName(fileName: string): void {
    this.fileName = fileName;
  }

  /**
   * 从 JSON 存档数据创建 Obj
   */
  async createObjFromSaveData(objData: {
    objName: string;
    kind: number;
    dir: number;
    mapX: number;
    mapY: number;
    damage: number;
    frame: number;
    height: number;
    lum: number;
    objFile: string;
    offX: number;
    offY: number;
    scriptFile?: string;
    scriptFileRight?: string;
    timerScriptFile?: string;
    timerScriptInterval?: number;
    scriptFileJustTouch: number;
    wavFile?: string;
    millisecondsToRemove: number;
    isRemoved: boolean;
  }): Promise<void> {
    if (objData.isRemoved) {
      logger.log(`[ObjManager] Skipping removed obj: ${objData.objName}`);
      return;
    }

    const obj = new Obj();
    obj.objName = objData.objName;
    obj.kind = objData.kind as ObjKind;
    obj.dir = objData.dir;
    obj.damage = objData.damage;
    obj.frame = objData.frame;
    obj.height = objData.height;
    obj.lum = objData.lum;
    obj.offX = objData.offX;
    obj.offY = objData.offY;
    obj.scriptFile = objData.scriptFile || "";
    obj.scriptFileRight = objData.scriptFileRight || "";
    obj.timerScriptFile = objData.timerScriptFile || "";
    obj.timerScriptInterval = objData.timerScriptInterval || 3000;
    obj.wavFile = objData.wavFile || "";
    obj.scriptFileJustTouch = objData.scriptFileJustTouch;
    obj.millisecondsToRemove = objData.millisecondsToRemove;
    obj.setTilePosition(objData.mapX, objData.mapY);
    obj.id = `save_${objData.objName}_${objData.mapX}_${objData.mapY}`;
    obj.objFileName = objData.objFile;

    await this.loadObjResources(obj);

    // 纹理加载后再设置帧号，避免 setter 的边界检查在 _frameEnd=0 时将帧号重置为 0
    obj.currentFrameIndex = objData.frame;

    this.objects.push(obj);
  }

  /**
   * 从 Scene API 的 JSON 条目创建 Obj
   * SceneObjEntry 使用 camelCase 字段名
   */
  private async createObjFromJsonEntry(
    sectionName: string,
    entry: Record<string, unknown>
  ): Promise<void> {
    const obj = new Obj();
    obj.objName = String(entry.objName ?? "");
    obj.kind = Number(entry.kind ?? 0) as ObjKind;
    obj.dir = Number(entry.dir ?? 0);
    obj.damage = Number(entry.damage ?? 0);
    obj.frame = Number(entry.frame ?? 0);
    obj.lum = Number(entry.lum ?? 0);
    obj.offX = Number(entry.offX ?? 0);
    obj.offY = Number(entry.offY ?? 0);
    obj.scriptFile = String(entry.scriptFile ?? "");
    obj.wavFile = String(entry.wavFile ?? "");
    obj.objFileName = String(entry.objFile ?? "");

    const mapX = Number(entry.mapX ?? 0);
    const mapY = Number(entry.mapY ?? 0);
    obj.setTilePosition(mapX, mapY);
    obj.id = `${sectionName}_${obj.objName}_${mapX}_${mapY}`;
    obj.fileName = this.fileName;

    await this.loadObjResources(obj);

    // 恢复保存的状态（用于地图重新加载时保持修改）
    const wasRestored = this.restoreObjState(obj);

    if (obj.isRemoved) {
      logger.log(`[ObjManager] Skipping removed obj: ${obj.objName} at (${mapX}, ${mapY})`);
      return;
    }

    if (obj.hasSound && (obj.isLoopingSound || obj.isRandSound)) {
      logger.log(
        `[ObjManager] Created sound obj: ${obj.objName} (kind=${obj.kind}, sound=${obj.wavFile}) at (${mapX}, ${mapY})`
      );
    } else {
      logger.log(
        `[ObjManager] Created obj: ${obj.objName} (kind=${obj.kind}) at (${mapX}, ${mapY}), texture=${obj.texture ? "loaded" : "null"}${wasRestored ? " [state restored]" : ""}`
      );
    }
    this.objects.push(obj);
  }

  /**
   * Get closest interactable object
   */
  getClosestInteractableObj(tile: Vector2, maxDistance: number = 3): Obj | null {
    let closest: Obj | null = null;
    let minDist = maxDistance;

    for (const obj of this.objects) {
      if (!obj.isShow || obj.isRemoved || !obj.hasInteractScript) continue;

      const dist = Math.abs(obj.tilePosition.x - tile.x) + Math.abs(obj.tilePosition.y - tile.y);
      if (dist <= minDist) {
        minDist = dist;
        closest = obj;
      }
    }

    return closest;
  }

  /**
   * Update all objects (animation, timers, sound, trap damage, etc.)
   * handles animation, timer scripts, removal, sound, trap
   *
   * Obj 现在通过 engine (IEngineContext) 直接访问 NpcManager、Player 和 ScriptExecutor，
   * 不再需要传入回调上下文。
   *
   * @param deltaTime Time since last update in seconds
   */
  update(deltaTime: number): void {
    for (const obj of this.objects) {
      if (obj.isRemoved) continue;

      // Call the object's update method (handles animation, timers, trap damage, etc.)
      // Obj 内部通过 this.engine 访问引擎服务
      obj.update(deltaTime);

      // Handle 3D spatial audio for sound objects
      // Reference: Obj.Update() switch on Kind for LoopingSound/RandSound
      if (this.audioManager && obj.hasSound) {
        this.updateObjSound(obj);
      }
    }
  }

  /**
   * Update sound for a single object
   * - UpdateSound() and PlaySound()/PlayRandSound()
   */
  private updateObjSound(obj: Obj): void {
    if (!this.audioManager || !obj.hasSound) return;

    const emitterPosition = obj.getSoundPosition();
    const soundFile = obj.getSoundFile();

    // Use Obj helper methods to check sound type
    if (obj.shouldPlayLoopingSound()) {
      // ObjKind.LoopingSound: UpdateSound(); PlaySound();
      // Looping sounds play continuously with 3D positioning
      this.audioManager.play3DSoundLoop(obj.soundId, soundFile, emitterPosition);
    } else if (obj.shouldPlayRandomSound()) {
      // ObjKind.RandSound: UpdateSound(); PlayRandSound();
      // Random sounds have 1/200 chance to play each frame
      // if (Globals.TheRandom.Next(0, 200) == 0) PlaySound();
      this.audioManager.play3DSoundRandom(obj.soundId, soundFile, emitterPosition, 0.005);
    }
    // Other object types don't auto-play sounds
    // They may play sounds via script commands
  }

  /**
   * Stop all object sounds (call when changing maps)
   */
  stopAllObjSounds(): void {
    for (const obj of this.objects) {
      if (obj.hasSound) {
        this.audioManager.stop3DSound(obj.soundId);
      }
    }
  }

  /**
   * Draw a single object
   */
  drawObj(renderer: IRenderer, obj: Obj, cameraX: number, cameraY: number): void {
    if (!obj.isShow || obj.isRemoved) return;

    obj.draw(renderer, cameraX, cameraY);
  }

  /**
   * Draw all objects in view
   * 使用预计算的 _objsInView 列表
   */
  drawAllObjs(renderer: IRenderer, cameraX: number, cameraY: number): void {
    // 使用预计算的视野内物体列表（已在 updateViewCache 中排序）
    for (const obj of this._objsInView) {
      this.drawObj(renderer, obj, cameraX, cameraY);
    }
  }

  /**
   * Save object state to memory file store
   * 将当前 Obj 列表序列化到内存文件存储中
   * 对应 C# 原版: ObjManager.Save(fileName) -> File.WriteAllText("save/game/" + fileName)
   *
   * 脚本流程: SaveObj() -> LoadMap() -> LoadObj(同文件名) -> 读到刚存的数据
   */
  async saveObj(fileName?: string): Promise<void> {
    const saveFileName = fileName || this.fileName;
    if (!saveFileName) {
      logger.warn("[ObjManager] SaveObj: No file name provided and no file loaded");
      return;
    }

    this.fileName = saveFileName;

    // 序列化当前所有 Obj 到分组存储
    const items = this.collectSnapshot();
    this.objGroups.set(saveFileName, items);

    logger.log(`[ObjManager] SaveObj: ${saveFileName} (${items.length} Objs saved to groups)`);
  }

  /**
   * 收集当前 Obj 快照为 ObjSaveItem[]
   */
  collectSnapshot(): ObjSaveItem[] {
    const items: ObjSaveItem[] = [];
    for (const obj of this.objects) {
      if (obj.isRemoved) continue;
      items.push({
        objName: obj.objName,
        kind: obj.kind,
        dir: obj.dir,
        mapX: obj.mapX,
        mapY: obj.mapY,
        damage: obj.damage,
        frame: obj.currentFrameIndex,
        height: obj.height,
        lum: obj.lum,
        objFile: obj.objFileName,
        offX: obj.offX,
        offY: obj.offY,
        scriptFile: obj.scriptFile || undefined,
        scriptFileRight: obj.scriptFileRight || undefined,
        timerScriptFile: obj.timerScriptFile || undefined,
        timerScriptInterval: obj.timerScriptInterval,
        scriptFileJustTouch: obj.scriptFileJustTouch,
        wavFile: obj.wavFile || undefined,
        millisecondsToRemove: obj.millisecondsToRemove,
        isRemoved: obj.isRemoved,
      });
    }
    return items;
  }

  /**
   * 获取 Obj 分组存储（用于 Loader 存档时持久化）
   */
  getObjGroups(): Map<string, ObjSaveItem[]> {
    return this.objGroups;
  }

  /**
   * 设置 Obj 分组存储（用于 Loader 读档时恢复）
   */
  setObjGroups(store: Record<string, ObjSaveItem[]>): void {
    this.objGroups.clear();
    for (const [key, value] of Object.entries(store)) {
      this.objGroups.set(key, value);
    }
  }

  /**
   * 清空 Obj 分组存储
   */
  clearObjGroups(): void {
    this.objGroups.clear();
  }
}
