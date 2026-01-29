/**
 * Sprite class - based on JxqyHD Engine/Sprite.cs
 * Base class for all visual game objects with animation
 */
import type { Vector2, Direction } from "../core/types";
import { CharacterState, TILE_WIDTH, TILE_HEIGHT } from "../core/types";
import { tileToPixel, pixelToTile } from "../core/utils";
import { loadAsf, getFrameCanvas, getFrameIndex, type AsfData } from "./asf";
import { getOuterEdge } from "../utils/edgeDetection";

/**
 * Sprite set containing ASF data for different states
 * Based on C#'s NpcIni StateMapList
 */
export interface SpriteSet {
  stand: AsfData | null;
  stand1: AsfData | null;
  walk: AsfData | null;
  run: AsfData | null;
  jump: AsfData | null;
  attack: AsfData | null;
  attack1: AsfData | null;
  attack2: AsfData | null;
  magic: AsfData | null;
  hurt: AsfData | null;
  death: AsfData | null;
  sit: AsfData | null;
  special: AsfData | null;
  // Fight states (separate from normal states)
  fightStand: AsfData | null;
  fightWalk: AsfData | null;
  fightRun: AsfData | null;
  fightJump: AsfData | null;
}

/**
 * Create empty sprite set
 */
export function createEmptySpriteSet(): SpriteSet {
  return {
    stand: null,
    stand1: null,
    walk: null,
    run: null,
    jump: null,
    attack: null,
    attack1: null,
    attack2: null,
    magic: null,
    hurt: null,
    death: null,
    sit: null,
    special: null,
    fightStand: null,
    fightWalk: null,
    fightRun: null,
    fightJump: null,
  };
}

// Cache for sprite sets
const spriteCache = new Map<string, SpriteSet>();

/**
 * Try to load ASF with fallback suffixes
 */
async function loadAsfWithFallback(
  basePath: string,
  baseFileName: string,
  suffixes: string[]
): Promise<AsfData | null> {
  for (const suffix of suffixes) {
    const url = `${basePath}/${baseFileName}${suffix}.asf`;
    const asf = await loadAsf(url);
    if (asf) {
      return asf;
    }
  }
  return null;
}

/**
 * Load sprite set for a character
 */
export async function loadSpriteSet(
  basePath: string,
  baseFileName: string,
  onProgress?: (loaded: number, total: number) => void
): Promise<SpriteSet> {
  const cacheKey = `${basePath}/${baseFileName}`;
  const cached = spriteCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  const spriteSet = createEmptySpriteSet();

  const statesToLoad: { key: keyof SpriteSet; suffixes: string[] }[] = [
    { key: "stand", suffixes: ["_st", "_pst"] },
    { key: "stand1", suffixes: ["_sst2", "_st2", "_st"] },
    { key: "walk", suffixes: ["_wlk", "_wlk2"] },
    { key: "run", suffixes: ["_run", "_run2", "_wlk"] },
    { key: "attack", suffixes: ["_at", "_bat"] },
    { key: "attack1", suffixes: ["_at", "_bat"] },
    { key: "attack2", suffixes: ["_bat", "_at"] },
    { key: "magic", suffixes: ["_bat", "_at"] },
    { key: "hurt", suffixes: ["_pst", "_st"] },
    { key: "death", suffixes: ["_die", "_body"] },
    { key: "sit", suffixes: ["_sit", "_sst2", "_st"] },
    { key: "special", suffixes: ["_pst", "_st"] },
  ];

  let loaded = 0;
  const total = statesToLoad.length;

  for (const { key, suffixes } of statesToLoad) {
    spriteSet[key] = await loadAsfWithFallback(basePath, baseFileName, suffixes);
    loaded++;
    onProgress?.(loaded, total);
  }

  spriteCache.set(cacheKey, spriteSet);
  return spriteSet;
}

/**
 * Get ASF for a character state
 */
export function getAsfForState(spriteSet: SpriteSet, state: CharacterState): AsfData | null {
  switch (state) {
    case CharacterState.Stand:
      return spriteSet.stand;
    case CharacterState.FightStand:
      // FightStand uses fightStand, fallback to stand
      return spriteSet.fightStand || spriteSet.stand;
    case CharacterState.Stand1:
      return spriteSet.stand1 || spriteSet.stand;
    case CharacterState.Walk:
      return spriteSet.walk || spriteSet.stand;
    case CharacterState.FightWalk:
      // FightWalk uses fightWalk, fallback to walk then stand
      return spriteSet.fightWalk || spriteSet.walk || spriteSet.stand;
    case CharacterState.Run:
      return spriteSet.run || spriteSet.walk || spriteSet.stand;
    case CharacterState.FightRun:
      // FightRun uses fightRun, fallback to run, walk, stand
      return spriteSet.fightRun || spriteSet.run || spriteSet.walk || spriteSet.stand;
    case CharacterState.Jump:
      // Jump uses jump animation, fallback to run then walk
      return spriteSet.jump || spriteSet.run || spriteSet.walk || spriteSet.stand;
    case CharacterState.FightJump:
      // FightJump uses fightJump, fallback to jump, fightRun, run
      return spriteSet.fightJump || spriteSet.jump || spriteSet.fightRun || spriteSet.run || spriteSet.stand;
    case CharacterState.Attack:
      return spriteSet.attack || spriteSet.stand;
    case CharacterState.Attack1:
      return spriteSet.attack1 || spriteSet.attack || spriteSet.stand;
    case CharacterState.Attack2:
      return spriteSet.attack2 || spriteSet.attack || spriteSet.stand;
    case CharacterState.Magic:
      return spriteSet.magic || spriteSet.attack || spriteSet.stand;
    case CharacterState.Hurt:
      return spriteSet.hurt || spriteSet.stand;
    case CharacterState.Death:
      return spriteSet.death || spriteSet.hurt || spriteSet.stand;
    case CharacterState.Sit:
      return spriteSet.sit || spriteSet.stand1 || spriteSet.stand;
    case CharacterState.Special:
      return spriteSet.special || spriteSet.stand;
    default:
      return spriteSet.stand;
  }
}

/**
 * Sprite class - base class for all visual objects
 * Based on C# Engine/Sprite.cs
 */
export class Sprite {
  // C#: _positionInWorld - world pixel position
  protected _positionInWorld: Vector2 = { x: 0, y: 0 };
  // C#: _mapX, _mapY - tile coordinates
  protected _mapX: number = 0;
  protected _mapY: number = 0;
  // C#: _velocity
  protected _velocity: number = 0;
  // C#: _currentDirection
  protected _currentDirection: number = 4; // Default: South
  // C#: _texture (current ASF)
  protected _texture: AsfData | null = null;
  // C#: _currentFrameIndex
  protected _currentFrameIndex: number = 0;
  // C#: _frameBegin, _frameEnd
  protected _frameBegin: number = 0;
  protected _frameEnd: number = 0;
  // C#: _isInPlaying
  protected _isInPlaying: boolean = false;
  // C#: _isPlayReverse
  protected _isPlayReverse: boolean = false;
  // C#: _leftFrameToPlay
  protected _leftFrameToPlay: number = 0;
  // C#: _isShow
  protected _isShow: boolean = true;

  // Animation timing
  protected _animationTime: number = 0;

  // Sprite resources
  protected _basePath: string = "";
  protected _baseFileName: string = "";
  protected _spriteSet: SpriteSet = createEmptySpriteSet();
  protected _customActionFiles: Map<number, string> = new Map();
  protected _customAsfCache: Map<number, AsfData | null> = new Map();

  constructor() {}

  // ============= Position Properties (C#: PositionInWorld, MapX, MapY) =============

  get positionInWorld(): Vector2 {
    return this._positionInWorld;
  }

  set positionInWorld(value: Vector2) {
    this._positionInWorld = value;
    const tile = pixelToTile(value.x, value.y);
    this._mapX = tile.x;
    this._mapY = tile.y;
  }

  get mapX(): number {
    return this._mapX;
  }

  set mapX(value: number) {
    this._mapX = value;
    this._updatePositionFromTile();
  }

  get mapY(): number {
    return this._mapY;
  }

  set mapY(value: number) {
    this._mapY = value;
    this._updatePositionFromTile();
  }

  /**
   * C#: TilePosition property
   */
  get tilePosition(): Vector2 {
    return { x: this._mapX, y: this._mapY };
  }

  set tilePosition(value: Vector2) {
    this._mapX = value.x;
    this._mapY = value.y;
    this._updatePositionFromTile();
  }

  /**
   * Update pixel position from tile coordinates
   */
  protected _updatePositionFromTile(): void {
    this._positionInWorld = tileToPixel(this._mapX, this._mapY);
  }

  // ============= Velocity =============

  get velocity(): number {
    return this._velocity;
  }

  set velocity(value: number) {
    this._velocity = value;
  }

  // ============= Direction =============

  get currentDirection(): number {
    return this._currentDirection;
  }

  set currentDirection(value: number) {
    this._currentDirection = value;
  }

  // ============= Texture/Animation =============

  get texture(): AsfData | null {
    return this._texture;
  }

  set texture(value: AsfData | null) {
    this._texture = value;
    if (value) {
      this._frameEnd = (value.framesPerDirection || 1) - 1;
    }
  }

  get currentFrameIndex(): number {
    return this._currentFrameIndex;
  }

  set currentFrameIndex(value: number) {
    this._currentFrameIndex = value;
  }

  get isInPlaying(): boolean {
    return this._leftFrameToPlay > 0;
  }

  get isShow(): boolean {
    return this._isShow;
  }

  set isShow(value: boolean) {
    this._isShow = value;
  }

  // ============= Sprite Set =============

  get spriteSet(): SpriteSet {
    return this._spriteSet;
  }

  get basePath(): string {
    return this._basePath;
  }

  get baseFileName(): string {
    return this._baseFileName;
  }

  // ============= Methods =============

  /**
   * C#: Set(position, velocity, texture, direction)
   */
  set(position: Vector2, velocity: number, texture: AsfData | null, direction: number): void {
    this._positionInWorld = position;
    const tile = pixelToTile(position.x, position.y);
    this._mapX = tile.x;
    this._mapY = tile.y;
    this._velocity = velocity;
    this._texture = texture;
    this._currentDirection = direction;
    if (texture) {
      this._frameEnd = (texture.framesPerDirection || 1) - 1;
    }
  }

  /**
   * C#: SetTilePosition
   */
  setTilePosition(tileX: number, tileY: number): void {
    this._mapX = tileX;
    this._mapY = tileY;
    this._updatePositionFromTile();
  }

  /**
   * C#: PlayFrames(begin, end)
   */
  playFrames(begin: number, end: number): void {
    this._frameBegin = begin;
    this._frameEnd = end;
    this._currentFrameIndex = begin;
    this._leftFrameToPlay = end - begin + 1;
    this._isPlayReverse = false;
    this._isInPlaying = true;
  }

  /**
   * C#: PlayCurrentDirOnce()
   * Plays current direction animation once. Won't restart if already playing.
   */
  playCurrentDirOnce(): void {
    // C#: if (IsInPlaying) return;
    if (this.isInPlaying) return;
    if (!this._texture) return;
    const framesPerDir = this._texture.framesPerDirection || 1;
    this._frameBegin = 0;
    this._frameEnd = framesPerDir - 1;
    this._currentFrameIndex = 0;
    this._leftFrameToPlay = framesPerDir;
    this._isPlayReverse = false;
    this._isInPlaying = true;
  }

  /**
   * C#: EndPlayCurrentDirOnce()
   * Stops any currently playing animation.
   */
  endPlayCurrentDirOnce(): void {
    this._leftFrameToPlay = 0;
  }

  /**
   * C#: IsPlayCurrentDirOnceEnd()
   */
  isPlayCurrentDirOnceEnd(): boolean {
    return !this.isInPlaying;
  }

  /**
   * C#: Update(gameTime)
   */
  update(deltaTime: number): void {
    if (!this._texture || !this._isShow) return;

    const deltaMs = deltaTime * 1000;
    this._animationTime += deltaMs;

    const frameInterval = this._texture.interval || 100;

    while (this._animationTime >= frameInterval) {
      this._animationTime -= frameInterval;
      this._advanceFrame();
    }
  }

  /**
   * Advance animation frame
   * C#: CurrentFrameIndex setter automatically wraps around
   * C# Reference: Sprite.Update() - frame advances first, then _leftFrameToPlay decrements
   */
  protected _advanceFrame(): void {
    // C# order: first advance frame, then decrement _leftFrameToPlay
    if (this._isPlayReverse) {
      this._currentFrameIndex--;
      if (this._currentFrameIndex < this._frameBegin) {
        // C#: When playing once, stop at last frame instead of looping
        if (this._leftFrameToPlay === 1) {
          // This is the last frame - stay here, don't loop
          this._currentFrameIndex = this._frameBegin;
        } else {
          this._currentFrameIndex = this._frameEnd;
        }
      }
    } else {
      this._currentFrameIndex++;
      // C#: CurrentFrameIndex setter always wraps around
      if (this._currentFrameIndex > this._frameEnd) {
        // C#: When playing once, stop at last frame instead of looping
        if (this._leftFrameToPlay === 1) {
          // This is the last frame - stay here, don't loop
          this._currentFrameIndex = this._frameEnd;
        } else {
          this._currentFrameIndex = this._frameBegin;
        }
      }
    }

    // C# Reference: after frame advances, decrement _leftFrameToPlay
    if (this._leftFrameToPlay > 0) {
      this._leftFrameToPlay--;
    }
  }

  /**
   * C#: Draw(spriteBatch)
   * 注意：高亮边缘不在这里绘制，而是在所有内容渲染后单独调用 drawHighlight
   * @param isHighlighted If true, 标记需要高亮但不在这里绘制
   * @param highlightColor Edge color for highlight (用于单独的 drawHighlight 调用)
   */
  draw(
    ctx: CanvasRenderingContext2D,
    cameraX: number,
    cameraY: number,
    isHighlighted: boolean = false,
    highlightColor: string = "rgba(255, 255, 0, 0.6)"
  ): void {
    if (!this._isShow || !this._texture) return;

    const screenX = this._positionInWorld.x - cameraX;
    const screenY = this._positionInWorld.y - cameraY;

    const dir = Math.min(this._currentDirection, this._texture.directions - 1);
    const frameIdx = getFrameIndex(this._texture, dir, this._currentFrameIndex);

    if (frameIdx >= 0 && frameIdx < this._texture.frames.length) {
      const frame = this._texture.frames[frameIdx];
      const canvas = getFrameCanvas(frame);
      const drawX = screenX - this._texture.left;
      const drawY = screenY - this._texture.bottom;

      // 注意：不在这里绘制高亮边缘
      // 高亮边缘应该在所有内容渲染完后由 drawHighlight 单独绘制

      ctx.drawImage(canvas, drawX, drawY);
    }
  }

  /**
   * Draw highlight edge (called separately to ensure it's on top layer)
   * C# Reference: Player.Draw 末尾绘制 OutEdgeSprite
   * C# Reference: TextureGenerator.GetOuterEdge - 边缘检测算法
   */
  drawHighlight(
    ctx: CanvasRenderingContext2D,
    cameraX: number,
    cameraY: number,
    highlightColor: string = "rgba(255, 255, 0, 0.6)"
  ): void {
    if (!this._isShow || !this._texture) return;

    const screenX = this._positionInWorld.x - cameraX;
    const screenY = this._positionInWorld.y - cameraY;

    const dir = Math.min(this._currentDirection, this._texture.directions - 1);
    const frameIdx = getFrameIndex(this._texture, dir, this._currentFrameIndex);

    if (frameIdx >= 0 && frameIdx < this._texture.frames.length) {
      const frame = this._texture.frames[frameIdx];
      const canvas = getFrameCanvas(frame);
      const drawX = screenX - this._texture.left;
      const drawY = screenY - this._texture.bottom;

      // 使用边缘检测生成边缘纹理（C# GetOuterEdge算法）
      const edgeCanvas = getOuterEdge(canvas, highlightColor);

      // 绘制边缘
      ctx.drawImage(edgeCanvas, drawX, drawY);
    }
  }

  /**
   * Draw highlight edge around sprite (deprecated, use drawHighlight instead)
   * 保留此方法以兼容旧代码，但内部不再使用 shadow glow
   * @deprecated Use drawHighlight instead
   */
  protected drawHighlightEdge(
    ctx: CanvasRenderingContext2D,
    canvas: HTMLCanvasElement | OffscreenCanvas,
    screenX: number,
    screenY: number,
    color: string
  ): void {
    // 使用边缘检测代替原来的 shadow glow
    const edgeCanvas = getOuterEdge(canvas, color);
    ctx.drawImage(edgeCanvas, screenX, screenY);
  }

  // ============= Custom Action Files =============

  /**
   * Set custom action file for a state
   */
  setCustomActionFile(state: number, asfFile: string): void {
    this._customActionFiles.set(state, asfFile);
    // Clear cache for this state
    this._customAsfCache.delete(state);
  }

  /**
   * Get custom action file for a state
   */
  getCustomActionFile(state: number): string | undefined {
    return this._customActionFiles.get(state);
  }

  /**
   * Load custom ASF file
   */
  async loadCustomAsf(asfFileName: string): Promise<AsfData | null> {
    const paths = [
      `/resources/asf/character/${asfFileName}`,
      `/resources/asf/interlude/${asfFileName}`,
    ];

    for (const path of paths) {
      const asf = await loadAsf(path);
      if (asf) {
        console.log(`[Sprite] Loaded custom ASF: ${path}`);
        return asf;
      }
    }

    console.warn(`[Sprite] Failed to load custom ASF: ${asfFileName}`);
    return null;
  }

  /**
   * Clear sprite cache
   */
  static clearCache(): void {
    spriteCache.clear();
  }
}
