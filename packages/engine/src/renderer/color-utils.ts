/**
 * 颜色工具函数
 *
 * 解析 CSS 颜色字符串为 RGBA float 数组，供 WebGL uniform 和 Canvas2D 使用。
 */

/** RGBA 颜色（0-1 浮点） */
export interface RGBAColor {
  r: number;
  g: number;
  b: number;
  a: number;
}

// 预编译正则（避免每次调用创建）
const RGBA_RE = /rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+))?\s*\)/;
const HEX_SHORT_RE = /^#([0-9a-f])([0-9a-f])([0-9a-f])$/i;
const HEX_RE = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})?$/i;

/**
 * 解析 CSS 颜色字符串为标准化 RGBA（0-1 浮点）
 *
 * 支持格式:
 * - `rgba(r, g, b, a)` / `rgb(r, g, b)`
 * - `#rgb` / `#rrggbb` / `#rrggbbaa`
 * - 常见命名色（white, black）
 */
export function parseColor(color: string): RGBAColor {
  // rgba / rgb
  const rgbaMatch = RGBA_RE.exec(color);
  if (rgbaMatch) {
    return {
      r: parseInt(rgbaMatch[1], 10) / 255,
      g: parseInt(rgbaMatch[2], 10) / 255,
      b: parseInt(rgbaMatch[3], 10) / 255,
      a: rgbaMatch[4] !== undefined ? parseFloat(rgbaMatch[4]) : 1,
    };
  }

  // #rrggbb / #rrggbbaa
  const hexMatch = HEX_RE.exec(color);
  if (hexMatch) {
    return {
      r: parseInt(hexMatch[1], 16) / 255,
      g: parseInt(hexMatch[2], 16) / 255,
      b: parseInt(hexMatch[3], 16) / 255,
      a: hexMatch[4] !== undefined ? parseInt(hexMatch[4], 16) / 255 : 1,
    };
  }

  // #rgb
  const hexShortMatch = HEX_SHORT_RE.exec(color);
  if (hexShortMatch) {
    return {
      r: parseInt(hexShortMatch[1] + hexShortMatch[1], 16) / 255,
      g: parseInt(hexShortMatch[2] + hexShortMatch[2], 16) / 255,
      b: parseInt(hexShortMatch[3] + hexShortMatch[3], 16) / 255,
      a: 1,
    };
  }

  // 命名色
  switch (color) {
    case "white":
      return { r: 1, g: 1, b: 1, a: 1 };
    case "black":
      return { r: 0, g: 0, b: 0, a: 1 };
    case "red":
      return { r: 1, g: 0, b: 0, a: 1 };
    case "green":
      return { r: 0, g: 1, b: 0, a: 1 };
    case "blue":
      return { r: 0, g: 0, b: 1, a: 1 };
    case "transparent":
      return { r: 0, g: 0, b: 0, a: 0 };
    default:
      // fallback 白色
      return { r: 1, g: 1, b: 1, a: 1 };
  }
}
