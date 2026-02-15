/**
 * GUI module - 引擎 GUI/UI 统一模块
 *
 * 包含:
 * - contract.ts: UI 层与引擎层之间的数据契约 (UIBridge, UIAction, 面板类型等)
 * - ui-bridge.ts: 引擎与 UI 层的桥接器实现
 * - gui-manager.ts: 引擎内 GUI 状态管理 (对话框/菜单/选择)
 * - ui-settings.ts: UI 设置加载
 * - memo-list-manager.ts: 任务日志管理
 * - talk-text-list.ts: 对话文本列表
 * - types.ts: GUI 类型定义
 */

// GUI 管理器
export * from "./gui-manager";

// UI 桥接器
export { type UIBridgeDeps, UIBridgeImpl } from "./ui-bridge";
// UI 契约 + GUI 类型（合并为单一入口）
export * from "./ui-types";

// (已合并到 ui-types.ts)

// 商店管理
export * from "./buy-manager";

// 任务日志 & 对话文本
export * from "./memo-list-manager";
export * from "./talk-text-list";
// UI 配置 & 设置
export * from "./ui-settings";
