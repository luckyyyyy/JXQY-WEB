/**
 * PartnerList - based on JxqyHD Engine/ListManager/PartnerList.cs
 * Manages partner index lookup from /api/data players
 */

import { logger } from "../core/logger";
import { getPlayersData } from "../data/game-data-api";

export class PartnerListManager {
  private list: Map<number, string> = new Map();
  private isInitialized = false;

  /**
   * Initialize the partner list from /api/data players
   */
  initialize(): void {
    if (this.isInitialized) return;

    const players = getPlayersData();
    if (!players || players.length === 0) {
      logger.warn("[PartnerList] No players data available from API");
      return;
    }

    for (const player of players) {
      this.list.set(player.index, player.name);
    }

    this.isInitialized = true;
    logger.log(`[PartnerList] Loaded ${this.list.size} partner entries from API data`);
  }

  /**
   * Get total item count
   */
  getCount(): number {
    return this.list.size;
  }

  /**
   * Get the index of character named name.
   * @param name Character name
   * @returns The character index. If not found, total item count plus 1 will be returned.
   */
  getIndex(name: string): number {
    for (const [key, value] of this.list) {
      if (value === name) {
        return key;
      }
    }
    return this.getCount() + 1;
  }

  /**
   * Get the character name at index.
   * @param index Index in list
   * @returns Character name. If not found, returns empty string.
   */
  getName(index: number): string {
    return this.list.get(index) || "";
  }
}
