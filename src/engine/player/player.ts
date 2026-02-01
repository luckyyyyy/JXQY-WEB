/**
 * Player 类 - 对应 C# Player.cs
 * 继承 Character，处理输入、升级、装备等玩家特有功能
 */

import { Character } from "../character";
import { applyConfigToPlayer, parseCharacterIni } from "../character/iniParser";
import type { NpcManager } from "../character/npcManager";
import { getEngineContext } from "../core/engineContext";
import { logger } from "../core/logger";
import { PathType } from "../core/pathFinder";
import type { InputState, Vector2 } from "../core/types";
import {
  CharacterKind,
  CharacterState,
  DEFAULT_PLAYER_STATS,
  Direction,
  RUN_SPEED_FOLD,
} from "../core/types";
import { distance, getDirection, isBoxCollide, pixelToTile, tileToPixel } from "../utils";
import type { PlayerSaveData } from "../game/storage";
import type { GuiManager } from "../gui/guiManager";
import type { MagicManager } from "../magic";
import { loadMagic, getMagicAtLevel } from "../magic/magicLoader";
import type { MagicSprite } from "../magic/magicSprite";
import type { MagicData, MagicItemInfo } from "../magic/types";
import { MagicMoveKind, MagicSpecialKind } from "../magic/types";
import { getTileTextureRegion } from "../map/renderer";
import { resourceLoader } from "../resource/resourceLoader";
import type { Good } from "./goods";
import { GoodsListManager } from "./goods/goodsListManager";
import { getEffectAmount } from "../magic/effects/common";
import { MagicListManager } from "./magic/magicListManager";
import { ResourcePath } from "../../config/resourcePaths";

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
  private _autoAttackTarget: Character | null = null;
  private _autoAttackTimer: number = 0;
  private _autoAttackIsRun: boolean = false;

  // C#: ControledCharacter - Character currently being controlled by player
  // Used by magic like "驭魂术" (soul control) to take over an NPC
  private _controledCharacter: Character | null = null;

  // C#: SpecialAttackTexture - 修炼武功的特殊攻击动画
  // 当 XiuLianMagic 有 ActionFile 时加载的 ASF 路径
  private _specialAttackTexturePath: string | null = null;

  // C#: NpcIniIndex - 从 npcIni 文件名中提取的数字索引
  // 用于构建 SpecialAttackTexture 路径：ActionFile + NpcIniIndex + ".asf"
  private _npcIniIndex: number = 1;

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

  // === ReplacedMagic (C#: Dictionary<string, Magic> _replacedMagic) ===
  // 装备带来的武功替换：key=原武功文件名, value=替换后的武功数据
  // 例如某装备让"火球术"变成"大火球术"
  private _replacedMagic: Map<string, MagicData> = new Map();

  // Movement
  private _isMoving: boolean = false;
  private _targetPosition: Vector2 | null = null;

  // Occlusion transparency - 遮挡半透明状态
  private _isOccluded: boolean = false;

  // References - GuiManager, MagicManager, NpcManager 现在通过 IEngineContext 获取
  private _onMoneyChange: (() => void) | null = null;
  private _pendingAction: PlayerAction | null = null;
  // _magicSpritesInEffect 已在 Character 基类中定义
  // C# Reference: _magicDestination, _magicTarget in Character.cs
  private _pendingMagic: {
    magic: MagicData;
    origin: Vector2;
    destination: Vector2;
    targetId?: string;
  } | null = null;
  // Player 持有 MagicListManager 和 GoodsListManager
  private _magicListManager: MagicListManager = new MagicListManager();
  private _goodsListManager: GoodsListManager = new GoodsListManager();

  constructor() {
    super();

    // Walkability 现在通过 IEngineContext.map 获取

    // Set default player config
    // C#: Player 没有显式设置 Relation，继承 Character 默认值 0 (Friend)
    // 但 IsPlayer 通过 Kind 判断，不依赖 Relation
    this.name = "杨影枫";
    this.setNpcIni("z-杨影枫.ini");
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

    // 设置 MagicListManager 回调
    this._magicListManager.setCallbacks({
      onMagicLevelUp: (oldMagic, newMagic) => {
        this.handleMagicLevelUp(oldMagic, newMagic);
      },
      onXiuLianMagicChange: (xiuLianMagic) => {
        this.updateSpecialAttackTexture(xiuLianMagic);
      },
    });
  }

  /**
   * C#: Player.SetNpcIni - 设置 npcIni 并提取 NpcIniIndex
   * NpcIniIndex 用于构建 SpecialAttackTexture 路径
   */
  setNpcIni(fileName: string): void {
    this.npcIni = fileName;

    // C#: private static readonly Regex NpcIniIndexRegx = new Regex(@".*([0-9]+)\.ini");
    // 从文件名中提取数字索引，例如 "z-杨影枫1.ini" -> 1
    const match = fileName.match(/.*?(\d+)\.ini$/i);
    if (match) {
      const value = parseInt(match[1], 10);
      if (!Number.isNaN(value)) {
        this._npcIniIndex = value;
      } else {
        this._npcIniIndex = 1;
      }
    } else {
      this._npcIniIndex = 1;
    }

    // C#: XiuLianMagic = XiuLianMagic; // Renew xiulian magic
    // 重新设置修炼武功以更新 SpecialAttackTexture 路径
    const xiuLianMagic = this._magicListManager.getXiuLianMagic();
    this.updateSpecialAttackTexture(xiuLianMagic);
  }

  /**
   * 获取 NpcIniIndex
   */
  get npcIniIndex(): number {
    return this._npcIniIndex;
  }

  /**
   * C#: XiuLianMagic setter - 更新 SpecialAttackTexture
   * 当修炼武功改变时，根据 ActionFile 更新特殊攻击纹理路径
   */
  private updateSpecialAttackTexture(xiuLianMagic: MagicItemInfo | null): void {
    // C#: if (_xiuLianMagic != null &&
    //         _xiuLianMagic.TheMagic.AttackFile != null &&
    //         !string.IsNullOrEmpty(_xiuLianMagic.TheMagic.ActionFile))
    //     asf = Utils.GetAsf(@"asf\character\", _xiuLianMagic.TheMagic.ActionFile + NpcIniIndex + ".asf");
    if (xiuLianMagic?.magic?.attackFile && xiuLianMagic.magic.actionFile) {
      // C#: asf/character/{ActionFile}{NpcIniIndex}.asf
      this._specialAttackTexturePath = `asf/character/${xiuLianMagic.magic.actionFile}${this._npcIniIndex}.asf`;
      logger.log(`[Player] Set SpecialAttackTexture: ${this._specialAttackTexturePath}`);
    } else {
      this._specialAttackTexturePath = null;
    }
  }

  // === Manager 访问（通过 IEngineContext）===

  /**
   * 获取 MagicManager（通过 IEngineContext）
   */
  private get magicManager(): MagicManager {
    return this.engine.getManager("magic") as MagicManager;
  }

  /**
   * 获取 NpcManager（通过 IEngineContext）
   */
  private get npcManager(): NpcManager {
    return this.engine.npcManager as NpcManager;
  }

  /**
   * C#: override HasObstacle(tilePosition)
   * Player 版本检查 NPC、Obj、Magic 障碍，但不检查地图障碍
   *
   * C#: return (NpcManager.IsObstacle(tilePosition) ||
   *            ObjManager.IsObstacle(tilePosition) ||
   *            MagicManager.IsObstacle(tilePosition));
   */
  override hasObstacle(tilePosition: Vector2): boolean {
    // Check NPC obstacle
    if (this.npcManager?.isObstacle(tilePosition.x, tilePosition.y)) {
      return true;
    }

    // TODO: Check ObjManager obstacle
    // TODO: Check MagicManager obstacle

    return false;
  }

  /**
   * 获取 GuiManager（通过 IEngineContext）
   */
  private get guiManager(): GuiManager {
    return this.engine.getManager("gui") as GuiManager;
  }

  /**
   * 获取 MagicListManager
   * Player 持有 MagicListManager，其他模块通过此方法访问
   */
  getMagicListManager(): MagicListManager {
    return this._magicListManager;
  }

  /**
   * 应用武功列表中的 FlyIni 效果
   * 在游戏加载后调用，把武功列表中武功的 FlyIni/FlyIni2 应用到玩家身上
   * C# Reference: Player.LoadMagicEffect(MagicItemInfo[] infos)
   */
  loadMagicEffect(): void {
    const allMagicInfos = this._magicListManager.getAllMagicInfos();

    for (const info of allMagicInfos) {
      if (!info.magic) continue;

      // MagicToUseWhenBeAttacked - 被攻击时使用的武功
      // TODO: 需要实现 magicToUseWhenAttackedList 系统

      // FlyIni - 添加飞行动画替换
      if (info.magic.flyIni) {
        this.addFlyIniReplace(info.magic.flyIni);
      }

      // FlyIni2 - 添加飞行动画2替换
      if (info.magic.flyIni2) {
        this.addFlyIni2Replace(info.magic.flyIni2);
      }
    }

    logger.log(`[Player] loadMagicEffect: Applied ${allMagicInfos.length} magic effects`);
  }

  /**
   * 获取 GoodsListManager
   * Player 持有 GoodsListManager，其他模块通过此方法访问
   */
  getGoodsListManager(): GoodsListManager {
    return this._goodsListManager;
  }

  // === 武功管理 ===

  /**
   * 添加武功到玩家武功列表
   * @param magicFile 武功文件名（如 "剑系-无相心法.ini"）
   * @param level 武功等级，默认为 1
   * @returns 是否添加成功
   */
  async addMagic(magicFile: string, level: number = 1): Promise<boolean> {
    try {
      // 构建完整路径
      const fullPath = magicFile.startsWith("/") ? magicFile : ResourcePath.magic(magicFile);

      const magic = await loadMagic(fullPath);
      if (magic) {
        return this._magicListManager.addMagic(magic, level);
      }
      logger.warn(`[Player] Failed to load magic: ${magicFile}`);
      return false;
    } catch (error) {
      logger.error(`[Player] Error adding magic ${magicFile}:`, error);
      return false;
    }
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

  /**
   * C#: ControledCharacter - Currently controlled character
   * Used by soul control magic to take over NPCs
   */
  get controledCharacter(): Character | null {
    return this._controledCharacter;
  }

  set controledCharacter(value: Character | null) {
    this._controledCharacter = value;
  }

  /**
   * 结束控制角色
   * C# Reference: Player.EndControlCharacter
   *
   * 释放当前被控制的角色，清除相关状态
   */
  endControlCharacter(): void {
    if (this._controledCharacter !== null) {
      // C#: NpcManager.CleartFollowTargetIfEqual(ControledCharacter)
      // 清除其他 NPC 对被控制角色的追踪
      this.engine.npcManager.clearFollowTargetIfEqual(this._controledCharacter);

      // C#: ControledCharacter.ControledMagicSprite = null
      this._controledCharacter.controledMagicSprite = null;

      // C#: ControledCharacter = null
      this._controledCharacter = null;

      logger.log("[Player] EndControlCharacter: released controlled character");
    }
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

  // === Callbacks ===

  setOnMoneyChange(callback: () => void): void {
    this._onMoneyChange = callback;
  }

  /**
   * Override: 显示消息给玩家
   * C# Reference: GuiManager.ShowMessage
   */
  protected override showMessage(message: string): void {
    if (this.guiManager) {
      this.guiManager.showMessage(message);
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
      this.guiManager?.showMessage("体力不足!");
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
      this.guiManager?.showMessage("体力不足!");
      return false;
    }

    // C#: else { Thew -= ThewUseAmountWhenAttack; return true; }
    this.thew -= THEW_USE_AMOUNT_WHEN_ATTACK;
    return true;
  }

  /**
   * Get movement direction from keyboard (numpad only)
   */
  private getKeyboardMoveDirection(keys: Set<string>): Direction | null {
    const up = keys.has("Numpad8");
    const down = keys.has("Numpad2");
    const left = keys.has("Numpad4");
    const right = keys.has("Numpad6");

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
    const targetY = this._mapY + vec.y;

    if (vec.y !== 0 && Math.abs(vec.y) === 1) {
      if (isOddRow && vec.x >= 0) {
        targetX = this._mapX + (vec.x > 0 ? 1 : 0);
      } else if (!isOddRow && vec.x <= 0) {
        targetX = this._mapX + (vec.x < 0 ? -1 : 0);
      }
    }

    const targetTile = { x: targetX, y: targetY };
    if (this.checkWalkable(targetTile)) {
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
    // C#: Use FightStand if in fighting mode
    if (this._isInFighting && this.isStateImageOk(CharacterState.FightStand)) {
      this.state = CharacterState.FightStand;
    } else {
      this.state = CharacterState.Stand;
    }
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
    // C#: PlayFrames(FrameEnd - FrameBegin) - NOT PlayCurrentDirOnce()
    // PlayFrames(n) plays n frames starting from current frame
    // So PlayFrames(FrameEnd - FrameBegin) stops exactly at FrameEnd
    // (e.g., if FrameBegin=0, FrameEnd=5, plays frames 0,1,2,3,4 then stops at frame 5)
    // PlayCurrentDirOnce() would play one extra frame causing the frame to wrap back to FrameBegin
    this.playFrames(this._frameEnd - this._frameBegin);

    logger.log(`[Player] Sitdown started`);
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
    this._destinationAttackTilePosition = {
      x: destinationTilePosition.x,
      y: destinationTilePosition.y,
    };

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
      if (this._autoAttackTarget.isDeathInvoked || !this._autoAttackTarget.isEnemy) {
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

    // C#: if (!CanPerformeAttack()) return;
    // CanPerformeAttack() checks DisableSkillMilliseconds <= 0
    if (this.disableSkillMilliseconds > 0) {
      return;
    }

    // C# Reference: Player.PerformeAttack() calls CanAttack() to check/consume thew
    if (!this.canAttack()) {
      return;
    }

    // C#: StateInitialize(); ToFightingState();
    this.toFightingState();

    // Set up attack direction
    const direction = getDirection(this.pixelPosition, destinationPixelPosition);
    this._currentDirection = direction;

    // C#: Random attack state (Attack, Attack1, Attack2)
    const randomValue = Math.floor(Math.random() * 3);
    let chosenState = CharacterState.Attack;
    if (randomValue === 1 && this.isStateImageOk(CharacterState.Attack1)) {
      chosenState = CharacterState.Attack1;
    } else if (randomValue === 2 && this.isStateImageOk(CharacterState.Attack2)) {
      chosenState = CharacterState.Attack2;
    }

    this.state = chosenState;

    // Play animation once
    this.playCurrentDirOnce();

    // Store attack destination for onAttacking callback
    this._attackDestination = destinationPixelPosition;

    // BUG FIX: Set the magic to use when attack animation completes
    // This was missing - causing player attacks to never fire magic sprites
    // C#: _magicToUseWhenAttack = GetRamdomMagicWithUseDistance(AttackRadius);
    this._magicToUseWhenAttack = this.getRandomMagicWithUseDistance(this.getAttackRadius());

    logger.log(
      `[Player] Performs attack towards (${destinationPixelPosition.x}, ${destinationPixelPosition.y}), magic=${this._magicToUseWhenAttack}`
    );
  }

  /**
   * 获取替换后的武功（考虑装备带来的武功替换）
   * C# Reference: Player.UseMagic - _replacedMagic 检查
   * @param magic 原始武功
   * @returns 替换后的武功（如果有替换）或原始武功
   */
  getReplacedMagic(magic: MagicData): MagicData {
    if (!magic.fileName) return magic;

    let replaced = this._replacedMagic.get(magic.fileName);
    if (!replaced) return magic;

    // C#: if (magic.CurrentLevel != magicUse.CurrentLevel) magic = magic.GetLevel(...)
    // 如果替换武功的等级与原武功不同，获取正确等级
    if (replaced.currentLevel !== magic.currentLevel) {
      const leveledMagic = getMagicAtLevel(replaced, magic.currentLevel);
      if (leveledMagic) {
        replaced = leveledMagic;
        this._replacedMagic.set(magic.fileName, leveledMagic);
      }
    }

    // C#: magic.CopyInfo(magicUse) - 复制附加效果
    // 注意：这里创建一个浅拷贝以避免修改原始数据
    return {
      ...replaced,
      additionalEffect: magic.additionalEffect,
    };
  }

  /**
   * 添加装备的武功替换
   * C# Reference: Player.Equiping - _replacedMagic[equip.ReplaceMagic] = Utils.GetMagic(equip.UseReplaceMagic)
   */
  addReplacedMagic(originalMagicFileName: string, replacementMagic: MagicData): void {
    this._replacedMagic.set(originalMagicFileName, replacementMagic);
    logger.log(`[Player] Added magic replacement: ${originalMagicFileName} -> ${replacementMagic.name}`);
  }

  /**
   * 移除装备的武功替换
   * C# Reference: Player.UnEquiping - _replacedMagic.Remove(equip.ReplaceMagic)
   */
  removeReplacedMagic(originalMagicFileName: string): void {
    this._replacedMagic.delete(originalMagicFileName);
    logger.log(`[Player] Removed magic replacement: ${originalMagicFileName}`);
  }

  /**
   * Override: 攻击动画结束时发射武功
   * C#: MagicManager.UseMagic(this, _magicToUseWhenAttack, PositionInWorld, _attackDestination)
   */
  protected override useMagicWhenAttack(): void {
    // DEBUG: 打印详细信息
    logger.log(`[Player] useMagicWhenAttack: magic=${this._magicToUseWhenAttack}, dest=${this._attackDestination ? `${this._attackDestination.x},${this._attackDestination.y}` : 'null'}, flyIni=${this.flyIni}, flyIniInfos.length=${this._flyIniInfos.length}`);

    if (!this._magicToUseWhenAttack || !this._attackDestination) {
      // 没有配置武功，清理并返回
      this._magicToUseWhenAttack = null;
      this._attackDestination = null;
      return;
    }

    // 异步加载并使用武功
    loadMagic(this._magicToUseWhenAttack).then((magic) => {
      if (magic && this._attackDestination) {
        // 使用玩家等级获取武功
        let magicAtLevel = getMagicAtLevel(magic, this.level);

        // C# Reference: Player.UseMagic - 检查 _replacedMagic 并替换
        magicAtLevel = this.getReplacedMagic(magicAtLevel);

        this.magicManager.useMagic({
          userId: "player",
          magic: magicAtLevel,
          origin: this._positionInWorld,
          destination: this._attackDestination,
        });

        logger.log(`[Player] Used attack magic: ${this._magicToUseWhenAttack}`);
      }
      // 清理
      this._magicToUseWhenAttack = null;
      this._attackDestination = null;
    }).catch((err) => {
      logger.error(`[Player] Failed to load attack magic: ${this._magicToUseWhenAttack}`, err);
      this._magicToUseWhenAttack = null;
      this._attackDestination = null;
    });
  }

  /**
   * C#: Player.OnPerformeAttack()
   * 攻击开始时，如果是 Attack2 状态且有 SpecialAttackTexture，使用它
   */
  protected override onPerformeAttack(): void {
    // C#: if (SpecialAttackTexture != null && State == (int)CharacterState.Attack2)
    //     Texture = SpecialAttackTexture;
    if (this._specialAttackTexturePath !== null && this.state === CharacterState.Attack2) {
      // 异步加载 SpecialAttackTexture
      this.loadCustomAsf(this._specialAttackTexturePath).then((asf) => {
        if (asf) {
          // 设置当前纹理为特殊攻击纹理
          this.texture = asf;
        }
      });
    }
  }

  /**
   * Called when attack animation completes
   * C# Reference: Character.OnAttacking(_attackDestination)
   *
   * 在 C# 中，Player 覆盖 OnAttacking 来处理修炼武功的 AttackFile。
   * 普通攻击的伤害通过 FlyIni 武功发射 MagicSprite 来处理。
   * 武功发射现在在基类的 useMagicWhenAttack 中处理。
   */
  protected override onAttacking(): void {
    // C#: Player.OnAttacking - 如果是 Attack2 且有修炼武功的 AttackFile，释放它
    // if (State == (int)CharacterState.Attack2 && XiuLianMagic?.TheMagic?.AttackFile != null)
    //   MagicManager.UseMagic(this, XiuLianMagic.TheMagic.AttackFile, PositionInWorld, _attackDestination);
    if (this.state === CharacterState.Attack2 && this._attackDestination) {
      const xiuLianMagic = this._magicListManager.getXiuLianMagic();
      if (xiuLianMagic?.magic?.attackFile) {
        // 保存 attackFile 引用，避免在异步回调中值变化
        const attackFile = xiuLianMagic.magic.attackFile;
        // 异步加载并使用修炼武功的 AttackFile
        loadMagic(attackFile).then((baseMagic) => {
          if (baseMagic && this.magicManager && this._attackDestination) {
            const magic = getMagicAtLevel(baseMagic, this.level);
            this.magicManager.useMagic({
              userId: "player",
              magic: magic,
              origin: this._positionInWorld,
              destination: this._attackDestination,
            });
            logger.log(`[Player] Used XiuLian AttackFile: ${attackFile}`);
          }
        });
      }
    }

    // 清理攻击目标位置（武功已经在 useMagicWhenAttack 中发射）
    this._destinationAttackTilePosition = null;
  }

  // ========== ReplaceMagicList Overrides ==========
  // C# Reference: Player.OnReplaceMagicList, OnRecoverFromReplaceMagicList

  /**
   * 替换武功列表事件 - Player 特有实现
   * C# Reference: Player.OnReplaceMagicList (override)
   * 注意：Player 完全覆盖此方法，不调用基类（与 C# 一致）
   * Player 只处理 MagicListManager，不处理 flyIniInfos
   */
  protected override onReplaceMagicList(reasonMagic: MagicData, listStr: string): void {
    if (!listStr) return;

    // C#: Player 不调用 base.OnReplaceMagicList，直接处理 MagicListManager

    // 保存当前使用的武功索引
    const currentIndex = this.currentUseMagicIndex;

    // C#: var magics = list == "无" ? new List<string>() : ParseMagicListNoDistance(list);
    const magics = listStr === "无" ? [] : Character.parseMagicListNoDistance(listStr);

    // C#: var path = StorageBase.SaveGameDirectory + @"\" + Name + "_" + reasonMagic.Name + "_" + string.Join("_", magics) + ".ini";
    const path = `${this.name}_${reasonMagic.name}_${magics.join("_")}.ini`;

    // 替换 MagicListManager 列表
    this._magicListManager.replaceListTo(path, magics).then(() => {
      // 恢复当前使用的武功索引
      this.currentUseMagicIndex = currentIndex;
      // C#: XiuLianMagic = MagicListManager.GetItemInfo(MagicListManager.XiuLianIndex)
      this.updateSpecialAttackTexture(this._magicListManager.getXiuLianMagic());
    });

    logger.log(`[Player] OnReplaceMagicList: replaced with "${listStr}" (${magics.length} magics)`);
  }

  /**
   * 从替换武功列表恢复事件 - Player 特有实现
   * C# Reference: Player.OnRecoverFromReplaceMagicList (override)
   * 注意：Player 完全覆盖此方法，不调用基类（与 C# 一致）
   * Player 只处理 MagicListManager，不处理 flyIniInfos
   */
  protected override onRecoverFromReplaceMagicList(reasonMagic: MagicData): void {
    if (!reasonMagic.replaceMagic) return;

    // C#: Player 不调用 base.OnRecoverFromReplaceMagicList，直接处理 MagicListManager

    // 保存当前使用的武功索引
    const currentIndex = this.currentUseMagicIndex;

    // 停止 MagicListManager 替换
    this._magicListManager.stopReplace();

    // 恢复当前使用的武功索引
    this.currentUseMagicIndex = currentIndex;
    // C#: XiuLianMagic = MagicListManager.GetItemInfo(MagicListManager.XiuLianIndex)
    this.updateSpecialAttackTexture(this._magicListManager.getXiuLianMagic());

    logger.log(`[Player] OnRecoverFromReplaceMagicList: restored original magic list`);
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
    const destPixel = tileToPixel(
      this._destinationAttackTilePosition.x,
      this._destinationAttackTilePosition.y
    );

    logger.log(
      `[Player] Reached attack destination, performing attack at (${this._destinationAttackTilePosition.x}, ${this._destinationAttackTilePosition.y})`
    );

    // Perform the attack
    this.performeAttack(destPixel);
  }

  // === Update ===

  /**
   * Override main update to call Player-specific updates
   * C# Reference: Player.cs - Update(GameTime gameTime)
   *
   * C# 中恢复逻辑是在 base.Update() 之前统一处理，而不是在各个状态 override 中。
   * 这样可以确保：
   * 1. 非 standing/walking 状态时，_standingMilliseconds 被正确重置
   * 2. sitting 状态时的 thew→mana 转换逻辑
   */
  override update(deltaTime: number): void {
    // C#: UpdateAutoAttack(gameTime);
    this.updateAutoAttack(deltaTime);

    // TODO: UpdateTouchObj();

    // C#: if ((IsStanding() || IsWalking()) && BodyFunctionWell)
    // 只有在站立或行走时才恢复，其他状态重置计时器
    if ((this.isStanding() || this.isWalking()) && this.bodyFunctionWell) {
      this.updateStandingRestore(deltaTime);
    } else {
      this._standingMilliseconds = 0;
    }

    // C#: if (IsSitted) { ... } - sitting thew→mana conversion
    // 注意：这个逻辑在 updateSitting() 中处理

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
        // C#: Use FightWalk if in fighting mode
        if (this._isInFighting && this.isStateImageOk(CharacterState.FightWalk)) {
          this.state = CharacterState.FightWalk;
        } else {
          this.state = CharacterState.Walk;
        }
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
        logger.log(`[Player] Sitting animation complete, now sitted at frame ${this._frameEnd}`);
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
      logger.log(`[Player] Sitting complete: mana=${this.mana}/${this.manaMax}, thew=${this.thew}`);
      this.standingImmediately();
    }
  }

  /**
   * Override standing state for player-specific logic
   * 恢复逻辑已移至 Player.update() 中，与 C# 一致
   */
  protected override updateStanding(deltaTime: number): void {
    this.updateAnimation(deltaTime);
    this.updateMovementFlags();
  }

  /**
   * Override walking state for player - movement only, restore handled in main update
   * 恢复逻辑已移至 Player.update() 中，与 C# 一致
   */
  protected override updateWalking(deltaTime: number): void {
    this.moveAlongPath(deltaTime, this.walkSpeed);
    this.updateAnimation(deltaTime);
    this.updateMovementFlags();
  }

  /**
   * C#: Player.Update() standing/walking restore logic
   * Life, Thew, and Mana restore every 1 second while standing or walking
   * 注意：条件检查已在 Player.update() 中完成，这里直接执行恢复逻辑
   */
  private updateStandingRestore(deltaTime: number): void {
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
      const manaRestore = Math.floor((this._addManaRestorePercent / 1000) * this.manaMax);
      this.mana = Math.min(this.manaMax, this.mana + manaRestore);

      // C#: if (IsManaRestore) { Mana += (int)(ManaMax * ManaRestorePercent); }
      if (this._isManaRestore) {
        const bonusManaRestore = Math.floor(this.manaMax * MANA_RESTORE_PERCENT);
        this.mana = Math.min(this.manaMax, this.mana + bonusManaRestore);
      }

      this._standingMilliseconds = 0;
    }
  }

  // === Death Handling ===

  /**
   * Override onDeath to run death script and disable input
   * C# Reference: Player.Death() - calls base.Death() then Globals.IsInputDisabled = true
   */
  protected override onDeath(killer: Character | null): void {
    if (this.isDeathInvoked) return;

    // Call base implementation (sets state, flags, plays animation)
    super.onDeath(killer);

    // Run death script if set
    if (this.deathScript) {
      const engine = getEngineContext();
      const basePath = engine.getScriptBasePath();
      const fullPath = this.deathScript.startsWith("/")
        ? this.deathScript
        : `${basePath}/${this.deathScript}`;
      logger.log(`[Player] Running death script: ${fullPath}`);
      engine.runScript(fullPath);
    }

    // C#: Globals.IsInputDisabled = true
    // 注意：这里暂时只打印日志，完整实现需要设置全局输入禁用状态
    logger.log(`[Player] Player died - input should be disabled`);
  }

  /**
   * Override magic cast hook - called when magic animation completes
   * C# Reference: Character.Update() case CharacterState.Magic - CanUseMagic() + PlaySoundEffect + MagicManager.UseMagic()
   */
  protected override onMagicCast(): void {
    // Play Magic state sound effect
    // C# Reference: PlaySoundEffect(NpcIni[(int)CharacterState.Magic].Sound)
    this.playStateSound(CharacterState.Magic);

    if (this._pendingMagic && this.magicManager) {
      // C# Reference: Player.CanUseMagic() - 在动画结束后扣除内力/体力/生命
      // 再次检查能否使用（防止期间消耗改变）
      const canUse = this.canUseMagic(this._pendingMagic.magic);
      if (!canUse.canUse) {
        logger.log(`[Magic] Cannot release magic: ${canUse.reason}`);
        this._pendingMagic = null;
        return;
      }

      // 扣除消耗
      this.consumeMagicCost(this._pendingMagic.magic);

      // C# Reference: Player.UseMagic - 检查 _replacedMagic 并替换
      const magicToUse = this.getReplacedMagic(this._pendingMagic.magic);

      logger.log(`[Magic] Releasing ${magicToUse.name} after casting animation`);
      this.magicManager.useMagic({
        userId: "player",
        magic: magicToUse,
        origin: this._pendingMagic.origin,
        destination: this._pendingMagic.destination,
        targetId: this._pendingMagic.targetId,
      });
      this._pendingMagic = null;
    }
  }

  /**
   * Set pending magic to release after casting animation
   * C# Reference: Character stores MagicUse, _magicDestination, _magicTarget for release in Update()
   */
  setPendingMagic(magic: MagicData, origin: Vector2, destination: Vector2, targetId?: string): void {
    this._pendingMagic = { magic, origin, destination, targetId };
  }

  /**
   * C#: Player.ResetPartnerPosition()
   * Reset all partners to positions around the player
   */
  resetPartnerPosition(): void {
    const partners = this.npcManager.getAllPartners();
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
      { x: 0, y: 2 }, // 0: South
      { x: isOddRow ? 0 : -1, y: 1 }, // 1: SouthWest
      { x: -1, y: 0 }, // 2: West
      { x: isOddRow ? 0 : -1, y: -1 }, // 3: NorthWest
      { x: 0, y: -2 }, // 4: North
      { x: isOddRow ? 1 : 0, y: -1 }, // 5: NorthEast
      { x: 1, y: 0 }, // 6: East
      { x: isOddRow ? 1 : 0, y: 1 }, // 7: SouthEast
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
   * Update animation (calls Sprite.update directly)
   */
  private updateAnimation(deltaTime: number): void {
    // Call Sprite.update directly (not Character.update to avoid recursion)
    if (this._texture && this.isShow) {
      const deltaMs = deltaTime * 1000;
      this._elapsedMilliSecond += deltaMs;

      const frameInterval = this._texture.interval || 100;

      // C#: Only advance if elapsed > interval
      if (this._elapsedMilliSecond > frameInterval) {
        this._elapsedMilliSecond -= frameInterval;

        // C#: Advance frame based on reverse flag
        if (this.isInPlaying && this._isPlayReverse) {
          this.currentFrameIndex--;
        } else {
          this.currentFrameIndex++;
        }
        this.frameAdvanceCount = 1;

        // C#: Decrement frames left to play
        if (this._leftFrameToPlay > 0) {
          this._leftFrameToPlay--;
        }
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

  /**
   * 增加经验值
   * C# Reference: Player.AddExp(amount, addMagicExp)
   * @param amount 经验值
   * @param addMagicExp 是否同时给武功增加经验（击杀时为 true）
   */
  addExp(amount: number, addMagicExp: boolean = false): void {
    // 如果 addMagicExp 为 true，给修炼武功和当前使用武功增加经验
    if (addMagicExp) {
      // 给修炼中的武功增加经验
      const xiuLianMagic = this._magicListManager.getXiuLianMagic();
      if (xiuLianMagic?.magic?.fileName) {
        const xiuLianExp = Math.floor(amount * this._magicListManager.getXiuLianMagicExpFraction());
        if (xiuLianExp > 0) {
          this._magicListManager.addMagicExp(xiuLianMagic.magic.fileName, xiuLianExp);
          logger.log(
            `[Player] XiuLian magic "${xiuLianMagic.magic?.name}" gained ${xiuLianExp} exp`
          );
        }
      }

      // 给当前使用的武功增加经验
      const currentMagic = this._magicListManager.getCurrentMagicInUse();
      if (currentMagic?.magic?.fileName) {
        const useMagicExp = Math.floor(amount * this._magicListManager.getUseMagicExpFraction());
        if (useMagicExp > 0) {
          this._magicListManager.addMagicExp(currentMagic.magic.fileName, useMagicExp);
          logger.log(
            `[Player] Current magic "${currentMagic.magic?.name}" gained ${useMagicExp} exp`
          );
        }
      }
    }

    this.exp += amount;
    this.checkLevelUp();
  }

  /**
   * 处理武功升级时的玩家属性加成
   * C# Reference: Player.AddMagicExp - magic level up, add player properties
   */
  private handleMagicLevelUp(oldMagic: MagicData, newMagic: MagicData): void {
    // C#: LifeMax += info.TheMagic.LifeMax; etc.
    this.lifeMax += newMagic.lifeMax || 0;
    this.thewMax += newMagic.thewMax || 0;
    this.manaMax += newMagic.manaMax || 0;
    this.attack += newMagic.attack || 0;
    this.defend += newMagic.defend || 0;
    this.evade += newMagic.evade || 0;
    this.attack2 += newMagic.attack2 || 0;
    this.defend2 += newMagic.defend2 || 0;
    this.attack3 += newMagic.attack3 || 0;
    this.defend3 += newMagic.defend3 || 0;
    this._addLifeRestorePercent += newMagic.addLifeRestorePercent || 0;
    this._addThewRestorePercent += newMagic.addThewRestorePercent || 0;
    this._addManaRestorePercent += newMagic.addManaRestorePercent || 0;

    // C# Reference: Player.AddMagicExp - FlyIni 替换逻辑
    // if (oldMagic.FlyIni != newMagic.FlyIni) { RemoveFlyIniReplace(old); AddFlyIniReplace(new); }
    if (oldMagic.flyIni !== newMagic.flyIni) {
      if (oldMagic.flyIni) {
        this.removeFlyIniReplace(oldMagic.flyIni);
      }
      if (newMagic.flyIni) {
        this.addFlyIniReplace(newMagic.flyIni);
      }
    }
    if (oldMagic.flyIni2 !== newMagic.flyIni2) {
      if (oldMagic.flyIni2) {
        this.removeFlyIni2Replace(oldMagic.flyIni2);
      }
      if (newMagic.flyIni2) {
        this.addFlyIni2Replace(newMagic.flyIni2);
      }
    }

    // TODO: MagicToUseWhenBeAttacked 更新逻辑

    // 显示升级消息
    this.guiManager?.showMessage?.(`武功 ${newMagic.name} 升级了`);
    logger.log(`[Player] Magic "${newMagic.name}" leveled up - stats added`);
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
    const levelConfig = this.levelManager.getLevelConfig();

    this.level = level;
    logger.log(`[Player] SetLevelTo: ${level}`);

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

  /**
   * 设置等级配置文件
   * C#: SetLevelFile 脚本命令
   */
  async setLevelFile(filePath: string): Promise<void> {
    await this.levelManager.setLevelFile(filePath);
  }

  levelUpTo(targetLevel: number): boolean {
    const currentLevel = this.level;
    if (targetLevel <= currentLevel) return false;

    const levelConfig = this.levelManager.getLevelConfig();
    const maxLevel = this.levelManager.getMaxLevel();

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
    await this.levelManager.initialize();

    const levelConfig = this.levelManager.getLevelConfig();
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
    // 确保等级配置已初始化
    await this.levelManager.initialize();

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
      logger.error(`[Player] Error loading:`, error);
      return false;
    }
  }

  /**
   * 从存档数据加载玩家
   * 用于 JSON 存档恢复，由 Loader.loadPlayerFromJSON 调用
   * C# Reference: Character.Load() + Player 特有字段
   */
  loadFromSaveData(data: PlayerSaveData): void {
    // === 基本信息 ===
    this.name = data.name;
    if (data.npcIni) {
      // 使用 setNpcIni 来提取 NpcIniIndex
      this.setNpcIni(data.npcIni);
    }
    this.kind = data.kind;
    this.relation = data.relation;
    this.pathFinder = data.pathFinder;

    // === 位置 ===
    this.setPosition(data.mapX, data.mapY);
    this.setDirection(data.dir);

    // === 范围 ===
    this.visionRadius = data.visionRadius;
    this.dialogRadius = data.dialogRadius;
    this.attackRadius = data.attackRadius;

    // === 属性 ===
    // 必须先设置 Max 再设置当前值（setter 会限制在 Max 以内）
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
    this.action = data.action;
    this.walkSpeed = data.walkSpeed;
    this.addMoveSpeedPercent = data.addMoveSpeedPercent;
    this.expBonus = data.expBonus;
    this.canLevelUp = data.canLevelUp;

    // === 位置相关 ===
    this.fixedPos = data.fixedPos;
    this.currentFixedPosIndex = data.currentFixedPosIndex;
    // destinationMapPosX/Y 用于恢复目标位置，但通常重新加载时不需要继续移动

    // === AI/行为 ===
    this.idle = data.idle;
    this.group = data.group;
    this.noAutoAttackPlayer = data.noAutoAttackPlayer;
    this.invincible = data.invincible;

    // === 状态效果 ===
    this.poisonSeconds = data.poisonSeconds;
    this.poisonByCharacterName = data.poisonByCharacterName;
    this.petrifiedSeconds = data.petrifiedSeconds;
    this.frozenSeconds = data.frozenSeconds;
    this.isPoisonVisualEffect = data.isPoisonVisualEffect;
    this.isPetrifiedVisualEffect = data.isPetrifiedVisualEffect;
    this.isFrozenVisualEffect = data.isFrozenVisualEffect;

    // === 死亡/复活 ===
    this.isDeath = data.isDeath;
    this.isDeathInvoked = data.isDeathInvoked;
    this.reviveMilliseconds = data.reviveMilliseconds;
    this.leftMillisecondsToRevive = data.leftMillisecondsToRevive;

    // === INI 文件 ===
    if (data.bodyIni) this.bodyIni = data.bodyIni;
    if (data.flyIni) this.flyIni = data.flyIni;
    if (data.flyIni2) this.flyIni2 = data.flyIni2;
    if (data.flyInis) this.flyInis = data.flyInis;
    this.isBodyIniAdded = data.isBodyIniAdded;

    // === 脚本相关 ===
    if (data.scriptFile) this.scriptFile = data.scriptFile;
    if (data.scriptFileRight) this.scriptFileRight = data.scriptFileRight;
    if (data.deathScript) this.deathScript = data.deathScript;
    if (data.timerScriptFile) this.timerScript = data.timerScriptFile;
    this.timerInterval = data.timerScriptInterval;

    // === 技能相关 ===
    if (data.magicToUseWhenLifeLow) this.magicToUseWhenLifeLow = data.magicToUseWhenLifeLow;
    this.lifeLowPercent = data.lifeLowPercent;
    this.keepRadiusWhenLifeLow = data.keepRadiusWhenLifeLow;
    this.keepRadiusWhenFriendDeath = data.keepRadiusWhenFriendDeath;
    if (data.magicToUseWhenBeAttacked) this.magicToUseWhenBeAttacked = data.magicToUseWhenBeAttacked;
    this.magicDirectionWhenBeAttacked = data.magicDirectionWhenBeAttacked;
    if (data.magicToUseWhenDeath) this.magicToUseWhenDeath = data.magicToUseWhenDeath;
    this.magicDirectionWhenDeath = data.magicDirectionWhenDeath;

    // === 商店/可见性 ===
    if (data.buyIniFile) this.buyIniFile = data.buyIniFile;
    if (data.buyIniString) this.buyIniString = data.buyIniString;
    if (data.visibleVariableName) this.visibleVariableName = data.visibleVariableName;
    this.visibleVariableValue = data.visibleVariableValue;

    // === 掉落 ===
    if (data.dropIni) this.dropIni = data.dropIni;

    // === 装备 ===
    this.canEquip = data.canEquip;
    if (data.headEquip) this.headEquip = data.headEquip;
    if (data.neckEquip) this.neckEquip = data.neckEquip;
    if (data.bodyEquip) this.bodyEquip = data.bodyEquip;
    if (data.backEquip) this.backEquip = data.backEquip;
    if (data.handEquip) this.handEquip = data.handEquip;
    if (data.wristEquip) this.wristEquip = data.wristEquip;
    if (data.footEquip) this.footEquip = data.footEquip;
    if (data.backgroundTextureEquip) this.backgroundTextureEquip = data.backgroundTextureEquip;

    // === 保持攻击位置 ===
    this.keepAttackX = data.keepAttackX;
    this.keepAttackY = data.keepAttackY;

    // === 伤害玩家 ===
    this.hurtPlayerInterval = data.hurtPlayerInterval;
    this.hurtPlayerLife = data.hurtPlayerLife;
    this.hurtPlayerRadius = data.hurtPlayerRadius;

    // === Player 特有 ===
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
      case "life":
        this.life = value;
        break;
      case "lifemax":
        this.lifeMax = value;
        break;
      case "thew":
        this.thew = value;
        break;
      case "thewmax":
        this.thewMax = value;
        break;
      case "mana":
        this.mana = value;
        break;
      case "manamax":
        this.manaMax = value;
        break;
      case "attack":
        this.attack = value;
        break;
      case "defend":
        this.defend = value;
        break;
      case "evade":
        this.evade = value;
        break;
      case "level":
        this.level = value;
        break;
      case "exp":
        this.exp = value;
        break;
      case "levelupexp":
        this.levelUpExp = value;
        break;
    }
  }

  // isFullLife 现在继承自基类 Character.isFullLife getter

  /**
   * Add money to player with message display
   * C# Reference: Player.AddMoney - shows message "你得到了 X 两银子。" or "你失去了 X 两银子。"
   */
  addMoney(amount: number): void {
    if (amount > 0) {
      this._money += amount;
      this.guiManager?.showMessage(`你得到了 ${amount} 两银子。`);
      this._onMoneyChange?.();
    } else if (amount < 0) {
      this._money += amount;
      if (this._money < 0) this._money = 0;
      this.guiManager?.showMessage(`你失去了 ${-amount} 两银子。`);
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
    // 调试无敌模式：玩家不受伤害
    if (this.engine.getManager("debug")?.isGodMode()) {
      return false;
    }

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

      // C# Reference: Character.Equiping - MagicToUseWhenBeAttacked 处理
      // if (!string.IsNullOrEmpty(equip.MagicToUseWhenBeAttacked.GetValue())) {
      //     MagicToUseWhenAttackedList.AddLast(new MagicToUseInfoItem { From = equip.FileName, Magic = ..., Dir = ... });
      // }
      if (equip.magicToUseWhenBeAttacked) {
        this.loadAndAddEquipMagicToUseWhenBeAttacked(
          equip.fileName,
          equip.magicToUseWhenBeAttacked,
          equip.magicDirectionWhenBeAttacked
        );
      }

      // C# Reference: Character.Equiping - FlyIniReplace 处理
      // if (!string.IsNullOrEmpty(equip.FlyIni.GetValue())) { AddFlyIniReplace(...) }
      if (equip.flyIni) {
        this.addFlyIniReplace(equip.flyIni);
      }
      if (equip.flyIni2) {
        this.addFlyIni2Replace(equip.flyIni2);
      }
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

    // C# Reference: Character.UnEquiping - MagicToUseWhenBeAttacked 处理
    // if (!string.IsNullOrEmpty(equip.MagicToUseWhenBeAttacked.GetValue())) {
    //     RemoveMagicToUseWhenAttackedList(equip.FileName);
    // }
    if (equip.magicToUseWhenBeAttacked) {
      this.removeMagicToUseWhenAttackedList(equip.fileName);
    }

    // C# Reference: Character.UnEquiping - FlyIniReplace 处理
    // if (!string.IsNullOrEmpty(equip.FlyIni.GetValue())) { RemoveFlyIniReplace(...) }
    if (equip.flyIni) {
      this.removeFlyIniReplace(equip.flyIni);
    }
    if (equip.flyIni2) {
      this.removeFlyIni2Replace(equip.flyIni2);
    }

    if (this.life > this.lifeMax) this.life = this.lifeMax;
    if (this.thew > this.thewMax) this.thew = this.thewMax;
    if (this.mana > this.manaMax) this.mana = this.manaMax;
  }

  /**
   * 异步加载并添加装备的被攻击触发武功
   * C# Reference: Character.Equiping - MagicToUseWhenAttackedList.AddLast
   */
  private async loadAndAddEquipMagicToUseWhenBeAttacked(
    equipFileName: string,
    magicFileName: string,
    direction: number
  ): Promise<void> {
    try {
      const baseMagic = await loadMagic(magicFileName);
      if (!baseMagic) {
        logger.warn(`[Player] Failed to load MagicToUseWhenBeAttacked: ${magicFileName}`);
        return;
      }
      const magic = getMagicAtLevel(baseMagic, this.attackLevel);
      this.addMagicToUseWhenAttackedList({
        from: equipFileName,
        magic,
        dir: direction,
      });
      logger.log(`[Player] Added MagicToUseWhenBeAttacked from equip ${equipFileName}: ${magic.name}`);
    } catch (err) {
      logger.error(`[Player] Error loading MagicToUseWhenBeAttacked: ${err}`);
    }
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

  canUseMagic(magic: {
    manaCost: number;
    thewCost: number;
    lifeCost: number;
    lifeFullToUse: number;
    disableUse: number;
  }): { canUse: boolean; reason?: string } {
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

  // === Occlusion Transparency System ===
  // C# Reference: Player.Draw - 当玩家被遮挡物覆盖时绘制半透明效果

  // 位置缓存，用于优化遮挡检测（只在位置变化时重新计算）
  private _lastOcclusionCheckTileX: number = -1;
  private _lastOcclusionCheckTileY: number = -1;

  /**
   * 获取玩家是否被遮挡
   * 用于在渲染时决定是否绘制半透明叠加层
   */
  get isOccluded(): boolean {
    return this._isOccluded;
  }

  /**
   * 更新遮挡状态（在 update 中调用）
   * 检测玩家是否被地图瓦片或 NPC 遮挡
   * 优化：只在玩家瓦片位置变化时重新计算
   */
  updateOcclusionState(): void {
    const currentTileX = this.tilePosition.x;
    const currentTileY = this.tilePosition.y;

    // 位置没变化，跳过计算
    if (
      currentTileX === this._lastOcclusionCheckTileX &&
      currentTileY === this._lastOcclusionCheckTileY
    ) {
      return;
    }

    this._lastOcclusionCheckTileX = currentTileX;
    this._lastOcclusionCheckTileY = currentTileY;
    this._isOccluded = this.checkOcclusionTransparency();
  }

  /**
   * 检测玩家是否被地图瓦片或 NPC 遮挡
   * 返回是否需要绘制半透明叠加层
   * C# Reference: Player.Draw 中检测 layer2, layer3 和 NPC 碰撞
   */
  private checkOcclusionTransparency(): boolean {
    const engine = this.engine;
    if (!engine) return false;

    const mapRenderer = engine.getManager("mapRenderer");
    if (!mapRenderer || !mapRenderer.mapData || mapRenderer.isLoading) return false;

    const playerRegion = this.regionInWorld;
    const playerMapY = this.tilePosition.y;

    // 检查范围：玩家位置 ±4 列、+1~+10 行（只检测玩家前方的瓦片）
    const startX = Math.max(0, this.tilePosition.x - 4);
    const endX = Math.min(mapRenderer.mapData.mapColumnCounts, this.tilePosition.x + 5);
    const startY = playerMapY + 1;
    const endY = Math.min(mapRenderer.mapData.mapRowCounts, playerMapY + 10);

    // 检测与地图瓦片的碰撞（只检测玩家前方的瓦片）
    for (let y = startY; y < endY; y++) {
      for (let x = startX; x < endX; x++) {
        // 检测 layer2（地图物体层）
        const layer2Region = getTileTextureRegion(mapRenderer, x, y, "layer2");
        if (layer2Region && isBoxCollide(playerRegion, layer2Region)) {
          return true;
        }
        // 检测 layer3（顶层物体）
        const layer3Region = getTileTextureRegion(mapRenderer, x, y, "layer3");
        if (layer3Region && isBoxCollide(playerRegion, layer3Region)) {
          return true;
        }
      }
    }

    // 检测与视野内 NPC 的碰撞
    // 性能优化：使用 Update 阶段预计算的 npcsInView，已经过滤了视野外的 NPC
    const npcManager = engine.npcManager;
    if (npcManager) {
      const npcsInView = npcManager.npcsInView;

      for (const npc of npcsInView) {
        if (!npc.isVisible || npc.isHide) continue;
        // 只检测在玩家前面的 NPC（mapY > playerMapY）
        if (npc.tilePosition.y > playerMapY) {
          const npcRegion = npc.regionInWorld;
          if (isBoxCollide(playerRegion, npcRegion)) {
            return true;
          }
        }
      }
    }

    return false;
  }

  /**
   * C# Reference: Player.Draw
   * 重写绘制方法
   * 注意：半透明遮挡效果在 gameEngine.ts 中绘制（在所有地图层之后）
   */
  override draw(
    ctx: CanvasRenderingContext2D,
    cameraX: number,
    cameraY: number,
    offX: number = 0,
    offY: number = 0
  ): void {
    if (!this._isVisible) return;

    // 确定绘制颜色（状态效果）
    let drawColor = "white";
    if (this.frozenSeconds > 0 && this.isFrozenVisualEffect) {
      drawColor = "frozen";
    }
    if (this.poisonSeconds > 0 && this.isPoisonVisualEffect) {
      drawColor = "poison";
    }
    if (this.petrifiedSeconds > 0 && this.isPetrifiedVisualEffect) {
      drawColor = "black";
    }

    // 正常绘制玩家
    this.drawWithColor(ctx, cameraX, cameraY, drawColor, offX, offY);
    // 注意：半透明遮挡效果不在这里绘制，而是在 gameEngine.ts 中
    // 在所有地图层渲染完成后单独绘制半透明玩家叠加层
  }

  // === BUFF System ===
  // C# Reference: Character.cs - LinkedList<MagicSprite> MagicSpritesInEffect
  // 已在 Character 基类中实现：addMagicSpriteInEffect, removeMagicSpriteInEffect, getMagicSpritesInEffect

  /**
   * 覆盖基类方法，添加日志
   */
  override addMagicSpriteInEffect(sprite: MagicSprite): void {
    // 检查是否已有同名武功
    const existingIndex = this._magicSpritesInEffect.findIndex(
      (s) => s.magic.name === sprite.magic.name
    );

    if (existingIndex >= 0) {
      // 已有同名武功，更新为新的（重置持续时间）
      this._magicSpritesInEffect[existingIndex] = sprite;
      logger.log(`[Player] BUFF reset: ${sprite.magic.name}`);
    } else {
      // 添加新的武功精灵
      this._magicSpritesInEffect.push(sprite);
      logger.log(`[Player] BUFF added: ${sprite.magic.name}, effect=${sprite.currentEffect}`);
    }
  }

  /**
   * 根据精灵ID移除（Player 特有方法）
   */
  removeMagicSpriteInEffectById(spriteId: number): void {
    const index = this._magicSpritesInEffect.findIndex((s) => s.id === spriteId);
    if (index >= 0) {
      const removed = this._magicSpritesInEffect.splice(index, 1)[0];
      logger.log(`[Player] BUFF removed: ${removed.magic.name}`);
    }
  }

  /**
   * 清理已销毁的武功精灵
   * C# Reference: Character.Update - for (var node = MagicSpritesInEffect.First; ...)
   */
  cleanupDestroyedMagicSprites(): void {
    this._magicSpritesInEffect = this._magicSpritesInEffect.filter((s) => !s.isDestroyed);
  }

  /**
   * 计算武功减伤量（金钟罩等）
   * C# Reference: MagicSprite.CharacterHited
   * GetEffectAmount(magic, character) 中 character 是被保护角色 (this)
   */
  calculateDamageReduction(): { effect: number; effect2: number; effect3: number } {
    let reductionEffect = 0;
    let reductionEffect2 = 0;
    let reductionEffect3 = 0;

    for (const sprite of this._magicSpritesInEffect) {
      const magic = sprite.magic;

      // MoveKind=13 (FollowCharacter) + SpecialKind=3 (BuffOrPetrify) = 防护类 BUFF
      if (
        magic.moveKind === MagicMoveKind.FollowCharacter &&
        magic.specialKind === MagicSpecialKind.BuffOrPetrify
      ) {
        // C# MagicManager.GetEffectAmount - 包含 AddMagicEffect 加成
        const effect = getEffectAmount(magic, this, "effect");
        const effect2 = getEffectAmount(magic, this, "effect2");
        const effect3 = getEffectAmount(magic, this, "effect3");

        reductionEffect += effect;
        reductionEffect2 += effect2;
        reductionEffect3 += effect3;

        logger.log(
          `[Player] BUFF damage reduction from ${magic.name}: ${effect}/${effect2}/${effect3}`
        );
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
      if (
        magic.moveKind === MagicMoveKind.FollowCharacter &&
        magic.specialKind === MagicSpecialKind.Buff
      ) {
        return true;
      }
    }
    return false;
  }
}
