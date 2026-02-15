/**
 * 商店编辑页面
 */

import { trpc } from "@miu2d/shared";
import type { GoodKind, Shop, ShopItem } from "@miu2d/types";
import { createDefaultShop } from "@miu2d/types";
import { useCallback, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { FormNumberField, FormSection, FormTextField } from "../components/common";
import { LazyAsfIcon } from "../components/common/LazyAsfIcon";
import { DetailPageLayout } from "../components/DetailPageLayout";
import { EditorEmptyState } from "../components/EditorEmptyState";
import { useDashboard } from "../DashboardContext";
import { EntityLoadingState, useEntityEditor } from "../hooks";

/**
 * 自动计算物品价格（与引擎 Good.costRaw 一致）
 * 消耗品: (thew*4 + life*2 + mana*2) * (1 + hasEffect)
 * 装备: (attack*20 + defend*20 + evade*40 + lifeMax*2 + thewMax*3 + manaMax*2) * (1 + hasEffect)
 */
function calcGoodsCostRaw(info: GoodsInfo): number {
  const hasEffect = (info.effectType ?? 0) !== 0 ? 1 : 0;
  if (info.kind === "Drug") {
    return ((info.thew ?? 0) * 4 + (info.life ?? 0) * 2 + (info.mana ?? 0) * 2) * (1 + hasEffect);
  }
  if (info.kind === "Equipment") {
    return (
      ((info.attack ?? 0) * 20 +
        (info.defend ?? 0) * 20 +
        (info.evade ?? 0) * 40 +
        (info.lifeMax ?? 0) * 2 +
        (info.thewMax ?? 0) * 3 +
        (info.manaMax ?? 0) * 2) *
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
  kind: GoodKind;
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
  Drug: "消耗品",
  Equipment: "装备",
  Event: "任务道具",
};

const GOODS_KIND_ICONS: Record<string, string> = {
  Drug: "🍵",
  Equipment: "⚔️",
  Event: "📜",
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
    return goodsList.filter((g) => {
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
    if (!goodsList) return { All: 0, Drug: 0, Equipment: 0, Event: 0 };
    const counts = { All: goodsList.length, Drug: 0, Equipment: 0, Event: 0 };
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
            onChange={(e) => setSearch(e.target.value)}
            placeholder="搜索物品名称或标识..."
            className="w-full px-3 py-2 bg-[#1e1e1e] border border-widget-border rounded text-white text-sm focus:outline-none focus:border-focus-border"
          />
        </div>

        {/* 分类 Tabs */}
        <div className="flex gap-1 px-4 py-2 border-b border-widget-border">
          {(["All", "Drug", "Equipment", "Event"] as const).map((kind) => (
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
            filteredGoods.map((g) => {
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
                  <LazyAsfIcon
                    iconPath={g.icon}
                    gameSlug={gameSlug}
                    size={28}
                    prefix="asf/goods/"
                    fallback="📦"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-white truncate">{g.name}</div>
                    <div className="text-xs text-[#858585] truncate">{g.key}</div>
                  </div>
                  <span
                    className={`text-xs px-2 py-0.5 rounded ${
                      g.kind === "Drug"
                        ? "bg-green-500/20 text-green-400"
                        : g.kind === "Equipment"
                          ? "bg-blue-500/20 text-blue-400"
                          : "bg-purple-500/20 text-purple-400"
                    }`}
                  >
                    {GOODS_KIND_LABELS[g.kind] ?? g.kind}
                  </span>
                  {alreadyAdded && <span className="text-xs text-[#858585]">已添加</span>}
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
  const basePrice = hasCustomPrice ? item.price : goodsInfo ? getGoodsCost(goodsInfo).cost : 0;
  const shopPrice = Math.floor((basePrice * buyPercent) / 100);

  return (
    <div className="flex items-center gap-3 px-4 py-3 bg-[#2a2d2e] rounded-lg group">
      <span className="text-[#858585] text-sm font-mono w-6 text-center">{index + 1}</span>
      <LazyAsfIcon
        iconPath={goodsInfo?.icon}
        gameSlug={gameSlug}
        size={28}
        prefix="asf/goods/"
        fallback="📦"
      />
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
          onChange={(e) => {
            const v = parseInt(e.target.value, 10);
            onUpdate(index, { ...item, price: Number.isNaN(v) ? 0 : Math.max(0, v) });
          }}
          placeholder={String(autoPrice)}
          className="w-20 px-2 py-1 bg-[#1e1e1e] border border-widget-border rounded text-white text-sm text-center focus:outline-none focus:border-focus-border placeholder:text-[#555]"
          title={hasCustomPrice ? `自定义价格 (自动价: ${autoPrice})` : "留空则按属性自动计算"}
        />
        {buyPercent !== 100 && (
          <span
            className="text-xs text-yellow-400 font-mono"
            title={`原价 ${basePrice} × ${buyPercent}%`}
          >
            ={shopPrice}
          </span>
        )}
        {!hasCustomPrice && (
          <span className="text-[10px] text-[#666]" title="由属性自动计算">
            (自动)
          </span>
        )}
      </div>
      {numberValid && (
        <div className="flex items-center gap-2">
          <label className="text-xs text-[#858585]">数量:</label>
          <input
            type="number"
            value={item.count}
            onChange={(e) => onUpdate(index, { ...item, count: parseInt(e.target.value, 10) || 0 })}
            className="w-16 px-2 py-1 bg-[#1e1e1e] border border-widget-border rounded text-white text-sm text-center focus:outline-none focus:border-focus-border"
          />
        </div>
      )}
      {goodsInfo && (
        <span
          className={`text-xs px-2 py-0.5 rounded ${
            goodsInfo.kind === "Drug"
              ? "bg-green-500/20 text-green-400"
              : goodsInfo.kind === "Equipment"
                ? "bg-blue-500/20 text-blue-400"
                : "bg-purple-500/20 text-purple-400"
          }`}
        >
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
  const { currentGame } = useDashboard();
  const gameId = currentGame?.id;

  // 查询商店数据
  const { data: shopData, isLoading } = trpc.shop.get.useQuery(
    { id: shopId!, gameId: gameId! },
    { enabled: !!gameId && !!shopId && shopId !== "new" }
  );

  // 编辑器 Hook（无 Tab）
  const editor = useEntityEditor<Shop>({
    entityType: "shop",
    paramKey: "shopId",
    basePath: (slug) => `/dashboard/${slug}/shops`,
    createDefault: (gId) => createDefaultShop(gId),
    entityLabel: "商店",
    serverData: shopData,
    isQueryLoading: isLoading,
  });

  const { formData, updateField, isNew, basePath, utils } = editor;

  // 查询物品列表（用于名称/图标查找）
  const { data: goodsList } = trpc.goods.list.useQuery({ gameId: gameId! }, { enabled: !!gameId });

  // 构建 key→info 映射
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

  // 物品管理
  const [showGoodsPicker, setShowGoodsPicker] = useState(false);

  const existingGoodsKeys = useMemo(
    () => new Set((formData.items ?? []).map((i) => i.goodsKey.toLowerCase())),
    [formData.items]
  );

  const updateItems = useCallback(
    (items: ShopItem[]) => updateField("items", items),
    [updateField]
  );

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
      editor.onCreateSuccess(data.id);
      utils.shop.list.invalidate();
    },
  });

  const updateMutation = trpc.shop.update.useMutation({
    onSuccess: () => {
      editor.onUpdateSuccess();
      utils.shop.list.invalidate();
      utils.shop.get.invalidate({ id: shopId!, gameId: gameId! });
    },
  });

  const deleteMutation = trpc.shop.delete.useMutation({
    onSuccess: () => {
      editor.onDeleteSuccess();
      if (gameId) utils.shop.list.invalidate();
    },
  });

  const handleSave = useCallback(() => {
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
      updateMutation.mutate({ id: shopId!, gameId, ...formData });
    }
  }, [gameId, shopId, isNew, formData, createMutation, updateMutation]);

  const handleDelete = useCallback(() => {
    if (gameId && shopId && !isNew) {
      deleteMutation.mutate({ id: shopId, gameId });
    }
  }, [gameId, shopId, isNew, deleteMutation]);

  if (editor.isLoading) return <EntityLoadingState />;

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
      isSaving={createMutation.isPending || updateMutation.isPending}
      onDelete={!isNew ? handleDelete : undefined}
      isDeleting={deleteMutation.isPending}
      contentMaxWidth="max-w-4xl"
    >
      {/* 基本信息 */}
      <FormSection icon="📝" title="基本信息">
        <FormTextField<Shop>
          label="商店名称"
          field="name"
          value={formData}
          onChange={updateField}
          placeholder="例如：低级药品"
        />
        <FormTextField<Shop>
          label="标识符 (Key)"
          field="key"
          value={formData}
          onChange={updateField}
          placeholder="例如：低级药品.ini"
          disabled={!isNew}
        />
      </FormSection>

      {/* 商店配置 */}
      <FormSection icon="⚙️" title="商店配置" cols={3}>
        <FormNumberField<Shop>
          label="购买价格 (%)"
          field="buyPercent"
          value={formData}
          onChange={updateField}
          min={0}
          max={1000}
          hint="100=原价, 200=两倍"
        />
        <FormNumberField<Shop>
          label="回收价格 (%)"
          field="recyclePercent"
          value={formData}
          onChange={updateField}
          min={0}
          max={1000}
          hint="卖给商店时"
        />
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
      </FormSection>

      {/* 商品列表 */}
      <FormSection
        icon="📦"
        title="商品列表"
        extra={
          <>
            <span className="text-sm text-[#666] font-normal">
              ({(formData.items ?? []).length} 件)
            </span>
            <button
              type="button"
              onClick={() => setShowGoodsPicker(true)}
              className="flex items-center gap-1 px-3 py-1.5 text-sm bg-[#0e639c] hover:bg-[#1177bb] text-white rounded transition-colors ml-auto"
            >
              + 添加商品
            </button>
          </>
        }
        cols={1}
        contentClassName="p-4"
      >
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
      </FormSection>

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
