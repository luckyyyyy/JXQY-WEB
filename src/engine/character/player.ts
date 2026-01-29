/**
 * Player 类 - 对应 C# Player.cs
 * 继承 Character，处理输入、升级、装备等玩家特有功能
 */
import type { Vector2, InputState, CharacterConfig } from "../core/types";
import {
  CharacterState,
  Direction,
  CharacterKind,
  DEFAULT_PLAYER_STATS,
  RUN_SPEED_FOLD,
} from "../core/types";
import { Character } from "./character";
import { pixelToTile, tileToPixel, getDirection, distance } from "../core/utils";
import { PathType } from "../core/pathFinder";
import type { LevelManager } from "../level";
import type { GuiManager } from "../gui/guiManager";
import type { Good } from "../goods";
import type { MagicData } from "../magic/types";
import { MagicMoveKind, MagicSpecialKind } from "../magic/types";
import type { MagicSprite } from "../magic/magicSprite";
import type { MagicManager } from "../magic";
import type { NpcManager } from "./npcManager";
import { resourceLoader } from "../resource/resourceLoader";
import type { PlayerSaveData } from "../game/storage";
import { parseCharacterIni, applyConfigToPlayer } from "./iniParser";

// C#: Thew cost constants from Player.cs
const THEW_USE_AMOUNT_WHEN_RUN = 1;
const THEW_USE_AMOUNT_WHEN_ATTACK = 5;
const THEW_USE_AMOUNT_WHEN_JUMP = 10;
const IS_USE_THEW_WHEN_NORMAL_RUN = false;
// C#: Mana restore interval when sitting (ms)
const SITTING_MANA_RESTORE_INTERVAL = 150;

// C#: Restore percentages from Player.cs
const LIFE_RESTORE_PERCENT = 0.01;
const THEW_RESTORE_PERCENT = 0.03;
const MANA_RESTORE_PERCENT = 0.02;
// C#: Restore interval (ms) - every 1 second
const RESTORE_INTERVAL_MS = 1000;

/** 玩家动作类型 */
export interface PlayerAction {
  type: "interact" | "attack" | "use_skill" | "use_item";
  targetNpc?: any;
  skillSlot?: number;
  itemSlot?: number;
}

/** Player 类 - 对应 C# Player.cs */
export class Player extends Character {
  // === Player Fields ===
  private _money: number = 0;
  private _doing: number = 0;
  private _desX: number = 0;
  private _desY: number = 0;
  private _belong: number = 0;
  private _fight: number = 0;
  private _isRun: boolean = false;
  private _walkIsRun: number = 0;
  private _isRunDisabled: boolean = false;
  private _standingMilliseconds: number = 0;
  private _sittedMilliseconds: number = 0;

  // Magic state
  private _currentMagicInUse: any = null;
  private _xiuLianMagic: any = null;
  private _autoAttackTarget: Character | null = null;
  private _autoAttackTimer: number = 0;
  private _autoAttackIsRun: boolean = false;

  // Equipment effects
  private _isNotUseThewWhenRun: boolean = false;
  private _isManaRestore: boolean = false;
  private _addLifeRestorePercent: number = 0;
  private _addManaRestorePercent: number = 0;
  private _addThewRestorePercent: number = 0;
  private _addMagicEffectPercent: number = 0;
  private _addMagicEffectAmount: number = 0;

  // Magic limits
  private _manaLimit: boolean = false;
  private _currentUseMagicIndex: number = 0;

  // Movement
  private _isMoving: boolean = false;
  private _targetPosition: Vector2 | null = null;

  // References
  private _guiManager: GuiManager | null = null;
  private _onMoneyChange: (() => void) | null = null;
  private _pendingAction: PlayerAction | null = null;
  private _magicSpritesInEffect: MagicSprite[] = [];
  private _levelManager: LevelManager | null = null;
  private _pendingMagic: { magic: MagicData; origin: Vector2; destination: Vector2 } | null = null;
  private _magicManager: MagicManager | null = null;
  private _npcManager: NpcManager | null = null;

  constructor(
    isWalkable?: (tile: Vector2) => boolean,
    isMapObstacle?: (tile: Vector2) => boolean
  ) {
    super();

    // Set walkability checker if provided
    if (isWalkable) {
      this.setWalkabilityChecker(isWalkable, isMapObstacle);
    }

    // Set default player config
    // C#: Player 没有显式设置 Relation，继承 Character 默认值 0 (Friend)
    // 但 IsPlayer 通过 Kind 判断，不依赖 Relation
    this.name = "杨影枫";
    this.npcIni = "z-杨影枫.ini";
    this.kind = CharacterKind.Player;
    // _relation 保持 Character 默认值 (0 = Friend)
    this.pathFinder = 1;

    // Set default stats
    const stats = DEFAULT_PLAYER_STATS;
    this.life = stats.life;
    this.lifeMax = stats.lifeMax;
    this.mana = stats.mana;
    this.manaMax = stats.manaMax;
    this.thew = stats.thew;
    this.thewMax = stats.thewMax;
    this.attack = stats.attack;
    this.defend = stats.defend;
    this.evade = stats.evade;
    this.walkSpeed = stats.walkSpeed;
  }

  // === DI ===

  /**
   * 设置等级管理器（由 GameManager 注入）
   */
  setLevelManager(levelManager: LevelManager): void {
    this._levelManager = levelManager;
  }

  /**
   * 设置 NpcManager（由 GameManager 注入）
   */
  setNpcManager(npcManager: NpcManager): void {
    this._npcManager = npcManager;
  }

  // === Properties ===

  /**
   * C# Reference: Player.PathType override
   * Player uses PerfectMaxPlayerTry when _pathFinder=1, otherwise PathOneStep
   */
  override getPathType(): PathType {
    if (this.pathFinder === 1) {
      return PathType.PerfectMaxPlayerTry;
    }
    return PathType.PathOneStep;
  }

  get money(): number {
    return this._money;
  }

  set money(value: number) {
    this._money = Math.max(0, value);
  }

  get doing(): number {
    return this._doing;
  }

  set doing(value: number) {
    this._doing = value;
  }

  get desX(): number {
    return this._desX;
  }

  set desX(value: number) {
    this._desX = value;
  }

  get desY(): number {
    return this._desY;
  }

  set desY(value: number) {
    this._desY = value;
  }

  get belong(): number {
    return this._belong;
  }

  set belong(value: number) {
    this._belong = value;
  }

  get fight(): number {
    return this._fight;
  }

  set fight(value: number) {
    this._fight = value;
  }

  get isRun(): boolean {
    return this._isRun;
  }

  get walkIsRun(): number {
    return this._walkIsRun;
  }

  set walkIsRun(value: number) {
    this._walkIsRun = value;
  }

  get isRunDisabled(): boolean {
    return this._isRunDisabled;
  }

  set isRunDisabled(value: boolean) {
    this._isRunDisabled = value;
  }

  get isMoving(): boolean {
    return this._isMoving;
  }

  get targetPosition(): Vector2 | null {
    return this._targetPosition;
  }

  // === GUI ===

  setGuiManager(guiManager: GuiManager): void {
    this._guiManager = guiManager;
  }

  setOnMoneyChange(callback: () => void): void {
    this._onMoneyChange = callback;
  }

  private showMessage(message: string): void {
    if (this._guiManager) {
      this._guiManager.showMessage(message);
    }
  }

  // === Input ===

  /**
   * Handle input for movement
   * Based on C# Player.cs Update()
   */
  handleInput(input: InputState, _cameraX: number, _cameraY: number): PlayerAction | null {
    this._pendingAction = null;

    // C# Reference: PerformActionOk() - 在 Magic/Attack/Jump/Hurt/Death 等状态下不能移动
    if (!this.canPerformAction()) {
      return null;
    }

    // Determine run mode
    this._isRun = this.canRun(input.isShiftDown);

    // Handle keyboard movement
    const moveDir = this.getKeyboardMoveDirection(input.keys);
    if (moveDir !== null) {
      this.moveInDirection(moveDir, this._isRun);
      return null;
    }

    // Handle mouse movement
    if (input.isMouseDown && input.clickedTile) {
      const targetTile = input.clickedTile;

      // Cancel auto attack when moving to a new location
      // C# Reference: Player.HandleMouseInput - _autoAttackTarget = null when walking
      this.cancelAutoAttack();

      if (this._isRun) {
        if (this.canRunCheck()) {
          this.runTo(targetTile);
        } else {
          this.walkTo(targetTile);
        }
      } else {
        this.walkTo(targetTile);
      }
      return null;
    }

    return this._pendingAction;
  }

  /**
   * Check if player can run
   */
  private canRun(isShiftDown: boolean): boolean {
    return (this._walkIsRun > 0 || isShiftDown) && !this._isRunDisabled;
  }

  /**
   * Check if player has enough thew to run
   */
  private canRunCheck(): boolean {
    if (this._isRunDisabled) return false;
    if (this._isNotUseThewWhenRun) return true;
    return this.thew > 0;
  }

  /**
   * Consume thew when running
   */
  private consumeRunningThew(): boolean {
    if (!this.canRunCheck()) return false;

    if (!this._isNotUseThewWhenRun) {
      // C#: if (IsInFighting || Globals.IsUseThewWhenNormalRun)
      if (this._isInFighting || IS_USE_THEW_WHEN_NORMAL_RUN) {
        this.thew = Math.max(0, this.thew - THEW_USE_AMOUNT_WHEN_RUN);
      }
    }
    return true;
  }

  /**
   * C# Reference: Player.CanJump()
   * Override to check and consume thew for jumping
   * Player needs thew to jump, NPC's don't
   */
  protected override canJump(): boolean {
    // C#: if (IsJumpDisabled || NpcIni == null || !NpcIni.ContainsKey(Jump) || NpcIni[Jump].Image == null)
    if (this.isJumpDisabled) {
      return false;
    }

    // C#: IsStateImageOk check - inherited from Character
    if (!this.isStateImageOk(CharacterState.Jump)) {
      return false;
    }

    // C#: if (Thew < ThewUseAmountWhenJump) { GuiManager.ShowMessage("体力不足!"); return false; }
    if (this.thew < THEW_USE_AMOUNT_WHEN_JUMP) {
      console.log("[Player] 体力不足! Cannot jump.");
      // TODO: GuiManager.ShowMessage("体力不足!");
      return false;
    }

    // C#: else { Thew -= ThewUseAmountWhenJump; return true; }
    this.thew -= THEW_USE_AMOUNT_WHEN_JUMP;
    return true;
  }

  /**
   * C# Reference: Player.CanAttack()
   * Check and consume thew for attacking
   */
  private canAttack(): boolean {
    // C#: if (Thew < ThewUseAmountWhenAttack) { GuiManager.ShowMessage("体力不足!"); return false; }
    if (this.thew < THEW_USE_AMOUNT_WHEN_ATTACK) {
      console.log("[Player] 体力不足! Cannot attack.");
      // TODO: GuiManager.ShowMessage("体力不足!");
      return false;
    }

    // C#: else { Thew -= ThewUseAmountWhenAttack; return true; }
    this.thew -= THEW_USE_AMOUNT_WHEN_ATTACK;
    return true;
  }

  /**
   * Get movement direction from keyboard
   */
  private getKeyboardMoveDirection(keys: Set<string>): Direction | null {
    const up = keys.has("ArrowUp") || keys.has("Numpad8");
    const down = keys.has("ArrowDown") || keys.has("Numpad2");
    const left = keys.has("ArrowLeft") || keys.has("Numpad4");
    const right = keys.has("ArrowRight") || keys.has("Numpad6");

    if (up && right) return Direction.NorthEast;
    if (up && left) return Direction.NorthWest;
    if (down && right) return Direction.SouthEast;
    if (down && left) return Direction.SouthWest;

    if (up) return Direction.North;
    if (down) return Direction.South;
    if (left) return Direction.West;
    if (right) return Direction.East;

    if (keys.has("Numpad7")) return Direction.NorthWest;
    if (keys.has("Numpad9")) return Direction.NorthEast;
    if (keys.has("Numpad1")) return Direction.SouthWest;
    if (keys.has("Numpad3")) return Direction.SouthEast;

    return null;
  }

  /**
   * Move in a direction
   */
  private moveInDirection(direction: Direction, isRun: boolean = false): void {
    const dirVectors: Vector2[] = [
      { x: 0, y: -2 },
      { x: 1, y: -1 },
      { x: 1, y: 0 },
      { x: 1, y: 1 },
      { x: 0, y: 2 },
      { x: -1, y: 1 },
      { x: -1, y: 0 },
      { x: -1, y: -1 },
    ];

    const vec = dirVectors[direction];
    const isOddRow = this._mapY % 2 === 1;

    let targetX = this._mapX + vec.x;
    let targetY = this._mapY + vec.y;

    if (vec.y !== 0 && Math.abs(vec.y) === 1) {
      if (isOddRow && vec.x >= 0) {
        targetX = this._mapX + (vec.x > 0 ? 1 : 0);
      } else if (!isOddRow && vec.x <= 0) {
        targetX = this._mapX + (vec.x < 0 ? -1 : 0);
      }
    }

    const targetTile = { x: targetX, y: targetY };
    if (this._isWalkable && this._isWalkable(targetTile)) {
      this._currentDirection = direction;
      this.path = [targetTile];
      this._isMoving = true;
      this.state = isRun && this.canRunCheck() ? CharacterState.Run : CharacterState.Walk;
    } else {
      this._currentDirection = direction;
    }
  }

  // === Movement ===

  /**
   * Walk to a tile
   */
  walkToTile(tileX: number, tileY: number): boolean {
    const result = this.walkTo({ x: tileX, y: tileY });
    if (result) {
      this._isMoving = true;
      this._targetPosition = { x: tileX, y: tileY };
    } else {
      this._isMoving = false;
      this._targetPosition = null;
    }
    return result;
  }

  /**
   * Run to a tile
   */
  runToTile(tileX: number, tileY: number): boolean {
    const result = this.runTo({ x: tileX, y: tileY });
    if (result) {
      this._isMoving = true;
      this._targetPosition = { x: tileX, y: tileY };
    } else {
      this._isMoving = false;
      this._targetPosition = null;
    }
    return result;
  }

  /**
   * Stop movement
   */
  stopMovement(): void {
    this.path = [];
    this._isMoving = false;
    this._targetPosition = null;
    this.state = CharacterState.Stand;
  }

  // isStanding() - inherited from Character
  // isSitting() - inherited from Character
  // isSitted - inherited from Character

  /**
   * Start sitting action
   * C# Reference: Character.Sitdown()
   * - Sets state to Sit
   * - Plays sit animation (FrameEnd - FrameBegin frames)
   * - Calls OnSitDown() hook
   */
  sitdown(): void {
    // C#: if (PerformActionOk() && IsStateImageOk(CharacterState.Sit))
    if (!this.canPerformAction()) {
      return;
    }

    // Stop any current movement or action
    this.path = [];
    this._isMoving = false;
    this._targetPosition = null;
    this.isSitted = false;
    this._sittedMilliseconds = 0;

    // Set state to Sit and play sit animation
    this.state = CharacterState.Sit;
    // Play the sit animation once (C#: PlayFrames(FrameEnd - FrameBegin))
    this.playCurrentDirOnce();

    console.log(`[Player] Sitdown started`);
  }

  /**
   * Override standingImmediately to reset Player-specific sitting timer
   * C# Reference: Player.cs only - _sittedMilliseconds is Player-specific
   * Note: _isSitted is now reset in Character.standingImmediately()
   */
  override standingImmediately(): void {
    this._sittedMilliseconds = 0;
    super.standingImmediately();
  }

  // === Attack ===

  /**
   * Walk/run to target and attack when in range (used when clicking on enemy NPC)
   * 1:1 复刻 C# Character.Attacking(Vector2 destinationTilePosition, bool isRun)
   *
   * C# 原版逻辑:
   * public void Attacking(Vector2 destinationTilePosition, bool isRun = false)
   * {
   *     if (PerformActionOk() &&
   *         (IsStateImageOk(CharacterState.Attack) ||
   *          IsStateImageOk(CharacterState.Attack1) ||
   *          IsStateImageOk(CharacterState.Attack2)))
   *     {
   *         _isRunToTarget = isRun;
   *         DestinationAttackTilePosition = destinationTilePosition;
   *         Magic magicToUse;
   *         if (AttackingIsOk(out magicToUse))
   *             PerformeAttack(magicToUse);
   *     }
   * }
   *
   * NOTE: This is different from performeAttack():
   * - attacking() = WALK to target position, THEN attack when in range
   * - performeAttack() = IMMEDIATE attack in place (used for Ctrl+Click)
   */
  attacking(destinationTilePosition: Vector2, isRun: boolean = false): void {
    // C#: if (PerformActionOk() && (IsStateImageOk(Attack) || ...))
    // 只有当可以执行动作时才处理（不在攻击/跳跃/死亡等动画中）
    if (!this.canPerformAction()) {
      return;
    }

    // C#: Check if attack state image is available
    // 简化：假设攻击状态图像总是可用
    // if (!this.isStateImageOk(CharacterState.Attack)) return;

    // C#: _isRunToTarget = isRun;
    this._isRunToTarget = isRun;

    // C#: DestinationAttackTilePosition = destinationTilePosition;
    this._destinationAttackTilePosition = { x: destinationTilePosition.x, y: destinationTilePosition.y };

    // C#: Magic magicToUse;
    // C#: if (AttackingIsOk(out magicToUse)) PerformeAttack(magicToUse);
    // AttackingIsOk 会处理移动（如果距离不够）或返回 true（如果可以攻击）
    const result = this.attackingIsOk();

    if (result.isOk) {
      // 在攻击距离内且可以看到目标 - 执行攻击
      const destPixel = tileToPixel(destinationTilePosition.x, destinationTilePosition.y);
      this.performeAttack(destPixel);
    }
    // 如果 attackingIsOk 返回 false，它已经处理了移动（通过 moveToTarget）
  }

  /**
   * Update auto attack behavior
   * 1:1 复刻 C# Player.UpdateAutoAttack(GameTime gameTime)
   *
   * C# 原版逻辑:
   * public void UpdateAutoAttack(GameTime gameTime)
   * {
   *     if(_autoAttackTarget != null)
   *     {
   *         if (_autoAttackTarget.IsDeathInvoked || !_autoAttackTarget.IsEnemy || !NpcManager.HasNpc(_autoAttackTarget))
   *         {
   *             _autoAttackTarget = null;
   *         }
   *         else
   *         {
   *             _autoAttackTimer += (float)gameTime.ElapsedGameTime.TotalMilliseconds;
   *             if (_autoAttackTimer >= 100)
   *             {
   *                 _autoAttackTimer -= 100;
   *                 Attacking(_autoAttackTarget.TilePosition, _autoAttackIsRun);
   *             }
   *         }
   *     }
   * }
   */
  updateAutoAttack(deltaTime: number): void {
    if (this._autoAttackTarget !== null) {
      // C#: 检查目标是否仍然有效
      // if (_autoAttackTarget.IsDeathInvoked || !_autoAttackTarget.IsEnemy || !NpcManager.HasNpc(_autoAttackTarget))
      if (this._autoAttackTarget.isDeathInvoked ||
          !this._autoAttackTarget.isEnemy) {
        // TODO: 还应该检查 NpcManager.HasNpc - 暂时跳过
        this._autoAttackTarget = null;
      } else {
        // C#: _autoAttackTimer += (float)gameTime.ElapsedGameTime.TotalMilliseconds;
        this._autoAttackTimer += deltaTime * 1000;
        // 只在调用 attacking 时打印日志，避免每帧刷屏

        // C#: if (_autoAttackTimer >= 100)
        if (this._autoAttackTimer >= 100) {
          // C#: _autoAttackTimer -= 100;
          this._autoAttackTimer -= 100;

          // C#: Attacking(_autoAttackTarget.TilePosition, _autoAttackIsRun);
          // 关键：使用目标的**当前位置**，这样如果目标移动了，玩家会跟随
          const targetPos = this._autoAttackTarget.tilePosition;
          this.attacking(targetPos, this._autoAttackIsRun);
        }
      }
    }
  }

  /**
   * Cancel auto attack
   */
  cancelAutoAttack(): void {
    this._autoAttackTarget = null;
    this._destinationAttackTilePosition = null;
    this._autoAttackTimer = 0;
  }

  /**
   * Perform attack at a target position (IMMEDIATE attack in place)
   * C# Reference: Character.PerformeAttack(Vector2 destinationPositionInWorld, Magic magicToUse)
   *
   * NOTE: This is different from attacking():
   * - performeAttack() = IMMEDIATE attack in place, face target direction (used for Ctrl+Click)
   * - attacking() = WALK to target position, THEN attack when in range (used for clicking enemy NPC)
   *
   * @param destinationPixelPosition Target position in pixel coordinates (direction to face)
   */
  performeAttack(destinationPixelPosition: Vector2): void {
    // C#: if (PerformActionOk())
    if (!this.canPerformAction()) {
      return;
    }

    // C# Reference: Player.PerformeAttack() calls CanAttack() to check/consume thew
    if (!this.canAttack()) {
      return;
    }

    // C#: StateInitialize(); ToFightingState();
    // Set up attack direction
    const direction = getDirection(this.pixelPosition, destinationPixelPosition);
    this._currentDirection = direction;

    // C#: Randomly choose attack state (Attack, Attack1, Attack2)
    const attackStates = [CharacterState.Attack, CharacterState.Attack1, CharacterState.Attack2];
    const randomIndex = Math.floor(Math.random() * 3);
    const chosenState = attackStates[randomIndex];

    // Check if state image is available, fall back to Attack
    // For now just use Attack (Attack1/Attack2 may not be loaded)
    this.state = CharacterState.Attack;

    // Play animation once
    this.playCurrentDirOnce();

    // Store attack destination for onAttacking callback
    this._attackDestination = destinationPixelPosition;

    console.log(`[Player] Performs attack towards (${destinationPixelPosition.x}, ${destinationPixelPosition.y})`);
  }

  // Store attack destination for when animation completes
  private _attackDestination: Vector2 | null = null;

  /**
   * Called when attack animation completes
   * C# Reference: Character.OnAttacking(_attackDestination)
   *
   * NOTE: In C#, OnAttacking is overridden only by Player to use XiuLianMagic.AttackFile.
   * Regular attack damage comes from FlyIni/FlyIni2 magic projectiles, NOT from direct damage.
   * The PerformeAttack sets _magicToUseWhenAttack which MagicManager uses to create MagicSprites.
   *
   * For now, we do NOT deal damage here since FlyIni magic is not fully implemented.
   * When MagicSprite system is complete, damage will come from MagicSprite.CharacterHited().
   */
  protected override onAttacking(): void {
    if (!this._attackDestination) return;

    const targetTile = pixelToTile(this._attackDestination.x, this._attackDestination.y);
    console.log(`[Player] Attack animation completed at tile (${targetTile.x}, ${targetTile.y})`);

    // C# Reference: When attack animation ends, MagicManager.UseMagic is called with FlyIni magic
    // The MagicSprite then handles collision detection and damage
    // TODO: Integrate with MagicManager to fire FlyIni projectiles

    // For now, deal damage directly to auto-attack target as a placeholder
    // This will be replaced by proper FlyIni magic when implemented
    if (this._autoAttackTarget && !this._autoAttackTarget.isDeathInvoked) {
      // Check if target is within attack range before dealing damage
      // C# Reference: MagicSprite checks collision/distance, not Character.OnAttacking
      const distance = this.getViewTileDistance(this.tilePosition, this._autoAttackTarget.tilePosition);
      const attackRange = this.attackRadius;

      if (distance <= attackRange) {
        // C# damage formula: (magic.Effect or character.Attack) - target.Defend, min 5
        // takeDamage already handles defend subtraction, so pass attack value
        this._autoAttackTarget.takeDamage(this.attack, this);
        console.log(`[Player] Attacks ${this._autoAttackTarget.name} with base attack ${this.attack}, distance=${distance}, range=${attackRange}`);
      } else {
        console.log(`[Player] Target ${this._autoAttackTarget.name} out of range: distance=${distance}, attackRange=${attackRange}`);
      }
    }

    this._attackDestination = null;
  }

  /**
   * Set auto attack target
   * C# Reference: Player._autoAttackTarget
   */
  setAutoAttackTarget(target: Character | null, isRun: boolean = false): void {
    this._autoAttackTarget = target;
    this._autoAttackIsRun = isRun;
    this._autoAttackTimer = 0;
    if (target) {
      // Copy position to avoid reference issues
      const pos = target.tilePosition;
      this._destinationAttackTilePosition = { x: pos.x, y: pos.y };
    } else {
      this._destinationAttackTilePosition = null;
    }
  }

  /**
   * Get auto attack target
   */
  getAutoAttackTarget(): Character | null {
    return this._autoAttackTarget;
  }

  /**
   * Override: Called when reaching destination and ready to attack
   * C# Reference: After reaching destination, PerformeAttack(magicToUse) is called
   */
  protected override performAttackAtDestination(): void {
    if (!this._destinationAttackTilePosition) return;

    // Convert tile position to pixel for performeAttack
    const destPixel = tileToPixel(this._destinationAttackTilePosition.x, this._destinationAttackTilePosition.y);

    console.log(`[Player] Reached attack destination, performing attack at (${this._destinationAttackTilePosition.x}, ${this._destinationAttackTilePosition.y})`);

    // Perform the attack
    this.performeAttack(destPixel);
  }

  // === Update ===

  /**
   * Override main update to call Player-specific updates
   * C# Reference: Player.cs - Update(GameTime gameTime)
   *
   * C# original:
   * public override void Update(GameTime gameTime)
   * {
   *     ...
   *     UpdateAutoAttack(gameTime);
   *     UpdateTouchObj();
   *     ...
   *     base.Update(gameTime);  // calls Character.Update
   * }
   */
  override update(deltaTime: number): void {
    // Call auto-attack update BEFORE base update (matches C# order)
    // C#: UpdateAutoAttack(gameTime);
    this.updateAutoAttack(deltaTime);

    // TODO: UpdateTouchObj();

    // Call base Character update
    super.update(deltaTime);
  }

  // === State Update ===
  // Player overrides specific state methods from Character for player-specific logic

  /**
   * Override running state to consume thew
   * C#: Player.Update() - handles thew consumption when running
   */
  protected override updateRunning(deltaTime: number): void {
    const result = this.moveAlongPath(deltaTime, RUN_SPEED_FOLD);

    // Consume thew while running
    if (result.moved && !result.reachedDestination && this.path.length > 0) {
      if (!this.consumeRunningThew()) {
        // Not enough thew, switch to walking
        this.state = CharacterState.Walk;
      }
    }

    // Update animation
    this.updateAnimation(deltaTime);

    // Update movement flags
    this.updateMovementFlags();
  }

  /**
   * Override sitting state for Player-specific Thew->Mana conversion
   * C# Reference: Player.Update() - case CharacterState.Sit with IsSitted logic
   */
  protected override updateSitting(deltaTime: number): void {
    const deltaMs = deltaTime * 1000;

    // C#: if (!IsSitted) base.Update(gameTime);
    // C#: if (!IsInPlaying) IsSitted = true;
    if (!this.isSitted) {
      // Check if sit animation has finished BEFORE updating
      // This prevents the frame from wrapping back to the beginning
      if (!this.isInPlaying) {
        this.isSitted = true;
        // Ensure we stay at the last frame of the sit animation (坐下姿势)
        this._currentFrameIndex = this._frameEnd;
        console.log(`[Player] Sitting animation complete, now sitted at frame ${this._frameEnd}`);
        return;
      }
      // Update animation while sitting down
      this.updateAnimation(deltaTime);
      return;
    }

    // C# Player.cs IsSitted logic:
    // Convert Thew to Mana while sitting
    let changeManaAmount = Math.floor(this.manaMax / 100);
    if (changeManaAmount === 0) changeManaAmount = 1;

    if (this.mana < this.manaMax && this.thew > changeManaAmount) {
      this._sittedMilliseconds += deltaMs;
      if (this._sittedMilliseconds >= SITTING_MANA_RESTORE_INTERVAL) {
        this._sittedMilliseconds -= SITTING_MANA_RESTORE_INTERVAL;
        this.thew = Math.max(0, this.thew - changeManaAmount);
        this.mana = Math.min(this.manaMax, this.mana + changeManaAmount);
      }
    } else {
      // Mana full or no thew left - stand up
      console.log(`[Player] Sitting complete: mana=${this.mana}/${this.manaMax}, thew=${this.thew}`);
      this.standingImmediately();
    }
  }

  /**
   * Override standing state for player-specific logic (e.g., standing life/thew restore)
   * C#: Player.Update() - if ((IsStanding() || IsWalking()) && BodyFunctionWell)
   */
  protected override updateStanding(deltaTime: number): void {
    this.updateAnimation(deltaTime);
    this.updateMovementFlags();
    this.updateStandingRestore(deltaTime);
  }

  /**
   * Override walking state for player - also restores stats
   * C#: Player.Update() - if ((IsStanding() || IsWalking()) && BodyFunctionWell)
   */
  protected override updateWalking(deltaTime: number): void {
    this.moveAlongPath(deltaTime, this.walkSpeed);
    this.updateAnimation(deltaTime);
    this.updateMovementFlags();
    this.updateStandingRestore(deltaTime);
  }

  /**
   * C#: Player.Update() standing/walking restore logic
   * Life, Thew, and Mana restore every 1 second while standing or walking
   */
  private updateStandingRestore(deltaTime: number): void {
    // C#: if ((IsStanding() || IsWalking()) && BodyFunctionWell)
    // BodyFunctionWell = !IsFrozen && !IsPoisoned && !IsPetrified
    // For now, we assume body function is well (status effects not implemented)
    const bodyFunctionWell = true;

    if (bodyFunctionWell) {
      const deltaMs = deltaTime * 1000;
      this._standingMilliseconds += deltaMs;

      if (this._standingMilliseconds >= RESTORE_INTERVAL_MS) {
        // C#: Life += (int)((LifeRestorePercent + AddLifeRestorePercent / 1000f) * LifeMax);
        const lifeRestore = Math.floor(
          (LIFE_RESTORE_PERCENT + this._addLifeRestorePercent / 1000) * this.lifeMax
        );
        this.life = Math.min(this.lifeMax, this.life + lifeRestore);

        // C#: Thew += (int)((ThewRestorePercent + AddThewRestorePercent / 1000f) * ThewMax);
        const thewRestore = Math.floor(
          (THEW_RESTORE_PERCENT + this._addThewRestorePercent / 1000) * this.thewMax
        );
        this.thew = Math.min(this.thewMax, this.thew + thewRestore);

        // C#: Mana += (int)((AddManaRestorePercent / 1000f) * ManaMax);
        const manaRestore = Math.floor(
          (this._addManaRestorePercent / 1000) * this.manaMax
        );
        this.mana = Math.min(this.manaMax, this.mana + manaRestore);

        // C#: if (IsManaRestore) { Mana += (int)(ManaMax * ManaRestorePercent); }
        if (this._isManaRestore) {
          const bonusManaRestore = Math.floor(this.manaMax * MANA_RESTORE_PERCENT);
          this.mana = Math.min(this.manaMax, this.mana + bonusManaRestore);
        }

        this._standingMilliseconds = 0;
      }
    } else {
      this._standingMilliseconds = 0;
    }
  }

  /**
   * Override magic cast hook - called when magic animation completes
   * C# Reference: Character.Update() case CharacterState.Magic - PlaySoundEffect + MagicManager.UseMagic()
   */
  protected override onMagicCast(): void {
    // Play Magic state sound effect
    // C# Reference: PlaySoundEffect(NpcIni[(int)CharacterState.Magic].Sound)
    this.playStateSound(CharacterState.Magic);

    if (this._pendingMagic && this._magicManager) {
      console.log(`[Magic] Releasing ${this._pendingMagic.magic.name} after casting animation`);
      this._magicManager.useMagic({
        userId: "player",
        magic: this._pendingMagic.magic,
        origin: this._pendingMagic.origin,
        destination: this._pendingMagic.destination,
      });
      this._pendingMagic = null;
    }
  }

  /**
   * Set pending magic to release after casting animation
   * C# Reference: Character stores MagicUse, _magicDestination for release in Update()
   */
  setPendingMagic(magic: MagicData, origin: Vector2, destination: Vector2): void {
    this._pendingMagic = { magic, origin, destination };
  }

  /**
   * Set magic manager reference for releasing magic
   */
  setMagicManager(magicManager: MagicManager): void {
    this._magicManager = magicManager;
  }

  /**
   * C#: Player.ResetPartnerPosition()
   * Reset all partners to positions around the player
   */
  resetPartnerPosition(): void {
    if (!this._npcManager) return;

    const partners = this._npcManager.getAllPartners();
    if (partners.length === 0) return;

    // C#: var neighbors = Engine.PathFinder.FindAllNeighbors(TilePosition);
    const neighbors = this.findAllNeighbors(this.tilePosition);

    // C#: var index = CurrentDirection + 4; (start from behind the player)
    let index = this._currentDirection + 4;

    for (const partner of partners) {
      // C#: if (index == CurrentDirection) index++; (skip player's facing direction)
      if (index % 8 === this._currentDirection) index++;
      partner.setPosition(neighbors[index % 8].x, neighbors[index % 8].y);
      index++;
    }
  }

  /**
   * Get all 8 neighboring tile positions
   */
  private findAllNeighbors(tilePos: Vector2): Vector2[] {
    const neighbors: Vector2[] = [];
    const isOddRow = tilePos.y % 2 === 1;

    // 8 directions: S, SW, W, NW, N, NE, E, SE (matching C# direction order)
    const offsets = [
      { x: 0, y: 2 },     // 0: South
      { x: isOddRow ? 0 : -1, y: 1 },  // 1: SouthWest
      { x: -1, y: 0 },    // 2: West
      { x: isOddRow ? 0 : -1, y: -1 }, // 3: NorthWest
      { x: 0, y: -2 },    // 4: North
      { x: isOddRow ? 1 : 0, y: -1 },  // 5: NorthEast
      { x: 1, y: 0 },     // 6: East
      { x: isOddRow ? 1 : 0, y: 1 },   // 7: SouthEast
    ];

    for (const offset of offsets) {
      neighbors.push({
        x: tilePos.x + offset.x,
        y: tilePos.y + offset.y,
      });
    }

    return neighbors;
  }

  // === Helpers ===

  /**
   * Update animation (calls Sprite.update)
   */
  private updateAnimation(deltaTime: number): void {
    // Call Sprite.update directly (not Character.update to avoid recursion)
    if (this._texture && this._isShow) {
      const deltaMs = deltaTime * 1000;
      this._animationTime += deltaMs;

      const frameInterval = this._texture.interval || 100;

      while (this._animationTime >= frameInterval) {
        this._animationTime -= frameInterval;
        this._advanceFrame();
      }
    }
  }

  /**
   * Update movement flags based on path state
   */
  private updateMovementFlags(): void {
    if (this.path.length === 0) {
      this._isMoving = false;
      this._targetPosition = null;
    }
  }

  // === Position ===
  // getTilePosition(), getPixelPosition(), getDirection() - use inherited properties:
  //   tilePosition, pixelPosition, direction from Character base class

  // setDirection() - inherited from Character
  // setState() - use inherited state setter from Character

  setPixelPosition(x: number, y: number): void {
    this._positionInWorld = { x, y };
    const tile = pixelToTile(x, y);
    this._mapX = tile.x;
    this._mapY = tile.y;
  }

  isNear(position: Vector2, threshold: number = 50): boolean {
    return distance(this._positionInWorld, position) <= threshold;
  }

  // === Level ===

  addExp(amount: number): void {
    this.exp += amount;
    this.checkLevelUp();
  }

  private checkLevelUp(): void {
    while (this.exp >= this.levelUpExp && this.levelUpExp > 0) {
      this.exp -= this.levelUpExp;
      this.levelUp();
    }
  }

  levelUp(): boolean {
    const newLevel = this.level + 1;
    return this.levelUpTo(newLevel);
  }

  setLevelTo(level: number): void {
    if (!this._levelManager) {
      console.warn("[Player] LevelManager not set");
      this.level = level;
      return;
    }
    const levelConfig = this._levelManager.getPlayerLevelConfig();

    this.level = level;
    console.log(`[Player] SetLevelTo: ${level}`);

    if (!levelConfig) return;

    const detail = levelConfig.get(level);
    if (!detail) return;

    this.lifeMax = detail.lifeMax;
    this.thewMax = detail.thewMax;
    this.manaMax = detail.manaMax;
    this.life = this.lifeMax;
    this.thew = this.thewMax;
    this.mana = this.manaMax;
    this.attack = detail.attack;
    this.defend = detail.defend;
    this.evade = detail.evade;
    this.levelUpExp = detail.levelUpExp;
  }

  levelUpTo(targetLevel: number): boolean {
    const currentLevel = this.level;
    if (targetLevel <= currentLevel) return false;

    if (!this._levelManager) {
      console.warn("[Player] LevelManager not set");
      this.level = targetLevel;
      this.showMessage(`${this.name}的等级提升了`);
      return true;
    }
    const levelConfig = this._levelManager.getPlayerLevelConfig();
    const maxLevel = this._levelManager.getMaxLevel();

    if (targetLevel > maxLevel) {
      if (currentLevel < maxLevel) {
        return this.levelUpTo(maxLevel);
      }
      this.exp = 0;
      this.levelUpExp = 0;
      return false;
    }

    if (!levelConfig) {
      this.level = targetLevel;
      this.showMessage(`${this.name}的等级提升了`);
      return true;
    }

    const currentDetail = levelConfig.get(currentLevel);
    const targetDetail = levelConfig.get(targetLevel);

    if (!currentDetail || !targetDetail) {
      this.level = targetLevel;
      this.exp = 0;
      this.levelUpExp = 0;
      this.showMessage(`${this.name}的等级提升了`);
      return true;
    }

    this.lifeMax += targetDetail.lifeMax - currentDetail.lifeMax;
    this.thewMax += targetDetail.thewMax - currentDetail.thewMax;
    this.manaMax += targetDetail.manaMax - currentDetail.manaMax;
    this.attack += targetDetail.attack - currentDetail.attack;
    this.defend += targetDetail.defend - currentDetail.defend;
    this.evade += targetDetail.evade - currentDetail.evade;

    this.life = this.lifeMax;
    this.thew = this.thewMax;
    this.mana = this.manaMax;
    this.levelUpExp = targetDetail.levelUpExp;
    this.level = targetLevel;

    if (targetLevel >= maxLevel) {
      this.exp = 0;
      this.levelUpExp = 0;
    }

    this.showMessage(`${this.name}的等级提升了`);
    return true;
  }

  async initializeFromLevelConfig(level: number = 1): Promise<void> {
    if (!this._levelManager) {
      console.warn("[Player] LevelManager not set, cannot initialize from level config");
      return;
    }
    await this._levelManager.initialize();

    const levelConfig = this._levelManager.getPlayerLevelConfig();
    if (!levelConfig) return;

    const detail = levelConfig.get(level);
    if (!detail) return;

    this.level = level;
    this.lifeMax = detail.lifeMax;
    this.life = detail.lifeMax;
    this.thewMax = detail.thewMax;
    this.thew = detail.thewMax;
    this.manaMax = detail.manaMax;
    this.mana = detail.manaMax;
    this.attack = detail.attack;
    this.defend = detail.defend;
    this.evade = detail.evade;
    this.levelUpExp = detail.levelUpExp;
    this.exp = 0;
  }

  // === Save/Load ===

  async loadFromFile(filePath: string): Promise<boolean> {
    try {
      const content = await resourceLoader.loadText(filePath);
      if (!content) return false;

      // 1. 解析 INI 为 CharacterConfig
      const config = parseCharacterIni(content);
      if (!config) return false;

      // 2. 应用配置到 Player（纯赋值）
      applyConfigToPlayer(config, this);

      // 3. 调用 setXXX 方法触发副作用（包括 setPosition/setDirection）
      this.applyConfigSetters();

      return true;
    } catch (error) {
      console.error(`[Player] Error loading:`, error);
      return false;
    }
  }

  /**
   * 从存档数据加载玩家
   * 用于 JSON 存档恢复，由 Loader.loadPlayerFromJSON 调用
   */
  loadFromSaveData(data: PlayerSaveData): void {
    // 基本信息
    this.name = data.name;
    if (data.npcIni) {
      this.npcIni = data.npcIni;
    }
    this.kind = data.kind;
    this.relation = data.relation;
    this.pathFinder = data.pathFinder;

    // 位置
    this.setPosition(data.mapX, data.mapY);
    this.setDirection(data.dir);

    // 范围
    this.visionRadius = data.visionRadius;
    this.dialogRadius = data.dialogRadius;
    this.attackRadius = data.attackRadius;

    // 属性 - 必须先设置 Max 再设置当前值（setter 会限制在 Max 以内）
    this.level = data.level;
    this.exp = data.exp;
    this.levelUpExp = data.levelUpExp;
    this.lifeMax = data.lifeMax;
    this.life = data.life;
    this.thewMax = data.thewMax;
    this.thew = data.thew;
    this.manaMax = data.manaMax;
    this.mana = data.mana;
    this.attack = data.attack;
    this.attack2 = data.attack2;
    this.attack3 = data.attack3;
    this.attackLevel = data.attackLevel;
    this.defend = data.defend;
    this.defend2 = data.defend2;
    this.defend3 = data.defend3;
    this.evade = data.evade;
    this.lum = data.lum;
    this.walkSpeed = data.walkSpeed;
    this.addMoveSpeedPercent = data.addMoveSpeedPercent;

    // Player 特有
    this.money = data.money;
    this.isRunDisabled = data.isRunDisabled;
    this.walkIsRun = data.walkIsRun;

    // 装备加成属性
    this.setAddLifeRestorePercent(data.addLifeRestorePercent ?? 0);
    this.setAddManaRestorePercent(data.addManaRestorePercent ?? 0);
    this.setAddThewRestorePercent(data.addThewRestorePercent ?? 0);

    // Player 特有属性
    this.currentUseMagicIndex = data.currentUseMagicIndex ?? 0;
    this.manaLimit = data.manaLimit ?? false;
    this.isJumpDisabled = data.isJumpDisabled ?? false;
    this.isFightDisabled = data.isFightDisabled ?? false;

    // 调用 setXXX 方法触发副作用
    this.applyConfigSetters();
  }

  // === Stats ===

  fullAll(): void {
    this.fullLife();
    this.fullThew();
    this.fullMana();
  }

  setStat(statName: string, value: number): void {
    switch (statName.toLowerCase()) {
      case 'life':
        this.life = value;
        break;
      case 'lifemax':
        this.lifeMax = value;
        break;
      case 'thew':
        this.thew = value;
        break;
      case 'thewmax':
        this.thewMax = value;
        break;
      case 'mana':
        this.mana = value;
        break;
      case 'manamax':
        this.manaMax = value;
        break;
      case 'attack':
        this.attack = value;
        break;
      case 'defend':
        this.defend = value;
        break;
      case 'evade':
        this.evade = value;
        break;
      case 'level':
        this.level = value;
        break;
      case 'exp':
        this.exp = value;
        break;
      case 'levelupexp':
        this.levelUpExp = value;
        break;
    }
  }

  isFullLife(): boolean {
    return this.life >= this.lifeMax;
  }

  /**
   * Add money to player with message display
   * C# Reference: Player.AddMoney - shows message "你得到了 X 两银子。" or "你失去了 X 两银子。"
   */
  addMoney(amount: number): void {
    if (amount > 0) {
      this._money += amount;
      this._guiManager?.showMessage(`你得到了 ${amount} 两银子。`);
      this._onMoneyChange?.();
    } else if (amount < 0) {
      this._money += amount;
      if (this._money < 0) this._money = 0;
      this._guiManager?.showMessage(`你失去了 ${-amount} 两银子。`);
      this._onMoneyChange?.();
    }
  }

  /**
   * Add money without showing message
   * C# Reference: Player.AddMoneyValue - just adds amount, no message
   */
  addMoneyValue(amount: number): void {
    this._money += amount;
    if (this._money < 0) this._money = 0;
    this._onMoneyChange?.();
  }

  getMoney(): number {
    return this._money;
  }

  setMoney(amount: number): void {
    this._money = Math.max(0, amount);
    this._onMoneyChange?.();
  }

  heal(amount: number): void {
    this.addLife(amount);
  }

  restoreMana(amount: number): void {
    this.addMana(amount);
  }

  /**
   * Override takeDamage to use Character's proper damage calculation
   * C# Reference: Character.takeDamage handles defend, hit rate, and min damage
   *
   * Note: This method signature matches Character's takeDamage for proper override
   */
  override takeDamage(damage: number, attacker: Character | null = null): void {
    // Call parent's takeDamage which handles:
    // - Defend reduction
    // - Hit rate calculation based on evade
    // - Minimum damage (5)
    // - Death handling
    super.takeDamage(damage, attacker);
  }

  /**
   * Simple damage method for scripts/direct damage (no defend calculation)
   * Use this for fixed damage amounts (e.g., from traps, scripts)
   */
  takeDamageRaw(amount: number): boolean {
    this.life -= amount;
    if (this.life <= 0) {
      this.life = 0;
      this.state = CharacterState.Death;
      return true;
    }
    return false;
  }

  // === Equipment ===

  equiping(equip: Good | null, currentEquip: Good | null, justEffectType: boolean = false): void {
    this.unEquiping(currentEquip, justEffectType);

    if (equip) {
      if (!justEffectType) {
        this.attack += equip.attack;
        this.attack2 += equip.attack2;
        this.attack3 += equip.attack3;
        this.defend += equip.defend;
        this.defend2 += equip.defend2;
        this.defend3 += equip.defend3;
        this.evade += equip.evade;
        this.lifeMax += equip.lifeMax;
        this.thewMax += equip.thewMax;
        this.manaMax += equip.manaMax;

        if (equip.magicIniWhenUse) {
          this.showMessage(`获得武功：${equip.magicIniWhenUse}`);
        }
      }

      const effectType = equip.theEffectType;
      switch (effectType) {
        case 1:
          this._isNotUseThewWhenRun = true;
          break;
        case 2:
          this._isManaRestore = true;
          break;
      }

      if (equip.specialEffect === 1) {
        this._addLifeRestorePercent += equip.specialEffectValue;
      }

      this.addMoveSpeedPercent += equip.changeMoveSpeedPercent;
      this._addMagicEffectPercent += equip.addMagicEffectPercent;
      this._addMagicEffectAmount += equip.addMagicEffectAmount;
    }

    if (this.life > this.lifeMax) this.life = this.lifeMax;
    if (this.thew > this.thewMax) this.thew = this.thewMax;
    if (this.mana > this.manaMax) this.mana = this.manaMax;
  }

  unEquiping(equip: Good | null, justEffectType: boolean = false): void {
    if (!equip) return;

    if (!justEffectType) {
      this.attack -= equip.attack;
      this.attack2 -= equip.attack2;
      this.attack3 -= equip.attack3;
      this.defend -= equip.defend;
      this.defend2 -= equip.defend2;
      this.defend3 -= equip.defend3;
      this.evade -= equip.evade;
      this.lifeMax -= equip.lifeMax;
      this.thewMax -= equip.thewMax;
      this.manaMax -= equip.manaMax;

      if (equip.magicIniWhenUse) {
        this.showMessage(`武功已不可使用`);
      }
    }

    const effectType = equip.theEffectType;
    switch (effectType) {
      case 1:
        this._isNotUseThewWhenRun = false;
        break;
      case 2:
        this._isManaRestore = false;
        break;
    }

    if (equip.specialEffect === 1) {
      this._addLifeRestorePercent -= equip.specialEffectValue;
    }

    this.addMoveSpeedPercent -= equip.changeMoveSpeedPercent;
    this._addMagicEffectPercent -= equip.addMagicEffectPercent;
    this._addMagicEffectAmount -= equip.addMagicEffectAmount;

    if (this.life > this.lifeMax) this.life = this.lifeMax;
    if (this.thew > this.thewMax) this.thew = this.thewMax;
    if (this.mana > this.manaMax) this.mana = this.manaMax;
  }

  useDrug(drug: Good): boolean {
    if (!drug) return false;

    if (drug.life !== 0) {
      this.life = Math.min(this.lifeMax, Math.max(0, this.life + drug.life));
    }
    if (drug.thew !== 0) {
      this.thew = Math.min(this.thewMax, Math.max(0, this.thew + drug.thew));
    }
    if (drug.mana !== 0) {
      this.mana = Math.min(this.manaMax, Math.max(0, this.mana + drug.mana));
    }

    return true;
  }

  getIsNotUseThewWhenRun(): boolean {
    return this._isNotUseThewWhenRun;
  }

  getIsManaRestore(): boolean {
    return this._isManaRestore;
  }

  // C#: Player.AddLifeRestorePercent, AddManaRestorePercent, AddThewRestorePercent
  getAddLifeRestorePercent(): number {
    return this._addLifeRestorePercent;
  }

  setAddLifeRestorePercent(value: number): void {
    this._addLifeRestorePercent = value;
  }

  getAddManaRestorePercent(): number {
    return this._addManaRestorePercent;
  }

  setAddManaRestorePercent(value: number): void {
    this._addManaRestorePercent = value;
  }

  getAddThewRestorePercent(): number {
    return this._addThewRestorePercent;
  }

  setAddThewRestorePercent(value: number): void {
    this._addThewRestorePercent = value;
  }

  // C#: ManaLimit - Can't use mana
  get manaLimit(): boolean {
    return this._manaLimit;
  }

  set manaLimit(value: boolean) {
    this._manaLimit = value;
  }

  // C#: CurrentUseMagicIndex - Current use magic index in magic list
  get currentUseMagicIndex(): number {
    return this._currentUseMagicIndex;
  }

  set currentUseMagicIndex(value: number) {
    this._currentUseMagicIndex = value;
  }

  // === Magic ===

  canUseMagic(magic: { manaCost: number; thewCost: number; lifeCost: number; lifeFullToUse: number; disableUse: number }): { canUse: boolean; reason?: string } {
    if (magic.disableUse !== 0) {
      return { canUse: false, reason: "该武功不能使用" };
    }

    if (magic.lifeFullToUse !== 0 && this.life < this.lifeMax) {
      return { canUse: false, reason: "需要满血才能使用此武功" };
    }

    // C#: if (Mana < MagicUse.ManaCost || ManaLimit)
    if (this.mana < magic.manaCost || this._manaLimit) {
      return { canUse: false, reason: "没有足够的内力使用这种武功" };
    }

    if (this.thew < magic.thewCost) {
      return { canUse: false, reason: "没有足够的体力使用这种武功" };
    }

    return { canUse: true };
  }

  consumeMagicCost(magic: { manaCost: number; thewCost: number; lifeCost: number }): void {
    this.mana = Math.max(0, this.mana - magic.manaCost);
    this.thew = Math.max(0, this.thew - magic.thewCost);
    if (magic.lifeCost !== 0) {
      this.addLife(-magic.lifeCost);
    }
  }

  getPlayerId(): string {
    return "player";
  }

  getAddMagicEffectPercent(): number {
    return this._addMagicEffectPercent;
  }

  getAddMagicEffectAmount(): number {
    return this._addMagicEffectAmount;
  }

  // === BUFF System ===
  // C# Reference: Character.cs - LinkedList<MagicSprite> MagicSpritesInEffect

  /**
   * 添加武功精灵到生效列表（如金钟罩等 BUFF）
   * C# Reference: MagicManager.AddFollowCharacterMagicSprite - case 3,6
   */
  addMagicSpriteInEffect(sprite: MagicSprite): void {
    // 检查是否已有同名武功
    const existingIndex = this._magicSpritesInEffect.findIndex(
      s => s.magic.name === sprite.magic.name
    );

    if (existingIndex >= 0) {
      // 已有同名武功，更新为新的（重置持续时间）
      this._magicSpritesInEffect[existingIndex] = sprite;
      console.log(`[Player] BUFF reset: ${sprite.magic.name}`);
    } else {
      // 添加新的武功精灵
      this._magicSpritesInEffect.push(sprite);
      console.log(`[Player] BUFF added: ${sprite.magic.name}, effect=${sprite.currentEffect}`);
    }
  }

  /**
   * 移除武功精灵（当精灵销毁时调用）
   * C# Reference: Character.Update - 清理 IsDestroyed 的精灵
   */
  removeMagicSpriteInEffect(spriteId: number): void {
    const index = this._magicSpritesInEffect.findIndex(s => s.id === spriteId);
    if (index >= 0) {
      const removed = this._magicSpritesInEffect.splice(index, 1)[0];
      console.log(`[Player] BUFF removed: ${removed.magic.name}`);
    }
  }

  /**
   * 清理已销毁的武功精灵
   * C# Reference: Character.Update - for (var node = MagicSpritesInEffect.First; ...)
   */
  cleanupDestroyedMagicSprites(): void {
    this._magicSpritesInEffect = this._magicSpritesInEffect.filter(s => !s.isDestroyed);
  }

  /**
   * 获取当前生效的武功精灵列表
   */
  getMagicSpritesInEffect(): MagicSprite[] {
    return this._magicSpritesInEffect;
  }

  /**
   * 计算武功减伤量（金钟罩等）
   * C# Reference: MagicSprite.CharacterHited
   * foreach (var magicSprite in character.MagicSpritesInEffect)
   *   if (magic.MoveKind == 13 && magic.SpecialKind == 3)
   *     effect -= MagicManager.GetEffectAmount(magic, character);
   */
  calculateDamageReduction(): { effect: number; effect2: number; effect3: number } {
    let reductionEffect = 0;
    let reductionEffect2 = 0;
    let reductionEffect3 = 0;

    for (const sprite of this._magicSpritesInEffect) {
      const magic = sprite.magic;

      // MoveKind=13 (FollowCharacter) + SpecialKind=3 (BuffOrPetrify) = 防护类 BUFF
      if (magic.moveKind === MagicMoveKind.FollowCharacter &&
          magic.specialKind === MagicSpecialKind.BuffOrPetrify) {
        // C#: MagicManager.GetEffectAmount(magic, character)
        // = (magic.Effect == 0 ? character.Attack : magic.Effect) + magic.EffectExt
        const effect = (magic.effect === 0 ? this.attack : magic.effect) + magic.effectExt;
        const effect2 = magic.effect2;
        const effect3 = magic.effect3;

        reductionEffect += effect;
        reductionEffect2 += effect2;
        reductionEffect3 += effect3;

        console.log(`[Player] BUFF damage reduction from ${magic.name}: ${effect}/${effect2}/${effect3}`);
      }
    }

    return {
      effect: reductionEffect,
      effect2: reductionEffect2,
      effect3: reductionEffect3,
    };
  }

  /**
   * 检查是否有免疫伤害的 BUFF（SpecialKind=6）
   * C# Reference: Character.DecreaseLifeAddHurt
   */
  hasImmunityBuff(): boolean {
    for (const sprite of this._magicSpritesInEffect) {
      const magic = sprite.magic;
      if (magic.moveKind === MagicMoveKind.FollowCharacter &&
          magic.specialKind === MagicSpecialKind.Buff) {
        return true;
      }
    }
    return false;
  }
}
