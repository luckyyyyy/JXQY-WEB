/**
 * Modern TimerDisplay - 计时器显示
 * Props 与经典 TimerGui 完全一致
 */

import type { TimerState } from "@miu2d/engine/core";
import type React from "react";
import { useMemo } from "react";
import { borderRadius, glassEffect, modernColors, spacing, typography } from "./theme";

interface TimerDisplayProps {
  timerState: TimerState;
  screenWidth?: number;
}

export const TimerDisplay: React.FC<TimerDisplayProps> = ({ timerState, screenWidth = 800 }) => {
  // 格式化时间（与经典 UI 一致）
  const formattedTime = useMemo(() => {
    const totalSeconds = Math.max(0, Math.floor(timerState.seconds));
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
  }, [timerState.seconds]);

  // 是否紧急 (少于30秒)
  const urgent = timerState.seconds < 30;

  // 位置: 屏幕顶部中央（与经典 UI 一致）
  const containerStyle: React.CSSProperties = useMemo(
    () => ({
      position: "absolute",
      left: (screenWidth - 140) / 2,
      top: 0,
      ...glassEffect.standard,
      borderRadius: `0 0 ${borderRadius.lg} ${borderRadius.lg}`,
      padding: `${spacing.sm}px ${spacing.lg}px`,
      pointerEvents: "none",
      animation: urgent ? "pulse 1s infinite" : undefined,
    }),
    [screenWidth, urgent]
  );

  // 不显示：不在运行或隐藏状态
  if (!timerState.isRunning || timerState.isHidden) return null;

  return (
    <>
      <div style={containerStyle}>
        <div
          style={{
            fontSize: typography.fontSize.xs,
            color: modernColors.text.muted,
            textAlign: "center",
            marginBottom: 2,
          }}
        >
          剩余时间
        </div>
        <div
          style={{
            fontSize: typography.fontSize.xl,
            fontWeight: typography.fontWeight.bold,
            color: urgent ? modernColors.stats.hp : modernColors.text.primary,
            textAlign: "center",
            fontFamily: "monospace",
            letterSpacing: 2,
            textShadow: urgent ? "0 0 10px rgba(255, 100, 100, 0.5)" : undefined,
          }}
        >
          ⏱️ {formattedTime}
        </div>
      </div>

      {urgent && (
        <style>
          {`
            @keyframes pulse {
              0%, 100% { transform: scale(1); }
              50% { transform: scale(1.02); }
            }
          `}
        </style>
      )}
    </>
  );
};
