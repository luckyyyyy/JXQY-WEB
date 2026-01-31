/**
 * INI Field Parser - 统一的 NPC/Character/Player 配置解析
 * Based on C# Character.AssignToValue() and Player.AssignToValue()
 *
 * 单一数据源：FIELD_DEFS 定义所有字段映射
 */

import { logger } from "../core/logger";
import type { CharacterConfig, CharacterStats } from "../core/types";
import { resourceLoader } from "../resource/resourceLoader";

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

// ============= Single Source of Truth =============
// C# Character.AssignToValue + Player.AssignToValue 的完整映射

const FIELD_DEFS: FieldDef[] = [
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
  { key: "timerscriptfile", prop: "timerScript", type: "string", target: "config" },
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

  // Equipment strings (C#: HeadEquip, NeckEquip, etc.)
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
  { key: "timerscriptinterval", prop: "timerInterval", type: "int", target: "config" },
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
  // Player-only Fields (C# Player.AssignToValue)
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
];

// Build lookup map for O(1) access by INI key
const FIELD_MAP = new Map<string, FieldDef>();
for (const def of FIELD_DEFS) {
  FIELD_MAP.set(def.key, def);
}

// ============= Pre-grouped Field Lists =============
// Computed once at module load for O(1) runtime access

/** Character fields (non-player) */
const CHAR_FIELDS = FIELD_DEFS.filter((d) => d.class !== "player");
/** Player-only fields */
const PLAYER_FIELDS = FIELD_DEFS.filter((d) => d.class === "player");

// ============= Character Interface =============
// C# Character 的所有可配置属性

/** Character instance - matches C# Character public properties */
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
  timerScript: string;
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
  timerInterval: number;
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
}

// ============= Player Interface =============
// C# Player 继承 Character，有额外属性

/** Player instance - extends CharacterInstance with Player-only properties */
export interface PlayerInstance extends CharacterInstance {
  money: number;
  manaLimit: boolean;
  isRunDisabled: boolean;
  isJumpDisabled: boolean;
  isFightDisabled: boolean;
}

// ============= Parse Functions =============

/** Parse value based on field type */
function parseValue(value: string, type: FieldType): string | number | boolean {
  switch (type) {
    case "int":
      return parseInt(value, 10) || 0;
    case "bool":
      return value !== "0";
    default:
      return value;
  }
}

/**
 * Parse INI content to CharacterConfig
 */
export function parseCharacterIni(content: string): CharacterConfig | null {
  const config: Partial<CharacterConfig> = {
    group: 0,
    noAutoAttackPlayer: 0,
    pathFinder: 0,
  };
  const stats: Partial<CharacterStats> = {};

  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("[") || trimmed.startsWith(";") || !trimmed.includes("=")) {
      continue;
    }

    const eqIdx = trimmed.indexOf("=");
    const key = trimmed.substring(0, eqIdx).trim().toLowerCase();
    const value = trimmed.substring(eqIdx + 1).trim();

    const def = FIELD_MAP.get(key);
    if (def) {
      const parsedValue = parseValue(value, def.type);
      if (def.target === "config") {
        (config as Record<string, string | number | boolean>)[def.prop] = parsedValue;
      } else {
        (stats as Record<string, number>)[def.prop] = parsedValue as number;
      }
    }
  }

  if (!config.name) {
    return null;
  }

  config.stats = stats as CharacterStats;
  return config as CharacterConfig;
}

/**
 * Load and parse character config from file path
 * Uses resourceLoader.loadIni to cache parsed result (avoids re-parsing on repeated loads)
 */
export async function loadCharacterConfig(url: string): Promise<CharacterConfig | null> {
  try {
    const config = await resourceLoader.loadIni(url, parseCharacterIni, "npcConfig");
    if (!config) {
      logger.warn(`[IniParser] Config not found or parse failed: ${url}`);
      return null;
    }
    return config;
  } catch (error) {
    logger.error(`[IniParser] Error loading config ${url}:`, error);
    return null;
  }
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
 * C# Reference: Character.AssignToValue()
 */
export function applyConfigToCharacter(
  config: CharacterConfig,
  character: CharacterInstance
): void {
  applyFields(CHAR_FIELDS, config, character as unknown as Record<string, unknown>);
}

/**
 * Apply CharacterConfig to a Player instance (includes player-only fields)
 * Pure field assignment - call player.initializeAfterLoad() after this
 * C# Reference: Character.AssignToValue() + Player.AssignToValue()
 */
export function applyConfigToPlayer(config: CharacterConfig, player: PlayerInstance): void {
  const record = player as unknown as Record<string, unknown>;
  applyFields(CHAR_FIELDS, config, record);
  applyFields(PLAYER_FIELDS, config, record);
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
