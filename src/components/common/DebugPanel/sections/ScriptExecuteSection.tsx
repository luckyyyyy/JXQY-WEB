/**
 * 执行脚本区块
 */

import type React from "react";
import { useRef, useState } from "react";
import { logger } from "@/engine/core/logger";
import { btnClass, btnPrimary, inputClass, LS_SCRIPT_CONTENT, LS_SCRIPT_HISTORY, MAX_HISTORY } from "../constants";
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

  const handleExecuteScript = async () => {
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
  };

  return (
    <>
      <Section title="执行脚本">
        <div className="space-y-1">
          <textarea
            value={scriptContent}
            onChange={(e) => handleScriptContentChange(e.target.value)}
            placeholder={'Talk(0,"测试")\nSetMoney(10000)'}
            className={`${inputClass} w-full font-mono resize-none h-20`}
            onKeyDown={(e) => {
              if (e.key === "Enter" && e.ctrlKey) handleExecuteScript();
            }}
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
              <span className="text-[10px] text-zinc-500">
                历史记录 ({userScriptHistory.length})
              </span>
              <button
                type="button"
                onClick={clearHistory}
                className="text-[9px] text-zinc-600 hover:text-red-400 transition-colors"
              >
                清空
              </button>
            </div>
            <div
              className="max-h-24 overflow-y-auto bg-zinc-900 border border-zinc-700 rounded"
              style={{ scrollbarWidth: "thin", scrollbarColor: "#52525b transparent" }}
            >
              {userScriptHistory.map((script, idx) => (
                <div
                  key={`history-${idx}-${script.slice(0, 20)}`}
                  onClick={() => restoreFromHistory(script)}
                  className="px-2 py-1 text-[10px] font-mono text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200 cursor-pointer border-b border-zinc-800 last:border-b-0 truncate"
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
          <div className="bg-zinc-800 text-green-400 px-4 py-2 rounded-lg shadow-lg border border-zinc-600 text-sm font-medium">
            {toastMessage}
          </div>
        </div>
      )}
    </>
  );
};
