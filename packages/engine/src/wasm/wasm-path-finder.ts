/**
 * WASM PathFinder 桥接层
 * 提供与原生 TypeScript pathFinder.ts 相同的接口
 *
 * WASM 初始化统一由 wasmManager 管理，本模块不再独立初始化
 *
 * 使用方式:
 * 1. 调用 initWasmPathfinder() 初始化
 * 2. 使用 findPathWasm() 替代 findPath()
 */

import { logger } from "../core/logger";
import type { Vector2 } from "../core/types";
import { ensureWasmReady, isWasmReady } from "./wasm-manager";
import type { WasmModule } from "./wasm-manager";

// PathFinder 实例（在 WASM 初始化后创建，绑定到具体地图尺寸）
interface WasmPathFinderInstance {
  set_obstacle_bitmap(bitmap: Uint8Array, hardBitmap: Uint8Array): void;
  set_obstacle(x: number, y: number, isObstacle: boolean, isHard: boolean): void;
  find_path(
    startX: number,
    startY: number,
    endX: number,
    endY: number,
    pathType: number,
    canMoveDirectionCount: number
  ): Int32Array;
}

let wasmPathfinder: WasmPathFinderInstance | null = null;
let isPathfinderReady = false;

/**
 * 初始化 WASM 寻路模块
 * 委托给 wasmManager 统一初始化 WASM，再创建 PathFinder 实例
 */
export async function initWasmPathfinder(mapWidth: number, mapHeight: number): Promise<boolean> {
  if (isPathfinderReady && wasmPathfinder) {
    return true;
  }

  try {
    const wasmModule = await ensureWasmReady();
    if (!wasmModule) {
      logger.warn("[WasmPathFinder] WASM not available");
      return false;
    }

    wasmPathfinder = new (wasmModule as WasmModule).PathFinder(mapWidth, mapHeight) as unknown as WasmPathFinderInstance;
    isPathfinderReady = true;

    logger.info(`[WasmPathFinder] Initialized with map size ${mapWidth}x${mapHeight}`);
    return true;
  } catch (error) {
    logger.warn("[WasmPathFinder] Failed to initialize, falling back to JS implementation", error);
    return false;
  }
}

/**
 * 检查 WASM 是否可用
 */
export function isWasmPathfinderAvailable(): boolean {
  return isWasmReady() && isPathfinderReady && wasmPathfinder !== null;
}

/**
 * 更新障碍物位图
 */
export function updateObstacleBitmap(bitmap: Uint8Array, hardBitmap: Uint8Array): void {
  if (!wasmPathfinder) return;
  wasmPathfinder.set_obstacle_bitmap(bitmap, hardBitmap);
}

/**
 * 设置单个障碍物
 */
export function setObstacle(x: number, y: number, isObstacle: boolean, isHard: boolean): void {
  if (!wasmPathfinder) return;
  wasmPathfinder.set_obstacle(x, y, isObstacle, isHard);
}

/**
 * PathType 枚举（与 pathFinder.ts 保持一致）
 */
export enum WasmPathType {
  PathOneStep = 0,
  SimpleMaxNpcTry = 1,
  PerfectMaxNpcTry = 2,
  PerfectMaxPlayerTry = 3,
  PathStraightLine = 4,
}

/**
 * WASM 寻路
 * 返回格式与原 findPath 相同
 */
export function findPathWasm(
  startX: number,
  startY: number,
  endX: number,
  endY: number,
  pathType: WasmPathType = WasmPathType.PerfectMaxPlayerTry,
  canMoveDirectionCount: number = 8
): Vector2[] {
  if (!wasmPathfinder) {
    logger.warn("[WasmPathFinder] Not initialized");
    return [];
  }

  const result = wasmPathfinder.find_path(
    startX,
    startY,
    endX,
    endY,
    pathType,
    canMoveDirectionCount
  );

  // 转换 Int32Array [x1, y1, x2, y2, ...] 为 Vector2[]
  const path: Vector2[] = [];
  for (let i = 0; i < result.length; i += 2) {
    path.push({ x: result[i], y: result[i + 1] });
  }

  return path;
}

/**
 * 销毁 WASM 寻路实例
 */
export function disposeWasmPathfinder(): void {
  wasmPathfinder = null;
  isPathfinderReady = false;
}
