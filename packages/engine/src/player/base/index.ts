/**
 * Player 基类模块导出
 *
 * 继承链:
 * Character → PlayerBase → PlayerInput → PlayerCombat → Player
 */

export {
  IS_USE_THEW_WHEN_NORMAL_RUN,
  LIFE_RESTORE_PERCENT,
  MANA_RESTORE_PERCENT,
  type PlayerAction,
  PlayerBase,
  RESTORE_INTERVAL_MS,
  SITTING_MANA_RESTORE_INTERVAL,
  THEW_RESTORE_PERCENT,
  THEW_USE_AMOUNT_WHEN_ATTACK,
  THEW_USE_AMOUNT_WHEN_JUMP,
  THEW_USE_AMOUNT_WHEN_RUN,
} from "./player-base";
export { PlayerCombat } from "./player-combat";
export { PlayerInput } from "./player-input";
