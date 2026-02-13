/**
 * 玩家角色编辑页面
 * 参考 NPC 编辑页面布局
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { trpc } from "../../../../lib/trpc";
import { useToast } from "../../../../contexts/ToastContext";
import { DetailPageLayout } from "../../components/DetailPageLayout";
import type { DetailTab } from "../../components/DetailPageLayout";
import { EditorEmptyState } from "../../components/EditorEmptyState";
import { useDashboard } from "../../DashboardContext";
import { NumberInput, ResourceFilePicker } from "../../../../components/common";
import { GoodsPicker, MagicPicker, NpcResourcePicker, ResourceListPicker } from "../../../../components/common/pickers";
import type { ResourceListItem } from "../../../../components/common/pickers";
import type { Player, PlayerInitialMagic, PlayerInitialGoods } from "@miu2d/types";
import { createDefaultPlayer } from "@miu2d/types";

// ========== 空状态页 ==========

export function PlayerListPage() {
  return (
    <EditorEmptyState
      icon="🎮"
      title="玩家角色编辑"
      description={<>从左侧列表选择一个角色进行编辑，<br />或使用上方按钮创建新角色、导入 INI 文件。</>}
    />
  );
}

// ========== 详情页 ==========

export function PlayerDetailPage() {
  const { gameId: gameSlug, playerId, tab } = useParams<{ gameId: string; playerId: string; tab: string }>();
  const { currentGame, editCache } = useDashboard();
  const gameId = currentGame?.id;
  const navigate = useNavigate();
  const utils = trpc.useUtils();
  const basePath = `/dashboard/${gameSlug}/player`;
  const isNew = playerId === "new";

  const cacheKey = playerId ? `player:${playerId}` : null;

  type TabType = "basic" | "initialMagics" | "initialGoods" | "combat" | "files";
  const validTabs: TabType[] = ["basic", "initialMagics", "initialGoods", "combat", "files"];

  const activeTab: TabType = validTabs.includes(tab as TabType)
    ? (tab as TabType)
    : "basic";

  const setActiveTab = useCallback((newTab: TabType) => {
    navigate(`${basePath}/${playerId}/${newTab}`, { replace: true });
  }, [navigate, basePath, playerId]);

  // 查询角色详情
  const { data: player, isLoading } = trpc.player.get.useQuery(
    { gameId: gameId!, id: playerId! },
    { enabled: !!gameId && !!playerId && !isNew }
  );

  // 表单状态
  const [formData, setFormData] = useState<Partial<Player>>(() => {
    if (cacheKey && editCache.has(cacheKey)) {
      return editCache.get<Partial<Player>>(cacheKey) || {};
    }
    return {};
  });

  useEffect(() => {
    if (cacheKey && Object.keys(formData).length > 0) {
      editCache.set(cacheKey, formData);
    }
  }, [cacheKey, formData, editCache]);

  useEffect(() => {
    if (isNew && gameId && Object.keys(formData).length === 0) {
      setFormData(createDefaultPlayer(gameId, `Player${Date.now()}.ini`));
    }
  }, [isNew, gameId, formData]);

  useEffect(() => {
    if (player && cacheKey && !editCache.has(cacheKey)) {
      setFormData(player);
    }
  }, [player, cacheKey, editCache]);

  const toast = useToast();

  const createMutation = trpc.player.create.useMutation({
    onSuccess: (data) => {
      if (cacheKey) editCache.remove(cacheKey);
      toast.success(`角色「${formData.name || '新角色'}」创建成功`);
      utils.player.list.invalidate({ gameId: gameId! });
      navigate(`${basePath}/${data.id}/basic`);
    },
  });

  const updateMutation = trpc.player.update.useMutation({
    onSuccess: () => {
      if (cacheKey) editCache.remove(cacheKey);
      utils.player.list.invalidate({ gameId: gameId! });
      utils.player.get.invalidate({ gameId: gameId!, id: playerId! });
      toast.success(`角色「${formData.name}」保存成功`);
    },
  });

  const deleteMutation = trpc.player.delete.useMutation({
    onSuccess: () => {
      if (cacheKey) editCache.remove(cacheKey);
      utils.player.list.invalidate({ gameId: gameId! });
      toast.success("角色已删除");
      navigate(basePath);
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
      updateMutation.mutate({
        ...formData,
        id: playerId,
        gameId,
      } as Player);
    }
  }, [gameId, playerId, isNew, formData, createMutation, updateMutation]);

  const handleDelete = useCallback(() => {
    if (gameId && playerId && !isNew) {
      deleteMutation.mutate({ id: playerId, gameId });
    }
  }, [gameId, playerId, isNew, deleteMutation]);

  const updateField = useCallback(<K extends keyof Player>(key: K, value: Player[K]) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
  }, []);

  if (isLoading && !isNew) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-[#858585]">加载中...</div>
      </div>
    );
  }

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
      onTabChange={(key) => setActiveTab(key as TabType)}
      onSave={handleSave}
      isSaving={createMutation.isPending || updateMutation.isPending}
      onDelete={!isNew ? handleDelete : undefined}
      isDeleting={deleteMutation.isPending}
    >
      {activeTab === "basic" && (
        <BasicInfoSection formData={formData} updateField={updateField} gameId={gameId!} gameSlug={gameSlug!} />
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

      {activeTab === "combat" && (
        <CombatSection formData={formData} updateField={updateField} />
      )}

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
    <section className="bg-[#252526] border border-widget-border rounded-xl overflow-hidden">
      <div className="px-4 py-3 border-b border-widget-border">
        <h2 className="text-sm font-medium text-[#cccccc]">📝 基本信息</h2>
      </div>
      <div className="p-4 grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm text-[#858585] mb-1">角色名称</label>
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
            placeholder="例如: Player0.ini"
            className="w-full px-3 py-2 bg-[#1e1e1e] border border-widget-border rounded-lg text-white focus:outline-none focus:border-focus-border"
          />
        </div>

        <div>
          <label className="block text-sm text-[#858585] mb-1">角色索引 (Index)</label>
          <NumberInput
            min={0}
            value={formData.index ?? 0}
            onChange={(val) => updateField("index", val ?? 0)}
            className="w-full"
          />
          <p className="text-xs text-[#555] mt-1">Player0=主角, Player1=伙伴1 ...</p>
        </div>

        <div>
          <label className="block text-sm text-[#858585] mb-1">Kind (角色类型)</label>
          <NumberInput
            min={0}
            value={formData.kind ?? 2}
            onChange={(val) => updateField("kind", val ?? 2)}
            className="w-full"
          />
          <p className="text-xs text-[#555] mt-1">2=玩家角色</p>
        </div>

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

        <div>
          <label className="block text-sm text-[#858585] mb-1">等级</label>
          <NumberInput
            min={1}
            value={formData.level ?? 1}
            onChange={(val) => updateField("level", val ?? 1)}
            className="w-full"
          />
        </div>

        <div>
          <label className="block text-sm text-[#858585] mb-1">金钱</label>
          <NumberInput
            min={0}
            value={formData.money ?? 0}
            onChange={(val) => updateField("money", val ?? 0)}
            className="w-full"
          />
        </div>

        <div>
          <label className="block text-sm text-[#858585] mb-1">朝向 (Dir)</label>
          <NumberInput
            min={0}
            max={7}
            value={formData.dir ?? 0}
            onChange={(val) => updateField("dir", val ?? 0)}
            className="w-full"
          />
        </div>

        <div>
          <label className="block text-sm text-[#858585] mb-1">地图 X</label>
          <NumberInput
            min={0}
            value={formData.mapX ?? 0}
            onChange={(val) => updateField("mapX", val ?? 0)}
            className="w-full"
          />
        </div>

        <div>
          <label className="block text-sm text-[#858585] mb-1">地图 Y</label>
          <NumberInput
            min={0}
            value={formData.mapY ?? 0}
            onChange={(val) => updateField("mapY", val ?? 0)}
            className="w-full"
          />
        </div>
      </div>
    </section>
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

  const handleRemove = useCallback((index: number) => {
    updateField("initialMagics", magics.filter((_, i) => i !== index));
  }, [magics, updateField]);

  const handleUpdateItem = useCallback((index: number, patch: Partial<PlayerInitialMagic>) => {
    const updated = [...magics];
    updated[index] = { ...updated[index], ...patch };
    updateField("initialMagics", updated);
  }, [magics, updateField]);

  // 已选武功 key 集合（防重复）
  const existingKeys = useMemo(
    () => new Set(magics.map((m) => m.iniFile.toLowerCase()).filter(Boolean)),
    [magics],
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
              <div key={index} className="p-4 flex items-start gap-4 hover:bg-[#2a2d2e] transition-colors">
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
                  <svg className="w-4 h-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path d="M4 4l8 8M12 4l-8 8" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      <div className="text-xs text-[#666] bg-[#1e1e1e] p-3 rounded">
        <p>初始武功对应存档 <code className="text-[#ce9178]">MagicX.ini</code> 文件，X 为角色索引。</p>
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
  const goods: PlayerInitialGoods[] = formData.initialGoods ?? [];

  const handleAdd = useCallback(() => {
    updateField("initialGoods", [...goods, { iniFile: "", number: 1 }]);
  }, [goods, updateField]);

  const handleRemove = useCallback((index: number) => {
    updateField("initialGoods", goods.filter((_, i) => i !== index));
  }, [goods, updateField]);

  const handleUpdateItem = useCallback((index: number, patch: Partial<PlayerInitialGoods>) => {
    const updated = [...goods];
    updated[index] = { ...updated[index], ...patch };
    updateField("initialGoods", updated);
  }, [goods, updateField]);

  const existingKeys = useMemo(
    () => new Set(goods.map((g) => g.iniFile.toLowerCase()).filter(Boolean)),
    [goods],
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
              <div key={index} className="p-4 flex items-start gap-4 hover:bg-[#2a2d2e] transition-colors">
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
                  <svg className="w-4 h-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path d="M4 4l8 8M12 4l-8 8" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      <div className="text-xs text-[#666] bg-[#1e1e1e] p-3 rounded">
        <p>初始物品对应存档 <code className="text-[#ce9178]">GoodsX.ini</code> 文件，X 为角色索引。</p>
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
      {/* 生命和资源 */}
      <section className="bg-[#252526] border border-widget-border rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-widget-border">
          <h2 className="text-sm font-medium text-[#cccccc]">❤️ 生命与资源</h2>
        </div>
        <div className="p-4 grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-[#858585] mb-1">当前生命</label>
            <NumberInput min={0} value={formData.life ?? 100} onChange={(val) => updateField("life", val ?? 0)} className="w-full" />
          </div>
          <div>
            <label className="block text-sm text-[#858585] mb-1">最大生命</label>
            <NumberInput min={0} value={formData.lifeMax ?? 100} onChange={(val) => updateField("lifeMax", val ?? 0)} className="w-full" />
          </div>
          <div>
            <label className="block text-sm text-[#858585] mb-1">当前体力</label>
            <NumberInput min={0} value={formData.thew ?? 100} onChange={(val) => updateField("thew", val ?? 0)} className="w-full" />
          </div>
          <div>
            <label className="block text-sm text-[#858585] mb-1">最大体力</label>
            <NumberInput min={0} value={formData.thewMax ?? 100} onChange={(val) => updateField("thewMax", val ?? 0)} className="w-full" />
          </div>
          <div>
            <label className="block text-sm text-[#858585] mb-1">当前内力</label>
            <NumberInput min={0} value={formData.mana ?? 50} onChange={(val) => updateField("mana", val ?? 0)} className="w-full" />
          </div>
          <div>
            <label className="block text-sm text-[#858585] mb-1">最大内力</label>
            <NumberInput min={0} value={formData.manaMax ?? 50} onChange={(val) => updateField("manaMax", val ?? 0)} className="w-full" />
          </div>
        </div>
      </section>

      {/* 战斗属性 */}
      <section className="bg-[#252526] border border-widget-border rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-widget-border">
          <h2 className="text-sm font-medium text-[#cccccc]">⚔️ 战斗属性</h2>
        </div>
        <div className="p-4 grid grid-cols-3 gap-4">
          <div>
            <label className="block text-sm text-[#858585] mb-1">攻击力</label>
            <NumberInput min={0} value={formData.attack ?? 10} onChange={(val) => updateField("attack", val ?? 0)} className="w-full" />
          </div>
          <div>
            <label className="block text-sm text-[#858585] mb-1">防御力</label>
            <NumberInput min={0} value={formData.defend ?? 5} onChange={(val) => updateField("defend", val ?? 0)} className="w-full" />
          </div>
          <div>
            <label className="block text-sm text-[#858585] mb-1">闪避</label>
            <NumberInput min={0} value={formData.evade ?? 5} onChange={(val) => updateField("evade", val ?? 0)} className="w-full" />
          </div>
          <div>
            <label className="block text-sm text-[#858585] mb-1">攻击等级</label>
            <NumberInput min={0} value={formData.attackLevel ?? 1} onChange={(val) => updateField("attackLevel", val ?? 1)} className="w-full" />
          </div>
          <div>
            <label className="block text-sm text-[#858585] mb-1">攻击范围</label>
            <NumberInput min={0} value={formData.attackRadius ?? 1} onChange={(val) => updateField("attackRadius", val ?? 1)} className="w-full" />
          </div>
          <div>
            <label className="block text-sm text-[#858585] mb-1">视野范围</label>
            <NumberInput min={0} value={formData.visionRadius ?? 10} onChange={(val) => updateField("visionRadius", val ?? 10)} className="w-full" />
          </div>
        </div>
      </section>

      {/* 经验和等级 */}
      <section className="bg-[#252526] border border-widget-border rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-widget-border">
          <h2 className="text-sm font-medium text-[#cccccc]">📈 经验与等级</h2>
        </div>
        <div className="p-4 grid grid-cols-3 gap-4">
          <div>
            <label className="block text-sm text-[#858585] mb-1">经验值</label>
            <NumberInput min={0} value={formData.exp ?? 0} onChange={(val) => updateField("exp", val ?? 0)} className="w-full" />
          </div>
          <div>
            <label className="block text-sm text-[#858585] mb-1">升级所需经验</label>
            <NumberInput min={0} value={formData.levelUpExp ?? 100} onChange={(val) => updateField("levelUpExp", val ?? 0)} className="w-full" />
          </div>
          <div>
            <label className="block text-sm text-[#858585] mb-1">经验加成</label>
            <NumberInput min={0} value={formData.expBonus ?? 0} onChange={(val) => updateField("expBonus", val ?? 0)} className="w-full" />
          </div>
        </div>
      </section>
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
  const { data: objList } = trpc.obj.list.useQuery(
    { gameId },
    { enabled: !!gameId },
  );
  // 查询等级配置列表（用于 LevelIni 选择）
  const { data: levelList } = trpc.level.list.useQuery(
    { gameId },
    { enabled: !!gameId },
  );

  // 用 key 作为 id，使 ResourceListPicker 按 key 匹配
  const objItems: ResourceListItem[] = useMemo(
    () => (objList ?? []).map((o) => ({ id: o.key, key: o.key, name: o.name || o.key })),
    [objList],
  );

  const levelItems: ResourceListItem[] = useMemo(
    () => (levelList ?? []).map((l) => ({ id: l.key, key: l.key, name: l.name || l.key })),
    [levelList],
  );

  return (
    <div className="space-y-5">
      {/* 关联资源 */}
      <section className="bg-[#252526] border border-widget-border rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-widget-border">
          <h2 className="text-sm font-medium text-[#cccccc]">🔗 关联资源</h2>
        </div>
        <div className="p-4 space-y-4">
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
        </div>
      </section>

      {/* 关联脚本 */}
      <section className="bg-[#252526] border border-widget-border rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-widget-border">
          <h2 className="text-sm font-medium text-[#cccccc]">📜 关联脚本</h2>
        </div>
        <div className="p-4 space-y-4">
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
        </div>
      </section>

      {/* 其他数值配置 */}
      <section className="bg-[#252526] border border-widget-border rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-widget-border">
          <h2 className="text-sm font-medium text-[#cccccc]">🔧 其他参数</h2>
        </div>
        <div className="p-4 grid grid-cols-3 gap-4">
          <div>
            <label className="block text-sm text-[#858585] mb-1">行走速度</label>
            <NumberInput min={0} value={formData.walkSpeed ?? 1} onChange={(val) => updateField("walkSpeed", val ?? 1)} className="w-full" />
          </div>
          <div>
            <label className="block text-sm text-[#858585] mb-1">对话范围</label>
            <NumberInput min={0} value={formData.dialogRadius ?? 1} onChange={(val) => updateField("dialogRadius", val ?? 1)} className="w-full" />
          </div>
          <div>
            <label className="block text-sm text-[#858585] mb-1">空闲时间</label>
            <NumberInput min={0} value={formData.idle ?? 30} onChange={(val) => updateField("idle", val ?? 30)} className="w-full" />
          </div>
          <div>
            <label className="block text-sm text-[#858585] mb-1">武功数量</label>
            <NumberInput min={0} value={formData.magic ?? 0} onChange={(val) => updateField("magic", val ?? 0)} className="w-full" />
          </div>
          <div>
            <label className="block text-sm text-[#858585] mb-1">内力上限</label>
            <NumberInput min={0} value={formData.manaLimit ?? 0} onChange={(val) => updateField("manaLimit", val ?? 0)} className="w-full" />
          </div>
          <div>
            <label className="block text-sm text-[#858585] mb-1">第二攻击</label>
            <input
              type="text"
              value={formData.secondAttack || ""}
              onChange={(e) => updateField("secondAttack", e.target.value)}
              className="w-full px-3 py-2 bg-[#1e1e1e] border border-widget-border rounded-lg text-white focus:outline-none focus:border-focus-border"
            />
          </div>
        </div>
      </section>
    </div>
  );
}
