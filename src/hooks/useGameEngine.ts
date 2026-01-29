/**
 * useGameEngine - React Hook 用于连接游戏引擎
 *
 * 职责:
 * 1. 管理游戏引擎生命周期
 * 2. 订阅游戏事件
 * 3. 提供游戏状态给React组件
 *
 * 初始化流程:
 * 1. initialize() - 加载全局资源（对话文本、等级配置等），只执行一次
 * 2. newGame() - 运行 NewGame.txt 脚本开始新游戏
 *    或 loadGameFromSlot(index) - 从存档槽位加载
 * 3. start() - 启动游戏循环
 */

import { useEffect, useState, useRef } from "react";
import { GameEngine, getGameEngine, type GameEngineState } from "../engine/game/gameEngine";
import { GameEvents, type GameLoadProgressEvent, type GameInitializedEvent } from "../engine/core/gameEvents";

export interface UseGameEngineOptions {
  width: number;
  height: number;
  autoStart?: boolean;
  /** 可选：从存档槽位加载 (1-7) */
  loadSlot?: number;
}

export interface UseGameEngineResult {
  engine: GameEngine | null;
  state: GameEngineState;
  loadProgress: number;
  loadingText: string;
  isReady: boolean;
}

/**
 * 游戏引擎 Hook
 */
export function useGameEngine(options: UseGameEngineOptions): UseGameEngineResult {
  const { width, height, autoStart = true, loadSlot } = options;

  const engineRef = useRef<GameEngine | null>(null);
  const [state, setState] = useState<GameEngineState>("uninitialized");
  const [loadProgress, setLoadProgress] = useState(0);
  const [loadingText, setLoadingText] = useState("");
  const [isReady, setIsReady] = useState(false);

  // 初始化引擎
  useEffect(() => {
    const initEngine = async () => {
      // 获取或创建引擎实例
      const engine = getGameEngine({ width, height });
      engineRef.current = engine;

      // 订阅加载进度事件
      const unsubProgress = engine.getEvents().on(GameEvents.GAME_LOAD_PROGRESS, (data: GameLoadProgressEvent) => {
        setLoadProgress(data.progress);
        setLoadingText(data.text);
        // 只有当引擎确实处于 loading 状态时才更新 React 状态
        // 这样可以区分"存档加载"（需要显示 overlay）和"游戏内地图切换"（不需要）
        if (engine.getState() === "loading") {
          setState("loading");
          setIsReady(false);
        }
      });

      // 订阅初始化完成事件
      const unsubInit = engine.getEvents().on(GameEvents.GAME_INITIALIZED, (data: GameInitializedEvent) => {
        if (data.success) {
          setState("running");
          setIsReady(true);

          // 自动启动游戏循环
          if (autoStart) {
            engine.start();
          }
        }
      });

      // 如果引擎还未初始化，进行完整初始化流程
      if (engine.getState() === "uninitialized") {
        setState("loading");

        if (loadSlot && loadSlot >= 1 && loadSlot <= 7) {
          // 从存档槽位加载
          await engine.initializeAndLoadGame(loadSlot);
        } else {
          // 开始新游戏
          await engine.initializeAndStartNewGame();
        }
      } else {
        // 已初始化，直接设置状态
        setState(engine.getState());
        setIsReady(engine.getState() === "running" || engine.getState() === "paused");
      }

      // 清理函数
      return () => {
        unsubProgress();
        unsubInit();
      };
    };

    initEngine();

    // 组件卸载时不销毁引擎（单例模式）
    // 只停止游戏循环
    return () => {
      // 不在这里停止，让引擎继续运行
    };
  }, [width, height, autoStart, loadSlot]);

  // 处理尺寸变化
  useEffect(() => {
    if (engineRef.current) {
      engineRef.current.resize(width, height);
    }
  }, [width, height]);

  return {
    engine: engineRef.current,
    state,
    loadProgress,
    loadingText,
    isReady,
  };
}
