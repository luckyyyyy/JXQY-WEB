/**
 * Modern SelectionMultipleUI - 多选选择框
 * 位置与经典UI一致
 */
import type React from "react";
import { useCallback, useMemo, useState } from "react";
import { GlassButton } from "./components";
import { borderRadius, glassEffect, modernColors, spacing, typography } from "./theme";

interface SelectionMultipleUIProps {
  isVisible: boolean;
  title: string;
  options: string[];
  screenWidth: number;
  screenHeight: number;
  onConfirm?: (selectedIndices: number[]) => void;
  onCancel?: () => void;
}

export const SelectionMultipleUI: React.FC<SelectionMultipleUIProps> = ({
  isVisible,
  title,
  options,
  screenWidth,
  screenHeight,
  onConfirm,
  onCancel,
}) => {
  const [selectedIndices, setSelectedIndices] = useState<Set<number>>(new Set());
  const [hoveredIndex, setHoveredIndex] = useState<number>(-1);

  const panelWidth = 360;
  const optionHeight = 40;
  const maxVisibleOptions = 8;
  const visibleOptions = Math.min(options.length, maxVisibleOptions);
  const padding = spacing.lg;
  const panelHeight = visibleOptions * optionHeight + padding * 2 + 100; // +100 for header and footer

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
      display: "flex",
      flexDirection: "column",
    }),
    [screenWidth, screenHeight, panelHeight]
  );

  const toggleSelection = useCallback((index: number) => {
    setSelectedIndices((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(index)) {
        newSet.delete(index);
      } else {
        newSet.add(index);
      }
      return newSet;
    });
  }, []);

  const handleConfirm = useCallback(() => {
    onConfirm?.(Array.from(selectedIndices).sort((a, b) => a - b));
  }, [selectedIndices, onConfirm]);

  if (!isVisible || options.length === 0) return null;

  return (
    <div style={panelStyle} onClick={(e) => e.stopPropagation()}>
      {/* 标题 */}
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
          {title}
        </span>
        <span
          style={{
            fontSize: typography.fontSize.sm,
            color: modernColors.text.muted,
            marginLeft: spacing.md,
          }}
        >
          (已选 {selectedIndices.size} 项)
        </span>
      </div>

      {/* 选项列表 */}
      <div
        style={{
          flex: 1,
          padding: padding,
          overflowY: options.length > maxVisibleOptions ? "auto" : "hidden",
          maxHeight: maxVisibleOptions * optionHeight + padding,
        }}
      >
        {options.map((option, idx) => {
          const isSelected = selectedIndices.has(idx);
          const isHovered = hoveredIndex === idx;

          return (
            <div
              key={`option-${idx}`}
              onClick={() => toggleSelection(idx)}
              onMouseEnter={() => setHoveredIndex(idx)}
              onMouseLeave={() => setHoveredIndex(-1)}
              style={{
                height: optionHeight,
                display: "flex",
                alignItems: "center",
                padding: `0 ${spacing.md}px`,
                marginBottom: idx < options.length - 1 ? spacing.xs : 0,
                background: isSelected
                  ? "rgba(100, 200, 255, 0.2)"
                  : isHovered
                    ? "rgba(255, 255, 255, 0.1)"
                    : "rgba(0, 0, 0, 0.2)",
                border: `1px solid ${
                  isSelected
                    ? modernColors.primary
                    : isHovered
                      ? modernColors.border.glassLight
                      : modernColors.border.glass
                }`,
                borderRadius: borderRadius.md,
                cursor: "pointer",
                transition: "all 0.15s ease",
              }}
            >
              {/* 复选框 */}
              <div
                style={{
                  width: 20,
                  height: 20,
                  border: `2px solid ${
                    isSelected ? modernColors.primary : modernColors.text.muted
                  }`,
                  borderRadius: borderRadius.sm,
                  marginRight: spacing.md,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  background: isSelected ? modernColors.primary : "transparent",
                  transition: "all 0.15s ease",
                }}
              >
                {isSelected && (
                  <span style={{ color: "#000", fontSize: 14, fontWeight: "bold" }}>✓</span>
                )}
              </div>

              {/* 选项文本 */}
              <span
                style={{
                  flex: 1,
                  fontSize: typography.fontSize.sm,
                  color: isSelected ? modernColors.text.primary : modernColors.text.secondary,
                  transition: "color 0.15s ease",
                }}
              >
                {option}
              </span>
            </div>
          );
        })}
      </div>

      {/* 底部按钮 */}
      <div
        style={{
          padding: spacing.md,
          borderTop: `1px solid ${modernColors.border.glass}`,
          background: "rgba(0, 0, 0, 0.2)",
          borderBottomLeftRadius: borderRadius.lg,
          borderBottomRightRadius: borderRadius.lg,
          display: "flex",
          justifyContent: "flex-end",
          gap: spacing.md,
        }}
      >
        <GlassButton onClick={onCancel}>取消</GlassButton>
        <GlassButton onClick={handleConfirm} primary>
          确定
        </GlassButton>
      </div>
    </div>
  );
};
