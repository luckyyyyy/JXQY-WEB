/**
 * NPC 列表侧边栏面板
 * NpcListPanel + ImportNpcModal + CreateNpcModal + CreateNpcResourceModal
 */

import { api } from "@miu2d/shared";
import { useMemo, useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import {
  BatchItemRow,
  CreateEntityModal,
  ImportIniModal,
  readDroppedFiles,
  type ImportResult,
} from "../components/common";
import { LazyAsfIcon } from "../components/common/LazyAsfIcon";
import { useDashboard } from "../DashboardContext";
import { DashboardIcons } from "../icons";

export function NpcListPanel({ basePath }: { basePath: string }) {
  const { currentGame } = useDashboard();
  const navigate = useNavigate();
  const gameId = currentGame?.id;
  const [showImportModal, setShowImportModal] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createType, setCreateType] = useState<"npc" | "resource">("npc");
  const [filterKind, setFilterKind] = useState<"all" | "npc" | "resource">("all");
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});

  const {
    data: npcList,
    isLoading: npcLoading,
    refetch: refetchNpcs,
  } = api.npc.list.useQuery({ gameId: gameId! }, { enabled: !!gameId });

  const {
    data: resourceList,
    isLoading: resourceLoading,
    refetch: refetchResources,
  } = api.npcResource.list.useQuery({ gameId: gameId! }, { enabled: !!gameId });

  const refetch = () => {
    refetchNpcs();
    refetchResources();
  };

  const batchImportMutation = api.npc.batchImportFromIni.useMutation({
    onSuccess: (_result) => {
      const result = _result as ImportResult;
      refetch();
      setShowImportModal(false);
      if (result.success.length > 0) {
        navigate(`${basePath}/${result.success[0].id}`);
      }
    },
  });

  // 按关系类型分组 NPC
  const groupedNpcs = useMemo(() => {
    if (!npcList) return { Friendly: [], Hostile: [], Neutral: [], Partner: [] };

    const groups: Record<string, typeof npcList> = {
      Friendly: [],
      Hostile: [],
      Neutral: [],
      Partner: [],
    };

    for (const npc of npcList) {
      const relation = npc.relation || "Neutral";
      if (!groups[relation]) groups[relation] = [];
      groups[relation].push(npc);
    }

    return groups;
  }, [npcList]);

  const toggleGroup = (key: string) => {
    setCollapsedGroups((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const relationLabels: Record<string, string> = {
    Friendly: "友好",
    Hostile: "敌对",
    Neutral: "中立",
    Partner: "伙伴",
  };

  const relationIcons: Record<string, string> = {
    Friendly: "🟢",
    Hostile: "🔴",
    Neutral: "🟡",
    Partner: "🔵",
  };

  const isLoading = npcLoading || resourceLoading;
  const showNpcs = filterKind === "all" || filterKind === "npc";
  const showResources = filterKind === "all" || filterKind === "resource";

  return (
    <>
      <div className="flex h-full w-60 flex-col bg-[#252526] border-r border-panel-border">
        {/* 标题栏 */}
        <div className="flex h-9 items-center justify-between px-4 border-b border-panel-border">
          <span className="text-xs font-medium uppercase tracking-wide text-[#bbbbbb]">
            NPC 列表
          </span>
        </div>

        {/* 操作按钮 */}
        <div className="flex flex-col gap-1 p-2 border-b border-panel-border">
          <button
            type="button"
            onClick={() => setShowImportModal(true)}
            className="flex items-center gap-2 px-2 py-1.5 text-xs text-[#cccccc] hover:bg-[#3c3c3c] rounded transition-colors"
          >
            {DashboardIcons.upload}
            <span>从 INI 导入</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setCreateType("npc");
              setShowCreateModal(true);
            }}
            className="flex items-center gap-2 px-2 py-1.5 text-xs text-[#cccccc] hover:bg-[#3c3c3c] rounded transition-colors"
          >
            {DashboardIcons.add}
            <span>新建 NPC</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setCreateType("resource");
              setShowCreateModal(true);
            }}
            className="flex items-center gap-2 px-2 py-1.5 text-xs text-[#cccccc] hover:bg-[#3c3c3c] rounded transition-colors"
          >
            {DashboardIcons.add}
            <span>新建 NPC 资源</span>
          </button>
        </div>

        {/* 类型过滤器 */}
        <div className="flex gap-1 px-2 py-1.5 border-b border-panel-border">
          <button
            type="button"
            onClick={() => setFilterKind("all")}
            className={`flex-1 px-2 py-1 text-xs rounded transition-colors ${
              filterKind === "all" ? "bg-[#094771] text-white" : "text-[#cccccc] hover:bg-[#3c3c3c]"
            }`}
          >
            全部
          </button>
          <button
            type="button"
            onClick={() => setFilterKind("npc")}
            className={`flex-1 px-2 py-1 text-xs rounded transition-colors ${
              filterKind === "npc" ? "bg-[#094771] text-white" : "text-[#cccccc] hover:bg-[#3c3c3c]"
            }`}
          >
            NPC
          </button>
          <button
            type="button"
            onClick={() => setFilterKind("resource")}
            className={`flex-1 px-2 py-1 text-xs rounded transition-colors ${
              filterKind === "resource"
                ? "bg-purple-600 text-white"
                : "text-purple-400 hover:bg-[#3c3c3c]"
            }`}
          >
            资源
          </button>
        </div>

        {/* 列表内容 */}
        <div className="flex-1 overflow-y-auto py-1">
          {isLoading ? (
            <div className="px-4 py-2 text-sm text-[#858585]">加载中...</div>
          ) : (
            <>
              {/* NPC 列表 - 按关系分组 */}
              {showNpcs && (
                <>
                  {filterKind === "all" && (
                    <div className="px-3 py-1.5 text-xs font-medium text-[#569cd6] border-b border-panel-border">
                      🧙 NPC ({npcList?.length || 0})
                    </div>
                  )}
                  {!npcList || npcList.length === 0 ? (
                    <div className="px-4 py-2 text-sm text-[#858585]">暂无 NPC</div>
                  ) : (
                    Object.entries(groupedNpcs).map(([relation, npcs]) => {
                      if (!npcs || npcs.length === 0) return null;
                      return (
                        <div key={relation}>
                          <button
                            type="button"
                            onClick={() => toggleGroup(relation)}
                            className="w-full px-3 py-1.5 text-xs font-medium text-[#858585] flex items-center gap-2 hover:bg-[#2a2d2e] transition-colors"
                          >
                            <span
                              className={`transition-transform ${collapsedGroups[relation] ? "" : "rotate-90"}`}
                            >
                              ▶
                            </span>
                            <span>{relationIcons[relation]}</span>
                            <span>{relationLabels[relation]}</span>
                            <span className="text-[#666]">({npcs.length})</span>
                          </button>
                          {!collapsedGroups[relation] &&
                            npcs.map((npc) => (
                              <NavLink
                                key={npc.id}
                                to={`${basePath}/${npc.id}`}
                                className={({ isActive }) =>
                                  `flex items-center gap-3 px-3 py-2 pl-6 text-sm transition-colors ${
                                    isActive ? "bg-[#094771] text-white" : "hover:bg-[#2a2d2e]"
                                  }`
                                }
                              >
                                <LazyAsfIcon
                                  iconPath={npc.icon}
                                  gameSlug={currentGame?.slug}
                                  size={32}
                                  prefix="asf/character/"
                                  fallback="🧙"
                                />
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2">
                                    <span className="truncate font-medium">{npc.name}</span>
                                    <span
                                      className={`text-xs ${
                                        npc.kind === "Fighter" ? "text-red-400" : "text-green-400"
                                      }`}
                                    >
                                      Lv.{npc.level ?? 1}
                                    </span>
                                  </div>
                                  <span className="text-xs text-[#858585] truncate block">
                                    {npc.key}
                                  </span>
                                </div>
                              </NavLink>
                            ))}
                        </div>
                      );
                    })
                  )}
                </>
              )}

              {/* NPC 资源列表 */}
              {showResources && (
                <>
                  {filterKind === "all" && (
                    <div className="px-3 py-1.5 text-xs font-medium text-purple-400 border-b border-panel-border mt-2">
                      🎨 NPC 资源 ({resourceList?.length || 0})
                    </div>
                  )}
                  {!resourceList || resourceList.length === 0 ? (
                    <div className="px-4 py-2 text-sm text-[#858585]">暂无 NPC 资源</div>
                  ) : (
                    resourceList.map((resource) => (
                      <NavLink
                        key={resource.id}
                        to={`${basePath}/resource/${resource.id}`}
                        className={({ isActive }) =>
                          `flex items-center gap-3 px-3 py-2 text-sm transition-colors ${
                            isActive ? "bg-purple-600/50 text-white" : "hover:bg-[#2a2d2e]"
                          }`
                        }
                      >
                        <LazyAsfIcon
                          iconPath={resource.icon}
                          gameSlug={currentGame?.slug}
                          size={32}
                          prefix="asf/character/"
                          fallback="🎨"
                        />
                        <div className="flex-1 min-w-0">
                          <span className="truncate font-medium block">{resource.name}</span>
                          <span className="text-xs text-[#858585] truncate block">
                            {resource.key}
                          </span>
                        </div>
                      </NavLink>
                    ))
                  )}
                </>
              )}
            </>
          )}
        </div>
      </div>

      {/* INI 导入模态框 */}
      {showImportModal && (
        <ImportIniModal<NpcImportItem>
          title="从 INI 导入 NPC"
          icon="🧙"
          dropHint="拖放 npc 和 npcres 文件夹到此处"
          dropSubHint="支持批量导入，自动合并资源"
          entityLabel="NPC"
          onClose={() => setShowImportModal(false)}
          onImport={(items) => batchImportMutation.mutate({ gameId: gameId!, items })}
          isLoading={batchImportMutation.isPending}
          batchResult={batchImportMutation.data as ImportResult | undefined}
          processFiles={processNpcDrop}
          renderItem={(item, _index, onRemove) => (
            <BatchItemRow
              key={`${item.type}-${item.fileName}`}
              fileName={item.fileName}
              onRemove={onRemove}
              badge={
                item.type === "resource" ? (
                  <span className="text-xs px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-400">
                    外观
                  </span>
                ) : (
                  <span className="text-xs px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-400">
                    NPC
                  </span>
                )
              }
              extra={
                item.type === "npc" && item.npcResContent ? (
                  <span className="text-xs text-green-400">+ 资源</span>
                ) : undefined
              }
            />
          )}
          renderSuccessItem={(s) => {
            const type = s.type as string;
            const hasResources = s.hasResources as boolean;
            return (
              <div className="flex items-center gap-1">
                <span
                  className={`px-1 rounded text-[10px] ${type === "npc" ? "bg-blue-500/30 text-blue-300" : "bg-purple-500/30 text-purple-300"}`}
                >
                  {type === "npc" ? "NPC" : "外观"}
                </span>
                <span>{s.name}</span>
                {hasResources && <span className="text-green-300">+ 资源</span>}
              </div>
            );
          }}
          description={
            <div className="text-xs text-[#858585] bg-[#1e1e1e] p-3 rounded">
              <p className="mb-1">支持拖入以下结构：</p>
              <ul className="list-disc list-inside space-y-0.5">
                <li>
                  <code className="text-[#ce9178]">npc/</code> - NPC 配置目录
                </li>
                <li>
                  <code className="text-[#ce9178]">npcres/</code> - NPC 外观配置目录
                </li>
              </ul>
              <p className="mt-2">NPC 会自动关联同名外观，独立外观也会被导入</p>
            </div>
          }
        />
      )}

      {/* 新建模态框 */}
      {showCreateModal && createType === "npc" && (
        <CreateNpcModal
          onClose={() => setShowCreateModal(false)}
          basePath={basePath}
          gameId={gameId!}
          onSuccess={() => refetch()}
        />
      )}
      {showCreateModal && createType === "resource" && (
        <CreateNpcResourceModal
          onClose={() => setShowCreateModal(false)}
          basePath={basePath}
          gameId={gameId!}
          onSuccess={() => refetch()}
        />
      )}
    </>
  );
}

// ===== NPC 导入辅助 =====

interface NpcImportItem {
  fileName: string;
  type: "npc" | "resource";
  iniContent?: string;
  npcResContent?: string;
}

/** 判断文件属于 npc/ 还是 npcres/ 目录 */
function getFileCategory(fullPath: string): "npc" | "npcres" | null {
  const p = fullPath.toLowerCase();
  if (p.match(/[/\\]npcres[/\\]/) || p.startsWith("npcres/") || p.startsWith("npcres\\"))
    return "npcres";
  if (p.match(/[/\\]npc[/\\]/) || p.startsWith("npc/") || p.startsWith("npc\\")) return "npc";
  return null;
}

/** 从 npc ini 内容中解析 NpcIni 字段值 */
function parseNpcIniField(content: string): string | null {
  const match = content.match(/^\s*NpcIni\s*=\s*(.+?)\s*$/im);
  return match ? match[1].toLowerCase() : null;
}

/** 处理 NPC 文件拖放，分类 npc/npcres 并合并 */
async function processNpcDrop(dt: DataTransfer): Promise<NpcImportItem[]> {
  const allFiles = await readDroppedFiles(dt);
  const npcFiles = new Map<string, { fileName: string; content: string }>();
  const npcResFiles = new Map<string, { fileName: string; content: string }>();

  for (const f of allFiles) {
    const cat = getFileCategory(f.fullPath);
    if (cat === "npc")
      npcFiles.set(f.fileName.toLowerCase(), { fileName: f.fileName, content: f.content });
    else if (cat === "npcres")
      npcResFiles.set(f.fileName.toLowerCase(), { fileName: f.fileName, content: f.content });
  }

  const items: NpcImportItem[] = [];

  // NPC 文件 — 自动关联同名外观
  for (const [_, npcInfo] of npcFiles) {
    const npcIniField = parseNpcIniField(npcInfo.content);
    const npcResInfo = npcIniField ? npcResFiles.get(npcIniField) : null;
    items.push({
      fileName: npcInfo.fileName,
      type: "npc",
      iniContent: npcInfo.content,
      npcResContent: npcResInfo?.content,
    });
  }

  // 所有 npcres 文件都作为独立外观导入
  for (const [_, npcResInfo] of npcResFiles) {
    items.push({
      fileName: npcResInfo.fileName,
      type: "resource",
      npcResContent: npcResInfo.content,
    });
  }

  return items;
}

// ===== 新建 NPC 弹窗 =====
function CreateNpcModal({
  onClose,
  basePath,
  gameId,
  onSuccess,
}: {
  onClose: () => void;
  basePath: string;
  gameId: string;
  onSuccess: () => void;
}) {
  const navigate = useNavigate();
  const [kind, setKind] = useState<"Normal" | "Fighter">("Normal");
  const [relation, setRelation] = useState<"Friend" | "Enemy" | "Neutral">("Friend");
  const [name, setName] = useState("");
  const [key, setKey] = useState("");

  const createMutation = api.npc.create.useMutation({
    onSuccess: (data) => {
      onSuccess();
      onClose();
      navigate(`${basePath}/${data.id}`);
    },
  });

  return (
    <CreateEntityModal
      title="新建 NPC"
      onClose={onClose}
      onCreate={() =>
        createMutation.mutate({
          gameId,
          key: key || `npc_${Date.now()}`,
          name,
          kind,
          relation,
        })
      }
      createDisabled={!name.trim()}
      isPending={createMutation.isPending}
      error={createMutation.error}
    >
      <div>
        <label className="block text-xs text-[#858585] mb-1">名称</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full px-3 py-2 bg-[#3c3c3c] border border-widget-border rounded text-white text-sm focus:outline-none focus:border-focus-border"
          placeholder="输入 NPC 名称"
        />
      </div>
      <div>
        <label className="block text-xs text-[#858585] mb-1">标识符 (可选)</label>
        <input
          type="text"
          value={key}
          onChange={(e) => setKey(e.target.value)}
          className="w-full px-3 py-2 bg-[#3c3c3c] border border-widget-border rounded text-white text-sm focus:outline-none focus:border-focus-border"
          placeholder="留空将自动生成"
        />
      </div>
      <div>
        <label className="block text-xs text-[#858585] mb-1">类型</label>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setKind("Normal")}
            className={`flex-1 px-3 py-2 text-sm rounded transition-colors ${
              kind === "Normal"
                ? "bg-green-600 text-white"
                : "bg-[#3c3c3c] text-[#cccccc] hover:bg-[#4c4c4c]"
            }`}
          >
            🧑 普通
          </button>
          <button
            type="button"
            onClick={() => setKind("Fighter")}
            className={`flex-1 px-3 py-2 text-sm rounded transition-colors ${
              kind === "Fighter"
                ? "bg-red-600 text-white"
                : "bg-[#3c3c3c] text-[#cccccc] hover:bg-[#4c4c4c]"
            }`}
          >
            ⚔️ 战斗
          </button>
        </div>
      </div>
      <div>
        <label className="block text-xs text-[#858585] mb-1">关系</label>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setRelation("Friend")}
            className={`flex-1 px-3 py-2 text-sm rounded transition-colors ${
              relation === "Friend"
                ? "bg-green-600 text-white"
                : "bg-[#3c3c3c] text-[#cccccc] hover:bg-[#4c4c4c]"
            }`}
          >
            🟢 友好
          </button>
          <button
            type="button"
            onClick={() => setRelation("Neutral")}
            className={`flex-1 px-3 py-2 text-sm rounded transition-colors ${
              relation === "Neutral"
                ? "bg-yellow-600 text-white"
                : "bg-[#3c3c3c] text-[#cccccc] hover:bg-[#4c4c4c]"
            }`}
          >
            🟡 中立
          </button>
          <button
            type="button"
            onClick={() => setRelation("Enemy")}
            className={`flex-1 px-3 py-2 text-sm rounded transition-colors ${
              relation === "Enemy"
                ? "bg-red-600 text-white"
                : "bg-[#3c3c3c] text-[#cccccc] hover:bg-[#4c4c4c]"
            }`}
          >
            🔴 敌对
          </button>
        </div>
      </div>
    </CreateEntityModal>
  );
}

// ===== 新建 NPC 资源弹窗 =====
function CreateNpcResourceModal({
  onClose,
  basePath,
  gameId,
  onSuccess,
}: {
  onClose: () => void;
  basePath: string;
  gameId: string;
  onSuccess: () => void;
}) {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [key, setKey] = useState("");

  const createMutation = api.npcResource.create.useMutation({
    onSuccess: (data) => {
      onSuccess();
      onClose();
      navigate(`${basePath}/resource/${data.id}`);
    },
  });

  return (
    <CreateEntityModal
      title="新建 NPC 资源"
      onClose={onClose}
      onCreate={() =>
        createMutation.mutate({
          gameId,
          key: key || `npcres_${Date.now()}`,
          name,
        })
      }
      createDisabled={!name.trim()}
      isPending={createMutation.isPending}
      error={createMutation.error}
      createButtonClass="px-4 py-2 text-sm bg-purple-600 hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed rounded text-white"
    >
      <div>
        <label className="block text-xs text-[#858585] mb-1">名称</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full px-3 py-2 bg-[#3c3c3c] border border-widget-border rounded text-white text-sm focus:outline-none focus:border-focus-border"
          placeholder="输入资源名称"
        />
      </div>
      <div>
        <label className="block text-xs text-[#858585] mb-1">标识符 (可选)</label>
        <input
          type="text"
          value={key}
          onChange={(e) => setKey(e.target.value)}
          className="w-full px-3 py-2 bg-[#3c3c3c] border border-widget-border rounded text-white text-sm focus:outline-none focus:border-focus-border"
          placeholder="留空将自动生成"
        />
      </div>
      <div className="text-xs text-[#858585] bg-[#1e1e1e] p-3 rounded">
        <p>💡 NPC 资源用于定义 NPC 的视觉表现（动画、图标等），可被多个 NPC 共享使用。</p>
      </div>
    </CreateEntityModal>
  );
}
