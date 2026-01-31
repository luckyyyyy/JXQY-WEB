/**
 * GameEvents - 定义游戏引擎与UI层之间的所有事件类型
 *
 * 事件命名规范:
 * - ui:xxx - UI状态变化事件
 * - game:xxx - 游戏逻辑事件
 * - render:xxx - 渲染相关事件
 *
 * 设计原则（方案A - 完全事件驱动）:
 * - 每个事件携带完整的新状态数据
 * - React 组件订阅事件并直接使用事件数据
 * - 避免从引擎读取可变状态对象
 */

import type { DialogGuiState, MultiSelectionGuiState, PanelState, SelectionGuiState } from "../gui/types";

// ============= UI 事件 =============

/**
 * UI面板打开/关闭事件
 */
export interface UIPanelChangeEvent {
  panel: keyof PanelState | null;
  isOpen: boolean;
  panels: PanelState; // 完整的面板状态
}

/**
 * 对话框状态变化 - 携带完整对话框状态
 */
export interface UIDialogChangeEvent {
  dialog: DialogGuiState;
}

/**
 * 选项框状态变化 - 携带完整选项框状态
 */
export interface UISelectionChangeEvent {
  selection: SelectionGuiState;
}

/**
 * 多选框状态变化 - 携带完整多选框状态
 */
export interface UIMultiSelectionChangeEvent {
  selection: MultiSelectionGuiState;
}

/**
 * HUD更新事件 - 生命/内力/体力
 */
export interface UIHudUpdateEvent {
  life: number;
  lifeMax: number;
  mana: number;
  manaMax: number;
  thew: number;
  thewMax: number;
}

/**
 * 消息通知状态变化事件 - 携带完整消息状态
 */
export interface UIMessageChangeEvent {
  messageText: string;
  messageVisible: boolean;
  messageTimer: number;
}

/**
 * 物品变化事件
 */
export interface UIGoodsChangeEvent {
  version: number;
}

/**
 * 武功变化事件
 */
export interface UIMagicChangeEvent {
  version: number;
}

/**
 * 对话框关闭事件 - 用于通知脚本系统继续执行
 */
export type UIDialogClosedEvent = {};

/**
 * 菜单打开事件
 */
export interface UIMenuOpenEvent {
  menu: string | null;
}

/**
 * 菜单关闭事件
 */
export type UIMenuCloseEvent = {};

/**
 * 任务备忘录变化事件
 */
export interface UIMemoChangeEvent {
  action: "added" | "deleted" | "updated";
  text?: string;
  textId?: number;
}

/**
 * 商店变化事件
 */
export interface UIBuyChangeEvent {
  isOpen: boolean;
  version: number;
}

/**
 * 返回标题界面事件
 */
export interface ReturnToTitleEvent {}

/**
 * 视频播放事件
 */
export interface UIVideoPlayEvent {
  file: string;
}

/**
 * 视频播放结束事件
 */
export interface UIVideoEndEvent {}

// ============= 游戏事件 =============

/**
 * 地图加载事件
 */
export interface GameMapLoadEvent {
  mapPath: string;
  mapName: string;
}

/**
 * 游戏初始化完成事件
 */
export interface GameInitializedEvent {
  success: boolean;
}

/**
 * 游戏加载进度事件
 */
export interface GameLoadProgressEvent {
  progress: number; // 0-100
  text: string;
}

// ============= 渲染事件 =============

/**
 * 请求重新渲染
 */
export interface RenderRequestEvent {
  reason?: string;
}

/**
 * 屏幕尺寸变化
 */
export interface ScreenResizeEvent {
  width: number;
  height: number;
}

// ============= 事件名称常量 =============
export const GameEvents = {
  // UI 事件 - 携带完整状态
  UI_PANEL_CHANGE: "ui:panel:change",
  UI_DIALOG_CHANGE: "ui:dialog:change", // 对话框状态变化（携带完整DialogGuiState）
  UI_DIALOG_CLOSED: "ui:dialog:closed", // 对话框关闭（通知脚本系统）
  UI_SELECTION_CHANGE: "ui:selection:change", // 选项框状态变化（携带完整SelectionGuiState）
  UI_MULTI_SELECTION_CHANGE: "ui:multi_selection:change", // 多选框状态变化
  UI_HUD_UPDATE: "ui:hud:update",
  UI_MESSAGE_CHANGE: "ui:message:change",
  UI_GOODS_CHANGE: "ui:goods:change",
  UI_MAGIC_CHANGE: "ui:magic:change",
  UI_MENU_OPEN: "ui:menu:open",
  UI_MENU_CLOSE: "ui:menu:close",
  UI_MEMO_CHANGE: "ui:memo:change",
  UI_BUY_CHANGE: "ui:buy:change", // 商店状态变化
  UI_VIDEO_PLAY: "ui:video:play", // 视频播放事件
  UI_VIDEO_END: "ui:video:end", // 视频播放结束事件

  // 游戏事件
  GAME_INITIALIZED: "game:initialized",
  GAME_MAP_LOAD: "game:map:load",
  GAME_LOAD_PROGRESS: "game:load:progress",
  GAME_PAUSE: "game:pause",
  GAME_RESUME: "game:resume",
  RETURN_TO_TITLE: "game:return_to_title",

  // 渲染事件
  RENDER_REQUEST: "render:request",
  SCREEN_RESIZE: "screen:resize",
} as const;

export type GameEventName = (typeof GameEvents)[keyof typeof GameEvents];
