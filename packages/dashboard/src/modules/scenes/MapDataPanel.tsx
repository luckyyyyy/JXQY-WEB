/**
 * 地图数据面板 - 显示在 MapViewer 侧边栏的"地图"tab 中
 *
 * 功能：
 * - 显示 trapTable（陷阱索引 ↔ 脚本路径映射）
 * - 标记关联脚本文件是否存在（⚠ 图标）
 * - 点击映射弹出选择脚本文件弹窗
 * - 两种删除：删除映射（仅移除 trapTable 条目） / 删除陷阱（清除 trapTable + 瓦片）
 * - 所有修改仅更新本地状态，不自动保存
 */
import type { MiuMapData } from "@miu2d/engine/map/types";
import type { SceneData } from "@miu2d/types";
import { useCallback, useMemo, useState } from "react";
import { FileSelectDialog } from "../../components/common/ResourceFilePicker/FileSelectDialog";
import { ScriptPreviewTooltip } from "../../components/common/ResourceFilePicker/ScriptPreviewTooltip";
import { ConfirmDialog } from "../fileTree/Dialogs";

interface MapDataPanelProps {
  mapData: MiuMapData | null;
  sceneData: SceneData;
  onMapDataChanged: (newMapData: MiuMapData) => void;
  onTrapSelect: (trapIndex: number) => void;
  gameId: string;
  gameSlug: string;
}

export function MapDataPanel({
  mapData,
  sceneData,
  onMapDataChanged,
  onTrapSelect,
  gameId,
  gameSlug,
}: MapDataPanelProps) {
  // ── 脚本选择器弹窗 ──
  const [scriptPickerIdx, setScriptPickerIdx] = useState<number | null>(null);
  const [scriptTab, setScriptTab] = useState<"map" | "public">("map");
  const [mapScriptSearch, setMapScriptSearch] = useState("");
  const [hoverMapScript, setHoverMapScript] = useState<{
    name: string;
    position: { x: number; y: number };
  } | null>(null);
  const [selectedMapScript, setSelectedMapScript] = useState<string | null>(null);

  // ── 删除确认弹窗 ──
  const [confirmDelete, setConfirmDelete] = useState<{
    idx: number;
    mode: "mapping" | "trap" | "orphan";
    trapIndex?: number; // orphan 模式使用
  } | null>(null);

  // 可供选择的脚本文件列表（来自 sceneData.traps + sceneData.scripts）
  const availableScripts = useMemo(() => {
    const scripts: string[] = [];
    const seen = new Set<string>();
    if (sceneData.traps) {
      for (const key of Object.keys(sceneData.traps)) {
        scripts.push(key);
        seen.add(key.toLowerCase());
      }
    }
    if (sceneData.scripts) {
      for (const key of Object.keys(sceneData.scripts)) {
        // 不区分大小写去重（原系统文件名不区分大小写）
        if (!seen.has(key.toLowerCase())) {
          scripts.push(key);
          seen.add(key.toLowerCase());
        }
      }
    }
    return scripts.sort();
  }, [sceneData.traps, sceneData.scripts]);

  // 构建大小写不敏感的查找：lowercase → 原始 key
  const trapKeysLower = useMemo(() => {
    const map = new Map<string, string>();
    if (sceneData.traps) {
      for (const key of Object.keys(sceneData.traps)) {
        map.set(key.toLowerCase(), key);
      }
    }
    return map;
  }, [sceneData.traps]);

  const filteredMapScripts = useMemo(() => {
    if (!mapScriptSearch) return availableScripts;
    const lower = mapScriptSearch.toLowerCase();
    return availableScripts.filter((s) => s.toLowerCase().includes(lower));
  }, [availableScripts, mapScriptSearch]);

  // 选择脚本后，更新 trapTable 条目（仅本地）
  const handleScriptSelect = useCallback(
    (scriptPath: string) => {
      if (!mapData || scriptPickerIdx === null) return;
      const newTrapTable = [...mapData.trapTable];
      newTrapTable[scriptPickerIdx] = { ...newTrapTable[scriptPickerIdx], scriptPath };
      onMapDataChanged({ ...mapData, trapTable: newTrapTable });
      setScriptPickerIdx(null);
    },
    [mapData, scriptPickerIdx, onMapDataChanged]
  );

  // 删除映射：仅从 trapTable 移除条目，不清除地图瓦片
  const handleDeleteMapping = useCallback(
    (idx: number) => {
      if (!mapData) return;
      const newTrapTable = mapData.trapTable.filter((_, i) => i !== idx);
      onMapDataChanged({ ...mapData, trapTable: newTrapTable });
    },
    [mapData, onMapDataChanged]
  );

  // 删除陷阱：从 trapTable 移除条目 + 清除地图瓦片（不删除脚本文件）
  const handleDeleteTrap = useCallback(
    (idx: number) => {
      if (!mapData) return;
      const entry = mapData.trapTable[idx];
      if (!entry) return;

      const newTrapTable = mapData.trapTable.filter((_, i) => i !== idx);
      const newTraps = new Uint8Array(mapData.traps);
      for (let i = 0; i < newTraps.length; i++) {
        if (newTraps[i] === entry.trapIndex) newTraps[i] = 0;
      }
      onMapDataChanged({ ...mapData, trapTable: newTrapTable, traps: newTraps });
    },
    [mapData, onMapDataChanged]
  );

  // 删除孤立陷阱：仅清除地图瓦片（不涉及 trapTable）
  const handleDeleteOrphan = useCallback(
    (trapIndex: number) => {
      if (!mapData) return;
      const newTraps = new Uint8Array(mapData.traps);
      for (let i = 0; i < newTraps.length; i++) {
        if (newTraps[i] === trapIndex) newTraps[i] = 0;
      }
      onMapDataChanged({ ...mapData, traps: newTraps });
    },
    [mapData, onMapDataChanged]
  );

  // 处理确认删除
  const handleConfirmDelete = useCallback(() => {
    if (!confirmDelete) return;
    if (confirmDelete.mode === "mapping") {
      handleDeleteMapping(confirmDelete.idx);
    } else if (confirmDelete.mode === "orphan" && confirmDelete.trapIndex != null) {
      handleDeleteOrphan(confirmDelete.trapIndex);
    } else {
      handleDeleteTrap(confirmDelete.idx);
    }
    setConfirmDelete(null);
  }, [confirmDelete, handleDeleteMapping, handleDeleteTrap, handleDeleteOrphan]);

  // 统一陷阱列表：合并 trapTable 已映射条目 + 地图中无映射的孤立条目
  const unifiedTraps = useMemo(() => {
    if (!mapData) return [];
    const mappedIndices = new Set(mapData.trapTable.map((e) => e.trapIndex));

    // 已映射条目
    const mapped = mapData.trapTable.map((entry, idx) => {
      let tileCount = 0;
      for (let i = 0; i < mapData.traps.length; i++) {
        if (mapData.traps[i] === entry.trapIndex) tileCount++;
      }
      return {
        trapIndex: entry.trapIndex,
        scriptPath: entry.scriptPath,
        tileCount,
        tableIdx: idx, // trapTable 中的索引，用于编辑/删除
        orphan: false as const,
      };
    });

    // 孤立条目（地图瓦片中存在但 trapTable 无对应）
    const orphanMap = new Map<number, number>();
    for (let i = 0; i < mapData.traps.length; i++) {
      const idx = mapData.traps[i];
      if (idx !== 0 && !mappedIndices.has(idx)) {
        orphanMap.set(idx, (orphanMap.get(idx) ?? 0) + 1);
      }
    }
    const orphans = Array.from(orphanMap.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([trapIndex, tileCount]) => ({
        trapIndex,
        scriptPath: "",
        tileCount,
        tableIdx: -1,
        orphan: true as const,
      }));

    return [...mapped, ...orphans];
  }, [mapData]);

  if (!mapData) {
    return <div className="p-4 text-zinc-500 text-sm">无地图数据</div>;
  }

  return (
    <div className="flex flex-col gap-3 p-3 text-sm overflow-auto">
      {/* 地图基本信息 */}
      <div className="flex flex-col gap-1 text-zinc-400 text-xs">
        <div>
          尺寸: {mapData.mapColumnCounts} × {mapData.mapRowCounts} 瓦片 ({mapData.mapPixelWidth} ×{" "}
          {mapData.mapPixelHeight} px)
        </div>
        <div>MSF 文件: {mapData.msfEntries.length} 个</div>
      </div>

      {/* 陷阱映射表 */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="font-medium text-zinc-300">陷阱 ({unifiedTraps.length})</span>
        </div>

        {unifiedTraps.length === 0 ? (
          <div className="text-zinc-500 text-xs py-2">暂无陷阱。右键地图可在指定位置创建陷阱。</div>
        ) : (
          <div className="flex flex-col gap-1">
            {unifiedTraps.map((entry) => {
              // 大小写不敏感匹配（原系统文件名不区分大小写）
              const hasFile = !!(
                !entry.orphan &&
                entry.scriptPath &&
                trapKeysLower.has(entry.scriptPath.toLowerCase())
              );
              return (
                <div
                  key={`trap-${entry.trapIndex}-${entry.orphan ? "o" : "m"}`}
                  className={`flex items-center gap-2 rounded px-2 py-1.5 group ${
                    entry.orphan
                      ? "bg-yellow-900/20 border border-yellow-800/30"
                      : "bg-zinc-800/50 hover:bg-zinc-700/50"
                  }`}
                >
                  {/* 陷阱索引徽章 */}
                  <button
                    type="button"
                    className={`shrink-0 w-7 h-5 rounded text-[10px] font-mono font-bold flex items-center justify-center cursor-pointer ${
                      entry.orphan
                        ? "bg-yellow-900/50 text-yellow-400 border border-yellow-700/50 hover:bg-yellow-800/50"
                        : "bg-amber-900/50 text-amber-400 border border-amber-700/50 hover:bg-amber-800/50"
                    }`}
                    title={`点击高亮陷阱 #${entry.trapIndex} 的瓦片`}
                    onClick={() => onTrapSelect(entry.trapIndex)}
                  >
                    {entry.trapIndex}
                  </button>

                  {entry.orphan ? (
                    <>
                      {/* 孤立陷阱：显示未关联提示 + 关联按钮 */}
                      <span className="text-xs text-yellow-500/80 italic flex-1">未关联脚本</span>
                      <span className="shrink-0 text-[10px] text-zinc-500">
                        {entry.tileCount}格
                      </span>
                      <button
                        type="button"
                        className="shrink-0 text-[10px] text-blue-400 hover:text-blue-300"
                        title="为此陷阱创建映射"
                        onClick={() => {
                          if (!mapData) return;
                          onMapDataChanged({
                            ...mapData,
                            trapTable: [
                              ...mapData.trapTable,
                              { trapIndex: entry.trapIndex, scriptPath: "" },
                            ],
                          });
                        }}
                      >
                        +映射
                      </button>{" "}
                      {/* 删除孤立陷阱 */}
                      <button
                        type="button"
                        className="shrink-0 text-[10px] text-zinc-500 hover:text-red-400"
                        title="删除陷阱（清除地图上所有关联瓦片）"
                        onClick={() =>
                          setConfirmDelete({ idx: -1, mode: "orphan", trapIndex: entry.trapIndex })
                        }
                      >
                        ✕
                      </button>{" "}
                    </>
                  ) : (
                    <>
                      {/* 已映射陷阱：显示脚本路径 */}
                      <button
                        type="button"
                        className={`flex-1 text-left text-xs truncate cursor-pointer hover:text-blue-400 ${
                          hasFile ? "text-zinc-300" : "text-zinc-500 italic"
                        }`}
                        title={
                          hasFile
                            ? `${entry.scriptPath} (${entry.tileCount} 个瓦片) — 点击更换`
                            : `${entry.scriptPath} (无脚本文件) — 点击选择`
                        }
                        onClick={() => {
                          setScriptPickerIdx(entry.tableIdx);
                          setScriptTab("map");
                          setMapScriptSearch("");
                          setHoverMapScript(null);
                          setSelectedMapScript(entry.scriptPath || null);
                        }}
                      >
                        {!hasFile && (
                          <span className="text-yellow-500 mr-1" title="脚本文件不存在">
                            ⚠
                          </span>
                        )}
                        {entry.scriptPath || "(未设置)"}
                      </button>

                      {/* 瓦片数量 */}
                      <span className="shrink-0 text-[10px] text-zinc-500">
                        {entry.tileCount}格
                      </span>

                      {/* 删除映射按钮 */}
                      <button
                        type="button"
                        className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity text-zinc-500 hover:text-yellow-400 text-[10px]"
                        title="删除映射（仅移除映射关系，保留地图瓦片和脚本文件）"
                        onClick={() => setConfirmDelete({ idx: entry.tableIdx, mode: "mapping" })}
                      >
                        ⊘
                      </button>

                      {/* 删除陷阱按钮 */}
                      <button
                        type="button"
                        className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity text-zinc-500 hover:text-red-400 text-xs"
                        title="删除陷阱（清除映射关系 + 地图上所有关联瓦片）"
                        onClick={() => setConfirmDelete({ idx: entry.tableIdx, mode: "trap" })}
                      >
                        ✕
                      </button>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* MSF 文件列表 */}
      {mapData.msfEntries.length > 0 && (
        <div>
          <div className="font-medium text-zinc-300 mb-1">MSF ({mapData.msfEntries.length})</div>
          <div className="max-h-32 overflow-y-auto space-y-0.5 text-xs">
            {mapData.msfEntries.map((entry, index) => (
              <div
                key={index}
                className="flex justify-between text-zinc-500 hover:bg-zinc-800/50 px-1 rounded"
              >
                <span className="text-blue-400/70">[{index}]</span>
                <span className="text-zinc-400 truncate ml-2" title={entry.name}>
                  {entry.name}
                  {entry.looping ? " 🔁" : ""}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 脚本文件选择器弹窗 —— 复用 FileSelectDialog + tab 切换 */}
      <FileSelectDialog
        open={scriptPickerIdx !== null}
        onClose={() => setScriptPickerIdx(null)}
        onSelect={handleScriptSelect}
        gameId={gameId}
        gameSlug={gameSlug}
        fieldName="scriptFile"
        currentValue={
          scriptPickerIdx !== null ? mapData.trapTable[scriptPickerIdx]?.scriptPath : undefined
        }
        extensions={[".txt"]}
        title="选择脚本"
        headerExtra={
          <div className="flex border-b border-widget-border shrink-0">
            <button
              type="button"
              className={`flex-1 px-4 py-2 text-xs font-medium transition-colors border-b-2 ${
                scriptTab === "map"
                  ? "text-[#cccccc] border-[#0098ff] bg-[#2d2d2d]"
                  : "text-[#858585] hover:text-[#cccccc] border-transparent"
              }`}
              onClick={() => setScriptTab("map")}
            >
              当前地图
            </button>
            <button
              type="button"
              className={`flex-1 px-4 py-2 text-xs font-medium transition-colors border-b-2 ${
                scriptTab === "public"
                  ? "text-[#cccccc] border-[#0098ff] bg-[#2d2d2d]"
                  : "text-[#858585] hover:text-[#cccccc] border-transparent"
              }`}
              onClick={() => setScriptTab("public")}
            >
              公共脚本
            </button>
          </div>
        }
        customContent={
          scriptTab === "map" ? (
            <>
              {/* 搜索栏 */}
              <div className="px-4 py-2 border-b border-[#454545]">
                <input
                  type="text"
                  placeholder="搜索脚本..."
                  value={mapScriptSearch}
                  onChange={(e) => setMapScriptSearch(e.target.value)}
                  className="w-full px-3 py-2 bg-[#3c3c3c] border border-[#454545] rounded text-white text-sm focus:outline-none focus:border-[#0e639c]"
                  autoFocus
                />
              </div>
              {/* 文件列表 */}
              <div className="flex-1 min-h-[250px] overflow-auto p-2">
                {filteredMapScripts.length === 0 ? (
                  <div className="text-center py-8 text-[#808080]">
                    {mapScriptSearch ? "没有匹配的脚本" : "当前地图无脚本条目"}
                  </div>
                ) : (
                  <div className="space-y-0.5">
                    {filteredMapScripts.map((name) => {
                      return (
                        <div
                          key={name}
                          className={`flex items-center px-2 py-1 rounded cursor-pointer select-none ${
                            name === selectedMapScript
                              ? "bg-[#0e639c] text-white"
                              : "hover:bg-[#2a2d2e] text-[#cccccc]"
                          }`}
                          style={{ paddingLeft: 8 }}
                          onClick={() => setSelectedMapScript(name)}
                          onDoubleClick={() => handleScriptSelect(name)}
                          onMouseEnter={(e) =>
                            setHoverMapScript({ name, position: { x: e.clientX, y: e.clientY } })
                          }
                          onMouseLeave={() => setHoverMapScript(null)}
                        >
                          <span className="mr-2">📄</span>
                          <span className="flex-1 truncate text-sm">{name}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
              {/* 底部栏 */}
              <div className="flex items-center justify-between px-4 py-3 border-t border-[#454545] bg-[#252526]">
                <div className="text-sm text-[#808080]">
                  {selectedMapScript ? (
                    <span className="truncate max-w-80 inline-block" title={selectedMapScript}>
                      {selectedMapScript}
                    </span>
                  ) : (
                    "未选择文件"
                  )}
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setScriptPickerIdx(null)}
                    className="px-4 py-2 text-sm rounded hover:bg-[#3c3c3c] text-[#cccccc]"
                  >
                    取消
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (selectedMapScript) handleScriptSelect(selectedMapScript);
                    }}
                    disabled={!selectedMapScript}
                    className="px-4 py-2 text-sm bg-[#0e639c] hover:bg-[#1177bb] text-white rounded disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    选择
                  </button>
                </div>
              </div>
              {/* 悬停预览 */}
              {hoverMapScript && sceneData.scripts?.[hoverMapScript.name] && (
                <div
                  className="fixed z-[9999]"
                  style={{ left: hoverMapScript.position.x + 16, top: hoverMapScript.position.y }}
                >
                  <ScriptPreviewTooltip
                    key={hoverMapScript.name}
                    gameSlug=""
                    path={hoverMapScript.name}
                    initialContent={sceneData.scripts[hoverMapScript.name]}
                  />
                </div>
              )}
            </>
          ) : undefined
        }
      />

      {/* 删除确认弹窗 */}
      {confirmDelete &&
        (confirmDelete.mode === "orphan" || mapData.trapTable[confirmDelete.idx]) && (
          <ConfirmDialog
            title={confirmDelete.mode === "mapping" ? "删除映射" : "删除陷阱"}
            message={
              confirmDelete.mode === "orphan"
                ? `确认删除陷阱 #${confirmDelete.trapIndex}？将清除地图上所有关联瓦片。`
                : confirmDelete.mode === "mapping"
                  ? `确认删除陷阱 #${mapData.trapTable[confirmDelete.idx].trapIndex} 的映射关系？映射将被移除，但地图上的瓦片标记和脚本文件将保留。`
                  : `确认删除陷阱 #${mapData.trapTable[confirmDelete.idx].trapIndex}？将清除映射关系以及地图上所有关联瓦片，脚本文件保留。`
            }
            confirmText="删除"
            danger
            onConfirm={handleConfirmDelete}
            onCancel={() => setConfirmDelete(null)}
          />
        )}
    </div>
  );
}
