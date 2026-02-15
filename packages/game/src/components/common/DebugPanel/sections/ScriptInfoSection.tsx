/**
 * 脚本区块 - 合并当前脚本和脚本历史
 */

import { logger } from "@miu2d/engine/core/logger";
import type React from "react";
import { useRef, useState } from "react";
import { createPortal } from "react-dom";
import { DataRow } from "../DataRow";
import { ScriptCodeView } from "../ScriptCodeView";
import { Section } from "../Section";
import type { ScriptHistoryItem, ScriptInfo } from "../types";

interface ScriptInfoSectionProps {
  currentScriptInfo: ScriptInfo | null;
  scriptHistory?: ScriptHistoryItem[];
  isScriptRunning: boolean;
  onExecuteScript?: (script: string) => Promise<string | null>;
}

// 复制脚本内容到剪贴板
const copyToClipboard = (text: string): void => {
  if (navigator.clipboard?.writeText) {
    navigator.clipboard.writeText(text).catch(() => {
      fallbackCopy(text);
    });
  } else {
    fallbackCopy(text);
  }
};

const fallbackCopy = (text: string): void => {
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand("copy");
  document.body.removeChild(textarea);
};

const copyScriptContent = (filePath: string, codes: string[]) => {
  const content = `// ${filePath}\n${codes.join("\n")}`;
  copyToClipboard(content);
  logger.log("[DebugPanel] Script copied to clipboard");
};

export const ScriptInfoSection: React.FC<ScriptInfoSectionProps> = ({
  currentScriptInfo,
  scriptHistory,
  isScriptRunning,
  onExecuteScript,
}) => {
  const [hoveredScriptIndex, setHoveredScriptIndex] = useState<number | null>(null);
  const [tooltipVisible, setTooltipVisible] = useState(false);
  const [tooltipX, setTooltipX] = useState(0);
  const [tooltipY, setTooltipY] = useState(0);
  const hoverTimeoutRef = useRef<number | null>(null);
  const fadeTimeoutRef = useRef<number | null>(null);

  const handleExecuteLine = (code: string) => {
    if (isScriptRunning) {
      alert("脚本正在执行中，请等待执行完成后再操作");
      return;
    }
    onExecuteScript?.(code);
  };

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
    // 获取触发元素的右边界位置
    const rect = e.currentTarget.getBoundingClientRect();
    setTooltipX(rect.right + 8);
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

  const hasHistory = scriptHistory && scriptHistory.length > 0;

  return (
    <Section title="脚本" badge={hasHistory ? scriptHistory.length : undefined}>
      {/* 当前脚本 */}
      {currentScriptInfo ? (
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div
              className="text-[10px] text-[#93c5fd] font-mono break-all flex-1"
              title={currentScriptInfo.filePath}
            >
              {currentScriptInfo.filePath}
            </div>
            <button
              type="button"
              onClick={() =>
                copyScriptContent(currentScriptInfo.filePath, currentScriptInfo.allCodes)
              }
              className="text-[#969696] hover:text-[#d4d4d4] flex-shrink-0 p-0.5"
              title="复制脚本内容"
            >
              <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
                <path d="M4 4v-2h10v10h-2v2H2V4h2zm1-1H3v10h9V5h-1V3H5v0zm1-2v2h7v7h1V1H6z" />
              </svg>
            </button>
            {currentScriptInfo.isCompleted && (
              <span className="text-[10px] text-[#4ade80] flex-shrink-0">✓ 已完成</span>
            )}
          </div>
          <DataRow
            label="状态"
            value={
              currentScriptInfo.isCompleted
                ? `已完成 (执行 ${currentScriptInfo.executedLines?.size ?? 0}/${currentScriptInfo.totalLines} 行)`
                : `执行中 ${currentScriptInfo.currentLine + 1} / ${currentScriptInfo.totalLines} (已执行 ${currentScriptInfo.executedLines?.size ?? 0} 行)`
            }
            valueColor={currentScriptInfo.isCompleted ? "text-[#4ade80]" : "text-[#fbbf24]"}
          />
          <ScriptCodeView
            codes={currentScriptInfo.allCodes}
            currentLine={currentScriptInfo.currentLine}
            isCompleted={currentScriptInfo.isCompleted}
            executedLines={currentScriptInfo.executedLines}
            onExecuteLine={handleExecuteLine}
            className="mt-1 bg-[#1e1e1e] border border-[#333]"
          />
        </div>
      ) : (
        <div className="text-[11px] text-[#969696] mb-2">无脚本执行中</div>
      )}

      {/* 脚本历史 */}
      {hasHistory && (
        <>
          <div className="text-[10px] text-[#969696] mt-3 mb-1 border-t border-[#2d2d2d] pt-2">
            历史记录
          </div>
          <div
            className="space-y-0.5 max-h-48 overflow-y-auto"
            style={{ scrollbarWidth: "thin", scrollbarColor: "#424242 transparent" }}
          >
            {scriptHistory.map((item, idx) => (
              <div
                key={`${item.filePath}-${item.timestamp}`}
                className="flex items-center text-[10px] font-mono py-0.5 text-[#969696] hover:bg-[#2a2d2e] cursor-default"
                onMouseEnter={(e) => handleScriptMouseEnter(idx, e)}
                onMouseLeave={handleScriptMouseLeave}
              >
                <span className="w-4 text-center text-[#7a7a7a] mr-1">{idx + 1}</span>
                <span className="flex-1 break-all text-[#93c5fd]/70">{item.filePath}</span>
                <span className="text-[#7a7a7a] ml-1">
                  ({item.executedLines?.size ?? 0}/{item.totalLines})
                </span>
              </div>
            ))}
          </div>
          {/* 悬浮提示框 - 通过 Portal 渲染到 body 避免被父容器 overflow/backdrop-filter 裁剪 */}
          {hoveredScriptIndex !== null &&
            scriptHistory[hoveredScriptIndex] &&
            createPortal(
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
                    className="fixed z-[9999] bg-[#1e1e1e]/65 backdrop-blur-xl border border-white/[0.06] shadow-2xl shadow-black/60 max-w-lg max-h-[60vh] overflow-auto transition-opacity duration-150 rounded-lg"
                    style={{
                      left: Math.min(tooltipX, window.innerWidth - 520),
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
                    <div className="flex items-center px-2 py-1 border-b border-white/[0.06] sticky top-0 bg-white/[0.05] rounded-t-lg">
                      <span className="text-[11px] text-[#93c5fd] select-text flex-1 font-medium">
                        {historyItem.filePath}
                      </span>
                      <span className="text-[10px] text-white/25 ml-2">
                        (执行 {historyItem.executedLines?.size ?? 0}/{historyItem.totalLines} 行)
                      </span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          copyScriptContent(historyItem.filePath, historyItem.allCodes);
                        }}
                        className="text-[#969696] hover:text-[#d4d4d4] p-0.5 ml-1 hover:bg-white/10 rounded"
                        title="复制脚本内容"
                      >
                        <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
                          <path d="M4 4v-2h10v10h-2v2H2V4h2zm1-1H3v10h9V5h-1V3H5v0zm1-2v2h7v7h1V1H6z" />
                        </svg>
                      </button>
                    </div>
                    <ScriptCodeView
                      codes={historyItem.allCodes}
                      executedLines={historyItem.executedLines}
                      isCompleted={true}
                      onExecuteLine={handleExecuteLine}
                      className="border-0"
                      transparent
                    />
                  </div>
                );
              })(),
              document.body
            )}
        </>
      )}
    </Section>
  );
};
