/**
 * TalkTextList - based on JxqyHD Engine/ListManager/TalkTextList.cs
 * Manages dialog text data loaded from TalkIndex.txt
 */

export interface TalkTextDetail {
  index: number;
  portraitIndex: number;
  text: string;
}

class TalkTextListManager {
  private list: TalkTextDetail[] = [];
  private isInitialized = false;

  /**
   * Initialize the talk text list from TalkIndex.txt
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    const path = "/resources/Content/TalkIndex.txt";
    try {
      const response = await fetch(path);
      if (!response.ok) {
        console.warn(`Failed to load TalkIndex.txt: ${response.status}`);
        return;
      }

      // Try to decode as GB2312/GBK for Chinese characters
      const buffer = await response.arrayBuffer();
      const bytes = new Uint8Array(buffer);

      let content: string;
      try {
        // Try GB2312/GBK first (for Chinese game content)
        const decoder = new TextDecoder("gb2312");
        content = decoder.decode(bytes);
      } catch {
        try {
          // Fallback to GBK
          const decoder = new TextDecoder("gbk");
          content = decoder.decode(bytes);
        } catch {
          // Last resort: UTF-8
          const decoder = new TextDecoder("utf-8");
          content = decoder.decode(bytes);
        }
      }

      this.parseContent(content);
      this.isInitialized = true;
      console.log(`[TalkTextList] Loaded ${this.list.length} dialog entries`);
    } catch (error) {
      console.error(`Error loading TalkIndex.txt:`, error);
    }
  }

  /**
   * Parse TalkIndex.txt content
   * Format: [index,portraitIndex]text
   */
  private parseContent(content: string): void {
    const lines = content.split("\n");
    const regex = /^\[([0-9]+),([0-9]+)\](.*)$/;

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      const match = trimmed.match(regex);
      if (match) {
        const index = parseInt(match[1], 10);
        const portraitIndex = parseInt(match[2], 10);
        const text = match[3];
        this.list.push({ index, portraitIndex, text });
      }
    }

    // Sort by index for binary search optimization
    this.list.sort((a, b) => a.index - b.index);
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
      console.warn(`[TalkTextList] Dialog index not found: ${from} - ${to}`);
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

// Singleton instance
let talkTextListInstance: TalkTextListManager | null = null;

export function getTalkTextList(): TalkTextListManager {
  if (!talkTextListInstance) {
    talkTextListInstance = new TalkTextListManager();
  }
  return talkTextListInstance;
}

export function resetTalkTextList(): void {
  talkTextListInstance = null;
}
