/**
 * MagicGui Component - based on JxqyHD Engine/Gui/MagicGui.cs
 * Displays player magic/skill list with drag-drop support
 *
 * C# Reference: MagicGui.cs shows a 3x3 magic grid with scroll bar
 * Resources loaded from UI_Settings.ini
 *
 * Store Indices: 1-36 (StoreIndexBegin to StoreIndexEnd)
 * Bottom Indices: 40-44 (BottomIndexBegin to BottomIndexEnd)
 */
import React, { useMemo, useState, useCallback, useRef } from "react";
import { useAsfImage } from "./hooks";
import { AsfAnimatedSprite } from "./AsfAnimatedSprite";
import { useMagicsGuiConfig } from "./useUISettings";
import { ScrollBar } from "./ScrollBar";
import type { MagicItemInfo } from "../../engine/magic";

// 兼容旧接口
export interface MagicItem {
  id: string;
  name: string;
  iconPath?: string;
  level: number;
}

// 拖放数据类型
export interface MagicDragData {
  type: "magic";
  storeIndex: number;  // 在store中的索引 (1-36)
}

interface MagicGuiProps {
  isVisible: boolean;
  // 旧接口（兼容）
  magics?: (MagicItem | null)[];
  // 新接口：直接传入MagicItemInfo
  magicInfos?: (MagicItemInfo | null)[];
  screenWidth: number;
  onMagicClick?: (storeIndex: number) => void;
  onMagicRightClick?: (storeIndex: number) => void; // 右键添加到快捷栏
  onClose: () => void;
  // 拖放回调
  onDragStart?: (data: MagicDragData) => void;
  onDragEnd?: () => void;
  onDrop?: (targetStoreIndex: number, source: MagicDragData) => void;
  // 外部拖拽数据
  dragData?: MagicDragData | null;
  // Tooltip 回调
  onMagicHover?: (magicInfo: MagicItemInfo | null, x: number, y: number) => void;
  onMagicLeave?: () => void;
}

/**
 * 单个武功槽组件
 */
interface MagicSlotProps {
  magic: MagicItem | null;
  magicInfo?: MagicItemInfo | null;
  storeIndex: number;
  config: { left: number; top: number; width: number; height: number };
  onClick?: () => void;
  onRightClick?: () => void;
  onDragStart?: () => void;
  onDragEnd?: () => void;
  onDrop?: () => void;
  isDragging?: boolean;
  // Tooltip events
  onMouseEnter?: (e: React.MouseEvent) => void;
  onMouseMove?: (e: React.MouseEvent) => void;
  onMouseLeave?: () => void;
}

const MagicSlot: React.FC<MagicSlotProps> = ({
  magic,
  magicInfo,
  storeIndex,
  config,
  onClick,
  onRightClick,
  onDragStart,  onDragEnd,  onDrop,
  isDragging,
  onMouseEnter,
  onMouseMove,
  onMouseLeave,
}) => {
  // 优先使用magicInfo
  const displayMagic = magicInfo?.magic;
  const iconPath = displayMagic?.image ?? magic?.iconPath ?? null;
  const name = displayMagic?.name ?? magic?.name ?? "";
  const level = magicInfo?.level ?? magic?.level ?? 0;
  const hasMagic = !!(displayMagic || magic);

  // 用于拖拽图片
  const dragImageRef = useRef<HTMLCanvasElement | null>(null);

  return (
    <div
      style={{
        position: "absolute",
        left: config.left,
        top: config.top,
        width: config.width,
        height: config.height,
        cursor: hasMagic ? "pointer" : "default",
        opacity: isDragging ? 0.5 : 1,
      }}
      draggable={hasMagic}
      onDragStart={(e) => {
        if (hasMagic && onDragStart) {
          e.dataTransfer.effectAllowed = "move";
          // Use canvas as drag image
          const canvas = e.currentTarget.querySelector('canvas');
          if (canvas) {
            e.dataTransfer.setDragImage(canvas, canvas.width / 2, canvas.height / 2);
          }
          onDragStart();
        }
      }}
      onDragEnd={() => {
        // Reset drag state when drag ends (success or failure)
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
      onClick={onClick}
      onContextMenu={(e) => {
        e.preventDefault();
        if (hasMagic) onRightClick?.();
      }}
      onMouseEnter={hasMagic ? onMouseEnter : undefined}
      onMouseMove={hasMagic ? onMouseMove : undefined}
      onMouseLeave={onMouseLeave}
    >
      {hasMagic && iconPath && (
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
          alt={name}
        />
      )}

      {/* 等级显示 */}
      {hasMagic && level > 0 && (
        <span
          style={{
            position: "absolute",
            bottom: 1,
            right: 2,
            fontSize: 9,
            color: "#ffd700",
            fontWeight: "bold",
            textShadow: "0 1px 2px rgba(0,0,0,0.8)",
            pointerEvents: "none",
          }}
        >
          {level}
        </span>
      )}
    </div>
  );
};

export const MagicGui: React.FC<MagicGuiProps> = ({
  isVisible,
  magics,
  magicInfos,
  screenWidth,
  onMagicClick,
  onMagicRightClick,
  onClose: _onClose,
  onDragStart,
  onDragEnd,
  onDrop,
  dragData,
  onMagicHover,
  onMagicLeave,
}) => {
  const [scrollOffset, setScrollOffset] = useState(0);
  const [localDragIndex, setLocalDragIndex] = useState<number | null>(null);

  // 从 UI_Settings.ini 加载配置
  const config = useMagicsGuiConfig();

  // 加载面板背景
  const panelImage = useAsfImage(
    config?.panel.image || "asf/ui/common/panel2.asf"
  );

  // 计算面板位置 - C#: Globals.WindowWidth / 2f + leftAdjust
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

  // 计算当前显示的武功（使用新数据源）
  const visibleData = useMemo(() => {
    if (!config) return [];
    const startIndex = scrollOffset * 3; // 每行3个

    return config.items.map((_, idx) => {
      const dataIndex = startIndex + idx;
      return {
        magicInfo: magicInfos?.[dataIndex] ?? null,
        magic: magics?.[dataIndex] ?? null,
        storeIndex: dataIndex + 1, // Store index从1开始
      };
    });
  }, [magics, magicInfos, scrollOffset, config]);

  // 计算最大滚动行数
  const itemCount = Math.max(magics?.length ?? 0, magicInfos?.length ?? 0);
  const maxScrollRows = Math.max(0, Math.ceil(itemCount / 3) - 3);

  // 滚动处理
  const handleScroll = useCallback(
    (delta: number) => {
      setScrollOffset((prev) =>
        Math.max(0, Math.min(maxScrollRows, prev + delta))
      );
    },
    [maxScrollRows]
  );

  // 拖放处理
  const handleSlotDragStart = useCallback((storeIndex: number) => {
    setLocalDragIndex(storeIndex);
    onDragStart?.({ type: "magic", storeIndex });
  }, [onDragStart]);

  const handleSlotDrop = useCallback((targetStoreIndex: number) => {
    // Always call onDrop with the target index
    // Parent component handles the source data (from MagicGui store or BottomGui)
    if (dragData) {
      onDrop?.(targetStoreIndex, dragData);
    } else {
      // No dragData means it might be from BottomGui, still trigger drop
      onDrop?.(targetStoreIndex, { type: "magic", storeIndex: -1 });
    }
    setLocalDragIndex(null);
    onDragEnd?.();
  }, [dragData, onDrop, onDragEnd]);

  if (!isVisible || !config || !panelStyle) return null;

  return (
    <div
      style={panelStyle}
      onClick={(e) => e.stopPropagation()}
      onWheel={(e) => handleScroll(e.deltaY > 0 ? 1 : -1)}
    >
      {/* 背景面板 */}
      {panelImage.dataUrl && (
        <img
          src={panelImage.dataUrl}
          alt="武功面板"
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

      {/* 武功格子 */}
      {config.items.map((itemConfig, idx) => {
        const data = visibleData[idx];
        // 使用 storeIndex 作为 key，确保滚动时组件正确更新
        // 当滚动改变时，不同的 storeIndex 会触发组件重新挂载
        const slotKey = `slot-${data?.storeIndex ?? idx}-${scrollOffset}`;
        return (
          <MagicSlot
            key={slotKey}
            magic={data?.magic ?? null}
            magicInfo={data?.magicInfo ?? null}
            storeIndex={data?.storeIndex ?? (scrollOffset * 3 + idx + 1)}
            config={itemConfig}
            onClick={() => onMagicClick?.(data?.storeIndex ?? 0)}
            onRightClick={() => onMagicRightClick?.(data?.storeIndex ?? 0)}
            onDragStart={() => handleSlotDragStart(data?.storeIndex ?? 0)}
            onDragEnd={() => {
              setLocalDragIndex(null);
              onDragEnd?.();
            }}
            onDrop={() => handleSlotDrop(data?.storeIndex ?? 0)}
            isDragging={localDragIndex === data?.storeIndex}
            onMouseEnter={(e) => onMagicHover?.(data?.magicInfo ?? null, e.clientX, e.clientY)}
            onMouseMove={(e) => onMagicHover?.(data?.magicInfo ?? null, e.clientX, e.clientY)}
            onMouseLeave={() => onMagicLeave?.()}
          />
        );
      })}

      {/* 滚动条 - 使用 ASF 贴图 */}
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
