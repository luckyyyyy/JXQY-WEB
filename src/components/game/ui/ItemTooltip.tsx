/**
 * ItemTooltip Component - based on JxqyHD Engine/Gui/ToolTipGuiType1.cs
 * Displays item information when hovering over inventory/equipment slots
 *
 * Layout from UI_Settings.ini [ToolTip_Type1] section:
 * - Background: tipbox.asf
 * - Item Image: Left=132, Top=47, 60x75
 * - Name: Left=67, Top=191
 * - Price/Level: Left=160, Top=191
 * - Effect: Left=67, Top=215
 * - Intro: Left=67, Top=235 (approx)
 */
import type React from "react";
import { useEffect, useMemo, useState } from "react";
import type { Good } from "@/engine/player/goods";
import { useAsfImage } from "./hooks";

interface ItemTooltipProps {
  good: Good | null;
  isRecycle?: boolean; // Show sell price instead of buy price
  position: { x: number; y: number };
  isVisible: boolean;
}

export const ItemTooltip: React.FC<ItemTooltipProps> = ({
  good,
  isRecycle = false,
  position,
  isVisible,
}) => {
  // Load tooltip background - tipbox.asf from UI_Settings.ini
  const bgImage = useAsfImage("asf/ui/common/tipbox.asf", 0);

  // Track actual background dimensions
  const [bgSize, setBgSize] = useState({ width: 265, height: 270 });

  // Get actual size from loaded image
  useEffect(() => {
    if (bgImage.dataUrl) {
      const img = new Image();
      img.onload = () => {
        setBgSize({ width: img.width, height: img.height });
      };
      img.src = bgImage.dataUrl;
    }
  }, [bgImage.dataUrl]);

  // Load item image
  const itemImage = useAsfImage(good?.imagePath ?? null, 0);

  // Build effect text (matches C#'s ShowGood method)
  const effectText = useMemo(() => {
    if (!good) return "";
    return good.getEffectString();
  }, [good]);

  // Price text
  const priceText = useMemo(() => {
    if (!good) return "价格： 0";
    const price = isRecycle ? good.sellPrice : good.cost;
    return (isRecycle ? "回收价格： " : "价格： ") + price;
  }, [good, isRecycle]);

  if (!isVisible || !good) return null;

  // Use actual background size
  const tooltipWidth = bgSize.width;
  const tooltipHeight = bgSize.height;

  // Position tooltip to avoid going off screen
  // TopAdjust=27 from config
  const adjustedX = Math.min(position.x + 10, window.innerWidth - tooltipWidth - 20);
  const adjustedY = Math.min(position.y + 27, window.innerHeight - tooltipHeight - 20);

  return (
    <div
      style={{
        position: "fixed",
        left: adjustedX,
        top: adjustedY,
        width: tooltipWidth,
        height: tooltipHeight,
        zIndex: 10000,
        pointerEvents: "none",
      }}
    >
      {/* Background - tipbox.asf */}
      {bgImage.dataUrl ? (
        <img
          src={bgImage.dataUrl}
          alt=""
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            imageRendering: "pixelated",
          }}
        />
      ) : (
        <div
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            width: tooltipWidth,
            height: tooltipHeight,
            background: "linear-gradient(to bottom, #4a3a2a 0%, #2a1a0a 100%)",
            border: "2px solid #8B7355",
            borderRadius: 4,
          }}
        />
      )}

      {/* Item Image - C# config: Left=132, Top=47, Width=60, Height=75 */}
      <div
        style={{
          position: "absolute",
          left: 132,
          top: 47,
          width: 60,
          height: 75,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {itemImage.dataUrl && (
          <img
            src={itemImage.dataUrl}
            alt={good.name}
            style={{
              maxWidth: 60,
              maxHeight: 75,
              imageRendering: "pixelated",
            }}
          />
        )}
      </div>

      {/* Item Name - C# config: Left=67, Top=191, Color=102,73,212,204 (purple) */}
      <div
        style={{
          position: "absolute",
          left: 67,
          top: 191,
          width: 90,
          height: 20,
          color: "rgb(102, 73, 212)",
          fontSize: 12,
          fontFamily: "SimSun, serif",
          whiteSpace: "nowrap",
          overflow: "hidden",
        }}
      >
        {good.name || "无名称"}
      </div>

      {/* Price - C# config: Left=160, Top=191, Color=91,31,27,204 (dark red) */}
      <div
        style={{
          position: "absolute",
          left: 160,
          top: 191,
          width: 88,
          height: 20,
          color: "rgb(91, 31, 27)",
          fontSize: 12,
          fontFamily: "SimSun, serif",
          whiteSpace: "nowrap",
        }}
      >
        {priceText}
      </div>

      {/* Effect Text - C# config: Left=67, Top=215, Color=0,0,255,204 (blue) */}
      <div
        style={{
          position: "absolute",
          left: 67,
          top: 215,
          width: 188,
          height: 20,
          color: "rgb(0, 0, 255)",
          fontSize: 12,
          fontFamily: "SimSun, serif",
          whiteSpace: "nowrap",
          overflow: "hidden",
        }}
      >
        {effectText}
      </div>

      {/* Intro/Description - positioned below effect */}
      <div
        style={{
          position: "absolute",
          left: 67,
          top: 238,
          width: 188,
          height: 28,
          color: "rgb(91, 31, 27)",
          fontSize: 11,
          fontFamily: "SimSun, serif",
          lineHeight: 1.3,
          overflow: "hidden",
          textOverflow: "ellipsis",
        }}
      >
        {good.intro || "无简介"}
      </div>
    </div>
  );
};

// ============= Tooltip Manager State =============

export interface TooltipState {
  good: Good | null;
  isRecycle: boolean;
  position: { x: number; y: number };
  isVisible: boolean;
}

export const defaultTooltipState: TooltipState = {
  good: null,
  isRecycle: false,
  position: { x: 0, y: 0 },
  isVisible: false,
};
