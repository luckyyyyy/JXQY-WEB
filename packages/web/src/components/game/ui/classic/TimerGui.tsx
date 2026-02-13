/**
 * TimerGui - 计时器 UI 组件
 * 基于JxqyHD/Engine/Gui/TimerGui.cs
 *
 * 使用 ASF 图片作为背景，显示剩余时间
 * 配置来自 UI_Settings.ini [Timer] 和 [Timer_Text]
 */

import type { TimerState } from "@miu2d/engine/core";
import type React from "react";
import { useMemo } from "react";
import { useAsfImage } from "./hooks";

// UI_Settings.ini 配置
// [Timer]
// Image=asf\ui\timer\window.asf
// LeftAdjust=103
// TopAdjust=0
// [Timer_Text]
// Left=74
// Top=44
// Width=120
// Height=22
// CharSpace=1
// LineSpace=0
// Color=255,0,0,204

const TIMER_CONFIG = {
  image: "asf/ui/timer/window.asf",
  leftAdjust: 103,
  topAdjust: 0,
  text: {
    left: 74,
    top: 44,
    width: 120,
    height: 22,
    charSpace: 1,
    lineSpace: 0,
    color: "rgba(255, 0, 0, 0.8)", // 255,0,0,204
  },
};

interface TimerGuiProps {
  timerState: TimerState;
  screenWidth?: number;
}

/**
 * 计时器 UI
 * Position = new Vector2(Globals.WindowWidth/2f + LeftAdjust, TopAdjust)
 */
export const TimerGui: React.FC<TimerGuiProps> = ({ timerState, screenWidth = 800 }) => {
  // 加载背景图片
  const panelImage = useAsfImage(TIMER_CONFIG.image, 0);

  // 计算面板位置
  // Position = new Vector2(Globals.WindowWidth/2f + LeftAdjust, TopAdjust)
  const panelStyle = useMemo(() => {
    const panelWidth = panelImage.width || 200;
    const panelHeight = panelImage.height || 80;

    return {
      position: "absolute" as const,
      left: Math.floor(screenWidth / 2) + TIMER_CONFIG.leftAdjust,
      top: TIMER_CONFIG.topAdjust,
      width: panelWidth,
      height: panelHeight,
      zIndex: 100,
      pointerEvents: "none" as const,
    };
  }, [panelImage.width, panelImage.height, screenWidth]);

  // 不显示的情况：未运行或已隐藏
  if (!timerState.isRunning || timerState.isHidden) {
    return null;
  }

  // 格式化时间: " 00分 00秒" 格式
  // string.Format("{0: 00;-00}", _seconds / 60) + "分" + string.Format("{0: 00;-00}", _seconds % 60) + "秒"
  const minutes = Math.floor(timerState.seconds / 60);
  const seconds = timerState.seconds % 60;
  const timeText = `${minutes.toString().padStart(2, "0")}分${seconds.toString().padStart(2, "0")}秒`;

  return (
    <div style={panelStyle}>
      {/* ASF 背景图片 */}
      {panelImage.dataUrl && (
        <img
          src={panelImage.dataUrl}
          alt="Timer"
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: panelImage.width,
            height: panelImage.height,
            imageRendering: "pixelated",
            pointerEvents: "none",
          }}
          draggable={false}
        />
      )}

      {/* 时间文字 */}
      <div
        style={{
          position: "absolute",
          left: TIMER_CONFIG.text.left,
          top: TIMER_CONFIG.text.top,
          width: TIMER_CONFIG.text.width,
          height: TIMER_CONFIG.text.height,
          color: TIMER_CONFIG.text.color,
          fontSize: "12px",
          fontFamily: "'SimSun', 'Microsoft YaHei', serif",
          letterSpacing: `${TIMER_CONFIG.text.charSpace}px`,
          lineHeight: `${TIMER_CONFIG.text.height}px`,
          display: "flex",
          alignItems: "center",
        }}
      >
        {timeText}
      </div>
    </div>
  );
};
