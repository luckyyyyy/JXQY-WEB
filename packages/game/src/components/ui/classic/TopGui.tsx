/**
 * TopGui Component - based on JxqyHD Engine/Gui/TopGui.cs
 * Top button bar for accessing game panels using ASF images from resources
 *
 * loads button images from UI_Settings.ini [Top_*_Btn]
 * Resources: asf/ui/top/*.asf
 */
import type React from "react";
import { useCallback, useMemo, useState } from "react";
import { useAsfImage } from "./hooks";

// UI配置 - 对应 UI_Settings.ini 中的 [Top] 部分
const UI_CONFIG = {
  panel: {
    image: "asf/ui/top/window.asf",
    leftAdjust: 0,
    topAdjust: 0,
  },
  buttons: [
    {
      id: "state",
      image: "asf/ui/top/BtnState.asf",
      left: 52,
      top: 0,
      width: 19,
      height: 19,
      title: "状态 (F1/T)",
    },
    {
      id: "equip",
      image: "asf/ui/top/BtnEquip.asf",
      left: 80,
      top: 0,
      width: 19,
      height: 19,
      title: "装备 (F2/E)",
    },
    {
      id: "xiulian",
      image: "asf/ui/top/BtnXiuLian.asf",
      left: 107,
      top: 0,
      width: 19,
      height: 19,
      title: "修炼 (F3)",
    },
    {
      id: "goods",
      image: "asf/ui/top/BtnGoods.asf",
      left: 135,
      top: 0,
      width: 19,
      height: 19,
      title: "物品 (F5/I)",
    },
    {
      id: "magic",
      image: "asf/ui/top/BtnMagic.asf",
      left: 162,
      top: 0,
      width: 19,
      height: 19,
      title: "武功 (F6/M)",
    },
    {
      id: "memo",
      image: "asf/ui/top/BtnNotes.asf",
      left: 189,
      top: 0,
      width: 19,
      height: 19,
      title: "任务 (F7)",
    },
    {
      id: "system",
      image: "asf/ui/top/BtnOption.asf",
      left: 216,
      top: 0,
      width: 19,
      height: 19,
      title: "系统 (ESC)",
    },
  ],
};

interface TopGuiProps {
  screenWidth: number;
  onStateClick: () => void;
  onEquipClick: () => void;
  onXiuLianClick: () => void;
  onGoodsClick: () => void;
  onMagicClick: () => void;
  onMemoClick: () => void;
  onSystemClick: () => void;
}

/**
 * 单个按钮组件 - 支持 ASF 动画帧（帧0=普通，帧1=按下）
 */
interface TopButtonProps {
  imagePath: string;
  left: number;
  top: number;
  width: number;
  height: number;
  title: string;
  onClick: () => void;
}

const TopButton: React.FC<TopButtonProps> = ({
  imagePath,
  left,
  top,
  width,
  height,
  title,
  onClick,
}) => {
  const [isPressed, setIsPressed] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  // 加载普通状态帧
  const normalImage = useAsfImage(imagePath, 0);
  // 加载按下状态帧
  const pressedImage = useAsfImage(imagePath, 1);

  const handleMouseDown = useCallback(() => {
    setIsPressed(true);
  }, []);

  const handleMouseUp = useCallback(() => {
    setIsPressed(false);
  }, []);

  const handleMouseLeave = useCallback(() => {
    setIsPressed(false);
    setIsHovered(false);
  }, []);

  const handleMouseEnter = useCallback(() => {
    setIsHovered(true);
  }, []);

  const handleClick = useCallback(() => {
    onClick();
  }, [onClick]);

  // 决定显示哪个帧
  const currentImage = isPressed && pressedImage.dataUrl ? pressedImage : normalImage;

  return (
    <div
      style={{
        position: "absolute",
        left: left,
        top: top,
        width: width,
        height: height,
        cursor: "pointer",
        opacity: isHovered ? 1 : 0.9,
        filter: isHovered && !isPressed ? "brightness(1.2)" : "none",
      }}
      title={title}
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onClick={handleClick}
    >
      {currentImage.dataUrl && (
        <img
          src={currentImage.dataUrl}
          alt={title}
          style={{
            width: currentImage.width || width,
            height: currentImage.height || height,
            imageRendering: "pixelated",
            pointerEvents: "none",
          }}
          draggable={false}
        />
      )}
    </div>
  );
};

export const TopGui: React.FC<TopGuiProps> = ({
  screenWidth,
  onStateClick,
  onEquipClick,
  onXiuLianClick,
  onGoodsClick,
  onMagicClick,
  onMemoClick,
  onSystemClick,
}) => {
  // 加载面板背景
  const panelImage = useAsfImage(UI_CONFIG.panel.image);

  // 按钮处理器映射
  const handlers: Record<string, () => void> = useMemo(
    () => ({
      state: onStateClick,
      equip: onEquipClick,
      xiulian: onXiuLianClick,
      goods: onGoodsClick,
      magic: onMagicClick,
      memo: onMemoClick,
      system: onSystemClick,
    }),
    [
      onStateClick,
      onEquipClick,
      onXiuLianClick,
      onGoodsClick,
      onMagicClick,
      onMemoClick,
      onSystemClick,
    ]
  );

  // 计算面板位置
  // Position = new Vector2((Globals.WindowWidth - BaseTexture.Width) / 2f + leftAdjust, topAdjust)
  const panelStyle = useMemo(() => {
    const panelWidth = panelImage.width || 286; // fallback size
    const panelHeight = panelImage.height || 19;

    return {
      position: "absolute" as const,
      left: (screenWidth - panelWidth) / 2 + UI_CONFIG.panel.leftAdjust,
      top: UI_CONFIG.panel.topAdjust,
      width: panelWidth,
      height: panelHeight,
      pointerEvents: "auto" as const,
      zIndex: 1000, // 确保 TopGui 永远置于顶部
    };
  }, [screenWidth, panelImage.width, panelImage.height]);

  // 如果面板图片还在加载
  if (panelImage.isLoading) {
    return (
      <div
        style={{
          ...panelStyle,
          background: "rgba(40, 60, 90, 0.9)",
          borderRadius: "0 0 4px 4px",
        }}
      />
    );
  }

  return (
    <div style={panelStyle}>
      {/* 背景面板 */}
      {panelImage.dataUrl && (
        <img
          src={panelImage.dataUrl}
          alt="顶部按钮栏"
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

      {/* 按钮 */}
      {UI_CONFIG.buttons.map((btn) => (
        <TopButton
          key={btn.id}
          imagePath={btn.image}
          left={btn.left}
          top={btn.top}
          width={btn.width}
          height={btn.height}
          title={btn.title}
          onClick={handlers[btn.id]}
        />
      ))}
    </div>
  );
};
