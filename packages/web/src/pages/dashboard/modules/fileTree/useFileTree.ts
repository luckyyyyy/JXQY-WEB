/**
 * useFileTree — 文件树数据管理
 *
 * 职责：
 * - 加载根目录和子目录
 * - 维护树结构 + 展开状态
 * - 从 URL 恢复选中节点（展开路径）
 * - 提供「局部刷新」而非全量重建
 */
import { useState, useCallback, useRef, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { trpc } from "../../../../lib/trpc";
import {
  type FileTreeNode,
  type FlatFileTreeNode,
  type ExpandedState,
  fileNodesToTreeNodes,
} from "./types";

interface UseFileTreeOptions {
  gameId: string | undefined;
}

export function useFileTree({ gameId }: UseFileTreeOptions) {
  const utils = trpc.useUtils();
  const [searchParams, setSearchParams] = useSearchParams();

  // --- 核心状态 ---
  const [treeNodes, setTreeNodes] = useState<FileTreeNode[]>([]);
  const [expandedState, setExpandedState] = useState<ExpandedState>(() => new Set());
  const [selectedNode, setSelectedNode] = useState<FlatFileTreeNode | null>(null);
  const [isRestoringUrl, setIsRestoringUrl] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  // Ref 保持最新 expandedState，在 async 回调中安全读取
  const expandedRef = useRef(expandedState);
  expandedRef.current = expandedState;

  // --- URL 初始路径 ---
  const initialFilePath = searchParams.get("file");
  const hasRestoredRef = useRef(false);

  // --- 加载根目录 ---
  const {
    data: rootFiles,
    isLoading: isLoadingRoot,
    refetch: refetchRoot,
  } = trpc.file.list.useQuery(
    { gameId: gameId ?? "", parentId: null },
    { enabled: !!gameId },
  );

  // --- 辅助：在 treeNodes 中更新某个节点 ---
  const updateNodeInTree = useCallback(
    (
      nodes: FileTreeNode[],
      targetId: string,
      updater: (node: FileTreeNode) => FileTreeNode,
    ): FileTreeNode[] =>
      nodes.map((n) => {
        if (n.id === targetId) return updater(n);
        if (n.children) return { ...n, children: updateNodeInTree(n.children, targetId, updater) };
        return n;
      }),
    [],
  );

  // --- 辅助：在 treeNodes 中移除某个节点 ---
  const removeNodeFromTree = useCallback(
    (nodes: FileTreeNode[], targetId: string): FileTreeNode[] =>
      nodes
        .filter((n) => n.id !== targetId)
        .map((n) =>
          n.children ? { ...n, children: removeNodeFromTree(n.children, targetId) } : n,
        ),
    [],
  );

  // --- 辅助：在指定父节点下插入子节点 ---
  const insertNodeInTree = useCallback(
    (
      nodes: FileTreeNode[],
      parentId: string | null,
      newNode: FileTreeNode,
    ): FileTreeNode[] => {
      if (parentId === null) {
        return [...nodes, newNode];
      }
      return nodes.map((n) => {
        if (n.id === parentId) {
          return { ...n, children: [...(n.children ?? []), newNode] };
        }
        if (n.children) return { ...n, children: insertNodeInTree(n.children, parentId, newNode) };
        return n;
      });
    },
    [],
  );

  // --- 辅助：用新的子节点列表替换某个目录的 children ---
  const replaceChildrenInTree = useCallback(
    (
      nodes: FileTreeNode[],
      parentId: string,
      children: FileTreeNode[],
    ): FileTreeNode[] =>
      nodes.map((n) => {
        if (n.id === parentId) return { ...n, isLoaded: true, children };
        if (n.children) return { ...n, children: replaceChildrenInTree(n.children, parentId, children) };
        return n;
      }),
    [],
  );

  // === 初始化根节点 ===
  useEffect(() => {
    if (!rootFiles || !gameId) return;

    let aborted = false;

    const rebuildTree = async () => {
      const currentExpanded = expandedRef.current;
      const rootNodes = fileNodesToTreeNodes(rootFiles, 0);

      // 加载已展开的目录（并行）
      const loadExpanded = async (
        nodes: FileTreeNode[],
        depth: number,
      ): Promise<FileTreeNode[]> => {
        const tasks = nodes.map(async (node) => {
          if (aborted) return node;
          if (!node.isDirectory || !currentExpanded.has(node.id)) return node;
          try {
            const children = await utils.file.list.fetch({ gameId, parentId: node.id });
            if (aborted) return node;
            const childNodes = fileNodesToTreeNodes(children, depth + 1);
            const deepChildren = await loadExpanded(childNodes, depth + 1);
            return { ...node, isLoaded: true, children: deepChildren };
          } catch {
            return node;
          }
        });
        return Promise.all(tasks);
      };

      const loaded = await loadExpanded(rootNodes, 0);
      if (!aborted) {
        setTreeNodes(loaded);
      }
    };

    rebuildTree();

    return () => {
      aborted = true;
    };
  }, [rootFiles, gameId, utils.file.list, refreshKey]);

  // === 从 URL 恢复选中 ===
  useEffect(() => {
    if (!gameId || !initialFilePath || hasRestoredRef.current || treeNodes.length === 0) return;

    const restore = async () => {
      setIsRestoringUrl(true);
      const pathParts = initialFilePath.split("/").filter(Boolean);
      if (pathParts.length === 0) {
        hasRestoredRef.current = true;
        setIsRestoringUrl(false);
        return;
      }

      let parentId: string | null = null;
      let currentNodes = treeNodes;
      const expandIds: string[] = [];
      const loadedUpdates = new Map<string, FileTreeNode[]>();

      for (let i = 0; i < pathParts.length; i++) {
        const part = pathParts[i];
        const isLast = i === pathParts.length - 1;

        let found = currentNodes.find((n) => n.name === part);

        if (!found) {
          try {
            const children = await utils.file.list.fetch({ gameId, parentId });
            const childNodes = fileNodesToTreeNodes(children, i);
            currentNodes = childNodes;
            if (parentId) loadedUpdates.set(parentId, childNodes);
            found = currentNodes.find((n) => n.name === part);
          } catch {
            break;
          }
        }

        if (!found) break;

        if (isLast) {
          // Apply all loaded updates
          setTreeNodes((prev) => {
            let updated = prev;
            for (const [pId, children] of loadedUpdates) {
              updated = replaceChildrenInTree(updated, pId, children);
            }
            return updated;
          });
          setExpandedState((prev) => {
            const next = new Set(prev);
            for (const id of expandIds) next.add(id);
            return next;
          });
          setSelectedNode({
            ...found,
            isExpanded: false,
            parentId,
            flatIndex: 0,
          } as FlatFileTreeNode);
        } else if (found.isDirectory) {
          expandIds.push(found.id);
          parentId = found.id;
          if (!found.isLoaded || !found.children) {
            try {
              const children = await utils.file.list.fetch({ gameId, parentId: found.id });
              const childNodes = fileNodesToTreeNodes(children, i + 1);
              loadedUpdates.set(found.id, childNodes);
              currentNodes = childNodes;
            } catch {
              break;
            }
          } else {
            currentNodes = found.children;
          }
        } else {
          break;
        }
      }

      hasRestoredRef.current = true;
      setIsRestoringUrl(false);
    };

    restore();
  }, [gameId, initialFilePath, treeNodes, utils.file.list, replaceChildrenInTree]);

  // === 展开目录 ===
  const expandNode = useCallback(
    async (node: FlatFileTreeNode) => {
      if (!gameId || node.isLoaded) return;
      const children = await utils.file.list.fetch({ gameId, parentId: node.id });
      const childNodes = fileNodesToTreeNodes(children, node.depth + 1);
      setTreeNodes((prev) => replaceChildrenInTree(prev, node.id, childNodes));
    },
    [gameId, utils.file.list, replaceChildrenInTree],
  );

  // === 选中节点 ===
  const selectNode = useCallback(
    (node: FlatFileTreeNode | null) => {
      setSelectedNode(node);
      if (node?.path) {
        setSearchParams((prev) => {
          const next = new URLSearchParams(prev);
          next.set("file", node.path!);
          return next;
        }, { replace: true });
      }
    },
    [setSearchParams],
  );

  // === 清除选中 ===
  const clearSelection = useCallback(() => {
    setSelectedNode(null);
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.delete("file");
      return next;
    }, { replace: true });
  }, [setSearchParams]);

  // === 刷新指定目录（局部） ===
  const refreshFolder = useCallback(
    async (parentId: string | null) => {
      if (!gameId) return;

      if (parentId === null) {
        // 根目录：refetch 触发 rebuild useEffect 即可
        await refetchRoot();
        return;
      }

      // 非根目录：获取最新子节点，保留已展开目录的 children
      const children = await utils.file.list.fetch({ gameId, parentId });
      const childNodes = fileNodesToTreeNodes(children, 0);

      setTreeNodes((prev) => {
        // 计算父节点 depth
        const findDepth = (nodes: FileTreeNode[], id: string, d: number): number => {
          for (const n of nodes) {
            if (n.id === id) return d;
            if (n.children) {
              const found = findDepth(n.children, id, d + 1);
              if (found >= 0) return found;
            }
          }
          return -1;
        };
        const parentDepth = findDepth(prev, parentId, 0);
        const depth = parentDepth >= 0 ? parentDepth + 1 : 0;

        // 查找现有父节点的 children，以保留已展开子目录
        const findNode = (nodes: FileTreeNode[], id: string): FileTreeNode | undefined => {
          for (const n of nodes) {
            if (n.id === id) return n;
            if (n.children) {
              const found = findNode(n.children, id);
              if (found) return found;
            }
          }
          return undefined;
        };
        const existingParent = findNode(prev, parentId);
        const existingChildren = existingParent?.children ?? [];

        // 合并：新节点列表 + 已展开子目录的 children 保留
        const merged = childNodes.map((newNode) => {
          const existing = existingChildren.find((e) => e.id === newNode.id);
          if (existing?.isLoaded && existing.children) {
            return { ...newNode, depth, isLoaded: true, children: existing.children };
          }
          return { ...newNode, depth };
        });

        return replaceChildrenInTree(prev, parentId, merged);
      });
    },
    [gameId, utils.file.list, refetchRoot, replaceChildrenInTree],
  );

  // === 全量刷新 ===
  const refreshAll = useCallback(async () => {
    if (!gameId) return;
    await utils.file.list.invalidate();
    await refetchRoot();
    // 强制触发树重建，即使根目录数据未变（子目录上传场景）
    setRefreshKey((k) => k + 1);
  }, [gameId, utils.file.list, refetchRoot]);

  return {
    // state
    treeNodes,
    expandedState,
    selectedNode,
    isLoadingRoot,
    isRestoringUrl,
    // setters
    setTreeNodes,
    setExpandedState,
    setSelectedNode: selectNode,
    clearSelection,
    // operations
    expandNode,
    refreshFolder,
    refreshAll,
    // tree manipulation helpers
    updateNodeInTree,
    removeNodeFromTree,
    insertNodeInTree,
    replaceChildrenInTree,
  };
}
