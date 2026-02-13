/**
 * NPC 列表侧边栏面板
 * NpcListPanel + ImportNpcModal + CreateNpcModal + CreateNpcResourceModal
 */
import { useState, useMemo } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { useDashboard } from "../DashboardContext";
import { DashboardIcons } from "../icons";
import { trpc } from "../../../lib/trpc";
import { LazyAsfIcon } from "../../../components/common/LazyAsfIcon";

export function NpcListPanel({ basePath }: { basePath: string }) {
  const { currentGame } = useDashboard();
  const navigate = useNavigate();
  const gameId = currentGame?.id;
  const [showImportModal, setShowImportModal] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createType, setCreateType] = useState<"npc" | "resource">("npc");
  const [filterKind, setFilterKind] = useState<"all" | "npc" | "resource">("all");
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});

  const { data: npcList, isLoading: npcLoading, refetch: refetchNpcs } = trpc.npc.list.useQuery(
    { gameId: gameId! },
    { enabled: !!gameId }
  );

  const { data: resourceList, isLoading: resourceLoading, refetch: refetchResources } = trpc.npcResource.list.useQuery(
    { gameId: gameId! },
    { enabled: !!gameId }
  );

  const refetch = () => {
    refetchNpcs();
    refetchResources();
  };

  const batchImportMutation = trpc.npc.batchImportFromIni.useMutation({
    onSuccess: (result) => {
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
    setCollapsedGroups(prev => ({ ...prev, [key]: !prev[key] }));
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
            onClick={() => { setCreateType("npc"); setShowCreateModal(true); }}
            className="flex items-center gap-2 px-2 py-1.5 text-xs text-[#cccccc] hover:bg-[#3c3c3c] rounded transition-colors"
          >
            {DashboardIcons.add}
            <span>新建 NPC</span>
          </button>
          <button
            type="button"
            onClick={() => { setCreateType("resource"); setShowCreateModal(true); }}
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
              filterKind === "all"
                ? "bg-[#094771] text-white"
                : "text-[#cccccc] hover:bg-[#3c3c3c]"
            }`}
          >
            全部
          </button>
          <button
            type="button"
            onClick={() => setFilterKind("npc")}
            className={`flex-1 px-2 py-1 text-xs rounded transition-colors ${
              filterKind === "npc"
                ? "bg-[#094771] text-white"
                : "text-[#cccccc] hover:bg-[#3c3c3c]"
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
                  {(!npcList || npcList.length === 0) ? (
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
                            <span className={`transition-transform ${collapsedGroups[relation] ? '' : 'rotate-90'}`}>▶</span>
                            <span>{relationIcons[relation]}</span>
                            <span>{relationLabels[relation]}</span>
                            <span className="text-[#666]">({npcs.length})</span>
                          </button>
                          {!collapsedGroups[relation] && npcs.map((npc) => (
                            <NavLink
                              key={npc.id}
                              to={`${basePath}/${npc.id}`}
                              className={({ isActive }) =>
                                `flex items-center gap-3 px-3 py-2 pl-6 text-sm transition-colors ${
                                  isActive ? "bg-[#094771] text-white" : "hover:bg-[#2a2d2e]"
                                }`
                              }
                            >
                              <LazyAsfIcon iconPath={npc.icon} gameSlug={currentGame?.slug} size={32} prefix="asf/character/" fallback="🧙" />
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className="truncate font-medium">{npc.name}</span>
                                  <span className={`text-xs ${
                                    npc.kind === "Fighter" ? "text-red-400" : "text-green-400"
                                  }`}>
                                    Lv.{npc.level ?? 1}
                                  </span>
                                </div>
                                <span className="text-xs text-[#858585] truncate block">{npc.key}</span>
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
                  {(!resourceList || resourceList.length === 0) ? (
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
                        <LazyAsfIcon iconPath={resource.icon} gameSlug={currentGame?.slug} size={32} prefix="asf/character/" fallback="🎨" />
                        <div className="flex-1 min-w-0">
                          <span className="truncate font-medium block">{resource.name}</span>
                          <span className="text-xs text-[#858585] truncate block">{resource.key}</span>
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
        <ImportNpcModal
          gameId={gameId!}
          onClose={() => setShowImportModal(false)}
          onBatchImport={(items) => {
            batchImportMutation.mutate({ gameId: gameId!, items });
          }}
          isLoading={batchImportMutation.isPending}
          batchResult={batchImportMutation.data}
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

// NPC INI 导入模态框（支持 npc 和 npcres 目录合并）
function ImportNpcModal({
  gameId,
  onClose,
  onBatchImport,
  isLoading,
  batchResult,
}: {
  gameId: string;
  onClose: () => void;
  onBatchImport: (items: Array<{ fileName: string; type: "npc" | "resource"; iniContent?: string; npcResContent?: string }>) => void;
  isLoading: boolean;
  batchResult?: { success: Array<{ fileName: string; id: string; name: string; type: "npc" | "resource"; hasResources: boolean }>; failed: Array<{ fileName: string; error: string }> } | null;
}) {
  const [batchItems, setBatchItems] = useState<Array<{ fileName: string; type: "npc" | "resource"; iniContent?: string; npcResContent?: string }>>([]);
  const [isDragging, setIsDragging] = useState(false);

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    // 收集所有 INI 文件，按目录分类
    const npcFiles: Map<string, { file: File; content: string }> = new Map();
    const npcResFiles: Map<string, { file: File; content: string }> = new Map();
    const files = e.dataTransfer.items;

    /**
     * 判断文件属于哪个目录
     * 检查路径中是否有 /npc/ 或 /npcres/ 目录
     * 注意：npcres 要先检查，因为它也包含 "npc" 字符串
     */
    const getFileCategory = (fullPath: string): "npc" | "npcres" | null => {
      const pathLower = fullPath.toLowerCase();
      // 检查是否在 npcres 目录下（精确匹配目录名）
      if (pathLower.match(/[/\\]npcres[/\\]/i) || pathLower.startsWith("npcres/") || pathLower.startsWith("npcres\\")) {
        return "npcres";
      }
      // 检查是否在 npc 目录下（精确匹配目录名，排除 npcres）
      if (pathLower.match(/[/\\]npc[/\\]/i) || pathLower.startsWith("npc/") || pathLower.startsWith("npc\\")) {
        return "npc";
      }
      return null;
    };

    const processEntry = async (entry: FileSystemEntry, basePath = "") => {
      if (entry.isFile) {
        const fileEntry = entry as FileSystemFileEntry;
        const file = await new Promise<File>((resolve, reject) => {
          fileEntry.file(resolve, reject);
        });

        if (file.name.toLowerCase().endsWith(".ini")) {
          const content = await file.text();
          const fullPath = basePath ? `${basePath}/${file.name}` : file.name;
          const fileNameLower = file.name.toLowerCase();

          // 根据路径中的目录名判断是 npc 还是 npcres
          const category = getFileCategory(fullPath);
          if (category === "npcres") {
            npcResFiles.set(fileNameLower, { file, content });
          } else if (category === "npc") {
            npcFiles.set(fileNameLower, { file, content });
          }
          // 如果不在 npc 或 npcres 目录下，忽略该文件
        }
      } else if (entry.isDirectory) {
        const dirEntry = entry as FileSystemDirectoryEntry;
        const reader = dirEntry.createReader();
        const readAllEntries = async (): Promise<FileSystemEntry[]> => {
          const allEntries: FileSystemEntry[] = [];
          const readBatch = async (): Promise<void> => {
            const batch = await new Promise<FileSystemEntry[]>((resolve, reject) => {
              reader.readEntries(resolve, reject);
            });
            if (batch.length > 0) {
              allEntries.push(...batch);
              await readBatch();
            }
          };
          await readBatch();
          return allEntries;
        };
        const allEntries = await readAllEntries();
        for (const subEntry of allEntries) {
          await processEntry(subEntry, basePath ? `${basePath}/${entry.name}` : entry.name);
        }
      }
    };

    for (let i = 0; i < files.length; i++) {
      const item = files[i];
      const entry = item.webkitGetAsEntry();
      if (entry) {
        await processEntry(entry);
      }
    }

    // 从 npc ini 内容中解析 NpcIni 字段值
    const parseNpcIniField = (content: string): string | null => {
      const match = content.match(/^\s*NpcIni\s*=\s*(.+?)\s*$/mi);
      return match ? match[1].toLowerCase() : null;
    };

    // 合并 npc 和 npcres 文件
    const items: Array<{ fileName: string; type: "npc" | "resource"; iniContent?: string; npcResContent?: string }> = [];

    // 处理 NPC 文件
    for (const [_fileName, npcInfo] of npcFiles) {
      // 从 npc ini 内容中解析 NpcIni 字段，用这个值去匹配 npcres 文件
      const npcIniField = parseNpcIniField(npcInfo.content);
      const npcResInfo = npcIniField ? npcResFiles.get(npcIniField) : null;

      items.push({
        fileName: npcInfo.file.name,
        type: "npc",
        iniContent: npcInfo.content,
        npcResContent: npcResInfo?.content,
      });
    }

    // 所有 npcres 文件都作为独立外观导入（无论是否被 NPC 引用）
    for (const [_fileNameLower, npcResInfo] of npcResFiles) {
      items.push({
        fileName: npcResInfo.file.name,
        type: "resource",
        npcResContent: npcResInfo.content,
      });
    }

    if (items.length > 0) {
      setBatchItems(items);
    }
  };

  const removeBatchItem = (index: number) => {
    setBatchItems((prev) => prev.filter((_, i) => i !== index));
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-[#252526] rounded-lg border border-widget-border w-[500px] max-h-[85vh] overflow-auto">
        <div className="flex items-center justify-between px-4 py-3 border-b border-widget-border">
          <h3 className="font-medium text-white">从 INI 导入 NPC</h3>
          <button type="button" onClick={onClose} className="text-[#858585] hover:text-white">
            ✕
          </button>
        </div>
        <div className="p-4 space-y-4">
          {/* 说明 */}
          <div className="text-xs text-[#858585] bg-[#1e1e1e] p-3 rounded">
            <p className="mb-1">支持拖入以下结构：</p>
            <ul className="list-disc list-inside space-y-0.5">
              <li><code className="text-[#ce9178]">npc/</code> - NPC 配置目录</li>
              <li><code className="text-[#ce9178]">npcres/</code> - NPC 外观配置目录</li>
            </ul>
            <p className="mt-2">NPC 会自动关联同名外观，独立外观也会被导入</p>
          </div>

          {/* 拖放区域 */}
          <div
            className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
              isDragging
                ? "border-[#0098ff] bg-[#0098ff]/10"
                : "border-widget-border hover:border-[#666]"
            }`}
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
          >
            <div className="text-4xl mb-3">🧙</div>
            <p className="text-[#cccccc] text-sm">拖放 npc 和 npcres 文件夹到此处</p>
            <p className="text-[#858585] text-xs mt-1">支持批量导入，自动合并资源</p>
          </div>

          {/* 待导入文件列表 */}
          {batchItems.length > 0 && (
            <div className="max-h-48 overflow-y-auto border border-widget-border rounded">
              {batchItems.map((item, index) => (
                <div
                  key={`${item.type}-${item.fileName}`}
                  className="flex items-center justify-between px-3 py-2 border-b border-widget-border last:border-b-0 hover:bg-[#2a2d2e]"
                >
                  <div className="flex-1 flex items-center gap-2">
                    {item.type === "resource" ? (
                      <span className="text-xs px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-400">外观</span>
                    ) : (
                      <span className="text-xs px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-400">NPC</span>
                    )}
                    <span className="text-sm text-white">{item.fileName}</span>
                    {item.type === "npc" && item.npcResContent && (
                      <span className="text-xs text-green-400">+ 资源</span>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => removeBatchItem(index)}
                    className="text-[#858585] hover:text-red-400 text-sm"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* 导入结果 */}
          {batchResult && (
            <div className="space-y-2">
              {batchResult.success.length > 0 && (
                <div className="p-3 bg-green-500/10 border border-green-500/30 rounded">
                  <p className="text-green-400 text-sm font-medium mb-1">
                    ✓ 成功导入 {batchResult.success.length} 个 (
                    {batchResult.success.filter((s) => s.type === "npc").length} NPC,{" "}
                    {batchResult.success.filter((s) => s.type === "resource").length} 资源)
                  </p>
                  <div className="text-xs text-green-400/80 max-h-24 overflow-y-auto">
                    {batchResult.success.map((s) => (
                      <div key={s.id} className="flex items-center gap-1">
                        <span
                          className={`px-1 rounded text-[10px] ${
                            s.type === "npc"
                              ? "bg-blue-500/30 text-blue-300"
                              : "bg-purple-500/30 text-purple-300"
                          }`}
                        >
                          {s.type === "npc" ? "NPC" : "外观"}
                        </span>
                        <span>{s.name}</span>
                        {s.hasResources && <span className="text-green-300">+ 资源</span>}
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {batchResult.failed.length > 0 && (
                <div className="p-3 bg-red-500/10 border border-red-500/30 rounded">
                  <p className="text-red-400 text-sm font-medium mb-1">
                    ✗ 失败 {batchResult.failed.length} 个
                  </p>
                  <div className="text-xs text-red-400/80 max-h-24 overflow-y-auto">
                    {batchResult.failed.map((f) => (
                      <div key={f.fileName}>
                        {f.fileName}: {f.error}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
        <div className="flex justify-end gap-2 px-4 py-3 border-t border-widget-border">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm text-[#cccccc] hover:bg-[#3c3c3c] rounded"
          >
            {batchResult ? "关闭" : "取消"}
          </button>
          <button
            type="button"
            onClick={() => onBatchImport(batchItems)}
            disabled={batchItems.length === 0 || isLoading}
            className="px-4 py-2 text-sm bg-[#0e639c] hover:bg-[#1177bb] disabled:opacity-50 disabled:cursor-not-allowed rounded text-white"
          >
            {isLoading ? "导入中..." : `导入 (${batchItems.length})`}
          </button>
        </div>
      </div>
    </div>
  );
}

// 新建 NPC 弹窗
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
  const [relation, setRelation] = useState<"Friendly" | "Hostile" | "Neutral">("Friendly");
  const [name, setName] = useState("");
  const [key, setKey] = useState("");

  const createMutation = trpc.npc.create.useMutation({
    onSuccess: (data) => {
      onSuccess();
      onClose();
      navigate(`${basePath}/${data.id}`);
    },
  });

  const handleCreate = () => {
    createMutation.mutate({
      gameId,
      key: key || `npc_${Date.now()}`,
      name,
      kind,
      relation,
    });
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-[#252526] rounded-lg border border-widget-border w-96">
        <div className="flex items-center justify-between px-4 py-3 border-b border-widget-border">
          <h3 className="font-medium text-white">新建 NPC</h3>
          <button type="button" onClick={onClose} className="text-[#858585] hover:text-white">
            ✕
          </button>
        </div>
        <div className="p-4 space-y-4">
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
                onClick={() => setRelation("Friendly")}
                className={`flex-1 px-3 py-2 text-sm rounded transition-colors ${
                  relation === "Friendly"
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
                onClick={() => setRelation("Hostile")}
                className={`flex-1 px-3 py-2 text-sm rounded transition-colors ${
                  relation === "Hostile"
                    ? "bg-red-600 text-white"
                    : "bg-[#3c3c3c] text-[#cccccc] hover:bg-[#4c4c4c]"
                }`}
              >
                🔴 敌对
              </button>
            </div>
          </div>
          {createMutation.error && (
            <div className="text-red-400 text-sm">{createMutation.error.message}</div>
          )}
        </div>
        <div className="flex justify-end gap-2 px-4 py-3 border-t border-widget-border">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm text-[#cccccc] hover:bg-[#3c3c3c] rounded"
          >
            取消
          </button>
          <button
            type="button"
            onClick={handleCreate}
            disabled={!name.trim() || createMutation.isPending}
            className="px-4 py-2 text-sm bg-[#0e639c] hover:bg-[#1177bb] text-white rounded disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {createMutation.isPending ? "创建中..." : "创建"}
          </button>
        </div>
      </div>
    </div>
  );
}

// 新建 NPC 资源弹窗
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

  const createMutation = trpc.npcResource.create.useMutation({
    onSuccess: (data) => {
      onSuccess();
      onClose();
      navigate(`${basePath}/resource/${data.id}`);
    },
  });

  const handleCreate = () => {
    createMutation.mutate({
      gameId,
      key: key || `npcres_${Date.now()}`,
      name,
    });
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-[#252526] rounded-lg border border-widget-border w-96">
        <div className="flex items-center justify-between px-4 py-3 border-b border-widget-border">
          <h3 className="font-medium text-white">新建 NPC 资源</h3>
          <button type="button" onClick={onClose} className="text-[#858585] hover:text-white">
            ✕
          </button>
        </div>
        <div className="p-4 space-y-4">
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
          {createMutation.error && (
            <div className="text-red-400 text-sm">{createMutation.error.message}</div>
          )}
        </div>
        <div className="flex justify-end gap-2 px-4 py-3 border-t border-widget-border">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm text-[#cccccc] hover:bg-[#3c3c3c] rounded"
          >
            取消
          </button>
          <button
            type="button"
            onClick={handleCreate}
            disabled={!name.trim() || createMutation.isPending}
            className="px-4 py-2 text-sm bg-purple-600 hover:bg-purple-700 text-white rounded disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {createMutation.isPending ? "创建中..." : "创建"}
          </button>
        </div>
      </div>
    </div>
  );
}
