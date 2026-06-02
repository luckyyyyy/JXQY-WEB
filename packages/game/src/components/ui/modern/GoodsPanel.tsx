/**
 * Modern GoodsPanel - 武侠风格物品背包面板
 * 参考 StatePanel 的设计风格
 */

import type { UIGoodData } from "@miu2d/engine/gui/ui-types";
import { GoodKind } from "@miu2d/engine/player/goods";
import type React from "react";
import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  HiOutlineArchiveBox,
  HiOutlineBeaker,
  HiOutlineCurrencyYen,
  HiOutlineDocumentText,
  HiOutlineShieldCheck,
  HiOutlineShoppingBag,
  HiOutlineXMark,
} from "react-icons/hi2";
import type { TouchDragData } from "../../../contexts";
import { useGameUIContext } from "../../../contexts";
import type { DragData, GoodItemData } from "../classic";
import { useAsfImage } from "../classic/hooks";
import { getItemBorderColor, getItemGlowColor, getItemQuality, ItemQuality } from "./Tooltips";
import { borderRadius, glassEffect, iconStyle, modernColors, spacing, transitions, typography } from "./theme";

// 筛选类型
type FilterKind = "all" | GoodKind;

interface FilterTab {
  key: FilterKind;
  label: string;
  icon: ReactNode;
}

const filterTabs: FilterTab[] = [
  { key: "all", label: "全部", icon: <HiOutlineArchiveBox /> },
  { key: GoodKind.Drug, label: "药品", icon: <HiOutlineBeaker /> },
  { key: GoodKind.Equipment, label: "装备", icon: <HiOutlineShieldCheck /> },
  { key: GoodKind.Event, label: "任务", icon: <HiOutlineDocumentText /> },
];

// 武侠风格配色
const wuxiaAccent = {
  gold: "#D4AF37",
  goldBright: "#FFD700",
  goldDark: "#8B7355",
  crimson: "#C41E3A",
  azure: "#4A90D9",
  jade: "#50C878",
};

interface GoodsPanelProps {
  isVisible: boolean;
  items: (GoodItemData | null)[];
  money: number;
  onItemClick?: (index: number) => void;
  onItemRightClick?: (index: number) => void;
  onItemDrop?: (targetIndex: number, dragData: DragData) => void;
  onItemDragStart?: (index: number, good: UIGoodData) => void;
  /** @deprecated 使用 onItemHover 替代 */
  onItemMouseEnter?: (index: number, good: UIGoodData | null, rect: DOMRect) => void;
  onItemMouseLeave?: () => void;
  onClose: () => void;
  dragData?: DragData | null;
  onTouchDrop?: (targetIndex: number, data: TouchDragData) => void;
  onItemHover?: (good: UIGoodData | null, x: number, y: number) => void;
}

interface ItemSlotProps {
  item: GoodItemData | null;
  index: number;
  actualIndex: number;
  slotSize: number;
  dimmed?: boolean;
  onClick?: () => void;
  onRightClick?: () => void;
  onDrop?: (e: React.DragEvent) => void;
  onDragStart?: (e: React.DragEvent) => void;
  onDragOver?: (e: React.DragEvent) => void;
  onMouseEnter?: (e: React.MouseEvent) => void;
  onMouseMove?: (e: React.MouseEvent) => void;
  onMouseLeave?: () => void;
}

// 关闭按钮
const CloseBtn: React.FC<{ onClick: () => void }> = ({ onClick }) => (
  <button
    onClick={onClick}
    style={{
      position: "absolute",
      top: spacing.sm,
      right: spacing.sm,
      width: 28,
      height: 28,
      background: modernColors.bg.hover,
      border: `1px solid ${modernColors.border.glass}`,
      borderRadius: borderRadius.round,
      color: modernColors.text.secondary,
      fontSize: typography.fontSize.md,
      cursor: "pointer",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      transition: transitions.fast,
      zIndex: 10,
    }}
    onMouseEnter={(e) => {
      e.currentTarget.style.background = "rgba(255,100,100,0.3)";
      e.currentTarget.style.color = modernColors.text.primary;
    }}
    onMouseLeave={(e) => {
      e.currentTarget.style.background = modernColors.bg.hover;
      e.currentTarget.style.color = modernColors.text.secondary;
    }}
  >
    <HiOutlineXMark style={{ ...iconStyle, fontSize: 16 }} />
  </button>
);

// 物品槽位组件
const GoodsSlot: React.FC<ItemSlotProps> = ({
  item,
  actualIndex,
  slotSize,
  dimmed,
  onClick,
  onRightClick,
  onDrop,
  onDragStart,
  onDragOver,
  onMouseEnter,
  onMouseMove,
  onMouseLeave,
}) => {
  const [isHovered, setIsHovered] = useState(false);
  const itemImage = useAsfImage(item?.good?.iconPath ?? null, 0);

  // 获取物品品级颜色
  const qualityBorderColor = getItemBorderColor(item?.good);
  const qualityGlowColor = getItemGlowColor(item?.good);
  const _itemQuality = item?.good ? getItemQuality(item.good.cost) : ItemQuality.Normal;

  // 计算边框颜色：有品级时始终显示品级颜色，hover 时更亮
  const borderColor = qualityBorderColor
    ? qualityBorderColor // 品级颜色始终显示
    : isHovered
      ? modernColors.border.glassLight
      : modernColors.border.glass;

  // 计算边框渐变的第二颜色（稍暗）
  const borderColorSecondary = qualityBorderColor
    ? isHovered
      ? qualityBorderColor // hover 时更亮
      : `${qualityBorderColor}cc` // 非 hover 时稍暗但仍清晰
    : isHovered
      ? `${modernColors.border.glassLight}88`
      : `${modernColors.border.glass}88`;

  // 计算发光效果：有品级时始终有轻微发光，hover 时更强
  const boxShadow = qualityGlowColor
    ? isHovered
      ? `0 0 12px ${qualityGlowColor}, inset 0 0 8px ${qualityGlowColor}`
      : `0 0 6px ${qualityGlowColor}` // 非 hover 时也有轻微发光
    : item && isHovered
      ? `inset 0 0 15px ${wuxiaAccent.gold}22`
      : "none";

  const iconSize = slotSize - 8;

  return (
    <div
      style={{
        width: slotSize,
        height: slotSize,
        position: "relative",
        cursor: item ? "grab" : "default",
        transition: transitions.fast,
        transform: isHovered && item ? "scale(1.05)" : "scale(1)",
        opacity: dimmed ? 0.25 : 1,
        pointerEvents: dimmed ? "none" : "auto",
      }}
      onClick={onClick}
      onContextMenu={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onRightClick?.();
      }}
      onMouseEnter={(e) => {
        setIsHovered(true);
        onMouseEnter?.(e);
      }}
      onMouseMove={(e) => {
        if (item) onMouseMove?.(e);
      }}
      onMouseLeave={() => {
        setIsHovered(false);
        onMouseLeave?.();
      }}
      draggable={!!item}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
    >
      {/* 外边框 */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: `linear-gradient(135deg, ${borderColor}, ${borderColorSecondary})`,
          borderRadius: borderRadius.md,
          transition: transitions.fast,
          boxShadow,
        }}
      />

      {/* 内部容器 */}
      <div
        style={{
          position: "absolute",
          inset: 2,
          background: item
            ? isHovered
              ? "rgba(40, 45, 60, 0.95)"
              : "rgba(25, 30, 45, 0.9)"
            : "rgba(15, 20, 30, 0.6)",
          borderRadius: borderRadius.sm,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          overflow: "hidden",
          transition: transitions.fast,
        }}
      >
        {item && itemImage.dataUrl ? (
          <img
            src={itemImage.dataUrl}
            alt={item.good.name}
            style={{
              maxWidth: iconSize,
              maxHeight: iconSize,
              imageRendering: "pixelated",
              pointerEvents: "none",
              filter: isHovered ? "brightness(1.15)" : "brightness(1)",
              transition: transitions.fast,
            }}
            draggable={false}
          />
        ) : (
          // 空槽位装饰
          <div
            style={{
              width: "60%",
              height: "60%",
              border: `1px dashed ${modernColors.border.glass}`,
              borderRadius: borderRadius.sm,
              opacity: 0.3,
            }}
          />
        )}
      </div>

      {/* 数量显示 */}
      {item && item.count > 1 && (
        <span
          style={{
            position: "absolute",
            bottom: 4,
            right: 6,
            fontSize: 10,
            fontWeight: typography.fontWeight.bold,
            color: modernColors.text.primary,
            textShadow: "0 1px 3px rgba(0,0,0,0.9), 0 0 5px rgba(0,0,0,0.8)",
            zIndex: 2,
          }}
        >
          {item.count}
        </span>
      )}
    </div>
  );
};

export const GoodsPanel: React.FC<GoodsPanelProps> = ({
  isVisible,
  items,
  money,
  onItemClick,
  onItemRightClick,
  onItemDrop,
  onItemDragStart,
  onItemMouseEnter,
  onItemMouseLeave,
  onClose,
  dragData,
  onTouchDrop,
  onItemHover,
}) => {
  const { screenWidth } = useGameUIContext();
  const [scrollOffset, setScrollOffset] = useState(0);
  const [filterKind, setFilterKind] = useState<FilterKind>("all");

  // 滚动条拖拽状态
  const [isDraggingScrollbar, setIsDraggingScrollbar] = useState(false);
  const scrollbarTrackRef = useRef<HTMLDivElement>(null);
  const dragStartY = useRef(0);
  const dragStartOffset = useRef(0);

  // 面板配置
  const panelWidth = 300;
  const columns = 5;
  const rows = 7;
  const slotSize = 44;
  const gap = 6;
  const itemsPerPage = columns * rows; // 35个物品

  // 位置: 屏幕中央偏右
  const panelStyle: React.CSSProperties = useMemo(
    () => ({
      position: "absolute",
      left: screenWidth / 2 + 20,
      top: 46,
      width: panelWidth,
      display: "flex",
      flexDirection: "column",
      ...glassEffect.standard,
      borderRadius: borderRadius.xl,
      border: `1px solid ${wuxiaAccent.goldDark}66`,
      boxShadow: `
        0 8px 32px rgba(0, 0, 0, 0.4),
        inset 0 1px 0 rgba(255,255,255,0.1),
        0 0 40px rgba(212,175,55,0.08)
      `,
      pointerEvents: "auto",
    }),
    [screenWidth]
  );

  // 筛选后的物品（保留所有物品，标记不匹配的为 dimmed）
  const filteredItems = useMemo(() => {
    if (filterKind === "all") return items.map((item) => ({ item, dimmed: false }));
    return items.map((item) => ({
      item,
      dimmed: item !== null && item.good.kind !== filterKind,
    }));
  }, [items, filterKind]);

  // 当前显示的物品
  const visibleItems = useMemo(() => {
    const startIndex = scrollOffset * columns;
    return filteredItems.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredItems, scrollOffset, itemsPerPage]);

  // 最大滚动行数（基于总物品数，筛选不改变布局）
  const maxScrollRows = Math.max(0, Math.ceil(items.length / columns) - rows);

  // 切换筛选时重置滚动
  const handleFilterChange = useCallback(
    (kind: FilterKind) => {
      setFilterKind(kind);
      setScrollOffset(0);
    },
    []
  );

  // 滚动处理
  const handleScroll = useCallback(
    (e: React.WheelEvent) => {
      const delta = e.deltaY > 0 ? 1 : -1;
      setScrollOffset((prev) => Math.max(0, Math.min(maxScrollRows, prev + delta)));
    },
    [maxScrollRows]
  );

  // 拖放处理
  const handleDragOver = useCallback(
    (_index: number) => (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
    },
    []
  );

  const handleDrop = useCallback(
    (index: number) => (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (dragData) {
        const bagIndex = scrollOffset * columns + index + 1;
        onItemDrop?.(bagIndex, dragData);
      }
    },
    [dragData, scrollOffset, onItemDrop]
  );

  const handleDragStart = useCallback(
    (index: number) => (e: React.DragEvent) => {
      const bagIndex = scrollOffset * columns + index + 1;
      const entry = filteredItems[scrollOffset * columns + index];
      if (entry?.item && !entry.dimmed) {
        onItemDragStart?.(bagIndex, entry.item.good);
        if (e.dataTransfer) {
          e.dataTransfer.effectAllowed = "move";
        }
      }
    },
    [filteredItems, scrollOffset, onItemDragStart]
  );

  const handleMouseEnter = useCallback(
    (index: number) => (e: React.MouseEvent) => {
      const entry = filteredItems[scrollOffset * columns + index];
      const good = entry?.item?.good ?? null;
      if (onItemHover) {
        onItemHover(good, e.clientX, e.clientY);
      } else if (onItemMouseEnter) {
        const bagIndex = scrollOffset * columns + index + 1;
        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
        onItemMouseEnter(bagIndex, good, rect);
      }
    },
    [filteredItems, scrollOffset, onItemMouseEnter, onItemHover]
  );

  const handleMouseMove = useCallback(
    (index: number) => (e: React.MouseEvent) => {
      const entry = filteredItems[scrollOffset * columns + index];
      onItemHover?.(entry?.item?.good ?? null, e.clientX, e.clientY);
    },
    [filteredItems, scrollOffset, onItemHover]
  );

  // 滚动条拖拽的全局鼠标事件
  useEffect(() => {
    if (!isDraggingScrollbar) return;

    const handleMouseMove = (e: MouseEvent) => {
      const track = scrollbarTrackRef.current;
      if (!track) return;
      const trackRect = track.getBoundingClientRect();
      const trackHeight = trackRect.height;
      const dy = e.clientY - dragStartY.current;
      const rowsPerPx = maxScrollRows / (trackHeight * 0.8); // thumb 占 20%
      const newOffset = Math.round(dragStartOffset.current + dy * rowsPerPx);
      setScrollOffset(Math.max(0, Math.min(maxScrollRows, newOffset)));
    };

    const handleMouseUp = () => {
      setIsDraggingScrollbar(false);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDraggingScrollbar, maxScrollRows]);

  const handleScrollbarThumbMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDraggingScrollbar(true);
      dragStartY.current = e.clientY;
      dragStartOffset.current = scrollOffset;
    },
    [scrollOffset]
  );

  const handleScrollbarTrackClick = useCallback(
    (e: React.MouseEvent) => {
      if (isDraggingScrollbar) return;
      const track = scrollbarTrackRef.current;
      if (!track) return;
      const rect = track.getBoundingClientRect();
      const clickRatio = (e.clientY - rect.top) / rect.height;
      const newOffset = Math.round(clickRatio * maxScrollRows);
      setScrollOffset(Math.max(0, Math.min(maxScrollRows, newOffset)));
    },
    [isDraggingScrollbar, maxScrollRows]
  );

  // 统计物品数量
  const totalItemCount = useMemo(() => items.filter((i) => i !== null).length, [items]);
  const filteredItemCount = useMemo(
    () => filteredItems.filter((e) => e.item !== null && !e.dimmed).length,
    [filteredItems]
  );

  if (!isVisible) return null;

  return (
    <div style={panelStyle} onClick={(e) => e.stopPropagation()} onWheel={handleScroll}>
      {/* 装饰性顶部边框 */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: 2,
          background: `linear-gradient(90deg, transparent, ${wuxiaAccent.gold}88, transparent)`,
          borderRadius: `${borderRadius.xl}px ${borderRadius.xl}px 0 0`,
        }}
      />

      <CloseBtn onClick={onClose} />

      {/* 标题区域 */}
      <div
        style={{
          padding: `${spacing.lg}px ${spacing.lg}px ${spacing.md}px`,
          background: modernColors.bg.hover,
          borderBottom: `1px solid ${modernColors.border.glass}`,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: spacing.md }}>
          {/* 背包图标 - 八角形 */}
          <div
            style={{
              width: 48,
              height: 48,
              position: "relative",
              flexShrink: 0,
            }}
          >
            <div
              style={{
                position: "absolute",
                inset: -2,
                background: `linear-gradient(135deg, ${wuxiaAccent.gold}, ${wuxiaAccent.goldDark})`,
                clipPath:
                  "polygon(30% 0%, 70% 0%, 100% 30%, 100% 70%, 70% 100%, 30% 100%, 0% 70%, 0% 30%)",
              }}
            />
            <div
              style={{
                position: "absolute",
                inset: 0,
                background: `linear-gradient(135deg, ${wuxiaAccent.jade}44, ${wuxiaAccent.azure}44)`,
                clipPath:
                  "polygon(30% 0%, 70% 0%, 100% 30%, 100% 70%, 70% 100%, 30% 100%, 0% 70%, 0% 30%)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <HiOutlineShoppingBag
                style={{ ...iconStyle, fontSize: 22, filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.5))" }}
              />
            </div>
          </div>

          <div style={{ flex: 1 }}>
            <div
              style={{
                fontSize: typography.fontSize.lg,
                fontWeight: typography.fontWeight.bold,
                color: modernColors.text.primary,
                textShadow: "0 2px 4px rgba(0,0,0,0.5)",
                marginBottom: spacing.xs,
              }}
            >
              随身包裹
            </div>
            <div
              style={{
                fontSize: typography.fontSize.sm,
                color: modernColors.text.secondary,
              }}
            >
              物品{" "}
              <span style={{ color: wuxiaAccent.gold, fontWeight: typography.fontWeight.semibold }}>
                {filterKind === "all" ? totalItemCount : filteredItemCount}
              </span>{" "}
              / {totalItemCount} 件
            </div>
          </div>
        </div>
      </div>

      {/* 筛选标签栏 */}
      <div
        style={{
          display: "flex",
          gap: spacing.xs,
          padding: `${spacing.sm}px ${spacing.md}px`,
          borderBottom: `1px solid ${modernColors.border.glass}`,
          background: modernColors.bg.glassDark,
        }}
      >
        {filterTabs.map((tab) => {
          const isActive = filterKind === tab.key;
          const count =
            tab.key === "all"
              ? totalItemCount
              : items.filter((i) => i !== null && i.good.kind === tab.key).length;

          return (
            <button
              key={tab.key}
              onClick={() => handleFilterChange(tab.key)}
              style={{
                flex: 1,
                padding: `${spacing.xs}px ${spacing.sm}px`,
                background: isActive ? modernColors.bg.active : "transparent",
                border: isActive
                  ? `1px solid ${wuxiaAccent.gold}66`
                  : `1px solid transparent`,
                borderRadius: borderRadius.md,
                color: isActive ? wuxiaAccent.gold : modernColors.text.muted,
                fontSize: typography.fontSize.xs,
                fontWeight: isActive ? typography.fontWeight.semibold : typography.fontWeight.normal,
                cursor: "pointer",
                transition: transitions.fast,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 1,
              }}
              onMouseEnter={(e) => {
                if (!isActive) {
                  e.currentTarget.style.background = modernColors.bg.hover;
                  e.currentTarget.style.color = modernColors.text.secondary;
                }
              }}
              onMouseLeave={(e) => {
                if (!isActive) {
                  e.currentTarget.style.background = "transparent";
                  e.currentTarget.style.color = modernColors.text.muted;
                }
              }}
            >
              <span style={{ ...iconStyle, fontSize: 14 }}>{tab.icon}</span>
              <span>{tab.label}</span>
              <span
                style={{
                  fontSize: 9,
                  opacity: 0.7,
                }}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* 物品网格区域 */}
      <div
        style={{
          padding: spacing.md,
          flex: 1,
          position: "relative",
        }}
      >
        {/* 网格 */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: `repeat(${columns}, ${slotSize}px)`,
            gap: gap,
            justifyContent: "center",
          }}
        >
          {visibleItems.map((entry, idx) => {
            const actualIndex = scrollOffset * columns + idx + 1;
            const contentKey = entry.item?.good?.name ?? "empty";
            return (
              <GoodsSlot
                key={`goods-slot-${idx}-${scrollOffset}-${contentKey}`}
                item={entry.item}
                index={idx}
                actualIndex={actualIndex}
                slotSize={slotSize}
                dimmed={entry.dimmed}
                onClick={() => onItemClick?.(actualIndex)}
                onRightClick={() => onItemRightClick?.(actualIndex)}
                onDrop={handleDrop(idx)}
                onDragOver={handleDragOver(idx)}
                onDragStart={handleDragStart(idx)}
                onMouseEnter={handleMouseEnter(idx)}
                onMouseMove={handleMouseMove(idx)}
                onMouseLeave={onItemMouseLeave}
              />
            );
          })}
        </div>

        {/* 滚动条 */}
        {maxScrollRows > 0 && (
          <div
            ref={scrollbarTrackRef}
            onClick={handleScrollbarTrackClick}
            style={{
              position: "absolute",
              right: 2,
              top: spacing.md,
              bottom: spacing.md,
              width: 10,
              background: "rgba(0, 0, 0, 0.35)",
              borderRadius: 5,
              cursor: "pointer",
            }}
          >
            <div
              onMouseDown={handleScrollbarThumbMouseDown}
              style={{
                position: "absolute",
                top: `${(scrollOffset / maxScrollRows) * 80}%`,
                width: "100%",
                height: "20%",
                background: isDraggingScrollbar ? wuxiaAccent.goldBright : wuxiaAccent.gold,
                borderRadius: 5,
                boxShadow: `0 0 6px ${wuxiaAccent.gold}`,
                cursor: "ns-resize",
                transition: isDraggingScrollbar ? "none" : "top 0.1s ease",
              }}
            />
          </div>
        )}
      </div>

      {/* 底部金钱显示 */}
      <div
        style={{
          padding: `${spacing.sm}px ${spacing.lg}px ${spacing.md}px`,
          borderTop: `1px solid ${modernColors.border.glass}`,
          background: modernColors.bg.glassDark,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: spacing.sm }}>
          <HiOutlineCurrencyYen style={{ ...iconStyle, fontSize: 18 }} />
          <span
            style={{
              fontSize: typography.fontSize.sm,
              color: modernColors.text.secondary,
            }}
          >
            银两
          </span>
        </div>
        <span
          style={{
            fontSize: typography.fontSize.lg,
            fontWeight: typography.fontWeight.bold,
            color: wuxiaAccent.gold,
            fontFamily: "Georgia, serif",
            textShadow: `0 0 10px ${wuxiaAccent.gold}44`,
          }}
        >
          {money.toLocaleString()}
        </span>
      </div>

      {/* 底部装饰 */}
      <div
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          height: 2,
          background: `linear-gradient(90deg, transparent, ${wuxiaAccent.goldDark}, transparent)`,
        }}
      />
    </div>
  );
};
