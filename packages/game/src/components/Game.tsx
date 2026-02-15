/**
 * Game - 游戏主组件
 *
 * 架构特点:
 * 1. 游戏引擎是实例，独立于React
 * 2. React只负责画布、镜头和UI渲染
 * 3. 游戏循环在引擎中运行，不在React中
 * 4. UI通过事件订阅获取状态更新
 * 5. 窗口调整时只重新获取状态并绘制
 */

import { GameEvents, type UIPanelChangeEvent } from "@miu2d/engine/core/game-events";
import type { DebugManager } from "@miu2d/engine/runtime/debug-manager";
import type { GameEngine } from "@miu2d/engine/runtime/game-engine";
import type React from "react";
import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from "react";
import { useGameEngine } from "../hooks";
import { GameCanvas, type GameCanvasHandle } from "./GameCanvas";
import { GameUI } from "./GameUI";
import { LoadingOverlay } from "./LoadingOverlay";

/**
 * Game component public methods (exposed via ref)
 * 所有调试功能都通过 getDebugManager() 访问
 */
export interface GameHandle {
  getEngine: () => GameEngine | null;
  getDebugManager: () => DebugManager | null;
  /** 获取加载错误信息 */
  getError: () => string | null;
}

export interface GameProps {
  width?: number;
  height?: number;
  /** 可选：从 JSON 存档数据加载（分享存档、标题界面读档） */
  initialSaveData?: import("@miu2d/engine/storage").SaveData;
  /** 返回标题界面回调 */
  onReturnToTitle?: () => void;
  /** UI 主题 */
  uiTheme?: "classic" | "modern";
  /** 打开菜单面板回调（拦截引擎的系统菜单和存档面板） */
  onOpenMenu?: (tab: "save" | "settings") => void;
}

/**
 * Game Component
 */
export const Game = forwardRef<GameHandle, GameProps>(
  (
    {
      width = 800,
      height = 600,
      initialSaveData,
      onReturnToTitle,
      uiTheme = "classic",
      onOpenMenu,
    },
    ref
  ) => {
    const canvasRef = useRef<GameCanvasHandle>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    // 使用游戏引擎 hook
    const { engine, state, loadProgress, loadingText, isReady, error } = useGameEngine({
      width,
      height,
      autoStart: true,
      initialSaveData,
    });

    // 监听返回标题事件
    useEffect(() => {
      if (!engine || !onReturnToTitle) return;

      const unsub = engine.getEvents().on(GameEvents.RETURN_TO_TITLE, () => {
        onReturnToTitle();
      });

      return () => unsub();
    }, [engine, onReturnToTitle]);

    // UI强制更新（用于部分需要刷新的场景）
    const [, setForceUpdate] = useState({});
    const _forceUpdate = () => setForceUpdate({});

    // 键盘事件处理（在游戏容器上监听，只有焦点在游戏上时才处理）
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

    // 监听面板事件：恢复焦点 + 拦截系统菜单/存档面板
    useEffect(() => {
      const events = engine?.getEvents();
      if (!events) return;

      const unsub = events.on(GameEvents.UI_PANEL_CHANGE, (event: UIPanelChangeEvent) => {
        // 拦截系统菜单和存档面板，替换为 Web 菜单面板
        if (onOpenMenu && event.isOpen) {
          if (event.panel === "system") {
            engine?.getGameManager().guiManager.showSystem(false);
            onOpenMenu("save");
            return;
          }
          if (event.panel === "saveLoad") {
            engine?.getGameManager().guiManager.showSaveLoad(false);
            onOpenMenu("save");
            return;
          }
        }
        // 面板关闭时恢复焦点
        if (!event.isOpen) {
          // 使用 setTimeout 确保 React 渲染完成后再 focus
          setTimeout(() => {
            containerRef.current?.focus();
          }, 0);
        }
      });

      return () => unsub();
    }, [engine, onOpenMenu]);

    // Expose methods via ref for external control (DebugPanel)
    useImperativeHandle(
      ref,
      () => ({
        getEngine: () => engine,
        getDebugManager: () => engine?.getGameManager()?.debugManager ?? null,
        getError: () => error,
      }),
      [engine, error]
    );

    const isLoading = state === "loading" || !isReady;

    return (
      <div
        ref={containerRef}
        tabIndex={0}
        role="application"
        aria-label="Game container"
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
        <LoadingOverlay
          isLoading={isLoading}
          progress={loadProgress}
          text={loadingText}
          error={error}
        />

        {/* Game UI Components */}
        {!isLoading && <GameUI engine={engine} width={width} height={height} uiTheme={uiTheme} />}
      </div>
    );
  }
);

Game.displayName = "Game";
