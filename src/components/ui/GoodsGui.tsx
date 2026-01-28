/**
 * GoodsGui Component - based on JxqyHD Engine/Gui/GoodsGui.cs
 * Displays player inventory with item grid and full drag-drop support
 *
 * C# Reference: GoodsGui.cs shows a 3x3 item grid with scroll bar and money display
 * Resources loaded from UI_Settings.ini
 */
import React, { useMemo, useState, useCallback } from "react";
import { useAsfImage } from "./hooks";
import { useGoodsGuiConfig } from "./useUISettings";
import { ScrollBar } from "./ScrollBar";
import type { Good, GoodKind } from "../../engine/goods";
import type { DragData } from "./EquipGui";

// Item data with Good reference
export interface GoodItemData {
  good: Good;
  count: number;
}

interface GoodsGuiProps {
  isVisible: boolean;
  items: (GoodItemData | null)[]; // All items in inventory
  money: number;
  screenWidth: number;
  onItemClick?: (index: number) => void;
  onItemRightClick?: (index: number) => void;
  onItemDrop?: (targetIndex: number, dragData: DragData) => void;
  onItemDragStart?: (index: number, good: Good) => void;
  onItemMouseEnter?: (index: number, good: Good | null, rect: DOMRect) => void;
  onItemMouseLeave?: () => void;
  onClose: () => void;
  dragData?: DragData | null;
}

/**
 * Single item slot component with drag-drop support
 */
interface ItemSlotProps {
  item: GoodItemData | null;
  index: number;
  config: { left: number; top: number; width: number; height: number };
  onClick?: () => void;
  onRightClick?: (e: React.MouseEvent) => void;
  onDrop?: (e: React.DragEvent) => void;
  onDragStart?: (e: React.DragEvent) => void;
  onDragOver?: (e: React.DragEvent) => void;
  onMouseEnter?: (e: React.MouseEvent) => void;
  onMouseLeave?: () => void;
  isDragOver?: boolean;
  canDrop?: boolean;
}

const ItemSlot: React.FC<ItemSlotProps> = ({
  item,
  config,
  onClick,
  onRightClick,
  onDrop,
  onDragStart,
  onDragOver,
  onMouseEnter,
  onMouseLeave,
  isDragOver,
  canDrop,
}) => {
  const itemImage = useAsfImage(item?.good?.imagePath ?? null, 0);

  return (
    <div
      style={{
        position: "absolute",
        left: config.left,
        top: config.top,
        width: config.width,
        height: config.height,
        cursor: item ? "grab" : "default",
        border: isDragOver
          ? (canDrop ? "2px solid #00ff00" : "2px solid #ff0000")
          : "1px solid rgba(100, 100, 100, 0.3)",
        borderRadius: 2,
        background: isDragOver
          ? (canDrop ? "rgba(0, 255, 0, 0.1)" : "rgba(255, 0, 0, 0.1)")
          : "rgba(0, 0, 0, 0.1)",
        transition: "border-color 0.15s, background 0.15s",
      }}
      title={item?.good?.name || "空"}
      onClick={onClick}
      onContextMenu={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onRightClick?.(e);
      }}
      onDrop={onDrop}
      onDragOver={onDragOver}
      onDragStart={onDragStart}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      draggable={!!item}
    >
      {item && itemImage.dataUrl && (
        <>
          <img
            src={itemImage.dataUrl}
            alt={item.good.name}
            style={{
              position: "absolute",
              left: (config.width - itemImage.width) / 2,
              top: (config.height - itemImage.height) / 2,
              width: itemImage.width,
              height: itemImage.height,
              imageRendering: "pixelated",
              pointerEvents: "none",
            }}
          />
          {/* Count display - always show count like C# TopLeftText */}
          <span
            style={{
              position: "absolute",
              left: 2,
              top: 1,
              fontSize: 10,
              color: "rgba(167, 157, 255, 0.9)",
              textShadow: "0 1px 2px #000",
              pointerEvents: "none",
            }}
          >
            {item.count}
          </span>
        </>
      )}
    </div>
  );
};

export const GoodsGui: React.FC<GoodsGuiProps> = ({
  isVisible,
  items,
  money,
  screenWidth,
  onItemClick,
  onItemRightClick,
  onItemDrop,
  onItemDragStart,
  onItemMouseEnter,
  onItemMouseLeave,
  dragData,
}) => {
  const [scrollOffset, setScrollOffset] = useState(0);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  // Load config from UI_Settings.ini
  const config = useGoodsGuiConfig();

  // Load panel background
  const panelImage = useAsfImage(
    config?.panel.image || "asf/ui/common/panel3.asf"
  );

  // Calculate panel position - C#: Globals.WindowWidth / 2f + leftAdjust
  const panelStyle = useMemo(() => {
    if (!config) return null;
    const panelWidth = panelImage.width || 330;
    const panelHeight = panelImage.height || 400;

    return {
      position: "absolute" as const,
      left: screenWidth / 2 + config.panel.leftAdjust,
      top: config.panel.topAdjust,
      width: panelWidth,
      height: panelHeight,
      pointerEvents: "auto" as const,
    };
  }, [screenWidth, panelImage.width, panelImage.height, config]);

  // Calculate currently visible items
  const visibleItems = useMemo(() => {
    if (!config) return [];
    const startIndex = scrollOffset * 3; // 3 items per row
    return config.items.map((_, idx) => items[startIndex + idx] ?? null);
  }, [items, scrollOffset, config]);

  // Calculate max scroll rows
  const maxScrollRows = Math.max(0, Math.ceil(items.length / 3) - 3);

  // Scroll handler
  const handleScroll = useCallback(
    (delta: number) => {
      setScrollOffset((prev) =>
        Math.max(0, Math.min(maxScrollRows, prev + delta))
      );
    },
    [maxScrollRows]
  );

  // Check if drag can be dropped in slot
  const canDropInSlot = useCallback((targetIndex: number): boolean => {
    if (!dragData) return false;
    // Can always drop goods in inventory slots
    return true;
  }, [dragData]);

  // Handle drag over
  const handleDragOver = useCallback((index: number) => (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverIndex(index);
  }, []);

  // Handle drop
  const handleDrop = useCallback((index: number) => (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverIndex(null);

    if (dragData) {
      const actualIndex = scrollOffset * 3 + index;
      onItemDrop?.(actualIndex, dragData);
    }
  }, [dragData, scrollOffset, onItemDrop]);

  // Handle drag start
  const handleDragStart = useCallback((index: number) => (e: React.DragEvent) => {
    const actualIndex = scrollOffset * 3 + index;
    const item = items[actualIndex];
    if (item) {
      onItemDragStart?.(actualIndex, item.good);
      if (e.dataTransfer) {
        e.dataTransfer.effectAllowed = "move";
      }
    }
  }, [items, scrollOffset, onItemDragStart]);

  // Handle mouse enter for tooltip
  const handleMouseEnter = useCallback((index: number) => (e: React.MouseEvent) => {
    const actualIndex = scrollOffset * 3 + index;
    const item = items[actualIndex];
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    onItemMouseEnter?.(actualIndex, item?.good ?? null, rect);
  }, [items, scrollOffset, onItemMouseEnter]);

  // Handle drag leave
  const handleDragLeave = useCallback(() => {
    setDragOverIndex(null);
  }, []);

  if (!isVisible || !config || !panelStyle) return null;

  return (
    <div
      style={panelStyle}
      onClick={(e) => e.stopPropagation()}
      onWheel={(e) => handleScroll(e.deltaY > 0 ? 1 : -1)}
      onDragLeave={handleDragLeave}
    >
      {/* Background panel */}
      {panelImage.dataUrl && (
        <img
          src={panelImage.dataUrl}
          alt="物品面板"
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            width: panelImage.width,
            height: panelImage.height,
            imageRendering: "pixelated",
            pointerEvents: "none",
          }}
        />
      )}

      {/* Item slots */}
      {config.items.map((itemConfig, idx) => (
        <ItemSlot
          key={idx}
          item={visibleItems[idx]}
          index={idx}
          config={itemConfig}
          onClick={() => onItemClick?.(scrollOffset * 3 + idx)}
          onRightClick={() => onItemRightClick?.(scrollOffset * 3 + idx)}
          onDrop={handleDrop(idx)}
          onDragOver={handleDragOver(idx)}
          onDragStart={handleDragStart(idx)}
          onMouseEnter={handleMouseEnter(idx)}
          onMouseLeave={onItemMouseLeave}
          isDragOver={dragOverIndex === idx}
          canDrop={canDropInSlot(scrollOffset * 3 + idx)}
        />
      ))}

      {/* Money display */}
      <div
        style={{
          position: "absolute",
          left: config.money.left,
          top: config.money.top,
          width: config.money.width,
          height: config.money.height,
          fontSize: 12,
          fontFamily: "SimSun, serif",
          color: config.money.color,
        }}
      >
        {money}
      </div>

      {/* Scroll bar with ASF texture */}
      <ScrollBar
        value={scrollOffset}
        minValue={0}
        maxValue={maxScrollRows}
        left={config.scrollBar.left}
        top={config.scrollBar.top}
        width={config.scrollBar.width}
        height={config.scrollBar.height}
        buttonImage={config.scrollBar.button}
        onChange={setScrollOffset}
        visible={maxScrollRows > 0}
      />
    </div>
  );
};
