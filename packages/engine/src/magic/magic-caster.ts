/**
 * Magic Handler - Handles magic usage and management
 * Extracted from GameManager to reduce complexity
 *
 * MagicManager.UseMagic
 */

import { getEngineContext } from "../core/engine-context";
import { logger } from "../core/logger";
import { CharacterState, type Vector2 } from "../core/types";
import type { GuiManager } from "../gui/gui-manager";
import type { PlayerMagicInventory } from "../player/magic/player-magic-inventory";
import type { Player } from "../player/player";
import type { InputState } from "../runtime/input-types";
import type { InteractionManager } from "../runtime/interaction-manager";
import { getDirectionFromVector, pixelToTile, tileToPixel } from "../utils";
import type { MagicItemInfo } from "./";

/**
 * Dependencies for MagicCaster
 * 只保留无法通过 EngineContext 获取的回调
 */
export interface MagicCasterDependencies {
  getLastInput: () => InputState;
}

/**
 * MagicCaster - Manages magic usage, initialization, and UI interactions
 * 大部分依赖通过 EngineContext 获取
 */
export class MagicCaster {
  protected get engine() {
    return getEngineContext();
  }

  private getLastInput: () => InputState;

  private get player(): Player {
    return this.engine.player as Player;
  }

  private get guiManager(): GuiManager {
    return this.engine.guiManager as GuiManager;
  }

  /**
   * 获取 PlayerMagicInventory（通过 Player）
   */
  private get magicInventory(): PlayerMagicInventory {
    return this.player.getPlayerMagicInventory();
  }

  constructor(deps: MagicCasterDependencies) {
    this.getLastInput = deps.getLastInput;
  }

  /**
   * Use magic from bottom slot index (0-4)
   * and PerformeAttack
   */
  async useMagicByBottomSlot(slotIndex: number): Promise<void> {
    const player = this.player;
    const guiManager = this.guiManager;
    const magicInventory = this.magicInventory;
    const _magicSpriteManager = this.engine.magicSpriteManager;

    const magicInfo = magicInventory.getBottomMagicInfo(slotIndex);
    if (!magicInfo || !magicInfo.magic) {
      logger.log(`[Magic] No magic in bottom slot ${slotIndex}`);
      return;
    }

    // Check if player can use magic (mana, cooldown, etc.)
    const canUse = player.canUseMagic(magicInfo.magic);

    if (!canUse.canUse) {
      guiManager.showMessage(canUse.reason || "无法使用武功");
      return;
    }

    // Check cooldown
    if (magicInfo.remainColdMilliseconds > 0) {
      guiManager.showMessage("武功冷却中");
      return;
    }

    // Reference: Character.PerformActionOk() - check if can perform action
    // Cannot use magic when: jumping, attacking, hurting, dead, petrified, etc.
    if (
      player.state === CharacterState.Jump ||
      player.state === CharacterState.Attack ||
      player.state === CharacterState.Attack1 ||
      player.state === CharacterState.Attack2 ||
      player.state === CharacterState.Magic ||
      player.state === CharacterState.Hurt ||
      player.state === CharacterState.Death
    ) {
      logger.log(`[Magic] Cannot use magic in state: ${player.state}`);
      return;
    }

    // Reference: Player.CanUseMagic() - 内力/体力/生命消耗在动画结束后扣除
    // 这里不扣除，而是在 onMagicCast() 中扣除

    // Set cooldown
    magicInventory.setMagicCooldown(
      magicInventory.bottomIndexToListIndex(slotIndex),
      magicInfo.magic.coldMilliSeconds
    );

    // Set as current magic in use
    magicInventory.setCurrentMagicByBottomIndex(slotIndex);

    // Get player position - use actual pixel position from player data
    // Reference: MagicManager.UseMagic(this, MagicUse, PositionInWorld, _magicDestination, _magicTarget);
    // PositionInWorld is the character's current pixel position
    const playerPixel = player.pixelPosition;

    logger.log(
      `[Magic] Player pixelPosition: (${playerPixel.x}, ${playerPixel.y}), tilePosition: (${player.tilePosition.x}, ${player.tilePosition.y})`
    );

    // check OutEdgeNpc for targeting
    // if (Globals.OutEdgeNpc != null)
    //     UseMagic(CurrentMagicInUse.TheMagic, Globals.OutEdgeNpc.TilePosition, Globals.OutEdgeNpc);
    // else UseMagic(CurrentMagicInUse.TheMagic, mouseTilePosition);
    const interactionManager = this.engine.interactionManager as InteractionManager;
    const hoverTarget = interactionManager.getHoverTarget();

    // lines 1407-1419
    // Check BodyRadius requirement - need enemy target
    // if (CurrentMagicInUse.TheMagic.BodyRadius > 0 &&
    //     (Globals.OutEdgeNpc == null || !Globals.OutEdgeNpc.IsEnemy))
    // { GuiManager.ShowMessage("无有效目标"); }
    if (
      magicInfo.magic.bodyRadius > 0 &&
      (hoverTarget.type !== "npc" || !hoverTarget.npc.isEnemy)
    ) {
      guiManager.showMessage("无有效目标");
      return;
    }

    // lines 1415-1418
    // Check MoveKind == 21 requirement - need any target
    // else if (CurrentMagicInUse.TheMagic.MoveKind == 21 && Globals.OutEdgeNpc == null)
    // { GuiManager.ShowMessage("无目标"); }
    if (magicInfo.magic.moveKind === 21 && hoverTarget.type !== "npc") {
      guiManager.showMessage("无目标");
      return;
    }

    let destination: Vector2;
    let targetId: string | undefined;

    // Check for hovered NPC first
    if (hoverTarget.type === "npc") {
      // Use NPC's tile position as destination
      // Reference: UseMagic(CurrentMagicInUse.TheMagic, Globals.OutEdgeNpc.TilePosition, Globals.OutEdgeNpc)
      const npcTilePos = hoverTarget.npc.tilePosition;
      destination = tileToPixel(npcTilePos.x, npcTilePos.y);
      targetId = hoverTarget.npc.id; // Use NPC internal ID (matches getNpcById)

      logger.log(
        `[Magic] Targeting hovered NPC: ${hoverTarget.npc.name} (id=${hoverTarget.npc.id}) at tile (${npcTilePos.x}, ${npcTilePos.y})`
      );
    } else {
      // No hovered NPC, use mouse position
      // Reference: UseMagic(CurrentMagicInUse.TheMagic, mouseTilePosition)
      const lastInput = this.getLastInput();

      if (lastInput.mouseWorldX !== 0 || lastInput.mouseWorldY !== 0) {
        // Reference:
        // var mouseWorldPosition = Globals.TheCarmera.ToWorldPosition(mouseScreenPosition);
        // var mouseTilePosition = MapBase.ToTilePosition(mouseWorldPosition);
        // _magicDestination = MapBase.ToPixelPosition(magicDestinationTilePosition);

        const mouseWorldPos = {
          x: lastInput.mouseWorldX,
          y: lastInput.mouseWorldY,
        };
        const mouseTilePos = pixelToTile(mouseWorldPos.x, mouseWorldPos.y);
        destination = tileToPixel(mouseTilePos.x, mouseTilePos.y);

        logger.log(`[Magic] Targeting mouse position: tile (${mouseTilePos.x}, ${mouseTilePos.y})`);
      } else {
        // Fallback: use direction-based targeting if no mouse position
        // Direction: 0=South, 1=SW, 2=W, 3=NW, 4=North, 5=NE, 6=E, 7=SE
        const directionOffsets: Record<number, { x: number; y: number }> = {
          0: { x: 0, y: 100 }, // south (down)
          1: { x: -70, y: 50 }, // southwest
          2: { x: -100, y: 0 }, // west (left)
          3: { x: -70, y: -50 }, // northwest
          4: { x: 0, y: -100 }, // north (up)
          5: { x: 70, y: -50 }, // northeast
          6: { x: 100, y: 0 }, // east (right)
          7: { x: 70, y: 50 }, // southeast
        };
        const offset = directionOffsets[player.direction] || { x: 0, y: 100 };
        destination = {
          x: playerPixel.x + offset.x,
          y: playerPixel.y + offset.y,
        };
        logger.log(`[Magic] Using direction-based targeting, direction: ${player.direction}`);
      }
    }

    // Calculate direction from player to destination and turn player
    // Reference: SetDirection(_magicDestination - PositionInWorld)
    const dirVector = {
      x: destination.x - playerPixel.x,
      y: destination.y - playerPixel.y,
    };
    const newDirection = getDirectionFromVector(dirVector);
    player.setDirection(newDirection);

    // Debug log
    const dirNames = [
      "South",
      "Southwest",
      "West",
      "Northwest",
      "North",
      "Northeast",
      "East",
      "Southeast",
    ];
    logger.log(
      `[Magic] Direction: (${dirVector.x.toFixed(0)}, ${dirVector.y.toFixed(0)}) -> ${dirNames[newDirection]} (${newDirection})`
    );

    // Reference: StateInitialize(); ToFightingState();
    player.toFightingState();

    // Reference: Character.SetState(CharacterState.Magic) + PlayCurrentDirOnce()
    // Set player to Magic state for casting animation
    // Note: Magic state is handled in the switch statement, NOT via IsInSpecialAction
    // So we don't set isInSpecialAction = true here
    player.state = CharacterState.Magic;

    // Start the magic casting animation
    // if (magicUse.UseActionFile != null) Texture = magicUse.UseActionFile;
    // UseActionFile is the character casting animation (e.g., from asf/character/)
    const useActionFile = magicInfo.magic.useActionFile;
    if (useActionFile) {
      // Use magic-specific action file for casting animation
      // UseActionFile is already a loaded Asf from "asf/character/" path
      const asf = await player.loadCustomAsf(useActionFile);
      if (asf) {
        logger.log(`[Magic] Loaded casting animation: ${useActionFile}`);
        player.texture = asf;
        player.playCurrentDirOnce();
      } else {
        logger.warn(`[Magic] Failed to load magic UseActionFile: ${useActionFile}, using default`);
        // Fallback to default magic state animation
        player.playStateOnce(CharacterState.Magic);
      }
    } else {
      // No magic-specific UseActionFile, use default magic state animation from npcres
      const started = player.playStateOnce(CharacterState.Magic);
      if (!started) {
        logger.warn(`[Magic] Failed to start casting animation, falling back to stand`);
      }
    }

    // stores MagicUse, _magicDestination, _magicTarget for release in Update()
    // when IsPlayCurrentDirOnceEnd() - magic is released AFTER casting animation ends
    player.setPendingMagic(magicInfo.magic, playerPixel, destination, targetId);

    logger.log(
      `[Magic] Casting ${magicInfo.magic.name} Lv.${magicInfo.level}${targetId ? ` at ${targetId}` : ""}, will release after animation`
    );
  }

  /**
   * Add magic to player's magic list
   * Used by script commands (AddMagic)
   * 委托给 Player.addMagic
   */
  async addPlayerMagic(magicFile: string, level: number = 1): Promise<boolean> {
    const player = this.player;
    return player.addMagic(magicFile, level);
  }

  /**
   * Get magic items for bottom slots (for UI display)
   * Returns 5 MagicItemInfo for bottom slots
   */
  getBottomMagics(): (MagicItemInfo | null)[] {
    const magicInventory = this.magicInventory;
    const result: (MagicItemInfo | null)[] = [];
    for (let i = 0; i < 5; i++) {
      result.push(magicInventory.getBottomMagicInfo(i));
    }
    return result;
  }

  /**
   * Get magic items for store (for MagicGui display)
   * Returns all magics in store area (indices 1-36)
   */
  getStoreMagics(): (MagicItemInfo | null)[] {
    const magicInventory = this.magicInventory;
    return magicInventory.getStoreMagics();
  }

  /**
   * Handle magic drag-drop from MagicGui to BottomGui
   */
  handleMagicDrop(sourceStoreIndex: number, targetBottomSlot: number): void {
    const magicInventory = this.magicInventory;
    const targetListIndex = magicInventory.bottomIndexToListIndex(targetBottomSlot);
    magicInventory.exchangeListItem(sourceStoreIndex, targetListIndex);
    logger.log(
      `[Magic] Exchanged store index ${sourceStoreIndex} with bottom slot ${targetBottomSlot}`
    );
  }

  /**
   * Right-click magic in MagicGui to add to first empty bottom slot
   */
  handleMagicRightClick(storeIndex: number): void {
    const magicInventory = this.magicInventory;
    const guiManager = this.guiManager;
    const info = magicInventory.getItemInfo(storeIndex);
    if (!info) return;

    // Find first empty bottom slot
    for (let i = 0; i < 5; i++) {
      const bottomMagic = magicInventory.getBottomMagicInfo(i);
      if (!bottomMagic) {
        const targetListIndex = magicInventory.bottomIndexToListIndex(i);
        magicInventory.exchangeListItem(storeIndex, targetListIndex);
        logger.log(`[Magic] Moved magic from store ${storeIndex} to bottom slot ${i}`);
        return;
      }
    }

    guiManager.showMessage("快捷栏已满");
  }
}
