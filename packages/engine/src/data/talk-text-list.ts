/**
 * TalkTextList - based on JxqyHD Engine/ListManager/TalkTextList.cs
 * Manages dialog text data loaded from API
 */

import { logger } from "../core/logger";
import { getTalksData } from "../resource/resource-loader";

export interface TalkTextDetail {
  index: number;
  portraitIndex: number;
  text: string;
}

class TalkTextListManager {
  private list: TalkTextDetail[] = [];
  private isInitialized = false;

  /**
   * Initialize the talk text list from API data
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    const apiData = getTalksData();
    if (apiData && apiData.length > 0) {
      this.list = apiData.map((entry) => ({
        index: entry.id,
        portraitIndex: entry.portraitIndex,
        text: entry.text,
      }));
      this.list.sort((a, b) => a.index - b.index);
      this.isInitialized = true;
      logger.log(`[TalkTextList] Loaded ${this.list.length} dialog entries from API`);
      return;
    }

    logger.warn(`[TalkTextList] No dialog data available from API`);
  }

  /**
   * Get a single text detail by index
   */
  getTextDetail(index: number): TalkTextDetail | null {
    // Binary search for efficiency
    let left = 0;
    let right = this.list.length - 1;

    while (left <= right) {
      const mid = Math.floor((left + right) / 2);
      const item = this.list[mid];

      if (item.index === index) {
        return item;
      } else if (item.index < index) {
        left = mid + 1;
      } else {
        right = mid - 1;
      }
    }

    return null;
  }

  /**
   * Get a range of text details (for multi-line dialogs)
   * Returns all entries where index >= from && index <= to
   */
  getTextDetails(from: number, to: number): TalkTextDetail[] {
    const result: TalkTextDetail[] = [];

    // Find start index
    let startIdx = -1;
    for (let i = 0; i < this.list.length; i++) {
      if (this.list[i].index === from) {
        startIdx = i;
        break;
      }
      if (this.list[i].index > from) {
        break;
      }
    }

    if (startIdx === -1) {
      logger.warn(`[TalkTextList] Dialog index not found: ${from} - ${to}`);
      return result;
    }

    // Collect all entries in range
    for (let i = startIdx; i < this.list.length; i++) {
      if (this.list[i].index <= to) {
        result.push(this.list[i]);
      } else {
        break;
      }
    }

    return result;
  }

  /**
   * Check if initialized
   */
  isReady(): boolean {
    return this.isInitialized;
  }

  /**
   * Get total count of dialog entries
   */
  getCount(): number {
    return this.list.length;
  }
}

export { TalkTextListManager };
