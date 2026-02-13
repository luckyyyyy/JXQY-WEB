/**
 * MagicGui Component - based on JxqyHD Engine/Gui/MagicGui.cs
 * Displays player magic/skill list with drag-drop support
 *
 * shows a 3x3 magic grid with scroll bar
 * Resources loaded from UI_Settings.ini
 *
 * Store Indices: 1-36 (StoreIndexBegin to StoreIndexEnd)
 * Bottom Indices: 40-44 (BottomIndexBegin to BottomIndexEnd)
 */

import type { MagicItemInfo } from "@miu2d/engine/magic";
import type React from "react";
import { useCallback, useMemo, useRef, useState } from "react";
import { type TouchDragData, useDevice, useTouchDrag } from "@/contexts";
import { useTouchDropTarget } from "@/hooks";
import { AsfAnimatedSprite } from "./AsfAnimatedSprite";
import { useAsfImage } from "./hooks";
import { ScrollBar } from "./ScrollBar";
import { useMagicsGuiConfig } from "./useUISettings";

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
  storeIndex: number; // 在store中的索引 (1-36)
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
  /** 移动端触摸拖拽 drop 回调 */
  onTouchDrop?: (targetStoreIndex: number, data: TouchDragData) => void;
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
  // 触摸拖拽支持
  onTouchDragStart?: () => void;
  /** 触摸拖拽 drop 回调 */
  onTouchDrop?: (data: TouchDragData) => void;
}

const MagicSlot: React.FC<MagicSlotProps> = ({
  magic,
  magicInfo,
  storeIndex,
  config,
  onClick,
  onRightClick,
  onDragStart,
  onDragEnd,
  onDrop,
  isDragging,
  onMouseEnter,
  onMouseMove,
  onMouseLeave,
  onTouchDragStart,
  onTouchDrop,
}) => {
  // 优先使用magicInfo
  const displayMagic = magicInfo?.magic;
  const iconPath = displayMagic?.image ?? magic?.iconPath ?? null;
  const name = displayMagic?.name ?? magic?.name ?? "";
  const level = magicInfo?.level ?? magic?.level ?? 0;
  const hasMagic = !!(displayMagic || magic);
  const { isMobile } = useDevice();

  // 用于拖拽图片
  const _dragImageRef = useRef<HTMLCanvasElement | null>(null);

  // 触摸拖拽状态（仅移动端使用）
  const touchStartRef = useRef<{ x: number; y: number; time: number } | null>(null);
  const longPressTimerRef = useRef<number | null>(null);

  // 触摸开始 - 长按开始拖拽（仅移动端）
  const handleTouchStart = useCallback(
    (e: React.TouchEvent) => {
      if (!hasMagic || !isMobile) return;

      // 获取按下这个元素的触摸点（可能不是第一个触摸点）
      const touch = e.changedTouches[0];
      if (!touch) return;

      touchStartRef.current = {
        x: touch.clientX,
        y: touch.clientY,
        time: Date.now(),
      };

      // 长按200ms开始拖拽
      longPressTimerRef.current = window.setTimeout(() => {
        if (touchStartRef.current) {
          onTouchDragStart?.();
          // 震动反馈（如果支持）
          if (navigator.vibrate) {
            navigator.vibrate(50);
          }
        }
      }, 200);
    },
    [hasMagic, onTouchDragStart, isMobile]
  );

  // 触摸移动 - 如果移动距离大于阈值，取消长按
  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!touchStartRef.current) return;

    // 获取按下这个元素的触摸点
    const touch = e.changedTouches[0];
    if (!touch) return;

    const dx = touch.clientX - touchStartRef.current.x;
    const dy = touch.clientY - touchStartRef.current.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    // 移动距离超过10px，取消长按
    if (distance > 10 && longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  }, []);

  // 触摸结束
  const handleTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      // 清除长按定时器
      if (longPressTimerRef.current) {
        clearTimeout(longPressTimerRef.current);
        longPressTimerRef.current = null;
      }

      // 检查是否是短按（点击）
      if (touchStartRef.current) {
        const duration = Date.now() - touchStartRef.current.time;
        if (duration < 200) {
          // 短按 = 点击
          e.preventDefault();
          onClick?.();
        }
      }

      touchStartRef.current = null;
    },
    [onClick]
  );

  // 触摸拖拽目标（仅移动端）
  const dropRef = useTouchDropTarget({
    id: `magic-slot-${storeIndex}`,
    onDrop: (data) => onTouchDrop?.(data),
    canDrop: (data) => data.type === "magic",
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
        cursor: hasMagic ? "pointer" : "default",
        opacity: isDragging ? 0.5 : 1,
        touchAction: isMobile ? "none" : undefined,
      }}
      // PC 端拖放事件
      draggable={!isMobile && hasMagic}
      onDragStart={
        !isMobile
          ? (e) => {
              if (hasMagic && onDragStart) {
                e.dataTransfer.effectAllowed = "move";
                const canvas = e.currentTarget.querySelector("canvas");
                if (canvas) {
                  e.dataTransfer.setDragImage(canvas, canvas.width / 2, canvas.height / 2);
                }
                onDragStart();
              }
            }
          : undefined
      }
      onDragEnd={!isMobile ? () => onDragEnd?.() : undefined}
      onDragOver={
        !isMobile
          ? (e) => {
              e.preventDefault();
              e.dataTransfer.dropEffect = "move";
            }
          : undefined
      }
      onDrop={
        !isMobile
          ? (e) => {
              e.preventDefault();
              onDrop?.();
            }
          : undefined
      }
      onClick={onClick}
      onContextMenu={
        !isMobile
          ? (e) => {
              e.preventDefault();
              if (hasMagic) onRightClick?.();
            }
          : undefined
      }
      // PC 端鼠标事件
      onMouseEnter={!isMobile && hasMagic ? onMouseEnter : undefined}
      onMouseMove={!isMobile && hasMagic ? onMouseMove : undefined}
      onMouseLeave={!isMobile ? onMouseLeave : undefined}
      // 移动端触摸事件
      onTouchStart={isMobile ? handleTouchStart : undefined}
      onTouchMove={isMobile ? handleTouchMove : undefined}
      onTouchEnd={isMobile ? handleTouchEnd : undefined}
      onTouchCancel={isMobile ? handleTouchEnd : undefined}
    >
      {hasMagic && (
        <>
          {/* 文字占位符（当图标不存在时显示） */}
          {!iconPath && <span
            style={{
              position: "absolute",
              left: "50%",
              top: "50%",
              transform: "translate(-50%, -50%)",
              fontSize: 12,
              fontWeight: "bold",
              color: "rgba(255,255,255,0.85)",
              textShadow: "0 1px 3px rgba(0,0,0,0.8)",
              textAlign: "center",
              lineHeight: 1.1,
              pointerEvents: "none",
              letterSpacing: 1,
            }}
          >
            {name.slice(0, 2)}
          </span>}
          {/* ASF 动画图标 */}
          {iconPath && (
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
        </>
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
  onTouchDrop,
}) => {
  const [scrollOffset, setScrollOffset] = useState(0);
  const [localDragIndex, setLocalDragIndex] = useState<number | null>(null);

  // 触摸拖拽支持
  const { startDrag } = useTouchDrag();

  // 从 UI_Settings.ini 加载配置
  const config = useMagicsGuiConfig();

  // 加载面板背景
  const panelImage = useAsfImage(config?.panel.image || "asf/ui/common/panel2.asf");

  // 计算面板位置 - Globals.WindowWidth / 2f + leftAdjust
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
      setScrollOffset((prev) => Math.max(0, Math.min(maxScrollRows, prev + delta)));
    },
    [maxScrollRows]
  );

  // 拖放处理
  const handleSlotDragStart = useCallback(
    (storeIndex: number) => {
      setLocalDragIndex(storeIndex);
      onDragStart?.({ type: "magic", storeIndex });
    },
    [onDragStart]
  );

  // 触摸拖拽开始
  const handleTouchDragStart = useCallback(
    (storeIndex: number, magicInfo: MagicItemInfo | null) => {
      setLocalDragIndex(storeIndex);
      onDragStart?.({ type: "magic", storeIndex });
      // 同时通知全局触摸拖拽上下文
      startDrag({
        type: "magic",
        storeIndex,
        source: "magicGui",
        magicInfo,
      });
    },
    [onDragStart, startDrag]
  );

  const handleSlotDrop = useCallback(
    (targetStoreIndex: number) => {
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
    },
    [dragData, onDrop, onDragEnd]
  );

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
        // 使用 storeIndex 和武功名称作为 key，确保滚动或交换时组件正确更新
        // 当数据变化时（包括交换），不同的内容会触发组件重新挂载
        const contentKey = data?.magic?.name ?? data?.magicInfo?.magic?.name ?? "empty";
        const slotKey = `slot-${data?.storeIndex ?? idx}-${scrollOffset}-${contentKey}`;
        return (
          <MagicSlot
            key={slotKey}
            magic={data?.magic ?? null}
            magicInfo={data?.magicInfo ?? null}
            storeIndex={data?.storeIndex ?? scrollOffset * 3 + idx + 1}
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
            onTouchDragStart={() =>
              handleTouchDragStart(data?.storeIndex ?? 0, data?.magicInfo ?? null)
            }
            onTouchDrop={(touchData) => onTouchDrop?.(data?.storeIndex ?? 0, touchData)}
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
