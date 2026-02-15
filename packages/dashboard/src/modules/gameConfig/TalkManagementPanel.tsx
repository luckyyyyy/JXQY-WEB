/**
 * 对话管理面板
 * TalkIndex.txt 的图形化编辑器
 *
 * 功能：
 * - 上传 TalkIndex.txt 自动解析导入
 * - 虚拟滚动列表（支持数千条对话）
 * - 显示对话头像和文本内容
 * - 增删改查对话条目
 * - 搜索和筛选
 * - 导出为 TalkIndex.txt
 */

import { trpc, useToast } from "@miu2d/shared";
import type { TalkEntry } from "@miu2d/types";
import { exportTalkIndexTxt, extractSpeakerName } from "@miu2d/types";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MiniAsfPreview } from "../../components/common/ResourceFilePicker/AsfPreviewTooltip";
import { buildResourcePath } from "../../components/common/ResourceFilePicker/types";
import { useDashboard } from "../../DashboardContext";

// ========== 常量 ==========

const ROW_HEIGHT = 72;
const OVERSCAN = 10;

// ========== 对话文本渲染（支持颜色标签） ==========

function renderTalkText(text: string): React.ReactNode {
  // 解析 <color=xxx>text<color=yyy> 格式
  const parts: React.ReactNode[] = [];
  const regex = /<color=(\w+)>/gi;
  let lastIndex = 0;
  let currentColor = "inherit";
  let match: RegExpExecArray | null;
  let key = 0;

  while ((match = regex.exec(text)) !== null) {
    // 前序文本
    if (match.index > lastIndex) {
      const segment = text.slice(lastIndex, match.index);
      parts.push(
        <span key={key++} style={{ color: currentColor === "inherit" ? undefined : currentColor }}>
          {segment}
        </span>
      );
    }
    // 更新颜色
    const colorName = match[1].toLowerCase();
    const colorMap: Record<string, string> = {
      red: "#ef4444",
      blue: "#60a5fa",
      green: "#34d399",
      yellow: "#fbbf24",
      black: "inherit",
      white: "#ffffff",
      cyan: "#22d3ee",
      magenta: "#c084fc",
    };
    currentColor = colorMap[colorName] ?? colorName;
    lastIndex = regex.lastIndex;
  }

  // 剩余文本
  if (lastIndex < text.length) {
    const segment = text.slice(lastIndex);
    parts.push(
      <span key={key++} style={{ color: currentColor === "inherit" ? undefined : currentColor }}>
        {segment}
      </span>
    );
  }

  return parts.length > 0 ? parts : text;
}

// ========== 头像预览组件 ==========

const PortraitPreview = memo(function PortraitPreview({
  portraitIndex,
  portraitMap,
  gameSlug,
  size = 40,
}: {
  portraitIndex: number;
  portraitMap: Map<number, string>;
  gameSlug: string;
  size?: number;
}) {
  const asfFile = portraitMap.get(portraitIndex);

  if (!asfFile) {
    return (
      <div
        className="flex-shrink-0 rounded bg-[#1e1e1e] border border-panel-border flex items-center justify-center text-[#555] text-xs font-mono"
        style={{ width: size, height: size }}
      >
        {portraitIndex}
      </div>
    );
  }

  return (
    <div
      className="flex-shrink-0 rounded bg-[#1e1e1e] border border-panel-border overflow-hidden"
      style={{ width: size, height: size }}
      title={`头像 #${portraitIndex}: ${asfFile}`}
    >
      <MiniAsfPreview
        gameSlug={gameSlug}
        path={buildResourcePath("portrait_image", asfFile)}
        size={size}
      />
    </div>
  );
});

// ========== 对话行组件 ==========

const TalkRow = memo(function TalkRow({
  entry,
  portraitMap,
  gameSlug,
  isSelected,
  onSelect,
  onEdit,
  onDelete,
}: {
  entry: TalkEntry;
  portraitMap: Map<number, string>;
  gameSlug: string;
  isSelected: boolean;
  onSelect: (id: number) => void;
  onEdit: (entry: TalkEntry) => void;
  onDelete: (id: number) => void;
}) {
  const speaker = extractSpeakerName(entry.text);

  return (
    <div
      className={`flex items-center gap-3 px-4 h-[72px] border-b border-[#2a2a2a] cursor-pointer transition-colors group ${
        isSelected ? "bg-[#094771] hover:bg-[#0a5181]" : "hover:bg-[#2a2d2e]"
      }`}
      onClick={() => onSelect(entry.id)}
      onDoubleClick={() => onEdit(entry)}
    >
      {/* 头像 */}
      <PortraitPreview
        portraitIndex={entry.portraitIndex}
        portraitMap={portraitMap}
        gameSlug={gameSlug}
        size={40}
      />

      {/* 内容 */}
      <div className="flex-1 min-w-0 flex flex-col gap-0.5">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-mono text-[#666] shrink-0">#{entry.id}</span>
          {speaker && (
            <span className="text-xs font-medium text-[#4fc1ff] truncate">{speaker}</span>
          )}
          <span className="text-[10px] text-[#555] shrink-0 ml-auto">
            头像 {entry.portraitIndex}
          </span>
        </div>
        <div className="text-sm text-[#ccc] truncate leading-snug">
          {renderTalkText(entry.text)}
        </div>
      </div>

      {/* 操作按钮 */}
      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onEdit(entry);
          }}
          className="w-6 h-6 flex items-center justify-center rounded hover:bg-[#3c3c3c] text-[#808080] hover:text-[#ccc]"
          title="编辑"
        >
          <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="currentColor">
            <path d="M13.23 1h-1.46L3.52 9.25l-.16.22L1 13.59 2.41 15l4.12-2.36.22-.16L15 4.23V2.77L13.23 1zM2.41 13.59l1.51-3 1.45 1.45-2.96 1.55zm3.83-2.06L4.47 9.76l8-8 1.77 1.77-8 8z" />
          </svg>
        </button>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onDelete(entry.id);
          }}
          className="w-6 h-6 flex items-center justify-center rounded hover:bg-[#3c3c3c] text-[#808080] hover:text-red-400"
          title="删除"
        >
          <svg
            className="w-3.5 h-3.5"
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
          >
            <path d="M4 4l8 8M12 4l-8 8" />
          </svg>
        </button>
      </div>
    </div>
  );
});

// ========== 编辑对话框 ==========

function TalkEditDialog({
  entry,
  portraitMap,
  gameSlug,
  onSave,
  onCancel,
  isNew,
}: {
  entry: TalkEntry;
  portraitMap: Map<number, string>;
  gameSlug: string;
  onSave: (entry: TalkEntry) => void;
  onCancel: () => void;
  isNew?: boolean;
}) {
  const [id, setId] = useState(entry.id);
  const [portraitIndex, setPortraitIndex] = useState(entry.portraitIndex);
  const [text, setText] = useState(entry.text);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({ id, portraitIndex, text });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <form
        onSubmit={handleSubmit}
        className="bg-[#252526] rounded-lg shadow-2xl border border-widget-border w-[640px] max-h-[90vh] flex flex-col"
      >
        {/* 标题 */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-widget-border">
          <h3 className="text-sm font-medium text-white">
            {isNew ? "新建对话" : `编辑对话 #${entry.id}`}
          </h3>
          <button
            type="button"
            onClick={onCancel}
            className="w-6 h-6 flex items-center justify-center rounded hover:bg-[#3c3c3c] text-[#808080] hover:text-white"
          >
            ✕
          </button>
        </div>

        {/* 表单 */}
        <div className="p-5 space-y-4 overflow-y-auto">
          <div className="flex gap-4">
            {/* ID */}
            <div className="flex flex-col gap-1">
              <label className="text-xs text-[#858585]">对话 ID</label>
              <input
                type="number"
                min={0}
                value={id}
                onChange={(e) => setId(parseInt(e.target.value, 10) || 0)}
                disabled={!isNew}
                className="w-24 px-2 py-1.5 bg-[#1e1e1e] border border-widget-border rounded text-sm text-white disabled:opacity-50 focus:border-[#0078d4] outline-none"
              />
            </div>

            {/* 头像索引 */}
            <div className="flex flex-col gap-1">
              <label className="text-xs text-[#858585]">头像索引</label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={0}
                  value={portraitIndex}
                  onChange={(e) => setPortraitIndex(parseInt(e.target.value, 10) || 0)}
                  className="w-20 px-2 py-1.5 bg-[#1e1e1e] border border-widget-border rounded text-sm text-white focus:border-[#0078d4] outline-none"
                />
                <PortraitPreview
                  portraitIndex={portraitIndex}
                  portraitMap={portraitMap}
                  gameSlug={gameSlug}
                  size={32}
                />
              </div>
            </div>
          </div>

          {/* 文本内容 */}
          <div className="flex flex-col gap-1">
            <label className="text-xs text-[#858585]">对话文本</label>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={4}
              className="w-full px-3 py-2 bg-[#1e1e1e] border border-widget-border rounded text-sm text-white focus:border-[#0078d4] outline-none resize-y font-mono"
              placeholder="输入对话文本，支持 <color=Red>彩色文字<color=Black> 标签"
            />
          </div>

          {/* 预览 */}
          <div className="flex flex-col gap-1">
            <label className="text-xs text-[#858585]">预览</label>
            <div className="flex items-start gap-3 p-3 bg-[#1e1e1e] rounded border border-panel-border">
              <PortraitPreview
                portraitIndex={portraitIndex}
                portraitMap={portraitMap}
                gameSlug={gameSlug}
                size={48}
              />
              <div className="text-sm text-[#ccc] leading-relaxed flex-1">
                {renderTalkText(text)}
              </div>
            </div>
          </div>
        </div>

        {/* 按钮 */}
        <div className="flex justify-end gap-2 px-5 py-3 border-t border-widget-border">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-1.5 text-sm text-[#ccc] hover:bg-[#3c3c3c] rounded transition-colors"
          >
            取消
          </button>
          <button
            type="submit"
            className="px-4 py-1.5 text-sm bg-[#0e639c] hover:bg-[#1177bb] text-white rounded transition-colors"
          >
            {isNew ? "创建" : "保存"}
          </button>
        </div>
      </form>
    </div>
  );
}

// ========== 虚拟列表组件 ==========

function VirtualTalkList({
  entries,
  portraitMap,
  gameSlug,
  selectedId,
  onSelect,
  onEdit,
  onDelete,
}: {
  entries: TalkEntry[];
  portraitMap: Map<number, string>;
  gameSlug: string;
  selectedId: number | null;
  onSelect: (id: number) => void;
  onEdit: (entry: TalkEntry) => void;
  onDelete: (id: number) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [containerHeight, setContainerHeight] = useState(600);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setContainerHeight(entry.contentRect.height);
      }
    });

    observer.observe(container);
    setContainerHeight(container.clientHeight);

    return () => observer.disconnect();
  }, []);

  const handleScroll = useCallback(() => {
    if (containerRef.current) {
      setScrollTop(containerRef.current.scrollTop);
    }
  }, []);

  const totalHeight = entries.length * ROW_HEIGHT;
  const startIdx = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - OVERSCAN);
  const endIdx = Math.min(
    entries.length,
    Math.ceil((scrollTop + containerHeight) / ROW_HEIGHT) + OVERSCAN
  );
  const offsetY = startIdx * ROW_HEIGHT;
  const visibleEntries = entries.slice(startIdx, endIdx);

  return (
    <div ref={containerRef} className="flex-1 overflow-y-auto" onScroll={handleScroll}>
      <div style={{ height: totalHeight, position: "relative" }}>
        <div style={{ position: "absolute", top: offsetY, left: 0, right: 0 }}>
          {visibleEntries.map((entry) => (
            <TalkRow
              key={entry.id}
              entry={entry}
              portraitMap={portraitMap}
              gameSlug={gameSlug}
              isSelected={selectedId === entry.id}
              onSelect={onSelect}
              onEdit={onEdit}
              onDelete={onDelete}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

// ========== 主面板 ==========

export function TalkManagementPanel({ gameId }: { gameId: string }) {
  const toast = useToast();
  const utils = trpc.useUtils();
  const { currentGame } = useDashboard();
  const gameSlug = currentGame?.slug ?? "";

  // 状态
  const [entries, setEntries] = useState<TalkEntry[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [portraitFilter, setPortraitFilter] = useState<number | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [editingEntry, setEditingEntry] = useState<TalkEntry | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  // 查询对话数据
  const { data: talkData, isLoading } = trpc.talk.get.useQuery({ gameId }, { enabled: !!gameId });

  // 查询头像映射
  const { data: portraitData } = trpc.talkPortrait.get.useQuery({ gameId }, { enabled: !!gameId });

  // 头像映射表
  const portraitMap = useMemo(() => {
    const map = new Map<number, string>();
    if (portraitData?.entries) {
      for (const e of portraitData.entries) {
        map.set(e.idx, e.file);
      }
    }
    return map;
  }, [portraitData]);

  // 同步数据
  useEffect(() => {
    if (talkData?.entries) {
      setEntries(talkData.entries);
    }
  }, [talkData]);

  // 过滤后的条目
  const filteredEntries = useMemo(() => {
    let result = entries;

    if (portraitFilter !== null) {
      result = result.filter((e) => e.portraitIndex === portraitFilter);
    }

    if (searchQuery) {
      // 支持范围搜索：Talk(14050,14090) 或 14050,14090
      const rangeMatch = searchQuery.match(/^(?:Talk\s*\(\s*)?(\d+)\s*,\s*(\d+)\s*\)?;?\s*$/i);
      if (rangeMatch) {
        const start = parseInt(rangeMatch[1], 10);
        const end = parseInt(rangeMatch[2], 10);
        const lo = Math.min(start, end);
        const hi = Math.max(start, end);
        result = result.filter((e) => e.id >= lo && e.id <= hi);
      } else {
        const q = searchQuery.toLowerCase();
        result = result.filter(
          (e) => e.text.toLowerCase().includes(q) || e.id.toString().includes(q)
        );
      }
    }

    return result;
  }, [entries, searchQuery, portraitFilter]);

  // 角色列表（从对话中提取）
  const speakerList = useMemo(() => {
    const speakers = new Map<number, string>();
    for (const e of entries) {
      if (!speakers.has(e.portraitIndex)) {
        const name = extractSpeakerName(e.text);
        if (name) {
          speakers.set(e.portraitIndex, name);
        }
      }
    }
    return Array.from(speakers.entries()).sort((a, b) => a[0] - b[0]);
  }, [entries]);

  // tRPC mutations
  const updateMutation = trpc.talk.update.useMutation({
    onSuccess: () => {
      toast.success("对话数据已保存");
      utils.talk.get.invalidate({ gameId });
    },
    onError: (err) => toast.error(`保存失败: ${err.message}`),
  });

  const importMutation = trpc.talk.importFromTxt.useMutation({
    onSuccess: (result) => {
      setEntries(result.entries);
      toast.success(`成功导入 ${result.entries.length} 条对话`);
      utils.talk.get.invalidate({ gameId });
    },
    onError: (err) => toast.error(`导入失败: ${err.message}`),
  });

  // 操作处理
  const handleImportTxt = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".txt";
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      const content = await file.text();
      importMutation.mutate({ gameId, content });
    };
    input.click();
  };

  const handleExportTxt = () => {
    const content = exportTalkIndexTxt(entries);
    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "TalkIndex.txt";
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleCreate = () => {
    const maxId = entries.reduce((max, e) => Math.max(max, e.id), -1);
    setEditingEntry({ id: maxId + 1, portraitIndex: 0, text: "" });
    setIsCreating(true);
  };

  const handleEdit = useCallback((entry: TalkEntry) => {
    setEditingEntry({ ...entry });
    setIsCreating(false);
  }, []);

  const handleSaveEntry = (entry: TalkEntry) => {
    if (isCreating) {
      // 添加新条目
      const existing = entries.find((e) => e.id === entry.id);
      if (existing) {
        toast.error(`对话 ID ${entry.id} 已存在`);
        return;
      }
      const newEntries = [...entries, entry].sort((a, b) => a.id - b.id);
      setEntries(newEntries);
      updateMutation.mutate({ gameId, entries: newEntries });
    } else {
      // 更新现有条目
      const newEntries = entries.map((e) => (e.id === entry.id ? entry : e));
      setEntries(newEntries);
      updateMutation.mutate({ gameId, entries: newEntries });
    }
    setEditingEntry(null);
    setIsCreating(false);
  };

  const handleDelete = useCallback(
    (id: number) => {
      const newEntries = entries.filter((e) => e.id !== id);
      setEntries(newEntries);
      updateMutation.mutate({ gameId, entries: newEntries });
      if (selectedId === id) setSelectedId(null);
    },
    [entries, gameId, selectedId, updateMutation]
  );

  const handleSelect = useCallback((id: number) => {
    setSelectedId((prev) => (prev === id ? null : id));
  }, []);

  // 拖拽导入
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.types.includes("Files")) setIsDragging(true);
  };
  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };
  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = Array.from(e.dataTransfer.files);
    const txtFile = files.find((f) => f.name.toLowerCase().endsWith(".txt"));
    if (!txtFile) {
      toast.error("请拖入 .txt 文件");
      return;
    }
    const content = await txtFile.text();
    importMutation.mutate({ gameId, content });
  };

  if (isLoading) {
    return <div className="flex items-center justify-center h-full text-[#858585]">加载中...</div>;
  }

  return (
    <div
      className="flex flex-col h-full relative"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* 拖拽覆盖层 */}
      {isDragging && (
        <div className="absolute inset-0 z-10 bg-[#0098ff]/10 border-2 border-dashed border-[#0098ff] rounded-lg flex items-center justify-center pointer-events-none">
          <div className="text-[#0098ff] text-sm font-medium bg-[#252526] px-4 py-2 rounded-lg shadow-lg">
            释放 TalkIndex.txt 文件以导入对话数据
          </div>
        </div>
      )}

      {/* 工具栏 */}
      <div className="flex-shrink-0 flex items-center gap-2 px-4 py-2 border-b border-panel-border bg-[#1e1e1e]">
        {/* 搜索框 */}
        <div className="flex-1 relative max-w-xs">
          <svg
            className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#666]"
            viewBox="0 0 16 16"
            fill="currentColor"
          >
            <path d="M11.742 10.344a6.5 6.5 0 10-1.397 1.398h-.001c.03.04.062.078.098.115l3.85 3.85a1 1 0 001.415-1.414l-3.85-3.85a1.007 1.007 0 00-.115-.1zM12 6.5a5.5 5.5 0 11-11 0 5.5 5.5 0 0111 0z" />
          </svg>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="搜索内容/ID 或范围 Talk(14050,14090)"
            className="w-full pl-8 pr-3 py-1.5 bg-[#2a2d2e] border border-widget-border rounded text-xs text-white placeholder:text-[#666] focus:border-[#0078d4] outline-none"
          />
        </div>

        {/* 角色筛选 */}
        <select
          value={portraitFilter ?? ""}
          onChange={(e) => setPortraitFilter(e.target.value ? parseInt(e.target.value, 10) : null)}
          className="px-2 py-1.5 bg-[#2a2d2e] border border-widget-border rounded text-xs text-white focus:border-[#0078d4] outline-none"
        >
          <option value="">全部角色</option>
          <option value="0">旁白 (0)</option>
          {speakerList.map(([idx, name]) => (
            <option key={idx} value={idx}>
              {name} ({idx})
            </option>
          ))}
        </select>

        <div className="w-px h-5 bg-[#3c3c3c]" />

        {/* 操作按钮 */}
        <button
          type="button"
          onClick={handleImportTxt}
          disabled={importMutation.isPending}
          className="px-2.5 py-1.5 text-xs bg-[#3c3c3c] hover:bg-[#4c4c4c] rounded text-[#ccc] transition-colors disabled:opacity-50"
        >
          {importMutation.isPending ? "导入中..." : "导入 TXT"}
        </button>
        <button
          type="button"
          onClick={handleExportTxt}
          disabled={entries.length === 0}
          className="px-2.5 py-1.5 text-xs bg-[#3c3c3c] hover:bg-[#4c4c4c] rounded text-[#ccc] transition-colors disabled:opacity-50"
        >
          导出 TXT
        </button>
        <button
          type="button"
          onClick={handleCreate}
          className="px-2.5 py-1.5 text-xs bg-[#0e639c] hover:bg-[#1177bb] rounded text-white transition-colors"
        >
          + 新建
        </button>

        {/* 统计 */}
        <span className="text-[10px] text-[#666] ml-auto">
          {filteredEntries.length === entries.length
            ? `共 ${entries.length} 条`
            : `${filteredEntries.length} / ${entries.length} 条`}
        </span>
      </div>

      {/* 对话列表 */}
      {entries.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-[#858585] gap-3 p-8">
          <svg
            className="w-16 h-16 text-[#3c3c3c]"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1"
          >
            <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
          </svg>
          <p className="text-sm">暂无对话数据</p>
          <p className="text-xs text-[#666]">拖入 TalkIndex.txt 文件或点击「导入 TXT」按钮</p>
        </div>
      ) : (
        <VirtualTalkList
          entries={filteredEntries}
          portraitMap={portraitMap}
          gameSlug={gameSlug}
          selectedId={selectedId}
          onSelect={handleSelect}
          onEdit={handleEdit}
          onDelete={handleDelete}
        />
      )}

      {/* 编辑对话框 */}
      {editingEntry && (
        <TalkEditDialog
          entry={editingEntry}
          portraitMap={portraitMap}
          gameSlug={gameSlug}
          onSave={handleSaveEntry}
          onCancel={() => {
            setEditingEntry(null);
            setIsCreating(false);
          }}
          isNew={isCreating}
        />
      )}
    </div>
  );
}
