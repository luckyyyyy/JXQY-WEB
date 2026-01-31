/**
 * MagicSprite - 武功精灵类
 * 对应 C# Engine/MagicSprite.cs
 * 继承自 Sprite，用于表示游戏中的武功特效
 *
 * C# 架构：
 * - MagicSprite : Sprite - 继承 Sprite
 * - 复用父类的动画系统：_currentFrameIndex, _leftFrameToPlay, isInPlaying, playFrames(), update()
 * - 复用父类的移动系统：_velocity, _positionInWorld, _movedDistance
 * - MagicSprite 特有字段：_belongCharacter, _belongMagic, _moveDirection, _isDestroyed, _isInDestroy 等
 */

import type { Vector2 } from "../core/types";
import { Sprite } from "../sprite/sprite";
import { getDirectionIndex, MAGIC_BASE_SPEED, normalizeVector } from "./magicUtils";
import type { MagicData } from "./types";
import { MagicMoveKind } from "./types";

// 全局精灵ID计数器
let globalSpriteIdCounter = 0;

/**
 * 重置全局精灵ID计数器
 */
export function resetMagicSpriteIdCounter(): void {
  globalSpriteIdCounter = 0;
}

/**
 * 获取下一个精灵ID
 */
export function nextSpriteId(): number {
  return globalSpriteIdCounter++;
}

/**
 * 圆形移动信息
 * C# Reference: MagicSprite.RoundMoveInfo
 */
interface RoundMoveInfo {
  curDegree: number;
}

/**
 * 工作项 - 延迟添加的武功
 */
export interface WorkItem {
  leftMilliseconds: number;
  sprite: MagicSprite;
  spriteIndex: number;
}

/**
 * MagicSprite - 武功精灵
 * C# Reference: Engine/MagicSprite.cs
 *
 * 继承自 Sprite，复用父类的动画和移动系统，只添加武功特有的属性和行为
 */
export class MagicSprite extends Sprite {
  // ============= 唯一ID =============
  private _id: number;

  // ============= C# MagicSprite 特有字段 =============

  /** C#: _belongCharacter (使用ID引用) */
  belongCharacterId: string = "";
  /** C#: _belongMagic */
  private _magic: MagicData;
  /** C#: _moveDirection (normalized or zero) */
  private _moveDirection: Vector2 = { x: 0, y: 0 };
  /** C#: _destnationPixelPosition */
  private _destination: Vector2 = { x: 0, y: 0 };
  /** C#: _isDestroyed */
  private _isDestroyed: boolean = false;
  /** C#: _isInDestroy */
  private _isInDestroy: boolean = false;
  /** C#: _destroyOnEnd */
  destroyOnEnd: boolean = false;

  /** C#: _waitMilliSeconds */
  private _waitMilliseconds: number = 0;

  /** C#: _currentEffect, _currentEffect2, _currentEffect3, _currentEffectMana */
  currentEffect: number = 0;
  currentEffect2: number = 0;
  currentEffect3: number = 0;
  currentEffectMana: number = 0;

  /** C#: _index - Index for multiple sprites in same magic */
  index: number = 0;

  /** C#: _elaspedMillisecond - 武功已存在时间 */
  elapsedMilliseconds: number = 0;

  /** C#: _passThroughedCharacters - 已穿透的目标 */
  private _passThroughedTargets: string[] = [];

  /** C#: _superModeDestroySprites - SuperMode 特效精灵列表 */
  superModeDestroySprites: MagicSprite[] = [];

  /** ASF 路径 */
  flyingAsfPath: string | undefined;
  vanishAsfPath: string | undefined;

  /** 调试标记 */
  _debugRendered: boolean = false;

  // ============= Constants =============
  static readonly MinimalDamage = 5;

  // ============= Constructor =============

  /**
   * C# Reference: MagicSprite constructor
   */
  constructor(magic: MagicData) {
    super();
    this._id = globalSpriteIdCounter++;
    this._magic = magic;
    this.flyingAsfPath = magic.flyingImage;
    this.vanishAsfPath = magic.vanishImage;
    // 初始值使用 magic 的 effect，后续由 MagicManager.initializeEffects() 使用 getEffectAmount 重新计算
    this.currentEffect = magic.effect;
    this.currentEffect2 = magic.effect2;
    this.currentEffect3 = magic.effect3;
    this.currentEffectMana = magic.effectMana;
    this._waitMilliseconds = magic.waitFrame * 16;
  }

  /**
   * 初始化效果值
   * C# Reference: MagicSprite.Begin() 中使用 GetEffectAmount 计算
   * 由 MagicManager 在添加 sprite 时调用
   */
  initializeEffects(effect: number, effect2: number, effect3: number): void {
    this.currentEffect = effect;
    this.currentEffect2 = effect2;
    this.currentEffect3 = effect3;
  }

  // ============= Static Factory Methods =============
  // C# Reference: MagicManager.GetMoveMagicSprite, GetFixedPositionMagicSprite

  /**
   * 创建移动武功精灵
   * C# Reference: MagicManager.GetMoveMagicSprite
   */
  static createMoving(
    userId: string,
    magic: MagicData,
    origin: Vector2,
    destination: Vector2,
    destroyOnEnd: boolean,
    speedRatio: number = 1
  ): MagicSprite {
    const sprite = new MagicSprite(magic);
    sprite.belongCharacterId = userId;
    sprite.velocity = MAGIC_BASE_SPEED * magic.speed * speedRatio;
    sprite.setMoveDirection({
      x: destination.x - origin.x,
      y: destination.y - origin.y,
    });
    sprite.destroyOnEnd = destroyOnEnd;
    sprite._destination = { ...destination };
    sprite._begin(origin);

    return sprite;
  }

  /**
   * 创建移动武功精灵（指定方向）
   * C# Reference: MagicManager.GetMoveMagicSpriteOnDirection
   */
  static createMovingOnDirection(
    userId: string,
    magic: MagicData,
    origin: Vector2,
    direction: Vector2,
    destroyOnEnd: boolean,
    speedRatio: number = 1
  ): MagicSprite {
    const sprite = new MagicSprite(magic);
    sprite.belongCharacterId = userId;
    sprite.velocity = MAGIC_BASE_SPEED * magic.speed * speedRatio;
    sprite.setMoveDirection(direction);
    sprite.destroyOnEnd = destroyOnEnd;
    sprite._destination = {
      x: origin.x + direction.x * 1000,
      y: origin.y + direction.y * 1000,
    };
    sprite._begin(origin);
    return sprite;
  }

  /**
   * 创建固定位置武功精灵
   * C# Reference: MagicManager.GetFixedPositionMagicSprite
   */
  static createFixed(
    userId: string,
    magic: MagicData,
    position: Vector2,
    destroyOnEnd: boolean
  ): MagicSprite {
    const sprite = new MagicSprite(magic);
    sprite.belongCharacterId = userId;
    sprite.velocity = 0;
    sprite.destroyOnEnd = destroyOnEnd;
    sprite._destination = { ...position };
    sprite.positionInWorld = { ...position };
    return sprite;
  }

  /**
   * 创建特效精灵（用于命中特效、消失特效等）
   */
  createEffectSprite(position?: Vector2): MagicSprite {
    const effectSprite = new MagicSprite(this._magic);
    effectSprite.belongCharacterId = this.belongCharacterId;
    effectSprite._moveDirection = { ...this._moveDirection };
    effectSprite._currentDirection = this._currentDirection;

    if (position) {
      effectSprite.positionInWorld = { ...position };
    } else {
      effectSprite.positionInWorld = { ...this._positionInWorld };
    }

    effectSprite.velocity = 0;
    effectSprite._isInDestroy = true;
    effectSprite._isDestroyed = false;
    effectSprite.vanishAsfPath = this._magic.vanishImage;
    effectSprite.flyingAsfPath = this._magic.vanishImage;

    return effectSprite;
  }

  // ============= Private Methods =============

  /**
   * C# Reference: MagicSprite.Begin()
   * 初始化位置并向前偏移 30 像素（与 C# 保持一致）
   */
  private _begin(origin: Vector2): void {
    let startPos = { ...origin };
    if (this.velocity > 0 && (this._moveDirection.x !== 0 || this._moveDirection.y !== 0)) {
      // C# 使用 30 像素偏移：var second = 30f / Velocity; MoveToNoNormalizeDirection(MoveDirection, second);
      const initialOffset = 30;
      startPos = {
        x: origin.x + this._moveDirection.x * initialOffset,
        y: origin.y + this._moveDirection.y * initialOffset,
      };
    }
    this.positionInWorld = startPos;
  }

  // ============= Properties =============

  /** 唯一ID */
  get id(): number {
    return this._id;
  }

  /** 武功数据 */
  get magic(): MagicData {
    return this._magic;
  }

  /** 当前位置 (兼容旧接口，同父类 positionInWorld) */
  get position(): Vector2 {
    return this._positionInWorld;
  }
  set position(value: Vector2) {
    this.positionInWorld = value;
  }

  /**
   * C#: MoveDirection (normalized or zero)
   * 使用 setMoveDirection() 来设置，会自动归一化
   */
  get direction(): Vector2 {
    return this._moveDirection;
  }
  set direction(value: Vector2) {
    this.setMoveDirection(value);
  }

  /**
   * 设置移动方向（自动归一化）
   * C# Reference: MagicSprite.MoveDirection setter
   */
  setMoveDirection(value: Vector2): void {
    if (value.x !== 0 || value.y !== 0) {
      this._moveDirection = normalizeVector(value);
    } else {
      this._moveDirection = { x: 0, y: 0 };
    }
  }

  /** C#: _destnationPixelPosition */
  get destination(): Vector2 {
    return this._destination;
  }
  set destination(value: Vector2) {
    this._destination = { ...value };
  }

  /** C#: IsDestroyed */
  get isDestroyed(): boolean {
    return this._isDestroyed;
  }
  set isDestroyed(value: boolean) {
    this._isDestroyed = value;
  }

  /** C#: IsInDestroy - 是否正在播放消失动画 */
  get isInDestroy(): boolean {
    return this._isInDestroy;
  }
  set isInDestroy(value: boolean) {
    this._isInDestroy = value;
  }

  /** C#: _waitMilliSeconds */
  get waitMilliseconds(): number {
    return this._waitMilliseconds;
  }
  set waitMilliseconds(value: number) {
    this._waitMilliseconds = value;
  }

  // ============= 动画属性（映射到父类 protected 字段）=============
  // MagicManager 需要直接控制这些属性来管理武功动画

  /** 帧计时器 - 暴露父类的 _elapsedMilliSecond */
  get frameElapsed(): number {
    return this._elapsedMilliSecond;
  }
  set frameElapsed(value: number) {
    this._elapsedMilliSecond = value;
  }

  /** 剩余播放帧数 - 暴露父类的 _leftFrameToPlay */
  get leftFrameToPlay(): number {
    return this._leftFrameToPlay;
  }
  set leftFrameToPlay(value: number) {
    this._leftFrameToPlay = value;
  }

  /** 帧间隔（可覆盖父类的 texture.interval） */
  frameInterval: number = 50;

  /** 消失动画每方向帧数（武功特有） */
  private _vanishFramesPerDirection: number = 4;

  get vanishFramesPerDirection(): number {
    return this._vanishFramesPerDirection;
  }
  set vanishFramesPerDirection(value: number) {
    this._vanishFramesPerDirection = value;
    // 更新 _frameEnd（用于父类的帧循环）
    if (this._isInDestroy) {
      this._frameEnd = value - 1;
    }
  }

  /**
   * 覆盖父类的 frameCountsPerDirection
   * 父类从 texture 获取，但 MagicSprite 不使用 texture
   */
  override get frameCountsPerDirection(): number {
    return this._frameEnd + 1;
  }
  set frameCountsPerDirection(value: number) {
    // 模仿 C# CurrentDirection setter 的行为：设置 _frameEnd
    this._frameEnd = value - 1;
  }

  /** C#: MoveKind == 15 - 是否为超级模式 */
  get isSuperMode(): boolean {
    return this._magic.moveKind === MagicMoveKind.SuperMode;
  }

  // ============= Methods =============

  /**
   * 设置起始位置（包含初始偏移）
   */
  setStartPosition(origin: Vector2): void {
    this._begin(origin);
  }

  /**
   * C#: SetDirection(Vector2)
   * Override: 同时设置 _moveDirection 用于武功移动计算
   */
  override setDirection(direction: Vector2 | number): void {
    if (typeof direction === "number") {
      this._currentDirection = direction;
    } else if (direction.x !== 0 || direction.y !== 0) {
      this._moveDirection = normalizeVector(direction);
      this._currentDirection = getDirectionIndex(this._moveDirection, 8);
    }
  }

  /**
   * 开始消失动画
   * C# Reference: MagicSprite.Destroy()
   */
  destroy(): void {
    if (this._isInDestroy || this._isDestroyed) return;

    this._isInDestroy = true;
    this.velocity = 0;
    // 重置帧到开始，准备播放消失动画
    this._currentFrameIndex = 0;
    this._elapsedMilliSecond = 0;
  }

  /**
   * C# Reference: MagicSprite.ResetPlay()
   * 根据 MoveKind 和 LifeFrame 设置播放帧数，使用父类的 playFrames()
   */
  resetPlay(): void {
    // C#: 使用父类 FrameCountsPerDirection
    const framesPerDir = this.frameCountsPerDirection;
    let framesToPlay = this._magic.lifeFrame;

    if (this._magic.lifeFrame === 0 || this._magic.moveKind === MagicMoveKind.SuperMode) {
      framesToPlay = framesPerDir;
    } else if (
      this._magic.moveKind === MagicMoveKind.FollowCharacter ||
      this._magic.moveKind === MagicMoveKind.TimeStop
    ) {
      // C#: 使用 Texture.Interval
      const textureInterval = this.interval || 100;
      framesToPlay = Math.floor((this._magic.lifeFrame * 10) / textureInterval);
    }

    // C#: PlayFrames(count) 设置 _leftFrameToPlay = count
    this.playFrames(Math.max(1, framesToPlay));
  }

  /**
   * C# Reference: MagicSprite.SetDestroyed()
   */
  markDestroyed(): void {
    this._isDestroyed = true;
  }

  /**
   * 添加穿透目标
   */
  addPassThroughedTarget(targetId: string): void {
    if (!this._passThroughedTargets.includes(targetId)) {
      this._passThroughedTargets.push(targetId);
    }
  }

  /**
   * 检查是否已穿透目标
   */
  hasPassThroughedTarget(targetId: string): boolean {
    return this._passThroughedTargets.includes(targetId);
  }
}
