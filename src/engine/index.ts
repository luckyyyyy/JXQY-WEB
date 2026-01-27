// Map system
export * from "./map";

// Core types (re-export with explicit exclusions to avoid conflicts)
export {
  type Vector2,
  type CharacterStats,
  type CharacterConfig,
  type PlayerData,
  type ScriptCode,
  type ScriptData,
  type ScriptState,
  type GameVariables,
  type DialogData,
  type SelectionOption,
  type SelectionData,
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

// Level system
export * from "./level";

// Debug system
export * from "./debug";

// Resource management
export * from "./resource";

// Game management
export * from "./game";

// Sprite system (new class-based)
export * from "./sprite";

