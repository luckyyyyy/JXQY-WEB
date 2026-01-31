/**
 * 游戏调试区块 - 合并快捷操作和物品/武功
 */

import type React from "react";
import { useMemo, useState } from "react";
import { ALL_GOODS, ALL_PLAYER_MAGICS, GOODS_CATEGORIES } from "@/constants/gameData";
import { btnClass, btnPrimary, inputClass, selectClass } from "../constants";
import { Section } from "../Section";

interface GameDebugSectionProps {
  isGodMode: boolean;
  onFullAll: () => void;
  onToggleGodMode: () => void;
  onKillAllEnemies: () => void;
  onReduceLife: () => void;
  onSetLevel: (level: number) => void;
  onAddMoney: (amount: number) => void;
  onAddItem?: (itemFile: string) => Promise<void>;
  onAddMagic?: (magicFile: string) => Promise<void>;
  onAddAllMagics?: () => Promise<void>;
}

export const GameDebugSection: React.FC<GameDebugSectionProps> = ({
  isGodMode,
  onFullAll,
  onToggleGodMode,
  onKillAllEnemies,
  onReduceLife,
  onSetLevel,
  onAddMoney,
  onAddItem,
  onAddMagic,
  onAddAllMagics,
}) => {
  const [moneyAmount, setMoneyAmount] = useState("1000");
  const [targetLevel, setTargetLevel] = useState("80");
  const [selectedCategory, setSelectedCategory] = useState("全部");
  const [selectedItem, setSelectedItem] = useState("");
  const [isAddingItem, setIsAddingItem] = useState(false);
  const [selectedMagic, setSelectedMagic] = useState("");
  const [isAddingMagic, setIsAddingMagic] = useState(false);

  const filteredItems = useMemo(() => {
    if (selectedCategory === "全部") return ALL_GOODS;
    return ALL_GOODS.filter((item) => item.category === selectedCategory);
  }, [selectedCategory]);

  const handleAddItem = async () => {
    if (!onAddItem || !selectedItem) return;
    setIsAddingItem(true);
    try {
      await onAddItem(selectedItem);
    } catch (e) {
      alert(`添加失败:\n${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setIsAddingItem(false);
    }
  };

  const handleAddMagic = async () => {
    if (!onAddMagic || !selectedMagic) return;
    setIsAddingMagic(true);
    try {
      await onAddMagic(selectedMagic);
    } catch (e) {
      alert(`添加失败:\n${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setIsAddingMagic(false);
    }
  };

  const handleAddAllMagics = async () => {
    if (!onAddAllMagics) return;
    setIsAddingMagic(true);
    try {
      await onAddAllMagics();
    } catch (e) {
      alert(`添加失败:\n${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setIsAddingMagic(false);
    }
  };

  return (
    <Section title="游戏调试" defaultOpen={false}>
      <div className="space-y-2">
        {/* 快捷操作 */}
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
          <button
            type="button"
            onClick={onReduceLife}
            className={`${btnClass} flex-1 text-red-400`}
          >
            扣血
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

        {/* 物品/武功 */}
        {onAddItem && (
          <div className="flex gap-1">
            <select
              value={selectedCategory}
              onChange={(e) => {
                setSelectedCategory(e.target.value);
                setSelectedItem("");
              }}
              className={`${selectClass} w-16`}
            >
              {GOODS_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            <select
              value={selectedItem}
              onChange={(e) => setSelectedItem(e.target.value)}
              className={`${selectClass} flex-1`}
            >
              <option value="">选择物品...</option>
              {filteredItems.map((i) => (
                <option key={i.file} value={i.file}>
                  {i.name}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={handleAddItem}
              disabled={isAddingItem || !selectedItem}
              className={`${btnPrimary} px-3`}
            >
              +
            </button>
          </div>
        )}
        {onAddMagic && (
          <div className="flex gap-1">
            <select
              value={selectedMagic}
              onChange={(e) => setSelectedMagic(e.target.value)}
              className={`${selectClass} flex-1`}
            >
              <option value="">选择武功...</option>
              {ALL_PLAYER_MAGICS.map((m) => (
                <option key={m.file} value={m.file}>
                  {m.name}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={handleAddMagic}
              disabled={isAddingMagic || !selectedMagic}
              className={`${btnPrimary} px-3`}
            >
              +
            </button>
            <button
              type="button"
              onClick={handleAddAllMagics}
              disabled={isAddingMagic}
              className={`${btnClass} px-2`}
            >
              全部
            </button>
          </div>
        )}
      </div>
    </Section>
  );
};
