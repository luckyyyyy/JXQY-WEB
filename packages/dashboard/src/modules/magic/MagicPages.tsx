/**
 * 武功编辑页面
 */

import { api } from "@miu2d/shared";
import type {
  Magic,
  MagicLevel,
  MagicMoveKind,
  MagicRegionType,
  MagicSpecialKind,
  MagicUserType,
} from "@miu2d/types";
import {
  createDefaultLevels,
  createDefaultMagic,
  getVisibleFieldsByMoveKind,
  MagicBelongLabels,
  MagicMoveKindLabels,
  MagicRegionTypeFromValue,
  MagicRegionTypeLabels,
  MagicRegionTypeValues,
  MagicSpecialKindLabels,
} from "@miu2d/types";
import { NumberInput } from "@miu2d/ui";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import {
  FormCheckbox,
  FormNumberField,
  FormSection,
  FormSelectField,
  FormTextArea,
  FormTextField,
} from "../../components/common";
import { FieldGroupList } from "../../components/common/FieldGrid";
import { ResourceFieldGroup } from "../../components/common/ResourceFilePicker";
import type { DetailTab } from "../../components/DetailPageLayout";
import { DetailPageLayout } from "../../components/DetailPageLayout";
import { EditorEmptyState } from "../../components/EditorEmptyState";
import { useDashboard } from "../../DashboardContext";
import { EntityLoadingState, useEntityEditor } from "../../hooks";
import { MagicPreview } from "./MagicPreview";
import { magicAdvancedGroups } from "./magic-field-defs";

// ========== 列表页（欢迎页面） ==========

export function MagicListPage() {
  return (
    <EditorEmptyState
      icon="⚔️"
      title="武功编辑"
      description={
        <>
          从左侧列表选择一个武功进行编辑，
          <br />
          或使用上方按钮创建新武功、导入 INI 文件。
        </>
      }
    />
  );
}

// ========== 详情页 ==========

type MagicTab = "basic" | "resource" | "levels" | "attack" | "advanced";

export function MagicDetailPage() {
  // ── 查询 ──
  const { gameId: gameSlug, magicId } = useParams<{ gameId: string; magicId: string }>();
  const { currentGame } = useDashboard();
  const gameId = currentGame?.id;

  const { data: magic, isLoading } = api.magic.get.useQuery(
    { gameId: gameId!, id: magicId! },
    { enabled: !!gameId && !!magicId && magicId !== "new" }
  );

  // ── 编辑器 Hook ──
  const editor = useEntityEditor<Magic, MagicTab>({
    entityType: "magic",
    paramKey: "magicId",
    basePath: (slug) => `/dashboard/${slug}/magic`,
    validTabs: ["basic", "resource", "levels", "attack", "advanced"],
    tabAliases: { effect: "basic" },
    createDefault: (gId, sp) =>
      createDefaultMagic(gId, (sp.get("type") as MagicUserType) || "player"),
    entityLabel: "武功",
    serverData: magic,
    isQueryLoading: isLoading,
  });

  const { formData, updateField, setFormData, activeTab, setActiveTab, isNew, basePath, utils } =
    editor;

  // ── 预览等级（武功特有） ──
  const [previewLevel, setPreviewLevel] = useState(() => {
    const ck = editor.cacheKey ? `${editor.cacheKey}:meta` : null;
    const cached = ck ? editor.editCache.get<{ previewLevel?: number }>(ck) : null;
    return cached?.previewLevel ?? 1;
  });

  useEffect(() => {
    if (editor.cacheKey) {
      editor.editCache.set(`${editor.cacheKey}:meta`, { previewLevel });
    }
  }, [editor.cacheKey, previewLevel, editor.editCache]);

  // ── Mutations ──
  const createMutation = api.magic.create.useMutation({
    onSuccess: (data) => {
      editor.onCreateSuccess(data.id);
      utils.magic.list.invalidate({ gameId: gameId! });
    },
  });

  const updateMutation = api.magic.update.useMutation({
    onSuccess: () => {
      editor.onUpdateSuccess();
      utils.magic.list.invalidate({ gameId: gameId! });
      utils.magic.get.invalidate({ gameId: gameId!, id: magicId! });
    },
  });

  const deleteMutation = api.magic.delete.useMutation({
    onSuccess: () => {
      editor.onDeleteSuccess();
      if (gameId) utils.magic.list.invalidate({ gameId });
    },
  });

  // ── 派生状态 ──
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
      updateMutation.mutate({ id: magicId!, gameId, data: formData } as never);
    }
  }, [gameId, magicId, isNew, formData, createMutation, updateMutation]);

  const handleDelete = useCallback(() => {
    if (gameId && magicId && !isNew) {
      deleteMutation.mutate({ id: magicId, gameId });
    }
  }, [gameId, magicId, isNew, deleteMutation]);

  const updateLevel = useCallback(
    (levelIndex: number, field: keyof MagicLevel, value: unknown) => {
      setFormData((prev) => {
        const levels = [...(prev.levels || createDefaultLevels())];
        levels[levelIndex] = { ...levels[levelIndex], [field]: value };
        return { ...prev, levels };
      });
    },
    [setFormData]
  );

  if (editor.isLoading) return <EntityLoadingState />;

  const isPlayerMagic = formData.userType === "player";
  const currentLevelData = formData.levels?.[previewLevel - 1];

  // Tab 配置
  const tabs: DetailTab[] = [
    { key: "basic", label: "基础设置", icon: "⚙️" },
    { key: "resource", label: "资源文件", icon: "🎨" },
    ...(isPlayerMagic ? [{ key: "levels", label: "等级配置", icon: "📊" }] : []),
    { key: "attack", label: "攻击配置", icon: "⚔️" },
    { key: "advanced", label: "高级配置", icon: "🔧" },
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
      onTabChange={(key) => setActiveTab(key as MagicTab)}
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
                <MagicPreview gameSlug={gameSlug!} magic={formData as Magic} level={previewLevel} />
              </div>
            </div>

            {/* 等级数据预览 */}
            {isPlayerMagic && currentLevelData && (
              <div className="bg-[#252526] border border-widget-border rounded-xl overflow-hidden mt-4">
                <div className="px-4 py-3 border-b border-widget-border flex items-center justify-between">
                  <h3 className="text-sm font-medium text-[#cccccc]">📊 等级 {previewLevel}</h3>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setPreviewLevel((l) => Math.max(1, l - 1))}
                      disabled={previewLevel <= 1}
                      className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-[#3c3c3c] disabled:opacity-30 text-[#858585]"
                    >
                      ◀
                    </button>
                    <span className="text-sm text-[#cccccc] w-6 text-center font-medium">
                      {previewLevel}
                    </span>
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
                    <span className="text-[#cccccc] font-medium">
                      {currentLevelData.levelupExp ?? "-"}
                    </span>
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
        <AttackFileSection attackFile={formData.attackFile} updateField={updateField} />
      )}

      {activeTab === "advanced" && (
        <FieldGroupList
          groups={magicAdvancedGroups}
          formData={formData}
          updateField={updateField as (key: string, value: unknown) => void}
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
      <FormSection icon="📝" title="基本信息">
        <FormSelectField<Magic>
          label="武功类型"
          field="userType"
          value={formData}
          onChange={updateField}
          options={{ player: "玩家武功", npc: "NPC 武功" }}
        />
        <FormTextField<Magic>
          label="武功名称"
          field="name"
          value={formData}
          onChange={updateField}
        />
        <FormTextField<Magic>
          label="标识符 (Key)"
          field="key"
          value={formData}
          onChange={updateField}
          placeholder="例如: magic01.ini"
        />
        {isPlayerMagic && (
          <FormSelectField<Magic>
            label="门派从属"
            field="belong"
            value={formData}
            onChange={updateField}
            options={MagicBelongLabels}
          />
        )}
        <FormTextArea<Magic>
          label="武功介绍"
          field="intro"
          value={formData}
          onChange={updateField}
          colSpan={2}
          rows={2}
        />
      </FormSection>

      {/* 运动类型 */}
      <FormSection icon="🎯" title="运动类型" cols={3}>
        <FormSelectField<Magic>
          label="移动类型"
          field="moveKind"
          value={formData}
          onChange={updateField}
          options={MagicMoveKindLabels}
          colSpan={2}
        />
        <FormNumberField<Magic>
          label="速度"
          field="speed"
          value={formData}
          onChange={updateField}
          min={0}
          max={32}
        />

        {/* 区域类型 - 仅当 moveKind 为 RegionBased 时显示 */}
        {isRegionBased && (
          <>
            <FormSelectField<Magic>
              label="区域形状"
              field="region"
              value={
                {
                  ...formData,
                  region: MagicRegionTypeFromValue[formData.region ?? 1] || "Square",
                } as unknown as Partial<Magic>
              }
              onChange={(_field, value) =>
                updateField("region", MagicRegionTypeValues[value as unknown as MagicRegionType])
              }
              options={MagicRegionTypeLabels}
            />
            <FormNumberField<Magic>
              label="范围半径"
              field="rangeRadius"
              value={formData}
              onChange={updateField}
              min={0}
            />
          </>
        )}

        {/* 非区域类型的范围半径 */}
        <FormNumberField<Magic>
          label="范围半径"
          field="rangeRadius"
          value={formData}
          onChange={updateField}
          min={0}
          hidden={isRegionBased || !visibleFields.has("rangeRadius")}
        />
        <FormNumberField<Magic>
          label="等待帧数"
          field="waitFrame"
          value={formData}
          onChange={updateField}
          min={0}
        />
        <FormNumberField<Magic>
          label="生命帧数"
          field="lifeFrame"
          value={formData}
          onChange={updateField}
          min={0}
        />

        {/* 条件字段 - 穿透相关 */}
        <FormCheckbox<Magic>
          label="穿透敌人"
          field="passThrough"
          value={formData}
          onChange={updateField}
          numeric
          hidden={!visibleFields.has("passThrough")}
        />
        <FormCheckbox<Magic>
          label="穿墙"
          field="passThroughWall"
          value={formData}
          onChange={updateField}
          numeric
          hidden={!visibleFields.has("passThroughWall")}
        />
        <FormCheckbox<Magic>
          label="攻击全部"
          field="attackAll"
          value={formData}
          onChange={updateField}
          numeric
          hidden={!visibleFields.has("attackAll")}
        />

        {/* 追踪相关 */}
        <FormCheckbox<Magic>
          label="追踪敌人"
          field="traceEnemy"
          value={formData}
          onChange={updateField}
          numeric
          hidden={!visibleFields.has("traceEnemy")}
        />
        <FormNumberField<Magic>
          label="追踪速度"
          field="traceSpeed"
          value={formData}
          onChange={updateField}
          min={0}
          hidden={!visibleFields.has("traceSpeed") || !formData.traceEnemy}
        />
      </FormSection>

      {/* 特殊效果 */}
      <FormSection icon="✨" title="特殊效果" cols={3}>
        <FormSelectField<Magic>
          label="特殊效果"
          field="specialKind"
          value={formData}
          onChange={updateField}
          options={MagicSpecialKindLabels}
        />
        <FormNumberField<Magic>
          label="效果值"
          field="specialKindValue"
          value={formData}
          onChange={updateField}
          hidden={!visibleFields.has("specialKindValue")}
        />
        <FormNumberField<Magic>
          label="持续时间(ms)"
          field="specialKindMilliSeconds"
          value={formData}
          onChange={updateField}
          min={0}
          hidden={!visibleFields.has("specialKindMilliSeconds")}
        />
        <FormCheckbox<Magic>
          label="透明混合"
          field="alphaBlend"
          value={formData}
          onChange={updateField}
          numeric
        />
        <FormNumberField<Magic>
          label="飞行亮度 (0-31)"
          field="flyingLum"
          value={formData}
          onChange={updateField}
          min={0}
          max={31}
        />
        <FormNumberField<Magic>
          label="消失亮度 (0-31)"
          field="vanishLum"
          value={formData}
          onChange={updateField}
          min={0}
          max={31}
        />
      </FormSection>
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
  const handleUpdateField = useCallback(
    (key: string, value: string | null) => {
      updateField(key as keyof Magic, value as Magic[keyof Magic]);
    },
    [updateField]
  );

  return (
    <FormSection icon="🎨" title="资源文件" contentClassName="p-4 space-y-4">
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
    </FormSection>
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
    <FormSection icon="📊" title="等级配置" contentClassName="">
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
    </FormSection>
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
      <FormSection icon="⚔️" title="攻击配置" contentClassName="p-8 text-center text-[#858585]">
        <p className="mb-4">此武功没有攻击配置</p>
        <button
          type="button"
          onClick={() =>
            updateField("attackFile", {
              name: "",
              intro: "",
              moveKind: "SingleMove" as const,
              speed: 8,
              region: 0,
              specialKind: "None" as const,
              specialKindValue: 0,
              specialKindMilliSeconds: 0,
              alphaBlend: 0,
              flyingLum: 0,
              vanishLum: 0,
              waitFrame: 0,
              lifeFrame: 4,
              flyingImage: null,
              flyingSound: null,
              vanishImage: null,
              vanishSound: null,
              passThrough: 0,
              passThroughWall: 0,
              traceEnemy: 0,
              traceSpeed: 0,
              rangeRadius: 0,
              attackAll: 0,
              bounce: 0,
              bounceHurt: 0,
              vibratingScreen: 0,
            })
          }
          className="px-4 py-2 bg-[#0e639c] hover:bg-[#1177bb] text-white rounded-lg transition-colors"
        >
          创建攻击配置
        </button>
      </FormSection>
    );
  }

  return (
    <FormSection
      icon="⚔️"
      title="攻击配置"
      extra={
        <button
          type="button"
          onClick={() => updateField("attackFile", null)}
          className="text-xs text-red-400 hover:text-red-300"
        >
          删除
        </button>
      }
    >
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

      <div className="col-span-2">
        <label className="block text-sm text-[#858585] mb-1">介绍</label>
        <textarea
          rows={2}
          value={attackFile.intro || ""}
          onChange={(e) => updateAttackField("intro", e.target.value)}
          className="w-full px-3 py-2 bg-[#1e1e1e] border border-widget-border rounded-lg text-white focus:outline-none focus:border-focus-border resize-none"
        />
      </div>

      <div className="col-span-2 grid grid-cols-4 gap-3">
        {(
          [
            ["passThrough", "穿透敌人"],
            ["passThroughWall", "穿透墙壁"],
            ["traceEnemy", "追踪敌人"],
            ["attackAll", "群攻"],
            ["bounce", "反弹"],
            ["vibratingScreen", "震屏"],
            ["alphaBlend", "透明混合"],
          ] as const
        ).map(([field, text]) => (
          <label key={field} className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={!!attackFile[field]}
              onChange={(e) => updateAttackField(field, e.target.checked ? 1 : 0)}
              className="w-4 h-4"
            />
            <span className="text-sm text-[#cccccc]">{text}</span>
          </label>
        ))}
      </div>
    </FormSection>
  );
}
