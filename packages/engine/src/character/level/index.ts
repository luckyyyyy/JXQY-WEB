/**
 * Level system module exports
 */

export {
  clearLevelConfigCache,
  getDefaultNpcLevelKey,
  getDefaultPlayerLevelKey,
  getLevelConfigFromCache,
  loadLevelConfig,
} from "./level-config-loader";
export type { LevelDetail, LevelUpResult } from "./level-manager";
export {
  calculateLevelUp,
  getLevelDetail,
  getNpcLevelConfig,
  getNpcLevelDetail,
  initNpcLevelConfig,
  LevelManager,
} from "./level-manager";
