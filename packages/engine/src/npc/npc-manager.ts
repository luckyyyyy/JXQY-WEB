/**
 * NPC 管理器
 * 管理所有 NPC 的创建、更新、查询
 */

import type { Character } from "../character";
import type { CharacterBase } from "../character/base";
import { loadCharacterConfig } from "../character/character-config";
import { getEngineContext } from "../core/engine-context";
import { logger } from "../core/logger";
import type { CharacterConfig, Vector2 } from "../core/types";
import { CharacterKind, type CharacterState, type Direction } from "../core/types";
import { type DropCharacter, getDropObj } from "../player/goods/good-drop";
import { resolveScriptPath } from "../resource/resource-paths";
import type { NpcSaveItem } from "../storage/save-types";
import { getViewTileDistance } from "../utils";
import { Npc } from "./npc";
import type { NpcAiQueryContext } from "./npc-ai-queries";
import * as aiQ from "./npc-ai-queries";
import { DeathInfo, type ViewRect } from "./npc-query-helpers";
import type { NpcSaveLoadDeps } from "./npc-save-load";
import * as saveLoad from "./npc-save-load";
import { NpcSpatialGrid } from "./npc-spatial-grid";
import * as tileQ from "./npc-tile-queries";

// Type alias for position (use Vector2 for consistency)
type Position = Vector2;

/** NpcManager 类*/
export class NpcManager {
  protected get engine() {
    return getEngineContext();
  }

  // Internal storage uses Npc class instances
  private npcs: Map<string, Npc> = new Map();
  // Note: NPC config is loaded from API cache (npc-config-cache)
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

  // === 性能优化：空间网格加速近邻查询 ===
  // 每帧 update 结束后 rebuild，将 findClosestCharacter 从 O(N) 降至 O(k)
  private _spatialGrid = new NpcSpatialGrid<Npc>(640);

  /**
   * 获取 Player（通过 EngineContext）
   */
  private get _player(): Character {
    return this.engine.player as unknown as Character;
  }

  /** AI 查询上下文（传给 npc-ai-queries 的纯函数）*/
  private get _aiCtx(): NpcAiQueryContext {
    return { npcs: this.npcs, spatialGrid: this._spatialGrid, player: this._player };
  }

  /** Save/Load 上下文（传给 npc-save-load 的纯函数）*/
  private get _slDeps(): NpcSaveLoadDeps {
    return {
      npcs: this.npcs,
      npcGroups: this.npcGroups,
      getFileName: () => this.fileName,
      setFileName: (n: string) => {
        this.fileName = n;
      },
      clearAllNpcAndKeepPartner: () => this.clearAllNpcAndKeepPartner(),
      removeAllPartner: () => this.removeAllPartner(),
      addNpcWithConfig: (c, x, y, d) => this.addNpcWithConfig(c, x, y, d),
      getCurrentMapName: () => this.engine.getCurrentMapName(),
    };
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

  // Player 现在由 NPC 通过 EngineContext.player 获取，不再需要 setPlayer

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

  private withNpc(name: string, action: (npc: Npc) => void): boolean {
    const npc = this.getNpc(name);
    if (!npc) {
      return false;
    }
    action(npc);
    return true;
  }

  private withNpcResult<T>(name: string, action: (npc: Npc) => T, fallback: T): T {
    const npc = this.getNpc(name);
    if (!npc) {
      return fallback;
    }
    return action(npc);
  }

  private async withNpcAsync(
    name: string,
    action: (npc: Npc) => Promise<void>,
    onNotFound?: () => void
  ): Promise<boolean> {
    const npc = this.getNpc(name);
    if (!npc) {
      onNotFound?.();
      return false;
    }
    await action(npc);
    return true;
  }

  private setNpcField<K extends keyof Npc>(name: string, field: K, value: Npc[K]): boolean {
    return this.withNpc(name, (npc) => {
      npc[field] = value;
    });
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
   * Config is loaded from API cache (npc-config-cache)
   */
  async addNpc(
    configPath: string,
    tileX: number,
    tileY: number,
    direction: Direction = 4
  ): Promise<Npc | null> {
    const config = await loadCharacterConfig(configPath);
    if (!config) return null;
    return this.addNpcWithConfig(config, tileX, tileY, direction);
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

    logger.log(
      `[NpcManager] Created NPC: ${config.name} at (${tileX}, ${tileY}), dir=${direction}, npcIni=${config.npcIni || "none"}`
    );

    if (config.npcIni) {
      try {
        await npc.loadSpritesFromNpcIni(config.npcIni);
      } catch (err: unknown) {
        logger.warn(`[NpcManager] Failed to load sprites for NPC ${config.name}:`, err);
      }
    }

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
    // 同步清理空间网格
    this._spatialGrid.clear();
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
    return this.withNpc(name, (npc) => {
      npc.setPosition(tileX, tileY);
    });
  }

  /**
   * Make NPC walk to position
   */
  npcGoto(name: string, tileX: number, tileY: number): boolean {
    return this.withNpcResult(name, (npc) => npc.walkTo({ x: tileX, y: tileY }), false);
  }

  /**
   * Make NPC walk in a direction for a number of steps
   * Matches Character.WalkToDirection(direction, steps)
   */
  npcGotoDir(name: string, direction: number, steps: number): boolean {
    return this.withNpc(name, (npc) => {
      npc.walkToDirection(direction, steps);
    });
  }

  /**
   * Get closest interactable NPC to a position
   */
  getClosestInteractableNpc(position: Vector2, maxDistance = 100): Npc | null {
    return tileQ.getClosestInteractableNpc(this.npcs, position, maxDistance);
  }

  // =============================================
  // === 瓦片查询（委托 npc-tile-queries.ts）===
  // =============================================

  getNpcAtTile(tileX: number, tileY: number): Npc | null {
    return tileQ.getNpcAtTile(this.npcs, tileX, tileY);
  }

  getEventer(tile: Vector2): Npc | null {
    return tileQ.getEventer(this.npcs, tile);
  }

  getEnemy(tileX: number, tileY: number, withNeutral = false): Npc | null {
    return tileQ.getEnemy(this.npcs, tileX, tileY, withNeutral);
  }

  getEnemyPositions(): string {
    return tileQ.getEnemyPositions(this.npcs);
  }

  getPlayerOrFighterFriend(tileX: number, tileY: number, withNeutral = false): Character | null {
    return tileQ.getPlayerOrFighterFriend(this.npcs, this._player, tileX, tileY, withNeutral);
  }

  getOtherGroupEnemy(group: number, tileX: number, tileY: number): Character | null {
    return tileQ.getOtherGroupEnemy(this.npcs, group, tileX, tileY);
  }

  getFighter(tileX: number, tileY: number): Character | null {
    return tileQ.getFighter(this.npcs, this._player, tileX, tileY);
  }

  getNonneutralFighter(tileX: number, tileY: number): Character | null {
    return tileQ.getNonneutralFighter(this.npcs, this._player, tileX, tileY);
  }

  getNeutralFighter(tileX: number, tileY: number): Character | null {
    return tileQ.getNeutralFighter(this.npcs, tileX, tileY);
  }

  getNeighborEnemy(character: CharacterBase): Character[] {
    return tileQ.getNeighborEnemies(this.npcs, character);
  }

  getNeighborNeutralFighter(character: CharacterBase): Character[] {
    return tileQ.getNeighborNeutralFighters(this.npcs, character);
  }

  isObstacle(tileX: number, tileY: number): boolean {
    return tileQ.isNpcObstacle(this.npcs, tileX, tileY);
  }

  /**
   * Update all NPCs
   *
   */
  update(deltaTime: number): void {
    // Update each NPC and handle death body addition
    const npcsToDelete: string[] = [];

    // 通过 EngineContext 获取 ObjManager 和 isDropEnabled
    const objManager = this.engine.objManager;
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

    // 重建空间网格（所有 NPC 位置已更新完毕）
    this._spatialGrid.rebuild(this.npcs.values(), (npc) => npc.positionInWorld);
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
  clearFollowTargetIfEqual(target: CharacterBase): void {
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
    this.setNpcField(name, "isAIDisabled", true);
  }

  /**
   * Enable AI for NPC
   */
  enableNpcAI(name: string): void {
    this.setNpcField(name, "isAIDisabled", false);
  }

  /**
   * Hide NPC
   * IsHide property (script-controlled hiding)
   */
  hideNpc(name: string): void {
    this.setNpcField(name, "isHide", true);
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
    this.setNpcField(name, "isHide", !show);
  }

  /**
   * Set NPC script file
   * Sets the ScriptFile property for interaction
   */
  setNpcScript(name: string, scriptFile: string): void {
    if (
      !this.withNpc(name, (npc) => {
        npc.scriptFile = scriptFile;
      })
    ) {
      logger.warn(`[NpcManager] NPC not found for SetNpcScript: ${name}`);
      return;
    }
    logger.log(`[NpcManager] Set script for ${name}: ${scriptFile}`);
  }

  /**
   * Merge NPC file without clearing existing NPCs
   * calls Load with clearCurrentNpcs=false
   */
  // ============= Save / Load（委托 npc-save-load）=============

  async mergeNpc(fileName: string): Promise<void> {
    return saveLoad.mergeNpc(this._slDeps, fileName);
  }

  async saveNpc(fileName?: string): Promise<void> {
    saveLoad.saveNpc(this._slDeps, fileName);
  }

  collectSnapshot(partnersOnly: boolean): NpcSaveItem[] {
    return saveLoad.collectSnapshot(this.npcs, partnersOnly);
  }

  getNpcGroups(): Map<string, NpcSaveItem[]> {
    return this.npcGroups;
  }

  setNpcGroups(store: Record<string, NpcSaveItem[]>): void {
    saveLoad.setNpcGroups(this.npcGroups, store);
  }

  clearNpcGroups(): void {
    this.npcGroups.clear();
  }

  async loadPartner(filePath: string): Promise<void> {
    return saveLoad.loadPartner(this._slDeps, filePath);
  }

  savePartner(fileName: string): void {
    saveLoad.savePartner(this._slDeps, fileName);
  }

  /**
   * Set NPC action file for a specific state
   * C# 参考: ResFile.SetNpcStateImage(NpcIni, state, fileName) 直接修改 NpcIni 字典
   * 我们的 setNpcActionFile 直接加载 ASF 并设置到 _spriteSet
   */
  async setNpcActionFile(name: string, stateType: number, asfFile: string): Promise<boolean> {
    return this.withNpcAsync(
      name,
      async (npc) => {
        await npc.setNpcActionFile(stateType, asfFile);
      },
      () => {
        logger.warn(`[NpcManager] NPC not found: ${name}`);
      }
    );
  }

  /**
   * Set NPC action type
   * Based on Character.SetNpcActionType()
   */
  setNpcActionType(name: string, actionType: number): boolean {
    return this.setNpcField(name, "actionType", actionType);
  }

  /**
   * Set NPC level
   */
  setNpcLevel(name: string, level: number): boolean {
    return this.setNpcField(name, "level", level);
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
    return this.setNpcField(name, "currentDirection", direction);
  }

  /**
   * Set NPC state
   */
  setNpcState(name: string, state: number): boolean {
    return this.setNpcField(name, "state", state as CharacterState);
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

  async loadNpcFile(fileName: string, clearCurrentNpcs: boolean = true): Promise<boolean> {
    return saveLoad.loadNpcFile(this._slDeps, fileName, clearCurrentNpcs);
  }

  async createNpcFromData(data: Record<string, unknown>): Promise<Npc | null> {
    return saveLoad.createNpcFromData(this._slDeps, data);
  }

  setFileName(fileName: string): void {
    this.fileName = fileName;
  }

  // ============== AI Query Methods（委托 npc-ai-queries）==============

  getClosestEnemyTypeCharacter(
    positionInWorld: Position,
    withNeutral = false,
    withInvisible = false,
    ignoreList: Character[] | null = null
  ): Character | null {
    return aiQ.getClosestEnemyTypeCharacter(
      this._aiCtx,
      positionInWorld,
      withNeutral,
      withInvisible,
      ignoreList
    );
  }

  getClosestEnemy(
    finder: Character,
    targetPositionInWorld: Position,
    withNeutral = false,
    withInvisible = false,
    ignoreList: Character[] | null = null
  ): Character | null {
    return aiQ.getClosestEnemy(
      this._aiCtx,
      finder,
      targetPositionInWorld,
      withNeutral,
      withInvisible,
      ignoreList
    );
  }

  getLiveClosestOtherGropEnemy(group: number, positionInWorld: Position): Character | null {
    return aiQ.getLiveClosestOtherGropEnemy(this._aiCtx, group, positionInWorld);
  }

  getLiveClosestPlayerOrFighterFriend(
    positionInWorld: Position,
    withNeutral = false,
    withInvisible = false,
    ignoreList: Character[] | null = null
  ): Character | null {
    return aiQ.getLiveClosestPlayerOrFighterFriend(
      this._aiCtx,
      positionInWorld,
      withNeutral,
      withInvisible,
      ignoreList
    );
  }

  getLiveClosestNonneturalFighter(
    positionInWorld: Position,
    ignoreList: Character[] | null = null
  ): Character | null {
    return aiQ.getLiveClosestNonneturalFighter(this._aiCtx, positionInWorld, ignoreList);
  }

  getClosestFighter(
    targetPositionInWorld: Position,
    ignoreList: Character[] | null = null
  ): Character | null {
    return aiQ.getClosestFighter(this._aiCtx, targetPositionInWorld, ignoreList);
  }

  findFriendsInTileDistance(
    finder: Character,
    beginTilePosition: Position,
    tileDistance: number
  ): Character[] {
    return aiQ.findFriendsInTileDistance(this._aiCtx, finder, beginTilePosition, tileDistance);
  }

  findEnemiesInTileDistance(
    finder: Character,
    beginTilePosition: Position,
    tileDistance: number
  ): Character[] {
    return aiQ.findEnemiesInTileDistance(this._aiCtx, finder, beginTilePosition, tileDistance);
  }

  findFightersInTileDistance(beginTilePosition: Position, tileDistance: number): Character[] {
    return aiQ.findFightersInTileDistance(this._aiCtx, beginTilePosition, tileDistance);
  }

  cancelFighterAttacking(): void {
    aiQ.cancelFighterAttacking(this.npcs);
  }

  getAllCharacters(): Character[] {
    return aiQ.getAllCharacters(this.npcs, this._player);
  }
}
