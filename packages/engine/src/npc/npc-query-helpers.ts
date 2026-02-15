/**
 * NPC Query Helpers — shared utilities for NPC spatial queries
 *
 * Pure functions and types used by both NpcManager and NPC AI system.
 * Extracted from npc-manager.ts to reduce God Class size.
 */

import type { Character } from "../character";
import type { CharacterBase } from "../character/base";
import type { Vector2 } from "../core/types";
import { distanceSquared, getViewTileDistance } from "../utils";
import type { Npc } from "./npc";
import type { NpcSpatialGrid } from "./npc-spatial-grid";

// ============= Types =============

/** 死亡信息 - 跟踪最近死亡的角色 */
export class DeathInfo {
  theDead: Character;
  leftFrameToKeep: number;

  constructor(theDead: Character, leftFrameToKeep: number = 2) {
    this.theDead = theDead;
    this.leftFrameToKeep = leftFrameToKeep;
  }
}

/** 视野区域类型 */
export interface ViewRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

// ============= Pure Functions =============

/**
 * Check if two characters are enemies (pure function)
 */
export function isEnemy(a: CharacterBase, b: CharacterBase): boolean {
  // 非战斗者不是敌人
  if ((!a.isPlayer && !a.isFighter) || (!b.isPlayer && !b.isFighter)) return false;
  // 玩家或友方 vs 非玩家、非伙伴、非友方
  if ((a.isPlayer || a.isFighterFriend) && !b.isPlayer && !b.isPartner && !b.isFighterFriend)
    return true;
  // 反过来
  if ((b.isPlayer || b.isFighterFriend) && !a.isPlayer && !a.isPartner && !a.isFighterFriend)
    return true;
  // 不同组
  return a.group !== b.group;
}

// ============= Spatial Search =============

/**
 * 空间网格搜索半径（像素）
 * 覆盖约 30 个瓦片距离，超出大多数 NPC visionRadius。
 * 找不到时自动 fallback 到全量扫描，不影响正确性。
 */
const GRID_SEARCH_RADIUS = 2000;

/**
 * 使用空间网格加速的最近角色查找
 *
 * 策略：先在 GRID_SEARCH_RADIUS 范围内搜索网格，找到即返回。
 * 如果网格搜索无结果（目标极远），fallback 到全量扫描。
 * 最后再和 player 比较距离。
 */
export function findClosestCharacter(
  grid: NpcSpatialGrid<Npc>,
  player: Character | null,
  positionInWorld: Vector2,
  npcFilter: (npc: Npc) => boolean,
  playerFilter?: (player: Character) => boolean,
  ignoreList?: Character[] | null
): Character | null {
  const hasIgnore = ignoreList && ignoreList.length > 0;
  const combinedFilter = (npc: Npc): boolean => {
    if (hasIgnore && ignoreList.some((item) => item === npc)) return false;
    if (npc.isDeathInvoked) return false;
    return npcFilter(npc);
  };

  // 先用空间网格在有限半径内搜索
  let result = grid.findClosest(
    positionInWorld.x,
    positionInWorld.y,
    GRID_SEARCH_RADIUS,
    combinedFilter
  );

  // 网格内没找到，fallback 到全量扫描（极少触发）
  if (!result) {
    result = grid.findClosestAll(positionInWorld.x, positionInWorld.y, combinedFilter);
  }

  let closest: Character | null = result ? result.item : null;
  const closestDistSq = result
    ? (result.x - positionInWorld.x) ** 2 + (result.y - positionInWorld.y) ** 2
    : Infinity;

  // 和 player 比较
  if (player && playerFilter) {
    if (
      !(hasIgnore && ignoreList.some((item) => item === player)) &&
      !player.isDeathInvoked &&
      playerFilter(player)
    ) {
      const distSq = distanceSquared(positionInWorld, player.positionInWorld);
      if (distSq < closestDistSq) {
        closest = player;
      }
    }
  }

  return closest;
}

/**
 * 在瓦片距离范围内查找角色
 */
export function findCharactersInTileDistance(
  npcs: Map<string, Npc>,
  player: Character | null,
  beginTilePosition: Vector2,
  tileDistance: number,
  npcFilter: (npc: Npc) => boolean,
  playerFilter?: (player: Character) => boolean
): Character[] {
  const result: Character[] = [];

  for (const npc of npcs.values()) {
    if (npcFilter(npc)) {
      if (getViewTileDistance(beginTilePosition, npc.tilePosition) <= tileDistance) {
        result.push(npc);
      }
    }
  }

  if (player && playerFilter?.(player)) {
    if (getViewTileDistance(beginTilePosition, player.tilePosition) <= tileDistance) {
      result.push(player);
    }
  }

  return result;
}
