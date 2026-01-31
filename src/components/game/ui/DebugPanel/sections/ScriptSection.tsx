/**
 * 当前脚本区块
 */

import React from "react";
import { logger } from "@/engine/core/logger";
import { DataRow } from "../DataRow";
import { ScriptCodeView } from "../ScriptCodeView";
import { Section } from "../Section";
import type { ScriptInfo } from "../types";

interface ScriptSectionProps {
  currentScriptInfo: ScriptInfo | null;
  isScriptRunning: boolean;
  onExecuteScript?: (script: string) => Promise<string | null>;
}

// 复制脚本内容到剪贴板
const copyScriptContent = (filePath: string, codes: string[]) => {
  const content = `// ${filePath}\n${codes.join("\n")}`;
  navigator.clipboard
    .writeText(content)
    .then(() => {
      logger.log("[DebugPanel] Script copied to clipboard");
    })
    .catch((err) => {
      logger.error("Failed to copy:", err);
    });
};

export const ScriptSection: React.FC<ScriptSectionProps> = ({
  currentScriptInfo,
  isScriptRunning,
  onExecuteScript,
}) => {
  const handleExecuteLine = (code: string) => {
    if (isScriptRunning) {
      alert("脚本正在执行中，请等待执行完成后再操作");
      return;
    }
    onExecuteScript?.(code);
  };

  return (
    <Section title="当前脚本">
      {currentScriptInfo ? (
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div
              className="text-[10px] text-cyan-400 font-mono break-all flex-1"
              title={currentScriptInfo.filePath}
            >
              {currentScriptInfo.filePath}
            </div>
            <button
              type="button"
              onClick={() =>
                copyScriptContent(currentScriptInfo.filePath, currentScriptInfo.allCodes)
              }
              className="text-zinc-500 hover:text-zinc-300 flex-shrink-0 p-0.5"
              title="复制脚本内容"
            >
              📋
            </button>
            {currentScriptInfo.isCompleted && (
              <span className="text-[10px] text-green-400 flex-shrink-0">✓ 已完成</span>
            )}
          </div>
          <DataRow
            label="状态"
            value={
              currentScriptInfo.isCompleted
                ? `已完成 (执行 ${currentScriptInfo.executedLines?.size ?? 0}/${currentScriptInfo.totalLines} 行)`
                : `执行中 ${currentScriptInfo.currentLine + 1} / ${currentScriptInfo.totalLines} (已执行 ${currentScriptInfo.executedLines?.size ?? 0} 行)`
            }
            valueColor={currentScriptInfo.isCompleted ? "text-green-400" : "text-yellow-400"}
          />
          <ScriptCodeView
            codes={currentScriptInfo.allCodes}
            currentLine={currentScriptInfo.currentLine}
            isCompleted={currentScriptInfo.isCompleted}
            executedLines={currentScriptInfo.executedLines}
            onExecuteLine={handleExecuteLine}
            className="mt-1 bg-zinc-900 border border-zinc-700"
          />
        </div>
      ) : (
        <div className="text-[11px] text-zinc-500">无脚本执行中</div>
      )}
    </Section>
  );
};
