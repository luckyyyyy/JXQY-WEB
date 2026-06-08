/**
 * CharacterCombat - 战斗相关功能
 * 包含战斗状态、攻击、伤害、死亡等功能
 *
 * 继承链: Sprite → CharacterBase → CharacterMovement → CharacterCombat → Character
 */

import { getCharacterDeathExp } from "../../combat/effect-calc";
import { logger } from "../../core/logger";
import { CharacterState } from "../../core/types";
import { MagicAddonEffect } from "../../magic/magic-enums";
import { type Good, GoodEffectType } from "../../player/goods/good";
import { type AsfData, getCachedAsf, loadAsf } from "../../resource/format/asf";
import { ResourcePath } from "../../resource/resource-paths";
import { distance, getViewTileDistance, tileToPixel } from "../../utils";
import type { LevelUpResult } from "../level/level-manager";
import { levelFromExp } from "../level/level-manager";
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

    // If currently in death state, switch to Stand to prevent
    // updateDeath() from re-setting isDeath = true on the next frame
    if (this.isInDeathing) {
      this.state = CharacterState.Stand;
    }
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
   * 增加经验。主角与伙伴共用此逻辑（伙伴通过 initPartnerContainers 共享主角的 LevelManager）
   * Reference: JxqyHD/Engine/Character.cs - AddExp() / ToLevel()
   */
  addExp(amount: number): void {
    if (this.levelUpExp <= 0) return;

    this.exp += amount;
    if (this.exp > this.levelUpExp) {
      const gui = this.engine.guiManager as { showMessage?: (msg: string) => void };
      gui.showMessage?.(`${this.name}的等级提升了`);
      this.toLevelByExp(this.exp);
    }
  }

  /**
   * 根据当前累计经验跳转到对应等级。
   */
  private toLevelByExp(exp: number): void {
    const levelConfig = this.levelManager.getLevelConfig();
    if (!levelConfig) return;
    this.levelUpTo(levelFromExp(levelConfig, exp));
  }

  /**
   * 将 LevelUpResult 的增量应用到角色属性上
   */
  protected applyLevelUpResult(result: LevelUpResult): void {
    this.lifeMax += result.lifeMaxDelta;
    this.thewMax += result.thewMaxDelta;
    this.manaMax += result.manaMaxDelta;
    this.life = this.lifeMax;
    this.thew = this.thewMax;
    this.mana = this.manaMax;
    this.attack += result.attackDelta;
    this.attack2 += result.attack2Delta;
    this.attack3 += result.attack3Delta;
    this.defend += result.defendDelta;
    this.defend2 += result.defend2Delta;
    this.defend3 += result.defend3Delta;
    this.evade += result.evadeDelta;
    this.levelUpExp = result.newLevelUpExp;
  }

  /**
   * 升级到指定等级（也用于降级 - 例如调试工具）
   * Reference: JxqyHD/Engine/Character.cs - LevelUpTo()
   */
  levelUpTo(level: number): void {
    const levelConfig = this.levelManager.getLevelConfig();
    if (!levelConfig) {
      this.level = level;
      return;
    }

    const maxLevel = this.levelManager.getMaxLevel();
    let targetLevel = level;
    let isMaxLevel = false;
    if (targetLevel >= maxLevel) {
      targetLevel = maxLevel;
      isMaxLevel = true;
    } else if (!levelConfig.has(targetLevel)) {
      logger.warn(`[Character] ${this.name} 等级配置表中没有等级 ${level}`);
    }

    const result = this.levelManager.calculateLevelUp(this.level, targetLevel);
    if (result) {
      this.applyLevelUpResult(result);
    }

    if (isMaxLevel) {
      this.exp = 0;
      this.levelUpExp = 0;
    }

    this.level = targetLevel;
  }

  isDead(): boolean {
    return this.life <= 0;
  }

  // =============================================
  // REMOVED: isHit() — 所有攻击经 characterHited() → calcMagicHit() 处理
  // === Damage Methods ===
  // =============================================

  /** 是否处于调试无敌模式（玩家或入队配角） */
  isInGodMode(): boolean {
    return (this.isPlayer || this.isPartner) && this.engine.debugManager.isGodMode();
  }

  /**
   * 受到伤害
   */
  takeDamage(damage: number, attacker: CharacterBase | null): void {
    if (this.isDeathInvoked || this.isDeath) return;

    // 调试无敌模式（玩家及入队配角）
    if (this.isInGodMode()) {
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

    // 先扣防御+min(10)，再让护盾吸收（可降至 0）
    const minimalDamage = 10;
    let actualDamage = Math.max(damage - this.realDefend, minimalDamage);

    // 护盾减伤（使用 currentEffect 包含 AddMagicEffect 装备加成）
    for (const sprite of this._magicSpritesInEffect) {
      if (sprite.magic.moveKind === 13 && sprite.magic.specialKind === 3) {
        actualDamage -= sprite.currentEffect;
      }
    }
    // 护盾可将伤害降至 0（完全吸收）
    if (actualDamage < 0) actualDamage = 0;
    if (actualDamage > this.life) {
      actualDamage = this.life;
    }

    this.life -= actualDamage;

    logger.debug(
      `[Character] ${this.name} took ${actualDamage} damage from ${attacker?.name || "Unknown"}`
    );

    this.onDamaged(attacker as CharacterCombat | null, actualDamage);

    if (this.life <= 0) {
      this.life = 0;

      // 经验处理
      if (attacker && (attacker.isPlayer || attacker.isFighterFriend)) {
        const player = this.engine.player;
        if (player) {
          const exp = getCharacterDeathExp(this, player);
          player.addExp(exp, true);
        }
        // 配角也能获得经验
        if (attacker.isPartner) {
          const npcExp = getCharacterDeathExp(this, attacker);
          (attacker as CharacterCombat).addExp(npcExp);
        }
        // 主角击杀时，配角也获得经验
        if (attacker.isPlayer) {
          const npcManager = this.engine.npcManager;
          npcManager.forEachPartner((partner) => {
            const partnerExp = getCharacterDeathExp(this, partner);
            partner.addExp(partnerExp);
          });
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

    if (this.isInGodMode()) {
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

    // 命中率由 characterHited() 的 magicHitsTarget() 统一处理
    // 此处不重复检查，避免二重闪避判定

    // 多类型伤害
    let effect = damage - this.realDefend;
    let effect2 = damage2 - this.defend2;
    let effect3 = damage3 - this.defend3;

    // 护盾减伤（使用 currentEffect 包含 AddMagicEffect 装备加成）
    for (const sprite of this._magicSpritesInEffect) {
      if (sprite.magic.moveKind === 13 && sprite.magic.specialKind === 3) {
        effect -= sprite.currentEffect;
        effect2 -= sprite.currentEffect2;
        effect3 -= sprite.currentEffect3;
      }
    }

    let totalEffect = effect;
    if (effect3 > 0) totalEffect += effect3;
    if (effect2 > 0) totalEffect += effect2;
    // 护盾先减（可为负），最低下限保证受伤 ≥ 10
    if (totalEffect < 10) totalEffect = 10;
    if (totalEffect > this.life) totalEffect = this.life;

    this.life -= totalEffect;

    if (damageMana > 0 && this.mana > 0) {
      this.mana = Math.max(0, this.mana - damageMana);
    }

    logger.debug(
      `[Combat] ${attacker?.name ?? "?"} -> ${this.name}` +
        ` dmg=${damage} def=${this.realDefend} net=${totalEffect}` +
        ` HP: ${this.life + totalEffect} -> ${this.life}/${this.lifeMax}`
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

  // C++ Reference: NPC::beginHurt / Player::beginHurt
  // 受伤动画经过的时间（毫秒），用于时基终止检测
  protected _hurtElapsedMs: number = 0;
  // 受伤动画最大时长（毫秒），等于 framesPerDirection * interval
  protected _hurtDurationMs: number = 0;

  /**
   * 播放受伤动画
   *
   * 概率公式（以当前等级配置中最高等级的身法作为基线）：
   *   ratio      = clamp(realEvade / maxLevelEvade, 0, 1)
   *   hurtChance = 0.25 - 0.24 * ratio
   *
   * 身法为 0 时 25% 概率播放；身法达到最高等级上限时降至 1%。
   * 命中/闪避判定已在上层 calcMagicHit() 完成，此处只控制动画触发。
   * 终止条件：时间到达 actionLastTime（时基），而非帧计数。
   */
  hurting(): void {
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

    const maxLevel = this.levelManager.getMaxLevel();
    const maxEvade = this.levelManager.getLevelDetail(maxLevel)?.evade ?? 0;
    const ratio = maxEvade > 0 ? Math.min(1, this.realEvade / maxEvade) : 0;
    const hurtChance = 0.25 - 0.24 * ratio;
    if (Math.random() >= hurtChance) {
      return;
    }

    this.stateInitialize();

    // C++ Reference: canDoAction(acHurt) check
    if (this.isStateImageOk(CharacterState.Hurt)) {
      this.state = CharacterState.Hurt;
      this.playCurrentDirOnce();
      // C++ Reference: actionBeginTime = getUpdateTime(); actionLastTime = getActionTime(acHurt)
      this._hurtElapsedMs = 0;
      const framesPerDir = this._texture?.framesPerDirection ?? 1;
      const interval = this._texture?.interval ?? 100;
      this._hurtDurationMs = framesPerDir * interval;
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

    logger.debug(`[Character] ${this.name} died${killer ? ` (killed by ${killer.name})` : ""}`);

    // 特殊动作播放中死亡：延迟到动作结束再处理
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

    // biome-ignore lint/nursery/noUnnecessaryConditions: switch on string union is always non-null by design
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
   * 选择攻击武功（可被子类覆写）
   * 默认从 FlyIni 列表中随机选择
   */
  protected selectMagicForAttack(useDistance: number): string | null {
    return this.getRandomMagicWithUseDistance(useDistance);
  }

  /**
   * 检查攻击是否OK（距离、魔法选择）
   */
  attackingIsOk(): { isOk: boolean; magicIni: string | null } {
    if (!this._destinationAttackTilePosition) {
      return { isOk: false, magicIni: null };
    }

    const tileDistance = getViewTileDistance(
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
        const magicIni = this.selectMagicForAttack(attackRadius);
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

    const retreatNeeded = attackRadius - tileDistance;
    const destPixel = tileToPixel(
      this._destinationAttackTilePosition.x,
      this._destinationAttackTilePosition.y
    );
    if (!this.moveAwayTarget(destPixel, retreatNeeded, this._isRunToTarget)) {
      const magicIni = this.selectMagicForAttack(attackRadius);
      return { isOk: magicIni !== null, magicIni };
    }

    // 后退路径找到了，但若 A* 绕墙导致路径远比退格数长（说明中间有障碍需要绕行），
    // NPC 会反复侧走切换方向撞墙。此时取消寻路，直接原地攻击。
    // 容忍 +1 格的路径偏差（8方向斜走路径会略长于直线距离）。
    if (this.path.length > retreatNeeded + 1) {
      this.standingImmediately();
      const magicIni = this.selectMagicForAttack(attackRadius);
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
    this._flyIniManager.build(this.getAttackRadius(), this.name);
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
      target.isDeathInvoked ||
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
        distance(character.pixelPosition, character.followTarget.pixelPosition) <
          distance(character.pixelPosition, target.pixelPosition)
      ) {
        continue;
      }
      character.followAndWalkToTarget(target);
    }
  }

  // =============================================
  // === Equipment (shared between Player & Npc) ===
  // =============================================

  /** 武器的附加效果（中毒/冰冻/石化）。Player/Npc 共用 */
  protected _flyIniAdditionalEffect: MagicAddonEffect = MagicAddonEffect.None;

  protected setFlyIniAdditionalEffect(effect: MagicAddonEffect): void {
    this._flyIniAdditionalEffect = effect;
  }

  /**
   * 基础装备效果：基础属性 delta + 武器附加效果 + 移动速度。
   * 子类（Player）可重写以追加额外副作用（如 specialEffect / magicToUseWhenBeAttacked / flyIniReplace 等）。
   * 调用约定：内部已通过 unEquiping 卸下旧装备 delta，子类重写时**不要**再次卸下。
   */
  equiping(equip: Good | null, currentEquip: Good | null, justEffectType: boolean = false): void {
    if (!equip) return;

    const savedLife = this.life;
    const savedThew = this.thew;
    const savedMana = this.mana;

    // 通过 this.unEquiping 走子类多态路径，保证子类卸下额外副作用
    this.unEquiping(currentEquip, justEffectType);

    if (!justEffectType) {
      this.attack += equip.attack;
      this.attack2 += equip.attack2;
      this.attack3 += equip.attack3;
      this.defend += equip.defend;
      this.defend2 += equip.defend2;
      this.defend3 += equip.defend3;
      this.evade += equip.evade;
      this.lifeMax += equip.lifeMax;
      this.thewMax += equip.thewMax;
      this.manaMax += equip.manaMax;
    }

    switch (equip.theEffectType) {
      case GoodEffectType.EnemyFrozen:
        this.setFlyIniAdditionalEffect(MagicAddonEffect.Frozen);
        break;
      case GoodEffectType.EnemyPoisoned:
        this.setFlyIniAdditionalEffect(MagicAddonEffect.Poison);
        break;
      case GoodEffectType.EnemyPetrified:
        this.setFlyIniAdditionalEffect(MagicAddonEffect.Petrified);
        break;
    }

    this.addMoveSpeedPercent += equip.changeMoveSpeedPercent;

    this.life = Math.min(savedLife, this.lifeMax);
    this.thew = Math.min(savedThew, this.thewMax);
    this.mana = Math.min(savedMana, this.manaMax);
  }

  /**
   * 基础卸装备：还原基础属性 delta + 清武器附加效果 + 还原移动速度。
   * 子类可重写以追加额外副作用还原。
   */
  unEquiping(equip: Good | null, justEffectType: boolean = false): void {
    if (!equip) return;

    if (!justEffectType) {
      this.attack -= equip.attack;
      this.attack2 -= equip.attack2;
      this.attack3 -= equip.attack3;
      this.defend -= equip.defend;
      this.defend2 -= equip.defend2;
      this.defend3 -= equip.defend3;
      this.evade -= equip.evade;
      this.lifeMax -= equip.lifeMax;
      this.thewMax -= equip.thewMax;
      this.manaMax -= equip.manaMax;
    }

    switch (equip.theEffectType) {
      case GoodEffectType.EnemyFrozen:
      case GoodEffectType.EnemyPoisoned:
      case GoodEffectType.EnemyPetrified:
        this.setFlyIniAdditionalEffect(MagicAddonEffect.None);
        break;
    }

    this.addMoveSpeedPercent -= equip.changeMoveSpeedPercent;

    if (this.life > this.lifeMax) this.life = this.lifeMax;
    if (this.thew > this.thewMax) this.thew = this.thewMax;
    if (this.mana > this.manaMax) this.mana = this.manaMax;
  }
}
