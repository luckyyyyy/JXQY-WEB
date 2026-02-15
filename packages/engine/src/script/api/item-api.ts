/**
 * Item APIs - Good, Magic, Memo implementations
 */

import { logger } from "../../core/logger";
import { getShopsData } from "../../data/game-data-api";
import { getNeighbors, tileToPixel } from "../../utils";
import type { BlockingResolver } from "../blocking-resolver";
import type { GoodsAPI, MagicAPI, MemoAPI } from "./game-api";
import type { ScriptCommandContext } from "./types";

export function createGoodsAPI(ctx: ScriptCommandContext, resolver: BlockingResolver): GoodsAPI {
  const { player, guiManager, buyManager, goodsListManager, getCharacterByName } = ctx;

  return {
    add: (goodsName, count) => {
      let addedGood: { name: string } | null = null;
      for (let i = 0; i < count; i++) {
        const result = goodsListManager.addGoodToList(goodsName);
        if (result.success && result.good) {
          addedGood = result.good;
        }
      }
      if (addedGood) {
        guiManager.showMessage(`你获得了${addedGood.name}`);
      }
    },
    remove: (goodsName, count) => {
      goodsListManager.deleteGoodByName(goodsName, count);
    },
    equip: (goodsIndex, equipSlot) => {
      const equipIndex = equipSlot + 200;
      goodsListManager.exchangeListItemAndEquiping(goodsIndex, equipIndex);
    },
    getCountByFile: (goodsFile) => goodsListManager.getGoodsNum(goodsFile),
    getCountByName: (goodsName) => goodsListManager.getGoodsNumByName(goodsName),
    clear: () => {
      goodsListManager.renewList();
    },
    deleteByName: (name, count) => {
      goodsListManager.deleteGoodByName(name, count ?? 1);
    },
    hasFreeSpace: () => goodsListManager.hasFreeItemSpace(),
    addRandom: async (buyFileName) => {
      try {
        // 从 /api/data 缓存的商店配置中查找
        const shops = getShopsData();
        if (!shops) {
          logger.error(`[GameAPI.goods] addRandom: shops data not loaded`);
          return;
        }

        const normalized = buyFileName.toLowerCase().replace(/\.ini$/, "");
        const shop = shops.find((s) => s.key.toLowerCase().replace(/\.ini$/, "") === normalized);
        if (!shop) {
          logger.error(`[GameAPI.goods] addRandom: shop not found for key "${buyFileName}"`);
          return;
        }

        if (shop.items.length === 0) return;
        const randomItem = shop.items[Math.floor(Math.random() * shop.items.length)];
        const result = goodsListManager.addGoodToList(randomItem.goodsKey);
        if (result.success && result.good) {
          guiManager.showMessage(`你获得了${result.good.name}`);
        }
      } catch (error) {
        logger.error(`[GameAPI.goods] addRandom error:`, error);
      }
    },
    buy: async (buyFile, canSellSelfGoods) => {
      const success = await buyManager.beginBuy(buyFile, null, canSellSelfGoods);
      if (success) {
        guiManager.openBuyGui();
      }
      // Wait until buy UI is closed
      if (!buyManager.isOpen()) return;
      await resolver.waitForCondition(() => !buyManager.isOpen());
    },
    setDropIni: (name, dropFile) => {
      const character = getCharacterByName(name);
      if (character) {
        character.dropIni = dropFile;
      }
    },
    setDropEnabled: (enabled) => {
      if (enabled) ctx.enableDrop();
      else ctx.disableDrop();
    },
  };
}

export function createMagicAPI(ctx: ScriptCommandContext): MagicAPI {
  const { player } = ctx;

  return {
    add: async (magicFile) => {
      if (player) {
        await player.addMagic(magicFile);
      }
    },
    delete: (magicFile) => {
      if (player) {
        player.getPlayerMagicInventory().deleteMagic(magicFile);
      }
    },
    setLevel: (magicFile, level) => {
      player.getPlayerMagicInventory().setNonReplaceMagicLevel(magicFile, level);
    },
    getLevel: (magicFile) => {
      if (!player) return 0;
      const info = player.getPlayerMagicInventory().getMagicByFileName(magicFile);
      return info?.level || 0;
    },
    clear: () => {
      if (player) {
        player.getPlayerMagicInventory().renewList();
      }
    },
    hasFreeSpace: () => {
      if (!player) return false;
      return player.getPlayerMagicInventory().getFreeIndex() !== -1;
    },
    use: (magicFile, x, y) => {
      if (!player) return;
      const magicInfo = player.getPlayerMagicInventory().getMagicByFileName(magicFile);
      if (!magicInfo || !magicInfo.magic) return;
      let mapX = x ?? 0;
      let mapY = y ?? 0;
      if (x === undefined || y === undefined) {
        const neighbors = getNeighbors(player.tilePosition);
        const dest = neighbors[player.currentDirection];
        mapX = dest.x;
        mapY = dest.y;
      }
      const origin = player.positionInWorld;
      const destination = tileToPixel(mapX, mapY);
      player.setPendingMagic(magicInfo.magic, origin, destination);
      player.onMagicCast();
    },
  };
}

export function createMemoAPI(ctx: ScriptCommandContext): MemoAPI {
  const { guiManager, memoListManager } = ctx;

  return {
    add: (text) => {
      guiManager.addMemo(text);
    },
    delete: (text) => {
      guiManager.delMemo(text);
    },
    addById: async (id) => {
      await guiManager.addToMemo(id);
    },
    deleteById: async (id) => {
      await memoListManager.delMemoById(id);
      guiManager.updateMemoView();
    },
  };
}
