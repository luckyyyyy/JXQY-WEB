/**
 * Obj class - based on JxqyHD Engine/Obj.cs
 * Interactive objects on the map (herbs, tombstones, chests, etc.)
 * Extends Sprite with object-specific functionality
 */

import { ResourcePath, resolveScriptPath } from "../resource/resource-paths";
import { logger } from "../core/logger";
import type { Vector2 } from "../core/types";
import { type AsfData, getFrameCanvas, getFrameIndex, loadAsf } from "../resource/format/asf";
import { Sprite } from "../sprite/sprite";
import type { IRenderer } from "../renderer/i-renderer";
import { getObjConfigFromCache, type ObjConfig, type ObjResInfo } from "./obj-config-loader";

/**
 * Object Kind enum matching Obj.ObjKind
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
 * Object state enum matching ObjState
 */
export enum ObjState {
  Common = 0,
  Open = 1,
  Opened = 2,
  Closed = 3,
}

/**
 * Object save data for persistence
 * Obj.Save(KeyDataCollection keyDataCollection)
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
 * StateMapList = Dictionary<int, ResStateInfo>
 */
export type StateMapList = Map<number, ObjResInfo>;

/**
 * Obj class - Interactive object on the map
 * /Obj.cs which extends Sprite
 */
export class Obj extends Sprite {
  // file name for this object
  protected _fileName: string = "";

  protected _isRemoved: boolean = false;

  // ============= Object Properties =============

  protected _objName: string = "";

  protected _kind: ObjKind = ObjKind.Dynamic;
  // _dir (direction stored separately for obj, parent has _currentDirection)
  protected _dir: number = 0;

  protected _damage: number = 0;
  // _frame (initial frame)
  protected _frame: number = 0;

  protected _height: number = 0;
  // _lum (luminosity)
  protected _lum: number = 0;
  // _objFile (StateMapList)
  protected _objFile: StateMapList = new Map();
  // _objFileName (reference to objres file)
  protected _objFileName: string = "";

  protected _scriptFile: string = "";

  protected _scriptFileRight: string = "";

  protected _canInteractDirectly: number = 0;

  protected _timerScriptFile: string = "";

  protected _timerScriptInterval: number = 3000; // Globals.DefaultNpcObjTimeScriptInterval

  protected _timerScriptIntervalElapsed: number = 0;

  protected _wavFileName: string = "";
  // _offX, _offY
  protected _offX: number = 0;
  protected _offY: number = 0;

  protected _reviveNpcIni: string = "";

  protected _scriptFileJustTouch: number = 0;

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
   * override to include offsets
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
   * = 3
   */
  get isLoopingSound(): boolean {
    return this._kind === ObjKind.LoopingSound;
  }

  /**
   * Check if this is a random sound object
   * = 4
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
   * check if object blocks movement
   */
  get isObstacle(): boolean {
    return (
      this._kind === ObjKind.Dynamic || this._kind === ObjKind.Static || this._kind === ObjKind.Door
    );
  }

  /**
   * check if object is a dropped item
   */
  get isDrop(): boolean {
    return this._kind === ObjKind.Drop;
  }

  /**
   * check if object should auto-animate
   */
  get isAutoPlay(): boolean {
    return (
      this._kind === ObjKind.Dynamic || this._kind === ObjKind.Trap || this._kind === ObjKind.Drop
    );
  }

  /**
   * check if object can be interacted with
   */
  get isInteractive(): boolean {
    return this.hasInteractScript;
  }

  /**
   *
   */
  get hasInteractScript(): boolean {
    return this._scriptFile !== "";
  }

  /**
   *
   */
  get hasInteractScriptRight(): boolean {
    return this._scriptFileRight !== "";
  }

  /**
   *
   */
  get isTrap(): boolean {
    return this._kind === ObjKind.Trap;
  }

  /**
   *
   */
  get isBody(): boolean {
    return this._kind === ObjKind.Body;
  }

  // ============= Methods =============

  /**
   * SetObjFile(fileName)
   * Load the objres file and set up textures
   */
  setObjFile(fileName: string): void {
    this._objFileName = fileName;
    // Note: Actual loading is done by ObjManager since it needs async
  }

  /**
   * SetWaveFile(fileName)
   */
  setWaveFile(fileName: string): void {
    this.wavFile = fileName;
  }

  /**
   * InitializeFigure()
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
   * OpenBox()
   * Play animation forward (open) - from current frame to end
   * PlayFrames(FrameEnd - CurrentFrameIndex)
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
   * CloseBox()
   * Play animation backward (close) - from current frame to begin
   * PlayFrames(CurrentFrameIndex - FrameBegin, true)
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
   * SetOffSet(Vector2)
   */
  setOffset(offset: Vector2): void {
    this._offX = offset.x;
    this._offY = offset.y;
  }

  // ============= Save/Load Methods =============

  /**
   * Save(KeyDataCollection keyDataCollection)
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
   * StartInteract(bool isRight)
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
      const fullPath = resolveScriptPath(scriptBasePath, scriptFile);
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
   * WavFile property with SoundEffect loading
   */
  getSoundFile(): string {
    return this._wavFileName;
  }

  /**
   * Check if this object should play looping sound
   * ObjKind.LoopingSound check in Update()
   */
  shouldPlayLoopingSound(): boolean {
    return this._kind === ObjKind.LoopingSound && !!this._wavFileName;
  }

  /**
   * Check if this object should play random sound
   * ObjKind.RandSound check in Update()
   */
  shouldPlayRandomSound(): boolean {
    return this._kind === ObjKind.RandSound && !!this._wavFileName;
  }

  /**
   * Get the position for 3D sound calculations
   * PositionInWorld used in UpdateSound()
   */
  getSoundPosition(): Vector2 {
    return { ...this._positionInWorld };
  }

  // ============= Update Methods =============

  /**
   * Update(GameTime)
   * Update object state - handles timer scripts, removal, animation, and trap damage
   *
   * 与原版的差异：原版直接访问 NpcManager 和 Globals.ThePlayer，
   * TS 版本通过 engine (IEngineContext) 访问这些服务。
   *
   * @param deltaTime Time since last update in seconds
   */
  override update(deltaTime: number): void {
    const deltaMs = deltaTime * 1000;

    // Handle removal timer
    // if (_millisecondsToRemove > 0) { ... if (_millisecondsToRemove <= 0) IsRemoved = true; }
    if (this._millisecondsToRemove > 0) {
      this._millisecondsToRemove -= deltaMs;
      if (this._millisecondsToRemove <= 0) {
        this._isRemoved = true;
      }
    }

    // Handle timer script
    // if (!string.IsNullOrEmpty(_timerScriptFile)) { ... ScriptManager.RunScript(_timeScriptParserCache, this); }
    if (this._timerScriptFile) {
      this._timerScriptIntervalElapsed += deltaMs;
      if (this._timerScriptIntervalElapsed >= this._timerScriptInterval) {
        this._timerScriptIntervalElapsed -= this._timerScriptInterval;
        // 通过 engine 运行脚本
        this.engine.runScript(ResourcePath.script(this._timerScriptFile));
      }
    }

    // Update animation only if auto-play or playing
    // if ((Texture.FrameCounts > 1 && IsAutoPlay) || IsInPlaying) base.Update(gameTime);
    if ((this._texture && this._texture.frameCount > 1 && this.isAutoPlay) || this.isInPlaying) {
      super.update(deltaTime);
    }

    // Handle based on object kind
    // switch ((ObjKind)Kind) { case ObjKind.Trap: ... }
    switch (this._kind) {
      case ObjKind.Trap:
        // if (Damage > 0 && CurrentFrameIndex == FrameBegin) // Hurting fighter character at frame begin
        if (this._damage > 0 && this._currentFrameIndex === this._frameBegin) {
          this.applyTrapDamage();
        }
        break;
      // LoopingSound and RandSound are handled by ObjManager.updateObjSound()
    }
  }

  /**
   * 应用陷阱伤害给同位置的 NPC 和玩家
   * npc.DecreaseLifeAddHurt(Damage) / ThePlayer.DecreaseLifeAddHurt(Damage)
   */
  private applyTrapDamage(): void {
    const engine = this.engine;
    if (!engine) return;

    const mapX = this.mapX;
    const mapY = this.mapY;
    const damage = this._damage;

    // Damage NPCs at the same tile
    const npcManager = engine.npcManager;
    if (npcManager) {
      for (const [, npc] of npcManager.getAllNpcs()) {
        if (npc.isFighter && npc.mapX === mapX && npc.mapY === mapY) {
          npc.takeDamage(damage, null);
        }
      }
    }

    // Damage Player at the same tile
    const player = engine.player;
    if (player && player.mapX === mapX && player.mapY === mapY) {
      player.takeDamage(damage, null);
    }
  }

  /**
   * Draw(SpriteBatch)
   * Draw the object with offsets
   */
  override draw(
    renderer: IRenderer,
    cameraX: number,
    cameraY: number,
    offX: number = 0,
    offY: number = 0
  ): void {
    if (!this.isShow || !this._texture || this._isRemoved) return;

    // Draw at PositionInWorld - Texture.Left + OffX, PositionInWorld - Texture.Bottom + OffY
    const screenX = this._positionInWorld.x - cameraX - this._texture.left + this._offX + offX;
    const screenY = this._positionInWorld.y - cameraY - this._texture.bottom + this._offY + offY;

    const dir = Math.min(this._currentDirection, Math.max(0, this._texture.directions - 1));
    const frameIdx = getFrameIndex(this._texture, dir, this._currentFrameIndex);

    if (frameIdx >= 0 && frameIdx < this._texture.frames.length) {
      const frame = this._texture.frames[frameIdx];
      if (frame && frame.width > 0 && frame.height > 0) {
        const canvas = getFrameCanvas(frame);
        renderer.drawSource(canvas, screenX, screenY);
      }
    }
  }

  /**
   * 从 API 缓存的 ObjConfig 加载属性（代替读取本地 INI 文件）
   */
  loadFromConfig(config: ObjConfig): void {
    this._objName = config.name;
    this._kind = config.kind as ObjKind;
    this._dir = config.dir;
    this._currentDirection = this._dir;
    this._frame = config.frame;
    this._currentFrameIndex = this._frame;
    this._offX = config.offX;
    this._offY = config.offY;
    this._damage = config.damage;
    this._lum = config.lum;
    this._height = config.height;
    this._scriptFile = config.script;
    this._scriptFileRight = config.scriptRight;
    this._wavFileName = config.wavFile;
    this._timerScriptFile = config.timerScriptFile;
    this._timerScriptInterval = config.timerScriptInterval;
    this._canInteractDirectly = config.canInteractDirectly;
    this._scriptFileJustTouch = config.scriptFileJustTouch;
    this._reviveNpcIni = config.reviveNpcIni;

    // 设置 objres 文件名引用（用于存档保存/加载时查找纹理资源）
    if (config.objFile) {
      this._objFileName = config.objFile;
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
   * 从 API 缓存创建 Obj 实例
   * 对应 new Obj(@"ini\obj\" + fileName) 构造函数
   * 用于 BodyIni 等场景
   */
  static async createFromFile(fileName: string): Promise<Obj | null> {
    try {
      const config = getObjConfigFromCache(fileName);
      if (!config) {
        logger.warn(`[Obj] createFromFile: config not found in cache for ${fileName}`);
        return null;
      }

      const obj = new Obj();
      obj.loadFromConfig(config);

      const id = `body_${fileName}_${Date.now()}`;
      obj.id = id;
      obj.fileName = fileName;

      // 从 config 中直接加载 ASF 纹理（API 缓存已合并 objres 资源）
      if (config.image) {
        const resInfo: ObjResInfo = { imagePath: config.image, soundPath: config.sound };
        obj.objFile.set(ObjState.Common, resInfo);

        const asfPath = ResourcePath.asfObject(config.image);
        const asf = await loadAsf(asfPath);
        if (asf) {
          obj.setAsfTexture(asf);
        }
      }

      // 设置音效
      if (config.sound && !obj.wavFile) {
        obj.wavFile = config.sound;
      }

      return obj;
    } catch (error) {
      logger.error(`Error loading obj from file ${fileName}:`, error);
      return null;
    }
  }
}
