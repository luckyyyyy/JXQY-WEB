/**
 * GUI module - 引擎 GUI/UI 统一模块
 *
 * 包含:
 * - contract.ts: UI 层与引擎层之间的数据契约 (IUIBridge, UIAction, 面板类型等)
 * - uiBridge.ts: 引擎与 UI 层的桥接器实现
 * - guiManager.ts: 引擎内 GUI 状态管理 (对话框/菜单/选择)
 * - buyManager.ts: 商店购买系统
 * - uiConfig.ts: UI 配置加载
 * - uiSettings.ts: UI 设置加载
 * - types.ts: GUI 类型定义
 */

// UI 契约 (原 ui/contract.ts)
export * from "./contract";

// UI 桥接器 (原 ui/uiBridge.ts)
export { UIBridge, type UIBridgeDeps } from "./ui-bridge";

// GUI 管理器
export * from "./gui-manager";

// 购买管理器
export * from "./buy-manager";

// GUI 类型
export * from "./types";

// UI 配置
export * from "./ui-config";
