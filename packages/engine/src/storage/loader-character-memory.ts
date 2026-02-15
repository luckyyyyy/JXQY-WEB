/**
 * Character Memory Manager
 *
 * 多角色切换时的内存存储管理，从 loader.ts 提取。
 * 负责在角色切换时保存/加载玩家、武功、物品、备忘录数据。
 *
 * Reference: JxqyHD/Engine/Storage/Loader.cs (ChangePlayer 相关)
 */

import { logger } from "../core/logger";
import type { MemoListManager } from "../gui/memo-list-manager";
import type { Player } from "../player/player";
import type { CharacterMemoryStore } from "./character-memory-store";
import {
  findApiPlayerByIndex,
  loadGoodsFromJSON,
  loadMagicsFromJSON,
  loadPlayerFromJSON,
} from "./loader-data-helpers";
import { SaveDataCollector } from "./save-data-collector";
import type { GoodsItemData, MagicItemData } from "./save-types";

export interface CharacterMemoryDeps {
  player: Player;
  memoListManager: MemoListManager;
}

export class CharacterMemoryManager {
  constructor(
    private deps: CharacterMemoryDeps,
    private store: CharacterMemoryStore
  ) {}

  /**
   * 保存当前玩家数据到内存
   * -> 保存到 Player{index}.ini
   *
   * Web 版使用内存存储，不使用 localStorage
   * 避免跨存档污染
   */
  private savePlayerToMemory(): void {
    const { player } = this.deps;
    const index = player.playerIndex;

    const playerData = SaveDataCollector.collectPlayerData(player);

    // 获取或创建内存存储
    const memoryData = this.store.getOrCreate(index);
    memoryData.player = playerData;

    logger.log(`[Loader] SavePlayer: saved to memory (index=${index})`);
  }

  /**
   * 保存当前武功/物品/备忘录到内存
   * Reference: Saver.SaveMagicGoodMemoList()
   */
  private saveMagicGoodMemoListToMemory(): void {
    const { player, memoListManager } = this.deps;
    const goodsListManager = player.getGoodsListManager();
    const magicInventory = player.getPlayerMagicInventory();
    const index = player.playerIndex;

    // 获取或创建内存存储
    const memoryData = this.store.getOrCreate(index);

    // 保存武功列表
    memoryData.magics = {
      items: SaveDataCollector.collectMagicsData(magicInventory),
      xiuLianIndex: magicInventory.getXiuLianIndex(),
      replaceLists: magicInventory.serializeReplaceLists(),
    };

    // 保存物品列表
    memoryData.goods = {
      items: SaveDataCollector.collectGoodsData(goodsListManager),
      equips: SaveDataCollector.collectEquipsData(goodsListManager),
    };

    // 保存备忘录
    memoryData.memo = { items: memoListManager.getItems() };

    logger.log(`[Loader] SaveMagicGoodMemoList: saved to memory (index=${index})`);
  }

  /**
   * 加载武功和物品列表
   * Reference: Loader.LoadMagicGoodList()
   *
   * 优先从内存加载，如果内存为空则从资源文件加载初始数据
   * = save/game/Magic{index}.ini
   * = save/game/Good{index}.ini
   */
  private async loadMagicGoodListFromMemory(): Promise<void> {
    const { player } = this.deps;
    const goodsListManager = player.getGoodsListManager();
    const magicInventory = player.getPlayerMagicInventory();
    const index = player.playerIndex;

    // Reference: PlayerMagicInventory.StopReplace() + ClearReplaceList()
    magicInventory.stopReplace();
    magicInventory.clearReplaceList();

    // 必须先清空旧列表，确保即使新角色没有数据，旧角色物品/武功也不会残留
    goodsListManager.renewList();
    magicInventory.renewList();

    // 获取内存存储
    const memoryData = this.store.get(index);

    // 加载武功列表
    let magicLoaded = false;

    if (memoryData?.magics) {
      try {
        const magicData = memoryData.magics;
        // 使用现有的 loadMagicsFromJSON 方法
        if (magicData.items) {
          await loadMagicsFromJSON(magicData.items, magicData.xiuLianIndex ?? 0, magicInventory);
          magicLoaded = true;
        }
        // 恢复替换列表
        if (magicData.replaceLists) {
          magicInventory.deserializeReplaceLists(magicData.replaceLists);
        }
      } catch (e) {
        logger.warn(`[Loader] Failed to load magic list from memory:`, e);
      }
    }

    if (!magicLoaded) {
      // 尝试从 API 数据加载初始武功
      const apiPlayer = findApiPlayerByIndex(index);
      if (apiPlayer?.initialMagics && apiPlayer.initialMagics.length > 0) {
        try {
          const magicItems: MagicItemData[] = apiPlayer.initialMagics.map((m, i) => ({
            fileName: m.iniFile,
            level: m.level,
            exp: m.exp,
            index: i + 1, // 从 1 开始分配位置
          }));
          await loadMagicsFromJSON(magicItems, 0, magicInventory);
          magicLoaded = true;
          logger.log(
            `[Loader] LoadMagicList: loaded ${magicItems.length} magics from API data (index=${index})`
          );
        } catch (e) {
          logger.warn(`[Loader] Failed to load magic list from API data:`, e);
        }
      }
    }

    // 加载物品列表
    let goodsLoaded = false;

    if (memoryData?.goods) {
      try {
        const goodsData = memoryData.goods;
        // 使用现有的 loadGoodsFromJSON 方法
        if (goodsData.items) {
          loadGoodsFromJSON(goodsData.items, goodsData.equips ?? [], goodsListManager);
          goodsLoaded = true;
        }
      } catch (e) {
        logger.warn(`[Loader] Failed to load goods list from memory:`, e);
      }
    }

    if (!goodsLoaded) {
      // 尝试从 API 数据加载初始物品
      const apiPlayer = findApiPlayerByIndex(index);
      if (apiPlayer?.initialGoods && apiPlayer.initialGoods.length > 0) {
        try {
          const goodsItems: GoodsItemData[] = apiPlayer.initialGoods.map((g) => ({
            fileName: g.iniFile,
            count: g.number,
          }));
          loadGoodsFromJSON(goodsItems, [], goodsListManager);
          goodsLoaded = true;
          logger.log(
            `[Loader] LoadGoodsList: loaded ${goodsItems.length} goods from API data (index=${index})`
          );
        } catch (e) {
          logger.warn(`[Loader] Failed to load goods list from API data:`, e);
        }
      }
    }

    logger.log(
      `[Loader] LoadMagicGoodList: done (index=${index}, magic=${magicLoaded}, goods=${goodsLoaded})`
    );
  }

  /**
   * 加载玩家数据
   * Reference: Loader.LoadPlayer()
   *
   * 优先从内存加载，如果内存为空则从 API 数据加载
   */
  private async loadPlayerFromMemory(): Promise<void> {
    const { player } = this.deps;
    const goodsListManager = player.getGoodsListManager();
    const index = player.playerIndex;

    // 获取内存存储
    const memoryData = this.store.get(index);

    let loaded = false;

    if (memoryData?.player) {
      // 从内存加载
      try {
        await loadPlayerFromJSON(memoryData.player, player);
        // 重新加载角色精灵（ASF）
        // 在切换时会重新设置精灵
        if (memoryData.player.npcIni) {
          await player.loadSpritesFromNpcIni(memoryData.player.npcIni);
        }
        loaded = true;
        logger.log(`[Loader] LoadPlayer: loaded from memory (index=${index})`);
      } catch (e) {
        logger.error(`[Loader] Failed to load player from memory:`, e);
      }
    }

    if (!loaded) {
      // 尝试从 API 数据加载
      const apiPlayer = findApiPlayerByIndex(index);
      if (apiPlayer) {
        try {
          await player.loadFromApiData(apiPlayer);
          await player.loadSpritesFromNpcIni(apiPlayer.npcIni);
          loaded = true;
          logger.log(
            `[Loader] LoadPlayer: loaded from API data (index=${index}, key=${apiPlayer.key})`
          );
        } catch (e) {
          logger.error(`[Loader] Failed to load player from API data:`, e);
        }
      }
    }

    if (loaded) {
      // Reference: GoodsListManager.ApplyEquipSpecialEffectFromList(Globals.ThePlayer)
      goodsListManager.applyEquipSpecialEffectFromList();

      // Reference: Globals.ThePlayer.LoadMagicEffect()
      player.loadMagicEffect();
    }

    // GuiManager.StateInterface.Index = GuiManager.EquipInterface.Index = Globals.PlayerIndex;
    // Web 版 UI 响应式更新，playerIndex 变更会自动反映到 UI
    // 不需要显式通知
  }

  /**
   * 保存当前玩家数据到内存
   * 在切换角色前调用
   */
  saveCurrentPlayer(): void {
    logger.log(
      `[Loader] Saving current player (index ${this.deps.player.playerIndex}) to memory...`
    );
    // 保存当前玩家数据到内存
    this.savePlayerToMemory();
    // 保存武功/物品/备忘录到内存
    this.saveMagicGoodMemoListToMemory();
  }

  /**
   * 从内存加载玩家数据
   * 在切换角色后调用
   */
  async loadPlayerData(): Promise<void> {
    const { player } = this.deps;
    const index = player.playerIndex;
    logger.log(`[Loader] Loading player (index ${index}) data from memory...`);

    // 预设 NpcIniIndex（从内存或 API 数据中提取 npcIni）
    // 必须在加载武功列表之前设置，否则 SpecialAttackTexture 预加载会使用错误的索引
    const memoryData = this.store.get(index);
    const npcIni = memoryData?.player?.npcIni;
    if (npcIni) {
      await player.setNpcIni(npcIni);
      logger.debug(`[Loader] Pre-set NpcIni from memory: ${npcIni} (index=${player.npcIniIndex})`);
    } else {
      // 没有内存数据时，尝试从 API 数据获取 npcIni
      const apiPlayer = findApiPlayerByIndex(index);
      if (apiPlayer?.npcIni) {
        await player.setNpcIni(apiPlayer.npcIni);
        logger.debug(
          `[Loader] Pre-set NpcIni from API: ${apiPlayer.npcIni} (index=${player.npcIniIndex})`
        );
      }
    }

    // 加载新角色的武功/物品
    await this.loadMagicGoodListFromMemory();
    // 加载新角色
    await this.loadPlayerFromMemory();
  }
}
