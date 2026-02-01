/**
 * Game Components - 游戏相关的所有组件
 */

// 核心游戏组件
export { Game, type GameHandle, type GameProps } from "./Game";
export { GameCanvas, type GameCanvasHandle, type GameCanvasProps } from "./GameCanvas";
export { GameUI } from "./GameUI";
export { LoadingOverlay } from "./LoadingOverlay";
export { MapViewer } from "./MapViewer";

// UI 组件
export * from "./ui";

// UI 适配器
export * from "./adapters";

// 移动端组件
export * from "./mobile";
