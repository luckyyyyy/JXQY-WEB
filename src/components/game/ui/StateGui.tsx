/**
 * StateGui Component - based on JxqyHD Engine/Gui/StateGui.cs
 * Displays player status information (level, exp, stats)
 *
 * C# Reference: StateGui.cs shows level, exp, life, thew, mana, attack, defend, evade
 * Resources loaded from UI_Settings.ini
 */
import type React from "react";
import { useMemo } from "react";
import { useAsfImage } from "./hooks";
import { useStateGuiConfig } from "./useUISettings";

export interface PlayerStats {
  level: number;
  exp: number;
  levelUpExp: number;
  life: number;
  lifeMax: number;
  thew: number;
  thewMax: number;
  mana: number;
  manaMax: number;
  manaLimit?: boolean; // 内力限制标志
  attack: number;
  attack2?: number;
  attack3?: number;
  defend: number;
  defend2?: number;
  defend3?: number;
  evade: number;
}

interface StateGuiProps {
  isVisible: boolean;
  stats: PlayerStats;
  screenWidth: number;
  onClose: () => void;
}

export const StateGui: React.FC<StateGuiProps> = ({ isVisible, stats, screenWidth }) => {
  // 从 UI_Settings.ini 加载配置
  const config = useStateGuiConfig();

  // 加载面板背景
  const panelImage = useAsfImage(config?.panel.image || "asf/ui/common/panel5.asf");

  // 计算面板位置 - C#: Globals.WindowWidth / 2f - Width + leftAdjust
  const panelStyle = useMemo(() => {
    if (!config) return null;
    const panelWidth = panelImage.width || 172;
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

  // 格式化攻击力显示
  const attackText = useMemo(() => {
    let text = stats.attack.toString();
    if (stats.attack2 || stats.attack3) {
      text += `(${stats.attack2 || 0})(${stats.attack3 || 0})`;
    }
    return text;
  }, [stats.attack, stats.attack2, stats.attack3]);

  // 格式化防御力显示
  const defendText = useMemo(() => {
    let text = stats.defend.toString();
    if (stats.defend2 || stats.defend3) {
      text += `(${stats.defend2 || 0})(${stats.defend3 || 0})`;
    }
    return text;
  }, [stats.defend, stats.defend2, stats.defend3]);

  // 格式化内力显示
  const manaText = stats.manaLimit ? "1/1" : `${stats.mana}/${stats.manaMax}`;

  if (!isVisible || !config || !panelStyle) return null;

  // 文本样式生成器
  const getTextStyle = (textConfig: {
    left: number;
    top: number;
    width: number;
    height: number;
    color: string;
  }): React.CSSProperties => ({
    position: "absolute",
    left: textConfig.left,
    top: textConfig.top,
    width: textConfig.width,
    fontSize: 12,
    fontFamily: "SimSun, serif",
    color: textConfig.color,
    textAlign: "left",
  });

  return (
    <div style={panelStyle} onClick={(e) => e.stopPropagation()}>
      {/* 背景面板 */}
      {panelImage.dataUrl && (
        <img
          src={panelImage.dataUrl}
          alt="状态面板"
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

      {/* 等级 */}
      <div style={getTextStyle(config.level)}>{stats.level}</div>

      {/* 经验 */}
      <div style={getTextStyle(config.exp)}>{stats.exp}</div>

      {/* 升级经验 */}
      <div style={getTextStyle(config.levelUp)}>{stats.levelUpExp}</div>

      {/* 生命 */}
      <div style={getTextStyle(config.life)}>
        {stats.life}/{stats.lifeMax}
      </div>

      {/* 体力 */}
      <div style={getTextStyle(config.thew)}>
        {stats.thew}/{stats.thewMax}
      </div>

      {/* 内力 */}
      <div style={getTextStyle(config.mana)}>{manaText}</div>

      {/* 攻击 */}
      <div style={getTextStyle(config.attack)}>{attackText}</div>

      {/* 防御 */}
      <div style={getTextStyle(config.defend)}>{defendText}</div>

      {/* 身法 */}
      <div style={getTextStyle(config.evade)}>{stats.evade}</div>
    </div>
  );
};
