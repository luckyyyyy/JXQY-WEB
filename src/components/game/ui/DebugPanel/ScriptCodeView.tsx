/**
 * 脚本代码视图组件 - 用于当前脚本和tooltip
 */

import React from "react";
import { isExecutableLine } from "./utils";

/**
 * 脚本语法高亮
 */
const highlightCode = (code: string): React.ReactNode => {
  // 标签行 @Label:
  if (code.trim().startsWith("@")) {
    return <span className="text-purple-400">{code}</span>;
  }

  const tokens: React.ReactNode[] = [];
  let remaining = code;
  let keyIndex = 0;

  while (remaining.length > 0) {
    // 关键字 If, Goto, Return, Else 等（完整单词）
    const keywordMatch = remaining.match(/^(If|Goto|Return|Else|ElseIf)\b/);
    if (keywordMatch) {
      tokens.push(
        <span key={keyIndex++} className="text-pink-400 font-medium">
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
        <span key={keyIndex++} className="text-yellow-400">
          {funcMatch[1]}
        </span>
      );
      tokens.push(
        <span key={keyIndex++} className="text-zinc-400">
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
        <span key={keyIndex++} className="text-green-400">
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
        <span key={keyIndex++} className="text-cyan-400">
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
        <span key={keyIndex++} className="text-orange-400">
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
        <span key={keyIndex++} className="text-zinc-500 italic">
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
        <span key={keyIndex++} className="text-pink-300">
          {opMatch[0]}
        </span>
      );
      remaining = remaining.slice(opMatch[0].length);
      continue;
    }

    // 普通字符
    tokens.push(
      <span key={keyIndex++} className="text-zinc-300">
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
}

export const ScriptCodeView: React.FC<ScriptCodeViewProps> = ({
  codes,
  currentLine,
  isCompleted = false,
  executedLines,
  onExecuteLine,
  className = "",
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
            key={idx}
            className={`flex px-1 py-0.5 group ${
              isCurrentLine
                ? "bg-yellow-900/30 hover:bg-yellow-900/50"
                : isExecuted
                  ? "bg-green-900/10 hover:bg-green-900/20"
                  : isSkipped
                    ? "bg-zinc-800/30 hover:bg-zinc-800/50"
                    : "hover:bg-white/10"
            }`}
            title={isSkipped ? `[跳过] ${code}` : code}
          >
            <span
              className={`w-4 text-center select-none mr-1 flex-shrink-0 ${
                isCurrentLine
                  ? "text-yellow-400"
                  : isExecuted
                    ? canExecute
                      ? "text-green-500 group-hover:text-cyan-400 cursor-pointer"
                      : "text-green-500"
                    : isSkipped
                      ? "text-zinc-700"
                      : canExecute
                        ? "text-zinc-600 group-hover:text-cyan-400 cursor-pointer"
                        : "text-zinc-600"
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
              className={`w-5 text-right mr-2 select-none flex-shrink-0 ${isSkipped ? "text-zinc-700" : "text-zinc-600"}`}
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
