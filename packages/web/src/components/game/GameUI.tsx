/**
 * GameUI - 游戏UI主题切换器
 *
 * 根据 uiTheme 选择渲染 Classic 或 Modern UI
 * 使用 useGameUILogic hook 共享业务逻辑
 *
 * 架构:
 * - useGameUILogic: 所有 UI 状态和交互逻辑
 * - ClassicGameUI: ASF 精灵的经典复古风格渲染
 * - ModernGameUIWrapper: 毛玻璃效果的现代风格渲染
 */

import type { GameEngine } from "@miu2d/engine/runtime/game-engine";
import type React from "react";
import { ClassicGameUI } from "./ClassicGameUI";
import { useGameUILogic } from "./hooks";
import { ModernGameUIWrapper } from "./ModernGameUIWrapper";
import type { UITheme } from "./ui";

interface GameUIProps {
  engine: GameEngine | null;
  width: number;
  height: number;
  /** UI 主题: classic (经典复古) 或 modern (现代毛玻璃) */
  uiTheme?: UITheme;
}

/**
 * GameUI Component - 主题切换器
 *
 * 根据 uiTheme prop 切换不同的 UI 风格:
 * - "classic": 使用 ASF 精灵的经典复古风格
 * - "modern": 使用毛玻璃效果的现代风格
 */
export const GameUI: React.FC<GameUIProps> = ({ engine, width, height, uiTheme = "classic" }) => {
  // 共享的 UI 业务逻辑
  const logic = useGameUILogic({ engine });

  if (!engine) return null;

  // 根据主题选择渲染组件
  if (uiTheme === "modern") {
    return <ModernGameUIWrapper logic={logic} width={width} height={height} />;
  }

  // 默认使用经典风格
  return <ClassicGameUI logic={logic} width={width} height={height} />;
};
