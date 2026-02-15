/**
 * Object 编辑页面 - 完整实现
 */

import { trpc, useToast } from "@miu2d/shared";
import type { Obj, ObjRes, ObjResource, ObjState } from "@miu2d/types";
import {
  createDefaultObj,
  createDefaultObjResource,
  getVisibleFieldsByObjKind,
  ObjKindLabels,
  ObjStateLabels,
} from "@miu2d/types";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  FormCheckbox,
  FormNumberField,
  FormSection,
  FormSelectField,
  FormTextField,
  ResourceFilePicker,
} from "../../components/common";
import { FieldGroupList } from "../../components/common/FieldGrid";
import { ResourceListPicker } from "../../components/common/pickers";
import type { DetailTab } from "../../components/DetailPageLayout";
import { DetailPageLayout } from "../../components/DetailPageLayout";
import { EditorEmptyState } from "../../components/EditorEmptyState";
import type { StateItem } from "../../components/ResourceConfigSection";
import { ResourceConfigSection } from "../../components/ResourceConfigSection";
import { useDashboard } from "../../DashboardContext";
import { EntityLoadingState, useEntityEditor } from "../../hooks";
import { ObjPreview } from "./ObjPreview";
import { objAdvancedGroups } from "./obj-field-defs";

/** Obj 状态列表（供 ResourceConfigSection 使用） */
const objStates: StateItem[] = (Object.keys(ObjStateLabels) as ObjState[]).map((state) => ({
  label: ObjStateLabels[state],
  stateName: state,
  stateKey: state.toLowerCase(),
}));

// ========== 列表页（欢迎页面） ==========

export function ObjListPage() {
  return (
    <EditorEmptyState
      icon="📦"
      title="物体编辑"
      description={
        <>
          从左侧列表选择一个物体进行编辑，
          <br />
          或使用上方按钮创建新物体、导入 INI 文件。
        </>
      }
    />
  );
}

// ========== 详情页 ==========

type ObjTab = "basic" | "resource" | "behavior" | "advanced";

export function ObjDetailPage() {
  // ── 查询 ──
  const { gameId: gameSlug, objId } = useParams<{ gameId: string; objId: string }>();
  const { currentGame } = useDashboard();
  const gameId = currentGame?.id;

  const { data: obj, isLoading } = trpc.obj.get.useQuery(
    { gameId: gameId!, id: objId! },
    { enabled: !!gameId && !!objId && objId !== "new" }
  );

  // ── 编辑器 Hook ──
  const editor = useEntityEditor<Obj, ObjTab>({
    entityType: "obj",
    paramKey: "objId",
    basePath: (slug) => `/dashboard/${slug}/objs`,
    validTabs: ["basic", "resource", "behavior", "advanced"],
    createDefault: (gId) => createDefaultObj(gId),
    entityLabel: "物体",
    serverData: obj,
    isQueryLoading: isLoading,
  });

  const { formData, updateField, activeTab, setActiveTab, isNew, basePath, utils } = editor;

  // ── 关联资源查询 ──
  const { data: resourceList } = trpc.objResource.list.useQuery(
    { gameId: gameId! },
    { enabled: !!gameId }
  );

  const currentResourceId = formData.resourceId ?? obj?.resourceId;
  const { data: linkedResource } = trpc.objResource.get.useQuery(
    { gameId: gameId!, id: currentResourceId ?? "" },
    { enabled: !!gameId && !!currentResourceId }
  );

  // ── 根据 Kind 获取可见字段 ──
  const visibleFields = useMemo(() => {
    return new Set(getVisibleFieldsByObjKind(formData.kind || "Static"));
  }, [formData.kind]);

  // ── Mutations ──
  const createMutation = trpc.obj.create.useMutation({
    onSuccess: (data) => {
      editor.onCreateSuccess(data.id);
      utils.obj.list.invalidate({ gameId: gameId! });
    },
  });

  const updateMutation = trpc.obj.update.useMutation({
    onSuccess: () => {
      editor.onUpdateSuccess();
      utils.obj.list.invalidate({ gameId: gameId! });
      utils.obj.get.invalidate({ gameId: gameId!, id: objId! });
    },
  });

  const deleteMutation = trpc.obj.delete.useMutation({
    onSuccess: () => {
      editor.onDeleteSuccess();
      if (gameId) utils.obj.list.invalidate({ gameId });
    },
  });

  const handleSave = useCallback(() => {
    if (!gameId) return;
    if (isNew) {
      createMutation.mutate({
        gameId,
        key: formData.key || `obj_${Date.now()}`,
        name: formData.name || "新物体",
        kind: formData.kind,
        ...formData,
      });
    } else if (objId) {
      updateMutation.mutate({ ...formData, id: objId, gameId } as Obj);
    }
  }, [gameId, objId, isNew, formData, createMutation, updateMutation]);

  const handleDelete = useCallback(() => {
    if (gameId && objId && !isNew) {
      deleteMutation.mutate({ id: objId, gameId });
    }
  }, [gameId, objId, isNew, deleteMutation]);

  if (editor.isLoading) return <EntityLoadingState />;

  const tabs: DetailTab[] = [
    { key: "basic", label: "基础信息", icon: "📝" },
    { key: "resource", label: "资源配置", icon: "🎨" },
    { key: "behavior", label: "行为脚本", icon: "📜" },
    { key: "advanced", label: "高级配置", icon: "🔧" },
  ];

  return (
    <DetailPageLayout
      backPath={basePath}
      title={isNew ? "新建物体" : formData.name || "物体详情"}
      subtitle={
        <>
          {ObjKindLabels[formData.kind || "Static"]}
          {formData.key && <span className="ml-2 text-[#666]">({formData.key})</span>}
        </>
      }
      tabs={tabs}
      activeTab={activeTab}
      onTabChange={(key) => setActiveTab(key as ObjTab)}
      onSave={handleSave}
      isSaving={createMutation.isPending || updateMutation.isPending}
      onDelete={!isNew ? handleDelete : undefined}
      isDeleting={deleteMutation.isPending}
      sidePanel={
        <div className="w-80 flex-shrink-0">
          <div className="sticky top-6">
            <div className="bg-[#252526] border border-widget-border rounded-xl overflow-hidden">
              <div className="px-4 py-3 border-b border-widget-border">
                <h3 className="text-sm font-medium text-[#cccccc]">📦 物体预览</h3>
              </div>
              <div className="p-4">
                <ObjPreview
                  gameSlug={gameSlug!}
                  obj={formData}
                  resource={linkedResource ?? undefined}
                />
              </div>
            </div>
          </div>
        </div>
      }
    >
      {activeTab === "basic" && (
        <BasicInfoSection
          formData={formData}
          updateField={updateField}
          visibleFields={visibleFields}
        />
      )}

      {activeTab === "resource" && (
        <ResourceSection
          formData={formData}
          updateField={updateField}
          linkedResource={linkedResource ?? null}
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
          groups={objAdvancedGroups}
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
  visibleFields,
}: {
  formData: Partial<Obj>;
  updateField: <K extends keyof Obj>(key: K, value: Obj[K]) => void;
  visibleFields: Set<string>;
}) {
  const v = visibleFields;
  return (
    <FormSection icon="📝" title="基本信息">
      <FormTextField<Obj> label="物体名称" field="name" value={formData} onChange={updateField} />
      <FormTextField<Obj>
        label="标识符 (Key)"
        field="key"
        value={formData}
        onChange={updateField}
        placeholder="例如: 宝箱1.ini"
      />
      <FormSelectField<Obj>
        label="物体类型"
        field="kind"
        value={formData}
        onChange={updateField}
        options={ObjKindLabels}
      />
      <FormNumberField<Obj>
        label="初始方向 (0-7)"
        field="dir"
        value={formData}
        onChange={updateField}
        min={0}
        max={7}
        hidden={!v.has("dir")}
      />
      <FormNumberField<Obj>
        label="亮度/透明度"
        field="lum"
        value={formData}
        onChange={updateField}
        min={0}
        max={255}
        hidden={!v.has("lum")}
      />
      <FormNumberField<Obj>
        label="伤害值"
        field="damage"
        value={formData}
        onChange={updateField}
        min={0}
        hidden={!v.has("damage")}
      />
      <FormNumberField<Obj>
        label="当前帧"
        field="frame"
        value={formData}
        onChange={updateField}
        min={0}
        hidden={!v.has("frame")}
      />
      <FormNumberField<Obj>
        label="高度"
        field="height"
        value={formData}
        onChange={updateField}
        min={0}
        hidden={!v.has("height")}
      />
      <FormNumberField<Obj>
        label="X 偏移"
        field="offX"
        value={formData}
        onChange={updateField}
        hidden={!v.has("offX")}
      />
      <FormNumberField<Obj>
        label="Y 偏移"
        field="offY"
        value={formData}
        onChange={updateField}
        hidden={!v.has("offY")}
      />
      <FormNumberField<Obj>
        label="移除延迟(毫秒)"
        field="millisecondsToRemove"
        value={formData}
        onChange={updateField}
        min={0}
        hidden={!v.has("millisecondsToRemove")}
      />
    </FormSection>
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
  formData: Partial<Obj>;
  updateField: <K extends keyof Obj>(key: K, value: Obj[K]) => void;
  linkedResource: ObjRes | null;
  resourceList: Array<{ id: string; key: string; name: string }>;
  gameId: string;
  gameSlug: string;
}) {
  // 使用关联资源的配置，如果没有则显示空
  const resources = linkedResource?.resources || createDefaultObjResource();
  const hasLinkedResource = !!formData.resourceId && !!linkedResource;

  return (
    <div className="space-y-5">
      {/* 资源关联选择器（弹窗式） */}
      <section className="bg-[#252526] border border-widget-border rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-widget-border">
          <h2 className="text-sm font-medium text-[#cccccc]">🔗 关联 Object 资源</h2>
        </div>
        <div className="p-4">
          <ResourceListPicker
            label="Obj 资源"
            value={formData.resourceId ?? null}
            onChange={(val) => updateField("resourceId", val)}
            items={resourceList}
            placeholder="点击选择 Object 资源"
            dialogTitle="选择 Object 资源"
            emptyText="暂无 Object 资源"
            hint="选择一个 Object 资源配置来定义此物体的动画和音效资源。资源配置可以被多个 Object 共享。"
          />
        </div>
      </section>

      {/* 资源配置展示（只读，使用 ResourceConfigSection） */}
      {hasLinkedResource && (
        <ResourceConfigSection
          readonly
          title="🎨 动画与音效资源"
          titleExtra={
            <Link
              to={`/dashboard/${gameSlug}/objs/resource/${formData.resourceId}`}
              className="text-xs text-[#569cd6] hover:underline bg-[#3c3c3c] px-2 py-0.5 rounded"
            >
              编辑「{linkedResource.name}」→
            </Link>
          }
          states={objStates}
          getResource={(stateKey) => resources[stateKey as keyof ObjResource]}
          fieldPrefix="objResource"
          gameId={gameId}
          gameSlug={gameSlug}
        />
      )}

      {/* 未关联资源时的提示 */}
      {!hasLinkedResource && (
        <section className="bg-[#252526] border border-widget-border rounded-xl overflow-hidden">
          <div className="p-8 text-center">
            <div className="text-4xl mb-4">🎨</div>
            <p className="text-[#858585] text-sm">请选择一个 Object 资源配置来查看资源</p>
            <p className="text-[#666] text-xs mt-2">
              可以从侧边栏创建新的 Object 资源，或导入 INI 文件时自动创建
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
  formData: Partial<Obj>;
  updateField: <K extends keyof Obj>(key: K, value: Obj[K]) => void;
  visibleFields: Set<string>;
  gameId: string;
  gameSlug: string;
}) {
  const v = visibleFields;
  return (
    <div className="space-y-5">
      <FormSection icon="📜" title="脚本配置" cols={1} contentClassName="p-4 space-y-3">
        {v.has("scriptFile") && (
          <ResourceFilePicker
            label="交互脚本"
            value={formData.scriptFile}
            onChange={(val) => updateField("scriptFile", val)}
            fieldName="obj_scriptFile"
            gameId={gameId}
            gameSlug={gameSlug}
            extensions={[".txt"]}
            placeholder="点击选择"
          />
        )}
        {v.has("scriptFileRight") && (
          <ResourceFilePicker
            label="右键脚本"
            value={formData.scriptFileRight}
            onChange={(val) => updateField("scriptFileRight", val)}
            fieldName="obj_scriptFileRight"
            gameId={gameId}
            gameSlug={gameSlug}
            extensions={[".txt"]}
            placeholder="点击选择"
          />
        )}
        {v.has("timerScriptFile") && (
          <ResourceFilePicker
            label="定时脚本"
            value={formData.timerScriptFile}
            onChange={(val) => updateField("timerScriptFile", val)}
            fieldName="obj_timerScriptFile"
            gameId={gameId}
            gameSlug={gameSlug}
            extensions={[".txt"]}
            placeholder="点击选择"
          />
        )}
        <FormNumberField<Obj>
          label="定时脚本间隔(毫秒)"
          field="timerScriptInterval"
          value={formData}
          onChange={updateField}
          min={0}
          hidden={!v.has("timerScriptInterval")}
        />
        {v.has("reviveNpcIni") && (
          <ResourceFilePicker
            label="复活NPC配置"
            value={formData.reviveNpcIni}
            onChange={(val) => updateField("reviveNpcIni", val)}
            fieldName="obj_reviveNpcIni"
            gameId={gameId}
            gameSlug={gameSlug}
            extensions={[".ini"]}
            placeholder="点击选择"
          />
        )}
        {v.has("wavFile") && (
          <ResourceFilePicker
            label="音效文件"
            value={formData.wavFile}
            onChange={(val) => updateField("wavFile", val)}
            fieldName="obj_wavFile"
            gameId={gameId}
            gameSlug={gameSlug}
            extensions={[".wav", ".ogg", ".xnb"]}
            placeholder="点击选择"
          />
        )}
      </FormSection>

      <FormSection icon="🎮" title="交互配置">
        <FormCheckbox<Obj>
          label="可远程交互（无需靠近）"
          field="canInteractDirectly"
          value={formData}
          onChange={updateField}
          numeric
          hidden={!v.has("canInteractDirectly")}
        />
        <FormCheckbox<Obj>
          label="仅触碰触发脚本"
          field="scriptFileJustTouch"
          value={formData}
          onChange={updateField}
          numeric
          hidden={!v.has("scriptFileJustTouch")}
        />
      </FormSection>
    </div>
  );
}

// ========== Object 资源详情页 ==========

export function ObjResourceDetailPage() {
  const { gameId: gameSlug, resourceId } = useParams<{ gameId: string; resourceId: string }>();
  const { currentGame, editCache } = useDashboard();
  const gameId = currentGame?.id;
  const navigate = useNavigate();
  const utils = trpc.useUtils();
  const basePath = `/dashboard/${gameSlug}/objs`;
  const { success: toastSuccess, error: toastError } = useToast();

  // 缓存 key
  const cacheKey = resourceId ? `obj-resource:${resourceId}` : null;

  // 获取资源数据
  const { data: objRes, isLoading } = trpc.objResource.get.useQuery(
    { gameId: gameId!, id: resourceId! },
    { enabled: !!gameId && !!resourceId }
  );

  // 初始化表单数据
  const [formData, setFormData] = useState<Partial<ObjRes>>({
    name: "",
    resources: createDefaultObjResource(),
  });

  // 从缓存或 API 加载数据
  useEffect(() => {
    if (cacheKey && editCache.has(cacheKey)) {
      setFormData(editCache.get(cacheKey) as Partial<ObjRes>);
    } else if (objRes) {
      setFormData(objRes);
      if (cacheKey) {
        editCache.set(cacheKey, objRes);
      }
    }
  }, [objRes, cacheKey, editCache]);

  // 更新字段
  const updateField = <K extends keyof ObjRes>(key: K, value: ObjRes[K]) => {
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
    state: keyof ObjResource,
    field: "image" | "sound",
    value: string | null
  ) => {
    const currentResources = formData.resources ?? createDefaultObjResource();
    const newResources: ObjResource = {
      ...currentResources,
      [state]: {
        ...currentResources[state],
        [field]: value,
      },
    };
    updateField("resources", newResources);
  };

  // 保存
  const updateMutation = trpc.objResource.update.useMutation({
    onSuccess: () => {
      utils.objResource.list.invalidate({ gameId });
      utils.objResource.get.invalidate({ gameId, id: resourceId });
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
    });
  };

  // 删除
  const deleteMutation = trpc.objResource.delete.useMutation({
    onSuccess: () => {
      utils.objResource.list.invalidate({ gameId });
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
    if (confirm("确定要删除这个 Object 资源吗？使用它的 Object 将失去关联。")) {
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

  if (!objRes) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="text-6xl mb-4">🔍</div>
          <p className="text-[#858585]">未找到 Object 资源</p>
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
              <span className="text-xs text-[#858585]">{objRes.key}</span>
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
          states={objStates}
          getResource={(key) => formData.resources?.[key as keyof ObjResource]}
          onResourceChange={(key, field, val) =>
            updateResourceField(key as keyof ObjResource, field, val)
          }
          fieldPrefix="objResource"
          gameId={gameId!}
          gameSlug={gameSlug!}
        />
      </div>
    </div>
  );
}
