/**
 * 物品编辑页面 - 完整实现
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { NumberInput } from "@/components/common";
import { trpc } from "../../../../lib/trpc";
import { useToast } from "../../../../contexts/ToastContext";
import { DetailPageLayout } from "../../components/DetailPageLayout";
import { EditorEmptyState } from "../../components/EditorEmptyState";
import { useDashboard } from "../../DashboardContext";
import { buildGoodsImageUrl } from "../../utils";
import { getFrameCanvas } from "@miu2d/engine/resource/format/asf";
import { decodeAsfWasm, initWasm } from "@miu2d/engine/wasm";
import type {
  Goods,
  GoodsKind,
  GoodsPart,
} from "@miu2d/types";
import {
  GoodsKindLabels,
  GoodsPartLabels,
  GoodsEffectTypeLabels,
  getEffectTypeOptions,
  getActualEffectType,
  getVisibleFieldsByKind,
  createDefaultGoods,
} from "@miu2d/types";

// ========== ASF 图像加载 Hook（Dashboard 专用）==========

interface DashboardAsfImage {
  dataUrl: string | null;
  width: number;
  height: number;
  isLoading: boolean;
}

/**
 * Dashboard 专用的 ASF 图像加载 Hook
 * 直接使用 /game/{gameSlug}/resources/ 路径
 */
function useDashboardAsfImage(
  gameSlug: string | undefined,
  url: string | null
): DashboardAsfImage {
  const [state, setState] = useState<DashboardAsfImage>({
    dataUrl: null,
    width: 0,
    height: 0,
    isLoading: false,
  });

  useEffect(() => {
    if (!gameSlug || !url) {
      setState({ dataUrl: null, width: 0, height: 0, isLoading: false });
      return;
    }

    let cancelled = false;
    setState((prev) => ({ ...prev, isLoading: true }));

    (async () => {
      try {
        await initWasm();
        const response = await fetch(url);
        if (!response.ok || cancelled) return;

        const buffer = await response.arrayBuffer();
        if (cancelled) return;

        const asfData = decodeAsfWasm(buffer);
        if (!asfData || asfData.frames.length === 0 || cancelled) return;

        const canvas = getFrameCanvas(asfData.frames[0]);
        const dataUrl = canvas.toDataURL();

        if (!cancelled) {
          setState({
            dataUrl,
            width: asfData.width,
            height: asfData.height,
            isLoading: false,
          });
        }
      } catch {
        if (!cancelled) {
          setState((prev) => ({ ...prev, isLoading: false }));
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [gameSlug, url]);

  return state;
}

// ========== 游戏风格物品预览组件 ==========

interface GoodsPreviewProps {
  goods: Partial<Goods>;
  gameSlug: string | undefined;
}

/**
 * 物品预览卡片 - 现代风格
 */
function GoodsPreview({ goods, gameSlug }: GoodsPreviewProps) {
  // 构建资源 URL
  const itemImageUrl = gameSlug ? buildGoodsImageUrl(gameSlug, goods.image) : null;

  // 加载物品图片
  const itemImage = useDashboardAsfImage(gameSlug, itemImageUrl);

  // 计算属性效果列表
  const attributes = useMemo(() => {
    const attrs: Array<{ label: string; value: number; color: string }> = [];
    if (goods.life) attrs.push({ label: "命", value: goods.life, color: "#ef4444" });
    if (goods.thew) attrs.push({ label: "体", value: goods.thew, color: "#f59e0b" });
    if (goods.mana) attrs.push({ label: "气", value: goods.mana, color: "#3b82f6" });
    if (goods.attack) attrs.push({ label: "攻", value: goods.attack, color: "#ef4444" });
    if (goods.defend) attrs.push({ label: "防", value: goods.defend, color: "#22c55e" });
    if (goods.evade) attrs.push({ label: "捷", value: goods.evade, color: "#a855f7" });
    if (goods.lifeMax) attrs.push({ label: "命上限", value: goods.lifeMax, color: "#ef4444" });
    if (goods.thewMax) attrs.push({ label: "体上限", value: goods.thewMax, color: "#f59e0b" });
    if (goods.manaMax) attrs.push({ label: "气上限", value: goods.manaMax, color: "#3b82f6" });
    return attrs;
  }, [goods]);

  // 特效文本
  const specialEffectText = useMemo(() => {
    if (goods.effectType && goods.effectType > 0) {
      const actualEffect = getActualEffectType(
        goods.kind || "Consumable",
        goods.part as GoodsPart,
        goods.effectType
      );
      if (actualEffect !== "None") {
        return GoodsEffectTypeLabels[actualEffect];
      }
    }
    return null;
  }, [goods.kind, goods.part, goods.effectType]);

  // 类型样式
  const kindStyle = useMemo(() => {
    switch (goods.kind) {
      case "Consumable":
        return { bg: "bg-emerald-500/20", text: "text-emerald-400", border: "border-emerald-500/30" };
      case "Equipment":
        return { bg: "bg-blue-500/20", text: "text-blue-400", border: "border-blue-500/30" };
      case "Quest":
        return { bg: "bg-amber-500/20", text: "text-amber-400", border: "border-amber-500/30" };
      default:
        return { bg: "bg-gray-500/20", text: "text-gray-400", border: "border-gray-500/30" };
    }
  }, [goods.kind]);

  return (
    <div className="w-full">
      <h3 className="text-sm font-medium text-[#888] mb-4 text-center">物品预览</h3>

      {/* 卡片容器 */}
      <div className="bg-[#1e1e1e] border border-panel-border rounded-lg overflow-hidden">
        {/* 物品图片区域 */}
        <div className="bg-gradient-to-b from-[#252525] to-[#1a1a1a] p-6 flex items-center justify-center min-h-[140px]">
          {itemImage.dataUrl ? (
            <img
              src={itemImage.dataUrl}
              alt={goods.name || "物品"}
              className="max-w-[120px] max-h-[120px]"
              style={{ imageRendering: "pixelated" }}
            />
          ) : (
            <div className="text-4xl text-[#444]">
              {itemImage.isLoading ? "⏳" : goods.image ? "❓" : "📦"}
            </div>
          )}
        </div>

        {/* 物品信息区域 */}
        <div className="p-4 space-y-3">
          {/* 名称和类型 */}
          <div className="flex items-center justify-between gap-2">
            <h4 className="text-lg font-bold text-white truncate">
              {goods.name || "未命名物品"}
            </h4>
            <span className={`px-2 py-0.5 rounded text-xs ${kindStyle.bg} ${kindStyle.text}`}>
              {GoodsKindLabels[goods.kind || "Consumable"]}
            </span>
          </div>

          {/* 装备部位 */}
          {goods.kind === "Equipment" && goods.part && (
            <div className="flex items-center gap-2 text-sm text-[#888]">
              <span className="text-[#666]">部位:</span>
              <span className="px-2 py-0.5 rounded bg-purple-500/20 text-purple-400 text-xs">
                {GoodsPartLabels[goods.part]}
              </span>
            </div>
          )}

          {/* 价格 */}
          <div className="flex items-center gap-2 text-sm">
            <span className="text-[#666]">价格:</span>
            <span className="text-amber-400 font-mono">
              {goods.cost ?? 0} 💰
            </span>
            {(goods.cost === null || goods.cost === undefined || goods.cost === 0) && (
              <span className="text-[#555] text-xs">(不可交易)</span>
            )}
          </div>

          {/* 属性加成 */}
          {attributes.length > 0 && (
            <div className="space-y-1.5">
              <div className="text-xs text-[#666] mb-1">属性加成</div>
              <div className="flex flex-wrap gap-2">
                {attributes.map((attr, i) => (
                  <span
                    key={i}
                    className="px-2 py-1 rounded bg-[#252525] text-xs font-mono"
                    style={{ color: attr.color }}
                  >
                    {attr.label} +{attr.value}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* 特殊效果 */}
          {specialEffectText && (
            <div className="flex items-center gap-2 text-sm">
              <span className="text-[#666]">特效:</span>
              <span className="text-green-400">✨ {specialEffectText}</span>
            </div>
          )}

          {/* 物品介绍 */}
          {goods.intro && (
            <div className="pt-2 border-t border-panel-border">
              <p className="text-sm text-[#aaa] leading-relaxed whitespace-pre-wrap">
                {goods.intro}
              </p>
            </div>
          )}

          {/* 任务物品脚本 */}
          {goods.kind === "Quest" && goods.script && (
            <div className="text-xs text-[#555] pt-2 border-t border-panel-border">
              📜 脚本: {goods.script}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ========== 列表页（欢迎页面） ==========

export function GoodsListPage() {
  return (
    <EditorEmptyState
      icon="📦"
      title="物品编辑"
      description={<>从左侧列表选择一个物品进行编辑，<br />或使用上方按钮创建新物品、导入 INI 文件。</>}
    />
  );
}

// ========== 详情页 ==========

export function GoodsDetailPage() {
  const { gameId: gameSlug, goodsId } = useParams<{ gameId: string; goodsId: string }>();
  const { currentGame, editCache } = useDashboard();
  const gameId = currentGame?.id;
  const navigate = useNavigate();
  const utils = trpc.useUtils();
  const basePath = `/dashboard/${gameSlug}/goods`;
  const isNew = goodsId === "new";

  // 缓存 key
  const cacheKey = goodsId ? `goods:${goodsId}` : null;

  // URL 参数获取类型
  const searchParams = new URLSearchParams(window.location.search);
  const kindParam = searchParams.get("kind") as GoodsKind | null;

  // 查询物品详情
  const { data: goods, isLoading } = trpc.goods.get.useQuery(
    { gameId: gameId!, id: goodsId! },
    { enabled: !!gameId && !!goodsId && !isNew }
  );

  // 表单状态
  const [formData, setFormData] = useState<Partial<Goods>>({});

  // 当 goodsId 变化时，重置表单状态
  useEffect(() => {
    if (!cacheKey) return;

    // 优先从缓存读取
    if (editCache.has(cacheKey)) {
      setFormData(editCache.get<Partial<Goods>>(cacheKey) || {});
    } else if (isNew && gameId) {
      // 新建时初始化
      setFormData(createDefaultGoods(gameId, kindParam || "Consumable") as Partial<Goods>);
    } else {
      // 等待查询数据
      setFormData({});
    }
  }, [cacheKey, isNew, gameId, kindParam, editCache]);

  // 加载数据后更新表单（当表单为空且有查询数据时）
  useEffect(() => {
    if (goods && Object.keys(formData).length === 0) {
      setFormData(goods);
    }
  }, [goods, formData]);

  // 同步表单数据到缓存
  useEffect(() => {
    if (cacheKey && Object.keys(formData).length > 0) {
      editCache.set(cacheKey, formData);
    }
  }, [cacheKey, formData, editCache]);

  const toast = useToast();

  // 保存物品
  const createMutation = trpc.goods.create.useMutation({
    onSuccess: (data) => {
      if (cacheKey) {
        editCache.remove(cacheKey);
      }
      // 刷新左侧物品列表
      if (gameId) {
        utils.goods.list.invalidate({ gameId });
      }
      toast.success(`物品「${formData.name || '新物品'}」创建成功`);
      navigate(`${basePath}/${data.id}`);
    },
  });

  const updateMutation = trpc.goods.update.useMutation({
    onSuccess: () => {
      if (cacheKey) {
        editCache.remove(cacheKey);
      }
      utils.goods.list.invalidate({ gameId: gameId! });
      utils.goods.get.invalidate({ gameId: gameId!, id: goodsId! });
      toast.success(`物品「${formData.name}」保存成功`);
    },
  });

  const deleteMutation = trpc.goods.delete.useMutation({
    onSuccess: () => {
      if (cacheKey) {
        editCache.remove(cacheKey);
      }
      // 刷新左侧物品列表
      if (gameId) {
        utils.goods.list.invalidate({ gameId });
      }
      toast.success(`物品已删除`);
      navigate(basePath);
    },
  });

  // 根据 Kind 获取可见字段
  const visibleFields = useMemo(() => {
    return new Set(getVisibleFieldsByKind(formData.kind || "Consumable"));
  }, [formData.kind]);

  const handleSave = useCallback(() => {
    if (!gameId) return;

    if (isNew) {
      createMutation.mutate({
        gameId,
        kind: formData.kind || "Consumable",
        key: formData.key || `goods_${Date.now()}`,
        name: formData.name || "新物品",
        intro: formData.intro,
      });
    } else if (goodsId) {
      updateMutation.mutate({
        ...formData,
        id: goodsId,
        gameId,
      } as Goods);
    }
  }, [gameId, goodsId, isNew, formData, createMutation, updateMutation]);

  const handleDelete = useCallback(() => {
    if (gameId && goodsId && !isNew) {
      deleteMutation.mutate({ id: goodsId, gameId });
    }
  }, [gameId, goodsId, isNew, deleteMutation]);

  const updateField = useCallback(<K extends keyof Goods>(key: K, value: Goods[K]) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
  }, []);

  if (isLoading && !isNew) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-[#858585]">加载中...</div>
      </div>
    );
  }

  return (
    <DetailPageLayout
      backPath={basePath}
      title={isNew ? "新建物品" : formData.name || "物品详情"}
      subtitle={
        <>
          {GoodsKindLabels[formData.kind || "Consumable"]}
          {formData.key && <span className="ml-2 text-[#666]">({formData.key})</span>}
        </>
      }
      onSave={handleSave}
      isSaving={createMutation.isPending || updateMutation.isPending}
      onDelete={!isNew ? handleDelete : undefined}
      isDeleting={deleteMutation.isPending}
      contentMaxWidth="max-w-3xl"
      sidePanel={
        <div className="flex-shrink-0 w-[420px]">
          <div className="sticky top-0 bg-[#252526] border border-widget-border rounded-xl p-6">
            <GoodsPreview goods={formData} gameSlug={gameSlug} />
          </div>
        </div>
      }
    >
          {/* 基本信息 */}
          <section className="bg-[#252526] border border-widget-border rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-widget-border">
              <h2 className="text-sm font-medium text-[#cccccc]">📝 基本信息</h2>
            </div>
            <div className="p-4 grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-[#858585] mb-1">物品类型</label>
                <select
                  value={formData.kind || "Consumable"}
                  onChange={(e) => updateField("kind", e.target.value as GoodsKind)}
                  className="w-full px-3 py-2 bg-[#1e1e1e] border border-widget-border rounded-lg text-white focus:outline-none focus:border-focus-border"
                >
                  {Object.entries(GoodsKindLabels).map(([key, label]) => (
                    <option key={key} value={key}>{label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm text-[#858585] mb-1">物品名称</label>
                <input
                  type="text"
                  value={formData.name || ""}
                  onChange={(e) => updateField("name", e.target.value)}
                  className="w-full px-3 py-2 bg-[#1e1e1e] border border-widget-border rounded-lg text-white focus:outline-none focus:border-focus-border"
                />
              </div>

              <div>
                <label className="block text-sm text-[#858585] mb-1">标识符 (Key)</label>
                <input
                  type="text"
                  value={formData.key || ""}
                  onChange={(e) => updateField("key", e.target.value)}
                  placeholder="例如: goods-m00-金花.ini"
                  className="w-full px-3 py-2 bg-[#1e1e1e] border border-widget-border rounded-lg text-white focus:outline-none focus:border-focus-border"
                />
              </div>

              <div>
                <label className="block text-sm text-[#858585] mb-1">价格</label>
                <NumberInput
                  value={formData.cost ?? null}
                  onChange={(val) => updateField("cost", val)}
                  allowEmpty
                  className="w-full"
                />
              </div>

              <div className="col-span-2">
                <label className="block text-sm text-[#858585] mb-1">物品介绍</label>
                <textarea
                  rows={3}
                  value={formData.intro || ""}
                  onChange={(e) => updateField("intro", e.target.value)}
                  className="w-full px-3 py-2 bg-[#1e1e1e] border border-widget-border rounded-lg text-white focus:outline-none focus:border-focus-border resize-none"
                />
              </div>
            </div>
          </section>

          {/* 资源文件 */}
          <section className="bg-[#252526] border border-widget-border rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-widget-border">
              <h2 className="text-sm font-medium text-[#cccccc]">🎨 资源文件</h2>
            </div>
            <div className="p-4 grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-[#858585] mb-1">物品图像</label>
                <input
                  type="text"
                  value={formData.image || ""}
                  onChange={(e) => updateField("image", e.target.value || null)}
                  placeholder="例如: tm050-金葵花.asf"
                  className="w-full px-3 py-2 bg-[#1e1e1e] border border-widget-border rounded-lg text-white focus:outline-none focus:border-focus-border"
                />
              </div>
              <div>
                <label className="block text-sm text-[#858585] mb-1">物品图标</label>
                <input
                  type="text"
                  value={formData.icon || ""}
                  onChange={(e) => updateField("icon", e.target.value || null)}
                  placeholder="例如: tm050-金葵花s.asf"
                  className="w-full px-3 py-2 bg-[#1e1e1e] border border-widget-border rounded-lg text-white focus:outline-none focus:border-focus-border"
                />
              </div>
              <div>
                <label className="block text-sm text-[#858585] mb-1">特效资源</label>
                <input
                  type="text"
                  value={formData.effect || ""}
                  onChange={(e) => updateField("effect", e.target.value || null)}
                  className="w-full px-3 py-2 bg-[#1e1e1e] border border-widget-border rounded-lg text-white focus:outline-none focus:border-focus-border"
                />
              </div>
            </div>
          </section>

          {/* 消耗品属性 */}
          {formData.kind === "Consumable" && (
            <section className="bg-[#252526] border border-widget-border rounded-xl overflow-hidden">
              <div className="px-4 py-3 border-b border-widget-border">
                <h2 className="text-sm font-medium text-[#cccccc]">🍵 消耗效果</h2>
              </div>
              <div className="p-4 space-y-4">
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm text-[#858585] mb-1">恢复生命</label>
                    <NumberInput
                      value={formData.life ?? null}
                      onChange={(val) => updateField("life", val)}
                      allowEmpty
                      className="w-full"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-[#858585] mb-1">恢复体力</label>
                    <NumberInput
                      value={formData.thew ?? null}
                      onChange={(val) => updateField("thew", val)}
                      allowEmpty
                      className="w-full"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-[#858585] mb-1">恢复内力</label>
                    <NumberInput
                      value={formData.mana ?? null}
                      onChange={(val) => updateField("mana", val)}
                      allowEmpty
                      className="w-full"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm text-[#858585] mb-1">特殊效果</label>
                  <select
                    value={formData.effectType ?? 0}
                    onChange={(e) => updateField("effectType", parseInt(e.target.value, 10))}
                    className="w-full px-3 py-2 bg-[#1e1e1e] border border-widget-border rounded-lg text-white focus:outline-none focus:border-focus-border"
                  >
                    {getEffectTypeOptions("Consumable", null).map(({ value, label }) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                  </select>
                </div>
              </div>
            </section>
          )}

          {/* 装备属性 */}
          {formData.kind === "Equipment" && (
            <section className="bg-[#252526] border border-widget-border rounded-xl overflow-hidden">
              <div className="px-4 py-3 border-b border-widget-border">
                <h2 className="text-sm font-medium text-[#cccccc]">⚔️ 装备属性</h2>
              </div>
              <div className="p-4 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-[#858585] mb-1">装备部位</label>
                    <select
                      value={formData.part || "Hand"}
                      onChange={(e) => {
                        updateField("part", e.target.value as GoodsPart);
                        // 部位变化时，重置 effectType（因为可选项不同）
                        updateField("effectType", 0);
                      }}
                      className="w-full px-3 py-2 bg-[#1e1e1e] border border-widget-border rounded-lg text-white focus:outline-none focus:border-focus-border"
                    >
                      {Object.entries(GoodsPartLabels).map(([key, label]) => (
                        <option key={key} value={key}>{label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm text-[#858585] mb-1">特效类型</label>
                    <select
                      value={formData.effectType ?? 0}
                      onChange={(e) => updateField("effectType", parseInt(e.target.value, 10))}
                      className="w-full px-3 py-2 bg-[#1e1e1e] border border-widget-border rounded-lg text-white focus:outline-none focus:border-focus-border"
                    >
                      {getEffectTypeOptions("Equipment", formData.part as GoodsPart).map(({ value, label }) => (
                        <option key={value} value={value}>{label}</option>
                      ))}
                    </select>
                    {/* 显示实际效果 */}
                    {formData.effectType != null && formData.effectType > 0 && (
                      <p className="mt-1 text-xs text-[#6a9955]">
                        实际效果: {GoodsEffectTypeLabels[getActualEffectType("Equipment", formData.part as GoodsPart, formData.effectType)]}
                      </p>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm text-[#858585] mb-1">生命上限</label>
                    <NumberInput
                      value={formData.lifeMax ?? null}
                      onChange={(val) => updateField("lifeMax", val)}
                      allowEmpty
                      className="w-full"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-[#858585] mb-1">体力上限</label>
                    <NumberInput
                      value={formData.thewMax ?? null}
                      onChange={(val) => updateField("thewMax", val)}
                      allowEmpty
                      className="w-full"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-[#858585] mb-1">内力上限</label>
                    <NumberInput
                      value={formData.manaMax ?? null}
                      onChange={(val) => updateField("manaMax", val)}
                      allowEmpty
                      className="w-full"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm text-[#858585] mb-1">攻击力</label>
                    <NumberInput
                      value={formData.attack ?? null}
                      onChange={(val) => updateField("attack", val)}
                      allowEmpty
                      className="w-full"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-[#858585] mb-1">防御力</label>
                    <NumberInput
                      value={formData.defend ?? null}
                      onChange={(val) => updateField("defend", val)}
                      allowEmpty
                      className="w-full"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-[#858585] mb-1">闪避</label>
                    <NumberInput
                      value={formData.evade ?? null}
                      onChange={(val) => updateField("evade", val)}
                      allowEmpty
                      className="w-full"
                    />
                  </div>
                </div>
              </div>
            </section>
          )}

          {/* 任务道具属性 */}
          {formData.kind === "Quest" && (
            <section className="bg-[#252526] border border-widget-border rounded-xl overflow-hidden">
              <div className="px-4 py-3 border-b border-widget-border">
                <h2 className="text-sm font-medium text-[#cccccc]">📜 使用脚本</h2>
              </div>
              <div className="p-4">
                <div>
                  <label className="block text-sm text-[#858585] mb-1">脚本路径</label>
                  <input
                    type="text"
                    value={formData.script || ""}
                    onChange={(e) => updateField("script", e.target.value || null)}
                    placeholder="例如: Book00-太极剑谱.txt"
                    className="w-full px-3 py-2 bg-[#1e1e1e] border border-widget-border rounded-lg text-white focus:outline-none focus:border-focus-border"
                  />
                </div>
              </div>
            </section>
          )}
    </DetailPageLayout>
  );
}
