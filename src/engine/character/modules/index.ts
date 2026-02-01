/**
 * Character Modules - 角色模块导出
 * 使用组合模式提取的功能模块，保持类型推导完整
 */

export { StatusEffectsManager, type StatusEffectsData, type StatusEffectsUpdateResult } from "./statusEffects";
export { BezierMover, type BezierMoveData, type BezierMoveUpdateResult, type JumpObstacleChecker } from "./bezierMover";
