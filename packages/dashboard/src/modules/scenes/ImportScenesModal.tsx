/**
 * 批量导入场景弹窗
 *
 * 支持拖拽整个 resources 文件夹，自动解析 MMF 地图、脚本、NPC/OBJ 文件，
 * 然后逐条导入到数据库。
 */

import { trpc } from "@miu2d/shared";
import type { SceneData } from "@miu2d/types";
import {
  classifyScriptFile,
  getSceneDataCounts,
  parseIniContent,
  parseMapFileName,
  parseNpcEntries,
  parseObjEntries,
} from "@miu2d/types";
import { useCallback, useMemo, useState } from "react";
import { useDashboard } from "../../DashboardContext";
import { DashboardIcons } from "../../icons";

// ============= 内部工具函数 =============

interface ParsedScene {
  key: string;
  name: string;
  mapFileName: string;
  mmfBase64: string;
  data: SceneData;
}

async function readDroppedDirectory(
  entry: FileSystemEntry,
  basePath: string
): Promise<{ relativePath: string; file: File }[]> {
  const results: { relativePath: string; file: File }[] = [];
  if (entry.isFile) {
    const fileEntry = entry as FileSystemFileEntry;
    const file = await new Promise<File>((resolve) => fileEntry.file(resolve));
    results.push({ relativePath: basePath + file.name, file });
  } else if (entry.isDirectory) {
    const dirEntry = entry as FileSystemDirectoryEntry;
    const reader = dirEntry.createReader();
    let allEntries: FileSystemEntry[] = [];
    let batch: FileSystemEntry[];
    do {
      batch = await new Promise<FileSystemEntry[]>((resolve) => reader.readEntries(resolve));
      allEntries = allEntries.concat(batch);
    } while (batch.length > 0);
    for (const sub of allEntries) {
      const subResults = await readDroppedDirectory(sub, `${basePath}${entry.name}/`);
      results.push(...subResults);
    }
  }
  return results;
}

async function fileToBase64(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

async function parseResourcesFolder(
  files: { relativePath: string; file: File }[],
  onProgress: (text: string) => void
): Promise<ParsedScene[]> {
  const sceneMap = new Map<string, ParsedScene>();

  const normalize = (path: string): string => {
    let p = path.replace(/^\//, "");
    const firstSlash = p.indexOf("/");
    if (firstSlash > 0) {
      const firstDir = p.substring(0, firstSlash).toLowerCase();
      if (firstDir === "resources" || firstDir === "sword2" || firstDir === "resources.bak") {
        p = p.substring(firstSlash + 1);
      }
    }
    return p;
  };

  // === 阶段 1: 解析 MMF 文件 ===
  onProgress("解析地图文件...");
  const mmfFiles = files.filter((f) => {
    const norm = normalize(f.relativePath);
    return norm.match(/^map\//i) && f.file.name.toLowerCase().endsWith(".mmf");
  });

  for (const mmfFile of mmfFiles) {
    const { key, name } = parseMapFileName(mmfFile.file.name);
    const mmfBase64 = await fileToBase64(mmfFile.file);
    sceneMap.set(key.toLowerCase(), {
      key,
      name,
      mapFileName: mmfFile.file.name,
      mmfBase64,
      data: {},
    });
  }

  onProgress(`找到 ${sceneMap.size} 个地图`);

  // === 阶段 2: 解析脚本文件 ===
  onProgress("解析脚本文件...");
  const scriptFiles = files.filter((f) => {
    const norm = normalize(f.relativePath);
    return norm.match(/^script\/map\//i) && f.file.name.toLowerCase().endsWith(".txt");
  });

  for (const sf of scriptFiles) {
    const norm = normalize(sf.relativePath);
    const parts = norm.split("/");
    if (parts.length < 4) continue;
    const sceneKey = parts[2];
    const fileName = parts[parts.length - 1];

    const scene = sceneMap.get(sceneKey.toLowerCase());
    if (!scene) continue;

    const content = await sf.file.text();
    const kind = classifyScriptFile(fileName);

    if (kind === "trap") {
      if (!scene.data.traps) scene.data.traps = {};
      scene.data.traps[fileName] = content;
    } else {
      if (!scene.data.scripts) scene.data.scripts = {};
      scene.data.scripts[fileName] = content;
    }
  }

  // === 阶段 3: 解析 NPC/OBJ 文件 ===
  onProgress("解析 NPC/OBJ 文件...");
  const saveFiles = files.filter((f) => {
    const norm = normalize(f.relativePath);
    const inSaveDir = norm.match(/^save\/game\//i) || norm.match(/^ini\/save\//i);
    return (
      inSaveDir &&
      (f.file.name.toLowerCase().endsWith(".npc") || f.file.name.toLowerCase().endsWith(".obj"))
    );
  });

  for (const sf of saveFiles) {
    const content = await sf.file.text();
    const sections = parseIniContent(content);

    const headSection = sections.Head || sections.head;
    if (!headSection) continue;
    const mapValue = headSection.Map || headSection.map;
    if (!mapValue) continue;

    const mapKey = mapValue.replace(/\.(map|mmf)$/i, "");
    const scene = sceneMap.get(mapKey.toLowerCase());
    if (!scene) continue;

    const fileName = sf.file.name;
    if (fileName.toLowerCase().endsWith(".npc")) {
      const entries = parseNpcEntries(sections);
      if (!scene.data.npc) scene.data.npc = {};
      scene.data.npc[fileName] = { key: fileName, entries };
    } else if (fileName.toLowerCase().endsWith(".obj")) {
      const entries = parseObjEntries(sections);
      if (!scene.data.obj) scene.data.obj = {};
      scene.data.obj[fileName] = { key: fileName, entries };
    }
  }

  onProgress(`解析完成: ${sceneMap.size} 个场景`);
  return Array.from(sceneMap.values());
}

// ============= 导入弹窗组件 =============

export function ImportScenesModal({
  onClose,
  onSuccess,
}: {
  onClose: () => void;
  onSuccess: () => void;
}) {
  const { currentGame } = useDashboard();
  const gameId = currentGame?.id;

  const [isDragging, setIsDragging] = useState(false);
  const [parsedScenes, setParsedScenes] = useState<ParsedScene[] | null>(null);
  const [parseProgress, setParseProgress] = useState("");

  const [isImporting, setIsImporting] = useState(false);
  const [importCurrent, setImportCurrent] = useState(0);
  const [importTotal, setImportTotal] = useState(0);
  const [importCurrentName, setImportCurrentName] = useState("");
  const [result, setResult] = useState<{
    created: number;
    updated: number;
    errors: string[];
  } | null>(null);

  const importSceneMutation = trpc.scene.importScene.useMutation();
  const clearAllMutation = trpc.scene.clearAll.useMutation();

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const items = e.dataTransfer.items;
    if (!items) return;

    setParseProgress("读取文件...");

    const allFiles: { relativePath: string; file: File }[] = [];
    const entries: FileSystemEntry[] = [];
    for (let i = 0; i < items.length; i++) {
      const entry = items[i].webkitGetAsEntry?.();
      if (entry) entries.push(entry);
    }
    for (const entry of entries) {
      const results = await readDroppedDirectory(entry, "");
      allFiles.push(...results);
    }

    setParseProgress(`读取到 ${allFiles.length} 个文件，解析中...`);
    const scenes = await parseResourcesFolder(allFiles, setParseProgress);
    setParsedScenes(scenes);
    setParseProgress("");
  }, []);

  const handleFileInput = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files;
    if (!fileList || fileList.length === 0) return;

    setParseProgress("读取文件...");
    const allFiles: { relativePath: string; file: File }[] = [];
    for (let i = 0; i < fileList.length; i++) {
      const file = fileList[i];
      const path = (file as File & { webkitRelativePath?: string }).webkitRelativePath || file.name;
      allFiles.push({ relativePath: path, file });
    }

    setParseProgress(`读取到 ${allFiles.length} 个文件，解析中...`);
    const scenes = await parseResourcesFolder(allFiles, setParseProgress);
    setParsedScenes(scenes);
    setParseProgress("");
  }, []);

  const handleImport = useCallback(async () => {
    if (!gameId || !parsedScenes || parsedScenes.length === 0) return;
    setIsImporting(true);

    const stats = { created: 0, updated: 0, errors: [] as string[] };

    try {
      setImportCurrentName("清空现有场景数据...");
      await clearAllMutation.mutateAsync({ gameId });
    } catch (e) {
      stats.errors.push(`清空失败: ${e instanceof Error ? e.message : String(e)}`);
      setResult(stats);
      setIsImporting(false);
      return;
    }

    setImportTotal(parsedScenes.length);
    setImportCurrent(0);

    for (let i = 0; i < parsedScenes.length; i++) {
      const scene = parsedScenes[i];
      setImportCurrent(i + 1);
      setImportCurrentName(scene.name);

      try {
        const res = await importSceneMutation.mutateAsync({
          gameId,
          scene: {
            key: scene.key,
            name: scene.name,
            mapFileName: scene.mapFileName,
            mmfData: scene.mmfBase64,
            data: scene.data as Record<string, unknown>,
          },
        });

        if (res.action === "created") stats.created++;
        else if (res.action === "updated") stats.updated++;
        else if (res.action === "error") stats.errors.push(`${scene.name}: ${res.error}`);
      } catch (e) {
        stats.errors.push(`${scene.name}: ${e instanceof Error ? e.message : String(e)}`);
      }
    }

    setResult(stats);
    setIsImporting(false);
    onSuccess();
  }, [gameId, parsedScenes, importSceneMutation, clearAllMutation, onSuccess]);

  const sceneSummary = useMemo(() => {
    if (!parsedScenes) return null;
    let scripts = 0;
    let traps = 0;
    let npcs = 0;
    let objs = 0;
    for (const s of parsedScenes) {
      scripts += s.data.scripts ? Object.keys(s.data.scripts).length : 0;
      traps += s.data.traps ? Object.keys(s.data.traps).length : 0;
      if (s.data.npc) {
        for (const v of Object.values(s.data.npc)) {
          npcs += v.entries.length;
        }
      }
      if (s.data.obj) {
        for (const v of Object.values(s.data.obj)) {
          objs += v.entries.length;
        }
      }
    }
    return { maps: parsedScenes.length, scripts, traps, npcs, objs };
  }, [parsedScenes]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="bg-[#1e1e1e] border border-widget-border rounded-lg w-[900px] max-h-[80vh] flex flex-col shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-panel-border">
          <h2 className="text-lg font-medium text-white">批量导入场景</h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded hover:bg-[#3c3c3c] text-[#858585] hover:text-white transition-colors"
          >
            {DashboardIcons.close}
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {result ? (
            <div className="space-y-4">
              <h3 className="text-white font-medium mb-3">导入结果</h3>
              <div className="grid grid-cols-2 gap-2 text-sm text-[#cccccc]">
                <div className="bg-[#252526] px-3 py-2 rounded">
                  创建: <span className="text-green-400">{result.created}</span>
                </div>
                <div className="bg-[#252526] px-3 py-2 rounded">
                  更新: <span className="text-blue-400">{result.updated}</span>
                </div>
              </div>
              {result.errors.length > 0 && (
                <div className="mt-4">
                  <h4 className="text-yellow-400 text-sm mb-1">错误信息:</h4>
                  <div className="bg-[#1a1a1a] p-3 rounded max-h-32 overflow-auto">
                    {result.errors.map((err, i) => (
                      <div key={i} className="text-xs text-red-400">
                        {err}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : isImporting ? (
            <div className="space-y-4">
              <div className="text-sm text-[#cccccc]">
                正在导入 ({importCurrent}/{importTotal}): {importCurrentName}
              </div>
              <div className="w-full bg-[#1a1a1a] rounded-full h-2.5">
                <div
                  className="bg-[#0e639c] h-2.5 rounded-full transition-all duration-200"
                  style={{ width: `${importTotal > 0 ? (importCurrent / importTotal) * 100 : 0}%` }}
                />
              </div>
              <div className="text-xs text-[#858585]">
                {importTotal > 0 ? Math.round((importCurrent / importTotal) * 100) : 0}%
              </div>
            </div>
          ) : parsedScenes ? (
            <div className="space-y-4">
              <h3 className="text-white font-medium mb-3">解析完成，确认导入</h3>
              <p className="text-sm text-yellow-400 mb-3">
                导入将先清空所有现有场景数据，然后重新导入。
              </p>
              {sceneSummary && (
                <div className="grid grid-cols-5 gap-2 text-sm text-[#cccccc]">
                  <div className="bg-[#252526] px-3 py-2 rounded text-center">
                    <div className="text-lg font-medium text-white">{sceneSummary.maps}</div>
                    <div className="text-xs text-[#858585]">地图</div>
                  </div>
                  <div className="bg-[#252526] px-3 py-2 rounded text-center">
                    <div className="text-lg font-medium text-white">{sceneSummary.scripts}</div>
                    <div className="text-xs text-[#858585]">脚本</div>
                  </div>
                  <div className="bg-[#252526] px-3 py-2 rounded text-center">
                    <div className="text-lg font-medium text-white">{sceneSummary.traps}</div>
                    <div className="text-xs text-[#858585]">陷阱</div>
                  </div>
                  <div className="bg-[#252526] px-3 py-2 rounded text-center">
                    <div className="text-lg font-medium text-white">{sceneSummary.npcs}</div>
                    <div className="text-xs text-[#858585]">NPC</div>
                  </div>
                  <div className="bg-[#252526] px-3 py-2 rounded text-center">
                    <div className="text-lg font-medium text-white">{sceneSummary.objs}</div>
                    <div className="text-xs text-[#858585]">物件</div>
                  </div>
                </div>
              )}
              <div className="bg-[#1a1a1a] rounded p-3 max-h-48 overflow-auto">
                <div className="text-xs text-[#858585] mb-2">场景列表:</div>
                <div className="space-y-0.5">
                  {parsedScenes.map((s) => {
                    const counts = getSceneDataCounts(s.data);
                    return (
                      <div
                        key={s.key}
                        className="flex items-center justify-between text-xs text-[#cccccc]"
                      >
                        <span className="truncate flex-1">{s.key}</span>
                        <span className="text-[#858585] ml-2 flex-none">
                          {[
                            counts.scriptCount > 0 && `${counts.scriptCount} 脚本`,
                            counts.trapCount > 0 && `${counts.trapCount} 陷阱`,
                            counts.npcCount > 0 && `${counts.npcCount} NPC`,
                            counts.objCount > 0 && `${counts.objCount} OBJ`,
                          ]
                            .filter(Boolean)
                            .join(", ") || "仅地图"}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-[#858585] mb-4">
                拖拽整个 <code className="text-[#cccccc] bg-[#252526] px-1 rounded">resources</code>{" "}
                文件夹到下方区域。 将自动解析 map/*.mmf 地图、script/map/ 脚本和 save/game/ NPC/OBJ
                文件。
              </p>

              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragging(true);
                }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleDrop}
                className={`relative border-2 border-dashed rounded-lg transition-colors min-h-[200px] flex items-center justify-center ${
                  isDragging
                    ? "border-[#0098ff] bg-[#0098ff]/10"
                    : "border-widget-border hover:border-[#666]"
                }`}
              >
                <label className="flex flex-col items-center justify-center py-10 cursor-pointer">
                  <span className="text-[#858585] text-4xl mb-3">{DashboardIcons.upload}</span>
                  <span className="text-sm text-[#cccccc] mb-1">拖拽 resources 文件夹到此处</span>
                  <span className="text-xs text-[#858585]">或点击选择文件夹</span>
                  <input
                    type="file"
                    {...({ webkitdirectory: "" } as Record<string, string>)}
                    onChange={handleFileInput}
                    className="hidden"
                  />
                </label>
              </div>

              {parseProgress && (
                <div className="text-sm text-[#858585] bg-[#252526] px-4 py-2 rounded">
                  {parseProgress}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between px-6 py-4 border-t border-panel-border">
          <span className="text-xs text-[#858585]">
            {result
              ? "完成"
              : parsedScenes
                ? `${parsedScenes.length} 个场景待导入`
                : "请拖入 resources 文件夹"}
          </span>
          <div className="flex items-center gap-3">
            {parsedScenes && !isImporting && !result && (
              <button
                type="button"
                onClick={() => setParsedScenes(null)}
                className="px-4 py-1.5 text-sm text-[#cccccc] hover:bg-[#3c3c3c] rounded transition-colors"
              >
                重新选择
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              disabled={isImporting}
              className="px-4 py-1.5 text-sm text-[#cccccc] hover:bg-[#3c3c3c] disabled:opacity-50 rounded transition-colors"
            >
              {result ? "关闭" : "取消"}
            </button>
            {parsedScenes && !result && (
              <button
                type="button"
                onClick={handleImport}
                disabled={isImporting || parsedScenes.length === 0}
                className="px-4 py-1.5 text-sm bg-[#0e639c] hover:bg-[#1177bb] disabled:opacity-50 disabled:cursor-not-allowed text-white rounded transition-colors"
              >
                {isImporting ? "导入中..." : "清空并重新导入"}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
