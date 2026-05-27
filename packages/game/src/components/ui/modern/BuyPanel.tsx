/**
 * Modern BuyPanel - 商店购买面板
 * Props 与经典 BuyGui 完全一致
 */

import type { UIGoodData } from "@miu2d/engine/gui/ui-types";
import type React from "react";
import { useCallback, useMemo, useState } from "react";
import { HiOutlineArchiveBox, HiOutlineCurrencyYen } from "react-icons/hi2";
import { useAsfImage } from "../classic/hooks";
import { PanelHeader } from "./components";
import { borderRadius, glassEffect, iconStyle, modernColors, spacing, typography } from "./theme";

// 商店物品数据（与经典 UI 一致）
export interface ShopItemData {
  good: UIGoodData;
  count: number; // -1 表示无限数量
  price: number; // 已计算好的最终价格（含自定义价格 + buyPercent）
}

interface BuyPanelProps {
  isVisible: boolean;
  items: (ShopItemData | null)[];
  buyPercent: number;
  numberValid: boolean;
  onItemClick?: (index: number) => void;
  onItemRightClick?: (index: number) => void; // 右键购买
  onItemMouseEnter?: (index: number, good: UIGoodData | null, rect: DOMRect) => void;
  onItemMouseLeave?: () => void;
  onClose: () => void;
}

interface ShopItemRowProps {
  item: ShopItemData | null;
  index: number;
  numberValid: boolean;
  buyPercent: number;
  isSelected: boolean;
  onClick: () => void;
  onRightClick: (e: React.MouseEvent) => void;
  onMouseEnter: (e: React.MouseEvent) => void;
  onMouseLeave: () => void;
}

const ShopItemRow: React.FC<ShopItemRowProps> = ({
  item,
  index,
  numberValid,
  buyPercent,
  isSelected,
  onClick,
  onRightClick,
  onMouseEnter,
  onMouseLeave,
}) => {
  const [isHovered, setIsHovered] = useState(false);
  const iconImage = useAsfImage(item?.good?.imagePath ?? null, 0);
  const isSoldOut = numberValid && item && item.count <= 0;

  // 使用 UIShopItem 中已算好的价格（包含自定义价格 + buyPercent 的计算结果）
  const price = item?.price ?? 0;

  return (
    <div
      onClick={onClick}
      onContextMenu={(e) => {
        e.preventDefault();
        onRightClick(e);
      }}
      onMouseEnter={(e) => {
        setIsHovered(true);
        onMouseEnter(e);
      }}
      onMouseLeave={() => {
        setIsHovered(false);
        onMouseLeave();
      }}
      style={{
        display: "flex",
        alignItems: "center",
        padding: spacing.sm,
        gap: spacing.md,
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
        cursor: item && !isSoldOut ? "pointer" : "not-allowed",
        opacity: isSoldOut ? 0.5 : 1,
        transition: "all 0.15s ease",
      }}
    >
      {/* 图标 */}
      <div
        style={{
          width: 40,
          height: 40,
          background: "rgba(0, 0, 0, 0.3)",
          borderRadius: borderRadius.sm,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        {item && iconImage.dataUrl ? (
          <img
            src={iconImage.dataUrl}
            alt={item.good.name}
            style={{
              maxWidth: 32,
              maxHeight: 32,
              imageRendering: "pixelated",
            }}
          />
        ) : (
          <HiOutlineArchiveBox style={{ ...iconStyle, fontSize: 20, opacity: 0.5 }} />
        )}
      </div>

      {/* 名称和数量 */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: typography.fontSize.sm,
            fontWeight: typography.fontWeight.medium,
            color: item ? modernColors.text.primary : modernColors.text.muted,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {item?.good?.name || "空"}
        </div>
        {item && numberValid && (
          <div
            style={{
              fontSize: typography.fontSize.xs,
              color: isSoldOut ? modernColors.stats.hp : modernColors.text.muted,
            }}
          >
            {isSoldOut ? "已售罄" : `库存: ${item.count === -1 ? "∞" : item.count}`}
          </div>
        )}
      </div>

      {/* 价格 */}
      {item && (
        <div
          style={{
            fontSize: typography.fontSize.sm,
            fontWeight: typography.fontWeight.semibold,
            color: modernColors.accent,
            display: "flex",
            alignItems: "center",
            gap: 4,
          }}
        >
          <HiOutlineCurrencyYen style={iconStyle} /> {price}
        </div>
      )}
    </div>
  );
};

export const BuyPanel: React.FC<BuyPanelProps> = ({
  isVisible,
  items,
  buyPercent,
  numberValid,
  onItemClick,
  onItemRightClick,
  onItemMouseEnter,
  onItemMouseLeave,
  onClose,
}) => {
  const [selectedIndex, setSelectedIndex] = useState<number>(-1);

  const panelWidth = 360;
  const panelHeight = 460;

  // 位置: 屏幕左侧（与经典 UI 位置类似）
  const panelStyle: React.CSSProperties = useMemo(
    () => ({
      position: "absolute",
      left: 20,
      top: 100,
      width: panelWidth,
      height: panelHeight,
      display: "flex",
      flexDirection: "column",
      ...glassEffect.standard,
      borderRadius: borderRadius.lg,
      pointerEvents: "auto",
    }),
    []
  );

  // 点击处理
  const handleItemClick = useCallback(
    (index: number) => {
      setSelectedIndex(index);
      onItemClick?.(index);
    },
    [onItemClick]
  );

  // 右键购买处理
  const handleItemRightClick = useCallback(
    (index: number) => {
      onItemRightClick?.(index);
    },
    [onItemRightClick]
  );

  // 鼠标悬停处理
  const handleItemMouseEnter = useCallback(
    (index: number, e: React.MouseEvent) => {
      const item = items[index];
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      onItemMouseEnter?.(index, item?.good ?? null, rect);
    },
    [items, onItemMouseEnter]
  );

  if (!isVisible) return null;

  return (
    <div style={panelStyle} onClick={(e) => e.stopPropagation()}>
      <PanelHeader title="商店" onClose={onClose} />

      {/* 提示信息 */}
      <div
        style={{
          padding: `${spacing.xs}px ${spacing.md}px`,
          background: "rgba(0, 0, 0, 0.2)",
          borderBottom: `1px solid ${modernColors.border.glass}`,
          fontSize: typography.fontSize.xs,
          color: modernColors.text.muted,
          textAlign: "center",
        }}
      >
        右键点击物品快速购买
      </div>

      {/* 商品列表（原生滚动） */}
      <div
        className="modern-scrollbar"
        style={{
          flex: 1,
          minHeight: 0,
          padding: spacing.md,
          display: "flex",
          flexDirection: "column",
          gap: spacing.sm,
          overflowY: "auto",
        }}
      >
        {items.length === 0 ? (
          <div
            style={{
              flex: 1,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: modernColors.text.muted,
            }}
          >
            没有商品出售
          </div>
        ) : (
          items.map((item, idx) => (
            <ShopItemRow
              key={`shop-${idx}`}
              item={item}
              index={idx}
              numberValid={numberValid}
              buyPercent={buyPercent}
              isSelected={idx === selectedIndex}
              onClick={() => handleItemClick(idx)}
              onRightClick={() => handleItemRightClick(idx)}
              onMouseEnter={(e) => handleItemMouseEnter(idx, e)}
              onMouseLeave={() => onItemMouseLeave?.()}
            />
          ))
        )}
      </div>
    </div>
  );
};
