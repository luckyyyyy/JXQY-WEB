/**
 * NPC Tile Queries — tile-based spatial lookups
 *
 * Pure functions for finding NPCs/characters at specific tile positions.
 * Extracted from NpcManager to reduce God Class size.
 *
 * All functions are stateless — they receive the NPC map and player as parameters.
 * NpcManager delegates to these functions for backward compatibility.
 *
 * Optional `tileIndex` parameter (built once per frame by NpcManager) routes
 * tile lookups through an O(1) bucket instead of scanning the whole NPC Map.
 * When omitted, falls back to the legacy full-Map scan for backward compatibility.
 */

import type { Character } from "../character";
import type { CharacterBase } from "../character/base";
import type { Vector2 } from "../core/types";
import { distanceSquared, getNeighbors } from "../utils";
import type { Npc } from "./npc";

/**
 * tile 坐标 → 单一数字键（tile 非负且远小于 65536）
 * 与 NpcManager.rebuildTileIndex 共享，保证查询/构建使用同一键编码。
 */
export function npcTileKey(x: number, y: number): number {
  return x * 65536 + y;
}

/** 每帧由 NpcManager 重建的 tile→NPC 占用索引（只读视图） */
export type NpcTileIndex = ReadonlyMap<number, readonly Npc[]>;

// ============= Core Helpers =============

/**
 * 通用 NPC 查询：在指定瓦片查找满足条件的 NPC
 *
 * 当传入 `tileIndex` 时仅迭代该瓦片对应的 bucket（O(1) 查找）。
 * 索引在帧起始按 NPC Map 插入顺序构建，所以 bucket 内顺序与全量扫描一致，
 * 命中时返回的 NPC 与旧实现完全相同（含 tie-break）。
 */
export function findNpcAt(
  npcs: Map<string, Npc>,
  tile: Vector2,
  predicate?: (npc: Npc) => boolean,
  tileIndex?: NpcTileIndex
): Npc | null {
  if (tileIndex) {
    const bucket = tileIndex.get(npcTileKey(tile.x, tile.y));
    if (!bucket || bucket.length === 0) return null;
    for (const npc of bucket) {
      if (npc.mapX === tile.x && npc.mapY === tile.y) {
        if (!predicate || predicate(npc)) {
          return npc;
        }
      }
    }
    return null;
  }
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
  includePlayer = true,
  tileIndex?: NpcTileIndex
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
  return findNpcAt(npcs, tile, predicate as (npc: Npc) => boolean, tileIndex);
}

// ============= Specific Queries =============

/** Get NPC at tile position */
export function getNpcAtTile(
  npcs: Map<string, Npc>,
  tileX: number,
  tileY: number,
  tileIndex?: NpcTileIndex
): Npc | null {
  return findNpcAt(npcs, { x: tileX, y: tileY }, undefined, tileIndex);
}

/**
 * Get Eventer NPC at tile position
 * Reference: NpcManager.GetEventer(tilePosition)
 */
export function getEventer(
  npcs: Map<string, Npc>,
  tile: Vector2,
  tileIndex?: NpcTileIndex
): Npc | null {
  return findNpcAt(npcs, tile, (npc) => npc.isEventer, tileIndex);
}

/** Get enemy NPC at tile position */
export function getEnemy(
  npcs: Map<string, Npc>,
  tileX: number,
  tileY: number,
  withNeutral = false,
  tileIndex?: NpcTileIndex
): Npc | null {
  return findNpcAt(
    npcs,
    { x: tileX, y: tileY },
    (npc) => npc.isEnemy || (withNeutral && npc.isNoneFighter),
    tileIndex
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
  withNeutral = false,
  tileIndex?: NpcTileIndex
): Character | null {
  // 玩家始终是友方
  if (player?.mapX === tileX && player?.mapY === tileY) {
    return player;
  }
  return findNpcAt(
    npcs,
    { x: tileX, y: tileY },
    (npc) => npc.isFighterFriend || (withNeutral && npc.isNoneFighter),
    tileIndex
  );
}

/** Get other group enemy at tile position */
export function getOtherGroupEnemy(
  npcs: Map<string, Npc>,
  group: number,
  tileX: number,
  tileY: number,
  tileIndex?: NpcTileIndex
): Character | null {
  return findNpcAt(
    npcs,
    { x: tileX, y: tileY },
    (npc) => npc.group !== group && npc.isEnemy,
    tileIndex
  );
}

/** Get fighter (any combat-capable character) at tile position */
export function getFighter(
  npcs: Map<string, Npc>,
  player: Character | null,
  tileX: number,
  tileY: number,
  tileIndex?: NpcTileIndex
): Character | null {
  return findCharacterAt(
    npcs,
    player,
    { x: tileX, y: tileY },
    (char) => char.isPlayer || char.isFighter,
    true,
    tileIndex
  );
}

/** Get non-neutral fighter at tile position */
export function getNonneutralFighter(
  npcs: Map<string, Npc>,
  player: Character | null,
  tileX: number,
  tileY: number,
  tileIndex?: NpcTileIndex
): Character | null {
  return findCharacterAt(
    npcs,
    player,
    { x: tileX, y: tileY },
    (char) => char.isPlayer || (char.isFighter && !char.isNoneFighter),
    true,
    tileIndex
  );
}

/** Get neutral fighter at tile position */
export function getNeutralFighter(
  npcs: Map<string, Npc>,
  tileX: number,
  tileY: number,
  tileIndex?: NpcTileIndex
): Npc | null {
  return findNpcAt(npcs, { x: tileX, y: tileY }, (npc) => npc.isNoneFighter, tileIndex);
}

/** Get neighbor enemies of a character using 8-direction neighbors */
export function getNeighborEnemies(
  npcs: Map<string, Npc>,
  character: CharacterBase,
  tileIndex?: NpcTileIndex
): Character[] {
  const list: Character[] = [];
  if (!character) return list;

  const neighbors = getNeighbors(character.tilePosition);
  for (const neighbor of neighbors) {
    const enemy = getEnemy(npcs, neighbor.x, neighbor.y, false, tileIndex);
    if (enemy) {
      list.push(enemy);
    }
  }
  return list;
}

/** Get neighbor neutral fighters of a character using 8-direction neighbors */
export function getNeighborNeutralFighters(
  npcs: Map<string, Npc>,
  character: CharacterBase,
  tileIndex?: NpcTileIndex
): Character[] {
  const list: Character[] = [];
  if (!character) return list;

  const neighbors = getNeighbors(character.tilePosition);
  for (const neighbor of neighbors) {
    const fighter = getNeutralFighter(npcs, neighbor.x, neighbor.y, tileIndex);
    if (fighter) {
      list.push(fighter);
    }
  }
  return list;
}

/** Check if tile is blocked by NPC */
export function isNpcObstacle(
  npcs: Map<string, Npc>,
  tileX: number,
  tileY: number,
  tileIndex?: NpcTileIndex
): boolean {
  return findNpcAt(npcs, { x: tileX, y: tileY }, undefined, tileIndex) !== null;
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
