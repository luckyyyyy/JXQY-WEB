/**
 * Level Manager - 角色等级配置管理
 */

import { logger } from "../../core/logger";
import {
  getDefaultNpcLevelKey,
  getDefaultPlayerLevelKey,
  getLevelConfigFromCache,
  type LevelDetail,
  loadLevelConfig,
} from "./level-config-loader";

export type { LevelDetail } from "./level-config-loader";

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

export function getLevelDetail(
  config: Map<number, LevelDetail> | null,
  level: number
): LevelDetail | null {
  return config?.get(level) ?? null;
}

export function calculateLevelUp(
  config: Map<number, LevelDetail> | null,
  from: number,
  to: number
): LevelUpResult | null {
  if (!config) return null;
  const cur = config.get(from);
  const tgt = config.get(to);
  if (!cur || !tgt) return null;

  return {
    lifeMaxDelta: tgt.lifeMax - cur.lifeMax,
    thewMaxDelta: tgt.thewMax - cur.thewMax,
    manaMaxDelta: tgt.manaMax - cur.manaMax,
    attackDelta: tgt.attack - cur.attack,
    attack2Delta: tgt.attack2 - cur.attack2,
    attack3Delta: tgt.attack3 - cur.attack3,
    defendDelta: tgt.defend - cur.defend,
    defend2Delta: tgt.defend2 - cur.defend2,
    defend3Delta: tgt.defend3 - cur.defend3,
    evadeDelta: tgt.evade - cur.evade,
    newLevelUpExp: tgt.levelUpExp,
    newMagic: tgt.newMagic,
    newGood: tgt.newGood,
  };
}

// 全局 NPC 等级配置
let _npcConfig: Map<number, LevelDetail> | null = null;

export function getNpcLevelConfig(): Map<number, LevelDetail> | null {
  return _npcConfig;
}

export async function initNpcLevelConfig(): Promise<void> {
  _npcConfig = await loadLevelConfig(getDefaultNpcLevelKey());
}

export function getNpcLevelDetail(level: number): LevelDetail | null {
  return getLevelDetail(_npcConfig, level);
}

/** 角色等级配置管理器 */
export class LevelManager {
  private _file = "";
  private _config: Map<number, LevelDetail> | null = null;

  async initialize(): Promise<void> {
    if (this._config) return;
    this._file = getDefaultPlayerLevelKey();
    this._config = await loadLevelConfig(this._file);
  }

  async setLevelFile(path: string): Promise<void> {
    let config = getLevelConfigFromCache(path);
    if (!config) config = await loadLevelConfig(path);
    if (config) {
      this._file = path.toLowerCase();
      this._config = config;
    } else {
      logger.warn(`[LevelManager] Failed to load: ${path}`);
    }
  }

  getLevelFile(): string {
    return this._file;
  }

  getLevelConfig(): Map<number, LevelDetail> | null {
    return this._config;
  }

  setLevelConfig(config: Map<number, LevelDetail> | null): void {
    this._config = config;
  }

  getLevelDetail(level: number): LevelDetail | null {
    return getLevelDetail(this._config, level);
  }

  getMaxLevel(): number {
    if (!this._config || this._config.size === 0) return 1;
    return Math.max(...Array.from(this._config.keys()));
  }

  calculateLevelUp(from: number, to: number): LevelUpResult | null {
    return calculateLevelUp(this._config, from, to);
  }
}
