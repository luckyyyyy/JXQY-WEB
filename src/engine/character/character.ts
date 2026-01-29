/**
 * Character 基类 - 对应 C# Character.cs
 * Player 和 NPC 的基类，继承自 Sprite
 */
import type { Vector2, CharacterConfig, CharacterStats } from "../core/types";
import {
  CharacterKind,
  RelationType,
  CharacterState,
  Direction,
  DEFAULT_PLAYER_STATS,
  TILE_WIDTH,
  TILE_HEIGHT,
  BASE_SPEED,
  RUN_SPEED_FOLD,
  MIN_CHANGE_MOVE_SPEED_PERCENT,
} from "../core/types";
import { tileToPixel, pixelToTile, getDirection, getDirectionFromVector, distance, getViewTileDistance as getViewTileDistanceUtil } from "../core/utils";
import { PathType, findPath as pathFinderFindPath } from "../core/pathFinder";
import { Sprite, getAsfForState, loadSpriteSet, createEmptySpriteSet, type SpriteSet } from "../sprite/sprite";
import { loadNpcRes, loadCharacterAsf } from "./resFile";
import { applyConfigToCharacter, extractConfigFromCharacter, extractStatsFromCharacter, type CharacterInstance } from "./iniParser";
import type { AsfData } from "../sprite/asf";
import type { AudioManager } from "../audio";

/** 加载中状态标记（-1），确保后续 state 变更时触发纹理更新 */
export const LOADING_STATE = -1 as CharacterState;

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
  // 简单属性改为公共
  attack: number = 10;
  attack2: number = 0;
  attack3: number = 0;
  attackLevel: number = 0;
  defend: number = 10;
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
  protected _movedDistance: number = 0;

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
  levelIniFile: string = "";
  poisonByCharacterName: string = "";
  buyIniString: string = "";

  // === Status Effects ===
  poisonSeconds: number = 0;
  petrifiedSeconds: number = 0;
  frozenSeconds: number = 0;
  isPoisonVisualEffect: boolean = false;
  isPetrifiedVisualEffect: boolean = false;
  isFrozenVisualEffect: boolean = false;

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

  // === Walkability ===
  protected _isWalkable: ((tile: Vector2) => boolean) | null = null;
  protected _isMapObstacle: ((tile: Vector2) => boolean) | null = null;

  // === Audio ===
  protected _stateSounds: Map<number, string> = new Map();
  protected _audioManager: AudioManager | null = null;

  constructor() {
    super();
  }

  // === Walkability Getter ===
  get isWalkable(): ((tile: Vector2) => boolean) | null {
    return this._isWalkable;
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
    return (this.kind === CharacterKind.Fighter || this.kind === CharacterKind.Follower) &&
           this.relation === RelationType.Friend;
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

  /** C#: IsEventCharacter */
  get isEventCharacter(): boolean {
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

  /** C#: IsInteractive */
  get isInteractive(): boolean {
    // Dead characters are not interactive (they become "bodies")
    if (this.isDeathInvoked || this.isDeath) {
      return false;
    }
    return this.hasInteractScript || this.hasInteractScriptRight ||
           this.isEnemy || this.isFighterFriend || this.isNoneFighter;
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

  // === State Properties ===

  get state(): CharacterState {
    return this._state;
  }

  set state(value: CharacterState) {
    // C#: Dead characters should not change state (except to Death itself)
    if ((this.isDeathInvoked || this.isDeath) && value !== CharacterState.Death) {
      return;
    }
    if (this._state !== value) {
      this._state = value;
      this._currentFrameIndex = 0;
      this._animationTime = 0;
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
    // Don't change state if dead
    if (this.isDeathInvoked || this.isDeath) {
      return;
    }
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
    if (!this._audioManager) return;

    // Stop any looping sound first
    // C# Reference: if (_sound != null) { _sound.Stop(true); _sound = null; }
    this._audioManager.stopLoopingSound();

    const soundPath = this._stateSounds.get(state);
    if (!soundPath) return;

    switch (state) {
      case CharacterState.Walk:
      case CharacterState.FightWalk:
      case CharacterState.Run:
      case CharacterState.FightRun:
        // Loop sound for movement states
        // C# Reference: _sound = sound.CreateInstance(); _sound.IsLooped = true; _sound.Play();
        this._audioManager.playLoopingSound(soundPath);
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
        this._audioManager.playSound(soundPath);
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
        .catch(err => console.warn(`[Character] Failed to load custom ASF for state ${state}:`, err));
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
    this._isShow = value;
  }

  /** C#: IsInFighting */
  get isInFighting(): boolean {
    return this._isInFighting;
  }

  /** C#: IsInDeathing */
  get isInDeathing(): boolean {
    return this._state === CharacterState.Death;
  }

  /** C#: IsStanding() */
  isStanding(): boolean {
    return this._state === CharacterState.Stand ||
           this._state === CharacterState.Stand1 ||
           this._state === CharacterState.FightStand;
  }

  /** C#: IsSitting() */
  isSitting(): boolean {
    return this._state === CharacterState.Sit;
  }

  /** C#: IsWalking() */
  isWalking(): boolean {
    return this._state === CharacterState.Walk ||
           this._state === CharacterState.FightWalk;
  }

  /** C#: IsRuning() */
  isRunning(): boolean {
    return this._state === CharacterState.Run ||
           this._state === CharacterState.FightRun;
  }

  /** C#: ClearFollowTarget() */
  clearFollowTarget(): void {
    this.followTarget = null;
    this.isFollowTargetFound = false;
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
   * Check if there's an obstacle (NPC/character) at the tile position
   * This uses the _isWalkable checker set by NpcManager/Player
   */
  hasObstacle(tilePosition: Vector2): boolean {
    // Use the walkability checker if available
    if (this._isWalkable && !this._isWalkable(tilePosition)) {
      return true;
    }
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
    if (this._isMapObstacle && this._isMapObstacle(endTile)) return false;

    // Simplified: if within vision radius and no direct obstacle, can see
    const distance = this.getViewTileDistance(startTile, endTile);
    return distance <= visionRadius;
  }

  // === Methods ===

  /**
   * Set walkability checker
   */
  setWalkabilityChecker(
    checker: (tile: Vector2) => boolean,
    mapObstacle?: (tile: Vector2) => boolean
  ): void {
    this._isWalkable = checker;
    this._isMapObstacle = mapObstacle || null;
  }

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
      console.log(`[Character] ${this.name}: Built flyIniInfos: ${this._flyIniInfos.map(f => `${f.magicIni}@${f.useDistance}`).join(', ')}`);
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
   */
  setPosition(tileX: number, tileY: number): void {
    this._mapX = tileX;
    this._mapY = tileY;
    this._updatePositionFromTile();
    this.path = [];
  }

  /**
   * C#: MoveTo(direction, elapsedSeconds) / MoveToNoNormalizeDirection
   * Move character in a direction
   * C# Sprite.cs line 267: MovedDistance += move.Length();
   */
  moveTo(direction: number, elapsedSeconds: number): void {
    // C#: ChangeMoveSpeedFold = 1 + AddMoveSpeedPercent / 100 (min -90%)
    const speedPercent = Math.max(MIN_CHANGE_MOVE_SPEED_PERCENT, this.addMoveSpeedPercent);
    const changeMoveSpeedFold = 1 + speedPercent / 100;
    const speed = BASE_SPEED * this.walkSpeed * changeMoveSpeedFold;
    const moveDistance = speed * elapsedSeconds;

    // Direction vectors (normalized) - C# uses Vector2.Normalize()
    const vectors = [
      { x: 0, y: -1 },   // North
      { x: 0.7071, y: -0.7071 }, // NorthEast (1/√2)
      { x: 1, y: 0 },    // East
      { x: 0.7071, y: 0.7071 }, // SouthEast
      { x: 0, y: 1 },    // South
      { x: -0.7071, y: 0.7071 }, // SouthWest
      { x: -1, y: 0 },   // West
      { x: -0.7071, y: -0.7071 }, // NorthWest
    ];

    const vec = vectors[direction] || { x: 0, y: 0 };
    const moveX = vec.x * moveDistance;
    const moveY = vec.y * moveDistance;
    this._positionInWorld.x += moveX;
    this._positionInWorld.y += moveY;
    this._currentDirection = direction;

    // C# Sprite.cs: MovedDistance += move.Length();
    this._movedDistance += Math.sqrt(moveX * moveX + moveY * moveY);

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
    this.setDirectionFromVector(normalizedDir.x, normalizedDir.y);

    // C# Sprite.cs: MovedDistance += move.Length();
    this._movedDistance += Math.sqrt(moveX * moveX + moveY * moveY);

    // Update tile position
    const tile = pixelToTile(this._positionInWorld.x, this._positionInWorld.y);
    this._mapX = tile.x;
    this._mapY = tile.y;
  }

  /**
   * C#: MoveAlongPath(elapsedSeconds, speedFold)
   * Move character along path
   */
  moveAlongPath(deltaTime: number, speedFold: number = 1): CharacterUpdateResult {
    const result: CharacterUpdateResult = {
      moved: false,
      reachedDestination: false,
    };

    if (this.path.length === 0) {
      if (this._state === CharacterState.Walk || this._state === CharacterState.Run) {
        this.state = CharacterState.Stand;
      }
      return result;
    }

    // Get next waypoint
    const target = this.path[0];
    const targetPixel = tileToPixel(target.x, target.y);

    // Calculate movement
    const dx = targetPixel.x - this._positionInWorld.x;
    const dy = targetPixel.y - this._positionInWorld.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist < 2) {
      // Reached waypoint
      this._positionInWorld = { ...targetPixel };
      this._mapX = target.x;
      this._mapY = target.y;
      this.path.shift();
      result.moved = true;

      if (this.path.length === 0) {
        // 到达路径终点
        this.state = CharacterState.Stand;
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

      if (this._state !== CharacterState.Walk && this._state !== CharacterState.Run) {
        this.state = CharacterState.Walk;
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
    if (!this._isWalkable) {
      return false;
    }

    if (this._mapX === destTile.x && this._mapY === destTile.y) {
      return true;
    }

    // C#: pathType == Engine.PathFinder.PathType.End ? PathType : pathType
    const usePathType = pathTypeOverride === PathType.End ? this.getPathType() : pathTypeOverride;

    // Create obstacle check functions
    const hasObstacle = (tile: Vector2): boolean => {
      return this._isWalkable ? !this._isWalkable(tile) : true;
    };
    const isMapObstacle = (tile: Vector2): boolean => {
      return this._isMapObstacle ? this._isMapObstacle(tile) : hasObstacle(tile);
    };
    // For diagonal blocking, use the same isMapObstacle as hard obstacle
    const isHardObstacle = isMapObstacle;

    const path = pathFinderFindPath(
      { x: this._mapX, y: this._mapY },
      destTile,
      usePathType,
      hasObstacle,
      isMapObstacle,
      isHardObstacle,
      8 // canMoveDirectionCount
    );

    if (path.length === 0) {
      this.path = [];
      this.state = CharacterState.Stand;
      return false;
    }

    // Path is in pixel coordinates, skip first element (current position)
    this.path = path.slice(1);
    this._destinationMoveTilePosition = { ...destTile };
    this.state = CharacterState.Walk;
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
    if (!this._isWalkable) return false;

    if (this._mapX === destTile.x && this._mapY === destTile.y) {
      return true;
    }

    // C#: pathType == Engine.PathFinder.PathType.End ? PathType : pathType
    const usePathType = pathTypeOverride === PathType.End ? this.getPathType() : pathTypeOverride;

    // Create obstacle check functions
    const hasObstacle = (tile: Vector2): boolean => {
      return this._isWalkable ? !this._isWalkable(tile) : true;
    };
    const isMapObstacle = (tile: Vector2): boolean => {
      return this._isMapObstacle ? this._isMapObstacle(tile) : hasObstacle(tile);
    };
    const isHardObstacle = isMapObstacle;

    const path = pathFinderFindPath(
      { x: this._mapX, y: this._mapY },
      destTile,
      usePathType,
      hasObstacle,
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
    this.state = CharacterState.Run;
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
    console.log(`[Character.jumpTo] Starting jump from tile (${this._mapX}, ${this._mapY}) to (${destTile.x}, ${destTile.y})`);

    // C#: if (PerformActionOk() && destinationTilePosition != TilePosition)
    if (!this.performActionOk()) {
      console.log(`[Character.jumpTo] Cannot perform action`);
      return false;
    }
    if (destTile.x === this._mapX && destTile.y === this._mapY) {
      console.log(`[Character.jumpTo] Already at destination`);
      return false;
    }

    // C#: !MapBase.Instance.IsObstacleForCharacter(destinationTilePosition)
    if (this._isMapObstacle && this._isMapObstacle(destTile)) {
      console.log(`[Character.jumpTo] Map obstacle at destination`);
      return false;
    }

    // C#: !HasObstacle(destinationTilePosition)
    if (this.hasObstacle(destTile)) {
      console.log(`[Character.jumpTo] Character obstacle at destination`);
      return false;
    }

    // C#: (IsStateImageOk(CharacterState.FightJump) || IsStateImageOk(CharacterState.Jump))
    if (!this.isStateImageOk(CharacterState.Jump) && !this.isStateImageOk(CharacterState.FightJump)) {
      console.log(`[Character.jumpTo] No jump animation available`);
      return false;
    }

    // C#: if (!CanJump()) return;
    if (!this.canJump()) {
      console.log(`[Character.jumpTo] Cannot jump (canJump returned false)`);
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
    this._movedDistance = 0;

    console.log(`[Character.jumpTo] Path: from pixel (${startPixelPos.x}, ${startPixelPos.y}) to (${endPixelPos.x}, ${endPixelPos.y})`);

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
    this.setDirectionFromVector(dx, dy);

    // C#: PlayCurrentDirOnce();
    this.playCurrentDirOnce();

    console.log(`[Character.jumpTo] Jump initiated, state=${this._state}, direction=${this._currentDirection}`);
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
    if (this._isMapObstacle && this._isMapObstacle(destinationTilePosition)) {
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
  protected getRandTilePath(
    count: number,
    isFlyer: boolean,
    maxOffset: number = -1
  ): Vector2[] {
    const path: Vector2[] = [{ x: this._mapX, y: this._mapY }];
    let maxTry = count * 3;

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
        if (!isFlyer && this._isWalkable && !this._isWalkable(tilePosition)) {
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
    if (
      tilePositionList === null ||
      tilePositionList.length < 2 ||
      !this.isStanding()
    ) {
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
    const neighbor = this.findDistanceTileInDirection(this.tilePosition, { x: awayDirX, y: awayDirY }, awayTileDistance);

    // C#: if (HasObstacle(neighbor)) return false;
    if (this.hasObstacle(neighbor)) return false;
    if (this._isMapObstacle && this._isMapObstacle(neighbor)) return false;

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
  protected findDistanceTileInDirection(fromTile: Vector2, direction: Vector2, distance: number): Vector2 {
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
    const tileDistance = this.getViewTileDistance(this.tilePosition, this._destinationAttackTilePosition);
    // C#: var attackRadius = GetClosedAttackRadius(tileDistance);
    const attackRadius = this.getClosedAttackRadius(tileDistance);

    // C#: if (tileDistance == attackRadius)
    if (tileDistance === attackRadius) {
      // C#: var canSeeTarget = Engine.PathFinder.CanViewTarget(...)
      const canSeeTarget = this.canViewTarget(this.tilePosition, this._destinationAttackTilePosition, tileDistance);

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
    const destPixel = tileToPixel(this._destinationAttackTilePosition.x, this._destinationAttackTilePosition.y);
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
   * Set direction based on a vector (e.g., direction to target)
   * Used when interacting to face each other
   */
  setDirectionFromVector(dx: number, dy: number): void {
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
    this.state = CharacterState.Stand;
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
   * C#: FullLife()
   */
  fullLife(): void {
    this.life = this.lifeMax;
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
   */
  addLife(amount: number): void {
    this.life = Math.max(0, Math.min(this.life + amount, this.lifeMax));
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

    // C#: Track last attacker for CheckKeepDistanceWhenFriendDeath AI
    this._lastAttacker = attacker;

    // ============= Hit Rate Calculation =============
    // C# Reference: MagicSprite.CharacterHited - Hit ratio calculation

    const targetEvade = this.evade;
    const attackerEvade = attacker?.evade ?? 0;
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
      console.log(`[Character] ${attacker?.name || 'Unknown'} missed ${this.name} (roll ${(roll * 100).toFixed(1)}% > ${(hitRatio * 100).toFixed(1)}% hit rate)`);
      return;
    }

    // === Damage ===
    // C# Reference: MagicSprite.CharacterHited
    // effect = damage - character.RealDefend
    // if (effect < MinimalDamage) effect = MinimalDamage
    const defend = this.defend || 0;
    let actualDamage = Math.max(0, damage - defend);

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

    console.log(`[Character] ${this.name} took ${actualDamage} damage from ${attacker?.name || 'Unknown'} (${this.life}/${this.lifeMax} HP, hit rate: ${(hitRatio * 100).toFixed(1)}%)`);

    // Check for death
    if (this.life <= 0) {
      this.life = 0;
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
  ): void {
    if (this.isDeathInvoked || this.isDeath) return;
    if (this.invincible > 0 || this.life <= 0) return;

    this._lastAttacker = attacker;

    // ============= Hit Rate Calculation =============
    const targetEvade = this.evade;
    const attackerEvade = attacker?.evade ?? 0;
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
      console.log(`[Character] ${attacker?.name || 'Unknown'} magic missed ${this.name}`);
      return;
    }

    // === Multi-type Damage ===
    // C# Reference: effect3 = damage3 - character.Defend3; etc.
    let effect = Math.max(0, damage - this.defend);
    let effect2 = Math.max(0, damage2 - this.defend2);
    let effect3 = Math.max(0, damage3 - this.defend3);

    // Combine damage types
    // C#: if (effect2 > 0) effect += effect2; if (effect3 > 0) effect += effect3;
    let totalEffect = effect;
    if (effect2 > 0) totalEffect += effect2;
    if (effect3 > 0) totalEffect += effect3;

    // MinimalDamage = 5
    if (totalEffect < 5) totalEffect = 5;
    if (totalEffect > this.life) totalEffect = this.life;

    this.life -= totalEffect;

    // Mana damage
    if (damageMana > 0 && this.mana > 0) {
      this.mana = Math.max(0, this.mana - damageMana);
    }

    console.log(`[Character] ${this.name} took ${totalEffect} magic damage (${this.life}/${this.lifeMax} HP)`);

    if (this.life <= 0) {
      this.life = 0;
      this.onDeath(attacker);
    } else {
      this.hurting();
    }
  }

  /**
   * Play hurt animation
   * C# Reference: Character.Hurting()
   */
  hurting(): void {
    if (this.isDeathInvoked || this.isDeath) return;
    // C#: SetState(CharacterState.Hurt);
    this.state = CharacterState.Hurt;
  }

  /**
   * Called when character dies
   * C#: Character.Death() - sets state, plays animation once, runs death script
   */
  protected onDeath(killer: Character | null): void {
    if (this.isDeathInvoked) return;
    this.isDeathInvoked = true;

    console.log(`[Character] ${this.name} died${killer ? ` (killed by ${killer.name})` : ''}`);

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
   * C#: Update(gameTime)
   * State-machine driven update - based on C# Character.cs switch ((CharacterState)State)
   * Each state has its own update method that subclasses can override
   */
  override update(deltaTime: number): void {
    if (!this._isVisible) return;

    // C#: if (IsInSpecialAction) { base.Update(); if (IsPlayCurrentDirOnceEnd()) ... return; }
    if (this.isInSpecialAction) {
      super.update(deltaTime);
      if (this.isPlayCurrentDirOnceEnd()) {
        this.isInSpecialAction = false;
        this.endSpecialAction();
        this._currentDirection = this.specialActionLastDirection;
      }
      return;
    }

    // C#: switch ((CharacterState)State)
    switch (this._state) {
      case CharacterState.Walk:
      case CharacterState.FightWalk:
        this.updateWalking(deltaTime);
        break;

      case CharacterState.Run:
      case CharacterState.FightRun:
        this.updateRunning(deltaTime);
        break;

      case CharacterState.Jump:
      case CharacterState.FightJump:
        this.updateJumping(deltaTime);
        break;

      case CharacterState.Sit:
        this.updateSitting(deltaTime);
        break;

      case CharacterState.Attack:
      case CharacterState.Attack1:
      case CharacterState.Attack2:
        this.updateAttacking(deltaTime);
        break;

      case CharacterState.Magic:
        this.updateMagic(deltaTime);
        break;

      case CharacterState.Hurt:
        this.updateHurt(deltaTime);
        break;

      case CharacterState.Death:
        this.updateDeath(deltaTime);
        break;

      case CharacterState.Stand:
      case CharacterState.Stand1:
      default:
        this.updateStanding(deltaTime);
        break;
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
      if (this._isMapObstacleForJump && this._isMapObstacleForJump(nextTile)) {
        // C#: TilePosition = TilePosition; // Correcting position
        this.correctPositionToCurrentTile();
        isOver = true;
      } else if (nextTile.x === destTile.x && nextTile.y === destTile.y && this.hasObstacle(nextTile)) {
        // Stay in place - destination has character obstacle
        this.correctPositionToCurrentTile();
        isOver = true;
      } else if (this._hasMapTrapScript && this._hasMapTrapScript(this.tilePosition)) {
        // Stop at trap
        isOver = true;
      } else if (this._getNpcEventer && this._getNpcEventer(nextTile)) {
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
      if (this._movedDistance >= totalDistance - DISTANCE_OFFSET && !isOver) {
        this._movedDistance = 0;
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
      { x: 0, y: -1 },   // North
      { x: 1, y: -1 },   // NorthEast
      { x: 1, y: 0 },    // East
      { x: 1, y: 1 },    // SouthEast
      { x: 0, y: 1 },    // South
      { x: -1, y: 1 },   // SouthWest
      { x: -1, y: 0 },   // West
      { x: -1, y: -1 },  // NorthWest
    ];

    const offset = offsets[dirIndex] || { x: 0, y: 0 };
    return {
      x: tilePos.x + offset.x,
      y: tilePos.y + offset.y,
    };
  }

  // Callback for checking if tile has trap script (set by GameManager)
  protected _hasMapTrapScript?: (pos: Vector2) => boolean;
  protected _isMapObstacleForJump?: (pos: Vector2) => boolean;
  // Callback for getting NPC eventer at tile (set by NpcManager)
  protected _getNpcEventer?: (pos: Vector2) => Character | null;

  /**
   * C#: TilePosition = TilePosition; // Correcting position
   * Snaps pixel position to the center of current tile
   */
  protected correctPositionToCurrentTile(): void {
    const tilePixel = tileToPixel(this._mapX, this._mapY);
    this._positionInWorld = { x: tilePixel.x, y: tilePixel.y };
  }

  /**
   * Set NPC eventer callback for jump obstacle check
   * C# Reference: NpcManager.GetEventer(nextTile)
   */
  setGetNpcEventer(callback: (pos: Vector2) => Character | null): void {
    this._getNpcEventer = callback;
  }

  /**
   * Set map obstacle for jump callback
   * C# Reference: MapBase.Instance.IsObstacleForCharacterJump
   */
  setIsMapObstacleForJump(callback: (pos: Vector2) => boolean): void {
    this._isMapObstacleForJump = callback;
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
   * C#: case CharacterState.Attack - base.Update(); if (IsPlayCurrentDirOnceEnd()) { PlaySoundEffect; OnAttacking(); StandingImmediately(); }
   */
  protected updateAttacking(deltaTime: number): void {
    super.update(deltaTime);
    if (this.isPlayCurrentDirOnceEnd()) {
      // Play attack state sound when animation completes
      // C# Reference: PlaySoundEffect(NpcIni[State].Sound)
      this.playStateSound(this._state);
      this.onAttacking();
      this.standingImmediately();
    }
  }

  /**
   * Update magic casting state
   * C#: case CharacterState.Magic - base.Update(); if (IsPlayCurrentDirOnceEnd()) { UseMagic(); StandingImmediately(); }
   */
  protected updateMagic(deltaTime: number): void {
    super.update(deltaTime);
    if (this.isPlayCurrentDirOnceEnd()) {
      this.onMagicCast();
      this.standingImmediately();
    }
  }

  /**
   * Update hurt state
   * C#: case CharacterState.Hurt - base.Update(); if (IsPlayCurrentDirOnceEnd()) StandingImmediately();
   */
  protected updateHurt(deltaTime: number): void {
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
   * Update standing state
   * C#: case CharacterState.Stand/Stand1 - base.Update();
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
      console.warn(`[Character] No npcIni specified for loadSpritesFromNpcIni`);
      return false;
    }

    // Load NpcRes INI to get state mappings
    const stateMap = await loadNpcRes(iniFile);
    if (!stateMap || stateMap.size === 0) {
      console.warn(`[Character] No state map for npcIni: ${iniFile}`);
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
        const promise = loadCharacterAsf(info.imagePath).then(asf => {
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
      console.warn(`[Character] No basic animations loaded for npcIni: ${iniFile}`);
      return false;
    }

    // Apply sprite set
    this._spriteSet = spriteSet;
    this.npcIni = iniFile;

    // Update texture with custom ASF support
    // C# Reference: Character.Initlize() calls Set() which sets Texture
    this._updateTextureForState(this._state);

    console.log(`[Character] Loaded sprites from NpcRes: ${iniFile}`);
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
   */
  getStateSound(state: CharacterState): string | null {
    return this._stateSounds.get(state) || null;
  }

  /**
   * Set audio manager for playing state sounds
   * C# Reference: Character.PlaySoundEffect()
   */
  setAudioManager(audioManager: AudioManager): void {
    this._audioManager = audioManager;
  }

  /**
   * Play sound effect for a state
   * C# Reference: PlaySoundEffect(NpcIni[(int)CharacterState.Magic].Sound)
   */
  protected playStateSound(state: CharacterState): void {
    const soundPath = this._stateSounds.get(state);
    if (soundPath && this._audioManager) {
      this._audioManager.playSound(soundPath);
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
    // Normalize the ASF path
    let normalizedFileName = asfFileName;
    if (asfFileName.includes('/')) {
      normalizedFileName = asfFileName.split('/').pop() || asfFileName;
    }

    // Load the special action ASF
    const asf = await loadCharacterAsf(normalizedFileName);
    if (!asf) {
      console.warn(`[Character] Failed to load special action ASF: ${normalizedFileName}`);
      return false;
    }

    // C#: IsInSpecialAction = true;
    this.isInSpecialAction = true;
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
    this._animationTime = 0;
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
      console.warn(`[Character] No ASF found for state ${state}`);
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
    console.log(`[Character] Set action file for state ${stateType}: ${asfFile}`);
  }

  /**
   * Clear all custom action files
   * Called when loading a save to reset character state to default sprites
   * C# Reference: In C#, loading creates a new Player object, effectively resetting custom actions
   */
  clearCustomActionFiles(): void {
    this.customActionFiles.clear();
    this._customAsfCache.clear();
    console.log(`[Character] Cleared all custom action files`);
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
      console.log(`[Character] Preloaded custom action file for state ${stateType}: ${asfFile}`);
    } else {
      console.warn(`[Character] Failed to preload custom action file for state ${stateType}: ${asfFile}`);
    }
  }

  /**
   * Draw character
   * 注意：高亮边缘不在这里绘制，而是在所有内容渲染后单独调用 drawHighlight
   * @param isHighlighted Whether to prepare for highlight (不在这里绘制)
   * @param highlightColor The highlight color to use
   */
  override draw(
    ctx: CanvasRenderingContext2D,
    cameraX: number,
    cameraY: number,
    isHighlighted: boolean = false,
    highlightColor: string = "rgba(255, 255, 0, 0.6)"
  ): void {
    if (!this._isVisible) return;
    // 注意：传递 false 而不是 isHighlighted，因为高亮在单独的 drawHighlight 中绘制
    super.draw(ctx, cameraX, cameraY, false, highlightColor);
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
}
