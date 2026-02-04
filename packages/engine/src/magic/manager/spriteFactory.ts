/**
 * Sprite Factory - 武功精灵创建工厂
 * 从 MagicManager 提取，负责创建各种类型的 MagicSprite
 *
 * Reference: MagicManager.Add*MagicSprite methods
 */

import type { Character } from "../../character/character";
import { getEngineContext } from "../../core/engineContext";
import { logger } from "../../core/logger";
import type { Vector2 } from "../../core/types";
import type { NpcManager } from "../../npc";
import type { Player } from "../../player/player";
import { pixelToTile, tileToPixel } from "../../utils";
import {
  getDirection8,
  getDirection32List,
  getDirectionIndex,
  getDirectionOffset8,
} from "../../utils/direction";
import { getSpeedRatio, normalizeVector } from "../../utils/math";
import { getNeighbors } from "../../utils/neighbors";
import type { CharacterRef } from "../effects";
import { magicRenderer } from "../magicRenderer";
import { MagicSprite } from "../magicSprite";
import type { Kind19MagicInfo, MagicData } from "../types";
import { MagicMoveKind } from "../types";
import type { ICharacterHelper, ISpriteFactoryCallbacks, MagicManagerDeps } from "./types";

/**
 * 武功精灵创建工厂
 */
export class SpriteFactory {
  private player: Player;
  private npcManager: NpcManager;
  private charHelper: ICharacterHelper;
  private callbacks: ISpriteFactoryCallbacks;

  constructor(
    deps: MagicManagerDeps,
    charHelper: ICharacterHelper,
    callbacks: ISpriteFactoryCallbacks
  ) {
    this.player = deps.player;
    this.npcManager = deps.npcManager;
    this.charHelper = charHelper;
    this.callbacks = callbacks;
  }

  // ========== 基础武功精灵创建方法 ==========

  /**
   * 添加固定位置武功精灵
   */
  addFixedPositionMagicSprite(
    userId: string,
    magic: MagicData,
    position: Vector2,
    destroyOnEnd: boolean
  ): MagicSprite {
    const sprite = MagicSprite.createFixed(userId, magic, position, destroyOnEnd);
    this.callbacks.addMagicSprite(sprite);
    return sprite;
  }

  /**
   * 添加单体移动武功（自由方向）
   */
  addSingleMoveMagicSprite(
    userId: string,
    magic: MagicData,
    origin: Vector2,
    destination: Vector2,
    destroyOnEnd: boolean
  ): void {
    const direction = { x: destination.x - origin.x, y: destination.y - origin.y };
    const normalizedDir = normalizeVector(direction);
    const speedRatio = getSpeedRatio(normalizedDir);
    const sprite = MagicSprite.createMoving(
      userId,
      magic,
      origin,
      destination,
      destroyOnEnd,
      speedRatio
    );
    this.callbacks.addMagicSprite(sprite);
  }

  /**
   * 添加直线移动武功
   */
  addLineMoveMagicSprite(
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
      const sprite = MagicSprite.createMoving(
        userId,
        magic,
        origin,
        destination,
        destroyOnEnd,
        speedRatio
      );
      this.callbacks.addWorkItem(magicDelayMs * i, sprite);
    }
  }

  /**
   * 添加V字移动武功
   */
  addVMoveMagicSprite(
    userId: string,
    magic: MagicData,
    origin: Vector2,
    destination: Vector2,
    destroyOnEnd: boolean
  ): void {
    const direction = { x: destination.x - origin.x, y: destination.y - origin.y };
    const directionIndex = getDirectionIndex(direction, 8);
    const dir = getDirection8(directionIndex);
    const speedRatio = getSpeedRatio(dir);
    const level = magic.effectLevel < 1 ? 1 : magic.effectLevel;

    // 中心武功
    const centerSprite = MagicSprite.createMovingOnDirection(
      userId,
      magic,
      origin,
      dir,
      destroyOnEnd,
      speedRatio
    );
    this.callbacks.addMagicSprite(centerSprite);

    // 两侧武功 - 按照switch-case 实现
    for (let i = 1; i <= level; i++) {
      let pos1: Vector2;
      let pos2: Vector2;

      switch (directionIndex) {
        case 0:
          pos1 = { x: origin.x - i * 32, y: origin.y - i * 16 };
          pos2 = { x: origin.x + i * 32, y: origin.y - i * 16 };
          break;
        case 1:
          pos1 = { x: origin.x, y: origin.y - i * 32 };
          pos2 = { x: origin.x + i * 64, y: origin.y };
          break;
        case 2:
          pos1 = { x: origin.x + i * 32, y: origin.y - i * 16 };
          pos2 = { x: origin.x + i * 32, y: origin.y + i * 16 };
          break;
        case 3:
          pos1 = { x: origin.x, y: origin.y + i * 32 };
          pos2 = { x: origin.x + i * 64, y: origin.y };
          break;
        case 4:
          pos1 = { x: origin.x - i * 32, y: origin.y + i * 16 };
          pos2 = { x: origin.x + i * 32, y: origin.y + i * 16 };
          break;
        case 5:
          pos1 = { x: origin.x - i * 64, y: origin.y };
          pos2 = { x: origin.x, y: origin.y + i * 32 };
          break;
        case 6:
          pos1 = { x: origin.x - i * 32, y: origin.y - i * 16 };
          pos2 = { x: origin.x - i * 32, y: origin.y + i * 16 };
          break;
        default:
          pos1 = { x: origin.x, y: origin.y - i * 32 };
          pos2 = { x: origin.x - i * 64, y: origin.y };
          break;
      }

      const sprite1 = MagicSprite.createMovingOnDirection(
        userId,
        magic,
        pos1,
        dir,
        destroyOnEnd,
        speedRatio
      );
      this.callbacks.addMagicSprite(sprite1);

      const sprite2 = MagicSprite.createMovingOnDirection(
        userId,
        magic,
        pos2,
        dir,
        destroyOnEnd,
        speedRatio
      );
      this.callbacks.addMagicSprite(sprite2);
    }
  }

  /**
   * 添加圆形移动武功
   */
  addCircleMoveMagicSprite(
    userId: string,
    magic: MagicData,
    origin: Vector2,
    destroyOnEnd: boolean
  ): void {
    const directions = getDirection32List();
    for (const dir of directions) {
      const speedRatio = getSpeedRatio(dir);
      const sprite = MagicSprite.createMovingOnDirection(
        userId,
        magic,
        origin,
        dir,
        destroyOnEnd,
        speedRatio
      );
      this.callbacks.addMagicSprite(sprite);
    }
  }

  /**
   * 添加扇形移动武功
   */
  addSectorMoveMagicSprite(
    userId: string,
    magic: MagicData,
    origin: Vector2,
    destination: Vector2,
    destroyOnEnd: boolean
  ): void {
    const direction = { x: destination.x - origin.x, y: destination.y - origin.y };
    const directionIndex = getDirectionIndex(direction, 8);
    const dir32Index = directionIndex * 4;
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
    this.callbacks.addMagicSprite(centerSprite);

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
      this.callbacks.addMagicSprite(leftSprite);

      const rightSprite = MagicSprite.createMovingOnDirection(
        userId,
        magic,
        origin,
        rightDir,
        destroyOnEnd,
        getSpeedRatio(rightDir)
      );
      this.callbacks.addMagicSprite(rightSprite);
    }
  }

  /**
   * 添加固定墙武功
   */
  addFixedWallMagicSprite(
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
   * 添加心形移动武功
   */
  addHeartMoveMagicSprite(
    userId: string,
    magic: MagicData,
    origin: Vector2,
    destroyOnEnd: boolean
  ): void {
    const directions = getDirection32List();
    const delayTime = 30;

    // First half - expanding
    for (let i = 0; i < 16; i++) {
      const delay = i * delayTime;
      const dir1 = directions[i];
      const dir2 = directions[31 - i];

      const sprite1 = MagicSprite.createMovingOnDirection(
        userId,
        magic,
        origin,
        dir1,
        destroyOnEnd,
        getSpeedRatio(dir1)
      );
      this.callbacks.addWorkItem(delay, sprite1);

      const sprite2 = MagicSprite.createMovingOnDirection(
        userId,
        magic,
        origin,
        dir2,
        destroyOnEnd,
        getSpeedRatio(dir2)
      );
      this.callbacks.addWorkItem(delay, sprite2);
    }

    // Middle
    const middleDir = directions[16];
    const middleSprite = MagicSprite.createMovingOnDirection(
      userId,
      magic,
      origin,
      middleDir,
      destroyOnEnd,
      getSpeedRatio(middleDir)
    );
    this.callbacks.addWorkItem(16 * delayTime, middleSprite);

    // Second half - contracting
    const secondSprite = MagicSprite.createMovingOnDirection(
      userId,
      magic,
      origin,
      middleDir,
      destroyOnEnd,
      getSpeedRatio(middleDir)
    );
    this.callbacks.addWorkItem(17 * delayTime, secondSprite);

    for (let j = 15; j > 0; j--) {
      const delay = (18 + 15 - j) * delayTime;
      const dir1 = directions[j];
      const dir2 = directions[32 - j];

      const sprite1 = MagicSprite.createMovingOnDirection(
        userId,
        magic,
        origin,
        dir1,
        destroyOnEnd,
        getSpeedRatio(dir1)
      );
      this.callbacks.addWorkItem(delay, sprite1);

      const sprite2 = MagicSprite.createMovingOnDirection(
        userId,
        magic,
        origin,
        dir2,
        destroyOnEnd,
        getSpeedRatio(dir2)
      );
      this.callbacks.addWorkItem(delay, sprite2);
    }

    const finalSprite = MagicSprite.createMovingOnDirection(
      userId,
      magic,
      origin,
      directions[0],
      destroyOnEnd,
      getSpeedRatio(directions[0])
    );
    this.callbacks.addWorkItem((18 + 15) * delayTime, finalSprite);
  }

  /**
   * 添加螺旋移动武功
   */
  addSpiralMoveMagicSprite(
    userId: string,
    magic: MagicData,
    origin: Vector2,
    destination: Vector2,
    destroyOnEnd: boolean
  ): void {
    const direction = { x: destination.x - origin.x, y: destination.y - origin.y };
    const directionIndex = getDirectionIndex(direction, 32);
    const directions = getDirection32List();
    const magicDelayMs = 30;

    for (let i = 0; i < 32; i++) {
      const dirIdx = (directionIndex + i) % 32;
      const dir = directions[dirIdx];
      const delay = i * magicDelayMs;
      const sprite = MagicSprite.createMovingOnDirection(
        userId,
        magic,
        origin,
        dir,
        destroyOnEnd,
        getSpeedRatio(dir)
      );
      this.callbacks.addWorkItem(delay, sprite);
    }
  }

  /**
   * 添加随机扇形移动武功
   */
  addRandomSectorMoveMagicSprite(
    userId: string,
    magic: MagicData,
    origin: Vector2,
    destination: Vector2,
    destroyOnEnd: boolean
  ): void {
    const magicDelayMs = 80;
    const direction = { x: destination.x - origin.x, y: destination.y - origin.y };
    const directionIndex = getDirectionIndex(direction, 8);
    const dir32Index = directionIndex * 4;
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
    this.callbacks.addWorkItem(Math.random() < 0.5 ? 0 : magicDelayMs, centerSprite);

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
      this.callbacks.addWorkItem(Math.random() < 0.5 ? 0 : magicDelayMs, leftSprite);

      const rightSprite = MagicSprite.createMovingOnDirection(
        userId,
        magic,
        origin,
        rightDir,
        destroyOnEnd,
        getSpeedRatio(rightDir)
      );
      this.callbacks.addWorkItem(Math.random() < 0.5 ? 0 : magicDelayMs, rightSprite);
    }
  }

  /**
   * 添加移动墙武功
   */
  addWallMoveMagicSprite(
    userId: string,
    magic: MagicData,
    origin: Vector2,
    destination: Vector2,
    destroyOnEnd: boolean
  ): void {
    const direction = { x: destination.x - origin.x, y: destination.y - origin.y };
    const offset = getDirectionOffset8(direction);
    const dirIndex = getDirectionIndex(direction, 8);
    const dir = getDirection8(dirIndex);
    const speedRatio = getSpeedRatio(dir);

    let count = 1;
    if (magic.effectLevel > 1) {
      count += magic.effectLevel - 1;
    }

    // 中心
    const centerSprite = MagicSprite.createMovingOnDirection(
      userId,
      magic,
      origin,
      dir,
      destroyOnEnd,
      speedRatio
    );
    this.callbacks.addMagicSprite(centerSprite);

    // 两侧
    for (let i = 1; i <= count; i++) {
      const pos1 = { x: origin.x + offset.x * i, y: origin.y + offset.y * i };
      const pos2 = { x: origin.x - offset.x * i, y: origin.y - offset.y * i };

      const sprite1 = MagicSprite.createMovingOnDirection(
        userId,
        magic,
        pos1,
        dir,
        destroyOnEnd,
        speedRatio
      );
      this.callbacks.addMagicSprite(sprite1);

      const sprite2 = MagicSprite.createMovingOnDirection(
        userId,
        magic,
        pos2,
        dir,
        destroyOnEnd,
        speedRatio
      );
      this.callbacks.addMagicSprite(sprite2);
    }
  }

  /**
   * 添加跟随角色武功（BUFF类）
   */
  addFollowCharacterMagicSprite(
    userId: string,
    magic: MagicData,
    origin: Vector2,
    destroyOnEnd: boolean,
    target?: Character
  ): MagicSprite | null {
    const user = this.charHelper.getCharacter(userId);
    if (!user) return null;

    if (magic.moveKind === MagicMoveKind.FollowCharacter) {
      let effectTarget: Character = user;
      if (target && user.isPlayer && target.isFighterFriend) {
        effectTarget = target;
      }

      const sprite = MagicSprite.createFixed(userId, magic, origin, destroyOnEnd);
      const effectAmount =
        (magic.effect === 0 ? effectTarget.attack : magic.effect) + (magic.effectExt ?? 0);

      switch (magic.specialKind) {
        case 1:
          effectTarget.life += effectAmount;
          this.callbacks.addMagicSprite(sprite);
          break;
        case 2:
          effectTarget.thew += effectAmount;
          this.callbacks.addMagicSprite(sprite);
          break;
        case 3:
        case 6:
          {
            const existingSprite = effectTarget
              .getMagicSpritesInEffect()
              .find((s) => s.magic.name === magic.name && !s.isDestroyed);
            if (existingSprite) {
              existingSprite.resetPlay();
            } else {
              effectTarget.addMagicSpriteInEffect(sprite);
              this.callbacks.addMagicSprite(sprite);
            }
          }
          break;
        case 4:
          effectTarget.invisibleByMagicTime = effectAmount;
          effectTarget.isVisibleWhenAttack = false;
          this.callbacks.addMagicSprite(sprite);
          break;
        case 5:
          effectTarget.invisibleByMagicTime = effectAmount;
          effectTarget.isVisibleWhenAttack = true;
          this.callbacks.addMagicSprite(sprite);
          break;
        case 7:
          effectTarget.changeCharacterBy(sprite);
          this.callbacks.addMagicSprite(sprite);
          break;
        case 8:
          effectTarget.removeAbnormalState();
          this.callbacks.addMagicSprite(sprite);
          break;
        case 9:
          effectTarget.flyIniChangeBy(sprite);
          this.callbacks.addMagicSprite(sprite);
          break;
        default:
          this.callbacks.addMagicSprite(sprite);
          break;
      }

      return sprite;
    } else if (magic.moveKind === MagicMoveKind.TimeStop) {
      const _currentTimeStopper = this.callbacks.getKind19Magics; // 仅检查是否有
      // 使用 callback 检查 timeStopperMagicSprite
      const sprite = MagicSprite.createFixed(userId, magic, origin, destroyOnEnd);
      this.callbacks.setTimeStopperSprite(sprite);
      this.callbacks.addMagicSprite(sprite);
      return sprite;
    }

    return null;
  }

  /**
   * 添加超级模式武功
   */
  addSuperModeMagicSprite(
    userId: string,
    magic: MagicData,
    origin: Vector2,
    destroyOnEnd: boolean
  ): MagicSprite {
    const sprite = MagicSprite.createFixed(userId, magic, origin, destroyOnEnd);
    if (magic.superModeImage) {
      sprite.flyingAsfPath = magic.superModeImage;

      const cached = magicRenderer.getCachedAsf(magic.superModeImage);
      if (cached) {
        sprite.frameCountsPerDirection = cached.framesPerDirection;
        sprite.frameInterval = cached.interval;
        logger.log(
          `[SpriteFactory] SuperMode sprite initialized: framesPerDir=${cached.framesPerDirection}, interval=${cached.interval}`
        );
      } else {
        logger.warn(
          `[SpriteFactory] SuperMode ASF not cached: ${magic.superModeImage}, animation may not work correctly`
        );
      }
    }

    this.callbacks.initializeSpriteEffects(sprite);
    sprite.resetPlay();
    this.callbacks.setSuperModeState(sprite);

    return sprite;
  }

  /**
   * 添加跟随敌人武功（追踪类）
   */
  addFollowEnemyMagicSprite(
    userId: string,
    magic: MagicData,
    origin: Vector2,
    destination: Vector2,
    destroyOnEnd: boolean
  ): void {
    const sprite = MagicSprite.createMoving(userId, magic, origin, destination, destroyOnEnd);
    this.callbacks.addMagicSprite(sprite);
  }

  /**
   * 添加投掷武功
   * Throw magic
   */
  addThrowMagicSprite(
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
        this.callbacks.addMagicSprite(sprite);

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

  // ========== Region 区域武功方法 ==========

  /**
   * 添加区域武功
   * case 11
   */
  addRegionBasedMagicSprite(
    userId: string,
    magic: MagicData,
    origin: Vector2,
    destination: Vector2,
    destroyOnEnd: boolean
  ): void {
    switch (magic.region) {
      case 1:
        this.addSquareFixedPositionMagicSprite(userId, magic, destination, destroyOnEnd);
        break;
      case 2:
        this.addCrossFixedPositionMagicSprite(userId, magic, origin, destroyOnEnd);
        break;
      case 3:
        this.addRectangleFixedPositionMagicSprite(userId, magic, origin, destination, destroyOnEnd);
        break;
      case 4:
        this.addIsoscelesTriangleMagicSprite(userId, magic, origin, destination, destroyOnEnd);
        break;
      case 5:
        this.addVTypeFixedPositionMagicSprite(userId, magic, origin, destination, destroyOnEnd);
        break;
      case 6:
        this.addRegionFileMagicSprite(userId, magic, origin, destination, destroyOnEnd);
        break;
      default:
        logger.warn(`[SpriteFactory] Unknown Region: ${magic.region}`);
        break;
    }
  }

  /**
   * 方形区域武功
   */
  private addSquareFixedPositionMagicSprite(
    userId: string,
    magic: MagicData,
    destination: Vector2,
    destroyOnEnd: boolean
  ): void {
    let count = 3;
    if (magic.effectLevel > 3) {
      count += Math.floor((magic.effectLevel - 1) / 3) * 2;
    }
    const offsetRow = { x: 32, y: 16 };
    const offsetColumn = { x: 32, y: -16 };
    const halfCount = Math.floor(count / 2);

    let pos = {
      x: destination.x - halfCount * offsetRow.x,
      y: destination.y - halfCount * offsetRow.y,
    };

    for (let i = 0; i < count; i++) {
      this.addFixedWallAtPosition(userId, magic, pos, offsetColumn, count, destroyOnEnd);
      pos = {
        x: pos.x + offsetRow.x,
        y: pos.y + offsetRow.y,
      };
    }
  }

  /**
   * 十字区域武功
   */
  private addCrossFixedPositionMagicSprite(
    userId: string,
    magic: MagicData,
    origin: Vector2,
    destroyOnEnd: boolean
  ): void {
    let count = 3;
    if (magic.effectLevel > 3) {
      count += Math.floor((magic.effectLevel - 1) / 3) * 2;
    }
    const magicDelayMs = 60;
    const crossOffsets = [
      { x: 32, y: 16 },
      { x: 32, y: -16 },
      { x: -32, y: 16 },
      { x: -32, y: -16 },
    ];

    for (let i = 0; i < count; i++) {
      const delay = i * magicDelayMs;
      for (const offset of crossOffsets) {
        const pos = {
          x: origin.x + (i + 1) * offset.x,
          y: origin.y + (i + 1) * offset.y,
        };
        const sprite = MagicSprite.createFixed(userId, magic, pos, destroyOnEnd);
        this.callbacks.addWorkItem(delay, sprite);
      }
    }
  }

  /**
   * 矩形区域武功
   */
  private addRectangleFixedPositionMagicSprite(
    userId: string,
    magic: MagicData,
    origin: Vector2,
    destination: Vector2,
    destroyOnEnd: boolean
  ): void {
    const direction = { x: destination.x - origin.x, y: destination.y - origin.y };
    const directionIndex = getDirectionIndex(direction, 8);
    const columnCount = 5;
    let count = 3;
    if (magic.effectLevel > 3) {
      count += Math.floor((magic.effectLevel - 1) / 3) * 2;
    }
    const magicDelayMs = 60;

    switch (directionIndex) {
      case 1:
      case 3:
      case 5:
      case 7: {
        let beginPosition = { ...origin };
        let offsetColumn: Vector2;
        let offsetRow: Vector2;

        switch (directionIndex) {
          case 1:
            offsetColumn = { x: 32, y: 16 };
            offsetRow = { x: -32, y: 16 };
            break;
          case 3:
            offsetColumn = { x: 32, y: -16 };
            offsetRow = { x: -32, y: -16 };
            break;
          case 5:
            offsetColumn = { x: 32, y: 16 };
            offsetRow = { x: 32, y: -16 };
            break;
          default:
            offsetColumn = { x: 32, y: -16 };
            offsetRow = { x: 32, y: 16 };
            break;
        }

        for (let i = 0; i < count; i++) {
          beginPosition = {
            x: beginPosition.x + offsetRow.x,
            y: beginPosition.y + offsetRow.y,
          };
          this.addFixedWallAtPositionWithDelay(
            userId,
            magic,
            beginPosition,
            offsetColumn,
            columnCount,
            destroyOnEnd,
            i * magicDelayMs
          );
        }
        break;
      }
      case 0:
      case 4: {
        const offsetRow = directionIndex === 0 ? { x: 0, y: 32 } : { x: 0, y: -32 };
        let beginPosition = { ...origin };

        for (let i = 0; i < count; i++) {
          beginPosition = {
            x: beginPosition.x + offsetRow.x,
            y: beginPosition.y + offsetRow.y,
          };
          this.addHorizontalFixedWallMagicSprite(
            userId,
            magic,
            beginPosition,
            columnCount,
            destroyOnEnd,
            i * magicDelayMs
          );
        }
        break;
      }
      case 2: {
        let beginPosition = { ...origin };
        const offsetColumn = { x: 0, y: 32 };

        for (let i = 0; i < count; i++) {
          if (i % 2 === 0) {
            beginPosition = { x: beginPosition.x - 32, y: beginPosition.y - 16 };
          } else {
            beginPosition = { x: beginPosition.x - 32, y: beginPosition.y + 16 };
          }
          this.addFixedWallAtPositionWithDelay(
            userId,
            magic,
            beginPosition,
            offsetColumn,
            columnCount,
            destroyOnEnd,
            i * magicDelayMs
          );
        }
        break;
      }
      case 6: {
        let beginPosition = { ...origin };
        const offsetColumn = { x: 0, y: 32 };

        for (let i = 0; i < count; i++) {
          if (i % 2 === 0) {
            beginPosition = { x: beginPosition.x + 32, y: beginPosition.y + 16 };
          } else {
            beginPosition = { x: beginPosition.x + 32, y: beginPosition.y - 16 };
          }
          this.addFixedWallAtPositionWithDelay(
            userId,
            magic,
            beginPosition,
            offsetColumn,
            columnCount,
            destroyOnEnd,
            i * magicDelayMs
          );
        }
        break;
      }
    }
  }

  /**
   * 水平固定墙武功
   */
  private addHorizontalFixedWallMagicSprite(
    userId: string,
    magic: MagicData,
    wallMiddle: Vector2,
    count: number,
    destroyOnEnd: boolean,
    delay: number
  ): void {
    count = Math.floor(count / 2);
    const position = { ...wallMiddle };
    this.callbacks.addWorkItem(
      delay,
      MagicSprite.createFixed(userId, magic, position, destroyOnEnd)
    );

    let newPositionLeft = { ...position };
    let newPositionRight = { ...position };

    for (let i = 0; i < count; i++) {
      if (i % 2 === 0) {
        newPositionLeft = { x: newPositionLeft.x - 32, y: newPositionLeft.y - 16 };
        newPositionRight = { x: newPositionRight.x + 32, y: newPositionRight.y - 16 };
      } else {
        newPositionLeft = { x: newPositionLeft.x - 32, y: newPositionLeft.y + 16 };
        newPositionRight = { x: newPositionRight.x + 32, y: newPositionRight.y + 16 };
      }
      this.callbacks.addWorkItem(
        delay,
        MagicSprite.createFixed(userId, magic, newPositionLeft, destroyOnEnd)
      );
      this.callbacks.addWorkItem(
        delay,
        MagicSprite.createFixed(userId, magic, newPositionRight, destroyOnEnd)
      );
    }
  }

  /**
   * 等腰三角形区域武功
   */
  private addIsoscelesTriangleMagicSprite(
    userId: string,
    magic: MagicData,
    origin: Vector2,
    destination: Vector2,
    destroyOnEnd: boolean
  ): void {
    const direction = { x: destination.x - origin.x, y: destination.y - origin.y };
    const directionIndex = getDirectionIndex(direction, 8);

    const rowOffsets = [
      { x: 0, y: 32 },
      { x: -32, y: 16 },
      { x: -64, y: 0 },
      { x: -32, y: -16 },
      { x: 0, y: -32 },
      { x: 32, y: -16 },
      { x: 64, y: 0 },
      { x: 32, y: 16 },
    ];
    const columnOffsets = [
      { x: 64, y: 0 },
      { x: -32, y: -16 },
      { x: 0, y: 32 },
      { x: -32, y: 16 },
      { x: 64, y: 0 },
      { x: 32, y: 16 },
      { x: 0, y: 32 },
      { x: 32, y: -16 },
    ];

    const rowOffset = rowOffsets[directionIndex];
    const columnOffset = columnOffsets[directionIndex];

    let count = 3;
    if (magic.effectLevel > 3) {
      count += Math.floor((magic.effectLevel - 1) / 3) * 2;
    }
    const magicDelayMs = 60;

    let beginPos = { ...origin };
    for (let i = 0; i < count; i++) {
      beginPos = {
        x: beginPos.x + rowOffset.x,
        y: beginPos.y + rowOffset.y,
      };
      this.addFixedWallAtPositionWithDelay(
        userId,
        magic,
        beginPos,
        columnOffset,
        1 + i * 2,
        destroyOnEnd,
        i * magicDelayMs
      );
    }
  }

  /**
   * V形区域武功
   */
  private addVTypeFixedPositionMagicSprite(
    userId: string,
    magic: MagicData,
    origin: Vector2,
    destination: Vector2,
    destroyOnEnd: boolean
  ): void {
    const direction = { x: destination.x - origin.x, y: destination.y - origin.y };
    const directionIndex = getDirectionIndex(direction, 8);

    let count = 3;
    if (magic.effectLevel > 3) {
      count += Math.floor((magic.effectLevel - 1) / 3) * 2;
    }
    const magicDelayMs = 60;

    const originTile = pixelToTile(origin.x, origin.y);
    const startTile = this.findNeighborInDirection(originTile, directionIndex);
    const startPos = tileToPixel(startTile.x, startTile.y);

    const sprite = MagicSprite.createFixed(userId, magic, startPos, destroyOnEnd);
    this.callbacks.addMagicSprite(sprite);

    let leftTile = { ...startTile };
    let rightTile = { ...startTile };

    for (let i = 1; i < count; i++) {
      leftTile = this.findNeighborInDirection(leftTile, (directionIndex + 7) % 8);
      rightTile = this.findNeighborInDirection(rightTile, (directionIndex + 1) % 8);

      const leftPos = tileToPixel(leftTile.x, leftTile.y);
      const rightPos = tileToPixel(rightTile.x, rightTile.y);

      const leftSprite = MagicSprite.createFixed(userId, magic, leftPos, destroyOnEnd);
      this.callbacks.addWorkItem(i * magicDelayMs, leftSprite);

      const rightSprite = MagicSprite.createFixed(userId, magic, rightPos, destroyOnEnd);
      this.callbacks.addWorkItem(i * magicDelayMs, rightSprite);
    }
  }

  /**
   * 使用区域文件的武功
   */
  private addRegionFileMagicSprite(
    userId: string,
    magic: MagicData,
    _origin: Vector2,
    destination: Vector2,
    destroyOnEnd: boolean
  ): void {
    logger.log(`[SpriteFactory] RegionFile magic not fully implemented: ${magic.name}`);
    this.addFixedPositionMagicSprite(userId, magic, destination, destroyOnEnd);
  }

  /**
   * 在指定位置添加固定墙
   */
  private addFixedWallAtPosition(
    userId: string,
    magic: MagicData,
    center: Vector2,
    offset: Vector2,
    count: number,
    destroyOnEnd: boolean
  ): void {
    const halfCount = Math.floor((count - 1) / 2);
    const sprite = MagicSprite.createFixed(userId, magic, center, destroyOnEnd);
    this.callbacks.addMagicSprite(sprite);

    for (let i = 1; i <= halfCount; i++) {
      const pos1 = { x: center.x + offset.x * i, y: center.y + offset.y * i };
      const pos2 = { x: center.x - offset.x * i, y: center.y - offset.y * i };
      this.callbacks.addMagicSprite(MagicSprite.createFixed(userId, magic, pos1, destroyOnEnd));
      this.callbacks.addMagicSprite(MagicSprite.createFixed(userId, magic, pos2, destroyOnEnd));
    }
  }

  /**
   * 在指定位置添加固定墙（带延迟）
   */
  private addFixedWallAtPositionWithDelay(
    userId: string,
    magic: MagicData,
    center: Vector2,
    offset: Vector2,
    count: number,
    destroyOnEnd: boolean,
    delay: number
  ): void {
    const halfCount = Math.floor((count - 1) / 2);
    const sprite = MagicSprite.createFixed(userId, magic, center, destroyOnEnd);
    this.callbacks.addWorkItem(delay, sprite);

    for (let i = 1; i <= halfCount; i++) {
      const pos1 = { x: center.x + offset.x * i, y: center.y + offset.y * i };
      const pos2 = { x: center.x - offset.x * i, y: center.y - offset.y * i };
      this.callbacks.addWorkItem(delay, MagicSprite.createFixed(userId, magic, pos1, destroyOnEnd));
      this.callbacks.addWorkItem(delay, MagicSprite.createFixed(userId, magic, pos2, destroyOnEnd));
    }
  }

  /**
   * 查找指定方向的相邻瓦片
   * 使用 getNeighbors 来正确处理等角瓦片的奇偶行偏移
   */
  private findNeighborInDirection(tile: Vector2, direction: number): Vector2 {
    return getNeighbors(tile)[direction % 8];
  }

  // ========== 特殊 MoveKind 方法 ==========

  /**
   * Kind19 武功 - 持续留痕
   */
  addKind19MagicSprite(userId: string, magic: MagicData): void {
    const belongCharacter = this.charHelper.getBelongCharacter(userId);
    if (!belongCharacter) {
      logger.warn(`[SpriteFactory] Kind19: Cannot find character for userId=${userId}`);
      return;
    }

    const info: Kind19MagicInfo = {
      keepMilliseconds: magic.keepMilliseconds,
      magic,
      belongCharacterId: userId,
      lastTilePosition: { ...belongCharacter.tilePosition },
    };
    this.callbacks.addKind19Magic(info);

    logger.log(
      `[SpriteFactory] Kind19 magic started: ${magic.name}, ` +
        `keepMilliseconds=${magic.keepMilliseconds}`
    );
  }

  /**
   * 传送武功
   */
  addTransportMagicSprite(
    userId: string,
    magic: MagicData,
    destination: Vector2,
    destroyOnEnd: boolean
  ): void {
    const belongCharacter = this.charHelper.getBelongCharacter(userId);
    if (!belongCharacter) {
      logger.warn(`[SpriteFactory] Transport: cannot find character for ${userId}`);
      return;
    }

    if (belongCharacter.isInTransport) {
      logger.log(`[SpriteFactory] Transport: ${userId} is already in transport, ignoring`);
      return;
    }

    belongCharacter.isInTransport = true;

    logger.log(
      `[SpriteFactory] Transport magic: ${magic.name}, destination=(${destination.x}, ${destination.y})`
    );

    const sprite = this.addFixedPositionMagicSprite(userId, magic, destination, destroyOnEnd);
    if (sprite) {
      sprite.destination = { ...destination };
    }
  }

  /**
   * 控制角色武功
   */
  addControlCharacterMagicSprite(
    userId: string,
    magic: MagicData,
    origin: Vector2,
    destroyOnEnd: boolean,
    target?: CharacterRef
  ): void {
    if (userId !== "player") {
      logger.warn(`[SpriteFactory] ControlCharacter: only player can use this magic`);
      return;
    }

    if (!target || target.type !== "npc") {
      logger.warn(`[SpriteFactory] ControlCharacter: no valid NPC target`);
      return;
    }

    const targetNpc = target.npc;

    if (targetNpc.isDeathInvoked) {
      logger.log(`[SpriteFactory] ControlCharacter: target is dead, cannot control`);
      return;
    }

    if (magic.maxLevel > 0 && targetNpc.level > magic.maxLevel) {
      logger.log(
        `[SpriteFactory] ControlCharacter: target level ${targetNpc.level} > maxLevel ${magic.maxLevel}`
      );
      return;
    }

    this.player.controledCharacter = targetNpc;

    logger.log(
      `[SpriteFactory] ControlCharacter magic: ${magic.name}, ` +
        `now controlling ${targetNpc.name} (level ${targetNpc.level})`
    );

    const sprite = this.addFixedPositionMagicSprite(userId, magic, origin, destroyOnEnd);
    if (sprite && this.player.controledCharacter) {
      this.player.controledCharacter.controledMagicSprite = sprite;
    }
  }

  /**
   * 召唤 NPC 武功
   */
  async addSummonMagicSprite(
    userId: string,
    magic: MagicData,
    destination: Vector2,
    destroyOnEnd: boolean
  ): Promise<void> {
    logger.log(`[SpriteFactory] Summon magic: ${magic.name}, npcFile=${magic.npcFile}`);

    if (!magic.npcFile) {
      logger.warn(`[SpriteFactory] Summon magic ${magic.name} has no npcFile`);
      return;
    }

    const belongCharacter = this.charHelper.getBelongCharacter(userId);
    if (!belongCharacter) {
      logger.warn(`[SpriteFactory] Cannot summon: belongCharacter not found for ${userId}`);
      return;
    }

    if (magic.maxCount > 0 && belongCharacter.summonedNpcsCount(magic.fileName) >= magic.maxCount) {
      belongCharacter.removeFirstSummonedNpc(magic.fileName);
    }

    let summonTile = pixelToTile(destination.x, destination.y);
    const collisionChecker = getEngineContext().map;
    if (!collisionChecker.isTileWalkable(summonTile)) {
      const neighbors = [
        { x: summonTile.x - 1, y: summonTile.y },
        { x: summonTile.x + 1, y: summonTile.y },
        { x: summonTile.x, y: summonTile.y - 1 },
        { x: summonTile.x, y: summonTile.y + 1 },
      ];
      const validNeighbor = neighbors.find((n) => collisionChecker.isTileWalkable(n));
      if (validNeighbor) {
        summonTile = validNeighbor;
      } else {
        logger.warn(
          `[SpriteFactory] Cannot find valid tile for summon at ${JSON.stringify(destination)}`
        );
        return;
      }
    }

    const summonPos = tileToPixel(summonTile.x, summonTile.y);
    const dx = summonPos.x - belongCharacter.pixelPosition.x;
    const dy = summonPos.y - belongCharacter.pixelPosition.y;
    let direction = 4;
    if (Math.abs(dx) > Math.abs(dy)) {
      direction = dx > 0 ? 6 : 2;
    } else if (Math.abs(dy) > 0) {
      direction = dy > 0 ? 4 : 0;
    }

    const npc = await this.npcManager.addNpc(
      magic.npcFile,
      summonTile.x,
      summonTile.y,
      direction as 0 | 2 | 4 | 6
    );
    if (!npc) {
      logger.warn(`[SpriteFactory] Failed to create summoned NPC from ${magic.npcFile}`);
      return;
    }

    if (belongCharacter.isPlayer || belongCharacter.isFighterFriend) {
      npc.relation = 2;
    } else {
      npc.kind = 2;
      npc.relation = belongCharacter.relation;
    }

    belongCharacter.addSummonedNpc(magic.fileName, npc);
    this.addFixedPositionMagicSprite(userId, magic, summonPos, destroyOnEnd);

    logger.log(
      `[SpriteFactory] Summoned NPC ${npc.name} at tile (${summonTile.x}, ${summonTile.y})`
    );
  }
}
