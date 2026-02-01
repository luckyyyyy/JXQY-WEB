/**
 * CharacterMovement - 移动相关功能
 * 包含所有移动、寻路、跳跃相关的方法
 *
 * 继承链: Sprite → CharacterBase → CharacterMovement → CharacterCombat → Character
 */

import { logger } from "../../core/logger";
import { PathType, findPath as pathFinderFindPath } from "../../core/pathFinder";
import type { Vector2 } from "../../core/types";
import {
  BASE_SPEED,
  CharacterState,
  MIN_CHANGE_MOVE_SPEED_PERCENT,
  RUN_SPEED_FOLD,
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
import { CharacterBase, type CharacterUpdateResult } from "./characterBase";

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

  /**
   * 设置瓦片位置（不改变状态）
   */
  setTilePosition(tileX: number, tileY: number): void {
    this._mapX = tileX;
    this._mapY = tileY;
    this._updatePositionFromTile();
  }

  /**
   * 根据方向移动
   * @param direction 8 方向索引 (0-7)
   * @param elapsedSeconds 经过的时间（秒）
   */
  moveToDirection(direction: number, elapsedSeconds: number): void {
    const speedPercent = Math.max(MIN_CHANGE_MOVE_SPEED_PERCENT, this.addMoveSpeedPercent);
    const changeMoveSpeedFold = 1 + speedPercent / 100;
    const speed = BASE_SPEED * this.walkSpeed * changeMoveSpeedFold;
    const moveDistance = speed * elapsedSeconds;

    const vectors = [
      { x: 0, y: -1 },
      { x: Math.SQRT1_2, y: -Math.SQRT1_2 },
      { x: 1, y: 0 },
      { x: Math.SQRT1_2, y: Math.SQRT1_2 },
      { x: 0, y: 1 },
      { x: -Math.SQRT1_2, y: Math.SQRT1_2 },
      { x: -1, y: 0 },
      { x: -Math.SQRT1_2, y: -Math.SQRT1_2 },
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
    const speedPercent = Math.max(MIN_CHANGE_MOVE_SPEED_PERCENT, this.addMoveSpeedPercent);
    const changeMoveSpeedFold = 1 + speedPercent / 100;
    const speed = BASE_SPEED * this.walkSpeed * changeMoveSpeedFold;
    const moveDistance = speed * elapsedSeconds;

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
   * C# Reference: Character.MoveAlongPath(elapsedSeconds, speedFold)
   */
  moveAlongPath(deltaTime: number, speedFold: number = 1): CharacterUpdateResult {
    const result: CharacterUpdateResult = {
      moved: false,
      reachedDestination: false,
    };

    if (this.path.length === 0) {
      if (this._state === CharacterState.Walk || this._state === CharacterState.Run ||
          this._state === CharacterState.FightWalk || this._state === CharacterState.FightRun) {
        if (this._isInFighting && this.isStateImageOk(CharacterState.FightStand)) {
          this.state = CharacterState.FightStand;
        } else {
          this.state = CharacterState.Stand;
        }
      }
      return result;
    }

    const tileTo = this.path[0];
    const tileFrom = { x: this._mapX, y: this._mapY };
    const targetPixel = tileToPixel(tileTo.x, tileTo.y);

    // 检测障碍物
    if (tileFrom.x !== tileTo.x || tileFrom.y !== tileTo.y) {
      if (this.hasObstacle(tileTo)) {
        this.movedDistance = 0;

        if (this._destinationMoveTilePosition &&
            tileTo.x === this._destinationMoveTilePosition.x &&
            tileTo.y === this._destinationMoveTilePosition.y) {
          this.path = [];
          this.standingImmediately();
          return result;
        }

        const currentTilePixel = tileToPixel(tileFrom.x, tileFrom.y);
        const atTileCenter = Math.abs(this._positionInWorld.x - currentTilePixel.x) < 2 &&
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

    // 计算移动
    const dx = targetPixel.x - this._positionInWorld.x;
    const dy = targetPixel.y - this._positionInWorld.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist < 2) {
      // 到达路点
      this._positionInWorld = { ...targetPixel };
      this._mapX = tileTo.x;
      this._mapY = tileTo.y;
      this.path.shift();
      result.moved = true;

      if (this.path.length === 0) {
        if (this._isInFighting && this.isStateImageOk(CharacterState.FightStand)) {
          this.state = CharacterState.FightStand;
        } else {
          this.state = CharacterState.Stand;
        }
        result.reachedDestination = true;
        this.onReachedDestination();
      }
    } else {
      // 继续移动
      const speedPercent = Math.max(MIN_CHANGE_MOVE_SPEED_PERCENT, this.addMoveSpeedPercent);
      const changeMoveSpeedFold = 1 + speedPercent / 100;
      const speed = BASE_SPEED * speedFold * changeMoveSpeedFold;
      const moveDistance = speed * deltaTime;
      const ratio = Math.min(1, moveDistance / dist);

      this._positionInWorld.x += dx * ratio;
      this._positionInWorld.y += dy * ratio;
      this._currentDirection = getDirection(this._positionInWorld, targetPixel);

      if (this._state !== CharacterState.Walk && this._state !== CharacterState.Run &&
          this._state !== CharacterState.FightWalk && this._state !== CharacterState.FightRun) {
        if (this._isInFighting && this.isStateImageOk(CharacterState.FightWalk)) {
          this.state = CharacterState.FightWalk;
        } else {
          this.state = CharacterState.Walk;
        }
      }
      result.moved = true;

      const newTile = pixelToTile(this._positionInWorld.x, this._positionInWorld.y);
      this._mapX = newTile.x;
      this._mapY = newTile.y;
    }

    return result;
  }

  // =============================================
  // === Walk/Run To ===
  // =============================================

  /**
   * 走到目标瓦片
   */
  walkTo(destTile: Vector2, pathTypeOverride: PathType = PathType.End): boolean {
    if (this._mapX === destTile.x && this._mapY === destTile.y) {
      return true;
    }

    const usePathType = pathTypeOverride === PathType.End ? this.getPathType() : pathTypeOverride;
    const hasObstacleCheck = (tile: Vector2): boolean => this.hasObstacle(tile);
    const isMapObstacle = (tile: Vector2): boolean => this.checkMapObstacleForCharacter(tile);
    const isHardObstacle = (tile: Vector2): boolean => this.checkHardObstacle(tile);

    const path = pathFinderFindPath(
      { x: this._mapX, y: this._mapY },
      destTile,
      usePathType,
      hasObstacleCheck,
      isMapObstacle,
      isHardObstacle,
      8
    );

    if (path.length === 0) {
      this.path = [];
      this.state = CharacterState.Stand;
      return false;
    }

    this.path = path.slice(1);
    this._destinationMoveTilePosition = { ...destTile };
    if (this._isInFighting && this.isStateImageOk(CharacterState.FightWalk)) {
      this.state = CharacterState.FightWalk;
    } else {
      this.state = CharacterState.Walk;
    }
    return true;
  }

  /**
   * 跑到目标瓦片
   */
  runTo(destTile: Vector2, pathTypeOverride: PathType = PathType.End): boolean {
    if (this._mapX === destTile.x && this._mapY === destTile.y) {
      return true;
    }

    const usePathType = pathTypeOverride === PathType.End ? this.getPathType() : pathTypeOverride;
    const hasObstacleCheck = (tile: Vector2): boolean => this.hasObstacle(tile);
    const isMapObstacle = (tile: Vector2): boolean => this.checkMapObstacleForCharacter(tile);
    const isHardObstacle = (tile: Vector2): boolean => this.checkHardObstacle(tile);

    const path = pathFinderFindPath(
      { x: this._mapX, y: this._mapY },
      destTile,
      usePathType,
      hasObstacleCheck,
      isMapObstacle,
      isHardObstacle,
      8
    );

    if (path.length === 0) {
      this.path = [];
      this.state = CharacterState.Stand;
      return false;
    }

    this.path = path.slice(1);
    this._destinationMoveTilePosition = { ...destTile };
    if (this._isInFighting && this.isStateImageOk(CharacterState.FightRun)) {
      this.state = CharacterState.FightRun;
    } else {
      this.state = CharacterState.Run;
    }
    return true;
  }

  /**
   * 按方向行走
   */
  walkToDirection(direction: number, steps: number): void {
    const dirVectors = [
      { x: 0, y: -2 },
      { x: 1, y: -1 },
      { x: 1, y: 0 },
      { x: 1, y: 1 },
      { x: 0, y: 2 },
      { x: -1, y: 1 },
      { x: -1, y: 0 },
      { x: -1, y: -1 },
    ];

    const dir = dirVectors[direction] || { x: 0, y: 0 };
    const targetX = this._mapX + dir.x * steps;
    const targetY = this._mapY + dir.y * steps;

    this._currentDirection = direction;
    this.walkTo({ x: targetX, y: targetY });
  }

  // =============================================
  // === Walk/Run To And Keeping Target ===
  // =============================================

  walkToAndKeepingTarget(destTile: Vector2): boolean {
    const savedAttackTile = this._destinationAttackTilePosition;
    const savedInteractTarget = this._interactiveTarget;
    const savedIsInteractRight = this._isInteractiveRightScript;

    const result = this.walkTo(destTile);

    this._destinationAttackTilePosition = savedAttackTile;
    this._interactiveTarget = savedInteractTarget;
    this._isInteractiveRightScript = savedIsInteractRight;

    return result;
  }

  runToAndKeepingTarget(destTile: Vector2): boolean {
    const savedAttackTile = this._destinationAttackTilePosition;
    const savedInteractTarget = this._interactiveTarget;
    const savedIsInteractRight = this._isInteractiveRightScript;

    const result = this.runTo(destTile);

    this._destinationAttackTilePosition = savedAttackTile;
    this._interactiveTarget = savedInteractTarget;
    this._isInteractiveRightScript = savedIsInteractRight;

    return result;
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
    logger.log(
      `[Character.jumpTo] Starting jump from tile (${this._mapX}, ${this._mapY}) to (${destTile.x}, ${destTile.y})`
    );

    if (!this.performActionOk()) {
      logger.log(`[Character.jumpTo] Cannot perform action`);
      return false;
    }
    if (destTile.x === this._mapX && destTile.y === this._mapY) {
      logger.log(`[Character.jumpTo] Already at destination`);
      return false;
    }
    if (this.checkMapObstacleForCharacter(destTile)) {
      logger.log(`[Character.jumpTo] Map obstacle at destination`);
      return false;
    }
    if (this.hasObstacle(destTile)) {
      logger.log(`[Character.jumpTo] Character obstacle at destination`);
      return false;
    }
    if (
      !this.isStateImageOk(CharacterState.Jump) &&
      !this.isStateImageOk(CharacterState.FightJump)
    ) {
      logger.log(`[Character.jumpTo] No jump animation available`);
      return false;
    }
    if (!this.canJump()) {
      logger.log(`[Character.jumpTo] Cannot jump (canJump returned false)`);
      return false;
    }

    this.stateInitialize();
    this._destinationMoveTilePosition = destTile;

    const startPixelPos = this.pixelPosition;
    const endPixelPos = tileToPixel(destTile.x, destTile.y);
    this.path = [startPixelPos, endPixelPos];
    this.movedDistance = 0;

    if (this._isInFighting && this.isStateImageOk(CharacterState.FightJump)) {
      this.state = CharacterState.FightJump;
    } else {
      this.state = CharacterState.Jump;
    }

    const dx = endPixelPos.x - startPixelPos.x;
    const dy = endPixelPos.y - startPixelPos.y;
    this.setDirectionFromDelta(dx, dy);
    this.playCurrentDirOnce();

    logger.log(
      `[Character.jumpTo] Jump initiated, state=${this._state}, direction=${this._currentDirection}`
    );
    return true;
  }

  protected canJump(): boolean {
    return !this.isJumpDisabled && this.isStateImageOk(CharacterState.Jump);
  }

  // =============================================
  // === Partner Movement ===
  // =============================================

  partnerMoveTo(destinationTilePosition: Vector2): void {
    if (this.checkMapObstacleForCharacter(destinationTilePosition)) {
      return;
    }

    const dist = this.getViewTileDistance(this.tilePosition, destinationTilePosition);

    if (dist > 20) {
      this.setPosition(destinationTilePosition.x, destinationTilePosition.y);
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
    const path: Vector2[] = [{ x: this._mapX, y: this._mapY }];
    const maxTry = count * 3;

    if (maxOffset === -1) {
      maxOffset = isFlyer ? 15 : 10;
    }

    for (let i = 1; i < count; i++) {
      let attempts = maxTry;
      let foundValid = false;

      while (attempts > 0 && !foundValid) {
        attempts--;
        const offsetX = Math.floor(Math.random() * (maxOffset * 2 + 1)) - maxOffset;
        const offsetY = Math.floor(Math.random() * (maxOffset * 2 + 1)) - maxOffset;
        const tilePosition = {
          x: this._mapX + offsetX,
          y: this._mapY + offsetY,
        };

        if (tilePosition.x === 0 && tilePosition.y === 0) continue;
        if (!isFlyer && !this.checkWalkable(tilePosition)) {
          continue;
        }

        path.push(tilePosition);
        foundValid = true;
      }

      if (!foundValid) break;
    }

    return path;
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
    const len = Math.sqrt(direction.x * direction.x + direction.y * direction.y);
    if (len === 0) return fromTile;

    const normX = direction.x / len;
    const normY = direction.y / len;

    return {
      x: Math.round(fromTile.x + normX * distance),
      y: Math.round(fromTile.y + normY * distance),
    };
  }

  // =============================================
  // === Bezier Move ===
  // =============================================

  bezierMoveTo(destinationTilePosition: Vector2, speed: number, onEnd?: (character: CharacterBase) => void): void {
    const curTilePosition = { x: this._mapX, y: this._mapY };

    if (curTilePosition.x === destinationTilePosition.x && curTilePosition.y === destinationTilePosition.y) {
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

    const mapService = this.engine?.map;
    const isObstacleForJump = mapService
      ? (x: number, y: number) => mapService.isObstacleForJump(x, y)
      : undefined;

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
    const mapService = this.engine?.map;
    if (!mapService) return null;

    const dir = sprite.direction;
    const reverseDir = { x: -dir.x, y: -dir.y };
    const currentTile = this.tilePosition;
    const dirOffset = this.getDirectionTileOffset(reverseDir);

    for (let distance = 1; distance <= 5; distance++) {
      const checkTile = {
        x: currentTile.x + dirOffset.x * distance,
        y: currentTile.y + dirOffset.y * distance,
      };

      if (!this.hasObstacle(checkTile) && !mapService.isObstacleForCharacter(checkTile.x, checkTile.y)) {
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

    const mapService = this.engine?.map;
    if (!mapService) return false;

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

  stateInitialize(endInteract: boolean = true, _noEndPlayCurrentDir: boolean = false): void {
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
    this.path = [];
    this.isSitted = false;
    if (this._isInFighting && this.isStateImageOk(CharacterState.FightStand)) {
      this.state = CharacterState.FightStand;
    } else {
      if (
        this.isStateImageOk(CharacterState.Stand1) &&
        Math.random() < 0.25 &&
        this._state !== CharacterState.Stand1
      ) {
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
