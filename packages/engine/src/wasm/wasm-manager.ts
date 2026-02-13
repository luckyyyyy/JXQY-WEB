/**
 * WASM 模块统一初始化管理
 *
 * 所有 WASM 功能共享同一个 @miu2d/engine-wasm 模块实例
 * 只需初始化一次，避免重复加载
 */

import { logger } from "../core/logger";
import { setZstdDecompressor } from "../resource/format/mmf";

// WASM 模块类型定义
interface WasmAsfHeader {
  width: number;
  height: number;
  frame_count: number;
  directions: number;
  color_count: number;
  interval: number;
  left: number;
  bottom: number;
  frames_per_direction: number;
}

interface WasmMsfHeader {
  canvas_width: number;
  canvas_height: number;
  frame_count: number;
  directions: number;
  fps: number;
  anchor_x: number;
  anchor_y: number;
  pixel_format: number;
  palette_size: number;
  frames_per_direction: number;
  total_individual_pixel_bytes: number;
}

interface WasmMpcHeader {
  frames_data_length_sum: number;
  global_width: number;
  global_height: number;
  frame_count: number;
  direction: number;
  color_count: number;
  interval: number;
  bottom: number;
  left: number;
  total_pixel_bytes: number;
}

export interface WasmModule {
  // ASF 解码
  parse_asf_header(data: Uint8Array): WasmAsfHeader | undefined;
  decode_asf_frames(data: Uint8Array, output: Uint8Array): number;
  // MSF 解码
  parse_msf_header(data: Uint8Array): WasmMsfHeader | undefined;
  decode_msf_frames(data: Uint8Array, output: Uint8Array): number;
  decode_msf_individual_frames(
    data: Uint8Array,
    pixelOutput: Uint8Array,
    frameSizesOutput: Uint8Array,
    frameOffsetsOutput: Uint8Array
  ): number;
  // MPC 解码
  parse_mpc_header(data: Uint8Array): WasmMpcHeader | undefined;
  decode_mpc_frames(
    data: Uint8Array,
    pixelOutput: Uint8Array,
    frameSizesOutput: Uint8Array,
    frameOffsetsOutput: Uint8Array
  ): number;
  // 寻路
  PathFinder: new (width: number, height: number) => WasmPathFinder;
  // 碰撞检测
  SpatialHash?: new (cellSize: number, width: number, height: number) => WasmSpatialHash;
  // Zstd 解压
  zstd_decompress?(data: Uint8Array): Uint8Array;
}

interface WasmPathFinder {
  find_path(
    startX: number,
    startY: number,
    endX: number,
    endY: number,
    pathType: number,
    direction: number
  ): Int32Array | null;
  set_obstacle(x: number, y: number, blocked: boolean): void;
  update_obstacle_bitmap(bitmap: Uint8Array): void;
  free(): void;
}

interface WasmSpatialHash {
  insert(id: number, x: number, y: number, width: number, height: number): void;
  remove(id: number): void;
  update(id: number, x: number, y: number, width: number, height: number): void;
  query(x: number, y: number, width: number, height: number): Int32Array;
  clear(): void;
  free(): void;
}

// 全局唯一的 WASM 模块实例
let wasmModule: WasmModule | null = null;
let initPromise: Promise<boolean> | null = null;
let isInitialized = false;

/**
 * 初始化 WASM 模块（全局唯一）
 *
 * 可以在应用启动时调用一次，后续调用会直接返回已初始化的结果
 */
export async function initWasm(): Promise<boolean> {
  if (isInitialized) {
    return true;
  }

  if (initPromise) {
    return initPromise;
  }

  initPromise = (async () => {
    try {
      const wasm = await import("@miu2d/engine-wasm");
      await wasm.default();

      wasmModule = wasm as unknown as WasmModule;
      isInitialized = true;

      // 注册 zstd 解压器（用于 MMF 地图格式解压）
      if (wasmModule.zstd_decompress) {
        setZstdDecompressor((data: Uint8Array) => wasmModule!.zstd_decompress!(data));
        logger.debug("[Wasm] zstd decompressor registered");
      }

      logger.info("[Wasm] Module initialized");
      return true;
    } catch (error) {
      logger.warn("[Wasm] Failed to initialize", error);
      return false;
    }
  })();

  return initPromise;
}

/**
 * 获取 WASM 模块实例
 *
 * 如果尚未初始化，返回 null
 * 建议先调用 initWasm() 或 ensureWasmReady()
 */
export function getWasmModule(): WasmModule | null {
  return wasmModule;
}

/**
 * 确保 WASM 已初始化，然后返回模块
 *
 * 如果初始化失败，返回 null
 */
export async function ensureWasmReady(): Promise<WasmModule | null> {
  await initWasm();
  return wasmModule;
}

/**
 * 检查 WASM 是否已初始化
 */
export function isWasmReady(): boolean {
  return isInitialized && wasmModule !== null;
}
