/**
 * NPC 空间网格 - 纯 JS 实现的快速近邻查询
 *
 * 将世界空间划分为固定大小的网格单元，NPC 按位置分配到对应单元。
 * 查询时只遍历目标位置周围的邻近单元，将 O(N) 降至 O(k)。
 *
 * 设计要点：
 * - 无 FFI 开销，纯 JS Map + 数组
 * - 每帧在 NpcManager.update 后调用 rebuild() 重建（比增量 upsert 更简单且对 50 NPC 更快）
 * - 网格大小选择：640px ≈ 10 个瓦片列宽(64px)，覆盖常见战斗/视野半径
 */

import type { Vector2 } from "../core/types";

/** 空间网格中的条目 */
export interface SpatialEntry<T> {
  item: T;
  x: number;
  y: number;
}

/**
 * 纯 JS 空间网格
 *
 * 泛型 T 代表存储的对象类型（Npc / Character）
 */
export class NpcSpatialGrid<T> {
  /** 网格单元大小（像素） */
  private readonly cellSize: number;
  private readonly invCellSize: number;

  /** 网格存储：cellKey -> entries */
  private cells = new Map<number, SpatialEntry<T>[]>();

  /** 当前所有条目（flat 列表，用于需要全量遍历的 fallback） */
  private allEntries: SpatialEntry<T>[] = [];

  constructor(cellSize: number = 640) {
    this.cellSize = cellSize;
    this.invCellSize = 1 / cellSize;
  }

  /** 计算单元键（将 2D 坐标哈希为单个数字） */
  private cellKey(cx: number, cy: number): number {
    // 使用 Cantor pairing 变体，支持负坐标
    // 先偏移到正数域（世界坐标通常为正，偏移 4096 个 cell 以防万一）
    const a = cx + 4096;
    const b = cy + 4096;
    return a * 16384 + b;
  }

  /** 世界坐标 → 单元坐标 */
  private toCellCoord(worldCoord: number): number {
    return Math.floor(worldCoord * this.invCellSize);
  }

  /**
   * 完全重建网格
   *
   * 对于 N ≤ 100 的场景，全量重建比增量维护更快（无需跟踪旧位置、无 delete 开销）。
   * 每帧调用一次，在所有 NPC update 完成后。
   */
  rebuild(items: Iterable<T>, getPos: (item: T) => Vector2): void {
    // 复用 Map 结构，只清空 cell 数组内容
    for (const arr of this.cells.values()) {
      arr.length = 0;
    }
    this.allEntries.length = 0;

    for (const item of items) {
      const pos = getPos(item);
      const entry: SpatialEntry<T> = { item, x: pos.x, y: pos.y };
      this.allEntries.push(entry);

      const cx = this.toCellCoord(pos.x);
      const cy = this.toCellCoord(pos.y);
      const key = this.cellKey(cx, cy);

      let arr = this.cells.get(key);
      if (!arr) {
        arr = [];
        this.cells.set(key, arr);
      }
      arr.push(entry);
    }
  }

  /** 清空网格 */
  clear(): void {
    this.cells.clear();
    this.allEntries.length = 0;
  }

  /**
   * 查询：在 (x, y) 周围 radius 像素范围内，找到满足 filter 的最近条目
   *
   * 遍历范围覆盖的所有 cell，只对 cell 内条目做距离比较。
   * 对 50 NPC / cellSize=640 的场景，一次查询通常只检查 3-8 个 NPC 而非全部。
   *
   * @returns 最近的条目，或 null
   */
  findClosest(
    x: number,
    y: number,
    radius: number,
    filter: (item: T) => boolean
  ): SpatialEntry<T> | null {
    const radiusSq = radius * radius;
    const minCx = this.toCellCoord(x - radius);
    const maxCx = this.toCellCoord(x + radius);
    const minCy = this.toCellCoord(y - radius);
    const maxCy = this.toCellCoord(y + radius);

    let bestEntry: SpatialEntry<T> | null = null;
    let bestDistSq = radiusSq;

    for (let cx = minCx; cx <= maxCx; cx++) {
      for (let cy = minCy; cy <= maxCy; cy++) {
        const arr = this.cells.get(this.cellKey(cx, cy));
        if (!arr) continue;

        for (let i = 0; i < arr.length; i++) {
          const entry = arr[i];
          if (!filter(entry.item)) continue;

          const dx = entry.x - x;
          const dy = entry.y - y;
          const distSq = dx * dx + dy * dy;

          if (distSq < bestDistSq) {
            bestDistSq = distSq;
            bestEntry = entry;
          }
        }
      }
    }

    return bestEntry;
  }

  /**
   * 无限半径查询最近：遍历所有条目（fallback，等价于原来的 O(N) 但少了 Map 迭代开销）
   */
  findClosestAll(x: number, y: number, filter: (item: T) => boolean): SpatialEntry<T> | null {
    let bestEntry: SpatialEntry<T> | null = null;
    let bestDistSq = Infinity;
    const entries = this.allEntries;

    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i];
      if (!filter(entry.item)) continue;

      const dx = entry.x - x;
      const dy = entry.y - y;
      const distSq = dx * dx + dy * dy;

      if (distSq < bestDistSq) {
        bestDistSq = distSq;
        bestEntry = entry;
      }
    }

    return bestEntry;
  }

  /**
   * 范围查询：返回 (x, y) 周围 radius 像素内满足 filter 的所有条目
   */
  findInRadius(
    x: number,
    y: number,
    radius: number,
    filter: (item: T) => boolean,
    result: T[] = []
  ): T[] {
    const radiusSq = radius * radius;
    const minCx = this.toCellCoord(x - radius);
    const maxCx = this.toCellCoord(x + radius);
    const minCy = this.toCellCoord(y - radius);
    const maxCy = this.toCellCoord(y + radius);

    for (let cx = minCx; cx <= maxCx; cx++) {
      for (let cy = minCy; cy <= maxCy; cy++) {
        const arr = this.cells.get(this.cellKey(cx, cy));
        if (!arr) continue;

        for (let i = 0; i < arr.length; i++) {
          const entry = arr[i];
          if (!filter(entry.item)) continue;

          const dx = entry.x - x;
          const dy = entry.y - y;
          if (dx * dx + dy * dy <= radiusSq) {
            result.push(entry.item);
          }
        }
      }
    }

    return result;
  }
}
