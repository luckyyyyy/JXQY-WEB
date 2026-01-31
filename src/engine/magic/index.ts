/**
 * Magic System - exports
 * 武功系统导出
 */

// Effects System (主动效果)
export * from "./effects";

// Loader
export {
  clearMagicCache,
  getCachedMagic,
  getMagicAtLevel,
  loadMagic,
  parseMagicIni,
  preloadMagics,
} from "./magicLoader";

// Magic Manager
export { MagicManager, type MagicManagerDeps } from "./magicManager";
// Magic Renderer
export { MagicRenderer, magicRenderer } from "./magicRenderer";
// MagicSprite class (inherits from Sprite)
// C# Reference: MagicSprite.cs - 武功精灵类
export { MagicSprite, type WorkItem } from "./magicSprite";
// Magic Utils
export {
  getDirection8,
  getDirection32List,
  getDirectionIndex,
  getDirectionOffset8,
  getSpeedRatio,
  getVOffsets,
  MAGIC_BASE_SPEED,
  normalizeVector,
} from "./magicUtils";
// Passives System (被动效果 - 修炼武功)
export * from "./passives";
// Types
export * from "./types";
