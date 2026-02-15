/**
 * Game Components - 游戏相关的所有组件
 */

export { AuthModal } from "./AuthModal";
// UI 适配器
export * from "./adapters";
export { ClassicGameUI } from "./ClassicGameUI";
// Common components
export { DebugPanel } from "./common/DebugPanel";
export type {
  DebugPanelProps,
  LoadedResources,
  PlayerStats as DebugPlayerStats,
  ScriptHistoryItem,
  ScriptInfo,
} from "./common/DebugPanel/types";
export type { SettingsPanelProps } from "./common/SidePanel";
export {
  loadAudioSettings,
  loadUITheme,
  SettingsPanel,
  saveAudioSettings,
  saveUITheme,
} from "./common/SidePanel";
export { DockedPanel } from "./DockedPanel";
export { FloatingPanel } from "./FloatingPanel";
// 核心游戏组件
export { Game, type GameHandle, type GameProps } from "./Game";
export { GameCanvas, type GameCanvasHandle, type GameCanvasProps } from "./GameCanvas";
export { GameMenuPanel, type MenuTab } from "./GameMenuPanel";
export type { ToolbarButton } from "./GameTopBar";
export { GameTopBar } from "./GameTopBar";
export { GameUI } from "./GameUI";
export { GlassModal } from "./GlassModal";
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
// 移动端组件
export * from "./mobile";
export { ShareOverlay } from "./ShareOverlay";
// UI 组件
export * from "./ui";
export { WebSaveLoadPanel } from "./WebSaveLoadPanel";
