/**
 * MagicListManager - based on JxqyHD Engine/ListManager/MagicListManager.cs
 * 管理玩家的武功列表和武功经验配置
 */

import { ResourcePath } from "../../resource/resource-paths";
import { logger } from "../../core/logger";
import { getMagic, getMagicAtLevel, preloadMagicAsf } from "../../magic/magic-loader";
import type { MagicData, MagicItemInfo } from "../../magic/types";
import { createDefaultMagicItemInfo } from "../../magic/types";
import { getGameConfig } from "../../resource/resource-loader";
import { loadAsf } from "../../resource/format/asf";

/**
 * 武功经验配置
 * 中的 MagicExp 相关
 */
export interface MagicExpConfig {
  /** 根据命中角色等级获取经验值 */
  expByLevel: Map<number, number>;
  /** 修炼武功经验倍率 */
  xiuLianMagicExpFraction: number;
  /** 使用武功经验倍率 */
  useMagicExpFraction: number;
}

// 武功列表索引常量
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
   * 武功升级时增加玩家属性
   * @param oldMagic 旧等级武功（用于移除 FlyIni 等）
   * @param newMagic 新等级武功
   */
  onMagicLevelUp?: (oldMagic: MagicData, newMagic: MagicData) => void;
  /**
   * 修炼武功改变回调 - 用于 Player 更新 SpecialAttackTexture
   * setter
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

  // Player 的 NpcIniIndex，用于构建 SpecialAttackTexture 路径
  // 设置后才能预加载修炼武功的特殊攻击动画
  private _npcIniIndex: number = 1;

  // === ReplaceMagicList ===
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
   * 初始化武功经验配置（从 /api/config 加载）
   */
  initializeMagicExp(): void {
    if (this.magicExpInitialized) return;

    const gameConfig = getGameConfig();
    if (!gameConfig?.magicExp) {
      logger.warn(`[MagicListManager] No magicExp in API config, using defaults`);
      return;
    }

    const { expByLevel, xiuLianMagicExpFraction, useMagicExpFraction } = gameConfig.magicExp;
    for (const entry of expByLevel) {
      this.magicExpConfig.expByLevel.set(entry.level, entry.exp);
    }
    this.magicExpConfig.xiuLianMagicExpFraction = xiuLianMagicExpFraction;
    this.magicExpConfig.useMagicExpFraction = useMagicExpFraction;
    this.magicExpInitialized = true;
    logger.log(
      `[MagicListManager] MagicExp loaded from API: ${this.magicExpConfig.expByLevel.size} levels, xiuLian=${xiuLianMagicExpFraction}, useMagic=${useMagicExpFraction}`
    );
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
   * Reference: Utils.GetMagicExp(hitedCharacterLevel)
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
   * 设置回调（完全替换）
   */
  setCallbacks(callbacks: MagicListCallbacks): void {
    this.callbacks = callbacks;
  }

  /**
   * 添加回调（合并，不覆盖已有回调）
   */
  addCallbacks(callbacks: MagicListCallbacks): void {
    this.callbacks = { ...this.callbacks, ...callbacks };
  }

  /**
   * 设置 NpcIniIndex（由 Player 在 setNpcIni 时调用）
   * 用于构建 SpecialAttackTexture 路径：{ActionFile}{NpcIniIndex}.asf
   *
   * @returns Promise 当预加载完成时 resolve
   */
  async setNpcIniIndex(index: number): Promise<void> {
    this._npcIniIndex = index;
    // 如果已有修炼武功，需要重新加载其 SpecialAttackTexture
    if (this.xiuLianMagic?.magic?.actionFile && this.xiuLianMagic.magic.attackFile) {
      await this._preloadSpecialAttackTexture(this.xiuLianMagic.magic);
    }
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
   * 负责：设置 itemInfo、预加载 ASF、更新修炼武功
   */
  private async _setMagicItemAt(
    index: number,
    itemInfo: MagicItemInfo,
    isHidden: boolean = false
  ): Promise<void> {
    this._placeMagicItemSync(index, itemInfo, isHidden);

    // 预加载武功的 ASF 资源
    const promises = this._collectPreloadPromises(itemInfo.magic);
    if (promises.length > 0) {
      await Promise.all(promises);
    }
  }

  /**
   * 同步放置武功到列表（不做任何 I/O）
   * 用于批量加载时先全部放置，再统一预加载
   */
  private _placeMagicItemSync(
    index: number,
    itemInfo: MagicItemInfo,
    isHidden: boolean = false
  ): void {
    const targetList = isHidden ? this.magicListHide : this.magicList;
    targetList[index] = itemInfo;

    // 更新修炼武功
    if (!isHidden && this.indexInXiuLianIndex(index)) {
      this.xiuLianMagic = itemInfo;
      // 通知 Player 同步获取已预加载的资源
      this.callbacks.onXiuLianMagicChange?.(itemInfo);
    }
  }

  /**
   * 收集武功预加载所需的所有 Promise（飞行动画、消失动画、攻击武功、特殊攻击动画）
   * 返回的 Promise 可以和其他武功的一起并行执行
   */
  private _collectPreloadPromises(magic: MagicData | null): Promise<unknown>[] {
    if (!magic) return [];

    const promises: Promise<unknown>[] = [];

    // 预加载武功自身的 ASF 资源（飞行动画、消失动画等）
    promises.push(preloadMagicAsf(magic));

    // 如果武功有 AttackFile+ActionFile，预加载相关资源
    if (magic.attackFile && magic.actionFile) {
      const attackMagic = getMagic(magic.attackFile);
      if (attackMagic) {
        promises.push(preloadMagicAsf(attackMagic));
      }
      promises.push(this._preloadSpecialAttackTexture(magic));
    }

    return promises;
  }

  /**
   * 预加载修炼武功的 SpecialAttackTexture
   * 路径：asf/character/{ActionFile}{NpcIniIndex}.asf
   */
  private async _preloadSpecialAttackTexture(magic: MagicData): Promise<void> {
    if (!magic.actionFile || !magic.attackFile) return;

    const asfFileName = `${magic.actionFile}${this._npcIniIndex}.asf`;
    const paths = [ResourcePath.asfCharacter(asfFileName), ResourcePath.asfInterlude(asfFileName)];

    for (const path of paths) {
      const asf = await loadAsf(path);
      if (asf) {
        return;
      }
    }
    logger.warn(`[MagicListManager] Failed to preload SpecialAttackTexture: ${asfFileName}`);
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
    // 清空修炼武功并触发回调
    if (this.xiuLianMagic !== null) {
      this.xiuLianMagic = null;
      this.callbacks.onXiuLianMagicChange?.(null);
    }
    this.updateView();
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
   * 获取隐藏列表中的武功项信息
   * 用于存档保存时遍历隐藏武功
   */
  getHiddenItemInfo(index: number): MagicItemInfo | null {
    if (!this.indexInRange(index)) return null;
    return this.getActiveMagicListHide()[index];
  }

  /**
   * 添加武功到隐藏列表（用于读档恢复隐藏武功）
   * 参考 C# MagicListManager.LoadList 中 HideStartIndex 区域的加载逻辑
   */
  async addHiddenMagic(
    fileName: string,
    options: {
      index: number;
      level?: number;
      exp?: number;
      hideCount?: number;
      lastIndexWhenHide?: number;
    }
  ): Promise<boolean> {
    const { index, level = 1, exp = 0, hideCount = 0, lastIndexWhenHide = 0 } = options;

    if (!this.indexInRange(index)) {
      logger.warn(`[MagicListManager] Invalid hidden index: ${index}`);
      return false;
    }

    const magic = getMagic(fileName);
    if (!magic) {
      logger.warn(`[MagicListManager] Failed to load hidden magic: ${fileName}`);
      return false;
    }

    const levelMagic = getMagicAtLevel(magic, level);
    const itemInfo = createDefaultMagicItemInfo(levelMagic, level);
    itemInfo.exp = exp;
    itemInfo.hideCount = hideCount;
    itemInfo.lastIndexWhenHide = lastIndexWhenHide;

    await this._setMagicItemAt(index, itemInfo, true);
    logger.debug(
      `[MagicListManager] Added hidden magic "${magic.name}" Lv.${level} at hidden index ${index}`
    );
    return true;
  }

  // ========== 批量加载（并行预加载 ASF） ==========

  /**
   * 批量添加武功 - 同步放置所有武功，然后并行预加载所有 ASF 资源
   * 比逐个调用 addMagic() 快得多（~27个武功从 ~1.1s 降到 ~100-200ms）
   *
   * @param items 武功项数组
   * @returns 每个武功的 [是否新增, 索引] 结果
   */
  async addMagicBatch(
    items: ReadonlyArray<{
      fileName: string;
      index?: number;
      level?: number;
      exp?: number;
      hideCount?: number;
    }>
  ): Promise<Array<[boolean, number]>> {
    const results: Array<[boolean, number]> = [];
    const allPreloadPromises: Promise<unknown>[] = [];

    // Phase 1: 同步放置所有武功（快速，无 I/O）
    for (const item of items) {
      const { fileName, index: targetIndex, level = 1, exp = 0 } = item;

      // 检查是否已存在
      const existingIndex = this.getIndexByFileName(fileName);
      if (existingIndex !== -1) {
        results.push([false, existingIndex]);
        continue;
      }

      // 确定目标位置
      let index: number;
      if (targetIndex !== undefined && targetIndex > 0) {
        if (!this.indexInRange(targetIndex)) {
          logger.warn(`[MagicListManager] Invalid index: ${targetIndex}`);
          results.push([false, -1]);
          continue;
        }
        index = targetIndex;
      } else {
        index = this.getFreeIndex();
        if (index === -1) {
          logger.warn("[MagicListManager] No free slot for magic");
          results.push([false, -1]);
          continue;
        }
      }

      // 加载武功配置（同步，从 API 缓存读取）
      const magic = getMagic(fileName);
      if (!magic) {
        logger.warn(`[MagicListManager] Failed to load magic: ${fileName}`);
        results.push([false, -1]);
        continue;
      }

      const levelMagic = getMagicAtLevel(magic, level);
      const itemInfo = createDefaultMagicItemInfo(levelMagic, level);
      itemInfo.exp = exp;
      if (item.hideCount !== undefined) {
        itemInfo.hideCount = item.hideCount;
      }

      // 同步放置到列表
      this._placeMagicItemSync(index, itemInfo, false);

      // 收集预加载 Promise
      allPreloadPromises.push(...this._collectPreloadPromises(itemInfo.magic));

      logger.debug(
        `[MagicListManager] Added magic "${magic.name}" Lv.${level} at index ${index}`
      );
      results.push([true, index]);
    }

    // Phase 2: 并行预加载所有 ASF 资源
    if (allPreloadPromises.length > 0) {
      await Promise.all(allPreloadPromises);
    }

    this.updateView();
    return results;
  }

  /**
   * 批量添加隐藏武功 - 同步放置所有隐藏武功，然后并行预加载
   */
  async addHiddenMagicBatch(
    items: ReadonlyArray<{
      fileName: string;
      index: number;
      level?: number;
      exp?: number;
      hideCount?: number;
      lastIndexWhenHide?: number;
    }>
  ): Promise<void> {
    const allPreloadPromises: Promise<unknown>[] = [];

    for (const item of items) {
      const { fileName, index, level = 1, exp = 0, hideCount = 0, lastIndexWhenHide = 0 } = item;

      if (!this.indexInRange(index)) {
        logger.warn(`[MagicListManager] Invalid hidden index: ${index}`);
        continue;
      }

      const magic = getMagic(fileName);
      if (!magic) {
        logger.warn(`[MagicListManager] Failed to load hidden magic: ${fileName}`);
        continue;
      }

      const levelMagic = getMagicAtLevel(magic, level);
      const itemInfo = createDefaultMagicItemInfo(levelMagic, level);
      itemInfo.exp = exp;
      itemInfo.hideCount = hideCount;
      itemInfo.lastIndexWhenHide = lastIndexWhenHide;

      // 同步放置到隐藏列表
      this._placeMagicItemSync(index, itemInfo, true);

      // 收集预加载 Promise
      allPreloadPromises.push(...this._collectPreloadPromises(itemInfo.magic));

      logger.debug(
        `[MagicListManager] Added hidden magic "${magic.name}" Lv.${level} at hidden index ${index}`
      );
    }

    // 并行预加载所有 ASF 资源
    if (allPreloadPromises.length > 0) {
      await Promise.all(allPreloadPromises);
    }
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
   * 添加武功到列表（唯一的公开 API）
   * @param fileName 武功文件名
   * @param options 可选参数
   *   - index: 指定位置，不指定则自动找空位
   *   - level: 等级，默认1
   *   - exp: 经验，默认0
   * @returns [是否新增, 索引, 武功数据]
   */
  async addMagic(
    fileName: string,
    options?: { index?: number; level?: number; exp?: number }
  ): Promise<[boolean, number, MagicData | null]> {
    const { index: targetIndex, level = 1, exp = 0 } = options ?? {};

    // 检查是否已存在
    const existingIndex = this.getIndexByFileName(fileName);
    if (existingIndex !== -1) {
      return [false, existingIndex, this.getActiveMagicList()[existingIndex]?.magic || null];
    }

    // 确定目标位置
    let index: number;
    if (targetIndex !== undefined && targetIndex > 0) {
      if (!this.indexInRange(targetIndex)) {
        logger.warn(`[MagicListManager] Invalid index: ${targetIndex}`);
        return [false, -1, null];
      }
      index = targetIndex;
    } else {
      index = this.getFreeIndex();
      if (index === -1) {
        logger.warn("[MagicListManager] No free slot for magic");
        return [false, -1, null];
      }
    }

    // 加载武功
    const magic = getMagic(fileName);
    if (!magic) {
      logger.warn(`[MagicListManager] Failed to load magic: ${fileName}`);
      return [false, -1, null];
    }

    // 获取指定等级的武功数据
    const levelMagic = getMagicAtLevel(magic, level);
    const itemInfo = createDefaultMagicItemInfo(levelMagic, level);
    itemInfo.exp = exp;

    // 使用统一入口添加
    await this._setMagicItemAt(index, itemInfo);

    logger.debug(`[MagicListManager] Added magic "${magic.name}" Lv.${level} at index ${index}`);
    this.updateView();

    return [true, index, levelMagic];
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
      this.callbacks.onXiuLianMagicChange?.(null);
    }

    activeList[index] = null;
    this.updateView();
    return true;
  }

  // ========== 隐藏/显示武功（装备 MagicIniWhenUse） ==========

  /**
   * 检查武功是否在隐藏列表中
   */
  isMagicHided(fileName: string): boolean {
    const lowerName = fileName.toLowerCase();
    const hideList = this.getActiveMagicListHide();
    for (let i = 1; i <= MAGIC_LIST_CONFIG.maxMagic; i++) {
      const info = hideList[i];
      if (info?.magic && info.magic.fileName.toLowerCase() === lowerName) {
        return true;
      }
    }
    return false;
  }

  /**
   * 获取非替换状态下的武功信息（包括隐藏列表）
   */
  getNonReplaceMagic(fileName: string): MagicItemInfo | null {
    const lowerName = fileName.toLowerCase();

    // 先在主列表查找
    for (let i = 1; i <= MAGIC_LIST_CONFIG.maxMagic; i++) {
      const info = this.magicList[i];
      if (info?.magic && info.magic.fileName.toLowerCase() === lowerName) {
        return info;
      }
    }

    // 再在隐藏列表查找
    for (let i = 1; i <= MAGIC_LIST_CONFIG.maxMagic; i++) {
      const info = this.magicListHide[i];
      if (info?.magic && info.magic.fileName.toLowerCase() === lowerName) {
        return info;
      }
    }

    return null;
  }

  /**
   * 设置武功的隐藏状态
   * @param fileName 武功文件名
   * @param hide true=隐藏, false=显示
   * @returns 操作后的武功信息，如果武功不存在则返回 null
   */
  setMagicHide(fileName: string, hide: boolean): MagicItemInfo | null {
    const lowerName = fileName.toLowerCase();

    if (hide) {
      // 从主列表移动到隐藏列表
      for (let i = 1; i <= MAGIC_LIST_CONFIG.maxMagic; i++) {
        const info = this.magicList[i];
        if (info?.magic && info.magic.fileName.toLowerCase() === lowerName) {
          // 增加隐藏计数
          info.hideCount = (info.hideCount || 0) + 1;

          // 如果是第一次隐藏，移动到隐藏列表
          if (info.hideCount === 1) {
            info.lastIndexWhenHide = i;
            this.magicList[i] = null;

            // 找隐藏列表的空位
            let hideIndex = -1;
            for (let j = 1; j <= MAGIC_LIST_CONFIG.maxMagic; j++) {
              if (!this.magicListHide[j]) {
                hideIndex = j;
                break;
              }
            }
            if (hideIndex !== -1) {
              this.magicListHide[hideIndex] = info;
            }

            // 如果是当前使用或修炼武功，清除
            if (this.currentMagicInUse === info) {
              this.currentMagicInUse = null;
            }
            if (this.xiuLianMagic === info) {
              this.xiuLianMagic = null;
              this.callbacks.onXiuLianMagicChange?.(null);
            }

            this.updateView();
          }
          return info;
        }
      }

      // 检查是否已经在隐藏列表中，只增加计数
      for (let i = 1; i <= MAGIC_LIST_CONFIG.maxMagic; i++) {
        const info = this.magicListHide[i];
        if (info?.magic && info.magic.fileName.toLowerCase() === lowerName) {
          info.hideCount = (info.hideCount || 0) + 1;
          return info;
        }
      }
    } else {
      // 从隐藏列表移动到主列表
      for (let i = 1; i <= MAGIC_LIST_CONFIG.maxMagic; i++) {
        const info = this.magicListHide[i];
        if (info?.magic && info.magic.fileName.toLowerCase() === lowerName) {
          // 减少隐藏计数
          info.hideCount = Math.max(0, (info.hideCount || 1) - 1);

          // 如果隐藏计数归零，移回主列表
          if (info.hideCount === 0) {
            this.magicListHide[i] = null;

            // 尝试恢复到原位置
            let targetIndex = info.lastIndexWhenHide || -1;
            if (targetIndex === -1 || this.magicList[targetIndex]) {
              // 原位置被占用，找空位
              targetIndex = this.getFreeIndex();
            }
            if (targetIndex !== -1) {
              this.magicList[targetIndex] = info;
            }

            this.updateView();
          }
          return info;
        }
      }
    }

    return null;
  }

  /**
   * 交换列表项（同步，资源已在 addMagic 时预加载）
   *
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

    // 检查修炼武功 - 资源已在 addMagic 时预加载，这里只需更新状态
    if (this.indexInXiuLianIndex(index1)) {
      this.xiuLianMagic = activeList[index1];
      this.callbacks.onXiuLianMagicChange?.(this.xiuLianMagic);
    }
    if (this.indexInXiuLianIndex(index2)) {
      this.xiuLianMagic = activeList[index2];
      this.callbacks.onXiuLianMagicChange?.(this.xiuLianMagic);
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
   */
  addMagicExp(fileName: string, expToAdd: number): boolean {
    const index = this.getIndexByFileName(fileName);
    if (index === -1) return false;

    const info = this.getActiveMagicList()[index];
    if (!info || !info.magic) return false;

    // if (info.TheMagic.LevelupExp == 0) 已满级
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

      // Reference: 触发回调让 Player 处理属性加成
      // LifeMax += info.TheMagic.LifeMax; ThewMax += ...; etc.
      if (this.callbacks.onMagicLevelUp) {
        this.callbacks.onMagicLevelUp(oldMagic, newMagic);
      }

      // if (info.TheMagic.LevelupExp == 0) info.Exp = levelupExp (满级时经验设为升级经验)
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
   * setter - 同时更新 SpecialAttackTexture
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

  // ============= 脚本命令支持 =============

  /**
   * 设置武功等级（脚本命令 SetMagicLevel）
   * MagicListManager.SetNonReplaceMagicLevel(fileName, level)
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
  // MagicListManager.ReplaceListTo, StopReplace

  /**
   * 获取当前活动的武功列表（考虑是否在替换状态）
   * getter
   */
  private getActiveMagicList(): (MagicItemInfo | null)[] {
    if (this._isInReplaceMagicList && this._currentReplaceMagicListFilePath) {
      return this._replaceMagicList.get(this._currentReplaceMagicListFilePath) || this.magicList;
    }
    return this.magicList;
  }

  /**
   * 获取当前活动的隐藏武功列表（考虑是否在替换状态）
   * getter
   */
  private getActiveMagicListHide(): (MagicItemInfo | null)[] {
    if (this._isInReplaceMagicList && this._currentReplaceMagicListFilePath) {
      return (
        this._replaceMagicListHide.get(this._currentReplaceMagicListFilePath) || this.magicListHide
      );
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

      // 先填充 BottomIndex，再填充 StoreIndex
      let listI = 0;

      // 填充快捷栏 (BottomIndex)
      for (let i = MAGIC_LIST_CONFIG.bottomIndexBegin; i <= MAGIC_LIST_CONFIG.bottomIndexEnd; i++) {
        if (listI < magicFileNames.length) {
          const magic = getMagic(ResourcePath.magic(magicFileNames[listI]));
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
          const magic = getMagic(ResourcePath.magic(magicFileNames[listI]));
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

      logger.log(
        `[MagicListManager] ReplaceListTo: created new list for ${filePath} with ${magicFileNames.length} magics`
      );
    }

    this.updateView();
  }

  /**
   * 停止替换武功列表，恢复原始列表
   */
  stopReplace(): void {
    this._isInReplaceMagicList = false;
    logger.log(`[MagicListManager] StopReplace: restored to original list`);
    this.updateView();
  }

  /**
   * 清除所有替换列表
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
   * 重新加载所有武功数据（用于热重载武功配置）
   * 保留等级和经验，但使用新的 MagicData 配置
   */
  async reloadAllMagics(): Promise<void> {
    let reloadCount = 0;

    // 重新加载主列表中的武功
    for (let i = 1; i <= MAGIC_LIST_CONFIG.maxMagic; i++) {
      const info = this.magicList[i];
      if (info?.magic) {
        const newMagic = getMagic(info.magic.fileName);
        if (newMagic) {
          const levelMagic = getMagicAtLevel(newMagic, info.level);
          info.magic = levelMagic;
          reloadCount++;
        }
      }

      // 同时处理隐藏列表
      const hideInfo = this.magicListHide[i];
      if (hideInfo?.magic) {
        const newMagic = getMagic(hideInfo.magic.fileName);
        if (newMagic) {
          const levelMagic = getMagicAtLevel(newMagic, hideInfo.level);
          hideInfo.magic = levelMagic;
          reloadCount++;
        }
      }
    }

    // 更新当前使用的武功引用
    if (this.currentMagicInUse?.magic) {
      const idx = this.getItemIndex(this.currentMagicInUse);
      if (idx > 0) {
        this.currentMagicInUse = this.getItemInfo(idx);
      }
    }

    // 更新修炼武功引用
    if (this.xiuLianMagic?.magic) {
      this.xiuLianMagic = this.getItemInfo(MAGIC_LIST_CONFIG.xiuLianIndex);
      this.callbacks.onXiuLianMagicChange?.(this.xiuLianMagic);
    }

    this.updateView();
    logger.info(`[MagicListManager] Reloaded ${reloadCount} magics`);
  }

  /**
   * 序列化替换列表（用于存档）
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
   * for replacement lists
   * @param data 序列化的替换列表数据
   */
  async deserializeReplaceLists(
    data: {
      isInReplaceMagicList?: boolean;
      currentReplaceMagicListFilePath?: string;
      replaceLists?: Record<
        string,
        {
          index: number;
          fileName: string;
          level?: number;
          exp?: number;
          hideCount?: number;
          lastIndexWhenHide?: number;
        }[]
      >;
    } | null
  ): Promise<void> {
    if (!data) return;

    this._isInReplaceMagicList = data.isInReplaceMagicList || false;
    this._currentReplaceMagicListFilePath = data.currentReplaceMagicListFilePath || "";

    if (data.replaceLists) {
      for (const [filePath, items] of Object.entries(data.replaceLists)) {
        const size = MAGIC_LIST_CONFIG.maxMagic + 1;
        const newList: (MagicItemInfo | null)[] = new Array(size).fill(null);
        const newHideList: (MagicItemInfo | null)[] = new Array(size).fill(null);

        for (const item of items) {
          const magic = getMagic(ResourcePath.magic(item.fileName));
          if (magic) {
            const levelMagic = getMagicAtLevel(magic, item.level || 1);
            const info = createDefaultMagicItemInfo(levelMagic, item.level || 1);
            info.exp = item.exp || 0;
            info.hideCount = item.hideCount || 1;
            info.lastIndexWhenHide = item.lastIndexWhenHide || 0;

            const isHidden = item.index >= MAGIC_LIST_CONFIG.hideStartIndex;
            const targetIndex = isHidden
              ? item.index - MAGIC_LIST_CONFIG.hideStartIndex
              : item.index;

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

    logger.debug(
      `[MagicListManager] DeserializeReplaceLists: loaded ${this._replaceMagicList.size} replacement lists`
    );
  }
}
