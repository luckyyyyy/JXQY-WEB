/**
 * Game - 游戏主组件
 *
 * 架构特点:
 * 1. 游戏引擎是单例，独立于React
 * 2. React只负责画布、镜头和UI渲染
 * 3. 游戏循环在引擎中运行，不在React中
 * 4. UI通过事件订阅获取状态更新
 * 5. 窗口调整时只重新获取状态并绘制
 */

import React, { useRef, useEffect, forwardRef, useImperativeHandle, useState, useCallback } from "react";
import { useGameEngine } from "../../hooks";
import { GameCanvas, type GameCanvasHandle } from "./GameCanvas";
import { GameUI } from "./GameUI";
import { LoadingOverlay } from "./LoadingOverlay";
import type { GameEngine } from "../../engine/game/gameEngine";
import type { DebugManager } from "../../engine/debug";

/**
 * Game component public methods (exposed via ref)
 * 所有调试功能都通过 getDebugManager() 访问
 */
export interface GameHandle {
  getEngine: () => GameEngine | null;
  getDebugManager: () => DebugManager | null;
}

export interface GameProps {
  width?: number;
  height?: number;
  /** 可选：从存档槽位加载 (1-7) */
  loadSlot?: number;
}

/**
 * Game Component
 */
export const Game = forwardRef<GameHandle, GameProps>(
  ({ width = 800, height = 600, loadSlot }, ref) => {
    const canvasRef = useRef<GameCanvasHandle>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    // 使用游戏引擎 hook
    const { engine, state, loadProgress, loadingText, isReady } = useGameEngine({
      width,
      height,
      autoStart: true,
      loadSlot,
    });

    // UI强制更新（用于部分需要刷新的场景）
    const [, setForceUpdate] = useState({});
    const forceUpdate = () => setForceUpdate({});

    // 键盘事件处理（在游戏容器上监听，避免影响debug面板等其他区域）
    const handleKeyDown = useCallback(
      (e: React.KeyboardEvent) => {
        if (!engine) return;

        // 阻止默认行为（防止方向键滚动页面等）
        e.preventDefault();
        engine.handleKeyDown(e.code, e.shiftKey);
      },
      [engine]
    );

    const handleKeyUp = useCallback(
      (e: React.KeyboardEvent) => {
        if (!engine) return;

        e.preventDefault();
        engine.handleKeyUp(e.code);
        engine.updateModifierKeys(e.shiftKey, e.altKey, e.ctrlKey);
      },
      [engine]
    );

    // 点击游戏区域时获取焦点（让键盘事件能够被捕获）
    const handleContainerClick = useCallback(() => {
      containerRef.current?.focus();
    }, []);

    // Expose methods via ref for external control (DebugPanel)
    useImperativeHandle(
      ref,
      () => ({
        getEngine: () => engine,
        getDebugManager: () => engine?.getGameManager()?.getDebugManager() ?? null,
      }),
      [engine]
    );

    const isLoading = state === "loading" || !isReady;

    return (
      <div
        ref={containerRef}
        tabIndex={0}
        style={{
          position: "relative",
          width,
          height,
          overflow: "hidden",
          outline: "none",
          userSelect: "none",
        }}
        onKeyDown={handleKeyDown}
        onKeyUp={handleKeyUp}
        onClick={handleContainerClick}
      >
        {/* Game Canvas */}
        <GameCanvas ref={canvasRef} engine={engine} width={width} height={height} />

        {/* Loading Overlay */}
        <LoadingOverlay isLoading={isLoading} progress={loadProgress} text={loadingText} />

        {/* Game UI Components */}
        {!isLoading && <GameUI engine={engine} width={width} height={height} />}
      </div>
    );
  }
);

Game.displayName = "Game";
