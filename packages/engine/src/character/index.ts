/**
 * Character system exports
 *
 * Class-based architecture ():
 * - Sprite (base class) - sprite/sprite.ts
 * - Character (abstract, extends Sprite) - characterBase.ts
 * - Npc (extends Character) - ../npc/npc.ts
 * - Player (extends Character) - ../player/player.ts
 *
 * Character classes handle their own sprite loading and drawing:
 * - character.loadSpritesFromNpcIni() - load sprites from NpcRes INI
 * - character.draw() - render character
 * - character.setSpecialAction() - play special action animation
 */

export * from "../core/character-types";
export * from "./attr-types";
// Standalone path generation utility (reusable outside class hierarchy)
export { generateRandTilePath } from "./base/character-movement";
// Class-based exports
export { Character } from "./character";
// Config - data-driven config parsing
export {
  applyConfigToCharacter,
  extractConfigFromCharacter,
  extractStatsFromCharacter,
  loadCharacterConfig,
} from "./character-config";
// ResFile utilities - INI file loading ()
export {
  // Image loading (ASF/MPC with optional SHD shadow)
  loadCharacterAsf,
  loadCharacterImage,
  loadNpcRes,
  // NpcRes (state -> ASF mappings)
  type NpcResStateInfo,
} from "./character-res-loader";
