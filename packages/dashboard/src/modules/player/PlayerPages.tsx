/**
 * 玩家角色编辑页面
 */

import { trpc } from "@miu2d/shared";
import type { Player, PlayerInitialGood, PlayerInitialMagic } from "@miu2d/types";
import { createDefaultPlayer } from "@miu2d/types";
import { NumberInput } from "@miu2d/ui";
import { useCallback, useMemo } from "react";
import { useParams } from "react-router-dom";
import {
  FormNumberField,
  FormSection,
  FormTextField,
  ResourceFilePicker,
} from "../../components/common";
import type { ResourceListItem } from "../../components/common/pickers";
import {
  GoodsPicker,
  MagicPicker,
  NpcResourcePicker,
  ResourceListPicker,
} from "../../components/common/pickers";
import type { DetailTab } from "../../components/DetailPageLayout";
import { DetailPageLayout } from "../../components/DetailPageLayout";
import { EditorEmptyState } from "../../components/EditorEmptyState";
import { useDashboard } from "../../DashboardContext";
import { EntityLoadingState, useEntityEditor } from "../../hooks";

// ========== 空状态页 ==========

export function PlayerListPage() {
  return (
    <EditorEmptyState
      icon="🎮"
      title="玩家角色编辑"
      description={
        <>
          从左侧列表选择一个角色进行编辑，
          <br />
          或使用上方按钮创建新角色、导入 INI 文件。
        </>
      }
    />
  );
}

// ========== 详情页 ==========

type PlayerTab = "basic" | "initialMagics" | "initialGoods" | "combat" | "files";

export function PlayerDetailPage() {
  // ── 查询 ──
  const { gameId: gameSlug, playerId } = useParams<{ gameId: string; playerId: string }>();
  const { currentGame } = useDashboard();
  const gameId = currentGame?.id;

  const { data: player, isLoading } = trpc.player.get.useQuery(
    { gameId: gameId!, id: playerId! },
    { enabled: !!gameId && !!playerId && playerId !== "new" }
  );

  // ── 编辑器 Hook ──
  const editor = useEntityEditor<Player, PlayerTab>({
    entityType: "player",
    paramKey: "playerId",
    basePath: (slug) => `/dashboard/${slug}/player`,
    validTabs: ["basic", "initialMagics", "initialGoods", "combat", "files"],
    createDefault: (gId) => createDefaultPlayer(gId, `Player${Date.now()}.ini`),
    entityLabel: "角色",
    serverData: player,
    isQueryLoading: isLoading,
  });

  const { formData, updateField, activeTab, setActiveTab, isNew, basePath, utils } = editor;

  // ── Mutations ──
  const createMutation = trpc.player.create.useMutation({
    onSuccess: (data) => {
      editor.onCreateSuccess(data.id);
      utils.player.list.invalidate({ gameId: gameId! });
    },
  });

  const updateMutation = trpc.player.update.useMutation({
    onSuccess: () => {
      editor.onUpdateSuccess();
      utils.player.list.invalidate({ gameId: gameId! });
      utils.player.get.invalidate({ gameId: gameId!, id: playerId! });
    },
  });

  const deleteMutation = trpc.player.delete.useMutation({
    onSuccess: () => {
      editor.onDeleteSuccess();
      if (gameId) utils.player.list.invalidate({ gameId });
    },
  });

  const handleSave = useCallback(() => {
    if (!gameId) return;
    if (isNew) {
      createMutation.mutate({
        gameId,
        key: formData.key || `Player${formData.index ?? 0}.ini`,
        name: formData.name || "新角色",
        index: formData.index ?? 0,
        ...formData,
      });
    } else if (playerId) {
      updateMutation.mutate({ ...formData, id: playerId, gameId } as Player);
    }
  }, [gameId, playerId, isNew, formData, createMutation, updateMutation]);

  const handleDelete = useCallback(() => {
    if (gameId && playerId && !isNew) {
      deleteMutation.mutate({ id: playerId, gameId });
    }
  }, [gameId, playerId, isNew, deleteMutation]);

  if (editor.isLoading) return <EntityLoadingState />;

  const tabs: DetailTab[] = [
    { key: "basic", label: "基础信息", icon: "📝" },
    { key: "initialMagics", label: "初始武功", icon: "⚔️" },
    { key: "initialGoods", label: "初始物品", icon: "🎒" },
    { key: "combat", label: "初始属性", icon: "📊" },
    { key: "files", label: "关联资源", icon: "🔗" },
  ];

  return (
    <DetailPageLayout
      backPath={basePath}
      title={isNew ? "新建角色" : formData.name || "角色详情"}
      subtitle={
        <>
          Player{formData.index ?? 0} · Lv.{formData.level ?? 1}
          {formData.key && <span className="ml-2 text-[#666]">({formData.key})</span>}
        </>
      }
      tabs={tabs}
      activeTab={activeTab}
      onTabChange={(key) => setActiveTab(key as PlayerTab)}
      onSave={handleSave}
      isSaving={createMutation.isPending || updateMutation.isPending}
      onDelete={!isNew ? handleDelete : undefined}
      isDeleting={deleteMutation.isPending}
    >
      {activeTab === "basic" && (
        <BasicInfoSection
          formData={formData}
          updateField={updateField}
          gameId={gameId!}
          gameSlug={gameSlug!}
        />
      )}

      {activeTab === "initialMagics" && (
        <InitialMagicsSection
          formData={formData}
          updateField={updateField}
          gameId={gameId!}
          gameSlug={gameSlug!}
        />
      )}

      {activeTab === "initialGoods" && (
        <InitialGoodsSection
          formData={formData}
          updateField={updateField}
          gameId={gameId!}
          gameSlug={gameSlug!}
        />
      )}

      {activeTab === "combat" && <CombatSection formData={formData} updateField={updateField} />}

      {activeTab === "files" && (
        <FilesSection
          formData={formData}
          updateField={updateField}
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
  gameId,
  gameSlug,
}: {
  formData: Partial<Player>;
  updateField: <K extends keyof Player>(key: K, value: Player[K]) => void;
  gameId: string;
  gameSlug: string;
}) {
  return (
    <FormSection icon="📝" title="基本信息">
      <FormTextField<Player>
        label="角色名称"
        field="name"
        value={formData}
        onChange={updateField}
      />
      <FormTextField<Player>
        label="标识符 (Key)"
        field="key"
        value={formData}
        onChange={updateField}
        placeholder="例如: Player0.ini"
      />
      <FormNumberField<Player>
        label="角色索引 (Index)"
        field="index"
        value={formData}
        onChange={updateField}
        min={0}
        hint="Player0=主角, Player1=伙伴1 ..."
      />
      <FormNumberField<Player>
        label="Kind (角色类型)"
        field="kind"
        value={formData}
        onChange={updateField}
        min={0}
        hint="2=玩家角色"
      />

      <div className="col-span-2">
        <NpcResourcePicker
          label="外观配置"
          value={formData.npcIni || null}
          onChange={(val) => updateField("npcIni", val ?? "")}
          gameId={gameId}
          gameSlug={gameSlug}
          placeholder="选择 NPC 资源（角色外观）"
        />
      </div>

      <FormNumberField<Player>
        label="等级"
        field="level"
        value={formData}
        onChange={updateField}
        min={1}
      />
      <FormNumberField<Player>
        label="金钱"
        field="money"
        value={formData}
        onChange={updateField}
        min={0}
      />
      <FormNumberField<Player>
        label="朝向 (Dir)"
        field="dir"
        value={formData}
        onChange={updateField}
        min={0}
        max={7}
      />
      <FormNumberField<Player>
        label="地图 X"
        field="mapX"
        value={formData}
        onChange={updateField}
        min={0}
      />
      <FormNumberField<Player>
        label="地图 Y"
        field="mapY"
        value={formData}
        onChange={updateField}
        min={0}
      />
    </FormSection>
  );
}

// ========== 初始武功区 ==========

function InitialMagicsSection({
  formData,
  updateField,
  gameId,
  gameSlug,
}: {
  formData: Partial<Player>;
  updateField: <K extends keyof Player>(key: K, value: Player[K]) => void;
  gameId: string;
  gameSlug: string;
}) {
  const magics: PlayerInitialMagic[] = formData.initialMagics ?? [];

  const handleAdd = useCallback(() => {
    updateField("initialMagics", [...magics, { iniFile: "", level: 1, exp: 0 }]);
  }, [magics, updateField]);

  const handleRemove = useCallback(
    (index: number) => {
      updateField(
        "initialMagics",
        magics.filter((_, i) => i !== index)
      );
    },
    [magics, updateField]
  );

  const handleUpdateItem = useCallback(
    (index: number, patch: Partial<PlayerInitialMagic>) => {
      const updated = [...magics];
      updated[index] = { ...updated[index], ...patch };
      updateField("initialMagics", updated);
    },
    [magics, updateField]
  );

  // 已选武功 key 集合（防重复）
  const existingKeys = useMemo(
    () => new Set(magics.map((m) => m.iniFile.toLowerCase()).filter(Boolean)),
    [magics]
  );

  return (
    <div className="space-y-5">
      <section className="bg-[#252526] border border-widget-border rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-widget-border flex items-center justify-between">
          <h2 className="text-sm font-medium text-[#cccccc]">⚔️ 初始武功列表</h2>
          <button
            type="button"
            onClick={handleAdd}
            className="px-3 py-1 text-xs bg-[#0e639c] hover:bg-[#1177bb] rounded text-white transition-colors"
          >
            + 添加武功
          </button>
        </div>

        {magics.length === 0 ? (
          <div className="p-6 text-center text-sm text-[#858585]">
            暂无初始武功。点击「添加武功」为角色配置起始武功。
          </div>
        ) : (
          <div className="divide-y divide-[#333]">
            {magics.map((magic, index) => (
              <div
                key={index}
                className="p-4 flex items-start gap-4 hover:bg-[#2a2d2e] transition-colors"
              >
                {/* 序号 */}
                <div className="w-6 h-6 rounded bg-[#3c3c3c] flex items-center justify-center text-xs text-[#808080] flex-shrink-0 mt-1">
                  {index + 1}
                </div>

                {/* 武功选择器 + 参数 */}
                <div className="flex-1 space-y-3">
                  <MagicPicker
                    label="武功"
                    value={magic.iniFile || ""}
                    onChange={(val) => handleUpdateItem(index, { iniFile: val ?? "" })}
                    gameId={gameId}
                    gameSlug={gameSlug}
                    placeholder="选择武功"
                  />
                  <div className="flex gap-4 ml-[92px]">
                    <div className="flex items-center gap-2">
                      <label className="text-xs text-[#858585]">等级</label>
                      <NumberInput
                        min={1}
                        value={magic.level}
                        onChange={(val) => handleUpdateItem(index, { level: val ?? 1 })}
                        className="w-20"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <label className="text-xs text-[#858585]">经验</label>
                      <NumberInput
                        min={0}
                        value={magic.exp}
                        onChange={(val) => handleUpdateItem(index, { exp: val ?? 0 })}
                        className="w-24"
                      />
                    </div>
                  </div>
                </div>

                {/* 删除按钮 */}
                <button
                  type="button"
                  onClick={() => handleRemove(index)}
                  className="w-7 h-7 flex items-center justify-center rounded hover:bg-[#3c3c3c] text-[#808080] hover:text-red-400 transition-colors flex-shrink-0 mt-1"
                  title="移除"
                >
                  <svg
                    className="w-4 h-4"
                    viewBox="0 0 16 16"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                  >
                    <path d="M4 4l8 8M12 4l-8 8" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      <div className="text-xs text-[#666] bg-[#1e1e1e] p-3 rounded">
        <p>
          初始武功对应存档 <code className="text-[#ce9178]">MagicX.ini</code> 文件，X 为角色索引。
        </p>
        <p className="mt-1">每个武功有独立的等级和经验值，用于设定角色的起始武功配置。</p>
      </div>
    </div>
  );
}

// ========== 初始物品区 ==========

function InitialGoodsSection({
  formData,
  updateField,
  gameId,
  gameSlug,
}: {
  formData: Partial<Player>;
  updateField: <K extends keyof Player>(key: K, value: Player[K]) => void;
  gameId: string;
  gameSlug: string;
}) {
  const goods: PlayerInitialGood[] = formData.initialGoods ?? [];

  const handleAdd = useCallback(() => {
    updateField("initialGoods", [...goods, { iniFile: "", number: 1 }]);
  }, [goods, updateField]);

  const handleRemove = useCallback(
    (index: number) => {
      updateField(
        "initialGoods",
        goods.filter((_, i) => i !== index)
      );
    },
    [goods, updateField]
  );

  const handleUpdateItem = useCallback(
    (index: number, patch: Partial<PlayerInitialGood>) => {
      const updated = [...goods];
      updated[index] = { ...updated[index], ...patch };
      updateField("initialGoods", updated);
    },
    [goods, updateField]
  );

  const existingKeys = useMemo(
    () => new Set(goods.map((g) => g.iniFile.toLowerCase()).filter(Boolean)),
    [goods]
  );

  return (
    <div className="space-y-5">
      <section className="bg-[#252526] border border-widget-border rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-widget-border flex items-center justify-between">
          <h2 className="text-sm font-medium text-[#cccccc]">🎒 初始物品列表</h2>
          <button
            type="button"
            onClick={handleAdd}
            className="px-3 py-1 text-xs bg-[#0e639c] hover:bg-[#1177bb] rounded text-white transition-colors"
          >
            + 添加物品
          </button>
        </div>

        {goods.length === 0 ? (
          <div className="p-6 text-center text-sm text-[#858585]">
            暂无初始物品。点击「添加物品」为角色配置起始物品。
          </div>
        ) : (
          <div className="divide-y divide-[#333]">
            {goods.map((item, index) => (
              <div
                key={index}
                className="p-4 flex items-start gap-4 hover:bg-[#2a2d2e] transition-colors"
              >
                {/* 序号 */}
                <div className="w-6 h-6 rounded bg-[#3c3c3c] flex items-center justify-center text-xs text-[#808080] flex-shrink-0 mt-1">
                  {index + 1}
                </div>

                {/* 物品选择器 + 数量 */}
                <div className="flex-1 space-y-3">
                  <GoodsPicker
                    label="物品"
                    value={item.iniFile || null}
                    onChange={(val) => {
                      if (val) handleUpdateItem(index, { iniFile: val });
                      else handleRemove(index);
                    }}
                    gameId={gameId}
                    gameSlug={gameSlug}
                    existingKeys={existingKeys}
                    placeholder="选择物品"
                  />
                  <div className="flex gap-4 ml-[92px]">
                    <div className="flex items-center gap-2">
                      <label className="text-xs text-[#858585]">数量</label>
                      <NumberInput
                        min={1}
                        value={item.number}
                        onChange={(val) => handleUpdateItem(index, { number: val ?? 1 })}
                        className="w-20"
                      />
                    </div>
                  </div>
                </div>

                {/* 删除按钮 */}
                <button
                  type="button"
                  onClick={() => handleRemove(index)}
                  className="w-7 h-7 flex items-center justify-center rounded hover:bg-[#3c3c3c] text-[#808080] hover:text-red-400 transition-colors flex-shrink-0 mt-1"
                  title="移除"
                >
                  <svg
                    className="w-4 h-4"
                    viewBox="0 0 16 16"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                  >
                    <path d="M4 4l8 8M12 4l-8 8" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      <div className="text-xs text-[#666] bg-[#1e1e1e] p-3 rounded">
        <p>
          初始物品对应存档 <code className="text-[#ce9178]">GoodsX.ini</code> 文件，X 为角色索引。
        </p>
        <p className="mt-1">每个物品可设置数量，用于设定角色的起始背包物品。</p>
      </div>
    </div>
  );
}

// ========== 初始属性区 ==========

function CombatSection({
  formData,
  updateField,
}: {
  formData: Partial<Player>;
  updateField: <K extends keyof Player>(key: K, value: Player[K]) => void;
}) {
  return (
    <div className="space-y-5">
      <FormSection icon="❤️" title="生命与资源">
        <FormNumberField<Player>
          label="当前生命"
          field="life"
          value={formData}
          onChange={updateField}
          min={0}
        />
        <FormNumberField<Player>
          label="最大生命"
          field="lifeMax"
          value={formData}
          onChange={updateField}
          min={0}
        />
        <FormNumberField<Player>
          label="当前体力"
          field="thew"
          value={formData}
          onChange={updateField}
          min={0}
        />
        <FormNumberField<Player>
          label="最大体力"
          field="thewMax"
          value={formData}
          onChange={updateField}
          min={0}
        />
        <FormNumberField<Player>
          label="当前内力"
          field="mana"
          value={formData}
          onChange={updateField}
          min={0}
        />
        <FormNumberField<Player>
          label="最大内力"
          field="manaMax"
          value={formData}
          onChange={updateField}
          min={0}
        />
      </FormSection>

      <FormSection icon="⚔️" title="战斗属性" cols={3}>
        <FormNumberField<Player>
          label="攻击力"
          field="attack"
          value={formData}
          onChange={updateField}
          min={0}
        />
        <FormNumberField<Player>
          label="防御力"
          field="defend"
          value={formData}
          onChange={updateField}
          min={0}
        />
        <FormNumberField<Player>
          label="闪避"
          field="evade"
          value={formData}
          onChange={updateField}
          min={0}
        />
        <FormNumberField<Player>
          label="攻击等级"
          field="attackLevel"
          value={formData}
          onChange={updateField}
          min={0}
        />
        <FormNumberField<Player>
          label="攻击范围"
          field="attackRadius"
          value={formData}
          onChange={updateField}
          min={0}
        />
        <FormNumberField<Player>
          label="视野范围"
          field="visionRadius"
          value={formData}
          onChange={updateField}
          min={0}
        />
      </FormSection>

      <FormSection icon="📈" title="经验与等级" cols={3}>
        <FormNumberField<Player>
          label="经验值"
          field="exp"
          value={formData}
          onChange={updateField}
          min={0}
        />
        <FormNumberField<Player>
          label="升级所需经验"
          field="levelUpExp"
          value={formData}
          onChange={updateField}
          min={0}
        />
        <FormNumberField<Player>
          label="经验加成"
          field="expBonus"
          value={formData}
          onChange={updateField}
          min={0}
        />
      </FormSection>
    </div>
  );
}

// ========== 关联资源区 ==========

function FilesSection({
  formData,
  updateField,
  gameId,
  gameSlug,
}: {
  formData: Partial<Player>;
  updateField: <K extends keyof Player>(key: K, value: Player[K]) => void;
  gameId: string;
  gameSlug: string;
}) {
  // 查询 obj 列表（用于 BodyIni 选择）
  const { data: objList } = trpc.obj.list.useQuery({ gameId }, { enabled: !!gameId });
  // 查询等级配置列表（用于 LevelIni 选择）
  const { data: levelList } = trpc.level.list.useQuery({ gameId }, { enabled: !!gameId });

  // 用 key 作为 id，使 ResourceListPicker 按 key 匹配
  const objItems: ResourceListItem[] = useMemo(
    () => (objList ?? []).map((o) => ({ id: o.key, key: o.key, name: o.name || o.key })),
    [objList]
  );

  const levelItems: ResourceListItem[] = useMemo(
    () => (levelList ?? []).map((l) => ({ id: l.key, key: l.key, name: l.name || l.key })),
    [levelList]
  );

  return (
    <div className="space-y-5">
      <FormSection icon="🔗" title="关联资源" cols={1} contentClassName="p-4 space-y-4">
        <MagicPicker
          label="飞行武器"
          value={formData.flyIni || ""}
          onChange={(val) => updateField("flyIni", val ?? "")}
          gameId={gameId}
          gameSlug={gameSlug}
        />
        <MagicPicker
          label="飞行武器2"
          value={formData.flyIni2 || ""}
          onChange={(val) => updateField("flyIni2", val ?? "")}
          gameId={gameId}
          gameSlug={gameSlug}
        />
        <ResourceListPicker
          label="尸体精灵"
          value={formData.bodyIni || ""}
          onChange={(val) => updateField("bodyIni", val ?? "")}
          items={objItems}
          placeholder="选择 Obj 资源"
          dialogTitle="选择尸体精灵 (BodyIni)"
          emptyText="暂无 Obj 资源，请先在物件管理中创建"
        />
        <ResourceListPicker
          label="等级配置"
          value={formData.levelIni || ""}
          onChange={(val) => updateField("levelIni", val ?? "")}
          items={levelItems}
          placeholder="选择等级配置"
          dialogTitle="选择等级配置 (LevelIni)"
          emptyText="暂无等级配置，请先在等级编辑中创建"
        />
      </FormSection>

      <FormSection icon="📜" title="关联脚本" cols={1} contentClassName="p-4 space-y-4">
        <ResourceFilePicker
          label="死亡脚本 (DeathScript)"
          value={formData.deathScript || ""}
          onChange={(val) => updateField("deathScript", val ?? "")}
          fieldName="deathScript"
          gameId={gameId}
          gameSlug={gameSlug}
          extensions={[".txt"]}
        />
        <ResourceFilePicker
          label="时间脚本 (TimeScript)"
          value={formData.timeScript || ""}
          onChange={(val) => updateField("timeScript", val ?? "")}
          fieldName="timeScript"
          gameId={gameId}
          gameSlug={gameSlug}
          extensions={[".txt"]}
        />
        <ResourceFilePicker
          label="自定义脚本 (ScriptFile)"
          value={formData.scriptFile || ""}
          onChange={(val) => updateField("scriptFile", val ?? "")}
          fieldName="scriptFile"
          gameId={gameId}
          gameSlug={gameSlug}
          extensions={[".txt"]}
        />
      </FormSection>

      <FormSection icon="🔧" title="其他参数" cols={3}>
        <FormNumberField<Player>
          label="行走速度"
          field="walkSpeed"
          value={formData}
          onChange={updateField}
          min={0}
        />
        <FormNumberField<Player>
          label="对话范围"
          field="dialogRadius"
          value={formData}
          onChange={updateField}
          min={0}
        />
        <FormNumberField<Player>
          label="空闲时间"
          field="idle"
          value={formData}
          onChange={updateField}
          min={0}
        />
        <FormNumberField<Player>
          label="武功数量"
          field="magic"
          value={formData}
          onChange={updateField}
          min={0}
        />
        <FormNumberField<Player>
          label="内力上限"
          field="manaLimit"
          value={formData}
          onChange={updateField}
          min={0}
        />
        <FormTextField<Player>
          label="第二攻击"
          field="secondAttack"
          value={formData}
          onChange={updateField}
        />
      </FormSection>
    </div>
  );
}
