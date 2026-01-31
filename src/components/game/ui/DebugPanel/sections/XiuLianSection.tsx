/**
 * 修炼武功区块
 */

import React from "react";
import type { MagicItemInfo } from "@/engine/magic";
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

  return (
    <Section title="修炼武功">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-[11px] text-amber-400">{xiuLianMagic.magic.name}</div>
          <div className="text-[10px] text-zinc-500">
            等级 {xiuLianMagic.level} / {xiuLianMagic.magic.maxLevel || 10}
          </div>
        </div>
        <div className="flex gap-1">
          <button
            type="button"
            onClick={onXiuLianLevelDown}
            disabled={xiuLianMagic.level <= 1}
            className={`${btnClass} w-6 h-6 p-0`}
          >
            −
          </button>
          <button
            type="button"
            onClick={onXiuLianLevelUp}
            disabled={xiuLianMagic.level >= (xiuLianMagic.magic.maxLevel || 10)}
            className={`${btnClass} w-6 h-6 p-0`}
          >
            +
          </button>
        </div>
      </div>
    </Section>
  );
};
