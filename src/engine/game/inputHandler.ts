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
import type { Vector2, InputState } from "../core/types";
import { pixelToTile, tileToPixel } from "../core/utils";
import type { Player } from "../character/player";
import type { NpcManager } from "../character/npcManager";
import type { Npc } from "../character/npc";
import type { ObjManager } from "../obj/objManager";
import type { Obj } from "../obj/obj";
import type { GuiManager } from "../gui/guiManager";
import type { ScriptExecutor } from "../script/executor";
import type { DebugManager } from "../debug";
import type { MagicHandler } from "./magicHandler";
import type { InteractionManager } from "./interactionManager";
import type { AudioManager } from "../audio";

/**
 * Pending interaction target
 * C# Reference: Character._interactiveTarget
 */
interface PendingInteraction {
  type: "npc" | "obj";
  target: Npc | Obj;
  useRightScript: boolean;
  interactDistance: number;  // C#: 1 for obj, dialogRadius for NPC
}

/**
 * Dependencies for InputHandler
 */
export interface InputHandlerDependencies {
  player: Player;
  npcManager: NpcManager;
  objManager: ObjManager;
  guiManager: GuiManager;
  debugManager: DebugManager;
  interactionManager: InteractionManager;
  audioManager: AudioManager;
  getScriptExecutor: () => ScriptExecutor;
  getMagicHandler: () => MagicHandler;
  getScriptBasePath: () => string;
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

    const { player } = this.deps;
    const scriptExecutor = this.deps.getScriptExecutor();

    // Don't check if script is running
    if (scriptExecutor.isRunning()) return;

    // Check if player is standing (not walking)
    if (!player.isStanding()) {
      return;
    }

    // Check if player is close enough to interact
    if (this.checkInteractionDistance()) {
      // Close enough - perform the interaction
      console.log(`[InputHandler] Player reached target, performing interaction`);
      this.performPendingInteraction();
    } else {
      // Player stopped but not close enough - path may have failed
      const playerTile = player.tilePosition;
      const targetTile = this.pendingInteraction.type === "npc"
        ? (this.pendingInteraction.target as Npc).tilePosition
        : (this.pendingInteraction.target as Obj).tilePosition;
      const dist = this.getViewTileDistance(playerTile, targetTile);
      console.log(`[InputHandler] Player stopped at (${playerTile.x}, ${playerTile.y}), target at (${targetTile.x}, ${targetTile.y}), distance=${dist}, required=${this.pendingInteraction.interactDistance}`);
    }
  }

  /**
   * Check if player is within interaction distance of pending target
   * C# Reference: Character.InteractIsOk
   */
  private checkInteractionDistance(): boolean {
    if (!this.pendingInteraction) return false;

    const { player } = this.deps;
    const { target, interactDistance } = this.pendingInteraction;

    // Get tile positions
    const playerTile = player.tilePosition;
    const targetTile = this.pendingInteraction.type === "npc"
      ? (target as Npc).tilePosition
      : (target as Obj).tilePosition;

    // Calculate isometric tile distance (C#: PathFinder.GetViewTileDistance)
    const tileDistance = this.getViewTileDistance(playerTile, targetTile);

    return tileDistance <= interactDistance;
  }

  /**
   * Calculate tile distance in isometric coordinates
   * C# Reference: PathFinder.GetViewTileDistance -> GetTileDistanceOff
   *
   * In isometric maps, the distance calculation must account for
   * the staggered row layout (even/odd rows have different neighbor offsets)
   */
  private getViewTileDistance(startTile: Vector2, endTile: Vector2): number {
    if (startTile.x === endTile.x && startTile.y === endTile.y) return 0;

    let startX = Math.floor(startTile.x);
    let startY = Math.floor(startTile.y);
    const endX = Math.floor(endTile.x);
    const endY = Math.floor(endTile.y);

    // C#: If start and end tiles are not both at even row or odd row,
    // adjust the start position
    if (endY % 2 !== startY % 2) {
      // Change row to match parity
      startY += (endY < startY) ? 1 : -1;

      // Add column adjustment based on row parity
      if (endY % 2 === 0) {
        startX += (endX > startX) ? 1 : 0;
      } else {
        startX += (endX < startX) ? -1 : 0;
      }
    }

    const offX = Math.abs(startX - endX);
    const offY = Math.abs(startY - endY) / 2;

    return offX + offY;
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
    const { debugManager, guiManager } = this.deps;
    const scriptExecutor = this.deps.getScriptExecutor();
    const magicHandler = this.deps.getMagicHandler();

    if (debugManager.handleInput(code, shiftKey)) {
      return true;
    }

    if (guiManager.handleHotkey(code)) {
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
    const { npcManager, objManager, interactionManager, guiManager } = this.deps;
    const scriptExecutor = this.deps.getScriptExecutor();

    // Clear previous hover state
    interactionManager.clearHoverState();

    // Don't update hover if input is blocked
    if (guiManager.isBlockingInput() || scriptExecutor.isRunning()) {
      return;
    }

    const mouseTile = pixelToTile(worldX, worldY);

    // Check NPCs first (priority over objects)
    // C# Reference: Player.cs - iterates NpcsInView for OutEdgeNpc
    const allNpcs = npcManager.getAllNpcs();
    for (const [, npc] of allNpcs) {
      // Skip non-interactive NPCs
      if (!npc.isVisible || !this.isNpcInteractive(npc)) continue;

      // Check if mouse is over NPC (pixel collision)
      if (interactionManager.isPointInNpcBounds(worldX, worldY, npc)) {
        interactionManager.setHoveredNpc(npc);
        return; // NPC found, don't check objects
      }
    }

    // Check Objects if no NPC found
    // C# Reference: Player.cs - iterates ObjsInView for OutEdgeObj
    const visibleObjs = objManager.getObjsInView(viewRect);
    for (const obj of visibleObjs) {
      // Skip non-interactive objects
      if (!obj.isShow || obj.isRemoved) continue;
      // C# check: !one.IsInteractive || one.ScriptFileJustTouch > 0 || one.IsRemoved
      if (!obj.scriptFile || obj.scriptFile === "") continue;

      // Check if mouse is over Object (pixel collision or tile match)
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
   */
  handleClick(worldX: number, worldY: number, button: "left" | "right"): void {
    const { guiManager, interactionManager } = this.deps;
    const scriptExecutor = this.deps.getScriptExecutor();

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

    // Get current hover target
    const hoverTarget = interactionManager.getHoverTarget();

    if (button === "left") {
      // Left click: interact with hovered target
      if (hoverTarget.npc) {
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
      if (hoverTarget.npc && hoverTarget.npc.scriptFileRight) {
        this.interactWithNpc(hoverTarget.npc, true);
        return;
      }
      if (hoverTarget.obj && hoverTarget.obj.scriptFileRight) {
        this.interactWithObj(hoverTarget.obj, true);
        return;
      }
    }
  }

  /**
   * Handle continuous mouse input for movement
   */
  handleContinuousMouseInput(input: InputState): void {
    const { interactionManager } = this.deps;

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
    const { guiManager, player } = this.deps;

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
    const tileDistance = this.getViewTileDistance(playerTile, npcTile);

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
    const { player } = this.deps;
    const scriptExecutor = this.deps.getScriptExecutor();

    const scriptFile = useRightScript ? npc.scriptFileRight : npc.scriptFile;
    if (!scriptFile) return;

    // C# Reference: Character.StartInteract - turn to face each other
    const dx = npc.pixelPosition.x - player.pixelPosition.x;
    const dy = npc.pixelPosition.y - player.pixelPosition.y;
    player.setDirectionFromVector(dx, dy);
    npc.setDirectionFromVector(-dx, -dy);

    // Stop player movement
    player.stopMovement();

    const basePath = this.deps.getScriptBasePath();
    await scriptExecutor.runScript(
      `${basePath}/${scriptFile}`,
      { type: "npc", id: npc.name }
    );
  }

  /**
   * Interact with an Object
   * C# Reference: Character.InteractWith(target)
   * @param obj The object to interact with
   * @param useRightScript Use ScriptFileRight instead of ScriptFile
   */
  async interactWithObj(obj: Obj, useRightScript: boolean = false): Promise<void> {
    const { player } = this.deps;

    const scriptFile = useRightScript ? obj.scriptFileRight : obj.scriptFile;
    if (!scriptFile) {
      return;
    }

    // C# Reference: Character.GetInteractTargetInfo
    // For Objs, interactDistance is always 1
    const interactDistance = 1;
    const canInteractDirectly = (obj.canInteractDirectly || 0) > 0;

    // Check distance using isometric tile distance
    const playerTile = player.tilePosition;
    const objTile = obj.tilePosition;
    const tileDistance = this.getViewTileDistance(playerTile, objTile);

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
    const { player, interactionManager, audioManager } = this.deps;
    const scriptExecutor = this.deps.getScriptExecutor();

    const scriptFile = useRightScript ? obj.scriptFileRight : obj.scriptFile;
    if (!scriptFile) return;

    // Play object sound effect if exists
    // C# Reference: Obj.PlaySound() - called during interaction
    if (obj.wavFile) {
      audioManager.playSound(obj.wavFile);
    }

    // Mark object as interacted
    interactionManager.markObjInteracted(obj.id);

    // Player turns to face object
    const objPixelPos = obj.positionInWorld;
    const dx = objPixelPos.x - player.pixelPosition.x;
    const dy = objPixelPos.y - player.pixelPosition.y;
    player.setDirectionFromVector(dx, dy);

    // Stop player movement
    player.stopMovement();

    const basePath = this.deps.getScriptBasePath();
    await scriptExecutor.runScript(
      `${basePath}/${scriptFile}`,
      { type: "obj", id: obj.id }
    );
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
    const { player } = this.deps;

    const playerTile = player.tilePosition;

    // 计算从目标到玩家的方向
    const dx = playerTile.x - targetTile.x;
    const dy = playerTile.y - targetTile.y;

    // Use isometric tile distance (C#: PathFinder.GetViewTileDistance)
    const dist = this.getViewTileDistance(playerTile, targetTile);

    if (dist <= interactDistance) {
      // Already close enough
      return;
    }

    // C# Reference: PathFinder.FindDistanceTileInDirection
    // 计算目标位置（从目标指向玩家方向，距离 interactDistance）
    let destTile = this.findDistanceTileInDirection(
      targetTile,
      { x: dx, y: dy },
      interactDistance
    );

    // 获取碰撞检查器（通过 player 的 walkability checker 间接使用）
    const isWalkable = player.isWalkable;

    // C# Reference: Character.InteractWith - 如果目标位置不可达，尝试 8 个方向
    if (!isWalkable || !isWalkable(destTile) || this.hasObstacle(destTile)) {
      // 尝试所有 8 个方向
      // C# Utils.GetDirection8List() returns 8 direction vectors starting from South
      // Direction layout:
      // 3  4  5
      // 2     6
      // 1  0  7
      const direction8List = [
        { x: 0, y: 1 },    // 0: South
        { x: -1, y: 1 },   // 1: SouthWest
        { x: -1, y: 0 },   // 2: West
        { x: -1, y: -1 },  // 3: NorthWest
        { x: 0, y: -1 },   // 4: North
        { x: 1, y: -1 },   // 5: NorthEast
        { x: 1, y: 0 },    // 6: East
        { x: 1, y: 1 },    // 7: SouthEast
      ];

      let found = false;
      for (const dir of direction8List) {
        const tryTile = this.findDistanceTileInDirection(targetTile, dir, interactDistance);
        if (isWalkable && isWalkable(tryTile) && !this.hasObstacle(tryTile)) {
          destTile = tryTile;
          found = true;
          break;
        }
      }

      if (!found) {
        // C#: 所有方向都不可达，取消交互
        console.log(`[InputHandler] Cannot find walkable path to target at (${targetTile.x}, ${targetTile.y})`);
        this.pendingInteraction = null;
        return;
      }
    }

    // Walk to destination
    player.walkToTile(destTile.x, destTile.y);
    console.log(`[InputHandler] Walking to (${destTile.x}, ${destTile.y}) to interact with target at (${targetTile.x}, ${targetTile.y})`);
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
    const directionIndex = this.getDirectionIndexFromVector(direction);
    const neighbors = this.getNeighbors(tilePosition);
    return neighbors[directionIndex];
  }

  /**
   * Get direction index from a direction vector
   * C# Reference: Utils.GetDirectionIndex(direction, 8)
   * Direction layout:
   * 3  4  5
   * 2     6
   * 1  0  7
   */
  private getDirectionIndexFromVector(direction: Vector2): number {
    if (direction.x === 0 && direction.y === 0) return 0;

    const TWO_PI = Math.PI * 2;
    const directionCount = 8;

    // Normalize
    const length = Math.sqrt(direction.x * direction.x + direction.y * direction.y);
    const normX = direction.x / length;
    const normY = direction.y / length;

    // Calculate angle from South (0, 1) - matches C# Vector2.Dot(direction, new Vector2(0, 1))
    let angle = Math.acos(normY);
    if (normX > 0) angle = TWO_PI - angle;

    // 2*PI / (2*directionCount)
    const halfAnglePerDirection = Math.PI / directionCount;
    let region = Math.floor(angle / halfAnglePerDirection);
    if (region % 2 !== 0) region++;
    region %= 2 * directionCount;
    return region / 2;
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
        { x: x, y: y + 2 },      // 0: South
        { x: x - 1, y: y + 1 },  // 1: SouthWest
        { x: x - 1, y: y },      // 2: West
        { x: x - 1, y: y - 1 },  // 3: NorthWest
        { x: x, y: y - 2 },      // 4: North
        { x: x, y: y - 1 },      // 5: NorthEast
        { x: x + 1, y: y },      // 6: East
        { x: x, y: y + 1 },      // 7: SouthEast
      ];
    } else {
      // Odd row
      return [
        { x: x, y: y + 2 },      // 0: South
        { x: x, y: y + 1 },      // 1: SouthWest
        { x: x - 1, y: y },      // 2: West
        { x: x, y: y - 1 },      // 3: NorthWest
        { x: x, y: y - 2 },      // 4: North
        { x: x + 1, y: y - 1 },  // 5: NorthEast
        { x: x + 1, y: y },      // 6: East
        { x: x + 1, y: y + 1 },  // 7: SouthEast
      ];
    }
  }

  /**
   * Check if tile has NPC or Obj obstacle
   * C# Reference: Character.HasObstacle
   */
  private hasObstacle(tile: Vector2): boolean {
    const { npcManager, objManager } = this.deps;

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
    const { player, objManager } = this.deps;
    const closestObj = objManager.getClosestInteractableObj(player.tilePosition, 13);
    if (closestObj) {
      await this.interactWithObj(closestObj, false);
    }
  }

  /**
   * Interact with closest NPC (E key)
   */
  private async interactWithClosestNpc(): Promise<void> {
    const { player, npcManager } = this.deps;
    // Get closest interactive NPC within 13 tiles (matching C# MaxAutoInteractTileDistance)
    let closestNpc: Npc | null = null;
    let closestDist = 13;

    for (const [, npc] of npcManager.getAllNpcs()) {
      if (!npc.isVisible || !this.isNpcInteractive(npc)) continue;
      const dist = Math.abs(npc.tilePosition.x - player.tilePosition.x) +
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
    const { player } = this.deps;

    // C#: !IsPetrified && ControledCharacter == null
    // For now we just check basic conditions
    if (player.isSitting()) {
      // Already sitting - stand up
      player.standingImmediately();
      console.log(`[InputHandler] Player standing up from sit`);
    } else {
      // Not sitting - start sitting
      player.sitdown();
      console.log(`[InputHandler] Player starting to sit`);
    }
  }

  /**
   * Check if input can be processed (not blocked by GUI or script)
   */
  canProcessInput(): boolean {
    const { guiManager } = this.deps;
    const scriptExecutor = this.deps.getScriptExecutor();
    return !guiManager.isBlockingInput() && !scriptExecutor.isRunning();
  }
}
