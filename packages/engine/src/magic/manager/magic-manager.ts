/**
 * MagicManager - 武功管理器（重构后）
 * 基于 JxqyHD Engine/MagicManager.cs
 *
 * 职责：
 * - 组合各子模块（CharacterHelper, SpriteFactory, CollisionHandler, SpriteUpdater）
 * - 提供对外公共接口
 * - 管理共享状态
 */

import type { AudioManager } from "../../audio";
import { logger } from "../../core/logger";
import type { Vector2 } from "../../core/types";
import type { ScreenEffects } from "../../renderer/screen-effects";
import type { GuiManager } from "../../gui/gui-manager";
import type { NpcManager } from "../../npc";
import type { MagicListManager } from "../../player/magic/magic-list-manager";
import type { Player } from "../../player/player";
import { pixelToTile } from "../../utils";
import {
  type ApplyContext,
  type CastContext,
  type CharacterRef,
  type EndContext,
  getEffect,
  getEffectAmount,
} from "../effects";
import { getMagic, getMagicAtLevel, initMagicLoader } from "../magic-loader";
import { type MagicSprite, resetMagicSpriteIdCounter } from "../magic-sprite";
import type { MagicRenderer } from "../magic-renderer";
import type { MagicData, UseMagicParams } from "../types";
import { MagicMoveKind } from "../types";
import { CharacterHelper } from "./character-helper";
import { CollisionHandler, type ICollisionCallbacks } from "./collision-handler";
import { SpriteFactory } from "./sprite-factory";
import { type ISpriteUpdaterCallbacks, SpriteUpdater } from "./sprite-updater";
import type { ISpriteFactoryCallbacks, MagicManagerDeps, MagicManagerState } from "./types";

// 重新导出类型以保持向后兼容
export type { MagicManagerDeps } from "./types";

/**
 * 武功管理器
 */
export class MagicManager {
  // 共享状态
  private state: MagicManagerState;

  // 子模块
  private charHelper: CharacterHelper;
  private factory: SpriteFactory;
  private collision: CollisionHandler;
  private updater: SpriteUpdater;

  // 依赖
  private player: Player;
  private npcManager: NpcManager;
  private guiManager: GuiManager;
  private screenEffects: ScreenEffects;
  private audioManager: AudioManager;
  private magicListManager: MagicListManager;
  private magicRenderer: MagicRenderer;
  private vibrateScreenCallback?: (intensity: number) => void;

  // 精灵销毁事件监听器
  private onSpriteDestroyedListeners: ((sprite: MagicSprite) => void)[] = [];

  constructor(deps: MagicManagerDeps) {
    this.player = deps.player;
    this.npcManager = deps.npcManager;
    this.guiManager = deps.guiManager;
    this.screenEffects = deps.screenEffects;
    this.audioManager = deps.audioManager;
    this.magicListManager = deps.magicListManager;
    this.magicRenderer = deps.magicRenderer;
    this.vibrateScreenCallback = deps.vibrateScreen;

    // 初始化 magicLoader 模块渲染器引用
    initMagicLoader(deps.magicRenderer);

    // 初始化共享状态
    this.state = {
      magicSprites: new Map(),
      workList: [],
      effectSprites: new Map(),
      maxMagicUnit: 1000,
      isInSuperMagicMode: false,
      superModeMagicSprite: null,
      timeStopperMagicSprite: null,
      kind19Magics: [],
      magicSpritesByRow: new Map(),
      effectSpritesByRow: new Map(),
    };

    // 初始化子模块
    this.charHelper = new CharacterHelper(deps);

    // 创建回调对象
    const factoryCallbacks: ISpriteFactoryCallbacks = {
      addMagicSprite: (sprite) => this.addMagicSprite(sprite),
      addWorkItem: (delayMs, sprite) => this.addWorkItem(delayMs, sprite),
      initializeSpriteEffects: (sprite) => this.initializeSpriteEffects(sprite),
      useMagic: (params) => this.useMagic(params),
      setSuperModeState: (sprite) => {
        this.state.isInSuperMagicMode = sprite !== null;
        this.state.superModeMagicSprite = sprite;
      },
      setTimeStopperSprite: (sprite) => {
        this.state.timeStopperMagicSprite = sprite;
      },
      getKind19Magics: () => this.state.kind19Magics,
      addKind19Magic: (info) => this.state.kind19Magics.push(info),
    };

    const collisionCallbacks: ICollisionCallbacks = {
      createApplyContext: (sprite, targetRef) => this.createApplyContext(sprite, targetRef),
      createEndContext: (sprite) => this.createEndContext(sprite),
      startDestroyAnimation: (sprite) => this.updater.startDestroyAnimation(sprite),
      createHitEffect: (sprite) => this.updater.createHitEffect(sprite),
      playSound: (path) => this.playSound(path),
      useMagic: (params) => this.useMagic(params),
    };

    const updaterCallbacks: ISpriteUpdaterCallbacks = {
      createApplyContext: (sprite, targetRef) =>
        this.createApplyContext(sprite, targetRef as CharacterRef),
      createEndContext: (sprite) => this.createEndContext(sprite),
      playSound: (path) => this.playSound(path),
      vibrateScreen: (intensity) => this.vibrateScreen(intensity),
      triggerExplodeMagic: (sprite, pos) => this.triggerExplodeMagic(sprite, pos),
      useMagic: (params) => this.useMagic(params),
      emitSpriteDestroyed: (sprite) => this.emitSpriteDestroyed(sprite),
      addEffectSprite: (sprite) => this.state.effectSprites.set(sprite.id, sprite),
      addFixedPositionMagicSprite: (userId, magic, pos, destroyOnEnd) =>
        this.factory.addFixedPositionMagicSprite(userId, magic, pos, destroyOnEnd),
    };

    this.factory = new SpriteFactory(deps, this.charHelper, factoryCallbacks);
    this.collision = new CollisionHandler(deps, this.charHelper, collisionCallbacks, this.state);
    this.updater = new SpriteUpdater(
      deps,
      this.charHelper,
      this.collision,
      updaterCallbacks,
      this.state
    );
  }

  // ========== 公共接口 ==========

  /**
   * 添加精灵销毁事件监听器
   */
  onSpriteDestroyed(listener: (sprite: MagicSprite) => void): void {
    this.onSpriteDestroyedListeners.push(listener);
  }

  /**
   * 触发精灵销毁事件
   */
  private emitSpriteDestroyed(sprite: MagicSprite): void {
    for (const listener of this.onSpriteDestroyedListeners) {
      listener(sprite);
    }
  }

  /**
   * 设置最大武功数量
   */
  setMaxMagicUnit(max: number): void {
    this.state.maxMagicUnit = max;
  }

  /**
   * 获取所有活动的武功精灵（用于渲染）
   */
  getMagicSprites(): Map<number, MagicSprite> {
    return this.state.magicSprites;
  }

  /**
   * 获取特效精灵
   */
  getEffectSprites(): Map<number, MagicSprite> {
    return this.state.effectSprites;
  }

  /**
   * 获取指定行的武功精灵（用于交错渲染）
   */
  getMagicSpritesAtRow(row: number): readonly MagicSprite[] {
    return this.state.magicSpritesByRow.get(row) ?? [];
  }

  /**
   * 获取指定行的特效精灵（用于交错渲染）
   */
  getEffectSpritesAtRow(row: number): readonly MagicSprite[] {
    return this.state.effectSpritesByRow.get(row) ?? [];
  }

  /**
   * 是否处于 SuperMode
   */
  get isInSuperMagicMode(): boolean {
    return this.state.isInSuperMagicMode;
  }

  /**
   * 获取 SuperMode 精灵
   */
  get superModeMagicSprite(): MagicSprite | null {
    return this.state.superModeMagicSprite;
  }

  /**
   * 清除所有武功
   */
  clear(): void {
    this.state.magicSprites.clear();
    this.state.workList = [];
    this.state.effectSprites.clear();
    this.state.kind19Magics = [];
    resetMagicSpriteIdCounter();
    this.state.isInSuperMagicMode = false;
    this.state.superModeMagicSprite = null;
    this.onSpriteDestroyedListeners.length = 0;
  }

  /**
   * 重置武功管理器
   */
  renew(): void {
    this.state.workList = [];
    this.state.effectSprites.clear();
    this.state.kind19Magics = [];
    this.state.timeStopperMagicSprite = null;

    for (const sprite of this.state.magicSprites.values()) {
      sprite.isDestroyed = true;
    }
  }

  /**
   * 更新循环
   */
  update(deltaMs: number): void {
    // 处理工作队列中准备好的项
    const readyItems = this.updater.getReadyWorkItems(deltaMs);
    for (const item of readyItems) {
      this.addMagicSprite(item.sprite);
    }

    // 委托给 updater
    this.updater.update(deltaMs);
  }

  /**
   * 更新按行分组的精灵缓存（供外部调用）
   */
  updateSpritesByRow(): void {
    // 由 updater.update() 内部调用
  }

  /**
   * 检查是否为障碍物
   */
  isObstacle(tile: Vector2): boolean {
    for (const sprite of this.state.magicSprites.values()) {
      if (sprite.magic.bodyRadius > 0) {
        if (sprite.tilePosition.x === tile.x && sprite.tilePosition.y === tile.y) {
          return true;
        }
      }
    }
    return false;
  }

  // ========== 武功使用 ==========

  useMagic(params: UseMagicParams): void {
    const { userId, magic, origin, destination, targetId } = params;

    // 获取效果定义
    const effect = getEffect(magic.moveKind);

    // 获取目标引用（如果有）
    const targetRef = targetId ? this.charHelper.getCharacterRef(targetId) : undefined;

    // 调用 onCast
    if (effect?.onCast) {
      const castCtx = this.createCastContext(userId, params, targetRef ?? undefined);
      if (castCtx) {
        effect.onCast(castCtx);
      }
    }

    // 根据 MoveKind 创建精灵
    let sprite: MagicSprite | undefined;

    switch (magic.moveKind) {
      case MagicMoveKind.NoMove:
        break;
      case MagicMoveKind.FixedPosition:
        this.factory.addFixedPositionMagicSprite(userId, magic, destination, true);
        break;
      case MagicMoveKind.SingleMove:
        this.factory.addSingleMoveMagicSprite(userId, magic, origin, destination, false);
        break;
      case MagicMoveKind.LineMove:
        this.factory.addLineMoveMagicSprite(userId, magic, origin, destination, false);
        break;
      case MagicMoveKind.CircleMove:
        this.factory.addCircleMoveMagicSprite(userId, magic, origin, false);
        break;
      case MagicMoveKind.HeartMove:
        this.factory.addHeartMoveMagicSprite(userId, magic, origin, false);
        break;
      case MagicMoveKind.SpiralMove:
        this.factory.addSpiralMoveMagicSprite(userId, magic, origin, destination, false);
        break;
      case MagicMoveKind.SectorMove:
        this.factory.addSectorMoveMagicSprite(userId, magic, origin, destination, false);
        break;
      case MagicMoveKind.RandomSector:
        this.factory.addRandomSectorMoveMagicSprite(userId, magic, origin, destination, false);
        break;
      case MagicMoveKind.FixedWall:
        this.factory.addFixedWallMagicSprite(userId, magic, origin, destination, true);
        break;
      case MagicMoveKind.WallMove:
        this.factory.addWallMoveMagicSprite(userId, magic, origin, destination, false);
        break;
      case MagicMoveKind.FollowCharacter:
      case MagicMoveKind.TimeStop:
        {
          const targetChar = targetRef ? this.charHelper.getCharacterFromRef(targetRef) : undefined;
          sprite =
            this.factory.addFollowCharacterMagicSprite(userId, magic, origin, true, targetChar) ??
            undefined;
        }
        break;
      case MagicMoveKind.SuperMode:
        {
          sprite = this.factory.addSuperModeMagicSprite(userId, magic, origin, true);
          if (sprite) {
            this.state.isInSuperMagicMode = true;
            this.state.superModeMagicSprite = sprite;
            logger.log(`[MagicManager] SuperMode activated: ${magic.name}`);
          }
        }
        break;
      case MagicMoveKind.FollowEnemy:
        this.factory.addFollowEnemyMagicSprite(userId, magic, origin, destination, false);
        break;
      case MagicMoveKind.Throw:
        this.factory.addThrowMagicSprite(userId, magic, origin, destination, true);
        break;
      case MagicMoveKind.RegionBased:
        this.factory.addRegionBasedMagicSprite(userId, magic, origin, destination, true);
        break;
      case MagicMoveKind.Kind19:
        this.factory.addKind19MagicSprite(userId, magic);
        break;
      case MagicMoveKind.Transport:
        this.factory.addTransportMagicSprite(userId, magic, destination, true);
        break;
      case MagicMoveKind.PlayerControl:
        this.factory.addControlCharacterMagicSprite(
          userId,
          magic,
          origin,
          true,
          targetRef ?? undefined
        );
        break;
      case MagicMoveKind.Summon:
        void this.factory.addSummonMagicSprite(userId, magic, destination, true);
        break;
      case MagicMoveKind.VMove:
        this.factory.addVMoveMagicSprite(userId, magic, origin, destination, false);
        break;
      default:
        logger.warn(`[MagicManager] Unknown MoveKind: ${magic.moveKind}, using SingleMove`);
        this.factory.addSingleMoveMagicSprite(userId, magic, origin, destination, false);
        break;
    }

    if (magic.flyingSound) {
      this.playSound(magic.flyingSound);
    }

    if (magic.vibratingScreen > 0) {
      this.vibrateScreen(magic.vibratingScreen);
    }

    // 副作用伤害
    this.handleSideEffect(userId, magic);

    // 跳跃到目标
    this.handleJumpToTarget(userId, magic, destination);
  }

  // ========== 内部方法 ==========

  private addMagicSprite(sprite: MagicSprite): void {
    if (this.state.maxMagicUnit > 0 && this.state.magicSprites.size >= this.state.maxMagicUnit) {
      const skipKinds = [
        MagicMoveKind.FollowCharacter,
        MagicMoveKind.Transport,
        MagicMoveKind.PlayerControl,
        MagicMoveKind.TimeStop,
      ];
      if (!skipKinds.includes(sprite.magic.moveKind)) {
        logger.debug(`[MagicManager] Max magic unit reached, skipping ${sprite.magic.name}`);
        return;
      }
    }
    this.initializeSpriteEffects(sprite);
    this.state.magicSprites.set(sprite.id, sprite);
  }

  private addWorkItem(delayMs: number, sprite: MagicSprite): void {
    if (delayMs < 1) {
      this.addMagicSprite(sprite);
    } else {
      this.state.workList.push({
        leftMilliseconds: delayMs,
        sprite,
        spriteIndex: sprite.id,
      });
    }
  }

  private initializeSpriteEffects(sprite: MagicSprite): void {
    const belongCharacter = this.charHelper.getBelongCharacter(sprite.belongCharacterId);
    if (!belongCharacter) return;

    const effect = getEffectAmount(sprite.magic, belongCharacter, "effect");
    const effect2 = getEffectAmount(sprite.magic, belongCharacter, "effect2");
    const effect3 = getEffectAmount(sprite.magic, belongCharacter, "effect3");

    sprite.initializeEffects(effect, effect2, effect3);

    // 初始化跳跃传递参数
    // Reference: MagicSprite.Init() - _canLeap = BelongMagic.LeapTimes > 0
    sprite.initializeLeap();

    // 初始化范围效果计时器
    // Reference: MagicSprite.Init() - _rangeElapsedMilliseconds = belongMagic.RangeTimeInerval;
    // 初始值为间隔时间，这样第一次触发会立即发生
    sprite.rangeElapsedMilliseconds = sprite.magic.rangeTimeInterval;
  }

  private createCastContext(
    userId: string,
    params: UseMagicParams,
    target?: CharacterRef
  ): CastContext | null {
    const caster = this.charHelper.getCharacterRef(userId);
    if (!caster) return null;

    return {
      caster,
      magic: params.magic,
      origin: params.origin,
      destination: params.destination,
      target,
      guiManager: this.guiManager,
      screenEffects: this.screenEffects,
      audioManager: this.audioManager,
      vibrateScreen: this.vibrateScreenCallback,
    };
  }

  private createApplyContext(sprite: MagicSprite, targetRef: CharacterRef): ApplyContext | null {
    const caster = this.charHelper.getCharacterRef(sprite.belongCharacterId);
    if (!caster) return null;

    return {
      caster,
      target: targetRef,
      magic: sprite.magic,
      sprite,
      guiManager: this.guiManager,
      screenEffects: this.screenEffects,
      audioManager: this.audioManager,
    };
  }

  private createEndContext(sprite: MagicSprite): EndContext | null {
    const caster = this.charHelper.getCharacterRef(sprite.belongCharacterId);
    if (!caster) return null;

    return {
      caster,
      magic: sprite.magic,
      sprite,
      guiManager: this.guiManager,
      screenEffects: this.screenEffects,
      audioManager: this.audioManager,
    };
  }

  private vibrateScreen(intensity: number): void {
    if (this.vibrateScreenCallback) {
      this.vibrateScreenCallback(intensity);
    } else {
      logger.log(`[MagicManager] Screen vibrate intensity ${intensity} (no callback)`);
    }
  }

  private playSound(soundPath: string): void {
    if (soundPath && this.audioManager) {
      this.audioManager.playSound(soundPath);
    }
  }

  private handleSideEffect(userId: string, magic: MagicData): void {
    if (magic.sideEffectProbability > 0) {
      const roll = Math.floor(Math.random() * 100);
      if (roll < magic.sideEffectProbability) {
        const casterChar = this.charHelper.getBelongCharacter(userId);
        if (casterChar) {
          const effect1 = getEffectAmount(magic, casterChar, "effect");
          const effect2 = getEffectAmount(magic, casterChar, "effect2");
          const effect3 = getEffectAmount(magic, casterChar, "effect3");
          const totalEffect = effect1 + effect2 + effect3;
          const amount = Math.floor((totalEffect * magic.sideEffectPercent) / 100);

          if (amount > 0) {
            switch (magic.sideEffectType) {
              case 0:
                casterChar.addLife(-amount);
                break;
              case 1:
                casterChar.addMana(-amount);
                break;
              case 2:
                casterChar.addThew(-amount);
                break;
            }
          }
        }
      }
    }
  }

  private handleJumpToTarget(userId: string, magic: MagicData, destination: Vector2): void {
    if (magic.jumpToTarget > 0) {
      const casterChar = this.charHelper.getBelongCharacter(userId);
      if (casterChar) {
        const destinationTile = pixelToTile(destination.x, destination.y);
        casterChar.bezierMoveTo(destinationTile, magic.jumpMoveSpeed, (character) => {
          if (magic.jumpEndMagic) {
            this.updater.triggerJumpEndMagic(magic.jumpEndMagic, character, userId);
          }
        });
      }
    }
  }

  /**
   * 触发爆炸武功
   * 战斗中同步获取缓存
   */
  private triggerExplodeMagic(sprite: MagicSprite, position?: Vector2): void {
    if (!sprite.magic.explodeMagicFile) return;

    const explodePos = position ?? sprite.position;

    const explodeMagic = getMagic(sprite.magic.explodeMagicFile);
    if (!explodeMagic) {
      logger.warn(`[MagicManager] ExplodeMagic not preloaded: ${sprite.magic.explodeMagicFile}`);
      return;
    }

    const level = sprite.magic.currentLevel || 1;
    const magicAtLevel = getMagicAtLevel(explodeMagic, level);

    logger.log(
      `[MagicManager] Triggering explode magic: ${magicAtLevel.name} at position (${explodePos.x}, ${explodePos.y})`
    );

    this.useMagic({
      magic: magicAtLevel,
      origin: explodePos,
      destination: explodePos,
      userId: sprite.belongCharacterId,
    });
  }
}
