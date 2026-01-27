/**
 * InteractionManager - Manages interaction state for NPCs and Objects
 *
 * Based on C# implementation:
 * - Globals.cs: OutEdgeNpc, OutEdgeObj, OutEdgeSprite, OutEdgeColor
 * - Player.cs: HandleMouseInput - checks NPC/Obj under mouse for interaction
 * - Character.cs: InteractWith, PerformeInteract
 *
 * This manager tracks:
 * 1. Currently hovered NPC/Obj (for highlight rendering)
 * 2. Edge colors based on relation type (friend/enemy/neutral/obj)
 * 3. Interaction target for click-to-interact
 * 4. Obj interaction state (has been interacted with)
 */

import type { Vector2 } from "../core/types";
import type { Npc } from "../character/npc";
import type { Obj } from "../obj/obj";
import { pixelToTile, tileToPixel, distance } from "../core/utils";
import type { AsfData } from "../sprite/asf";

/**
 * Edge highlight colors (matching C# Globals.cs)
 * Colors are RGBA format for canvas rendering
 */
export const EdgeColors = {
  NPC: "rgba(255, 255, 0, 0.6)",        // Yellow - neutral NPC
  FRIEND: "rgba(0, 255, 0, 0.6)",       // Green - friendly NPC
  ENEMY: "rgba(255, 0, 0, 0.6)",        // Red - enemy NPC
  NONE: "rgba(0, 0, 255, 0.6)",         // Blue - non-combatant NPC
  OBJ: "rgba(255, 255, 0, 0.6)",        // Yellow - interactable object
} as const;

/**
 * Interaction target type
 */
export type InteractionTargetType = "npc" | "obj" | null;

/**
 * Current interaction target info
 */
export interface InteractionTarget {
  type: InteractionTargetType;
  npc: Npc | null;
  obj: Obj | null;
  edgeColor: string;
}

/**
 * Obj interaction state - tracks whether objects have been interacted with
 * C# equivalent is tracked within Obj.cs via IsRemoved and script state
 */
export interface ObjInteractionState {
  hasInteracted: boolean;
  interactTime: number;
  scriptResult?: any;
}

/**
 * InteractionManager - singleton for managing interaction state
 */
export class InteractionManager {
  // Current hover target (C#: Globals.OutEdgeNpc, OutEdgeObj, OutEdgeSprite)
  private _hoveredNpc: Npc | null = null;
  private _hoveredObj: Obj | null = null;
  private _edgeColor: string = EdgeColors.NPC;

  // Interaction state for objects
  private _objInteractionState: Map<string, ObjInteractionState> = new Map();

  // Interaction target offset (C#: Globals.OffX, OffY)
  private _offsetX: number = 0;
  private _offsetY: number = 0;

  /**
   * Clear all hover state (called at start of each frame)
   * C# Reference: Globals.ClearGlobalOutEdge()
   */
  clearHoverState(): void {
    this._hoveredNpc = null;
    this._hoveredObj = null;
    this._edgeColor = EdgeColors.NPC;
    this._offsetX = 0;
    this._offsetY = 0;
  }

  /**
   * Set hovered NPC
   */
  setHoveredNpc(npc: Npc | null): void {
    this._hoveredNpc = npc;
    this._hoveredObj = null;

    if (npc) {
      // Determine edge color based on NPC relation
      // C# Reference: Player.cs HandleMouseInput - edgeColor logic
      // Default: NpcEdgeColor (yellow)
      // IsEnemy: EnemyEdgeColor (red)
      // IsFighterFriend: FriendEdgeColor (green)
      // IsNoneFighter: NoneEdgeColor (blue)
      if (npc.isEnemy) {
        this._edgeColor = EdgeColors.ENEMY;
      } else if (npc.isFighterFriend) {
        this._edgeColor = EdgeColors.FRIEND;
      } else if (npc.isNoneFighter) {
        this._edgeColor = EdgeColors.NONE;
      } else {
        this._edgeColor = EdgeColors.NPC;
      }
    }
  }

  /**
   * Set hovered Obj
   */
  setHoveredObj(obj: Obj | null): void {
    this._hoveredObj = obj;
    this._hoveredNpc = null;
    this._edgeColor = EdgeColors.OBJ;

    if (obj) {
      this._offsetX = obj.offX;
      this._offsetY = obj.offY;
    }
  }

  /**
   * Get current hover target
   */
  getHoverTarget(): InteractionTarget {
    if (this._hoveredNpc) {
      return {
        type: "npc",
        npc: this._hoveredNpc,
        obj: null,
        edgeColor: this._edgeColor,
      };
    }
    if (this._hoveredObj) {
      return {
        type: "obj",
        npc: null,
        obj: this._hoveredObj,
        edgeColor: this._edgeColor,
      };
    }
    return {
      type: null,
      npc: null,
      obj: null,
      edgeColor: "",
    };
  }

  /**
   * Check if a specific NPC is hovered
   */
  isNpcHovered(npc: Npc): boolean {
    return this._hoveredNpc === npc;
  }

  /**
   * Check if a specific Obj is hovered
   */
  isObjHovered(obj: Obj): boolean {
    return this._hoveredObj === obj;
  }

  /**
   * Get the current edge color
   */
  getEdgeColor(): string {
    return this._edgeColor;
  }

  /**
   * Get offset for object rendering
   */
  getOffset(): { x: number; y: number } {
    return { x: this._offsetX, y: this._offsetY };
  }

  // ============= Obj Interaction State =============

  /**
   * Mark an object as interacted
   */
  markObjInteracted(objId: string, result?: any): void {
    this._objInteractionState.set(objId, {
      hasInteracted: true,
      interactTime: Date.now(),
      scriptResult: result,
    });
  }

  /**
   * Check if an object has been interacted with
   */
  hasObjBeenInteracted(objId: string): boolean {
    return this._objInteractionState.has(objId);
  }

  /**
   * Get interaction state for an object
   */
  getObjInteractionState(objId: string): ObjInteractionState | undefined {
    return this._objInteractionState.get(objId);
  }

  /**
   * Clear interaction state (on map change, etc.)
   */
  clearInteractionState(): void {
    this._objInteractionState.clear();
  }

  /**
   * Reset all state (for new game/load game)
   */
  reset(): void {
    this.clearHoverState();
    this.clearInteractionState();
  }

  // ============= Pixel Collision Detection =============

  /**
   * Check if a world position is within an NPC's sprite bounds
   * C# Reference: Collider.IsPixelCollideForNpcObj
   *
   * @param worldX World X coordinate
   * @param worldY World Y coordinate
   * @param npc The NPC to check
   * @returns True if point is within NPC sprite bounds
   */
  isPointInNpcBounds(worldX: number, worldY: number, npc: Npc): boolean {
    const texture = npc.texture;
    if (!texture) return false;

    // Get NPC's world position
    const npcPixelPos = npc.pixelPosition;

    // Calculate sprite bounds (matching C# Sprite.RegionInWorld)
    // AsfData uses width/height for frame dimensions, left/bottom for offset
    const spriteLeft = npcPixelPos.x - texture.left;
    const spriteTop = npcPixelPos.y - texture.bottom;
    const spriteRight = spriteLeft + texture.width;
    const spriteBottom = spriteTop + texture.height;

    // Check if point is within bounds
    return (
      worldX >= spriteLeft &&
      worldX <= spriteRight &&
      worldY >= spriteTop &&
      worldY <= spriteBottom
    );
  }

  /**
   * Check if a world position is within an Obj's sprite bounds
   * C# Reference: Collider.IsPixelCollideForNpcObj
   */
  isPointInObjBounds(worldX: number, worldY: number, obj: Obj): boolean {
    if (!obj.texture) return false;

    // Get Obj's pixel position from tile position
    const objPixelPos = obj.positionInWorld;

    // Calculate sprite bounds with offsets
    // AsfData uses width/height for frame dimensions, left/bottom for offset
    const spriteLeft = objPixelPos.x - obj.texture.left + obj.offX;
    const spriteTop = objPixelPos.y - obj.texture.bottom + obj.offY;
    const spriteRight = spriteLeft + obj.texture.width;
    const spriteBottom = spriteTop + obj.texture.height;

    // Check if point is within bounds
    return (
      worldX >= spriteLeft &&
      worldX <= spriteRight &&
      worldY >= spriteTop &&
      worldY <= spriteBottom
    );
  }

  /**
   * Check if a tile position matches an NPC's position
   */
  isTileOnNpc(tileX: number, tileY: number, npc: Npc): boolean {
    const npcTile = npc.tilePosition;
    return npcTile.x === tileX && npcTile.y === tileY;
  }

  /**
   * Check if a tile position matches an Obj's position
   */
  isTileOnObj(tileX: number, tileY: number, obj: Obj): boolean {
    return obj.tilePosition.x === tileX && obj.tilePosition.y === tileY;
  }
}
