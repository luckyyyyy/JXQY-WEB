/**
 * PlayerInput - 输入处理层
 * 包含所有键盘、鼠标、摇杆输入处理、方向移动相关的方法
 *
 * 继承链: Character → PlayerBase → PlayerInput → PlayerCombat → Player
 */

import { logger } from "../../core/logger";
import type { InputState, Vector2 } from "../../core/types";
import { CharacterState, Direction, RUN_SPEED_FOLD } from "../../core/types";
import { tileToPixel } from "../../utils";
import {
  IS_USE_THEW_WHEN_NORMAL_RUN,
  type PlayerAction,
  PlayerBase,
  THEW_USE_AMOUNT_WHEN_ATTACK,
  THEW_USE_AMOUNT_WHEN_JUMP,
  THEW_USE_AMOUNT_WHEN_RUN,
} from "./playerBase";

export { THEW_USE_AMOUNT_WHEN_ATTACK };

/**
 * PlayerInput - 输入处理层
 * 包含：键盘输入、鼠标点击、摇杆移动、方向移动等
 */
export abstract class PlayerInput extends PlayerBase {
  // =============================================
  // === Input Handling ===
  // =============================================

  /**
   * Handle input for movement
   *  Update()
   */
  handleInput(input: InputState, _cameraX: number, _cameraY: number): PlayerAction | null {
    this._pendingAction = null;

    // Reference: PerformActionOk() - 在 Magic/Attack/Jump/Hurt/Death 等状态下不能移动
    if (!this.canPerformAction()) {
      logger.debug(`[Player.handleInput] BLOCKED: canPerformAction=false, state=${this._state}`);
      return null;
    }

    // Determine run mode
    this._isRun = this.canRun(input.isShiftDown);

    // if (ControledCharacter == null) { HandleMoveKeyboardInput(); }
    // 控制其他角色时不处理键盘移动（由鼠标控制被控角色移动）
    if (this._controledCharacter === null) {
      // Handle keyboard movement (highest priority)
      const moveDir = this.getKeyboardMoveDirection(input.keys);
      if (moveDir !== null) {
        this.moveInDirection(moveDir, this._isRun);
        return null;
      }

      // Handle joystick direction movement (mobile)
      // 摇杆使用方向移动，类似小键盘，避免频繁寻路导致卡顿
      if (input.joystickDirection !== null) {
        this.moveInDirection(input.joystickDirection, this._isRun);
        return null;
      }
    }

    // Handle mouse movement (PC long press)
    if (input.isMouseDown && input.clickedTile) {
      const targetTile = input.clickedTile;

      // 优化：如果已经在向相同目标移动，不要重复寻路
      // 这避免了每帧重复寻路导致的性能问题和路径重置问题
      const destMatch =
        this._destinationMoveTilePosition &&
        this._destinationMoveTilePosition.x === targetTile.x &&
        this._destinationMoveTilePosition.y === targetTile.y;
      const hasPath = this.path.length > 0;

      if (destMatch && hasPath) {
        // 已经在向该目标移动，跳过
        return null;
      }

      // Cancel auto attack when moving to a new location
      // _autoAttackTarget = null when walking
      this.cancelAutoAttack();

      let success = false;
      if (this._isRun) {
        if (this.canRunCheck()) {
          success = this.runTo(targetTile);
        } else {
          success = this.walkTo(targetTile);
        }
      } else {
        success = this.walkTo(targetTile);
      }

      if (!success) {
        // logger.debug(
        //   `[Player.handleInput] 鼠标长按移动失败: targetTile=(${targetTile.x}, ${targetTile.y})`
        // );
      } else {
        // 验证 walkTo 成功后路径状态
        // logger.debug(
        //   `[Player.handleInput] walkTo成功后: pathLen=${this.path.length}, destTile=(${this._destinationMoveTilePosition?.x}, ${this._destinationMoveTilePosition?.y}), state=${this._state}`
        // );
      }
      return null;
    }

    return this._pendingAction;
  }

  // =============================================
  // === Run/Walk Check Methods ===
  // =============================================

  /**
   * Check if player can run
   */
  protected canRun(isShiftDown: boolean): boolean {
    return (this._walkIsRun > 0 || isShiftDown) && !this._isRunDisabled;
  }

  /**
   * Check if player has enough thew to run
   */
  protected canRunCheck(): boolean {
    if (this._isRunDisabled) return false;
    if (this._isNotUseThewWhenRun) return true;
    return this.thew > 0;
  }

  /**
   * Consume thew when running
   */
  protected consumeRunningThew(): boolean {
    if (!this.canRunCheck()) return false;

    if (!this._isNotUseThewWhenRun) {
      // if (IsInFighting || Globals.IsUseThewWhenNormalRun)
      if (this._isInFighting || IS_USE_THEW_WHEN_NORMAL_RUN) {
        this.thew = Math.max(0, this.thew - THEW_USE_AMOUNT_WHEN_RUN);
      }
    }
    return true;
  }

  /**
   * Reference: Player.CanJump()
   * Override to check and consume thew for jumping
   * Player needs thew to jump, NPC's don't
   */
  protected override canJump(): boolean {
    // if (IsJumpDisabled || NpcIni == null || !NpcIni.ContainsKey(Jump) || NpcIni[Jump].Image == null)
    if (this.isJumpDisabled) {
      return false;
    }

    // IsStateImageOk check - inherited from Character
    if (!this.isStateImageOk(CharacterState.Jump)) {
      return false;
    }

    // if (Thew < ThewUseAmountWhenJump) { GuiManager.ShowMessage("体力不足!"); return false; }
    if (this.thew < THEW_USE_AMOUNT_WHEN_JUMP) {
      this.guiManager?.showMessage("体力不足!");
      return false;
    }

    // else { Thew -= ThewUseAmountWhenJump; return true; }
    this.thew -= THEW_USE_AMOUNT_WHEN_JUMP;
    return true;
  }

  // =============================================
  // === Keyboard Direction Methods ===
  // =============================================

  /**
   * Get movement direction from keyboard (numpad only)
   */
  private getKeyboardMoveDirection(keys: Set<string>): Direction | null {
    const up = keys.has("Numpad8");
    const down = keys.has("Numpad2");
    const left = keys.has("Numpad4");
    const right = keys.has("Numpad6");

    if (up && right) return Direction.NorthEast;
    if (up && left) return Direction.NorthWest;
    if (down && right) return Direction.SouthEast;
    if (down && left) return Direction.SouthWest;

    if (up) return Direction.North;
    if (down) return Direction.South;
    if (left) return Direction.West;
    if (right) return Direction.East;

    if (keys.has("Numpad7")) return Direction.NorthWest;
    if (keys.has("Numpad9")) return Direction.NorthEast;
    if (keys.has("Numpad1")) return Direction.SouthWest;
    if (keys.has("Numpad3")) return Direction.SouthEast;

    return null;
  }

  /**
   * Move in a direction
   * direction)
   * 使用 WalkTo/RunTo 而不是直接设置 path，确保经过完整的寻路和障碍物检测
   *
   * 注意：Direction 枚举（0=North）和原版的方向索引（0=South）不同，需要转换
   * Direction 枚举:    0=N, 1=NE, 2=E, 3=SE, 4=S, 5=SW, 6=W, 7=NW
   * 邻居数组索引:   0=S, 1=SW, 2=W, 3=NW, 4=N, 5=NE, 6=E, 7=SE
   *
   * Enhancement: When primary direction is blocked, try adjacent directions
   * to allow smoother movement around obstacles (especially for mobile joystick)
   */
  protected moveInDirection(direction: Direction, isRun: boolean = false): void {
    // 将 Direction 枚举转换为原版的邻居数组索引
    // Direction: 0=N, 1=NE, 2=E, 3=SE, 4=S, 5=SW, 6=W, 7=NW
    // index:  0=S, 1=SW, 2=W, 3=NW, 4=N, 5=NE, 6=E, 7=SE
    // 映射: Direction -> 原版 index
    // N(0)->4, NE(1)->5, E(2)->6, SE(3)->7, S(4)->0, SW(5)->1, W(6)->2, NW(7)->3
    const directionToCSharpIndex = [4, 5, 6, 7, 0, 1, 2, 3];
    const primaryCSharpDir = directionToCSharpIndex[direction];

    // Direction order: primary, then adjacent directions
    // This allows smoother movement around obstacles
    const directionOrder = [
      primaryCSharpDir,
      (primaryCSharpDir + 1) % 8,
      (primaryCSharpDir + 7) % 8, // +7 = -1 mod 8
    ];

    const neighbors = this.findAllNeighbors(this.tilePosition);
    const mapService = this.engine.map;

    // Try each direction in order of preference
    for (const csharpDirIndex of directionOrder) {
      const targetTile = neighbors[csharpDirIndex];

      // Check if target tile is walkable (quick pre-check to avoid unnecessary pathfinding)
      const isObstacle = mapService.isObstacleForCharacter(targetTile.x, targetTile.y);
      if (isObstacle) {
        continue;
      }

      // Convert back to Direction enum for _currentDirection
      const csharpToDirection = [4, 5, 6, 7, 0, 1, 2, 3]; // inverse mapping
      this._currentDirection = csharpToDirection[csharpDirIndex] as Direction;

      let success: boolean;
      if (isRun && this.canRunCheck()) {
        success = this.runTo(targetTile);
      } else {
        success = this.walkTo(targetTile);
      }

      if (success) {
        return;
      }
    }

    // All directions blocked, use primary direction anyway (will stand)
    this._currentDirection = direction;
  }

  // =============================================
  // === Movement Methods ===
  // =============================================

  /**
   * Walk to a tile
   */
  walkToTile(tileX: number, tileY: number): boolean {
    const result = this.walkTo({ x: tileX, y: tileY });
    if (result) {
      this._isMoving = true;
      this._targetPosition = { x: tileX, y: tileY };
    } else {
      this._isMoving = false;
      this._targetPosition = null;
    }
    return result;
  }

  /**
   * Run to a tile
   */
  runToTile(tileX: number, tileY: number): boolean {
    const result = this.runTo({ x: tileX, y: tileY });
    if (result) {
      this._isMoving = true;
      this._targetPosition = { x: tileX, y: tileY };
    } else {
      this._isMoving = false;
      this._targetPosition = null;
    }
    return result;
  }

  /**
   * Stop movement
   */
  stopMovement(): void {
    this.path = [];
    this._isMoving = false;
    this._targetPosition = null;
    // Use FightStand if in fighting mode
    if (this._isInFighting && this.isStateImageOk(CharacterState.FightStand)) {
      this.state = CharacterState.FightStand;
    } else {
      this.state = CharacterState.Stand;
    }
  }

  // =============================================
  // === Sitting Methods ===
  // =============================================

  /**
   * Start sitting action
   * Reference: Character.Sitdown()
   * - Sets state to Sit
   * - Plays sit animation (FrameEnd - FrameBegin frames)
   * - Calls OnSitDown() hook
   */
  sitdown(): void {
    // if (PerformActionOk() && IsStateImageOk(CharacterState.Sit))
    if (!this.canPerformAction()) {
      return;
    }

    // Stop any current movement or action
    this.path = [];
    this._isMoving = false;
    this._targetPosition = null;
    this.isSitted = false;
    this._sittedMilliseconds = 0;

    // Set state to Sit and play sit animation
    this.state = CharacterState.Sit;
    // NOT PlayCurrentDirOnce()
    // PlayFrames(n) plays n frames starting from current frame
    // So PlayFrames(FrameEnd - FrameBegin) stops exactly at FrameEnd
    // (e.g., if FrameBegin=0, FrameEnd=5, plays frames 0,1,2,3,4 then stops at frame 5)
    // PlayCurrentDirOnce() would play one extra frame causing the frame to wrap back to FrameBegin
    this.playFrames(this._frameEnd - this._frameBegin);

    logger.log(`[Player] Sitdown started`);
  }

  /**
   * Override standingImmediately to reset Player-specific sitting timer
   * only - _sittedMilliseconds is Player-specific
   * Note: _isSitted is now reset in Character.standingImmediately()
   */
  override standingImmediately(): void {
    this._sittedMilliseconds = 0;
    super.standingImmediately();
  }

  // =============================================
  // === Helper Methods ===
  // =============================================

  /**
   * Get all 8 neighboring tile positions
   */
  protected findAllNeighbors(tilePos: Vector2): Vector2[] {
    const neighbors: Vector2[] = [];
    const isOddRow = tilePos.y % 2 === 1;

    // 8 directions: S, SW, W, NW, N, NE, E, SE (matching direction order)
    const offsets = [
      { x: 0, y: 2 }, // 0: South
      { x: isOddRow ? 0 : -1, y: 1 }, // 1: SouthWest
      { x: -1, y: 0 }, // 2: West
      { x: isOddRow ? 0 : -1, y: -1 }, // 3: NorthWest
      { x: 0, y: -2 }, // 4: North
      { x: isOddRow ? 1 : 0, y: -1 }, // 5: NorthEast
      { x: 1, y: 0 }, // 6: East
      { x: isOddRow ? 1 : 0, y: 1 }, // 7: SouthEast
    ];

    for (const offset of offsets) {
      neighbors.push({
        x: tilePos.x + offset.x,
        y: tilePos.y + offset.y,
      });
    }

    return neighbors;
  }

  /**
   * Update movement flags based on path state
   */
  protected updateMovementFlags(): void {
    if (this.path.length === 0) {
      this._isMoving = false;
      this._targetPosition = null;
    }
  }

  /**
   * Cancel auto attack (abstract, implemented in PlayerCombat)
   */
  abstract cancelAutoAttack(): void;
}
