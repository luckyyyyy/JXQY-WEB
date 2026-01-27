/**
 * ResFile - NPC Resource File Parser
 * Based on JxqyHD Engine/ResFile.cs
 *
 * Handles loading and parsing INI files:
 * - npcres/*.ini - state to ASF mappings
 * - npc/*.ini - NPC configuration (name, stats, scripts)
 *
 * C# Reference: Engine/ResFile.cs, Engine/Npc.cs
 */

import { CharacterState } from "../core/types";
import type { CharacterConfig, CharacterStats, CharacterKind, RelationType } from "../core/types";
import { parseIni } from "../core/utils";
import { loadAsf, type AsfData } from "../sprite/asf";

/**
 * NpcRes state info parsed from ini/npcres/*.ini
 * Based on C# ResStateInfo
 */
export interface NpcResStateInfo {
  imagePath: string;  // ASF file name
  soundPath: string;  // WAV file name
}

/**
 * State name to CharacterState mapping
 * Based on C# ResFile.GetState()
 */
const STATE_NAMES: Record<string, number> = {
  "Stand": CharacterState.Stand,
  "Stand1": CharacterState.Stand1,
  "Walk": CharacterState.Walk,
  "Run": CharacterState.Run,
  "Jump": CharacterState.Jump,
  "Attack": CharacterState.Attack,
  "Attack1": CharacterState.Attack1,
  "Attack2": CharacterState.Attack2,
  "Magic": CharacterState.Magic,
  "Sit": CharacterState.Sit,
  "Hurt": CharacterState.Hurt,
  "Death": CharacterState.Death,
  "FightStand": CharacterState.FightStand,
  "FightWalk": CharacterState.FightWalk,
  "FightRun": CharacterState.FightRun,
  "FightJump": CharacterState.FightJump,
};

/**
 * Parse npcres INI file content
 * Based on C# ResFile.ReadFile()
 */
export function parseNpcResIni(content: string): Map<number, NpcResStateInfo> {
  const stateMap = new Map<number, NpcResStateInfo>();
  const sections = parseIni(content);

  // Map sections to states
  for (const [sectionName, keys] of Object.entries(sections)) {
    const state = STATE_NAMES[sectionName];
    if (state !== undefined && keys["Image"]) {
      stateMap.set(state, {
        imagePath: keys["Image"],
        soundPath: keys["Sound"] || "",
      });
    }
  }

  return stateMap;
}

/**
 * Load ASF file from character or interlude directory
 * Based on C# ResFile.GetAsfFilePathBase()
 */
export async function loadCharacterAsf(asfFileName: string): Promise<AsfData | null> {
  // Encode Chinese characters in filename for URL
  const encodedFileName = encodeURIComponent(asfFileName);

  const paths = [
    `/resources/asf/character/${encodedFileName}`,
    `/resources/asf/interlude/${encodedFileName}`,
  ];

  for (const path of paths) {
    const asf = await loadAsf(path);
    if (asf) {
      console.log(`[ResFile] Loaded ASF: ${path}`);
      return asf;
    }
  }

  console.warn(`[ResFile] ASF not found: ${asfFileName}`);
  return null;
}

// NpcRes cache (npcIni -> state map)
const npcResCache: Map<string, Map<number, NpcResStateInfo>> = new Map();

/**
 * Load NpcRes INI file to get state -> ASF mappings
 * Based on C# ResFile.ReadFile(@"ini\npcres\" + fileName, ResType.Npc)
 */
export async function loadNpcRes(npcIni: string): Promise<Map<number, NpcResStateInfo> | null> {
  // Check cache first
  if (npcResCache.has(npcIni)) {
    return npcResCache.get(npcIni)!;
  }

  // npcIni is the filename like "npc006.ini" or "z-杨影枫.ini"
  const filePath = `/resources/ini/npcres/${npcIni}`;
  const response = await tryFetchIni(filePath);

  if (!response) {
    console.warn(`[ResFile] NpcRes not found: ${filePath}`);
    return null;
  }

  try {
    const content = await response.text();
    const stateMap = parseNpcResIni(content);
    console.log(`[ResFile] Loaded NpcRes: ${npcIni} with ${stateMap.size} states`);
    npcResCache.set(npcIni, stateMap);
    return stateMap;
  } catch (error) {
    console.warn(`[ResFile] Failed to load NpcRes: ${npcIni}`, error);
    return null;
  }
}

/**
 * Clear NpcRes cache
 */
export function clearNpcResCache(): void {
  npcResCache.clear();
}

// ============= Common INI Fetch Utilities =============

/**
 * Try to fetch an INI file, handling Vite's HTML fallback
 * Returns null if file not found or is HTML
 */
async function tryFetchIni(url: string): Promise<Response | null> {
  try {
    const response = await fetch(url);
    if (!response.ok) return null;

    const contentType = response.headers.get('content-type') || '';
    if (contentType.includes('text/html')) return null;

    const clone = response.clone();
    const text = await clone.text();
    const trimmed = text.trim();

    if (trimmed.startsWith('<!DOCTYPE') || trimmed.startsWith('<html')) return null;

    return response;
  } catch {
    return null;
  }
}

// ============= NPC Config Loading (from ini/npc/*.ini) =============

/**
 * Parse NPC configuration from INI content
 * Based on C# Npc.Load()
 */
export function parseNpcConfig(content: string): CharacterConfig | null {
  const lines = content.split("\n");
  const config: Partial<CharacterConfig> = {
    stats: {} as CharacterStats,
    group: 0,
    noAutoAttackPlayer: 0,
    pathFinder: 0,
  };

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith("[") || trimmed.startsWith(";") || !trimmed.includes("=")) {
      continue;
    }

    const [key, value] = trimmed.split("=").map((s) => s.trim());
    const stats = config.stats as CharacterStats;

    switch (key.toLowerCase()) {
      case "name":
        config.name = value;
        break;
      case "npcini":
        config.npcIni = value;
        break;
      case "flyini":
        config.flyIni = value;
        break;
      case "flyini2":
        config.flyIni2 = value;
        break;
      case "bodyini":
        config.bodyIni = value;
        break;
      case "kind":
        config.kind = parseInt(value, 10) as CharacterKind;
        break;
      case "relation":
        config.relation = parseInt(value, 10) as RelationType;
        break;
      case "group":
        config.group = parseInt(value, 10);
        break;
      case "noautoattackplayer":
        config.noAutoAttackPlayer = parseInt(value, 10);
        break;
      case "life":
        stats.life = parseInt(value, 10);
        break;
      case "lifemax":
        stats.lifeMax = parseInt(value, 10);
        break;
      case "mana":
        stats.mana = parseInt(value, 10);
        break;
      case "manamax":
        stats.manaMax = parseInt(value, 10);
        break;
      case "thew":
        stats.thew = parseInt(value, 10);
        break;
      case "thewmax":
        stats.thewMax = parseInt(value, 10);
        break;
      case "attack":
        stats.attack = parseInt(value, 10);
        break;
      case "attack2":
        stats.attack2 = parseInt(value, 10);
        break;
      case "attack3":
        stats.attack3 = parseInt(value, 10);
        break;
      case "attacklevel":
        stats.attackLevel = parseInt(value, 10);
        break;
      case "defend":
        stats.defend = parseInt(value, 10);
        break;
      case "defend2":
        stats.defend2 = parseInt(value, 10);
        break;
      case "defend3":
        stats.defend3 = parseInt(value, 10);
        break;
      case "evade":
        stats.evade = parseInt(value, 10);
        break;
      case "exp":
        stats.exp = parseInt(value, 10);
        break;
      case "levelupexp":
        stats.levelUpExp = parseInt(value, 10);
        break;
      case "level":
        stats.level = parseInt(value, 10);
        break;
      case "canlevelup":
        stats.canLevelUp = parseInt(value, 10);
        break;
      case "walkspeed":
        stats.walkSpeed = parseInt(value, 10);
        break;
      case "addmovespeedpercent":
        stats.addMoveSpeedPercent = parseInt(value, 10);
        break;
      case "visionradius":
        stats.visionRadius = parseInt(value, 10);
        break;
      case "attackradius":
        stats.attackRadius = parseInt(value, 10);
        break;
      case "dialogradius":
        stats.dialogRadius = parseInt(value, 10);
        break;
      case "lum":
        stats.lum = parseInt(value, 10);
        break;
      case "action":
        stats.action = parseInt(value, 10);
        break;
      case "scriptfile":
        config.scriptFile = value;
        break;
      case "scriptfileright":
        config.scriptFileRight = value;
        break;
      case "deathscript":
        config.deathScript = value;
        break;
      case "timerscript":
        config.timerScript = value;
        break;
      case "timerscriptinterval":
        config.timerInterval = parseInt(value, 10);
        break;
      case "pathfinder":
        config.pathFinder = parseInt(value, 10);
        break;
      case "caninteractdirectly":
        config.canInteractDirectly = parseInt(value, 10);
        break;
    }
  }

  if (!config.name || !config.stats) {
    return null;
  }

  return config as CharacterConfig;
}

/**
 * Load NPC configuration from URL
 * Based on C# Character.Load(string filePath)
 *
 * Note: In C#, the path is direct (e.g., "ini/npc/xxx.ini")
 * The npcres directory is only used by SetNpcIni() for sprite mappings
 */
export async function loadNpcConfig(url: string): Promise<CharacterConfig | null> {
  console.log(`[ResFile] Loading NPC config: ${url}`);

  const response = await tryFetchIni(url);

  if (!response) {
    console.warn(`[ResFile] FAILED to load NPC config: ${url}`);
    return null;
  }

  try {
    const content = await response.text();
    return parseNpcConfig(content);
  } catch (error) {
    console.error(`[ResFile] Error loading NPC config ${url}:`, error);
    return null;
  }
}
