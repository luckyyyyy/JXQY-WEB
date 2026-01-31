/**
 * Level system module exports
 */

export type { LevelDetail, LevelUpResult } from "./levelManager";
export {
  calculateLevelUp,
  clearLevelConfigCache,
  DEFAULT_LEVEL_FILE,
  getLevelDetail,
  getNpcLevelConfig,
  getNpcLevelDetail,
  LevelManager,
  loadLevelConfig,
  loadNpcLevelConfig,
  NPC_LEVEL_FILE,
} from "./levelManager";
