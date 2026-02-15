/**
 * Character Config - 统一的 NPC/Character/Player 配置解析与转换
 * () and Player.AssignToValue()
 *
 * 单一数据源：FIELD_DEFS 定义所有字段映射
 */

import { logger } from "../core/logger";
import type { CharacterConfig, CharacterStats } from "../core/types";

// ============= Type Definitions =============

type FieldType = "string" | "int" | "bool";
type FieldTarget = "config" | "stats";
/** Which class this field belongs to */
type FieldClass = "character" | "player";

interface FieldDef {
  /** INI key (lowercase for matching) */
  key: string;
  /** Property name in config/stats and Character/Player */
  prop: string;
  /** Field type */
  type: FieldType;
  /** Target object: config or stats */
  target: FieldTarget;
  /** Which class: character (base) or player (Player only) */
  class?: FieldClass;
}

export interface BuildCharacterConfigOptions {
  /** Include player-only fields */
  includePlayerFields?: boolean;
  /** Base config used for defaults */
  baseConfig: CharacterConfig;
}

// ============= Single Source of Truth =============
// Character.AssignToValue + Player.AssignToValue 的完整映射

export const FIELD_DEFS: FieldDef[] = [
  // =============================================
  // Character Config - String Fields
  // =============================================
  { key: "name", prop: "name", type: "string", target: "config" },
  { key: "npcini", prop: "npcIni", type: "string", target: "config" },
  { key: "flyini", prop: "flyIni", type: "string", target: "config" },
  { key: "flyini2", prop: "flyIni2", type: "string", target: "config" },
  { key: "flyinis", prop: "flyInis", type: "string", target: "config" },
  { key: "bodyini", prop: "bodyIni", type: "string", target: "config" },
  { key: "scriptfile", prop: "scriptFile", type: "string", target: "config" },
  { key: "scriptfileright", prop: "scriptFileRight", type: "string", target: "config" },
  { key: "deathscript", prop: "deathScript", type: "string", target: "config" },
  { key: "timerscriptfile", prop: "timerScriptFile", type: "string", target: "config" },
  { key: "dropini", prop: "dropIni", type: "string", target: "config" },
  { key: "buyinifile", prop: "buyIniFile", type: "string", target: "config" },
  { key: "buyinistring", prop: "buyIniString", type: "string", target: "config" },
  { key: "fixedpos", prop: "fixedPos", type: "string", target: "config" },
  { key: "visiblevariablename", prop: "visibleVariableName", type: "string", target: "config" },
  { key: "magictousewhenlifelow", prop: "magicToUseWhenLifeLow", type: "string", target: "config" },
  {
    key: "magictousewhenbeattacked",
    prop: "magicToUseWhenBeAttacked",
    type: "string",
    target: "config",
  },
  { key: "magictousewhendeath", prop: "magicToUseWhenDeath", type: "string", target: "config" },
  { key: "levelini", prop: "levelIniFile", type: "string", target: "config" },
  { key: "poisonbycharactername", prop: "poisonByCharacterName", type: "string", target: "config" },

  // Equipment strings
  { key: "headequip", prop: "headEquip", type: "string", target: "config" },
  { key: "neckequip", prop: "neckEquip", type: "string", target: "config" },
  { key: "bodyequip", prop: "bodyEquip", type: "string", target: "config" },
  { key: "backequip", prop: "backEquip", type: "string", target: "config" },
  { key: "handequip", prop: "handEquip", type: "string", target: "config" },
  { key: "wristequip", prop: "wristEquip", type: "string", target: "config" },
  { key: "footequip", prop: "footEquip", type: "string", target: "config" },
  {
    key: "backgroundtextureequip",
    prop: "backgroundTextureEquip",
    type: "string",
    target: "config",
  },

  // =============================================
  // Character Config - Int Fields
  // =============================================
  { key: "kind", prop: "kind", type: "int", target: "config" },
  { key: "relation", prop: "relation", type: "int", target: "config" },
  { key: "group", prop: "group", type: "int", target: "config" },
  { key: "noautoattackplayer", prop: "noAutoAttackPlayer", type: "int", target: "config" },
  { key: "idle", prop: "idle", type: "int", target: "config" },
  { key: "timerscriptinterval", prop: "timerScriptInterval", type: "int", target: "config" },
  { key: "pathfinder", prop: "pathFinder", type: "int", target: "config" },
  { key: "caninteractdirectly", prop: "canInteractDirectly", type: "int", target: "config" },
  { key: "expbonus", prop: "expBonus", type: "int", target: "config" },
  { key: "keepradiuswhenlifelow", prop: "keepRadiusWhenLifeLow", type: "int", target: "config" },
  { key: "lifelowpercent", prop: "lifeLowPercent", type: "int", target: "config" },
  { key: "stopfindingtarget", prop: "stopFindingTarget", type: "int", target: "config" },
  {
    key: "keepradiuswhenfrienddeath",
    prop: "keepRadiusWhenFriendDeath",
    type: "int",
    target: "config",
  },
  { key: "aitype", prop: "aiType", type: "int", target: "config" },
  { key: "invincible", prop: "invincible", type: "int", target: "config" },
  { key: "revivemilliseconds", prop: "reviveMilliseconds", type: "int", target: "config" },
  { key: "hurtplayerinterval", prop: "hurtPlayerInterval", type: "int", target: "config" },
  { key: "hurtplayerlife", prop: "hurtPlayerLife", type: "int", target: "config" },
  { key: "hurtplayerradius", prop: "hurtPlayerRadius", type: "int", target: "config" },
  {
    key: "magicdirectionwhenbeattacked",
    prop: "magicDirectionWhenBeAttacked",
    type: "int",
    target: "config",
  },
  {
    key: "magicdirectionwhendeath",
    prop: "magicDirectionWhenDeath",
    type: "int",
    target: "config",
  },
  { key: "visiblevariablevalue", prop: "visibleVariableValue", type: "int", target: "config" },
  { key: "nodropwhendie", prop: "noDropWhenDie", type: "int", target: "config" },
  { key: "canequip", prop: "canEquip", type: "int", target: "config" },
  { key: "keepattackx", prop: "keepAttackX", type: "int", target: "config" },
  { key: "keepattacky", prop: "keepAttackY", type: "int", target: "config" },

  // Bool fields (parsed as int, 0=false, non-0=true)
  { key: "isdeath", prop: "isDeath", type: "bool", target: "config" },
  { key: "isdeathinvoked", prop: "isDeathInvoked", type: "bool", target: "config" },

  // Status effect fields
  { key: "poisonseconds", prop: "poisonSeconds", type: "int", target: "config" },
  { key: "petrifiedseconds", prop: "petrifiedSeconds", type: "int", target: "config" },
  { key: "frozenseconds", prop: "frozenSeconds", type: "int", target: "config" },
  { key: "ispoisionvisualeffect", prop: "isPoisonVisualEffect", type: "bool", target: "config" },
  {
    key: "ispetrifiedvisualeffect",
    prop: "isPetrifiedVisualEffect",
    type: "bool",
    target: "config",
  },
  { key: "isfronzenvisualeffect", prop: "isFrozenVisualEffect", type: "bool", target: "config" },

  // =============================================
  // Character Stats Fields
  // =============================================
  { key: "life", prop: "life", type: "int", target: "stats" },
  { key: "lifemax", prop: "lifeMax", type: "int", target: "stats" },
  { key: "mana", prop: "mana", type: "int", target: "stats" },
  { key: "manamax", prop: "manaMax", type: "int", target: "stats" },
  { key: "thew", prop: "thew", type: "int", target: "stats" },
  { key: "thewmax", prop: "thewMax", type: "int", target: "stats" },
  { key: "attack", prop: "attack", type: "int", target: "stats" },
  { key: "attack2", prop: "attack2", type: "int", target: "stats" },
  { key: "attack3", prop: "attack3", type: "int", target: "stats" },
  { key: "attacklevel", prop: "attackLevel", type: "int", target: "stats" },
  { key: "defend", prop: "defend", type: "int", target: "stats" },
  { key: "defence", prop: "defend", type: "int", target: "stats" }, // Alias
  { key: "defend2", prop: "defend2", type: "int", target: "stats" },
  { key: "defend3", prop: "defend3", type: "int", target: "stats" },
  { key: "evade", prop: "evade", type: "int", target: "stats" },
  { key: "exp", prop: "exp", type: "int", target: "stats" },
  { key: "levelupexp", prop: "levelUpExp", type: "int", target: "stats" },
  { key: "level", prop: "level", type: "int", target: "stats" },
  { key: "canlevelup", prop: "canLevelUp", type: "int", target: "stats" },
  { key: "walkspeed", prop: "walkSpeed", type: "int", target: "stats" },
  { key: "addmovespeedpercent", prop: "addMoveSpeedPercent", type: "int", target: "stats" },
  { key: "visionradius", prop: "visionRadius", type: "int", target: "stats" },
  { key: "attackradius", prop: "attackRadius", type: "int", target: "stats" },
  { key: "dialogradius", prop: "dialogRadius", type: "int", target: "stats" },
  { key: "lum", prop: "lum", type: "int", target: "stats" },
  { key: "action", prop: "action", type: "int", target: "stats" },

  // Position fields
  { key: "mapx", prop: "mapX", type: "int", target: "stats" },
  { key: "mapy", prop: "mapY", type: "int", target: "stats" },
  { key: "dir", prop: "dir", type: "int", target: "stats" },

  // =============================================
  // Runtime State Fields (saved/loaded, not from INI config)
  // C# loads these via reflection default case in AssignToValue()
  // =============================================
  { key: "state", prop: "state", type: "int", target: "config" },
  { key: "currentfixedposindex", prop: "currentFixedPosIndex", type: "int", target: "config" },
  { key: "destinationmapposx", prop: "destinationMapPosX", type: "int", target: "config" },
  { key: "destinationmapposy", prop: "destinationMapPosY", type: "int", target: "config" },
  {
    key: "leftmillisecondstorevive",
    prop: "leftMillisecondsToRevive",
    type: "int",
    target: "config",
  },
  { key: "isbodyiniadded", prop: "isBodyIniAdded", type: "int", target: "config" },

  // =============================================
  // Player-only Fields
  // =============================================
  { key: "money", prop: "money", type: "int", target: "config", class: "player" },
  { key: "manalimit", prop: "manaLimit", type: "bool", target: "config", class: "player" },
  { key: "isrundisabled", prop: "isRunDisabled", type: "bool", target: "config", class: "player" },
  {
    key: "isjumpdisabled",
    prop: "isJumpDisabled",
    type: "bool",
    target: "config",
    class: "player",
  },
  {
    key: "isfightdisabled",
    prop: "isFightDisabled",
    type: "bool",
    target: "config",
    class: "player",
  },
  { key: "walkisrun", prop: "walkIsRun", type: "int", target: "config", class: "player" },
  {
    key: "currentusemagicindex",
    prop: "currentUseMagicIndex",
    type: "int",
    target: "config",
    class: "player",
  },
  {
    key: "addliferestorepercent",
    prop: "addLifeRestorePercent",
    type: "int",
    target: "config",
    class: "player",
  },
  {
    key: "addmanarestorepercent",
    prop: "addManaRestorePercent",
    type: "int",
    target: "config",
    class: "player",
  },
  {
    key: "addthewrestorepercent",
    prop: "addThewRestorePercent",
    type: "int",
    target: "config",
    class: "player",
  },
];

// ============= Pre-grouped Field Lists =============
// Computed once at module load for O(1) runtime access

/** Character fields (non-player) */
const CHAR_FIELDS = FIELD_DEFS.filter((d) => d.class !== "player");

/** All field prop names (deduplicated, for flat data assignment) */
const ALL_PROPS = [...new Set(FIELD_DEFS.map((d) => d.prop))];
/** Character-only prop names (deduplicated) */
const CHAR_PROPS = [...new Set(CHAR_FIELDS.map((d) => d.prop))];

function parseFieldInt(value: unknown): number | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  if (typeof value === "number") return Number.isFinite(value) ? value : undefined;
  const parsed = parseInt(String(value), 10);
  return Number.isNaN(parsed) ? undefined : parsed;
}

function parseFieldBool(value: unknown): boolean | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  const lower = String(value).toLowerCase();
  if (lower === "true" || lower === "1") return true;
  if (lower === "false" || lower === "0") return false;
  return undefined;
}

function parseFieldString(value: unknown): string | undefined {
  if (value === undefined || value === null) return undefined;
  return String(value);
}

function parseFieldValue(def: FieldDef, value: unknown): string | number | boolean | undefined {
  switch (def.type) {
    case "int":
      return parseFieldInt(value);
    case "bool":
      return parseFieldBool(value);
    case "string":
      return parseFieldString(value);
    default:
      return undefined;
  }
}

// ============= Character Interface =============
// Character 的所有可配置属性

/** Character instance - matches Character public properties */
export interface CharacterInstance {
  // Config properties (string)
  name: string;
  npcIni: string;
  flyIni: string;
  flyIni2: string;
  flyInis: string;
  bodyIni: string;
  scriptFile: string;
  scriptFileRight: string;
  deathScript: string;
  timerScriptFile: string;
  dropIni: string;
  buyIniFile: string;
  buyIniString: string;
  fixedPos: string;
  visibleVariableName: string;
  magicToUseWhenLifeLow: string;
  magicToUseWhenBeAttacked: string;
  magicToUseWhenDeath: string;
  levelIniFile: string;
  poisonByCharacterName: string;

  // Equipment
  headEquip: string;
  neckEquip: string;
  bodyEquip: string;
  backEquip: string;
  handEquip: string;
  wristEquip: string;
  footEquip: string;
  backgroundTextureEquip: string;

  // Config properties (int)
  kind: number;
  relation: number;
  group: number;
  noAutoAttackPlayer: number;
  idle: number;
  timerScriptInterval: number;
  pathFinder: number;
  canInteractDirectly: number;
  expBonus: number;
  keepRadiusWhenLifeLow: number;
  lifeLowPercent: number;
  stopFindingTarget: number;
  keepRadiusWhenFriendDeath: number;
  aiType: number;
  invincible: number;
  reviveMilliseconds: number;
  hurtPlayerInterval: number;
  hurtPlayerLife: number;
  hurtPlayerRadius: number;
  magicDirectionWhenBeAttacked: number;
  magicDirectionWhenDeath: number;
  visibleVariableValue: number;
  noDropWhenDie: number;
  canEquip: number;
  keepAttackX: number;
  keepAttackY: number;

  // Bool properties
  isDeath: boolean;
  isDeathInvoked: boolean;

  // Status effect
  poisonSeconds: number;
  petrifiedSeconds: number;
  frozenSeconds: number;
  isPoisonVisualEffect: boolean;
  isPetrifiedVisualEffect: boolean;
  isFrozenVisualEffect: boolean;

  // Stats properties
  life: number;
  lifeMax: number;
  mana: number;
  manaMax: number;
  thew: number;
  thewMax: number;
  attack: number;
  attack2: number;
  attack3: number;
  attackLevel: number;
  defend: number;
  defend2: number;
  defend3: number;
  evade: number;
  exp: number;
  levelUpExp: number;
  level: number;
  canLevelUp: number;
  walkSpeed: number;
  addMoveSpeedPercent: number;
  visionRadius: number;
  attackRadius: number;
  dialogRadius: number;
  lum: number;
  action: number;

  // Position (for save/load)
  mapX: number;
  mapY: number;
  dir: number;

  // Runtime state (saved/loaded, not INI config)
  state: number;
  currentFixedPosIndex: number;
  destinationMapPosX: number;
  destinationMapPosY: number;
  leftMillisecondsToRevive: number;
  isBodyIniAdded: number;

  // Player-only runtime state (optional - only on Player)
  walkIsRun?: number;
  currentUseMagicIndex?: number;
  addLifeRestorePercent?: number;
  addManaRestorePercent?: number;
  addThewRestorePercent?: number;
}

/**
 * Load character config - 从 API 缓存获取
 */
export async function loadCharacterConfig(url: string): Promise<CharacterConfig | null> {
  const { getNpcConfigFromCache, isNpcConfigLoaded } = await import("../npc/npc-config-cache");
  if (!isNpcConfigLoaded()) {
    logger.error(`[IniParser] Game data not loaded! Call loadGameData() first.`);
    return null;
  }

  const config = getNpcConfigFromCache(url);
  if (!config) {
    logger.warn(`[IniParser] Config not found in cache: ${url}`);
  }
  return config;
}

// ============= Apply to Character =============

/**
 * Apply fields from config to character record
 * Pure assignment, no side effects
 */
function applyFields(
  fields: FieldDef[],
  config: CharacterConfig,
  charRecord: Record<string, unknown>
): void {
  const stats = config.stats;

  for (const def of fields) {
    let value: string | number | boolean | undefined;

    if (def.target === "stats" && stats) {
      value = (stats as unknown as Record<string, number>)[def.prop];
    } else {
      value = (config as unknown as Record<string, string | number | boolean>)[def.prop];
    }

    if (value !== undefined && value !== null) {
      charRecord[def.prop] = value;
    }
  }
}

/**
 * Apply CharacterConfig to a Character/NPC instance
 * Pure field assignment - call character.initializeAfterLoad() after this
 * Reference: Character.AssignToValue()
 */
export function applyConfigToCharacter(
  config: CharacterConfig,
  character: CharacterInstance
): void {
  applyFields(CHAR_FIELDS, config, character as unknown as Record<string, unknown>);
}

/**
 * Apply flat data to a CharacterInstance (pure assignment, no side effects)
 *
 * 统一的字段赋值入口，用于 loadFromApiData / loadFromSaveData。
 * 只赋值 FIELD_DEFS 中定义的属性，跳过 undefined/null 值。
 * 调用方在赋值后应调用 applyConfigSetters() 触发副作用。
 *
 * @param data 扁平数据对象（ApiPlayerData / PlayerSaveData / 其他）
 * @param character 目标 CharacterInstance
 * @param includePlayerFields 是否包含 Player-only 字段
 */
export function applyFlatDataToCharacter(
  data: Record<string, unknown>,
  character: CharacterInstance,
  includePlayerFields: boolean = false
): void {
  const props = includePlayerFields ? ALL_PROPS : CHAR_PROPS;
  const charRecord = character as unknown as Record<string, unknown>;

  for (const prop of props) {
    const value = data[prop];
    if (value !== undefined && value !== null) {
      charRecord[prop] = value;
    }
  }
}

/**
 * Build CharacterConfig from flat data using FIELD_DEFS mapping.
 *
 * 用于将 API/存档等扁平数据转换为 CharacterConfig，避免重复手写字段映射。
 */
export function buildCharacterConfigFromFlatData(
  data: Record<string, unknown>,
  options: BuildCharacterConfigOptions
): CharacterConfig {
  const { includePlayerFields = false, baseConfig } = options;
  const defs = includePlayerFields ? FIELD_DEFS : CHAR_FIELDS;

  const config = {
    ...baseConfig,
    stats: {
      ...baseConfig.stats,
    },
  } as CharacterConfig;

  for (const def of defs) {
    const parsed = parseFieldValue(def, data[def.prop]);
    if (parsed === undefined) continue;

    if (def.target === "stats") {
      (config.stats as unknown as Record<string, unknown>)[def.prop] = parsed;
    } else {
      (config as unknown as Record<string, unknown>)[def.prop] = parsed;
    }
  }

  return config;
}

// ============= Extract from Character =============

/**
 * Extract CharacterConfig from a Character instance
 */
export function extractConfigFromCharacter(
  character: CharacterInstance,
  isPlayer: boolean = false
): CharacterConfig {
  const config: Record<string, string | number | boolean | CharacterStats> = {};
  const stats: Record<string, number> = {};
  const charRecord = character as unknown as Record<
    string,
    string | number | boolean | ((...args: unknown[]) => unknown)
  >;

  for (const def of FIELD_DEFS) {
    // Skip player-only fields if not a player
    if (def.class === "player" && !isPlayer) continue;

    const value = charRecord[def.prop];
    if (typeof value === "function") continue;

    if (def.target === "stats") {
      stats[def.prop] = value as number;
    } else {
      config[def.prop] = value as string | number | boolean;
    }
  }

  config.stats = stats as unknown as CharacterStats;
  return config as unknown as CharacterConfig;
}

/**
 * Extract CharacterStats from a Character instance
 */
export function extractStatsFromCharacter(character: CharacterInstance): CharacterStats {
  const stats: Record<string, number> = {};
  const charRecord = character as unknown as Record<
    string,
    string | number | boolean | ((...args: unknown[]) => unknown)
  >;

  for (const def of FIELD_DEFS) {
    if (def.target === "stats") {
      const value = charRecord[def.prop];
      if (typeof value !== "function") {
        stats[def.prop] = value as number;
      }
    }
  }

  return stats as unknown as CharacterStats;
}

/**
 * Extract flat data from a CharacterInstance as a plain Record
 *
 * 统一的字段提取入口，用于 collectPlayerData / collectNpcSnapshot。
 * 返回 FIELD_DEFS 中定义的所有属性的扁平对象。
 * 字符串值为空时转为 undefined（用于存档格式）。
 *
 * @param character 源 CharacterInstance
 * @param includePlayerFields 是否包含 Player-only 字段
 */
export function extractFlatDataFromCharacter(
  character: CharacterInstance,
  includePlayerFields: boolean = false
): Record<string, unknown> {
  const props = includePlayerFields ? ALL_PROPS : CHAR_PROPS;
  const charRecord = character as unknown as Record<string, unknown>;
  const result: Record<string, unknown> = {};

  for (const prop of props) {
    const value = charRecord[prop];
    if (typeof value === "function") continue;
    // 字符串空值转 undefined（存档格式约定）
    if (typeof value === "string" && value === "") {
      result[prop] = undefined;
    } else {
      result[prop] = value;
    }
  }

  return result;
}
