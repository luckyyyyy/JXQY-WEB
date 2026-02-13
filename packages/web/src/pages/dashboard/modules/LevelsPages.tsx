/**
 * 等级配置编辑页面
 * 支持玩家和 NPC 等级配置的创建、编辑、导入
 */
import { useCallback, useEffect, useState, useRef } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { trpc } from "../../../lib/trpc";
import { NumberInput } from "@/components/common";
import { useToast } from "../../../contexts/ToastContext";
import { DashboardIcons } from "../icons";
import { useDashboard } from "../DashboardContext";
import type {
  LevelConfig,
  LevelDetail,
  LevelUserType,
  LevelConfigListItem,
} from "@miu2d/types";
import { createDefaultLevelConfigLevels } from "@miu2d/types";

// ========== 列表页 ==========

export function LevelsConfigPage() {
  const { gameId: gameSlug } = useParams<{ gameId: string }>();
  const { currentGame } = useDashboard();
  const gameId = currentGame?.id;
  const navigate = useNavigate();
  const toast = useToast();
  const utils = trpc.useUtils();

  // 查询等级配置列表
  const { data: levelConfigs, isLoading } = trpc.level.list.useQuery(
    { gameId: gameId! },
    { enabled: !!gameId }
  );

  // 删除配置
  const deleteMutation = trpc.level.delete.useMutation({
    onSuccess: () => {
      toast.success("等级配置已删除");
      if (gameId) {
        utils.level.list.invalidate({ gameId });
      }
    },
    onError: (error) => {
      toast.error(`删除失败: ${error.message}`);
    },
  });

  // 导入 INI
  const importMutation = trpc.level.importFromIni.useMutation({
    onSuccess: (data) => {
      toast.success(`导入成功: ${data.name}`);
      if (gameId) {
        utils.level.list.invalidate({ gameId });
      }
      navigate(`/dashboard/${gameSlug}/levels/config/${data.id}`);
    },
    onError: (error) => {
      toast.error(`导入失败: ${error.message}`);
    },
  });

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importUserType, setImportUserType] = useState<LevelUserType>("player");

  const handleImportClick = (userType: LevelUserType) => {
    setImportUserType(userType);
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !gameId) return;

    const content = await file.text();
    importMutation.mutate({
      gameId,
      fileName: file.name,
      userType: importUserType,
      iniContent: content,
    });

    // 清除 input 以便重复选择同一文件
    e.target.value = "";
  };

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-[#858585]">加载中...</div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-auto p-6">
      <input
        ref={fileInputRef}
        type="file"
        accept=".ini"
        className="hidden"
        onChange={handleFileChange}
      />

      <div className="max-w-5xl mx-auto space-y-6">
        {/* 页头 */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-white">等级配置</h1>
            <p className="text-sm text-[#858585] mt-1">
              管理玩家和 NPC 的等级属性成长配置
            </p>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => handleImportClick("player")}
              disabled={importMutation.isPending}
              className="px-3 py-1.5 text-sm bg-[#3c3c3c] hover:bg-[#4a4a4a] text-[#cccccc] rounded-lg transition-colors flex items-center gap-2"
            >
              📥 导入 INI
            </button>
            <Link
              to={`/dashboard/${gameSlug}/levels/config/new?type=player`}
              className="px-3 py-1.5 text-sm bg-[#0e639c] hover:bg-[#1177bb] text-white rounded-lg transition-colors flex items-center gap-2"
            >
              + 新建配置
            </Link>
          </div>
        </div>

        {/* 配置列表 */}
        {!levelConfigs || levelConfigs.length === 0 ? (
          <div className="bg-[#252526] border border-widget-border rounded-lg p-8 text-center">
            <div className="text-4xl mb-3">📊</div>
            <p className="text-[#858585]">暂无等级配置</p>
            <p className="text-xs text-[#666] mt-1">
              点击上方按钮创建或导入配置
            </p>
          </div>
        ) : (
          <div className="grid gap-3">
            {levelConfigs.map((config) => (
              <LevelConfigCard
                key={config.id}
                config={config}
                gameSlug={gameSlug!}
                onDelete={() => {
                  if (gameId && confirm(`确定删除「${config.name}」？`)) {
                    deleteMutation.mutate({ gameId, id: config.id });
                  }
                }}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ========== 配置卡片组件 ==========

function LevelConfigCard({
  config,
  gameSlug,
  onDelete,
}: {
  config: LevelConfigListItem;
  gameSlug: string;
  onDelete: () => void;
}) {
  return (
    <div className="bg-[#252526] border border-widget-border rounded-lg p-4 flex items-center justify-between hover:border-[#0098ff] transition-colors group">
      <Link
        to={`/dashboard/${gameSlug}/levels/config/${config.id}`}
        className="flex-1 flex items-center gap-4"
      >
        <div className="w-10 h-10 bg-[#3c3c3c] rounded-lg flex items-center justify-center text-xl">
          {config.userType === "player" ? "👤" : "🤖"}
        </div>
        <div>
          <div className="text-white font-medium">{config.name}</div>
          <div className="text-xs text-[#858585]">
            <span className="font-mono">{config.key}</span>
            <span className="mx-2">·</span>
            <span>{config.maxLevel} 级</span>
          </div>
        </div>
      </Link>
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          onDelete();
        }}
        className="p-2 rounded-lg text-[#858585] hover:text-red-400 hover:bg-red-500/10 opacity-0 group-hover:opacity-100 transition-all"
      >
        {DashboardIcons.delete}
      </button>
    </div>
  );
}

// ========== 详情/编辑页 ==========

export function LevelConfigDetailPage() {
  const { gameId: gameSlug, levelConfigId } = useParams<{
    gameId: string;
    levelConfigId: string;
  }>();
  const { currentGame } = useDashboard();
  const gameId = currentGame?.id;
  const navigate = useNavigate();
  const toast = useToast();
  const utils = trpc.useUtils();
  const isNew = levelConfigId === "new";

  // URL 参数获取类型
  const searchParams = new URLSearchParams(window.location.search);
  const userTypeParam = (searchParams.get("type") as LevelUserType) || "player";

  // 查询配置详情
  const { data: levelConfig, isLoading } = trpc.level.get.useQuery(
    { gameId: gameId!, id: levelConfigId! },
    { enabled: !!gameId && !!levelConfigId && !isNew }
  );

  // 表单状态
  const [formData, setFormData] = useState<Partial<LevelConfig>>({});

  // 当前编辑的等级范围（用于分页）
  const [levelRange, setLevelRange] = useState({ start: 1, end: 20 });

  // 初始化表单
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

  // 加载数据
  useEffect(() => {
    if (levelConfig) {
      setFormData(levelConfig);
    }
  }, [levelConfig]);

  // 创建
  const createMutation = trpc.level.create.useMutation({
    onSuccess: (data) => {
      toast.success(`配置「${data.name}」创建成功`);
      if (gameId) {
        utils.level.list.invalidate({ gameId });
      }
      navigate(`/dashboard/${gameSlug}/levels/config/${data.id}`);
    },
    onError: (error) => {
      toast.error(`创建失败: ${error.message}`);
    },
  });

  // 更新
  const updateMutation = trpc.level.update.useMutation({
    onSuccess: (data) => {
      toast.success(`配置「${data.name}」保存成功`);
    },
    onError: (error) => {
      toast.error(`保存失败: ${error.message}`);
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
        key: formData.key,
        name: formData.name,
        userType: formData.userType,
        maxLevel: formData.maxLevel,
        levels: formData.levels,
      });
    }
  }, [
    gameId,
    levelConfigId,
    isNew,
    formData,
    createMutation,
    updateMutation,
    toast,
  ]);

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

  if (isLoading && !isNew) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-[#858585]">加载中...</div>
      </div>
    );
  }

  const isPlayerConfig = formData.userType === "player";
  const maxLevel = formData.maxLevel || 80;
  const visibleLevels = (formData.levels || []).slice(
    levelRange.start - 1,
    levelRange.end
  );

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* 头部 */}
      <div className="flex-shrink-0 bg-[#1e1e1e] border-b border-widget-border px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link
              to={`/dashboard/${gameSlug}/levels/config`}
              className="p-2 rounded-lg hover:bg-[#3c3c3c] text-[#858585] hover:text-white transition-colors"
            >
              {DashboardIcons.back}
            </Link>
            <div>
              <h1 className="text-lg font-semibold text-white">
                {isNew ? "新建等级配置" : formData.name || "等级配置详情"}
              </h1>
              <p className="text-xs text-[#858585]">
                {isPlayerConfig ? "玩家配置" : "NPC 配置"}
                {formData.key && (
                  <span className="ml-2 text-[#666]">({formData.key})</span>
                )}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleSave}
            disabled={createMutation.isPending || updateMutation.isPending}
            className="px-4 py-1.5 text-sm bg-[#0e639c] hover:bg-[#1177bb] text-white rounded-lg transition-colors disabled:opacity-50"
          >
            {createMutation.isPending || updateMutation.isPending
              ? "保存中..."
              : "保存"}
          </button>
        </div>
      </div>

      {/* 内容区 */}
      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-6xl mx-auto space-y-6">
          {/* 基础信息 */}
          <section className="bg-[#252526] border border-widget-border rounded-lg p-4 space-y-4">
            <h2 className="text-sm font-medium text-[#cccccc]">基础信息</h2>
            <div className="grid grid-cols-4 gap-4">
              <div>
                <label className="block text-xs text-[#858585] mb-1">
                  配置标识 (key) *
                </label>
                <input
                  type="text"
                  value={formData.key || ""}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, key: e.target.value }))
                  }
                  placeholder="如: level-easy, level-hard"
                  className="w-full px-3 py-2 bg-[#3c3c3c] border border-widget-border rounded-lg text-white text-sm focus:outline-none focus:border-focus-border"
                />
              </div>
              <div>
                <label className="block text-xs text-[#858585] mb-1">
                  配置名称
                </label>
                <input
                  type="text"
                  value={formData.name || ""}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, name: e.target.value }))
                  }
                  placeholder="如: 简单模式, 困难模式"
                  className="w-full px-3 py-2 bg-[#3c3c3c] border border-widget-border rounded-lg text-white text-sm focus:outline-none focus:border-focus-border"
                />
              </div>
              <div>
                <label className="block text-xs text-[#858585] mb-1">
                  配置类型
                </label>
                <select
                  value={formData.userType || "player"}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      userType: e.target.value as LevelUserType,
                    }))
                  }
                  className="w-full px-3 py-2 bg-[#3c3c3c] border border-widget-border rounded-lg text-white text-sm focus:outline-none focus:border-focus-border"
                >
                  <option value="player">玩家</option>
                  <option value="npc">NPC</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-[#858585] mb-1">
                  最大等级
                </label>
                <NumberInput
                  value={formData.maxLevel || 80}
                  onChange={(val) => {
                    const newMax = Math.min(100, Math.max(1, val ?? 80));
                    setFormData((prev) => ({
                      ...prev,
                      maxLevel: newMax,
                      levels: createDefaultLevelConfigLevels(newMax, prev.userType || "player"),
                    }));
                  }}
                  min={1}
                  max={100}
                  className="w-full"
                />
              </div>
            </div>
          </section>

          {/* 等级数据表格 */}
          <section className="bg-[#252526] border border-widget-border rounded-lg overflow-hidden">
            <div className="px-4 py-3 border-b border-widget-border flex items-center justify-between">
              <h2 className="text-sm font-medium text-[#cccccc]">
                等级数据 ({maxLevel} 级)
              </h2>
              {/* 分页控制 */}
              <div className="flex items-center gap-2">
                <span className="text-xs text-[#858585]">显示等级:</span>
                <select
                  value={`${levelRange.start}-${levelRange.end}`}
                  onChange={(e) => {
                    const [start, end] = e.target.value.split("-").map(Number);
                    setLevelRange({ start, end });
                  }}
                  className="px-2 py-1 bg-[#3c3c3c] border border-widget-border rounded text-xs text-white focus:outline-none"
                >
                  {Array.from(
                    { length: Math.ceil(maxLevel / 20) },
                    (_, i) => {
                      const start = i * 20 + 1;
                      const end = Math.min((i + 1) * 20, maxLevel);
                      return (
                        <option key={i} value={`${start}-${end}`}>
                          {start} - {end}
                        </option>
                      );
                    }
                  )}
                </select>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-[#1e1e1e]">
                  <tr className="text-left text-[#858585]">
                    <th className="px-3 py-2 w-16">等级</th>
                    {isPlayerConfig && (
                      <th className="px-3 py-2">升级经验</th>
                    )}
                    {!isPlayerConfig && <th className="px-3 py-2">初始Exp</th>}
                    <th className="px-3 py-2">生命值</th>
                    {isPlayerConfig && <th className="px-3 py-2">体力</th>}
                    {isPlayerConfig && <th className="px-3 py-2">法力</th>}
                    <th className="px-3 py-2">攻击</th>
                    <th className="px-3 py-2">防御</th>
                    <th className="px-3 py-2">闪避</th>
                    {isPlayerConfig && <th className="px-3 py-2">新武功</th>}
                  </tr>
                </thead>
                <tbody>
                  {visibleLevels.map((levelData, idx) => {
                    const levelIndex = levelRange.start - 1 + idx;
                    return (
                      <tr
                        key={levelData.level}
                        className="border-t border-widget-border hover:bg-[#2a2a2a]"
                      >
                        <td className="px-3 py-1.5 text-[#cccccc] font-medium">
                          {levelData.level}
                        </td>
                        {isPlayerConfig && (
                          <td className="px-3 py-1.5">
                            <NumberInput
                              value={levelData.levelUpExp || 0}
                              onChange={(val) =>
                                updateLevel(
                                  levelIndex,
                                  "levelUpExp",
                                  val ?? 0
                                )
                              }
                              className="w-24"
                            />
                          </td>
                        )}
                        {!isPlayerConfig && (
                          <td className="px-3 py-1.5">
                            <NumberInput
                              value={levelData.exp || 0}
                              onChange={(val) =>
                                updateLevel(
                                  levelIndex,
                                  "exp",
                                  val ?? 0
                                )
                              }
                              className="w-20"
                            />
                          </td>
                        )}
                        <td className="px-3 py-1.5">
                          <NumberInput
                            value={levelData.lifeMax || 0}
                            onChange={(val) =>
                              updateLevel(
                                levelIndex,
                                "lifeMax",
                                val ?? 0
                              )
                            }
                            className="w-20"
                          />
                        </td>
                        {isPlayerConfig && (
                          <>
                            <td className="px-3 py-1.5">
                              <NumberInput
                                value={levelData.thewMax || 0}
                                onChange={(val) =>
                                  updateLevel(
                                    levelIndex,
                                    "thewMax",
                                    val ?? 0
                                  )
                                }
                                className="w-16"
                              />
                            </td>
                            <td className="px-3 py-1.5">
                              <NumberInput
                                value={levelData.manaMax || 0}
                                onChange={(val) =>
                                  updateLevel(
                                    levelIndex,
                                    "manaMax",
                                    val ?? 0
                                  )
                                }
                                className="w-16"
                              />
                            </td>
                          </>
                        )}
                        <td className="px-3 py-1.5">
                          <NumberInput
                            value={levelData.attack || 0}
                            onChange={(val) =>
                              updateLevel(
                                levelIndex,
                                "attack",
                                val ?? 0
                              )
                            }
                            className="w-16"
                          />
                        </td>
                        <td className="px-3 py-1.5">
                          <NumberInput
                            value={levelData.defend || 0}
                            onChange={(val) =>
                              updateLevel(
                                levelIndex,
                                "defend",
                                val ?? 0
                              )
                            }
                            className="w-16"
                          />
                        </td>
                        <td className="px-3 py-1.5">
                          <NumberInput
                            value={levelData.evade || 0}
                            onChange={(val) =>
                              updateLevel(
                                levelIndex,
                                "evade",
                                val ?? 0
                              )
                            }
                            className="w-14"
                          />
                        </td>
                        {isPlayerConfig && (
                          <td className="px-3 py-1.5">
                            <input
                              type="text"
                              value={levelData.newMagic || ""}
                              onChange={(e) =>
                                updateLevel(
                                  levelIndex,
                                  "newMagic",
                                  e.target.value
                                )
                              }
                              placeholder="-"
                              className="w-40 px-2 py-1 bg-[#3c3c3c] border border-widget-border rounded text-white text-xs focus:outline-none focus:border-focus-border"
                            />
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

// 导出旧的名称以保持兼容
export function StrengthConfigPage() {
  return (
    <div className="h-full flex items-center justify-center">
      <div className="text-center max-w-md">
        <div className="text-6xl mb-6">📊</div>
        <h2 className="text-xl font-medium text-white mb-3">强度配置</h2>
        <p className="text-[#858585] text-sm leading-relaxed">
          强度配置功能正在开发中...
        </p>
      </div>
    </div>
  );
}
