/**
 * Player 主类 - 继承自 PlayerCombat
 * 包含 update 状态机、存档/加载、等级系统、遮挡检测等功能
 *
 * 继承链: Character → PlayerBase → PlayerCombat → Player
 *
 * 重构说明：
 * - 属性声明在 PlayerBase (~500行)
 * - 输入处理已收敛到 PlayerBase
 * - 战斗功能在 PlayerCombat (~650行)
 * - 本文件包含状态机、存档/加载、等级、遮挡等 (~800行)
 */

import type { Player as PlayerType } from "@miu2d/types";
import type { Character } from "../character";
import { applyFlatDataToCharacter } from "../character/character-config";
import { getEffectAmount } from "../combat/effect-calc";
import { CharacterKind } from "../core/character-types";
import { logger } from "../core/logger";
import type { Vector2 } from "../core/types";
import { CharacterState, RUN_SPEED_FOLD } from "../core/types";
import { getGameConfig } from "../data/game-data-api";
import type { MagicSprite } from "../magic/magic-sprite";
import type { MagicData } from "../magic/types";
import { MagicMoveKind, MagicSpecialKind } from "../magic/types";
import { getTileTextureRegion } from "../map/map-renderer";
import type { Renderer } from "../renderer/renderer";
import { resolveScriptPath } from "../resource/resource-paths";
import { Sprite } from "../sprite/sprite";
import type { PlayerSaveData } from "../storage/save-types";
import { isBoxCollide, pixelToTile } from "../utils";
import { distanceFromDelta } from "../utils/distance";
import {
  LIFE_RESTORE_PERCENT,
  MANA_RESTORE_PERCENT,
  PlayerCombat,
  RESTORE_INTERVAL_MS,
  SITTING_MANA_RESTORE_INTERVAL,
  THEW_RESTORE_PERCENT,
} from "./base";

export type { PlayerAction } from "./base";

export interface PlayerStatsInfo {
  level: number;
  life: number;
  lifeMax: number;
  thew: number;
  thewMax: number;
  mana: number;
  manaMax: number;
  exp: number;
  levelUpExp: number;
  money: number;
  state: number;
  isInFighting: boolean;
}

/**
 * Player - 完整的玩家类
 */
export class Player extends PlayerCombat {
  // =============================================
  // === Update State Machine ===
  // =============================================

  /**
   * Override main update to call Player-specific updates
   * Update(GameTime gameTime)
   *
   * 中恢复逻辑是在 base.Update() 之前统一处理，而不是在各个状态 override 中。
   * 这样可以确保：
   * 1. 非 standing/walking 状态时，_standingMilliseconds 被正确重置
   * 2. sitting 状态时的 thew→mana 转换逻辑
   */
  override update(deltaTime: number): void {
    // UpdateAutoAttack(gameTime);
    this.updateAutoAttack(deltaTime);

    // 触发 ScriptFileJustTouch > 0 的物体脚本
    this.updateTouchObj();

    // if ((IsStanding() || IsWalking()) && BodyFunctionWell)
    // 只有在站立或行走时才恢复，其他状态重置计时器
    if ((this.isStanding() || this.isWalking()) && this.bodyFunctionWell) {
      this.updateStandingRestore(deltaTime);
    } else {
      this._standingMilliseconds = 0;
    }

    // Call base Character update
    super.update(deltaTime);
  }

  /**
   * 检查玩家当前位置是否有可自动触发的物体脚本
   * Reference: Player.UpdateTouchObj()
   *
   * 当玩家站在有 ScriptFileJustTouch > 0 的物体位置上时，
   * 自动运行该物体的脚本（通常用于陷阱、机关等）
   */
  private updateTouchObj(): void {
    const objManager = this.engine.objManager;
    if (!objManager) return;

    const objs = objManager.getObjsAtPosition({ x: this.mapX, y: this.mapY });
    for (const obj of objs) {
      if (obj.scriptFileJustTouch > 0 && obj.canInteract(false)) {
        obj.startInteract(false);
      }
    }
  }

  // =============================================
  // === State Update Methods ===
  // =============================================

  /**
   * Override running state to consume thew
   * handles thew consumption when running
   */
  protected override updateRunning(deltaTime: number): void {
    const result = this.moveAlongPath(deltaTime, RUN_SPEED_FOLD);

    // Consume thew while running
    if (result.moved && !result.reachedDestination && this.path.length > 0) {
      if (!this.consumeRunningThew()) {
        // Not enough thew, switch to walking
        // Use FightWalk if in fighting mode
        this.state = this.selectFightOrNormalState(CharacterState.FightWalk, CharacterState.Walk);
      }
    }

    // Update animation
    this.updateAnimation(deltaTime);

    // Update movement flags
    this.updateMovementFlags();
  }

  /**
   * Override sitting state for Player-specific Thew->Mana conversion
   * - case CharacterState.Sit with IsSitted logic
   */
  protected override updateSitting(deltaTime: number): void {
    const deltaMs = deltaTime * 1000;

    // if (!IsSitted) base.Update(gameTime);
    // if (!IsInPlaying) IsSitted = true;
    if (!this.isSitted) {
      // Check if sit animation has finished BEFORE updating
      // This prevents the frame from wrapping back to the beginning
      if (!this.isInPlaying) {
        this.isSitted = true;
        // Ensure we stay at the last frame of the sit animation (坐下姿势)
        this._currentFrameIndex = this._frameEnd;
        logger.log(`[Player] Sitting animation complete, now sitted at frame ${this._frameEnd}`);
        return;
      }
      // Update animation while sitting down
      this.updateAnimation(deltaTime);
      return;
    }

    // Player.cs IsSitted logic:
    // Convert Thew to Mana while sitting
    let changeManaAmount = Math.floor(this.manaMax / 100);
    if (changeManaAmount === 0) changeManaAmount = 1;

    if (this.mana < this.manaMax && this.thew > changeManaAmount) {
      this._sittedMilliseconds += deltaMs;
      if (this._sittedMilliseconds >= SITTING_MANA_RESTORE_INTERVAL) {
        this._sittedMilliseconds -= SITTING_MANA_RESTORE_INTERVAL;
        this.thew = Math.max(0, this.thew - changeManaAmount);
        this.mana = Math.min(this.manaMax, this.mana + changeManaAmount);
      }
    } else {
      // Mana full or no thew left - stand up
      logger.log(`[Player] Sitting complete: mana=${this.mana}/${this.manaMax}, thew=${this.thew}`);
      this.standingImmediately();
    }
  }

  /**
   * Override standing state for player-specific logic
   * 恢复逻辑已移至 Player.update() 中，与原版一致
   */
  protected override updateStanding(deltaTime: number): void {
    this.updateAnimation(deltaTime);
    this.updateMovementFlags();
  }

  /**
   * Override walking state for player - movement only, restore handled in main update
   * 恢复逻辑已移至 Player.update() 中，与原版一致
   */
  protected override updateWalking(deltaTime: number): void {
    this.moveAlongPath(deltaTime, this.walkSpeed);
    this.updateAnimation(deltaTime);
    this.updateMovementFlags();
  }

  /**
   * Player.Update() standing/walking restore logic
   * Life, Thew, and Mana restore every 1 second while standing or walking
   * 注意：条件检查已在 Player.update() 中完成，这里直接执行恢复逻辑
   */
  private updateStandingRestore(deltaTime: number): void {
    const deltaMs = deltaTime * 1000;
    this._standingMilliseconds += deltaMs;

    if (this._standingMilliseconds >= RESTORE_INTERVAL_MS) {
      // Life += (int)((LifeRestorePercent + AddLifeRestorePercent / 1000f) * LifeMax);
      const lifeRestore = Math.floor(
        (LIFE_RESTORE_PERCENT + this._addLifeRestorePercent / 1000) * this.lifeMax
      );
      this.life = Math.min(this.lifeMax, this.life + lifeRestore);

      // Thew += (int)((ThewRestorePercent + AddThewRestorePercent / 1000f) * ThewMax);
      const thewRestore = Math.floor(
        (THEW_RESTORE_PERCENT + this._addThewRestorePercent / 1000) * this.thewMax
      );
      this.thew = Math.min(this.thewMax, this.thew + thewRestore);

      // Mana += (int)((AddManaRestorePercent / 1000f) * ManaMax);
      const manaRestore = Math.floor((this._addManaRestorePercent / 1000) * this.manaMax);
      this.mana = Math.min(this.manaMax, this.mana + manaRestore);

      // if (IsManaRestore) { Mana += (int)(ManaMax * ManaRestorePercent); }
      if (this._isManaRestore) {
        const bonusManaRestore = Math.floor(this.manaMax * MANA_RESTORE_PERCENT);
        this.mana = Math.min(this.manaMax, this.mana + bonusManaRestore);
      }

      this._standingMilliseconds = 0;
    }
  }

  /**
   * Update animation (calls Sprite.update directly, skipping Character.update state machine)
   */
  private updateAnimation(deltaTime: number): void {
    Sprite.prototype.update.call(this, deltaTime);
  }

  // =============================================
  // === Death Handling ===
  // =============================================

  /**
   * Override death to run death script and disable input
   * - calls base.Death() then Globals.IsInputDisabled = true
   */
  override death(killer: Character | null = null): void {
    if (this.isDeathInvoked) return;

    // Call base implementation (sets state, flags, plays animation)
    super.death(killer);

    // Run death script if set
    if (this.deathScript) {
      const basePath = this.engine.getScriptBasePath();
      const fullPath = resolveScriptPath(basePath, this.deathScript);
      logger.log(`[Player] Running death script: ${fullPath}`);
      this.engine.runScript(fullPath);
    }

    // Globals.IsInputDisabled = true
    // 注意：这里暂时只打印日志，完整实现需要设置全局输入禁用状态
    logger.log(`[Player] Player died - input should be disabled`);
  }

  /**
   * Override fullLife to re-enable input
   * Reference: Player.FullLife()
   */
  override fullLife(): void {
    // if (IsDeath) Globals.IsInputDisabled = false
    if (this.isDeath) {
      logger.log(`[Player] Revived - input should be re-enabled`);
    }
    super.fullLife();
  }

  // =============================================
  // === Sprite Loading (SetNpcRes) ===
  // =============================================

  /**
   * Override loadSpritesFromNpcIni to update NpcIniIndex and SpecialAttackTexture
   * Reference: Player.SetNpcIni() - 当通过 SetNpcRes 脚本命令改变玩家资源时，
   * 需要更新 NpcIniIndex 和刷新修炼武功的 SpecialAttackTexture
   */
  override async loadSpritesFromNpcIni(
    npcIni?: string,
    options?: { deferKeys?: Set<keyof import("../sprite/sprite").SpriteSet> }
  ): Promise<boolean> {
    const result = await super.loadSpritesFromNpcIni(npcIni, options);

    if (result && npcIni) {
      // 调用 setNpcIni 来更新 _npcIniIndex 和刷新 SpecialAttackTexture
      // 注意：super.loadSpritesFromNpcIni 已经设置了 this.npcIni = iniFile
      // 这里调用 setNpcIni 会再次设置 npcIni，但主要目的是更新 _npcIniIndex
      await this.setNpcIni(npcIni);
      logger.log(`[Player] loadSpritesFromNpcIni: updated NpcIniIndex for ${npcIni}`);
    }

    return result;
  }

  // =============================================
  // === Partner Management ===
  // =============================================

  /**
   * Player.ResetPartnerPosition()
   * Reset all partners to positions around the player
   */
  resetPartnerPosition(): void {
    const partners = this.npcManager.getAllPartner();
    if (partners.length === 0) return;

    // var neighbors = Engine.PathFinder.FindAllNeighbors(TilePosition);
    const neighbors = this.findAllNeighbors(this.tilePosition);

    // var index = CurrentDirection + 4; (start from behind the player)
    let index = this._currentDirection + 4;

    for (const partner of partners) {
      // if (index == CurrentDirection) index++; (skip player's facing direction)
      if (index % 8 === this._currentDirection) index++;
      partner.setPosition(neighbors[index % 8].x, neighbors[index % 8].y);
      index++;
    }
  }

  // =============================================
  // === Position Methods ===
  // =============================================

  setPixelPosition(x: number, y: number): void {
    this._positionInWorld = { x, y };
    const tile = pixelToTile(x, y);
    this._rawSetTileCoords(tile.x, tile.y);
  }

  isNear(position: Vector2, threshold: number = 50): boolean {
    const dx = this._positionInWorld.x - position.x;
    const dy = this._positionInWorld.y - position.y;
    return distanceFromDelta(dx, dy) <= threshold;
  }

  // =============================================
  // === Level System ===
  // =============================================

  /**
   * 增加经验值
   * Reference: Player.AddExp(amount, addMagicExp)
   * @param amount 经验值
   * @param addMagicExp 是否同时给武功增加经验（击杀时为 true）
   */
  addExp(amount: number, addMagicExp: boolean = false): void {
    // 如果 addMagicExp 为 true，给修炼武功和当前使用武功增加经验
    if (addMagicExp) {
      this._magicInventory.awardKillExp(amount, this.name);
    }

    super.addExp(amount);
  }

  /**
   * 处理武功升级时的玩家属性加成
   * magic level up, add player properties
   */
  protected override handleMagicLevelUp(oldMagic: MagicData, newMagic: MagicData): void {
    // Use delta (new level - old level), matching C# logic:
    // Defend += (detail.Defend - currentDetail.Defend)
    this.lifeMax += (newMagic.lifeMax || 0) - (oldMagic.lifeMax || 0);
    this.thewMax += (newMagic.thewMax || 0) - (oldMagic.thewMax || 0);
    this.manaMax += (newMagic.manaMax || 0) - (oldMagic.manaMax || 0);
    this.attack += (newMagic.attack || 0) - (oldMagic.attack || 0);
    this.defend += (newMagic.defend || 0) - (oldMagic.defend || 0);
    this.evade += (newMagic.evade || 0) - (oldMagic.evade || 0);
    this.attack2 += (newMagic.attack2 || 0) - (oldMagic.attack2 || 0);
    this.defend2 += (newMagic.defend2 || 0) - (oldMagic.defend2 || 0);
    this.attack3 += (newMagic.attack3 || 0) - (oldMagic.attack3 || 0);
    this.defend3 += (newMagic.defend3 || 0) - (oldMagic.defend3 || 0);
    this._addLifeRestorePercent +=
      (newMagic.addLifeRestorePercent || 0) - (oldMagic.addLifeRestorePercent || 0);
    this._addThewRestorePercent +=
      (newMagic.addThewRestorePercent || 0) - (oldMagic.addThewRestorePercent || 0);
    this._addManaRestorePercent +=
      (newMagic.addManaRestorePercent || 0) - (oldMagic.addManaRestorePercent || 0);

    // FlyIni 替换逻辑
    // if (oldMagic.FlyIni != newMagic.FlyIni) { RemoveFlyIniReplace(old); AddFlyIniReplace(new); }
    if (oldMagic.flyIni !== newMagic.flyIni) {
      if (oldMagic.flyIni) {
        this.removeFlyIniReplace(oldMagic.flyIni);
      }
      if (newMagic.flyIni) {
        this.addFlyIniReplace(newMagic.flyIni);
      }
    }
    if (oldMagic.flyIni2 !== newMagic.flyIni2) {
      if (oldMagic.flyIni2) {
        this.removeFlyIni2Replace(oldMagic.flyIni2);
      }
      if (newMagic.flyIni2) {
        this.addFlyIni2Replace(newMagic.flyIni2);
      }
    }

    // MagicToUseWhenBeAttacked 更新逻辑
    // Reference: 武功升级时需要更新 MagicToUseWhenAttackedList 中的条目
    // 此功能待实现

    // 显示升级消息
    this.guiManager.showMessage(`武功 ${newMagic.name} 升级了`);
    logger.log(`[Player] Magic "${newMagic.name}" leveled up - stats added`);
  }

  /**
   * 升 1 级（用于调试/脚本）。
   * Reference: JxqyHD/Engine/Player.cs - LevelUp()
   * @returns 已达到最高等级时返回 false
   */
  levelUp(): boolean {
    if (this.levelUpExp <= 0) return false;
    this.addExp(this.levelUpExp - this.exp + 1);
    return true;
  }

  setLevelTo(level: number): void {
    const levelConfig = this.levelManager.getLevelConfig();

    this.level = level;
    logger.log(`[Player] SetLevelTo: ${level}`);

    if (!levelConfig) return;

    const detail = levelConfig.get(level);
    if (!detail) return;

    this.lifeMax = detail.lifeMax;
    this.thewMax = detail.thewMax;
    this.manaMax = detail.manaMax;
    this.life = this.lifeMax;
    this.thew = this.thewMax;
    this.mana = this.manaMax;
    this.attack = detail.attack;
    this.defend = detail.defend;
    this.evade = detail.evade;
    this.levelUpExp = detail.levelUpExp;
  }

  /**
   * 从等级配置 + 武功加成 + 装备加成重新计算基础属性。
   * 存档加载完成后调用，修正因历史 bug 导致的累计错误值。
   * 参考 C# 逻辑：装备时加 delta，而非每次加绝对值。
   */
  recalculateBaseStats(): void {
    const levelConfig = this.levelManager.getLevelConfig();
    if (!levelConfig) {
      logger.warn("[Player] recalculateBaseStats: no level config loaded, skipping");
      return;
    }
    const detail = levelConfig.get(this.level);
    if (!detail) {
      logger.warn(`[Player] recalculateBaseStats: no config for level ${this.level}, skipping`);
      return;
    }

    const savedLife = this.life;
    const savedThew = this.thew;
    const savedMana = this.mana;

    // Base from level config
    let lifeMax = detail.lifeMax;
    let thewMax = detail.thewMax;
    let manaMax = detail.manaMax;
    let attack = detail.attack;
    let defend = detail.defend;
    let evade = detail.evade;
    let attack2 = 0;
    let defend2 = 0;
    let attack3 = 0;
    let defend3 = 0;

    // Add magic stat bonuses (info.magic already holds stats for current level)
    for (const info of this._magicInventory.getAllMagicInfos()) {
      if (!info.magic) continue;
      lifeMax += info.magic.lifeMax || 0;
      thewMax += info.magic.thewMax || 0;
      manaMax += info.magic.manaMax || 0;
      attack += info.magic.attack || 0;
      defend += info.magic.defend || 0;
      evade += info.magic.evade || 0;
      attack2 += info.magic.attack2 || 0;
      defend2 += info.magic.defend2 || 0;
      attack3 += info.magic.attack3 || 0;
      defend3 += info.magic.defend3 || 0;
    }

    // Add equipment stat bonuses (equip slots + noNeedToEquip bag items)
    const eq = this._goodsListManager.sumEquipStats();
    lifeMax += eq.lifeMax;
    thewMax += eq.thewMax;
    manaMax += eq.manaMax;
    attack += eq.attack;
    defend += eq.defend;
    evade += eq.evade;
    attack2 += eq.attack2;
    defend2 += eq.defend2;
    attack3 += eq.attack3;
    defend3 += eq.defend3;

    this.lifeMax = lifeMax;
    this.thewMax = thewMax;
    this.manaMax = manaMax;
    this.attack = attack;
    this.defend = defend;
    this.evade = evade;
    this.attack2 = attack2;
    this.defend2 = defend2;
    this.attack3 = attack3;
    this.defend3 = defend3;

    // Preserve current HP/Thew/Mana (cap to new max)
    this.life = Math.min(savedLife, this.lifeMax);
    this.thew = Math.min(savedThew, this.thewMax);
    this.mana = Math.min(savedMana, this.manaMax);

    logger.info(
      `[Player] recalculateBaseStats: lv=${this.level} defend=${this.defend} attack=${this.attack} evade=${this.evade} lifeMax=${this.lifeMax}`
    );
  }

  /**
   * 设置等级配置文件
   * SetLevelFile 脚本命令（从 API 按需加载，自动转小写）
   */
  async setLevelFile(filePath: string): Promise<void> {
    await this.levelManager.setLevelFile(filePath);
  }

  async initializeFromLevelConfig(level: number = 1): Promise<void> {
    await this.levelManager.initialize();

    const levelConfig = this.levelManager.getLevelConfig();
    if (!levelConfig) return;

    const detail = levelConfig.get(level);
    if (!detail) return;

    this.level = level;
    this.lifeMax = detail.lifeMax;
    this.life = detail.lifeMax;
    this.thewMax = detail.thewMax;
    this.thew = detail.thewMax;
    this.manaMax = detail.manaMax;
    this.mana = detail.manaMax;
    this.attack = detail.attack;
    this.defend = detail.defend;
    this.evade = detail.evade;
    this.levelUpExp = detail.levelUpExp;
    this.exp = 0;
  }

  // =============================================
  // === Save/Load ===
  // =============================================

  /**
   * 从 API 玩家数据加载
   * 用于初始存档 (index=0) 加载，数据来自 /api/data 的 players 数组
   */
  async loadFromApiData(data: PlayerType): Promise<boolean> {
    await this.levelManager.initialize();

    // 新剑侠情缘: Effect 叠加 Attack 公式
    const gameConfig = getGameConfig();
    if (gameConfig?.effectFormulaAdditive) {
      this.effectFormulaAdditive = true;
    }

    try {
      // API 字段名映射到 CharacterInstance 属性名
      // 注意：玩家的等级文件由全局难度系统统一管理，不再使用 API 的 levelIni
      const mapped: Record<string, unknown> = {
        ...data,
        timerScriptFile: data.timeScript, // API: timeScript → CharacterInstance: timerScriptFile
        manaLimit: data.manaLimit !== 0, // API: number → CharacterInstance: boolean
      };

      // 统一赋值所有 FIELD_DEFS 中定义的字段（纯赋值，无副作用）
      applyFlatDataToCharacter(mapped, this, true);

      // Player 实例的 kind 必须始终为 Player；characterProfiles 中的伙伴 profile
      // 可能因 flushNpcToProfile 把 NPC 的 kind（Fighter/Follower 等）写入，
      // PlayerChange 切回时会被 applyFlatDataToCharacter 覆盖，需要强制纠正。
      this.kind = CharacterKind.Player;

      // 需要副作用的字段
      if (data.npcIni) await this.setNpcIni(data.npcIni);
      this.setPosition(data.mapX, data.mapY);

      // 统一触发副作用（setFlyIni → buildFlyIniInfos 等）
      this.applyConfigSetters();

      logger.info(`[Player] Loaded from API data: ${data.name} at (${data.mapX}, ${data.mapY})`);
      return true;
    } catch (error) {
      logger.error(`[Player] Error loading from API data:`, error);
      return false;
    }
  }

  /**
   * 从存档数据加载玩家
   * 用于 JSON 存档恢复，由 Loader.loadPlayerFromJSON 调用
   */
  loadFromSaveData(data: PlayerSaveData): void {
    // 新剑侠情缘: Effect 叠加 Attack 公式
    const gameConfig = getGameConfig();
    if (gameConfig?.effectFormulaAdditive) {
      this.effectFormulaAdditive = true;
    }

    // 所有字段名已统一，直接赋值（无需 rename mapping）
    applyFlatDataToCharacter(data as unknown as Record<string, unknown>, this, true);

    // Player 实例的 kind 必须始终为 Player；characterProfiles 中的伙伴 profile
    // 可能因 flushNpcToProfile 把 NPC 的 kind（Fighter/Follower 等）写入，
    // PlayerChange 切回时会被 applyFlatDataToCharacter 覆盖，需要强制纠正。
    this.kind = CharacterKind.Player;

    // 需要副作用的字段
    if (data.npcIni) this.setNpcIni(data.npcIni);
    this.setPosition(data.mapX, data.mapY);

    // 统一触发副作用（setFlyIni → buildFlyIniInfos 等）
    this.applyConfigSetters();
  }

  // =============================================
  // === Stats Methods ===
  // =============================================

  getStatsInfo(): PlayerStatsInfo {
    const stats = this.getStats();
    return {
      level: stats.level,
      life: stats.life,
      lifeMax: stats.lifeMax,
      thew: stats.thew,
      thewMax: stats.thewMax,
      mana: stats.mana,
      manaMax: stats.manaMax,
      exp: stats.exp,
      levelUpExp: stats.levelUpExp,
      money: this.money,
      state: this.state,
      isInFighting: this.isInFighting,
    };
  }

  fullAll(): void {
    this.fullLife();
    this.fullThew();
    this.fullMana();
  }

  setStat(statName: string, value: number): void {
    switch (statName.toLowerCase()) {
      case "life":
        this.life = value;
        break;
      case "lifemax":
        this.lifeMax = value;
        break;
      case "thew":
        this.thew = value;
        break;
      case "thewmax":
        this.thewMax = value;
        break;
      case "mana":
        this.mana = value;
        break;
      case "manamax":
        this.manaMax = value;
        break;
      case "attack":
        this.attack = value;
        break;
      case "defend":
        this.defend = value;
        break;
      case "evade":
        this.evade = value;
        break;
      case "level":
        this.level = value;
        break;
      case "exp":
        this.exp = value;
        break;
      case "levelupexp":
        this.levelUpExp = value;
        break;
    }
  }

  /**
   * Add money to player with message display
   * shows message "你得到了 X 两银子。" or "你失去了 X 两银子。"
   */
  addMoney(amount: number): void {
    if (Number.isNaN(amount)) return;
    if (amount > 0) {
      this._money += amount;
      this.guiManager.showMessage(`你得到了 ${amount} 两银子。`);
      this._onMoneyChange?.();
    } else if (amount < 0) {
      this._money += amount;
      if (this._money < 0) this._money = 0;
      this.guiManager.showMessage(`你失去了 ${-amount} 两银子。`);
      this._onMoneyChange?.();
    }
  }

  /**
   * Add money without showing message
   * just adds amount, no message
   */
  addMoneyValue(amount: number): void {
    if (Number.isNaN(amount)) return;
    this._money += amount;
    if (this._money < 0) this._money = 0;
    this._onMoneyChange?.();
  }

  getMoney(): number {
    return this._money;
  }

  setMoney(amount: number): void {
    if (Number.isNaN(amount)) return;
    this._money = Math.max(0, amount);
    this._onMoneyChange?.();
  }

  heal(amount: number): void {
    this.addLife(amount);
  }

  restoreMana(amount: number): void {
    this.addMana(amount);
  }

  // =============================================
  // === Occlusion Transparency System ===
  // =============================================

  // 位置缓存，用于优化遮挡检测（只在位置变化时重新计算）
  private _lastOcclusionCheckTileX: number = -1;
  private _lastOcclusionCheckTileY: number = -1;

  /**
   * 获取玩家是否被遮挡
   * 用于在渲染时决定是否绘制半透明叠加层
   */
  get isOccluded(): boolean {
    return this._isOccluded;
  }

  /**
   * 更新遮挡状态（在 update 中调用）
   * 检测玩家是否被地图瓦片或 NPC 遮挡
   * 优化：只在玩家瓦片位置变化时重新计算
   */
  updateOcclusionState(): void {
    const currentTileX = this.tilePosition.x;
    const currentTileY = this.tilePosition.y;

    // 位置没变化，跳过计算
    if (
      currentTileX === this._lastOcclusionCheckTileX &&
      currentTileY === this._lastOcclusionCheckTileY
    ) {
      return;
    }

    this._lastOcclusionCheckTileX = currentTileX;
    this._lastOcclusionCheckTileY = currentTileY;
    this._isOccluded = this.checkOcclusionTransparency();
  }

  /**
   * 检测玩家是否被地图瓦片或 NPC 遮挡
   * 返回是否需要绘制半透明叠加层
   * 中检测 layer2, layer3 和 NPC 碰撞
   */
  private checkOcclusionTransparency(): boolean {
    const mapRenderer = this.engine.mapRenderer;
    if (!mapRenderer.mapData || mapRenderer.isLoading) return false;

    const playerRegion = this.regionInWorld;
    const playerMapY = this.tilePosition.y;

    // 检查范围：玩家位置 ±4 列、+1~+10 行（只检测玩家前方的瓦片）
    const startX = Math.max(0, this.tilePosition.x - 4);
    const endX = Math.min(mapRenderer.mapData.mapColumnCounts, this.tilePosition.x + 5);
    const startY = playerMapY + 1;
    const endY = Math.min(mapRenderer.mapData.mapRowCounts, playerMapY + 10);

    // 检测与地图瓦片的碰撞（只检测玩家前方的瓦片）
    for (let y = startY; y < endY; y++) {
      for (let x = startX; x < endX; x++) {
        // 检测 layer2（地图物体层）
        const layer2Region = getTileTextureRegion(mapRenderer, x, y, "layer2");
        if (layer2Region && isBoxCollide(playerRegion, layer2Region)) {
          return true;
        }
        // 检测 layer3（顶层物体）
        const layer3Region = getTileTextureRegion(mapRenderer, x, y, "layer3");
        if (layer3Region && isBoxCollide(playerRegion, layer3Region)) {
          return true;
        }
      }
    }

    // 检测与视野内 NPC 的碰撞
    // 性能优化：使用 Update 阶段预计算的 npcsInView，已经过滤了视野外的 NPC
    const npcsInView = this.engine.npcManager.npcsInView;

    for (const npc of npcsInView) {
      if (!npc.isVisible || npc.isHide) continue;
      // 只检测在玩家前面的 NPC（mapY > playerMapY）
      if (npc.tilePosition.y > playerMapY) {
        const npcRegion = npc.regionInWorld;
        if (isBoxCollide(playerRegion, npcRegion)) {
          return true;
        }
      }
    }

    return false;
  }

  // =============================================
  // === Draw Override ===
  // =============================================

  /**
   * 重写绘制方法
   * 注意：半透明遮挡效果在 gameEngine.ts 中绘制（在所有地图层之后）
   */
  override draw(
    renderer: Renderer,
    cameraX: number,
    cameraY: number,
    offX: number = 0,
    offY: number = 0
  ): void {
    // if (IsDraw) { ... }
    if (!this.isDraw) return;

    // 确定绘制颜色（状态效果）
    let drawColor = "white";
    if (this.frozenSeconds > 0 && this.isFrozenVisualEffect) {
      drawColor = "frozen";
    }
    if (this.poisonSeconds > 0 && this.isPoisonVisualEffect) {
      drawColor = "poison";
    }
    if (this.petrifiedSeconds > 0 && this.isPetrifiedVisualEffect) {
      drawColor = "black";
    }

    // 正常绘制玩家
    this.drawWithColor(renderer, cameraX, cameraY, drawColor, offX, offY);
    // 注意：半透明遮挡效果不在这里绘制，而是在 gameEngine.ts 中
    // 在所有地图层渲染完成后单独绘制半透明玩家叠加层
  }

  // =============================================
  // === BUFF System ===
  // =============================================

  /**
   * 覆盖基类方法，添加日志
   */
  override addMagicSpriteInEffect(sprite: MagicSprite): void {
    // 检查是否已有同名武功
    const existingIndex = this._magicSpritesInEffect.findIndex(
      (s) => s.magic.name === sprite.magic.name
    );

    if (existingIndex >= 0) {
      // 已有同名武功，更新为新的（重置持续时间）
      this._magicSpritesInEffect[existingIndex] = sprite;
      logger.log(`[Player] BUFF reset: ${sprite.magic.name}`);
    } else {
      // 添加新的武功精灵
      this._magicSpritesInEffect.push(sprite);
      logger.log(`[Player] BUFF added: ${sprite.magic.name}, effect=${sprite.currentEffect}`);
    }
  }

  /**
   * 根据精灵ID移除（Player 特有方法）
   */
  removeMagicSpriteInEffectById(spriteId: number): void {
    const index = this._magicSpritesInEffect.findIndex((s) => s.id === spriteId);
    if (index >= 0) {
      const removed = this._magicSpritesInEffect.splice(index, 1)[0];
      logger.log(`[Player] BUFF removed: ${removed.magic.name}`);
    }
  }

  /**
   * 清理已销毁的武功精灵
   * for (var node = MagicSpritesInEffect.First; ...)
   */
  cleanupDestroyedMagicSprites(): void {
    // 原地删除已销毁的精灵，避免创建新数组减少 GC 压力
    for (let i = this._magicSpritesInEffect.length - 1; i >= 0; i--) {
      if (this._magicSpritesInEffect[i].isDestroyed) {
        this._magicSpritesInEffect.splice(i, 1);
      }
    }
  }

  /**
   * 计算武功减伤量（金钟罩等）
   * GetEffectAmount(magic, character) 中 character 是被保护角色 (this)
   */
  calculateDamageReduction(): { effect: number; effect2: number; effect3: number } {
    let reductionEffect = 0;
    let reductionEffect2 = 0;
    let reductionEffect3 = 0;

    for (const sprite of this._magicSpritesInEffect) {
      const magic = sprite.magic;

      // MoveKind=13 (FollowCharacter) + SpecialKind=3 (BuffOrPetrify) = 防护类 BUFF
      if (
        magic.moveKind === MagicMoveKind.FollowCharacter &&
        magic.specialKind === MagicSpecialKind.BuffOrPetrify
      ) {
        // MagicManager.GetEffectAmount - 包含 AddMagicEffect 加成
        const effect = getEffectAmount(magic, this, "effect");
        const effect2 = getEffectAmount(magic, this, "effect2");
        const effect3 = getEffectAmount(magic, this, "effect3");

        reductionEffect += effect;
        reductionEffect2 += effect2;
        reductionEffect3 += effect3;

        logger.log(
          `[Player] BUFF damage reduction from ${magic.name}: ${effect}/${effect2}/${effect3}`
        );
      }
    }

    return {
      effect: reductionEffect,
      effect2: reductionEffect2,
      effect3: reductionEffect3,
    };
  }

  /**
   * 检查是否有免疫伤害的 BUFF（SpecialKind=6）
   */
  hasImmunityBuff(): boolean {
    for (const sprite of this._magicSpritesInEffect) {
      const magic = sprite.magic;
      if (
        magic.moveKind === MagicMoveKind.FollowCharacter &&
        magic.specialKind === MagicSpecialKind.Buff
      ) {
        return true;
      }
    }
    return false;
  }
}
