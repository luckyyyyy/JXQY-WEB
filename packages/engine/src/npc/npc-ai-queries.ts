/**
 * NPC AI 查询 — 用于战斗 AI 的敌友搜索函数
 *
 * 从 NpcManager 提取，保持 NpcManager 职责聚焦于管理生命周期。
 * NpcManager 通过薄委托方法调用这些函数。
 */

import type { Character } from "../character";
import { RelationType, type Vector2 } from "../core/types";
import type { Npc } from "./npc";
import { findCharactersInTileDistance, findClosestCharacter } from "./npc-query-helpers";
import type { NpcSpatialGrid } from "./npc-spatial-grid";

type Position = Vector2;

/** AI 查询所需的上下文 */
export interface NpcAiQueryContext {
  readonly npcs: Map<string, Npc>;
  readonly spatialGrid: NpcSpatialGrid<Npc>;
  readonly player: Character | null;
}

/**
 * Get closest enemy type character
 */
export function getClosestEnemyTypeCharacter(
  ctx: NpcAiQueryContext,
  positionInWorld: Position,
  withNeutral: boolean = false,
  withInvisible: boolean = false,
  ignoreList: Character[] | null = null
): Character | null {
  return findClosestCharacter(
    ctx.spatialGrid,
    null,
    positionInWorld,
    (npc) =>
      (withInvisible || npc.isVisible) && (npc.isEnemy || (withNeutral && npc.isNoneFighter)),
    undefined,
    ignoreList
  );
}

/**
 * Get closest enemy based on finder's relation
 */
export function getClosestEnemy(
  ctx: NpcAiQueryContext,
  finder: Character,
  targetPositionInWorld: Position,
  withNeutral: boolean = false,
  withInvisible: boolean = false,
  ignoreList: Character[] | null = null
): Character | null {
  if (!finder) return null;

  if (finder.isEnemy) {
    // Enemy finds player or fighter friends
    let target = getLiveClosestPlayerOrFighterFriend(
      ctx,
      targetPositionInWorld,
      withNeutral,
      withInvisible,
      ignoreList
    );
    if (!target) {
      target = getLiveClosestOtherGropEnemy(ctx, finder.group, targetPositionInWorld);
    }
    return target;
  }

  if (finder.isPlayer || finder.isFighterFriend) {
    return getClosestEnemyTypeCharacter(
      ctx,
      targetPositionInWorld,
      withNeutral,
      withInvisible,
      ignoreList
    );
  }

  return null;
}

/**
 * Get live closest enemy from a different group
 * NpcManager.GetLiveClosestOtherGropEnemy (typo preserved from C#)
 */
export function getLiveClosestOtherGropEnemy(
  ctx: NpcAiQueryContext,
  group: number,
  positionInWorld: Position
): Character | null {
  return findClosestCharacter(
    ctx.spatialGrid,
    null,
    positionInWorld,
    (npc) => npc.group !== group && npc.isVisible && npc.isEnemy
  );
}

/**
 * Get closest player or fighter friend
 */
export function getLiveClosestPlayerOrFighterFriend(
  ctx: NpcAiQueryContext,
  positionInWorld: Position,
  withNeutral: boolean = false,
  withInvisible: boolean = false,
  ignoreList: Character[] | null = null
): Character | null {
  return findClosestCharacter(
    ctx.spatialGrid,
    ctx.player,
    positionInWorld,
    (npc) =>
      (withInvisible || npc.isVisible) &&
      (npc.isFighterFriend || (withNeutral && npc.isNoneFighter)),
    (player) => withInvisible || player.isVisible,
    ignoreList
  );
}

/**
 * Get closest non-neutral fighter
 * NpcManager.GetLiveClosestNonneturalFighter (typo preserved from C#)
 */
export function getLiveClosestNonneturalFighter(
  ctx: NpcAiQueryContext,
  positionInWorld: Position,
  ignoreList: Character[] | null = null
): Character | null {
  return findClosestCharacter(
    ctx.spatialGrid,
    ctx.player,
    positionInWorld,
    (npc) => npc.isFighter && npc.relation !== RelationType.None,
    () => true,
    ignoreList
  );
}

/**
 * Get closest fighter
 */
export function getClosestFighter(
  ctx: NpcAiQueryContext,
  targetPositionInWorld: Position,
  ignoreList: Character[] | null = null
): Character | null {
  return findClosestCharacter(
    ctx.spatialGrid,
    ctx.player,
    targetPositionInWorld,
    (npc) => npc.isFighter,
    () => true,
    ignoreList
  );
}

/**
 * Find friends (non-opposite characters) within tile distance
 */
export function findFriendsInTileDistance(
  ctx: NpcAiQueryContext,
  finder: Character,
  beginTilePosition: Position,
  tileDistance: number
): Character[] {
  if (!finder || tileDistance < 1) return [];
  return findCharactersInTileDistance(
    ctx.npcs,
    ctx.player,
    beginTilePosition,
    tileDistance,
    (npc) => !finder.isOpposite(npc),
    (player) => !finder.isOpposite(player)
  );
}

/**
 * Find enemies within tile distance
 */
export function findEnemiesInTileDistance(
  ctx: NpcAiQueryContext,
  finder: Character,
  beginTilePosition: Position,
  tileDistance: number
): Character[] {
  if (!finder || tileDistance < 1) return [];
  return findCharactersInTileDistance(
    ctx.npcs,
    ctx.player,
    beginTilePosition,
    tileDistance,
    (npc) => finder.isOpposite(npc),
    (player) => finder.isOpposite(player)
  );
}

/**
 * Find fighters within tile distance
 */
export function findFightersInTileDistance(
  ctx: NpcAiQueryContext,
  beginTilePosition: Position,
  tileDistance: number
): Character[] {
  return findCharactersInTileDistance(
    ctx.npcs,
    ctx.player,
    beginTilePosition,
    tileDistance,
    (npc) => npc.isFighter,
    () => true
  );
}

/**
 * Cancel all fighter attacking (used when global AI is disabled)
 */
export function cancelFighterAttacking(npcs: Map<string, Npc>): void {
  for (const [, npc] of npcs) {
    if (npc.isFighterKind) {
      npc.cancelAttackTarget();
    }
  }
}

/**
 * Get all characters including player
 */
export function getAllCharacters(npcs: Map<string, Npc>, player: Character | null): Character[] {
  const chars: Character[] = [...npcs.values()];
  if (player) {
    chars.push(player);
  }
  return chars;
}
