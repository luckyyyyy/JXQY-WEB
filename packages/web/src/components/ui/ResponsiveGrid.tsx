/**
 * 自适应栅格组件
 *
 * 基于 CSS Grid 的 auto-fill/auto-fit，自动根据容器宽度调整列数。
 * 支持设置最小和最大列宽，以及间距。
 */
import type { CSSProperties, ReactNode } from "react";

interface ResponsiveGridProps {
  /** 子元素 */
  children: ReactNode;
  /** 每列最小宽度（px），默认 280 */
  minColWidth?: number;
  /** 每列最大宽度，默认 1fr（自动填充） */
  maxColWidth?: string;
  /** 间距（Tailwind gap 值），默认 4 → gap-4 */
  gap?: number;
  /** 额外 class */
  className?: string;
  /** auto-fill（默认）或 auto-fit */
  mode?: "fill" | "fit";
}

/**
 * 自适应栅格
 *
 * ```tsx
 * <ResponsiveGrid minColWidth={300}>
 *   <Card />
 *   <Card />
 *   <Card />
 * </ResponsiveGrid>
 * ```
 */
export function ResponsiveGrid({
  children,
  minColWidth = 280,
  maxColWidth = "1fr",
  gap = 4,
  className = "",
  mode = "fill",
}: ResponsiveGridProps) {
  const autoMode = mode === "fill" ? "auto-fill" : "auto-fit";
  const style: CSSProperties = {
    display: "grid",
    gridTemplateColumns: `repeat(${autoMode}, minmax(${minColWidth}px, ${maxColWidth}))`,
  };

  // gap 映射到 tailwind 的 gap-N（N * 0.25rem）
  return (
    <div className={`gap-${gap} ${className}`} style={style}>
      {children}
    </div>
  );
}
