/**
 * NpcMagicCache - NPC 武功预加载管理器
 *
 * 预加载时直接缓存指定等级的 MagicData，get() 零分配返回。
 * NPC 等级固定，无需像 Player 那样动态获取不同等级。
 */

import type { FlyIniInfo } from "../../character/modules/fly-ini-manager";
import { logger } from "../../core/logger";
import { getMagic, getMagicAtLevel, preloadMagicAsf } from "../../magic/magic-loader";
import type { MagicData } from "../../magic/types";

/** 特殊武功类型 */
export type SpecialMagicType = "lifeLow" | "beAttacked" | "death";

export class NpcMagicCache {
  private _attackLevel: number;
  private _cache = new Map<string, MagicData>();
  private _specialFiles = new Map<SpecialMagicType, string>();
  private _loading: Promise<void> | null = null;

  constructor(attackLevel = 1) {
    this._attackLevel = attackLevel;
  }

  get loaded(): boolean {
    return this._loading !== null && this._cache.size > 0;
  }
  get size(): number {
    return this._cache.size;
  }

  /** 获取武功（同步） */
  get(magicIni: string): MagicData | null {
    return this._cache.get(magicIni) ?? null;
  }

  /** 获取特殊武功（同步） */
  getSpecial(type: SpecialMagicType): MagicData | null {
    const file = this._specialFiles.get(type);
    return file ? (this._cache.get(file) ?? null) : null;
  }

  has(magicIni: string): boolean {
    return this._cache.has(magicIni);
  }

  /** 预加载所有武功 */
  async loadAll(
    flyIniInfos: readonly FlyIniInfo[],
    special: { lifeLow?: string; beAttacked?: string; death?: string },
    name = ""
  ): Promise<void> {
    if (this._loading) return this._loading;

    // 收集文件名
    const files = new Set<string>();
    for (const info of flyIniInfos) info.magicIni && files.add(info.magicIni);

    // 记录特殊武功
    for (const [key, file] of Object.entries(special) as [SpecialMagicType, string | undefined][]) {
      if (file) {
        this._specialFiles.set(key, file);
        files.add(file);
      }
    }

    // 并行加载
    this._loading = Promise.all([...files].map((f) => this._load(f))).then(() => {
      if (name && this._cache.size) {
        logger.debug(`[NpcMagicCache] ${name}: ${this._cache.size} magics`);
      }
    });
    return this._loading;
  }

  /** 动态添加武功 */
  async add(magicIni: string): Promise<MagicData | null> {
    if (this._cache.has(magicIni)) return this._cache.get(magicIni)!;
    await this._load(magicIni);
    return this._cache.get(magicIni) ?? null;
  }

  clear(): void {
    this._cache.clear();
    this._specialFiles.clear();
    this._loading = null;
  }

  setAttackLevel(level: number): void {
    if (this._attackLevel !== level) {
      this._attackLevel = level;
      this.clear();
    }
  }

  private async _load(magicIni: string): Promise<void> {
    if (this._cache.has(magicIni)) return;
    const magic = getMagic(magicIni);
    if (magic) {
      await preloadMagicAsf(magic);
      this._cache.set(magicIni, getMagicAtLevel(magic, this._attackLevel));
    }
  }
}
