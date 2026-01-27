/**
 * MagicManager - based on JxqyHD Engine/MagicManager.cs
 * 管理武功精灵的创建、更新和渲染
 *
 * C# 架构对应：
 * - MagicManager 是静态类，管理所有武功精灵
 * - Add*MagicSprite 方法创建不同 MoveKind 的武功
 * - MagicSprite 类继承自 Sprite
 *
 * 使用效果系统处理武功的生命周期：
 * - onCast: 释放时
 * - apply: 作用时
 * - onEnd: 结束时
 */

import type { Vector2 } from "../core/types";
import type { MagicData, UseMagicParams } from "./types";
import { MagicMoveKind, MagicSpecialKind } from "./types";
import { pixelToTile } from "../core/utils";
import {
  getDirectionIndex,
  getSpeedRatio,
  getDirection8,
  getDirection32List,
  getVOffsets,
  getDirectionOffset8,
  normalizeVector,
  MAGIC_BASE_SPEED,
} from "./magicUtils";
import { MagicSprite, resetMagicSpriteIdCounter, type WorkItem } from "./magicSprite";
import type { Player } from "../character/player";
import type { NpcManager } from "../character/npcManager";
import type { Npc } from "../character/npc";
import type { GuiManager } from "../gui/guiManager";
import type { ScreenEffects } from "../effects";
import type { AudioManager } from "../audio";

// 效果系统
import {
  getEffect,
  type MagicEffect,
  type CastContext,
  type ApplyContext,
  type EndContext,
  type CharacterRef,
  getPosition as getCharPosition,
  getCharacterId,
  calculateDamage,
} from "./effects";

/**
 * MagicManager 构造函数参数
 */
export interface MagicManagerDeps {
  player: Player;
  npcManager: NpcManager;
  guiManager: GuiManager;
  screenEffects: ScreenEffects;
  audioManager: AudioManager;
  /** 地图障碍物检测函数，由 GameManager 在地图加载后设置 */
  isMapObstacle?: (tileX: number, tileY: number) => boolean;
}

/**
 * 武功管理器
 */
export class MagicManager {
  // 活动的武功精灵
  private magicSprites: Map<number, MagicSprite> = new Map();
  // 工作队列（延迟添加的武功）
  private workList: WorkItem[] = [];
  // 特效精灵
  private effectSprites: Map<number, MagicSprite> = new Map();
  // 最大武功数量（性能限制）
  private maxMagicUnit: number = 100;
  // 精灵索引
  private spriteIndex: number = 0;

  // SuperMode 状态
  private _isInSuperMagicMode: boolean = false;
  private _superModeMagicSprite: MagicSprite | null = null;

  // 直接注入的依赖
  private player: Player;
  private npcManager: NpcManager;
  private guiManager: GuiManager;
  private screenEffects: ScreenEffects;
  private audioManager: AudioManager;

  // 地图障碍物检测（延迟设置）
  private isMapObstacle: ((tileX: number, tileY: number) => boolean) | null = null;

  // 精灵销毁事件监听器
  private onSpriteDestroyedListeners: ((sprite: MagicSprite) => void)[] = [];

  constructor(deps: MagicManagerDeps) {
    this.player = deps.player;
    this.npcManager = deps.npcManager;
    this.guiManager = deps.guiManager;
    this.screenEffects = deps.screenEffects;
    this.audioManager = deps.audioManager;
    if (deps.isMapObstacle) {
      this.isMapObstacle = deps.isMapObstacle;
    }
  }

  /**
   * 设置地图障碍物检测函数（地图加载后调用）
   */
  setMapObstacleChecker(checker: (tileX: number, tileY: number) => boolean): void {
    this.isMapObstacle = checker;
  }

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
    this.maxMagicUnit = max;
  }

  /**
   * 获取所有活动的武功精灵（用于渲染）
   */
  getMagicSprites(): Map<number, MagicSprite> {
    return this.magicSprites;
  }

  /**
   * 获取特效精灵
   */
  getEffectSprites(): Map<number, MagicSprite> {
    return this.effectSprites;
  }

  /**
   * 是否处于 SuperMode
   */
  get isInSuperMagicMode(): boolean {
    return this._isInSuperMagicMode;
  }

  /**
   * 获取 SuperMode 精灵
   */
  get superModeMagicSprite(): MagicSprite | null {
    return this._superModeMagicSprite;
  }

  /**
   * 清除所有武功
   */
  clear(): void {
    this.magicSprites.clear();
    this.workList = [];
    this.effectSprites.clear();
    resetMagicSpriteIdCounter();
    this.spriteIndex = 0;
    this._isInSuperMagicMode = false;
    this._superModeMagicSprite = null;
  }

  // ========== 角色引用辅助方法 ==========

  /**
   * 根据 ID 获取角色引用
   */
  private getCharacterRef(characterId: string): CharacterRef | null {
    if (characterId === "player") {
      return { type: "player", player: this.player };
    }
    const npc = this.npcManager.getNpc(characterId);
    if (npc) {
      return { type: "npc", npc, id: characterId };
    }
    return null;
  }

  /**
   * 获取角色位置
   */
  private getCharacterPosition(characterId: string): Vector2 | null {
    const ref = this.getCharacterRef(characterId);
    return ref ? getCharPosition(ref) : null;
  }

  /**
   * 判断是否为敌人
   */
  private isEnemy(characterId: string, otherId: string): boolean {
    return characterId !== otherId && otherId !== "player";
  }

  /**
   * 获取附近的敌人
   */
  private getNearbyEnemies(position: Vector2, radius: number, userId: string): string[] {
    const enemies: string[] = [];
    const npcs = this.npcManager.getAllNpcs();

    for (const [id, npc] of npcs) {
      if (!npc.isEnemy || id === userId) continue;

      const npcPos = npc.pixelPosition;
      const dx = npcPos.x - position.x;
      const dy = npcPos.y - position.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist <= radius) {
        enemies.push(id);
      }
    }
    return enemies;
  }

  /**
   * 获取视野内的敌人（用于 SuperMode）
   */
  private getEnemiesInView(_userId: string): string[] {
    const enemies: string[] = [];
    const npcs = this.npcManager.getAllNpcs();

    for (const [id, npc] of npcs) {
      if (npc.isEnemy) {
        enemies.push(id);
      }
    }
    return enemies;
  }

  // ========== 效果系统上下文创建 ==========

  /**
   * 创建释放上下文
   */
  private createCastContext(
    userId: string,
    params: UseMagicParams,
    target?: CharacterRef
  ): CastContext | null {
    const caster = this.getCharacterRef(userId);
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
    };
  }

  /**
   * 创建作用上下文
   */
  private createApplyContext(
    sprite: MagicSprite,
    targetRef: CharacterRef
  ): ApplyContext | null {
    const caster = this.getCharacterRef(sprite.belongCharacterId);
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

  /**
   * 创建结束上下文
   */
  private createEndContext(sprite: MagicSprite): EndContext | null {
    const caster = this.getCharacterRef(sprite.belongCharacterId);
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

  // ========== 特效方法 ==========

  private vibrateScreen(intensity: number): void {
    console.log(`[Magic] Screen vibrate intensity ${intensity}`);
    // TODO: this.screenEffects.shake(intensity);
  }

  private playSound(soundPath: string): void {
    if (soundPath && this.audioManager) {
      this.audioManager.playSound(soundPath);
    }
  }

  // ========== 武功使用 ==========

  useMagic(params: UseMagicParams): void {
    const { userId, magic, origin, destination, targetId } = params;

    console.log(`[MagicManager] Using magic: ${magic.name}, moveKind: ${magic.moveKind}`);

    // 获取效果定义
    const effect = getEffect(magic.moveKind);

    // 获取目标引用（如果有）
    const targetRef = targetId ? this.getCharacterRef(targetId) : undefined;

    // 调用 onCast
    if (effect?.onCast) {
      const castCtx = this.createCastContext(userId, params, targetRef ?? undefined);
      if (castCtx) {
        effect.onCast(castCtx);
      }
    }

    const dir = { x: destination.x - origin.x, y: destination.y - origin.y };
    const dirIndex = getDirectionIndex(dir, 8);
    console.log(`[MagicManager] Direction: (${dir.x.toFixed(0)}, ${dir.y.toFixed(0)}), index: ${dirIndex}`);

    // 创建精灵
    let sprite: MagicSprite | undefined;

    switch (magic.moveKind) {
      case MagicMoveKind.NoMove:
        break;

      case MagicMoveKind.FixedPosition:
        this.addFixedPositionMagicSprite(userId, magic, destination, true);
        break;

      case MagicMoveKind.SingleMove:
        this.addSingleMoveMagicSprite(userId, magic, origin, destination, false);
        break;

      case MagicMoveKind.LineMove:
        this.addLineMoveMagicSprite(userId, magic, origin, destination, false);
        break;

      case MagicMoveKind.CircleMove:
        this.addCircleMoveMagicSprite(userId, magic, origin, false);
        break;

      case MagicMoveKind.HeartMove:
        // TODO: 实现心形移动
        console.warn('[MagicManager] HeartMove not implemented, using CircleMove');
        this.addCircleMoveMagicSprite(userId, magic, origin, false);
        break;

      case MagicMoveKind.SpiralMove:
        // TODO: 实现螺旋移动
        console.warn('[MagicManager] SpiralMove not implemented, using SingleMove');
        this.addSingleMoveMagicSprite(userId, magic, origin, destination, false);
        break;

      case MagicMoveKind.SectorMove:
        this.addSectorMoveMagicSprite(userId, magic, origin, destination, false);
        break;

      case MagicMoveKind.RandomSector:
        // TODO: 实现随机扇形
        console.warn('[MagicManager] RandomSector not implemented, using SectorMove');
        this.addSectorMoveMagicSprite(userId, magic, origin, destination, false);
        break;

      case MagicMoveKind.FixedWall:
        this.addFixedWallMagicSprite(userId, magic, origin, destination, true);
        break;

      case MagicMoveKind.WallMove:
        // TODO: 实现墙移动
        console.warn('[MagicManager] WallMove not implemented, using FixedWall');
        this.addFixedWallMagicSprite(userId, magic, origin, destination, true);
        break;

      case MagicMoveKind.FollowCharacter:
      case MagicMoveKind.TimeStop:
        {
          sprite = this.addFollowCharacterMagicSprite(userId, magic, origin, true);
          // FollowCharacter 的 apply 在创建时立即调用（作用于自己）
          if (sprite && effect?.apply) {
            const caster = this.getCharacterRef(userId);
            if (caster) {
              const applyCtx = this.createApplyContext(sprite, caster);
              if (applyCtx) {
                effect.apply(applyCtx);
              }
            }
          }
        }
        break;

      case MagicMoveKind.SuperMode:
        {
          sprite = this.addSuperModeMagicSprite(userId, magic, origin, true);
          if (sprite) {
            this._isInSuperMagicMode = true;
            this._superModeMagicSprite = sprite;
            console.log(`[MagicManager] SuperMode activated: ${magic.name}`);
          }
        }
        break;

      case MagicMoveKind.FollowEnemy:
        this.addFollowEnemyMagicSprite(userId, magic, origin, destination, false);
        break;

      case MagicMoveKind.Throw:
        this.addThrowMagicSprite(userId, magic, origin, destination, true);
        break;

      case MagicMoveKind.FixedAtDestination:
        this.addFixedPositionMagicSprite(userId, magic, destination, true);
        break;

      case MagicMoveKind.VMove:
        this.addVMoveMagicSprite(userId, magic, origin, destination, false);
        break;

      default:
        console.warn(`[MagicManager] Unknown MoveKind: ${magic.moveKind}, using SingleMove`);
        this.addSingleMoveMagicSprite(userId, magic, origin, destination, false);
        break;
    }

    if (magic.flyingSound) {
      this.playSound(magic.flyingSound);
    }

    if (magic.vibratingScreen > 0) {
      this.vibrateScreen(magic.vibratingScreen);
    }
  }

  private addMagicSprite(sprite: MagicSprite): void {
    if (this.maxMagicUnit > 0 && this.magicSprites.size >= this.maxMagicUnit) {
      const skipKinds = [
        MagicMoveKind.FollowCharacter,
        MagicMoveKind.Transport,
        MagicMoveKind.PlayerControl,
        MagicMoveKind.TimeStop,
      ];
      if (!skipKinds.includes(sprite.magic.moveKind)) {
        return;
      }
    }
    this.magicSprites.set(sprite.id, sprite);
  }

  private addWorkItem(delayMs: number, sprite: MagicSprite): void {
    if (delayMs < 1) {
      this.addMagicSprite(sprite);
    } else {
      this.workList.push({
        leftMilliseconds: delayMs,
        sprite,
        spriteIndex: sprite.id,
      });
    }
  }

  // ========== 武功精灵创建方法 ==========
  // C# Reference: MagicManager.Add*MagicSprite methods

  /**
   * 添加固定位置武功精灵
   * C# Reference: MagicManager.AddFixedPositionMagicSprite
   */
  private addFixedPositionMagicSprite(
    userId: string,
    magic: MagicData,
    position: Vector2,
    destroyOnEnd: boolean
  ): void {
    const sprite = MagicSprite.createFixed(userId, magic, position, destroyOnEnd);
    this.addMagicSprite(sprite);
  }

  /**
   * 添加单体移动武功（自由方向）
   * C# Reference: MagicManager.GetMoveMagicSprite - uses destination - origin as direction
   */
  private addSingleMoveMagicSprite(
    userId: string,
    magic: MagicData,
    origin: Vector2,
    destination: Vector2,
    destroyOnEnd: boolean
  ): void {
    const direction = { x: destination.x - origin.x, y: destination.y - origin.y };
    const normalizedDir = normalizeVector(direction);
    const speedRatio = getSpeedRatio(normalizedDir);
    const sprite = MagicSprite.createMoving(userId, magic, origin, destination, destroyOnEnd, speedRatio);
    this.addMagicSprite(sprite);
  }

  /**
   * 添加直线移动武功
   * C# Reference: MagicManager.AddLineMoveMagicSprite
   */
  private addLineMoveMagicSprite(
    userId: string,
    magic: MagicData,
    origin: Vector2,
    destination: Vector2,
    destroyOnEnd: boolean
  ): void {
    const direction = { x: destination.x - origin.x, y: destination.y - origin.y };
    const speedRatio = getSpeedRatio(normalizeVector(direction));
    const level = magic.effectLevel < 1 ? 1 : magic.effectLevel;
    const magicDelayMs = 60;

    for (let i = 0; i < level; i++) {
      const sprite = MagicSprite.createMoving(userId, magic, origin, destination, destroyOnEnd, speedRatio);
      this.addWorkItem(magicDelayMs * i, sprite);
    }
  }

  /**
   * 添加V字移动武功
   * C# Reference: MagicManager.AddVMoveMagicSprite
   */
  private addVMoveMagicSprite(
    userId: string,
    magic: MagicData,
    origin: Vector2,
    destination: Vector2,
    destroyOnEnd: boolean
  ): void {
    const direction = normalizeVector({
      x: destination.x - origin.x,
      y: destination.y - origin.y,
    });
    const directionIndex = getDirectionIndex(direction, 8);
    const dir = getDirection8(directionIndex);
    const speedRatio = getSpeedRatio(dir);
    const level = magic.effectLevel < 1 ? 1 : magic.effectLevel;

    // 中心武功
    const centerSprite = MagicSprite.createMovingOnDirection(userId, magic, origin, dir, destroyOnEnd, speedRatio);
    this.addMagicSprite(centerSprite);

    // 两侧武功
    const offsets = getVOffsets(directionIndex);
    for (let i = 1; i <= level; i++) {
      for (const offset of offsets) {
        const offsetPos = {
          x: origin.x + offset.x * i,
          y: origin.y + offset.y * i,
        };
        const sprite = MagicSprite.createMovingOnDirection(userId, magic, offsetPos, dir, destroyOnEnd, speedRatio);
        this.addMagicSprite(sprite);
      }
    }
  }

  /**
   * 添加圆形移动武功
   * C# Reference: MagicManager.AddCircleMoveMagicSprite
   */
  private addCircleMoveMagicSprite(
    userId: string,
    magic: MagicData,
    origin: Vector2,
    destroyOnEnd: boolean
  ): void {
    const directions = getDirection32List();
    for (const dir of directions) {
      const speedRatio = getSpeedRatio(dir);
      const sprite = MagicSprite.createMovingOnDirection(userId, magic, origin, dir, destroyOnEnd, speedRatio);
      this.addMagicSprite(sprite);
    }
  }

  /**
   * 添加扇形移动武功
   * C# Reference: MagicManager.AddSectorMoveMagicSprite
   */
  private addSectorMoveMagicSprite(
    userId: string,
    magic: MagicData,
    origin: Vector2,
    destination: Vector2,
    destroyOnEnd: boolean
  ): void {
    const direction = { x: destination.x - origin.x, y: destination.y - origin.y };
    const directionIndex = getDirectionIndex(direction, 8);
    const dir32Index = directionIndex * 4; // 8方向转32方向
    const directions = getDirection32List();

    let count = 1;
    if (magic.effectLevel > 0) {
      count += Math.floor((magic.effectLevel - 1) / 3);
    }

    // 中心方向
    const centerDir = directions[dir32Index];
    const centerSprite = MagicSprite.createMovingOnDirection(
      userId,
      magic,
      origin,
      centerDir,
      destroyOnEnd,
      getSpeedRatio(centerDir)
    );
    this.addMagicSprite(centerSprite);

    // 两侧
    for (let i = 1; i <= count; i++) {
      const leftIdx = (dir32Index + i * 2) % 32;
      const rightIdx = (dir32Index + 32 - i * 2) % 32;

      const leftDir = directions[leftIdx];
      const rightDir = directions[rightIdx];

      const leftSprite = MagicSprite.createMovingOnDirection(
        userId,
        magic,
        origin,
        leftDir,
        destroyOnEnd,
        getSpeedRatio(leftDir)
      );
      this.addMagicSprite(leftSprite);

      const rightSprite = MagicSprite.createMovingOnDirection(
        userId,
        magic,
        origin,
        rightDir,
        destroyOnEnd,
        getSpeedRatio(rightDir)
      );
      this.addMagicSprite(rightSprite);
    }
  }

  /**
   * 添加固定墙武功
   * C# Reference: MagicManager.AddFixedWallMagicSprite
   */
  private addFixedWallMagicSprite(
    userId: string,
    magic: MagicData,
    origin: Vector2,
    destination: Vector2,
    destroyOnEnd: boolean
  ): void {
    const direction = { x: destination.x - origin.x, y: destination.y - origin.y };
    const offset = getDirectionOffset8(direction);

    let count = 3;
    if (magic.effectLevel > 1) {
      count += (magic.effectLevel - 1) * 2;
    }
    const halfCount = Math.floor((count - 1) / 2);

    // 中心
    this.addFixedPositionMagicSprite(userId, magic, destination, destroyOnEnd);

    // 两侧
    for (let i = 1; i <= halfCount; i++) {
      const pos1 = { x: destination.x + offset.x * i, y: destination.y + offset.y * i };
      const pos2 = { x: destination.x - offset.x * i, y: destination.y - offset.y * i };
      this.addFixedPositionMagicSprite(userId, magic, pos1, destroyOnEnd);
      this.addFixedPositionMagicSprite(userId, magic, pos2, destroyOnEnd);
    }
  }

  /**
   * 添加跟随角色武功（BUFF类）
   * C# Reference: 类似于 FollowCharacter 类型的创建
   */
  private addFollowCharacterMagicSprite(
    userId: string,
    magic: MagicData,
    origin: Vector2,
    destroyOnEnd: boolean
  ): MagicSprite {
    const sprite = MagicSprite.createFixed(userId, magic, origin, destroyOnEnd);
    this.addMagicSprite(sprite);
    return sprite;
  }

  /**
   * 添加超级模式武功
   * C# Reference: MagicManager - SuperMode magic
   * C# Reference: MagicSprite.Init - case 15: texture = belongMagic.SuperModeImage
   */
  private addSuperModeMagicSprite(
    userId: string,
    magic: MagicData,
    origin: Vector2,
    destroyOnEnd: boolean
  ): MagicSprite {
    const sprite = MagicSprite.createFixed(userId, magic, origin, destroyOnEnd);
    // SuperMode 使用 SuperModeImage 而不是 FlyingImage
    if (magic.superModeImage) {
      sprite.flyingAsfPath = magic.superModeImage;
    }
    this.addMagicSprite(sprite);
    return sprite;
  }

  /**
   * 添加跟随敌人武功（追踪类）
   */
  private addFollowEnemyMagicSprite(
    userId: string,
    magic: MagicData,
    origin: Vector2,
    destination: Vector2,
    destroyOnEnd: boolean
  ): void {
    const sprite = MagicSprite.createMoving(userId, magic, origin, destination, destroyOnEnd);
    this.addMagicSprite(sprite);
  }

  /**
   * 添加投掷武功
   * C# Reference: MagicManager - Throw magic
   */
  private addThrowMagicSprite(
    userId: string,
    magic: MagicData,
    origin: Vector2,
    destination: Vector2,
    destroyOnEnd: boolean
  ): void {
    let count = 1;
    if (magic.effectLevel > 1) {
      count += Math.floor((magic.effectLevel - 1) / 3);
    }

    const columnOffset = { x: -32, y: 16 };
    const rowOffset = { x: 32, y: 16 };
    const halfCount = Math.floor(count / 2);

    let dest = {
      x: destination.x - rowOffset.x * halfCount,
      y: destination.y - rowOffset.y * halfCount,
    };

    for (let r = 0; r < count; r++) {
      let rowDest = {
        x: dest.x - columnOffset.x * halfCount,
        y: dest.y - columnOffset.y * halfCount,
      };
      for (let c = 0; c < count; c++) {
        const sprite = MagicSprite.createMoving(userId, magic, origin, rowDest, destroyOnEnd);
        this.addMagicSprite(sprite);

        rowDest = {
          x: rowDest.x + columnOffset.x,
          y: rowDest.y + columnOffset.y,
        };
      }
      dest = {
        x: dest.x + rowOffset.x,
        y: dest.y + rowOffset.y,
      };
    }
  }

  // ========== 更新循环 ==========

  update(deltaMs: number): void {
    // SuperMode 优先处理
    if (this._isInSuperMagicMode && this._superModeMagicSprite) {
      this.updateSprite(this._superModeMagicSprite, deltaMs);
      if (this._superModeMagicSprite.isDestroyed) {
        console.log(`[MagicManager] SuperMode ended`);
        this.handleSpriteEnd(this._superModeMagicSprite);
        this.magicSprites.delete(this._superModeMagicSprite.id);
        this.emitSpriteDestroyed(this._superModeMagicSprite);
        this._isInSuperMagicMode = false;
        this._superModeMagicSprite = null;
      }
      return;
    }

    // 处理工作队列
    const readyItems: WorkItem[] = [];
    this.workList = this.workList.filter((item) => {
      item.leftMilliseconds -= deltaMs;
      if (item.leftMilliseconds <= 0) {
        readyItems.push(item);
        return false;
      }
      return true;
    });
    for (const item of readyItems) {
      this.addMagicSprite(item.sprite);
    }

    // 更新武功精灵
    const toRemove: number[] = [];
    for (const [id, sprite] of this.magicSprites) {
      this.updateSprite(sprite, deltaMs);
      if (sprite.isDestroyed) {
        toRemove.push(id);
      }
    }
    for (const id of toRemove) {
      const sprite = this.magicSprites.get(id);
      if (sprite) {
        this.handleSpriteEnd(sprite);
        this.emitSpriteDestroyed(sprite);
      }
      this.magicSprites.delete(id);
    }

    // 更新特效精灵
    const effectsToRemove: number[] = [];
    for (const [id, sprite] of this.effectSprites) {
      sprite.elapsedMilliseconds += deltaMs;
      sprite.frameElapsed += deltaMs;

      if (sprite.frameElapsed >= sprite.frameInterval) {
        sprite.currentFrame++;
        sprite.frameElapsed = 0;
      }

      if (sprite.currentFrame >= sprite.framesPerDirection) {
        sprite.isDestroyed = true;
        effectsToRemove.push(id);
      }
    }
    for (const id of effectsToRemove) {
      this.effectSprites.delete(id);
    }
  }

  /**
   * 处理精灵结束（调用 onEnd）
   */
  private handleSpriteEnd(sprite: MagicSprite): void {
    const effect = getEffect(sprite.magic.moveKind);
    if (effect?.onEnd) {
      const endCtx = this.createEndContext(sprite);
      if (endCtx) {
        effect.onEnd(endCtx);
      }
    }
  }

  private updateSprite(sprite: MagicSprite, deltaMs: number): void {
    if (sprite.isDestroyed) return;

    if (sprite.waitMilliseconds > 0) {
      sprite.waitMilliseconds -= deltaMs;
      return;
    }

    // 第一次更新时打印调试信息
    if (sprite.playedFrames === 0 && sprite.elapsedMilliseconds === 0) {
      console.log(`[MagicManager] First update: ${sprite.magic.name}, velocity=${sprite.velocity}, direction=(${sprite.direction.x.toFixed(2)}, ${sprite.direction.y.toFixed(2)})`);
    }

    sprite.elapsedMilliseconds += deltaMs;

    // 帧动画更新
    sprite.frameElapsed += deltaMs;
    if (sprite.frameElapsed >= sprite.frameInterval) {
      sprite.currentFrame++;
      sprite.playedFrames++;
      sprite.frameElapsed = 0;

      if (sprite.isInDestroy) {
        if (sprite.currentFrame >= sprite.vanishFramesPerDirection) {
          sprite.isDestroyed = true;
          return;
        }
      } else {
        if (sprite.currentFrame >= sprite.framesPerDirection) {
          sprite.currentFrame = 0;
        }
      }
    }

    if (sprite.isInDestroy) return;

    // 跟随角色移动
    if (sprite.magic.moveKind === MagicMoveKind.FollowCharacter ||
        sprite.magic.moveKind === MagicMoveKind.TimeStop) {
      const pos = this.getCharacterPosition(sprite.belongCharacterId);
      if (pos) {
        // 使用 positionInWorld setter 更新位置（会自动更新 mapX, mapY）
        sprite.positionInWorld = { x: pos.x, y: pos.y };
      }
    }

    // 移动
    if (sprite.velocity > 0) {
      const moveDistance = sprite.velocity * (deltaMs / 1000);
      // 直接更新 positionInWorld（会自动更新 mapX, mapY）
      sprite.positionInWorld = {
        x: sprite.positionInWorld.x + sprite.direction.x * moveDistance,
        y: sprite.positionInWorld.y + sprite.direction.y * moveDistance,
      };
      sprite.movedDistance += moveDistance;
    }

    // 检查动画播放结束
    const isAsfNotLoaded = sprite.magic.lifeFrame === 0 && sprite.framesPerDirection === 4;
    if (!isAsfNotLoaded && sprite.playedFrames >= sprite.totalFrames) {
      console.log(`[MagicManager] Sprite ${sprite.magic.name} life ended: playedFrames=${sprite.playedFrames}, totalFrames=${sprite.totalFrames}, lifeFrame=${sprite.magic.lifeFrame}`);
      this.handleSpriteLifeEnd(sprite);
      return;
    }

    // 地图障碍物碰撞
    if (this.checkMapObstacleInternal(sprite)) return;

    // 敌人碰撞
    this.checkCollisionInternal(sprite);
  }

  private checkMapObstacleInternal(sprite: MagicSprite): boolean {
    if (sprite.magic.passThroughWall > 0) return false;
    if (!this.isMapObstacle) return false;

    if (this.isMapObstacle(sprite.tilePosition.x, sprite.tilePosition.y)) {
      console.log(`[MagicManager] Sprite ${sprite.magic.name} hit map obstacle at (${sprite.tilePosition.x}, ${sprite.tilePosition.y})`);
      this.startDestroyAnimation(sprite);
      return true;
    }
    return false;
  }

  private handleSpriteLifeEnd(sprite: MagicSprite): void {
    console.log(`[MagicManager] handleSpriteLifeEnd: ${sprite.magic.name}, destroyOnEnd=${sprite.destroyOnEnd}`);
    if (sprite.destroyOnEnd) {
      this.startDestroyAnimation(sprite);
    } else {
      sprite.isDestroyed = true;
    }
  }

  private startDestroyAnimation(sprite: MagicSprite): void {
    if (sprite.isInDestroy) return;
    console.log(`[MagicManager] startDestroyAnimation: ${sprite.magic.name}`);
    sprite.isInDestroy = true;

    // SuperMode 全屏攻击 - 对每个敌人调用 apply
    if (sprite.isSuperMode || sprite.magic.moveKind === MagicMoveKind.SuperMode) {
      this.applySuperModeToAllEnemies(sprite);
      sprite.flyingAsfPath = undefined;
      sprite.isDestroyed = true;
      return;
    }

    // 普通武功销毁
    const hasValidVanishImage = sprite.magic.vanishImage &&
      !sprite.magic.vanishImage.endsWith('/');

    if (hasValidVanishImage) {
      sprite.flyingAsfPath = sprite.magic.vanishImage;
      sprite.currentFrame = 0;
      sprite.frameElapsed = 0;
      sprite.velocity = 0;
      sprite.frameInterval = 50;
    } else {
      sprite.isDestroyed = true;
    }

    if (sprite.magic.vanishSound) {
      this.playSound(sprite.magic.vanishSound);
    }
  }

  /**
   * SuperMode 全屏攻击 - 对所有敌人调用 apply
   */
  private applySuperModeToAllEnemies(sprite: MagicSprite): void {
    const effect = getEffect(sprite.magic.moveKind);
    const enemies = this.getEnemiesInView(sprite.belongCharacterId);

    for (const enemyId of enemies) {
      const enemyRef = this.getCharacterRef(enemyId);
      if (enemyRef) {
        // 调用 apply
        if (effect?.apply) {
          const applyCtx = this.createApplyContext(sprite, enemyRef);
          if (applyCtx) {
            effect.apply(applyCtx);
          }
        }

        // 创建特效
        if (sprite.magic.vanishImage) {
          const enemyPos = getCharPosition(enemyRef);
          this.createEffectAtPosition(sprite, enemyPos);
        }
      }
    }

    // 震屏
    if (sprite.magic.vibratingScreen > 0) {
      this.vibrateScreen(sprite.magic.vibratingScreen);
    }
  }

  /**
   * 检查敌人碰撞并调用 apply
   */
  private checkCollisionInternal(sprite: MagicSprite): void {
    if (sprite.isInDestroy) return;

    const enemies = this.getNearbyEnemies(
      sprite.position,
      sprite.magic.bodyRadius || 32,
      sprite.belongCharacterId
    );

    for (const enemyId of enemies) {
      // 穿透检查
      if (sprite.magic.passThrough > 0) {
        if (sprite.passThroughedTargets.includes(enemyId)) {
          continue;
        }
      }

      if (this.isEnemy(sprite.belongCharacterId, enemyId)) {
        console.log(`[MagicManager] Sprite ${sprite.magic.name} hit enemy ${enemyId}`);
        const enemyRef = this.getCharacterRef(enemyId);
        if (enemyRef) {
          // 调用 apply
          const effect = getEffect(sprite.magic.moveKind);
          if (effect?.apply) {
            const applyCtx = this.createApplyContext(sprite, enemyRef);
            if (applyCtx) {
              effect.apply(applyCtx);
            }
          }
        }

        if (sprite.magic.passThrough > 0) {
          sprite.passThroughedTargets.push(enemyId);
          // 创建命中特效但不销毁
          if (sprite.magic.vanishImage) {
            this.createHitEffect(sprite);
          }
        } else {
          // 不穿透，销毁
          this.startDestroyAnimation(sprite);
          return;
        }
      }
    }
  }

  private createHitEffect(sprite: MagicSprite): void {
    if (!sprite.magic.vanishImage) return;

    const effectSprite = sprite.createEffectSprite();
    this.effectSprites.set(effectSprite.id, effectSprite);
  }

  private createEffectAtPosition(sprite: MagicSprite, position: Vector2): void {
    const effectSprite = sprite.createEffectSprite(position);
    this.effectSprites.set(effectSprite.id, effectSprite);
  }

  isObstacle(tile: Vector2): boolean {
    for (const sprite of this.magicSprites.values()) {
      if (sprite.magic.bodyRadius > 0) {
        const spriteTile = pixelToTile(sprite.position.x, sprite.position.y);
        if (spriteTile.x === tile.x && spriteTile.y === tile.y) {
          return true;
        }
      }
    }
    return false;
  }
}
