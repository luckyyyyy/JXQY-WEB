/**
 * Selection Multiple UI Component - based on JxqyHD Engine/Gui/SelectionMultipleGui.cs
 * 多选UI组件 - 允许玩家从多个选项中选择固定数量的项目
 *
 * C# Reference: SelectionMultipleGui.cs
 * - 全屏背景使用 ASF 资源
 * - 顶部显示消息文本（金色居中）
 * - 选项按行排列，每行 column 个项目
 * - 绿色普通、黄色悬停
 * - 选中项有黄色半透明背景
 * - 选够数量后自动关闭
 */
import type React from "react";
import { useCallback, useMemo, useState } from "react";
import type { MultiSelectionGuiState } from "@/engine/gui/types";
import { useAsfImage } from "./hooks";

interface SelectionMultipleUIProps {
  state: MultiSelectionGuiState;
  screenWidth: number;
  screenHeight: number;
  onToggleSelection: (index: number) => void;
}

// 颜色配置 - 对应 C# SelectionMultipleGui
const COLORS = {
  normal: "rgba(0, 255, 0, 0.8)", // 绿色 - 普通状态
  hover: "rgba(255, 255, 0, 0.8)", // 黄色 - 悬停状态
  message: "rgba(255, 215, 0, 0.8)", // 金色 - 消息文本
  selectedBg: "rgba(255, 255, 0, 0.2)", // 已选中背景
};

// 布局配置 - 对应 C# 常量
const LAYOUT = {
  fontSize: 12, // Globals.FontSize12
  lineGap: 5,
  rowGap: 10,
  itemXGap: 80,
  xMargin: 50,
  startY: 60,
};

// ASF 资源路径
const BACKGROUND_ASF = "asf/ui/option/background.asf";

export const SelectionMultipleUI: React.FC<SelectionMultipleUIProps> = ({
  state,
  screenWidth,
  screenHeight,
  onToggleSelection,
}) => {
  const [hoveredIndex, setHoveredIndex] = useState<number>(-1);

  // 加载背景 ASF 图片
  const backgroundImage = useAsfImage(BACKGROUND_ASF, 0);

  const handleClick = useCallback(
    (index: number) => {
      const option = state.options[index];
      if (option?.enabled) {
        onToggleSelection(index);
      }
    },
    [state.options, onToggleSelection],
  );

  // 过滤出可见的选项，保留原始索引
  const visibleOptions = useMemo(() => {
    return state.options
      .map((opt, index) => ({ ...opt, originalIndex: index }))
      .filter((opt) => opt.enabled);
  }, [state.options]);

  // 计算网格布局 - 按行排列，与 C# 一致
  const gridLayout = useMemo(() => {
    const columns = state.columns;
    const itemMaxWidth = Math.floor((screenWidth - 2 * LAYOUT.xMargin) / columns);

    // 计算所有选项的位置
    const positions: Array<{
      x: number;
      y: number;
      originalIndex: number;
      text: string;
    }> = [];

    // 消息文本后的起始Y
    let currentY = LAYOUT.startY + (state.message ? 30 : 0);

    // 按行排列
    for (let i = 0; i < visibleOptions.length; i += columns) {
      const rowHeight = 24; // 固定行高

      for (let j = 0; j < columns && i + j < visibleOptions.length; j++) {
        const opt = visibleOptions[i + j];
        const x = LAYOUT.xMargin + j * (itemMaxWidth + LAYOUT.itemXGap);
        positions.push({
          x,
          y: currentY,
          originalIndex: opt.originalIndex,
          text: opt.text,
        });
      }

      currentY += rowHeight + LAYOUT.rowGap;
    }

    // 计算总宽度并居中
    const totalWidth = columns * itemMaxWidth + (columns - 1) * LAYOUT.itemXGap;
    const offsetX = (screenWidth - totalWidth) / 2 - LAYOUT.xMargin;

    return positions.map((p) => ({ ...p, x: p.x + offsetX }));
  }, [state.columns, state.message, visibleOptions, screenWidth]);

  if (!state.isVisible) return null;

  return (
    <div
      style={{
        position: "absolute",
        left: 0,
        top: 0,
        width: screenWidth,
        height: screenHeight,
        pointerEvents: "auto",
        zIndex: 100,
      }}
    >
      {/* 全屏背景 - 使用 ASF 图片 */}
      {backgroundImage.dataUrl ? (
        <img
          src={backgroundImage.dataUrl}
          alt="selection background"
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            width: screenWidth,
            height: screenHeight,
            objectFit: "cover",
            imageRendering: "pixelated",
            pointerEvents: "none",
          }}
        />
      ) : (
        // 加载中或失败时使用黑色遮罩作为后备
        <div
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            width: screenWidth,
            height: screenHeight,
            backgroundColor: "rgba(0, 0, 0, 0.8)",
            pointerEvents: "none",
          }}
        />
      )}

      {/* 消息文本 - 金色居中 */}
      {state.message && (
        <div
          style={{
            position: "absolute",
            left: 0,
            top: LAYOUT.startY,
            width: screenWidth,
            textAlign: "center",
            fontSize: LAYOUT.fontSize,
            fontFamily: "SimSun, serif",
            color: COLORS.message,
            lineHeight: "24px",
            userSelect: "none",
          }}
        >
          {state.message}
          <span
            style={{
              marginLeft: 16,
              fontSize: 11,
              color: "rgba(255, 255, 255, 0.6)",
            }}
          >
            (请选择 {state.selectionCount} 项)
          </span>
        </div>
      )}

      {/* 选项网格 - 按行排列 */}
      {gridLayout.map(({ x, y, originalIndex, text }) => {
        const isSelected = state.selectedIndices.includes(originalIndex);
        const isHovered = hoveredIndex === originalIndex;

        return (
          <div
            key={originalIndex}
            style={{
              position: "absolute",
              left: x,
              top: y,
              fontSize: LAYOUT.fontSize,
              fontFamily: "SimSun, serif",
              color: isHovered || isSelected ? COLORS.hover : COLORS.normal,
              backgroundColor: isSelected ? COLORS.selectedBg : "transparent",
              cursor: "pointer",
              lineHeight: "24px",
              padding: "2px 8px",
              transition: "color 0.1s ease",
              userSelect: "none",
            }}
            onClick={() => handleClick(originalIndex)}
            onMouseEnter={() => setHoveredIndex(originalIndex)}
            onMouseLeave={() => setHoveredIndex(-1)}
          >
            {text}
          </div>
        );
      })}

      {/* 已选择数量提示 */}
      <div
        style={{
          position: "absolute",
          left: 0,
          bottom: 40,
          width: screenWidth,
          textAlign: "center",
          fontSize: 11,
          fontFamily: "SimSun, serif",
          color: "rgba(255, 255, 255, 0.5)",
          userSelect: "none",
        }}
      >
        已选择 {state.selectedIndices.length} / {state.selectionCount}
      </div>
    </div>
  );
};
