// Map system

// Audio system
export * from "./audio";
// Character system
export * from "./character";
// Level system
export * from "./character/level";
// Core types (re-export with explicit exclusions to avoid conflicts)
export {
  type Animation,
  type AnimationFrame,
  type CharacterConfig,
  CharacterKind,
  type CharacterSpriteData,
  CharacterState,
  type CharacterStats,
  DEFAULT_PLAYER_STATS,
  DEFAULT_RUN_SPEED,
  DIALOG_RADIUS,
  type DialogData,
  Direction,
  type GameState,
  type GameVariables,
  type InputState,
  type PlayerData,
  RelationType,
  type ScriptCode,
  type ScriptData,
  type ScriptState,
  type SelectionData,
  type SelectionOption,
  type SpriteData,
  TILE_HEIGHT,
  TILE_WIDTH,
  type Vector2,
} from "./core/types";
// Debug system
// Effects system
// Runtime (engine entrypoints)
export * from "./runtime";
// Storage system
export * from "./storage";
// Data list managers
export * from "./data";
// GUI system
export * from "./gui";
// List managers
export * from "./map";
// Resource management
export * from "./resource";
// Script system
export * from "./script";
// Sprite system (new class-based)
export * from "./sprite";
export * from "./utils";
// Weather system
export * from "./weather";
// WebGL / Renderer abstraction
export { createRenderer, isWebGLAvailable, Canvas2DRenderer, type RendererBackend } from "./renderer";
export type { IRenderer } from "./renderer/i-renderer";
export type { TextureInfo, RenderStats, BlendMode, ColorFilter } from "./renderer/types";
