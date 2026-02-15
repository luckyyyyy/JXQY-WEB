/**
 * Modern StatePanel - 武侠风格状态面板
 * 使用毛玻璃效果 + 武侠配色
 */
import type React from "react";
import { useMemo } from "react";
import { useAsfImage } from "../classic/hooks";
import type { PlayerStats } from "../classic/StateGui";
import { borderRadius, glassEffect, modernColors, spacing, transitions, typography } from "./theme";

interface StatePanelProps {
  isVisible: boolean;
  stats: PlayerStats;
  playerIndex?: number;
  screenWidth: number;
  onClose: () => void;
  playerName?: string;
}

// 武侠风格配色（与theme.ts结合使用）
const wuxiaAccent = {
  gold: "#D4AF37",
  goldBright: "#FFD700",
  goldDark: "#8B7355",
  crimson: modernColors.stats.life,
  jade: modernColors.stats.thew,
  azure: modernColors.stats.mana,
};

// 属性图标 (使用SVG)
const StatIcon: React.FC<{ type: string; size?: number }> = ({ type, size = 16 }) => {
  const iconPaths: Record<string, { path: string; color: string }> = {
    life: {
      path: "M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z",
      color: modernColors.stats.life,
    },
    thew: { path: "M13 2L3 14h9l-1 8 10-12h-9l1-8z", color: modernColors.stats.thew },
    mana: {
      path: "M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z",
      color: modernColors.stats.mana,
    },
    attack: {
      path: "M6.92 5H5L14 14l4.88-4.88-2.12-2.12L14 9.76 10.24 6l2.76-2.76L10.88 1.12 6.92 5zM16.5 15L15 16.5l4 4L20.5 19l-4-4z",
      color: modernColors.stats.attack,
    },
    defend: {
      path: "M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm0 10.99h7c-.53 4.12-3.28 7.79-7 8.94V12H5V6.3l7-3.11v8.8z",
      color: modernColors.stats.defend,
    },
    evade: {
      path: "M13.49 5.48c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm-3.6 13.9l1-4.4 2.1 2v6h2v-7.5l-2.1-2 .6-3c1.3 1.5 3.3 2.5 5.5 2.5v-2c-1.9 0-3.5-1-4.3-2.4l-1-1.6c-.4-.6-1-1-1.7-1-.3 0-.5.1-.8.1l-5.2 2.2v4.7h2v-3.4l1.8-.7-1.6 8.1-4.9-1-.4 2 7 1.4z",
      color: modernColors.stats.evade,
    },
  };
  const icon = iconPaths[type];
  if (!icon) return null;

  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={icon.color}>
      <path d={icon.path} />
    </svg>
  );
};

// 属性进度条组件
const StatBar: React.FC<{
  label: string;
  type: string;
  current: number;
  max: number;
  color: string;
  showValues?: boolean;
}> = ({ label, type, current, max, color, showValues = true }) => {
  const percent = max > 0 ? Math.min((current / max) * 100, 100) : 0;

  return (
    <div style={{ marginBottom: spacing.sm }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: spacing.xs,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: spacing.sm }}>
          <StatIcon type={type} size={16} />
          <span
            style={{
              fontSize: typography.fontSize.sm,
              color: modernColors.text.secondary,
              fontWeight: typography.fontWeight.medium,
            }}
          >
            {label}
          </span>
        </div>
        {showValues && (
          <span
            style={{
              fontSize: typography.fontSize.sm,
              color: modernColors.text.primary,
              fontFamily: "monospace",
            }}
          >
            {current}/{max}
          </span>
        )}
      </div>
      <div
        style={{
          width: "100%",
          height: 8,
          background: modernColors.bg.glassDark,
          borderRadius: borderRadius.sm,
          overflow: "hidden",
          boxShadow: "inset 0 1px 2px rgba(0,0,0,0.3)",
        }}
      >
        <div
          style={{
            width: `${percent}%`,
            height: "100%",
            background: color,
            borderRadius: borderRadius.sm,
            boxShadow: `0 0 8px ${color}`,
            transition: transitions.normal,
          }}
        />
      </div>
    </div>
  );
};

// 战斗属性行
const CombatStat: React.FC<{
  label: string;
  type: string;
  value: string | number;
  bonus?: string;
}> = ({ label, type, value, bonus }) => (
  <div
    style={{
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      padding: `${spacing.sm}px 0`,
      borderBottom: `1px solid ${modernColors.border.glass}`,
    }}
  >
    <div style={{ display: "flex", alignItems: "center", gap: spacing.sm }}>
      <StatIcon type={type} size={18} />
      <span
        style={{
          fontSize: typography.fontSize.sm,
          color: modernColors.text.secondary,
        }}
      >
        {label}
      </span>
    </div>
    <div style={{ display: "flex", alignItems: "baseline", gap: spacing.xs }}>
      <span
        style={{
          fontSize: typography.fontSize.md,
          fontWeight: typography.fontWeight.semibold,
          color: modernColors.text.primary,
          fontFamily: "monospace",
        }}
      >
        {value}
      </span>
      {bonus && (
        <span
          style={{
            fontSize: typography.fontSize.xs,
            color: modernColors.stats.thew,
          }}
        >
          {bonus}
        </span>
      )}
    </div>
  </div>
);

// 关闭按钮
const CloseBtn: React.FC<{ onClick: () => void }> = ({ onClick }) => (
  <button
    onClick={onClick}
    style={{
      position: "absolute",
      top: spacing.sm,
      right: spacing.sm,
      width: 28,
      height: 28,
      background: modernColors.bg.hover,
      border: `1px solid ${modernColors.border.glass}`,
      borderRadius: borderRadius.round,
      color: modernColors.text.secondary,
      fontSize: typography.fontSize.md,
      cursor: "pointer",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      transition: transitions.fast,
    }}
    onMouseEnter={(e) => {
      e.currentTarget.style.background = "rgba(255,100,100,0.3)";
      e.currentTarget.style.color = modernColors.text.primary;
    }}
    onMouseLeave={(e) => {
      e.currentTarget.style.background = modernColors.bg.hover;
      e.currentTarget.style.color = modernColors.text.secondary;
    }}
  >
    ✕
  </button>
);

/**
 * 根据角色名称获取头像路径
 */
function getPortraitPath(playerName: string): string {
  if (!playerName) return "";
  return `asf/ui/littlehead/${playerName}.asf`;
}

export const StatePanel: React.FC<StatePanelProps> = ({
  isVisible,
  stats,
  screenWidth,
  onClose,
  playerName = "主角",
}) => {
  const panelWidth = 260;

  const panelStyle: React.CSSProperties = useMemo(
    () => ({
      position: "absolute",
      left: 20,
      top: 60,
      width: panelWidth,
      pointerEvents: "auto",
      // 毛玻璃效果（使用theme变量）
      ...glassEffect.standard,
      borderRadius: borderRadius.xl,
      // 金色边框装饰
      border: `1px solid ${wuxiaAccent.goldDark}66`,
      boxShadow: `
        0 8px 32px rgba(0, 0, 0, 0.4),
        inset 0 1px 0 rgba(255,255,255,0.1),
        0 0 40px rgba(212,175,55,0.08)
      `,
    }),
    []
  );

  // 经验进度
  const expPercent = stats.levelUpExp > 0 ? (stats.exp / stats.levelUpExp) * 100 : 0;

  // 格式化攻击力
  const attackBonus = (stats.attack2 || 0) + (stats.attack3 || 0);
  const attackText = stats.attack.toString();
  const attackBonusText = attackBonus > 0 ? `+${attackBonus}` : undefined;

  // 格式化防御力
  const defendBonus = (stats.defend2 || 0) + (stats.defend3 || 0);
  const defendText = stats.defend.toString();
  const defendBonusText = defendBonus > 0 ? `+${defendBonus}` : undefined;

  // 加载角色头像
  const portraitPath = useMemo(() => getPortraitPath(playerName), [playerName]);
  const portraitImage = useAsfImage(portraitPath, 0);

  if (!isVisible) return null;

  return (
    <div style={panelStyle} onClick={(e) => e.stopPropagation()}>
      {/* 装饰性顶部边框 */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: 2,
          background: `linear-gradient(90deg, transparent, ${wuxiaAccent.gold}88, transparent)`,
          borderRadius: `${borderRadius.xl}px ${borderRadius.xl}px 0 0`,
        }}
      />

      <CloseBtn onClick={onClose} />

      {/* 角色信息区 */}
      <div
        style={{
          padding: spacing.lg,
          background: modernColors.bg.hover,
          borderBottom: `1px solid ${modernColors.border.glass}`,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: spacing.md }}>
          {/* 头像框 - 八角形设计 */}
          <div
            style={{
              width: 70,
              height: 70,
              position: "relative",
              flexShrink: 0,
            }}
          >
            {/* 外框装饰 */}
            <div
              style={{
                position: "absolute",
                inset: -3,
                background: `linear-gradient(135deg, ${wuxiaAccent.gold}, ${wuxiaAccent.goldDark})`,
                clipPath:
                  "polygon(30% 0%, 70% 0%, 100% 30%, 100% 70%, 70% 100%, 30% 100%, 0% 70%, 0% 30%)",
              }}
            />
            {/* 头像容器 */}
            <div
              style={{
                position: "absolute",
                inset: 0,
                background: modernColors.bg.glassDark,
                clipPath:
                  "polygon(30% 0%, 70% 0%, 100% 30%, 100% 70%, 70% 100%, 30% 100%, 0% 70%, 0% 30%)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                overflow: "hidden",
              }}
            >
              {portraitImage.dataUrl ? (
                <img
                  src={portraitImage.dataUrl}
                  alt={playerName}
                  style={{
                    width: "100%",
                    height: "100%",
                    objectFit: "cover",
                    imageRendering: "pixelated",
                  }}
                />
              ) : (
                <span style={{ fontSize: 28, color: wuxiaAccent.goldDark }}>侠</span>
              )}
            </div>
          </div>

          {/* 名称和等级 */}
          <div style={{ flex: 1 }}>
            <div
              style={{
                fontSize: typography.fontSize.lg,
                fontWeight: typography.fontWeight.bold,
                color: modernColors.text.primary,
                textShadow: "0 2px 4px rgba(0,0,0,0.5)",
                marginBottom: spacing.xs,
              }}
            >
              {playerName}
            </div>
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: spacing.xs,
                padding: `${spacing.xs}px ${spacing.sm}px`,
                background: `linear-gradient(90deg, ${wuxiaAccent.gold}20, transparent)`,
                borderLeft: `2px solid ${wuxiaAccent.gold}`,
              }}
            >
              <span
                style={{
                  fontSize: typography.fontSize.sm,
                  color: modernColors.text.secondary,
                }}
              >
                等级
              </span>
              <span
                style={{
                  fontSize: typography.fontSize.xxl,
                  fontWeight: typography.fontWeight.bold,
                  color: modernColors.accent,
                  fontFamily: "Georgia, serif",
                  textShadow: `0 0 10px ${wuxiaAccent.gold}66`,
                }}
              >
                {stats.level}
              </span>
            </div>
          </div>
        </div>

        {/* 经验条 */}
        <div style={{ marginTop: spacing.md }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: spacing.xs,
            }}
          >
            <span style={{ fontSize: typography.fontSize.xs, color: modernColors.text.secondary }}>
              修为进度
            </span>
            <span
              style={{
                fontSize: typography.fontSize.xs,
                color: modernColors.stats.exp,
                fontFamily: "monospace",
              }}
            >
              {stats.exp} / {stats.levelUpExp}
            </span>
          </div>
          <div
            style={{
              width: "100%",
              height: 8,
              background: modernColors.bg.glassDark,
              borderRadius: borderRadius.sm,
              overflow: "hidden",
              border: `1px solid ${modernColors.border.glass}`,
            }}
          >
            <div
              style={{
                width: `${expPercent}%`,
                height: "100%",
                background: `linear-gradient(90deg, ${wuxiaAccent.goldDark}, ${wuxiaAccent.gold})`,
                borderRadius: borderRadius.sm,
                boxShadow: `0 0 12px ${wuxiaAccent.gold}66`,
                transition: transitions.normal,
              }}
            />
          </div>
        </div>
      </div>

      {/* 三维属性 */}
      <div style={{ padding: `${spacing.md}px ${spacing.lg}px` }}>
        <div
          style={{
            fontSize: typography.fontSize.sm,
            color: modernColors.text.secondary,
            marginBottom: spacing.sm,
            display: "flex",
            alignItems: "center",
            gap: spacing.sm,
          }}
        >
          <span
            style={{
              width: 16,
              height: 1,
              background: `linear-gradient(90deg, ${wuxiaAccent.gold}, transparent)`,
            }}
          />
          三维属性
          <span
            style={{
              flex: 1,
              height: 1,
              background: `linear-gradient(90deg, transparent, ${modernColors.border.glass})`,
            }}
          />
        </div>

        <StatBar
          label="生命"
          type="life"
          current={stats.life}
          max={stats.lifeMax}
          color={modernColors.stats.life}
        />
        <StatBar
          label="体力"
          type="thew"
          current={stats.thew}
          max={stats.thewMax}
          color={modernColors.stats.thew}
        />
        <StatBar
          label="内力"
          type="mana"
          current={stats.manaLimit ? 1 : stats.mana}
          max={stats.manaLimit ? 1 : stats.manaMax}
          color={modernColors.stats.mana}
        />
      </div>

      {/* 战斗属性 */}
      <div style={{ padding: `0 ${spacing.lg}px ${spacing.lg}px` }}>
        <div
          style={{
            fontSize: typography.fontSize.sm,
            color: modernColors.text.secondary,
            marginBottom: spacing.sm,
            display: "flex",
            alignItems: "center",
            gap: spacing.sm,
          }}
        >
          <span
            style={{
              width: 16,
              height: 1,
              background: `linear-gradient(90deg, ${wuxiaAccent.gold}, transparent)`,
            }}
          />
          战斗属性
          <span
            style={{
              flex: 1,
              height: 1,
              background: `linear-gradient(90deg, transparent, ${modernColors.border.glass})`,
            }}
          />
        </div>

        <div
          style={{
            background: modernColors.bg.glassDark,
            borderRadius: borderRadius.md,
            padding: `${spacing.xs}px ${spacing.md}px`,
            border: `1px solid ${modernColors.border.glass}`,
          }}
        >
          <CombatStat label="攻击" type="attack" value={attackText} bonus={attackBonusText} />
          <CombatStat label="防御" type="defend" value={defendText} bonus={defendBonusText} />
          <CombatStat label="身法" type="evade" value={stats.evade} />
        </div>
      </div>

      {/* 底部装饰 */}
      <div
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          height: 2,
          background: `linear-gradient(90deg, transparent, ${wuxiaAccent.goldDark}, transparent)`,
        }}
      />
    </div>
  );
};
