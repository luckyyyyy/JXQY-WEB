/**
 * Game Manager - Index file
 * Re-exports all game management components
 */

export { CameraController } from "./cameraController";
export type { GameManagerConfig } from "./gameManager";
export { GameManager } from "./gameManager";
export type { InputHandlerDependencies } from "./inputHandler";
export { InputHandler } from "./inputHandler";
export type { LoaderDependencies } from "./loader";
export { Loader } from "./loader";
export type { MagicHandlerDependencies } from "./magicHandler";

export { MagicHandler } from "./magicHandler";
export type { ScriptContextDependencies } from "./scriptContextFactory";
export { createScriptContext } from "./scriptContextFactory";

export { SpecialActionHandler } from "./specialActionHandler";

// SpecialActionHandler 不再需要 Dependencies 接口，通过 IEngineContext 获取依赖

export type { CanvasRenderInfo, GameEngineConfig, GameEngineState } from "./gameEngine";
// Game Engine (Singleton)
export { GameEngine, getGameEngine } from "./gameEngine";

// Performance Stats
export { PerformanceStats } from "./performanceStats";
export type { PerformanceStatsData } from "./performanceStats";

export type {
  InteractionTarget,
  InteractionTargetType,
  ObjInteractionState,
} from "./interactionManager";
export { EdgeColors, InteractionManager } from "./interactionManager";
