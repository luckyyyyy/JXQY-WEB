/**
 * Npc 类
 * 继承 Character，实现 AI、巡逻、战斗等 NPC 特有功能
 */

import { Character } from "../character";
import { loadNpcConfig } from "../character/res-loader";
import { logger } from "../core/logger";
import { PathType } from "../utils/path-finder";
import type { CharacterConfig, Vector2 } from "../core/types";
import { CharacterKind, CharacterState } from "../core/types";
import type { MagicData } from "../magic/types";
import type { AsfData } from "../resource/format/asf";
import { generateId, tileToPixel } from "../utils";
import { NpcAI, NpcMagicCache } from "./modules";
import type { NpcManager } from "./npc-manager";

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
  // isRandMoveRandAttack, isNotFightBackWhenBeHit - inherited from CharacterBase

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

  /**
   * 清除武功缓存（用于热重载武功配置）
   */
  clearMagicCache(): void {
    this._magicCache.clear();
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
   * 获取被攻击时使用的预加载武功数据（同步）
   * 供 CollisionHandler 在碰撞检测时使用
   */
  getBeAttackedMagicData(): MagicData | null {
    return this._magicCache.getSpecial("beAttacked");
  }

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
   * C# Reference: Character.Attacking(Vector2 destinationTilePosition, bool isRun = false)
   *
   * C# 中 Attacking 统一调用 AttackingIsOk → PerformeAttack，
   * 始终使用 Attack/Attack1/Attack2 状态（而非 Magic 状态）。
   * 武功在攻击动画结束时通过 _magicToUseWhenAttack 发射。
   *
   * CharacterState.Magic 仅用于玩家手动释放武功（UseMagic），NPC 不应使用。
   */
  attacking(destinationTilePosition: Vector2): void {
    // C#: if (PerformActionOk() &&
    //         (IsStateImageOk(CharacterState.Attack) ||
    //          IsStateImageOk(CharacterState.Attack1) ||
    //          IsStateImageOk(CharacterState.Attack2)))
    if (
      !this.canPerformAction() ||
      !(
        this.isStateImageOk(CharacterState.Attack) ||
        this.isStateImageOk(CharacterState.Attack1) ||
        this.isStateImageOk(CharacterState.Attack2)
      )
    ) {
      return;
    }

    this._destinationAttackTilePosition = destinationTilePosition;

    // C#: AttackingIsOk(out magicToUse) → PerformeAttack(magicToUse)
    const result = this.attackingIsOk();
    if (result.isOk) {
      this.performAttack(destinationTilePosition, result.magicIni ?? undefined);
    }
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
   * CancelAttackTarget()
   */
  cancelAttackTarget(): void {
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
    if (this.obj.isObstacle(tilePosition.x, tilePosition.y)) {
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
   * 直接调用父类的 setNpcActionFile
   */
  setActionFile(stateType: number, asfFile: string): void {
    this.setNpcActionFile(stateType, asfFile);
    logger.debug(`[Npc] SetActionFile: ${this.name}, state=${stateType}, file=${asfFile}`);
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
    return parseFixedPos(fixPos);
  }
}

/**
 * Parse FixedPos hex string to tile position list.
 *
 * FixedPos string pattern: xx000000yy000000xx000000yy000000
 * Each coordinate pair is encoded as 2 hex chars followed by 6 zero-padding
 * chars, so each "step" is 8 chars.
 *
 * Reusable standalone version of Npc.parseFixedPos / splitStringInCharCount.
 */
export function parseFixedPos(fixPos: string): Vector2[] | null {
  const steps: string[] = [];
  for (let i = 0; i < fixPos.length; i += 8) {
    steps.push(fixPos.substring(i, i + 8));
  }
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
  } catch { // parse failed
    return null;
  }
}
