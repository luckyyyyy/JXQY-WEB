/**
 * NPC Manager - based on JxqyHD Engine/NpcManager.cs
 * Manages all NPCs in the game
 *
 * Uses Npc class instances directly
 */
import type { CharacterConfig, Vector2 } from "../core/types";
import { CharacterState, CharacterKind, Direction } from "../core/types";
import { Npc } from "./npc";
import { loadNpcConfig } from "./resFile";
import { generateId, distance, parseIni } from "../core/utils";

export class NpcManager {
  // Internal storage uses Npc class instances
  private npcs: Map<string, Npc> = new Map();
  private npcConfigCache: Map<string, CharacterConfig> = new Map();
  private isWalkable: (tile: Vector2) => boolean;
  private isMapObstacle: ((tile: Vector2) => boolean) | undefined;
  // Store loaded NPC file name (like C# _fileName)
  private fileName: string = "";

  constructor(
    isWalkable: (tile: Vector2) => boolean,
    isMapObstacle?: (tile: Vector2) => boolean
  ) {
    this.isWalkable = isWalkable;
    this.isMapObstacle = isMapObstacle;
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

  /**
   * Get all NPC instances
   */
  getAllNpcs(): Map<string, Npc> {
    return this.npcs;
  }

  /**
   * Get NPC by name
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
   * Get NPC by ID
   */
  getNpcById(id: string): Npc | null {
    return this.npcs.get(id) || null;
  }

  /**
   * Add NPC from config file
   */
  async addNpc(
    configPath: string,
    tileX: number,
    tileY: number,
    direction: Direction = 4
  ): Promise<Npc | null> {
    let config: CharacterConfig | undefined = this.npcConfigCache.get(configPath);
    if (!config) {
      const loaded = await loadNpcConfig(configPath);
      if (loaded) {
        config = loaded;
        this.npcConfigCache.set(configPath, config);
      }
    }

    if (!config) {
      // loadNpcConfig already logged the error, just return null
      return null;
    }

    const npc = Npc.fromConfig(config, tileX, tileY, direction);
    this.npcs.set(npc.id, npc);

    // Set walkability checker for pathfinding
    npc.setWalkabilityChecker(this.isWalkable, this.isMapObstacle);

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
   */
  update(deltaTime: number): void {
    for (const [, npc] of this.npcs) {
      if (!npc.isVisible) continue;
      // Npc class handles its own update (movement, animation, AI)
      npc.update(deltaTime);
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
      // Check if NPC is an enemy (Fighter with Enemy relation or Fighter2)
      if (
        npc.kind === CharacterKind.Fighter ||
        npc.kind === CharacterKind.Fighter2 ||
        npc.kind === CharacterKind.Flyer
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
   * Load NPCs from a .npc file
   * Based on C#'s NpcManager.Load and Utils.GetNpcObjFilePath
   *
   * @param fileName - The NPC file name (e.g., "wudangshanxia.npc")
   * @param forceUtf8 - Force UTF-8 encoding (for .ini files that have been converted)
   */
  async loadNpcFile(fileName: string, forceUtf8: boolean = false): Promise<boolean> {
    console.log(`[NpcManager] Loading NPC file: ${fileName}`);

    // Try multiple paths like C# GetNpcObjFilePath
    const paths = [
      `/resources/save/game/${fileName}`,
      `/resources/ini/save/${fileName}`,
    ];

    // Determine encoding based on file extension
    // .npc files are binary and remain in GBK encoding
    // .ini files have been converted to UTF-8
    const isNpcFile = fileName.toLowerCase().endsWith('.npc');
    const useGbk = isNpcFile && !forceUtf8;

    for (const filePath of paths) {
      try {
        const response = await fetch(filePath);

        if (!response.ok) {
          continue;
        }

        // Check if it's actually an INI file (not Vite's HTML fallback)
        const contentType = response.headers.get('content-type') || '';
        if (contentType.includes('text/html')) {
          continue;
        }

        let content: string;
        if (useGbk) {
          // .npc files are binary files with GBK encoded Chinese text
          // Use ArrayBuffer + TextDecoder to decode properly
          const buffer = await response.arrayBuffer();
          let decoder: TextDecoder;
          try {
            decoder = new TextDecoder('gbk');
          } catch {
            decoder = new TextDecoder('utf-8');
          }
          content = decoder.decode(buffer);
        } else {
          // .ini files are UTF-8 encoded
          content = await response.text();
        }

        // Check if content is HTML
        if (content.trim().startsWith('<!DOCTYPE') || content.trim().startsWith('<html')) {
          continue;
        }

        console.log(`[NpcManager] Parsing NPC file from: ${filePath} (encoding: ${useGbk ? 'GBK' : 'UTF-8'})`);
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
        const promise = this.createNpcFromSection(section);
        loadPromises.push(promise);
      }
    }

    await Promise.all(loadPromises);
  }

  /**
   * Create NPC from INI section (from .npc save files)
   * Based on C# Character(KeyDataCollection) constructor
   *
   * NPC save files contain inline NPC data with NpcIni referencing resource files in npcres/
   * This is different from loading character config files from ini/npc/
   */
  private async createNpcFromSection(section: Record<string, string>): Promise<void> {
    const name = section["Name"] || "";
    const npcIni = section["NpcIni"] || "";
    const mapX = parseInt(section["MapX"] || "0", 10);
    const mapY = parseInt(section["MapY"] || "0", 10);
    const dir = parseInt(section["Dir"] || "4", 10);
    const kind = parseInt(section["Kind"] || "0", 10);
    const walkSpeed = parseInt(section["WalkSpeed"] || "1", 10);
    const dialogRadius = parseInt(section["DialogRadius"] || "1", 10);
    const visionRadius = parseInt(section["VisionRadius"] || "10", 10);
    const scriptFile = section["ScriptFile"] || "";
    const pathFinder = parseInt(section["PathFinder"] || "0", 10);
    const action = parseInt(section["Action"] || "0", 10);
    const relation = parseInt(section["Relation"] || "0", 10);
    const group = parseInt(section["Group"] || "0", 10);
    const noAutoAttackPlayer = parseInt(section["NoAutoAttackPlayer"] || "0", 10);

    // When loading from .npc files, NpcIni directly references resource file in npcres/
    // e.g., "npc146-武当山下酒肆老板.ini" -> "ini/npcres/npc146-武当山下酒肆老板.ini"
    // We create the config directly from section data (like C# Character(KeyDataCollection))

    const config: CharacterConfig = {
      name: name,
      npcIni: npcIni, // Resource file reference for sprite loading
      kind: kind as any,
      relation: relation as any,
      group: group,
      noAutoAttackPlayer: noAutoAttackPlayer,
      scriptFile: scriptFile,
      stats: {
        // Basic stats
        life: 100,
        lifeMax: 100,
        mana: 100,
        manaMax: 100,
        thew: 100,
        thewMax: 100,
        // Combat stats
        attack: 10,
        attack2: 0,
        attack3: 0,
        attackLevel: 0,
        defend: 10,
        defend2: 0,
        defend3: 0,
        evade: 0,
        // Experience & Level
        exp: 0,
        levelUpExp: 100,
        level: 1,
        canLevelUp: 0, // NPCs typically can't level up
        // Movement & Interaction
        walkSpeed: walkSpeed,
        addMoveSpeedPercent: 0,
        visionRadius: visionRadius,
        attackRadius: dialogRadius,
        dialogRadius: dialogRadius,
        // Other
        lum: 0,
        action: action,
      },
      pathFinder: pathFinder,
    };

    // Create NPC with inline config
    const npc = this.addNpcWithConfig(config, mapX, mapY, dir as any);
    // Set action type on the Npc instance
    npc.actionType = action;

    console.log(`[NpcManager] Created NPC from section: ${name} at (${mapX}, ${mapY}), npcIni=${npcIni}`);
  }

  /**
   * Create NPC from JSON save data (用于从 JSON 存档加载)
   * C# Reference: NpcManager.Load() - creates NPCs from saved data
   *
   * Similar to createNpcFromSection but uses NpcSaveItem format
   */
  async createNpcFromSaveData(npcData: {
    name: string;
    kind: number;
    relation: number;
    pathFinder: number;
    state: number;
    group: number;
    npcIni: string;
    mapX: number;
    mapY: number;
    dir: number;
    visionRadius: number;
    dialogRadius: number;
    attackRadius: number;
    level: number;
    exp: number;
    levelUpExp: number;
    life: number;
    lifeMax: number;
    thew: number;
    thewMax: number;
    mana: number;
    manaMax: number;
    attack: number;
    attack2: number;
    attackLevel: number;
    defend: number;
    defend2: number;
    evade: number;
    lum: number;
    walkSpeed: number;
    addMoveSpeedPercent: number;
    scriptFile?: string;
    scriptFileRight?: string;
    deathScript?: string;
    timerScriptFile?: string;
    timerScriptInterval?: number;
    flyIni?: string;
    flyIni2?: string;
    bodyIni?: string;
    dropIni?: string;
    buyIniFile?: string;
    noAutoAttackPlayer: number;
    invincible: number;
    isVisible: boolean;
    isDeath: boolean;
    isDeathInvoked: boolean;
    isAIDisabled: boolean;
    reviveMilliseconds: number;
    leftMillisecondsToRevive: number;
    actionPathTilePositions?: Array<{ x: number; y: number }>;
  }): Promise<void> {
    // Skip dead NPCs that have been removed
    if (npcData.isDeath && npcData.isDeathInvoked) {
      console.log(`[NpcManager] Skipping dead NPC: ${npcData.name}`);
      return;
    }

    const config: CharacterConfig = {
      name: npcData.name,
      npcIni: npcData.npcIni,
      kind: npcData.kind as any,
      relation: npcData.relation as any,
      group: npcData.group,
      noAutoAttackPlayer: npcData.noAutoAttackPlayer,
      scriptFile: npcData.scriptFile,
      stats: {
        // Basic stats
        life: npcData.life,
        lifeMax: npcData.lifeMax,
        mana: npcData.mana,
        manaMax: npcData.manaMax,
        thew: npcData.thew,
        thewMax: npcData.thewMax,
        // Combat stats
        attack: npcData.attack,
        attack2: npcData.attack2,
        attack3: 0,
        attackLevel: npcData.attackLevel,
        defend: npcData.defend,
        defend2: npcData.defend2,
        defend3: 0,
        evade: npcData.evade,
        // Experience & Level
        exp: npcData.exp,
        levelUpExp: npcData.levelUpExp,
        level: npcData.level,
        canLevelUp: 0,
        // Movement & Interaction
        walkSpeed: npcData.walkSpeed,
        addMoveSpeedPercent: npcData.addMoveSpeedPercent,
        visionRadius: npcData.visionRadius,
        attackRadius: npcData.attackRadius,
        dialogRadius: npcData.dialogRadius,
        // Other
        lum: npcData.lum,
        action: 0,
      },
      pathFinder: npcData.pathFinder,
    };

    // Create NPC with config
    const npc = this.addNpcWithConfig(config, npcData.mapX, npcData.mapY, npcData.dir as any);

    // Apply additional saved state
    npc.isVisible = npcData.isVisible;
    npc.isAIDisabled = npcData.isAIDisabled;

    // Restore scripts
    if (npcData.scriptFile !== undefined) {
      npc.scriptFile = npcData.scriptFile;
    }
    if (npcData.scriptFileRight !== undefined) {
      npc.scriptFileRight = npcData.scriptFileRight;
    }
    if (npcData.deathScript !== undefined) {
      npc.deathScript = npcData.deathScript;
    }
    if (npcData.timerScriptFile !== undefined) {
      npc.timerScript = npcData.timerScriptFile;
    }
    if (npcData.timerScriptInterval !== undefined) {
      npc.timerInterval = npcData.timerScriptInterval;
    }

    // Restore action path
    if (npcData.actionPathTilePositions && npcData.actionPathTilePositions.length > 0) {
      npc.actionPathTilePositions = npcData.actionPathTilePositions.map(p => ({ x: p.x, y: p.y }));
    }

    // Set other properties (these may not exist in current Npc class - skip for now)
    // npc.invincible = npcData.invincible;
    // npc.reviveMilliseconds = npcData.reviveMilliseconds;
    // npc.leftMillisecondsToRevive = npcData.leftMillisecondsToRevive;

    console.log(`[NpcManager] Created NPC from save: ${npcData.name} at (${npcData.mapX}, ${npcData.mapY})`);
  }

  /**
   * Set file name (用于从 JSON 存档加载时设置)
   */
  setFileName(fileName: string): void {
    this.fileName = fileName;
  }
}
