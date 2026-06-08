/**
 * NpcAI - NPC 人工智能行为管理器
 *
 * 管理 NPC 的 AI 行为，包括目标查找、跟随、攻击、距离管理等。
 * 通过组合模式将 AI 逻辑从 Npc 类中解耦。
 *
 * 通过构造函数注入依赖，避免污染 Npc 的公共 API。
 */

import type { Character } from "../../character";
import { TILE_WIDTH } from "../../core/constants";
import type { EngineContext } from "../../core/engine-context";
import { getEngineContext } from "../../core/engine-context";
import type { Vector2 } from "../../core/types";
import { ActionType, CharacterKind, CharacterState } from "../../core/types";
import { getViewTileDistance } from "../../utils";
import { PathType } from "../../utils/path-finder";
import type { Npc } from "../npc";
import type { NpcManager } from "../npc-manager";

/**
 * 伙伴放弃战斗回到玩家身边的格距阈值。
 * 玩家与伙伴距离超过该值时，伙伴清空战斗目标并立即跟随玩家。
 */
const PARTNER_ABANDON_COMBAT_TILE_DISTANCE = 10;

/**
 * AI 目标搜索跨帧分摊间隔（帧）。
 *
 * 敌友目标搜索（findClosestCharacter 网格扫描）是密集人群下的主要 CPU 开销。
 * 目标变化很慢，不必每帧重算：每个 NPC 每隔该帧数才重新搜索一次，并按构造时的
 * 随机相位错峰，避免同帧集中。移动/攻击/动画仍每帧执行，缓存目标死亡由
 * performFollow 每帧清理，因此视觉与行为几乎无差异，开销降至约 1/N。
 */
const AI_TARGET_SEARCH_INTERVAL = 8;

/**
 * AI 更新结果
 */
export interface AIUpdateResult {
  /** 是否跳过后续更新 */
  skipUpdate: boolean;
  /** 是否找到跟随目标 */
  followTargetFound: boolean;
}

/**
 * NpcAI - NPC AI 行为管理器
 */
export class NpcAI {
  private _npc: Npc;
  private _engineCtx?: EngineContext;
  private get engine(): EngineContext {
    return (this._engineCtx ??= getEngineContext());
  }

  /** 保持距离的角色（当友方死亡时） */
  private _keepDistanceCharacterWhenFriendDeath: Character | null = null;

  /**
   * 目标搜索冷却计数器（帧）。构造时随机相位错峰，避免所有 NPC 同帧搜索。
   * 见 AI_TARGET_SEARCH_INTERVAL。
   */
  private _searchCooldown: number = Math.floor(Math.random() * AI_TARGET_SEARCH_INTERVAL);

  constructor(npc: Npc) {
    this._npc = npc;
  }

  // === Manager 访问（通过注入的依赖）===

  private get npcManager(): NpcManager {
    return this._npc.npcManager;
  }

  private get player(): Character {
    return this._npc.player;
  }

  // === 主更新循环 ===

  /**
   * 更新 AI 状态
   * @param deltaTime 时间增量（秒）
   * @returns AI 更新结果
   */
  update(deltaTime: number): AIUpdateResult {
    const result: AIUpdateResult = {
      skipUpdate: false,
      followTargetFound: false,
    };

    // 检查是否需要跳过 AI
    if (!this._npc.isVisibleByVariable) {
      result.skipUpdate = true;
      return result;
    }

    // 死亡 NPC 只更新死亡动画
    if (this._npc.isDeathInvoked || this._npc.isDeath) {
      result.skipUpdate = false; // 仍需调用 super.update
      return result;
    }

    // 脚本运行期间，敌对 NPC 停止 AI 探测和走路
    if (this._npc.isEnemy && this.engine.scriptExecutor.isRunning()) {
      result.skipUpdate = true;
      return result;
    }

    // 更新致盲时间
    this.updateBlindTime(deltaTime);

    // 检查固定攻击位置
    if (this.checkKeepAttack()) {
      result.skipUpdate = false;
      return result;
    }

    // 查找跟随目标
    this.findFollowTarget();

    // 执行跟随或距离保持行为
    if (!this.checkKeepDistanceWhenFriendDeath() && !this.keepDistanceWhenLifeLow()) {
      this.checkUseMagicWhenLifeLow();
      this.performFollow();
    }

    // 更新攻击间隔
    this.updateIdleFrame();

    // 处理无目标时的行为
    result.followTargetFound = this._npc.isFollowTargetFound;
    if (result.followTargetFound) {
      this._npc.actionPathTilePositions = [];
    } else {
      this.handleNoTarget();
    }

    // 处理非战斗行为
    this.handleNonFighterBehavior();

    return result;
  }

  // === 目标查找 ===

  /**
   * 查找跟随目标
   */
  findFollowTarget(): void {
    const npc = this._npc;

    if (this.npcManager.isGlobalAIDisabled || npc.isAIDisabled || npc.blindMilliseconds > 0) {
      npc.followTarget = null;
      npc.isFollowTargetFound = false;
      // Partner 仍需跟随玩家
      if (npc.isPartner && !this.npcManager.isPartnerBlockingPlayer) {
        this.moveToPlayer();
      }
      return;
    }

    // 仅在站立（空闲）时执行昂贵的最近敌/友搜索：忙碌（行走/攻击）的 NPC 提交于
    // 当前动作，完成后回到站立再重新搜索。与 dueForTargetSearch 的跨帧节流叠加，
    // 显著降低密集战斗下的搜索调用次数；followTarget 的死亡清理由 performFollow
    // 每帧负责，因此即使忙碌也不会出现攻击尸体的情况。
    // 短路求值确保 dueForTargetSearch 仅在站立时才递减冷却（忙碌期间冷却冻结）。
    if (npc.isEnemy) {
      if (npc.isStanding() && this.dueForTargetSearch()) this.findEnemyTarget();
    } else if (npc.isFighterFriend) {
      this.findFriendlyTarget(npc.isStanding() && this.dueForTargetSearch());
    } else if (npc.isNoneFighter) {
      if (npc.isStanding() && this.dueForTargetSearch()) this.findNoneFighterTarget();
    } else if (npc.isPartner) {
      if (!this.npcManager.isPartnerBlockingPlayer) {
        this.moveToPlayer();
      }
    } else if (npc.followNpcName) {
      this.followNamedNpc();
    }

    if (npc.followTarget === null) {
      npc.isFollowTargetFound = false;
    }
  }

  /**
   * 目标搜索跨帧节流：每 AI_TARGET_SEARCH_INTERVAL 帧返回一次 true。
   * 不到搜索帧时复用上一次的 followTarget（移动/攻击仍每帧执行）。
   */
  private dueForTargetSearch(): boolean {
    if (this._searchCooldown <= 0) {
      this._searchCooldown = AI_TARGET_SEARCH_INTERVAL;
      return true;
    }
    this._searchCooldown--;
    return false;
  }

  /**
   * AI 目标搜索的空间网格半径（像素）。
   *
   * 超出视野的目标会被 performFollow 的视野检查丢弃，因此搜索半径只需覆盖视野即可。
   * 以视野格数 × 瓦片宽度（水平方向像素跨度最大）再加一格余量，保证不漏掉视野内目标，
   * 同时把密集人群下的网格扫描从全图收缩到视野邻域。
   */
  private searchRadiusPx(): number {
    return (this._npc.getVisionRadius() + 1) * TILE_WIDTH;
  }

  /**
   * 敌方 NPC 寻找目标
   */
  private findEnemyTarget(): void {
    const npc = this._npc;

    if (
      (npc.stopFindingTarget === 0 && !npc.isRandMoveRandAttack) ||
      (npc.isRandMoveRandAttack && npc.isStanding() && Math.random() > 0.7)
    ) {
      // 先找其他组的敌人
      if (this.npcManager) {
        npc.followTarget = this.npcManager.getLiveClosestOtherGropEnemy(
          npc.group,
          npc.positionInWorld,
          this.searchRadiusPx()
        );
      }
      // 如果没找到不同组的敌人，目标指向玩家
      if (npc.noAutoAttackPlayer === 0 && npc.followTarget === null) {
        npc.followTarget = this.getPlayerOrFighterFriend();
      }
    } else if (npc.followTarget?.isDeathInvoked) {
      npc.followTarget = null;
    }
  }

  /**
   * 友方 NPC 寻找目标
   */
  private findFriendlyTarget(due: boolean): void {
    const npc = this._npc;

    // 伙伴：玩家未进入战斗 或 玩家跑远 → 放弃战斗回到玩家身边
    if (npc.isPartner) {
      const distanceToPlayer = getViewTileDistance(
        { x: npc.mapX, y: npc.mapY },
        { x: this.player.mapX, y: this.player.mapY }
      );
      const playerOutOfRange = distanceToPlayer > PARTNER_ABANDON_COMBAT_TILE_DISTANCE;
      const playerNotFighting = !this.player.isInFighting;
      if (playerOutOfRange || playerNotFighting) {
        npc.followTarget = null;
        npc.isFollowTargetFound = false;
        npc.cancelAttackTarget();
        if (!this.npcManager.isPartnerBlockingPlayer) {
          this.moveToPlayer();
        }
        return;
      }
    }

    // 目标搜索按帧节流；非搜索帧复用上一目标，仅清理已死亡目标
    if (npc.stopFindingTarget === 0) {
      if (due) {
        npc.followTarget = this.getClosestEnemyCharacter();
      } else if (npc.followTarget?.isDeathInvoked) {
        npc.followTarget = null;
      }
    } else if (npc.followTarget?.isDeathInvoked) {
      npc.followTarget = null;
    }

    // 如果没有敌人且是伙伴，跟随玩家
    if (npc.followTarget === null && npc.isPartner) {
      if (!this.npcManager.isPartnerBlockingPlayer) {
        this.moveToPlayer();
      }
    }
  }

  /**
   * 中立战斗 NPC 寻找目标
   */
  private findNoneFighterTarget(): void {
    const npc = this._npc;

    if (npc.stopFindingTarget === 0) {
      npc.followTarget = this.getClosestNonneturalFighter();
    } else if (npc.followTarget?.isDeathInvoked) {
      npc.followTarget = null;
    }
  }

  /**
   * 跟随指定名字的角色（对应 C++ followNPC 属性）
   * 目标可以是玩家或其他 NPC；如果目标不存在，清空 followNpcName
   */
  private followNamedNpc(): void {
    const npc = this._npc;
    const name = npc.followNpcName;

    // 优先检查玩家
    const player = this.player;
    if (player && player.name === name && !player.isDeathInvoked) {
      npc.followTarget = player;
      return;
    }

    // 再查 NPC 列表
    const target = this.npcManager ? this.npcManager.getNpc(name) : null;
    if (target && !target.isDeathInvoked) {
      npc.followTarget = target;
    } else {
      npc.followNpcName = "";
      npc.followTarget = null;
    }
  }

  // === 跟随行为 ===

  /**
   * 检查并执行跟随行为
   */
  performFollow(): void {
    const npc = this._npc;
    if (npc.followTarget === null) return;

    const targetTilePosition = {
      x: npc.followTarget.mapX,
      y: npc.followTarget.mapY,
    };
    const tileDistance = getViewTileDistance({ x: npc.mapX, y: npc.mapY }, targetTilePosition);

    let canSeeTarget = false;

    if (tileDistance <= npc.getVisionRadius()) {
      canSeeTarget = npc.canViewTargetForAI(
        { x: npc.mapX, y: npc.mapY },
        targetTilePosition,
        npc.getVisionRadius()
      );
      npc.isFollowTargetFound = npc.isFollowTargetFound || canSeeTarget;
    } else {
      npc.isFollowTargetFound = false;
    }

    if (npc.isFollowTargetFound) {
      this.followTargetFound(canSeeTarget);
    } else {
      this.followTargetLost();
    }
  }

  /**
   * 目标在视野内时的处理
   */
  private followTargetFound(attackCanReach: boolean): void {
    const npc = this._npc;

    if (this.npcManager.isGlobalAIDisabled || npc.isAIDisabled || npc.blindMilliseconds > 0) {
      npc.cancelAttackTarget();
      return;
    }

    // 目标已死亡，清除目标
    if (npc.followTarget?.isDeathInvoked) {
      npc.followTarget = null;
      npc.isFollowTargetFound = false;
      npc.cancelAttackTarget();
      return;
    }

    // 强制重新计算路径
    npc.moveTargetChanged = true;

    if (attackCanReach) {
      // 攻击间隔到达阈值时攻击
      if (npc.idledFrame >= npc.idle) {
        npc.idledFrame = 0;
        const targetTile = npc.followTarget?.tilePosition;
        if (targetTile) {
          npc.attacking(targetTile);
        }
      }
    } else {
      // 走向目标
      const targetTile = npc.followTarget?.tilePosition;
      if (targetTile) {
        // 伙伴追击战斗目标时改用跑步，避免玩家被攻击时伙伴慢悠悠走过来
        if (npc.isPartner) {
          npc.runTo(targetTile);
        } else {
          npc.walkTo(targetTile);
        }
      }
    }
  }

  /**
   * 目标丢失时的处理
   */
  private followTargetLost(): void {
    const npc = this._npc;
    npc.cancelAttackTarget();
    if (npc.isPartner && !this.npcManager.isPartnerBlockingPlayer) {
      this.moveToPlayer();
    }
  }

  // === 距离管理 ===

  /**
   * 生命值低时保持距离
   */
  keepDistanceWhenLifeLow(): boolean {
    const npc = this._npc;

    if (
      npc.followTarget !== null &&
      npc.keepRadiusWhenLifeLow > 0 &&
      npc.lifeMax > 0 &&
      npc.life / npc.lifeMax <= npc.lifeLowPercent / 100.0
    ) {
      const tileDistance = getViewTileDistance(
        { x: npc.mapX, y: npc.mapY },
        npc.followTarget.tilePosition
      );
      if (tileDistance < npc.keepRadiusWhenLifeLow) {
        if (
          npc.moveAwayTarget(
            npc.followTarget.pixelPosition,
            npc.keepRadiusWhenLifeLow - tileDistance,
            false
          )
        ) {
          return true;
        }
      }
    }
    return false;
  }

  /**
   * 友方死亡时与杀手保持距离
   */
  checkKeepDistanceWhenFriendDeath(): boolean {
    const npc = this._npc;

    if (npc.keepRadiusWhenFriendDeath <= 0) {
      return false;
    }

    // Follower 类型无效
    if (npc.kind === CharacterKind.Follower) {
      return false;
    }

    let target = this._keepDistanceCharacterWhenFriendDeath;

    // 检查当前目标是否仍有效
    if (target === null || target.isDeathInvoked) {
      target = null;
      this._keepDistanceCharacterWhenFriendDeath = null;

      // 查找被活着的角色杀死的友方
      if (this.npcManager) {
        const dead = this.npcManager.findFriendDeadKilledByLiveCharacter(
          npc,
          npc.getVisionRadius()
        );
        if (dead) {
          const lastAttacker = dead.lastAttacker;
          if (lastAttacker && !lastAttacker.isDeathInvoked) {
            target = lastAttacker;
            this._keepDistanceCharacterWhenFriendDeath = target;
          }
        }
      }
    }

    // 如果有需要保持距离的目标
    if (target !== null) {
      const tileDistance = getViewTileDistance({ x: npc.mapX, y: npc.mapY }, target.tilePosition);
      if (tileDistance < npc.keepRadiusWhenFriendDeath) {
        if (
          npc.moveAwayTarget(
            target.positionInWorld,
            npc.keepRadiusWhenFriendDeath - tileDistance,
            false
          )
        ) {
          return true;
        }
      }
    }

    return false;
  }

  /**
   * 保持与目标的最小距离（用于 AfraidPlayerAnimal）
   */
  keepMinTileDistance(targetTilePosition: Vector2, minTileDistance: number): void {
    const npc = this._npc;

    const tileDistance = getViewTileDistance({ x: npc.mapX, y: npc.mapY }, targetTilePosition);

    if (tileDistance < minTileDistance && npc.isStanding()) {
      const targetPixel = {
        x: targetTilePosition.x * 32, // 简化的瓦片转像素
        y: targetTilePosition.y * 32,
      };
      npc.moveAwayTarget(targetPixel, minTileDistance - tileDistance, false);
    }
  }

  // === 辅助方法 ===

  /**
   * 更新致盲时间
   */
  private updateBlindTime(deltaTime: number): void {
    if (this._npc.blindMilliseconds > 0) {
      this._npc.blindMilliseconds -= deltaTime * 1000;
    }
  }

  /**
   * 检查固定攻击位置
   */
  private checkKeepAttack(): boolean {
    const npc = this._npc;

    if (this.npcManager.isGlobalAIDisabled || npc.isAIDisabled) return false;

    if (npc.keepAttackX > 0 || npc.keepAttackY > 0) {
      if (
        npc.state === CharacterState.Stand ||
        npc.state === CharacterState.Stand1 ||
        npc.state === CharacterState.FightStand
      ) {
        npc.attacking({ x: npc.keepAttackX, y: npc.keepAttackY });
      }
      return true;
    }
    return false;
  }

  /**
   * 检查并使用低生命时的武功
   */
  private checkUseMagicWhenLifeLow(): void {
    const npc = this._npc;

    if (this.npcManager.isGlobalAIDisabled || npc.isAIDisabled) return;

    if (
      npc.magicToUseWhenLifeLow &&
      npc.lifeMax > 0 &&
      npc.life / npc.lifeMax <= npc.lifeLowPercent / 100.0
    ) {
      npc.useMagicWhenLifeLow();
    }
  }

  /**
   * 更新攻击间隔计数器
   */
  private updateIdleFrame(): void {
    const npc = this._npc;
    if (npc.idledFrame < npc.idle) {
      npc.idledFrame++;
    }
  }

  /**
   * 处理无目标时的行为
   */
  private handleNoTarget(): void {
    const npc = this._npc;

    // 处理脚本设置的目标位置
    if ((npc.destinationMapPosX !== 0 || npc.destinationMapPosY !== 0) && npc.isStanding()) {
      if (npc.mapX === npc.destinationMapPosX && npc.mapY === npc.destinationMapPosY) {
        npc.destinationMapPosX = 0;
        npc.destinationMapPosY = 0;
      } else {
        npc.walkTo(
          { x: npc.destinationMapPosX, y: npc.destinationMapPosY },
          PathType.PerfectMaxPlayerTry
        );
        if (npc.path.length === 0) {
          npc.destinationMapPosX = 0;
          npc.destinationMapPosY = 0;
        }
      }
    } else {
      // 随机移动随机攻击行为
      if (
        npc.isRandMoveRandAttack &&
        npc.isStanding() &&
        !this.npcManager.isGlobalAIDisabled &&
        !npc.isAIDisabled
      ) {
        const poses = npc.getRandTilePathForAI(2, false, 10);
        if (poses.length >= 2) {
          npc.walkTo(poses[1]);
        }
      }
    }
  }

  /**
   * 处理非战斗行为
   */
  private handleNonFighterBehavior(): void {
    const npc = this._npc;

    if (
      (npc.followTarget === null || !npc.isFollowTargetFound) &&
      !(npc.isFighterKind && (this.npcManager.isGlobalAIDisabled || npc.isAIDisabled))
    ) {
      const isFlyer = npc.kind === CharacterKind.Flyer;
      const randWalkProbability = 400;
      const flyerRandWalkProbability = 20;

      // 沿 FixedPos 循环行走
      if (npc.action === ActionType.LoopWalk && npc.fixedPathTilePositions !== null) {
        npc.loopWalkForAI(
          npc.fixedPathTilePositions,
          isFlyer ? flyerRandWalkProbability : randWalkProbability,
          isFlyer
        );
      } else {
        // 根据 Kind 和 Action 处理
        switch (npc.kind) {
          case CharacterKind.Normal:
          case CharacterKind.Fighter:
          case CharacterKind.GroundAnimal:
          case CharacterKind.Eventer:
          case CharacterKind.Flyer:
            if (npc.action === ActionType.RandWalk) {
              npc.randWalkForAI(
                npc.actionPathTilePositions,
                isFlyer ? flyerRandWalkProbability : randWalkProbability,
                isFlyer
              );
            }
            break;
          // AfraidPlayerAnimal 与玩家保持距离
          case CharacterKind.AfraidPlayerAnimal:
            this.keepMinTileDistance(this.player.tilePosition, npc.getVisionRadius());
            break;
        }
      }
    }
  }

  /**
   * 伙伴跟随玩家
   */
  private moveToPlayer(): void {
    if (!this.player.isStanding()) {
      this._npc.partnerMoveTo(this.player.tilePosition);
    }
  }

  /**
   * 获取玩家或最近的友方战斗者
   */
  private getPlayerOrFighterFriend(): Character | null {
    return this.npcManager.getLiveClosestPlayerOrFighterFriend(
      this._npc.positionInWorld,
      false,
      false,
      null,
      this.searchRadiusPx()
    );
  }

  /**
   * 获取最近的敌方角色
   */
  private getClosestEnemyCharacter(): Character | null {
    return this.npcManager.getClosestEnemyTypeCharacter(
      this._npc.positionInWorld,
      true,
      false,
      null,
      this.searchRadiusPx()
    );
  }

  /**
   * 获取最近的非中立战斗者
   */
  private getClosestNonneturalFighter(): Character | null {
    return this.npcManager.getLiveClosestNonneturalFighter(
      this._npc.positionInWorld,
      null,
      this.searchRadiusPx()
    );
  }

  /**
   * 清理资源
   */
  dispose(): void {
    this._keepDistanceCharacterWhenFriendDeath = null;
  }
}
