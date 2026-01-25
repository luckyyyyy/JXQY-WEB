/**
 * TopGui Component - based on JxqyHD Engine/Gui/TopGui.cs
 * Top button bar for accessing game panels
 */
import React from "react";
import type { UiSettings } from "../../engine/gui/uiConfig";

interface TopGuiProps {
  config?: UiSettings["top"];
  screenWidth: number;
  onStateClick: () => void;
  onEquipClick: () => void;
  onXiuLianClick: () => void;
  onGoodsClick: () => void;
  onMagicClick: () => void;
  onMemoClick: () => void;
  onSystemClick: () => void;
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    position: "absolute",
    top: 0,
    display: "flex",
    alignItems: "center",
    background: "linear-gradient(180deg, rgba(40, 60, 90, 0.95) 0%, rgba(20, 30, 50, 0.9) 100%)",
    border: "1px solid #4a6fa5",
    borderTop: "none",
    borderRadius: "0 0 8px 8px",
    padding: "4px 8px",
    gap: 6,
    pointerEvents: "auto",
  },
  button: {
    width: 28,
    height: 28,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "rgba(30, 50, 80, 0.8)",
    border: "1px solid #3a5a8a",
    borderRadius: 4,
    cursor: "pointer",
    fontSize: 14,
    color: "#aaa",
    transition: "all 0.15s ease",
  },
  buttonHover: {
    background: "rgba(60, 100, 150, 0.9)",
    borderColor: "#5a8fbb",
    color: "#fff",
  },
  buttonActive: {
    background: "rgba(80, 120, 180, 0.95)",
    borderColor: "#6aa0cc",
    color: "#ffd700",
  },
};

const BUTTONS = [
  { id: "state", icon: "📊", title: "状态 (T)", action: "onStateClick" },
  { id: "equip", icon: "⚔️", title: "装备 (E)", action: "onEquipClick" },
  { id: "xiulian", icon: "🧘", title: "修炼", action: "onXiuLianClick" },
  { id: "goods", icon: "🎒", title: "物品 (I)", action: "onGoodsClick" },
  { id: "magic", icon: "✨", title: "武功 (M)", action: "onMagicClick" },
  { id: "memo", icon: "📜", title: "任务", action: "onMemoClick" },
  { id: "system", icon: "⚙️", title: "系统 (ESC)", action: "onSystemClick" },
] as const;

export const TopGui: React.FC<TopGuiProps> = ({
  config: _config,
  screenWidth: _screenWidth,
  onStateClick,
  onEquipClick,
  onXiuLianClick,
  onGoodsClick,
  onMagicClick,
  onMemoClick,
  onSystemClick,
}) => {
  const [hoveredButton, setHoveredButton] = React.useState<string | null>(null);

  const handlers: Record<string, () => void> = {
    onStateClick,
    onEquipClick,
    onXiuLianClick,
    onGoodsClick,
    onMagicClick,
    onMemoClick,
    onSystemClick,
  };

  return (
    <div
      style={{
        ...styles.container,
        left: `calc(50% - 110px)`,
      }}
    >
      {BUTTONS.map((btn) => (
        <div
          key={btn.id}
          style={{
            ...styles.button,
            ...(hoveredButton === btn.id ? styles.buttonHover : {}),
          }}
          title={btn.title}
          onMouseEnter={() => setHoveredButton(btn.id)}
          onMouseLeave={() => setHoveredButton(null)}
          onClick={handlers[btn.action]}
        >
          {btn.icon}
        </div>
      ))}
    </div>
  );
};
