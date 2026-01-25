/**
 * BottomStateGui Component - based on JxqyHD Engine/Gui/BottomGui.cs
 * Shows life, thew (stamina), and mana orbs/bars
 */
import React from "react";
import type { UiSettings } from "../../engine/gui/uiConfig";

interface BottomStateGuiProps {
  config?: UiSettings["bottom"];
  life: number;
  maxLife: number;
  thew: number;
  maxThew: number;
  mana: number;
  maxMana: number;
  screenWidth: number;
  screenHeight: number;
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    position: "absolute",
    bottom: 16,
    display: "flex",
    alignItems: "flex-end",
    gap: 12,
    pointerEvents: "none",
  },
  orbContainer: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 4,
  },
  orb: {
    position: "relative",
    width: 64,
    height: 64,
    borderRadius: "50%",
    overflow: "hidden",
    background: "rgba(20, 25, 35, 0.9)",
    border: "2px solid #555",
    boxShadow: "inset 0 2px 8px rgba(0, 0, 0, 0.6), 0 2px 6px rgba(0, 0, 0, 0.4)",
  },
  orbFill: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    transition: "height 0.3s ease",
  },
  orbGlow: {
    position: "absolute",
    top: "15%",
    left: "20%",
    width: "30%",
    height: "20%",
    borderRadius: "50%",
    background: "rgba(255, 255, 255, 0.3)",
    filter: "blur(3px)",
  },
  orbValue: {
    position: "absolute",
    bottom: 4,
    left: 0,
    right: 0,
    textAlign: "center",
    fontSize: 11,
    fontWeight: "bold",
    color: "#fff",
    textShadow: "0 1px 3px rgba(0, 0, 0, 0.8)",
  },
  label: {
    fontSize: 12,
    fontWeight: "bold",
    color: "#ccc",
    textShadow: "0 1px 2px rgba(0, 0, 0, 0.8)",
  },
  thewBar: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 4,
  },
  thewBarOuter: {
    width: 24,
    height: 48,
    background: "rgba(20, 25, 35, 0.9)",
    border: "2px solid #555",
    borderRadius: 12,
    overflow: "hidden",
    display: "flex",
    flexDirection: "column-reverse",
    boxShadow: "inset 0 2px 6px rgba(0, 0, 0, 0.6)",
  },
  thewBarFill: {
    width: "100%",
    background: "linear-gradient(180deg, #ffe066 0%, #ffaa00 50%, #cc8800 100%)",
    transition: "height 0.3s ease",
    boxShadow: "inset 0 2px 4px rgba(255, 255, 255, 0.3)",
  },
};

export const BottomStateGui: React.FC<BottomStateGuiProps> = ({
  config: _config,
  life,
  maxLife,
  thew,
  maxThew,
  mana,
  maxMana,
  screenWidth: _screenWidth,
  screenHeight: _screenHeight,
}) => {
  const lifePercent = maxLife > 0 ? Math.min(100, Math.max(0, (life / maxLife) * 100)) : 0;
  const thewPercent = maxThew > 0 ? Math.min(100, Math.max(0, (thew / maxThew) * 100)) : 0;
  const manaPercent = maxMana > 0 ? Math.min(100, Math.max(0, (mana / maxMana) * 100)) : 0;

  // Get life orb color based on percentage
  const getLifeColor = () => {
    if (lifePercent > 50) {
      return "linear-gradient(180deg, #ff6666 0%, #cc3333 50%, #992222 100%)";
    } else if (lifePercent > 25) {
      return "linear-gradient(180deg, #ff8866 0%, #cc5533 50%, #993322 100%)";
    }
    return "linear-gradient(180deg, #ff4444 0%, #aa2222 50%, #771111 100%)";
  };

  const getManaColor = () => {
    return "linear-gradient(180deg, #6699ff 0%, #3366cc 50%, #224499 100%)";
  };

  return (
    <div
      style={{
        ...styles.container,
        left: 16,
      }}
    >
      {/* 生命球 (Life Orb) */}
      <div style={styles.orbContainer}>
        <div style={styles.orb}>
          <div
            style={{
              ...styles.orbFill,
              height: `${lifePercent}%`,
              background: getLifeColor(),
            }}
          />
          <div style={styles.orbGlow} />
          <span style={styles.orbValue}>
            {Math.floor(life)}/{Math.floor(maxLife)}
          </span>
        </div>
        <span style={styles.label}>生命</span>
      </div>

      {/* 体力条 (Thew Bar) */}
      <div style={styles.thewBar}>
        <div style={styles.thewBarOuter}>
          <div
            style={{
              ...styles.thewBarFill,
              height: `${thewPercent}%`,
            }}
          />
        </div>
        <span style={styles.label}>体</span>
      </div>

      {/* 法力球 (Mana Orb) */}
      <div style={styles.orbContainer}>
        <div style={styles.orb}>
          <div
            style={{
              ...styles.orbFill,
              height: `${manaPercent}%`,
              background: getManaColor(),
            }}
          />
          <div style={styles.orbGlow} />
          <span style={styles.orbValue}>
            {Math.floor(mana)}/{Math.floor(maxMana)}
          </span>
        </div>
        <span style={styles.label}>法力</span>
      </div>
    </div>
  );
};
