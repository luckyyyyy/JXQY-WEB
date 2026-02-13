/**
 * NPC system exports
 *
 * NPC classes and manager ():
 * - Npc (extends Character) - npc.ts
 * - NpcManager - npcManager.ts
 * - NpcMagicCache - modules/npcMagicCache.ts
 */

// NPC config loader (from API)
export {
  getAllNpcConfigKeys,
  getNpcConfigFromCache,
  isNpcConfigLoaded,
} from "./npc-config-loader";
// NPC modules
export { NpcMagicCache, type SpecialMagicType } from "./modules";
// NPC class
export { Npc, parseFixedPos } from "./npc";
// NPC manager
export { DeathInfo, isEnemy, NpcManager, type ViewRect } from "./npc-manager";
