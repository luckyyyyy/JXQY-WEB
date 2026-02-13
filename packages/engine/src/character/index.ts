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

// Class-based exports
export { Character } from "./character";
// Standalone path generation utility (reusable outside class hierarchy)
export { generateRandTilePath } from "./base/character-movement";
// Config parser - data-driven config parsing
export {
  applyConfigToCharacter,
  extractConfigFromCharacter,
  extractStatsFromCharacter,
  loadCharacterConfig,
} from "./config-parser";
// ResFile utilities - INI file loading ()
export {
  // Image loading (ASF/MPC with optional SHD shadow)
  loadCharacterAsf,
  loadCharacterImage,
  loadNpcConfig,
  loadNpcRes,
  // NpcRes (state -> ASF mappings)
  type NpcResStateInfo,
} from "./res-loader";
export * from "./attr-types";
