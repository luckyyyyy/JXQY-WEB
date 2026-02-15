/**
 * Debug Panel 常量
 */

// 角色状态名称映射
export const STATE_NAMES: Record<number, string> = {
  0: "站立",
  1: "站立1",
  2: "行走",
  3: "奔跑",
  4: "跳跃",
  5: "战斗站立",
  6: "战斗行走",
  7: "战斗奔跑",
  8: "战斗跳跃",
  9: "攻击",
  10: "攻击1",
  11: "攻击2",
  12: "施法",
  13: "受伤",
  14: "死亡",
  15: "打坐",
  16: "特殊",
};

// localStorage keys
export const LS_SCRIPT_CONTENT = "debug_script_content";
export const LS_SCRIPT_HISTORY = "debug_script_history";
export const MAX_HISTORY = 20;

// 样式类 — VS Code Dark Theme
export const inputClass =
  "px-2 py-1 text-[11px] bg-[#3c3c3c] border border-[#3c3c3c] text-[#d4d4d4] focus:outline-none focus:border-[#007acc]";
export const selectClass =
  "px-2 py-1 text-[11px] bg-[#3c3c3c] border border-[#3c3c3c] text-[#d4d4d4] focus:outline-none focus:border-[#007acc] cursor-pointer [&>option]:text-[#d4d4d4] [&>option]:bg-[#252526]";
export const btnClass =
  "px-2 py-1 text-[11px] bg-[#3c3c3c] hover:bg-[#505050] text-[#d4d4d4] border border-[#505050] disabled:opacity-50 disabled:cursor-not-allowed";
export const btnPrimary =
  "px-2 py-1 text-[11px] bg-[#0e639c] hover:bg-[#1177bb] text-white border border-[#0e639c] disabled:opacity-50 disabled:cursor-not-allowed";
