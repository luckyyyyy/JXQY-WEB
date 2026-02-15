/**
 * Core game constants and global variable types.
 */

// ============= Tile Dimensions =============
export const TILE_WIDTH = 64;
export const TILE_HEIGHT = 32;

// ============= Movement Constants =============
// Globals.cs: BaseSpeed = 100, RunSpeedFold = 8
// Movement uses: Velocity * elapsedSeconds * speedFold
// Walk: speedFold = WalkSpeed (default 1)
// Run: speedFold = RunSpeedFold (default 8)
export const BASE_SPEED = 100;
export const RUN_SPEED_FOLD = 8; // Globals.RunSpeedFold (跑步速度是走路的8倍!)
export const DEFAULT_RUN_SPEED = BASE_SPEED * RUN_SPEED_FOLD;
export const MIN_CHANGE_MOVE_SPEED_PERCENT = -90;

export const DIALOG_RADIUS = 3; // tiles

// ============= Game Variables =============
export interface GameVariables {
  [key: string]: number;
}
