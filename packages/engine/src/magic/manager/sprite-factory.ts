/**
 * Sprite Factory - 武功精灵创建工厂 (Facade)
 * 委托到三个子模块：Movement / Region / Special
 *
 * Reference: MagicSpriteManager.Add*MagicSprite methods
 */

import { getEngineContext } from "../../core/engine-context";
import type { Vector2 } from "../../core/types";
import type { NpcManager } from "../../npc";
import type { Player } from "../../player/player";
import { getSpeedRatio, normalizeVector } from "../../utils/math";
import type { CharacterRef } from "../effects";
import { MagicSprite } from "../magic-sprite";
import type { MagicData } from "../types";
import { MovementSpriteFactory } from "./sprite-factory-movement";
import { RegionSpriteFactory } from "./sprite-factory-region";
import { SpecialSpriteFactory } from "./sprite-factory-special";
import type { CharacterHelper, MagicSpriteManagerDeps, SpriteFactoryCallbacks } from "./types";

/**
 * 武功精灵创建工厂 — 薄外观层
 * 简单方法直接实现，复杂模式委托子工厂
 */
export class SpriteFactory {
  private movement: MovementSpriteFactory;
  private region: RegionSpriteFactory;
  private special: SpecialSpriteFactory;
  private callbacks: SpriteFactoryCallbacks;

  constructor(
    deps: MagicSpriteManagerDeps,
    charHelper: CharacterHelper,
    callbacks: SpriteFactoryCallbacks
  ) {
    this.callbacks = callbacks;
    this.movement = new MovementSpriteFactory(callbacks);
    this.region = new RegionSpriteFactory(callbacks);
    this.special = new SpecialSpriteFactory({
      player: deps.player as Player,
      npcManager: deps.npcManager as NpcManager,
      magicRenderer: deps.magicRenderer,
      charHelper,
      callbacks,
      isTileWalkable: (tile) => getEngineContext().map.isTileWalkable(tile),
    });
  }

  // ========== 基础（内联实现） ==========

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

  // ========== 移动模式（委托） ==========

  addVMoveMagicSprite(
    userId: string,
    magic: MagicData,
    origin: Vector2,
    destination: Vector2,
    destroyOnEnd: boolean
  ): void {
    this.movement.addVMoveMagicSprite(userId, magic, origin, destination, destroyOnEnd);
  }

  addCircleMoveMagicSprite(
    userId: string,
    magic: MagicData,
    origin: Vector2,
    destroyOnEnd: boolean
  ): void {
    this.movement.addCircleMoveMagicSprite(userId, magic, origin, destroyOnEnd);
  }

  addSectorMoveMagicSprite(
    userId: string,
    magic: MagicData,
    origin: Vector2,
    destination: Vector2,
    destroyOnEnd: boolean
  ): void {
    this.movement.addSectorMoveMagicSprite(userId, magic, origin, destination, destroyOnEnd);
  }

  addFixedWallMagicSprite(
    userId: string,
    magic: MagicData,
    origin: Vector2,
    destination: Vector2,
    destroyOnEnd: boolean
  ): void {
    this.movement.addFixedWallMagicSprite(userId, magic, origin, destination, destroyOnEnd);
  }

  addHeartMoveMagicSprite(
    userId: string,
    magic: MagicData,
    origin: Vector2,
    destroyOnEnd: boolean
  ): void {
    this.movement.addHeartMoveMagicSprite(userId, magic, origin, destroyOnEnd);
  }

  addSpiralMoveMagicSprite(
    userId: string,
    magic: MagicData,
    origin: Vector2,
    destination: Vector2,
    destroyOnEnd: boolean
  ): void {
    this.movement.addSpiralMoveMagicSprite(userId, magic, origin, destination, destroyOnEnd);
  }

  addRandomSectorMoveMagicSprite(
    userId: string,
    magic: MagicData,
    origin: Vector2,
    destination: Vector2,
    destroyOnEnd: boolean
  ): void {
    this.movement.addRandomSectorMoveMagicSprite(userId, magic, origin, destination, destroyOnEnd);
  }

  addWallMoveMagicSprite(
    userId: string,
    magic: MagicData,
    origin: Vector2,
    destination: Vector2,
    destroyOnEnd: boolean
  ): void {
    this.movement.addWallMoveMagicSprite(userId, magic, origin, destination, destroyOnEnd);
  }

  addThrowMagicSprite(
    userId: string,
    magic: MagicData,
    origin: Vector2,
    destination: Vector2,
    destroyOnEnd: boolean
  ): void {
    this.movement.addThrowMagicSprite(userId, magic, origin, destination, destroyOnEnd);
  }

  // ========== 区域（委托） ==========

  addRegionBasedMagicSprite(
    userId: string,
    magic: MagicData,
    origin: Vector2,
    destination: Vector2,
    destroyOnEnd: boolean
  ): void {
    this.region.addRegionBasedMagicSprite(userId, magic, origin, destination, destroyOnEnd);
  }

  // ========== 特殊（委托） ==========

  addFollowCharacterMagicSprite(
    userId: string,
    magic: MagicData,
    origin: Vector2,
    destroyOnEnd: boolean
  ): MagicSprite | null {
    return this.special.addFollowCharacterMagicSprite(userId, magic, origin, destroyOnEnd);
  }

  addSuperModeMagicSprite(
    userId: string,
    magic: MagicData,
    origin: Vector2,
    destroyOnEnd: boolean
  ): MagicSprite {
    return this.special.addSuperModeMagicSprite(userId, magic, origin, destroyOnEnd);
  }

  addFollowEnemyMagicSprite(
    userId: string,
    magic: MagicData,
    origin: Vector2,
    destination: Vector2,
    destroyOnEnd: boolean
  ): void {
    this.special.addFollowEnemyMagicSprite(userId, magic, origin, destination, destroyOnEnd);
  }

  addKind19MagicSprite(userId: string, magic: MagicData): void {
    this.special.addKind19MagicSprite(userId, magic);
  }

  addTransportMagicSprite(
    userId: string,
    magic: MagicData,
    destination: Vector2,
    destroyOnEnd: boolean
  ): void {
    this.special.addTransportMagicSprite(userId, magic, destination, destroyOnEnd);
  }

  addControlCharacterMagicSprite(
    userId: string,
    magic: MagicData,
    origin: Vector2,
    destroyOnEnd: boolean,
    target?: CharacterRef
  ): void {
    this.special.addControlCharacterMagicSprite(userId, magic, origin, destroyOnEnd, target);
  }

  async addSummonMagicSprite(
    userId: string,
    magic: MagicData,
    destination: Vector2,
    destroyOnEnd: boolean
  ): Promise<void> {
    return this.special.addSummonMagicSprite(userId, magic, destination, destroyOnEnd);
  }
}
