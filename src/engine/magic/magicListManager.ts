/**
 * MagicListManager - based on JxqyHD Engine/ListManager/MagicListManager.cs
 * 管理玩家的武功列表
 */

import type { MagicData, MagicItemInfo } from "./types";
import { createDefaultMagicItemInfo } from "./types";
import { loadMagic, getMagicAtLevel } from "./magicLoader";
import { parseIni } from "../core/utils";

// 武功列表索引常量 - 对应 C# MagicListManager
export const MAGIC_LIST_CONFIG = {
  maxMagic: 49,               // 最大武功数量
  magicListIndexBegin: 1,     // 列表起始索引
  storeIndexBegin: 1,         // 存储区起始 (武功面板)
  storeIndexEnd: 36,          // 存储区结束
  bottomIndexBegin: 40,       // 快捷栏起始
  bottomIndexEnd: 44,         // 快捷栏结束 (5个槽位)
  xiuLianIndex: 49,           // 修炼武功索引
  hideStartIndex: 1000,       // 隐藏列表起始索引
};

// 回调类型
export interface MagicListCallbacks {
  onUpdateView?: () => void;
  onMagicUse?: (info: MagicItemInfo) => void;
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

  constructor() {
    const size = MAGIC_LIST_CONFIG.maxMagic + 1;
    this.magicList = new Array(size).fill(null);
    this.magicListHide = new Array(size).fill(null);
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

  /**
   * 清空列表
   */
  renewList(): void {
    for (let i = 0; i <= MAGIC_LIST_CONFIG.maxMagic; i++) {
      this.magicList[i] = null;
      this.magicListHide[i] = null;
    }
    this.currentMagicInUse = null;
    this.xiuLianMagic = null;
    this.updateView();
  }

  /**
   * 从配置文件加载玩家武功列表
   * 对应 C# MagicListManager.LoadPlayerList
   * @param filePath 配置文件路径，如 /resources/save/game/Magic0.ini
   */
  async loadPlayerList(filePath: string): Promise<boolean> {
    try {
      console.log(`[MagicListManager] Loading player magic list from ${filePath}...`);

      const response = await fetch(filePath);
      if (!response.ok) {
        console.warn(`[MagicListManager] Failed to fetch ${filePath}: ${response.status}`);
        return false;
      }

      const content = await response.text();
      const data = parseIni(content);

      // 清空列表
      this.renewList();

      // 遍历所有 section（数字索引）
      for (const sectionName in data) {
        if (sectionName === "Head") continue;

        const index = parseInt(sectionName, 10);
        if (isNaN(index)) continue;

        const section = data[sectionName];
        const iniFile = section["IniFile"];
        const level = parseInt(section["Level"] || "1", 10);
        const exp = parseInt(section["Exp"] || "0", 10);
        const hideCount = parseInt(section["HideCount"] || "0", 10);
        const lastIndexWhenHide = parseInt(section["LastIndexWhenHide"] || "0", 10);

        if (!iniFile) continue;

        // 根据索引判断放入主列表还是隐藏列表
        const isHidden = index >= MAGIC_LIST_CONFIG.hideStartIndex;
        const targetIndex = isHidden ? index - MAGIC_LIST_CONFIG.hideStartIndex : index;
        const targetList = isHidden ? this.magicListHide : this.magicList;

        if (targetIndex < 0 || targetIndex > MAGIC_LIST_CONFIG.maxMagic) continue;

        // 加载武功
        const magic = await loadMagic(`/resources/ini/magic/${iniFile}`);
        if (magic) {
          const levelMagic = getMagicAtLevel(magic, level);
          const itemInfo = createDefaultMagicItemInfo(levelMagic, level);
          itemInfo.exp = exp;
          itemInfo.hideCount = hideCount;
          itemInfo.lastIndexWhenHide = lastIndexWhenHide;

          targetList[targetIndex] = itemInfo;

          // 如果是修炼位置
          if (!isHidden && this.indexInXiuLianIndex(targetIndex)) {
            this.xiuLianMagic = itemInfo;
          }

          console.log(`[MagicListManager] Loaded magic "${magic.name}" Lv.${level} at index ${targetIndex}${isHidden ? ' (hidden)' : ''}`);
        }
      }

      this.updateView();
      console.log("[MagicListManager] Player magic list loaded successfully");
      return true;
    } catch (error) {
      console.error("[MagicListManager] Failed to load player magic list:", error);
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
   */
  getItemInfo(index: number): MagicItemInfo | null {
    if (!this.indexInRange(index)) return null;
    return this.magicList[index];
  }

  /**
   * 获取武功项的索引
   */
  getItemIndex(info: MagicItemInfo | null): number {
    if (!info) return 0;
    for (let i = MAGIC_LIST_CONFIG.magicListIndexBegin; i <= MAGIC_LIST_CONFIG.maxMagic; i++) {
      if (info === this.magicList[i]) {
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
    // 先检查存储区
    for (let i = MAGIC_LIST_CONFIG.storeIndexBegin; i <= MAGIC_LIST_CONFIG.storeIndexEnd; i++) {
      if (!this.magicList[i]) {
        return i;
      }
    }
    // 再检查快捷栏
    for (let i = MAGIC_LIST_CONFIG.bottomIndexBegin; i <= MAGIC_LIST_CONFIG.bottomIndexEnd; i++) {
      if (!this.magicList[i]) {
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
    for (let i = 1; i <= MAGIC_LIST_CONFIG.maxMagic; i++) {
      const info = this.magicList[i];
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
      return this.magicList[index];
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
      return [false, existingIndex, this.magicList[existingIndex]?.magic || null];
    }

    // 找空闲位置
    const index = this.getFreeIndex();
    if (index === -1) {
      console.warn("[MagicListManager] No free slot for magic");
      return [false, -1, null];
    }

    // 加载武功
    const magic = await loadMagic(fileName);
    if (!magic) {
      console.warn(`[MagicListManager] Failed to load magic: ${fileName}`);
      return [false, -1, null];
    }

    // 获取等级1的武功数据（合并Level1配置）
    // C# Reference: Magic.GetLevel() merges level-specific data
    const levelMagic = getMagicAtLevel(magic, 1);

    // 创建武功项
    const itemInfo = createDefaultMagicItemInfo(levelMagic, 1);
    this.magicList[index] = itemInfo;

    console.log(`[MagicListManager] Added magic "${magic.name}" at index ${index}, moveKind=${levelMagic.moveKind}, speed=${levelMagic.speed}`);
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
      console.warn(`[MagicListManager] Invalid index: ${targetIndex}`);
      return [false, -1, null];
    }

    // 加载武功
    const magic = await loadMagic(fileName);
    if (!magic) {
      console.warn(`[MagicListManager] Failed to load magic: ${fileName}`);
      return [false, -1, null];
    }

    // 获取指定等级的武功数据
    const levelMagic = getMagicAtLevel(magic, level);

    // 创建武功项
    const itemInfo = createDefaultMagicItemInfo(levelMagic, level);
    itemInfo.exp = exp;
    this.magicList[targetIndex] = itemInfo;

    // 如果是修炼位置
    if (this.indexInXiuLianIndex(targetIndex)) {
      this.xiuLianMagic = itemInfo;
    }

    console.log(`[MagicListManager] Added magic "${magic.name}" Lv.${level} at index ${targetIndex}`);
    this.updateView();

    return [true, targetIndex, levelMagic];
  }

  /**
   * 直接设置武功到指定位置
   */
  setMagicAt(index: number, magic: MagicData, level: number = 1): void {
    if (!this.indexInRange(index)) return;

    // 获取指定等级的武功数据
    const levelMagic = getMagicAtLevel(magic, level);
    const itemInfo = createDefaultMagicItemInfo(levelMagic, level);
    this.magicList[index] = itemInfo;

    // 如果是修炼位置
    if (this.indexInXiuLianIndex(index)) {
      this.xiuLianMagic = itemInfo;
    }

    this.updateView();
  }

  /**
   * 删除武功
   */
  deleteMagic(fileName: string): boolean {
    const index = this.getIndexByFileName(fileName);
    if (index === -1) return false;

    const info = this.magicList[index];
    if (info === this.currentMagicInUse) {
      this.currentMagicInUse = null;
    }
    if (info === this.xiuLianMagic) {
      this.xiuLianMagic = null;
    }

    this.magicList[index] = null;
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

    const temp = this.magicList[index1];
    this.magicList[index1] = this.magicList[index2];
    this.magicList[index2] = temp;

    // 检查当前使用的武功
    const inBottom1 = this.indexInBottomRange(index1);
    const inBottom2 = this.indexInBottomRange(index2);
    if (inBottom1 !== inBottom2) {
      if (this.currentMagicInUse === this.magicList[index1] ||
          this.currentMagicInUse === this.magicList[index2]) {
        // 快捷栏武功被交换出去，清除当前使用
        this.currentMagicInUse = null;
      }
    }

    // 检查修炼武功
    if (this.indexInXiuLianIndex(index1)) {
      this.xiuLianMagic = this.magicList[index1];
    }
    if (this.indexInXiuLianIndex(index2)) {
      this.xiuLianMagic = this.magicList[index2];
    }

    this.updateView();
  }

  /**
   * 设置武功等级
   */
  setMagicLevel(fileName: string, level: number): void {
    const index = this.getIndexByFileName(fileName);
    if (index === -1) return;

    const info = this.magicList[index];
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

    const info = this.magicList[index];
    if (!info || !info.magic) return false;

    info.exp += expToAdd;

    // 检查升级
    const levelupExp = info.magic.levelupExp;
    if (levelupExp > 0 && info.exp >= levelupExp && info.level < info.magic.maxLevel) {
      info.level++;
      info.exp = 0;
      // 获取新等级的武功数据
      if (info.magic.levels?.has(info.level)) {
        info.magic = getMagicAtLevel(info.magic, info.level);
      }
      console.log(`[MagicListManager] Magic "${info.magic.name}" leveled up to ${info.level}`);
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
    if (info && info.magic) {
      if (info.magic.disableUse !== 0) {
        console.log("[MagicListManager] This magic cannot be used");
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

    const info = this.magicList[listIndex];
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
   */
  setXiuLianMagic(info: MagicItemInfo | null): void {
    this.xiuLianMagic = info;
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
      this.xiuLianMagic = null;
    } else {
      this.xiuLianMagic = this.magicList[index];
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
    for (let i = 1; i <= MAGIC_LIST_CONFIG.maxMagic; i++) {
      const info = this.magicList[i];
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
    if (info && info.magic) {
      info.remainColdMilliseconds = info.magic.coldMilliSeconds;
      this.callbacks.onMagicUse?.(info);
    }
  }

  /**
   * 获取所有武功列表（用于UI显示）
   */
  getAllMagics(): (MagicItemInfo | null)[] {
    return [...this.magicList];
  }

  /**
   * 获取存储区武功（武功面板显示）
   */
  getStoreMagics(): (MagicItemInfo | null)[] {
    const result: (MagicItemInfo | null)[] = [];
    for (let i = MAGIC_LIST_CONFIG.storeIndexBegin; i <= MAGIC_LIST_CONFIG.storeIndexEnd; i++) {
      result.push(this.magicList[i]);
    }
    return result;
  }

  /**
   * 获取快捷栏武功
   */
  getBottomMagics(): (MagicItemInfo | null)[] {
    const result: (MagicItemInfo | null)[] = [];
    for (let i = MAGIC_LIST_CONFIG.bottomIndexBegin; i <= MAGIC_LIST_CONFIG.bottomIndexEnd; i++) {
      result.push(this.magicList[i]);
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
   * 直接添加武功对象到列表
   * @returns 是否添加成功
   */
  addMagic(magic: MagicData, level: number = 1): boolean {
    // 检查是否已存在
    const existingIndex = this.getIndexByFileName(magic.fileName);
    if (existingIndex !== -1) {
      console.log(`[MagicListManager] Magic "${magic.name}" already exists at index ${existingIndex}`);
      return false;
    }

    // 找空闲位置
    const index = this.getFreeIndex();
    if (index === -1) {
      console.warn("[MagicListManager] No free slot for magic");
      return false;
    }

    // 获取指定等级的武功数据
    const levelMagic = getMagicAtLevel(magic, level);
    const itemInfo = createDefaultMagicItemInfo(levelMagic, level);
    this.magicList[index] = itemInfo;

    console.log(`[MagicListManager] Added magic "${magic.name}" Lv.${level} at index ${index}`);
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
    const info = this.magicList[sourceIndex];
    if (!info) return false;

    // 找快捷栏空位
    for (let i = MAGIC_LIST_CONFIG.bottomIndexBegin; i <= MAGIC_LIST_CONFIG.bottomIndexEnd; i++) {
      if (!this.magicList[i]) {
        this.exchangeListItem(sourceIndex, i);
        return true;
      }
    }
    return false;
  }

  /**
   * 序列化（用于存档）
   */
  serialize(): object {
    const data: any[] = [];
    for (let i = 1; i <= MAGIC_LIST_CONFIG.maxMagic; i++) {
      const info = this.magicList[i];
      if (info && info.magic) {
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
}
