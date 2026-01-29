/**
 * NPC 管理器 - 对应 C# NpcManager.cs
 * 管理所有 NPC 的创建、更新、查询
 */
import type { CharacterConfig, Vector2 } from "../core/types";
import { CharacterState, CharacterKind, RelationType, Direction } from "../core/types";
import { Npc, disableGlobalAI, enableGlobalAI } from "./npc";
import type { Character } from "./character";
import { loadNpcConfig } from "./resFile";
import { generateId, distance, parseIni, getViewTileDistance } from "../core/utils";
import { resourceLoader } from "../resource/resourceLoader";
import type { AudioManager } from "../audio";

// Type alias for position (use Vector2 for consistency)
type Position = Vector2;

// Death script callback type
type DeathScriptCallback = (scriptPath: string, npc: Npc) => Promise<void>;

/** 死亡信息 - 跟踪最近死亡的角色 */
export class DeathInfo {
  theDead: Character;
  leftFrameToKeep: number;

  constructor(theDead: Character, leftFrameToKeep: number = 2) {
    this.theDead = theDead;
    this.leftFrameToKeep = leftFrameToKeep;
  }
}

/** NpcManager 类 - 对应 C# NpcManager.cs */
export class NpcManager {
  // Internal storage uses Npc class instances
  private npcs: Map<string, Npc> = new Map();
  // Note: NPC config caching is now handled by resourceLoader.loadIni
  private isWalkable: (tile: Vector2) => boolean;
  private isMapObstacle: ((tile: Vector2) => boolean) | undefined;
  // Store loaded NPC file name (like C# _fileName)
  private fileName: string = "";

  // Player reference for AI
  private _player: Character | null = null;

  // Death script callback for running scripts when NPC dies
  private _deathScriptCallback: DeathScriptCallback | null = null;

  // List of dead NPCs (C#: NpcManager._deadNpcList)
  private _deadNpcs: Npc[] = [];

  // C#: DeathInfos - tracks recently dead characters for CheckKeepDistanceWhenFriendDeath
  private _deathInfos: DeathInfo[] = [];

  // Audio manager for playing NPC sounds (e.g., death sound)
  private _audioManager: AudioManager | null = null;

  constructor(
    isWalkable: (tile: Vector2) => boolean,
    isMapObstacle?: (tile: Vector2) => boolean
  ) {
    this.isWalkable = isWalkable;
    this.isMapObstacle = isMapObstacle;
  }

  /**
   * Set callback for running death scripts
   * Called by GameManager to connect NPC system to script system
   */
  setDeathScriptCallback(callback: DeathScriptCallback): void {
    this._deathScriptCallback = callback;
  }

  /**
   * Set audio manager for playing NPC sounds
   * Called by GameManager to connect NPC system to audio system
   * C# Reference: Character.PlaySoundEffect() uses sound from NpcIni
   */
  setAudioManager(audioManager: AudioManager): void {
    this._audioManager = audioManager;
    // Also set audio manager on all existing NPCs
    for (const npc of this.npcs.values()) {
      npc.setAudioManager(audioManager);
    }
  }

  /**
   * Run death script for an NPC (called from NPC.onDeath)
   * C#: ScriptManager.RunScript(Utils.GetScriptParser(DeathScript), this)
   */
  async runDeathScript(scriptPath: string, npc: Npc): Promise<void> {
    if (this._deathScriptCallback && scriptPath) {
      console.log(`[NpcManager] Running death script for ${npc.name}: ${scriptPath}`);
      await this._deathScriptCallback(scriptPath, npc);
    }
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
  findFriendDeadKilledByLiveCharacter(finder: Character, maxTileDistance: number): Character | null {
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
      if ((finder.isEnemy && theDead.isEnemy) ||
          (finder.isFighterFriend && theDead.isFighterFriend)) {
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

  /**
   * Set player reference for AI targeting
   */
  setPlayer(player: Character | null): void {
    this._player = player;
    // Update all existing NPCs
    for (const [, npc] of this.npcs) {
      npc.setAIReferences(this, player);
    }
  }

  /**
   * Get current NPC file name
   */
  getFileName(): string {
    return this.fileName;
  }

  /**
   * Set walkability checker
   */
  setWalkabilityChecker(checker: (tile: Vector2) => boolean): void {
    this.isWalkable = checker;
  }

  // Jump obstacle checker (C# MapBase.Instance.IsObstacleForCharacterJump)
  private isMapObstacleForJump?: (tile: Vector2) => boolean;

  /**
   * Set jump obstacle checker for all NPCs
   * C# Reference: MapBase.Instance.IsObstacleForCharacterJump
   */
  setIsMapObstacleForJump(checker: (tile: Vector2) => boolean): void {
    this.isMapObstacleForJump = checker;
    // Update existing NPCs
    for (const [, npc] of this.npcs) {
      npc.setIsMapObstacleForJump(checker);
    }
  }

  /**
   * Get all NPC instances
   */
  getAllNpcs(): Map<string, Npc> {
    return this.npcs;
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

    // Set walkability checker for pathfinding
    npc.setWalkabilityChecker(this.isWalkable, this.isMapObstacle);

    // Set jump obstacle checker
    if (this.isMapObstacleForJump) {
      npc.setIsMapObstacleForJump(this.isMapObstacleForJump);
    }

    // Set AI references
    npc.setAIReferences(this, this._player);

    // Set audio manager for NPC sounds (death sound, etc.)
    // C# Reference: Character.SetState() plays sound via NpcIni[(int)state].Sound
    if (this._audioManager) {
      npc.setAudioManager(this._audioManager);
    }

    // Log NPC creation for debugging
    console.log(`[NpcManager] Created NPC: ${config.name} at (${tileX}, ${tileY}), id=${npc.id}, npcIni=${config.npcIni || 'none'}`);

    // Auto-load sprites using Npc's own method
    if (config.npcIni) {
      npc.loadSpritesFromNpcIni(config.npcIni)
        .catch((err: any) => console.warn(`[NpcManager] Failed to load sprites for NPC ${config!.name}:`, err));
    }

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

    // Set walkability checker for pathfinding
    npc.setWalkabilityChecker(this.isWalkable, this.isMapObstacle);

    // Set jump obstacle checker
    if (this.isMapObstacleForJump) {
      npc.setIsMapObstacleForJump(this.isMapObstacleForJump);
    }

    // Set AI references
    npc.setAIReferences(this, this._player);

    // Set audio manager for NPC sounds (death sound, etc.)
    // C# Reference: Character.SetState() plays sound via NpcIni[(int)state].Sound
    if (this._audioManager) {
      npc.setAudioManager(this._audioManager);
    }

    // Log NPC creation for debugging
    console.log(`[NpcManager] Created NPC (with config): ${config.name} at (${tileX}, ${tileY}), id=${npc.id}, npcIni=${config.npcIni || 'none'}`);

    // Auto-load sprites using Npc's own method
    if (config.npcIni) {
      npc.loadSpritesFromNpcIni(config.npcIni)
        .catch((err: any) => console.warn(`[NpcManager] Failed to load sprites for NPC ${config.name}:`, err));
    }

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
    for (const [, npc] of this.npcs) {
      if (!npc.isVisible) continue;
      // Npc class handles its own update (movement, animation, AI)
      npc.update(deltaTime);
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
   * Show NPC
   */
  showNpc(name: string): void {
    const npc = this.getNpc(name);
    if (npc) {
      npc.isVisible = true;
    }
  }

  /**
   * Set NPC action file for a specific state
   * Based on Character.SetNpcActionFile() in C#
   * This sets the ASF file for a specific character state
   */
  setNpcActionFile(name: string, stateType: number, asfFile: string): boolean {
    const npc = this.getNpc(name);
    if (!npc) {
      console.warn(`[NpcManager] NPC not found: ${name}`);
      return false;
    }

    // Check if this is the first time setting custom ASF for this state
    const isFirstTimeSet = !npc.customActionFiles.has(stateType) ||
                           !(npc as any)._customAsfCache?.has(stateType);

    // Use Npc class method directly
    npc.setNpcActionFile(stateType, asfFile);

    // Preload the ASF file
    npc.preloadCustomActionFile(stateType, asfFile)
      .then(() => {
        // Only update texture immediately if:
        // 1. This is the first time setting custom ASF for this state
        // 2. Current state matches the one we just loaded
        if (isFirstTimeSet && npc.state === stateType) {
          (npc as any)._updateTextureForState(stateType);
        }
      })
      .catch((err: any) => console.error(`Failed to preload custom action file:`, err));

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
   * Kill all enemy NPCs (for cheat system)
   * Returns the number of enemies killed
   */
  killAllEnemies(): number {
    let killed = 0;
    const toDelete: string[] = [];

    for (const [id, npc] of this.npcs) {
      // Check if NPC is an enemy (Fighter kind or Flyer, with enemy relation)
      if (
        (npc.kind === CharacterKind.Fighter || npc.kind === CharacterKind.Flyer) &&
        npc.isEnemy
      ) {
        // Mark for deletion (or set to death state)
        npc.state = CharacterState.Death;
        npc.life = 0;
        toDelete.push(id);
        killed++;
      }
    }

    // Remove dead enemies after iteration
    for (const id of toDelete) {
      this.npcs.delete(id);
    }

    console.log(`[NpcManager] Killed ${killed} enemies`);
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
      console.warn(`[NpcManager] SetNpcRelation: NPC not found: ${name}`);
      return false;
    }

    const relationNames = ['Friend', 'Enemy', 'None'];
    for (const npc of npcs) {
      console.log(`[NpcManager] SetNpcRelation: ${name} (id=${npc.id}) relation changed from ${relationNames[npc.relation] || npc.relation} to ${relationNames[relation] || relation}`);
      npc.setRelation(relation);
    }
    return true;
  }

  /**
   * Enable global NPC AI
   */
  enableGlobalAI(): void {
    console.log("[NpcManager] Enabling global NPC AI");
    enableGlobalAI();
    // Also clear follow targets when enabling AI (fresh start)
    for (const [, npc] of this.npcs) {
      // NPCs will find new targets in their next update
    }
  }

  /**
   * Disable global NPC AI
   */
  disableGlobalAI(): void {
    console.log("[NpcManager] Disabling global NPC AI");
    disableGlobalAI();
    this.cancelFighterAttacking();
  }

  /**
   * Load NPCs from a .npc file
   * Based on C#'s NpcManager.Load and Utils.GetNpcObjFilePath
   * Uses unified resourceLoader for text data fetching
   *
   * @param fileName - The NPC file name (e.g., "wudangshanxia.npc")
   */
  async loadNpcFile(fileName: string): Promise<boolean> {
    console.log(`[NpcManager] Loading NPC file: ${fileName}`);

    // Try multiple paths like C# GetNpcObjFilePath
    const paths = [
      `/resources/save/game/${fileName}`,
      `/resources/ini/save/${fileName}`,
    ];

    for (const filePath of paths) {
      try {
        // .npc files have been converted to UTF-8
        // resourceLoader.loadText handles Vite HTML fallback detection
        const content = await resourceLoader.loadText(filePath);

        if (!content) {
          continue;
        }

        console.log(`[NpcManager] Parsing NPC file from: ${filePath}`);
        await this.parseNpcFile(content);
        this.fileName = fileName; // Store loaded file name like C#
        console.log(`[NpcManager] Loaded ${this.npcs.size} NPCs from ${fileName}`);
        return true;
      } catch (error) {
        // Continue to next path
      }
    }

    console.error(`[NpcManager] Failed to load NPC file: ${fileName} (tried all paths)`);
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
      state?: number;
      action: number;
      isVisible: boolean;
      isAIDisabled: boolean;
      isDeath: boolean;
      isDeathInvoked: boolean;
      invincible: number;
      reviveMilliseconds: number;
      leftMillisecondsToRevive: number;
      scriptFileRight?: string;
      timerScriptFile?: string;
      timerScriptInterval?: number;
      dropIni?: string;
      buyIniFile?: string;
      actionPathTilePositions?: Array<{ x: number; y: number }>;
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
    const leftMillisecondsToRevive = parseNum(data.leftMillisecondsToRevive ?? data.LeftMillisecondsToRevive, 0);

    // 额外属性（只有 JSON 存档才有）
    const timerScriptFile = parseStr(data.timerScriptFile ?? data.TimerScriptFile);
    const timerScriptInterval = data.timerScriptInterval ?? data.TimerScriptInterval;
    const dropIni = parseStr(data.dropIni ?? data.DropIni);
    const buyIniFile = parseStr(data.buyIniFile ?? data.BuyIniFile);
    const actionPathTilePositions = data.actionPathTilePositions;

    // === AI 相关字段 ===
    const aiType = parseNum(data.AIType ?? data.aiType, 0);
    const keepRadiusWhenLifeLow = parseNum(data.KeepRadiusWhenLifeLow ?? data.keepRadiusWhenLifeLow, 0);
    const lifeLowPercent = parseNum(data.LifeLowPercent ?? data.lifeLowPercent, 20);
    const stopFindingTarget = parseNum(data.StopFindingTarget ?? data.stopFindingTarget, 0);
    const keepRadiusWhenFriendDeath = parseNum(data.KeepRadiusWhenFriendDeath ?? data.keepRadiusWhenFriendDeath, 0);

    // === Hurt Player (接触伤害) ===
    const hurtPlayerInterval = parseNum(data.HurtPlayerInterval ?? data.hurtPlayerInterval, 0);
    const hurtPlayerLife = parseNum(data.HurtPlayerLife ?? data.hurtPlayerLife, 0);
    const hurtPlayerRadius = parseNum(data.HurtPlayerRadius ?? data.hurtPlayerRadius, 0);

    // === Magic Direction ===
    const magicDirectionWhenBeAttacked = parseNum(data.MagicDirectionWhenBeAttacked ?? data.magicDirectionWhenBeAttacked, 0);
    const magicDirectionWhenDeath = parseNum(data.MagicDirectionWhenDeath ?? data.magicDirectionWhenDeath, 0);

    // === Visibility Control ===
    const fixedPos = parseStr(data.FixedPos ?? data.fixedPos);
    const visibleVariableName = parseStr(data.VisibleVariableName ?? data.visibleVariableName);
    const visibleVariableValue = parseNum(data.VisibleVariableValue ?? data.visibleVariableValue, 0);

    // === Auto Magic ===
    const magicToUseWhenLifeLow = parseStr(data.MagicToUseWhenLifeLow ?? data.magicToUseWhenLifeLow);
    const magicToUseWhenBeAttacked = parseStr(data.MagicToUseWhenBeAttacked ?? data.magicToUseWhenBeAttacked);
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

    return {
      config,
      extraState: {
        state,
        action,
        isVisible,
        isAIDisabled,
        isDeath,
        isDeathInvoked,
        invincible,
        reviveMilliseconds,
        leftMillisecondsToRevive,
        scriptFileRight: scriptFileRight || undefined,
        timerScriptFile: timerScriptFile || undefined,
        timerScriptInterval,
        dropIni: dropIni || undefined,
        buyIniFile: buyIniFile || undefined,
        actionPathTilePositions,
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
      console.log(`[NpcManager] Skipping dead NPC: ${config.name}`);
      return null;
    }

    // Create NPC with config
    const npc = this.addNpcWithConfig(config, mapX, mapY, dir as any);

    // Apply all parsed state - C# 逻辑：有什么字段就读什么字段
    npc.actionType = extraState.action;
    npc.isVisible = extraState.isVisible;
    npc.isAIDisabled = extraState.isAIDisabled;

    if (extraState.state !== undefined) {
      npc.state = extraState.state;
    }
    if (extraState.scriptFileRight) {
      npc.scriptFileRight = extraState.scriptFileRight;
    }
    if (extraState.timerScriptFile) {
      npc.timerScript = extraState.timerScriptFile;
    }
    if (extraState.timerScriptInterval !== undefined) {
      npc.timerInterval = extraState.timerScriptInterval;
    }
    if (extraState.actionPathTilePositions && extraState.actionPathTilePositions.length > 0) {
      npc.actionPathTilePositions = extraState.actionPathTilePositions.map(p => ({ x: p.x, y: p.y }));
    }

    npc.invincible = extraState.invincible;
    npc.reviveMilliseconds = extraState.reviveMilliseconds;
    npc.leftMillisecondsToRevive = extraState.leftMillisecondsToRevive;
    if (extraState.dropIni) npc.dropIni = extraState.dropIni;
    if (extraState.buyIniFile) npc.buyIniFile = extraState.buyIniFile;
    npc.isDeath = extraState.isDeath;
    npc.isDeathInvoked = extraState.isDeathInvoked;

    console.log(`[NpcManager] Created NPC: ${config.name} at (${mapX}, ${mapY}), npcIni=${config.npcIni}`);
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
      if (ignoreList && ignoreList.some(item => item === npc)) continue;
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
      let target = this.getLiveClosestPlayerOrFighterFriend(targetPositionInWorld, withNeutral, withInvisible, ignoreList);
      if (!target) {
        target = this.getLiveClosestOtherGroupEnemy(finder.group, targetPositionInWorld);
      }
      return target;
    }

    if (finder.isPlayer || finder.isFighterFriend) {
      return this.getClosestEnemyTypeCharacter(targetPositionInWorld, withNeutral, withInvisible, ignoreList);
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
      if (ignoreList && ignoreList.some(item => item === npc)) continue;
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
      if (ignoreList && ignoreList.some(item => item === this._player)) {
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
      if (ignoreList && ignoreList.some(item => item === npc)) continue;
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
      if (ignoreList && ignoreList.some(item => item === this._player)) {
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
      if (ignoreList && ignoreList.some(item => item === npc)) continue;
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
      if (ignoreList && ignoreList.some(item => item === this._player)) {
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
