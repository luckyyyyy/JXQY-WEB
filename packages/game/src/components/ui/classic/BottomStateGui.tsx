/**
 * BottomStateGui Component - based on JxqyHD Engine/Gui/ColumnGui.cs
 * Shows life, thew (stamina), and mana using ASF images from resources
 *
 * uses ColumnView for each stat bar
 * Resources: asf/ui/column/ColLife.asf, ColThew.asf, ColMana.asf, panel9.asf
 */
import type React from "react";
import { useMemo } from "react";
import { useAsfImage, useColumnView } from "./hooks";

// UI配置 - 对应 UI_Settings.ini 中的 [BottomState] 部分
const UI_CONFIG = {
  panel: {
    image: "asf/ui/column/panel9.asf",
    leftAdjust: -320, // 相对于屏幕中心的偏移
    topAdjust: 0,
  },
  life: {
    image: "asf/ui/column/ColLife.asf",
    left: 11,
    top: 22,
    width: 48,
    height: 46,
  },
  thew: {
    image: "asf/ui/column/ColThew.asf",
    left: 59,
    top: 22,
    width: 48,
    height: 46,
  },
  mana: {
    image: "asf/ui/column/ColMana.asf",
    left: 113,
    top: 22,
    width: 48,
    height: 46,
  },
};

interface BottomStateGuiProps {
  life: number;
  maxLife: number;
  thew: number;
  maxThew: number;
  mana: number;
  maxMana: number;
  screenWidth: number;
  screenHeight: number;
}

/**
 * ColumnView Component - renders a stat orb with fill based on percentage
 * /Gui/Base/ColumnView.cs
 */
interface ColumnViewProps {
  imagePath: string;
  percent: number;
  left: number;
  top: number;
}

const ColumnView: React.FC<ColumnViewProps> = ({ imagePath, percent, left, top }) => {
  const { dataUrl, width, height, isLoading } = useColumnView(imagePath, percent);

  if (isLoading || !dataUrl) {
    return null;
  }

  return (
    <img
      src={dataUrl}
      alt=""
      style={{
        position: "absolute",
        left: left,
        top: top,
        width: width,
        height: height,
        pointerEvents: "none",
        imageRendering: "pixelated",
      }}
    />
  );
};

export const BottomStateGui: React.FC<BottomStateGuiProps> = ({
  life,
  maxLife,
  thew,
  maxThew,
  mana,
  maxMana,
  screenWidth,
  screenHeight: _screenHeight,
}) => {
  // 加载面板背景
  const panelImage = useAsfImage(UI_CONFIG.panel.image);

  // 计算百分比
  const lifePercent = maxLife > 0 ? Math.max(0, Math.min(1, life / maxLife)) : 0;
  const thewPercent = maxThew > 0 ? Math.max(0, Math.min(1, thew / maxThew)) : 0;
  const manaPercent = maxMana > 0 ? Math.max(0, Math.min(1, mana / maxMana)) : 0;

  // 计算面板位置 - 对应中的 Position 计算
  // Position = new Vector2(Globals.WindowWidth/2f + leftAdjust, Globals.WindowHeight - height + topAdjust)
  const panelStyle = useMemo(() => {
    const panelWidth = panelImage.width || 172; // fallback size
    const panelHeight = panelImage.height || 68;

    return {
      position: "absolute" as const,
      left: screenWidth / 2 + UI_CONFIG.panel.leftAdjust,
      bottom: 0 - UI_CONFIG.panel.topAdjust,
      width: panelWidth,
      height: panelHeight,
      pointerEvents: "none" as const,
    };
  }, [screenWidth, panelImage.width, panelImage.height]);

  // 如果面板图片还在加载，显示简单的占位
  if (panelImage.isLoading) {
    return (
      <div
        style={{
          ...panelStyle,
          background: "rgba(20, 30, 50, 0.8)",
          borderRadius: 4,
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
          alt="状态栏"
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            width: panelImage.width,
            height: panelImage.height,
            imageRendering: "pixelated",
          }}
        />
      )}

      {/* 生命球 - Life */}
      <ColumnView
        imagePath={UI_CONFIG.life.image}
        percent={lifePercent}
        left={UI_CONFIG.life.left}
        top={UI_CONFIG.life.top}
      />

      {/* 体力球 - Thew */}
      <ColumnView
        imagePath={UI_CONFIG.thew.image}
        percent={thewPercent}
        left={UI_CONFIG.thew.left}
        top={UI_CONFIG.thew.top}
      />

      {/* 内力球 - Mana */}
      <ColumnView
        imagePath={UI_CONFIG.mana.image}
        percent={manaPercent}
        left={UI_CONFIG.mana.left}
        top={UI_CONFIG.mana.top}
      />
    </div>
  );
};
