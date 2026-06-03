/**
 * Modern Tooltips - 物品/武功提示框
 * 智能定位，避免遮挡
 */

import type { UIGoodData, UIMagicData } from "@miu2d/engine/gui/ui-types";
import type React from "react";
import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { HiOutlineArchiveBox, HiOutlineCurrencyYen } from "react-icons/hi2";
import { useGameUIContext } from "../../../contexts";
import { useAsfImage } from "../classic/hooks";
import { Divider, ProgressBar, StatRow } from "./components";
import { borderRadius, glassEffect, iconStyle, modernColors, spacing, typography } from "./theme";

/**
 * 计算 Tooltip 位置
 * 基于鼠标位置，参考老UI的实现方式
 * 确保不超出屏幕边界
 */
function calculateTooltipPosition(
  mouseX: number,
  mouseY: number,
  tooltipWidth: number,
  tooltipHeight: number,
  screenWidth: number,
  screenHeight: number
): { x: number; y: number } {
  const margin = 10;
  const offsetX = 15; // 鼠标右侧偏移
  const offsetY = 20; // 鼠标下方偏移

  // 默认在鼠标右下方
  let x = mouseX + offsetX;
  let y = mouseY + offsetY;

  // 超出右边界则放到鼠标左侧
  if (x + tooltipWidth > screenWidth - margin) {
    x = mouseX - tooltipWidth - offsetX;
  }

  // 超出下边界则向上调整
  if (y + tooltipHeight > screenHeight - margin) {
    y = screenHeight - tooltipHeight - margin;
  }

  // 确保不超出左边界和上边界
  x = Math.max(margin, x);
  y = Math.max(margin, y);

  return { x, y };
}

interface ItemTooltipProps {
  isVisible: boolean;
  good: UIGoodData | null;
  shopPrice?: number;
  position: { x: number; y: number };
}

export const ItemTooltip: React.FC<ItemTooltipProps> = ({
  isVisible,
  good,
  shopPrice,
  position,
}) => {
  const { screenWidth, screenHeight } = useGameUIContext();
  const iconImage = useAsfImage(good?.imagePath ?? null, 0);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const [tooltipSize, setTooltipSize] = useState({ width: 0, height: 0 });

  // 测量实际尺寸
  useLayoutEffect(() => {
    if (tooltipRef.current && isVisible && good) {
      const rect = tooltipRef.current.getBoundingClientRect();
      setTooltipSize({ width: rect.width, height: rect.height });
    }
  }, [isVisible, good]);

  // 计算位置（基于鼠标位置）
  const tooltipPosition = useMemo(() => {
    return calculateTooltipPosition(
      position.x,
      position.y,
      tooltipSize.width || 220,
      tooltipSize.height || 200,
      screenWidth,
      screenHeight
    );
  }, [position, tooltipSize, screenWidth, screenHeight]);

  const tooltipStyle: React.CSSProperties = useMemo(
    () => ({
      position: "fixed",
      left: tooltipPosition.x,
      top: tooltipPosition.y,
      width: 300,
      ...glassEffect.dark,
      borderRadius: borderRadius.lg,
      pointerEvents: "none",
      zIndex: 1000,
      padding: spacing.md,
    }),
    [tooltipPosition]
  );

  if (!isVisible || !good) return null;

  return (
    <div ref={tooltipRef} style={tooltipStyle}>
      {/* 头部 */}
      <div
        style={{ display: "flex", alignItems: "center", gap: spacing.md, marginBottom: spacing.sm }}
      >
        {/* 图标 */}
        <div
          style={{
            width: 48,
            height: 48,
            background: "rgba(0, 0, 0, 0.4)",
            borderRadius: borderRadius.md,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          {iconImage.dataUrl ? (
            <img
              src={iconImage.dataUrl}
              alt={good.name}
              style={{ maxWidth: 40, maxHeight: 40, imageRendering: "pixelated" }}
            />
          ) : (
            <HiOutlineArchiveBox style={{ ...iconStyle, fontSize: 24 }} />
          )}
        </div>

        {/* 名称和类型 */}
        <div>
          <div
            style={{
              fontSize: typography.fontSize.md,
              fontWeight: typography.fontWeight.semibold,
              color: getItemColor(good),
            }}
          >
            {good.name}
          </div>
          <div style={{ fontSize: typography.fontSize.xs, color: modernColors.text.muted }}>
            {getItemTypeLabel(good.kind, good.part)}
          </div>
        </div>
      </div>

      <Divider />

      {/* 属性 */}
      <div style={{ marginTop: spacing.sm }}>
        {good.getEffectEntries().map((e) => {
          const color =
            e.key === "life" || e.key === "lifeMax"
              ? modernColors.stats.hp
              : e.key === "mana" || e.key === "manaMax"
                ? modernColors.stats.mp
                : e.key === "thew" || e.key === "thewMax"
                  ? modernColors.stats.thew
                  : undefined;
          const valueText = e.value > 0 ? `+${e.value}` : `${e.value}`;
          return <StatRow key={e.key} label={e.label} value={valueText} color={color} />;
        })}
      </div>

      {/* 描述 */}
      {good.intro && (
        <>
          <Divider />
          <div
            style={{
              marginTop: spacing.sm,
              fontSize: typography.fontSize.xs,
              color: modernColors.text.secondary,
              lineHeight: 1.5,
            }}
          >
            {good.intro}
          </div>
        </>
      )}

      {/* 价格 */}
      {(shopPrice != null ? shopPrice > 0 : good.cost > 0) && (
        <div
          style={{
            marginTop: spacing.sm,
            fontSize: typography.fontSize.xs,
            color: modernColors.accent,
            textAlign: "right",
          }}
        >
          <HiOutlineCurrencyYen style={iconStyle} /> {shopPrice != null ? shopPrice : good.cost}
        </div>
      )}
    </div>
  );
};

interface MagicTooltipProps {
  isVisible: boolean;
  magic: UIMagicData | null;
  position: { x: number; y: number };
}

export const MagicTooltip: React.FC<MagicTooltipProps> = ({ isVisible, magic, position }) => {
  const { screenWidth, screenHeight } = useGameUIContext();
  const iconImage = useAsfImage(magic?.imagePath ?? magic?.iconPath ?? null, 0);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const [tooltipSize, setTooltipSize] = useState({ width: 0, height: 0 });

  // 测量实际尺寸
  useLayoutEffect(() => {
    if (tooltipRef.current && isVisible && magic) {
      const rect = tooltipRef.current.getBoundingClientRect();
      setTooltipSize({ width: rect.width, height: rect.height });
    }
  }, [isVisible, magic]);

  // 计算位置
  const tooltipPosition = useMemo(() => {
    return calculateTooltipPosition(
      position.x,
      position.y,
      tooltipSize.width || 260,
      tooltipSize.height || 200,
      screenWidth,
      screenHeight
    );
  }, [position, tooltipSize, screenWidth, screenHeight]);

  const tooltipStyle: React.CSSProperties = useMemo(
    () => ({
      position: "fixed",
      left: tooltipPosition.x,
      top: tooltipPosition.y,
      minWidth: 200,
      maxWidth: 320,
      ...glassEffect.dark,
      borderRadius: borderRadius.lg,
      pointerEvents: "none",
      zIndex: 1000,
      padding: spacing.md,
    }),
    [tooltipPosition]
  );

  if (!isVisible || !magic) return null;

  return (
    <div ref={tooltipRef} style={tooltipStyle}>
      {/* 头部 */}
      <div
        style={{ display: "flex", alignItems: "center", gap: spacing.md, marginBottom: spacing.sm }}
      >
        <div
          style={{
            width: 48,
            height: 48,
            background: "rgba(0, 0, 0, 0.4)",
            borderRadius: borderRadius.md,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          {iconImage.dataUrl ? (
            <img
              src={iconImage.dataUrl}
              alt={magic.name}
              style={{ maxWidth: 40, maxHeight: 40, imageRendering: "pixelated" }}
            />
          ) : (
            <span
              style={{
                fontSize: 14,
                fontWeight: 700,
                color: "rgba(255,255,255,0.7)",
                textShadow: "0 1px 2px rgba(0,0,0,0.5)",
                textAlign: "center",
                lineHeight: 1.1,
              }}
            >
              {magic.name.slice(0, 2)}
            </span>
          )}
        </div>

        <div>
          <div
            style={{
              fontSize: typography.fontSize.md,
              fontWeight: typography.fontWeight.semibold,
              color: modernColors.primary,
            }}
          >
            {magic.name}
          </div>
          <div style={{ fontSize: typography.fontSize.xs, color: modernColors.text.muted }}>
            {magic.levelUpExp > 0
              ? `第 ${magic.level} / ${magic.maxLevel} 层`
              : `第 ${magic.level} 层（不可升级）`}
          </div>
        </div>
      </div>

      {/* 经验进度 */}
      {magic.levelUpExp > 0 && (
        <div style={{ marginBottom: spacing.sm }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
            <span style={{ fontSize: typography.fontSize.xs, color: modernColors.text.secondary }}>
              修炼进度
            </span>
            <span style={{ fontSize: typography.fontSize.xs, color: modernColors.text.muted }}>
              {magic.currentLevelExp} / {magic.levelUpExp}
            </span>
          </div>
          <ProgressBar
            value={magic.currentLevelExp}
            max={magic.levelUpExp}
            color="linear-gradient(90deg, #9B59B6, #4A90D9)"
            height={6}
            showText={false}
          />
        </div>
      )}

      <Divider />

      {/* 属性 */}
      <div style={{ marginTop: spacing.sm }}>
        <StatRow label="内力消耗" value={magic.manaCost.toString()} color={modernColors.stats.mp} />
      </div>

      {/* 描述 */}
      {magic.intro && (
        <>
          <Divider />
          <div
            style={{
              marginTop: spacing.sm,
              fontSize: typography.fontSize.xs,
              color: modernColors.text.secondary,
              lineHeight: 1.5,
            }}
          >
            {magic.intro}
          </div>
        </>
      )}
    </div>
  );
};

// ============= 物品品级颜色系统 =============

/** 物品品级枚举 */
export enum ItemQuality {
  Normal = 0, // 普通 - 白色
  Uncommon = 1, // 精良 - 绿色
  Rare = 2, // 稀有 - 蓝色
  Epic = 3, // 史诗 - 紫色
  Legendary = 4, // 传说 - 橙色
}

/** 品级颜色定义 - 武侠风格 */
export const qualityColors: Record<ItemQuality, string> = {
  [ItemQuality.Normal]: "rgba(255, 255, 255, 0.8)", // 白色
  [ItemQuality.Uncommon]: "#4CAF50", // 翠绿
  [ItemQuality.Rare]: "#2196F3", // 蔚蓝
  [ItemQuality.Epic]: "#9C27B0", // 紫晶
  [ItemQuality.Legendary]: "#FF9800", // 金橙
};

/** 品级发光颜色 (用于边框/阴影) */
export const qualityGlowColors: Record<ItemQuality, string> = {
  [ItemQuality.Normal]: "rgba(255, 255, 255, 0.2)",
  [ItemQuality.Uncommon]: "rgba(76, 175, 80, 0.5)",
  [ItemQuality.Rare]: "rgba(33, 150, 243, 0.5)",
  [ItemQuality.Epic]: "rgba(156, 39, 176, 0.5)",
  [ItemQuality.Legendary]: "rgba(255, 152, 0, 0.6)",
};

/**
 * 根据物品价格计算品级
 * 基于 cost 值区分物品稀有度
 */
export function getItemQuality(cost: number): ItemQuality {
  if (cost >= 2000) return ItemQuality.Legendary; // 传说级
  if (cost >= 1000) return ItemQuality.Epic; // 史诗级
  if (cost >= 500) return ItemQuality.Rare; // 稀有级
  if (cost >= 100) return ItemQuality.Uncommon; // 精良级
  return ItemQuality.Normal; // 普通级
}

/**
 * 获取物品名称颜色 (用于 Tooltip 等)
 */
export function getItemColor(good: UIGoodData | { cost: number }): string {
  const quality = getItemQuality(good.cost);
  return qualityColors[quality];
}

/**
 * 获取物品边框颜色 (用于槽位)
 */
export function getItemBorderColor(good: { cost: number } | null | undefined): string | null {
  if (!good) return null;
  const quality = getItemQuality(good.cost);
  if (quality === ItemQuality.Normal) return null; // 普通品级不显示特殊边框
  return qualityColors[quality];
}

/**
 * 获取物品发光效果颜色 (用于阴影)
 */
export function getItemGlowColor(good: { cost: number } | null | undefined): string | null {
  if (!good) return null;
  const quality = getItemQuality(good.cost);
  if (quality === ItemQuality.Normal) return null;
  return qualityGlowColors[quality];
}

function getItemTypeLabel(kind: number, part?: number): string {
  if (kind === 1 && part && part > 0) {
    const partMap: Record<number, string> = {
      1: "头饰",
      2: "项链",
      3: "衣甲",
      4: "披风",
      5: "兵器",
      6: "护腕",
      7: "靴履",
    };
    return partMap[part] ?? "装备";
  }
  const typeMap: Record<number, string> = {
    0: "消耗品",
    1: "装备",
    2: "任务物品",
  };
  return typeMap[kind] ?? "其他";
}
