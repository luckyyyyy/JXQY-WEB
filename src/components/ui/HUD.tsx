/**
 * HUD Component - displays health, mana, hotbar, etc.
 */
import React from "react";
import type { HudState } from "../../engine/gui/types";

interface HUDProps {
  state: HudState;
  playerName: string;
  money: number;
  onHotbarClick?: (index: number) => void;
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    pointerEvents: "none",
  },
  // Top-left: Character status
  statusPanel: {
    position: "absolute",
    top: 16,
    left: 16,
    background: "linear-gradient(180deg, rgba(20, 30, 50, 0.9) 0%, rgba(10, 15, 30, 0.95) 100%)",
    border: "1px solid #4a6fa5",
    borderRadius: 8,
    padding: 12,
    minWidth: 180,
    pointerEvents: "auto",
  },
  playerName: {
    color: "#ffd700",
    fontSize: 14,
    fontWeight: "bold",
    marginBottom: 8,
    textShadow: "0 1px 2px rgba(0, 0, 0, 0.5)",
  },
  barContainer: {
    marginBottom: 6,
  },
  barLabel: {
    display: "flex",
    justifyContent: "space-between",
    marginBottom: 2,
  },
  barName: {
    color: "#aaa",
    fontSize: 11,
  },
  barValue: {
    color: "#fff",
    fontSize: 11,
  },
  barTrack: {
    height: 12,
    background: "rgba(0, 0, 0, 0.5)",
    borderRadius: 6,
    overflow: "hidden",
    border: "1px solid rgba(255, 255, 255, 0.1)",
  },
  barFill: {
    height: "100%",
    borderRadius: 5,
    transition: "width 0.3s ease",
  },
  lifeBar: {
    background: "linear-gradient(180deg, #e74c3c 0%, #c0392b 100%)",
  },
  manaBar: {
    background: "linear-gradient(180deg, #3498db 0%, #2980b9 100%)",
  },
  thewBar: {
    background: "linear-gradient(180deg, #2ecc71 0%, #27ae60 100%)",
  },

  // Bottom: Hotbar
  hotbarPanel: {
    position: "absolute",
    bottom: 16,
    left: "50%",
    transform: "translateX(-50%)",
    display: "flex",
    gap: 4,
    background: "linear-gradient(180deg, rgba(20, 30, 50, 0.85) 0%, rgba(10, 15, 30, 0.9) 100%)",
    border: "1px solid #4a6fa5",
    borderRadius: 8,
    padding: 8,
    pointerEvents: "auto",
  },
  hotbarSlot: {
    width: 48,
    height: 48,
    background: "rgba(30, 50, 80, 0.6)",
    border: "1px solid #3a5a8a",
    borderRadius: 6,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    position: "relative" as const,
    cursor: "pointer",
    transition: "all 0.2s ease",
  },
  hotbarSlotHover: {
    background: "rgba(50, 80, 120, 0.8)",
    borderColor: "#5a7fbb",
  },
  hotbarKey: {
    position: "absolute" as const,
    top: 2,
    left: 4,
    fontSize: 10,
    color: "#888",
  },
  hotbarIcon: {
    fontSize: 20,
  },
  hotbarCount: {
    position: "absolute" as const,
    bottom: 2,
    right: 4,
    fontSize: 10,
    color: "#fff",
    textShadow: "0 1px 2px rgba(0, 0, 0, 0.8)",
  },

  // Top-right: Money
  moneyPanel: {
    position: "absolute",
    top: 16,
    right: 16,
    background: "linear-gradient(180deg, rgba(20, 30, 50, 0.9) 0%, rgba(10, 15, 30, 0.95) 100%)",
    border: "1px solid #4a6fa5",
    borderRadius: 8,
    padding: "8px 16px",
    display: "flex",
    alignItems: "center",
    gap: 8,
    pointerEvents: "auto",
  },
  moneyIcon: {
    fontSize: 18,
  },
  moneyValue: {
    color: "#ffd700",
    fontSize: 14,
    fontWeight: "bold",
  },

  // Message display
  messageContainer: {
    position: "absolute",
    top: "20%",
    left: "50%",
    transform: "translateX(-50%)",
    maxWidth: 400,
    textAlign: "center" as const,
  },
  message: {
    background: "rgba(0, 0, 0, 0.8)",
    color: "#fff",
    padding: "12px 24px",
    borderRadius: 8,
    fontSize: 16,
    animation: "fadeIn 0.3s ease",
  },
};

// Hotbar key labels
const HOTBAR_KEYS = ["1", "2", "3", "4", "5", "6", "7", "8"];

export const HUD: React.FC<HUDProps> = ({ state, playerName, money, onHotbarClick }) => {
  const renderProgressBar = (
    name: string,
    value: number,
    max: number,
    barStyle: React.CSSProperties
  ) => {
    const percent = max > 0 ? (value / max) * 100 : 0;
    return (
      <div style={styles.barContainer}>
        <div style={styles.barLabel}>
          <span style={styles.barName}>{name}</span>
          <span style={styles.barValue}>
            {value}/{max}
          </span>
        </div>
        <div style={styles.barTrack}>
          <div
            style={{
              ...styles.barFill,
              ...barStyle,
              width: `${percent}%`,
            }}
          />
        </div>
      </div>
    );
  };

  return (
    <div style={styles.container}>
      {/* Status Panel */}
      <div style={styles.statusPanel}>
        <div style={styles.playerName}>{playerName}</div>
        {renderProgressBar("生命", state.life, state.lifeMax, styles.lifeBar)}
        {renderProgressBar("真气", state.mana, state.manaMax, styles.manaBar)}
        {renderProgressBar("体力", state.thew, state.thewMax, styles.thewBar)}
      </div>

      {/* Money Panel */}
      <div style={styles.moneyPanel}>
        <span style={styles.moneyIcon}>💰</span>
        <span style={styles.moneyValue}>{money.toLocaleString()}</span>
      </div>

      {/* Hotbar */}
      <div style={styles.hotbarPanel}>
        {state.hotbarItems.map((item, index) => (
          <div
            key={index}
            style={styles.hotbarSlot}
            onClick={() => onHotbarClick?.(index)}
          >
            <span style={styles.hotbarKey}>{HOTBAR_KEYS[index]}</span>
            {item ? (
              <>
                <span style={styles.hotbarIcon}>
                  {item.type === "skill" ? "⚡" : "🧪"}
                </span>
                {item.count !== undefined && item.count > 1 && (
                  <span style={styles.hotbarCount}>{item.count}</span>
                )}
              </>
            ) : null}
          </div>
        ))}
      </div>

      {/* Message Display */}
      {state.messageVisible && (
        <div style={styles.messageContainer}>
          <div style={styles.message}>{state.messageText}</div>
        </div>
      )}

      <style>
        {`
          @keyframes fadeIn {
            from { opacity: 0; transform: translateY(-10px); }
            to { opacity: 1; transform: translateY(0); }
          }
        `}
      </style>
    </div>
  );
};
