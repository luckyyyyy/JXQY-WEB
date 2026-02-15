/**
 * XiuLianGui Component - based on JxqyHD Engine/Gui/XiuLianGui.cs
 * Displays magic/skill cultivation interface
 *
 * shows magic info, level, exp, and introduction
 * Resources loaded from UI_Settings.ini
 *
 * 修炼武功存储在 PlayerMagicInventory 的 xiuLianIndex (索引 49)
 * 支持从武功面板(MagicGui)和快捷栏(BottomGui)拖放武功到此处进行修炼
 */

import type { MagicItemInfo } from "@miu2d/engine/magic";
import { useDevice } from "@miu2d/shared";
import type React from "react";
import { useCallback, useMemo } from "react";
import type { TouchDragData } from "../../../contexts";
import { useTouchDragSource, useTouchDropTarget } from "../../../hooks";
import { useAsfAnimation, useAsfImage } from "./hooks";
import type { MagicDragData } from "./MagicGui";
import { useXiuLianGuiConfig } from "./useUISettings";

// 修炼中的武功数据 - 兼容旧接口
export interface XiuLianMagic {
  id: string;
  name: string;
  iconPath?: string;
  level: number;
  exp: number;
  levelUpExp: number;
  intro: string;
}

// BottomGui 的拖拽数据类型
interface BottomMagicDragData {
  bottomSlot: number;
  listIndex: number;
}

interface XiuLianGuiProps {
  isVisible: boolean;
  // 旧接口
  magic?: XiuLianMagic | null;
  // 新接口：直接传入 MagicItemInfo
  magicInfo?: MagicItemInfo | null;
  screenWidth: number;
  onMagicClick?: () => void;
  onClose: () => void;
  // 拖放支持
  onDrop?: (sourceIndex: number) => void; // 接收从其他地方拖来的武功
  onDragStart?: (data: MagicDragData) => void; // 可以把修炼武功拖出去
  onDragEnd?: () => void;
  // 外部拖拽数据（用于判断是否可以放下）
  dragData?: MagicDragData | null;
  // BottomGui 的拖拽数据
  bottomDragData?: BottomMagicDragData | null;
  // Tooltip 支持
  onMagicHover?: (magicInfo: MagicItemInfo | null, x: number, y: number) => void;
  onMagicLeave?: () => void;
  /** 移动端触摸拖拽 drop 回调 */
  onTouchDrop?: (data: TouchDragData) => void;
}

export const XiuLianGui: React.FC<XiuLianGuiProps> = ({
  isVisible,
  magic,
  magicInfo,
  screenWidth,
  onMagicClick,
  onDrop,
  onDragStart,
  onDragEnd,
  dragData,
  bottomDragData,
  onMagicHover,
  onMagicLeave,
  onTouchDrop,
}) => {
  // 从 UI_Settings.ini 加载配置
  const config = useXiuLianGuiConfig();

  // 优先使用新接口数据
  const displayMagic = magicInfo?.magic;
  const displayLevel = magicInfo?.level ?? magic?.level ?? 0;
  const displayExp = magicInfo?.exp ?? magic?.exp ?? 0;
  const displayLevelUpExp = displayMagic?.levelupExp ?? magic?.levelUpExp ?? 0;
  const displayName = displayMagic?.name ?? magic?.name ?? "";
  const displayIntro = displayMagic?.intro ?? magic?.intro ?? "";
  const iconPath = displayMagic?.image ?? magic?.iconPath ?? null;
  const hasMagic = !!(displayMagic || magic);

  // 加载面板背景
  const panelImage = useAsfImage(config?.panel.image || "asf/ui/common/panel6.asf");
  // 加载武功图标 - 使用动态动画播放
  const magicIcon = useAsfAnimation(iconPath, true, true);

  // 处理拖放
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      // 调用 onDrop，由 GameUI 处理具体的交换逻辑
      // 支持从 MagicGui 或 BottomGui 拖拽到此处
      if (dragData && dragData.storeIndex > 0) {
        // 从 MagicGui 拖拽（使用 storeIndex）
        onDrop?.(dragData.storeIndex);
      } else if (bottomDragData && bottomDragData.listIndex > 0) {
        // 从 BottomGui 拖拽（使用 listIndex）
        onDrop?.(bottomDragData.listIndex);
      }
      onDragEnd?.();
    },
    [dragData, bottomDragData, onDrop, onDragEnd]
  );

  const handleDragStart = useCallback(
    (e: React.DragEvent) => {
      if (hasMagic) {
        e.dataTransfer.effectAllowed = "move";
        // 查找武功图标img元素作为拖拽图像
        const img = e.currentTarget.querySelector("img") as HTMLImageElement;
        if (img) {
          e.dataTransfer.setDragImage(img, img.width / 2, img.height / 2);
        }
        // 修炼槽的 storeIndex 使用 xiuLianIndex (49)
        onDragStart?.({ type: "magic", storeIndex: 49 });
      }
    },
    [hasMagic, onDragStart]
  );

  // 触摸拖拽支持（仅移动端）
  const { isMobile } = useDevice();
  const touchHandlers = useTouchDragSource({
    hasContent: hasMagic,
    getDragData: () =>
      hasMagic && magicInfo
        ? {
            type: "magic",
            storeIndex: 49,
            source: "xiuLianGui",
            magicInfo,
            displayName: displayName,
            iconPath: iconPath ?? undefined,
          }
        : null,
    onClick: onMagicClick,
    enabled: isMobile,
  });

  // 触摸拖拽目标（仅移动端）- 接受武功拖拽
  const dropRef = useTouchDropTarget({
    id: "xiulian-slot",
    onDrop: (data) => onTouchDrop?.(data),
    canDrop: (data) => data.type === "magic",
    enabled: isMobile,
  });

  // 计算面板位置 - Globals.WindowWidth / 2f - Width + leftAdjust
  const panelStyle = useMemo(() => {
    if (!config) return null;
    const panelWidth = panelImage.width || 290;
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

  if (!isVisible || !config || !panelStyle) return null;

  return (
    <div style={panelStyle} onClick={(e) => e.stopPropagation()}>
      {/* 背景面板 */}
      {panelImage.dataUrl && (
        <img
          src={panelImage.dataUrl}
          alt="修炼面板"
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

      {/* 武功图标槽 - 支持拖放 */}
      <div
        ref={dropRef}
        style={{
          position: "absolute",
          left: config.magicImage.left,
          top: config.magicImage.top,
          width: config.magicImage.width,
          height: config.magicImage.height,
          cursor: hasMagic ? "pointer" : "default",
          touchAction: isMobile ? "none" : undefined,
        }}
        // PC 端拖放事件
        onDragOver={!isMobile ? handleDragOver : undefined}
        onDrop={!isMobile ? handleDrop : undefined}
        onClick={onMagicClick}
        // PC 端鼠标事件
        onMouseEnter={
          !isMobile
            ? (e) => {
                if (hasMagic && magicInfo) {
                  onMagicHover?.(magicInfo, e.clientX, e.clientY);
                }
              }
            : undefined
        }
        onMouseMove={
          !isMobile
            ? (e) => {
                if (hasMagic && magicInfo) {
                  onMagicHover?.(magicInfo, e.clientX, e.clientY);
                }
              }
            : undefined
        }
        onMouseLeave={!isMobile ? () => onMagicLeave?.() : undefined}
        // 移动端触摸事件
        {...touchHandlers}
      >
        {/* 文字占位符（当图标不存在时可见） */}
        {hasMagic && !magicIcon.dataUrl && (
          <span
            style={{
              position: "absolute",
              left: 0,
              top: 0,
              width: config.magicImage.width,
              height: config.magicImage.height,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 14,
              fontWeight: "bold",
              color: "rgba(255,255,255,0.85)",
              textShadow: "0 1px 3px rgba(0,0,0,0.8)",
              textAlign: "center",
              letterSpacing: 1,
              pointerEvents: "none",
            }}
          >
            {displayName.slice(0, 2)}
          </span>
        )}
        {/* ASF 动画图标 */}
        {hasMagic && magicIcon.dataUrl && (
          <img
            src={magicIcon.dataUrl}
            alt={displayName}
            draggable={!isMobile}
            onDragStart={!isMobile ? handleDragStart : undefined}
            style={{
              position: "absolute",
              left: (config.magicImage.width - magicIcon.width) / 2,
              top: (config.magicImage.height - magicIcon.height) / 2,
              width: magicIcon.width,
              height: magicIcon.height,
              imageRendering: "pixelated",
              cursor: "pointer",
            }}
          />
        )}
      </div>

      {/* 等级 */}
      <div
        style={{
          position: "absolute",
          left: config.levelText.left,
          top: config.levelText.top,
          fontSize: 12,
          fontFamily: "SimSun, serif",
          color: config.levelText.color,
        }}
      >
        {hasMagic ? `${displayLevel}/10` : "0/10"}
      </div>

      {/* 经验 */}
      <div
        style={{
          position: "absolute",
          left: config.expText.left,
          top: config.expText.top,
          fontSize: 12,
          fontFamily: "SimSun, serif",
          color: config.expText.color,
        }}
      >
        {hasMagic ? `${displayExp}/${displayLevelUpExp}` : "0/0"}
      </div>

      {/* 武功名称 */}
      <div
        style={{
          position: "absolute",
          left: config.nameText.left,
          top: config.nameText.top,
          fontSize: 14,
          fontFamily: "SimSun, serif",
          fontWeight: "bold",
          color: config.nameText.color,
        }}
      >
        {displayName}
      </div>

      {/* 武功介绍 */}
      <div
        style={{
          position: "absolute",
          left: config.introText.left,
          top: config.introText.top,
          width: config.introText.width,
          height: config.introText.height,
          fontSize: 12,
          fontFamily: "SimSun, serif",
          color: config.introText.color,
          overflow: "hidden",
          lineHeight: "18px",
          whiteSpace: "pre-wrap",
          wordBreak: "break-all",
        }}
      >
        {displayIntro}
      </div>
    </div>
  );
};
