/**
 * WASM AI 目标搜索桥接层 — 零拷贝共享内存 SoA 方案
 *
 * 架构（与 wasm-path-finder 一致）：
 *   1. 每帧将所有 NPC 的 {x, y, flags, group} 写入 WASM 线性内存中的 SoA 数组
 *      （通过 AiSearch.*_ptr() 暴露的指针，零拷贝）。
 *   2. 调用 rebuild() 在 Rust 侧重建空间网格。
 *   3. find_nearest() 在视野半径内返回最近匹配 NPC 的 slot 索引，
 *      JS 用 slotToNpc 映射还原对象。
 *
 * 仅替换「NPC 群体最近目标搜索」这一纯数值热核；玩家比较 / ignoreList / followTarget
 * 写回仍在 JS。
 */

import { logger } from "../core/logger";
import type { Npc } from "../npc/npc";
import { ensureWasmReady, getWasmMemory, getWasmModule, type WasmModule } from "./wasm-manager";

// === 谓词类型（与 Rust ai_search.rs 常量一致）===
export const PRED_OTHER_GROUP_ENEMY = 0;
export const PRED_PLAYER_OR_FIGHTER_FRIEND = 1;
export const PRED_ENEMY_TYPE = 2;
export const PRED_NONNEUTRAL_FIGHTER = 3;
export const PRED_FIGHTER = 4;

/** AI 谓词描述（由 npc-ai-queries 传入 findClosestCharacter） */
export interface WasmAiPredicate {
  pred: number;
  paramGroup: number;
  withNeutral: boolean;
  withInvisible: boolean;
}

interface WasmAiSearchInstance {
  capacity(): number;
  set_count(count: number): void;
  pos_x_ptr(): number;
  pos_y_ptr(): number;
  flags_ptr(): number;
  group_ptr(): number;
  output_ptr(): number;
  rebuild(): void;
  find_nearest(
    qx: number,
    qy: number,
    radius: number,
    pred: number,
    paramGroup: number,
    withNeutral: boolean,
    withInvisible: boolean
  ): number;
  find_all_in_radius(
    qx: number,
    qy: number,
    radius: number,
    pred: number,
    paramGroup: number,
    withNeutral: boolean,
    withInvisible: boolean
  ): number;
  free(): void;
}

const CELL_SIZE = 256;
const INITIAL_CAPACITY = 4096;

// === 模块状态 ===
let instance: WasmAiSearchInstance | null = null;
let capacity = 0;
let ready = false;

// 共享内存视图（直接指向 WASM 线性内存）
let posXView: Float32Array | null = null;
let posYView: Float32Array | null = null;
let flagsView: Uint32Array | null = null;
let groupView: Int32Array | null = null;
let outputView: Uint32Array | null = null;

// slot → Npc 映射（每帧 sync 时重建）
let slotToNpc: (Npc | null)[] = [];
let liveCount = 0;

/**
 * 初始化 WASM AI 搜索器（首次使用前调用，幂等）
 */
export async function initWasmAiSearch(): Promise<boolean> {
  if (ready && instance) return true;

  try {
    const wasmModule = (await ensureWasmReady()) as WasmModule | null;
    if (!wasmModule?.AiSearch) {
      logger.warn("[WasmAiSearch] AiSearch not available in WASM module");
      return false;
    }
    createInstance(wasmModule, INITIAL_CAPACITY);
    logger.info(`[WasmAiSearch] Initialized (capacity=${capacity})`);
    return ready;
  } catch (error) {
    logger.warn("[WasmAiSearch] Init failed, falling back to JS", error);
    disposeWasmAiSearch();
    return false;
  }
}

function createInstance(wasmModule: WasmModule, cap: number): void {
  if (instance) {
    try {
      instance.free();
    } catch {
      // ignore
    }
  }
  instance = new (
    wasmModule.AiSearch as new (
      capacity: number,
      cellSize: number
    ) => WasmAiSearchInstance
  )(cap, CELL_SIZE);
  capacity = cap;
  slotToNpc = new Array(cap).fill(null);
  refreshViews();
  ready = true;
}

/**
 * 刷新共享内存视图（WASM 内存增长后 buffer 会 detach，需要重建）
 */
function refreshViews(): void {
  if (!instance) return;
  const memory = getWasmMemory();
  if (!memory) {
    ready = false;
    return;
  }
  const buffer = memory.buffer;
  posXView = new Float32Array(buffer, instance.pos_x_ptr(), capacity);
  posYView = new Float32Array(buffer, instance.pos_y_ptr(), capacity);
  flagsView = new Uint32Array(buffer, instance.flags_ptr(), capacity);
  groupView = new Int32Array(buffer, instance.group_ptr(), capacity);
  outputView = new Uint32Array(buffer, instance.output_ptr(), capacity);
}

/** 确保视图有效（内存增长后 buffer.byteLength 变 0） */
function ensureViews(): boolean {
  if (!instance || !posXView) return false;
  if (posXView.buffer.byteLength === 0) {
    refreshViews();
  }
  return posXView !== null && posXView.buffer.byteLength > 0;
}

export function isAiSearchReady(): boolean {
  return ready && instance !== null;
}

/**
 * 每帧将 NPC 群体写入共享 SoA 并重建网格。
 * 在 NpcManager.update 开始处调用（AI 查询之前）。
 */
export function syncNpcsToAiSearch(npcs: ReadonlyMap<string, Npc>): void {
  if (!ready || !instance) return;

  // 容量不足时同步扩容（重新创建实例 + 视图）
  if (npcs.size > capacity) {
    growCapacity(npcs.size);
  }

  if (!ensureViews() || !posXView || !posYView || !flagsView || !groupView || !outputView) return;

  let i = 0;
  for (const [, npc] of npcs) {
    if (i >= capacity) break;
    const p = npc.positionInWorld;
    posXView[i] = p.x;
    posYView[i] = p.y;
    // flags: bit0 visible, bit1 death, bits2-3 relation, bits4-7 kind
    let f = 0;
    if (npc.isVisible) f |= 1;
    if (npc.isDeathInvoked) f |= 2;
    f |= (npc.relation & 0x3) << 2;
    f |= (npc.kind & 0xf) << 4;
    flagsView[i] = f;
    groupView[i] = npc.group;
    slotToNpc[i] = npc;
    i++;
  }
  liveCount = i;
  instance.set_count(liveCount);
  instance.rebuild();
}

function growCapacity(needed: number): void {
  // 扩到 1.5 倍并向上取到 1024 的整数倍，复用已加载的 WASM 模块同步重建
  const cap = Math.ceil((needed * 1.5) / 1024) * 1024;
  const wasmModule = getWasmModule();
  if (wasmModule?.AiSearch) {
    createInstance(wasmModule, cap);
  }
}

/**
 * 在视野半径内查找最近匹配 NPC，返回 Npc 或 null。
 */
export function wasmFindNearestNpc(
  qx: number,
  qy: number,
  radius: number,
  pred: WasmAiPredicate
): Npc | null {
  if (!ready || !instance) return null;
  const idx = instance.find_nearest(
    qx,
    qy,
    radius,
    pred.pred,
    pred.paramGroup,
    pred.withNeutral,
    pred.withInvisible
  );
  if (idx < 0 || idx >= liveCount) return null;
  return slotToNpc[idx];
}

/**
 * 在半径内查找所有匹配 NPC，推入 result 数组并返回。
 * 共享内存零拷贝：从 outputView 读取 slot 索引。
 */
export function wasmFindAllInRadius(
  qx: number,
  qy: number,
  radius: number,
  pred: WasmAiPredicate,
  result: Npc[] = []
): Npc[] {
  if (!ready || !instance || !outputView) return result;
  const count = instance.find_all_in_radius(
    qx,
    qy,
    radius,
    pred.pred,
    pred.paramGroup,
    pred.withNeutral,
    pred.withInvisible
  );
  for (let i = 0; i < count; i++) {
    const slot = outputView[i];
    if (slot < liveCount) {
      const npc = slotToNpc[slot];
      if (npc) result.push(npc);
    }
  }
  return result;
}

export function disposeWasmAiSearch(): void {
  if (instance) {
    try {
      instance.free();
    } catch {
      // ignore
    }
  }
  instance = null;
  capacity = 0;
  ready = false;
  posXView = null;
  posYView = null;
  flagsView = null;
  groupView = null;
  outputView = null;
  slotToNpc = [];
  liveCount = 0;
}
