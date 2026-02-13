/**
 * CharacterCombat - 战斗相关功能
 * 包含战斗状态、攻击、伤害、死亡等功能
 *
 * 继承链: Sprite → CharacterBase → CharacterMovement → CharacterCombat → Character
 */

import { ResourcePath } from "../../resource/resource-paths";
import { logger } from "../../core/logger";
import type { Vector2 } from "../../core/types";
import { CharacterState } from "../../core/types";
import { getEffectAmount, getCharacterDeathExp } from "../../magic/effect-calc";
import { type AsfData, getCachedAsf, loadAsf } from "../../resource/format/asf";
import { tileToPixel } from "../../utils";
import type { CharacterBase, MagicToUseInfoItem } from "./character-base";
import { CharacterMovement } from "./character-movement";

// Module-level cached death animation ASF data
let _frozenDie: AsfData | null = null;
let _poisonDie: AsfData | null = null;
let _petrifiedDie: AsfData | null = null;

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
      this.death(null);
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
      // Reference: GuiManager.ShowMessage(Name + "的等级提升了");
      const gui = this.gui as { showMessage?: (msg: string) => void };
      gui.showMessage?.(`${this.name}的等级提升了`);
      this.toLevelByExp(this.exp);
    }
  }

  /**
   * 根据经验值计算应该升到的等级
   */
  private toLevelByExp(exp: number): void {
    const levelConfig = this.levelManager.getLevelConfig();
    if (!levelConfig) return;

    const count = levelConfig.size;
    let targetLevel = 1;
    for (let i = 1; i <= count; i++) {
      const detail = levelConfig.get(i);
      if (detail && detail.levelUpExp > exp) {
        break;
      }
      targetLevel = i;
    }
    this.levelUpTo(targetLevel);
  }

  /**
   * 升级到指定等级
   */
  levelUpTo(level: number): void {
    const levelConfig = this.levelManager.getLevelConfig();
    if (!levelConfig) {
      this.level = level;
      return;
    }

    const currentDetail = levelConfig.get(this.level);
    let detail = levelConfig.get(level);

    let isMaxLevel = false;
    if (!detail) {
      if (level > levelConfig.size) {
        isMaxLevel = true;
        // 找到最大可用等级
        for (let i = level; i >= 1; i--) {
          detail = levelConfig.get(i);
          if (detail) break;
        }
      } else {
        logger.warn(`[Character] ${this.name} LevelIni 没有设置等级 ${level}`);
      }
    }

    if (detail && currentDetail) {
      // 增量升级属性
      this.lifeMax += detail.lifeMax - currentDetail.lifeMax;
      this.thewMax += detail.thewMax - currentDetail.thewMax;
      this.manaMax += detail.manaMax - currentDetail.manaMax;
      this.life = this.lifeMax;
      this.thew = this.thewMax;
      this.mana = this.manaMax;
      this.attack += detail.attack - currentDetail.attack;
      this.attack2 += detail.attack2 - currentDetail.attack2;
      this.attack3 += detail.attack3 - currentDetail.attack3;
      this.defend += detail.defend - currentDetail.defend;
      this.defend2 += detail.defend2 - currentDetail.defend2;
      this.defend3 += detail.defend3 - currentDetail.defend3;
      this.evade += detail.evade - currentDetail.evade;
      this.levelUpExp = detail.levelUpExp;
    }

    if (isMaxLevel) {
      this.exp = 0;
      this.levelUpExp = 0;
    }

    this.level = level;
  }

  isDead(): boolean {
    return this.life <= 0;
  }

  // =============================================
  // === Damage Methods ===
  // =============================================


  /**
   * 受到伤害
   */
  takeDamage(damage: number, attacker: CharacterBase | null): void {
    if (this.isDeathInvoked || this.isDeath) return;

    // 调试无敌模式
    if (this.isPlayer && this.debug.isGodMode()) {
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
      logger.log(`[Character] ${attacker?.name || "Unknown"} missed ${this.name}`);
      return;
    }

    // 计算伤害
    let actualDamage = Math.max(0, damage - this.realDefend);

    // 护盾减伤
    for (const sprite of this._magicSpritesInEffect) {
      if (sprite.magic.moveKind === 13 && sprite.magic.specialKind === 3) {
        const shieldEffect =
          (sprite.magic.effect === 0 ? this.attack : sprite.magic.effect) +
          (sprite.magic.effectExt || 0);
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
          const exp = getCharacterDeathExp(player, this);
          player.addExp(exp, true);
        }
      }

      this.death(attacker as CharacterCombat | null);
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

    if (this.isPlayer && this.debug.isGodMode()) {
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
      this.death(attacker as CharacterCombat | null);
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

  /**
   * 角色死亡处理
   * Reference: Character.Death()
   */
  death(killer: CharacterCombat | null = null): void {
    if (this.isDeathInvoked) return;
    this.isDeathInvoked = true;

    // if (ReviveMilliseconds > 0) LeftMillisecondsToRevive = ReviveMilliseconds;
    if (this.reviveMilliseconds > 0) {
      this.leftMillisecondsToRevive = this.reviveMilliseconds;
    }

    // InvisibleByMagicTime = 0
    this.statusEffects.invisibleByMagicTime = 0;

    // SppedUpByMagicSprite = null (取消加速效果)
    this.statusEffects.speedUpByMagicSprite = null;

    // if (ControledMagicSprite != null) - 处理被控制状态
    // 原版代码: var player = ControledMagicSprite.BelongCharacter as Player; player.EndControlCharacter();
    if (this.statusEffects.controledMagicSprite !== null) {
      // TypeScript 中通过 belongCharacterId 判断是否是玩家控制
      if (this.statusEffects.controledMagicSprite.belongCharacterId === "player") {
        this.engine.player.endControlCharacter();
      }
      this.statusEffects.controledMagicSprite = null;
    }

    // if (SummonedByMagicSprite != null) - 召唤物死亡处理
    if (this.summonedByMagicSprite !== null) {
      this.isDeath = true;
      if (!this.summonedByMagicSprite.isInDestroy && !this.summonedByMagicSprite.isDestroyed) {
        this.summonedByMagicSprite.destroy();
      }
      return; // 召唤物不播放死亡动画
    }

    // 同步位置到 tile 中心
    const expectedPixel = tileToPixel(this._mapX, this._mapY);
    const actualPixel = this._positionInWorld;
    const diff =
      Math.abs(expectedPixel.x - actualPixel.x) + Math.abs(expectedPixel.y - actualPixel.y);
    if (diff > 1) {
      logger.debug(`[Character] ${this.name} death position sync`);
      this._positionInWorld = { ...expectedPixel };
    }

    logger.log(`[Character] ${this.name} died${killer ? ` (killed by ${killer.name})` : ""}`);

    // 特殊动作播放中死亡：延迟到动作结束再处理
    // C# 中 ScriptManager.Update 在 Character.Update 之后运行，同帧内就处理完
    // TS 中脚本更新在角色更新之前，且用 async/await 微任务，需要延迟死亡处理
    if (this.isInSpecialAction) {
      // 只标记待处理死亡，不设置 isDeath（避免 isDraw 返回 false 导致角色消失）
      // endSpecialAction() 时会检查并处理
      this._pendingDeath = true;
      this._pendingDeathKiller = killer;
      return;
    }

    this.stateInitialize();

    if (this.isStateImageOk(CharacterState.Death)) {
      this.state = CharacterState.Death;

      // Reference: Character.Death() - 状态效果死亡动画
      // 冰冻死亡 -> 冰碎动画
      if (this.isFrozen && this.isFrozenVisualEffect) {
        this.applySpecialDeathAnimation("frozen");
      }
      // 中毒死亡 -> 毒气动画
      else if (this.isPoisoned && this.isPoisonVisualEffect) {
        this.applySpecialDeathAnimation("poison");
      }
      // 石化死亡 -> 石碎动画
      else if (this.isPetrified && this.isPetrifiedVisualEffect) {
        this.applySpecialDeathAnimation("petrified");
      }

      // 清除冰冻、中毒、石化状态
      this.statusEffects.toNormalState();
      this.playCurrentDirOnce();
    } else {
      this.isDeath = true;
    }
  }

  /**
   * 应用特殊死亡动画
   * - FrozenDie/PoisonDie/PetrifiedDie
   */
  private applySpecialDeathAnimation(type: "frozen" | "poison" | "petrified"): void {
    let asf: AsfData | null = null;
    let asfPath = "";

    switch (type) {
      case "frozen":
        asfPath = ResourcePath.asfInterlude("die-冰.asf");
        asf = _frozenDie || getCachedAsf(asfPath);
        if (!asf) {
          // 异步加载并缓存
          loadAsf(asfPath).then((loaded) => {
            _frozenDie = loaded;
            if (loaded && this.isInDeathing) {
              this.texture = loaded;
              this.currentDirection = 0;
            }
          });
        }
        break;
      case "poison":
        asfPath = ResourcePath.asfInterlude("die-毒.asf");
        asf = _poisonDie || getCachedAsf(asfPath);
        if (!asf) {
          loadAsf(asfPath).then((loaded) => {
            _poisonDie = loaded;
            if (loaded && this.isInDeathing) {
              this.texture = loaded;
              this.currentDirection = 0;
            }
          });
        }
        break;
      case "petrified":
        asfPath = ResourcePath.asfInterlude("die-石.asf");
        asf = _petrifiedDie || getCachedAsf(asfPath);
        if (!asf) {
          loadAsf(asfPath).then((loaded) => {
            _petrifiedDie = loaded;
            if (loaded && this.isInDeathing) {
              this.texture = loaded;
              this.currentDirection = 0;
            }
          });
        }
        break;
    }

    if (asf) {
      this.texture = asf;
      this.currentDirection = 0;
    }

    // _notAddBody = true - 特殊死亡不添加尸体
    this.notAddBody = true;
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
      const aliveNpcs = list.filter((npc) => !npc.isDeath);
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
      (item) => item.from !== from
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
      this.flyInis = (this.flyInis.endsWith(";") ? this.flyInis : `${this.flyInis};`) + entry;
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
      this.isEnemy ? npcManager.getNeighborEnemy(this) : npcManager.getNeighborNeutralFighter(this)
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
