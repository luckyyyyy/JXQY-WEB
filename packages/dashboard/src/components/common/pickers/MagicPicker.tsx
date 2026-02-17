/**
 * 武功选择器
 *
 * 类似 ResourceFilePicker 的界面风格，用于选择关联武功
 * 数据来源：magic tRPC 接口
 */

import { getFrameCanvas } from "@miu2d/engine/resource/format/asf";
import { decodeAsfWasm } from "@miu2d/engine/wasm/wasm-asf-decoder";
import { initWasm } from "@miu2d/engine/wasm/wasm-manager";
import { api } from "@miu2d/shared";
import type { MagicListItem } from "@miu2d/types";
import { MagicMoveKindLabels } from "@miu2d/types";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { MagicPreview } from "../../../modules/magic/MagicPreview";
import { buildResourceUrl } from "../../../utils";

export interface MagicPickerProps {
  /** 字段标签 */
  label: string;
  /** 当前值（武功 key） */
  value: string | null | undefined;
  /** 值变化回调 */
  onChange: (value: string | null) => void;
  /** 游戏 ID */
  gameId: string;
  /** 游戏 slug（用于预览） */
  gameSlug: string;
  /** 占位文本 */
  placeholder?: string;
  /** 过滤武功类型 */
  filterType?: "player" | "npc" | "all";
}

export function MagicPicker({
  label,
  value,
  onChange,
  gameId,
  gameSlug,
  placeholder = "点击选择武功",
  filterType = "all",
}: MagicPickerProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  // 获取武功列表
  const { data: magics } = api.magic.list.useQuery({ gameId }, { enabled: !!gameId });

  // 找到当前选中的武功
  const selectedMagic = useMemo(() => {
    if (!value || !magics) return null;
    return magics.find((m) => m.key === value) || null;
  }, [value, magics]);

  // 打开选择器
  const handleOpenDialog = useCallback(() => {
    setIsDialogOpen(true);
  }, []);

  // 选择武功
  const handleSelect = useCallback(
    (magic: MagicListItem) => {
      onChange(magic.key);
      setIsDialogOpen(false);
    },
    [onChange]
  );

  // 清除
  const handleClear = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onChange(null);
    },
    [onChange]
  );

  return (
    <div className="flex items-center gap-3 relative">
      {/* 标签 */}
      <label className="text-xs text-[#858585] w-20 flex-shrink-0">{label}</label>

      {/* 内容区 - 固定高度，可点击 */}
      <div
        className="flex-1 bg-[#2d2d2d] border border-[#454545] rounded h-9 flex items-center px-2 cursor-pointer hover:border-[#0098ff] transition-colors group"
        onClick={handleOpenDialog}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        {value ? (
          <div className="flex items-center gap-2 flex-1 min-w-0">
            {/* 武功图标 */}
            <MagicIcon iconPath={selectedMagic?.icon} gameSlug={gameSlug} size={20} />

            {/* 武功名称 */}
            <span className="text-xs text-[#cccccc] truncate flex-1" title={value}>
              {selectedMagic ? `${selectedMagic.name} (${value})` : value}
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

      {/* 武功选择弹窗 */}
      <MagicSelectDialog
        open={isDialogOpen}
        onClose={() => setIsDialogOpen(false)}
        onSelect={handleSelect}
        gameId={gameId}
        gameSlug={gameSlug}
        currentValue={value}
        filterType={filterType}
        title={`选择${label}`}
      />
    </div>
  );
}

// ========== 武功选择弹窗 ==========

interface MagicSelectDialogProps {
  open: boolean;
  onClose: () => void;
  onSelect: (magic: MagicListItem) => void;
  gameId: string;
  gameSlug: string;
  currentValue?: string | null;
  filterType?: "player" | "npc" | "all";
  title?: string;
}

function MagicSelectDialog({
  open,
  onClose,
  onSelect,
  gameId,
  gameSlug,
  currentValue,
  filterType = "all",
  title = "选择武功",
}: MagicSelectDialogProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedMagic, setSelectedMagic] = useState<MagicListItem | null>(null);
  const [activeFilter, setActiveFilter] = useState<"all" | "player" | "npc">("all");
  // 悬停预览
  const [hoverMagic, setHoverMagic] = useState<{
    magic: MagicListItem;
    position: { x: number; y: number };
  } | null>(null);

  // 获取武功列表
  const { data: magics, isLoading } = api.magic.list.useQuery(
    { gameId },
    { enabled: open && !!gameId }
  );

  // 过滤武功
  const filteredMagics = useMemo(() => {
    if (!magics) return [];

    let result = magics;

    // 按类型过滤
    if (activeFilter !== "all") {
      result = result.filter((m) => m.userType === activeFilter);
    }

    // 按搜索过滤
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (m) => m.name.toLowerCase().includes(query) || m.key.toLowerCase().includes(query)
      );
    }

    return result;
  }, [magics, activeFilter, searchQuery]);

  const listContainerRef = useRef<HTMLDivElement>(null);

  // 初始化选中项
  useEffect(() => {
    if (open && currentValue && magics) {
      const found = magics.find((m) => m.key === currentValue);
      if (found) {
        setSelectedMagic(found as unknown as MagicListItem);
        // 滚动到选中项
        requestAnimationFrame(() => {
          const container = listContainerRef.current;
          if (container) {
            const selectedEl = container.querySelector(`[data-magic-id="${found.id}"]`);
            selectedEl?.scrollIntoView({ block: "center" });
          }
        });
      }
    }
  }, [open, currentValue, magics]);

  // 重置状态
  useEffect(() => {
    if (!open) {
      setSearchQuery("");
      setSelectedMagic(null);
    }
  }, [open]);

  // 双击选择
  const handleDoubleClick = useCallback(
    (magic: MagicListItem) => {
      onSelect(magic);
    },
    [onSelect]
  );

  // 确认选择
  const handleConfirm = useCallback(() => {
    if (selectedMagic) {
      onSelect(selectedMagic);
    }
  }, [selectedMagic, onSelect]);

  // 键盘事件
  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      } else if (e.key === "Enter" && selectedMagic) {
        handleConfirm();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, selectedMagic, onClose, handleConfirm]);

  if (!open) return null;

  // 武功类型图标
  const getMagicIcon = (magic: MagicListItem): string => {
    if (magic.userType === "player") return "🧑";
    if (magic.userType === "npc") return "👾";
    return "⚔️";
  };

  // 武功类型标签
  const getMagicTypeBadge = (magic: MagicListItem) => {
    const colors = {
      player: "bg-blue-500/20 text-blue-400",
      npc: "bg-red-500/20 text-red-400",
    };
    return colors[magic.userType] || "bg-gray-500/20 text-gray-400";
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

        {/* 搜索和过滤栏 */}
        <div className="px-4 py-2 border-b border-[#454545] flex gap-2">
          <input
            type="text"
            placeholder="搜索武功..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="flex-1 px-3 py-2 bg-[#3c3c3c] border border-[#454545] rounded text-white text-sm focus:outline-none focus:border-[#0e639c]"
            autoFocus
          />
          {/* 类型筛选 */}
          <div className="flex gap-1">
            <button
              type="button"
              onClick={() => setActiveFilter("all")}
              className={`px-3 py-1.5 text-xs rounded ${
                activeFilter === "all"
                  ? "bg-[#0e639c] text-white"
                  : "bg-[#3c3c3c] text-[#cccccc] hover:bg-[#4c4c4c]"
              }`}
            >
              全部
            </button>
            <button
              type="button"
              onClick={() => setActiveFilter("player")}
              className={`px-3 py-1.5 text-xs rounded ${
                activeFilter === "player"
                  ? "bg-blue-600 text-white"
                  : "bg-[#3c3c3c] text-[#cccccc] hover:bg-[#4c4c4c]"
              }`}
            >
              玩家
            </button>
            <button
              type="button"
              onClick={() => setActiveFilter("npc")}
              className={`px-3 py-1.5 text-xs rounded ${
                activeFilter === "npc"
                  ? "bg-red-600 text-white"
                  : "bg-[#3c3c3c] text-[#cccccc] hover:bg-[#4c4c4c]"
              }`}
            >
              NPC
            </button>
          </div>
        </div>

        {/* 武功列表 */}
        <div ref={listContainerRef} className="flex-1 min-h-[250px] overflow-auto p-2">
          {isLoading ? (
            <div className="flex items-center justify-center py-8 text-[#808080]">
              <div className="w-5 h-5 border-2 border-amber-500 border-t-transparent rounded-full animate-spin mr-2" />
              加载中...
            </div>
          ) : filteredMagics.length === 0 ? (
            <div className="text-center py-8 text-[#808080]">
              {searchQuery ? "没有匹配的武功" : "暂无武功数据"}
            </div>
          ) : (
            <div className="space-y-0.5">
              {(filteredMagics as unknown as MagicListItem[]).map((magic) => (
                <div
                  key={magic.id}
                  data-magic-id={magic.id}
                  className={`flex items-center px-3 py-2 rounded cursor-pointer select-none ${
                    selectedMagic?.id === magic.id
                      ? "bg-[#0e639c] text-white"
                      : "hover:bg-[#2a2d2e] text-[#cccccc]"
                  }`}
                  onClick={() => setSelectedMagic(magic)}
                  onDoubleClick={() => handleDoubleClick(magic)}
                  onMouseEnter={(e) => {
                    setHoverMagic({ magic, position: { x: e.clientX, y: e.clientY } });
                  }}
                  onMouseLeave={() => setHoverMagic(null)}
                >
                  {/* 图标 - 优先使用武功自身图标 */}
                  <div className="w-8 h-8 mr-2 flex-shrink-0 flex items-center justify-center">
                    {magic.icon ? (
                      <MagicIcon iconPath={magic.icon} gameSlug={gameSlug} size={28} />
                    ) : (
                      <span className="text-lg">{getMagicIcon(magic)}</span>
                    )}
                  </div>

                  {/* 名称和 key */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium truncate">{magic.name}</span>
                      <span
                        className={`text-[10px] px-1.5 py-0.5 rounded ${getMagicTypeBadge(magic)}`}
                      >
                        {magic.userType === "player" ? "玩家" : "NPC"}
                      </span>
                    </div>
                    <div
                      className={`text-xs truncate ${selectedMagic?.id === magic.id ? "text-white/70" : "text-[#808080]"}`}
                    >
                      {magic.key}
                    </div>
                  </div>

                  {/* 武功类型 */}
                  <div
                    className={`text-xs ml-2 flex-shrink-0 ${selectedMagic?.id === magic.id ? "text-white/70" : "text-[#808080]"}`}
                  >
                    {magic.moveKind || "未定义"}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 底部栏 */}
        <div className="flex items-center justify-between px-4 py-3 border-t border-[#454545] bg-[#252526]">
          <div className="text-sm text-[#808080]">
            {selectedMagic ? (
              <span className="truncate max-w-80 inline-block" title={selectedMagic.key}>
                {selectedMagic.name} ({selectedMagic.key})
              </span>
            ) : (
              "未选择武功"
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
              disabled={!selectedMagic}
              className="px-4 py-2 text-sm bg-[#0e639c] hover:bg-[#1177bb] text-white rounded disabled:opacity-50 disabled:cursor-not-allowed"
            >
              选择
            </button>
          </div>
        </div>
      </div>

      {/* 悬停预览 */}
      {hoverMagic && (
        <MagicPreviewTooltip
          gameId={gameId}
          gameSlug={gameSlug}
          magicId={hoverMagic.magic.id}
          position={hoverMagic.position}
        />
      )}
    </div>,
    document.body
  );
}

// ========== 武功预览 Tooltip ==========

interface MagicPreviewTooltipProps {
  gameId: string;
  gameSlug: string;
  magicId: string;
  position: { x: number; y: number };
}

function MagicPreviewTooltip({ gameId, gameSlug, magicId, position }: MagicPreviewTooltipProps) {
  // 查询完整的武功数据
  const { data: magic, isLoading } = api.magic.get.useQuery(
    { gameId, id: magicId },
    { enabled: !!gameId && !!magicId }
  );

  // 计算 tooltip 位置（避免超出屏幕）
  const tooltipStyle = useMemo(() => {
    const x = position.x + 16;
    const y = Math.min(position.y, window.innerHeight - 300);
    return { left: x, top: y };
  }, [position]);

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

  if (!magic) {
    return null;
  }

  return (
    <div
      className="fixed z-[9999] bg-[#1e1e1e] border border-[#3c3c3c] rounded-lg shadow-xl w-[280px]"
      style={tooltipStyle}
    >
      {/* 标题栏 */}
      <div className="px-3 py-2 border-b border-[#3c3c3c] bg-[#252526]">
        <div className="flex items-center gap-2">
          <span className="text-white font-medium">{magic.name}</span>
          <span
            className={`text-[10px] px-1.5 py-0.5 rounded ${
              magic.userType === "player"
                ? "bg-blue-500/20 text-blue-400"
                : "bg-red-500/20 text-red-400"
            }`}
          >
            {magic.userType === "player" ? "玩家" : "NPC"}
          </span>
        </div>
        <div className="text-xs text-[#808080]">{magic.key}</div>
      </div>

      {/* 简介 */}
      {magic.intro && (
        <div className="px-3 py-2 text-xs text-[#cccccc] border-b border-[#3c3c3c]">
          {magic.intro}
        </div>
      )}

      {/* 属性信息 */}
      <div className="px-3 py-2 text-xs space-y-1">
        <div className="flex justify-between">
          <span className="text-[#808080]">移动类型</span>
          <span className="text-amber-400">
            {MagicMoveKindLabels[magic.moveKind] || magic.moveKind}
          </span>
        </div>
        {magic.speed && (
          <div className="flex justify-between">
            <span className="text-[#808080]">速度</span>
            <span className="text-white">{magic.speed}</span>
          </div>
        )}
        {magic.lifeFrame && (
          <div className="flex justify-between">
            <span className="text-[#808080]">生命帧</span>
            <span className="text-white">{magic.lifeFrame}</span>
          </div>
        )}
        {magic.flyingImage && (
          <div className="flex justify-between">
            <span className="text-[#808080]">飞行</span>
            <span className="text-[#cccccc] truncate max-w-32" title={magic.flyingImage}>
              {magic.flyingImage.split("/").pop()}
            </span>
          </div>
        )}
        {magic.vanishImage && (
          <div className="flex justify-between">
            <span className="text-[#808080]">爆炸</span>
            <span className="text-[#cccccc] truncate max-w-32" title={magic.vanishImage}>
              {magic.vanishImage.split("/").pop()}
            </span>
          </div>
        )}
      </div>

      {/* 武功预览 */}
      <div className="border-t border-[#3c3c3c] overflow-hidden" style={{ height: 180 }}>
        <div
          style={{
            transform: "scale(0.45)",
            transformOrigin: "top left",
            width: "222%",
            height: "222%",
          }}
        >
          <MagicPreview gameSlug={gameSlug} magic={magic} level={1} />
        </div>
      </div>
    </div>
  );
}

// ========== 武功图标组件 ==========

// ASF 图标缓存
const asfIconCache = new Map<string, string>();

interface MagicIconProps {
  iconPath?: string | null;
  gameSlug: string;
  size?: number;
}

function MagicIcon({ iconPath, gameSlug, size = 32 }: MagicIconProps) {
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const loadedPathRef = useRef<string | null>(null);

  const sizeStyle = { width: size, height: size };

  useEffect(() => {
    if (!iconPath || !gameSlug) {
      setDataUrl(null);
      loadedPathRef.current = null;
      return;
    }

    let resourcePath = iconPath;
    // 如果路径不是以 asf/ 开头，则补全为 asf/magic/xxx
    if (!resourcePath.startsWith("asf/")) {
      resourcePath = `asf/magic/${resourcePath}`;
    }
    const cacheKey = `${gameSlug}:${resourcePath}`;

    if (cacheKey === loadedPathRef.current && dataUrl) {
      return;
    }

    const cached = asfIconCache.get(cacheKey);
    if (cached) {
      loadedPathRef.current = cacheKey;
      setDataUrl(cached);
      return;
    }

    let cancelled = false;
    setIsLoading(true);
    setDataUrl(null);

    const loadIcon = async () => {
      try {
        await initWasm();
        if (cancelled) return;

        const url = buildResourceUrl(gameSlug, resourcePath);
        const response = await fetch(url);
        if (!response.ok || cancelled) return;

        const buffer = await response.arrayBuffer();
        if (cancelled) return;

        const decodedAsf = decodeAsfWasm(buffer);
        if (!decodedAsf || !decodedAsf.frames || decodedAsf.frames.length === 0 || cancelled)
          return;

        const canvas = getFrameCanvas(decodedAsf.frames[0]);
        if (!canvas || cancelled) return;

        const dataUrlResult = canvas.toDataURL();
        asfIconCache.set(cacheKey, dataUrlResult);
        loadedPathRef.current = cacheKey;
        setDataUrl(dataUrlResult);
      } catch {
        // ignore
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    loadIcon();

    return () => {
      cancelled = true;
    };
  }, [iconPath, gameSlug, dataUrl]);

  if (dataUrl) {
    return (
      <img
        src={dataUrl}
        alt=""
        className="flex-shrink-0 object-contain"
        style={{ ...sizeStyle, imageRendering: "pixelated" }}
      />
    );
  }

  if (isLoading) {
    return <span className="flex-shrink-0 animate-pulse bg-[#3c3c3c] rounded" style={sizeStyle} />;
  }

  // 默认图标
  return (
    <span className="flex-shrink-0 flex items-center justify-center text-[#888]" style={sizeStyle}>
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        style={{ width: size * 0.75, height: size * 0.75 }}
      >
        <path d="M12 2L4 7v10l8 5 8-5V7l-8-5z" />
        <circle cx="12" cy="12" r="3" />
      </svg>
    </span>
  );
}
