/**
 * 文件树行组件
 * 1:1 复刻 VSCode 风格
 */
import { useCallback, useRef, useState } from "react";
import type { FlatFileTreeNode } from "./types";
import { getFileExtension } from "./types";

// 文件图标配置
const FILE_ICONS: Record<string, string> = {
  folder: "📁",
  folderOpen: "📂",
  file: "📄",
  asf: "🎬",
  msf: "🎬",
  ini: "⚙️",
  txt: "📝",
  npc: "👤",
  obj: "📦",
  map: "🗺️",
  mpc: "📦",
  ogg: "🎵",
  wav: "🎵",
  mp3: "🎵",
  png: "🖼️",
  jpg: "🖼️",
  jpeg: "🖼️",
  gif: "🖼️",
  json: "📋",
  xml: "📋",
};

function getFileIcon(node: FlatFileTreeNode, isExpanded: boolean): string {
  if (node.isDirectory) {
    return isExpanded ? FILE_ICONS.folderOpen : FILE_ICONS.folder;
  }
  const ext = getFileExtension(node.name);
  return FILE_ICONS[ext] || FILE_ICONS.file;
}

interface FileTreeRowProps {
  node: FlatFileTreeNode;
  isSelected: boolean;
  indentSize?: number;
  onSelect: (node: FlatFileTreeNode) => void;
  onToggle: (node: FlatFileTreeNode) => void;
  onContextMenu: (e: React.MouseEvent, node: FlatFileTreeNode) => void;
  onRename?: (node: FlatFileTreeNode, newName: string) => void;
  isRenaming?: boolean;
  onRenameCancel?: () => void;
  onDragStart?: (e: React.DragEvent, node: FlatFileTreeNode) => void;
  onDragOver?: (e: React.DragEvent, node: FlatFileTreeNode) => void;
  onDrop?: (e: React.DragEvent, node: FlatFileTreeNode) => void;
  onDragEnd?: () => void;
  isDragOver?: boolean;
  style?: React.CSSProperties;
}

export function FileTreeRow({
  node,
  isSelected,
  indentSize = 8,
  onSelect,
  onToggle,
  onContextMenu,
  onRename,
  isRenaming,
  onRenameCancel,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
  isDragOver,
  style,
}: FileTreeRowProps) {
  const [editName, setEditName] = useState(node.name);
  const inputRef = useRef<HTMLInputElement>(null);

  const icon = getFileIcon(node, node.isExpanded);
  const indent = node.depth * indentSize;

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onSelect(node);
      if (node.isDirectory) {
        onToggle(node);
      }
    },
    [node, onSelect, onToggle]
  );

  const handleChevronClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      if (node.isDirectory) {
        onToggle(node);
      }
    },
    [node, onToggle]
  );

  const handleContextMenu = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      onContextMenu(e, node);
    },
    [node, onContextMenu]
  );

  const handleRenameSubmit = useCallback(() => {
    if (editName.trim() && editName !== node.name && onRename) {
      onRename(node, editName.trim().toLowerCase());
    }
    onRenameCancel?.();
  }, [editName, node, onRename, onRenameCancel]);

  const handleRenameKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") {
        handleRenameSubmit();
      } else if (e.key === "Escape") {
        onRenameCancel?.();
      }
    },
    [handleRenameSubmit, onRenameCancel]
  );

  // 拖拽处理
  const handleDragStart = useCallback(
    (e: React.DragEvent) => {
      e.stopPropagation();
      onDragStart?.(e, node);
    },
    [node, onDragStart]
  );

  const handleDragOver = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      onDragOver?.(e, node);
    },
    [node, onDragOver]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      onDrop?.(e, node);
    },
    [node, onDrop]
  );

  const rowClass = `
    flex items-center h-[22px] cursor-pointer select-none
    text-[13px] leading-[22px] whitespace-nowrap
    ${isSelected ? "bg-[#04395e]" : "hover:bg-[#2a2d2e]"}
    ${isDragOver && node.isDirectory ? "bg-[#094771] outline outline-1 outline-[#007fd4]" : ""}
  `;

  return (
    <div
      className={rowClass}
      style={style}
      onClick={handleClick}
      onContextMenu={handleContextMenu}
      draggable={!isRenaming}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      onDragEnd={onDragEnd}
      role="treeitem"
      aria-selected={isSelected}
      aria-expanded={node.isDirectory ? node.isExpanded : undefined}
      tabIndex={-1}
    >
      {/* 缩进 */}
      <span style={{ width: indent, flexShrink: 0 }} />

      {/* 展开/折叠箭头 */}
      <span
        className={`w-4 h-4 flex items-center justify-center text-[10px] text-[#c5c5c5] ${
          node.isDirectory ? "cursor-pointer" : "invisible"
        }`}
        onClick={handleChevronClick}
      >
        {node.isDirectory && (
          <svg
            width="16"
            height="16"
            viewBox="0 0 16 16"
            className={`transition-transform duration-100 ${node.isExpanded ? "rotate-90" : ""}`}
            fill="currentColor"
          >
            <path d="M6 4v8l4-4-4-4z" />
          </svg>
        )}
      </span>

      {/* 图标 */}
      <span className="w-4 h-4 flex items-center justify-center text-[14px] mr-1.5">{icon}</span>

      {/* 文件名或编辑框 */}
      {isRenaming ? (
        <input
          ref={inputRef}
          type="text"
          value={editName}
          onChange={(e) => setEditName(e.target.value.toLowerCase())}
          onBlur={handleRenameSubmit}
          onKeyDown={handleRenameKeyDown}
          className="flex-1 bg-[#3c3c3c] text-[#cccccc] text-[13px] px-1 outline-none border border-[#007fd4]"
          autoFocus
          onClick={(e) => e.stopPropagation()}
        />
      ) : (
        <span className="text-[#cccccc] overflow-hidden text-ellipsis">{node.name}</span>
      )}
    </div>
  );
}
