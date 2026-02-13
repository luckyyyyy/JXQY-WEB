/**
 * Runtime - 引擎生命周期（主循环、输入、相机）
 */

export type { GameEngineConfig, GameEngineState } from "./game-engine";
export { createGameEngine, GameEngine } from "./game-engine";
export type { PerformanceStatsData } from "./performance-stats";

// Re-export from new locations for backward compatibility
export type { SaveData } from "../storage/storage";
export * from "../data/memo-list-manager";
export * from "../data/partner-list";
export * from "../data/talk-text-list";
