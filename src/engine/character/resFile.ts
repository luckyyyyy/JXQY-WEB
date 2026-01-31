/**
 * ResFile - NPC Resource File Parser
 * Based on JxqyHD Engine/ResFile.cs
 *
 * Handles loading and parsing npcres INI files (state to ASF mappings).
 * NPC config parsing moved to iniParser.ts for better separation.
 *
 * C# Reference: Engine/ResFile.cs
 */

import { logger } from "../core/logger";
import { CharacterState } from "../core/types";
import { parseIni } from "../core/utils";
import { resourceLoader } from "../resource/resourceLoader";
import { type AsfData, loadAsf } from "../sprite/asf";
import { ResourcePath } from "@/config/resourcePaths";

// Re-export from iniParser for backward compatibility
export {
  loadCharacterConfig as loadNpcConfig,
  parseCharacterIni as parseNpcConfig,
} from "./iniParser";

/**
 * NpcRes state info parsed from ini/npcres/*.ini
 * Based on C# ResStateInfo
 */
export interface NpcResStateInfo {
  imagePath: string; // ASF file name
  soundPath: string; // WAV file name
}

/**
 * State name to CharacterState mapping
 * Based on C# ResFile.GetState()
 */
const STATE_NAMES: Record<string, number> = {
  Stand: CharacterState.Stand,
  Stand1: CharacterState.Stand1,
  Walk: CharacterState.Walk,
  Run: CharacterState.Run,
  Jump: CharacterState.Jump,
  Attack: CharacterState.Attack,
  Attack1: CharacterState.Attack1,
  Attack2: CharacterState.Attack2,
  Magic: CharacterState.Magic,
  Sit: CharacterState.Sit,
  Hurt: CharacterState.Hurt,
  Death: CharacterState.Death,
  FightStand: CharacterState.FightStand,
  FightWalk: CharacterState.FightWalk,
  FightRun: CharacterState.FightRun,
  FightJump: CharacterState.FightJump,
};

/**
 * Parse npcres INI file content
 * Based on C# ResFile.ReadFile()
 */
export function parseNpcResIni(content: string): Map<number, NpcResStateInfo> {
  const stateMap = new Map<number, NpcResStateInfo>();
  const sections = parseIni(content);

  // Map sections to states
  for (const [sectionName, keys] of Object.entries(sections)) {
    const state = STATE_NAMES[sectionName];
    if (state !== undefined && keys.Image) {
      stateMap.set(state, {
        imagePath: keys.Image,
        soundPath: keys.Sound || "",
      });
    }
  }

  return stateMap;
}

/**
 * Load ASF file from character or interlude directory
 * Based on C# ResFile.GetAsfFilePathBase()
 */
export async function loadCharacterAsf(asfFileName: string): Promise<AsfData | null> {
  // Encode Chinese characters in filename for URL
  const encodedFileName = encodeURIComponent(asfFileName);

  const paths = [
    ResourcePath.asfCharacter(encodedFileName),
    ResourcePath.asfInterlude(encodedFileName),
  ];

  for (const path of paths) {
    const asf = await loadAsf(path);
    if (asf) {
      return asf;
    }
  }

  logger.warn(`[ResFile] ASF not found: ${asfFileName}`);
  return null;
}

/**
 * Load NpcRes INI file to get state -> ASF mappings
 * Based on C# ResFile.ReadFile(@"ini\npcres\" + fileName, ResType.Npc)
 * Uses resourceLoader.loadIni to cache parsed result
 */
export async function loadNpcRes(npcIni: string): Promise<Map<number, NpcResStateInfo> | null> {
  // npcIni is the filename like "npc006.ini" or "z-杨影枫.ini"
  const filePath = ResourcePath.npcRes(npcIni);

  const stateMap = await resourceLoader.loadIni(filePath, parseNpcResIni, "npcRes");
  if (!stateMap) {
    logger.warn(`[ResFile] NpcRes not found or parse failed: ${filePath}`);
    return null;
  }

  logger.debug(`[ResFile] Loaded NpcRes: ${npcIni} with ${stateMap.size} states`);
  return stateMap;
}
