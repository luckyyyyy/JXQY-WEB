/**
 * Landing Page 主题色配置
 *
 * 统一管理所有主题相关的颜色，方便后续调整
 */

export const theme = {
  // 主色调 - 橙色渐变
  primary: {
    gradient: "from-orange-500 via-amber-500 to-yellow-500",
    gradientHover: "from-orange-600 via-amber-600 to-yellow-600",
    text: "text-orange-500",
    textDark: "dark:text-orange-400",
    bg: "bg-orange-500",
    border: "border-orange-500",
  },

  // 发光效果 - 橙色
  glow: {
    gradient: "from-orange-500 via-amber-500 to-yellow-500",
    border: "bg-gradient-to-r from-orange-500 via-amber-500 to-yellow-400",
    shadow: "shadow-orange-500/25",
    shadowHover: "shadow-orange-500/40",
  },

  // 按钮样式
  button: {
    primary:
      "bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-lg shadow-orange-500/25 hover:shadow-orange-500/40",
    secondary:
      "bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-white border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-200 dark:hover:bg-zinc-700",
  },

  // 选中状态
  active: {
    text: "text-orange-600 dark:text-orange-400",
  },

  // Loading spinner
  spinner: {
    border: "border-orange-500 border-t-transparent",
  },
} as const;

// CSS 变量形式（可用于 style 属性）
export const cssVars = {
  primaryColor: "rgb(249, 115, 22)", // orange-500
  primaryColorLight: "rgb(251, 146, 60)", // orange-400
  primaryColorDark: "rgb(234, 88, 12)", // orange-600
  accentColor: "rgb(245, 158, 11)", // amber-500
  glowColor: "rgba(249, 115, 22, 0.6)",
} as const;
