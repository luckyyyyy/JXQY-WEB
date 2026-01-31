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
import { parseIni } from "../core/utils";
import { Good, getGood } from "../player/goods";
import { resourceLoader } from "../resource/resourceLoader";
import { ResourcePath } from "@/config/resourcePaths";

export interface ShopItemInfo {
  good: Good;
  count: number; // -1 表示无限数量
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
   * C# Reference: BuyGui.BeginBuy
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
      // Load shop configuration
      // 先尝试从存档目录加载，再尝试 ini/buy/ 目录
      let content: string | null = null;
      const savePath = ResourcePath.saveGame(listFileName);
      const iniPath = ResourcePath.buy(listFileName);

      content = await resourceLoader.loadText(savePath);
      if (!content) {
        content = await resourceLoader.loadText(iniPath);
      }

      if (!content) {
        logger.error(`[BuyManager] Failed to load shop file: ${listFileName}`);
        return false;
      }

      // Parse INI content
      const data = parseIni(content);

      // Parse header
      const header = data.Header || data.header || {};
      this.state.goodTypeCountAtStart = parseInt(header.Count || "0", 10);
      this.state.goodTypeCount = this.state.goodTypeCountAtStart;
      this.state.numberValid = header.NumberValid === "1";
      this.state.buyPercent = parseInt(header.BuyPercent || "100", 10);
      this.state.recyclePercent = parseInt(header.RecyclePercent || "100", 10);

      // Load goods
      for (let i = 1; i <= this.state.goodTypeCountAtStart; i++) {
        const section = data[i.toString()] || {};
        const iniFile = section.IniFile || section.inifile || "";
        if (!iniFile) continue;

        let count = -1; // -1 表示无限
        if (this.state.numberValid) {
          count = parseInt(section.Number || "0", 10);
        }

        const good = await getGood(iniFile);
        if (good) {
          this.state.goods.set(i, { good, count });
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
   * End buying session
   * C# Reference: BuyGui.EndBuy
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
   * C# Reference: Player.BuyGood
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

    // Calculate price with buy percent
    const cost = Math.floor((itemInfo.good.cost * this.state.buyPercent) / 100);

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
   * C# Reference: BuyGui.AddGood
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
    this.state.goods.set(this.state.goodTypeCount, { good, count: 1 });
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
