/**
 * Modern PartnerPanel - 伙伴管理面板
 * 毛玻璃效果 + 武侠配色
 * 包含：伙伴选择、装备栏、武功栏、主角物品栏
 */

import type { MagicItemInfo } from "@miu2d/engine/magic";
import type { UIGoodData } from "@miu2d/engine/gui/ui-types";
import { MAGIC_LIST_CONFIG } from "@miu2d/engine/player/magic/magic-list-config";
import type React from "react";
import { useCallback, useMemo, useState } from "react";
import type { TouchDragData } from "../../../contexts";
import { useGameUIContext } from "../../../contexts";
import type { BottomMagicDragData } from "../../hooks";
import { AsfAnimatedSprite } from "../classic/AsfAnimatedSprite";
import type { DragData, EquipItemData, EquipSlots, EquipSlotType } from "../classic/EquipGui";
import { slotTypeToEquipPosition } from "../classic/EquipGui";
import type { GoodItemData } from "../classic/GoodsGui";
import type { MagicDragData } from "../classic/MagicGui";
import { useAsfImage } from "../classic/hooks";
import { getItemBorderColor, getItemGlowColor, getItemQuality, ItemQuality } from "./Tooltips";
import { borderRadius, glassEffect, modernColors, spacing, transitions, typography } from "./theme";

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

// ============= Types =============

export interface PartnerDisplayData {
  name: string;
  level: number;
  portraitPath: string | null;
  canEquip: boolean;
}

interface PartnerPanelProps {
  isVisible: boolean;
  // 伙伴列表
  partners: PartnerDisplayData[];
  selectedPartnerIndex: number;
  onSelectPartner: (index: number) => void;
  // 装备
  equips: EquipSlots;
  onEquipDrop?: (slot: EquipSlotType, dragData: DragData) => void;
  onEquipRightClick?: (slot: EquipSlotType) => void;
  onEquipDragStart?: (slot: EquipSlotType, good: UIGoodData) => void;
  onEquipMouseEnter?: (slot: EquipSlotType, good: UIGoodData | null, rect: DOMRect) => void;
  onEquipMouseLeave?: () => void;
  // 武功
  magicInfos?: (MagicItemInfo | null)[];
  bottomMagics?: (MagicItemInfo | null)[];
  onMagicClick?: (storeIndex: number) => void;
  onMagicRightClick?: (storeIndex: number) => void;
  onMagicDragStart?: (data: MagicDragData) => void;
  onMagicDragEnd?: () => void;
  onMagicDrop?: (targetStoreIndex: number, source: MagicDragData) => void;
  onBottomMagicDrop?: (targetBottomSlot: number, source: MagicDragData | BottomMagicDragData, targetStoreIndex?: number) => void;
  onBottomMagicDragStart?: (bottomSlot: number) => void;
  onMagicHover?: (magicInfo: MagicItemInfo | null, x: number, y: number) => void;
  onMagicLeave?: () => void;
  // 主角物品栏
  playerItems: (GoodItemData | null)[];
  playerMoney: number;
  onPlayerItemClick?: (index: number) => void;
  onPlayerItemRightClick?: (index: number) => void;
  onPlayerItemDragStart?: (index: number, good: UIGoodData) => void;
  onPlayerItemDrop?: (targetIndex: number, dragData: DragData) => void;
  onPlayerItemHover?: (good: UIGoodData | null, x: number, y: number) => void;
  onPlayerItemLeave?: () => void;
  // 拖拽状态
  dragData?: DragData | null;
  magicDragData?: MagicDragData | null;
  bottomMagicDragData?: BottomMagicDragData | null;
  onTouchDrop?: (slot: EquipSlotType, data: TouchDragData) => void;
  onPlayerItemTouchDrop?: (targetIndex: number, data: TouchDragData) => void;
  // 关闭
  onClose: () => void;
}

// ============= Slot Names & Icons =============

const slotNames: Record<EquipSlotType, string> = {
  head: "头饰",
  neck: "项链",
  body: "衣甲",
  back: "披风",
  hand: "兵器",
  wrist: "护腕",
  foot: "靴履",
};

const slotIcons: Record<EquipSlotType, string> = {
  head: "👑",
  neck: "📿",
  body: "🥋",
  back: "🧣",
  hand: "⚔️",
  wrist: "💎",
  foot: "👢",
};

// ============= Sub Components =============

/** 关闭按钮 */
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
    ✕
  </button>
);

/** 分区标题 */
const SectionTitle: React.FC<{ title: string; icon: string }> = ({ title, icon }) => (
  <div
    style={{
      display: "flex",
      alignItems: "center",
      gap: spacing.sm,
      marginBottom: spacing.sm,
    }}
  >
    <span style={{ fontSize: 14 }}>{icon}</span>
    <span
      style={{
        fontSize: typography.fontSize.sm,
        fontWeight: typography.fontWeight.semibold,
        color: wuxiaAccent.gold,
      }}
    >
      {title}
    </span>
    <span
      style={{
        flex: 1,
        height: 1,
        background: `linear-gradient(90deg, ${wuxiaAccent.goldDark}66, transparent)`,
      }}
    />
  </div>
);

/** 伙伴肖像 */
const PartnerPortrait: React.FC<{
  partner: PartnerDisplayData;
  isSelected: boolean;
  onClick: () => void;
}> = ({ partner, isSelected, onClick }) => {
  const [hovered, setHovered] = useState(false);
  const portrait = useAsfImage(partner.portraitPath, 0);

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 2,
        cursor: "pointer",
        padding: `${spacing.xs}px ${spacing.sm}px`,
        borderRadius: borderRadius.md,
        background: isSelected
          ? "rgba(212,175,55,0.15)"
          : hovered
            ? modernColors.bg.hover
            : "transparent",
        border: `1px solid ${isSelected ? wuxiaAccent.goldDark + "88" : "transparent"}`,
        transition: transitions.fast,
        transform: hovered ? "scale(1.05)" : "scale(1)",
        minWidth: 56,
      }}
    >
      <div
        style={{
          width: 40,
          height: 40,
          borderRadius: borderRadius.round,
          overflow: "hidden",
          border: `2px solid ${isSelected ? wuxiaAccent.gold : wuxiaAccent.goldDark + "44"}`,
          background: modernColors.bg.glassDark,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {portrait.dataUrl ? (
          <img
            src={portrait.dataUrl}
            alt={partner.name}
            style={{
              width: 36,
              height: 36,
              imageRendering: "pixelated",
              pointerEvents: "none",
            }}
            draggable={false}
          />
        ) : (
          <span style={{ fontSize: 18, opacity: 0.5 }}>👤</span>
        )}
      </div>
      <span
        style={{
          fontSize: typography.fontSize.xs,
          color: isSelected ? wuxiaAccent.gold : modernColors.text.secondary,
          fontWeight: isSelected ? typography.fontWeight.semibold : typography.fontWeight.normal,
          maxWidth: 52,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
          textAlign: "center",
        }}
      >
        {partner.name}
      </span>
      <span
        style={{
          fontSize: 9,
          color: modernColors.text.muted,
        }}
      >
        Lv.{partner.level}
      </span>
    </div>
  );
};

/** 装备槽位 */
const EquipSlotItem: React.FC<{
  slot: EquipSlotType;
  item: EquipItemData | null | undefined;
  onSlotClick?: () => void;
  onSlotRightClick?: () => void;
  onSlotDrop?: (e: React.DragEvent) => void;
  onSlotDragStart?: (e: React.DragEvent) => void;
  onSlotMouseEnter?: (e: React.MouseEvent) => void;
  onSlotMouseLeave?: () => void;
}> = ({ slot, item, onSlotClick, onSlotRightClick, onSlotDrop, onSlotDragStart, onSlotMouseEnter, onSlotMouseLeave }) => {
  const [isHovered, setIsHovered] = useState(false);
  const itemImage = useAsfImage(item?.good?.iconPath ?? null, 0);
  const hasItem = !!item;
  const octagonClip = "polygon(30% 0%, 70% 0%, 100% 30%, 100% 70%, 70% 100%, 30% 100%, 0% 70%, 0% 30%)";

  const qualityBorderColor = getItemBorderColor(item?.good);
  const qualityGlowColor = getItemGlowColor(item?.good);

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
      <span
        style={{
          fontSize: typography.fontSize.xs,
          color: isHovered ? wuxiaAccent.gold : modernColors.text.secondary,
          transition: transitions.fast,
        }}
      >
        {slotNames[slot]}
      </span>
      <div
        style={{
          width: 48,
          height: 48,
          position: "relative",
          cursor: hasItem ? "grab" : "default",
          transition: transitions.fast,
          transform: isHovered && hasItem ? "scale(1.08)" : "scale(1)",
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
        onMouseLeave={() => {
          setIsHovered(false);
          onSlotMouseLeave?.();
        }}
        draggable={hasItem}
        onDragStart={onSlotDragStart}
        onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
        onDrop={onSlotDrop}
      >
        <div
          style={{
            position: "absolute",
            inset: -2,
            background: hasItem
              ? qualityBorderColor
                ? `linear-gradient(135deg, ${qualityBorderColor}, ${qualityBorderColor}bb)`
                : isHovered
                  ? `linear-gradient(135deg, ${wuxiaAccent.goldBright}, ${wuxiaAccent.gold})`
                  : `linear-gradient(135deg, ${wuxiaAccent.gold}, ${wuxiaAccent.goldDark})`
              : `linear-gradient(135deg, ${modernColors.border.glass}, ${modernColors.border.glass})`,
            clipPath: octagonClip,
            transition: transitions.fast,
            boxShadow: qualityGlowColor
              ? isHovered
                ? `0 0 14px ${qualityGlowColor}`
                : `0 0 8px ${qualityGlowColor}`
              : "none",
          }}
        />
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: hasItem
              ? isHovered ? "rgba(30, 35, 50, 0.9)" : "rgba(20, 25, 40, 0.85)"
              : "rgba(10, 15, 25, 0.6)",
            clipPath: octagonClip,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            overflow: "hidden",
            transition: transitions.fast,
          }}
        >
          {hasItem && itemImage.dataUrl ? (
            <img
              src={itemImage.dataUrl}
              alt={item.good.name}
              style={{ maxWidth: 34, maxHeight: 34, imageRendering: "pixelated", pointerEvents: "none" }}
              draggable={false}
            />
          ) : (
            <span style={{ fontSize: 16, opacity: 0.3, filter: "grayscale(100%)" }}>{slotIcons[slot]}</span>
          )}
        </div>
      </div>
    </div>
  );
};

/** 武功槽位 */
const MagicSlotItem: React.FC<{
  magicInfo: MagicItemInfo | null;
  isDragging?: boolean;
  onClick?: () => void;
  onRightClick?: () => void;
  onDragStart?: () => void;
  onDragEnd?: () => void;
  onDrop?: () => void;
  onMouseEnter?: (e: React.MouseEvent) => void;
  onMouseLeave?: () => void;
}> = ({ magicInfo, isDragging, onClick, onRightClick, onDragStart, onDragEnd, onDrop, onMouseEnter, onMouseLeave }) => {
  const [isHovered, setIsHovered] = useState(false);
  const iconPath = magicInfo?.magic?.icon ?? magicInfo?.magic?.image ?? null;
  const hasMagic = !!magicInfo?.magic;
  const hexClip = "polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)";

  return (
    <div
      style={{
        width: 56,
        height: 62,
        position: "relative",
        cursor: hasMagic ? "grab" : "default",
        transition: transitions.fast,
        transform: isHovered && hasMagic ? "scale(1.08)" : "scale(1)",
        opacity: isDragging ? 0.5 : 1,
      }}
      onClick={hasMagic ? onClick : undefined}
      onContextMenu={(e) => {
        e.preventDefault();
        e.stopPropagation();
        if (hasMagic) onRightClick?.();
      }}
      onMouseEnter={(e) => {
        setIsHovered(true);
        if (hasMagic) onMouseEnter?.(e);
      }}
      onMouseLeave={() => {
        setIsHovered(false);
        onMouseLeave?.();
      }}
      draggable={hasMagic}
      onDragStart={(e) => {
        if (hasMagic) {
          e.dataTransfer.effectAllowed = "move";
          onDragStart?.();
        }
      }}
      onDragEnd={onDragEnd}
      onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; }}
      onDrop={(e) => { e.preventDefault(); onDrop?.(); }}
    >
      <div
        style={{
          position: "absolute",
          inset: -2,
          background: hasMagic
            ? isHovered
              ? `linear-gradient(135deg, ${wuxiaAccent.goldBright}, ${wuxiaAccent.gold})`
              : `linear-gradient(135deg, ${wuxiaAccent.gold}88, ${wuxiaAccent.goldDark}88)`
            : `linear-gradient(135deg, ${modernColors.border.glass}, ${modernColors.border.glass})`,
          clipPath: hexClip,
          transition: transitions.fast,
        }}
      />
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: hasMagic
            ? isHovered ? "rgba(30, 35, 50, 0.9)" : "rgba(20, 25, 40, 0.85)"
            : "rgba(10, 15, 25, 0.6)",
          clipPath: hexClip,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          overflow: "hidden",
          transition: transitions.fast,
        }}
      >
        {hasMagic && iconPath && (
          <AsfAnimatedSprite
            path={iconPath}
            autoPlay={true}
            loop={true}
            style={{ maxWidth: 36, maxHeight: 36, pointerEvents: "none", filter: isHovered ? "brightness(1.2)" : "brightness(1)" }}
            alt={magicInfo?.magic?.name ?? ""}
          />
        )}
        {!hasMagic && (
          <div style={{ width: 18, height: 18, border: `1px dashed ${modernColors.border.glass}`, borderRadius: borderRadius.sm, opacity: 0.3 }} />
        )}
      </div>
      {hasMagic && (magicInfo?.level ?? 0) > 0 && (
        <div
          style={{
            position: "absolute",
            bottom: 2,
            right: 2,
            minWidth: 16,
            height: 16,
            padding: "0 3px",
            background: `linear-gradient(135deg, ${wuxiaAccent.crimson}, ${wuxiaAccent.crimson}cc)`,
            borderRadius: 8,
            border: `1px solid ${wuxiaAccent.goldDark}`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: "0 2px 4px rgba(0,0,0,0.4)",
          }}
        >
          <span style={{ fontSize: 9, fontWeight: typography.fontWeight.bold, color: modernColors.text.primary, textShadow: "0 1px 2px rgba(0,0,0,0.5)" }}>
            {magicInfo?.level}
          </span>
        </div>
      )}
    </div>
  );
};

/** 物品槽位 */
const GoodsSlotItem: React.FC<{
  item: GoodItemData | null;
  actualIndex: number;
  slotSize: number;
  onClick?: () => void;
  onRightClick?: () => void;
  onDrop?: (e: React.DragEvent) => void;
  onDragStart?: (e: React.DragEvent) => void;
  onMouseEnter?: (e: React.MouseEvent) => void;
  onMouseLeave?: () => void;
}> = ({ item, slotSize, onClick, onRightClick, onDrop, onDragStart, onMouseEnter, onMouseLeave }) => {
  const [isHovered, setIsHovered] = useState(false);
  const itemImage = useAsfImage(item?.good?.iconPath ?? null, 0);
  const qualityBorderColor = getItemBorderColor(item?.good);
  const qualityGlowColor = getItemGlowColor(item?.good);
  const iconSize = slotSize - 8;

  const borderColor = qualityBorderColor
    ? qualityBorderColor
    : isHovered ? modernColors.border.glassLight : modernColors.border.glass;

  return (
    <div
      style={{
        width: slotSize,
        height: slotSize,
        position: "relative",
        cursor: item ? "grab" : "default",
        transition: transitions.fast,
        transform: isHovered && item ? "scale(1.05)" : "scale(1)",
      }}
      onClick={onClick}
      onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); onRightClick?.(); }}
      onMouseEnter={(e) => { setIsHovered(true); onMouseEnter?.(e); }}
      onMouseLeave={() => { setIsHovered(false); onMouseLeave?.(); }}
      draggable={!!item}
      onDragStart={onDragStart}
      onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
      onDrop={onDrop}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: `linear-gradient(135deg, ${borderColor}, ${qualityBorderColor ? borderColor + "cc" : borderColor + "88"})`,
          borderRadius: borderRadius.md,
          transition: transitions.fast,
          boxShadow: qualityGlowColor
            ? isHovered ? `0 0 12px ${qualityGlowColor}` : `0 0 6px ${qualityGlowColor}`
            : "none",
        }}
      />
      <div
        style={{
          position: "absolute",
          inset: 2,
          background: item
            ? isHovered ? "rgba(40, 45, 60, 0.95)" : "rgba(25, 30, 45, 0.9)"
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
            style={{ maxWidth: iconSize, maxHeight: iconSize, imageRendering: "pixelated", pointerEvents: "none" }}
            draggable={false}
          />
        ) : (
          <div style={{ width: "60%", height: "60%", border: `1px dashed ${modernColors.border.glass}`, borderRadius: borderRadius.sm, opacity: 0.3 }} />
        )}
      </div>
      {item && item.count > 1 && (
        <span
          style={{
            position: "absolute",
            bottom: 3,
            right: 5,
            fontSize: 9,
            fontWeight: typography.fontWeight.bold,
            color: modernColors.text.primary,
            textShadow: "0 1px 3px rgba(0,0,0,0.9)",
            zIndex: 2,
          }}
        >
          {item.count}
        </span>
      )}
    </div>
  );
};

// ============= Main Component =============

export const PartnerPanel: React.FC<PartnerPanelProps> = ({
  isVisible,
  partners,
  selectedPartnerIndex,
  onSelectPartner,
  equips,
  onEquipDrop,
  onEquipRightClick,
  onEquipDragStart,
  onEquipMouseEnter,
  onEquipMouseLeave,
  magicInfos,
  bottomMagics,
  onMagicClick,
  onMagicRightClick,
  onMagicDragStart,
  onMagicDragEnd,
  onMagicDrop,
  onBottomMagicDrop,
  onBottomMagicDragStart,
  onMagicHover,
  onMagicLeave,
  playerItems,
  playerMoney,
  onPlayerItemClick,
  onPlayerItemRightClick,
  onPlayerItemDragStart,
  onPlayerItemDrop,
  onPlayerItemHover,
  onPlayerItemLeave,
  dragData,
  magicDragData,
  bottomMagicDragData,
  onClose,
}) => {
  const { screenWidth } = useGameUIContext();
  const [goodsScrollOffset, setGoodsScrollOffset] = useState(0);
  const [magicScrollOffset, setMagicScrollOffset] = useState(0);
  const [localMagicDragIndex, setLocalMagicDragIndex] = useState<number | null>(null);

  const panelWidth = 860;
  const goodsColumns = 5;
  const goodsRows = 8;
  const goodsSlotSize = 40;
  const goodsPerPage = goodsColumns * goodsRows;
  const magicCols = 3;
  const magicPerPage = 9;

  const selectedPartner = partners[selectedPartnerIndex];

  const panelStyle: React.CSSProperties = useMemo(
    () => ({
      position: "absolute",
      left: screenWidth / 2 - panelWidth / 2,
      top: 40,
      width: panelWidth,
      maxHeight: "calc(100vh - 100px)",
      display: "flex",
      flexDirection: "column",
      ...glassEffect.standard,
      borderRadius: borderRadius.xl,
      border: `1px solid ${wuxiaAccent.goldDark}66`,
      boxShadow: `0 8px 32px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(255,255,255,0.1), 0 0 40px rgba(212,175,55,0.08)`,
      pointerEvents: "auto",
      overflow: "hidden",
    }),
    [screenWidth]
  );

  // 装备槽位布局
  const topRow: EquipSlotType[] = ["head", "neck"];
  const middleRow: EquipSlotType[] = ["body", "hand", "back"];
  const bottomRow: EquipSlotType[] = ["wrist", "foot"];

  // 已装备数量
  const equippedCount = useMemo(() => Object.values(equips).filter((i) => i != null).length, [equips]);

  // 武功数据
  const allMagicSlots = useMemo(() => {
    const result: Array<{ magicInfo: MagicItemInfo | null; storeIndex: number }> = [];
    for (let i = 0; i < MAGIC_LIST_CONFIG.storeIndexEnd; i++) {
      result.push({ magicInfo: magicInfos?.[i] ?? null, storeIndex: i + 1 });
    }
    return result;
  }, [magicInfos]);

  const magicCount = useMemo(() => allMagicSlots.filter((s) => s.magicInfo?.magic).length, [allMagicSlots]);
  const maxMagicScrollRow = Math.max(0, Math.ceil(MAGIC_LIST_CONFIG.storeIndexEnd / magicCols) - 3);

  const visibleMagicSlots = useMemo(
    () => allMagicSlots.slice(magicScrollOffset * magicCols, magicScrollOffset * magicCols + magicPerPage),
    [allMagicSlots, magicScrollOffset]
  );

  // 物品数据
  const visibleGoods = useMemo(
    () => playerItems.slice(goodsScrollOffset * goodsColumns, goodsScrollOffset * goodsColumns + goodsPerPage),
    [playerItems, goodsScrollOffset, goodsPerPage]
  );
  const maxGoodsScrollRows = Math.max(0, Math.ceil(playerItems.length / goodsColumns) - goodsRows);
  const playerItemCount = useMemo(() => playerItems.filter((i) => i !== null).length, [playerItems]);

  // 装备拖拽处理
  const handleEquipDragOver = useCallback((_slot: EquipSlotType) => (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleEquipDrop = useCallback(
    (slot: EquipSlotType) => (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (dragData) {
        const slotPosition = slotTypeToEquipPosition(slot);
        if (dragData.good.part === slotPosition) {
          onEquipDrop?.(slot, dragData);
        }
      }
    },
    [dragData, onEquipDrop]
  );

  const handleEquipDragStart = useCallback(
    (slot: EquipSlotType) => (e: React.DragEvent) => {
      const item = equips[slot];
      if (item) {
        onEquipDragStart?.(slot, item.good);
        if (e.dataTransfer) e.dataTransfer.effectAllowed = "move";
      }
    },
    [equips, onEquipDragStart]
  );

  const handleEquipMouseEnter = useCallback(
    (slot: EquipSlotType) => (e: React.MouseEvent) => {
      const item = equips[slot];
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      onEquipMouseEnter?.(slot, item?.good ?? null, rect);
    },
    [equips, onEquipMouseEnter]
  );

  // 武功拖拽处理
  const handleMagicDragStart = useCallback(
    (storeIndex: number) => () => {
      setLocalMagicDragIndex(storeIndex);
      onMagicDragStart?.({ type: "magic", storeIndex });
    },
    [onMagicDragStart]
  );

  const handleMagicDrop = useCallback(
    (storeIndex: number) => () => {
      if (magicDragData) {
        onMagicDrop?.(storeIndex, magicDragData);
      } else if (bottomMagicDragData) {
        // 从快捷栏拖到面板指定位置：交换
        onBottomMagicDrop?.(bottomMagicDragData.bottomSlot, bottomMagicDragData, storeIndex);
      } else {
        onMagicDrop?.(storeIndex, { type: "magic", storeIndex: -1 });
      }
      setLocalMagicDragIndex(null);
      onMagicDragEnd?.();
    },
    [magicDragData, bottomMagicDragData, onMagicDrop, onBottomMagicDrop, onMagicDragEnd]
  );

  // 物品拖拽处理
  const handleGoodsDragStart = useCallback(
    (index: number) => (e: React.DragEvent) => {
      const bagIndex = goodsScrollOffset * goodsColumns + index + 1;
      const item = playerItems[goodsScrollOffset * goodsColumns + index];
      if (item) {
        onPlayerItemDragStart?.(bagIndex, item.good);
        if (e.dataTransfer) e.dataTransfer.effectAllowed = "move";
      }
    },
    [playerItems, goodsScrollOffset, onPlayerItemDragStart]
  );

  const handleGoodsDrop = useCallback(
    (index: number) => (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (dragData) {
        const bagIndex = goodsScrollOffset * goodsColumns + index + 1;
        onPlayerItemDrop?.(bagIndex, dragData);
      }
    },
    [dragData, goodsScrollOffset, onPlayerItemDrop]
  );

  if (!isVisible) return null;

  return (
    <div style={panelStyle} onClick={(e) => e.stopPropagation()}>
      {/* 顶部装饰 */}
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: `linear-gradient(90deg, transparent, ${wuxiaAccent.gold}88, transparent)`, borderRadius: `${borderRadius.xl}px ${borderRadius.xl}px 0 0` }} />
      <CloseBtn onClick={onClose} />

      {/* 伙伴选择器 */}
      <div
        style={{
          padding: `${spacing.md}px ${spacing.md}px ${spacing.sm}px`,
          background: modernColors.bg.hover,
          borderBottom: `1px solid ${modernColors.border.glass}`,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: spacing.sm, marginBottom: spacing.sm }}>
          <span style={{ fontSize: 14 }}>👥</span>
          <span style={{ fontSize: typography.fontSize.md, fontWeight: typography.fontWeight.bold, color: modernColors.text.primary, textShadow: "0 2px 4px rgba(0,0,0,0.5)" }}>
            伙伴管理
          </span>
          {selectedPartner && (
            <span style={{ fontSize: typography.fontSize.sm, color: modernColors.text.secondary, marginLeft: "auto" }}>
              {selectedPartner.name} <span style={{ color: wuxiaAccent.gold }}>Lv.{selectedPartner.level}</span>
            </span>
          )}
        </div>
        <div style={{ display: "flex", gap: spacing.xs, overflowX: "auto", paddingBottom: spacing.xs }}>
          {partners.map((p, i) => (
            <PartnerPortrait
              key={`${p.name}-${i}`}
              partner={p}
              isSelected={i === selectedPartnerIndex}
              onClick={() => onSelectPartner(i)}
            />
          ))}
          {partners.length === 0 && (
            <span style={{ fontSize: typography.fontSize.sm, color: modernColors.text.muted, padding: spacing.sm }}>
              暂无伙伴
            </span>
          )}
        </div>
      </div>

      {/* 三列水平布局 */}
      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
        {/* 左列：装备 */}
        <div style={{ width: 240, padding: spacing.md, borderRight: `1px solid ${modernColors.border.glass}`, display: "flex", flexDirection: "column", alignItems: "center", gap: spacing.sm, overflowY: "auto" }}>
          <SectionTitle title="装备" icon="🛡️" />
          <div style={{ display: "flex", gap: spacing.lg }}>
            {topRow.map((slot) => (
              <EquipSlotItem key={slot} slot={slot} item={equips[slot]} onSlotClick={() => onEquipRightClick?.(slot)} onSlotRightClick={() => onEquipRightClick?.(slot)} onSlotDrop={handleEquipDrop(slot)} onSlotDragStart={handleEquipDragStart(slot)} onSlotMouseEnter={handleEquipMouseEnter(slot)} onSlotMouseLeave={onEquipMouseLeave} />
            ))}
          </div>
          <div style={{ display: "flex", gap: spacing.md }}>
            {middleRow.map((slot) => (
              <EquipSlotItem key={slot} slot={slot} item={equips[slot]} onSlotClick={() => onEquipRightClick?.(slot)} onSlotRightClick={() => onEquipRightClick?.(slot)} onSlotDrop={handleEquipDrop(slot)} onSlotDragStart={handleEquipDragStart(slot)} onSlotMouseEnter={handleEquipMouseEnter(slot)} onSlotMouseLeave={onEquipMouseLeave} />
            ))}
          </div>
          <div style={{ display: "flex", gap: spacing.lg }}>
            {bottomRow.map((slot) => (
              <EquipSlotItem key={slot} slot={slot} item={equips[slot]} onSlotClick={() => onEquipRightClick?.(slot)} onSlotRightClick={() => onEquipRightClick?.(slot)} onSlotDrop={handleEquipDrop(slot)} onSlotDragStart={handleEquipDragStart(slot)} onSlotMouseEnter={handleEquipMouseEnter(slot)} onSlotMouseLeave={onEquipMouseLeave} />
            ))}
          </div>
          <span style={{ fontSize: typography.fontSize.xs, color: modernColors.text.muted }}>
            已装备 <span style={{ color: wuxiaAccent.gold }}>{equippedCount}</span>/7
          </span>
        </div>

        {/* 中列：武功 */}
        <div style={{ width: 320, padding: spacing.md, borderRight: `1px solid ${modernColors.border.glass}`, display: "flex", flexDirection: "column", gap: spacing.sm, overflowY: "auto" }}>
          <SectionTitle title="武功" icon="⚔️" />
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: spacing.xs }}>
            {[0, 1, 2].map((rowIndex) => (
              <div key={`magic-row-${rowIndex}`} style={{ display: "flex", gap: spacing.xs, marginLeft: rowIndex % 2 === 1 ? 30 : 0 }}>
                {visibleMagicSlots.slice(rowIndex * magicCols, rowIndex * magicCols + magicCols).map((item) => {
                  const contentKey = item.magicInfo?.magic?.name ?? "empty";
                  return (
                    <MagicSlotItem
                      key={`mslot-${item.storeIndex}-${magicScrollOffset}-${contentKey}`}
                      magicInfo={item.magicInfo}
                      isDragging={localMagicDragIndex === item.storeIndex}
                      onClick={() => onMagicClick?.(item.storeIndex)}
                      onRightClick={() => onMagicRightClick?.(item.storeIndex)}
                      onDragStart={handleMagicDragStart(item.storeIndex)}
                      onDragEnd={() => { setLocalMagicDragIndex(null); onMagicDragEnd?.(); }}
                      onDrop={handleMagicDrop(item.storeIndex)}
                      onMouseEnter={(e) => onMagicHover?.(item.magicInfo, e.clientX, e.clientY)}
                      onMouseLeave={onMagicLeave}
                    />
                  );
                })}
              </div>
            ))}
            {maxMagicScrollRow > 0 && (
              <div style={{ display: "flex", alignItems: "center", gap: spacing.sm, marginTop: spacing.xs }}>
                <button onClick={() => setMagicScrollOffset((p) => Math.max(0, p - 1))} disabled={magicScrollOffset === 0} style={{ width: 22, height: 22, background: magicScrollOffset > 0 ? modernColors.bg.hover : "transparent", border: `1px solid ${modernColors.border.glass}`, borderRadius: borderRadius.sm, color: magicScrollOffset > 0 ? modernColors.text.secondary : modernColors.text.muted, fontSize: 10, cursor: magicScrollOffset > 0 ? "pointer" : "default", display: "flex", alignItems: "center", justifyContent: "center" }}>▲</button>
                <span style={{ fontSize: typography.fontSize.xs, color: modernColors.text.secondary, minWidth: 40, textAlign: "center" }}>{magicScrollOffset + 1}/{maxMagicScrollRow + 1}</span>
                <button onClick={() => setMagicScrollOffset((p) => Math.min(maxMagicScrollRow, p + 1))} disabled={magicScrollOffset === maxMagicScrollRow} style={{ width: 22, height: 22, background: magicScrollOffset < maxMagicScrollRow ? modernColors.bg.hover : "transparent", border: `1px solid ${modernColors.border.glass}`, borderRadius: borderRadius.sm, color: magicScrollOffset < maxMagicScrollRow ? modernColors.text.secondary : modernColors.text.muted, fontSize: 10, cursor: magicScrollOffset < maxMagicScrollRow ? "pointer" : "default", display: "flex", alignItems: "center", justifyContent: "center" }}>▼</button>
                <span style={{ fontSize: typography.fontSize.xs, color: modernColors.text.muted }}>已习得 <span style={{ color: wuxiaAccent.gold }}>{magicCount}</span> 种</span>
              </div>
            )}
          </div>
          {/* 快捷栏 */}
          <div style={{ marginTop: spacing.sm }}>
            <div style={{ fontSize: typography.fontSize.xs, color: modernColors.text.secondary, marginBottom: spacing.xs, display: "flex", alignItems: "center", gap: spacing.sm }}>
              <span style={{ width: 12, height: 1, background: wuxiaAccent.goldDark }} />
              快捷栏
              <span style={{ flex: 1, height: 1, background: `linear-gradient(90deg, transparent, ${modernColors.border.glass})` }} />
            </div>
            <div style={{ display: "flex", gap: spacing.sm, justifyContent: "center" }}>
              {[0, 1, 2, 3, 4].map((i) => {
                const magicInfo = bottomMagics?.[i] ?? null;
                return (
                  <MagicSlotItem
                    key={`bottom-magic-${i}`}
                    magicInfo={magicInfo}
                    onRightClick={() => { if (magicInfo?.magic) onBottomMagicDrop?.(i, { type: "magic", storeIndex: -1 }); }}
                    onDrop={() => { if (magicDragData) { onBottomMagicDrop?.(i, magicDragData); } else if (bottomMagicDragData) { onBottomMagicDrop?.(i, bottomMagicDragData); } }}
                    onDragStart={() => onBottomMagicDragStart?.(i)}
                    onMouseEnter={(e) => onMagicHover?.(magicInfo, e.clientX, e.clientY)}
                    onMouseLeave={onMagicLeave}
                  />
                );
              })}
            </div>
          </div>
        </div>

        {/* 右列：物品栏 */}
        <div
          style={{ flex: 1, padding: spacing.md, display: "flex", flexDirection: "column", gap: spacing.sm, overflowY: "auto" }}
          onWheel={(e) => {
            const delta = e.deltaY > 0 ? 1 : -1;
            setGoodsScrollOffset((prev) => Math.max(0, Math.min(maxGoodsScrollRows, prev + delta)));
          }}
        >
          <SectionTitle title="物品栏" icon="🎒" />
          <div style={{ display: "grid", gridTemplateColumns: `repeat(${goodsColumns}, ${goodsSlotSize}px)`, gap: 4, justifyContent: "center" }}>
            {visibleGoods.map((item, idx) => {
              const actualIndex = goodsScrollOffset * goodsColumns + idx + 1;
              const contentKey = item?.good?.name ?? "empty";
              return (
                <GoodsSlotItem
                  key={`gs-${idx}-${goodsScrollOffset}-${contentKey}`}
                  item={item}
                  actualIndex={actualIndex}
                  slotSize={goodsSlotSize}
                  onClick={() => onPlayerItemClick?.(actualIndex)}
                  onRightClick={() => onPlayerItemRightClick?.(actualIndex)}
                  onDrop={handleGoodsDrop(idx)}
                  onDragStart={handleGoodsDragStart(idx)}
                  onMouseEnter={(e) => onPlayerItemHover?.(item?.good ?? null, e.clientX, e.clientY)}
                  onMouseLeave={onPlayerItemLeave}
                />
              );
            })}
          </div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: spacing.sm, padding: `0 ${spacing.xs}px` }}>
            {maxGoodsScrollRows > 0 && (
              <div style={{ display: "flex", alignItems: "center", gap: spacing.xs }}>
                <button onClick={() => setGoodsScrollOffset((p) => Math.max(0, p - 1))} disabled={goodsScrollOffset === 0} style={{ width: 18, height: 18, background: goodsScrollOffset > 0 ? modernColors.bg.hover : "transparent", border: `1px solid ${modernColors.border.glass}`, borderRadius: borderRadius.sm, color: goodsScrollOffset > 0 ? modernColors.text.secondary : modernColors.text.muted, fontSize: 9, cursor: goodsScrollOffset > 0 ? "pointer" : "default", display: "flex", alignItems: "center", justifyContent: "center" }}>▲</button>
                <span style={{ fontSize: 9, color: modernColors.text.secondary }}>{goodsScrollOffset + 1}/{maxGoodsScrollRows + 1}</span>
                <button onClick={() => setGoodsScrollOffset((p) => Math.min(maxGoodsScrollRows, p + 1))} disabled={goodsScrollOffset === maxGoodsScrollRows} style={{ width: 18, height: 18, background: goodsScrollOffset < maxGoodsScrollRows ? modernColors.bg.hover : "transparent", border: `1px solid ${modernColors.border.glass}`, borderRadius: borderRadius.sm, color: goodsScrollOffset < maxGoodsScrollRows ? modernColors.text.secondary : modernColors.text.muted, fontSize: 9, cursor: goodsScrollOffset < maxGoodsScrollRows ? "pointer" : "default", display: "flex", alignItems: "center", justifyContent: "center" }}>▼</button>
              </div>
            )}
            <span style={{ fontSize: typography.fontSize.xs, color: wuxiaAccent.gold }}>💰 {playerMoney}</span>
          </div>
        </div>
      </div>

      {/* 底部提示 */}
      <div
        style={{
          padding: `${spacing.sm}px ${spacing.lg}px`,
          borderTop: `1px solid ${modernColors.border.glass}`,
          background: modernColors.bg.glassDark,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: spacing.md,
        }}
      >
        <span style={{ fontSize: typography.fontSize.xs, color: modernColors.text.muted }}>
          <span style={{ color: wuxiaAccent.azure }}>拖拽</span> 物品到装备槽
        </span>
        <span style={{ color: modernColors.border.glass }}>|</span>
        <span style={{ fontSize: typography.fontSize.xs, color: modernColors.text.muted }}>
          <span style={{ color: wuxiaAccent.azure }}>右键</span> 卸下装备
        </span>
      </div>

      {/* 底部装饰 */}
      <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 2, background: `linear-gradient(90deg, transparent, ${wuxiaAccent.goldDark}, transparent)` }} />
    </div>
  );
};
