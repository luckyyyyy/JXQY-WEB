/**
 * WASM 碰撞检测桥接层
 * 提供空间哈希网格的高性能碰撞检测
 *
 * WASM 初始化统一由 wasmManager 管理，本模块不再独立初始化
 */

import { logger } from "../core/logger";
import { ensureWasmReady, getWasmModule, isWasmReady } from "./wasm-manager";

// WASM 模块类型定义（碰撞检测相关接口）
interface WasmSpatialHash {
  clear(): void;
  upsert(id: number, x: number, y: number, radius: number, group: number): void;
  remove(id: number): void;
  batch_update_positions(positions: Float32Array): void;
  query_radius(x: number, y: number, radius: number): Uint32Array;
  query_at(x: number, y: number): Uint32Array;
  query_at_by_group(x: number, y: number, group: number): Uint32Array;
  query_at_excluding_group(x: number, y: number, excludeGroup: number): Uint32Array;
  detect_all_collisions(): Uint32Array;
  detect_collisions_for(id: number): Uint32Array;
  count(): number;
}

interface WasmCollisionModule {
  SpatialHash: new (cellSize: number) => WasmSpatialHash;
  check_aabb_collision(
    x1: number,
    y1: number,
    w1: number,
    h1: number,
    x2: number,
    y2: number,
    w2: number,
    h2: number
  ): boolean;
  check_circle_collision(
    x1: number,
    y1: number,
    r1: number,
    x2: number,
    y2: number,
    r2: number
  ): boolean;
  point_in_rect(px: number, py: number, rx: number, ry: number, rw: number, rh: number): boolean;
  point_in_circle(px: number, py: number, cx: number, cy: number, radius: number): boolean;
}

/**
 * 获取碰撞检测 WASM 模块（类型收窄）
 */
function getCollisionModule(): WasmCollisionModule | null {
  return getWasmModule() as unknown as WasmCollisionModule | null;
}

/**
 * 初始化 WASM 碰撞检测模块
 * 委托给 wasmManager 统一初始化
 */
export async function initWasmCollision(): Promise<boolean> {
  const module = await ensureWasmReady();
  if (module) {
    logger.info("[WasmCollision] Ready (via wasmManager)");
    return true;
  }
  logger.warn("[WasmCollision] WASM not available");
  return false;
}

/**
 * 检查 WASM 是否可用
 */
export function isWasmCollisionAvailable(): boolean {
  return isWasmReady();
}

/**
 * 空间哈希包装类
 */
export class WasmSpatialHashWrapper {
  private hash: WasmSpatialHash | null = null;
  private cellSize: number;

  constructor(cellSize: number = 64) {
    this.cellSize = cellSize;
    const mod = getCollisionModule();
    if (mod) {
      this.hash = new mod.SpatialHash(cellSize);
    }
  }

  /**
   * 初始化（如果尚未初始化）
   */
  async init(): Promise<boolean> {
    if (this.hash) return true;

    const ready = await initWasmCollision();
    const mod = getCollisionModule();
    if (ready && mod) {
      this.hash = new mod.SpatialHash(this.cellSize);
      return true;
    }
    return false;
  }

  /**
   * 清空所有实体
   */
  clear(): void {
    this.hash?.clear();
  }

  /**
   * 添加或更新实体
   */
  upsert(id: number, x: number, y: number, radius: number, group: number = 0): void {
    this.hash?.upsert(id, x, y, radius, group);
  }

  /**
   * 移除实体
   */
  remove(id: number): void {
    this.hash?.remove(id);
  }

  /**
   * 批量更新位置
   * @param updates 格式: [[id, x, y], [id, x, y], ...]
   */
  batchUpdatePositions(updates: Array<[number, number, number]>): void {
    if (!this.hash) return;

    const flat = new Float32Array(updates.length * 3);
    for (let i = 0; i < updates.length; i++) {
      flat[i * 3] = updates[i][0];
      flat[i * 3 + 1] = updates[i][1];
      flat[i * 3 + 2] = updates[i][2];
    }
    this.hash.batch_update_positions(flat);
  }

  /**
   * 查询圆形范围内的实体
   */
  queryRadius(x: number, y: number, radius: number): number[] {
    if (!this.hash) return [];
    return Array.from(this.hash.query_radius(x, y, radius));
  }

  /**
   * 查询指定位置的实体
   */
  queryAt(x: number, y: number): number[] {
    if (!this.hash) return [];
    return Array.from(this.hash.query_at(x, y));
  }

  /**
   * 查询指定位置指定阵营的实体
   */
  queryAtByGroup(x: number, y: number, group: number): number[] {
    if (!this.hash) return [];
    return Array.from(this.hash.query_at_by_group(x, y, group));
  }

  /**
   * 查询指定位置非指定阵营的实体
   */
  queryAtExcludingGroup(x: number, y: number, excludeGroup: number): number[] {
    if (!this.hash) return [];
    return Array.from(this.hash.query_at_excluding_group(x, y, excludeGroup));
  }

  /**
   * 检测所有碰撞对
   * @returns [[id1, id2], [id3, id4], ...]
   */
  detectAllCollisions(): Array<[number, number]> {
    if (!this.hash) return [];

    const result = this.hash.detect_all_collisions();
    const pairs: Array<[number, number]> = [];
    for (let i = 0; i < result.length; i += 2) {
      pairs.push([result[i], result[i + 1]]);
    }
    return pairs;
  }

  /**
   * 检测指定实体的碰撞
   */
  detectCollisionsFor(id: number): number[] {
    if (!this.hash) return [];
    return Array.from(this.hash.detect_collisions_for(id));
  }

  /**
   * 获取实体数量
   */
  count(): number {
    return this.hash?.count() ?? 0;
  }
}

// ===== 快捷碰撞检测函数 =====

/**
 * AABB 碰撞检测
 */
export function checkAabbCollision(
  x1: number,
  y1: number,
  w1: number,
  h1: number,
  x2: number,
  y2: number,
  w2: number,
  h2: number
): boolean {
  const mod = getCollisionModule();
  if (mod) {
    return mod.check_aabb_collision(x1, y1, w1, h1, x2, y2, w2, h2);
  }
  // JS 回退
  return x1 < x2 + w2 && x1 + w1 > x2 && y1 < y2 + h2 && y1 + h1 > y2;
}

/**
 * 圆形碰撞检测
 */
export function checkCircleCollision(
  x1: number,
  y1: number,
  r1: number,
  x2: number,
  y2: number,
  r2: number
): boolean {
  const mod = getCollisionModule();
  if (mod) {
    return mod.check_circle_collision(x1, y1, r1, x2, y2, r2);
  }
  // JS 回退
  const dx = x2 - x1;
  const dy = y2 - y1;
  const distSq = dx * dx + dy * dy;
  const combinedRadius = r1 + r2;
  return distSq <= combinedRadius * combinedRadius;
}

/**
 * 点是否在矩形内
 */
export function pointInRect(
  px: number,
  py: number,
  rx: number,
  ry: number,
  rw: number,
  rh: number
): boolean {
  const mod = getCollisionModule();
  if (mod) {
    return mod.point_in_rect(px, py, rx, ry, rw, rh);
  }
  return px >= rx && px <= rx + rw && py >= ry && py <= ry + rh;
}

/**
 * 点是否在圆内
 */
export function pointInCircle(
  px: number,
  py: number,
  cx: number,
  cy: number,
  radius: number
): boolean {
  const mod = getCollisionModule();
  if (mod) {
    return mod.point_in_circle(px, py, cx, cy, radius);
  }
  const dx = px - cx;
  const dy = py - cy;
  return dx * dx + dy * dy <= radius * radius;
}
