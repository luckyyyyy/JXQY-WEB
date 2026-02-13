/**
 * Modern BottomBar - 底部快捷栏
 * 位置与经典UI一致
 */
import type React from "react";
import { useCallback, useMemo, useState } from "react";
import type { TouchDragData } from "@/contexts";
import { AsfAnimatedSprite } from "../classic/AsfAnimatedSprite";
import type { BottomSlotDragData } from "../classic/BottomGui";
import type { GoodItemData } from "../classic/GoodsGui";
import { useAsfImage } from "../classic/hooks";
import { getItemBorderColor, getItemGlowColor } from "./Tooltips";
import { borderRadius, glassEffect, modernColors, spacing, transitions } from "./theme";

// 快捷键
const SLOT_KEYS = ["Z", "X", "C", "A", "S", "D", "F", "G"];

/**
 * 武功槽数据 - 简化版，用于 UI 显示
 */
interface MagicSlotData {
  magic: {
    name: string;
    icon?: string;
    image?: string;
    iconPath?: string;
  } | null;
  level: number;
}

interface BottomBarProps {
  goodsItems?: (GoodItemData | null)[];
  magicItems?: (MagicSlotData | null)[];
  screenWidth: number;
  screenHeight: number;
  // 血蓝体力
  life?: number;
  lifeMax?: number;
  mana?: number;
  manaMax?: number;
  thew?: number;
  thewMax?: number;
  onItemClick: (index: number) => void;
  onItemRightClick: (index: number) => void;
  onMagicRightClick?: (magicIndex: number) => void;
  onDrop?: (targetIndex: number) => void;
  onDragStart?: (data: BottomSlotDragData) => void;
  onDragEnd?: () => void;
  onTouchDrop?: (targetIndex: number, data: TouchDragData) => void;
  onMagicHover?: (magicInfo: MagicSlotData | null, x: number, y: number) => void;
  onMagicLeave?: () => void;
  onGoodsHover?: (goodData: GoodItemData | null, x: number, y: number) => void;
  onGoodsLeave?: () => void;
}

interface SlotItemProps {
  index: number;
  isItemSlot: boolean;
  goodsData?: GoodItemData | null;
  magicData?: MagicSlotData | null;
  hotkey: string;
  onClick: () => void;
  onRightClick: () => void;
  onMouseEnter: (e: React.MouseEvent) => void;
  onMouseLeave: () => void;
  onDragStart?: () => void;
  onDrop?: () => void;
}

const BottomSlot: React.FC<SlotItemProps> = ({
  index,
  isItemSlot,
  goodsData,
  magicData,
  hotkey,
  onClick,
  onRightClick,
  onMouseEnter,
  onMouseLeave,
  onDragStart,
  onDrop,
}) => {
  const [isHovered, setIsHovered] = useState(false);
  const hasContent = !!(goodsData || magicData);

  // 加载物品图标
  const itemIconPath = goodsData?.good?.iconPath ?? goodsData?.good?.imagePath ?? null;
  const itemIcon = useAsfImage(isItemSlot ? itemIconPath : null, 0);

  // 武功图标路径
  const magicIconPath = magicData?.magic?.icon ?? magicData?.magic?.image ?? null;

  // 获取物品品级颜色（仅物品槽位）
  const qualityBorderColor = isItemSlot ? getItemBorderColor(goodsData?.good) : null;
  const qualityGlowColor = isItemSlot ? getItemGlowColor(goodsData?.good) : null;

  // 计算边框颜色
  const borderColor = qualityBorderColor
    ? qualityBorderColor
    : isHovered
      ? modernColors.border.glassLight
      : modernColors.border.glass;

  // 计算边框渐变第二色
  const _borderColorSecondary = qualityBorderColor
    ? isHovered
      ? qualityBorderColor
      : `${qualityBorderColor}cc`
    : isHovered
      ? `${modernColors.border.glassLight}88`
      : `${modernColors.border.glass}88`;

  // 计算发光效果 - 只保留外发光，不要内发光底色
  const boxShadow = qualityGlowColor
    ? isHovered
      ? `0 0 12px ${qualityGlowColor}`
      : `0 0 6px ${qualityGlowColor}`
    : "none";

  const handleContextMenu = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      onRightClick();
    },
    [onRightClick]
  );

  return (
    <div
      style={{
        width: 44,
        height: 44,
        position: "relative",
        cursor: "pointer",
        transition: transitions.fast,
        transform: isHovered && hasContent ? "scale(1.05)" : "scale(1)",
      }}
      onClick={onClick}
      onContextMenu={handleContextMenu}
      onMouseEnter={(e) => {
        console.log("[BottomSlot] onMouseEnter", {
          index,
          isItemSlot,
          hasContent,
          goodsData,
          magicData,
        });
        setIsHovered(true);
        onMouseEnter(e);
      }}
      onMouseMove={(e) => {
        // 和经典UI一样，鼠标移动时也触发hover
        onMouseEnter(e);
      }}
      onMouseLeave={() => {
        setIsHovered(false);
        onMouseLeave();
      }}
      draggable={hasContent}
      onDragStart={(e) => {
        if (hasContent && onDragStart) {
          e.dataTransfer.effectAllowed = "move";
          onDragStart();
        }
      }}
      onDragOver={(e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
      }}
      onDrop={(e) => {
        e.preventDefault();
        onDrop?.();
      }}
    >
      {/* 外边框 - 只显示边框线，不填充背景 */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: "transparent",
          border: `2px solid ${borderColor}`,
          borderRadius: borderRadius.md,
          transition: transitions.fast,
          boxShadow,
          pointerEvents: "none",
        }}
      />

      {/* 内部容器 */}
      <div
        style={{
          position: "absolute",
          inset: 2,
          background: isHovered ? "rgba(40, 45, 60, 0.4)" : "rgba(20, 25, 35, 0.25)",
          borderRadius: borderRadius.sm,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          transition: transitions.fast,
          pointerEvents: "none",
        }}
      >
        {/* 物品图标 */}
        {isItemSlot && itemIcon.dataUrl && (
          <img
            src={itemIcon.dataUrl}
            alt={goodsData?.good?.name || ""}
            style={{
              maxWidth: 32,
              maxHeight: 32,
              imageRendering: "pixelated",
              pointerEvents: "none",
            }}
            draggable={false}
          />
        )}

        {/* 武功图标：占位符在底层，ASF 动画覆盖在上层 */}
        {!isItemSlot && magicData?.magic && (
          <>
            {/* 文字占位符（当图标不存在时显示） */}
            {!magicIconPath && <div
              style={{
                position: "absolute",
                inset: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                pointerEvents: "none",
              }}
            >
              <span
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  color: "rgba(255,255,255,0.9)",
                  textShadow: "0 1px 3px rgba(0,0,0,0.8), 0 0 6px rgba(0,0,0,0.4)",
                  textAlign: "center",
                  lineHeight: 1.1,
                }}
              >
                {magicData.magic.name?.slice(0, 2)}
              </span>
            </div>}
            {/* ASF 动画图标 */}
            {magicIconPath && (
              <AsfAnimatedSprite
                path={magicIconPath}
                autoPlay={true}
                loop={true}
                style={{
                  maxWidth: 32,
                  maxHeight: 32,
                  pointerEvents: "none",
                }}
              />
            )}
          </>
        )}

        {/* 数量 */}
        {goodsData && goodsData.count > 1 && (
          <span
            style={{
              position: "absolute",
              top: 2,
              left: 4,
              fontSize: 9,
              color: modernColors.text.primary,
              textShadow: "0 1px 2px rgba(0,0,0,0.8)",
            }}
          >
            {goodsData.count}
          </span>
        )}

        {/* 武功等级 */}
        {magicData && magicData.level > 0 && (
          <span
            style={{
              position: "absolute",
              top: 2,
              right: 4,
              fontSize: 9,
              color: modernColors.accent,
              textShadow: "0 1px 2px rgba(0,0,0,0.8)",
            }}
          >
            {magicData.level}
          </span>
        )}

        {/* 快捷键 - 右下角 */}
        <span
          style={{
            position: "absolute",
            bottom: 2,
            right: 3,
            fontSize: 8,
            color: modernColors.text.muted,
            textShadow: "0 1px 2px rgba(0,0,0,0.9)",
            opacity: 0.7,
          }}
        >
          {hotkey}
        </span>
      </div>
    </div>
  );
};

export const BottomBar: React.FC<BottomBarProps> = ({
  goodsItems = [],
  magicItems = [],
  screenWidth,
  screenHeight,
  life = 100,
  lifeMax = 100,
  mana = 50,
  manaMax = 50,
  thew = 100,
  thewMax = 100,
  onItemClick,
  onItemRightClick,
  onMagicRightClick,
  onDrop,
  onDragStart,
  onDragEnd,
  onMagicHover,
  onMagicLeave,
  onGoodsHover,
  onGoodsLeave,
}) => {
  // 动态计算宽度: 血蓝体力 + 8个槽位 + 间距 + 分隔线 + padding
  const slotWidth = 44;
  const slotGap = 8;
  const statusWidth = 140; // 血蓝体力区域
  const goodsSlotsWidth = 3 * slotWidth + 2 * slotGap; // 3个物品槽
  const magicSlotsWidth = 5 * slotWidth + 4 * slotGap; // 5个武功槽
  const dividerWidth = 24; // 分隔线区域
  const padding = 32; // 左右 padding
  const panelWidth = statusWidth + goodsSlotsWidth + magicSlotsWidth + dividerWidth * 2 + padding;
  const panelHeight = 60; // 调整为适应方形槽位

  // 计算百分比
  const lifePercent = lifeMax > 0 ? Math.min(100, (life / lifeMax) * 100) : 0;
  const manaPercent = manaMax > 0 ? Math.min(100, (mana / manaMax) * 100) : 0;
  const thewPercent = thewMax > 0 ? Math.min(100, (thew / thewMax) * 100) : 0;

  // 位置: 屏幕底部中央 (不再偏移)
  const panelStyle: React.CSSProperties = useMemo(
    () => ({
      position: "absolute",
      left: (screenWidth - panelWidth) / 2,
      bottom: 0,
      width: panelWidth,
      height: panelHeight,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      gap: spacing.md,
      ...glassEffect.standard,
      borderRadius: `${borderRadius.lg}px ${borderRadius.lg}px 0 0`,
      borderBottom: "none",
      padding: `0 ${spacing.md}px`,
      pointerEvents: "auto",
    }),
    [screenWidth, panelWidth]
  );

  return (
    <div style={panelStyle}>
      {/* 血蓝体力条 */}
      <div style={{ display: "flex", flexDirection: "column", gap: 4, width: statusWidth }}>
        {/* 生命 */}
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <span style={{ fontSize: 10, color: modernColors.stats.life, width: 24 }}>生命</span>
          <div
            style={{
              flex: 1,
              height: 12,
              background: "rgba(0,0,0,0.4)",
              borderRadius: 6,
              overflow: "hidden",
            }}
          >
            <div
              style={{
                width: `${lifePercent}%`,
                height: "100%",
                background: modernColors.stats.life,
                transition: "width 0.3s",
              }}
            />
          </div>
          <span
            style={{ fontSize: 9, color: modernColors.text.muted, width: 50, textAlign: "right" }}
          >
            {life}/{lifeMax}
          </span>
        </div>
        {/* 内力 */}
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <span style={{ fontSize: 10, color: modernColors.stats.mana, width: 24 }}>内力</span>
          <div
            style={{
              flex: 1,
              height: 12,
              background: "rgba(0,0,0,0.4)",
              borderRadius: 6,
              overflow: "hidden",
            }}
          >
            <div
              style={{
                width: `${manaPercent}%`,
                height: "100%",
                background: modernColors.stats.mana,
                transition: "width 0.3s",
              }}
            />
          </div>
          <span
            style={{ fontSize: 9, color: modernColors.text.muted, width: 50, textAlign: "right" }}
          >
            {mana}/{manaMax}
          </span>
        </div>
        {/* 体力 */}
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <span style={{ fontSize: 10, color: modernColors.stats.thew, width: 24 }}>体力</span>
          <div
            style={{
              flex: 1,
              height: 12,
              background: "rgba(0,0,0,0.4)",
              borderRadius: 6,
              overflow: "hidden",
            }}
          >
            <div
              style={{
                width: `${thewPercent}%`,
                height: "100%",
                background: modernColors.stats.thew,
                transition: "width 0.3s",
              }}
            />
          </div>
          <span
            style={{ fontSize: 9, color: modernColors.text.muted, width: 50, textAlign: "right" }}
          >
            {thew}/{thewMax}
          </span>
        </div>
      </div>

      {/* 分隔线 */}
      <div style={{ width: 1, height: 50, background: modernColors.border.glass }} />

      {/* 物品槽 0-2 */}
      <div style={{ display: "flex", gap: spacing.sm }}>
        {[0, 1, 2].map((i) => {
          // 使用物品名称作为 key 的一部分，确保数据变化时组件正确更新
          const goodsData = goodsItems[i];
          const contentKey = goodsData?.good?.name ?? "empty";
          return (
            <BottomSlot
              key={`goods-${i}-${contentKey}`}
              index={i}
              isItemSlot={true}
              goodsData={goodsData}
              hotkey={SLOT_KEYS[i]}
              onClick={() => onItemClick(i)}
              onRightClick={() => onItemRightClick(i)}
              onMouseEnter={(e) => {
                // 物品槽触发物品tooltip - 1:1 参考经典 UI
                if (goodsData?.good) {
                  onGoodsHover?.(goodsData, e.clientX, e.clientY);
                }
              }}
              onMouseLeave={() => {
                onGoodsLeave?.();
              }}
              onDragStart={() => {
                if (goodsData) {
                  onDragStart?.({ type: "goods", slotIndex: i, listIndex: 221 + i });
                }
              }}
              onDrop={() => onDrop?.(i)}
            />
          );
        })}
      </div>

      {/* 分隔线 */}
      <div
        style={{
          width: 1,
          height: 40,
          background: modernColors.border.glass,
        }}
      />

      {/* 武功槽 3-7 */}
      <div style={{ display: "flex", gap: spacing.sm }}>
        {[0, 1, 2, 3, 4].map((i) => {
          // 使用武功名称作为 key 的一部分，确保数据变化时组件正确更新
          const magicData = magicItems[i];
          const contentKey = magicData?.magic?.name ?? "empty";
          return (
            <BottomSlot
              key={`magic-${i}-${contentKey}`}
              index={3 + i}
              isItemSlot={false}
              magicData={magicData}
              hotkey={SLOT_KEYS[3 + i]}
              onClick={() => onItemClick(3 + i)}
              onRightClick={() => onMagicRightClick?.(i)}
              onMouseEnter={(e) => {
                // 武功槽触发武功tooltip - 1:1 参考经典 UI
                console.log("[BottomBar] magic onMouseEnter callback", {
                  magicData,
                  onMagicHover: !!onMagicHover,
                });
                if (magicData?.magic) {
                  console.log("[BottomBar] calling onMagicHover");
                  onMagicHover?.(magicData, e.clientX, e.clientY);
                }
              }}
              onMouseLeave={() => {
                onMagicLeave?.();
              }}
              onDragStart={() => {
                if (magicData) {
                  onDragStart?.({ type: "magic", slotIndex: 3 + i, listIndex: 40 + i });
                }
              }}
              onDrop={() => onDrop?.(3 + i)}
            />
          );
        })}
      </div>
    </div>
  );
};
