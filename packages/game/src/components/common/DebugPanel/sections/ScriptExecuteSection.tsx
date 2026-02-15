/**
 * 执行脚本区块
 */

import { logger } from "@miu2d/engine/core/logger";
import type { OnMount } from "@monaco-editor/react";
import type React from "react";
import { useCallback, useRef, useState } from "react";
import { ScriptEditor } from "../../ScriptEditor/index";
import {
  btnClass,
  btnPrimary,
  LS_SCRIPT_CONTENT,
  LS_SCRIPT_HISTORY,
  MAX_HISTORY,
} from "../constants";
import { Section } from "../Section";

interface ScriptExecuteSectionProps {
  isScriptRunning: boolean;
  onExecuteScript: (script: string) => Promise<string | null>;
}

export const ScriptExecuteSection: React.FC<ScriptExecuteSectionProps> = ({
  isScriptRunning,
  onExecuteScript,
}) => {
  // 从 localStorage 初始化脚本内容
  const [scriptContent, setScriptContent] = useState(() => {
    try {
      return localStorage.getItem(LS_SCRIPT_CONTENT) || "";
    } catch {
      return "";
    }
  });

  // 从 localStorage 初始化用户输入的脚本历史记录
  const [userScriptHistory, setUserScriptHistory] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem(LS_SCRIPT_HISTORY);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [isExecuting, setIsExecuting] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const toastTimeoutRef = useRef<number | null>(null);
  // 用于在 keybinding 中调用最新的 execute 函数
  const executeRef = useRef<() => void>(null);

  const showToast = (message: string, duration = 1500) => {
    if (toastTimeoutRef.current) {
      clearTimeout(toastTimeoutRef.current);
    }
    setToastMessage(message);
    toastTimeoutRef.current = window.setTimeout(() => {
      setToastMessage(null);
    }, duration);
  };

  // 保存脚本内容到 localStorage
  const handleScriptContentChange = (value: string) => {
    setScriptContent(value);
    try {
      localStorage.setItem(LS_SCRIPT_CONTENT, value);
    } catch {
      // ignore
    }
  };

  // 添加到历史记录
  const addToHistory = (script: string) => {
    const trimmed = script.trim();
    if (!trimmed) return;
    setUserScriptHistory((prev) => {
      const filtered = prev.filter((s) => s !== trimmed);
      const newHistory = [trimmed, ...filtered].slice(0, MAX_HISTORY);
      try {
        localStorage.setItem(LS_SCRIPT_HISTORY, JSON.stringify(newHistory));
      } catch {
        // ignore
      }
      return newHistory;
    });
  };

  // 从历史记录恢复
  const restoreFromHistory = (script: string) => {
    handleScriptContentChange(script);
  };

  // 清空历史记录
  const clearHistory = () => {
    setUserScriptHistory([]);
    try {
      localStorage.removeItem(LS_SCRIPT_HISTORY);
    } catch {
      // ignore
    }
  };

  const handleExecuteScript = useCallback(async () => {
    if (!scriptContent.trim()) return;
    if (isScriptRunning) {
      alert("脚本正在执行中，请等待执行完成后再操作");
      return;
    }
    setIsExecuting(true);
    try {
      const error = await onExecuteScript(scriptContent.trim());
      if (error) {
        logger.warn(`[DebugPanel] 脚本执行返回错误: ${error}`);
        await new Promise((resolve) => setTimeout(resolve, 100));
        showToast(`✗ 脚本错误: ${error}`, 3000);
      } else {
        addToHistory(scriptContent.trim());
        await new Promise((resolve) => setTimeout(resolve, 100));
        showToast("✓ 脚本执行完成");
      }
    } catch (e) {
      const errorMsg = e instanceof Error ? e.message : String(e);
      logger.error(`[DebugPanel] 脚本执行异常: ${errorMsg}`);
      showToast(`✗ 脚本异常: ${errorMsg}`, 3000);
    } finally {
      setIsExecuting(false);
    }
  }, [scriptContent, isScriptRunning, onExecuteScript, addToHistory, showToast]);

  // 保持 ref 始终指向最新的执行函数
  executeRef.current = handleExecuteScript;

  // Monaco 编辑器挂载时注册 Ctrl+Enter 快捷键
  const handleEditorMount: OnMount = useCallback((editor, monaco) => {
    editor.addAction({
      id: "execute-script",
      label: "Execute Script",
      keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter],
      run: () => {
        executeRef.current?.();
      },
    });
  }, []);

  return (
    <>
      <Section title="执行脚本">
        <div className="space-y-1">
          <ScriptEditor
            value={scriptContent}
            onChange={handleScriptContentChange}
            height={180}
            fontSize={12}
            minimap={false}
            wordWrap="on"
            onMount={handleEditorMount}
            options={{
              glyphMargin: false,
              folding: false,
              lineNumbersMinChars: 3,
              lineDecorationsWidth: 4,
              overviewRulerLanes: 0,
              hideCursorInOverviewRuler: true,
              overviewRulerBorder: false,
              scrollbar: { vertical: "hidden", horizontal: "auto" },
              padding: { top: 4, bottom: 4 },
              placeholder: 'Talk(0,"测试")\nSetMoney(10000)',
            }}
            className="border border-[#333] rounded"
          />
          <div className="flex gap-1">
            <button
              type="button"
              onClick={handleExecuteScript}
              disabled={isExecuting || !scriptContent.trim()}
              className={`${btnPrimary} flex-1`}
            >
              {isExecuting ? "执行中..." : "执行 (Ctrl+Enter)"}
            </button>
            <button
              type="button"
              onClick={() => handleScriptContentChange("")}
              className={`${btnClass} px-3`}
            >
              清空
            </button>
          </div>
        </div>

        {/* 历史记录 */}
        {userScriptHistory.length > 0 && (
          <div className="mt-2">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] text-[#969696]">
                历史记录 ({userScriptHistory.length})
              </span>
              <button
                type="button"
                onClick={clearHistory}
                className="text-[9px] text-[#7a7a7a] hover:text-[#f87171] transition-colors"
              >
                清空
              </button>
            </div>
            <div
              className="max-h-24 overflow-y-auto bg-[#1e1e1e] border border-[#333] rounded"
              style={{ scrollbarWidth: "thin", scrollbarColor: "#424242 transparent" }}
            >
              {userScriptHistory.map((script, idx) => (
                <div
                  key={`history-${idx}-${script.slice(0, 20)}`}
                  onClick={() => restoreFromHistory(script)}
                  className="px-2 py-1 text-[10px] font-mono text-[#969696] hover:bg-[#2a2d2e] hover:text-[#d4d4d4] cursor-pointer border-b border-[#2d2d2d] last:border-b-0 truncate"
                  title={script}
                >
                  {script.length > 50 ? `${script.slice(0, 50)}...` : script}
                </div>
              ))}
            </div>
          </div>
        )}
      </Section>

      {/* Toast 通知 */}
      {toastMessage && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[9999] animate-fade-in">
          <div className="bg-[#252526] text-[#4ade80] px-4 py-2 rounded-lg shadow-lg border border-[#333] text-sm font-medium">
            {toastMessage}
          </div>
        </div>
      )}
    </>
  );
};
