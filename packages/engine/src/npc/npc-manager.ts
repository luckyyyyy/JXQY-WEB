/**
 * NPC 管理器
 * 管理所有 NPC 的创建、更新、查询
 */

import type { Character } from "../character";
import type { CharacterBase } from "../character/base";
import { loadNpcConfig } from "../character/res-loader";
import { resolveScriptPath } from "../resource/resource-paths";
import { EngineAccess } from "../core/engine-access";
import { logger } from "../core/logger";
import type { CharacterConfig, Vector2 } from "../core/types";
import { CharacterKind, type CharacterState, type Direction, RelationType } from "../core/types";
import { type DropCharacter, getDropObj } from "../player/goods/good-drop";

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
import { getGameSlug } from "../resource/resource-loader";
import type { NpcSaveItem } from "../storage/storage";
import { applyFlatDataToCharacter } from "../character/config-parser";
import { distance, getNeighbors, getViewTileDistance } from "../utils";
import { Npc } from "./npc";
import { collectNpcSnapshot, parseNpcData } from "./npc-persistence";
import { findCharactersInTileDistance, findClosestCharacter } from "./npc-queries";

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

/** NpcManager 类*/
export class NpcManager extends EngineAccess {
  // Internal storage uses Npc class instances
  private npcs: Map<string, Npc> = new Map();
  // Note: NPC config is loaded from API cache (npc-config-loader)
  // Store loaded NPC file name
  private fileName: string = "";

  /**
   * NPC 分组存储
   * 模拟 C# 原版的 save/game/{fileName} 文件系统
   * 脚本调用 SaveNpc() 时将当前 NPC 列表序列化存入，LoadNpc() 时优先从此读取
   * 存档时持久化到 localStorage，读档时恢复
   */
  private npcGroups: Map<string, NpcSaveItem[]> = new Map();

  // List of dead NPCs
  private _deadNpcs: Npc[] = [];

  // tracks recently dead characters for CheckKeepDistanceWhenFriendDeath
  private _deathInfos: DeathInfo[] = [];

  // === 全局 AI 控制 ===
  private _globalAIDisabled: boolean = false;

  /** 检查全局 AI 是否禁用 */
  get isGlobalAIDisabled(): boolean {
    return this._globalAIDisabled;
  }

  // === 性能优化：预计算视野内 NPC ===
  // NpcManager._npcInView, UpdateNpcsInView()
  // 在 Update 阶段预计算，Render 阶段直接使用，避免每帧重复遍历
  private _npcsInView: Npc[] = [];
  private _npcsByRow: Map<number, Npc[]> = new Map();

  /**
   * 获取 Player（通过 IEngineContext）
   */
  private get _player(): Character {
    return this.engine.player as unknown as Character;
  }

  /**
   * Run death script for an NPC (called from NPC.onDeath)
   * 使用 ScriptExecutor 的队列系统确保多个 NPC 同时死亡时脚本按顺序执行
   * -> ScriptManager.RunScript(DeathScript)
   */
  runDeathScript(scriptPath: string, npc: Npc): void {
    if (!scriptPath) return;

    const engine = this.engine;
    if (!engine) return;

    const basePath = engine.getScriptBasePath();
    const fullPath = resolveScriptPath(basePath, scriptPath);

    // 使用 ScriptExecutor 的队列系统
    logger.log(`[NpcManager] Queueing death script for ${npc.name}: ${fullPath}`);
    engine.queueScript(fullPath);
  }

  /**
   * Add NPC to dead list and death info
   * Used for CheckKeepDistanceWhenFriendDeath AI behavior
   */
  addDead(npc: Npc): void {
    if (!this._deadNpcs.includes(npc)) {
      this._deadNpcs.push(npc);
    }
    // DeathInfos.AddLast(new DeathInfo(dead, 2))
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
   *
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

      // Check if killed by a live character with MagicSprite
      // We check lastAttacker instead since we don't have MagicSprite system yet
      const lastAttacker = theDead.lastAttacker;
      if (!lastAttacker || lastAttacker.isDeathInvoked) {
        continue;
      }

      // Check if finder and dead are on same side
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
   * Reference: NpcManager.UpdateNpcsInView()
   * 同时按行分组，供交错渲染使用
   */
  updateNpcsInView(viewRect: ViewRect): void {
    // 清空上一帧的缓存
    this._npcsInView.length = 0;
    this._npcsByRow.clear();

    const viewRight = viewRect.x + viewRect.width;
    const viewBottom = viewRect.y + viewRect.height;

    for (const [, npc] of this.npcs) {
      // if (viewRegion.Intersects(npc.RegionInWorld))
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
   * property
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
   * Reference: NpcManager.GetNpcsInView()
   * Returns NPCs whose RegionInWorld intersects with viewRect
   * 注意：渲染时优先使用预计算的 npcsInView 和 getNpcsAtRow
   */
  getNpcsInView(viewRect: ViewRect): Npc[] {
    const result: Npc[] = [];
    const viewRight = viewRect.x + viewRect.width;
    const viewBottom = viewRect.y + viewRect.height;

    for (const [, npc] of this.npcs) {
      // if (viewRegion.Intersects(npc.RegionInWorld))
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
   * returns all NPCs with matching name
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
   * NpcManager.GetPlayerKindCharacter()
   * Returns the first NPC with CharacterKind.Player, or null
   */
  getPlayerKindCharacter(): Npc | null {
    for (const [, npc] of this.npcs) {
      if (npc.isPlayer) {
        return npc;
      }
    }
    return null;
  }

  /**
   * Add NPC from config file
   * Config is loaded from API cache (npc-config-loader)
   */
  async addNpc(
    configPath: string,
    tileX: number,
    tileY: number,
    direction: Direction = 4
  ): Promise<Npc | null> {
    // loadNpcConfig 从 API 缓存获取配置
    const config = await loadNpcConfig(configPath);

    if (!config) {
      // loadNpcConfig already logged the error, just return null
      return null;
    }

    const npc = Npc.fromConfig(config, tileX, tileY, direction);
    this.npcs.set(npc.id, npc);

    // NPC 通过 IEngineContext 获取 NpcManager、Player、MagicManager、AudioManager

    logger.log(
      `[NpcManager] Created NPC: ${config.name} at (${tileX}, ${tileY}), dir=${direction}, npcIni=${config.npcIni || "none"}`
    );

    // Auto-load sprites using Npc's own method (must await so appearance is ready)
    if (config.npcIni) {
      try {
        await npc.loadSpritesFromNpcIni(config.npcIni);
        logger.log(`[NpcManager] Sprites loaded for NPC ${config.name} from ${config.npcIni}`);
      } catch (err: unknown) {
        logger.warn(`[NpcManager] Failed to load sprites for NPC ${config?.name}:`, err);
      }
    } else {
      logger.warn(`[NpcManager] NPC ${config.name} has no npcIni, sprites not loaded`);
    }

    // Preload NPC magics (async, non-blocking)
    npc
      .loadAllMagics()
      .catch((err: unknown) =>
        logger.warn(`[NpcManager] Failed to preload magics for NPC ${config?.name}:`, err)
      );

    return npc;
  }

  /**
   * Add NPC with existing config
   */
  async addNpcWithConfig(
    config: CharacterConfig,
    tileX: number,
    tileY: number,
    direction: Direction = 4
  ): Promise<Npc> {
    const npc = Npc.fromConfig(config, tileX, tileY, direction);
    this.npcs.set(npc.id, npc);

    // NPC 通过 IEngineContext 获取 NpcManager、Player、MagicManager、AudioManager

    // Log NPC creation for debugging

    // Auto-load sprites using Npc's own method (must await so appearance is ready)
    if (config.npcIni) {
      try {
        await npc.loadSpritesFromNpcIni(config.npcIni);
      } catch (err: unknown) {
        logger.warn(`[NpcManager] Failed to load sprites for NPC ${config.name}:`, err);
      }
    }

    // Preload NPC magics (async, non-blocking)
    npc
      .loadAllMagics()
      .catch((err: unknown) =>
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
   * 参考 C#: NpcManager.ClearAllNpc(keepPartner) — 始终清空 _fileName
   */
  clearAllNpc(keepPartner: boolean = false): void {
    // C# 原版: _fileName = string.Empty; 始终清空
    this.fileName = "";

    if (keepPartner) {
      const toDelete: string[] = [];
      for (const [id, npc] of this.npcs) {
        if (!npc.isPartner) {
          toDelete.push(id);
        } else {
          // npc.CancelAttackTarget()
          npc.cancelAttackTarget();
        }
      }
      for (const id of toDelete) {
        this.npcs.delete(id);
      }
      // DeathInfos.Clear()
      this._deathInfos.length = 0;
      this._deadNpcs.length = 0;
    } else {
      this.npcs.clear();
    }
  }

  /**
   * Clear all NPCs but keep partners (followers)
   *
   */
  clearAllNpcAndKeepPartner(): void {
    this.clearAllNpc(true);
  }

  /**
   * 重新加载所有 NPC 的武功缓存（用于热重载武功配置）
   * 清除旧缓存并重新从 API 加载
   */
  async reloadAllMagicCaches(): Promise<void> {
    const promises: Promise<void>[] = [];
    for (const npc of this.npcs.values()) {
      npc.clearMagicCache();
      // 重新加载武功
      promises.push(npc.loadAllMagics());
    }
    await Promise.all(promises);
    logger.info(`[NpcManager] Reloaded magic caches for ${this.npcs.size} NPCs`);
  }

  /**
   * Remove all partner NPCs
   *
   */
  removeAllPartner(): void {
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
   * Matches Character.WalkToDirection(direction, steps)
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
      if (!npc.isEventer) continue;

      const npcPos = { x: npc.positionInWorld.x, y: npc.positionInWorld.y };
      const dist = distance(position, npcPos);
      if (dist < closestDist && dist < maxDistance) {
        closest = npc;
        closestDist = dist;
      }
    }

    return closest;
  }

  // =============================================
  // === 通用瓦片查询方法 ===
  // =============================================

  /**
   * 通用 NPC 查询：在指定瓦片查找满足条件的 NPC
   * @param tile 瓦片坐标
   * @param predicate 过滤条件
   */
  private findNpcAt(tile: Vector2, predicate?: (npc: Npc) => boolean): Npc | null {
    for (const [, npc] of this.npcs) {
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
   * @param tile 瓦片坐标
   * @param predicate 过滤条件
   * @param includePlayer 是否包含玩家检查
   */
  private findCharacterAt(
    tile: Vector2,
    predicate: (char: Character) => boolean,
    includePlayer = true
  ): Character | null {
    // 先检查玩家
    if (includePlayer && this._player) {
      if (this._player.mapX === tile.x && this._player.mapY === tile.y) {
        if (predicate(this._player)) {
          return this._player;
        }
      }
    }
    // 再检查 NPC
    return this.findNpcAt(tile, predicate as (npc: Npc) => boolean);
  }

  // =============================================
  // === 具体瓦片查询方法 ===
  // =============================================

  /**
   * Get NPC at tile position
   */
  getNpcAtTile(tileX: number, tileY: number): Npc | null {
    return this.findNpcAt({ x: tileX, y: tileY });
  }

  /**
   * Get Eventer NPC at tile position
   * Reference: NpcManager.GetEventer(tilePosition)
   * Used for jump obstacle check - if there's an eventer at the tile, can't jump there
   */
  getEventer(tile: Vector2): Npc | null {
    return this.findNpcAt(tile, (npc) => npc.isEventer);
  }

  /**
   * Get enemy NPC at tile position
   * tileX, int tileY, bool withNeutral)
   */
  getEnemy(tileX: number, tileY: number, withNeutral: boolean = false): Npc | null {
    return this.findNpcAt(
      { x: tileX, y: tileY },
      (npc) => npc.isEnemy || (withNeutral && npc.isNoneFighter)
    );
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
   * tilePosition, bool withNeutral)
   */
  getPlayerOrFighterFriend(
    tileX: number,
    tileY: number,
    withNeutral: boolean = false
  ): Character | null {
    const tile = { x: tileX, y: tileY };
    // 玩家始终是友方
    if (this._player?.mapX === tileX && this._player?.mapY === tileY) {
      return this._player;
    }
    return this.findNpcAt(tile, (npc) => npc.isFighterFriend || (withNeutral && npc.isNoneFighter));
  }

  /**
   * Get other group enemy at tile position
   * group, Vector2 tilePosition)
   */
  getOtherGroupEnemy(group: number, tileX: number, tileY: number): Character | null {
    return this.findNpcAt(
      { x: tileX, y: tileY },
      (npc) => npc.group !== group && npc.isEnemy
    );
  }

  /**
   * Get fighter (any combat-capable character) at tile position
   * tilePosition)
   */
  getFighter(tileX: number, tileY: number): Character | null {
    return this.findCharacterAt(
      { x: tileX, y: tileY },
      (char) => char.isPlayer || char.isFighter
    );
  }

  /**
   * Get non-neutral fighter at tile position
   * tilePosition)
   */
  getNonneutralFighter(tileX: number, tileY: number): Character | null {
    return this.findCharacterAt(
      { x: tileX, y: tileY },
      (char) => char.isPlayer || (char.isFighter && !char.isNoneFighter)
    );
  }

  /**
   * Get neutral fighter at tile position
   * tilePosition)
   */
  getNeutralFighter(tileX: number, tileY: number): Character | null {
    return this.findNpcAt({ x: tileX, y: tileY }, (npc) => npc.isNoneFighter);
  }

  /**
   * Get neighbor enemies of a character
   * character)
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
   * character)
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
   * Check if tile is blocked by NPC
   */
  isObstacle(tileX: number, tileY: number): boolean {
    return this.findNpcAt({ x: tileX, y: tileY }) !== null;
  }

  /**
   * Update all NPCs
   *
   */
  update(deltaTime: number): void {
    // Update each NPC and handle death body addition
    const npcsToDelete: string[] = [];

    // 通过 IEngineContext 获取 ObjManager 和 isDropEnabled
    const objManager = this.obj;
    const isDropEnabled = this.engine.isDropEnabled();

    for (const [id, npc] of this.npcs) {
      if (!npc.isVisible) continue;
      // Npc class handles its own update (movement, animation, AI)
      npc.update(deltaTime);

      // Handle dead NPC body addition
      if (npc.isDeath && npc.isBodyIniAdded === 0) {
        npc.isBodyIniAdded = 1;

        // Add body object only if valid and not a special death or summoned NPC
        // if (npc.IsBodyIniOk && !npc.IsNodAddBody && npc.SummonedByMagicSprite == null)
        const isSummoned = npc.summonedByMagicSprite !== null;
        if (npc.isBodyIniOk && !npc.notAddBody && !isSummoned && objManager) {
          const bodyObj = npc.bodyIniObj!;
          bodyObj.positionInWorld = { ...npc.positionInWorld };
          bodyObj.currentDirection = npc.currentDirection;

          if (npc.reviveMilliseconds > 0) {
            bodyObj.isRemoved = false;
            bodyObj.millisecondsToRemove = npc.leftMillisecondsToRevive;
          }

          // 直接添加到列表
          objManager.addObj(bodyObj);
          logger.log(`[NpcManager] Added body object for dead NPC: ${npc.name}`);
        }

        // 掉落物品
        // 注意：中掉落逻辑不检查是否为召唤 NPC，所有满足条件的 NPC 都可以掉落
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

        // if (npc.ReviveMilliseconds == 0) { DeleteNpc(node); }
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

    // Update death infos - decrease leftFrameToKeep and remove expired entries
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
   * NpcManager.GetAllPartner()
   */
  getAllPartner(): Npc[] {
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
   * NpcManager.PartnersMoveTo(destinationTilePosition)
   */
  partnersMoveTo(destinationTilePosition: Vector2): void {
    const partners = this.getAllPartner();
    for (const partner of partners) {
      if (partner.isStanding()) {
        partner.partnerMoveTo(destinationTilePosition);
      }
    }
  }

  /**
   * Execute action for each partner
   * NpcManager.ForEachPartner(Action<Character> action)
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
   * NpcManager.CleartFollowTargetIfEqual(target)
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
   * IsHide property (script-controlled hiding)
   */
  hideNpc(name: string): void {
    const npc = this.getNpc(name);
    if (npc) {
      npc.isHide = true;
    }
  }

  /**
   * Show/Hide NPC by name
   * sets IsHide property
   * Also checks player name for consistency
   */
  showNpc(name: string, show: boolean = true): void {
    // First check if name matches player
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
   * Sets the ScriptFile property for interaction
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
   * calls Load with clearCurrentNpcs=false
   */
  async mergeNpc(fileName: string): Promise<void> {
    logger.log(`[NpcManager] Merging NPC file: ${fileName}`);
    await this.loadNpcFileInternal(fileName, false);
  }

  /**
   * Save NPC state
   * 将当前非伙伴 NPC 序列化到内存文件存储中
   * 对应 C# 原版: NpcManager.Save(fileName) -> File.WriteAllText("save/game/" + fileName)
   *
   * 脚本流程: SaveNpc() -> LoadMap() -> LoadNpc(同文件名) -> 读到刚存的数据
   *
   * @param fileName 文件名（可选，默认使用当前加载的文件名）
   */
  async saveNpc(fileName?: string): Promise<void> {
    const saveFileName = fileName || this.fileName;
    if (!saveFileName) {
      logger.warn("[NpcManager] SaveNpc: No file name provided and no file loaded");
      return;
    }

    // 更新 fileName 记录（C#: if (!isSavePartner) { _fileName = fileName; }）
    this.fileName = saveFileName;

    // 序列化当前所有非伙伴 NPC 到内存存储
    const items = this.collectSnapshot(false);
    this.npcGroups.set(saveFileName, items);

    logger.log(`[NpcManager] SaveNpc: ${saveFileName} (${items.length} NPCs saved to groups)`);
  }

  /**
   * 收集当前 NPC 快照为 NpcSaveItem[]
   * 从 Loader.collectNpcData 提取的核心逻辑
   * @param partnersOnly 是否只收集伙伴
   */
  collectSnapshot(partnersOnly: boolean): NpcSaveItem[] {
    return collectNpcSnapshot(this.npcs, partnersOnly);
  }

  /**
   * 获取 NPC 分组存储（用于 Loader 存档时持久化）
   */
  getNpcGroups(): Map<string, NpcSaveItem[]> {
    return this.npcGroups;
  }

  /**
   * 设置 NPC 分组存储（用于 Loader 读档时恢复）
   */
  setNpcGroups(store: Record<string, NpcSaveItem[]>): void {
    this.npcGroups.clear();
    for (const [key, value] of Object.entries(store)) {
      this.npcGroups.set(key, value);
    }
  }

  /**
   * 清空 NPC 分组存储（新游戏时调用）
   */
  clearNpcGroups(): void {
    this.npcGroups.clear();
  }

  /**
   * Load Partner from file
   * NpcManager.LoadPartner(filePath)
   */
  async loadPartner(filePath: string): Promise<void> {
    try {
      this.removeAllPartner();
      await this.loadNpcFileInternal(filePath, false);
      logger.log(`[NpcManager] LoadPartner: ${filePath}`);
    } catch (error) {
      logger.error(`[NpcManager] Error loading partner file: ${filePath}`, error);
    }
  }

  /**
   * Save Partner state
   * saves partner NPCs to save file
   *
   * 将当前伙伴 NPC 序列化到内存文件存储中
   * 对应 C# 原版: NpcManager.Save(fileName, isSaveParter=true)
   *
   * @param fileName 文件名
   */
  savePartner(fileName: string): void {
    if (!fileName) {
      logger.warn("[NpcManager] SavePartner: No file name provided");
      return;
    }

    // 序列化当前所有伙伴 NPC 到内存存储
    const items = this.collectSnapshot(true);
    this.npcGroups.set(fileName, items);

    logger.log(`[NpcManager] SavePartner: ${fileName} (${items.length} partners saved to groups)`);
  }

  /**
   * Set NPC action file for a specific state
   * C# 参考: ResFile.SetNpcStateImage(NpcIni, state, fileName) 直接修改 NpcIni 字典
   * 我们的 setNpcActionFile 直接加载 ASF 并设置到 _spriteSet
   */
  async setNpcActionFile(name: string, stateType: number, asfFile: string): Promise<boolean> {
    const npc = this.getNpc(name);
    if (!npc) {
      logger.warn(`[NpcManager] NPC not found: ${name}`);
      return false;
    }

    // 调用 NPC 的 setNpcActionFile，等待 ASF 加载完成
    await npc.setNpcActionFile(stateType, asfFile);
    return true;
  }

  /**
   * Set NPC action type
   * Based on Character.SetNpcActionType()
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
   * Reference: 通过调用正常死亡流程触发 DeathScript
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
        // 设置状态，运行死亡脚本，播放动画
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
   * (name, relation) where relation is 0=Friend, 1=Enemy, 2=None
   * GetPlayerAndAllNpcs changes relation for ALL NPCs with the same name
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
   * sets IsAIDisabled = false
   */
  enableAI(): void {
    logger.log("[NpcManager] Enabling global NPC AI");
    this._globalAIDisabled = false;
  }

  /**
   * Disable global NPC AI
   * sets IsAIDisabled = true and calls NpcManager.CancleFighterAttacking()
   */
  disableAI(): void {
    logger.log("[NpcManager] Disabling global NPC AI");
    this._globalAIDisabled = true;
    this.cancelFighterAttacking();
  }

  /**
   * Load NPCs for a given scene key
   *  - tries groups store first, then Scene API
   *
   * @param fileName - The NPC file name (e.g., "wudangshanxia.npc")
   * @param clearCurrentNpcs - Whether to clear existing NPCs (default: true)
   */
  async loadNpcFile(fileName: string, clearCurrentNpcs: boolean = true): Promise<boolean> {
    return this.loadNpcFileInternal(fileName, clearCurrentNpcs);
  }

  /**
   * Internal method to load NPC file with clear option
   * NpcManager.Load(fileName, clearCurrentNpcs, randOne)
   */
  private async loadNpcFileInternal(fileName: string, clearCurrentNpcs: boolean): Promise<boolean> {
    logger.log(`[NpcManager] Loading NPC file: ${fileName} (clear=${clearCurrentNpcs})`);

    // 1. 优先从 NPC 分组存储加载（模拟 C# 的 save/game/ 目录）
    const storedData = this.npcGroups.get(fileName);
    if (storedData) {
      if (clearCurrentNpcs) {
        this.clearAllNpcAndKeepPartner();
      }

      logger.log(`[NpcManager] Loading ${storedData.length} NPCs from groups: ${fileName}`);
      const loadPromises: Promise<void>[] = [];
      for (const npcData of storedData) {
        if (npcData.isDeath && npcData.isDeathInvoked) continue;
        loadPromises.push(
          this.createNpcFromData(npcData as unknown as Record<string, unknown>).then(() => {})
        );
      }
      await Promise.all(loadPromises);
      this.fileName = fileName;
      logger.log(`[NpcManager] Loaded ${this.npcs.size} NPCs from groups: ${fileName}`);
      return true;
    }

    // 2. 从 Scene API 加载（数据库存储的 NPC JSON 数据）
    const gameSlug = getGameSlug();
    const sceneKey = this.engine.getCurrentMapName();
    if (gameSlug && sceneKey) {
      try {
        const apiUrl = `/game/${gameSlug}/api/scenes/npc/${encodeURIComponent(sceneKey)}/${encodeURIComponent(fileName)}`;
        const response = await fetch(apiUrl);
        if (response.ok) {
          const entries: Record<string, unknown>[] = await response.json();
          if (clearCurrentNpcs) {
            this.clearAllNpcAndKeepPartner();
          }
          if (entries.length > 0) {
            logger.log(`[NpcManager] Loading ${entries.length} NPCs from API: ${apiUrl}`);
            const loadPromises: Promise<void>[] = [];
            for (const entry of entries) {
              loadPromises.push(this.createNpcFromData(entry).then(() => {}));
            }
            await Promise.all(loadPromises);
          }
          this.fileName = fileName;
          logger.log(`[NpcManager] Loaded ${this.npcs.size} NPCs from API: ${fileName}`);
          return true;
        }
      } catch (error) {
        logger.error(`[NpcManager] Scene API error for ${fileName}:`, error);
      }
    } else {
      logger.warn(`[NpcManager] Cannot load from API: gameSlug=${gameSlug}, sceneKey=${sceneKey}`);
    }

    logger.error(`[NpcManager] Failed to load NPC file: ${fileName}`);
    return false;
  }



  /**
   * Create NPC from JSON data (统一的 NPC 创建方法)
   * + Character.Load()
   *
   * 数据来源：Scene API / NPC 分组缓存 / 存档（均为 camelCase JSON）
   */
  /**
   * 从存档/API 数据创建 NPC
   *
   * 使用 parseNpcData 创建基础 NPC，然后通过 applyFlatDataToCharacter
   * 用存档数据覆盖所有 FIELD_DEFS 属性，最后补充 NPC 特有运行时状态。
   */
  async createNpcFromData(data: Record<string, unknown>): Promise<Npc | null> {
    const { config, extraState, mapX, mapY, dir } = parseNpcData(data);

    // Skip dead NPCs that have been fully removed
    if (extraState.isDeath && extraState.isDeathInvoked) {
      logger.log(`[NpcManager] Skipping dead NPC: ${config.name}`);
      return null;
    }

    // Create NPC with config (loads ini + sprites)
    const npc = await this.addNpcWithConfig(config, mapX, mapY, dir as Direction);

    // 字段名已统一，直接赋值（无需 rename mapping）
    applyFlatDataToCharacter(data, npc, false);
    npc.applyConfigSetters();

    // === NPC 特有字段（不在 FIELD_DEFS 中） ===
    npc.isHide = extraState.isHide;
    npc.isAIDisabled = extraState.isAIDisabled;
    if (extraState.actionPathTilePositions && extraState.actionPathTilePositions.length > 0) {
      npc.actionPathTilePositions = extraState.actionPathTilePositions.map((p) => ({
        x: p.x,
        y: p.y,
      }));
    }

    // 等级配置（异步加载配置文件）
    if (npc.levelIniFile) {
      await npc.levelManager.setLevelFile(npc.levelIniFile);
    }

    return npc;
  }

  /**
   * Set file name (用于从 JSON 存档加载时设置)
   */
  setFileName(fileName: string): void {
    this.fileName = fileName;
  }

  // ============== AI Query Methods ==============
  //  AI-related static methods

  /**
   * Get closest enemy type character
   *
   */
  getClosestEnemyTypeCharacter(
    positionInWorld: Position,
    withNeutral: boolean = false,
    withInvisible: boolean = false,
    ignoreList: Character[] | null = null
  ): Character | null {
    return findClosestCharacter(
      this.npcs, null, positionInWorld,
      (npc) =>
        (withInvisible || npc.isVisible) &&
        (npc.isEnemy || (withNeutral && npc.isNoneFighter)),
      undefined,
      ignoreList
    );
  }

  /**
   * Get closest enemy based on finder's relation
   *
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
        target = this.getLiveClosestOtherGropEnemy(finder.group, targetPositionInWorld);
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
   * NpcManager.GetLiveClosestOtherGropEnemy (typo preserved)
   */
  getLiveClosestOtherGropEnemy(group: number, positionInWorld: Position): Character | null {
    return findClosestCharacter(
      this.npcs, null, positionInWorld,
      (npc) => npc.group !== group && npc.isVisible && npc.isEnemy
    );
  }

  /**
   * Get closest player or fighter friend
   *
   */
  getLiveClosestPlayerOrFighterFriend(
    positionInWorld: Position,
    withNeutral: boolean = false,
    withInvisible: boolean = false,
    ignoreList: Character[] | null = null
  ): Character | null {
    return findClosestCharacter(
      this.npcs, this._player, positionInWorld,
      (npc) =>
        (withInvisible || npc.isVisible) &&
        (npc.isFighterFriend || (withNeutral && npc.isNoneFighter)),
      (player) => withInvisible || player.isVisible,
      ignoreList
    );
  }

  /**
   * Get closest non-neutral fighter
   * NpcManager.GetLiveClosestNonneturalFighter (typo preserved)
   */
  getLiveClosestNonneturalFighter(
    positionInWorld: Position,
    ignoreList: Character[] | null = null
  ): Character | null {
    return findClosestCharacter(
      this.npcs, this._player, positionInWorld,
      (npc) => npc.isFighter && npc.relation !== RelationType.None,
      () => true,
      ignoreList
    );
  }

  /**
   * Get closest fighter
   *
   */
  getClosestFighter(
    targetPositionInWorld: Position,
    ignoreList: Character[] | null = null
  ): Character | null {
    return findClosestCharacter(
      this.npcs, this._player, targetPositionInWorld,
      (npc) => npc.isFighter,
      () => true,
      ignoreList
    );
  }

  /**
   * Find friends (non-opposite characters) within tile distance
   */
  findFriendsInTileDistance(
    finder: Character,
    beginTilePosition: Position,
    tileDistance: number
  ): Character[] {
    if (!finder || tileDistance < 1) return [];
    return findCharactersInTileDistance(
      this.npcs, this._player, beginTilePosition, tileDistance,
      (npc) => !finder.isOpposite(npc),
      (player) => !finder.isOpposite(player)
    );
  }

  /**
   * Find enemies within tile distance
   *
   */
  findEnemiesInTileDistance(
    finder: Character,
    beginTilePosition: Position,
    tileDistance: number
  ): Character[] {
    if (!finder || tileDistance < 1) return [];
    return findCharactersInTileDistance(
      this.npcs, this._player, beginTilePosition, tileDistance,
      (npc) => finder.isOpposite(npc),
      (player) => finder.isOpposite(player)
    );
  }

  /**
   * Find fighters within tile distance
   *
   */
  findFightersInTileDistance(beginTilePosition: Position, tileDistance: number): Character[] {
    return findCharactersInTileDistance(
      this.npcs, this._player, beginTilePosition, tileDistance,
      (npc) => npc.isFighter,
      () => true
    );
  }

  /**
   * Cancel all fighter attacking (used when global AI is disabled)
   *
   */
  cancelFighterAttacking(): void {
    for (const [, npc] of this.npcs) {
      if (npc.isFighterKind) {
        npc.cancelAttackTarget();
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
