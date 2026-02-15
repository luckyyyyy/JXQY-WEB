/**
 * CacheRegistry - 通用缓存注册表基础设施
 *
 * 消除 ConfigLoader 重复样板代码：
 * - 每个 loader 只需定义类型和 convert 函数
 * - 缓存键规范化、注册、查询、状态检查全部由框架提供
 *
 * 用法：
 * ```ts
 * const npcCache = createConfigCache<CharacterConfig>({
 *   name: "NpcConfig",
 *   keyPrefixes: ["ini/npc/", "ini/partner/"],
 *   getData: getNpcsData,
 *   build: (data, cache) => {
 *     for (const api of data.npcs) {
 *       cache.set(normalizeCacheKey(api.key, ...), convertApiNpcToConfig(api));
 *     }
 *   },
 * });
 * // 自动注册到 cacheBuilders
 * npcCache.get("npc-小花.ini")  // CharacterConfig | null
 * npcCache.isLoaded()           // boolean
 * npcCache.allKeys()            // string[]
 * ```
 */

import { logger } from "../core/logger";
import { isGameDataLoaded, registerCacheBuilder } from "../data/game-data-api";
import { normalizeCacheKey } from "./resource-paths";

// ============================================================
// Types
// ============================================================

export interface ConfigCacheOptions<TData, TValue> {
  /** 缓存名称，用于日志标签 */
  name: string;
  /** 缓存键前缀，用于 normalizeCacheKey */
  keyPrefixes: readonly string[];
  /** 获取原始 API 数据的函数 */
  getData: () => TData | null | undefined;
  /** 构建缓存的函数：从 API 数据填充 cache Map */
  build: (data: TData, cache: Map<string, TValue>, normalizeKey: (key: string) => string) => void;
}

export interface ConfigCache<TValue> {
  /** 按文件名获取配置，返回值或 null */
  get(fileName: string): TValue | null;
  /** 配置是否已加载 */
  isLoaded(): boolean;
  /** 获取所有缓存键 */
  allKeys(): string[];
  /** 获取所有缓存值 */
  allValues(): TValue[];
  /** 底层 Map（高级用法） */
  readonly cache: ReadonlyMap<string, TValue>;
  /** 规范化键 */
  normalizeKey(key: string): string;
}

// ============================================================
// Factory
// ============================================================

/**
 * 创建一个自动注册的配置缓存
 *
 * 自动调用 registerCacheBuilder 注册到 resourceLoader，
 * 在 loadGameData() 完成后自动构建缓存。
 */
export function createConfigCache<TData, TValue>(
  options: ConfigCacheOptions<TData, TValue>
): ConfigCache<TValue> {
  const cache = new Map<string, TValue>();

  const normalizeKey = (key: string): string => normalizeCacheKey(key, options.keyPrefixes);

  function rebuild(): void {
    const data = options.getData();
    if (!data) return;

    cache.clear();
    options.build(data, cache, normalizeKey);
    logger.info(`[${options.name}] Built cache: ${cache.size} entries`);
  }

  // 自动注册
  registerCacheBuilder(rebuild);

  return {
    get(fileName: string): TValue | null {
      return cache.get(normalizeKey(fileName)) ?? null;
    },
    isLoaded(): boolean {
      return isGameDataLoaded() && cache.size > 0;
    },
    allKeys(): string[] {
      return Array.from(cache.keys());
    },
    allValues(): TValue[] {
      return Array.from(cache.values());
    },
    cache,
    normalizeKey,
  };
}
