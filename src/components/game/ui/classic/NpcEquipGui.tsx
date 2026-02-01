/**
 * NpcEquipGui Component - based on JxqyHD Engine/Gui/NpcEquipGui.cs
 * Displays NPC equipment slots with drag-drop support
 *
 * C# Reference: NpcEquipGui.cs shows 7 equipment slots for NPC (head, neck, body, back, hand, wrist, foot)
 * Similar to EquipGui but for viewing/managing NPC equipment
 */
import type React from "react";
import { useCallback, useMemo } from "react";
import type { Character } from "@/engine/character/character";
import type { Good } from "@/engine/player/goods";
import { useDevice } from "@/contexts";
import { useTouchDragSource } from "@/hooks/useTouchDragSource";
import { useAsfImage } from "./hooks";
import { useNpcEquipGuiConfig } from "./useUISettings";

// Equipment slot type (same as EquipGui)
export type EquipSlotType = "head" | "neck" | "body" | "back" | "hand" | "wrist" | "foot";

// Equipped item data
export interface EquipItemData {
  good: Good;
  count: number;
}

// Equipment slots data
export type EquipSlots = Partial<Record<EquipSlotType, EquipItemData | null>>;

// Drag data for drag-drop operations
export interface DragData {
  type: "equip" | "goods" | "bottom" | "npcEquip";
  index: number;
  good: Good;
  sourceSlot?: EquipSlotType;
}

interface NpcEquipGuiProps {
  isVisible: boolean;
  character: Character | null; // 当前显示装备的 NPC
  equips: EquipSlots;
  screenWidth: number;
  onSlotClick?: (slot: EquipSlotType) => void;
  onSlotRightClick?: (slot: EquipSlotType) => void;
  onSlotDrop?: (slot: EquipSlotType, dragData: DragData) => void;
  onSlotDragStart?: (slot: EquipSlotType, good: Good) => void;
  onSlotMouseEnter?: (slot: EquipSlotType, good: Good | null, rect: DOMRect) => void;
  onSlotMouseLeave?: () => void;
  onClose?: () => void;
  dragData?: DragData | null;
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

// Map slot type to EquipPosition
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
            source: "npcEquipGui",
            goodsInfo: item.good,
            displayName: item.good.name,
            iconPath: item.good.imagePath,
          }
        : null,
    onClick,
    enabled: isMobile,
  });

  return (
    <div
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
          {/* Count display */}
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

export const NpcEquipGui: React.FC<NpcEquipGuiProps> = ({
  isVisible,
  character,
  equips,
  screenWidth,
  onSlotClick,
  onSlotRightClick,
  onSlotDrop,
  onSlotDragStart,
  onSlotMouseEnter,
  onSlotMouseLeave,
  dragData,
}) => {
  // Load config from UI_Settings.ini [NpcEquip] section
  const config = useNpcEquipGuiConfig();

  // 如果 NPC 有自定义背景图，使用自定义图；否则使用配置的默认图
  const backgroundImage = character?.backgroundTextureEquip || config?.panel.image || "asf/ui/common/panel7.asf";
  const panelImage = useAsfImage(backgroundImage);

  // Calculate panel position - C#: Globals.WindowWidth / 2f - Width + leftAdjust
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
      if (dragData.type === "npcEquip" && dragData.sourceSlot === slot) return false;

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
          alt="NPC装备面板"
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

      {/* NPC name display */}
      {character && (
        <div
          style={{
            position: "absolute",
            top: 40,
            left: 0,
            right: 0,
            textAlign: "center",
            color: "rgba(88, 32, 32, 0.9)",
            fontSize: 14,
            fontWeight: "bold",
            textShadow: "0 1px 2px rgba(255,255,255,0.3)",
            pointerEvents: "none",
          }}
        >
          {character.name}
        </div>
      )}

      {/* Equipment slots */}
      {slots.map(([slotType, slotConfig]) => (
        <EquipSlot
          key={slotType}
          slot={slotType}
          item={equips[slotType]}
          config={slotConfig}
          onClick={() => onSlotClick?.(slotType)}
          onRightClick={() => onSlotRightClick?.(slotType)}
          onDrop={handleDrop(slotType)}
          onDragOver={handleDragOver(slotType)}
          onDragStart={handleDragStart(slotType)}
          onMouseEnter={handleMouseEnter(slotType)}
          onMouseLeave={onSlotMouseLeave}
        />
      ))}
    </div>
  );
};
