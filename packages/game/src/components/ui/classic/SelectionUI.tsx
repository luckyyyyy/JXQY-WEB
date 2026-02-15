/**
 * Selection UI Component - based on JxqyHD Engine/Gui/SelectionGui.cs
 * Displays multiple choice options with message text
 *
 * shows message + options centered on screen
 * with dark overlay, NO panel background (just black semi-transparent)
 * Message in gold color, options in green (yellow on hover)
 */

import type { SelectionGuiState } from "@miu2d/engine/gui/ui-types";
import type React from "react";
import { useCallback, useMemo, useState } from "react";

interface SelectionUIProps {
  state: SelectionGuiState;
  screenWidth: number;
  screenHeight: number;
  onSelect: (index: number) => void;
}

// 颜色配置中的颜色
const COLORS = {
  normal: "rgba(0, 255, 0, 0.8)", // 绿色 - 普通状态
  hover: "rgba(255, 255, 0, 0.8)", // 黄色 - 悬停状态
  message: "rgba(255, 215, 0, 0.8)", // 金色 - 消息文本
  overlay: "rgba(0, 0, 0, 0.8)", // 黑色半透明遮罩
};

// 布局配置
const LAYOUT = {
  lineHeight: 30,
  lineGap: 5,
  fontSize: 14,
};

/**
 * 单个选项组件
 */
interface SelectionLineProps {
  text: string;
  isEnabled: boolean;
  isHovered: boolean;
  onSelect: () => void;
  onHover: () => void;
  onLeave: () => void;
  style?: React.CSSProperties;
}

const SelectionLine: React.FC<SelectionLineProps> = ({
  text,
  isEnabled,
  isHovered,
  onSelect,
  onHover,
  onLeave,
  style,
}) => {
  if (!isEnabled) return null;

  return (
    <div
      style={{
        textAlign: "center",
        fontSize: LAYOUT.fontSize,
        fontFamily: "SimSun, serif",
        color: isHovered ? COLORS.hover : COLORS.normal,
        cursor: "pointer",
        lineHeight: `${LAYOUT.lineHeight}px`,
        transition: "color 0.15s ease",
        userSelect: "none",
        ...style,
      }}
      onClick={onSelect}
      onMouseEnter={onHover}
      onMouseLeave={onLeave}
    >
      {text}
    </div>
  );
};

export const SelectionUI: React.FC<SelectionUIProps> = ({
  state,
  screenWidth,
  screenHeight,
  onSelect,
}) => {
  const [hoveredIndex, setHoveredIndex] = useState<number>(-1);

  const handleSelect = useCallback(
    (index: number) => {
      const option = state.options[index];
      if (option?.enabled) {
        onSelect(index);
      }
    },
    [state.options, onSelect]
  );

  // 计算可见选项
  const visibleOptions = useMemo(() => {
    return state.options.map((opt, index) => ({ ...opt, index })).filter((opt) => opt.enabled);
  }, [state.options]);

  // 计算内容起始Y位置 - 原版风格，从中间向上下扩展
  // var startY = (Globals.WindowHeight - (selections.Count + 1) * (lineHeight + lineGap)) / 2;
  const totalLines = visibleOptions.length + (state.message ? 1 : 0);
  const totalHeight = totalLines * (LAYOUT.lineHeight + LAYOUT.lineGap);
  const startY = (screenHeight - totalHeight) / 2;

  if (!state.isVisible) return null;

  return (
    <div
      style={{
        position: "absolute",
        left: 0,
        top: 0,
        width: screenWidth,
        height: screenHeight,
        backgroundColor: COLORS.overlay,
        pointerEvents: "auto",
        zIndex: 100,
      }}
    >
      {/* 消息文本（如果有） - 金色，居中 */}
      {state.message && (
        <div
          style={{
            position: "absolute",
            left: 0,
            top: startY,
            width: screenWidth,
            textAlign: "center",
            fontSize: LAYOUT.fontSize,
            fontFamily: "SimSun, serif",
            color: COLORS.message,
            lineHeight: `${LAYOUT.lineHeight}px`,
            userSelect: "none",
          }}
        >
          {state.message}
        </div>
      )}

      {/* 选项列表 - 绿色，居中 */}
      {visibleOptions.map(({ index, text, enabled }, idx) => (
        <SelectionLine
          key={index}
          text={text}
          isEnabled={enabled}
          isHovered={hoveredIndex === index || state.selectedIndex === index}
          onSelect={() => handleSelect(index)}
          onHover={() => setHoveredIndex(index)}
          onLeave={() => setHoveredIndex(-1)}
          style={{
            position: "absolute",
            left: 0,
            top:
              startY +
              (state.message ? 1 : 0) * (LAYOUT.lineHeight + LAYOUT.lineGap) +
              idx * (LAYOUT.lineHeight + LAYOUT.lineGap),
            width: screenWidth,
          }}
        />
      ))}
    </div>
  );
};
