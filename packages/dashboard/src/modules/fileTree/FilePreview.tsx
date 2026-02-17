/**
 * 文件预览组件
 * 支持：
 * - ASF 动画预览（使用 @miu2d/viewer 的 AsfViewer）
 * - MAP 地图预览（使用 @miu2d/viewer 的 MapViewer）
 * - MPC 精灵预览（使用 @miu2d/viewer 的 MpcViewer）
 * - XNB 音频预览（使用 @miu2d/viewer 的 XnbAudioViewer，实时解码播放）
 * - 文本文件编辑（使用 Monaco Editor，支持保存）
 * - 脚本文件编辑（使用自定义语法高亮和自动补全）
 * - 图片/音频预览
 */

import type { JxqyMapData, MiuMapData, Mpc } from "@miu2d/engine/map/types";
import type { AsfData } from "@miu2d/engine/resource/format/asf";
import { parseMap } from "@miu2d/engine/resource/format/map-parser";
import { parseMMF } from "@miu2d/engine/resource/format/mmf";
import { decodeAsfWasm } from "@miu2d/engine/wasm/wasm-asf-decoder";
import { initWasm } from "@miu2d/engine/wasm/wasm-manager";
import { decodeMpcWasm } from "@miu2d/engine/wasm/wasm-mpc-decoder";
import { api } from "@miu2d/shared";
import { AsfViewer } from "@miu2d/viewer/components/AsfViewer";
import { MapViewer } from "@miu2d/viewer/components/MapViewer";
import { MpcViewer } from "@miu2d/viewer/components/MpcViewer";
import { XnbAudioViewer } from "@miu2d/viewer/components/XnbAudioViewer";
import Editor, { loader } from "@monaco-editor/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useDashboard } from "../../DashboardContext";
import {
  defineJxqyScriptTheme,
  JXQY_SCRIPT_LANGUAGE_ID,
  registerJxqyScriptLanguage,
} from "../../lib/monaco/jxqyScriptLanguage";
import type { FlatFileTreeNode } from "./types";
import { getFileExtension } from "./types";

interface FilePreviewProps {
  file: FlatFileTreeNode | null;
}

// 文本文件扩展名
const TEXT_EXTENSIONS = new Set([
  "txt",
  "ini",
  "npc",
  "obj",
  "lua",
  "json",
  "xml",
  "html",
  "css",
  "js",
  "ts",
  "tsx",
  "jsx",
  "md",
  "yml",
  "yaml",
  "sh",
  "bat",
  "cmd",
  "py",
  "java",
  "c",
  "cpp",
  "h",
  "hpp",
  "cs",
  "go",
  "rs",
  "sql",
  "log",
  "cfg",
  "conf",
  "env",
]);

// 脚本文件扩展名（使用自定义语法高亮）
const SCRIPT_EXTENSIONS = new Set(["txt", "npc", "obj"]);

// 根据扩展名获取 Monaco Editor 语言
function getMonacoLanguage(ext: string, filePath?: string): string {
  // 检查是否是脚本目录下的文件（使用自定义语法高亮）
  const isScriptFile =
    filePath && (filePath.includes("/script/") || filePath.includes("/scripts/"));

  // 脚本文件使用自定义语言
  if (SCRIPT_EXTENSIONS.has(ext) && isScriptFile) {
    return JXQY_SCRIPT_LANGUAGE_ID;
  }

  const langMap: Record<string, string> = {
    js: "javascript",
    jsx: "javascript",
    ts: "typescript",
    tsx: "typescript",
    json: "json",
    xml: "xml",
    html: "html",
    css: "css",
    md: "markdown",
    yml: "yaml",
    yaml: "yaml",
    py: "python",
    java: "java",
    c: "c",
    cpp: "cpp",
    h: "c",
    hpp: "cpp",
    cs: "csharp",
    go: "go",
    rs: "rust",
    sql: "sql",
    sh: "shell",
    bat: "bat",
    lua: "lua",
    ini: "ini",
  };
  return langMap[ext] || "plaintext";
}

export function FilePreview({ file }: FilePreviewProps) {
  const { currentGame } = useDashboard();
  const utils = api.useUtils();
  const getUploadUrlMutation = api.file.getUploadUrl.useMutation();

  // 构建资源根目录
  const resourceRoot = currentGame ? `/game/${currentGame.slug}/resources` : undefined;

  // 通用状态
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ASF 状态
  const [asfData, setAsfData] = useState<AsfData | null>(null);
  const [wasmReady, setWasmReady] = useState(false);

  // MAP 状态
  const [mapData, setMapData] = useState<JxqyMapData | null>(null);
  const [mmfData, setMmfData] = useState<MiuMapData | null>(null);
  const [mapName, setMapName] = useState<string | null>(null);

  // MPC 状态
  const [mpcData, setMpcData] = useState<Mpc | null>(null);
  const [mpcWasmReady, setMpcWasmReady] = useState(false);

  // XNB 音频状态
  const [xnbData, setXnbData] = useState<ArrayBuffer | null>(null);

  // 文本状态
  const [textContent, setTextContent] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const originalContentRef = useRef<string | null>(null);

  // 初始化 WASM
  useEffect(() => {
    initWasm()
      .then(() => {
        setWasmReady(true);
        setMpcWasmReady(true);
      })
      .catch((err) => {
        console.error("WASM 初始化失败:", err);
      });
  }, []);

  // 初始化 Monaco Editor 自定义语言
  useEffect(() => {
    loader.init().then((monaco) => {
      registerJxqyScriptLanguage(monaco);
      defineJxqyScriptTheme(monaco);
    });
  }, []);

  // 重置预览状态
  const resetPreviewState = useCallback(() => {
    setPreviewUrl(null);
    setAsfData(null);
    setMapData(null);
    setMmfData(null);
    setMapName(null);
    setMpcData(null);
    setXnbData(null);
    setTextContent(null);
    setError(null);
    setHasChanges(false);
    originalContentRef.current = null;
  }, []);

  // 加载文件
  useEffect(() => {
    if (!file || file.isDirectory) {
      resetPreviewState();
      return;
    }

    const ext = getFileExtension(file.name);

    // 异步加载文件
    const loadFile = async () => {
      setIsLoading(true);
      setError(null);
      resetPreviewState();

      try {
        // 获取下载 URL
        const { url: downloadUrl } = (await utils.file.getDownloadUrl.fetch({ gameId: currentGame!.id, id: file.id })) as { url: string };
        setPreviewUrl(downloadUrl);

        // ASF / MSF 文件
        if (ext === "asf" || ext === "msf") {
          if (!wasmReady) {
            setError("WASM 解码器尚未初始化");
            return;
          }
          const response = await fetch(downloadUrl);
          const buffer = await response.arrayBuffer();
          const asf = decodeAsfWasm(buffer);
          if (!asf) {
            setError(ext === "msf" ? "MSF 解码失败" : "ASF 解码失败");
            return;
          }
          setAsfData(asf);
        }
        // MPC 文件
        else if (ext === "mpc") {
          if (!mpcWasmReady) {
            setError("MPC WASM 解码器尚未初始化");
            return;
          }
          const response = await fetch(downloadUrl);
          const buffer = await response.arrayBuffer();
          const mpc = decodeMpcWasm(buffer);
          if (!mpc) {
            setError("MPC 解码失败");
            return;
          }
          setMpcData(mpc);
        }
        // MAP 文件
        else if (ext === "map") {
          const response = await fetch(downloadUrl);
          const buffer = await response.arrayBuffer();
          const data = await parseMap(buffer, file.name);
          if (!data) {
            setError("地图解析失败");
            return;
          }
          const name = file.name.replace(/\.map$/i, "");
          setMapName(name);
          setMapData(data);
        }
        // MMF 文件
        else if (ext === "mmf") {
          const response = await fetch(downloadUrl);
          const buffer = await response.arrayBuffer();
          const data = parseMMF(buffer, file.name);
          if (!data) {
            setError("MMF 地图解析失败");
            return;
          }
          const name = file.name.replace(/\.mmf$/i, "");
          setMapName(name);
          setMmfData(data);
        }
        // 文本文件
        else if (TEXT_EXTENSIONS.has(ext)) {
          const response = await fetch(downloadUrl);
          const text = await response.text();
          setTextContent(text);
          originalContentRef.current = text;
        }
        // XNB 音频文件
        else if (ext === "xnb") {
          const response = await fetch(downloadUrl);
          const buffer = await response.arrayBuffer();
          setXnbData(buffer);
        }
        // 其他文件类型不需要额外处理
      } catch (err) {
        setError(`加载失败: ${(err as Error).message}`);
      } finally {
        setIsLoading(false);
      }
    };

    loadFile();
  }, [
    file?.id,
    wasmReady,
    mpcWasmReady,
    file,
    currentGame,
    resetPreviewState,
  ]);

  // 保存文本文件
  const handleSave = useCallback(async () => {
    if (!file || textContent === null || !hasChanges) return;

    setIsSaving(true);
    setError(null);
    try {
      // 将文本转换为 Blob
      const blob = new Blob([textContent], { type: "text/plain; charset=utf-8" });

      // 获取上传 URL
      const { url: uploadUrl } = await getUploadUrlMutation.mutateAsync({
        gameId: currentGame!.id,
      });

      // 上传文件
      const uploadResponse = await fetch(uploadUrl, {
        method: "PUT",
        body: blob,
        headers: { "Content-Type": "text/plain; charset=utf-8" },
      });

      if (!uploadResponse.ok) {
        throw new Error(`上传失败: ${uploadResponse.status}`);
      }

      originalContentRef.current = textContent;
      setHasChanges(false);
    } catch (err) {
      setError(`保存失败: ${(err as Error).message}`);
    } finally {
      setIsSaving(false);
    }
  }, [file, textContent, hasChanges, getUploadUrlMutation]);

  // 文本变更处理
  const handleTextChange = useCallback((value: string | undefined) => {
    if (value === undefined) return;
    setTextContent(value);
    setHasChanges(value !== originalContentRef.current);
  }, []);

  // 无选中文件
  if (!file) {
    return (
      <div className="flex items-center justify-center h-full text-[#666] bg-[#1e1e1e]">
        <div className="text-center">
          <div className="text-4xl mb-4">📄</div>
          <p>选择文件查看预览</p>
        </div>
      </div>
    );
  }

  // 目录
  if (file.isDirectory) {
    return (
      <div className="flex items-center justify-center h-full text-[#666] bg-[#1e1e1e]">
        <div className="text-center">
          <div className="text-4xl mb-4">📁</div>
          <p className="text-[#cccccc] font-medium">{file.name}</p>
          <p className="text-sm mt-2">目录</p>
        </div>
      </div>
    );
  }

  // 加载中
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full bg-[#1e1e1e]">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-[#0e639c] border-t-transparent rounded-full animate-spin mx-auto mb-2" />
          <span className="text-[#808080]">加载中...</span>
        </div>
      </div>
    );
  }

  // 错误
  if (error) {
    return (
      <div className="flex items-center justify-center h-full bg-[#1e1e1e]">
        <div className="text-center text-red-400">
          <span className="text-2xl">❌</span>
          <p className="mt-2">{error}</p>
        </div>
      </div>
    );
  }

  const ext = getFileExtension(file.name);

  // ASF / MSF 预览
  if ((ext === "asf" || ext === "msf") && asfData) {
    return <AsfViewer asf={asfData} fileName={file.name} isLoading={false} error={null} />;
  }

  // MAP 预览
  if (ext === "map" && mapData) {
    return (
      <MapViewer
        mapData={mapData}
        mapName={mapName}
        fileName={file.name}
        isLoading={false}
        error={null}
        resourceRoot={resourceRoot}
      />
    );
  }

  // MMF 预览
  if (ext === "mmf" && mmfData) {
    return (
      <MapViewer
        mmfData={mmfData}
        mapName={mapName}
        fileName={file.name}
        isLoading={false}
        error={null}
        resourceRoot={resourceRoot}
      />
    );
  }

  // MPC 预览
  if (ext === "mpc" && mpcData) {
    return <MpcViewer mpc={mpcData} fileName={file.name} isLoading={false} error={null} />;
  }

  // XNB 音频预览
  if (ext === "xnb" && xnbData) {
    return <XnbAudioViewer data={xnbData} fileName={file.name} isLoading={false} error={null} />;
  }

  // 文本文件编辑（Monaco Editor）
  if (TEXT_EXTENSIONS.has(ext) && textContent !== null) {
    return (
      <div className="flex flex-col h-full bg-[#1e1e1e]">
        {/* 工具栏 */}
        <div className="flex items-center justify-between px-4 py-2 border-b border-widget-border bg-[#252526]">
          <div className="flex items-center gap-2">
            <span className="text-sm text-[#cccccc]">{file.name}</span>
            {hasChanges && <span className="text-xs text-amber-400">● 已修改</span>}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleSave}
              disabled={!hasChanges || isSaving}
              className={`px-3 py-1 text-sm rounded transition-colors ${
                hasChanges && !isSaving
                  ? "bg-[#0e639c] hover:bg-[#1177bb] text-white"
                  : "bg-[#3c3c3c] text-[#666] cursor-not-allowed"
              }`}
            >
              {isSaving ? "保存中..." : "保存"}
            </button>
            {previewUrl && (
              <a
                href={previewUrl}
                download={file.name}
                className="px-3 py-1 text-sm rounded transition-colors bg-[#3c3c3c] hover:bg-[#4c4c4c] text-[#cccccc]"
              >
                下载
              </a>
            )}
          </div>
        </div>
        {/* 编辑器 */}
        <div className="flex-1 min-h-0">
          <Editor
            height="100%"
            language={getMonacoLanguage(ext, file.path)}
            value={textContent}
            onChange={handleTextChange}
            theme="jxqy-script-theme"
            options={{
              minimap: { enabled: true },
              fontSize: 14,
              lineNumbers: "on",
              wordWrap: "on",
              scrollBeyondLastLine: false,
              automaticLayout: true,
              tabSize: 2,
              readOnly: false,
            }}
          />
        </div>
      </div>
    );
  }

  // 图片预览
  if (["png", "jpg", "jpeg", "gif", "webp", "bmp"].includes(ext) && previewUrl) {
    return (
      <div className="flex items-center justify-center h-full p-4 bg-[#1a1a1a]">
        <img
          src={previewUrl}
          alt={file.name}
          className="max-w-full max-h-full object-contain"
          style={{ imageRendering: "pixelated" }}
        />
      </div>
    );
  }

  // 音频预览
  if (["ogg", "mp3", "wav"].includes(ext) && previewUrl) {
    return (
      <div className="flex items-center justify-center h-full bg-[#1e1e1e]">
        <div className="text-center">
          <div className="text-4xl mb-4">🎵</div>
          <p className="text-[#cccccc] font-medium mb-4">{file.name}</p>
          <audio controls src={previewUrl} className="w-[300px]" />
        </div>
      </div>
    );
  }

  // 视频预览
  if (["mp4", "webm", "ogv"].includes(ext) && previewUrl) {
    return (
      <div className="flex items-center justify-center h-full p-4 bg-[#1a1a1a]">
        <video src={previewUrl} controls className="max-w-full max-h-full" />
      </div>
    );
  }

  // 默认预览（未知类型）
  return (
    <div className="flex items-center justify-center h-full text-[#666] bg-[#1e1e1e]">
      <div className="text-center">
        <div className="text-4xl mb-4">📄</div>
        <p className="text-[#cccccc] font-medium">{file.name}</p>
        <p className="text-sm mt-2">{file.mimeType || "未知类型"}</p>
        {file.size && (
          <p className="text-xs mt-2 text-[#858585]">
            {file.size < 1024
              ? `${file.size} B`
              : file.size < 1024 * 1024
                ? `${(file.size / 1024).toFixed(1)} KB`
                : `${(file.size / 1024 / 1024).toFixed(1)} MB`}
          </p>
        )}
        {previewUrl && (
          <a
            href={previewUrl}
            download={file.name}
            className="inline-block mt-4 px-4 py-2 bg-[#0e639c] hover:bg-[#1177bb] text-white text-sm rounded transition-colors"
          >
            下载文件
          </a>
        )}
      </div>
    </div>
  );
}
