/**
 * Obj class - based on JxqyHD Engine/Obj.cs
 * Interactive objects on the map (herbs, tombstones, chests, etc.)
 * Extends Sprite with object-specific functionality
 */
import { logger } from "../core/logger";
import type { Vector2 } from "../core/types";
import { parseIni } from "../core/utils";
import { resourceLoader } from "../resource/resourceLoader";
import { type AsfData, getFrameCanvas, getFrameIndex, loadAsf } from "../sprite/asf";
import { Sprite } from "../sprite/sprite";
import { ResourcePath } from "@/config/resourcePaths";

/**
 * Object Kind enum matching C# Obj.ObjKind
 */
export enum ObjKind {
  Dynamic = 0, // Animated, obstacle
  Static = 1, // Static, obstacle
  Body = 2, // Dead body
  LoopingSound = 3, // Looping sound emitter (invisible)
  RandSound = 4, // Random sound emitter (invisible)
  Door = 5, // Door
  Trap = 6, // Trap
  Drop = 7, // Dropped item
}

/**
 * Object state enum matching C# ObjState
 */
export enum ObjState {
  Common = 0,
  Open = 1,
  Opened = 2,
  Closed = 3,
}

/**
 * Object resource info from objres file
 */
export interface ObjResInfo {
  imagePath: string;
  soundPath: string;
}

/**
 * Object save data for persistence
 * C#: Obj.Save(KeyDataCollection keyDataCollection)
 */
export interface ObjSaveData {
  ObjName: string;
  Kind: number;
  Dir: number;
  MapX: number;
  MapY: number;
  Damage: number;
  Frame: number;
  Height: number;
  Lum: number;
  ObjFile: string;
  OffX: number;
  OffY: number;
  ScriptFileJustTouch: number;
  ScriptFile?: string;
  ScriptFileRight?: string;
  TimerScriptFile?: string;
  WavFile?: string;
  TimerScriptInterval?: number;
  MillisecondsToRemove?: number;
  CanInteractDirectly?: number;
  ReviveNpcIni?: string;
}

/**
 * State map for object textures
 * C#: StateMapList = Dictionary<int, ResStateInfo>
 */
export type StateMapList = Map<number, ObjResInfo>;

/**
 * Obj class - Interactive object on the map
 * Based on C# Engine/Obj.cs which extends Sprite
 */
export class Obj extends Sprite {
  // C#: FileName - file name for this object
  protected _fileName: string = "";
  // C#: IsRemoved
  protected _isRemoved: boolean = false;

  // ============= Object Properties (from C# Obj.cs) =============
  // C#: _objName
  protected _objName: string = "";
  // C#: _kind
  protected _kind: ObjKind = ObjKind.Dynamic;
  // C#: _dir (direction stored separately for obj, parent has _currentDirection)
  protected _dir: number = 0;
  // C#: _damage
  protected _damage: number = 0;
  // C#: _frame (initial frame)
  protected _frame: number = 0;
  // C#: _height
  protected _height: number = 0;
  // C#: _lum (luminosity)
  protected _lum: number = 0;
  // C#: _objFile (StateMapList)
  protected _objFile: StateMapList = new Map();
  // C#: _objFileName (reference to objres file)
  protected _objFileName: string = "";
  // C#: _scriptFile
  protected _scriptFile: string = "";
  // C#: _scriptFileRight
  protected _scriptFileRight: string = "";
  // C#: _canInteractDirectly
  protected _canInteractDirectly: number = 0;
  // C#: _timerScriptFile
  protected _timerScriptFile: string = "";
  // C#: _timerScriptInterval
  protected _timerScriptInterval: number = 3000; // C# Globals.DefaultNpcObjTimeScriptInterval
  // C#: _timerScriptIntervlElapsed
  protected _timerScriptIntervalElapsed: number = 0;
  // C#: _wavFileName
  protected _wavFileName: string = "";
  // C#: _offX, _offY
  protected _offX: number = 0;
  protected _offY: number = 0;
  // C#: _reviveNpcIni
  protected _reviveNpcIni: string = "";
  // C#: _scriptFileJustTouch
  protected _scriptFileJustTouch: number = 0;
  // C#: _millisecondsToRemove
  protected _millisecondsToRemove: number = 0;

  // Unique ID for this object instance
  protected _id: string = "";

  // ============= Properties =============

  get id(): string {
    return this._id;
  }

  set id(value: string) {
    this._id = value;
  }

  get fileName(): string {
    return this._fileName;
  }

  set fileName(value: string) {
    this._fileName = value;
  }

  get isRemoved(): boolean {
    return this._isRemoved;
  }

  set isRemoved(value: boolean) {
    this._isRemoved = value;
  }

  /**
   * C#: RegionInWorld - override to include offsets
   */
  get regionInWorld(): { x: number; y: number; width: number; height: number } {
    const baseRegion = {
      x: this._positionInWorld.x - (this._texture?.left || 0),
      y: this._positionInWorld.y - (this._texture?.bottom || 0),
      width: this._texture?.width || 0,
      height: this._texture?.height || 0,
    };
    return {
      x: baseRegion.x + this._offX,
      y: baseRegion.y + this._offY,
      width: baseRegion.width,
      height: baseRegion.height,
    };
  }

  get objName(): string {
    return this._objName;
  }

  set objName(value: string) {
    this._objName = value;
  }

  get kind(): ObjKind {
    return this._kind;
  }

  set kind(value: ObjKind) {
    this._kind = value;
  }

  get dir(): number {
    return this._dir;
  }

  set dir(value: number) {
    this._dir = value;
    // Also update the sprite direction
    this._currentDirection = value;
  }

  get damage(): number {
    return this._damage;
  }

  set damage(value: number) {
    this._damage = value;
  }

  get frame(): number {
    return this._frame;
  }

  set frame(value: number) {
    this._frame = value;
  }

  get height(): number {
    return this._height;
  }

  set height(value: number) {
    this._height = value;
  }

  get lum(): number {
    return this._lum;
  }

  set lum(value: number) {
    this._lum = value;
  }

  get objFile(): StateMapList {
    return this._objFile;
  }

  set objFile(value: StateMapList) {
    this._objFile = value;
  }

  get objFileName(): string {
    return this._objFileName;
  }

  set objFileName(value: string) {
    this._objFileName = value;
  }

  get scriptFile(): string {
    return this._scriptFile;
  }

  set scriptFile(value: string) {
    this._scriptFile = value;
  }

  get scriptFileRight(): string {
    return this._scriptFileRight;
  }

  set scriptFileRight(value: string) {
    this._scriptFileRight = value;
  }

  get canInteractDirectly(): number {
    return this._canInteractDirectly;
  }

  set canInteractDirectly(value: number) {
    this._canInteractDirectly = value;
  }

  get timerScriptFile(): string {
    return this._timerScriptFile;
  }

  set timerScriptFile(value: string) {
    this._timerScriptFile = value;
  }

  get timerScriptInterval(): number {
    return this._timerScriptInterval;
  }

  set timerScriptInterval(value: number) {
    this._timerScriptInterval = value;
  }

  get reviveNpcIni(): string {
    return this._reviveNpcIni;
  }

  set reviveNpcIni(value: string) {
    this._reviveNpcIni = value;
  }

  get scriptFileJustTouch(): number {
    return this._scriptFileJustTouch;
  }

  set scriptFileJustTouch(value: number) {
    this._scriptFileJustTouch = value;
  }

  get wavFile(): string {
    return this._wavFileName;
  }

  set wavFile(value: string) {
    this._wavFileName = value;
    // Sound is played/updated by ObjManager with AudioManager
  }

  /**
   * Check if this object has a sound to play
   */
  get hasSound(): boolean {
    return this._wavFileName !== "";
  }

  /**
   * Check if this is a looping sound object
   * C# Reference: ObjKind.LoopingSound = 3
   */
  get isLoopingSound(): boolean {
    return this._kind === ObjKind.LoopingSound;
  }

  /**
   * Check if this is a random sound object
   * C# Reference: ObjKind.RandSound = 4
   */
  get isRandSound(): boolean {
    return this._kind === ObjKind.RandSound;
  }

  /**
   * Get unique sound ID for this object
   * Used by AudioManager to track 3D sound instances
   */
  get soundId(): string {
    return `obj_sound_${this._id}`;
  }

  get offX(): number {
    return this._offX;
  }

  set offX(value: number) {
    this._offX = value;
  }

  get offY(): number {
    return this._offY;
  }

  set offY(value: number) {
    this._offY = value;
  }

  get millisecondsToRemove(): number {
    return this._millisecondsToRemove;
  }

  set millisecondsToRemove(value: number) {
    this._millisecondsToRemove = value;
  }

  // ============= Computed Properties =============

  /**
   * C#: IsObstacle - check if object blocks movement
   */
  get isObstacle(): boolean {
    return (
      this._kind === ObjKind.Dynamic || this._kind === ObjKind.Static || this._kind === ObjKind.Door
    );
  }

  /**
   * C#: IsDrop - check if object is a dropped item
   */
  get isDrop(): boolean {
    return this._kind === ObjKind.Drop;
  }

  /**
   * C#: IsAutoPlay - check if object should auto-animate
   */
  get isAutoPlay(): boolean {
    return (
      this._kind === ObjKind.Dynamic || this._kind === ObjKind.Trap || this._kind === ObjKind.Drop
    );
  }

  /**
   * C#: IsInteractive - check if object can be interacted with
   */
  get isInteractive(): boolean {
    return this.hasInteractScript;
  }

  /**
   * C#: HasInteractScript
   */
  get hasInteractScript(): boolean {
    return this._scriptFile !== "";
  }

  /**
   * C#: HasInteractScriptRight
   */
  get hasInteractScriptRight(): boolean {
    return this._scriptFileRight !== "";
  }

  /**
   * C#: IsTrap
   */
  get isTrap(): boolean {
    return this._kind === ObjKind.Trap;
  }

  /**
   * C#: IsBody
   */
  get isBody(): boolean {
    return this._kind === ObjKind.Body;
  }

  // ============= Methods =============

  /**
   * C#: SetObjFile(fileName)
   * Load the objres file and set up textures
   */
  setObjFile(fileName: string): void {
    this._objFileName = fileName;
    // Note: Actual loading is done by ObjManager since it needs async
  }

  /**
   * C#: SetWaveFile(fileName)
   */
  setWaveFile(fileName: string): void {
    this.wavFile = fileName;
  }

  /**
   * C#: InitializeFigure()
   * Initialize the object's appearance
   */
  initializeFigure(): void {
    if (this._objFile.size > 0) {
      const commonRes = this._objFile.get(ObjState.Common);
      if (commonRes) {
        // Texture would be loaded by ObjManager
        // Here we just initialize direction and frame
      }
    }
    this.currentDirection = this._dir;
    this._currentFrameIndex = this._frame;
  }

  /**
   * C#: OpenBox()
   * Play animation forward (open) - from current frame to end
   * C#: PlayFrames(FrameEnd - CurrentFrameIndex)
   * @returns The target frame index (for state saving)
   */
  openBox(): number {
    const framesToPlay = this._frameEnd - this._currentFrameIndex;
    if (framesToPlay > 0) {
      this._leftFrameToPlay = framesToPlay;
      this._isPlayReverse = false;
    }
    return this._frameEnd;
  }

  /**
   * C#: CloseBox()
   * Play animation backward (close) - from current frame to begin
   * C#: PlayFrames(CurrentFrameIndex - FrameBegin, true)
   * @returns The target frame index (for state saving)
   */
  closeBox(): number {
    const framesToPlay = this._currentFrameIndex - this._frameBegin;
    if (framesToPlay > 0) {
      this._leftFrameToPlay = framesToPlay;
      this._isPlayReverse = true;
      // Do NOT set _currentFrameIndex here - animation should play naturally
    }
    // Return the target frame for state persistence
    return this._frameBegin;
  }

  /**
   * C#: SetOffSet(Vector2)
   */
  setOffset(offset: Vector2): void {
    this._offX = offset.x;
    this._offY = offset.y;
  }

  // ============= Save/Load Methods =============

  /**
   * C#: Save(KeyDataCollection keyDataCollection)
   * Save object state for persistence
   * @returns ObjSaveData record
   */
  save(): ObjSaveData {
    const data: ObjSaveData = {
      ObjName: this._objName,
      Kind: this._kind,
      Dir: this._dir,
      MapX: this.mapX,
      MapY: this.mapY,
      Damage: this._damage,
      Frame: this._currentFrameIndex - this._frameBegin,
      Height: this._height,
      Lum: this._lum,
      ObjFile: this._objFileName,
      OffX: this._offX,
      OffY: this._offY,
      ScriptFileJustTouch: this._scriptFileJustTouch,
    };

    // Optional fields - only include if set
    if (this._scriptFile) {
      data.ScriptFile = this._scriptFile;
    }
    if (this._scriptFileRight) {
      data.ScriptFileRight = this._scriptFileRight;
    }
    if (this._timerScriptFile) {
      data.TimerScriptFile = this._timerScriptFile;
    }
    if (this._wavFileName) {
      data.WavFile = this._wavFileName;
    }
    if (this._timerScriptInterval !== 3000) {
      data.TimerScriptInterval = this._timerScriptInterval;
    }
    if (this._millisecondsToRemove > 0) {
      data.MillisecondsToRemove = this._millisecondsToRemove;
    }
    if (this._canInteractDirectly !== 0) {
      data.CanInteractDirectly = this._canInteractDirectly;
    }
    if (this._reviveNpcIni) {
      data.ReviveNpcIni = this._reviveNpcIni;
    }

    return data;
  }

  // ============= Interaction Methods =============

  /**
   * C#: StartInteract(bool isRight)
   * Start interaction with this object by running its script
   *
   * @param isRight Whether to use ScriptFileRight instead of ScriptFile
   * @returns The script file that was started, or null if none
   */
  startInteract(isRight: boolean): string | null {
    if (this._isRemoved) {
      return null;
    }

    const scriptFile = isRight ? this._scriptFileRight : this._scriptFile;
    if (!scriptFile) {
      return null;
    }

    // 使用 IEngineContext 运行脚本
    const engine = this.engine;
    if (engine) {
      const scriptBasePath = engine.getScriptBasePath();
      const fullPath = scriptFile.startsWith("/") ? scriptFile : `${scriptBasePath}/${scriptFile}`;
      engine.runScript(fullPath, { type: "obj", id: this._id });
    }

    return scriptFile;
  }

  /**
   * Check if this object can be interacted with
   * @param isRight Whether checking for right-click interaction
   */
  canInteract(isRight: boolean = false): boolean {
    if (this._isRemoved) {
      return false;
    }
    const scriptFile = isRight ? this._scriptFileRight : this._scriptFile;
    return !!scriptFile;
  }

  // ============= Sound Methods =============
  // Note: Sound playback is delegated to AudioManager via ObjManager
  // These methods provide the data needed for sound operations

  /**
   * Get the sound file path for this object
   * C#: WavFile property with SoundEffect loading
   */
  getSoundFile(): string {
    return this._wavFileName;
  }

  /**
   * Check if this object should play looping sound
   * C#: ObjKind.LoopingSound check in Update()
   */
  shouldPlayLoopingSound(): boolean {
    return this._kind === ObjKind.LoopingSound && !!this._wavFileName;
  }

  /**
   * Check if this object should play random sound
   * C#: ObjKind.RandSound check in Update()
   */
  shouldPlayRandomSound(): boolean {
    return this._kind === ObjKind.RandSound && !!this._wavFileName;
  }

  /**
   * Get the position for 3D sound calculations
   * C#: PositionInWorld used in UpdateSound()
   */
  getSoundPosition(): Vector2 {
    return { ...this._positionInWorld };
  }

  // ============= Update Methods =============

  /**
   * C#: Update(GameTime)
   * Update object state - handles timer scripts, removal, animation, and trap damage
   *
   * 与 C# 的差异：C# 直接访问 NpcManager 和 Globals.ThePlayer，
   * TS 版本通过 engine (IEngineContext) 访问这些服务。
   *
   * @param deltaTime Time since last update in seconds
   */
  override update(deltaTime: number): void {
    const deltaMs = deltaTime * 1000;

    // Handle removal timer
    // C#: if (_millisecondsToRemove > 0) { ... if (_millisecondsToRemove <= 0) IsRemoved = true; }
    if (this._millisecondsToRemove > 0) {
      this._millisecondsToRemove -= deltaMs;
      if (this._millisecondsToRemove <= 0) {
        this._isRemoved = true;
      }
    }

    // Handle timer script
    // C#: if (!string.IsNullOrEmpty(_timerScriptFile)) { ... ScriptManager.RunScript(_timeScriptParserCache, this); }
    if (this._timerScriptFile) {
      this._timerScriptIntervalElapsed += deltaMs;
      if (this._timerScriptIntervalElapsed >= this._timerScriptInterval) {
        this._timerScriptIntervalElapsed -= this._timerScriptInterval;
        // 通过 engine 运行脚本（C#: ScriptManager.RunScript）
        this.engine.runScript(ResourcePath.script(this._timerScriptFile));
      }
    }

    // Update animation only if auto-play or playing
    // C#: if ((Texture.FrameCounts > 1 && IsAutoPlay) || IsInPlaying) base.Update(gameTime);
    if ((this._texture && this._texture.frameCount > 1 && this.isAutoPlay) || this.isInPlaying) {
      super.update(deltaTime);
    }

    // Handle based on object kind
    // C#: switch ((ObjKind)Kind) { case ObjKind.Trap: ... }
    switch (this._kind) {
      case ObjKind.Trap:
        // C#: if (Damage > 0 && CurrentFrameIndex == FrameBegin) // Hurting fighter character at frame begin
        if (this._damage > 0 && this._currentFrameIndex === this._frameBegin) {
          this.applyTrapDamage();
        }
        break;
      // LoopingSound and RandSound are handled by ObjManager.updateObjSound()
    }
  }

  /**
   * 应用陷阱伤害给同位置的 NPC 和玩家
   * C#: npc.DecreaseLifeAddHurt(Damage) / ThePlayer.DecreaseLifeAddHurt(Damage)
   */
  private applyTrapDamage(): void {
    const engine = this.engine;
    if (!engine) return;

    const mapX = this.mapX;
    const mapY = this.mapY;
    const damage = this._damage;

    // Damage NPCs at the same tile
    const npcManager = engine.getNpcManager();
    if (npcManager) {
      for (const [, npc] of npcManager.getAllNpcs()) {
        if (npc.isFighter && npc.mapX === mapX && npc.mapY === mapY) {
          npc.takeDamage(damage, null);
        }
      }
    }

    // Damage Player at the same tile
    const player = engine.getPlayer();
    if (player && player.mapX === mapX && player.mapY === mapY) {
      player.takeDamage(damage, null);
    }
  }

  /**
   * C#: Draw(SpriteBatch)
   * Draw the object with offsets
   */
  override draw(
    ctx: CanvasRenderingContext2D,
    cameraX: number,
    cameraY: number,
    offX: number = 0,
    offY: number = 0
  ): void {
    if (!this.isShow || !this._texture || this._isRemoved) return;

    // C#: Draw at PositionInWorld - Texture.Left + OffX, PositionInWorld - Texture.Bottom + OffY
    const screenX = this._positionInWorld.x - cameraX - this._texture.left + this._offX + offX;
    const screenY = this._positionInWorld.y - cameraY - this._texture.bottom + this._offY + offY;

    const dir = Math.min(this._currentDirection, Math.max(0, this._texture.directions - 1));
    const frameIdx = getFrameIndex(this._texture, dir, this._currentFrameIndex);

    if (frameIdx >= 0 && frameIdx < this._texture.frames.length) {
      const frame = this._texture.frames[frameIdx];
      if (frame && frame.width > 0 && frame.height > 0) {
        const canvas = getFrameCanvas(frame);
        ctx.drawImage(canvas, screenX, screenY);
      }
    }
  }

  /**
   * Load object from ini section data
   */
  loadFromSection(section: Record<string, string>): void {
    this._objName = section.ObjName || "";
    this._kind = parseInt(section.Kind || "0", 10) as ObjKind;
    const mapX = parseInt(section.MapX || "0", 10);
    const mapY = parseInt(section.MapY || "0", 10);
    this.setTilePosition(mapX, mapY);
    this._dir = parseInt(section.Dir || "0", 10);
    this._currentDirection = this._dir;
    this._frame = parseInt(section.Frame || "0", 10);
    this._currentFrameIndex = this._frame;
    this._offX = parseInt(section.OffX || "0", 10);
    this._offY = parseInt(section.OffY || "0", 10);
    this._damage = parseInt(section.Damage || "0", 10);
    this._lum = parseInt(section.Lum || "0", 10);
    this._height = parseInt(section.Height || "0", 10);
    this._scriptFile = section.ScriptFile || "";
    this._scriptFileRight = section.ScriptFileRight || "";
    this._wavFileName = section.WavFile || "";
    this._timerScriptFile = section.TimerScriptFile || "";
    this._timerScriptInterval = parseInt(section.TimerScriptInterval || "3000", 10);
    this._canInteractDirectly = parseInt(section.CanInteractDirectly || "0", 10);
    this._scriptFileJustTouch = parseInt(section.ScriptFileJustTouch || "0", 10);
    this._reviveNpcIni = section.ReviveNpcIni || "";

    // ObjFile needs to be loaded separately by ObjManager
    if (section.ObjFile) {
      this._objFileName = section.ObjFile;
    }

    // Sound objects (LoopingSound=3, RandSound=4) are invisible
    if (this._kind === ObjKind.LoopingSound || this._kind === ObjKind.RandSound) {
      this.isShow = false;
    }
  }

  /**
   * Set texture from loaded ASF
   */
  setAsfTexture(asf: AsfData): void {
    this._texture = asf;
    const framesPerDir = asf.framesPerDirection || 1;
    this._frameBegin = 0;
    this._frameEnd = framesPerDir - 1;
    // Ensure currentFrameIndex is within bounds
    if (this._currentFrameIndex > this._frameEnd) {
      this._currentFrameIndex = this._frameBegin;
    }
  }

  /**
   * 从 ini/obj/ 文件创建 Obj 实例
   * 对应 C# 的 new Obj(@"ini\obj\" + fileName) 构造函数
   * 用于 BodyIni 等场景
   */
  static async createFromFile(fileName: string): Promise<Obj | null> {
    try {
      const filePath = ResourcePath.obj(fileName);
      const content = await resourceLoader.loadText(filePath);
      if (!content) return null;

      const sections = parseIni(content);

      // 使用 INIT section 作为对象定义
      const initSection = sections.INIT || sections.Init || Object.values(sections)[0];
      if (!initSection) return null;

      const obj = new Obj();
      obj.loadFromSection(initSection);

      const id = `body_${fileName}_${Date.now()}`;
      obj.id = id;
      obj.fileName = fileName;

      // 加载 objres 资源
      if (obj.objFileName) {
        const objResPath = ResourcePath.objRes(obj.objFileName);
        const resContent = await resourceLoader.loadText(objResPath);
        if (resContent) {
          const resSections = parseIni(resContent);
          const commonSection =
            resSections.Common || resSections.Open || Object.values(resSections)[0];
          if (commonSection) {
            const resInfo: ObjResInfo = {
              imagePath: commonSection.Image || "",
              soundPath: commonSection.Sound || "",
            };
            obj.objFile.set(ObjState.Common, resInfo);
            // 加载 ASF 纹理
            if (resInfo.imagePath) {
              const asfPath = ResourcePath.asfObject(resInfo.imagePath);
              const asf = await loadAsf(asfPath);
              if (asf) {
                obj.setAsfTexture(asf);
              }
            }
          }
        }
      }

      return obj;
    } catch (error) {
      logger.error(`Error loading obj from file ${fileName}:`, error);
      return null;
    }
  }
}
