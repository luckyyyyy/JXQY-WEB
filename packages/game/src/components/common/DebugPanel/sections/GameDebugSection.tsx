/**
 * 游戏调试区块 - 合并快捷操作和物品/武功
 */

import { getAllCachedMagicFileNames, getMagicFromApiCache } from "@miu2d/engine/magic";
import { EquipPosition, GoodKind, getAllGoods } from "@miu2d/engine/player/goods";
import type React from "react";
import { useState } from "react";
import { btnClass, btnPrimary, inputClass, selectClass } from "../constants";
import { Section } from "../Section";

/** 物品分类 */
const GOODS_CATEGORIES = [
  "全部",
  "药品",
  "武器",
  "头饰",
  "项链",
  "衣服",
  "披风",
  "护腕",
  "鞋子",
  "秘籍",
  "事件",
] as const;
type GoodsCategory = (typeof GOODS_CATEGORIES)[number];

/** 根据 GoodKind 和 EquipPosition 获取分类 */
function getGoodsCategory(kind: GoodKind, part: EquipPosition): Exclude<GoodsCategory, "全部"> {
  if (kind === GoodKind.Drug) return "药品";
  if (kind === GoodKind.Event) return "事件";
  // 装备根据部位分类
  switch (part) {
    case EquipPosition.Hand:
      return "武器";
    case EquipPosition.Head:
      return "头饰";
    case EquipPosition.Neck:
      return "项链";
    case EquipPosition.Body:
      return "衣服";
    case EquipPosition.Back:
      return "披风";
    case EquipPosition.Wrist:
      return "护腕";
    case EquipPosition.Foot:
      return "鞋子";
    default:
      return "事件";
  }
}

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
  onReloadMagicConfig?: () => Promise<void>;
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
  onReloadMagicConfig,
}) => {
  const [moneyAmount, setMoneyAmount] = useState("1000");
  const [targetLevel, setTargetLevel] = useState("80");
  const [selectedCategory, setSelectedCategory] = useState("全部");
  const [selectedItem, setSelectedItem] = useState("");
  const [isAddingItem, setIsAddingItem] = useState(false);
  const [selectedMagic, setSelectedMagic] = useState("");
  const [isAddingMagic, setIsAddingMagic] = useState(false);
  const [isReloadingMagic, setIsReloadingMagic] = useState(false);

  // 从 API 缓存获取物品列表（每次分类变化时重新计算）
  const allGoods = getAllGoods().map((g) => ({
    name: g.name,
    file: g.fileName,
    category: getGoodsCategory(g.kind, g.part),
  }));

  // 从 API 缓存获取武功列表
  const allMagics = getAllCachedMagicFileNames()
    .filter((key) => key.startsWith("player-magic-"))
    .map((key) => {
      const magic = getMagicFromApiCache(key);
      return { name: magic?.name ?? key, file: key };
    });

  // 根据选择的分类过滤物品
  const filteredItems =
    selectedCategory === "全部"
      ? allGoods
      : allGoods.filter((item) => item.category === selectedCategory);

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

  const handleReloadMagicConfig = async () => {
    if (!onReloadMagicConfig) return;
    setIsReloadingMagic(true);
    try {
      await onReloadMagicConfig();
      alert("武功配置重载成功");
    } catch (e) {
      alert(`重载失败:\n${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setIsReloadingMagic(false);
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
                ? "bg-[#f59e0b] hover:bg-[#fbbf24] text-white border-[#f59e0b]"
                : "bg-[#3c3c3c] hover:bg-[#505050] text-[#d4d4d4] border-[#505050]"
            }`}
          >
            {isGodMode ? "无敌中" : "无敌"}
          </button>
          <button
            type="button"
            onClick={onKillAllEnemies}
            className={`${btnClass} flex-1 text-[#f87171]`}
          >
            秒杀
          </button>
          <button
            type="button"
            onClick={onReduceLife}
            className={`${btnClass} flex-1 text-[#f87171]`}
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
            className={`${btnClass} w-20 flex-shrink-0 text-[#fb923c]`}
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
              {allMagics.map((m) => (
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

        {/* 分隔线 + 武功配置重载 */}
        {onReloadMagicConfig && (
          <>
            <hr className="border-[#2d2d2d] my-2" />
            <button
              type="button"
              onClick={handleReloadMagicConfig}
              disabled={isReloadingMagic}
              className={`${btnClass} w-full text-[#93c5fd]`}
            >
              {isReloadingMagic ? "重载中..." : "武功配置重载"}
            </button>
          </>
        )}
      </div>
    </Section>
  );
};
