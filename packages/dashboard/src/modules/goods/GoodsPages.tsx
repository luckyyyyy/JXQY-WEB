/**
 * 物品编辑页面 - 完整实现
 */

import { getFrameCanvas } from "@miu2d/engine/resource/format/asf";
import { decodeAsfWasm, initWasm } from "@miu2d/engine/wasm";
import { trpc } from "@miu2d/shared";
import type { EquipPosition, Good, GoodKind } from "@miu2d/types";
import {
  createDefaultGood,
  EquipPositionLabels,
  GoodEffectTypeLabels,
  GoodKindLabels,
  getActualEffectType,
  getEffectTypeOptions,
} from "@miu2d/types";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import {
  FormNumberField,
  FormSection,
  FormSelectField,
  FormTextArea,
  FormTextField,
} from "../../components/common";
import { FieldGroupList } from "../../components/common/FieldGrid";
import { DetailPageLayout } from "../../components/DetailPageLayout";
import { EditorEmptyState } from "../../components/EditorEmptyState";
import { useDashboard } from "../../DashboardContext";
import { EntityLoadingState, useEntityEditor } from "../../hooks";
import { buildGoodsImageUrl } from "../../utils";
import { goodAdvancedGroups } from "./good-field-defs";

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
function useDashboardAsfImage(gameSlug: string | undefined, url: string | null): DashboardAsfImage {
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
  goods: Partial<Good>;
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
        goods.kind || "Drug",
        goods.part as EquipPosition,
        goods.effectType
      );
      if (actualEffect !== "None") {
        return GoodEffectTypeLabels[actualEffect];
      }
    }
    return null;
  }, [goods.kind, goods.part, goods.effectType]);

  // 类型样式
  const kindStyle = useMemo(() => {
    switch (goods.kind) {
      case "Drug":
        return {
          bg: "bg-emerald-500/20",
          text: "text-emerald-400",
          border: "border-emerald-500/30",
        };
      case "Equipment":
        return { bg: "bg-blue-500/20", text: "text-blue-400", border: "border-blue-500/30" };
      case "Event":
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
            <h4 className="text-lg font-bold text-white truncate">{goods.name || "未命名物品"}</h4>
            <span className={`px-2 py-0.5 rounded text-xs ${kindStyle.bg} ${kindStyle.text}`}>
              {GoodKindLabels[goods.kind || "Drug"]}
            </span>
          </div>

          {/* 装备部位 */}
          {goods.kind === "Equipment" && goods.part && (
            <div className="flex items-center gap-2 text-sm text-[#888]">
              <span className="text-[#666]">部位:</span>
              <span className="px-2 py-0.5 rounded bg-purple-500/20 text-purple-400 text-xs">
                {EquipPositionLabels[goods.part]}
              </span>
            </div>
          )}

          {/* 价格 */}
          <div className="flex items-center gap-2 text-sm">
            <span className="text-[#666]">价格:</span>
            <span className="text-amber-400 font-mono">{goods.cost ?? 0} 💰</span>
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
          {goods.kind === "Event" && goods.script && (
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
      description={
        <>
          从左侧列表选择一个物品进行编辑，
          <br />
          或使用上方按钮创建新物品、导入 INI 文件。
        </>
      }
    />
  );
}

// ========== 详情页 ==========

export function GoodsDetailPage() {
  // ── 查询 ──
  const { gameId: gameSlug, goodsId } = useParams<{ gameId: string; goodsId: string }>();
  const { currentGame } = useDashboard();
  const gameId = currentGame?.id;

  const { data: goods, isLoading } = trpc.goods.get.useQuery(
    { gameId: gameId!, id: goodsId! },
    { enabled: !!gameId && !!goodsId && goodsId !== "new" }
  );

  // ── 编辑器 Hook ──
  const editor = useEntityEditor<Good>({
    entityType: "goods",
    paramKey: "goodsId",
    basePath: (slug) => `/dashboard/${slug}/goods`,
    createDefault: (gId, sp) =>
      createDefaultGood(gId, (sp.get("kind") as GoodKind) || "Drug") as Partial<Good>,
    entityLabel: "物品",
    serverData: goods,
    isQueryLoading: isLoading,
  });

  const { formData, updateField, isNew, basePath, utils } = editor;

  // ── Mutations ──
  const createMutation = trpc.goods.create.useMutation({
    onSuccess: (data) => {
      editor.onCreateSuccess(data.id);
      utils.goods.list.invalidate({ gameId: gameId! });
    },
  });

  const updateMutation = trpc.goods.update.useMutation({
    onSuccess: () => {
      editor.onUpdateSuccess();
      utils.goods.list.invalidate({ gameId: gameId! });
      utils.goods.get.invalidate({ gameId: gameId!, id: goodsId! });
    },
  });

  const deleteMutation = trpc.goods.delete.useMutation({
    onSuccess: () => {
      editor.onDeleteSuccess();
      if (gameId) utils.goods.list.invalidate({ gameId });
    },
  });

  const handleSave = useCallback(() => {
    if (!gameId) return;
    if (isNew) {
      createMutation.mutate({
        gameId,
        kind: formData.kind || "Drug",
        key: formData.key || `goods_${Date.now()}`,
        name: formData.name || "新物品",
        intro: formData.intro,
      });
    } else if (goodsId) {
      updateMutation.mutate({ ...formData, id: goodsId, gameId } as Good);
    }
  }, [gameId, goodsId, isNew, formData, createMutation, updateMutation]);

  const handleDelete = useCallback(() => {
    if (gameId && goodsId && !isNew) {
      deleteMutation.mutate({ id: goodsId, gameId });
    }
  }, [gameId, goodsId, isNew, deleteMutation]);

  if (editor.isLoading) return <EntityLoadingState />;

  return (
    <DetailPageLayout
      backPath={basePath}
      title={isNew ? "新建物品" : formData.name || "物品详情"}
      subtitle={
        <>
          {GoodKindLabels[formData.kind || "Drug"]}
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
      <FormSection icon="📝" title="基本信息">
        <FormSelectField<Good>
          label="物品类型"
          field="kind"
          value={formData}
          onChange={updateField}
          options={GoodKindLabels}
        />
        <FormTextField<Good>
          label="物品名称"
          field="name"
          value={formData}
          onChange={updateField}
        />
        <FormTextField<Good>
          label="标识符 (Key)"
          field="key"
          value={formData}
          onChange={updateField}
          placeholder="例如: goods-m00-金花.ini"
        />
        <FormNumberField<Good>
          label="价格"
          field="cost"
          value={formData}
          onChange={updateField}
          allowEmpty
        />
        <FormTextArea<Good>
          label="物品介绍"
          field="intro"
          value={formData}
          onChange={updateField}
          colSpan={2}
          rows={3}
        />
      </FormSection>

      {/* 资源文件 */}
      <FormSection icon="🎨" title="资源文件">
        <FormTextField<Good>
          label="物品图像"
          field="image"
          value={formData}
          onChange={updateField}
          placeholder="例如: tm050-金葵花.asf"
        />
        <FormTextField<Good>
          label="物品图标"
          field="icon"
          value={formData}
          onChange={updateField}
          placeholder="例如: tm050-金葵花s.asf"
        />
        <FormTextField<Good>
          label="特效资源"
          field="effect"
          value={formData}
          onChange={updateField}
        />
      </FormSection>

      {/* 消耗品属性 */}
      {formData.kind === "Drug" && <DrugSection formData={formData} updateField={updateField} />}

      {/* 装备属性 */}
      {formData.kind === "Equipment" && (
        <EquipmentSection formData={formData} updateField={updateField} />
      )}

      {/* 任务道具属性 */}
      {formData.kind === "Event" && (
        <FormSection icon="📜" title="使用脚本" cols={1}>
          <FormTextField<Good>
            label="脚本路径"
            field="script"
            value={formData}
            onChange={updateField}
            placeholder="例如: Book00-太极剑谱.txt"
          />
        </FormSection>
      )}

      {/* 高级配置 */}
      <FieldGroupList
        groups={goodAdvancedGroups}
        formData={formData}
        updateField={updateField as (key: string, value: unknown) => void}
      />
    </DetailPageLayout>
  );
}

// ========== 消耗品区 ==========

function DrugSection({
  formData,
  updateField,
}: {
  formData: Partial<Good>;
  updateField: <K extends keyof Good>(key: K, value: Good[K]) => void;
}) {
  return (
    <FormSection icon="🍵" title="消耗效果" cols={3}>
      <FormNumberField<Good>
        label="恢复生命"
        field="life"
        value={formData}
        onChange={updateField}
        allowEmpty
      />
      <FormNumberField<Good>
        label="恢复体力"
        field="thew"
        value={formData}
        onChange={updateField}
        allowEmpty
      />
      <FormNumberField<Good>
        label="恢复内力"
        field="mana"
        value={formData}
        onChange={updateField}
        allowEmpty
      />
      <div className="col-span-3">
        <label className="block text-sm text-[#858585] mb-1">特殊效果</label>
        <select
          value={formData.effectType ?? 0}
          onChange={(e) => updateField("effectType", Number.parseInt(e.target.value, 10))}
          className="w-full px-3 py-2 bg-[#1e1e1e] border border-widget-border rounded-lg text-white focus:outline-none focus:border-focus-border"
        >
          {getEffectTypeOptions("Drug", null).map(({ value, label }) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </div>
    </FormSection>
  );
}

// ========== 装备属性区 ==========

function EquipmentSection({
  formData,
  updateField,
}: {
  formData: Partial<Good>;
  updateField: <K extends keyof Good>(key: K, value: Good[K]) => void;
}) {
  return (
    <FormSection icon="⚔️" title="装备属性" contentClassName="p-4 space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm text-[#858585] mb-1">装备部位</label>
          <select
            value={formData.part || "Hand"}
            onChange={(e) => {
              updateField("part", e.target.value as EquipPosition);
              updateField("effectType", 0);
            }}
            className="w-full px-3 py-2 bg-[#1e1e1e] border border-widget-border rounded-lg text-white focus:outline-none focus:border-focus-border"
          >
            {Object.entries(EquipPositionLabels).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm text-[#858585] mb-1">特效类型</label>
          <select
            value={formData.effectType ?? 0}
            onChange={(e) => updateField("effectType", Number.parseInt(e.target.value, 10))}
            className="w-full px-3 py-2 bg-[#1e1e1e] border border-widget-border rounded-lg text-white focus:outline-none focus:border-focus-border"
          >
            {getEffectTypeOptions("Equipment", formData.part as EquipPosition).map(
              ({ value, label }) => (
                <option key={value} value={value}>
                  {label}
                </option>
              )
            )}
          </select>
          {formData.effectType != null && formData.effectType > 0 && (
            <p className="mt-1 text-xs text-[#6a9955]">
              实际效果:{" "}
              {
                GoodEffectTypeLabels[
                  getActualEffectType(
                    "Equipment",
                    formData.part as EquipPosition,
                    formData.effectType
                  )
                ]
              }
            </p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <FormNumberField<Good>
          label="生命上限"
          field="lifeMax"
          value={formData}
          onChange={updateField}
          allowEmpty
        />
        <FormNumberField<Good>
          label="体力上限"
          field="thewMax"
          value={formData}
          onChange={updateField}
          allowEmpty
        />
        <FormNumberField<Good>
          label="内力上限"
          field="manaMax"
          value={formData}
          onChange={updateField}
          allowEmpty
        />
      </div>

      <div className="grid grid-cols-3 gap-4">
        <FormNumberField<Good>
          label="攻击力"
          field="attack"
          value={formData}
          onChange={updateField}
          allowEmpty
        />
        <FormNumberField<Good>
          label="防御力"
          field="defend"
          value={formData}
          onChange={updateField}
          allowEmpty
        />
        <FormNumberField<Good>
          label="闪避"
          field="evade"
          value={formData}
          onChange={updateField}
          allowEmpty
        />
      </div>
    </FormSection>
  );
}
