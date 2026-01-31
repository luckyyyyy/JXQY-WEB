/**
 * 脚本历史区块
 */

import React, { useRef, useState } from "react";
import { logger } from "@/engine/core/logger";
import { ScriptCodeView } from "../ScriptCodeView";
import { Section } from "../Section";
import type { ScriptHistoryItem } from "../types";

interface ScriptHistorySectionProps {
  scriptHistory: ScriptHistoryItem[];
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

export const ScriptHistorySection: React.FC<ScriptHistorySectionProps> = ({
  scriptHistory,
  isScriptRunning,
  onExecuteScript,
}) => {
  const [hoveredScriptIndex, setHoveredScriptIndex] = useState<number | null>(null);
  const [tooltipVisible, setTooltipVisible] = useState(false);
  const [tooltipY, setTooltipY] = useState(0);
  const hoverTimeoutRef = useRef<number | null>(null);
  const fadeTimeoutRef = useRef<number | null>(null);

  const handleScriptMouseEnter = (idx: number, e: React.MouseEvent) => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
      hoverTimeoutRef.current = null;
    }
    if (fadeTimeoutRef.current) {
      clearTimeout(fadeTimeoutRef.current);
      fadeTimeoutRef.current = null;
    }
    setHoveredScriptIndex(idx);
    setTooltipVisible(true);
    setTooltipY(e.clientY);
  };

  const handleScriptMouseLeave = () => {
    hoverTimeoutRef.current = window.setTimeout(() => {
      setTooltipVisible(false);
      fadeTimeoutRef.current = window.setTimeout(() => {
        setHoveredScriptIndex(null);
      }, 150);
    }, 200);
  };

  const handleExecuteLine = (code: string) => {
    if (isScriptRunning) {
      alert("脚本正在执行中，请等待执行完成后再操作");
      return;
    }
    onExecuteScript?.(code);
  };

  if (scriptHistory.length === 0) return null;

  return (
    <Section title="脚本历史" badge={scriptHistory.length}>
      <div
        className="space-y-0.5 max-h-48 overflow-y-auto"
        style={{ scrollbarWidth: "thin", scrollbarColor: "#52525b transparent" }}
      >
        {scriptHistory.map((item, idx) => (
          <div
            key={`${item.filePath}-${item.timestamp}`}
            className="flex items-center text-[10px] font-mono py-0.5 text-zinc-400 hover:bg-zinc-800/50 cursor-default"
            onMouseEnter={(e) => handleScriptMouseEnter(idx, e)}
            onMouseLeave={handleScriptMouseLeave}
          >
            <span className="w-4 text-center text-zinc-600 mr-1">{idx + 1}</span>
            <span className="flex-1 break-all text-cyan-400/70">{item.filePath}</span>
            <span className="text-zinc-600 ml-1">
              ({item.executedLines?.size ?? 0}/{item.totalLines})
            </span>
          </div>
        ))}
      </div>
      {/* 悬浮提示框 */}
      {hoveredScriptIndex !== null &&
        scriptHistory[hoveredScriptIndex] &&
        (() => {
          const tooltipHeight = Math.min(
            scriptHistory[hoveredScriptIndex].allCodes.length * 20 + 50,
            window.innerHeight * 0.6
          );
          const spaceBelow = window.innerHeight - tooltipY;
          const top =
            spaceBelow < tooltipHeight + 20
              ? Math.max(10, tooltipY - tooltipHeight + 40)
              : Math.max(10, tooltipY - 20);
          const historyItem = scriptHistory[hoveredScriptIndex];
          return (
            <div
              className="fixed z-[9999] bg-zinc-900/50 backdrop-blur-2xl border border-white/20 shadow-2xl shadow-black/50 max-w-lg max-h-[60vh] overflow-auto rounded-xl transition-opacity duration-150 ring-1 ring-white/10"
              style={{
                left: "calc(48px + var(--panel-width, 280px) + 8px)",
                top,
                opacity: tooltipVisible ? 1 : 0,
                transition: "opacity 150ms ease-out",
              }}
              onMouseEnter={() => {
                if (hoverTimeoutRef.current) {
                  clearTimeout(hoverTimeoutRef.current);
                  hoverTimeoutRef.current = null;
                }
                if (fadeTimeoutRef.current) {
                  clearTimeout(fadeTimeoutRef.current);
                  fadeTimeoutRef.current = null;
                }
                setTooltipVisible(true);
              }}
              onMouseLeave={handleScriptMouseLeave}
            >
              <div className="flex items-center px-3 py-2 border-b border-white/10 sticky top-0 bg-zinc-800/20 backdrop-blur-2xl">
                <span className="text-[11px] text-cyan-400 select-text flex-1 font-medium">
                  {historyItem.filePath}
                </span>
                <span className="text-[10px] text-zinc-500 ml-2">
                  (执行 {historyItem.executedLines?.size ?? 0}/{historyItem.totalLines} 行)
                </span>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    copyScriptContent(historyItem.filePath, historyItem.allCodes);
                  }}
                  className="text-zinc-500 hover:text-zinc-300 p-1 ml-2 hover:bg-zinc-700 rounded"
                  title="复制脚本内容"
                >
                  📋
                </button>
              </div>
              <ScriptCodeView
                codes={historyItem.allCodes}
                executedLines={historyItem.executedLines}
                isCompleted={true}
                onExecuteLine={handleExecuteLine}
                className="border-0"
              />
            </div>
          );
        })()}
    </Section>
  );
};
