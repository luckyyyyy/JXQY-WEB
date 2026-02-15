/**
 * Modern UI 通用基础组件
 */
import type React from "react";
import { useCallback, useState } from "react";
import {
  borderRadius,
  glassEffect,
  modernColors,
  shadows,
  spacing,
  transitions,
  typography,
} from "./theme";

// ============= GlassPanel - 毛玻璃面板 =============

export interface GlassPanelProps {
  children: React.ReactNode;
  style?: React.CSSProperties;
  className?: string;
  variant?: "standard" | "dark" | "light" | "glow";
  onClick?: (e: React.MouseEvent) => void;
}

export const GlassPanel: React.FC<GlassPanelProps> = ({
  children,
  style,
  className,
  variant = "standard",
  onClick,
}) => {
  const glassStyle = glassEffect[variant];

  return (
    <div
      className={className}
      style={{
        ...glassStyle,
        borderRadius: borderRadius.lg,
        overflow: "hidden",
        ...style,
      }}
      onClick={onClick}
    >
      {children}
    </div>
  );
};

// ============= PanelHeader - 面板头部 =============

export interface PanelHeaderProps {
  title: string;
  onClose?: () => void;
  extra?: React.ReactNode;
}

export const PanelHeader: React.FC<PanelHeaderProps> = ({ title, onClose, extra }) => {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: `${spacing.sm}px ${spacing.md}px`,
        borderBottom: `1px solid ${modernColors.border.glass}`,
        background: "rgba(0, 0, 0, 0.2)",
      }}
    >
      <h3
        style={{
          fontSize: typography.fontSize.lg,
          fontWeight: typography.fontWeight.semibold,
          color: modernColors.text.primary,
          margin: 0,
        }}
      >
        {title}
      </h3>
      <div style={{ display: "flex", alignItems: "center", gap: spacing.sm }}>
        {extra}
        {onClose && <CloseButton onClick={onClose} />}
      </div>
    </div>
  );
};

// ============= CloseButton - 关闭按钮 =============

export interface CloseButtonProps {
  onClick: () => void;
  size?: number;
}

export const CloseButton: React.FC<CloseButtonProps> = ({ onClick, size = 24 }) => {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <button
      style={{
        width: size,
        height: size,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: isHovered ? "rgba(255, 255, 255, 0.1)" : "transparent",
        border: "none",
        borderRadius: borderRadius.sm,
        cursor: "pointer",
        color: modernColors.text.secondary,
        fontSize: size * 0.7,
        transition: transitions.fast,
        padding: 0,
      }}
      onClick={onClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      ✕
    </button>
  );
};

// ============= GlassButton - 毛玻璃按钮 =============

export interface GlassButtonProps {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: "default" | "primary" | "danger";
  primary?: boolean; // 快捷属性
  disabled?: boolean;
  style?: React.CSSProperties;
}

export const GlassButton: React.FC<GlassButtonProps> = ({
  children,
  onClick,
  variant = "default",
  primary = false,
  disabled = false,
  style,
}) => {
  const [isHovered, setIsHovered] = useState(false);
  const [isPressed, setIsPressed] = useState(false);

  // primary 快捷属性优先
  const effectiveVariant = primary ? "primary" : variant;

  const getBackground = () => {
    if (disabled) return "rgba(100, 100, 100, 0.3)";
    if (effectiveVariant === "primary") {
      return isPressed
        ? `linear-gradient(135deg, rgba(82, 53, 192, 0.9), rgba(82, 53, 192, 0.7))`
        : `linear-gradient(135deg, ${modernColors.primary}, rgba(102, 73, 212, 0.7))`;
    }
    if (effectiveVariant === "danger") {
      return isPressed
        ? `linear-gradient(135deg, rgba(225, 88, 88, 0.9), rgba(225, 88, 88, 0.7))`
        : `linear-gradient(135deg, ${modernColors.danger}, rgba(245, 108, 108, 0.7))`;
    }
    return isHovered ? modernColors.bg.hover : modernColors.bg.glassLight;
  };

  return (
    <button
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        padding: `${spacing.sm}px ${spacing.lg}px`,
        fontSize: typography.fontSize.sm,
        fontWeight: typography.fontWeight.medium,
        color: disabled ? modernColors.text.muted : modernColors.text.primary,
        background: getBackground(),
        border: `1px solid ${
          effectiveVariant === "primary"
            ? modernColors.primary
            : effectiveVariant === "danger"
              ? modernColors.danger
              : modernColors.border.glass
        }`,
        borderRadius: borderRadius.md,
        cursor: disabled ? "not-allowed" : "pointer",
        transition: transitions.fast,
        outline: "none",
        userSelect: "none",
        boxShadow: isHovered && !disabled ? shadows.sm : "none",
        transform: isPressed ? "scale(0.98)" : "scale(1)",
        ...style,
      }}
      onClick={disabled ? undefined : onClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => {
        setIsHovered(false);
        setIsPressed(false);
      }}
      onMouseDown={() => setIsPressed(true)}
      onMouseUp={() => setIsPressed(false)}
      disabled={disabled}
    >
      {children}
    </button>
  );
};

// ============= ProgressBar - 进度条 =============

export interface ProgressBarProps {
  value: number;
  max: number;
  color?: string;
  height?: number;
  showText?: boolean;
  textFormat?: (value: number, max: number) => string;
  style?: React.CSSProperties;
}

export const ProgressBar: React.FC<ProgressBarProps> = ({
  value,
  max,
  color = modernColors.stats.life,
  height = 16,
  showText = true,
  textFormat,
  style,
}) => {
  const percent = max > 0 ? (value / max) * 100 : 0;
  const text = textFormat ? textFormat(value, max) : `${value}/${max}`;

  return (
    <div
      style={{
        width: "100%",
        height,
        background: "rgba(0, 0, 0, 0.4)",
        borderRadius: height / 2,
        overflow: "hidden",
        position: "relative",
        ...style,
      }}
    >
      <div
        style={{
          width: `${Math.min(100, Math.max(0, percent))}%`,
          height: "100%",
          background: `linear-gradient(90deg, ${color}, ${color}dd)`,
          borderRadius: "inherit",
          transition: "width 0.3s ease",
        }}
      />
      {showText && (
        <span
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            fontSize: height > 14 ? typography.fontSize.xs : 9,
            fontWeight: typography.fontWeight.medium,
            color: modernColors.text.primary,
            textShadow: "0 1px 2px rgba(0,0,0,0.8)",
            whiteSpace: "nowrap",
          }}
        >
          {text}
        </span>
      )}
    </div>
  );
};

// ============= ItemSlot - 物品槽位 =============

export interface ItemSlotProps {
  size?: number;
  iconSrc?: string | null;
  count?: number;
  level?: number;
  hotkey?: string;
  cooldownPercent?: number;
  selected?: boolean;
  empty?: boolean;
  onClick?: () => void;
  onRightClick?: () => void;
  onMouseEnter?: (e: React.MouseEvent) => void;
  onMouseLeave?: () => void;
  onDragStart?: (e: React.DragEvent) => void;
  onDragOver?: (e: React.DragEvent) => void;
  onDrop?: (e: React.DragEvent) => void;
  draggable?: boolean;
  style?: React.CSSProperties;
  children?: React.ReactNode;
}

export const ItemSlot: React.FC<ItemSlotProps> = ({
  size = 44,
  iconSrc,
  count,
  level,
  hotkey,
  cooldownPercent,
  selected = false,
  empty = false,
  onClick,
  onRightClick,
  onMouseEnter,
  onMouseLeave,
  onDragStart,
  onDragOver,
  onDrop,
  draggable = false,
  style,
  children,
}) => {
  const [isHovered, setIsHovered] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const handleContextMenu = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      onRightClick?.();
    },
    [onRightClick]
  );

  return (
    <div
      style={{
        width: size,
        height: size,
        background: isHovered ? "rgba(255, 255, 255, 0.1)" : "rgba(0, 0, 0, 0.3)",
        border: `1px solid ${
          selected
            ? modernColors.primary
            : isHovered
              ? modernColors.border.glassLight
              : modernColors.border.glass
        }`,
        borderRadius: borderRadius.md,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        position: "relative",
        cursor: empty ? "default" : "pointer",
        transition: transitions.fast,
        overflow: "hidden",
        opacity: isDragging ? 0.5 : 1,
        transform: isDragging ? "scale(0.95)" : "scale(1)",
        boxShadow: selected ? shadows.glow(modernColors.primary) : "none",
        ...style,
      }}
      onClick={onClick}
      onContextMenu={handleContextMenu}
      onMouseEnter={(e) => {
        setIsHovered(true);
        onMouseEnter?.(e);
      }}
      onMouseLeave={() => {
        setIsHovered(false);
        onMouseLeave?.();
      }}
      draggable={draggable && !empty}
      onDragStart={(e) => {
        setIsDragging(true);
        onDragStart?.(e);
      }}
      onDragEnd={() => setIsDragging(false)}
      onDragOver={onDragOver}
      onDrop={onDrop}
    >
      {/* 图标 */}
      {iconSrc && (
        <img
          src={iconSrc}
          alt=""
          style={{
            maxWidth: "80%",
            maxHeight: "80%",
            objectFit: "contain",
            imageRendering: "pixelated",
            pointerEvents: "none",
          }}
          draggable={false}
        />
      )}

      {/* 自定义内容 */}
      {children}

      {/* 数量 */}
      {count !== undefined && count > 1 && (
        <span
          style={{
            position: "absolute",
            bottom: 2,
            right: 4,
            fontSize: typography.fontSize.xs,
            fontWeight: typography.fontWeight.bold,
            color: modernColors.text.primary,
            textShadow: "0 1px 2px rgba(0,0,0,0.8)",
            pointerEvents: "none",
          }}
        >
          {count}
        </span>
      )}

      {/* 等级 */}
      {level !== undefined && level > 0 && (
        <span
          style={{
            position: "absolute",
            top: 2,
            right: 4,
            fontSize: 9,
            fontWeight: typography.fontWeight.bold,
            color: modernColors.accent,
            textShadow: "0 1px 2px rgba(0,0,0,0.8)",
            pointerEvents: "none",
          }}
        >
          Lv.{level}
        </span>
      )}

      {/* 快捷键 */}
      {hotkey && (
        <span
          style={{
            position: "absolute",
            bottom: 2,
            left: 4,
            fontSize: 9,
            color: modernColors.text.muted,
            textShadow: "0 1px 2px rgba(0,0,0,0.8)",
            pointerEvents: "none",
          }}
        >
          {hotkey}
        </span>
      )}

      {/* 冷却遮罩 */}
      {cooldownPercent !== undefined && cooldownPercent > 0 && (
        <div
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            width: "100%",
            height: `${cooldownPercent}%`,
            background: "rgba(0, 0, 0, 0.7)",
            pointerEvents: "none",
          }}
        />
      )}
    </div>
  );
};

// ============= Divider - 分隔线 =============

export interface DividerProps {
  style?: React.CSSProperties;
}

export const Divider: React.FC<DividerProps> = ({ style }) => (
  <div
    style={{
      height: 1,
      background: modernColors.border.glass,
      margin: `${spacing.sm}px 0`,
      ...style,
    }}
  />
);

// ============= StatRow - 属性行 =============

export interface StatRowProps {
  label: string;
  value: string | number;
  color?: string;
  style?: React.CSSProperties;
}

export const StatRow: React.FC<StatRowProps> = ({
  label,
  value,
  color = modernColors.text.primary,
  style,
}) => (
  <div
    style={{
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      padding: `${spacing.xs}px 0`,
      ...style,
    }}
  >
    <span
      style={{
        fontSize: typography.fontSize.sm,
        color: modernColors.text.secondary,
      }}
    >
      {label}
    </span>
    <span
      style={{
        fontSize: typography.fontSize.sm,
        fontWeight: typography.fontWeight.medium,
        color,
      }}
    >
      {value}
    </span>
  </div>
);

// ============= ScrollArea - 滚动区域 =============

export interface ScrollAreaProps {
  children: React.ReactNode;
  maxHeight: number;
  style?: React.CSSProperties;
  onWheel?: (e: React.WheelEvent) => void;
}

export const ScrollArea: React.FC<ScrollAreaProps> = ({ children, maxHeight, style, onWheel }) => (
  <div
    className="modern-scrollbar"
    style={{
      maxHeight,
      overflowY: "auto",
      overflowX: "hidden",
      paddingRight: spacing.xs,
      ...style,
    }}
    onWheel={onWheel}
  >
    {children}
  </div>
);
