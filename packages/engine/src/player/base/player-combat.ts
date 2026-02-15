/**
 * PlayerCombat - 战斗相关功能
 * 包含战斗状态、攻击、伤害、自动攻击、武功使用等功能
 *
 * 继承链: Character → PlayerBase → PlayerCombat → Player
 */

import type { Character } from "../../character";
import type { CharacterBase } from "../../character/base";
import { parseMagicListNoDistance } from "../../character/modules";
import { logger } from "../../core/logger";
import type { Vector2 } from "../../core/types";
import { CharacterState } from "../../core/types";
import { getMagicAtLevel, resolveMagic } from "../../magic/magic-config-loader";
import type { MagicData, MagicItemInfo } from "../../magic/types";
import { MagicAddonEffect } from "../../magic/types";
import { getDirection, tileToPixel } from "../../utils";
import type { Good } from "../goods";
import { GoodEffectType } from "../goods/good";
import { PlayerBase, THEW_USE_AMOUNT_WHEN_ATTACK } from "./player-base";

/**
 * PlayerCombat - 战斗功能层
 */
export abstract class PlayerCombat extends PlayerBase {
  // =============================================
  // === Attack Methods ===
  // =============================================

  /**
   * Reference: Player.CanAttack()
   * Check and consume thew for attacking
   */
  protected canAttack(): boolean {
    // if (Thew < ThewUseAmountWhenAttack) { GuiManager.ShowMessage("体力不足!"); return false; }
    if (this.thew < THEW_USE_AMOUNT_WHEN_ATTACK) {
      this.guiManager.showMessage("体力不足!");
      return false;
    }

    // else { Thew -= ThewUseAmountWhenAttack; return true; }
    this.thew -= THEW_USE_AMOUNT_WHEN_ATTACK;
    return true;
  }

  /**
   * Walk/run to target and attack when in range (used when clicking on enemy NPC)
   * 1:1 复刻Character.Attacking(Vector2 destinationTilePosition, bool isRun)
   *
   * NOTE: This is different from performeAttack():
   * - attacking() = WALK to target position, THEN attack when in range
   * - performeAttack() = IMMEDIATE attack in place (used for Ctrl+Click)
   */
  attacking(destinationTilePosition: Vector2, isRun: boolean = false): void {
    // if (PerformActionOk() && (IsStateImageOk(Attack) || ...))
    // 只有当可以执行动作时才处理（不在攻击/跳跃/死亡等动画中）
    if (!this.canPerformAction()) {
      return;
    }

    // _isRunToTarget = isRun;
    this._isRunToTarget = isRun;

    // DestinationAttackTilePosition = destinationTilePosition;
    this._destinationAttackTilePosition = {
      x: destinationTilePosition.x,
      y: destinationTilePosition.y,
    };

    // Magic magicToUse;
    // if (AttackingIsOk(out magicToUse)) PerformeAttack(magicToUse);
    // AttackingIsOk 会处理移动（如果距离不够）或返回 true（如果可以攻击）
    const result = this.attackingIsOk();

    if (result.isOk) {
      // 在攻击距离内且可以看到目标 - 执行攻击
      const destPixel = tileToPixel(destinationTilePosition.x, destinationTilePosition.y);
      this.performeAttack(destPixel);
    }
    // 如果 attackingIsOk 返回 false，它已经处理了移动（通过 moveToTarget）
  }

  /**
   * Update auto attack behavior
   * 1:1 复刻Player.UpdateAutoAttack(GameTime gameTime)
   */
  updateAutoAttack(deltaTime: number): void {
    if (this._autoAttackTarget !== null) {
      // 检查目标是否仍然有效
      // if (_autoAttackTarget.IsDeathInvoked || !_autoAttackTarget.IsEnemy || !NpcManager.HasNpc(_autoAttackTarget))
      if (
        this._autoAttackTarget.isDeathInvoked ||
        !this._autoAttackTarget.isEnemy ||
        !this.npcManager.getNpc(this._autoAttackTarget.name)
      ) {
        this._autoAttackTarget = null;
      } else {
        // _autoAttackTimer += (float)gameTime.ElapsedGameTime.TotalMilliseconds;
        this._autoAttackTimer += deltaTime * 1000;

        // if (_autoAttackTimer >= 100)
        if (this._autoAttackTimer >= 100) {
          // = 100;
          this._autoAttackTimer -= 100;

          // Attacking(_autoAttackTarget.TilePosition, _autoAttackIsRun);
          // 关键：使用目标的**当前位置**，这样如果目标移动了，玩家会跟随
          const targetPos = this._autoAttackTarget.tilePosition;
          this.attacking(targetPos, this._autoAttackIsRun);
        }
      }
    }
  }

  /**
   * Cancel auto attack
   */
  override cancelAutoAttack(): void {
    this._autoAttackTarget = null;
    this._destinationAttackTilePosition = null;
    this._autoAttackTimer = 0;
  }

  /**
   * Perform attack at a target position (IMMEDIATE attack in place)
   * destinationPositionInWorld, Magic magicToUse)
   *
   * NOTE: This is different from attacking():
   * - performeAttack() = IMMEDIATE attack in place, face target direction (used for Ctrl+Click)
   * - attacking() = WALK to target position, THEN attack when in range (used for clicking enemy NPC)
   *
   * @param destinationPixelPosition Target position in pixel coordinates (direction to face)
   */
  performeAttack(destinationPixelPosition: Vector2): void {
    // if (PerformActionOk())
    if (!this.canPerformAction()) {
      return;
    }

    // if (!CanPerformeAttack()) return;
    // CanPerformeAttack() checks DisableSkillMilliseconds <= 0
    if (this.statusEffects.disableSkillMilliseconds > 0) {
      return;
    }

    // Reference: Player.PerformeAttack() calls CanAttack() to check/consume thew
    if (!this.canAttack()) {
      return;
    }

    // StateInitialize(); ToFightingState();
    this.toFightingState();

    // Set up attack direction
    const direction = getDirection(this.pixelPosition, destinationPixelPosition);
    this._currentDirection = direction;

    // Random attack state (Attack, Attack1, Attack2)
    const randomValue = Math.floor(Math.random() * 3);
    let chosenState = CharacterState.Attack;
    if (randomValue === 1 && this.isStateImageOk(CharacterState.Attack1)) {
      chosenState = CharacterState.Attack1;
    } else if (randomValue === 2 && this.isStateImageOk(CharacterState.Attack2)) {
      chosenState = CharacterState.Attack2;
    }

    this.state = chosenState;

    // 如果是 Attack2 且有 SpecialAttackTexture，使用它
    this.onPerformeAttack();

    // Play animation once
    this.playCurrentDirOnce();

    // Store attack destination for onAttacking callback
    this._attackDestination = destinationPixelPosition;

    // BUG FIX: Set the magic to use when attack animation completes
    // This was missing - causing player attacks to never fire magic sprites
    // _magicToUseWhenAttack = GetRamdomMagicWithUseDistance(AttackRadius);
    this._magicToUseWhenAttack = this.getRandomMagicWithUseDistance(this.getAttackRadius());
  }

  /**
   * 获取替换后的武功（考虑装备带来的武功替换）
   * _replacedMagic 检查
   * @param magic 原始武功
   * @returns 替换后的武功（如果有替换）或原始武功
   */
  getReplacedMagic(magic: MagicData): MagicData {
    if (!magic.fileName) return magic;

    let replaced = this._replacedMagic.get(magic.fileName);
    if (!replaced) return magic;

    // if (magic.CurrentLevel != magicUse.CurrentLevel) magic = magic.GetLevel(...)
    // 如果替换武功的等级与原武功不同，获取正确等级
    if (replaced.currentLevel !== magic.currentLevel) {
      const leveledMagic = getMagicAtLevel(replaced, magic.currentLevel);
      if (leveledMagic) {
        replaced = leveledMagic;
        this._replacedMagic.set(magic.fileName, leveledMagic);
      }
    }

    // 复制附加效果
    // 注意：这里创建一个浅拷贝以避免修改原始数据
    return {
      ...replaced,
      additionalEffect: magic.additionalEffect,
    };
  }

  /**
   * 添加装备的武功替换
   * _replacedMagic[equip.ReplaceMagic] = Utils.GetMagic(equip.UseReplaceMagic)
   */
  addReplacedMagic(originalMagicFileName: string, replacementMagic: MagicData): void {
    this._replacedMagic.set(originalMagicFileName, replacementMagic);
    logger.log(
      `[Player] Added magic replacement: ${originalMagicFileName} -> ${replacementMagic.name}`
    );
  }

  /**
   * 移除装备的武功替换
   * _replacedMagic.Remove(equip.ReplaceMagic)
   */
  removeReplacedMagic(originalMagicFileName: string): void {
    this._replacedMagic.delete(originalMagicFileName);
    logger.log(`[Player] Removed magic replacement: ${originalMagicFileName}`);
  }

  /**
   * Override: 攻击动画结束时发射武功
   * MagicManager.UseMagic(this, _magicToUseWhenAttack, PositionInWorld, _attackDestination)
   *
   * 战斗中同步获取缓存（武功应在 addMagic 时预加载）
   */
  protected override useMagicWhenAttack(): void {
    if (!this._magicToUseWhenAttack || !this._attackDestination) {
      // 没有配置武功，清理并返回
      this._magicToUseWhenAttack = null;
      // 注意：不清理 _attackDestination，onAttacking 可能仍需要它（修炼武功）
      return;
    }

    // 同步获取缓存的武功
    const resolved = resolveMagic(this._magicToUseWhenAttack, this.level);
    if (!resolved) {
      this._magicToUseWhenAttack = null;
      // 注意：不清理 _attackDestination，onAttacking 可能仍需要它（修炼武功）
      return;
    }

    let magicAtLevel = resolved;

    // 检查 _replacedMagic 并替换
    magicAtLevel = this.getReplacedMagic(magicAtLevel);

    // Reference: Character.Equiping/SetFlyIniAdditionalEffect
    // 应用武器的附加效果（中毒/冰冻/石化）到武功上
    if (this._flyIniAdditionalEffect !== MagicAddonEffect.None) {
      magicAtLevel = {
        ...magicAtLevel,
        additionalEffect: this._flyIniAdditionalEffect,
      };
    }

    this.engine.magicSpriteManager.useMagic({
      userId: "player",
      magic: magicAtLevel,
      origin: this._positionInWorld,
      destination: this._attackDestination,
    });

    logger.log(`[Player] Used attack magic: ${this._magicToUseWhenAttack}`);

    // 只清理 _magicToUseWhenAttack，_attackDestination 保留给 onAttacking 使用
    this._magicToUseWhenAttack = null;
  }

  /**
   * Player.OnPerformeAttack()
   * 攻击开始时，如果是 Attack2 状态且有 SpecialAttackTexture，使用它
   */
  protected override onPerformeAttack(): void {
    // if (SpecialAttackTexture != null && State == (int)CharacterState.Attack2)
    //     Texture = SpecialAttackTexture;
    if (this._specialAttackTexture !== null && this.state === CharacterState.Attack2) {
      // 使用预加载的 SpecialAttackTexture（与原版一致，同步设置）
      this.texture = this._specialAttackTexture;
    }
  }

  /**
   * Called when attack animation completes
   * Reference: Character.OnAttacking(_attackDestination)
   *
   * 在原版中，Player 覆盖 OnAttacking 来处理修炼武功的 AttackFile。
   * 普通攻击的伤害通过 FlyIni 武功发射 MagicSprite 来处理。
   * 武功发射现在在基类的 useMagicWhenAttack 中处理。
   */
  protected override onAttacking(): void {
    // 如果是 Attack2 且有修炼武功的 AttackFile，释放它
    // if (State == (int)CharacterState.Attack2 && XiuLianMagic?.TheMagic?.AttackFile != null)
    //   MagicManager.UseMagic(this, XiuLianMagic.TheMagic.AttackFile, PositionInWorld, _attackDestination);
    if (this.state === CharacterState.Attack2 && this._attackDestination) {
      // 使用预加载的修炼武功攻击魔法
      if (this._xiuLianAttackMagic && this.engine.magicSpriteManager) {
        // 应用武器的附加效果
        let magicToUse: MagicData = this._xiuLianAttackMagic;
        if (this._flyIniAdditionalEffect !== MagicAddonEffect.None) {
          magicToUse = {
            ...this._xiuLianAttackMagic,
            additionalEffect: this._flyIniAdditionalEffect,
          };
        }
        this.engine.magicSpriteManager.useMagic({
          userId: "player",
          magic: magicToUse,
          origin: { ...this._positionInWorld },
          destination: { ...this._attackDestination },
        });
        logger.log(`[Player] Used XiuLian attack magic: ${this._xiuLianAttackMagic.name}`);
      }
    }

    // 清理攻击目标位置
    this._attackDestination = null;
    this._destinationAttackTilePosition = null;
  }

  // ========== ReplaceMagicList Overrides ==========
  // Player.OnReplaceMagicList, OnRecoverFromReplaceMagicList

  /**
   * 替换武功列表事件 - Player 特有实现
   * (override)
   * 注意：Player 完全覆盖此方法，不调用基类（与原版一致）
   * Player 只处理 PlayerMagicInventory，不处理 flyIniInfos
   */
  protected override onReplaceMagicList(reasonMagic: MagicData, listStr: string): void {
    if (!listStr) return;

    // Player 不调用 base.OnReplaceMagicList，直接处理 PlayerMagicInventory

    // 保存当前使用的武功索引
    const currentIndex = this.currentUseMagicIndex;

    // var magics = list == "无" ? new List<string>() : ParseMagicListNoDistance(list);
    const magics = listStr === "無" ? [] : parseMagicListNoDistance(listStr);

    // var path = StorageBase.SaveGameDirectory + @"\" + Name + "_" + reasonMagic.Name + "_" + string.Join("_", magics) + ".ini";
    const path = `${this.name}_${reasonMagic.name}_${magics.join("_")}.ini`;

    // 替换 PlayerMagicInventory 列表
    this._magicInventory.replaceListTo(path, magics).then(() => {
      // 恢复当前使用的武功索引
      this.currentUseMagicIndex = currentIndex;
      // XiuLianMagic = PlayerMagicInventory.GetItemInfo(PlayerMagicInventory.XiuLianIndex)
      this.updateSpecialAttackTexture(this._magicInventory.getXiuLianMagic());
    });

    logger.log(`[Player] OnReplaceMagicList: replaced with "${listStr}" (${magics.length} magics)`);
  }

  /**
   * 从替换武功列表恢复事件 - Player 特有实现
   * (override)
   * 注意：Player 完全覆盖此方法，不调用基类（与原版一致）
   * Player 只处理 PlayerMagicInventory，不处理 flyIniInfos
   */
  protected override onRecoverFromReplaceMagicList(reasonMagic: MagicData): void {
    if (!reasonMagic.replaceMagic) return;

    // Player 不调用 base.OnRecoverFromReplaceMagicList，直接处理 PlayerMagicInventory

    // 保存当前使用的武功索引
    const currentIndex = this.currentUseMagicIndex;

    // 停止 PlayerMagicInventory 替换
    this._magicInventory.stopReplace();

    // 恢复当前使用的武功索引
    this.currentUseMagicIndex = currentIndex;
    // XiuLianMagic = PlayerMagicInventory.GetItemInfo(PlayerMagicInventory.XiuLianIndex)
    this.updateSpecialAttackTexture(this._magicInventory.getXiuLianMagic());

    logger.log(`[Player] OnRecoverFromReplaceMagicList: restored original magic list`);
  }

  /**
   * Set auto attack target
   */
  setAutoAttackTarget(target: Character | null, isRun: boolean = false): void {
    this._autoAttackTarget = target;
    this._autoAttackIsRun = isRun;
    this._autoAttackTimer = 0;
    if (target) {
      // Copy position to avoid reference issues
      const pos = target.tilePosition;
      this._destinationAttackTilePosition = { x: pos.x, y: pos.y };
    } else {
      this._destinationAttackTilePosition = null;
    }
  }

  /**
   * Get auto attack target
   */
  getAutoAttackTarget(): Character | null {
    return this._autoAttackTarget;
  }

  /**
   * Override: Called when reaching destination and ready to attack
   * reaching destination, PerformeAttack(magicToUse) is called
   */
  protected override performAttackAtDestination(): void {
    if (!this._destinationAttackTilePosition) return;

    // Convert tile position to pixel for performeAttack
    const destPixel = tileToPixel(
      this._destinationAttackTilePosition.x,
      this._destinationAttackTilePosition.y
    );

    logger.log(
      `[Player] Reached attack destination, performing attack at (${this._destinationAttackTilePosition.x}, ${this._destinationAttackTilePosition.y})`
    );

    // Perform the attack
    this.performeAttack(destPixel);
  }

  // =============================================
  // === Magic Usage ===
  // =============================================

  /**
   * Override magic cast hook - called when magic animation completes
   * case CharacterState.Magic - CanUseMagic() + PlaySoundEffect + MagicManager.UseMagic()
   */
  override onMagicCast(): void {
    // Play Magic state sound effect
    // Reference: PlaySoundEffect(NpcIni[(int)CharacterState.Magic].Sound)
    this.playStateSound(CharacterState.Magic);

    if (this._pendingMagic && this.engine.magicSpriteManager) {
      // Reference: Player.CanUseMagic() - 在动画结束后扣除内力/体力/生命
      // 再次检查能否使用（防止期间消耗改变）
      const canUse = this.canUseMagic(this._pendingMagic.magic);
      if (!canUse.canUse) {
        logger.log(`[Magic] Cannot release magic: ${canUse.reason}`);
        this._pendingMagic = null;
        return;
      }

      // 扣除消耗
      this.consumeMagicCost(this._pendingMagic.magic);

      // 检查 _replacedMagic 并替换
      const magicToUse = this.getReplacedMagic(this._pendingMagic.magic);

      logger.log(`[Magic] Releasing ${magicToUse.name} after casting animation`);
      this.engine.magicSpriteManager.useMagic({
        userId: "player",
        magic: magicToUse,
        origin: this._pendingMagic.origin,
        destination: this._pendingMagic.destination,
        targetId: this._pendingMagic.targetId,
      });
      this._pendingMagic = null;
    }
  }

  /**
   * Set pending magic to release after casting animation
   * stores MagicUse, _magicDestination, _magicTarget for release in Update()
   */
  setPendingMagic(
    magic: MagicData,
    origin: Vector2,
    destination: Vector2,
    targetId?: string
  ): void {
    this._pendingMagic = { magic, origin, destination, targetId };
  }

  // =============================================
  // === Magic Check Methods ===
  // =============================================

  canUseMagic(magic: {
    manaCost: number;
    thewCost: number;
    lifeCost: number;
    lifeFullToUse: number;
    disableUse: number;
  }): { canUse: boolean; reason?: string } {
    if (magic.disableUse !== 0) {
      return { canUse: false, reason: "该武功不能使用" };
    }

    if (magic.lifeFullToUse !== 0 && this.life < this.lifeMax) {
      return { canUse: false, reason: "需要满血才能使用此武功" };
    }

    // if (Mana < MagicUse.ManaCost || ManaLimit)
    if (this.mana < magic.manaCost || this._manaLimit) {
      return { canUse: false, reason: "没有足够的内力使用这种武功" };
    }

    if (this.thew < magic.thewCost) {
      return { canUse: false, reason: "没有足够的体力使用这种武功" };
    }

    return { canUse: true };
  }

  consumeMagicCost(magic: { manaCost: number; thewCost: number; lifeCost: number }): void {
    this.mana = Math.max(0, this.mana - magic.manaCost);
    this.thew = Math.max(0, this.thew - magic.thewCost);
    if (magic.lifeCost !== 0) {
      this.addLife(-magic.lifeCost);
    }
  }

  // =============================================
  // === Equipment Methods ===
  // =============================================

  /**
   * 设置武功的附加效果
   */
  protected setFlyIniAdditionalEffect(effect: MagicAddonEffect): void {
    this._flyIniAdditionalEffect = effect;
    // if (FlyIni != null) FlyIni.AdditionalEffect = effect;
    // if (FlyIni2 != null) FlyIni2.AdditionalEffect = effect;
    // 注意：TypeScript 中 FlyIni 的效果在 useMagicWhenAttack 时动态应用
  }

  /**
   * 异步加载并添加装备的被攻击触发武功
   * MagicToUseWhenAttackedList.AddLast
   */
  protected async loadAndAddEquipMagicToUseWhenBeAttacked(
    equipFileName: string,
    magicFileName: string,
    direction: number
  ): Promise<void> {
    try {
      const magic = resolveMagic(magicFileName, this.attackLevel);
      if (!magic) return;
      this.addMagicToUseWhenAttackedList({
        from: equipFileName,
        magic,
        dir: direction,
      });
      logger.log(
        `[Player] Added MagicToUseWhenBeAttacked from equip ${equipFileName}: ${magic.name}`
      );
    } catch (err) {
      logger.error(`[Player] Error loading MagicToUseWhenBeAttacked: ${err}`);
    }
  }

  /**
   * 异步加载并添加装备的武功替换
   * _replacedMagic[equip.ReplaceMagic] = Utils.GetMagic(equip.UseReplaceMagic)
   */
  protected async loadAndAddEquipReplaceMagic(
    originalMagicFileName: string,
    replacementMagicFileName: string
  ): Promise<void> {
    try {
      const replacementMagic = resolveMagic(replacementMagicFileName);
      if (!replacementMagic) return;
      this.addReplacedMagic(originalMagicFileName, replacementMagic);
      logger.log(
        `[Player] Added equip ReplaceMagic: ${originalMagicFileName} -> ${replacementMagic.name}`
      );
    } catch (err) {
      logger.error(`[Player] Error loading UseReplaceMagic: ${err}`);
    }
  }

  /**
   * 处理装备的 MagicIniWhenUse
   * Reference: Player.Equiping/UnEquiping - MagicIniWhenUse 处理
   * @param magicFileName 武功文件名
   * @param isEquip true=装备时, false=卸下时
   */
  protected handleEquipMagicIniWhenUse(magicFileName: string, isEquip: boolean): void {
    if (isEquip) {
      // 装备时检查武功是否已隐藏，如果是则取消隐藏，否则添加新武功
      const isHide = this._magicInventory.isMagicHided(magicFileName);
      const existingMagic = this._magicInventory.getNonReplaceMagic(magicFileName);
      const hasHideCount = existingMagic?.hideCount ? existingMagic.hideCount > 0 : false;

      if (isHide || hasHideCount) {
        // 取消隐藏
        const info = this._magicInventory.setMagicHide(magicFileName, false);
        if (isHide && info) {
          this.showMessage(`武功${info.magic?.name}已可使用`);
        }
      } else {
        // 添加新武功
        this.addMagic(magicFileName);
      }
    } else {
      // 卸下时隐藏武功
      const info = this._magicInventory.setMagicHide(magicFileName, true);
      if (info && info.hideCount === 0) {
        this.showMessage(`武功${info.magic?.name}已不可使用`);
        // 处理修炼武功和当前使用武功
        this.onDeleteMagicFromEquip(info);
      }
    }
  }

  /**
   * 当装备移除导致武功不可用时的处理
   */
  protected onDeleteMagicFromEquip(info: MagicItemInfo | null): void {
    if (!info?.magic) return;

    // 如果正在修炼此武功，取消修炼
    const xiuLianMagic = this._magicInventory.getXiuLianMagic();
    if (xiuLianMagic?.magic?.name === info.magic.name) {
      this._magicInventory.setXiuLianMagic(null);
    }

    // 如果当前使用此武功，取消使用
    const currentMagic = this._magicInventory.getCurrentMagicInUse();
    if (currentMagic?.magic?.name === info.magic.name) {
      this._magicInventory.setCurrentMagicInUse(null);
    }
  }

  /**
   * 使用药品
   * 覆盖基类实现，直接调用 super.useDrug
   * 继承 Character.UseDrug，没有覆盖
   */
  override useDrug(drug: Good): boolean {
    return super.useDrug(drug);
  }

  // =============================================
  // === Equip/Unequip ===
  // =============================================

  equiping(equip: Good | null, currentEquip: Good | null, justEffectType: boolean = false): void {
    // Reference: 保存当前 Life/Thew/Mana 用于装备后恢复
    const savedLife = this.life;
    const savedThew = this.thew;
    const savedMana = this.mana;

    this.unEquiping(currentEquip, justEffectType);

    if (equip) {
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

        if (equip.magicIniWhenUse) {
          this.showMessage(`获得武功：${equip.magicIniWhenUse}`);
        }
      }

      // 根据 TheEffectType 设置效果
      const effectType = equip.theEffectType;
      switch (effectType) {
        case GoodEffectType.ThewNotLoseWhenRun:
          this._isNotUseThewWhenRun = true;
          break;
        case GoodEffectType.ManaRestore:
          this._isManaRestore = true;
          break;
        // for weapon effects
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

      if (equip.specialEffect === 1) {
        this._addLifeRestorePercent += equip.specialEffectValue;
      }

      this.addMoveSpeedPercent += equip.changeMoveSpeedPercent;
      this._addMagicEffectPercent += equip.addMagicEffectPercent;
      this._addMagicEffectAmount += equip.addMagicEffectAmount;

      // MagicToUseWhenBeAttacked 处理
      if (equip.magicToUseWhenBeAttacked) {
        this.loadAndAddEquipMagicToUseWhenBeAttacked(
          equip.fileName,
          equip.magicToUseWhenBeAttacked,
          equip.magicDirectionWhenBeAttacked
        );
      }

      // FlyIniReplace 处理
      if (equip.flyIni) {
        this.addFlyIniReplace(equip.flyIni);
      }
      if (equip.flyIni2) {
        this.addFlyIni2Replace(equip.flyIni2);
      }

      // ReplaceMagic 处理
      if (equip.replaceMagic && equip.useReplaceMagic) {
        this.loadAndAddEquipReplaceMagic(equip.replaceMagic, equip.useReplaceMagic);
      }

      // MagicIniWhenUse 处理
      // 装备带来的武功，显示隐藏的武功或添加新武功
      if (!justEffectType && equip.magicIniWhenUse) {
        this.handleEquipMagicIniWhenUse(equip.magicIniWhenUse, true);
      }
    }

    // Reference: 恢复保存的 Life/Thew/Mana，但不超过新的 Max 值
    this.life = Math.min(savedLife, this.lifeMax);
    this.thew = Math.min(savedThew, this.thewMax);
    this.mana = Math.min(savedMana, this.manaMax);
  }

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

      if (equip.magicIniWhenUse) {
        this.showMessage(`武功已不可使用`);
      }
    }

    // 根据 TheEffectType 清除效果
    const effectType = equip.theEffectType;
    switch (effectType) {
      case GoodEffectType.ThewNotLoseWhenRun:
        this._isNotUseThewWhenRun = false;
        break;
      case GoodEffectType.ManaRestore:
        this._isManaRestore = false;
        break;
      // Reference: SetFlyIniAdditionalEffect(None) for weapon effects
      case GoodEffectType.EnemyFrozen:
      case GoodEffectType.EnemyPoisoned:
      case GoodEffectType.EnemyPetrified:
        this.setFlyIniAdditionalEffect(MagicAddonEffect.None);
        break;
    }

    if (equip.specialEffect === 1) {
      this._addLifeRestorePercent -= equip.specialEffectValue;
    }

    this.addMoveSpeedPercent -= equip.changeMoveSpeedPercent;
    this._addMagicEffectPercent -= equip.addMagicEffectPercent;
    this._addMagicEffectAmount -= equip.addMagicEffectAmount;

    // MagicToUseWhenBeAttacked 处理
    if (equip.magicToUseWhenBeAttacked) {
      this.removeMagicToUseWhenAttackedList(equip.fileName);
    }

    // FlyIniReplace 处理
    if (equip.flyIni) {
      this.removeFlyIniReplace(equip.flyIni);
    }
    if (equip.flyIni2) {
      this.removeFlyIni2Replace(equip.flyIni2);
    }

    // ReplaceMagic 处理
    if (equip.replaceMagic) {
      this.removeReplacedMagic(equip.replaceMagic);
    }

    // MagicIniWhenUse 处理
    // 隐藏装备带来的武功
    if (!justEffectType && equip.magicIniWhenUse) {
      this.handleEquipMagicIniWhenUse(equip.magicIniWhenUse, false);
    }

    if (this.life > this.lifeMax) this.life = this.lifeMax;
    if (this.thew > this.thewMax) this.thew = this.thewMax;
    if (this.mana > this.manaMax) this.mana = this.manaMax;
  }

  // =============================================
  // === Damage Methods ===
  // =============================================

  /**
   * Override takeDamage to use Character's proper damage calculation
   * handles defend, hit rate, and min damage
   *
   * Note: This method signature matches Character's takeDamage for proper override
   */
  override takeDamage(damage: number, attacker: CharacterBase | null = null): void {
    // Call parent's takeDamage which handles:
    // - Defend reduction
    // - Hit rate calculation based on evade
    // - Minimum damage (5)
    // - Death handling
    super.takeDamage(damage, attacker);
  }

  /**
   * Simple damage method for scripts/direct damage (no defend calculation)
   * Use this for fixed damage amounts (e.g., from traps, scripts)
   */
  takeDamageRaw(amount: number): boolean {
    // 调试无敌模式：玩家不受伤害
    if (this.engine.debugManager.isGodMode()) {
      return false;
    }

    this.life -= amount;
    if (this.life <= 0) {
      this.life = 0;
      this.state = CharacterState.Death;
      return true;
    }
    return false;
  }
}
