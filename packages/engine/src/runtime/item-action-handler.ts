/**
 * Item Action Handler - 物品/商店操作处理器
 * 从 GameManager 提取，处理物品使用、购买、出售等 UI 操作
 */

import { logger } from "../core/logger";
import type { BuyManager } from "../gui/buy-manager";
import type { GuiManager } from "../gui/gui-manager";
import type { NpcManager } from "../npc";
import { GoodKind, type GoodsListManager } from "../player/goods";
import { getEquipSlotIndex } from "../player/goods/goods-list-manager";
import type { Player } from "../player/player";

export interface ItemActionDeps {
  player: Player;
  goodsListManager: GoodsListManager;
  buyManager: BuyManager;
  guiManager: GuiManager;
  npcManager: NpcManager;
}

/**
 * 物品/商店操作处理器
 */
export class ItemActionHandler {
  constructor(private deps: ItemActionDeps) {}

  /** 物品使用（消耗品/装备/任务道具） */
  handleUseItem(index: number): void {
    const { goodsListManager, player, npcManager } = this.deps;
    const entry = goodsListManager.getItemInfo(index);
    if (!entry?.good) return;
    const good = entry.good;
    if (good.kind === GoodKind.Equipment) {
      const equipIndex = getEquipSlotIndex(good.part);
      if (equipIndex > 0) {
        goodsListManager.exchangeListItemAndEquiping(index, equipIndex);
      }
    } else if (good.kind === GoodKind.Drug) {
      goodsListManager.usingGood(index);
      player.useDrug(good);
      if (good.followPartnerHasDrugEffect > 0) {
        npcManager.forEachPartner((partner) => partner.useDrug(good));
      }
    } else if (good.kind === GoodKind.Event) {
      goodsListManager.usingGood(index);
    }
  }

  /** 商店购买 */
  async handleBuyItem(shopIndex: number): Promise<boolean> {
    const { player, goodsListManager, buyManager } = this.deps;
    const currentMoney = player.money;
    if (Number.isNaN(currentMoney)) {
      logger.error(`[ItemAction] Player money is NaN, resetting to 0`);
      player.money = 0;
    }
    return buyManager.buyGood(
      shopIndex,
      player.money,
      (fileName) => goodsListManager.addGoodToList(fileName).success,
      (amount) => {
        if (!Number.isNaN(amount)) player.money -= amount;
      }
    );
  }

  /** 商店出售 */
  handleSellItem(bagIndex: number): void {
    const { player, goodsListManager, buyManager } = this.deps;
    const entry = goodsListManager.getItemInfo(bagIndex);
    if (entry?.good && entry.good.sellPrice > 0 && buyManager.getCanSellSelfGoods()) {
      player.money += entry.good.sellPrice;
      goodsListManager.deleteGood(entry.good.fileName);
      buyManager.addGood(entry.good);
    }
  }

  /** 关闭商店 */
  handleCloseShop(): void {
    this.deps.buyManager.endBuy();
    this.deps.guiManager.closeBuyGui();
  }
}
