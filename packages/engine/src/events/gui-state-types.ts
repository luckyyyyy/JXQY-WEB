/**
 * GUI State Types - 事件系统使用的 GUI 状态类型
 *
 * 这些类型是事件 payload 的一部分，
 * 被 events/game-events.ts、script/、gui/ 等多个模块共享。
 * 放在 events/ 中与事件契约一起维护。
 */

// === 对话和选择 ===

export interface DialogGuiState {
  isVisible: boolean;
  text: string;
  portraitIndex: number;
  portraitSide: "left" | "right";
  nameText: string;
  textProgress: number;
  isComplete: boolean;
  // 选择模式
  isInSelecting: boolean;
  selectA: string;
  selectB: string;
  selection: number;
}

export interface SelectionGuiState {
  isVisible: boolean;
  message: string;
  options: SelectionOptionData[];
  selectedIndex: number;
  hoveredIndex: number;
}

export interface MultiSelectionGuiState {
  isVisible: boolean;
  message: string;
  options: SelectionOptionData[];
  columns: number;
  selectionCount: number;
  selectedIndices: number[];
}

export interface SelectionOptionData {
  text: string;
  label: string;
  enabled: boolean;
}

// === 面板可见性 ===

export interface PanelState {
  state: boolean;
  equip: boolean;
  xiulian: boolean;
  goods: boolean;
  magic: boolean;
  memo: boolean;
  system: boolean;
  saveLoad: boolean;
  buy: boolean;
  npcEquip: boolean;
  title: boolean;
  timer: boolean;
  littleMap: boolean;
  gamble: boolean;
}
