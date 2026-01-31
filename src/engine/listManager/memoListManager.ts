/**
 * Memo List Manager - based on JxqyHD Engine/ListManager/MemoListManager.cs
 * Manages game memo/quest log entries
 *
 * C# Reference: MemoListManager.cs uses LinkedList<string> to store memos
 * Memos are prefixed with "●" bullet point
 * Text is split into lines of 10 characters max (Chinese)
 */

import { logger } from "../core/logger";
import type { TalkTextListManager } from "./talkTextList";

/**
 * Split string into lines based on character count (for Chinese text display)
 * Based on C#'s Utils.SpliteStringInCharCount
 */
function splitStringInCharCount(text: string, charCount: number): string[] {
  const lines: string[] = [];
  let currentLine = "";
  let currentCount = 0;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    // Chinese characters count as 2, others as 1
    const charWidth = char.charCodeAt(0) > 127 ? 2 : 1;

    if (currentCount + charWidth > charCount * 2) {
      // Line is full, start new line
      lines.push(currentLine);
      currentLine = char;
      currentCount = charWidth;
    } else {
      currentLine += char;
      currentCount += charWidth;
    }
  }

  if (currentLine) {
    lines.push(currentLine);
  }

  return lines;
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
   * Format matches C#: [Memo] section with Count and numbered keys
   */
  loadList(data: Record<string, string>): void {
    this.renewList();

    const count = parseInt(data.Count || "0", 10);
    for (let i = 0; i < count; i++) {
      const memo = data[i.toString()];
      if (memo) {
        this.memoList.push(memo);
      }
    }

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
   * Based on C#: prepends "●", splits into lines, adds to front
   */
  addMemo(text: string): void {
    // Prepend bullet point
    const prefixedText = `●${text}`;

    // Split into lines (10 Chinese characters per line)
    const lines = splitStringInCharCount(prefixedText, 10);

    // Add lines in reverse order to front (so they appear in reading order)
    for (let i = lines.length - 1; i >= 0; i--) {
      this.memoList.unshift(lines[i]);
    }

    this.notifyUpdate();
  }

  /**
   * Delete memo text
   * Based on C#: finds and removes matching lines
   */
  delMemo(text: string): void {
    const prefixedText = `●${text}`;
    const lines = splitStringInCharCount(prefixedText, 10);

    if (lines.length === 0) return;

    // Find matching sequence in memo list
    for (let i = 0; i <= this.memoList.length - lines.length; i++) {
      if (this.memoList[i] === lines[0]) {
        let found = true;
        for (let j = 1; j < lines.length; j++) {
          if (this.memoList[i + j] !== lines[j]) {
            found = false;
            break;
          }
        }

        if (found) {
          // Remove the matching lines
          this.memoList.splice(i, lines.length);
          this.notifyUpdate();
          return;
        }
      }
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
   * Add a raw item (for loading from save)
   */
  addItem(text: string): void {
    this.memoList.push(text);
    this.notifyUpdate();
  }

  /**
   * Add memo from TalkTextList by ID
   * Based on C#'s AddToMemo which uses TalkTextList.GetTextDetail
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
