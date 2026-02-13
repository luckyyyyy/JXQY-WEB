/**
 * 武功编辑页面 - 完整实现
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { trpc } from "../../../../lib/trpc";
import { useToast } from "../../../../contexts/ToastContext";
import { DetailPageLayout } from "../../components/DetailPageLayout";
import type { DetailTab } from "../../components/DetailPageLayout";
import { EditorEmptyState } from "../../components/EditorEmptyState";
import { useDashboard } from "../../DashboardContext";
import { ResourceFieldGroup } from "../../../../components/common/ResourceFilePicker";
import { NumberInput } from "@/components/common";
import type {
  Magic,
  MagicLevel,
  MagicMoveKind,
  MagicSpecialKind,
  MagicBelong,
  MagicUserType,
  MagicRegionType,
} from "@miu2d/types";
import {
  MagicMoveKindLabels,
  MagicSpecialKindLabels,
  MagicBelongLabels,
  MagicRegionTypeLabels,
  MagicRegionTypeValues,
  MagicRegionTypeFromValue,
  getVisibleFieldsByMoveKind,
  createDefaultMagic,
  createDefaultLevels,
} from "@miu2d/types";
import { MagicPreview } from "./MagicPreview";


// ========== 列表页（欢迎页面） ==========

export function MagicListPage() {
  return (
    <EditorEmptyState
      icon="⚔️"
      title="武功编辑"
      description={<>从左侧列表选择一个武功进行编辑，<br />或使用上方按钮创建新武功、导入 INI 文件。</>}
    />
  );
}

// ========== 详情页 ==========

export function MagicDetailPage() {
  const { gameId: gameSlug, magicId, tab } = useParams<{ gameId: string; magicId: string; tab: string }>();
  const { currentGame, editCache } = useDashboard();
  const gameId = currentGame?.id; // 真正的 UUID
  const navigate = useNavigate();
  const utils = trpc.useUtils();
  const basePath = `/dashboard/${gameSlug}/magic`;
  const isNew = magicId === "new";

  // 缓存 key
  const cacheKey = magicId ? `magic:${magicId}` : null;

  // Tab 类型
  type TabType = "basic" | "resource" | "levels" | "attack";
  const validTabs: TabType[] = ["basic", "resource", "levels", "attack"];

  // 当前 Tab - 从 URL 读取（兼容旧的 effect tab）
  const activeTab: TabType = validTabs.includes(tab as TabType)
    ? (tab as TabType)
    : tab === "effect" ? "basic" : "basic";

  // 切换 Tab - 通过导航更新 URL
  const setActiveTab = useCallback((newTab: TabType) => {
    navigate(`${basePath}/${magicId}/${newTab}`, { replace: true });
  }, [navigate, basePath, magicId]);

  // URL 参数获取类型
  const searchParams = new URLSearchParams(window.location.search);
  const userTypeParam = searchParams.get("type") as MagicUserType | null;

  // 查询武功详情
  const { data: magic, isLoading } = trpc.magic.get.useQuery(
    { gameId: gameId!, id: magicId! },
    { enabled: !!gameId && !!magicId && !isNew }
  );

  // 表单状态 - 优先从缓存读取
  const [formData, setFormData] = useState<Partial<Magic>>(() => {
    if (cacheKey && editCache.has(cacheKey)) {
      return editCache.get<Partial<Magic>>(cacheKey) || {};
    }
    return {};
  });

  // 当前预览的等级 - 也从缓存读取
  const [previewLevel, setPreviewLevel] = useState(() => {
    if (cacheKey) {
      const cached = editCache.get<{ previewLevel?: number }>(`${cacheKey}:meta`);
      return cached?.previewLevel || 1;
    }
    return 1;
  });

  // 同步表单数据到缓存
  useEffect(() => {
    if (cacheKey && Object.keys(formData).length > 0) {
      editCache.set(cacheKey, formData);
    }
  }, [cacheKey, formData, editCache]);

  // 同步 meta 数据到缓存（不再存 activeTab，因为已在 URL 中）
  useEffect(() => {
    if (cacheKey) {
      editCache.set(`${cacheKey}:meta`, { previewLevel });
    }
  }, [cacheKey, previewLevel, editCache]);

  // 新建时初始化表单
  useEffect(() => {
    if (isNew && gameId && Object.keys(formData).length === 0) {
      setFormData(createDefaultMagic(gameId, userTypeParam || "player"));
    }
  }, [isNew, gameId, userTypeParam, formData]);

  // 加载数据后更新表单（只在没有缓存时）
  useEffect(() => {
    if (magic && cacheKey && !editCache.has(cacheKey)) {
      setFormData(magic);
      // NPC 武功没有 levels tab，如果当前 tab 是 levels 则切换到 basic
      if (magic.userType !== "player" && activeTab === "levels") {
        navigate(`${basePath}/${magicId}/basic`, { replace: true });
      }
    }
  }, [magic, cacheKey, editCache, activeTab, navigate, basePath, magicId]);

  const toast = useToast();

  // 保存武功
  const createMutation = trpc.magic.create.useMutation({
    onSuccess: (data) => {
      // 保存成功后清除缓存
      if (cacheKey) {
        editCache.remove(cacheKey);
        editCache.remove(`${cacheKey}:meta`);
      }
      toast.success(`武功「${formData.name || '新武功'}」创建成功`);
      navigate(`${basePath}/${data.id}/basic`);
    },
  });

  const updateMutation = trpc.magic.update.useMutation({
    onSuccess: () => {
      // 保存成功后清除缓存
      if (cacheKey) {
        editCache.remove(cacheKey);
        editCache.remove(`${cacheKey}:meta`);
      }
      utils.magic.list.invalidate({ gameId: gameId! });
      utils.magic.get.invalidate({ gameId: gameId!, id: magicId! });
      toast.success(`武功「${formData.name}」保存成功`);
    },
  });

  const deleteMutation = trpc.magic.delete.useMutation({
    onSuccess: () => {
      // 删除成功后清除缓存
      if (cacheKey) {
        editCache.remove(cacheKey);
        editCache.remove(`${cacheKey}:meta`);
      }
      // 刷新左侧武功列表
      if (gameId) {
        utils.magic.list.invalidate({ gameId });
      }
      toast.success(`武功已删除`);
      navigate(basePath);
    },
  });

  // 根据 MoveKind 获取可见字段
  const visibleFields = useMemo(() => {
    return new Set(getVisibleFieldsByMoveKind(formData.moveKind || "SingleMove"));
  }, [formData.moveKind]);

  const handleSave = useCallback(() => {
    if (!gameId) return;

    if (isNew) {
      createMutation.mutate({
        gameId,
        userType: formData.userType || "player",
        key: formData.key || `magic_${Date.now()}`,
        name: formData.name || "新武功",
        intro: formData.intro,
        moveKind: formData.moveKind,
        specialKind: formData.specialKind,
        belong: formData.belong,
      });
    } else if (magicId) {
      updateMutation.mutate({
        ...formData,
        id: magicId,
        gameId,
      } as Magic);
    }
  }, [gameId, magicId, isNew, formData, createMutation, updateMutation]);

  const handleDelete = useCallback(() => {
    if (gameId && magicId && !isNew) {
      deleteMutation.mutate({ id: magicId, gameId });
    }
  }, [gameId, magicId, isNew, deleteMutation]);

  const updateField = useCallback(<K extends keyof Magic>(key: K, value: Magic[K]) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
  }, []);

  const updateLevel = useCallback((levelIndex: number, field: keyof MagicLevel, value: unknown) => {
    setFormData((prev) => {
      const levels = [...(prev.levels || createDefaultLevels())];
      levels[levelIndex] = { ...levels[levelIndex], [field]: value };
      return { ...prev, levels };
    });
  }, []);

  if (isLoading && !isNew) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-[#858585]">加载中...</div>
      </div>
    );
  }

  const isPlayerMagic = formData.userType === "player";
  const currentLevelData = formData.levels?.[previewLevel - 1];

  // Tab 配置
  const tabs: DetailTab[] = [
    { key: "basic", label: "基础设置", icon: "⚙️" },
    { key: "resource", label: "资源文件", icon: "🎨" },
    ...(isPlayerMagic ? [{ key: "levels", label: "等级配置", icon: "📊" }] : []),
    { key: "attack", label: "攻击配置", icon: "⚔️" },
  ];

  return (
    <DetailPageLayout
      backPath={basePath}
      title={isNew ? "新建武功" : formData.name || "武功详情"}
      subtitle={
        <>
          {isPlayerMagic ? "玩家武功" : "NPC 武功"}
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
        <div className="w-96 flex-shrink-0 space-y-4">
          <div className="sticky top-6">
            <div className="bg-[#252526] border border-widget-border rounded-xl overflow-hidden">
              <div className="px-4 py-3 border-b border-widget-border flex items-center justify-between">
                <h3 className="text-sm font-medium text-[#cccccc]">⚡ 武功预览</h3>
              </div>
              <div className="p-4">
                <MagicPreview
                  gameSlug={gameSlug!}
                  magic={formData as Magic}
                  level={previewLevel}
                />
              </div>
            </div>

            {/* 等级数据预览 */}
            {isPlayerMagic && currentLevelData && (
              <div className="bg-[#252526] border border-widget-border rounded-xl overflow-hidden mt-4">
                <div className="px-4 py-3 border-b border-widget-border flex items-center justify-between">
                  <h3 className="text-sm font-medium text-[#cccccc]">
                    📊 等级 {previewLevel}
                  </h3>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setPreviewLevel((l) => Math.max(1, l - 1))}
                      disabled={previewLevel <= 1}
                      className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-[#3c3c3c] disabled:opacity-30 text-[#858585]"
                    >
                      ◀
                    </button>
                    <span className="text-sm text-[#cccccc] w-6 text-center font-medium">{previewLevel}</span>
                    <button
                      type="button"
                      onClick={() => setPreviewLevel((l) => Math.min(10, l + 1))}
                      disabled={previewLevel >= 10}
                      className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-[#3c3c3c] disabled:opacity-30 text-[#858585]"
                    >
                      ▶
                    </button>
                  </div>
                </div>
                <div className="p-4 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-[#858585]">效果值</span>
                    <span className="text-[#cccccc] font-medium">{currentLevelData.effect}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-[#858585]">内力消耗</span>
                    <span className="text-[#cccccc] font-medium">{currentLevelData.manaCost}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-[#858585]">升级经验</span>
                    <span className="text-[#cccccc] font-medium">{currentLevelData.levelupExp ?? "-"}</span>
                  </div>
                  {currentLevelData.speed !== undefined && (
                    <div className="flex justify-between text-sm">
                      <span className="text-[#858585]">速度</span>
                      <span className="text-[#cccccc] font-medium">{currentLevelData.speed}</span>
                    </div>
                  )}
                  {currentLevelData.moveKind && (
                    <div className="flex justify-between text-sm">
                      <span className="text-[#858585]">移动类型</span>
                      <span className="text-[#cccccc] font-medium">
                        {MagicMoveKindLabels[currentLevelData.moveKind]}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      }
    >
            {activeTab === "basic" && (
              <BasicInfoSection
                formData={formData}
                updateField={updateField}
                isPlayerMagic={isPlayerMagic}
                visibleFields={visibleFields}
              />
            )}

            {activeTab === "resource" && (
              <ResourceSection
                formData={formData}
                updateField={updateField}
                gameId={gameId!}
                gameSlug={gameSlug!}
              />
            )}

            {activeTab === "levels" && isPlayerMagic && (
              <LevelsSection
                levels={formData.levels || createDefaultLevels()}
                updateLevel={updateLevel}
                previewLevel={previewLevel}
                setPreviewLevel={setPreviewLevel}
              />
            )}

            {activeTab === "attack" && (
              <AttackFileSection
                attackFile={formData.attackFile}
                updateField={updateField}
              />
            )}
    </DetailPageLayout>
  );
}

// ========== 基础设置区（合并基础信息和运动特效）==========

function BasicInfoSection({
  formData,
  updateField,
  isPlayerMagic,
  visibleFields,
}: {
  formData: Partial<Magic>;
  updateField: <K extends keyof Magic>(key: K, value: Magic[K]) => void;
  isPlayerMagic: boolean;
  visibleFields: Set<string>;
}) {
  const isRegionBased = formData.moveKind === "RegionBased";

  return (
    <div className="space-y-5">
      {/* 基本信息 */}
      <section className="bg-[#252526] border border-widget-border rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-widget-border">
          <h2 className="text-sm font-medium text-[#cccccc]">📝 基本信息</h2>
        </div>
        <div className="p-4 grid grid-cols-2 gap-4">
          {/* 武功类型选择 */}
          <div>
            <label className="block text-sm text-[#858585] mb-1">武功类型</label>
            <select
              value={formData.userType || "player"}
              onChange={(e) => updateField("userType", e.target.value as MagicUserType)}
              className="w-full px-3 py-2 bg-[#1e1e1e] border border-widget-border rounded-lg text-white focus:outline-none focus:border-focus-border"
            >
              <option value="player">玩家武功</option>
              <option value="npc">NPC 武功</option>
            </select>
          </div>

          <div>
            <label className="block text-sm text-[#858585] mb-1">武功名称</label>
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
              placeholder="例如: magic01.ini"
              className="w-full px-3 py-2 bg-[#1e1e1e] border border-widget-border rounded-lg text-white focus:outline-none focus:border-focus-border"
            />
          </div>

          {isPlayerMagic && (
            <div>
              <label className="block text-sm text-[#858585] mb-1">门派从属</label>
              <select
                value={formData.belong || "Neutral"}
                onChange={(e) => updateField("belong", e.target.value as MagicBelong)}
                className="w-full px-3 py-2 bg-[#1e1e1e] border border-widget-border rounded-lg text-white focus:outline-none focus:border-focus-border"
              >
                {Object.entries(MagicBelongLabels).map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="col-span-2">
            <label className="block text-sm text-[#858585] mb-1">武功介绍</label>
            <textarea
              rows={2}
              value={formData.intro || ""}
              onChange={(e) => updateField("intro", e.target.value)}
              className="w-full px-3 py-2 bg-[#1e1e1e] border border-widget-border rounded-lg text-white focus:outline-none focus:border-focus-border resize-none"
            />
          </div>
        </div>
      </section>

      {/* 运动类型 */}
      <section className="bg-[#252526] border border-widget-border rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-widget-border">
          <h2 className="text-sm font-medium text-[#cccccc]">🎯 运动类型</h2>
        </div>
        <div className="p-4 grid grid-cols-3 gap-4">
          <div className="col-span-2">
            <label className="block text-sm text-[#858585] mb-1">移动类型</label>
            <select
              value={formData.moveKind || "SingleMove"}
              onChange={(e) => updateField("moveKind", e.target.value as MagicMoveKind)}
              className="w-full px-3 py-2 bg-[#1e1e1e] border border-widget-border rounded-lg text-white focus:outline-none focus:border-focus-border"
            >
              {Object.entries(MagicMoveKindLabels).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm text-[#858585] mb-1">速度</label>
            <NumberInput
              min={0}
              max={32}
              value={formData.speed ?? 8}
              onChange={(val) => updateField("speed", val ?? 0)}
            />
          </div>

          {/* 区域类型 - 仅当 moveKind 为 RegionBased 时显示 */}
          {isRegionBased && (
            <>
              <div>
                <label className="block text-sm text-[#858585] mb-1">区域形状</label>
                <select
                  value={MagicRegionTypeFromValue[formData.region ?? 1] || "Square"}
                  onChange={(e) => updateField("region", MagicRegionTypeValues[e.target.value as MagicRegionType])}
                  className="w-full px-3 py-2 bg-[#1e1e1e] border border-widget-border rounded-lg text-white focus:outline-none focus:border-focus-border"
                >
                  {Object.entries(MagicRegionTypeLabels).map(([key, label]) => (
                    <option key={key} value={key}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm text-[#858585] mb-1">范围半径</label>
                <NumberInput
                  min={0}
                  value={formData.rangeRadius ?? 0}
                  onChange={(val) => updateField("rangeRadius", val ?? 0)}
                />
              </div>
            </>
          )}

          {/* 非区域类型的范围半径 */}
          {!isRegionBased && visibleFields.has("rangeRadius") && (
            <div>
              <label className="block text-sm text-[#858585] mb-1">范围半径</label>
              <NumberInput
                min={0}
                value={formData.rangeRadius ?? 0}
                onChange={(val) => updateField("rangeRadius", val ?? 0)}
              />
            </div>
          )}

          <div>
            <label className="block text-sm text-[#858585] mb-1">等待帧数</label>
            <NumberInput
              min={0}
              value={formData.waitFrame ?? 0}
              onChange={(val) => updateField("waitFrame", val ?? 0)}
            />
          </div>

          <div>
            <label className="block text-sm text-[#858585] mb-1">生命帧数</label>
            <NumberInput
              min={0}
              value={formData.lifeFrame ?? 4}
              onChange={(val) => updateField("lifeFrame", val ?? 0)}
            />
          </div>

          {/* 条件字段 - 穿透相关 */}
          {visibleFields.has("passThrough") && (
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="passThrough"
                checked={formData.passThrough || false}
                onChange={(e) => updateField("passThrough", e.target.checked)}
                className="w-4 h-4 bg-[#1e1e1e] border border-widget-border rounded-lg"
              />
              <label htmlFor="passThrough" className="text-sm text-[#858585]">
                穿透敌人
              </label>
            </div>
          )}

          {visibleFields.has("passThroughWall") && (
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="passThroughWall"
                checked={formData.passThroughWall || false}
                onChange={(e) => updateField("passThroughWall", e.target.checked)}
                className="w-4 h-4 bg-[#1e1e1e] border border-widget-border rounded-lg"
              />
              <label htmlFor="passThroughWall" className="text-sm text-[#858585]">
                穿墙
              </label>
            </div>
          )}

          {visibleFields.has("attackAll") && (
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="attackAll"
                checked={formData.attackAll || false}
                onChange={(e) => updateField("attackAll", e.target.checked)}
                className="w-4 h-4 bg-[#1e1e1e] border border-widget-border rounded-lg"
              />
              <label htmlFor="attackAll" className="text-sm text-[#858585]">
                攻击全部
              </label>
            </div>
          )}

          {/* 追踪相关 */}
          {visibleFields.has("traceEnemy") && (
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="traceEnemy"
                checked={formData.traceEnemy || false}
                onChange={(e) => updateField("traceEnemy", e.target.checked)}
                className="w-4 h-4 bg-[#1e1e1e] border border-widget-border rounded-lg"
              />
              <label htmlFor="traceEnemy" className="text-sm text-[#858585]">
                追踪敌人
              </label>
            </div>
          )}

          {visibleFields.has("traceSpeed") && formData.traceEnemy && (
            <div>
              <label className="block text-sm text-[#858585] mb-1">追踪速度</label>
              <NumberInput
                min={0}
                value={formData.traceSpeed ?? 0}
                onChange={(val) => updateField("traceSpeed", val ?? 0)}
              />
            </div>
          )}
        </div>
      </section>

      {/* 特殊效果 */}
      <section className="bg-[#252526] border border-widget-border rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-widget-border">
          <h2 className="text-sm font-medium text-[#cccccc]">✨ 特殊效果</h2>
        </div>
        <div className="p-4 grid grid-cols-3 gap-4">
          <div>
            <label className="block text-sm text-[#858585] mb-1">特殊效果</label>
            <select
              value={formData.specialKind || "None"}
              onChange={(e) => updateField("specialKind", e.target.value as MagicSpecialKind)}
              className="w-full px-3 py-2 bg-[#1e1e1e] border border-widget-border rounded-lg text-white focus:outline-none focus:border-focus-border"
            >
              {Object.entries(MagicSpecialKindLabels).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          </div>

          {visibleFields.has("specialKindValue") && (
            <div>
              <label className="block text-sm text-[#858585] mb-1">效果值</label>
              <NumberInput
                value={formData.specialKindValue ?? 0}
                onChange={(val) => updateField("specialKindValue", val ?? 0)}
              />
            </div>
          )}

          {visibleFields.has("specialKindMilliSeconds") && (
            <div>
              <label className="block text-sm text-[#858585] mb-1">持续时间(ms)</label>
              <NumberInput
                min={0}
                value={formData.specialKindMilliSeconds ?? 0}
                onChange={(val) => updateField("specialKindMilliSeconds", val ?? 0)}
              />
            </div>
          )}

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="alphaBlend"
              checked={formData.alphaBlend || false}
              onChange={(e) => updateField("alphaBlend", e.target.checked)}
              className="w-4 h-4 bg-[#1e1e1e] border border-widget-border rounded-lg"
            />
            <label htmlFor="alphaBlend" className="text-sm text-[#858585]">
              透明混合
            </label>
          </div>

          <div>
            <label className="block text-sm text-[#858585] mb-1">飞行亮度 (0-31)</label>
            <NumberInput
              min={0}
              max={31}
              value={formData.flyingLum ?? 0}
              onChange={(val) => updateField("flyingLum", val ?? 0)}
            />
          </div>

          <div>
            <label className="block text-sm text-[#858585] mb-1">消失亮度 (0-31)</label>
            <NumberInput
              min={0}
              max={31}
              value={formData.vanishLum ?? 0}
              onChange={(val) => updateField("vanishLum", val ?? 0)}
            />
          </div>
        </div>
      </section>
    </div>
  );
}

// ========== 资源文件区 ==========

function ResourceSection({
  formData,
  updateField,
  gameId,
  gameSlug,
}: {
  formData: Partial<Magic>;
  updateField: <K extends keyof Magic>(key: K, value: Magic[K]) => void;
  gameId: string;
  gameSlug: string;
}) {
  const resourceFields = [
    { key: "image", label: "武功图像", extensions: ["asf", "msf", "mpc"] },
    { key: "icon", label: "武功图标", extensions: ["asf", "msf", "mpc"] },
    { key: "flyingImage", label: "飞行图像", extensions: ["asf", "msf"] },
    { key: "vanishImage", label: "消失图像", extensions: ["asf", "msf"] },
    { key: "superModeImage", label: "超级模式图像", extensions: ["asf", "msf"] },
    { key: "flyingSound", label: "飞行音效", extensions: ["wav", "ogg"] },
    { key: "vanishSound", label: "消失音效", extensions: ["wav", "ogg"] },
  ];

  // 构建当前数据
  const data: Record<string, string | null | undefined> = {
    image: formData.image,
    icon: formData.icon,
    flyingImage: formData.flyingImage,
    vanishImage: formData.vanishImage,
    superModeImage: formData.superModeImage,
    flyingSound: formData.flyingSound,
    vanishSound: formData.vanishSound,
    actionFile: formData.actionFile,
  };

  // 更新字段
  const handleUpdateField = useCallback((key: string, value: string | null) => {
    updateField(key as keyof Magic, value as Magic[keyof Magic]);
  }, [updateField]);

  return (
    <section className="bg-[#252526] border border-widget-border rounded-xl overflow-hidden">
      <div className="px-4 py-3 border-b border-widget-border">
        <h2 className="text-sm font-medium text-[#cccccc]">🎨 资源文件</h2>
      </div>
      <div className="p-4 space-y-4">
        <ResourceFieldGroup
          fields={resourceFields}
          data={data}
          updateField={handleUpdateField}
          gameId={gameId}
          gameSlug={gameSlug}
        />

        {/* 动作文件（玩家武功专用） */}
        {formData.userType === "player" && (
          <ResourceFieldGroup
            fields={[{ key: "actionFile", label: "动作文件名", extensions: ["asf", "msf"] }]}
            data={data}
            updateField={handleUpdateField}
            gameId={gameId}
            gameSlug={gameSlug}
          />
        )}
      </div>
    </section>
  );
}

// ========== 等级配置区 ==========

function LevelsSection({
  levels,
  updateLevel,
  previewLevel,
  setPreviewLevel,
}: {
  levels: MagicLevel[];
  updateLevel: (index: number, field: keyof MagicLevel, value: unknown) => void;
  previewLevel: number;
  setPreviewLevel: (level: number) => void;
}) {
  return (
    <section className="bg-[#252526] border border-widget-border rounded-xl overflow-hidden">
      <div className="px-4 py-3 border-b border-widget-border">
        <h2 className="text-sm font-medium text-[#cccccc]">📊 等级配置</h2>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-[#1e1e1e] text-left text-[#858585]">
              <th className="px-4 py-3 font-medium">Lv</th>
              <th className="px-4 py-3 font-medium">效果值</th>
              <th className="px-4 py-3 font-medium">内力</th>
              <th className="px-4 py-3 font-medium">升级经验</th>
              <th className="px-4 py-3 font-medium">速度</th>
              <th className="px-4 py-3 font-medium">移动类型</th>
              <th className="px-4 py-3 font-medium text-center">预览</th>
            </tr>
          </thead>
          <tbody>
            {levels.map((level, index) => (
              <tr
                key={level.level}
                onClick={() => setPreviewLevel(level.level)}
                className={`border-t border-widget-border transition-colors cursor-pointer ${
                  previewLevel === level.level ? "bg-[#0e639c]/15" : "hover:bg-[#2a2d2e]"
                }`}
              >
                <td className="px-4 py-2.5 text-[#cccccc] font-medium">{level.level}</td>
                <td className="px-4 py-2.5">
                  <NumberInput
                    value={level.effect}
                    onClick={(e) => e.stopPropagation()}
                    onChange={(val) => updateLevel(index, "effect", val ?? 0)}
                    className="w-20"
                  />
                </td>
                <td className="px-4 py-2.5">
                  <NumberInput
                    value={level.manaCost}
                    onClick={(e) => e.stopPropagation()}
                    onChange={(val) => updateLevel(index, "manaCost", val ?? 0)}
                    className="w-20"
                  />
                </td>
                <td className="px-4 py-2.5">
                  <NumberInput
                    value={level.levelupExp}
                    onClick={(e) => e.stopPropagation()}
                    onChange={(val) => updateLevel(index, "levelupExp", val)}
                    allowEmpty
                    placeholder={level.level === 10 ? "满级" : "-"}
                    className="w-24"
                  />
                </td>
                <td className="px-4 py-2.5">
                  <NumberInput
                    value={level.speed}
                    onClick={(e) => e.stopPropagation()}
                    onChange={(val) => updateLevel(index, "speed", val ?? undefined)}
                    allowEmpty
                    placeholder="-"
                    className="w-16"
                  />
                </td>
                <td className="px-4 py-2.5">
                  <select
                    value={level.moveKind || ""}
                    onClick={(e) => e.stopPropagation()}
                    onChange={(e) =>
                      updateLevel(
                        index,
                        "moveKind",
                        e.target.value ? (e.target.value as MagicMoveKind) : undefined
                      )
                    }
                    className="w-28 px-2 py-1.5 bg-[#1e1e1e] border border-widget-border rounded-lg text-white text-sm focus:outline-none focus:border-focus-border transition-colors"
                  >
                    <option value="">继承</option>
                    {Object.entries(MagicMoveKindLabels).map(([key, label]) => (
                      <option key={key} value={key}>
                        {label}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="px-4 py-2.5 text-center">
                  <button
                    type="button"
                    onClick={() => setPreviewLevel(level.level)}
                    className={`w-8 h-8 rounded-lg transition-colors ${
                      previewLevel === level.level
                        ? "bg-[#0e639c] text-white"
                        : "hover:bg-[#3c3c3c] text-[#858585]"
                    }`}
                    title="预览此等级"
                  >
                    👁
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

// ========== 攻击配置区 ==========

function AttackFileSection({
  attackFile,
  updateField,
}: {
  attackFile: Magic["attackFile"];
  updateField: <K extends keyof Magic>(key: K, value: Magic[K]) => void;
}) {
  const updateAttackField = useCallback(
    <K extends keyof NonNullable<Magic["attackFile"]>>(
      key: K,
      value: NonNullable<Magic["attackFile"]>[K]
    ) => {
      updateField("attackFile", {
        ...attackFile,
        [key]: value,
      } as Magic["attackFile"]);
    },
    [attackFile, updateField]
  );

  if (!attackFile) {
    return (
      <section className="bg-[#252526] border border-widget-border rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-widget-border">
          <h2 className="text-sm font-medium text-[#cccccc]">⚔️ 攻击配置</h2>
        </div>
        <div className="p-8 text-center text-[#858585]">
          <p className="mb-4">此武功没有攻击配置</p>
          <button
            type="button"
            onClick={() => updateField("attackFile", {
              name: "",
              intro: "",
              moveKind: "SingleMove" as const,
              speed: 8,
              region: 0,
              specialKind: "None" as const,
              specialKindValue: 0,
              specialKindMilliSeconds: 0,
              alphaBlend: false,
              flyingLum: 0,
              vanishLum: 0,
              waitFrame: 0,
              lifeFrame: 4,
              flyingImage: null,
              flyingSound: null,
              vanishImage: null,
              vanishSound: null,
              passThrough: false,
              passThroughWall: false,
              traceEnemy: false,
              traceSpeed: 0,
              rangeRadius: 0,
              attackAll: false,
              bounce: false,
              bounceHurt: 0,
              vibratingScreen: false,
            })}
            className="px-4 py-2 bg-[#0e639c] hover:bg-[#1177bb] text-white rounded-lg transition-colors"
          >
            创建攻击配置
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="bg-[#252526] border border-widget-border rounded-xl overflow-hidden">
      <div className="px-4 py-3 border-b border-widget-border flex items-center justify-between">
        <h2 className="text-sm font-medium text-[#cccccc]">⚔️ 攻击配置</h2>
        <button
          type="button"
          onClick={() => updateField("attackFile", null)}
          className="text-xs text-red-400 hover:text-red-300"
        >
          删除
        </button>
      </div>

      <div className="p-4 grid grid-cols-2 gap-4">
        {/* 基本信息 */}
        <div>
          <label className="block text-sm text-[#858585] mb-1">名称</label>
          <input
            type="text"
            value={attackFile.name || ""}
            onChange={(e) => updateAttackField("name", e.target.value)}
            className="w-full px-3 py-2 bg-[#1e1e1e] border border-widget-border rounded-lg text-white focus:outline-none focus:border-focus-border"
          />
        </div>

        <div>
          <label className="block text-sm text-[#858585] mb-1">移动类型</label>
          <select
            value={attackFile.moveKind || "SingleMove"}
            onChange={(e) => updateAttackField("moveKind", e.target.value as MagicMoveKind)}
            className="w-full px-3 py-2 bg-[#1e1e1e] border border-widget-border rounded-lg text-white focus:outline-none focus:border-focus-border"
          >
            {Object.entries(MagicMoveKindLabels).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm text-[#858585] mb-1">速度</label>
          <NumberInput
            value={attackFile.speed ?? 8}
            onChange={(val) => updateAttackField("speed", val ?? 8)}
            emptyValue={8}
          />
        </div>

        <div>
          <label className="block text-sm text-[#858585] mb-1">区域半径</label>
          <NumberInput
            value={attackFile.rangeRadius ?? 0}
            onChange={(val) => updateAttackField("rangeRadius", val ?? 0)}
          />
        </div>

        <div>
          <label className="block text-sm text-[#858585] mb-1">生命帧数</label>
          <NumberInput
            value={attackFile.lifeFrame ?? 4}
            onChange={(val) => updateAttackField("lifeFrame", val ?? 4)}
            emptyValue={4}
          />
        </div>

        <div>
          <label className="block text-sm text-[#858585] mb-1">特殊效果</label>
          <select
            value={attackFile.specialKind || "None"}
            onChange={(e) => updateAttackField("specialKind", e.target.value as MagicSpecialKind)}
            className="w-full px-3 py-2 bg-[#1e1e1e] border border-widget-border rounded-lg text-white focus:outline-none focus:border-focus-border"
          >
            {Object.entries(MagicSpecialKindLabels).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </div>

        {/* 资源文件 */}
        <div>
          <label className="block text-sm text-[#858585] mb-1">飞行动画</label>
          <input
            type="text"
            value={attackFile.flyingImage || ""}
            onChange={(e) => updateAttackField("flyingImage", e.target.value || null)}
            placeholder="asf/effect/xxx.asf"
            className="w-full px-3 py-2 bg-[#1e1e1e] border border-widget-border rounded-lg text-white focus:outline-none focus:border-focus-border"
          />
        </div>

        <div>
          <label className="block text-sm text-[#858585] mb-1">消散动画</label>
          <input
            type="text"
            value={attackFile.vanishImage || ""}
            onChange={(e) => updateAttackField("vanishImage", e.target.value || null)}
            placeholder="asf/effect/xxx.asf"
            className="w-full px-3 py-2 bg-[#1e1e1e] border border-widget-border rounded-lg text-white focus:outline-none focus:border-focus-border"
          />
        </div>

        {/* 介绍 */}
        <div className="col-span-2">
          <label className="block text-sm text-[#858585] mb-1">介绍</label>
          <textarea
            rows={2}
            value={attackFile.intro || ""}
            onChange={(e) => updateAttackField("intro", e.target.value)}
            className="w-full px-3 py-2 bg-[#1e1e1e] border border-widget-border rounded-lg text-white focus:outline-none focus:border-focus-border resize-none"
          />
        </div>

        {/* 开关选项 */}
        <div className="col-span-2 grid grid-cols-4 gap-3">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={attackFile.passThrough || false}
              onChange={(e) => updateAttackField("passThrough", e.target.checked)}
              className="w-4 h-4"
            />
            <span className="text-sm text-[#cccccc]">穿透敌人</span>
          </label>

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={attackFile.passThroughWall || false}
              onChange={(e) => updateAttackField("passThroughWall", e.target.checked)}
              className="w-4 h-4"
            />
            <span className="text-sm text-[#cccccc]">穿透墙壁</span>
          </label>

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={attackFile.traceEnemy || false}
              onChange={(e) => updateAttackField("traceEnemy", e.target.checked)}
              className="w-4 h-4"
            />
            <span className="text-sm text-[#cccccc]">追踪敌人</span>
          </label>

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={attackFile.attackAll || false}
              onChange={(e) => updateAttackField("attackAll", e.target.checked)}
              className="w-4 h-4"
            />
            <span className="text-sm text-[#cccccc]">群攻</span>
          </label>

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={attackFile.bounce || false}
              onChange={(e) => updateAttackField("bounce", e.target.checked)}
              className="w-4 h-4"
            />
            <span className="text-sm text-[#cccccc]">反弹</span>
          </label>

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={attackFile.vibratingScreen || false}
              onChange={(e) => updateAttackField("vibratingScreen", e.target.checked)}
              className="w-4 h-4"
            />
            <span className="text-sm text-[#cccccc]">震屏</span>
          </label>

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={attackFile.alphaBlend || false}
              onChange={(e) => updateAttackField("alphaBlend", e.target.checked)}
              className="w-4 h-4"
            />
            <span className="text-sm text-[#cccccc]">透明混合</span>
          </label>
        </div>
      </div>
    </section>
  );
}
