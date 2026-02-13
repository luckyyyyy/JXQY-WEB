/**
 * 商店编辑页面
 */
import { useState, useCallback, useMemo, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { trpc } from "../../../lib/trpc";
import { useDashboard } from "../DashboardContext";
import { useToast } from "../../../contexts/ToastContext";
import { LazyAsfIcon } from "../../../components/common/LazyAsfIcon";
import { DetailPageLayout } from "../components/DetailPageLayout";
import { EditorEmptyState } from "../components/EditorEmptyState";
import type { Shop, ShopItem, GoodsKind } from "@miu2d/types";
import { createDefaultShop } from "@miu2d/types";

/**
 * 自动计算物品价格（与引擎 Good.costRaw 一致）
 * 消耗品: (thew*4 + life*2 + mana*2) * (1 + hasEffect)
 * 装备: (attack*20 + defend*20 + evade*40 + lifeMax*2 + thewMax*3 + manaMax*2) * (1 + hasEffect)
 */
function calcGoodsCostRaw(info: GoodsInfo): number {
  const hasEffect = (info.effectType ?? 0) !== 0 ? 1 : 0;
  if (info.kind === "Consumable") {
    return ((info.thew ?? 0) * 4 + (info.life ?? 0) * 2 + (info.mana ?? 0) * 2) * (1 + hasEffect);
  }
  if (info.kind === "Equipment") {
    return (
      ((info.attack ?? 0) * 20 + (info.defend ?? 0) * 20 + (info.evade ?? 0) * 40 +
       (info.lifeMax ?? 0) * 2 + (info.thewMax ?? 0) * 3 + (info.manaMax ?? 0) * 2) *
      (1 + hasEffect)
    );
  }
  return 0;
}

/** 获取物品的最终价格：手动设定 > 自动计算 */
function getGoodsCost(info: GoodsInfo): { cost: number; isAuto: boolean } {
  if (info.cost && info.cost > 0) {
    return { cost: info.cost, isAuto: false };
  }
  return { cost: calcGoodsCostRaw(info), isAuto: true };
}

interface GoodsInfo {
  name: string;
  kind: GoodsKind;
  icon?: string | null;
  cost?: number | null;
  life?: number | null;
  thew?: number | null;
  mana?: number | null;
  lifeMax?: number | null;
  thewMax?: number | null;
  manaMax?: number | null;
  attack?: number | null;
  defend?: number | null;
  evade?: number | null;
  effectType?: number | null;
}

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

// ========== 商品选择器弹窗 ==========
function GoodsPickerModal({
  gameId,
  gameSlug,
  existingKeys,
  onSelect,
  onClose,
}: {
  gameId: string;
  gameSlug?: string;
  existingKeys: Set<string>;
  onSelect: (goodsKey: string, goodsName: string) => void;
  onClose: () => void;
}) {
  const [search, setSearch] = useState("");
  const [kindFilter, setKindFilter] = useState<string>("All");

  const { data: goodsList, isLoading } = trpc.goods.list.useQuery(
    { gameId },
    { enabled: !!gameId }
  );

  const filteredGoods = useMemo(() => {
    if (!goodsList) return [];
    return goodsList.filter(g => {
      if (kindFilter !== "All" && g.kind !== kindFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        return g.name.toLowerCase().includes(q) || g.key.toLowerCase().includes(q);
      }
      return true;
    });
  }, [goodsList, search, kindFilter]);

  // 各分类统计
  const kindCounts = useMemo(() => {
    if (!goodsList) return { All: 0, Consumable: 0, Equipment: 0, Quest: 0 };
    const counts = { All: goodsList.length, Consumable: 0, Equipment: 0, Quest: 0 };
    for (const g of goodsList) {
      if (g.kind in counts) counts[g.kind as keyof typeof counts]++;
    }
    return counts;
  }, [goodsList]);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-[#252526] rounded-lg border border-widget-border w-[550px] max-h-[70vh] flex flex-col">
        <div className="flex items-center justify-between px-4 py-3 border-b border-widget-border">
          <h3 className="font-medium text-white">选择物品</h3>
          <button type="button" onClick={onClose} className="text-[#858585] hover:text-white">
            ✕
          </button>
        </div>

        {/* 搜索栏 */}
        <div className="px-4 py-2 border-b border-widget-border">
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="搜索物品名称或标识..."
            className="w-full px-3 py-2 bg-[#1e1e1e] border border-widget-border rounded text-white text-sm focus:outline-none focus:border-focus-border"
          />
        </div>

        {/* 分类 Tabs */}
        <div className="flex gap-1 px-4 py-2 border-b border-widget-border">
          {(["All", "Consumable", "Equipment", "Quest"] as const).map(kind => (
            <button
              key={kind}
              type="button"
              onClick={() => setKindFilter(kind)}
              className={`px-3 py-1 text-xs rounded transition-colors ${
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
        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="px-4 py-8 text-center text-sm text-[#858585]">加载中...</div>
          ) : filteredGoods.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-[#858585]">
              {search ? "没有匹配的物品" : "暂无物品，请先在物品模块中创建"}
            </div>
          ) : (
            filteredGoods.map(g => {
              const alreadyAdded = existingKeys.has(g.key.toLowerCase());
              return (
                <button
                  key={g.id}
                  type="button"
                  disabled={alreadyAdded}
                  onClick={() => onSelect(g.key, g.name)}
                  className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors border-b border-panel-border ${
                    alreadyAdded
                      ? "opacity-40 cursor-not-allowed"
                      : "hover:bg-[#2a2d2e] cursor-pointer"
                  }`}
                >
                  <LazyAsfIcon iconPath={g.icon} gameSlug={gameSlug} size={28} prefix="asf/goods/" fallback="📦" />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-white truncate">{g.name}</div>
                    <div className="text-xs text-[#858585] truncate">{g.key}</div>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded ${
                    g.kind === "Consumable" ? "bg-green-500/20 text-green-400" :
                    g.kind === "Equipment" ? "bg-blue-500/20 text-blue-400" :
                    "bg-purple-500/20 text-purple-400"
                  }`}>
                    {GOODS_KIND_LABELS[g.kind] ?? g.kind}
                  </span>
                  {alreadyAdded && (
                    <span className="text-xs text-[#858585]">已添加</span>
                  )}
                </button>
              );
            })
          )}
        </div>

        <div className="px-4 py-3 border-t border-widget-border flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm text-[#cccccc] hover:bg-[#3c3c3c] rounded"
          >
            关闭
          </button>
        </div>
      </div>
    </div>
  );
}

// ========== 商品列表行 ==========
function ShopItemRow({
  item,
  index,
  numberValid,
  buyPercent,
  gameId,
  gameSlug,
  goodsMap,
  onUpdate,
  onRemove,
}: {
  item: ShopItem;
  index: number;
  numberValid: boolean;
  buyPercent: number;
  gameId: string;
  gameSlug?: string;
  goodsMap: Map<string, GoodsInfo>;
  onUpdate: (index: number, updated: ShopItem) => void;
  onRemove: (index: number) => void;
}) {
  const goodsInfo = goodsMap.get(item.goodsKey.toLowerCase());
  const autoPrice = goodsInfo ? calcGoodsCostRaw(goodsInfo) : 0;
  const hasCustomPrice = (item.price ?? 0) > 0;
  const basePrice = hasCustomPrice ? item.price : (goodsInfo ? getGoodsCost(goodsInfo).cost : 0);
  const shopPrice = Math.floor(basePrice * buyPercent / 100);

  return (
    <div className="flex items-center gap-3 px-4 py-3 bg-[#2a2d2e] rounded-lg group">
      <span className="text-[#858585] text-sm font-mono w-6 text-center">{index + 1}</span>
      <LazyAsfIcon iconPath={goodsInfo?.icon} gameSlug={gameSlug} size={28} prefix="asf/goods/" fallback="📦" />
      <div className="flex-1 min-w-0">
        <div className="text-sm text-white truncate">
          {goodsInfo?.name ?? <span className="text-[#858585] italic">未知物品</span>}
        </div>
        <div className="text-xs text-[#858585] truncate">{item.goodsKey}</div>
      </div>
      {/* 价格编辑 */}
      <div className="flex items-center gap-2 min-w-[180px] justify-end">
        <label className="text-xs text-[#858585]">💰</label>
        <input
          type="number"
          value={(item.price ?? 0) || ""}
          onChange={e => {
            const v = parseInt(e.target.value, 10);
            onUpdate(index, { ...item, price: Number.isNaN(v) ? 0 : Math.max(0, v) });
          }}
          placeholder={String(autoPrice)}
          className="w-20 px-2 py-1 bg-[#1e1e1e] border border-widget-border rounded text-white text-sm text-center focus:outline-none focus:border-focus-border placeholder:text-[#555]"
          title={hasCustomPrice ? `自定义价格 (自动价: ${autoPrice})` : "留空则按属性自动计算"}
        />
        {buyPercent !== 100 && (
          <span className="text-xs text-yellow-400 font-mono" title={`原价 ${basePrice} × ${buyPercent}%`}>
            ={shopPrice}
          </span>
        )}
        {!hasCustomPrice && (
          <span className="text-[10px] text-[#666]" title="由属性自动计算">(自动)</span>
        )}
      </div>
      {numberValid && (
        <div className="flex items-center gap-2">
          <label className="text-xs text-[#858585]">数量:</label>
          <input
            type="number"
            value={item.count}
            onChange={e => onUpdate(index, { ...item, count: parseInt(e.target.value, 10) || 0 })}
            className="w-16 px-2 py-1 bg-[#1e1e1e] border border-widget-border rounded text-white text-sm text-center focus:outline-none focus:border-focus-border"
          />
        </div>
      )}
      {goodsInfo && (
        <span className={`text-xs px-2 py-0.5 rounded ${
          goodsInfo.kind === "Consumable" ? "bg-green-500/20 text-green-400" :
          goodsInfo.kind === "Equipment" ? "bg-blue-500/20 text-blue-400" :
          "bg-purple-500/20 text-purple-400"
        }`}>
          {GOODS_KIND_LABELS[goodsInfo.kind] ?? goodsInfo.kind}
        </span>
      )}
      <button
        type="button"
        onClick={() => onRemove(index)}
        className="p-1 text-[#858585] hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
        title="移除"
      >
        ✕
      </button>
    </div>
  );
}

// ========== 商店列表页（空白欢迎页） ==========
export function ShopsListPage() {
  return (
    <EditorEmptyState
      icon="🏪"
      title="商店编辑器"
      description="从左侧列表选择一个商店进行编辑，或创建新的商店"
    />
  );
}

// ========== 商店详情编辑页 ==========
export function ShopDetailPage() {
  const { gameId: gameSlug, shopId } = useParams();
  const navigate = useNavigate();
  const { currentGame, editCache } = useDashboard();
  const toast = useToast();
  const gameId = currentGame?.id;
  const isNew = shopId === "new";
  const utils = trpc.useUtils();

  // 查询商店数据
  const { data: shopData, isLoading } = trpc.shop.get.useQuery(
    { id: shopId!, gameId: gameId! },
    { enabled: !!gameId && !!shopId && !isNew }
  );

  // 查询物品列表（用于名称/图标查找）
  const { data: goodsList } = trpc.goods.list.useQuery(
    { gameId: gameId! },
    { enabled: !!gameId }
  );

  // 构建 key→info 映射（避免每个 ShopItemRow 独立查询）
  const goodsMap = useMemo(() => {
    const m = new Map<string, GoodsInfo>();
    if (goodsList) {
      for (const g of goodsList) {
        m.set(g.key.toLowerCase(), {
          name: g.name,
          kind: g.kind,
          icon: g.icon,
          cost: g.cost,
          life: g.life,
          thew: g.thew,
          mana: g.mana,
          lifeMax: g.lifeMax,
          thewMax: g.thewMax,
          manaMax: g.manaMax,
          attack: g.attack,
          defend: g.defend,
          evade: g.evade,
          effectType: g.effectType,
        });
      }
    }
    return m;
  }, [goodsList]);

  // 表单状态
  const cacheKey = `shop-${shopId}`;
  const [formData, setFormData] = useState<Partial<Shop>>(() => {
    const cached = editCache.get<Partial<Shop>>(cacheKey);
    if (cached) return cached;
    if (isNew && gameId) return createDefaultShop(gameId);
    return {};
  });

  // 当数据加载完成后初始化表单
  useEffect(() => {
    if (shopData && !editCache.has(cacheKey)) {
      setFormData(shopData);
    }
  }, [shopData, cacheKey, editCache]);

  // 更新字段
  const updateField = useCallback((field: string, value: unknown) => {
    setFormData(prev => {
      const next = { ...prev, [field]: value };
      editCache.set(cacheKey, next);
      return next;
    });
  }, [cacheKey, editCache]);

  // 更新商品列表
  const updateItems = useCallback((items: ShopItem[]) => {
    updateField("items", items);
  }, [updateField]);

  // 物品选择器弹窗
  const [showGoodsPicker, setShowGoodsPicker] = useState(false);

  const existingGoodsKeys = useMemo(() => {
    return new Set((formData.items ?? []).map(i => i.goodsKey.toLowerCase()));
  }, [formData.items]);

  const handleAddGoods = (goodsKey: string, _goodsName: string) => {
    const items = [...(formData.items ?? [])];
    items.push({
      goodsKey: goodsKey.toLowerCase(),
      count: formData.numberValid ? 1 : -1,
      price: 0,
    });
    updateItems(items);
    setShowGoodsPicker(false);
  };

  const handleUpdateItem = (index: number, updated: ShopItem) => {
    const items = [...(formData.items ?? [])];
    items[index] = updated;
    updateItems(items);
  };

  const handleRemoveItem = (index: number) => {
    const items = [...(formData.items ?? [])];
    items.splice(index, 1);
    updateItems(items);
  };

  // Mutations
  const createMutation = trpc.shop.create.useMutation({
    onSuccess: (data) => {
      toast.success("商店创建成功");
      editCache.remove(cacheKey);
      utils.shop.list.invalidate();
      navigate(`/dashboard/${gameSlug}/shops/${data.id}`, { replace: true });
    },
    onError: (err) => toast.error(`创建失败: ${err.message}`),
  });

  const updateMutation = trpc.shop.update.useMutation({
    onSuccess: () => {
      toast.success("保存成功");
      editCache.remove(cacheKey);
      utils.shop.list.invalidate();
      utils.shop.get.invalidate({ id: shopId!, gameId: gameId! });
    },
    onError: (err) => toast.error(`保存失败: ${err.message}`),
  });

  const deleteMutation = trpc.shop.delete.useMutation({
    onSuccess: () => {
      toast.success("删除成功");
      editCache.remove(cacheKey);
      utils.shop.list.invalidate();
      navigate(`/dashboard/${gameSlug}/shops`, { replace: true });
    },
    onError: (err) => toast.error(`删除失败: ${err.message}`),
  });

  const handleSave = () => {
    if (!gameId) return;

    if (isNew) {
      createMutation.mutate({
        gameId,
        key: formData.key ?? `shop_${Date.now()}.ini`,
        name: formData.name ?? "新商店",
        numberValid: formData.numberValid,
        buyPercent: formData.buyPercent,
        recyclePercent: formData.recyclePercent,
        items: formData.items,
      });
    } else {
      updateMutation.mutate({
        id: shopId!,
        gameId,
        ...formData,
      });
    }
  };

  const handleDelete = () => {
    if (!gameId || !shopId || isNew) return;
    if (confirm("确定要删除这个商店吗？")) {
      deleteMutation.mutate({ id: shopId, gameId });
    }
  };

  const isSaving = createMutation.isPending || updateMutation.isPending;
  const basePath = `/dashboard/${gameSlug}/shops`;

  if (isLoading && !isNew) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-[#858585]">加载中...</div>
      </div>
    );
  }

  return (
    <DetailPageLayout
      backPath={basePath}
      title={isNew ? "新建商店" : formData.name || "商店详情"}
      subtitle={
        <>
          🏪 商店配置
          {formData.key && <span className="ml-2 text-[#666]">({formData.key})</span>}
        </>
      }
      onSave={handleSave}
      isSaving={isSaving}
      onDelete={!isNew ? handleDelete : undefined}
      isDeleting={deleteMutation.isPending}
      contentMaxWidth="max-w-4xl"
    >
          {/* 基本信息 */}
          <section className="bg-[#252526] border border-widget-border rounded-lg p-5 mb-6">
            <h2 className="text-base font-medium text-[#bbbbbb] mb-4 flex items-center gap-2">
              📝 基本信息
            </h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-[#858585] mb-1">商店名称</label>
                <input
                  type="text"
                  value={formData.name ?? ""}
                  onChange={e => updateField("name", e.target.value)}
                  placeholder="例如：低级药品"
                  className="w-full px-3 py-2 bg-[#1e1e1e] border border-widget-border rounded text-white text-sm focus:outline-none focus:border-focus-border"
                />
              </div>
              <div>
                <label className="block text-sm text-[#858585] mb-1">标识符 (Key)</label>
                <input
                  type="text"
                  value={formData.key ?? ""}
                  onChange={e => updateField("key", e.target.value)}
                  placeholder="例如：低级药品.ini"
                  disabled={!isNew}
                  className="w-full px-3 py-2 bg-[#1e1e1e] border border-widget-border rounded text-white text-sm focus:outline-none focus:border-focus-border disabled:opacity-50"
                />
              </div>
            </div>
          </section>

          {/* 商店配置 */}
          <section className="bg-[#252526] border border-widget-border rounded-lg p-5 mb-6">
            <h2 className="text-base font-medium text-[#bbbbbb] mb-4 flex items-center gap-2">
              ⚙️ 商店配置
            </h2>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm text-[#858585] mb-1">购买价格百分比</label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    value={formData.buyPercent ?? 100}
                    onChange={e => updateField("buyPercent", parseInt(e.target.value, 10) || 100)}
                    min={0}
                    max={1000}
                    className="flex-1 px-3 py-2 bg-[#1e1e1e] border border-widget-border rounded text-white text-sm focus:outline-none focus:border-focus-border"
                  />
                  <span className="text-sm text-[#858585]">%</span>
                </div>
                <p className="text-xs text-[#666] mt-1">100=原价, 50=半折, 200=两倍</p>
              </div>
              <div>
                <label className="block text-sm text-[#858585] mb-1">回收价格百分比</label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    value={formData.recyclePercent ?? 100}
                    onChange={e => updateField("recyclePercent", parseInt(e.target.value, 10) || 100)}
                    min={0}
                    max={1000}
                    className="flex-1 px-3 py-2 bg-[#1e1e1e] border border-widget-border rounded text-white text-sm focus:outline-none focus:border-focus-border"
                  />
                  <span className="text-sm text-[#858585]">%</span>
                </div>
                <p className="text-xs text-[#666] mt-1">卖给商店时的价格比例</p>
              </div>
              <div>
                <label className="block text-sm text-[#858585] mb-1">限制购买数量</label>
                <button
                  type="button"
                  onClick={() => updateField("numberValid", !formData.numberValid)}
                  className={`w-full px-3 py-2 rounded text-sm border transition-colors ${
                    formData.numberValid
                      ? "bg-[#094771] border-[#0098ff] text-[#0098ff]"
                      : "bg-[#1e1e1e] border-widget-border text-[#858585]"
                  }`}
                >
                  {formData.numberValid ? "✓ 限制数量" : "✗ 不限数量"}
                </button>
                <p className="text-xs text-[#666] mt-1">开启后可设置每种物品的库存</p>
              </div>
            </div>
          </section>

          {/* 商品列表 */}
          <section className="bg-[#252526] border border-widget-border rounded-lg p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-medium text-[#bbbbbb] flex items-center gap-2">
                📦 商品列表
                <span className="text-sm text-[#666] font-normal">({(formData.items ?? []).length} 件)</span>
              </h2>
              <button
                type="button"
                onClick={() => setShowGoodsPicker(true)}
                className="flex items-center gap-1 px-3 py-1.5 text-sm bg-[#0e639c] hover:bg-[#1177bb] text-white rounded transition-colors"
              >
                + 添加商品
              </button>
            </div>

            {(formData.items ?? []).length === 0 ? (
              <div className="text-center py-8 text-sm text-[#858585]">
                <div className="text-4xl mb-3">📦</div>
                <p>暂无商品</p>
                <p className="text-xs mt-1">点击"添加商品"从物品库中选择</p>
              </div>
            ) : (
              <div className="space-y-2">
                {(formData.items ?? []).map((item, index) => (
                  <ShopItemRow
                    key={`${item.goodsKey}-${index}`}
                    item={item}
                    index={index}
                    numberValid={formData.numberValid ?? false}
                    buyPercent={formData.buyPercent ?? 100}
                    gameId={gameId!}
                    gameSlug={currentGame?.slug}
                    goodsMap={goodsMap}
                    onUpdate={handleUpdateItem}
                    onRemove={handleRemoveItem}
                  />
                ))}
              </div>
            )}
          </section>

      {/* 物品选择器弹窗 */}
      {showGoodsPicker && gameId && (
        <GoodsPickerModal
          gameId={gameId}
          gameSlug={currentGame?.slug}
          existingKeys={existingGoodsKeys}
          onSelect={handleAddGoods}
          onClose={() => setShowGoodsPicker(false)}
        />
      )}
    </DetailPageLayout>
  );
}
