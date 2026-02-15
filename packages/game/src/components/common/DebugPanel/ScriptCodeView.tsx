/**
 * 脚本代码视图组件 - 用于当前脚本和tooltip
 */

import type React from "react";
import { isExecutableLine } from "./utils";

/**
 * 脚本语法高亮
 */
const highlightCode = (code: string): React.ReactNode => {
  // 标签行 @Label:
  if (code.trim().startsWith("@")) {
    return <span className="text-[#c084fc]">{code}</span>;
  }

  const tokens: React.ReactNode[] = [];
  let remaining = code;
  let keyIndex = 0;

  while (remaining.length > 0) {
    // 关键字 If, Goto, Return, Else 等（完整单词）
    const keywordMatch = remaining.match(/^(If|Goto|Return|Else|ElseIf)\b/);
    if (keywordMatch) {
      tokens.push(
        <span key={keyIndex++} className="text-[#c084fc] font-medium">
          {keywordMatch[0]}
        </span>
      );
      remaining = remaining.slice(keywordMatch[0].length);
      continue;
    }

    // 函数名（后面跟括号）
    const funcMatch = remaining.match(/^([A-Za-z_][A-Za-z0-9_]*)(\s*\()/);
    if (funcMatch) {
      tokens.push(
        <span key={keyIndex++} className="text-[#fbbf24]">
          {funcMatch[1]}
        </span>
      );
      tokens.push(
        <span key={keyIndex++} className="text-[#969696]">
          {funcMatch[2]}
        </span>
      );
      remaining = remaining.slice(funcMatch[0].length);
      continue;
    }

    // 字符串 "..."
    const strMatch = remaining.match(/^"([^"]*(?:\\.[^"]*)*)"/);
    if (strMatch) {
      tokens.push(
        <span key={keyIndex++} className="text-[#fb923c]">
          {strMatch[0]}
        </span>
      );
      remaining = remaining.slice(strMatch[0].length);
      continue;
    }

    // 变量 $xxx
    const varMatch = remaining.match(/^\$[A-Za-z_][A-Za-z0-9_]*/);
    if (varMatch) {
      tokens.push(
        <span key={keyIndex++} className="text-[#93c5fd]">
          {varMatch[0]}
        </span>
      );
      remaining = remaining.slice(varMatch[0].length);
      continue;
    }

    // 数字
    const numMatch = remaining.match(/^-?\d+(\.\d+)?/);
    if (numMatch) {
      tokens.push(
        <span key={keyIndex++} className="text-[#4ade80]">
          {numMatch[0]}
        </span>
      );
      remaining = remaining.slice(numMatch[0].length);
      continue;
    }

    // 注释 // 或 ;
    const commentMatch = remaining.match(/^(\/\/.*|;.*)/);
    if (commentMatch) {
      tokens.push(
        <span key={keyIndex++} className="text-[#7fb36b] italic">
          {commentMatch[0]}
        </span>
      );
      remaining = remaining.slice(commentMatch[0].length);
      continue;
    }

    // 运算符
    const opMatch = remaining.match(/^(==|!=|>=|<=|&&|\|\||[+\-*/<>=!])/);
    if (opMatch) {
      tokens.push(
        <span key={keyIndex++} className="text-[#d4d4d4]">
          {opMatch[0]}
        </span>
      );
      remaining = remaining.slice(opMatch[0].length);
      continue;
    }

    // 普通字符
    tokens.push(
      <span key={keyIndex++} className="text-[#d4d4d4]">
        {remaining[0]}
      </span>
    );
    remaining = remaining.slice(1);
  }

  return <>{tokens}</>;
};

interface ScriptCodeViewProps {
  codes: string[];
  currentLine?: number;
  isCompleted?: boolean;
  executedLines?: Set<number>;
  onExecuteLine?: (code: string) => void;
  className?: string;
  /** When true, all line backgrounds become transparent for use in glass-effect tooltips */
  transparent?: boolean;
}

export const ScriptCodeView: React.FC<ScriptCodeViewProps> = ({
  codes,
  currentLine,
  isCompleted = false,
  executedLines,
  onExecuteLine,
  className = "",
  transparent = false,
}) => {
  return (
    <div className={`font-mono text-[10px] ${className}`}>
      {codes.map((code, idx) => {
        const isCurrentLine = !isCompleted && currentLine !== undefined && idx === currentLine;
        // 使用 executedLines 来判断是否真正执行过
        const isExecuted = executedLines
          ? executedLines.has(idx)
          : isCompleted || (currentLine !== undefined && idx < currentLine);
        // 如果有 executedLines，跳过的行用不同样式标识
        const isSkipped =
          executedLines &&
          !executedLines.has(idx) &&
          currentLine !== undefined &&
          idx < currentLine;
        const isFunction = isExecutableLine(code);
        const canExecute = onExecuteLine && isFunction;
        return (
          <div
            key={`line-${idx}`}
            className={`flex px-1 py-0.5 group ${
              isCurrentLine
                ? transparent
                  ? "bg-[#515c28]/20 hover:bg-[#515c28]/30"
                  : "bg-[#515c28]/40 hover:bg-[#515c28]/60"
                : isExecuted
                  ? transparent
                    ? "hover:bg-white/5"
                    : "bg-[#2a3a2a]/30 hover:bg-[#2a3a2a]/50"
                  : isSkipped
                    ? transparent
                      ? "hover:bg-white/5"
                      : "bg-[#2d2d2d] hover:bg-[#37373d]"
                    : transparent
                      ? "hover:bg-white/5"
                      : "hover:bg-[#2a2d2e]"
            }`}
            title={isSkipped ? `[跳过] ${code}` : code}
          >
            <span
              className={`w-4 text-center select-none mr-1 flex-shrink-0 ${
                isCurrentLine
                  ? "text-[#fbbf24]"
                  : isExecuted
                    ? canExecute
                      ? "text-[#4ade80] group-hover:text-[#38bdf8] cursor-pointer"
                      : "text-[#4ade80]"
                    : isSkipped
                      ? "text-[#5a5a5a]"
                      : canExecute
                        ? "text-[#7a7a7a] group-hover:text-[#38bdf8] cursor-pointer"
                        : "text-[#7a7a7a]"
              }`}
              onClick={() => canExecute && onExecuteLine(code)}
              title={
                canExecute
                  ? `点击执行: ${code}`
                  : isCurrentLine
                    ? "当前行"
                    : isSkipped
                      ? "已跳过"
                      : ""
              }
            >
              {isCurrentLine ? (
                "▶"
              ) : isExecuted ? (
                canExecute ? (
                  <span className="group-hover:hidden">✓</span>
                ) : (
                  "✓"
                )
              ) : isSkipped ? (
                "○"
              ) : null}
              {canExecute && !isCurrentLine && <span className="hidden group-hover:inline">▶</span>}
            </span>
            <span
              className={`w-5 text-right mr-2 select-none flex-shrink-0 ${isSkipped ? "text-[#5a5a5a]" : "text-[#7a7a7a]"}`}
            >
              {idx + 1}
            </span>
            <span className={`flex-1 break-all ${isSkipped ? "opacity-50" : ""}`}>
              {highlightCode(code)}
            </span>
          </div>
        );
      })}
    </div>
  );
};
