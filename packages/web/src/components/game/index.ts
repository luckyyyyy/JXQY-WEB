/**
 * Game Components - 游戏相关的所有组件
 */

// UI 适配器
export * from "./adapters";
export { ClassicGameUI } from "./ClassicGameUI";
// 核心游戏组件
export { Game, type GameHandle, type GameProps } from "./Game";
export { GameCanvas, type GameCanvasHandle, type GameCanvasProps } from "./GameCanvas";
export { GameUI } from "./GameUI";
export type {
  BottomMagicDragData,
  BuyData,
  GameUILogic,
  GoodsData,
  MagicData,
  MinimapState,
} from "./hooks";
// Hooks (避免与 UI 组件的同名类型冲突)
export { useGameUILogic } from "./hooks";
export { LoadingOverlay } from "./LoadingOverlay";

export { ModernGameUIWrapper } from "./ModernGameUIWrapper";
export { WebSaveLoadPanel } from "./WebSaveLoadPanel";
export { ShareOverlay } from "./ShareOverlay";
export { GameTopBar } from "./GameTopBar";
export type { ToolbarButton } from "./GameTopBar";
export { GlassModal } from "./GlassModal";
export { AuthModal } from "./AuthModal";
export { GameMenuPanel, type MenuTab } from "./GameMenuPanel";
export { FloatingPanel } from "./FloatingPanel";
export { DockedPanel } from "./DockedPanel";
// UI 组件
export * from "./ui";
// Note: TooltipState, MagicTooltipState, MagicDragData 已经从 ./ui 导出

// 移动端组件
export * from "./mobile";
