/**
 * Character 基类模块导出
 *
 * 继承链:
 * Sprite → CharacterBase → CharacterMovement → CharacterCombat → Character
 */

export {
  CharacterBase,
  type CharacterUpdateResult,
  LOADING_STATE,
  MAX_NON_FIGHT_SECONDS,
  type MagicToUseInfoItem,
} from "./character-base";
export { CharacterCombat } from "./character-combat";
export { CharacterMovement } from "./character-movement";
