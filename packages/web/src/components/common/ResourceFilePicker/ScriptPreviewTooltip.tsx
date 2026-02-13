/**
 * 脚本文件预览 Tooltip
 * 使用 Monaco Editor 显示脚本内容（只读模式）
 */
import { useEffect, useState } from "react";
import Editor, { loader } from "@monaco-editor/react";
import {
  JXQY_SCRIPT_LANGUAGE_ID,
  registerJxqyScriptLanguage,
  defineJxqyScriptTheme,
} from "../../../lib/monaco/jxqyScriptLanguage";

// 全局标记，确保只初始化一次
let monacoInitialized = false;

interface ScriptPreviewTooltipProps {
  gameSlug: string;
  path: string;
  /** If provided, use this content directly instead of fetching from server */
  initialContent?: string;
}

// 根据扩展名获取 Monaco Editor 语言
function getMonacoLanguage(ext: string): string {
  // txt 文件使用脚本语法高亮
  if (ext === "txt") {
    return JXQY_SCRIPT_LANGUAGE_ID;
  }

  // npc/obj/ini 文件使用 ini 高亮
  if (ext === "npc" || ext === "obj" || ext === "ini") {
    return "ini";
  }

  const langMap: Record<string, string> = {
    json: "json",
    xml: "xml",
    lua: "lua",
  };
  return langMap[ext] || "plaintext";
}

export function ScriptPreviewTooltip({ gameSlug, path, initialContent }: ScriptPreviewTooltipProps) {
  const [content, setContent] = useState<string | null>(initialContent ?? null);
  const [isLoading, setIsLoading] = useState(initialContent === undefined);
  const [error, setError] = useState<string | null>(null);
  const [monacoReady, setMonacoReady] = useState(monacoInitialized);

  // 初始化 Monaco Editor 自定义语言
  useEffect(() => {
    if (monacoInitialized) return;

    loader.init().then((monaco) => {
      registerJxqyScriptLanguage(monaco);
      defineJxqyScriptTheme(monaco);
      monacoInitialized = true;
      setMonacoReady(true);
    });
  }, []);

  useEffect(() => {
    if (initialContent !== undefined || !path) return;

    setIsLoading(true);
    setError(null);

    const loadScript = async () => {
      try {
        // 需要 encodeURI 处理中文路径
        const url = encodeURI(`/game/${gameSlug}/resources/${path.toLowerCase()}`);
        const response = await fetch(url);
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        const text = await response.text();
        setContent(text);
      } catch (e) {
        setError(e instanceof Error ? e.message : "加载失败");
      } finally {
        setIsLoading(false);
      }
    };

    loadScript();
  }, [gameSlug, path, initialContent]);

  // 获取文件名和扩展名
  const fileName = path.split("/").pop() || path;
  const ext = fileName.split(".").pop()?.toLowerCase() || "";
  const language = getMonacoLanguage(ext);

  // 计算行数来确定高度
  const lineCount = content?.split("\n").length || 1;
  const maxLines = 20;
  const displayLines = Math.min(lineCount, maxLines);
  const editorHeight = displayLines * 19 + 10; // 每行约19px

  if (isLoading || !monacoReady) {
    return (
      <div className="bg-[#1e1e1e] border border-[#3c3c3c] rounded-lg shadow-xl p-3 text-xs text-[#808080] w-[600px]">
        加载中...
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-[#1e1e1e] border border-[#3c3c3c] rounded-lg shadow-xl p-3 text-xs text-red-400 w-[600px]">
        {error}
      </div>
    );
  }

  return (
    <div className="bg-[#1e1e1e] border border-[#3c3c3c] rounded-lg shadow-xl overflow-hidden w-[600px]">
      {/* 标题栏 - 类似 VS Code 标签 */}
      <div className="flex items-center gap-2 px-3 py-1.5 bg-[#252526] border-b border-[#3c3c3c]">
        <span className="text-[#6a9955]">📄</span>
        <span className="text-xs text-[#cccccc]">{fileName}</span>
        <span className="text-[10px] text-[#808080] ml-auto">只读</span>
      </div>

      {/* Monaco Editor */}
      <div style={{ height: editorHeight }}>
        <Editor
          height="100%"
          language={language}
          value={content || ""}
          theme="jxqy-script-theme"
          options={{
            readOnly: true,
            minimap: { enabled: false },
            scrollBeyondLastLine: false,
            lineNumbers: "on",
            lineNumbersMinChars: 3,
            folding: false,
            wordWrap: "on",
            fontSize: 12,
            fontFamily: "'Fira Code', 'Consolas', 'Monaco', monospace",
            renderLineHighlight: "none",
            scrollbar: {
              vertical: "auto",
              horizontal: "auto",
              verticalScrollbarSize: 8,
              horizontalScrollbarSize: 8,
            },
            overviewRulerLanes: 0,
            hideCursorInOverviewRuler: true,
            overviewRulerBorder: false,
            contextmenu: false,
            padding: { top: 4, bottom: 4 },
          }}
        />
      </div>

      {/* 如果有更多行，显示提示 */}
      {lineCount > maxLines && (
        <div className="px-3 py-1 text-[10px] text-[#6e7681] bg-[#252526] border-t border-[#3c3c3c]">
          还有 {lineCount - maxLines} 行...
        </div>
      )}
    </div>
  );
}
