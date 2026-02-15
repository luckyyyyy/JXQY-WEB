/**
 * Modern MemoPanel - 任务面板
 * 位置与经典UI一致
 */
import type React from "react";
import { useCallback, useMemo, useState } from "react";
import { PanelHeader } from "./components";
import { borderRadius, glassEffect, modernColors, spacing, typography } from "./theme";

interface MemoPanelProps {
  isVisible: boolean;
  memos: string[]; // 任务记录列表，与经典UI一致
  screenWidth: number;
  onClose: () => void;
}

export const MemoPanel: React.FC<MemoPanelProps> = ({ isVisible, memos, screenWidth, onClose }) => {
  const [scrollOffset, setScrollOffset] = useState(0);
  const panelWidth = 300;
  const panelHeight = 350;
  const linesPerPage = 12;

  // 位置: 屏幕中央偏右 (与经典UI一致)
  const panelStyle: React.CSSProperties = useMemo(
    () => ({
      position: "absolute",
      left: screenWidth / 2,
      top: 30,
      width: panelWidth,
      height: panelHeight,
      display: "flex",
      flexDirection: "column",
      ...glassEffect.standard,
      borderRadius: borderRadius.lg,
      pointerEvents: "auto",
    }),
    [screenWidth]
  );

  const maxScrollOffset = Math.max(0, memos.length - linesPerPage);

  // 当前显示的任务
  const visibleMemos = useMemo(() => {
    return memos.slice(scrollOffset, scrollOffset + linesPerPage);
  }, [memos, scrollOffset]);

  // 滚动处理
  const handleScroll = useCallback(
    (delta: number) => {
      setScrollOffset((prev) => Math.max(0, Math.min(maxScrollOffset, prev + delta)));
    },
    [maxScrollOffset]
  );

  if (!isVisible) return null;

  return (
    <div
      style={panelStyle}
      onClick={(e) => e.stopPropagation()}
      onWheel={(e) => handleScroll(e.deltaY > 0 ? 1 : -1)}
    >
      <PanelHeader title="任务" onClose={onClose} />

      <div style={{ flex: 1, padding: spacing.md, overflowY: "auto" }}>
        {memos.length === 0 ? (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              height: "100%",
              gap: spacing.md,
              color: modernColors.text.muted,
            }}
          >
            <span style={{ fontSize: 48 }}>📋</span>
            <span style={{ fontSize: typography.fontSize.sm }}>暂无任务记录</span>
          </div>
        ) : (
          visibleMemos.map((memo, idx) => (
            <div
              key={`memo-${scrollOffset + idx}-${memo.slice(0, 20)}`}
              style={{
                fontSize: typography.fontSize.sm,
                color: modernColors.text.secondary,
                lineHeight: 1.8,
                padding: `${spacing.sm}px 0`,
              }}
            >
              {memo}
            </div>
          ))
        )}
      </div>

      {/* 滚动指示 */}
      {maxScrollOffset > 0 && (
        <div
          style={{
            padding: spacing.sm,
            textAlign: "center",
            fontSize: typography.fontSize.xs,
            color: modernColors.text.muted,
            borderTop: `1px solid ${modernColors.border.glass}`,
          }}
        >
          {scrollOffset + 1} - {Math.min(scrollOffset + linesPerPage, memos.length)} /{" "}
          {memos.length}
        </div>
      )}
    </div>
  );
};
