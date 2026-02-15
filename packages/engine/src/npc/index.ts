/**
 * NPC system exports
 *
 * NPC classes and manager ():
 * - Npc (extends Character) - npc.ts
 * - NpcManager - npcManager.ts
 * - NpcMagicCache - modules/npcMagicCache.ts
 */

// NPC modules
export { NpcMagicCache, type SpecialMagicType } from "./modules";
// NPC class
export { Npc, parseFixedPos } from "./npc";
// NPC config cache (from API)
export {
  getAllNpcConfigKeys,
  getNpcConfigFromCache,
  isNpcConfigLoaded,
} from "./npc-config-cache";
// NPC manager
export { NpcManager } from "./npc-manager";
export { DeathInfo, isEnemy, type ViewRect } from "./npc-query-helpers";
