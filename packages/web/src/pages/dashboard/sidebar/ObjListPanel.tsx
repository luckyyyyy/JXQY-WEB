/**
 * Object 列表侧边栏面板
 * ObjListPanel + ImportObjModal + CreateObjModal + CreateObjResourceModal
 */
import { useState, useMemo } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { useDashboard } from "../DashboardContext";
import { DashboardIcons } from "../icons";
import { trpc } from "../../../lib/trpc";
import { LazyAsfIcon } from "../../../components/common/LazyAsfIcon";

export function ObjListPanel({ basePath }: { basePath: string }) {
  const { currentGame } = useDashboard();
  const navigate = useNavigate();
  const gameId = currentGame?.id;
  const [showImportModal, setShowImportModal] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createType, setCreateType] = useState<"obj" | "resource">("obj");
  const [filterKind, setFilterKind] = useState<"all" | "obj" | "resource">("all");
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});

  const { data: objList, isLoading: objLoading, refetch: refetchObjs } = trpc.obj.list.useQuery(
    { gameId: gameId! },
    { enabled: !!gameId }
  );

  const { data: resourceList, isLoading: resourceLoading, refetch: refetchResources } = trpc.objResource.list.useQuery(
    { gameId: gameId! },
    { enabled: !!gameId }
  );

  const refetch = () => {
    refetchObjs();
    refetchResources();
  };

  const batchImportMutation = trpc.obj.batchImportFromIni.useMutation({
    onSuccess: (result) => {
      refetch();
      setShowImportModal(false);
      if (result.success.length > 0) {
        const first = result.success[0];
        if (first.type === "resource") {
          navigate(`${basePath}/resource/${first.id}`);
        } else {
          navigate(`${basePath}/${first.id}`);
        }
      }
    },
  });

  // 按类型分组
  const groupedObjs = useMemo(() => {
    if (!objList) return { Static: [], Dynamic: [], Trap: [], Other: [] };

    const groups: Record<string, typeof objList> = {
      Static: [],
      Dynamic: [],
      Trap: [],
      Other: [],
    };

    for (const obj of objList) {
      const kind = obj.kind || "Static";
      if (kind === "Static") groups.Static.push(obj);
      else if (kind === "Dynamic") groups.Dynamic.push(obj);
      else if (kind === "Trap") groups.Trap.push(obj);
      else groups.Other.push(obj);
    }

    return groups;
  }, [objList]);

  const toggleGroup = (key: string) => {
    setCollapsedGroups((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const kindLabels: Record<string, string> = {
    Static: "静态物体",
    Dynamic: "动态物体",
    Trap: "陷阱",
    Other: "其他",
  };

  const kindIcons: Record<string, string> = {
    Static: "📦",
    Dynamic: "⚙️",
    Trap: "🪤",
    Other: "❓",
  };

  const isLoading = objLoading || resourceLoading;
  const showObjs = filterKind === "all" || filterKind === "obj";
  const showResources = filterKind === "all" || filterKind === "resource";

  return (
    <>
      <div className="flex h-full w-60 flex-col bg-[#252526] border-r border-panel-border">
        {/* 标题栏 */}
        <div className="flex h-9 items-center justify-between px-4 border-b border-panel-border">
          <span className="text-xs font-medium uppercase tracking-wide text-[#bbbbbb]">
            Object 列表
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
            onClick={() => { setCreateType("obj"); setShowCreateModal(true); }}
            className="flex items-center gap-2 px-2 py-1.5 text-xs text-[#cccccc] hover:bg-[#3c3c3c] rounded transition-colors"
          >
            {DashboardIcons.add}
            <span>新建 Object</span>
          </button>
          <button
            type="button"
            onClick={() => { setCreateType("resource"); setShowCreateModal(true); }}
            className="flex items-center gap-2 px-2 py-1.5 text-xs text-[#cccccc] hover:bg-[#3c3c3c] rounded transition-colors"
          >
            {DashboardIcons.add}
            <span>新建 Object 资源</span>
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
            onClick={() => setFilterKind("obj")}
            className={`flex-1 px-2 py-1 text-xs rounded transition-colors ${
              filterKind === "obj"
                ? "bg-[#094771] text-white"
                : "text-[#cccccc] hover:bg-[#3c3c3c]"
            }`}
          >
            Object
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

        {/* Object 列表 - 按类型分组 */}
        <div className="flex-1 overflow-y-auto py-1">
          {isLoading ? (
            <div className="px-4 py-2 text-sm text-[#858585]">加载中...</div>
          ) : (
            <>
              {/* Object 列表 - 按类型分组 */}
              {showObjs && (
                <>
                  {filterKind === "all" && (
                    <div className="px-3 py-1.5 text-xs font-medium text-[#569cd6] border-b border-panel-border">
                      📦 Object ({objList?.length || 0})
                    </div>
                  )}
                  {(!objList || objList.length === 0) ? (
                    <div className="px-4 py-2 text-sm text-[#858585]">暂无 Object</div>
                  ) : (
                    Object.entries(groupedObjs).map(([kind, objs]) => {
                      if (!objs || objs.length === 0) return null;
                      return (
                        <div key={kind}>
                          <button
                            type="button"
                            onClick={() => toggleGroup(kind)}
                            className="w-full px-3 py-1.5 text-xs font-medium text-[#858585] flex items-center gap-2 hover:bg-[#2a2d2e] transition-colors"
                          >
                            <span
                              className={`transition-transform ${collapsedGroups[kind] ? "" : "rotate-90"}`}
                            >
                              ▶
                            </span>
                            <span>{kindIcons[kind]}</span>
                            <span>{kindLabels[kind]}</span>
                            <span className="text-[#666]">({objs.length})</span>
                          </button>
                          {!collapsedGroups[kind] &&
                            objs.map((obj) => (
                              <NavLink
                                key={obj.id}
                                to={`${basePath}/${obj.id}`}
                                className={({ isActive }) =>
                                  `flex items-center gap-3 px-3 py-2 pl-6 text-sm transition-colors ${
                                    isActive ? "bg-[#094771] text-white" : "hover:bg-[#2a2d2e]"
                                  }`
                                }
                              >
                                <LazyAsfIcon iconPath={obj.icon} gameSlug={currentGame?.slug} size={32} prefix="asf/object/" fallback={kindIcons[obj.kind] || "📦"} />
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2">
                                    <span className="truncate font-medium">{obj.name}</span>
                                  </div>
                                  <span className="text-xs text-[#858585] truncate block">{obj.key}</span>
                                </div>
                              </NavLink>
                            ))}
                        </div>
                      );
                    })
                  )}
                </>
              )}

              {/* Object 资源列表 */}
              {showResources && (
                <>
                  {filterKind === "all" && (
                    <div className="px-3 py-1.5 text-xs font-medium text-purple-400 border-b border-panel-border mt-2">
                      🎨 Object 资源 ({resourceList?.length || 0})
                    </div>
                  )}
                  {(!resourceList || resourceList.length === 0) ? (
                    <div className="px-4 py-2 text-sm text-[#858585]">暂无 Object 资源</div>
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
                        <LazyAsfIcon iconPath={resource.icon} gameSlug={currentGame?.slug} size={32} prefix="asf/object/" fallback="🎨" />
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
        <ImportObjModal
          gameId={gameId!}
          onClose={() => setShowImportModal(false)}
          onBatchImport={(items) => {
            batchImportMutation.mutate({ gameId: gameId!, items });
          }}
          isLoading={batchImportMutation.isPending}
          batchResult={batchImportMutation.data}
        />
      )}

      {/* 新建 Object 模态框 */}
      {showCreateModal && createType === "obj" && (
        <CreateObjModal
          onClose={() => setShowCreateModal(false)}
          basePath={basePath}
          gameId={gameId!}
          onSuccess={() => refetch()}
        />
      )}

      {/* 新建 Object 资源模态框 */}
      {showCreateModal && createType === "resource" && (
        <CreateObjResourceModal
          onClose={() => setShowCreateModal(false)}
          basePath={basePath}
          gameId={gameId!}
          onSuccess={() => refetch()}
        />
      )}
    </>
  );
}

// Object INI 导入模态框（支持 obj 和 objres 目录合并）
function ImportObjModal({
  gameId,
  onClose,
  onBatchImport,
  isLoading,
  batchResult,
}: {
  gameId: string;
  onClose: () => void;
  onBatchImport: (items: Array<{ fileName: string; iniContent: string; objResContent?: string }>) => void;
  isLoading: boolean;
  batchResult?: {
    success: Array<{ fileName: string; id: string; name: string; hasResources: boolean }>;
    failed: Array<{ fileName: string; error: string }>;
  } | null;
}) {
  const [batchItems, setBatchItems] = useState<
    Array<{ fileName: string; iniContent: string; objResContent?: string }>
  >([]);
  const [isDragging, setIsDragging] = useState(false);

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    // 收集所有 INI 文件，按目录分类
    const objFiles: Map<string, { file: File; content: string }> = new Map();
    const objResFiles: Map<string, { file: File; content: string }> = new Map();
    const files = e.dataTransfer.items;

    /**
     * 判断文件属于哪个目录
     */
    const getFileCategory = (fullPath: string): "obj" | "objres" | null => {
      const pathLower = fullPath.toLowerCase();
      // 检查是否在 objres 目录下
      if (
        pathLower.match(/[/\\]objres[/\\]/i) ||
        pathLower.startsWith("objres/") ||
        pathLower.startsWith("objres\\")
      ) {
        return "objres";
      }
      // 检查是否在 obj 目录下
      if (
        pathLower.match(/[/\\]obj[/\\]/i) ||
        pathLower.startsWith("obj/") ||
        pathLower.startsWith("obj\\")
      ) {
        return "obj";
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

          const category = getFileCategory(fullPath);
          if (category === "objres") {
            objResFiles.set(fileNameLower, { file, content });
          } else if (category === "obj") {
            objFiles.set(fileNameLower, { file, content });
          }
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

    // 从 obj ini 内容中解析 ObjFile 字段值
    const parseObjFileField = (content: string): string | null => {
      const match = content.match(/^\s*ObjFile\s*=\s*(.+?)\s*$/im);
      return match ? match[1].toLowerCase() : null;
    };

    // 合并 obj 和 objres 文件
    const items: Array<{ fileName: string; iniContent: string; objResContent?: string }> = [];

    for (const [_fileName, objInfo] of objFiles) {
      const objFileField = parseObjFileField(objInfo.content);
      const objResInfo = objFileField ? objResFiles.get(objFileField) : null;

      items.push({
        fileName: objInfo.file.name,
        iniContent: objInfo.content,
        objResContent: objResInfo?.content,
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
          <h3 className="font-medium text-white">从 INI 导入 Object</h3>
          <button type="button" onClick={onClose} className="text-[#858585] hover:text-white">
            ✕
          </button>
        </div>
        <div className="p-4 space-y-4">
          {/* 说明 */}
          <div className="text-xs text-[#858585] bg-[#1e1e1e] p-3 rounded">
            <p className="mb-1">支持拖入以下结构：</p>
            <ul className="list-disc list-inside space-y-0.5">
              <li>
                <code className="text-[#ce9178]">obj/</code> - Object 配置目录
              </li>
              <li>
                <code className="text-[#ce9178]">objres/</code> - Object 资源配置目录
              </li>
            </ul>
            <p className="mt-2">同名的 .ini 文件会自动合并资源配置</p>
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
            <div className="text-4xl mb-3">📦</div>
            <p className="text-[#cccccc] text-sm">拖放 obj 和 objres 文件夹到此处</p>
            <p className="text-[#858585] text-xs mt-1">支持批量导入，自动合并资源</p>
          </div>

          {/* 待导入文件列表 */}
          {batchItems.length > 0 && (
            <div className="max-h-48 overflow-y-auto border border-widget-border rounded">
              {batchItems.map((item, index) => (
                <div
                  key={item.fileName}
                  className="flex items-center justify-between px-3 py-2 border-b border-widget-border last:border-b-0 hover:bg-[#2a2d2e]"
                >
                  <div className="flex-1">
                    <span className="text-sm text-white">{item.fileName}</span>
                    {item.objResContent && (
                      <span className="ml-2 text-xs text-green-400">+ 资源</span>
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
                    ✓ 成功导入 {batchResult.success.length} 个 Object
                  </p>
                  <div className="text-xs text-green-400/80 max-h-24 overflow-y-auto">
                    {batchResult.success.map((s) => (
                      <div key={s.id}>
                        {s.name}{" "}
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

// 新建 Object 弹窗
function CreateObjModal({
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
  const [kind, setKind] = useState<"Static" | "Dynamic" | "Trap">("Static");
  const [name, setName] = useState("");
  const [key, setKey] = useState("");

  const createMutation = trpc.obj.create.useMutation({
    onSuccess: (data) => {
      onSuccess();
      onClose();
      navigate(`${basePath}/${data.id}`);
    },
  });

  const handleCreate = () => {
    createMutation.mutate({
      gameId,
      key: key || `obj_${Date.now()}`,
      name,
      kind,
    });
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-[#252526] rounded-lg border border-widget-border w-96">
        <div className="flex items-center justify-between px-4 py-3 border-b border-widget-border">
          <h3 className="font-medium text-white">新建 Object</h3>
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
              placeholder="输入 Object 名称"
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
                onClick={() => setKind("Static")}
                className={`flex-1 px-3 py-2 text-sm rounded transition-colors ${
                  kind === "Static"
                    ? "bg-gray-600 text-white"
                    : "bg-[#3c3c3c] text-[#cccccc] hover:bg-[#4c4c4c]"
                }`}
              >
                📦 静态
              </button>
              <button
                type="button"
                onClick={() => setKind("Dynamic")}
                className={`flex-1 px-3 py-2 text-sm rounded transition-colors ${
                  kind === "Dynamic"
                    ? "bg-blue-600 text-white"
                    : "bg-[#3c3c3c] text-[#cccccc] hover:bg-[#4c4c4c]"
                }`}
              >
                ⚙️ 动态
              </button>
              <button
                type="button"
                onClick={() => setKind("Trap")}
                className={`flex-1 px-3 py-2 text-sm rounded transition-colors ${
                  kind === "Trap"
                    ? "bg-red-600 text-white"
                    : "bg-[#3c3c3c] text-[#cccccc] hover:bg-[#4c4c4c]"
                }`}
              >
                🪤 陷阱
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

// 新建 Object 资源弹窗
function CreateObjResourceModal({
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

  const createMutation = trpc.objResource.create.useMutation({
    onSuccess: (data) => {
      onSuccess();
      onClose();
      navigate(`${basePath}/resource/${data.id}`);
    },
  });

  const handleCreate = () => {
    createMutation.mutate({
      gameId,
      key: key || `objres_${Date.now()}.ini`,
      name,
    });
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-[#252526] rounded-lg border border-widget-border w-96">
        <div className="flex items-center justify-between px-4 py-3 border-b border-widget-border">
          <h3 className="font-medium text-white">新建 Object 资源</h3>
          <button type="button" onClick={onClose} className="text-[#858585] hover:text-white">
            ✕
          </button>
        </div>
        <div className="p-4 space-y-4">
          <div className="text-xs text-[#858585] bg-[#1e1e1e] p-3 rounded">
            <p>Object 资源用于定义物体的动画和音效。</p>
            <p className="mt-1">多个 Object 可以共享同一个资源配置。</p>
          </div>
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
              placeholder="留空将自动生成 (建议以 .ini 结尾)"
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
