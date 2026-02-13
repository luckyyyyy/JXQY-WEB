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
 *    或 loadGameFromJSON(data) - 从云存档加载
 * 3. start() - 启动游戏循环
 */

import {
  GameEvents,
  type GameInitializedEvent,
  type GameLoadProgressEvent,
} from "@miu2d/engine/core/game-events";
import { logger } from "@miu2d/engine/core/logger";
import { createGameEngine } from "@miu2d/engine/runtime/game-engine";
import type { GameEngine, GameEngineState } from "@miu2d/engine/runtime/game-engine";
import type { SaveData } from "@miu2d/engine/runtime";
import { useEffect, useRef, useState } from "react";

export interface UseGameEngineOptions {
  width: number;
  height: number;
  autoStart?: boolean;
  /** 可选：从 JSON 存档数据加载（分享存档、标题界面读档） */
  initialSaveData?: SaveData;
}

export interface UseGameEngineResult {
  engine: GameEngine | null;
  state: GameEngineState;
  loadProgress: number;
  loadingText: string;
  isReady: boolean;
  /** 加载错误信息 */
  error: string | null;
}

/**
 * 游戏引擎 Hook
 */
export function useGameEngine(options: UseGameEngineOptions): UseGameEngineResult {
  const { width, height, autoStart = true, initialSaveData } = options;

  const engineRef = useRef<GameEngine | null>(null);
  const [state, setState] = useState<GameEngineState>("uninitialized");
  const [loadProgress, setLoadProgress] = useState(0);
  const [loadingText, setLoadingText] = useState("");
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 存储取消订阅函数的引用，用于 cleanup
  const unsubscribersRef = useRef<(() => void)[]>([]);

  // 初始化引擎
  useEffect(() => {
    const engine = engineRef.current ?? createGameEngine({ width, height });
    engineRef.current = engine;

    // 清理之前的订阅（如果有）
    for (const unsub of unsubscribersRef.current) {
      unsub();
    }
    unsubscribersRef.current = [];

    // 订阅加载进度事件
    const unsubProgress = engine
      .getEvents()
      .on(GameEvents.GAME_LOAD_PROGRESS, (data: GameLoadProgressEvent) => {
        setLoadProgress(data.progress);
        setLoadingText(data.text);

        const currentState = engine.getState();
        if (currentState === "loading") {
          // 引擎处于 loading 状态，显示加载浮层
          setState("loading");
          setIsReady(false);
        } else if (currentState === "running" && data.progress >= 100) {
          // 地图加载完成且引擎已恢复 running 状态，隐藏加载浮层
          setState("running");
          setIsReady(true);
        }
      });
    unsubscribersRef.current.push(unsubProgress);

    // 订阅初始化完成事件（仅在初次加载时触发，mid-game reload 不会触发）
    const unsubInit = engine
      .getEvents()
      .on(GameEvents.GAME_INITIALIZED, (data: GameInitializedEvent) => {
        if (data.success) {
          setState("running");
          setIsReady(true);

          // 自动启动游戏循环（仅在未运行时启动）
          if (autoStart && !engine.getIsRunning()) {
            engine.start();
          }
        }
      });
    unsubscribersRef.current.push(unsubInit);

    // 异步初始化逻辑
    const initAsync = async () => {
      // 如果引擎还未初始化，进行完整初始化流程
      if (engine.getState() === "uninitialized") {
        setState("loading");
        setError(null);

        try {
          if (initialSaveData) {
            // 从 JSON 存档数据加载（分享存档、标题界面读档）
            await engine.initializeAndLoadFromJSON(initialSaveData);
          } else {
            // 开始新游戏
            await engine.initializeAndStartNewGame();
          }
        } catch (e) {
          const errorMessage = e instanceof Error ? e.message : "加载失败";
          logger.error("[useGameEngine] Load failed:", errorMessage);
          setError(errorMessage);
          setState("uninitialized");
        }
      } else {
        // 已初始化，直接设置状态
        setState(engine.getState());
        setIsReady(engine.getState() === "running" || engine.getState() === "paused");
      }
    };

    initAsync();

    // 清理函数：取消订阅事件
    return () => {
      for (const unsub of unsubscribersRef.current) {
        unsub();
      }
      unsubscribersRef.current = [];
    };
  }, [autoStart, height, initialSaveData, width]);

  useEffect(() => {
    return () => {
      engineRef.current?.dispose();
      engineRef.current = null;
    };
  }, []);

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
    error,
  };
}
