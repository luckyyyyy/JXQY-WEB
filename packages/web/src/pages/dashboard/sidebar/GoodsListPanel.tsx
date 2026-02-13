/**
 * 物品列表侧边栏面板
 * GoodsListPanel + ImportGoodsModal + CreateGoodsModal
 */
import { useState, useMemo } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { useDashboard } from "../DashboardContext";
import { DashboardIcons } from "../icons";
import { trpc } from "../../../lib/trpc";
import { LazyAsfIcon } from "../../../components/common/LazyAsfIcon";

export function GoodsListPanel({ basePath }: { basePath: string }) {
  const { currentGame } = useDashboard();
  const navigate = useNavigate();
  const gameId = currentGame?.id;
  const [showImportModal, setShowImportModal] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  // 分组折叠状态 (支持二级分组，如 "Equipment" 或 "Equipment:Hand")
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});

  const { data: goodsList, isLoading, refetch } = trpc.goods.list.useQuery(
    { gameId: gameId! },
    { enabled: !!gameId }
  );

  // 装备部位标签
  const partLabels: Record<string, string> = {
    Hand: "武器",
    Head: "头部",
    Body: "身体",
    Foot: "鞋子",
    Neck: "项链",
    Back: "披风",
    Wrist: "手镯",
  };

  const partIcons: Record<string, string> = {
    Hand: "🗡️",
    Head: "👒",
    Body: "👘",
    Foot: "👟",
    Neck: "📿",
    Back: "🧥",
    Wrist: "⌚",
  };

  // 按种类分组，装备类继续按 Part 分组
  const groupedGoods = useMemo(() => {
    if (!goodsList) return { Consumable: [], Equipment: {}, Quest: [] };

    const consumables: typeof goodsList = [];
    const quests: typeof goodsList = [];
    const equipmentByPart: Record<string, typeof goodsList> = {};

    for (const g of goodsList) {
      if (g.kind === "Consumable") {
        consumables.push(g);
      } else if (g.kind === "Quest") {
        quests.push(g);
      } else if (g.kind === "Equipment") {
        const part = g.part || "Other";
        if (!equipmentByPart[part]) {
          equipmentByPart[part] = [];
        }
        equipmentByPart[part].push(g);
      }
    }

    return {
      Consumable: consumables,
      Equipment: equipmentByPart,
      Quest: quests,
    };
  }, [goodsList]);

  const toggleGroup = (key: string) => {
    setCollapsedGroups(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const batchImportMutation = trpc.goods.batchImportFromIni.useMutation({
    onSuccess: (result) => {
      refetch();
      setShowImportModal(false);
      if (result.success.length > 0) {
        navigate(`${basePath}/${result.success[0].id}`);
      }
    },
  });

  const kindLabels = {
    Consumable: "消耗品",
    Equipment: "装备",
    Quest: "任务道具",
  };

  const kindIcons = {
    Consumable: "🍵",
    Equipment: "⚔️",
    Quest: "📜",
  };

  return (
    <>
      <div className="flex h-full w-60 flex-col bg-[#252526] border-r border-panel-border">
        {/* 标题栏 */}
        <div className="flex h-9 items-center justify-between px-4 border-b border-panel-border">
          <span className="text-xs font-medium uppercase tracking-wide text-[#bbbbbb]">
            物品列表
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
            <span>新建物品</span>
          </button>
        </div>

        {/* 物品列表 - 按种类分组树形展示 */}
        <div className="flex-1 overflow-y-auto py-1">
          {isLoading ? (
            <div className="px-4 py-2 text-sm text-[#858585]">加载中...</div>
          ) : !goodsList || goodsList.length === 0 ? (
            <div className="px-4 py-2 text-sm text-[#858585]">暂无物品</div>
          ) : (
            <>
              {/* 消耗品分组 */}
              <div>
                <button
                  type="button"
                  onClick={() => toggleGroup("Consumable")}
                  className="w-full px-3 py-1.5 text-xs font-medium text-[#858585] flex items-center gap-2 hover:bg-[#2a2d2e] transition-colors"
                >
                  <span className={`transition-transform ${collapsedGroups.Consumable ? '' : 'rotate-90'}`}>▶</span>
                  <span>{kindIcons.Consumable}</span>
                  <span>{kindLabels.Consumable}</span>
                  <span className="text-[#666]">({groupedGoods.Consumable.length})</span>
                </button>
                {!collapsedGroups.Consumable && groupedGoods.Consumable.map((goods) => (
                  <NavLink
                    key={goods.id}
                    to={`${basePath}/${goods.id}`}
                    className={({ isActive }) =>
                      `flex items-center gap-3 px-3 py-2 pl-6 text-sm transition-colors ${
                        isActive ? "bg-[#094771] text-white" : "hover:bg-[#2a2d2e]"
                      }`
                    }
                  >
                    <LazyAsfIcon iconPath={goods.icon} gameSlug={currentGame?.slug} size={32} prefix="asf/goods/" fallback="📦" />
                    <div className="flex-1 min-w-0">
                      <span className="truncate block">{goods.name}</span>
                      <span className="text-xs text-[#858585] truncate block">{goods.key}</span>
                    </div>
                  </NavLink>
                ))}
              </div>

              {/* 装备分组 - 带二级子分组 */}
              <div>
                <button
                  type="button"
                  onClick={() => toggleGroup("Equipment")}
                  className="w-full px-3 py-1.5 text-xs font-medium text-[#858585] flex items-center gap-2 hover:bg-[#2a2d2e] transition-colors"
                >
                  <span className={`transition-transform ${collapsedGroups.Equipment ? '' : 'rotate-90'}`}>▶</span>
                  <span>{kindIcons.Equipment}</span>
                  <span>{kindLabels.Equipment}</span>
                  <span className="text-[#666]">({Object.values(groupedGoods.Equipment).flat().length})</span>
                </button>
                {!collapsedGroups.Equipment && Object.entries(groupedGoods.Equipment).map(([part, items]) => (
                  <div key={part}>
                    {/* 二级分组标题 - Part */}
                    <button
                      type="button"
                      onClick={() => toggleGroup(`Equipment:${part}`)}
                      className="w-full px-3 py-1 pl-6 text-xs text-[#858585] flex items-center gap-2 hover:bg-[#2a2d2e] transition-colors"
                    >
                      <span className={`transition-transform text-[10px] ${collapsedGroups[`Equipment:${part}`] ? '' : 'rotate-90'}`}>▶</span>
                      <span>{partIcons[part] || "📦"}</span>
                      <span>{partLabels[part] || part}</span>
                      <span className="text-[#555]">({items.length})</span>
                    </button>
                    {/* 二级分组内容 */}
                    {!collapsedGroups[`Equipment:${part}`] && items.map((goods) => (
                      <NavLink
                        key={goods.id}
                        to={`${basePath}/${goods.id}`}
                        className={({ isActive }) =>
                          `flex items-center gap-3 px-3 py-2 pl-10 text-sm transition-colors ${
                            isActive ? "bg-[#094771] text-white" : "hover:bg-[#2a2d2e]"
                          }`
                        }
                      >
                        <LazyAsfIcon iconPath={goods.icon} gameSlug={currentGame?.slug} size={32} prefix="asf/goods/" fallback="📦" />
                        <div className="flex-1 min-w-0">
                          <span className="truncate block">{goods.name}</span>
                          <span className="text-xs text-[#858585] truncate block">{goods.key}</span>
                        </div>
                      </NavLink>
                    ))}
                  </div>
                ))}
              </div>

              {/* 任务道具分组 */}
              <div>
                <button
                  type="button"
                  onClick={() => toggleGroup("Quest")}
                  className="w-full px-3 py-1.5 text-xs font-medium text-[#858585] flex items-center gap-2 hover:bg-[#2a2d2e] transition-colors"
                >
                  <span className={`transition-transform ${collapsedGroups.Quest ? '' : 'rotate-90'}`}>▶</span>
                  <span>{kindIcons.Quest}</span>
                  <span>{kindLabels.Quest}</span>
                  <span className="text-[#666]">({groupedGoods.Quest.length})</span>
                </button>
                {!collapsedGroups.Quest && groupedGoods.Quest.map((goods) => (
                  <NavLink
                    key={goods.id}
                    to={`${basePath}/${goods.id}`}
                    className={({ isActive }) =>
                      `flex items-center gap-3 px-3 py-2 pl-6 text-sm transition-colors ${
                        isActive ? "bg-[#094771] text-white" : "hover:bg-[#2a2d2e]"
                      }`
                    }
                  >
                    <LazyAsfIcon iconPath={goods.icon} gameSlug={currentGame?.slug} size={32} prefix="asf/goods/" fallback="📦" />
                    <div className="flex-1 min-w-0">
                      <span className="truncate block">{goods.name}</span>
                      <span className="text-xs text-[#858585] truncate block">{goods.key}</span>
                    </div>
                  </NavLink>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* INI 导入模态框 */}
      {showImportModal && (
        <ImportGoodsModal
          gameId={gameId!}
          onClose={() => setShowImportModal(false)}
          onBatchImport={(items) => {
            batchImportMutation.mutate({ gameId: gameId!, items });
          }}
          isLoading={batchImportMutation.isPending}
          batchResult={batchImportMutation.data}
        />
      )}

      {/* 新建物品模态框 */}
      {showCreateModal && (
        <CreateGoodsModal
          onClose={() => setShowCreateModal(false)}
          basePath={basePath}
          gameId={gameId!}
          onSuccess={() => refetch()}
        />
      )}
    </>
  );
}

// 物品 INI 导入模态框
function ImportGoodsModal({
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
  batchResult?: { success: Array<{ fileName: string; id: string; name: string; kind: string }>; failed: Array<{ fileName: string; error: string }> } | null;
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

        if (file.name.toLowerCase().endsWith(".ini")) {
          const content = await file.text();
          items.push({ fileName: file.name, iniContent: content });
        }
      } else if (entry.isDirectory) {
        const dirEntry = entry as FileSystemDirectoryEntry;
        const reader = dirEntry.createReader();
        // readEntries 一次最多返回 100 个条目，需要多次调用直到返回空数组
        const readAllEntries = async (): Promise<FileSystemEntry[]> => {
          const allEntries: FileSystemEntry[] = [];
          const readBatch = async (): Promise<void> => {
            const batch = await new Promise<FileSystemEntry[]>((resolve, reject) => {
              reader.readEntries(resolve, reject);
            });
            if (batch.length > 0) {
              allEntries.push(...batch);
              await readBatch(); // 继续读取直到返回空数组
            }
          };
          await readBatch();
          return allEntries;
        };
        const allEntries = await readAllEntries();
        for (const subEntry of allEntries) {
          await processEntry(subEntry);
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
          <h3 className="font-medium text-white">从 INI 导入物品</h3>
          <button type="button" onClick={onClose} className="text-[#858585] hover:text-white">
            ✕
          </button>
        </div>
        <div className="p-4 space-y-4">
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
            <div className="text-4xl mb-3">📦</div>
            <p className="text-[#cccccc] text-sm">拖放 INI 文件或文件夹到此处</p>
            <p className="text-[#858585] text-xs mt-1">支持批量导入</p>
          </div>

          {/* 待导入文件列表 */}
          {batchItems.length > 0 && (
            <div className="max-h-48 overflow-y-auto border border-widget-border rounded">
              {batchItems.map((item, index) => (
                <div
                  key={item.fileName}
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
                    ✓ 成功导入 {batchResult.success.length} 个物品
                  </p>
                  <div className="text-xs text-green-400/80 max-h-24 overflow-y-auto">
                    {batchResult.success.map((s) => (
                      <div key={s.id}>{s.name}</div>
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

// ========== 新建物品弹窗 ==========
function CreateGoodsModal({
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
  const [kind, setKind] = useState<"Consumable" | "Equipment" | "Quest">("Consumable");
  const [name, setName] = useState("");
  const [key, setKey] = useState("");
  const [intro, setIntro] = useState("");

  const createMutation = trpc.goods.create.useMutation({
    onSuccess: (data) => {
      onSuccess();
      onClose();
      navigate(`${basePath}/${data.id}`);
    },
  });

  const handleCreate = () => {
    createMutation.mutate({
      gameId,
      kind,
      key: key || `goods_${Date.now()}`,
      name: name || "新物品",
      intro: intro || undefined,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-[#252526] border border-widget-border rounded-lg shadow-xl w-[480px]">
        {/* 标题 */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-widget-border">
          <h2 className="text-base font-medium text-white">新建物品</h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1 text-[#858585] hover:text-white hover:bg-[#3c3c3c] rounded"
          >
            ✕
          </button>
        </div>

        <div className="p-4 space-y-4">
          {/* 类型选择 */}
          <div>
            <label className="block text-sm text-[#cccccc] mb-2">物品类型</label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setKind("Consumable")}
                className={`flex-1 flex flex-col items-center justify-center gap-1 px-3 py-2.5 rounded-lg border transition-colors ${
                  kind === "Consumable"
                    ? "bg-green-600/20 border-green-500 text-green-400"
                    : "bg-[#3c3c3c] border-[#555] text-[#cccccc] hover:border-[#666]"
                }`}
              >
                <span className="text-lg">🍵</span>
                <span className="text-xs">消耗品</span>
              </button>
              <button
                type="button"
                onClick={() => setKind("Equipment")}
                className={`flex-1 flex flex-col items-center justify-center gap-1 px-3 py-2.5 rounded-lg border transition-colors ${
                  kind === "Equipment"
                    ? "bg-blue-600/20 border-blue-500 text-blue-400"
                    : "bg-[#3c3c3c] border-[#555] text-[#cccccc] hover:border-[#666]"
                }`}
              >
                <span className="text-lg">⚔️</span>
                <span className="text-xs">装备</span>
              </button>
              <button
                type="button"
                onClick={() => setKind("Quest")}
                className={`flex-1 flex flex-col items-center justify-center gap-1 px-3 py-2.5 rounded-lg border transition-colors ${
                  kind === "Quest"
                    ? "bg-yellow-600/20 border-yellow-500 text-yellow-400"
                    : "bg-[#3c3c3c] border-[#555] text-[#cccccc] hover:border-[#666]"
                }`}
              >
                <span className="text-lg">📜</span>
                <span className="text-xs">任务道具</span>
              </button>
            </div>
          </div>

          {/* 物品名称 */}
          <div>
            <label className="block text-sm text-[#cccccc] mb-1">物品名称 <span className="text-red-400">*</span></label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="例如：金创药"
              className="w-full px-3 py-2 bg-[#1e1e1e] border border-widget-border rounded-lg text-white focus:outline-none focus:border-focus-border"
            />
          </div>

          {/* 标识符 */}
          <div>
            <label className="block text-sm text-[#cccccc] mb-1">标识符 (Key)</label>
            <input
              type="text"
              value={key}
              onChange={(e) => setKey(e.target.value)}
              placeholder="例如：goods-m00-金创药.ini（留空自动生成）"
              className="w-full px-3 py-2 bg-[#1e1e1e] border border-widget-border rounded-lg text-white focus:outline-none focus:border-focus-border"
            />
          </div>

          {/* 物品介绍 */}
          <div>
            <label className="block text-sm text-[#cccccc] mb-1">物品介绍</label>
            <textarea
              rows={2}
              value={intro}
              onChange={(e) => setIntro(e.target.value)}
              placeholder="简单描述物品的用途..."
              className="w-full px-3 py-2 bg-[#1e1e1e] border border-widget-border rounded-lg text-white focus:outline-none focus:border-focus-border resize-none"
            />
          </div>

          {/* 错误提示 */}
          {createMutation.isError && (
            <p className="text-xs text-red-400">
              创建失败: {createMutation.error.message}
            </p>
          )}
        </div>

        {/* 底部按钮 */}
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
