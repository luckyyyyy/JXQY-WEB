/**
 * Modern UI Theme - 毛玻璃效果现代UI主题配置
 */

// 主题色彩
export const modernColors = {
  // 基础色
  primary: "rgba(102, 73, 212, 0.9)", // 主色调 - 紫色
  secondary: "rgba(64, 158, 255, 0.9)", // 次要色 - 蓝色
  accent: "rgba(255, 193, 7, 0.9)", // 强调色 - 金色
  success: "rgba(67, 207, 124, 0.9)", // 成功色 - 绿色
  warning: "rgba(255, 152, 0, 0.9)", // 警告色 - 橙色
  danger: "rgba(245, 108, 108, 0.9)", // 危险色 - 红色

  // 文本色
  text: {
    primary: "rgba(255, 255, 255, 0.95)",
    secondary: "rgba(255, 255, 255, 0.7)",
    muted: "rgba(255, 255, 255, 0.5)",
    inverse: "rgba(0, 0, 0, 0.85)",
  },

  // 背景色 - 提高透明度
  bg: {
    glass: "rgba(20, 25, 40, 0.55)", // 毛玻璃背景 (0.75→0.55)
    glassDark: "rgba(10, 15, 25, 0.65)", // 深色毛玻璃 (0.85→0.65)
    glassLight: "rgba(40, 50, 70, 0.45)", // 浅色毛玻璃 (0.65→0.45)
    overlay: "rgba(0, 0, 0, 0.5)", // 遮罩层 (0.6→0.5)
    hover: "rgba(255, 255, 255, 0.08)", // 悬停背景
    active: "rgba(255, 255, 255, 0.12)", // 激活背景
  },

  // 边框色
  border: {
    glass: "rgba(255, 255, 255, 0.12)",
    glassLight: "rgba(255, 255, 255, 0.2)",
    glow: "rgba(102, 73, 212, 0.5)",
  },

  // 属性颜色
  stats: {
    life: "rgba(220, 80, 80, 0.9)", // 生命 - 红
    hp: "rgba(220, 80, 80, 0.9)", // 生命别名
    mana: "rgba(80, 140, 220, 0.9)", // 内力 - 蓝
    mp: "rgba(80, 140, 220, 0.9)", // 内力别名
    thew: "rgba(80, 200, 120, 0.9)", // 体力 - 绿
    attack: "rgba(255, 120, 50, 0.9)", // 攻击 - 橙
    defend: "rgba(120, 180, 255, 0.9)", // 防御 - 浅蓝
    evade: "rgba(180, 130, 255, 0.9)", // 身法 - 紫
    exp: "rgba(255, 215, 0, 0.9)", // 经验 - 金
  },
} as const;

// 毛玻璃效果
export const glassEffect = {
  // 标准毛玻璃
  standard: {
    background: modernColors.bg.glass,
    backdropFilter: "blur(16px) saturate(180%)",
    WebkitBackdropFilter: "blur(16px) saturate(180%)",
    border: `1px solid ${modernColors.border.glass}`,
    boxShadow: "0 8px 32px rgba(0, 0, 0, 0.25)",
  },

  // 深色毛玻璃
  dark: {
    background: modernColors.bg.glassDark,
    backdropFilter: "blur(20px) saturate(150%)",
    WebkitBackdropFilter: "blur(20px) saturate(150%)",
    border: `1px solid ${modernColors.border.glass}`,
    boxShadow: "0 8px 32px rgba(0, 0, 0, 0.3)",
  },

  // 浅色毛玻璃
  light: {
    background: modernColors.bg.glassLight,
    backdropFilter: "blur(12px) saturate(200%)",
    WebkitBackdropFilter: "blur(12px) saturate(200%)",
    border: `1px solid ${modernColors.border.glassLight}`,
    boxShadow: "0 4px 16px rgba(0, 0, 0, 0.15)",
  },

  // 带发光效果
  glow: {
    background: modernColors.bg.glass,
    backdropFilter: "blur(12px) saturate(180%)",
    WebkitBackdropFilter: "blur(12px) saturate(180%)",
    border: `1px solid ${modernColors.border.glow}`,
    boxShadow: `0 8px 32px rgba(0, 0, 0, 0.3), 0 0 20px ${modernColors.border.glow}`,
  },
} as const;

// 间距
export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

// 圆角
export const borderRadius = {
  sm: 4,
  md: 8,
  lg: 12,
  xl: 16,
  round: "50%",
} as const;

// 字体
export const typography = {
  fontFamily: "'Microsoft YaHei', 'PingFang SC', -apple-system, sans-serif",
  fontSize: {
    xs: 10,
    sm: 12,
    md: 14,
    lg: 16,
    xl: 18,
    xxl: 24,
    title: 20,
  },
  fontWeight: {
    normal: 400,
    medium: 500,
    semibold: 600,
    bold: 700,
  },
  lineHeight: {
    tight: 1.2,
    normal: 1.5,
    relaxed: 1.75,
  },
} as const;

// 动画
export const transitions = {
  fast: "0.15s ease",
  normal: "0.25s ease",
  slow: "0.35s ease",
  spring: "0.3s cubic-bezier(0.34, 1.56, 0.64, 1)",
} as const;

// 阴影
export const shadows = {
  sm: "0 2px 8px rgba(0, 0, 0, 0.15)",
  md: "0 4px 16px rgba(0, 0, 0, 0.2)",
  lg: "0 8px 32px rgba(0, 0, 0, 0.25)",
  xl: "0 12px 48px rgba(0, 0, 0, 0.3)",
  glow: (color: string) => `0 0 20px ${color}`,
  inner: "inset 0 2px 4px rgba(0, 0, 0, 0.2)",
} as const;

// Z-Index 层级
export const zIndex = {
  base: 0,
  panel: 100,
  dialog: 200,
  tooltip: 300,
  overlay: 400,
  modal: 500,
  notification: 600,
} as const;

// 导出默认主题对象
export const modernTheme = {
  colors: modernColors,
  glass: glassEffect,
  spacing,
  borderRadius,
  typography,
  transitions,
  shadows,
  zIndex,
} as const;

export type ModernTheme = typeof modernTheme;
