/**
 * Game Font Configuration - based on JxqyHD font settings
 *
 * C# Reference: Globals.cs defines FontSize7, FontSize10, FontSize12
 * The original game uses "迷你简细圆" (Mini Simplified Chinese Thin Round) font
 *
 * For Web, we use Google Fonts with similar style:
 * - ZCOOL KuaiLe (站酷快乐体) - 圆润风格，适合游戏对话
 * - Noto Sans SC - 现代简洁，作为备用
 * - Ma Shan Zheng (马善政毛笔楷书) - 用于标题
 */

// 游戏字体配置
// 本地加载字体，不使用在线服务
export const GAME_FONTS = {
  // 主要中文字体 - 用于对话、UI等
  // Ma Shan Zheng (马善政楷书) - 毛笔楷书风格
  primary: '"Ma Shan Zheng", "STKaiti", "楷体", "KaiTi", "SimKai", serif',

  // 主字体的权重 - 稍微加粗
  primaryWeight: 500,

  // 标题字体 - 用于游戏标题、章节名等
  // 马善政楷书 - 毛笔楷书风格
  title: '"Ma Shan Zheng", "STKaiti", "楷体", "KaiTi", serif',

  // 系统字体 - 用于数字、英文等 (原版使用 Verdana 7号加粗)
  system: '"Verdana", "Arial", sans-serif',

  // 等宽字体 - 用于数值显示
  monospace: '"Consolas", "Monaco", monospace',
};

// 字体大小配置 - 对应 C# 中的 FontSize7, FontSize10, FontSize12
export const FONT_SIZES = {
  tiny: 10, // FontSize7 的替代（Web需要稍大）
  small: 12, // FontSize10
  normal: 14, // FontSize12
  large: 16,
  xlarge: 18,
  title: 24,
  heading: 32,
};

// 对话框字体样式
export const DIALOG_FONT_STYLE: React.CSSProperties = {
  fontFamily: GAME_FONTS.primary,
  fontSize: FONT_SIZES.normal,
  fontWeight: GAME_FONTS.primaryWeight,
  lineHeight: 1.6,
  letterSpacing: 0.5, // 稍微增加字距
};

// 对话文本样式 (别名)
export const DIALOG_TEXT_STYLE: React.CSSProperties = {
  fontFamily: GAME_FONTS.primary,
  fontSize: FONT_SIZES.normal,
  fontWeight: GAME_FONTS.primaryWeight,
  lineHeight: 1.6,
  letterSpacing: 0.5,
  color: "rgba(0, 0, 0, 0.9)",
};

// 对话框说话者名称样式
export const DIALOG_NAME_STYLE: React.CSSProperties = {
  fontFamily: GAME_FONTS.primary,
  fontSize: FONT_SIZES.normal,
  fontWeight: 500, // 名称稍粗一点
  color: "#8B4513",
  textShadow: "0 1px 1px rgba(255,255,255,0.5)",
};

// 对话选项样式
export const DIALOG_SELECTION_STYLE: React.CSSProperties = {
  fontFamily: GAME_FONTS.primary,
  fontSize: FONT_SIZES.normal,
  fontWeight: GAME_FONTS.primaryWeight,
  color: "rgba(0, 0, 255, 0.8)",
  cursor: "pointer",
};

// 菜单字体样式
export const MENU_FONT_STYLE: React.CSSProperties = {
  fontFamily: GAME_FONTS.title,
  fontSize: FONT_SIZES.large,
  letterSpacing: 2,
};

// 标题字体样式
export const TITLE_FONT_STYLE: React.CSSProperties = {
  fontFamily: GAME_FONTS.title,
  fontSize: 72,
  fontWeight: "bold",
  letterSpacing: 8,
};

// 数值显示字体样式
export const VALUE_FONT_STYLE: React.CSSProperties = {
  fontFamily: GAME_FONTS.monospace,
  fontSize: FONT_SIZES.small,
  fontWeight: "bold",
};

// CSS 字体导入 - 可以在 index.css 中使用
export const FONT_CSS = `
/* 游戏字体配置 */
@font-face {
  font-family: 'GameFont';
  src: local('华文细黑'), local('STXihei'), local('微软雅黑'), local('Microsoft YaHei');
  font-display: swap;
}

/* 标题字体 */
@font-face {
  font-family: 'TitleFont';
  src: local('楷体'), local('KaiTi'), local('STKaiti'), local('华文楷体');
  font-display: swap;
}

/* 游戏UI通用样式 */
.game-text {
  font-family: ${GAME_FONTS.primary};
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

.game-title {
  font-family: ${GAME_FONTS.title};
  -webkit-font-smoothing: antialiased;
}

.game-value {
  font-family: ${GAME_FONTS.monospace};
}
`;
