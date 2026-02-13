/**
 * MagicSprite - 武功精灵类
 *
 * 继承自 Sprite，用于表示游戏中的武功特效
 *
 * 架构：
 * - MagicSprite : Sprite - 继承 Sprite
 * - 复用父类的动画系统：_currentFrameIndex, _leftFrameToPlay, isInPlaying, playFrames(), update()
 * - 复用父类的移动系统：_velocity, _positionInWorld, _movedDistance
 * - MagicSprite 特有字段：_belongCharacter, _belongMagic, _moveDirection, _isDestroyed, _isInDestroy 等
 */

import type { Vector2 } from "../core/types";
import { Sprite } from "../sprite/sprite";
import { getDirectionIndex } from "../utils/direction";
import { normalizeVector } from "../utils/math";
import { MAGIC_BASE_SPEED, type MagicData, MagicMoveKind } from "./types";

/** 最低伤害值 */
export const MINIMAL_DAMAGE = 5;

// 全局精灵ID计数器
let globalSpriteIdCounter = 0;

/**
 * 重置全局精灵ID计数器
 */
export function resetMagicSpriteIdCounter(): void {
  globalSpriteIdCounter = 0;
}

/**
 * 圆形移动信息
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
 * Reference: Engine/MagicSprite.cs
 *
 * 继承自 Sprite，复用父类的动画和移动系统，只添加武功特有的属性和行为
 */
export class MagicSprite extends Sprite {
  // ============= 唯一ID =============
  private _id: number;

  // ============= MagicSprite 特有字段 =============

  /** 使用ID引用 */
  belongCharacterId: string = "";

  private _magic: MagicData;
  /** normalized or zero */
  private _moveDirection: Vector2 = { x: 0, y: 0 };

  private _destination: Vector2 = { x: 0, y: 0 };

  private _isDestroyed: boolean = false;

  private _isInDestroy: boolean = false;

  destroyOnEnd: boolean = false;

  private _waitMilliseconds: number = 0;

  /** _currentEffect, _currentEffect2, _currentEffect3, _currentEffectMana */
  currentEffect: number = 0;
  currentEffect2: number = 0;
  currentEffect3: number = 0;
  currentEffectMana: number = 0;

  /** Index for multiple sprites in same magic */
  index: number = 0;

  /** 武功已存在时间 */
  elapsedMilliseconds: number = 0;

  /** 已穿透的目标 */
  private _passThroughedTargets: string[] = [];

  /** 粘附的角色（Sticky > 0 时使用） */
  private _stickedCharacterId: string | null = null;

  /** 寄生的角色（Parasitic > 0 时使用） */
  private _parasitiferCharacterId: string | null = null;
  /** 寄生伤害计时器 */
  private _parasiticTime: number = 0;
  /** 寄生累计伤害 */
  private _totalParasiticEffect: number = 0;

  /** 是否在回拉状态（Sticky + MoveBack） */
  private _isInMoveBack: boolean = false;

  /** SuperMode 特效精灵列表 */
  superModeDestroySprites: MagicSprite[] = [];

  // ============= Leap (跳跃传递) 相关属性 =============
  /** 剩余跳跃次数 */
  private _leftLeapTimes: number = 0;
  /** 是否能跳跃 */
  private _canLeap: boolean = false;
  /** 已跳跃命中的角色ID列表 */
  private _leapedCharacterIds: string[] = [];

  // ============= RangeEffect (周期触发) 相关属性 =============
  /** 范围效果计时器 */
  rangeElapsedMilliseconds: number = 0;

  /** ASF 路径 */
  flyingAsfPath: string | undefined;
  vanishAsfPath: string | undefined;

  /** 调试标记 */
  _debugRendered: boolean = false;

  // ============= Constructor =============

  /**
   * constructor
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
   * 中使用 GetEffectAmount 计算
   * 由 MagicManager 在添加 sprite 时调用
   */
  initializeEffects(effect: number, effect2: number, effect3: number): void {
    this.currentEffect = effect;
    this.currentEffect2 = effect2;
    this.currentEffect3 = effect3;
  }

  // ============= Static Factory Methods =============
  // MagicManager.GetMoveMagicSprite, GetFixedPositionMagicSprite

  /**
   * 创建移动武功精灵
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
   * Reference: MagicSprite.Begin()
   * 初始化位置并向前偏移 30 像素
   */
  private _begin(origin: Vector2): void {
    let startPos = { ...origin };
    if (this.velocity > 0 && (this._moveDirection.x !== 0 || this._moveDirection.y !== 0)) {
      // 使用 30 像素偏移：var second = 30f / Velocity; MoveToNoNormalizeDirection(MoveDirection, second);
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
   * MoveDirection (normalized or zero)
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
   * setter
   */
  setMoveDirection(value: Vector2): void {
    if (value.x !== 0 || value.y !== 0) {
      this._moveDirection = normalizeVector(value);
    } else {
      this._moveDirection = { x: 0, y: 0 };
    }
  }

  get destination(): Vector2 {
    return this._destination;
  }
  set destination(value: Vector2) {
    this._destination = { ...value };
  }

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
    // 模仿 CurrentDirection setter 的行为：设置 _frameEnd
    this._frameEnd = value - 1;
  }

  /** MoveKind == 15 - 是否为超级模式 */
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
   * SetDirection(Vector2)
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
   * Reference: MagicSprite.Destroy()
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
   * Reference: MagicSprite.ResetPlay()
   * 根据 MoveKind 和 LifeFrame 设置播放帧数，使用父类的 playFrames()
   */
  resetPlay(): void {
    // 使用父类 FrameCountsPerDirection
    const framesPerDir = this.frameCountsPerDirection;
    let framesToPlay = this._magic.lifeFrame;

    // 判断是否为飞行类魔法（有速度移动的）
    const isMovingMagic = this.isFlyingMagic();

    // 飞行类魔法且 LifeFrame=0：无限飞行直到碰撞
    if (this._magic.lifeFrame === 0 && isMovingMagic) {
      framesToPlay = 9999;
    } else if (this._magic.moveKind === MagicMoveKind.SuperMode) {
      // SuperMode：播放一轮动画
      framesToPlay = framesPerDir;
    } else if (
      this._magic.moveKind === MagicMoveKind.FollowCharacter ||
      this._magic.moveKind === MagicMoveKind.TimeStop
    ) {
      // 使用 Texture.Interval
      const textureInterval = this.interval || 100;
      framesToPlay = Math.floor((this._magic.lifeFrame * 10) / textureInterval);
      // FollowCharacter/TimeStop 如果 LifeFrame=0，也使用一轮动画
      if (framesToPlay === 0) {
        framesToPlay = framesPerDir;
      }
    } else if (this._magic.lifeFrame === 0) {
      // 其他非飞行类魔法，LifeFrame=0 播放一轮动画
      framesToPlay = framesPerDir;
    }

    // PlayFrames(count) 设置 _leftFrameToPlay = count
    this.playFrames(Math.max(1, framesToPlay));
  }

  /**
   * 判断是否为飞行类魔法（有速度会移动的）
   */
  private isFlyingMagic(): boolean {
    const moveKind = this._magic.moveKind;
    // 非飞行类：固定位置、跟随角色、超级模式、区域、传送、召唤等
    const nonFlyingKinds = [
      MagicMoveKind.NoMove,
      MagicMoveKind.FixedPosition,
      MagicMoveKind.RegionBased,
      MagicMoveKind.FollowCharacter,
      MagicMoveKind.SuperMode,
      MagicMoveKind.Kind19,
      MagicMoveKind.Transport,
      MagicMoveKind.PlayerControl,
      MagicMoveKind.Summon,
      MagicMoveKind.TimeStop,
    ];
    return !nonFlyingKinds.includes(moveKind);
  }

  /**
   * Reference: MagicSprite.SetDestroyed()
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

  // ============= 粘附角色 (Sticky) =============

  get stickedCharacterId(): string | null {
    return this._stickedCharacterId;
  }

  set stickedCharacterId(value: string | null) {
    this._stickedCharacterId = value;
  }

  get isInMoveBack(): boolean {
    return this._isInMoveBack;
  }

  set isInMoveBack(value: boolean) {
    this._isInMoveBack = value;
  }

  /**
   * 清除粘附角色
   * 中清除逻辑
   */
  clearStickedCharacter(): void {
    this._stickedCharacterId = null;
  }

  // ============= 寄生角色 (Parasitic) =============

  get parasitiferCharacterId(): string | null {
    return this._parasitiferCharacterId;
  }

  set parasitiferCharacterId(value: string | null) {
    this._parasitiferCharacterId = value;
  }

  get parasiticTime(): number {
    return this._parasiticTime;
  }

  set parasiticTime(value: number) {
    this._parasiticTime = value;
  }

  get totalParasiticEffect(): number {
    return this._totalParasiticEffect;
  }

  set totalParasiticEffect(value: number) {
    this._totalParasiticEffect = value;
  }

  /**
   * 累加寄生伤害
   */
  addParasiticEffect(damage: number): void {
    this._totalParasiticEffect += damage;
  }

  /**
   * 清除寄生角色
   */
  clearParasitiferCharacter(): void {
    this._parasitiferCharacterId = null;
    this._parasiticTime = 0;
  }

  /**
   * property
   * 检查是否可以丢弃该精灵（没有粘附或寄生目标，且不是特定 MoveKind）
   */
  get canDiscard(): boolean {
    return (
      this._stickedCharacterId === null &&
      this._parasitiferCharacterId === null &&
      this._magic.moveKind !== 13 &&
      this._magic.moveKind !== 15 &&
      this._magic.moveKind !== 21 &&
      this._magic.moveKind !== 23
    );
  }

  // ============= 跳跃传递 (Leap) =============

  /** 是否能跳跃 */
  get canLeap(): boolean {
    return this._canLeap;
  }

  set canLeap(value: boolean) {
    this._canLeap = value;
  }

  /** 剩余跳跃次数 */
  get leftLeapTimes(): number {
    return this._leftLeapTimes;
  }

  set leftLeapTimes(value: number) {
    this._leftLeapTimes = value;
  }

  /**
   * 初始化跳跃参数
   * 中 _canLeap = BelongMagic.LeapTimes > 0
   */
  initializeLeap(): void {
    if (this._magic.leapTimes > 0) {
      this._canLeap = true;
      this._leftLeapTimes = this._magic.leapTimes;
      this._leapedCharacterIds = [];
    }
  }

  /**
   * 检查是否已跳跃命中过该角色
   */
  hasLeapedCharacter(charId: string): boolean {
    return this._leapedCharacterIds.includes(charId);
  }

  /**
   * 添加已跳跃命中的角色
   */
  addLeapedCharacter(charId: string): void {
    if (!this._leapedCharacterIds.includes(charId)) {
      this._leapedCharacterIds.push(charId);
    }
  }

  /**
   * 获取已跳跃命中的角色ID列表（用于寻找下一个目标时排除）
   */
  getLeapedCharacterIds(): string[] {
    return [...this._leapedCharacterIds];
  }

  /**
   * 减少效果值（每次跳跃后）
   * 中的效果递减
   */
  reduceEffectByPercentage(percentage: number): void {
    this.currentEffect -= Math.floor((this.currentEffect * percentage) / 100);
    this.currentEffect2 -= Math.floor((this.currentEffect2 * percentage) / 100);
    this.currentEffect3 -= Math.floor((this.currentEffect3 * percentage) / 100);
    this.currentEffectMana -= Math.floor((this.currentEffectMana * percentage) / 100);
  }

  /**
   * 结束跳跃
   * Reference: EndLeap()
   */
  endLeap(): void {
    this._leftLeapTimes = 0;
    this._isDestroyed = true;
  }
}
