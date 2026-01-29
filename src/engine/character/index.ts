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
export {
  Npc,
  // Global AI control functions (C#: Npc.DisableAI/EnableAI)
  disableGlobalAI,
  enableGlobalAI,
  isGlobalAIDisabled,
} from "./npc";
export { Player, type PlayerAction } from "./player";

// Managers
export { NpcManager } from "./npcManager";

// ResFile utilities - INI file loading (based on C# ResFile.cs)
export {
  // NpcRes (state -> ASF mappings)
  type NpcResStateInfo,
  parseNpcResIni,
  loadNpcRes,
  clearNpcResCache,
  // NPC config loading (re-exported from iniParser for backward compatibility)
  parseNpcConfig,
  loadNpcConfig,
  // ASF loading
  loadCharacterAsf,
} from "./resFile";

// INI Parser - data-driven config parsing (new, replaces verbose switch-case)
export {
  parseCharacterIni,
  loadCharacterConfig,
  applyConfigToCharacter,
  applyConfigToPlayer,
  extractConfigFromCharacter,
  extractStatsFromCharacter,
} from "./iniParser";
