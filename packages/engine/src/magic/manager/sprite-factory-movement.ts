/**
 * Movement Sprite Factory - 移动模式武功精灵创建
 * 从 SpriteFactory 提取，负责创建方向性/移动类武功精灵
 */

import { logger } from "../../core/logger";
import type { Vector2 } from "../../core/types";
import { getDirection8, getDirectionIndex, getDirectionOffset8 } from "../../utils/direction";
import { MagicSprite } from "../magic-sprite";
import type { MagicData } from "../types";

/**
 * 圆形/螺旋/心形武功的离散方向数
 */
const MAGIC_CIRCLE_COUNT = 32;
/** 每个方向之间的弧度间隔 */
const MAGIC_CIRCLE_ANGLE_SPACE = (Math.PI * 2) / MAGIC_CIRCLE_COUNT;

/**
 * 计算圆形/螺旋/心形武功第 i 个方向向量。
 *   x = cos(angle); y = -sin(angle); angle = -PI + i * SPACE
 * 移动更新会对 x 分量乘 MapXRatio 做等距拉伸，故此处使用原始单位向量。
 */
function circleDirection(i: number): Vector2 {
  const angle = -Math.PI + i * MAGIC_CIRCLE_ANGLE_SPACE;
  return { x: Math.cos(angle), y: -Math.sin(angle) };
}

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
    const level = magic.effectLevel < 1 ? 1 : magic.effectLevel;

    // 中心武功
    const centerSprite = MagicSprite.createMovingOnDirection(
      userId,
      magic,
      origin,
      dir,
      destroyOnEnd
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
        destroyOnEnd
      );
      this.callbacks.addMagicSprite(sprite1);

      const sprite2 = MagicSprite.createMovingOnDirection(
        userId,
        magic,
        pos2,
        dir,
        destroyOnEnd
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
    // 32 个方向均匀散开，方向 = (cos(angle), -sin(angle))，angle 从 -PI 起步
    for (let i = 0; i < MAGIC_CIRCLE_COUNT; i++) {
      const dir = circleDirection(i);
      const sprite = MagicSprite.createMovingOnDirection(
        userId,
        magic,
        origin,
        dir,
        destroyOnEnd,
        { applyOffset: false }
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
    const lvl = magic.effectLevel;

    // origin/destination 已是像素坐标，直接算屏幕方向角
    const MapXRatio = 1.414;
    const screenDx = destination.x - origin.x;
    const screenDy = destination.y - origin.y;
    let angle = Math.atan2(-screenDx, screenDy * MapXRatio);

    // 按等级分档展开
    let count: number;
    let step: number;
    if (lvl < 4) {
      count = 3;
      step = Math.PI / 12;
    } else if (lvl < 7) {
      count = 5;
      step = Math.PI / 20;
    } else if (lvl < 10) {
      count = 7;
      step = Math.PI / 15;
    } else {
      count = 9;
      step = Math.PI / 16;
    }

    angle -= step * ((count - 1) / 2);

    for (let i = 0; i < count; i++) {
      const dir = { x: -Math.sin(angle), y: Math.cos(angle) };
      const sprite = MagicSprite.createMovingOnDirection(
        userId,
        magic,
        origin,
        dir,
        destroyOnEnd,
        { applyOffset: false }
      );
      this.callbacks.addMagicSprite(sprite);
      angle += step;
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

    // 玩家施放时整面墙延迟 300ms 出现
    const delayMs = userId === "player" ? 300 : 0;
    const emit = (sprite: MagicSprite) => {
      if (delayMs > 0) {
        this.callbacks.addWorkItem(delayMs, sprite);
      } else {
        this.callbacks.addMagicSprite(sprite);
      }
    };

    // 中心
    emit(MagicSprite.createFixed(userId, magic, destination, destroyOnEnd));

    // 两侧
    for (let i = 1; i <= halfCount; i++) {
      const pos1 = { x: destination.x + offset.x * i, y: destination.y + offset.y * i };
      const pos2 = { x: destination.x - offset.x * i, y: destination.y - offset.y * i };
      emit(MagicSprite.createFixed(userId, magic, pos1, destroyOnEnd));
      emit(MagicSprite.createFixed(userId, magic, pos2, destroyOnEnd));
    }
  }

  /** 心形移动武功 */
  addHeartMoveMagicSprite(
    userId: string,
    magic: MagicData,
    origin: Vector2,
    destroyOnEnd: boolean
  ): void {
    const HEART_DELAY = 10;
    const HEART_DECAY = 0.1;
    const quarter = MAGIC_CIRCLE_COUNT / 4;

    for (let i = 0; i < MAGIC_CIRCLE_COUNT; i++) {
      const dir = circleDirection(i);
      let waitMs: number;
      let speedFactor: number;

      if (i < quarter) {
        const count = i;
        waitMs = (quarter - count) * HEART_DELAY;
        speedFactor = 1.0 - count * HEART_DECAY;
      } else if (i < MAGIC_CIRCLE_COUNT / 2) {
        const count = i - quarter;
        waitMs = count * HEART_DELAY;
        speedFactor = 1.0 - (quarter - count) * HEART_DECAY;
      } else if (i < 3 * quarter) {
        const count = i - MAGIC_CIRCLE_COUNT / 2;
        waitMs = count * HEART_DELAY + HEART_DELAY * quarter;
        speedFactor = 1.0 + count * HEART_DECAY;
      } else {
        const count = i - 3 * quarter;
        waitMs = (quarter - count) * HEART_DELAY + HEART_DELAY * quarter;
        speedFactor = 1.0 + (quarter - count) * HEART_DECAY;
      }

      const sprite = MagicSprite.createMovingOnDirection(
        userId,
        magic,
        origin,
        dir,
        destroyOnEnd,
        { speedRatio: Math.max(0.01, speedFactor), applyOffset: false }
      );
      this.callbacks.addWorkItem(waitMs, sprite);
    }
  }

  /** 螺旋移动武功 */
  addSpiralMoveMagicSprite(
    userId: string,
    magic: MagicData,
    origin: Vector2,
    destination: Vector2,
    destroyOnEnd: boolean
  ): void {
    // 方向恒为 (cos(angle), -sin(angle))（angle 从 -PI 起步），仅延迟随 startDir 旋转，
    // 形成绕施法者一圈的螺旋扫描。
    const HELIX_INTERVAL = 10;
    const direction = { x: destination.x - origin.x, y: destination.y - origin.y };

    let startDir = getDirectionIndex(direction, MAGIC_CIRCLE_COUNT);
    startDir -= MAGIC_CIRCLE_COUNT / 4;
    if (startDir < 0) startDir += MAGIC_CIRCLE_COUNT;
    startDir = (MAGIC_CIRCLE_COUNT - startDir) % MAGIC_CIRCLE_COUNT;

    for (let i = 0; i < MAGIC_CIRCLE_COUNT; i++) {
      const dir = circleDirection(i);
      let count = i - startDir;
      if (count < 0) count += MAGIC_CIRCLE_COUNT;
      const delay = count * HELIX_INTERVAL;
      // 每个精灵沿自身飞行方向 (angle) 向外偏移一格，
      // 使整圈半径增加一格、绕在施法者周围形成环带。
      const sprite = MagicSprite.createMovingOnDirection(
        userId,
        magic,
        origin,
        dir,
        destroyOnEnd,
        { applyOffset: true }
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
    const lvl = magic.effectLevel;

    const MapXRatio = 1.414;
    const screenDx = destination.x - origin.x;
    const screenDy = destination.y - origin.y;
    let angle = Math.atan2(-screenDx, screenDy * MapXRatio);

    let count: number;
    let step: number;
    if (lvl < 4) {
      count = 3;
      step = Math.PI / 12;
    } else if (lvl < 7) {
      count = 5;
      step = Math.PI / 20;
    } else if (lvl < 10) {
      count = 7;
      step = Math.PI / 15;
    } else {
      count = 9;
      step = Math.PI / 16;
    }

    angle -= step * ((count - 1) / 2);

    for (let i = 0; i < count; i++) {
      const dir = { x: -Math.sin(angle), y: Math.cos(angle) };
      const sprite = MagicSprite.createMovingOnDirection(
        userId,
        magic,
        origin,
        dir,
        destroyOnEnd,
        { applyOffset: false }
      );
      // 每个精灵附加 [0,200) ms 的随机延迟，形成参差散射
      this.callbacks.addWorkItem(Math.floor(Math.random() * 200), sprite);
      angle += step;
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
      destroyOnEnd
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
        destroyOnEnd
      );
      this.callbacks.addMagicSprite(sprite1);

      const sprite2 = MagicSprite.createMovingOnDirection(
        userId,
        magic,
        pos2,
        dir,
        destroyOnEnd
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
