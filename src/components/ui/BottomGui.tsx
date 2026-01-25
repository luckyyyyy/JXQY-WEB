/**
 * BottomGui Component - based on JxqyHD Engine/Gui/BottomGui.cs
 * Bottom hotbar for items and skills
 */
import React from "react";
import type { HotbarItem } from "../../engine/gui/types";
import type { UiSettings } from "../../engine/gui/uiConfig";

interface BottomGuiProps {
  config?: UiSettings["bottom"];
  items: (HotbarItem | null)[];
  screenWidth: number;
  screenHeight: number;
  onItemClick: (index: number) => void;
  onItemRightClick: (index: number) => void;
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    position: "absolute",
    bottom: 16,
    display: "flex",
    alignItems: "center",
    background: "linear-gradient(180deg, rgba(30, 50, 80, 0.9) 0%, rgba(15, 25, 45, 0.95) 100%)",
    border: "1px solid #4a6fa5",
    borderRadius: 8,
    padding: "8px 12px",
    gap: 4,
    pointerEvents: "auto",
  },
  section: {
    display: "flex",
    gap: 4,
  },
  separator: {
    width: 2,
    height: 48,
    background: "linear-gradient(180deg, transparent, #4a6fa5, transparent)",
    margin: "0 8px",
  },
  slot: {
    position: "relative" as const,
    width: 44,
    height: 52,
    background: "rgba(20, 35, 60, 0.8)",
    border: "1px solid #3a5a8a",
    borderRadius: 6,
    display: "flex",
    flexDirection: "column" as const,
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
    transition: "all 0.15s ease",
    overflow: "hidden",
  },
  slotHover: {
    background: "rgba(40, 70, 110, 0.9)",
    borderColor: "#5a8fbb",
    transform: "translateY(-2px)",
  },
  slotActive: {
    background: "rgba(60, 90, 140, 0.95)",
    borderColor: "#7ab0dd",
  },
  slotIcon: {
    fontSize: 22,
    color: "#ccc",
  },
  slotKey: {
    position: "absolute" as const,
    top: 2,
    left: 4,
    fontSize: 10,
    color: "#888",
    fontWeight: "bold",
  },
  slotCount: {
    position: "absolute" as const,
    bottom: 2,
    right: 4,
    fontSize: 10,
    color: "#fff",
    fontWeight: "bold",
    textShadow: "0 1px 2px rgba(0, 0, 0, 0.8)",
  },
  cooldownOverlay: {
    position: "absolute" as const,
    bottom: 0,
    left: 0,
    right: 0,
    background: "rgba(0, 0, 0, 0.7)",
    color: "#fff",
    fontSize: 10,
    textAlign: "center" as const,
    padding: 2,
  },
  emptySlot: {
    width: 24,
    height: 24,
    border: "1px dashed #3a5a8a",
    borderRadius: 4,
    opacity: 0.5,
  },
};

// 物品槽 1-3 是物品，4-8 是武功
const SLOT_KEYS = ["Z", "X", "C", "1", "2", "3", "4", "5"];
const SLOT_ICONS_ITEM = ["🧪", "💊", "📦"];
const SLOT_ICONS_SKILL = ["⚡", "🔥", "❄️", "💨", "☀️"];

export const BottomGui: React.FC<BottomGuiProps> = ({
  config: _config,
  items,
  screenWidth: _screenWidth,
  screenHeight: _screenHeight,
  onItemClick,
  onItemRightClick,
}) => {
  const [hoveredSlot, setHoveredSlot] = React.useState<number | null>(null);

  const handleContextMenu = (e: React.MouseEvent, index: number) => {
    e.preventDefault();
    onItemRightClick(index);
  };

  return (
    <div
      style={{
        ...styles.container,
        left: `calc(50% - 200px)`,
      }}
    >
      {/* 物品栏 (1-3) */}
      <div style={styles.section}>
        {[0, 1, 2].map((index) => {
          const item = items[index];
          const isHovered = hoveredSlot === index;

          return (
            <div
              key={index}
              style={{
                ...styles.slot,
                ...(isHovered ? styles.slotHover : {}),
              }}
              onMouseEnter={() => setHoveredSlot(index)}
              onMouseLeave={() => setHoveredSlot(null)}
              onClick={() => onItemClick(index)}
              onContextMenu={(e) => handleContextMenu(e, index)}
              title={item?.name || `物品槽 ${index + 1} (${SLOT_KEYS[index]})`}
            >
              <span style={styles.slotKey}>{SLOT_KEYS[index]}</span>
              {item ? (
                <>
                  <span style={styles.slotIcon}>{SLOT_ICONS_ITEM[index % 3]}</span>
                  {item.count !== undefined && item.count > 1 && (
                    <span style={styles.slotCount}>{item.count}</span>
                  )}
                  {item.cooldown > 0 && (
                    <div style={styles.cooldownOverlay}>
                      {Math.ceil(item.cooldown / 1000)}s
                    </div>
                  )}
                </>
              ) : (
                <div style={styles.emptySlot} />
              )}
            </div>
          );
        })}
      </div>

      <div style={styles.separator} />

      {/* 武功栏 (4-8) */}
      <div style={styles.section}>
        {[3, 4, 5, 6, 7].map((index) => {
          const item = items[index];
          const isHovered = hoveredSlot === index;

          return (
            <div
              key={index}
              style={{
                ...styles.slot,
                ...(isHovered ? styles.slotHover : {}),
              }}
              onMouseEnter={() => setHoveredSlot(index)}
              onMouseLeave={() => setHoveredSlot(null)}
              onClick={() => onItemClick(index)}
              onContextMenu={(e) => handleContextMenu(e, index)}
              title={item?.name || `武功槽 ${index - 2} (${SLOT_KEYS[index]})`}
            >
              <span style={styles.slotKey}>{SLOT_KEYS[index]}</span>
              {item ? (
                <>
                  <span style={styles.slotIcon}>{SLOT_ICONS_SKILL[(index - 3) % 5]}</span>
                  {item.cooldown > 0 && (
                    <div style={styles.cooldownOverlay}>
                      {Math.ceil(item.cooldown / 1000)}s
                    </div>
                  )}
                </>
              ) : (
                <div style={styles.emptySlot} />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
