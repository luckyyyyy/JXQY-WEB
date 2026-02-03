/**
 * NpcAI - NPC 人工智能行为管理器
 *
 * 管理 NPC 的 AI 行为，包括目标查找、跟随、攻击、距离管理等。
 * 通过组合模式将 AI 逻辑从 Npc 类中解耦。
 *
 * 通过构造函数注入依赖，避免污染 Npc 的公共 API。
 */

import type { Character } from "../../character";
import { PathType } from "../../core/pathFinder";
import { ActionType, CharacterKind, CharacterState } from "../../core/types";
import type { Vector2 } from "../../core/types";
import type { Npc } from "../npc";
import type { NpcManager } from "../npcManager";

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
 * NpcAI 依赖注入接口
 */
export interface NpcAIDeps {
  getNpcManager: () => NpcManager;
  getPlayer: () => Character;
  getViewTileDistance: (from: Vector2, to: Vector2) => number;
  canViewTarget: (from: Vector2, to: Vector2, maxDistance: number) => boolean;
  getRandTilePath: (length: number, ignoreObstacle: boolean, maxRetry?: number) => Vector2[];
  loopWalk: (path: Vector2[], probability: number, isFlyer: boolean) => void;
  randWalk: (path: Vector2[], probability: number, isFlyer: boolean) => void;
}

/**
 * NpcAI - NPC AI 行为管理器
 */
export class NpcAI {
  private _npc: Npc;
  private _deps: NpcAIDeps;

  /** 保持距离的角色（当友方死亡时） */
  private _keepDistanceCharacterWhenFriendDeath: Character | null = null;

  constructor(npc: Npc, deps: NpcAIDeps) {
    this._npc = npc;
    this._deps = deps;
  }

  // === Manager 访问（通过注入的依赖）===

  private get npcManager(): NpcManager {
    return this._deps.getNpcManager();
  }

  private get player(): Character {
    return this._deps.getPlayer();
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

    if (
      this.npcManager.isGlobalAIDisabled ||
      npc.isAIDisabled ||
      npc.blindMilliseconds > 0
    ) {
      npc.followTarget = null;
      npc.isFollowTargetFound = false;
      return;
    }

    if (npc.isEnemy) {
      this.findEnemyTarget();
    } else if (npc.isFighterFriend) {
      this.findFriendlyTarget();
    } else if (npc.isNoneFighter) {
      this.findNoneFighterTarget();
    } else if (npc.isPartner) {
      this.moveToPlayer();
    }

    if (npc.followTarget === null) {
      npc.isFollowTargetFound = false;
    }
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
          npc.positionInWorld
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
  private findFriendlyTarget(): void {
    const npc = this._npc;

    if (npc.stopFindingTarget === 0) {
      npc.followTarget = this.getClosestEnemyCharacter();
    } else if (npc.followTarget?.isDeathInvoked) {
      npc.followTarget = null;
    }

    // 如果没有敌人且是伙伴，跟随玩家
    if (npc.followTarget === null && npc.isPartner) {
      this.moveToPlayer();
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
    const tileDistance = this._deps.getViewTileDistance(
      { x: npc.mapX, y: npc.mapY },
      targetTilePosition
    );

    let canSeeTarget = false;

    if (tileDistance <= npc.visionRadius) {
      canSeeTarget = this._deps.canViewTarget(
        { x: npc.mapX, y: npc.mapY },
        targetTilePosition,
        npc.visionRadius
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

    if (
      this.npcManager.isGlobalAIDisabled ||
      npc.isAIDisabled ||
      npc.blindMilliseconds > 0
    ) {
      npc.cancleAttackTarget();
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
        npc.walkTo(targetTile);
      }
    }
  }

  /**
   * 目标丢失时的处理
   */
  private followTargetLost(): void {
    const npc = this._npc;
    npc.cancleAttackTarget();
    if (npc.isPartner) {
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
      const tileDistance = this._deps.getViewTileDistance(
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
        const dead = this.npcManager.findFriendDeadKilledByLiveCharacter(npc, npc.visionRadius);
        if (dead) {
          const lastAttacker = (dead as unknown as { _lastAttacker?: Character | null })
            ._lastAttacker;
          if (lastAttacker && !lastAttacker.isDeathInvoked) {
            target = lastAttacker;
            this._keepDistanceCharacterWhenFriendDeath = target;
          }
        }
      }
    }

    // 如果有需要保持距离的目标
    if (target !== null) {
      const tileDistance = this._deps.getViewTileDistance(
        { x: npc.mapX, y: npc.mapY },
        target.tilePosition
      );
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

    const tileDistance = this._deps.getViewTileDistance(
      { x: npc.mapX, y: npc.mapY },
      targetTilePosition
    );

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
    if (
      (npc.destinationMapPosX !== 0 || npc.destinationMapPosY !== 0) &&
      npc.isStanding()
    ) {
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
      if (npc.isRandMoveRandAttack && npc.isStanding()) {
        const poses = this._deps.getRandTilePath(2, false, 10);
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
        this._deps.loopWalk(
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
              this._deps.randWalk(
                npc.actionPathTilePositions,
                isFlyer ? flyerRandWalkProbability : randWalkProbability,
                isFlyer
              );
            }
            break;
          // AfraidPlayerAnimal 与玩家保持距离
          case CharacterKind.AfraidPlayerAnimal:
            this.keepMinTileDistance(this.player.tilePosition, npc.visionRadius);
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
      false
    );
  }

  /**
   * 获取最近的敌方角色
   */
  private getClosestEnemyCharacter(): Character | null {
    return this.npcManager.getClosestEnemyTypeCharacter(this._npc.positionInWorld, true, false);
  }

  /**
   * 获取最近的非中立战斗者
   */
  private getClosestNonneturalFighter(): Character | null {
    return this.npcManager.getLiveClosestNonneturalFighter(this._npc.positionInWorld);
  }

  /**
   * 清理资源
   */
  dispose(): void {
    this._keepDistanceCharacterWhenFriendDeath = null;
  }
}
