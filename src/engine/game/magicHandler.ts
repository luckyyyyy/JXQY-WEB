/**
 * Magic Handler - Handles magic usage and management
 * Extracted from GameManager to reduce complexity
 *
 * C# Reference: Character.UseMagic, MagicManager.UseMagic
 */

import { getEngineContext } from "../core/engineContext";
import { logger } from "../core/logger";
import type { InputState, Vector2 } from "../core/types";
import { CharacterState } from "../core/types";
import { getDirectionFromVector, pixelToTile, tileToPixel } from "../core/utils";
import type { GuiManager } from "../gui/guiManager";
import type { MagicItemInfo, MagicManager } from "../magic";
import type { MagicListManager } from "../player/magic/magicListManager";
import type { Player } from "../player/player";
import type { InteractionManager } from "./interactionManager";
import { ResourcePath } from "@/config/resourcePaths";

/**
 * Dependencies for MagicHandler
 * 只保留无法通过 IEngineContext 获取的回调
 */
export interface MagicHandlerDependencies {
  getLastInput: () => InputState | null;
}

/**
 * MagicHandler - Manages magic usage, initialization, and UI interactions
 * 大部分依赖通过 IEngineContext 获取
 */
export class MagicHandler {
  private getLastInput: () => InputState | null;

  /**
   * 获取 Player（通过 IEngineContext）
   */
  private get player(): Player {
    const ctx = getEngineContext();
    return ctx.getPlayer() as Player;
  }

  /**
   * 获取 GuiManager（通过 IEngineContext）
   */
  private get guiManager(): GuiManager {
    const ctx = getEngineContext();
    return ctx.getGuiManager() as GuiManager;
  }

  /**
   * 获取 MagicManager（通过 IEngineContext）
   */
  private get magicManager(): MagicManager {
    const ctx = getEngineContext();
    return ctx.getMagicManager() as MagicManager;
  }

  /**
   * 获取 MagicListManager（通过 Player）
   */
  private get magicListManager(): MagicListManager {
    return this.player.getMagicListManager();
  }

  constructor(deps: MagicHandlerDependencies) {
    this.getLastInput = deps.getLastInput;
  }

  /**
   * Use magic from bottom slot index (0-4)
   * C# Reference: Character.UseMagic and PerformeAttack
   */
  async useMagicByBottomSlot(slotIndex: number): Promise<void> {
    const player = this.player;
    const guiManager = this.guiManager;
    const magicListManager = this.magicListManager;
    const _magicManager = this.magicManager;

    const magicInfo = magicListManager.getBottomMagicInfo(slotIndex);
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

    // C# Reference: Character.PerformActionOk() - check if can perform action
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

    // C# Reference: Player.CanUseMagic() - 内力/体力/生命消耗在动画结束后扣除
    // 这里不扣除，而是在 onMagicCast() 中扣除

    // Set cooldown
    magicListManager.setMagicCooldown(
      magicListManager.bottomIndexToListIndex(slotIndex),
      magicInfo.magic.coldMilliSeconds
    );

    // Set as current magic in use
    magicListManager.setCurrentMagicByBottomIndex(slotIndex);

    // Get player position - use actual pixel position from player data
    // C# Reference: MagicManager.UseMagic(this, MagicUse, PositionInWorld, _magicDestination, _magicTarget);
    // PositionInWorld is the character's current pixel position
    const playerPixel = player.pixelPosition;

    logger.log(
      `[Magic] Player pixelPosition: (${playerPixel.x}, ${playerPixel.y}), tilePosition: (${player.tilePosition.x}, ${player.tilePosition.y})`
    );

    // C# Reference: Player.HandleMouseInput - check OutEdgeNpc for targeting
    // if (Globals.OutEdgeNpc != null)
    //     UseMagic(CurrentMagicInUse.TheMagic, Globals.OutEdgeNpc.TilePosition, Globals.OutEdgeNpc);
    // else UseMagic(CurrentMagicInUse.TheMagic, mouseTilePosition);
    const interactionManager = getEngineContext().getInteractionManager() as InteractionManager;
    const hoverTarget = interactionManager.getHoverTarget();

    // C# Reference: Player.cs lines 1407-1419
    // Check BodyRadius requirement - need enemy target
    // if (CurrentMagicInUse.TheMagic.BodyRadius > 0 &&
    //     (Globals.OutEdgeNpc == null || !Globals.OutEdgeNpc.IsEnemy))
    // { GuiManager.ShowMessage("无有效目标"); }
    if (
      magicInfo.magic.bodyRadius > 0 &&
      (hoverTarget.npc === null || !hoverTarget.npc.isEnemy)
    ) {
      guiManager.showMessage("无有效目标");
      return;
    }

    // C# Reference: Player.cs lines 1415-1418
    // Check MoveKind == 21 requirement - need any target
    // else if (CurrentMagicInUse.TheMagic.MoveKind == 21 && Globals.OutEdgeNpc == null)
    // { GuiManager.ShowMessage("无目标"); }
    if (magicInfo.magic.moveKind === 21 && hoverTarget.npc === null) {
      guiManager.showMessage("无目标");
      return;
    }

    let destination: Vector2;
    let targetId: string | undefined;

    // Check for hovered NPC first (C#: Globals.OutEdgeNpc)
    if (hoverTarget.npc) {
      // Use NPC's tile position as destination
      // C# Reference: UseMagic(CurrentMagicInUse.TheMagic, Globals.OutEdgeNpc.TilePosition, Globals.OutEdgeNpc)
      const npcTilePos = hoverTarget.npc.tilePosition;
      destination = tileToPixel(npcTilePos.x, npcTilePos.y);
      targetId = hoverTarget.npc.name; // Use NPC name as ID

      logger.log(
        `[Magic] Targeting hovered NPC: ${hoverTarget.npc.name} at tile (${npcTilePos.x}, ${npcTilePos.y})`
      );
    } else {
      // No hovered NPC, use mouse position
      // C# Reference: UseMagic(CurrentMagicInUse.TheMagic, mouseTilePosition)
      const lastInput = this.getLastInput();

      if (lastInput && (lastInput.mouseWorldX !== 0 || lastInput.mouseWorldY !== 0)) {
        // C# Reference:
        // var mouseWorldPosition = Globals.TheCarmera.ToWorldPosition(mouseScreenPosition);
        // var mouseTilePosition = MapBase.ToTilePosition(mouseWorldPosition);
        // _magicDestination = MapBase.ToPixelPosition(magicDestinationTilePosition);

        const mouseWorldPos = {
          x: lastInput.mouseWorldX,
          y: lastInput.mouseWorldY,
        };
        const mouseTilePos = pixelToTile(mouseWorldPos.x, mouseWorldPos.y);
        destination = tileToPixel(mouseTilePos.x, mouseTilePos.y);

        logger.log(
          `[Magic] Targeting mouse position: tile (${mouseTilePos.x}, ${mouseTilePos.y})`
        );
      } else {
        // Fallback: use direction-based targeting if no mouse position
        const directionOffsets: Record<number, { x: number; y: number }> = {
          0: { x: 0, y: -100 }, // up
          1: { x: 70, y: -50 }, // up-right
          2: { x: 100, y: 0 }, // right
          3: { x: 70, y: 50 }, // down-right
          4: { x: 0, y: 100 }, // down
          5: { x: -70, y: 50 }, // down-left
          6: { x: -100, y: 0 }, // left
          7: { x: -70, y: -50 }, // up-left
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
    // C# Reference: SetDirection(_magicDestination - PositionInWorld)
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

    // C# Reference: StateInitialize(); ToFightingState();
    player.toFightingState();

    // C# Reference: Character.SetState(CharacterState.Magic) + PlayCurrentDirOnce()
    // Set player to Magic state for casting animation
    // Note: In C#, Magic state is handled in the switch statement, NOT via IsInSpecialAction
    // So we don't set isInSpecialAction = true here
    player.state = CharacterState.Magic;

    // Start the magic casting animation
    // C# Reference: if (magicUse.UseActionFile != null) Texture = magicUse.UseActionFile;
    // UseActionFile is the character casting animation (e.g., from asf/character/)
    const useActionFile = magicInfo.magic.useActionFile;
    if (useActionFile) {
      // Use magic-specific action file for casting animation
      // C#: UseActionFile is already a loaded Asf from "asf/character/" path
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

    // C# Reference: Character stores MagicUse, _magicDestination, _magicTarget for release in Update()
    // when IsPlayCurrentDirOnceEnd() - magic is released AFTER casting animation ends
    player.setPendingMagic(magicInfo.magic, playerPixel, destination, targetId);

    logger.log(
      `[Magic] Casting ${magicInfo.magic.name} Lv.${magicInfo.level}${targetId ? ` at ${targetId}` : ""}, will release after animation`
    );
  }

  /**
   * Initialize player with starting magics
   * Called after game initialization is complete
   *
   * C# Reference: MagicListManager.LoadPlayerList loads magics from ini file
   * Magics are stored in Store area (indices 1-36)
   * Player must manually drag them to bottom bar (indices 40-44)
   *
   * @param playerIndex The player save slot index (0-7), defaults to 0
   */
  async initializePlayerMagics(playerIndex: number = 0): Promise<void> {
    logger.log("[MagicHandler] Initializing player magics...");

    const magicListManager = this.magicListManager;

    // Load from save file (like C# MagicListManager.LoadPlayerList)
    // Path format: /resources/save/game/Magic{playerIndex}.ini
    const magicListPath = ResourcePath.saveGame(`Magic${playerIndex}.ini`);

    const loaded = await magicListManager.loadPlayerList(magicListPath);
    if (!loaded) {
      logger.warn(`[MagicHandler] Failed to load magic list from ${magicListPath}`);
    }

    // NOTE: Do NOT auto-move magics to bottom bar
    // C# behavior: Player must drag from MagicGui to BottomGui manually
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
    const magicListManager = this.magicListManager;
    const result: (MagicItemInfo | null)[] = [];
    for (let i = 0; i < 5; i++) {
      result.push(magicListManager.getBottomMagicInfo(i));
    }
    return result;
  }

  /**
   * Get magic items for store (for MagicGui display)
   * Returns all magics in store area (indices 1-36)
   */
  getStoreMagics(): (MagicItemInfo | null)[] {
    const magicListManager = this.magicListManager;
    return magicListManager.getStoreMagics();
  }

  /**
   * Handle magic drag-drop from MagicGui to BottomGui
   */
  handleMagicDrop(sourceStoreIndex: number, targetBottomSlot: number): void {
    const magicListManager = this.magicListManager;
    const targetListIndex = magicListManager.bottomIndexToListIndex(targetBottomSlot);
    magicListManager.exchangeListItem(sourceStoreIndex, targetListIndex);
    logger.log(
      `[Magic] Exchanged store index ${sourceStoreIndex} with bottom slot ${targetBottomSlot}`
    );
  }

  /**
   * Right-click magic in MagicGui to add to first empty bottom slot
   * C# Reference: MagicGui.MouseRightClickdHandler
   */
  handleMagicRightClick(storeIndex: number): void {
    const magicListManager = this.magicListManager;
    const guiManager = this.guiManager;
    const info = magicListManager.getItemInfo(storeIndex);
    if (!info) return;

    // Find first empty bottom slot
    for (let i = 0; i < 5; i++) {
      const bottomMagic = magicListManager.getBottomMagicInfo(i);
      if (!bottomMagic) {
        const targetListIndex = magicListManager.bottomIndexToListIndex(i);
        magicListManager.exchangeListItem(storeIndex, targetListIndex);
        logger.log(`[Magic] Moved magic from store ${storeIndex} to bottom slot ${i}`);
        return;
      }
    }

    guiManager.showMessage("快捷栏已满");
  }
}
