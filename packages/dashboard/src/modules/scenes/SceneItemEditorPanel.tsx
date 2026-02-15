/**
 * 场景子项编辑面板
 *
 * 统一处理 NPC / OBJ / 脚本 / 陷阱 四种模式。
 * - NPC / OBJ: 结构化条目列表（虚拟滚动 + 展开编辑）
 * - 脚本 / 陷阱: Monaco 文本编辑器
 *
 * 所有模式的 dirty 状态和数据均来自 SceneEntriesContext，保存策略统一。
 */

import { trpc, useToast } from "@miu2d/shared";
import type { SceneData, SceneNpcEntry, SceneObjEntry } from "@miu2d/types";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ScriptEditor } from "../../components/common/ScriptEditor";
import { DashboardIcons } from "../../icons";
import { useSceneEntries } from "./SceneEntriesContext";
import { NpcEntryEditor, ObjEntryEditor } from "./SceneEntryEditors";
import {
  createDefaultNpcEntry,
  createDefaultObjEntry,
  ITEM_HEIGHT,
  OVERSCAN,
} from "./scene-constants";

/**
 * 场景编辑面板 — 统一入口
 *
 * 当 kind 为 npc/obj 时渲染结构化列表；当 kind 为 script/trap 时渲染 Monaco 编辑器。
 * 数据全部来自 SceneEntriesContext，无本地状态，保存时回写 sceneData。
 */
export function SceneItemEditorPanel({
  kind,
  itemKey,
  sceneData,
  sceneId,
  gameId,
  gameSlug,
  mapFileName,
  onSaved,
  selectedIdx,
  onSelectIdx,
  onHoverEntry,
  onHoverLeave,
}: {
  kind: string;
  itemKey: string | null;
  sceneData: SceneData;
  sceneId: string;
  gameId: string;
  gameSlug: string;
  mapFileName: string;
  onSaved: () => void;
  selectedIdx?: number | null;
  onSelectIdx?: (idx: number | null) => void;
  onHoverEntry?: (mapX: number, mapY: number) => void;
  onHoverLeave?: () => void;
}) {
  const isStructured = kind === "npc" || kind === "obj";
  const isText = kind === "script" || kind === "trap";
  const updateMutation = trpc.scene.update.useMutation();
  const utils = trpc.useUtils();
  const navigate = useNavigate();
  const toast = useToast();
  const { gameId: routeGameId } = useParams();

  // 从 Context 获取对应类型的数据（唯一数据源）
  const ctx = useSceneEntries();

  // NPC/OBJ 结构化条目
  const entries = isStructured ? (kind === "npc" ? ctx.npcEntries : ctx.objEntries) : [];
  const setEntries = (kind === "npc" ? ctx.setNpcEntries : ctx.setObjEntries) as React.Dispatch<
    React.SetStateAction<(SceneNpcEntry | SceneObjEntry)[]>
  >;

  // 脚本/陷阱文本内容
  const textContent =
    kind === "script" ? ctx.scriptContent : kind === "trap" ? ctx.trapContent : "";
  const setTextContent = kind === "script" ? ctx.setScriptContent : ctx.setTrapContent;

  // dirty & markSaved — 四种类型统一分派
  const isDirty =
    kind === "npc"
      ? ctx.npcDirty
      : kind === "obj"
        ? ctx.objDirty
        : kind === "script"
          ? ctx.scriptDirty
          : ctx.trapDirty;

  const markSaved =
    kind === "npc"
      ? ctx.markNpcSaved
      : kind === "obj"
        ? ctx.markObjSaved
        : kind === "script"
          ? ctx.markScriptSaved
          : ctx.markTrapSaved;

  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState("");
  const [confirmDeleteFile, setConfirmDeleteFile] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleSave = async () => {
    if (!isDirty) return;
    setIsSaving(true);
    setSaveMessage("");
    try {
      const newData: SceneData = { ...sceneData };

      if (isStructured) {
        const fileKey = itemKey ?? "";
        if (kind === "npc") {
          newData.npc = {
            ...(sceneData.npc ?? {}),
            [fileKey]: { key: fileKey, entries: entries as SceneNpcEntry[] },
          };
        } else {
          newData.obj = {
            ...(sceneData.obj ?? {}),
            [fileKey]: { key: fileKey, entries: entries as SceneObjEntry[] },
          };
        }
      } else if (isText && itemKey) {
        const field = kind === "trap" ? "traps" : "scripts";
        // 大小写不敏感匹配实际 key（原系统文件名不区分大小写）
        const existingKeys = Object.keys(sceneData[field] ?? {});
        const resolvedKey =
          existingKeys.find((k) => k.toLowerCase() === itemKey.toLowerCase()) ?? itemKey;
        newData[field] = { ...(sceneData[field] ?? {}), [resolvedKey]: textContent };
      }

      await updateMutation.mutateAsync({
        gameId,
        id: sceneId,
        data: newData as Record<string, unknown>,
      });

      markSaved();
      setSaveMessage("已保存");
      onSaved();
      setTimeout(() => setSaveMessage(""), 2000);
    } catch (e) {
      setSaveMessage(`保存失败: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setIsSaving(false);
    }
  };

  /** 删除整个子项文件（从 scene.data JSONB 中移除该 key） */
  const handleDeleteFile = async () => {
    if (!itemKey) return;
    setIsDeleting(true);
    try {
      const newData: SceneData = { ...sceneData };
      if (kind === "script") {
        const { [itemKey]: _, ...rest } = sceneData.scripts ?? {};
        newData.scripts = rest;
      } else if (kind === "trap") {
        const { [itemKey]: _, ...rest } = sceneData.traps ?? {};
        newData.traps = rest;
      } else if (kind === "npc") {
        const { [itemKey]: _, ...rest } = sceneData.npc ?? {};
        newData.npc = rest;
      } else {
        const { [itemKey]: _, ...rest } = sceneData.obj ?? {};
        newData.obj = rest;
      }

      await updateMutation.mutateAsync({
        gameId,
        id: sceneId,
        data: newData as Record<string, unknown>,
      });

      toast.success(`已删除「${itemKey}」`);
      utils.scene.get.invalidate({ gameId, id: sceneId });
      utils.scene.list.invalidate({ gameId });
      onSaved();
      navigate(`/dashboard/${routeGameId}/scenes/${sceneId}`);
    } catch (e) {
      toast.error(`删除失败: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setIsDeleting(false);
      setConfirmDeleteFile(false);
    }
  };

  const updateEntry = (index: number, field: string, value: string | number) => {
    setEntries((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value } as SceneNpcEntry | SceneObjEntry;
      return next;
    });
  };

  const addEntry = () => {
    setEntries((prev) => [
      ...prev,
      kind === "npc" ? createDefaultNpcEntry() : createDefaultObjEntry(),
    ]);
  };

  const deleteEntry = (index: number) => {
    setEntries((prev) => prev.filter((_, i) => i !== index));
  };

  const setSelectedIdx = onSelectIdx ?? (() => {});

  const displayName = isStructured
    ? (itemKey ?? (kind === "npc" ? "NPC" : "OBJ"))
    : (itemKey ?? "");

  const kindLabel =
    kind === "npc" ? "NPC" : kind === "obj" ? "物件" : kind === "trap" ? "陷阱" : "脚本";

  // embedded = rendered inside a tab container (no width/border needed)
  const embedded = !!(onHoverEntry || onHoverLeave);

  // ===== 虚拟滚动 =====
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [containerHeight, setContainerHeight] = useState(0);
  const [expandedHeight, setExpandedHeight] = useState(0);
  const expandedRoRef = useRef<ResizeObserver | null>(null);

  const expandedRefCb = useCallback((el: HTMLDivElement | null) => {
    if (expandedRoRef.current) {
      expandedRoRef.current.disconnect();
      expandedRoRef.current = null;
    }
    if (!el) {
      setExpandedHeight(0);
      return;
    }
    setExpandedHeight(el.offsetHeight);
    const ro = new ResizeObserver((recs) => {
      for (const rec of recs) {
        setExpandedHeight(
          Math.round(rec.borderBoxSize?.[0]?.blockSize ?? rec.target.getBoundingClientRect().height)
        );
      }
    });
    ro.observe(el);
    expandedRoRef.current = ro;
  }, []);

  useEffect(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    setContainerHeight(el.clientHeight);
    const ro = new ResizeObserver(() => {
      if (scrollContainerRef.current) setContainerHeight(scrollContainerRef.current.clientHeight);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const handleVirtualScroll = useCallback(() => {
    if (scrollContainerRef.current) {
      setScrollTop(scrollContainerRef.current.scrollTop);
    }
  }, []);

  useEffect(() => {
    if (!isStructured) return;
    if (
      selectedIdx === null ||
      selectedIdx === undefined ||
      selectedIdx < 0 ||
      selectedIdx >= entries.length
    )
      return;
    const raf = requestAnimationFrame(() => {
      const container = scrollContainerRef.current;
      if (!container) return;
      const el = container.querySelector(`[data-entry-idx="${selectedIdx}"]`);
      if (el) {
        el.scrollIntoView({ block: "nearest", behavior: "smooth" });
      }
    });
    return () => cancelAnimationFrame(raf);
  }, [selectedIdx, entries.length, isStructured]);

  const getItemTop = useCallback(
    (i: number) => {
      if (
        selectedIdx === null ||
        selectedIdx === undefined ||
        selectedIdx < 0 ||
        selectedIdx >= entries.length
      ) {
        return i * ITEM_HEIGHT;
      }
      if (i <= selectedIdx) return i * ITEM_HEIGHT;
      return (
        selectedIdx * ITEM_HEIGHT +
        (expandedHeight || ITEM_HEIGHT) +
        (i - selectedIdx - 1) * ITEM_HEIGHT
      );
    },
    [selectedIdx, entries.length, expandedHeight]
  );

  const getItemHeight = useCallback(
    (i: number) => {
      if (i === selectedIdx && expandedHeight > 0) return expandedHeight;
      return ITEM_HEIGHT;
    },
    [selectedIdx, expandedHeight]
  );

  const { vStartIdx, vEndIdx, vTopPad, vTotalHeight } = useMemo(() => {
    const total = getItemTop(entries.length);
    if (entries.length === 0 || containerHeight === 0) {
      return { vStartIdx: 0, vEndIdx: entries.length, vTopPad: 0, vTotalHeight: total };
    }
    let start = 0;
    for (let i = 0; i < entries.length; i++) {
      if (getItemTop(i) + getItemHeight(i) > scrollTop) {
        start = i;
        break;
      }
    }
    start = Math.max(0, start - OVERSCAN);
    let end = entries.length;
    for (let i = start; i < entries.length; i++) {
      if (getItemTop(i) > scrollTop + containerHeight) {
        end = i;
        break;
      }
    }
    end = Math.min(entries.length, end + OVERSCAN);
    return { vStartIdx: start, vEndIdx: end, vTopPad: getItemTop(start), vTotalHeight: total };
  }, [entries.length, containerHeight, scrollTop, getItemTop, getItemHeight]);

  return (
    <div
      className={
        embedded
          ? "flex flex-col flex-1 min-h-0"
          : "w-[420px] bg-[#252526] border-l border-panel-border flex flex-col shrink-0"
      }
    >
      {/* 标题 */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-panel-border shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-[#858585] shrink-0">
            {isStructured ? DashboardIcons.file : DashboardIcons.script}
          </span>
          <span className="text-sm text-white truncate">{displayName}</span>
          {isDirty && <span className="text-xs text-yellow-400 shrink-0">●</span>}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {saveMessage && (
            <span
              className={`text-xs ${saveMessage.startsWith("已") ? "text-green-400" : "text-red-400"}`}
            >
              {saveMessage}
            </span>
          )}
          {itemKey && (
            <button
              type="button"
              onClick={() => setConfirmDeleteFile(true)}
              className="px-2 py-1 text-xs text-[#666] hover:text-red-400 transition-colors"
              title={`删除 ${itemKey}`}
            >
              {DashboardIcons.delete}
            </button>
          )}
          <button
            type="button"
            onClick={handleSave}
            disabled={!isDirty || isSaving}
            className="px-2 py-1 text-xs bg-[#0e639c] hover:bg-[#1177bb] disabled:opacity-30 disabled:cursor-not-allowed text-white rounded transition-colors"
          >
            {isSaving ? "保存中..." : "保存"}
          </button>
        </div>
      </div>

      {/* 删除确认条 */}
      {confirmDeleteFile && (
        <div className="flex items-center gap-2 px-3 py-2 bg-[#3c1f1f] border-b border-[#5c2020] shrink-0">
          <span className="text-xs text-red-300 flex-1 truncate">
            确认删除「{itemKey}」？此操作不可撤销
          </span>
          <button
            type="button"
            onClick={handleDeleteFile}
            disabled={isDeleting}
            className="px-2 py-0.5 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white rounded text-xs transition-colors"
          >
            {isDeleting ? "删除中..." : "确认删除"}
          </button>
          <button
            type="button"
            onClick={() => setConfirmDeleteFile(false)}
            className="px-2 py-0.5 text-xs text-[#999] hover:text-white transition-colors"
          >
            取消
          </button>
        </div>
      )}

      {/* 内容区域 */}
      <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
        {isStructured ? (
          <>
            {/* 固定表头 */}
            <div className="flex items-center justify-between px-3 py-1.5 bg-[#2d2d2d] border-b border-panel-border shrink-0">
              <span className="text-xs text-[#858585]">
                共 {entries.length} 个{kind === "npc" ? "NPC" : "物件"}
              </span>
              <button
                type="button"
                onClick={addEntry}
                className="flex items-center gap-1 px-2 py-0.5 text-xs bg-[#0e639c] hover:bg-[#1177bb] text-white rounded transition-colors"
              >
                + 新增
              </button>
            </div>

            {/* 虚拟滚动列表 */}
            <div
              ref={scrollContainerRef}
              className="flex-1 overflow-y-auto"
              onScroll={handleVirtualScroll}
            >
              {entries.length > 0 ? (
                <div style={{ height: vTotalHeight, position: "relative" }}>
                  <div style={{ position: "absolute", top: vTopPad, left: 0, right: 0 }}>
                    {entries.slice(vStartIdx, vEndIdx).map((entry, i) => {
                      const idx = vStartIdx + i;
                      const isExpanded = (selectedIdx ?? null) === idx;
                      return (
                        <div
                          key={idx}
                          data-entry-idx={idx}
                          ref={isExpanded ? expandedRefCb : undefined}
                          className="border-b border-panel-border cursor-pointer transition-colors"
                          onMouseEnter={() => onHoverEntry?.(entry.mapX, entry.mapY)}
                          onMouseLeave={() => onHoverLeave?.()}
                        >
                          <div
                            className={`flex items-center justify-between px-3 py-1.5 ${
                              isExpanded ? "bg-[#094771]" : "hover:bg-[#2a2d2e]"
                            }`}
                            onClick={() => setSelectedIdx(isExpanded ? null : idx)}
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="text-xs text-[#555] w-5 text-right shrink-0">
                                {idx}
                              </span>
                              <span className="text-sm text-[#cccccc] truncate">
                                {kind === "npc"
                                  ? (entry as SceneNpcEntry).name || "(未命名)"
                                  : (entry as SceneObjEntry).objName || "(未命名)"}
                              </span>
                              <span className="text-xs text-[#666]">
                                ({entry.mapX},{entry.mapY})
                              </span>
                            </div>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                deleteEntry(idx);
                              }}
                              className="p-0.5 text-[#555] hover:text-red-400 transition-colors shrink-0"
                              title="删除"
                            >
                              {DashboardIcons.close}
                            </button>
                          </div>

                          {isExpanded && (
                            <div
                              className="px-3 pb-2 pt-1.5 space-y-1.5 bg-[#1e1e1e]"
                              onClick={(e) => e.stopPropagation()}
                            >
                              {kind === "npc" ? (
                                <NpcEntryEditor
                                  entry={entry as SceneNpcEntry}
                                  onChange={(f, v) => updateEntry(idx, f, v)}
                                  gameId={gameId}
                                  gameSlug={gameSlug}
                                  sceneData={sceneData}
                                />
                              ) : (
                                <ObjEntryEditor
                                  entry={entry as SceneObjEntry}
                                  onChange={(f, v) => updateEntry(idx, f, v)}
                                  gameId={gameId}
                                  gameSlug={gameSlug}
                                  sceneData={sceneData}
                                />
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-8 text-[#858585]">
                  <p className="text-sm mb-2">暂无{kind === "npc" ? "NPC" : "物件"}</p>
                  <button
                    type="button"
                    onClick={addEntry}
                    className="text-xs text-[#0098ff] hover:underline"
                  >
                    点击新增
                  </button>
                </div>
              )}
            </div>
          </>
        ) : (
          /* 脚本/陷阱：Monaco 编辑器 */
          <ScriptEditor
            value={textContent}
            onChange={(v) => setTextContent(v)}
            height="100%"
            minimap={false}
            fontSize={13}
            className="flex-1"
          />
        )}
      </div>

      {/* 状态栏 */}
      <div className="flex items-center justify-between px-3 py-1 border-t border-panel-border text-xs text-[#858585] shrink-0">
        <span>{kindLabel}</span>
        <span>{itemKey ?? ""}</span>
      </div>
    </div>
  );
}
