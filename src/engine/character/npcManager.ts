/**
 * NPC Manager - based on JxqyHD Engine/NpcManager.cs
 * Manages all NPCs in the game
 */
import type { NpcData, CharacterConfig, Vector2, Direction } from "../core/types";
import { CharacterState, CharacterKind } from "../core/types";
import {
  createNpcData,
  loadNpcConfig,
  updateCharacterMovement,
  updateCharacterAnimation,
  walkTo,
} from "./character";
import { generateId, distance } from "../core/utils";

export class NpcManager {
  private npcs: Map<string, NpcData> = new Map();
  private npcConfigCache: Map<string, CharacterConfig> = new Map();
  private isWalkable: (tile: Vector2) => boolean;

  constructor(isWalkable: (tile: Vector2) => boolean) {
    this.isWalkable = isWalkable;
  }

  /**
   * Set walkability checker
   */
  setWalkabilityChecker(checker: (tile: Vector2) => boolean): void {
    this.isWalkable = checker;
  }

  /**
   * Get all NPCs
   */
  getAllNpcs(): Map<string, NpcData> {
    return this.npcs;
  }

  /**
   * Get NPC by name
   */
  getNpc(name: string): NpcData | null {
    for (const [, npc] of this.npcs) {
      if (npc.config.name === name) {
        return npc;
      }
    }
    return null;
  }

  /**
   * Get NPC by ID
   */
  getNpcById(id: string): NpcData | null {
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
  ): Promise<NpcData | null> {
    let config: CharacterConfig | undefined = this.npcConfigCache.get(configPath);
    if (!config) {
      const loaded = await loadNpcConfig(configPath);
      if (loaded) {
        config = loaded;
        this.npcConfigCache.set(configPath, config);
      }
    }

    if (!config) {
      console.warn(`Failed to load NPC config: ${configPath}`);
      return null;
    }

    const id = generateId();
    const npc = createNpcData(id, config, tileX, tileY, direction);
    this.npcs.set(id, npc);
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
  ): NpcData {
    const id = generateId();
    const npc = createNpcData(id, config, tileX, tileY, direction);
    this.npcs.set(id, npc);
    return npc;
  }

  /**
   * Delete NPC by name
   */
  deleteNpc(name: string): boolean {
    for (const [id, npc] of this.npcs) {
      if (npc.config.name === name) {
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

    npc.tilePosition = { x: tileX, y: tileY };
    npc.path = [];
    return true;
  }

  /**
   * Make NPC walk to position
   */
  npcGoto(name: string, tileX: number, tileY: number): boolean {
    const npc = this.getNpc(name);
    if (!npc) return false;

    return walkTo(npc, { x: tileX, y: tileY }, this.isWalkable);
  }

  /**
   * Get closest interactable NPC to a position
   */
  getClosestInteractableNpc(position: Vector2, maxDistance: number = 100): NpcData | null {
    let closest: NpcData | null = null;
    let closestDist = Infinity;

    for (const [, npc] of this.npcs) {
      if (!npc.isVisible) continue;
      // Only eventer NPCs are interactable
      if (npc.config.kind !== CharacterKind.Eventer) continue;

      const dist = distance(position, npc.pixelPosition);
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
  getNpcAtTile(tileX: number, tileY: number): NpcData | null {
    for (const [, npc] of this.npcs) {
      if (npc.tilePosition.x === tileX && npc.tilePosition.y === tileY) {
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
      if (npc.tilePosition.x === tileX && npc.tilePosition.y === tileY) {
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

      // Update movement
      updateCharacterMovement(npc, deltaTime, this.isWalkable);

      // Update animation
      updateCharacterAnimation(npc, deltaTime);

      // AI behavior (for fighters)
      if (!npc.isAIDisabled && npc.config.kind === CharacterKind.Fighter) {
        this.updateNpcAI(npc, deltaTime);
      }
    }
  }

  /**
   * Simple NPC AI update
   */
  private updateNpcAI(npc: NpcData, _deltaTime: number): void {
    // Patrol behavior if has patrol path
    if (npc.actionPathTilePositions && npc.actionPathTilePositions.length > 0) {
      if (npc.path.length === 0) {
        // Get next patrol point
        const nextPoint = npc.actionPathTilePositions.shift()!;
        npc.actionPathTilePositions.push(nextPoint); // Loop
        walkTo(npc, nextPoint, this.isWalkable);
      }
    }
  }

  /**
   * Get visible NPCs in area
   */
  getVisibleNpcs(centerX: number, centerY: number, radius: number): NpcData[] {
    const result: NpcData[] = [];
    for (const [, npc] of this.npcs) {
      if (!npc.isVisible) continue;
      const dist = distance({ x: centerX, y: centerY }, npc.pixelPosition);
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
      console.warn(`NPC not found: ${name}`);
      return false;
    }

    // Store the action file mapping in sprite data
    if (!npc.sprite) {
      npc.sprite = {
        basePath: "/resources/asf/character",
        baseFileName: "",
        isLoaded: false,
        currentFrame: 0,
        animationTime: 0,
      };
    }

    // Store custom action files (state -> asf file)
    if (!npc.customActionFiles) {
      npc.customActionFiles = new Map();
    }
    npc.customActionFiles.set(stateType, asfFile);

    // If this is the current state, trigger a reload
    if (npc.state === stateType) {
      npc.sprite.isLoaded = false; // Mark for reload
    }

    return true;
  }

  /**
   * Get custom action file for NPC state
   */
  getNpcActionFile(name: string, stateType: number): string | null {
    const npc = this.getNpc(name);
    if (!npc || !npc.customActionFiles) return null;
    return npc.customActionFiles.get(stateType) || null;
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

    npc.config.stats.level = level;
    return true;
  }

  /**
   * Set NPC direction
   */
  setNpcDirection(name: string, direction: number): boolean {
    const npc = this.getNpc(name);
    if (!npc) return false;

    npc.direction = direction as any;
    return true;
  }

  /**
   * Set NPC state
   */
  setNpcState(name: string, state: number): boolean {
    const npc = this.getNpc(name);
    if (!npc) return false;

    npc.state = state as any;
    return true;
  }

  /**
   * Load NPCs from a .npc file
   * Based on C#'s NpcManager.Load
   */
  async loadNpcFile(fileName: string): Promise<boolean> {
    console.log(`[NpcManager] Loading NPC file: ${fileName}`);

    try {
      // .npc files are in ini/save/ directory
      const filePath = `/resources/ini/save/${fileName}`;
      const response = await fetch(filePath);

      if (!response.ok) {
        console.error(`[NpcManager] Failed to load NPC file: ${filePath}`);
        return false;
      }

      // Decode with GBK
      const buffer = await response.arrayBuffer();
      let decoder: TextDecoder;
      try {
        decoder = new TextDecoder("gbk");
      } catch {
        decoder = new TextDecoder("utf-8");
      }
      const content = decoder.decode(new Uint8Array(buffer));

      await this.parseNpcFile(content);
      console.log(`[NpcManager] Loaded ${this.npcs.size} NPCs`);
      return true;
    } catch (error) {
      console.error(`[NpcManager] Error loading NPC file:`, error);
      return false;
    }
  }

  /**
   * Parse NPC file content
   */
  private async parseNpcFile(content: string): Promise<void> {
    const sections = this.parseIni(content);

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
   * Create NPC from INI section
   */
  private async createNpcFromSection(section: Record<string, string>): Promise<void> {
    const name = section["Name"] || "";
    const npcIni = section["NpcIni"] || "";
    const mapX = parseInt(section["MapX"] || "0", 10);
    const mapY = parseInt(section["MapY"] || "0", 10);
    const dir = parseInt(section["Dir"] || "4", 10);

    if (!npcIni) {
      console.warn(`[NpcManager] NPC section missing NpcIni`);
      return;
    }

    // Load NPC from ini/npc/ directory
    const npcPath = `/resources/ini/npc/${npcIni}`;
    const npc = await this.addNpc(npcPath, mapX, mapY, dir as any);

    if (npc && name) {
      // Override name if specified in save file
      npc.config.name = name;
    }
  }

  /**
   * Simple INI parser
   */
  private parseIni(content: string): Record<string, Record<string, string>> {
    const sections: Record<string, Record<string, string>> = {};
    let currentSection = "";

    const lines = content.split(/\r?\n/);
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith(";") || trimmed.startsWith("//")) {
        continue;
      }

      const sectionMatch = trimmed.match(/^\[([^\]]+)\]$/);
      if (sectionMatch) {
        currentSection = sectionMatch[1];
        sections[currentSection] = {};
        continue;
      }

      const eqIdx = trimmed.indexOf("=");
      if (eqIdx > 0 && currentSection) {
        const key = trimmed.substring(0, eqIdx).trim();
        const value = trimmed.substring(eqIdx + 1).trim();
        sections[currentSection][key] = value;
      }
    }

    return sections;
  }
}
