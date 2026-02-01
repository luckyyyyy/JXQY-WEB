/**
 * StatusEffectsManager - 状态效果管理器
 * 从 Character 类提取的状态效果逻辑（冰冻、中毒、石化、弱化、隐身等）
 *
 * 使用组合模式，确保完整的类型推导支持
 * C# Reference: Character.cs 中的状态效果相关字段和方法
 */

import type { MagicSprite } from "../../magic/magicSprite";
import type { MagicData } from "../../magic/types";

/**
 * 状态效果数据接口
 * 定义所有状态效果相关的字段
 */
export interface StatusEffectsData {
  // === 基础状态效果（冰冻/中毒/石化）===
  poisonSeconds: number;
  petrifiedSeconds: number;
  frozenSeconds: number;
  isPoisonVisualEffect: boolean;
  isPetrifiedVisualEffect: boolean;
  isFrozenVisualEffect: boolean;
  poisonByCharacterName: string;

  // === 隐身效果 ===
  invisibleByMagicTime: number;
  isVisibleWhenAttack: boolean;

  // === 禁用效果 ===
  disableMoveMilliseconds: number;
  disableSkillMilliseconds: number;

  // === 弱化效果 ===
  weakByMagicSprite: MagicSprite | null;
  weakByMagicSpriteTime: number;

  // === 加速效果 ===
  speedUpByMagicSprite: MagicSprite | null;

  // === 变身效果 ===
  changeCharacterByMagicSprite: MagicSprite | null;
  changeCharacterByMagicSpriteTime: number;

  // === 阵营变换效果 ===
  changeToOppositeMilliseconds: number;

  // === 飞行INI替换效果 ===
  changeFlyIniByMagicSprite: MagicSprite | null;

  // === 控制效果 ===
  controledMagicSprite: MagicSprite | null;
}

/**
 * 创建默认状态效果数据
 */
export function createDefaultStatusEffectsData(): StatusEffectsData {
  return {
    poisonSeconds: 0,
    petrifiedSeconds: 0,
    frozenSeconds: 0,
    isPoisonVisualEffect: false,
    isPetrifiedVisualEffect: false,
    isFrozenVisualEffect: false,
    poisonByCharacterName: "",

    invisibleByMagicTime: 0,
    isVisibleWhenAttack: false,

    disableMoveMilliseconds: 0,
    disableSkillMilliseconds: 0,

    weakByMagicSprite: null,
    weakByMagicSpriteTime: 0,

    speedUpByMagicSprite: null,

    changeCharacterByMagicSprite: null,
    changeCharacterByMagicSpriteTime: 0,

    changeToOppositeMilliseconds: 0,

    changeFlyIniByMagicSprite: null,

    controledMagicSprite: null,
  };
}

/**
 * 状态效果更新结果
 */
export interface StatusEffectsUpdateResult {
  /** 是否被石化（需要跳过后续更新） */
  isPetrified: boolean;
  /** 速度倍率（加速效果） */
  speedFold: number;
  /** 有效的时间差（考虑冰冻减速） */
  effectiveDeltaTime: number;
  /** 中毒造成的伤害 */
  poisonDamage: number;
  /** 中毒致死时的投毒者名称 */
  poisonKillerName: string | null;
}

/**
 * 状态效果管理器
 * 管理角色的各种状态效果（冰冻、中毒、石化、弱化、隐身等）
 *
 * @example
 * ```typescript
 * class Character {
 *   private _statusEffects = new StatusEffectsManager();
 *
 *   get isFrozened() { return this._statusEffects.isFrozened; }
 *
 *   update(deltaTime: number) {
 *     const result = this._statusEffects.update(deltaTime);
 *     if (result.isPetrified) return;
 *     // ... 使用 result.effectiveDeltaTime 继续更新
 *   }
 * }
 * ```
 */
export class StatusEffectsManager {
  // === 基础状态效果 ===
  poisonSeconds = 0;
  petrifiedSeconds = 0;
  frozenSeconds = 0;
  isPoisonVisualEffect = false;
  isPetrifiedVisualEffect = false;
  isFrozenVisualEffect = false;
  poisonByCharacterName = "";

  // === 隐身效果 ===
  invisibleByMagicTime = 0;
  isVisibleWhenAttack = false;

  // === 禁用效果 ===
  disableMoveMilliseconds = 0;
  disableSkillMilliseconds = 0;

  // === 弱化效果 (C#: _weakByMagicSprite) ===
  private _weakByMagicSprite: MagicSprite | null = null;
  private _weakByMagicSpriteTime = 0;

  // === 加速效果 (C#: SppedUpByMagicSprite) ===
  speedUpByMagicSprite: MagicSprite | null = null;

  // === 变身效果 (C#: _changeCharacterByMagicSprite) ===
  private _changeCharacterByMagicSprite: MagicSprite | null = null;
  private _changeCharacterByMagicSpriteTime = 0;

  // === 阵营变换效果 ===
  private _changeToOppositeMilliseconds = 0;

  // === 飞行INI替换效果 ===
  private _changeFlyIniByMagicSprite: MagicSprite | null = null;

  // === 控制效果 ===
  private _controledMagicSprite: MagicSprite | null = null;

  // === 中毒伤害计时器 ===
  private _poisonedMilliSeconds = 0;

  // ========== Getters ==========

  /** C#: IsFrozened - 是否被冻结 */
  get isFrozened(): boolean {
    return this.frozenSeconds > 0;
  }

  /** C#: IsPoisoned - 是否中毒 */
  get isPoisoned(): boolean {
    return this.poisonSeconds > 0;
  }

  /** C#: IsPetrified - 是否被石化 */
  get isPetrified(): boolean {
    return this.petrifiedSeconds > 0;
  }

  /**
   * C#: BodyFunctionWell - 身体是否正常运作
   * 未被冻结、中毒、石化时返回 true
   */
  get bodyFunctionWell(): boolean {
    return this.frozenSeconds <= 0 && this.poisonSeconds <= 0 && this.petrifiedSeconds <= 0;
  }

  /** 获取弱化效果武功精灵 */
  get weakByMagicSprite(): MagicSprite | null {
    return this._weakByMagicSprite;
  }

  /** 获取变身效果武功精灵 */
  get changeCharacterByMagicSprite(): MagicSprite | null {
    return this._changeCharacterByMagicSprite;
  }

  /** 获取变身效果剩余时间 */
  get changeCharacterByMagicSpriteTime(): number {
    return this._changeCharacterByMagicSpriteTime;
  }

  /** 获取阵营变换剩余时间 */
  get changeToOppositeMilliseconds(): number {
    return this._changeToOppositeMilliseconds;
  }

  /** 获取飞行INI替换效果武功精灵 */
  get changeFlyIniByMagicSprite(): MagicSprite | null {
    return this._changeFlyIniByMagicSprite;
  }

  /** 获取控制效果武功精灵 */
  get controledMagicSprite(): MagicSprite | null {
    return this._controledMagicSprite;
  }

  // ========== Setters ==========

  /**
   * C#: SetFrozenSeconds(float s, bool hasVisualEffect)
   * 设置冻结时间，已冻结时不覆盖
   */
  setFrozenSeconds(seconds: number, hasVisualEffect: boolean): void {
    if (this.frozenSeconds > 0) return;
    this.frozenSeconds = seconds;
    this.isFrozenVisualEffect = hasVisualEffect;
  }

  /**
   * C#: SetPoisonSeconds(float s, bool hasVisualEffect)
   * 设置中毒时间，已中毒时不覆盖
   */
  setPoisonSeconds(seconds: number, hasVisualEffect: boolean): void {
    if (this.poisonSeconds > 0) return;
    this.poisonSeconds = seconds;
    this.isPoisonVisualEffect = hasVisualEffect;
  }

  /**
   * C#: SetPetrifySeconds(float s, bool hasVisualEffect)
   * 设置石化时间，已石化时不覆盖
   */
  setPetrifySeconds(seconds: number, hasVisualEffect: boolean): void {
    if (this.petrifiedSeconds > 0) return;
    this.petrifiedSeconds = seconds;
    this.isPetrifiedVisualEffect = hasVisualEffect;
  }

  /**
   * 设置控制效果武功精灵
   */
  setControledMagicSprite(sprite: MagicSprite | null): void {
    this._controledMagicSprite = sprite;
  }

  /**
   * 设置飞行INI替换效果武功精灵
   */
  setChangeFlyIniByMagicSprite(sprite: MagicSprite | null): void {
    this._changeFlyIniByMagicSprite = sprite;
  }

  // ========== Clear Methods ==========

  /**
   * 解除异常状态
   * C# Reference: Character.RemoveAbnormalState
   */
  removeAbnormalState(): void {
    this.clearFrozen();
    this.clearPoison();
    this.clearPetrifaction();
    this.disableMoveMilliseconds = 0;
    this.disableSkillMilliseconds = 0;
  }

  /** 清除冰冻状态 */
  clearFrozen(): void {
    this.frozenSeconds = 0;
    this.isFrozenVisualEffect = false;
  }

  /** 清除中毒状态 */
  clearPoison(): void {
    this.poisonSeconds = 0;
    this.isPoisonVisualEffect = false;
    this.poisonByCharacterName = "";
  }

  /** 清除石化状态 */
  clearPetrifaction(): void {
    this.petrifiedSeconds = 0;
    this.isPetrifiedVisualEffect = false;
  }

  // ========== Effect Application Methods ==========

  /**
   * 弱化效果 - 降低攻防百分比
   * C# Reference: Character.WeakBy
   */
  weakBy(magicSprite: MagicSprite): void {
    this._weakByMagicSprite = magicSprite;
    this._weakByMagicSpriteTime = magicSprite.magic.weakMilliseconds ?? 0;
  }

  /**
   * 变换阵营 - 临时变换敌我关系
   * C# Reference: Character.ChangeToOpposite
   * @param milliseconds 变换时间（毫秒）
   * @param isPlayer 是否是玩家（玩家不能被变换阵营）
   */
  changeToOpposite(milliseconds: number, isPlayer: boolean): void {
    if (isPlayer) return;
    // C#: _changeToOppositeMilliseconds = _changeToOppositeMilliseconds > 0 ? 0 : milliseconds;
    this._changeToOppositeMilliseconds = this._changeToOppositeMilliseconds > 0 ? 0 : milliseconds;
  }

  /**
   * 通过武功精灵变身
   * C# Reference: Character.ChangeCharacterBy
   * @param magicSprite 武功精灵
   * @returns 需要执行的 replaceMagic 字符串
   */
  changeCharacterBy(magicSprite: MagicSprite): string {
    this._changeCharacterByMagicSprite = magicSprite;
    this._changeCharacterByMagicSpriteTime = magicSprite.magic.effect ?? 0;
    return magicSprite.magic.replaceMagic ?? "";
  }

  /**
   * 变形（短暂变身）
   * C# Reference: Character.MorphBy
   * @param magicSprite 武功精灵
   * @returns 需要执行的 replaceMagic 字符串
   */
  morphBy(magicSprite: MagicSprite): string {
    this._changeCharacterByMagicSprite = magicSprite;
    this._changeCharacterByMagicSpriteTime = magicSprite.magic.morphMilliseconds ?? 0;
    return magicSprite.magic.replaceMagic ?? "";
  }

  /**
   * 清除变身效果
   * @returns 变身效果的武功数据（用于恢复武功列表）
   */
  clearChangeCharacter(): MagicData | null {
    const magic = this._changeCharacterByMagicSprite?.magic ?? null;
    this._changeCharacterByMagicSprite = null;
    this._changeCharacterByMagicSpriteTime = 0;
    return magic;
  }

  // ========== Update Method ==========

  /**
   * 更新状态效果
   * 应在 Character.update() 开始时调用
   *
   * @param deltaTime 时间差（秒）
   * @param isDeathInvoked 角色是否已死亡
   * @returns 更新结果，包含是否石化、速度倍率、有效时间差、中毒伤害等
   */
  update(deltaTime: number, isDeathInvoked: boolean): StatusEffectsUpdateResult {
    const deltaMs = deltaTime * 1000;
    const result: StatusEffectsUpdateResult = {
      isPetrified: false,
      speedFold: 1.0,
      effectiveDeltaTime: deltaTime,
      poisonDamage: 0,
      poisonKillerName: null,
    };

    // === 弱化效果时间倒计时 ===
    if (this._weakByMagicSpriteTime > 0) {
      this._weakByMagicSpriteTime -= deltaMs;
      if (this._weakByMagicSpriteTime <= 0) {
        this._weakByMagicSprite = null;
        this._weakByMagicSpriteTime = 0;
      }
    }

    // === 变身效果时间倒计时 ===
    // 注意：实际的变身恢复逻辑（如恢复武功列表）需要在 Character 中处理
    if (this._changeCharacterByMagicSpriteTime > 0) {
      this._changeCharacterByMagicSpriteTime -= deltaMs;
    }

    // === 阵营变换时间倒计时 ===
    if (this._changeToOppositeMilliseconds > 0) {
      this._changeToOppositeMilliseconds -= deltaMs;
    }

    // === 禁止移动/技能时间倒计时 ===
    if (this.disableMoveMilliseconds > 0) {
      this.disableMoveMilliseconds -= deltaMs;
    }
    if (this.disableSkillMilliseconds > 0) {
      this.disableSkillMilliseconds -= deltaMs;
    }

    // === 隐身时间倒计时 ===
    if (this.invisibleByMagicTime > 0) {
      this.invisibleByMagicTime -= deltaMs;
      if (this.invisibleByMagicTime <= 0) {
        this.invisibleByMagicTime = 0;
      }
    }

    // === 加速效果检查（精灵是否已销毁） ===
    if (
      this.speedUpByMagicSprite !== null &&
      (this.speedUpByMagicSprite.isInDestroy || this.speedUpByMagicSprite.isDestroyed)
    ) {
      this.speedUpByMagicSprite = null;
    }

    // === 飞行INI替换效果检查 ===
    if (
      this._changeFlyIniByMagicSprite !== null &&
      (this._changeFlyIniByMagicSprite.isInDestroy || this._changeFlyIniByMagicSprite.isDestroyed)
    ) {
      this._changeFlyIniByMagicSprite = null;
    }

    // === 计算速度倍率 ===
    if (this.speedUpByMagicSprite !== null || this._changeCharacterByMagicSprite !== null) {
      let percent = 100;
      if (this.speedUpByMagicSprite !== null) {
        percent += this.speedUpByMagicSprite.magic.rangeSpeedUp || 0;
      }
      if (this._changeCharacterByMagicSprite !== null) {
        percent += this._changeCharacterByMagicSprite.magic.speedAddPercent || 0;
      }
      result.speedFold = percent / 100;
    }

    const foldedDeltaTime = deltaTime * result.speedFold;

    // === 中毒效果处理 ===
    if (this.poisonSeconds > 0) {
      this.poisonSeconds -= foldedDeltaTime;
      this._poisonedMilliSeconds += foldedDeltaTime * 1000;

      // 每 250ms 造成 10 点伤害
      if (this._poisonedMilliSeconds > 250) {
        this._poisonedMilliSeconds = 0;
        result.poisonDamage = 10;

        // 中毒致死时记录投毒者
        if (isDeathInvoked && this.poisonByCharacterName) {
          result.poisonKillerName = this.poisonByCharacterName;
          this.poisonByCharacterName = "";
        }
      }

      if (this.poisonSeconds <= 0) {
        this.poisonByCharacterName = "";
      }
    }

    // === 石化效果检查 ===
    if (this.petrifiedSeconds > 0) {
      this.petrifiedSeconds -= foldedDeltaTime;
      result.isPetrified = true;
      return result;
    }

    // === 冰冻效果（减速） ===
    result.effectiveDeltaTime = foldedDeltaTime;
    if (this.frozenSeconds > 0) {
      this.frozenSeconds -= foldedDeltaTime;
      result.effectiveDeltaTime = foldedDeltaTime / 2; // 冻结时动作减速
    }

    return result;
  }

  // ========== Serialization ==========

  /**
   * 导出状态数据（用于存档）
   */
  exportData(): StatusEffectsData {
    return {
      poisonSeconds: this.poisonSeconds,
      petrifiedSeconds: this.petrifiedSeconds,
      frozenSeconds: this.frozenSeconds,
      isPoisonVisualEffect: this.isPoisonVisualEffect,
      isPetrifiedVisualEffect: this.isPetrifiedVisualEffect,
      isFrozenVisualEffect: this.isFrozenVisualEffect,
      poisonByCharacterName: this.poisonByCharacterName,

      invisibleByMagicTime: this.invisibleByMagicTime,
      isVisibleWhenAttack: this.isVisibleWhenAttack,

      disableMoveMilliseconds: this.disableMoveMilliseconds,
      disableSkillMilliseconds: this.disableSkillMilliseconds,

      weakByMagicSprite: this._weakByMagicSprite,
      weakByMagicSpriteTime: this._weakByMagicSpriteTime,

      speedUpByMagicSprite: this.speedUpByMagicSprite,

      changeCharacterByMagicSprite: this._changeCharacterByMagicSprite,
      changeCharacterByMagicSpriteTime: this._changeCharacterByMagicSpriteTime,

      changeToOppositeMilliseconds: this._changeToOppositeMilliseconds,

      changeFlyIniByMagicSprite: this._changeFlyIniByMagicSprite,

      controledMagicSprite: this._controledMagicSprite,
    };
  }

  /**
   * 导入状态数据（用于读档）
   */
  importData(data: Partial<StatusEffectsData>): void {
    if (data.poisonSeconds !== undefined) this.poisonSeconds = data.poisonSeconds;
    if (data.petrifiedSeconds !== undefined) this.petrifiedSeconds = data.petrifiedSeconds;
    if (data.frozenSeconds !== undefined) this.frozenSeconds = data.frozenSeconds;
    if (data.isPoisonVisualEffect !== undefined) this.isPoisonVisualEffect = data.isPoisonVisualEffect;
    if (data.isPetrifiedVisualEffect !== undefined) this.isPetrifiedVisualEffect = data.isPetrifiedVisualEffect;
    if (data.isFrozenVisualEffect !== undefined) this.isFrozenVisualEffect = data.isFrozenVisualEffect;
    if (data.poisonByCharacterName !== undefined) this.poisonByCharacterName = data.poisonByCharacterName;

    if (data.invisibleByMagicTime !== undefined) this.invisibleByMagicTime = data.invisibleByMagicTime;
    if (data.isVisibleWhenAttack !== undefined) this.isVisibleWhenAttack = data.isVisibleWhenAttack;

    if (data.disableMoveMilliseconds !== undefined) this.disableMoveMilliseconds = data.disableMoveMilliseconds;
    if (data.disableSkillMilliseconds !== undefined) this.disableSkillMilliseconds = data.disableSkillMilliseconds;

    if (data.weakByMagicSprite !== undefined) this._weakByMagicSprite = data.weakByMagicSprite;
    if (data.weakByMagicSpriteTime !== undefined) this._weakByMagicSpriteTime = data.weakByMagicSpriteTime;

    if (data.speedUpByMagicSprite !== undefined) this.speedUpByMagicSprite = data.speedUpByMagicSprite;

    if (data.changeCharacterByMagicSprite !== undefined)
      this._changeCharacterByMagicSprite = data.changeCharacterByMagicSprite;
    if (data.changeCharacterByMagicSpriteTime !== undefined)
      this._changeCharacterByMagicSpriteTime = data.changeCharacterByMagicSpriteTime;

    if (data.changeToOppositeMilliseconds !== undefined)
      this._changeToOppositeMilliseconds = data.changeToOppositeMilliseconds;

    if (data.changeFlyIniByMagicSprite !== undefined)
      this._changeFlyIniByMagicSprite = data.changeFlyIniByMagicSprite;

    if (data.controledMagicSprite !== undefined) this._controledMagicSprite = data.controledMagicSprite;
  }
}
