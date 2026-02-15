import type { Direction, Vector2 } from "../core/types";

export interface InputState {
  keys: Set<string>;
  mouseX: number;
  mouseY: number;
  mouseWorldX: number;
  mouseWorldY: number;
  isMouseDown: boolean;
  isRightMouseDown: boolean;
  clickedTile: Vector2 | null;
  isShiftDown: boolean;
  isAltDown: boolean;
  isCtrlDown: boolean;
  joystickDirection: Direction | null;
}

export const createDefaultInputState = (): InputState => ({
  keys: new Set<string>(),
  mouseX: 0,
  mouseY: 0,
  mouseWorldX: 0,
  mouseWorldY: 0,
  isMouseDown: false,
  isRightMouseDown: false,
  clickedTile: null,
  isShiftDown: false,
  isAltDown: false,
  isCtrlDown: false,
  joystickDirection: null,
});
