/**
 * 游戏调试区块 - 合并快捷操作和物品/武功
 */

import { getMagicsData } from "@miu2d/engine/data";
import { getMagicFromApiCache } from "@miu2d/engine/magic";
import { EquipPosition, GoodKind, getAllGoods } from "@miu2d/engine/player/goods";
import type React from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useAsfImage } from "../../../ui/classic/hooks/useAsfImage";
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

/** 根据 GoodKind 和 EquipPosition 获取分类
 * 注意：Part 优先于 Kind — 原始 INI 中 Kind= 可能为空，服务端默认为 Drug，
 * 但只要 Part 有值就应该按装备分类。
 */
function getGoodsCategory(kind: GoodKind, part: EquipPosition): Exclude<GoodsCategory, "全部"> {
  // Part 优先分类
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
  }
  if (kind === GoodKind.Event) return "事件";
  return "药品";
}

// ── 物品图标 ──────────────────────────────────────────────────────────────────

/** 懒加载单个物品图标（icon 小图，带 s 后缀） */
function GoodsIconImg({ iconPath, size = 28 }: { iconPath: string; size?: number }) {
  const { dataUrl, isLoading } = useAsfImage(iconPath || null, 0);
  if (!iconPath) return <span className="text-[#444]" style={{ width: size, height: size, display: "inline-block" }}>□</span>;
  if (isLoading) return <span className="text-[#555] text-[9px]" style={{ width: size, height: size, display: "inline-flex", alignItems: "center", justifyContent: "center" }}>…</span>;
  if (!dataUrl) return <span className="text-[#444]" style={{ width: size, height: size, display: "inline-block" }}>□</span>;
  return (
    <img
      src={dataUrl}
      alt=""
      width={size}
      height={size}
      style={{ imageRendering: "pixelated", width: size, height: size, objectFit: "contain", flexShrink: 0 }}
    />
  );
}

// ── 物品 Combobox ──────────────────────────────────────────────────────────

interface GoodsItem {
  name: string;
  file: string;
  image: string;
  icon: string;
  category: Exclude<GoodsCategory, "全部">;
}

interface GoodsComboboxProps {
  items: GoodsItem[];
  value: string;
  onChange: (file: string) => void;
}

function GoodsCombobox({ items, value, onChange }: GoodsComboboxProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  const selected = items.find((i) => i.file === value);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    if (!q) return items;
    return items.filter(
      (i) => i.name.toLowerCase().includes(q) || i.file.toLowerCase().includes(q)
    );
  }, [items, search]);

  // 点击外部关闭
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setSearch("");
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  return (
    <div ref={ref} className="relative flex-1 min-w-0">
      {/* 触发按钮 */}
      <button
        type="button"
        onClick={() => {
          setOpen((v) => !v);
          setSearch("");
        }}
        className="w-full px-2 py-1 text-[11px] bg-[#3c3c3c] border border-[#3c3c3c] text-left flex items-center gap-1 hover:border-[#007acc] focus:outline-none focus:border-[#007acc]"
      >
        {selected ? (
          <>
            <GoodsIconImg iconPath={selected.icon} size={20} />
            <span className="flex-1 min-w-0 truncate">
              <span className="text-[#d4d4d4]">{selected.name}</span>
              <span className="text-[#666] ml-1">{selected.file}</span>
            </span>
          </>
        ) : (
          <span className="text-[#666] flex-1">选择物品...</span>
        )}
        <span className="text-[#666] flex-shrink-0">▾</span>
      </button>

      {/* 下拉面板 */}
      {open && (
        <div className="absolute left-0 right-0 top-full z-50 mt-px bg-[#252526] border border-[#007acc] shadow-lg">
          {/* 搜索框 */}
          <div className="p-1 border-b border-[#2d2d2d]">
            <input
              autoFocus
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="搜索名字或 key..."
              className="w-full px-2 py-1 text-[11px] bg-[#3c3c3c] border border-[#3c3c3c] text-[#d4d4d4] focus:outline-none focus:border-[#007acc]"
            />
          </div>
          {/* 列表 */}
          <div className="max-h-48 overflow-y-auto">
            {filtered.length === 0 ? (
              <div className="px-2 py-1 text-[11px] text-[#666]">无匹配物品</div>
            ) : (
              filtered.map((i) => (
                <button
                  key={i.file}
                  type="button"
                  onClick={() => {
                    onChange(i.file);
                    setOpen(false);
                    setSearch("");
                  }}
                  className={`w-full px-2 py-1.5 text-left hover:bg-[#094771] flex items-center gap-2 ${
                    i.file === value ? "bg-[#094771]" : ""
                  }`}
                >
                  <GoodsIconImg iconPath={i.icon} size={28} />
                  <span className="flex-1 min-w-0">
                    <span className="block text-[11px] text-[#d4d4d4] leading-tight">{i.name}</span>
                    <span className="block text-[10px] text-[#666] leading-tight truncate">
                      {i.file}{i.image ? ` · ${i.image}` : ""}
                    </span>
                  </span>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

interface GameDebugSectionProps {
  isGodMode: boolean;
  onFullAll: () => void;
  onToggleGodMode: () => void;
  onKillAllEnemies: () => void;
  onReduceLife: () => void;
  onSetLevel: (level: number) => void;
  currentDifficulty: "easy" | "hard";
  onSetDifficulty: (d: "easy" | "hard") => void;
  onAddMoney: (amount: number) => void;
  onAddItem?: (itemFile: string) => Promise<void>;
  onAddMagic?: (magicFile: string) => Promise<void>;
  onAddAllMagics?: () => Promise<void>;
  onReloadMagicConfig?: () => Promise<void>;
  onReloadUILayout?: () => Promise<void>;
  onRevealFullMap?: () => void;
}

export const GameDebugSection: React.FC<GameDebugSectionProps> = ({
  isGodMode,
  onFullAll,
  onToggleGodMode,
  onKillAllEnemies,
  onReduceLife,
  onSetLevel,
  currentDifficulty,
  onSetDifficulty,
  onAddMoney,
  onAddItem,
  onAddMagic,
  onAddAllMagics,
  onReloadMagicConfig,
  onReloadUILayout,
  onRevealFullMap,
}) => {
  const [moneyAmount, setMoneyAmount] = useState("1000");
  const [targetLevel, setTargetLevel] = useState("80");
  const [selectedCategory, setSelectedCategory] = useState("全部");
  const [selectedItem, setSelectedItem] = useState("");
  const [isAddingItem, setIsAddingItem] = useState(false);
  const [selectedMagic, setSelectedMagic] = useState("");
  const [isAddingMagic, setIsAddingMagic] = useState(false);
  const [isReloadingMagic, setIsReloadingMagic] = useState(false);
  const [isReloadingUILayout, setIsReloadingUILayout] = useState(false);

  // 从 API 缓存获取物品列表（游戏数据加载后不变，用 useMemo 避免 500ms 重复计算）
  const allGoods = useMemo(
    () =>
      getAllGoods()
        .filter(
          (g) =>
            // 过滤无名物品
            g.name.trim() !== "" &&
            // 过滤 kind=Drug 且 part=None 且无任何数值（纯空占位物品）
            !(g.kind === GoodKind.Drug && g.part === EquipPosition.None &&
              g.life === 0 && g.thew === 0 && g.mana === 0)
        )
        .map((g) => ({
          name: g.name,
          file: g.fileName,
          image: g.imagePath.replace("asf/goods/", ""),
          icon: g.iconPath, // e.g. "asf/goods/tm050-霹雳铠s.asf"
          category: getGoodsCategory(g.kind, g.part),
        })),
    []
  );

  // 从 API 数据获取所有玩家武功列表（userType === "player"），避免依赖 key 前缀约定
  const allMagics = useMemo(
    () =>
      (getMagicsData()?.player ?? []).map((api) => {
        const magic = getMagicFromApiCache(api.key);
        return { name: magic?.name ?? api.name ?? api.key, file: api.key };
      }),
    []
  );

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
    } catch (e) {
      console.error("[DebugPanel] reloadMagicConfig failed:", e);
    } finally {
      setIsReloadingMagic(false);
    }
  };

  const handleReloadUILayout = async () => {
    if (!onReloadUILayout) return;
    setIsReloadingUILayout(true);
    try {
      await onReloadUILayout();
    } catch (e) {
      console.error("[DebugPanel] reloadUILayout failed:", e);
    } finally {
      setIsReloadingUILayout(false);
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
          {onRevealFullMap && (
            <button
              type="button"
              onClick={onRevealFullMap}
              className={`${btnClass} flex-1 text-[#4ade80]`}
            >
              全图
            </button>
          )}
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
          <span className={`${btnClass} flex-1 min-w-0 text-center pointer-events-none`}>
            难度：{currentDifficulty === "hard" ? "困难" : "简单"}
          </span>
          <button
            type="button"
            onClick={() => onSetDifficulty("easy")}
            className={`${btnClass} w-16 flex-shrink-0 ${currentDifficulty === "easy" ? "text-[#34d399]" : ""}`}
          >
            简单
          </button>
          <button
            type="button"
            onClick={() => onSetDifficulty("hard")}
            className={`${btnClass} w-16 flex-shrink-0 ${currentDifficulty === "hard" ? "text-[#f87171]" : ""}`}
          >
            困难
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
            <GoodsCombobox
              items={filteredItems}
              value={selectedItem}
              onChange={setSelectedItem}
            />
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

        {/* 重载UI布局 */}
        {onReloadUILayout && (
          <>
            <hr className="border-[#2d2d2d] my-2" />
            <button
              type="button"
              onClick={handleReloadUILayout}
              disabled={isReloadingUILayout}
              className={`${btnClass} w-full text-[#86efac]`}
            >
              {isReloadingUILayout ? "重载中..." : "重载UI布局"}
            </button>
          </>
        )}
      </div>
    </Section>
  );
};
