/**
 * Level Config Loader - 从 API 按需加载等级配置
 */

import { logger } from "../../core/logger";

/** API 返回的等级数据 */
interface ApiLevelDetail {
  level: number;
  levelUpExp?: number;
  lifeMax?: number;
  thewMax?: number;
  manaMax?: number;
  attack?: number;
  attack2?: number;
  attack3?: number;
  defend?: number;
  defend2?: number;
  defend3?: number;
  evade?: number;
  newMagic?: string;
  newGood?: string;
  exp?: number;
  life?: number;
}

/** API 返回的等级配置 */
interface ApiLevelConfig {
  levels: ApiLevelDetail[];
}

/** 引擎使用的等级详情 */
export interface LevelDetail {
  levelUpExp: number;
  lifeMax: number;
  thewMax: number;
  manaMax: number;
  attack: number;
  attack2: number;
  attack3: number;
  defend: number;
  defend2: number;
  defend3: number;
  evade: number;
  newMagic: string;
  newGood: string;
  exp: number;
  life: number;
}

/** 缓存 (normalized key -> levels) */
const cache = new Map<string, Map<number, LevelDetail>>();

let gameSlug = "";

const DEFAULT_PLAYER_KEY = "level-easy.ini";
const DEFAULT_NPC_KEY = "level-npc.ini";

/** 规范化键名（提取文件名并转小写） */
function normalizeKey(fileName: string): string {
  const name = fileName.replace(/\\/g, "/").split("/").pop() ?? fileName;
  return name.toLowerCase();
}

/** 转换 API 数据 */
function convert(api: ApiLevelDetail): LevelDetail {
  return {
    levelUpExp: api.levelUpExp ?? 100,
    lifeMax: api.lifeMax ?? 100,
    thewMax: api.thewMax ?? 100,
    manaMax: api.manaMax ?? 100,
    attack: api.attack ?? 10,
    attack2: api.attack2 ?? 0,
    attack3: api.attack3 ?? 0,
    defend: api.defend ?? 10,
    defend2: api.defend2 ?? 0,
    defend3: api.defend3 ?? 0,
    evade: api.evade ?? 0,
    newMagic: api.newMagic ?? "",
    newGood: api.newGood ?? "",
    exp: api.exp ?? 0,
    life: api.life ?? 0,
  };
}

/** 设置游戏 slug */
export function setLevelConfigGameSlug(slug: string): void {
  if (gameSlug !== slug) {
    cache.clear();
    gameSlug = slug;
  }
}

/** 加载等级配置 */
export async function loadLevelConfig(fileName: string): Promise<Map<number, LevelDetail> | null> {
  const key = normalizeKey(fileName);

  const cached = cache.get(key);
  if (cached) return new Map(cached);

  if (!gameSlug) {
    logger.error("[LevelConfig] Game slug not set");
    return null;
  }

  try {
    const res = await fetch(`/game/${gameSlug}/api/level/${key}`);
    if (!res.ok) {
      if (res.status === 404) logger.warn(`[LevelConfig] Not found: ${key}`);
      return null;
    }

    const data: ApiLevelConfig = await res.json();
    const levels = new Map<number, LevelDetail>();
    for (const lvl of data.levels) {
      levels.set(lvl.level, convert(lvl));
    }

    cache.set(key, levels);
    logger.debug(`[LevelConfig] Loaded: ${key} (${levels.size} levels)`);
    return new Map(levels);
  } catch (e) {
    logger.error(`[LevelConfig] Failed: ${key}`, e);
    return null;
  }
}

/** 从缓存获取（同步） */
export function getLevelConfigFromCache(fileName: string): Map<number, LevelDetail> | null {
  const cached = cache.get(normalizeKey(fileName));
  return cached ? new Map(cached) : null;
}

/** 清除缓存 */
export function clearLevelConfigCache(fileName?: string): void {
  fileName ? cache.delete(normalizeKey(fileName)) : cache.clear();
}

export function getDefaultPlayerLevelKey(): string {
  return DEFAULT_PLAYER_KEY;
}

export function getDefaultNpcLevelKey(): string {
  return DEFAULT_NPC_KEY;
}
