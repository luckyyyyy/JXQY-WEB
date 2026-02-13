/**
 * Avatar - 通用头像组件
 *
 * 支持图片头像和基于名字 hash 的渐变头像
 * 游戏风格：色彩鲜明的渐变 + 圆形设计
 */

interface AvatarProps {
  name: string;
  avatarUrl?: string | null;
  size?: number;
  className?: string;
}

/**
 * 基于字符串生成稳定的数字 hash
 */
function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0;
  }
  return Math.abs(hash);
}

/**
 * 游戏风格的渐变色对，更鲜艳亮眼
 */
const GRADIENT_PAIRS: readonly [string, string][] = [
  ["#FF6B6B", "#EE5A24"], // 火焰红
  ["#A29BFE", "#6C5CE7"], // 星空紫
  ["#55E6C1", "#1ABC9C"], // 翡翠绿
  ["#FF9FF3", "#F368E0"], // 樱花粉
  ["#48DBFB", "#0ABDE3"], // 冰霜蓝
  ["#FECA57", "#FF9F43"], // 黄金橙
  ["#00D2D3", "#01A3A4"], // 青玉色
  ["#FF6348", "#FF4757"], // 烈焰橙
  ["#7BED9F", "#2ED573"], // 翠竹绿
  ["#70A1FF", "#5352ED"], // 宝石蓝
  ["#DFE6E9", "#B2BEC3"], // 银白色
  ["#FD79A8", "#E84393"], // 玫瑰红
];

/**
 * 获取名字的首字母/首字
 */
function getInitials(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return "?";

  // 中文：取第一个字
  if (/[\u4e00-\u9fff]/.test(trimmed)) {
    return trimmed[0];
  }

  // 英文：取前两个单词首字母
  const parts = trimmed.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return parts[0].substring(0, 2).toUpperCase();
}

export function Avatar({ name, avatarUrl, size = 32, className = "" }: AvatarProps) {
  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt={name}
        width={size}
        height={size}
        className={`rounded-full object-cover ${className}`}
        style={{ width: size, height: size }}
      />
    );
  }

  const hash = hashString(name || "default");
  const [color1, color2] = GRADIENT_PAIRS[hash % GRADIENT_PAIRS.length];
  const initials = getInitials(name);
  const fontSize = size * 0.4;

  return (
    <div
      className={`rounded-full flex items-center justify-center select-none shrink-0 ${className}`}
      style={{
        width: size,
        height: size,
        background: `linear-gradient(135deg, ${color1}, ${color2})`,
        boxShadow: `0 2px ${Math.max(4, size / 8)}px ${color2}40`,
      }}
    >
      <span
        style={{
          fontSize,
          lineHeight: 1,
          fontWeight: 700,
          color: "white",
          textShadow: "0 1px 2px rgba(0,0,0,0.2)",
          letterSpacing: initials.length > 1 ? "-0.02em" : undefined,
        }}
      >
        {initials}
      </span>
    </div>
  );
}

export type { AvatarProps };
