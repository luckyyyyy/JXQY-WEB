/**
 * Character Profile Loader
 *
 * 负责将主角/伙伴的属性、武功、物品、备忘录在 CharacterProfileStore 与运行时实例之间互相转换。
 * 替代旧的 CharacterMemoryManager + Npc.applyPartnerRegistry/collectPartnerRegistry。
 */

import {
  applyFlatDataToCharacter,
  extractFlatDataFromCharacter,
} from "../character/character-config";
import { logger } from "../core/logger";
import { getPlayersData } from "../data/game-data-api";
import type { MemoListManager } from "../gui/memo-list-manager";
import type { Npc } from "../npc/npc";
import type { Player } from "../player/player";
import type { CharacterProfileStore } from "./character-profile-store";
import {
  findApiPlayerByIndex,
  loadGoodsContainer,
  loadGoodsFromJSON,
  loadMagicContainer,
  loadMagicsFromJSON,
  loadPlayerFromJSON,
} from "./loader-data-helpers";
import { SaveDataCollector } from "./save-data-collector";
import type { GoodsItemData, MagicItemData, PlayerSaveData } from "./save-types";

export interface CharacterProfileLoaderDeps {
  player: Player;
  memoListManager: MemoListManager;
}

export class CharacterProfileLoader {
  constructor(
    private readonly deps: CharacterProfileLoaderDeps,
    private readonly store: CharacterProfileStore
  ) {}

  private resolveNpcKey(npcName: string): string {
    const players = getPlayersData();
    const apiPlayer = players?.find((p) => p.name === npcName);
    return apiPlayer ? `idx:${apiPlayer.index}` : `name:${npcName}`;
  }

  /** 将当前主角数据快照写入 profile["idx:<playerIndex>"] */
  flushPlayerToProfile(): void {
    const { player, memoListManager } = this.deps;
    const key = `idx:${player.playerIndex}`;
    const profile = this.store.getOrCreate(key);
    profile.player = SaveDataCollector.collectPlayerData(player);
    profile.magicContainer = SaveDataCollector.collectMagicContainer(
      player.getPlayerMagicInventory()
    );
    profile.goodsContainer = SaveDataCollector.collectGoodsContainer(player.getGoodsListManager());
    profile.memo = memoListManager.getItems().slice();
    logger.log(`[ProfileLoader] flushPlayerToProfile key=${key}`);
  }

  /** 从 profile["idx:<playerIndex>"] 恢复主角；若 profile 不存在则回退到 API 初始化 */
  async loadProfileToPlayer(): Promise<void> {
    const { player, memoListManager } = this.deps;
    const index = player.playerIndex;
    const key = `idx:${index}`;
    const profile = this.store.get(key);

    // 预设 NpcIni（必须在加载武功列表之前设置）
    const npcIni = profile?.player?.npcIni ?? findApiPlayerByIndex(index)?.npcIni;
    if (npcIni) {
      await player.setNpcIni(npcIni);
      logger.debug(`[ProfileLoader] Pre-set NpcIni: ${npcIni}`);
    }

    const magicInventory = player.getPlayerMagicInventory();
    const goodsListManager = player.getGoodsListManager();
    magicInventory.stopReplace();
    magicInventory.clearReplaceList();
    goodsListManager.renewList();
    magicInventory.renewList();

    // 武功容器
    if (profile?.magicContainer) {
      try {
        await loadMagicContainer(profile.magicContainer, magicInventory);
      } catch (e) {
        logger.warn("[ProfileLoader] Failed to load magic container from profile:", e);
      }
    } else {
      const apiPlayer = findApiPlayerByIndex(index);
      if (apiPlayer?.initialMagics && apiPlayer.initialMagics.length > 0) {
        const magicItems: MagicItemData[] = apiPlayer.initialMagics.map((m, i) => ({
          fileName: m.iniFile,
          level: m.level,
          exp: m.exp,
          index: m.index ?? i + 1,
        }));
        await loadMagicsFromJSON(magicItems, 0, magicInventory);
      }
    }

    // 物品容器
    if (profile?.goodsContainer) {
      try {
        loadGoodsContainer(profile.goodsContainer, goodsListManager);
      } catch (e) {
        logger.warn("[ProfileLoader] Failed to load goods container from profile:", e);
      }
    } else {
      const apiPlayer = findApiPlayerByIndex(index);
      if (apiPlayer?.initialGoods && apiPlayer.initialGoods.length > 0) {
        const goodsItems: GoodsItemData[] = apiPlayer.initialGoods.map((g) => ({
          fileName: g.iniFile,
          count: g.number,
          index: g.index,
        }));
        loadGoodsFromJSON(goodsItems, [], goodsListManager);
      }
    }

    // 玩家本体
    if (profile?.player) {
      try {
        await loadPlayerFromJSON(profile.player, player);
        if (profile.player.npcIni) {
          await player.loadSpritesFromNpcIni(profile.player.npcIni);
        }
      } catch (e) {
        logger.error("[ProfileLoader] Failed to load player from profile:", e);
      }
    } else {
      const apiPlayer = findApiPlayerByIndex(index);
      if (apiPlayer) {
        try {
          await player.loadFromApiData(apiPlayer);
          await player.loadSpritesFromNpcIni(apiPlayer.npcIni);
        } catch (e) {
          logger.error("[ProfileLoader] Failed to load player from API data:", e);
        }
      }
    }

    goodsListManager.applyEquipSpecialEffectFromList();
    player.loadMagicEffect();
    player.recalculateBaseStats();

    if (profile?.memo) {
      memoListManager.renewList();
      memoListManager.bulkLoadItems(profile.memo);
    }

    logger.log(`[ProfileLoader] loadProfileToPlayer key=${key} hasProfile=${!!profile}`);
  }

  /** 将伙伴运行时数据写入 profile */
  flushNpcToProfile(npc: Npc): void {
    if (!npc.magicInventory && !npc.goodsManager) return;
    const key = this.resolveNpcKey(npc.name);
    const profile = this.store.getOrCreate(key);

    // 存全量（含 name/npcIni 等身份字段），过滤只在 apply-to-NPC 时做。
    // 这样后续 PlayerChange 走 loadProfileToPlayer 能拿到完整身份。
    const base = extractFlatDataFromCharacter(npc, true);
    base.dir = npc.currentDirection;
    profile.player = base as unknown as PlayerSaveData;

    profile.magicContainer = npc.magicInventory
      ? SaveDataCollector.collectMagicContainer(npc.magicInventory)
      : { panelMagics: [], xiuLianMagic: null, bottomMagics: [], hiddenMagics: [] };
    profile.goodsContainer = npc.goodsManager
      ? SaveDataCollector.collectGoodsContainer(npc.goodsManager)
      : { bagItems: [], equipItems: [], bottomItems: [] };

    const magicCount = profile.magicContainer.panelMagics.filter(Boolean).length;
    logger.log(`[ProfileLoader] flushNpcToProfile key=${key} magics=${magicCount}`);
  }

  /**
   * 这些字段属于"当前场景/身份"运行时状态，不应被档案覆盖。
   * 入队/换主角时 NPC 已经由 LoadNpc + SetNpcPos + SetNpcKind + SetNpcScript 设置好了
   * 名字、kind、脚本、位置、方向、AI 状态，档案只负责恢复成长性数据
   * （等级、经验、属性上限/当前值、武功、物品装备）。
   */
  private static readonly SCENE_OVERWRITE_BLACKLIST = new Set<string>([
    "name",
    "npcIni",
    "kind",
    "relation",
    "group",
    "fixedPos",
    "currentFixedPosIndex",
    "scriptFile",
    "scriptFileRight",
    "deathScript",
    "timerScriptFile",
    "timerScriptInterval",
    "aiType",
    "pathFinder",
    "noAutoAttackPlayer",
    "stopFindingTarget",
    "mapX",
    "mapY",
    "dir",
    "state",
    "action",
    "destinationMapPosX",
    "destinationMapPosY",
    "isDeath",
    "isDeathInvoked",
    "leftMillisecondsToRevive",
    "isBodyIniAdded",
    "visibleVariableName",
    "visibleVariableValue",
  ]);

  private filterProfileForNpcApply(data: Record<string, unknown>): Record<string, unknown> {
    const blacklist = CharacterProfileLoader.SCENE_OVERWRITE_BLACKLIST;
    const filtered: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(data)) {
      if (!blacklist.has(k)) filtered[k] = v;
    }
    return filtered;
  }

  /** 从 profile 恢复伙伴；若 profile 不存在则回退到 API 初始化 */
  async loadProfileToNpc(npc: Npc): Promise<void> {
    const key = this.resolveNpcKey(npc.name);
    const profile = this.store.get(key);

    npc.initPartnerContainers();

    if (profile?.player) {
      const filtered = this.filterProfileForNpcApply(
        profile.player as unknown as Record<string, unknown>
      );
      applyFlatDataToCharacter(filtered, npc, false);
      npc.applyConfigSetters();
    }

    if (profile?.magicContainer && npc.magicInventory) {
      await loadMagicContainer(profile.magicContainer, npc.magicInventory);
      const count = npc.magicInventory.getStoreMagics().filter((m) => m?.magic).length;
      logger.log(`[ProfileLoader] loadProfileToNpc key=${key}: ${count} magics from profile`);
    } else if (!profile) {
      // 回退到 API 初始化
      const players = getPlayersData();
      const apiPlayer = players?.find((p) => p.name === npc.name);
      if (apiPlayer) {
        if (apiPlayer.initialMagics && apiPlayer.initialMagics.length > 0 && npc.magicInventory) {
          const magicItems: MagicItemData[] = apiPlayer.initialMagics.map((m, i) => ({
            fileName: m.iniFile,
            level: m.level,
            exp: m.exp,
            index: m.index ?? i + 1,
          }));
          await loadMagicsFromJSON(magicItems, 0, npc.magicInventory);
        }
        if (apiPlayer.initialGoods && apiPlayer.initialGoods.length > 0 && npc.goodsManager) {
          const goodsItems: GoodsItemData[] = apiPlayer.initialGoods.map((g) => ({
            fileName: g.iniFile,
            count: g.number,
            index: g.index,
          }));
          loadGoodsFromJSON(goodsItems, [], npc.goodsManager);
        }
        if (apiPlayer.level) {
          npc.level = apiPlayer.level;
          npc.recalculateBaseStats();
          npc.life = npc.lifeMax;
          npc.thew = npc.thewMax;
          npc.mana = npc.manaMax;
        }
        logger.log(`[ProfileLoader] loadProfileToNpc key=${key}: initialized from API`);
      } else {
        logger.log(`[ProfileLoader] loadProfileToNpc key=${key}: no profile and no API data`);
      }
      return;
    }

    if (profile?.goodsContainer && npc.goodsManager) {
      loadGoodsContainer(profile.goodsContainer, npc.goodsManager);
    }

    // loadGoodsContainer 触发 onEquiping 回调会用 += 重复叠加装备属性，
    // 这里用 recalculateBaseStats() 从等级表干净基础值重新计算，覆盖掉重复部分
    npc.recalculateBaseStats();
  }
}
