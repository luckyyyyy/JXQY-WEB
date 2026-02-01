/**
 * Input Handler - Handles keyboard and mouse input
 * Extracted from GameManager to reduce complexity
 *
 * C# Reference: Player.cs HandleKeyboardInput, HandleMouseInput
 * C# Reference: Character.cs InteractWith, InteractIsOk, PerformeInteract
 *
 * Enhanced with interaction support:
 * - Mouse hover detection for NPCs and Objects
 * - Left click to interact with hovered target
 * - Right click for alternate interaction (ScriptFileRight)
 * - Distance checking: walk to target if too far
 */

import type { Npc } from "../character/npc";
import type { NpcManager } from "../character/npcManager";
import { getEngineContext } from "../core/engineContext";
import { logger } from "../core/logger";
import type { InputState, Vector2 } from "../core/types";
import { getDirectionFromVector, getViewTileDistance, pixelToTile } from "../core/utils";
import type { Obj } from "../obj/obj";
import type { Player } from "../player/player";
import type { ScriptExecutor } from "../script/executor";

/**
 * Pending interaction target
 * C# Reference: Character._interactiveTarget
 */
interface PendingInteraction {
  type: "npc" | "obj";
  target: Npc | Obj;
  useRightScript: boolean;
  interactDistance: number; // C#: 1 for obj, dialogRadius for NPC
}

/**
 * Dependencies for InputHandler
 * 仅保留无法通过 IEngineContext 获取的回调函数
 */
export interface InputHandlerDependencies {
  isTileWalkable: (tile: Vector2) => boolean; // 碰撞检测（需要地图上下文）
}

/**
 * InputHandler - Manages keyboard and mouse input processing
 */
export class InputHandler {
  private deps: InputHandlerDependencies;

  // Last known input state for mouse position access
  // C# Reference: Player.cs stores mouse state for targeting
  private lastInput: InputState | null = null;

  // Pending interaction target (player walking towards)
  // C# Reference: Character._interactiveTarget
  private pendingInteraction: PendingInteraction | null = null;

  // 通过 IEngineContext 获取的管理器
  private get player(): Player {
    return getEngineContext().player as Player;
  }

  private get guiManager() {
    return getEngineContext().getManager("gui");
  }

  private get interactionManager() {
    return getEngineContext().getManager("interaction");
  }

  private get scriptExecutor(): ScriptExecutor {
    return getEngineContext().getManager("script") as ScriptExecutor;
  }

  private get debugManager() {
    return getEngineContext().getManager("debug");
  }

  private get magicHandler() {
    return getEngineContext().getManager("magicHandler");
  }

  private get npcManager(): NpcManager {
    return getEngineContext().npcManager as NpcManager;
  }

  private get objManager() {
    return getEngineContext().getManager("obj");
  }

  private get audioManager() {
    return getEngineContext().audio;
  }

  private getScriptBasePath(): string {
    return getEngineContext().getScriptBasePath();
  }

  constructor(deps: InputHandlerDependencies) {
    this.deps = deps;
  }

  /**
   * Get last input state (for magic targeting, etc.)
   */
  getLastInput(): InputState | null {
    return this.lastInput;
  }

  /**
   * Store input state (called from update loop)
   */
  setLastInput(input: InputState): void {
    this.lastInput = input;
  }

  /**
   * Update - Check if player has reached pending interaction target
   * Called every frame from game loop
   * C# Reference: Character.InteractIsOk() called during Update
   */
  update(): void {
    if (!this.pendingInteraction) return;

    const player = this.player;
    const scriptExecutor = this.scriptExecutor;

    // Don't check if script is running
    if (scriptExecutor.isRunning()) return;

    // Check if player is standing (not walking)
    if (!player.isStanding()) {
      return;
    }

    // Check if player is close enough to interact
    if (this.checkInteractionDistance()) {
      // Close enough - perform the interaction
      logger.log(`[InputHandler] Player reached target, performing interaction`);
      this.performPendingInteraction();
    } else {
      // Player stopped but not close enough - try to move again
      // C# Reference: InteractIsOk() calls MoveToTarget when distance is not enough
      const targetTile =
        this.pendingInteraction.type === "npc"
          ? (this.pendingInteraction.target as Npc).tilePosition
          : (this.pendingInteraction.target as Obj).tilePosition;

      // Try to find a new path to target
      const { isTileWalkable } = this.deps;
      const destTile = this.findWalkableDestination(
        targetTile,
        this.pendingInteraction.interactDistance,
        isTileWalkable
      );

      if (destTile) {
        // Found a walkable destination, try again
        player.walkToTile(destTile.x, destTile.y);
        logger.log(
          `[InputHandler] Retrying path to (${destTile.x}, ${destTile.y}) for target at (${targetTile.x}, ${targetTile.y})`
        );
      } else {
        // No walkable path found - cancel interaction
        const playerTile = player.tilePosition;
        const dist = getViewTileDistance(playerTile, targetTile);
        logger.warn(
          `[InputHandler] Cannot find path to target at (${targetTile.x}, ${targetTile.y}), distance=${dist}, required=${this.pendingInteraction.interactDistance} - canceling`
        );
        this.pendingInteraction = null;
      }
    }
  }

  /**
   * Check if player is within interaction distance of pending target
   * C# Reference: Character.InteractIsOk
   */
  private checkInteractionDistance(): boolean {
    if (!this.pendingInteraction) return false;

    const player = this.player;
    const { target, interactDistance } = this.pendingInteraction;

    // Get tile positions
    const playerTile = player.tilePosition;
    const targetTile =
      this.pendingInteraction.type === "npc"
        ? (target as Npc).tilePosition
        : (target as Obj).tilePosition;

    // Calculate isometric tile distance (C#: PathFinder.GetViewTileDistance)
    const tileDistance = getViewTileDistance(playerTile, targetTile);

    return tileDistance <= interactDistance;
  }

  /**
   * Perform the pending interaction (player arrived at target)
   * C# Reference: Character.PerformeInteract
   */
  private async performPendingInteraction(): Promise<void> {
    if (!this.pendingInteraction) return;

    const { type, target, useRightScript } = this.pendingInteraction;

    // Clear pending before running script
    this.pendingInteraction = null;

    if (type === "npc") {
      await this.executeNpcInteraction(target as Npc, useRightScript);
    } else {
      await this.executeObjInteraction(target as Obj, useRightScript);
    }
  }

  /**
   * Handle keyboard input
   */
  handleKeyDown(code: string, shiftKey: boolean = false): boolean {
    const { debugManager, guiManager, scriptExecutor, magicHandler } = this;

    if (debugManager.handleInput(code, shiftKey)) {
      return true;
    }

    if (guiManager.handleHotkey(code)) {
      return true;
    }

    // Item hotkeys: Z, X, C (slots 0-2)
    // C# Reference: BottomGui.cs HandleKeyboardInput() - Keys.Z, Keys.X, Keys.C
    const itemHotkeys: Record<string, number> = {
      KeyZ: 0,
      KeyX: 1,
      KeyC: 2,
    };

    if (code in itemHotkeys && !scriptExecutor.isRunning()) {
      const slotIndex = itemHotkeys[code];
      this.useBottomGood(slotIndex);
      return true;
    }

    // Magic hotkeys: A, S, D, F, G (slots 0-4)
    // C# Reference: Player.cs HandleKeyboardInput()
    const magicHotkeys: Record<string, number> = {
      KeyA: 0,
      KeyS: 1,
      KeyD: 2,
      KeyF: 3,
      KeyG: 4,
    };

    if (code in magicHotkeys && !scriptExecutor.isRunning()) {
      const slotIndex = magicHotkeys[code];
      magicHandler.useMagicByBottomSlot(slotIndex);
      return true;
    }

    // Q key: interact with closest obj
    // E key: interact with closest NPC
    // C# Reference: Player.cs - Q/E keys for auto interact
    if (code === "KeyQ" && !scriptExecutor.isRunning()) {
      this.interactWithClosestObj();
      return true;
    }
    if (code === "KeyE" && !scriptExecutor.isRunning()) {
      this.interactWithClosestNpc();
      return true;
    }

    // V key: toggle sitting (打坐)
    // C# Reference: Player.cs - Keys.V for Sitdown/StandingImmediately
    if (code === "KeyV" && !scriptExecutor.isRunning()) {
      this.toggleSitting();
      return true;
    }

    return false;
  }

  /**
   * Use item from bottom goods slots (Z/X/C)
   * C# Reference: GuiManager.UsingBottomGood(index)
   */
  private async useBottomGood(slotIndex: number): Promise<void> {
    const player = this.player;

    // 从 Player 获取 GoodsListManager
    const goodsListManager = player.getGoodsListManager();

    // Bottom goods index: 221 + slotIndex (0-2)
    const actualIndex = 221 + slotIndex;
    const info = goodsListManager.getItemInfo(actualIndex);

    if (!info || !info.good) return;

    // Use the item
    const success = await goodsListManager.usingGood(actualIndex, player.level);
    if (success && info.good.kind === 0) {
      // GoodKind.Drug
      // Apply drug effect to player
      player.useDrug(info.good);
    }
  }

  /**
   * Update mouse hover state
   * Called every frame to detect NPCs/Objs under mouse cursor
   * C# Reference: Player.cs HandleMouseInput - OutEdge detection
   *
   * @param worldX Mouse world X coordinate
   * @param worldY Mouse world Y coordinate
   * @param viewRect View rectangle for filtering visible entities
   */
  updateMouseHover(
    worldX: number,
    worldY: number,
    viewRect: { x: number; y: number; width: number; height: number }
  ): void {
    const { npcManager, objManager, interactionManager, guiManager, scriptExecutor } = this;

    // Clear previous hover state
    interactionManager.clearHoverState();

    // Don't update hover if input is blocked
    if (guiManager.isBlockingInput() || scriptExecutor.isRunning()) {
      return;
    }

    const mouseTile = pixelToTile(worldX, worldY);

    // Check NPCs first (priority over objects)
    // C# Reference: Player.cs - iterates NpcsInView for OutEdgeNpc
    // 性能优化：使用 Update 阶段预计算的 npcsInView，避免重复遍历
    const npcsInView = npcManager.npcsInView;
    for (const npc of npcsInView) {
      // C# check: if (!one.IsInteractive || !one.IsVisible || one.IsDeath) continue;
      if (!npc.isInteractive || !npc.isVisible || npc.isDeath) continue;

      // Check if mouse is over NPC (pixel collision)
      // C#: Collider.IsPixelCollideForNpcObj(mouseWorldPosition, one.RegionInWorld, texture)
      if (interactionManager.isPointInNpcBounds(worldX, worldY, npc)) {
        interactionManager.setHoveredNpc(npc);
        return; // NPC found, don't check objects
      }
    }

    // Check Objects if no NPC found
    // C# Reference: Player.cs - iterates ObjsInView for OutEdgeObj
    // 性能优化：使用 Update 阶段预计算的 objsInView，避免重复遍历
    const visibleObjs = objManager.objsInView;
    for (const obj of visibleObjs) {
      // C# check: if (!one.IsInteractive || one.ScriptFileJustTouch > 0 || one.IsRemoved) continue;
      if (!obj.isInteractive || obj.scriptFileJustTouch > 0 || obj.isRemoved) continue;

      // Check if mouse is over Object (pixel collision or tile match)
      // C#: if (mouseTilePosition == one.TilePosition || Collider.IsPixelCollideForNpcObj(...))
      if (
        interactionManager.isTileOnObj(mouseTile.x, mouseTile.y, obj) ||
        interactionManager.isPointInObjBounds(worldX, worldY, obj)
      ) {
        interactionManager.setHoveredObj(obj);
        return;
      }
    }
  }

  /**
   * Check if NPC is interactive
   * C# Reference: Player.cs - !one.IsInteractive || !one.IsVisible || one.IsDeath
   * C# IsInteractive = (HasInteractScript || HasInteractScriptRight || IsEnemy || IsFighterFriend || IsNoneFighter)
   */
  private isNpcInteractive(npc: Npc): boolean {
    // C#: Character.IsInteractive property
    // Interactive if: has script, has right script, is enemy, is fighter friend, or is non-fighter
    return npc.isInteractive;
  }

  /**
   * Handle mouse click
   * Enhanced with interaction manager support
   * C# Reference: Player.HandleMouseInput - Ctrl+Click = attack, Alt+Click = jump
   */
  handleClick(
    worldX: number,
    worldY: number,
    button: "left" | "right",
    ctrlKey: boolean = false,
    altKey: boolean = false
  ): void {
    const { guiManager, interactionManager, player, scriptExecutor } = this;

    // C#: CanInput = !Globals.IsInputDisabled && !ScriptManager.IsInRunningScript && MouseInBound()
    // If script is running, only allow dialog clicks (handled by GUI blocking)
    if (guiManager.isBlockingInput()) {
      if (button === "left") {
        guiManager.handleDialogClick();
      }
      return;
    }

    // Don't process clicks when script is running (no movement allowed)
    if (scriptExecutor.isRunning()) {
      return;
    }

    // C# Reference: Player.HandleMouseInput - Alt+Left Click = jump
    if (button === "left" && altKey) {
      const clickedTile = pixelToTile(worldX, worldY);
      player.jumpTo(clickedTile);
      return;
    }

    // C# Reference: Player.HandleMouseInput - Ctrl+Left Click = attack at position
    // C#: character.PerformeAttack(mouseWorldPosition, GetRamdomMagicWithUseDistance(AttackRadius));
    // Note: This is an IMMEDIATE attack in place, NOT walk-then-attack
    if (button === "left" && ctrlKey) {
      // Perform attack immediately at clicked world position (no walking)
      player.performeAttack({ x: worldX, y: worldY });
      return;
    }

    // Get current hover target
    const hoverTarget = interactionManager.getHoverTarget();

    if (button === "left") {
      // C# Reference: Player.HandleMouseInput
      // If hovering over enemy NPC, attack it (walk to and attack)
      if (hoverTarget.npc) {
        // Check if NPC is enemy or non-fighter (can be attacked)
        if (hoverTarget.npc.isEnemy || hoverTarget.npc.isNoneFighter) {
          // Attack the NPC - walk to and attack
          this.attackNpc(hoverTarget.npc);
          return;
        }
        // Otherwise interact normally (talk)
        this.interactWithNpc(hoverTarget.npc, false);
        return;
      }
      if (hoverTarget.obj) {
        this.interactWithObj(hoverTarget.obj, false);
        return;
      }
    } else if (button === "right") {
      // Right click: alternate interaction (ScriptFileRight)
      // C# Reference: Player.cs - rightButtonPressed with HasInteractScriptRight
      if (hoverTarget.npc?.scriptFileRight) {
        this.interactWithNpc(hoverTarget.npc, true);
        return;
      }
      if (hoverTarget.obj?.hasInteractScriptRight) {
        this.interactWithObj(hoverTarget.obj, true);
        return;
      }
    }
  }

  /**
   * Attack an NPC - walk to target and attack
   * C# Reference: Player.HandleMouseInput - click on enemy NPC
   */
  private attackNpc(npc: Npc): void {
    const player = this.player;

    // Set auto attack target and start attacking
    player.setAutoAttackTarget(npc, false); // isRun = false for now
    player.attacking(npc.tilePosition, false);

    logger.log(`[InputHandler] Start attacking NPC: ${npc.name}`);
  }

  /**
   * Handle continuous mouse input for movement
   */
  handleContinuousMouseInput(input: InputState): void {
    const interactionManager = this.interactionManager;

    if (input.isMouseDown && input.clickedTile) {
      // If hovering over interactive target, don't process as movement
      const hoverTarget = interactionManager.getHoverTarget();
      if (hoverTarget.type !== null) {
        return;
      }
    }
  }

  /**
   * Interact with an NPC
   * C# Reference: Character.InteractWith(target)
   * @param npc The NPC to interact with
   * @param useRightScript Use ScriptFileRight instead of ScriptFile
   */
  async interactWithNpc(npc: Npc, useRightScript: boolean = false): Promise<void> {
    const { guiManager, player } = this;

    const scriptFile = useRightScript ? npc.scriptFileRight : npc.scriptFile;
    if (!scriptFile) {
      guiManager.showMessage("...");
      return;
    }

    // C# Reference: Character.GetInteractTargetInfo
    // For NPCs, interactDistance is DialogRadius (default 1)
    const interactDistance = npc.dialogRadius || 1;
    const canInteractDirectly = (npc.canInteractDirectly || 0) > 0;

    // Check distance using isometric tile distance
    const playerTile = player.tilePosition;
    const npcTile = npc.tilePosition;
    const tileDistance = getViewTileDistance(playerTile, npcTile);

    if (canInteractDirectly || tileDistance <= interactDistance) {
      // Close enough - interact immediately
      await this.executeNpcInteraction(npc, useRightScript);
    } else {
      // Too far - walk to NPC first
      this.pendingInteraction = {
        type: "npc",
        target: npc,
        useRightScript,
        interactDistance,
      };
      // Walk towards NPC (stop at interactDistance away)
      this.walkToTarget(npcTile, interactDistance);
    }
  }

  /**
   * Execute the actual NPC interaction (turn, face, run script)
   * C# Reference: Character.PerformeInteract, Character.StartInteract
   */
  private async executeNpcInteraction(npc: Npc, useRightScript: boolean): Promise<void> {
    const player = this.player;
    const scriptExecutor = this.scriptExecutor;

    const scriptFile = useRightScript ? npc.scriptFileRight : npc.scriptFile;
    if (!scriptFile) return;

    // C# Reference: Character.StartInteract - turn to face each other
    const dx = npc.pixelPosition.x - player.pixelPosition.x;
    const dy = npc.pixelPosition.y - player.pixelPosition.y;
    player.setDirectionFromDelta(dx, dy);
    npc.setDirectionFromDelta(-dx, -dy);

    // Stop player movement
    player.stopMovement();

    const basePath = this.getScriptBasePath();
    await scriptExecutor.runScript(`${basePath}/${scriptFile}`, { type: "npc", id: npc.name });
  }

  /**
   * Interact with an Object
   * C# Reference: Character.InteractWith(target)
   * @param obj The object to interact with
   * @param useRightScript Use ScriptFileRight instead of ScriptFile
   */
  async interactWithObj(obj: Obj, useRightScript: boolean = false): Promise<void> {
    const player = this.player;

    // Use Obj.canInteract() to check if interaction is possible
    if (!obj.canInteract(useRightScript)) {
      return;
    }

    // C# Reference: Character.GetInteractTargetInfo
    // For Objs, interactDistance is always 1
    const interactDistance = 1;
    const canInteractDirectly = (obj.canInteractDirectly || 0) > 0;

    // Check distance using isometric tile distance
    const playerTile = player.tilePosition;
    const objTile = obj.tilePosition;
    const tileDistance = getViewTileDistance(playerTile, objTile);

    if (canInteractDirectly || tileDistance <= interactDistance) {
      // Close enough - interact immediately
      await this.executeObjInteraction(obj, useRightScript);
    } else {
      // Too far - walk to Object first
      this.pendingInteraction = {
        type: "obj",
        target: obj,
        useRightScript,
        interactDistance,
      };
      // Walk towards Object (stop at interactDistance away)
      this.walkToTarget(objTile, interactDistance);
    }
  }

  /**
   * Execute the actual Object interaction (turn, run script)
   * C# Reference: Obj.StartInteract
   */
  private async executeObjInteraction(obj: Obj, useRightScript: boolean): Promise<void> {
    const { player, interactionManager, audioManager } = this;

    // Check if object can be interacted with
    if (!obj.canInteract(useRightScript)) return;

    // Play object sound effect if exists
    // C# Reference: Obj.PlaySound() - called during interaction
    if (obj.hasSound && audioManager) {
      audioManager.playSound(obj.getSoundFile());
    }

    // Mark object as interacted
    interactionManager.markObjInteracted(obj.id);

    // Player turns to face object
    const objPixelPos = obj.positionInWorld;
    const dx = objPixelPos.x - player.pixelPosition.x;
    const dy = objPixelPos.y - player.pixelPosition.y;
    player.setDirectionFromDelta(dx, dy);

    // Stop player movement
    player.stopMovement();

    // Use Obj.startInteract to run the script (now uses IEngineContext internally)
    obj.startInteract(useRightScript);
  }

  /**
   * Walk player towards a target tile
   * C# Reference: Character.InteractWith - 计算目标位置并处理障碍物
   *
   * C# 算法：
   * 1. 计算从目标指向玩家方向，距离目标 interactDistance 的位置
   * 2. 如果该位置是障碍物，尝试所有 8 个方向
   * 3. 如果所有方向都不可达，放弃交互
   */
  private walkToTarget(targetTile: Vector2, interactDistance: number): void {
    const player = this.player;

    // Use isometric tile distance (C#: PathFinder.GetViewTileDistance)
    const dist = getViewTileDistance(player.tilePosition, targetTile);

    if (dist <= interactDistance) {
      // Already close enough
      return;
    }

    const { isTileWalkable } = this.deps;
    const destTile = this.findWalkableDestination(targetTile, interactDistance, isTileWalkable);

    if (!destTile) {
      // C#: 所有方向都不可达，取消交互
      logger.log(
        `[InputHandler] Cannot find walkable path to target at (${targetTile.x}, ${targetTile.y})`
      );
      this.pendingInteraction = null;
      return;
    }

    // Walk to destination
    player.walkToTile(destTile.x, destTile.y);
    logger.log(
      `[InputHandler] Walking to (${destTile.x}, ${destTile.y}) to interact with target at (${targetTile.x}, ${targetTile.y})`
    );
  }

  /**
   * Find a walkable destination tile near target
   * Extracted from walkToTarget for reuse in update() retry logic
   * C# Reference: Character.InteractWith - 尝试 8 个方向找可达位置
   */
  private findWalkableDestination(
    targetTile: Vector2,
    interactDistance: number,
    isTileWalkable: (tile: Vector2) => boolean
  ): Vector2 | null {
    const player = this.player;
    const playerTile = player.tilePosition;

    // 计算从目标到玩家的方向
    const dx = playerTile.x - targetTile.x;
    const dy = playerTile.y - targetTile.y;

    // 计算目标位置（从目标指向玩家方向，距离 interactDistance）
    let destTile = this.findDistanceTileInDirection(targetTile, { x: dx, y: dy }, interactDistance);

    // 如果目标位置可达，直接返回
    if (isTileWalkable(destTile) && !this.hasObstacle(destTile)) {
      return destTile;
    }

    // 尝试所有 8 个方向
    const direction8List = [
      { x: 0, y: 1 }, // 0: South
      { x: -1, y: 1 }, // 1: SouthWest
      { x: -1, y: 0 }, // 2: West
      { x: -1, y: -1 }, // 3: NorthWest
      { x: 0, y: -1 }, // 4: North
      { x: 1, y: -1 }, // 5: NorthEast
      { x: 1, y: 0 }, // 6: East
      { x: 1, y: 1 }, // 7: SouthEast
    ];

    for (const dir of direction8List) {
      const tryTile = this.findDistanceTileInDirection(targetTile, dir, interactDistance);
      if (isTileWalkable(tryTile) && !this.hasObstacle(tryTile)) {
        return tryTile;
      }
    }

    return null; // 所有方向都不可达
  }

  /**
   * Find a tile at specified distance in a direction from origin
   * C# Reference: PathFinder.FindDistanceTileInDirection
   *
   * Key insight: In isometric maps, we can't just add direction * distance
   * because tiles don't follow simple Cartesian coordinates.
   * We must iterate through neighbors step by step.
   */
  private findDistanceTileInDirection(
    origin: Vector2,
    direction: Vector2,
    distance: number
  ): Vector2 {
    // C#: if (direction == Vector2.Zero || tileDistance < 1) return tilePosition;
    if ((direction.x === 0 && direction.y === 0) || distance < 1) {
      return origin;
    }

    // C#: for (var i = 0; i < tileDistance; i++) { neighbor = FindNeighborInDirection(neighbor, direction); }
    let current = origin;
    for (let i = 0; i < distance; i++) {
      current = this.findNeighborInDirection(current, direction);
    }

    return current;
  }

  /**
   * Find neighbor tile in a specific direction
   * C# Reference: PathFinder.FindNeighborInDirection(tilePosition, direction)
   */
  private findNeighborInDirection(tilePosition: Vector2, direction: Vector2): Vector2 {
    if (direction.x === 0 && direction.y === 0) {
      return tilePosition;
    }

    // C#: return FindAllNeighbors(tilePosition)[Utils.GetDirectionIndex(direction, 8)];
    const directionIndex = getDirectionFromVector(direction);
    const neighbors = this.getNeighbors(tilePosition);
    return neighbors[directionIndex];
  }

  /**
   * Get all 8 neighbors of a tile in isometric coordinates
   * C# Reference: PathFinder.FindAllNeighbors
   * Direction layout:
   * 3  4  5
   * 2     6
   * 1  0  7
   */
  private getNeighbors(tile: Vector2): Vector2[] {
    const x = tile.x;
    const y = tile.y;

    if (Math.floor(y) % 2 === 0) {
      // Even row
      return [
        { x: x, y: y + 2 }, // 0: South
        { x: x - 1, y: y + 1 }, // 1: SouthWest
        { x: x - 1, y: y }, // 2: West
        { x: x - 1, y: y - 1 }, // 3: NorthWest
        { x: x, y: y - 2 }, // 4: North
        { x: x, y: y - 1 }, // 5: NorthEast
        { x: x + 1, y: y }, // 6: East
        { x: x, y: y + 1 }, // 7: SouthEast
      ];
    } else {
      // Odd row
      return [
        { x: x, y: y + 2 }, // 0: South
        { x: x, y: y + 1 }, // 1: SouthWest
        { x: x - 1, y: y }, // 2: West
        { x: x, y: y - 1 }, // 3: NorthWest
        { x: x, y: y - 2 }, // 4: North
        { x: x + 1, y: y - 1 }, // 5: NorthEast
        { x: x + 1, y: y }, // 6: East
        { x: x + 1, y: y + 1 }, // 7: SouthEast
      ];
    }
  }

  /**
   * Check if tile has NPC or Obj obstacle
   * C# Reference: Character.HasObstacle
   */
  private hasObstacle(tile: Vector2): boolean {
    const { npcManager, objManager } = this;

    // Check NPC collision
    if (npcManager.isObstacle(tile.x, tile.y)) {
      return true;
    }

    // Check Obj collision
    if (objManager.isObstacle(tile.x, tile.y)) {
      return true;
    }

    return false;
  }

  /**
   * Cancel pending interaction (e.g., when player clicks elsewhere)
   */
  cancelPendingInteraction(): void {
    this.pendingInteraction = null;
  }

  /**
   * Interact with closest object (Q key)
   */
  private async interactWithClosestObj(): Promise<void> {
    const { player, objManager } = this;
    const closestObj = objManager.getClosestInteractableObj(player.tilePosition, 13);
    if (closestObj) {
      await this.interactWithObj(closestObj, false);
    }
  }

  /**
   * Interact with closest NPC (E key)
   */
  private async interactWithClosestNpc(): Promise<void> {
    const { player, npcManager } = this;
    // Get closest interactive NPC within 13 tiles (matching C# MaxAutoInteractTileDistance)
    let closestNpc: Npc | null = null;
    let closestDist = 13;

    for (const [, npc] of npcManager.getAllNpcs()) {
      if (!npc.isVisible || !this.isNpcInteractive(npc)) continue;
      const dist =
        Math.abs(npc.tilePosition.x - player.tilePosition.x) +
        Math.abs(npc.tilePosition.y - player.tilePosition.y);
      if (dist <= closestDist) {
        closestDist = dist;
        closestNpc = npc;
      }
    }

    if (closestNpc) {
      await this.interactWithNpc(closestNpc, false);
    }
  }

  /**
   * Toggle sitting state (V key)
   * C# Reference: Player.cs Update() - Keys.V handling
   * if (IsSitting()) StandingImmediately();
   * else Sitdown();
   */
  private toggleSitting(): void {
    const player = this.player;

    // C#: !IsPetrified && ControledCharacter == null
    // For now we just check basic conditions
    if (player.isSitting()) {
      // Already sitting - stand up
      player.standingImmediately();
      logger.log(`[InputHandler] Player standing up from sit`);
    } else {
      // Not sitting - start sitting
      player.sitdown();
      logger.log(`[InputHandler] Player starting to sit`);
    }
  }

  /**
   * Check if input can be processed (not blocked by GUI or script)
   */
  canProcessInput(): boolean {
    const guiManager = this.guiManager;
    const scriptExecutor = this.scriptExecutor;
    return !guiManager.isBlockingInput() && !scriptExecutor.isRunning();
  }
}
