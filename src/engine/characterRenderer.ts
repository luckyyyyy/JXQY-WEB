/**
 * Character Renderer - handles loading and rendering character sprites
 * Based on JxqyHD character rendering system
 */

import type { NpcData, PlayerData, CharacterSpriteData, Direction, CharacterState } from "./core/types";
import {
  createCharacterSprite,
  loadSpriteSet,
  getAsfForState,
  updateSpriteAnimation,
  resetSpriteAnimation,
  drawCharacterSprite,
  type CharacterSprite,
  type SpriteSet,
} from "./sprite";
import { getFrameCanvas, getFrameIndex, type AsfData } from "./asf";

/**
 * Character Renderer manages sprite loading and rendering for all characters
 */
export class CharacterRenderer {
  // Sprite instances by character ID (or "player" for player)
  private sprites: Map<string, CharacterSprite> = new Map();
  // Loaded sprite sets cache
  private spriteSets: Map<string, SpriteSet> = new Map();
  // Loading promises to prevent duplicate loads
  private loadingPromises: Map<string, Promise<SpriteSet>> = new Map();

  /**
   * Get base file name from NPC INI path
   * e.g. "npc006_st.asf" -> "npc006"
   */
  private getBaseFileName(npcIni: string): string {
    // Remove file extension and path
    let name = npcIni.replace(/\\/g, "/");
    const lastSlash = name.lastIndexOf("/");
    if (lastSlash >= 0) {
      name = name.substring(lastSlash + 1);
    }

    // Remove extension
    const dotIdx = name.lastIndexOf(".");
    if (dotIdx >= 0) {
      name = name.substring(0, dotIdx);
    }

    // Remove state suffix (e.g., _st, _wlk, etc.)
    const suffixes = ["_st", "_pst", "_wlk", "_run", "_at", "_bat", "_die", "_sit", "_sst2", "_st2"];
    for (const suffix of suffixes) {
      if (name.endsWith(suffix)) {
        name = name.substring(0, name.length - suffix.length);
        break;
      }
    }

    return name;
  }

  /**
   * Load sprites for a character
   */
  async loadCharacterSprites(
    characterId: string,
    npcIni: string,
    basePath: string = "/resources/asf/character"
  ): Promise<void> {
    const baseFileName = this.getBaseFileName(npcIni);
    const cacheKey = `${basePath}/${baseFileName}`;

    // Check if already loaded
    if (this.sprites.has(characterId)) {
      return;
    }

    // Check if already loading
    let loadPromise = this.loadingPromises.get(cacheKey);
    if (!loadPromise) {
      loadPromise = loadSpriteSet(basePath, baseFileName);
      this.loadingPromises.set(cacheKey, loadPromise);
    }

    try {
      const spriteSet = await loadPromise;
      this.spriteSets.set(cacheKey, spriteSet);

      const sprite = createCharacterSprite(basePath, baseFileName);
      sprite.spriteSet = spriteSet;
      sprite.isLoaded = true;
      this.sprites.set(characterId, sprite);
    } catch (error) {
      console.warn(`Failed to load sprites for ${characterId}:`, error);
    }
  }

  /**
   * Load player sprites
   */
  async loadPlayerSprites(npcIni: string = "npc006"): Promise<void> {
    await this.loadCharacterSprites("player", npcIni);
  }

  /**
   * Load NPC sprites
   */
  async loadNpcSprites(npc: NpcData): Promise<void> {
    if (npc.config.npcIni) {
      await this.loadCharacterSprites(npc.id, npc.config.npcIni);
    }
  }

  /**
   * Update character animation
   */
  updateAnimation(
    characterId: string,
    state: CharacterState,
    deltaTime: number,
    _direction: Direction
  ): void {
    const sprite = this.sprites.get(characterId);
    if (sprite && sprite.isLoaded) {
      updateSpriteAnimation(sprite, state, deltaTime);
    }
  }

  /**
   * Draw a character
   */
  drawCharacter(
    ctx: CanvasRenderingContext2D,
    characterId: string,
    x: number,
    y: number,
    direction: Direction,
    state: CharacterState,
    name: string
  ): void {
    const sprite = this.sprites.get(characterId);

    if (sprite && sprite.isLoaded) {
      drawCharacterSprite(ctx, sprite, x, y, direction, state);
    } else {
      // Draw placeholder
      this.drawPlaceholder(ctx, x, y, characterId === "player" ? "#4a90d9" : "#d9a04a");
    }
  }

  /**
   * Draw placeholder for unloaded sprites
   */
  private drawPlaceholder(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    color: string
  ): void {
    ctx.save();

    // Shadow
    ctx.fillStyle = "rgba(0, 0, 0, 0.3)";
    ctx.beginPath();
    ctx.ellipse(x, y, 20, 10, 0, 0, Math.PI * 2);
    ctx.fill();

    // Body
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x, y - 20, 15, 0, Math.PI * 2);
    ctx.fill();

    // Direction indicator using arrow
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x, y - 20);
    ctx.lineTo(x + 10, y - 20);
    ctx.stroke();

    ctx.restore();
  }

  /**
   * Draw player
   */
  drawPlayer(
    ctx: CanvasRenderingContext2D,
    player: PlayerData,
    cameraX: number,
    cameraY: number
  ): void {
    const screenX = player.pixelPosition.x - cameraX;
    const screenY = player.pixelPosition.y - cameraY;

    this.drawCharacter(
      ctx,
      "player",
      screenX,
      screenY,
      player.direction,
      player.state,
      player.config.name
    );
  }

  /**
   * Draw NPC
   */
  drawNpc(
    ctx: CanvasRenderingContext2D,
    npc: NpcData,
    cameraX: number,
    cameraY: number
  ): void {
    if (!npc.isVisible) return;

    const screenX = npc.pixelPosition.x - cameraX;
    const screenY = npc.pixelPosition.y - cameraY;

    this.drawCharacter(
      ctx,
      npc.id,
      screenX,
      screenY,
      npc.direction,
      npc.state,
      npc.config.name
    );
  }

  /**
   * Draw all NPCs
   */
  drawAllNpcs(
    ctx: CanvasRenderingContext2D,
    npcs: Map<string, NpcData>,
    cameraX: number,
    cameraY: number,
    screenWidth: number,
    screenHeight: number
  ): void {
    // Collect visible NPCs and sort by Y position for proper layering
    const visibleNpcs: NpcData[] = [];

    for (const [, npc] of npcs) {
      if (!npc.isVisible) continue;

      const screenX = npc.pixelPosition.x - cameraX;
      const screenY = npc.pixelPosition.y - cameraY;

      // Skip if off-screen
      if (screenX < -100 || screenX > screenWidth + 100 ||
          screenY < -100 || screenY > screenHeight + 100) {
        continue;
      }

      visibleNpcs.push(npc);
    }

    // Sort by Y position (lower Y = further back = draw first)
    visibleNpcs.sort((a, b) => a.pixelPosition.y - b.pixelPosition.y);

    // Draw each NPC
    for (const npc of visibleNpcs) {
      this.drawNpc(ctx, npc, cameraX, cameraY);
    }
  }

  /**
   * Check if a character's sprites are loaded
   */
  isLoaded(characterId: string): boolean {
    const sprite = this.sprites.get(characterId);
    return sprite?.isLoaded ?? false;
  }

  /**
   * Clear all loaded sprites
   */
  clear(): void {
    this.sprites.clear();
    this.spriteSets.clear();
    this.loadingPromises.clear();
  }

  /**
   * Remove a specific character's sprites
   */
  removeCharacter(characterId: string): void {
    this.sprites.delete(characterId);
  }
}

// Global character renderer instance
let globalCharacterRenderer: CharacterRenderer | null = null;

/**
 * Get or create global character renderer
 */
export function getCharacterRenderer(): CharacterRenderer {
  if (!globalCharacterRenderer) {
    globalCharacterRenderer = new CharacterRenderer();
  }
  return globalCharacterRenderer;
}

/**
 * Reset global character renderer
 */
export function resetCharacterRenderer(): void {
  if (globalCharacterRenderer) {
    globalCharacterRenderer.clear();
  }
  globalCharacterRenderer = null;
}
