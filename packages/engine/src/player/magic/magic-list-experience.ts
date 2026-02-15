/**
 * MagicListExperience — 武功经验与等级系统
 * 从 PlayerMagicInventory 中提取的职责模块
 */

import { logger } from "../../core/logger";
import { getGameConfig } from "../../data/game-data-api";
import { getMagicAtLevel } from "../../magic/magic-config-loader";
import type { MagicItemInfo } from "../../magic/types";
import type { MagicListCallbacks } from "./magic-list-config";
import type { MagicExpConfig } from "./player-magic-inventory";

/** MagicListExperience 所需的宿主上下文 */
export interface MagicListExpDeps {
  readonly magicExpConfig: MagicExpConfig;
  readonly callbacks: MagicListCallbacks;
  setMagicExpInitialized(v: boolean): void;
  isMagicExpInitialized(): boolean;
  getIndexByFileName(fileName: string): number;
  getActiveMagicList(): (MagicItemInfo | null)[];
  getMagicByFileName(fileName: string): MagicItemInfo | null;
  updateView(): void;
}

/**
 * 初始化武功经验配置（从 /api/config 加载）
 */
export function initializeMagicExp(deps: MagicListExpDeps): void {
  if (deps.isMagicExpInitialized()) return;

  const gameConfig = getGameConfig();
  if (!gameConfig?.magicExp) {
    logger.warn(`[PlayerMagicInventory] No magicExp in API config, using defaults`);
    return;
  }

  const { expByLevel, xiuLianMagicExpFraction, useMagicExpFraction } = gameConfig.magicExp;
  for (const entry of expByLevel) {
    deps.magicExpConfig.expByLevel.set(entry.level, entry.exp);
  }
  deps.magicExpConfig.xiuLianMagicExpFraction = xiuLianMagicExpFraction;
  deps.magicExpConfig.useMagicExpFraction = useMagicExpFraction;
  deps.setMagicExpInitialized(true);
  logger.log(
    `[PlayerMagicInventory] MagicExp loaded from API: ${deps.magicExpConfig.expByLevel.size} levels, xiuLian=${xiuLianMagicExpFraction}, useMagic=${useMagicExpFraction}`
  );
}

/**
 * 获取武功命中经验
 * Reference: Utils.GetMagicExp(hitedCharacterLevel)
 */
export function getMagicExp(deps: MagicListExpDeps, hitedCharacterLevel: number): number {
  const exp = deps.magicExpConfig.expByLevel.get(hitedCharacterLevel);
  if (exp !== undefined) {
    return exp;
  }
  // 如果没有对应等级，返回最大等级的经验
  let maxLevel = 0;
  let maxExp = 0;
  for (const [level, e] of deps.magicExpConfig.expByLevel) {
    if (level > maxLevel) {
      maxLevel = level;
      maxExp = e;
    }
  }
  return maxExp;
}

/**
 * 设置武功等级
 */
export function setMagicLevel(deps: MagicListExpDeps, fileName: string, level: number): void {
  const index = deps.getIndexByFileName(fileName);
  if (index === -1) return;

  const info = deps.getActiveMagicList()[index];
  if (!info?.magic) return;

  // 获取指定等级的武功数据
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

  deps.updateView();
}

/**
 * 增加武功经验（直接操作 MagicItemInfo 对象）
 * Reference C#: Player.AddMagicExp(MagicListManager.MagicItemInfo info, int amount)
 *
 * C# 始终通过对象引用直接操作，不做 fileName 查找，
 * 保证修炼武功和当前使用武功的经验一定加到正确的对象上。
 *
 * @returns 是否升级
 */
export function addMagicExpDirect(
  deps: Pick<MagicListExpDeps, "callbacks" | "updateView">,
  info: MagicItemInfo,
  expToAdd: number
): boolean {
  if (!info.magic) return false;

  // if (info.TheMagic.LevelupExp == 0) 已满级
  if (info.magic.levelupExp === 0) return false;

  // C#: if (amount == 0) return;
  if (expToAdd === 0) return false;

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
    if (deps.callbacks.onMagicLevelUp) {
      deps.callbacks.onMagicLevelUp(oldMagic, newMagic);
    }

    // Reference C#: if (info.TheMagic.LevelupExp == 0) info.Exp = levelupExp;
    // 满级时经验封顶为升级经验；非满级时保留累积经验（不重置）
    if (newMagic.levelupExp === 0) {
      info.exp = levelupExp;
    }

    logger.log(`[PlayerMagicInventory] Magic "${info.magic.name}" leveled up to ${info.level}`);
    deps.updateView();
    return true;
  }

  return false;
}

/**
 * 设置武功等级（脚本命令 SetMagicLevel）
 * PlayerMagicInventory.SetNonReplaceMagicLevel(fileName, level)
 *
 * 注意：这只影响主武功列表中的武功，不包括隐藏列表
 */
export function setNonReplaceMagicLevel(
  deps: MagicListExpDeps,
  fileName: string,
  level: number
): void {
  const info = deps.getMagicByFileName(fileName);
  if (!info?.magic) {
    logger.warn(`[PlayerMagicInventory] setNonReplaceMagicLevel: magic not found: ${fileName}`);
    return;
  }

  // 获取指定等级的武功数据
  const levelMagic = getMagicAtLevel(info.magic, level);
  if (!levelMagic) {
    logger.warn(
      `[PlayerMagicInventory] setNonReplaceMagicLevel: level ${level} not available for ${fileName}`
    );
    return;
  }

  // 更新武功数据和等级
  info.magic = levelMagic;
  info.level = level;
  // 设置经验为该等级的升级所需经验（表示已达到该等级）
  info.exp = level > 1 && levelMagic.levelupExp ? levelMagic.levelupExp : 0;

  logger.log(`[PlayerMagicInventory] setNonReplaceMagicLevel: ${fileName} -> level ${level}`);
  deps.updateView();
}
