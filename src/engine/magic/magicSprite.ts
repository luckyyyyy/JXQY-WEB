/**
 * MagicSprite - 武功精灵类
 * 对应 C# Engine/MagicSprite.cs
 * 继承自 Sprite，用于表示游戏中的武功特效
 *
 * C# 架构：
 * - MagicSprite : Sprite - 继承 Sprite
 * - MagicManager 使用 new MagicSprite(...) 创建精灵
 * - MagicManager 中的 Add*MagicSprite 方法处理不同 MoveKind 的创建逻辑
 *
 * 帧动画系统：复用父类 Sprite 的
 * - _currentFrameIndex: 当前帧
 * - _animationTime: 帧计时
 * - playFrames(): 播放指定帧数
 * - update(): 更新动画
 * - isInPlaying: 判断是否正在播放
 */

import { Sprite } from "../sprite/sprite";
import type { Vector2 } from "../core/types";
import type { MagicData } from "./types";
import { MagicMoveKind } from "./types";
import { normalizeVector, getDirectionIndex, MAGIC_BASE_SPEED } from "./magicUtils";

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
 * 继承自 Sprite，添加武功特有的属性和行为
 */
export class MagicSprite extends Sprite {
  // ============= 唯一ID =============
  private _id: number;

  // ============= C# Fields =============

  // C#: _belongCharacter (使用ID引用)
  private _belongCharacterId: string = "";
  // C#: _belongMagic
  private _magic: MagicData;
  // C#: _moveDirection (normalized or zero)
  private _moveDirection: Vector2 = { x: 0, y: 0 };
  // C#: _destnationPixelPosition
  private _destination: Vector2 = { x: 0, y: 0 };
  // C#: _paths
  private _paths: Vector2[] = [];
  // C#: _isDestroyed
  private _isDestroyed: boolean = false;
  // C#: _isInDestroy
  private _isInDestroy: boolean = false;
  // C#: _destroyOnEnd
  private _destroyOnEnd: boolean = false;

  // C#: _waitMilliSeconds
  private _waitMilliseconds: number = 0;
  // C#: _roundMoveInfo
  private _roundMoveInfo: RoundMoveInfo | null = null;

  // C#: _currentEffect, _currentEffect2, _currentEffect3, _currentEffectMana
  private _currentEffect: number = 0;
  private _currentEffect2: number = 0;
  private _currentEffect3: number = 0;
  private _currentEffectMana: number = 0;

  // C#: _circleMoveDir
  private _circleMoveDir: Vector2 = { x: 0, y: 0 };

  // C#: _index
  private _index: number = 0;

  // C#: _elaspedMillisecond
  private _elapsedMilliseconds: number = 0;

  // 已穿透的目标
  private _passThroughedTargets: string[] = [];

  // 消失动画帧数（飞行动画使用父类的 texture.framesPerDirection）
  private _vanishFramesPerDirection: number = 4;

  // 移动相关（父类也有 MovedDistance，这里单独跟踪武功移动距离）
  private _movedDistanceLocal: number = 0;

  // 累计播放帧数（用于判断动画是否结束）
  private _playedFrames: number = 0;

  // 总帧数（生命周期）
  private _totalFrames: number = 999999;

  // ASF 路径
  private _flyingAsfPath: string | undefined;
  private _vanishAsfPath: string | undefined;

  // 调试标记
  public _debugRendered: boolean = false;

  // ============= Constants =============
  static readonly MinimalDamage = 5;

  // ============= Constructor =============

  /**
   * C# Reference: MagicSprite constructor
   * new MagicSprite(magic, user, position, velocity, direction, destroyOnEnd)
   */
  constructor(magic: MagicData) {
    super();
    this._id = globalSpriteIdCounter++;
    this._magic = magic;
    this._flyingAsfPath = magic.flyingImage;
    this._vanishAsfPath = magic.vanishImage;
    this._currentEffect = magic.effect;
    this._currentEffect2 = magic.effect2;
    this._currentEffect3 = magic.effect3;
    this._currentEffectMana = magic.effectMana;
    this._waitMilliseconds = magic.waitFrame * 16;

    // 初始化 totalFrames
    // C# Reference: MagicSprite.ResetPlay() 中的逻辑
    if (
      magic.moveKind === MagicMoveKind.FollowCharacter ||
      magic.moveKind === MagicMoveKind.TimeStop
    ) {
      // 跟随类武功使用时间计算
      const interval = 1000 / 60; // 默认 60fps
      this._totalFrames =
        magic.lifeFrame > 0
          ? Math.floor((magic.lifeFrame * 10) / interval)
          : 999999;
    } else if (magic.lifeFrame > 0) {
      this._totalFrames = magic.lifeFrame;
    } else {
      // lifeFrame == 0 表示播放一轮动画，由渲染器设置实际帧数
      this._totalFrames = 999999;
    }
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
    sprite._belongCharacterId = userId;
    sprite._velocity = MAGIC_BASE_SPEED * magic.speed * speedRatio;
    sprite.setMoveDirection({
      x: destination.x - origin.x,
      y: destination.y - origin.y,
    });
    sprite._destroyOnEnd = destroyOnEnd;
    sprite._destination = { ...destination };
    sprite._begin(origin);

    console.log(`[MagicSprite] Created moving sprite: velocity=${sprite._velocity}, direction=(${sprite._moveDirection.x.toFixed(2)}, ${sprite._moveDirection.y.toFixed(2)}), speed=${magic.speed}, speedRatio=${speedRatio}`);

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
    sprite._belongCharacterId = userId;
    sprite._velocity = MAGIC_BASE_SPEED * magic.speed * speedRatio;
    sprite.setMoveDirection(direction);
    sprite._destroyOnEnd = destroyOnEnd;
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
    sprite._belongCharacterId = userId;
    sprite._velocity = 0;
    sprite._destroyOnEnd = destroyOnEnd;
    sprite._destination = { ...position };
    sprite.positionInWorld = { ...position };
    return sprite;
  }

  /**
   * 创建特效精灵（用于命中特效、消失特效等）
   */
  createEffectSprite(position?: Vector2): MagicSprite {
    const effectSprite = new MagicSprite(this._magic);
    effectSprite._belongCharacterId = this._belongCharacterId;
    effectSprite._moveDirection = { ...this._moveDirection };
    effectSprite._currentDirection = this._currentDirection;

    if (position) {
      effectSprite.positionInWorld = { ...position };
    } else {
      effectSprite.positionInWorld = { ...this._positionInWorld };
    }

    effectSprite._velocity = 0;
    effectSprite._isInDestroy = true;
    effectSprite._isDestroyed = false;
    effectSprite._flyingAsfPath = this._magic.vanishImage;
    // 帧动画由渲染器根据 ASF 设置

    return effectSprite;
  }

  // ============= Private Methods =============

  /**
   * C# Reference: MagicSprite.Begin()
   */
  private _begin(origin: Vector2): void {
    // C#: if (Velocity > 0 && MoveDirection != Vector2.Zero) { Move 30 pixels forward }
    let startPos = { ...origin };
    if (
      this._velocity > 0 &&
      (this._moveDirection.x !== 0 || this._moveDirection.y !== 0)
    ) {
      const initialOffset = 50; // C# uses 30, we use 50 for visual clarity
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

  /** Index for multiple sprites in same magic */
  get index(): number {
    return this._index;
  }
  set index(value: number) {
    this._index = value;
  }

  /** 武功数据 */
  get magic(): MagicData {
    return this._magic;
  }

  /** 所属角色ID */
  get belongCharacterId(): string {
    return this._belongCharacterId;
  }
  set belongCharacterId(value: string) {
    this._belongCharacterId = value;
  }

  /** 当前位置 (兼容旧接口) */
  get position(): Vector2 {
    return this._positionInWorld;
  }
  set position(value: Vector2) {
    this.positionInWorld = value;
  }

  /** 移动方向 (normalized or zero) */
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

  /** 目标位置 */
  get destination(): Vector2 {
    return this._destination;
  }
  set destination(value: Vector2) {
    this._destination = { ...value };
  }

  /** 是否已销毁 */
  get isDestroyed(): boolean {
    return this._isDestroyed;
  }
  set isDestroyed(value: boolean) {
    this._isDestroyed = value;
  }

  /** 是否正在播放消失动画 */
  get isInDestroy(): boolean {
    return this._isInDestroy;
  }
  set isInDestroy(value: boolean) {
    this._isInDestroy = value;
  }

  /** 结束时是否播放消失动画 */
  get destroyOnEnd(): boolean {
    return this._destroyOnEnd;
  }
  set destroyOnEnd(value: boolean) {
    this._destroyOnEnd = value;
  }

  /** 等待时间 */
  get waitMilliseconds(): number {
    return this._waitMilliseconds;
  }
  set waitMilliseconds(value: number) {
    this._waitMilliseconds = value;
  }

  /** 当前帧 - 使用父类的 _currentFrameIndex */
  get currentFrame(): number {
    return this._currentFrameIndex;
  }
  set currentFrame(value: number) {
    this._currentFrameIndex = value;
  }

  /** 消失动画每方向帧数 */
  get vanishFramesPerDirection(): number {
    return this._vanishFramesPerDirection;
  }
  set vanishFramesPerDirection(value: number) {
    this._vanishFramesPerDirection = value;
  }

  // 飞行动画帧数（当没有 texture 时的备用值）
  private _flyingFramesPerDirection: number = 4;

  /** 每方向帧数 - 优先从纹理获取 */
  get framesPerDirection(): number {
    return this._texture?.framesPerDirection || this._flyingFramesPerDirection;
  }
  set framesPerDirection(value: number) {
    this._flyingFramesPerDirection = value;
  }

  // 帧间隔备用值
  private _frameIntervalOverride: number = 50;

  /** 帧间隔 - 优先从纹理获取 */
  get frameInterval(): number {
    return this._texture?.interval || this._frameIntervalOverride;
  }
  set frameInterval(value: number) {
    this._frameIntervalOverride = value;
  }

  /** 已播放帧数 - 累计计数器 */
  get playedFrames(): number {
    return this._playedFrames;
  }
  set playedFrames(value: number) {
    this._playedFrames = value;
  }

  /** 总帧数 - 生命周期 */
  get totalFrames(): number {
    return this._totalFrames;
  }
  set totalFrames(value: number) {
    this._totalFrames = value;
  }

  /** 帧计时器 - 使用父类的 _animationTime */
  get frameElapsed(): number {
    return this._animationTime;
  }
  set frameElapsed(value: number) {
    this._animationTime = value;
  }

  /** 已过时间 */
  get elapsedMilliseconds(): number {
    return this._elapsedMilliseconds;
  }
  set elapsedMilliseconds(value: number) {
    this._elapsedMilliseconds = value;
  }

  /** 效果值 */
  get currentEffect(): number {
    return this._currentEffect;
  }
  set currentEffect(value: number) {
    this._currentEffect = value;
  }
  get currentEffect2(): number {
    return this._currentEffect2;
  }
  set currentEffect2(value: number) {
    this._currentEffect2 = value;
  }
  get currentEffect3(): number {
    return this._currentEffect3;
  }
  set currentEffect3(value: number) {
    this._currentEffect3 = value;
  }
  get currentEffectMana(): number {
    return this._currentEffectMana;
  }
  set currentEffectMana(value: number) {
    this._currentEffectMana = value;
  }

  /** 已移动距离 */
  get movedDistance(): number {
    return this._movedDistanceLocal;
  }
  set movedDistance(value: number) {
    this._movedDistanceLocal = value;
  }

  /** 穿透目标列表 */
  get passThroughedTargets(): string[] {
    return this._passThroughedTargets;
  }

  /** 方向索引 (8方向) */
  get directionIndex(): number {
    return getDirectionIndex(this._moveDirection, 8);
  }

  /** ASF 路径 */
  get flyingAsfPath(): string | undefined {
    return this._flyingAsfPath;
  }
  set flyingAsfPath(value: string | undefined) {
    this._flyingAsfPath = value;
  }

  get vanishAsfPath(): string | undefined {
    return this._vanishAsfPath;
  }

  /** 是否存活 */
  get isLive(): boolean {
    return !this._isDestroyed && !this._isInDestroy;
  }

  /** 是否为超级模式 */
  get isSuperMode(): boolean {
    return this._magic.moveKind === MagicMoveKind.SuperMode;
  }

  // tilePosition 使用父类 Sprite 的实现

  // ============= Methods =============

  /**
   * 设置起始位置（包含初始偏移）
   */
  setStartPosition(origin: Vector2): void {
    this._begin(origin);
  }

  /**
   * 设置方向（从向量）
   */
  setDirectionFromVector(direction: Vector2): void {
    if (direction.x !== 0 || direction.y !== 0) {
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
    this._velocity = 0;
    // 重置帧到开始，准备播放消失动画
    this._currentFrameIndex = 0;
    this._animationTime = 0;
    this._playedFrames = 0;
  }

  /**
   * 重置播放
   * C# Reference: MagicSprite.ResetPlay()
   * 根据 MoveKind 和 LifeFrame 设置播放帧数
   */
  resetPlay(): void {
    let framesToPlay = this._magic.lifeFrame;
    if (
      this._magic.lifeFrame === 0 ||
      this._magic.moveKind === MagicMoveKind.SuperMode
    ) {
      framesToPlay = this.framesPerDirection;
    } else if (this._magic.moveKind === MagicMoveKind.FollowCharacter) {
      const interval = this.frameInterval === 0 ? 1000 / 60 : this.frameInterval;
      framesToPlay = Math.floor((this._magic.lifeFrame * 10) / interval);
    }

    // 使用父类的 playFrames 方法
    this.playFrames(0, Math.max(0, framesToPlay - 1));
  }

  /**
   * 标记为完全销毁
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
