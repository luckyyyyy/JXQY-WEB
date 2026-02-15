/**
 * 武侠风格主题 - 供所有 Modern UI 面板使用
 */
import type React from "react";

// 武侠风格配色
export const wuxiaColors = {
  // 主色调
  gold: "#D4AF37",
  goldBright: "#FFD700",
  goldDark: "#8B7355",
  crimson: "#DC143C",
  jade: "#00A86B",
  azure: "#007FFF",
  purple: "#9370DB",
  orange: "#FF6347",

  // 背景色
  ink: "#1a1a2e",
  inkLight: "#2d2d44",
  inkDark: "#12121f",

  // 文本色
  textLight: "rgba(255, 255, 255, 0.9)",
  textDim: "rgba(255, 255, 255, 0.6)",
  textGold: "#F0E68C",
} as const;

// 武侠风格面板基础样式
export const wuxiaPanelStyle = {
  background: `linear-gradient(135deg, ${wuxiaColors.ink} 0%, ${wuxiaColors.inkLight} 100%)`,
  borderRadius: 16,
  border: `2px solid ${wuxiaColors.goldDark}`,
  boxShadow: `
    0 0 20px rgba(0,0,0,0.5),
    inset 0 1px 0 rgba(255,255,255,0.1),
    0 0 40px rgba(212,175,55,0.1)
  `,
  overflow: "hidden" as const,
} as const;

// 顶部装饰边框样式
export const wuxiaTopBorder: React.CSSProperties = {
  position: "absolute",
  top: 0,
  left: 0,
  right: 0,
  height: 3,
  background: `linear-gradient(90deg, transparent, ${wuxiaColors.gold}, transparent)`,
};

// 底部装饰边框样式
export const wuxiaBottomBorder: React.CSSProperties = {
  position: "absolute",
  bottom: 0,
  left: 0,
  right: 0,
  height: 2,
  background: `linear-gradient(90deg, transparent, ${wuxiaColors.goldDark}, transparent)`,
};

// 分类标题样式
export const wuxiaSectionTitle = (_title: string): React.CSSProperties => ({
  fontSize: 12,
  color: wuxiaColors.textDim,
  marginBottom: 10,
  display: "flex",
  alignItems: "center",
  gap: 6,
});

// 关闭按钮组件样式
export const wuxiaCloseButtonStyle: React.CSSProperties = {
  position: "absolute",
  top: 10,
  right: 10,
  width: 28,
  height: 28,
  background: "rgba(255,255,255,0.1)",
  border: "1px solid rgba(255,255,255,0.2)",
  borderRadius: "50%",
  color: wuxiaColors.textDim,
  fontSize: 14,
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  transition: "all 0.2s ease",
};
