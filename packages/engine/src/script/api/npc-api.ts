/**
 * NpcAPI Implementation - Delegates to existing npcCommands logic
 */

import type { Character } from "../../character/character";
import { LevelManager } from "../../character/level/level-manager";
import { logger } from "../../core/logger";
import { CharacterState } from "../../core/types";
import { getMagic, preloadMagicAsf } from "../../magic/magic-config-loader";
import { ResourcePath } from "../../resource/resource-paths";
import { tileToPixel } from "../../utils";
import { PathType } from "../../utils/path-finder";
import type { BlockingResolver } from "../blocking-resolver";
import type { NpcAPI } from "./game-api";
import { isCharacterMoveEnd } from "./helpers";
import type { ScriptCommandContext } from "./types";

export function createNpcAPI(ctx: ScriptCommandContext, resolver: BlockingResolver): NpcAPI {
  const { player, npcManager, getCharacterByName, getCharactersByName, isMapObstacleForCharacter } =
    ctx;

  /**
   * 处理 NPC kind 变化，统一伙伴入队/离队逻辑。
   * 入队（→Follower）：通过 ctx.loadProfileToNpc 从档案恢复或回退到 API 初始化。
   * 离队（Follower→其他）：通过 ctx.flushNpcToProfile 写入档案并解除等级管理器共享。
   */
  const applyKindTransition = async (
    npc: import("../../npc/npc").Npc,
    kind: number
  ): Promise<void> => {
    const wasPartner = npc.isPartner;

    if (wasPartner && kind !== 3) {
      ctx.flushNpcToProfile?.(npc);
      logger.log(`[NpcAPI] Partner ${npc.name} leaving → flushed to profile`);
    }

    npc.kind = kind;

    if (wasPartner && kind !== 3) {
      npc.levelManager = new LevelManager();
      return;
    }

    if (kind === 3 && !wasPartner) {
      await ctx.loadProfileToNpc?.(npc);
      logger.log(`[NpcAPI] Partner ${npc.name} loaded from profile`);
    }
  };

  return {
    add: async (npcFile, x, y, direction?) => {
      await npcManager.addNpc(ResourcePath.npc(npcFile), x, y, direction ?? 4);
    },
    delete: (name) => {
      npcManager.deleteNpc(name);
    },
    getPosition: (name) => {
      const character = getCharacterByName(name);
      return character ? character.tilePosition : null;
    },
    setPosition: (name, x, y) => {
      if (player.name === name) {
        player.setPosition(x, y);
        return;
      }
      npcManager.setNpcPosition(name, x, y);
    },

    // Blocking movement → Promise
    walkTo: async (name, x, y) => {
      const destination = { x, y };
      if (player.name === name) {
        player.walkToTile(x, y);
      } else {
        npcManager.npcGoto(name, x, y);
      }

      const getChar = () => {
        if (player.name === name) return player as Character;
        return npcManager.getNpc(name) as Character | null;
      };
      const check = () => {
        const character = getChar();
        return isCharacterMoveEnd(
          character,
          destination,
          (c, d) => c.walkTo(d, PathType.PerfectMaxPlayerTry),
          isMapObstacleForCharacter,
          `npcWalkTo(${name})`
        );
      };
      if (check()) return;
      await resolver.waitForCondition(check);
    },

    walkToDir: async (name, direction, steps) => {
      if (player.name === name) {
        player.walkToDirection(direction, steps);
      } else {
        npcManager.npcGotoDir(name, direction, steps);
      }

      const check = () => {
        const character = getCharacterByName(name);
        if (!character) return true;
        return (
          character.state === CharacterState.Stand || character.state === CharacterState.Stand1
        );
      };
      if (check()) return;
      await resolver.waitForCondition(check);
    },

    setActionFile: async (name, stateType, asfFile) => {
      if (player.name === name) {
        await player.setNpcActionFile(stateType, asfFile);
        return;
      }
      await npcManager.setNpcActionFile(name, stateType, asfFile);
    },

    // Blocking special action → Promise
    specialAction: async (name, asfFile) => {
      const character = getCharacterByName(name);
      if (!character) {
        logger.warn(`[GameAPI.npc] specialAction: not found: ${name}`);
        return;
      }
      try {
        const success = await character.setSpecialAction(asfFile);
        if (!success) {
          logger.warn(`[GameAPI.npc] Failed special action for ${name}`);
          return;
        }
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
      if (!character) {
        logger.warn(`[GameAPI.npc] specialActionNonBlocking: not found: ${name}`);
        return;
      }
      character
        .setSpecialAction(asfFile)
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
      if (!character) {
        logger.warn(`[GameAPI.npc] walkToNonBlocking: not found: ${name}`);
        return;
      }
      // Reference: JxqyHD/Engine/Npc.cs - destination walk uses PerfectMaxPlayerTry (maxTry=500)
      character.walkTo({ x, y }, PathType.PerfectMaxPlayerTry);
    },
    setLevel: (name, level) => {
      if (player.name === name) {
        player.setLevelTo(level);
      } else {
        npcManager.setNpcLevel(name, level);
      }
    },
    setDirection: (name, direction) => {
      npcManager.setNpcDirection(name, direction);
    },
    setState: (name, state) => {
      npcManager.setNpcState(name, state);
    },
    setRelation: (name, relation) => {
      npcManager.setNpcRelation(name, relation);
      if (player.name === name) {
        player.setRelation(relation);
      }
    },
    setRelationById: (id, relation) => {
      const npc = npcManager.getNpcById(id);
      if (npc) {
        npc.setRelation(relation);
      }
    },
    setDeathScript: (name, scriptFile) => {
      if (player.name === name) {
        player.deathScript = scriptFile;
        return;
      }
      const npc = npcManager.getNpc(name);
      if (npc) {
        npc.deathScript = scriptFile;
      } else {
        logger.warn(`[GameAPI.npc] setDeathScript: NPC not found: ${name}`);
      }
    },
    setDeathScriptById: (id, scriptFile) => {
      const npc = npcManager.getNpcById(id);
      if (npc) {
        npc.deathScript = scriptFile;
      }
    },
    setScript: (name, scriptFile) => {
      npcManager.setNpcScript(name, scriptFile);
    },
    setScriptById: (id, scriptFile) => {
      const npc = npcManager.getNpcById(id);
      if (npc) {
        npc.scriptFile = scriptFile;
      }
    },
    show: (name, visible) => {
      npcManager.showNpc(name, visible);
    },
    merge: async (npcFile) => {
      await npcManager.mergeNpc(npcFile);
    },
    save: async (fileName?) => {
      await npcManager.saveNpc(fileName);
    },
    watch: (char1Name, char2Name, watchType) => {
      const char1 = getCharacterByName(char1Name);
      const char2 = getCharacterByName(char2Name);
      if (!char1 || !char2) {
        logger.warn(`[GameAPI.npc] watch: not found: ${char1Name} or ${char2Name}`);
        return;
      }
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
      if (enabled) npcManager.enableAI();
      else npcManager.disableAI();
    },
    setKind: async (name, kind) => {
      const npcs = npcManager.getAllNpcsByName(name);
      for (const npc of npcs) {
        await applyKindTransition(npc, kind);
      }
      if (player.name === name) {
        player.kind = kind;
      }
    },
    setKindById: async (id, kind) => {
      const npc = npcManager.getNpcById(id);
      if (npc) {
        await applyKindTransition(npc, kind);
      }
    },
    setMagicFile: async (name, magicFile) => {
      const characters = getCharactersByName(name);
      for (const character of characters) {
        character.setFlyIni(magicFile);
      }
      // 阻塞等待 ASF 动画资源加载完成（对所有目标统一处理，包括玩家）
      const magic = getMagic(magicFile);
      if (magic) await preloadMagicAsf(magic);
      // 填充 NPC 武功缓存（ASF 已在缓存中，addMagicToCache 内部不会重复加载）
      await Promise.all(
        npcManager.getAllNpcsByName(name).map((npc) => npc.addMagicToCache(magicFile))
      );
    },
    setResource: async (name, resFile) => {
      const character = getCharacterByName(name);
      if (character) {
        await character.loadSpritesFromNpcIni(resFile);
      }
    },
    setAction: (name, action, x, y) => {
      const character = getCharacterByName(name);
      if (!character) return;
      const destination = { x: x ?? 0, y: y ?? 0 };
      const pixelDest = tileToPixel(destination.x, destination.y);
      switch (action) {
        case CharacterState.Stand:
        case CharacterState.Stand1:
          character.standingImmediately();
          break;
        case CharacterState.Walk:
          character.walkTo(destination);
          break;
        case CharacterState.Run:
          character.runTo(destination);
          break;
        case CharacterState.Jump:
          character.jumpTo(destination);
          break;
        case CharacterState.Attack:
        case CharacterState.Attack1:
        case CharacterState.Attack2:
          character.performeAttack(pixelDest);
          break;
        case CharacterState.Magic:
          if (character.flyIni) {
            character.performeAttack(pixelDest, character.flyIni);
          }
          break;
        case CharacterState.Sit:
          character.sitdown();
          break;
        case CharacterState.Hurt:
          character.hurting();
          break;
        case CharacterState.Death:
          character.death();
          break;
        case CharacterState.FightStand:
          character.standingImmediately();
          character.toFightingState();
          break;
        case CharacterState.FightWalk:
          character.walkTo(destination);
          character.toFightingState();
          break;
        case CharacterState.FightRun:
          character.runTo(destination);
          character.toFightingState();
          break;
        case CharacterState.FightJump:
          character.jumpTo(destination);
          character.toFightingState();
          break;
        default:
          logger.log(`[GameAPI.npc] setAction: unhandled action ${action}`);
      }
    },
    setActionType: (name, actionType) => {
      const characters = getCharactersByName(name);
      for (const character of characters) {
        character.action = actionType;
      }
    },
    setAllScript: (name, scriptFile) => {
      const npcs = npcManager.getAllNpcsByName(name);
      for (const npc of npcs) {
        npc.scriptFile = scriptFile;
      }
    },
    setAllDeathScript: (name, scriptFile) => {
      const npcs = npcManager.getAllNpcsByName(name);
      for (const npc of npcs) {
        npc.deathScript = scriptFile;
      }
    },
    attack: (name, x, y) => {
      const characters = getCharactersByName(name);
      const pixelPos = tileToPixel(x, y);
      for (const character of characters) {
        character.performeAttack(pixelPos);
      }
    },
    follow: (follower, target) => {
      const followerChar = getCharacterByName(follower);
      const targetChar = getCharacterByName(target);
      if (followerChar && targetChar) {
        followerChar.follow(targetChar);
      }
    },
    followPlayer: (npcName) => {
      const npcs = npcManager.getAllNpcsByName(npcName);
      const playerName = player?.name ?? "";
      for (const npc of npcs) {
        npc.followNpcName = playerName;
      }
    },
    setMagicWhenAttacked: (name, magicFile, direction) => {
      const characters = getCharactersByName(name);
      for (const character of characters) {
        character.magicToUseWhenBeAttacked = magicFile;
        if (direction !== undefined) {
          character.magicDirectionWhenBeAttacked = direction;
        }
      }
    },
    addProperty: (name, property, value) => {
      const npcs = npcManager.getAllNpcsByName(name);
      const characters: Character[] = [...npcs];
      if (player.name === name) {
        characters.push(player);
      }
      const propName = property.charAt(0).toLowerCase() + property.slice(1);
      for (const character of characters) {
        character.addNumericProperty(propName, value);
      }
    },
    changeFlyIni: (name, magicFile) => {
      const characters = getCharactersByName(name);
      for (const character of characters) {
        character.setFlyIni(magicFile);
      }
    },
    changeFlyIni2: (name, magicFile) => {
      const characters = getCharactersByName(name);
      for (const character of characters) {
        character.setFlyIni2(magicFile);
      }
    },
    addFlyInis: (name, magicFile, distance) => {
      const characters = getCharactersByName(name);
      for (const character of characters) {
        character.addFlyInis(magicFile, distance);
      }
    },
    setDestination: (name, x, y) => {
      const npcs = npcManager.getAllNpcsByName(name);
      for (const npc of npcs) {
        npc.destinationMapPosX = x;
        npc.destinationMapPosY = y;
      }
    },
    getCount: (kind: number, relation: number) => {
      const allNpcs = npcManager.getAllNpcs();
      let count = 0;
      for (const [, npc] of allNpcs) {
        if (npc.kind === kind && npc.relation === relation) count++;
      }
      return count;
    },
    setKeepAttack: (name, x, y) => {
      const characters = getCharactersByName(name);
      for (const character of characters) {
        character.keepAttackX = x;
        character.keepAttackY = y;
      }
    },
    addMagic: async (name, magicFile) => {
      const character = getCharacterByName(name);
      if (!character) {
        logger.warn(`[GameAPI.npc] addMagic: character not found: ${name}`);
        return;
      }
      // Player has its own magic inventory
      if (
        "addMagic" in character &&
        typeof (character as { addMagic: unknown }).addMagic === "function"
      ) {
        await (character as { addMagic(file: string, level: number): Promise<boolean> }).addMagic(
          magicFile,
          1
        );
        return;
      }
      // NPC: partner adds to magic inventory (saves with game), others to cache only
      const npcs = npcManager.getAllNpcsByName(name);
      for (const npc of npcs) {
        if (npc.isPartner) {
          if (!npc.magicInventory) npc.initPartnerContainers();
          const inv = npc.magicInventory!;
          const [isNew, addedIndex] = await inv.addMagic(magicFile);
          if (isNew && addedIndex > 1) {
            inv.exchangeListItem(1, addedIndex);
          }
          // 打印伙伴当前完整技能列表
          const panel = inv.getStoreMagics();
          const bottom = inv.getBottomMagics();
          const skills: string[] = [];
          for (let i = 0; i < panel.length; i++) {
            const m = panel[i];
            if (m?.magic) skills.push(`[${i + 1}]${m.magic.name} Lv${m.level}`);
          }
          const bottomStr = bottom
            .map((m, i) => (m?.magic ? `[${i + 1}]${m.magic.name} Lv${m.level}` : null))
            .filter(Boolean)
            .join(", ");
          logger.log(
            `[AddMagic] ${name} ← ${magicFile} (isNew=${isNew}, index=${addedIndex}) | ` +
              `面板(${skills.length}): ${skills.join(", ")} | ` +
              `快捷栏: ${bottomStr || "空"}`
          );
        }
        await npc.addMagicToCache(magicFile);
      }
    },
    setMagicLevel: (name, magicFile, level) => {
      // For NPC: sets the attack level which governs which level magic data is used
      const npcs = npcManager.getAllNpcsByName(name);
      for (const npc of npcs) {
        npc.setMagicAttackLevel(level);
        // Partner: also update the specific magic's level in inventory
        if (npc.isPartner) {
          if (!npc.magicInventory) npc.initPartnerContainers();
          npc.magicInventory!.setMagicLevel(magicFile, level);
        }
      }
      // Player's magic level is managed separately; no-op here for player
    },
    setClickScript: (name, scriptFile) => {
      const npcs = npcManager.getAllNpcsByName(name);
      if (npcs.length === 0) {
        logger.warn(`[NpcAPI] SetClickScript: NPC not found: "${name}", scriptFile="${scriptFile}"`);
      } else {
        for (const npc of npcs) {
          npc.scriptFile = scriptFile;
          logger.log(`[NpcAPI] SetClickScript: ${name} (id=${npc.id}) -> ${scriptFile}`);
        }
      }
    },
    changeLife: (name, percent) => {
      const characters = getCharactersByName(name);
      for (const character of characters) {
        character.life = Math.max(
          0,
          Math.min(Math.round((character.lifeMax * percent) / 100), character.lifeMax)
        );
      }
    },
    changeMana: (name, percent) => {
      const characters = getCharactersByName(name);
      for (const character of characters) {
        character.mana = Math.max(
          0,
          Math.min(Math.round((character.manaMax * percent) / 100), character.manaMax)
        );
      }
    },
    changeThew: (name, percent) => {
      const characters = getCharactersByName(name);
      for (const character of characters) {
        character.thew = Math.max(
          0,
          Math.min(Math.round((character.thewMax * percent) / 100), character.thewMax)
        );
      }
    },
  };
}
