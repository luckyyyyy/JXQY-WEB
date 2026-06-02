/**
 * Modern EquipPanel - 武侠风格装备面板
 * 使用毛玻璃效果 + 武侠配色，参考MagicPanel/StatePanel设计
 */

import type { UIGoodData } from "@miu2d/engine/gui/ui-types";
import type React from "react";
import type { ReactNode } from "react";
import { useCallback, useMemo, useState } from "react";
import {
  HiOutlineEye,
  HiOutlineFingerPrint,
  HiOutlineHandRaised,
  HiOutlineShieldCheck,
  HiOutlineSparkles,
  HiOutlineSquares2X2,
  HiOutlineUserCircle,
  HiOutlineXMark,
} from "react-icons/hi2";
import type { TouchDragData } from "../../../contexts";
import { useGameUIContext } from "../../../contexts";
import type { DragData, EquipItemData, EquipSlots, EquipSlotType } from "../classic/EquipGui";
import { slotTypeToEquipPosition } from "../classic/EquipGui";
import { useAsfImage } from "../classic/hooks";
import { getItemBorderColor, getItemGlowColor, getItemQuality, ItemQuality } from "./Tooltips";
import { borderRadius, glassEffect, iconStyle, modernColors, spacing, transitions, typography } from "./theme";

// 武侠风格配色
const wuxiaAccent = {
  gold: "#D4AF37",
  goldBright: "#FFD700",
  goldDark: "#8B7355",
  crimson: "#C41E3A",
  azure: "#4A90D9",
  jade: "#50C878",
  purple: "#9B59B6",
};

interface EquipPanelProps {
  isVisible: boolean;
  equips: EquipSlots;
  onSlotClick?: (slot: EquipSlotType) => void;
  onSlotRightClick?: (slot: EquipSlotType) => void;
  onSlotDrop?: (slot: EquipSlotType, dragData: DragData) => void;
  onSlotDragStart?: (slot: EquipSlotType, good: UIGoodData) => void;
  onSlotMouseEnter?: (slot: EquipSlotType, good: UIGoodData | null, rect: DOMRect) => void;
  onSlotMouseLeave?: () => void;
  onClose: () => void;
  dragData?: DragData | null;
  onTouchDrop?: (slot: EquipSlotType, data: TouchDragData) => void;
}

// 槽位名称
const slotNames: Record<EquipSlotType, string> = {
  head: "头饰",
  neck: "项链",
  body: "衣甲",
  back: "披风",
  hand: "兵器",
  wrist: "护腕",
  foot: "靴履",
};

// 槽位图标
const slotIcons: Record<EquipSlotType, ReactNode> = {
  head: <HiOutlineUserCircle />,
  neck: <HiOutlineFingerPrint />,
  body: <HiOutlineShieldCheck />,
  back: <HiOutlineSquares2X2 />,
  hand: <HiOutlineHandRaised />,
  wrist: <HiOutlineSparkles />,
  foot: <HiOutlineEye />,
};

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

interface EquipSlotItemProps {
  slot: EquipSlotType;
  item: EquipItemData | null | undefined;
  onSlotClick?: () => void;
  onSlotRightClick?: () => void;
  onSlotDrop?: (e: React.DragEvent) => void;
  onSlotDragStart?: (e: React.DragEvent) => void;
  onSlotDragOver?: (e: React.DragEvent) => void;
  onSlotMouseEnter?: (e: React.MouseEvent) => void;
  onSlotMouseMove?: (e: React.MouseEvent) => void;
  onSlotMouseLeave?: () => void;
}

const EquipSlotItem: React.FC<EquipSlotItemProps> = ({
  slot,
  item,
  onSlotClick,
  onSlotRightClick,
  onSlotDrop,
  onSlotDragStart,
  onSlotDragOver,
  onSlotMouseEnter,
  onSlotMouseMove,
  onSlotMouseLeave,
}) => {
  const [isHovered, setIsHovered] = useState(false);
  const itemImage = useAsfImage(item?.good?.iconPath ?? null, 0);
  const hasItem = !!item;

  // 八角形裁剪路径
  const octagonClip =
    "polygon(30% 0%, 70% 0%, 100% 30%, 100% 70%, 70% 100%, 30% 100%, 0% 70%, 0% 30%)";

  // 获取物品品级颜色
  const qualityBorderColor = getItemBorderColor(item?.good);
  const qualityGlowColor = getItemGlowColor(item?.good);
  const _itemQuality = item?.good ? getItemQuality(item.good.cost) : ItemQuality.Normal;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: spacing.xs,
      }}
    >
      {/* 槽位名称 */}
      <span
        style={{
          fontSize: typography.fontSize.xs,
          color: isHovered ? wuxiaAccent.gold : modernColors.text.secondary,
          fontWeight: isHovered ? typography.fontWeight.medium : typography.fontWeight.normal,
          transition: transitions.fast,
        }}
      >
        {slotNames[slot]}
      </span>

      {/* 槽位 - 八角形设计 */}
      <div
        style={{
          width: 56,
          height: 56,
          position: "relative",
          cursor: hasItem ? "grab" : "default",
          transition: transitions.fast,
          transform: isHovered && hasItem ? "scale(1.05)" : "scale(1)",
        }}
        onClick={onSlotClick}
        onContextMenu={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onSlotRightClick?.();
        }}
        onMouseEnter={(e) => {
          setIsHovered(true);
          onSlotMouseEnter?.(e);
        }}
        onMouseMove={(e) => {
          if (item) onSlotMouseMove?.(e);
        }}
        onMouseLeave={() => {
          setIsHovered(false);
          onSlotMouseLeave?.();
        }}
        draggable={hasItem}
        onDragStart={onSlotDragStart}
        onDragOver={onSlotDragOver}
        onDrop={onSlotDrop}
      >
        {/* 外框装饰 - 八角形，根据品级显示颜色 */}
        <div
          style={{
            position: "absolute",
            inset: -2,
            background: hasItem
              ? qualityBorderColor
                ? isHovered
                  ? `linear-gradient(135deg, ${qualityBorderColor}, ${qualityBorderColor})`
                  : `linear-gradient(135deg, ${qualityBorderColor}, ${qualityBorderColor}bb)` // 非 hover 也清晰显示
                : isHovered
                  ? `linear-gradient(135deg, ${wuxiaAccent.goldBright}, ${wuxiaAccent.gold})`
                  : `linear-gradient(135deg, ${wuxiaAccent.gold}, ${wuxiaAccent.goldDark})` // 非 hover 也清晰显示
              : `linear-gradient(135deg, ${modernColors.border.glass}, ${modernColors.border.glass})`,
            clipPath: octagonClip,
            transition: transitions.fast,
            boxShadow: qualityGlowColor
              ? isHovered
                ? `0 0 14px ${qualityGlowColor}`
                : `0 0 8px ${qualityGlowColor}` // 非 hover 也有发光
              : "none",
          }}
        />

        {/* 内部容器 - 八角形 */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: hasItem
              ? isHovered
                ? "rgba(30, 35, 50, 0.9)"
                : "rgba(20, 25, 40, 0.85)"
              : "rgba(10, 15, 25, 0.6)",
            clipPath: octagonClip,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            overflow: "hidden",
            boxShadow: hasItem && isHovered ? `inset 0 0 20px ${wuxiaAccent.gold}33` : "none",
            transition: transitions.fast,
          }}
        >
          {hasItem && itemImage.dataUrl ? (
            <img
              src={itemImage.dataUrl}
              alt={item.good.name}
              style={{
                maxWidth: 40,
                maxHeight: 40,
                imageRendering: "pixelated",
                pointerEvents: "none",
                filter: isHovered ? "brightness(1.2)" : "brightness(1)",
              }}
              draggable={false}
            />
          ) : (
            <span
              style={{
                ...iconStyle,
                fontSize: 20,
                opacity: 0.3,
                filter: "grayscale(100%)",
              }}
            >
              {slotIcons[slot]}
            </span>
          )}
        </div>
      </div>
    </div>
  );
};

export const EquipPanel: React.FC<EquipPanelProps> = ({
  isVisible,
  equips,
  onSlotClick,
  onSlotRightClick,
  onSlotDrop,
  onSlotDragStart,
  onClose,
  dragData,
  onTouchDrop,
}) => {
  const { screenWidth, onGoodsHover, onGoodsLeave } = useGameUIContext();
  const panelWidth = 260;

  // 位置: 屏幕中央偏左
  const panelStyle: React.CSSProperties = useMemo(
    () => ({
      position: "absolute",
      left: screenWidth / 2 - panelWidth - 20,
      top: 46,
      width: panelWidth,
      display: "flex",
      flexDirection: "column",
      // 毛玻璃效果
      ...glassEffect.standard,
      borderRadius: borderRadius.xl,
      // 金色边框装饰
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

  // 拖放处理
  const handleDragOver = useCallback(
    (_slot: EquipSlotType) => (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
    },
    []
  );

  const handleDrop = useCallback(
    (slot: EquipSlotType) => (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (dragData) {
        const slotPosition = slotTypeToEquipPosition(slot);
        if (dragData.good.part === slotPosition) {
          onSlotDrop?.(slot, dragData);
        }
      }
    },
    [dragData, onSlotDrop]
  );

  const handleDragStart = useCallback(
    (slot: EquipSlotType) => (e: React.DragEvent) => {
      const item = equips[slot];
      if (item) {
        onSlotDragStart?.(slot, item.good);
        if (e.dataTransfer) {
          e.dataTransfer.effectAllowed = "move";
        }
      }
    },
    [equips, onSlotDragStart]
  );

  const handleMouseEnter = useCallback(
    (slot: EquipSlotType) => (e: React.MouseEvent) => {
      const item = equips[slot];
      const good = item?.good ?? null;
      if (good) {
        onGoodsHover({ good, count: 1 }, e.clientX, e.clientY);
      }
    },
    [equips, onGoodsHover]
  );

  const handleMouseMove = useCallback(
    (slot: EquipSlotType) => (e: React.MouseEvent) => {
      const item = equips[slot];
      const good = item?.good ?? null;
      if (good) {
        onGoodsHover({ good, count: 1 }, e.clientX, e.clientY);
      }
    },
    [equips, onGoodsHover]
  );

  // 统计已装备数量
  const equippedCount = useMemo(() => {
    return Object.values(equips).filter((item) => item !== null && item !== undefined).length;
  }, [equips]);

  if (!isVisible) return null;

  // 装备槽位布局
  const topRow: EquipSlotType[] = ["head", "neck"];
  const middleRow: EquipSlotType[] = ["body", "hand", "back"];
  const bottomRow: EquipSlotType[] = ["wrist", "foot"];

  return (
    <div style={panelStyle} onClick={(e) => e.stopPropagation()}>
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
          {/* 装备图标 - 八角形 */}
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
              <HiOutlineShieldCheck
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
              随身装备
            </div>
            <div
              style={{
                fontSize: typography.fontSize.sm,
                color: modernColors.text.secondary,
              }}
            >
              已装备{" "}
              <span style={{ color: wuxiaAccent.gold, fontWeight: typography.fontWeight.semibold }}>
                {equippedCount}
              </span>{" "}
              / 7 件
            </div>
          </div>
        </div>
      </div>

      {/* 装备槽位区域 */}
      <div
        style={{
          padding: spacing.lg,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: spacing.lg,
        }}
      >
        {/* 顶部: 头部、项链 */}
        <div style={{ display: "flex", gap: spacing.xl }}>
          {topRow.map((slot) => (
            <EquipSlotItem
              key={slot}
              slot={slot}
              item={equips[slot]}
              onSlotClick={() => onSlotClick?.(slot)}
              onSlotRightClick={() => onSlotRightClick?.(slot)}
              onSlotDrop={handleDrop(slot)}
              onSlotDragStart={handleDragStart(slot)}
              onSlotDragOver={handleDragOver(slot)}
              onSlotMouseEnter={handleMouseEnter(slot)}
              onSlotMouseMove={handleMouseMove(slot)}
              onSlotMouseLeave={onGoodsLeave}
            />
          ))}
        </div>

        {/* 中间: 衣服、武器、披风 */}
        <div style={{ display: "flex", gap: spacing.md }}>
          {middleRow.map((slot) => (
            <EquipSlotItem
              key={slot}
              slot={slot}
              item={equips[slot]}
              onSlotClick={() => onSlotClick?.(slot)}
              onSlotRightClick={() => onSlotRightClick?.(slot)}
              onSlotDrop={handleDrop(slot)}
              onSlotDragStart={handleDragStart(slot)}
              onSlotDragOver={handleDragOver(slot)}
              onSlotMouseEnter={handleMouseEnter(slot)}
              onSlotMouseMove={handleMouseMove(slot)}
              onSlotMouseLeave={onGoodsLeave}
            />
          ))}
        </div>

        {/* 底部: 护腕、鞋子 */}
        <div style={{ display: "flex", gap: spacing.xl }}>
          {bottomRow.map((slot) => (
            <EquipSlotItem
              key={slot}
              slot={slot}
              item={equips[slot]}
              onSlotClick={() => onSlotClick?.(slot)}
              onSlotRightClick={() => onSlotRightClick?.(slot)}
              onSlotDrop={handleDrop(slot)}
              onSlotDragStart={handleDragStart(slot)}
              onSlotDragOver={handleDragOver(slot)}
              onSlotMouseEnter={handleMouseEnter(slot)}
              onSlotMouseMove={handleMouseMove(slot)}
              onSlotMouseLeave={onGoodsLeave}
            />
          ))}
        </div>
      </div>

      {/* 底部提示 */}
      <div
        style={{
          padding: `${spacing.sm}px ${spacing.lg}px ${spacing.md}px`,
          borderTop: `1px solid ${modernColors.border.glass}`,
          background: modernColors.bg.glassDark,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: spacing.md,
        }}
      >
        <span style={{ fontSize: typography.fontSize.xs, color: modernColors.text.muted }}>
          <span style={{ color: wuxiaAccent.azure }}>拖拽</span> 物品到槽位装备
        </span>
        <span style={{ color: modernColors.border.glass }}>|</span>
        <span style={{ fontSize: typography.fontSize.xs, color: modernColors.text.muted }}>
          <span style={{ color: wuxiaAccent.azure }}>右键</span> 卸下装备
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
