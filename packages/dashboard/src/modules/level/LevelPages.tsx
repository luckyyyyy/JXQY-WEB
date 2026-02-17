/**
 * 等级配置编辑页面
 * 简洁布局：基础信息 + 全部等级表格
 */

import { api, useToast } from "@miu2d/shared";
import type { LevelConfig, LevelDetail, LevelUserType } from "@miu2d/types";
import { createDefaultLevelConfigLevels, createDefaultLevelDetail } from "@miu2d/types";
import { NumberInput } from "@miu2d/ui";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { EditorEmptyState } from "../../components/EditorEmptyState";
import { useDashboard } from "../../DashboardContext";

// ========== 欢迎页（列表首页） ==========

export function LevelListPage() {
  return (
    <EditorEmptyState
      icon="📊"
      title="等级配置"
      description={
        <>
          从左侧列表选择一个等级配置进行编辑，
          <br />
          或点击 + 按钮创建新配置。
        </>
      }
    />
  );
}

// ========== 战斗公式说明面板 ==========
function CombatFormulaPanel() {
  return (
    <div className="bg-[#1e1e1e] border border-widget-border rounded-lg p-4 mb-4">
      <h3 className="text-white font-medium mb-3 flex items-center gap-2">
        <span>⚔️</span>
        <span>战斗计算公式</span>
      </h3>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 text-xs">
        {/* 命中率计算 */}
        <div className="bg-[#252526] rounded-lg p-3">
          <h4 className="text-[#4ec9b0] font-medium mb-2">🎯 命中率（Miss计算）</h4>
          <div className="space-y-2 text-[#cccccc]">
            <p className="text-[#858585]">
              基础命中率 = <code className="bg-[#1e1e1e] px-1 rounded">5%</code>
            </p>
            <div className="border-l-2 border-widget-border pl-3 space-y-1">
              <p>
                <b>若 目标闪避 ≥ 攻击者闪避：</b>
              </p>
              <code className="block bg-[#1e1e1e] p-2 rounded text-[#ce9178]">
                命中率 = 5% + (攻击者闪避 / 目标闪避) × 50%
              </code>
              <p className="text-[#858585] mt-1">
                例：攻击者100闪避，目标200闪避 → 5% + 25% = <b>30%命中</b>
              </p>
            </div>
            <div className="border-l-2 border-widget-border pl-3 space-y-1">
              <p>
                <b>若 攻击者闪避 &gt; 目标闪避：</b>
              </p>
              <code className="block bg-[#1e1e1e] p-2 rounded text-[#ce9178]">
                命中率 = 55% + min((攻击者闪避 - 目标闪避) / 100, 1) × 45%
              </code>
              <p className="text-[#858585] mt-1">
                例：攻击者200闪避，目标100闪避 → 55% + 45% = <b>100%命中</b>
              </p>
            </div>
            <p className="text-[#6a9955] mt-2">💡 闪避差距超过100点后，命中率达到上限</p>
          </div>
        </div>

        {/* 伤害计算 */}
        <div className="bg-[#252526] rounded-lg p-3">
          <h4 className="text-[#dcdcaa] font-medium mb-2">💥 伤害计算</h4>
          <div className="space-y-2 text-[#cccccc]">
            <p className="text-[#858585]">普通攻击/武功伤害计算：</p>
            <code className="block bg-[#1e1e1e] p-2 rounded text-[#ce9178]">
              实际伤害 = max(攻击伤害 - 目标防御, 5)
            </code>
            <p className="text-[#858585] mt-2">武功多属性伤害（部分武功有3种伤害类型）：</p>
            <code className="block bg-[#1e1e1e] p-2 rounded text-[#ce9178]">
              总伤害 = (伤害1 - 防御1) + (伤害2 - 防御2) + (伤害3 - 防御3)
            </code>
            <div className="mt-2 space-y-1">
              <p>
                • <b>最低伤害</b>：5点（无论防御多高）
              </p>
              <p>
                • <b>护盾减伤</b>：部分武功可创建护盾抵消伤害
              </p>
              <p>
                • <b>免疫盾</b>：完全免疫所有伤害
              </p>
            </div>
            <p className="text-[#6a9955] mt-2">💡 高防御角色依然会受到最低5点伤害</p>
          </div>
        </div>
      </div>

      {/* 升级属性说明 */}
      <div className="mt-4 bg-[#252526] rounded-lg p-3">
        <h4 className="text-[#569cd6] font-medium mb-2">📈 升级属性增量</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs text-[#cccccc]">
          <div>
            <code className="block bg-[#1e1e1e] p-2 rounded text-[#ce9178] mb-2">
              新属性 = 当前属性 + (目标等级属性 - 当前等级属性)
            </code>
            <p className="text-[#858585]">
              例：当前Lv5攻击50，升到Lv6，Lv6配置攻击60，Lv5配置攻击55
            </p>
            <p className="text-[#858585]">
              → 新攻击 = 50 + (60 - 55) = <b>55</b>
            </p>
          </div>
          <div className="space-y-1">
            <p>
              • <b>生命/体力/法力</b>：升级后自动恢复满
            </p>
            <p>
              • <b>攻击/防御</b>：基础值 + 装备加成
            </p>
            <p>
              • <b>闪避</b>：影响命中率计算
            </p>
            <p className="text-[#6a9955] mt-1">💡 NPC用SetLevelTo直接设置，玩家用LevelUpTo累加</p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ========== 原公式提示（弃用，改用常态化面板） ==========
function FormulaTooltip({ isPlayer }: { isPlayer: boolean }) {
  const [show, setShow] = useState(false);

  return (
    <div className="relative inline-block">
      <button
        type="button"
        onClick={() => setShow(!show)}
        className="text-[#858585] hover:text-[#0098ff] text-xs underline"
      >
        📐 公式帮助
      </button>
      {show && (
        <div className="absolute left-0 top-6 z-20 w-80 bg-[#1e1e1e] border border-widget-border rounded-lg shadow-xl p-4 text-xs text-[#cccccc]">
          <button
            type="button"
            onClick={() => setShow(false)}
            className="absolute top-2 right-2 text-[#858585] hover:text-white"
          >
            ✕
          </button>
          <h4 className="font-medium text-white mb-2">升级属性计算</h4>
          <p className="mb-2 text-[#858585]">
            升级时，属性按<b>增量</b>计算：
          </p>
          <code className="block bg-[#252526] p-2 rounded mb-2">
            新属性 = 当前属性 + (目标等级属性 - 当前等级属性)
          </code>
          <div className="space-y-1">
            <p>
              <b>生命/体力/法力</b>：升级后自动恢复满
            </p>
            <p>
              <b>攻击</b>：基础攻击 + 装备攻击加成
            </p>
            <p>
              <b>防御</b>：基础防御 + 装备防御加成
            </p>
            <p>
              <b>闪避</b>：闪避值，影响躲避攻击概率
            </p>
          </div>
          {isPlayer && (
            <div className="mt-3 pt-2 border-t border-widget-border">
              <p>
                <b>新武功</b>：升级时自动学会的武功 INI 路径
              </p>
            </div>
          )}
          <div className="mt-3 pt-2 border-t border-widget-border text-[#858585]">
            <p>💡 NPC 使用 SetLevelTo 直接设置属性</p>
            <p>💡 玩家使用 LevelUpTo 累加属性</p>
          </div>
        </div>
      )}
    </div>
  );
}

// ========== 详情/编辑页 ==========

export function LevelDetailPage() {
  const { gameId: gameSlug, levelConfigId } = useParams<{
    gameId: string;
    levelConfigId: string;
  }>();
  const { currentGame, editCache } = useDashboard();
  const gameId = currentGame?.id;
  const navigate = useNavigate();
  const toast = useToast();
  const utils = api.useUtils();
  const basePath = `/dashboard/${gameSlug}/levels`;
  const isNew = levelConfigId === "new";

  // 缓存 key
  const cacheKey = levelConfigId ? `level:${levelConfigId}` : null;

  // URL 参数获取类型
  const searchParams = new URLSearchParams(window.location.search);
  const userTypeParam = (searchParams.get("type") as LevelUserType) || "player";

  // 查询配置详情
  const { data: levelConfig, isLoading } = api.level.get.useQuery(
    { gameId: gameId!, id: levelConfigId! },
    { enabled: !!gameId && !!levelConfigId && !isNew }
  );

  // 表单状态 - 优先从缓存读取
  const [formData, setFormData] = useState<Partial<LevelConfig>>(() => {
    if (cacheKey && editCache.has(cacheKey)) {
      return editCache.get<Partial<LevelConfig>>(cacheKey) || {};
    }
    return {};
  });

  // ── 实体切换检测 ──
  const prevCacheKeyRef = useRef(cacheKey);
  const skipNextCacheSyncRef = useRef(false);

  useMemo(() => {
    if (cacheKey !== prevCacheKeyRef.current) {
      skipNextCacheSyncRef.current = true;
    }
  }, [cacheKey]);

  // 0️⃣ 实体切换 → 重置表单数据
  useEffect(() => {
    if (cacheKey === prevCacheKeyRef.current) return;
    prevCacheKeyRef.current = cacheKey;
    if (!cacheKey) {
      setFormData({});
      return;
    }
    if (editCache.has(cacheKey)) {
      setFormData(editCache.get<Partial<LevelConfig>>(cacheKey) || {});
    } else {
      setFormData({});
    }
  }, [cacheKey, editCache]);

  // 1️⃣ 同步表单数据到缓存（跳过实体切换时的旧数据写入）
  useEffect(() => {
    if (skipNextCacheSyncRef.current) {
      skipNextCacheSyncRef.current = false;
      return;
    }
    if (cacheKey && Object.keys(formData).length > 0) {
      editCache.set(cacheKey, formData);
    }
  }, [cacheKey, formData, editCache]);

  // 2️⃣ 新建时初始化表单
  useEffect(() => {
    if (isNew && gameId && Object.keys(formData).length === 0) {
      setFormData({
        gameId,
        key: "",
        name: userTypeParam === "player" ? "新玩家配置" : "新NPC配置",
        userType: userTypeParam,
        maxLevel: 80,
        levels: createDefaultLevelConfigLevels(80, userTypeParam),
      });
    }
  }, [isNew, gameId, userTypeParam, formData]);

  // 3️⃣ 加载数据后更新表单（只在没有缓存时）
  useEffect(() => {
    if (levelConfig && cacheKey && !editCache.has(cacheKey)) {
      setFormData(levelConfig);
    }
  }, [levelConfig, cacheKey, editCache]);

  // 创建
  const createMutation = api.level.create.useMutation({
    onSuccess: (data) => {
      if (cacheKey) {
        editCache.remove(cacheKey);
      }
      toast.success(`配置「${data.name}」创建成功`);
      if (gameId) {
        utils.level.list.invalidate({ gameId });
      }
      navigate(`${basePath}/${data.id}`);
    },
    onError: (error) => {
      toast.error(`创建失败: ${error.message}`);
    },
  });

  // 更新
  const updateMutation = api.level.update.useMutation({
    onSuccess: (data) => {
      if (cacheKey) {
        editCache.remove(cacheKey);
      }
      utils.level.list.invalidate({ gameId: gameId! });
      utils.level.get.invalidate({ gameId: gameId!, id: levelConfigId! });
      toast.success(`配置「${data.name}」保存成功`);
    },
    onError: (error) => {
      toast.error(`保存失败: ${error.message}`);
    },
  });

  // 删除
  const deleteMutation = api.level.delete.useMutation({
    onSuccess: () => {
      if (cacheKey) {
        editCache.remove(cacheKey);
      }
      if (gameId) {
        utils.level.list.invalidate({ gameId });
      }
      toast.success(`配置已删除`);
      navigate(basePath);
    },
  });

  const handleSave = useCallback(() => {
    if (!gameId) return;

    if (isNew) {
      if (!formData.key) {
        toast.error("请填写配置标识");
        return;
      }
      createMutation.mutate({
        gameId,
        key: formData.key!,
        name: formData.name || "新配置",
        userType: formData.userType || "player",
        maxLevel: formData.maxLevel || 80,
        levels: formData.levels,
      });
    } else if (levelConfigId) {
      updateMutation.mutate({
        id: levelConfigId,
        gameId,
        data: {
          key: formData.key,
          name: formData.name,
          userType: formData.userType,
          maxLevel: formData.maxLevel,
          levels: formData.levels,
        },
      } as never);
    }
  }, [gameId, levelConfigId, isNew, formData, createMutation, updateMutation, toast]);

  const handleDelete = useCallback(() => {
    if (!gameId || !levelConfigId || isNew) return;
    if (confirm(`确定要删除「${formData.name}」吗？`)) {
      deleteMutation.mutate({ gameId, id: levelConfigId });
    }
  }, [gameId, levelConfigId, isNew, formData.name, deleteMutation]);

  const updateLevel = useCallback(
    (levelIndex: number, field: keyof LevelDetail, value: number | string) => {
      setFormData((prev) => {
        const levels = [...(prev.levels || [])];
        levels[levelIndex] = { ...levels[levelIndex], [field]: value };
        return { ...prev, levels };
      });
    },
    []
  );

  // 添加等级行
  const addLevel = useCallback(() => {
    setFormData((prev) => {
      const levels = [...(prev.levels || [])];
      const nextLevel = levels.length + 1;
      const lastLevel = levels[levels.length - 1];
      // 基于最后一级创建新等级，属性稍微增加
      const newLevel: LevelDetail = lastLevel
        ? {
            ...lastLevel,
            level: nextLevel,
            levelUpExp: Math.floor((lastLevel.levelUpExp || 100) * 1.1),
            lifeMax: Math.floor((lastLevel.lifeMax || 100) * 1.05),
            thewMax: Math.floor((lastLevel.thewMax || 100) * 1.02),
            manaMax: Math.floor((lastLevel.manaMax || 100) * 1.02),
            attack: Math.floor((lastLevel.attack || 10) * 1.03),
            defend: Math.floor((lastLevel.defend || 10) * 1.03),
            evade: (lastLevel.evade || 0) + 1,
            newMagic: "",
          }
        : createDefaultLevelDetail(nextLevel, prev.userType || "player");
      levels.push(newLevel);
      return { ...prev, levels, maxLevel: nextLevel };
    });
  }, []);

  // 删除最后一级
  const removeLastLevel = useCallback(() => {
    setFormData((prev) => {
      const levels = [...(prev.levels || [])];
      if (levels.length <= 1) return prev;
      levels.pop();
      return { ...prev, levels, maxLevel: levels.length };
    });
  }, []);

  // 删除指定等级
  const removeLevel = useCallback((levelIndex: number) => {
    setFormData((prev) => {
      const levels = [...(prev.levels || [])];
      if (levels.length <= 1) return prev;
      levels.splice(levelIndex, 1);
      // 重新编号
      levels.forEach((l, i) => {
        l.level = i + 1;
      });
      return { ...prev, levels, maxLevel: levels.length };
    });
  }, []);

  if (isLoading && !isNew) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-[#858585]">加载中...</div>
      </div>
    );
  }

  const isPlayerConfig = formData.userType === "player";
  const levels = formData.levels || [];

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* 顶部操作栏 */}
      <div className="flex-shrink-0 bg-[#252526] border-b border-panel-border px-4 py-2 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <span className="text-lg">{isPlayerConfig ? "👤" : "🤖"}</span>
          <div className="flex items-center gap-3">
            <input
              type="text"
              value={formData.name || ""}
              onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
              placeholder="配置名称"
              className="px-2 py-1 bg-transparent border-b border-widget-border text-white text-sm focus:outline-none focus:border-focus-border w-40"
            />
            <span className="text-[#858585] text-xs">|</span>
            <input
              type="text"
              value={formData.key || ""}
              onChange={(e) => setFormData((prev) => ({ ...prev, key: e.target.value }))}
              placeholder="key"
              className="px-2 py-1 bg-transparent border-b border-widget-border text-[#858585] text-xs focus:outline-none focus:border-focus-border w-32"
            />
            <span className="text-[#858585] text-xs">|</span>
            <span className="text-[#858585] text-xs">{levels.length} 级</span>
            <FormulaTooltip isPlayer={isPlayerConfig} />
          </div>
        </div>

        <div className="flex items-center gap-2">
          {!isNew && (
            <button
              type="button"
              onClick={handleDelete}
              className="px-3 py-1.5 text-sm text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded transition-colors"
            >
              删除
            </button>
          )}
          <button
            type="button"
            onClick={handleSave}
            disabled={createMutation.isPending || updateMutation.isPending}
            className="px-4 py-1.5 text-sm bg-[#0e639c] hover:bg-[#1177bb] text-white rounded transition-colors disabled:opacity-50"
          >
            {createMutation.isPending || updateMutation.isPending ? "保存中..." : "保存"}
          </button>
        </div>
      </div>

      {/* 战斗公式说明面板 */}
      <CombatFormulaPanel />

      {/* 等级表格 - 全部显示 */}
      <div className="flex-1 overflow-auto">
        <table className="w-full text-sm border-collapse">
          <thead className="bg-[#1e1e1e] sticky top-0 z-10">
            <tr className="text-left text-[#858585]">
              <th className="px-2 py-2 w-10 font-medium border-b border-widget-border">Lv</th>
              {isPlayerConfig ? (
                <>
                  <th className="px-2 py-2 font-medium border-b border-widget-border">升级Exp</th>
                  <th className="px-2 py-2 font-medium border-b border-widget-border">生命</th>
                  <th className="px-2 py-2 font-medium border-b border-widget-border">体力</th>
                  <th className="px-2 py-2 font-medium border-b border-widget-border">法力</th>
                  <th className="px-2 py-2 font-medium border-b border-widget-border">攻击</th>
                  <th className="px-2 py-2 font-medium border-b border-widget-border">防御</th>
                  <th className="px-2 py-2 font-medium border-b border-widget-border">闪避</th>
                  <th className="px-2 py-2 font-medium border-b border-widget-border">新武功</th>
                  <th className="px-2 py-2 w-10 font-medium border-b border-widget-border"></th>
                </>
              ) : (
                <>
                  <th className="px-2 py-2 font-medium border-b border-widget-border">Exp</th>
                  <th className="px-2 py-2 font-medium border-b border-widget-border">生命</th>
                  <th className="px-2 py-2 font-medium border-b border-widget-border">攻击</th>
                  <th className="px-2 py-2 font-medium border-b border-widget-border">防御</th>
                  <th className="px-2 py-2 font-medium border-b border-widget-border">闪避</th>
                  <th className="px-2 py-2 font-medium border-b border-widget-border">新武功</th>
                  <th className="px-2 py-2 w-10 font-medium border-b border-widget-border"></th>
                </>
              )}
            </tr>
          </thead>
          <tbody>
            {levels.map((levelData, idx) => (
              <tr
                key={levelData.level}
                className="border-b border-[#2a2a2a] hover:bg-[#2a2a2a] group"
              >
                <td className="px-2 py-1 text-[#cccccc] font-medium text-center">
                  {levelData.level}
                </td>
                {isPlayerConfig ? (
                  <>
                    <td className="px-2 py-1">
                      <NumberInput
                        value={levelData.levelUpExp || 0}
                        onChange={(v) => updateLevel(idx, "levelUpExp", v ?? 0)}
                        className="w-20"
                      />
                    </td>
                    <td className="px-2 py-1">
                      <NumberInput
                        value={levelData.lifeMax || 0}
                        onChange={(v) => updateLevel(idx, "lifeMax", v ?? 0)}
                        className="w-16"
                      />
                    </td>
                    <td className="px-2 py-1">
                      <NumberInput
                        value={levelData.thewMax || 0}
                        onChange={(v) => updateLevel(idx, "thewMax", v ?? 0)}
                        className="w-14"
                      />
                    </td>
                    <td className="px-3 py-1.5">
                      <NumberInput
                        value={levelData.manaMax || 0}
                        onChange={(v) => updateLevel(idx, "manaMax", v ?? 0)}
                        className="w-14"
                      />
                    </td>
                    <td className="px-3 py-1.5">
                      <NumberInput
                        value={levelData.attack || 0}
                        onChange={(v) => updateLevel(idx, "attack", v ?? 0)}
                        className="w-14"
                      />
                    </td>
                    <td className="px-3 py-1.5">
                      <NumberInput
                        value={levelData.defend || 0}
                        onChange={(v) => updateLevel(idx, "defend", v ?? 0)}
                        className="w-14"
                      />
                    </td>
                    <td className="px-3 py-1.5">
                      <NumberInput
                        value={levelData.evade || 0}
                        onChange={(v) => updateLevel(idx, "evade", v ?? 0)}
                        className="w-12"
                      />
                    </td>
                    <td className="px-3 py-1.5">
                      <input
                        type="text"
                        value={levelData.newMagic || ""}
                        onChange={(e) => updateLevel(idx, "newMagic", e.target.value)}
                        placeholder=""
                        className="w-32 px-2 py-0.5 bg-[#3c3c3c] border border-widget-border rounded text-white text-xs focus:outline-none focus:border-focus-border"
                      />
                    </td>
                    <td className="px-2 py-1 text-center">
                      <button
                        type="button"
                        onClick={() => removeLevel(idx)}
                        disabled={levels.length <= 1}
                        className="text-[#858585] hover:text-red-400 disabled:opacity-30 disabled:cursor-not-allowed opacity-0 group-hover:opacity-100 transition-opacity"
                        title="删除此级"
                      >
                        ✕
                      </button>
                    </td>
                  </>
                ) : (
                  <>
                    <td className="px-3 py-1.5">
                      <NumberInput
                        value={levelData.exp || 0}
                        onChange={(v) => updateLevel(idx, "exp", v ?? 0)}
                        className="w-16"
                      />
                    </td>
                    <td className="px-3 py-1.5">
                      <NumberInput
                        value={levelData.life || levelData.lifeMax || 0}
                        onChange={(v) => updateLevel(idx, "life", v ?? 0)}
                        className="w-16"
                      />
                    </td>
                    <td className="px-3 py-1.5">
                      <NumberInput
                        value={levelData.attack || 0}
                        onChange={(v) => updateLevel(idx, "attack", v ?? 0)}
                        className="w-14"
                      />
                    </td>
                    <td className="px-3 py-1.5">
                      <NumberInput
                        value={levelData.defend || 0}
                        onChange={(v) => updateLevel(idx, "defend", v ?? 0)}
                        className="w-14"
                      />
                    </td>
                    <td className="px-2 py-1">
                      <NumberInput
                        value={levelData.evade || 0}
                        onChange={(v) => updateLevel(idx, "evade", v ?? 0)}
                        className="w-12"
                      />
                    </td>
                    <td className="px-2 py-1">
                      <input
                        type="text"
                        value={levelData.newMagic || ""}
                        onChange={(e) => updateLevel(idx, "newMagic", e.target.value)}
                        placeholder=""
                        className="w-28 px-2 py-0.5 bg-[#3c3c3c] border border-widget-border rounded text-white text-xs focus:outline-none focus:border-focus-border"
                      />
                    </td>
                    <td className="px-2 py-1 text-center">
                      <button
                        type="button"
                        onClick={() => removeLevel(idx)}
                        disabled={levels.length <= 1}
                        className="text-[#858585] hover:text-red-400 disabled:opacity-30 disabled:cursor-not-allowed opacity-0 group-hover:opacity-100 transition-opacity"
                        title="删除此级"
                      >
                        ✕
                      </button>
                    </td>
                  </>
                )}
              </tr>
            ))}
            {/* 添加行 */}
            <tr className="border-b border-[#2a2a2a]">
              <td colSpan={isPlayerConfig ? 10 : 8} className="px-2 py-2">
                <button
                  type="button"
                  onClick={addLevel}
                  className="flex items-center gap-2 text-xs text-[#858585] hover:text-[#0098ff] transition-colors"
                >
                  <span className="text-lg">+</span>
                  添加等级 {levels.length + 1}
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

// 旧的 StrengthConfigPage 保持兼容
export function StrengthConfigPage() {
  return <EditorEmptyState icon="📊" title="强度配置" description="强度配置功能正在开发中..." />;
}
