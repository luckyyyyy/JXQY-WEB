/**
 * BuyGui Component - based on JxqyHD Engine/Gui/BuyGui.cs
 * Displays shop interface for buying items from NPC
 *
 * shows a 3x3 item grid with scroll bar and close button
 * Resources loaded from UI_Settings.ini [BuySell] section
 *
 * 商店物品配置格式 (resources/ini/buy/*.ini):
 * [Header]
 * Count=N
 * NumberValid=0/1  (是否限制数量)
 * BuyPercent=100   (购买价格百分比)
 * RecyclePercent=100 (出售价格百分比)
 *
 * [1]
 * IniFile=Good-xxx.ini
 * Number=1
 */

import type { Good } from "@miu2d/engine/player/goods";
import type React from "react";
import { useCallback, useMemo, useState } from "react";
import { AsfAnimatedSprite } from "./AsfAnimatedSprite";
import { useAsfImage } from "./hooks";
import { ScrollBar } from "./ScrollBar";
import { useBuySellGuiConfig } from "./useUISettings";

// 商店物品数据
export interface ShopItemData {
  good: Good;
  count: number; // -1 表示无限数量
  price: number; // 已计算好的最终价格（含自定义价格 + buyPercent）
}

interface BuyGuiProps {
  isVisible: boolean;
  items: (ShopItemData | null)[]; // 商店物品列表
  screenWidth: number;
  buyPercent: number; // 购买价格百分比
  numberValid: boolean; // 是否限制数量
  onItemClick?: (index: number) => void;
  onItemRightClick?: (index: number) => void; // 右键购买
  onItemMouseEnter?: (index: number, good: Good | null, rect: DOMRect) => void;
  onItemMouseLeave?: () => void;
  onClose: () => void;
}

/**
 * Single shop item slot component
 */
interface ShopItemSlotProps {
  item: ShopItemData | null;
  index: number;
  numberValid: boolean;
  config: { left: number; top: number; width: number; height: number };
  onClick?: () => void;
  onRightClick?: (e: React.MouseEvent) => void;
  onMouseEnter?: (e: React.MouseEvent) => void;
  onMouseLeave?: () => void;
}

const ShopItemSlot: React.FC<ShopItemSlotProps> = ({
  item,
  numberValid,
  config,
  onClick,
  onRightClick,
  onMouseEnter,
  onMouseLeave,
}) => {
  const itemImage = useAsfImage(item?.good?.imagePath ?? null, 0);
  const isSoldOut = numberValid && item && item.count <= 0;

  return (
    <div
      style={{
        position: "absolute",
        left: config.left,
        top: config.top,
        width: config.width,
        height: config.height,
        cursor: item && !isSoldOut ? "pointer" : "default",
        borderRadius: 2,
        opacity: isSoldOut ? 0.5 : 1,
      }}
      title={item?.good?.name || "空"}
      onClick={onClick}
      onContextMenu={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onRightClick?.(e);
      }}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      {item && itemImage.dataUrl && (
        <>
          <img
            src={itemImage.dataUrl}
            alt={item.good.name}
            draggable={false}
            style={{
              position: "absolute",
              left: (config.width - itemImage.width) / 2,
              top: (config.height - itemImage.height) / 2,
              width: itemImage.width,
              height: itemImage.height,
              imageRendering: "pixelated",
            }}
          />
          {/* 数量显示 - 仅在限制数量时显示 */}
          {numberValid && (
            <span
              style={{
                position: "absolute",
                left: 2,
                top: 1,
                fontSize: 10,
                color: item.count <= 0 ? "rgba(255, 100, 100, 0.9)" : "rgba(167, 157, 255, 0.9)",
                textShadow: "0 1px 2px #000",
                pointerEvents: "none",
              }}
            >
              {item.count <= 0 ? "售罄" : item.count}
            </span>
          )}
        </>
      )}
    </div>
  );
};

export const BuyGui: React.FC<BuyGuiProps> = ({
  isVisible,
  items,
  screenWidth,
  numberValid,
  onItemClick,
  onItemRightClick,
  onItemMouseEnter,
  onItemMouseLeave,
  onClose,
}) => {
  const [scrollOffset, setScrollOffset] = useState(0);

  // Load config from UI_Settings.ini
  const config = useBuySellGuiConfig();

  // Load panel background
  const panelImage = useAsfImage(config?.panel.image || "asf/ui/common/panel8.asf");

  // Calculate panel position - Globals.WindowWidth / 2f - baseTexture.Width + leftAdjust
  const panelStyle = useMemo(() => {
    if (!config) return null;
    const panelWidth = panelImage.width || 300;
    const panelHeight = panelImage.height || 400;

    return {
      position: "absolute" as const,
      left: screenWidth / 2 - panelWidth + config.panel.leftAdjust,
      top: config.panel.topAdjust,
      width: panelWidth,
      height: panelHeight,
      pointerEvents: "auto" as const,
    };
  }, [screenWidth, panelImage.width, panelImage.height, config]);

  // Calculate currently visible items (3x3 grid, 3 items per row)
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
      setScrollOffset((prev) => Math.max(0, Math.min(maxScrollRows, prev + delta)));
    },
    [maxScrollRows]
  );

  // Handle mouse enter for tooltip
  const handleMouseEnter = useCallback(
    (index: number) => (e: React.MouseEvent) => {
      const actualIndex = scrollOffset * 3 + index;
      const item = items[actualIndex];
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      onItemMouseEnter?.(actualIndex, item?.good ?? null, rect);
    },
    [items, scrollOffset, onItemMouseEnter]
  );

  // Handle right click (buy item)
  const handleRightClick = useCallback(
    (index: number) => () => {
      const actualIndex = scrollOffset * 3 + index;
      onItemRightClick?.(actualIndex);
    },
    [scrollOffset, onItemRightClick]
  );

  // Handle click
  const handleClick = useCallback(
    (index: number) => () => {
      const actualIndex = scrollOffset * 3 + index;
      onItemClick?.(actualIndex);
    },
    [scrollOffset, onItemClick]
  );

  if (!isVisible || !config || !panelStyle) return null;

  return (
    <div
      style={panelStyle}
      onClick={(e) => e.stopPropagation()}
      onWheel={(e) => handleScroll(e.deltaY > 0 ? 1 : -1)}
    >
      {/* Background panel */}
      {panelImage.dataUrl && (
        <img
          src={panelImage.dataUrl}
          alt="商店面板"
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
        <ShopItemSlot
          key={`shop-slot-${idx}`}
          item={visibleItems[idx]}
          index={idx}
          numberValid={numberValid}
          config={itemConfig}
          onClick={handleClick(idx)}
          onRightClick={handleRightClick(idx)}
          onMouseEnter={handleMouseEnter(idx)}
          onMouseLeave={onItemMouseLeave}
        />
      ))}

      {/* Scroll bar */}
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

      {/* Close button */}
      <div
        style={{
          position: "absolute",
          left: config.closeBtn.left,
          top: config.closeBtn.top,
          cursor: "pointer",
        }}
        onClick={onClose}
      >
        <AsfAnimatedSprite path={config.closeBtn.image} autoPlay={false} loop={false} />
      </div>
    </div>
  );
};
