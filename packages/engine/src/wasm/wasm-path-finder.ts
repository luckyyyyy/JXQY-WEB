/**
 * WASM PathFinder 桥接层 — 零拷贝共享内存方案
 *
 * 架构：
 * 1. 静态障碍物（isMapObstacle / isHardObstacle）：地图加载时写入 WASM 线性内存
 * 2. 动态障碍物（hasObstacle = NPC + Obj + Magic + Player）：每帧写入 WASM 线性内存
 * 3. 寻路调用：Rust 直接读取 WASM 内存中的 bitmap，零 FFI 开销
 *
 * 共享内存原理：
 *   JS 通过 PathFinder.xxx_bitmap_ptr() 获取 Rust Vec<u8> 在 WASM 线性内存中的偏移量，
 *   然后 new Uint8Array(wasmMemory.buffer, offset, byteSize) 创建视图。
 *   JS 写入视图 → Rust 读取同一块内存 → 零拷贝。
 *
 * 用法：
 *   1. initWasmPathfinder(width, height) — 地图加载时调用
 *   2. syncStaticObstacles(barriers, cols, rows) — 地图加载后一次性同步
 *   3. syncDynamicObstacles(npcMgr, objMgr, magicMgr, player) — 每帧调用
 *   4. findPathWasm(...) — 替代 TS findPath()
 */

import { logger } from "../core/logger";
import type { Vector2 } from "../core/types";
import { OBSTACLE, TRANS } from "../map/map-base";
import { PathType } from "../utils/path-finder";
import type { WasmModule } from "./wasm-manager";
import { ensureWasmReady, getWasmMemory } from "./wasm-manager";

// === 内部类型 ===

/** 简化的 NPC 管理器接口（避免强引用具体类） */
interface NpcManagerForSync {
  getAllNpcs(): ReadonlyMap<
    string,
    { readonly mapX: number; readonly mapY: number; readonly isVisible: boolean }
  >;
}

/** 简化的 Obj 管理器接口 */
interface ObjManagerForSync {
  getAllObjs(): ReadonlyArray<{
    readonly isRemoved: boolean;
    readonly isObstacle: boolean;
    readonly tilePosition: { readonly x: number; readonly y: number };
  }>;
}

/** 简化的 Magic 管理器接口 */
interface MagicSpriteManagerForSync {
  getMagicSprites(): ReadonlyMap<
    number,
    {
      readonly magic: { readonly bodyRadius: number };
      readonly tilePosition: { readonly x: number; readonly y: number };
    }
  >;
}

/** 简化的 Player 接口 */
interface PlayerForSync {
  readonly mapX: number;
  readonly mapY: number;
}

// === WASM PathFinder 实例接口 ===

interface WasmPathFinderInstance {
  find_path(
    startX: number,
    startY: number,
    endX: number,
    endY: number,
    pathType: number,
    canMoveDirectionCount: number
  ): Int32Array;
  dynamic_bitmap_ptr(): number;
  obstacle_bitmap_ptr(): number;
  hard_obstacle_bitmap_ptr(): number;
  bitmap_byte_size(): number;
  free(): void;
}

// === 模块状态 ===

let wasmPf: WasmPathFinderInstance | null = null;
let currentMapWidth = 0;
let currentMapHeight = 0;

// 共享内存视图（直接指向 WASM 线性内存）
let obstacleBitmapView: Uint8Array | null = null;
let hardObstacleBitmapView: Uint8Array | null = null;
let dynamicBitmapView: Uint8Array | null = null;
let bitmapByteSize = 0;

// 用于 syncDynamicObstacles 的临时 buffer（避免每帧分配）
let dynamicStagingBuffer: Uint8Array | null = null;

// =============================================
// === 初始化 / 销毁 ===
// =============================================

/**
 * 初始化 WASM 寻路器（地图加载时调用）
 *
 * @param mapWidth  地图列数 (mapColumnCounts)
 * @param mapHeight 地图行数 (mapRowCounts)
 * @returns 是否初始化成功
 */
export async function initWasmPathfinder(mapWidth: number, mapHeight: number): Promise<boolean> {
  // 如果已有实例且尺寸不变，直接复用
  if (wasmPf && currentMapWidth === mapWidth && currentMapHeight === mapHeight) {
    return true;
  }

  // 销毁旧实例
  disposeWasmPathfinder();

  try {
    const wasmModule = await ensureWasmReady();
    if (!wasmModule) {
      logger.warn("[WasmPathFinder] WASM not available");
      return false;
    }

    const memory = getWasmMemory();
    if (!memory) {
      logger.warn("[WasmPathFinder] WASM memory not available");
      return false;
    }

    // 创建 PathFinder 实例
    wasmPf = new (wasmModule as WasmModule).PathFinder(
      mapWidth,
      mapHeight
    ) as unknown as WasmPathFinderInstance;

    currentMapWidth = mapWidth;
    currentMapHeight = mapHeight;
    bitmapByteSize = wasmPf.bitmap_byte_size();

    // 创建共享内存视图
    refreshMemoryViews(memory);

    // 分配 staging buffer
    dynamicStagingBuffer = new Uint8Array(bitmapByteSize);

    logger.info(
      `[WasmPathFinder] Initialized ${mapWidth}x${mapHeight}, bitmap=${bitmapByteSize} bytes`
    );
    return true;
  } catch (error) {
    logger.warn("[WasmPathFinder] Init failed, falling back to JS", error);
    disposeWasmPathfinder();
    return false;
  }
}

/**
 * 销毁 WASM 寻路器
 */
export function disposeWasmPathfinder(): void {
  if (wasmPf) {
    try {
      wasmPf.free();
    } catch {
      // ignore
    }
  }
  wasmPf = null;
  obstacleBitmapView = null;
  hardObstacleBitmapView = null;
  dynamicBitmapView = null;
  dynamicStagingBuffer = null;
  bitmapByteSize = 0;
  currentMapWidth = 0;
  currentMapHeight = 0;
}

// =============================================
// === 共享内存视图管理 ===
// =============================================

/**
 * 刷新共享内存视图（当 WASM 内存增长时需要重建）
 */
function refreshMemoryViews(memory: WebAssembly.Memory): void {
  if (!wasmPf) return;

  const buffer = memory.buffer;
  const obsPtr = wasmPf.obstacle_bitmap_ptr();
  const hardPtr = wasmPf.hard_obstacle_bitmap_ptr();
  const dynPtr = wasmPf.dynamic_bitmap_ptr();

  obstacleBitmapView = new Uint8Array(buffer, obsPtr, bitmapByteSize);
  hardObstacleBitmapView = new Uint8Array(buffer, hardPtr, bitmapByteSize);
  dynamicBitmapView = new Uint8Array(buffer, dynPtr, bitmapByteSize);
}

/**
 * 确保视图有效（检测内存增长后 buffer detach）
 */
function ensureViews(): boolean {
  if (!wasmPf || !obstacleBitmapView) return false;

  // 如果 buffer 被 detach（WASM 内存增长），重建视图
  if (obstacleBitmapView.buffer.byteLength === 0) {
    const memory = getWasmMemory();
    if (!memory) return false;
    refreshMemoryViews(memory);
  }

  return true;
}

// =============================================
// === 静态障碍物同步（地图加载时一次） ===
// =============================================

/**
 * 从 MapData.barriers 同步静态障碍物到 WASM 内存
 * 零拷贝：直接写入 WASM 线性内存中的 obstacle_bitmap / hard_obstacle_bitmap
 *
 * @param barriers  MapData.barriers (Uint8Array, 每个字节是一个 tile 的 barrier flags)
 * @param cols      mapColumnCounts
 * @param rows      mapRowCounts
 */
export function syncStaticObstacles(barriers: Uint8Array, cols: number, rows: number): void {
  if (!ensureViews() || !obstacleBitmapView || !hardObstacleBitmapView) return;

  const totalTiles = cols * rows;

  // 清零
  obstacleBitmapView.fill(0);
  hardObstacleBitmapView.fill(0);

  // 逐 tile 设置 bit
  for (let i = 0; i < totalTiles; i++) {
    const barrier = barriers[i] ?? 0xff;
    const byteIdx = i >> 3;
    const bitMask = 1 << (i & 7);

    // isObstacleForCharacter: OBSTACLE | TRANS
    if ((barrier & (OBSTACLE | TRANS)) !== 0) {
      obstacleBitmapView[byteIdx] |= bitMask;
    }

    // isObstacle (hard): only OBSTACLE
    if ((barrier & OBSTACLE) !== 0) {
      hardObstacleBitmapView[byteIdx] |= bitMask;
    }
  }

  logger.debug(
    `[WasmPathFinder] Static obstacles synced: ${totalTiles} tiles, ${bitmapByteSize} bytes`
  );
}

// =============================================
// === 动态障碍物同步（每帧） ===
// =============================================

/**
 * 每帧调用：将 NPC/Obj/Magic/Player 位置写入 dynamic_bitmap
 * 零拷贝：先在 JS staging buffer 中构建，然后一次性拷贝到 WASM 共享内存
 *
 * 为什么用 staging buffer？
 * - 直接写 WASM 内存视图没问题，但 fill(0) + 逐 bit 设置在 JS TypedArray 上更快
 * - staging buffer 是固定大小，无 GC 压力
 *
 * 注意：所有实体（NPC+Obj+Magic+Player）都写入同一个 bitmap。
 * 寻路时 A* 会跳过起点 tile 的动态检查，所以寻路角色自身 tile 不会阻挡自己。
 */
export function syncDynamicObstacles(
  npcManager: NpcManagerForSync,
  objManager: ObjManagerForSync,
  magicSpriteManager: MagicSpriteManagerForSync,
  player: PlayerForSync
): void {
  if (!ensureViews() || !dynamicBitmapView || !dynamicStagingBuffer) return;

  const w = currentMapWidth;
  const h = currentMapHeight;

  // 清零 staging buffer
  dynamicStagingBuffer.fill(0);

  // --- NPC 位置 ---
  for (const [, npc] of npcManager.getAllNpcs()) {
    if (!npc.isVisible) continue;
    const { mapX, mapY } = npc;
    if (mapX >= 0 && mapY >= 0 && mapX < w && mapY < h) {
      const idx = mapY * w + mapX;
      dynamicStagingBuffer[idx >> 3] |= 1 << (idx & 7);
    }
  }

  // --- Obj 位置 ---
  for (const obj of objManager.getAllObjs()) {
    if (obj.isRemoved || !obj.isObstacle) continue;
    const { x, y } = obj.tilePosition;
    if (x >= 0 && y >= 0 && x < w && y < h) {
      const idx = y * w + x;
      dynamicStagingBuffer[idx >> 3] |= 1 << (idx & 7);
    }
  }

  // --- Magic 位置 ---
  for (const sprite of magicSpriteManager.getMagicSprites().values()) {
    if (sprite.magic.bodyRadius <= 0) continue;
    const { x, y } = sprite.tilePosition;
    if (x >= 0 && y >= 0 && x < w && y < h) {
      const idx = y * w + x;
      dynamicStagingBuffer[idx >> 3] |= 1 << (idx & 7);
    }
  }

  // --- Player 位置 ---
  {
    const { mapX, mapY } = player;
    if (mapX >= 0 && mapY >= 0 && mapX < w && mapY < h) {
      const idx = mapY * w + mapX;
      dynamicStagingBuffer[idx >> 3] |= 1 << (idx & 7);
    }
  }

  // 一次性拷贝到 WASM 共享内存
  dynamicBitmapView.set(dynamicStagingBuffer);
}

// =============================================
// === 寻路 API ===
// =============================================

export { PathType };

/**
 * WASM 寻路 — 完全替代 TS findPath()
 *
 * 1:1 对应 pathFinder.ts 的 findPath()：
 * - 静态障碍物从 WASM 内存中的 obstacle_bitmap / hard_obstacle_bitmap 读取
 * - 动态障碍物从 WASM 内存中的 dynamic_bitmap 读取
 * - 所有算法（Step/Simple/Perfect/StraightLine）已在 Rust 中实现，1:1 与 TS 一致
 *
 * @param startTile 起点 tile 坐标
 * @param endTile   终点 tile 坐标
 * @param pathType  寻路类型 (PathType enum 值)
 * @param canMoveDirectionCount 可移动方向数（默认 8）
 * @returns Vector2[] 路径（tile 坐标），空数组表示无路径
 */
export function findPathWasm(
  startTile: Vector2,
  endTile: Vector2,
  pathType: PathType,
  canMoveDirectionCount: number = 8
): Vector2[] {
  if (!wasmPf) return [];

  const result = wasmPf.find_path(
    startTile.x,
    startTile.y,
    endTile.x,
    endTile.y,
    pathType,
    canMoveDirectionCount
  );

  // 转换 Int32Array [x1, y1, x2, y2, ...] 为 Vector2[]
  const len = result.length;
  const path: Vector2[] = new Array(len >> 1);
  for (let i = 0; i < len; i += 2) {
    path[i >> 1] = { x: result[i], y: result[i + 1] };
  }

  return path;
}

/**
 * 获取当前 WASM 寻路器的地图尺寸
 */
export function getWasmPathfinderMapSize(): { width: number; height: number } | null {
  if (!wasmPf) return null;
  return { width: currentMapWidth, height: currentMapHeight };
}
