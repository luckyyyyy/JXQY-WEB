/**
 * NPC Config Cache - 从 API 缓存获取 NPC 配置
 *
 * 替代原有的 INI 文件加载，从统一数据加载器获取配置。
 */

import type { NpcResource } from "@miu2d/types";
import { buildCharacterConfigFromFlatData } from "../character/character-config";
import type { NpcResStateInfo } from "../character/character-res-loader";
import type { CharacterConfig, CharacterStats } from "../core/types";
import {
  CharacterKind,
  CharacterState,
  DEFAULT_CHARACTER_CONFIG,
  RelationType,
} from "../core/types";
import { getNpcsData, type NpcData } from "../data/game-data-api";
import { createConfigCache } from "../resource/cache-registry";

// ========== 缓存 ==========

const NPC_KEY_PREFIXES = ["ini/npc/", "ini/partner/"] as const;

// ========== Kind/Relation 映射 ==========

const KIND_MAP: Record<string, number> = {
  Normal: 0, // CharacterKind.Normal
  Fighter: 1, // CharacterKind.Fighter
  Follower: 3, // CharacterKind.Follower
  GroundAnimal: 4, // CharacterKind.GroundAnimal
  Eventer: 5, // CharacterKind.Eventer
  AfraidPlayerAnimal: 6, // CharacterKind.AfraidPlayerAnimal
  Flyer: 7, // CharacterKind.Flyer
};

const RELATION_MAP: Record<string, number> = {
  Friend: 0, // RelationType.Friend
  Enemy: 1, // RelationType.Enemy
  Neutral: 2, // RelationType.Neutral
  None: 3, // RelationType.None
};

function normalizeApiResources(
  resources: NpcResource | null | undefined
): CharacterConfig["_apiResources"] {
  if (!resources) {
    return undefined;
  }

  const normalized: CharacterConfig["_apiResources"] = {};
  for (const [key, res] of Object.entries(resources)) {
    if (!res) continue;
    normalized[key] = {
      image: res.image ?? null,
      sound: res.sound ?? null,
    };
  }
  return normalized;
}

const NPC_API_BASE_STATS: CharacterStats = {
  ...DEFAULT_CHARACTER_CONFIG.stats,
  life: 100,
  lifeMax: 100,
  mana: 100,
  manaMax: 100,
  thew: 100,
  thewMax: 100,
  attack: 10,
  attack2: 0,
  attack3: 0,
  attackLevel: 0,
  defend: 5,
  defend2: 0,
  defend3: 0,
  evade: 5,
  exp: 0,
  levelUpExp: 0,
  level: 1,
  canLevelUp: 0,
  walkSpeed: 2,
  addMoveSpeedPercent: 0,
  visionRadius: 0,
  attackRadius: 1,
  dialogRadius: 0,
  lum: 0,
  action: 0,
};

const NPC_API_BASE_CONFIG: CharacterConfig = {
  ...DEFAULT_CHARACTER_CONFIG,
  kind: CharacterKind.Normal,
  relation: RelationType.Friend,
  group: 0,
  noAutoAttackPlayer: 0,
  pathFinder: 0,
  npcIni: "",
  name: "",
  stats: NPC_API_BASE_STATS,
};

// ========== API -> CharacterConfig 转换 ==========

function convertApiNpcToConfig(api: NpcData): CharacterConfig {
  const flatData: Record<string, unknown> = {
    ...(api as unknown as Record<string, unknown>),
    kind: KIND_MAP[api.kind] ?? CharacterKind.Normal,
    relation: api.relation
      ? (RELATION_MAP[api.relation] ?? RelationType.Friend)
      : RelationType.Friend,
    mapX: 0,
    mapY: 0,
    dir: api.dir ?? 0,
  };

  const config = buildCharacterConfigFromFlatData(flatData, {
    baseConfig: NPC_API_BASE_CONFIG,
  });
  config._apiResources = normalizeApiResources(api.resources);
  return config;
}

// ========== API Resources -> NpcResStateInfo 转换 ==========

/** API resources key -> CharacterState 映射 */
const API_RES_KEY_TO_STATE: Record<string, number> = {
  stand: CharacterState.Stand,
  stand1: CharacterState.Stand1,
  walk: CharacterState.Walk,
  run: CharacterState.Run,
  jump: CharacterState.Jump,
  fightStand: CharacterState.FightStand,
  fightWalk: CharacterState.FightWalk,
  fightRun: CharacterState.FightRun,
  fightJump: CharacterState.FightJump,
  sit: CharacterState.Sit,
  hurt: CharacterState.Hurt,
  death: CharacterState.Death,
  attack: CharacterState.Attack,
  attack1: CharacterState.Attack1,
  attack2: CharacterState.Attack2,
  special1: CharacterState.Magic,
  special2: CharacterState.Special,
};

function convertApiResourcesToStateMap(
  resources: NpcResource | null | undefined
): Map<number, NpcResStateInfo> | null {
  if (!resources) return null;

  const stateMap = new Map<number, NpcResStateInfo>();

  for (const [key, res] of Object.entries(resources)) {
    if (!res || !res.image) continue;

    const state = API_RES_KEY_TO_STATE[key];
    if (state === undefined) continue;

    stateMap.set(state, {
      imagePath: res.image,
      shadePath: "", // API 目前没有 shade 字段
      soundPath: res.sound ?? "",
    });
  }

  return stateMap.size > 0 ? stateMap : null;
}

// ========== 缓存（使用通用 CacheRegistry） ==========

type NpcApiData = NonNullable<ReturnType<typeof getNpcsData>>;

const npcConfigCacheStore = createConfigCache<NpcApiData, CharacterConfig>({
  name: "NpcConfig",
  keyPrefixes: NPC_KEY_PREFIXES,
  getData: getNpcsData,
  build(data, cache, normalizeKey) {
    for (const api of data.npcs) {
      const config = convertApiNpcToConfig(api);
      if (api.npcIni) config.npcIni = api.npcIni;
      cache.set(normalizeKey(api.key), config);
    }
  },
});

const npcResCacheStore = createConfigCache<NpcApiData, Map<number, NpcResStateInfo>>({
  name: "NpcRes",
  keyPrefixes: NPC_KEY_PREFIXES,
  getData: getNpcsData,
  build(data, cache, normalizeKey) {
    // 1. NPC 自身可能有 inline resources
    for (const api of data.npcs) {
      const resMap = convertApiResourcesToStateMap(api.resources);
      if (resMap) cache.set(normalizeKey(api.key), resMap);
    }
    // 2. 独立的 NpcRes 资源
    for (const resData of data.resources) {
      const resMap = convertApiResourcesToStateMap(resData.resources);
      if (resMap) cache.set(normalizeKey(resData.key), resMap);
    }
    // 3. 为有 npcIni 的 NPC 创建别名（使 npc.key 也能查到资源）
    for (const api of data.npcs) {
      const npcKey = normalizeKey(api.key);
      if (!cache.has(npcKey) && api.npcIni) {
        const res = cache.get(normalizeKey(api.npcIni));
        if (res) cache.set(npcKey, res);
      }
    }
  },
});

// ========== 公共 API ==========

export function getNpcConfigFromCache(fileName: string): CharacterConfig | null {
  return npcConfigCacheStore.get(fileName);
}

/** 获取 NPC 资源映射（state -> ASF/Sound） */
export function getNpcResFromCache(npcIni: string): Map<number, NpcResStateInfo> | null {
  return npcResCacheStore.get(npcIni);
}

export function isNpcConfigLoaded(): boolean {
  return npcConfigCacheStore.isLoaded();
}

export function getAllNpcConfigKeys(): string[] {
  return npcConfigCacheStore.allKeys();
}
