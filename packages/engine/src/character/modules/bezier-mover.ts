/**
 * BezierMover - 贝塞尔曲线移动控制器
 * 从 Character 类提取的贝塞尔曲线移动逻辑（弧线跳跃）
 *
 * 使用组合模式，确保完整的类型推导支持
 * 中的 BezierMoveTo, UpdateBezierMove
 */

import type { Vector2 } from "../../core/types";
import { bezier2D } from "./bezier";
import { normalizeVector, vectorLength } from "../../utils";

/**
 * 贝塞尔移动数据接口（用于序列化/调试）
 */
export interface BezierMoveData {
  inBezierMove: boolean;
  inBezierMoveToRealPosition: boolean;
  startWorldPos: Vector2;
  endWorldPos: Vector2;
  speed: number;
  totalLength: number;
  movedLength: number;
}

/**
 * 贝塞尔移动更新结果
 */
export interface BezierMoveUpdateResult {
  /** 是否仍在移动中 */
  isMoving: boolean;
  /** 当前世界坐标位置 */
  position: Vector2;
  /** 移动方向（归一化） */
  direction: Vector2;
  /** 是否被阻挡需要返回 */
  isBlocked: boolean;
  /** 移动是否完成 */
  isFinished: boolean;
}

/**
 * 检查跳跃障碍的回调函数类型
 */
export type JumpObstacleChecker = (tileX: number, tileY: number) => boolean;

/**
 * 移动完成回调函数类型
 */
export type BezierMoveEndCallback<T> = (character: T) => void;

/**
 * 贝塞尔曲线移动控制器
 * 管理角色的弧线跳跃移动
 *
 * @example
 * ```typescript
 * class Character {
 *   private _bezierMover = new BezierMover();
 *
 *   get inBezierMove() { return this._bezierMover.isMoving; }
 *
 *   bezierMoveTo(dest: Vector2, speed: number, onEnd?: () => void) {
 *     this._bezierMover.startMove(this.positionInWorld, dest, speed, onEnd);
 *   }
 *
 *   update(deltaTime: number) {
 *     const result = this._bezierMover.update(deltaTime, this.tileToPixel, this.isObstacleForJump);
 *     if (result.isMoving) {
 *       this.positionInWorld = result.position;
 *     }
 *   }
 * }
 * ```
 *
 * @typeParam T 角色类型，用于回调函数的类型安全
 */
export class BezierMover<T = unknown> {
  // === 状态标志 ===
  private _inBezierMove = false;
  private _inBezierMoveToRealPosition = false;

  // === 位置数据 ===
  private _startWorldPos: Vector2 = { x: 0, y: 0 };
  private _endWorldPos: Vector2 = { x: 0, y: 0 };
  private _lastRealWorldPosition: Vector2 = { x: 0, y: 0 };
  private _currentPosition: Vector2 = { x: 0, y: 0 };

  // === 方向数据 ===
  private _moveLineDir: Vector2 = { x: 0, y: 0 };
  private _totalLineLength = 0;

  // === 曲线数据 ===
  private _bezierPoints: Vector2[] = [];
  private _totalBezierLength = 0;
  private _movedBezierLength = 0;
  private _stepBezierLength = 0;

  // === 速度 ===
  private _moveSpeed = 0;

  // === 回调 ===
  private _onEnd: BezierMoveEndCallback<T> | null = null;
  private _character: T | null = null;

  // ========== Getters ==========

  /** 是否在贝塞尔移动中 */
  get isMoving(): boolean {
    return this._inBezierMove;
  }

  /** 获取当前位置 */
  get currentPosition(): Vector2 {
    return { ...this._currentPosition };
  }

  /** 获取移动方向 */
  get direction(): Vector2 {
    return { ...this._moveLineDir };
  }

  // ========== Public Methods ==========

  /**
   * 开始贝塞尔曲线移动
   *
   * @param currentWorldPos 当前世界坐标
   * @param destinationWorldPos 目标世界坐标
   * @param speed 移动速度（像素/秒）
   * @param character 角色实例（用于回调）
   * @param onEnd 移动完成回调
   * @returns 移动方向（用于设置角色朝向）
   */
  startMove(
    currentWorldPos: Vector2,
    destinationWorldPos: Vector2,
    speed: number,
    character?: T,
    onEnd?: BezierMoveEndCallback<T>
  ): Vector2 {
    // 如果已经在目标位置，直接完成
    if (
      Math.abs(currentWorldPos.x - destinationWorldPos.x) < 1 &&
      Math.abs(currentWorldPos.y - destinationWorldPos.y) < 1
    ) {
      if (character && onEnd) {
        onEnd(character);
      }
      return { x: 0, y: 0 };
    }

    this._inBezierMove = true;
    this._inBezierMoveToRealPosition = false;
    this._startWorldPos = { ...currentWorldPos };
    this._currentPosition = { ...currentWorldPos };
    this._endWorldPos = { ...destinationWorldPos };
    this._lastRealWorldPosition = { ...currentWorldPos };
    this._moveSpeed = speed;
    this._movedBezierLength = 0;
    this._stepBezierLength = 0;
    this._totalBezierLength = 0;
    this._character = character ?? null;
    this._onEnd = onEnd ?? null;

    // 计算方向向量
    const dir = {
      x: this._endWorldPos.x - this._startWorldPos.x,
      y: this._endWorldPos.y - this._startWorldPos.y,
    };
    this._totalLineLength = vectorLength(dir);
    this._moveLineDir = normalizeVector(dir);

    // 计算垂直方向（用于抛物线的中点偏移）
    // var perpendicular = dir.X < 0 ? new Vector2(-dir.Y, dir.X) : new Vector2(dir.Y, -dir.X);
    let perpendicular: Vector2;
    if (dir.x < 0) {
      perpendicular = { x: -dir.y, y: dir.x };
    } else {
      perpendicular = { x: dir.y, y: -dir.x };
    }
    perpendicular = normalizeVector(perpendicular);

    // 计算曲线中点偏移量
    // var halfPoint = (_bezierStartWorldPos + dir / 2) + perpendicular * Math.Max((Math.Abs(perpendicular.Y) * 100), 20);
    const halfPoint = {
      x:
        this._startWorldPos.x +
        dir.x / 2 +
        perpendicular.x * Math.max(Math.abs(perpendicular.y) * 100, 20),
      y:
        this._startWorldPos.y +
        dir.y / 2 +
        perpendicular.y * Math.max(Math.abs(perpendicular.y) * 100, 20),
    };

    // 生成贝塞尔曲线点
    // Math.Max((int)dir.Length() / 10, 5)
    const pointCount = Math.max(Math.floor(vectorLength(dir) / 10), 5);
    this._bezierPoints = bezier2D([this._startWorldPos, halfPoint, this._endWorldPos], pointCount);

    // 计算曲线总长度
    for (let i = 1; i < this._bezierPoints.length; i++) {
      const segmentLength = vectorLength({
        x: this._bezierPoints[i].x - this._bezierPoints[i - 1].x,
        y: this._bezierPoints[i].y - this._bezierPoints[i - 1].y,
      });
      this._totalBezierLength += segmentLength;
    }

    return dir;
  }

  /**
   * 更新贝塞尔曲线移动
   *
   * @param deltaTime 时间差（秒）
   * @param pixelToTile 像素坐标转瓦片坐标的函数
   * @param isObstacleForJump 检查跳跃障碍的函数
   * @returns 更新结果
   */
  update(
    deltaTime: number,
    pixelToTile: (x: number, y: number) => Vector2,
    isObstacleForJump?: JumpObstacleChecker
  ): BezierMoveUpdateResult {
    const result: BezierMoveUpdateResult = {
      isMoving: this._inBezierMove,
      position: { ...this._currentPosition },
      direction: { ...this._moveLineDir },
      isBlocked: false,
      isFinished: false,
    };

    if (!this._inBezierMove) {
      return result;
    }

    const movedLength = deltaTime * this._moveSpeed;

    if (this._inBezierMoveToRealPosition) {
      // 返回到真实位置模式（被跳跃阻挡时）
      const length = vectorLength({
        x: this._lastRealWorldPosition.x - this._currentPosition.x,
        y: this._lastRealWorldPosition.y - this._currentPosition.y,
      });

      if (length <= movedLength) {
        this._currentPosition = { ...this._lastRealWorldPosition };
        this._inBezierMove = false;
        result.position = { ...this._currentPosition };
        result.isMoving = false;
        result.isFinished = true;
        this._invokeEndCallback();
        return result;
      } else {
        const dir = normalizeVector({
          x: this._lastRealWorldPosition.x - this._currentPosition.x,
          y: this._lastRealWorldPosition.y - this._currentPosition.y,
        });
        this._currentPosition = {
          x: this._currentPosition.x + dir.x * movedLength,
          y: this._currentPosition.y + dir.y * movedLength,
        };
        result.position = { ...this._currentPosition };
      }
    } else {
      // 沿贝塞尔曲线移动
      this._stepBezierLength += movedLength;
      this._movedBezierLength += movedLength;

      let curPos = { ...this._currentPosition };
      let i = 0;

      for (; i < this._bezierPoints.length; i++) {
        const length = vectorLength({
          x: this._bezierPoints[i].x - curPos.x,
          y: this._bezierPoints[i].y - curPos.y,
        });

        if (length < this._stepBezierLength) {
          this._stepBezierLength -= length;
          curPos = { ...this._bezierPoints[i] };
        } else if (length === this._stepBezierLength) {
          curPos = { ...this._bezierPoints[i] };
          this._stepBezierLength = 0;
          i++;
          break;
        } else {
          const dir = normalizeVector({
            x: this._bezierPoints[i].x - curPos.x,
            y: this._bezierPoints[i].y - curPos.y,
          });
          curPos = {
            x: curPos.x + dir.x * this._stepBezierLength,
            y: curPos.y + dir.y * this._stepBezierLength,
          };
          this._stepBezierLength = 0;
          break;
        }
      }

      this._currentPosition = curPos;
      result.position = { ...this._currentPosition };

      // 移除已经过的点
      for (; i > 0; i--) {
        this._bezierPoints.shift();
      }

      // 检查是否到达终点
      if (this._bezierPoints.length === 0) {
        this._inBezierMove = false;
        result.isMoving = false;
        result.isFinished = true;
        this._invokeEndCallback();
        return result;
      }
    }

    // 检查跳跃阻挡
    if (!this._inBezierMoveToRealPosition && isObstacleForJump) {
      // 将曲线位置转换为直线对应位置
      const progress = this._movedBezierLength / this._totalBezierLength;
      const curRealWorldPos = {
        x: this._startWorldPos.x + this._moveLineDir.x * this._totalLineLength * progress,
        y: this._startWorldPos.y + this._moveLineDir.y * this._totalLineLength * progress,
      };
      const curRealTilePos = pixelToTile(curRealWorldPos.x, curRealWorldPos.y);

      if (isObstacleForJump(curRealTilePos.x, curRealTilePos.y)) {
        // 被阻挡，切换到返回真实位置模式
        this._inBezierMoveToRealPosition = true;
        this._stepBezierLength = 0;
        result.isBlocked = true;
        return result;
      }

      this._lastRealWorldPosition = curRealWorldPos;
    }

    return result;
  }

  /**
   * 强制停止移动
   */
  stop(): void {
    this._inBezierMove = false;
    this._bezierPoints = [];
  }

  /**
   * 导出数据（用于调试/序列化）
   */
  exportData(): BezierMoveData {
    return {
      inBezierMove: this._inBezierMove,
      inBezierMoveToRealPosition: this._inBezierMoveToRealPosition,
      startWorldPos: { ...this._startWorldPos },
      endWorldPos: { ...this._endWorldPos },
      speed: this._moveSpeed,
      totalLength: this._totalBezierLength,
      movedLength: this._movedBezierLength,
    };
  }

  // ========== Private Methods ==========

  private _invokeEndCallback(): void {
    if (this._onEnd && this._character) {
      this._onEnd(this._character);
    }
    this._onEnd = null;
    this._character = null;
  }
}
