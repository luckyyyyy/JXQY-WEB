/**
 * GameCanvas - 纯画布组件
 *
 * 职责:
 * 1. 提供画布DOM元素
 * 2. 处理输入事件并转发给引擎
 * 3. 管理画布尺寸
 *
 * 不包含游戏逻辑，仅作为渲染目标
 */

import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import type { GameEngine } from "@/engine/game/gameEngine";
import { useGameInput } from "@/hooks";

export interface GameCanvasProps {
  engine: GameEngine | null;
  width: number;
  height: number;
}

export interface GameCanvasHandle {
  getCanvas: () => HTMLCanvasElement | null;
}

/**
 * GameCanvas 组件
 */
export const GameCanvas = forwardRef<GameCanvasHandle, GameCanvasProps>(
  ({ engine, width, height }, ref) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    // 输入处理（键盘事件已在 Game.tsx 全局注册）
    const { handleMouseMove, handleMouseDown, handleMouseUp, handleClick, handleContextMenu } =
      useGameInput({ engine, canvasRef });

    // 暴露方法
    useImperativeHandle(ref, () => ({
      getCanvas: () => canvasRef.current,
    }));

    // 设置画布到引擎
    useEffect(() => {
      if (engine && canvasRef.current) {
        engine.setCanvas(canvasRef.current);
      }

      return () => {
        // 组件卸载时清除画布引用
        if (engine) {
          engine.setCanvas(null);
        }
      };
    }, [engine]);

    // 更新画布尺寸
    useEffect(() => {
      if (engine) {
        engine.resize(width, height);
      }
    }, [engine, width, height]);

    return (
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        style={{
          display: "block",
          background: "#1a1a2e",
          cursor: "pointer",
        }}
        onMouseMove={handleMouseMove}
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
        onClick={handleClick}
        onContextMenu={handleContextMenu}
      />
    );
  }
);

GameCanvas.displayName = "GameCanvas";
