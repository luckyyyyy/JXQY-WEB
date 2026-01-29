/**
 * ResFile - NPC Resource File Parser
 * Based on JxqyHD Engine/ResFile.cs
 *
 * Handles loading and parsing npcres INI files (state to ASF mappings).
 * NPC config parsing moved to iniParser.ts for better separation.
 *
 * C# Reference: Engine/ResFile.cs
 */

import { CharacterState } from "../core/types";
import { parseIni } from "../core/utils";
import { loadAsf, type AsfData } from "../sprite/asf";
import { resourceLoader } from "../resource/resourceLoader";

// Re-export from iniParser for backward compatibility
export { parseCharacterIni as parseNpcConfig, loadCharacterConfig as loadNpcConfig } from "./iniParser";

/**
 * NpcRes state info parsed from ini/npcres/*.ini
 * Based on C# ResStateInfo
 */
export interface NpcResStateInfo {
  imagePath: string;  // ASF file name
  soundPath: string;  // WAV file name
}

/**
 * State name to CharacterState mapping
 * Based on C# ResFile.GetState()
 */
const STATE_NAMES: Record<string, number> = {
  "Stand": CharacterState.Stand,
  "Stand1": CharacterState.Stand1,
  "Walk": CharacterState.Walk,
  "Run": CharacterState.Run,
  "Jump": CharacterState.Jump,
  "Attack": CharacterState.Attack,
  "Attack1": CharacterState.Attack1,
  "Attack2": CharacterState.Attack2,
  "Magic": CharacterState.Magic,
  "Sit": CharacterState.Sit,
  "Hurt": CharacterState.Hurt,
  "Death": CharacterState.Death,
  "FightStand": CharacterState.FightStand,
  "FightWalk": CharacterState.FightWalk,
  "FightRun": CharacterState.FightRun,
  "FightJump": CharacterState.FightJump,
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
    if (state !== undefined && keys["Image"]) {
      stateMap.set(state, {
        imagePath: keys["Image"],
        soundPath: keys["Sound"] || "",
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
    `/resources/asf/character/${encodedFileName}`,
    `/resources/asf/interlude/${encodedFileName}`,
  ];

  for (const path of paths) {
    const asf = await loadAsf(path);
    if (asf) {
      console.log(`[ResFile] Loaded ASF: ${path}`);
      return asf;
    }
  }

  console.warn(`[ResFile] ASF not found: ${asfFileName}`);
  return null;
}

/**
 * Load NpcRes INI file to get state -> ASF mappings
 * Based on C# ResFile.ReadFile(@"ini\npcres\" + fileName, ResType.Npc)
 * Uses resourceLoader.loadIni to cache parsed result
 */
export async function loadNpcRes(npcIni: string): Promise<Map<number, NpcResStateInfo> | null> {
  // npcIni is the filename like "npc006.ini" or "z-杨影枫.ini"
  const filePath = `/resources/ini/npcres/${npcIni}`;

  const stateMap = await resourceLoader.loadIni(filePath, parseNpcResIni, "npcRes");
  if (!stateMap) {
    console.warn(`[ResFile] NpcRes not found or parse failed: ${filePath}`);
    return null;
  }

  console.log(`[ResFile] Loaded NpcRes: ${npcIni} with ${stateMap.size} states`);
  return stateMap;
}

/**
 * Clear NpcRes cache (now delegates to resourceLoader)
 * @deprecated Use resourceLoader.clearCache("npcRes") instead
 */
export function clearNpcResCache(): void {
  // Note: This clears ALL parsed config cache, not just npcRes
  resourceLoader.clearCache("npcRes");
}
