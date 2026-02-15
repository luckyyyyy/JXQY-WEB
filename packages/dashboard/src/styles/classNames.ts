/**
 * Dashboard 共享样式常量
 *
 * 集中管理重复使用的 Tailwind CSS class 字符串，
 * 避免跨组件硬编码、减少拼写错误。
 */

// ── 表单控件 ──────────────────────────────────────────────

/** 标准输入框 / 选择框 */
export const INPUT_CLS =
  "w-full px-3 py-2 bg-[#1e1e1e] border border-widget-border rounded-lg text-white focus:outline-none focus:border-focus-border";

/** 多行文本框 */
export const TEXTAREA_CLS = `${INPUT_CLS} resize-none`;

/** 表单标签 */
export const LABEL_CLS = "block text-sm text-[#858585] mb-1";

// ── 卡片 / 区块 ──────────────────────────────────────────

/** 表单区块外壳 */
export const SECTION_CLS = "bg-[#252526] border border-widget-border rounded-xl overflow-hidden";

/** 表单区块标题栏 */
export const SECTION_HEADER_CLS =
  "px-4 py-3 border-b border-widget-border flex items-center justify-between";

/** 表单区块标题文字 */
export const SECTION_TITLE_CLS = "text-sm font-medium text-[#cccccc]";

// ── 侧边栏 ──────────────────────────────────────────────

/** 侧边栏容器 */
export const SIDEBAR_CLS = "flex h-full w-60 flex-col bg-[#252526] border-r border-panel-border";

/** 侧边栏标题栏 */
export const SIDEBAR_HEADER_CLS =
  "flex h-9 items-center justify-between px-4 border-b border-panel-border";

/** 侧边栏标题文字 */
export const SIDEBAR_TITLE_CLS = "text-xs font-medium uppercase tracking-wide text-[#bbbbbb]";

/** 侧边栏操作按钮 */
export const SIDEBAR_ACTION_BTN_CLS =
  "flex items-center gap-2 px-2 py-1.5 text-xs text-[#cccccc] hover:bg-[#3c3c3c] rounded transition-colors";

/** 列表项 - 选中 */
export const LIST_ITEM_ACTIVE_CLS = "bg-[#094771] text-white";

/** 列表项 - 未选中 */
export const LIST_ITEM_INACTIVE_CLS = "hover:bg-[#2a2d2e]";

/** 列表项基础 (与 NavLink 的 isActive 配合) */
export const listItemCls = (isActive: boolean) =>
  `flex items-center gap-3 px-3 py-2 text-sm transition-colors ${
    isActive ? LIST_ITEM_ACTIVE_CLS : LIST_ITEM_INACTIVE_CLS
  }`;

// ── 模态框 ──────────────────────────────────────────────

/** 模态遮罩层 */
export const MODAL_OVERLAY_CLS = "fixed inset-0 bg-black/50 flex items-center justify-center z-50";

/** 模态容器 */
export const MODAL_CONTAINER_CLS =
  "bg-[#252526] rounded-lg border border-widget-border max-h-[85vh] overflow-auto";

/** 模态标题栏 */
export const MODAL_HEADER_CLS =
  "flex items-center justify-between px-4 py-3 border-b border-widget-border";

// ── 拖拽上传区域 ─────────────────────────────────────────

/** 拖拽上传区域 - 基础 */
export const DROP_ZONE_BASE_CLS =
  "border-2 border-dashed rounded-lg p-4 text-center transition-colors cursor-pointer";

/** 拖拽上传 - 拖入中 */
export const DROP_ZONE_DRAGGING_CLS = "border-[#0098ff] bg-[#0098ff]/10";

/** 拖拽上传 - 已选择 */
export const DROP_ZONE_SELECTED_CLS = "border-green-500/50 bg-green-500/5";

/** 拖拽上传 - 默认 */
export const DROP_ZONE_DEFAULT_CLS = "border-widget-border hover:border-[#0098ff]";

/** 根据拖拽状态返回 drop zone class */
export const dropZoneCls = (isDragging: boolean, hasFile: boolean) =>
  `${DROP_ZONE_BASE_CLS} ${
    isDragging ? DROP_ZONE_DRAGGING_CLS : hasFile ? DROP_ZONE_SELECTED_CLS : DROP_ZONE_DEFAULT_CLS
  }`;

// ── 过滤器 Tab ──────────────────────────────────────────

/** 过滤器 Tab 按钮 - 选中 */
export const FILTER_TAB_ACTIVE_CLS = "bg-[#094771] text-white";

/** 过滤器 Tab 按钮 - 未选中 */
export const FILTER_TAB_INACTIVE_CLS = "text-[#cccccc] hover:bg-[#3c3c3c]";

/** 过滤器 Tab 基础 + 状态 */
export const filterTabCls = (isActive: boolean) =>
  `flex-1 px-2 py-1 text-xs rounded transition-colors ${
    isActive ? FILTER_TAB_ACTIVE_CLS : FILTER_TAB_INACTIVE_CLS
  }`;

// ── 加载 / 空状态 ───────────────────────────────────────

/** 全屏居中加载 */
export const LOADING_CENTER_CLS = "h-full flex items-center justify-center";

/** 加载文字 */
export const LOADING_TEXT_CLS = "text-[#858585]";

/** 小型内联加载 */
export const LOADING_INLINE_CLS = "px-4 py-2 text-sm text-[#858585]";
