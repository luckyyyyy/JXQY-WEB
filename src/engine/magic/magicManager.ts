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

import type { AudioManager } from "../audio";
import { Character } from "../character/character";
import type { Npc } from "../character/npc";
import type { NpcManager } from "../character/npcManager";
import { getEngineContext } from "../core/engineContext";
import { logger } from "../core/logger";
import type { Vector2 } from "../core/types";
import { pixelToTile, tileToPixel } from "../core/utils";
import type { ScreenEffects } from "../effects";
import type { GuiManager } from "../gui/guiManager";
import type { MagicListManager } from "../player/magic/magicListManager";
import type { Player } from "../player/player";
// 效果系统
import {
  type ApplyContext,
  type CastContext,
  type CharacterRef,
  type EndContext,
  getPosition as getCharPosition,
  getEffect,
  getEffectAmount,
} from "./effects";
import { getMagicAtLevel, loadMagic } from "./magicLoader";
import { magicRenderer } from "./magicRenderer";
import { MagicSprite, resetMagicSpriteIdCounter, type WorkItem } from "./magicSprite";
import {
  getDirection8,
  getDirection32List,
  getDirectionIndex,
  getDirectionOffset8,
  getSpeedRatio,
  MAGIC_BASE_SPEED,
  normalizeVector,
} from "./magicUtils";
import type { MagicData, UseMagicParams } from "./types";
import { MagicMoveKind } from "./types";

/**
 * MagicManager 构造函数参数
 */
export interface MagicManagerDeps {
  player: Player;
  npcManager: NpcManager;
  guiManager: GuiManager;
  screenEffects: ScreenEffects;
  audioManager: AudioManager;
  magicListManager: MagicListManager;
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

  // 精灵索引计数器
  private spriteIndex: number = 0;

  // SuperMode 状态
  private _isInSuperMagicMode: boolean = false;
  private _superModeMagicSprite: MagicSprite | null = null;

  // TimeStop 状态
  private _timeStopperMagicSprite: MagicSprite | null = null;

  // 直接注入的依赖
  private player: Player;
  private npcManager: NpcManager;
  private guiManager: GuiManager;
  private screenEffects: ScreenEffects;
  private audioManager: AudioManager;
  private magicListManager: MagicListManager;

  // 精灵销毁事件监听器
  private onSpriteDestroyedListeners: ((sprite: MagicSprite) => void)[] = [];

  constructor(deps: MagicManagerDeps) {
    this.player = deps.player;
    this.npcManager = deps.npcManager;
    this.guiManager = deps.guiManager;
    this.screenEffects = deps.screenEffects;
    this.audioManager = deps.audioManager;
    this.magicListManager = deps.magicListManager;
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
    // 使用 getNpcById 而不是 getNpc（后者是按名称查找）
    const npc = this.npcManager.getNpcById(characterId);
    if (npc) {
      return { type: "npc", npc, id: characterId };
    }
    return null;
  }

  /**
   * 根据 ID 获取 Character 对象
   * 用于需要直接访问 Character 属性和方法的场景
   */
  private getCharacter(characterId: string): Character | null {
    if (characterId === "player") {
      return this.player;
    }
    return this.npcManager.getNpcById(characterId) ?? null;
  }

  /**
   * 从 CharacterRef 获取实际的 Character 对象
   */
  private getCharacterFromRef(ref: CharacterRef): Character {
    return ref.type === "player" ? ref.player : ref.npc;
  }

  /**
   * 获取角色位置
   */
  private getCharacterPosition(characterId: string): Vector2 | null {
    const ref = this.getCharacterRef(characterId);
    return ref ? getCharPosition(ref) : null;
  }

  /**
   * 获取施法者角色
   */
  private getBelongCharacter(characterId: string): Character | null {
    if (characterId === "player") return this.player;
    // 使用 getNpcById 而不是 getNpc，因为 characterId 是 NPC 的唯一 ID，不是名字
    return this.npcManager.getNpcById(characterId) ?? null;
  }

  /**
   * 处理命中时的经验
   * C# Reference: MagicSprite.CharacterHited - 经验处理部分
   */
  private handleExpOnHit(sprite: MagicSprite, target: Character, wasAliveBeforeHit: boolean): void {
    // C# Reference: 只有玩家或玩家友军才会处理经验
    // if (BelongCharacter.IsPlayer || BelongCharacter.IsFighterFriend)
    const belongCharacter = this.getBelongCharacter(sprite.belongCharacterId);
    if (!belongCharacter) return;

    const isPlayerCaster = belongCharacter.isPlayer;
    const isFighterFriend = belongCharacter.isFighterFriend;
    const isPartner = belongCharacter.isPartner;

    // 只有玩家或玩家友军才处理经验
    if (!isPlayerCaster && !isFighterFriend) return;

    // C#: 检查是否是玩家或伙伴召唤的
    // var isSummonedByPlayerorPartner = (BelongCharacter.SummonedByMagicSprite != null &&
    //    (BelongCharacter.SummonedByMagicSprite.BelongCharacter.IsPlayer ||
    //     BelongCharacter.SummonedByMagicSprite.BelongCharacter.IsPartner));
    let isSummonedByPlayerOrPartner = false;
    if (belongCharacter.summonedByMagicSprite !== null) {
      const summonerId = belongCharacter.summonedByMagicSprite.belongCharacterId;
      if (summonerId === "player") {
        isSummonedByPlayerOrPartner = true;
      } else {
        const summoner = this.getBelongCharacter(summonerId);
        if (summoner?.isPartner) {
          isSummonedByPlayerOrPartner = true;
        }
      }
    }

    // C#: 检查是否被玩家控制
    // var isControledByPlayer = (BelongCharacter.ControledMagicSprite != null &&
    //    BelongCharacter.ControledMagicSprite.BelongCharacter.IsPlayer);
    const isControledByPlayer = belongCharacter.controledMagicSprite !== null &&
      belongCharacter.controledMagicSprite.belongCharacterId === "player";

    // 检查是否击杀
    const isKill = wasAliveBeforeHit && (target.isDeathInvoked || target.isDeath);

    if (isKill) {
      // C# Reference: 击杀敌人给玩家经验
      // if (BelongCharacter.IsPlayer || BelongCharacter.IsPartner || isSummonedByPlayerorPartner || isControledByPlayer)
      //   var exp = Utils.GetCharacterDeathExp(Globals.ThePlayer, character);
      //   player.AddExp(exp, true);
      if (isPlayerCaster || isPartner || isSummonedByPlayerOrPartner || isControledByPlayer) {
        const exp = Character.getCharacterDeathExp(this.player, target);
        logger.log(`[MagicManager] Kill! Player gains ${exp} exp`);
        this.player.addExp(exp, true);

        // C# Reference: 伙伴也可以升级
        // if (BelongCharacter.CanLevelUp > 0 &&
        //     ((isSummonedByPlayerorPartner && BelongCharacter.SummonedByMagicSprite.BelongCharacter.IsPartner) ||
        //      BelongCharacter.IsPartner))
        //   var npcExp = Utils.GetCharacterDeathExp(BelongCharacter, character);
        //   BelongCharacter.AddExp(npcExp);
        if (belongCharacter.canLevelUp > 0) {
          // 检查是伙伴，或者是伙伴召唤的
          let shouldGiveNpcExp = isPartner;
          if (!shouldGiveNpcExp && isSummonedByPlayerOrPartner && belongCharacter.summonedByMagicSprite) {
            const summonerId = belongCharacter.summonedByMagicSprite.belongCharacterId;
            const summoner = this.getBelongCharacter(summonerId);
            shouldGiveNpcExp = summoner?.isPartner ?? false;
          }
          if (shouldGiveNpcExp) {
            const npcExp = Character.getCharacterDeathExp(belongCharacter, target);
            belongCharacter.addExp(npcExp);
            logger.log(`[MagicManager] Partner/Summon ${belongCharacter.name} gains ${npcExp} exp`);
          }
        }
      }

      // C# Reference: MagicSprite.CharacterHited - MagicToUseWhenKillEnemy
      this.handleMagicToUseWhenKillEnemy(sprite, target);
    }

    // C#: 武功命中也给武功经验（无论是否击杀）
    // 只对玩家生效
    if (isPlayerCaster) {
      const currentMagicInfo = this.magicListManager.getCurrentMagicInUse();
      if (currentMagicInfo?.magic?.fileName) {
        const magicExp = this.magicListManager.getMagicExp(target.level);
        if (magicExp > 0) {
          this.magicListManager.addMagicExp(currentMagicInfo.magic.fileName, magicExp);
          logger.log(
            `[MagicManager] Magic "${currentMagicInfo.magic?.name}" gains ${magicExp} hit exp`
          );
        }
      }
    }
  }

  /**
   * 处理击杀敌人时使用的武功
   * C# Reference: MagicSprite.CharacterHited - MagicToUseWhenKillEnemy
   */
  private handleMagicToUseWhenKillEnemy(sprite: MagicSprite, killedTarget: Character): void {
    if (!sprite.magic.magicToUseWhenKillEnemy) return;

    const belongCharacter = this.getBelongCharacter(sprite.belongCharacterId);
    if (!belongCharacter) return;

    // 获取击杀武功
    // Note: 需要异步加载武功数据
    loadMagic(sprite.magic.magicToUseWhenKillEnemy).then((baseMagic) => {
      if (!baseMagic) return;
      // 使用施法者的等级，而不是玩家的等级
      const magic = getMagicAtLevel(baseMagic, belongCharacter.level);

      // C# Reference: MagicDirectionWhenKillEnemy
      // 0 = 施法者位置, 1 = 被击杀者朝向, 2 = 施法者朝向
      let destination: Vector2;
      const dirType = sprite.magic.magicDirectionWhenKillEnemy || 0;

      if (dirType === 1) {
        // 被击杀者当前朝向
        destination = this.getPositionInDirection(killedTarget.pixelPosition, killedTarget.currentDirection);
      } else if (dirType === 2) {
        // 施法者当前朝向
        destination = this.getPositionInDirection(killedTarget.pixelPosition, belongCharacter.currentDirection);
      } else {
        // 施法者位置（默认）
        destination = { ...belongCharacter.pixelPosition };
      }

      this.useMagic({
        userId: sprite.belongCharacterId,
        magic,
        origin: killedTarget.pixelPosition,
        destination,
      });

      logger.log(`[MagicManager] MagicToUseWhenKillEnemy triggered: ${sprite.magic.magicToUseWhenKillEnemy}`);
    }).catch((err) => {
      logger.error(`[MagicManager] Failed to load MagicToUseWhenKillEnemy: ${err}`);
    });
  }

  /**
   * 根据方向计算目标位置
   */
  private getPositionInDirection(origin: Vector2, direction: number): Vector2 {
    const dirOffsets = [
      { x: 0, y: 32 },    // 0: South
      { x: -23, y: 23 },  // 1: SouthWest
      { x: -32, y: 0 },   // 2: West
      { x: -23, y: -23 }, // 3: NorthWest
      { x: 0, y: -32 },   // 4: North
      { x: 23, y: -23 },  // 5: NorthEast
      { x: 32, y: 0 },    // 6: East
      { x: 23, y: 23 },   // 7: SouthEast
    ];
    const offset = dirOffsets[direction] || { x: 0, y: 32 };
    return {
      x: origin.x + offset.x,
      y: origin.y + offset.y,
    };
  }

  /**
   * 处理被攻击时使用的武功
   * C# Reference: MagicSprite.CharacterHited - MagicToUseWhenBeAttacked
   *
   * enum BeAttackedUseMagicDirection:
   * - Attacker (0): 攻击者位置
   * - MagicSpriteOppDirection (1): 武功精灵反方向
   * - CurrentNpcDirection (2): NPC 当前朝向
   */
  private handleMagicToUseWhenBeAttacked(
    sprite: MagicSprite,
    target: Character,
    attacker: Character | null
  ): void {
    if (!target.magicToUseWhenBeAttacked) return;

    // 获取武功数据（NPC 已预加载，Player 需要加载）
    let magicData: MagicData | null = null;
    if (target.isPlayer && this.player) {
      // Player 的 magicToUseWhenBeAttacked 需要动态加载
      loadMagic(target.magicToUseWhenBeAttacked).then((baseMagic) => {
        if (!baseMagic) return;
        const magic = getMagicAtLevel(baseMagic, target.level);
        this.triggerBeAttackedMagic(sprite, target, attacker, magic);
      }).catch((err) => {
        logger.error(`[MagicManager] Failed to load MagicToUseWhenBeAttacked: ${err}`);
      });
    } else {
      // NPC 的武功数据可能已预加载
      const npc = target as { _magicToUseWhenBeAttackedData?: MagicData };
      if (npc._magicToUseWhenBeAttackedData) {
        this.triggerBeAttackedMagic(sprite, target, attacker, npc._magicToUseWhenBeAttackedData);
      }
    }
  }

  /**
   * 触发被攻击武功
   */
  private triggerBeAttackedMagic(
    sprite: MagicSprite,
    character: Character,
    attacker: Character | null,
    magic: MagicData
  ): void {
    // C#: BeAttackedUseMagicDirection
    // 0 = Attacker, 1 = MagicSpriteOppDirection, 2 = CurrentNpcDirection
    const dirType = character.magicDirectionWhenBeAttacked;
    let destination: Vector2;
    let target: Character | null = null;

    switch (dirType) {
      case 0: // Attacker - 攻击者位置
        if (attacker) {
          destination = { ...attacker.pixelPosition };
          target = attacker;
        } else {
          destination = { ...character.pixelPosition };
        }
        break;

      case 1: // MagicSpriteOppDirection - 武功精灵反方向
        // C#: RealMoveDirection == Vector2.Zero
        //       ? (character.PositionInWorld + Utils.GetDirection8(character.CurrentDirection))
        //       : (character.PositionInWorld - RealMoveDirection)
        if (sprite.velocity > 0 && (sprite.direction.x !== 0 || sprite.direction.y !== 0)) {
          // 武功精灵反方向
          destination = {
            x: character.pixelPosition.x - sprite.direction.x * 32,
            y: character.pixelPosition.y - sprite.direction.y * 32,
          };
        } else {
          // 无移动方向，使用角色当前朝向
          destination = this.getPositionInDirection(character.pixelPosition, character.currentDirection);
        }
        break;

      case 2: // CurrentNpcDirection - NPC 当前朝向
      default:
        destination = this.getPositionInDirection(character.pixelPosition, character.currentDirection);
        break;
    }

    // 获取角色 ID
    const charId = character.isPlayer ? "player" : (character as Npc).id;
    const targetId = target ? (target.isPlayer ? "player" : (target as Npc).id) : undefined;

    this.useMagic({
      userId: charId,
      magic,
      origin: character.pixelPosition,
      destination,
      targetId,
    });

    logger.log(`[MagicManager] MagicToUseWhenBeAttacked triggered: ${magic.name}`);
  }

  /**
   * 获取视野内的敌人（用于 SuperMode）
   * C# Reference: MagicSprite.Destroy() - MoveKind == 15 目标选择逻辑
   * 根据施法者身份和 AttackAll 属性决定攻击目标
   */
  private getEnemiesInView(userId: string, magic: MagicData): string[] {
    const targets: string[] = [];
    const npcs = this.npcManager.getAllNpcs();

    // 获取施法者信息
    const belongCharacter = this.getBelongCharacter(userId);
    const isPlayer = userId === "player";
    const isFighterFriend = belongCharacter?.isFighterFriend ?? false;
    const isEnemy = belongCharacter?.isEnemy ?? false;

    // C#: 根据施法者身份和 AttackAll 属性决定目标
    if (magic.attackAll > 0) {
      // AttackAll > 0: 攻击所有战斗者（包括玩家）
      for (const [id, npc] of npcs) {
        if (npc.isFighter && !npc.isDeath && !npc.isDeathInvoked) {
          targets.push(id);
        }
      }
      // C#: targets.Add(Globals.ThePlayer)
      if (userId !== "player") {
        targets.push("player");
      }
    } else if (isPlayer || isFighterFriend) {
      // 玩家或友方: 攻击敌人
      for (const [id, npc] of npcs) {
        if (npc.isEnemy && !npc.isDeath && !npc.isDeathInvoked) {
          targets.push(id);
        }
      }
    } else if (isEnemy) {
      // 敌人: 攻击玩家和友方
      for (const [id, npc] of npcs) {
        if (npc.isFighterFriend && !npc.isDeath && !npc.isDeathInvoked) {
          targets.push(id);
        }
      }
      // C#: targets.Add(Globals.ThePlayer)
      targets.push("player");
    } else {
      // None 关系: 攻击所有非 None 关系的战斗者（包括玩家）
      for (const [id, npc] of npcs) {
        if (npc.isFighter && npc.relation !== 0 && !npc.isDeath && !npc.isDeathInvoked) {
          targets.push(id);
        }
      }
      // C#: targets.Add(Globals.ThePlayer)
      targets.push("player");
    }

    return targets;
  }

  /**
   * 查找最近的敌人
   * C# Reference: NpcManager.GetClosestEnemyTypeCharacter / GetClosestFighter
   */
  private findClosestEnemy(sprite: MagicSprite): string | null {
    const npcs = this.npcManager.getAllNpcs();
    const position = sprite.position;
    const belongerId = sprite.belongCharacterId;

    // 判断施法者类型
    const isPlayerOrFriend =
      belongerId === "player" || (this.npcManager.getNpc(belongerId)?.isFighterFriend ?? false);

    let closestId: string | null = null;
    let closestDist = Infinity;

    for (const [id, npc] of npcs) {
      // 跳过死亡的 NPC
      if (npc.isDeath || npc.isDeathInvoked) continue;

      // 根据施法者类型决定目标
      let isValidTarget = false;
      if (sprite.magic.attackAll > 0) {
        // AttackAll: 攻击所有战斗者
        isValidTarget = npc.isFighter;
      } else if (isPlayerOrFriend) {
        // 玩家或友方: 攻击敌人
        isValidTarget = npc.isEnemy;
      } else {
        // 敌人: 攻击玩家或友方
        isValidTarget = npc.isFighterFriend;
      }

      if (!isValidTarget) continue;

      const npcPos = npc.pixelPosition;
      const dx = npcPos.x - position.x;
      const dy = npcPos.y - position.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < closestDist) {
        closestDist = dist;
        closestId = id;
      }
    }

    // 如果是敌人施放，还要检查玩家
    if (!isPlayerOrFriend && sprite.magic.attackAll === 0) {
      const playerPos = this.player.pixelPosition;
      const dx = playerPos.x - position.x;
      const dy = playerPos.y - position.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < closestDist && !this.player.isDeath) {
        closestId = "player";
      }
    }

    return closestId;
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
  private createApplyContext(sprite: MagicSprite, targetRef: CharacterRef): ApplyContext | null {
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
    logger.log(`[Magic] Screen vibrate intensity ${intensity}`);
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
    const _dirIndex = getDirectionIndex(dir, 8);

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
        this.addHeartMoveMagicSprite(userId, magic, origin, false);
        break;

      case MagicMoveKind.SpiralMove:
        this.addSpiralMoveMagicSprite(userId, magic, origin, destination, false);
        break;

      case MagicMoveKind.SectorMove:
        this.addSectorMoveMagicSprite(userId, magic, origin, destination, false);
        break;

      case MagicMoveKind.RandomSector:
        this.addRandomSectorMoveMagicSprite(userId, magic, origin, destination, false);
        break;

      case MagicMoveKind.FixedWall:
        this.addFixedWallMagicSprite(userId, magic, origin, destination, true);
        break;

      case MagicMoveKind.WallMove:
        this.addWallMoveMagicSprite(userId, magic, origin, destination, false);
        break;

      case MagicMoveKind.FollowCharacter:
      case MagicMoveKind.TimeStop:
        {
          // C#: AddFollowCharacterMagicSprite(user, magic, origin, true, target)
          // targetRef 是 CharacterRef，需要转换为 Character
          const targetChar = targetRef ? this.getCharacterFromRef(targetRef) : undefined;
          sprite =
            this.addFollowCharacterMagicSprite(userId, magic, origin, true, targetChar) ??
            undefined;
        }
        break;

      case MagicMoveKind.SuperMode:
        {
          sprite = this.addSuperModeMagicSprite(userId, magic, origin, true);
          if (sprite) {
            this._isInSuperMagicMode = true;
            this._superModeMagicSprite = sprite;
            logger.log(`[MagicManager] SuperMode activated: ${magic.name}`);
          }
        }
        break;

      case MagicMoveKind.FollowEnemy:
        this.addFollowEnemyMagicSprite(userId, magic, origin, destination, false);
        break;

      case MagicMoveKind.Throw:
        this.addThrowMagicSprite(userId, magic, origin, destination, true);
        break;

      case MagicMoveKind.RegionBased:
        // 根据 Region 值决定具体的区域类型
        this.addRegionBasedMagicSprite(userId, magic, origin, destination, true);
        break;

      case MagicMoveKind.Kind19:
        // 持续留痕武功 - 角色移动时在原位置留下武功
        this.addKind19MagicSprite(userId, magic, origin, true);
        break;

      case MagicMoveKind.Transport:
        // 传送武功
        this.addTransportMagicSprite(userId, magic, destination, true);
        break;

      case MagicMoveKind.PlayerControl:
        // 控制角色武功
        this.addControlCharacterMagicSprite(userId, magic, origin, true, targetRef ?? undefined);
        break;

      case MagicMoveKind.Summon:
        // 召唤 NPC 武功
        this.addSummonMagicSprite(userId, magic, destination, true);
        break;

      case MagicMoveKind.VMove:
        this.addVMoveMagicSprite(userId, magic, origin, destination, false);
        break;

      default:
        logger.warn(`[MagicManager] Unknown MoveKind: ${magic.moveKind}, using SingleMove`);
        this.addSingleMoveMagicSprite(userId, magic, origin, destination, false);
        break;
    }

    if (magic.flyingSound) {
      this.playSound(magic.flyingSound);
    }

    if (magic.vibratingScreen > 0) {
      this.vibrateScreen(magic.vibratingScreen);
    }

    // C# Reference: Magic side effect
    // if (magic.SideEffectProbability > 0 && Globals.TheRandom.Next(0, 100) < magic.SideEffectProbability)
    // 对施法者自己造成副作用伤害
    if (magic.sideEffectProbability > 0) {
      const roll = Math.floor(Math.random() * 100);
      if (roll < magic.sideEffectProbability) {
        const casterChar = this.getBelongCharacter(userId);
        if (casterChar) {
          // C# Reference: var amount = ((GetEffectAmount + GetEffectAmount2 + GetEffectAmount3) * SideEffectPercent) / 100
          const effect1 = getEffectAmount(magic, casterChar, "effect");
          const effect2 = getEffectAmount(magic, casterChar, "effect2");
          const effect3 = getEffectAmount(magic, casterChar, "effect3");
          const totalEffect = effect1 + effect2 + effect3;
          const amount = Math.floor((totalEffect * magic.sideEffectPercent) / 100);

          if (amount > 0) {
            switch (magic.sideEffectType) {
              case 0: // Life - C#: user.DecreaseLifeAddHurt(amount)
                // DecreaseLifeAddHurt 会触发受伤动画，但不是扣自己血时的逻辑
                // 这里只是简单扣血
                casterChar.addLife(-amount);
                break;
              case 1: // Mana
                casterChar.addMana(-amount);
                break;
              case 2: // Thew
                casterChar.addThew(-amount);
                break;
            }
          }
        }
      }
    }
  }

  /**
   * 初始化 MagicSprite 的效果值
   * C# Reference: MagicSprite.Begin() 中使用 GetEffectAmount 计算
   */
  private initializeSpriteEffects(sprite: MagicSprite): void {
    const belongCharacter = this.getBelongCharacter(sprite.belongCharacterId);
    if (!belongCharacter) return;

    // 使用 getEffectAmount 计算（包含 AddMagicEffect 装备加成）
    const effect = getEffectAmount(sprite.magic, belongCharacter, "effect");
    const effect2 = getEffectAmount(sprite.magic, belongCharacter, "effect2");
    const effect3 = getEffectAmount(sprite.magic, belongCharacter, "effect3");

    sprite.initializeEffects(effect, effect2, effect3);
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
        logger.warn(`[MagicManager] Max magic unit reached, skipping ${sprite.magic.name}`);
        return;
      }
    }
    // C# Reference: MagicSprite.Begin() - 使用 GetEffectAmount 初始化效果值
    this.initializeSpriteEffects(sprite);
    this.magicSprites.set(sprite.id, sprite);
    logger.log(`[MagicManager] Added sprite: ${sprite.magic.name} (id=${sprite.id}, userId=${sprite.belongCharacterId}, vel=${sprite.velocity}, pos=${sprite.positionInWorld.x.toFixed(0)},${sprite.positionInWorld.y.toFixed(0)}, tile=${sprite.tilePosition.x},${sprite.tilePosition.y})`);
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
    const sprite = MagicSprite.createMoving(
      userId,
      magic,
      origin,
      destination,
      destroyOnEnd,
      speedRatio
    );
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
      const sprite = MagicSprite.createMoving(
        userId,
        magic,
        origin,
        destination,
        destroyOnEnd,
        speedRatio
      );
      this.addWorkItem(magicDelayMs * i, sprite);
    }
  }

  /**
   * 添加V字移动武功
   * C# Reference: MagicManager.AddVMoveMagicSprite
   * 完全按照 C# 实现，使用 switch-case 处理每个方向
   */
  private addVMoveMagicSprite(
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
    this.addMagicSprite(centerSprite);

    // 两侧武功 - 完全按照 C# 的 switch-case 实现
    // C# 使用 origin - i * offset，我们直接计算
    for (let i = 1; i <= level; i++) {
      let pos1: Vector2;
      let pos2: Vector2;

      switch (directionIndex) {
        case 0:
          // origin - i * new Vector2(32, 16), origin - i * new Vector2(-32, 16)
          pos1 = { x: origin.x - i * 32, y: origin.y - i * 16 };
          pos2 = { x: origin.x + i * 32, y: origin.y - i * 16 };
          break;
        case 1:
          // origin - i * new Vector2(0, 32), origin - i * new Vector2(-64, 0)
          pos1 = { x: origin.x, y: origin.y - i * 32 };
          pos2 = { x: origin.x + i * 64, y: origin.y };
          break;
        case 2:
          // origin - i * new Vector2(-32, 16), origin - i * new Vector2(-32, -16)
          pos1 = { x: origin.x + i * 32, y: origin.y - i * 16 };
          pos2 = { x: origin.x + i * 32, y: origin.y + i * 16 };
          break;
        case 3:
          // origin - i * new Vector2(0, -32), origin - i * new Vector2(-64, 0)
          pos1 = { x: origin.x, y: origin.y + i * 32 };
          pos2 = { x: origin.x + i * 64, y: origin.y };
          break;
        case 4:
          // origin - i * new Vector2(32, -16), origin - i * new Vector2(-32, -16)
          pos1 = { x: origin.x - i * 32, y: origin.y + i * 16 };
          pos2 = { x: origin.x + i * 32, y: origin.y + i * 16 };
          break;
        case 5:
          // origin - i * new Vector2(64, 0), origin - i * new Vector2(0, -32)
          pos1 = { x: origin.x - i * 64, y: origin.y };
          pos2 = { x: origin.x, y: origin.y + i * 32 };
          break;
        case 6:
          // origin - i * new Vector2(32, 16), origin - i * new Vector2(32, -16)
          pos1 = { x: origin.x - i * 32, y: origin.y - i * 16 };
          pos2 = { x: origin.x - i * 32, y: origin.y + i * 16 };
          break;
        default:
          // origin - i * new Vector2(0, 32), origin - i * new Vector2(64, 0)
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
      this.addMagicSprite(sprite1);

      const sprite2 = MagicSprite.createMovingOnDirection(
        userId,
        magic,
        pos2,
        dir,
        destroyOnEnd,
        speedRatio
      );
      this.addMagicSprite(sprite2);
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
      const sprite = MagicSprite.createMovingOnDirection(
        userId,
        magic,
        origin,
        dir,
        destroyOnEnd,
        speedRatio
      );
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
   * 添加心形移动武功
   * C# Reference: MagicManager.AddHeartMoveMagicSprite
   * 向32个方向发射，形成心形轨迹
   */
  private addHeartMoveMagicSprite(
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
      this.addWorkItem(delay, sprite1);

      const sprite2 = MagicSprite.createMovingOnDirection(
        userId,
        magic,
        origin,
        dir2,
        destroyOnEnd,
        getSpeedRatio(dir2)
      );
      this.addWorkItem(delay, sprite2);
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
    this.addWorkItem(16 * delayTime, middleSprite);

    // Second half - contracting
    const secondSprite = MagicSprite.createMovingOnDirection(
      userId,
      magic,
      origin,
      middleDir,
      destroyOnEnd,
      getSpeedRatio(middleDir)
    );
    this.addWorkItem(17 * delayTime, secondSprite);

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
      this.addWorkItem(delay, sprite1);

      const sprite2 = MagicSprite.createMovingOnDirection(
        userId,
        magic,
        origin,
        dir2,
        destroyOnEnd,
        getSpeedRatio(dir2)
      );
      this.addWorkItem(delay, sprite2);
    }

    const finalSprite = MagicSprite.createMovingOnDirection(
      userId,
      magic,
      origin,
      directions[0],
      destroyOnEnd,
      getSpeedRatio(directions[0])
    );
    this.addWorkItem((18 + 15) * delayTime, finalSprite);
  }

  /**
   * 添加螺旋移动武功
   * C# Reference: MagicManager.AddSpiralMoveMagicSprite
   * 向目标方向开始，顺时针螺旋发射32个方向
   */
  private addSpiralMoveMagicSprite(
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
      this.addWorkItem(delay, sprite);
    }
  }

  /**
   * 添加随机扇形移动武功
   * C# Reference: MagicManager.AddRandomSectorMoveMagicSprite
   * 类似扇形移动，但带有随机延迟
   */
  private addRandomSectorMoveMagicSprite(
    userId: string,
    magic: MagicData,
    origin: Vector2,
    destination: Vector2,
    destroyOnEnd: boolean
  ): void {
    const magicDelayMs = 80;
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
    this.addWorkItem(Math.random() < 0.5 ? 0 : magicDelayMs, centerSprite);

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
      this.addWorkItem(Math.random() < 0.5 ? 0 : magicDelayMs, leftSprite);

      const rightSprite = MagicSprite.createMovingOnDirection(
        userId,
        magic,
        origin,
        rightDir,
        destroyOnEnd,
        getSpeedRatio(rightDir)
      );
      this.addWorkItem(Math.random() < 0.5 ? 0 : magicDelayMs, rightSprite);
    }
  }

  /**
   * 添加移动墙武功
   * C# Reference: MagicManager.AddWallMoveMagicSprite
   * 向目标方向移动的一排武功
   */
  private addWallMoveMagicSprite(
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
    this.addMagicSprite(centerSprite);

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
      this.addMagicSprite(sprite1);

      const sprite2 = MagicSprite.createMovingOnDirection(
        userId,
        magic,
        pos2,
        dir,
        destroyOnEnd,
        speedRatio
      );
      this.addMagicSprite(sprite2);
    }
  }

  /**
   * 添加跟随角色武功（BUFF类）
   * C# Reference: MagicManager.AddFollowCharacterMagicSprite
   * 完整实现 SpecialKind 处理
   */
  private addFollowCharacterMagicSprite(
    userId: string,
    magic: MagicData,
    origin: Vector2,
    destroyOnEnd: boolean,
    target?: Character
  ): MagicSprite | null {
    const user = this.getCharacter(userId);
    if (!user) return null;

    // MoveKind == 13: FollowCharacter
    if (magic.moveKind === MagicMoveKind.FollowCharacter) {
      // C#: if (target != null && user.Kind == Player && target.IsFighterFriend) user = target;
      let effectTarget: Character = user;
      if (target && user.isPlayer && target.isFighterFriend) {
        effectTarget = target;
      }

      const sprite = MagicSprite.createFixed(userId, magic, origin, destroyOnEnd);

      // 计算效果值: (magic.Effect == 0 ? user.Attack : magic.Effect) + magic.EffectExt
      const effectAmount =
        (magic.effect === 0 ? effectTarget.attack : magic.effect) + (magic.effectExt ?? 0);

      switch (magic.specialKind) {
        case 1:
          // 加生命
          effectTarget.life += effectAmount;
          this.addMagicSprite(sprite);
          break;

        case 2:
          // 加体力
          effectTarget.thew += effectAmount;
          this.addMagicSprite(sprite);
          break;

        case 3:
        case 6:
          // 持续效果（护体/加属性等）- 检查是否已存在同名效果
          {
            const existingSprite = effectTarget
              .getMagicSpritesInEffect()
              .find((s) => s.magic.name === magic.name && !s.isDestroyed);
            if (existingSprite) {
              // 重置已有效果的播放
              existingSprite.resetPlay();
            } else {
              // 添加新效果
              effectTarget.addMagicSpriteInEffect(sprite);
              this.addMagicSprite(sprite);
            }
          }
          break;

        case 4:
          // 隐身（攻击时现形）
          effectTarget.invisibleByMagicTime = effectAmount;
          effectTarget.isVisibleWhenAttack = false;
          this.addMagicSprite(sprite);
          break;

        case 5:
          // 隐身（攻击时不现形）
          effectTarget.invisibleByMagicTime = effectAmount;
          effectTarget.isVisibleWhenAttack = true;
          this.addMagicSprite(sprite);
          break;

        case 7:
          // 变身
          effectTarget.changeCharacterBy(sprite);
          this.addMagicSprite(sprite);
          break;

        case 8:
          // 解除异常状态
          effectTarget.removeAbnormalState();
          this.addMagicSprite(sprite);
          break;

        case 9:
          // 飞行INI替换
          effectTarget.flyIniChangeBy(sprite);
          this.addMagicSprite(sprite);
          break;

        default:
          // 默认只添加精灵
          this.addMagicSprite(sprite);
          break;
      }

      return sprite;
    }
    // MoveKind == 23: TimeStop
    else if (magic.moveKind === MagicMoveKind.TimeStop) {
      // C#: if (Globals.TheGame.TimeStoperMagicSprite == null)
      if (this._timeStopperMagicSprite === null) {
        const sprite = MagicSprite.createFixed(userId, magic, origin, destroyOnEnd);
        this._timeStopperMagicSprite = sprite;
        this.addMagicSprite(sprite);
        return sprite;
      }
      return null;
    }

    return null;
  }

  /**
   * 添加超级模式武功
   * C# Reference: MagicManager.AddSuperModeMagic
   * C# Reference: MagicSprite.Init - case 15: texture = belongMagic.SuperModeImage
   *
   * 重要：SuperMode精灵**不添加到普通magicSprites列表**，而是赋值给 _superModeMagicSprite
   * 在 JxqyGame.UpdatePlaying 中单独更新和渲染
   */
  private addSuperModeMagicSprite(
    userId: string,
    magic: MagicData,
    origin: Vector2,
    destroyOnEnd: boolean
  ): MagicSprite {
    const sprite = MagicSprite.createFixed(userId, magic, origin, destroyOnEnd);
    // C# Reference: MagicSprite.Init - case 15: texture = belongMagic.SuperModeImage
    // SuperMode 使用 SuperModeImage 而不是 FlyingImage
    if (magic.superModeImage) {
      sprite.flyingAsfPath = magic.superModeImage;

      // 从缓存获取 ASF 的帧数并设置到精灵
      // 这是关键：ASF 已经在玩家获得武功时预加载了，这里同步获取
      const cached = magicRenderer.getCachedAsf(magic.superModeImage);
      if (cached) {
        sprite.frameCountsPerDirection = cached.framesPerDirection;
        sprite.frameInterval = cached.interval;
        logger.log(
          `[MagicManager] SuperMode sprite initialized: framesPerDir=${cached.framesPerDirection}, interval=${cached.interval}`
        );
      } else {
        logger.warn(
          `[MagicManager] SuperMode ASF not cached: ${magic.superModeImage}, animation may not work correctly`
        );
      }
    }

    // C# Reference: MagicSprite.Begin() - 初始化效果值
    // SuperMode 精灵虽然不加入 magicSprites 列表，但也需要初始化
    this.initializeSpriteEffects(sprite);

    // C# Reference: MagicSprite.Begin() -> ResetPlay()
    // 关键：必须调用 resetPlay 来设置动画播放帧数
    // 对于 MoveKind == 15，使用 FrameCountsPerDirection 作为播放帧数
    sprite.resetPlay();

    // C#: Globals.IsInSuperMagicMode = true;
    // C#: Globals.SuperModeMagicSprite = GetFixedPositionMagicSprite(user, magic, origin, destroyOnEnd);
    // 注意：不调用 addMagicSprite，SuperMode精灵单独管理
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

  // ========== Region 区域武功方法 ==========
  // C# Reference: MagicManager.cs Region 相关方法

  /**
   * 添加区域武功
   * C# Reference: MagicManager.UseMagic case 11
   * 根据 magic.region 值决定具体形状
   */
  private addRegionBasedMagicSprite(
    userId: string,
    magic: MagicData,
    origin: Vector2,
    destination: Vector2,
    destroyOnEnd: boolean
  ): void {
    switch (magic.region) {
      case 1: // Square - 方形区域
        this.addSquareFixedPositionMagicSprite(userId, magic, destination, destroyOnEnd);
        break;
      case 2: // Cross - 十字区域
        this.addCrossFixedPositionMagicSprite(userId, magic, origin, destroyOnEnd);
        break;
      case 3: // Rectangle - 矩形区域
        this.addRectangleFixedPositionMagicSprite(userId, magic, origin, destination, destroyOnEnd);
        break;
      case 4: // IsoscelesTriangle - 等腰三角形
        this.addIsoscelesTriangleMagicSprite(userId, magic, origin, destination, destroyOnEnd);
        break;
      case 5: // VType - V形区域
        this.addVTypeFixedPositionMagicSprite(userId, magic, origin, destination, destroyOnEnd);
        break;
      case 6: // RegionFile - 使用外部区域文件
        this.addRegionFileMagicSprite(userId, magic, origin, destination, destroyOnEnd);
        break;
      default:
        logger.warn(`[MagicManager] Unknown Region: ${magic.region}`);
        break;
    }
  }

  /**
   * 方形区域武功
   * C# Reference: MagicManager.AddSquareFixedPositionMagicSprite
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
   * C# Reference: MagicManager.AddCrossFixedPositionMagicSprite
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
        this.addWorkItem(delay, sprite);
      }
    }
  }

  /**
   * 矩形区域武功
   * C# Reference: MagicManager.AddRegtangleFixedPositionMagicSprite
   * 完全按 C# 的逻辑对不同方向分别处理
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
        // 对角方向
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
        // 垂直方向（南/北）
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
        // 西方向
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
        // 东方向
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
   * C# Reference: MagicManager.AddHorizontalFixedWallMagicSprite
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
    this.addWorkItem(delay, MagicSprite.createFixed(userId, magic, position, destroyOnEnd));

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
      this.addWorkItem(
        delay,
        MagicSprite.createFixed(userId, magic, newPositionLeft, destroyOnEnd)
      );
      this.addWorkItem(
        delay,
        MagicSprite.createFixed(userId, magic, newPositionRight, destroyOnEnd)
      );
    }
  }

  /**
   * 等腰三角形区域武功
   * C# Reference: MagicManager.AddIsoscelesTriangleMagicSprite
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
   * C# Reference: MagicManager.AddVTypeFixedPOsitionMagicSprite
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

    // 使用瓦片坐标计算
    const originTile = pixelToTile(origin.x, origin.y);
    const startTile = this.findNeighborInDirection(originTile, directionIndex);
    const startPos = tileToPixel(startTile.x, startTile.y);

    const sprite = MagicSprite.createFixed(userId, magic, startPos, destroyOnEnd);
    this.addMagicSprite(sprite);

    let leftTile = { ...startTile };
    let rightTile = { ...startTile };

    for (let i = 1; i < count; i++) {
      leftTile = this.findNeighborInDirection(leftTile, (directionIndex + 7) % 8);
      rightTile = this.findNeighborInDirection(rightTile, (directionIndex + 1) % 8);

      const leftPos = tileToPixel(leftTile.x, leftTile.y);
      const rightPos = tileToPixel(rightTile.x, rightTile.y);

      const leftSprite = MagicSprite.createFixed(userId, magic, leftPos, destroyOnEnd);
      this.addWorkItem(i * magicDelayMs, leftSprite);

      const rightSprite = MagicSprite.createFixed(userId, magic, rightPos, destroyOnEnd);
      this.addWorkItem(i * magicDelayMs, rightSprite);
    }
  }

  /**
   * 使用区域文件的武功
   * C# Reference: MagicManager.AddRegionFileMagicSprite
   */
  private addRegionFileMagicSprite(
    userId: string,
    magic: MagicData,
    _origin: Vector2,
    destination: Vector2,
    destroyOnEnd: boolean
  ): void {
    // RegionFile 需要加载外部文件定义，暂时简化处理
    logger.log(`[MagicManager] RegionFile magic not fully implemented: ${magic.name}`);
    // 作为后备，在目标位置创建单个武功
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
    this.addMagicSprite(sprite);

    for (let i = 1; i <= halfCount; i++) {
      const pos1 = { x: center.x + offset.x * i, y: center.y + offset.y * i };
      const pos2 = { x: center.x - offset.x * i, y: center.y - offset.y * i };
      this.addMagicSprite(MagicSprite.createFixed(userId, magic, pos1, destroyOnEnd));
      this.addMagicSprite(MagicSprite.createFixed(userId, magic, pos2, destroyOnEnd));
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
    this.addWorkItem(delay, sprite);

    for (let i = 1; i <= halfCount; i++) {
      const pos1 = { x: center.x + offset.x * i, y: center.y + offset.y * i };
      const pos2 = { x: center.x - offset.x * i, y: center.y - offset.y * i };
      this.addWorkItem(delay, MagicSprite.createFixed(userId, magic, pos1, destroyOnEnd));
      this.addWorkItem(delay, MagicSprite.createFixed(userId, magic, pos2, destroyOnEnd));
    }
  }

  /**
   * 查找指定方向的相邻瓦片
   * C# Reference: PathFinder.FindNeighborInDirection
   */
  private findNeighborInDirection(tile: Vector2, direction: number): Vector2 {
    const dirOffsets = [
      { x: 0, y: 1 }, // 0: 下
      { x: -1, y: 1 }, // 1: 左下
      { x: -1, y: 0 }, // 2: 左
      { x: -1, y: -1 }, // 3: 左上
      { x: 0, y: -1 }, // 4: 上
      { x: 1, y: -1 }, // 5: 右上
      { x: 1, y: 0 }, // 6: 右
      { x: 1, y: 1 }, // 7: 右下
    ];
    const offset = dirOffsets[direction % 8];
    return { x: tile.x + offset.x, y: tile.y + offset.y };
  }

  // ========== 特殊 MoveKind 方法 ==========

  /**
   * Kind19 武功 - 持续留痕
   * C# Reference: MagicManager.UseMagic case 19
   */
  private addKind19MagicSprite(
    userId: string,
    magic: MagicData,
    origin: Vector2,
    destroyOnEnd: boolean
  ): void {
    // Kind19 需要在角色移动时留下痕迹
    // 这里添加到一个特殊的列表中，在 update 中处理
    logger.log(
      `[MagicManager] Kind19 magic: ${magic.name}, keepMilliseconds=${magic.keepMilliseconds}`
    );
    // 暂时简化为固定位置武功
    this.addFixedPositionMagicSprite(userId, magic, origin, destroyOnEnd);
  }

  /**
   * 传送武功
   * C# Reference: MagicManager.UseMagic case 20
   */
  private addTransportMagicSprite(
    userId: string,
    magic: MagicData,
    destination: Vector2,
    destroyOnEnd: boolean
  ): void {
    // 检查是否已在传送中
    // TODO: 需要在 Player 中添加 isInTransport 状态
    logger.log(`[MagicManager] Transport magic: ${magic.name}`);
    this.addFixedPositionMagicSprite(userId, magic, destination, destroyOnEnd);
  }

  /**
   * 控制角色武功
   * C# Reference: MagicManager.UseMagic case 21
   */
  private addControlCharacterMagicSprite(
    userId: string,
    magic: MagicData,
    origin: Vector2,
    destroyOnEnd: boolean,
    target?: CharacterRef
  ): void {
    logger.log(`[MagicManager] ControlCharacter magic: ${magic.name}`);
    // 验证条件并设置控制
    if (target && target.type === "npc") {
      // TODO: 实现控制逻辑
      // player.controledCharacter = target.npc;
    }
    this.addFixedPositionMagicSprite(userId, magic, origin, destroyOnEnd);
  }

  /**
   * 召唤 NPC 武功
   * C# Reference: MagicManager.UseMagic case 22
   */
  private addSummonMagicSprite(
    userId: string,
    magic: MagicData,
    destination: Vector2,
    destroyOnEnd: boolean
  ): void {
    logger.log(`[MagicManager] Summon magic: ${magic.name}, npcFile=${magic.npcFile}`);
    // TODO: 使用 NpcManager 创建 NPC
    this.addFixedPositionMagicSprite(userId, magic, destination, destroyOnEnd);
  }

  // ========== 更新循环 ==========

  update(deltaMs: number): void {
    // SuperMode 优先处理
    // C# Reference: JxqyGame.UpdatePlaying
    // if (Globals.IsInSuperMagicMode) {
    //     Globals.SuperModeMagicSprite.Update(gameTime);
    //     if (Globals.SuperModeMagicSprite.IsDestroyed) {
    //         Globals.IsInSuperMagicMode = false;
    //         Globals.SuperModeMagicSprite = null;
    //     }
    //     return; // Just update super magic
    // }
    if (this._isInSuperMagicMode && this._superModeMagicSprite) {
      this.updateSprite(this._superModeMagicSprite, deltaMs);
      if (this._superModeMagicSprite.isDestroyed) {
        logger.log(`[MagicManager] SuperMode ended`);
        this.handleSpriteEnd(this._superModeMagicSprite);
        this.emitSpriteDestroyed(this._superModeMagicSprite);
        // 注意：SuperMode精灵不在magicSprites列表中，不需要delete
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
        sprite.currentFrameIndex++;
        sprite.frameElapsed = 0;
      }

      // 特效精灵使用 vanishFramesPerDirection（因为它们是消失/爆炸动画）
      if (sprite.currentFrameIndex >= sprite.vanishFramesPerDirection) {
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
    if (sprite.leftFrameToPlay === 0 && sprite.elapsedMilliseconds === 0) {
      // 第一次更新，调用 resetPlay 设置 _leftFrameToPlay
      sprite.resetPlay();
    }

    sprite.elapsedMilliseconds += deltaMs;

    // 帧动画更新
    // C# 逻辑: if (_elapsedMilliSecond > Texture.Interval)
    // 当 interval = 0 时，每游戏帧更新一次动画帧（约 16.67ms @ 60fps）
    sprite.frameElapsed += deltaMs;
    // interval = 0 时使用 16ms（60fps），确保每帧最多推进一次
    const effectiveInterval = sprite.frameInterval > 0 ? sprite.frameInterval : 16;
    if (sprite.frameElapsed >= effectiveInterval) {
      sprite.currentFrameIndex++;
      // C#: if (_leftFrameToPlay > 0) _leftFrameToPlay--;
      if (sprite.leftFrameToPlay > 0) {
        sprite.leftFrameToPlay--;
      }
      sprite.frameElapsed -= effectiveInterval;
    }

    // C# Reference: if (!IsInPlaying) _isDestroyed = true;
    // SuperMode 需要特殊处理：等待所有 superModeDestroySprites 播完
    if (sprite.isInDestroy) {
      if (sprite.isSuperMode || sprite.magic.moveKind === MagicMoveKind.SuperMode) {
        // C# Reference: MagicSprite.Update - case MoveKind == 15 && IsInDestroy
        // 更新所有 superModeDestroySprites
        this.updateSuperModeDestroySprites(sprite, deltaMs);
        // 检查是否有任何一个精灵结束 -> 整个 SuperMode 结束
        const anyEnded = sprite.superModeDestroySprites.some((s) => !s.isInPlaying);
        if (anyEnded || sprite.superModeDestroySprites.length === 0) {
          sprite.isDestroyed = true;
        }
        return;
      } else {
        // 普通武功：等动画播完
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
      const pos = this.getCharacterPosition(sprite.belongCharacterId);
      if (pos) {
        // 使用 positionInWorld setter 更新位置（会自动更新 mapX, mapY）
        sprite.positionInWorld = { x: pos.x, y: pos.y };
      }
    }

    // 追踪敌人逻辑
    // C# Reference: MagicSprite.Update - MoveKind == 16 || TraceEnemy > 0
    if (sprite.magic.moveKind === MagicMoveKind.FollowEnemy || sprite.magic.traceEnemy > 0) {
      // 先正常飞行 200 像素，然后开始追踪
      const shouldTrace =
        sprite.movedDistance > 200 ||
        (sprite.magic.traceEnemy > 0 &&
          sprite.elapsedMilliseconds >= sprite.magic.traceEnemyDelayMilliseconds);

      if (shouldTrace) {
        // 查找最近的敌人
        const closestEnemy = this.findClosestEnemy(sprite);
        if (closestEnemy) {
          // 如果有 TraceSpeed，更新速度
          if (sprite.magic.traceSpeed > 0) {
            sprite.velocity = MAGIC_BASE_SPEED * sprite.magic.traceSpeed;
          }
          // 更新方向指向敌人
          const enemyPos = this.getCharacterPosition(closestEnemy);
          if (enemyPos) {
            const dir = {
              x: enemyPos.x - sprite.position.x,
              y: enemyPos.y - sprite.position.y,
            };
            const len = Math.sqrt(dir.x * dir.x + dir.y * dir.y);
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
      // 直接更新 positionInWorld（会自动更新 mapX, mapY）
      sprite.positionInWorld = {
        x: sprite.positionInWorld.x + sprite.direction.x * moveDistance,
        y: sprite.positionInWorld.y + sprite.direction.y * moveDistance,
      };
      sprite.movedDistance += moveDistance;
    }

    // 检查动画播放结束
    // C# 逻辑: if (!IsInPlaying) { ... }
    // 对于有速度的飞行武功，不因为动画播完而结束，而是等待碰撞
    if (!sprite.isInPlaying && sprite.velocity === 0) {
      // C# Reference: MagicSprite.Update - case MoveKind == 15 && !IsInPlaying
      // SuperMode 动画播完后调用 Destroy
      if (sprite.isSuperMode || sprite.magic.moveKind === MagicMoveKind.SuperMode) {
        logger.log(`[MagicManager] SuperMode animation ended, calling startDestroyAnimation`);
        this.startDestroyAnimation(sprite);
        return;
      }
      logger.log(
        `[MagicManager] Sprite ${sprite.magic.name} animation ended: leftFrameToPlay=${sprite.leftFrameToPlay}, lifeFrame=${sprite.magic.lifeFrame}`
      );
      this.handleSpriteLifeEnd(sprite);
      return;
    }

    // C# Reference: MagicSprite.Update 中根据 MoveKind 决定是否检查碰撞
    // MoveKind 13, 20, 21, 22, 23 不检查碰撞
    let checkHit = true;
    switch (sprite.magic.moveKind) {
      case 13: // FollowCharacter
      case 20: // Transport
      case 21: // ControledByPlayer
      case 22: // Summon
      case 23: // TimeStop
        checkHit = false;
        break;
      default:
        // 先检查角色碰撞
        if (this.checkCollisionInternal(sprite)) return;
        break;
    }

    // 只有 checkHit 为 true 时才检查地图障碍物
    if (checkHit && this.checkMapObstacleInternal(sprite)) return;
  }

  private checkMapObstacleInternal(sprite: MagicSprite): boolean {
    if (sprite.magic.passThroughWall > 0) return false;

    // 通过 IEngineContext 获取碰撞检测器
    const collisionChecker = getEngineContext().getCollisionChecker();
    if (!collisionChecker) return false;

    const tile = sprite.tilePosition;

    if (collisionChecker.isObstacleForMagic(tile)) {
      logger.log(
        `[MagicManager] Sprite ${sprite.magic.name} hit map obstacle at (${tile.x}, ${tile.y})`
      );
      this.startDestroyAnimation(sprite);
      return true;
    }
    return false;
  }

  private handleSpriteLifeEnd(sprite: MagicSprite): void {
    logger.log(
      `[MagicManager] handleSpriteLifeEnd: ${sprite.magic.name}, destroyOnEnd=${sprite.destroyOnEnd}`
    );
    if (sprite.destroyOnEnd) {
      this.startDestroyAnimation(sprite);
    } else {
      sprite.isDestroyed = true;
    }
  }

  private startDestroyAnimation(sprite: MagicSprite): void {
    if (sprite.isInDestroy) return;
    logger.log(`[MagicManager] startDestroyAnimation: ${sprite.magic.name}`);
    sprite.isInDestroy = true;

    // SuperMode 全屏攻击 - 对每个敌人调用 apply
    // C# Reference: MagicSprite.Destroy() - case MoveKind == 15
    if (sprite.isSuperMode || sprite.magic.moveKind === MagicMoveKind.SuperMode) {
      // C#: Texture = null - 清除原动画
      sprite.flyingAsfPath = undefined;
      // 创建特效精灵并对敌人造成伤害
      this.applySuperModeToAllEnemies(sprite);
      // C#: if (_superModeDestroySprites.Count == 0) _isDestroyed = true;
      if (sprite.superModeDestroySprites.length === 0) {
        sprite.isDestroyed = true;
      }
      // 注意：不立即销毁，等待所有特效精灵播完
      return;
    }

    // 普通武功销毁 - 切换到消失动画
    // C# Reference: Destroy() -> Texture = BelongMagic.VanishImage
    const hasValidVanishImage = sprite.magic.vanishImage && !sprite.magic.vanishImage.endsWith("/");

    if (hasValidVanishImage) {
      // C# Reference: Sprite.Texture setter + PlayFrames(FrameCountsPerDirection)
      sprite.vanishAsfPath = sprite.magic.vanishImage;
      sprite.currentFrameIndex = 0;
      sprite.frameElapsed = 0;
      sprite.velocity = 0;
      sprite.frameInterval = 50; // 默认值，渲染器会根据 ASF 更新
      // 使用默认帧数调用 playFrames，渲染器加载 ASF 后会更新实际值
      sprite.playFrames(20);
    } else {
      sprite.isDestroyed = true;
    }

    if (sprite.magic.vanishSound) {
      this.playSound(sprite.magic.vanishSound);
    }

    // 触发爆炸武功
    // C# Reference: AddDestroySprite -> UseMagic(BelongMagic.ExplodeMagicFile)
    this.triggerExplodeMagic(sprite);
  }

  /**
   * SuperMode 全屏攻击 - 对所有敌人调用 apply
   * C# Reference: MagicSprite.Destroy() - case MoveKind == 15
   * 重要变化：
   * 1. 创建特效精灵存入 sprite.superModeDestroySprites
   * 2. 对每个敌人调用 CharacterHited（apply）
   * 3. 特效精灵在 updateSuperModeDestroySprites 中更新
   */
  private applySuperModeToAllEnemies(sprite: MagicSprite): void {
    const effect = getEffect(sprite.magic.moveKind);
    // 使用更新后的 getEnemiesInView，传入 magic 数据以支持 AttackAll
    const targets = this.getEnemiesInView(sprite.belongCharacterId, sprite.magic);

    // C#: _superModeDestroySprites = new LinkedList<Sprite>();
    sprite.superModeDestroySprites = [];

    for (const targetId of targets) {
      const targetRef = this.getCharacterRef(targetId);
      if (targetRef) {
        const targetChar = this.getCharacterFromRef(targetRef);
        // 跳过死亡的角色
        if (targetChar.isDeath || targetChar.isDeathInvoked) continue;

        const targetPos = getCharPosition(targetRef);

        // C#: AddDestroySprite(_superModeDestroySprites, character.PositionInWorld, VanishImage, VanishSound)
        // 创建特效精灵存入 superModeDestroySprites（而不是 effectSprites）
        if (sprite.magic.vanishImage && !sprite.magic.vanishImage.endsWith("/")) {
          const effectSprite = sprite.createEffectSprite(targetPos);
          effectSprite.vanishAsfPath = sprite.magic.vanishImage;
          effectSprite.flyingAsfPath = sprite.magic.vanishImage;
          sprite.superModeDestroySprites.push(effectSprite);
        }

        // C#: character.NotifyFighterAndAllNeighbor(BelongCharacter) - 通知敌人战斗
        const belongCharacter = this.getBelongCharacter(sprite.belongCharacterId);
        if (belongCharacter) {
          targetChar.notifyFighterAndAllNeighbor(belongCharacter);
        }

        // C#: CharacterHited(character) - 通过 apply 调用伤害逻辑
        if (effect?.apply) {
          const applyCtx = this.createApplyContext(sprite, targetRef);
          if (applyCtx) {
            effect.apply(applyCtx);
          }
        }

        // C#: AddDestroySprite 中也调用 UseMagic(BelongMagic.ExplodeMagicFile)
        // 对每个目标在目标位置触发爆炸武功
        this.triggerExplodeMagic(sprite, targetPos);
      }
    }

    // 播放消失音效（只播放一次）
    if (sprite.magic.vanishSound && targets.length > 0) {
      this.playSound(sprite.magic.vanishSound);
    }

    // 震屏
    if (sprite.magic.vibratingScreen > 0) {
      this.vibrateScreen(sprite.magic.vibratingScreen);
    }
  }

  /**
   * 更新 SuperMode 的特效精灵列表
   * C# Reference: MagicSprite.Update - case MoveKind == 15 && IsInDestroy
   * 更新每个特效精灵的帧动画
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
   * 检查敌人碰撞并调用 apply
   * C# Reference: MagicSprite.CollisionDetaction()
   * 使用格子位置检测碰撞，根据施法者类型选择目标
   * @returns true 如果命中了角色
   */
  private checkCollisionInternal(sprite: MagicSprite): boolean {
    if (sprite.isInDestroy) {
      return false;
    }

    // C# Reference: 粘附/寄生角色检查
    // TODO: 实现 stickedCharacter 和 parasitiferCharacter 逻辑

    // C# Reference: CarryUser == 3 时穿过敌人，不检测碰撞
    if ((sprite.magic.carryUser ?? 0) === 3) {
      return false;
    }

    // TODO: CarryUser == 4 的特殊处理

    const belongCharacter = this.getBelongCharacter(sprite.belongCharacterId);
    if (!belongCharacter) {
      return false;
    }

    // C# Reference: 使用 TilePosition 属性，已在 positionInWorld setter 中自动更新
    const tileX = sprite.tilePosition.x;
    const tileY = sprite.tilePosition.y;

    let target: Character | null = null;
    let characterHited = false;

    // C# Reference: MagicSprite.cs line 800-822
    if (sprite.magic.attackAll > 0) {
      // AttackAll: 攻击任何战斗者
      target = this.canCollide(sprite, this.npcManager.getFighter(tileX, tileY));
      characterHited = this.characterHited(sprite, target);
    } else if (belongCharacter.isPlayer || belongCharacter.isFighterFriend) {
      // 玩家或友方: 攻击敌人（包括中立者）
      target = this.canCollide(sprite, this.npcManager.getEnemy(tileX, tileY, true));
      // DEBUG: 打印玩家武功的位置和敌人位置
      if (!target && sprite.elapsedMilliseconds < 100) {
        // 只在前 100ms 内打印一次，避免刷屏
        const enemies = this.npcManager.getEnemyPositions();
        logger.log(`[MagicManager] Player magic ${sprite.magic.name} at tile (${tileX}, ${tileY}), enemies: ${enemies}`);
      }
      characterHited = this.characterHited(sprite, target);
    } else if (belongCharacter.isEnemy) {
      // 敌人: 攻击玩家或友方
      target = this.canCollide(
        sprite,
        this.npcManager.getPlayerOrFighterFriend(tileX, tileY, true)
      );
      // logger.log(`[MagicManager] Enemy magic looking for player at (${tileX}, ${tileY}), found: ${target?.name ?? 'null'}`);
      if (target === null) {
        // 如果没找到，尝试找其他组的敌人
        target = this.canCollide(
          sprite,
          this.npcManager.getOtherGroupEnemy(belongCharacter.group, tileX, tileY)
        );
      }
      characterHited = this.characterHited(sprite, target);
    } else if (belongCharacter.isNoneFighter) {
      // 中立者: 攻击非中立战斗者
      target = this.canCollide(sprite, this.npcManager.getNonneutralFighter(tileX, tileY));
      characterHited = this.characterHited(sprite, target);
    }

    // 如果没命中，检查武功抵消等其他逻辑
    // C# Reference: if (!characterHited && !CheckMagicDiscard()) { CheckMagicExchangeUser(); }
    if (!characterHited && !this.checkMagicDiscard(sprite)) {
      this.checkMagicExchangeUser(sprite);
    }

    return characterHited;
  }

  /**
   * 检查武功是否可以被抵消
   * C# Reference: MagicSprite.CanDiscard
   */
  private canDiscard(sprite: MagicSprite): boolean {
    // 有附着角色或寄生角色的不能抵消
    // 特定 MoveKind 不能抵消: 13(FollowCharacter), 15(Bindable), 21(FixedPositionAfterMove), 23
    const excludedKinds = [13, 15, 21, 23];
    return !excludedKinds.includes(sprite.magic.moveKind);
  }

  /**
   * 检查武功是否可以被交换使用者
   * C# Reference: MagicSprite.CanExchangeUser
   */
  private canExchangeUser(sprite: MagicSprite): boolean {
    // 特定 MoveKind 不能交换: 13, 15, 20, 21, 22, 23
    const excludedKinds = [13, 15, 20, 21, 22, 23];
    return !excludedKinds.includes(sprite.magic.moveKind);
  }

  /**
   * 检查两个角色是否敌对
   * C# Reference: Character.IsOpposite(Character target)
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
   * C# Reference: MagicSprite.IsOpposite(MagicSprite magicSprite)
   */
  private isOppositeSprite(sprite: MagicSprite, other: MagicSprite): boolean {
    const belongA = this.getBelongCharacter(sprite.belongCharacterId);
    const belongB = this.getBelongCharacter(other.belongCharacterId);
    if (!belongA || !belongB) return false;
    return this.isOpposite(belongA, belongB);
  }

  /**
   * 检查武功抵消
   * C# Reference: MagicSprite.CheckMagicDiscard()
   * 如果两个敌对武功在同一位置，且都可抵消，则同时销毁
   */
  private checkMagicDiscard(sprite: MagicSprite): boolean {
    if ((sprite.magic.discardOppositeMagic ?? 0) <= 0) return false;

    // C# Reference: 使用 TilePosition 属性
    const tileX = sprite.tilePosition.x;
    const tileY = sprite.tilePosition.y;

    for (const [, other] of this.magicSprites) {
      if (other === sprite || other.isDestroyed || other.isInDestroy) continue;

      const otherTileX = other.tilePosition.x;
      const otherTileY = other.tilePosition.y;

      if (
        otherTileX === tileX &&
        otherTileY === tileY &&
        this.isOppositeSprite(sprite, other) &&
        this.canDiscard(other)
      ) {
        // 双方同时销毁
        other.isDestroyed = true;
        sprite.isDestroyed = true;
        logger.log(`[MagicManager] Magic discard: ${sprite.magic.name} vs ${other.magic.name}`);
        return true;
      }
    }
    return false;
  }

  /**
   * 检查武功交换使用者
   * C# Reference: MagicSprite.CheckMagicExchangeUser()
   * 吸收敌对武功并改变其方向
   */
  private checkMagicExchangeUser(sprite: MagicSprite): boolean {
    if ((sprite.magic.exchangeUser ?? 0) <= 0) return false;

    // C# Reference: 使用 TilePosition 属性
    const tileX = sprite.tilePosition.x;
    const tileY = sprite.tilePosition.y;

    for (const [, other] of this.magicSprites) {
      if (other === sprite || other.isDestroyed || other.isInDestroy) continue;

      const otherTileX = other.tilePosition.x;
      const otherTileY = other.tilePosition.y;

      if (
        otherTileX === tileX &&
        otherTileY === tileY &&
        this.isOppositeSprite(sprite, other) &&
        this.canExchangeUser(other)
      ) {
        // 交换使用者并合并方向
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
          `[MagicManager] Magic exchange user: ${sprite.magic.name} -> ${other.magic.name}`
        );
      }
    }
    return false;
  }

  /**
   * 穿透检测
   * C# Reference: MagicSprite.CanCollide(Character character)
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
  private characterHited(sprite: MagicSprite, character: Character | null): boolean {
    if (character === null) return false;

    const charId = character.isPlayer ? "player" : (character as Npc).id;
    const charRef = this.getCharacterRef(charId);
    if (!charRef) {
      logger.warn(`[MagicManager] characterHited: Cannot get ref for ${character.name} (id=${charId})`);
      return false;
    }

    logger.log(`[MagicManager] characterHited: ${sprite.magic.name} -> ${character.name}`);

    // 记录命中前是否存活
    const wasAliveBeforeHit = !character.isDeathInvoked && !character.isDeath;

    const magic = sprite.magic;
    const belongCharacter = this.getBelongCharacter(sprite.belongCharacterId);

    // C# Reference: character.NotifyFighterAndAllNeighbor(BelongCharacter);
    // 被攻击时进入战斗状态，并通知邻近敌人追击
    character.toFightingState();
    character.notifyFighterAndAllNeighbor(belongCharacter);

    // === C# Reference: MagicSprite.CharacterHited - 特殊效果处理 ===

    // 禁止移动
    if (magic.disableMoveMilliseconds > 0) {
      character.disableMoveMilliseconds = magic.disableMoveMilliseconds;
    }

    // 禁止技能
    if (magic.disableSkillMilliseconds > 0) {
      character.disableSkillMilliseconds = magic.disableSkillMilliseconds;
    }

    // 变换阵营 (ChangeToFriendMilliseconds)
    // C#: if (BelongMagic.ChangeToFriendMilliseconds > 0 && BelongMagic.MaxLevel >= character.Level)
    if (magic.changeToFriendMilliseconds > 0 && magic.maxLevel >= character.level) {
      character.changeToOpposite(magic.changeToFriendMilliseconds);
    }

    // 弱化效果 (WeakMilliseconds)
    // C#: if (BelongMagic.WeakMilliseconds > 0) { character.WeakBy(this); }
    if (magic.weakMilliseconds > 0) {
      character.weakBy(sprite);
    }

    // 变身效果 (MorphMilliseconds)
    // C#: if (BelongMagic.MorphMilliseconds > 0) { character.MorphBy(this); }
    if (magic.morphMilliseconds > 0) {
      character.morphBy(sprite);
    }

    // 特殊效果 (SpecialKind) - 冰冻/中毒/石化
    // C#: switch (BelongMagic.SpecialKind)
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

    // 附加效果 (AdditionalEffect) - 装备加成
    // C#: switch (BelongMagic.AdditionalEffect)
    switch (magic.additionalEffect) {
      case 1: // Frozen
        if (!character.isFrozened) {
          const seconds = (belongCharacter?.level ?? 1) / 10 + 1;
          character.setFrozenSeconds(seconds, magic.noSpecialKindEffect === 0);
        }
        break;
      case 2: // Poison
        if (!character.isPoisoned) {
          const seconds = (belongCharacter?.level ?? 1) / 10 + 1;
          character.setPoisonSeconds(seconds, magic.noSpecialKindEffect === 0);
          if (belongCharacter && (belongCharacter.isPlayer || belongCharacter.isPartner)) {
            character.poisonByCharacterName = belongCharacter.name;
          }
        }
        break;
      case 3: // Petrified
        if (!character.isPetrified) {
          const seconds = (belongCharacter?.level ?? 1) / 10 + 1;
          character.setPetrifySeconds(seconds, magic.noSpecialKindEffect === 0);
        }
        break;
    }

    // 调用 apply（伤害计算）
    const effect = getEffect(sprite.magic.moveKind);
    let actualDamage = 0;
    if (effect?.apply) {
      const applyCtx = this.createApplyContext(sprite, charRef);
      if (applyCtx) {
        actualDamage = effect.apply(applyCtx) ?? 0;

        // C# Reference: MagicSprite.CharacterHited - 处理经验
        this.handleExpOnHit(sprite, character, wasAliveBeforeHit);
      }
    }

    // C# Reference: MagicSprite.CharacterHited - Restore (吸血效果)
    // if (BelongMagic.RestoreProbability > 0 && Globals.TheRandom.Next(0, 100) < BelongMagic.RestoreProbability)
    //   var restoreAmount = (effect * BelongMagic.RestorePercent) / 100;
    //   switch (BelongMagic.RestoreType) { ... BelongCharacter.AddLife/Mana/Thew }
    if (magic.restoreProbability > 0 && actualDamage > 0 && belongCharacter) {
      const roll = Math.floor(Math.random() * 100);
      if (roll < magic.restoreProbability) {
        const restoreAmount = Math.floor((actualDamage * magic.restorePercent) / 100);
        if (restoreAmount > 0) {
          switch (magic.restoreType) {
            case 0: // Life
              belongCharacter.addLife(restoreAmount);
              break;
            case 1: // Mana
              belongCharacter.addMana(restoreAmount);
              break;
            case 2: // Thew
              belongCharacter.addThew(restoreAmount);
              break;
          }
        }
      }
    }

    // C# Reference: MagicSprite.CharacterHited - MagicToUseWhenBeAttacked
    // 被攻击时自动使用武功（需要武功精灵方向信息，所以必须在这里处理）
    this.handleMagicToUseWhenBeAttacked(sprite, character, belongCharacter);

    // 处理穿透或销毁
    if (sprite.magic.passThrough > 0) {
      // 创建命中特效但不销毁
      if (sprite.magic.vanishImage) {
        this.createHitEffect(sprite);
      }
    } else {
      // 不穿透，销毁
      this.startDestroyAnimation(sprite);
    }

    return true;
  }

  private createHitEffect(sprite: MagicSprite): void {
    if (!sprite.magic.vanishImage) return;

    const effectSprite = sprite.createEffectSprite();
    this.effectSprites.set(effectSprite.id, effectSprite);

    // 穿透命中时也触发爆炸武功
    // C# Reference: AddDestroySprite -> UseMagic(BelongMagic.ExplodeMagicFile)
    this.triggerExplodeMagic(sprite);
  }

  /**
   * 触发爆炸武功
   * C# Reference: MagicSprite.AddDestroySprite -> UseMagic(BelongMagic.ExplodeMagicFile)
   * @param sprite 武功精灵
   * @param position 可选的爆炸位置（SuperMode 时传入敌人位置）
   */
  private async triggerExplodeMagic(sprite: MagicSprite, position?: Vector2): Promise<void> {
    if (!sprite.magic.explodeMagicFile) return;

    // 使用传入的位置或精灵当前位置
    const explodePos = position ?? sprite.position;

    try {
      const explodeMagic = await loadMagic(sprite.magic.explodeMagicFile);
      if (!explodeMagic) {
        logger.warn(
          `[MagicManager] Failed to load explode magic: ${sprite.magic.explodeMagicFile}`
        );
        return;
      }

      // 使用武功等级获取对应属性
      const level = sprite.magic.currentLevel || 1;
      const magicAtLevel = getMagicAtLevel(explodeMagic, level);

      logger.log(
        `[MagicManager] Triggering explode magic: ${magicAtLevel.name} at position (${explodePos.x}, ${explodePos.y})`
      );

      // 在指定位置释放爆炸武功
      this.useMagic({
        magic: magicAtLevel,
        origin: explodePos,
        destination: explodePos,
        userId: sprite.belongCharacterId,
      });
    } catch (error) {
      logger.error(
        `[MagicManager] Error loading explode magic: ${sprite.magic.explodeMagicFile}`,
        error
      );
    }
  }

  private createEffectAtPosition(sprite: MagicSprite, position: Vector2): void {
    const effectSprite = sprite.createEffectSprite(position);
    this.effectSprites.set(effectSprite.id, effectSprite);
  }

  isObstacle(tile: Vector2): boolean {
    for (const sprite of this.magicSprites.values()) {
      if (sprite.magic.bodyRadius > 0) {
        // C# Reference: 使用 TilePosition 属性
        if (sprite.tilePosition.x === tile.x && sprite.tilePosition.y === tile.y) {
          return true;
        }
      }
    }
    return false;
  }
}
