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

// 样式类
export const inputClass =
  "px-2 py-1 text-[11px] bg-zinc-800 border border-zinc-600 text-zinc-200 focus:outline-none focus:border-blue-500";
export const selectClass =
  "px-2 py-1 text-[11px] bg-zinc-800 border border-zinc-600 text-zinc-200 focus:outline-none focus:border-blue-500 cursor-pointer";
export const btnClass =
  "px-2 py-1 text-[11px] bg-zinc-700 hover:bg-zinc-600 text-zinc-200 border border-zinc-600 disabled:opacity-50 disabled:cursor-not-allowed";
export const btnPrimary =
  "px-2 py-1 text-[11px] bg-blue-600 hover:bg-blue-500 text-white border border-blue-500 disabled:opacity-50 disabled:cursor-not-allowed";
