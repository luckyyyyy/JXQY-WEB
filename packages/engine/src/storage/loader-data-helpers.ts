/**
 * Loader Data Helpers
 *
 * 存档数据加载/序列化的纯函数，从 loader.ts 提取。
 * 每个函数接收明确的参数，不依赖 Loader 实例状态。
 */

import type { Player as PlayerType } from "@miu2d/types";
import { logger } from "../core/logger";
import { getPlayersData } from "../data/game-data-api";
import type { MapBase } from "../map/map-base";
import type { NpcManager } from "../npc";
import type { ObjManager } from "../obj";
import type { GoodsListManager } from "../player/goods";
import {
  BOTTOM_INDEX_BEGIN,
  BOTTOM_INDEX_END,
  EQUIP_INDEX_BEGIN,
} from "../player/goods/goods-list-manager";
import type { PlayerMagicInventory } from "../player/magic/player-magic-inventory";
import type { Player } from "../player/player";
import type {
  GoodsItemData,
  MagicItemData,
  NpcSaveItem,
  ObjSaveItem,
  PlayerSaveData,
  TrapGroupValue,
} from "./save-types";

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
 *
 * 会加载 LevelIni 配置
 * 这里需要异步加载等级配置文件（难度设置）
 */
export async function loadPlayerFromJSON(data: PlayerSaveData, player: Player): Promise<void> {
  player.loadFromSaveData(data);

  // 加载等级配置文件（如果存档中有保存）
  // case "LevelIni": -> Utils.GetLevelLists(@"ini\level\" + keyData.Value)
  // 等级配置从 API 按需加载，自动转小写请求
  if (data.levelIniFile) {
    await player.levelManager.setLevelFile(data.levelIniFile);
    logger.debug(`[Loader] Loaded player level config: ${data.levelIniFile}`);
  }
}

/**
 * 从 JSON 加载武功列表
 * 参考PlayerMagicInventory.LoadList
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

  // 旧存档兼容：检查未指定 index 但成功分配的情况（addMagicBatch 已处理）
  // 恢复 hideCount 在 addMagicBatch 中已通过 item.hideCount 参数处理
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

  // 设置修炼武功
  magicInventory.setXiuLianIndex(xiuLianIndex);
}

/**
 * 从 JSON 加载物品列表
 */
export function loadGoodsFromJSON(
  goods: GoodsItemData[],
  equips: (GoodsItemData | null)[],
  goodsListManager: GoodsListManager
): void {
  // 清空列表
  goodsListManager.renewList();

  // 加载背包物品和快捷栏物品
  for (const item of goods) {
    if (
      item.index !== undefined &&
      item.index >= BOTTOM_INDEX_BEGIN &&
      item.index <= BOTTOM_INDEX_END
    ) {
      // 快捷栏物品：使用指定索引
      goodsListManager.setItemAtIndex(item.index, item.fileName, item.count);
    } else {
      // 背包物品：自动分配位置
      goodsListManager.addGoodToListWithCount(item.fileName, item.count);
    }
  }

  // 加载装备
  for (let i = 0; i < equips.length; i++) {
    const equipItem = equips[i];
    if (equipItem) {
      const slotIndex = EQUIP_INDEX_BEGIN + i;
      goodsListManager.setItemAtIndex(slotIndex, equipItem.fileName, 1);
    }
  }
}

/**
 * 从存档数据恢复陷阱快照和分组
 * 陷阱基础配置已从 MMF 地图数据内嵌加载
 * 这里恢复运行时修改（脚本动态设置的陷阱）和已触发列表
 */
export function loadTrapsFromSave(
  snapshot: number[],
  groups: Record<string, TrapGroupValue> | undefined,
  map: MapBase
): void {
  map.loadTrapsFromSave(groups, snapshot);
}

/**
 * 从 JSON 存档数据创建所有 NPC
 *
 * 工作流程（参考NpcManager.Load）：
 * 1. 调用前已清空 npcManager
 * 2. 遍历存档数据，为每个 NPC 创建实例
 * 3. 加载对应的资源（npcres -> asf）
 *
 * Web 版本直接从 JSON 恢复
 */
export async function loadNpcsFromJSON(npcs: NpcSaveItem[], npcManager: NpcManager): Promise<void> {
  // 过滤掉已完全死亡的 NPC
  const validNpcs = npcs.filter((npcData) => {
    if (npcData.isDeath && npcData.isDeathInvoked) {
      logger.log(`[Loader] Skipping dead NPC: ${npcData.name}`);
      return false;
    }
    return true;
  });

  // 并行创建所有 NPC（每个 NPC 的精灵加载互不依赖）
  const results = await Promise.all(
    validNpcs.map(async (npcData) => {
      try {
        await npcManager.createNpcFromData(npcData as unknown as Record<string, unknown>);
        return true;
      } catch (error) {
        logger.error(`[Loader] Failed to create NPC ${npcData.name}:`, error);
        return false;
      }
    })
  );

  const loadedCount = results.filter(Boolean).length;
  logger.debug(`[Loader] Created ${loadedCount} NPCs from JSON save data`);
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

/** 收集陷阱快照（已触发的陷阱索引列表） */
export function collectTrapSnapshot(map: MapBase): number[] {
  return map.collectTrapDataForSave().ignoreList;
}

/** 收集陷阱分组（按地图名存储的陷阱配置） */
export function collectTrapGroups(map: MapBase): Record<string, TrapGroupValue> {
  return map.collectTrapDataForSave().mapTraps;
}
