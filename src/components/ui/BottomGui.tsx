/**
 * BottomGui Component - based on JxqyHD Engine/Gui/BottomGui.cs
 * Bottom hotbar for items and skills using ASF images from resources
 *
 * C# Reference: BottomGui.cs handles item slots and magic slots
 * Resources: asf/ui/bottom/window.asf
 *
 * Slots 0-2: Items (from GoodsListManager, indices BottomIndexBegin+0 to +2)
 * Slots 3-7: Magic (from MagicListManager, indices BottomIndexBegin+0 to +4)
 */
import React, { useState, useMemo, useCallback } from "react";
import type { HotbarItem } from "../../engine/gui/types";
import type { MagicItemInfo } from "../../engine/magic";
import type { GoodItemData } from "./GoodsGui";
import { useAsfImage } from "./hooks";
import { AsfAnimatedSprite } from "./AsfAnimatedSprite";

// UI配置 - 对应 UI_Settings.ini 中的 [Bottom] 和 [Bottom_Items] 部分
const UI_CONFIG = {
  panel: {
    image: "asf/ui/bottom/window.asf",
    leftAdjust: 102,  // 相对于屏幕中心的偏移
    topAdjust: 0,
  },
  // 各个图标位置：1-3 物品，4-8 武功
  items: [
    { left: 7, top: 20, width: 30, height: 40 },    // 物品槽 1
    { left: 44, top: 20, width: 30, height: 40 },   // 物品槽 2
    { left: 82, top: 20, width: 30, height: 40 },   // 物品槽 3
    { left: 199, top: 20, width: 30, height: 40 },  // 武功槽 1 (A)
    { left: 238, top: 20, width: 30, height: 40 },  // 武功槽 2 (S)
    { left: 277, top: 20, width: 30, height: 40 },  // 武功槽 3 (D)
    { left: 316, top: 20, width: 30, height: 40 },  // 武功槽 4 (F)
    { left: 354, top: 20, width: 30, height: 40 },  // 武功槽 5 (G)
  ],
};

// 快捷键 - C#: Z,X,C 物品, A,S,D,F,G 武功
const SLOT_KEYS = ["Z", "X", "C", "A", "S", "D", "F", "G"];

// 拖放数据类型
export interface BottomSlotDragData {
  type: "goods" | "magic";
  slotIndex: number;  // BottomGui内部索引 0-7
  listIndex: number;  // ListManager中的实际索引
}

interface BottomGuiProps {
  // 旧接口（兼容）
  items?: (HotbarItem | null)[];
  // 新接口：直接传入物品和武功数据
  goodsItems?: (GoodItemData | null)[];  // 3个物品槽
  magicItems?: (MagicItemInfo | null)[]; // 5个武功槽
  screenWidth: number;
  screenHeight: number;
  onItemClick: (index: number) => void;
  onItemRightClick: (index: number) => void;
  // 武功右键 - 设置为当前使用
  onMagicRightClick?: (magicIndex: number) => void;
  // 拖放回调 - 只传递目标索引，调用者处理源数据
  onDrop?: (targetIndex: number) => void;
  onDragStart?: (data: BottomSlotDragData) => void;
  onDragEnd?: () => void;
  // 外部拖拽数据 - 用于显示拖放目标高亮
  externalMagicDrag?: boolean;
  // Tooltip 回调
  onMagicHover?: (magicInfo: MagicItemInfo | null, x: number, y: number) => void;
  onMagicLeave?: () => void;
}

/**
 * 单个槽位组件 - 支持物品和武功
 */
interface SlotProps {
  index: number;
  item: HotbarItem | null;
  goodsData?: GoodItemData | null;   // 物品数据 (index 0-2)
  magicData?: MagicItemInfo | null;  // 武功数据 (index 3-7)
  config: { left: number; top: number; width: number; height: number };
  hotkey: string;
  isHovered: boolean;
  cooldown?: number;  // 剩余冷却时间 ms
  onClick: () => void;
  onRightClick: (e: React.MouseEvent) => void;
  onMouseEnter: (e: React.MouseEvent) => void;
  onMouseLeave: () => void;
  // 拖放
  onDragStart?: () => void;
  onDragEnd?: () => void;
  onDrop?: () => void;
  isDragging?: boolean;
  // 外部拖拽高亮（武功槽）
  externalDragHighlight?: boolean;
}

const Slot: React.FC<SlotProps> = ({
  index,
  item,
  goodsData,
  magicData,
  config,
  hotkey,
  isHovered,
  cooldown = 0,
  onClick,
  onRightClick,
  onMouseEnter,
  onMouseLeave,
  onDragStart,
  onDragEnd,
  onDrop,
  isDragging,
  externalDragHighlight,
}) => {
  const isItemSlot = index < 3;
  const isMagicSlot = index >= 3;

  // 确定图标路径 - 优先使用新数据
  let iconPath: string | null = null;
  let displayName = isItemSlot ? `物品槽 ${index + 1}` : `武功槽 ${index - 2}`;
  let count: number | undefined;
  let level: number | undefined;

  if (goodsData?.good) {
    iconPath = goodsData.good.iconPath ?? goodsData.good.imagePath ?? null;
    displayName = goodsData.good.name;
    count = goodsData.count;
  } else if (magicData?.magic) {
    // Use icon (small image) for BottomGui, fall back to image if no icon
    // C# Reference: BottomGui.UpdateItem uses magic.Icon
    iconPath = magicData.magic.icon ?? magicData.magic.image ?? null;
    displayName = `${magicData.magic.name} Lv.${magicData.level}`;
    level = magicData.level;
  } else if (item) {
    iconPath = item.iconPath ?? null;
    displayName = item.name;
    count = item.count;
  }

  // 加载物品图标（静态）- 武功图标使用 AsfAnimatedSprite 组件
  // 物品图标只需要单帧，使用 useAsfImage 有缓存
  const itemIcon = useAsfImage(isItemSlot ? iconPath : null, 0);

  return (
    <div
      style={{
        position: "absolute",
        left: config.left,
        top: config.top,
        width: config.width,
        height: config.height,
        cursor: "pointer",
        borderRadius: 2,
        opacity: isDragging ? 0.5 : 1,
      }}
      draggable={!!(goodsData || magicData)}
      onDragStart={(e) => {
        if (onDragStart && (goodsData || magicData)) {
          e.dataTransfer.effectAllowed = "move";
          // Use canvas or img as drag image
          const canvas = e.currentTarget.querySelector('canvas');
          const img = e.currentTarget.querySelector('img');
          if (canvas) {
            e.dataTransfer.setDragImage(canvas, canvas.width / 2, canvas.height / 2);
          } else if (img) {
            e.dataTransfer.setDragImage(img, img.width / 2, img.height / 2);
          }
          onDragStart();
        }
      }}
      onDragEnd={() => {
        // Reset drag state when drag ends
        onDragEnd?.();
      }}
      onDragOver={(e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
      }}
      onDrop={(e) => {
        e.preventDefault();
        onDrop?.();
      }}
      onMouseEnter={onMouseEnter}
      onMouseMove={(e) => onMouseEnter(e)}
      onMouseLeave={onMouseLeave}
      onClick={onClick}
      onContextMenu={onRightClick}
    >
      {/* 物品图标 - 静态图片 */}
      {isItemSlot && (goodsData || item) && itemIcon.dataUrl && (
        <img
          src={itemIcon.dataUrl}
          alt={displayName}
          style={{
            position: "absolute",
            left: (config.width - itemIcon.width) / 2,
            top: (config.height - itemIcon.height) / 2,
            width: itemIcon.width,
            height: itemIcon.height,
            imageRendering: "pixelated",
            pointerEvents: "none",
          }}
        />
      )}

      {/* 武功图标 - 动画精灵 */}
      {isMagicSlot && magicData && iconPath && (
        <AsfAnimatedSprite
          path={iconPath}
          autoPlay={true}
          loop={true}
          style={{
            position: "absolute",
            left: "50%",
            top: "50%",
            transform: "translate(-50%, -50%)",
            pointerEvents: "none",
          }}
          alt={displayName}
        />
      )}

      {/* 物品数量（仅物品槽） */}
      {count !== undefined && count > 1 && (
        <span
          style={{
            position: "absolute",
            bottom: 1,
            right: 2,
            fontSize: 9,
            color: "#fff",
            fontWeight: "bold",
            textShadow: "0 1px 2px rgba(0,0,0,0.8)",
            pointerEvents: "none",
          }}
        >
          {count}
        </span>
      )}

      {/* 武功等级显示 */}
      {isMagicSlot && level !== undefined && (
        <span
          style={{
            position: "absolute",
            bottom: 1,
            left: 2,
            fontSize: 8,
            color: "#ffd700",
            fontWeight: "bold",
            textShadow: "0 1px 2px rgba(0,0,0,0.8)",
            pointerEvents: "none",
          }}
        >
          {level}
        </span>
      )}

      {/* 冷却显示 - 支持物品和武功 */}
      {cooldown > 0 && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: "rgba(0, 0, 0, 0.7)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            pointerEvents: "none",
          }}
        >
          <span style={{ color: "#fff", fontSize: 9 }}>
            {(cooldown / 1000).toFixed(1)}
          </span>
        </div>
      )}

      {/* 空槽指示 */}
      {!goodsData && !magicData && !item && (
        <div
          style={{
            position: "absolute",
            left: 4,
            top: 8,
            right: 4,
            bottom: 4,
            border: "1px dashed rgba(255, 255, 255, 0.2)",
            borderRadius: 2,
            pointerEvents: "none",
          }}
        />
      )}
    </div>
  );
};

export const BottomGui: React.FC<BottomGuiProps> = ({
  items,
  goodsItems,
  magicItems,
  screenWidth,
  screenHeight: _screenHeight,
  onItemClick,
  onItemRightClick,
  onMagicRightClick,
  onDrop,
  onDragStart,
  onDragEnd,
  externalMagicDrag,
  onMagicHover,
  onMagicLeave,
}) => {
  const [hoveredSlot, setHoveredSlot] = useState<number | null>(null);
  const [localDragIndex, setLocalDragIndex] = useState<number | null>(null);

  // 加载面板背景
  const panelImage = useAsfImage(UI_CONFIG.panel.image);

  // 计算面板位置
  // C#: Position = new Vector2((Globals.WindowWidth - BaseTexture.Width)/2f + leftAdjust,
  //                            Globals.WindowHeight - BaseTexture.Height + topAdjust)
  const panelStyle = useMemo(() => {
    const panelWidth = panelImage.width || 390;  // fallback size
    const panelHeight = panelImage.height || 68;

    return {
      position: "absolute" as const,
      left: (screenWidth - panelWidth) / 2 + UI_CONFIG.panel.leftAdjust,
      bottom: 0 - UI_CONFIG.panel.topAdjust,
      width: panelWidth,
      height: panelHeight,
      pointerEvents: "auto" as const,
    };
  }, [screenWidth, panelImage.width, panelImage.height]);

  const handleRightClick = useCallback((e: React.MouseEvent, index: number) => {
    e.preventDefault();
    if (index >= 3 && onMagicRightClick) {
      // 武功槽右键 - 设置为当前使用的武功
      onMagicRightClick(index - 3);
    } else {
      onItemRightClick(index);
    }
  }, [onItemRightClick, onMagicRightClick]);

  const handleSlotDragStart = useCallback((index: number) => {
    setLocalDragIndex(index);
    const isGoods = index < 3;
    const data: BottomSlotDragData = {
      type: isGoods ? "goods" : "magic",
      slotIndex: index,
      listIndex: isGoods ? index : (index - 3), // 相对于Bottom区域的索引
    };
    onDragStart?.(data);
  }, [onDragStart]);

  const handleSlotDrop = useCallback((targetIndex: number) => {
    // Just pass the target index, caller handles the source data
    onDrop?.(targetIndex);
    setLocalDragIndex(null);
    onDragEnd?.();
  }, [onDrop, onDragEnd]);

  // 如果面板图片还在加载
  if (panelImage.isLoading) {
    return (
      <div style={{
        ...panelStyle,
        background: "rgba(30, 50, 80, 0.9)",
        borderRadius: 4,
      }} />
    );
  }

  return (
    <div style={panelStyle}>
      {/* 背景面板 */}
      {panelImage.dataUrl && (
        <img
          src={panelImage.dataUrl}
          alt="快捷栏"
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

      {/* 槽位 */}
      {UI_CONFIG.items.map((cfg, index) => {
        const isGoodsSlot = index < 3;
        const isMagicSlot = index >= 3;

        // 获取数据
        const goodsData = isGoodsSlot ? goodsItems?.[index] : undefined;
        const magicData = isMagicSlot ? magicItems?.[index - 3] : undefined;

        // 计算冷却（从magicData获取）
        const cooldown = magicData?.remainColdMilliseconds ?? 0;

        return (
          <Slot
            key={index}
            index={index}
            item={items?.[index] ?? null}
            goodsData={goodsData}
            magicData={magicData}
            config={cfg}
            hotkey={SLOT_KEYS[index]}
            isHovered={hoveredSlot === index}
            cooldown={cooldown}
            onClick={() => onItemClick(index)}
            onRightClick={(e) => handleRightClick(e, index)}
            onMouseEnter={(e) => {
              setHoveredSlot(index);
              // 只有武功槽才触发 tooltip
              if (isMagicSlot && magicData?.magic) {
                onMagicHover?.(magicData, e.clientX, e.clientY);
              }
            }}
            onMouseLeave={() => {
              setHoveredSlot(null);
              onMagicLeave?.();
            }}
            onDragStart={() => handleSlotDragStart(index)}
            onDragEnd={() => {
              setLocalDragIndex(null);
              onDragEnd?.();
            }}
            onDrop={() => handleSlotDrop(index)}
            isDragging={localDragIndex === index}
            // 武功槽外部拖拽时显示高亮
            externalDragHighlight={isMagicSlot && externalMagicDrag}
          />
        );
      })}
    </div>
  );
};
