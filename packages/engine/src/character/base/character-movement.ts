/**
 * CharacterMovement - 移动相关功能
 * 包含所有移动、寻路、跳跃相关的方法
 *
 * 继承链: Sprite → CharacterBase → CharacterMovement → CharacterCombat → Character
 */

import { logger } from "../../core/logger";
import {
  findDistanceTileInDirection as findDistanceTileInDirectionUtil,
  findPathInDirection,
  PathType,
  findPath as pathFinderFindPath,
} from "../../utils/path-finder";
import type { Vector2 } from "../../core/types";
import {
  BASE_SPEED,
  CharacterState,
  MIN_CHANGE_MOVE_SPEED_PERCENT,
  TILE_HEIGHT,
  TILE_WIDTH,
} from "../../core/types";
import {
  getDirection,
  getDirectionFromVector,
  getViewTileDistance as getViewTileDistanceUtil,
  pixelToTile,
  tileToPixel,
} from "../../utils";
import { getDirectionIndex } from "../../utils/direction";
import { getNeighbors } from "../../utils/neighbors";
import { CharacterBase, type CharacterUpdateResult } from "./character-base";

/**
 * 获取从起点到终点之间经过的所有瓦片（使用线段遍历算法）
 * 用于高速移动时的隧道效应检测，防止穿透障碍物
 *
 * 使用 DDA (Digital Differential Analyzer) 算法沿像素路径采样，
 * 收集经过的所有瓦片坐标
 */
function _getTilesAlongLine(fromPixel: Vector2, toPixel: Vector2): Vector2[] {
  const tiles: Vector2[] = [];
  const seen = new Set<string>();

  const dx = toPixel.x - fromPixel.x;
  const dy = toPixel.y - fromPixel.y;
  const dist = Math.sqrt(dx * dx + dy * dy);

  if (dist < 1) {
    const tile = pixelToTile(fromPixel.x, fromPixel.y);
    return [tile];
  }

  // 采样步长：使用较小的步长确保不会跳过格子
  // 格子对角线约 72 像素，使用 16 像素步长确保覆盖
  const stepSize = Math.min(TILE_WIDTH / 4, TILE_HEIGHT);
  const steps = Math.ceil(dist / stepSize);

  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const px = fromPixel.x + dx * t;
    const py = fromPixel.y + dy * t;
    const tile = pixelToTile(px, py);
    const key = `${tile.x},${tile.y}`;

    if (!seen.has(key)) {
      seen.add(key);
      tiles.push(tile);
    }
  }

  return tiles;
}

/**
 * CharacterMovement - 移动功能层
 * 包含：寻路、移动、跳跃、贝塞尔曲线移动、被武功拖动等
 */
export abstract class CharacterMovement extends CharacterBase {
  // =============================================
  // === Movement Core Methods ===
  // =============================================

  /**
   * 设置位置（立即移动到指定瓦片）
   */
  setPosition(tileX: number, tileY: number): void {
    this.standingImmediately();
    this._mapX = tileX;
    this._mapY = tileY;
    this._updatePositionFromTile();
    this.path = [];
  }

  // =============================================
  // === Speed Calculation ===
  // =============================================

  /**
   * 根据战斗状态选择对应的角色状态
   * 如果处于战斗中且战斗版本的状态可用，则使用战斗状态，否则使用普通状态
   */
  protected selectFightOrNormalState(
    fightState: CharacterState,
    normalState: CharacterState
  ): CharacterState {
    if (this._isInFighting && this.isStateImageOk(fightState)) {
      return fightState;
    }
    return normalState;
  }

  /**
   * 计算当前有效移动速度
   * @param speedFold 速度倍率，默认使用 walkSpeed
   */
  protected getEffectiveSpeed(speedFold: number = this.walkSpeed): number {
    const speedPercent = Math.max(MIN_CHANGE_MOVE_SPEED_PERCENT, this.addMoveSpeedPercent);
    const changeMoveSpeedFold = 1 + speedPercent / 100;
    return BASE_SPEED * speedFold * changeMoveSpeedFold;
  }

  /**
   * 根据方向移动
   * @param direction 8 方向索引 (0-7)
   * @param elapsedSeconds 经过的时间（秒）
   */
  moveToDirection(direction: number, elapsedSeconds: number): void {
    const moveDistance = this.getEffectiveSpeed() * elapsedSeconds;

    // 0=South, 1=SW, 2=W, 3=NW, 4=N, 5=NE, 6=E, 7=SE
    const vectors = [
      { x: 0, y: 1 },
      { x: -Math.SQRT1_2, y: Math.SQRT1_2 },
      { x: -1, y: 0 },
      { x: -Math.SQRT1_2, y: -Math.SQRT1_2 },
      { x: 0, y: -1 },
      { x: Math.SQRT1_2, y: -Math.SQRT1_2 },
      { x: 1, y: 0 },
      { x: Math.SQRT1_2, y: Math.SQRT1_2 },
    ];

    const vec = vectors[direction] || { x: 0, y: 0 };
    const moveX = vec.x * moveDistance;
    const moveY = vec.y * moveDistance;
    this._positionInWorld.x += moveX;
    this._positionInWorld.y += moveY;
    this._currentDirection = direction;
    this.movedDistance += Math.sqrt(moveX * moveX + moveY * moveY);

    const tile = pixelToTile(this._positionInWorld.x, this._positionInWorld.y);
    this._mapX = tile.x;
    this._mapY = tile.y;
  }

  /**
   * 根据方向向量移动
   * @param direction 方向向量（会被归一化）
   * @param elapsedSeconds 经过的时间（秒）
   */
  moveToVector(direction: Vector2, elapsedSeconds: number): void {
    const len = Math.sqrt(direction.x * direction.x + direction.y * direction.y);
    if (len === 0) return;

    const normalizedDir = { x: direction.x / len, y: direction.y / len };
    const moveDistance = this.getEffectiveSpeed() * elapsedSeconds;

    const moveX = normalizedDir.x * moveDistance;
    const moveY = normalizedDir.y * moveDistance;
    this._positionInWorld.x += moveX;
    this._positionInWorld.y += moveY;

    this.setDirectionFromDelta(normalizedDir.x, normalizedDir.y);
    this.movedDistance += Math.sqrt(moveX * moveX + moveY * moveY);

    const tile = pixelToTile(this._positionInWorld.x, this._positionInWorld.y);
    this._mapX = tile.x;
    this._mapY = tile.y;
  }

  /**
   * 根据像素增量设置方向
   */
  setDirectionFromDelta(dx: number, dy: number): void {
    this._currentDirection = getDirectionFromVector({ x: dx, y: dy });
  }

  // =============================================
  // === Path Following ===
  // =============================================

  /**
   * 沿路径移动
   * Reference: Character.MoveAlongPath(elapsedSeconds, speedFold)
   *
   * 移动方向始终从 当前像素位置 → 目标瓦片像素 计算，保证平滑。
   * 到达路点后将剩余距离传递到下一段路径（carry-over），高速移动不会卡顿。
   * 到达路点时检查下一瓦片障碍物，防止穿墙。
   */
  moveAlongPath(deltaTime: number, speedFold: number = 1): CharacterUpdateResult {
    const result: CharacterUpdateResult = {
      moved: false,
      reachedDestination: false,
    };

    if (this.path.length === 0) {
      if (
        this._state === CharacterState.Walk ||
        this._state === CharacterState.Run ||
        this._state === CharacterState.FightWalk ||
        this._state === CharacterState.FightRun
      ) {
        this.state = this.selectFightOrNormalState(CharacterState.FightStand, CharacterState.Stand);
      }
      return result;
    }

    const tileTo = this.path[0];
    const tileFrom = { x: this._mapX, y: this._mapY };

    // === C# Reference: if (TilePosition == tileFrom && tileFrom != tileTo) ===
    // 在 tileFrom 时检查 tileTo 的障碍物
    if (tileFrom.x !== tileTo.x || tileFrom.y !== tileTo.y) {
      const hasObs = this.hasObstacle(tileTo);
      if (hasObs) {
        this.movedDistance = 0;

        if (
          this._destinationMoveTilePosition &&
          tileTo.x === this._destinationMoveTilePosition.x &&
          tileTo.y === this._destinationMoveTilePosition.y
        ) {
          this.path = [];
          this.standingImmediately();
          return result;
        }

        const currentTilePixel = tileToPixel(tileFrom.x, tileFrom.y);
        const atTileCenter =
          Math.abs(this._positionInWorld.x - currentTilePixel.x) < 2 &&
          Math.abs(this._positionInWorld.y - currentTilePixel.y) < 2;

        if (atTileCenter && this._destinationMoveTilePosition) {
          const hasObstacleCheck = (tile: Vector2): boolean => this.hasObstacle(tile);
          const isMapObstacle = (tile: Vector2): boolean => this.checkMapObstacleForCharacter(tile);
          const isHardObstacle = (tile: Vector2): boolean => this.checkHardObstacle(tile);

          const newPath = pathFinderFindPath(
            tileFrom,
            this._destinationMoveTilePosition,
            this.getPathType(),
            hasObstacleCheck,
            isMapObstacle,
            isHardObstacle,
            8
          );

          if (newPath.length === 0) {
            this.path = [];
            this.standingImmediately();
          } else {
            this.path = newPath.slice(1);
          }
        } else {
          this._positionInWorld = { ...currentTilePixel };
          this.path = [];
          this.standingImmediately();
        }
        return result;
      }
    }

    // 计算本帧总移动预算
    let moveRemaining = this.getEffectiveSpeed(speedFold) * deltaTime;

    // 循环消耗移动预算，允许一帧内跨越多个路点（高速移动时保持平滑）
    while (moveRemaining > 0 && this.path.length > 0) {
      const target = this.path[0];
      const targetPixel = tileToPixel(target.x, target.y);

      const dx = targetPixel.x - this._positionInWorld.x;
      const dy = targetPixel.y - this._positionInWorld.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < 1) {
        // 已在路点上，snap 并推进到下一段
        this._positionInWorld = { ...targetPixel };
        this._mapX = target.x;
        this._mapY = target.y;
        this.movedDistance = 0;
        this.path.shift();
        result.moved = true;

        if (this.path.length === 0) {
          // 到达最终目的地
          this._destinationMoveTilePosition = { x: 0, y: 0 };
          this.state = this.selectFightOrNormalState(CharacterState.FightStand, CharacterState.Stand);
          result.reachedDestination = true;
          this.onReachedDestination();
          break;
        }

        // 检查下一瓦片障碍物（防止高速穿墙）
        const nextTile = this.path[0];
        if (this.hasObstacle(nextTile)) {
          this._handleObstacleOnNextTile(nextTile);
          break;
        }
        continue;
      }

      if (moveRemaining >= dist) {
        // 本帧预算足够到达当前路点
        this._positionInWorld = { ...targetPixel };
        this._mapX = target.x;
        this._mapY = target.y;
        moveRemaining -= dist;
        this.movedDistance = 0;
        this.path.shift();
        result.moved = true;

        // 设置朝向
        this._currentDirection = getDirection({ x: 0, y: 0 }, { x: dx, y: dy });

        if (this.path.length === 0) {
          this._destinationMoveTilePosition = { x: 0, y: 0 };
          this.state = this.selectFightOrNormalState(CharacterState.FightStand, CharacterState.Stand);
          result.reachedDestination = true;
          this.onReachedDestination();
          break;
        }

        // 检查下一瓦片障碍物
        const nextTile = this.path[0];
        if (this.hasObstacle(nextTile)) {
          this._handleObstacleOnNextTile(nextTile);
          break;
        }
      } else {
        // 预算不足以到达路点，按比例移动
        const ratio = moveRemaining / dist;
        this._positionInWorld.x += dx * ratio;
        this._positionInWorld.y += dy * ratio;
        this.movedDistance += moveRemaining;
        moveRemaining = 0;
        result.moved = true;

        // 使用移动方向设置朝向（即使接近目标也保持正确）
        if (dx !== 0 || dy !== 0) {
          this._currentDirection = getDirection({ x: 0, y: 0 }, { x: dx, y: dy });
        }

        // === 防穿墙: 等角坐标系瓦片漂移保护 ===
        // 等角地图中，两个相邻瓦片中心间的像素插值经常落入第三个瓦片（菱形几何特性）
        // 该第三瓦片可能是墙壁，如果 _mapX/_mapY 被设为墙壁瓦片，
        // 后续鼠标点击触发的寻路会从墙内开始 → 穿墙
        // 修正方式：只在新瓦片是当前瓦片或目标瓦片时更新 _mapX/_mapY
        // 不修改像素位置和 movedDistance，避免视觉卡顿
        const newTile = pixelToTile(this._positionInWorld.x, this._positionInWorld.y);
        if (
          (newTile.x === this._mapX && newTile.y === this._mapY) ||
          (newTile.x === target.x && newTile.y === target.y)
        ) {
          this._mapX = newTile.x;
          this._mapY = newTile.y;
        }
        // else: 保持 _mapX/_mapY 不变，角色逻辑位置仍在上一个有效瓦片
      }
    }

    if (
      result.moved &&
      this._state !== CharacterState.Walk &&
      this._state !== CharacterState.Run &&
      this._state !== CharacterState.FightWalk &&
      this._state !== CharacterState.FightRun
    ) {
      this.state = this.selectFightOrNormalState(CharacterState.FightWalk, CharacterState.Walk);
    }

    return result;
  }

  /**
   * 到达路点后发现下一瓦片有障碍物时的处理
   */
  private _handleObstacleOnNextTile(nextTile: Vector2): void {
    this.movedDistance = 0;
    if (this._destinationMoveTilePosition) {
      const hasObstacleCheck = (tile: Vector2): boolean => this.hasObstacle(tile);
      const isMapObstacle = (tile: Vector2): boolean => this.checkMapObstacleForCharacter(tile);
      const isHardObstacle = (tile: Vector2): boolean => this.checkHardObstacle(tile);

      const newPath = pathFinderFindPath(
        { x: this._mapX, y: this._mapY },
        this._destinationMoveTilePosition,
        this.getPathType(),
        hasObstacleCheck,
        isMapObstacle,
        isHardObstacle,
        8
      );

      if (newPath.length === 0) {
        this.path = [];
        this.standingImmediately();
      } else {
        this.path = newPath.slice(1);
      }
    } else {
      this.path = [];
      this.standingImmediately();
    }
  }

  // =============================================
  // === Walk/Run To ===
  // =============================================

  /**
   * 走到目标瓦片
   * destinationTilePosition, PathType pathType)
   * checks PerformActionOk() at the start to prevent interrupting special actions
   */
  walkTo(destTile: Vector2, pathTypeOverride: PathType = PathType.End): boolean {
    if (!this.performActionOk()) return false;
    if (this._mapX === destTile.x && this._mapY === destTile.y) return true;

    const result = this._findPathAndMove(destTile, pathTypeOverride);
    if (!result) return false;

    this.cancelAttackTarget();
    this.state = this.selectFightOrNormalState(CharacterState.FightWalk, CharacterState.Walk);
    return true;
  }

  /**
   * 跑到目标瓦片
   * checks PerformActionOk() and Run state image availability
   */
  runTo(destTile: Vector2, pathTypeOverride: PathType = PathType.End): boolean {
    if (!this.performActionOk()) return false;
    if (this._mapX === destTile.x && this._mapY === destTile.y) return true;
    if (!this.isStateImageOk(CharacterState.Run) && !this.isStateImageOk(CharacterState.FightRun)) {
      return false;
    }

    const result = this._findPathAndMove(destTile, pathTypeOverride);
    if (!result) return false;

    this.state = this.selectFightOrNormalState(CharacterState.FightRun, CharacterState.Run);
    return true;
  }

  /**
   * walkTo/runTo 的共通寻路逻辑
   * 寻路成功后设置 path 和 _destinationMoveTilePosition，返回 true
   * 寻路失败时清理状态并返回 false
   */
  private _findPathAndMove(destTile: Vector2, pathTypeOverride: PathType): boolean {
    const usePathType = pathTypeOverride === PathType.End ? this.getPathType() : pathTypeOverride;
    const hasObstacleCheck = (tile: Vector2): boolean => this.hasObstacle(tile);
    const isMapObstacle = (tile: Vector2): boolean => this.checkMapObstacleForCharacter(tile);
    const isHardObstacle = (tile: Vector2): boolean => this.checkHardObstacle(tile);

    const startTile = { x: this._mapX, y: this._mapY };
    let actualDestTile = destTile;

    let path = pathFinderFindPath(
      startTile,
      actualDestTile,
      usePathType,
      hasObstacleCheck,
      isMapObstacle,
      isHardObstacle,
      8
    );

    // 如果寻路失败（目标可能是障碍物），尝试沿方向行走
    // 这样点击障碍物时角色会朝那个方向尽可能走远，而不是完全不动
    if (path.length === 0) {
      const directionResult = findPathInDirection(
        startTile,
        destTile,
        isMapObstacle,
        isHardObstacle
      );

      if (directionResult.path.length > 1) {
        path = directionResult.path;
        actualDestTile = directionResult.destination!;
      }
    }

    if (path.length === 0) {
      this.path = [];
      this.standingImmediately();
      return false;
    }

    this.path = path.slice(1);
    this._destinationMoveTilePosition = { ...actualDestTile };
    return true;
  }

  /**
   * 按方向行走
   * + CheckStepMove
   *
   * uses a step-by-step approach where each step finds the neighbor in that direction.
   * For isometric maps, the neighbor offset depends on whether the current Y is odd or even.
   * We calculate the final destination by iterating step by step.
   *
   * Direction indices:
   * 3  4  5
   * 2     6
   * 1  0  7
   *
   * 0=South, 1=SouthWest, 2=West, 3=NorthWest, 4=North, 5=NorthEast, 6=East, 7=SouthEast
   */
  walkToDirection(direction: number, steps: number): void {
    if (direction < 0 || direction > 7) {
      logger.warn(`[Character.walkToDirection] Invalid direction: ${direction}`);
      return;
    }

    // Calculate final destination by iterating step by step
    // Each step uses FindNeighborInDirection which accounts for odd/even row offsets
    let currentTile: Vector2 = { x: this._mapX, y: this._mapY };

    for (let i = 0; i < steps; i++) {
      const neighbors = getNeighbors(currentTile);
      currentTile = neighbors[direction];
    }

    this._currentDirection = direction;
    this.walkTo(currentTile);
  }

  // =============================================\n  // === Walk/Run To And Keeping Target ===\n  // =============================================

  /**
   * 移动到目标但保留攻击/交互目标
   * 保存并恢复 attackTile、interactTarget、interactRightScript
   */
  private _moveToKeepingTarget(destTile: Vector2, moveFn: (tile: Vector2) => boolean): boolean {
    const savedAttackTile = this._destinationAttackTilePosition;
    const savedInteractTarget = this._interactiveTarget;
    const savedIsInteractRight = this._isInteractiveRightScript;

    const result = moveFn(destTile);

    this._destinationAttackTilePosition = savedAttackTile;
    this._interactiveTarget = savedInteractTarget;
    this._isInteractiveRightScript = savedIsInteractRight;

    return result;
  }

  walkToAndKeepingTarget(destTile: Vector2): boolean {
    return this._moveToKeepingTarget(destTile, (tile) => this.walkTo(tile));
  }

  runToAndKeepingTarget(destTile: Vector2): boolean {
    return this._moveToKeepingTarget(destTile, (tile) => this.runTo(tile));
  }

  protected moveToTarget(destTile: Vector2, isRun: boolean): void {
    if (isRun) {
      this.runToAndKeepingTarget(destTile);
    } else {
      this.walkToAndKeepingTarget(destTile);
    }
  }

  // =============================================
  // === Jump ===
  // =============================================

  /**
   * 跳到目标瓦片
   */
  jumpTo(destTile: Vector2): boolean {

    if (!this.performActionOk()) {
      return false;
    }
    if (destTile.x === this._mapX && destTile.y === this._mapY) {
      return false;
    }
    if (this.checkMapObstacleForCharacter(destTile)) {
      return false;
    }
    if (this.hasObstacle(destTile)) {
      return false;
    }
    if (
      !this.isStateImageOk(CharacterState.Jump) &&
      !this.isStateImageOk(CharacterState.FightJump)
    ) {
      return false;
    }
    if (!this.canJump()) {
      return false;
    }

    this.stateInitialize();
    this._destinationMoveTilePosition = destTile;

    const startPixelPos = this.pixelPosition;
    const endPixelPos = tileToPixel(destTile.x, destTile.y);
    this.path = [startPixelPos, endPixelPos];
    this.movedDistance = 0;

    this.state = this.selectFightOrNormalState(CharacterState.FightJump, CharacterState.Jump);

    const dx = endPixelPos.x - startPixelPos.x;
    const dy = endPixelPos.y - startPixelPos.y;
    this.setDirectionFromDelta(dx, dy);
    this.playCurrentDirOnce();

    return true;
  }

  protected canJump(): boolean {
    return !this.isJumpDisabled && this.isStateImageOk(CharacterState.Jump);
  }

  // =============================================
  // === Partner Movement ===
  // =============================================

  /**
   * Character.PartnerMoveTo(destinationTilePosition)
   * If distance greater than 20, reset partner position around player.
   * If distance greater than 5, run to destination.
   * If distance greater than 2, and is running, run to destination, else walk to destination.
   */
  partnerMoveTo(destinationTilePosition: Vector2): void {
    // if (MapBase.Instance.IsObstacleForCharacter(destinationTilePosition)) return;
    if (this.checkMapObstacleForCharacter(destinationTilePosition)) {
      return;
    }

    const dist = this.getViewTileDistance(this.tilePosition, destinationTilePosition);

    if (dist > 20) {
      // Globals.ThePlayer.ResetPartnerPosition();
      this.engine.player.resetPartnerPosition();
    } else if (dist > 5) {
      this.runTo(destinationTilePosition);
    } else if (dist > 2) {
      if (this.isRunning()) {
        this.runTo(destinationTilePosition);
      } else {
        this.walkTo(destinationTilePosition);
      }
    }
  }

  // =============================================
  // === Random/Loop Walk ===
  // =============================================

  protected getRandTilePath(count: number, isFlyer: boolean, maxOffset: number = -1): Vector2[] {
    if (maxOffset === -1) {
      maxOffset = isFlyer ? 15 : 10;
    }
    return generateRandTilePath(
      this._mapX,
      this._mapY,
      count,
      maxOffset,
      (x, y) => this.checkWalkable({ x, y }),
    );
  }

  protected randWalk(
    tilePositionList: Vector2[] | null,
    randMaxValue: number,
    _isFlyer: boolean
  ): void {
    if (tilePositionList === null || tilePositionList.length < 2 || !this.isStanding()) {
      return;
    }

    if (Math.floor(Math.random() * randMaxValue) === 0) {
      const randomIndex = Math.floor(Math.random() * tilePositionList.length);
      const tilePosition = tilePositionList[randomIndex];
      this.walkTo(tilePosition);
    }
  }

  protected loopWalk(
    tilePositionList: Vector2[] | null,
    randMaxValue: number,
    _isFlyer: boolean
  ): void {
    if (tilePositionList === null || tilePositionList.length < 2) {
      return;
    }

    this._isInLoopWalk = true;

    if (this.isStanding() && Math.floor(Math.random() * randMaxValue) === 0) {
      this._currentLoopWalkIndex++;
      if (this._currentLoopWalkIndex > tilePositionList.length - 1) {
        this._currentLoopWalkIndex = 0;
      }
      this.walkTo(tilePositionList[this._currentLoopWalkIndex]);
    }
  }

  // =============================================
  // === Move Away Target ===
  // =============================================

  moveAwayTarget(targetPixelPosition: Vector2, awayTileDistance: number, isRun: boolean): boolean {
    if (awayTileDistance < 1) return false;

    const myPixel = this.pixelPosition;
    const awayDirX = myPixel.x - targetPixelPosition.x;
    const awayDirY = myPixel.y - targetPixelPosition.y;

    const neighbor = this.findDistanceTileInDirection(
      this.tilePosition,
      { x: awayDirX, y: awayDirY },
      awayTileDistance
    );

    if (this.hasObstacle(neighbor)) return false;
    if (this.checkMapObstacleForCharacter(neighbor)) return false;

    if (isRun) {
      this.runToAndKeepingTarget(neighbor);
    } else {
      this.walkToAndKeepingTarget(neighbor);
    }

    if (!this.path || this.path.length === 0) {
      return false;
    }

    return true;
  }

  protected findDistanceTileInDirection(
    fromTile: Vector2,
    direction: Vector2,
    distance: number
  ): Vector2 {
    return findDistanceTileInDirectionUtil(fromTile, direction, distance);
  }

  // =============================================
  // === Bezier Move ===
  // =============================================

  bezierMoveTo(
    destinationTilePosition: Vector2,
    speed: number,
    onEnd?: (character: CharacterBase) => void
  ): void {
    const curTilePosition = { x: this._mapX, y: this._mapY };

    if (
      curTilePosition.x === destinationTilePosition.x &&
      curTilePosition.y === destinationTilePosition.y
    ) {
      onEnd?.(this);
      return;
    }

    const destWorldPos = tileToPixel(destinationTilePosition.x, destinationTilePosition.y);
    const dir = this._bezierMover.startMove(this.positionInWorld, destWorldPos, speed, this, onEnd);
    if (dir.x !== 0 || dir.y !== 0) {
      this.setDirectionFromDelta(dir.x, dir.y);
    }
  }

  protected updateBezierMove(deltaTime: number): void {
    if (!this._bezierMover.isMoving) {
      return;
    }

    const mapService = this.engine.map;
    const isObstacleForJump = (x: number, y: number) => mapService.isObstacleForJump(x, y);

    const result = this._bezierMover.update(deltaTime, pixelToTile, isObstacleForJump);

    if (result.isMoving || result.isFinished) {
      this.positionInWorld = result.position;
    }
  }

  // =============================================
  // === Moved By Magic Sprite ===
  // =============================================

  protected updateMovedByMagicSprite(): void {
    if (this._movedByMagicSprite === null) return;

    const sprite = this._movedByMagicSprite;
    const magic = sprite.magic;

    if ((sprite.isInDestroy && magic.hideUserWhenCarry === 0) || sprite.isDestroyed) {
      if (magic.carryUser === 3) {
        const safePos = this.findSafePositionForRelease(sprite);
        if (safePos) {
          this.setTilePosition(safePos.x, safePos.y);
        }
      }
      this._movedByMagicSprite = null;
      return;
    }

    if (magic.carryUser === 3 || magic.carryUser === 4) {
      if (this.checkMapObstacleForCharacter(this.tilePosition)) {
        const safePos = this.findSafePositionForRelease(sprite);
        if (safePos) {
          this.setTilePosition(safePos.x, safePos.y);
        }
        this.setDirection(getDirectionIndex(sprite.direction, 8));
        sprite.destroy();
      } else {
        this.positionInWorld = {
          x: sprite.positionInWorld.x + this.movedByMagicSpriteOffset.x,
          y: sprite.positionInWorld.y + this.movedByMagicSpriteOffset.y,
        };
        this.setDirection(getDirectionIndex(sprite.direction, 8));
      }
    } else {
      const targetPos = {
        x: sprite.positionInWorld.x + this.movedByMagicSpriteOffset.x,
        y: sprite.positionInWorld.y + this.movedByMagicSpriteOffset.y,
      };
      const targetTile = pixelToTile(targetPos.x, targetPos.y);

      if (this.checkLinearlyMove(this.tilePosition, targetTile)) {
        this.positionInWorld = targetPos;
        this.setDirection(getDirectionIndex(sprite.direction, 8));
      } else {
        if (magic.carryUser === 2) {
          sprite.destroy();
        }
        this._movedByMagicSprite = null;
      }
    }
  }

  protected findSafePositionForRelease(sprite: { direction: Vector2 }): Vector2 | null {
    const mapService = this.engine.map;

    const dir = sprite.direction;
    const reverseDir = { x: -dir.x, y: -dir.y };
    const currentTile = this.tilePosition;
    const dirOffset = this.getDirectionTileOffset(reverseDir);

    for (let distance = 1; distance <= 5; distance++) {
      const checkTile = {
        x: currentTile.x + dirOffset.x * distance,
        y: currentTile.y + dirOffset.y * distance,
      };

      if (
        !this.hasObstacle(checkTile) &&
        !mapService.isObstacleForCharacter(checkTile.x, checkTile.y)
      ) {
        return checkTile;
      }
    }

    return null;
  }

  protected getDirectionTileOffset(dir: Vector2): Vector2 {
    return {
      x: dir.x > 0.3 ? 1 : dir.x < -0.3 ? -1 : 0,
      y: dir.y > 0.3 ? 1 : dir.y < -0.3 ? -1 : 0,
    };
  }

  protected checkLinearlyMove(fromTile: Vector2, toTile: Vector2): boolean {
    if (fromTile.x === toTile.x && fromTile.y === toTile.y) {
      return true;
    }

    const mapService = this.engine.map;

    const dx = Math.abs(toTile.x - fromTile.x);
    const dy = Math.abs(toTile.y - fromTile.y);
    const sx = fromTile.x < toTile.x ? 1 : -1;
    const sy = fromTile.y < toTile.y ? 1 : -1;
    let err = dx - dy;

    let x = fromTile.x;
    let y = fromTile.y;

    while (x !== toTile.x || y !== toTile.y) {
      if (this.hasObstacle({ x, y }) || mapService.isObstacleForCharacter(x, y)) {
        return false;
      }

      const e2 = 2 * err;
      if (e2 > -dy) {
        err -= dy;
        x += sx;
      }
      if (e2 < dx) {
        err += dx;
        y += sy;
      }
    }

    if (this.hasObstacle(toTile) || mapService.isObstacleForCharacter(toTile.x, toTile.y)) {
      return false;
    }

    return true;
  }

  // =============================================
  // === Distance Utilities ===
  // =============================================

  protected getViewTileDistance(startTile: Vector2, endTile: Vector2): number {
    return getViewTileDistanceUtil(startTile, endTile);
  }

  protected canViewTarget(startTile: Vector2, endTile: Vector2, visionRadius: number): boolean {
    const maxVisionRadius = 80;
    if (visionRadius > maxVisionRadius) return false;

    if (startTile.x === endTile.x && startTile.y === endTile.y) return true;
    if (this.checkMapObstacleForCharacter(endTile)) return false;

    const distance = this.getViewTileDistance(startTile, endTile);
    return distance <= visionRadius;
  }

  // =============================================
  // === State Utilities ===
  // =============================================

  /**
   * Reference: Character.CancelAttackTarget()
   * 取消攻击目标，用于在行走时清除之前的攻击目标
   */
  cancelAttackTarget(): void {
    this._destinationAttackTilePosition = null;
    this._interactiveTarget = null;
  }

  /**
   * endInteract, bool noEndPlayCurrentDir)
   * 重置角色状态前的初始化，清理路径、攻击目标和播放状态
   */
  stateInitialize(endInteract: boolean = true, noEndPlayCurrentDir: boolean = false): void {
    // if(!noEndPlayCurrentDir) { EndPlayCurrentDirOnce(); }
    if (!noEndPlayCurrentDir) {
      this.endPlayCurrentDirOnce();
    }

    this._destinationMoveTilePosition = { x: 0, y: 0 };
    this.path = [];
    this._destinationAttackTilePosition = null;
    this.isSitted = false;
    if (this._interactiveTarget && endInteract) {
      this._interactiveTarget = null;
      this._isInteractiveRightScript = false;
    }
  }

  standingImmediately(): void {
    if (this.isDeathInvoked || this.isDeath) {
      return;
    }
    // Reference: StandingImmediately() calls StateInitialize(false, true)
    // 必须清理 destinationMoveTilePosition，否则后续移动判断会出错
    this.stateInitialize(false, true);
    if (this._isInFighting && this.isStateImageOk(CharacterState.FightStand)) {
      // Reference: StandingImmediately() - 如果已经是 FightStand，不改变状态以保持动画循环
      if (this._state === CharacterState.FightStand) {
        return;
      }
      this.state = CharacterState.FightStand;
    } else {
      // Reference: StandingImmediately() - 如果已经是站立状态，不改变状态以保持动画循环
      // 原版通过 SetState() 返回 isSameState 来判断，只有状态真正改变时才重置动画
      // 这里如果已经是 Stand 或 Stand1，直接返回不改变状态
      if (this._state === CharacterState.Stand || this._state === CharacterState.Stand1) {
        // 已经在站立状态，不改变（允许动画自然循环）
        return;
      }
      if (this.isStateImageOk(CharacterState.Stand1) && Math.random() < 0.25) {
        this.state = CharacterState.Stand1;
      } else {
        this.state = CharacterState.Stand;
      }
    }
  }

  toNonFightingState(): void {
    this._isInFighting = false;
    this._totalNonFightingSeconds = 0;
    if (this.isStanding() && !this.isStateImageOk(this._state)) {
      this.state = CharacterState.Stand;
    }
  }

  // =============================================
  // === Abstract Methods ===
  // =============================================

  abstract performActionOk(): boolean;
  abstract isStateImageOk(state: CharacterState): boolean;
  protected abstract onReachedDestination(): void;

  // === Follow ===
  followAndWalkToTarget(target: CharacterBase): void {
    this.walkTo(target.tilePosition);
    this.follow(target);
  }
}

/**
 * Generate random tile path around a home position.
 *
 * Standalone version of CharacterMovement.getRandTilePath, for use outside
 * the class hierarchy (e.g. dashboard NPC simulation).
 *
 * @param homeX      Centre tile X
 * @param homeY      Centre tile Y
 * @param count      Number of path points (engine default: 8)
 * @param maxOffset  Max random offset from home (engine default: 10 ground, 15 flyer)
 * @param isWalkable Optional check – return false for blocked tiles. When omitted every tile is considered walkable.
 */
export function generateRandTilePath(
  homeX: number,
  homeY: number,
  count: number,
  maxOffset: number,
  isWalkable?: (x: number, y: number) => boolean,
): Vector2[] {
  const path: Vector2[] = [{ x: homeX, y: homeY }];
  const maxTry = count * 3;

  for (let i = 1; i < count; i++) {
    let attempts = maxTry;
    let foundValid = false;

    while (attempts > 0 && !foundValid) {
      attempts--;
      const offsetX = Math.floor(Math.random() * (maxOffset * 2 + 1)) - maxOffset;
      const offsetY = Math.floor(Math.random() * (maxOffset * 2 + 1)) - maxOffset;
      const x = homeX + offsetX;
      const y = homeY + offsetY;

      if (x === 0 && y === 0) continue;
      if (isWalkable && !isWalkable(x, y)) continue;

      path.push({ x, y });
      foundValid = true;
    }

    if (!foundValid) break;
  }

  return path;
}
