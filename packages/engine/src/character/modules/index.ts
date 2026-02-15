/**
 * Character Modules - 角色模块导出
 * 使用组合模式提取的功能模块，保持类型推导完整
 */

export {
  type BezierMoveData,
  BezierMover,
  type BezierMoveUpdateResult,
  type JumpObstacleChecker,
} from "./bezier-mover";
export {
  type FlyIniInfo,
  FlyIniManager,
  parseMagicList,
  parseMagicListNoDistance,
} from "./fly-ini-manager";
export { StatusEffectsManager, type StatusEffectsUpdateResult } from "./status-effects";
