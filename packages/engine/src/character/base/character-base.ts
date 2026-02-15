/**
 * CharacterBase - Character 基类 (属性声明层)
 * 包含所有属性声明、getter/setter、以及基本工具方法
 *
 * 继承链: Sprite → CharacterBase → CharacterMovement → CharacterCombat → Character
 */

import type { AudioManager } from "../../audio";
import { logger } from "../../core/logger";
import type { CharacterConfig, CharacterStats, Vector2 } from "../../core/types";
import { CharacterKind, CharacterState, type Direction, RelationType } from "../../core/types";
import type { MagicSprite } from "../../magic/magic-sprite";
import type { MagicData } from "../../magic/types";
import type { Npc } from "../../npc";
import type { Obj } from "../../obj/obj";
import { getAsfForState, Sprite } from "../../sprite/sprite";
import { pixelToTile } from "../../utils";
import {
  type CharacterInstance,
  extractConfigFromCharacter,
  extractStatsFromCharacter,
} from "../character-config";
import { LevelManager } from "../level/level-manager";
import { BezierMover, FlyIniManager, StatusEffectsManager } from "../modules";

/** 加载中状态标记（-1），确保后续 state 变更时触发纹理更新 */
export const LOADING_STATE = -1 as CharacterState;

/**
 * 被攻击时使用的武功信息项
 */
export interface MagicToUseInfoItem {
  /** 来源标识（装备或武功文件名） */
  from: string;
  /** 武功数据 */
  magic: MagicData;
  /** 武功释放方向：0=攻击者方向, 1=武功精灵反方向, 2=NPC当前朝向 */
  dir: number;
}

/** 战斗状态超时时间（秒） */
export const MAX_NON_FIGHT_SECONDS = 7;

/** 角色更新结果 */
export interface CharacterUpdateResult {
  moved: boolean;
  reachedDestination: boolean;
  triggeredScript?: string;
}

/**
 * CharacterBase - 属性声明层
 * 包含所有属性声明和基本工具方法，不包含复杂业务逻辑
 */
export abstract class CharacterBase extends Sprite implements CharacterInstance {
  // =============================================
  // === Identity (公共属性) ===
  // =============================================
  name: string = "";
  kind: CharacterKind = 0;
  relation: RelationType = 0;
  group: number = 0;

  // =============================================
  // === Stats (属性值) ===
  // =============================================
  life: number = 100;
  lifeMax: number = 100;
  mana: number = 100;
  manaMax: number = 100;
  thew: number = 100;
  thewMax: number = 100;
  protected _attack: number = 10;
  attack2: number = 0;
  attack3: number = 0;
  attackLevel: number = 0;
  protected _defend: number = 10;
  defend2: number = 0;
  defend3: number = 0;
  evade: number = 0;
  exp: number = 0;
  levelUpExp: number = 100;
  level: number = 1;
  canLevelUp: number = 1;

  // =============================================
  // === Movement ===
  // =============================================
  walkSpeed: number = 1;
  addMoveSpeedPercent: number = 0;
  visionRadius: number = 0;
  attackRadius: number = 0;
  dialogRadius: number = 0;
  protected _destinationMoveTilePosition: Vector2 = { x: 0, y: 0 };

  // =============================================
  // === State ===
  // =============================================
  protected _state: CharacterState = CharacterState.Stand;
  path: Vector2[] = [];
  /** bool IsHide { get; set; } - Script controlled hide */
  protected _isHide: boolean = false;
  isDeath: boolean = false;
  isDeathInvoked: boolean = false;
  isSitted: boolean = false;
  protected _isInFighting: boolean = false;
  protected _totalNonFightingSeconds: number = 0;
  isFightDisabled: boolean = false;
  isJumpDisabled: boolean = false;

  // =============================================
  // === AI ===
  // =============================================
  idle: number = 0;
  aiType: number = 0;
  stopFindingTarget: number = 0;
  keepRadiusWhenLifeLow: number = 0;
  lifeLowPercent: number = 20;
  keepRadiusWhenFriendDeath: number = 0;

  // =============================================
  // === Combat ===
  // =============================================
  protected _lastAttacker: CharacterBase | null = null;

  /** 最后攻击此角色的角色（用于 AI 仇恨追踪） */
  get lastAttacker(): CharacterBase | null {
    return this._lastAttacker;
  }

  // =============================================
  // === Configuration Files ===
  // =============================================
  npcIni: string = "";

  // === FlyIni 配置 (使用 FlyIniManager 模块) ===
  protected _flyIniManager = new FlyIniManager();

  // 委托属性
  get flyIni(): string {
    return this._flyIniManager.flyIni;
  }
  set flyIni(v: string) {
    this._flyIniManager.flyIni = v;
  }
  get flyIni2(): string {
    return this._flyIniManager.flyIni2;
  }
  set flyIni2(v: string) {
    this._flyIniManager.flyIni2 = v;
  }
  get flyInis(): string {
    return this._flyIniManager.flyInis;
  }
  set flyInis(v: string) {
    this._flyIniManager.flyInis = v;
  }
  protected get _flyIniInfos(): Array<{ useDistance: number; magicIni: string }> {
    return this._flyIniManager.flyIniInfos as Array<{ useDistance: number; magicIni: string }>;
  }
  protected get _flyIniReplace(): string[] {
    return [];
  }
  protected get _flyIni2Replace(): string[] {
    return [];
  }

  bodyIni: string = "";
  bodyIniObj: Obj | null = null;
  isBodyIniAdded: number = 0;
  notAddBody: boolean = false;
  scriptFile: string = "";
  scriptFileRight: string = "";
  deathScript: string = "";
  timerScriptFile: string = "";
  timerScriptInterval: number = 0;
  pathFinder: number = 0;
  noAutoAttackPlayer: number = 0;
  canInteractDirectly: number = 0;
  dropIni: string = "";
  expBonus: number = 0;
  buyIniFile: string = "";
  invincible: number = 0;
  reviveMilliseconds: number = 0;
  leftMillisecondsToRevive: number = 0;

  // === Hurt Player (接触伤害) ===
  hurtPlayerInterval: number = 0;
  hurtPlayerLife: number = 0;
  hurtPlayerRadius: number = 0;

  // === Magic Direction ===
  magicDirectionWhenBeAttacked: number = 0;
  magicDirectionWhenDeath: number = 0;

  // === Visibility Control ===
  fixedPos: string = "";
  visibleVariableName: string = "";
  visibleVariableValue: number = 0;

  // === Auto Magic ===
  magicToUseWhenLifeLow: string = "";
  magicToUseWhenBeAttacked: string = "";
  magicToUseWhenDeath: string = "";

  // === Drop Control ===
  noDropWhenDie: number = 0;

  // === Equipment ===
  canEquip: number = 0;
  headEquip: string = "";
  neckEquip: string = "";
  bodyEquip: string = "";
  backEquip: string = "";
  handEquip: string = "";
  wristEquip: string = "";
  footEquip: string = "";
  backgroundTextureEquip: string = "";

  // === Level Config ===
  readonly levelManager: LevelManager = new LevelManager();

  get levelIniFile(): string {
    return this.levelManager.getLevelFile();
  }
  set levelIniFile(value: string) {
    this.levelManager.setLevelFile(value).catch((err) => {
      logger.error(`[CharacterBase] Failed to set levelIniFile: ${err}`);
    });
  }

  buyIniString: string = "";

  // === Status Effects (使用 StatusEffectsManager 模块) ===
  readonly statusEffects = new StatusEffectsManager();

  get poisonByCharacterName(): string {
    return this.statusEffects.poisonByCharacterName;
  }
  set poisonByCharacterName(v: string) {
    this.statusEffects.poisonByCharacterName = v;
  }
  get poisonSeconds(): number {
    return this.statusEffects.poisonSeconds;
  }
  set poisonSeconds(v: number) {
    this.statusEffects.poisonSeconds = v;
  }
  get petrifiedSeconds(): number {
    return this.statusEffects.petrifiedSeconds;
  }
  set petrifiedSeconds(v: number) {
    this.statusEffects.petrifiedSeconds = v;
  }
  get frozenSeconds(): number {
    return this.statusEffects.frozenSeconds;
  }
  set frozenSeconds(v: number) {
    this.statusEffects.frozenSeconds = v;
  }
  get isPoisonVisualEffect(): boolean {
    return this.statusEffects.isPoisonVisualEffect;
  }
  set isPoisonVisualEffect(v: boolean) {
    this.statusEffects.isPoisonVisualEffect = v;
  }
  get isPetrifiedVisualEffect(): boolean {
    return this.statusEffects.isPetrifiedVisualEffect;
  }
  set isPetrifiedVisualEffect(v: boolean) {
    this.statusEffects.isPetrifiedVisualEffect = v;
  }
  get isFrozenVisualEffect(): boolean {
    return this.statusEffects.isFrozenVisualEffect;
  }
  set isFrozenVisualEffect(v: boolean) {
    this.statusEffects.isFrozenVisualEffect = v;
  }

  // === LifeMilliseconds ===
  protected _lifeMilliseconds: number = 0;

  // === MovedByMagicSprite ===
  protected _movedByMagicSprite: MagicSprite | null = null;
  movedByMagicSpriteOffset: Vector2 = { x: 0, y: 0 };

  // === IsInTransport ===
  protected _isInTransport: boolean = false;

  // === SummonedByMagicSprite ===
  summonedByMagicSprite: MagicSprite | null = null;

  // === SummonedNpcs ===
  protected _summonedNpcs: Map<string, Npc[]> = new Map();

  // === MagicToUseWhenAttackedList ===
  magicToUseWhenAttackedList: MagicToUseInfoItem[] = [];

  // === MagicSpritesInEffect ===
  protected _magicSpritesInEffect: MagicSprite[] = [];

  // === Direction Counts ===
  protected _canAttackDirCount: number = -1;

  // === Keep Attack Position ===
  keepAttackX: number = 0;
  keepAttackY: number = 0;

  // === Other ===
  lum: number = 0;
  action: number = 0;
  dir: number = 0;

  // === Targeting ===
  protected _destinationAttackTilePosition: Vector2 | null = null;
  protected _attackDestination: Vector2 | null = null;
  protected _magicToUseWhenAttack: string | null = null;
  followTarget: CharacterBase | null = null;
  isFollowTargetFound: boolean = false;
  protected _interactiveTarget: CharacterBase | null = null;
  protected _isInteractiveRightScript: boolean = false;

  // === Special Action ===
  isInSpecialAction: boolean = false;
  specialActionLastDirection: number = 4;
  specialActionFrame: number = 0;
  specialActionAsf: string | undefined = undefined;

  // === Pending Death (deferred during special action) ===
  /** 特殊动作播放中被击杀时，延迟到动作结束再处理死亡 */
  protected _pendingDeath: boolean = false;
  protected _pendingDeathKiller: CharacterBase | null = null;

  // === BezierMove ===
  protected _bezierMover = new BezierMover<CharacterBase>();

  // === Audio ===
  protected _stateSounds: Map<number, string> = new Map();

  // === Loop Walk ===
  protected _isInLoopWalk: boolean = false;
  protected _currentLoopWalkIndex: number = 0;

  // === Run To Target ===
  protected _isRunToTarget: boolean = false;

  // === Step Move ===
  protected _isInStepMove: boolean = false;

  // =============================================
  // === Getters/Setters ===
  // =============================================

  protected get audioManager(): AudioManager {
    return this.engine.audio as AudioManager;
  }

  // === Relation Properties ===
  get isEnemy(): boolean {
    return this.relation === RelationType.Enemy;
  }

  get isPlayer(): boolean {
    return this.kind === CharacterKind.Player;
  }

  get isNormal(): boolean {
    return this.kind === CharacterKind.Normal;
  }

  get isFriend(): boolean {
    return this.relation === RelationType.Friend;
  }

  get isRelationNeutral(): boolean {
    return this.relation === RelationType.None;
  }

  get isNoneFighter(): boolean {
    return this.relation === RelationType.None && this.kind === CharacterKind.Fighter;
  }

  get isFighterFriend(): boolean {
    return (
      (this.kind === CharacterKind.Fighter || this.kind === CharacterKind.Follower) &&
      this.relation === RelationType.Friend
    );
  }

  get isFighterKind(): boolean {
    return this.kind === CharacterKind.Fighter;
  }

  get isFighter(): boolean {
    return this.isFighterKind || this.isPartner;
  }

  get isPartner(): boolean {
    return this.kind === CharacterKind.Follower;
  }

  get isEventer(): boolean {
    return this.kind === CharacterKind.Eventer;
  }

  get hasInteractScript(): boolean {
    return this.scriptFile !== "";
  }

  get hasInteractScriptRight(): boolean {
    return this.scriptFileRight !== "";
  }

  get isInteractive(): boolean {
    if (this.isDeathInvoked || this.isDeath) {
      return false;
    }
    return (
      this.hasInteractScript ||
      this.hasInteractScriptRight ||
      this.isEnemy ||
      this.isFighterFriend ||
      this.isNoneFighter
    );
  }

  // === Stats Properties ===
  get attack(): number {
    if (this.statusEffects.weakByMagicSprite !== null) {
      const weakPercent = this.statusEffects.weakByMagicSprite.magic.weakAttackPercent || 0;
      return Math.floor((this._attack * (100 - weakPercent)) / 100);
    }
    return this._attack;
  }

  set attack(value: number) {
    this._attack = value;
  }

  get defend(): number {
    if (this.statusEffects.weakByMagicSprite !== null) {
      const weakPercent = this.statusEffects.weakByMagicSprite.magic.weakDefendPercent || 0;
      return Math.floor((this._defend * (100 - weakPercent)) / 100);
    }
    return this._defend;
  }

  set defend(value: number) {
    this._defend = value;
  }

  get realAttack(): number {
    let percent = 100;
    if (this.statusEffects.changeCharacterByMagicSprite !== null) {
      percent += this.statusEffects.changeCharacterByMagicSprite.magic.attackAddPercent || 0;
    }
    if (this.statusEffects.changeFlyIniByMagicSprite !== null) {
      percent += this.statusEffects.changeFlyIniByMagicSprite.magic.attackAddPercent || 0;
    }
    return Math.floor((this.attack * percent) / 100);
  }

  get realDefend(): number {
    let percent = 100;
    if (this.statusEffects.changeCharacterByMagicSprite !== null) {
      percent += this.statusEffects.changeCharacterByMagicSprite.magic.defendAddPercent || 0;
    }
    return Math.floor((this.defend * percent) / 100);
  }

  get realEvade(): number {
    let percent = 100;
    if (this.statusEffects.changeCharacterByMagicSprite !== null) {
      percent += this.statusEffects.changeCharacterByMagicSprite.magic.evadeAddPercent || 0;
    }
    return Math.floor((this.evade * percent) / 100);
  }

  get lifeMilliseconds(): number {
    return this._lifeMilliseconds;
  }

  set lifeMilliseconds(value: number) {
    this._lifeMilliseconds = value;
  }

  get isFullLife(): boolean {
    return this.life === this.lifeMax;
  }

  get movedByMagicSprite(): MagicSprite | null {
    return this._movedByMagicSprite;
  }

  set movedByMagicSprite(value: MagicSprite | null) {
    this._movedByMagicSprite = value;
    this.standingImmediately();
  }

  get isInTransport(): boolean {
    return this._isInTransport;
  }

  set isInTransport(value: boolean) {
    this._isInTransport = value;
  }

  get canAttackDirCount(): number {
    if (this._canAttackDirCount === -1) {
      this._canAttackDirCount = this.getMinDirCount([
        CharacterState.Attack,
        CharacterState.Attack1,
        CharacterState.Attack2,
      ]);
      if (this._canAttackDirCount === -1) {
        this._canAttackDirCount = 0;
      }
    }
    return this._canAttackDirCount;
  }

  // === Movement Properties ===
  get destinationMoveTilePosition(): Vector2 {
    return this._destinationMoveTilePosition;
  }

  /** C# DestinationMapPosX - proxy for save/load */
  get destinationMapPosX(): number {
    return this._destinationMoveTilePosition.x;
  }
  set destinationMapPosX(value: number) {
    this._destinationMoveTilePosition.x = value;
  }

  /** C# DestinationMapPosY - proxy for save/load */
  get destinationMapPosY(): number {
    return this._destinationMoveTilePosition.y;
  }
  set destinationMapPosY(value: number) {
    this._destinationMoveTilePosition.y = value;
  }

  get currentFixedPosIndex(): number {
    return this._currentLoopWalkIndex;
  }
  set currentFixedPosIndex(value: number) {
    this._currentLoopWalkIndex = value;
  }

  // === State Properties ===
  get state(): CharacterState {
    return this._state;
  }

  set state(value: CharacterState) {
    if (this._state !== value) {
      this._state = value;
      this._currentFrameIndex = 0;
      this._elapsedMilliSecond = 0;
      this._updateTextureForState(value);
      this._playStateSoundOnStateChange(value);
    }
  }

  // === Interface Properties ===
  get tilePosition(): Vector2 {
    return { x: this._mapX, y: this._mapY };
  }

  get pixelPosition(): Vector2 {
    return { ...this._positionInWorld };
  }

  get direction(): Direction {
    return this._currentDirection as Direction;
  }

  set direction(value: Direction) {
    this._currentDirection = value;
  }

  get currentFrame(): number {
    return this._currentFrameIndex;
  }

  get config(): CharacterConfig {
    return this.getConfig();
  }

  /**
   * 魔法隐身状态
   * bool IsVisible { get { return InvisibleByMagicTime <= 0; } }
   * 注意：这只检查魔法隐身，不包括脚本控制的 IsHide
   */
  get isVisible(): boolean {
    // return InvisibleByMagicTime <= 0;
    return this.statusEffects.invisibleByMagicTime <= 0;
  }

  /**
   * 脚本控制的隐藏状态
   * bool IsHide { get; set; }
   */
  get isHide(): boolean {
    return this._isHide;
  }

  set isHide(value: boolean) {
    this._isHide = value;
  }

  /**
   * 是否应该绘制
   * bool IsDraw { get { return !(IsDeath || IsHide || IsInTransport || !IsVisible || !IsVisibleByVariable || ...); } }
   */
  get isDraw(): boolean {
    return !(this.isDeath || this._isHide || !this.isVisible || !this.isVisibleByVariable);
  }

  /**
   * 根据脚本变量判断是否可见
   * bool IsVisibleByVariable = true;
   * Update: IsVisibleByVariable = ScriptExecuter.GetVariablesValue("$" + VisibleVariableName) >= VisibleVariableValue;
   */
  get isVisibleByVariable(): boolean {
    if (!this.visibleVariableName) {
      return true;
    }
    // IsVisibleByVariable = ScriptExecuter.GetVariablesValue("$" + VisibleVariableName) >= VisibleVariableValue;
    const value = this.engine.getScriptVariable(this.visibleVariableName);
    return value >= this.visibleVariableValue;
  }

  get isInFighting(): boolean {
    return this._isInFighting;
  }

  get isBodyIniOk(): boolean {
    return (
      this.bodyIniObj !== null &&
      this.bodyIniObj.objFile !== null &&
      this.bodyIniObj.objFile.size > 0
    );
  }

  get isInDeathing(): boolean {
    return this._state === CharacterState.Death;
  }

  // === Status Effects Getters ===
  get isFrozen(): boolean {
    return this.frozenSeconds > 0;
  }

  get isPoisoned(): boolean {
    return this.poisonSeconds > 0;
  }

  get isPetrified(): boolean {
    return this.petrifiedSeconds > 0;
  }

  get bodyFunctionWell(): boolean {
    return this.frozenSeconds <= 0 && this.poisonSeconds <= 0 && this.petrifiedSeconds <= 0;
  }

  get isNotFightBackWhenBeHit(): boolean {
    return this.aiType === 2;
  }

  get isRandMoveRandAttack(): boolean {
    return this.aiType === 1 || this.aiType === 2;
  }

  get inBezierMove(): boolean {
    return this._bezierMover.isMoving;
  }

  // =============================================
  // === Basic Methods ===
  // =============================================

  /** 设置加载中状态 */
  setLoadingState(): void {
    this._state = LOADING_STATE;
  }

  /** 设置方向 */
  setDirection(dir: number): void {
    this._currentDirection = dir;
  }

  /** 获取有效关系（考虑状态效果） */
  getEffectiveRelation(): RelationType {
    if (this.statusEffects.changeToOppositeMilliseconds > 0) {
      if (this.relation === RelationType.Enemy) {
        return RelationType.Friend;
      } else if (this.relation === RelationType.Friend) {
        return RelationType.Enemy;
      }
    }
    return this.relation;
  }

  /** 改变关系时清除跟随目标 */
  setRelation(relation: number): void {
    const oldRelation = this.relation;
    const newRelation = relation as RelationType;

    if (
      (oldRelation === RelationType.Friend && newRelation === RelationType.Enemy) ||
      (oldRelation === RelationType.Enemy && newRelation !== RelationType.Enemy)
    ) {
      this.clearFollowTarget();
    }

    this.relation = newRelation;
  }

  /** 清除跟随目标 */
  clearFollowTarget(): void {
    this.followTarget = null;
    this.isFollowTargetFound = false;
  }

  /** 设置跟随目标 */
  follow(target: CharacterBase): void {
    this.followTarget = target;
    this.isFollowTargetFound = true;
  }

  /** 判断是否是对立关系 */
  isOpposite(target: CharacterBase): boolean {
    if (target.isEnemy) {
      return this.isPlayer || this.isFighterFriend || this.isNoneFighter;
    } else if (target.isPlayer || target.isFighterFriend) {
      return this.isEnemy || this.isNoneFighter;
    } else if (target.isNoneFighter) {
      return this.isPlayer || this.isFighterFriend || this.isEnemy;
    }
    return false;
  }

  /** 是否应该在小地图上显示 */
  shouldShowOnMinimap(): boolean {
    if (this.isEnemy) return true;
    return this.isPlayer || this.isPartner || this.isNormal || this.isFighterKind || this.isEventer;
  }

  /** 状态检查方法 */
  isStanding(): boolean {
    return (
      this._state === CharacterState.Stand ||
      this._state === CharacterState.Stand1 ||
      this._state === CharacterState.FightStand
    );
  }

  isSitting(): boolean {
    return this._state === CharacterState.Sit;
  }

  isWalking(): boolean {
    return this._state === CharacterState.Walk || this._state === CharacterState.FightWalk;
  }

  isRunning(): boolean {
    return this._state === CharacterState.Run || this._state === CharacterState.FightRun;
  }

  // =============================================
  // === Stats Setters ===
  // =============================================

  setLife(value: number): void {
    this.life = Math.max(0, Math.min(value, this.lifeMax));
  }

  setLifeMax(value: number): void {
    this.lifeMax = Math.max(1, value);
    if (this.life > this.lifeMax) this.life = this.lifeMax;
  }

  setMana(value: number): void {
    this.mana = Math.max(0, Math.min(value, this.manaMax));
  }

  setManaMax(value: number): void {
    this.manaMax = Math.max(1, value);
    if (this.mana > this.manaMax) this.mana = this.manaMax;
  }

  setThew(value: number): void {
    this.thew = Math.max(0, Math.min(value, this.thewMax));
  }

  setThewMax(value: number): void {
    this.thewMax = Math.max(1, value);
    if (this.thew > this.thewMax) this.thew = this.thewMax;
  }

  setWalkSpeed(value: number): void {
    this.walkSpeed = value < 1 ? 1 : value;
  }

  getVisionRadius(): number {
    return this.visionRadius === 0 ? 9 : this.visionRadius;
  }

  getAttackRadius(): number {
    return this.attackRadius === 0 ? 1 : this.attackRadius;
  }

  getDialogRadius(): number {
    return this.dialogRadius === 0 ? 1 : this.dialogRadius;
  }

  // =============================================
  // === Walkability Methods ===
  // =============================================

  protected checkWalkable(tile: Vector2): boolean {
    return this.engine.map.isTileWalkable(tile);
  }

  protected checkMapObstacleForCharacter(tile: Vector2): boolean {
    return this.engine.map.isObstacleForCharacter(tile.x, tile.y);
  }

  protected checkHardObstacle(tile: Vector2): boolean {
    return this.engine.map.isObstacle(tile.x, tile.y);
  }

  // =============================================
  // === Protected Utility Methods ===
  // =============================================

  protected getMinDirCount(states: CharacterState[]): number {
    let minDir = -1;
    for (const state of states) {
      const asf = this._spriteSet ? getAsfForState(this._spriteSet, state) : null;
      if (asf && asf.directions > 0) {
        if (minDir === -1 || asf.directions < minDir) {
          minDir = asf.directions;
        }
      }
    }
    return minDir;
  }

  protected _playStateSoundOnStateChange(state: CharacterState): void {
    this.audioManager.stopLoopingSound();

    const soundPath = this._stateSounds.get(state);
    if (!soundPath) return;

    switch (state) {
      case CharacterState.Walk:
      case CharacterState.FightWalk:
      case CharacterState.Run:
      case CharacterState.FightRun:
        this.audioManager.playLoopingSound(soundPath);
        break;

      case CharacterState.Magic:
      case CharacterState.Attack:
      case CharacterState.Attack1:
      case CharacterState.Attack2:
        break;

      default:
        this.audioManager.playSound(soundPath);
        break;
    }
  }

  /**
   * 更新当前状态的贴图
   * C# 参考: SetState() 直接从 NpcIni[state].Image 读取
   * 我们直接从 _spriteSet 读取，因为 setNpcActionFile 已经直接修改了 _spriteSet
   */
  protected _updateTextureForState(state: CharacterState): void {
    // 直接从 _spriteSet 读取（包含通过 setNpcActionFile 设置的自定义动作）
    this._texture = getAsfForState(this._spriteSet, state);
    if (this._texture) {
      // 通过 setter 重新设置方向，自动处理取模和帧范围计算
      this.currentDirection = this._currentDirection;
      this._currentFrameIndex = this._frameBegin;
    }
  }

  // =============================================
  // === Config/Stats Methods ===
  // =============================================

  getConfig(): CharacterConfig {
    return extractConfigFromCharacter(this);
  }

  getStats(): CharacterStats {
    return extractStatsFromCharacter(this);
  }

  getPixelPosition(): Vector2 {
    return this.pixelPosition;
  }

  setPixelPosition(x: number, y: number): void {
    this._positionInWorld = { x, y };
    const tile = pixelToTile(x, y);
    this._mapX = tile.x;
    this._mapY = tile.y;
  }

  // =============================================
  // === Abstract Methods (由子类实现) ===
  // =============================================

  /**
   * 检查 NPC + Obj + Magic 三重动态障碍物（共享逻辑）
   * Player 和 Npc 子类的 hasObstacle 都包含这三项检查
   */
  protected hasEntityObstacle(tilePosition: Vector2): boolean {
    if (this.engine.npcManager.isObstacle(tilePosition.x, tilePosition.y)) return true;
    if (this.engine.objManager.isObstacle(tilePosition.x, tilePosition.y)) return true;
    if (this.engine.magicSpriteManager.isObstacle(tilePosition)) return true;
    return false;
  }

  /** 检查是否有动态障碍物 */
  hasObstacle(_tilePosition: Vector2): boolean {
    return false;
  }

  /** 获取寻路类型 */
  abstract getPathType(): number;

  /** 立即站立 */
  abstract standingImmediately(): void;

  /** 非战斗状态 */
  abstract toNonFightingState(): void;

  /** 结束特殊动作 */
  abstract endSpecialAction(): void;

  /** 变身效果恢复 */
  protected abstract onRecoverFromReplaceMagicList(magic: MagicData): void;

  /** 增加生命值 */
  abstract addLife(amount: number): void;

  /** 死亡 */
  abstract death(): void;

  /** 受到伤害 */
  abstract takeDamage(damage: number, attacker: CharacterBase | null): void;
}
