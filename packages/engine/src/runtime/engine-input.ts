/**
 * Engine Input — keyboard / mouse / joystick handling
 *
 * Extracted from GameEngine to reduce God Class size.
 * Owns the InputState and translates raw browser events into engine-level input.
 */

import type { Direction, Vector2 } from "../core/types";
import { pixelToTile } from "../utils";
import { createDefaultInputState, type InputState } from "./input-types";

/**
 * EngineInput 所需的外部依赖
 */
export interface EngineInputDeps {
  getInputHandler: () => {
    handleKeyDown: (code: string, shiftKey: boolean) => boolean;
    handleMouseUp: (isRightButton: boolean) => void;
    handleClick: (
      worldX: number,
      worldY: number,
      button: "left" | "right",
      ctrlKey: boolean,
      altKey: boolean
    ) => void;
  };
  getPlayer: () => { performActionOk: () => boolean };
  getMapCamera: () => { x: number; y: number } | null;
  getState: () => string;
}

/**
 * 输入处理器 — 管理键盘、鼠标、摇杆输入状态
 */
export class EngineInput {
  readonly state: InputState = createDefaultInputState();
  private readonly deps: EngineInputDeps;

  constructor(deps: EngineInputDeps) {
    this.deps = deps;
  }

  // ============= 键盘 =============

  handleKeyDown(code: string, shiftKey: boolean = false): boolean {
    this.state.keys.add(code);
    this.state.isShiftDown = shiftKey;
    return this.deps.getInputHandler().handleKeyDown(code, shiftKey);
  }

  handleKeyUp(code: string): void {
    this.state.keys.delete(code);
    if (code === "ShiftLeft" || code === "ShiftRight") {
      this.state.isShiftDown = false;
    }
  }

  updateModifierKeys(shiftKey: boolean, altKey: boolean, ctrlKey: boolean): void {
    this.state.isShiftDown = shiftKey;
    this.state.isAltDown = altKey;
    this.state.isCtrlDown = ctrlKey;
  }

  // ============= 鼠标 =============

  handleMouseMove(screenX: number, screenY: number, worldX: number, worldY: number): void {
    this.state.mouseX = screenX;
    this.state.mouseY = screenY;
    this.state.mouseWorldX = worldX;
    this.state.mouseWorldY = worldY;

    // Update clickedTile while mouse is held down
    // This enables continuous walking by holding mouse button
    if (this.state.isMouseDown) {
      this.state.clickedTile = pixelToTile(worldX, worldY);
    }
  }

  /**
   * 处理鼠标按下
   * @param ctrlKey If true, this is Ctrl+Click (attack), don't set clickedTile for movement
   * @param altKey If true, this is Alt+Click (jump), don't set clickedTile for movement
   */
  handleMouseDown(
    worldX: number,
    worldY: number,
    isRightButton: boolean = false,
    ctrlKey: boolean = false,
    altKey: boolean = false
  ): void {
    if (isRightButton) {
      this.state.isRightMouseDown = true;
    } else {
      this.state.isMouseDown = true;
    }
    this.state.mouseWorldX = worldX;
    this.state.mouseWorldY = worldY;

    // 设置点击瓦片 - Ctrl+Click(攻击) 或 Alt+Click(跳跃) 不设置，防止触发移动
    if (!ctrlKey && !altKey) {
      this.state.clickedTile = pixelToTile(worldX, worldY);
    }
  }

  /**
   * 处理鼠标松开
   */
  handleMouseUp(isRightButton: boolean = false): void {
    if (isRightButton) {
      this.state.isRightMouseDown = false;
    } else {
      this.state.isMouseDown = false;
      this.state.clickedTile = null;
    }
    this.deps.getInputHandler().handleMouseUp(isRightButton);
  }

  /**
   * 清除鼠标按住状态（陷阱触发时调用）
   */
  clearMouseInput(): void {
    this.state.isMouseDown = false;
    this.state.isRightMouseDown = false;
    this.state.clickedTile = null;
  }

  /**
   * 处理鼠标点击
   */
  handleClick(
    worldX: number,
    worldY: number,
    button: "left" | "right",
    ctrlKey: boolean = false,
    altKey: boolean = false
  ): void {
    this.deps.getInputHandler().handleClick(worldX, worldY, button, ctrlKey, altKey);
  }

  // ============= 摇杆 =============

  /**
   * 设置摇杆方向（移动端使用）
   */
  setJoystickDirection(direction: Direction | null): void {
    this.state.joystickDirection = direction;
  }

  // ============= 查询 =============

  /**
   * 检查玩家是否可以移动
   */
  canPlayerMove(): boolean {
    return this.deps.getPlayer().performActionOk();
  }

  /**
   * 屏幕坐标转世界坐标
   */
  screenToWorld(screenX: number, screenY: number): Vector2 {
    const camera = this.deps.getMapCamera();
    if (!camera) {
      return { x: screenX, y: screenY };
    }
    return {
      x: screenX + camera.x,
      y: screenY + camera.y,
    };
  }
}
