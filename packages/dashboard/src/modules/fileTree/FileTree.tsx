/**
 * 虚拟滚动文件树组件
 * 1:1 复刻 VSCode 风格
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FileTreeRow } from "./FileTreeRow";
import {
  type ExpandedState,
  type FileTreeNode,
  type FlatFileTreeNode,
  flattenFileTree,
  sortTreeNodes,
} from "./types";

interface FileTreeProps {
  /** 根节点列表 */
  nodes: FileTreeNode[];
  /** 选中的节点 ID */
  selectedId?: string | null;
  /** 选中事件 */
  onSelect?: (node: FlatFileTreeNode) => void;
  /** 展开目录事件 */
  onExpand?: (node: FlatFileTreeNode) => Promise<void>;
  /** 右键菜单事件 */
  onContextMenu?: (e: React.MouseEvent, node: FlatFileTreeNode) => void;
  /** 重命名事件 */
  onRename?: (node: FlatFileTreeNode, newName: string) => void;
  /** 移动事件（拖拽） */
  onMove?: (nodeId: string, newParentId: string | null) => void;
  /** 外部文件拖入目录事件 */
  onFileDrop?: (dataTransfer: DataTransfer, targetFolderId: string | null) => void;
  /** 任何 drop 完成后的回调（用于清理外层 drag 状态） */
  onDropComplete?: () => void;
  /** 正在重命名的节点 ID */
  renamingId?: string | null;
  /** 取消重命名 */
  onRenameCancel?: () => void;
  /** 缩进大小 */
  indentSize?: number;
  /** 行高 */
  rowHeight?: number;
  /** 初始展开的节点 ID（仅用于初始化） */
  defaultExpanded?: string[];
  /** 受控模式：外部展开状态 */
  expandedState?: ExpandedState;
  /** 受控模式：展开状态变化回调 */
  onExpandedChange?: (expanded: ExpandedState) => void;
  /** 类名 */
  className?: string;
}

export function FileTree({
  nodes,
  selectedId,
  onSelect,
  onExpand,
  onContextMenu,
  onRename,
  onMove,
  onFileDrop,
  onDropComplete,
  renamingId,
  onRenameCancel,
  indentSize = 8,
  rowHeight = 22,
  defaultExpanded = [],
  expandedState: externalExpandedState,
  onExpandedChange,
  className = "",
}: FileTreeProps) {
  const [internalExpandedState, setInternalExpandedState] = useState<ExpandedState>(
    () => new Set(defaultExpanded)
  );
  // 使用外部状态（受控模式）或内部状态
  const expandedState = externalExpandedState ?? internalExpandedState;

  const [internalSelectedId, setInternalSelectedId] = useState<string | null>(selectedId ?? null);
  const [containerHeight, setContainerHeight] = useState(400);
  const [scrollTop, setScrollTop] = useState(0);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const [draggedNode, setDraggedNode] = useState<FlatFileTreeNode | null>(null);
  const [isDragOverRoot, setIsDragOverRoot] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // 同步外部选中状态
  useEffect(() => {
    if (selectedId !== undefined) {
      setInternalSelectedId(selectedId);
    }
  }, [selectedId]);

  // 监听容器大小变化
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setContainerHeight(entry.contentRect.height);
      }
    });

    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  // 排序后的节点
  const sortedNodes = useMemo(() => {
    function sortRecursive(nodeList: FileTreeNode[]): FileTreeNode[] {
      return sortTreeNodes(nodeList).map((node) => ({
        ...node,
        children: node.children ? sortRecursive(node.children) : undefined,
      }));
    }
    return sortRecursive(nodes);
  }, [nodes]);

  // 扁平化树结构
  const flatNodes = useMemo(
    () => flattenFileTree(sortedNodes, expandedState),
    [sortedNodes, expandedState]
  );

  // 当选中节点变化时滚动到视图
  useEffect(() => {
    if (!internalSelectedId || !containerRef.current) return;

    // 找到选中节点的索引
    const selectedIndex = flatNodes.findIndex((n) => n.id === internalSelectedId);
    if (selectedIndex === -1) return;

    // 计算节点位置
    const nodeTop = selectedIndex * rowHeight;
    const nodeBottom = nodeTop + rowHeight;
    const container = containerRef.current;
    const viewTop = container.scrollTop;
    const viewBottom = viewTop + container.clientHeight;

    // 如果节点不在视图中，滚动到节点位置
    if (nodeTop < viewTop) {
      container.scrollTo({ top: nodeTop, behavior: "smooth" });
    } else if (nodeBottom > viewBottom) {
      container.scrollTo({ top: nodeBottom - container.clientHeight, behavior: "smooth" });
    }
  }, [internalSelectedId, flatNodes, rowHeight]);

  // 虚拟滚动计算
  const overscan = 5;
  const totalHeight = flatNodes.length * rowHeight;
  const startIndex = Math.max(0, Math.floor(scrollTop / rowHeight) - overscan);
  const visibleCount = Math.ceil(containerHeight / rowHeight);
  const endIndex = Math.min(flatNodes.length - 1, startIndex + visibleCount + overscan * 2);
  const offsetY = startIndex * rowHeight;

  // 切换展开状态
  const handleToggle = useCallback(
    async (node: FlatFileTreeNode) => {
      if (!node.isDirectory) return;

      const isCurrentlyExpanded = expandedState.has(node.id);

      if (isCurrentlyExpanded) {
        const next = new Set(expandedState);
        next.delete(node.id);
        if (onExpandedChange) {
          onExpandedChange(next);
        } else {
          setInternalExpandedState(next);
        }
      } else {
        if (!node.isLoaded && onExpand) {
          await onExpand(node);
        }
        const next = new Set(expandedState);
        next.add(node.id);
        if (onExpandedChange) {
          onExpandedChange(next);
        } else {
          setInternalExpandedState(next);
        }
      }
    },
    [expandedState, onExpand, onExpandedChange]
  );

  // 选中节点
  const handleSelect = useCallback(
    (node: FlatFileTreeNode) => {
      setInternalSelectedId(node.id);
      onSelect?.(node);
    },
    [onSelect]
  );

  // 右键菜单
  const handleContextMenu = useCallback(
    (e: React.MouseEvent, node: FlatFileTreeNode) => {
      setInternalSelectedId(node.id);
      onContextMenu?.(e, node);
    },
    [onContextMenu]
  );

  // 拖拽开始
  const handleDragStart = useCallback((e: React.DragEvent, node: FlatFileTreeNode) => {
    setDraggedNode(node);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", node.id);
  }, []);

  // 拖拽结束
  const handleDragEnd = useCallback(() => {
    setDraggedNode(null);
    setDragOverId(null);
    setIsDragOverRoot(false);
  }, []);

  // 拖拽经过
  const handleDragOver = useCallback(
    (e: React.DragEvent, node: FlatFileTreeNode) => {
      // 处理内部拖拽或外部文件拖入
      const isExternalFile = e.dataTransfer.types.includes("Files");
      if (node.isDirectory && (draggedNode || isExternalFile)) {
        e.preventDefault();
        e.stopPropagation();
        setDragOverId(node.id);
        setIsDragOverRoot(false);
      }
    },
    [draggedNode]
  );

  // 拖拽放下
  const handleDrop = useCallback(
    (e: React.DragEvent, targetNode: FlatFileTreeNode) => {
      if (!targetNode.isDirectory) return;

      // 检查是否是外部文件拖入
      if (e.dataTransfer.types.includes("Files") && !draggedNode) {
        e.preventDefault();
        e.stopPropagation();
        onFileDrop?.(e.dataTransfer, targetNode.id);
        setDragOverId(null);
        setIsDragOverRoot(false);
        onDropComplete?.();
        return;
      }

      // 内部节点拖拽
      if (!draggedNode) return;
      if (draggedNode.id === targetNode.id) return;

      // 不能移动到自己的子目录
      let parent: FlatFileTreeNode | undefined = targetNode;
      while (parent) {
        if (parent.id === draggedNode.id) return;
        parent = flatNodes.find((n) => n.id === parent?.parentId);
      }

      onMove?.(draggedNode.id, targetNode.id);
      setDraggedNode(null);
      setDragOverId(null);
      setIsDragOverRoot(false);
      onDropComplete?.();
    },
    [draggedNode, flatNodes, onMove, onFileDrop, onDropComplete]
  );

  // 容器拖拽处理（用于拖放到根目录）
  const handleContainerDragOver = useCallback(
    (e: React.DragEvent) => {
      // 处理内部节点拖拽或外部文件拖入
      const isExternalFile = e.dataTransfer.types.includes("Files");
      if (!draggedNode && !isExternalFile) return;
      e.preventDefault();
      e.stopPropagation();
      // 只有当拖拽目标不是某个节点时，才认为是拖到根目录
      // 检查是否在节点行上（通过 e.target）
      const target = e.target as HTMLElement;
      const isOnTreeNode = target.closest("[role='treeitem']");
      if (!isOnTreeNode) {
        setIsDragOverRoot(true);
        setDragOverId(null);
      }
    },
    [draggedNode]
  );

  const handleContainerDrop = useCallback(
    (e: React.DragEvent) => {
      const isExternalFile = e.dataTransfer.types.includes("Files");

      // 检查是否是在节点上放下（如果是，让节点自己处理）
      const target = e.target as HTMLElement;
      const isOnTreeNode = target.closest("[role='treeitem']");
      if (isOnTreeNode) return;

      e.preventDefault();
      e.stopPropagation();

      // 外部文件拖入到根目录
      if (isExternalFile && !draggedNode) {
        onFileDrop?.(e.dataTransfer, null);
        setDragOverId(null);
        setIsDragOverRoot(false);
        onDropComplete?.();
        return;
      }

      // 内部节点拖拽：移动到根目录（newParentId = null）
      if (draggedNode && draggedNode.parentId !== null) {
        onMove?.(draggedNode.id, null);
      }
      setDraggedNode(null);
      setDragOverId(null);
      setIsDragOverRoot(false);
      onDropComplete?.();
    },
    [draggedNode, onMove, onFileDrop, onDropComplete]
  );

  const handleContainerDragLeave = useCallback((e: React.DragEvent) => {
    // 确保是离开容器而不是进入子元素
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    if (
      e.clientX < rect.left ||
      e.clientX > rect.right ||
      e.clientY < rect.top ||
      e.clientY > rect.bottom
    ) {
      setIsDragOverRoot(false);
    }
  }, []);

  // 滚动处理
  const handleScroll = useCallback((e: React.UIEvent<HTMLElement>) => {
    setScrollTop(e.currentTarget.scrollTop);
  }, []);

  // 点击空白区域取消选中
  const handleContainerClick = useCallback(
    (e: React.MouseEvent) => {
      // 检查是否点击在节点上
      const target = e.target as HTMLElement;
      const isOnTreeNode = target.closest("[role='treeitem']");
      if (!isOnTreeNode) {
        setInternalSelectedId(null);
        onSelect?.(null as unknown as FlatFileTreeNode);
      }
    },
    [onSelect]
  );

  // 可见的节点
  const visibleNodes = flatNodes.slice(startIndex, endIndex + 1);

  return (
    <div
      ref={containerRef}
      className={`h-full overflow-auto bg-[#252526] text-[#cccccc] outline-none ${className} ${isDragOverRoot ? "bg-[#094771]/20" : ""}`}
      onScroll={handleScroll}
      onClick={handleContainerClick}
      onDragOver={handleContainerDragOver}
      onDrop={handleContainerDrop}
      onDragLeave={handleContainerDragLeave}
      tabIndex={0}
      role="tree"
      aria-label="文件浏览器"
    >
      {/* 虚拟滚动容器 */}
      <div style={{ height: totalHeight, position: "relative" }}>
        {/* 可见节点 */}
        <div style={{ position: "absolute", top: offsetY, left: 0, right: 0 }}>
          {visibleNodes.map((node) => (
            <FileTreeRow
              key={node.id}
              node={node}
              isSelected={node.id === internalSelectedId}
              indentSize={indentSize}
              onSelect={handleSelect}
              onToggle={handleToggle}
              onContextMenu={handleContextMenu}
              onRename={onRename}
              isRenaming={renamingId === node.id}
              onRenameCancel={onRenameCancel}
              onDragStart={handleDragStart}
              onDragOver={handleDragOver}
              onDrop={handleDrop}
              onDragEnd={handleDragEnd}
              isDragOver={dragOverId === node.id}
              style={{ height: rowHeight }}
            />
          ))}
        </div>
      </div>

      {/* 空状态 */}
      {flatNodes.length === 0 && (
        <div className="flex items-center justify-center h-full text-[#808080] text-sm">
          没有文件
        </div>
      )}
    </div>
  );
}
