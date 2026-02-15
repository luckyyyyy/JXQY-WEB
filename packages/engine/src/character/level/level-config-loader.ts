/**
 * Level Config Loader - 从统一数据加载器获取等级配置
 */

import type { LevelDetail as LevelDetailType } from "@miu2d/types";
import {
  getGameSlug,
  getLevelsData,
  type LevelConfigData,
  loadLevelsData,
} from "../../data/game-data-api";
import { createConfigCache } from "../../resource/cache-registry";

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

const DEFAULT_PLAYER_KEY = "level-easy.ini";
const DEFAULT_NPC_KEY = "level-npc.ini";

/** 转换 API 数据 */
function convert(api: LevelDetailType): LevelDetail {
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

type LevelApiData = NonNullable<ReturnType<typeof getLevelsData>>;

const LEVEL_KEY_PREFIXES = ["ini/level/"] as const;

function toLevelMap(api: LevelConfigData): Map<number, LevelDetail> {
  const levels = new Map<number, LevelDetail>();
  for (const lvl of api.levels) {
    levels.set(lvl.level, convert(lvl));
  }
  return levels;
}

function cloneLevelMap(levels: Map<number, LevelDetail>): Map<number, LevelDetail> {
  return new Map(levels);
}

const levelConfigCacheStore = createConfigCache<LevelApiData, Map<number, LevelDetail>>({
  name: "LevelConfig",
  keyPrefixes: LEVEL_KEY_PREFIXES,
  getData: getLevelsData,
  build(data, cache, normalizeKey) {
    for (const cfg of data.player) {
      cache.set(normalizeKey(cfg.key), toLevelMap(cfg));
    }
    for (const cfg of data.npc) {
      cache.set(normalizeKey(cfg.key), toLevelMap(cfg));
    }
  },
});

/** 加载等级配置 */
export async function loadLevelConfig(fileName: string): Promise<Map<number, LevelDetail> | null> {
  const cached = levelConfigCacheStore.get(fileName);
  if (cached) return cloneLevelMap(cached);

  const gameSlug = getGameSlug();
  if (!gameSlug) {
    return null;
  }

  await loadLevelsData(gameSlug);

  const loaded = levelConfigCacheStore.get(fileName);
  return loaded ? cloneLevelMap(loaded) : null;
}

/** 从缓存获取（同步） */
export function getLevelConfigFromCache(fileName: string): Map<number, LevelDetail> | null {
  const cached = levelConfigCacheStore.get(fileName);
  return cached ? cloneLevelMap(cached) : null;
}

/** 清除缓存 */
export function clearLevelConfigCache(fileName?: string): void {
  const cache = levelConfigCacheStore.cache as Map<string, Map<number, LevelDetail>>;
  if (!fileName) {
    cache.clear();
    return;
  }
  cache.delete(levelConfigCacheStore.normalizeKey(fileName));
}

export function getDefaultPlayerLevelKey(): string {
  return DEFAULT_PLAYER_KEY;
}

export function getDefaultNpcLevelKey(): string {
  return DEFAULT_NPC_KEY;
}
