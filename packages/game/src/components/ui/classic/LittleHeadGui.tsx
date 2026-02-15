/**
 * LittleHeadGui Component - based on JxqyHD Engine/Gui/LittleHeadGui.cs
 * Displays partner (follower) portraits in the top-left corner
 *
 * - Shows portraits from asf/ui/littlehead/{name}.asf
 * - Clicking opens NPC equipment interface (if CanEquip > 0)
 * - Shows level text if CanLevelUp > 0
 * - Position: x=5, y=5 (hardcoded)
 * - Width/Height: from ASF texture (item.BaseTexture.Width/Height)
 */
import type React from "react";
import { useCallback } from "react";
import { useAsfImage } from "./hooks";

/** 队友信息接口 */
export interface PartnerInfo {
  name: string;
  level: number;
  canLevelUp: boolean;
  canEquip: boolean;
}

interface LittleHeadGuiProps {
  /** 队友列表 */
  partners: PartnerInfo[];
  /** 点击队友头像回调 */
  onPartnerClick?: (index: number, partner: PartnerInfo) => void;
}

/**
 * 单个队友头像项
 * item.Width = item.BaseTexture.Width; item.Height = item.BaseTexture.Height;
 */
interface PartnerHeadItemProps {
  partner: PartnerInfo;
  onClick?: () => void;
}

const PartnerHeadItem: React.FC<PartnerHeadItemProps> = ({ partner, onClick }) => {
  // 加载队友头像 ASF : Utils.GetAsf(@"asf\ui\littlehead\", name + ".asf")
  const portraitPath = `asf/ui/littlehead/${partner.name}.asf`;
  const portrait = useAsfImage(portraitPath, 0);

  const handleClick = useCallback(() => {
    if (partner.canEquip && onClick) {
      onClick();
    }
  }, [partner.canEquip, onClick]);

  // 如果没有头像资源或正在加载，不显示
  if (!portrait.dataUrl || portrait.width === 0 || portrait.height === 0) {
    return null;
  }

  return (
    <div
      style={{
        position: "relative",
        marginLeft: 5, // const int x = 5
        width: portrait.width,
        height: portrait.height,
        cursor: partner.canEquip ? "pointer" : "default",
        userSelect: "none",
      }}
      onClick={handleClick}
      title={partner.canEquip ? `${partner.name} - 点击打开装备` : partner.name}
    >
      {/* 头像图片 */}
      <img
        src={portrait.dataUrl}
        alt={partner.name}
        width={portrait.width}
        height={portrait.height}
        style={{
          display: "block",
          imageRendering: "pixelated",
        }}
        draggable={false}
      />
      {/* 等级文字 (如果 CanLevelUp > 0) */}
      {/* text.Position = new Vector2(item.Width + 3, item.Height - FontSize7.MeasureString("LV").Y) */}
      {partner.canLevelUp && (
        <span
          style={{
            position: "absolute",
            left: portrait.width + 3,
            bottom: 0,
            color: "white",
            fontSize: "10px",
            fontFamily: "monospace",
            textShadow: "1px 1px 1px black, -1px -1px 1px black",
            whiteSpace: "nowrap",
          }}
        >
          LV{partner.level}
        </span>
      )}
    </div>
  );
};

/**
 * LittleHeadGui - 队友头像列表
 * 显示在屏幕左上角
 * const int x = 5; var y = 5;
 */
export const LittleHeadGui: React.FC<LittleHeadGuiProps> = ({ partners, onPartnerClick }) => {
  if (partners.length === 0) {
    return null;
  }

  // const int x = 5; var y = 5; y += item.Height + 2;
  // 使用 flex 布局自动处理垂直排列，gap=2 对应spacing
  return (
    <div
      style={{
        position: "absolute",
        left: 0,
        top: 5, // var y = 5
        display: "flex",
        flexDirection: "column",
        gap: 2, // y += item.Height + 2
        pointerEvents: "auto",
        zIndex: 10,
      }}
    >
      {partners.map((partner, index) => (
        <PartnerHeadItem
          key={partner.name}
          partner={partner}
          onClick={() => onPartnerClick?.(index, partner)}
        />
      ))}
    </div>
  );
};
