/**
 * Npc 类 - 对应 C# Npc.cs
 * 继承 Character，实现 AI、巡逻、战斗等 NPC 特有功能
 */
import type { Vector2, CharacterConfig } from "../core/types";
import {
  CharacterState,
  CharacterKind,
  RelationType,
  ActionType,
} from "../core/types";
import { Character } from "./character";
import { PathType } from "../core/pathFinder";
import type { MagicManager } from "../magic/magicManager";
import type { MagicData } from "../magic/types";
import { loadNpcConfig } from "./resFile";
import {
  generateId,
  getNeighbors,
  tileToPixel,
  pixelToTile,
  distance,
  getDirectionFromVector,
} from "../core/utils";

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

  // References
  private _npcManager: any = null;
  private _player: Character | null = null;
  private _magicManager: MagicManager | null = null;
  private _magicToUseWhenLifeLowData: MagicData | null = null;

  constructor(id?: string) {
    super();
    this._id = id || generateId();
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
      this._actionPathTilePositions = this.getRandTilePath(
        8,
        this.kind === CharacterKind.Flyer
      );
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

  /**
   * Set references needed for AI queries
   */
  setAIReferences(npcManager: any, player: Character | null, magicManager?: MagicManager): void {
    this._npcManager = npcManager;
    this._player = player;
    if (magicManager) {
      this._magicManager = magicManager;
    }
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

    // C#: NpcManager.AddDead(this)
    if (this._npcManager) {
      this._npcManager.addDead(this);
    }

    // C#: Run death script
    console.log(`[NPC] ${this.name} death check - deathScript: "${this.deathScript}", hasNpcManager: ${!!this._npcManager}`);
    if (this.deathScript && this._npcManager) {
      console.log(`[NPC] ${this.name} running death script: ${this.deathScript}`);
      this._npcManager.runDeathScript(this.deathScript, this);
    } else {
      if (!this.deathScript) {
        console.log(`[NPC] ${this.name} has no death script configured`);
      }
      if (!this._npcManager) {
        console.log(`[NPC] ${this.name} has no npcManager reference - setAIReferences not called?`);
      }
    }
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
      this.followTarget.isDeathInvoked ||  // C#: FollowTarget.IsDeathInvoked
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
        this._magicManager !== null &&
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
      if (
        (this._destinationMapPosX !== 0 || this._destinationMapPosY !== 0) &&
        this.isStanding()
      ) {
        if (
          this._mapX === this._destinationMapPosX &&
          this._mapY === this._destinationMapPosY
        ) {
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
      if (
        this.action === ActionType.LoopWalk &&
        this._fixedPathTilePositions !== null
      ) {
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
            if (this._player) {
              this.keepMinTileDistance(this._player.tilePosition, this.visionRadius);
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
        (this.isRandMoveRandAttack &&
          this.isStanding() &&
          Math.random() > 0.7)
      ) {
        // First try to find other group enemy
        if (this._npcManager) {
          this.followTarget = this._npcManager.getLiveClosestOtherGroupEnemy(
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
        this.attacking(this.followTarget!.tilePosition);
      }
    } else {
      // C#: Walk to target
      this.walkTo(this.followTarget!.tilePosition);
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

    // Set magic state
    this.state = CharacterState.Magic;
    this.playCurrentDirOnce();

    // Store magic to use when animation completes
    this._pendingMagicIni = magicIni;

    console.log(`[NPC Combat] ${this.name} starts casting ${magicIni} against target`);
  }

  // Pending magic to cast when animation completes
  private _pendingMagicIni: string | null = null;

  /**
   * Override: Called when magic animation completes
   * C# Reference: Character.OnMagicCast()
   */
  protected override onMagicCast(): void {
    if (this._pendingMagicIni && this._magicManager && this._destinationAttackTilePosition) {
      // TODO: Load and use the actual magic
      console.log(`[NPC Combat] ${this.name} casts ${this._pendingMagicIni}`);
      // For now, deal damage as if it's an attack
      if (this.followTarget && !this.followTarget.isDeathInvoked) {
        // Use attack value directly - takeDamage handles defend reduction
        const attackDamage = this.attack || 10;
        this.followTarget.takeDamage(attackDamage, this);
        console.log(`[NPC Combat] ${this.name} magic hits ${this.followTarget.name} (Atk:${attackDamage}, target Def:${this.followTarget.defend})`);
      }
    }
    this._pendingMagicIni = null;
  }

  /**
   * Perform the actual attack - set state and play animation
   * C#: PerformeAttack() - sets state, direction, PlayCurrentDirOnce()
   * NOTE: Damage is dealt in onAttacking() when animation completes
   */
  private performAttack(targetTilePosition: Vector2): void {
    // Face the target
    const dx = targetTilePosition.x - this._mapX;
    const dy = targetTilePosition.y - this._mapY;
    this._currentDirection = getDirectionFromVector({ x: dx, y: dy });

    // Set attack state - this will trigger animation
    this.state = CharacterState.Attack;

    // Play animation once - when complete, updateAttacking() calls onAttacking()
    this.playCurrentDirOnce();

    // Damage will be dealt in onAttacking() when animation completes
    console.log(`[NPC Combat] ${this.name} starts attack against ${this.followTarget?.name || 'target'}`);
  }

  /**
   * Override: Called when attack animation completes
   * C# Reference: OnAttacking(_attackDestination)
   *
   * NOTE: In C#, attack damage comes from FlyIni/FlyIni2 magic projectiles via MagicSprite.
   * The damage formula in MagicManager.GetEffectAmount:
   *   effect = (magic.Effect == 0 || !belongCharacter.IsPlayer) ? belongCharacter.RealAttack : magic.Effect
   *
   * Since MagicSprite system is not fully implemented, we use direct damage as placeholder.
   * When MagicSprite is complete, this should trigger FlyIni magic instead.
   */
  protected override onAttacking(): void {
    // Deal damage to target if it's a character
    if (this.followTarget && !this.followTarget.isDeathInvoked) {
      // C# Reference: For NPCs (not player), damage = character.RealAttack
      // takeDamage will apply defend reduction and hit rate calculation
      const attackDamage = this.attack || 10;

      console.log(`[NPC Combat] ${this.name} (Atk:${attackDamage}) attacks ${this.followTarget.name} (Def:${this.followTarget.defend})`);
      this.followTarget.takeDamage(attackDamage, this);
    }
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
    if (!this._magicManager || !this._magicToUseWhenLifeLowData) {
      return;
    }

    // Get direction offset for current direction
    const dirOffsets = [
      { x: 0, y: 32 },    // 0: South
      { x: -23, y: 23 },  // 1: SouthWest
      { x: -32, y: 0 },   // 2: West
      { x: -23, y: -23 }, // 3: NorthWest
      { x: 0, y: -32 },   // 4: North
      { x: 23, y: -23 },  // 5: NorthEast
      { x: 32, y: 0 },    // 6: East
      { x: 23, y: 23 },   // 7: SouthEast
    ];

    const offset = dirOffsets[this._currentDirection] || { x: 0, y: 0 };
    const destination = {
      x: this._positionInWorld.x + offset.x,
      y: this._positionInWorld.y + offset.y,
    };

    this._magicManager.useMagic({
      userId: this._id,
      magic: this._magicToUseWhenLifeLowData,
      origin: this._positionInWorld,
      destination,
    });

    console.log(`[NPC] ${this.name} uses MagicToUseWhenLifeLow: ${this.magicToUseWhenLifeLow}`);
  }

  // clearFollowTarget() - inherited from Character
  // setRelation() - inherited from Character (handles follow target clearing)
  // partnerMoveTo() - inherited from Character

  /**
   * C#: MoveToPlayer() - Partner follows player
   */
  private moveToPlayer(): void {
    if (this._player && !this._player.isStanding()) {
      this.partnerMoveTo(this._player.tilePosition);
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
            false  // isRun = false
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
      if (this._npcManager) {
        const dead = this._npcManager.findFriendDeadKilledByLiveCharacter(
          this,
          this.visionRadius
        );
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
            false  // isRun = false
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
        false  // isRun = false
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
    if (!this._npcManager) {
      // Fallback: return player if no NpcManager
      if (this._player && !this._player.isDeathInvoked) {
        return this._player;
      }
      return null;
    }
    return this._npcManager.getLiveClosestPlayerOrFighterFriend(
      this._positionInWorld,
      false,  // withNeutral
      false   // withInvisible
    );
  }

  /**
   * Get closest enemy character
   */
  private getClosestEnemyCharacter(): Character | null {
    if (!this._npcManager) return null;
    return this._npcManager.getClosestEnemyTypeCharacter(
      this._positionInWorld,
      true,
      false
    );
  }

  /**
   * Get closest non-neutral fighter
   */
  private getClosestNonNeutralFighter(): Character | null {
    if (!this._npcManager) return null;
    return this._npcManager.getLiveClosestNonNeutralFighter(
      this._positionInWorld
    );
  }

  // === Obstacle Check ===

  /**
   * C#: override HasObstacle(tilePosition)
   * Check if position is blocked (includes NPCs, objects, magic)
   * NPC version adds Flyer check and NPC/Player position checks
   */
  override hasObstacle(tilePosition: Vector2): boolean {
    if (this.kind === CharacterKind.Flyer) return false;

    // Check NPC obstacle
    if (this._npcManager?.isObstacle(tilePosition.x, tilePosition.y)) {
      return true;
    }

    // Check map obstacle
    if (this._isMapObstacle && this._isMapObstacle(tilePosition)) {
      return true;
    }

    // Check player position
    if (
      this._player &&
      this._player.mapX === tilePosition.x &&
      this._player.mapY === tilePosition.y
    ) {
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
    console.log(
      `[Npc] SetActionFile: ${this.name}, state=${stateType}, file=${asfFile}`
    );
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
