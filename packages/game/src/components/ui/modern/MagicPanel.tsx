/**
 * Modern MagicPanel - 武侠风格武功面板
 * 使用毛玻璃效果 + 武侠配色，参考StatePanel设计
 */

import type { MagicItemInfo } from "@miu2d/engine/magic";
import type React from "react";
import { useCallback, useMemo, useState } from "react";
import type { TouchDragData } from "../../../contexts";
import type { BottomMagicDragData } from "../../hooks";
import { AsfAnimatedSprite } from "../classic/AsfAnimatedSprite";
import type { MagicDragData, MagicItem } from "../classic/MagicGui";
import { borderRadius, glassEffect, modernColors, spacing, transitions, typography } from "./theme";

interface MagicPanelProps {
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
  // BottomGui 的拖拽数据
  bottomDragData?: BottomMagicDragData | null;
  // Tooltip 回调
  onMagicHover?: (magicInfo: MagicItemInfo | null, x: number, y: number) => void;
  onMagicLeave?: () => void;
  /** 移动端触摸拖拽 drop 回调 */
  onTouchDrop?: (targetStoreIndex: number, data: TouchDragData) => void;
}

interface MagicSlotProps {
  magic: MagicItem | null;
  magicInfo?: MagicItemInfo | null;
  storeIndex: number;
  onClick?: () => void;
  onRightClick?: () => void;
  onDragStart?: () => void;
  onDrop?: () => void;
  onMouseEnter?: (e: React.MouseEvent) => void;
  onMouseMove?: (e: React.MouseEvent) => void;
  onMouseLeave?: () => void;
}

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
    ✕
  </button>
);

// 分区标题组件
const SectionTitle: React.FC<{ title: string }> = ({ title }) => (
  <div
    style={{
      fontSize: typography.fontSize.sm,
      color: modernColors.text.secondary,
      marginBottom: spacing.sm,
      display: "flex",
      alignItems: "center",
      gap: spacing.sm,
    }}
  >
    <span
      style={{
        width: 16,
        height: 1,
        background: `linear-gradient(90deg, ${wuxiaAccent.gold}, transparent)`,
      }}
    />
    {title}
    <span
      style={{
        flex: 1,
        height: 1,
        background: `linear-gradient(90deg, transparent, ${modernColors.border.glass})`,
      }}
    />
  </div>
);

// 武功槽位组件 - 六边形设计
const MagicSlot: React.FC<MagicSlotProps> = ({
  magic,
  magicInfo,
  onClick,
  onRightClick,
  onDragStart,
  onDrop,
  onMouseEnter,
  onMouseMove,
  onMouseLeave,
}) => {
  const [isHovered, setIsHovered] = useState(false);
  const iconPath = magicInfo?.magic?.image ?? magic?.iconPath ?? null;
  const displayName = magicInfo?.magic?.name ?? magic?.name ?? "";
  const level = magicInfo?.level ?? magic?.level ?? 0;
  const hasMagic = !!(magicInfo?.magic || magic);

  // 六边形裁剪路径
  const hexClip = "polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)";

  return (
    <div
      style={{
        width: 68,
        height: 74,
        position: "relative",
        cursor: hasMagic ? "grab" : "default",
        transition: transitions.fast,
        transform: isHovered && hasMagic ? "scale(1.08)" : "scale(1)",
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
      onMouseMove={(e) => {
        if (hasMagic) onMouseMove?.(e);
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
      onDragOver={(e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
      }}
      onDrop={(e) => {
        e.preventDefault();
        onDrop?.();
      }}
    >
      {/* 外框装饰 - 六边形 */}
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

      {/* 内部容器 - 六边形 */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: hasMagic
            ? isHovered
              ? "rgba(30, 35, 50, 0.9)"
              : "rgba(20, 25, 40, 0.85)"
            : "rgba(10, 15, 25, 0.6)",
          clipPath: hexClip,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          overflow: "hidden",
          boxShadow: hasMagic && isHovered ? `inset 0 0 20px ${wuxiaAccent.gold}33` : "none",
          transition: transitions.fast,
        }}
      >
        {/* 武功图标：占位符在底层，ASF 动画覆盖在上层 */}
        {hasMagic && (
          <>
            {/* 文字占位符（当图标不存在时显示） */}
            {!iconPath && (
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <span
                  style={{
                    fontSize: 16,
                    fontWeight: 700,
                    color: "rgba(255,255,255,0.9)",
                    textShadow: "0 1px 4px rgba(0,0,0,0.8), 0 0 8px rgba(0,0,0,0.4)",
                    textAlign: "center",
                    lineHeight: 1.1,
                    letterSpacing: 1,
                  }}
                >
                  {displayName.slice(0, 2)}
                </span>
              </div>
            )}
            {/* ASF 动画图标 */}
            {iconPath && (
              <AsfAnimatedSprite
                path={iconPath}
                autoPlay={true}
                loop={true}
                style={{
                  maxWidth: 44,
                  maxHeight: 44,
                  pointerEvents: "none",
                  filter: isHovered ? "brightness(1.2)" : "brightness(1)",
                }}
                alt={displayName}
              />
            )}
          </>
        )}

        {/* 空槽位图标 */}
        {!hasMagic && (
          <div
            style={{
              width: 24,
              height: 24,
              border: `1px dashed ${modernColors.border.glass}`,
              borderRadius: borderRadius.sm,
              opacity: 0.3,
            }}
          />
        )}
      </div>

      {/* 等级角标 */}
      {hasMagic && level > 0 && (
        <div
          style={{
            position: "absolute",
            bottom: 4,
            right: 4,
            minWidth: 18,
            height: 18,
            padding: "0 4px",
            background: `linear-gradient(135deg, ${wuxiaAccent.crimson}, ${wuxiaAccent.crimson}cc)`,
            borderRadius: 9,
            border: `1px solid ${wuxiaAccent.goldDark}`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: "0 2px 4px rgba(0,0,0,0.4)",
          }}
        >
          <span
            style={{
              fontSize: 10,
              fontWeight: typography.fontWeight.bold,
              color: modernColors.text.primary,
              textShadow: "0 1px 2px rgba(0,0,0,0.5)",
            }}
          >
            {level}
          </span>
        </div>
      )}
    </div>
  );
};

export const MagicPanel: React.FC<MagicPanelProps> = ({
  isVisible,
  magics,
  magicInfos,
  screenWidth,
  onMagicClick,
  onMagicRightClick,
  onClose,
  onDragStart,
  onDragEnd,
  onDrop,
  dragData,
  bottomDragData,
  onMagicHover,
  onMagicLeave,
  onTouchDrop,
}) => {
  const [scrollOffset, setScrollOffset] = useState(0);
  const panelWidth = 280;

  // 位置: 屏幕中央偏右
  const panelStyle: React.CSSProperties = useMemo(
    () => ({
      position: "absolute",
      left: screenWidth / 2 + 20,
      top: 30,
      width: panelWidth,
      maxHeight: "calc(100vh - 120px)",
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

  // 固定显示 9 个槽位 (3x3)，带滚动
  const slotsPerPage = 9;
  const cols = 3;

  // 生成槽位数据：固定36个槽位
  const allSlots = useMemo(() => {
    const result: Array<{
      magic: MagicItem | null;
      magicInfo: MagicItemInfo | null;
      storeIndex: number;
    }> = [];
    for (let i = 0; i < 36; i++) {
      const magic = magics?.[i] ?? null;
      const magicInfo = magicInfos?.[i] ?? null;
      result.push({ magic, magicInfo, storeIndex: i + 1 });
    }
    return result;
  }, [magics, magicInfos]);

  // 当前显示的武功
  const visibleSlots = useMemo(() => {
    return allSlots.slice(scrollOffset * cols, scrollOffset * cols + slotsPerPage);
  }, [allSlots, scrollOffset]);

  // 统计有多少武功
  const magicCount = useMemo(() => {
    return allSlots.filter((s) => s.magic || s.magicInfo?.magic).length;
  }, [allSlots]);

  // 最大滚动行数
  const maxScrollRow = Math.max(0, Math.ceil(36 / cols) - Math.ceil(slotsPerPage / cols));

  // 滚动处理
  const handleScroll = useCallback(
    (e: React.WheelEvent) => {
      const delta = e.deltaY > 0 ? 1 : -1;
      setScrollOffset((prev) => Math.max(0, Math.min(maxScrollRow, prev + delta)));
    },
    [maxScrollRow]
  );

  const handleDragStart = useCallback(
    (storeIndex: number) => () => {
      onDragStart?.({ type: "magic", storeIndex });
    },
    [onDragStart]
  );

  const handleDrop = useCallback(
    (storeIndex: number) => () => {
      // 优先处理从武功列表拖来的
      if (dragData && dragData.storeIndex > 0) {
        onDrop?.(storeIndex, dragData);
      }
      // 处理从底部快捷栏拖来的
      else if (bottomDragData && bottomDragData.listIndex > 0) {
        onDrop?.(storeIndex, { type: "magic", storeIndex: bottomDragData.listIndex });
      }
    },
    [dragData, bottomDragData, onDrop]
  );

  // 鼠标进入/移动时更新Tooltip位置（跟随鼠标）
  const handleMouseEnter = useCallback(
    (magicInfo: MagicItemInfo | null) => (e: React.MouseEvent) => {
      onMagicHover?.(magicInfo, e.clientX, e.clientY);
    },
    [onMagicHover]
  );

  const handleMouseMove = useCallback(
    (magicInfo: MagicItemInfo | null) => (e: React.MouseEvent) => {
      onMagicHover?.(magicInfo, e.clientX, e.clientY);
    },
    [onMagicHover]
  );

  if (!isVisible) return null;

  return (
    <div style={panelStyle} onClick={(e) => e.stopPropagation()} onWheel={handleScroll}>
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
          {/* 武功图标 - 八角形 */}
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
                background: `linear-gradient(135deg, ${wuxiaAccent.purple}44, ${wuxiaAccent.azure}44)`,
                clipPath:
                  "polygon(30% 0%, 70% 0%, 100% 30%, 100% 70%, 70% 100%, 30% 100%, 0% 70%, 0% 30%)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <span style={{ fontSize: 22, filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.5))" }}>
                ⚔️
              </span>
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
              武功秘籍
            </div>
            <div
              style={{
                fontSize: typography.fontSize.sm,
                color: modernColors.text.secondary,
              }}
            >
              已习得{" "}
              <span style={{ color: wuxiaAccent.gold, fontWeight: typography.fontWeight.semibold }}>
                {magicCount}
              </span>{" "}
              种武学
            </div>
          </div>
        </div>
      </div>

      {/* 武功列表区域 */}
      <div style={{ padding: `${spacing.md}px ${spacing.lg}px` }}>
        <SectionTitle title="招式列表" />

        {/* 蜂窝状武功网格 */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: spacing.xs,
            padding: `${spacing.sm}px 0`,
          }}
        >
          {/* 3行，每行3个，奇数行偏移 */}
          {[0, 1, 2].map((rowIndex) => (
            <div
              key={`magic-row-${rowIndex}`}
              style={{
                display: "flex",
                gap: spacing.xs,
                marginLeft: rowIndex % 2 === 1 ? 36 : 0, // 奇数行右偏移
              }}
            >
              {visibleSlots.slice(rowIndex * cols, rowIndex * cols + cols).map((item) => {
                // 使用 storeIndex 和武功名称作为 key，确保滚动或交换时组件正确更新
                const contentKey = item.magic?.name ?? item.magicInfo?.magic?.name ?? "empty";
                const slotKey = `slot-${item.storeIndex}-${scrollOffset}-${contentKey}`;
                return (
                  <MagicSlot
                    key={slotKey}
                    magic={item.magic}
                    magicInfo={item.magicInfo}
                    storeIndex={item.storeIndex}
                    onClick={() => onMagicClick?.(item.storeIndex)}
                    onRightClick={() => onMagicRightClick?.(item.storeIndex)}
                    onDragStart={handleDragStart(item.storeIndex)}
                    onDrop={handleDrop(item.storeIndex)}
                    onMouseEnter={handleMouseEnter(item.magicInfo)}
                    onMouseMove={handleMouseMove(item.magicInfo)}
                    onMouseLeave={onMagicLeave}
                  />
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {/* 翻页指示器 */}
      {maxScrollRow > 0 && (
        <div
          style={{
            padding: `${spacing.sm}px ${spacing.lg}px`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: spacing.md,
          }}
        >
          <button
            onClick={() => setScrollOffset((p) => Math.max(0, p - 1))}
            disabled={scrollOffset === 0}
            style={{
              width: 28,
              height: 28,
              background: scrollOffset > 0 ? modernColors.bg.hover : "transparent",
              border: `1px solid ${modernColors.border.glass}`,
              borderRadius: borderRadius.sm,
              color: scrollOffset > 0 ? modernColors.text.secondary : modernColors.text.muted,
              fontSize: typography.fontSize.md,
              cursor: scrollOffset > 0 ? "pointer" : "default",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              transition: transitions.fast,
            }}
          >
            ▲
          </button>
          <div style={{ display: "flex", gap: spacing.xs }}>
            {Array.from({ length: maxScrollRow + 1 }).map((_, i) => (
              <div
                key={`page-dot-${i}`}
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: borderRadius.round,
                  background: i === scrollOffset ? wuxiaAccent.gold : modernColors.border.glass,
                  transition: transitions.fast,
                  cursor: "pointer",
                }}
                onClick={() => setScrollOffset(i)}
              />
            ))}
          </div>
          <button
            onClick={() => setScrollOffset((p) => Math.min(maxScrollRow, p + 1))}
            disabled={scrollOffset === maxScrollRow}
            style={{
              width: 28,
              height: 28,
              background: scrollOffset < maxScrollRow ? modernColors.bg.hover : "transparent",
              border: `1px solid ${modernColors.border.glass}`,
              borderRadius: borderRadius.sm,
              color:
                scrollOffset < maxScrollRow ? modernColors.text.secondary : modernColors.text.muted,
              fontSize: typography.fontSize.md,
              cursor: scrollOffset < maxScrollRow ? "pointer" : "default",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              transition: transitions.fast,
            }}
          >
            ▼
          </button>
        </div>
      )}

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
          <span style={{ color: wuxiaAccent.azure }}>右键</span> 添加快捷栏
        </span>
        <span style={{ color: modernColors.border.glass }}>|</span>
        <span style={{ fontSize: typography.fontSize.xs, color: modernColors.text.muted }}>
          <span style={{ color: wuxiaAccent.azure }}>拖拽</span> 交换位置
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
