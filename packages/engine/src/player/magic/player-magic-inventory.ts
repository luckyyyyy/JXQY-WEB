/**
 * PlayerMagicInventory - based on JxqyHD Engine/ListManager/PlayerMagicInventory.cs
 * 管理玩家的武功列表和武功经验配置
 */

import { logger } from "../../core/logger";
import { getMagic, getMagicAtLevel, preloadMagicAsf } from "../../magic/magic-config-loader";
import type { MagicData, MagicItemInfo } from "../../magic/types";
import { createDefaultMagicItemInfo } from "../../magic/types";
import { loadAsf } from "../../resource/format/asf";
import { ResourcePath } from "../../resource/resource-paths";
import { MAGIC_LIST_CONFIG, type MagicListCallbacks } from "./magic-list-config";
import type { MagicListExpDeps } from "./magic-list-experience";
import {
  addMagicExpDirect as _addMagicExpDirect,
  initializeMagicExp as _initializeMagicExp,
  setMagicLevel as _setMagicLevel,
  setNonReplaceMagicLevel as _setNonReplaceMagicLevel,
} from "./magic-list-experience";
import type { MagicListHideDeps } from "./magic-list-hide";
import {
  addHiddenMagic as _addHiddenMagic,
  addHiddenMagicBatch as _addHiddenMagicBatch,
  getHiddenItemInfo as _getHiddenItemInfo,
  getNonReplaceMagic as _getNonReplaceMagic,
  isMagicHided as _isMagicHided,
  setMagicHide as _setMagicHide,
} from "./magic-list-hide";
import { MagicListReplace } from "./magic-list-replace";

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

/**
 * 武功列表管理器
 */
export class PlayerMagicInventory {
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

  // === ReplaceMagicList（委托 MagicListReplace）===
  private readonly replace = new MagicListReplace();

  // 快捷栏：物理持有武功项（物品从面板/修炼区移入）
  private bottomSlots: (MagicItemInfo | null)[] = new Array(MAGIC_LIST_CONFIG.bottomSlotCount).fill(
    null
  );

  constructor() {
    const size = MAGIC_LIST_CONFIG.maxMagic + 1;
    this.magicList = new Array(size).fill(null);
    this.magicListHide = new Array(size).fill(null);
  }

  // ============= 委托上下文（惰性创建）=============

  private _expDeps: MagicListExpDeps | null = null;
  private get expDeps(): MagicListExpDeps {
    return (this._expDeps ??= {
      magicExpConfig: this.magicExpConfig,
      callbacks: this.callbacks,
      setMagicExpInitialized: (v) => {
        this.magicExpInitialized = v;
      },
      isMagicExpInitialized: () => this.magicExpInitialized,
      getIndexByFileName: (fn) => this.getIndexByFileName(fn),
      getActiveMagicList: () => this.getActiveMagicList(),
      getMagicByFileName: (fn) => this.getMagicByFileName(fn),
      updateView: () => this.updateView(),
    });
  }

  private _hideDeps: MagicListHideDeps | null = null;
  private get hideDeps(): MagicListHideDeps {
    return (this._hideDeps ??= {
      magicList: this.magicList,
      magicListHide: this.magicListHide,
      callbacks: this.callbacks,
      getCurrentMagicInUse: () => this.currentMagicInUse,
      setCurrentMagicInUse: (v) => {
        this.currentMagicInUse = v;
      },
      getXiuLianMagic: () => this.xiuLianMagic,
      setXiuLianMagicDirect: (v) => {
        this.xiuLianMagic = v;
      },
      indexInRange: (i) => this.indexInRange(i),
      getFreeIndex: () => this.getFreeIndex(),
      _placeMagicItemSync: (i, info, h) => this._placeMagicItemSync(i, info, h),
      _collectPreloadPromises: (m) => this._collectPreloadPromises(m),
      updateView: () => this.updateView(),
    });
  }

  // ============= 武功经验配置（委托 MagicListExperience）=============

  initializeMagicExp(): void {
    _initializeMagicExp(this.expDeps);
  }
  getXiuLianMagicExpFraction(): number {
    return this.magicExpConfig.xiuLianMagicExpFraction;
  }
  getUseMagicExpFraction(): number {
    return this.magicExpConfig.useMagicExpFraction;
  }

  /**
   * 击杀奖励：按比例给修炼武功和当前使用武功加经验
   * 主角与伙伴共用此逻辑，避免在调用方写两份代码
   * Reference: Player.AddExp(amount, addMagicExp=true)
   * @param amount 角色获得的经验数
   * @param ownerName 角色名（仅用于日志）
   */
  awardKillExp(amount: number, ownerName: string): void {
    // 修炼中的武功
    if (this.xiuLianMagic?.magic) {
      const xiuLianExp = Math.floor(amount * this.magicExpConfig.xiuLianMagicExpFraction);
      if (xiuLianExp > 0) {
        _addMagicExpDirect(this.expDeps, this.xiuLianMagic, xiuLianExp);
        logger.log(
          `[PlayerMagicInventory] ${ownerName} XiuLian magic "${this.xiuLianMagic.magic.name}" gained ${xiuLianExp} exp`
        );
      }
    }

    // 当前使用的武功
    if (this.currentMagicInUse?.magic) {
      const useMagicExp = Math.floor(amount * this.magicExpConfig.useMagicExpFraction);
      if (useMagicExp > 0) {
        _addMagicExpDirect(this.expDeps, this.currentMagicInUse, useMagicExp);
        logger.log(
          `[PlayerMagicInventory] ${ownerName} current magic "${this.currentMagicInUse.magic.name}" gained ${useMagicExp} exp`
        );
      }
    }
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
   * 检查索引是否在有效范围内（面板区 1..maxMagic=60）
   */
  indexInRange(index: number): boolean {
    return index >= 1 && index <= MAGIC_LIST_CONFIG.maxMagic;
  }

  /**
   * 检查索引是否是修炼索引（虚拟，不在面板中）
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
   * 注意：index === xiuLianIndex (501) 时直接设置修炼武功，不写入面板列表
   */
  private _placeMagicItemSync(
    index: number,
    itemInfo: MagicItemInfo,
    isHidden: boolean = false
  ): void {
    // 修炼武功：虚拟索引 61，不存储在 magicList 中
    if (!isHidden && index === MAGIC_LIST_CONFIG.xiuLianIndex) {
      this.xiuLianMagic = itemInfo;
      this.callbacks.onXiuLianMagicChange?.(itemInfo);
      return;
    }
    const targetList = isHidden ? this.magicListHide : this.magicList;
    targetList[index] = itemInfo;
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
    logger.warn(`[PlayerMagicInventory] Failed to preload SpecialAttackTexture: ${asfFileName}`);
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
    this.bottomSlots.fill(null);
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
   * 特殊：index === xiuLianIndex (501) 返回修炼武功；否则从面板获取
   */
  getItemInfo(index: number): MagicItemInfo | null {
    if (index === MAGIC_LIST_CONFIG.xiuLianIndex) {
      return this.xiuLianMagic;
    }
    if (!this.indexInRange(index)) return null;
    return this.getActiveMagicList()[index];
  }

  /**
   * 获取隐藏列表中的武功项信息
   */
  getHiddenItemInfo(index: number): MagicItemInfo | null {
    return _getHiddenItemInfo(this.hideDeps, index);
  }

  /**
   * 添加武功到隐藏列表（用于读档恢复隐藏武功）
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
    return _addHiddenMagic(this.hideDeps, fileName, options);
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
        // 特殊处理：xiuLianIndex (501) 允许直接放置为修炼武功
        if (targetIndex === MAGIC_LIST_CONFIG.xiuLianIndex) {
          index = targetIndex;
        } else if (!this.indexInRange(targetIndex)) {
          logger.warn(`[PlayerMagicInventory] Invalid index: ${targetIndex}`);
          results.push([false, -1]);
          continue;
        } else {
          index = targetIndex;
        }
      } else {
        index = this.getFreeIndex();
        if (index === -1) {
          logger.warn("[PlayerMagicInventory] No free slot for magic");
          results.push([false, -1]);
          continue;
        }
      }

      // 加载武功配置（同步，从 API 缓存读取）
      const magic = getMagic(fileName);
      if (!magic) {
        logger.warn(`[PlayerMagicInventory] Failed to load magic: ${fileName}`);
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
        `[PlayerMagicInventory] Added magic "${magic.name}" Lv.${level} at index ${index}`
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
   * 批量添加隐藏武功
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
    return _addHiddenMagicBatch(this.hideDeps, items);
  }

  /**
   * 获取武功项的索引
   */
  getItemIndex(info: MagicItemInfo | null): number {
    if (!info) return 0;
    const activeList = this.getActiveMagicList();
    for (let i = 1; i <= MAGIC_LIST_CONFIG.maxMagic; i++) {
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
    return magic.icon || magic.image || null;
  }

  /**
   * 获取空闲索引
   */
  getFreeIndex(): number {
    const activeList = this.getActiveMagicList();
    for (let i = MAGIC_LIST_CONFIG.storeIndexBegin; i <= MAGIC_LIST_CONFIG.storeIndexEnd; i++) {
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
   * 根据文件名获取武功信息（搜索面板 + 快捷栏）
   */
  getMagicByFileName(fileName: string): MagicItemInfo | null {
    const index = this.getIndexByFileName(fileName);
    if (index !== -1) {
      return this.getActiveMagicList()[index];
    }
    // 快捷栏不在面板中，需要单独搜索
    const lowerName = fileName.toLowerCase();
    for (const info of this.bottomSlots) {
      if (info?.magic && info.magic.fileName.toLowerCase() === lowerName) {
        return info;
      }
    }
    return null;
  }

  /**
   * 添加武功到列表（唯一的公开 API）
   * @param fileName 武功文件名
   * @param options 可选参数
   *   - index: 指定位置（1..maxMagic），不指定则自动找空位
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
        logger.warn(`[PlayerMagicInventory] Invalid index: ${targetIndex}`);
        return [false, -1, null];
      }
      index = targetIndex;
    } else {
      index = this.getFreeIndex();
      if (index === -1) {
        logger.warn("[PlayerMagicInventory] No free slot for magic");
        return [false, -1, null];
      }
    }

    // 加载武功
    const magic = getMagic(fileName);
    if (!magic) {
      logger.warn(`[PlayerMagicInventory] Failed to load magic: ${fileName}`);
      return [false, -1, null];
    }

    // 获取指定等级的武功数据
    const levelMagic = getMagicAtLevel(magic, level);
    const itemInfo = createDefaultMagicItemInfo(levelMagic, level);
    itemInfo.exp = exp;

    // 使用统一入口添加
    await this._setMagicItemAt(index, itemInfo);

    logger.debug(
      `[PlayerMagicInventory] Added magic "${magic.name}" Lv.${level} at index ${index}`
    );
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
    // 清除快捷栏中持有此武功的槽位（物理引用比较）
    for (let s = 0; s < this.bottomSlots.length; s++) {
      if (this.bottomSlots[s] === info) {
        this.bottomSlots[s] = null;
      }
    }

    activeList[index] = null;
    this.updateView();
    return true;
  }

  // ========== 隐藏/显示武功（委托 MagicListHide）==========

  isMagicHided(fileName: string): boolean {
    return _isMagicHided(this.hideDeps, fileName);
  }

  getNonReplaceMagic(fileName: string): MagicItemInfo | null {
    return _getNonReplaceMagic(this.hideDeps, fileName);
  }

  setMagicHide(fileName: string, hide: boolean): MagicItemInfo | null {
    return _setMagicHide(this.hideDeps, fileName, hide);
  }

  /**
   * 交换列表项（同步，资源已在 addMagic 时预加载）
   * 支持 index=61（修炼武功虚拟索引）与面板项互换
   */
  exchangeListItem(index1: number, index2: number): void {
    if (index1 === index2) return;

    const xiuLian = MAGIC_LIST_CONFIG.xiuLianIndex;

    // 至少一个是修炼武功虚拟索引
    if (index1 === xiuLian || index2 === xiuLian) {
      const panelIdx = index1 === xiuLian ? index2 : index1;
      if (!this.indexInRange(panelIdx)) return;
      const activeList = this.getActiveMagicList();
      const temp = this.xiuLianMagic;
      this.xiuLianMagic = activeList[panelIdx];
      activeList[panelIdx] = temp;
      this.callbacks.onXiuLianMagicChange?.(this.xiuLianMagic);
      this.updateView();
      return;
    }

    if (!this.indexInRange(index1) || !this.indexInRange(index2)) return;
    const activeList = this.getActiveMagicList();
    const temp = activeList[index1];
    activeList[index1] = activeList[index2];
    activeList[index2] = temp;
    this.updateView();
  }

  /**
   * 设置武功等级
   */
  setMagicLevel(fileName: string, level: number): void {
    _setMagicLevel(this.expDeps, fileName, level);
  }

  /**
   * 设置修炼武功等级（修炼武功不在 activeMagicList 中，需单独处理）
   */
  setXiuLianMagicLevel(level: number): void {
    const info = this.xiuLianMagic;
    if (!info?.magic) return;

    const baseMagic = info.magic;
    const levelMagic = getMagicAtLevel(baseMagic, level);
    info.magic = levelMagic;
    info.level = level;
    if (level > 1 && baseMagic.levels?.has(level - 1)) {
      info.exp = baseMagic.levels.get(level - 1)?.levelupExp || 0;
    } else {
      info.exp = 0;
    }
    this.updateView();
  }

  /**
   * 增加武功经验（直接操作 MagicItemInfo 对象）
   */
  addMagicExp(info: MagicItemInfo, expToAdd: number): boolean {
    return _addMagicExpDirect(this.expDeps, info, expToAdd);
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
        logger.log("[PlayerMagicInventory] This magic cannot be used");
        return false;
      }
      this.currentMagicInUse = info;
      return true;
    }
    this.currentMagicInUse = null;
    return true;
  }

  /**
   * 通过快捷栏槽位索引设置当前武功
   * @param slotIndex 快捷栏槽位 (0-4)
   */
  setCurrentMagicByBottomIndex(slotIndex: number): boolean {
    const info = this.bottomSlots[slotIndex] ?? null;
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
   * 获取修炼武功（用于 UI 显示）
   * 修炼武功已从面板物理分离，直接返回 xiuLianMagic
   */
  getXiuLianMagicForDisplay(): MagicItemInfo | null {
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
   * 修炼武功存在时返回虚拟索引 61，否则返回 0
   */
  getXiuLianIndex(): number {
    return this.xiuLianMagic ? MAGIC_LIST_CONFIG.xiuLianIndex : 0;
  }

  /**
   * 设置修炼武功（通过索引）
   * - index === 0: 清除修炼武功
   * - index in 1..maxMagic: 将面板[index]的武功物理移到修炼区
   * - index === xiuLianIndex (501): 已在修炼区，不操作（旧存档兼容）
   */
  setXiuLianIndex(index: number): void {
    if (index === 0) {
      this.setXiuLianMagic(null);
    } else if (this.indexInRange(index)) {
      const item = this.getActiveMagicList()[index];
      this.setXiuLianMagic(item ?? null);
      this.getActiveMagicList()[index] = null;
    }
    // index === 61: 修炼武功已通过 _placeMagicItemSync 设置，不需额外操作
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
   * 快捷栏和修炼武功已物理移出面板，直接返回面板内容
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
   * 获取快捷栏武功（直接返回物理持有的武功项）
   */
  getBottomMagics(): (MagicItemInfo | null)[] {
    return [...this.bottomSlots];
  }

  /**
   * 获取快捷栏某槽位的武功信息
   */
  getBottomMagicInfo(slotIndex: number): MagicItemInfo | null {
    return this.bottomSlots[slotIndex] ?? null;
  }

  /**
   * 将武功物理移动到快捷栏槽位
   * - storeIndex <= 0: 将快捷栏[slotIndex]的武功归还到面板，清空该槽位
   * - storeIndex === 61: 将修炼武功移到快捷栏[slotIndex]
   * - storeIndex in 1..maxMagic: 将面板[storeIndex]的武功移到快捷栏[slotIndex]
   */
  assignMagicToBottomSlot(storeIndex: number, slotIndex: number): boolean {
    if (slotIndex < 0 || slotIndex >= MAGIC_LIST_CONFIG.bottomSlotCount) return false;

    const existing = this.bottomSlots[slotIndex];

    if (storeIndex <= 0) {
      // 清空槽位：把快捷栏武功归还面板空位
      if (existing !== null) {
        const freeIdx = this.getFreeIndex();
        if (freeIdx !== -1) {
          this.getActiveMagicList()[freeIdx] = existing;
        } else {
          logger.warn(
            `[PlayerMagicInventory] No free panel slot to return bottom item: ${existing.magic?.fileName}`
          );
          return false;
        }
      }
      this.bottomSlots[slotIndex] = null;
      this.updateView();
      return true;
    }

    if (storeIndex === MAGIC_LIST_CONFIG.xiuLianIndex) {
      // 与修炼武功交换
      this.bottomSlots[slotIndex] = this.xiuLianMagic;
      this.xiuLianMagic = existing;
      this.callbacks.onXiuLianMagicChange?.(this.xiuLianMagic);
      this.updateView();
      return true;
    }

    if (
      storeIndex >= MAGIC_LIST_CONFIG.storeIndexBegin &&
      storeIndex <= MAGIC_LIST_CONFIG.maxMagic
    ) {
      const activeList = this.getActiveMagicList();
      const item = activeList[storeIndex];
      if (!item) return false;
      // 交换：面板 storeIndex ↔ 快捷栏 slotIndex
      activeList[storeIndex] = existing;
      this.bottomSlots[slotIndex] = item;
      this.updateView();
      return true;
    }

    return false;
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
   * 将面板武功物理移动到快捷栏第一个空位
   */
  assignToBottomEmptySlot(storeIndex: number): boolean {
    if (!this.indexInRange(storeIndex)) return false;
    const activeList = this.getActiveMagicList();
    const item = activeList[storeIndex];
    if (!item) return false;

    for (let s = 0; s < this.bottomSlots.length; s++) {
      if (this.bottomSlots[s] === null) {
        this.bottomSlots[s] = item;
        activeList[storeIndex] = null;
        this.updateView();
        return true;
      }
    }
    return false;
  }

  /**
   * 将快捷栏[slot]武功移到修炼区，修炼区原武功移到该快捷栏槽位（互换）
   */
  moveBottomSlotToXiuLian(bottomSlot: number): void {
    if (bottomSlot < 0 || bottomSlot >= MAGIC_LIST_CONFIG.bottomSlotCount) return;
    const item = this.bottomSlots[bottomSlot];
    this.bottomSlots[bottomSlot] = this.xiuLianMagic;
    this.xiuLianMagic = item;
    this.callbacks.onXiuLianMagicChange?.(this.xiuLianMagic);
    this.updateView();
  }

  /**
   * 将快捷栏[bottomSlot]武功物理移动到面板[panelIndex]（互换）
   */
  moveBottomToPanelAt(bottomSlot: number, panelIndex: number): void {
    if (bottomSlot < 0 || bottomSlot >= MAGIC_LIST_CONFIG.bottomSlotCount) return;
    if (!this.indexInRange(panelIndex)) return;
    const activeList = this.getActiveMagicList();
    const tmp = activeList[panelIndex];
    activeList[panelIndex] = this.bottomSlots[bottomSlot];
    this.bottomSlots[bottomSlot] = tmp;
    this.updateView();
  }

  /**
   * 交换两个快捷栏槽位
   */
  swapBottomSlots(fromSlot: number, toSlot: number): void {
    if (
      fromSlot < 0 ||
      fromSlot >= MAGIC_LIST_CONFIG.bottomSlotCount ||
      toSlot < 0 ||
      toSlot >= MAGIC_LIST_CONFIG.bottomSlotCount ||
      fromSlot === toSlot
    )
      return;
    const tmp = this.bottomSlots[fromSlot];
    this.bottomSlots[fromSlot] = this.bottomSlots[toSlot];
    this.bottomSlots[toSlot] = tmp;
    this.updateView();
  }

  /**
   * 将快捷栏武功移动到面板指定位置（交换）
   * 如果面板目标位置为空，直接移入；如果有武功，则交换
   */
  moveBottomToPanelSlot(bottomSlot: number, panelIndex: number): boolean {
    if (bottomSlot < 0 || bottomSlot >= MAGIC_LIST_CONFIG.bottomSlotCount) return false;
    if (!this.indexInRange(panelIndex)) return false;

    const bottomMagic = this.bottomSlots[bottomSlot];
    if (!bottomMagic) return false;

    const activeList = this.getActiveMagicList();
    const panelMagic = activeList[panelIndex];

    activeList[panelIndex] = bottomMagic;
    this.bottomSlots[bottomSlot] = panelMagic;

    this.updateView();
    return true;
  }

  // ============= 快捷栏存档支持 =============

  /**
   * 获取快捷栏引用数组（向后兼容 ui-bridge.ts）
   *
   * 注意：新架构下快捷栏物理持有物品，不再有 storeIndex 引用。
   * 为保持与 ui-bridge.ts 的类型兼容，非空槽位返回虚拟槽位 id（1-5），空槽位返回 null。
   * UI 层改造由独立任务处理（参见 ui-bridge.ts）。
   */
  getBottomSlots(): (number | null)[] {
    return this.bottomSlots.map((item, s) => (item !== null ? s + 1 : null));
  }

  /**
   * 获取快捷栏实际物品数组（用于存档）
   */
  getBottomSlotsItems(): (MagicItemInfo | null)[] {
    return [...this.bottomSlots];
  }

  /**
   * 从存档恢复快捷栏物品（新格式：接受实际武功项）
   */
  setBottomSlots(slots: (MagicItemInfo | null)[]): void {
    for (let s = 0; s < this.bottomSlots.length; s++) {
      this.bottomSlots[s] = slots[s] ?? null;
    }
    this.updateView();
  }

  /**
   * 从存档直接设置快捷栏物品（用于 loadMagicContainer，绕过物理移动逻辑）
   */
  setBottomSlotForLoad(slot: number, item: MagicItemInfo | null): void {
    if (slot >= 0 && slot < MAGIC_LIST_CONFIG.bottomSlotCount) {
      this.bottomSlots[slot] = item;
    }
  }

  /**
   * 从存档直接设置修炼武功（用于 loadMagicContainer，绕过面板逻辑）
   */
  setXiuLianForLoad(item: MagicItemInfo | null): void {
    this.xiuLianMagic = item;
    this.callbacks.onXiuLianMagicChange?.(item);
  }

  setNonReplaceMagicLevel(fileName: string, level: number): void {
    _setNonReplaceMagicLevel(this.expDeps, fileName, level);
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

  // ============= 替换武功列表功能（委托 MagicListReplace）=============

  private getActiveMagicList(): (MagicItemInfo | null)[] {
    return this.replace.getActiveList(this.magicList);
  }

  private getActiveMagicListHide(): (MagicItemInfo | null)[] {
    return this.replace.getActiveHideList(this.magicListHide);
  }

  isInReplaceMagicList(): boolean {
    return this.replace.isActive;
  }

  async replaceListTo(filePath: string, magicFileNames: string[]): Promise<void> {
    await this.replace.replaceListTo(filePath, magicFileNames);
    this.updateView();
  }

  stopReplace(): void {
    this.replace.stopReplace();
    this.updateView();
  }

  clearReplaceList(): void {
    this.replace.clear();
  }

  /**
   * 重新加载所有武功数据（用于热重载武功配置）
   * 保留等级和经验，但使用新的 MagicData 配置
   */
  async reloadAllMagics(): Promise<void> {
    let reloadCount = 0;

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

    if (this.currentMagicInUse?.magic) {
      const idx = this.getItemIndex(this.currentMagicInUse);
      if (idx > 0) {
        this.currentMagicInUse = this.getItemInfo(idx);
      }
    }

    if (this.xiuLianMagic?.magic) {
      const newMagic = getMagic(this.xiuLianMagic.magic.fileName);
      if (newMagic) {
        const levelMagic = getMagicAtLevel(newMagic, this.xiuLianMagic.level);
        this.xiuLianMagic.magic = levelMagic;
      }
      this.callbacks.onXiuLianMagicChange?.(this.xiuLianMagic);
    }

    this.updateView();
    logger.info(`[PlayerMagicInventory] Reloaded ${reloadCount} magics`);
  }

  serializeReplaceLists(): object {
    return this.replace.serialize();
  }

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
    await this.replace.deserialize(data);
    if (this.replace.isActive) {
      this.updateView();
    }
  }
}
