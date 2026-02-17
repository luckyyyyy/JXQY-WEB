/**
 * NPC 资源选择器（外观配置选择器）
 *
 * 类似 MagicPicker 的界面风格，用于选择 NPC 资源（角色外观）
 * 支持列表悬停预览动画、选择弹窗侧边预览
 * 数据来源：npcResource tRPC 接口
 */

import { api } from "@miu2d/shared";
import type { NpcRes, NpcResListItem } from "@miu2d/types";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { NpcPreview } from "../../../modules/npc/NpcPreview";
import { LazyAsfIcon } from "../LazyAsfIcon";

export interface NpcResourcePickerProps {
  /** 字段标签 */
  label: string;
  /** 当前值（NPC 资源 key） */
  value: string | null | undefined;
  /** 值变化回调 */
  onChange: (value: string | null) => void;
  /** 游戏 ID */
  gameId: string;
  /** 游戏 slug（用于预览） */
  gameSlug: string;
  /** 占位文本 */
  placeholder?: string;
  /** label 显示为输入框内的 tag 徽章（而非外部文本） */
  inlineLabel?: boolean;
}

export function NpcResourcePicker({
  label,
  value,
  onChange,
  gameId,
  gameSlug,
  placeholder = "点击选择 NPC 资源",
  inlineLabel = false,
}: NpcResourcePickerProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  // 获取 NPC 资源列表
  const { data: resourceList } = api.npcResource.list.useQuery({ gameId }, { enabled: !!gameId });

  // 找到当前选中的资源
  const selectedResource = useMemo(() => {
    if (!value || !resourceList) return null;
    return resourceList.find((r) => r.key.toLowerCase() === value.toLowerCase()) || null;
  }, [value, resourceList]);

  const handleOpenDialog = useCallback(() => {
    setIsDialogOpen(true);
  }, []);

  const handleSelect = useCallback(
    (resource: NpcResListItem) => {
      onChange(resource.key);
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
    <div className={`${inlineLabel ? "" : "flex items-center gap-3"} relative`}>
      {/* 外部标签（非 inlineLabel 时） */}
      {!inlineLabel && <label className="text-xs text-[#858585] w-20 flex-shrink-0">{label}</label>}

      {/* 内容区 */}
      <div
        className={`${inlineLabel ? "" : "flex-1"} bg-[#2d2d2d] border border-[#454545] rounded h-9 flex items-center px-2 cursor-pointer hover:border-[#0098ff] transition-colors group`}
        onClick={handleOpenDialog}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        {value ? (
          <div className="flex items-center gap-2 flex-1 min-w-0">
            {/* 行内标签 tag */}
            {inlineLabel && (
              <span className="text-[10px] font-medium text-[#8a8a8a] bg-[#3c3c3c] px-1.5 py-0.5 rounded flex-shrink-0">
                {label}
              </span>
            )}
            {/* NPC 图标 */}
            <LazyAsfIcon
              iconPath={selectedResource?.icon}
              gameSlug={gameSlug}
              size={20}
              prefix="asf/character/"
              fallback="👤"
            />

            {/* 名称 */}
            <span className="text-xs text-[#cccccc] truncate flex-1" title={value}>
              {selectedResource ? `${selectedResource.name} (${value})` : value}
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
          <div className="flex items-center gap-2">
            {inlineLabel && (
              <span className="text-[10px] font-medium text-[#8a8a8a] bg-[#3c3c3c] px-1.5 py-0.5 rounded flex-shrink-0">
                {label}
              </span>
            )}
            <span className="text-xs text-[#606060]">{placeholder}</span>
          </div>
        )}
      </div>

      {/* 选择弹窗 */}
      <NpcResourceSelectDialog
        open={isDialogOpen}
        onClose={() => setIsDialogOpen(false)}
        onSelect={handleSelect}
        gameId={gameId}
        gameSlug={gameSlug}
        currentValue={value}
        title={`选择${label}`}
      />
    </div>
  );
}

// ========== NPC 资源选择弹窗 ==========

interface NpcResourceSelectDialogProps {
  open: boolean;
  onClose: () => void;
  onSelect: (resource: NpcResListItem) => void;
  gameId: string;
  gameSlug: string;
  currentValue?: string | null;
  title?: string;
}

function NpcResourceSelectDialog({
  open,
  onClose,
  onSelect,
  gameId,
  gameSlug,
  currentValue,
  title = "选择 NPC 资源",
}: NpcResourceSelectDialogProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedResource, setSelectedResource] = useState<NpcResListItem | null>(null);
  // 悬停预览（使用防抖避免快速划过时频繁触发）
  const [hoverResource, setHoverResource] = useState<NpcResListItem | null>(null);
  const [hoverPosition, setHoverPosition] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const hoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 获取 NPC 资源列表
  const { data: resourceList, isLoading } = api.npcResource.list.useQuery(
    { gameId },
    { enabled: open && !!gameId }
  );

  // 过滤
  const filteredResources = useMemo(() => {
    if (!resourceList) return [];
    if (!searchQuery.trim()) return resourceList;
    const q = searchQuery.toLowerCase();
    return resourceList.filter(
      (r) => r.name.toLowerCase().includes(q) || r.key.toLowerCase().includes(q)
    );
  }, [resourceList, searchQuery]);

  const listContainerRef = useRef<HTMLDivElement>(null);

  // 初始化选中项
  useEffect(() => {
    if (open && currentValue && resourceList) {
      const found = resourceList.find((r) => r.key.toLowerCase() === currentValue.toLowerCase());
      if (found) {
        setSelectedResource(found as unknown as NpcResListItem);
        requestAnimationFrame(() => {
          const container = listContainerRef.current;
          if (container) {
            const selectedEl = container.querySelector(`[data-resource-id="${found.id}"]`);
            selectedEl?.scrollIntoView({ block: "center" });
          }
        });
      }
    }
  }, [open, currentValue, resourceList]);

  // 重置状态
  useEffect(() => {
    if (!open) {
      setSearchQuery("");
      setSelectedResource(null);
      setHoverResource(null);
      if (hoverTimerRef.current) {
        clearTimeout(hoverTimerRef.current);
        hoverTimerRef.current = null;
      }
    }
  }, [open]);

  const handleDoubleClick = useCallback(
    (resource: NpcResListItem) => {
      onSelect(resource);
    },
    [onSelect]
  );

  const handleConfirm = useCallback(() => {
    if (selectedResource) onSelect(selectedResource);
  }, [selectedResource, onSelect]);

  // 键盘事件
  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "Enter" && selectedResource) handleConfirm();
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, selectedResource, onClose, handleConfirm]);

  if (!open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
      onClick={onClose}
    >
      <div
        className="w-[820px] min-h-[400px] max-h-[80vh] bg-[#1e1e1e] border border-[#454545] rounded-lg shadow-2xl flex overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 左侧：列表 */}
        <div className="flex-1 flex flex-col min-w-0">
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
              placeholder="搜索 NPC 资源名称或标识..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-3 py-2 bg-[#3c3c3c] border border-[#454545] rounded text-white text-sm focus:outline-none focus:border-[#0e639c]"
              autoFocus
            />
          </div>

          {/* 资源列表 */}
          <div ref={listContainerRef} className="flex-1 min-h-[250px] overflow-auto p-2">
            {isLoading ? (
              <div className="flex items-center justify-center py-8 text-[#808080]">
                <div className="w-5 h-5 border-2 border-amber-500 border-t-transparent rounded-full animate-spin mr-2" />
                加载中...
              </div>
            ) : filteredResources.length === 0 ? (
              <div className="text-center py-8 text-[#808080]">
                {searchQuery ? "没有匹配的 NPC 资源" : "暂无 NPC 资源，请先在 NPC 管理中创建"}
              </div>
            ) : (
              <div className="space-y-0.5">
                {(filteredResources as unknown as NpcResListItem[]).map((r) => {
                  const isSelected = selectedResource?.id === r.id;
                  return (
                    <div
                      key={r.id}
                      data-resource-id={r.id}
                      className={`flex items-center px-3 py-2 rounded cursor-pointer select-none ${
                        isSelected ? "bg-[#0e639c] text-white" : "hover:bg-[#2a2d2e] text-[#cccccc]"
                      }`}
                      onClick={() => setSelectedResource(r)}
                      onDoubleClick={() => handleDoubleClick(r)}
                      onMouseEnter={(e) => {
                        // 防抖：鼠标停留 150ms 后才显示 tooltip
                        if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
                        const pos = { x: e.clientX, y: e.clientY };
                        hoverTimerRef.current = setTimeout(() => {
                          setHoverResource(r);
                          setHoverPosition(pos);
                        }, 150);
                      }}
                      onMouseLeave={() => {
                        if (hoverTimerRef.current) {
                          clearTimeout(hoverTimerRef.current);
                          hoverTimerRef.current = null;
                        }
                        setHoverResource(null);
                      }}
                    >
                      {/* 图标 */}
                      <div className="w-8 h-8 mr-2 flex-shrink-0 flex items-center justify-center">
                        <LazyAsfIcon
                          iconPath={r.icon}
                          gameSlug={gameSlug}
                          size={28}
                          prefix="asf/character/"
                          fallback="👤"
                        />
                      </div>

                      {/* 名称和 key */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span
                            className={`text-sm font-medium truncate ${isSelected ? "text-white" : "text-[#cccccc]"}`}
                          >
                            {r.name}
                          </span>
                        </div>
                        <div
                          className={`text-xs truncate ${isSelected ? "text-white/70" : "text-[#808080]"}`}
                        >
                          {r.key}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* 底部栏 */}
          <div className="flex items-center justify-between px-4 py-3 border-t border-[#454545] bg-[#252526]">
            <div className="text-sm text-[#808080]">
              {selectedResource ? (
                <span className="truncate max-w-60 inline-block" title={selectedResource.key}>
                  {selectedResource.name} ({selectedResource.key})
                </span>
              ) : (
                "未选择资源"
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
                disabled={!selectedResource}
                className="px-4 py-2 text-sm bg-[#0e639c] hover:bg-[#1177bb] text-white rounded disabled:opacity-50 disabled:cursor-not-allowed"
              >
                选择
              </button>
            </div>
          </div>
        </div>

        {/* 右侧：预览面板 */}
        <div className="w-[280px] border-l border-[#454545] bg-[#252526] flex flex-col">
          <div className="px-3 py-2 border-b border-[#3c3c3c]">
            <h3 className="text-xs text-[#858585]">预览</h3>
          </div>
          <div className="flex-1 overflow-auto p-2">
            {selectedResource ? (
              <NpcResourcePreviewPanel
                gameId={gameId}
                gameSlug={gameSlug}
                resourceId={selectedResource.id}
              />
            ) : (
              <div className="flex items-center justify-center h-full text-[#555] text-xs">
                选择一个 NPC 资源查看预览
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 列表悬停预览 Tooltip */}
      {hoverResource && hoverResource.id !== selectedResource?.id && (
        <NpcResourcePreviewTooltip
          gameId={gameId}
          gameSlug={gameSlug}
          resourceId={hoverResource.id}
          resourceName={hoverResource.name}
          resourceKey={hoverResource.key}
          position={hoverPosition}
        />
      )}
    </div>,
    document.body
  );
}

// ========== 右侧预览面板（memo 避免父组件 hover 状态变化导致重渲染） ==========

const NpcResourcePreviewPanel = memo(function NpcResourcePreviewPanel({
  gameId,
  gameSlug,
  resourceId,
}: {
  gameId: string;
  gameSlug: string;
  resourceId: string;
}) {
  const { data: resource, isLoading } = api.npcResource.get.useQuery(
    { gameId, id: resourceId },
    { enabled: !!gameId && !!resourceId }
  );

  // 保留最后一次有效的 resource，避免 tRPC 查询切换时 NpcPreview 被卸载/重装（导致 WASM 重新初始化）
  const lastResourceRef = useRef(resource);
  if (resource) {
    lastResourceRef.current = resource;
  }
  const displayResource = resource ?? lastResourceRef.current;

  const npc = useMemo(() => {
    if (!displayResource) return null;
    return { name: displayResource.name, resources: displayResource.resources };
  }, [displayResource]);

  // 只有完全没有数据（首次加载）时才显示加载微调器
  if (!displayResource || !npc) {
    return (
      <div className="flex items-center justify-center py-8 text-[#808080]">
        <div className="w-4 h-4 border-2 border-amber-500 border-t-transparent rounded-full animate-spin mr-2" />
        加载中...
      </div>
    );
  }

  return (
    <div className="relative">
      <NpcPreview gameSlug={gameSlug} npc={npc} resource={displayResource as unknown as NpcRes} />
      {/* 切换资源时的加载遮罩 */}
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-[#252526]/60 rounded-lg">
          <div className="w-4 h-4 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
        </div>
      )}
    </div>
  );
});

// ========== 悬停预览 Tooltip ==========

const NpcResourcePreviewTooltip = memo(function NpcResourcePreviewTooltip({
  gameId,
  gameSlug,
  resourceId,
  resourceName,
  resourceKey,
  position,
}: {
  gameId: string;
  gameSlug: string;
  resourceId: string;
  resourceName: string;
  resourceKey: string;
  position: { x: number; y: number };
}) {
  const { data: resource, isLoading } = api.npcResource.get.useQuery(
    { gameId, id: resourceId },
    { enabled: !!gameId && !!resourceId }
  );

  const tooltipStyle = useMemo(() => {
    // 在鼠标右侧显示，避免超出屏幕
    const tooltipWidth = 240;
    const tooltipHeight = 320;
    let x = position.x + 16;
    let y = position.y - 40;

    // 如果超出右边界，显示在左侧
    if (x + tooltipWidth > window.innerWidth) {
      x = position.x - tooltipWidth - 16;
    }
    // 如果超出下边界，向上调整
    if (y + tooltipHeight > window.innerHeight) {
      y = window.innerHeight - tooltipHeight - 10;
    }
    if (y < 10) y = 10;

    return { left: x, top: y };
  }, [position.x, position.y]);

  // 稳定 npc 引用
  const npc = useMemo(() => {
    if (!resource) return null;
    return { name: resource.name, resources: resource.resources };
  }, [resource]);

  if (isLoading) {
    return (
      <div
        className="fixed z-[9999] bg-[#1e1e1e] border border-[#3c3c3c] rounded-lg shadow-xl p-3"
        style={tooltipStyle}
      >
        <div className="flex items-center gap-2 text-[#808080] text-sm">
          <div className="w-4 h-4 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
          加载中...
        </div>
      </div>
    );
  }

  if (!resource || !npc) return null;

  return (
    <div
      className="fixed z-[9999] bg-[#1e1e1e] border border-[#3c3c3c] rounded-lg shadow-xl w-[240px] overflow-hidden"
      style={tooltipStyle}
    >
      {/* 标题 */}
      <div className="px-3 py-2 border-b border-[#3c3c3c] bg-[#252526]">
        <span className="text-white font-medium text-sm">{resourceName}</span>
        <div className="text-xs text-[#808080]">{resourceKey}</div>
      </div>

      {/* 缩放预览 */}
      <div className="overflow-hidden" style={{ height: 200 }}>
        <div
          style={{
            transform: "scale(0.55)",
            transformOrigin: "top left",
            width: "182%",
            height: "182%",
          }}
        >
          <NpcPreview gameSlug={gameSlug} npc={npc} resource={resource as unknown as NpcRes} />
        </div>
      </div>
    </div>
  );
});
