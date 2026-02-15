/**
 * WASM 模块统一导出
 *
 * 使用方式：
 * 1. 应用启动时：await initWasm()
 * 2. 其他地方直接 import 使用解码函数
 */

// ASF/MPC 解码器
export { decodeAsfWasm } from "./wasm-asf-decoder";
// 碰撞检测
export {
  checkAabbCollision,
  checkCircleCollision,
  initWasmCollision,
  isWasmCollisionAvailable,
  pointInCircle,
  pointInRect,
  WasmSpatialHashWrapper,
} from "./wasm-collision";
// 统一的 WASM 初始化（应用启动时调用一次）
export { getWasmModule, initWasm, isWasmReady } from "./wasm-manager";
export { decodeMpcWasm } from "./wasm-mpc-decoder";

// 寻路
export {
  disposeWasmPathfinder,
  findPathWasm,
  initWasmPathfinder,
  PathType,
  syncDynamicObstacles,
  syncStaticObstacles,
} from "./wasm-path-finder";
