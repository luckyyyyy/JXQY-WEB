/**
 * Camera Controller - Handles camera movement for script commands
 * Extracted from GameManager
 *
 *  functionality
 */
import type { Vector2 } from "../core/types";
import { distanceFromDelta } from "../utils/distance";

/**
 * Direction vectors for 8-way movement
 * 方向从 South 开始，顺时针
 * Reference: Utils.GetDirection8List()
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

  // Vibrating screen (震屏效果)
  private vibratingDegree: number = 0;
  private xVibratingSum: number = 0;
  private yVibratingSum: number = 0;

  // Pending camera requests (consumed by GameEngine each frame)
  private pendingCameraPosition: Vector2 | null = null;
  private pendingCenterOnPlayer: boolean = false;

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
   * (direction, keepFrameCount, speed)
   *
   * @param directionIndex 8-way direction index (0=S, 1=SW, 2=W, 3=NW, 4=N, 5=NE, 6=E, 7=SE)
   * @param keepFrameCount Number of frames to move
   * @param speed Pixels per frame (will be multiplied by 2)
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
   * (centerTilePosition, speed)
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
   * and UpdateMoveTo()
   *
   * @param currentX Current camera X position
   * @param currentY Current camera Y position
   * @param deltaTime Delta time in milliseconds
   * @returns New camera position, or null if not moving
   */
  update(currentX: number, currentY: number, deltaTime: number): Vector2 | null {
    // Handle MoveScreenEx (position-based movement)
    if (this.isMovingToPosition) {
      return this.updateMoveToPosition(currentX, currentY, deltaTime);
    }

    // Handle MoveScreen (direction-based movement)
    if (!this.isMoving || this.leftMoveFrames <= 0) {
      return null;
    }

    // UpdateMove:
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
   * Reference: Carmera.UpdateMoveTo()
   * C# original moves _moveSpeed pixels per frame at ~60fps
   */
  private updateMoveToPosition(
    currentX: number,
    currentY: number,
    deltaTime: number
  ): Vector2 | null {
    // Calculate direction to destination
    const dx = this.moveToDestination.x - currentX;
    const dy = this.moveToDestination.y - currentY;
    const distance = distanceFromDelta(dx, dy);

    // If close enough, snap to destination
    if (distance < 5) {
      this.isMovingToPosition = false;
      return { x: this.moveToDestination.x, y: this.moveToDestination.y };
    }

    // Normalize and move (frame-rate independent: C# runs at ~60fps)
    const framesThisTick = (deltaTime / 1000) * 60;
    const moveAmount = this.moveToSpeed * framesThisTick;
    const dirX = dx / distance;
    const dirY = dy / distance;
    const newX = currentX + dirX * moveAmount;
    const newY = currentY + dirY * moveAmount;

    // C# stuck detection: if (CarmeraBeginPositionInWorld == last) IsInMoveTo = false;
    // 当目标被地图边界 clamp 后相机无法移动时，防止死循环
    if (Math.abs(newX - currentX) < 0.01 && Math.abs(newY - currentY) < 0.01) {
      this.isMovingToPosition = false;
      return { x: currentX, y: currentY };
    }

    // Check if we would overshoot
    const newDx = this.moveToDestination.x - newX;
    const newDy = this.moveToDestination.y - newY;
    const newDistance = distanceFromDelta(newDx, newDy);

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

  /**
   * Start vibrating screen effect
   * degree)
   *
   * @param degree Intensity of vibration (decrements each frame)
   */
  vibrateScreen(degree: number): void {
    this.vibratingDegree = degree;
    this.xVibratingSum = 0;
    this.yVibratingSum = 0;
  }

  /**
   * Check if screen is vibrating
   */
  isVibrating(): boolean {
    return this.vibratingDegree > 0;
  }

  /**
   * Update vibrating screen effect
   * Reference: Carmera.UpdateVibratingScreen()
   *
   * Returns offset to apply to camera position
   */
  updateVibrating(): Vector2 {
    if (this.vibratingDegree <= 0) {
      return { x: 0, y: 0 };
    }

    // Random direction for shake
    const xSign = Math.random() < 0.5 ? -1 : 1;
    const ySign = Math.random() < 0.5 ? -1 : 1;
    let xAdd = xSign * Math.floor(Math.random() * (this.vibratingDegree + 1));
    let yAdd = ySign * Math.floor(Math.random() * (this.vibratingDegree + 1));

    // Limit cumulative displacement
    if (Math.abs(this.xVibratingSum) > this.vibratingDegree) {
      xAdd = -(this.xVibratingSum / Math.abs(this.xVibratingSum)) * Math.abs(xAdd);
    }
    if (Math.abs(this.yVibratingSum) > this.vibratingDegree) {
      yAdd = -(this.yVibratingSum / Math.abs(this.yVibratingSum)) * Math.abs(yAdd);
    }

    this.xVibratingSum += xAdd;
    this.yVibratingSum += yAdd;
    this.vibratingDegree--;

    if (this.vibratingDegree === 0) {
      // Vibration finished, return correction offset
      const correction = { x: -this.xVibratingSum, y: -this.yVibratingSum };
      this.xVibratingSum = 0;
      this.yVibratingSum = 0;
      return correction;
    }

    return { x: xAdd, y: yAdd };
  }

  // ========== Pending Camera Requests ==========

  /**
   * MoveScreenEx with half-viewport offset
   * Cancels pending center-on-player and calculates camera position for centering target on screen
   */
  moveToPositionCentered(
    destX: number,
    destY: number,
    speed: number,
    viewW: number,
    viewH: number,
    mapPixelW?: number,
    mapPixelH?: number
  ): void {
    this.pendingCenterOnPlayer = false;
    const halfViewX = Math.floor(viewW / 2);
    const halfViewY = Math.floor(viewH / 2);
    let camX = destX - halfViewX;
    let camY = destY - halfViewY;
    if (mapPixelW != null && mapPixelH != null) {
      camX = Math.max(0, Math.min(camX, mapPixelW - viewW));
      camY = Math.max(0, Math.min(camY, mapPixelH - viewH));
    }
    this.moveToPosition(camX, camY, speed);
  }

  /** Set camera position directly (for SetMapPos command) */
  setCameraPosition(pixelX: number, pixelY: number): void {
    this.pendingCameraPosition = { x: pixelX, y: pixelY };
  }

  /** Get pending camera position (consumed by GameEngine) */
  consumePendingCameraPosition(): Vector2 | null {
    const pos = this.pendingCameraPosition;
    this.pendingCameraPosition = null;
    return pos;
  }

  /** Request to center camera on player */
  requestCenterOnPlayer(): void {
    this.pendingCenterOnPlayer = true;
  }

  /** Check and consume pending center on player request */
  consumePendingCenterOnPlayer(): boolean {
    const pending = this.pendingCenterOnPlayer;
    this.pendingCenterOnPlayer = false;
    return pending;
  }

  /** Cancel pending center when script explicitly moves camera */
  cancelPendingCenter(): void {
    this.pendingCenterOnPlayer = false;
  }

  /**
   * Adjust MoveScreenEx destination when viewport is resized.
   * moveToDestination 是 camera top-left 坐标（= targetCenter - halfView），
   * 视口变化时需要同步调整，否则到达时目标点不在新视口中心。
   */
  adjustForViewportResize(dw: number, dh: number): void {
    if (this.isMovingToPosition) {
      this.moveToDestination.x -= dw / 2;
      this.moveToDestination.y -= dh / 2;
    }
  }
}
