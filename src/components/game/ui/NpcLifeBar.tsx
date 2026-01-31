/**
 * NpcLifeBar Component - based on JxqyHD Engine/InfoDrawer.cs
 * Displays hovered NPC's life bar at the top center of the screen
 *
 * C# Reference: InfoDrawer.DrawLife(spriteBatch, Globals.OutEdgeNpc)
 * - Shows at top center of screen
 * - Color based on relation: Enemy=Red, Friend=Green, None=Blue
 * - Name color based on NPC type: Boss enemies (ExpBonus > 0) get yellow color
 * - Reads config from [NpcInfoShow] section in UI_Settings.ini
 *
 * Features:
 * 1. 从 UI_Settings.ini 加载配置 (width, height, leftAdjust, topAdjust)
 * 2. NPC 名字颜色区分: 普通敌人白色，Boss敌人（ExpBonus > 0）黄色
 * 3. 实时更新，与游戏帧同步
 */
import type React from "react";
import type { Npc } from "@/engine/character/npc";
import { useNpcInfoShowConfig } from "./useUISettings";

// Colors matching C# InfoDrawer.cs
const LIFE_COLORS = {
  enemy: "rgba(163, 18, 21, 0.9)", // C#: EnemyLifeColor = new Color(163, 18, 21) * 0.9f
  friend: "rgba(16, 165, 28, 0.9)", // C#: FriendLifeColor = new Color(16, 165, 28) * 0.9f
  none: "rgba(40, 30, 245, 0.9)", // C#: NoneLifeColor = new Color(40, 30, 245) * 0.9f
  lose: "rgba(0, 0, 0, 0.7)", // C#: LifeLoseColor = Color.Black * 0.7f
} as const;

const NAME_COLORS = {
  normal: "rgba(255, 255, 255, 0.8)", // C#: NameColor = Color.White * 0.8f
  boss: "rgba(200, 200, 10, 0.9)", // C#: EnemyBossNameColor = new Color(200, 200, 10) * 0.9f
} as const;

// Default config (matches UI_Settings.ini [NpcInfoShow] defaults)
const DEFAULT_CONFIG = {
  width: 300,
  height: 25,
  leftAdjust: 0,
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

  // C#: if (npc.LifeMax <= 0) percent = 1f
  if (lifeMax <= 0) return 1;
  // C#: if (npc.Life < 0) implied percent = 0
  if (life < 0) return 0;

  const percent = life / lifeMax;
  // C#: if (percent > 1f) percent = 1f
  return Math.min(1, Math.max(0, percent));
}

/**
 * Get life bar color based on NPC relation
 * C# Reference: InfoDrawer.DrawLife()
 */
function getLifeColor(npc: Npc): string {
  // C#: if (npc.IsEnemy) drawColor = EnemyLifeColor
  if (npc.isEnemy) return LIFE_COLORS.enemy;
  // C#: else if (npc.IsFighterFriend) drawColor = FriendLifeColor
  if (npc.isFighterFriend) return LIFE_COLORS.friend;
  // C#: else if (npc.IsNoneFighter) drawColor = NoneLifeColor
  if (npc.isNoneFighter) return LIFE_COLORS.none;
  // C#: else return (don't draw)
  return LIFE_COLORS.none;
}

/**
 * Get name color based on NPC type
 * C# Reference: InfoDrawer.DrawLife() - Boss enemies have special color
 */
function getNameColor(npc: Npc): string {
  // C#: if (npc.ExpBonus > 0) nameColor = EnemyBossNameColor
  if (npc.isEnemy && npc.expBonus > 0) {
    return NAME_COLORS.boss;
  }
  return NAME_COLORS.normal;
}

/**
 * Check if NPC should show life bar
 * C# Reference: Only fighters show life bars
 */
function shouldShowLifeBar(npc: Npc | null): boolean {
  if (!npc) return false;
  // C#: Only show for fighters (enemies, fighter friends, or non-fighters with combat)
  return npc.isEnemy || npc.isFighterFriend || npc.isNoneFighter;
}

export const NpcLifeBar: React.FC<NpcLifeBarProps> = ({ npc, screenWidth }) => {
  // Load config from UI_Settings.ini [NpcInfoShow]
  const config = useNpcInfoShowConfig();

  // Use loaded config or fallback to defaults
  const width = config?.width ?? DEFAULT_CONFIG.width;
  const height = config?.height ?? DEFAULT_CONFIG.height;
  const leftAdjust = config?.leftAdjust ?? DEFAULT_CONFIG.leftAdjust;
  const topAdjust = config?.topAdjust ?? DEFAULT_CONFIG.topAdjust;

  // Don't render if no NPC or NPC should not show life bar
  if (!shouldShowLifeBar(npc)) return null;

  // Calculate life bar position and size
  // C#: var topLeftX = Globals.WindowWidth / 2 - width / 2 + leftAdjust
  const topLeftX = screenWidth / 2 - width / 2 + leftAdjust;
  // C#: int topLeftY = 0 + topAdjust
  const topLeftY = topAdjust;

  // Calculate life percentage and bar length
  const lifePercent = getLifePercent(npc!);
  // C#: var lifeLength = (int)(width * percent)
  const lifeLength = Math.floor(width * lifePercent);

  // Get colors
  const lifeColor = getLifeColor(npc!);
  const nameColor = getNameColor(npc!);

  return (
    <div
      style={{
        position: "absolute",
        left: topLeftX,
        top: topLeftY,
        width: width,
        height: height,
        zIndex: 1001,
        pointerEvents: "none",
      }}
    >
      {/* Life bar background (lost health) - C#: lifeLoseRegion */}
      <div
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          width: width,
          height: height,
          backgroundColor: LIFE_COLORS.lose,
        }}
      />
      {/* Life bar foreground (current health) - C#: lifeRegion */}
      <div
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          width: lifeLength,
          height: height,
          backgroundColor: lifeColor,
          transition: "width 0.1s ease-out", // Smooth animation for health changes
        }}
      />
      {/* NPC Name - C#: spriteBatch.DrawString(Globals.FontSize12, npc.Name, namePosition, nameColor) */}
      {npc?.name && (
        <div
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            width: width,
            height: height,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: nameColor,
            fontSize: "12px",
            fontFamily: "'Noto Serif SC', 'SimSun', serif",
            fontWeight: "bold",
            textShadow: "1px 1px 2px rgba(0,0,0,0.8), -1px -1px 2px rgba(0,0,0,0.5)",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {npc.name}
        </div>
      )}
    </div>
  );
};

export default NpcLifeBar;
