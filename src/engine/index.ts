// Base engine types and utilities
export * from "./types";
export * from "./mpc";
export * from "./map";
export * from "./renderer";

// Core types (re-export with explicit exclusions to avoid conflicts)
export {
  type Vector2,
  type CharacterStats,
  type CharacterConfig,
  type NpcData,
  type PlayerData,
  type ScriptCode,
  type ScriptData,
  type ScriptState,
  type GameVariables,
  type DialogData,
  type SelectionOption,
  type SelectionData,
  type TrapData,
  type GameState,
  type InputState,
  type AnimationFrame,
  type Animation,
  type SpriteData,
  type CharacterSpriteData,
  CharacterKind,
  RelationType,
  CharacterState,
  Direction,
  TILE_WIDTH,
  TILE_HEIGHT,
  DEFAULT_WALK_SPEED,
  DEFAULT_RUN_SPEED,
  DIALOG_RADIUS,
  DEFAULT_PLAYER_STATS,
} from "./core/types";

export * from "./core/utils";

// Script system
export * from "./script";

// Character system
export * from "./character";

// GUI system
export * from "./gui";

// List managers
export * from "./listManager";

// Audio system
export * from "./audio";

// Effects system
export * from "./effects";

// Game management
export * from "./game";

// Sprite and character rendering
export { loadAsf, clearAsfCache, getFrameCanvas, getFrameIndex, drawAsfFrame, type AsfData, type AsfFrame } from "./asf";
export * from "./sprite";
export * from "./characterRenderer";
