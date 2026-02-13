/**
 * 修炼武功区块
 */

import type { MagicItemInfo } from "@miu2d/engine/magic";
import type React from "react";
import { btnClass } from "../constants";
import { Section } from "../Section";

interface XiuLianSectionProps {
  xiuLianMagic: MagicItemInfo;
  onXiuLianLevelUp?: () => void;
  onXiuLianLevelDown?: () => void;
}

export const XiuLianSection: React.FC<XiuLianSectionProps> = ({
  xiuLianMagic,
  onXiuLianLevelUp,
  onXiuLianLevelDown,
}) => {
  if (!xiuLianMagic?.magic) return null;

  // 没有等级数据的武功不能升级
  const canUpgrade = !!(xiuLianMagic.magic.levels && xiuLianMagic.magic.levels.size > 0);

  return (
    <Section title="修炼武功">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-[11px] text-[#fbbf24]">{xiuLianMagic.magic.name}</div>
          <div className="text-[10px] text-[#969696]">
            {canUpgrade
              ? `等级 ${xiuLianMagic.level} / ${xiuLianMagic.magic.maxLevel || 10}`
              : `等级 ${xiuLianMagic.level}（不可升级）`}
          </div>
        </div>
        <div className="flex gap-1">
          <button
            type="button"
            onClick={onXiuLianLevelDown}
            disabled={!canUpgrade || xiuLianMagic.level <= 1}
            className={`${btnClass} w-6 h-6 p-0`}
          >
            −
          </button>
          <button
            type="button"
            onClick={onXiuLianLevelUp}
            disabled={!canUpgrade || xiuLianMagic.level >= (xiuLianMagic.magic.maxLevel || 10)}
            className={`${btnClass} w-6 h-6 p-0`}
          >
            +
          </button>
        </div>
      </div>
    </Section>
  );
};
