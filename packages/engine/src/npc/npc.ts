/**
 * Npc 类
 * 继承 Character，实现 AI、巡逻、战斗等 NPC 特有功能
 */

import { Character } from "../character";
import { loadNpcConfig } from "../character/resFile";
import { logger } from "../core/logger";
import { PathType } from "../core/pathFinder";
import type { CharacterConfig, Vector2 } from "../core/types";
import { CharacterKind, CharacterState } from "../core/types";
import type { MagicManager } from "../magic";
import type { MagicData } from "../magic/types";
import type { AsfData } from "../sprite/asf";
import { generateId, getDirectionFromVector, tileToPixel } from "../utils";
import { NpcAI, NpcMagicCache } from "./modules";
import type { NpcManager } from "./npcManager";

/** Npc 类*/
export class Npc extends Character {
  private _id: string;
  private _actionPathTilePositions: Vector2[] | null = null;
  private _idledFrame: number = 0;
  private _isAIDisabled: boolean = false;
  private _blindMilliseconds: number = 0;

  // AI path for LoopWalk from FixedPos config
  private _fixedPathTilePositions: Vector2[] | null = null;

  // Script destination position
  private _destinationMapPosX: number = 0;
  private _destinationMapPosY: number = 0;
  protected _moveTargetChanged: boolean = false;

  // NpcManager 和 Player 现在通过 IEngineContext 获取

  // Magic cache - 使用 NpcMagicCache 模块管理武功缓存
  private _magicCache!: NpcMagicCache;

  // AI behavior - 使用 NpcAI 模块管理 AI 行为
  private _ai!: NpcAI;

  constructor(id?: string) {
    super();
    this._id = id || generateId();
  }

  /**
   * 初始化模块（在配置加载后调用）
   */
  private initModules(): void {
    this._magicCache = new NpcMagicCache(this.attackLevel || 1);
    this._ai = new NpcAI(this, {
      getNpcManager: () => this.npcManager,
      getPlayer: () => this.player,
      getViewTileDistance: (from, to) => this.getViewTileDistance(from, to),
      canViewTarget: (from, to, max) => this.canViewTarget(from, to, max),
      getRandTilePath: (len, ignore, retry) => this.getRandTilePath(len, ignore, retry),
      loopWalk: (path, prob, flyer) => this.loopWalk(path, prob, flyer),
      randWalk: (path, prob, flyer) => this.randWalk(path, prob, flyer),
    });
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
   * 获取 Player（通过 IEngineContext）
   */
  private get player(): Character {
    return this.engine.player as unknown as Character;
  }

  // === Properties ===

  /**
   * override
   *
   * NPC PathType depends on Kind, relation, and _pathFinder value:
   * - Flyer: PathStraightLine (ignores obstacles)
   * - PathFinder=1 or IsPartner: PerfectMaxNpcTry
   * - Normal NPC (Kind=0 or 5): PerfectMaxPlayerTry
   * - PathFinder=0 or IsInLoopWalk or IsEnemy: PathOneStep
   * - Default: PerfectMaxNpcTry
   */
  override getPathType(): PathType {
    if (this.kind === CharacterKind.Flyer) {
      return PathType.PathStraightLine;
    }

    if (this.pathFinder === 1 || this.isPartner) {
      return PathType.PerfectMaxNpcTry;
    }

    if (this.kind === CharacterKind.Normal || this.kind === CharacterKind.Eventer) {
      return PathType.PerfectMaxPlayerTry;
    }

    if (this.pathFinder === 0 || this._isInLoopWalk || this.isEnemy) {
      return PathType.PathOneStep;
    }

    // Default
    return PathType.PerfectMaxNpcTry;
  }

  get id(): string {
    return this._id;
  }

  get actionPathTilePositions(): Vector2[] {
    if (this._actionPathTilePositions === null) {
      this._actionPathTilePositions = this.getRandTilePath(8, this.kind === CharacterKind.Flyer);
    }
    return this._actionPathTilePositions;
  }

  set actionPathTilePositions(value: Vector2[]) {
    this._actionPathTilePositions = value;
  }

  get idledFrame(): number {
    return this._idledFrame;
  }

  set idledFrame(value: number) {
    this._idledFrame = value;
  }

  get isAIDisabled(): boolean {
    return this._isAIDisabled;
  }

  set isAIDisabled(value: boolean) {
    this._isAIDisabled = value;
  }

  get blindMilliseconds(): number {
    return this._blindMilliseconds;
  }

  set blindMilliseconds(value: number) {
    this._blindMilliseconds = value;
  }

  get actionType(): number {
    return this.action;
  }

  set actionType(value: number) {
    this.action = value;
  }

  // followTarget, isFollowTargetFound - inherited from Character
  // idle, aiType, stopFindingTarget, keepRadiusWhenLifeLow, lifeLowPercent, keepRadiusWhenFriendDeath - inherited from Character

  get destinationMapPosX(): number {
    return this._destinationMapPosX;
  }

  set destinationMapPosX(value: number) {
    this._destinationMapPosX = value;
  }

  get destinationMapPosY(): number {
    return this._destinationMapPosY;
  }

  set destinationMapPosY(value: number) {
    this._destinationMapPosY = value;
  }

  // aiType getter/setter - inherited from Character

  /**
   * IsRandMoveRandAttack => AIType == 1 || AIType == 2
   */
  get isRandMoveRandAttack(): boolean {
    return this.aiType === 1 || this.aiType === 2;
  }

  /**
   * IsNotFightBackWhenBeHit => AIType == 2
   */
  get isNotFightBackWhenBeHit(): boolean {
    return this.aiType === 2;
  }

  get fixedPathTilePositions(): Vector2[] | null {
    return this._fixedPathTilePositions;
  }

  set fixedPathTilePositions(value: Vector2[] | null) {
    this._fixedPathTilePositions = value;
  }

  /** 移动目标是否已改变（供 AI 模块使用）*/
  get moveTargetChanged(): boolean {
    return this._moveTargetChanged;
  }

  set moveTargetChanged(value: boolean) {
    this._moveTargetChanged = value;
  }

  // === Setup ===

  // NpcManager 和 Player 现在通过 getter 从 IEngineContext 获取，无需 setAIReferences

  /**
   * 预加载 NPC 的所有武功（唯一的异步入口）
   * Magic objects are loaded when Character is constructed
   *
   * 使用 NpcMagicCache 模块管理，参考 Player 的 MagicListManager.addMagic 模式
   */
  async loadAllMagics(): Promise<void> {
    return this._magicCache.loadAll(
      this._flyIniInfos,
      {
        lifeLow: this.magicToUseWhenLifeLow,
        beAttacked: this.magicToUseWhenBeAttacked,
        death: this.magicToUseWhenDeath,
      },
      this.name
    );
  }

  /**
   * 获取已缓存的武功数据（同步）
   * 如果未缓存，返回 null（需要先调用 loadAllMagics）
   */
  getCachedMagic(magicIni: string): MagicData | null {
    return this._magicCache.get(magicIni);
  }

  // === Factory Methods ===

  /**
   * Create NPC from config file path
   * (string filePath) constructor
   */
  static async fromFile(
    configPath: string,
    tileX: number,
    tileY: number,
    direction: number = 4
  ): Promise<Npc | null> {
    const config = await loadNpcConfig(configPath);
    if (!config) {
      return null;
    }
    return Npc.fromConfig(config, tileX, tileY, direction);
  }

  /**
   * Create NPC from config object
   * (KeyDataCollection) constructor
   */
  static fromConfig(
    config: CharacterConfig,
    tileX: number,
    tileY: number,
    direction: number = 4
  ): Npc {
    const npc = new Npc();
    npc.loadFromConfig(config);
    npc.initModules(); // 配置加载后初始化模块
    npc.setPosition(tileX, tileY);
    npc._currentDirection = direction;
    return npc;
  }

  // === Death Handling ===

  /**
   * Override death to run death script
   * Character.Death() runs _currentRunDeathScript = ScriptManager.RunScript(DeathScript, this)
   */
  override death(killer: Character | null = null): void {
    if (this.isDeathInvoked) return;

    // Call base implementation first (sets state and flags)
    super.death(killer);

    // 如果是召唤物，基类已经 return 了，后续代码不会执行
    // 检查 isDeath 来判断是否是召唤物情况（召唤物在基类中设置 isDeath=true 并 return）
    if (this.isDeath && !this.isInDeathing) {
      return; // 召唤物在基类中已完全处理
    }

    // 使用死亡时的武功 (MagicToUseWhenDeath)
    this.useMagicWhenDeath(killer);

    // NpcManager.AddDead(this)
    this.npcManager.addDead(this);

    // Run death script
    if (this.deathScript) {
      logger.log(`[NPC] ${this.name} running death script: ${this.deathScript}`);
      this.npcManager.runDeathScript(this.deathScript, this);
    }
  }

  /**
   * 使用死亡时的武功
   * 检查 MagicToUseWhenDeath
   *
   * 逻辑:
   * if (character.MagicToUseWhenDeath != null) {
   *     var magicDirectionType = character.MagicDirectionWhenDeath;
   *     Vector2 magicDirection = 根据 magicDirectionType 计算方向;
   *     MagicManager.UseMagic(character, MagicToUseWhenDeath, position, position + magicDirection);
   * }
   */
  private useMagicWhenDeath(killer: Character | null): void {
    const magic = this._magicCache.getSpecial("death");
    if (!magic) {
      return;
    }

    // MagicDirectionWhenDeath 决定武功方向
    // 0 = 当前朝向, 1 = 朝向攻击者, 2 = 攻击者位置
    const dirType = this.magicDirectionWhenDeath;
    let destination: Vector2;

    if (dirType === 1 && killer) {
      // 朝向攻击者方向
      const dx = killer.pixelPosition.x - this._positionInWorld.x;
      const dy = killer.pixelPosition.y - this._positionInWorld.y;
      const len = Math.sqrt(dx * dx + dy * dy);
      if (len > 0) {
        destination = {
          x: this._positionInWorld.x + (dx / len) * 32,
          y: this._positionInWorld.y + (dy / len) * 32,
        };
      } else {
        destination = { ...this._positionInWorld };
      }
    } else if (dirType === 2 && killer) {
      // 攻击者位置
      destination = { ...killer.pixelPosition };
    } else {
      // 当前朝向 (默认)
      const dirOffsets = [
        { x: 0, y: 32 }, // 0: South
        { x: -23, y: 23 }, // 1: SouthWest
        { x: -32, y: 0 }, // 2: West
        { x: -23, y: -23 }, // 3: NorthWest
        { x: 0, y: -32 }, // 4: North
        { x: 23, y: -23 }, // 5: NorthEast
        { x: 32, y: 0 }, // 6: East
        { x: 23, y: 23 }, // 7: SouthEast
      ];
      const offset = dirOffsets[this._currentDirection] || { x: 0, y: 32 };
      destination = {
        x: this._positionInWorld.x + offset.x,
        y: this._positionInWorld.y + offset.y,
      };
    }

    logger.log(`[NPC] ${this.name} uses MagicToUseWhenDeath: ${this.magicToUseWhenDeath}`);

    this.magicManager.useMagic({
      userId: this._id,
      magic: magic,
      origin: this._positionInWorld,
      destination,
    });
  }

  // === AI Update ===

  /**
   * Update(gameTime)
   * Main NPC update method - 使用 NpcAI 模块处理 AI 逻辑
   */
  override update(deltaTime: number): void {
    // if(!IsVisibleByVariable) { return; }
    if (!this.isVisibleByVariable) return;

    // Dead NPCs only update death animation, no AI
    if (this.isDeathInvoked || this.isDeath) {
      super.update(deltaTime);
      return;
    }

    // if(_controledMagicSprite != null) { base.Update(); return; }
    // Skip if controlled by magic (not implemented yet)

    // 使用 AI 模块更新 AI 行为
    this._ai.update(deltaTime);

    // Parent update (movement and animation)
    super.update(deltaTime);
  }

  // === AI 公共方法（供 NpcAI 模块调用）===

  /**
   * Use magic when life is low - 公开给 AI 模块使用
   * PerformeAttack(PositionInWorld + Utils.GetDirection8(CurrentDirection), MagicToUseWhenLifeLow)
   */
  useMagicWhenLifeLow(): void {
    const magic = this._magicCache.getSpecial("lifeLow");
    if (!magic) {
      return;
    }

    // Get direction offset for current direction
    const dirOffsets = [
      { x: 0, y: 32 }, // 0: South
      { x: -23, y: 23 }, // 1: SouthWest
      { x: -32, y: 0 }, // 2: West
      { x: -23, y: -23 }, // 3: NorthWest
      { x: 0, y: -32 }, // 4: North
      { x: 23, y: -23 }, // 5: NorthEast
      { x: 32, y: 0 }, // 6: East
      { x: 23, y: 23 }, // 7: SouthEast
    ];

    const offset = dirOffsets[this._currentDirection] || { x: 0, y: 0 };
    const destination = {
      x: this._positionInWorld.x + offset.x,
      y: this._positionInWorld.y + offset.y,
    };

    this.magicManager.useMagic({
      userId: this._id,
      magic: magic,
      origin: this._positionInWorld,
      destination,
    });

    logger.log(`[NPC] ${this.name} uses MagicToUseWhenLifeLow: ${this.magicToUseWhenLifeLow}`);
  }

  /**
   * Attacking(destinationTilePosition)
   * Set up attack against a target position
   * For casting NPCs: checks distance, may move away if too close
   */
  attacking(destinationTilePosition: Vector2): void {
    this._destinationAttackTilePosition = destinationTilePosition;

    // Reference: AttackingIsOk(out Magic magicToUse)
    // For NPCs with FlyInis (casting NPCs), this handles distance management
    if (this.hasMagicConfigured()) {
      // Use full AttackingIsOk logic for casting NPCs
      const result = this.attackingIsOk();
      if (result.isOk && result.magicIni) {
        // Ready to cast - perform magic attack
        if (this.canPerformAction()) {
          this.performMagicAttack(destinationTilePosition, result.magicIni);
        }
      }
      // If not isOk, attackingIsOk already started moving (towards or away)
      return;
    }

    // Melee NPC - simple distance check
    const tileDistance = this.getViewTileDistance(
      { x: this._mapX, y: this._mapY },
      destinationTilePosition
    );

    // Check if attack distance is ok (using attackRadius as melee range)
    const attackRadius = this.attackRadius || 1;

    if (tileDistance <= attackRadius) {
      // In attack range - perform attack
      // Use inherited canPerformAction() from Character
      if (this.canPerformAction()) {
        this.performAttack(destinationTilePosition);
      }
    } else {
      // Not in range - walk to target
      this.walkTo(destinationTilePosition);
    }
  }

  /**
   * Perform a magic attack (for casting NPCs)
   * with MagicManager
   */
  private performMagicAttack(targetTilePosition: Vector2, magicIni: string): void {
    // Face the target
    const dx = targetTilePosition.x - this._mapX;
    const dy = targetTilePosition.y - this._mapY;
    this._currentDirection = getDirectionFromVector({ x: dx, y: dy });

    // StateInitialize(); ToFightingState();
    this.toFightingState();

    // Set magic state
    this.state = CharacterState.Magic;
    this.playCurrentDirOnce();

    // Store magic to use when animation completes
    this._pendingMagicIni = magicIni;
  }

  // Pending magic to cast when animation completes
  private _pendingMagicIni: string | null = null;

  /**
   * Override: Called when magic animation completes
   * case CharacterState.Magic
   *
   * 逻辑:
   * PlaySoundEffect(NpcIni[(int)CharacterState.Magic].Sound);
   * MagicManager.UseMagic(this, MagicUse, PositionInWorld, _magicDestination, _magicTarget);
   */
  protected override onMagicCast(): void {
    // Play magic state sound
    this.playStateSound(CharacterState.Magic);

    if (!this._pendingMagicIni || !this._destinationAttackTilePosition) {
      this._pendingMagicIni = null;
      return;
    }

    // 获取缓存的武功数据
    const magic = this.getCachedMagic(this._pendingMagicIni);

    if (magic) {
      // 计算目标位置（像素坐标）
      const destPixel = tileToPixel(
        this._destinationAttackTilePosition.x,
        this._destinationAttackTilePosition.y
      );

      // MagicManager.UseMagic(this, magic, PositionInWorld, destination)
      this.magicManager.useMagic({
        userId: this._id,
        magic: magic,
        origin: this._positionInWorld,
        destination: destPixel,
      });
    } else {
      // 武功未加载，回退到直接伤害
      logger.warn(
        `[NPC Combat] ${this.name}: Magic ${this._pendingMagicIni} not cached, using direct damage`
      );
      if (this.followTarget && !this.followTarget.isDeathInvoked) {
        const attackDamage = this.attack || 10;
        this.followTarget.takeDamage(attackDamage, this);
      }
    }

    this._pendingMagicIni = null;
  }

  /**
   * Perform the actual attack - set state and play animation
   * PerformeAttack(destinationPositionInWorld, Magic magicToUse)
   *
   * 使用基类的 performeAttack 方法，传入武功文件名和缓存的武功数据
   *
   * @param targetTilePosition 目标瓦片位置
   * @param magicIni 可选的武功文件名（如果有配置 FlyIni）
   */
  private performAttack(targetTilePosition: Vector2, magicIni?: string): void {
    // 转换为像素位置
    const destPixel = tileToPixel(targetTilePosition.x, targetTilePosition.y);
    // 获取缓存的武功数据用于 LifeFullToUse 等检查
    const magicData = magicIni ? this.getCachedMagic(magicIni) : undefined;
    // 调用基类方法，传入武功文件名和武功数据
    this.performeAttack(destPixel, magicIni, magicData ?? undefined);
  }

  /**
   * Override: 攻击动画结束时发射武功
   * MagicManager.UseMagic(this, _magicToUseWhenAttack, PositionInWorld, _attackDestination)
   *
   * NPC 使用缓存的武功数据，避免异步加载延迟
   */
  protected override useMagicWhenAttack(): void {
    if (!this._magicToUseWhenAttack || !this._attackDestination) {
      // 没有配置武功，清理并返回
      this._magicToUseWhenAttack = null;
      this._attackDestination = null;
      return;
    }

    // NPC 使用缓存的武功数据
    const magic = this.getCachedMagic(this._magicToUseWhenAttack);

    if (magic) {
      this.magicManager.useMagic({
        userId: this._id,
        magic: magic,
        origin: this._positionInWorld,
        destination: this._attackDestination,
      });

      logger.log(`[NPC] ${this.name} used attack magic: ${this._magicToUseWhenAttack}`);
    } else {
      logger.warn(`[NPC] ${this.name} has no cached magic for: ${this._magicToUseWhenAttack}`);
    }

    // 清理
    this._magicToUseWhenAttack = null;
    this._attackDestination = null;
  }

  /**
   * Override: Called when attack animation completes
   * Reference: Character.OnAttacking(_attackDestination)
   *
   * 武功发射已经在 useMagicWhenAttack() 中处理
   * 这里只做清理工作
   */
  protected override onAttacking(_attackDestinationPixelPosition: Vector2 | null): void {
    // 清理攻击目标位置
    this._destinationAttackTilePosition = null;
  }

  /**
   * CancleAttackTarget()
   */
  cancleAttackTarget(): void {
    this._destinationAttackTilePosition = null;
  }

  /**
   * Override: Called when character takes damage
   * triggers MagicToUseWhenBeAttacked
   *
   * Note: MagicToUseWhenBeAttacked 现在在 MagicManager.handleMagicToUseWhenBeAttacked 中处理，
   * 因为需要武功精灵的方向信息。这里只处理其他受伤反应。
   */
  protected override onDamaged(attacker: Character | null, damage: number): void {
    // 调用父类方法
    super.onDamaged(attacker, damage);

    // 其他受伤反应可以在这里处理
    // MagicToUseWhenBeAttacked 由 MagicManager.characterHited 处理
  }

  // clearFollowTarget() - inherited from Character
  // setRelation() - inherited from Character (handles follow target clearing)
  // partnerMoveTo() - inherited from Character

  // === Obstacle Check ===

  /**
   * override HasObstacle(tilePosition)
   * Check if position is blocked (includes NPCs, objects, magic)
   * NPC version adds Flyer check and NPC/Player position checks
   *
   * 注意：Npc.HasObstacle 不检查地图障碍，地图障碍由 PathFinder 单独处理
   * return (NpcManager.IsObstacle(tilePosition) ||
   *            ObjManager.IsObstacle(tilePosition) ||
   *            MagicManager.IsObstacle(tilePosition) ||
   *            Globals.ThePlayer.TilePosition == tilePosition);
   */
  override hasObstacle(tilePosition: Vector2): boolean {
    if (this.kind === CharacterKind.Flyer) return false;

    // Check NPC obstacle
    if (this.npcManager.isObstacle(tilePosition.x, tilePosition.y)) {
      return true;
    }

    // Check ObjManager obstacle
    if (this.engine.getManager("obj").isObstacle(tilePosition.x, tilePosition.y)) {
      return true;
    }

    // Check MagicManager obstacle
    if (this.magicManager.isObstacle(tilePosition)) {
      return true;
    }

    // Check player position
    if (this.player.mapX === tilePosition.x && this.player.mapY === tilePosition.y) {
      return true;
    }

    return false;
  }

  // === Special Actions ===

  /**
   * Start special action animation
   *
   */
  startSpecialAction(asf: AsfData | null): void {
    this.isInSpecialAction = true;
    this.specialActionLastDirection = this._currentDirection;
    this.specialActionFrame = 0;

    if (asf) {
      this._texture = asf;
      this._currentFrameIndex = 0;
      const framesPerDir = asf.framesPerDirection || 1;
      this._leftFrameToPlay = framesPerDir;
      this._frameEnd = framesPerDir - 1;
    }
  }

  /**
   * Set custom action file for a state
   *
   */
  setActionFile(stateType: number, asfFile: string): void {
    this.setCustomActionFile(stateType, asfFile);
    logger.log(`[Npc] SetActionFile: ${this.name}, state=${stateType}, file=${asfFile}`);
  }

  /**
   * FixedPos getter
   */
  getFixedPos(): string {
    // Return empty string - the actual path is stored in _fixedPathTilePositions
    return "";
  }

  /**
   * FixedPos setter - parse and set LoopWalk path
   * Overrides base to also parse the path
   */
  override setFixedPos(value: string): void {
    this.fixedPos = value; // Store original value
    this._fixedPathTilePositions = this.parseFixedPos(value);
  }

  /**
   * ToFixedPosTilePositionList(fixPos)
   * Parse FixedPos hex string to tile position list
   */
  private parseFixedPos(fixPos: string): Vector2[] | null {
    // FixedPos string pattern xx000000yy000000xx000000yy000000
    const steps = this.splitStringInCharCount(fixPos, 8);
    const count = steps.length;
    if (count < 4) return null; // Less than 2 positions

    const path: Vector2[] = [];
    try {
      for (let i = 0; i < count - 1; i += 2) {
        const xHex = steps[i].substring(0, 2);
        const yHex = steps[i + 1].substring(0, 2);
        const x = parseInt(xHex, 16);
        const y = parseInt(yHex, 16);
        if (x === 0 && y === 0) break;
        path.push({ x, y });
      }
      return path.length >= 2 ? path : null;
    } catch {
      return null;
    }
  }

  /**
   * Split string into chunks of specified length
   */
  private splitStringInCharCount(str: string, charCount: number): string[] {
    const result: string[] = [];
    for (let i = 0; i < str.length; i += charCount) {
      result.push(str.substring(i, i + charCount));
    }
    return result;
  }
}
