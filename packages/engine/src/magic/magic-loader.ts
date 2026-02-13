/**
 * Magic Loader
 * 从 API 缓存获取武功配置（不再读取 INI 文件）
 *
 * ============= 架构设计 =============
 *
 * 核心原则：战斗中禁止 async，所有资源必须预加载
 *
 * 初始化：
 * - 调用 loadGameData() 从 API 加载所有游戏数据
 * - dataLoader 会自动调用 registerCacheBuilder 注册的回调构建缓存
 *
 * 加载时机：
 * 1. NPC 出现时 → async 预加载 ASF
 * 2. 玩家读存档时 → async 加载所有已有武功
 * 3. 玩家获得武功时 → async 加载并预加载 ASF
 *
 * 战斗中使用：
 * - getMagic() 同步获取（直接从 API 缓存读取）
 * - getMagicAtLevel() 同步获取指定等级
 *
 * ============= 公开 API =============
 *
 * getMagic(fileName)             - 同步获取（战斗时调用）
 * getMagicAtLevel(magic, level)  - 同步获取指定等级
 * preloadMagicAsf(magic)         - 预加载 ASF 资源
 * preloadMagics(fileNames)       - 批量预加载
 */

import { logger } from "../core/logger";
import { getMagicFromApiCache, isMagicApiLoaded } from "./magic-config-loader";
import type { MagicRenderer } from "./magic-renderer";
import type { MagicData } from "./types";

// 模块级渲染器引用，由 MagicManager 构造时设置
let _magicRenderer: MagicRenderer | null = null;

/**
 * 初始化 magicLoader 模块（由 MagicManager 构造时调用）
 */
export function initMagicLoader(renderer: MagicRenderer): void {
  _magicRenderer = renderer;
}

function getRenderer(): MagicRenderer {
  if (!_magicRenderer) {
    throw new Error("[MagicLoader] MagicRenderer not initialized. Call initMagicLoader() first.");
  }
  return _magicRenderer;
}

/**
 * 获取指定等级的武功数据
 *
 * C# 参考：Magic.EffectLevel = _effectLevel > 0 ? _effectLevel : CurrentLevel
 * CurrentLevel 是武功自身的等级（1-10），不是角色的等级。
 * 当请求的等级超过武功最大等级时，回退到最高可用等级。
 */
export function getMagicAtLevel(baseMagic: MagicData, level: number): MagicData {
  if (!baseMagic.levels || baseMagic.levels.size === 0) {
    // 没有等级数据，返回基础数据的副本
    const copy = { ...baseMagic };
    copy.currentLevel = level;
    copy.effectLevel = level;
    return copy;
  }

  // 如果请求的等级不存在，回退到最高可用等级
  let effectiveLevel = level;
  if (!baseMagic.levels.has(level)) {
    let maxLevel = 0;
    for (const key of baseMagic.levels.keys()) {
      if (key > maxLevel) maxLevel = key;
    }
    effectiveLevel = maxLevel > 0 ? maxLevel : 1;
  }

  const levelData = baseMagic.levels.get(effectiveLevel);
  if (!levelData) {
    const copy = { ...baseMagic };
    copy.currentLevel = effectiveLevel;
    copy.effectLevel = effectiveLevel;
    return copy;
  }

  // 合并等级数据
  const merged: MagicData = {
    ...baseMagic,
    ...levelData,
    currentLevel: effectiveLevel,
    effectLevel: effectiveLevel,
    levels: baseMagic.levels, // 保留等级引用
  };

  return merged;
}

// ============= 公开 API =============

/**
 * 同步获取武功（直接从 API 缓存读取）
 * 战斗中调用，返回完整数据（包含所有等级）
 * 用 getMagicAtLevel 获取指定等级
 */
export function getMagic(fileName: string): MagicData | null {
  if (!isMagicApiLoaded()) {
    logger.error(`[MagicLoader] Game data not loaded! Call loadGameData() first.`);
    return null;
  }
  return getMagicFromApiCache(fileName);
}

/**
 * 预加载武功的 ASF 资源（飞行动画、消失动画等）
 */
export async function preloadMagicAsf(magic: MagicData): Promise<void> {
  const promises: Promise<unknown>[] = [];
  if (magic.flyingImage) {
    promises.push(getRenderer().getAsf(magic.flyingImage));
  }
  if (magic.vanishImage) {
    promises.push(getRenderer().getAsf(magic.vanishImage));
  }
  if (magic.superModeImage) {
    promises.push(getRenderer().getAsf(magic.superModeImage));
  }
  if (promises.length > 0) {
    await Promise.all(promises);
  }
}

/**
 * 批量预加载武功 ASF 资源
 *
 * @param fileNames 武功文件名列表
 * @param preloadAsf 是否预加载 ASF 资源（默认 false）
 */
export async function preloadMagics(
  fileNames: string[],
  preloadAsf = false
): Promise<Map<string, MagicData>> {
  const results = new Map<string, MagicData>();
  const promises: Promise<void>[] = [];

  for (const fileName of fileNames) {
    const magic = getMagic(fileName);
    if (magic) {
      results.set(fileName, magic);
      if (preloadAsf) {
        promises.push(preloadMagicAsf(magic));
      }
    }
  }

  if (promises.length > 0) {
    await Promise.all(promises);
  }

  return results;
}
