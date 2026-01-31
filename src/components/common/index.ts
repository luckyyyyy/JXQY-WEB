/**
 * Common components - 通用组件（非游戏专属）
 */

// Grid Background
export { GridBackground, GridLine, GridNode, FloatingOrb, GridPattern } from "./GridBackground";

// Debug Panel - 开发调试面板
export { DebugPanel } from "./DebugPanel/index";
export type {
  DebugPanelProps,
  LoadedResources,
  PlayerStats as DebugPlayerStats,
  ScriptHistoryItem,
  ScriptInfo,
} from "./DebugPanel/types";

// Side Panel - 侧边面板组件（存档/设置等）
export type { SaveLoadPanelProps, SettingsPanelProps } from "./SidePanel";
export {
  loadAudioSettings,
  SaveLoadPanel,
  SettingsPanel,
  saveAudioSettings,
} from "./SidePanel";
