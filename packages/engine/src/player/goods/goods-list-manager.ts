/**
 * GoodsListManager - based on JxqyHD Engine/ListManager/GoodsListManager.cs
 * Manages player's inventory and equipment
 */

import { getEngineContext } from "../../core/engine-context";
import { logger } from "../../core/logger";
import { EquipPosition, Good, GoodKind, getGood } from "./good";

// ============= Constants =============
export const LIST_INDEX_BEGIN = 1;
export const STORE_INDEX_BEGIN = 1;
export const STORE_INDEX_END = 500;
export const EQUIP_SLOT_COUNT = 7; // Head, Neck, Body, Back, Hand, Wrist, Foot
export const BOTTOM_ITEMS_COUNT = 3;

/** Convert EquipPosition to 0-based equipSlots array index (-1 if invalid) */
export function equipPositionToSlotIndex(position: EquipPosition): number {
  if (position >= EquipPosition.Head && position <= EquipPosition.Foot) {
    return position - 1; // Head=1→0, Foot=7→6
  }
  return -1;
}

// ============= Types =============
export interface GoodsItemInfo {
  good: Good;
  count: number;
  remainColdMilliseconds: number;
}

export type EquipingCallback = (
  equip: Good | null,
  currentEquip: Good | null,
  justEffectType?: boolean
) => void;

export type UnEquipingCallback = (equip: Good | null, justEffectType?: boolean) => void;

// ============= GoodsListManager =============
export class GoodsListManager {
  protected get engine() {
    return getEngineContext();
  }

  private goodsList: (GoodsItemInfo | null)[] = new Array(STORE_INDEX_END + 1).fill(null);
  // 快捷栏：独立物品数组（不占用 goodsList 索引）
  private bottomItems: (GoodsItemInfo | null)[] = new Array(BOTTOM_ITEMS_COUNT).fill(null);
  // 装备槽：独立数组（7 槽，索引 0=Head..6=Foot）
  private equipSlots: (GoodsItemInfo | null)[] = new Array(EQUIP_SLOT_COUNT).fill(null);

  // Callbacks for equipment changes
  private onEquiping: EquipingCallback | null = null;
  private onUnEquiping: UnEquipingCallback | null = null;
  private onUpdateView: (() => void) | null = null;
  private onShowMessage: ((msg: string) => void) | null = null;

  constructor() {
    this.renewList();
  }

  /**
   * Set callbacks for equipment and UI updates
   */
  setCallbacks(callbacks: {
    onEquiping?: EquipingCallback;
    onUnEquiping?: UnEquipingCallback;
    onUpdateView?: () => void;
    onShowMessage?: (msg: string) => void;
  }): void {
    if (callbacks.onEquiping) this.onEquiping = callbacks.onEquiping;
    if (callbacks.onUnEquiping) this.onUnEquiping = callbacks.onUnEquiping;
    if (callbacks.onUpdateView) this.onUpdateView = callbacks.onUpdateView;
    if (callbacks.onShowMessage) this.onShowMessage = callbacks.onShowMessage;
  }

  /**
   * 静默写入装备槽位，不触发 onEquiping/onUnEquiping 回调。
   * 用于读档场景：属性由 recalculateBaseStats 统一重算，避免回调重复加减属性。
   */
  setEquipSlotSilent(position: EquipPosition, item: GoodsItemInfo | null): void {
    const idx = equipPositionToSlotIndex(position);
    if (idx < 0) return;
    this.equipSlots[idx] = item;
  }

  /**
   * Clear all goods
   */
  renewList(): void {
    for (let i = LIST_INDEX_BEGIN; i <= STORE_INDEX_END; i++) {
      this.goodsList[i] = null;
    }
    this.bottomItems.fill(null);
    this.equipSlots.fill(null);
  }

  /**
   * Check if index is in valid range
   */
  indexInRange(index: number): boolean {
    return index >= STORE_INDEX_BEGIN && index <= STORE_INDEX_END;
  }

  /**
   * Check if index is in store (bag) range
   */
  isInStoreRange(index: number): boolean {
    return index >= STORE_INDEX_BEGIN && index <= STORE_INDEX_END;
  }

  /**
   * Apply equipment effects from loaded list
   */
  applyEquipSpecialEffectFromList(): void {
    for (let i = 0; i < EQUIP_SLOT_COUNT; i++) {
      const info = this.equipSlots[i];
      if (info?.good) {
        this.onEquiping?.(info.good, null, true);
      }
    }

    // Apply no-need-to-equip items
    for (let i = LIST_INDEX_BEGIN; i <= STORE_INDEX_END; i++) {
      const info = this.goodsList[i];
      if (info && info.good.kind === GoodKind.Equipment && info.good.noNeedToEquip > 0) {
        for (let c = 0; c < info.count; c++) {
          this.onEquiping?.(info.good, null, true);
        }
      }
    }
  }

  /**
   * Get good at index
   */
  get(index: number): Good | null {
    const info = this.getItemInfo(index);
    return info ? info.good : null;
  }

  /**
   * Get item info at index
   */
  getItemInfo(index: number): GoodsItemInfo | null {
    return this.indexInRange(index) ? this.goodsList[index] : null;
  }

  /**
   * Set item at specific index (for loading saves - bag only)
   */
  setItemAtIndex(index: number, fileName: string, count: number = 1): boolean {
    if (!this.indexInRange(index)) return false;

    const good = getGood(fileName);
    if (!good) {
      logger.warn(`[GoodsListManager] Failed to load good: ${fileName}`);
      return false;
    }

    this.goodsList[index] = {
      good,
      count,
      remainColdMilliseconds: 0,
    };

    return true;
  }

  /**
   * Add good to list (with count parameter)
   */
  addGoodToListWithCount(
    fileName: string,
    count: number
  ): { success: boolean; index: number; good: Good | null } {
    const result = this.addGoodToList(fileName);
    if (result.success && result.index !== -1 && count > 1) {
      const info = this.goodsList[result.index];
      if (info) {
        info.count = count;
      }
    }
    return result;
  }

  /**
   * Add good to list
   *
   *
   * Key logic:
   * - Equipment with random attributes (hasRandAttr) should NOT stack,
   *   each instance gets unique attribute values via getOneNonRandom()
   * - Regular items (drugs, event items) can stack by fileName
   */
  addGoodToList(fileName: string): { success: boolean; index: number; good: Good | null } {
    let good = getGood(fileName);
    if (!good) {
      return { success: false, index: -1, good: null };
    }

    // Handle equipment with random attributes - generate unique instance
    //  lines 296-300
    let hasUniqueRandomAttrs = false;
    if (good.kind === GoodKind.Equipment && good.hasRandAttr) {
      good = good.getOneNonRandom();
      hasUniqueRandomAttrs = true;
      // Note: saves to game directory here, but we handle this differently
    }

    // Try to stack with existing same item
    // Equipment with random attributes should NOT stack (each has unique stats)
    if (!hasUniqueRandomAttrs) {
      for (let i = LIST_INDEX_BEGIN; i <= STORE_INDEX_END; i++) {
        const info = this.goodsList[i];
        if (info && info.good.fileName.toLowerCase() === good.fileName.toLowerCase()) {
          info.count += 1;
          this.checkAddNoEquipGood(good);
          this.onUpdateView?.(); // Trigger UI update
          return { success: true, index: i, good: info.good };
        }
      }
    }

    // Find empty slot in store range (bottom bar is independent, not used as overflow)
    for (let i = STORE_INDEX_BEGIN; i <= STORE_INDEX_END; i++) {
      if (this.goodsList[i] === null) {
        this.goodsList[i] = {
          good,
          count: 1,
          remainColdMilliseconds: 0,
        };
        this.checkAddNoEquipGood(good);
        this.onUpdateView?.(); // Trigger UI update
        return { success: true, index: i, good };
      }
    }

    this.onShowMessage?.("物品栏已满");
    return { success: false, index: -1, good: null };
  }

  /**
   * Check and apply no-need-to-equip effect
   */
  private checkAddNoEquipGood(good: Good): void {
    if (good.kind === GoodKind.Equipment && good.noNeedToEquip > 0) {
      this.onEquiping?.(good, null, false);
    }
  }

  /**
   * Delete good by filename
   */
  deleteGood(fileName: string): void {
    for (let i = LIST_INDEX_BEGIN; i <= STORE_INDEX_END; i++) {
      const info = this.goodsList[i];
      if (info && info.good.fileName.toLowerCase() === fileName.toLowerCase()) {
        const good = info.good;
        if (info.count === 1) {
          this.goodsList[i] = null;
        } else {
          info.count -= 1;
        }

        if (good.kind === GoodKind.Equipment && good.noNeedToEquip > 0) {
          this.onUnEquiping?.(good);
        }

        this.onUpdateView?.();
        return;
      }
    }
  }

  /**
   * Delete good at specific bag index (decrements count or removes)
   */
  deleteGoodByIndex(index: number): void {
    if (!this.isInStoreRange(index)) return;
    const info = this.goodsList[index];
    if (!info) return;

    const good = info.good;
    if (info.count <= 1) {
      this.goodsList[index] = null;
    } else {
      info.count -= 1;
    }

    if (good.kind === GoodKind.Equipment && good.noNeedToEquip > 0) {
      this.onUnEquiping?.(good);
    }

    this.onUpdateView?.();
  }

  /**
   * Show bag full message (exposed for cross-character operations)
   */
  showBagFullMessage(): void {
    this.onShowMessage?.("物品栏已满");
  }

  /**
   * Delete good by name and count
   * Supports both display name (e.g., "羊皮") and fileName (e.g., "Good-e22-羊皮.ini")
   */
  deleteGoodByName(name: string, count: number): void {
    let totalDeleted = 0;
    const lowerName = name.toLowerCase();

    for (let i = LIST_INDEX_BEGIN; i <= STORE_INDEX_END; i++) {
      const info = this.goodsList[i];
      // Match by display name or fileName (case-insensitive)
      if (info && (info.good.name === name || info.good.fileName.toLowerCase() === lowerName)) {
        const good = info.good;
        let deleteCount = 0;

        if (count <= 0) {
          // Delete all
          deleteCount = info.count;
          this.goodsList[i] = null;
        } else if (info.count > count - totalDeleted) {
          deleteCount = count - totalDeleted;
          info.count -= deleteCount;
          totalDeleted = count;
        } else {
          deleteCount = info.count;
          totalDeleted += deleteCount;
          this.goodsList[i] = null;
        }

        if (good.kind === GoodKind.Equipment && good.noNeedToEquip > 0) {
          for (let c = 0; c < deleteCount; c++) {
            this.onUnEquiping?.(good);
          }
        }

        if (count > 0 && totalDeleted >= count) break;
      }
    }

    this.onUpdateView?.();
  }

  /**
   * Get goods count by filename
   */
  getGoodsNum(fileName: string): number {
    let count = 0;
    for (let i = LIST_INDEX_BEGIN; i <= STORE_INDEX_END; i++) {
      const info = this.goodsList[i];
      if (info && info.good.fileName.toLowerCase() === fileName.toLowerCase()) {
        count += info.count;
      }
    }
    return count;
  }

  /**
   * Get goods count by name
   */
  getGoodsNumByName(name: string): number {
    let count = 0;
    for (let i = LIST_INDEX_BEGIN; i <= STORE_INDEX_END; i++) {
      const info = this.goodsList[i];
      if (info && info.good.name === name) {
        count += info.count;
      }
    }
    return count;
  }

  /**
   * Check if can equip a good at position
   */
  canEquip(goodIndex: number, position: EquipPosition): boolean {
    return this.isInStoreRange(goodIndex) && Good.canEquip(this.get(goodIndex), position);
  }

  /**
   * Simple exchange of two items (no equipment handling)
   * Used for swapping items within inventory
   */
  exchangeListItem(index1: number, index2: number): void {
    logger.log(`[GoodsListManager] exchangeListItem: ${index1} <-> ${index2}`);
    if (index1 !== index2 && this.indexInRange(index1) && this.indexInRange(index2)) {
      const temp = this.getItemInfo(index1);
      this._setItemRaw(index1, this.getItemInfo(index2));
      this._setItemRaw(index2, temp);
      logger.debug(
        "[GoodsListManager] exchangeListItem: calling onUpdateView, callback exists:",
        !!this.onUpdateView
      );
      this.onUpdateView?.();
    }
  }

  /**
   * 内部：直接写入物品
   */
  private _setItemRaw(index: number, item: GoodsItemInfo | null): void {
    this.goodsList[index] = item;
  }

  /**
   * Unequip item from equipment slot to inventory
   * Returns the new index in inventory, or -1 if failed
   */
  unEquipGood(equipPosition: EquipPosition): number {
    const slotIdx = equipPositionToSlotIndex(equipPosition);
    if (slotIdx < 0) return -1;

    const info = this.equipSlots[slotIdx];
    if (!info) return -1;

    // Find empty slot in store
    for (let i = STORE_INDEX_BEGIN; i <= STORE_INDEX_END; i++) {
      if (this.goodsList[i] === null) {
        this.goodsList[i] = info;
        this.equipSlots[slotIdx] = null;

        this.onUnEquiping?.(info.good);
        this.onUpdateView?.();

        logger.log(
          `[GoodsListManager] Unequipped ${info.good.name} from ${EquipPosition[equipPosition]} to slot ${i}`
        );
        return i;
      }
    }

    this.onShowMessage?.("物品栏已满");
    return -1;
  }

  /**
   * Exchange bag item with equipment slot, handling equipment callbacks
   */
  exchangeListItemAndEquiping(bagIndex: number, equipPosition: EquipPosition): void {
    logger.log(
      `[GoodsListManager] exchangeListItemAndEquiping: bag[${bagIndex}] <-> equip[${EquipPosition[equipPosition]}]`
    );
    if (!this.isInStoreRange(bagIndex)) return;

    const slotIdx = equipPositionToSlotIndex(equipPosition);
    if (slotIdx < 0) return;

    const bagItem = this.goodsList[bagIndex];
    const equippedItem = this.equipSlots[slotIdx];

    // Swap
    this.goodsList[bagIndex] = equippedItem;
    this.equipSlots[slotIdx] = bagItem;

    // Trigger equip callbacks
    const newEquip = this.equipSlots[slotIdx];
    const replacedEquip = this.goodsList[bagIndex];
    this.onEquiping?.(newEquip?.good ?? null, replacedEquip?.good ?? null);
    this.onUpdateView?.();

    logger.log(
      `[GoodsListManager] After: bag[${bagIndex}] = ${this.goodsList[bagIndex]?.good?.name ?? "empty"}, equip[${EquipPosition[equipPosition]}] = ${this.equipSlots[slotIdx]?.good?.name ?? "empty"}`
    );
  }

  /**
   * Move equipment to inventory
   */
  moveEquipItemToList(equipPosition: EquipPosition): { success: boolean; newIndex: number } {
    const slotIdx = equipPositionToSlotIndex(equipPosition);
    if (slotIdx < 0) return { success: false, newIndex: 0 };

    const info = this.equipSlots[slotIdx];
    if (!info) return { success: false, newIndex: 0 };

    for (let i = STORE_INDEX_BEGIN; i <= STORE_INDEX_END; i++) {
      if (this.goodsList[i] === null) {
        this.goodsList[i] = info;
        this.equipSlots[slotIdx] = null;
        return { success: true, newIndex: i };
      }
    }

    return { success: false, newIndex: 0 };
  }

  /**
   * Player unequipping item
   */
  playerUnEquiping(equipPosition: EquipPosition): { success: boolean; newIndex: number } {
    const result = this.moveEquipItemToList(equipPosition);
    if (result.success) {
      this.onUnEquiping?.(this.get(result.newIndex));
      this.onUpdateView?.();
    }
    return result;
  }

  /**
   * Swap two equipment slots
   */
  swapEquipSlots(pos1: EquipPosition, pos2: EquipPosition): void {
    const idx1 = equipPositionToSlotIndex(pos1);
    const idx2 = equipPositionToSlotIndex(pos2);
    if (idx1 < 0 || idx2 < 0 || idx1 === idx2) return;
    const tmp = this.equipSlots[idx1];
    this.equipSlots[idx1] = this.equipSlots[idx2];
    this.equipSlots[idx2] = tmp;
    this.onUpdateView?.();
  }

  /**
   * Get equipped item at a specific EquipPosition
   */
  getEquipAtPosition(position: EquipPosition): GoodsItemInfo | null {
    const idx = equipPositionToSlotIndex(position);
    return idx >= 0 ? this.equipSlots[idx] : null;
  }

  /**
   * Set equipped item at a specific EquipPosition.
   * - 若槽位已有旧装备，会被作为 currentEquip 传给 onEquiping，确保旧 delta 正确卸下
   * - 若新 item 为 null，则触发 onUnEquiping，卸下旧装备 delta
   * - 对存档加载也安全：彼时槽位本就为 null，currentEquip 即 null
   */
  setEquipAtPosition(position: EquipPosition, item: GoodsItemInfo | null): void {
    const idx = equipPositionToSlotIndex(position);
    if (idx < 0) return;
    const prev = this.equipSlots[idx];
    this.equipSlots[idx] = item;
    if (item?.good) {
      this.onEquiping?.(item.good, prev?.good ?? null, false);
    } else if (prev?.good) {
      this.onUnEquiping?.(prev.good, false);
    }
  }


  /**
   * Get equipped item at 0-based slot index (0=Head..6=Foot), for UI iteration
   */
  getEquipAtSlotIndex(i: number): GoodsItemInfo | null {
    return i >= 0 && i < EQUIP_SLOT_COUNT ? this.equipSlots[i] : null;
  }

  /**
   * Use a good (drug, equipment, event item)
   * GoodsListManager.UsingGood(goodIndex)
   * @param playerName - Player name for checking item user restriction
   */
  async usingGood(
    goodIndex: number,
    playerLevel: number = 1,
    playerName?: string
  ): Promise<boolean> {
    const info = this.getItemInfo(goodIndex);
    if (!info) return false;

    const good = info.good;

    // Check user requirements
    // if (good.User != null && good.User.Length > 0) { if (!good.User.Contains(user.Name)) ... }
    if (good.user && good.user.length > 0 && playerName) {
      if (!good.user.includes(playerName)) {
        this.onShowMessage?.(`使用者：${good.user.join("，")}`);
        return false;
      }
    }

    // Check level requirement
    if (good.minUserLevel > 0 && playerLevel < good.minUserLevel) {
      this.onShowMessage?.(`需要等级 ${good.minUserLevel}`);
      return false;
    }

    switch (good.kind) {
      case GoodKind.Drug:
        // Check cooldown
        if (info.remainColdMilliseconds > 0) {
          this.onShowMessage?.("该物品尚未冷却");
          return false;
        }

        // Set cooldown
        if (good.coldMilliSeconds > 0) {
          info.remainColdMilliseconds = good.coldMilliSeconds;
        }

        // Consume item
        if (info.count === 1) {
          this.goodsList[goodIndex] = null;
        } else {
          info.count -= 1;
        }

        this.onUpdateView?.();
        return true; // Return true to indicate drug was used (caller handles effect)

      case GoodKind.Equipment:
        if (good.noNeedToEquip === 0) {
          // Equip the item
          return this.equipGood(goodIndex);
        }
        break;

      case GoodKind.Event:
        // ScriptManager.RunScript(good.Script)
        if (good.script) {
          const engine = this.engine;
          if (engine) {
            // 物品脚本路径固定在 script/goods/ 目录下
            const fullPath = good.script.startsWith("/")
              ? good.script
              : `script/goods/${good.script}`;
            logger.log(`[GoodsListManager] Running event script: ${fullPath}`);
            // Pass the good's fileName as belongObject so DelGoods() can find it
            engine.runScript(fullPath, { type: "good", id: good.fileName });
          }
        }
        break;
    }

    this.onUpdateView?.();
    return false;
  }

  /**
   * Use item from bottom goods slot (hotkey Z/X/C, or UI bottom bar)
   *
   * Consolidates logic from InputHandler.useBottomGood() and UIBridge.useBottomItem().
   * Handles: consume item → apply drug to player → apply drug to partners.
   *
   * @param slotIndex 0-2 (bottom slot index)
   * @param player Player instance
   * @param forEachPartner Callback to iterate partners
   */
  useBottomSlot(
    slotIndex: number,
    player: { level: number; useDrug: (good: Good) => void },
    forEachPartner: (fn: (partner: { useDrug: (good: Good) => void }) => void) => void
  ): void {
    const info = this.getBottomItemAtSlot(slotIndex);
    if (!info?.good) return;

    const good = info.good;
    const level = player.level;
    // Use the item directly from bottom slot
    const minLevel = good.minUserLevel;
    if (minLevel > 0 && level < minLevel) {
      return;
    }
    if (info.remainColdMilliseconds > 0) return;
    if (good.kind === GoodKind.Drug) {
      const coldMilliseconds = good.coldMilliSeconds;
      info.remainColdMilliseconds = coldMilliseconds;
      // Also apply cold to same-item slots in the list
      for (let i = LIST_INDEX_BEGIN; i <= STORE_INDEX_END; i++) {
        const slot = this.goodsList[i];
        if (slot && slot.good.fileName.toLowerCase() === good.fileName.toLowerCase()) {
          slot.remainColdMilliseconds = coldMilliseconds;
        }
      }
      // Decrement count
      info.count -= 1;
      if (info.count <= 0) {
        this.bottomItems[slotIndex] = null;
      }
      this.onUpdateView?.();
      player.useDrug(good);
      if (good.followPartnerHasDrugEffect > 0) {
        forEachPartner((partner) => {
          partner.useDrug(good);
        });
      }
    }
  }

  /**
   * Equip a good from inventory
   */
  equipGood(goodListIndex: number): boolean {
    if (!this.isInStoreRange(goodListIndex)) {
      return false;
    }

    const info = this.getItemInfo(goodListIndex);
    if (!info) return false;

    const good = info.good;
    if (good.kind !== GoodKind.Equipment) return false;

    if (equipPositionToSlotIndex(good.part) < 0) return false;

    // Exchange with current equipped item
    this.exchangeListItemAndEquiping(goodListIndex, good.part);
    this.onUpdateView?.();

    return true;
  }

  /**
   * Update cooldowns
   */
  update(deltaTime: number): void {
    const dt = deltaTime * 1000; // Convert to milliseconds
    for (let i = LIST_INDEX_BEGIN; i <= STORE_INDEX_END; i++) {
      const info = this.goodsList[i];
      if (info && info.remainColdMilliseconds > 0) {
        info.remainColdMilliseconds = Math.max(0, info.remainColdMilliseconds - dt);
      }
    }
  }

  /**
   * Check if there's free space in inventory
   */
  hasFreeItemSpace(): boolean {
    for (let i = STORE_INDEX_BEGIN; i <= STORE_INDEX_END; i++) {
      if (this.goodsList[i] === null) return true;
    }
    return false;
  }

  /**
   * Get all items in store (bag)
   */
  getStoreItems(): (GoodsItemInfo | null)[] {
    const items: (GoodsItemInfo | null)[] = [];
    for (let i = STORE_INDEX_BEGIN; i <= STORE_INDEX_END; i++) {
      items.push(this.goodsList[i]);
    }
    return items;
  }

  /**
   * Get all equipped items
   */
  getEquippedItems(): Map<EquipPosition, GoodsItemInfo | null> {
    const equipped = new Map<EquipPosition, GoodsItemInfo | null>();
    const positions = [
      EquipPosition.Head,
      EquipPosition.Neck,
      EquipPosition.Body,
      EquipPosition.Back,
      EquipPosition.Hand,
      EquipPosition.Wrist,
      EquipPosition.Foot,
    ];

    for (let i = 0; i < positions.length; i++) {
      equipped.set(positions[i], this.equipSlots[i]);
    }

    return equipped;
  }

  /**
   * Sum stat bonuses from all equipped items (equip slots + noNeedToEquip bag items).
   * Used by Player.recalculateBaseStats() to restore correct stats on save load.
   */
  sumEquipStats(): {
    attack: number;
    attack2: number;
    attack3: number;
    defend: number;
    defend2: number;
    defend3: number;
    evade: number;
    lifeMax: number;
    thewMax: number;
    manaMax: number;
  } {
    const s = {
      attack: 0,
      attack2: 0,
      attack3: 0,
      defend: 0,
      defend2: 0,
      defend3: 0,
      evade: 0,
      lifeMax: 0,
      thewMax: 0,
      manaMax: 0,
    };
    const add = (good: Good) => {
      s.attack += good.attack;
      s.attack2 += good.attack2;
      s.attack3 += good.attack3;
      s.defend += good.defend;
      s.defend2 += good.defend2;
      s.defend3 += good.defend3;
      s.evade += good.evade;
      s.lifeMax += good.lifeMax;
      s.thewMax += good.thewMax;
      s.manaMax += good.manaMax;
    };
    for (let i = 0; i < EQUIP_SLOT_COUNT; i++) {
      const info = this.equipSlots[i];
      if (info?.good) add(info.good);
    }
    for (let i = LIST_INDEX_BEGIN; i <= STORE_INDEX_END; i++) {
      const info = this.goodsList[i];
      if (info && info.good.kind === GoodKind.Equipment && info.good.noNeedToEquip > 0) {
        for (let c = 0; c < info.count; c++) add(info.good);
      }
    }
    return s;
  }

  /**
   * Get bottom bar items (hotbar) from independent bottomItems array
   */
  getBottomItems(): (GoodsItemInfo | null)[] {
    return [...this.bottomItems];
  }

  /**
   * Get the image path for an item at index
   */
  getImagePath(index: number): string | null {
    const info = this.getItemInfo(index);
    if (!info) return null;
    return info.good.imagePath;
  }

  /**
   * Set item directly in bottom slot (for save loading)
   */
  setBottomItemAtSlot(slot: number, item: GoodsItemInfo | null): void {
    if (slot >= 0 && slot < BOTTOM_ITEMS_COUNT) {
      this.bottomItems[slot] = item;
      this.onUpdateView?.();
    }
  }

  /**
   * Get item directly from bottom slot
   */
  getBottomItemAtSlot(slot: number): GoodsItemInfo | null {
    if (slot >= 0 && slot < BOTTOM_ITEMS_COUNT) {
      return this.bottomItems[slot];
    }
    return null;
  }

  /**
   * Move a bag item into a bottom slot.
   * If the bottom slot already has an item, swap: the existing bottom item goes back to the bag.
   */
  moveBagToBottom(bagIndex: number, bottomSlot: number): void {
    if (!this.isInStoreRange(bagIndex) || bottomSlot < 0 || bottomSlot >= BOTTOM_ITEMS_COUNT)
      return;
    const info = this.goodsList[bagIndex];
    if (!info) return;
    const existing = this.bottomItems[bottomSlot];
    this.bottomItems[bottomSlot] = { ...info };
    this.goodsList[bagIndex] = existing ? { ...existing } : null;
    this.onUpdateView?.();
  }

  /**
   * Move a bottom slot item back to bag
   */
  moveBottomToBag(bottomSlot: number, bagIndex?: number): void {
    if (bottomSlot < 0 || bottomSlot >= BOTTOM_ITEMS_COUNT) return;
    const item = this.bottomItems[bottomSlot];
    if (!item) return;
    if (
      bagIndex !== undefined &&
      this.isInStoreRange(bagIndex) &&
      this.goodsList[bagIndex] === null
    ) {
      this.goodsList[bagIndex] = item;
    } else {
      this.addGoodToListWithCount(item.good.fileName, item.count);
    }
    this.bottomItems[bottomSlot] = null;
    this.onUpdateView?.();
  }

  /**
   * Swap two bottom slots
   */
  swapBottomGoods(fromSlot: number, toSlot: number): void {
    if (
      fromSlot < 0 ||
      fromSlot >= BOTTOM_ITEMS_COUNT ||
      toSlot < 0 ||
      toSlot >= BOTTOM_ITEMS_COUNT ||
      fromSlot === toSlot
    )
      return;
    const tmp = this.bottomItems[fromSlot];
    this.bottomItems[fromSlot] = this.bottomItems[toSlot];
    this.bottomItems[toSlot] = tmp;
    this.onUpdateView?.();
  }
}
