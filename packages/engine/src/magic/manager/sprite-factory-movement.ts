/**
 * Movement Sprite Factory - 移动模式武功精灵创建
 * 从 SpriteFactory 提取，负责创建方向性/移动类武功精灵
 *
 * Reference: MagicManager Add*MoveMagicSprite + Wall/Throw methods
 */

import { logger } from "../../core/logger";
import type { Vector2 } from "../../core/types";
import {
  getDirection8,
  getDirection32List,
  getDirectionIndex,
  getDirectionOffset8,
} from "../../utils/direction";
import { getSpeedRatio } from "../../utils/math";
import { MagicSprite } from "../magic-sprite";
import type { MagicData } from "../types";

/** 移动工厂所需的回调（最小子集） */
export interface MovementSpriteCallbacks {
  addMagicSprite(sprite: MagicSprite): void;
  addWorkItem(delayMs: number, sprite: MagicSprite): void;
}

/**
 * 移动模式武功精灵创建器
 * 处理 V字/圆形/扇形/心形/螺旋/随机扇形/墙/投掷 等移动模式
 */
export class MovementSpriteFactory {
  constructor(private callbacks: MovementSpriteCallbacks) {}

  /** V字移动武功 */
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

    // 两侧武功
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

  /** 圆形移动武功 */
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

  /** 扇形移动武功 */
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

    if (dir32Index < 0 || dir32Index >= directions.length) {
      logger.warn(
        `[SpriteFactory] addSectorMove: invalid dir32Index=${dir32Index}, ` +
          `origin=(${origin.x},${origin.y}), dest=(${destination.x},${destination.y})`
      );
      return;
    }

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
      const leftIdx = (((dir32Index + i * 2) % 32) + 32) % 32;
      const rightIdx = (((dir32Index + 32 - i * 2) % 32) + 32) % 32;

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

  /** 固定墙武功 */
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
    const centerSprite = MagicSprite.createFixed(userId, magic, destination, destroyOnEnd);
    this.callbacks.addMagicSprite(centerSprite);

    // 两侧
    for (let i = 1; i <= halfCount; i++) {
      const pos1 = { x: destination.x + offset.x * i, y: destination.y + offset.y * i };
      const pos2 = { x: destination.x - offset.x * i, y: destination.y - offset.y * i };
      const s1 = MagicSprite.createFixed(userId, magic, pos1, destroyOnEnd);
      this.callbacks.addMagicSprite(s1);
      const s2 = MagicSprite.createFixed(userId, magic, pos2, destroyOnEnd);
      this.callbacks.addMagicSprite(s2);
    }
  }

  /** 心形移动武功 */
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

  /** 螺旋移动武功 */
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

  /** 随机扇形移动武功 */
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

    if (dir32Index < 0 || dir32Index >= directions.length) {
      logger.warn(`[SpriteFactory] addRandomSectorMove: invalid dir32Index=${dir32Index}`);
      return;
    }

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
      const leftIdx = (((dir32Index + i * 2) % 32) + 32) % 32;
      const rightIdx = (((dir32Index + 32 - i * 2) % 32) + 32) % 32;

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

  /** 移动墙武功 */
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

  /** 投掷武功 */
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
}
