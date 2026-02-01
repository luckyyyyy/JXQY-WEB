/**
 * MagicListManager - based on JxqyHD Engine/ListManager/MagicListManager.cs
 * 管理玩家的武功列表和武功经验配置
 */

import { logger } from "@/engine/core/logger";
import { parseIni } from "@/engine/utils";
import { getMagicAtLevel, loadMagic } from "@/engine/magic/magicLoader";
import { magicRenderer } from "@/engine/magic/magicRenderer";
import type { MagicData, MagicItemInfo } from "@/engine/magic/types";
import { createDefaultMagicItemInfo } from "@/engine/magic/types";
import { resourceLoader } from "@/engine/resource/resourceLoader";
import { DefaultPaths, ResourcePath } from "@/config/resourcePaths";

/**
 * 武功经验配置
 * 对应 C# Utils.cs 中的 MagicExp 相关
 */
export interface MagicExpConfig {
  /** 根据命中角色等级获取经验值 */
  expByLevel: Map<number, number>;
  /** 修炼武功经验倍率 */
  xiuLianMagicExpFraction: number;
  /** 使用武功经验倍率 */
  useMagicExpFraction: number;
}

// 武功列表索引常量 - 对应 C# MagicListManager
export const MAGIC_LIST_CONFIG = {
  maxMagic: 49, // 最大武功数量
  magicListIndexBegin: 1, // 列表起始索引
  storeIndexBegin: 1, // 存储区起始 (武功面板)
  storeIndexEnd: 36, // 存储区结束
  bottomIndexBegin: 40, // 快捷栏起始
  bottomIndexEnd: 44, // 快捷栏结束 (5个槽位)
  xiuLianIndex: 49, // 修炼武功索引
  hideStartIndex: 1000, // 隐藏列表起始索引
};

// 回调类型
export interface MagicListCallbacks {
  onUpdateView?: () => void;
  onMagicUse?: (info: MagicItemInfo) => void;
  /**
   * 武功升级回调 - 用于 Player 更新属性
   * C# Reference: Player.AddMagicExp - 武功升级时增加玩家属性
   * @param oldMagic 旧等级武功（用于移除 FlyIni 等）
   * @param newMagic 新等级武功
   */
  onMagicLevelUp?: (oldMagic: MagicData, newMagic: MagicData) => void;
  /**
   * 修炼武功改变回调 - 用于 Player 更新 SpecialAttackTexture
   * C# Reference: Player.XiuLianMagic setter
   */
  onXiuLianMagicChange?: (xiuLianMagic: MagicItemInfo | null) => void;
}

/**
 * 武功列表管理器
 */
export class MagicListManager {
  // 主武功列表
  private magicList: (MagicItemInfo | null)[];
  // 隐藏武功列表
  private magicListHide: (MagicItemInfo | null)[];
  // 当前使用的武功
  private currentMagicInUse: MagicItemInfo | null = null;
  // 修炼武功
  private xiuLianMagic: MagicItemInfo | null = null;
  // 回调
  private callbacks: MagicListCallbacks = {};
  // 版本号（用于触发UI更新）
  private version: number = 0;
  // 武功经验配置
  private magicExpConfig: MagicExpConfig = {
    expByLevel: new Map(),
    xiuLianMagicExpFraction: 1.0,
    useMagicExpFraction: 1.0,
  };
  private magicExpInitialized: boolean = false;

  // === ReplaceMagicList (C#: _isInReplaceMagicList, _currentReplaceMagicListFilePath, ReplaceMagicList) ===
  // 用于变身/变形效果时临时替换武功列表
  private _isInReplaceMagicList: boolean = false;
  private _currentReplaceMagicListFilePath: string = "";
  private _replaceMagicList: Map<string, (MagicItemInfo | null)[]> = new Map();
  private _replaceMagicListHide: Map<string, (MagicItemInfo | null)[]> = new Map();

  constructor() {
    const size = MAGIC_LIST_CONFIG.maxMagic + 1;
    this.magicList = new Array(size).fill(null);
    this.magicListHide = new Array(size).fill(null);
  }

  // ============= 武功经验配置 =============

  /**
   * 初始化武功经验配置
   * 对应 C# Utils.LoadMagicExpList()
   */
  async initializeMagicExp(): Promise<void> {
    if (this.magicExpInitialized) return;

    const path = DefaultPaths.magicExp;
    try {
      const content = await resourceLoader.loadText(path);
      if (!content) {
        logger.warn(`[MagicListManager] MagicExp.ini not found`);
        return;
      }

      this.parseMagicExpIni(content);
      this.magicExpInitialized = true;
      logger.log(
        `[MagicListManager] MagicExp loaded: ${this.magicExpConfig.expByLevel.size} levels`
      );
    } catch (error) {
      logger.error(`[MagicListManager] Error loading MagicExp.ini:`, error);
    }
  }

  /**
   * 解析武功经验配置文件
   */
  private parseMagicExpIni(content: string): void {
    const sections = parseIni(content);

    // Parse [Exp] section
    if (sections.Exp) {
      for (const [key, value] of Object.entries(sections.Exp)) {
        const level = parseInt(key, 10);
        const exp = parseInt(value, 10);
        if (!Number.isNaN(level) && !Number.isNaN(exp)) {
          this.magicExpConfig.expByLevel.set(level, exp);
        }
      }
    }

    // Parse [XiuLianMagicExp] section
    if (sections.XiuLianMagicExp?.Fraction) {
      this.magicExpConfig.xiuLianMagicExpFraction =
        parseFloat(sections.XiuLianMagicExp.Fraction) || 1.0;
    }

    // Parse [UseMagicExp] section
    if (sections.UseMagicExp?.Fraction) {
      this.magicExpConfig.useMagicExpFraction = parseFloat(sections.UseMagicExp.Fraction) || 1.0;
    }
  }

  /**
   * 获取修炼武功经验倍率
   */
  getXiuLianMagicExpFraction(): number {
    return this.magicExpConfig.xiuLianMagicExpFraction;
  }

  /**
   * 获取使用武功经验倍率
   */
  getUseMagicExpFraction(): number {
    return this.magicExpConfig.useMagicExpFraction;
  }

  /**
   * 获取武功命中经验
   * C# Reference: Utils.GetMagicExp(hitedCharacterLevel)
   */
  getMagicExp(hitedCharacterLevel: number): number {
    const exp = this.magicExpConfig.expByLevel.get(hitedCharacterLevel);
    if (exp !== undefined) {
      return exp;
    }
    // 如果没有对应等级，返回最大等级的经验
    let maxLevel = 0;
    let maxExp = 0;
    for (const [level, e] of this.magicExpConfig.expByLevel) {
      if (level > maxLevel) {
        maxLevel = level;
        maxExp = e;
      }
    }
    return maxExp;
  }

  /**
   * 设置回调
   */
  setCallbacks(callbacks: MagicListCallbacks): void {
    this.callbacks = callbacks;
  }

  /**
   * 获取版本号
   */
  getVersion(): number {
    return this.version;
  }

  /**
   * 更新视图
   */
  private updateView(): void {
    this.version++;
    this.callbacks.onUpdateView?.();
  }

  /**
   * 检查索引是否在有效范围内
   */
  indexInRange(index: number): boolean {
    return index >= MAGIC_LIST_CONFIG.magicListIndexBegin && index <= MAGIC_LIST_CONFIG.maxMagic;
  }

  /**
   * 检查索引是否在快捷栏范围内
   */
  indexInBottomRange(index: number): boolean {
    return index >= MAGIC_LIST_CONFIG.bottomIndexBegin && index <= MAGIC_LIST_CONFIG.bottomIndexEnd;
  }

  /**
   * 检查索引是否是修炼索引
   */
  indexInXiuLianIndex(index: number): boolean {
    return index === MAGIC_LIST_CONFIG.xiuLianIndex;
  }

  // ========== 核心：统一的武功添加方法 ==========

  /**
   * 将武功设置到指定位置（所有添加武功的入口最终调用此方法）
   * 负责：设置 itemInfo、预加载 ASF、更新修炼位置
   */
  private async _setMagicItemAt(
    index: number,
    itemInfo: MagicItemInfo,
    isHidden: boolean = false
  ): Promise<void> {
    const targetList = isHidden ? this.magicListHide : this.magicList;
    targetList[index] = itemInfo;

    // 预加载 ASF 资源（等待完成）
    if (itemInfo.magic) {
      await this._preloadMagicAsf(itemInfo.magic);
    }

    // 更新修炼位置
    if (!isHidden && this.indexInXiuLianIndex(index)) {
      this.xiuLianMagic = itemInfo;
    }
  }

  /**
   * 预加载武功的 ASF 资源（异步，等待完成）
   */
  private async _preloadMagicAsf(magic: MagicData): Promise<void> {
    const promises: Promise<unknown>[] = [];
    if (magic.flyingImage) {
      promises.push(magicRenderer.getAsf(magic.flyingImage));
    }
    if (magic.vanishImage) {
      promises.push(magicRenderer.getAsf(magic.vanishImage));
    }
    // SuperMode 使用 superModeImage 作为主动画
    if (magic.superModeImage) {
      promises.push(magicRenderer.getAsf(magic.superModeImage));
    }
    if (promises.length > 0) {
      await Promise.all(promises);
      logger.debug(`[MagicListManager] Preloaded ASF for ${magic.name}`);
    }
  }

  /**
   * 清空列表
   * 注意：清空当前活动列表（原始或替换列表）
   */
  renewList(): void {
    const activeList = this.getActiveMagicList();
    const activeListHide = this.getActiveMagicListHide();
    for (let i = 0; i <= MAGIC_LIST_CONFIG.maxMagic; i++) {
      activeList[i] = null;
      activeListHide[i] = null;
    }
    this.currentMagicInUse = null;
    this.xiuLianMagic = null;
    this.updateView();
  }

  /**
   * 从配置文件加载玩家武功列表
   * 对应 C# MagicListManager.LoadPlayerList
   * Uses unified resourceLoader for text data fetching
   * @param filePath 配置文件路径，如 /resources/save/game/Magic0.ini
   */
  async loadPlayerList(filePath: string): Promise<boolean> {
    // 确保 MagicExp 配置已加载
    await this.initializeMagicExp();

    try {
      logger.log(`[MagicListManager] Loading player magic list from ${filePath}...`);

      const content = await resourceLoader.loadText(filePath);
      if (!content) {
        logger.warn(`[MagicListManager] Failed to load ${filePath}`);
        return false;
      }

      const data = parseIni(content);

      // 清空列表
      this.renewList();

      // 遍历所有 section（数字索引）
      for (const sectionName in data) {
        if (sectionName === "Head") continue;

        const index = parseInt(sectionName, 10);
        if (Number.isNaN(index)) continue;

        const section = data[sectionName];
        const iniFile = section.IniFile;
        const level = parseInt(section.Level || "1", 10);
        const exp = parseInt(section.Exp || "0", 10);
        const hideCount = parseInt(section.HideCount || "0", 10);
        const lastIndexWhenHide = parseInt(section.LastIndexWhenHide || "0", 10);

        if (!iniFile) continue;

        // 根据索引判断放入主列表还是隐藏列表
        const isHidden = index >= MAGIC_LIST_CONFIG.hideStartIndex;
        const targetIndex = isHidden ? index - MAGIC_LIST_CONFIG.hideStartIndex : index;

        if (targetIndex < 0 || targetIndex > MAGIC_LIST_CONFIG.maxMagic) continue;

        // 加载武功
        const magic = await loadMagic(ResourcePath.magic(iniFile));
        if (magic) {
          const levelMagic = getMagicAtLevel(magic, level);
          const itemInfo = createDefaultMagicItemInfo(levelMagic, level);
          itemInfo.exp = exp;
          itemInfo.hideCount = hideCount;
          itemInfo.lastIndexWhenHide = lastIndexWhenHide;

          // 使用统一入口添加
          await this._setMagicItemAt(targetIndex, itemInfo, isHidden);

          logger.log(
            `[MagicListManager] Loaded magic "${magic.name}" Lv.${level} at index ${targetIndex}${isHidden ? " (hidden)" : ""}`
          );
        }
      }

      this.updateView();
      logger.log("[MagicListManager] Player magic list loaded successfully");
      return true;
    } catch (error) {
      logger.error("[MagicListManager] Failed to load player magic list:", error);
      return false;
    }
  }

  /**
   * 获取武功
   */
  get(index: number): MagicData | null {
    const itemInfo = this.getItemInfo(index);
    return itemInfo?.magic || null;
  }

  /**
   * 获取武功项信息
   * 注意：会考虑替换状态，返回当前活动列表中的武功
   */
  getItemInfo(index: number): MagicItemInfo | null {
    if (!this.indexInRange(index)) return null;
    return this.getActiveMagicList()[index];
  }

  /**
   * 获取武功项的索引
   */
  getItemIndex(info: MagicItemInfo | null): number {
    if (!info) return 0;
    const activeList = this.getActiveMagicList();
    for (let i = MAGIC_LIST_CONFIG.magicListIndexBegin; i <= MAGIC_LIST_CONFIG.maxMagic; i++) {
      if (info === activeList[i]) {
        return i;
      }
    }
    return 0;
  }

  /**
   * 获取武功图标路径
   */
  getIconPath(index: number): string | null {
    const magic = this.get(index);
    if (!magic) return null;
    // 快捷栏使用小图标，武功面板使用大图
    if (this.indexInBottomRange(index)) {
      return magic.icon || magic.image || null;
    }
    return magic.image || magic.icon || null;
  }

  /**
   * 获取空闲索引
   */
  getFreeIndex(): number {
    const activeList = this.getActiveMagicList();
    // 先检查存储区
    for (let i = MAGIC_LIST_CONFIG.storeIndexBegin; i <= MAGIC_LIST_CONFIG.storeIndexEnd; i++) {
      if (!activeList[i]) {
        return i;
      }
    }
    // 再检查快捷栏
    for (let i = MAGIC_LIST_CONFIG.bottomIndexBegin; i <= MAGIC_LIST_CONFIG.bottomIndexEnd; i++) {
      if (!activeList[i]) {
        return i;
      }
    }
    return -1;
  }

  /**
   * 根据文件名获取武功索引
   */
  getIndexByFileName(fileName: string): number {
    const lowerName = fileName.toLowerCase();
    const activeList = this.getActiveMagicList();
    for (let i = 1; i <= MAGIC_LIST_CONFIG.maxMagic; i++) {
      const info = activeList[i];
      if (info?.magic && info.magic.fileName.toLowerCase() === lowerName) {
        return i;
      }
    }
    return -1;
  }

  /**
   * 根据文件名获取武功信息
   */
  getMagicByFileName(fileName: string): MagicItemInfo | null {
    const index = this.getIndexByFileName(fileName);
    if (index !== -1) {
      return this.getActiveMagicList()[index];
    }
    return null;
  }

  /**
   * 添加武功到列表
   * @returns [是否新增, 索引, 武功数据]
   */
  async addMagicToList(fileName: string): Promise<[boolean, number, MagicData | null]> {
    // 检查是否已存在
    const existingIndex = this.getIndexByFileName(fileName);
    if (existingIndex !== -1) {
      return [false, existingIndex, this.getActiveMagicList()[existingIndex]?.magic || null];
    }

    // 找空闲位置
    const index = this.getFreeIndex();
    if (index === -1) {
      logger.warn("[MagicListManager] No free slot for magic");
      return [false, -1, null];
    }

    // 加载武功
    const magic = await loadMagic(fileName);
    if (!magic) {
      logger.warn(`[MagicListManager] Failed to load magic: ${fileName}`);
      return [false, -1, null];
    }

    // 获取等级1的武功数据
    const levelMagic = getMagicAtLevel(magic, 1);
    const itemInfo = createDefaultMagicItemInfo(levelMagic, 1);

    // 使用统一入口添加
    await this._setMagicItemAt(index, itemInfo);

    logger.debug(
      `[MagicListManager] Added magic "${magic.name}" at index ${index}, moveKind=${levelMagic.moveKind}, speed=${levelMagic.speed}`
    );
    this.updateView();

    return [true, index, levelMagic];
  }

  /**
   * 添加武功到指定索引位置
   * 用于从存档加载时恢复武功到正确位置
   * @returns [是否成功, 索引, 武功数据]
   */
  async addMagicToListAtIndex(
    fileName: string,
    targetIndex: number,
    level: number = 1,
    exp: number = 0
  ): Promise<[boolean, number, MagicData | null]> {
    if (!this.indexInRange(targetIndex)) {
      logger.warn(`[MagicListManager] Invalid index: ${targetIndex}`);
      return [false, -1, null];
    }

    // 加载武功
    const magic = await loadMagic(fileName);
    if (!magic) {
      logger.warn(`[MagicListManager] Failed to load magic: ${fileName}`);
      return [false, -1, null];
    }

    // 获取指定等级的武功数据
    const levelMagic = getMagicAtLevel(magic, level);
    const itemInfo = createDefaultMagicItemInfo(levelMagic, level);
    itemInfo.exp = exp;

    // 使用统一入口添加
    await this._setMagicItemAt(targetIndex, itemInfo);

    logger.debug(
      `[MagicListManager] Added magic "${magic.name}" Lv.${level} at index ${targetIndex}`
    );
    this.updateView();

    return [true, targetIndex, levelMagic];
  }

  /**
   * 直接设置武功到指定位置（异步版本）
   */
  async setMagicAt(index: number, magic: MagicData, level: number = 1): Promise<void> {
    if (!this.indexInRange(index)) return;

    // 获取指定等级的武功数据
    const levelMagic = getMagicAtLevel(magic, level);
    const itemInfo = createDefaultMagicItemInfo(levelMagic, level);

    // 使用统一入口添加
    await this._setMagicItemAt(index, itemInfo);

    this.updateView();
  }

  /**
   * 删除武功
   */
  deleteMagic(fileName: string): boolean {
    const index = this.getIndexByFileName(fileName);
    if (index === -1) return false;

    const activeList = this.getActiveMagicList();
    const info = activeList[index];
    if (info === this.currentMagicInUse) {
      this.currentMagicInUse = null;
    }
    if (info === this.xiuLianMagic) {
      this.xiuLianMagic = null;
    }

    activeList[index] = null;
    this.updateView();
    return true;
  }

  /**
   * 交换列表项
   * 对应 C# ExchangeListItem
   */
  exchangeListItem(index1: number, index2: number): void {
    if (index1 === index2) return;
    if (!this.indexInRange(index1) || !this.indexInRange(index2)) return;

    const activeList = this.getActiveMagicList();
    const temp = activeList[index1];
    activeList[index1] = activeList[index2];
    activeList[index2] = temp;

    // 检查当前使用的武功
    const inBottom1 = this.indexInBottomRange(index1);
    const inBottom2 = this.indexInBottomRange(index2);
    if (inBottom1 !== inBottom2) {
      if (
        this.currentMagicInUse === activeList[index1] ||
        this.currentMagicInUse === activeList[index2]
      ) {
        // 快捷栏武功被交换出去，清除当前使用
        this.currentMagicInUse = null;
      }
    }

    // 检查修炼武功
    if (this.indexInXiuLianIndex(index1)) {
      this.xiuLianMagic = activeList[index1];
    }
    if (this.indexInXiuLianIndex(index2)) {
      this.xiuLianMagic = activeList[index2];
    }

    this.updateView();
  }

  /**
   * 设置武功等级
   */
  setMagicLevel(fileName: string, level: number): void {
    const index = this.getIndexByFileName(fileName);
    if (index === -1) return;

    const info = this.getActiveMagicList()[index];
    if (!info || !info.magic) return;

    // 获取指定等级的武功
    const baseMagic = info.magic;
    const levelMagic = getMagicAtLevel(baseMagic, level);

    info.magic = levelMagic;
    info.level = level;
    // 经验设置为上一级的升级经验
    if (level > 1 && baseMagic.levels?.has(level - 1)) {
      info.exp = baseMagic.levels.get(level - 1)?.levelupExp || 0;
    } else {
      info.exp = 0;
    }

    this.updateView();
  }

  /**
   * 增加武功经验
   * C# Reference: Player.AddMagicExp
   */
  addMagicExp(fileName: string, expToAdd: number): boolean {
    const index = this.getIndexByFileName(fileName);
    if (index === -1) return false;

    const info = this.getActiveMagicList()[index];
    if (!info || !info.magic) return false;

    // C#: if (info.TheMagic.LevelupExp == 0) 已满级
    if (info.magic.levelupExp === 0) return false;

    info.exp += expToAdd;

    // 检查升级
    const levelupExp = info.magic.levelupExp;
    if (levelupExp > 0 && info.exp >= levelupExp) {
      const oldMagic = info.magic;
      info.level++;

      // 获取新等级的武功数据
      const newMagic = getMagicAtLevel(info.magic, info.level);
      info.magic = newMagic;

      // C# Reference: 触发回调让 Player 处理属性加成
      // LifeMax += info.TheMagic.LifeMax; ThewMax += ...; etc.
      if (this.callbacks.onMagicLevelUp) {
        this.callbacks.onMagicLevelUp(oldMagic, newMagic);
      }

      // C#: if (info.TheMagic.LevelupExp == 0) info.Exp = levelupExp (满级时经验设为升级经验)
      if (newMagic.levelupExp === 0) {
        info.exp = levelupExp;
      } else {
        // 溢出经验不保留，重置为0
        info.exp = 0;
      }

      logger.log(`[MagicListManager] Magic "${info.magic.name}" leveled up to ${info.level}`);
      this.updateView();
      return true;
    }

    return false;
  }

  /**
   * 获取当前使用的武功
   */
  getCurrentMagicInUse(): MagicItemInfo | null {
    return this.currentMagicInUse;
  }

  /**
   * 设置当前使用的武功
   */
  setCurrentMagicInUse(info: MagicItemInfo | null): boolean {
    if (info?.magic) {
      if (info.magic.disableUse !== 0) {
        logger.log("[MagicListManager] This magic cannot be used");
        return false;
      }
      this.currentMagicInUse = info;
      return true;
    }
    this.currentMagicInUse = null;
    return true;
  }

  /**
   * 通过快捷栏索引设置当前武功
   * @param bottomIndex 快捷栏相对索引 (0-4)
   */
  setCurrentMagicByBottomIndex(bottomIndex: number): boolean {
    const listIndex = MAGIC_LIST_CONFIG.bottomIndexBegin + bottomIndex;
    if (!this.indexInBottomRange(listIndex)) return false;

    const info = this.getActiveMagicList()[listIndex];
    if (!info || !info.magic) return false;

    return this.setCurrentMagicInUse(info);
  }

  /**
   * 获取修炼武功
   */
  getXiuLianMagic(): MagicItemInfo | null {
    return this.xiuLianMagic;
  }

  /**
   * 设置修炼武功
   * C# Reference: Player.XiuLianMagic setter - 同时更新 SpecialAttackTexture
   */
  setXiuLianMagic(info: MagicItemInfo | null): void {
    this.xiuLianMagic = info;
    // 触发回调以更新 SpecialAttackTexture
    this.callbacks.onXiuLianMagicChange?.(info);
  }

  /**
   * 获取修炼武功索引
   */
  getXiuLianIndex(): number {
    if (!this.xiuLianMagic) return 0;
    return this.getItemIndex(this.xiuLianMagic);
  }

  /**
   * 设置修炼武功（通过索引）
   */
  setXiuLianIndex(index: number): void {
    if (index === 0 || !this.indexInRange(index)) {
      this.setXiuLianMagic(null);
    } else {
      this.setXiuLianMagic(this.getActiveMagicList()[index]);
    }
  }

  /**
   * 通过文件名添加武功到列表（别名）
   */
  async addMagicByFileName(fileName: string): Promise<[boolean, number, MagicData | null]> {
    return this.addMagicToList(fileName);
  }

  /**
   * 更新冷却时间
   */
  updateCooldowns(deltaMs: number): void {
    const activeList = this.getActiveMagicList();
    for (let i = 1; i <= MAGIC_LIST_CONFIG.maxMagic; i++) {
      const info = activeList[i];
      if (info && info.remainColdMilliseconds > 0) {
        info.remainColdMilliseconds = Math.max(0, info.remainColdMilliseconds - deltaMs);
      }
    }
  }

  /**
   * 检查武功是否可以使用（冷却）
   */
  canUseMagic(info: MagicItemInfo): boolean {
    if (!info || !info.magic) return false;
    if (info.magic.disableUse !== 0) return false;
    return info.remainColdMilliseconds <= 0;
  }

  /**
   * 使用武功后设置冷却
   */
  onMagicUsed(info: MagicItemInfo): void {
    if (info?.magic) {
      info.remainColdMilliseconds = info.magic.coldMilliSeconds;
      this.callbacks.onMagicUse?.(info);
    }
  }

  /**
   * 获取所有武功列表（用于UI显示）
   */
  getAllMagics(): (MagicItemInfo | null)[] {
    return [...this.getActiveMagicList()];
  }

  /**
   * 获取存储区武功（武功面板显示）
   */
  getStoreMagics(): (MagicItemInfo | null)[] {
    const result: (MagicItemInfo | null)[] = [];
    const activeList = this.getActiveMagicList();
    for (let i = MAGIC_LIST_CONFIG.storeIndexBegin; i <= MAGIC_LIST_CONFIG.storeIndexEnd; i++) {
      result.push(activeList[i]);
    }
    return result;
  }

  /**
   * 获取快捷栏武功
   */
  getBottomMagics(): (MagicItemInfo | null)[] {
    const result: (MagicItemInfo | null)[] = [];
    const activeList = this.getActiveMagicList();
    for (let i = MAGIC_LIST_CONFIG.bottomIndexBegin; i <= MAGIC_LIST_CONFIG.bottomIndexEnd; i++) {
      result.push(activeList[i]);
    }
    return result;
  }

  /**
   * 获取快捷栏某位置的武功信息
   */
  getBottomMagicInfo(bottomIndex: number): MagicItemInfo | null {
    const listIndex = MAGIC_LIST_CONFIG.bottomIndexBegin + bottomIndex;
    return this.getItemInfo(listIndex);
  }

  /**
   * 将快捷栏索引转换为列表索引
   */
  bottomIndexToListIndex(bottomIndex: number): number {
    return MAGIC_LIST_CONFIG.bottomIndexBegin + bottomIndex;
  }

  /**
   * 直接添加武功对象到列表（异步版本）
   * @returns 是否添加成功
   */
  async addMagic(magic: MagicData, level: number = 1): Promise<boolean> {
    // 检查是否已存在
    const existingIndex = this.getIndexByFileName(magic.fileName);
    if (existingIndex !== -1) {
      logger.log(
        `[MagicListManager] Magic "${magic.name}" already exists at index ${existingIndex}`
      );
      return false;
    }

    // 找空闲位置
    const index = this.getFreeIndex();
    if (index === -1) {
      logger.warn("[MagicListManager] No free slot for magic");
      return false;
    }

    // 获取指定等级的武功数据
    const levelMagic = getMagicAtLevel(magic, level);
    const itemInfo = createDefaultMagicItemInfo(levelMagic, level);

    // 使用统一入口添加
    await this._setMagicItemAt(index, itemInfo);

    logger.debug(`[MagicListManager] Added magic "${magic.name}" Lv.${level} at index ${index}`);
    this.updateView();

    return true;
  }

  /**
   * 设置武功冷却时间
   */
  setMagicCooldown(listIndex: number, cooldownMs: number): void {
    const info = this.getItemInfo(listIndex);
    if (info) {
      info.remainColdMilliseconds = cooldownMs;
    }
  }

  /**
   * 将武功移动到快捷栏的空位
   */
  moveToBottomEmptySlot(sourceIndex: number): boolean {
    if (!this.indexInRange(sourceIndex)) return false;
    const activeList = this.getActiveMagicList();
    const info = activeList[sourceIndex];
    if (!info) return false;

    // 找快捷栏空位
    for (let i = MAGIC_LIST_CONFIG.bottomIndexBegin; i <= MAGIC_LIST_CONFIG.bottomIndexEnd; i++) {
      if (!activeList[i]) {
        this.exchangeListItem(sourceIndex, i);
        return true;
      }
    }
    return false;
  }

  /**
   * 序列化（用于存档）
   * 注意：序列化时使用原始列表，而不是替换列表
   */
  serialize(): object {
    const data: any[] = [];
    for (let i = 1; i <= MAGIC_LIST_CONFIG.maxMagic; i++) {
      const info = this.magicList[i]; // 使用原始列表进行存档
      if (info?.magic) {
        data.push({
          index: i,
          fileName: info.magic.fileName,
          level: info.level,
          exp: info.exp,
          hideCount: info.hideCount,
        });
      }
    }
    return { magics: data };
  }

  /**
   * 反序列化（从存档加载）
   */
  async deserialize(data: any): Promise<void> {
    this.renewList();

    if (!data?.magics) return;

    for (const item of data.magics) {
      const magic = await loadMagic(item.fileName);
      if (magic) {
        const levelMagic = getMagicAtLevel(magic, item.level || 1);
        const info = createDefaultMagicItemInfo(levelMagic, item.level || 1);
        info.exp = item.exp || 0;
        info.hideCount = item.hideCount || 1;

        if (item.index >= 1 && item.index <= MAGIC_LIST_CONFIG.maxMagic) {
          this.magicList[item.index] = info;

          if (this.indexInXiuLianIndex(item.index)) {
            this.xiuLianMagic = info;
          }
        }
      }
    }

    this.updateView();
  }

  // ============= 脚本命令支持 =============

  /**
   * 设置武功等级（脚本命令 SetMagicLevel）
   * C#: MagicListManager.SetNonReplaceMagicLevel(fileName, level)
   *
   * 注意：这只影响主武功列表中的武功，不包括隐藏列表
   */
  setNonReplaceMagicLevel(fileName: string, level: number): void {
    const info = this.getMagicByFileName(fileName);
    if (!info || !info.magic) {
      logger.warn(`[MagicListManager] setNonReplaceMagicLevel: magic not found: ${fileName}`);
      return;
    }

    // 获取指定等级的武功数据
    const levelMagic = getMagicAtLevel(info.magic, level);
    if (!levelMagic) {
      logger.warn(
        `[MagicListManager] setNonReplaceMagicLevel: level ${level} not available for ${fileName}`
      );
      return;
    }

    // 更新武功数据和等级
    info.magic = levelMagic;
    info.level = level;
    // 设置经验为该等级的升级所需经验（表示已达到该等级）
    info.exp = level > 1 && levelMagic.levelupExp ? levelMagic.levelupExp : 0;

    logger.log(`[MagicListManager] setNonReplaceMagicLevel: ${fileName} -> level ${level}`);
    this.updateView();
  }

  // ============= 武功效果应用 =============

  /**
   * 获取所有武功信息（包括主列表和隐藏列表）
   * 用于 setMagicEffect 应用 FlyIni 等效果
   * C# Reference: MagicListManager.SetMagicEffect
   */
  getAllMagicInfos(): MagicItemInfo[] {
    const result: MagicItemInfo[] = [];

    for (const info of this.magicList) {
      if (info?.magic) {
        result.push(info);
      }
    }

    for (const info of this.magicListHide) {
      if (info?.magic) {
        result.push(info);
      }
    }

    return result;
  }

  // ============= 替换武功列表功能 (ReplaceMagicList) =============
  // C# Reference: MagicListManager.ReplaceListTo, StopReplace

  /**
   * 获取当前活动的武功列表（考虑是否在替换状态）
   * C# Reference: MagicListManager.MagicList getter
   */
  private getActiveMagicList(): (MagicItemInfo | null)[] {
    if (this._isInReplaceMagicList && this._currentReplaceMagicListFilePath) {
      return this._replaceMagicList.get(this._currentReplaceMagicListFilePath) || this.magicList;
    }
    return this.magicList;
  }

  /**
   * 获取当前活动的隐藏武功列表（考虑是否在替换状态）
   * C# Reference: MagicListManager.MagicListHide getter
   */
  private getActiveMagicListHide(): (MagicItemInfo | null)[] {
    if (this._isInReplaceMagicList && this._currentReplaceMagicListFilePath) {
      return this._replaceMagicListHide.get(this._currentReplaceMagicListFilePath) || this.magicListHide;
    }
    return this.magicListHide;
  }

  /**
   * 检查是否在替换武功列表状态
   */
  isInReplaceMagicList(): boolean {
    return this._isInReplaceMagicList;
  }

  /**
   * 替换武功列表
   * C# Reference: MagicListManager.ReplaceListTo
   * @param filePath 用于存储的文件路径（作为唯一标识）
   * @param magicFileNames 武功文件名列表
   */
  async replaceListTo(filePath: string, magicFileNames: string[]): Promise<void> {
    this._isInReplaceMagicList = true;
    this._currentReplaceMagicListFilePath = filePath;

    if (this._replaceMagicList.has(filePath)) {
      // 已经存在，不做操作
      logger.debug(`[MagicListManager] ReplaceListTo: using existing list for ${filePath}`);
    } else {
      // 创建新的替换列表
      const size = MAGIC_LIST_CONFIG.maxMagic + 1;
      const newList: (MagicItemInfo | null)[] = new Array(size).fill(null);
      const newHideList: (MagicItemInfo | null)[] = new Array(size).fill(null);

      // C#: 先填充 BottomIndex，再填充 StoreIndex
      let listI = 0;

      // 填充快捷栏 (BottomIndex)
      for (let i = MAGIC_LIST_CONFIG.bottomIndexBegin; i <= MAGIC_LIST_CONFIG.bottomIndexEnd; i++) {
        if (listI < magicFileNames.length) {
          const magic = await loadMagic(ResourcePath.magic(magicFileNames[listI]));
          if (magic) {
            newList[i] = createDefaultMagicItemInfo(magic, 1);
            newList[i]!.hideCount = 1;
          }
        } else {
          break;
        }
        listI++;
      }

      // 填充存储区 (StoreIndex)
      for (let i = MAGIC_LIST_CONFIG.storeIndexBegin; i <= MAGIC_LIST_CONFIG.storeIndexEnd; i++) {
        if (listI < magicFileNames.length) {
          const magic = await loadMagic(ResourcePath.magic(magicFileNames[listI]));
          if (magic) {
            newList[i] = createDefaultMagicItemInfo(magic, 1);
            newList[i]!.hideCount = 1;
          }
        } else {
          break;
        }
        listI++;
      }

      this._replaceMagicList.set(filePath, newList);
      this._replaceMagicListHide.set(filePath, newHideList);

      logger.log(`[MagicListManager] ReplaceListTo: created new list for ${filePath} with ${magicFileNames.length} magics`);
    }

    this.updateView();
  }

  /**
   * 停止替换武功列表，恢复原始列表
   * C# Reference: MagicListManager.StopReplace
   */
  stopReplace(): void {
    this._isInReplaceMagicList = false;
    logger.log(`[MagicListManager] StopReplace: restored to original list`);
    this.updateView();
  }

  /**
   * 清除所有替换列表
   * C# Reference: MagicListManager.ClearReplaceList
   * 通常在加载新存档或重置游戏时调用
   */
  clearReplaceList(): void {
    this._replaceMagicList.clear();
    this._replaceMagicListHide.clear();
    this._isInReplaceMagicList = false;
    this._currentReplaceMagicListFilePath = "";
    logger.debug(`[MagicListManager] ClearReplaceList: all replacement lists cleared`);
  }

  /**
   * 序列化替换列表（用于存档）
   * C# Reference: MagicListManager.SaveReplaceList
   * @returns 替换列表的序列化数据
   */
  serializeReplaceLists(): object {
    const replaceLists: Record<string, object[]> = {};

    for (const [filePath, list] of this._replaceMagicList.entries()) {
      const hideList = this._replaceMagicListHide.get(filePath) || [];
      const data: object[] = [];

      // 序列化主列表
      for (let i = 1; i <= MAGIC_LIST_CONFIG.maxMagic; i++) {
        const info = list[i];
        if (info?.magic) {
          data.push({
            index: i,
            fileName: info.magic.fileName,
            level: info.level,
            exp: info.exp,
            hideCount: info.hideCount,
            lastIndexWhenHide: info.lastIndexWhenHide,
          });
        }

        // 序列化隐藏列表
        const hideInfo = hideList[i];
        if (hideInfo?.magic) {
          data.push({
            index: i + MAGIC_LIST_CONFIG.hideStartIndex,
            fileName: hideInfo.magic.fileName,
            level: hideInfo.level,
            exp: hideInfo.exp,
            hideCount: hideInfo.hideCount,
            lastIndexWhenHide: hideInfo.lastIndexWhenHide,
          });
        }
      }

      if (data.length > 0) {
        replaceLists[filePath] = data;
      }
    }

    return {
      isInReplaceMagicList: this._isInReplaceMagicList,
      currentReplaceMagicListFilePath: this._currentReplaceMagicListFilePath,
      replaceLists,
    };
  }

  /**
   * 反序列化替换列表（从存档加载）
   * C# Reference: MagicListManager.LoadList for replacement lists
   * @param data 序列化的替换列表数据
   */
  async deserializeReplaceLists(data: any): Promise<void> {
    if (!data) return;

    this._isInReplaceMagicList = data.isInReplaceMagicList || false;
    this._currentReplaceMagicListFilePath = data.currentReplaceMagicListFilePath || "";

    if (data.replaceLists) {
      for (const [filePath, items] of Object.entries(data.replaceLists as Record<string, any[]>)) {
        const size = MAGIC_LIST_CONFIG.maxMagic + 1;
        const newList: (MagicItemInfo | null)[] = new Array(size).fill(null);
        const newHideList: (MagicItemInfo | null)[] = new Array(size).fill(null);

        for (const item of items) {
          const magic = await loadMagic(ResourcePath.magic(item.fileName));
          if (magic) {
            const levelMagic = getMagicAtLevel(magic, item.level || 1);
            const info = createDefaultMagicItemInfo(levelMagic, item.level || 1);
            info.exp = item.exp || 0;
            info.hideCount = item.hideCount || 1;
            info.lastIndexWhenHide = item.lastIndexWhenHide || 0;

            const isHidden = item.index >= MAGIC_LIST_CONFIG.hideStartIndex;
            const targetIndex = isHidden ? item.index - MAGIC_LIST_CONFIG.hideStartIndex : item.index;

            if (targetIndex >= 0 && targetIndex <= MAGIC_LIST_CONFIG.maxMagic) {
              if (isHidden) {
                newHideList[targetIndex] = info;
              } else {
                newList[targetIndex] = info;
              }
            }
          }
        }

        this._replaceMagicList.set(filePath, newList);
        this._replaceMagicListHide.set(filePath, newHideList);
      }
    }

    if (this._isInReplaceMagicList) {
      this.updateView();
    }

    logger.debug(`[MagicListManager] DeserializeReplaceLists: loaded ${this._replaceMagicList.size} replacement lists`);
  }
}
