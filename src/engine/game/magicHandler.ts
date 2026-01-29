/**
 * Magic Handler - Handles magic usage and management
 * Extracted from GameManager to reduce complexity
 *
 * C# Reference: Character.UseMagic, MagicManager.UseMagic
 */
import type { Vector2, PlayerData, InputState } from "../core/types";
import { CharacterState } from "../core/types";
import { pixelToTile, tileToPixel, getDirectionFromVector } from "../core/utils";
import type { Player } from "../character/player";
import type { GuiManager } from "../gui/guiManager";
import type { MagicListManager, MagicManager, MagicData, MagicItemInfo } from "../magic";
import { loadMagic } from "../magic";
import type { AudioManager } from "../audio";

/**
 * Dependencies for MagicHandler
 */
export interface MagicHandlerDependencies {
  player: Player;
  guiManager: GuiManager;
  magicListManager: MagicListManager;
  magicManager: MagicManager;
  audioManager: AudioManager;
  getLastInput: () => InputState | null;
}

/**
 * MagicHandler - Manages magic usage, initialization, and UI interactions
 */
export class MagicHandler {
  private deps: MagicHandlerDependencies;

  constructor(deps: MagicHandlerDependencies) {
    this.deps = deps;
    // Set magic manager reference on player for direct magic release
    this.deps.player.setMagicManager(this.deps.magicManager);
    // Set audio manager on player for state sound effects (e.g., Magic state sound)
    // C# Reference: PlaySoundEffect(NpcIni[(int)CharacterState.Magic].Sound)
    this.deps.player.setAudioManager(this.deps.audioManager);
  }

  /**
   * Use magic from bottom slot index (0-4)
   * C# Reference: Character.UseMagic and PerformeAttack
   */
  async useMagicByBottomSlot(slotIndex: number): Promise<void> {
    const { player, guiManager, magicListManager, magicManager } = this.deps;

    const magicInfo = magicListManager.getBottomMagicInfo(slotIndex);
    if (!magicInfo || !magicInfo.magic) {
      console.log(`[Magic] No magic in bottom slot ${slotIndex}`);
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
      console.log(`[Magic] Cannot use magic in state: ${player.state}`);
      return;
    }

    // Consume resources (mana, thew, life)
    player.consumeMagicCost(magicInfo.magic);

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

    console.log(
      `[Magic] Player pixelPosition: (${playerPixel.x}, ${playerPixel.y}), tilePosition: (${player.tilePosition.x}, ${player.tilePosition.y})`
    );

    // C# Reference: Character.UseMagic() uses mouse position for targeting
    // SetDirection(_magicDestination - PositionInWorld)
    // Get target from mouse position if available, otherwise use direction-based fallback
    let destination: Vector2;
    const lastInput = this.deps.getLastInput();

    if (lastInput && (lastInput.mouseWorldX !== 0 || lastInput.mouseWorldY !== 0)) {
      // C# Reference:
      // var mouseWorldPosition = Globals.TheCarmera.ToWorldPosition(mouseScreenPosition);
      // var mouseTilePosition = MapBase.ToTilePosition(mouseWorldPosition);
      // UseMagic(CurrentMagicInUse.TheMagic, mouseTilePosition);
      // Then in Character.UseMagic:
      // _magicDestination = MapBase.ToPixelPosition(magicDestinationTilePosition);

      // Step 1: Get mouse world position
      const mouseWorldPos = {
        x: lastInput.mouseWorldX,
        y: lastInput.mouseWorldY,
      };

      // Step 2: Convert to tile position
      const mouseTilePos = pixelToTile(mouseWorldPos.x, mouseWorldPos.y);

      // Step 3: Convert tile position back to pixel position (this is the actual destination)
      destination = tileToPixel(mouseTilePos.x, mouseTilePos.y);

      // Get player tile position for comparison
      const playerTilePos = pixelToTile(playerPixel.x, playerPixel.y);

      // Calculate direction from player to destination and turn player
      // C# Reference: SetDirection(_magicDestination - PositionInWorld)
      const dirVector = {
        x: destination.x - playerPixel.x,
        y: destination.y - playerPixel.y,
      };
      const newDirection = getDirectionFromVector(dirVector);
      player.setDirection(newDirection);

      // Debug: explain the direction calculation
      // Direction system: 0=South, 1=SW, 2=West, 3=NW, 4=North, 5=NE, 6=East, 7=SE
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
      const tileDiff = {
        x: mouseTilePos.x - playerTilePos.x,
        y: mouseTilePos.y - playerTilePos.y,
      };
      console.log(
        `[Magic] Player tile: (${playerTilePos.x}, ${playerTilePos.y}), Mouse tile: (${mouseTilePos.x}, ${mouseTilePos.y}), Tile diff: (${tileDiff.x}, ${tileDiff.y})`
      );
      console.log(
        `[Magic] Pixel diff: (${dirVector.x.toFixed(0)}, ${dirVector.y.toFixed(0)}) -> ${dirNames[newDirection]} (${newDirection})`
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
      console.log(`[Magic] Using direction-based targeting, direction: ${player.direction}`);
    }

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
        console.log(`[Magic] Loaded casting animation: ${useActionFile}`);
        player.texture = asf;
        player.playCurrentDirOnce();
      } else {
        console.warn(`[Magic] Failed to load magic UseActionFile: ${useActionFile}, using default`);
        // Fallback to default magic state animation
        player.playStateOnce(CharacterState.Magic);
      }
    } else {
      // No magic-specific UseActionFile, use default magic state animation from npcres
      const started = player.playStateOnce(CharacterState.Magic);
      if (!started) {
        console.warn(`[Magic] Failed to start casting animation, falling back to stand`);
      }
    }

    // C# Reference: Character stores MagicUse, _magicDestination for release in Update()
    // when IsPlayCurrentDirOnceEnd() - magic is released AFTER casting animation ends
    player.setPendingMagic(magicInfo.magic, playerPixel, destination);

    console.log(`[Magic] Casting ${magicInfo.magic.name} Lv.${magicInfo.level}, will release after animation`);
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
    console.log("[MagicHandler] Initializing player magics...");

    const { magicListManager } = this.deps;

    // Load from save file (like C# MagicListManager.LoadPlayerList)
    // Path format: /resources/save/game/Magic{playerIndex}.ini
    const magicListPath = `/resources/save/game/Magic${playerIndex}.ini`;

    const loaded = await magicListManager.loadPlayerList(magicListPath);
    if (!loaded) {
      console.warn(`[MagicHandler] Failed to load magic list from ${magicListPath}`);
    }

    // NOTE: Do NOT auto-move magics to bottom bar
    // C# behavior: Player must drag from MagicGui to BottomGui manually
  }

  /**
   * Add magic to player's magic list
   * Used by script commands (AddMagic)
   */
  async addPlayerMagic(magicFile: string, level: number = 1): Promise<boolean> {
    try {
      const magic = await loadMagic(`/resources/ini/magic/${magicFile}`);
      if (magic) {
        return this.deps.magicListManager.addMagic(magic, level);
      }
    } catch (error) {
      console.error(`[Magic] Failed to add magic ${magicFile}:`, error);
    }
    return false;
  }

  /**
   * Get magic items for bottom slots (for UI display)
   * Returns 5 MagicItemInfo for bottom slots
   */
  getBottomMagics(): (MagicItemInfo | null)[] {
    const result: (MagicItemInfo | null)[] = [];
    for (let i = 0; i < 5; i++) {
      result.push(this.deps.magicListManager.getBottomMagicInfo(i));
    }
    return result;
  }

  /**
   * Get magic items for store (for MagicGui display)
   * Returns all magics in store area (indices 1-36)
   */
  getStoreMagics(): (MagicItemInfo | null)[] {
    return this.deps.magicListManager.getStoreMagics();
  }

  /**
   * Handle magic drag-drop from MagicGui to BottomGui
   */
  handleMagicDrop(sourceStoreIndex: number, targetBottomSlot: number): void {
    const { magicListManager } = this.deps;
    const targetListIndex = magicListManager.bottomIndexToListIndex(targetBottomSlot);
    magicListManager.exchangeListItem(sourceStoreIndex, targetListIndex);
    console.log(`[Magic] Exchanged store index ${sourceStoreIndex} with bottom slot ${targetBottomSlot}`);
  }

  /**
   * Right-click magic in MagicGui to add to first empty bottom slot
   * C# Reference: MagicGui.MouseRightClickdHandler
   */
  handleMagicRightClick(storeIndex: number): void {
    const { magicListManager, guiManager } = this.deps;
    const info = magicListManager.getItemInfo(storeIndex);
    if (!info) return;

    // Find first empty bottom slot
    for (let i = 0; i < 5; i++) {
      const bottomMagic = magicListManager.getBottomMagicInfo(i);
      if (!bottomMagic) {
        const targetListIndex = magicListManager.bottomIndexToListIndex(i);
        magicListManager.exchangeListItem(storeIndex, targetListIndex);
        console.log(`[Magic] Moved magic from store ${storeIndex} to bottom slot ${i}`);
        return;
      }
    }

    guiManager.showMessage("快捷栏已满");
  }
}
