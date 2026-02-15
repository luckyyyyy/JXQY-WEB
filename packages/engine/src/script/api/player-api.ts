/**
 * PlayerAPI Implementation - Delegates to existing playerCommands logic
 */

import { logger } from "../../core/logger";
import { CharacterState } from "../../core/types";
import type { Npc } from "../../npc";
import type { Player } from "../../player/player";
import type { BlockingResolver } from "../blocking-resolver";
import type { PlayerAPI } from "./game-api";
import { isCharacterMoveEnd } from "./helpers";
import type { ScriptCommandContext } from "./types";

export function createPlayerAPI(ctx: ScriptCommandContext, resolver: BlockingResolver): PlayerAPI {
  const {
    player,
    npcManager,
    goodsListManager,
    checkTrap,
    centerCameraOnPlayer,
    isMapObstacleForCharacter,
  } = ctx;

  /**
   * C# Globals.PlayerKindCharacter 等效实现
   * 优先级: NPC with Kind=Player > ControledCharacter > ThePlayer
   * PlayerGoto/PlayerRunTo/SetPlayerScn 等命令都作用于此角色
   */
  const getPlayerKindCharacter = (): Player | Npc => {
    const npcWithPlayerKind = npcManager.getPlayerKindCharacter();
    if (npcWithPlayerKind) return npcWithPlayerKind;
    if (player.controledCharacter) return player.controledCharacter as Player | Npc;
    return player;
  };

  const pa = (fn: (p: Player) => void, label: string) => () => {
    if (player) {
      fn(player);
      logger.log(`[GameAPI.player] ${label}`);
    }
  };

  return {
    setPosition: (x, y, characterName?) => {
      let targetCharacter: Player | Npc | null = null;
      if (characterName) {
        if (player && player.name === characterName) {
          targetCharacter = player;
        } else {
          targetCharacter = npcManager.getNpc(characterName);
        }
      } else {
        targetCharacter = getPlayerKindCharacter();
      }
      if (!targetCharacter) {
        logger.warn(`[GameAPI.player] setPosition: character not found: ${characterName}`);
        return;
      }
      targetCharacter.setPosition(x, y);
      centerCameraOnPlayer();
      if (player) {
        player.resetPartnerPosition?.();
      }
      checkTrap({ x, y });
    },
    // C# SetPlayerDir always uses ThePlayer directly
    setDirection: (direction) => {
      player.setDirection(direction);
    },
    setState: (state) => {
      player.setFightState(state !== 0);
    },

    // Blocking movement → Promise
    // C#: Globals.PlayerKindCharacter.WalkTo(...)
    walkTo: async (x, y) => {
      const target = getPlayerKindCharacter();
      const destination = { x, y };
      target.walkTo(destination);
      if (
        isCharacterMoveEnd(
          target,
          destination,
          (_c, d) => target.walkTo(d),
          isMapObstacleForCharacter,
          "playerWalkTo"
        )
      ) {
        return;
      }
      await resolver.waitForCondition(() =>
        isCharacterMoveEnd(
          target,
          destination,
          (_c, d) => target.walkTo(d),
          isMapObstacleForCharacter,
          "playerWalkTo"
        )
      );
    },

    walkToDir: async (direction, steps) => {
      const target = getPlayerKindCharacter();
      target.walkToDirection(direction, steps);
      if (target.state === CharacterState.Stand || target.state === CharacterState.Stand1) return;
      await resolver.waitForCondition(
        () => target.state === CharacterState.Stand || target.state === CharacterState.Stand1
      );
    },

    runTo: async (x, y) => {
      const target = getPlayerKindCharacter();
      const destination = { x, y };
      target.runTo(destination);
      if (
        isCharacterMoveEnd(
          target,
          destination,
          (_c, d) => target.runTo(d),
          isMapObstacleForCharacter,
          "playerRunTo"
        )
      ) {
        return;
      }
      await resolver.waitForCondition(() =>
        isCharacterMoveEnd(
          target,
          destination,
          (_c, d) => target.runTo(d),
          isMapObstacleForCharacter,
          "playerRunTo"
        )
      );
    },

    jumpTo: async (x, y) => {
      const target = getPlayerKindCharacter();
      const success = target.jumpTo({ x, y });
      logger.log(`[GameAPI.player] jumpTo: (${x}, ${y}) success=${success}`);
      if (target.state === CharacterState.Stand || target.state === CharacterState.Stand1) return;
      await resolver.waitForCondition(
        () => target.state === CharacterState.Stand || target.state === CharacterState.Stand1
      );
    },

    walkToNonBlocking: (x, y) => {
      const target = getPlayerKindCharacter();
      target.walkTo({ x, y });
    },
    runToNonBlocking: (x, y) => {
      const target = getPlayerKindCharacter();
      target.runTo({ x, y });
    },
    centerCamera: () => {
      ctx.centerCameraOnPlayer();
    },
    setWalkIsRun: (value) => {
      if (player) {
        player.walkIsRun = value;
      }
    },
    toNonFightingState: () => {
      const target = getPlayerKindCharacter();
      if (target) {
        target.toNonFightingState();
      }
    },
    change: async (index) => {
      await ctx.changePlayer(index);
      logger.log(`[GameAPI.player] change: switched to index ${index}`);
    },

    // Stats
    getMoney: () => player?.money || 0,
    setMoney: (amount) => {
      if (player) {
        player.setMoney(amount);
      }
    },
    addMoney: (amount) => {
      player.addMoney(amount);
    },
    getExp: () => player?.exp || 0,
    addExp: (amount) => {
      player.addExp(amount);
    },
    getStat: (stateName) => {
      if (!player) return 0;
      switch (stateName) {
        case "Level":
          return player.level;
        case "Attack":
          return player.attack;
        case "Defend":
          return player.defend;
        case "Evade":
          return player.evade;
        case "Life":
          return player.life;
        case "Thew":
          return player.thew;
        case "Mana":
          return player.mana;
        default:
          return 0;
      }
    },
    fullLife: pa((p) => p.fullLife(), "FullLife"),
    fullMana: pa((p) => p.fullMana(), "FullMana"),
    fullThew: pa((p) => p.fullThew(), "FullThew"),
    addLife: (amount) => {
      if (player) {
        player.addLife(amount);
      }
    },
    addMana: (amount) => {
      if (player) {
        player.addMana(amount);
      }
    },
    addThew: (amount) => {
      if (player) {
        player.addThew(amount);
      }
    },
    addLifeMax: (value) => {
      if (player) {
        player.lifeMax += value;
      }
    },
    addManaMax: (value) => {
      if (player) {
        player.manaMax += value;
      }
    },
    addThewMax: (value) => {
      if (player) {
        player.thewMax += value;
      }
    },
    addAttack: (value, type) => {
      if (!player) return;
      const t = type ?? 1;
      if (t === 1) player.attack += value;
      else if (t === 2) player.attack2 += value;
      else if (t === 3) player.attack3 += value;
    },
    addDefend: (value, type) => {
      if (!player) return;
      const t = type ?? 1;
      if (t === 1) player.defend = Math.max(0, player.defend + value);
      else if (t === 2) player.defend2 = Math.max(0, player.defend2 + value);
      else if (t === 3) player.defend3 = Math.max(0, player.defend3 + value);
    },
    addEvade: (value) => {
      if (player) {
        player.evade += value;
      }
    },
    limitMana: (limit) => {
      if (player) {
        player.manaLimit = limit;
      }
    },
    addMoveSpeedPercent: (percent) => {
      if (player) {
        player.addMoveSpeedPercent = (player.addMoveSpeedPercent || 0) + percent;
      }
    },
    isEquipWeapon: () => {
      const weapon = goodsListManager.get(205);
      return weapon !== null;
    },

    // Abilities
    setFightEnabled: (enabled) => {
      if (player) {
        player.isFightDisabled = !enabled;
      }
    },
    setJumpEnabled: (enabled) => {
      if (player) {
        player.isJumpDisabled = !enabled;
      }
    },
    setRunEnabled: (enabled) => {
      if (player) {
        player.isRunDisabled = !enabled;
      }
    },

    setMagicWhenAttacked: (magicFile, direction) => {
      if (player) {
        player.magicToUseWhenBeAttacked = magicFile;
        if (direction !== undefined) {
          player.magicDirectionWhenBeAttacked = direction;
        }
      }
    },
  };
}
