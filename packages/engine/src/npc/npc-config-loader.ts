/**
 * NPC Config Loader - 从 API 缓存获取 NPC 配置
 *
 * 替代原有的 INI 文件加载，从统一数据加载器获取配置。
 */

import type { NpcResStateInfo } from "../character/res-loader";
import type { CharacterConfig, CharacterStats } from "../core/types";
import { CharacterState } from "../core/types";
import { createConfigCache } from "../resource/cache-registry";
import { type ApiNpcData, type ApiNpcResources, getNpcsData } from "../resource/resource-loader";

// ========== 缓存 ==========

const NPC_KEY_PREFIXES = ["ini/npc/", "ini/partner/"] as const;

// ========== Kind/Relation 映射 ==========

const KIND_MAP: Record<string, number> = {
  Normal: 0, // CharacterKind.Normal
  Fighter: 1, // CharacterKind.Fighter
  GroundAnimal: 4, // CharacterKind.GroundAnimal
  Eventer: 5, // CharacterKind.Eventer
  Flyer: 7, // CharacterKind.Flyer
  WaterAnimal: 4, // 映射到 GroundAnimal
  Decoration: 5, // 映射到 Eventer
  Intangible: 6, // CharacterKind.AfraidPlayerAnimal
};

const RELATION_MAP: Record<string, number> = {
  Friendly: 0, // RelationType.Friend
  Hostile: 1, // RelationType.Enemy
  Neutral: 2, // RelationType.Neutral
  Partner: 3, // RelationType.None
};

// ========== API -> CharacterConfig 转换 ==========

function convertApiNpcToConfig(api: ApiNpcData): CharacterConfig {
  const stats: CharacterStats = {
    life: api.life ?? 100,
    lifeMax: api.lifeMax ?? api.life ?? 100,
    mana: api.mana ?? 100,
    manaMax: api.manaMax ?? api.mana ?? 100,
    thew: api.thew ?? 100,
    thewMax: api.thewMax ?? api.thew ?? 100,
    attack: api.attack ?? 10,
    attack2: 0,
    attack3: 0,
    attackLevel: 0,
    defend: api.defend ?? 5,
    defend2: 0,
    defend3: 0,
    evade: api.evade ?? 5,
    exp: api.exp ?? 0,
    levelUpExp: 0,
    level: api.level ?? 1,
    canLevelUp: 0,
    walkSpeed: api.walkSpeed ?? 2,
    addMoveSpeedPercent: 0,
    visionRadius: 0,
    attackRadius: api.attackRadius ?? 1,
    dialogRadius: 0,
    lum: api.lum ?? 0,
    action: 0,
    mapX: 0,
    mapY: 0,
    dir: api.dir ?? 0,
  };

  return {
    name: api.name,
    npcIni: "",
    flyIni: api.flyIni ?? "",
    flyIni2: "",
    flyInis: "",
    bodyIni: api.bodyIni ?? "",
    scriptFile: api.scriptFile ?? "",
    scriptFileRight: "",
    deathScript: api.deathScript ?? "",
    timerScriptFile: "",
    dropIni: "",
    buyIniFile: "",
    fixedPos: "",
    visibleVariableName: "",
    magicToUseWhenLifeLow: "",
    magicToUseWhenBeAttacked: "",
    magicToUseWhenDeath: "",
    kind: KIND_MAP[api.kind] ?? 0,
    relation: api.relation ? (RELATION_MAP[api.relation] ?? 0) : 0,
    group: 0,
    noAutoAttackPlayer: 0,
    idle: 0,
    timerScriptInterval: 0,
    pathFinder: api.pathFinder ?? 0,
    canInteractDirectly: 0,
    expBonus: 0,
    keepRadiusWhenLifeLow: 0,
    lifeLowPercent: 0,
    stopFindingTarget: 0,
    keepRadiusWhenFriendDeath: 0,
    aiType: 0,
    invincible: 0,
    reviveMilliseconds: 0,
    hurtPlayerInterval: 0,
    hurtPlayerLife: 0,
    hurtPlayerRadius: 0,
    magicDirectionWhenBeAttacked: 0,
    magicDirectionWhenDeath: 0,
    visibleVariableValue: 0,
    noDropWhenDie: 0,
    stats,
    _apiResources: api.resources ?? undefined,
  };
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
  resources: ApiNpcResources | null | undefined
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
