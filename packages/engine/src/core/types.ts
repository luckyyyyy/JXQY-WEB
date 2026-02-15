/**
 * Barrel re-export — keeps all existing `from "../core/types"` imports working.
 *
 * Actual definitions live in focused modules:
 *   - core/vector2.ts          → Vector2
 *   - core/enums.ts            → Direction, CharacterState
 *   - core/constants.ts        → TILE_*, BASE_SPEED, RUN_SPEED_FOLD, GameVariables
 *   - core/character-types.ts  → CharacterKind, RelationType, ActionType,
 *                                CharacterStats, CharacterConfig, ApiResourceEntry,
 *                                DEFAULT_CHARACTER_CONFIG
 */

export type {
  ApiResourceEntry,
  CharacterConfig,
  CharacterStats,
} from "./character-types";
export {
  ActionType,
  CharacterKind,
  DEFAULT_CHARACTER_CONFIG,
  RelationType,
} from "./character-types";
export type { GameVariables } from "./constants";
export {
  BASE_SPEED,
  DEFAULT_RUN_SPEED,
  DIALOG_RADIUS,
  MIN_CHANGE_MOVE_SPEED_PERCENT,
  RUN_SPEED_FOLD,
  TILE_HEIGHT,
  TILE_WIDTH,
} from "./constants";
export { CharacterState, Direction } from "./enums";
export type { Vector2 } from "./vector2";
