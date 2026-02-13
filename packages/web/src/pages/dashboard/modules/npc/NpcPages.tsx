/**
 * NPC 编辑页面 - 完整实现
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
import { MagicPicker, ResourceListPicker } from "../../../../components/common/pickers";
import { ResourceConfigSection } from "../../components/ResourceConfigSection";
import type { StateItem } from "../../components/ResourceConfigSection";
import type {
  Npc,
  NpcKind,
  NpcRelation,
  NpcResource,
  NpcState,
  NpcAppearance,
} from "@miu2d/types";
import {
  NpcKindLabels,
  NpcRelationLabels,
  NpcStateLabels,
  createDefaultNpc,
  createDefaultNpcResource,
  getVisibleFieldsByNpcKind,
  npcStateToResourceKey,
} from "@miu2d/types";
import { NpcPreview } from "./NpcPreview";

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
      description={<>从左侧列表选择一个 NPC 进行编辑，<br />或使用上方按钮创建新 NPC、导入 INI 文件。</>}
    />
  );
}

// ========== 详情页 ==========

export function NpcDetailPage() {
  const { gameId: gameSlug, npcId, tab } = useParams<{ gameId: string; npcId: string; tab: string }>();
  const { currentGame, editCache } = useDashboard();
  const gameId = currentGame?.id;
  const navigate = useNavigate();
  const utils = trpc.useUtils();
  const basePath = `/dashboard/${gameSlug}/npcs`;
  const isNew = npcId === "new";

  // 缓存 key
  const cacheKey = npcId ? `npc:${npcId}` : null;

  // Tab 类型
  type TabType = "basic" | "combat" | "resource" | "behavior";
  const validTabs: TabType[] = ["basic", "combat", "resource", "behavior"];

  // 当前 Tab - 从 URL 读取
  const activeTab: TabType = validTabs.includes(tab as TabType)
    ? (tab as TabType)
    : "basic";

  // 切换 Tab - 通过导航更新 URL
  const setActiveTab = useCallback((newTab: TabType) => {
    navigate(`${basePath}/${npcId}/${newTab}`, { replace: true });
  }, [navigate, basePath, npcId]);

  // 查询 NPC 详情
  const { data: npc, isLoading } = trpc.npc.get.useQuery(
    { gameId: gameId!, id: npcId! },
    { enabled: !!gameId && !!npcId && !isNew }
  );

  // 查询资源列表（用于选择器）
  const { data: resourceList } = trpc.npcResource.list.useQuery(
    { gameId: gameId! },
    { enabled: !!gameId }
  );

  // 表单状态 - 优先从缓存读取
  const [formData, setFormData] = useState<Partial<Npc>>(() => {
    if (cacheKey && editCache.has(cacheKey)) {
      return editCache.get<Partial<Npc>>(cacheKey) || {};
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
      setFormData(createDefaultNpc(gameId));
    }
  }, [isNew, gameId, formData]);

  // 加载数据后更新表单（只在没有缓存时）
  useEffect(() => {
    if (npc && cacheKey && !editCache.has(cacheKey)) {
      setFormData(npc);
    }
  }, [npc, cacheKey, editCache]);

  // 查询当前关联的资源详情（使用 formData.resourceId 以便切换后立即更新）
  const currentResourceId = formData.resourceId ?? npc?.resourceId;
  const { data: linkedResource } = trpc.npcResource.get.useQuery(
    { gameId: gameId!, id: currentResourceId ?? "" },
    { enabled: !!gameId && !!currentResourceId }
  );

  const toast = useToast();

  // 保存 NPC
  const createMutation = trpc.npc.create.useMutation({
    onSuccess: (data) => {
      if (cacheKey) {
        editCache.remove(cacheKey);
      }
      toast.success(`NPC「${formData.name || '新NPC'}」创建成功`);
      utils.npc.list.invalidate({ gameId: gameId! });
      navigate(`${basePath}/${data.id}/basic`);
    },
  });

  const updateMutation = trpc.npc.update.useMutation({
    onSuccess: () => {
      if (cacheKey) {
        editCache.remove(cacheKey);
      }
      utils.npc.list.invalidate({ gameId: gameId! });
      utils.npc.get.invalidate({ gameId: gameId!, id: npcId! });
      toast.success(`NPC「${formData.name}」保存成功`);
    },
  });

  const deleteMutation = trpc.npc.delete.useMutation({
    onSuccess: () => {
      if (cacheKey) {
        editCache.remove(cacheKey);
      }
      utils.npc.list.invalidate({ gameId: gameId! });
      toast.success(`NPC 已删除`);
      navigate(basePath);
    },
  });

  // 根据 Kind 获取可见字段
  const visibleFields = useMemo(() => {
    return new Set(getVisibleFieldsByNpcKind(formData.kind || "Normal"));
  }, [formData.kind]);

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
      });
    } else if (npcId) {
      updateMutation.mutate({
        ...formData,
        id: npcId,
        gameId,
      } as Npc);
    }
  }, [gameId, npcId, isNew, formData, createMutation, updateMutation]);

  const handleDelete = useCallback(() => {
    if (gameId && npcId && !isNew) {
      deleteMutation.mutate({ id: npcId, gameId });
    }
  }, [gameId, npcId, isNew, deleteMutation]);

  const updateField = useCallback(<K extends keyof Npc>(key: K, value: Npc[K]) => {
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
    { key: "combat", label: "战斗属性", icon: "⚔️" },
    { key: "resource", label: "资源配置", icon: "🎨" },
    { key: "behavior", label: "行为脚本", icon: "📜" },
  ];

  return (
    <DetailPageLayout
      backPath={basePath}
      title={isNew ? "新建 NPC" : formData.name || "NPC 详情"}
      subtitle={
        <>
          {NpcKindLabels[formData.kind || "Normal"]} · {NpcRelationLabels[formData.relation || "Friendly"]}
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
                <h3 className="text-sm font-medium text-[#cccccc]">👤 NPC 预览</h3>
              </div>
              <div className="p-4">
                <NpcPreview
                  gameSlug={gameSlug!}
                  npc={formData}
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
              />
            )}

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
}: {
  formData: Partial<Npc>;
  updateField: <K extends keyof Npc>(key: K, value: Npc[K]) => void;
}) {
  return (
    <section className="bg-[#252526] border border-widget-border rounded-xl overflow-hidden">
      <div className="px-4 py-3 border-b border-widget-border">
        <h2 className="text-sm font-medium text-[#cccccc]">📝 基本信息</h2>
      </div>
      <div className="p-4 grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm text-[#858585] mb-1">NPC 名称</label>
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
            placeholder="例如: 惠安镇路人1.ini"
            className="w-full px-3 py-2 bg-[#1e1e1e] border border-widget-border rounded-lg text-white focus:outline-none focus:border-focus-border"
          />
        </div>

        <div>
          <label className="block text-sm text-[#858585] mb-1">NPC 类型</label>
          <select
            value={formData.kind || "Normal"}
            onChange={(e) => updateField("kind", e.target.value as NpcKind)}
            className="w-full px-3 py-2 bg-[#1e1e1e] border border-widget-border rounded-lg text-white focus:outline-none focus:border-focus-border"
          >
            {Object.entries(NpcKindLabels).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm text-[#858585] mb-1">关系</label>
          <select
            value={formData.relation || "Friendly"}
            onChange={(e) => updateField("relation", e.target.value as NpcRelation)}
            className="w-full px-3 py-2 bg-[#1e1e1e] border border-widget-border rounded-lg text-white focus:outline-none focus:border-focus-border"
          >
            {Object.entries(NpcRelationLabels).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm text-[#858585] mb-1">等级</label>
          <NumberInput
            value={formData.level ?? 1}
            onChange={(val) => updateField("level", val ?? 1)}
            className="w-full"
          />
        </div>

        <div>
          <label className="block text-sm text-[#858585] mb-1">移动速度</label>
          <NumberInput
            min={0}
            max={10}
            value={formData.walkSpeed ?? 1}
            onChange={(val) => updateField("walkSpeed", val ?? 1)}
            className="w-full"
          />
        </div>

        <div className="col-span-2">
          <label className="block text-sm text-[#858585] mb-1">描述</label>
          <textarea
            rows={2}
            value={formData.intro || ""}
            onChange={(e) => updateField("intro", e.target.value)}
            className="w-full px-3 py-2 bg-[#1e1e1e] border border-widget-border rounded-lg text-white focus:outline-none focus:border-focus-border resize-none"
          />
        </div>
      </div>
    </section>
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
  return (
    <div className="space-y-5">
      {/* 生命和资源 */}
      <section className="bg-[#252526] border border-widget-border rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-widget-border">
          <h2 className="text-sm font-medium text-[#cccccc]">❤️ 生命与资源</h2>
        </div>
        <div className="p-4 grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-[#858585] mb-1">当前生命</label>
            <NumberInput
              min={0}
              value={formData.life ?? 100}
              onChange={(val) => updateField("life", val ?? 0)}
              className="w-full"
            />
          </div>

          <div>
            <label className="block text-sm text-[#858585] mb-1">最大生命</label>
            <NumberInput
              min={0}
              value={formData.lifeMax ?? 100}
              onChange={(val) => updateField("lifeMax", val ?? 0)}
              className="w-full"
            />
          </div>

          {visibleFields.has("thew") && (
            <>
              <div>
                <label className="block text-sm text-[#858585] mb-1">当前体力</label>
                <NumberInput
                  min={0}
                  value={formData.thew ?? 100}
                  onChange={(val) => updateField("thew", val ?? 0)}
                  className="w-full"
                />
              </div>

              <div>
                <label className="block text-sm text-[#858585] mb-1">最大体力</label>
                <NumberInput
                  min={0}
                  value={formData.thewMax ?? 100}
                  onChange={(val) => updateField("thewMax", val ?? 0)}
                  className="w-full"
                />
              </div>
            </>
          )}

          {visibleFields.has("mana") && (
            <>
              <div>
                <label className="block text-sm text-[#858585] mb-1">当前内力</label>
                <NumberInput
                  min={0}
                  value={formData.mana ?? 100}
                  onChange={(val) => updateField("mana", val ?? 0)}
                  className="w-full"
                />
              </div>

              <div>
                <label className="block text-sm text-[#858585] mb-1">最大内力</label>
                <NumberInput
                  min={0}
                  value={formData.manaMax ?? 100}
                  onChange={(val) => updateField("manaMax", val ?? 0)}
                  className="w-full"
                />
              </div>
            </>
          )}
        </div>
      </section>

      {/* 战斗属性 */}
      {visibleFields.has("attack") && (
        <section className="bg-[#252526] border border-widget-border rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-widget-border">
            <h2 className="text-sm font-medium text-[#cccccc]">⚔️ 战斗属性</h2>
          </div>
          <div className="p-4 grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm text-[#858585] mb-1">攻击力</label>
              <NumberInput
                min={0}
                value={formData.attack ?? 10}
                onChange={(val) => updateField("attack", val ?? 0)}
                className="w-full"
              />
            </div>

            {visibleFields.has("defend") && (
              <div>
                <label className="block text-sm text-[#858585] mb-1">防御力</label>
                <NumberInput
                  min={0}
                  value={formData.defend ?? 5}
                  onChange={(val) => updateField("defend", val ?? 0)}
                  className="w-full"
                />
              </div>
            )}

            {visibleFields.has("evade") && (
              <div>
                <label className="block text-sm text-[#858585] mb-1">闪避值</label>
                <NumberInput
                  min={0}
                  value={formData.evade ?? 10}
                  onChange={(val) => updateField("evade", val ?? 0)}
                  className="w-full"
                />
              </div>
            )}

            {visibleFields.has("attackRadius") && (
              <div>
                <label className="block text-sm text-[#858585] mb-1">攻击范围</label>
                <NumberInput
                  min={1}
                  max={10}
                  value={formData.attackRadius ?? 1}
                  onChange={(val) => updateField("attackRadius", val ?? 1)}
                  className="w-full"
                />
              </div>
            )}

            {visibleFields.has("exp") && (
              <div>
                <label className="block text-sm text-[#858585] mb-1">击杀经验</label>
                <NumberInput
                  min={0}
                  value={formData.exp ?? 0}
                  onChange={(val) => updateField("exp", val ?? 0)}
                  className="w-full"
                />
              </div>
            )}

            {visibleFields.has("flyIni") && (
              <div className="col-span-3">
                <MagicPicker
                  label="飞行攻击"
                  value={formData.flyIni}
                  onChange={(v) => updateField("flyIni", v)}
                  gameId={gameId}
                  gameSlug={gameSlug}
                  placeholder="选择关联武功"
                />
              </div>
            )}
          </div>
        </section>
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
  linkedResource: NpcAppearance | null;
  resourceList: Array<{ id: string; key: string; name: string }>;
  gameId: string;
  gameSlug: string;
}) {
  // 使用关联资源的配置，如果没有则显示空
  const resources = linkedResource?.resources || createDefaultNpcResource();
  const hasLinkedResource = !!formData.resourceId && !!linkedResource;

  return (
    <div className="space-y-5">
      {/* 资源关联选择器（弹窗式） */}
      <section className="bg-[#252526] border border-widget-border rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-widget-border">
          <h2 className="text-sm font-medium text-[#cccccc]">🔗 关联 NPC 资源</h2>
        </div>
        <div className="p-4">
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
        </div>
      </section>

      {/* 资源配置展示（只读，使用 ResourceConfigSection） */}
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

      {/* 未关联资源时的提示 */}
      {!hasLinkedResource && (
        <section className="bg-[#252526] border border-widget-border rounded-xl overflow-hidden">
          <div className="p-8 text-center">
            <div className="text-4xl mb-4">🎨</div>
            <p className="text-[#858585] text-sm">
              请选择一个 NPC 资源配置来查看资源
            </p>
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
  return (
    <div className="space-y-5">
      {/* 脚本配置 */}
      <section className="bg-[#252526] border border-widget-border rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-widget-border">
          <h2 className="text-sm font-medium text-[#cccccc]">📜 脚本配置</h2>
        </div>
        <div className="p-4 space-y-3">
          <ResourceFilePicker
            label="对话脚本"
            value={formData.scriptFile}
            onChange={(v) => updateField("scriptFile", v)}
            fieldName="npc_scriptFile"
            gameId={gameId}
            gameSlug={gameSlug}
            extensions={[".txt"]}
            placeholder="点击选择"
          />

          {visibleFields.has("deathScript") && (
            <ResourceFilePicker
              label="死亡脚本"
              value={formData.deathScript}
              onChange={(v) => updateField("deathScript", v)}
              fieldName="npc_deathScript"
              gameId={gameId}
              gameSlug={gameSlug}
              extensions={[".txt"]}
              placeholder="点击选择"
            />
          )}

          {visibleFields.has("bodyIni") && (
            <ResourceFilePicker
              label="死亡物体"
              value={formData.bodyIni}
              onChange={(v) => updateField("bodyIni", v)}
              fieldName="npc_bodyIni"
              gameId={gameId}
              gameSlug={gameSlug}
              extensions={[".ini"]}
              placeholder="点击选择"
            />
          )}
        </div>
      </section>

      {/* 寻路配置 */}
      {visibleFields.has("pathFinder") && (
        <section className="bg-[#252526] border border-widget-border rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-widget-border">
            <h2 className="text-sm font-medium text-[#cccccc]">🗺️ 寻路配置</h2>
          </div>
          <div className="p-4 grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-[#858585] mb-1">寻路类型</label>
              <select
                value={formData.pathFinder ?? 1}
                onChange={(e) => updateField("pathFinder", parseInt(e.target.value, 10))}
                className="w-full px-3 py-2 bg-[#1e1e1e] border border-widget-border rounded-lg text-white focus:outline-none focus:border-focus-border"
              >
                <option value={0}>简单寻路</option>
                <option value={1}>完整 A* 寻路</option>
              </select>
            </div>

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

            {visibleFields.has("idle") && (
              <div>
                <label className="block text-sm text-[#858585] mb-1">攻击间隔（帧）</label>
                <NumberInput
                  min={0}
                  value={formData.idle ?? 0}
                  onChange={(val) => updateField("idle", val ?? 0)}
                  className="w-full"
                />
              </div>
            )}

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
          </div>
        </section>
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
  const utils = trpc.useUtils();
  const basePath = `/dashboard/${gameSlug}/npcs`;
  const { success: toastSuccess, error: toastError } = useToast();

  // 缓存 key
  const cacheKey = resourceId ? `npc-resource:${resourceId}` : null;

  // 获取资源数据
  const { data: npcRes, isLoading } = trpc.npcResource.get.useQuery(
    { gameId: gameId!, id: resourceId! },
    { enabled: !!gameId && !!resourceId }
  );

  // 初始化表单数据
  const [formData, setFormData] = useState<Partial<NpcAppearance>>({
    name: "",
    resources: createDefaultNpcResource(),
  });

  // 从缓存或 API 加载数据
  useEffect(() => {
    if (cacheKey && editCache.has(cacheKey)) {
      setFormData(editCache.get(cacheKey) as Partial<NpcAppearance>);
    } else if (npcRes) {
      setFormData(npcRes);
      if (cacheKey) {
        editCache.set(cacheKey, npcRes);
      }
    }
  }, [npcRes, cacheKey, editCache]);

  // 更新字段
  const updateField = <K extends keyof NpcAppearance>(key: K, value: NpcAppearance[K]) => {
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
  const updateMutation = trpc.npcResource.update.useMutation({
    onSuccess: () => {
      utils.npcResource.list.invalidate({ gameId });
      utils.npcResource.get.invalidate({ gameId, id: resourceId });
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
  const deleteMutation = trpc.npcResource.delete.useMutation({
    onSuccess: () => {
      utils.npcResource.list.invalidate({ gameId });
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
          onResourceChange={(key, field, val) => updateResourceField(key as keyof NpcResource, field, val)}
          fieldPrefix="npcResource"
          gameId={gameId!}
          gameSlug={gameSlug!}
        />
      </div>
    </div>
  );
}
