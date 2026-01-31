/**
 * Level Manager - Level configuration and leveling system
 * Based on JxqyHD Engine/Utils.cs (LevelDetail) and Engine/Character.cs (LevelUpTo)
 *
 * Handles:
 * - Loading level configuration from INI files (Level-easy.ini, level-hard.ini, etc.)
 * - Level up calculations
 * - Attribute progression
 */

import { logger } from "@/engine/core/logger";
import { resourceLoader } from "@/engine/resource/resourceLoader";
import { DefaultPaths } from "@/config/resourcePaths";

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
    newMagic: "",
    newGood: "",
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
      while (i < counts && lines[i].trim() !== "") {
        const line = lines[i].trim();
        if (line.startsWith("[")) break; // Next section

        const eqIdx = line.indexOf("=");
        if (eqIdx > 0) {
          const key = line.substring(0, eqIdx).trim();
          const valueStr = line.substring(eqIdx + 1).trim();
          const value = parseInt(valueStr, 10) || 0;

          switch (key) {
            case "Exp":
              detail.exp = value;
              break;
            case "LevelUpExp":
              detail.levelUpExp = value;
              break;
            case "LifeMax":
              detail.lifeMax = value;
              break;
            case "Life":
              detail.life = value;
              break;
            case "ThewMax":
              detail.thewMax = value;
              break;
            case "ManaMax":
              detail.manaMax = value;
              break;
            case "Attack":
              detail.attack = value;
              break;
            case "Attack2":
              detail.attack2 = value;
              break;
            case "Attack3":
              detail.attack3 = value;
              break;
            case "Defend":
              detail.defend = value;
              break;
            case "Defend2":
              detail.defend2 = value;
              break;
            case "Defend3":
              detail.defend3 = value;
              break;
            case "Evade":
              detail.evade = value;
              break;
            case "NewMagic":
              detail.newMagic = valueStr;
              break;
            case "NewGood":
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
  const config = await resourceLoader.loadIni<Map<number, LevelDetail>>(
    filePath,
    parseLevelIni,
    "level"
  );
  if (config) {
    logger.debug(`[LevelManager] Loaded level config: ${filePath} (${config.size} levels)`);
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
export const DEFAULT_LEVEL_FILE = DefaultPaths.levelEasy;

/**
 * NPC level file path
 */
export const NPC_LEVEL_FILE = DefaultPaths.levelNpc;

// ============= 全局 NPC 等级配置 =============
// NPC 等级配置是全局共享的，不需要每个角色单独加载

let _npcLevelConfig: Map<number, LevelDetail> | null = null;

/**
 * 获取全局 NPC 等级配置
 */
export function getNpcLevelConfig(): Map<number, LevelDetail> | null {
  return _npcLevelConfig;
}

/**
 * 加载全局 NPC 等级配置（引擎初始化时调用一次）
 */
export async function loadNpcLevelConfig(): Promise<void> {
  if (!_npcLevelConfig) {
    _npcLevelConfig = await loadLevelConfig(NPC_LEVEL_FILE);
    logger.log("[Level] NPC level config loaded");
  }
}

/**
 * 获取 NPC 指定等级的配置
 */
export function getNpcLevelDetail(level: number): LevelDetail | null {
  return getLevelDetail(_npcLevelConfig, level);
}

// ============= LevelManager 类 =============
// 每个 Character 持有一个 LevelManager 实例

/**
 * LevelManager - 角色等级配置管理
 *
 * 每个 Character 持有一个实例，管理该角色的等级配置。
 * C# Reference: Character.LevelIni, Character.LevelIniFile
 */
export class LevelManager {
  /** 等级配置文件路径 */
  private _levelFile: string = "";

  /** 等级配置表 */
  private _levelConfig: Map<number, LevelDetail> | null = null;

  /**
   * 初始化默认等级配置
   * 在引擎初始化时调用，加载默认的 Level-easy.ini
   */
  async initialize(): Promise<void> {
    if (!this._levelConfig) {
      this._levelFile = DEFAULT_LEVEL_FILE;
      this._levelConfig = await loadLevelConfig(DEFAULT_LEVEL_FILE);
      logger.log(`[LevelManager] Initialized with default config`);
    }
  }

  /**
   * 设置等级配置文件并加载
   * C# Reference: SetLevelFile 命令 -> target.LevelIni = Utils.GetLevelLists(path)
   */
  async setLevelFile(filePath: string): Promise<void> {
    this._levelFile = filePath;
    this._levelConfig = await loadLevelConfig(filePath);
  }

  /**
   * 获取当前等级配置文件路径
   */
  getLevelFile(): string {
    return this._levelFile;
  }

  /**
   * 获取等级配置表
   * C# Reference: Character.LevelIni
   */
  getLevelConfig(): Map<number, LevelDetail> | null {
    return this._levelConfig;
  }

  /**
   * 设置等级配置表（用于直接赋值）
   */
  setLevelConfig(config: Map<number, LevelDetail> | null): void {
    this._levelConfig = config;
  }

  /**
   * 获取指定等级的配置详情
   * C# Reference: LevelIni[level]
   */
  getLevelDetail(level: number): LevelDetail | null {
    return getLevelDetail(this._levelConfig, level);
  }

  /**
   * 获取最大等级
   */
  getMaxLevel(): number {
    if (!this._levelConfig || this._levelConfig.size === 0) return 1;
    return Math.max(...Array.from(this._levelConfig.keys()));
  }

  /**
   * 计算升级时的属性变化
   */
  calculateLevelUp(fromLevel: number, toLevel: number): LevelUpResult | null {
    return calculateLevelUp(this._levelConfig, fromLevel, toLevel);
  }
}
