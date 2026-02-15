/**
 * FileManagerContext — 文件管理器集中状态
 *
 * 将 useFileTree / useFileOperations / useFileUpload 组合到同一个 Context，
 * 让所有子组件（FileTree、FilePreview、ContextMenu、Dialogs）共享同一份状态
 * 而不再通过 props 层层传递。
 */
import { createContext, type ReactNode, useCallback, useContext, useRef, useState } from "react";
import { useDashboard } from "../../DashboardContext";
import type { ExpandedState, FileTreeNode, FlatFileTreeNode } from "./types";
import { useFileOperations } from "./useFileOperations";
import { useFileTree } from "./useFileTree";
import { type UploadItem, useFileUpload } from "./useFileUpload";

// === 对话框状态 ===

interface DialogState {
  type: "newFolder" | "newFile" | "delete" | null;
  /** 新建文件/文件夹时的目标父目录 */
  targetParentId: string | null;
}

// === Context 类型 ===

interface FileManagerContextValue {
  // game
  gameId: string | undefined;
  gameSlug: string | undefined;

  // tree
  treeNodes: FileTreeNode[];
  expandedState: ExpandedState;
  setExpandedState: (state: ExpandedState) => void;
  selectedNode: FlatFileTreeNode | null;
  isLoadingRoot: boolean;
  expandNode: (node: FlatFileTreeNode) => Promise<void>;
  selectNode: (node: FlatFileTreeNode | null) => void;
  clearSelection: () => void;
  refreshAll: () => Promise<void>;

  // operations
  createFolder: (name: string, parentId: string | null) => Promise<void>;
  createFile: (name: string, parentId: string | null) => Promise<void>;
  renameNode: (node: FlatFileTreeNode, newName: string) => Promise<void>;
  deleteNode: (node: FlatFileTreeNode) => Promise<void>;
  moveNode: (nodeId: string, newParentId: string | null) => Promise<void>;
  isDeleting: boolean;

  // upload
  uploads: UploadItem[];
  isProcessingDrop: boolean;
  handleDropUpload: (dataTransfer: DataTransfer, targetParentId: string | null) => Promise<void>;
  handleFileInputUpload: (files: FileList, parentId: string | null) => Promise<void>;

  // rename inline edit
  renamingId: string | null;
  setRenamingId: (id: string | null) => void;

  // context menu
  contextMenu: { x: number; y: number; node: FlatFileTreeNode } | null;
  openContextMenu: (e: React.MouseEvent, node: FlatFileTreeNode) => void;
  closeContextMenu: () => void;

  // dialogs
  dialog: DialogState;
  openDialog: (type: DialogState["type"], targetParentId?: string | null) => void;
  closeDialog: () => void;

  // file input ref
  fileInputRef: React.RefObject<HTMLInputElement | null>;
}

const FileManagerCtx = createContext<FileManagerContextValue | null>(null);

export function useFileManager(): FileManagerContextValue {
  const ctx = useContext(FileManagerCtx);
  if (!ctx) throw new Error("useFileManager must be used within FileManagerProvider");
  return ctx;
}

// === Provider ===

export function FileManagerProvider({ children }: { children: ReactNode }) {
  const { currentGame } = useDashboard();
  const gameId = currentGame?.id;
  const gameSlug = currentGame?.slug;

  // --- File tree ---
  const tree = useFileTree({ gameId });

  // --- File operations ---
  const ops = useFileOperations({
    gameId,
    setTreeNodes: tree.setTreeNodes,
    updateNodeInTree: tree.updateNodeInTree,
    removeNodeFromTree: tree.removeNodeFromTree,
    insertNodeInTree: tree.insertNodeInTree,
    refreshFolder: tree.refreshFolder,
    clearSelection: tree.clearSelection,
  });

  // --- File upload ---
  const upload = useFileUpload({
    gameId,
    refreshFolder: tree.refreshFolder,
    refreshAll: tree.refreshAll,
  });

  // --- UI state ---
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    node: FlatFileTreeNode;
  } | null>(null);
  const [dialog, setDialog] = useState<DialogState>({ type: null, targetParentId: null });
  const fileInputRef = useRef<HTMLInputElement>(null);

  const openContextMenu = useCallback((e: React.MouseEvent, node: FlatFileTreeNode) => {
    setContextMenu({ x: e.clientX, y: e.clientY, node });
  }, []);

  const closeContextMenu = useCallback(() => setContextMenu(null), []);

  const openDialog = useCallback(
    (type: DialogState["type"], targetParentId: string | null = null) => {
      setDialog({ type, targetParentId });
    },
    []
  );

  const closeDialog = useCallback(() => setDialog({ type: null, targetParentId: null }), []);

  const value: FileManagerContextValue = {
    gameId,
    gameSlug,

    treeNodes: tree.treeNodes,
    expandedState: tree.expandedState,
    setExpandedState: tree.setExpandedState,
    selectedNode: tree.selectedNode,
    isLoadingRoot: tree.isLoadingRoot,
    expandNode: tree.expandNode,
    selectNode: tree.setSelectedNode,
    clearSelection: tree.clearSelection,
    refreshAll: tree.refreshAll,

    createFolder: ops.createFolder,
    createFile: ops.createFile,
    renameNode: ops.renameNode,
    deleteNode: ops.deleteNode,
    moveNode: ops.moveNode,
    isDeleting: ops.isDeleting,

    uploads: upload.uploads,
    isProcessingDrop: upload.isProcessingDrop,
    handleDropUpload: upload.handleDropUpload,
    handleFileInputUpload: upload.handleFileInputUpload,

    renamingId,
    setRenamingId,
    contextMenu,
    openContextMenu,
    closeContextMenu,
    dialog,
    openDialog,
    closeDialog,
    fileInputRef,
  };

  return <FileManagerCtx.Provider value={value}>{children}</FileManagerCtx.Provider>;
}
