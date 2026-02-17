/**
 * NPC 编辑页面 - 完整实现
 */

import { api, useToast } from "@miu2d/shared";
import type { Npc, NpcRes, NpcResource, NpcState } from "@miu2d/types";
import {
  createDefaultNpc,
  createDefaultNpcResource,
  getVisibleFieldsByNpcKind,
  NpcKindLabels,
  NpcRelationLabels,
  NpcStateLabels,
  npcStateToResourceKey,
} from "@miu2d/types";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  FormNumberField,
  FormSection,
  FormSelectField,
  FormTextArea,
  FormTextField,
  ResourceFilePicker,
} from "../../components/common";
import { FieldGroupList } from "../../components/common/FieldGrid";
import { MagicPicker, ResourceListPicker } from "../../components/common/pickers";
import type { DetailTab } from "../../components/DetailPageLayout";
import { DetailPageLayout } from "../../components/DetailPageLayout";
import { EditorEmptyState } from "../../components/EditorEmptyState";
import type { StateItem } from "../../components/ResourceConfigSection";
import { ResourceConfigSection } from "../../components/ResourceConfigSection";
import { useDashboard } from "../../DashboardContext";
import { EntityLoadingState, useEntityEditor } from "../../hooks";
import { NpcPreview } from "./NpcPreview";
import { npcAdvancedGroups } from "./npc-field-defs";

/** NPC 状态列表（供 ResourceConfigSection 使用） */
const npcStates: StateItem[] = (Object.keys(NpcStateLabels) as NpcState[]).map((state) => ({
  label: NpcStateLabels[state],
  stateName: state,
  stateKey: npcStateToResourceKey(state),
}));

// ========== 列表页（欢迎页面） ==========

export function NpcListPage() {
  return (
    <EditorEmptyState
      icon="👤"
      title="NPC 编辑"
      description={
        <>
          从左侧列表选择一个 NPC 进行编辑，
          <br />
          或使用上方按钮创建新 NPC、导入 INI 文件。
        </>
      }
    />
  );
}

// ========== 详情页 ==========

type NpcTab = "basic" | "combat" | "resource" | "behavior" | "advanced";

export function NpcDetailPage() {
  // ── 查询 ──
  const { gameId: gameSlug, npcId } = useParams<{ gameId: string; npcId: string }>();
  const { currentGame } = useDashboard();
  const gameId = currentGame?.id;

  const { data: npc, isLoading } = api.npc.get.useQuery(
    { gameId: gameId!, id: npcId! },
    { enabled: !!gameId && !!npcId && npcId !== "new" }
  );

  // ── 编辑器 Hook ──
  const editor = useEntityEditor<Npc, NpcTab>({
    entityType: "npc",
    paramKey: "npcId",
    basePath: (slug) => `/dashboard/${slug}/npcs`,
    validTabs: ["basic", "combat", "resource", "behavior", "advanced"],
    createDefault: (gId) => createDefaultNpc(gId),
    entityLabel: "NPC",
    serverData: npc,
    isQueryLoading: isLoading,
  });

  const { formData, updateField, activeTab, setActiveTab, isNew, basePath, utils } = editor;

  // ── 关联资源查询 ──
  const { data: resourceList } = api.npcResource.list.useQuery(
    { gameId: gameId! },
    { enabled: !!gameId }
  );

  const currentResourceId = formData.resourceId ?? npc?.resourceId;
  const { data: linkedResource } = api.npcResource.get.useQuery(
    { gameId: gameId!, id: currentResourceId ?? "" },
    { enabled: !!gameId && !!currentResourceId }
  );

  // ── 根据 Kind 获取可见字段 ──
  const visibleFields = useMemo(() => {
    return new Set(getVisibleFieldsByNpcKind(formData.kind || "Normal"));
  }, [formData.kind]);

  // ── Mutations ──
  const createMutation = api.npc.create.useMutation({
    onSuccess: (data) => {
      editor.onCreateSuccess(data.id);
      utils.npc.list.invalidate({ gameId: gameId! });
    },
  });

  const updateMutation = api.npc.update.useMutation({
    onSuccess: () => {
      editor.onUpdateSuccess();
      utils.npc.list.invalidate({ gameId: gameId! });
      utils.npc.get.invalidate({ gameId: gameId!, id: npcId! });
    },
  });

  const deleteMutation = api.npc.delete.useMutation({
    onSuccess: () => {
      editor.onDeleteSuccess();
      if (gameId) utils.npc.list.invalidate({ gameId });
    },
  });

  const handleSave = useCallback(() => {
    if (!gameId) return;
    if (isNew) {
      createMutation.mutate({
        gameId,
        key: formData.key || `npc_${Date.now()}`,
        name: formData.name || "新NPC",
        kind: formData.kind,
        relation: formData.relation,
        ...formData,
      } as never);
    } else if (npcId) {
      updateMutation.mutate({ ...formData, id: npcId, gameId } as never);
    }
  }, [gameId, npcId, isNew, formData, createMutation, updateMutation]);

  const handleDelete = useCallback(() => {
    if (gameId && npcId && !isNew) {
      deleteMutation.mutate({ id: npcId, gameId });
    }
  }, [gameId, npcId, isNew, deleteMutation]);

  if (editor.isLoading) return <EntityLoadingState />;

  const tabs: DetailTab[] = [
    { key: "basic", label: "基础信息", icon: "📝" },
    { key: "combat", label: "战斗属性", icon: "⚔️" },
    { key: "resource", label: "资源配置", icon: "🎨" },
    { key: "behavior", label: "行为脚本", icon: "📜" },
    { key: "advanced", label: "高级配置", icon: "🔧" },
  ];

  return (
    <DetailPageLayout
      backPath={basePath}
      title={isNew ? "新建 NPC" : formData.name || "NPC 详情"}
      subtitle={
        <>
          {NpcKindLabels[formData.kind || "Normal"]} ·{" "}
          {NpcRelationLabels[formData.relation || "Friend"]}
          {formData.key && <span className="ml-2 text-[#666]">({formData.key})</span>}
        </>
      }
      tabs={tabs}
      activeTab={activeTab}
      onTabChange={(key) => setActiveTab(key as NpcTab)}
      onSave={handleSave}
      isSaving={createMutation.isPending || updateMutation.isPending}
      onDelete={!isNew ? handleDelete : undefined}
      isDeleting={deleteMutation.isPending}
      sidePanel={
        <div className="w-80 flex-shrink-0">
          <div className="sticky top-6">
            <div className="bg-[#252526] border border-widget-border rounded-xl overflow-hidden">
              <div className="px-4 py-3 border-b border-widget-border">
                <h3 className="text-sm font-medium text-[#cccccc]">👤 NPC 预览</h3>
              </div>
              <div className="p-4">
                <NpcPreview
                  gameSlug={gameSlug!}
                  npc={formData}
                  resource={(linkedResource as NpcRes | undefined) ?? undefined}
                />
              </div>
            </div>
          </div>
        </div>
      }
    >
      {activeTab === "basic" && <BasicInfoSection formData={formData} updateField={updateField} />}

      {activeTab === "combat" && (
        <CombatSection
          formData={formData}
          updateField={updateField}
          visibleFields={visibleFields}
          gameId={gameId!}
          gameSlug={gameSlug!}
        />
      )}

      {activeTab === "resource" && (
        <ResourceSection
          formData={formData}
          updateField={updateField}
          linkedResource={(linkedResource ?? null) as NpcRes | null}
          resourceList={resourceList ?? []}
          gameId={gameId!}
          gameSlug={gameSlug!}
        />
      )}

      {activeTab === "behavior" && (
        <BehaviorSection
          formData={formData}
          updateField={updateField}
          visibleFields={visibleFields}
          gameId={gameId!}
          gameSlug={gameSlug!}
        />
      )}

      {activeTab === "advanced" && (
        <FieldGroupList
          groups={npcAdvancedGroups}
          formData={formData}
          updateField={updateField as (key: string, value: unknown) => void}
        />
      )}
    </DetailPageLayout>
  );
}

// ========== 基础信息区 ==========

function BasicInfoSection({
  formData,
  updateField,
}: {
  formData: Partial<Npc>;
  updateField: <K extends keyof Npc>(key: K, value: Npc[K]) => void;
}) {
  return (
    <FormSection icon="📝" title="基本信息">
      <FormTextField<Npc> label="NPC 名称" field="name" value={formData} onChange={updateField} />
      <FormTextField<Npc>
        label="标识符 (Key)"
        field="key"
        value={formData}
        onChange={updateField}
        placeholder="例如: 惠安镇路人1.ini"
      />
      <FormSelectField<Npc>
        label="NPC 类型"
        field="kind"
        value={formData}
        onChange={updateField}
        options={NpcKindLabels}
      />
      <FormSelectField<Npc>
        label="关系"
        field="relation"
        value={formData}
        onChange={updateField}
        options={NpcRelationLabels}
      />
      <FormNumberField<Npc> label="等级" field="level" value={formData} onChange={updateField} />
      <FormNumberField<Npc>
        label="移动速度"
        field="walkSpeed"
        value={formData}
        onChange={updateField}
        min={0}
        max={10}
      />
      <FormTextArea<Npc>
        label="描述"
        field="intro"
        value={formData}
        onChange={updateField}
        rows={2}
        colSpan={2}
      />
    </FormSection>
  );
}

// ========== 战斗属性区 ==========

function CombatSection({
  formData,
  updateField,
  visibleFields,
  gameId,
  gameSlug,
}: {
  formData: Partial<Npc>;
  updateField: <K extends keyof Npc>(key: K, value: Npc[K]) => void;
  visibleFields: Set<string>;
  gameId: string;
  gameSlug: string;
}) {
  const v = visibleFields;
  return (
    <div className="space-y-5">
      <FormSection icon="❤️" title="生命与资源">
        <FormNumberField<Npc>
          label="当前生命"
          field="life"
          value={formData}
          onChange={updateField}
          min={0}
        />
        <FormNumberField<Npc>
          label="最大生命"
          field="lifeMax"
          value={formData}
          onChange={updateField}
          min={0}
        />
        <FormNumberField<Npc>
          label="当前体力"
          field="thew"
          value={formData}
          onChange={updateField}
          min={0}
          hidden={!v.has("thew")}
        />
        <FormNumberField<Npc>
          label="最大体力"
          field="thewMax"
          value={formData}
          onChange={updateField}
          min={0}
          hidden={!v.has("thew")}
        />
        <FormNumberField<Npc>
          label="当前内力"
          field="mana"
          value={formData}
          onChange={updateField}
          min={0}
          hidden={!v.has("mana")}
        />
        <FormNumberField<Npc>
          label="最大内力"
          field="manaMax"
          value={formData}
          onChange={updateField}
          min={0}
          hidden={!v.has("mana")}
        />
      </FormSection>

      {v.has("attack") && (
        <FormSection icon="⚔️" title="战斗属性" cols={3}>
          <FormNumberField<Npc>
            label="攻击力"
            field="attack"
            value={formData}
            onChange={updateField}
            min={0}
          />
          <FormNumberField<Npc>
            label="防御力"
            field="defend"
            value={formData}
            onChange={updateField}
            min={0}
            hidden={!v.has("defend")}
          />
          <FormNumberField<Npc>
            label="闪避值"
            field="evade"
            value={formData}
            onChange={updateField}
            min={0}
            hidden={!v.has("evade")}
          />
          <FormNumberField<Npc>
            label="攻击范围"
            field="attackRadius"
            value={formData}
            onChange={updateField}
            min={1}
            max={10}
            hidden={!v.has("attackRadius")}
          />
          <FormNumberField<Npc>
            label="击杀经验"
            field="exp"
            value={formData}
            onChange={updateField}
            min={0}
            hidden={!v.has("exp")}
          />
          {v.has("flyIni") && (
            <div className="col-span-3">
              <MagicPicker
                label="飞行攻击"
                value={formData.flyIni}
                onChange={(val) => updateField("flyIni", val)}
                gameId={gameId}
                gameSlug={gameSlug}
                placeholder="选择关联武功"
              />
            </div>
          )}
        </FormSection>
      )}
    </div>
  );
}

// ========== 资源配置区 ==========

function ResourceSection({
  formData,
  updateField,
  linkedResource,
  resourceList,
  gameId,
  gameSlug,
}: {
  formData: Partial<Npc>;
  updateField: <K extends keyof Npc>(key: K, value: Npc[K]) => void;
  linkedResource: NpcRes | null;
  resourceList: Array<{ id: string; key: string; name: string }>;
  gameId: string;
  gameSlug: string;
}) {
  // 使用关联资源的配置，如果没有则显示空
  const resources = linkedResource?.resources || createDefaultNpcResource();
  const hasLinkedResource = !!formData.resourceId && !!linkedResource;

  return (
    <div className="space-y-5">
      <FormSection icon="🔗" title="关联 NPC 资源" cols={1} contentClassName="p-4">
        <ResourceListPicker
          label="NPC 资源"
          value={formData.resourceId ?? null}
          onChange={(val) => updateField("resourceId", val)}
          items={resourceList}
          placeholder="点击选择 NPC 资源"
          dialogTitle="选择 NPC 资源"
          emptyText="暂无 NPC 资源"
          hint="选择一个 NPC 资源配置来定义此 NPC 的动画和音效资源。资源配置可以被多个 NPC 共享。"
        />
      </FormSection>

      {hasLinkedResource && (
        <ResourceConfigSection
          readonly
          title="🎨 动画与音效资源"
          titleExtra={
            <Link
              to={`/dashboard/${gameSlug}/npcs/resource/${formData.resourceId}`}
              className="text-xs text-[#569cd6] hover:underline bg-[#3c3c3c] px-2 py-0.5 rounded"
            >
              编辑「{linkedResource.name}」→
            </Link>
          }
          states={npcStates}
          getResource={(stateKey) => resources[stateKey as keyof NpcResource]}
          fieldPrefix="npcResource"
          gameId={gameId}
          gameSlug={gameSlug}
        />
      )}

      {!hasLinkedResource && (
        <section className="bg-[#252526] border border-widget-border rounded-xl overflow-hidden">
          <div className="p-8 text-center">
            <div className="text-4xl mb-4">🎨</div>
            <p className="text-[#858585] text-sm">请选择一个 NPC 资源配置来查看资源</p>
            <p className="text-[#666] text-xs mt-2">
              可以从侧边栏创建新的 NPC 资源，或导入 INI 文件时自动创建
            </p>
          </div>
        </section>
      )}
    </div>
  );
}

// ========== 行为脚本区 ==========

function BehaviorSection({
  formData,
  updateField,
  visibleFields,
  gameId,
  gameSlug,
}: {
  formData: Partial<Npc>;
  updateField: <K extends keyof Npc>(key: K, value: Npc[K]) => void;
  visibleFields: Set<string>;
  gameId: string;
  gameSlug: string;
}) {
  const v = visibleFields;
  return (
    <div className="space-y-5">
      <FormSection icon="📜" title="脚本配置" cols={1} contentClassName="p-4 space-y-3">
        <ResourceFilePicker
          label="对话脚本"
          value={formData.scriptFile}
          onChange={(val) => updateField("scriptFile", val)}
          fieldName="npc_scriptFile"
          gameId={gameId}
          gameSlug={gameSlug}
          extensions={[".txt"]}
          placeholder="点击选择"
        />
        {v.has("deathScript") && (
          <ResourceFilePicker
            label="死亡脚本"
            value={formData.deathScript}
            onChange={(val) => updateField("deathScript", val)}
            fieldName="npc_deathScript"
            gameId={gameId}
            gameSlug={gameSlug}
            extensions={[".txt"]}
            placeholder="点击选择"
          />
        )}
        {v.has("bodyIni") && (
          <ResourceFilePicker
            label="死亡物体"
            value={formData.bodyIni}
            onChange={(val) => updateField("bodyIni", val)}
            fieldName="npc_bodyIni"
            gameId={gameId}
            gameSlug={gameSlug}
            extensions={[".ini"]}
            placeholder="点击选择"
          />
        )}
      </FormSection>

      {v.has("pathFinder") && (
        <FormSection icon="🗺️" title="寻路配置">
          <FormSelectField<Npc>
            label="寻路类型"
            field="pathFinder"
            value={formData}
            onChange={updateField}
            options={{ "0": "简单寻路", "1": "完整 A* 寻路" }}
          />
          <FormNumberField<Npc>
            label="初始方向 (0-7)"
            field="dir"
            value={formData}
            onChange={updateField}
            min={0}
            max={7}
          />
          <FormNumberField<Npc>
            label="攻击间隔（帧）"
            field="idle"
            value={formData}
            onChange={updateField}
            min={0}
            hidden={!v.has("idle")}
          />
          <FormNumberField<Npc>
            label="亮度/透明度"
            field="lum"
            value={formData}
            onChange={updateField}
            min={0}
            max={255}
          />
        </FormSection>
      )}
    </div>
  );
}

// ========== NPC 资源详情页 ==========

export function NpcResourceDetailPage() {
  const { gameId: gameSlug, resourceId } = useParams<{ gameId: string; resourceId: string }>();
  const { currentGame, editCache } = useDashboard();
  const gameId = currentGame?.id;
  const navigate = useNavigate();
  const utils = api.useUtils();
  const basePath = `/dashboard/${gameSlug}/npcs`;
  const { success: toastSuccess, error: toastError } = useToast();

  // 缓存 key
  const cacheKey = resourceId ? `npc-resource:${resourceId}` : null;

  // 获取资源数据
  const { data: npcRes, isLoading } = api.npcResource.get.useQuery(
    { gameId: gameId!, id: resourceId! },
    { enabled: !!gameId && !!resourceId }
  );

  // 初始化表单数据
  const [formData, setFormData] = useState<Partial<NpcRes>>({
    name: "",
    resources: createDefaultNpcResource(),
  });

  // 从缓存或 API 加载数据
  useEffect(() => {
    if (cacheKey && editCache.has(cacheKey)) {
      setFormData(editCache.get(cacheKey) as Partial<NpcRes>);
    } else if (npcRes) {
      setFormData(npcRes);
      if (cacheKey) {
        editCache.set(cacheKey, npcRes);
      }
    }
  }, [npcRes, cacheKey, editCache]);

  // 更新字段
  const updateField = <K extends keyof NpcRes>(key: K, value: NpcRes[K]) => {
    setFormData((prev) => {
      const newData = { ...prev, [key]: value };
      if (cacheKey) {
        editCache.set(cacheKey, newData);
      }
      return newData;
    });
  };

  // 更新资源字段
  const updateResourceField = (
    state: keyof NpcResource,
    field: "image" | "sound",
    value: string | null
  ) => {
    const currentResources = formData.resources ?? createDefaultNpcResource();
    const newResources: NpcResource = {
      ...currentResources,
      [state]: {
        ...currentResources[state],
        [field]: value,
      },
    };
    updateField("resources", newResources);
  };

  // 保存
  const updateMutation = api.npcResource.update.useMutation({
    onSuccess: () => {
      utils.npcResource.list.invalidate({ gameId: gameId! });
      utils.npcResource.get.invalidate({ gameId: gameId!, id: resourceId! });
      if (cacheKey) {
        editCache.remove(cacheKey);
      }
      toastSuccess("保存成功");
    },
    onError: (error) => {
      toastError(`保存失败: ${error.message}`);
    },
  });

  const handleSave = () => {
    if (!gameId || !resourceId) return;

    updateMutation.mutate({
      id: resourceId,
      gameId,
      name: formData.name,
      resources: formData.resources,
    } as never);
  };

  // 删除
  const deleteMutation = api.npcResource.delete.useMutation({
    onSuccess: () => {
      utils.npcResource.list.invalidate({ gameId: gameId! });
      if (cacheKey) {
        editCache.remove(cacheKey);
      }
      toastSuccess("删除成功");
      navigate(basePath);
    },
    onError: (error) => {
      toastError(`删除失败: ${error.message}`);
    },
  });

  const handleDelete = () => {
    if (!gameId || !resourceId) return;
    if (confirm("确定要删除这个 NPC 资源吗？使用它的 NPC 将失去关联。")) {
      deleteMutation.mutate({ gameId, id: resourceId });
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-[#858585]">加载中...</div>
      </div>
    );
  }

  if (!npcRes) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="text-6xl mb-4">🔍</div>
          <p className="text-[#858585]">未找到 NPC 资源</p>
          <Link to={basePath} className="text-[#569cd6] hover:underline mt-2 block">
            返回列表
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-auto">
      <div className="max-w-6xl mx-auto p-6">
        {/* 页面标题 */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="text-4xl">🎨</div>
            <div>
              <h1 className="text-xl font-medium text-white">{formData.name || "未命名资源"}</h1>
              <span className="text-xs text-[#858585]">{npcRes.key}</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleDelete}
              disabled={deleteMutation.isPending}
              className="px-4 py-2 text-sm text-red-400 hover:bg-red-500/10 rounded transition-colors"
            >
              {deleteMutation.isPending ? "删除中..." : "删除"}
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={updateMutation.isPending}
              className="px-4 py-2 text-sm bg-[#0e639c] hover:bg-[#1177bb] text-white rounded transition-colors disabled:opacity-50"
            >
              {updateMutation.isPending ? "保存中..." : "保存"}
            </button>
          </div>
        </div>

        {/* 基本信息 */}
        <section className="bg-[#252526] border border-widget-border rounded-xl overflow-hidden mb-6">
          <div className="px-4 py-3 border-b border-widget-border">
            <h2 className="text-sm font-medium text-[#cccccc]">📝 基本信息</h2>
          </div>
          <div className="p-4">
            <div>
              <label className="block text-sm text-[#858585] mb-1">资源名称</label>
              <input
                type="text"
                value={formData.name ?? ""}
                onChange={(e) => updateField("name", e.target.value)}
                className="w-full px-3 py-2 bg-[#3c3c3c] border border-widget-border rounded text-white text-sm focus:outline-none focus:border-focus-border"
                placeholder="输入资源名称"
              />
            </div>
          </div>
        </section>

        {/* 资源配置 */}
        <ResourceConfigSection
          states={npcStates}
          getResource={(key) => formData.resources?.[key as keyof NpcResource]}
          onResourceChange={(key, field, val) =>
            updateResourceField(key as keyof NpcResource, field, val)
          }
          fieldPrefix="npcResource"
          gameId={gameId!}
          gameSlug={gameSlug!}
        />
      </div>
    </div>
  );
}
