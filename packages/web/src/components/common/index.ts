/**
 * Common components - 通用组件（非游戏专属）
 */

// Lazy ASF Icon - 懒加载 ASF 精灵图标
export { LazyAsfIcon } from "./LazyAsfIcon";
export type { LazyAsfIconProps } from "./LazyAsfIcon";

// Number Input - 自定义数字输入框
export { NumberInput } from "./NumberInput";
export type { NumberInputProps } from "./NumberInput";

// Script Editor - Monaco 脚本编辑器
export { ScriptEditor } from "./ScriptEditor";
export type { ScriptEditorProps } from "./ScriptEditor";

// Debug Panel - 开发调试面板
export { DebugPanel } from "./DebugPanel/index";
export type {
  DebugPanelProps,
  LoadedResources,
  PlayerStats as DebugPlayerStats,
  ScriptHistoryItem,
  ScriptInfo,
} from "./DebugPanel/types";
// Grid Background - 改用 @miu2d/ui 包
export { FloatingOrb, GridBackground, GridLine, GridNode, GridPattern } from "@miu2d/ui";

// Side Panel - 侧边面板组件（设置等）
export type { SettingsPanelProps } from "./SidePanel";
export {
  loadAudioSettings,
  loadUITheme,
  SettingsPanel,
  saveAudioSettings,
  saveUITheme,
} from "./SidePanel";

// Resource File Picker - 资源文件选择器
export {
  ResourceFilePicker,
  ResourceFieldGroup,
  FileSelectDialog,
  AsfPreviewTooltip,
  MiniAsfPreview,
  AudioPreview,
  buildResourcePath,
  getResourceFileType,
  getBasePath,
  getResourceUrl,
  ResourceBasePaths,
} from "./ResourceFilePicker";
export type {
  ResourceFilePickerProps,
  FileSelectDialogProps,
  ResourceFileType,
} from "./ResourceFilePicker";
