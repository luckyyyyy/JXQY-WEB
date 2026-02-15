/**
 * MagicListReplace — 变身/变形时的武功列表临时替换系统
 *
 * 从 PlayerMagicInventory 提取，对应 C#: PlayerMagicInventory.ReplaceListTo / StopReplace
 */

import { logger } from "../../core/logger";
import { getMagic, getMagicAtLevel } from "../../magic/magic-config-loader";
import type { MagicItemInfo } from "../../magic/types";
import { createDefaultMagicItemInfo } from "../../magic/types";
import { ResourcePath } from "../../resource/resource-paths";
import { MAGIC_LIST_CONFIG } from "./magic-list-config";

/**
 * 替换武功列表管理器 — 持有变身状态和替换数据
 */
export class MagicListReplace {
  private _isActive = false;
  private _currentFilePath = "";
  private _lists: Map<string, (MagicItemInfo | null)[]> = new Map();
  private _hideLists: Map<string, (MagicItemInfo | null)[]> = new Map();

  get isActive(): boolean {
    return this._isActive;
  }

  /**
   * 获取当前活动的武功列表（考虑是否在替换状态）
   */
  getActiveList(fallback: (MagicItemInfo | null)[]): (MagicItemInfo | null)[] {
    if (this._isActive && this._currentFilePath) {
      return this._lists.get(this._currentFilePath) || fallback;
    }
    return fallback;
  }

  /**
   * 获取当前活动的隐藏武功列表
   */
  getActiveHideList(fallback: (MagicItemInfo | null)[]): (MagicItemInfo | null)[] {
    if (this._isActive && this._currentFilePath) {
      return this._hideLists.get(this._currentFilePath) || fallback;
    }
    return fallback;
  }

  /**
   * 替换武功列表
   * @param filePath 用于存储的文件路径（作为唯一标识）
   * @param magicFileNames 武功文件名列表
   */
  async replaceListTo(filePath: string, magicFileNames: string[]): Promise<void> {
    this._isActive = true;
    this._currentFilePath = filePath;

    if (this._lists.has(filePath)) {
      logger.debug(`[MagicListReplace] ReplaceListTo: using existing list for ${filePath}`);
      return;
    }

    // 创建新的替换列表
    const size = MAGIC_LIST_CONFIG.maxMagic + 1;
    const newList: (MagicItemInfo | null)[] = new Array(size).fill(null);
    const newHideList: (MagicItemInfo | null)[] = new Array(size).fill(null);

    let listI = 0;

    // 填充快捷栏 (BottomIndex)
    for (let i = MAGIC_LIST_CONFIG.bottomIndexBegin; i <= MAGIC_LIST_CONFIG.bottomIndexEnd; i++) {
      if (listI >= magicFileNames.length) break;
      const magic = getMagic(ResourcePath.magic(magicFileNames[listI]));
      if (magic) {
        newList[i] = createDefaultMagicItemInfo(magic, 1);
        newList[i]!.hideCount = 1;
      }
      listI++;
    }

    // 填充存储区 (StoreIndex)
    for (let i = MAGIC_LIST_CONFIG.storeIndexBegin; i <= MAGIC_LIST_CONFIG.storeIndexEnd; i++) {
      if (listI >= magicFileNames.length) break;
      const magic = getMagic(ResourcePath.magic(magicFileNames[listI]));
      if (magic) {
        newList[i] = createDefaultMagicItemInfo(magic, 1);
        newList[i]!.hideCount = 1;
      }
      listI++;
    }

    this._lists.set(filePath, newList);
    this._hideLists.set(filePath, newHideList);

    logger.log(
      `[MagicListReplace] ReplaceListTo: created new list for ${filePath} with ${magicFileNames.length} magics`
    );
  }

  /**
   * 停止替换，恢复原始武功列表
   */
  stopReplace(): void {
    this._isActive = false;
    logger.log("[MagicListReplace] StopReplace: restored to original list");
  }

  /**
   * 清除所有替换列表
   */
  clear(): void {
    this._lists.clear();
    this._hideLists.clear();
    this._isActive = false;
    this._currentFilePath = "";
    logger.debug("[MagicListReplace] ClearReplaceList: all replacement lists cleared");
  }

  /**
   * 序列化替换列表（用于存档）
   */
  serialize(): object {
    const replaceLists: Record<string, object[]> = {};

    for (const [filePath, list] of this._lists.entries()) {
      const hideList = this._hideLists.get(filePath) || [];
      const data: object[] = [];

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
      isInReplaceMagicList: this._isActive,
      currentReplaceMagicListFilePath: this._currentFilePath,
      replaceLists,
    };
  }

  /**
   * 反序列化替换列表（从存档加载）
   */
  async deserialize(
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

    this._isActive = data.isInReplaceMagicList || false;
    this._currentFilePath = data.currentReplaceMagicListFilePath || "";

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

        this._lists.set(filePath, newList);
        this._hideLists.set(filePath, newHideList);
      }
    }

    logger.debug(`[MagicListReplace] Deserialized ${this._lists.size} replacement lists`);
  }
}
