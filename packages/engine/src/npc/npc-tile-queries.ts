/**
 * NPC Tile Queries — tile-based spatial lookups
 *
 * Pure functions for finding NPCs/characters at specific tile positions.
 * Extracted from NpcManager to reduce God Class size.
 *
 * All functions are stateless — they receive the NPC map and player as parameters.
 * NpcManager delegates to these functions for backward compatibility.
 */

import type { Character } from "../character";
import type { CharacterBase } from "../character/base";
import type { Vector2 } from "../core/types";
import { distanceSquared, getNeighbors } from "../utils";
import type { Npc } from "./npc";

// ============= Core Helpers =============

/**
 * 通用 NPC 查询：在指定瓦片查找满足条件的 NPC
 */
export function findNpcAt(
  npcs: Map<string, Npc>,
  tile: Vector2,
  predicate?: (npc: Npc) => boolean
): Npc | null {
  for (const [, npc] of npcs) {
    if (npc.mapX === tile.x && npc.mapY === tile.y) {
      if (!predicate || predicate(npc)) {
        return npc;
      }
    }
  }
  return null;
}

/**
 * 通用角色查询：在指定瓦片查找满足条件的角色（包括玩家）
 */
export function findCharacterAt(
  npcs: Map<string, Npc>,
  player: Character | null,
  tile: Vector2,
  predicate: (char: Character) => boolean,
  includePlayer = true
): Character | null {
  // 先检查玩家
  if (includePlayer && player) {
    if (player.mapX === tile.x && player.mapY === tile.y) {
      if (predicate(player)) {
        return player;
      }
    }
  }
  // 再检查 NPC
  return findNpcAt(npcs, tile, predicate as (npc: Npc) => boolean);
}

// ============= Specific Queries =============

/** Get NPC at tile position */
export function getNpcAtTile(npcs: Map<string, Npc>, tileX: number, tileY: number): Npc | null {
  return findNpcAt(npcs, { x: tileX, y: tileY });
}

/**
 * Get Eventer NPC at tile position
 * Reference: NpcManager.GetEventer(tilePosition)
 */
export function getEventer(npcs: Map<string, Npc>, tile: Vector2): Npc | null {
  return findNpcAt(npcs, tile, (npc) => npc.isEventer);
}

/** Get enemy NPC at tile position */
export function getEnemy(
  npcs: Map<string, Npc>,
  tileX: number,
  tileY: number,
  withNeutral = false
): Npc | null {
  return findNpcAt(
    npcs,
    { x: tileX, y: tileY },
    (npc) => npc.isEnemy || (withNeutral && npc.isNoneFighter)
  );
}

/** 获取所有敌人的位置信息（调试用） */
export function getEnemyPositions(npcs: Map<string, Npc>): string {
  const enemies: string[] = [];
  for (const [, npc] of npcs) {
    if (npc.isEnemy) {
      enemies.push(`${npc.name}@(${npc.mapX},${npc.mapY})`);
    }
  }
  return enemies.join(", ");
}

/** Get player or fighter friend at tile position */
export function getPlayerOrFighterFriend(
  npcs: Map<string, Npc>,
  player: Character | null,
  tileX: number,
  tileY: number,
  withNeutral = false
): Character | null {
  // 玩家始终是友方
  if (player?.mapX === tileX && player?.mapY === tileY) {
    return player;
  }
  return findNpcAt(
    npcs,
    { x: tileX, y: tileY },
    (npc) => npc.isFighterFriend || (withNeutral && npc.isNoneFighter)
  );
}

/** Get other group enemy at tile position */
export function getOtherGroupEnemy(
  npcs: Map<string, Npc>,
  group: number,
  tileX: number,
  tileY: number
): Character | null {
  return findNpcAt(npcs, { x: tileX, y: tileY }, (npc) => npc.group !== group && npc.isEnemy);
}

/** Get fighter (any combat-capable character) at tile position */
export function getFighter(
  npcs: Map<string, Npc>,
  player: Character | null,
  tileX: number,
  tileY: number
): Character | null {
  return findCharacterAt(
    npcs,
    player,
    { x: tileX, y: tileY },
    (char) => char.isPlayer || char.isFighter
  );
}

/** Get non-neutral fighter at tile position */
export function getNonneutralFighter(
  npcs: Map<string, Npc>,
  player: Character | null,
  tileX: number,
  tileY: number
): Character | null {
  return findCharacterAt(
    npcs,
    player,
    { x: tileX, y: tileY },
    (char) => char.isPlayer || (char.isFighter && !char.isNoneFighter)
  );
}

/** Get neutral fighter at tile position */
export function getNeutralFighter(
  npcs: Map<string, Npc>,
  tileX: number,
  tileY: number
): Npc | null {
  return findNpcAt(npcs, { x: tileX, y: tileY }, (npc) => npc.isNoneFighter);
}

/** Get neighbor enemies of a character using 8-direction neighbors */
export function getNeighborEnemies(npcs: Map<string, Npc>, character: CharacterBase): Character[] {
  const list: Character[] = [];
  if (!character) return list;

  const neighbors = getNeighbors(character.tilePosition);
  for (const neighbor of neighbors) {
    const enemy = getEnemy(npcs, neighbor.x, neighbor.y, false);
    if (enemy) {
      list.push(enemy);
    }
  }
  return list;
}

/** Get neighbor neutral fighters of a character using 8-direction neighbors */
export function getNeighborNeutralFighters(
  npcs: Map<string, Npc>,
  character: CharacterBase
): Character[] {
  const list: Character[] = [];
  if (!character) return list;

  const neighbors = getNeighbors(character.tilePosition);
  for (const neighbor of neighbors) {
    const fighter = getNeutralFighter(npcs, neighbor.x, neighbor.y);
    if (fighter) {
      list.push(fighter);
    }
  }
  return list;
}

/** Check if tile is blocked by NPC */
export function isNpcObstacle(npcs: Map<string, Npc>, tileX: number, tileY: number): boolean {
  return findNpcAt(npcs, { x: tileX, y: tileY }) !== null;
}

/** Get closest interactable NPC to a position */
export function getClosestInteractableNpc(
  npcs: Map<string, Npc>,
  position: Vector2,
  maxDistance = 100
): Npc | null {
  let closest: Npc | null = null;
  let closestDist = Infinity;
  const maxDistSq = maxDistance * maxDistance;

  for (const [, npc] of npcs) {
    if (!npc.isVisible) continue;
    if (!npc.isEventer) continue;

    const distSq = distanceSquared(position, npc.positionInWorld);
    if (distSq < closestDist && distSq < maxDistSq) {
      closest = npc;
      closestDist = distSq;
    }
  }

  return closest;
}
