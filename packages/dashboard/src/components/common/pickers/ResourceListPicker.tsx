/**
 * 资源列表选择器（NPC 资源 / Obj 资源通用）
 *
 * 弹窗式选择器，用于替代原来的 <select> 下拉菜单
 * 支持搜索过滤、当前选中高亮、双击确认
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

export interface ResourceListItem {
  id: string;
  key: string;
  name: string;
}

export interface ResourceListPickerProps {
  /** 字段标签 */
  label: string;
  /** 当前选中值（资源 id） */
  value: string | null | undefined;
  /** 值变化回调 */
  onChange: (value: string | null) => void;
  /** 可选项列表 */
  items: ResourceListItem[];
  /** 占位文本 */
  placeholder?: string;
  /** 弹窗标题 */
  dialogTitle?: string;
  /** 空项提示 */
  emptyText?: string;
  /** 提示文字（位于选择器下方） */
  hint?: string;
}

export function ResourceListPicker({
  label,
  value,
  onChange,
  items,
  placeholder = "点击选择资源",
  dialogTitle = "选择资源",
  emptyText = "暂无可选资源",
  hint,
}: ResourceListPickerProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  // 找到当前选中项
  const selectedItem = useMemo(
    () => (value ? (items.find((it) => it.id === value) ?? null) : null),
    [value, items]
  );

  const handleOpenDialog = useCallback(() => {
    setIsDialogOpen(true);
  }, []);

  const handleSelect = useCallback(
    (item: ResourceListItem) => {
      onChange(item.id);
      setIsDialogOpen(false);
    },
    [onChange]
  );

  const handleClear = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onChange(null);
    },
    [onChange]
  );

  return (
    <div>
      <div className="flex items-center gap-3">
        {/* 标签 */}
        <label className="text-xs text-[#858585] w-20 flex-shrink-0">{label}</label>

        {/* 内容区 */}
        <div
          className="flex-1 bg-[#2d2d2d] border border-[#454545] rounded h-9 flex items-center px-2 cursor-pointer hover:border-[#0098ff] transition-colors group"
          onClick={handleOpenDialog}
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
        >
          {selectedItem ? (
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <span className="text-sm flex-shrink-0">📦</span>
              <span className="text-xs text-[#cccccc] truncate flex-1" title={selectedItem.key}>
                {selectedItem.name} ({selectedItem.key})
              </span>

              {/* 悬停时显示操作按钮 */}
              <div
                className={`flex items-center gap-1 flex-shrink-0 transition-opacity ${isHovered ? "opacity-100" : "opacity-0"}`}
              >
                <button
                  type="button"
                  onClick={handleClear}
                  className="w-5 h-5 flex items-center justify-center rounded hover:bg-[#3c3c3c] text-[#808080] hover:text-white"
                  title="清除"
                >
                  <svg
                    className="w-3 h-3"
                    viewBox="0 0 12 12"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                  >
                    <path d="M2 2l8 8M10 2l-8 8" />
                  </svg>
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleOpenDialog();
                  }}
                  className="w-5 h-5 flex items-center justify-center rounded hover:bg-[#3c3c3c] text-[#808080] hover:text-white"
                  title="修改"
                >
                  <svg
                    className="w-3 h-3"
                    viewBox="0 0 12 12"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                  >
                    <path d="M8.5 1.5l2 2M1 11l.5-2L9 1.5l2 2L3.5 11 1 11z" />
                  </svg>
                </button>
              </div>
            </div>
          ) : (
            <span className="text-xs text-[#606060]">{placeholder}</span>
          )}
        </div>
      </div>

      {hint && <p className="mt-2 text-xs text-[#858585] ml-[92px]">{hint}</p>}

      {/* 弹窗 */}
      <ResourceSelectDialog
        open={isDialogOpen}
        onClose={() => setIsDialogOpen(false)}
        onSelect={handleSelect}
        items={items}
        currentValue={value}
        title={dialogTitle}
        emptyText={emptyText}
      />
    </div>
  );
}

// ========== 选择弹窗 ==========

interface ResourceSelectDialogProps {
  open: boolean;
  onClose: () => void;
  onSelect: (item: ResourceListItem) => void;
  items: ResourceListItem[];
  currentValue?: string | null;
  title?: string;
  emptyText?: string;
}

function ResourceSelectDialog({
  open,
  onClose,
  onSelect,
  items,
  currentValue,
  title = "选择资源",
  emptyText = "暂无可选资源",
}: ResourceSelectDialogProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedItem, setSelectedItem] = useState<ResourceListItem | null>(null);
  const listContainerRef = useRef<HTMLDivElement>(null);

  // 过滤
  const filteredItems = useMemo(() => {
    if (!searchQuery.trim()) return items;
    const query = searchQuery.toLowerCase();
    return items.filter(
      (it) => it.name.toLowerCase().includes(query) || it.key.toLowerCase().includes(query)
    );
  }, [items, searchQuery]);

  // 初始化选中
  useEffect(() => {
    if (open && currentValue && items.length > 0) {
      const found = items.find((it) => it.id === currentValue);
      if (found) {
        setSelectedItem(found);
        requestAnimationFrame(() => {
          const container = listContainerRef.current;
          if (container) {
            const el = container.querySelector(`[data-item-id="${found.id}"]`);
            el?.scrollIntoView({ block: "center" });
          }
        });
      }
    }
  }, [open, currentValue, items]);

  // 重置
  useEffect(() => {
    if (!open) {
      setSearchQuery("");
      setSelectedItem(null);
    }
  }, [open]);

  // 确认
  const handleConfirm = useCallback(() => {
    if (selectedItem) onSelect(selectedItem);
  }, [selectedItem, onSelect]);

  // 双击
  const handleDoubleClick = useCallback(
    (item: ResourceListItem) => {
      onSelect(item);
    },
    [onSelect]
  );

  // 键盘事件
  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "Enter" && selectedItem) handleConfirm();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, selectedItem, onClose, handleConfirm]);

  if (!open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
      onClick={onClose}
    >
      <div
        className="w-[500px] min-h-[300px] max-h-[60vh] bg-[#1e1e1e] border border-[#454545] rounded-lg shadow-2xl flex flex-col overflow-hidden"
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

        {/* 搜索 */}
        <div className="px-4 py-2 border-b border-[#454545]">
          <input
            type="text"
            placeholder="搜索名称或 key..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full px-3 py-2 bg-[#3c3c3c] border border-[#454545] rounded text-white text-sm focus:outline-none focus:border-[#0e639c]"
            autoFocus
          />
        </div>

        {/* 列表 */}
        <div ref={listContainerRef} className="flex-1 min-h-[200px] overflow-auto p-2">
          {filteredItems.length === 0 ? (
            <div className="text-center py-8 text-[#808080]">
              {searchQuery ? "没有匹配的资源" : emptyText}
            </div>
          ) : (
            <div className="space-y-0.5">
              {filteredItems.map((item) => (
                <div
                  key={item.id}
                  data-item-id={item.id}
                  className={`flex items-center px-3 py-2 rounded cursor-pointer select-none ${
                    selectedItem?.id === item.id
                      ? "bg-[#0e639c] text-white"
                      : "hover:bg-[#2a2d2e] text-[#cccccc]"
                  }`}
                  onClick={() => setSelectedItem(item)}
                  onDoubleClick={() => handleDoubleClick(item)}
                >
                  <span className="text-lg mr-2 flex-shrink-0">📦</span>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{item.name}</div>
                    <div
                      className={`text-xs truncate ${selectedItem?.id === item.id ? "text-white/70" : "text-[#808080]"}`}
                    >
                      {item.key}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 底部 */}
        <div className="flex items-center justify-between px-4 py-3 border-t border-[#454545] bg-[#252526]">
          <span className="text-xs text-[#808080]">{filteredItems.length} 项可选</span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-1.5 text-sm rounded bg-[#3c3c3c] text-[#cccccc] hover:bg-[#4c4c4c]"
            >
              取消
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              disabled={!selectedItem}
              className={`px-4 py-1.5 text-sm rounded ${
                selectedItem
                  ? "bg-[#0e639c] text-white hover:bg-[#1177bb]"
                  : "bg-[#3c3c3c] text-[#808080] cursor-not-allowed"
              }`}
            >
              确认
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
