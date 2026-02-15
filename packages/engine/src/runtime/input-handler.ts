/**
 * Input Handler - Handles keyboard and mouse input
 * Extracted from GameManager to reduce complexity
 *
 * HandleKeyboardInput, HandleMouseInput
 * InteractWith, InteractIsOk, PerformeInteract
 *
 * Enhanced with interaction support:
 * - Mouse hover detection for NPCs and Objects
 * - Left click to interact with hovered target
 * - Right click for alternate interaction (ScriptFileRight)
 * - Distance checking: walk to target if too far
 */

import type { Character } from "../character/character";
import { getEngineContext } from "../core/engine-context";
import { logger } from "../core/logger";
import { CharacterState, type Vector2 } from "../core/types";
import type { Npc, NpcManager } from "../npc";
import type { Obj } from "../obj/obj";
import type { Player } from "../player/player";
import { resolveScriptPath } from "../resource/resource-paths";
import { getViewTileDistance, pixelToTile } from "../utils";
import { findDistanceTileInDirection } from "../utils/path-finder";
import { createDefaultInputState, type InputState } from "./input-types";

/**
 * Pending interaction target
 */
interface PendingInteraction {
  type: "npc" | "obj";
  target: Npc | Obj;
  useRightScript: boolean;
  interactDistance: number; // 1 for obj, dialogRadius for NPC
}

/**
 * Dependencies for InputHandler
 * 仅保留无法通过 EngineContext 获取的回调函数
 */
export interface InputHandlerDependencies {
  isTileWalkable: (tile: Vector2) => boolean; // 碰撞检测（需要地图上下文）
}

/**
 * InputHandler - Manages keyboard and mouse input processing
 */
export class InputHandler {
  protected get engine() {
    return getEngineContext();
  }

  private deps: InputHandlerDependencies;

  // Last known input state for mouse position access
  // stores mouse state for targeting
  private lastInput: InputState;

  // Pending interaction target (player walking towards)
  private pendingInteraction: PendingInteraction | null = null;

  // Player.cs _lastMouseState
  // 跟踪上一帧的鼠标按键状态，用于检测"新按下"事件
  private lastLeftButtonDown: boolean = false;
  private lastRightButtonDown: boolean = false;

  /** 便捷访问: Player（需要类型转换） */
  private get player(): Player {
    return this.engine.player as Player;
  }

  /** 便捷访问: NpcManager（需要类型转换） */
  private get npcManager(): NpcManager {
    return this.engine.npcManager as NpcManager;
  }

  constructor(deps: InputHandlerDependencies) {
    this.deps = deps;
    this.lastInput = createDefaultInputState();
  }

  /**
   * 获取当前活动角色（被控角色优先）
   * var character = ControledCharacter ?? this
   *
   * 驭魂术（MoveKind=21）允许玩家控制一个 NPC，此时：
   * - 移动/攻击/交互操作转发到被控角色
   * - 不能使用武功
   * - 强制走路（不能跑）
   */
  getActiveCharacter(): Character {
    const player = this.player;
    return player.controledCharacter ?? player;
  }

  /**
   * 检查是否正在控制其他角色
   */
  isControllingCharacter(): boolean {
    return this.player.controledCharacter !== null;
  }

  /**
   * Get last input state (for magic targeting, etc.)
   */
  getLastInput(): InputState {
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
   * called during Update
   */
  update(): void {
    if (!this.pendingInteraction) return;

    const player = this.player;
    const scriptExecutor = this.engine.scriptExecutor;

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
      // Reference: InteractIsOk() calls MoveToTarget when distance is not enough
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

    // Calculate isometric tile distance
    const tileDistance = getViewTileDistance(playerTile, targetTile);

    return tileDistance <= interactDistance;
  }

  /**
   * Perform the pending interaction (player arrived at target)
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
    const debugManager = this.engine.debugManager;
    const guiManager = this.engine.guiManager;
    const scriptExecutor = this.engine.scriptExecutor;
    const magicCaster = this.engine.magicCaster;

    if (debugManager.handleInput(code, shiftKey)) {
      return true;
    }

    if (guiManager.handleHotkey(code)) {
      return true;
    }

    // Item hotkeys: Z, X, C (slots 0-2)
    // HandleKeyboardInput() - Keys.Z, Keys.X, Keys.C
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
    // HandleKeyboardInput()
    const magicHotkeys: Record<string, number> = {
      KeyA: 0,
      KeyS: 1,
      KeyD: 2,
      KeyF: 3,
      KeyG: 4,
    };

    if (code in magicHotkeys && !scriptExecutor.isRunning()) {
      const slotIndex = magicHotkeys[code];
      magicCaster.useMagicByBottomSlot(slotIndex);
      return true;
    }

    // Q key: interact with closest obj
    // E key: interact with closest NPC
    // Q/E keys for auto interact
    if (code === "KeyQ" && !scriptExecutor.isRunning()) {
      this.interactWithClosestObj();
      return true;
    }
    if (code === "KeyE" && !scriptExecutor.isRunning()) {
      this.interactWithClosestNpc();
      return true;
    }

    // V key: toggle sitting (打坐)
    // Keys.V for Sitdown/StandingImmediately
    if (code === "KeyV" && !scriptExecutor.isRunning()) {
      this.toggleSitting();
      return true;
    }

    return false;
  }

  /**
   * Use item from bottom goods slots (Z/X/C)
   * Reference: GuiManager.UsingBottomGood(index)
   */
  private async useBottomGood(slotIndex: number): Promise<void> {
    const player = this.player;
    const goodsListManager = player.getGoodsListManager();
    await goodsListManager.useBottomSlot(slotIndex, player, (fn) =>
      (this.engine.npcManager as NpcManager).forEachPartner(fn)
    );
  }

  /**
   * Update mouse hover state
   * Called every frame to detect NPCs/Objs under mouse cursor
   * HandleMouseInput - OutEdge detection
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
    const npcManager = this.engine.npcManager as NpcManager;
    const objManager = this.engine.objManager;
    const interactionManager = this.engine.interactionManager;
    const guiManager = this.engine.guiManager;
    const scriptExecutor = this.engine.scriptExecutor;

    // Clear previous hover state
    interactionManager.clearHoverState();

    // Don't update hover if input is blocked
    if (guiManager.isBlockingInput() || scriptExecutor.isRunning()) {
      return;
    }

    const mouseTile = pixelToTile(worldX, worldY);

    // Check NPCs first (priority over objects)
    // iterates NpcsInView for OutEdgeNpc
    // 性能优化：使用 Update 阶段预计算的 npcsInView，避免重复遍历
    const npcsInView = npcManager.npcsInView;
    for (const npc of npcsInView) {
      // check: if (!one.IsInteractive || !one.IsVisible || one.IsDeath) continue;
      if (!npc.isInteractive || !npc.isVisible || npc.isDeath) continue;

      // Check if mouse is over NPC (pixel collision)
      // Collider.IsPixelCollideForNpcObj(mouseWorldPosition, one.RegionInWorld, texture)
      if (interactionManager.isPointInNpcBounds(worldX, worldY, npc)) {
        interactionManager.setHoveredNpc(npc);
        return; // NPC found, don't check objects
      }
    }

    // Check Objects if no NPC found
    // iterates ObjsInView for OutEdgeObj
    // 性能优化：使用 Update 阶段预计算的 objsInView，避免重复遍历
    const visibleObjs = objManager.objsInView;
    for (const obj of visibleObjs) {
      // check: if (!one.IsInteractive || one.ScriptFileJustTouch > 0 || one.IsRemoved) continue;
      if (!obj.isInteractive || obj.scriptFileJustTouch > 0 || obj.isRemoved) continue;

      // Check if mouse is over Object (pixel collision or tile match)
      // if (mouseTilePosition == one.TilePosition || Collider.IsPixelCollideForNpcObj(...))
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
   * !one.IsInteractive || !one.IsVisible || one.IsDeath
   * IsInteractive = (HasInteractScript || HasInteractScriptRight || IsEnemy || IsFighterFriend || IsNoneFighter)
   */
  private isNpcInteractive(npc: Npc): boolean {
    // Character.IsInteractive property
    // Interactive if: has script, has right script, is enemy, is fighter friend, or is non-fighter
    return npc.isInteractive;
  }

  /**
   * Handle mouse click
   * Enhanced with interaction manager support and ControledCharacter (驭魂术) support
   * Ctrl+Click = attack, Alt+Click = jump
   *
   * 中交互只在 _lastMouseState.LeftButton == Released 时触发
   * 这里通过 lastLeftButtonDown/lastRightButtonDown 模拟相同逻辑
   */
  handleClick(
    worldX: number,
    worldY: number,
    button: "left" | "right",
    ctrlKey: boolean = false,
    altKey: boolean = false
  ): void {
    const guiManager = this.engine.guiManager;
    const interactionManager = this.engine.interactionManager;
    const player = this.engine.player as Player;
    const scriptExecutor = this.engine.scriptExecutor;
    const magicCaster = this.engine.magicCaster;

    // _lastMouseState.LeftButton == ButtonState.Released
    // 只在"新按下"时触发交互，防止重复触发
    if (button === "left") {
      if (this.lastLeftButtonDown) {
        // 上一帧已经按下，不是新按下，忽略
        return;
      }
      this.lastLeftButtonDown = true;
    } else {
      if (this.lastRightButtonDown) {
        return;
      }
      this.lastRightButtonDown = true;
    }

    // CanInput = !Globals.IsInputDisabled && !ScriptManager.IsInRunningScript && MouseInBound()
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

    // ============= 驭魂术支持 =============
    // character = ControledCharacter ?? this
    // 当控制其他角色时，操作转发到被控角色
    const activeCharacter = this.getActiveCharacter();
    const isControlling = this.isControllingCharacter();

    // if (ControledCharacter != null) _isRun = false;
    // 控制状态下强制走路，不能跑
    const isRun = !isControlling && player.isRun;

    // Alt+Left Click = jump
    if (button === "left" && altKey) {
      // 跳跃会打断待处理的交互和自动攻击
      // Reference: C# _autoAttackTarget = null; character.JumpTo(mouseTilePosition);
      this.cancelPendingInteraction();
      player.cancelAutoAttack();
      // 只打断攻击动画，不打断施法（Magic 状态不可打断）
      this.interruptAttackIfNeeded(player);
      const clickedTile = pixelToTile(worldX, worldY);
      // 跳跃操作也转发到被控角色
      if (isControlling) {
        (activeCharacter as Npc).jumpTo?.(clickedTile) ?? activeCharacter.walkTo(clickedTile);
      } else {
        player.jumpTo(clickedTile);
      }
      return;
    }

    // Ctrl+Left Click = attack at position
    // Note: This is an IMMEDIATE attack in place, NOT walk-then-attack
    if (button === "left" && ctrlKey) {
      // 攻击会打断待处理的交互和自动攻击
      // Reference: C# _autoAttackTarget = null; character.PerformeAttack(...)
      this.cancelPendingInteraction();
      player.cancelAutoAttack();
      // Perform attack immediately at clicked world position (no walking)
      activeCharacter.performeAttack({ x: worldX, y: worldY });
      return;
    }

    // Get current hover target
    const hoverTarget = interactionManager.getHoverTarget();

    if (button === "left") {
      // If hovering over enemy NPC, attack it (walk to and attack)
      if (hoverTarget.type === "npc") {
        const npc = hoverTarget.npc;
        // Globals.OutEdgeNpc != ControledCharacter - 不能攻击自己控制的角色
        if (isControlling && npc === player.controledCharacter) {
          // 不做任何事，不能攻击被控角色
          return;
        }

        // Check if NPC is enemy or non-fighter (can be attacked)
        if (npc.isEnemy || npc.isNoneFighter) {
          // 攻击 NPC 会取消之前的待处理交互
          this.cancelPendingInteraction();
          // Attack the NPC - walk to and attack
          this.attackNpcWithCharacter(activeCharacter, npc, isRun);
          return;
        }
        // Otherwise interact normally (talk)
        this.interactWithNpcUsingCharacter(activeCharacter, npc, false, isRun);
        return;
      }
      if (hoverTarget.type === "obj") {
        this.interactWithObjUsingCharacter(activeCharacter, hoverTarget.obj, false, isRun);
        return;
      }

      // 没有悬停目标时，移动到点击位置
      // 主动移动会打断任何待处理的交互和自动攻击
      // Reference: C# _autoAttackTarget = null; character.WalkTo/RunTo(mouseTilePosition);
      this.cancelPendingInteraction();
      player.cancelAutoAttack();
      // 只打断攻击动画，不打断施法（Magic 状态不可打断）
      // 否则如果正在攻击动画中点击地面，walkTo 会因为 performActionOk() 返回 false 而失败
      this.interruptAttackIfNeeded(player);
      const clickedTile = pixelToTile(worldX, worldY);
      if (isRun && !isControlling) {
        activeCharacter.runTo(clickedTile);
      } else {
        activeCharacter.walkTo(clickedTile);
      }
      return;
    } else if (button === "right") {
      // Right click: alternate interaction (ScriptFileRight) or use magic
      // ControledCharacter == null - Can't use magic when controlling other character

      // rightButtonPressed with HasInteractScriptRight
      // 先检查是否有右键交互脚本
      if (hoverTarget.type === "npc" && hoverTarget.npc.scriptFileRight) {
        // Globals.OutEdgeNpc != ControledCharacter
        if (!(isControlling && hoverTarget.npc === player.controledCharacter)) {
          this.interactWithNpc(hoverTarget.npc, true);
          return;
        }
      }
      if (hoverTarget.type === "obj" && hoverTarget.obj.hasInteractScriptRight) {
        this.interactWithObj(hoverTarget.obj, true);
        return;
      }

      // 没有右键交互目标时，尝试使用武功
      // ControledCharacter == null - Can't use magic when controlling other character
      if (isControlling) {
        guiManager.showMessage("控制角色时无法使用武功");
        return;
      }

      // 使用当前选中的武功（由 MagicHandler 处理）
      // 注意：实际的武功使用在持续鼠标输入中处理，这里只是检查条件
    }
  }

  /**
   * Attack an NPC - walk to target and attack
   * click on enemy NPC
   */
  private attackNpc(npc: Npc): void {
    const player = this.player;

    // Set auto attack target and start attacking
    player.setAutoAttackTarget(npc, false); // isRun = false for now
    player.attacking(npc.tilePosition, false);

    logger.log(`[InputHandler] Start attacking NPC: ${npc.name}`);
  }

  /**
   * Attack an NPC using specified character (for ControledCharacter support)
   * character.Attacking(target.TilePosition, isRun)
   */
  private attackNpcWithCharacter(attacker: Character, npc: Npc, isRun: boolean): void {
    const player = this.player;

    // if (ControledCharacter == null) { _autoAttackTarget = ... }
    // 只有玩家直接攻击时才设置自动攻击目标
    if (attacker === player) {
      player.setAutoAttackTarget(npc, isRun);
      player.attacking(npc.tilePosition, isRun);
    } else {
      // NPC 的 attacking 方法只接受一个参数
      (attacker as Npc).attacking(npc.tilePosition);
    }
    logger.log(`[InputHandler] ${attacker.name} attacking NPC: ${npc.name}`);
  }

  /**
   * Interact with NPC using specified character (for ControledCharacter support)
   */
  private async interactWithNpcUsingCharacter(
    actor: Character,
    npc: Npc,
    useRightScript: boolean,
    _isRun: boolean
  ): Promise<void> {
    // 被控角色也可以触发交互（如对话）
    // 实际上还是使用玩家的交互逻辑，只是距离检测基于被控角色
    await this.interactWithNpc(npc, useRightScript);
  }

  /**
   * Interact with Obj using specified character (for ControledCharacter support)
   */
  private async interactWithObjUsingCharacter(
    actor: Character,
    obj: Obj,
    useRightScript: boolean,
    _isRun: boolean
  ): Promise<void> {
    await this.interactWithObj(obj, useRightScript);
  }

  /**
   * Handle continuous mouse input for movement
   */
  handleContinuousMouseInput(input: InputState): void {
    const interactionManager = this.engine.interactionManager;

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
   * Reference: Character.InteractWith(target)
   * @param npc The NPC to interact with
   * @param useRightScript Use ScriptFileRight instead of ScriptFile
   */
  async interactWithNpc(npc: Npc, useRightScript: boolean = false): Promise<void> {
    const guiManager = this.engine.guiManager;
    const player = this.engine.player as Player;

    // Reference: C# _autoAttackTarget = null; character.InteractWith(...)
    player.cancelAutoAttack();

    const scriptFile = useRightScript ? npc.scriptFileRight : npc.scriptFile;
    if (!scriptFile) {
      guiManager.showMessage("...");
      return;
    }

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
   * Character.StartInteract
   */
  private async executeNpcInteraction(npc: Npc, useRightScript: boolean): Promise<void> {
    const player = this.player;
    const scriptExecutor = this.engine.scriptExecutor;

    const scriptFile = useRightScript ? npc.scriptFileRight : npc.scriptFile;
    if (!scriptFile) return;

    // turn to face each other
    const dx = npc.pixelPosition.x - player.pixelPosition.x;
    const dy = npc.pixelPosition.y - player.pixelPosition.y;
    player.setDirectionFromDelta(dx, dy);
    npc.setDirectionFromDelta(-dx, -dy);

    // Stop player movement
    player.stopMovement();

    const basePath = this.engine.getScriptBasePath();
    await scriptExecutor.runScript(resolveScriptPath(basePath, scriptFile), {
      type: "npc",
      id: npc.name,
    });
  }

  /**
   * Interact with an Object
   * Reference: Character.InteractWith(target)
   * @param obj The object to interact with
   * @param useRightScript Use ScriptFileRight instead of ScriptFile
   */
  async interactWithObj(obj: Obj, useRightScript: boolean = false): Promise<void> {
    const player = this.player;

    // Reference: C# _autoAttackTarget = null; character.InteractWith(...)
    player.cancelAutoAttack();

    // Use Obj.canInteract() to check if interaction is possible
    if (!obj.canInteract(useRightScript)) {
      return;
    }

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
   */
  private async executeObjInteraction(obj: Obj, useRightScript: boolean): Promise<void> {
    const player = this.engine.player as Player;
    const interactionManager = this.engine.interactionManager;
    const audioManager = this.engine.audio;

    // Check if object can be interacted with
    if (!obj.canInteract(useRightScript)) return;

    // Play object sound effect if exists
    // Reference: Obj.PlaySound() - called during interaction
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

    // Use Obj.startInteract to run the script (now uses EngineContext internally)
    obj.startInteract(useRightScript);
  }

  /**
   * Walk player towards a target tile
   * 计算目标位置并处理障碍物
   *
   * 算法：
   * 1. 计算从目标指向玩家方向，距离目标 interactDistance 的位置
   * 2. 如果该位置是障碍物，尝试所有 8 个方向
   * 3. 如果所有方向都不可达，放弃交互
   */
  private walkToTarget(targetTile: Vector2, interactDistance: number): void {
    const player = this.player;

    // Use isometric tile distance
    const dist = getViewTileDistance(player.tilePosition, targetTile);

    if (dist <= interactDistance) {
      // Already close enough
      return;
    }

    const { isTileWalkable } = this.deps;
    const destTile = this.findWalkableDestination(targetTile, interactDistance, isTileWalkable);

    if (!destTile) {
      // 所有方向都不可达，取消交互
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
   * 尝试 8 个方向找可达位置
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
    const destTile = findDistanceTileInDirection(targetTile, { x: dx, y: dy }, interactDistance);

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
      const tryTile = findDistanceTileInDirection(targetTile, dir, interactDistance);
      if (isTileWalkable(tryTile) && !this.hasObstacle(tryTile)) {
        return tryTile;
      }
    }

    return null; // 所有方向都不可达
  }

  /**
   * Check if tile has obstacle for player movement
   * 委托给 Player.hasObstacle，保持逻辑统一（NPC + Obj + Magic 障碍）
   */
  private hasObstacle(tile: Vector2): boolean {
    return this.player.hasObstacle(tile);
  }

  /**
   * Cancel pending interaction (e.g., when player clicks elsewhere)
   */
  cancelPendingInteraction(): void {
    this.pendingInteraction = null;
  }

  /**
   * Interrupt attack animation if player is in attack state
   * Only interrupts Attack/Attack1/Attack2 states, NOT Magic state
   * This allows clicking ground to cancel attack but not spell casting
   */
  private interruptAttackIfNeeded(player: Player): void {
    const attackStates = [CharacterState.Attack, CharacterState.Attack1, CharacterState.Attack2];
    if (attackStates.includes(player.state)) {
      player.standingImmediately();
    }
  }

  /**
   * Handle mouse button release
   * Reference: 更新 _lastMouseState，允许下次点击触发交互
   */
  handleMouseUp(isRightButton: boolean): void {
    if (isRightButton) {
      this.lastRightButtonDown = false;
    } else {
      this.lastLeftButtonDown = false;
    }
  }

  /**
   * Interact with closest object (Q key)
   */
  private async interactWithClosestObj(): Promise<void> {
    const player = this.engine.player as Player;
    const objManager = this.engine.objManager;
    const closestObj = objManager.getClosestInteractableObj(player.tilePosition, 13);
    if (closestObj) {
      await this.interactWithObj(closestObj, false);
    }
  }

  /**
   * Interact with closest NPC (E key)
   */
  private async interactWithClosestNpc(): Promise<void> {
    const player = this.engine.player as Player;
    const npcManager = this.engine.npcManager as NpcManager;
    // Get closest interactive NPC within 13 tiles
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
   * Update() - Keys.V handling
   * if (IsSitting()) StandingImmediately();
   * else Sitdown();
   */
  private toggleSitting(): void {
    const player = this.player;

    // !IsPetrified && ControledCharacter == null
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
    const guiManager = this.engine.guiManager;
    const scriptExecutor = this.engine.scriptExecutor;
    return !guiManager.isBlockingInput() && !scriptExecutor.isRunning();
  }
}
