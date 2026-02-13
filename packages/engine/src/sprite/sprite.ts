/**
 * Sprite class - based on JxqyHD Engine/Sprite.cs
 * Base class for all visual game objects with animation
 */

import { ResourcePath } from "../resource/resource-paths";
import { EngineAccess } from "../core/engine-access";
import { logger } from "../core/logger";
import type { Vector2 } from "../core/types";
import { CharacterState } from "../core/types";
import { getDirectionIndex, pixelToTile, tileToPixel } from "../utils";
import { getOuterEdge } from "./edge-detection";
import type { IRenderer } from "../renderer/i-renderer";
import type { ColorFilter } from "../renderer/types";
import { type AsfData, type AsfFrame, getFrameAtlasInfo, getFrameCanvas, getFrameIndex, loadAsf } from "../resource/format/asf";

// ============= 全局精灵渲染颜色 =============
// 替代原 Sprite.drawColor 静态属性，由 GameEngine 每帧更新
let _spriteDrawColor = "white";

/** 获取全局精灵绘制颜色 */
export function getSpriteDrawColor(): string {
  return _spriteDrawColor;
}

/** 设置全局精灵绘制颜色（仅 GameEngine 调用） */
export function setSpriteDrawColor(color: string): void {
  _spriteDrawColor = color;
}

/** 角色状态对应的 ASF 动画集 */
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
  fightStand: AsfData | null;
  fightWalk: AsfData | null;
  fightRun: AsfData | null;
  fightJump: AsfData | null;
}

/** 创建空的精灵集 */
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

const spriteCache = new Map<string, SpriteSet>();

/** 颜色名称 → IRenderer ColorFilter 映射 */
const COLOR_FILTER_MAP: Readonly<Record<string, ColorFilter>> = {
  black: "grayscale",
  frozen: "frozen",
  poison: "poison",
} as const;

/** 尝试加载 ASF 文件，支持后缀回退 */
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

/** 加载角色精灵集 */
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

  // 所有状态并行加载（各状态之间无依赖，fallback 逻辑在 loadAsfWithFallback 内部保持串行）
  await Promise.all(
    statesToLoad.map(async ({ key, suffixes }) => {
      spriteSet[key] = await loadAsfWithFallback(basePath, baseFileName, suffixes);
      loaded++;
      onProgress?.(loaded, total);
    })
  );

  spriteCache.set(cacheKey, spriteSet);
  return spriteSet;
}

// 状态到 ASF 的 fallback 映射表
const STATE_ASF_FALLBACKS: Record<CharacterState, (keyof SpriteSet)[]> = {
  [CharacterState.Stand]: ["stand"],
  [CharacterState.FightStand]: ["fightStand", "stand"],
  [CharacterState.Stand1]: ["stand1", "stand"],
  [CharacterState.Walk]: ["walk", "stand"],
  [CharacterState.FightWalk]: ["fightWalk", "walk", "stand"],
  [CharacterState.Run]: ["run", "walk", "stand"],
  [CharacterState.FightRun]: ["fightRun", "run", "walk", "stand"],
  [CharacterState.Jump]: ["jump", "run", "walk", "stand"],
  [CharacterState.FightJump]: ["fightJump", "jump", "fightRun", "run", "stand"],
  [CharacterState.Attack]: ["attack", "stand"],
  [CharacterState.Attack1]: ["attack1", "attack", "stand"],
  [CharacterState.Attack2]: ["attack2", "attack", "stand"],
  [CharacterState.Magic]: ["magic", "attack", "stand"],
  [CharacterState.Hurt]: ["hurt", "stand"],
  [CharacterState.Death]: ["death", "hurt", "stand"],
  [CharacterState.Sit]: ["sit", "stand1", "stand"],
  [CharacterState.Special]: ["special", "stand"],
};

/** CharacterState 到 SpriteSet key 的映射 */
const STATE_TO_SPRITEKEY: Record<CharacterState, keyof SpriteSet> = {
  [CharacterState.Stand]: "stand",
  [CharacterState.Stand1]: "stand1",
  [CharacterState.Walk]: "walk",
  [CharacterState.Run]: "run",
  [CharacterState.Jump]: "jump",
  [CharacterState.Attack]: "attack",
  [CharacterState.Attack1]: "attack1",
  [CharacterState.Attack2]: "attack2",
  [CharacterState.Magic]: "magic",
  [CharacterState.Hurt]: "hurt",
  [CharacterState.Death]: "death",
  [CharacterState.Sit]: "sit",
  [CharacterState.Special]: "special",
  [CharacterState.FightStand]: "fightStand",
  [CharacterState.FightWalk]: "fightWalk",
  [CharacterState.FightRun]: "fightRun",
  [CharacterState.FightJump]: "fightJump",
};

/** 获取状态对应的 SpriteSet key（无 fallback） */
export function stateToSpriteSetKey(state: CharacterState): keyof SpriteSet {
  return STATE_TO_SPRITEKEY[state] || "stand";
}

/** 获取状态对应的 ASF 动画（带 fallback） */
export function getAsfForState(spriteSet: SpriteSet, state: CharacterState): AsfData | null {
  const fallbacks = STATE_ASF_FALLBACKS[state] || ["stand"];
  for (const key of fallbacks) {
    if (spriteSet[key]) return spriteSet[key];
  }
  return null;
}

/** Sprite 类 - 所有可视对象的基类 */
export class Sprite extends EngineAccess {
  protected _positionInWorld: Vector2 = { x: 0, y: 0 };
  protected _mapX: number = 0;
  protected _mapY: number = 0;
  velocity: number = 0;
  protected _currentDirection: number = 0;
  protected _texture: AsfData | null = null;
  protected _currentFrameIndex: number = 0;
  protected _frameBegin: number = 0;
  protected _frameEnd: number = 0;
  protected _isPlayReverse: boolean = false;
  protected _leftFrameToPlay: number = 0;
  movedDistance: number = 0;
  frameAdvanceCount: number = 0;
  isShow: boolean = true;
  protected _elapsedMilliSecond: number = 0;

  protected _basePath: string = "";
  protected _baseFileName: string = "";
  protected _spriteSet: SpriteSet = createEmptySpriteSet();


  // ============= 位置属性 =============

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

  get tilePosition(): Vector2 {
    return { x: this._mapX, y: this._mapY };
  }

  set tilePosition(value: Vector2) {
    this._mapX = value.x;
    this._mapY = value.y;
    this._updatePositionFromTile();
  }

  protected _updatePositionFromTile(): void {
    this._positionInWorld = tileToPixel(this._mapX, this._mapY);
  }

  // ============= 方向 =============

  get currentDirection(): number {
    return this._currentDirection;
  }

  /** 设置方向，自动处理环绕并更新帧范围 */
  set currentDirection(value: number) {
    const last = this._currentDirection;
    const directionCount = this._texture?.directions || 1;
    this._currentDirection = value % directionCount;
    if (this._currentDirection < 0) {
      this._currentDirection = (this._currentDirection + directionCount) % directionCount;
    }
    const framesPerDir = this._texture?.framesPerDirection || 1;
    this._frameBegin = this._currentDirection * framesPerDir;
    this._frameEnd = this._frameBegin + framesPerDir - 1;
    if (last !== this._currentDirection) {
      this._currentFrameIndex = this._frameBegin;
    }
  }

  // ============= Texture/Animation =============

  // ============= 纹理/动画 =============

  get texture(): AsfData | null {
    return this._texture;
  }

  /** 设置纹理，重置动画状态 */
  set texture(value: AsfData | null) {
    this._texture = value;
    this._elapsedMilliSecond = 0;
    this.currentDirection = this._currentDirection;
    this._currentFrameIndex = this._frameBegin;
  }

  get currentFrameIndex(): number {
    return this._currentFrameIndex;
  }

  /** 设置帧索引，自动环绕 */
  set currentFrameIndex(value: number) {
    this._currentFrameIndex = value;
    if (this._currentFrameIndex > this._frameEnd) {
      this._currentFrameIndex = this._frameBegin;
    } else if (this._currentFrameIndex < this._frameBegin) {
      this._currentFrameIndex = this._frameEnd;
    }
  }

  get isInPlaying(): boolean {
    return this._leftFrameToPlay > 0;
  }

  get frameBegin(): number {
    return this._frameBegin;
  }

  get frameEnd(): number {
    return this._frameEnd;
  }

  get interval(): number {
    return this._texture?.interval || 0;
  }

  get frameCountsPerDirection(): number {
    return this._texture?.framesPerDirection || 1;
  }

  get width(): number {
    return this._texture?.width || 0;
  }

  get height(): number {
    return this._texture?.height || 0;
  }

  get size(): Vector2 {
    return { x: this.width, y: this.height };
  }

  get regionInWorld(): { x: number; y: number; width: number; height: number } {
    const beginPos = this.regionInWorldBeginPosition;
    return { x: beginPos.x, y: beginPos.y, width: this.width, height: this.height };
  }

  get regionInWorldBeginPosition(): Vector2 {
    return {
      x: Math.floor(this._positionInWorld.x) - (this._texture?.left || 0),
      y: Math.floor(this._positionInWorld.y) - (this._texture?.bottom || 0),
    };
  }

  // ============= 精灵集 =============

  get spriteSet(): SpriteSet {
    return this._spriteSet;
  }

  get basePath(): string {
    return this._basePath;
  }

  get baseFileName(): string {
    return this._baseFileName;
  }

  // ============= 方法 =============

  /** 设置位置、速度、纹理和方向 */
  set(position: Vector2, velocity: number, texture: AsfData | null, direction: number = 0): void {
    this.positionInWorld = position;
    this.velocity = velocity;
    this.texture = texture;
    this.currentDirection = direction;
  }

  setTilePosition(tileX: number, tileY: number): void {
    this._mapX = tileX;
    this._mapY = tileY;
    this._updatePositionFromTile();
  }

  /** 播放指定帧数后停止 */
  playFrames(count: number, reverse: boolean = false): void {
    this._leftFrameToPlay = count;
    this._isPlayReverse = reverse;
  }

  /** 播放当前方向动画一次 */
  playCurrentDirOnce(): void {
    if (this.isInPlaying) return;
    this.playFrames(this._frameEnd - this._currentFrameIndex + 1);
  }

  /** 反向播放当前方向动画一次 */
  playCurrentDirOnceReverse(): void {
    if (this.isInPlaying) return;
    this.playFrames(this._currentFrameIndex - this._frameBegin + 1, true);
  }

  endPlayCurrentDirOnce(): void {
    this._leftFrameToPlay = 0;
  }

  isPlayCurrentDirOnceEnd(): boolean {
    return !this.isInPlaying;
  }

  isFrameAtBegin(): boolean {
    return this._currentFrameIndex === this._frameBegin;
  }

  isFrameAtEnd(): boolean {
    return this._currentFrameIndex === this._frameEnd;
  }

  /** 设置方向值，超出范围时仅存储不触发重算 */
  setDirectionValue(direction: number): void {
    const directionCount = this._texture?.directions || 1;
    if (directionCount > direction) {
      this.setDirection(direction);
    } else {
      this._currentDirection = direction;
    }
  }

  /** 带移动的更新 */
  updateWithMovement(deltaTime: number, direction: Vector2, speedFold: number = 1): void {
    const elapsedSeconds = deltaTime * speedFold;
    this.moveTo(direction, elapsedSeconds);
    this.update(deltaTime, speedFold);
  }

  /** 更新动画帧 */
  update(deltaTime: number, speedFold: number = 1): void {
    if (!this._texture) return;

    const deltaMs = deltaTime * 1000 * speedFold;
    this._elapsedMilliSecond += deltaMs;
    this.frameAdvanceCount = 0;

    const interval = this._texture.interval || 100;
    if (this._elapsedMilliSecond > interval) {
      this._elapsedMilliSecond -= interval;
      if (this.isInPlaying && this._isPlayReverse) {
        this.currentFrameIndex--;
      } else {
        this.currentFrameIndex++;
      }
      this.frameAdvanceCount = 1;
      if (this._leftFrameToPlay > 0) {
        this._leftFrameToPlay--;
      }
    }
  }

  /** 向指定方向移动（自动归一化） */
  moveTo(direction: Vector2, elapsedSeconds: number, speedRatio: number = 1.0): void {
    if (direction.x !== 0 || direction.y !== 0) {
      const length = Math.sqrt(direction.x * direction.x + direction.y * direction.y);
      const normalized = { x: direction.x / length, y: direction.y / length };
      this.moveToNoNormalizeDirection(normalized, elapsedSeconds, speedRatio);
    }
  }

  /** 向指定方向移动（不归一化） */
  moveToNoNormalizeDirection(
    direction: Vector2,
    elapsedSeconds: number,
    speedRatio: number = 1.0
  ): void {
    this.setDirection(direction);
    const moveX = direction.x * this.velocity * elapsedSeconds * speedRatio;
    const moveY = direction.y * this.velocity * elapsedSeconds * speedRatio;
    this.positionInWorld = {
      x: this._positionInWorld.x + moveX,
      y: this._positionInWorld.y + moveY,
    };
    this.movedDistance += Math.sqrt(moveX * moveX + moveY * moveY);
  }

  /** 设置方向（支持向量或整数） */
  setDirection(direction: Vector2 | number): void {
    if (typeof direction === "number") {
      this.currentDirection = direction;
    } else if ((direction.x !== 0 || direction.y !== 0) && this._texture?.directions) {
      this.currentDirection = getDirectionIndex(direction, this._texture.directions);
    }
  }

  /** 获取当前帧的 canvas */
  getCurrentTexture(): HTMLCanvasElement | OffscreenCanvas | null {
    if (!this._texture) return null;
    const dir = Math.min(this._currentDirection, this._texture.directions - 1);
    const frameIdx = getFrameIndex(this._texture, dir, this._currentFrameIndex);
    if (frameIdx >= 0 && frameIdx < this._texture.frames.length) {
      return getFrameCanvas(this._texture.frames[frameIdx]);
    }
    return null;
  }

  /** 获取当前帧数据（用于像素碰撞检测） */
  getCurrentFrame(): AsfFrame | null {
    if (!this._texture) return null;
    const dir = Math.min(this._currentDirection, this._texture.directions - 1);
    const frameIdx = getFrameIndex(this._texture, dir, this._currentFrameIndex);
    if (frameIdx >= 0 && frameIdx < this._texture.frames.length) {
      return this._texture.frames[frameIdx];
    }
    return null;
  }

  /** 绘制精灵 */
  draw(
    renderer: IRenderer,
    cameraX: number,
    cameraY: number,
    offX: number = 0,
    offY: number = 0
  ): void {
    this.drawWithColor(renderer, cameraX, cameraY, getSpriteDrawColor(), offX, offY);
  }

  /** 带颜色效果绘制（"black"灰度/"frozen"冰冻/"poison"中毒） */
  drawWithColor(
    renderer: IRenderer,
    cameraX: number,
    cameraY: number,
    color: string = "white",
    offX: number = 0,
    offY: number = 0
  ): void {
    if (!this.isShow || !this._texture) return;

    const screenX = this._positionInWorld.x - cameraX;
    const screenY = this._positionInWorld.y - cameraY;

    const dir = Math.min(this._currentDirection, this._texture.directions - 1);
    const frameIdx = getFrameIndex(this._texture, dir, this._currentFrameIndex);

    if (frameIdx >= 0 && frameIdx < this._texture.frames.length) {
      const drawX = screenX - this._texture.left + offX;
      const drawY = screenY - this._texture.bottom + offY;

      // 使用 atlas 绘制（同一 ASF 的所有帧共享一张纹理，减少纹理切换）
      const { canvas, srcX, srcY, srcWidth, srcHeight } = getFrameAtlasInfo(this._texture, frameIdx);
      const filter = COLOR_FILTER_MAP[color];
      renderer.drawSourceEx(canvas, drawX, drawY, {
        srcX,
        srcY,
        srcWidth,
        srcHeight,
        filter,
      });
    }
  }

  /** 绘制高亮边缘 */
  drawHighlight(
    renderer: IRenderer,
    cameraX: number,
    cameraY: number,
    highlightColor: string = "rgba(255, 255, 0, 0.6)"
  ): void {
    if (!this.isShow || !this._texture) return;

    const screenX = this._positionInWorld.x - cameraX;
    const screenY = this._positionInWorld.y - cameraY;
    const dir = Math.min(this._currentDirection, this._texture.directions - 1);
    const frameIdx = getFrameIndex(this._texture, dir, this._currentFrameIndex);

    if (frameIdx >= 0 && frameIdx < this._texture.frames.length) {
      const frame = this._texture.frames[frameIdx];
      const canvas = getFrameCanvas(frame);
      const drawX = screenX - this._texture.left;
      const drawY = screenY - this._texture.bottom;
      // 高亮边缘仍用 per-frame canvas（需要像素操作）
      renderer.drawSource(getOuterEdge(canvas, highlightColor), drawX, drawY);
    }
  }

  // ============= 自定义动作文件 =============

  /** 加载自定义 ASF 文件 */
  async loadCustomAsf(asfFileName: string): Promise<AsfData | null> {
    const paths = [ResourcePath.asfCharacter(asfFileName), ResourcePath.asfInterlude(asfFileName)];
    for (const path of paths) {
      const asf = await loadAsf(path);
      if (asf) {
        logger.debug(`[Sprite] Loaded custom ASF: ${path}`);
        return asf;
      }
    }
    logger.warn(`[Sprite] Failed to load custom ASF: ${asfFileName}`);
    return null;
  }

  static clearCache(): void {
    spriteCache.clear();
  }
}
