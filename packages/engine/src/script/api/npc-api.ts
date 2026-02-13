/**
 * NpcAPI Implementation - Delegates to existing npcCommands logic
 */

import type { NpcAPI } from "./game-api";
import type { ScriptCommandContext } from "./types";
import { isCharacterMoveEnd } from "./helpers";
import { CharacterState } from "../../core/types";
import { ResourcePath } from "../../resource/resource-paths";
import { logger } from "../../core/logger";
import { tileToPixel } from "../../utils";
import type { Character } from "../../character/character";
import type { BlockingResolver } from "../blocking-resolver";

export function createNpcAPI(ctx: ScriptCommandContext, resolver: BlockingResolver): NpcAPI {
  const {
    player,
    npcManager,
    getCharacterByName,
    getCharactersByName,
    isMapObstacleForCharacter,
  } = ctx;

  return {
    add: async (npcFile, x, y, direction?) => {
      await npcManager.addNpc(ResourcePath.npc(npcFile), x, y, direction ?? 4);
    },
    delete: (name) => { npcManager.deleteNpc(name); },
    getPosition: (name) => {
      const character = getCharacterByName(name);
      return character ? character.tilePosition : null;
    },
    setPosition: (name, x, y) => {
      if (player && player.name === name) { player.setPosition(x, y); return; }
      npcManager.setNpcPosition(name, x, y);
    },

    // Blocking movement → Promise
    walkTo: async (name, x, y) => {
      const destination = { x, y };
      if (player && player.name === name) { player.walkToTile(x, y); }
      else { npcManager.npcGoto(name, x, y); }

      const getChar = () => {
        if (player && player.name === name) return player as Character;
        return npcManager.getNpc(name) as Character | null;
      };
      const check = () => {
        const character = getChar();
        return isCharacterMoveEnd(character, destination, (c, d) => c.walkTo(d), isMapObstacleForCharacter, `npcWalkTo(${name})`);
      };
      if (check()) return;
      await resolver.waitForCondition(check);
    },

    walkToDir: async (name, direction, steps) => {
      if (player && player.name === name) { player.walkToDirection(direction, steps); }
      else { npcManager.npcGotoDir(name, direction, steps); }

      const check = () => {
        const character = getCharacterByName(name);
        if (!character) return true;
        return character.state === CharacterState.Stand || character.state === CharacterState.Stand1;
      };
      if (check()) return;
      await resolver.waitForCondition(check);
    },

    setActionFile: async (name, stateType, asfFile) => {
      if (player && player.name === name) {
        await player.setNpcActionFile(stateType, asfFile);
        return;
      }
      await npcManager.setNpcActionFile(name, stateType, asfFile);
    },

    // Blocking special action → Promise
    specialAction: async (name, asfFile) => {
      const character = getCharacterByName(name);
      if (!character) { logger.warn(`[GameAPI.npc] specialAction: not found: ${name}`); return; }
      try {
        const success = await character.setSpecialAction(asfFile);
        if (!success) { logger.warn(`[GameAPI.npc] Failed special action for ${name}`); return; }
      } catch (err: unknown) {
        logger.error(`Failed special action for ${name}:`, err);
        character.isInSpecialAction = false;
        return;
      }
      // Wait for animation to complete
      if (!character.isInSpecialAction) return;
      await resolver.waitForCondition(() => !character.isInSpecialAction);
    },

    // Non-blocking version (fire-and-forget)
    specialActionNonBlocking: (name, asfFile) => {
      const character = getCharacterByName(name);
      if (!character) { logger.warn(`[GameAPI.npc] specialActionNonBlocking: not found: ${name}`); return; }
      character.setSpecialAction(asfFile)
        .then((success: boolean) => {
          if (!success) logger.warn(`[GameAPI.npc] Failed special action for ${name}`);
        })
        .catch((err: unknown) => {
          logger.error(`Failed special action for ${name}:`, err);
          character.isInSpecialAction = false;
        });
    },
    // Non-blocking walk (fire-and-forget)
    walkToNonBlocking: (name, x, y) => {
      const character = getCharacterByName(name);
      if (!character) { logger.warn(`[GameAPI.npc] walkToNonBlocking: not found: ${name}`); return; }
      character.walkTo({ x, y });
    },
    setLevel: (name, level) => {
      if (player.name === name) { player.setLevelTo(level); }
      else { npcManager.setNpcLevel(name, level); }
    },
    setDirection: (name, direction) => { npcManager.setNpcDirection(name, direction); },
    setState: (name, state) => { npcManager.setNpcState(name, state); },
    setRelation: (name, relation) => {
      npcManager.setNpcRelation(name, relation);
      if (player && player.name === name) { player.setRelation(relation); }
    },
    setDeathScript: (name, scriptFile) => {
      if (player && player.name === name) {
        player.deathScript = scriptFile;
        return;
      }
      const npc = npcManager.getNpc(name);
      if (npc) { npc.deathScript = scriptFile; }
      else { logger.warn(`[GameAPI.npc] setDeathScript: NPC not found: ${name}`); }
    },
    setScript: (name, scriptFile) => { npcManager.setNpcScript(name, scriptFile); },
    show: (name, visible) => { npcManager.showNpc(name, visible); },
    merge: async (npcFile) => { await npcManager.mergeNpc(npcFile); },
    save: async (fileName?) => { await npcManager.saveNpc(fileName); },
    watch: (char1Name, char2Name, watchType) => {
      const char1 = getCharacterByName(char1Name);
      const char2 = getCharacterByName(char2Name);
      if (!char1 || !char2) { logger.warn(`[GameAPI.npc] watch: not found: ${char1Name} or ${char2Name}`); return; }
      const isC1 = watchType === 0 || watchType === 1;
      const isC2 = watchType === 0;
      if (isC1) {
        const dx = char2.pixelPosition.x - char1.pixelPosition.x;
        const dy = char2.pixelPosition.y - char1.pixelPosition.y;
        char1.setDirectionFromDelta(dx, dy);
      }
      if (isC2) {
        const dx = char1.pixelPosition.x - char2.pixelPosition.x;
        const dy = char1.pixelPosition.y - char2.pixelPosition.y;
        char2.setDirectionFromDelta(dx, dy);
      }
    },
    setAIEnabled: (enabled) => {
      if (enabled) npcManager.enableAI(); else npcManager.disableAI();
    },
    setKind: (name, kind) => {
      const npcs = npcManager.getAllNpcsByName(name);
      for (const npc of npcs) { npc.kind = kind; }
      if (player && player.name === name) { player.kind = kind; }
    },
    setMagicFile: (name, magicFile) => {
      const characters = getCharactersByName(name);
      for (const character of characters) { character.setFlyIni(magicFile); }
    },
    setResource: async (name, resFile) => {
      const character = getCharacterByName(name);
      if (character) { await character.loadSpritesFromNpcIni(resFile); }
    },
    setAction: (name, action, x, y) => {
      const character = getCharacterByName(name);
      if (!character) return;
      const destination = { x: x ?? 0, y: y ?? 0 };
      const pixelDest = tileToPixel(destination.x, destination.y);
      switch (action) {
        case CharacterState.Stand: case CharacterState.Stand1:
          character.standingImmediately(); break;
        case CharacterState.Walk:
          character.walkTo(destination); break;
        case CharacterState.Run:
          character.runTo(destination); break;
        case CharacterState.Jump:
          character.jumpTo(destination); break;
        case CharacterState.Attack: case CharacterState.Attack1: case CharacterState.Attack2:
          character.performeAttack(pixelDest); break;
        case CharacterState.Magic:
          if (character.flyIni) { character.performeAttack(pixelDest, character.flyIni); }
          break;
        case CharacterState.Sit:
          character.sitdown();
          break;
        case CharacterState.Hurt: character.hurting(); break;
        case CharacterState.Death: character.death(); break;
        case CharacterState.FightStand:
          character.standingImmediately(); character.toFightingState(); break;
        case CharacterState.FightWalk:
          character.walkTo(destination); character.toFightingState(); break;
        case CharacterState.FightRun:
          character.runTo(destination); character.toFightingState(); break;
        case CharacterState.FightJump:
          character.jumpTo(destination); character.toFightingState(); break;
        default:
          logger.log(`[GameAPI.npc] setAction: unhandled action ${action}`);
      }
    },
    setActionType: (name, actionType) => {
      const characters = getCharactersByName(name);
      for (const character of characters) { character.action = actionType; }
    },
    setAllScript: (name, scriptFile) => {
      const npcs = npcManager.getAllNpcsByName(name);
      for (const npc of npcs) { npc.scriptFile = scriptFile; }
    },
    setAllDeathScript: (name, scriptFile) => {
      const npcs = npcManager.getAllNpcsByName(name);
      for (const npc of npcs) { npc.deathScript = scriptFile; }
    },
    attack: (name, x, y) => {
      const characters = getCharactersByName(name);
      const pixelPos = tileToPixel(x, y);
      for (const character of characters) { character.performeAttack(pixelPos); }
    },
    follow: (follower, target) => {
      const followerChar = getCharacterByName(follower);
      const targetChar = getCharacterByName(target);
      if (followerChar && targetChar) { followerChar.follow(targetChar); }
    },
    setMagicWhenAttacked: (name, magicFile, direction) => {
      const characters = getCharactersByName(name);
      for (const character of characters) {
        character.magicToUseWhenBeAttacked = magicFile;
        if (direction !== undefined) { character.magicDirectionWhenBeAttacked = direction; }
      }
    },
    addProperty: (name, property, value) => {
      const npcs = npcManager.getAllNpcsByName(name);
      const characters: Character[] = [...npcs];
      if (player && player.name === name) { characters.push(player); }
      const propName = property.charAt(0).toLowerCase() + property.slice(1);
      for (const character of characters) {
        character.addNumericProperty(propName, value);
      }
    },
    changeFlyIni: (name, magicFile) => {
      const characters = getCharactersByName(name);
      for (const character of characters) { character.setFlyIni(magicFile); }
    },
    changeFlyIni2: (name, magicFile) => {
      const characters = getCharactersByName(name);
      for (const character of characters) { character.setFlyIni2(magicFile); }
    },
    addFlyInis: (name, magicFile, distance) => {
      const characters = getCharactersByName(name);
      for (const character of characters) { character.addFlyInis(magicFile, distance); }
    },
    setDestination: (name, x, y) => {
      const npcs = npcManager.getAllNpcsByName(name);
      for (const npc of npcs) { npc.destinationMapPosX = x; npc.destinationMapPosY = y; }
    },
    getCount: (kind1, kind2) => {
      const allNpcs = npcManager.getAllNpcs();
      let count = 0;
      for (const [, npc] of allNpcs) {
        if (kind2 !== undefined) { if (npc.kind >= kind1 && npc.kind <= kind2) count++; }
        else { if (npc.kind === kind1) count++; }
      }
      return count;
    },
    setKeepAttack: (name, x, y) => {
      const characters = getCharactersByName(name);
      for (const character of characters) { character.keepAttackX = x; character.keepAttackY = y; }
    },
  };
}
