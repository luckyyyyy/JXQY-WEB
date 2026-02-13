/**
 * 资源文件选择器组件
 *
 * 通用的游戏资源文件选择组件，支持：
 * - ASF 动画预览
 * - 音频播放（WAV/OGG）
 * - 文件选择弹窗
 * - 悬停预览
 */
export {
  ResourceFilePicker,
  ResourceFieldGroup,
  type ResourceFilePickerProps,
} from "./ResourceFilePicker";
export { FileSelectDialog, type FileSelectDialogProps } from "./FileSelectDialog";
export { AsfPreviewTooltip, MiniAsfPreview } from "./AsfPreviewTooltip";
export { AudioPreview } from "./AudioPreview";
export {
  buildResourcePath,
  getResourceFileType,
  getBasePath,
  getResourceUrl,
  buildCharacterResourcePaths,
  CharacterAsfSearchPaths,
  ResourceBasePaths,
  type ResourceFileType,
} from "./types";
