/**
 * ObjManager - based on JxqyHD Engine/ObjManager.cs
 * Manages interactive objects on the map (herbs, tombstones, chests, etc.)
 *
 * Object file format (.obj):
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
 */
import type { Vector2 } from "../core/types";
import { loadAsf, type AsfData, getFrameCanvas } from "../asf";
import { tileToPixel } from "../core/utils";

// Object Kind enum matching C#
export enum ObjKind {
  Dynamic = 0,  // Animated, obstacle
  Static = 1,   // Static, obstacle
  Body = 2,     // Dead body
  Sound = 3,    // Sound emitter (invisible)
  Door = 5,     // Door
  Trap = 6,     // Trap
  Drop = 7,     // Dropped item
}

// Object state enum matching C#
export enum ObjState {
  Common = 0,
  Open = 1,
  Opened = 2,
  Closed = 3,
}

export interface ObjResInfo {
  imagePath: string;
  soundPath: string;
}

export interface ObjData {
  id: string;
  objName: string;
  objFile: string;       // Reference to objres file
  kind: ObjKind;
  tilePosition: Vector2;
  direction: number;
  frame: number;
  offX: number;
  offY: number;
  damage: number;
  lum: number;           // Luminosity
  scriptFile: string;
  scriptFileRight: string;
  wavFile: string;
  timerScriptFile: string;
  timerScriptInterval: number;
  canInteractDirectly: number;

  // Runtime data
  isVisible: boolean;
  isRemoved: boolean;
  currentFrame: number;
  animationTime: number;

  // Loaded resources
  asf: AsfData | null;
  resInfo: ObjResInfo | null;
}

// Text decoder for GB2312 (GBK) encoding
let textDecoder: TextDecoder | null = null;

function getTextDecoder(): TextDecoder {
  if (!textDecoder) {
    try {
      textDecoder = new TextDecoder("gbk");
    } catch {
      // Fallback to utf-8 if gbk not supported
      textDecoder = new TextDecoder("utf-8");
    }
  }
  return textDecoder;
}

/**
 * Parse INI-style content with GB2312 support
 */
function parseObjIni(content: string): Record<string, Record<string, string>> {
  const sections: Record<string, Record<string, string>> = {};
  let currentSection = "";

  const lines = content.split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith(";") || trimmed.startsWith("//")) {
      continue;
    }

    // Check for section header [SectionName]
    const sectionMatch = trimmed.match(/^\[([^\]]+)\]$/);
    if (sectionMatch) {
      currentSection = sectionMatch[1];
      sections[currentSection] = {};
      continue;
    }

    // Parse key=value
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx > 0 && currentSection) {
      const key = trimmed.substring(0, eqIdx).trim();
      const value = trimmed.substring(eqIdx + 1).trim();
      sections[currentSection][key] = value;
    }
  }

  return sections;
}

export class ObjManager {
  private objects: Map<string, ObjData> = new Map();
  private fileName: string = "";
  private objResCache: Map<string, ObjResInfo> = new Map();
  private asfCache: Map<string, AsfData | null> = new Map();

  /**
   * Load objects from an .obj file (from ini/save/ directory)
   */
  async load(fileName: string): Promise<boolean> {
    console.log(`[ObjManager] Loading obj file: ${fileName}`);
    this.clearAll();
    this.fileName = fileName;

    try {
      // .obj files are in ini/save/ directory
      const filePath = `/resources/ini/save/${fileName}`;
      console.log(`[ObjManager] Fetching from: ${filePath}`);

      const response = await fetch(filePath);
      if (!response.ok) {
        console.error(`[ObjManager] Failed to load obj file: ${filePath}, status: ${response.status}`);
        return false;
      }

      // Read as binary and decode with GBK
      const buffer = await response.arrayBuffer();
      const decoder = getTextDecoder();
      const content = decoder.decode(new Uint8Array(buffer));

      console.log(`[ObjManager] Parsing obj file, content length: ${content.length}`);
      await this.parseObjFile(content);
      console.log(`[ObjManager] Loaded ${this.objects.size} objects`);
      return true;
    } catch (error) {
      console.error(`[ObjManager] Error loading obj file ${fileName}:`, error);
      return false;
    }
  }

  /**
   * Parse .obj file content
   */
  private async parseObjFile(content: string): Promise<void> {
    const sections = parseObjIni(content);
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
   * Create an ObjData from INI section
   */
  private async createObjFromSection(
    sectionName: string,
    section: Record<string, string>
  ): Promise<void> {
    const objName = section.ObjName || sectionName;
    const objFile = section.ObjFile || "";
    const kind = parseInt(section.Kind || "0", 10) as ObjKind;
    const mapX = parseInt(section.MapX || "0", 10);
    const mapY = parseInt(section.MapY || "0", 10);
    const dir = parseInt(section.Dir || "0", 10);
    const frame = parseInt(section.Frame || "0", 10);
    const offX = parseInt(section.OffX || "0", 10);
    const offY = parseInt(section.OffY || "0", 10);
    const damage = parseInt(section.Damage || "0", 10);
    const lum = parseInt(section.Lum || "0", 10);
    const scriptFile = section.ScriptFile || "";
    const scriptFileRight = section.ScriptFileRight || "";
    const wavFile = section.WavFile || "";
    const timerScriptFile = section.TimerScriptFile || "";
    const timerScriptInterval = parseInt(section.TimerScriptInterval || "3000", 10);
    const canInteractDirectly = parseInt(section.CanInteractDirectly || "0", 10);

    // Create unique id for the object
    const id = `${sectionName}_${objName}_${mapX}_${mapY}`;

    const obj: ObjData = {
      id,
      objName,
      objFile,
      kind,
      tilePosition: { x: mapX, y: mapY },
      direction: dir,
      frame,
      offX,
      offY,
      damage,
      lum,
      scriptFile,
      scriptFileRight,
      wavFile,
      timerScriptFile,
      timerScriptInterval,
      canInteractDirectly,
      isVisible: true,
      isRemoved: false,
      currentFrame: frame,
      animationTime: 0,
      asf: null,
      resInfo: null,
    };

    // Sound objects (Kind=3) are invisible
    if (kind === ObjKind.Sound) {
      obj.isVisible = false;
    }

    // Load the objres file to get the image path
    if (objFile) {
      const resInfo = await this.loadObjRes(objFile);
      if (resInfo) {
        obj.resInfo = resInfo;
        // Load the ASF
        if (resInfo.imagePath) {
          const asf = await this.loadObjAsf(resInfo.imagePath);
          obj.asf = asf;
        }
      }
    }

    console.log(`[ObjManager] Created obj: ${objName} (kind=${kind}) at (${mapX}, ${mapY}), asf=${obj.asf ? "loaded" : "null"}`);
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

      // Decode with GBK
      const buffer = await response.arrayBuffer();
      const decoder = getTextDecoder();
      const content = decoder.decode(new Uint8Array(buffer));

      const sections = parseObjIni(content);

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
   * Check if object is an obstacle
   */
  private isObjObstacle(obj: ObjData): boolean {
    return (
      obj.kind === ObjKind.Dynamic ||
      obj.kind === ObjKind.Static ||
      obj.kind === ObjKind.Door
    );
  }

  /**
   * Check if object is a body
   */
  private isObjBody(obj: ObjData): boolean {
    return obj.kind === ObjKind.Body;
  }

  /**
   * Check if object has interact script
   */
  private hasInteractScript(obj: ObjData): boolean {
    return obj.scriptFile !== "";
  }

  /**
   * Add a single object
   */
  addObj(obj: ObjData): void {
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

      const buffer = await response.arrayBuffer();
      const decoder = getTextDecoder();
      const content = decoder.decode(new Uint8Array(buffer));
      const sections = parseObjIni(content);

      // Use INIT section as the object definition
      const initSection = sections.INIT || sections.Init || Object.values(sections)[0];
      if (!initSection) return;

      // Create a unique ID
      const id = `added_${fileName}_${tileX}_${tileY}_${Date.now()}`;

      const obj: ObjData = {
        id,
        objName: initSection.ObjName || fileName,
        objFile: initSection.ObjFile || "",
        kind: parseInt(initSection.Kind || "0", 10) as ObjKind,
        tilePosition: { x: tileX, y: tileY },
        direction,
        frame: 0,
        offX: parseInt(initSection.OffX || "0", 10),
        offY: parseInt(initSection.OffY || "0", 10),
        damage: 0,
        lum: parseInt(initSection.Lum || "0", 10),
        scriptFile: initSection.ScriptFile || "",
        scriptFileRight: "",
        wavFile: "",
        timerScriptFile: "",
        timerScriptInterval: 3000,
        canInteractDirectly: 0,
        isVisible: true,
        isRemoved: false,
        currentFrame: 0,
        animationTime: 0,
        asf: null,
        resInfo: null,
      };

      // Load resources
      if (obj.objFile) {
        const resInfo = await this.loadObjRes(obj.objFile);
        if (resInfo) {
          obj.resInfo = resInfo;
          if (resInfo.imagePath) {
            obj.asf = await this.loadObjAsf(resInfo.imagePath);
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
  getObj(name: string): ObjData | undefined {
    for (const obj of this.objects.values()) {
      if (obj.objName === name) {
        return obj;
      }
    }
    return undefined;
  }

  /**
   * Get objects at tile position
   */
  getObjsAtPosition(tile: Vector2): ObjData[] {
    const result: ObjData[] = [];
    for (const obj of this.objects.values()) {
      if (obj.tilePosition.x === tile.x && obj.tilePosition.y === tile.y) {
        result.push(obj);
      }
    }
    return result;
  }

  /**
   * Check if tile has obstacle
   */
  isObstacle(tileX: number, tileY: number): boolean {
    for (const obj of this.objects.values()) {
      if (
        obj.tilePosition.x === tileX &&
        obj.tilePosition.y === tileY &&
        this.isObjObstacle(obj)
      ) {
        return true;
      }
    }
    return false;
  }

  /**
   * Get all objects in view area
   */
  getObjsInView(viewRect: { x: number; y: number; width: number; height: number }): ObjData[] {
    const result: ObjData[] = [];
    for (const obj of this.objects.values()) {
      if (!obj.isVisible || obj.isRemoved) continue;

      // Calculate pixel position
      const pixelPos = tileToPixel(obj.tilePosition.x, obj.tilePosition.y);

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
  getAllObjs(): ObjData[] {
    return Array.from(this.objects.values());
  }

  /**
   * Delete object by name
   */
  deleteObj(name: string): void {
    for (const [id, obj] of this.objects.entries()) {
      if (obj.objName === name) {
        this.objects.delete(id);
        break;
      }
    }
  }

  /**
   * Clear all bodies (dead NPCs)
   */
  clearBodies(): void {
    for (const [id, obj] of this.objects.entries()) {
      if (this.isObjBody(obj)) {
        this.objects.delete(id);
      }
    }
  }

  /**
   * Clear all objects
   */
  clearAll(): void {
    this.objects.clear();
    this.fileName = "";
  }

  /**
   * Get current file name
   */
  getFileName(): string {
    return this.fileName;
  }

  /**
   * Get closest interactable object
   */
  getClosestInteractableObj(tile: Vector2, maxDistance: number = 3): ObjData | null {
    let closest: ObjData | null = null;
    let minDist = maxDistance;

    for (const obj of this.objects.values()) {
      if (!obj.isVisible || obj.isRemoved || !this.hasInteractScript(obj)) continue;

      const dist = Math.abs(obj.tilePosition.x - tile.x) + Math.abs(obj.tilePosition.y - tile.y);
      if (dist <= minDist) {
        minDist = dist;
        closest = obj;
      }
    }

    return closest;
  }

  /**
   * Update all objects (animation, timers, etc.)
   */
  update(deltaTime: number): void {
    for (const obj of this.objects.values()) {
      if (!obj.isVisible || obj.isRemoved || !obj.asf) continue;

      // Update animation for dynamic/animated objects
      if (obj.kind === ObjKind.Dynamic || obj.kind === ObjKind.Trap || obj.kind === ObjKind.Drop) {
        const interval = obj.asf.interval || 100;
        obj.animationTime += deltaTime * 1000;

        while (obj.animationTime >= interval) {
          obj.animationTime -= interval;

          // Calculate frames for current direction
          const framesPerDir = obj.asf.framesPerDirection;

          obj.currentFrame++;
          if (obj.currentFrame >= framesPerDir) {
            obj.currentFrame = 0;
          }
        }
      }
    }
  }

  /**
   * Draw a single object
   */
  drawObj(
    ctx: CanvasRenderingContext2D,
    obj: ObjData,
    cameraX: number,
    cameraY: number
  ): void {
    if (!obj.isVisible || obj.isRemoved || !obj.asf) return;

    // Calculate screen position
    const pixelPos = tileToPixel(obj.tilePosition.x, obj.tilePosition.y);

    // C# draws at: PositionInWorld.X - Texture.Left + OffX, PositionInWorld.Y - Texture.Bottom + OffY
    const screenX = pixelPos.x - obj.asf.left + obj.offX - cameraX;
    const screenY = pixelPos.y - obj.asf.bottom + obj.offY - cameraY;

    // Get the frame
    const framesPerDir = obj.asf.framesPerDirection;
    const dir = Math.min(obj.direction, obj.asf.directions - 1);
    const frameIndex = dir * framesPerDir + (obj.currentFrame % framesPerDir);

    if (frameIndex >= 0 && frameIndex < obj.asf.frames.length) {
      const frame = obj.asf.frames[frameIndex];
      const canvas = getFrameCanvas(frame);
      ctx.drawImage(canvas, screenX, screenY);
    }
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
      const aY = tileToPixel(a.tilePosition.x, a.tilePosition.y).y;
      const bY = tileToPixel(b.tilePosition.x, b.tilePosition.y).y;
      return aY - bY;
    });

    // Draw each object
    for (const obj of objsInView) {
      this.drawObj(ctx, obj, cameraX, cameraY);
    }
  }
}

// Singleton instance
let objManagerInstance: ObjManager | null = null;

export function getObjManager(): ObjManager {
  if (!objManagerInstance) {
    objManagerInstance = new ObjManager();
  }
  return objManagerInstance;
}
