/**
 * MagicListHide — 武功隐藏/显示系统
 * 从 PlayerMagicInventory 中提取的职责模块
 *
 * 装备 MagicIniWhenUse 时，原武功会被隐藏到 magicListHide，
 * 卸掉后通过 hideCount 计数归零恢复到主列表。
 */

import { logger } from "../../core/logger";
import { getMagic, getMagicAtLevel } from "../../magic/magic-config-loader";
import type { MagicData, MagicItemInfo } from "../../magic/types";
import { createDefaultMagicItemInfo } from "../../magic/types";
import { MAGIC_LIST_CONFIG, type MagicListCallbacks } from "./magic-list-config";

/** MagicListHide 所需的宿主上下文 */
export interface MagicListHideDeps {
  readonly magicList: (MagicItemInfo | null)[];
  readonly magicListHide: (MagicItemInfo | null)[];
  readonly callbacks: MagicListCallbacks;
  getCurrentMagicInUse(): MagicItemInfo | null;
  setCurrentMagicInUse(v: MagicItemInfo | null): void;
  getXiuLianMagic(): MagicItemInfo | null;
  setXiuLianMagicDirect(v: MagicItemInfo | null): void;
  indexInRange(index: number): boolean;
  getFreeIndex(): number;
  _placeMagicItemSync(index: number, itemInfo: MagicItemInfo, isHidden: boolean): void;
  _collectPreloadPromises(magic: MagicData | null): Promise<unknown>[];
  updateView(): void;
}

/**
 * 获取隐藏列表中的武功项信息
 * 用于存档保存时遍历隐藏武功
 */
export function getHiddenItemInfo(deps: MagicListHideDeps, index: number): MagicItemInfo | null {
  if (!deps.indexInRange(index)) return null;
  return deps.magicListHide[index];
}

/**
 * 添加武功到隐藏列表（用于读档恢复隐藏武功）
 * 参考 C# PlayerMagicInventory.LoadList 中 HideStartIndex 区域的加载逻辑
 */
export async function addHiddenMagic(
  deps: MagicListHideDeps,
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

  if (!deps.indexInRange(index)) {
    logger.warn(`[PlayerMagicInventory] Invalid hidden index: ${index}`);
    return false;
  }

  const magic = getMagic(fileName);
  if (!magic) {
    logger.warn(`[PlayerMagicInventory] Failed to load hidden magic: ${fileName}`);
    return false;
  }

  const levelMagic = getMagicAtLevel(magic, level);
  const itemInfo = createDefaultMagicItemInfo(levelMagic, level);
  itemInfo.exp = exp;
  itemInfo.hideCount = hideCount;
  itemInfo.lastIndexWhenHide = lastIndexWhenHide;

  deps._placeMagicItemSync(index, itemInfo, true);

  // 预加载武功的 ASF 资源
  const promises = deps._collectPreloadPromises(itemInfo.magic);
  if (promises.length > 0) {
    await Promise.all(promises);
  }

  logger.debug(
    `[PlayerMagicInventory] Added hidden magic "${magic.name}" Lv.${level} at hidden index ${index}`
  );
  return true;
}

/**
 * 批量添加隐藏武功 - 同步放置所有隐藏武功，然后并行预加载
 */
export async function addHiddenMagicBatch(
  deps: MagicListHideDeps,
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

    if (!deps.indexInRange(index)) {
      logger.warn(`[PlayerMagicInventory] Invalid hidden index: ${index}`);
      continue;
    }

    const magic = getMagic(fileName);
    if (!magic) {
      logger.warn(`[PlayerMagicInventory] Failed to load hidden magic: ${fileName}`);
      continue;
    }

    const levelMagic = getMagicAtLevel(magic, level);
    const itemInfo = createDefaultMagicItemInfo(levelMagic, level);
    itemInfo.exp = exp;
    itemInfo.hideCount = hideCount;
    itemInfo.lastIndexWhenHide = lastIndexWhenHide;

    // 同步放置到隐藏列表
    deps._placeMagicItemSync(index, itemInfo, true);

    // 收集预加载 Promise
    allPreloadPromises.push(...deps._collectPreloadPromises(itemInfo.magic));

    logger.debug(
      `[PlayerMagicInventory] Added hidden magic "${magic.name}" Lv.${level} at hidden index ${index}`
    );
  }

  // 并行预加载所有 ASF 资源
  if (allPreloadPromises.length > 0) {
    await Promise.all(allPreloadPromises);
  }
}

/**
 * 检查武功是否在隐藏列表中
 */
export function isMagicHided(deps: MagicListHideDeps, fileName: string): boolean {
  const lowerName = fileName.toLowerCase();
  const hideList = deps.magicListHide;
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
export function getNonReplaceMagic(
  deps: MagicListHideDeps,
  fileName: string
): MagicItemInfo | null {
  const lowerName = fileName.toLowerCase();

  // 先在主列表查找
  for (let i = 1; i <= MAGIC_LIST_CONFIG.maxMagic; i++) {
    const info = deps.magicList[i];
    if (info?.magic && info.magic.fileName.toLowerCase() === lowerName) {
      return info;
    }
  }

  // 再在隐藏列表查找
  for (let i = 1; i <= MAGIC_LIST_CONFIG.maxMagic; i++) {
    const info = deps.magicListHide[i];
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
export function setMagicHide(
  deps: MagicListHideDeps,
  fileName: string,
  hide: boolean
): MagicItemInfo | null {
  const lowerName = fileName.toLowerCase();

  if (hide) {
    // 从主列表移动到隐藏列表
    for (let i = 1; i <= MAGIC_LIST_CONFIG.maxMagic; i++) {
      const info = deps.magicList[i];
      if (info?.magic && info.magic.fileName.toLowerCase() === lowerName) {
        // 增加隐藏计数
        info.hideCount = (info.hideCount || 0) + 1;

        // 如果是第一次隐藏，移动到隐藏列表
        if (info.hideCount === 1) {
          info.lastIndexWhenHide = i;
          deps.magicList[i] = null;

          // 找隐藏列表的空位
          let hideIndex = -1;
          for (let j = 1; j <= MAGIC_LIST_CONFIG.maxMagic; j++) {
            if (!deps.magicListHide[j]) {
              hideIndex = j;
              break;
            }
          }
          if (hideIndex !== -1) {
            deps.magicListHide[hideIndex] = info;
          }

          // 如果是当前使用或修炼武功，清除
          if (deps.getCurrentMagicInUse() === info) {
            deps.setCurrentMagicInUse(null);
          }
          if (deps.getXiuLianMagic() === info) {
            deps.setXiuLianMagicDirect(null);
            deps.callbacks.onXiuLianMagicChange?.(null);
          }

          deps.updateView();
        }
        return info;
      }
    }

    // 检查是否已经在隐藏列表中，只增加计数
    for (let i = 1; i <= MAGIC_LIST_CONFIG.maxMagic; i++) {
      const info = deps.magicListHide[i];
      if (info?.magic && info.magic.fileName.toLowerCase() === lowerName) {
        info.hideCount = (info.hideCount || 0) + 1;
        return info;
      }
    }
  } else {
    // 从隐藏列表移动到主列表
    for (let i = 1; i <= MAGIC_LIST_CONFIG.maxMagic; i++) {
      const info = deps.magicListHide[i];
      if (info?.magic && info.magic.fileName.toLowerCase() === lowerName) {
        // 减少隐藏计数
        info.hideCount = Math.max(0, (info.hideCount || 1) - 1);

        // 如果隐藏计数归零，移回主列表
        if (info.hideCount === 0) {
          deps.magicListHide[i] = null;

          // 尝试恢复到原位置
          let targetIndex = info.lastIndexWhenHide || -1;
          if (targetIndex === -1 || deps.magicList[targetIndex]) {
            // 原位置被占用，找空位
            targetIndex = deps.getFreeIndex();
          }
          if (targetIndex !== -1) {
            deps.magicList[targetIndex] = info;
          }

          deps.updateView();
        }
        return info;
      }
    }
  }

  return null;
}
