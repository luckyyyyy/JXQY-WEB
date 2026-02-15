/**
 * Modern UI Styles - 通用样式生成器
 */
import type React from "react";
import {
  borderRadius,
  glassEffect,
  modernColors,
  shadows,
  spacing,
  transitions,
  typography,
} from "./theme";

// ============= 面板样式 =============

export const panelStyles = {
  /** 基础面板样式 */
  base: (width: number, height: number): React.CSSProperties => ({
    width,
    height,
    ...glassEffect.standard,
    borderRadius: borderRadius.lg,
    overflow: "hidden",
    pointerEvents: "auto",
  }),

  /** 带标题的面板 */
  withHeader: (width: number, height: number): React.CSSProperties => ({
    ...panelStyles.base(width, height),
    display: "flex",
    flexDirection: "column",
  }),

  /** 面板头部 */
  header: (): React.CSSProperties => ({
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: `${spacing.sm}px ${spacing.md}px`,
    borderBottom: `1px solid ${modernColors.border.glass}`,
    background: "rgba(0, 0, 0, 0.2)",
  }),

  /** 面板标题 */
  title: (): React.CSSProperties => ({
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
    color: modernColors.text.primary,
    margin: 0,
  }),

  /** 面板内容区 */
  content: (padding = true): React.CSSProperties => ({
    flex: 1,
    padding: padding ? spacing.md : 0,
    overflow: "auto",
  }),

  /** 面板底部 */
  footer: (): React.CSSProperties => ({
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: `${spacing.sm}px ${spacing.md}px`,
    borderTop: `1px solid ${modernColors.border.glass}`,
    background: "rgba(0, 0, 0, 0.2)",
  }),
};

// ============= 按钮样式 =============

export const buttonStyles = {
  /** 基础按钮 */
  base: (): React.CSSProperties => ({
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    padding: `${spacing.sm}px ${spacing.md}px`,
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    color: modernColors.text.primary,
    background: modernColors.bg.glassLight,
    border: `1px solid ${modernColors.border.glass}`,
    borderRadius: borderRadius.md,
    cursor: "pointer",
    transition: transitions.fast,
    outline: "none",
    userSelect: "none",
  }),

  /** 主要按钮 */
  primary: (): React.CSSProperties => ({
    ...buttonStyles.base(),
    background: `linear-gradient(135deg, ${modernColors.primary}, rgba(102, 73, 212, 0.7))`,
    border: `1px solid ${modernColors.primary}`,
    boxShadow: shadows.glow(modernColors.primary),
  }),

  /** 次要按钮 */
  secondary: (): React.CSSProperties => ({
    ...buttonStyles.base(),
    background: modernColors.bg.glass,
  }),

  /** 危险按钮 */
  danger: (): React.CSSProperties => ({
    ...buttonStyles.base(),
    background: `linear-gradient(135deg, ${modernColors.danger}, rgba(245, 108, 108, 0.7))`,
    border: `1px solid ${modernColors.danger}`,
  }),

  /** 图标按钮 */
  icon: (): React.CSSProperties => ({
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    width: 28,
    height: 28,
    padding: 0,
    background: "transparent",
    border: "none",
    borderRadius: borderRadius.sm,
    cursor: "pointer",
    transition: transitions.fast,
    color: modernColors.text.secondary,
  }),

  /** 关闭按钮 */
  close: (): React.CSSProperties => ({
    ...buttonStyles.icon(),
    fontSize: 18,
    opacity: 0.7,
  }),
};

// ============= 槽位样式 =============

export const slotStyles = {
  /** 基础槽位 */
  base: (size: number): React.CSSProperties => ({
    width: size,
    height: size,
    background: "rgba(0, 0, 0, 0.3)",
    border: `1px solid ${modernColors.border.glass}`,
    borderRadius: borderRadius.md,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
    cursor: "pointer",
    transition: transitions.fast,
    overflow: "hidden",
  }),

  /** 空槽位 */
  empty: (size: number): React.CSSProperties => ({
    ...slotStyles.base(size),
    cursor: "default",
  }),

  /** 悬停状态 */
  hovered: (): React.CSSProperties => ({
    background: "rgba(255, 255, 255, 0.1)",
    borderColor: modernColors.border.glassLight,
    boxShadow: shadows.sm,
  }),

  /** 选中状态 */
  selected: (): React.CSSProperties => ({
    borderColor: modernColors.primary,
    boxShadow: shadows.glow(modernColors.primary),
  }),

  /** 拖拽状态 */
  dragging: (): React.CSSProperties => ({
    opacity: 0.5,
    transform: "scale(0.95)",
  }),

  /** 槽位图标 */
  icon: (): React.CSSProperties => ({
    maxWidth: "80%",
    maxHeight: "80%",
    objectFit: "contain",
    imageRendering: "pixelated" as const,
    pointerEvents: "none",
  }),

  /** 槽位数量标签 */
  count: (): React.CSSProperties => ({
    position: "absolute",
    bottom: 2,
    right: 4,
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.bold,
    color: modernColors.text.primary,
    textShadow: "0 1px 2px rgba(0,0,0,0.8)",
    pointerEvents: "none",
  }),

  /** 槽位等级标签 */
  level: (): React.CSSProperties => ({
    position: "absolute",
    top: 2,
    left: 4,
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.bold,
    color: modernColors.accent,
    textShadow: "0 1px 2px rgba(0,0,0,0.8)",
    pointerEvents: "none",
  }),

  /** 快捷键标签 */
  hotkey: (): React.CSSProperties => ({
    position: "absolute",
    bottom: 2,
    left: 4,
    fontSize: 9,
    color: modernColors.text.muted,
    textShadow: "0 1px 2px rgba(0,0,0,0.8)",
    pointerEvents: "none",
  }),

  /** 冷却遮罩 */
  cooldown: (percent: number): React.CSSProperties => ({
    position: "absolute",
    bottom: 0,
    left: 0,
    width: "100%",
    height: `${percent}%`,
    background: "rgba(0, 0, 0, 0.7)",
    pointerEvents: "none",
  }),
};

// ============= 进度条样式 =============

export const progressStyles = {
  /** 进度条容器 */
  container: (width: number, height: number): React.CSSProperties => ({
    width,
    height,
    background: "rgba(0, 0, 0, 0.4)",
    borderRadius: height / 2,
    overflow: "hidden",
    position: "relative",
  }),

  /** 进度条填充 */
  fill: (percent: number, color: string): React.CSSProperties => ({
    width: `${Math.min(100, Math.max(0, percent))}%`,
    height: "100%",
    background: `linear-gradient(90deg, ${color}, ${color}dd)`,
    borderRadius: "inherit",
    transition: "width 0.3s ease",
  }),

  /** 进度条文本 */
  text: (): React.CSSProperties => ({
    position: "absolute",
    top: "50%",
    left: "50%",
    transform: "translate(-50%, -50%)",
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.medium,
    color: modernColors.text.primary,
    textShadow: "0 1px 2px rgba(0,0,0,0.8)",
    whiteSpace: "nowrap",
  }),
};

// ============= 网格布局样式 =============

export const gridStyles = {
  /** 物品网格 */
  items: (columns: number, gap: number = spacing.sm): React.CSSProperties => ({
    display: "grid",
    gridTemplateColumns: `repeat(${columns}, 1fr)`,
    gap,
  }),

  /** 滚动容器 */
  scrollable: (maxHeight: number): React.CSSProperties => ({
    maxHeight,
    overflowY: "auto",
    overflowX: "hidden",
    paddingRight: spacing.sm,
  }),
};

// ============= 文本样式 =============

export const textStyles = {
  /** 标签文本 */
  label: (): React.CSSProperties => ({
    fontSize: typography.fontSize.sm,
    color: modernColors.text.secondary,
    marginBottom: spacing.xs,
  }),

  /** 值文本 */
  value: (): React.CSSProperties => ({
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.medium,
    color: modernColors.text.primary,
  }),

  /** 统计值 */
  stat: (color: string): React.CSSProperties => ({
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.semibold,
    color,
  }),

  /** 小号文本 */
  small: (): React.CSSProperties => ({
    fontSize: typography.fontSize.xs,
    color: modernColors.text.muted,
  }),

  /** 金钱文本 */
  money: (): React.CSSProperties => ({
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.semibold,
    color: modernColors.accent,
  }),
};

// ============= 列表样式 =============

export const listStyles = {
  /** 列表项 */
  item: (selected = false): React.CSSProperties => ({
    display: "flex",
    alignItems: "center",
    padding: `${spacing.sm}px ${spacing.md}px`,
    background: selected ? modernColors.bg.active : "transparent",
    borderRadius: borderRadius.sm,
    cursor: "pointer",
    transition: transitions.fast,
  }),

  /** 列表项文本 */
  itemText: (): React.CSSProperties => ({
    flex: 1,
    fontSize: typography.fontSize.sm,
    color: modernColors.text.primary,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  }),
};

// ============= 滚动条样式 (CSS-in-JS 不能直接设置伪元素，需要用 CSS) =============

export const scrollbarStyles = `
  .modern-scrollbar::-webkit-scrollbar {
    width: 6px;
  }
  .modern-scrollbar::-webkit-scrollbar-track {
    background: rgba(0, 0, 0, 0.2);
    border-radius: 3px;
  }
  .modern-scrollbar::-webkit-scrollbar-thumb {
    background: rgba(255, 255, 255, 0.2);
    border-radius: 3px;
  }
  .modern-scrollbar::-webkit-scrollbar-thumb:hover {
    background: rgba(255, 255, 255, 0.3);
  }
`;
