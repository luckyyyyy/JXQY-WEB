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
 * C# Reference: Obj.UpdateSound(), Obj.PlaySound(), Obj.PlayRandSound()
 */

import type { AudioManager } from "../audio";
import { getEngineContext } from "../core/engineContext";
import { logger } from "../core/logger";
import type { Vector2 } from "../core/types";
import { parseIni } from "../core/utils";
import { resourceLoader } from "../resource/resourceLoader";
import { loadAsf } from "../sprite/asf";
import { Obj, type ObjKind, type ObjResInfo, ObjState } from "./obj";
import { ResourcePath } from "@/config/resourcePaths";

// Re-export types
export { Obj, ObjKind, type ObjResInfo, ObjState } from "./obj";

// Text decoder for GBK encoding (for .obj and .npc files which remain in GBK)
let textDecoder: TextDecoder | null = null;

function getTextDecoder(): TextDecoder {
  if (!textDecoder) {
    try {
      textDecoder = new TextDecoder("gbk");
    } catch {
      textDecoder = new TextDecoder("utf-8");
    }
  }
  return textDecoder;
}

/**
 * Saved state for an Obj (persists across map changes)
 * Only stores modifications from the original state
 */
interface ObjSavedState {
  scriptFile: string; // Current script file (empty = no script)
  isRemoved: boolean; // Whether the object was removed
  currentFrameIndex: number; // Current animation frame (e.g., opened box)
}

/**
 * Parse ObjRes INI content to ObjResInfo
 */
function parseObjResIni(content: string): ObjResInfo | null {
  const sections = parseIni(content);

  // Get the Common section (or first available state)
  const commonSection = sections.Common || sections.Open || Object.values(sections)[0];
  if (!commonSection) {
    return null;
  }

  return {
    imagePath: commonSection.Image || "",
    soundPath: commonSection.Sound || "",
  };
}

export class ObjManager {
  // C#: private static LinkedList<Obj> _list = new LinkedList<Obj>();
  // 使用数组而不是 Map，与 C# 保持一致，允许多个对象（包括同类尸体）
  private objects: Obj[] = [];
  private fileName: string = "";

  // === 性能优化：预计算视野内物体 ===
  // C# Reference: ObjManager._objInView, UpdateObjsInView()
  // 在 Update 阶段预计算，Render 阶段直接使用
  private _objsInView: Obj[] = [];
  private _objsByRow: Map<number, Obj[]> = new Map();

  /**
   * 获取 AudioManager（通过 IEngineContext）
   */
  private get audioManager(): AudioManager {
    const ctx = getEngineContext();
    return ctx.audio;
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
   * Load objects from an .obj file
   * Based on C# Utils.GetNpcObjFilePath - tries save/game/ first, then ini/save/
   */
  async load(fileName: string): Promise<boolean> {
    logger.log(`[ObjManager] Loading obj file: ${fileName}`);
    this.clearAll();
    this.fileName = fileName;

    // Try multiple paths like C# GetNpcObjFilePath
    const paths = [ResourcePath.saveGame(fileName), ResourcePath.iniSave(fileName)];

    for (const filePath of paths) {
      try {
        // .obj files are still GBK encoded - load as binary and decode with GBK
        const buffer = await resourceLoader.loadBinary(filePath);

        if (!buffer) {
          continue;
        }

        // Decode GBK content
        const content = getTextDecoder().decode(buffer);

        // Note: Unlike loadText, loadBinary doesn't detect HTML fallback
        // Check for Vite's HTML fallback manually
        if (content.trim().startsWith("<!DOCTYPE") || content.trim().startsWith("<html")) {
          continue;
        }

        logger.log(`[ObjManager] Parsing obj file from: ${filePath}`);
        await this.parseObjFile(content);
        logger.log(`[ObjManager] Loaded ${this.objects.length} objects`);
        return true;
      } catch (_error) {
        // Continue to next path
      }
    }

    logger.error(`[ObjManager] Failed to load obj file: ${fileName} (tried all paths)`);
    return false;
  }

  /**
   * Parse .obj file content
   */
  private async parseObjFile(content: string): Promise<void> {
    const sections = parseIni(content);
    logger.log(`[ObjManager] Found ${Object.keys(sections).length} sections in obj file`);

    // Process each OBJ section
    const loadPromises: Promise<void>[] = [];

    for (const sectionName in sections) {
      // Match OBJ followed by digits (e.g., OBJ000, OBJ001, etc.)
      if (/^OBJ\d+$/i.test(sectionName)) {
        const section = sections[sectionName];
        const promise = this.createObjFromSection(sectionName, section);
        loadPromises.push(promise);
      }
    }

    // Wait for all objects to load
    await Promise.all(loadPromises);
  }

  /**
   * 从 .obj 文件的 INI section 创建 Obj
   */
  private async createObjFromSection(
    sectionName: string,
    section: Record<string, string>
  ): Promise<void> {
    const obj = new Obj();
    obj.loadFromSection(section);

    const mapX = obj.tilePosition.x;
    const mapY = obj.tilePosition.y;
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
    // C#: _list.AddLast(obj)
    this.objects.push(obj);
  }

  /**
   * 为 Obj 加载资源（objres 配置和 ASF 纹理）
   * 统一的资源加载逻辑，供各创建方法调用
   */
  private async loadObjResources(obj: Obj): Promise<void> {
    if (!obj.objFileName) return;

    // 加载 objres 配置文件
    const filePath = ResourcePath.objRes(obj.objFileName);
    const resInfo = await resourceLoader.loadIni<ObjResInfo>(filePath, parseObjResIni, "objRes");
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
   * C#: public static void AddObj(Obj obj) { if (obj != null) _list.AddLast(obj); }
   */
  addObj(obj: Obj): void {
    if (obj) {
      this.objects.push(obj);
    }
  }

  /**
   * 从 ini/obj/ 文件创建 Obj 并添加到指定位置
   * 用于脚本命令 AddObj
   */
  async addObjByFile(
    fileName: string,
    tileX: number,
    tileY: number,
    direction: number
  ): Promise<void> {
    try {
      const filePath = ResourcePath.obj(fileName);
      const content = await resourceLoader.loadText(filePath);
      if (!content) return;

      const sections = parseIni(content);
      const initSection = sections.INIT || sections.Init || Object.values(sections)[0];
      if (!initSection) return;

      const obj = new Obj();
      obj.loadFromSection(initSection);
      obj.setTilePosition(tileX, tileY);
      obj.dir = direction;
      obj.id = `added_${fileName}_${tileX}_${tileY}_${Date.now()}`;
      obj.fileName = fileName;

      await this.loadObjResources(obj);
      this.objects.push(obj);
    } catch (error) {
      logger.error(`Error adding obj from file ${fileName}:`, error);
    }
  }

  /**
   * Get object by name
   * C#: public static Obj GetObj(string objName)
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
   * C#: public static List<Obj> getObj(Vector2 tilePos)
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
   * Matches C# ObjManager.IsObstacle
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
   * C# Reference: ObjManager.UpdateObjsInView()
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
   * C# Reference: ObjManager.ObjsInView property
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
   * C#: public static LinkedList<Obj> ObjList { get { return _list; } }
   */
  getAllObjs(): Obj[] {
    return [...this.objects];
  }

  /**
   * Delete object by name
   * C#: public static void DeleteObj(string objName)
   */
  deleteObj(name: string): void {
    for (let i = this.objects.length - 1; i >= 0; i--) {
      const obj = this.objects[i];
      if (obj.objName === name) {
        obj.isRemoved = true; // C# sets IsRemoved = true
        this.saveObjState(obj); // Persist state for map reload
        this.objects.splice(i, 1);
        logger.log(`[ObjManager] Deleted obj by name: ${name}`);
        // C# 不 break，会删除所有同名对象
      }
    }
  }

  /**
   * Delete object by id
   * C# Reference: Obj.IsRemoved = true
   */
  deleteObjById(id: string): void {
    const index = this.objects.findIndex((obj) => obj.id === id);
    if (index !== -1) {
      const obj = this.objects[index];
      obj.isRemoved = true; // C# sets IsRemoved = true
      this.saveObjState(obj); // Persist state for map reload
      this.objects.splice(index, 1);
      logger.log(`[ObjManager] Deleted obj by id: ${id} (${obj.objName})`);
    }
  }

  /**
   * Open a box (play animation forward)
   * C# Reference: Obj.OpenBox() -> PlayFrames(FrameEnd - CurrentFrameIndex)
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
   * C# Reference: Obj.CloseBox() -> PlayFrames(CurrentFrameIndex - FrameBegin, true)
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
   * C# Reference: ScriptExecuter.SetObjScript - target.ScriptFile = scriptFileName
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
   * C#: public static void ClearBody()
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
   * C#: public static void ClearAllObjAndFileName()
   */
  clearAll(): void {
    // Stop all object sounds before clearing
    this.stopAllObjSounds();
    this.objects.length = 0;
    this.fileName = "";
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
    this.objects.push(obj);
    // logger.log(
    //   `[ObjManager] Created obj from save: ${objData.objName} at (${objData.mapX}, ${objData.mapY})`
    // );
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
   * C# Reference: Obj.Update - handles animation, timer scripts, removal, sound, trap
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
      // C# Reference: Obj.Update() switch on Kind for LoopingSound/RandSound
      if (this.audioManager && obj.hasSound) {
        this.updateObjSound(obj);
      }
    }
  }

  /**
   * Update sound for a single object
   * C# Reference: Obj.Update() - UpdateSound() and PlaySound()/PlayRandSound()
   */
  private updateObjSound(obj: Obj): void {
    if (!this.audioManager || !obj.hasSound) return;

    const emitterPosition = obj.getSoundPosition();
    const soundFile = obj.getSoundFile();

    // Use Obj helper methods to check sound type
    if (obj.shouldPlayLoopingSound()) {
      // C# Reference: case ObjKind.LoopingSound: UpdateSound(); PlaySound();
      // Looping sounds play continuously with 3D positioning
      this.audioManager.play3DSoundLoop(obj.soundId, soundFile, emitterPosition);
    } else if (obj.shouldPlayRandomSound()) {
      // C# Reference: case ObjKind.RandSound: UpdateSound(); PlayRandSound();
      // Random sounds have 1/200 chance to play each frame
      // C#: if (Globals.TheRandom.Next(0, 200) == 0) PlaySound();
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
  drawObj(ctx: CanvasRenderingContext2D, obj: Obj, cameraX: number, cameraY: number): void {
    if (!obj.isShow || obj.isRemoved) return;

    obj.draw(ctx, cameraX, cameraY);
  }

  /**
   * Draw all objects in view
   * 使用预计算的 _objsInView 列表
   */
  drawAllObjs(ctx: CanvasRenderingContext2D, cameraX: number, cameraY: number): void {
    // 使用预计算的视野内物体列表（已在 updateViewCache 中排序）
    for (const obj of this._objsInView) {
      this.drawObj(ctx, obj, cameraX, cameraY);
    }
  }

  /**
   * Save object state to file
   * C#: ObjManager.Save - saves current objects to save file
   * Note: Web version uses localStorage/IndexedDB instead of file system
   */
  async saveObj(fileName?: string): Promise<void> {
    const saveFileName = fileName || this.fileName;
    if (!saveFileName) {
      logger.warn("[ObjManager] SaveObj: No file name provided and no file loaded");
      return;
    }
    logger.log(`[ObjManager] SaveObj: ${saveFileName} (stub - save system integration needed)`);
    // TODO: Integrate with save system when implemented
    // For now, this is a stub that logs the action
  }
}
