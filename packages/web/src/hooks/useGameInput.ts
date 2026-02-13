/**
 * useGameInput - React Hook 用于处理游戏输入
 *
 * 职责:
 * 1. 处理键盘和鼠标事件
 * 2. 将输入转发给游戏引擎
 * 3. 管理输入相关的React状态
 */

import type { GameEngine } from "@miu2d/engine/runtime/game-engine";
import { useCallback } from "react";

export interface UseGameInputOptions {
  engine: GameEngine | null;
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
}

export interface UseGameInputResult {
  handleKeyDown: (e: React.KeyboardEvent) => void;
  handleKeyUp: (e: React.KeyboardEvent) => void;
  handleMouseMove: (e: React.MouseEvent) => void;
  handleMouseDown: (e: React.MouseEvent) => void;
  handleMouseUp: (e: React.MouseEvent) => void;
  handleClick: (e: React.MouseEvent) => void;
  handleContextMenu: (e: React.MouseEvent) => void;
}

/**
 * 游戏输入 Hook
 */
export function useGameInput(options: UseGameInputOptions): UseGameInputResult {
  const { engine, canvasRef } = options;

  // 获取画布上的世界坐标
  const getWorldPosition = useCallback(
    (clientX: number, clientY: number): { worldX: number; worldY: number } => {
      const canvas = canvasRef.current;
      if (!canvas || !engine) {
        return { worldX: 0, worldY: 0 };
      }

      const rect = canvas.getBoundingClientRect();
      const screenX = clientX - rect.left;
      const screenY = clientY - rect.top;

      const worldPos = engine.screenToWorld(screenX, screenY);
      return { worldX: worldPos.x, worldY: worldPos.y };
    },
    [engine, canvasRef]
  );

  // 键盘按下
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!engine) return;

      // 游戏画布获得焦点时，阻止所有按键的默认行为
      // 防止方向键滚动页面、空格键滚动、Tab切换焦点等
      e.preventDefault();

      engine.handleKeyDown(e.code, e.shiftKey);
    },
    [engine]
  );

  // 键盘松开
  const handleKeyUp = useCallback(
    (e: React.KeyboardEvent) => {
      if (!engine) return;
      e.preventDefault();
      engine.handleKeyUp(e.code);
      // 同步更新shift状态（确保在其他键松开时也能正确更新）
      engine.updateModifierKeys(e.shiftKey, e.altKey, e.ctrlKey);
    },
    [engine]
  );

  // 鼠标移动
  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!engine) return;

      // 同步修饰键状态（支持长按移动时的shift检测）
      engine.updateModifierKeys(e.shiftKey, e.altKey, e.ctrlKey);

      const { worldX, worldY } = getWorldPosition(e.clientX, e.clientY);
      engine.handleMouseMove(e.clientX, e.clientY, worldX, worldY);
    },
    [engine, getWorldPosition]
  );

  // 鼠标按下
  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (!engine) return;

      // 同步修饰键状态
      engine.updateModifierKeys(e.shiftKey, e.altKey, e.ctrlKey);

      const { worldX, worldY } = getWorldPosition(e.clientX, e.clientY);
      const isRightButton = e.button === 2;
      // Pass ctrlKey and altKey - if either is held, don't trigger movement
      engine.handleMouseDown(worldX, worldY, isRightButton, e.ctrlKey, e.altKey);
    },
    [engine, getWorldPosition]
  );

  // 鼠标松开
  const handleMouseUp = useCallback(
    (e: React.MouseEvent) => {
      if (!engine) return;
      const isRightButton = e.button === 2;
      engine.handleMouseUp(isRightButton);
    },
    [engine]
  );

  // 鼠标点击
  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      if (!engine) return;

      const { worldX, worldY } = getWorldPosition(e.clientX, e.clientY);
      // Pass ctrlKey and altKey for attack/jump handling
      // Ctrl+Click = attack, Alt+Click = jump
      engine.handleClick(worldX, worldY, "left", e.ctrlKey, e.altKey);
    },
    [engine, getWorldPosition]
  );

  // 右键菜单
  const handleContextMenu = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      if (!engine) return;

      const { worldX, worldY } = getWorldPosition(e.clientX, e.clientY);
      engine.handleClick(worldX, worldY, "right");
    },
    [engine, getWorldPosition]
  );

  return {
    handleKeyDown,
    handleKeyUp,
    handleMouseMove,
    handleMouseDown,
    handleMouseUp,
    handleClick,
    handleContextMenu,
  };
}
