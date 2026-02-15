/**
 * 文件选择弹窗
 * 显示树形目录结构，支持悬停预览 ASF 和音频
 */

import { trpc } from "@miu2d/shared";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type {
  ExpandedState,
  FileTreeNode,
  FlatFileTreeNode,
} from "../../../modules/fileTree/types";
import {
  fileNodesToTreeNodes,
  flattenFileTree,
  sortTreeNodes,
} from "../../../modules/fileTree/types";
import { AsfPreviewTooltip } from "./AsfPreviewTooltip";
import { AudioPreview } from "./AudioPreview";
import { ScriptPreviewTooltip } from "./ScriptPreviewTooltip";
import {
  buildIniPreviewPath,
  buildResourcePath,
  buildScriptPreviewPath,
  getResourceFileType,
} from "./types";

export interface FileSelectDialogProps {
  /** 是否显示 */
  open: boolean;
  /** 关闭回调 */
  onClose: () => void;
  /** 选择回调（返回完整路径） */
  onSelect: (path: string) => void;
  /** 游戏 ID */
  gameId: string;
  /** 游戏 slug（用于预览） */
  gameSlug: string;
  /** 字段名（用于定位初始目录） */
  fieldName: string;
  /** 当前值（用于定位初始位置） */
  currentValue?: string | null;
  /** 文件过滤（扩展名数组，如 ["asf", "mpc"]） */
  extensions?: string[];
  /** 标题 */
  title?: string;
  /** 标题栏下方额外内容（如 tab 切换条） */
  headerExtra?: React.ReactNode;
  /** 替代主体内容（当自定义 tab 激活时，替换搜索+文件树+底部栏） */
  customContent?: React.ReactNode;
}

export function FileSelectDialog({
  open,
  onClose,
  onSelect,
  gameId,
  gameSlug,
  fieldName,
  currentValue,
  extensions,
  title = "选择资源文件",
  headerExtra,
  customContent,
}: FileSelectDialogProps) {
  // 展开状态
  const [expandedState, setExpandedState] = useState<ExpandedState>(new Set());
  // 选中节点
  const [selectedNode, setSelectedNode] = useState<FlatFileTreeNode | null>(null);
  // 悬停预览
  const [hoverNode, setHoverNode] = useState<{
    node: FlatFileTreeNode;
    position: { x: number; y: number };
  } | null>(null);
  // 搜索
  const [searchQuery, setSearchQuery] = useState("");
  // 是否已完成初始定位
  const [hasInitialized, setHasInitialized] = useState(false);
  // 文件树容器引用
  const treeContainerRef = useRef<HTMLDivElement>(null);

  // 当前值的完整路径（用于定位）
  const currentPath = useMemo(() => {
    if (!currentValue) return null;

    // 根据文件类型决定定位路径
    const fileType = getResourceFileType(fieldName, currentValue);
    if (fileType === "script") {
      return buildScriptPreviewPath(currentValue);
    }
    if (fileType === "ini") {
      return buildIniPreviewPath(currentValue);
    }
    return buildResourcePath(fieldName, currentValue);
  }, [currentValue, fieldName]);

  // tRPC queries
  const utils = trpc.useUtils();

  // 根目录查询
  const rootQuery = trpc.file.list.useQuery(
    { gameId, parentId: null },
    { enabled: open && !!gameId }
  );

  // 子目录缓存
  const [loadedDirs, setLoadedDirs] = useState<Map<string, FileTreeNode[]>>(new Map());

  // 转换为树结构
  const treeNodes = useMemo(() => {
    if (!rootQuery.data) return [];

    // 递归构建树
    function buildTree(nodes: FileTreeNode[]): FileTreeNode[] {
      return sortTreeNodes(nodes).map((node) => {
        if (node.isDirectory && loadedDirs.has(node.id)) {
          return {
            ...node,
            children: buildTree(loadedDirs.get(node.id)!),
            isLoaded: true,
          };
        }
        return node;
      });
    }

    return buildTree(fileNodesToTreeNodes(rootQuery.data, 0));
  }, [rootQuery.data, loadedDirs]);

  // 扁平化
  const flatNodes = useMemo(() => {
    return flattenFileTree(treeNodes, expandedState);
  }, [treeNodes, expandedState]);

  // 过滤节点
  const filteredNodes = useMemo(() => {
    if (!searchQuery.trim()) return flatNodes;

    const query = searchQuery.toLowerCase();
    return flatNodes.filter((node) => {
      // 目录始终显示
      if (node.isDirectory) return true;
      // 文件按名称过滤
      return node.name.toLowerCase().includes(query);
    });
  }, [flatNodes, searchQuery]);

  // 加载子目录
  const loadChildren = useCallback(
    async (nodeId: string) => {
      const result = await utils.file.list.fetch({ gameId, parentId: nodeId });
      if (result) {
        setLoadedDirs((prev) => {
          const next = new Map(prev);
          next.set(nodeId, fileNodesToTreeNodes(result, 0));
          return next;
        });
      }
    },
    [gameId, utils.file.list]
  );

  // 展开/折叠
  const handleToggle = useCallback(
    async (node: FlatFileTreeNode) => {
      if (!node.isDirectory) return;

      const isExpanded = expandedState.has(node.id);
      const next = new Set(expandedState);

      if (isExpanded) {
        next.delete(node.id);
      } else {
        // 加载子目录
        if (!loadedDirs.has(node.id)) {
          await loadChildren(node.id);
        }
        next.add(node.id);
      }

      setExpandedState(next);
    },
    [expandedState, loadedDirs, loadChildren]
  );

  // 选中
  const handleSelect = useCallback((node: FlatFileTreeNode) => {
    setSelectedNode(node);
  }, []);

  // 双击选择
  const handleDoubleClick = useCallback(
    (node: FlatFileTreeNode) => {
      if (node.isDirectory) {
        handleToggle(node);
        return;
      }

      // 检查扩展名
      if (extensions && extensions.length > 0) {
        const ext = node.name.split(".").pop()?.toLowerCase();
        if (ext && !extensions.includes(ext)) {
          return;
        }
      }

      // 返回路径
      if (node.path) {
        onSelect(node.path);
        onClose();
      }
    },
    [extensions, handleToggle, onClose, onSelect]
  );

  // 确认选择
  const handleConfirm = useCallback(() => {
    if (!selectedNode || selectedNode.isDirectory) return;

    // 检查扩展名
    if (extensions && extensions.length > 0) {
      const ext = selectedNode.name.split(".").pop()?.toLowerCase();
      if (ext && !extensions.includes(ext)) {
        return;
      }
    }

    if (selectedNode.path) {
      onSelect(selectedNode.path);
      onClose();
    }
  }, [selectedNode, extensions, onSelect, onClose]);

  // 悬停预览
  const handleMouseEnter = useCallback(
    (e: React.MouseEvent, node: FlatFileTreeNode) => {
      if (node.isDirectory || !node.path) return;

      const fileType = getResourceFileType(fieldName, node.name);
      if (fileType === "other") return;

      setHoverNode({
        node,
        position: { x: e.clientX, y: e.clientY },
      });
    },
    [fieldName]
  );

  const handleMouseLeave = useCallback(() => {
    setHoverNode(null);
  }, []);

  // 键盘事件
  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      } else if (e.key === "Enter" && selectedNode && !selectedNode.isDirectory) {
        handleConfirm();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, selectedNode, onClose, handleConfirm]);

  // 重置状态当弹窗关闭
  useEffect(() => {
    if (!open) {
      setHasInitialized(false);
      setSearchQuery("");
      setSelectedNode(null);
    }
  }, [open]);

  // 初始展开和定位 - 根据当前路径递归加载目录
  useEffect(() => {
    if (!open || hasInitialized || !currentPath) return;
    if (!rootQuery.data || rootQuery.data.length === 0) return;

    const expandToPath = async () => {
      // 解析路径层级，如 "content/sound/魔-白虹贯日.ogg" -> ["content", "sound", "魔-白虹贯日.ogg"]
      const pathParts = currentPath.split("/").filter(Boolean);
      if (pathParts.length === 0) {
        setHasInitialized(true);
        return;
      }

      const newExpanded = new Set(expandedState);
      const newLoadedDirs = new Map(loadedDirs);

      // 从根目录开始，逐级加载并展开
      let currentNodes = fileNodesToTreeNodes(rootQuery.data, 0);

      for (let i = 0; i < pathParts.length - 1; i++) {
        const part = pathParts[i];

        // 在当前层级找到匹配的目录节点
        const dirNode = currentNodes.find(
          (n) => n.isDirectory && n.name.toLowerCase() === part.toLowerCase()
        );

        if (!dirNode) {
          // 找不到目录，停止
          console.warn(`[FileSelectDialog] Directory not found: ${part}`);
          break;
        }

        // 加载子目录（如果尚未加载）
        if (!newLoadedDirs.has(dirNode.id)) {
          try {
            const children = await utils.file.list.fetch({ gameId, parentId: dirNode.id });
            if (children) {
              const childNodes = fileNodesToTreeNodes(children, 0);
              newLoadedDirs.set(dirNode.id, childNodes);
              currentNodes = childNodes;
            }
          } catch (e) {
            console.error(`[FileSelectDialog] Failed to load children for ${dirNode.name}`, e);
            break;
          }
        } else {
          currentNodes = newLoadedDirs.get(dirNode.id)!;
        }

        // 展开这个目录
        newExpanded.add(dirNode.id);
      }

      // 找到目标文件节点
      const fileName = pathParts[pathParts.length - 1];
      const targetFileNode = currentNodes.find(
        (n) => !n.isDirectory && n.name.toLowerCase() === fileName.toLowerCase()
      );

      // 更新状态
      setLoadedDirs(newLoadedDirs);
      setExpandedState(newExpanded);
      setHasInitialized(true);

      // 如果找到目标文件，设置选中并滚动
      if (targetFileNode) {
        setSelectedNode({
          ...targetFileNode,
          isExpanded: false,
          parentId: null,
          flatIndex: 0,
        });
      }
    };

    expandToPath();
  }, [
    open,
    hasInitialized,
    currentPath,
    rootQuery.data,
    gameId,
    utils.file.list,
    expandedState,
    loadedDirs,
  ]);

  // 滚动到选中节点 - 在 selectedNode 变化且 DOM 渲染后执行
  useEffect(() => {
    if (!selectedNode || !hasInitialized) return;

    // 等待 DOM 渲染完成后滚动
    const timer = setTimeout(() => {
      requestAnimationFrame(() => {
        const container = treeContainerRef.current;
        if (container) {
          const nodeElement = container.querySelector(`[data-node-id="${selectedNode.id}"]`);
          if (nodeElement) {
            nodeElement.scrollIntoView({ block: "center", behavior: "smooth" });
          }
        }
      });
    }, 100);

    return () => clearTimeout(timer);
  }, [selectedNode?.id, hasInitialized, selectedNode]);

  if (!open) return null;

  // 文件图标
  const getFileIcon = (node: FlatFileTreeNode): string => {
    if (node.isDirectory) {
      return expandedState.has(node.id) ? "📂" : "📁";
    }
    const ext = node.name.split(".").pop()?.toLowerCase();
    switch (ext) {
      case "asf":
      case "msf":
      case "mpc":
        return "🎬";
      case "wav":
      case "ogg":
      case "mp3":
        return "🔊";
      default:
        return "📄";
    }
  };

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
      onClick={onClose}
    >
      <div
        className="w-[600px] min-h-[400px] max-h-[80vh] bg-[#1e1e1e] border border-[#454545] rounded-lg shadow-2xl flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 标题栏 */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#454545] bg-[#252526]">
          <h2 className="text-white font-medium">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded hover:bg-[#3c3c3c] text-[#808080] hover:text-white"
          >
            ✕
          </button>
        </div>

        {/* Tab 栏（可选） */}
        {headerExtra}

        {/* 自定义内容 tab 激活时替换搜索+文件树+底部栏 */}
        {customContent ? (
          customContent
        ) : (
          <>
            {/* 搜索栏 */}
            <div className="px-4 py-2 border-b border-[#454545]">
              <input
                type="text"
                placeholder="搜索文件..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full px-3 py-2 bg-[#3c3c3c] border border-[#454545] rounded text-white text-sm focus:outline-none focus:border-[#0e639c]"
                autoFocus
              />
            </div>

            {/* 文件树 */}
            <div ref={treeContainerRef} className="flex-1 min-h-[250px] overflow-auto p-2">
              {rootQuery.isLoading ? (
                <div className="flex items-center justify-center py-8 text-[#808080]">
                  <div className="w-5 h-5 border-2 border-amber-500 border-t-transparent rounded-full animate-spin mr-2" />
                  加载中...
                </div>
              ) : filteredNodes.length === 0 ? (
                <div className="text-center py-8 text-[#808080]">
                  {searchQuery ? "没有匹配的文件" : "目录为空"}
                </div>
              ) : (
                <div className="space-y-0.5">
                  {filteredNodes.map((node) => (
                    <div
                      key={node.id}
                      data-node-id={node.id}
                      className={`flex items-center px-2 py-1 rounded cursor-pointer select-none ${
                        selectedNode?.id === node.id
                          ? "bg-[#0e639c] text-white"
                          : "hover:bg-[#2a2d2e] text-[#cccccc]"
                      }`}
                      style={{ paddingLeft: `${8 + node.depth * 16}px` }}
                      onClick={() => handleSelect(node)}
                      onDoubleClick={() => handleDoubleClick(node)}
                      onMouseEnter={(e) => handleMouseEnter(e, node)}
                      onMouseLeave={handleMouseLeave}
                    >
                      {/* 展开箭头 */}
                      <span
                        className="w-4 text-center text-xs mr-1"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleToggle(node);
                        }}
                      >
                        {node.isDirectory ? (expandedState.has(node.id) ? "▼" : "▶") : ""}
                      </span>
                      {/* 图标 */}
                      <span className="mr-2">{getFileIcon(node)}</span>
                      {/* 名称 */}
                      <span className="flex-1 truncate text-sm">{node.name}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 底部栏 */}
            <div className="flex items-center justify-between px-4 py-3 border-t border-[#454545] bg-[#252526]">
              <div className="text-sm text-[#808080]">
                {selectedNode?.path ? (
                  <span className="truncate max-w-80 inline-block" title={selectedNode.path}>
                    {selectedNode.path}
                  </span>
                ) : (
                  "未选择文件"
                )}
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 text-sm rounded hover:bg-[#3c3c3c] text-[#cccccc]"
                >
                  取消
                </button>
                <button
                  type="button"
                  onClick={handleConfirm}
                  disabled={!selectedNode || selectedNode.isDirectory}
                  className="px-4 py-2 text-sm bg-[#0e639c] hover:bg-[#1177bb] text-white rounded disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  选择
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* 悬停预览 */}
      {hoverNode?.node.path && (
        <>
          {getResourceFileType(fieldName, hoverNode.node.name) === "asf" && (
            <AsfPreviewTooltip
              gameSlug={gameSlug}
              path={hoverNode.node.path}
              position={hoverNode.position}
              onClose={() => setHoverNode(null)}
            />
          )}
          {getResourceFileType(fieldName, hoverNode.node.name) === "audio" && (
            <div
              className="fixed z-[9999] bg-[#252526] border border-[#454545] rounded shadow-lg p-2"
              style={{
                left: hoverNode.position.x + 16,
                top: hoverNode.position.y,
              }}
            >
              <AudioPreview gameSlug={gameSlug} path={hoverNode.node.path} compact autoPlay />
            </div>
          )}
          {(getResourceFileType(fieldName, hoverNode.node.name) === "script" ||
            getResourceFileType(fieldName, hoverNode.node.name) === "ini") && (
            <div
              className="fixed z-[9999]"
              style={{
                left: hoverNode.position.x + 16,
                top: hoverNode.position.y,
              }}
            >
              <ScriptPreviewTooltip
                gameSlug={gameSlug}
                path={
                  hoverNode.node.path.startsWith("/")
                    ? hoverNode.node.path.slice(1)
                    : hoverNode.node.path
                }
              />
            </div>
          )}
        </>
      )}
    </div>,
    document.body
  );
}
