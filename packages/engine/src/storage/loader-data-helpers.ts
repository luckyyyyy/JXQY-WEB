/**
 * Loader Data Helpers
 *
 * 存档数据加载/序列化的纯函数，从 loader.ts 提取。
 * 每个函数接收明确的参数，不依赖 Loader 实例状态。
 */

import type { Player as PlayerType } from "@miu2d/types";
import { logger } from "../core/logger";
import { getPlayersData } from "../data/game-data-api";
import { getMagic, getMagicAtLevel, preloadMagicAsf } from "../magic/magic-config-loader";
import type { MagicItemInfo } from "../magic/types";
import { createDefaultMagicItemInfo } from "../magic/types";
import type { MapBase } from "../map/map-base";
import type { NpcManager } from "../npc";
import type { ObjManager } from "../obj";
import type { GoodsListManager } from "../player/goods";
import { EquipPosition, getGood } from "../player/goods/good";
import type { PlayerMagicInventory } from "../player/magic/player-magic-inventory";
import type { Player } from "../player/player";
import { getViewTileDistance } from "../utils";
import type {
  GoodsContainerSave,
  GoodsItemData,
  MagicContainerSave,
  MagicItemData,
  NpcSaveItem,
  ObjSaveItem,
  PlayerSaveData,
  TrapGroupValue,
} from "./save-types";

// Equipment slot positions in order (Head=0..Foot=6), matches GoodsContainerSave.equipItems order
const EQUIP_POSITION_ORDER = [
  EquipPosition.Head,
  EquipPosition.Neck,
  EquipPosition.Body,
  EquipPosition.Back,
  EquipPosition.Hand,
  EquipPosition.Wrist,
  EquipPosition.Foot,
] as const;

/**
 * 从存档项构建 MagicItemInfo，同时收集预加载 Promise
 * 用于修炼武功、快捷栏武功等不经过 addMagicBatch 路径的场景
 */
function buildMagicItemInfo(
  item: { fileName: string; level: number; exp: number },
  preloads: Promise<void>[]
): MagicItemInfo | null {
  const magic = getMagic(item.fileName);
  if (!magic) return null;
  const levelMagic = getMagicAtLevel(magic, item.level);
  const itemInfo = createDefaultMagicItemInfo(levelMagic, item.level);
  itemInfo.exp = item.exp;
  preloads.push(preloadMagicAsf(levelMagic));
  return itemInfo;
}

// ============= API 数据查询 =============

/**
 * 从 API 数据中按 index 查找玩家数据
 * 用于 changePlayer 时从 API 加载目标角色配置
 */
export function findApiPlayerByIndex(index: number): PlayerType | null {
  const players = getPlayersData();
  if (!players) return null;
  return players.find((p) => p.index === index) ?? null;
}

// ============= 存档数据加载 =============

/**
 * 从 JSON 加载玩家数据
 * 委托给 Player.loadFromSaveData()
 */
export async function loadPlayerFromJSON(data: PlayerSaveData, player: Player): Promise<void> {
  player.loadFromSaveData(data);

  const maxLevel = player.levelManager.getMaxLevel();
  if (maxLevel > 0 && player.level >= maxLevel && (player.exp !== 0 || player.levelUpExp !== 0)) {
    logger.warn(
      `[Loader] ${player.name} 已达满级(${maxLevel})但存档 exp=${player.exp} levelUpExp=${player.levelUpExp}，已归零修正`
    );
    player.exp = 0;
    player.levelUpExp = 0;
  }
}

/**
 * 从 JSON 加载武功列表（旧格式兼容）
 * 用于新游戏初始化（从 API 数据加载初始武功）
 */
export async function loadMagicsFromJSON(
  magics: MagicItemData[],
  xiuLianIndex: number,
  magicInventory: PlayerMagicInventory
): Promise<void> {
  // 清空列表
  magicInventory.renewList();

  // 分离可见武功和隐藏武功
  const visibleMagics = magics.filter((m) => !m.isHidden);
  const hiddenMagics = magics.filter((m) => m.isHidden);

  // 批量加载可见武功（同步放置 + 并行预加载 ASF）
  const batchItems = visibleMagics.map((item) => ({
    fileName: item.fileName,
    index: (item.index ?? -1) > 0 ? item.index : undefined,
    level: item.level,
    exp: item.exp,
    hideCount: item.hideCount,
  }));
  const results = await magicInventory.addMagicBatch(batchItems);

  for (let i = 0; i < results.length; i++) {
    const [success, index] = results[i];
    if (!success && index === -1) {
      logger.warn(`[Loader] Failed to load magic ${visibleMagics[i].fileName}`);
    }
  }

  // 批量加载隐藏武功（同步放置 + 并行预加载 ASF）
  if (hiddenMagics.length > 0) {
    await magicInventory.addHiddenMagicBatch(
      hiddenMagics.map((item) => ({
        fileName: item.fileName,
        index: item.index,
        level: item.level,
        exp: item.exp,
        hideCount: item.hideCount ?? 0,
        lastIndexWhenHide: item.lastIndexWhenHide ?? 0,
      }))
    );
  }

  // 设置修炼武功（index=0 表示不设修炼武功）
  magicInventory.setXiuLianIndex(xiuLianIndex);
}

/**
 * 从 JSON 加载物品列表
 * 用于新游戏初始化（从 API 数据加载初始物品）
 */
export function loadGoodsFromJSON(
  goods: GoodsItemData[],
  equips: (GoodsItemData | null)[],
  goodsListManager: GoodsListManager
): void {
  // 清空列表
  goodsListManager.renewList();

  // 加载背包物品：自动分配位置
  for (const item of goods) {
    goodsListManager.addGoodToListWithCount(item.fileName, item.count);
  }

  // 加载装备（按 EquipPosition 顺序：Head=1..Foot=7）
  for (let i = 0; i < equips.length; i++) {
    const equipItem = equips[i];
    if (equipItem) {
      const good = getGood(equipItem.fileName);
      if (good) {
        goodsListManager.setEquipAtPosition(EQUIP_POSITION_ORDER[i], {
          good,
          count: 1,
          remainColdMilliseconds: 0,
        });
      }
    }
  }
}

/**
 * 从存档数据恢复陷阱状态
 * - groups.trap 重建 _groupTrap（跨地图持久覆盖表）
 * - snapshot.trap 重建 _snapshotTrap（当前地图运行时表）
 * 兼容旧存档：snapshot.trap 若为 number[]，按 {idx: ""} 恢复
 */
export function loadTrapsFromSave(
  snapshot: Record<number, string> | number[] | undefined,
  groups: Record<string, TrapGroupValue> | undefined,
  map: MapBase
): void {
  map.loadTrapsFromSave(groups, snapshot);
}

/**
 * 从 JSON 存档数据创建所有 NPC
 *
 * 工作流程：
 * 1. 调用前已清空 npcManager
 * 2. 遍历存档数据，为每个 NPC 创建实例
 * 3. 加载对应的资源（npcres -> asf）
 *
 * Web 版本直接从 JSON 恢复
 *
 * @param options.playerTile 玩家当前瓦片坐标，用于近/远 NPC 分流
 * @param options.nearThreshold 近距离阈值（瓦片数），默认 40（约 2 屏）
 * @param options.onProgress 近 NPC 每加载完一个时触发 (done, nearTotal)
 */
export async function loadNpcsFromJSON(
  npcs: NpcSaveItem[],
  npcManager: NpcManager,
  options?: {
    playerTile?: { x: number; y: number };
    nearThreshold?: number;
    onProgress?: (done: number, nearTotal: number) => void;
  }
): Promise<() => void> {
  const { playerTile, nearThreshold = 40, onProgress } = options ?? {};

  // 过滤掉已完全死亡的 NPC
  const validNpcs = npcs.filter((npcData) => {
    if (npcData.isDeath && npcData.isDeathInvoked) {
      logger.log(`[Loader] Skipping dead NPC: ${npcData.name}`);
      return false;
    }
    return true;
  });

  // 按距离分流：2 屏范围内立即加载，更远的后台静默加载
  let nearNpcs = validNpcs;
  const farNpcs: NpcSaveItem[] = [];

  if (playerTile) {
    nearNpcs = [];
    for (const npcData of validNpcs) {
      const dist = getViewTileDistance(playerTile, { x: npcData.mapX, y: npcData.mapY });
      if (dist <= nearThreshold) {
        nearNpcs.push(npcData);
      } else {
        farNpcs.push(npcData);
      }
    }
    if (farNpcs.length > 0) {
      logger.debug(
        `[Loader] NPC split — near: ${nearNpcs.length}, background: ${farNpcs.length} (threshold: ${nearThreshold} tiles)`
      );
    }
  }

  // 近距离 NPC：立即并行加载，每完成一个触发进度回调
  let nearDone = 0;
  const nearTotal = nearNpcs.length;

  const nearResults = await Promise.all(
    nearNpcs.map(async (npcData) => {
      try {
        await npcManager.createNpcFromData(npcData as unknown as Record<string, unknown>);
        onProgress?.(++nearDone, nearTotal);
        return true;
      } catch (error) {
        logger.error(`[Loader] Failed to create NPC ${npcData.name}:`, error);
        onProgress?.(++nearDone, nearTotal);
        return false;
      }
    })
  );

  logger.debug(`[Loader] Created ${nearResults.filter(Boolean).length}/${nearTotal} near NPCs`);

  // 返回后台加载启动函数，由调用方在所有并行任务完成后再触发，
  // 避免与玩家精灵加载争抢网络/解码资源。
  if (farNpcs.length === 0) {
    return () => {
      /* nothing to do */
    };
  }

  return () => {
    Promise.all(
      farNpcs.map(async (npcData) => {
        try {
          await npcManager.createNpcFromData(npcData as unknown as Record<string, unknown>);
          return true;
        } catch (error) {
          logger.warn(`[Loader] Background NPC load failed for ${npcData.name}:`, error);
          return false;
        }
      })
    )
      .then((results) => {
        logger.debug(
          `[Loader] Background loaded ${results.filter(Boolean).length}/${farNpcs.length} far NPCs`
        );
      })
      .catch((err: unknown) => {
        logger.warn(`[Loader] Background NPC loading error:`, err);
      });
  };
}

/**
 * 从 JSON 存档数据创建所有 Obj
 *
 * 工作流程（参考ObjManager.Load）：
 * 1. 调用前已清空 objManager
 * 2. 遍历存档数据，为每个 Obj 创建实例
 * 3. 加载对应的资源（objres -> asf）
 *
 * Web 版本直接从 JSON 恢复
 */
export async function loadObjsFromJSON(objs: ObjSaveItem[], objManager: ObjManager): Promise<void> {
  // 过滤掉已移除的物体
  const validObjs = objs.filter((objData) => {
    if (objData.isRemoved) {
      logger.log(`[Loader] Skipping removed Obj: ${objData.objName}`);
      return false;
    }
    return true;
  });

  // 并行创建所有 Obj（每个 Obj 的资源加载互不依赖）
  const results = await Promise.all(
    validObjs.map(async (objData) => {
      try {
        await objManager.createObjFromSaveData(objData);
        return true;
      } catch (error) {
        logger.error(`[Loader] Failed to create Obj ${objData.objName}:`, error);
        return false;
      }
    })
  );

  const loadedCount = results.filter(Boolean).length;
  logger.debug(`[Loader] Created ${loadedCount} Objs from JSON save data`);
}

// ============= 序列化工具 =============

/**
 * 将 Map<string, T[]> 转换为 Record<string, T[]> 用于存档序列化
 */
export function serializeGroups<T>(store: Map<string, T[]>): Record<string, T[]> | undefined {
  if (store.size === 0) return undefined;
  const result: Record<string, T[]> = {};
  for (const [key, value] of store) {
    result[key] = value;
  }
  return result;
}

/** 收集陷阱快照（当前地图运行时表） */
export function collectTrapSnapshot(map: MapBase): Record<number, string> {
  return map.collectTrapDataForSave().snapshot;
}

/** 收集陷阱分组（持久化覆盖表，按地图名存储） */
export function collectTrapGroups(map: MapBase): Record<string, TrapGroupValue> {
  return map.collectTrapDataForSave().groups;
}

/**
 * 从新格式武功容器存档加载
 */
export async function loadMagicContainer(
  container: MagicContainerSave,
  inventory: PlayerMagicInventory
): Promise<void> {
  inventory.renewList();

  // 加载面板武功
  const batchItems = container.panelMagics
    .map((item, i) =>
      item
        ? {
            fileName: item.fileName,
            index: i + 1, // 0-indexed → panel slot 1..maxMagic
            level: item.level,
            exp: item.exp,
            hideCount: item.hideCount,
          }
        : null
    )
    .filter((x): x is NonNullable<typeof x> => x !== null);

  await inventory.addMagicBatch(batchItems);

  // 加载修炼武功和快捷栏武功，并收集需要预加载的 ASF Promise
  // 这两类武功在新设计中不经过 addMagicBatch，需要单独预加载 ASF 资源
  const extraPreloads: Promise<void>[] = [];

  if (container.xiuLianMagic) {
    const itemInfo = buildMagicItemInfo(container.xiuLianMagic, extraPreloads);
    if (itemInfo) inventory.setXiuLianForLoad(itemInfo);
  }

  for (let s = 0; s < container.bottomMagics.length; s++) {
    const item = container.bottomMagics[s];
    if (!item) continue;
    const itemInfo = buildMagicItemInfo(item, extraPreloads);
    if (itemInfo) inventory.setBottomSlotForLoad(s, itemInfo);
  }

  // 并行预加载修炼武功和快捷栏武功的 ASF 资源
  if (extraPreloads.length > 0) {
    await Promise.all(extraPreloads);
  }

  // 加载隐藏武功
  if (container.hiddenMagics.length > 0) {
    await inventory.addHiddenMagicBatch(
      container.hiddenMagics.map((item, i) => ({
        fileName: item.fileName,
        index: i + 1,
        level: item.level,
        exp: item.exp,
        hideCount: item.hideCount ?? 0,
        lastIndexWhenHide: item.lastPanelSlot ?? 0,
      }))
    );
  }
}

/**
 * 从新格式物品容器存档加载
 */
export function loadGoodsContainer(container: GoodsContainerSave, manager: GoodsListManager): void {
  manager.renewList();

  // 加载背包物品
  for (const item of container.bagItems) {
    manager.addGoodToListWithCount(item.fileName, item.count);
  }

  // 加载装备（独立 equipSlots，0=Head..6=Foot）
  for (let i = 0; i < container.equipItems.length; i++) {
    const item = container.equipItems[i];
    if (item) {
      const good = getGood(item.fileName);
      if (good) {
        manager.setEquipAtPosition(EQUIP_POSITION_ORDER[i], {
          good,
          count: 1,
          remainColdMilliseconds: 0,
        });
      }
    }
  }

  // 加载快捷栏物品
  for (let s = 0; s < container.bottomItems.length; s++) {
    const item = container.bottomItems[s];
    if (item) {
      const good = getGood(item.fileName);
      if (good) {
        manager.setBottomItemAtSlot(s, { good, count: item.count, remainColdMilliseconds: 0 });
      }
    }
  }
}
