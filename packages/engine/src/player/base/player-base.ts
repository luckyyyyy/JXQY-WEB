/**
 * PlayerBase - Player 基类 (属性声明层)
 * 包含所有属性声明、getter/setter、以及基本工具方法
 *
 * 继承链: Character → PlayerBase → PlayerCombat → Player
 */

import { Character } from "../../character";
import { logger } from "../../core/logger";
import type { Vector2 } from "../../core/types";
import {
  CharacterKind,
  CharacterState,
  DEFAULT_CHARACTER_CONFIG,
  Direction,
} from "../../core/types";
import type { GuiManager } from "../../gui/gui-manager";
import { getMagic } from "../../magic/magic-config-loader";
import type { MagicData, MagicItemInfo } from "../../magic/types";
import { MagicAddonEffect } from "../../magic/types";
import type { Npc, NpcManager } from "../../npc";
import { type AsfData, getCachedAsf } from "../../resource/format/asf";
import { ResourcePath } from "../../resource/resource-paths";
import type { InputState } from "../../runtime/input-types";
import { PathType } from "../../utils/path-finder";
import { GoodsListManager } from "../goods/goods-list-manager";
import { PlayerMagicInventory } from "../magic/player-magic-inventory";

const DEFAULT_PLAYER_STATS = DEFAULT_CHARACTER_CONFIG.stats;

// Thew cost constants from Player.cs
export const THEW_USE_AMOUNT_WHEN_RUN = 1;
export const THEW_USE_AMOUNT_WHEN_ATTACK = 5;
export const THEW_USE_AMOUNT_WHEN_JUMP = 10;
export const IS_USE_THEW_WHEN_NORMAL_RUN = false;
// Mana restore interval when sitting (ms)
export const SITTING_MANA_RESTORE_INTERVAL = 150;

// Restore percentages from Player.cs
export const LIFE_RESTORE_PERCENT = 0.01;
export const THEW_RESTORE_PERCENT = 0.03;
export const MANA_RESTORE_PERCENT = 0.02;
// Restore interval (ms) - every 1 second
export const RESTORE_INTERVAL_MS = 1000;

/** 玩家动作类型 */
export interface PlayerAction {
  type: "interact" | "attack" | "use_skill" | "use_item";
  targetNpc?: Npc;
  skillSlot?: number;
  itemSlot?: number;
}

/**
 * PlayerBase - 属性声明层
 * 包含所有属性声明和基本工具方法，不包含复杂业务逻辑
 */
export abstract class PlayerBase extends Character {
  // =============================================
  // === 角色索引（多主角系统）===
  // =============================================
  /**
   * 玩家角色索引
   * 决定加载哪个 Player{index}.ini / Magic{index}.ini / Good{index}.ini
   */
  protected _playerIndex: number = 0;

  /** 获取当前玩家角色索引 */
  get playerIndex(): number {
    return this._playerIndex;
  }

  /**
   * 切换玩家角色索引
   * @param index 新的玩家角色索引
   */
  setPlayerIndex(index: number): void {
    this._playerIndex = index;
    // 通知 UI 刷新（状态面板头像等）
    this.engine.notifyPlayerStateChanged();
  }

  /**
   * 切换玩家角色索引（静默模式，不通知 UI）
   * 用于 PlayerChange 流程中，在数据加载完成后再统一通知 UI
   * @param index 新的玩家角色索引
   */
  setPlayerIndexSilent(index: number): void {
    this._playerIndex = index;
  }

  // =============================================
  // === Player Fields ===
  // =============================================
  protected _money: number = 0;
  protected _doing: number = 0;
  protected _desX: number = 0;
  protected _desY: number = 0;
  protected _belong: number = 0;
  protected _fight: number = 0;
  protected _isRun: boolean = false;
  protected _walkIsRun: number = 0;
  protected _isRunDisabled: boolean = false;
  protected _standingMilliseconds: number = 0;
  protected _sittedMilliseconds: number = 0;
  protected _autoAttackTarget: Character | null = null;
  protected _autoAttackTimer: number = 0;
  protected _autoAttackIsRun: boolean = false;

  // Character currently being controlled by player
  // Used by magic like "驭魂术" (soul control) to take over an NPC
  protected _controledCharacter: Character | null = null;

  // 修炼武功的特殊攻击动画
  // 当 XiuLianMagic 有 ActionFile 时加载的 ASF 数据
  protected _specialAttackTexture: AsfData | null = null;

  // 预加载的修炼武功 AttackFile 的 Magic 数据
  // 这样在攻击时不需要异步加载，直接使用
  protected _xiuLianAttackMagic: MagicData | null = null;

  // 从 npcIni 文件名中提取的数字索引
  // 用于构建 SpecialAttackTexture 路径：ActionFile + NpcIniIndex + ".asf"
  protected _npcIniIndex: number = 1;

  // Equipment effects
  protected _isNotUseThewWhenRun: boolean = false;
  protected _isManaRestore: boolean = false;
  // 武器的附加效果（中毒/冰冻/石化）
  protected _flyIniAdditionalEffect: MagicAddonEffect = MagicAddonEffect.None;
  protected _addLifeRestorePercent: number = 0;
  protected _addManaRestorePercent: number = 0;
  protected _addThewRestorePercent: number = 0;
  protected _addMagicEffectPercent: number = 0;
  protected _addMagicEffectAmount: number = 0;

  // Magic limits
  protected _manaLimit: boolean = false;
  protected _currentUseMagicIndex: number = 0;

  // === ReplacedMagic ===
  // 装备带来的武功替换：key=原武功文件名, value=替换后的武功数据
  // 例如某装备让"火球术"变成"大火球术"
  protected _replacedMagic: Map<string, MagicData> = new Map();

  // Movement
  protected _isMoving: boolean = false;
  protected _targetPosition: Vector2 | null = null;

  // Occlusion transparency - 遮挡半透明状态
  protected _isOccluded: boolean = false;

  // References - GuiManager, MagicManager, NpcManager 现在通过 EngineContext 获取
  protected _onMoneyChange: (() => void) | null = null;
  protected _pendingAction: PlayerAction | null = null;
  // _magicSpritesInEffect 已在 Character 基类中定义
  // _magicDestination, _magicTarget in Character.cs
  protected _pendingMagic: {
    magic: MagicData;
    origin: Vector2;
    destination: Vector2;
    targetId?: string;
  } | null = null;
  // Player 持有 PlayerMagicInventory 和 GoodsListManager
  protected _magicInventory: PlayerMagicInventory = new PlayerMagicInventory();
  protected _goodsListManager: GoodsListManager = new GoodsListManager();

  // =============================================
  // === Constructor ===
  // =============================================
  constructor() {
    super();

    // Walkability 现在通过 EngineContext.map 获取

    // Set default player config
    // Player 没有显式设置 Relation，继承 Character 默认值 0 (Friend)
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

    // 设置 PlayerMagicInventory 回调
    this._magicInventory.setCallbacks({
      onMagicLevelUp: (oldMagic, newMagic) => {
        this.handleMagicLevelUp(oldMagic, newMagic);
      },
      onXiuLianMagicChange: (xiuLianMagic) => {
        // 资源已在 addMagic 时预加载，这里同步获取
        this.updateSpecialAttackTexture(xiuLianMagic);
      },
    });
  }

  // =============================================
  // === NpcIni and XiuLian Magic ===
  // =============================================

  /**
   * 设置 npcIni 并提取 NpcIniIndex
   * NpcIniIndex 用于构建 SpecialAttackTexture 路径
   *
   * @returns Promise 当预加载完成时 resolve
   */
  async setNpcIni(fileName: string): Promise<void> {
    this.npcIni = fileName;

    // private static readonly Regex NpcIniIndexRegx = new Regex(@".*([0-9]+)\.ini");
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

    // 通知 PlayerMagicInventory 更新 npcIniIndex 并等待预加载完成
    await this._magicInventory.setNpcIniIndex(this._npcIniIndex);

    // XiuLianMagic = XiuLianMagic; // Renew xiulian magic
    // 同步获取已预加载的资源
    const xiuLianMagic = this._magicInventory.getXiuLianMagic();
    this.updateSpecialAttackTexture(xiuLianMagic);
  }

  /**
   * 获取 NpcIniIndex
   */
  get npcIniIndex(): number {
    return this._npcIniIndex;
  }

  /**
   * XiuLianMagic setter - 更新 SpecialAttackTexture
   * 当修炼武功改变时，同步获取预加载的资源
   * 注意：所有资源已在 PlayerMagicInventory._setMagicItemAt 中预加载
   */
  protected updateSpecialAttackTexture(xiuLianMagic: MagicItemInfo | null): void {
    // if (_xiuLianMagic != null &&
    //         _xiuLianMagic.TheMagic.AttackFile != null &&
    //         !string.IsNullOrEmpty(_xiuLianMagic.TheMagic.ActionFile))
    //     asf = Utils.GetAsf(@"asf\character\", _xiuLianMagic.TheMagic.ActionFile + NpcIniIndex + ".asf");
    if (xiuLianMagic?.magic?.attackFile && xiuLianMagic.magic.actionFile) {
      // {ActionFile}{NpcIniIndex}.asf
      const asfFileName = `${xiuLianMagic.magic.actionFile}${this._npcIniIndex}.asf`;

      // 同步从缓存获取 SpecialAttackTexture（已在 PlayerMagicInventory 中预加载）
      const paths = [
        ResourcePath.asfCharacter(asfFileName),
        ResourcePath.asfInterlude(asfFileName),
      ];
      for (const path of paths) {
        const asf = getCachedAsf(path);
        if (asf) {
          this._specialAttackTexture = asf;
          break;
        }
      }

      // 同步从缓存获取修炼武功的 AttackFile（已在 PlayerMagicInventory 中预加载）
      // AttackFile = new Magic(path, noLevel=true, noAttackFile=true)
      const baseMagic = getMagic(xiuLianMagic.magic.attackFile);
      if (baseMagic) {
        this._xiuLianAttackMagic = baseMagic;
      } else {
        logger.warn(`[Player] XiuLianAttackMagic not in cache: ${xiuLianMagic.magic.attackFile}`);
        this._xiuLianAttackMagic = null;
      }
    } else {
      this._specialAttackTexture = null;
      this._xiuLianAttackMagic = null;
    }
  }

  // =============================================
  // === Manager 访问（通过 EngineContext）===
  // =============================================

  /**
   * 获取 MagicManager（通过 EngineContext）
   */
  /**
   * 获取 NpcManager（通过 EngineContext）
   */
  protected get npcManager(): NpcManager {
    return this.engine.npcManager as NpcManager;
  }

  /**
   * override HasObstacle(tilePosition)
   * Player 版本检查 NPC、Obj、Magic 障碍，但不检查地图障碍
   *
   * return (NpcManager.IsObstacle(tilePosition) ||
   *            ObjManager.IsObstacle(tilePosition) ||
   *            MagicManager.IsObstacle(tilePosition));
   */
  override hasObstacle(tilePosition: Vector2): boolean {
    return this.hasEntityObstacle(tilePosition);
  }

  /**
   * 获取 GuiManager（通过 EngineContext）
   */
  protected get guiManager(): GuiManager {
    return this.engine.guiManager;
  }

  /**
   * 获取 PlayerMagicInventory
   * Player 持有 PlayerMagicInventory，其他模块通过此方法访问
   */
  getPlayerMagicInventory(): PlayerMagicInventory {
    return this._magicInventory;
  }

  /**
   * 应用武功列表中的 FlyIni 效果
   * 在游戏加载后调用，把武功列表中武功的 FlyIni/FlyIni2 应用到玩家身上
   * Reference: Player.LoadMagicEffect(MagicItemInfo[] infos)
   */
  loadMagicEffect(): void {
    const allMagicInfos = this._magicInventory.getAllMagicInfos();

    for (const info of allMagicInfos) {
      if (!info.magic) continue;

      // MagicToUseWhenBeAttacked - 被攻击时使用的武功
      // Reference: 武功有 MagicToUseWhenBeAttacked 属性，会添加到 MagicToUseWhenAttackedList
      // 此功能待实现：需要在 CharacterBase 中添加 magicToUseWhenAttackedList 并在被击时触发

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

  // =============================================
  // === Input Handling ===
  // =============================================

  /**
   * Handle input for movement
   */
  handleInput(input: InputState, _cameraX: number, _cameraY: number): PlayerAction | null {
    this._pendingAction = null;

    if (!this.canPerformAction()) {
      return null;
    }

    this._isRun = this.canRun(input.isShiftDown);

    if (this._controledCharacter === null) {
      const moveDir = this.getKeyboardMoveDirection(input.keys);
      if (moveDir !== null) {
        this.moveInDirection(moveDir, this._isRun);
        return null;
      }

      if (input.joystickDirection !== null) {
        this.moveInDirection(input.joystickDirection, this._isRun);
        return null;
      }
    }

    if (input.isMouseDown && input.clickedTile) {
      const targetTile = input.clickedTile;
      const destMatch =
        this._destinationMoveTilePosition &&
        this._destinationMoveTilePosition.x === targetTile.x &&
        this._destinationMoveTilePosition.y === targetTile.y;
      const hasPath = this.path.length > 0;

      if (destMatch && hasPath) {
        return null;
      }

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
  protected canRun(isShiftDown: boolean): boolean {
    return (this._walkIsRun > 0 || isShiftDown) && !this._isRunDisabled;
  }

  /**
   * Check if player has enough thew to run
   */
  protected canRunCheck(): boolean {
    if (this._isRunDisabled) return false;
    if (this._isNotUseThewWhenRun) return true;
    return this.thew > 0;
  }

  /**
   * Consume thew when running
   */
  protected consumeRunningThew(): boolean {
    if (!this.canRunCheck()) return false;

    if (!this._isNotUseThewWhenRun) {
      if (this._isInFighting || IS_USE_THEW_WHEN_NORMAL_RUN) {
        this.thew = Math.max(0, this.thew - THEW_USE_AMOUNT_WHEN_RUN);
      }
    }
    return true;
  }

  /**
   * Override to check and consume thew for jumping
   */
  protected override canJump(): boolean {
    if (this.isJumpDisabled) {
      return false;
    }

    if (!this.isStateImageOk(CharacterState.Jump)) {
      return false;
    }

    if (this.thew < THEW_USE_AMOUNT_WHEN_JUMP) {
      this.guiManager.showMessage("体力不足!");
      return false;
    }

    this.thew -= THEW_USE_AMOUNT_WHEN_JUMP;
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
  protected moveInDirection(direction: Direction, isRun: boolean = false): void {
    const primaryDir = direction as number;
    const directionOrder = [primaryDir, (primaryDir + 1) % 8, (primaryDir + 7) % 8];

    const neighbors = this.findAllNeighbors(this.tilePosition);
    const mapService = this.engine.map;

    for (const dirIndex of directionOrder) {
      const targetTile = neighbors[dirIndex];
      const isObstacle = mapService.isObstacleForCharacter(targetTile.x, targetTile.y);
      if (isObstacle) {
        continue;
      }

      this._currentDirection = dirIndex as Direction;

      const success =
        isRun && this.canRunCheck() ? this.runTo(targetTile) : this.walkTo(targetTile);
      if (success) {
        return;
      }
    }

    this._currentDirection = direction;
  }

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
    this.state = this.selectFightOrNormalState(CharacterState.FightStand, CharacterState.Stand);
  }

  /**
   * Start sitting action
   */
  sitdown(): void {
    if (!this.canPerformAction()) {
      return;
    }

    this.path = [];
    this._isMoving = false;
    this._targetPosition = null;
    this.isSitted = false;
    this._sittedMilliseconds = 0;

    this.state = CharacterState.Sit;
    this.playFrames(this._frameEnd - this._frameBegin);

    logger.log(`[Player] Sitdown started`);
  }

  /**
   * Override standingImmediately to reset Player-specific sitting timer
   */
  override standingImmediately(): void {
    this._sittedMilliseconds = 0;
    super.standingImmediately();
  }

  /**
   * Get all 8 neighboring tile positions
   */
  protected findAllNeighbors(tilePos: Vector2): Vector2[] {
    const neighbors: Vector2[] = [];
    const isOddRow = tilePos.y % 2 === 1;

    const offsets = [
      { x: 0, y: 2 },
      { x: isOddRow ? 0 : -1, y: 1 },
      { x: -1, y: 0 },
      { x: isOddRow ? 0 : -1, y: -1 },
      { x: 0, y: -2 },
      { x: isOddRow ? 1 : 0, y: -1 },
      { x: 1, y: 0 },
      { x: isOddRow ? 1 : 0, y: 1 },
    ];

    for (const offset of offsets) {
      neighbors.push({
        x: tilePos.x + offset.x,
        y: tilePos.y + offset.y,
      });
    }

    return neighbors;
  }

  /**
   * Update movement flags based on path state
   */
  protected updateMovementFlags(): void {
    if (this.path.length === 0) {
      this._isMoving = false;
      this._targetPosition = null;
    }
  }

  // =============================================
  // === 武功管理 ===
  // =============================================

  /**
   * 添加武功到玩家武功列表
   * Reference: Player.AddMagic(string magicFileName)
   *
   * @param magicFile 武功文件名（如 "player-magic-漫天花雨.ini"）
   * @param level 武功等级，默认为 1
   * @returns 是否添加成功（已存在也算成功）
   */
  async addMagic(magicFile: string, level: number = 1): Promise<boolean> {
    if (!magicFile) return false;

    const [isNew, index, magic] = await this._magicInventory.addMagic(magicFile, { level });

    if (isNew && index !== -1 && magic) {
      // 新学会武功
      // Reference: GuiManager.ShowMessage("你学会了" + magic.Name);
      this.showMessage(`你学会了${magic.name}`);
      logger.debug(`[Player] Learned new magic: ${magic.name}`);
      return true;
    }

    if (!isNew && index !== -1) {
      // 武功已存在
      // Reference: GuiManager.ShowMessage("你已经学会了" + magic.Name);
      if (magic) {
        this.showMessage(`你已经学会了${magic.name}`);
      }
      logger.debug(`[Player] Magic already exists: ${magicFile}`);
      return true;
    }

    // index === -1，添加失败（武功栏已满或加载失败）
    // Reference: GuiManager.ShowMessage("武功栏已满");
    if (magic === null) {
      logger.warn(`[Player] Failed to load magic: ${magicFile}`);
    } else {
      this.showMessage("武功栏已满");
    }
    return false;
  }

  // =============================================
  // === Properties (getter/setter) ===
  // =============================================

  /**
   * override
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
    this._money = Number.isNaN(value) ? this._money : Math.max(0, value);
  }

  /**
   * Currently controlled character
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
   *
   * 释放当前被控制的角色，清除相关状态
   */
  endControlCharacter(): void {
    if (this._controledCharacter !== null) {
      // NpcManager.CleartFollowTargetIfEqual(ControledCharacter)
      // 清除其他 NPC 对被控制角色的追踪
      this.engine.npcManager.clearFollowTargetIfEqual(this._controledCharacter);

      // ControledCharacter.ControledMagicSprite = null
      this._controledCharacter.statusEffects.controledMagicSprite = null;

      // ControledCharacter = null
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
   */
  protected override showMessage(message: string): void {
    this.guiManager.showMessage(message);
  }

  // Can't use mana
  get manaLimit(): boolean {
    return this._manaLimit;
  }

  set manaLimit(value: boolean) {
    this._manaLimit = value;
  }

  // Current use magic index in magic list
  get currentUseMagicIndex(): number {
    return this._currentUseMagicIndex;
  }

  set currentUseMagicIndex(value: number) {
    this._currentUseMagicIndex = value;
  }

  // =============================================
  // === Equipment Effects Getters/Setters ===
  // =============================================

  getIsNotUseThewWhenRun(): boolean {
    return this._isNotUseThewWhenRun;
  }

  getIsManaRestore(): boolean {
    return this._isManaRestore;
  }

  // Player.AddLifeRestorePercent, AddManaRestorePercent, AddThewRestorePercent
  get addLifeRestorePercent(): number {
    return this._addLifeRestorePercent;
  }

  set addLifeRestorePercent(value: number) {
    this._addLifeRestorePercent = value;
  }

  get addManaRestorePercent(): number {
    return this._addManaRestorePercent;
  }

  set addManaRestorePercent(value: number) {
    this._addManaRestorePercent = value;
  }

  get addThewRestorePercent(): number {
    return this._addThewRestorePercent;
  }

  set addThewRestorePercent(value: number) {
    this._addThewRestorePercent = value;
  }

  getAddMagicEffectPercent(): number {
    return this._addMagicEffectPercent;
  }

  getAddMagicEffectAmount(): number {
    return this._addMagicEffectAmount;
  }

  getPlayerId(): string {
    return "player";
  }

  // =============================================
  // === Abstract Methods (for subclasses) ===
  // =============================================

  /**
   * 处理武功升级时的玩家属性加成
   * 由子类实现
   */
  protected abstract handleMagicLevelUp(oldMagic: MagicData, newMagic: MagicData): void;

  /**
   * Cancel auto attack (abstract, implemented in PlayerCombat)
   */
  abstract cancelAutoAttack(): void;
}
