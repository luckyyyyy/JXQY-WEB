/**
 * Engine utilities - re-exports from submodules
 * 引擎工具函数 - 从子模块重新导出
 *
 * Module organization:
 * - coordinate: tile/pixel coordinate conversion (坐标转换)
 * - direction: direction calculation (方向计算)
 * - distance: distance calculation (距离计算)
 * - neighbors: neighbor tile utilities (邻居瓦片)
 * - math: general math functions (数学工具)
 * - collision: collision detection (碰撞检测)
 * - iniParser: INI file parsing (INI解析)
 * - id: ID generation (ID生成)
 */
export type { Rect } from "./collision";
// Collision detection
export { isBoxCollide } from "./collision";
// Coordinate conversion
export { pixelToTile, tileToPixel } from "./coordinate";
// Direction calculation
export {
  getDirection,
  getDirection8,
  getDirection32List,
  getDirectionFromVector,
  getDirectionIndex,
  getDirectionOffset8,
  getDirectionPixelOffset,
  getDirectionTileOffset,
  getDirectionVector,
  getNeighborTileInDirection,
  getPositionInDirection,
  getVOffsets,
} from "./direction";
// Distance calculation
export { distance, getViewTileDistance } from "./distance";
// ID generation
export { generateId } from "./id";
// INI parser
export { parseIni } from "./ini-parser";
// Math utilities
export { clamp, getSpeedRatio, lerp, normalizeVector, vectorLength } from "./math";
// Neighbor utilities
export { getNeighbors } from "./neighbors";
// Path finding
export * from "./path-finder";
// debug-manager has been moved to runtime/ where it logically belongs.
