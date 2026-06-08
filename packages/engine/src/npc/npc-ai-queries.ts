/**
 * NPC AI 查询 — 用于战斗 AI 的敌友搜索函数
 *
 * 从 NpcManager 提取，保持 NpcManager 职责聚焦于管理生命周期。
 * NpcManager 通过薄委托方法调用这些函数。
 */

import type { Character } from "../character";
import { RelationType, type Vector2 } from "../core/types";
import {
  PRED_ENEMY_TYPE,
  PRED_FIGHTER,
  PRED_NONNEUTRAL_FIGHTER,
  PRED_OTHER_GROUP_ENEMY,
  PRED_PLAYER_OR_FIGHTER_FRIEND,
} from "../wasm/wasm-ai-search";
import type { Npc } from "./npc";
import { findCharactersInTileDistance, findClosestCharacter } from "./npc-query-helpers";

type Position = Vector2;

/** AI 查询所需的上下文 */
export interface NpcAiQueryContext {
  readonly npcs: Map<string, Npc>;
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
  ignoreList: Character[] | null = null,
  searchRadius?: number
): Character | null {
  return findClosestCharacter(
    null,
    positionInWorld,
    undefined,
    ignoreList,
    searchRadius,
    { pred: PRED_ENEMY_TYPE, paramGroup: 0, withNeutral, withInvisible }
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
 */
export function getLiveClosestOtherGropEnemy(
  ctx: NpcAiQueryContext,
  group: number,
  positionInWorld: Position,
  searchRadius?: number
): Character | null {
  return findClosestCharacter(
    null,
    positionInWorld,
    undefined,
    null,
    searchRadius,
    { pred: PRED_OTHER_GROUP_ENEMY, paramGroup: group, withNeutral: false, withInvisible: false }
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
  ignoreList: Character[] | null = null,
  searchRadius?: number
): Character | null {
  return findClosestCharacter(
    ctx.player,
    positionInWorld,
    (player) => withInvisible || player.isVisible,
    ignoreList,
    searchRadius,
    { pred: PRED_PLAYER_OR_FIGHTER_FRIEND, paramGroup: 0, withNeutral, withInvisible }
  );
}

/**
 * Get closest non-neutral fighter
 */
export function getLiveClosestNonneturalFighter(
  ctx: NpcAiQueryContext,
  positionInWorld: Position,
  ignoreList: Character[] | null = null,
  searchRadius?: number
): Character | null {
  return findClosestCharacter(
    ctx.player,
    positionInWorld,
    () => true,
    ignoreList,
    searchRadius,
    { pred: PRED_NONNEUTRAL_FIGHTER, paramGroup: 0, withNeutral: false, withInvisible: false }
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
    ctx.player,
    targetPositionInWorld,
    () => true,
    ignoreList,
    undefined, // 无 searchRadius → findClosestCharacter 内部用 1e8 全图扫描
    { pred: PRED_FIGHTER, paramGroup: 0, withNeutral: false, withInvisible: false }
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
