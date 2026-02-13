/**
 * NPC 查询工具函数
 * 从 NpcManager 提取的通用查询模式，消除重复的迭代逻辑
 */

import type { Character } from "../character";
import type { Vector2 } from "../core/types";
import { distance, getViewTileDistance } from "../utils";
import type { Npc } from "./npc";

/**
 * 在 NPC 集合中找到满足条件的最近角色（可选包含玩家）
 * 统一了 getClosestEnemyTypeCharacter / getLiveClosest* / getClosestFighter 等方法的迭代模式
 *
 * @param npcs NPC 集合
 * @param player 玩家实例（null 则不检查）
 * @param positionInWorld 世界坐标搜索中心
 * @param npcFilter NPC 过滤条件（已死亡的 NPC 自动跳过）
 * @param playerFilter 玩家过滤条件（不传则不检查玩家）
 * @param ignoreList 忽略列表（引用比较）
 */
export function findClosestCharacter(
  npcs: Map<string, Npc>,
  player: Character | null,
  positionInWorld: Vector2,
  npcFilter: (npc: Npc) => boolean,
  playerFilter?: (player: Character) => boolean,
  ignoreList?: Character[] | null
): Character | null {
  let closest: Character | null = null;
  let closestDist = Infinity;

  for (const npc of npcs.values()) {
    if (ignoreList?.some((item) => item === npc)) continue;
    if (npc.isDeathInvoked) continue;
    if (!npcFilter(npc)) continue;

    const dist = distance(positionInWorld, npc.positionInWorld);
    if (dist < closestDist) {
      closest = npc;
      closestDist = dist;
    }
  }

  if (player && playerFilter) {
    if (
      !ignoreList?.some((item) => item === player) &&
      !player.isDeathInvoked &&
      playerFilter(player)
    ) {
      const dist = distance(positionInWorld, player.positionInWorld);
      if (dist < closestDist) {
        closest = player;
      }
    }
  }

  return closest;
}

/**
 * 在瓦片距离内找到满足条件的角色（可选包含玩家）
 * 统一了 findFriendsInTileDistance / findEnemiesInTileDistance / findFightersInTileDistance 的迭代模式
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
