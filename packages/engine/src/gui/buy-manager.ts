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
 * IniFile=Goods-xxx.ini      物品配置文件
 * Number=1                   可购买数量(当NumberValid=1时有效)
 */

import type { Character } from "../character";
import { logger } from "../core/logger";
import { type Good, getGood } from "../player/goods";
import { getShopsData, type ApiShopData } from "../resource/resource-loader";

export interface ShopItemInfo {
  good: Good;
  count: number; // -1 表示无限数量
  price: number; // 自定义价格，0 表示使用物品自身价格
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

  // 回调函数
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

  /**
   * Set callbacks for messages and view updates
   */
  setCallbacks(callbacks: {
    onShowMessage?: (msg: string) => void;
    onUpdateView?: () => void;
  }): void {
    if (callbacks.onShowMessage) this.onShowMessage = callbacks.onShowMessage;
    if (callbacks.onUpdateView) this.onUpdateView = callbacks.onUpdateView;
  }

  /**
   * Get current state
   */
  getState(): BuyManagerState {
    return this.state;
  }

  /**
   * Check if shop is open
   */
  isOpen(): boolean {
    return this.state.isOpen;
  }

  /**
   * Get all goods as array for UI display
   */
  getGoodsArray(): (ShopItemInfo | null)[] {
    const result: (ShopItemInfo | null)[] = [];
    for (let i = 1; i <= this.state.goodTypeCount; i++) {
      result.push(this.state.goods.get(i) ?? null);
    }
    return result;
  }

  /**
   * Get good info by index (1-based)
   */
  getGoodInfo(index: number): ShopItemInfo | null {
    return this.state.goods.get(index) ?? null;
  }

  /**
   * Begin buying session
   */
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
      // 从 API 缓存数据中查找商店
      const shop = this.findShop(listFileName);
      if (!shop) {
        logger.error(`[BuyManager] Shop not found in API data: ${listFileName}`);
        return false;
      }

      // 使用 API 数据填充商店状态
      this.state.goodTypeCountAtStart = shop.items.length;
      this.state.goodTypeCount = this.state.goodTypeCountAtStart;
      this.state.numberValid = shop.numberValid;
      this.state.buyPercent = shop.buyPercent;
      this.state.recyclePercent = shop.recyclePercent;

      // Load goods from items
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

  /**
   * 从 API 缓存数据中查找商店
   * key 匹配规则：文件名忽略大小写，支持带/不带 .ini 后缀
   */
  private findShop(listFileName: string): ApiShopData | null {
    const shops = getShopsData();
    if (!shops) return null;

    const normalized = listFileName.toLowerCase().replace(/\.ini$/, "");
    return shops.find(s => s.key.toLowerCase().replace(/\.ini$/, "") === normalized) ?? null;
  }

  /**
   * End buying session
   */
  endBuy(): void {
    if (!this.state.isOpen) return;

    logger.log(`[BuyManager] Shop closed: ${this.state.fileName}`);
    this.state.isOpen = false;
    this.state = this.createDefaultState();
    this.onUpdateView?.();
  }

  /**
   * Buy a good
   * Returns true if purchase successful
   */
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

    // Check if sold out
    if (this.state.numberValid && itemInfo.count <= 0) {
      this.onShowMessage?.("该物品已售罄");
      return false;
    }

    // Calculate price: use item override if set, otherwise use good's cost
    const basePrice = itemInfo.price > 0 ? itemInfo.price : itemInfo.good.cost;
    const cost = Math.floor((basePrice * this.state.buyPercent) / 100);

    // Check if player has enough money
    if (playerMoney < cost) {
      this.onShowMessage?.("没有足够的钱！");
      return false;
    }

    // Try to add good to player
    const addResult = await addGoodToPlayer(itemInfo.good.fileName);
    if (!addResult) {
      this.onShowMessage?.("物品栏已满！");
      return false;
    }

    // Deduct money
    deductMoney(cost);

    // Decrease count if number is valid
    if (this.state.numberValid) {
      itemInfo.count--;
    }

    this.onUpdateView?.();
    return true;
  }

  /**
   * Add a good to shop (for selling player items)
   */
  addGood(good: Good): void {
    if (!good) return;

    // Check if good already exists
    for (const [, itemInfo] of this.state.goods) {
      if (itemInfo.good.fileName.toLowerCase() === good.fileName.toLowerCase()) {
        // Already exists, increase count if number valid
        if (this.state.numberValid) {
          itemInfo.count++;
          this.onUpdateView?.();
        }
        return;
      }
    }

    // Add as new item
    this.state.goodTypeCount++;
    this.state.goods.set(this.state.goodTypeCount, { good, count: 1, price: 0 });
    this.onUpdateView?.();
  }

  /**
   * Get buy percent (purchase price multiplier)
   */
  getBuyPercent(): number {
    return this.state.buyPercent;
  }

  /**
   * Get recycle percent (sell price multiplier)
   */
  getRecyclePercent(): number {
    return this.state.recyclePercent;
  }

  /**
   * Check if shop limits quantities
   */
  isNumberValid(): boolean {
    return this.state.numberValid;
  }

  /**
   * Check if player can sell goods to this shop
   */
  getCanSellSelfGoods(): boolean {
    return this.state.canSellSelfGoods;
  }
}
