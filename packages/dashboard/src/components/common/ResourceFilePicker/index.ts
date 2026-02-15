/**
 * 资源文件选择器组件
 *
 * 通用的游戏资源文件选择组件，支持：
 * - ASF 动画预览
 * - 音频播放（WAV/OGG）
 * - 文件选择弹窗
 * - 悬停预览
 */

export { AsfPreviewTooltip, MiniAsfPreview } from "./AsfPreviewTooltip";
export { AudioPreview } from "./AudioPreview";
export { FileSelectDialog, type FileSelectDialogProps } from "./FileSelectDialog";
export {
  ResourceFieldGroup,
  ResourceFilePicker,
  type ResourceFilePickerProps,
} from "./ResourceFilePicker";
export {
  buildCharacterResourcePaths,
  buildResourcePath,
  CharacterAsfSearchPaths,
  getBasePath,
  getResourceFileType,
  getResourceUrl,
  ResourceBasePaths,
  type ResourceFileType,
} from "./types";
