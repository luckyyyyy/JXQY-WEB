/**
 * Sprite Updater - 武功精灵更新循环
 * 从 MagicSpriteManager 提取
 *
 * Reference: MagicSpriteManager.Update(), MagicSprite.Update()
 */

import type { AudioManager } from "../../audio";
import type { Character } from "../../character/character";
import { getEngineContext } from "../../core/engine-context";
import { logger } from "../../core/logger";
import type { Vector2 } from "../../core/types";
import type { GuiManager } from "../../gui/gui-manager";
import type { NpcManager } from "../../npc";
import type { Player } from "../../player/player";
import type { ScreenEffects } from "../../renderer/screen-effects";
import { pixelToTile, tileToPixel } from "../../utils";
import { vectorLength } from "../../utils/math";
import {
  type ApplyContext,
  applyStatusEffect,
  type EndContext,
  getPosition as getCharPosition,
  getEffect,
} from "../effects";
import { resolveMagic } from "../magic-config-loader";
import type { WorkItem } from "../magic-sprite";
import { type MagicSprite, MINIMAL_DAMAGE } from "../magic-sprite";
import type { MagicData } from "../types";
import { MAGIC_BASE_SPEED, MagicMoveKind } from "../types";
import type {
  CharacterHelper,
  CollisionHandler,
  MagicSpriteManagerDeps,
  MagicSpriteManagerState,
} from "./types";

/**
 * 更新器回调
 */
export interface SpriteUpdaterCallbacks {
  createApplyContext(sprite: MagicSprite, targetRef: unknown): ApplyContext | null;
  createEndContext(sprite: MagicSprite): EndContext | null;
  playSound(soundPath: string): void;
  vibrateScreen(intensity: number): void;
  triggerExplodeMagic(sprite: MagicSprite, position?: Vector2): void;
  useMagic(params: {
    userId: string;
    magic: MagicData;
    origin: Vector2;
    destination: Vector2;
    targetId?: string;
  }): void;
  emitSpriteDestroyed(sprite: MagicSprite): void;
  addEffectSprite(sprite: MagicSprite): void;
  addFixedPositionMagicSprite(
    userId: string,
    magic: MagicData,
    position: Vector2,
    destroyOnEnd: boolean
  ): MagicSprite;
}

/**
 * 武功精灵更新器
 */
export class SpriteUpdater {
  protected get engine() {
    return getEngineContext();
  }

  private player: Player;
  private guiManager: GuiManager;
  private screenEffects: ScreenEffects;
  private audioManager: AudioManager;
  private charHelper: CharacterHelper;
  private collision: CollisionHandler;
  private callbacks: SpriteUpdaterCallbacks;
  private state: MagicSpriteManagerState;

  constructor(
    deps: MagicSpriteManagerDeps,
    charHelper: CharacterHelper,
    collision: CollisionHandler,
    callbacks: SpriteUpdaterCallbacks,
    state: MagicSpriteManagerState
  ) {
    this.player = deps.player as Player;
    this.guiManager = deps.guiManager;
    this.screenEffects = deps.screenEffects;
    this.audioManager = deps.audio;
    this.charHelper = charHelper;
    this.collision = collision;
    this.callbacks = callbacks;
    this.state = state;
  }

  /**
   * 主更新循环
   */
  update(deltaMs: number): void {
    // SuperMode 优先处理
    if (this.state.isInSuperMagicMode && this.state.superModeMagicSprite) {
      this.updateSprite(this.state.superModeMagicSprite, deltaMs);
      if (this.state.superModeMagicSprite.isDestroyed) {
        logger.log(`[SpriteUpdater] SuperMode ended`);
        this.handleSpriteEnd(this.state.superModeMagicSprite);
        this.callbacks.emitSpriteDestroyed(this.state.superModeMagicSprite);
        this.state.isInSuperMagicMode = false;
        this.state.superModeMagicSprite = null;
      }
      return;
    }

    // 处理工作队列
    const readyItems: WorkItem[] = [];
    this.state.workList = this.state.workList.filter((item) => {
      item.leftMilliseconds -= deltaMs;
      if (item.leftMilliseconds <= 0) {
        readyItems.push(item);
        return false;
      }
      return true;
    });

    // 更新武功精灵
    const toRemove: number[] = [];
    for (const [id, sprite] of this.state.magicSprites) {
      this.updateSprite(sprite, deltaMs);
      if (sprite.isDestroyed) {
        toRemove.push(id);
      }
    }
    for (const id of toRemove) {
      const sprite = this.state.magicSprites.get(id);
      if (sprite) {
        this.handleSpriteEnd(sprite);
        this.callbacks.emitSpriteDestroyed(sprite);
      }
      this.state.magicSprites.delete(id);
    }

    // 更新特效精灵
    const effectsToRemove: number[] = [];
    for (const [id, sprite] of this.state.effectSprites) {
      sprite.elapsedMilliseconds += deltaMs;
      sprite.frameElapsed += deltaMs;

      if (sprite.frameElapsed >= sprite.frameInterval) {
        sprite.currentFrameIndex++;
        sprite.frameElapsed = 0;
      }

      if (sprite.currentFrameIndex >= sprite.vanishFramesPerDirection) {
        sprite.isDestroyed = true;
        effectsToRemove.push(id);
      }
    }
    for (const id of effectsToRemove) {
      this.state.effectSprites.delete(id);
    }

    // 更新 Kind19 持续留痕武功
    this.updateKind19Magics(deltaMs);

    // 更新按行分组的精灵缓存
    this.updateSpritesByRow();
  }

  /**
   * 返回准备好的工作项（延迟添加到magicSprites）
   */
  getReadyWorkItems(deltaMs: number): WorkItem[] {
    const readyItems: WorkItem[] = [];
    this.state.workList = this.state.workList.filter((item) => {
      item.leftMilliseconds -= deltaMs;
      if (item.leftMilliseconds <= 0) {
        readyItems.push(item);
        return false;
      }
      return true;
    });
    return readyItems;
  }

  /**
   * 更新单个精灵
   */
  updateSprite(sprite: MagicSprite, deltaMs: number): void {
    if (sprite.isDestroyed) return;

    if (sprite.waitMilliseconds > 0) {
      sprite.waitMilliseconds -= deltaMs;
      return;
    }

    if (sprite.leftFrameToPlay === 0 && sprite.elapsedMilliseconds === 0) {
      sprite.resetPlay();
    }

    sprite.elapsedMilliseconds += deltaMs;

    // 帧动画更新
    sprite.frameElapsed += deltaMs;
    const effectiveInterval = sprite.frameInterval > 0 ? sprite.frameInterval : 16;
    if (sprite.frameElapsed >= effectiveInterval) {
      sprite.currentFrameIndex++;
      if (sprite.leftFrameToPlay > 0) {
        sprite.leftFrameToPlay--;
      }
      sprite.frameElapsed -= effectiveInterval;
    }

    // 销毁动画处理
    if (sprite.isInDestroy) {
      if (sprite.isSuperMode || sprite.magic.moveKind === MagicMoveKind.SuperMode) {
        this.updateSuperModeDestroySprites(sprite, deltaMs);
        const anyEnded = sprite.superModeDestroySprites.some((s) => !s.isInPlaying);
        if (anyEnded || sprite.superModeDestroySprites.length === 0) {
          sprite.isDestroyed = true;
        }
        return;
      } else {
        if (!sprite.isInPlaying) {
          sprite.isDestroyed = true;
          return;
        }
      }
    }

    if (sprite.isInDestroy) return;

    // 跟随角色移动
    if (
      sprite.magic.moveKind === MagicMoveKind.FollowCharacter ||
      sprite.magic.moveKind === MagicMoveKind.TimeStop
    ) {
      const pos = this.charHelper.getCharacterPosition(sprite.belongCharacterId);
      if (pos) {
        sprite.positionInWorld = { x: pos.x, y: pos.y };
      }
    }

    // 寄生角色更新逻辑
    // Reference: MagicSprite.Update() - if (_parasitiferCharacter != null)
    if (sprite.parasitiferCharacterId !== null) {
      this.updateParasiticCharacter(sprite, deltaMs);
      // 寄生状态下不进行其他逻辑
      return;
    }

    // MoveBack 回拉逻辑 - Sticky 命中后将目标拉回施法者位置
    // Reference: MagicSprite.Update() - if (_isInMoveBack)
    if (sprite.isInMoveBack && sprite.stickedCharacterId !== null) {
      const belongCharacter = this.charHelper.getBelongCharacter(sprite.belongCharacterId);
      if (belongCharacter) {
        const userPos = this.charHelper.getCharacterPosition(sprite.belongCharacterId);
        if (userPos) {
          // 计算回拉方向
          const dir = {
            x: userPos.x - sprite.positionInWorld.x,
            y: userPos.y - sprite.positionInWorld.y,
          };
          const len = vectorLength(dir);

          // 当距离小于 20 像素时，完成回拉
          if (len < 20) {
            sprite.isInMoveBack = false;
            sprite.isDestroyed = true;
            // 释放粘附的角色
            const stickedChar = this.charHelper.getBelongCharacter(sprite.stickedCharacterId);
            if (stickedChar) {
              stickedChar.movedByMagicSprite = null;
            }
            sprite.clearStickedCharacter();
            logger.log(`[SpriteUpdater] MoveBack completed, sprite destroyed`);
            return;
          }

          // 设置回拉方向
          if (len > 0) {
            sprite.direction = { x: dir.x / len, y: dir.y / len };
          }
        }
      }
    }

    // 追踪敌人逻辑
    if (sprite.magic.moveKind === MagicMoveKind.FollowEnemy || sprite.magic.traceEnemy > 0) {
      const shouldTrace =
        sprite.movedDistance > 200 ||
        (sprite.magic.traceEnemy > 0 &&
          sprite.elapsedMilliseconds >= sprite.magic.traceEnemyDelayMilliseconds);

      if (shouldTrace) {
        const closestEnemy = this.charHelper.findClosestEnemy(sprite);
        if (closestEnemy) {
          if (sprite.magic.traceSpeed > 0) {
            sprite.velocity = MAGIC_BASE_SPEED * sprite.magic.traceSpeed;
          }
          const enemyPos = this.charHelper.getCharacterPosition(closestEnemy);
          if (enemyPos) {
            const dir = {
              x: enemyPos.x - sprite.position.x,
              y: enemyPos.y - sprite.position.y,
            };
            const len = vectorLength(dir);
            if (len > 0) {
              sprite.direction = { x: dir.x / len, y: dir.y / len };
            }
          }
        }
      }
    }

    // 移动
    if (sprite.velocity > 0) {
      const moveDistance = sprite.velocity * (deltaMs / 1000);
      sprite.positionInWorld = {
        x: sprite.positionInWorld.x + sprite.direction.x * moveDistance,
        y: sprite.positionInWorld.y + sprite.direction.y * moveDistance,
      };
      sprite.movedDistance += moveDistance;
    }

    // ============= RangeEffect 周期触发 =============
    // Reference: MagicSprite.Update() - if (BelongMagic.RangeEffect > 0 && (_paths == null || _paths.Count <= 2))
    if (sprite.magic.rangeEffect > 0) {
      this.updateRangeEffect(sprite, deltaMs);
    }

    // 检查动画播放结束
    // Reference: MagicSprite.Update() - 动画结束后直接处理，不依赖 velocity
    if (!sprite.isInPlaying) {
      if (sprite.isSuperMode || sprite.magic.moveKind === MagicMoveKind.SuperMode) {
        this.startDestroyAnimation(sprite);
        return;
      }
      this.handleSpriteLifeEnd(sprite);
      return;
    }

    // 碰撞检测
    let checkHit = true;
    switch (sprite.magic.moveKind) {
      case 13:
      case 20:
      case 21:
      case 22:
      case 23:
        checkHit = false;
        break;
      default:
        if (this.collision.checkCollision(sprite)) return;
        break;
    }

    if (checkHit && this.collision.checkMapObstacle(sprite)) return;
  }

  /**
   * 处理精灵生命结束
   */
  private handleSpriteLifeEnd(sprite: MagicSprite): void {
    if (sprite.destroyOnEnd) {
      this.startDestroyAnimation(sprite);
    } else {
      sprite.isDestroyed = true;
    }
  }

  /**
   * 开始销毁动画
   */
  startDestroyAnimation(sprite: MagicSprite): void {
    if (sprite.isInDestroy) return;
    sprite.isInDestroy = true;

    // SuperMode 全屏攻击
    if (sprite.isSuperMode || sprite.magic.moveKind === MagicMoveKind.SuperMode) {
      sprite.flyingAsfPath = undefined;
      this.applySuperModeToAllEnemies(sprite);
      if (sprite.superModeDestroySprites.length === 0) {
        sprite.isDestroyed = true;
      }
      return;
    }

    // 普通武功销毁
    const hasValidVanishImage = sprite.magic.vanishImage && !sprite.magic.vanishImage.endsWith("/");

    if (hasValidVanishImage) {
      sprite.vanishAsfPath = sprite.magic.vanishImage;
      sprite.currentFrameIndex = 0;
      sprite.frameElapsed = 0;
      sprite.velocity = 0;
      sprite.frameInterval = 50;
      sprite.playFrames(20);
    } else {
      sprite.isDestroyed = true;
    }

    if (sprite.magic.vanishSound) {
      this.callbacks.playSound(sprite.magic.vanishSound);
    }

    this.callbacks.triggerExplodeMagic(sprite);
  }

  /**
   * SuperMode 全屏攻击
   */
  private applySuperModeToAllEnemies(sprite: MagicSprite): void {
    const effect = getEffect(sprite.magic.moveKind);
    const targets = this.charHelper.getEnemiesInView(sprite.belongCharacterId, sprite.magic);

    sprite.superModeDestroySprites = [];

    for (const targetId of targets) {
      const targetRef = this.charHelper.getCharacterRef(targetId);
      if (targetRef) {
        const targetChar = this.charHelper.getCharacterFromRef(targetRef);
        if (targetChar.isDeath || targetChar.isDeathInvoked) continue;

        const targetPos = getCharPosition(targetRef);

        if (sprite.magic.vanishImage && !sprite.magic.vanishImage.endsWith("/")) {
          const effectSprite = sprite.createEffectSprite(targetPos);
          effectSprite.vanishAsfPath = sprite.magic.vanishImage;
          effectSprite.flyingAsfPath = sprite.magic.vanishImage;
          sprite.superModeDestroySprites.push(effectSprite);
        }

        const belongCharacter = this.charHelper.getBelongCharacter(sprite.belongCharacterId);
        if (belongCharacter) {
          targetChar.notifyFighterAndAllNeighbor(belongCharacter);
        }

        if (effect?.apply) {
          const applyCtx = this.callbacks.createApplyContext(sprite, targetRef);
          if (applyCtx) {
            effect.apply(applyCtx);
          }
        }

        this.callbacks.triggerExplodeMagic(sprite, targetPos);
      }
    }

    if (sprite.magic.vanishSound && targets.length > 0) {
      this.callbacks.playSound(sprite.magic.vanishSound);
    }

    if (sprite.magic.vibratingScreen > 0) {
      this.callbacks.vibrateScreen(sprite.magic.vibratingScreen);
    }
  }

  /**
   * 更新 SuperMode 的特效精灵列表
   */
  private updateSuperModeDestroySprites(sprite: MagicSprite, deltaMs: number): void {
    for (const effectSprite of sprite.superModeDestroySprites) {
      effectSprite.elapsedMilliseconds += deltaMs;
      effectSprite.frameElapsed += deltaMs;

      const effectiveInterval = effectSprite.frameInterval > 0 ? effectSprite.frameInterval : 50;
      if (effectSprite.frameElapsed >= effectiveInterval) {
        effectSprite.currentFrameIndex++;
        if (effectSprite.leftFrameToPlay > 0) {
          effectSprite.leftFrameToPlay--;
        }
        effectSprite.frameElapsed -= effectiveInterval;
      }
    }
  }

  /**
   * 更新寄生角色逻辑
   * - if (_parasitiferCharacter != null)
   * 寄生效果：武功附着在目标身上，持续跟随并定期造成伤害
   */
  private updateParasiticCharacter(sprite: MagicSprite, deltaMs: number): void {
    const targetId = sprite.parasitiferCharacterId;
    if (!targetId) return;

    const targetChar = this.charHelper.getBelongCharacter(targetId);
    if (!targetChar) {
      // 目标不存在，销毁精灵
      sprite.clearParasitiferCharacter();
      sprite.isDestroyed = true;
      return;
    }

    // 跟随目标位置
    const targetPos = this.charHelper.getCharacterPosition(targetId);
    if (targetPos) {
      sprite.positionInWorld = { x: targetPos.x, y: targetPos.y };
    }

    // 检查目标是否死亡
    if (targetChar.isDeathInvoked || targetChar.isDeath) {
      sprite.clearParasitiferCharacter();
      sprite.isDestroyed = true;
      logger.log(`[SpriteUpdater] Parasitic: target ${targetChar.name} died, destroying sprite`);
      return;
    }

    // 定期造成伤害
    sprite.parasiticTime += deltaMs;
    const interval = sprite.magic.parasiticInterval > 0 ? sprite.magic.parasiticInterval : 1000;

    if (sprite.parasiticTime >= interval) {
      sprite.parasiticTime -= interval;

      // 使用寄生武功（如果有）
      if (sprite.magic.parasiticMagic) {
        this.triggerParasiticMagic(sprite, targetId);
      }

      // 造成伤害
      this.applyParasiticDamage(sprite, targetId);

      // 检查是否达到最大伤害
      if (
        sprite.magic.parasiticMaxEffect > 0 &&
        sprite.totalParasiticEffect >= sprite.magic.parasiticMaxEffect
      ) {
        sprite.clearParasitiferCharacter();
        sprite.isDestroyed = true;
        logger.log(
          `[SpriteUpdater] Parasitic: max effect ${sprite.magic.parasiticMaxEffect} reached, destroying sprite`
        );
      }
    }
  }

  /**
   * 触发寄生武功
   * 战斗中同步获取缓存
   */
  private triggerParasiticMagic(sprite: MagicSprite, targetId: string): void {
    const magicName = sprite.magic.parasiticMagic;
    if (!magicName) return;

    const targetPos = this.charHelper.getCharacterPosition(targetId);
    if (!targetPos) return;

    const magic = resolveMagic(magicName);
    if (!magic) return;

    this.callbacks.useMagic({
      userId: sprite.belongCharacterId,
      magic,
      origin: targetPos,
      destination: targetPos,
      targetId,
    });
  }

  /**
   * 造成寄生伤害
   * Reference: CharacterHited(_parasitiferCharacter, GetEffectAmount, ...)
   * 注意：中 _totalParasticEffect 累加的是原始 damage（GetEffectAmount），不是最终伤害
   */
  private applyParasiticDamage(sprite: MagicSprite, targetId: string): void {
    const targetRef = this.charHelper.getCharacterRef(targetId);
    if (!targetRef) return;

    // _totalParasticEffect += damage (原始 effectAmount)
    // 累加原始伤害值（effect amount），而非扣除防御后的最终伤害
    const rawDamage = sprite.currentEffect;
    sprite.addParasiticEffect(rawDamage);

    const applyCtx = this.callbacks.createApplyContext(sprite, targetRef);
    if (applyCtx) {
      const effect = getEffect(sprite.magic.moveKind);
      if (effect?.apply) {
        const actualDamage = effect.apply(applyCtx) ?? 0;
        logger.log(
          `[SpriteUpdater] Parasitic damage: raw=${rawDamage}, actual=${actualDamage}, total=${sprite.totalParasiticEffect}`
        );
      }
    }
  }

  /**
   * 处理精灵结束
   */
  private handleSpriteEnd(sprite: MagicSprite): void {
    // 清理粘附角色
    // 销毁时 _stickedCharacter.MovedByMagicSprite = null
    if (sprite.stickedCharacterId !== null) {
      const stickedChar = this.charHelper.getBelongCharacter(sprite.stickedCharacterId);
      if (stickedChar && stickedChar.movedByMagicSprite === sprite) {
        stickedChar.movedByMagicSprite = null;
      }
      sprite.clearStickedCharacter();
    }

    const effect = getEffect(sprite.magic.moveKind);
    if (effect?.onEnd) {
      const endCtx = this.callbacks.createEndContext(sprite);
      if (endCtx) {
        effect.onEnd(endCtx);
      }
    }

    this.handleSpecialMoveKindEnd(sprite);
  }

  /**
   * 处理特殊 MoveKind 的结束逻辑
   */
  private handleSpecialMoveKindEnd(sprite: MagicSprite): void {
    const belongCharacter = this.charHelper.getBelongCharacter(sprite.belongCharacterId);

    switch (sprite.magic.moveKind) {
      case MagicMoveKind.Transport:
        if (belongCharacter) {
          belongCharacter.isInTransport = false;

          const destination = sprite.destination;
          let targetTile = pixelToTile(destination.x, destination.y);

          const map = this.engine.map;
          if (!map.isTileWalkable(targetTile)) {
            const neighbors = [
              { x: targetTile.x - 1, y: targetTile.y },
              { x: targetTile.x + 1, y: targetTile.y },
              { x: targetTile.x, y: targetTile.y - 1 },
              { x: targetTile.x, y: targetTile.y + 1 },
              { x: targetTile.x - 1, y: targetTile.y - 1 },
              { x: targetTile.x + 1, y: targetTile.y - 1 },
              { x: targetTile.x - 1, y: targetTile.y + 1 },
              { x: targetTile.x + 1, y: targetTile.y + 1 },
            ];
            const validNeighbor = neighbors.find((n) => map.isTileWalkable(n));
            if (validNeighbor) {
              targetTile = validNeighbor;
            } else {
              logger.warn(
                `[SpriteUpdater] Transport: no walkable tile near destination, aborting transport`
              );
              return;
            }
          }

          belongCharacter.setTilePosition(targetTile.x, targetTile.y);
          logger.log(
            `[SpriteUpdater] Transport completed: ${sprite.belongCharacterId} -> ` +
              `tile (${targetTile.x}, ${targetTile.y})`
          );
        }
        break;

      case MagicMoveKind.PlayerControl:
        if (sprite.belongCharacterId === "player") {
          this.player.endControlCharacter();
          logger.log(`[SpriteUpdater] ControlCharacter ended`);
        }
        break;
    }
  }

  /**
   * 更新 Kind19 持续留痕武功
   */
  private updateKind19Magics(deltaMs: number): void {
    const toRemove: number[] = [];

    for (let i = 0; i < this.state.kind19Magics.length; i++) {
      const info = this.state.kind19Magics[i];

      const belongCharacter = this.charHelper.getBelongCharacter(info.belongCharacterId);
      if (!belongCharacter) {
        toRemove.push(i);
        continue;
      }

      const currentTile = belongCharacter.tilePosition;
      if (info.lastTilePosition.x !== currentTile.x || info.lastTilePosition.y !== currentTile.y) {
        const pixelPos = tileToPixel(info.lastTilePosition.x, info.lastTilePosition.y);
        this.callbacks.addFixedPositionMagicSprite(
          info.belongCharacterId,
          info.magic,
          pixelPos,
          true
        );

        info.lastTilePosition = { ...currentTile };
      }

      info.keepMilliseconds -= deltaMs;

      if (info.keepMilliseconds <= 0) {
        toRemove.push(i);
        logger.log(
          `[SpriteUpdater] Kind19 magic ended: ${info.magic.name}, ` +
            `belongCharacter=${info.belongCharacterId}`
        );
      }
    }

    for (let i = toRemove.length - 1; i >= 0; i--) {
      this.state.kind19Magics.splice(toRemove[i], 1);
    }
  }

  /**
   * 更新按行分组的精灵缓存
   */
  private updateSpritesByRow(): void {
    this.state.magicSpritesByRow.clear();
    this.state.effectSpritesByRow.clear();

    for (const sprite of this.state.magicSprites.values()) {
      const row = sprite.tilePosition.y;
      let list = this.state.magicSpritesByRow.get(row);
      if (!list) {
        list = [];
        this.state.magicSpritesByRow.set(row, list);
      }
      list.push(sprite);
    }

    for (const sprite of this.state.effectSprites.values()) {
      const row = sprite.tilePosition.y;
      let list = this.state.effectSpritesByRow.get(row);
      if (!list) {
        list = [];
        this.state.effectSpritesByRow.set(row, list);
      }
      list.push(sprite);
    }
  }

  /**
   * 创建命中特效
   */
  createHitEffect(sprite: MagicSprite): void {
    if (!sprite.magic.vanishImage) return;

    const effectSprite = sprite.createEffectSprite();
    this.callbacks.addEffectSprite(effectSprite);
    this.callbacks.triggerExplodeMagic(sprite);
  }

  /**
   * 触发跳跃结束武功
   * 战斗中同步获取缓存
   */
  triggerJumpEndMagic(
    magicFile: string,
    character: { positionInWorld: Vector2 },
    userId: string
  ): void {
    const magic = resolveMagic(magicFile, 1);
    if (!magic) return;

    this.callbacks.useMagic({
      magic,
      origin: character.positionInWorld,
      destination: character.positionInWorld,
      userId,
    });
  }

  /**
   * 更新范围效果
   * - RangeEffect 部分
   *
   * 周期性在范围内对友军施加增益或对敌人施加减益
   */
  private updateRangeEffect(sprite: MagicSprite, deltaMs: number): void {
    const magic = sprite.magic;

    // 累计时间
    sprite.rangeElapsedMilliseconds += deltaMs;

    // 检查是否达到触发间隔
    if (sprite.rangeElapsedMilliseconds < magic.rangeTimeInterval) {
      return;
    }

    // 重置计时器
    sprite.rangeElapsedMilliseconds -= magic.rangeTimeInterval;

    const belongCharacter = this.charHelper.getBelongCharacter(sprite.belongCharacterId);
    if (!belongCharacter) return;

    const tilePos = sprite.tilePosition;
    const radius = magic.rangeRadius;

    // ============= 友军增益效果 =============
    // RangeAddLife, RangeAddMana, RangeAddThew, RangeSpeedUp
    if (
      magic.rangeAddLife > 0 ||
      magic.rangeAddMana > 0 ||
      magic.rangeAddThew > 0 ||
      magic.rangeSpeedUp > 0
    ) {
      const friends = this.findFriendsInTileDistance(belongCharacter, tilePos, radius);
      for (const friend of friends) {
        if (magic.rangeAddLife > 0) {
          friend.addLife(magic.rangeAddLife);
        }
        if (magic.rangeAddMana > 0) {
          friend.addMana(magic.rangeAddMana);
        }
        if (magic.rangeAddThew > 0) {
          friend.addThew(magic.rangeAddThew);
        }
        // if (BelongMagic.RangeSpeedUp > 0 && target.SppedUpByMagicSprite == null)
        if (magic.rangeSpeedUp > 0 && friend.statusEffects.speedUpByMagicSprite === null) {
          friend.statusEffects.speedUpByMagicSprite = sprite;
        }
      }
    }

    // ============= 敌人减益效果 =============
    // RangeFreeze, RangePoison, RangePetrify, RangeDamage
    if (
      magic.rangeFreeze > 0 ||
      magic.rangePoison > 0 ||
      magic.rangePetrify > 0 ||
      magic.rangeDamage > 0
    ) {
      let enemies: Character[];
      if (magic.attackAll > 0) {
        // targets = NpcManager.FindFightersInTileDistance(TilePosition, BelongMagic.RangeRadius);
        enemies = this.findFightersInTileDistance(tilePos, radius);
      } else {
        // targets = NpcManager.FindEnemiesInTileDistance(BelongCharacter, TilePosition, RangeRadius);
        enemies = this.findEnemiesInTileDistance(belongCharacter, tilePos, radius);
      }

      for (const enemy of enemies) {
        if (magic.rangeFreeze > 0) {
          applyStatusEffect(
            1,
            enemy,
            magic.rangeFreeze / 1000,
            magic.noSpecialKindEffect === 0,
            belongCharacter
          );
        }

        if (magic.rangePoison > 0) {
          applyStatusEffect(
            2,
            enemy,
            magic.rangePoison / 1000,
            magic.noSpecialKindEffect === 0,
            belongCharacter
          );
        }

        if (magic.rangePetrify > 0) {
          applyStatusEffect(
            3,
            enemy,
            magic.rangePetrify / 1000,
            magic.noSpecialKindEffect === 0,
            belongCharacter
          );
        }

        // if (BelongMagic.RangeDamage > 0) { CharacterHited(...); AddDestroySprite(...); }
        if (magic.rangeDamage > 0) {
          // 使用简化的伤害计算
          const damage = Math.max(magic.rangeDamage - enemy.realDefend, MINIMAL_DAMAGE);
          enemy.takeDamage(damage, belongCharacter);

          // 播放特效
          this.callbacks.triggerExplodeMagic(sprite, enemy.pixelPosition);
        }
      }
    }
  }

  /**
   * 查找范围内的友军 — 委托给 NpcManager
   */
  private findFriendsInTileDistance(
    finder: Character,
    centerTile: Vector2,
    tileDistance: number
  ): Character[] {
    const npcManager = this.engine.npcManager as NpcManager;
    return npcManager.findFriendsInTileDistance(finder, centerTile, tileDistance);
  }

  /**
   * 查找范围内的敌人 — 委托给 NpcManager
   */
  private findEnemiesInTileDistance(
    finder: Character,
    centerTile: Vector2,
    tileDistance: number
  ): Character[] {
    const npcManager = this.engine.npcManager as NpcManager;
    return npcManager.findEnemiesInTileDistance(finder, centerTile, tileDistance);
  }

  /**
   * 查找范围内的所有战斗单位 — 委托给 NpcManager
   */
  private findFightersInTileDistance(centerTile: Vector2, tileDistance: number): Character[] {
    const npcManager = this.engine.npcManager as NpcManager;
    return npcManager.findFightersInTileDistance(centerTile, tileDistance);
  }
}
