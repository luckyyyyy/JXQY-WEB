/**
 * BuyManager - based on JxqyHD Engine/Gui/BuyGui.cs
 * Manages shop state and buy/sell operations
 *
 * 商店配置文件格式 (resources/ini/buy/*.ini):
 * [Header]
 * Count=N                    物品种类数量
 * NumberValid=0/1            是否限制购买数量
 * BuyPercent=100             购买价格百分比
 * RecyclePercent=100         回收价格百分比
 *
 * [1]
 * IniFile=Good-xxx.ini      物品配置文件
 * Number=1                   可购买数量(当NumberValid=1时有效)
 */

import type { Shop } from "@miu2d/types";
import type { Character } from "../character";
import { logger } from "../core/logger";
import { getShopsData } from "../data/game-data-api";
import { type Good, getGood } from "../player/goods";

export interface ShopItemInfo {
  good: Good;
  count: number;
  price: number;
}

export interface BuyManagerState {
  isOpen: boolean;
  fileName: string;
  target: Character | null;
  goods: Map<number, ShopItemInfo>;
  goodTypeCount: number;
  goodTypeCountAtStart: number;
  numberValid: boolean;
  canSellSelfGoods: boolean;
  buyPercent: number;
  recyclePercent: number;
}

export class BuyManager {
  private state: BuyManagerState = this.createDefaultState();

  private onShowMessage: ((msg: string) => void) | null = null;
  private onUpdateView: (() => void) | null = null;

  private createDefaultState(): BuyManagerState {
    return {
      isOpen: false,
      fileName: "",
      target: null,
      goods: new Map(),
      goodTypeCount: 0,
      goodTypeCountAtStart: 0,
      numberValid: false,
      canSellSelfGoods: true,
      buyPercent: 100,
      recyclePercent: 100,
    };
  }

  setCallbacks(callbacks: {
    onShowMessage?: (msg: string) => void;
    onUpdateView?: () => void;
  }): void {
    if (callbacks.onShowMessage) this.onShowMessage = callbacks.onShowMessage;
    if (callbacks.onUpdateView) this.onUpdateView = callbacks.onUpdateView;
  }

  getState(): BuyManagerState {
    return this.state;
  }

  isOpen(): boolean {
    return this.state.isOpen;
  }

  getGoodsArray(): (ShopItemInfo | null)[] {
    const result: (ShopItemInfo | null)[] = [];
    for (let i = 1; i <= this.state.goodTypeCount; i++) {
      result.push(this.state.goods.get(i) ?? null);
    }
    return result;
  }

  getGoodInfo(index: number): ShopItemInfo | null {
    return this.state.goods.get(index) ?? null;
  }

  async beginBuy(
    listFileName: string,
    target: Character | null,
    canSellSelfGoods: boolean
  ): Promise<boolean> {
    this.state = this.createDefaultState();
    this.state.fileName = listFileName;
    this.state.target = target;
    this.state.canSellSelfGoods = canSellSelfGoods;

    try {
      const shop = this.findShop(listFileName);
      if (!shop) {
        logger.error(`[BuyManager] Shop not found in API data: ${listFileName}`);
        return false;
      }

      this.state.goodTypeCountAtStart = shop.items.length;
      this.state.goodTypeCount = this.state.goodTypeCountAtStart;
      this.state.numberValid = shop.numberValid ?? false;
      this.state.buyPercent = shop.buyPercent ?? 100;
      this.state.recyclePercent = shop.recyclePercent ?? 100;

      for (let i = 0; i < shop.items.length; i++) {
        const item = shop.items[i];
        const good = getGood(item.goodsKey);
        if (good) {
          this.state.goods.set(i + 1, { good, count: item.count, price: item.price ?? 0 });
        }
      }

      this.state.isOpen = true;
      logger.log(
        `[BuyManager] Shop opened: ${listFileName}, ${this.state.goodTypeCount} items, numberValid=${this.state.numberValid}`
      );
      this.onUpdateView?.();
      return true;
    } catch (error) {
      logger.error(`[BuyManager] Error loading shop: ${listFileName}`, error);
      return false;
    }
  }

  private findShop(listFileName: string): Shop | null {
    const shops = getShopsData();
    if (!shops) return null;

    const normalized = listFileName.toLowerCase().replace(/\.ini$/, "");
    return shops.find((s) => s.key.toLowerCase().replace(/\.ini$/, "") === normalized) ?? null;
  }

  endBuy(): void {
    if (!this.state.isOpen) return;

    logger.log(`[BuyManager] Shop closed: ${this.state.fileName}`);
    this.state.isOpen = false;
    this.state = this.createDefaultState();
    this.onUpdateView?.();
  }

  async buyGood(
    index: number,
    playerMoney: number,
    addGoodToPlayer: (fileName: string) => Promise<boolean> | boolean,
    deductMoney: (amount: number) => void
  ): Promise<boolean> {
    const itemInfo = this.state.goods.get(index);
    if (!itemInfo || !itemInfo.good) {
      return false;
    }

    if (this.state.numberValid && itemInfo.count <= 0) {
      this.onShowMessage?.("该物品已售罄");
      return false;
    }

    const basePrice = itemInfo.price > 0 ? itemInfo.price : itemInfo.good.cost;
    const cost = Math.floor((basePrice * (this.state.buyPercent || 100)) / 100);

    if (Number.isNaN(cost) || Number.isNaN(playerMoney)) {
      logger.error(`[BuyManager] Invalid cost(${cost}) or playerMoney(${playerMoney})`);
      return false;
    }

    if (playerMoney < cost) {
      this.onShowMessage?.("没有足够的钱！");
      return false;
    }

    const addResult = await addGoodToPlayer(itemInfo.good.fileName);
    if (!addResult) {
      this.onShowMessage?.("物品栏已满！");
      return false;
    }

    deductMoney(cost);

    if (this.state.numberValid) {
      itemInfo.count--;
    }

    this.onUpdateView?.();
    return true;
  }

  addGood(good: Good): void {
    if (!good) return;

    for (const [, itemInfo] of this.state.goods) {
      if (itemInfo.good.fileName.toLowerCase() === good.fileName.toLowerCase()) {
        if (this.state.numberValid) {
          itemInfo.count++;
          this.onUpdateView?.();
        }
        return;
      }
    }

    this.state.goodTypeCount++;
    this.state.goods.set(this.state.goodTypeCount, { good, count: 1, price: 0 });
    this.onUpdateView?.();
  }

  getBuyPercent(): number {
    return this.state.buyPercent;
  }

  getRecyclePercent(): number {
    return this.state.recyclePercent;
  }

  isNumberValid(): boolean {
    return this.state.numberValid;
  }

  getCanSellSelfGoods(): boolean {
    return this.state.canSellSelfGoods;
  }
}
