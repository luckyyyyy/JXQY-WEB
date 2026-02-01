/**
 * NPC 管理器 - 对应 C# NpcManager.cs
 * 管理所有 NPC 的创建、更新、查询
 */

import { getEngineContext } from "../core/engineContext";
import { logger } from "../core/logger";
import type { CharacterConfig, Vector2 } from "../core/types";
import { CharacterKind, CharacterState, type Direction, RelationType } from "../core/types";
import { distance, getNeighbors, getViewTileDistance, parseIni } from "../utils";
import { getDropObj, type DropCharacter } from "../drop/goodDrop";
import type { ObjManager } from "../obj/objManager";
import { resourceLoader } from "../resource/resourceLoader";
import type { Character } from "./character";
import { disableGlobalAI, enableGlobalAI, Npc } from "./npc";
import { loadNpcConfig } from "./resFile";
import { ResourcePath } from "../../config/resourcePaths";

// Type alias for position (use Vector2 for consistency)
type Position = Vector2;

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

/** NpcManager 类 - 对应 C# NpcManager.cs */
export class NpcManager {
  // Internal storage uses Npc class instances
  private npcs: Map<string, Npc> = new Map();
  // Note: NPC config caching is now handled by resourceLoader.loadIni
  // Store loaded NPC file name (like C# _fileName)
  private fileName: string = "";

  // List of dead NPCs (C#: NpcManager._deadNpcList)
  private _deadNpcs: Npc[] = [];

  // C#: DeathInfos - tracks recently dead characters for CheckKeepDistanceWhenFriendDeath
  private _deathInfos: DeathInfo[] = [];

  // === 性能优化：预计算视野内 NPC ===
  // C# Reference: NpcManager._npcInView, UpdateNpcsInView()
  // 在 Update 阶段预计算，Render 阶段直接使用，避免每帧重复遍历
  private _npcsInView: Npc[] = [];
  private _npcsByRow: Map<number, Npc[]> = new Map();

  /**
   * 获取 Player（通过 IEngineContext）
   */
  private get _player(): Character {
    const ctx = getEngineContext();
    return ctx.player as Character;
  }

  /**
   * Run death script for an NPC (called from NPC.onDeath)
   * 使用 ScriptExecutor 的队列系统确保多个 NPC 同时死亡时脚本按顺序执行
   * C# Reference: Character.Death() -> ScriptManager.RunScript(DeathScript)
   */
  runDeathScript(scriptPath: string, npc: Npc): void {
    if (!scriptPath) return;

    const engine = getEngineContext();
    if (!engine) return;

    const basePath = engine.getScriptBasePath();
    const fullPath = scriptPath.startsWith("/") ? scriptPath : `${basePath}/${scriptPath}`;

    // 使用 ScriptExecutor 的队列系统（C# 是 ScriptManager._list）
    logger.log(`[NpcManager] Queueing death script for ${npc.name}: ${fullPath}`);
    engine.queueScript(fullPath);
  }

  /**
   * Add NPC to dead list and death info (C#: NpcManager.AddDead)
   * Used for CheckKeepDistanceWhenFriendDeath AI behavior
   */
  addDead(npc: Npc): void {
    if (!this._deadNpcs.includes(npc)) {
      this._deadNpcs.push(npc);
    }
    // C#: DeathInfos.AddLast(new DeathInfo(dead, 2))
    // Add to death infos for friend death detection with 2 frame lifetime
    this._deathInfos.push(new DeathInfo(npc, 2));
  }

  /**
   * Get death infos list (for debug/inspection)
   */
  getDeathInfos(): DeathInfo[] {
    return this._deathInfos;
  }

  /**
   * Find a friend that was killed by a live character within vision distance
   * Based on C# NpcManager.FindFriendDeadKilledByLiveCharacter
   *
   * @param finder The character looking for dead friends
   * @param maxTileDistance Maximum tile distance to search
   * @returns The dead friend character, or null if not found
   */
  findFriendDeadKilledByLiveCharacter(
    finder: Character,
    maxTileDistance: number
  ): Character | null {
    for (const deadInfo of this._deathInfos) {
      const theDead = deadInfo.theDead;

      // Check distance
      if (getViewTileDistance(finder.tilePosition, theDead.tilePosition) > maxTileDistance) {
        continue;
      }

      // C#: Check if killed by a live character with MagicSprite
      // We check lastAttacker instead since we don't have MagicSprite system yet
      const lastAttacker = (theDead as any)._lastAttacker as Character | null;
      if (!lastAttacker || lastAttacker.isDeathInvoked) {
        continue;
      }

      // C#: Check if finder and dead are on same side
      // Enemy finds dead enemy, FighterFriend finds dead FighterFriend
      if (
        (finder.isEnemy && theDead.isEnemy) ||
        (finder.isFighterFriend && theDead.isFighterFriend)
      ) {
        return theDead;
      }
    }
    return null;
  }

  /**
   * Get dead NPCs list
   */
  getDeadNpcs(): Npc[] {
    return this._deadNpcs;
  }

  // Player 现在由 NPC 通过 IEngineContext.player 获取，不再需要 setPlayer

  /**
   * Get current NPC file name
   */
  getFileName(): string {
    return this.fileName;
  }

  /**
   * Get all NPC instances
   */
  getAllNpcs(): Map<string, Npc> {
    return this.npcs;
  }

  // === 性能优化：预计算视野内 NPC ===

  /**
   * 在 Update 阶段预计算视野内 NPC（每帧调用一次）
   * C# Reference: NpcManager.UpdateNpcsInView()
   * 同时按行分组，供交错渲染使用
   */
  updateNpcsInView(viewRect: ViewRect): void {
    // 清空上一帧的缓存
    this._npcsInView.length = 0;
    this._npcsByRow.clear();

    const viewRight = viewRect.x + viewRect.width;
    const viewBottom = viewRect.y + viewRect.height;

    for (const [, npc] of this.npcs) {
      // C#: if (viewRegion.Intersects(npc.RegionInWorld))
      const region = npc.regionInWorld;
      const regionRight = region.x + region.width;
      const regionBottom = region.y + region.height;

      // AABB 交集检测
      if (
        region.x < viewRight &&
        regionRight > viewRect.x &&
        region.y < viewBottom &&
        regionBottom > viewRect.y
      ) {
        this._npcsInView.push(npc);

        // 同时按行分组（用于交错渲染）
        if (npc.isVisible) {
          const row = npc.tilePosition.y;
          let list = this._npcsByRow.get(row);
          if (!list) {
            list = [];
            this._npcsByRow.set(row, list);
          }
          list.push(npc);
        }
      }
    }
  }

  /**
   * 获取预计算的视野内 NPC 列表（只读）
   * C# Reference: NpcManager.NpcsInView property
   * 在 Render 阶段使用，避免重复计算
   */
  get npcsInView(): readonly Npc[] {
    return this._npcsInView;
  }

  /**
   * 获取指定行的 NPC 列表（用于交错渲染）
   * 返回预计算的结果，避免每帧重建 Map
   */
  getNpcsAtRow(row: number): readonly Npc[] {
    return this._npcsByRow.get(row) ?? [];
  }

  /**
   * Get NPCs within a view region
   * C# Reference: NpcManager.GetNpcsInView()
   * Returns NPCs whose RegionInWorld intersects with viewRect
   * 注意：渲染时优先使用预计算的 npcsInView 和 getNpcsAtRow
   */
  getNpcsInView(viewRect: ViewRect): Npc[] {
    const result: Npc[] = [];
    const viewRight = viewRect.x + viewRect.width;
    const viewBottom = viewRect.y + viewRect.height;

    for (const [, npc] of this.npcs) {
      // C#: if (viewRegion.Intersects(npc.RegionInWorld))
      const region = npc.regionInWorld;
      const regionRight = region.x + region.width;
      const regionBottom = region.y + region.height;

      // Check AABB intersection
      if (
        region.x < viewRight &&
        regionRight > viewRect.x &&
        region.y < viewBottom &&
        regionBottom > viewRect.y
      ) {
        result.push(npc);
      }
    }
    return result;
  }

  /**
   * Get NPC by name (returns first match)
   */
  getNpc(name: string): Npc | null {
    for (const [, npc] of this.npcs) {
      if (npc.name === name) {
        return npc;
      }
    }
    return null;
  }

  /**
   * Get all NPCs with the specified name
   * C#: NpcManager.GetAllNpcs(name) - returns all NPCs with matching name
   * Multiple NPCs can have the same name (e.g., guards, enemies)
   */
  getAllNpcsByName(name: string): Npc[] {
    const result: Npc[] = [];
    for (const [, npc] of this.npcs) {
      if (npc.name === name) {
        result.push(npc);
      }
    }
    return result;
  }

  /**
   * Get NPC by ID
   */
  getNpcById(id: string): Npc | null {
    return this.npcs.get(id) || null;
  }

  /**
   * Get character with Kind=Player from NPC list
   * C#: NpcManager.GetPlayerKindCharacter()
   * Returns the first NPC with CharacterKind.Player, or null
   */
  getPlayerKindCharacter(): Npc | null {
    for (const [, npc] of this.npcs) {
      if (npc.kind === CharacterKind.Player) {
        return npc;
      }
    }
    return null;
  }

  /**
   * Add NPC from config file
   * Config caching is handled by resourceLoader.loadIni
   */
  async addNpc(
    configPath: string,
    tileX: number,
    tileY: number,
    direction: Direction = 4
  ): Promise<Npc | null> {
    // loadNpcConfig uses resourceLoader.loadIni which caches parsed result
    const config = await loadNpcConfig(configPath);

    if (!config) {
      // loadNpcConfig already logged the error, just return null
      return null;
    }

    const npc = Npc.fromConfig(config, tileX, tileY, direction);
    this.npcs.set(npc.id, npc);

    // NPC 通过 IEngineContext 获取 NpcManager、Player、MagicManager、AudioManager

    // Log NPC creation for debugging
    logger.log(
      `[NpcManager] Created NPC: ${config.name} at (${tileX}, ${tileY}), id=${npc.id}, npcIni=${config.npcIni || "none"}`
    );

    // Auto-load sprites using Npc's own method
    if (config.npcIni) {
      npc
        .loadSpritesFromNpcIni(config.npcIni)
        .catch((err: any) =>
          logger.warn(`[NpcManager] Failed to load sprites for NPC ${config?.name}:`, err)
        );
    }

    // Preload NPC magics (async, non-blocking)
    npc
      .loadAllMagics()
      .catch((err: any) =>
        logger.warn(`[NpcManager] Failed to preload magics for NPC ${config?.name}:`, err)
      );

    return npc;
  }

  /**
   * Add NPC with existing config
   */
  addNpcWithConfig(
    config: CharacterConfig,
    tileX: number,
    tileY: number,
    direction: Direction = 4
  ): Npc {
    const npc = Npc.fromConfig(config, tileX, tileY, direction);
    this.npcs.set(npc.id, npc);

    // NPC 通过 IEngineContext 获取 NpcManager、Player、MagicManager、AudioManager

    // Log NPC creation for debugging
    logger.log(
      `[NpcManager] Created NPC (with config): ${config.name} at (${tileX}, ${tileY}), id=${npc.id}, npcIni=${config.npcIni || "none"}`
    );

    // Auto-load sprites using Npc's own method
    if (config.npcIni) {
      npc
        .loadSpritesFromNpcIni(config.npcIni)
        .catch((err: any) =>
          logger.warn(`[NpcManager] Failed to load sprites for NPC ${config.name}:`, err)
        );
    }

    // Preload NPC magics (async, non-blocking)
    npc
      .loadAllMagics()
      .catch((err: any) =>
        logger.warn(`[NpcManager] Failed to preload magics for NPC ${config.name}:`, err)
      );

    return npc;
  }

  /**
   * Delete NPC by name
   */
  deleteNpc(name: string): boolean {
    for (const [id, npc] of this.npcs) {
      if (npc.name === name) {
        this.npcs.delete(id);
        return true;
      }
    }
    return false;
  }

  /**
   * Delete NPC by ID
   */
  deleteNpcById(id: string): boolean {
    return this.npcs.delete(id);
  }

  /**
   * Clear all NPCs
   */
  clearAllNpcs(): void {
    this.npcs.clear();
  }

  /**
   * Clear all NPCs but keep partners (followers)
   * C#: NpcManager.ClearAllNpcAndKeepPartner
   */
  clearAllNpcAndKeepPartner(): void {
    const toDelete: string[] = [];
    for (const [id, npc] of this.npcs) {
      if (!npc.isPartner) {
        toDelete.push(id);
      } else {
        // Cancel attack target for partners
        npc.clearFollowTarget();
      }
    }
    for (const id of toDelete) {
      this.npcs.delete(id);
    }
    // Clear death infos
    this._deathInfos.length = 0;
    this._deadNpcs.length = 0;
  }

  /**
   * Remove all partner NPCs
   * C#: NpcManager.RemoveAllPartner
   * 用于加载存档时先清除旧的 partner，再加载新的
   */
  removeAllPartners(): void {
    const toDelete: string[] = [];
    for (const [id, npc] of this.npcs) {
      if (npc.isPartner) {
        toDelete.push(id);
      }
    }
    for (const id of toDelete) {
      this.npcs.delete(id);
    }
    logger.debug(`[NpcManager] Removed ${toDelete.length} partners`);
  }

  /**
   * Set NPC position
   */
  setNpcPosition(name: string, tileX: number, tileY: number): boolean {
    const npc = this.getNpc(name);
    if (!npc) return false;

    npc.setPosition(tileX, tileY);
    return true;
  }

  /**
   * Make NPC walk to position
   */
  npcGoto(name: string, tileX: number, tileY: number): boolean {
    const npc = this.getNpc(name);
    if (!npc) return false;

    return npc.walkTo({ x: tileX, y: tileY });
  }

  /**
   * Make NPC walk in a direction for a number of steps
   * Matches C# Character.WalkToDirection(direction, steps)
   */
  npcGotoDir(name: string, direction: number, steps: number): boolean {
    const npc = this.getNpc(name);
    if (!npc) return false;

    // Use Character's walkToDirection method
    npc.walkToDirection(direction, steps);
    return true;
  }

  /**
   * Get closest interactable NPC to a position
   */
  getClosestInteractableNpc(position: Vector2, maxDistance: number = 100): Npc | null {
    let closest: Npc | null = null;
    let closestDist = Infinity;

    for (const [, npc] of this.npcs) {
      if (!npc.isVisible) continue;
      // Only eventer NPCs are interactable
      if (npc.kind !== CharacterKind.Eventer) continue;

      const npcPos = { x: npc.positionInWorld.x, y: npc.positionInWorld.y };
      const dist = distance(position, npcPos);
      if (dist < closestDist && dist < maxDistance) {
        closest = npc;
        closestDist = dist;
      }
    }

    return closest;
  }

  /**
   * Get NPC at tile position
   */
  getNpcAtTile(tileX: number, tileY: number): Npc | null {
    for (const [, npc] of this.npcs) {
      if (npc.mapX === tileX && npc.mapY === tileY) {
        return npc;
      }
    }
    return null;
  }

  /**
   * Get Eventer NPC at tile position
   * C# Reference: NpcManager.GetEventer(tilePosition)
   * Used for jump obstacle check - if there's an eventer at the tile, can't jump there
   */
  getEventer(tile: Vector2): Npc | null {
    for (const [, npc] of this.npcs) {
      if (npc.mapX === tile.x && npc.mapY === tile.y && npc.kind === CharacterKind.Eventer) {
        return npc;
      }
    }
    return null;
  }

  /**
   * Get enemy NPC at tile position
   * C# Reference: NpcManager.GetEnemy(int tileX, int tileY, bool withNeutral)
   */
  getEnemy(tileX: number, tileY: number, withNeutral: boolean = false): Npc | null {
    for (const [, npc] of this.npcs) {
      if (npc.mapX === tileX && npc.mapY === tileY) {
        if (npc.isEnemy || (withNeutral && npc.isNoneFighter)) {
          return npc;
        }
      }
    }
    return null;
  }

  /**
   * 获取所有敌人的位置信息（调试用）
   */
  getEnemyPositions(): string {
    const enemies: string[] = [];
    for (const [, npc] of this.npcs) {
      if (npc.isEnemy) {
        enemies.push(`${npc.name}@(${npc.mapX},${npc.mapY})`);
      }
    }
    return enemies.join(", ");
  }

  /**
   * Get player or fighter friend at tile position
   * C# Reference: NpcManager.GetPlayerOrFighterFriend(Vector2 tilePosition, bool withNeutral)
   */
  getPlayerOrFighterFriend(
    tileX: number,
    tileY: number,
    withNeutral: boolean = false
  ): Character | null {
    // Check player first
    if (this._player) {
      if (this._player.mapX === tileX && this._player.mapY === tileY) {
        return this._player;
      }
    }
    // Check NPCs
    for (const [, npc] of this.npcs) {
      if (npc.mapX === tileX && npc.mapY === tileY) {
        if (npc.isFighterFriend || (withNeutral && npc.isNoneFighter)) {
          return npc;
        }
      }
    }
    return null;
  }

  /**
   * Get other group enemy at tile position
   * C# Reference: NpcManager.GetOtherGropEnemy(int group, Vector2 tilePosition)
   */
  getOtherGroupEnemy(group: number, tileX: number, tileY: number): Character | null {
    for (const [, npc] of this.npcs) {
      if (npc.mapX === tileX && npc.mapY === tileY) {
        if (npc.group !== group && npc.isEnemy) {
          return npc;
        }
      }
    }
    return null;
  }

  /**
   * Get fighter (any combat-capable character) at tile position
   * C# Reference: NpcManager.GetFighter(Vector2 tilePosition)
   */
  getFighter(tileX: number, tileY: number): Character | null {
    // Check player first
    if (
      this._player &&
      this._player.kind === CharacterKind.Player &&
      this._player.mapX === tileX &&
      this._player.mapY === tileY
    ) {
      return this._player;
    }
    // Check NPCs
    for (const [, npc] of this.npcs) {
      if (npc.isFighter && npc.mapX === tileX && npc.mapY === tileY) {
        return npc;
      }
    }
    return null;
  }

  /**
   * Get non-neutral fighter at tile position
   * C# Reference: NpcManager.GetNonneutralFighter(Vector2 tilePosition)
   */
  getNonneutralFighter(tileX: number, tileY: number): Character | null {
    // Check player first
    if (this._player && this._player.mapX === tileX && this._player.mapY === tileY) {
      return this._player;
    }
    // Check NPCs (non-neutral fighters)
    for (const [, npc] of this.npcs) {
      if (npc.mapX === tileX && npc.mapY === tileY) {
        if (npc.isFighter && !npc.isNoneFighter) {
          return npc;
        }
      }
    }
    return null;
  }

  /**
   * Get neutral fighter at tile position
   * C# Reference: NpcManager.GetNeutralFighter(Vector2 tilePosition)
   */
  getNeutralFighter(tileX: number, tileY: number): Character | null {
    for (const [, npc] of this.npcs) {
      if (npc.mapX === tileX && npc.mapY === tileY) {
        if (npc.isNoneFighter) {
          return npc;
        }
      }
    }
    return null;
  }

  /**
   * Get neighbor enemies of a character
   * C# Reference: NpcManager.GetNeighborEnemy(Character character)
   * Find enemies in neighboring tiles (8-direction)
   */
  getNeighborEnemy(character: Character): Character[] {
    const list: Character[] = [];
    if (!character) return list;

    const neighbors = getNeighbors(character.tilePosition);
    for (const neighbor of neighbors) {
      const enemy = this.getEnemy(neighbor.x, neighbor.y, false);
      if (enemy) {
        list.push(enemy);
      }
    }
    return list;
  }

  /**
   * Get neighbor neutral fighters of a character
   * C# Reference: NpcManager.GetNeighborNuturalFighter(Character character)
   * Find neutral fighters in neighboring tiles (8-direction)
   */
  getNeighborNeutralFighter(character: Character): Character[] {
    const list: Character[] = [];
    if (!character) return list;

    const neighbors = getNeighbors(character.tilePosition);
    for (const neighbor of neighbors) {
      const fighter = this.getNeutralFighter(neighbor.x, neighbor.y);
      if (fighter) {
        list.push(fighter);
      }
    }
    return list;
  }

  /**
   * Check if two characters are enemies
   * C# Reference: NpcManager.IsEnemy(Character a, Character b)
   */
  static isEnemy(a: Character, b: Character): boolean {
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

  /**
   * Check if tile is blocked by NPC
   */
  isObstacle(tileX: number, tileY: number): boolean {
    for (const [, npc] of this.npcs) {
      if (npc.mapX === tileX && npc.mapY === tileY) {
        return true;
      }
    }
    return false;
  }

  /**
   * Update all NPCs
   * Based on C# NpcManager.Update
   */
  update(deltaTime: number): void {
    // C#: Update each NPC and handle death body addition
    const npcsToDelete: string[] = [];

    // 通过 IEngineContext 获取 ObjManager 和 isDropEnabled
    const engineContext = getEngineContext();
    const objManager = engineContext.getManager("obj") as ObjManager;
    const isDropEnabled = engineContext.isDropEnabled();

    for (const [id, npc] of this.npcs) {
      if (!npc.isVisible) continue;
      // Npc class handles its own update (movement, animation, AI)
      npc.update(deltaTime);

      // Handle dead NPC body addition
      if (npc.isDeath && npc.isBodyIniAdded === 0) {
        npc.isBodyIniAdded = 1;

        // Add body object only if valid and not a special death or summoned NPC
        // C#: if (npc.IsBodyIniOk && !npc.IsNodAddBody && npc.SummonedByMagicSprite == null)
        const isSummoned = npc.summonedByMagicSprite !== null;
        if (npc.isBodyIniOk && !npc.notAddBody && !isSummoned && objManager) {
          const bodyObj = npc.bodyIniObj!;
          bodyObj.positionInWorld = { ...npc.positionInWorld };
          bodyObj.currentDirection = npc.currentDirection;

          if (npc.reviveMilliseconds > 0) {
            bodyObj.isRemoved = false;
            bodyObj.millisecondsToRemove = npc.leftMillisecondsToRevive;
          }

          // C#: ObjManager.AddObj(npc.BodyIni) - 直接添加到列表
          objManager.addObj(bodyObj);
          logger.log(`[NpcManager] Added body object for dead NPC: ${npc.name}`);
        }

        // C#: ObjManager.AddObj(GoodDrop.GetDropObj(npc)) - 掉落物品
        // 注意：C# 中掉落逻辑不检查是否为召唤 NPC，所有满足条件的 NPC 都可以掉落
        // GoodDrop.GetDropObj 内部会检查 IsEnemy 和 NoDropWhenDie
        const dropCharacter: DropCharacter = {
          name: npc.name,
          level: npc.level,
          tilePosition: { ...npc.tilePosition },
          isEnemy: npc.isEnemy,
          expBonus: npc.expBonus,
          noDropWhenDie: npc.noDropWhenDie,
          dropIni: npc.dropIni,
        };

        // 异步获取掉落物品并添加到场景
        // 使用 void 操作符表明我们有意不等待这个 Promise
        void getDropObj(dropCharacter, isDropEnabled).then((dropObj) => {
          if (dropObj && objManager) {
            objManager.addObj(dropObj);
          }
        });

        // C#: if (npc.ReviveMilliseconds == 0) { DeleteNpc(node); }
        // Remove NPC if no revive time
        if (npc.reviveMilliseconds === 0) {
          npcsToDelete.push(id);
        }
      }
    }

    // Delete NPCs marked for removal (must be done after iteration)
    for (const id of npcsToDelete) {
      this.npcs.delete(id);
      logger.log(`[NpcManager] Removed dead NPC with id: ${id}`);
    }

    // C#: Update death infos - decrease leftFrameToKeep and remove expired entries
    // Used for CheckKeepDistanceWhenFriendDeath AI behavior
    for (let i = this._deathInfos.length - 1; i >= 0; i--) {
      this._deathInfos[i].leftFrameToKeep--;
      if (this._deathInfos[i].leftFrameToKeep <= 0) {
        this._deathInfos.splice(i, 1);
      }
    }
  }

  /**
   * Get visible NPCs in area
   */
  getVisibleNpcs(centerX: number, centerY: number, radius: number): Npc[] {
    const result: Npc[] = [];
    for (const [, npc] of this.npcs) {
      if (!npc.isVisible) continue;
      const npcPos = { x: npc.positionInWorld.x, y: npc.positionInWorld.y };
      const dist = distance({ x: centerX, y: centerY }, npcPos);
      if (dist <= radius) {
        result.push(npc);
      }
    }
    return result;
  }

  /**
   * Get all partner NPCs
   * C#: NpcManager.GetAllPartner()
   */
  getAllPartners(): Npc[] {
    const partners: Npc[] = [];
    for (const [, npc] of this.npcs) {
      if (npc.isPartner) {
        partners.push(npc);
      }
    }
    return partners;
  }

  /**
   * Move all partners to destination
   * C#: NpcManager.PartnersMoveTo(destinationTilePosition)
   */
  partnersMoveTo(destinationTilePosition: Vector2): void {
    const partners = this.getAllPartners();
    for (const partner of partners) {
      if (partner.isStanding()) {
        partner.partnerMoveTo(destinationTilePosition);
      }
    }
  }

  /**
   * Execute action for each partner
   * C#: NpcManager.ForEachPartner(Action<Character> action)
   */
  forEachPartner(action: (partner: Npc) => void): void {
    for (const [, npc] of this.npcs) {
      if (npc.isPartner) {
        action(npc);
      }
    }
  }

  /**
   * Clear follow target for all NPCs if equal to target
   * C#: NpcManager.CleartFollowTargetIfEqual(target)
   */
  clearFollowTargetIfEqual(target: Character): void {
    for (const [, npc] of this.npcs) {
      if (npc.followTarget === target) {
        npc.clearFollowTarget();
      }
    }
  }

  /**
   * Disable AI for NPC (used in cutscenes)
   */
  disableNpcAI(name: string): void {
    const npc = this.getNpc(name);
    if (npc) {
      npc.isAIDisabled = true;
    }
  }

  /**
   * Enable AI for NPC
   */
  enableNpcAI(name: string): void {
    const npc = this.getNpc(name);
    if (npc) {
      npc.isAIDisabled = false;
    }
  }

  /**
   * Hide NPC
   */
  hideNpc(name: string): void {
    const npc = this.getNpc(name);
    if (npc) {
      npc.isVisible = false;
    }
  }

  /**
   * Show/Hide NPC by name
   * C#: NpcManager.ShowNpc - sets IsHide property
   * Also checks player name for consistency with C# implementation
   */
  showNpc(name: string, show: boolean = true): void {
    // C#: First check if name matches player
    if (this._player && this._player.name === name) {
      this._player.isHide = !show;
      return;
    }
    // Then check NPCs
    const npc = this.getNpc(name);
    if (npc) {
      npc.isHide = !show;
    }
  }

  /**
   * Set NPC script file
   * C#: SetNpcScript - Sets the ScriptFile property for interaction
   */
  setNpcScript(name: string, scriptFile: string): void {
    const npc = this.getNpc(name);
    if (npc) {
      npc.scriptFile = scriptFile;
      logger.log(`[NpcManager] Set script for ${name}: ${scriptFile}`);
    } else {
      logger.warn(`[NpcManager] NPC not found for SetNpcScript: ${name}`);
    }
  }

  /**
   * Merge NPC file without clearing existing NPCs
   * C#: NpcManager.Merge - calls Load with clearCurrentNpcs=false
   */
  async mergeNpc(fileName: string): Promise<void> {
    logger.log(`[NpcManager] Merging NPC file: ${fileName}`);
    await this.loadNpcFileInternal(fileName, false);
  }

  /**
   * Save NPC state to file
   * C#: NpcManager.SaveNpc - saves current NPCs to save file
   * Note: Web version uses localStorage/IndexedDB instead of file system
   */
  async saveNpc(fileName?: string): Promise<void> {
    const saveFileName = fileName || this.fileName;
    if (!saveFileName) {
      logger.warn("[NpcManager] SaveNpc: No file name provided and no file loaded");
      return;
    }
    logger.log(`[NpcManager] SaveNpc: ${saveFileName} (stub - save system integration needed)`);
    // TODO: Integrate with save system when implemented
    // For now, this is a stub that logs the action
  }

  /**
   * Set NPC action file for a specific state
   * Based on Character.SetNpcActionFile() in C#
   * This sets the ASF file for a specific character state
   */
  setNpcActionFile(name: string, stateType: number, asfFile: string): boolean {
    const npc = this.getNpc(name);
    if (!npc) {
      logger.warn(`[NpcManager] NPC not found: ${name}`);
      return false;
    }

    // Check if this is the first time setting custom ASF for this state
    const isFirstTimeSet =
      !npc.customActionFiles.has(stateType) || !(npc as any)._customAsfCache?.has(stateType);

    // Use Npc class method directly
    npc.setNpcActionFile(stateType, asfFile);

    // Preload the ASF file
    npc
      .preloadCustomActionFile(stateType, asfFile)
      .then(() => {
        // Only update texture immediately if:
        // 1. This is the first time setting custom ASF for this state
        // 2. Current state matches the one we just loaded
        if (isFirstTimeSet && npc.state === stateType) {
          (npc as any)._updateTextureForState(stateType);
        }
      })
      .catch((err: any) => logger.error(`Failed to preload custom action file:`, err));

    return true;
  }

  /**
   * Get custom action file for NPC state
   */
  getNpcActionFile(name: string, stateType: number): string | null {
    const npc = this.getNpc(name);
    if (!npc) return null;
    return npc.getCustomActionFile(stateType) || null;
  }

  /**
   * Set NPC action type
   * Based on Character.SetNpcActionType() in C#
   */
  setNpcActionType(name: string, actionType: number): boolean {
    const npc = this.getNpc(name);
    if (!npc) return false;

    npc.actionType = actionType;
    return true;
  }

  /**
   * Set NPC level
   */
  setNpcLevel(name: string, level: number): boolean {
    const npc = this.getNpc(name);
    if (!npc) return false;

    npc.level = level;
    return true;
  }

  /**
   * Kill all enemy NPCs (for debug/cheat system)
   * Uses normal death() method to ensure death scripts are triggered
   * C# Reference: 通过调用正常死亡流程触发 DeathScript
   * Returns the number of enemies killed
   */
  killAllEnemies(): number {
    let killed = 0;

    for (const [, npc] of this.npcs) {
      // Check if NPC is an enemy (Fighter kind or Flyer, with enemy relation)
      // Skip already dead/dying NPCs
      if (
        (npc.kind === CharacterKind.Fighter || npc.kind === CharacterKind.Flyer) &&
        npc.isEnemy &&
        !npc.isDeathInvoked &&
        !npc.isDeath
      ) {
        // Call normal death method to trigger death scripts
        // C#: Character.Death() - 设置状态，运行死亡脚本，播放动画
        npc.death();
        killed++;
      }
    }

    logger.log(`[NpcManager] Killed ${killed} enemies (via death method)`);
    return killed;
  }

  /**
   * Set NPC direction
   */
  setNpcDirection(name: string, direction: number): boolean {
    const npc = this.getNpc(name);
    if (!npc) return false;

    npc.currentDirection = direction;
    return true;
  }

  /**
   * Set NPC state
   */
  setNpcState(name: string, state: number): boolean {
    const npc = this.getNpc(name);
    if (!npc) return false;

    npc.state = state as CharacterState;
    return true;
  }

  /**
   * Set NPC relation
   * Based on C# SetNpcRelation(name, relation) where relation is 0=Friend, 1=Enemy, 2=None
   * C#: GetPlayerAndAllNpcs changes relation for ALL NPCs with the same name
   */
  setNpcRelation(name: string, relation: number): boolean {
    const npcs = this.getAllNpcsByName(name);
    if (npcs.length === 0) {
      logger.warn(`[NpcManager] SetNpcRelation: NPC not found: ${name}`);
      return false;
    }

    const relationNames = ["Friend", "Enemy", "None"];
    for (const npc of npcs) {
      logger.log(
        `[NpcManager] SetNpcRelation: ${name} (id=${npc.id}) relation changed from ${relationNames[npc.relation] || npc.relation} to ${relationNames[relation] || relation}`
      );
      npc.setRelation(relation);
    }
    return true;
  }

  /**
   * Enable global NPC AI
   */
  enableGlobalAI(): void {
    logger.log("[NpcManager] Enabling global NPC AI");
    enableGlobalAI();
    // Also clear follow targets when enabling AI (fresh start)
    for (const [, _npc] of this.npcs) {
      // NPCs will find new targets in their next update
    }
  }

  /**
   * Disable global NPC AI
   */
  disableGlobalAI(): void {
    logger.log("[NpcManager] Disabling global NPC AI");
    disableGlobalAI();
    this.cancelFighterAttacking();
  }

  /**
   * Load NPCs from a .npc file
   * Based on C#'s NpcManager.Load and Utils.GetNpcObjFilePath
   * Uses unified resourceLoader for text data fetching
   *
   * @param fileName - The NPC file name (e.g., "wudangshanxia.npc")
   * @param clearCurrentNpcs - Whether to clear existing NPCs (default: true)
   */
  async loadNpcFile(fileName: string, clearCurrentNpcs: boolean = true): Promise<boolean> {
    return this.loadNpcFileInternal(fileName, clearCurrentNpcs);
  }

  /**
   * Internal method to load NPC file with clear option
   * C#: NpcManager.Load(fileName, clearCurrentNpcs, randOne)
   */
  private async loadNpcFileInternal(fileName: string, clearCurrentNpcs: boolean): Promise<boolean> {
    logger.log(`[NpcManager] Loading NPC file: ${fileName} (clear=${clearCurrentNpcs})`);

    // Try multiple paths like C# GetNpcObjFilePath
    const paths = [ResourcePath.saveGame(fileName), ResourcePath.iniSave(fileName)];

    for (const filePath of paths) {
      try {
        // .npc files have been converted to UTF-8
        // resourceLoader.loadText handles Vite HTML fallback detection
        const content = await resourceLoader.loadText(filePath);

        if (!content) {
          continue;
        }

        // Clear existing NPCs if requested (keep partners like C#)
        if (clearCurrentNpcs) {
          this.clearAllNpcAndKeepPartner();
        }

        logger.log(`[NpcManager] Parsing NPC file from: ${filePath}`);
        await this.parseNpcFile(content);
        this.fileName = fileName; // Store loaded file name like C#
        logger.log(`[NpcManager] Loaded ${this.npcs.size} NPCs from ${fileName}`);
        return true;
      } catch (_error) {
        // Continue to next path
      }
    }

    logger.error(`[NpcManager] Failed to load NPC file: ${fileName} (tried all paths)`);
    return false;
  }

  /**
   * Parse NPC file content
   */
  private async parseNpcFile(content: string): Promise<void> {
    const sections = parseIni(content);

    const loadPromises: Promise<void>[] = [];

    for (const sectionName in sections) {
      // Match NPC followed by digits (e.g., NPC000, NPC001, etc.)
      if (/^NPC\d+$/i.test(sectionName)) {
        const section = sections[sectionName];
        const promise = this.createNpcFromData(section).then(() => {});
        loadPromises.push(promise);
      }
    }

    await Promise.all(loadPromises);
  }

  /**
   * NPC 数据结构（统一的加载格式）
   * C# Reference: Character.Load(KeyDataCollection) - 通用加载方法
   *
   * 这个接口同时支持：
   * 1. .npc 文件加载（INI 格式，解析后变成 Record<string, string>）
   * 2. JSON 存档加载（完整类型的对象）
   */
  private parseNpcData(data: Record<string, any>): {
    config: CharacterConfig;
    extraState: {
      // 基本状态
      state?: number;
      action: number;
      isVisible: boolean;
      isAIDisabled: boolean;

      // 死亡/复活
      isDeath: boolean;
      isDeathInvoked: boolean;
      invincible: number;
      reviveMilliseconds: number;
      leftMillisecondsToRevive: number;

      // 脚本
      scriptFileRight?: string;
      timerScriptFile?: string;
      timerScriptInterval?: number;

      // 配置
      dropIni?: string;
      buyIniFile?: string;
      buyIniString?: string;
      actionPathTilePositions?: Array<{ x: number; y: number }>;

      // 属性 (存档专用)
      attack3: number;
      defend3: number;
      canLevelUp: number;

      // 位置相关
      currentFixedPosIndex: number;
      destinationMapPosX: number;
      destinationMapPosY: number;

      // INI 文件
      isBodyIniAdded: number;

      // 状态效果
      poisonSeconds: number;
      poisonByCharacterName?: string;
      petrifiedSeconds: number;
      frozenSeconds: number;
      isPoisonVisualEffect: boolean;
      isPetrifiedVisualEffect: boolean;
      isFrozenVisualEffect: boolean;

      // 装备
      canEquip: number;
      headEquip?: string;
      neckEquip?: string;
      bodyEquip?: string;
      backEquip?: string;
      handEquip?: string;
      wristEquip?: string;
      footEquip?: string;
      backgroundTextureEquip?: string;

      // 保持攻击位置
      keepAttackX: number;
      keepAttackY: number;

      // 等级配置
      levelIniFile?: string;
    };
    mapX: number;
    mapY: number;
    dir: number;
  } {
    // 辅助函数：解析数字，兼容 string 和 number
    const parseNum = (val: any, def: number): number => {
      if (val === undefined || val === null || val === "") return def;
      return typeof val === "number" ? val : parseInt(val, 10);
    };
    const parseStr = (val: any, def: string = ""): string => {
      return val !== undefined && val !== null ? String(val) : def;
    };
    const parseBool = (val: any, def: boolean = false): boolean => {
      if (val === undefined || val === null) return def;
      if (typeof val === "boolean") return val;
      return val === "1" || val === "true" || val === 1;
    };

    // 基础信息
    const name = parseStr(data.Name ?? data.name);
    const npcIni = parseStr(data.NpcIni ?? data.npcIni);
    const mapX = parseNum(data.MapX ?? data.mapX, 0);
    const mapY = parseNum(data.MapY ?? data.mapY, 0);
    const dir = parseNum(data.Dir ?? data.dir, 4);
    const kind = parseNum(data.Kind ?? data.kind, 0);
    const relation = parseNum(data.Relation ?? data.relation, 0);
    const group = parseNum(data.Group ?? data.group, 0);
    const pathFinder = parseNum(data.PathFinder ?? data.pathFinder, 0);
    const action = parseNum(data.Action ?? data.action, 0);
    const noAutoAttackPlayer = parseNum(data.NoAutoAttackPlayer ?? data.noAutoAttackPlayer, 0);
    const idle = parseNum(data.Idle ?? data.idle, 0);

    // 属性
    const walkSpeed = parseNum(data.WalkSpeed ?? data.walkSpeed, 1);
    const addMoveSpeedPercent = parseNum(data.AddMoveSpeedPercent ?? data.addMoveSpeedPercent, 0);
    const dialogRadius = parseNum(data.DialogRadius ?? data.dialogRadius, 1);
    const visionRadius = parseNum(data.VisionRadius ?? data.visionRadius, 10);
    const attackRadius = parseNum(data.AttackRadius ?? data.attackRadius, 1);

    // 战斗属性
    const life = parseNum(data.Life ?? data.life, 100);
    const lifeMax = parseNum(data.LifeMax ?? data.lifeMax, 100);
    const mana = parseNum(data.Mana ?? data.mana, 100);
    const manaMax = parseNum(data.ManaMax ?? data.manaMax, 100);
    const thew = parseNum(data.Thew ?? data.thew, 100);
    const thewMax = parseNum(data.ThewMax ?? data.thewMax, 100);
    const attack = parseNum(data.Attack ?? data.attack, 10);
    const attack2 = parseNum(data.Attack2 ?? data.attack2, 0);
    const attackLevel = parseNum(data.AttackLevel ?? data.attackLevel, 0);
    // C#: Defence is alias for Defend
    const defend = parseNum(data.Defend ?? data.defend ?? data.Defence ?? data.defence, 10);
    const defend2 = parseNum(data.Defend2 ?? data.defend2, 0);
    const evade = parseNum(data.Evade ?? data.evade, 0);
    const level = parseNum(data.Level ?? data.level, 1);
    const exp = parseNum(data.Exp ?? data.exp, 0);
    const levelUpExp = parseNum(data.LevelUpExp ?? data.levelUpExp, 100);
    const expBonus = parseNum(data.ExpBonus ?? data.expBonus, 0); // C#: ExpBonus - Boss判断
    const lum = parseNum(data.Lum ?? data.lum, 0);

    // 脚本和资源
    const scriptFile = parseStr(data.ScriptFile ?? data.scriptFile);
    const scriptFileRight = parseStr(data.ScriptFileRight ?? data.scriptFileRight);
    const deathScript = parseStr(data.DeathScript ?? data.deathScript);
    const bodyIni = parseStr(data.BodyIni ?? data.bodyIni);
    const flyIni = parseStr(data.FlyIni ?? data.flyIni);
    const flyIni2 = parseStr(data.FlyIni2 ?? data.flyIni2);
    const flyInis = parseStr(data.FlyInis ?? data.flyInis);

    // 状态（只有 JSON 存档才有）
    const state = data.state !== undefined ? parseNum(data.state, 0) : undefined;
    const isVisible = parseBool(data.isVisible, true);
    const isAIDisabled = parseBool(data.isAIDisabled, false);
    const isDeath = parseBool(data.isDeath, false);
    const isDeathInvoked = parseBool(data.isDeathInvoked, false);
    const invincible = parseNum(data.invincible ?? data.Invincible, 0);
    const reviveMilliseconds = parseNum(data.reviveMilliseconds ?? data.ReviveMilliseconds, 0);
    const leftMillisecondsToRevive = parseNum(
      data.leftMillisecondsToRevive ?? data.LeftMillisecondsToRevive,
      0
    );

    // 额外属性（只有 JSON 存档才有）
    const timerScriptFile = parseStr(data.timerScriptFile ?? data.TimerScriptFile);
    const timerScriptInterval = data.timerScriptInterval ?? data.TimerScriptInterval;
    const dropIni = parseStr(data.dropIni ?? data.DropIni);
    const buyIniFile = parseStr(data.buyIniFile ?? data.BuyIniFile);
    const actionPathTilePositions = data.actionPathTilePositions;

    // === AI 相关字段 ===
    const aiType = parseNum(data.AIType ?? data.aiType, 0);
    const keepRadiusWhenLifeLow = parseNum(
      data.KeepRadiusWhenLifeLow ?? data.keepRadiusWhenLifeLow,
      0
    );
    const lifeLowPercent = parseNum(data.LifeLowPercent ?? data.lifeLowPercent, 20);
    const stopFindingTarget = parseNum(data.StopFindingTarget ?? data.stopFindingTarget, 0);
    const keepRadiusWhenFriendDeath = parseNum(
      data.KeepRadiusWhenFriendDeath ?? data.keepRadiusWhenFriendDeath,
      0
    );

    // === Hurt Player (接触伤害) ===
    const hurtPlayerInterval = parseNum(data.HurtPlayerInterval ?? data.hurtPlayerInterval, 0);
    const hurtPlayerLife = parseNum(data.HurtPlayerLife ?? data.hurtPlayerLife, 0);
    const hurtPlayerRadius = parseNum(data.HurtPlayerRadius ?? data.hurtPlayerRadius, 0);

    // === Magic Direction ===
    const magicDirectionWhenBeAttacked = parseNum(
      data.MagicDirectionWhenBeAttacked ?? data.magicDirectionWhenBeAttacked,
      0
    );
    const magicDirectionWhenDeath = parseNum(
      data.MagicDirectionWhenDeath ?? data.magicDirectionWhenDeath,
      0
    );

    // === Visibility Control ===
    const fixedPos = parseStr(data.FixedPos ?? data.fixedPos);
    const visibleVariableName = parseStr(data.VisibleVariableName ?? data.visibleVariableName);
    const visibleVariableValue = parseNum(
      data.VisibleVariableValue ?? data.visibleVariableValue,
      0
    );

    // === Auto Magic ===
    const magicToUseWhenLifeLow = parseStr(
      data.MagicToUseWhenLifeLow ?? data.magicToUseWhenLifeLow
    );
    const magicToUseWhenBeAttacked = parseStr(
      data.MagicToUseWhenBeAttacked ?? data.magicToUseWhenBeAttacked
    );
    const magicToUseWhenDeath = parseStr(data.MagicToUseWhenDeath ?? data.magicToUseWhenDeath);

    // === Drop Control ===
    const noDropWhenDie = parseNum(data.NoDropWhenDie ?? data.noDropWhenDie, 0);

    const config: CharacterConfig = {
      name,
      npcIni,
      kind: kind as any,
      relation: relation as any,
      group,
      noAutoAttackPlayer,
      scriptFile: scriptFile || undefined,
      scriptFileRight: scriptFileRight || undefined,
      deathScript: deathScript || undefined,
      bodyIni: bodyIni || undefined,
      flyIni: flyIni || undefined,
      flyIni2: flyIni2 || undefined,
      flyInis: flyInis || undefined,
      idle,
      expBonus, // C#: ExpBonus - Boss判断（>0为Boss）
      // === AI/Combat Fields ===
      dropIni: dropIni || undefined,
      buyIniFile: buyIniFile || undefined,
      keepRadiusWhenLifeLow,
      lifeLowPercent,
      stopFindingTarget,
      keepRadiusWhenFriendDeath,
      aiType,
      invincible,
      reviveMilliseconds,
      // === Hurt Player ===
      hurtPlayerInterval,
      hurtPlayerLife,
      hurtPlayerRadius,
      // === Magic Direction ===
      magicDirectionWhenBeAttacked,
      magicDirectionWhenDeath,
      // === Visibility Control ===
      fixedPos: fixedPos || undefined,
      visibleVariableName: visibleVariableName || undefined,
      visibleVariableValue,
      // === Auto Magic ===
      magicToUseWhenLifeLow: magicToUseWhenLifeLow || undefined,
      magicToUseWhenBeAttacked: magicToUseWhenBeAttacked || undefined,
      magicToUseWhenDeath: magicToUseWhenDeath || undefined,
      // === Drop Control ===
      noDropWhenDie,
      stats: {
        life,
        lifeMax,
        mana,
        manaMax,
        thew,
        thewMax,
        attack,
        attack2,
        attack3: 0,
        attackLevel,
        defend,
        defend2,
        defend3: 0,
        evade,
        exp,
        levelUpExp,
        level,
        canLevelUp: 0,
        walkSpeed,
        addMoveSpeedPercent,
        visionRadius,
        attackRadius,
        dialogRadius,
        lum,
        action,
      },
      pathFinder,
    };

    // 解析更多存档专用字段
    const attack3 = parseNum(data.Attack3 ?? data.attack3, 0);
    const defend3 = parseNum(data.Defend3 ?? data.defend3, 0);
    const canLevelUp = parseNum(data.CanLevelUp ?? data.canLevelUp, 0);
    const currentFixedPosIndex = parseNum(data.CurrentFixedPosIndex ?? data.currentFixedPosIndex, 0);
    const destinationMapPosX = parseNum(data.DestinationMapPosX ?? data.destinationMapPosX, 0);
    const destinationMapPosY = parseNum(data.DestinationMapPosY ?? data.destinationMapPosY, 0);
    const isBodyIniAdded = parseNum(data.IsBodyIniAdded ?? data.isBodyIniAdded, 0);
    const poisonSeconds = parseNum(data.PoisonSeconds ?? data.poisonSeconds, 0);
    const poisonByCharacterName = parseStr(data.PoisonByCharacterName ?? data.poisonByCharacterName);
    const petrifiedSeconds = parseNum(data.PetrifiedSeconds ?? data.petrifiedSeconds, 0);
    const frozenSeconds = parseNum(data.FrozenSeconds ?? data.frozenSeconds, 0);
    const isPoisonVisualEffect = parseBool(data.IsPoisonVisualEffect ?? data.isPoisonVisualEffect, false);
    const isPetrifiedVisualEffect = parseBool(data.IsPetrifiedVisualEffect ?? data.isPetrifiedVisualEffect, false);
    const isFrozenVisualEffect = parseBool(data.IsFrozenVisualEffect ?? data.isFrozenVisualEffect, false);
    const buyIniString = parseStr(data.BuyIniString ?? data.buyIniString);
    const canEquip = parseNum(data.CanEquip ?? data.canEquip, 0);
    const headEquip = parseStr(data.HeadEquip ?? data.headEquip);
    const neckEquip = parseStr(data.NeckEquip ?? data.neckEquip);
    const bodyEquip = parseStr(data.BodyEquip ?? data.bodyEquip);
    const backEquip = parseStr(data.BackEquip ?? data.backEquip);
    const handEquip = parseStr(data.HandEquip ?? data.handEquip);
    const wristEquip = parseStr(data.WristEquip ?? data.wristEquip);
    const footEquip = parseStr(data.FootEquip ?? data.footEquip);
    const backgroundTextureEquip = parseStr(data.BackgroundTextureEquip ?? data.backgroundTextureEquip);
    const keepAttackX = parseNum(data.KeepAttackX ?? data.keepAttackX, 0);
    const keepAttackY = parseNum(data.KeepAttackY ?? data.keepAttackY, 0);
    const levelIniFile = parseStr(data.LevelIni ?? data.LevelIniFile ?? data.levelIniFile);

    return {
      config,
      extraState: {
        // 基本状态
        state,
        action,
        isVisible,
        isAIDisabled,

        // 死亡/复活
        isDeath,
        isDeathInvoked,
        invincible,
        reviveMilliseconds,
        leftMillisecondsToRevive,

        // 脚本
        scriptFileRight: scriptFileRight || undefined,
        timerScriptFile: timerScriptFile || undefined,
        timerScriptInterval,

        // 配置
        dropIni: dropIni || undefined,
        buyIniFile: buyIniFile || undefined,
        buyIniString: buyIniString || undefined,
        actionPathTilePositions,

        // 属性 (存档专用)
        attack3,
        defend3,
        canLevelUp,

        // 位置相关
        currentFixedPosIndex,
        destinationMapPosX,
        destinationMapPosY,

        // INI 文件
        isBodyIniAdded,

        // 状态效果
        poisonSeconds,
        poisonByCharacterName: poisonByCharacterName || undefined,
        petrifiedSeconds,
        frozenSeconds,
        isPoisonVisualEffect,
        isPetrifiedVisualEffect,
        isFrozenVisualEffect,

        // 装备
        canEquip,
        headEquip: headEquip || undefined,
        neckEquip: neckEquip || undefined,
        bodyEquip: bodyEquip || undefined,
        backEquip: backEquip || undefined,
        handEquip: handEquip || undefined,
        wristEquip: wristEquip || undefined,
        footEquip: footEquip || undefined,
        backgroundTextureEquip: backgroundTextureEquip || undefined,

        // 保持攻击位置
        keepAttackX,
        keepAttackY,

        // 等级配置
        levelIniFile: levelIniFile || undefined,
      },
      mapX,
      mapY,
      dir,
    };
  }

  /**
   * Create NPC from data object (统一的 NPC 创建方法)
   * C# Reference: NpcManager.AddNpc(KeyDataCollection) + Character.Load()
   *
   * 同时支持：
   * 1. .npc 文件加载（INI Section 解析后的 Record<string, string>）
   * 2. JSON 存档加载（完整类型的对象）
   *
   * C# 逻辑：有什么字段就读什么字段，不区分来源
   */
  async createNpcFromData(data: Record<string, any>): Promise<Npc | null> {
    const { config, extraState, mapX, mapY, dir } = this.parseNpcData(data);

    // Skip dead NPCs that have been fully removed
    if (extraState.isDeath && extraState.isDeathInvoked) {
      logger.log(`[NpcManager] Skipping dead NPC: ${config.name}`);
      return null;
    }

    // Create NPC with config
    const npc = this.addNpcWithConfig(config, mapX, mapY, dir as any);

    // === 基本状态 ===
    npc.actionType = extraState.action;
    npc.isVisible = extraState.isVisible;
    npc.isAIDisabled = extraState.isAIDisabled;
    if (extraState.state !== undefined) {
      npc.state = extraState.state;
    }

    // === 死亡/复活 ===
    npc.isDeath = extraState.isDeath;
    npc.isDeathInvoked = extraState.isDeathInvoked;
    npc.invincible = extraState.invincible;
    npc.reviveMilliseconds = extraState.reviveMilliseconds;
    npc.leftMillisecondsToRevive = extraState.leftMillisecondsToRevive;

    // === 脚本 ===
    if (extraState.scriptFileRight) {
      npc.scriptFileRight = extraState.scriptFileRight;
    }
    if (extraState.timerScriptFile) {
      npc.timerScript = extraState.timerScriptFile;
    }
    if (extraState.timerScriptInterval !== undefined) {
      npc.timerInterval = extraState.timerScriptInterval;
    }

    // === 配置 ===
    if (extraState.dropIni) npc.dropIni = extraState.dropIni;
    if (extraState.buyIniFile) npc.buyIniFile = extraState.buyIniFile;
    if (extraState.buyIniString) npc.buyIniString = extraState.buyIniString;
    if (extraState.actionPathTilePositions && extraState.actionPathTilePositions.length > 0) {
      npc.actionPathTilePositions = extraState.actionPathTilePositions.map((p) => ({
        x: p.x,
        y: p.y,
      }));
    }

    // === 属性 (存档专用) ===
    if (extraState.attack3) npc.attack3 = extraState.attack3;
    if (extraState.defend3) npc.defend3 = extraState.defend3;
    if (extraState.canLevelUp) npc.canLevelUp = extraState.canLevelUp;

    // === 位置相关 ===
    if (extraState.currentFixedPosIndex) npc.currentFixedPosIndex = extraState.currentFixedPosIndex;
    // destinationMapPosX/Y 通常不需要恢复，因为重新加载时 NPC 会重新计算目标

    // === INI 文件 ===
    if (extraState.isBodyIniAdded) npc.isBodyIniAdded = extraState.isBodyIniAdded;

    // === 状态效果 ===
    if (extraState.poisonSeconds) npc.poisonSeconds = extraState.poisonSeconds;
    if (extraState.poisonByCharacterName) npc.poisonByCharacterName = extraState.poisonByCharacterName;
    if (extraState.petrifiedSeconds) npc.petrifiedSeconds = extraState.petrifiedSeconds;
    if (extraState.frozenSeconds) npc.frozenSeconds = extraState.frozenSeconds;
    if (extraState.isPoisonVisualEffect) npc.isPoisonVisualEffect = extraState.isPoisonVisualEffect;
    if (extraState.isPetrifiedVisualEffect) npc.isPetrifiedVisualEffect = extraState.isPetrifiedVisualEffect;
    if (extraState.isFrozenVisualEffect) npc.isFrozenVisualEffect = extraState.isFrozenVisualEffect;

    // === 装备 ===
    if (extraState.canEquip) npc.canEquip = extraState.canEquip;
    if (extraState.headEquip) npc.headEquip = extraState.headEquip;
    if (extraState.neckEquip) npc.neckEquip = extraState.neckEquip;
    if (extraState.bodyEquip) npc.bodyEquip = extraState.bodyEquip;
    if (extraState.backEquip) npc.backEquip = extraState.backEquip;
    if (extraState.handEquip) npc.handEquip = extraState.handEquip;
    if (extraState.wristEquip) npc.wristEquip = extraState.wristEquip;
    if (extraState.footEquip) npc.footEquip = extraState.footEquip;
    if (extraState.backgroundTextureEquip) npc.backgroundTextureEquip = extraState.backgroundTextureEquip;

    // === 保持攻击位置 ===
    if (extraState.keepAttackX) npc.keepAttackX = extraState.keepAttackX;
    if (extraState.keepAttackY) npc.keepAttackY = extraState.keepAttackY;

    // === 等级配置 ===
    if (extraState.levelIniFile) {
      await npc.levelManager.setLevelFile(extraState.levelIniFile);
    }

    logger.log(
      `[NpcManager] Created NPC: ${config.name} at (${mapX}, ${mapY}), npcIni=${config.npcIni}`
    );
    return npc;
  }

  /**
   * Set file name (用于从 JSON 存档加载时设置)
   */
  setFileName(fileName: string): void {
    this.fileName = fileName;
  }

  // ============== AI Query Methods ==============
  // Based on C# NpcManager.cs AI-related static methods

  /**
   * Get closest enemy type character
   * Based on C# NpcManager.GetClosestEnemyTypeCharacter
   */
  getClosestEnemyTypeCharacter(
    positionInWorld: Position,
    withNeutral: boolean = false,
    withInvisible: boolean = false,
    ignoreList: Character[] | null = null
  ): Character | null {
    let closest: Character | null = null;
    let closestDistance = 99999999;

    for (const [, npc] of this.npcs) {
      // Check ignore list
      if (ignoreList?.some((item) => item === npc)) continue;
      // Check visibility
      if (!withInvisible && !npc.isVisible) continue;
      // Check if enemy or neutral fighter
      if (!npc.isEnemy && !(withNeutral && npc.isNoneFighter)) continue;
      // Check if dead
      if (npc.isDeathInvoked) continue;

      const dist = distance(positionInWorld, npc.positionInWorld);
      if (dist < closestDistance) {
        closest = npc;
        closestDistance = dist;
      }
    }

    return closest;
  }

  /**
   * Get closest enemy based on finder's relation
   * Based on C# NpcManager.GetClosestEnemy
   */
  getClosestEnemy(
    finder: Character,
    targetPositionInWorld: Position,
    withNeutral: boolean = false,
    withInvisible: boolean = false,
    ignoreList: Character[] | null = null
  ): Character | null {
    if (!finder) return null;

    if (finder.isEnemy) {
      // Enemy finds player or fighter friends
      let target = this.getLiveClosestPlayerOrFighterFriend(
        targetPositionInWorld,
        withNeutral,
        withInvisible,
        ignoreList
      );
      if (!target) {
        target = this.getLiveClosestOtherGroupEnemy(finder.group, targetPositionInWorld);
      }
      return target;
    }

    if (finder.isPlayer || finder.isFighterFriend) {
      return this.getClosestEnemyTypeCharacter(
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
   * Based on C# NpcManager.GetLiveClosestOtherGropEnemy
   */
  getLiveClosestOtherGroupEnemy(group: number, positionInWorld: Position): Character | null {
    let closest: Character | null = null;
    let closestDistance = 99999999;

    for (const [, npc] of this.npcs) {
      if (npc.group !== group && npc.isVisible && npc.isEnemy) {
        if (npc.isDeathInvoked) continue;
        const dist = distance(positionInWorld, npc.positionInWorld);
        if (dist < closestDistance) {
          closest = npc;
          closestDistance = dist;
        }
      }
    }

    return closest;
  }

  /**
   * Get closest player or fighter friend
   * Based on C# NpcManager.GetLiveClosestPlayerOrFighterFriend
   */
  getLiveClosestPlayerOrFighterFriend(
    positionInWorld: Position,
    withNeutral: boolean = false,
    withInvisible: boolean = false,
    ignoreList: Character[] | null = null
  ): Character | null {
    let closest: Character | null = null;
    let closestDistance = 99999999;

    for (const [, npc] of this.npcs) {
      // Check ignore list
      if (ignoreList?.some((item) => item === npc)) continue;
      // Check visibility
      if (!withInvisible && !npc.isVisible) continue;
      // Check if fighter friend or neutral non-fighter
      if (!npc.isFighterFriend && !(withNeutral && npc.isNoneFighter)) continue;
      // Check if dead
      if (npc.isDeathInvoked) continue;

      const dist = distance(positionInWorld, npc.positionInWorld);
      if (dist < closestDistance) {
        closest = npc;
        closestDistance = dist;
      }
    }

    // Also check player
    if (this._player) {
      if (ignoreList?.some((item) => item === this._player)) {
        // Player is in ignore list
      } else if (withInvisible || this._player.isVisible) {
        if (!this._player.isDeathInvoked) {
          const dist = distance(positionInWorld, this._player.positionInWorld);
          if (dist < closestDistance) {
            closest = this._player;
          }
        }
      }
    }

    return closest;
  }

  /**
   * Get closest non-neutral fighter
   * Based on C# NpcManager.GetLiveClosestNonneturalFighter
   */
  getLiveClosestNonNeutralFighter(
    positionInWorld: Position,
    ignoreList: Character[] | null = null
  ): Character | null {
    let closest: Character | null = null;
    let closestDistance = 99999999;

    for (const [, npc] of this.npcs) {
      // Check ignore list
      if (ignoreList?.some((item) => item === npc)) continue;
      // Check if fighter with non-neutral relation
      if (!npc.isFighter || npc.relation === RelationType.None) continue;
      // Check if dead
      if (npc.isDeathInvoked) continue;

      const dist = distance(positionInWorld, npc.positionInWorld);
      if (dist < closestDistance) {
        closest = npc;
        closestDistance = dist;
      }
    }

    // Also check player
    if (this._player) {
      if (ignoreList?.some((item) => item === this._player)) {
        // Player is in ignore list
      } else if (!this._player.isDeathInvoked) {
        const dist = distance(positionInWorld, this._player.positionInWorld);
        if (dist < closestDistance) {
          closest = this._player;
        }
      }
    }

    return closest;
  }

  /**
   * Get closest fighter
   * Based on C# NpcManager.GetClosestFighter
   */
  getClosestFighter(
    targetPositionInWorld: Position,
    ignoreList: Character[] | null = null
  ): Character | null {
    let closest: Character | null = null;
    let closestDistance = 99999999;

    for (const [, npc] of this.npcs) {
      // Check ignore list
      if (ignoreList?.some((item) => item === npc)) continue;
      // Check if fighter
      if (!npc.isFighter) continue;
      // Check if dead
      if (npc.isDeathInvoked) continue;

      const dist = distance(targetPositionInWorld, npc.positionInWorld);
      if (dist < closestDistance) {
        closest = npc;
        closestDistance = dist;
      }
    }

    // Also check player
    if (this._player && this._player.kind === CharacterKind.Player) {
      if (ignoreList?.some((item) => item === this._player)) {
        // Player is in ignore list
      } else if (!this._player.isDeathInvoked) {
        const dist = distance(targetPositionInWorld, this._player.positionInWorld);
        if (dist < closestDistance) {
          closest = this._player;
        }
      }
    }

    return closest;
  }

  /**
   * Find enemies within tile distance
   * Based on C# NpcManager.FindEnemiesInTileDistance
   */
  findEnemiesInTileDistance(
    finder: Character,
    beginTilePosition: Position,
    tileDistance: number
  ): Character[] {
    const enemies: Character[] = [];
    if (!finder || tileDistance < 1) return enemies;

    for (const [, npc] of this.npcs) {
      if (finder.isOpposite(npc)) {
        const viewDist = getViewTileDistance(beginTilePosition, npc.tilePosition);
        if (viewDist <= tileDistance) {
          enemies.push(npc);
        }
      }
    }

    // Check player
    if (this._player && finder.isOpposite(this._player)) {
      const viewDist = getViewTileDistance(beginTilePosition, this._player.tilePosition);
      if (viewDist <= tileDistance) {
        enemies.push(this._player);
      }
    }

    return enemies;
  }

  /**
   * Find fighters within tile distance
   * Based on C# NpcManager.FindFightersInTileDistance
   */
  findFightersInTileDistance(beginTilePosition: Position, tileDistance: number): Character[] {
    const fighters: Character[] = [];

    for (const [, npc] of this.npcs) {
      if (npc.isFighter) {
        const viewDist = getViewTileDistance(beginTilePosition, npc.tilePosition);
        if (viewDist <= tileDistance) {
          fighters.push(npc);
        }
      }
    }

    // Check player
    if (this._player && this._player.kind === CharacterKind.Player) {
      const viewDist = getViewTileDistance(beginTilePosition, this._player.tilePosition);
      if (viewDist <= tileDistance) {
        fighters.push(this._player);
      }
    }

    return fighters;
  }

  /**
   * Cancel all fighter attacking (used when global AI is disabled)
   * Based on C# NpcManager.CancelFighterAttacking
   */
  cancelFighterAttacking(): void {
    for (const [, npc] of this.npcs) {
      if (npc.isFighter) {
        npc.clearFollowTarget();
      }
    }
  }

  /**
   * Get all characters including player
   */
  getAllCharacters(): Character[] {
    const chars: Character[] = [...this.npcs.values()];
    if (this._player) {
      chars.push(this._player);
    }
    return chars;
  }
}
