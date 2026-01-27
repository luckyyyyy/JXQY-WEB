/**
 * GoodsListManager - based on JxqyHD Engine/ListManager/GoodsListManager.cs
 * Manages player's inventory and equipment
 */
import { Good, getGood, EquipPosition, GoodKind, GoodEffectType } from "./good";

// ============= Constants =============
export const MAX_GOODS = 223;
export const LIST_INDEX_BEGIN = 1;
export const LIST_INDEX_END = 223;
export const STORE_INDEX_BEGIN = 1;
export const STORE_INDEX_END = 198;
export const EQUIP_INDEX_BEGIN = 201;
export const EQUIP_INDEX_END = 207;
export const BOTTOM_INDEX_BEGIN = 221;
export const BOTTOM_INDEX_END = 223;

// Equipment slot indices (201-207)
// 201 = Head, 202 = Neck, 203 = Body, 204 = Back, 205 = Hand, 206 = Wrist, 207 = Foot
export function getEquipSlotIndex(position: EquipPosition): number {
  switch (position) {
    case EquipPosition.Head: return EQUIP_INDEX_BEGIN;
    case EquipPosition.Neck: return EQUIP_INDEX_BEGIN + 1;
    case EquipPosition.Body: return EQUIP_INDEX_BEGIN + 2;
    case EquipPosition.Back: return EQUIP_INDEX_BEGIN + 3;
    case EquipPosition.Hand: return EQUIP_INDEX_BEGIN + 4;
    case EquipPosition.Wrist: return EQUIP_INDEX_BEGIN + 5;
    case EquipPosition.Foot: return EQUIP_INDEX_BEGIN + 6;
    default: return -1;
  }
}

export function getEquipPositionFromIndex(index: number): EquipPosition {
  if (index < EQUIP_INDEX_BEGIN || index > EQUIP_INDEX_END) return EquipPosition.None;
  const positions = [
    EquipPosition.Head,
    EquipPosition.Neck,
    EquipPosition.Body,
    EquipPosition.Back,
    EquipPosition.Hand,
    EquipPosition.Wrist,
    EquipPosition.Foot,
  ];
  return positions[index - EQUIP_INDEX_BEGIN];
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

export type UnEquipingCallback = (
  equip: Good | null,
  justEffectType?: boolean
) => void;

// ============= GoodsListManager =============
export class GoodsListManager {
  private goodsList: (GoodsItemInfo | null)[] = new Array(MAX_GOODS + 1).fill(null);

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
   * Clear all goods
   */
  renewList(): void {
    for (let i = LIST_INDEX_BEGIN; i <= LIST_INDEX_END; i++) {
      this.goodsList[i] = null;
    }
  }

  /**
   * Check if index is in valid range
   */
  indexInRange(index: number): boolean {
    return index > 0 && index <= MAX_GOODS;
  }

  /**
   * Check if index is in equipment range
   */
  isInEquipRange(index: number): boolean {
    return index >= EQUIP_INDEX_BEGIN && index <= EQUIP_INDEX_END;
  }

  /**
   * Check if index is in store (bag) range
   */
  isInStoreRange(index: number): boolean {
    return index >= STORE_INDEX_BEGIN && index <= STORE_INDEX_END;
  }

  /**
   * Check if index is in bottom goods (hotbar) range
   */
  isInBottomGoodsRange(index: number): boolean {
    return index >= BOTTOM_INDEX_BEGIN && index <= BOTTOM_INDEX_END;
  }

  /**
   * Load goods list from file
   */
  async loadList(filePath: string): Promise<boolean> {
    this.renewList();

    try {
      const response = await fetch(filePath);
      if (!response.ok) {
        console.error(`[GoodsListManager] Failed to load: ${filePath}`);
        return false;
      }

      // Files in resources/ini/ are now UTF-8
      const content = await response.text();

      // Parse INI content
      const lines = content.split(/\r?\n/);
      let currentSection = '';
      let currentIndex = -1;
      let iniFile = '';
      let number = 1;

      for (const line of lines) {
        const trimmed = line.trim();

        // Section header
        if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
          // Process previous section
          if (currentIndex > 0 && iniFile) {
            const good = await getGood(iniFile);
            if (good) {
              this.goodsList[currentIndex] = {
                good,
                count: number,
                remainColdMilliseconds: 0,
              };
            }
          }

          currentSection = trimmed.slice(1, -1);
          currentIndex = parseInt(currentSection);
          if (isNaN(currentIndex)) currentIndex = -1;
          iniFile = '';
          number = 1;
          continue;
        }

        // Key=Value
        const eqIndex = trimmed.indexOf('=');
        if (eqIndex === -1) continue;

        const key = trimmed.substring(0, eqIndex).trim().toLowerCase();
        const value = trimmed.substring(eqIndex + 1).trim();

        if (key === 'inifile') {
          iniFile = value;
        } else if (key === 'number') {
          number = parseInt(value) || 1;
        }
      }

      // Process last section
      if (currentIndex > 0 && iniFile) {
        const good = await getGood(iniFile);
        if (good) {
          this.goodsList[currentIndex] = {
            good,
            count: number,
            remainColdMilliseconds: 0,
          };
        }
      }

      // Debug: Log all loaded items
      let loadedCount = 0;
      for (let i = LIST_INDEX_BEGIN; i <= LIST_INDEX_END; i++) {
        if (this.goodsList[i]) {
          loadedCount++;
          console.log(`[GoodsListManager] Slot ${i}: ${this.goodsList[i]!.good.name} x${this.goodsList[i]!.count}`);
        }
      }
      console.log(`[GoodsListManager] Loaded ${loadedCount} items from ${filePath}`);
      this.onUpdateView?.();
      return true;
    } catch (error) {
      console.error(`[GoodsListManager] Error loading ${filePath}:`, error);
      return false;
    }
  }

  /**
   * Apply equipment effects from loaded list
   */
  applyEquipSpecialEffectFromList(): void {
    for (let i = EQUIP_INDEX_BEGIN; i <= EQUIP_INDEX_END; i++) {
      const good = this.get(i);
      if (good) {
        this.onEquiping?.(good, null, true);
      }
    }

    // Apply no-need-to-equip items
    for (let i = LIST_INDEX_BEGIN; i <= LIST_INDEX_END; i++) {
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
   * Set item at specific index (for loading saves)
   */
  async setItemAtIndex(index: number, fileName: string, count: number = 1): Promise<boolean> {
    if (!this.indexInRange(index)) return false;

    const good = await getGood(fileName);
    if (!good) {
      console.warn(`[GoodsListManager] Failed to load good: ${fileName}`);
      return false;
    }

    this.goodsList[index] = {
      good,
      count,
      remainColdMilliseconds: 0,
    };

    // Handle equipment slots
    if (this.isInEquipRange(index)) {
      this.onEquiping?.(good, null, false);
    }

    return true;
  }

  /**
   * Add good to list (with count parameter)
   */
  async addGoodToListWithCount(fileName: string, count: number): Promise<{ success: boolean; index: number; good: Good | null }> {
    const result = await this.addGoodToList(fileName);
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
   */
  async addGoodToList(fileName: string): Promise<{ success: boolean; index: number; good: Good | null }> {
    const good = await getGood(fileName);
    if (!good) {
      return { success: false, index: -1, good: null };
    }

    // Try to stack with existing same item
    for (let i = LIST_INDEX_BEGIN; i <= LIST_INDEX_END; i++) {
      const info = this.goodsList[i];
      if (info && info.good.fileName.toLowerCase() === good.fileName.toLowerCase()) {
        info.count += 1;
        this.checkAddNoEquipGood(good);
        this.onUpdateView?.(); // Trigger UI update
        return { success: true, index: i, good: info.good };
      }
    }

    // Find empty slot in store
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

    // Try bottom slots
    for (let i = BOTTOM_INDEX_BEGIN; i <= BOTTOM_INDEX_END; i++) {
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
    for (let i = LIST_INDEX_BEGIN; i <= LIST_INDEX_END; i++) {
      const info = this.goodsList[i];
      if (info && info.good.fileName.toLowerCase() === fileName.toLowerCase()) {
        const good = info.good;
        if (info.count === 1) {
          this.goodsList[i] = null;
        } else {
          info.count -= 1;
        }

        // Handle unequip
        if (this.isInEquipRange(i) && this.goodsList[i] === null) {
          this.onUnEquiping?.(good);
        } else if (good.kind === GoodKind.Equipment && good.noNeedToEquip > 0) {
          this.onUnEquiping?.(good);
        }

        this.onUpdateView?.();
        return;
      }
    }
  }

  /**
   * Delete good by name and count
   */
  deleteGoodByName(name: string, count: number): void {
    let totalDeleted = 0;

    for (let i = LIST_INDEX_BEGIN; i <= LIST_INDEX_END; i++) {
      const info = this.goodsList[i];
      if (info && info.good.name === name) {
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

        // Handle unequip
        if (this.isInEquipRange(i) && this.goodsList[i] === null) {
          this.onUnEquiping?.(good);
        } else if (good.kind === GoodKind.Equipment && good.noNeedToEquip > 0) {
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
    for (let i = LIST_INDEX_BEGIN; i <= LIST_INDEX_END; i++) {
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
    for (let i = LIST_INDEX_BEGIN; i <= LIST_INDEX_END; i++) {
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
    return !this.isInEquipRange(goodIndex) && Good.canEquip(this.get(goodIndex), position);
  }

  /**
   * Simple exchange of two items (no equipment handling)
   * Used for swapping items within inventory
   */
  exchangeListItem(index1: number, index2: number): void {
    console.log(`[GoodsListManager] exchangeListItem: ${index1} <-> ${index2}`);
    if (index1 !== index2 && this.indexInRange(index1) && this.indexInRange(index2)) {
      const temp = this.goodsList[index1];
      this.goodsList[index1] = this.goodsList[index2];
      this.goodsList[index2] = temp;
      this.onUpdateView?.();
    }
  }

  /**
   * Unequip item from equipment slot to inventory
   * Returns the new index in inventory, or -1 if failed
   */
  unEquipGood(equipIndex: number): number {
    if (!this.isInEquipRange(equipIndex)) {
      return -1;
    }

    const info = this.goodsList[equipIndex];
    if (!info) {
      return -1; // Nothing equipped
    }

    // Find empty slot in store
    for (let i = STORE_INDEX_BEGIN; i <= STORE_INDEX_END; i++) {
      if (this.goodsList[i] === null) {
        // Move to inventory
        this.goodsList[i] = info;
        this.goodsList[equipIndex] = null;

        // Trigger unequip callback
        this.onUnEquiping?.(info.good);
        this.onUpdateView?.();

        console.log(`[GoodsListManager] Unequipped ${info.good.name} from slot ${equipIndex} to ${i}`);
        return i;
      }
    }

    this.onShowMessage?.("物品栏已满");
    return -1;
  }

  /**
   * Exchange two items and handle equipment changes
   */
  exchangeListItemAndEquiping(index1: number, index2: number): void {
    console.log(`[GoodsListManager] exchangeListItemAndEquiping: ${index1} <-> ${index2}`);
    console.log(`[GoodsListManager] Before: slot ${index1} = ${this.goodsList[index1]?.good?.name ?? 'empty'}, slot ${index2} = ${this.goodsList[index2]?.good?.name ?? 'empty'}`);

    if (index1 !== index2 && this.indexInRange(index1) && this.indexInRange(index2)) {
      const temp = this.goodsList[index1];
      this.goodsList[index1] = this.goodsList[index2];
      this.goodsList[index2] = temp;
      this.changePlayerEquiping(index1, index2);
      this.onUpdateView?.();

      console.log(`[GoodsListManager] After: slot ${index1} = ${this.goodsList[index1]?.good?.name ?? 'empty'}, slot ${index2} = ${this.goodsList[index2]?.good?.name ?? 'empty'}`);
    } else {
      console.warn(`[GoodsListManager] Exchange failed: invalid indices or same index`);
    }
  }

  /**
   * Handle player equipment change after exchange
   */
  private changePlayerEquiping(index1: number, index2: number): void {
    let equip: Good | null = null;
    let currentEquip: Good | null = null;

    if (this.isInEquipRange(index1)) {
      equip = this.get(index1);
      currentEquip = this.get(index2);
    } else if (this.isInEquipRange(index2)) {
      equip = this.get(index2);
      currentEquip = this.get(index1);
    }

    if (equip || currentEquip) {
      this.onEquiping?.(equip, currentEquip);
    }
  }

  /**
   * Move equipment to inventory
   */
  moveEquipItemToList(equipItemIndex: number): { success: boolean; newIndex: number } {
    if (!this.isInEquipRange(equipItemIndex)) {
      return { success: false, newIndex: 0 };
    }

    const info = this.goodsList[equipItemIndex];
    if (!info) {
      return { success: false, newIndex: 0 };
    }

    // Find empty slot in store
    for (let i = STORE_INDEX_BEGIN; i <= STORE_INDEX_END; i++) {
      if (this.goodsList[i] === null) {
        this.goodsList[i] = info;
        this.goodsList[equipItemIndex] = null;
        return { success: true, newIndex: i };
      }
    }

    return { success: false, newIndex: 0 };
  }

  /**
   * Player unequipping item
   */
  playerUnEquiping(equipIndex: number): { success: boolean; newIndex: number } {
    if (!this.isInEquipRange(equipIndex)) {
      return { success: false, newIndex: 0 };
    }

    const result = this.moveEquipItemToList(equipIndex);
    if (result.success) {
      this.onUnEquiping?.(this.get(result.newIndex));
      this.onUpdateView?.();
    }

    return result;
  }

  /**
   * Use a good (drug, equipment, event item)
   */
  async usingGood(goodIndex: number, playerLevel: number = 1): Promise<boolean> {
    if (this.isInEquipRange(goodIndex)) {
      // Can't use equipped items directly
      return false;
    }

    const info = this.getItemInfo(goodIndex);
    if (!info) return false;

    const good = info.good;

    // Check user requirements
    if (good.user && good.user.length > 0) {
      // TODO: Check if current player can use
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
        return true;  // Return true to indicate drug was used (caller handles effect)

      case GoodKind.Equipment:
        if (good.noNeedToEquip === 0) {
          // Equip the item
          return this.equipGood(goodIndex);
        }
        break;

      case GoodKind.Event:
        // Run event script
        if (good.script) {
          // TODO: Run script
          console.log(`[GoodsListManager] Running event script: ${good.script}`);
        }
        break;
    }

    this.onUpdateView?.();
    return false;
  }

  /**
   * Equip a good from inventory
   */
  equipGood(goodListIndex: number): boolean {
    if (!this.isInStoreRange(goodListIndex) && !this.isInBottomGoodsRange(goodListIndex)) {
      return false;
    }

    const info = this.getItemInfo(goodListIndex);
    if (!info) return false;

    const good = info.good;
    if (good.kind !== GoodKind.Equipment) return false;

    const equipIndex = getEquipSlotIndex(good.part);
    if (equipIndex === -1) return false;

    // Exchange with current equipped item
    this.exchangeListItemAndEquiping(goodListIndex, equipIndex);
    this.onUpdateView?.();

    return true;
  }

  /**
   * Update cooldowns
   */
  update(deltaTime: number): void {
    const dt = deltaTime * 1000; // Convert to milliseconds
    for (let i = LIST_INDEX_BEGIN; i <= LIST_INDEX_END; i++) {
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
    for (let i = BOTTOM_INDEX_BEGIN; i <= BOTTOM_INDEX_END; i++) {
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
      equipped.set(positions[i], this.goodsList[EQUIP_INDEX_BEGIN + i]);
    }

    return equipped;
  }

  /**
   * Get bottom bar items (hotbar)
   */
  getBottomItems(): (GoodsItemInfo | null)[] {
    const items: (GoodsItemInfo | null)[] = [];
    for (let i = BOTTOM_INDEX_BEGIN; i <= BOTTOM_INDEX_END; i++) {
      items.push(this.goodsList[i]);
    }
    return items;
  }

  /**
   * Get the image path for an item at index
   */
  getImagePath(index: number): string | null {
    const good = this.get(index);
    if (!good) return null;

    // Use icon for bottom bar items
    if (this.isInBottomGoodsRange(index)) {
      return good.iconPath;
    }
    return good.imagePath;
  }
}
