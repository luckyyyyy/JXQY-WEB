/**
 * Character 主类 - 继承自 CharacterCombat
 * 包含 update 状态机、精灵加载、特殊动作等功能
 *
 * 继承链: Sprite → CharacterBase → CharacterMovement → CharacterCombat → Character
 *
 * 重构说明：
 * - 属性声明在 CharacterBase (~700行)
 * - 移动功能在 CharacterMovement (~600行)
 * - 战斗功能在 CharacterCombat (~500行)
 * - 本文件包含状态机、精灵加载、特殊动作等 (~800行)
 */

import { logger } from "../core/logger";
import type { CharacterConfig, Vector2 } from "../core/types";
import { CharacterState, RUN_SPEED_FOLD, TILE_WIDTH } from "../core/types";
import { getCharacterDeathExp } from "../magic/effect-calc";
import type { MagicSprite } from "../magic/magic-sprite";
import type { MagicData } from "../magic/types";
import { Obj } from "../obj/obj";
import type { Renderer } from "../renderer/renderer";
import {
  createEmptySpriteSet,
  getAsfForState,
  loadSpriteSet,
  type SpriteSet,
  stateToSpriteSetKey,
} from "../sprite/sprite";
import {
  distance,
  distanceFromDelta,
  getDirectionFromVector,
  pixelToTile,
  tileToPixel,
} from "../utils";
import {
  canMoveInDirection,
  findNeighborInDirection as findNeighborByIndex,
  PathType,
} from "../utils/path-finder";
import { CharacterCombat, MAX_NON_FIGHT_SECONDS } from "./base";
import { applyConfigToCharacter } from "./character-config";
import { loadCharacterAsf, loadCharacterImage, loadNpcRes } from "./character-res-loader";

export {
  type CharacterUpdateResult,
  LOADING_STATE,
  MAX_NON_FIGHT_SECONDS,
  type MagicToUseInfoItem,
} from "./base";

/**
 * Character - 完整的角色类
 */
export abstract class Character extends CharacterCombat {
  // =============================================
  // === Type-narrowed overrides ===
  // =============================================

  /** 最后攻击此角色的角色（类型收窄为 Character） */
  override get lastAttacker(): Character | null {
    return this._lastAttacker as Character | null;
  }

  // =============================================
  // === Update State Machine ===
  // =============================================

  override update(deltaTime: number): void {
    // if(!IsVisibleByVariable) { return; }
    if (!this.isVisibleByVariable) return;

    const deltaMs = deltaTime * 1000;

    // 清理已死亡的召唤 NPC
    this.cleanupDeadSummonedNpcs();

    // 召唤物存活时间
    if (this._lifeMilliseconds > 0) {
      this._lifeMilliseconds -= deltaMs;
      if (this._lifeMilliseconds <= 0) {
        this.death();
        return;
      }
    }

    // 状态效果更新
    const statusResult = this.statusEffects.update(deltaTime, this.isDeathInvoked);

    // 处理变身效果结束
    if (statusResult.changeCharacterExpired && statusResult.changeCharacterExpiredMagic) {
      this.onRecoverFromReplaceMagicList(statusResult.changeCharacterExpiredMagic);
      this.state = this._state;
    }

    // 处理中毒伤害
    if (statusResult.poisonDamage > 0) {
      this.addLife(-statusResult.poisonDamage);
      if (statusResult.poisonKillerName) {
        this.handlePoisonExp(statusResult.poisonKillerName);
      }
    }

    // 石化时完全停止
    if (statusResult.isPetrified) {
      return;
    }

    const effectiveDeltaTime = statusResult.effectiveDeltaTime;

    // 特殊动作处理
    if (this.isInSpecialAction) {
      super.update(effectiveDeltaTime);
      if (this.isPlayCurrentDirOnceEnd()) {
        this.isInSpecialAction = false;
        this.endSpecialAction();
        this._currentDirection = this.specialActionLastDirection;
      }
      return;
    }

    // 死亡后停止更新
    if (this.isDeath) return;

    // 贝塞尔移动更新
    this.updateBezierMove(effectiveDeltaTime);
    if (this.inBezierMove) {
      super.update(effectiveDeltaTime);
      return;
    }

    // 被武功精灵拖动
    this.updateMovedByMagicSprite();

    // 状态机 switch
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
        this.updateStandOrHurt(effectiveDeltaTime);
        break;

      case CharacterState.Death:
        this.updateDeath(effectiveDeltaTime);
        break;

      default:
        this.updateStanding(effectiveDeltaTime);
        break;
    }

    // 战斗超时检测
    if (this._isInFighting) {
      this._totalNonFightingSeconds += effectiveDeltaTime;
      if (this._totalNonFightingSeconds > MAX_NON_FIGHT_SECONDS) {
        this.toNonFightingState();
      }
    }
  }

  /**
   * 处理中毒致死经验
   */
  private handlePoisonExp(poisonKillerName: string): void {
    const player = this.engine.player;
    if (player && poisonKillerName === player.name) {
      const exp = getCharacterDeathExp(player, this);
      player.addExp(exp, true);
    } else {
      const npcManager = this.engine.npcManager;
      const poisoner = npcManager.getNpc(poisonKillerName);
      if (poisoner && poisoner.canLevelUp > 0) {
        const exp = getCharacterDeathExp(poisoner, this);
        poisoner.addExp(exp);
      }
    }
  }

  // =============================================
  // === State Update Methods ===
  // =============================================

  protected updateWalking(deltaTime: number): void {
    this.moveAlongPath(deltaTime, this.walkSpeed);
    super.update(deltaTime);
  }

  protected updateRunning(deltaTime: number): void {
    this.moveAlongPath(deltaTime, RUN_SPEED_FOLD);
    super.update(deltaTime);
  }

  protected updateJumping(deltaTime: number): void {
    this.jumpAlongPath(deltaTime);
    super.update(deltaTime);
  }

  protected jumpAlongPath(deltaTime: number): void {
    if (!this.path) {
      this.standingImmediately();
      return;
    }

    if (this.path.length === 2) {
      const from = this.path[0];
      const to = this.path[1];
      const totalDistance = distanceFromDelta(to.x - from.x, to.y - from.y);

      let isOver = false;
      const dirX = to.x - from.x;
      const dirY = to.y - from.y;
      const nextTile = this.findNeighborInDirection(this.tilePosition, { x: dirX, y: dirY });
      const destTile = pixelToTile(to.x, to.y);

      const engine = this.engine;
      const mapService = engine.map;
      const npcManager = engine.npcManager;

      const isMapObstacleForJump = mapService.isObstacleForJump(nextTile.x, nextTile.y);
      const hasTrapScript = mapService.hasTrapScript(this.tilePosition);
      const hasEventer = npcManager.getEventer(nextTile) !== null;

      if (isMapObstacleForJump) {
        this.correctPositionToCurrentTile();
        isOver = true;
      } else if (
        nextTile.x === destTile.x &&
        nextTile.y === destTile.y &&
        this.hasObstacle(nextTile)
      ) {
        this.correctPositionToCurrentTile();
        isOver = true;
      } else if (hasTrapScript) {
        isOver = true;
      } else if (hasEventer) {
        this.correctPositionToCurrentTile();
        isOver = true;
      } else {
        const JUMP_SPEED_FOLD = 8;
        this.moveToVector({ x: dirX, y: dirY }, deltaTime * JUMP_SPEED_FOLD);
      }

      const DISTANCE_OFFSET = 1;
      if (this.movedDistance >= totalDistance - DISTANCE_OFFSET && !isOver) {
        this.movedDistance = 0;
        this._positionInWorld = { x: to.x, y: to.y };
        const tile = pixelToTile(to.x, to.y);
        this._mapX = tile.x;
        this._mapY = tile.y;
        isOver = true;
      }

      if (isOver) {
        this.path.shift();
      }
    }

    if (this.isPlayCurrentDirOnceEnd()) {
      this.standingImmediately();
    }
  }

  protected findNeighborInDirection(tilePos: Vector2, direction: Vector2): Vector2 {
    const dirIndex = getDirectionFromVector(direction);
    return findNeighborByIndex(tilePos, dirIndex);
  }

  protected correctPositionToCurrentTile(): void {
    const tilePixel = tileToPixel(this._mapX, this._mapY);
    this._positionInWorld = { x: tilePixel.x, y: tilePixel.y };
  }

  protected updateSitting(deltaTime: number): void {
    super.update(deltaTime);
  }

  protected updateAttacking(deltaTime: number): void {
    super.update(deltaTime);
    if (this.isPlayCurrentDirOnceEnd()) {
      if (this.statusEffects.isVisibleWhenAttack) {
        this.statusEffects.invisibleByMagicTime = 0;
      }
      this.playStateSound(this._state);
      this.useMagicWhenAttack();
      this.onAttacking(this._attackDestination);
      this.standingImmediately();
    }
  }

  protected useMagicWhenAttack(): void {
    if (this._magicToUseWhenAttack) {
      logger.log(`[Character] ${this.name} would use magic: ${this._magicToUseWhenAttack}`);
    }
    this._magicToUseWhenAttack = null;
    // _attackDestination 不在此处清空，它保持有效直到下次攻击
    // 这样 onAttacking() 可以使用它来释放修炼武功
  }

  protected updateMagic(deltaTime: number): void {
    super.update(deltaTime);
    if (this.isPlayCurrentDirOnceEnd()) {
      if (this.statusEffects.isVisibleWhenAttack) {
        this.statusEffects.invisibleByMagicTime = 0;
      }
      this.onMagicCast();
      this.standingImmediately();
    }
  }

  protected updateStandOrHurt(deltaTime: number): void {
    super.update(deltaTime);
    if (this.isPlayCurrentDirOnceEnd()) {
      this.standingImmediately();
    }
  }

  protected updateDeath(deltaTime: number): void {
    if (this.isDeath) {
      return;
    }

    super.update(deltaTime);

    if (this.isPlayCurrentDirOnceEnd()) {
      this.isDeath = true;
      this._currentFrameIndex = this._frameEnd;
    }
  }

  protected updateStanding(deltaTime: number): void {
    super.update(deltaTime);
  }

  // =============================================
  // === Action Hooks ===
  // =============================================

  /**
   * attackDestinationPixelPosition)
   * Override this to do something when attacking (use magic FlyIni FlyIni2)
   */
  protected onAttacking(_attackDestinationPixelPosition: Vector2 | null): void {
    // Override in subclass
  }

  onMagicCast(): void {
    // Override in subclass
  }

  /** 坐下动作，Player 子类中实现 */
  sitdown(): void {
    this.state = CharacterState.Sit;
  }

  protected onReachedDestination(): void {
    if (this._destinationAttackTilePosition) {
      const result = this.attackingIsOk();
      if (result.isOk) {
        this.performAttackAtDestination();
      }
    }
  }

  protected performAttackAtDestination(): void {
    // Override in subclass
  }

  protected onPerformeAttack(): void {
    // Override in subclass
  }

  protected showMessage(text: string): void {
    logger.log(`[Character] Message: ${text}`);
  }

  // =============================================
  // === Perform Attack ===
  // =============================================

  performeAttack(
    destinationPixelPosition: Vector2,
    magicIni?: string,
    magicData?: MagicData
  ): void {
    const tilePos = pixelToTile(destinationPixelPosition.x, destinationPixelPosition.y);
    this._destinationAttackTilePosition = tilePos;

    if (!this.canPerformAction()) return;
    if (!this.canPerformeAttack()) return;

    if (magicData && magicData.lifeFullToUse > 0 && !this.isFullLife) {
      const isControledByPlayer =
        this.statusEffects.controledMagicSprite !== null &&
        this.statusEffects.controledMagicSprite.belongCharacterId === "player";
      if (this.isPlayer || isControledByPlayer) {
        this.showMessage("满血才能使用");
      }
      return;
    }

    const canAttackDirCountToUse = this.canAttackDirCount;

    if (canAttackDirCountToUse < 8 && canAttackDirCountToUse > 0) {
      const directionIndex = getDirectionFromVector({
        x: destinationPixelPosition.x - this._positionInWorld.x,
        y: destinationPixelPosition.y - this._positionInWorld.y,
      });
      if (!canMoveInDirection(directionIndex, canAttackDirCountToUse)) {
        return;
      }
    }

    this._attackDestination = { ...destinationPixelPosition };

    if (magicIni) {
      this._magicToUseWhenAttack = magicIni;
    } else {
      this._magicToUseWhenAttack = this.getRandomMagicWithUseDistance(this.getAttackRadius());
    }

    this.toFightingState();

    const randomValue = Math.floor(Math.random() * 3);
    let chosenState = CharacterState.Attack;
    if (randomValue === 1 && this.isStateImageOk(CharacterState.Attack1)) {
      chosenState = CharacterState.Attack1;
    } else if (randomValue === 2 && this.isStateImageOk(CharacterState.Attack2)) {
      chosenState = CharacterState.Attack2;
    }

    this.state = chosenState;
    this.onPerformeAttack();

    const dx = tilePos.x - this._mapX;
    const dy = tilePos.y - this._mapY;
    this._currentDirection = getDirectionFromVector({ x: dx, y: dy });
    this.playCurrentDirOnce();
  }

  protected canPerformeAttack(): boolean {
    return !this.isFightDisabled;
  }

  performActionOk(): boolean {
    return this.canPerformAction();
  }

  protected canPerformAction(): boolean {
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
    return !blockedStates.includes(this._state) && !this.isInSpecialAction && !this.inBezierMove;
  }

  // =============================================
  // === Sprite Loading ===
  // =============================================

  async loadSprites(basePath: string, baseFileName: string): Promise<void> {
    this._basePath = basePath;
    this._baseFileName = baseFileName;
    this._spriteSet = await loadSpriteSet(basePath, baseFileName);
    this._updateTextureForState(this._state);
  }

  async loadSpritesFromNpcIni(npcIni?: string): Promise<boolean> {
    const iniFile = npcIni || this.npcIni;
    if (!iniFile) {
      logger.warn(`[Character] No npcIni specified for loadSpritesFromNpcIni`);
      return false;
    }

    const stateMap = await loadNpcRes(iniFile);
    if (!stateMap || stateMap.size === 0) {
      logger.warn(`[Character] No state map for npcIni: ${iniFile}`);
      return false;
    }

    const spriteSet = createEmptySpriteSet();
    const loadPromises: Promise<void>[] = [];

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
      [CharacterState.FightStand]: "fightStand",
      [CharacterState.FightWalk]: "fightWalk",
      [CharacterState.FightRun]: "fightRun",
      [CharacterState.FightJump]: "fightJump",
    };

    for (const [state, info] of stateMap) {
      const key = stateToKey[state];
      if (key && info.imagePath) {
        const promise = loadCharacterImage(info.imagePath, info.shadePath).then((asf) => {
          if (asf) {
            spriteSet[key] = asf;
          }
        });
        loadPromises.push(promise);
      }
      if (info.soundPath) {
        this._stateSounds.set(state, info.soundPath);
      }
    }

    await Promise.all(loadPromises);

    if (!spriteSet.stand && !spriteSet.walk) {
      logger.warn(`[Character] No basic animations loaded for npcIni: ${iniFile}`);
      return false;
    }

    this._spriteSet = spriteSet;
    this.npcIni = iniFile;

    // 刷新贴图，使用新加载的 _spriteSet
    // C# 参考: SetRes() 调用 SetState(State, true) 强制刷新
    this._updateTextureForState(this._state);

    if (this.bodyIni) {
      try {
        const bodyObj = await Obj.createFromFile(this.bodyIni);
        if (bodyObj) {
          this.bodyIniObj = bodyObj;
        }
      } catch (err) {
        logger.warn(`[Character] Failed to load BodyIni ${this.bodyIni}:`, err);
      }
    }

    logger.debug(`[Character] Loaded sprites from NpcRes: ${iniFile}`);
    return true;
  }

  isSpritesLoaded(): boolean {
    return this._spriteSet.stand !== null || this._spriteSet.walk !== null;
  }

  getStateSound(state: CharacterState): string | null {
    return this._stateSounds.get(state) || null;
  }

  protected playStateSound(state: CharacterState): void {
    const soundPath = this._stateSounds.get(state);
    if (soundPath && this.audioManager) {
      this.audioManager.playSound(soundPath);
    }
  }

  isStateImageOk(state: CharacterState): boolean {
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
    return false;
  }

  // =============================================
  // === Special Action Methods ===
  // =============================================

  async setSpecialAction(asfFileName: string): Promise<boolean> {
    this.isInSpecialAction = true;
    this._leftFrameToPlay = 999;

    let normalizedFileName = asfFileName;
    if (asfFileName.includes("/")) {
      normalizedFileName = asfFileName.split("/").pop() || asfFileName;
    }

    const asf = await loadCharacterAsf(normalizedFileName);
    if (!asf) {
      logger.warn(`[Character] Failed to load special action ASF: ${normalizedFileName}`);
      this.isInSpecialAction = false;
      this._leftFrameToPlay = 0;
      return false;
    }

    this.specialActionLastDirection = this._currentDirection;
    this.endPlayCurrentDirOnce();

    this._texture = asf;
    this.specialActionFrame = 0;

    this._frameBegin = 0;
    this._frameEnd = (asf.framesPerDirection || 1) - 1;
    this._currentFrameIndex = 0;
    this._leftFrameToPlay = asf.framesPerDirection || 1;

    return true;
  }

  isSpecialActionEnd(): boolean {
    if (!this.isInSpecialAction) return true;
    return this._leftFrameToPlay <= 0;
  }

  endSpecialAction(): void {
    this._state = CharacterState.Stand;
    this._currentFrameIndex = 0;
    this._elapsedMilliSecond = 0;
    this._leftFrameToPlay = 0;
    this._updateTextureForState(CharacterState.Stand);

    // 处理在特殊动作期间发生的延迟死亡
    if (this._pendingDeath) {
      const killer = this._pendingDeathKiller as Character | null;
      this._pendingDeath = false;
      this._pendingDeathKiller = null;
      this.death(killer);
    }
  }

  playStateOnce(stateToPlay?: CharacterState): boolean {
    const state = stateToPlay ?? this._state;

    // 直接从 _spriteSet 读取（包含通过 setNpcActionFile 设置的自定义动作）
    const asf = getAsfForState(this._spriteSet, state);

    if (!asf) {
      logger.warn(`[Character] No ASF found for state ${state}`);
      return false;
    }

    this._state = state;
    this._texture = asf;
    this._frameBegin = 0;
    this._frameEnd = (asf.framesPerDirection || 1) - 1;
    this._currentFrameIndex = 0;
    this._leftFrameToPlay = asf.framesPerDirection || 1;

    return true;
  }

  /**
   * 设置 NPC 动作文件
   * C# 参考: ResFile.SetNpcStateImage(NpcIni, state, fileName) 直接修改 NpcIni 字典
   *          然后调用 SetState((CharacterState)State, true) 强制刷新当前状态的贴图
   * 我们直接加载 ASF 并设置到 _spriteSet 对应槽位，然后刷新当前状态贴图
   */
  async setNpcActionFile(stateType: number, asfFile: string): Promise<void> {
    const key = stateToSpriteSetKey(stateType as CharacterState);

    // C# 参考: Utils.GetAsf() 对空文件名直接返回 null，不加载也不报错
    // 脚本中 SetNpcActionFile("xxx", 10, "") 是用来清除该状态的动画
    if (!asfFile) {
      this._spriteSet[key] = undefined as never;
      if (!this.isInSpecialAction) {
        this._updateTextureForState(this._state);
      }
      return;
    }

    const asf = await loadCharacterAsf(asfFile);
    if (asf) {
      this._spriteSet[key] = asf;

      logger.debug(`[Character] SetNpcActionFile: state=${stateType} -> ${asfFile}`);

      // C# 参考: SetState((CharacterState)State, true) 总是强制刷新当前状态的贴图
      if (!this.isInSpecialAction) {
        this._updateTextureForState(this._state);
      }
    } else {
      logger.warn(`[Character] Failed to load action file: ${asfFile}`);
    }
  }

  // =============================================
  // === Drawing ===
  // =============================================

  override draw(
    renderer: Renderer,
    cameraX: number,
    cameraY: number,
    offX: number = 0,
    offY: number = 0
  ): void {
    // if (IsDraw) { ... }
    if (!this.isDraw) return;

    let drawColor = "white";
    if (this.frozenSeconds > 0 && this.isFrozenVisualEffect) {
      drawColor = "frozen";
    }
    if (this.poisonSeconds > 0 && this.isPoisonVisualEffect) {
      drawColor = "poison";
    }
    if (this.petrifiedSeconds > 0 && this.isPetrifiedVisualEffect) {
      drawColor = "black";
    }

    this.drawWithColor(renderer, cameraX, cameraY, drawColor, offX, offY);
  }

  drawHighlight(
    renderer: Renderer,
    cameraX: number,
    cameraY: number,
    highlightColor: string = "rgba(255, 255, 0, 0.6)"
  ): void {
    if (!this.isDraw) return;
    super.drawHighlight(renderer, cameraX, cameraY, highlightColor);
  }

  canInteractWith(other: Character): boolean {
    const dist = distance(this._positionInWorld, other._positionInWorld);
    return dist <= this.dialogRadius * TILE_WIDTH * 2;
  }

  // =============================================
  // === MagicSpritesInEffect ===
  // =============================================

  getMagicSpritesInEffect(): MagicSprite[] {
    return this._magicSpritesInEffect;
  }

  addMagicSpriteInEffect(sprite: MagicSprite): void {
    this._magicSpritesInEffect.push(sprite);
  }

  removeMagicSpriteInEffect(sprite: MagicSprite): void {
    const index = this._magicSpritesInEffect.indexOf(sprite);
    if (index !== -1) {
      this._magicSpritesInEffect.splice(index, 1);
    }
  }

  cleanupMagicSpritesInEffect(): void {
    // 原地删除已销毁的精灵，避免创建新数组减少 GC 压力
    for (let i = this._magicSpritesInEffect.length - 1; i >= 0; i--) {
      if (this._magicSpritesInEffect[i].isDestroyed) {
        this._magicSpritesInEffect.splice(i, 1);
      }
    }
  }

  // =============================================
  // === Status Effect Methods ===
  // =============================================

  /**
   * 结束控制角色（空实现，由 Player 覆写）
   * 只有 Player 有实际实现
   */
  endControlCharacter(): void {
    // 空实现 - Character 基类不需要此功能
    // Player 类会覆写此方法
  }

  /**
   * 清除冰冻、中毒、石化状态
   */
  toNormalState(): void {
    this.statusEffects.toNormalState();
  }

  /**
   * 解除所有异常状态
   */
  removeAbnormalState(): void {
    this.statusEffects.removeAbnormalState();
  }

  clearFrozen(): void {
    this.statusEffects.clearFrozen();
  }

  clearPoison(): void {
    this.statusEffects.clearPoison();
  }

  clearPetrifaction(): void {
    this.statusEffects.clearPetrifaction();
  }

  // =============================================
  // === Drug Methods ===
  // =============================================

  useDrug(drug: {
    kind: number;
    life: number;
    thew: number;
    mana: number;
    lifeMax: number;
    thewMax: number;
    manaMax: number;
    theEffectType: number;
  }): boolean {
    if (drug && drug.kind === 0) {
      if (drug.lifeMax !== 0) this.lifeMax += drug.lifeMax;
      if (drug.thewMax !== 0) this.thewMax += drug.thewMax;
      if (drug.manaMax !== 0) this.manaMax += drug.manaMax;

      if (drug.life !== 0) this.life = Math.min(this.lifeMax, Math.max(0, this.life + drug.life));
      if (drug.thew !== 0) this.thew = Math.min(this.thewMax, Math.max(0, this.thew + drug.thew));
      if (drug.mana !== 0) this.mana = Math.min(this.manaMax, Math.max(0, this.mana + drug.mana));

      switch (drug.theEffectType) {
        case 4:
          this.clearFrozen();
          break;
        case 6:
          this.clearPoison();
          break;
        case 8:
          this.clearPetrifaction();
          break;
      }

      return true;
    }
    return false;
  }

  // =============================================
  // === ChangeCharacter/Morph/Weak Methods ===
  // =============================================

  changeCharacterBy(magicSprite: MagicSprite): void {
    const replaceMagic = this.statusEffects.changeCharacterBy(magicSprite);
    this.onReplaceMagicList(magicSprite.magic, replaceMagic);
    this.standImmediately();
  }

  morphBy(magicSprite: MagicSprite): void {
    const replaceMagic = this.statusEffects.morphBy(magicSprite);
    this.onReplaceMagicList(magicSprite.magic, replaceMagic);
    this.standImmediately();
  }

  weakBy(magicSprite: MagicSprite): void {
    this.statusEffects.weakBy(magicSprite);
  }

  changeToOpposite(milliseconds: number): void {
    if (this.isPlayer) return;
    this.statusEffects.changeToOppositeMilliseconds =
      this.statusEffects.changeToOppositeMilliseconds > 0 ? 0 : milliseconds;
  }

  flyIniChangeBy(magicSprite: MagicSprite): void {
    this.removeFlyIniChangeBy();
    this.statusEffects.changeFlyIniByMagicSprite = magicSprite;
    const replaceFlyIni = magicSprite.magic.specialKind9ReplaceFlyIni;
    if (replaceFlyIni) this.addFlyIniReplace(replaceFlyIni);
    const replaceFlyIni2 = magicSprite.magic.specialKind9ReplaceFlyIni2;
    if (replaceFlyIni2) this.addFlyIniReplace(replaceFlyIni2);
  }

  private removeFlyIniChangeBy(): void {
    if (this.statusEffects.changeFlyIniByMagicSprite !== null) {
      const replaceFlyIni =
        this.statusEffects.changeFlyIniByMagicSprite.magic.specialKind9ReplaceFlyIni;
      if (replaceFlyIni) this.removeFlyIniReplace(replaceFlyIni);
      const replaceFlyIni2 =
        this.statusEffects.changeFlyIniByMagicSprite.magic.specialKind9ReplaceFlyIni2;
      if (replaceFlyIni2) this.removeFlyIniReplace(replaceFlyIni2);
      this.statusEffects.changeFlyIniByMagicSprite = null;
    }
  }

  // =============================================
  // === ReplaceMagicList Methods ===
  // =============================================

  protected onReplaceMagicList(_reasonMagic: MagicData, listStr: string): void {
    this._flyIniManager.replaceMagicList(listStr, this.attackRadius, this.name);
  }

  protected onRecoverFromReplaceMagicList(reasonMagic: MagicData): void {
    if (!reasonMagic?.replaceMagic) return;
    this._flyIniManager.recoverMagicList(this.name);
  }

  protected standImmediately(): void {
    this.state = this.selectFightOrNormalState(CharacterState.FightStand, CharacterState.Stand);
    this.path = [];
  }

  // =============================================
  // === Config Loading ===
  // =============================================

  loadFromConfig(config: CharacterConfig): void {
    applyConfigToCharacter(config, this);
    this.applyConfigSetters();
  }

  applyConfigSetters(): void {
    this.setDirection(this.dir);
    if (this.flyIni) this.setFlyIni(this.flyIni);
    if (this.flyIni2) this.setFlyIni2(this.flyIni2);
    if (this.flyInis) this.setFlyInis(this.flyInis);
    if (this.fixedPos) this.setFixedPos(this.fixedPos);
  }

  setFixedPos(value: string): void {
    this.fixedPos = value;
  }

  // =============================================
  // === PathType (abstract) ===
  // =============================================

  getPathType(): PathType {
    if (this.pathFinder === 1) {
      return PathType.PerfectMaxPlayerTry;
    }
    return PathType.PathOneStep;
  }

  /**
   * 动态增加数值属性（脚本命令 AddProperty 使用）
   * 只对已存在的 number 类型属性生效
   */
  addNumericProperty(propName: string, value: number): void {
    const key = propName.charAt(0).toLowerCase() + propName.slice(1);
    const record = this as unknown as Record<string, unknown>;
    if (key in record && typeof record[key] === "number") {
      (record[key] as number) += value;
    }
  }
}
