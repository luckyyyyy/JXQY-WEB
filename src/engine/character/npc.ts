/**
 * Npc 类 - 对应 C# Npc.cs
 * 继承 Character，实现 AI、巡逻、战斗等 NPC 特有功能
 */
import { logger } from "../core/logger";
import { PathType } from "../core/pathFinder";
import type { CharacterConfig, Vector2 } from "../core/types";
import { ActionType, CharacterKind, CharacterState } from "../core/types";
import { generateId, getDirectionFromVector, tileToPixel } from "../core/utils";
import { getMagicAtLevel, loadMagic } from "../magic/magicLoader";
import type { MagicManager } from "../magic/magicManager";
import { magicRenderer } from "../magic/magicRenderer";
import type { MagicData } from "../magic/types";
import { Character } from "./character";
import type { NpcManager } from "./npcManager";
import { loadNpcConfig } from "./resFile";

// Global AI state (matches C# Npc.IsAIDisabled static property)
let _globalAIDisabled = false;

/**
 * Disable AI for all NPCs (used in cutscenes)
 * C#: Npc.DisableAI()
 */
export function disableGlobalAI(): void {
  _globalAIDisabled = true;
}

/**
 * Enable AI for all NPCs
 * C#: Npc.EnableAI()
 */
export function enableGlobalAI(): void {
  _globalAIDisabled = false;
}

/**
 * Check if global AI is disabled
 */
export function isGlobalAIDisabled(): boolean {
  return _globalAIDisabled;
}

/** Npc 类 - 对应 C# Npc.cs */
export class Npc extends Character {
  private _id: string;
  private _actionPathTilePositions: Vector2[] | null = null;
  private _idledFrame: number = 0;
  private _isAIDisabled: boolean = false;
  private _blindMilliseconds: number = 0;
  private _keepDistanceCharacterWhenFriendDeath: Character | null = null;

  // AI path for LoopWalk from FixedPos config
  private _fixedPathTilePositions: Vector2[] | null = null;

  // Script destination position
  private _destinationMapPosX: number = 0;
  private _destinationMapPosY: number = 0;
  protected _moveTargetChanged: boolean = false;

  // NpcManager 和 Player 现在通过 IEngineContext 获取

  // Magic cache - 缓存已加载的 MagicData 对象
  // C#: Magic objects are cached when loaded from ini files
  private _magicToUseWhenLifeLowData: MagicData | null = null;
  private _magicToUseWhenBeAttackedData: MagicData | null = null;
  private _magicToUseWhenDeathData: MagicData | null = null;
  private _flyIniMagicCache: Map<string, MagicData> = new Map();
  private _magicLoadingPromise: Promise<void> | null = null;

  constructor(id?: string) {
    super();
    this._id = id || generateId();
  }

  // === Manager 访问（通过 IEngineContext）===

  /**
   * 获取 MagicManager（通过 IEngineContext）
   */
  private get magicManager(): MagicManager {
    return this.engine.getMagicManager() as MagicManager;
  }

  /**
   * 获取 NpcManager（通过 IEngineContext）
   */
  private get npcManager(): NpcManager {
    return this.engine.getNpcManager() as NpcManager;
  }

  /**
   * 获取 Player（通过 IEngineContext）
   */
  private get player(): Character {
    return this.engine.getPlayer() as Character;
  }

  // === Properties ===

  /**
   * C# Reference: Npc.PathType override
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

  /**
   * Set the loaded MagicData for MagicToUseWhenLifeLow
   * Called by NpcManager or GameManager after loading magic
   */
  setMagicToUseWhenLifeLowData(data: MagicData | null): void {
    this._magicToUseWhenLifeLowData = data;
  }

  // aiType getter/setter - inherited from Character

  /**
   * C#: IsRandMoveRandAttack => AIType == 1 || AIType == 2
   */
  get isRandMoveRandAttack(): boolean {
    return this.aiType === 1 || this.aiType === 2;
  }

  /**
   * C#: IsNotFightBackWhenBeHit => AIType == 2
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

  // === Setup ===

  // NpcManager 和 Player 现在通过 getter 从 IEngineContext 获取，无需 setAIReferences

  /**
   * 预加载 NPC 的所有武功
   * C#: Magic objects are loaded when Character is constructed
   * 异步加载所有配置的武功（FlyIni, FlyIni2, FlyInis, MagicToUseWhenLifeLow, etc.）
   */
  async loadAllMagics(): Promise<void> {
    // 避免重复加载
    if (this._magicLoadingPromise) {
      return this._magicLoadingPromise;
    }

    this._magicLoadingPromise = this._loadMagicsInternal();
    return this._magicLoadingPromise;
  }

  private async _loadMagicsInternal(): Promise<void> {
    const loadPromises: Promise<void>[] = [];

    // 加载 FlyIni
    if (this.flyIni) {
      loadPromises.push(this._loadAndCacheMagic(this.flyIni));
    }

    // 加载 FlyIni2
    if (this.flyIni2) {
      loadPromises.push(this._loadAndCacheMagic(this.flyIni2));
    }

    // 加载 FlyInis 中的所有武功
    for (const info of this._flyIniInfos) {
      if (info.magicIni) {
        loadPromises.push(this._loadAndCacheMagic(info.magicIni));
      }
    }

    // 加载特殊武功
    if (this.magicToUseWhenLifeLow) {
      loadPromises.push(
        loadMagic(this.magicToUseWhenLifeLow).then(async (magic) => {
          if (magic) {
            this._magicToUseWhenLifeLowData = getMagicAtLevel(magic, this.attackLevel || 1);
            await this._preloadMagicAsf(this._magicToUseWhenLifeLowData);
          }
        })
      );
    }

    if (this.magicToUseWhenBeAttacked) {
      loadPromises.push(
        loadMagic(this.magicToUseWhenBeAttacked).then(async (magic) => {
          if (magic) {
            this._magicToUseWhenBeAttackedData = getMagicAtLevel(magic, this.attackLevel || 1);
            await this._preloadMagicAsf(this._magicToUseWhenBeAttackedData);
          }
        })
      );
    }

    if (this.magicToUseWhenDeath) {
      loadPromises.push(
        loadMagic(this.magicToUseWhenDeath).then(async (magic) => {
          if (magic) {
            this._magicToUseWhenDeathData = getMagicAtLevel(magic, this.attackLevel || 1);
            await this._preloadMagicAsf(this._magicToUseWhenDeathData);
          }
        })
      );
    }

    await Promise.all(loadPromises);
    logger.log(`[NPC] ${this.name}: Loaded ${this._flyIniMagicCache.size} magics`);
  }

  /**
   * 加载并缓存单个武功
   */
  private async _loadAndCacheMagic(magicIni: string): Promise<void> {
    if (this._flyIniMagicCache.has(magicIni)) {
      return;
    }

    const magic = await loadMagic(magicIni);
    if (magic) {
      // C#: magic.GetLevel(AttackLevel)
      const leveledMagic = getMagicAtLevel(magic, this.attackLevel || 1);
      this._flyIniMagicCache.set(magicIni, leveledMagic);
      // 预加载 ASF 资源
      await this._preloadMagicAsf(leveledMagic);
    }
  }

  /**
   * 预加载武功的 ASF 资源
   */
  private async _preloadMagicAsf(magic: MagicData): Promise<void> {
    const promises: Promise<unknown>[] = [];
    if (magic.flyingImage) {
      promises.push(magicRenderer.getAsf(magic.flyingImage));
    }
    if (magic.vanishImage) {
      promises.push(magicRenderer.getAsf(magic.vanishImage));
    }
    // SuperMode 使用 superModeImage 作为主动画
    if (magic.superModeImage) {
      promises.push(magicRenderer.getAsf(magic.superModeImage));
    }
    if (promises.length > 0) {
      await Promise.all(promises);
    }
  }

  /**
   * 获取已缓存的武功数据
   * 如果未缓存，返回 null（需要先调用 loadAllMagics）
   */
  getCachedMagic(magicIni: string): MagicData | null {
    return this._flyIniMagicCache.get(magicIni) ?? null;
  }

  // === Factory Methods ===

  /**
   * Create NPC from config file path
   * Based on C# Npc(string filePath) constructor
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
   * Based on C# Npc(KeyDataCollection) constructor
   */
  static fromConfig(
    config: CharacterConfig,
    tileX: number,
    tileY: number,
    direction: number = 4
  ): Npc {
    const npc = new Npc();
    npc.loadFromConfig(config);
    npc.setPosition(tileX, tileY);
    npc._currentDirection = direction;
    return npc;
  }

  // === Death Handling ===

  /**
   * Override onDeath to run death script
   * C#: Character.Death() runs _currentRunDeathScript = ScriptManager.RunScript(DeathScript, this)
   */
  protected override onDeath(killer: Character | null): void {
    if (this.isDeathInvoked) return;

    // Call base implementation first (sets state and flags)
    super.onDeath(killer);

    // C#: 使用死亡时的武功 (MagicToUseWhenDeath)
    this.useMagicWhenDeath(killer);

    // C#: NpcManager.AddDead(this)
    if (this.npcManager) {
      this.npcManager.addDead(this);
    }

    // C#: Run death script
    logger.log(
      `[NPC] ${this.name} death check - deathScript: "${this.deathScript}", hasNpcManager: ${!!this.npcManager}`
    );
    if (this.deathScript && this.npcManager) {
      logger.log(`[NPC] ${this.name} running death script: ${this.deathScript}`);
      this.npcManager.runDeathScript(this.deathScript, this);
    } else {
      if (!this.deathScript) {
        logger.log(`[NPC] ${this.name} has no death script configured`);
      }
      if (!this.npcManager) {
        logger.log(`[NPC] ${this.name} has no npcManager reference - setAIReferences not called?`);
      }
    }
  }

  /**
   * 使用死亡时的武功
   * C# Reference: MagicSprite.CharacterHited 检查 MagicToUseWhenDeath
   *
   * C# 逻辑:
   * if (character.MagicToUseWhenDeath != null) {
   *     var magicDirectionType = character.MagicDirectionWhenDeath;
   *     Vector2 magicDirection = 根据 magicDirectionType 计算方向;
   *     MagicManager.UseMagic(character, MagicToUseWhenDeath, position, position + magicDirection);
   * }
   */
  private useMagicWhenDeath(killer: Character | null): void {
    if (!this._magicToUseWhenDeathData || !this.magicManager) {
      return;
    }

    // C#: MagicDirectionWhenDeath 决定武功方向
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
      magic: this._magicToUseWhenDeathData,
      origin: this._positionInWorld,
      destination,
    });
  }

  // === AI Update ===

  /**
   * C#: Update(gameTime)
   * Main NPC update method with AI behavior
   */
  override update(deltaTime: number): void {
    if (!this._isVisible) return;

    // C#: Dead NPCs only update death animation, no AI
    // When IsDeathInvoked or IsDeath, skip all AI logic
    if (this.isDeathInvoked || this.isDeath) {
      // Only update the sprite animation (for death animation)
      super.update(deltaTime);
      return;
    }

    // C#: if(_controledMagicSprite != null) { base.Update(); return; }
    // Skip if controlled by magic (not implemented yet)

    // C#: Update blind time
    if (this._blindMilliseconds > 0) {
      this._blindMilliseconds -= deltaTime * 1000;
    }

    // C#: if (KeepAttackX > 0 || KeepAttackY > 0) { ... }
    // Keep attacking a fixed position (used by certain boss AI)
    if (this.keepAttackX > 0 || this.keepAttackY > 0) {
      if (
        this._state === CharacterState.Stand ||
        this._state === CharacterState.Stand1 ||
        this._state === CharacterState.FightStand
      ) {
        this.attacking({ x: this.keepAttackX, y: this.keepAttackY });
      }
      super.update(deltaTime);
      return;
    }

    // Find follow target
    // C#: if (!IsFollowTargetFound || FollowTarget == null || FollowTarget.IsDeathInvoked || ...)
    // C#: Also check relation changes - enemy shouldn't follow same-group enemy, friend shouldn't follow friend
    if (
      !this.isFollowTargetFound ||
      this.followTarget === null ||
      this.followTarget.isDeathInvoked || // C#: FollowTarget.IsDeathInvoked
      !this.followTarget.isVisible ||
      (this.isEnemy && this.followTarget.isEnemy && this.followTarget.group === this.group) ||
      (this.isFighterFriend && (this.followTarget.isFighterFriend || this.followTarget.isPlayer)) ||
      _globalAIDisabled ||
      this._isAIDisabled ||
      this._blindMilliseconds > 0
    ) {
      this.findFollowTarget();
    }

    // Perform follow or other actions
    // C#: if (MovedByMagicSprite == null) { ... }
    // C#: if (!CheckKeepDistanceWhenFriendDeath() && !KeepDistanceWhenLifeLow() && MagicToUseWhenLifeLow != null && ...)
    if (!this.checkKeepDistanceWhenFriendDeath() && !this.keepDistanceWhenLifeLow()) {
      // C#: MagicToUseWhenLifeLow - use special magic when low on health
      if (
        this.magicToUseWhenLifeLow &&
        this.magicManager !== null &&
        this.lifeMax > 0 &&
        this.life / this.lifeMax <= this.lifeLowPercent / 100.0
      ) {
        // C#: PerformeAttack(PositionInWorld + Utils.GetDirection8(CurrentDirection), MagicToUseWhenLifeLow)
        this.useMagicWhenLifeLow();
      }
      this.performFollow();
    }

    // C#: Attack interval counter
    if (this._idledFrame < this.idle) {
      this._idledFrame++;
    }

    // C#: If following target, reset action path
    if (this.isFollowTargetFound) {
      this._actionPathTilePositions = null;
    } else {
      // C#: Handle destination from script commands (DestinationMapPosX/Y)
      if ((this._destinationMapPosX !== 0 || this._destinationMapPosY !== 0) && this.isStanding()) {
        if (this._mapX === this._destinationMapPosX && this._mapY === this._destinationMapPosY) {
          this._destinationMapPosX = 0;
          this._destinationMapPosY = 0;
        } else {
          // C#: WalkTo(..., Engine.PathFinder.PathType.PerfectMaxPlayerTry)
          this.walkTo(
            {
              x: this._destinationMapPosX,
              y: this._destinationMapPosY,
            },
            PathType.PerfectMaxPlayerTry
          );
          if (this.path.length === 0) {
            // Can't reach destination
            this._destinationMapPosX = 0;
            this._destinationMapPosY = 0;
          }
        }
      } else {
        // C#: RandMoveRandAttack behavior
        if (this.isRandMoveRandAttack && this.isStanding()) {
          const poses = this.getRandTilePath(2, false, 10);
          if (poses.length >= 2) {
            this.walkTo(poses[1]);
          }
        }
      }
    }

    // Non-fighter behavior
    // C#: if ((FollowTarget == null || !IsFollowTargetFound) && !(IsFighterKind && IsAIDisabled))
    if (
      (this.followTarget === null || !this.isFollowTargetFound) &&
      !(this.isFighterKind && (_globalAIDisabled || this._isAIDisabled))
    ) {
      const isFlyer = this.kind === CharacterKind.Flyer;
      const randWalkProbability = 400;
      const flyerRandWalkProbability = 20;

      // C#: LoopWalk along FixedPos
      if (this.action === ActionType.LoopWalk && this._fixedPathTilePositions !== null) {
        this.loopWalk(
          this._fixedPathTilePositions,
          isFlyer ? flyerRandWalkProbability : randWalkProbability,
          isFlyer
        );
      } else {
        // C#: Based on Kind and Action
        switch (this.kind) {
          case CharacterKind.Normal:
          case CharacterKind.Fighter:
          case CharacterKind.GroundAnimal:
          case CharacterKind.Eventer:
          case CharacterKind.Flyer:
            if (this.action === ActionType.RandWalk) {
              this.randWalk(
                this.actionPathTilePositions,
                isFlyer ? flyerRandWalkProbability : randWalkProbability,
                isFlyer
              );
            }
            break;
          // C#: AfraidPlayerAnimal keeps distance from player
          case CharacterKind.AfraidPlayerAnimal:
            if (this.player) {
              this.keepMinTileDistance(this.player.tilePosition, this.visionRadius);
            }
            break;
        }
      }
    }

    // Parent update (movement and animation)
    super.update(deltaTime);
  }

  // === AI Helpers ===

  /**
   * C#: Find follow target based on NPC type and relation
   */
  private findFollowTarget(): void {
    if (_globalAIDisabled || this._isAIDisabled || this._blindMilliseconds > 0) {
      this.followTarget = null;
      this.isFollowTargetFound = false;
      return;
    }

    // C#: if (IsEnemy) { ... }
    if (this.isEnemy) {
      // C#: Enemy NPCs target player or friendly fighters
      if (
        (this.stopFindingTarget === 0 && !this.isRandMoveRandAttack) ||
        (this.isRandMoveRandAttack && this.isStanding() && Math.random() > 0.7)
      ) {
        // First try to find other group enemy
        if (this.npcManager) {
          this.followTarget = this.npcManager.getLiveClosestOtherGroupEnemy(
            this.group,
            this._positionInWorld
          );
        }
        // If no enemy of different group, target player
        if (this.noAutoAttackPlayer === 0 && this.followTarget === null) {
          this.followTarget = this.getPlayerOrFighterFriend();
        }
      } else if (this.followTarget?.isDeathInvoked) {
        this.followTarget = null;
      }
    } else if (this.isFighterFriend) {
      // C#: Friendly fighters target enemies
      if (this.stopFindingTarget === 0) {
        this.followTarget = this.getClosestEnemyCharacter();
      } else if (this.followTarget?.isDeathInvoked) {
        this.followTarget = null;
      }
      // C#: If no enemy and is partner, move to player
      if (this.followTarget === null && this.isPartner) {
        this.moveToPlayer();
      }
    } else if (this.isNoneFighter) {
      // C#: None-fighter NPCs target non-neutral fighters
      if (this.stopFindingTarget === 0) {
        this.followTarget = this.getClosestNonNeutralFighter();
      } else if (this.followTarget?.isDeathInvoked) {
        this.followTarget = null;
      }
    } else if (this.isPartner) {
      // C#: Partners follow player
      this.moveToPlayer();
    }

    if (this.followTarget === null) {
      this.isFollowTargetFound = false;
    } else if (!this.isFollowTargetFound) {
      // Target found, mark as found
    }
  }

  /**
   * C#: PerformeFollow() - Check if follow target is visible and act accordingly
   */
  private performFollow(): void {
    if (this.followTarget === null) return;

    const targetTilePosition = {
      x: this.followTarget.mapX,
      y: this.followTarget.mapY,
    };
    const tileDistance = this.getViewTileDistance(
      { x: this._mapX, y: this._mapY },
      targetTilePosition
    );

    let canSeeTarget = false;

    // C#: if (tileDistance <= VisionRadius)
    if (tileDistance <= this.visionRadius) {
      canSeeTarget = this.canViewTarget(
        { x: this._mapX, y: this._mapY },
        targetTilePosition,
        this.visionRadius
      );

      this.isFollowTargetFound = this.isFollowTargetFound || canSeeTarget;
    } else {
      this.isFollowTargetFound = false;
    }

    if (this.isFollowTargetFound) {
      this.followTargetFound(canSeeTarget);
    } else {
      this.followTargetLost();
    }
  }

  /**
   * C#: FollowTargetFound(attackCanReach) - Called when target is in sight
   */
  protected followTargetFound(attackCanReach: boolean): void {
    if (_globalAIDisabled || this._isAIDisabled || this._blindMilliseconds > 0) {
      this.cancelAttackTarget();
      return;
    }

    // C#: MoveTargetChanged = true - force path recalculation
    this._moveTargetChanged = true;

    if (attackCanReach) {
      // C#: Attack if idle counter has reached threshold
      if (this._idledFrame >= this.idle) {
        this._idledFrame = 0;
        const targetTile = this.followTarget?.tilePosition;
        if (targetTile) {
          this.attacking(targetTile);
        }
      }
    } else {
      // C#: Walk to target
      const targetTile = this.followTarget?.tilePosition;
      if (targetTile) {
        this.walkTo(targetTile);
      }
    }
  }

  /**
   * C#: FollowTargetLost() - Called when target is lost
   */
  protected followTargetLost(): void {
    this.cancelAttackTarget();
    if (this.isPartner) {
      this.moveToPlayer();
    }
  }

  /**
   * C#: Attacking(destinationTilePosition)
   * Set up attack against a target position
   * For casting NPCs: checks distance, may move away if too close
   */
  attacking(destinationTilePosition: Vector2): void {
    this._destinationAttackTilePosition = destinationTilePosition;

    // C# Reference: AttackingIsOk(out Magic magicToUse)
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

    // C#: Check if attack distance is ok (using attackRadius as melee range)
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
   * C# Reference: PerformMagic with MagicManager
   */
  private performMagicAttack(targetTilePosition: Vector2, magicIni: string): void {
    // Face the target
    const dx = targetTilePosition.x - this._mapX;
    const dy = targetTilePosition.y - this._mapY;
    this._currentDirection = getDirectionFromVector({ x: dx, y: dy });

    // C#: StateInitialize(); ToFightingState();
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
   * C# Reference: Character.Update() case CharacterState.Magic
   *
   * C# 逻辑:
   * PlaySoundEffect(NpcIni[(int)CharacterState.Magic].Sound);
   * MagicManager.UseMagic(this, MagicUse, PositionInWorld, _magicDestination, _magicTarget);
   */
  protected override onMagicCast(): void {
    // Play magic state sound
    this.playStateSound(CharacterState.Magic);

    if (!this._pendingMagicIni || !this.magicManager || !this._destinationAttackTilePosition) {
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

      // C#: MagicManager.UseMagic(this, magic, PositionInWorld, destination)
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
   * C#: PerformeAttack(destinationPositionInWorld, Magic magicToUse)
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
   * C#: MagicManager.UseMagic(this, _magicToUseWhenAttack, PositionInWorld, _attackDestination)
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

    if (magic && this.magicManager) {
      this.magicManager.useMagic({
        userId: this._id,
        magic: magic,
        origin: this._positionInWorld,
        destination: this._attackDestination,
      });

      logger.log(`[NPC] ${this.name} used attack magic: ${this._magicToUseWhenAttack}`);
    } else if (!magic) {
      logger.warn(`[NPC] ${this.name} has no cached magic for: ${this._magicToUseWhenAttack}`);
    }

    // 清理
    this._magicToUseWhenAttack = null;
    this._attackDestination = null;
  }

  /**
   * Override: Called when attack animation completes
   * C# Reference: Character.OnAttacking(_attackDestination)
   *
   * 武功发射已经在 useMagicWhenAttack() 中处理
   * 这里只做清理工作
   */
  protected override onAttacking(): void {
    // 清理攻击目标位置
    this._destinationAttackTilePosition = null;
  }

  /**
   * C#: CancelAttackTarget()
   */
  cancelAttackTarget(): void {
    this._destinationAttackTilePosition = null;
  }

  /**
   * Use magic when life is low
   * C#: PerformeAttack(PositionInWorld + Utils.GetDirection8(CurrentDirection), MagicToUseWhenLifeLow)
   */
  private useMagicWhenLifeLow(): void {
    if (!this.magicManager || !this._magicToUseWhenLifeLowData) {
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
      magic: this._magicToUseWhenLifeLowData,
      origin: this._positionInWorld,
      destination,
    });

    logger.log(`[NPC] ${this.name} uses MagicToUseWhenLifeLow: ${this.magicToUseWhenLifeLow}`);
  }

  /**
   * Override: Called when character takes damage
   * C# Reference: MagicSprite.CharacterHited triggers MagicToUseWhenBeAttacked
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

  /**
   * C#: MoveToPlayer() - Partner follows player
   */
  private moveToPlayer(): void {
    if (this.player && !this.player.isStanding()) {
      this.partnerMoveTo(this.player.tilePosition);
    }
  }

  /**
   * C#: KeepDistanceWhenLifeLow() - Run away when health is low
   */
  private keepDistanceWhenLifeLow(): boolean {
    if (
      this.followTarget !== null &&
      this.keepRadiusWhenLifeLow > 0 &&
      this.lifeMax > 0 &&
      this.life / this.lifeMax <= this.lifeLowPercent / 100.0
    ) {
      const tileDistance = this.getViewTileDistance(
        { x: this._mapX, y: this._mapY },
        this.followTarget.tilePosition
      );
      if (tileDistance < this.keepRadiusWhenLifeLow) {
        if (
          this.moveAwayTarget(
            this.followTarget.pixelPosition,
            this.keepRadiusWhenLifeLow - tileDistance,
            false // isRun = false
          )
        ) {
          return true;
        }
      }
    }
    return false;
  }

  /**
   * C#: CheckKeepDistanceWhenFriendDeath() - Keep distance from killer when friend dies
   * Based on C# Npc.CheckKeepDistanceWhenFriendDeath
   */
  private checkKeepDistanceWhenFriendDeath(): boolean {
    if (this.keepRadiusWhenFriendDeath <= 0) {
      return false;
    }

    // C#: Kind != 3 - Follower has no effect
    if (this.kind === CharacterKind.Follower) {
      return false;
    }

    let target = this._keepDistanceCharacterWhenFriendDeath;

    // Check if current target is still valid
    if (target === null || target.isDeathInvoked) {
      target = null;
      this._keepDistanceCharacterWhenFriendDeath = null;

      // C#: Find dead friend killed by live character within vision radius
      if (this.npcManager) {
        const dead = this.npcManager.findFriendDeadKilledByLiveCharacter(this, this.visionRadius);
        if (dead) {
          // Get the attacker from the dead character
          // Note: We need to track lastAttacker in Character class
          const lastAttacker = (dead as any)._lastAttacker as Character | null;
          if (lastAttacker && !lastAttacker.isDeathInvoked) {
            target = lastAttacker;
            this._keepDistanceCharacterWhenFriendDeath = target;
          }
        }
      }
    }

    // If we have a target to keep distance from
    if (target !== null) {
      const tileDistance = this.getViewTileDistance(
        { x: this._mapX, y: this._mapY },
        target.tilePosition
      );
      if (tileDistance < this.keepRadiusWhenFriendDeath) {
        if (
          this.moveAwayTarget(
            target.positionInWorld,
            this.keepRadiusWhenFriendDeath - tileDistance,
            false // isRun = false
          )
        ) {
          return true;
        }
      }
    }

    return false;
  }

  /**
   * C#: KeepMinTileDistance(targetTilePosition, minTileDistance)
   * Keep minimum distance from a target position (for AfraidPlayerAnimal)
   * Based on C# Character.KeepMinTileDistance
   */
  protected keepMinTileDistance(targetTilePosition: Vector2, minTileDistance: number): void {
    // C#: if (_isInInteract) return; - skip if interacting
    // We don't have _isInInteract yet, skip this check

    const tileDistance = this.getViewTileDistance(
      { x: this._mapX, y: this._mapY },
      targetTilePosition
    );

    // C#: if (tileDistance < minTileDistance && IsStanding())
    if (tileDistance < minTileDistance && this.isStanding()) {
      this.moveAwayTarget(
        tileToPixel(targetTilePosition.x, targetTilePosition.y),
        minTileDistance - tileDistance,
        false // isRun = false
      );
    }
  }

  // === Vision ===
  // NOTE: canViewTarget is inherited from Character via utils

  // === Target Finding ===

  /**
   * Get player or closest fighter friend
   * C#: NpcManager.GetLiveClosestPlayerOrFighterFriend
   */
  private getPlayerOrFighterFriend(): Character | null {
    if (!this.npcManager) {
      // Fallback: return player if no NpcManager
      if (this.player && !this.player.isDeathInvoked) {
        return this.player;
      }
      return null;
    }
    return this.npcManager.getLiveClosestPlayerOrFighterFriend(
      this._positionInWorld,
      false, // withNeutral
      false // withInvisible
    );
  }

  /**
   * Get closest enemy character
   */
  private getClosestEnemyCharacter(): Character | null {
    return this.npcManager.getClosestEnemyTypeCharacter(this._positionInWorld, true, false);
  }

  /**
   * Get closest non-neutral fighter
   */
  private getClosestNonNeutralFighter(): Character | null {
    return this.npcManager.getLiveClosestNonNeutralFighter(this._positionInWorld);
  }

  // === Obstacle Check ===

  /**
   * C#: override HasObstacle(tilePosition)
   * Check if position is blocked (includes NPCs, objects, magic)
   * NPC version adds Flyer check and NPC/Player position checks
   *
   * 注意：C# Npc.HasObstacle 不检查地图障碍，地图障碍由 PathFinder 单独处理
   * C#: return (NpcManager.IsObstacle(tilePosition) ||
   *            ObjManager.IsObstacle(tilePosition) ||
   *            MagicManager.IsObstacle(tilePosition) ||
   *            Globals.ThePlayer.TilePosition == tilePosition);
   */
  override hasObstacle(tilePosition: Vector2): boolean {
    if (this.kind === CharacterKind.Flyer) return false;

    // Check NPC obstacle
    if (this.npcManager?.isObstacle(tilePosition.x, tilePosition.y)) {
      return true;
    }

    // TODO: Check ObjManager obstacle
    // TODO: Check MagicManager obstacle

    // Check player position
    if (this.player && this.player.mapX === tilePosition.x && this.player.mapY === tilePosition.y) {
      return true;
    }

    return false;
  }

  // === Special Actions ===

  /**
   * Start special action animation
   * Based on C# Character.SetSpecialAction
   */
  startSpecialAction(asf: any): void {
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
   * Based on C# Character.SetNpcActionFile
   */
  setActionFile(stateType: number, asfFile: string): void {
    this.setCustomActionFile(stateType, asfFile);
    logger.log(`[Npc] SetActionFile: ${this.name}, state=${stateType}, file=${asfFile}`);
  }

  /**
   * C#: FixedPos getter
   */
  getFixedPos(): string {
    // Return empty string - the actual path is stored in _fixedPathTilePositions
    return "";
  }

  /**
   * C#: FixedPos setter - parse and set LoopWalk path
   * Overrides base to also parse the path
   */
  override setFixedPos(value: string): void {
    this.fixedPos = value; // Store original value
    this._fixedPathTilePositions = this.parseFixedPos(value);
  }

  /**
   * C#: ToFixedPosTilePositionList(fixPos)
   * Parse FixedPos hex string to tile position list
   */
  private parseFixedPos(fixPos: string): Vector2[] | null {
    // C#: FixedPos string pattern xx000000yy000000xx000000yy000000
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
