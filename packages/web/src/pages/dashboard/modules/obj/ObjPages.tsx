/**
 * Object 编辑页面 - 完整实现
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { trpc } from "../../../../lib/trpc";
import { useToast } from "../../../../contexts/ToastContext";
import { DetailPageLayout } from "../../components/DetailPageLayout";
import type { DetailTab } from "../../components/DetailPageLayout";
import { EditorEmptyState } from "../../components/EditorEmptyState";
import { useDashboard } from "../../DashboardContext";
import { NumberInput, ResourceFilePicker } from "../../../../components/common";
import { ResourceListPicker } from "../../../../components/common/pickers";
import { ResourceConfigSection } from "../../components/ResourceConfigSection";
import type { StateItem } from "../../components/ResourceConfigSection";
import type {
  Obj,
  ObjKind,
  ObjResource,
  ObjRes,
  ObjState,
} from "@miu2d/types";
import {
  ObjKindLabels,
  ObjStateLabels,
  createDefaultObj,
  createDefaultObjResource,
  getVisibleFieldsByObjKind,
} from "@miu2d/types";
import { ObjPreview } from "./ObjPreview";

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
      description={<>从左侧列表选择一个物体进行编辑，<br />或使用上方按钮创建新物体、导入 INI 文件。</>}
    />
  );
}

// ========== 详情页 ==========

export function ObjDetailPage() {
  const { gameId: gameSlug, objId, tab } = useParams<{ gameId: string; objId: string; tab: string }>();
  const { currentGame, editCache } = useDashboard();
  const gameId = currentGame?.id;
  const navigate = useNavigate();
  const utils = trpc.useUtils();
  const basePath = `/dashboard/${gameSlug}/objs`;
  const isNew = objId === "new";

  // 缓存 key
  const cacheKey = objId ? `obj:${objId}` : null;

  // Tab 类型
  type TabType = "basic" | "resource" | "behavior";
  const validTabs: TabType[] = ["basic", "resource", "behavior"];

  // 当前 Tab - 从 URL 读取
  const activeTab: TabType = validTabs.includes(tab as TabType)
    ? (tab as TabType)
    : "basic";

  // 切换 Tab - 通过导航更新 URL
  const setActiveTab = useCallback((newTab: TabType) => {
    navigate(`${basePath}/${objId}/${newTab}`, { replace: true });
  }, [navigate, basePath, objId]);

  // 查询 Object 详情
  const { data: obj, isLoading } = trpc.obj.get.useQuery(
    { gameId: gameId!, id: objId! },
    { enabled: !!gameId && !!objId && !isNew }
  );

  // 查询资源列表（用于选择器）
  const { data: resourceList } = trpc.objResource.list.useQuery(
    { gameId: gameId! },
    { enabled: !!gameId }
  );

  // 表单状态 - 优先从缓存读取
  const [formData, setFormData] = useState<Partial<Obj>>(() => {
    if (cacheKey && editCache.has(cacheKey)) {
      return editCache.get<Partial<Obj>>(cacheKey) || {};
    }
    return {};
  });

  // 同步表单数据到缓存
  useEffect(() => {
    if (cacheKey && Object.keys(formData).length > 0) {
      editCache.set(cacheKey, formData);
    }
  }, [cacheKey, formData, editCache]);

  // 新建时初始化表单
  useEffect(() => {
    if (isNew && gameId && Object.keys(formData).length === 0) {
      setFormData(createDefaultObj(gameId));
    }
  }, [isNew, gameId, formData]);

  // 加载数据后更新表单（只在没有缓存时）
  useEffect(() => {
    if (obj && cacheKey && !editCache.has(cacheKey)) {
      setFormData(obj);
    }
  }, [obj, cacheKey, editCache]);

  // 查询当前关联的资源详情（使用 formData.resourceId 以便切换后立即更新）
  const currentResourceId = formData.resourceId ?? obj?.resourceId;
  const { data: linkedResource } = trpc.objResource.get.useQuery(
    { gameId: gameId!, id: currentResourceId ?? "" },
    { enabled: !!gameId && !!currentResourceId }
  );

  const toast = useToast();

  // 保存 Object
  const createMutation = trpc.obj.create.useMutation({
    onSuccess: (data) => {
      if (cacheKey) {
        editCache.remove(cacheKey);
      }
      toast.success(`物体「${formData.name || '新物体'}」创建成功`);
      utils.obj.list.invalidate({ gameId: gameId! });
      navigate(`${basePath}/${data.id}/basic`);
    },
  });

  const updateMutation = trpc.obj.update.useMutation({
    onSuccess: () => {
      if (cacheKey) {
        editCache.remove(cacheKey);
      }
      utils.obj.list.invalidate({ gameId: gameId! });
      utils.obj.get.invalidate({ gameId: gameId!, id: objId! });
      toast.success(`物体「${formData.name}」保存成功`);
    },
  });

  const deleteMutation = trpc.obj.delete.useMutation({
    onSuccess: () => {
      if (cacheKey) {
        editCache.remove(cacheKey);
      }
      utils.obj.list.invalidate({ gameId: gameId! });
      toast.success(`物体已删除`);
      navigate(basePath);
    },
  });

  // 根据 Kind 获取可见字段
  const visibleFields = useMemo(() => {
    return new Set(getVisibleFieldsByObjKind(formData.kind || "Static"));
  }, [formData.kind]);

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
      updateMutation.mutate({
        ...formData,
        id: objId,
        gameId,
      } as Obj);
    }
  }, [gameId, objId, isNew, formData, createMutation, updateMutation]);

  const handleDelete = useCallback(() => {
    if (gameId && objId && !isNew) {
      deleteMutation.mutate({ id: objId, gameId });
    }
  }, [gameId, objId, isNew, deleteMutation]);

  const updateField = useCallback(<K extends keyof Obj>(key: K, value: Obj[K]) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
  }, []);

  if (isLoading && !isNew) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-[#858585]">加载中...</div>
      </div>
    );
  }

  // Tab 配置
  const tabs: DetailTab[] = [
    { key: "basic", label: "基础信息", icon: "📝" },
    { key: "resource", label: "资源配置", icon: "🎨" },
    { key: "behavior", label: "行为脚本", icon: "📜" },
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
      onTabChange={(key) => setActiveTab(key as TabType)}
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
  return (
    <section className="bg-[#252526] border border-widget-border rounded-xl overflow-hidden">
      <div className="px-4 py-3 border-b border-widget-border">
        <h2 className="text-sm font-medium text-[#cccccc]">📝 基本信息</h2>
      </div>
      <div className="p-4 grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm text-[#858585] mb-1">物体名称</label>
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
            placeholder="例如: 宝箱1.ini"
            className="w-full px-3 py-2 bg-[#1e1e1e] border border-widget-border rounded-lg text-white focus:outline-none focus:border-focus-border"
          />
        </div>

        <div>
          <label className="block text-sm text-[#858585] mb-1">物体类型</label>
          <select
            value={formData.kind || "Static"}
            onChange={(e) => updateField("kind", e.target.value as ObjKind)}
            className="w-full px-3 py-2 bg-[#1e1e1e] border border-widget-border rounded-lg text-white focus:outline-none focus:border-focus-border"
          >
            {Object.entries(ObjKindLabels).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </div>

        {visibleFields.has("dir") && (
          <div>
            <label className="block text-sm text-[#858585] mb-1">初始方向 (0-7)</label>
            <NumberInput
              min={0}
              max={7}
              value={formData.dir ?? 0}
              onChange={(val) => updateField("dir", val ?? 0)}
              className="w-full"
            />
          </div>
        )}

        {visibleFields.has("lum") && (
          <div>
            <label className="block text-sm text-[#858585] mb-1">亮度/透明度</label>
            <NumberInput
              min={0}
              max={255}
              value={formData.lum ?? 0}
              onChange={(val) => updateField("lum", val ?? 0)}
              className="w-full"
            />
          </div>
        )}

        {visibleFields.has("damage") && (
          <div>
            <label className="block text-sm text-[#858585] mb-1">伤害值</label>
            <NumberInput
              min={0}
              value={formData.damage ?? 0}
              onChange={(val) => updateField("damage", val ?? 0)}
              className="w-full"
            />
          </div>
        )}

        {visibleFields.has("frame") && (
          <div>
            <label className="block text-sm text-[#858585] mb-1">当前帧</label>
            <NumberInput
              min={0}
              value={formData.frame ?? 0}
              onChange={(val) => updateField("frame", val ?? 0)}
              className="w-full"
            />
          </div>
        )}

        {visibleFields.has("height") && (
          <div>
            <label className="block text-sm text-[#858585] mb-1">高度</label>
            <NumberInput
              min={0}
              value={formData.height ?? 0}
              onChange={(val) => updateField("height", val ?? 0)}
              className="w-full"
            />
          </div>
        )}

        {visibleFields.has("offX") && (
          <div>
            <label className="block text-sm text-[#858585] mb-1">X 偏移</label>
            <NumberInput
              value={formData.offX ?? 0}
              onChange={(val) => updateField("offX", val ?? 0)}
              className="w-full"
            />
          </div>
        )}

        {visibleFields.has("offY") && (
          <div>
            <label className="block text-sm text-[#858585] mb-1">Y 偏移</label>
            <NumberInput
              value={formData.offY ?? 0}
              onChange={(val) => updateField("offY", val ?? 0)}
              className="w-full"
            />
          </div>
        )}

        {visibleFields.has("millisecondsToRemove") && (
          <div>
            <label className="block text-sm text-[#858585] mb-1">移除延迟(毫秒)</label>
            <NumberInput
              min={0}
              value={formData.millisecondsToRemove ?? 0}
              onChange={(val) => updateField("millisecondsToRemove", val ?? 0)}
              className="w-full"
            />
          </div>
        )}
      </div>
    </section>
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
            <p className="text-[#858585] text-sm">
              请选择一个 Object 资源配置来查看资源
            </p>
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
  return (
    <div className="space-y-5">
      {/* 脚本配置 */}
      <section className="bg-[#252526] border border-widget-border rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-widget-border">
          <h2 className="text-sm font-medium text-[#cccccc]">📜 脚本配置</h2>
        </div>
        <div className="p-4 space-y-3">
          {visibleFields.has("scriptFile") && (
            <ResourceFilePicker
              label="交互脚本"
              value={formData.scriptFile}
              onChange={(v) => updateField("scriptFile", v)}
              fieldName="obj_scriptFile"
              gameId={gameId}
              gameSlug={gameSlug}
              extensions={[".txt"]}
              placeholder="点击选择"
            />
          )}

          {visibleFields.has("scriptFileRight") && (
            <ResourceFilePicker
              label="右键脚本"
              value={formData.scriptFileRight}
              onChange={(v) => updateField("scriptFileRight", v)}
              fieldName="obj_scriptFileRight"
              gameId={gameId}
              gameSlug={gameSlug}
              extensions={[".txt"]}
              placeholder="点击选择"
            />
          )}

          {visibleFields.has("timerScriptFile") && (
            <ResourceFilePicker
              label="定时脚本"
              value={formData.timerScriptFile}
              onChange={(v) => updateField("timerScriptFile", v)}
              fieldName="obj_timerScriptFile"
              gameId={gameId}
              gameSlug={gameSlug}
              extensions={[".txt"]}
              placeholder="点击选择"
            />
          )}

          {visibleFields.has("timerScriptInterval") && (
            <div>
              <label className="block text-sm text-[#858585] mb-1">定时脚本间隔(毫秒)</label>
              <NumberInput
                min={0}
                value={formData.timerScriptInterval ?? 3000}
                onChange={(val) => updateField("timerScriptInterval", val ?? 3000)}
                className="w-full"
              />
            </div>
          )}

          {visibleFields.has("reviveNpcIni") && (
            <ResourceFilePicker
              label="复活NPC配置"
              value={formData.reviveNpcIni}
              onChange={(v) => updateField("reviveNpcIni", v)}
              fieldName="obj_reviveNpcIni"
              gameId={gameId}
              gameSlug={gameSlug}
              extensions={[".ini"]}
              placeholder="点击选择"
            />
          )}

          {visibleFields.has("wavFile") && (
            <ResourceFilePicker
              label="音效文件"
              value={formData.wavFile}
              onChange={(v) => updateField("wavFile", v)}
              fieldName="obj_wavFile"
              gameId={gameId}
              gameSlug={gameSlug}
              extensions={[".wav", ".ogg", ".xnb"]}
              placeholder="点击选择"
            />
          )}
        </div>
      </section>

      {/* 交互配置 */}
      <section className="bg-[#252526] border border-widget-border rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-widget-border">
          <h2 className="text-sm font-medium text-[#cccccc]">🎮 交互配置</h2>
        </div>
        <div className="p-4 grid grid-cols-2 gap-4">
          {visibleFields.has("canInteractDirectly") && (
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="canInteractDirectly"
                checked={formData.canInteractDirectly === 1}
                onChange={(e) => updateField("canInteractDirectly", e.target.checked ? 1 : 0)}
                className="rounded"
              />
              <label htmlFor="canInteractDirectly" className="text-sm text-[#cccccc]">
                可远程交互（无需靠近）
              </label>
            </div>
          )}

          {visibleFields.has("scriptFileJustTouch") && (
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="scriptFileJustTouch"
                checked={formData.scriptFileJustTouch === 1}
                onChange={(e) => updateField("scriptFileJustTouch", e.target.checked ? 1 : 0)}
                className="rounded"
              />
              <label htmlFor="scriptFileJustTouch" className="text-sm text-[#cccccc]">
                仅触碰触发脚本
              </label>
            </div>
          )}
        </div>
      </section>
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
          onResourceChange={(key, field, val) => updateResourceField(key as keyof ObjResource, field, val)}
          fieldPrefix="objResource"
          gameId={gameId!}
          gameSlug={gameSlug!}
        />
      </div>
    </div>
  );
}
