/**
 * 玩家角色列表侧边栏面板
 * PlayerListPanel + ImportPlayerModal
 */
import { useState, useMemo } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { useDashboard } from "../DashboardContext";
import { DashboardIcons } from "../icons";
import { trpc } from "../../../lib/trpc";

export function PlayerListPanel({ basePath }: { basePath: string }) {
  const { currentGame } = useDashboard();
  const navigate = useNavigate();
  const gameId = currentGame?.id;
  const [showImportModal, setShowImportModal] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);

  const { data: playerList, isLoading, refetch } = trpc.player.list.useQuery(
    { gameId: gameId! },
    { enabled: !!gameId }
  );

  const batchImportMutation = trpc.player.batchImportFromIni.useMutation({
    onSuccess: (result) => {
      refetch();
      setShowImportModal(false);
      if (result.success.length > 0) {
        navigate(`${basePath}/${result.success[0].id}`);
      }
    },
  });

  // 按 index 排序
  const sortedPlayers = useMemo(() => {
    if (!playerList) return [];
    return [...playerList].sort((a, b) => a.index - b.index);
  }, [playerList]);

  return (
    <>
      <div className="flex h-full w-60 flex-col bg-[#252526] border-r border-panel-border">
        {/* 标题栏 */}
        <div className="flex h-9 items-center justify-between px-4 border-b border-panel-border">
          <span className="text-xs font-medium uppercase tracking-wide text-[#bbbbbb]">
            角色列表
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
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 px-2 py-1.5 text-xs text-[#cccccc] hover:bg-[#3c3c3c] rounded transition-colors"
          >
            {DashboardIcons.add}
            <span>新建角色</span>
          </button>
        </div>

        {/* 列表内容 */}
        <div className="flex-1 overflow-y-auto py-1">
          {isLoading ? (
            <div className="px-4 py-2 text-sm text-[#858585]">加载中...</div>
          ) : !sortedPlayers.length ? (
            <div className="px-4 py-2 text-sm text-[#858585]">暂无角色</div>
          ) : (
            sortedPlayers.map((player) => (
              <NavLink
                key={player.id}
                to={`${basePath}/${player.id}`}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2 text-sm transition-colors ${
                    isActive ? "bg-[#094771] text-white" : "hover:bg-[#2a2d2e]"
                  }`
                }
              >
                <span className="text-lg">🎮</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="truncate font-medium">
                      {player.name || `Player${player.index}`}
                    </span>
                    <span className="text-xs text-green-400">
                      Lv.{player.level ?? 1}
                    </span>
                  </div>
                  <span className="text-xs text-[#858585] truncate block">
                    Player{player.index} · {player.key}
                  </span>
                </div>
              </NavLink>
            ))
          )}
        </div>
      </div>

      {/* INI 导入模态框 */}
      {showImportModal && (
        <ImportPlayerModal
          onClose={() => setShowImportModal(false)}
          onBatchImport={(items) => {
            batchImportMutation.mutate({ gameId: gameId!, items });
          }}
          isLoading={batchImportMutation.isPending}
          batchResult={batchImportMutation.data ?? null}
        />
      )}

      {/* 新建角色模态框 */}
      {showCreateModal && gameId && (
        <CreatePlayerModal
          onClose={() => setShowCreateModal(false)}
          basePath={basePath}
          gameId={gameId}
          onSuccess={() => refetch()}
        />
      )}
    </>
  );
}

// ========== 新建角色模态框 ==========

function CreatePlayerModal({
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

  const createMutation = trpc.player.create.useMutation({
    onSuccess: (data) => {
      onSuccess();
      onClose();
      navigate(`${basePath}/${data.id}`);
    },
  });

  const handleCreate = () => {
    createMutation.mutate({
      gameId,
      key,
      name,
    });
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-[#252526] rounded-lg border border-widget-border w-96">
        <div className="flex items-center justify-between px-4 py-3 border-b border-widget-border">
          <h3 className="font-medium text-white">新建角色</h3>
          <button type="button" onClick={onClose} className="text-[#858585] hover:text-white">
            ✕
          </button>
        </div>
        <div className="p-4 space-y-4">
          <div>
            <label className="block text-xs text-[#858585] mb-1">角色 Key <span className="text-red-400">*</span></label>
            <input
              type="text"
              value={key}
              onChange={(e) => setKey(e.target.value)}
              className="w-full px-3 py-2 bg-[#3c3c3c] border border-widget-border rounded text-white text-sm focus:outline-none focus:border-focus-border"
              placeholder="如 Player0.ini"
            />
            <p className="text-xs text-[#666] mt-1">唯一标识符，对应 INI 文件名</p>
          </div>
          <div>
            <label className="block text-xs text-[#858585] mb-1">角色名称 <span className="text-red-400">*</span></label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 bg-[#3c3c3c] border border-widget-border rounded text-white text-sm focus:outline-none focus:border-focus-border"
              placeholder="输入角色名称"
            />
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
            disabled={!key.trim() || !name.trim() || createMutation.isPending}
            className="px-4 py-2 text-sm bg-[#0e639c] hover:bg-[#1177bb] text-white rounded disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {createMutation.isPending ? "创建中..." : "创建"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ========== 导入模态框 ==========

function ImportPlayerModal({
  onClose,
  onBatchImport,
  isLoading,
  batchResult,
}: {
  onClose: () => void;
  onBatchImport: (items: Array<{ fileName: string; iniContent: string }>) => void;
  isLoading: boolean;
  batchResult: {
    success: Array<{ fileName: string; id: string; name: string; index: number }>;
    failed: Array<{ fileName: string; error: string }>;
  } | null;
}) {
  const [batchItems, setBatchItems] = useState<Array<{ fileName: string; iniContent: string }>>([]);
  const [isDragging, setIsDragging] = useState(false);

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const items: Array<{ fileName: string; iniContent: string }> = [];
    const files = e.dataTransfer.items;

    const processEntry = async (entry: FileSystemEntry) => {
      if (entry.isFile) {
        const fileEntry = entry as FileSystemFileEntry;
        const file = await new Promise<File>((resolve, reject) => {
          fileEntry.file(resolve, reject);
        });

        if (/^player\d*\.ini$/i.test(file.name)) {
          const content = await file.text();
          items.push({ fileName: file.name, iniContent: content });
        }
      } else if (entry.isDirectory) {
        const dirEntry = entry as FileSystemDirectoryEntry;
        const reader = dirEntry.createReader();
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
        for (const subEntry of allEntries) {
          await processEntry(subEntry);
        }
      }
    };

    for (let i = 0; i < files.length; i++) {
      const entry = files[i].webkitGetAsEntry();
      if (entry) await processEntry(entry);
    }

    // 也处理直接拖入的文件（非条目形式）
    if (items.length === 0) {
      for (let i = 0; i < e.dataTransfer.files.length; i++) {
        const file = e.dataTransfer.files[i];
        if (/^player\d*\.ini$/i.test(file.name)) {
          const content = await file.text();
          items.push({ fileName: file.name, iniContent: content });
        }
      }
    }

    if (items.length > 0) {
      setBatchItems((prev) => {
        const existing = new Set(prev.map((p) => p.fileName.toLowerCase()));
        const newItems = items.filter((it) => !existing.has(it.fileName.toLowerCase()));
        return [...prev, ...newItems];
      });
    }
  };

  const removeBatchItem = (index: number) => {
    setBatchItems((prev) => prev.filter((_, i) => i !== index));
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-[#252526] rounded-lg border border-widget-border w-[500px] max-h-[85vh] overflow-auto">
        <div className="flex items-center justify-between px-4 py-3 border-b border-widget-border">
          <h3 className="font-medium text-white">从 INI 导入角色</h3>
          <button type="button" onClick={onClose} className="text-[#858585] hover:text-white">✕</button>
        </div>
        <div className="p-4 space-y-4">
          <div className="text-xs text-[#858585] bg-[#1e1e1e] p-3 rounded">
            <p className="mb-1">支持拖入以下文件：</p>
            <ul className="list-disc list-inside space-y-0.5">
              <li><code className="text-[#ce9178]">Player0.ini</code> - 主角</li>
              <li><code className="text-[#ce9178]">Player1.ini</code> - 伙伴角色</li>
            </ul>
            <p className="mt-2">可从 <code className="text-[#ce9178]">save/game/</code> 目录拖入整个文件夹</p>
          </div>

          <div
            className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
              isDragging ? "border-[#0098ff] bg-[#0098ff]/10" : "border-widget-border hover:border-[#666]"
            }`}
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
          >
            <div className="text-4xl mb-3">🎮</div>
            <p className="text-[#cccccc] text-sm">拖放 PlayerX.ini 文件或文件夹到此处</p>
            <p className="text-[#858585] text-xs mt-1">支持批量导入</p>
          </div>

          {batchItems.length > 0 && (
            <div className="max-h-48 overflow-y-auto border border-widget-border rounded">
              {batchItems.map((item, index) => (
                <div key={item.fileName} className="flex items-center justify-between px-3 py-2 border-b border-widget-border last:border-b-0 hover:bg-[#2a2d2e]">
                  <div className="flex items-center gap-2">
                    <span className="text-xs px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-400">角色</span>
                    <span className="text-sm text-white">{item.fileName}</span>
                  </div>
                  <button type="button" onClick={() => removeBatchItem(index)} className="text-[#858585] hover:text-red-400 text-sm">✕</button>
                </div>
              ))}
            </div>
          )}

          {batchResult && (
            <div className="space-y-2">
              {batchResult.success.length > 0 && (
                <div className="p-3 bg-green-500/10 border border-green-500/30 rounded">
                  <p className="text-green-400 text-sm font-medium mb-1">
                    ✓ 成功导入 {batchResult.success.length} 个角色
                  </p>
                  <div className="text-xs text-green-400/80 max-h-24 overflow-y-auto">
                    {batchResult.success.map((s) => (
                      <div key={s.id}>Player{s.index} - {s.name || s.fileName}</div>
                    ))}
                  </div>
                </div>
              )}
              {batchResult.failed.length > 0 && (
                <div className="p-3 bg-red-500/10 border border-red-500/30 rounded">
                  <p className="text-red-400 text-sm font-medium mb-1">✗ 失败 {batchResult.failed.length} 个</p>
                  <div className="text-xs text-red-400/80 max-h-24 overflow-y-auto">
                    {batchResult.failed.map((f) => (
                      <div key={f.fileName}>{f.fileName}: {f.error}</div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
        <div className="flex justify-end gap-2 px-4 py-3 border-t border-widget-border">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-[#cccccc] hover:bg-[#3c3c3c] rounded">
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
