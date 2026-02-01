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
 * - bezier: Bezier curve calculation (贝塞尔曲线)
 * - iniParser: INI file parsing (INI解析)
 * - encoding: text encoding (文本编码)
 * - edgeDetection: edge detection for sprites (边缘检测)
 * - id: ID generation (ID生成)
 */

// Coordinate conversion
export { tileToPixel, pixelToTile } from "./coordinate";

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
export { distance, tileDistance, getViewTileDistance } from "./distance";

// Neighbor utilities
export { getNeighbors, getWalkableNeighbors } from "./neighbors";

// Math utilities
export { lerp, clamp, vectorLength, normalizeVector, getSpeedRatio } from "./math";

// Collision detection
export { isBoxCollide } from "./collision";
export type { Rect } from "./collision";

// Bezier curve
export { bezier2D } from "./bezier";

// INI parser
export { parseIni } from "./iniParser";

// Encoding
export { decodeGb2312, getTextDecoder } from "./encoding";

// Edge detection
export { getOuterEdge } from "./edgeDetection";

// ID generation
export { generateId } from "./id";

// Binary utilities
export { getLittleEndianInt, readNullTerminatedString, readFixedString } from "./binaryUtils";
