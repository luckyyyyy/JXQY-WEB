/**
 * Obj class - based on JxqyHD Engine/Obj.cs
 * Interactive objects on the map (herbs, tombstones, chests, etc.)
 * Extends Sprite with object-specific functionality
 */
import type { Vector2 } from "../core/types";
import { tileToPixel, pixelToTile } from "../core/utils";
import { Sprite } from "../sprite/sprite";
import { loadAsf, getFrameCanvas, getFrameIndex, type AsfData } from "../sprite/asf";

/**
 * Object Kind enum matching C# Obj.ObjKind
 */
export enum ObjKind {
  Dynamic = 0,      // Animated, obstacle
  Static = 1,       // Static, obstacle
  Body = 2,         // Dead body
  LoopingSound = 3, // Looping sound emitter (invisible)
  RandSound = 4,    // Random sound emitter (invisible)
  Door = 5,         // Door
  Trap = 6,         // Trap
  Drop = 7,         // Dropped item
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

  constructor() {
    super();
  }

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
      this._kind === ObjKind.Dynamic ||
      this._kind === ObjKind.Static ||
      this._kind === ObjKind.Door
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
      this._kind === ObjKind.Dynamic ||
      this._kind === ObjKind.Trap ||
      this._kind === ObjKind.Drop
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

  /**
   * C#: Update(GameTime)
   * Update object state - handles timer scripts, removal, and animation
   */
  override update(deltaTime: number): void {
    const deltaMs = deltaTime * 1000;

    // Handle removal timer
    if (this._millisecondsToRemove > 0) {
      this._millisecondsToRemove -= deltaMs;
      if (this._millisecondsToRemove <= 0) {
        this._isRemoved = true;
        return;
      }
    }

    // Handle timer script
    if (this._timerScriptFile) {
      this._timerScriptIntervalElapsed += deltaMs;
      if (this._timerScriptIntervalElapsed >= this._timerScriptInterval) {
        this._timerScriptIntervalElapsed -= this._timerScriptInterval;
        // Timer script execution would be handled by ObjManager/GameManager
      }
    }

    // Update animation only if auto-play or playing
    if ((this._texture && this._texture.frameCount > 1 && this.isAutoPlay) || this.isInPlaying) {
      super.update(deltaTime);
    }

    // Handle trap damage (would need references to NpcManager and Player)
    // This is handled at ObjManager level in the TS version
  }

  /**
   * C#: Draw(SpriteBatch)
   * Draw the object with offsets
   */
  override draw(
    ctx: CanvasRenderingContext2D,
    cameraX: number,
    cameraY: number,
    isHighlighted: boolean = false,
    highlightColor: string = "rgba(255, 255, 0, 0.6)"
  ): void {
    if (!this._isShow || !this._texture || this._isRemoved) return;

    // C#: Draw at PositionInWorld - Texture.Left + OffX, PositionInWorld - Texture.Bottom + OffY
    const screenX = this._positionInWorld.x - cameraX - this._texture.left + this._offX;
    const screenY = this._positionInWorld.y - cameraY - this._texture.bottom + this._offY;

    const dir = Math.min(this._currentDirection, Math.max(0, this._texture.directions - 1));
    const frameIdx = getFrameIndex(this._texture, dir, this._currentFrameIndex);

    if (frameIdx >= 0 && frameIdx < this._texture.frames.length) {
      const frame = this._texture.frames[frameIdx];
      if (frame && frame.width > 0 && frame.height > 0) {
        const canvas = getFrameCanvas(frame);

        // Draw highlight edge if hovered
        if (isHighlighted) {
          this.drawHighlightEdge(ctx, canvas, screenX, screenY, highlightColor);
        }

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
      this._isShow = false;
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
}
