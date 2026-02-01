/**
 * Collision Handler - 碰撞检测和伤害处理
 * 从 MagicManager 提取
 *
 * C# Reference: MagicSprite.CollisionDetaction(), CharacterHited()
 */

import { Character } from "../../character/character";
import type { Npc } from "../../character/npc";
import { NpcManager } from "../../character/npcManager";
import { getEngineContext } from "../../core/engineContext";
import { logger } from "../../core/logger";
import { findDistanceTileInDirection } from "../../core/pathFinder";
import type { Vector2 } from "../../core/types";
import { getNeighbors } from "../../utils";
import type { MagicListManager } from "../../player/magic/magicListManager";
import type { Player } from "../../player/player";
import { type ApplyContext, type CharacterRef, type EndContext, getEffect } from "../effects";
import { getMagicAtLevel, loadMagic } from "../magicLoader";
import type { MagicSprite } from "../magicSprite";
import { getDirection8, getDirectionOffset8 } from "../../utils/direction";
import type { MagicData } from "../types";
import type { ICharacterHelper, MagicManagerDeps, MagicManagerState } from "./types";

/**
 * 碰撞处理回调
 */
export interface ICollisionCallbacks {
  createApplyContext(sprite: MagicSprite, targetRef: CharacterRef): ApplyContext | null;
  createEndContext(sprite: MagicSprite): EndContext | null;
  startDestroyAnimation(sprite: MagicSprite): void;
  createHitEffect(sprite: MagicSprite): void;
  playSound(soundPath: string): void;
  useMagic(params: {
    userId: string;
    magic: MagicData;
    origin: Vector2;
    destination: Vector2;
    targetId?: string;
  }): void;
}

/**
 * 碰撞处理器
 */
export class CollisionHandler {
  private player: Player;
  private npcManager: NpcManager;
  private magicListManager: MagicListManager;
  private charHelper: ICharacterHelper;
  private callbacks: ICollisionCallbacks;
  private state: MagicManagerState;

  constructor(
    deps: MagicManagerDeps,
    charHelper: ICharacterHelper,
    callbacks: ICollisionCallbacks,
    state: MagicManagerState
  ) {
    this.player = deps.player;
    this.npcManager = deps.npcManager;
    this.magicListManager = deps.magicListManager;
    this.charHelper = charHelper;
    this.callbacks = callbacks;
    this.state = state;
  }

  /**
   * 检查地图障碍物碰撞
   */
  checkMapObstacle(sprite: MagicSprite): boolean {
    if (sprite.magic.passThroughWall > 0) return false;

    const collisionChecker = getEngineContext().map;
    if (!collisionChecker) return false;

    const tile = sprite.tilePosition;

    if (collisionChecker.isObstacleForMagic(tile.x, tile.y)) {
      logger.log(
        `[CollisionHandler] Sprite ${sprite.magic.name} hit map obstacle at (${tile.x}, ${tile.y})`
      );
      this.callbacks.startDestroyAnimation(sprite);
      return true;
    }
    return false;
  }

  /**
   * 检查敌人碰撞并调用 apply
   * C# Reference: MagicSprite.CollisionDetaction()
   */
  checkCollision(sprite: MagicSprite): boolean {
    if (sprite.isInDestroy) {
      return false;
    }

    // C# Reference: 如果正在粘附角色，检查粘附状态
    // if (_stickedCharacter != null && _stickedCharacter.MovedByMagicSprite == this) return;
    if (sprite.stickedCharacterId !== null) {
      const stickedChar = this.charHelper.getBelongCharacter(sprite.stickedCharacterId);
      if (stickedChar && stickedChar.movedByMagicSprite === sprite) {
        // 正在粘附角色，不进行碰撞检测
        return false;
      } else {
        // 粘附角色已释放或不再被此精灵移动，清除粘附状态
        sprite.clearStickedCharacter();
      }
    }

    // C# Reference: 如果已经找到寄生目标，不进行碰撞检测
    // if (_parasitiferCharacter != null) return;
    if (sprite.parasitiferCharacterId !== null) {
      return false;
    }

    if ((sprite.magic.carryUser ?? 0) === 3) {
      return false;
    }

    const belongCharacter = this.charHelper.getBelongCharacter(sprite.belongCharacterId);
    if (!belongCharacter) {
      return false;
    }

    const tileX = sprite.tilePosition.x;
    const tileY = sprite.tilePosition.y;

    let target: Character | null = null;
    let characterHited = false;

    if (sprite.magic.attackAll > 0) {
      target = this.canCollide(sprite, this.npcManager.getFighter(tileX, tileY));
      characterHited = this.characterHited(sprite, target);
    } else if (belongCharacter.isPlayer || belongCharacter.isFighterFriend) {
      target = this.canCollide(sprite, this.npcManager.getEnemy(tileX, tileY, true));
      if (!target && sprite.elapsedMilliseconds < 100) {
        const enemies = this.npcManager.getEnemyPositions();
        const spritePw = sprite.positionInWorld;
        logger.log(
          `[CollisionHandler] Player magic ${sprite.magic.name} at tile(${tileX},${tileY})/pixel(${spritePw.x.toFixed(0)},${spritePw.y.toFixed(0)}), enemies: ${enemies}`
        );
      }
      characterHited = this.characterHited(sprite, target);
    } else if (belongCharacter.isEnemy) {
      target = this.canCollide(
        sprite,
        this.npcManager.getPlayerOrFighterFriend(tileX, tileY, true)
      );
      if (target === null) {
        target = this.canCollide(
          sprite,
          this.npcManager.getOtherGroupEnemy(belongCharacter.group, tileX, tileY)
        );
      }
      characterHited = this.characterHited(sprite, target);
    } else if (belongCharacter.isNoneFighter) {
      target = this.canCollide(sprite, this.npcManager.getNonneutralFighter(tileX, tileY));
      characterHited = this.characterHited(sprite, target);
    }

    if (!characterHited && !this.checkMagicDiscard(sprite)) {
      this.checkMagicExchangeUser(sprite);
    }

    return characterHited;
  }

  /**
   * 穿透检测
   */
  private canCollide(sprite: MagicSprite, character: Character | null): Character | null {
    if (character === null) return null;

    if (sprite.magic.passThrough > 0) {
      const charId = character.isPlayer ? "player" : (character as Npc).id;
      if (sprite.hasPassThroughedTarget(charId)) {
        return null;
      }
      sprite.addPassThroughedTarget(charId);
    }

    return character;
  }

  /**
   * 处理角色被命中
   * C# Reference: MagicSprite.CharacterHited(Character character)
   */
  characterHited(sprite: MagicSprite, character: Character | null): boolean {
    if (character === null) return false;

    const charId = character.isPlayer ? "player" : (character as Npc).id;
    const charRef = this.charHelper.getCharacterRef(charId);
    if (!charRef) {
      logger.warn(
        `[CollisionHandler] characterHited: Cannot get ref for ${character.name} (id=${charId})`
      );
      return false;
    }

    logger.log(`[CollisionHandler] characterHited: ${sprite.magic.name} -> ${character.name}`);

    const wasAliveBeforeHit = !character.isDeathInvoked && !character.isDeath;
    const magic = sprite.magic;
    const belongCharacter = this.charHelper.getBelongCharacter(sprite.belongCharacterId);

    // 通知战斗
    character.toFightingState();
    character.notifyFighterAndAllNeighbor(belongCharacter);

    // 禁止移动
    if (magic.disableMoveMilliseconds > 0) {
      character.disableMoveMilliseconds = magic.disableMoveMilliseconds;
    }

    // 禁止技能
    if (magic.disableSkillMilliseconds > 0) {
      character.disableSkillMilliseconds = magic.disableSkillMilliseconds;
    }

    // 弹飞效果
    if (magic.bounceFly > 0) {
      this.handleBounceFly(sprite, character, magic, belongCharacter);
    }

    // 标记是否需要销毁
    let shouldDestroy = true;

    // Sticky 粘附效果 - 武功命中后粘住目标角色，使其跟随武功精灵移动
    // C# Reference: MagicSprite.CharacterHited - if (BelongMagic.Sticky > 0)
    if (magic.sticky > 0) {
      shouldDestroy = false;
      character.standingImmediately();
      character.movedByMagicSprite = sprite;
      sprite.stickedCharacterId = charId;
      // 如果有 MoveBack 且尚未进入回拉状态
      if (magic.moveBack > 0 && !sprite.isInMoveBack) {
        sprite.isInMoveBack = true;
      }
      logger.log(
        `[CollisionHandler] Sticky: ${sprite.magic.name} sticked to ${character.name}, isInMoveBack=${sprite.isInMoveBack}`
      );
    }

    // Parasitic 寄生效果 - 武功寄生在目标身上，持续跟随并造成伤害
    // C# Reference: MagicSprite.CharacterHited - if (BelongMagic.Parasitic > 0)
    if (magic.parasitic > 0) {
      sprite.parasitiferCharacterId = charId;
      shouldDestroy = true; // 寄生后进入销毁状态，但不真正销毁
      logger.log(
        `[CollisionHandler] Parasitic: ${sprite.magic.name} parasitized on ${character.name}`
      );
    }

    // 变换阵营
    if (magic.changeToFriendMilliseconds > 0 && magic.maxLevel >= character.level) {
      character.changeToOpposite(magic.changeToFriendMilliseconds);
    }

    // 弱化效果
    if (magic.weakMilliseconds > 0) {
      character.weakBy(sprite);
    }

    // 变身效果
    if (magic.morphMilliseconds > 0) {
      character.morphBy(sprite);
    }

    // 特殊效果
    this.applySpecialKindEffects(sprite, character, magic, belongCharacter);

    // 调用 apply（伤害计算）
    const effect = getEffect(sprite.magic.moveKind);
    let actualDamage = 0;
    if (effect?.apply) {
      const applyCtx = this.callbacks.createApplyContext(sprite, charRef);
      if (applyCtx) {
        actualDamage = effect.apply(applyCtx) ?? 0;
        this.handleExpOnHit(sprite, character, wasAliveBeforeHit);
      }
    }

    // 吸血效果
    this.handleRestoreOnHit(sprite, character, magic, belongCharacter, actualDamage);

    // 被攻击时自动使用武功
    this.handleMagicToUseWhenBeAttacked(sprite, character, belongCharacter);

    // 处理穿透或销毁
    // C# Reference: 穿透不销毁，粘附不销毁，寄生时只进入销毁动画但不真正销毁
    if (sprite.magic.passThrough > 0) {
      if (sprite.magic.vanishImage) {
        this.callbacks.createHitEffect(sprite);
      }
    } else if (sprite.stickedCharacterId !== null) {
      // Sticky 粘附状态，不销毁
    } else if (sprite.parasitiferCharacterId !== null) {
      // Parasitic 寄生状态：进入销毁动画但不立即销毁
      // C# Reference: 寄生后 destroy=true 但 _parasitiferCharacter != null 时不真正销毁
      // 动画会无限播放，直到目标死亡或达到最大伤害
      this.callbacks.startDestroyAnimation(sprite);
    } else if (shouldDestroy) {
      this.callbacks.startDestroyAnimation(sprite);
    }

    return true;
  }

  /**
   * 应用特殊效果
   */
  private applySpecialKindEffects(
    _sprite: MagicSprite,
    character: Character,
    magic: MagicData,
    belongCharacter: Character | null
  ): void {
    // SpecialKind 效果
    switch (magic.specialKind) {
      case 1: // 冰冻
        {
          const seconds =
            magic.specialKindMilliSeconds > 0
              ? magic.specialKindMilliSeconds / 1000
              : magic.effectLevel + 1;
          character.setFrozenSeconds(seconds, magic.noSpecialKindEffect === 0);
        }
        break;
      case 2: // 中毒
        {
          const seconds =
            magic.specialKindMilliSeconds > 0
              ? magic.specialKindMilliSeconds / 1000
              : magic.effectLevel + 1;
          character.setPoisonSeconds(seconds, magic.noSpecialKindEffect === 0);
          if (belongCharacter && (belongCharacter.isPlayer || belongCharacter.isPartner)) {
            character.poisonByCharacterName = belongCharacter.name;
          }
        }
        break;
      case 3: // 石化
        {
          const seconds =
            magic.specialKindMilliSeconds > 0
              ? magic.specialKindMilliSeconds / 1000
              : magic.effectLevel + 1;
          character.setPetrifySeconds(seconds, magic.noSpecialKindEffect === 0);
        }
        break;
    }

    // AdditionalEffect 效果
    switch (magic.additionalEffect) {
      case 1:
        if (!character.isFrozened) {
          const seconds = (belongCharacter?.level ?? 1) / 10 + 1;
          character.setFrozenSeconds(seconds, magic.noSpecialKindEffect === 0);
        }
        break;
      case 2:
        if (!character.isPoisoned) {
          const seconds = (belongCharacter?.level ?? 1) / 10 + 1;
          character.setPoisonSeconds(seconds, magic.noSpecialKindEffect === 0);
          if (belongCharacter && (belongCharacter.isPlayer || belongCharacter.isPartner)) {
            character.poisonByCharacterName = belongCharacter.name;
          }
        }
        break;
      case 3:
        if (!character.isPetrified) {
          const seconds = (belongCharacter?.level ?? 1) / 10 + 1;
          character.setPetrifySeconds(seconds, magic.noSpecialKindEffect === 0);
        }
        break;
    }
  }

  /**
   * 处理命中时的经验
   */
  private handleExpOnHit(sprite: MagicSprite, target: Character, wasAliveBeforeHit: boolean): void {
    const belongCharacter = this.charHelper.getBelongCharacter(sprite.belongCharacterId);
    if (!belongCharacter) return;

    const isPlayerCaster = belongCharacter.isPlayer;
    const isFighterFriend = belongCharacter.isFighterFriend;
    const isPartner = belongCharacter.isPartner;

    if (!isPlayerCaster && !isFighterFriend) return;

    let isSummonedByPlayerOrPartner = false;
    if (belongCharacter.summonedByMagicSprite !== null) {
      const summonerId = belongCharacter.summonedByMagicSprite.belongCharacterId;
      if (summonerId === "player") {
        isSummonedByPlayerOrPartner = true;
      } else {
        const summoner = this.charHelper.getBelongCharacter(summonerId);
        if (summoner?.isPartner) {
          isSummonedByPlayerOrPartner = true;
        }
      }
    }

    const isControledByPlayer =
      belongCharacter.controledMagicSprite !== null &&
      belongCharacter.controledMagicSprite.belongCharacterId === "player";

    const isKill = wasAliveBeforeHit && (target.isDeathInvoked || target.isDeath);

    if (isKill) {
      if (isPlayerCaster || isPartner || isSummonedByPlayerOrPartner || isControledByPlayer) {
        const exp = Character.getCharacterDeathExp(this.player, target);
        logger.log(`[CollisionHandler] Kill! Player gains ${exp} exp`);
        this.player.addExp(exp, true);

        if (belongCharacter.canLevelUp > 0) {
          let shouldGiveNpcExp = isPartner;
          if (
            !shouldGiveNpcExp &&
            isSummonedByPlayerOrPartner &&
            belongCharacter.summonedByMagicSprite
          ) {
            const summonerId = belongCharacter.summonedByMagicSprite.belongCharacterId;
            const summoner = this.charHelper.getBelongCharacter(summonerId);
            shouldGiveNpcExp = summoner?.isPartner ?? false;
          }
          if (shouldGiveNpcExp) {
            const npcExp = Character.getCharacterDeathExp(belongCharacter, target);
            belongCharacter.addExp(npcExp);
            logger.log(
              `[CollisionHandler] Partner/Summon ${belongCharacter.name} gains ${npcExp} exp`
            );
          }
        }
      }

      this.handleMagicToUseWhenKillEnemy(sprite, target);
    }

    if (isPlayerCaster) {
      const currentMagicInfo = this.magicListManager.getCurrentMagicInUse();
      if (currentMagicInfo?.magic?.fileName) {
        const magicExp = this.magicListManager.getMagicExp(target.level);
        if (magicExp > 0) {
          this.magicListManager.addMagicExp(currentMagicInfo.magic.fileName, magicExp);
          logger.log(
            `[CollisionHandler] Magic "${currentMagicInfo.magic?.name}" gains ${magicExp} hit exp`
          );
        }
      }
    }
  }

  /**
   * 处理吸血效果
   */
  private handleRestoreOnHit(
    _sprite: MagicSprite,
    _character: Character,
    magic: MagicData,
    belongCharacter: Character | null,
    actualDamage: number
  ): void {
    if (magic.restoreProbability > 0 && actualDamage > 0 && belongCharacter) {
      const roll = Math.floor(Math.random() * 100);
      if (roll < magic.restoreProbability) {
        const restoreAmount = Math.floor((actualDamage * magic.restorePercent) / 100);
        if (restoreAmount > 0) {
          switch (magic.restoreType) {
            case 0:
              belongCharacter.addLife(restoreAmount);
              break;
            case 1:
              belongCharacter.addMana(restoreAmount);
              break;
            case 2:
              belongCharacter.addThew(restoreAmount);
              break;
          }
        }
      }
    }
  }

  /**
   * 处理击杀敌人时使用的武功
   */
  private handleMagicToUseWhenKillEnemy(sprite: MagicSprite, killedTarget: Character): void {
    if (!sprite.magic.magicToUseWhenKillEnemy) return;

    const belongCharacter = this.charHelper.getBelongCharacter(sprite.belongCharacterId);
    if (!belongCharacter) return;

    loadMagic(sprite.magic.magicToUseWhenKillEnemy)
      .then((baseMagic) => {
        if (!baseMagic) return;
        const magic = getMagicAtLevel(baseMagic, belongCharacter.level);

        let destination: Vector2;
        const dirType = sprite.magic.magicDirectionWhenKillEnemy || 0;

        if (dirType === 1) {
          destination = this.charHelper.getPositionInDirection(
            killedTarget.pixelPosition,
            killedTarget.currentDirection
          );
        } else if (dirType === 2) {
          destination = this.charHelper.getPositionInDirection(
            killedTarget.pixelPosition,
            belongCharacter.currentDirection
          );
        } else {
          destination = { ...belongCharacter.pixelPosition };
        }

        this.callbacks.useMagic({
          userId: sprite.belongCharacterId,
          magic,
          origin: killedTarget.pixelPosition,
          destination,
        });

        logger.log(
          `[CollisionHandler] MagicToUseWhenKillEnemy triggered: ${sprite.magic.magicToUseWhenKillEnemy}`
        );
      })
      .catch((err) => {
        logger.error(`[CollisionHandler] Failed to load MagicToUseWhenKillEnemy: ${err}`);
      });
  }

  /**
   * 处理被攻击时使用的武功
   */
  private handleMagicToUseWhenBeAttacked(
    sprite: MagicSprite,
    target: Character,
    attacker: Character | null
  ): void {
    if (target.magicToUseWhenBeAttacked) {
      if (target.isPlayer && this.player) {
        loadMagic(target.magicToUseWhenBeAttacked)
          .then((baseMagic) => {
            if (!baseMagic) return;
            const magic = getMagicAtLevel(baseMagic, target.level);
            this.triggerBeAttackedMagic(
              sprite,
              target,
              attacker,
              magic,
              target.magicDirectionWhenBeAttacked
            );
          })
          .catch((err) => {
            logger.error(`[CollisionHandler] Failed to load MagicToUseWhenBeAttacked: ${err}`);
          });
      } else {
        const npc = target as { _magicToUseWhenBeAttackedData?: MagicData };
        if (npc._magicToUseWhenBeAttackedData) {
          this.triggerBeAttackedMagic(
            sprite,
            target,
            attacker,
            npc._magicToUseWhenBeAttackedData,
            target.magicDirectionWhenBeAttacked
          );
        }
      }
    }

    for (const info of target.magicToUseWhenAttackedList) {
      this.triggerBeAttackedMagic(sprite, target, attacker, info.magic, info.dir);
    }
  }

  /**
   * 触发被攻击武功
   */
  private triggerBeAttackedMagic(
    sprite: MagicSprite,
    character: Character,
    attacker: Character | null,
    magic: MagicData,
    dirType: number
  ): void {
    let destination: Vector2;
    let target: Character | null = null;

    switch (dirType) {
      case 0:
        if (attacker) {
          destination = { ...attacker.pixelPosition };
          target = attacker;
        } else {
          destination = { ...character.pixelPosition };
        }
        break;
      case 1:
        if (sprite.velocity > 0 && (sprite.direction.x !== 0 || sprite.direction.y !== 0)) {
          destination = {
            x: character.pixelPosition.x - sprite.direction.x * 32,
            y: character.pixelPosition.y - sprite.direction.y * 32,
          };
        } else {
          destination = this.charHelper.getPositionInDirection(
            character.pixelPosition,
            character.currentDirection
          );
        }
        break;
      default:
        destination = this.charHelper.getPositionInDirection(
          character.pixelPosition,
          character.currentDirection
        );
        break;
    }

    const charId = character.isPlayer ? "player" : (character as Npc).id;
    const targetId = target ? (target.isPlayer ? "player" : (target as Npc).id) : undefined;

    this.callbacks.useMagic({
      userId: charId,
      magic,
      origin: character.pixelPosition,
      destination,
      targetId,
    });

    logger.log(
      `[CollisionHandler] MagicToUseWhenBeAttacked triggered: ${magic.name} (dir=${dirType})`
    );
  }

  /**
   * 处理弹飞效果
   */
  private handleBounceFly(
    sprite: MagicSprite,
    character: Character,
    magic: MagicData,
    belongCharacter: Character | null
  ): void {
    let direction = sprite.direction;
    if (direction.x === 0 && direction.y === 0) {
      direction = {
        x: character.positionInWorld.x - sprite.position.x,
        y: character.positionInWorld.y - sprite.position.y,
      };
    }

    if (direction.x === 0 && direction.y === 0) return;

    const endTile = findDistanceTileInDirection(character.tilePosition, direction, magic.bounceFly);

    const bounceFlyDirection = { ...direction };

    character.bezierMoveTo(endTile, magic.bounceFlySpeed, (cha) => {
      if (magic.bounceFlyEndMagic) {
        this.triggerBounceFlyEndMagic(
          magic.bounceFlyEndMagic,
          cha,
          belongCharacter,
          magic.magicDirectionWhenBounceFlyEnd,
          sprite.belongCharacterId
        );
      }

      if (magic.bounceFlyEndHurt > 0) {
        cha.takeDamage(magic.bounceFlyEndHurt, belongCharacter);
      }

      if (magic.bounceFlyTouchHurt > 0) {
        this.handleBounceFlyTouchHurt(
          cha,
          belongCharacter,
          bounceFlyDirection,
          magic.bounceFly,
          magic.bounceFlySpeed,
          magic.bounceFlyTouchHurt
        );
      }
    });
  }

  /**
   * 触发弹飞结束武功
   */
  private async triggerBounceFlyEndMagic(
    magicFile: string,
    character: Character,
    belongCharacter: Character | null,
    directionMode: number,
    userId: string
  ): Promise<void> {
    try {
      const magic = await loadMagic(magicFile);
      if (!magic) {
        logger.warn(`[CollisionHandler] Failed to load bounceFlyEndMagic: ${magicFile}`);
        return;
      }

      let pos = belongCharacter?.positionInWorld ?? character.positionInWorld;

      if (directionMode === 1) {
        const charDir = getDirection8(character.currentDirection);
        const charDirOffset = getDirectionOffset8(charDir);
        pos = {
          x: character.positionInWorld.x + charDirOffset.x,
          y: character.positionInWorld.y + charDirOffset.y,
        };
      } else if (directionMode === 2 && belongCharacter) {
        const belongDir = getDirection8(belongCharacter.currentDirection);
        const belongDirOffset = getDirectionOffset8(belongDir);
        pos = {
          x: character.positionInWorld.x + belongDirOffset.x,
          y: character.positionInWorld.y + belongDirOffset.y,
        };
      }

      this.callbacks.useMagic({
        magic: getMagicAtLevel(magic, 1),
        origin: character.positionInWorld,
        destination: pos,
        userId,
      });
    } catch (error) {
      logger.error(`[CollisionHandler] Error loading bounceFlyEndMagic: ${magicFile}`, error);
    }
  }

  /**
   * 处理弹飞触碰伤害
   */
  private handleBounceFlyTouchHurt(
    character: Character,
    belongCharacter: Character | null,
    direction: Vector2,
    bounceFly: number,
    bounceFlySpeed: number,
    bounceFlyTouchHurt: number
  ): void {
    const neighbors = getNeighbors(character.tilePosition);
    neighbors.push(character.tilePosition);

    for (const neighbor of neighbors) {
      const fighter = this.npcManager.getFighter(neighbor.x, neighbor.y);
      if (
        fighter &&
        fighter !== character &&
        belongCharacter &&
        NpcManager.isEnemy(fighter, belongCharacter)
      ) {
        const touchEndTile = findDistanceTileInDirection(
          fighter.tilePosition,
          direction,
          bounceFly
        );
        fighter.bezierMoveTo(touchEndTile, bounceFlySpeed, undefined);

        character.takeDamage(bounceFlyTouchHurt, belongCharacter);
        fighter.takeDamage(bounceFlyTouchHurt, belongCharacter);
      }
    }
  }

  /**
   * 检查武功是否可以被抵消
   */
  private canDiscard(sprite: MagicSprite): boolean {
    const excludedKinds = [13, 15, 21, 23];
    return !excludedKinds.includes(sprite.magic.moveKind);
  }

  /**
   * 检查武功是否可以被交换使用者
   */
  private canExchangeUser(sprite: MagicSprite): boolean {
    const excludedKinds = [13, 15, 20, 21, 22, 23];
    return !excludedKinds.includes(sprite.magic.moveKind);
  }

  /**
   * 检查两个角色是否敌对
   */
  private isOpposite(a: Character, b: Character): boolean {
    if (b.isEnemy) {
      return a.isPlayer || a.isFighterFriend || a.isNoneFighter;
    } else if (b.isPlayer || b.isFighterFriend) {
      return a.isEnemy || a.isNoneFighter;
    } else if (b.isNoneFighter) {
      return a.isPlayer || a.isFighterFriend || a.isEnemy;
    }
    return false;
  }

  /**
   * 检查两个武功精灵是否敌对
   */
  private isOppositeSprite(sprite: MagicSprite, other: MagicSprite): boolean {
    const belongA = this.charHelper.getBelongCharacter(sprite.belongCharacterId);
    const belongB = this.charHelper.getBelongCharacter(other.belongCharacterId);
    if (!belongA || !belongB) return false;
    return this.isOpposite(belongA, belongB);
  }

  /**
   * 检查武功抵消
   */
  private checkMagicDiscard(sprite: MagicSprite): boolean {
    if ((sprite.magic.discardOppositeMagic ?? 0) <= 0) return false;

    const tileX = sprite.tilePosition.x;
    const tileY = sprite.tilePosition.y;

    for (const [, other] of this.state.magicSprites) {
      if (other === sprite || other.isDestroyed || other.isInDestroy) continue;

      const otherTileX = other.tilePosition.x;
      const otherTileY = other.tilePosition.y;

      if (
        otherTileX === tileX &&
        otherTileY === tileY &&
        this.isOppositeSprite(sprite, other) &&
        this.canDiscard(other)
      ) {
        other.isDestroyed = true;
        sprite.isDestroyed = true;
        logger.log(`[CollisionHandler] Magic discard: ${sprite.magic.name} vs ${other.magic.name}`);
        return true;
      }
    }
    return false;
  }

  /**
   * 检查武功交换使用者
   */
  private checkMagicExchangeUser(sprite: MagicSprite): boolean {
    if ((sprite.magic.exchangeUser ?? 0) <= 0) return false;

    const tileX = sprite.tilePosition.x;
    const tileY = sprite.tilePosition.y;

    for (const [, other] of this.state.magicSprites) {
      if (other === sprite || other.isDestroyed || other.isInDestroy) continue;

      const otherTileX = other.tilePosition.x;
      const otherTileY = other.tilePosition.y;

      if (
        otherTileX === tileX &&
        otherTileY === tileY &&
        this.isOppositeSprite(sprite, other) &&
        this.canExchangeUser(other)
      ) {
        other.belongCharacterId = sprite.belongCharacterId;
        const newDirX = other.direction.x * other.velocity + sprite.direction.x * sprite.velocity;
        const newDirY = other.direction.y * other.velocity + sprite.direction.y * sprite.velocity;
        const newVel = Math.sqrt(newDirX * newDirX + newDirY * newDirY);
        if (newVel > 0) {
          other.setDirection({ x: newDirX / newVel, y: newDirY / newVel });
          other.velocity = newVel;
        }
        sprite.isDestroyed = true;
        logger.log(
          `[CollisionHandler] Magic exchange user: ${sprite.magic.name} -> ${other.magic.name}`
        );
      }
    }
    return false;
  }
}
