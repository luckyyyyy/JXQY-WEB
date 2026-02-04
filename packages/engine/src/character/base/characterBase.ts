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
import type { MagicSprite } from "../../magic/magicSprite";
import type { MagicData } from "../../magic/types";
import type { Npc } from "../../npc";
import type { Obj } from "../../obj/obj";
import { getAsfForState, Sprite } from "../../sprite/sprite";
import { pixelToTile } from "../../utils";
import {
  type CharacterInstance,
  extractConfigFromCharacter,
  extractStatsFromCharacter,
} from "../iniParser";
import { LevelManager } from "../level/levelManager";
import { BezierMover, FlyIniManager, StatusEffectsManager } from "../modules";
import { loadCharacterAsf } from "../resFile";

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
  protected _lastAttacker: Character | null = null;

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
  timerScript: string = "";
  timerInterval: number = 0;
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
  protected _statusEffects = new StatusEffectsManager();

  // 委托属性 - 公开
  get poisonByCharacterName(): string {
    return this._statusEffects.poisonByCharacterName;
  }
  set poisonByCharacterName(v: string) {
    this._statusEffects.poisonByCharacterName = v;
  }
  get poisonSeconds(): number {
    return this._statusEffects.poisonSeconds;
  }
  set poisonSeconds(v: number) {
    this._statusEffects.poisonSeconds = v;
  }
  get petrifiedSeconds(): number {
    return this._statusEffects.petrifiedSeconds;
  }
  set petrifiedSeconds(v: number) {
    this._statusEffects.petrifiedSeconds = v;
  }
  get frozenSeconds(): number {
    return this._statusEffects.frozenSeconds;
  }
  set frozenSeconds(v: number) {
    this._statusEffects.frozenSeconds = v;
  }
  get isPoisonVisualEffect(): boolean {
    return this._statusEffects.isPoisonVisualEffect;
  }
  set isPoisonVisualEffect(v: boolean) {
    this._statusEffects.isPoisonVisualEffect = v;
  }
  get isPetrifiedVisualEffect(): boolean {
    return this._statusEffects.isPetrifiedVisualEffect;
  }
  set isPetrifiedVisualEffect(v: boolean) {
    this._statusEffects.isPetrifiedVisualEffect = v;
  }
  get isFrozenVisualEffect(): boolean {
    return this._statusEffects.isFrozenVisualEffect;
  }
  set isFrozenVisualEffect(v: boolean) {
    this._statusEffects.isFrozenVisualEffect = v;
  }
  get invisibleByMagicTime(): number {
    return this._statusEffects.invisibleByMagicTime;
  }
  set invisibleByMagicTime(v: number) {
    this._statusEffects.invisibleByMagicTime = v;
  }
  get isVisibleWhenAttack(): boolean {
    return this._statusEffects.isVisibleWhenAttack;
  }
  set isVisibleWhenAttack(v: boolean) {
    this._statusEffects.isVisibleWhenAttack = v;
  }
  get disableMoveMilliseconds(): number {
    return this._statusEffects.disableMoveMilliseconds;
  }
  set disableMoveMilliseconds(v: number) {
    this._statusEffects.disableMoveMilliseconds = v;
  }
  get disableSkillMilliseconds(): number {
    return this._statusEffects.disableSkillMilliseconds;
  }
  set disableSkillMilliseconds(v: number) {
    this._statusEffects.disableSkillMilliseconds = v;
  }
  get speedUpByMagicSprite(): MagicSprite | null {
    return this._statusEffects.speedUpByMagicSprite;
  }
  set speedUpByMagicSprite(v: MagicSprite | null) {
    this._statusEffects.speedUpByMagicSprite = v;
  }

  // 委托属性 - protected
  protected get _changeCharacterByMagicSprite(): MagicSprite | null {
    return this._statusEffects.changeCharacterByMagicSprite;
  }
  protected set _changeCharacterByMagicSprite(v: MagicSprite | null) {
    this._statusEffects.changeCharacterByMagicSprite = v;
  }
  protected get _changeCharacterByMagicSpriteTime(): number {
    return this._statusEffects.changeCharacterByMagicSpriteTime;
  }
  protected set _changeCharacterByMagicSpriteTime(v: number) {
    this._statusEffects.changeCharacterByMagicSpriteTime = v;
  }
  protected get _weakByMagicSprite(): MagicSprite | null {
    return this._statusEffects.weakByMagicSprite;
  }
  protected set _weakByMagicSprite(v: MagicSprite | null) {
    this._statusEffects.weakByMagicSprite = v;
  }
  protected get _weakByMagicSpriteTime(): number {
    return this._statusEffects.weakByMagicSpriteTime;
  }
  protected set _weakByMagicSpriteTime(v: number) {
    this._statusEffects.weakByMagicSpriteTime = v;
  }
  protected get _changeToOppositeMilliseconds(): number {
    return this._statusEffects.changeToOppositeMilliseconds;
  }
  protected set _changeToOppositeMilliseconds(v: number) {
    this._statusEffects.changeToOppositeMilliseconds = v;
  }
  protected get _changeFlyIniByMagicSprite(): MagicSprite | null {
    return this._statusEffects.changeFlyIniByMagicSprite;
  }
  protected set _changeFlyIniByMagicSprite(v: MagicSprite | null) {
    this._statusEffects.changeFlyIniByMagicSprite = v;
  }
  protected get _controledMagicSprite(): MagicSprite | null {
    return this._statusEffects.controledMagicSprite;
  }
  protected set _controledMagicSprite(v: MagicSprite | null) {
    this._statusEffects.controledMagicSprite = v;
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
  followTarget: Character | null = null;
  isFollowTargetFound: boolean = false;
  protected _interactiveTarget: Character | null = null;
  protected _isInteractiveRightScript: boolean = false;

  // === Special Action ===
  isInSpecialAction: boolean = false;
  specialActionLastDirection: number = 4;
  specialActionFrame: number = 0;
  specialActionAsf: string | undefined = undefined;
  customActionFiles: Map<number, string> = new Map();

  // === BezierMove ===
  protected _bezierMover = new BezierMover<Character>();

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

  get isEventCharacter(): boolean {
    return this.kind === CharacterKind.Eventer;
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
    if (this._weakByMagicSprite !== null) {
      const weakPercent = this._weakByMagicSprite.magic.weakAttackPercent || 0;
      return Math.floor((this._attack * (100 - weakPercent)) / 100);
    }
    return this._attack;
  }

  set attack(value: number) {
    this._attack = value;
  }

  get defend(): number {
    if (this._weakByMagicSprite !== null) {
      const weakPercent = this._weakByMagicSprite.magic.weakDefendPercent || 0;
      return Math.floor((this._defend * (100 - weakPercent)) / 100);
    }
    return this._defend;
  }

  set defend(value: number) {
    this._defend = value;
  }

  get realAttack(): number {
    let percent = 100;
    if (this._changeCharacterByMagicSprite !== null) {
      percent += this._changeCharacterByMagicSprite.magic.attackAddPercent || 0;
    }
    if (this._changeFlyIniByMagicSprite !== null) {
      percent += this._changeFlyIniByMagicSprite.magic.attackAddPercent || 0;
    }
    return Math.floor((this.attack * percent) / 100);
  }

  get realDefend(): number {
    let percent = 100;
    if (this._changeCharacterByMagicSprite !== null) {
      percent += this._changeCharacterByMagicSprite.magic.defendAddPercent || 0;
    }
    return Math.floor((this.defend * percent) / 100);
  }

  get realEvade(): number {
    let percent = 100;
    if (this._changeCharacterByMagicSprite !== null) {
      percent += this._changeCharacterByMagicSprite.magic.evadeAddPercent || 0;
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

  get controledMagicSprite(): MagicSprite | null {
    return this._controledMagicSprite;
  }

  set controledMagicSprite(value: MagicSprite | null) {
    this._controledMagicSprite = value;
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
    return this.invisibleByMagicTime <= 0;
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
  get isFrozened(): boolean {
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
    if (this._changeToOppositeMilliseconds > 0) {
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
  follow(target: Character): void {
    this.followTarget = target;
    this.isFollowTargetFound = true;
  }

  /** 判断是否是对立关系 */
  isOpposite(target: Character): boolean {
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
    if (this.isEnemy || this.isPartner || this.isPlayer) {
      return true;
    }
    if (
      this.kind === CharacterKind.Normal ||
      this.kind === CharacterKind.Fighter ||
      this.kind === CharacterKind.Eventer
    ) {
      return true;
    }
    return false;
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
  // === Status Effects Setters ===
  // =============================================

  setFrozenSeconds(seconds: number, hasVisualEffect: boolean): void {
    if (this.frozenSeconds > 0) return;
    this.frozenSeconds = seconds;
    this.isFrozenVisualEffect = hasVisualEffect;
  }

  setPoisonSeconds(seconds: number, hasVisualEffect: boolean): void {
    if (this.poisonSeconds > 0) return;
    this.poisonSeconds = seconds;
    this.isPoisonVisualEffect = hasVisualEffect;
  }

  setPetrifySeconds(seconds: number, hasVisualEffect: boolean): void {
    if (this.petrifiedSeconds > 0) return;
    this.petrifiedSeconds = seconds;
    this.isPetrifiedVisualEffect = hasVisualEffect;
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

  protected _updateTextureForState(state: CharacterState): void {
    if (this._customAsfCache.has(state)) {
      const customAsf = this._customAsfCache.get(state);
      if (customAsf) {
        this._texture = customAsf;
        // 通过 setter 重新设置方向，自动处理取模和帧范围计算
        // Texture setter 调用 CurrentDirection = CurrentDirection; CurrentFrameIndex = _frameBegin;
        this.currentDirection = this._currentDirection;
        this._currentFrameIndex = this._frameBegin;
        return;
      }
    }

    if (this.customActionFiles.has(state)) {
      const asfFile = this.customActionFiles.get(state)!;
      this.loadCustomActionFile(state, asfFile)
        .then(() => {
          if (this._state === state && this._customAsfCache.has(state)) {
            this._texture = this._customAsfCache.get(state) || null;
            // 通过 setter 重新设置方向
            this.currentDirection = this._currentDirection;
            this._currentFrameIndex = this._frameBegin;
          }
        })
        .catch((err: unknown) =>
          logger.warn(`[CharacterBase] Failed to load custom ASF for state ${state}:`, err)
        );
    }

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

  /** 检查是否有动态障碍物 */
  hasObstacle(_tilePosition: Vector2): boolean {
    return false;
  }

  /** 加载自定义动作文件 */
  protected async loadCustomActionFile(stateType: number, asfFile: string): Promise<void> {
    const asf = await loadCharacterAsf(asfFile);
    if (asf) {
      this._customAsfCache.set(stateType, asf);
    } else {
      logger.warn(`[CharacterBase] Failed to load custom action file: ${asfFile}`);
    }
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

// 类型别名 - 确保继承链中可以使用 Character 类型
export type Character = CharacterBase;
