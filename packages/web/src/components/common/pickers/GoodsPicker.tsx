/**
 * 物品选择器
 *
 * 类似 MagicPicker 的界面风格，用于选择物品
 * 数据来源：goods tRPC 接口
 */
import { useCallback, useState, useMemo, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { trpc } from "../../../lib/trpc";
import { LazyAsfIcon } from "../LazyAsfIcon";

const GOODS_KIND_LABELS: Record<string, string> = {
  Consumable: "消耗品",
  Equipment: "装备",
  Quest: "任务道具",
};

const GOODS_KIND_ICONS: Record<string, string> = {
  Consumable: "🍵",
  Equipment: "⚔️",
  Quest: "📜",
};

export interface GoodsPickerProps {
  /** 字段标签 */
  label: string;
  /** 当前值（物品 key） */
  value: string | null | undefined;
  /** 值变化回调 */
  onChange: (value: string | null) => void;
  /** 游戏 ID */
  gameId: string;
  /** 游戏 slug（用于图标） */
  gameSlug?: string;
  /** 占位文本 */
  placeholder?: string;
  /** 已选中的 key 集合（用于排除已添加的物品） */
  existingKeys?: Set<string>;
}

export function GoodsPicker({
  label,
  value,
  onChange,
  gameId,
  gameSlug,
  placeholder = "点击选择物品",
  existingKeys,
}: GoodsPickerProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  // 获取物品列表
  const { data: goodsList } = trpc.goods.list.useQuery(
    { gameId },
    { enabled: !!gameId },
  );

  // 找到当前选中的物品
  const selectedGoods = useMemo(() => {
    if (!value || !goodsList) return null;
    return goodsList.find((g) => g.key.toLowerCase() === value.toLowerCase()) || null;
  }, [value, goodsList]);

  const handleOpenDialog = useCallback(() => {
    setIsDialogOpen(true);
  }, []);

  const handleSelect = useCallback(
    (key: string) => {
      onChange(key);
      setIsDialogOpen(false);
    },
    [onChange],
  );

  const handleClear = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onChange(null);
    },
    [onChange],
  );

  return (
    <div className="flex items-center gap-3 relative">
      {/* 标签 */}
      <label className="text-xs text-[#858585] w-20 flex-shrink-0">{label}</label>

      {/* 内容区 */}
      <div
        className="flex-1 bg-[#2d2d2d] border border-[#454545] rounded h-9 flex items-center px-2 cursor-pointer hover:border-[#0098ff] transition-colors group"
        onClick={handleOpenDialog}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        {value ? (
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <LazyAsfIcon iconPath={selectedGoods?.icon} gameSlug={gameSlug} size={20} prefix="asf/goods/" fallback="📦" />
            <span className="text-xs text-[#cccccc] truncate flex-1" title={value}>
              {selectedGoods ? `${selectedGoods.name} (${value})` : value}
            </span>

            {/* 悬停时显示操作按钮 */}
            <div
              className={`flex items-center gap-1 flex-shrink-0 transition-opacity ${isHovered ? "opacity-100" : "opacity-0"}`}
            >
              <button
                type="button"
                onClick={handleClear}
                className="w-5 h-5 flex items-center justify-center rounded hover:bg-[#3c3c3c] text-[#808080] hover:text-white"
                title="清除"
              >
                <svg className="w-3 h-3" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M2 2l8 8M10 2l-8 8" />
                </svg>
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleOpenDialog();
                }}
                className="w-5 h-5 flex items-center justify-center rounded hover:bg-[#3c3c3c] text-[#808080] hover:text-white"
                title="修改"
              >
                <svg className="w-3 h-3" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M8.5 1.5l2 2M1 11l.5-2L9 1.5l2 2L3.5 11 1 11z" />
                </svg>
              </button>
            </div>
          </div>
        ) : (
          <span className="text-xs text-[#606060]">{placeholder}</span>
        )}
      </div>

      {/* 物品选择弹窗 */}
      <GoodsSelectDialog
        open={isDialogOpen}
        onClose={() => setIsDialogOpen(false)}
        onSelect={handleSelect}
        gameId={gameId}
        gameSlug={gameSlug}
        currentValue={value}
        existingKeys={existingKeys}
        title={`选择${label}`}
      />
    </div>
  );
}

// ========== 物品选择弹窗 ==========

interface GoodsSelectDialogProps {
  open: boolean;
  onClose: () => void;
  onSelect: (key: string) => void;
  gameId: string;
  gameSlug?: string;
  currentValue?: string | null;
  existingKeys?: Set<string>;
  title?: string;
}

function GoodsSelectDialog({
  open,
  onClose,
  onSelect,
  gameId,
  gameSlug,
  currentValue,
  existingKeys,
  title = "选择物品",
}: GoodsSelectDialogProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [kindFilter, setKindFilter] = useState<string>("All");

  const { data: goodsList, isLoading } = trpc.goods.list.useQuery(
    { gameId },
    { enabled: open && !!gameId },
  );

  // 过滤物品
  const filteredGoods = useMemo(() => {
    if (!goodsList) return [];
    return goodsList.filter((g) => {
      if (kindFilter !== "All" && g.kind !== kindFilter) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        return g.name.toLowerCase().includes(q) || g.key.toLowerCase().includes(q);
      }
      return true;
    });
  }, [goodsList, searchQuery, kindFilter]);

  // 分类计数
  const kindCounts = useMemo(() => {
    if (!goodsList) return { All: 0, Consumable: 0, Equipment: 0, Quest: 0 };
    const counts = { All: goodsList.length, Consumable: 0, Equipment: 0, Quest: 0 };
    for (const g of goodsList) {
      if (g.kind in counts) counts[g.kind as keyof typeof counts]++;
    }
    return counts;
  }, [goodsList]);

  const listContainerRef = useRef<HTMLDivElement>(null);

  // 初始化选中项
  useEffect(() => {
    if (open && currentValue && goodsList) {
      const found = goodsList.find((g) => g.key.toLowerCase() === currentValue.toLowerCase());
      if (found) {
        setSelectedKey(found.key);
        requestAnimationFrame(() => {
          const container = listContainerRef.current;
          if (container) {
            const selectedEl = container.querySelector(`[data-goods-key="${found.key}"]`);
            selectedEl?.scrollIntoView({ block: "center" });
          }
        });
      }
    }
  }, [open, currentValue, goodsList]);

  // 重置状态
  useEffect(() => {
    if (!open) {
      setSearchQuery("");
      setSelectedKey(null);
      setKindFilter("All");
    }
  }, [open]);

  const handleConfirm = useCallback(() => {
    if (selectedKey) onSelect(selectedKey);
  }, [selectedKey, onSelect]);

  // 键盘事件
  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "Enter" && selectedKey) handleConfirm();
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, selectedKey, onClose, handleConfirm]);

  if (!open) return null;

  const getKindBadgeClass = (kind: string) => {
    switch (kind) {
      case "Consumable":
        return "bg-green-500/20 text-green-400";
      case "Equipment":
        return "bg-blue-500/20 text-blue-400";
      default:
        return "bg-purple-500/20 text-purple-400";
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onClose}>
      <div
        className="w-[550px] min-h-[400px] max-h-[80vh] bg-[#1e1e1e] border border-[#454545] rounded-lg shadow-2xl flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 标题栏 */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#454545] bg-[#252526]">
          <h2 className="text-white font-medium">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded hover:bg-[#3c3c3c] text-[#808080] hover:text-white"
          >
            ✕
          </button>
        </div>

        {/* 搜索和过滤栏 */}
        <div className="px-4 py-2 border-b border-[#454545] flex gap-2">
          <input
            type="text"
            placeholder="搜索物品名称或标识..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="flex-1 px-3 py-2 bg-[#3c3c3c] border border-[#454545] rounded text-white text-sm focus:outline-none focus:border-[#0e639c]"
            autoFocus
          />
        </div>

        {/* 分类 Tabs */}
        <div className="flex gap-1 px-4 py-2 border-b border-[#454545]">
          {(["All", "Consumable", "Equipment", "Quest"] as const).map((kind) => (
            <button
              key={kind}
              type="button"
              onClick={() => setKindFilter(kind)}
              className={`px-3 py-1.5 text-xs rounded transition-colors ${
                kindFilter === kind
                  ? "bg-[#094771] text-white"
                  : "bg-[#3c3c3c] text-[#cccccc] hover:bg-[#4a4a4a]"
              }`}
            >
              {kind === "All" ? "全部" : `${GOODS_KIND_ICONS[kind]} ${GOODS_KIND_LABELS[kind]}`}
              <span className="ml-1 text-[#888]">({kindCounts[kind]})</span>
            </button>
          ))}
        </div>

        {/* 物品列表 */}
        <div ref={listContainerRef} className="flex-1 min-h-[250px] overflow-auto p-2">
          {isLoading ? (
            <div className="flex items-center justify-center py-8 text-[#808080]">
              <div className="w-5 h-5 border-2 border-amber-500 border-t-transparent rounded-full animate-spin mr-2" />
              加载中...
            </div>
          ) : filteredGoods.length === 0 ? (
            <div className="text-center py-8 text-[#808080]">
              {searchQuery ? "没有匹配的物品" : "暂无物品，请先在物品模块中创建"}
            </div>
          ) : (
            <div className="space-y-0.5">
              {filteredGoods.map((g) => {
                const alreadyAdded = existingKeys?.has(g.key.toLowerCase());
                const isSelected = selectedKey === g.key;
                return (
                  <div
                    key={g.id}
                    data-goods-key={g.key}
                    className={`flex items-center px-3 py-2 rounded cursor-pointer select-none ${
                      alreadyAdded
                        ? "opacity-40 cursor-not-allowed"
                        : isSelected
                          ? "bg-[#0e639c] text-white"
                          : "hover:bg-[#2a2d2e] text-[#cccccc]"
                    }`}
                    onClick={() => !alreadyAdded && setSelectedKey(g.key)}
                    onDoubleClick={() => !alreadyAdded && onSelect(g.key)}
                  >
                    {/* 图标 */}
                    <div className="w-8 h-8 mr-2 flex-shrink-0 flex items-center justify-center">
                      <LazyAsfIcon iconPath={g.icon} gameSlug={gameSlug} size={28} prefix="asf/goods/" fallback="📦" />
                    </div>

                    {/* 名称和 key */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={`text-sm font-medium truncate ${isSelected ? "text-white" : "text-[#cccccc]"}`}>{g.name}</span>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded ${getKindBadgeClass(g.kind)}`}>
                          {GOODS_KIND_LABELS[g.kind] ?? g.kind}
                        </span>
                      </div>
                      <div className={`text-xs truncate ${isSelected ? "text-white/70" : "text-[#808080]"}`}>
                        {g.key}
                      </div>
                    </div>

                    {/* 已添加标记 */}
                    {alreadyAdded && <span className="text-xs text-[#858585] ml-2">已添加</span>}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* 底部栏 */}
        <div className="flex items-center justify-between px-4 py-3 border-t border-[#454545] bg-[#252526]">
          <span className="text-xs text-[#808080]">{filteredGoods.length} 项可选</span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm rounded hover:bg-[#3c3c3c] text-[#cccccc]"
            >
              取消
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              disabled={!selectedKey}
              className="px-4 py-2 text-sm bg-[#0e639c] hover:bg-[#1177bb] text-white rounded disabled:opacity-50 disabled:cursor-not-allowed"
            >
              选择
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
