/**
 * 商店列表侧边栏面板
 * ShopListPanel + ImportShopModal
 */
import { useState, useRef } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { useDashboard } from "../DashboardContext";
import { DashboardIcons } from "../icons";
import { trpc } from "../../../lib/trpc";

export function ShopListPanel({ basePath }: { basePath: string }) {
  const { currentGame } = useDashboard();
  const navigate = useNavigate();
  const gameId = currentGame?.id;
  const [showImportModal, setShowImportModal] = useState(false);

  const { data: shopList, isLoading, refetch } = trpc.shop.list.useQuery(
    { gameId: gameId! },
    { enabled: !!gameId }
  );

  const createMutation = trpc.shop.create.useMutation({
    onSuccess: (data) => {
      refetch();
      navigate(`${basePath}/${data.id}`);
    },
  });

  const batchImportMutation = trpc.shop.batchImportFromIni.useMutation({
    onSuccess: (result) => {
      refetch();
      setShowImportModal(false);
      if (result.success.length > 0) {
        navigate(`${basePath}/${result.success[0].id}`);
      }
    },
  });

  const handleCreate = () => {
    if (!gameId) return;
    createMutation.mutate({
      gameId,
      key: `shop_${Date.now()}.ini`,
      name: "新商店",
    });
  };

  return (
    <>
      <div className="flex h-full w-60 flex-col bg-[#252526] border-r border-panel-border">
        {/* 标题栏 */}
        <div className="flex h-9 items-center justify-between px-4 border-b border-panel-border">
          <span className="text-xs font-medium uppercase tracking-wide text-[#bbbbbb]">
            商店列表
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
            onClick={handleCreate}
            disabled={createMutation.isPending}
            className="flex items-center gap-2 px-2 py-1.5 text-xs text-[#cccccc] hover:bg-[#3c3c3c] rounded transition-colors"
          >
            {DashboardIcons.add}
            <span>新建商店</span>
          </button>
        </div>

        {/* 商店列表 */}
        <div className="flex-1 overflow-y-auto py-1">
          {isLoading ? (
            <div className="px-4 py-2 text-sm text-[#858585]">加载中...</div>
          ) : !shopList || shopList.length === 0 ? (
            <div className="px-4 py-2 text-sm text-[#858585]">暂无商店</div>
          ) : (
            shopList.map((shop) => (
              <NavLink
                key={shop.id}
                to={`${basePath}/${shop.id}`}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2 text-sm transition-colors ${
                    isActive ? "bg-[#094771] text-white" : "hover:bg-[#2a2d2e]"
                  }`
                }
              >
                <span className="text-lg">🏪</span>
                <div className="flex-1 min-w-0">
                  <span className="truncate block">{shop.name}</span>
                  <span className="text-xs text-[#858585] truncate block">{shop.key}</span>
                </div>
                <span className="shrink-0 text-xs px-1.5 py-0.5 rounded-full bg-[#3c3c3c] text-[#0098ff] font-mono">
                  {shop.itemCount}
                </span>
              </NavLink>
            ))
          )}
        </div>
      </div>

      {/* INI 导入弹窗 */}
      {showImportModal && gameId && (
        <ImportShopModal
          gameId={gameId}
          onClose={() => setShowImportModal(false)}
          onBatchImport={(items) => {
            batchImportMutation.mutate({ gameId: gameId!, items });
          }}
          isLoading={batchImportMutation.isPending}
          batchResult={batchImportMutation.data}
        />
      )}
    </>
  );
}

// ========== 商店 INI 导入弹窗 ==========
function ImportShopModal({
  gameId,
  onClose,
  onBatchImport,
  isLoading,
  batchResult,
}: {
  gameId: string;
  onClose: () => void;
  onBatchImport: (items: Array<{ fileName: string; iniContent: string }>) => void;
  isLoading: boolean;
  batchResult?: { success: Array<{ fileName: string; id: string; name: string; itemCount: number }>; failed: Array<{ fileName: string; error: string }> } | null;
}) {
  const [batchItems, setBatchItems] = useState<Array<{ fileName: string; iniContent: string }>>([]);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFiles = async (files: FileList | File[]) => {
    const items: Array<{ fileName: string; iniContent: string }> = [];
    for (const file of Array.from(files)) {
      if (file.name.toLowerCase().endsWith(".ini")) {
        const content = await file.text();
        items.push({ fileName: file.name, iniContent: content });
      }
    }
    if (items.length > 0) {
      setBatchItems(prev => [...prev, ...items]);
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const items: Array<{ fileName: string; iniContent: string }> = [];
    const fileItems = e.dataTransfer.items;

    const processEntry = async (entry: FileSystemEntry) => {
      if (entry.isFile) {
        const fileEntry = entry as FileSystemFileEntry;
        const file = await new Promise<File>((resolve, reject) => {
          fileEntry.file(resolve, reject);
        });
        if (file.name.toLowerCase().endsWith(".ini")) {
          const content = await file.text();
          items.push({ fileName: file.name, iniContent: content });
        }
      } else if (entry.isDirectory) {
        const dirEntry = entry as FileSystemDirectoryEntry;
        const reader = dirEntry.createReader();
        const entries = await new Promise<FileSystemEntry[]>((resolve, reject) => {
          reader.readEntries(resolve, reject);
        });
        for (const subEntry of entries) {
          await processEntry(subEntry);
        }
      }
    };

    for (let i = 0; i < fileItems.length; i++) {
      const entry = fileItems[i].webkitGetAsEntry();
      if (entry) {
        await processEntry(entry);
      }
    }

    if (items.length > 0) {
      setBatchItems(prev => [...prev, ...items]);
    }
  };

  const removeBatchItem = (index: number) => {
    setBatchItems(prev => prev.filter((_, i) => i !== index));
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-[#252526] rounded-lg border border-widget-border w-[550px] max-h-[80vh] overflow-auto">
        <div className="flex items-center justify-between px-4 py-3 border-b border-widget-border">
          <h3 className="font-medium text-white">从 INI 导入商店</h3>
          <button type="button" onClick={onClose} className="text-[#858585] hover:text-white">
            ✕
          </button>
        </div>
        <div className="p-4 space-y-4">
          {/* 拖放区域 */}
          <div
            className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors cursor-pointer ${
              isDragging
                ? "border-[#0098ff] bg-[#0098ff]/10"
                : batchItems.length > 0
                ? "border-green-500/50 bg-green-500/5"
                : "border-widget-border hover:border-[#0098ff]"
            }`}
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".ini"
              multiple
              className="hidden"
              onChange={(e) => {
                if (e.target.files) handleFiles(e.target.files);
                e.target.value = "";
              }}
            />
            {batchItems.length === 0 ? (
              <div className="text-[#858585]">
                <p className="mb-2 text-lg">📁 拖放 INI 文件或 buy 目录到这里</p>
                <p className="text-xs">支持拖放整个 ini/buy 目录，批量导入所有商店配置</p>
              </div>
            ) : (
              <div className="text-green-400">
                ✓ 已选择 {batchItems.length} 个商店文件
              </div>
            )}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="mt-2 px-3 py-1 bg-[#3c3c3c] hover:bg-[#4a4a4a] rounded text-sm"
            >
              选择文件
            </button>
          </div>

          {/* 文件列表 */}
          {batchItems.length > 0 && (
            <div className="max-h-48 overflow-y-auto border border-widget-border rounded">
              {batchItems.map((item, index) => (
                <div
                  key={`${item.fileName}-${index}`}
                  className="flex items-center justify-between px-3 py-2 border-b border-widget-border last:border-b-0 hover:bg-[#2a2d2e]"
                >
                  <span className="text-sm text-white">{item.fileName}</span>
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
                    ✓ 成功导入 {batchResult.success.length} 个商店
                  </p>
                  <div className="text-xs text-green-400/80 max-h-24 overflow-y-auto">
                    {batchResult.success.map((s) => (
                      <div key={s.id}>{s.name} ({s.itemCount} 件商品)</div>
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
                      <div key={f.fileName}>{f.fileName}: {f.error}</div>
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
