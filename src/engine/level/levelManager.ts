/**
 * Level Manager - Level configuration and leveling system
 * Based on JxqyHD Engine/Utils.cs (LevelDetail) and Engine/Character.cs (LevelUpTo)
 *
 * Handles:
 * - Loading level configuration from INI files (Level-easy.ini, level-hard.ini, etc.)
 * - Level up calculations
 * - Attribute progression
 */

import { resourceLoader } from "../resource/resourceLoader";

/**
 * Level detail structure matching C#'s Utils.LevelDetail
 */
export interface LevelDetail {
  /** Experience required to reach next level */
  levelUpExp: number;
  /** Maximum life at this level */
  lifeMax: number;
  /** Maximum stamina at this level */
  thewMax: number;
  /** Maximum mana at this level */
  manaMax: number;
  /** Attack power at this level */
  attack: number;
  /** Secondary attack (Attack2) */
  attack2: number;
  /** Tertiary attack (Attack3) */
  attack3: number;
  /** Defense at this level */
  defend: number;
  /** Secondary defense (Defend2) */
  defend2: number;
  /** Tertiary defense (Defend3) */
  defend3: number;
  /** Evasion at this level */
  evade: number;
  /** Magic learned at this level */
  newMagic: string;
  /** Item received at this level */
  newGood: string;
  /** Starting experience for this level */
  exp: number;
  /** Starting life for this level (used for NPC initialization) */
  life: number;
}

/**
 * Create default level detail
 */
function createDefaultLevelDetail(): LevelDetail {
  return {
    levelUpExp: 100,
    lifeMax: 100,
    thewMax: 100,
    manaMax: 100,
    attack: 10,
    attack2: 0,
    attack3: 0,
    defend: 10,
    defend2: 0,
    defend3: 0,
    evade: 0,
    newMagic: '',
    newGood: '',
    exp: 0,
    life: 0,
  };
}

/**
 * Parse level configuration INI file
 * Matches C#'s Utils.GetLevelLists implementation
 *
 * @param content INI file content
 * @returns Map of level number to level detail
 */
function parseLevelIni(content: string): Map<number, LevelDetail> {
  const lists = new Map<number, LevelDetail>();
  const lines = content.split(/\r?\n/);
  const counts = lines.length;

  for (let i = 0; i < counts; ) {
    // Match [LevelN] section header
    const match = lines[i].match(/\[Level([0-9]+)\]/);
    i++;

    if (match) {
      const detail = createDefaultLevelDetail();
      const levelIndex = parseInt(match[1], 10);

      // Parse section content
      while (i < counts && lines[i].trim() !== '') {
        const line = lines[i].trim();
        if (line.startsWith('[')) break; // Next section

        const eqIdx = line.indexOf('=');
        if (eqIdx > 0) {
          const key = line.substring(0, eqIdx).trim();
          const valueStr = line.substring(eqIdx + 1).trim();
          const value = parseInt(valueStr, 10) || 0;

          switch (key) {
            case 'Exp':
              detail.exp = value;
              break;
            case 'LevelUpExp':
              detail.levelUpExp = value;
              break;
            case 'LifeMax':
              detail.lifeMax = value;
              break;
            case 'Life':
              detail.life = value;
              break;
            case 'ThewMax':
              detail.thewMax = value;
              break;
            case 'ManaMax':
              detail.manaMax = value;
              break;
            case 'Attack':
              detail.attack = value;
              break;
            case 'Attack2':
              detail.attack2 = value;
              break;
            case 'Attack3':
              detail.attack3 = value;
              break;
            case 'Defend':
              detail.defend = value;
              break;
            case 'Defend2':
              detail.defend2 = value;
              break;
            case 'Defend3':
              detail.defend3 = value;
              break;
            case 'Evade':
              detail.evade = value;
              break;
            case 'NewMagic':
              detail.newMagic = valueStr;
              break;
            case 'NewGood':
              detail.newGood = valueStr;
              break;
          }
        }
        i++;
      }

      lists.set(levelIndex, detail);
    }
  }

  return lists;
}

/**
 * Load level configuration from file
 * Matches C#'s Utils.GetLevelLists with caching
 * Uses unified resourceLoader for caching parsed results
 *
 * @param filePath Path to level INI file
 * @returns Map of level number to level detail, or null if failed
 */
export async function loadLevelConfig(filePath: string): Promise<Map<number, LevelDetail> | null> {
  const config = await resourceLoader.loadIni<Map<number, LevelDetail>>(filePath, parseLevelIni, "level");
  if (config) {
    console.log(`[LevelManager] Loaded level config: ${filePath} (${config.size} levels)`);
  }
  return config;
}

/**
 * Get level detail for a specific level
 *
 * @param levelConfig Level configuration map
 * @param level Level number (1-based)
 * @returns Level detail or null if not found
 */
export function getLevelDetail(
  levelConfig: Map<number, LevelDetail> | null,
  level: number
): LevelDetail | null {
  if (!levelConfig) return null;
  return levelConfig.get(level) || null;
}

/**
 * Calculate stat difference between two levels
 * Used for level up calculations
 */
export interface LevelUpResult {
  lifeMaxDelta: number;
  thewMaxDelta: number;
  manaMaxDelta: number;
  attackDelta: number;
  attack2Delta: number;
  attack3Delta: number;
  defendDelta: number;
  defend2Delta: number;
  defend3Delta: number;
  evadeDelta: number;
  newLevelUpExp: number;
  newMagic: string;
  newGood: string;
}

/**
 * Calculate stat changes from level up
 * Matches C#'s Player.LevelUpTo logic
 *
 * @param levelConfig Level configuration
 * @param fromLevel Current level
 * @param toLevel Target level
 * @returns Level up result with stat deltas
 */
export function calculateLevelUp(
  levelConfig: Map<number, LevelDetail> | null,
  fromLevel: number,
  toLevel: number
): LevelUpResult | null {
  if (!levelConfig) return null;

  const currentDetail = levelConfig.get(fromLevel);
  const targetDetail = levelConfig.get(toLevel);

  if (!currentDetail || !targetDetail) return null;

  return {
    lifeMaxDelta: targetDetail.lifeMax - currentDetail.lifeMax,
    thewMaxDelta: targetDetail.thewMax - currentDetail.thewMax,
    manaMaxDelta: targetDetail.manaMax - currentDetail.manaMax,
    attackDelta: targetDetail.attack - currentDetail.attack,
    attack2Delta: targetDetail.attack2 - currentDetail.attack2,
    attack3Delta: targetDetail.attack3 - currentDetail.attack3,
    defendDelta: targetDetail.defend - currentDetail.defend,
    defend2Delta: targetDetail.defend2 - currentDetail.defend2,
    defend3Delta: targetDetail.defend3 - currentDetail.defend3,
    evadeDelta: targetDetail.evade - currentDetail.evade,
    newLevelUpExp: targetDetail.levelUpExp,
    newMagic: targetDetail.newMagic,
    newGood: targetDetail.newGood,
  };
}

/**
 * Clear level config cache (委托给 resourceLoader)
 */
export function clearLevelConfigCache(): void {
  resourceLoader.clearCache("level");
}

/**
 * Default level file path (Level-easy.ini)
 */
export const DEFAULT_LEVEL_FILE = '/resources/ini/level/Level-easy.ini';

/**
 * NPC level file path
 */
export const NPC_LEVEL_FILE = '/resources/ini/level/level-npc.ini';

/**
 * LevelManager class for managing level configurations
 */
export class LevelManager {
  private playerLevelConfig: Map<number, LevelDetail> | null = null;
  private npcLevelConfig: Map<number, LevelDetail> | null = null;
  private currentLevelFile: string = DEFAULT_LEVEL_FILE;

  /**
   * Initialize level manager with default configs
   */
  async initialize(): Promise<void> {
    // Load default player level config
    this.playerLevelConfig = await loadLevelConfig(DEFAULT_LEVEL_FILE);

    // Load NPC level config
    this.npcLevelConfig = await loadLevelConfig(NPC_LEVEL_FILE);

    console.log('[LevelManager] Initialized');
  }

  /**
   * Set player level file (called by script SetLevelFile command)
   */
  async setPlayerLevelFile(filePath: string): Promise<void> {
    this.currentLevelFile = filePath;
    this.playerLevelConfig = await loadLevelConfig(filePath);
  }

  /**
   * Get player level configuration
   */
  getPlayerLevelConfig(): Map<number, LevelDetail> | null {
    return this.playerLevelConfig;
  }

  /**
   * Get NPC level configuration
   */
  getNpcLevelConfig(): Map<number, LevelDetail> | null {
    return this.npcLevelConfig;
  }

  /**
   * Get level detail for player
   */
  getPlayerLevelDetail(level: number): LevelDetail | null {
    return getLevelDetail(this.playerLevelConfig, level);
  }

  /**
   * Get level detail for NPC
   */
  getNpcLevelDetail(level: number): LevelDetail | null {
    return getLevelDetail(this.npcLevelConfig, level);
  }

  /**
   * Calculate player level up
   */
  calculatePlayerLevelUp(fromLevel: number, toLevel: number): LevelUpResult | null {
    return calculateLevelUp(this.playerLevelConfig, fromLevel, toLevel);
  }

  /**
   * Get current level file path
   */
  getCurrentLevelFile(): string {
    return this.currentLevelFile;
  }

  /**
   * Get max level from config
   */
  getMaxLevel(): number {
    if (!this.playerLevelConfig) return 1;
    return Math.max(...Array.from(this.playerLevelConfig.keys()));
  }
}
