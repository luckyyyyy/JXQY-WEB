/**
 * Special Sprite Factory - 特殊武功精灵创建
 * 从 SpriteFactory 提取，负责创建与角色状态交互的特殊武功精灵
 *
 * Reference: MagicManager Add*MagicSprite (FollowCharacter, SuperMode, Kind19, etc.)
 */

import { logger } from "../../core/logger";
import type { Vector2 } from "../../core/types";
import type { NpcManager } from "../../npc";
import type { Player } from "../../player/player";
import { pixelToTile, tileToPixel } from "../../utils";
import type { CharacterRef } from "../effects";
import type { MagicRenderer } from "../magic-renderer";
import { MagicSprite } from "../magic-sprite";
import type { Kind19MagicInfo, MagicData } from "../types";
import { MagicMoveKind } from "../types";
import type { CharacterHelper, SpriteFactoryCallbacks } from "./types";

/** 特殊工厂所需的依赖 */
export interface SpecialSpriteDeps {
  player: Player;
  npcManager: NpcManager;
  magicRenderer: MagicRenderer;
  charHelper: CharacterHelper;
  callbacks: SpriteFactoryCallbacks;
  /** 地图碰撞检查 (engine.map) */
  isTileWalkable(tile: Vector2): boolean;
}

/**
 * 特殊武功精灵创建器
 * 处理跟随/超级模式/传送/控制/召唤/Kind19 等角色交互类型
 */
export class SpecialSpriteFactory {
  constructor(private deps: SpecialSpriteDeps) {}

  /** 跟随角色武功 (BUFF类) */
  addFollowCharacterMagicSprite(
    userId: string,
    magic: MagicData,
    origin: Vector2,
    destroyOnEnd: boolean
  ): MagicSprite | null {
    const user = this.deps.charHelper.getCharacter(userId);
    if (!user) return null;

    if (magic.moveKind === MagicMoveKind.FollowCharacter) {
      const sprite = MagicSprite.createFixed(userId, magic, origin, destroyOnEnd);
      return sprite;
    } else if (magic.moveKind === MagicMoveKind.TimeStop) {
      const sprite = MagicSprite.createFixed(userId, magic, origin, destroyOnEnd);
      this.deps.callbacks.setTimeStopperSprite(sprite);
      return sprite;
    }

    return null;
  }

  /** 超级模式武功 */
  addSuperModeMagicSprite(
    userId: string,
    magic: MagicData,
    origin: Vector2,
    destroyOnEnd: boolean
  ): MagicSprite {
    const sprite = MagicSprite.createFixed(userId, magic, origin, destroyOnEnd);
    if (magic.superModeImage) {
      sprite.flyingAsfPath = magic.superModeImage;

      const cached = this.deps.magicRenderer.getCachedAsf(magic.superModeImage);
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

    this.deps.callbacks.initializeSpriteEffects(sprite);
    sprite.resetPlay();
    this.deps.callbacks.setSuperModeState(sprite);

    return sprite;
  }

  /** 跟随敌人武功 (追踪类) */
  addFollowEnemyMagicSprite(
    userId: string,
    magic: MagicData,
    origin: Vector2,
    destination: Vector2,
    destroyOnEnd: boolean
  ): void {
    const sprite = MagicSprite.createMoving(userId, magic, origin, destination, destroyOnEnd);
    this.deps.callbacks.addMagicSprite(sprite);
  }

  /** Kind19 武功 - 持续留痕 */
  addKind19MagicSprite(userId: string, magic: MagicData): void {
    const belongCharacter = this.deps.charHelper.getBelongCharacter(userId);
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
    this.deps.callbacks.addKind19Magic(info);

    logger.log(
      `[SpriteFactory] Kind19 magic started: ${magic.name}, ` +
        `keepMilliseconds=${magic.keepMilliseconds}`
    );
  }

  /** 传送武功 */
  addTransportMagicSprite(
    userId: string,
    magic: MagicData,
    destination: Vector2,
    destroyOnEnd: boolean
  ): void {
    const belongCharacter = this.deps.charHelper.getBelongCharacter(userId);
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

    const sprite = MagicSprite.createFixed(userId, magic, destination, destroyOnEnd);
    this.deps.callbacks.addMagicSprite(sprite);
    sprite.destination = { ...destination };
  }

  /** 控制角色武功 */
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

    this.deps.player.controledCharacter = targetNpc;

    logger.log(
      `[SpriteFactory] ControlCharacter magic: ${magic.name}, ` +
        `now controlling ${targetNpc.name} (level ${targetNpc.level})`
    );

    const sprite = MagicSprite.createFixed(userId, magic, origin, destroyOnEnd);
    this.deps.callbacks.addMagicSprite(sprite);
    if (this.deps.player.controledCharacter) {
      this.deps.player.controledCharacter.statusEffects.controledMagicSprite = sprite;
    }
  }

  /** 召唤 NPC 武功 */
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

    const belongCharacter = this.deps.charHelper.getBelongCharacter(userId);
    if (!belongCharacter) {
      logger.warn(`[SpriteFactory] Cannot summon: belongCharacter not found for ${userId}`);
      return;
    }

    if (magic.maxCount > 0 && belongCharacter.summonedNpcsCount(magic.fileName) >= magic.maxCount) {
      belongCharacter.removeFirstSummonedNpc(magic.fileName);
    }

    let summonTile = pixelToTile(destination.x, destination.y);
    if (!this.deps.isTileWalkable(summonTile)) {
      const neighbors = [
        { x: summonTile.x - 1, y: summonTile.y },
        { x: summonTile.x + 1, y: summonTile.y },
        { x: summonTile.x, y: summonTile.y - 1 },
        { x: summonTile.x, y: summonTile.y + 1 },
      ];
      const validNeighbor = neighbors.find((n) => this.deps.isTileWalkable(n));
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

    const npc = await this.deps.npcManager.addNpc(
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
    const sprite = MagicSprite.createFixed(userId, magic, summonPos, destroyOnEnd);
    this.deps.callbacks.addMagicSprite(sprite);

    logger.log(
      `[SpriteFactory] Summoned NPC ${npc.name} at tile (${summonTile.x}, ${summonTile.y})`
    );
  }
}
