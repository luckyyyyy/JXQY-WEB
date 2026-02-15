/**
 * Character Helper - 角色引用和查询辅助方法
 * 从 MagicSpriteManager 提取，提供角色相关的工具方法
 */

import type { Character } from "../../character/character";
import type { Vector2 } from "../../core/types";
import type { NpcManager } from "../../npc";
import type { Player } from "../../player/player";
import { getPositionInDirection as getPositionInDir } from "../../utils/direction";
import { distanceFromDelta } from "../../utils/distance";
import { type CharacterRef, getPosition as getCharPosition } from "../effects";
import type { MagicSprite } from "../magic-sprite";
import type { MagicData } from "../types";
import type { CharacterHelper, MagicSpriteManagerDeps } from "./types";

/**
 * 角色辅助类 - 提供角色引用和查询方法
 */
export class DefaultCharacterHelper implements CharacterHelper {
  private player: Player;
  private npcManager: NpcManager;

  constructor(deps: MagicSpriteManagerDeps) {
    this.player = deps.player as Player;
    this.npcManager = deps.npcManager as NpcManager;
  }

  /**
   * 根据 ID 获取角色引用
   */
  getCharacterRef(characterId: string): CharacterRef | null {
    if (characterId === "player") {
      return { type: "player", player: this.player };
    }
    const npc = this.npcManager.getNpcById(characterId);
    if (npc) {
      return { type: "npc", npc, id: characterId };
    }
    return null;
  }

  /**
   * 根据 ID 获取 Character 对象
   */
  getCharacter(characterId: string): Character | null {
    if (characterId === "player") {
      return this.player;
    }
    return this.npcManager.getNpcById(characterId) ?? null;
  }

  /**
   * 从 CharacterRef 获取实际的 Character 对象
   */
  getCharacterFromRef(ref: CharacterRef): Character {
    return ref.type === "player" ? ref.player : ref.npc;
  }

  /**
   * 获取角色位置
   */
  getCharacterPosition(characterId: string): Vector2 | null {
    const ref = this.getCharacterRef(characterId);
    return ref ? getCharPosition(ref) : null;
  }

  /**
   * 获取施法者角色
   */
  getBelongCharacter(characterId: string): Character | null {
    if (characterId === "player") return this.player;
    return this.npcManager.getNpcById(characterId) ?? null;
  }

  /**
   * 根据方向计算目标位置
   * 委托给 magicUtils.getPositionInDirection
   */
  getPositionInDirection(origin: Vector2, direction: number): Vector2 {
    return getPositionInDir(origin, direction);
  }

  /**
   * 获取视野内的敌人（用于 SuperMode）
   * - MoveKind == 15 目标选择逻辑
   */
  getEnemiesInView(userId: string, magic: MagicData): string[] {
    const targets: string[] = [];
    const npcs = this.npcManager.getAllNpcs();

    const belongCharacter = this.getBelongCharacter(userId);
    const isPlayer = userId === "player";
    const isFighterFriend = belongCharacter?.isFighterFriend ?? false;
    const isEnemy = belongCharacter?.isEnemy ?? false;

    if (magic.attackAll > 0) {
      // AttackAll > 0: 攻击所有战斗者（包括玩家）
      for (const [id, npc] of npcs) {
        if (npc.isFighter && !npc.isDeath && !npc.isDeathInvoked) {
          targets.push(id);
        }
      }
      if (userId !== "player") {
        targets.push("player");
      }
    } else if (isPlayer || isFighterFriend) {
      // 玩家或友方: 攻击敌人
      for (const [id, npc] of npcs) {
        if (npc.isEnemy && !npc.isDeath && !npc.isDeathInvoked) {
          targets.push(id);
        }
      }
    } else if (isEnemy) {
      // 敌人: 攻击玩家和友方
      for (const [id, npc] of npcs) {
        if (npc.isFighterFriend && !npc.isDeath && !npc.isDeathInvoked) {
          targets.push(id);
        }
      }
      targets.push("player");
    } else {
      // None 关系: 攻击所有非 None 关系的战斗者（包括玩家）
      for (const [id, npc] of npcs) {
        if (npc.isFighter && npc.relation !== 0 && !npc.isDeath && !npc.isDeathInvoked) {
          targets.push(id);
        }
      }
      targets.push("player");
    }

    return targets;
  }

  /**
   * 查找最近的敌人
   * / GetClosestFighter
   */
  findClosestEnemy(sprite: MagicSprite): string | null {
    const npcs = this.npcManager.getAllNpcs();
    const position = sprite.position;
    const belongerId = sprite.belongCharacterId;

    const isPlayerOrFriend =
      belongerId === "player" || (this.npcManager.getNpc(belongerId)?.isFighterFriend ?? false);

    let closestId: string | null = null;
    let closestDist = Infinity;

    for (const [id, npc] of npcs) {
      if (npc.isDeath || npc.isDeathInvoked) continue;

      let isValidTarget = false;
      if (sprite.magic.attackAll > 0) {
        isValidTarget = npc.isFighter;
      } else if (isPlayerOrFriend) {
        isValidTarget = npc.isEnemy;
      } else {
        isValidTarget = npc.isFighterFriend;
      }

      if (!isValidTarget) continue;

      const npcPos = npc.pixelPosition;
      const dx = npcPos.x - position.x;
      const dy = npcPos.y - position.y;
      const dist = distanceFromDelta(dx, dy);

      if (dist < closestDist) {
        closestDist = dist;
        closestId = id;
      }
    }

    // 如果是敌人施放，还要检查玩家
    if (!isPlayerOrFriend && sprite.magic.attackAll === 0) {
      const playerPos = this.player.pixelPosition;
      const dx = playerPos.x - position.x;
      const dy = playerPos.y - position.y;
      const dist = distanceFromDelta(dx, dy);
      if (dist < closestDist && !this.player.isDeath) {
        closestId = "player";
      }
    }

    return closestId;
  }
}
