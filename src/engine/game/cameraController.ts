/**
 * Camera Controller - Handles camera movement for script commands
 * Extracted from GameManager
 *
 * Based on C#'s Camera.MoveTo functionality
 */
import type { Vector2 } from "../core/types";

/**
 * Direction vectors for 8-way movement
 * 方向从 South 开始，顺时针
 * C# Reference: Utils.GetDirection8List()
 */
const sqrt2 = Math.SQRT1_2; // 1/sqrt(2) ≈ 0.707
const DIRECTION_VECTORS: Vector2[] = [
  { x: 0, y: 1 }, // 0: South
  { x: -sqrt2, y: sqrt2 }, // 1: Southwest
  { x: -1, y: 0 }, // 2: West
  { x: -sqrt2, y: -sqrt2 }, // 3: Northwest
  { x: 0, y: -1 }, // 4: North
  { x: sqrt2, y: -sqrt2 }, // 5: Northeast
  { x: 1, y: 0 }, // 6: East
  { x: sqrt2, y: sqrt2 }, // 7: Southeast
];

/**
 * Manages camera movement for script-driven camera moves
 */
export class CameraController {
  // MoveScreen (direction-based movement)
  private isMoving: boolean = false;
  private moveSpeed: number = 0;
  private moveDirection: Vector2 = { x: 0, y: 0 };
  private leftMoveFrames: number = 0;
  private totalMovedDistance: Vector2 = { x: 0, y: 0 };

  // MoveScreenEx (position-based movement)
  private isMovingToPosition: boolean = false;
  private moveToDestination: Vector2 = { x: 0, y: 0 };
  private moveToSpeed: number = 0;

  /**
   * Check if camera is being moved by script
   */
  isMovingByScript(): boolean {
    return this.isMoving || this.isMovingToPosition;
  }

  /**
   * Check if MoveScreenEx (position-based) is in progress
   */
  isMovingToPositionActive(): boolean {
    return this.isMovingToPosition;
  }

  /**
   * Move camera in a direction for a given number of frames
   * Based on C# Camera.MoveTo(direction, keepFrameCount, speed)
   *
   * @param directionIndex 8-way direction index (0=S, 1=SW, 2=W, 3=NW, 4=N, 5=NE, 6=E, 7=SE)
   * @param keepFrameCount Number of frames to move
   * @param speed Pixels per frame (will be multiplied by 2 like C#)
   */
  moveTo(directionIndex: number, keepFrameCount: number, speed: number): void {
    const dir = DIRECTION_VECTORS[directionIndex % 8] || { x: 0, y: 0 };
    if (dir.x === 0 && dir.y === 0) return;

    this.isMoving = true;
    this.moveDirection = dir;
    this.leftMoveFrames = keepFrameCount;
    this.moveSpeed = speed;
    this.totalMovedDistance = { x: 0, y: 0 };
    // Stop any position-based movement
    this.isMovingToPosition = false;
  }

  /**
   * Move camera to a specific position (for MoveScreenEx)
   * Based on C# Camera.MoveTo(centerTilePosition, speed)
   *
   * @param destPixelX Destination camera X position (pixel)
   * @param destPixelY Destination camera Y position (pixel)
   * @param speed Speed in pixels per frame
   */
  moveToPosition(destPixelX: number, destPixelY: number, speed: number): void {
    this.isMovingToPosition = true;
    this.moveToDestination = { x: destPixelX, y: destPixelY };
    this.moveToSpeed = speed;
    // Stop any direction-based movement
    this.isMoving = false;
  }

  /**
   * Stop camera movement
   */
  stopMovement(): void {
    this.isMoving = false;
    this.isMovingToPosition = false;
    this.leftMoveFrames = 0;
    this.totalMovedDistance = { x: 0, y: 0 };
  }

  /**
   * Update camera movement (called from game loop)
   * C# Reference: Carmera.UpdateMove() and UpdateMoveTo()
   *
   * @param currentX Current camera X position
   * @param currentY Current camera Y position
   * @param deltaTime Delta time in milliseconds
   * @returns New camera position, or null if not moving
   */
  update(currentX: number, currentY: number, deltaTime: number): Vector2 | null {
    // Handle MoveScreenEx (position-based movement)
    if (this.isMovingToPosition) {
      return this.updateMoveToPosition(currentX, currentY);
    }

    // Handle MoveScreen (direction-based movement)
    if (!this.isMoving || this.leftMoveFrames <= 0) {
      return null;
    }

    // C# UpdateMove:
    // _totalMovedDistance += _moveDirection * _moveSpeed * 2;
    // 每帧移动 speed * 2 像素
    // 我们需要模拟帧率，假设 60fps
    const framesThisTick = (deltaTime / 1000) * 60;
    const moveThisTick = this.moveSpeed * 2 * framesThisTick;

    // 累积移动距离
    this.totalMovedDistance.x += this.moveDirection.x * moveThisTick;
    this.totalMovedDistance.y += this.moveDirection.y * moveThisTick;

    // 提取整数部分作为实际移动量
    const distanceX = Math.trunc(this.totalMovedDistance.x);
    const distanceY = Math.trunc(this.totalMovedDistance.y);
    this.totalMovedDistance.x -= distanceX;
    this.totalMovedDistance.y -= distanceY;

    // 减少剩余帧数
    this.leftMoveFrames -= framesThisTick;

    // 检查是否完成
    if (this.leftMoveFrames <= 0) {
      this.isMoving = false;
      this.leftMoveFrames = 0;
    }

    return {
      x: currentX + distanceX,
      y: currentY + distanceY,
    };
  }

  /**
   * Update position-based camera movement (MoveScreenEx)
   * C# Reference: Carmera.UpdateMoveTo()
   */
  private updateMoveToPosition(currentX: number, currentY: number): Vector2 | null {
    // Calculate direction to destination
    const dx = this.moveToDestination.x - currentX;
    const dy = this.moveToDestination.y - currentY;
    const distance = Math.sqrt(dx * dx + dy * dy);

    // If close enough, snap to destination
    if (distance < 5) {
      this.isMovingToPosition = false;
      return { x: this.moveToDestination.x, y: this.moveToDestination.y };
    }

    // Normalize and move
    const dirX = dx / distance;
    const dirY = dy / distance;
    const newX = currentX + dirX * this.moveToSpeed;
    const newY = currentY + dirY * this.moveToSpeed;

    // Check if we would overshoot
    const newDx = this.moveToDestination.x - newX;
    const newDy = this.moveToDestination.y - newY;
    const newDistance = Math.sqrt(newDx * newDx + newDy * newDy);

    if (newDistance >= distance) {
      // Overshot, snap to destination
      this.isMovingToPosition = false;
      return { x: this.moveToDestination.x, y: this.moveToDestination.y };
    }

    return { x: newX, y: newY };
  }

  /**
   * Get current movement state for debugging
   */
  getState(): {
    isMoving: boolean;
    direction: Vector2;
    leftMoveFrames: number;
    speed: number;
  } {
    return {
      isMoving: this.isMoving,
      direction: this.moveDirection,
      leftMoveFrames: this.leftMoveFrames,
      speed: this.moveSpeed,
    };
  }
}
