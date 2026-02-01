/**
 * CharacterCombat - 战斗相关功能
 * 包含战斗状态、攻击、伤害、死亡等功能
 *
 * 继承链: Sprite → CharacterBase → CharacterMovement → CharacterCombat → Character
 */

import { logger } from "../../core/logger";
import type { Vector2 } from "../../core/types";
import { CharacterState } from "../../core/types";
import { tileToPixel } from "../../utils";
import type { MagicSprite } from "../../magic/magicSprite";
import { getEffectAmount } from "../../magic/effects/common";
import { CharacterMovement } from "./characterMovement";
import { type CharacterBase, type MagicToUseInfoItem } from "./characterBase";

/**
 * CharacterCombat - 战斗功能层
 */
export abstract class CharacterCombat extends CharacterMovement {
  // =============================================
  // === Combat State Methods ===
  // =============================================

  /**
   * 进入战斗状态
   */
  toFightingState(): void {
    this._isInFighting = true;
    this._totalNonFightingSeconds = 0;
  }

  /**
   * 设置战斗状态
   */
  setFightState(isFight: boolean): void {
    if (isFight) {
      this.toFightingState();
      this.state = CharacterState.FightStand;
    } else {
      this.toNonFightingState();
      this.state = CharacterState.Stand;
    }
  }

  // =============================================
  // === Life/Mana/Thew Methods ===
  // =============================================

  fullLife(): void {
    this.life = this.lifeMax;
    this.isDeath = false;
    this.isDeathInvoked = false;
    this.isBodyIniAdded = 0;
  }

  fullThew(): void {
    this.thew = this.thewMax;
  }

  fullMana(): void {
    this.mana = this.manaMax;
  }

  addLife(amount: number): void {
    this.life = Math.max(0, Math.min(this.life + amount, this.lifeMax));
    if (this.life <= 0) {
      this.onDeath(null);
    }
  }

  addThew(amount: number): void {
    this.thew = Math.max(0, Math.min(this.thew + amount, this.thewMax));
  }

  addMana(amount: number): void {
    this.mana = Math.max(0, Math.min(this.mana + amount, this.manaMax));
  }

  /**
   * 增加经验
   */
  addExp(amount: number): void {
    if (this.levelUpExp <= 0 || this.canLevelUp <= 0) return;

    this.exp += amount;
    if (this.exp > this.levelUpExp) {
      // TODO: 实现 NPC 升级逻辑
    }
  }

  isDead(): boolean {
    return this.life <= 0;
  }

  // =============================================
  // === Damage Methods ===
  // =============================================

  /**
   * 计算击杀经验
   */
  static getCharacterDeathExp(killer: CharacterBase, dead: CharacterBase): number {
    if (!killer || !dead) return 1;
    const exp = killer.level * dead.level + (dead.expBonus ?? 0);
    return exp < 4 ? 4 : exp;
  }

  /**
   * 受到伤害
   */
  takeDamage(damage: number, attacker: CharacterBase | null): void {
    if (this.isDeathInvoked || this.isDeath) return;

    // 调试无敌模式
    if (this.isPlayer && this.engine.getManager("debug")?.isGodMode()) {
      return;
    }

    if (damage <= 0 || this.invincible > 0 || this.life <= 0) return;

    // 检查免疫盾
    for (const sprite of this._magicSpritesInEffect) {
      if (sprite.magic.moveKind === 13 && sprite.magic.specialKind === 6) {
        return;
      }
    }

    this._lastAttacker = attacker as CharacterCombat | null;

    // 命中率计算
    const targetEvade = this.realEvade;
    const attackerEvade = (attacker as CharacterCombat)?.realEvade ?? 0;
    const maxOffset = 100;
    const baseHitRatio = 0.05;
    const belowRatio = 0.5;
    const upRatio = 0.45;

    let hitRatio = baseHitRatio;
    if (targetEvade >= attackerEvade) {
      if (targetEvade > 0) {
        hitRatio += (attackerEvade / targetEvade) * belowRatio;
      } else {
        hitRatio += belowRatio;
      }
    } else {
      let upOffsetRatio = (attackerEvade - targetEvade) / maxOffset;
      if (upOffsetRatio > 1) upOffsetRatio = 1;
      hitRatio += belowRatio + upOffsetRatio * upRatio;
    }

    const roll = Math.random();
    if (roll > hitRatio) {
      logger.log(
        `[Character] ${attacker?.name || "Unknown"} missed ${this.name}`
      );
      return;
    }

    // 计算伤害
    let actualDamage = Math.max(0, damage - this.realDefend);

    // 护盾减伤
    for (const sprite of this._magicSpritesInEffect) {
      if (sprite.magic.moveKind === 13 && sprite.magic.specialKind === 3) {
        const shieldEffect = (sprite.magic.effect === 0 ? this.attack : sprite.magic.effect) + (sprite.magic.effectExt || 0);
        actualDamage -= shieldEffect;
      }
    }

    const minimalDamage = 5;
    if (actualDamage < minimalDamage) {
      actualDamage = minimalDamage;
    }
    if (actualDamage > this.life) {
      actualDamage = this.life;
    }

    this.life -= actualDamage;

    logger.log(
      `[Character] ${this.name} took ${actualDamage} damage from ${attacker?.name || "Unknown"}`
    );

    this.onDamaged(attacker as CharacterCombat | null, actualDamage);

    if (this.life <= 0) {
      this.life = 0;

      // 经验处理
      if (attacker && (attacker.isPlayer || attacker.isFighterFriend)) {
        const player = this.engine.player;
        if (player) {
          const exp = CharacterCombat.getCharacterDeathExp(player as CharacterCombat, this);
          player.addExp(exp, true);
        }
      }

      this.onDeath(attacker as CharacterCombat | null);
    } else {
      this.hurting();
    }
  }

  /**
   * 受到魔法伤害
   */
  takeDamageFromMagic(
    damage: number,
    damage2: number,
    damage3: number,
    damageMana: number,
    attacker: CharacterBase | null
  ): number {
    if (this.isDeathInvoked || this.isDeath) return 0;

    if (this.isPlayer && this.engine.getManager("debug")?.isGodMode()) {
      return 0;
    }

    if (this.invincible > 0 || this.life <= 0) return 0;

    this._lastAttacker = attacker as CharacterCombat | null;

    // 检查免疫盾
    for (const sprite of this._magicSpritesInEffect) {
      if (sprite.magic.moveKind === 13 && sprite.magic.specialKind === 6) {
        return 0;
      }
    }

    // 命中率计算
    const targetEvade = this.realEvade;
    const attackerEvade = (attacker as CharacterCombat)?.realEvade ?? 0;
    const maxOffset = 100;
    const baseHitRatio = 0.05;
    const belowRatio = 0.5;
    const upRatio = 0.45;

    let hitRatio = baseHitRatio;
    if (targetEvade >= attackerEvade) {
      if (targetEvade > 0) {
        hitRatio += (attackerEvade / targetEvade) * belowRatio;
      } else {
        hitRatio += belowRatio;
      }
    } else {
      let upOffsetRatio = (attackerEvade - targetEvade) / maxOffset;
      if (upOffsetRatio > 1) upOffsetRatio = 1;
      hitRatio += belowRatio + upOffsetRatio * upRatio;
    }

    const roll = Math.random();
    if (roll > hitRatio) {
      logger.log(`[Character] ${attacker?.name || "Unknown"} magic missed ${this.name}`);
      return 0;
    }

    // 多类型伤害
    let effect = damage - this.realDefend;
    let effect2 = damage2 - this.defend2;
    let effect3 = damage3 - this.defend3;

    // 护盾减伤
    for (const sprite of this._magicSpritesInEffect) {
      if (sprite.magic.moveKind === 13 && sprite.magic.specialKind === 3) {
        const m = sprite.magic;
        const damageReduce = getEffectAmount(m, this, "effect");
        const damageReduce2 = getEffectAmount(m, this, "effect2");
        const damageReduce3 = getEffectAmount(m, this, "effect3");
        effect3 -= damageReduce3;
        effect2 -= damageReduce2;
        effect -= damageReduce;
      }
    }

    let totalEffect = effect;
    if (effect3 > 0) totalEffect += effect3;
    if (effect2 > 0) totalEffect += effect2;

    if (totalEffect < 5) totalEffect = 5;
    if (totalEffect > this.life) totalEffect = this.life;

    this.life -= totalEffect;

    if (damageMana > 0 && this.mana > 0) {
      this.mana = Math.max(0, this.mana - damageMana);
    }

    logger.log(
      `[Character] ${this.name} took ${totalEffect} magic damage (${this.life}/${this.lifeMax} HP)`
    );

    this.onDamaged(attacker as CharacterCombat | null, totalEffect);

    if (this.life <= 0) {
      this.life = 0;
      this.onDeath(attacker as CharacterCombat | null);
    } else {
      this.hurting();
    }

    return totalEffect;
  }

  /**
   * 播放受伤动画
   */
  hurting(): void {
    const maxRandValue = 4;
    if (Math.floor(Math.random() * maxRandValue) !== 0) {
      return;
    }

    if (this.petrifiedSeconds > 0) {
      return;
    }

    if (this._state === CharacterState.Magic && this.isNoInterruptionMagic()) {
      return;
    }

    if (
      this._state === CharacterState.Death ||
      this._state === CharacterState.Hurt ||
      this.isDeathInvoked ||
      this.isDeath
    ) {
      return;
    }

    this.stateInitialize();

    if (this.isStateImageOk(CharacterState.Hurt)) {
      this.state = CharacterState.Hurt;
      this.playCurrentDirOnce();
    }
  }

  protected isNoInterruptionMagic(): boolean {
    return false;
  }

  protected onDamaged(_attacker: CharacterCombat | null, _damage: number): void {
    // Override in subclasses
  }

  // =============================================
  // === Death Methods ===
  // =============================================

  protected onDeath(killer: CharacterCombat | null): void {
    if (this.isDeathInvoked) return;
    this.isDeathInvoked = true;

    // 同步位置到 tile 中心
    const expectedPixel = tileToPixel(this._mapX, this._mapY);
    const actualPixel = this._positionInWorld;
    const diff = Math.abs(expectedPixel.x - actualPixel.x) + Math.abs(expectedPixel.y - actualPixel.y);
    if (diff > 1) {
      logger.debug(`[Character] ${this.name} death position sync`);
      this._positionInWorld = { ...expectedPixel };
    }

    logger.log(`[Character] ${this.name} died${killer ? ` (killed by ${killer.name})` : ""}`);

    this.endPlayCurrentDirOnce();
    this.state = CharacterState.Death;
    this.playCurrentDirOnce();
  }

  death(): void {
    this.onDeath(null);
  }

  // =============================================
  // === Attack Methods ===
  // =============================================

  /**
   * 检查攻击是否OK（距离、魔法选择）
   */
  attackingIsOk(): { isOk: boolean; magicIni: string | null } {
    if (!this._destinationAttackTilePosition) {
      return { isOk: false, magicIni: null };
    }

    const tileDistance = this.getViewTileDistance(
      this.tilePosition,
      this._destinationAttackTilePosition
    );
    const attackRadius = this.getClosedAttackRadius(tileDistance);

    if (tileDistance === attackRadius) {
      const canSeeTarget = this.canViewTarget(
        this.tilePosition,
        this._destinationAttackTilePosition,
        tileDistance
      );

      if (canSeeTarget) {
        const magicIni = this.getRandomMagicWithUseDistance(attackRadius);
        const hasMagic = this._flyIniInfos.length > 0;
        if (magicIni !== null || !hasMagic) {
          return { isOk: true, magicIni };
        }
        return { isOk: false, magicIni: null };
      }

      this.moveToTarget(this._destinationAttackTilePosition, this._isRunToTarget);
      return { isOk: false, magicIni: null };
    }

    if (tileDistance > attackRadius) {
      this.moveToTarget(this._destinationAttackTilePosition, this._isRunToTarget);
      return { isOk: false, magicIni: null };
    }

    const hasMagic = this._flyIniInfos.length > 0;
    if (!hasMagic) {
      return { isOk: true, magicIni: null };
    }

    const destPixel = tileToPixel(
      this._destinationAttackTilePosition.x,
      this._destinationAttackTilePosition.y
    );
    if (!this.moveAwayTarget(destPixel, attackRadius - tileDistance, this._isRunToTarget)) {
      const magicIni = this.getRandomMagicWithUseDistance(attackRadius);
      return { isOk: magicIni !== null, magicIni };
    }

    return { isOk: false, magicIni: null };
  }

  // =============================================
  // === Summon/Magic Management ===
  // =============================================

  summonedNpcsCount(magicFileName: string): number {
    const list = this._summonedNpcs.get(magicFileName);
    return list ? list.length : 0;
  }

  addSummonedNpc(magicFileName: string, npc: { isDeath: boolean; death: () => void }): void {
    let list = this._summonedNpcs.get(magicFileName);
    if (!list) {
      list = [];
      this._summonedNpcs.set(magicFileName, list);
    }
    list.push(npc as Parameters<typeof this._summonedNpcs.set>[1][0]);
  }

  removeFirstSummonedNpc(magicFileName: string): void {
    const list = this._summonedNpcs.get(magicFileName);
    if (!list || list.length === 0) return;

    const npc = list.shift();
    if (npc) {
      npc.death();
    }
  }

  protected cleanupDeadSummonedNpcs(): void {
    for (const [magicFileName, list] of this._summonedNpcs) {
      const aliveNpcs = list.filter(npc => !npc.isDeath);
      if (aliveNpcs.length !== list.length) {
        this._summonedNpcs.set(magicFileName, aliveNpcs);
      }
    }
  }

  // =============================================
  // === MagicToUseWhenAttacked ===
  // =============================================

  removeMagicToUseWhenAttackedList(from: string): void {
    this.magicToUseWhenAttackedList = this.magicToUseWhenAttackedList.filter(
      item => item.from !== from
    );
  }

  addMagicToUseWhenAttackedList(info: MagicToUseInfoItem): void {
    this.magicToUseWhenAttackedList.push(info);
  }

  // =============================================
  // === FlyIni Methods ===
  // =============================================

  setFlyIni(value: string): void {
    this.flyIni = value;
    this.buildFlyIniInfos();
  }

  setFlyIni2(value: string): void {
    this.flyIni2 = value;
    this.buildFlyIniInfos();
  }

  setFlyInis(value: string): void {
    this.flyInis = value;
    this.buildFlyIniInfos();
  }

  addFlyInis(magicFileName: string, distance: number): void {
    const entry = `${magicFileName}:${distance};`;
    if (!this.flyInis) {
      this.flyInis = entry;
    } else {
      this.flyInis = (this.flyInis.endsWith(";") ? this.flyInis : this.flyInis + ";") + entry;
    }
    this.buildFlyIniInfos();
  }

  protected buildFlyIniInfos(): void {
    this._flyIniManager.build(this.attackRadius, this.name);
  }

  addFlyIniReplace(magicFileName: string): void {
    this._flyIniManager.addFlyIniReplace(magicFileName, this.attackRadius);
  }

  removeFlyIniReplace(magicFileName: string): void {
    this._flyIniManager.removeFlyIniReplace(magicFileName, this.attackRadius);
  }

  addFlyIni2Replace(magicFileName: string): void {
    this._flyIniManager.addFlyIni2Replace(magicFileName, this.attackRadius);
  }

  removeFlyIni2Replace(magicFileName: string): void {
    this._flyIniManager.removeFlyIni2Replace(magicFileName, this.attackRadius);
  }

  getClosedAttackRadius(toTargetDistance: number): number {
    if (!this._flyIniManager.hasMagicConfigured) {
      return this.getAttackRadius();
    }
    return this._flyIniManager.getClosedAttackRadius(toTargetDistance);
  }

  getRandomMagicWithUseDistance(useDistance: number): string | null {
    return this._flyIniManager.getRandomMagicWithUseDistance(useDistance);
  }

  hasMagicConfigured(): boolean {
    return this._flyIniManager.hasMagicConfigured;
  }

  // =============================================
  // === Notify Fighters ===
  // =============================================

  notifyFighterAndAllNeighbor(target: CharacterBase | null): void {
    if (
      target === null ||
      (!this.isEnemy && !this.isNoneFighter) ||
      this.followTarget !== null ||
      this.isNotFightBackWhenBeHit
    ) {
      return;
    }

    const npcManager = this.engine.npcManager;
    if (!npcManager) return;

    const characters = (
      this.isEnemy
        ? npcManager.getNeighborEnemy(this)
        : npcManager.getNeighborNeutralFighter(this)
    ) as CharacterCombat[];

    characters.push(this);

    for (const character of characters) {
      if (
        character.followTarget !== null &&
        character.isFollowTargetFound &&
        this.getDistance(character.pixelPosition, character.followTarget.pixelPosition) <
          this.getDistance(character.pixelPosition, target.pixelPosition)
      ) {
        continue;
      }
      character.followAndWalkToTarget(target);
    }
  }

  private getDistance(a: Vector2, b: Vector2): number {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    return Math.sqrt(dx * dx + dy * dy);
  }
}
