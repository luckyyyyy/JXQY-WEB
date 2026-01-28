/**
 * Character class - based on JxqyHD Engine/Character.cs
 * Abstract base class for all characters (Player, NPC)
 * Extends Sprite with character-specific functionality
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
import { tileToPixel, pixelToTile, getDirection, getDirectionFromVector, findPath, distance } from "../core/utils";
import { Sprite, getAsfForState, loadSpriteSet, createEmptySpriteSet, type SpriteSet } from "../sprite/sprite";
import { loadNpcRes, loadCharacterAsf } from "./resFile";
import type { AsfData } from "../sprite/asf";
import type { AudioManager } from "../audio";

/**
 * 加载中状态标记（-1），用于在精灵加载前临时设置，确保后续设置真正 state 时触发纹理更新
 */
export const LOADING_STATE = -1 as CharacterState;

/**
 * Character update result
 */
export interface CharacterUpdateResult {
  moved: boolean;
  reachedDestination: boolean;
  triggeredScript?: string;
}

/**
 * Character class - abstract base for Player and NPC
 * Based on C# Engine/Character.cs
 */
export abstract class Character extends Sprite {
  // ============= Character Identity (C# Character.cs) =============
  // C#: _name
  protected _name: string = "";
  // C#: _kind (CharacterKind enum)
  protected _kind: CharacterKind = 0;
  // C#: _relation (RelationType enum)
  protected _relation: RelationType = 2; // None
  // C#: _group
  protected _group: number = 0;

  // ============= Character Stats =============
  // C#: _life, _lifeMax
  protected _life: number = 100;
  protected _lifeMax: number = 100;
  // C#: _mana, _manaMax
  protected _mana: number = 100;
  protected _manaMax: number = 100;
  // C#: _thew, _thewMax (stamina)
  protected _thew: number = 100;
  protected _thewMax: number = 100;
  // C#: _attack, _attack2, _attack3
  protected _attack: number = 10;
  protected _attack2: number = 0;
  protected _attack3: number = 0;
  // C#: _attackLevel
  protected _attackLevel: number = 0;
  // C#: _defend, _defend2, _defend3
  protected _defend: number = 10;
  protected _defend2: number = 0;
  protected _defend3: number = 0;
  // C#: _evade
  protected _evade: number = 0;
  // C#: _exp, _levelUpExp, _level
  protected _exp: number = 0;
  protected _levelUpExp: number = 100;
  protected _level: number = 1;
  // C#: _canLevelUp
  protected _canLevelUp: number = 1;

  // ============= Movement & Interaction =============
  // C#: _walkSpeed
  protected _walkSpeed: number = 1;
  // C#: _addMoveSpeedPercent
  protected _addMoveSpeedPercent: number = 0;
  // C#: _visionRadius
  protected _visionRadius: number = 20;
  // C#: _attackRadius
  protected _attackRadius: number = 10;
  // C#: _dialogRadius
  protected _dialogRadius: number = 3;

  // ============= Character State =============
  // C#: _state (CharacterState enum)
  protected _state: CharacterState = CharacterState.Stand;
  // C#: _path
  protected _path: Vector2[] = [];
  // C#: _isVisible
  protected _isVisible: boolean = true;

  // ============= Configuration Files =============
  // C#: _npcIni (resource file name)
  protected _npcIni: string = "";
  // C#: _flyIni, _flyIni2
  protected _flyIni: string = "";
  protected _flyIni2: string = "";
  // C#: _bodyIni
  protected _bodyIni: string = "";
  // C#: _scriptFile
  protected _scriptFile: string = "";
  // C#: _scriptFileRight
  protected _scriptFileRight: string = "";
  // C#: _deathScript
  protected _deathScript: string = "";
  // C#: _timerScript, _timerInterval
  protected _timerScript: string = "";
  protected _timerInterval: number = 0;
  // C#: _pathFinder
  protected _pathFinder: number = 0;
  // C#: _noAutoAttackPlayer
  protected _noAutoAttackPlayer: number = 0;
  // C#: _canInteractDirectly
  protected _canInteractDirectly: number = 0;

  // ============= Other =============
  // C#: _lum (brightness)
  protected _lum: number = 0;
  // C#: _action
  protected _action: number = 0;

  // ============= Special Action State =============
  // C#: IsInSpecialAction
  protected _isInSpecialAction: boolean = false;
  // C#: _specialActionLastDirection
  protected _specialActionLastDirection: number = 4;
  // C#: Special action frame tracking
  protected _specialActionFrame: number = 0;
  // Special action ASF file for magic casting animation
  protected _specialActionAsf: string | undefined = undefined;
  // Custom action files mapping (state -> ASF file)
  protected _customActionFiles: Map<number, string> = new Map();

  // ============= Walkability Checker =============
  protected _isWalkable: ((tile: Vector2) => boolean) | null = null;
  protected _isMapObstacle: ((tile: Vector2) => boolean) | null = null;

  // ============= State Sounds (C# NpcIni[state].Sound) =============
  // Map of CharacterState to sound file path (e.g., Magic -> "攻-男03.wav")
  protected _stateSounds: Map<number, string> = new Map();

  // ============= Audio Manager Reference =============
  protected _audioManager: AudioManager | null = null;

  constructor() {
    super();
  }

  // ============= Walkability Checker Getter =============

  /**
   * Get the walkability checker function
   * Used by InputHandler for interaction pathfinding
   */
  get isWalkable(): ((tile: Vector2) => boolean) | null {
    return this._isWalkable;
  }

  // ============= Identity Properties =============

  get name(): string {
    return this._name;
  }

  set name(value: string) {
    this._name = value;
  }

  get kind(): CharacterKind {
    return this._kind;
  }

  set kind(value: CharacterKind) {
    this._kind = value;
  }

  get relation(): RelationType {
    return this._relation;
  }

  set relation(value: RelationType) {
    this._relation = value;
  }

  /**
   * 是否为敌人
   * 对应 C# Character.cs 中的 IsEnemy 属性
   */
  get isEnemy(): boolean {
    return this._relation === RelationType.Enemy;
  }

  /**
   * 是否为友方
   */
  get isFriend(): boolean {
    return this._relation === RelationType.Friend;
  }

  /**
   * 是否为中立关系
   * C#: IsRelationNeutral
   */
  get isRelationNeutral(): boolean {
    return this._relation === RelationType.None;
  }

  /**
   * 是否为非战斗者（中立+战士类型）
   * C#: IsNoneFighter = Relation == RelationType.None && Kind == 1
   */
  get isNoneFighter(): boolean {
    return this._relation === RelationType.None && this._kind === CharacterKind.Fighter;
  }

  /**
   * 是否为友方战士
   * C#: IsFighterFriend = ((Kind == 1 || Kind == 3) && Relation == 0)
   * 注意：C# 中 Relation == 0 是 Enemy，但根据名称应该是 Friend
   * 实际 C# 逻辑是检查 Relation == 0（Friend枚举值）
   */
  get isFighterFriend(): boolean {
    return (this._kind === CharacterKind.Fighter || this._kind === CharacterKind.Follower) &&
           this._relation === RelationType.Friend;
  }

  /**
   * 是否为战士类型
   * C#: IsFighterKind = Kind == CharacterKind.Fighter
   */
  get isFighterKind(): boolean {
    return this._kind === CharacterKind.Fighter;
  }

  /**
   * 是否为战士（战士类型或伙伴）
   * C#: IsFighter = IsFighterKind || IsPartner
   */
  get isFighter(): boolean {
    return this.isFighterKind || this.isPartner;
  }

  /**
   * 是否为伙伴
   * C#: IsPartner = Kind == 3
   */
  get isPartner(): boolean {
    return this._kind === CharacterKind.Follower;
  }

  /**
   * 是否为事件角色
   * C#: IsEventCharacter = Kind == CharacterKind.Eventer
   */
  get isEventCharacter(): boolean {
    return this._kind === CharacterKind.Eventer;
  }

  /**
   * 是否有交互脚本
   * C#: HasInteractScript = !string.IsNullOrEmpty(ScriptFile)
   */
  get hasInteractScript(): boolean {
    return this._scriptFile !== "";
  }

  /**
   * 是否有右键交互脚本
   * C#: HasInteractScriptRight = !string.IsNullOrEmpty(ScriptFileRight)
   */
  get hasInteractScriptRight(): boolean {
    return this._scriptFileRight !== "";
  }

  /**
   * 是否可交互
   * C#: IsInteractive = (HasInteractScript || HasInteractScriptRight || IsEnemy || IsFighterFriend || IsNoneFighter)
   */
  get isInteractive(): boolean {
    return this.hasInteractScript || this.hasInteractScriptRight ||
           this.isEnemy || this.isFighterFriend || this.isNoneFighter;
  }

  get group(): number {
    return this._group;
  }

  set group(value: number) {
    this._group = value;
  }

  // ============= Stats Properties =============

  get life(): number {
    return this._life;
  }

  set life(value: number) {
    this._life = Math.max(0, Math.min(value, this._lifeMax));
  }

  get lifeMax(): number {
    return this._lifeMax;
  }

  set lifeMax(value: number) {
    this._lifeMax = Math.max(1, value);
    if (this._life > this._lifeMax) this._life = this._lifeMax;
  }

  get mana(): number {
    return this._mana;
  }

  set mana(value: number) {
    this._mana = Math.max(0, Math.min(value, this._manaMax));
  }

  get manaMax(): number {
    return this._manaMax;
  }

  set manaMax(value: number) {
    this._manaMax = Math.max(1, value);
    if (this._mana > this._manaMax) this._mana = this._manaMax;
  }

  get thew(): number {
    return this._thew;
  }

  set thew(value: number) {
    this._thew = Math.max(0, Math.min(value, this._thewMax));
  }

  get thewMax(): number {
    return this._thewMax;
  }

  set thewMax(value: number) {
    this._thewMax = Math.max(1, value);
    if (this._thew > this._thewMax) this._thew = this._thewMax;
  }

  get attack(): number {
    return this._attack;
  }

  set attack(value: number) {
    this._attack = value;
  }

  get attack2(): number {
    return this._attack2;
  }

  set attack2(value: number) {
    this._attack2 = value;
  }

  get attack3(): number {
    return this._attack3;
  }

  set attack3(value: number) {
    this._attack3 = value;
  }

  get attackLevel(): number {
    return this._attackLevel;
  }

  set attackLevel(value: number) {
    this._attackLevel = value;
  }

  get defend(): number {
    return this._defend;
  }

  set defend(value: number) {
    this._defend = value;
  }

  get defend2(): number {
    return this._defend2;
  }

  set defend2(value: number) {
    this._defend2 = value;
  }

  get defend3(): number {
    return this._defend3;
  }

  set defend3(value: number) {
    this._defend3 = value;
  }

  get evade(): number {
    return this._evade;
  }

  set evade(value: number) {
    this._evade = value;
  }

  get exp(): number {
    return this._exp;
  }

  set exp(value: number) {
    this._exp = value;
  }

  get levelUpExp(): number {
    return this._levelUpExp;
  }

  set levelUpExp(value: number) {
    this._levelUpExp = value;
  }

  get level(): number {
    return this._level;
  }

  set level(value: number) {
    this._level = value;
  }

  get canLevelUp(): number {
    return this._canLevelUp;
  }

  set canLevelUp(value: number) {
    this._canLevelUp = value;
  }

  // ============= Movement Properties =============

  get walkSpeed(): number {
    return this._walkSpeed;
  }

  set walkSpeed(value: number) {
    this._walkSpeed = value;
  }

  get addMoveSpeedPercent(): number {
    return this._addMoveSpeedPercent;
  }

  set addMoveSpeedPercent(value: number) {
    this._addMoveSpeedPercent = value;
  }

  get visionRadius(): number {
    return this._visionRadius;
  }

  set visionRadius(value: number) {
    this._visionRadius = value;
  }

  get attackRadius(): number {
    return this._attackRadius;
  }

  set attackRadius(value: number) {
    this._attackRadius = value;
  }

  get dialogRadius(): number {
    return this._dialogRadius;
  }

  set dialogRadius(value: number) {
    this._dialogRadius = value;
  }

  // ============= State Properties =============

  get state(): CharacterState {
    return this._state;
  }

  set state(value: CharacterState) {
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
    if (this._customActionFiles.has(state)) {
      // Trigger async load - will be available next frame
      const asfFile = this._customActionFiles.get(state)!;
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

  get path(): Vector2[] {
    return this._path;
  }

  set path(value: Vector2[]) {
    this._path = value;
  }

  // ============= Interface Compatibility Properties =============
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

  // ============= Configuration Properties =============

  get npcIni(): string {
    return this._npcIni;
  }

  set npcIni(value: string) {
    this._npcIni = value;
  }

  get flyIni(): string {
    return this._flyIni;
  }

  set flyIni(value: string) {
    this._flyIni = value;
  }

  get flyIni2(): string {
    return this._flyIni2;
  }

  set flyIni2(value: string) {
    this._flyIni2 = value;
  }

  get bodyIni(): string {
    return this._bodyIni;
  }

  set bodyIni(value: string) {
    this._bodyIni = value;
  }

  get scriptFile(): string {
    return this._scriptFile;
  }

  set scriptFile(value: string) {
    this._scriptFile = value;
  }

  get scriptFileRight(): string {
    return this._scriptFileRight;
  }

  set scriptFileRight(value: string) {
    this._scriptFileRight = value;
  }

  get deathScript(): string {
    return this._deathScript;
  }

  set deathScript(value: string) {
    this._deathScript = value;
  }

  get timerScript(): string {
    return this._timerScript;
  }

  set timerScript(value: string) {
    this._timerScript = value;
  }

  get timerInterval(): number {
    return this._timerInterval;
  }

  set timerInterval(value: number) {
    this._timerInterval = value;
  }

  get pathFinder(): number {
    return this._pathFinder;
  }

  set pathFinder(value: number) {
    this._pathFinder = value;
  }

  get noAutoAttackPlayer(): number {
    return this._noAutoAttackPlayer;
  }

  set noAutoAttackPlayer(value: number) {
    this._noAutoAttackPlayer = value;
  }

  get canInteractDirectly(): number {
    return this._canInteractDirectly;
  }

  set canInteractDirectly(value: number) {
    this._canInteractDirectly = value;
  }

  // ============= Other Properties =============

  get lum(): number {
    return this._lum;
  }

  set lum(value: number) {
    this._lum = value;
  }

  get action(): number {
    return this._action;
  }

  set action(value: number) {
    this._action = value;
  }

  // ============= Special Action =============

  get isInSpecialAction(): boolean {
    return this._isInSpecialAction;
  }

  set isInSpecialAction(value: boolean) {
    this._isInSpecialAction = value;
  }

  get specialActionLastDirection(): number {
    return this._specialActionLastDirection;
  }

  set specialActionLastDirection(value: number) {
    this._specialActionLastDirection = value;
  }

  get specialActionAsf(): string | undefined {
    return this._specialActionAsf;
  }

  set specialActionAsf(value: string | undefined) {
    this._specialActionAsf = value;
  }

  get specialActionFrame(): number | undefined {
    return this._specialActionFrame;
  }

  set specialActionFrame(value: number | undefined) {
    this._specialActionFrame = value ?? 0;
  }

  get customActionFiles(): Map<number, string> {
    return this._customActionFiles;
  }

  set customActionFiles(value: Map<number, string>) {
    this._customActionFiles = value;
  }

  // ============= Methods =============

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
   */
  loadFromConfig(config: CharacterConfig): void {
    this._name = config.name || "";
    this._npcIni = config.npcIni || "";
    this._flyIni = config.flyIni || "";
    this._flyIni2 = config.flyIni2 || "";
    this._bodyIni = config.bodyIni || "";
    this._kind = config.kind;
    this._relation = config.relation;
    this._group = config.group || 0;
    this._noAutoAttackPlayer = config.noAutoAttackPlayer || 0;
    this._scriptFile = config.scriptFile || "";
    this._scriptFileRight = config.scriptFileRight || "";
    this._deathScript = config.deathScript || "";
    this._timerScript = config.timerScript || "";
    this._timerInterval = config.timerInterval || 0;
    this._pathFinder = config.pathFinder || 0;
    this._canInteractDirectly = config.canInteractDirectly || 0;

    // Load stats
    const stats = config.stats;
    this._life = stats.life;
    this._lifeMax = stats.lifeMax;
    this._mana = stats.mana;
    this._manaMax = stats.manaMax;
    this._thew = stats.thew;
    this._thewMax = stats.thewMax;
    this._attack = stats.attack;
    this._attack2 = stats.attack2;
    this._attack3 = stats.attack3;
    this._attackLevel = stats.attackLevel;
    this._defend = stats.defend;
    this._defend2 = stats.defend2;
    this._defend3 = stats.defend3;
    this._evade = stats.evade;
    this._exp = stats.exp;
    this._levelUpExp = stats.levelUpExp;
    this._level = stats.level;
    this._canLevelUp = stats.canLevelUp;
    this._walkSpeed = stats.walkSpeed;
    this._addMoveSpeedPercent = stats.addMoveSpeedPercent;
    this._visionRadius = stats.visionRadius;
    this._attackRadius = stats.attackRadius;
    this._dialogRadius = stats.dialogRadius;
    this._lum = stats.lum;
    this._action = stats.action;
  }

  /**
   * Get character config (for serialization)
   */
  getConfig(): CharacterConfig {
    return {
      name: this._name,
      npcIni: this._npcIni,
      flyIni: this._flyIni,
      flyIni2: this._flyIni2,
      bodyIni: this._bodyIni,
      kind: this._kind,
      relation: this._relation,
      group: this._group,
      noAutoAttackPlayer: this._noAutoAttackPlayer,
      scriptFile: this._scriptFile,
      scriptFileRight: this._scriptFileRight,
      deathScript: this._deathScript,
      timerScript: this._timerScript,
      timerInterval: this._timerInterval,
      pathFinder: this._pathFinder,
      canInteractDirectly: this._canInteractDirectly,
      stats: this.getStats(),
    };
  }

  /**
   * Get character stats
   */
  getStats(): CharacterStats {
    return {
      life: this._life,
      lifeMax: this._lifeMax,
      mana: this._mana,
      manaMax: this._manaMax,
      thew: this._thew,
      thewMax: this._thewMax,
      attack: this._attack,
      attack2: this._attack2,
      attack3: this._attack3,
      attackLevel: this._attackLevel,
      defend: this._defend,
      defend2: this._defend2,
      defend3: this._defend3,
      evade: this._evade,
      exp: this._exp,
      levelUpExp: this._levelUpExp,
      level: this._level,
      canLevelUp: this._canLevelUp,
      walkSpeed: this._walkSpeed,
      addMoveSpeedPercent: this._addMoveSpeedPercent,
      visionRadius: this._visionRadius,
      attackRadius: this._attackRadius,
      dialogRadius: this._dialogRadius,
      lum: this._lum,
      action: this._action,
    };
  }

  /**
   * Set position by tile coordinates
   */
  setPosition(tileX: number, tileY: number): void {
    this._mapX = tileX;
    this._mapY = tileY;
    this._updatePositionFromTile();
    this._path = [];
  }

  /**
   * C#: MoveTo(direction, elapsedSeconds)
   * Move character in a direction
   */
  moveTo(direction: number, elapsedSeconds: number): void {
    // C#: ChangeMoveSpeedFold = 1 + AddMoveSpeedPercent / 100 (min -90%)
    const speedPercent = Math.max(MIN_CHANGE_MOVE_SPEED_PERCENT, this._addMoveSpeedPercent);
    const changeMoveSpeedFold = 1 + speedPercent / 100;
    const speed = BASE_SPEED * this._walkSpeed * changeMoveSpeedFold;
    const moveDistance = speed * elapsedSeconds;

    // Direction vectors (simplified)
    const vectors = [
      { x: 0, y: -1 },   // North
      { x: 0.7, y: -0.7 }, // NorthEast
      { x: 1, y: 0 },    // East
      { x: 0.7, y: 0.7 }, // SouthEast
      { x: 0, y: 1 },    // South
      { x: -0.7, y: 0.7 }, // SouthWest
      { x: -1, y: 0 },   // West
      { x: -0.7, y: -0.7 }, // NorthWest
    ];

    const vec = vectors[direction] || { x: 0, y: 0 };
    this._positionInWorld.x += vec.x * moveDistance;
    this._positionInWorld.y += vec.y * moveDistance;
    this._currentDirection = direction;

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

    if (this._path.length === 0) {
      if (this._state === CharacterState.Walk || this._state === CharacterState.Run) {
        this.state = CharacterState.Stand;
      }
      return result;
    }

    // Get next waypoint
    const target = this._path[0];
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
      this._path.shift();
      result.moved = true;

      if (this._path.length === 0) {
        this.state = CharacterState.Stand;
        result.reachedDestination = true;
      }
    } else {
      // Move towards waypoint
      // C#: MoveAlongPath(deltaTime * ChangeMoveSpeedFold, speedFold)
      //     然后调用 MoveTo(direction, elapsedSeconds * speedFold)
      //     速度 = velocity * elapsedSeconds = 100 * deltaTime * ChangeMoveSpeedFold * speedFold
      // Walk时 speedFold = WalkSpeed, Run时 speedFold = RunSpeedFold (不同时乘!)
      const speedPercent = Math.max(MIN_CHANGE_MOVE_SPEED_PERCENT, this._addMoveSpeedPercent);
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
   * C#: WalkTo(destination)
   * Walk to a tile destination
   */
  walkTo(destTile: Vector2): boolean {
    if (!this._isWalkable) return false;

    if (this._mapX === destTile.x && this._mapY === destTile.y) {
      return true;
    }

    const path = findPath(
      { x: this._mapX, y: this._mapY },
      destTile,
      this._isWalkable,
      500,
      this._isMapObstacle || undefined
    );

    if (path.length === 0) {
      this._path = [];
      this.state = CharacterState.Stand;
      return false;
    }

    this._path = path.slice(1);
    this.state = CharacterState.Walk;
    return true;
  }

  /**
   * C#: RunTo(destination)
   * Run to a tile destination
   */
  runTo(destTile: Vector2): boolean {
    if (!this._isWalkable) return false;

    if (this._mapX === destTile.x && this._mapY === destTile.y) {
      return true;
    }

    if (this._state === CharacterState.Run) {
      const path = findPath(
        { x: this._mapX, y: this._mapY },
        destTile,
        this._isWalkable,
        500,
        this._isMapObstacle || undefined
      );
      if (path.length > 0) {
        this._path = path.slice(1);
      }
      return true;
    }

    const path = findPath(
      { x: this._mapX, y: this._mapY },
      destTile,
      this._isWalkable,
      500,
      this._isMapObstacle || undefined
    );

    if (path.length === 0) {
      this._path = [];
      this.state = CharacterState.Stand;
      return false;
    }

    this._path = path.slice(1);
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
   */
  standingImmediately(): void {
    this._path = [];
    this.state = CharacterState.Stand;
  }

  /**
   * C#: FullLife()
   */
  fullLife(): void {
    this._life = this._lifeMax;
  }

  /**
   * C#: FullThew()
   */
  fullThew(): void {
    this._thew = this._thewMax;
  }

  /**
   * C#: FullMana()
   */
  fullMana(): void {
    this._mana = this._manaMax;
  }

  /**
   * Add life (can be negative for damage)
   */
  addLife(amount: number): void {
    this._life = Math.max(0, Math.min(this._life + amount, this._lifeMax));
  }

  /**
   * Add thew
   */
  addThew(amount: number): void {
    this._thew = Math.max(0, Math.min(this._thew + amount, this._thewMax));
  }

  /**
   * Add mana
   */
  addMana(amount: number): void {
    this._mana = Math.max(0, Math.min(this._mana + amount, this._manaMax));
  }

  /**
   * Is character dead
   */
  isDead(): boolean {
    return this._life <= 0;
  }

  /**
   * C#: Update(gameTime)
   * State-machine driven update - based on C# Character.cs switch ((CharacterState)State)
   * Each state has its own update method that subclasses can override
   */
  override update(deltaTime: number): void {
    if (!this._isVisible) return;

    // C#: if (IsInSpecialAction) { base.Update(); if (IsPlayCurrentDirOnceEnd()) ... return; }
    if (this._isInSpecialAction) {
      super.update(deltaTime);
      if (this.isPlayCurrentDirOnceEnd()) {
        this._isInSpecialAction = false;
        this.endSpecialAction();
        this._currentDirection = this._specialActionLastDirection;
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

  // ============= State Update Methods (can be overridden by subclasses) =============

  /**
   * Update walking state
   * C#: case CharacterState.Walk/FightWalk - MoveAlongPath + Update with WalkSpeed
   */
  protected updateWalking(deltaTime: number): void {
    this.moveAlongPath(deltaTime, this._walkSpeed);
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
   * TODO: Implement jumping logic when combat system is added
   */
  protected updateJumping(deltaTime: number): void {
    super.update(deltaTime);
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
    super.update(deltaTime);
    // Death animation plays once then stays at last frame
  }

  /**
   * Update standing state
   * C#: case CharacterState.Stand/Stand1 - base.Update();
   */
  protected updateStanding(deltaTime: number): void {
    super.update(deltaTime);
  }

  // ============= Action Hooks (can be overridden by subclasses) =============

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
    const iniFile = npcIni || this._npcIni;
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
    this._npcIni = iniFile;

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

  // ============= Special Action Methods (from renderer.ts) =============

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
    this._isInSpecialAction = true;
    // C#: _specialActionLastDirection = CurrentDirection;
    this._specialActionLastDirection = this._currentDirection;
    // C#: EndPlayCurrentDirOnce(); - Stop any current animation first!
    this.endPlayCurrentDirOnce();

    // C#: Texture = Utils.GetCharacterAsf(asfFileName);
    this._texture = asf;
    this._specialActionFrame = 0;

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
    if (!this._isInSpecialAction) return true;
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

    console.log(`[Character] Playing state ${state} once, frames: ${asf.framesPerDirection}`);
    return true;
  }

  /**
   * Set custom action file for a character state
   * Based on C# Character.SetNpcActionFile()
   */
  setNpcActionFile(stateType: number, asfFile: string): void {
    this._customActionFiles.set(stateType, asfFile);
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
    this._customActionFiles.clear();
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
    return dist <= this._dialogRadius * TILE_WIDTH * 2;
  }
}
