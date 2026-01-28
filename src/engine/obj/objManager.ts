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
import type { Vector2 } from "../core/types";
import { parseIni } from "../core/utils";
import { loadAsf, type AsfData } from "../sprite/asf";
import { Obj, ObjKind, ObjState, type ObjResInfo } from "./obj";
import type { AudioManager } from "../audio";

// Re-export types
export { ObjKind, ObjState, type ObjResInfo, Obj } from "./obj";

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
  scriptFile: string;       // Current script file (empty = no script)
  isRemoved: boolean;       // Whether the object was removed
  currentFrameIndex: number; // Current animation frame (e.g., opened box)
}

export class ObjManager {
  private objects: Map<string, Obj> = new Map();
  private fileName: string = "";
  private objResCache: Map<string, ObjResInfo> = new Map();
  private asfCache: Map<string, AsfData | null> = new Map();

  /**
   * Audio manager reference for 3D spatial audio
   * C# Reference: Obj uses SoundManager.Apply3D for positional audio
   */
  private audioManager: AudioManager | null = null;

  /**
   * Saved Obj states - persists across map changes
   * Key format: "mapFileName_objId" (e.g., "jue001.obj_OBJ001_宝箱_25_58")
   * This allows the same obj file to be used on different maps
   */
  private savedObjStates: Map<string, ObjSavedState> = new Map();

  /**
   * Set audio manager for 3D sound support
   */
  setAudioManager(audioManager: AudioManager): void {
    this.audioManager = audioManager;
  }

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
    console.log(`[ObjManager] Loading obj file: ${fileName}`);
    this.clearAll();
    this.fileName = fileName;

    // Try multiple paths like C# GetNpcObjFilePath
    const paths = [
      `/resources/save/game/${fileName}`,
      `/resources/ini/save/${fileName}`,
    ];

    for (const filePath of paths) {
      try {
        const response = await fetch(filePath);

        if (!response.ok) {
          continue;
        }

        // Check if it's actually an INI file (not Vite's HTML fallback)
        const contentType = response.headers.get('content-type') || '';
        if (contentType.includes('text/html')) {
          continue;
        }

        // .obj files remain in GBK encoding
        const buffer = await response.arrayBuffer();
        const content = getTextDecoder().decode(new Uint8Array(buffer));

        // Check if content is HTML
        if (content.trim().startsWith('<!DOCTYPE') || content.trim().startsWith('<html')) {
          continue;
        }

        console.log(`[ObjManager] Parsing obj file from: ${filePath}`);
        await this.parseObjFile(content);
        console.log(`[ObjManager] Loaded ${this.objects.size} objects`);
        return true;
      } catch (error) {
        // Continue to next path
      }
    }

    console.error(`[ObjManager] Failed to load obj file: ${fileName} (tried all paths)`);
    return false;
  }

  /**
   * Parse .obj file content
   */
  private async parseObjFile(content: string): Promise<void> {
    const sections = parseIni(content);
    console.log(`[ObjManager] Found ${Object.keys(sections).length} sections in obj file`);

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
   * Create an Obj from INI section
   */
  private async createObjFromSection(
    sectionName: string,
    section: Record<string, string>
  ): Promise<void> {
    const obj = new Obj();

    // Load basic properties from section
    obj.loadFromSection(section);

    // Create unique id for the object
    const mapX = obj.tilePosition.x;
    const mapY = obj.tilePosition.y;
    const id = `${sectionName}_${obj.objName}_${mapX}_${mapY}`;
    obj.id = id;
    obj.fileName = this.fileName;

    // Load the objres file to get the image and sound paths
    if (obj.objFileName) {
      const resInfo = await this.loadObjRes(obj.objFileName);
      if (resInfo) {
        obj.objFile.set(ObjState.Common, resInfo);
        // Load the ASF
        if (resInfo.imagePath) {
          const asf = await this.loadObjAsf(resInfo.imagePath);
          if (asf) {
            obj.setAsfTexture(asf);
          }
        }
        // Set sound file from objres (if not already set from obj ini)
        // C# Reference: Obj.WavFile can come from obj.ini or objres.ini
        if (resInfo.soundPath && !obj.wavFile) {
          obj.wavFile = resInfo.soundPath;
        }
      }
    }

    // Restore saved state if exists (for objects modified in previous visits)
    const wasRestored = this.restoreObjState(obj);

    // Skip adding removed objects
    if (obj.isRemoved) {
      console.log(`[ObjManager] Skipping removed obj: ${obj.objName} at (${mapX}, ${mapY})`);
      return;
    }

    // Log sound object creation
    if (obj.hasSound && (obj.isLoopingSound || obj.isRandSound)) {
      console.log(`[ObjManager] Created sound obj: ${obj.objName} (kind=${obj.kind}, sound=${obj.wavFile}) at (${mapX}, ${mapY})`);
    } else {
      console.log(`[ObjManager] Created obj: ${obj.objName} (kind=${obj.kind}) at (${mapX}, ${mapY}), texture=${obj.texture ? "loaded" : "null"}${wasRestored ? " [state restored]" : ""}`);
    }
    this.objects.set(id, obj);
  }

  /**
   * Load ObjRes file from ini/objres/ directory
   */
  private async loadObjRes(objFileName: string): Promise<ObjResInfo | null> {
    // Check cache
    const cached = this.objResCache.get(objFileName);
    if (cached) {
      return cached;
    }

    try {
      const filePath = `/resources/ini/objres/${objFileName}`;
      const response = await fetch(filePath);
      if (!response.ok) {
        console.warn(`[ObjManager] Failed to load objres file: ${filePath}`);
        return null;
      }

      // INI files in resources are now UTF-8 encoded
      const content = await response.text();

      const sections = parseIni(content);

      // Get the Common section (or first available state)
      const commonSection = sections.Common || sections.Open || Object.values(sections)[0];
      if (!commonSection) {
        console.warn(`[ObjManager] No valid section in objres file: ${objFileName}`);
        return null;
      }

      const resInfo: ObjResInfo = {
        imagePath: commonSection.Image || "",
        soundPath: commonSection.Sound || "",
      };

      this.objResCache.set(objFileName, resInfo);
      return resInfo;
    } catch (error) {
      console.error(`[ObjManager] Error loading objres file ${objFileName}:`, error);
      return null;
    }
  }

  /**
   * Load ASF file for an object
   */
  private async loadObjAsf(imagePath: string): Promise<AsfData | null> {
    // Check cache
    const cached = this.asfCache.get(imagePath);
    if (cached !== undefined) {
      return cached;
    }

    try {
      // ASF files for objects are in asf/object/
      const asfPath = `/resources/asf/object/${imagePath}`;
      const asf = await loadAsf(asfPath);
      this.asfCache.set(imagePath, asf);
      return asf;
    } catch (error) {
      console.warn(`[ObjManager] Failed to load ASF: ${imagePath}`, error);
      this.asfCache.set(imagePath, null);
      return null;
    }
  }

  /**
   * Add a single object
   */
  addObj(obj: Obj): void {
    this.objects.set(obj.id, obj);
  }

  /**
   * Add object from ini file at position
   */
  async addObjByFile(fileName: string, tileX: number, tileY: number, direction: number): Promise<void> {
    try {
      // Load from ini/obj/ directory
      const filePath = `/resources/ini/obj/${fileName}`;
      const response = await fetch(filePath);
      if (!response.ok) return;

      // INI files in resources are now UTF-8 encoded
      const content = await response.text();
      const sections = parseIni(content);

      // Use INIT section as the object definition
      const initSection = sections.INIT || sections.Init || Object.values(sections)[0];
      if (!initSection) return;

      const obj = new Obj();

      // Load properties from section
      obj.loadFromSection(initSection);

      // Override position and direction
      obj.setTilePosition(tileX, tileY);
      obj.dir = direction;

      // Create a unique ID
      const id = `added_${fileName}_${tileX}_${tileY}_${Date.now()}`;
      obj.id = id;
      obj.fileName = fileName;

      // Load resources
      if (obj.objFileName) {
        const resInfo = await this.loadObjRes(obj.objFileName);
        if (resInfo) {
          obj.objFile.set(ObjState.Common, resInfo);
          if (resInfo.imagePath) {
            const asf = await this.loadObjAsf(resInfo.imagePath);
            if (asf) {
              obj.setAsfTexture(asf);
            }
          }
        }
      }

      this.objects.set(id, obj);
    } catch (error) {
      console.error(`Error adding obj from file ${fileName}:`, error);
    }
  }

  /**
   * Get object by name
   */
  getObj(name: string): Obj | undefined {
    for (const obj of this.objects.values()) {
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
    return this.objects.get(id);
  }

  /**
   * Get objects at tile position
   */
  getObjsAtPosition(tile: Vector2): Obj[] {
    const result: Obj[] = [];
    for (const obj of this.objects.values()) {
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
    for (const obj of this.objects.values()) {
      if (obj.isRemoved) continue; // Skip removed objects
      if (obj.tilePosition.x === tileX && obj.tilePosition.y === tileY) {
        if (obj.isObstacle) {
          return true;
        }
      }
    }
    return false;
  }

  /**
   * Get all objects in view area
   */
  getObjsInView(viewRect: { x: number; y: number; width: number; height: number }): Obj[] {
    const result: Obj[] = [];
    for (const obj of this.objects.values()) {
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
   */
  getAllObjs(): Obj[] {
    return Array.from(this.objects.values());
  }

  /**
   * Delete object by name
   */
  deleteObj(name: string): void {
    for (const [id, obj] of this.objects.entries()) {
      if (obj.objName === name) {
        obj.isRemoved = true;  // C# sets IsRemoved = true
        this.saveObjState(obj);  // Persist state for map reload
        this.objects.delete(id);
        console.log(`[ObjManager] Deleted obj by name: ${name}`);
        break;
      }
    }
  }

  /**
   * Delete object by id
   * C# Reference: Obj.IsRemoved = true
   */
  deleteObjById(id: string): void {
    const obj = this.objects.get(id);
    if (obj) {
      obj.isRemoved = true;  // C# sets IsRemoved = true
      this.saveObjState(obj);  // Persist state for map reload
      this.objects.delete(id);
      console.log(`[ObjManager] Deleted obj by id: ${id} (${obj.objName})`);
    }
  }

  /**
   * Open a box (play animation forward)
   * C# Reference: Obj.OpenBox() -> PlayFrames(FrameEnd - CurrentFrameIndex)
   */
  openBox(objNameOrId: string): void {
    const obj = this.getObj(objNameOrId) || this.objects.get(objNameOrId);
    if (obj) {
      const targetFrame = obj.openBox();
      // Save target frame (not current frame) for proper state restoration
      this.saveObjStateWithFrame(obj, targetFrame);
      console.log(`[ObjManager] OpenBox: ${obj.objName}, targetFrame=${targetFrame}`);
    }
  }

  /**
   * Close a box (play animation backward)
   * C# Reference: Obj.CloseBox() -> PlayFrames(CurrentFrameIndex - FrameBegin, true)
   */
  closeBox(objNameOrId: string): void {
    const obj = this.getObj(objNameOrId) || this.objects.get(objNameOrId);
    if (obj) {
      const targetFrame = obj.closeBox();
      // Save target frame (not current frame) for proper state restoration
      this.saveObjStateWithFrame(obj, targetFrame);
      console.log(`[ObjManager] CloseBox: ${obj.objName}, targetFrame=${targetFrame}`);
    }
  }

  /**
   * Set script file for an object
   * C# Reference: ScriptExecuter.SetObjScript - target.ScriptFile = scriptFileName
   * When scriptFile is empty, the object becomes non-interactive
   */
  setObjScript(objNameOrId: string, scriptFile: string): void {
    // Try by name first, then by id
    const obj = this.getObj(objNameOrId) || this.objects.get(objNameOrId);
    if (obj) {
      obj.scriptFile = scriptFile;
      this.saveObjState(obj);  // Persist state for map reload
      console.log(`[ObjManager] SetObjScript: ${obj.objName} -> "${scriptFile}"`);
    } else {
      console.warn(`[ObjManager] SetObjScript: Object not found: ${objNameOrId}`);
    }
  }

  /**
   * Clear all bodies (dead NPCs)
   */
  clearBodies(): void {
    for (const [id, obj] of this.objects.entries()) {
      if (obj.isBody) {
        this.objects.delete(id);
      }
    }
  }

  /**
   * Clear all objects
   */
  clearAll(): void {
    // Stop all object sounds before clearing
    this.stopAllObjSounds();
    this.objects.clear();
    this.fileName = "";
  }

  /**
   * Debug: Print all obstacle objects
   */
  debugPrintObstacleObjs(): void {
    console.log(`[ObjManager] Total objects: ${this.objects.size}, fileName: ${this.fileName}`);
    for (const obj of this.objects.values()) {
      if (obj.isObstacle) {
        console.log(`  Obstacle: "${obj.objName}" at (${obj.tilePosition.x}, ${obj.tilePosition.y}), kind=${obj.kind}, removed=${obj.isRemoved}`);
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
   * Create Obj from save data (用于从 JSON 存档加载)
   * C# Reference: ObjManager.Load() - creates objects from saved data
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
    // Skip removed objects
    if (objData.isRemoved) {
      console.log(`[ObjManager] Skipping removed obj: ${objData.objName}`);
      return;
    }

    const obj = new Obj();

    // Set basic properties
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

    // Set position
    obj.setTilePosition(objData.mapX, objData.mapY);

    // Create unique ID
    const id = `save_${objData.objName}_${objData.mapX}_${objData.mapY}`;
    obj.id = id;

    // Load resources using objFile (e.g., "草_银花.ini")
    if (objData.objFile) {
      obj.objFileName = objData.objFile;
      const resInfo = await this.loadObjRes(objData.objFile);
      if (resInfo) {
        obj.objFile.set(ObjState.Common, resInfo);
        if (resInfo.imagePath) {
          const asf = await this.loadObjAsf(resInfo.imagePath);
          if (asf) {
            obj.setAsfTexture(asf);
          }
        }
      }
    }

    // Add to objects map
    this.objects.set(id, obj);
    console.log(`[ObjManager] Created obj from save: ${objData.objName} at (${objData.mapX}, ${objData.mapY})`);
  }

  /**
   * Get closest interactable object
   */
  getClosestInteractableObj(tile: Vector2, maxDistance: number = 3): Obj | null {
    let closest: Obj | null = null;
    let minDist = maxDistance;

    for (const obj of this.objects.values()) {
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
   * Update all objects (animation, timers, sound, etc.)
   * C# Reference: Obj.Update - handles animation, timer scripts, removal, sound
   */
  update(deltaTime: number): void {
    for (const obj of this.objects.values()) {
      if (obj.isRemoved) continue;

      // Call the object's update method (handles animation, timers, etc.)
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
    if (!this.audioManager || !obj.wavFile) return;

    const emitterPosition = obj.positionInWorld;

    switch (obj.kind) {
      case ObjKind.LoopingSound:
        // C# Reference: case ObjKind.LoopingSound: UpdateSound(); PlaySound();
        // Looping sounds play continuously with 3D positioning
        this.audioManager.play3DSoundLoop(obj.soundId, obj.wavFile, emitterPosition);
        break;

      case ObjKind.RandSound:
        // C# Reference: case ObjKind.RandSound: UpdateSound(); PlayRandSound();
        // Random sounds have 1/200 chance to play each frame
        // C#: if (Globals.TheRandom.Next(0, 200) == 0) PlaySound();
        this.audioManager.play3DSoundRandom(obj.soundId, obj.wavFile, emitterPosition, 0.005);
        break;

      // Other object types don't auto-play sounds
      // They may play sounds via script commands
    }
  }

  /**
   * Stop all object sounds (call when changing maps)
   */
  stopAllObjSounds(): void {
    if (!this.audioManager) return;

    for (const obj of this.objects.values()) {
      if (obj.hasSound) {
        this.audioManager.stop3DSound(obj.soundId);
      }
    }
  }

  /**
   * Draw a single object
   */
  drawObj(
    ctx: CanvasRenderingContext2D,
    obj: Obj,
    cameraX: number,
    cameraY: number,
    isHighlighted: boolean = false
  ): void {
    if (!obj.isShow || obj.isRemoved) return;

    obj.draw(ctx, cameraX, cameraY, isHighlighted);
  }

  /**
   * Draw all objects in view
   */
  drawAllObjs(
    ctx: CanvasRenderingContext2D,
    cameraX: number,
    cameraY: number,
    viewWidth: number,
    viewHeight: number
  ): void {
    const viewRect = {
      x: cameraX,
      y: cameraY,
      width: viewWidth,
      height: viewHeight,
    };

    const objsInView = this.getObjsInView(viewRect);

    // Sort by Y position for proper layering (objects lower on screen drawn last)
    objsInView.sort((a, b) => {
      return a.positionInWorld.y - b.positionInWorld.y;
    });

    // Draw each object
    for (const obj of objsInView) {
      this.drawObj(ctx, obj, cameraX, cameraY);
    }
  }
}
