/**
 * NPC Query Helpers — shared utilities for NPC spatial queries
 *
 * Pure functions and types used by both NpcManager and NPC AI system.
 * Extracted from npc-manager.ts to reduce God Class size.
 */

import type { Character } from "../character";
import type { Vector2 } from "../core/types";
import { distanceSquared, getViewTileDistance } from "../utils";
import { isAiSearchReady, type WasmAiPredicate, wasmFindNearestNpc } from "../wasm/wasm-ai-search";
import type { Npc } from "./npc";

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

/** Check if two characters are enemies — 实现位于 combat/combat-utils */
export { isEnemy } from "../combat/combat-utils";

// ============= Spatial Search =============

/**
 * WASM 共享内存内核最近角色查找
 *
 * NPC 群体搜索走 Rust AiSearch 零拷贝路径；玩家比较仍在 JS 完成。
 */
export function findClosestCharacter(
  player: Character | null,
  positionInWorld: Vector2,
  playerFilter?: (player: Character) => boolean,
  ignoreList?: Character[] | null,
  searchRadius?: number,
  wasmPred?: WasmAiPredicate
): Character | null {
  const hasIgnore = ignoreList && ignoreList.length > 0;

  let closest: Character | null = null;
  let closestDistSq = Infinity;

  // === WASM 共享内存内核（NPC 群体搜索）===
  if (wasmPred && isAiSearchReady()) {
    const radius = searchRadius ?? 1e8; // 无 searchRadius 时等价全图扫描
    const npc = wasmFindNearestNpc(positionInWorld.x, positionInWorld.y, radius, wasmPred);
    if (npc) {
      closest = npc as Character;
      const p = npc.positionInWorld;
      closestDistSq = (p.x - positionInWorld.x) ** 2 + (p.y - positionInWorld.y) ** 2;
    }
  }

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
