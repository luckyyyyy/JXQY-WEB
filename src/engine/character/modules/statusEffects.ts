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
  /** 中毒致死时的投毒者名称（需要外部处理经验计算） */
  poisonKillerName: string | null;
  /** 变身效果是否刚结束（需要外部调用 onRecoverFromReplaceMagicList） */
  changeCharacterExpired: boolean;
  /** 变身效果结束时的武功数据 */
  changeCharacterExpiredMagic: MagicData | null;
}

/**
 * 状态效果管理器
 * 管理角色的各种状态效果（冰冻、中毒、石化、弱化、隐身等）
 *
 * 设计原则：
 * 1. 所有字段都是 public，方便外部直接读写（兼容现有代码）
 * 2. update() 方法处理时间倒计时逻辑
 * 3. 复杂的副作用（如经验计算、武功恢复）通过返回值通知调用方处理
 */
export class StatusEffectsManager {
  // ========== 基础状态效果（冰冻/中毒/石化）==========
  poisonSeconds = 0;
  petrifiedSeconds = 0;
  frozenSeconds = 0;
  isPoisonVisualEffect = false;
  isPetrifiedVisualEffect = false;
  isFrozenVisualEffect = false;
  poisonByCharacterName = "";

  // ========== 隐身效果 ==========
  invisibleByMagicTime = 0;
  isVisibleWhenAttack = false;

  // ========== 禁用效果 ==========
  disableMoveMilliseconds = 0;
  disableSkillMilliseconds = 0;

  // ========== 弱化效果 (C#: _weakByMagicSprite) ==========
  weakByMagicSprite: MagicSprite | null = null;
  weakByMagicSpriteTime = 0;

  // ========== 加速效果 (C#: SppedUpByMagicSprite) ==========
  speedUpByMagicSprite: MagicSprite | null = null;

  // ========== 变身效果 (C#: _changeCharacterByMagicSprite) ==========
  changeCharacterByMagicSprite: MagicSprite | null = null;
  changeCharacterByMagicSpriteTime = 0;

  // ========== 阵营变换效果 ==========
  changeToOppositeMilliseconds = 0;

  // ========== 飞行INI替换效果 ==========
  changeFlyIniByMagicSprite: MagicSprite | null = null;

  // ========== 控制效果 ==========
  controledMagicSprite: MagicSprite | null = null;

  // ========== 中毒伤害计时器（私有）==========
  private _poisonedMilliSeconds = 0;

  // ========== Computed Getters ==========

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

  // ========== Set Methods (不覆盖已有效果) ==========

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
    this.weakByMagicSprite = magicSprite;
    this.weakByMagicSpriteTime = magicSprite.magic.weakMilliseconds ?? 0;
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
    this.changeToOppositeMilliseconds = this.changeToOppositeMilliseconds > 0 ? 0 : milliseconds;
  }

  /**
   * 通过武功精灵变身
   * C# Reference: Character.ChangeCharacterBy
   * @param magicSprite 武功精灵
   * @returns 需要执行的 replaceMagic 字符串
   */
  changeCharacterBy(magicSprite: MagicSprite): string {
    this.changeCharacterByMagicSprite = magicSprite;
    this.changeCharacterByMagicSpriteTime = magicSprite.magic.effect ?? 0;
    return magicSprite.magic.replaceMagic ?? "";
  }

  /**
   * 变形（短暂变身）
   * C# Reference: Character.MorphBy
   * @param magicSprite 武功精灵
   * @returns 需要执行的 replaceMagic 字符串
   */
  morphBy(magicSprite: MagicSprite): string {
    this.changeCharacterByMagicSprite = magicSprite;
    this.changeCharacterByMagicSpriteTime = magicSprite.magic.morphMilliseconds ?? 0;
    return magicSprite.magic.replaceMagic ?? "";
  }

  // ========== Update Method ==========

  /**
   * 更新状态效果
   * 应在 Character.update() 开始时调用
   *
   * @param deltaTime 时间差（秒）
   * @param isDeathInvoked 角色是否已死亡（用于中毒经验计算）
   * @returns 更新结果
   */
  update(deltaTime: number, isDeathInvoked: boolean): StatusEffectsUpdateResult {
    const deltaMs = deltaTime * 1000;
    const result: StatusEffectsUpdateResult = {
      isPetrified: false,
      speedFold: 1.0,
      effectiveDeltaTime: deltaTime,
      poisonDamage: 0,
      poisonKillerName: null,
      changeCharacterExpired: false,
      changeCharacterExpiredMagic: null,
    };

    // === 弱化效果时间倒计时 ===
    if (this.weakByMagicSpriteTime > 0) {
      this.weakByMagicSpriteTime -= deltaMs;
      if (this.weakByMagicSpriteTime <= 0) {
        this.weakByMagicSprite = null;
        this.weakByMagicSpriteTime = 0;
      }
    }

    // === 阵营变换时间倒计时 ===
    if (this.changeToOppositeMilliseconds > 0) {
      this.changeToOppositeMilliseconds -= deltaMs;
      if (this.changeToOppositeMilliseconds < 0) {
        this.changeToOppositeMilliseconds = 0;
      }
    }

    // === 加速效果检查（精灵是否已销毁）===
    if (
      this.speedUpByMagicSprite !== null &&
      (this.speedUpByMagicSprite.isInDestroy || this.speedUpByMagicSprite.isDestroyed)
    ) {
      this.speedUpByMagicSprite = null;
    }

    // === 变身效果时间倒计时 ===
    if (this.changeCharacterByMagicSpriteTime > 0) {
      this.changeCharacterByMagicSpriteTime -= deltaMs;
      if (this.changeCharacterByMagicSpriteTime <= 0) {
        // 通知调用方需要恢复武功列表
        result.changeCharacterExpired = true;
        result.changeCharacterExpiredMagic = this.changeCharacterByMagicSprite?.magic ?? null;
        this.changeCharacterByMagicSpriteTime = 0;
        this.changeCharacterByMagicSprite = null;
      }
    }

    // === 飞行INI替换效果检查 ===
    if (
      this.changeFlyIniByMagicSprite !== null &&
      (this.changeFlyIniByMagicSprite.isInDestroy || this.changeFlyIniByMagicSprite.isDestroyed)
    ) {
      this.changeFlyIniByMagicSprite = null;
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

    // === 计算速度倍率 ===
    if (this.speedUpByMagicSprite !== null || this.changeCharacterByMagicSprite !== null) {
      let percent = 100;
      if (this.speedUpByMagicSprite !== null) {
        percent += this.speedUpByMagicSprite.magic.rangeSpeedUp || 0;
      }
      if (this.changeCharacterByMagicSprite !== null) {
        percent += this.changeCharacterByMagicSprite.magic.speedAddPercent || 0;
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

    // === 冰冻效果（减速）===
    result.effectiveDeltaTime = foldedDeltaTime;
    if (this.frozenSeconds > 0) {
      this.frozenSeconds -= foldedDeltaTime;
      result.effectiveDeltaTime = foldedDeltaTime / 2; // 冻结时动作减速
    }

    return result;
  }

  // ========== FlyIni Change Methods ==========

  /**
   * 替换飞行INI
   * C# Reference: Character.FlyIniChangeBy
   * @returns 需要添加的 flyIni 列表 [replaceFlyIni, replaceFlyIni2]
   */
  flyIniChangeBy(magicSprite: MagicSprite): string[] {
    // 先移除旧的
    this.removeFlyIniChangeBy();
    this.changeFlyIniByMagicSprite = magicSprite;

    const toAdd: string[] = [];
    const replaceFlyIni = magicSprite.magic.specialKind9ReplaceFlyIni;
    if (replaceFlyIni) {
      toAdd.push(replaceFlyIni);
    }
    const replaceFlyIni2 = magicSprite.magic.specialKind9ReplaceFlyIni2;
    if (replaceFlyIni2) {
      toAdd.push(replaceFlyIni2);
    }
    return toAdd;
  }

  /**
   * 移除飞行INI替换
   * @returns 需要移除的 flyIni 列表
   */
  removeFlyIniChangeBy(): string[] {
    const toRemove: string[] = [];
    if (this.changeFlyIniByMagicSprite !== null) {
      const replaceFlyIni = this.changeFlyIniByMagicSprite.magic.specialKind9ReplaceFlyIni;
      if (replaceFlyIni) {
        toRemove.push(replaceFlyIni);
      }
      const replaceFlyIni2 = this.changeFlyIniByMagicSprite.magic.specialKind9ReplaceFlyIni2;
      if (replaceFlyIni2) {
        toRemove.push(replaceFlyIni2);
      }
      this.changeFlyIniByMagicSprite = null;
    }
    return toRemove;
  }
}
