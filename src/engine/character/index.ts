/**
 * Character system exports
 *
 * Class-based architecture (based on C# JxqyHD):
 * - Sprite (base class) - sprite/sprite.ts
 * - Character (abstract, extends Sprite) - characterBase.ts
 * - Npc (extends Character) - npc.ts
 * - Player (extends Character) - player.ts
 *
 * Character classes handle their own sprite loading and drawing:
 * - character.loadSpritesFromNpcIni() - load sprites from NpcRes INI
 * - character.draw() - render character
 * - character.setSpecialAction() - play special action animation
 */

// Class-based exports
export { Character } from "./character";
// INI Parser - data-driven config parsing (new, replaces verbose switch-case)
export {
  applyConfigToCharacter,
  applyConfigToPlayer,
  extractConfigFromCharacter,
  extractStatsFromCharacter,
  loadCharacterConfig,
  parseCharacterIni,
} from "./iniParser";
export {
  // Global AI control functions (C#: Npc.DisableAI/EnableAI)
  disableGlobalAI,
  enableGlobalAI,
  isGlobalAIDisabled,
  Npc,
} from "./npc";
// Managers
export { NpcManager } from "./npcManager";
// ResFile utilities - INI file loading (based on C# ResFile.cs)
export {
  clearNpcResCache,
  // ASF loading
  loadCharacterAsf,
  loadNpcConfig,
  loadNpcRes,
  // NpcRes (state -> ASF mappings)
  type NpcResStateInfo,
  // NPC config loading (re-exported from iniParser for backward compatibility)
  parseNpcConfig,
  parseNpcResIni,
} from "./resFile";
