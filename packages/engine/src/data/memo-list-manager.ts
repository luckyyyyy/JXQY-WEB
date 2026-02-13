/**
 * Memo List Manager - based on JxqyHD Engine/ListManager/MemoListManager.cs
 * Manages game memo/quest log entries
 *
 * Memos are prefixed with "●" bullet point.
 * Unlike the original C# code which splits text into 10-char-wide lines for
 * fixed-width pixel rendering, we store each memo as a complete string and
 * let CSS handle text wrapping.
 */

import { logger } from "../core/logger";
import type { TalkTextListManager } from "./talk-text-list";

/**
 * Merge split memo lines back into complete entries.
 * Old save data (from original C# engine or earlier TS versions) stored each
 * 10-char-wide line as a separate entry. Lines that don't start with "●" are
 * continuations of the previous "●" entry and should be merged.
 */
function mergeSplitMemoLines(lines: string[]): string[] {
  const merged: string[] = [];

  for (const line of lines) {
    if (line.startsWith("●") || merged.length === 0) {
      merged.push(line);
    } else {
      // Continuation of previous entry — merge
      merged[merged.length - 1] += line;
    }
  }

  return merged;
}

export class MemoListManager {
  private memoList: string[] = [];
  private onUpdateCallbacks: Set<() => void> = new Set();

  constructor(private talkTextList: TalkTextListManager) {}

  /**
   * Register update callback (for UI refresh)
   */
  onUpdate(callback: () => void): () => void {
    this.onUpdateCallbacks.add(callback);
    return () => this.onUpdateCallbacks.delete(callback);
  }

  /**
   * Notify all update callbacks
   */
  private notifyUpdate(): void {
    this.onUpdateCallbacks.forEach((cb) => cb());
  }

  /**
   * Load memo list from save data
   * Format: [Memo] section with Count and numbered keys
   * Merges split lines from old saves for backward compatibility
   */
  loadList(data: Record<string, string>): void {
    this.renewList();

    const count = parseInt(data.Count || "0", 10);
    const rawLines: string[] = [];
    for (let i = 0; i < count; i++) {
      const memo = data[i.toString()];
      if (memo) {
        rawLines.push(memo);
      }
    }

    this.memoList = mergeSplitMemoLines(rawLines);
    this.notifyUpdate();
  }

  /**
   * Save memo list to data
   */
  saveList(): Record<string, string> {
    const data: Record<string, string> = {
      Count: this.memoList.length.toString(),
    };

    for (let i = 0; i < this.memoList.length; i++) {
      data[i.toString()] = this.memoList[i];
    }

    return data;
  }

  /**
   * Clear memo list
   */
  renewList(): void {
    this.memoList = [];
    this.notifyUpdate();
  }

  /**
   * Get total count
   */
  getCount(): number {
    return this.memoList.length;
  }

  /**
   * Check if index is valid
   */
  indexInRange(index: number): boolean {
    return index >= 0 && index < this.getCount();
  }

  /**
   * Get memo string at index
   */
  getString(index: number): string {
    if (this.indexInRange(index)) {
      return this.memoList[index];
    }
    return "";
  }

  /**
   * Get all memos
   */
  getAllMemos(): string[] {
    return [...this.memoList];
  }

  /**
   * Add memo text
   * Prepends "●" bullet point and adds to front of list
   */
  addMemo(text: string): void {
    const prefixedText = `●${text}`;
    this.memoList.unshift(prefixedText);
    this.notifyUpdate();
  }

  /**
   * Delete memo text
   * Finds and removes the matching entry
   */
  delMemo(text: string): void {
    const prefixedText = `●${text}`;
    const index = this.memoList.indexOf(prefixedText);
    if (index !== -1) {
      this.memoList.splice(index, 1);
      this.notifyUpdate();
    }
  }

  /**
   * Get all memo items as array
   * Used for saving
   */
  getItems(): string[] {
    return [...this.memoList];
  }

  /**
   * Add a raw item (for loading from save).
   * Does NOT merge — caller should use bulkLoadItems() for old saves
   * that may have split lines.
   */
  addItem(text: string): void {
    this.memoList.push(text);
    this.notifyUpdate();
  }

  /**
   * Bulk load items from save data, merging any split lines
   * for backward compatibility with old saves.
   */
  bulkLoadItems(items: string[]): void {
    this.memoList.push(...mergeSplitMemoLines(items));
    this.notifyUpdate();
  }

  /**
   * Add memo from TalkTextList by ID
   *  which uses TalkTextList.GetTextDetail
   */
  async addToMemo(textId: number): Promise<void> {
    try {
      // Ensure TalkTextList is initialized
      if (!this.talkTextList.isReady()) {
        await this.talkTextList.initialize();
      }
      const detail = this.talkTextList.getTextDetail(textId);
      if (detail) {
        logger.log(`[MemoListManager] Adding memo from ID ${textId}: "${detail.text}"`);
        this.addMemo(detail.text);
      } else {
        logger.warn(`[MemoListManager] Text ID ${textId} not found in TalkTextList`);
      }
    } catch (err) {
      logger.error(`[MemoListManager] Failed to add memo from text ID ${textId}:`, err);
    }
  }

  /**
   * Delete memo by TalkTextList ID
   */
  async delMemoById(textId: number): Promise<void> {
    try {
      // Ensure TalkTextList is initialized
      if (!this.talkTextList.isReady()) {
        await this.talkTextList.initialize();
      }
      const detail = this.talkTextList.getTextDetail(textId);
      if (detail) {
        this.delMemo(detail.text);
      }
    } catch (err) {
      logger.error(`[MemoListManager] Failed to delete memo by text ID ${textId}:`, err);
    }
  }
}
