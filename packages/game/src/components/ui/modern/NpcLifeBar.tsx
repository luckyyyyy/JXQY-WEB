/**
 * Modern NpcLifeBar - NPC血条
 * Props 与经典 NpcLifeBar 完全一致
 *
 * Reference: InfoDrawer.DrawLife(spriteBatch, Globals.OutEdgeNpc)
 * - Shows at top center of screen
 * - Color matches NPC outline color (see InteractionManager.EdgeColors):
 *   Enemy=Red, FighterFriend=Green, NoneFighter=Blue, NeutralFighter/默认=Yellow
 * - Name color based on NPC type: Boss enemies (ExpBonus > 0) get yellow color
 */

import type { Npc } from "@miu2d/engine/npc";
import type React from "react";
import { useMemo } from "react";
import { borderRadius, typography } from "./theme";

// Colors matching InfoDrawer.cs (adapted for modern style)
const LIFE_COLORS = {
  enemy: "rgba(163, 18, 21, 0.9)", // EnemyLifeColor
  friend: "rgba(16, 165, 28, 0.9)", // FriendLifeColor
  none: "rgba(40, 30, 245, 0.9)", // NoneLifeColor
  neutral: "rgba(220, 170, 0, 0.9)", // NeutralLifeColor - 与黄色描边一致
} as const;

const NAME_COLORS = {
  normal: "rgba(255, 255, 255, 0.9)",
  boss: "rgba(255, 200, 50, 0.95)", // Yellow for boss enemies
} as const;

// Default config
const DEFAULT_CONFIG = {
  width: 200,
  height: 18,
  topAdjust: 50,
} as const;

interface NpcLifeBarProps {
  /** The NPC to display life bar for (null = hide) */
  npc: Npc | null;
  /** Screen width for centering */
  screenWidth: number;
}

/**
 * Calculate life percentage safely
 */
function getLifePercent(npc: Npc): number {
  const lifeMax = npc.lifeMax;
  const life = npc.life;

  if (lifeMax <= 0) return 1;
  if (life < 0) return 0;

  const percent = life / lifeMax;
  return Math.min(1, Math.max(0, percent));
}

/**
 * Get life bar color based on NPC relation
 * 与 InteractionManager.setHoveredNpc 的描边色优先级一致：
 *   Enemy → Red, FighterFriend → Green, NoneFighter → Blue, 默认 → Yellow
 */
function getLifeColor(npc: Npc): string {
  if (npc.isEnemy) return LIFE_COLORS.enemy;
  if (npc.isFighterFriend) return LIFE_COLORS.friend;
  if (npc.isNoneFighter) return LIFE_COLORS.none;
  return LIFE_COLORS.neutral;
}

/**
 * Get name color based on NPC type
 */
function getNameColor(npc: Npc): string {
  // Boss enemies (ExpBonus > 0) get yellow color
  if (npc.isEnemy && npc.expBonus > 0) {
    return NAME_COLORS.boss;
  }
  return NAME_COLORS.normal;
}

export const NpcLifeBar: React.FC<NpcLifeBarProps> = ({ npc, screenWidth }) => {
  // 计算百分比和颜色
  const lifePercent = useMemo(() => {
    if (!npc) return 0;
    return getLifePercent(npc) * 100;
  }, [npc]);

  const lifeColor = useMemo(() => {
    if (!npc) return LIFE_COLORS.none;
    return getLifeColor(npc);
  }, [npc]);

  const nameColor = useMemo(() => {
    if (!npc) return NAME_COLORS.normal;
    return getNameColor(npc);
  }, [npc]);

  // 位置: 屏幕顶部中央（与经典 UI 一致）
  const containerStyle: React.CSSProperties = useMemo(
    () => ({
      position: "absolute",
      left: (screenWidth - DEFAULT_CONFIG.width) / 2,
      top: DEFAULT_CONFIG.topAdjust,
      width: DEFAULT_CONFIG.width,
      pointerEvents: "none",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      gap: 4,
    }),
    [screenWidth]
  );

  // 不显示：没有 NPC
  if (!npc) return null;

  return (
    <div style={containerStyle}>
      {/* NPC 名称 */}
      <div
        style={{
          fontSize: typography.fontSize.sm,
          fontWeight: typography.fontWeight.semibold,
          color: nameColor,
          textShadow: "0 1px 3px rgba(0,0,0,0.8)",
          whiteSpace: "nowrap",
        }}
      >
        {npc.name}
      </div>

      {/* 血条容器 */}
      <div
        style={{
          width: DEFAULT_CONFIG.width,
          height: DEFAULT_CONFIG.height,
          background: "rgba(0, 0, 0, 0.6)",
          borderRadius: borderRadius.sm,
          overflow: "hidden",
          border: "1px solid rgba(255, 255, 255, 0.2)",
          position: "relative",
        }}
      >
        {/* 血条填充 */}
        <div
          style={{
            width: `${lifePercent}%`,
            height: "100%",
            background: lifeColor,
            borderRadius: borderRadius.sm,
            transition: "width 0.2s ease",
          }}
        />
        {/* 血量数值 - 居中显示在血条上 */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: typography.fontSize.xs,
            fontWeight: typography.fontWeight.semibold,
            color: "white",
            textShadow: "0 1px 2px rgba(0,0,0,0.8)",
            pointerEvents: "none",
          }}
        >
          {Math.floor(npc.life)} / {Math.floor(npc.lifeMax)}
        </div>
      </div>
    </div>
  );
};
