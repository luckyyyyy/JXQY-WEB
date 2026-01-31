/**
 * Character 基类 - 对应 C# Character.cs
 * Player 和 NPC 的基类，继承自 Sprite
 */

import type { AudioManager } from "../audio";
import { logger } from "../core/logger";
import { PathType, findPath as pathFinderFindPath, canMoveInDirection } from "../core/pathFinder";
import type { CharacterConfig, CharacterStats, Vector2 } from "../core/types";
import {
  BASE_SPEED,
  CharacterKind,
  CharacterState,
  type Direction,
  MIN_CHANGE_MOVE_SPEED_PERCENT,
  RelationType,
  RUN_SPEED_FOLD,
  TILE_WIDTH,
} from "../core/types";
import {
  distance,
  getDirection,
  getDirectionFromVector,
  getViewTileDistance as getViewTileDistanceUtil,
  pixelToTile,
  tileToPixel,
} from "../core/utils";
import type { MagicSprite } from "../magic/magicSprite";
import type { MagicData } from "../magic/types";
import { Obj } from "../obj/obj";
import type { AsfData } from "../sprite/asf";
import {
  createEmptySpriteSet,
  getAsfForState,
  loadSpriteSet,
  Sprite,
  type SpriteSet,
} from "../sprite/sprite";
import {
  applyConfigToCharacter,
  type CharacterInstance,
  extractConfigFromCharacter,
  extractStatsFromCharacter,
} from "./iniParser";
import { loadCharacterAsf, loadNpcRes } from "./resFile";
import { getEffectAmount } from "../magic/effects/common";
import { LevelManager } from "./level/levelManager";

/** 加载中状态标记（-1），确保后续 state 变更时触发纹理更新 */
export const LOADING_STATE = -1 as CharacterState;

/** 战斗状态超时时间（秒），超过此时间无战斗动作则自动退出战斗状态 */
const MAX_NON_FIGHT_SECONDS = 7;

/** 角色更新结果 */
export interface CharacterUpdateResult {
  moved: boolean;
  reachedDestination: boolean;
  triggeredScript?: string;
}

/** Character 基类 - 对应 C# Character.cs, implements CharacterInstance 接口 */
export abstract class Character extends Sprite implements CharacterInstance {
  // === Identity (公共属性) ===
  name: string = "";
  kind: CharacterKind = 0;
  relation: RelationType = 0; // C#: int _relation 默认 0 = Friend
  group: number = 0;

  // === Stats (需要范围限制的保留 protected) ===
  life: number = 100;
  lifeMax: number = 100;
  mana: number = 100;
  manaMax: number = 100;
  thew: number = 100; // stamina
  thewMax: number = 100;
  // C# Reference: Attack/Defend 属性考虑 _weakByMagicSprite 效果
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

  // === Movement ===
  walkSpeed: number = 1; // C#: WalkSpeed setter 限制最小值为 1
  addMoveSpeedPercent: number = 0;
  visionRadius: number = 0; // C#: 默认 0，getter 返回 9 如果是 0
  attackRadius: number = 0; // C#: 默认 0，getter 返回 1 如果是 0
  dialogRadius: number = 0; // C#: 默认 0，getter 返回 1 如果是 0
  protected _destinationMoveTilePosition: Vector2 = { x: 0, y: 0 };
  // Note: _movedDistance is inherited from Sprite base class

  // === State ===
  protected _state: CharacterState = CharacterState.Stand; // 保留 setter 逻辑
  path: Vector2[] = [];
  protected _isVisible: boolean = true; // 保留 setter 逻辑 (同时设置 _isShow)
  isDeath: boolean = false;
  isDeathInvoked: boolean = false;
  isSitted: boolean = false;
  protected _isInFighting: boolean = false;
  protected _totalNonFightingSeconds: number = 0;
  isFightDisabled: boolean = false;
  isJumpDisabled: boolean = false;

  // === AI ===
  idle: number = 0; // C#: int _idle 默认 0 - attack interval in frames
  aiType: number = 0; // 0=normal, 1=rand move+attack, 2=rand move no fight
  stopFindingTarget: number = 0;
  keepRadiusWhenLifeLow: number = 0;
  lifeLowPercent: number = 20;
  keepRadiusWhenFriendDeath: number = 0;

  // === Combat ===
  protected _lastAttacker: Character | null = null;

  // === Configuration Files ===
  npcIni: string = "";
  flyIni: string = ""; // 保留 setter 逻辑
  flyIni2: string = ""; // 保留 setter 逻辑
  flyInis: string = ""; // 保留 setter 逻辑
  protected _flyIniInfos: Array<{ useDistance: number; magicIni: string }> = [];
  bodyIni: string = "";
  bodyIniObj: Obj | null = null;
  isBodyIniAdded: number = 0;
  notAddBody: boolean = false;
  scriptFile: string = "";
  scriptFileRight: string = "";
  deathScript: string = "";
  timerScript: string = "";
  timerInterval: number = 0;
  pathFinder: number = 0; // 保留 getter 逻辑 (pathType)
  noAutoAttackPlayer: number = 0;
  canInteractDirectly: number = 0;
  dropIni: string = "";
  expBonus: number = 0;
  buyIniFile: string = "";
  invincible: number = 0;
  reviveMilliseconds: number = 0;
  leftMillisecondsToRevive: number = 0;

  // === Hurt Player (接触伤害) - C#: HurtPlayerInterval, HurtPlayerLife, HurtPlayerRadius ===
  hurtPlayerInterval: number = 0; // 伤害间隔（毫秒）
  hurtPlayerLife: number = 0; // 接触伤害值
  hurtPlayerRadius: number = 0; // 接触伤害半径

  // === Magic Direction - C#: MagicDirectionWhenBeAttacked, MagicDirectionWhenDeath ===
  magicDirectionWhenBeAttacked: number = 0; // 0-7 方向或特殊值
  magicDirectionWhenDeath: number = 0;

  // === Visibility Control - C#: FixedPos, VisibleVariableName, VisibleVariableValue ===
  fixedPos: string = ""; // 固定路径点 (protected for Npc override)
  visibleVariableName: string = ""; // 可见性变量名
  visibleVariableValue: number = 0; // 可见性变量值

  // === Auto Magic - C#: MagicToUseWhenLifeLow, MagicToUseWhenBeAttacked, MagicToUseWhenDeath ===
  magicToUseWhenLifeLow: string = ""; // 低血量时自动释放的法术
  magicToUseWhenBeAttacked: string = ""; // 被攻击时自动释放的法术
  magicToUseWhenDeath: string = ""; // 死亡时自动释放的法术

  // === Drop Control - C#: NoDropWhenDie ===
  noDropWhenDie: number = 0; // 死亡时不掉落物品

  // === Equipment - C#: HeadEquip, NeckEquip, etc. ===
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
  // 每个 Character 持有一个 LevelManager 实例
  readonly levelManager: LevelManager = new LevelManager();

  // 为兼容 CharacterInstance 接口提供 getter
  get levelIniFile(): string {
    return this.levelManager.getLevelFile();
  }
  set levelIniFile(value: string) {
    // 注意：setter 只是为了兼容接口，实际上应该用 levelManager.setLevelFile()
    // 同步设置会丢失异步加载的配置，只有 save/load 时会用到
    this.levelManager.setLevelFile(value).catch(err => {
      logger.error(`[Character] Failed to set levelIniFile: ${err}`);
    });
  }

  poisonByCharacterName: string = "";
  buyIniString: string = "";

  // === Status Effects ===
  poisonSeconds: number = 0;
  petrifiedSeconds: number = 0;
  frozenSeconds: number = 0;
  isPoisonVisualEffect: boolean = false;
  isPetrifiedVisualEffect: boolean = false;
  isFrozenVisualEffect: boolean = false;
  private _poisonedMilliSeconds: number = 0; // 中毒伤害计时器

  // === Invisible (C#: InvisibleByMagicTime) ===
  invisibleByMagicTime: number = 0; // 隐身时间（毫秒）
  isVisibleWhenAttack: boolean = false; // 攻击时是否现形

  // === Disable ===
  disableMoveMilliseconds: number = 0; // 禁止移动时间
  disableSkillMilliseconds: number = 0; // 禁止技能时间

  // === ChangeCharacter (C#: _changeCharacterByMagicSprite) ===
  protected _changeCharacterByMagicSprite: MagicSprite | null = null;
  protected _changeCharacterByMagicSpriteTime: number = 0;

  // === WeakBy (C#: _weakByMagicSprite, _weakByMagicSpriteTime) ===
  // 弱化效果 - 降低攻击力和防御力
  protected _weakByMagicSprite: MagicSprite | null = null;
  protected _weakByMagicSpriteTime: number = 0;

  // === SpeedUp (C#: SppedUpByMagicSprite) ===
  // 加速效果 - 通过 MagicSprite 的 RangeSpeedUp 增加移动速度
  speedUpByMagicSprite: MagicSprite | null = null;

  // === ChangeToOpposite (C#: _changeToOppositeMilliseconds) ===
  // 变换阵营效果 - 临时变成友军/敌军
  protected _changeToOppositeMilliseconds: number = 0;

  // === LifeMilliseconds (C#: _lifeMilliseconds) ===
  // 召唤物存活时间 - 时间到自动死亡
  protected _lifeMilliseconds: number = 0;

  // === FlyIni Change (C#: _changeFlyIniByMagicSprite) ===
  protected _changeFlyIniByMagicSprite: MagicSprite | null = null;

  // === ControledMagicSprite (C#: _controledMagicSprite) ===
  // 被控制效果 - 例如被附身、被控制攻击等
  protected _controledMagicSprite: MagicSprite | null = null;

  // === SummonedByMagicSprite (C#: SummonedByMagicSprite) ===
  // 召唤来源 - 记录召唤此角色的武功精灵
  summonedByMagicSprite: MagicSprite | null = null;

  // === MagicSpritesInEffect (C#: LinkedList<MagicSprite> MagicSpritesInEffect) ===
  protected _magicSpritesInEffect: MagicSprite[] = [];

  // === Direction Counts (C#: _canAttackDirCount) ===
  // 攻击动画支持的方向数（延迟初始化）
  protected _canAttackDirCount: number = -1;

  // === Keep Attack Position ===
  keepAttackX: number = 0;
  keepAttackY: number = 0;

  // === Other ===
  lum: number = 0; // brightness
  action: number = 0;

  // === Position (for save/load) ===
  // mapX/mapY are inherited from Sprite with getters/setters
  // dir is assigned during config loading, then setDirection applies it
  dir: number = 0;

  // === Targeting ===
  protected _destinationAttackTilePosition: Vector2 | null = null;
  // C#: _attackDestination - 攻击目标像素位置
  protected _attackDestination: Vector2 | null = null;
  // C#: _magicToUseWhenAttack - 攻击时使用的武功（文件名）
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

  // === Audio ===
  protected _stateSounds: Map<number, string> = new Map();

  /**
   * 获取 AudioManager（通过 IEngineContext）
   */
  protected get audioManager(): AudioManager {
    return this.engine.getAudioManager() as AudioManager;
  }

  // === Walkability Methods ===
  /**
   * 检查瓦片是否可行走
   * 通过 IEngineContext.getCollisionChecker() 获取碰撞检测器
   */
  protected checkWalkable(tile: Vector2): boolean {
    return this.engine.getCollisionChecker()?.isTileWalkable(tile);
  }

  /**
   * 检查瓦片是否为地图角色障碍（检查 Obstacle + Trans 标志）
   * 用于寻路时过滤邻居瓦片
   * C# Reference: MapBase.IsObstacleForCharacter - 检查 (type & (Obstacle + Trans)) != 0
   */
  protected checkMapObstacleForCharacter(tile: Vector2): boolean {
    return this.engine.getCollisionChecker()?.isMapObstacleForCharacter(tile);
  }

  /**
   * 检查瓦片是否为硬障碍（只检查 Obstacle 标志，用于对角线阻挡）
   * C# Reference: MapBase.IsObstacle - 检查 (type & Obstacle) != 0
   */
  protected checkHardObstacle(tile: Vector2): boolean {
    return this.engine.getCollisionChecker()?.isMapOnlyObstacle(tile);
  }

  // === Relation Properties ===

  /** C#: SetRelation - 改变关系时清除跟随目标 */
  setRelation(relation: number): void {
    const oldRelation = this.relation;
    const newRelation = relation as RelationType;

    // C#: If changing from Friend to Enemy, or from Enemy to non-Enemy, clear follow target
    if (
      (oldRelation === RelationType.Friend && newRelation === RelationType.Enemy) ||
      (oldRelation === RelationType.Enemy && newRelation !== RelationType.Enemy)
    ) {
      this.clearFollowTarget();
    }

    this.relation = newRelation;
  }

  /** C#: IsEnemy */
  get isEnemy(): boolean {
    return this.relation === RelationType.Enemy;
  }

  /** C#: IsPlayer */
  get isPlayer(): boolean {
    return this.kind === CharacterKind.Player;
  }

  /** C#: IsFriend */
  get isFriend(): boolean {
    return this.relation === RelationType.Friend;
  }

  /** C#: IsRelationNeutral */
  get isRelationNeutral(): boolean {
    return this.relation === RelationType.None;
  }

  /** C#: IsNoneFighter */
  get isNoneFighter(): boolean {
    return this.relation === RelationType.None && this.kind === CharacterKind.Fighter;
  }

  /** C#: IsFighterFriend */
  get isFighterFriend(): boolean {
    return (
      (this.kind === CharacterKind.Fighter || this.kind === CharacterKind.Follower) &&
      this.relation === RelationType.Friend
    );
  }

  /** C#: IsFighterKind */
  get isFighterKind(): boolean {
    return this.kind === CharacterKind.Fighter;
  }

  /** C#: IsFighter */
  get isFighter(): boolean {
    return this.isFighterKind || this.isPartner;
  }

  /** C#: IsPartner */
  get isPartner(): boolean {
    return this.kind === CharacterKind.Follower;
  }

  /** C#: IsEventCharacter / IsEventer */
  get isEventCharacter(): boolean {
    return this.kind === CharacterKind.Eventer;
  }

  /** Alias for isEventCharacter - used by IEngineContext INpc interface */
  get isEventer(): boolean {
    return this.kind === CharacterKind.Eventer;
  }

  /** C#: HasInteractScript */
  get hasInteractScript(): boolean {
    return this.scriptFile !== "";
  }

  /** C#: HasInteractScriptRight */
  get hasInteractScriptRight(): boolean {
    return this.scriptFileRight !== "";
  }

  /**
   * 判断角色是否应该在小地图上显示
   * C# Reference: LittleMapGui.DrawCharacter
   * 只显示：玩家、敌人、同伴、Normal/Fighter/Eventer 类型的 NPC
   * 不显示：GroundAnimal, AfraidPlayerAnimal, Flyer 等
   */
  shouldShowOnMinimap(): boolean {
    // 敌人、同伴、玩家始终显示
    if (this.isEnemy || this.isPartner || this.isPlayer) {
      return true;
    }
    // 只显示 Normal, Fighter, Eventer 类型的路人 NPC
    if (
      this.kind === CharacterKind.Normal ||
      this.kind === CharacterKind.Fighter ||
      this.kind === CharacterKind.Eventer
    ) {
      return true;
    }
    // 其他类型（GroundAnimal, AfraidPlayerAnimal, Flyer, Follower）不显示
    return false;
  }

  /** C#: IsInteractive */
  get isInteractive(): boolean {
    // Dead characters are not interactive (they become "bodies")
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

  /** C#: IsOpposite */
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

  // === Stats Properties (with validation methods) ===

  /**
   * C# Reference: Character.Attack getter
   * 如果有 _weakByMagicSprite，则降低攻击力
   */
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

  /**
   * C# Reference: Character.Defend getter
   * 如果有 _weakByMagicSprite，则降低防御力
   */
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

  /**
   * C# Reference: Character.RealAttack getter
   * 考虑 _changeCharacterByMagicSprite 和 _changeFlyIniByMagicSprite 的加成
   */
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

  /**
   * C# Reference: Character.RealDefend getter
   * 考虑 _changeCharacterByMagicSprite 的加成
   */
  get realDefend(): number {
    let percent = 100;
    if (this._changeCharacterByMagicSprite !== null) {
      percent += this._changeCharacterByMagicSprite.magic.defendAddPercent || 0;
    }
    return Math.floor((this.defend * percent) / 100);
  }

  /**
   * C# Reference: Character.RealEvade getter
   * 考虑 _changeCharacterByMagicSprite 的加成
   */
  get realEvade(): number {
    let percent = 100;
    if (this._changeCharacterByMagicSprite !== null) {
      percent += this._changeCharacterByMagicSprite.magic.evadeAddPercent || 0;
    }
    return Math.floor((this.evade * percent) / 100);
  }

  /**
   * C# Reference: Character.Relation getter
   * 考虑 _controledMagicSprite 和 _changeToOppositeMilliseconds 的影响
   */
  getEffectiveRelation(): RelationType {
    // C#: if (_controledMagicSprite != null && _relation == Enemy) return Friend
    // TODO: _controledMagicSprite 支持

    // C#: if (_changeToOppositeMilliseconds > 0) 反转关系
    if (this._changeToOppositeMilliseconds > 0) {
      if (this.relation === RelationType.Enemy) {
        return RelationType.Friend;
      } else if (this.relation === RelationType.Friend) {
        return RelationType.Enemy;
      }
    }
    return this.relation;
  }

  /**
   * C# Reference: Character.LifeMilliseconds getter/setter
   * 召唤物存活时间
   */
  get lifeMilliseconds(): number {
    return this._lifeMilliseconds;
  }

  set lifeMilliseconds(value: number) {
    this._lifeMilliseconds = value;
  }

  /**
   * C# Reference: Character.IsFullLife
   * 检查生命值是否满
   */
  get isFullLife(): boolean {
    return this.life === this.lifeMax;
  }

  /**
   * C# Reference: Character.ControledMagicSprite
   * 被控制的武功精灵
   */
  get controledMagicSprite(): MagicSprite | null {
    return this._controledMagicSprite;
  }

  set controledMagicSprite(value: MagicSprite | null) {
    this._controledMagicSprite = value;
  }

  /**
   * C# Reference: Character.CanAttackDirCount
   * 获取攻击动画支持的方向数
   * 从 Attack, Attack1, Attack2 状态中取最小值
   */
  get canAttackDirCount(): number {
    if (this._canAttackDirCount === -1) {
      // 延迟初始化：从各个攻击状态的 ASF 中获取方向数
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

  /**
   * 获取多个状态中的最小方向数
   * C# Reference: Character.GetMinDir
   */
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

  // === Movement Properties (with special logic) ===

  // C#: WalkSpeed { set { _walkSpeed = value < 1 ? 1 : value; } }
  setWalkSpeed(value: number): void {
    this.walkSpeed = value < 1 ? 1 : value;
  }

  // C#: VisionRadius { get { return _visionRadius == 0 ? 9 : _visionRadius; } }
  getVisionRadius(): number {
    return this.visionRadius === 0 ? 9 : this.visionRadius;
  }

  // C#: AttackRadius { get { return _attackRadius == 0 ? 1 : _attackRadius; } }
  getAttackRadius(): number {
    return this.attackRadius === 0 ? 1 : this.attackRadius;
  }

  // C#: DialogRadius { get { return _dialogRadius == 0 ? 1 : _dialogRadius; } }
  getDialogRadius(): number {
    return this.dialogRadius === 0 ? 1 : this.dialogRadius;
  }

  // C#: DestinationMoveTilePosition - destination for walking
  get destinationMoveTilePosition(): Vector2 {
    return this._destinationMoveTilePosition;
  }

  // C#: CurrentFixedPosIndex - current index in FixedPos path for LoopWalk
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
      // Update texture based on state - check custom ASF cache first
      this._updateTextureForState(value);
      // Play state sound effect
      // C# Reference: Character.SetState() - plays sound based on state type
      this._playStateSoundOnStateChange(value);
    }
  }

  /**
   * 设置加载中状态（-1），用于在精灵加载前临时设置
   * 确保后续设置真正 state 时会触发纹理更新
   */
  setLoadingState(): void {
    this._state = LOADING_STATE;
  }

  /**
   * Play sound effect when state changes
   * C# Reference: Character.SetState() sound logic
   * - Walk/FightWalk/Run/FightRun: loop sound
   * - Magic/Attack/Attack1/Attack2: do nothing (played when action completes)
   * - Others: play once
   */
  private _playStateSoundOnStateChange(state: CharacterState): void {
    // Stop any looping sound first
    // C# Reference: if (_sound != null) { _sound.Stop(true); _sound = null; }
    this.audioManager.stopLoopingSound();

    const soundPath = this._stateSounds.get(state);
    if (!soundPath) return;

    switch (state) {
      case CharacterState.Walk:
      case CharacterState.FightWalk:
      case CharacterState.Run:
      case CharacterState.FightRun:
        // Loop sound for movement states
        // C# Reference: _sound = sound.CreateInstance(); _sound.IsLooped = true; _sound.Play();
        this.audioManager.playLoopingSound(soundPath);
        break;

      case CharacterState.Magic:
      case CharacterState.Attack:
      case CharacterState.Attack1:
      case CharacterState.Attack2:
        // Do nothing - sound is played when action completes
        // C# Reference: //do nothing
        break;

      default:
        // Play sound once for other states (Sit, Hurt, Death, etc.)
        // C# Reference: PlaySoundEffect(sound);
        this.audioManager.playSound(soundPath);
        break;
    }
  }

  /**
   * Update texture for a state, checking custom ASF cache first
   * Based on C# Character.SetState() logic
   */
  protected _updateTextureForState(state: CharacterState): void {
    // Check if there's a cached custom ASF for this state
    if (this._customAsfCache.has(state)) {
      const customAsf = this._customAsfCache.get(state);
      if (customAsf) {
        this._texture = customAsf;
        if (this._texture) {
          this._frameEnd = (this._texture.framesPerDirection || 1) - 1;
        }
        return;
      }
    }

    // Check if there's a custom action file for this state (but not yet loaded)
    if (this.customActionFiles.has(state)) {
      // Trigger async load - will be available next frame
      const asfFile = this.customActionFiles.get(state)!;
      this.preloadCustomActionFile(state, asfFile)
        .then(() => {
          // If still in the same state, update texture
          if (this._state === state && this._customAsfCache.has(state)) {
            this._texture = this._customAsfCache.get(state) || null;
            if (this._texture) {
              this._frameEnd = (this._texture.framesPerDirection || 1) - 1;
            }
          }
        })
        .catch((err) =>
          logger.warn(`[Character] Failed to load custom ASF for state ${state}:`, err)
        );
    }

    // Fall back to default sprite set
    this._texture = getAsfForState(this._spriteSet, state);
    if (this._texture) {
      this._frameEnd = (this._texture.framesPerDirection || 1) - 1;
    }
  }

  // === Interface Properties ===
  // These match PlayerData interface for direct use

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

  /**
   * Alias for direction setter
   */
  setDirection(dir: number): void {
    this._currentDirection = dir;
  }

  get currentFrame(): number {
    return this._currentFrameIndex;
  }

  get config(): CharacterConfig {
    return this.getConfig();
  }

  get isVisible(): boolean {
    return this._isVisible;
  }

  set isVisible(value: boolean) {
    this._isVisible = value;
    this.isShow = value;
  }

  /**
   * C#: IsHide - inverse of isVisible
   * Used by ShowNpc command
   */
  get isHide(): boolean {
    return !this._isVisible;
  }

  set isHide(value: boolean) {
    this.isVisible = !value;
  }

  /** C#: IsInFighting */
  get isInFighting(): boolean {
    return this._isInFighting;
  }

  /** 检查尸体物体是否有效 */
  get isBodyIniOk(): boolean {
    return (
      this.bodyIniObj !== null &&
      this.bodyIniObj.objFile !== null &&
      this.bodyIniObj.objFile.size > 0
    );
  }

  /** C#: IsInDeathing */
  get isInDeathing(): boolean {
    return this._state === CharacterState.Death;
  }

  /** C#: IsStanding() */
  isStanding(): boolean {
    return (
      this._state === CharacterState.Stand ||
      this._state === CharacterState.Stand1 ||
      this._state === CharacterState.FightStand
    );
  }

  /** C#: IsSitting() */
  isSitting(): boolean {
    return this._state === CharacterState.Sit;
  }

  /** C#: IsWalking() */
  isWalking(): boolean {
    return this._state === CharacterState.Walk || this._state === CharacterState.FightWalk;
  }

  /** C#: IsRuning() */
  isRunning(): boolean {
    return this._state === CharacterState.Run || this._state === CharacterState.FightRun;
  }

  // === Status Effects Getters ===

  /** C#: IsFrozened - 是否被冻结 */
  get isFrozened(): boolean {
    return this.frozenSeconds > 0;
  }

  /** C#: IsPoisoned - 是否中毒 */
  get isPoisoned(): boolean {
    return this.poisonSeconds > 0;
  }

  /** C#: IsPetrified - 是否被石化 */
  get isPetrified(): boolean {
    return this.petrifiedSeconds > 0;
  }

  /**
   * C#: BodyFunctionWell - 身体是否正常运作
   * 未被冻结、中毒、石化时返回 true
   */
  get bodyFunctionWell(): boolean {
    return this.frozenSeconds <= 0 && this.poisonSeconds <= 0 && this.petrifiedSeconds <= 0;
  }

  // === Status Effects Setters ===

  /**
   * C#: SetFrozenSeconds(float s, bool hasVisualEffect)
   * 设置冻结时间，已冻结时不覆盖
   */
  setFrozenSeconds(seconds: number, hasVisualEffect: boolean): void {
    if (this.frozenSeconds > 0) return;
    this.frozenSeconds = seconds;
    this.isFrozenVisualEffect = hasVisualEffect;
  }

  /**
   * C#: SetPoisonSeconds(float s, bool hasVisualEffect)
   * 设置中毒时间，已中毒时不覆盖
   */
  setPoisonSeconds(seconds: number, hasVisualEffect: boolean): void {
    if (this.poisonSeconds > 0) return;
    this.poisonSeconds = seconds;
    this.isPoisonVisualEffect = hasVisualEffect;
  }

  /**
   * C#: SetPetrifySeconds(float s, bool hasVisualEffect)
   * 设置石化时间，已石化时不覆盖
   */
  setPetrifySeconds(seconds: number, hasVisualEffect: boolean): void {
    if (this.petrifiedSeconds > 0) return;
    this.petrifiedSeconds = seconds;
    this.isPetrifiedVisualEffect = hasVisualEffect;
  }

  /** C#: ClearFollowTarget() */
  clearFollowTarget(): void {
    this.followTarget = null;
    this.isFollowTargetFound = false;
  }

  /**
   * C#: Follow(Character target)
   * Set follow target
   */
  follow(target: Character): void {
    this.followTarget = target;
    this.isFollowTargetFound = true;
  }

  /**
   * C#: IsNotFightBackWhenBeHit => AIType == 2
   * 被攻击时不反击（AIType=2 的特性）
   */
  get isNotFightBackWhenBeHit(): boolean {
    return this.aiType === 2;
  }

  /**
   * C#: IsRandMoveRandAttack => AIType == 1 || AIType == 2
   * 随机移动随机攻击
   */
  get isRandMoveRandAttack(): boolean {
    return this.aiType === 1 || this.aiType === 2;
  }

  /**
   * C#: FollowAndWalkToTarget(Character target)
   * Walk to target and follow target
   */
  followAndWalkToTarget(target: Character): void {
    this.walkTo(target.tilePosition);
    this.follow(target);
  }

  /**
   * C#: Character.NotifyFighterAndAllNeighbor(Character target)
   * Make this enemy and all neighbor enemy walk to target and follow target.
   * If follow target is already found and distance is less than new target, don't change.
   */
  notifyFighterAndAllNeighbor(target: Character | null): void {
    // C#: if (target == null || (!IsEnemy && !IsNoneFighter) || FollowTarget != null || IsNotFightBackWhenBeHit) return;
    if (
      target === null ||
      (!this.isEnemy && !this.isNoneFighter) ||
      this.followTarget !== null ||
      this.isNotFightBackWhenBeHit
    ) {
      return;
    }

    // 获取邻近的敌人或中立战斗者
    const npcManager = this.engine?.getNpcManager();
    if (!npcManager) return;

    // C#: var characters = IsEnemy ? NpcManager.GetNeighborEnemy(this) : NpcManager.GetNeighborNuturalFighter(this);
    // 注意：接口返回 ICharacter[]，但实际是 Character[]，这里使用类型断言
    const characters = (
      this.isEnemy
        ? npcManager.getNeighborEnemy(this)
        : npcManager.getNeighborNeutralFighter(this)
    ) as Character[];

    // C#: characters.Add(this);
    characters.push(this);

    // 通知所有角色追击目标
    for (const character of characters) {
      // C#: if (character.FollowTarget != null && character.IsFollowTargetFound &&
      //         distance(character, character.FollowTarget) < distance(character, target)) continue;
      if (
        character.followTarget !== null &&
        character.isFollowTargetFound &&
        this.getDistance(character.pixelPosition, character.followTarget.pixelPosition) <
          this.getDistance(character.pixelPosition, target.pixelPosition)
      ) {
        continue;
      }
      // C#: character.FollowAndWalkToTarget(target);
      character.followAndWalkToTarget(target);
    }
  }

  /**
   * 计算两点之间的距离
   */
  private getDistance(a: Vector2, b: Vector2): number {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  // === Configuration Properties (runtime setters) ===

  /**
   * C#: FlyIni setter - for runtime script calls
   * Sets flyIni and rebuilds _flyIniInfos
   */
  setFlyIni(value: string): void {
    this.flyIni = value;
    this.buildFlyIniInfos();
  }

  /**
   * C#: FlyIni2 setter - for runtime script calls
   * Sets flyIni2 and rebuilds _flyIniInfos
   */
  setFlyIni2(value: string): void {
    this.flyIni2 = value;
    this.buildFlyIniInfos();
  }

  /**
   * C#: FlyInis setter - for runtime script calls
   * Sets flyInis and rebuilds _flyIniInfos
   */
  setFlyInis(value: string): void {
    this.flyInis = value;
    this.buildFlyIniInfos();
  }

  /**
   * C#: AddFlyInis - appends a magic:distance pair to flyInis
   * Format: "magic1:dist1;magic2:dist2;"
   */
  addFlyInis(magicFileName: string, distance: number): void {
    const entry = `${magicFileName}:${distance};`;
    if (!this.flyInis) {
      this.flyInis = entry;
    } else {
      // Ensure it ends with semicolon before appending
      this.flyInis = (this.flyInis.endsWith(";") ? this.flyInis : this.flyInis + ";") + entry;
    }
    this.buildFlyIniInfos();
  }

  /**
   * Set fixedPos - base implementation just stores the value
   * Npc overrides this to parse the path
   */
  setFixedPos(value: string): void {
    this.fixedPos = value;
  }

  /**
   * Get the best attack radius for current distance to target
   * C# Reference: Character.GetClosedAttackRadius
   */
  getClosedAttackRadius(toTargetDistance: number): number {
    if (this._flyIniInfos.length === 0) {
      // C#: return AttackRadius; (uses getter which returns 1 if _attackRadius is 0)
      return this.getAttackRadius();
    }

    let minDistance = Number.MAX_SAFE_INTEGER;
    let result = 0;

    for (let i = 0; i < this._flyIniInfos.length; i++) {
      const distance = Math.abs(toTargetDistance - this._flyIniInfos[i].useDistance);
      if (minDistance > distance) {
        minDistance = distance;
        result = this._flyIniInfos[i].useDistance;
      }
      if (this._flyIniInfos[i].useDistance > toTargetDistance) break;
    }

    return result;
  }

  /**
   * Get a random magic that can be used at the specified distance
   * C# Reference: Character.GetRamdomMagicWithUseDistance
   */
  getRandomMagicWithUseDistance(useDistance: number): string | null {
    let start = -1;
    let end = -1;

    for (let i = 0; i < this._flyIniInfos.length; i++) {
      if (useDistance === this._flyIniInfos[i].useDistance) {
        if (start === -1) start = i;
      } else {
        if (start !== -1) {
          end = i;
          break;
        }
      }
    }

    if (end === -1) end = this._flyIniInfos.length;

    if (start !== -1) {
      const index = start + Math.floor(Math.random() * (end - start));
      return this._flyIniInfos[index].magicIni;
    }

    // Fallback: find first magic with distance > useDistance
    for (let i = 0; i < this._flyIniInfos.length; i++) {
      if (this._flyIniInfos[i].useDistance > useDistance) {
        return this._flyIniInfos[i].magicIni;
      }
    }

    return this._flyIniInfos.length > 0 ? this._flyIniInfos[0].magicIni : null;
  }

  /**
   * Check if character has any magic configured
   */
  hasMagicConfigured(): boolean {
    return this._flyIniInfos.length > 0;
  }

  /**
   * Get the PathType for this character
   * C# Reference: abstract PathFinder.PathType PathType { get; }
   *
   * This is overridden in Player and Npc to return appropriate PathType
   * based on character kind, relation, and pathFinder value
   */
  getPathType(): PathType {
    // Default implementation - subclasses should override
    if (this.pathFinder === 1) {
      return PathType.PerfectMaxPlayerTry;
    }
    return PathType.PathOneStep;
  }

  // === Action Checks ===

  /**
   * Check if character can perform actions (not in jump, attack, etc.)
   * C# Reference: Character.PerformActionOk()
   * Returns false when in blocked states like Attack, Magic, Hurt, Death, etc.
   */
  protected canPerformAction(): boolean {
    // C#: State == Jump || Attack || Attack1 || Attack2 || Magic || Hurt || Death || FightJump
    // || IsPetrified || IsInTransport || MovedByMagicSprite || BouncedVelocity > 0 || _inBezierMove
    const blockedStates = [
      CharacterState.Jump,
      CharacterState.Attack,
      CharacterState.Attack1,
      CharacterState.Attack2,
      CharacterState.Magic,
      CharacterState.Hurt,
      CharacterState.Death,
      CharacterState.FightJump,
    ];
    return !blockedStates.includes(this._state) && !this.isInSpecialAction;
  }

  /**
   * Alias for canPerformAction (matches C# naming)
   * C# Reference: Character.PerformActionOk()
   */
  performActionOk(): boolean {
    return this.canPerformAction();
  }

  /**
   * C# Reference: Character.HasObstacle(Vector2 tilePosition)
   * Check if there's a dynamic obstacle (NPC/Obj/Magic) at the tile position
   *
   * 注意：C# 中这是抽象方法，不检查地图障碍
   * 地图障碍由 PathFinder 通过 isMapObstacle 参数单独处理
   *
   * 基类默认返回 false（无动态障碍），子类应该重写此方法
   */
  hasObstacle(tilePosition: Vector2): boolean {
    // Base implementation: no dynamic obstacles
    // Subclasses (Npc, Player) override this to check NPC/Obj/Magic/Player positions
    return false;
  }

  /**
   * C# Reference: Character.IsStateImageOk(CharacterState state)
   * Check if character has animation for the specified state
   * C#: return NpcIni != null && NpcIni.ContainsKey((int)state) && NpcIni[(int)state].Image != null && NpcIni[(int)state].Image.IsOk
   */
  isStateImageOk(state: CharacterState): boolean {
    // Check if there's a specific ASF for this state in spriteSet
    const stateToKey: Record<number, keyof SpriteSet> = {
      [CharacterState.Stand]: "stand",
      [CharacterState.Stand1]: "stand1",
      [CharacterState.Walk]: "walk",
      [CharacterState.Run]: "run",
      [CharacterState.Jump]: "jump",
      [CharacterState.Attack]: "attack",
      [CharacterState.Attack1]: "attack1",
      [CharacterState.Attack2]: "attack2",
      [CharacterState.Magic]: "magic",
      [CharacterState.Hurt]: "hurt",
      [CharacterState.Death]: "death",
      [CharacterState.Sit]: "sit",
      [CharacterState.Special]: "special",
      [CharacterState.FightStand]: "fightStand",
      [CharacterState.FightWalk]: "fightWalk",
      [CharacterState.FightRun]: "fightRun",
      [CharacterState.FightJump]: "fightJump",
    };

    const key = stateToKey[state];
    if (key && this._spriteSet[key]) {
      return true;
    }

    // Check custom action files
    if (this._customAsfCache.has(state) && this._customAsfCache.get(state)) {
      return true;
    }

    return false;
  }

  /**
   * C# Reference: Character.StateInitialize(bool endInteract, bool noEndPlayCurrentDir)
   * Initialize character state before setting new state
   */
  stateInitialize(endInteract: boolean = true, _noEndPlayCurrentDir: boolean = false): void {
    // C#: EndPlayCurrentDirOnce() - we skip this for now
    // C#: DestinationMoveTilePosition = Vector2.Zero
    this._destinationMoveTilePosition = { x: 0, y: 0 };
    // C#: Path = null
    this.path = [];
    // C#: CancleAttackTarget()
    this._destinationAttackTilePosition = null;
    // C#: IsSitted = false
    this.isSitted = false;
    // C#: EndInteract if in interact
    if (this._interactiveTarget && endInteract) {
      this._interactiveTarget = null;
      this._isInteractiveRightScript = false;
    }
  }

  /**
   * Get pixel position (alias for pixelPosition getter)
   * C# Reference: PositionInWorld
   */
  getPixelPosition(): Vector2 {
    return this.pixelPosition;
  }

  /**
   * Set pixel position
   * C# Reference: PositionInWorld setter
   */
  setPixelPosition(x: number, y: number): void {
    this._positionInWorld = { x, y };
  }

  // === Distance Utilities ===

  /**
   * Calculate view tile distance (considers isometric layout)
   * C# Reference: PathFinder.GetViewTileDistance(from, to)
   * This is used for vision, attack range, etc.
   * Delegates to the utility function in core/utils.ts
   */
  protected getViewTileDistance(startTile: Vector2, endTile: Vector2): number {
    return getViewTileDistanceUtil(startTile, endTile);
  }

  /**
   * C# Reference: PathFinder.CanViewTarget(startTile, endTile, visionRadius)
   * Check if can view target without map obstacle
   * Simplified version - doesn't do full pathfinding, just checks distance
   */
  protected canViewTarget(startTile: Vector2, endTile: Vector2, visionRadius: number): boolean {
    // C#: Limit max vision radius for performance
    const maxVisionRadius = 80;
    if (visionRadius > maxVisionRadius) return false;

    // Same tile - can see
    if (startTile.x === endTile.x && startTile.y === endTile.y) return true;

    // Check if end tile is obstacle
    // C#: MapBase.IsObstacleForCharacter - 检查 Obstacle + Trans
    if (this.checkMapObstacleForCharacter(endTile)) return false;

    // Simplified: if within vision radius and no direct obstacle, can see
    const distance = this.getViewTileDistance(startTile, endTile);
    return distance <= visionRadius;
  }

  // === Methods ===

  /**
   * Load character from config
   * Based on C# Character.Load
   * Uses applyConfigToCharacter from iniParser for data-driven field assignment
   */
  loadFromConfig(config: CharacterConfig): void {
    applyConfigToCharacter(config, this);
    this.applyConfigSetters();
  }

  /**
   * Apply setters for fields that have side effects
   * Called after bulk field assignment to trigger dependent logic
   *
   * Flow: parseIni → assign fields → applyConfigSetters (triggers setXXX)
   *
   * Subclasses can override to add their own setters (e.g., Npc.setFixedPos)
   */
  applyConfigSetters(): void {
    // Direction (dir is assigned during config loading, Sprite.mapX/mapY setters already handle position)
    this.setDirection(this.dir);

    // These setters have side effects that depend on other fields (e.g., attackRadius)
    if (this.flyIni) this.setFlyIni(this.flyIni);
    if (this.flyIni2) this.setFlyIni2(this.flyIni2);
    if (this.flyInis) this.setFlyInis(this.flyInis);
    if (this.fixedPos) this.setFixedPos(this.fixedPos);
  }

  /**
   * Build _flyIniInfos list from flyIni, flyIni2, flyInis fields
   * Called by setFlyIni/setFlyIni2/setFlyInis after field is set
   *
   * C# Reference: FlyIni setter calls AddMagicToInfos(_flyIni, AttackRadius)
   */
  protected buildFlyIniInfos(): void {
    this._flyIniInfos = [];

    // Parse flyInis first (format: "MagicIni1:Distance1;MagicIni2:Distance2")
    if (this.flyInis) {
      const parts = this.flyInis.split(/[;；]/);
      for (const part of parts) {
        const trimmed = part.trim();
        if (!trimmed) continue;

        const colonMatch = trimmed.match(/^(.+?)[：:](\d+)$/);
        if (colonMatch) {
          const magicIni = colonMatch[1].trim();
          const useDistance = parseInt(colonMatch[2], 10) || 0;
          this._flyIniInfos.push({ useDistance, magicIni });
        } else {
          // No distance specified, use attackRadius
          this._flyIniInfos.push({ useDistance: this.attackRadius, magicIni: trimmed });
        }
      }
    }

    // Add flyIni with attackRadius distance
    if (this.flyIni) {
      this._flyIniInfos.push({ useDistance: this.attackRadius, magicIni: this.flyIni });
    }

    // Add flyIni2 with attackRadius distance
    if (this.flyIni2) {
      this._flyIniInfos.push({ useDistance: this.attackRadius, magicIni: this.flyIni2 });
    }

    // Sort by useDistance ascending
    this._flyIniInfos.sort((a, b) => a.useDistance - b.useDistance);

    if (this._flyIniInfos.length > 0) {
      logger.log(
        `[Character] ${this.name}: Built flyIniInfos: ${this._flyIniInfos.map((f) => `${f.magicIni}@${f.useDistance}`).join(", ")}`
      );
    }
  }

  /**
   * Get character config (for serialization)
   * Data-driven using extractConfigFromCharacter
   */
  getConfig(): CharacterConfig {
    return extractConfigFromCharacter(this);
  }

  /**
   * Get character stats
   * Data-driven using extractStatsFromCharacter
   */
  getStats(): CharacterStats {
    return extractStatsFromCharacter(this);
  }

  /**
   * Set position by tile coordinates
   * C#: SetPosition - Stand when reposition
   */
  setPosition(tileX: number, tileY: number): void {
    this.standingImmediately();
    this._mapX = tileX;
    this._mapY = tileY;
    this._updatePositionFromTile();
    this.path = [];
  }

  /**
   * C#: Character specific movement by direction index
   * Move character in a direction (8-direction index)
   * This is different from Sprite.moveTo which takes a Vector2
   * C# Sprite.cs line 267: MovedDistance += move.Length();
   */
  moveToDirection(direction: number, elapsedSeconds: number): void {
    // C#: ChangeMoveSpeedFold = 1 + AddMoveSpeedPercent / 100 (min -90%)
    const speedPercent = Math.max(MIN_CHANGE_MOVE_SPEED_PERCENT, this.addMoveSpeedPercent);
    const changeMoveSpeedFold = 1 + speedPercent / 100;
    const speed = BASE_SPEED * this.walkSpeed * changeMoveSpeedFold;
    const moveDistance = speed * elapsedSeconds;

    // Direction vectors (normalized) - C# uses Vector2.Normalize()
    const vectors = [
      { x: 0, y: -1 }, // North
      { x: Math.SQRT1_2, y: -Math.SQRT1_2 }, // NorthEast (1/√2)
      { x: 1, y: 0 }, // East
      { x: Math.SQRT1_2, y: Math.SQRT1_2 }, // SouthEast
      { x: 0, y: 1 }, // South
      { x: -Math.SQRT1_2, y: Math.SQRT1_2 }, // SouthWest
      { x: -1, y: 0 }, // West
      { x: -Math.SQRT1_2, y: -Math.SQRT1_2 }, // NorthWest
    ];

    const vec = vectors[direction] || { x: 0, y: 0 };
    const moveX = vec.x * moveDistance;
    const moveY = vec.y * moveDistance;
    this._positionInWorld.x += moveX;
    this._positionInWorld.y += moveY;
    this._currentDirection = direction;

    // C# Sprite.cs: MovedDistance += move.Length();
    this.movedDistance += Math.sqrt(moveX * moveX + moveY * moveY);

    // Update tile position
    const tile = pixelToTile(this._positionInWorld.x, this._positionInWorld.y);
    this._mapX = tile.x;
    this._mapY = tile.y;
  }

  /**
   * C# Sprite.cs: MoveTo(Vector2 direction, float elapsedSeconds)
   * Move character in a direction vector (not index)
   * The direction vector is normalized before use
   */
  moveToVector(direction: Vector2, elapsedSeconds: number): void {
    // C# Sprite.cs line 259-263: direction.Normalize(); MoveToNoNormalizeDirection(direction, elapsedSeconds)
    const len = Math.sqrt(direction.x * direction.x + direction.y * direction.y);
    if (len === 0) return;

    const normalizedDir = { x: direction.x / len, y: direction.y / len };

    // C#: ChangeMoveSpeedFold = 1 + AddMoveSpeedPercent / 100 (min -90%)
    const speedPercent = Math.max(MIN_CHANGE_MOVE_SPEED_PERCENT, this.addMoveSpeedPercent);
    const changeMoveSpeedFold = 1 + speedPercent / 100;
    // C# Sprite.cs line 267: var move = direction * _velocity * elapsedSeconds * speedRatio;
    const speed = BASE_SPEED * this.walkSpeed * changeMoveSpeedFold;
    const moveDistance = speed * elapsedSeconds;

    const moveX = normalizedDir.x * moveDistance;
    const moveY = normalizedDir.y * moveDistance;
    this._positionInWorld.x += moveX;
    this._positionInWorld.y += moveY;

    // Update direction for animation
    this.setDirectionFromDelta(normalizedDir.x, normalizedDir.y);

    // C# Sprite.cs: MovedDistance += move.Length();
    this.movedDistance += Math.sqrt(moveX * moveX + moveY * moveY);

    // Update tile position
    const tile = pixelToTile(this._positionInWorld.x, this._positionInWorld.y);
    this._mapX = tile.x;
    this._mapY = tile.y;
  }

  /**
   * C#: MoveAlongPath(elapsedSeconds, speedFold)
   * Move character along path
   *
   * 关键逻辑（C# 第 1760-1800 行）：
   * 在角色准备从当前瓦片移动到下一个瓦片时，检测下一个瓦片是否有障碍物。
   * 如果有障碍物，停止移动或重新寻路，而不是穿过障碍物。
   */
  moveAlongPath(deltaTime: number, speedFold: number = 1): CharacterUpdateResult {
    const result: CharacterUpdateResult = {
      moved: false,
      reachedDestination: false,
    };

    if (this.path.length === 0) {
      if (this._state === CharacterState.Walk || this._state === CharacterState.Run ||
          this._state === CharacterState.FightWalk || this._state === CharacterState.FightRun) {
        // C#: Use FightStand if in fighting mode
        if (this._isInFighting && this.isStateImageOk(CharacterState.FightStand)) {
          this.state = CharacterState.FightStand;
        } else {
          this.state = CharacterState.Stand;
        }
      }
      return result;
    }

    // Get next waypoint (path[0] is the next tile to move to)
    const tileTo = this.path[0];
    const tileFrom = { x: this._mapX, y: this._mapY };
    const targetPixel = tileToPixel(tileTo.x, tileTo.y);

    // C#: if (TilePosition == tileFrom && tileFrom != tileTo)
    // 当角色仍在当前瓦片，准备移动到下一个瓦片时，检测障碍物
    if (tileFrom.x !== tileTo.x || tileFrom.y !== tileTo.y) {
      if (this.hasObstacle(tileTo)) {
        // C#: Obstacle in the way - stop or repath
        this.movedDistance = 0;

        // C#: if (tileTo == DestinationMoveTilePosition) - Just one step, standing
        if (this._destinationMoveTilePosition &&
            tileTo.x === this._destinationMoveTilePosition.x &&
            tileTo.y === this._destinationMoveTilePosition.y) {
          this.path = [];
          this.standingImmediately();
          return result;
        }

        // C#: else if (PositionInWorld == MapBase.ToPixelPosition(TilePosition)) - At tile center, find new path
        const currentTilePixel = tileToPixel(tileFrom.x, tileFrom.y);
        const atTileCenter = Math.abs(this._positionInWorld.x - currentTilePixel.x) < 2 &&
                             Math.abs(this._positionInWorld.y - currentTilePixel.y) < 2;

        if (atTileCenter && this._destinationMoveTilePosition) {
          // At tile center - try to find a new path around the obstacle
          // C#: PathFinder.HasObstacle 调用 finder.HasObstacle
          const hasObstacleCheck = (tile: Vector2): boolean => this.hasObstacle(tile);
          // C#: GetObstacleIndexList 使用 MapBase.IsObstacleForCharacter 检查邻居（Obstacle + Trans）
          const isMapObstacle = (tile: Vector2): boolean => this.checkMapObstacleForCharacter(tile);
          // C#: GetObstacleIndexList 使用 MapBase.IsObstacle 检查对角线阻挡（只 Obstacle）
          const isHardObstacle = (tile: Vector2): boolean => this.checkHardObstacle(tile);

          const newPath = pathFinderFindPath(
            tileFrom,
            this._destinationMoveTilePosition,
            this.getPathType(),
            hasObstacleCheck,
            isMapObstacle,
            isHardObstacle,
            8
          );

          if (newPath.length === 0) {
            this.path = [];
            this.standingImmediately();
          } else {
            this.path = newPath.slice(1);
          }
        } else {
          // C#: Move back to tile center
          this._positionInWorld = { ...currentTilePixel };
          this.path = [];
          this.standingImmediately();
        }
        return result;
      }
    }

    // Calculate movement
    const dx = targetPixel.x - this._positionInWorld.x;
    const dy = targetPixel.y - this._positionInWorld.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist < 2) {
      // Reached waypoint
      this._positionInWorld = { ...targetPixel };
      this._mapX = tileTo.x;
      this._mapY = tileTo.y;
      this.path.shift();
      result.moved = true;

      if (this.path.length === 0) {
        // 到达路径终点 - C#: Use FightStand if in fighting mode
        if (this._isInFighting && this.isStateImageOk(CharacterState.FightStand)) {
          this.state = CharacterState.FightStand;
        } else {
          this.state = CharacterState.Stand;
        }
        result.reachedDestination = true;

        // C# Reference: After reaching destination, check for pending attacks
        this.onReachedDestination();
      }
    } else {
      // Move towards waypoint
      // C#: MoveAlongPath(deltaTime * ChangeMoveSpeedFold, speedFold)
      //     然后调用 MoveTo(direction, elapsedSeconds * speedFold)
      //     速度 = velocity * elapsedSeconds = 100 * deltaTime * ChangeMoveSpeedFold * speedFold
      // Walk时 speedFold = WalkSpeed, Run时 speedFold = RunSpeedFold (不同时乘!)
      const speedPercent = Math.max(MIN_CHANGE_MOVE_SPEED_PERCENT, this.addMoveSpeedPercent);
      const changeMoveSpeedFold = 1 + speedPercent / 100;
      const speed = BASE_SPEED * speedFold * changeMoveSpeedFold;
      const moveDistance = speed * deltaTime;
      const ratio = Math.min(1, moveDistance / dist);

      this._positionInWorld.x += dx * ratio;
      this._positionInWorld.y += dy * ratio;
      this._currentDirection = getDirection(this._positionInWorld, targetPixel);

      if (this._state !== CharacterState.Walk && this._state !== CharacterState.Run &&
          this._state !== CharacterState.FightWalk && this._state !== CharacterState.FightRun) {
        // C#: Use FightWalk if in fighting mode
        if (this._isInFighting && this.isStateImageOk(CharacterState.FightWalk)) {
          this.state = CharacterState.FightWalk;
        } else {
          this.state = CharacterState.Walk;
        }
      }
      result.moved = true;

      // Update tile position
      const newTile = pixelToTile(this._positionInWorld.x, this._positionInWorld.y);
      this._mapX = newTile.x;
      this._mapY = newTile.y;
    }

    return result;
  }

  /**
   * C#: WalkTo(destination, pathType)
   * Walk to a tile destination
   *
   * C# 逻辑：
   * if (IsWalking() && !IsInStepMove) {
   *   DestinationMoveTilePosition = destinationTilePosition;
   *   CancleAttackTarget();  // 取消攻击目标
   * } else { 重新寻路 }
   *
   * @param destTile Destination tile position
   * @param pathTypeOverride Optional PathType override (default uses character's pathType)
   */
  walkTo(destTile: Vector2, pathTypeOverride: PathType = PathType.End): boolean {
    if (this._mapX === destTile.x && this._mapY === destTile.y) {
      return true;
    }

    // C#: pathType == Engine.PathFinder.PathType.End ? PathType : pathType
    const usePathType = pathTypeOverride === PathType.End ? this.getPathType() : pathTypeOverride;

    // Create obstacle check functions using IEngineContext
    // C#: PathFinder.HasObstacle 会调用 finder.HasObstacle，所以这里也要调用 this.hasObstacle
    // 这样 NPC 寻路时会考虑玩家位置，Player 寻路时会考虑 NPC 位置
    const hasObstacleCheck = (tile: Vector2): boolean => {
      return this.hasObstacle(tile);
    };
    // C#: GetObstacleIndexList 使用 MapBase.IsObstacleForCharacter 检查邻居（Obstacle + Trans）
    const isMapObstacle = (tile: Vector2): boolean => {
      return this.checkMapObstacleForCharacter(tile);
    };
    // C#: GetObstacleIndexList 使用 MapBase.IsObstacle 检查对角线阻挡（只 Obstacle）
    const isHardObstacle = (tile: Vector2): boolean => {
      return this.checkHardObstacle(tile);
    };

    const path = pathFinderFindPath(
      { x: this._mapX, y: this._mapY },
      destTile,
      usePathType,
      hasObstacleCheck,
      isMapObstacle,
      isHardObstacle,
      8 // canMoveDirectionCount
    );

    if (path.length === 0) {
      this.path = [];
      this.state = CharacterState.Stand;
      return false;
    }

    // Path is tile coordinates, skip first element (current position)
    this.path = path.slice(1);
    this._destinationMoveTilePosition = { ...destTile };
    // C#: if (_isInFighting && IsStateImageOk(CharacterState.FightWalk)) SetState(CharacterState.FightWalk);
    // else SetState(CharacterState.Walk);
    if (this._isInFighting && this.isStateImageOk(CharacterState.FightWalk)) {
      this.state = CharacterState.FightWalk;
    } else {
      this.state = CharacterState.Walk;
    }
    return true;
  }

  /**
   * C#: RunTo(destination, pathType)
   * Run to a tile destination
   *
   * C# 逻辑：
   * if (IsRuning()) {
   *   DestinationMoveTilePosition = destinationTilePosition;
   * } else { 重新寻路 }
   *
   * @param destTile Destination tile position
   * @param pathTypeOverride Optional PathType override (default uses character's pathType)
   */
  runTo(destTile: Vector2, pathTypeOverride: PathType = PathType.End): boolean {
    if (this._mapX === destTile.x && this._mapY === destTile.y) {
      return true;
    }

    // C#: pathType == Engine.PathFinder.PathType.End ? PathType : pathType
    const usePathType = pathTypeOverride === PathType.End ? this.getPathType() : pathTypeOverride;

    // Create obstacle check functions using IEngineContext
    // C#: PathFinder.HasObstacle 会调用 finder.HasObstacle，所以这里也要调用 this.hasObstacle
    const hasObstacleCheck = (tile: Vector2): boolean => {
      return this.hasObstacle(tile);
    };
    // C#: GetObstacleIndexList 使用 MapBase.IsObstacleForCharacter 检查邻居（Obstacle + Trans）
    const isMapObstacle = (tile: Vector2): boolean => {
      return this.checkMapObstacleForCharacter(tile);
    };
    // C#: GetObstacleIndexList 使用 MapBase.IsObstacle 检查对角线阻挡（只 Obstacle）
    const isHardObstacle = (tile: Vector2): boolean => {
      return this.checkHardObstacle(tile);
    };

    const path = pathFinderFindPath(
      { x: this._mapX, y: this._mapY },
      destTile,
      usePathType,
      hasObstacleCheck,
      isMapObstacle,
      isHardObstacle,
      8
    );

    if (path.length === 0) {
      this.path = [];
      this.state = CharacterState.Stand;
      return false;
    }

    this.path = path.slice(1);
    this._destinationMoveTilePosition = { ...destTile };
    // C#: if (_isInFighting && IsStateImageOk(CharacterState.FightRun)) SetState(CharacterState.FightRun);
    // else SetState(CharacterState.Run);
    if (this._isInFighting && this.isStateImageOk(CharacterState.FightRun)) {
      this.state = CharacterState.FightRun;
    } else {
      this.state = CharacterState.Run;
    }
    return true;
  }

  /**
   * C#: WalkToDirection(direction, steps)
   * Walk in a direction for a number of steps
   */
  walkToDirection(direction: number, steps: number): void {
    const dirVectors = [
      { x: 0, y: -2 },
      { x: 1, y: -1 },
      { x: 1, y: 0 },
      { x: 1, y: 1 },
      { x: 0, y: 2 },
      { x: -1, y: 1 },
      { x: -1, y: 0 },
      { x: -1, y: -1 },
    ];

    const dir = dirVectors[direction] || { x: 0, y: 0 };
    const targetX = this._mapX + dir.x * steps;
    const targetY = this._mapY + dir.y * steps;

    this._currentDirection = direction;
    this.walkTo({ x: targetX, y: targetY });
  }

  /**
   * C# Reference: Character.JumpTo(Vector2 destinationTilePosition)
   * Jump to a specific tile position - used for both player and NPCs
   * @param destTile Destination tile position
   * @returns true if jump was initiated
   */
  jumpTo(destTile: Vector2): boolean {
    logger.log(
      `[Character.jumpTo] Starting jump from tile (${this._mapX}, ${this._mapY}) to (${destTile.x}, ${destTile.y})`
    );

    // C#: if (PerformActionOk() && destinationTilePosition != TilePosition)
    if (!this.performActionOk()) {
      logger.log(`[Character.jumpTo] Cannot perform action`);
      return false;
    }
    if (destTile.x === this._mapX && destTile.y === this._mapY) {
      logger.log(`[Character.jumpTo] Already at destination`);
      return false;
    }

    // C#: !MapBase.Instance.IsObstacleForCharacter(destinationTilePosition)
    if (this.checkMapObstacleForCharacter(destTile)) {
      logger.log(`[Character.jumpTo] Map obstacle at destination`);
      return false;
    }

    // C#: !HasObstacle(destinationTilePosition)
    if (this.hasObstacle(destTile)) {
      logger.log(`[Character.jumpTo] Character obstacle at destination`);
      return false;
    }

    // C#: (IsStateImageOk(CharacterState.FightJump) || IsStateImageOk(CharacterState.Jump))
    if (
      !this.isStateImageOk(CharacterState.Jump) &&
      !this.isStateImageOk(CharacterState.FightJump)
    ) {
      logger.log(`[Character.jumpTo] No jump animation available`);
      return false;
    }

    // C#: if (!CanJump()) return;
    if (!this.canJump()) {
      logger.log(`[Character.jumpTo] Cannot jump (canJump returned false)`);
      return false;
    }

    // C#: Check jump animations supporting current jump direction or not
    // (CanJumpDirCount check - simplified for now, assuming full 8-direction support)

    // C#: StateInitialize()
    this.stateInitialize();

    // C#: DestinationMoveTilePosition = destinationTilePosition;
    this._destinationMoveTilePosition = destTile;

    // C#: Path = new LinkedList<Vector2>();
    // Path.AddLast(PositionInWorld);
    // Path.AddLast(DestinationMovePositionInWorld);
    const startPixelPos = this.pixelPosition;
    const endPixelPos = tileToPixel(destTile.x, destTile.y);
    this.path = [startPixelPos, endPixelPos];
    this.movedDistance = 0;

    logger.log(
      `[Character.jumpTo] Path: from pixel (${startPixelPos.x}, ${startPixelPos.y}) to (${endPixelPos.x}, ${endPixelPos.y})`
    );

    // C#: if (_isInFighting && IsStateImageOk(CharacterState.FightJump)) SetState(CharacterState.FightJump);
    // else SetState(CharacterState.Jump);
    if (this._isInFighting && this.isStateImageOk(CharacterState.FightJump)) {
      this.state = CharacterState.FightJump;
    } else {
      this.state = CharacterState.Jump;
    }

    // C#: SetDirection(DestinationMovePositionInWorld - PositionInWorld);
    const dx = endPixelPos.x - startPixelPos.x;
    const dy = endPixelPos.y - startPixelPos.y;
    this.setDirectionFromDelta(dx, dy);

    // C#: PlayCurrentDirOnce();
    this.playCurrentDirOnce();

    logger.log(
      `[Character.jumpTo] Jump initiated, state=${this._state}, direction=${this._currentDirection}`
    );
    return true;
  }

  /**
   * C# Reference: Character.CanJump()
   * Check if character can jump - base implementation
   * Player overrides this to check thew and deduct it
   */
  protected canJump(): boolean {
    // C#: return !IsJumpDisabled && IsStateImageOk(CharacterState.Jump);
    return !this.isJumpDisabled && this.isStateImageOk(CharacterState.Jump);
  }

  /**
   * C#: PartnerMoveTo(destinationTilePosition)
   * Partner movement logic - run if far, walk if close
   * If distance > 20, reset partner position
   * If distance > 5, run
   * If distance > 2, run if already running else walk
   */
  partnerMoveTo(destinationTilePosition: Vector2): void {
    // C#: if (MapBase.Instance.IsObstacleForCharacter(destinationTilePosition)) return;
    if (this.checkMapObstacleForCharacter(destinationTilePosition)) {
      return;
    }

    const dist = this.getViewTileDistance(this.tilePosition, destinationTilePosition);

    if (dist > 20) {
      // C#: Globals.ThePlayer.ResetPartnerPosition()
      // Teleport to near destination as fallback (proper reset handled by Player)
      this.setPosition(destinationTilePosition.x, destinationTilePosition.y);
    } else if (dist > 5) {
      this.runTo(destinationTilePosition);
    } else if (dist > 2) {
      if (this.isRunning()) {
        this.runTo(destinationTilePosition);
      } else {
        this.walkTo(destinationTilePosition);
      }
    }
  }

  // === Random/Loop Walk ===

  /**
   * C#: GetRandTilePath(count, isFlyer, maxOffset)
   * Generate random tile path around current position
   *
   * This is a Character method in C#, used by NPC AI for random walking.
   * Protected to allow access from subclasses.
   */
  protected getRandTilePath(count: number, isFlyer: boolean, maxOffset: number = -1): Vector2[] {
    const path: Vector2[] = [{ x: this._mapX, y: this._mapY }];
    const maxTry = count * 3;

    if (maxOffset === -1) {
      maxOffset = isFlyer ? 15 : 10;
    }

    for (let i = 1; i < count; i++) {
      let attempts = maxTry;
      let foundValid = false;

      while (attempts > 0 && !foundValid) {
        attempts--;

        // Generate random offset
        const offsetX = Math.floor(Math.random() * (maxOffset * 2 + 1)) - maxOffset;
        const offsetY = Math.floor(Math.random() * (maxOffset * 2 + 1)) - maxOffset;
        const tilePosition = {
          x: this._mapX + offsetX,
          y: this._mapY + offsetY,
        };

        // Check if position is valid
        if (tilePosition.x === 0 && tilePosition.y === 0) continue;
        if (!isFlyer && !this.checkWalkable(tilePosition)) {
          continue;
        }

        path.push(tilePosition);
        foundValid = true;
      }

      if (!foundValid) break;
    }

    return path;
  }

  /**
   * C#: RandWalk(tilePositionList, randMaxValue, isFlyer)
   * Randomly walk to one of the positions in the list
   *
   * Protected Character method used by NPC AI.
   */
  protected randWalk(
    tilePositionList: Vector2[] | null,
    randMaxValue: number,
    _isFlyer: boolean
  ): void {
    if (tilePositionList === null || tilePositionList.length < 2 || !this.isStanding()) {
      return;
    }

    // C#: if (Globals.TheRandom.Next(0, randMaxValue) == 0)
    if (Math.floor(Math.random() * randMaxValue) === 0) {
      const randomIndex = Math.floor(Math.random() * tilePositionList.length);
      const tilePosition = tilePositionList[randomIndex];
      this.walkTo(tilePosition);
    }
  }

  /**
   * C#: LoopWalk(tilePositionList, randMaxValue, ref currentPathIndex, isFlyer)
   * Walk in a loop along fixed path positions
   *
   * Protected Character method used by NPC AI.
   * Note: currentPathIndex is managed per-character via _currentLoopWalkIndex
   */
  protected loopWalk(
    tilePositionList: Vector2[] | null,
    randMaxValue: number,
    _isFlyer: boolean
  ): void {
    if (tilePositionList === null || tilePositionList.length < 2) {
      return;
    }

    this._isInLoopWalk = true;

    if (this.isStanding() && Math.floor(Math.random() * randMaxValue) === 0) {
      this._currentLoopWalkIndex++;
      if (this._currentLoopWalkIndex > tilePositionList.length - 1) {
        this._currentLoopWalkIndex = 0;
      }
      this.walkTo(tilePositionList[this._currentLoopWalkIndex]);
    }
  }

  // C#: IsInLoopWalk - flag for loop walk state
  protected _isInLoopWalk: boolean = false;
  // C#: _currentFixedPosIndex - current index in FixedPos path for LoopWalk
  protected _currentLoopWalkIndex: number = 0;

  /**
   * C# Reference: Character.MoveAwayTarget(Vector2 targetPositionInWorld, int awayTileDistance, bool isRun)
   * Move away from target by specified tile distance
   * Used by casting NPCs to maintain optimal spell casting distance
   * @returns true if successfully started moving away, false if blocked
   */
  moveAwayTarget(targetPixelPosition: Vector2, awayTileDistance: number, isRun: boolean): boolean {
    if (awayTileDistance < 1) return false;

    // C#: var neighbor = PathFinder.FindDistanceTileInDirection(TilePosition, PositionInWorld - targetPositionInWorld, awayTileDistance);
    // Calculate direction away from target
    const myPixel = this.pixelPosition;
    const awayDirX = myPixel.x - targetPixelPosition.x;
    const awayDirY = myPixel.y - targetPixelPosition.y;

    // Find tile at desired distance in the away direction
    const neighbor = this.findDistanceTileInDirection(
      this.tilePosition,
      { x: awayDirX, y: awayDirY },
      awayTileDistance
    );

    // C#: if (HasObstacle(neighbor)) return false;
    if (this.hasObstacle(neighbor)) return false;
    if (this.checkMapObstacleForCharacter(neighbor)) return false;

    // C#: MoveToTarget(neighbor, isRun);
    if (isRun) {
      this.runToAndKeepingTarget(neighbor);
    } else {
      this.walkToAndKeepingTarget(neighbor);
    }

    // C#: if (Path == null) return false;
    if (!this.path || this.path.length === 0) {
      return false;
    }

    return true;
  }

  /**
   * C# Reference: PathFinder.FindDistanceTileInDirection
   * Find a tile at a specified distance in a given direction
   */
  protected findDistanceTileInDirection(
    fromTile: Vector2,
    direction: Vector2,
    distance: number
  ): Vector2 {
    // Normalize direction
    const len = Math.sqrt(direction.x * direction.x + direction.y * direction.y);
    if (len === 0) return fromTile;

    const normX = direction.x / len;
    const normY = direction.y / len;

    // Calculate target tile
    return {
      x: Math.round(fromTile.x + normX * distance),
      y: Math.round(fromTile.y + normY * distance),
    };
  }

  /**
   * C# Reference: Character.WalkToAndKeepingTarget
   * Walk to destination while keeping attack/interact target
   * 直接调用 walkTo 重新寻路，只保护攻击目标不被清除
   */
  walkToAndKeepingTarget(destTile: Vector2): boolean {
    // C#: save - save targets before calling WalkTo
    const savedAttackTile = this._destinationAttackTilePosition;
    const savedInteractTarget = this._interactiveTarget;
    const savedIsInteractRight = this._isInteractiveRightScript;

    // Perform walk - 重新寻路
    const result = this.walkTo(destTile);

    // C#: restore - restore targets
    this._destinationAttackTilePosition = savedAttackTile;
    this._interactiveTarget = savedInteractTarget;
    this._isInteractiveRightScript = savedIsInteractRight;

    return result;
  }

  /**
   * C# Reference: Character.RunToAndKeepingTarget
   * Run to destination while keeping attack/interact target
   * 直接调用 runTo 重新寻路，只保护攻击目标不被清除
   */
  runToAndKeepingTarget(destTile: Vector2): boolean {
    // C#: save - save targets before calling RunTo
    const savedAttackTile = this._destinationAttackTilePosition;
    const savedInteractTarget = this._interactiveTarget;
    const savedIsInteractRight = this._isInteractiveRightScript;

    // Perform run - 重新寻路
    const result = this.runTo(destTile);

    // C#: restore - restore targets
    this._destinationAttackTilePosition = savedAttackTile;
    this._interactiveTarget = savedInteractTarget;
    this._isInteractiveRightScript = savedIsInteractRight;

    return result;
  }

  /**
   * C# Reference: Character.AttackingIsOk(out Magic magicToUse)
   * Check if character is at the right distance to attack
   * For casting NPCs, handles moving to/away from target
   * @returns object with isOk and magicIni (if magic should be used)
   *
   * C# Logic:
   * - tileDistance == attackRadius && canSeeTarget -> return magicToUse != null
   * - tileDistance > attackRadius -> MoveToTarget, return false
   * - tileDistance < attackRadius -> MoveAwayTarget (for casting NPCs only), return false or magicToUse != null
   *
   * IMPORTANT: In C#, this returns true ONLY if a magic is available (magicToUse != null).
   * The "moveAway" logic is specifically for casting NPCs that need to maintain distance.
   * Characters without FlyInis (no configured magic) should NOT use moveAway logic.
   */
  /**
   * 1:1 复刻 C# Character.AttackingIsOk(out Magic magicToUse)
   *
   * C# 原版逻辑:
   * protected bool AttackingIsOk(out Magic magicToUse)
   * {
   *     magicToUse = null;
   *     if (DestinationAttackTilePosition != Vector2.Zero)
   *     {
   *         int tileDistance = Engine.PathFinder.GetViewTileDistance(TilePosition, DestinationAttackTilePosition);
   *         var attackRadius = GetClosedAttackRadius(tileDistance);
   *
   *         if (tileDistance == attackRadius)
   *         {
   *             var canSeeTarget = Engine.PathFinder.CanViewTarget(TilePosition,
   *                 DestinationAttackTilePosition, tileDistance);
   *
   *             if (canSeeTarget)
   *             {
   *                 magicToUse = GetRamdomMagicWithUseDistance(attackRadius);
   *                 return magicToUse != null;
   *             }
   *
   *             MoveToTarget(DestinationAttackTilePosition, _isRunToTarget);
   *         }
   *         if (tileDistance > attackRadius)
   *         {
   *             MoveToTarget(DestinationAttackTilePosition, _isRunToTarget);
   *         }
   *         else
   *         {
   *             // Attack distance too small, move away target
   *             if (!MoveAwayTarget(DestinationAttackPositionInWorld,
   *                 attackRadius - tileDistance,
   *                 _isRunToTarget))
   *             {
   *                 magicToUse = GetRamdomMagicWithUseDistance(attackRadius);
   *                 return magicToUse != null;
   *             }
   *         }
   *     }
   *     return false;
   * }
   *
   * 注意：C# 代码中 if (tileDistance == attackRadius) 和 if (tileDistance > attackRadius) 不是互斥的，
   * 所以如果 tileDistance == attackRadius 且 canSeeTarget 为 false，会先调用 MoveToTarget，
   * 然后因为 tileDistance > attackRadius 为 false，进入 else 分支调用 MoveAwayTarget。
   *
   * 为了避免这个 bug（双重移动），我们修正逻辑为互斥的 if-else-if 结构。
   */
  attackingIsOk(): { isOk: boolean; magicIni: string | null } {
    // C#: if (DestinationAttackTilePosition != Vector2.Zero)
    if (!this._destinationAttackTilePosition) {
      return { isOk: false, magicIni: null };
    }

    // C#: int tileDistance = Engine.PathFinder.GetViewTileDistance(TilePosition, DestinationAttackTilePosition);
    const tileDistance = this.getViewTileDistance(
      this.tilePosition,
      this._destinationAttackTilePosition
    );
    // C#: var attackRadius = GetClosedAttackRadius(tileDistance);
    const attackRadius = this.getClosedAttackRadius(tileDistance);

    // C#: if (tileDistance == attackRadius)
    if (tileDistance === attackRadius) {
      // C#: var canSeeTarget = Engine.PathFinder.CanViewTarget(...)
      const canSeeTarget = this.canViewTarget(
        this.tilePosition,
        this._destinationAttackTilePosition,
        tileDistance
      );

      if (canSeeTarget) {
        // C#: magicToUse = GetRamdomMagicWithUseDistance(attackRadius);
        // C#: return magicToUse != null;
        const magicIni = this.getRandomMagicWithUseDistance(attackRadius);
        // 对于没有配置 magic 的近战角色，允许攻击
        const hasMagic = this._flyIniInfos.length > 0;
        if (magicIni !== null || !hasMagic) {
          return { isOk: true, magicIni };
        }
        return { isOk: false, magicIni: null };
      }

      // C#: MoveToTarget(DestinationAttackTilePosition, _isRunToTarget);
      // 看不到目标，移动过去
      this.moveToTarget(this._destinationAttackTilePosition, this._isRunToTarget);
      return { isOk: false, magicIni: null };
    }

    // C#: if (tileDistance > attackRadius) - 太远，移动靠近
    if (tileDistance > attackRadius) {
      // C#: MoveToTarget(DestinationAttackTilePosition, _isRunToTarget);
      this.moveToTarget(this._destinationAttackTilePosition, this._isRunToTarget);
      return { isOk: false, magicIni: null };
    }

    // C#: else - 太近 (tileDistance < attackRadius)，需要拉开距离
    // C#: Attack distance too small, move away target
    // 注意：对于玩家（没有配置 FlyInis 的近战角色），允许近距离攻击
    const hasMagic = this._flyIniInfos.length > 0;
    if (!hasMagic) {
      // 近战角色，允许任何近距离攻击
      return { isOk: true, magicIni: null };
    }

    // 有 magic 配置的施法角色，需要保持距离
    // C#: else - 太近 (tileDistance < attackRadius)，需要拉开距离
    const destPixel = tileToPixel(
      this._destinationAttackTilePosition.x,
      this._destinationAttackTilePosition.y
    );
    // C#: if (!MoveAwayTarget(DestinationAttackPositionInWorld, attackRadius - tileDistance, _isRunToTarget))
    if (!this.moveAwayTarget(destPixel, attackRadius - tileDistance, this._isRunToTarget)) {
      // C#: 无法后退，就原地攻击
      // C#: magicToUse = GetRamdomMagicWithUseDistance(attackRadius);
      // C#: return magicToUse != null;
      const magicIni = this.getRandomMagicWithUseDistance(attackRadius);
      return { isOk: magicIni !== null, magicIni };
    }

    // C#: return false;
    return { isOk: false, magicIni: null };
  }

  /**
   * C# Reference: Character.MoveToTarget
   * Move to target tile, keeping attack/interact targets
   */
  protected moveToTarget(destTile: Vector2, isRun: boolean): void {
    if (isRun) {
      this.runToAndKeepingTarget(destTile);
    } else {
      this.walkToAndKeepingTarget(destTile);
    }
  }

  // C#: _isRunToTarget - whether to run when moving to target
  protected _isRunToTarget: boolean = false;

  /**
   * C#: SetDirection(positionInWorld - PositionInWorld)
   * Set direction based on a delta vector (e.g., direction to target)
   * Used when interacting to face each other
   * Note: Character uses 8-direction system with getDirectionFromVector
   */
  setDirectionFromDelta(dx: number, dy: number): void {
    // Use getDirectionFromVector utility which returns 8-direction based on angle
    this._currentDirection = getDirectionFromVector({ x: dx, y: dy });
  }

  /**
   * C#: StandingImmediately()
   * Stop movement immediately
   * C# Reference: if (IsDeathInvoked || IsDeath) return;
   * C# Reference: StateInitialize() sets IsSitted = false
   */
  standingImmediately(): void {
    // C#: Dead characters should not change state
    if (this.isDeathInvoked || this.isDeath) {
      return;
    }
    this.path = [];
    this.isSitted = false;
    // C#: if (_isInFighting && IsStateImageOk(CharacterState.FightStand)) SetState(CharacterState.FightStand);
    if (this._isInFighting && this.isStateImageOk(CharacterState.FightStand)) {
      this.state = CharacterState.FightStand;
    } else {
      // C#: 25% 概率触发 Stand1（如果有的话）
      // if (IsStateImageOk(CharacterState.Stand1) && Globals.TheRandom.Next(4) == 1 && State != Stand1)
      //     SetState(CharacterState.Stand1);
      // else SetState(CharacterState.Stand);
      if (
        this.isStateImageOk(CharacterState.Stand1) &&
        Math.random() < 0.25 &&
        this._state !== CharacterState.Stand1
      ) {
        this.state = CharacterState.Stand1;
      } else {
        this.state = CharacterState.Stand;
      }
    }
  }

  /**
   * C#: ToNonFightingState()
   * Exit combat mode
   */
  toNonFightingState(): void {
    this._isInFighting = false;
    if (this.isWalking()) this.state = CharacterState.Walk;
    if (this.isRunning()) this.state = CharacterState.Run;
    if (this._state === CharacterState.FightStand) this.state = CharacterState.Stand;
  }

  /**
   * C#: ToFightingState()
   * Enter combat mode
   */
  toFightingState(): void {
    this._isInFighting = true;
    this._totalNonFightingSeconds = 0;
  }

  /**
   * C#: SetFightState(bool isFight)
   * Set whether character is in fighting state
   */
  setFightState(isFight: boolean): void {
    if (isFight) {
      this.toFightingState();
      this.state = CharacterState.FightStand;
    } else {
      this.toNonFightingState();
      this.state = CharacterState.Stand;
    }
  }

  /**
   * C#: FullLife()
   * Restore full health and reset death state
   */
  fullLife(): void {
    this.life = this.lifeMax;
    this.isDeath = false;
    this.isDeathInvoked = false;
    this.isBodyIniAdded = 0;
  }

  /**
   * C#: FullThew()
   */
  fullThew(): void {
    this.thew = this.thewMax;
  }

  /**
   * C#: FullMana()
   */
  fullMana(): void {
    this.mana = this.manaMax;
  }

  /**
   * Add life (can be negative for damage)
   * C#: AddLife(int amount) - 如果生命值 <= 0 则触发死亡
   */
  addLife(amount: number): void {
    this.life = Math.max(0, Math.min(this.life + amount, this.lifeMax));
    if (this.life <= 0) {
      this.onDeath(null);
    }
  }

  /**
   * Add thew
   */
  addThew(amount: number): void {
    this.thew = Math.max(0, Math.min(this.thew + amount, this.thewMax));
  }

  /**
   * Add mana
   */
  addMana(amount: number): void {
    this.mana = Math.max(0, Math.min(this.mana + amount, this.manaMax));
  }

  /**
   * Add experience - for NPC partners that can level up
   * C# Reference: Character.AddExp
   *
   * Note: 只有 CanLevelUp > 0 的 NPC 才会处理经验（如伙伴）
   * Player 类会覆盖此方法实现更复杂的升级逻辑
   */
  addExp(amount: number): void {
    if (this.levelUpExp <= 0 || this.canLevelUp <= 0) return;

    this.exp += amount;
    if (this.exp > this.levelUpExp) {
      // TODO: 实现 NPC 升级逻辑
      // GuiManager.ShowMessage(Name + "的等级提升了");
      // ToLevel(Exp);
    }
  }

  /**
   * 计算击杀经验
   * C# Reference: Utils.GetCharacterDeathExp(theKiller, theDead)
   * exp = killer.Level * dead.Level + dead.ExpBonus
   * 最小值为 4
   */
  static getCharacterDeathExp(killer: Character, dead: Character): number {
    if (!killer || !dead) return 1;
    const exp = killer.level * dead.level + (dead.expBonus ?? 0);
    return exp < 4 ? 4 : exp;
  }

  /**
   * Is character dead
   */
  isDead(): boolean {
    return this.life <= 0;
  }

  /**
   * Take damage from an attacker
   * C# Reference: MagicSprite.CharacterHited + Character.DecreaseLifeAddHurt
   *
   * Full implementation with hit rate calculation based on evade stats
   */
  takeDamage(damage: number, attacker: Character | null): void {
    if (this.isDeathInvoked || this.isDeath) return;

    // C#: if (amount <= 0 || Invincible > 0 || Life <= 0) return;
    if (damage <= 0 || this.invincible > 0 || this.life <= 0) return;

    // C# Reference: 检查 SpecialKind=6 免疫盾
    for (const sprite of this._magicSpritesInEffect) {
      if (sprite.magic.moveKind === 13 && sprite.magic.specialKind === 6) {
        return;
      }
    }

    // C#: Track last attacker for CheckKeepDistanceWhenFriendDeath AI
    this._lastAttacker = attacker;

    // ============= Hit Rate Calculation =============
    // C# Reference: MagicSprite.CharacterHited - 使用 RealEvade

    const targetEvade = this.realEvade;
    const attackerEvade = attacker?.realEvade ?? 0;
    const maxOffset = 100;
    const baseHitRatio = 0.05;
    const belowRatio = 0.5;
    const upRatio = 0.45;

    let hitRatio = baseHitRatio;
    if (targetEvade >= attackerEvade) {
      // Target has higher or equal evade
      // hitRatio += (attackerEvade / targetEvade) * belowRatio
      // Range: 5% - 55%
      if (targetEvade > 0) {
        hitRatio += (attackerEvade / targetEvade) * belowRatio;
      } else {
        hitRatio += belowRatio;
      }
    } else {
      // Attacker has higher evade
      // hitRatio += belowRatio + ((attackerEvade - targetEvade) / maxOffset) * upRatio
      // Range: 55% - 100%
      let upOffsetRatio = (attackerEvade - targetEvade) / maxOffset;
      if (upOffsetRatio > 1) upOffsetRatio = 1;
      hitRatio += belowRatio + upOffsetRatio * upRatio;
    }

    // Roll for hit
    const roll = Math.random();
    if (roll > hitRatio) {
      // Miss!
      logger.log(
        `[Character] ${attacker?.name || "Unknown"} missed ${this.name} (roll ${(roll * 100).toFixed(1)}% > ${(hitRatio * 100).toFixed(1)}% hit rate)`
      );
      return;
    }

    // === Damage ===
    // C# Reference: MagicSprite.CharacterHited
    // effect = damage - character.RealDefend
    // if (effect < MinimalDamage) effect = MinimalDamage
    let actualDamage = Math.max(0, damage - this.realDefend);

    // C# Reference: MagicSpritesInEffect 护盾减伤 (SpecialKind=3)
    for (const sprite of this._magicSpritesInEffect) {
      if (sprite.magic.moveKind === 13 && sprite.magic.specialKind === 3) {
        const shieldEffect = (sprite.magic.effect === 0 ? this.attack : sprite.magic.effect) + (sprite.magic.effectExt || 0);
        actualDamage -= shieldEffect;
      }
    }

    // MinimalDamage = 5
    const minimalDamage = 5;
    if (actualDamage < minimalDamage) {
      actualDamage = minimalDamage;
    }

    // Cap damage to current life
    if (actualDamage > this.life) {
      actualDamage = this.life;
    }

    // Apply damage
    this.life -= actualDamage;

    logger.log(
      `[Character] ${this.name} took ${actualDamage} damage from ${attacker?.name || "Unknown"} (${this.life}/${this.lifeMax} HP, hit rate: ${(hitRatio * 100).toFixed(1)}%)`
    );

    // Trigger reactive effects (e.g., MagicToUseWhenBeAttacked)
    this.onDamaged(attacker, actualDamage);

    // Check for death
    if (this.life <= 0) {
      this.life = 0;

      // === 给击杀者增加经验 ===
      // C# Reference: MagicSprite.CharacterHited - 经验处理
      // 只有玩家或玩家友军击杀敌人时才给经验
      // 注意: 武功击杀时经验在 MagicManager.handleExpOnHit 中处理，
      //       这里处理的是普通攻击 (takeDamage) 造成的击杀
      if (attacker && (attacker.isPlayer || attacker.isFighterFriend)) {
        const player = this.engine?.getPlayer();
        if (player) {
          const exp = Character.getCharacterDeathExp(player as Character, this);
          player.addExp(exp, true);
          logger.log(`[Character] Player gains ${exp} exp from killing ${this.name}`);

          // 如果击杀者是伙伴且可以升级，也给伙伴经验
          if (attacker.isPartner && attacker.canLevelUp > 0) {
            const partnerExp = Character.getCharacterDeathExp(attacker, this);
            attacker.addExp(partnerExp);
            logger.log(`[Character] Partner ${attacker.name} gains ${partnerExp} exp`);
          }
        }
      }

      this.onDeath(attacker);
    } else {
      // Play hurt animation
      this.hurting();
    }
  }

  /**
   * Take damage with full damage types (damage, damage2, damage3, damageMana)
   * C# Reference: MagicSprite.CharacterHited - full version
   */
  takeDamageFromMagic(
    damage: number,
    damage2: number,
    damage3: number,
    damageMana: number,
    attacker: Character | null
  ): number {
    if (this.isDeathInvoked || this.isDeath) return 0;
    if (this.invincible > 0 || this.life <= 0) return 0;

    this._lastAttacker = attacker;

    // C# Reference: 检查 SpecialKind=6 免疫盾
    // foreach (var magicSprite in MagicSpritesInEffect)
    //   if (magic.MoveKind == 13 && magic.SpecialKind == 6) return;
    for (const sprite of this._magicSpritesInEffect) {
      if (sprite.magic.moveKind === 13 && sprite.magic.specialKind === 6) {
        // 有免疫盾，完全不受伤害
        return 0;
      }
    }

    // ============= Hit Rate Calculation =============
    // C# Reference: 使用 RealEvade 而非 _evade
    const targetEvade = this.realEvade;
    const attackerEvade = attacker?.realEvade ?? 0;
    const maxOffset = 100;
    const baseHitRatio = 0.05;
    const belowRatio = 0.5;
    const upRatio = 0.45;

    let hitRatio = baseHitRatio;
    if (targetEvade >= attackerEvade) {
      if (targetEvade > 0) {
        hitRatio += (attackerEvade / targetEvade) * belowRatio;
      } else {
        hitRatio += belowRatio;
      }
    } else {
      let upOffsetRatio = (attackerEvade - targetEvade) / maxOffset;
      if (upOffsetRatio > 1) upOffsetRatio = 1;
      hitRatio += belowRatio + upOffsetRatio * upRatio;
    }

    const roll = Math.random();
    if (roll > hitRatio) {
      logger.log(`[Character] ${attacker?.name || "Unknown"} magic missed ${this.name}`);
      return 0;
    }

    // === Multi-type Damage ===
    // C# Reference: effect3 = damage3 - character.Defend3; etc.
    // C# 允许负值，只在最后判断最小伤害
    let effect = damage - this.realDefend;
    let effect2 = damage2 - this.defend2;
    let effect3 = damage3 - this.defend3;

    // C# Reference: MagicSpritesInEffect 护盾减伤 (SpecialKind=3)
    // GetEffectAmount(magic, character) 中 character 是被保护角色 (this)
    for (const sprite of this._magicSpritesInEffect) {
      if (sprite.magic.moveKind === 13 && sprite.magic.specialKind === 3) {
        // C# MagicManager.GetEffectAmount - 包含 AddMagicEffect 加成
        const m = sprite.magic;
        const damageReduce = getEffectAmount(m, this, "effect");
        const damageReduce2 = getEffectAmount(m, this, "effect2");
        const damageReduce3 = getEffectAmount(m, this, "effect3");
        effect3 -= damageReduce3;
        effect2 -= damageReduce2;
        effect -= damageReduce;
      }
    }

    // Combine damage types
    // C#: if (effect3 > 0) effect += effect3; if (effect2 > 0) effect += effect2;
    let totalEffect = effect;
    if (effect3 > 0) totalEffect += effect3;
    if (effect2 > 0) totalEffect += effect2;

    // MinimalDamage = 5
    if (totalEffect < 5) totalEffect = 5;
    if (totalEffect > this.life) totalEffect = this.life;

    this.life -= totalEffect;

    // Mana damage
    if (damageMana > 0 && this.mana > 0) {
      this.mana = Math.max(0, this.mana - damageMana);
    }

    logger.log(
      `[Character] ${this.name} took ${totalEffect} magic damage (${this.life}/${this.lifeMax} HP)`
    );

    // Trigger reactive effects (e.g., MagicToUseWhenBeAttacked)
    this.onDamaged(attacker, totalEffect);

    if (this.life <= 0) {
      this.life = 0;
      this.onDeath(attacker);
    } else {
      this.hurting();
    }

    // 返回实际造成的伤害（用于吸血等效果）
    return totalEffect;
  }

  /**
   * Play hurt animation
   * C# Reference: Character.Hurting()
   *
   * C# 原版逻辑：
   * 1. 只有 25% 概率播放受伤动画（随机）
   * 2. 石化状态下不播放
   * 3. 使用魔法且有 NoInterruption 时不播放
   * 4. 已经在死亡/受伤状态时不重复
   * 5. 检查是否有 Hurt 动画图像
   */
  hurting(): void {
    // C#: if (Globals.TheRandom.Next(maxRandValue) != 0) return;
    // 只有 25% 概率播放受伤动画
    const maxRandValue = 4;
    if (Math.floor(Math.random() * maxRandValue) !== 0) {
      return;
    }

    // C#: IsPetrified - 石化时不能受伤（为了游戏可玩性）
    if (this.petrifiedSeconds > 0) {
      return;
    }

    // C#: (State == (int)CharacterState.Magic && MagicUse != null && MagicUse.NoInterruption > 0)
    // 使用魔法且有无中断属性时不播放（NoInterruption 检查在子类中实现）
    if (this._state === CharacterState.Magic && this.isNoInterruptionMagic()) {
      return;
    }

    // C#: State != Death && State != Hurt && !IsPetrified
    if (
      this._state === CharacterState.Death ||
      this._state === CharacterState.Hurt ||
      this.isDeathInvoked ||
      this.isDeath
    ) {
      return;
    }

    // C#: StateInitialize(); TilePosition = TilePosition;
    this.stateInitialize();

    // C#: if (IsStateImageOk(CharacterState.Hurt))
    if (this.isStateImageOk(CharacterState.Hurt)) {
      this.state = CharacterState.Hurt;
      // C#: PlayCurrentDirOnce();
      this.playCurrentDirOnce();
    }
  }

  /**
   * Check if currently using a magic with NoInterruption > 0
   * Override in subclasses that have magic usage tracking
   * C# Reference: MagicUse != null && MagicUse.NoInterruption > 0
   */
  protected isNoInterruptionMagic(): boolean {
    return false;
  }

  /**
   * Called when character takes damage (after damage is applied)
   * Hook for subclasses to implement reactive effects (e.g., MagicToUseWhenBeAttacked)
   * C# Reference: MagicSprite.CharacterHited triggers MagicToUseWhenBeAttacked
   *
   * @param attacker The character that dealt the damage (can be null)
   * @param damage The actual damage dealt
   */
  protected onDamaged(_attacker: Character | null, _damage: number): void {
    // Override in subclasses for reactive effects
  }

  /**
   * Called when character dies
   * C#: Character.Death() - sets state, plays animation once, runs death script
   */
  protected onDeath(killer: Character | null): void {
    if (this.isDeathInvoked) return;
    this.isDeathInvoked = true;

    logger.log(`[Character] ${this.name} died${killer ? ` (killed by ${killer.name})` : ""}`);

    // C#: StateInitialize() - reset state-related flags
    this.endPlayCurrentDirOnce();

    // C#: SetState(CharacterState.Death)
    this.state = CharacterState.Death;

    // C#: PlayCurrentDirOnce() - play death animation exactly once
    // This is crucial! Without this, _leftFrameToPlay stays 0 and
    // isPlayCurrentDirOnceEnd() returns true immediately
    this.playCurrentDirOnce();
  }

  /**
   * Public death method for external calls (e.g., LifeMilliseconds timeout)
   * C# Reference: Character.Death()
   */
  death(): void {
    this.onDeath(null);
  }

  /**
   * C#: Update(gameTime)
   * State-machine driven update - based on C# Character.cs switch ((CharacterState)State)
   * Each state has its own update method that subclasses can override
   */
  override update(deltaTime: number): void {
    if (!this._isVisible) return;

    const deltaMs = deltaTime * 1000;

    // === LifeMilliseconds - 召唤物存活时间 ===
    // C# Reference: Character.Update - if (_lifeMilliseconds > 0)
    if (this._lifeMilliseconds > 0) {
      this._lifeMilliseconds -= deltaMs;
      if (this._lifeMilliseconds <= 0) {
        this.death();
        return;
      }
    }

    // === ChangeToOpposite - 变换阵营时间 ===
    // C# Reference: Character.Update - if (_changeToOppositeMilliseconds > 0)
    if (this._changeToOppositeMilliseconds > 0) {
      this._changeToOppositeMilliseconds -= deltaMs;
      if (this._changeToOppositeMilliseconds < 0) {
        this._changeToOppositeMilliseconds = 0;
      }
    }

    // === WeakBy - 弱化效果时间 ===
    // C# Reference: Character.Update - if (_weakByMagicSpriteTime > 0)
    if (this._weakByMagicSpriteTime > 0) {
      this._weakByMagicSpriteTime -= deltaMs;
      if (this._weakByMagicSpriteTime <= 0) {
        this._weakByMagicSpriteTime = 0;
        this._weakByMagicSprite = null;
      }
    }

    // === SpeedUpByMagicSprite - 加速效果检查 ===
    // C# Reference: Character.Update - if (SppedUpByMagicSprite != null)
    if (this.speedUpByMagicSprite !== null) {
      if (this.speedUpByMagicSprite.isInDestroy || this.speedUpByMagicSprite.isDestroyed) {
        this.speedUpByMagicSprite = null;
      }
    }

    // === ChangeCharacter - 变身效果时间 ===
    // C# Reference: Character.Update - if (_changeCharacterByMagicSpriteTime > 0)
    if (this._changeCharacterByMagicSpriteTime > 0) {
      this._changeCharacterByMagicSpriteTime -= deltaMs;
      if (this._changeCharacterByMagicSpriteTime <= 0) {
        // TODO: OnRecoverFromReplaceMagicList(_changeCharacterByMagicSprite.BelongMagic)
        this._changeCharacterByMagicSpriteTime = 0;
        this._changeCharacterByMagicSprite = null;
        // C#: SetState((CharacterState)State, true);
        this.state = this._state;
      }
    }

    // === ChangeFlyIni - 飞行INI替换检查 ===
    // C# Reference: Character.Update - if (_changeFlyIniByMagicSprite != null && IsInDestroy/IsDestroyed)
    if (
      this._changeFlyIniByMagicSprite !== null &&
      (this._changeFlyIniByMagicSprite.isInDestroy || this._changeFlyIniByMagicSprite.isDestroyed)
    ) {
      this._changeFlyIniByMagicSprite = null;
    }

    // === Status Effects Update ===
    // C#: DisableMoveMilliseconds, DisableSkillMilliseconds countdown
    if (this.disableMoveMilliseconds > 0) {
      this.disableMoveMilliseconds -= deltaMs;
    }
    if (this.disableSkillMilliseconds > 0) {
      this.disableSkillMilliseconds -= deltaMs;
    }

    // C#: InvisibleByMagicTime - 隐身时间倒计时
    if (this.invisibleByMagicTime > 0) {
      this.invisibleByMagicTime -= deltaMs;
      if (this.invisibleByMagicTime <= 0) {
        this.invisibleByMagicTime = 0;
      }
    }

    // === SpeedUp GameTime Fold ===
    // C# Reference: Character.Update - 如果有加速效果，使用加速后的 gameTime
    // if (SppedUpByMagicSprite != null || _changeCharacterByMagicSprite != null) {
    //   var fold = (100 + RangeSpeedUp + SpeedAddPercent) / 100f;
    //   gameTime = new GameTime(ticks * fold);
    // }
    let speedFold = 1.0;
    if (this.speedUpByMagicSprite !== null || this._changeCharacterByMagicSprite !== null) {
      let percent = 100;
      if (this.speedUpByMagicSprite !== null) {
        percent += this.speedUpByMagicSprite.magic.rangeSpeedUp || 0;
      }
      if (this._changeCharacterByMagicSprite !== null) {
        percent += this._changeCharacterByMagicSprite.magic.speedAddPercent || 0;
      }
      speedFold = percent / 100;
    }
    const foldedDeltaTime = deltaTime * speedFold;

    // C#: PoisonSeconds - 中毒每 250ms 扣 10 HP
    if (this.poisonSeconds > 0) {
      this.poisonSeconds -= foldedDeltaTime;
      this._poisonedMilliSeconds += foldedDeltaTime * 1000;
      if (this._poisonedMilliSeconds > 250) {
        this._poisonedMilliSeconds = 0;
        this.addLife(-10);
        // C#: 中毒致死时给投毒者加经验
        // if (PoisonByCharacterName == Globals.ThePlayer.Name) { player.AddExp(exp, true); }
        // else { npc.AddExp(exp); }
        if (this.isDeathInvoked && this.poisonByCharacterName) {
          const player = this.engine?.getPlayer();
          // C#: exp = killer.Level * dead.Level + dead.ExpBonus, min 4
          const calcExp = (killer: Character, dead: Character): number => {
            const exp = killer.level * dead.level + (dead.expBonus ?? 0);
            return exp < 4 ? 4 : exp;
          };
          if (player && this.poisonByCharacterName === player.name) {
            // 玩家投毒致死
            const exp = calcExp(player as Character, this);
            player.addExp(exp, true);
          } else if (this.poisonByCharacterName) {
            // NPC 投毒致死
            const npcManager = this.engine?.getNpcManager();
            const poisoner = npcManager?.getNpc(this.poisonByCharacterName);
            if (poisoner && poisoner.canLevelUp > 0) {
              const exp = calcExp(poisoner as Character, this);
              poisoner.addExp(exp);
            }
          }
          this.poisonByCharacterName = "";
        }
      }
      if (this.poisonSeconds <= 0) {
        this.poisonByCharacterName = "";
      }
    }

    // C#: PetrifiedSeconds - 石化时完全停止，直接返回
    if (this.petrifiedSeconds > 0) {
      this.petrifiedSeconds -= foldedDeltaTime;
      return;
    }

    // C#: FrozenSeconds - 冻结时减速（时间减半）
    let effectiveDeltaTime = foldedDeltaTime;
    if (this.frozenSeconds > 0) {
      this.frozenSeconds -= foldedDeltaTime;
      effectiveDeltaTime = foldedDeltaTime / 2; // 冻结时动作减速
    }

    // C#: if (IsInSpecialAction) { base.Update(); if (IsPlayCurrentDirOnceEnd()) ... return; }
    if (this.isInSpecialAction) {
      super.update(effectiveDeltaTime);
      if (this.isPlayCurrentDirOnceEnd()) {
        this.isInSpecialAction = false;
        this.endSpecialAction();
        this._currentDirection = this.specialActionLastDirection;
      }
      return;
    }

    // C#: switch ((CharacterState)State)
    // 使用 effectiveDeltaTime 以支持冻结减速效果
    switch (this._state) {
      case CharacterState.Walk:
      case CharacterState.FightWalk:
        this.updateWalking(effectiveDeltaTime);
        break;

      case CharacterState.Run:
      case CharacterState.FightRun:
        this.updateRunning(effectiveDeltaTime);
        break;

      case CharacterState.Jump:
      case CharacterState.FightJump:
        this.updateJumping(effectiveDeltaTime);
        break;

      case CharacterState.Sit:
        this.updateSitting(effectiveDeltaTime);
        break;

      case CharacterState.Attack:
      case CharacterState.Attack1:
      case CharacterState.Attack2:
        this.updateAttacking(effectiveDeltaTime);
        break;

      case CharacterState.Magic:
        this.updateMagic(effectiveDeltaTime);
        break;

      case CharacterState.Stand:
      case CharacterState.Stand1:
      case CharacterState.Hurt:
        // C#: Stand/Stand1/Hurt 在动画结束后调用 StandingImmediately()
        // 这样 Stand1 动画播完后会切换回 Stand（可能再随机触发 Stand1）
        this.updateStandOrHurt(effectiveDeltaTime);
        break;

      case CharacterState.Death:
        this.updateDeath(effectiveDeltaTime);
        break;

      default:
        // FightStand 落入这里，只是普通更新，不在动画结束后切换
        this.updateStanding(effectiveDeltaTime);
        break;
    }

    // C#: 战斗超时检测 - 超过 7 秒无战斗动作则自动退出战斗状态
    // if (_isInFighting) { _totalNonFightingSeconds += ...; if > MaxNonFightSeconds => ToNonFightingState(); }
    if (this._isInFighting) {
      this._totalNonFightingSeconds += effectiveDeltaTime;
      if (this._totalNonFightingSeconds > MAX_NON_FIGHT_SECONDS) {
        this.toNonFightingState();
      }
    }
  }

  // === State Update Hooks ===

  /**
   * Update walking state
   * C#: case CharacterState.Walk/FightWalk - MoveAlongPath + Update with WalkSpeed
   */
  protected updateWalking(deltaTime: number): void {
    this.moveAlongPath(deltaTime, this.walkSpeed);
    super.update(deltaTime);
  }

  /**
   * Update running state
   * C#: case CharacterState.Run/FightRun - MoveAlongPath with RunSpeedFold
   */
  protected updateRunning(deltaTime: number): void {
    this.moveAlongPath(deltaTime, RUN_SPEED_FOLD);
    super.update(deltaTime);
  }

  /**
   * Update jumping state
   * C#: case CharacterState.Jump/FightJump - JumpAlongPath
   * C# Reference: Character.JumpAlongPath(float elapsedSeconds)
   * Note: Animation end check is done inside jumpAlongPath, not here
   */
  protected updateJumping(deltaTime: number): void {
    this.jumpAlongPath(deltaTime);
    super.update(deltaTime);
  }

  /**
   * C# Reference: Character.JumpAlongPath(float elapsedSeconds)
   * Move along jump path with 8x speed multiplier
   * Jump is faster than running and has different obstacle checking
   */
  protected jumpAlongPath(deltaTime: number): void {
    // C#: if (Path == null) { StandingImmediately(); return; }
    if (!this.path) {
      this.standingImmediately();
      return;
    }

    // C#: if (DisableMoveMilliseconds > 0) { return; }
    // (skipped - not implemented yet)

    // C#: if (Path.Count == 2)
    if (this.path.length === 2) {
      const from = this.path[0];
      const to = this.path[1];
      const totalDistance = Math.sqrt(
        (to.x - from.x) * (to.x - from.x) + (to.y - from.y) * (to.y - from.y)
      );

      let isOver = false;

      // C#: var nextTile = PathFinder.FindNeighborInDirection(TilePosition, to - from);
      const dirX = to.x - from.x;
      const dirY = to.y - from.y;
      const nextTile = this.findNeighborInDirection(this.tilePosition, { x: dirX, y: dirY });

      // C#: Check obstacles for jump (different from walking obstacles)
      // MapBase.Instance.IsObstacleForCharacterJump(nextTile)
      // (nextTile == MapBase.ToTilePosition(to) && HasObstacle(nextTile))
      // MapBase.Instance.HasTrapScript(TilePosition)
      // NpcManager.GetEventer(nextTile) != null
      const destTile = pixelToTile(to.x, to.y);

      // 使用 IEngineContext 获取碰撞检测器和 NPC 管理器
      const engine = this.engine;
      const collisionChecker = engine.getCollisionChecker()!;
      const npcManager = engine.getNpcManager()!;

      // 检查跳跃障碍
      const isMapObstacleForJump = collisionChecker.isMapObstacleForJump(nextTile);
      const hasTrapScript = engine.hasTrapScript(this.tilePosition);
      const hasEventer = npcManager.getEventer(nextTile) !== null;

      if (isMapObstacleForJump) {
        // C#: TilePosition = TilePosition; // Correcting position
        this.correctPositionToCurrentTile();
        isOver = true;
      } else if (
        nextTile.x === destTile.x &&
        nextTile.y === destTile.y &&
        this.hasObstacle(nextTile)
      ) {
        // Stay in place - destination has character obstacle
        this.correctPositionToCurrentTile();
        isOver = true;
      } else if (hasTrapScript) {
        // Stop at trap
        isOver = true;
      } else if (hasEventer) {
        // C#: NpcManager.GetEventer(nextTile) != null
        this.correctPositionToCurrentTile();
        isOver = true;
      } else {
        // C#: MoveTo(to - from, elapsedSeconds * 8) - Jump is 8x faster
        const JUMP_SPEED_FOLD = 8;
        this.moveToVector({ x: dirX, y: dirY }, deltaTime * JUMP_SPEED_FOLD);
      }

      // C#: if (MovedDistance >= distance - Globals.DistanceOffset && !isOver)
      const DISTANCE_OFFSET = 1;
      if (this.movedDistance >= totalDistance - DISTANCE_OFFSET && !isOver) {
        this.movedDistance = 0;
        this._positionInWorld = { x: to.x, y: to.y };
        isOver = true;
      }

      // C#: if (isOver) { Path.RemoveFirst(); }
      if (isOver) {
        this.path.shift();
      }
    }

    // C#: if (IsPlayCurrentDirOnceEnd()) { StandingImmediately(); CheckMapTrap(); }
    // This check is AFTER the path processing, and only triggers standing when animation ends
    if (this.isPlayCurrentDirOnceEnd()) {
      this.standingImmediately();
      // TODO: CheckMapTrap()
    }
  }

  /**
   * Find neighbor tile in a direction
   * C# Reference: PathFinder.FindNeighborInDirection
   */
  protected findNeighborInDirection(tilePos: Vector2, direction: Vector2): Vector2 {
    // Simplified: normalize direction and add to tile position
    const len = Math.sqrt(direction.x * direction.x + direction.y * direction.y);
    if (len === 0) return tilePos;

    // Determine direction index (0-7)
    const dirIndex = getDirectionFromVector(direction);

    // Direction offsets in tile coordinates
    const offsets = [
      { x: 0, y: -1 }, // North
      { x: 1, y: -1 }, // NorthEast
      { x: 1, y: 0 }, // East
      { x: 1, y: 1 }, // SouthEast
      { x: 0, y: 1 }, // South
      { x: -1, y: 1 }, // SouthWest
      { x: -1, y: 0 }, // West
      { x: -1, y: -1 }, // NorthWest
    ];

    const offset = offsets[dirIndex] || { x: 0, y: 0 };
    return {
      x: tilePos.x + offset.x,
      y: tilePos.y + offset.y,
    };
  }

  /**
   * C#: TilePosition = TilePosition; // Correcting position
   * Snaps pixel position to the center of current tile
   */
  protected correctPositionToCurrentTile(): void {
    const tilePixel = tileToPixel(this._mapX, this._mapY);
    this._positionInWorld = { x: tilePixel.x, y: tilePixel.y };
  }

  /**
   * Update sitting state
   * C#: case CharacterState.Sit - if (!IsSitted) base.Update(); if (!IsInPlaying) IsSitted = true;
   * Player overrides this for Thew->Mana conversion
   */
  protected updateSitting(deltaTime: number): void {
    super.update(deltaTime);
    // Subclasses (like Player) can override for additional sitting logic
  }

  /**
   * Update attacking state
   * C#: case CharacterState.Attack - base.Update(); if (IsPlayCurrentDirOnceEnd()) {
   *   PlaySoundEffect(NpcIni[State].Sound);
   *   if (_magicToUseWhenAttack != null) {
   *       MagicManager.UseMagic(this, _magicToUseWhenAttack, PositionInWorld, _attackDestination);
   *   }
   *   OnAttacking(_attackDestination);
   *   StandingImmediately();
   * }
   */
  protected updateAttacking(deltaTime: number): void {
    super.update(deltaTime);
    if (this.isPlayCurrentDirOnceEnd()) {
      // C#: if (IsVisibleWhenAttack) InvisibleByMagicTime = 0;
      if (this.isVisibleWhenAttack) {
        this.invisibleByMagicTime = 0;
      }
      // Play attack state sound when animation completes
      // C# Reference: PlaySoundEffect(NpcIni[State].Sound)
      this.playStateSound(this._state);

      // C#: if (_magicToUseWhenAttack != null) {
      //     MagicManager.UseMagic(this, _magicToUseWhenAttack, PositionInWorld, _attackDestination);
      // }
      // 武功发射在基类处理，子类的 onAttacking 可以做额外处理
      this.useMagicWhenAttack();

      this.onAttacking();
      this.standingImmediately();
    }
  }

  /**
   * 攻击动画结束时发射武功
   * C#: MagicManager.UseMagic(this, _magicToUseWhenAttack, PositionInWorld, _attackDestination)
   *
   * 子类可以覆盖此方法来提供 MagicManager 和获取缓存的武功数据
   */
  protected useMagicWhenAttack(): void {
    // 基类只记录日志，实际的武功发射由子类实现
    // 因为基类没有 MagicManager 的引用
    if (this._magicToUseWhenAttack) {
      logger.log(`[Character] ${this.name} would use magic: ${this._magicToUseWhenAttack}`);
    }
    // 清理
    this._magicToUseWhenAttack = null;
    this._attackDestination = null;
  }

  /**
   * Update magic casting state
   * C#: case CharacterState.Magic - base.Update(); if (IsPlayCurrentDirOnceEnd()) { UseMagic(); StandingImmediately(); }
   */
  protected updateMagic(deltaTime: number): void {
    super.update(deltaTime);
    if (this.isPlayCurrentDirOnceEnd()) {
      // C#: if (IsVisibleWhenAttack) InvisibleByMagicTime = 0;
      if (this.isVisibleWhenAttack) {
        this.invisibleByMagicTime = 0;
      }
      this.onMagicCast();
      this.standingImmediately();
    }
  }

  /**
   * Update Stand/Stand1/Hurt state
   * C#: case CharacterState.Stand/Stand1/Hurt - base.Update(); if (IsPlayCurrentDirOnceEnd()) StandingImmediately();
   * Stand1 动画播完后会切回 Stand（可能再随机触发 Stand1）
   */
  protected updateStandOrHurt(deltaTime: number): void {
    super.update(deltaTime);
    if (this.isPlayCurrentDirOnceEnd()) {
      this.standingImmediately();
    }
  }

  /**
   * Update death state
   * C#: case CharacterState.Death - base.Update(); if (IsPlayCurrentDirOnceEnd()) IsDeath = true;
   */
  protected updateDeath(deltaTime: number): void {
    // C#: Once IsDeath is true, character becomes a static "body" - no more animation updates
    if (this.isDeath) {
      return;
    }

    super.update(deltaTime);

    // C#: When death animation finishes, set IsDeath = true
    // This stops the animation from looping and marks the character as a "body"
    if (this.isPlayCurrentDirOnceEnd()) {
      this.isDeath = true;
    }
  }

  /**
   * Update standing state (for FightStand and other default states)
   * C#: default - base.Update();
   * FightStand 只是普通更新，不在动画结束后切换
   */
  protected updateStanding(deltaTime: number): void {
    super.update(deltaTime);
  }

  // === Action Hooks ===

  /**
   * Called when attack animation completes
   * C#: OnAttacking(_attackDestination)
   */
  protected onAttacking(): void {
    // Override in subclass for attack logic
  }

  /**
   * Called when magic animation completes
   * C#: MagicManager.UseMagic(this, MagicUse, ...)
   */
  protected onMagicCast(): void {
    // Override in subclass for magic logic
  }

  /**
   * Called when character reaches movement destination
   * C# Reference: In MoveAlongPath, after MovedDistance >= distance:
   *   Magic magicToUse;
   *   if (AttackingIsOk(out magicToUse)) PerformeAttack(magicToUse);
   *   if (InteractIsOk()) PerformeInteract();
   */
  protected onReachedDestination(): void {
    // Check for pending attack
    if (this._destinationAttackTilePosition) {
      const result = this.attackingIsOk();
      if (result.isOk) {
        // Ready to attack - subclass should override to perform attack
        this.performAttackAtDestination();
      }
    }
    // TODO: Check for pending interaction (InteractIsOk, PerformeInteract)
  }

  /**
   * Perform attack at attack destination
   * Override in subclass to implement attack behavior
   * C#: PerformeAttack(magicToUse)
   */
  protected performAttackAtDestination(): void {
    // Override in subclass
  }

  /**
   * C#: OnPerformeAttack()
   * Called after attack state is set, before direction and animation
   * Player overrides this to handle SpecialAttackTexture for Attack2
   */
  protected onPerformeAttack(): void {
    // Override in subclass (e.g., Player for SpecialAttackTexture)
  }

  /**
   * 显示消息给玩家
   * 通过 GuiManager 显示，子类可以覆盖
   */
  protected showMessage(text: string): void {
    // 基类尝试通过 engine context 获取 GuiManager
    // 如果没有，就只记录日志
    logger.log(`[Character] Message: ${text}`);
  }

  /**
   * C#: PerformeAttack(Vector2 destinationPositionInWorld, Magic magicToUse)
   * Public method to perform attack at a specific world position
   * Called by script commands like NpcAttack
   *
   * C# 中攻击动画结束后会调用 MagicManager.UseMagic(_magicToUseWhenAttack)
   *
   * @param destinationPixelPosition 目标像素位置
   * @param magicIni 武功文件名（可选）
   * @param magicData 武功数据（可选，用于 LifeFullToUse 和 UseActionFile 检查）
   */
  performeAttack(destinationPixelPosition: Vector2, magicIni?: string, magicData?: MagicData): void {
    // Convert to tile position
    const tilePos = pixelToTile(destinationPixelPosition.x, destinationPixelPosition.y);
    this._destinationAttackTilePosition = tilePos;

    // C#: PerformeAttack calls PerformeAttack(dest, GetRamdomMagicWithUseDistance(AttackRadius))
    if (!this.canPerformAction()) return;

    // C#: if (!CanPerformeAttack()) return;
    if (!this.canPerformeAttack()) return;

    // C#: if (magicToUse.LifeFullToUse > 0 && !IsFullLife)
    // 只有当有 magicData 时才检查
    if (magicData && magicData.lifeFullToUse > 0 && !this.isFullLife) {
      // C#: if (IsPlayer || (ControledMagicSprite != null && ControledMagicSprite.BelongCharacter.IsPlayer))
      //     GuiManager.ShowMessage("满血才能使用");
      // 简化检查：如果角色是玩家，或者被控制的武功精灵属于玩家
      const isControledByPlayer = this._controledMagicSprite !== null &&
        this._controledMagicSprite.belongCharacterId === "player";
      if (this.isPlayer || isControledByPlayer) {
        this.showMessage("满血才能使用");
      }
      return;
    }

    // C#: Check attack animations supporting current attack direction or not.
    // var canAttackDirCount = magicToUse.UseActionFile != null
    //     ? magicToUse.UseActionFile.DirectionCounts
    //     : CanAttackDirCount;
    // UseActionFile 是一个 ASF 文件，我们需要异步加载它来获取 DirectionCounts
    // 目前简化处理：如果没有 magicData，使用 canAttackDirCount
    const canAttackDirCountToUse = this.canAttackDirCount;

    // C#: if (canAttackDirCount < 8 && !Engine.PathFinder.CanMoveInDirection(
    //     Utils.GetDirectionIndex(destinationPositionInWorld - PositionInWorld, 8), canAttackDirCount)) return;
    if (canAttackDirCountToUse < 8 && canAttackDirCountToUse > 0) {
      const directionIndex = getDirectionFromVector({
        x: destinationPixelPosition.x - this._positionInWorld.x,
        y: destinationPixelPosition.y - this._positionInWorld.y,
      });
      if (!canMoveInDirection(directionIndex, canAttackDirCountToUse)) {
        return;
      }
    }

    // C#: _attackDestination = destinationPositionInWorld;
    this._attackDestination = { ...destinationPixelPosition };

    // C#: _magicToUseWhenAttack = magicToUse;
    // 如果指定了武功就使用指定的，否则从 FlyIni 列表中根据攻击距离选择
    if (magicIni) {
      this._magicToUseWhenAttack = magicIni;
      logger.log(`[Character] ${this.name}.performeAttack: set _magicToUseWhenAttack=${magicIni} (from param)`);
    } else {
      // C#: GetRamdomMagicWithUseDistance(AttackRadius)
      this._magicToUseWhenAttack = this.getRandomMagicWithUseDistance(this.getAttackRadius());
      logger.log(`[Character] ${this.name}.performeAttack: set _magicToUseWhenAttack=${this._magicToUseWhenAttack} (from getRandomMagic)`);
    }

    // C#: StateInitialize(); ToFightingState();
    this.toFightingState();

    // C#: Random attack state (Attack, Attack1, Attack2)
    const randomValue = Math.floor(Math.random() * 3);
    let chosenState = CharacterState.Attack;
    if (randomValue === 1 && this.isStateImageOk(CharacterState.Attack1)) {
      chosenState = CharacterState.Attack1;
    } else if (randomValue === 2 && this.isStateImageOk(CharacterState.Attack2)) {
      chosenState = CharacterState.Attack2;
    }

    this.state = chosenState;

    // C#: OnPerformeAttack();
    this.onPerformeAttack();

    // C#: if (magicToUse.UseActionFile != null) { Texture = magicToUse.UseActionFile; }
    // UseActionFile 加载在子类异步处理，这里跳过

    // C#: SetDirection(destinationPositionInWorld - PositionInWorld);
    const dx = tilePos.x - this._mapX;
    const dy = tilePos.y - this._mapY;
    this._currentDirection = getDirectionFromVector({ x: dx, y: dy });

    this.playCurrentDirOnce();
  }

  /**
   * C#: CanPerformeAttack
   * 检查是否可以执行攻击（未禁用战斗）
   */
  protected canPerformeAttack(): boolean {
    return !this.isFightDisabled;
  }

  /**
   * Load sprites for this character (suffix-based method)
   */
  async loadSprites(basePath: string, baseFileName: string): Promise<void> {
    this._basePath = basePath;
    this._baseFileName = baseFileName;
    this._spriteSet = await loadSpriteSet(basePath, baseFileName);
    // Update texture with custom ASF support
    this._updateTextureForState(this._state);
  }

  /**
   * Load sprites from NpcRes INI file (the C# way)
   * Based on C# Character.SetNpcIni() and ResFile.ReadFile()
   *
   * This loads ASF files based on state mappings defined in ini/npcres/*.ini
   * @param npcIni - The npcIni filename (e.g., "z-杨影枫.ini")
   * @returns true if loaded successfully
   */
  async loadSpritesFromNpcIni(npcIni?: string): Promise<boolean> {
    const iniFile = npcIni || this.npcIni;
    if (!iniFile) {
      logger.warn(`[Character] No npcIni specified for loadSpritesFromNpcIni`);
      return false;
    }

    // Load NpcRes INI to get state mappings
    const stateMap = await loadNpcRes(iniFile);
    if (!stateMap || stateMap.size === 0) {
      logger.warn(`[Character] No state map for npcIni: ${iniFile}`);
      return false;
    }

    // Create sprite set by loading each state's ASF
    const spriteSet = createEmptySpriteSet();
    const loadPromises: Promise<void>[] = [];

    // Map CharacterState to SpriteSet keys
    const stateToKey: Record<number, keyof SpriteSet> = {
      [CharacterState.Stand]: "stand",
      [CharacterState.Stand1]: "stand1",
      [CharacterState.Walk]: "walk",
      [CharacterState.Run]: "run",
      [CharacterState.Jump]: "jump",
      [CharacterState.Attack]: "attack",
      [CharacterState.Attack1]: "attack1",
      [CharacterState.Attack2]: "attack2",
      [CharacterState.Magic]: "magic",
      [CharacterState.Hurt]: "hurt",
      [CharacterState.Death]: "death",
      [CharacterState.Sit]: "sit",
      // Fight states have their own keys now
      [CharacterState.FightStand]: "fightStand",
      [CharacterState.FightWalk]: "fightWalk",
      [CharacterState.FightRun]: "fightRun",
      [CharacterState.FightJump]: "fightJump",
    };

    for (const [state, info] of stateMap) {
      const key = stateToKey[state];
      if (key && info.imagePath) {
        const promise = loadCharacterAsf(info.imagePath).then((asf) => {
          if (asf) {
            spriteSet[key] = asf;
          }
        });
        loadPromises.push(promise);
      }
      // Store sound path for this state
      // C# Reference: NpcIni[(int)state].Sound
      if (info.soundPath) {
        this._stateSounds.set(state, info.soundPath);
      }
    }

    await Promise.all(loadPromises);

    // Check if we loaded at least the stand animation
    if (!spriteSet.stand && !spriteSet.walk) {
      logger.warn(`[Character] No basic animations loaded for npcIni: ${iniFile}`);
      return false;
    }

    // Apply sprite set
    this._spriteSet = spriteSet;
    this.npcIni = iniFile;

    // Update texture with custom ASF support
    // C# Reference: Character.Initlize() calls Set() which sets Texture
    this._updateTextureForState(this._state);

    // Load BodyIni object if specified
    // 对应 C# 的 new Obj(@"ini\obj\" + keyData.Value)
    if (this.bodyIni) {
      try {
        const bodyObj = await Obj.createFromFile(this.bodyIni);
        if (bodyObj) {
          this.bodyIniObj = bodyObj;
          logger.log(`[Character] Loaded BodyIni: ${this.bodyIni}`);
        }
      } catch (err) {
        logger.warn(`[Character] Failed to load BodyIni ${this.bodyIni}:`, err);
      }
    }

    logger.log(`[Character] Loaded sprites from NpcRes: ${iniFile}`);
    return true;
  }

  /**
   * Check if sprites are loaded
   */
  isSpritesLoaded(): boolean {
    return this._spriteSet.stand !== null || this._spriteSet.walk !== null;
  }

  /**
   * Get sound path for a specific state
   * C# Reference: NpcIni[(int)state].Sound
  /**
   * Get sound file for a specific state
   */
  getStateSound(state: CharacterState): string | null {
    return this._stateSounds.get(state) || null;
  }

  /**
   * Play sound effect for a state
   * C# Reference: PlaySoundEffect(NpcIni[(int)CharacterState.Magic].Sound)
   */
  protected playStateSound(state: CharacterState): void {
    const soundPath = this._stateSounds.get(state);
    if (soundPath && this.audioManager) {
      this.audioManager.playSound(soundPath);
    }
  }

  // === Special Action Methods ===

  /**
   * Set special action ASF file and start playing
   * Based on C# Character.SetSpecialAction()
   *
   * C# Reference:
   * public void SetSpecialAction(string asfFileName) {
   *     IsInSpecialAction = true;
   *     _specialActionLastDirection = CurrentDirection;
   *     EndPlayCurrentDirOnce();  // Stop any current animation first!
   *     Texture = Utils.GetCharacterAsf(asfFileName);
   *     PlayCurrentDirOnce();
   * }
   *
   * @param asfFileName - ASF file to play (e.g., "mpc001.asf")
   * @returns Promise that resolves to true if ASF was loaded
   */
  async setSpecialAction(asfFileName: string): Promise<boolean> {
    // 关键修复：立即设置 isInSpecialAction = true，避免 SetNpcActionFile 的回调
    // 在 ASF 加载期间错误地更新纹理为站立状态
    // C# 版本是同步的，所以不存在这个问题
    // 但 Web 版本是异步加载 ASF，需要提前设置此标志
    this.isInSpecialAction = true;
    // 同时设置 _leftFrameToPlay 为正数，防止 update() 中 isPlayCurrentDirOnceEnd() 返回 true
    // 导致 isInSpecialAction 被错误地设回 false
    this._leftFrameToPlay = 999;

    // Normalize the ASF path
    let normalizedFileName = asfFileName;
    if (asfFileName.includes("/")) {
      normalizedFileName = asfFileName.split("/").pop() || asfFileName;
    }

    // Load the special action ASF
    const asf = await loadCharacterAsf(normalizedFileName);
    if (!asf) {
      logger.warn(`[Character] Failed to load special action ASF: ${normalizedFileName}`);
      // 加载失败时恢复标志
      this.isInSpecialAction = false;
      this._leftFrameToPlay = 0;
      return false;
    }
    // C#: _specialActionLastDirection = CurrentDirection;
    this.specialActionLastDirection = this._currentDirection;
    // C#: EndPlayCurrentDirOnce(); - Stop any current animation first!
    this.endPlayCurrentDirOnce();

    // C#: Texture = Utils.GetCharacterAsf(asfFileName);
    this._texture = asf;
    this.specialActionFrame = 0;

    // C#: PlayCurrentDirOnce(); - but we set up manually since we just set texture
    this._frameBegin = 0;
    this._frameEnd = (asf.framesPerDirection || 1) - 1;
    this._currentFrameIndex = 0;
    this._leftFrameToPlay = asf.framesPerDirection || 1;

    return true;
  }

  /**
   * Check if special action animation has finished
   * Based on C# Sprite.IsPlayCurrentDirOnceEnd()
   */
  isSpecialActionEnd(): boolean {
    if (!this.isInSpecialAction) return true;
    return this._leftFrameToPlay <= 0;
  }

  /**
   * End special action and restore normal state
   * Based on C# Character.EndSpecialAction()
   * Note: C# doesn't have guard check - it's called after IsInSpecialAction is set to false
   */
  endSpecialAction(): void {
    // Note: _isInSpecialAction is already set to false by caller (update method)
    // Just do the cleanup work
    this._state = CharacterState.Stand;
    this._currentFrameIndex = 0;
    this._elapsedMilliSecond = 0;
    this._leftFrameToPlay = 0;
    // Update texture with custom ASF support
    this._updateTextureForState(CharacterState.Stand);
  }

  /**
   * Play current state animation once (for Magic, Attack, etc.)
   * Based on C# Character.PlayCurrentDirOnce()
   *
   * @param stateToPlay - Optional state to play, defaults to current state
   * @returns true if successfully started
   */
  playStateOnce(stateToPlay?: CharacterState): boolean {
    const state = stateToPlay ?? this._state;

    // Check for custom ASF first, then fall back to sprite set
    let asf: AsfData | null = null;
    if (this._customAsfCache.has(state)) {
      asf = this._customAsfCache.get(state) || null;
    }
    if (!asf) {
      asf = getAsfForState(this._spriteSet, state);
    }

    if (!asf) {
      logger.warn(`[Character] No ASF found for state ${state}`);
      return false;
    }

    // C#: SetState + PlayCurrentDirOnce
    // Note: Do NOT set _isInSpecialAction here - that's only for script special actions
    // Magic/Attack/etc states use the switch statement in update(), not isInSpecialAction
    this._state = state;
    this._texture = asf;
    this._frameBegin = 0;
    this._frameEnd = (asf.framesPerDirection || 1) - 1;
    this._currentFrameIndex = 0;
    this._leftFrameToPlay = asf.framesPerDirection || 1;

    return true;
  }

  /**
   * Set custom action file for a character state
   * Based on C# Character.SetNpcActionFile()
   */
  setNpcActionFile(stateType: number, asfFile: string): void {
    this.customActionFiles.set(stateType, asfFile);
    // Clear cached ASF for this state
    this._customAsfCache.delete(stateType);
    logger.log(`[Character] Set action file for state ${stateType}: ${asfFile}`);
  }

  /**
   * Clear all custom action files
   * Called when loading a save to reset character state to default sprites
   * C# Reference: In C#, loading creates a new Player object, effectively resetting custom actions
   */
  clearCustomActionFiles(): void {
    this.customActionFiles.clear();
    this._customAsfCache.clear();
    logger.log(`[Character] Cleared all custom action files`);
  }

  /**
   * Preload custom action file for immediate use
   * Note: Does NOT call setNpcActionFile again since caller already did
   */
  async preloadCustomActionFile(stateType: number, asfFile: string): Promise<void> {
    // Only load the ASF, don't call setNpcActionFile again
    const asf = await loadCharacterAsf(asfFile);
    if (asf) {
      this._customAsfCache.set(stateType, asf);
      logger.log(`[Character] Preloaded custom action file for state ${stateType}: ${asfFile}`);
    } else {
      logger.warn(
        `[Character] Failed to preload custom action file for state ${stateType}: ${asfFile}`
      );
    }
  }

  /**
   * C#: Draw(SpriteBatch, int offX = 0, int offY = 0)
   * Draw character with optional offset
   * 状态效果颜色：冻结蓝色、中毒绿色、石化灰度
   * @param offX X offset for drawing
   * @param offY Y offset for drawing
   */
  override draw(
    ctx: CanvasRenderingContext2D,
    cameraX: number,
    cameraY: number,
    offX: number = 0,
    offY: number = 0
  ): void {
    if (!this._isVisible) return;

    // C#: Character.Draw 中确定颜色
    // var color = DrawColor;
    // if (FrozenSeconds > 0 && _isFronzenVisualEffect) color = new Color(80, 80, 255);
    // if (PoisonSeconds > 0 && _isPoisionVisualEffect) color = new Color(50, 255, 50);
    // if (PetrifiedSeconds > 0 && _isPetrifiedVisualEffect) 使用灰度
    let drawColor = "white";
    if (this.frozenSeconds > 0 && this.isFrozenVisualEffect) {
      drawColor = "frozen";
    }
    if (this.poisonSeconds > 0 && this.isPoisonVisualEffect) {
      drawColor = "poison";
    }
    if (this.petrifiedSeconds > 0 && this.isPetrifiedVisualEffect) {
      drawColor = "black"; // 灰度效果
    }

    this.drawWithColor(ctx, cameraX, cameraY, drawColor, offX, offY);
  }

  /**
   * Draw highlight edge (called separately to ensure it's on top layer)
   * C# Reference: Player.Draw 末尾绘制 OutEdgeSprite
   */
  drawHighlight(
    ctx: CanvasRenderingContext2D,
    cameraX: number,
    cameraY: number,
    highlightColor: string = "rgba(255, 255, 0, 0.6)"
  ): void {
    if (!this._isVisible) return;
    super.drawHighlight(ctx, cameraX, cameraY, highlightColor);
  }

  /**
   * Check if can interact with this character
   */
  canInteractWith(other: Character): boolean {
    const dist = distance(this._positionInWorld, other._positionInWorld);
    return dist <= this.dialogRadius * TILE_WIDTH * 2;
  }

  // ========== MagicSpritesInEffect Methods ==========
  // C# Reference: Character.cs LinkedList<MagicSprite> MagicSpritesInEffect

  /**
   * 获取持续效果精灵列表
   * C# Reference: Character.MagicSpritesInEffect
   */
  getMagicSpritesInEffect(): MagicSprite[] {
    return this._magicSpritesInEffect;
  }

  /**
   * 添加持续效果精灵
   * C# Reference: user.MagicSpritesInEffect.AddLast(sprite)
   */
  addMagicSpriteInEffect(sprite: MagicSprite): void {
    this._magicSpritesInEffect.push(sprite);
  }

  /**
   * 移除持续效果精灵
   */
  removeMagicSpriteInEffect(sprite: MagicSprite): void {
    const index = this._magicSpritesInEffect.indexOf(sprite);
    if (index !== -1) {
      this._magicSpritesInEffect.splice(index, 1);
    }
  }

  /**
   * 清理已销毁的持续效果精灵
   * C# Reference: Character.Update - for (var node = MagicSpritesInEffect.First; ...)
   */
  cleanupMagicSpritesInEffect(): void {
    this._magicSpritesInEffect = this._magicSpritesInEffect.filter((s) => !s.isDestroyed);
  }

  // ========== Status Effect Methods ==========
  // C# Reference: Character.cs

  /**
   * 解除异常状态
   * C# Reference: Character.RemoveAbnormalState
   */
  removeAbnormalState(): void {
    this.clearFrozen();
    this.clearPoison();
    this.clearPetrifaction();
    this.disableMoveMilliseconds = 0;
    this.disableSkillMilliseconds = 0;
  }

  /**
   * 清除冰冻状态
   */
  clearFrozen(): void {
    this.frozenSeconds = 0;
    this.isFrozenVisualEffect = false;
  }

  /**
   * 清除中毒状态
   */
  clearPoison(): void {
    this.poisonSeconds = 0;
    this.isPoisonVisualEffect = false;
    this.poisonByCharacterName = "";
  }

  /**
   * 清除石化状态
   */
  clearPetrifaction(): void {
    this.petrifiedSeconds = 0;
    this.isPetrifiedVisualEffect = false;
  }

  // ========== ChangeCharacter Methods ==========
  // C# Reference: Character.cs ChangeCharacterBy, MorphBy

  /**
   * 通过武功精灵变身
   * C# Reference: Character.ChangeCharacterBy
   */
  changeCharacterBy(magicSprite: MagicSprite): void {
    this._changeCharacterByMagicSprite = magicSprite;
    this._changeCharacterByMagicSpriteTime = magicSprite.magic.effect ?? 0;
    // TODO: OnReplaceMagicList(magicSprite.BelongMagic, magicSprite.BelongMagic.ReplaceMagic)
    this.standImmediately();
  }

  /**
   * 变形（短暂变身）
   * C# Reference: Character.MorphBy
   */
  morphBy(magicSprite: MagicSprite): void {
    this._changeCharacterByMagicSprite = magicSprite;
    this._changeCharacterByMagicSpriteTime = magicSprite.magic.morphMilliseconds ?? 0;
    // TODO: OnReplaceMagicList(magicSprite.BelongMagic, magicSprite.BelongMagic.ReplaceMagic)
    this.standImmediately();
  }

  // ========== WeakBy Methods ==========
  // C# Reference: Character.cs WeakBy, _weakByMagicSprite

  /**
   * 弱化效果 - 降低攻防百分比
   * C# Reference: Character.WeakBy
   */
  weakBy(magicSprite: MagicSprite): void {
    this._weakByMagicSprite = magicSprite;
    this._weakByMagicSpriteTime = magicSprite.magic.weakMilliseconds ?? 0;
  }

  // ========== ChangeToOpposite Methods ==========
  // C# Reference: Character.cs ChangeToOpposite, _changeToOppositeMilliseconds

  /**
   * 变换阵营 - 临时变换敌我关系
   * C# Reference: Character.ChangeToOpposite
   */
  changeToOpposite(milliseconds: number): void {
    // C#: if (IsPlayer) return; - 玩家不能被变换阵营
    if (this.isPlayer) return;
    // C#: if _changeToOppositeMilliseconds is greater than 0, change it back when call ChangeToOpposite second time.
    // _changeToOppositeMilliseconds = _changeToOppositeMilliseconds > 0 ? 0 : milliseconds;
    this._changeToOppositeMilliseconds = this._changeToOppositeMilliseconds > 0 ? 0 : milliseconds;
  }

  // ========== FlyIni Change Methods ==========
  // C# Reference: Character.cs FlyIniChangeBy

  /**
   * 替换飞行INI
   * C# Reference: Character.FlyIniChangeBy
   */
  flyIniChangeBy(magicSprite: MagicSprite): void {
    this.removeFlyIniChangeBy();
    this._changeFlyIniByMagicSprite = magicSprite;
    // TODO: 完整实现 AddFlyIniReplace
    // if (!string.IsNullOrEmpty(magicSprite.BelongMagic.SpecialKind9ReplaceFlyIni))
    //   AddFlyIniReplace(...)
  }

  /**
   * 移除飞行INI替换
   * C# Reference: Character.RemoveFlyIniChangeBy
   */
  private removeFlyIniChangeBy(): void {
    if (this._changeFlyIniByMagicSprite !== null) {
      // TODO: 完整实现 RemoveFlyIniReplace
      this._changeFlyIniByMagicSprite = null;
    }
  }

  /**
   * 立即站立
   */
  protected standImmediately(): void {
    // C#: Use FightStand if in fighting mode
    if (this._isInFighting && this.isStateImageOk(CharacterState.FightStand)) {
      this.state = CharacterState.FightStand;
    } else {
      this.state = CharacterState.Stand;
    }
    this.path = [];
  }
}
