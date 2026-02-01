/**
 * FlyIniManager - 技能配置管理器
 *
 * 从 Character 类提取的技能配置（FlyIni）相关逻辑
 * 包括：技能列表管理、临时替换、变身恢复
 *
 * C# Reference: Character.cs - FlyIni, FlyIni2, FlyInis, AddFlyIniReplace, etc.
 */

import { logger } from "../../core/logger";

/**
 * 技能配置信息
 */
export interface FlyIniInfo {
  /** 技能 INI 文件名 */
  magicIni: string;
  /** 使用距离 */
  useDistance: number;
}

/**
 * FlyIniManager - 管理角色的技能配置列表
 */
export class FlyIniManager {
  // === 技能配置源字段 ===
  /** 主技能 INI */
  flyIni: string = "";
  /** 副技能 INI */
  flyIni2: string = "";
  /** 多技能列表（格式: "Magic1:Distance1;Magic2:Distance2"） */
  flyInis: string = "";

  // === 解析后的技能列表 ===
  /** 技能信息列表（按 useDistance 排序） */
  private _flyIniInfos: FlyIniInfo[] = [];

  // === 临时替换栈 ===
  /** FlyIni 临时替换栈 */
  private _flyIniReplace: string[] = [];
  /** FlyIni2 临时替换栈 */
  private _flyIni2Replace: string[] = [];

  // === 变身备份 ===
  /** 变身前的技能列表备份 */
  private _backup: FlyIniInfo[] = [];

  /**
   * 获取当前技能列表（只读副本）
   */
  get flyIniInfos(): readonly FlyIniInfo[] {
    return this._flyIniInfos;
  }

  /**
   * 获取技能列表长度
   */
  get length(): number {
    return this._flyIniInfos.length;
  }

  /**
   * 是否有配置技能
   */
  get hasMagicConfigured(): boolean {
    return this._flyIniInfos.length > 0;
  }

  /**
   * 重建技能列表
   * C#: FlyIni setter calls AddMagicToInfos
   *
   * @param attackRadius 默认攻击距离（用于没有指定距离的技能）
   * @param characterName 角色名称（用于日志）
   */
  build(attackRadius: number, characterName: string = ""): void {
    this._flyIniInfos = [];

    // 解析 flyInis（格式: "MagicIni1:Distance1;MagicIni2:Distance2"）
    if (this.flyInis) {
      const parts = this.flyInis.split(/[;；]/);
      for (const part of parts) {
        const trimmed = part.trim();
        if (!trimmed) continue;

        const colonMatch = trimmed.match(/^(.+?)[：:](\d+)$/);
        if (colonMatch) {
          const magicIni = colonMatch[1].trim();
          const useDistance = parseInt(colonMatch[2], 10) || 0;
          this._flyIniInfos.push({ useDistance, magicIni });
        } else {
          // 没有指定距离，使用 attackRadius
          this._flyIniInfos.push({ useDistance: attackRadius, magicIni: trimmed });
        }
      }
    }

    // 添加 flyIni（使用 attackRadius）
    if (this.flyIni) {
      this._flyIniInfos.push({ useDistance: attackRadius, magicIni: this.flyIni });
    }

    // 添加 flyIni2（使用 attackRadius）
    if (this.flyIni2) {
      this._flyIniInfos.push({ useDistance: attackRadius, magicIni: this.flyIni2 });
    }

    // 按 useDistance 升序排序
    this._flyIniInfos.sort((a, b) => a.useDistance - b.useDistance);

    if (this._flyIniInfos.length > 0 && characterName) {
      logger.debug(
        `[FlyIniManager] ${characterName}: Built flyIniInfos: ${this._flyIniInfos.map((f) => `${f.magicIni}@${f.useDistance}`).join(", ")}`
      );
    }
  }

  /**
   * 获取最接近目标距离的攻击距离
   * C#: GetClosedAttackRadius(toTargetDistance)
   */
  getClosedAttackRadius(toTargetDistance: number): number {
    if (this._flyIniInfos.length === 0) {
      return 1; // 默认近战距离
    }

    let minDistance = this._flyIniInfos[0].useDistance;

    for (let i = 0; i < this._flyIniInfos.length; i++) {
      const distance = this._flyIniInfos[i].useDistance;
      if (minDistance > distance) {
        minDistance = distance;
      }
      if (this._flyIniInfos[i].useDistance > toTargetDistance) break;
      minDistance = distance;
    }

    return minDistance;
  }

  /**
   * 获取指定距离的随机技能
   * C#: GetRamdomMagicWithUseDistance(useDistance)
   */
  getRandomMagicWithUseDistance(useDistance: number): string | null {
    let start = -1;
    let end = -1;

    for (let i = 0; i < this._flyIniInfos.length; i++) {
      if (useDistance === this._flyIniInfos[i].useDistance) {
        if (start === -1) start = i;
        end = i + 1;
      } else {
        if (start !== -1) {
          break;
        }
      }
    }

    if (end === -1) end = this._flyIniInfos.length;

    if (start !== -1) {
      const randomIndex = start + Math.floor(Math.random() * (end - start));
      return this._flyIniInfos[randomIndex].magicIni;
    }

    // 没找到精确匹配，找最接近的
    for (let i = 0; i < this._flyIniInfos.length; i++) {
      if (this._flyIniInfos[i].useDistance > useDistance) {
        if (i > 0) {
          return this._flyIniInfos[i - 1].magicIni;
        }
        return this._flyIniInfos[i].magicIni;
      }
    }

    return this._flyIniInfos.length > 0 ? this._flyIniInfos[this._flyIniInfos.length - 1].magicIni : null;
  }

  // === 临时替换方法 ===

  /**
   * 添加临时替换的 FlyIni
   * C#: AddFlyIniReplace(Magic magic)
   */
  addFlyIniReplace(magicFileName: string, attackRadius: number): void {
    if (this._flyIniReplace.length === 0) {
      // 移除原始 flyIni 的效果
      this.removeMagicFromInfos(this.flyIni, attackRadius);
    }
    this.addMagicToInfos(magicFileName, attackRadius);
    this._flyIniReplace.push(magicFileName);
  }

  /**
   * 移除临时替换的 FlyIni
   * C#: RemoveFlyIniReplace(Magic magic)
   */
  removeFlyIniReplace(magicFileName: string, attackRadius: number): void {
    this.removeMagicFromInfos(magicFileName, attackRadius);
    const idx = this._flyIniReplace.indexOf(magicFileName);
    if (idx !== -1) {
      this._flyIniReplace.splice(idx, 1);
    }
    if (this._flyIniReplace.length === 0) {
      // 恢复原始 flyIni 的效果
      this.addMagicToInfos(this.flyIni, attackRadius);
    }
  }

  /**
   * 添加临时替换的 FlyIni2
   * C#: AddFlyIni2Replace(Magic magic)
   */
  addFlyIni2Replace(magicFileName: string, attackRadius: number): void {
    if (this._flyIni2Replace.length === 0) {
      this.removeMagicFromInfos(this.flyIni2, attackRadius);
    }
    this.addMagicToInfos(magicFileName, attackRadius);
    this._flyIni2Replace.push(magicFileName);
  }

  /**
   * 移除临时替换的 FlyIni2
   * C#: RemoveFlyIni2Replace(Magic magic)
   */
  removeFlyIni2Replace(magicFileName: string, attackRadius: number): void {
    this.removeMagicFromInfos(magicFileName, attackRadius);
    const idx = this._flyIni2Replace.indexOf(magicFileName);
    if (idx !== -1) {
      this._flyIni2Replace.splice(idx, 1);
    }
    if (this._flyIni2Replace.length === 0) {
      this.addMagicToInfos(this.flyIni2, attackRadius);
    }
  }

  // === 变身替换方法 ===

  /**
   * 替换技能列表（变身时）
   * C#: OnReplaceMagicList
   */
  replaceMagicList(listStr: string, attackRadius: number, characterName: string = ""): void {
    if (!listStr) return;

    // 备份当前列表
    this._backup = [...this._flyIniInfos];

    // 清空并用新列表替换
    this._flyIniInfos = [];
    if (listStr !== "无") {
      this.addMagicsFromString(listStr, attackRadius);
    }

    if (characterName) {
      logger.debug(`[FlyIniManager] ${characterName}: ReplaceMagicList - replaced with "${listStr}"`);
    }
  }

  /**
   * 恢复技能列表（变身结束）
   * C#: OnRecoverFromReplaceMagicList
   */
  recoverMagicList(characterName: string = ""): void {
    this._flyIniInfos = [...this._backup];
    this._backup = [];

    if (characterName) {
      logger.debug(`[FlyIniManager] ${characterName}: RecoverMagicList - restored flyIniInfos`);
    }
  }

  /**
   * 是否有备份（正在变身中）
   */
  get hasBackup(): boolean {
    return this._backup.length > 0;
  }

  // === 内部方法 ===

  /**
   * 添加技能到列表
   */
  private addMagicToInfos(magicIni: string, useDistance: number, sort: boolean = true): void {
    if (!magicIni) return;
    this._flyIniInfos.push({ useDistance, magicIni });
    if (sort) {
      this._flyIniInfos.sort((a, b) => a.useDistance - b.useDistance);
    }
  }

  /**
   * 从列表移除技能
   */
  private removeMagicFromInfos(magicIni: string, useDistance: number): void {
    if (!magicIni) return;
    for (let i = 0; i < this._flyIniInfos.length; i++) {
      if (this._flyIniInfos[i].magicIni === magicIni && this._flyIniInfos[i].useDistance === useDistance) {
        this._flyIniInfos.splice(i, 1);
        break;
      }
    }
  }

  /**
   * 从字符串添加多个技能
   */
  private addMagicsFromString(listStr: string, attackRadius: number): void {
    const magics = FlyIniManager.parseMagicList(listStr);
    for (const item of magics) {
      const useDistance = item.useDistance === 0 ? attackRadius : item.useDistance;
      this._flyIniInfos.push({ useDistance, magicIni: item.magicIni });
    }
    this._flyIniInfos.sort((a, b) => a.useDistance - b.useDistance);
  }

  // === 静态解析方法 ===

  /**
   * 解析技能列表字符串（带距离）
   * C#: ParseMagicList
   * @param listStr 格式: "Magic1:Distance1;Magic2:Distance2" 或 "Magic1;Magic2"
   */
  static parseMagicList(listStr: string): FlyIniInfo[] {
    const result: FlyIniInfo[] = [];
    if (!listStr) return result;

    const parts = listStr.split(/[;；]/);
    for (const part of parts) {
      const trimmed = part.trim();
      if (!trimmed) continue;

      const colonMatch = trimmed.match(/^(.+?)[：:](\d+)$/);
      if (colonMatch) {
        const magicIni = colonMatch[1].trim();
        const useDistance = parseInt(colonMatch[2], 10) || 0;
        result.push({ magicIni, useDistance });
      } else {
        // 没有距离，使用 0（后续会用 attackRadius）
        result.push({ magicIni: trimmed, useDistance: 0 });
      }
    }
    return result;
  }

  /**
   * 解析技能列表字符串（不带距离）
   * C#: ParseMagicListNoDistance
   */
  static parseMagicListNoDistance(listStr: string): string[] {
    const result: string[] = [];
    if (!listStr) return result;

    const parts = listStr.split(/[;；]/);
    for (const part of parts) {
      const trimmed = part.trim();
      if (!trimmed) continue;

      const colonMatch = trimmed.match(/^(.+?)[：:](\d+)$/);
      if (colonMatch) {
        result.push(colonMatch[1].trim());
      } else {
        result.push(trimmed);
      }
    }
    return result;
  }

  /**
   * 重置状态
   */
  reset(): void {
    this.flyIni = "";
    this.flyIni2 = "";
    this.flyInis = "";
    this._flyIniInfos = [];
    this._flyIniReplace = [];
    this._flyIni2Replace = [];
    this._backup = [];
  }
}
