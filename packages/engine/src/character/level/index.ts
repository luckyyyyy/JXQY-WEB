/**
 * Level system module exports
 */

export type { LevelDetail, LevelUpResult } from "./level-manager";
export {
  calculateLevelUp,
  getLevelDetail,
  getNpcLevelConfig,
  getNpcLevelDetail,
  initNpcLevelConfig,
  LevelManager,
} from "./level-manager";

export {
  clearLevelConfigCache,
  getDefaultNpcLevelKey,
  getDefaultPlayerLevelKey,
  getLevelConfigFromCache,
  loadLevelConfig,
  setLevelConfigGameSlug,
} from "./level-config-loader";
