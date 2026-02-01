/**
 * Character 基类模块导出
 *
 * 继承链:
 * Sprite → CharacterBase → CharacterMovement → CharacterCombat → Character
 */

export {
  CharacterBase,
  LOADING_STATE,
  MAX_NON_FIGHT_SECONDS,
  type MagicToUseInfoItem,
  type CharacterUpdateResult,
} from "./characterBase";

export { CharacterMovement } from "./characterMovement";
export { CharacterCombat } from "./characterCombat";
