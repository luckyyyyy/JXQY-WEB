/**
 * MagicTooltip Component - based on JxqyHD Engine/Gui/ToolTipGuiType1.cs ShowMagic method
 * Displays magic/skill information when hovering over magic slots
 *
 * Uses same background as ItemTooltip (tipbox.asf) but different layout:
 * - Background: tipbox.asf (same as goods)
 * - Magic Image: Left=132, Top=47, 60x75 (same position as goods)
 * - Name: Left=67, Top=191, Color=102,73,212,204 (purple)
 * - Level: Left=160, Top=191, Color=91,31,27,204 (dark red)
 * - Magic Intro: Left=67, Top=210, Color=52,21,14,204 (brown) - uses ToolTip_Type1_Item_Magic_Intro
 */

import type { MagicItemInfo } from "@miu2d/engine/magic";
import type React from "react";
import { useEffect, useState } from "react";
import { useAsfAnimation, useAsfImage } from "./hooks";

interface MagicTooltipProps {
  magicInfo: MagicItemInfo | null;
  position: { x: number; y: number };
  isVisible: boolean;
}

export const MagicTooltip: React.FC<MagicTooltipProps> = ({ magicInfo, position, isVisible }) => {
  // Load tooltip background - same tipbox.asf as ItemTooltip
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

  // Load magic image - 使用动态动画播放
  const magic = magicInfo?.magic;
  const magicImage = useAsfAnimation(magic?.image ?? null, true, true);

  if (!isVisible || !magicInfo) return null;

  // Use actual background size
  const tooltipWidth = bgSize.width;
  const tooltipHeight = bgSize.height;

  // Position tooltip to avoid going off screen
  // TopAdjust=27 from config
  const adjustedX = Math.min(position.x + 10, window.innerWidth - tooltipWidth - 20);
  const adjustedY = Math.min(position.y + 27, window.innerHeight - tooltipHeight - 20);

  // Build display data - matches ShowMagic method
  const name = magic?.name || "无名称";
  const level = `等级： ${magicInfo.level}`;
  const intro = magic?.intro || "无简介";

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

      {/* Magic Image - config: Left=132, Top=47, Width=60, Height=75 */}
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
        {magicImage.dataUrl ? (
          <img
            src={magicImage.dataUrl}
            alt={name}
            style={{
              maxWidth: 60,
              maxHeight: 75,
              imageRendering: "pixelated",
            }}
          />
        ) : (
          <span
            style={{
              fontSize: 16,
              fontWeight: "bold",
              color: "rgba(255,255,255,0.85)",
              textShadow: "0 1px 3px rgba(0,0,0,0.8)",
              textAlign: "center",
              letterSpacing: 1,
            }}
          >
            {name.slice(0, 2)}
          </span>
        )}
      </div>

      {/* Magic Name - config: Left=67, Top=191, Color=102,73,212,204 (purple) */}
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
        {name}
      </div>

      {/* Level - config: Left=160, Top=191, Color=91,31,27,204 (dark red) */}
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
        {level}
      </div>

      {/* Magic Intro - config [ToolTip_Type1_Item_Magic_Intro]:
          Left=67, Top=210, Width=196, Height=120, Color=52,21,14,204 (brown) */}
      <div
        style={{
          position: "absolute",
          left: 67,
          top: 210,
          width: 196,
          height: 120,
          color: "rgb(52, 21, 14)",
          fontSize: 12,
          fontFamily: "SimSun, serif",
          lineHeight: 1.3,
          overflow: "hidden",
          whiteSpace: "pre-wrap",
          wordBreak: "break-word",
        }}
      >
        {intro}
      </div>
    </div>
  );
};

// ============= Magic Tooltip Manager State =============

export interface MagicTooltipState {
  magicInfo: MagicItemInfo | null;
  position: { x: number; y: number };
  isVisible: boolean;
}

export const defaultMagicTooltipState: MagicTooltipState = {
  magicInfo: null,
  position: { x: 0, y: 0 },
  isVisible: false,
};
