/**
 * Debug Panel 工具函数
 */

import { STATE_NAMES } from "./constants";

/**
 * 获取角色状态名称
 */
export const getStateName = (state: number): string => {
  return STATE_NAMES[state] ?? `未知(${state})`;
};

/**
 * 判断是否为可执行的函数行
 */
export const isExecutableLine = (code: string): boolean => {
  const trimmed = code.trim();
  // 空行或纯注释行不可执行
  if (!trimmed || trimmed.startsWith("//") || trimmed.startsWith(";")) {
    return false;
  }
  // 标签行不可执行
  if (trimmed.startsWith("@")) {
    return false;
  }
  // 关键字行不可执行（If, Goto, Return, Else, ElseIf）
  if (/^(If|Goto|Return|Else|ElseIf)\b/.test(trimmed)) {
    return false;
  }
  // 函数调用行可执行（函数名后跟括号）
  if (/^[A-Za-z_][A-Za-z0-9_]*\s*\(/.test(trimmed)) {
    return true;
  }
  return false;
};
