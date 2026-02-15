/**
 * Modern SelectionUI - 选项选择框
 * 位置与经典UI一致
 */

import type { SelectionGuiState } from "@miu2d/engine/gui/ui-types";
import type React from "react";
import { useMemo, useState } from "react";
import { borderRadius, glassEffect, modernColors, spacing, typography } from "./theme";

interface SelectionUIProps {
  state: SelectionGuiState;
  screenWidth: number;
  screenHeight: number;
  onSelect: (index: number) => void;
}

export const SelectionUI: React.FC<SelectionUIProps> = ({
  state,
  screenWidth,
  screenHeight,
  onSelect,
}) => {
  const { isVisible, message, options, hoveredIndex: stateHoveredIndex } = state;
  const [hoveredIndex, setHoveredIndex] = useState<number>(-1);
  const panelWidth = 320;
  const optionHeight = 44;
  const padding = spacing.lg;
  const panelHeight = options.length * optionHeight + padding * 2 + 40; // +40 for header

  // 位置: 屏幕中央
  const panelStyle: React.CSSProperties = useMemo(
    () => ({
      position: "absolute",
      left: (screenWidth - panelWidth) / 2,
      top: (screenHeight - panelHeight) / 2,
      width: panelWidth,
      ...glassEffect.dark,
      borderRadius: borderRadius.lg,
      pointerEvents: "auto",
    }),
    [screenWidth, screenHeight, panelHeight]
  );

  if (!isVisible || options.length === 0) return null;

  return (
    <div style={panelStyle} onClick={(e) => e.stopPropagation()}>
      {/* 标题/消息 */}
      <div
        style={{
          padding: `${spacing.md}px ${spacing.lg}px`,
          borderBottom: `1px solid ${modernColors.border.glass}`,
          background: "rgba(0, 0, 0, 0.2)",
          borderTopLeftRadius: borderRadius.lg,
          borderTopRightRadius: borderRadius.lg,
        }}
      >
        <span
          style={{
            fontSize: typography.fontSize.md,
            fontWeight: typography.fontWeight.semibold,
            color: modernColors.text.primary,
          }}
        >
          {message || "请选择"}
        </span>
      </div>

      {/* 选项列表 */}
      <div style={{ padding: padding }}>
        {options.map((option, idx) => {
          const isHovered = hoveredIndex === idx;
          const isEnabled = option.enabled;

          return (
            <div
              key={`option-${idx}`}
              onClick={() => isEnabled && onSelect(idx)}
              onMouseEnter={() => isEnabled && setHoveredIndex(idx)}
              onMouseLeave={() => setHoveredIndex(-1)}
              style={{
                height: optionHeight,
                display: "flex",
                alignItems: "center",
                padding: `0 ${spacing.md}px`,
                marginBottom: idx < options.length - 1 ? spacing.sm : 0,
                background: isHovered ? "rgba(255, 255, 255, 0.15)" : "rgba(0, 0, 0, 0.2)",
                border: `1px solid ${
                  isHovered ? modernColors.border.glassLight : modernColors.border.glass
                }`,
                borderRadius: borderRadius.md,
                cursor: isEnabled ? "pointer" : "not-allowed",
                transition: "all 0.15s ease",
                opacity: isEnabled ? 1 : 0.5,
              }}
            >
              {/* 序号 */}
              <span
                style={{
                  width: 24,
                  height: 24,
                  background: isHovered ? modernColors.primary : "rgba(255, 255, 255, 0.1)",
                  borderRadius: "50%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: typography.fontSize.sm,
                  fontWeight: typography.fontWeight.semibold,
                  color: isHovered ? "#000" : modernColors.text.secondary,
                  marginRight: spacing.md,
                  transition: "all 0.15s ease",
                }}
              >
                {idx + 1}
              </span>

              {/* 选项文本 */}
              <span
                style={{
                  flex: 1,
                  fontSize: typography.fontSize.md,
                  color: isHovered ? modernColors.text.primary : modernColors.text.secondary,
                  transition: "color 0.15s ease",
                }}
              >
                {option.text}
              </span>

              {/* 箭头指示 */}
              {isHovered && (
                <span
                  style={{
                    fontSize: typography.fontSize.sm,
                    color: modernColors.primary,
                  }}
                >
                  →
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
