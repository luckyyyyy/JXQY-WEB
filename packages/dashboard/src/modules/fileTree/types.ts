/**
 * 文件树节点类型（适配 tRPC FileNode）
 */
import type { FileNode } from "@miu2d/types";

export interface FileTreeNode {
  id: string;
  name: string;
  isDirectory: boolean;
  depth: number;
  children?: FileTreeNode[];
  isLoaded?: boolean;
  size?: number;
  mimeType?: string;
  parentId?: string | null;
  gameId?: string;
  /** 文件/目录的完整路径 */
  path?: string;
}

export interface FlatFileTreeNode extends FileTreeNode {
  isExpanded: boolean;
  parentId: string | null;
  flatIndex: number;
}

export type ExpandedState = Set<string>;

/**
 * 将 FileNode 转换为 FileTreeNode
 */
export function fileNodeToTreeNode(node: FileNode, depth: number): FileTreeNode {
  return {
    id: node.id,
    name: node.name,
    isDirectory: node.type === "folder",
    depth,
    isLoaded: false,
    size: node.size ? parseInt(node.size, 10) : undefined,
    mimeType: node.mimeType ?? undefined,
    parentId: node.parentId,
    gameId: node.gameId,
    path: node.path,
  };
}

/**
 * 将 FileNode 列表转换为 FileTreeNode 列表
 */
export function fileNodesToTreeNodes(nodes: FileNode[], depth: number): FileTreeNode[] {
  return nodes.map((node) => fileNodeToTreeNode(node, depth));
}

/**
 * 排序：目录在前，文件在后，按名称排序
 */
export function sortTreeNodes(nodes: FileTreeNode[]): FileTreeNode[] {
  return [...nodes].sort((a, b) => {
    if (a.isDirectory !== b.isDirectory) {
      return a.isDirectory ? -1 : 1;
    }
    return a.name.localeCompare(b.name, "zh-CN", { sensitivity: "base" });
  });
}

/**
 * 扁平化树结构
 */
export function flattenFileTree(
  nodes: FileTreeNode[],
  expandedState: ExpandedState,
  parentId: string | null = null,
  startIndex = { value: 0 },
  depth = 0
): FlatFileTreeNode[] {
  const result: FlatFileTreeNode[] = [];

  for (const node of nodes) {
    const isExpanded = expandedState.has(node.id);
    const flatNode: FlatFileTreeNode = {
      ...node,
      depth, // 使用传入的 depth 而非节点自带的
      isExpanded,
      parentId,
      flatIndex: startIndex.value++,
    };
    result.push(flatNode);

    if (node.isDirectory && isExpanded && node.children) {
      const childNodes = flattenFileTree(
        node.children,
        expandedState,
        node.id,
        startIndex,
        depth + 1
      );
      result.push(...childNodes);
    }
  }

  return result;
}

/**
 * 获取文件扩展名
 */
export function getFileExtension(filename: string): string {
  const lastDot = filename.lastIndexOf(".");
  return lastDot > 0 ? filename.slice(lastDot + 1).toLowerCase() : "";
}

/**
 * 规范化文件名（全小写）
 */
export function normalizeFileName(name: string): string {
  return name.toLowerCase();
}
