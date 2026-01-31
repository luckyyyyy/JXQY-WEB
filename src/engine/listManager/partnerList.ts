/**
 * PartnerList - based on JxqyHD Engine/ListManager/PartnerList.cs
 * Manages partner index lookup from PartnerIdx.ini
 */

import { logger } from "../core/logger";
import { resourceLoader } from "../resource/resourceLoader";

class PartnerListManager {
  private list: Map<number, string> = new Map();
  private isInitialized = false;

  /**
   * Initialize the partner list from PartnerIdx.ini
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    const path = "/resources/Content/PartnerIdx.ini";
    try {
      const content = await resourceLoader.loadText(path);
      if (!content) {
        logger.warn("[PartnerList] Failed to load PartnerIdx.ini");
        return;
      }

      this.parseContent(content);
      this.isInitialized = true;
      logger.log(`[PartnerList] Loaded ${this.list.size} partner entries`);
    } catch (error) {
      logger.error("[PartnerList] Error loading PartnerIdx.ini:", error);
    }
  }

  private parseContent(content: string): void {
    const lines = content.split("\n");
    let inSection = false;

    for (const rawLine of lines) {
      const line = rawLine.trim();

      if (!line || line.startsWith(";")) {
        continue;
      }

      // Check for section header
      if (line.startsWith("[")) {
        inSection = true;
        continue;
      }

      if (!inSection) continue;

      // Parse key=value
      const eqIdx = line.indexOf("=");
      if (eqIdx === -1) continue;

      const key = line.substring(0, eqIdx).trim();
      const value = line.substring(eqIdx + 1).trim();

      const index = parseInt(key, 10);
      if (!isNaN(index)) {
        this.list.set(index, value);
      }
    }
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

export const partnerList = new PartnerListManager();
