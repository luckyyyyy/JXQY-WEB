/**
 * 武功列表侧边栏面板
 * MagicListPanel + ImportMagicModal + CreateMagicModal
 */

import { api } from "@miu2d/shared";
import { useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { CreateEntityModal } from "../components/common";
import { LazyAsfIcon } from "../components/common/LazyAsfIcon";
import { useDashboard } from "../DashboardContext";
import { DashboardIcons } from "../icons";

export function MagicListPanel({ basePath }: { basePath: string }) {
  const { currentGame } = useDashboard();
  const navigate = useNavigate();
  const gameId = currentGame?.id;
  const [showImportModal, setShowImportModal] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [filterType, setFilterType] = useState<"all" | "player" | "npc">("all");

  const {
    data: magics,
    isLoading,
    refetch,
  } = api.magic.list.useQuery({ gameId: gameId! }, { enabled: !!gameId });

  // 根据过滤条件筛选武功
  const filteredMagics = magics?.filter((m) =>
    filterType === "all" ? true : m.userType === filterType
  );

  const importMutation = api.magic.importFromIni.useMutation({
    onSuccess: (_data) => {
      const data = _data as { id: string };
      refetch();
      setShowImportModal(false);
      navigate(`${basePath}/${data.id}`);
    },
  });

  const batchImportMutation = api.magic.batchImportFromIni.useMutation({
    onSuccess: (_result) => {
      const result = _result as BatchImportResult;
      refetch();
      setShowImportModal(false);
      if (result.success.length > 0) {
        // 导航到第一个成功导入的武功
        navigate(`${basePath}/${result.success[0].id}`);
      }
    },
  });

  return (
    <>
      <div className="flex h-full w-60 flex-col bg-[#252526] border-r border-panel-border">
        {/* 标题栏 */}
        <div className="flex h-9 items-center justify-between px-4 border-b border-panel-border">
          <span className="text-xs font-medium uppercase tracking-wide text-[#bbbbbb]">
            武功列表
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
            <span>新建武功</span>
          </button>
        </div>

        {/* 类型过滤器 */}
        <div className="flex gap-1 px-2 py-1.5 border-b border-panel-border">
          <button
            type="button"
            onClick={() => setFilterType("all")}
            className={`flex-1 px-2 py-1 text-xs rounded transition-colors ${
              filterType === "all" ? "bg-[#094771] text-white" : "text-[#cccccc] hover:bg-[#3c3c3c]"
            }`}
          >
            全部
          </button>
          <button
            type="button"
            onClick={() => setFilterType("player")}
            className={`flex-1 px-2 py-1 text-xs rounded transition-colors ${
              filterType === "player"
                ? "bg-blue-600 text-white"
                : "text-blue-400 hover:bg-[#3c3c3c]"
            }`}
          >
            玩家
          </button>
          <button
            type="button"
            onClick={() => setFilterType("npc")}
            className={`flex-1 px-2 py-1 text-xs rounded transition-colors ${
              filterType === "npc"
                ? "bg-orange-600 text-white"
                : "text-orange-400 hover:bg-[#3c3c3c]"
            }`}
          >
            NPC
          </button>
        </div>

        {/* 武功列表 */}
        <div className="flex-1 overflow-y-auto py-1">
          {isLoading ? (
            <div className="px-4 py-2 text-sm text-[#858585]">加载中...</div>
          ) : !filteredMagics || filteredMagics.length === 0 ? (
            <div className="px-4 py-2 text-sm text-[#858585]">
              {magics && magics.length > 0 ? "没有匹配的武功" : "暂无武功"}
            </div>
          ) : (
            filteredMagics.map((magic) => (
              <NavLink
                key={magic.id}
                to={`${basePath}/${magic.id}`}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2 text-sm transition-colors ${
                    isActive ? "bg-[#094771] text-white" : "hover:bg-[#2a2d2e]"
                  }`
                }
              >
                <LazyAsfIcon
                  iconPath={magic.icon}
                  gameSlug={currentGame?.slug}
                  size={36}
                  prefix="asf/magic/"
                  fallback={
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      className="text-[#888]"
                      style={{ width: 31.5, height: 31.5 }}
                    >
                      <path d="M12 2L4 7v10l8 5 8-5V7l-8-5z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  }
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="truncate font-medium">{magic.name}</span>
                    <span
                      className={`text-xs ${magic.userType === "player" ? "text-blue-400" : "text-orange-400"}`}
                    >
                      {magic.userType === "player" ? "玩家" : "NPC"}
                    </span>
                  </div>
                  <div className="text-xs text-[#858585] truncate">{magic.key}</div>
                </div>
              </NavLink>
            ))
          )}
        </div>
      </div>

      {/* INI 导入模态框 */}
      {showImportModal && (
        <ImportMagicModal
          gameId={gameId!}
          onClose={() => setShowImportModal(false)}
          onImport={(fileName, iniContent, userType, attackFileContent) => {
            importMutation.mutate({
              gameId: gameId!,
              fileName,
              iniContent,
              userType,
              attackFileContent,
            });
          }}
          onBatchImport={(items) => {
            // 每个 item 已经有 userType 字段，不需要全局指定
            batchImportMutation.mutate({ gameId: gameId!, items });
          }}
          isLoading={importMutation.isPending || batchImportMutation.isPending}
          batchResult={batchImportMutation.data as BatchImportResult | undefined}
        />
      )}

      {/* 新建武功模态框 */}
      {showCreateModal && (
        <CreateMagicModal
          onClose={() => setShowCreateModal(false)}
          basePath={basePath}
          gameId={gameId!}
          onSuccess={() => refetch()}
        />
      )}
    </>
  );
}

// INI 导入模态框组件 - 支持单个文件和目录批量导入
interface BatchImportItem {
  fileName: string;
  iniContent: string;
  attackFileContent?: string;
  userType?: "player" | "npc"; // 可选，用于自动识别
}

/**
 * 根据文件名自动检测武功类型
 * 规则：路径中包含 "player" 识别为玩家武功，其他都是 NPC 武功
 */
function detectUserTypeFromFileName(fileName: string): "player" | "npc" {
  return fileName.toLowerCase().includes("player") ? "player" : "npc";
}

interface BatchImportResult {
  success: Array<{ fileName: string; id: string; name: string; isFlyingMagic: boolean }>;
  failed: Array<{ fileName: string; error: string }>;
}

function ImportMagicModal({
  gameId,
  onClose,
  onImport,
  onBatchImport,
  isLoading,
  batchResult,
}: {
  gameId: string;
  onClose: () => void;
  onImport: (
    fileName: string,
    iniContent: string,
    userType: "player" | "npc",
    attackFileContent?: string
  ) => void;
  onBatchImport: (items: BatchImportItem[]) => void; // userType 现在包含在每个 item 中
  isLoading: boolean;
  batchResult?: BatchImportResult | null;
}) {
  const [mode, setMode] = useState<"single" | "batch">("single");
  const [userType, setUserType] = useState<"player" | "npc">("player");
  // 单个导入
  const [iniContent, setIniContent] = useState("");
  const [iniFileName, setIniFileName] = useState("");
  const [attackFileContent, setAttackFileContent] = useState("");
  const [attackFileName, setAttackFileName] = useState("");
  const [isDraggingMain, setIsDraggingMain] = useState(false);
  const [isDraggingAttack, setIsDraggingAttack] = useState(false);
  // 批量导入
  const [batchItems, setBatchItems] = useState<BatchImportItem[]>([]);
  const [isDraggingBatch, setIsDraggingBatch] = useState(false);

  const handleFile = (file: File, type: "main" | "attack") => {
    if (file?.name.endsWith(".ini")) {
      const reader = new FileReader();
      reader.onload = (ev) => {
        const content = ev.target?.result as string;
        if (type === "main") {
          setIniContent(content);
          setIniFileName(file.name);
        } else {
          setAttackFileContent(content);
          setAttackFileName(file.name);
        }
      };
      reader.readAsText(file);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, type: "main" | "attack") => {
    const file = e.target.files?.[0];
    if (file) handleFile(file, type);
  };

  const handleDrop = (e: React.DragEvent, type: "main" | "attack") => {
    e.preventDefault();
    if (type === "main") setIsDraggingMain(false);
    else setIsDraggingAttack(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file, type);
  };

  const handleDragOver = (e: React.DragEvent, type: "main" | "attack") => {
    e.preventDefault();
    if (type === "main") setIsDraggingMain(true);
    else setIsDraggingAttack(true);
  };

  const handleDragLeave = (type: "main" | "attack") => {
    if (type === "main") setIsDraggingMain(false);
    else setIsDraggingAttack(false);
  };

  // 批量导入：处理目录拖拽
  const handleBatchDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingBatch(false);

    const items: BatchImportItem[] = [];
    const files = e.dataTransfer.items;

    // 第一步：收集所有 INI 文件（文件名 -> {file, fullPath}）
    const allIniFiles: Map<string, { file: File; fullPath: string }> = new Map();

    const processEntry = async (entry: FileSystemEntry, basePath = "") => {
      if (entry.isFile) {
        const fileEntry = entry as FileSystemFileEntry;
        const file = await new Promise<File>((resolve, reject) => {
          fileEntry.file(resolve, reject);
        });

        if (file.name.toLowerCase().endsWith(".ini")) {
          // 存储文件名（小写）-> {file, fullPath} 的映射
          const fullPath = basePath ? `${basePath}/${file.name}` : file.name;
          allIniFiles.set(file.name.toLowerCase(), { file, fullPath });
        }
      } else if (entry.isDirectory) {
        const dirEntry = entry as FileSystemDirectoryEntry;
        const reader = dirEntry.createReader();
        const entries = await new Promise<FileSystemEntry[]>((resolve, reject) => {
          reader.readEntries(resolve, reject);
        });
        for (const subEntry of entries) {
          await processEntry(subEntry, basePath ? `${basePath}/${entry.name}` : entry.name);
        }
      }
    };

    // 处理拖入的所有项目
    for (let i = 0; i < files.length; i++) {
      const item = files[i];
      const entry = item.webkitGetAsEntry();
      if (entry) {
        await processEntry(entry);
      }
    }

    // 第二步：读取每个 INI 文件，解析 AttackFile 字段
    // 记录哪些文件是 AttackFile（被其他文件引用的）
    const attackFileNames = new Set<string>();
    const mainFileContents: Map<
      string,
      { file: File; fullPath: string; content: string; attackFileName?: string }
    > = new Map();

    for (const [fileName, { file, fullPath }] of allIniFiles) {
      const content = await file.text();

      // 解析 AttackFile 字段
      const attackFileMatch = content.match(/^\s*AttackFile\s*=\s*(.+?)\s*$/im);
      if (attackFileMatch) {
        const attackFileName = attackFileMatch[1].toLowerCase();
        attackFileNames.add(attackFileName);
        mainFileContents.set(fileName, { file, fullPath, content, attackFileName });
      } else {
        mainFileContents.set(fileName, { file, fullPath, content });
      }
    }

    // 第三步：构建导入项目列表
    // 只导入主武功文件（排除被引用的 AttackFile）
    for (const [fileName, info] of mainFileContents) {
      // 如果这个文件是其他文件的 AttackFile，跳过（它会被关联到主文件）
      if (attackFileNames.has(fileName)) {
        continue;
      }

      let attackContent: string | undefined;

      // 如果有 AttackFile 引用，查找并读取
      if (info.attackFileName) {
        const attackFileInfo = allIniFiles.get(info.attackFileName);
        if (attackFileInfo) {
          attackContent = await attackFileInfo.file.text();
        }
      }

      // 自动检测 userType：路径中包含 "player" 则为玩家武功
      const detectedUserType = detectUserTypeFromFileName(info.fullPath);

      items.push({
        fileName: info.file.name,
        iniContent: info.content,
        attackFileContent: attackContent,
        userType: detectedUserType,
      });
    }

    if (items.length > 0) {
      setBatchItems(items);
      setMode("batch");
    }
  };

  const handleBatchDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingBatch(true);
  };

  const handleBatchDragLeave = () => {
    setIsDraggingBatch(false);
  };

  const removeBatchItem = (index: number) => {
    setBatchItems((prev) => prev.filter((_, i) => i !== index));
  };

  // 切换某个批量导入项的 userType
  const toggleBatchItemUserType = (index: number) => {
    setBatchItems((prev) =>
      prev.map((item, i) => {
        if (i !== index) return item;
        // 循环切换: undefined -> player -> npc -> player ...
        const nextType = item.userType === "player" ? "npc" : "player";
        return { ...item, userType: nextType };
      })
    );
  };

  // 检查是否有未选择类型的项目
  const hasUnselectedItems = batchItems.some((item) => !item.userType);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-[#252526] rounded-lg border border-widget-border w-[600px] max-h-[85vh] overflow-auto">
        <div className="flex items-center justify-between px-4 py-3 border-b border-widget-border">
          <h3 className="font-medium text-white">从 INI 导入武功</h3>
          <button type="button" onClick={onClose} className="text-[#858585] hover:text-white">
            ✕
          </button>
        </div>
        <div className="p-4 space-y-4">
          {/* 模式切换 */}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setMode("single")}
              className={`flex-1 px-3 py-2 text-sm rounded transition-colors ${
                mode === "single"
                  ? "bg-[#0e639c] text-white"
                  : "bg-[#3c3c3c] text-[#cccccc] hover:bg-[#4a4a4a]"
              }`}
            >
              单个导入
            </button>
            <button
              type="button"
              onClick={() => setMode("batch")}
              className={`flex-1 px-3 py-2 text-sm rounded transition-colors ${
                mode === "batch"
                  ? "bg-[#0e639c] text-white"
                  : "bg-[#3c3c3c] text-[#cccccc] hover:bg-[#4a4a4a]"
              }`}
            >
              批量导入
            </button>
          </div>

          {mode === "single" ? (
            <>
              {/* 单个导入时选择武功类型 */}
              <div>
                <label className="block text-sm text-[#cccccc] mb-2">武功类型</label>
                <select
                  value={userType}
                  onChange={(e) => setUserType(e.target.value as "player" | "npc")}
                  className="w-full px-3 py-2 bg-[#3c3c3c] border border-widget-border rounded text-white"
                >
                  <option value="player">玩家武功</option>
                  <option value="npc">NPC 武功</option>
                </select>
              </div>

              {/* 主武功 INI 文件 - 支持拖放 */}
              <div>
                <label className="block text-sm text-[#cccccc] mb-2">武功 INI 文件</label>
                <div
                  className={`border-2 border-dashed rounded-lg p-4 text-center transition-colors cursor-pointer ${
                    isDraggingMain
                      ? "border-[#0098ff] bg-[#0098ff]/10"
                      : iniContent
                        ? "border-green-500/50 bg-green-500/5"
                        : "border-widget-border hover:border-[#0098ff]"
                  }`}
                  onDragOver={(e) => handleDragOver(e, "main")}
                  onDragLeave={() => handleDragLeave("main")}
                  onDrop={(e) => handleDrop(e, "main")}
                >
                  {iniContent ? (
                    <div className="text-green-400 flex items-center justify-center gap-2">
                      <span>✓</span>
                      <span>{iniFileName}</span>
                    </div>
                  ) : (
                    <div className="text-[#858585]">
                      <p className="mb-2">拖放 .ini 文件到这里</p>
                      <p className="text-xs">或点击下方选择文件</p>
                    </div>
                  )}
                  <label className="mt-2 inline-block px-3 py-1 bg-[#3c3c3c] hover:bg-[#4a4a4a] rounded text-sm cursor-pointer">
                    选择文件
                    <input
                      type="file"
                      accept=".ini"
                      className="hidden"
                      onChange={(e) => handleFileChange(e, "main")}
                    />
                  </label>
                </div>
              </div>

              {/* AttackFile INI - 支持拖放 */}
              <div>
                <label className="block text-sm text-[#cccccc] mb-2">
                  AttackFile INI（可选，用于飞行武功）
                </label>
                <div
                  className={`border-2 border-dashed rounded-lg p-4 text-center transition-colors cursor-pointer ${
                    isDraggingAttack
                      ? "border-[#0098ff] bg-[#0098ff]/10"
                      : attackFileContent
                        ? "border-green-500/50 bg-green-500/5"
                        : "border-widget-border hover:border-[#0098ff]"
                  }`}
                  onDragOver={(e) => handleDragOver(e, "attack")}
                  onDragLeave={() => handleDragLeave("attack")}
                  onDrop={(e) => handleDrop(e, "attack")}
                >
                  {attackFileContent ? (
                    <div className="text-green-400 flex items-center justify-center gap-2">
                      <span>✓</span>
                      <span>{attackFileName}</span>
                    </div>
                  ) : (
                    <div className="text-[#858585] text-sm">拖放或选择 AttackFile .ini 文件</div>
                  )}
                  <label className="mt-2 inline-block px-3 py-1 bg-[#3c3c3c] hover:bg-[#4a4a4a] rounded text-sm cursor-pointer">
                    选择文件
                    <input
                      type="file"
                      accept=".ini"
                      className="hidden"
                      onChange={(e) => handleFileChange(e, "attack")}
                    />
                  </label>
                </div>
              </div>
            </>
          ) : (
            <>
              {/* 批量导入 - 支持目录拖放 */}
              <div>
                <label className="block text-sm text-[#cccccc] mb-2">
                  拖放目录或多个 INI 文件
                  <span className="text-[#858585] ml-2">(自动识别 AttackFile 匹配飞行武功)</span>
                </label>
                <div
                  className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors cursor-pointer ${
                    isDraggingBatch
                      ? "border-[#0098ff] bg-[#0098ff]/10"
                      : batchItems.length > 0
                        ? "border-green-500/50 bg-green-500/5"
                        : "border-widget-border hover:border-[#0098ff]"
                  }`}
                  onDragOver={handleBatchDragOver}
                  onDragLeave={handleBatchDragLeave}
                  onDrop={handleBatchDrop}
                >
                  {batchItems.length === 0 ? (
                    <div className="text-[#858585]">
                      <p className="mb-2 text-lg">📁 拖放武功目录到这里</p>
                      <p className="text-xs">支持拖放整个 ini/magic 目录，自动扫描所有武功文件</p>
                      <p className="text-xs mt-1">
                        自动识别：路径包含 "player" → 玩家武功，其他需手动选择
                      </p>
                    </div>
                  ) : (
                    <div className="text-green-400">
                      ✓ 已扫描 {batchItems.length} 个武功
                      <span className="text-blue-400 ml-2">
                        {batchItems.filter((i) => i.userType === "player").length} 玩家
                      </span>
                      <span className="text-orange-400 ml-2">
                        {batchItems.filter((i) => i.userType === "npc").length} NPC
                      </span>
                      {hasUnselectedItems && (
                        <span className="text-yellow-400 ml-2">
                          ⚠️ {batchItems.filter((i) => !i.userType).length} 待选择
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* 批量导入列表 */}
              {batchItems.length > 0 && (
                <div className="max-h-48 overflow-y-auto border border-widget-border rounded">
                  {batchItems.map((item, index) => (
                    <div
                      key={item.fileName}
                      className="flex items-center justify-between px-3 py-2 border-b border-widget-border last:border-b-0 hover:bg-[#2a2d2e]"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-white">{item.fileName}</span>
                        {/* 可点击切换的类型标签 */}
                        <button
                          type="button"
                          onClick={() => toggleBatchItemUserType(index)}
                          className={`text-xs px-1.5 py-0.5 rounded cursor-pointer transition-colors ${
                            item.userType === "player"
                              ? "bg-blue-500/20 text-blue-400 hover:bg-blue-500/40"
                              : item.userType === "npc"
                                ? "bg-orange-500/20 text-orange-400 hover:bg-orange-500/40"
                                : "bg-yellow-500/20 text-yellow-400 hover:bg-yellow-500/40 animate-pulse"
                          }`}
                          title="点击切换类型"
                        >
                          {item.userType === "player"
                            ? "玩家"
                            : item.userType === "npc"
                              ? "NPC"
                              : "选择类型"}
                        </button>
                        {item.attackFileContent && (
                          <span className="text-xs px-1.5 py-0.5 bg-purple-500/20 text-purple-400 rounded">
                            飞行
                          </span>
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

              {/* 批量导入结果 */}
              {batchResult && (
                <div className="space-y-2">
                  {batchResult.success.length > 0 && (
                    <div className="p-3 bg-green-500/10 border border-green-500/30 rounded">
                      <p className="text-green-400 text-sm font-medium mb-1">
                        ✓ 成功导入 {batchResult.success.length} 个武功
                      </p>
                      <div className="text-xs text-green-400/80 max-h-24 overflow-y-auto">
                        {batchResult.success.map((s) => (
                          <div key={s.id}>
                            {s.name} {s.isFlyingMagic && "(飞行)"}
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
            </>
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
          {mode === "single" ? (
            <button
              type="button"
              onClick={() =>
                onImport(iniFileName, iniContent, userType, attackFileContent || undefined)
              }
              disabled={!iniContent || !iniFileName || isLoading}
              className="px-4 py-2 text-sm bg-[#0e639c] hover:bg-[#1177bb] disabled:opacity-50 disabled:cursor-not-allowed rounded text-white"
            >
              {isLoading ? "导入中..." : "导入"}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => onBatchImport(batchItems)}
              disabled={batchItems.length === 0 || hasUnselectedItems || isLoading}
              className="px-4 py-2 text-sm bg-[#0e639c] hover:bg-[#1177bb] disabled:opacity-50 disabled:cursor-not-allowed rounded text-white"
            >
              {isLoading ? "导入中..." : `批量导入 (${batchItems.length})`}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ========== 新建武功弹窗 ==========
function CreateMagicModal({
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
  const [userType, setUserType] = useState<"player" | "npc">("player");
  const [name, setName] = useState("");
  const [key, setKey] = useState("");
  const [intro, setIntro] = useState("");

  const createMutation = api.magic.create.useMutation({
    onSuccess: (data) => {
      onSuccess();
      onClose();
      navigate(`${basePath}/${data.id}/basic`);
    },
  });

  return (
    <CreateEntityModal
      title="新建武功"
      onClose={onClose}
      onCreate={() =>
        createMutation.mutate({
          gameId,
          userType,
          key: key || `magic_${Date.now()}`,
          name: name || "新武功",
          intro: intro || undefined,
        })
      }
      createDisabled={!name.trim()}
      isPending={createMutation.isPending}
      error={createMutation.error}
      width="w-[480px]"
    >
      {/* 类型选择 */}
      <div>
        <label className="block text-sm text-[#cccccc] mb-2">武功类型</label>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setUserType("player")}
            className={`flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg border transition-colors ${
              userType === "player"
                ? "bg-blue-600/20 border-blue-500 text-blue-400"
                : "bg-[#3c3c3c] border-[#555] text-[#cccccc] hover:border-[#666]"
            }`}
          >
            <span className="text-lg">👤</span>
            <span>玩家武功</span>
          </button>
          <button
            type="button"
            onClick={() => setUserType("npc")}
            className={`flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg border transition-colors ${
              userType === "npc"
                ? "bg-orange-600/20 border-orange-500 text-orange-400"
                : "bg-[#3c3c3c] border-[#555] text-[#cccccc] hover:border-[#666]"
            }`}
          >
            <span className="text-lg">🤖</span>
            <span>NPC 武功</span>
          </button>
        </div>
      </div>
      {/* 武功名称 */}
      <div>
        <label className="block text-sm text-[#cccccc] mb-1">
          武功名称 <span className="text-red-400">*</span>
        </label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="例如：降龙十八掌"
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
          placeholder="例如：player-magic-降龙十八掌.ini（留空自动生成）"
          className="w-full px-3 py-2 bg-[#1e1e1e] border border-widget-border rounded-lg text-white focus:outline-none focus:border-focus-border"
        />
      </div>
      {/* 武功介绍 */}
      <div>
        <label className="block text-sm text-[#cccccc] mb-1">武功介绍</label>
        <textarea
          rows={2}
          value={intro}
          onChange={(e) => setIntro(e.target.value)}
          placeholder="简单描述武功的效果..."
          className="w-full px-3 py-2 bg-[#1e1e1e] border border-widget-border rounded-lg text-white focus:outline-none focus:border-focus-border resize-none"
        />
      </div>
    </CreateEntityModal>
  );
}
