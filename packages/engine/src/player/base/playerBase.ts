/**
 * PlayerBase - Player 基类 (属性声明层)
 * 包含所有属性声明、getter/setter、以及基本工具方法
 *
 * 继承链: Character → PlayerBase → PlayerInput → PlayerCombat → Player
 */

import { Character } from "../../character";
import type { CharacterBase } from "../../character/base";
import { ResourcePath } from "../../config/resourcePaths";
import { logger } from "../../core/logger";
import { PathType } from "../../core/pathFinder";
import type { Vector2 } from "../../core/types";
import { CharacterKind, CharacterState, DEFAULT_PLAYER_STATS, Direction } from "../../core/types";
import type { GuiManager } from "../../gui/guiManager";
import type { MagicManager } from "../../magic";
import { getCachedMagic, getMagicAtLevel } from "../../magic/magicLoader";
import type { MagicData, MagicItemInfo } from "../../magic/types";
import { MagicAddonEffect } from "../../magic/types";
import type { Npc, NpcManager } from "../../npc";
import { type AsfData, getCachedAsf } from "../../sprite/asf";
import { GoodsListManager } from "../goods/goodsListManager";
import { MagicListManager } from "../magic/magicListManager";

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
   * 决定加载哪个 Player{index}.ini / Magic{index}.ini / Goods{index}.ini
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

  // References - GuiManager, MagicManager, NpcManager 现在通过 IEngineContext 获取
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
  // Player 持有 MagicListManager 和 GoodsListManager
  protected _magicListManager: MagicListManager = new MagicListManager();
  protected _goodsListManager: GoodsListManager = new GoodsListManager();

  // =============================================
  // === Constructor ===
  // =============================================
  constructor() {
    super();

    // Walkability 现在通过 IEngineContext.map 获取

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

    // 设置 MagicListManager 回调
    this._magicListManager.setCallbacks({
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
   */
  setNpcIni(fileName: string): void {
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

    // 通知 MagicListManager 更新 npcIniIndex（用于预加载 SpecialAttackTexture）
    this._magicListManager.setNpcIniIndex(this._npcIniIndex);

    // XiuLianMagic = XiuLianMagic; // Renew xiulian magic
    // 同步获取已预加载的资源
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
   * XiuLianMagic setter - 更新 SpecialAttackTexture
   * 当修炼武功改变时，同步获取预加载的资源
   * 注意：所有资源已在 MagicListManager._setMagicItemAt 中预加载
   */
  protected updateSpecialAttackTexture(xiuLianMagic: MagicItemInfo | null): void {
    // if (_xiuLianMagic != null &&
    //         _xiuLianMagic.TheMagic.AttackFile != null &&
    //         !string.IsNullOrEmpty(_xiuLianMagic.TheMagic.ActionFile))
    //     asf = Utils.GetAsf(@"asf\character\", _xiuLianMagic.TheMagic.ActionFile + NpcIniIndex + ".asf");
    if (xiuLianMagic?.magic?.attackFile && xiuLianMagic.magic.actionFile) {
      // {ActionFile}{NpcIniIndex}.asf
      const asfFileName = `${xiuLianMagic.magic.actionFile}${this._npcIniIndex}.asf`;

      // 同步从缓存获取 SpecialAttackTexture（已在 MagicListManager 中预加载）
      const paths = [
        ResourcePath.asfCharacter(asfFileName),
        ResourcePath.asfInterlude(asfFileName),
      ];
      for (const path of paths) {
        const asf = getCachedAsf(path);
        if (asf) {
          this._specialAttackTexture = asf;
          logger.debug(`[Player] Got cached SpecialAttackTexture: ${path}`);
          break;
        }
      }

      // 同步从缓存获取修炼武功的 AttackFile（已在 MagicListManager 中预加载）
      // AttackFile = new Magic(path, noLevel=true, noAttackFile=true)
      const baseMagic = getCachedMagic(xiuLianMagic.magic.attackFile);
      if (baseMagic) {
        this._xiuLianAttackMagic = baseMagic;
        logger.debug(`[Player] Got cached XiuLianAttackMagic: ${baseMagic.name}`);
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
  // === Manager 访问（通过 IEngineContext）===
  // =============================================

  /**
   * 获取 MagicManager（通过 IEngineContext）
   */
  protected get magicManager(): MagicManager {
    return this.engine.getManager("magic") as MagicManager;
  }

  /**
   * 获取 NpcManager（通过 IEngineContext）
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
    // Check NPC obstacle
    if (this.npcManager.isObstacle(tilePosition.x, tilePosition.y)) {
      return true;
    }

    // Check ObjManager obstacle
    const objManager = this.engine.getManager("obj");
    if (objManager.isObstacle(tilePosition.x, tilePosition.y)) {
      return true;
    }

    // Check MagicManager obstacle
    if (this.magicManager.isObstacle(tilePosition)) {
      return true;
    }

    return false;
  }

  /**
   * 获取 GuiManager（通过 IEngineContext）
   */
  protected get guiManager(): GuiManager {
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
   * Reference: Player.LoadMagicEffect(MagicItemInfo[] infos)
   */
  loadMagicEffect(): void {
    const allMagicInfos = this._magicListManager.getAllMagicInfos();

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
  // === 武功管理 ===
  // =============================================

  /**
   * 添加武功到玩家武功列表
   * @param magicFile 武功文件名（如 "剑系-无相心法.ini"）
   * @param level 武功等级，默认为 1
   * @returns 是否添加成功
   */
  async addMagic(magicFile: string, level: number = 1): Promise<boolean> {
    const [success] = await this._magicListManager.addMagic(magicFile, { level });
    if (!success) {
      logger.warn(`[Player] Failed to add magic: ${magicFile}`);
    }
    return success;
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
    this._money = Math.max(0, value);
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
      this.engine.npcManager.cleartFollowTargetIfEqual(this._controledCharacter);

      // ControledCharacter.ControledMagicSprite = null
      this._controledCharacter.controledMagicSprite = null;

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
}
