/**
 * 快捷操作区块
 */

import React, { useState } from "react";
import { btnClass, inputClass } from "../constants";
import { Section } from "../Section";

interface QuickActionsSectionProps {
  isGodMode: boolean;
  onFullAll: () => void;
  onToggleGodMode: () => void;
  onKillAllEnemies: () => void;
  onSetLevel: (level: number) => void;
  onAddMoney: (amount: number) => void;
}

export const QuickActionsSection: React.FC<QuickActionsSectionProps> = ({
  isGodMode,
  onFullAll,
  onToggleGodMode,
  onKillAllEnemies,
  onSetLevel,
  onAddMoney,
}) => {
  const [moneyAmount, setMoneyAmount] = useState("1000");
  const [targetLevel, setTargetLevel] = useState("80");

  return (
    <Section title="快捷操作" defaultOpen={false}>
      <div className="space-y-2">
        <div className="flex gap-1">
          <button type="button" onClick={onFullAll} className={`${btnClass} flex-1`}>
            全满
          </button>
          <button
            type="button"
            onClick={onToggleGodMode}
            className={`flex-1 px-2 py-1 text-[11px] border ${
              isGodMode
                ? "bg-orange-600 hover:bg-orange-500 text-white border-orange-500"
                : "bg-zinc-700 hover:bg-zinc-600 text-zinc-200 border-zinc-600"
            }`}
          >
            {isGodMode ? "无敌中" : "无敌"}
          </button>
          <button
            type="button"
            onClick={onKillAllEnemies}
            className={`${btnClass} flex-1 text-red-400`}
          >
            秒杀
          </button>
        </div>

        <div className="flex gap-1">
          <input
            type="number"
            value={targetLevel}
            onChange={(e) => setTargetLevel(e.target.value)}
            className={`${inputClass} flex-1 min-w-0 text-center`}
            placeholder="等级"
          />
          <button
            type="button"
            onClick={() => {
              const l = Number.parseInt(targetLevel, 10);
              if (!Number.isNaN(l) && l >= 1) onSetLevel(l);
            }}
            className={`${btnClass} w-20 flex-shrink-0`}
          >
            设置等级
          </button>
        </div>

        <div className="flex gap-1">
          <input
            type="number"
            value={moneyAmount}
            onChange={(e) => setMoneyAmount(e.target.value)}
            className={`${inputClass} flex-1 min-w-0 text-center`}
            placeholder="金额"
          />
          <button
            type="button"
            onClick={() => {
              const a = Number.parseInt(moneyAmount, 10);
              if (!Number.isNaN(a)) onAddMoney(a);
            }}
            className={`${btnClass} w-20 flex-shrink-0 text-amber-400`}
          >
            添加金钱
          </button>
        </div>
      </div>
    </Section>
  );
};
