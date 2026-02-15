/**
 * EquipGui Component - based on JxqyHD Engine/Gui/EquipGui.cs
 * Displays player equipment slots with full drag-drop support
 *
 * shows 7 equipment slots (head, neck, body, back, hand, wrist, foot)
 * Resources loaded from UI_Settings.ini
 */

import type { Good } from "@miu2d/engine/player/goods";
import { useDevice } from "@miu2d/shared";
import type React from "react";
import { useCallback, useMemo } from "react";
import type { TouchDragData } from "../../../contexts";
import { useTouchDragSource, useTouchDropTarget } from "../../../hooks";
import { useAsfImage } from "./hooks";
import { useEquipGuiConfig } from "./useUISettings";

// Equipment slot type
export type EquipSlotType = "head" | "neck" | "body" | "back" | "hand" | "wrist" | "foot";

// Map EquipPosition enum to slot type
export function equipPositionToSlotType(position: number): EquipSlotType | null {
  switch (position) {
    case 1:
      return "head";
    case 2:
      return "neck";
    case 3:
      return "body";
    case 4:
      return "back";
    case 5:
      return "hand";
    case 6:
      return "wrist";
    case 7:
      return "foot";
    default:
      return null;
  }
}

export function slotTypeToEquipPosition(slot: EquipSlotType): number {
  switch (slot) {
    case "head":
      return 1;
    case "neck":
      return 2;
    case "body":
      return 3;
    case "back":
      return 4;
    case "hand":
      return 5;
    case "wrist":
      return 6;
    case "foot":
      return 7;
  }
}

// Equipped item data
export interface EquipItemData {
  good: Good;
  count: number;
}

// Equipment slots data
export type EquipSlots = Partial<Record<EquipSlotType, EquipItemData | null>>;

// Drag data for drag-drop operations
export interface DragData {
  type: "equip" | "goods" | "bottom";
  index: number;
  good: Good;
  sourceSlot?: EquipSlotType;
}

interface EquipGuiProps {
  isVisible: boolean;
  equips: EquipSlots;
  screenWidth: number;
  onSlotClick?: (slot: EquipSlotType) => void;
  onSlotRightClick?: (slot: EquipSlotType) => void;
  onSlotDrop?: (slot: EquipSlotType, dragData: DragData) => void;
  onSlotDragStart?: (slot: EquipSlotType, good: Good) => void;
  onSlotMouseEnter?: (slot: EquipSlotType, good: Good | null, rect: DOMRect) => void;
  onSlotMouseLeave?: () => void;
  onClose: () => void;
  dragData?: DragData | null;
  /** 移动端触摸拖拽 drop 回调 */
  onTouchDrop?: (slot: EquipSlotType, data: TouchDragData) => void;
}

// Slot names for display
const slotNames: Record<EquipSlotType, string> = {
  head: "头部",
  neck: "项链",
  body: "衣服",
  back: "披风",
  hand: "武器",
  wrist: "护腕",
  foot: "鞋子",
};

/**
 * Single equipment slot component with drag-drop support
 */
interface EquipSlotProps {
  slot: EquipSlotType;
  item: EquipItemData | null | undefined;
  config: { left: number; top: number; width: number; height: number };
  onClick?: () => void;
  onRightClick?: (e: React.MouseEvent) => void;
  onDrop?: (e: React.DragEvent) => void;
  onDragStart?: (e: React.DragEvent) => void;
  onDragOver?: (e: React.DragEvent) => void;
  onMouseEnter?: (e: React.MouseEvent) => void;
  onMouseLeave?: () => void;
  /** 触摸拖拽 drop 回调 */
  onTouchDrop?: (data: TouchDragData) => void;
}

const EquipSlot: React.FC<EquipSlotProps> = ({
  slot,
  item,
  config,
  onClick,
  onRightClick,
  onDrop,
  onDragStart,
  onDragOver,
  onMouseEnter,
  onMouseLeave,
  onTouchDrop,
}) => {
  const itemImage = useAsfImage(item?.good?.imagePath ?? null, 0);
  const { isMobile } = useDevice();

  // 触摸拖拽支持（仅移动端）
  const touchHandlers = useTouchDragSource({
    hasContent: !!item,
    getDragData: () =>
      item
        ? {
            type: "equip",
            equipSlot: slot,
            source: "equipGui",
            goodsInfo: item.good,
            displayName: item.good.name,
            iconPath: item.good.imagePath,
          }
        : null,
    onClick,
    enabled: isMobile,
  });

  // 触摸拖拽目标（仅移动端）- 接受物品和装备拖拽
  const dropRef = useTouchDropTarget({
    id: `equip-slot-${slot}`,
    onDrop: (data) => {
      console.log(
        "[EquipGui] EquipSlot onDrop:",
        data.type,
        "bagIndex:",
        data.bagIndex,
        "equipSlot:",
        data.equipSlot,
        "target slot:",
        slot
      );
      onTouchDrop?.(data);
    },
    canDrop: (data) => data.type === "goods" || data.type === "equip",
    enabled: isMobile,
  });

  return (
    <div
      ref={dropRef}
      style={{
        position: "absolute",
        left: config.left,
        top: config.top,
        width: config.width,
        height: config.height,
        cursor: item ? "grab" : "default",
        borderRadius: 2,
        touchAction: isMobile ? "none" : undefined,
      }}
      title={item?.good?.name || slotNames[slot]}
      onClick={onClick}
      onContextMenu={
        !isMobile
          ? (e) => {
              e.preventDefault();
              e.stopPropagation();
              onRightClick?.(e);
            }
          : undefined
      }
      // PC 端拖放事件
      onDrop={!isMobile ? onDrop : undefined}
      onDragOver={!isMobile ? onDragOver : undefined}
      // PC 端鼠标事件
      onMouseEnter={!isMobile ? onMouseEnter : undefined}
      onMouseLeave={!isMobile ? onMouseLeave : undefined}
      // 移动端触摸事件
      {...touchHandlers}
    >
      {item && itemImage.dataUrl && (
        <>
          <img
            src={itemImage.dataUrl}
            alt={item.good.name}
            draggable={!isMobile}
            onDragStart={!isMobile ? onDragStart : undefined}
            style={{
              position: "absolute",
              left: (config.width - itemImage.width) / 2,
              top: (config.height - itemImage.height) / 2,
              width: itemImage.width,
              height: itemImage.height,
              imageRendering: "pixelated",
              cursor: "grab",
            }}
          />
          {/* Count display - always show count like TopLeftText */}
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

export const EquipGui: React.FC<EquipGuiProps> = ({
  isVisible,
  equips,
  screenWidth,
  onSlotClick,
  onSlotRightClick,
  onSlotDrop,
  onSlotDragStart,
  onSlotMouseEnter,
  onSlotMouseLeave,
  dragData,
  onTouchDrop,
}) => {
  // Load config from UI_Settings.ini
  const config = useEquipGuiConfig();

  // Load panel background
  const panelImage = useAsfImage(config?.panel.image || "asf/ui/common/panel7.asf");

  // Calculate panel position - Globals.WindowWidth / 2f - Width + leftAdjust
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

  // Check if drag can be dropped in slot
  const canDropInSlot = useCallback(
    (slot: EquipSlotType): boolean => {
      if (!dragData) return false;
      if (dragData.type === "equip" && dragData.sourceSlot === slot) return false;

      // Check if item's part matches slot
      const slotPosition = slotTypeToEquipPosition(slot);
      return dragData.good.part === slotPosition;
    },
    [dragData]
  );

  // Handle drag over
  const handleDragOver = useCallback(
    (_slot: EquipSlotType) => (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
    },
    []
  );

  // Handle drop
  const handleDrop = useCallback(
    (slot: EquipSlotType) => (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();

      if (dragData && canDropInSlot(slot)) {
        onSlotDrop?.(slot, dragData);
      }
    },
    [dragData, canDropInSlot, onSlotDrop]
  );

  // Handle drag start
  const handleDragStart = useCallback(
    (slot: EquipSlotType) => (e: React.DragEvent) => {
      const item = equips[slot];
      if (item) {
        onSlotDragStart?.(slot, item.good);
        if (e.dataTransfer) {
          e.dataTransfer.effectAllowed = "move";
          // 使用img元素作为拖拽图像
          const img = e.currentTarget.querySelector("img");
          if (img) {
            e.dataTransfer.setDragImage(img, img.width / 2, img.height / 2);
          }
        }
      }
    },
    [equips, onSlotDragStart]
  );

  // Handle mouse enter for tooltip
  const handleMouseEnter = useCallback(
    (slot: EquipSlotType) => (e: React.MouseEvent) => {
      const item = equips[slot];
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      onSlotMouseEnter?.(slot, item?.good ?? null, rect);
    },
    [equips, onSlotMouseEnter]
  );

  if (!isVisible || !config || !panelStyle) return null;

  // Build slot list
  const slots: [EquipSlotType, { left: number; top: number; width: number; height: number }][] = [
    ["head", config.head],
    ["neck", config.neck],
    ["body", config.body],
    ["back", config.back],
    ["hand", config.hand],
    ["wrist", config.wrist],
    ["foot", config.foot],
  ];

  return (
    <div style={panelStyle} onClick={(e) => e.stopPropagation()}>
      {/* Background panel */}
      {panelImage.dataUrl && (
        <img
          src={panelImage.dataUrl}
          alt="装备面板"
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

      {/* Equipment slots */}
      {slots.map(([slotType, slotConfig]) => {
        const item = equips[slotType];
        // 使用装备名称作为 key 的一部分，确保装备变化时组件正确重新渲染
        const contentKey = item?.good?.name ?? "empty";
        return (
          <EquipSlot
            key={`${slotType}-${contentKey}`}
            slot={slotType}
            item={item}
            config={slotConfig}
            onClick={() => onSlotClick?.(slotType)}
            onRightClick={() => onSlotRightClick?.(slotType)}
            onDrop={handleDrop(slotType)}
            onDragOver={handleDragOver(slotType)}
            onDragStart={handleDragStart(slotType)}
            onMouseEnter={handleMouseEnter(slotType)}
            onMouseLeave={onSlotMouseLeave}
            onTouchDrop={(data) => onTouchDrop?.(slotType, data)}
          />
        );
      })}
    </div>
  );
};
