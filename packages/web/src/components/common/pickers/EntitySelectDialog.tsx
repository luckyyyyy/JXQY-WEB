/**
 * NPC / OBJ 实体选择弹窗
 *
 * 从数据库中选择 NPC 或 OBJ，带搜索过滤和 ASF 图标预览。
 * 用于场景编辑器中右键添加 NPC/OBJ 等场景。
 */
import type { NpcListItem, ObjListItem } from "@miu2d/types";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { trpc } from "../../../lib/trpc";
import { LazyAsfIcon } from "../LazyAsfIcon";

const NPC_RELATION_COLORS: Record<string, string> = {
  Friendly: "#4caf50",
  Hostile: "#f44336",
  Neutral: "#ffb300",
  Partner: "#42a5f5",
};

const NPC_RELATION_LABELS: Record<string, string> = {
  Friendly: "友好",
  Hostile: "敌对",
  Neutral: "中立",
  Partner: "伙伴",
};

const NPC_KIND_LABELS: Record<string, string> = {
  Normal: "普通",
  Fighter: "战斗",
};

const OBJ_KIND_LABELS: Record<string, string> = {
  Static: "静态",
  Dynamic: "动态",
  Body: "尸体",
  LoopingSound: "循环音效",
  RandSound: "随机音效",
  Door: "门",
  Trap: "陷阱",
  Drop: "掉落",
};

export interface EntitySelectDialogProps {
  /** 实体类型 */
  kind: "npc" | "obj";
  /** 是否打开 */
  open: boolean;
  /** 关闭回调 */
  onClose: () => void;
  /** 选中回调 */
  onSelect: (entity: NpcListItem | ObjListItem) => void;
  /** 游戏 ID */
  gameId: string;
  /** 游戏 slug（用于图标） */
  gameSlug?: string;
  /** 弹窗标题（默认根据 kind 自动生成） */
  title?: string;
}

export function EntitySelectDialog({
  kind,
  open,
  onClose,
  onSelect,
  gameId,
  gameSlug,
  title,
}: EntitySelectDialogProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const { data: npcList, isLoading: npcLoading } = trpc.npc.list.useQuery(
    { gameId },
    { enabled: open && !!gameId && kind === "npc" },
  );
  const { data: objList, isLoading: objLoading } = trpc.obj.list.useQuery(
    { gameId },
    { enabled: open && !!gameId && kind === "obj" },
  );

  const isLoading = kind === "npc" ? npcLoading : objLoading;

  const filteredItems = useMemo(() => {
    const items = kind === "npc" ? (npcList ?? []) : (objList ?? []);
    if (!searchQuery) return items;
    const q = searchQuery.toLowerCase();
    return items.filter(
      (item) =>
        item.name.toLowerCase().includes(q) || item.key.toLowerCase().includes(q),
    );
  }, [kind, npcList, objList, searchQuery]);

  // 重置状态
  useEffect(() => {
    if (!open) {
      setSearchQuery("");
      setSelectedId(null);
    }
  }, [open]);

  const handleConfirm = useCallback(() => {
    if (!selectedId) return;
    const items = kind === "npc" ? (npcList ?? []) : (objList ?? []);
    const entity = items.find((e) => e.id === selectedId);
    if (entity) onSelect(entity);
  }, [selectedId, kind, npcList, objList, onSelect]);

  // 键盘事件
  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "Enter" && selectedId) handleConfirm();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, selectedId, onClose, handleConfirm]);

  if (!open) return null;

  const dialogTitle = title ?? (kind === "npc" ? "选择 NPC" : "选择 OBJ");
  const iconPrefix = kind === "npc" ? "asf/character/" : "asf/object/";
  const iconFallback = kind === "npc" ? "🧙" : "📦";

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
      onClick={onClose}
    >
      <div
        className="w-[500px] min-h-[350px] max-h-[80vh] bg-[#1e1e1e] border border-[#454545] rounded-lg shadow-2xl flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 标题栏 */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#454545] bg-[#252526]">
          <h2 className="text-white font-medium">{dialogTitle}</h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded hover:bg-[#3c3c3c] text-[#808080] hover:text-white"
          >
            ✕
          </button>
        </div>

        {/* 搜索栏 */}
        <div className="px-4 py-2 border-b border-[#454545]">
          <input
            type="text"
            placeholder={`搜索${kind === "npc" ? "NPC" : "OBJ"}名称或标识...`}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full px-3 py-2 bg-[#3c3c3c] border border-[#454545] rounded text-white text-sm focus:outline-none focus:border-[#0e639c]"
            autoFocus
          />
        </div>

        {/* 列表 */}
        <div ref={listRef} className="flex-1 min-h-[200px] overflow-auto p-2">
          {isLoading ? (
            <div className="flex items-center justify-center py-8 text-[#808080]">
              <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mr-2" />
              加载中...
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="text-center py-8 text-[#808080]">
              {searchQuery ? "没有匹配项" : `暂无${kind === "npc" ? "NPC" : "OBJ"}数据`}
            </div>
          ) : (
            <div className="space-y-0.5">
              {filteredItems.map((item) => {
                const isSelected = selectedId === item.id;
                return (
                  <div
                    key={item.id}
                    className={`flex items-center px-3 py-2 rounded cursor-pointer select-none ${
                      isSelected
                        ? "bg-[#0e639c] text-white"
                        : "hover:bg-[#2a2d2e] text-[#cccccc]"
                    }`}
                    onClick={() => setSelectedId(item.id)}
                    onDoubleClick={() => onSelect(item)}
                  >
                    {/* 图标 */}
                    <div className="w-8 h-8 mr-2 flex-shrink-0 flex items-center justify-center">
                      <LazyAsfIcon
                        iconPath={item.icon ?? undefined}
                        gameSlug={gameSlug}
                        size={28}
                        prefix={iconPrefix}
                        fallback={iconFallback}
                      />
                    </div>

                    {/* NPC: 关系颜色指示器 */}
                    {kind === "npc" && (
                      <span
                        className="w-2 h-2 rounded-full shrink-0 mr-2"
                        style={{
                          backgroundColor:
                            NPC_RELATION_COLORS[(item as NpcListItem).relation] ?? "#999",
                        }}
                        title={
                          NPC_RELATION_LABELS[(item as NpcListItem).relation] ??
                          (item as NpcListItem).relation
                        }
                      />
                    )}

                    {/* 名称和 key */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span
                          className={`text-sm font-medium truncate ${isSelected ? "text-white" : "text-[#cccccc]"}`}
                        >
                          {item.name}
                        </span>
                        <span
                          className={`text-[10px] px-1.5 py-0.5 rounded ${
                            isSelected
                              ? "bg-white/20 text-white/80"
                              : "bg-[#3c3c3c] text-[#999]"
                          }`}
                        >
                          {kind === "npc"
                            ? (NPC_KIND_LABELS[item.kind] ?? item.kind)
                            : (OBJ_KIND_LABELS[item.kind] ?? item.kind)}
                        </span>
                      </div>
                      <div
                        className={`text-xs truncate ${isSelected ? "text-white/70" : "text-[#808080]"}`}
                      >
                        {item.key}
                      </div>
                    </div>

                    {/* NPC: 等级 */}
                    {kind === "npc" && (item as NpcListItem).level != null && (
                      <span
                        className={`text-xs shrink-0 ml-2 ${isSelected ? "text-white/70" : "text-[#569cd6]"}`}
                      >
                        Lv.{(item as NpcListItem).level}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* 底部栏 */}
        <div className="flex items-center justify-between px-4 py-3 border-t border-[#454545] bg-[#252526]">
          <span className="text-xs text-[#808080]">{filteredItems.length} 项可选</span>
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
              disabled={!selectedId}
              className="px-4 py-2 text-sm bg-[#0e639c] hover:bg-[#1177bb] text-white rounded disabled:opacity-50 disabled:cursor-not-allowed"
            >
              选择
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
