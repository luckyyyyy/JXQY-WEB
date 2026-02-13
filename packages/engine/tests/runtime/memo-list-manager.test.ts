import { describe, it, expect, vi, beforeEach } from "vitest";
import { MemoListManager } from "../../src/runtime/memo-list-manager";

// Mock logger
vi.mock("../../src/core/logger", () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    log: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock TalkTextListManager
function makeMockTalkTextList() {
  return {
    isReady: () => true,
    initialize: vi.fn(),
    getTextDetail: vi.fn().mockReturnValue(null),
  } as never;
}

describe("MemoListManager", () => {
  let manager: MemoListManager;

  beforeEach(() => {
    manager = new MemoListManager(makeMockTalkTextList());
  });

  describe("addMemo / getAllMemos", () => {
    it("adds memo with bullet prefix", () => {
      manager.addMemo("找到了宝剑");
      const memos = manager.getAllMemos();
      expect(memos).toHaveLength(1);
      expect(memos[0]).toBe("●找到了宝剑");
    });

    it("adds memos to the front (newest first)", () => {
      manager.addMemo("first");
      manager.addMemo("second");
      const memos = manager.getAllMemos();
      expect(memos[0]).toBe("●second");
      expect(memos[1]).toBe("●first");
    });
  });

  describe("delMemo", () => {
    it("removes matching memo", () => {
      manager.addMemo("test");
      manager.delMemo("test");
      expect(manager.getCount()).toBe(0);
    });

    it("does nothing for non-existing memo", () => {
      manager.addMemo("keep");
      manager.delMemo("not-existing");
      expect(manager.getCount()).toBe(1);
    });
  });

  describe("loadList", () => {
    it("loads memos from save data format", () => {
      manager.loadList({
        Count: "3",
        "0": "●任务一",
        "1": "●任务二",
        "2": "●任务三",
      });
      expect(manager.getCount()).toBe(3);
      expect(manager.getString(0)).toBe("●任务一");
    });

    it("merges split lines from old save format", () => {
      manager.loadList({
        Count: "4",
        "0": "●这是一个很长的",
        "1": "任务描述需要合",
        "2": "并在一起",
        "3": "●第二个任务",
      });
      expect(manager.getCount()).toBe(2);
      expect(manager.getString(0)).toBe("●这是一个很长的任务描述需要合并在一起");
      expect(manager.getString(1)).toBe("●第二个任务");
    });
  });

  describe("saveList", () => {
    it("serializes memos to save format", () => {
      manager.addMemo("任务一");
      manager.addMemo("任务二");
      const data = manager.saveList();
      expect(data.Count).toBe("2");
      expect(data["0"]).toBe("●任务二"); // newest first
      expect(data["1"]).toBe("●任务一");
    });
  });

  describe("renewList", () => {
    it("clears all memos", () => {
      manager.addMemo("test1");
      manager.addMemo("test2");
      manager.renewList();
      expect(manager.getCount()).toBe(0);
    });
  });

  describe("indexInRange", () => {
    it("returns true for valid index", () => {
      manager.addMemo("test");
      expect(manager.indexInRange(0)).toBe(true);
    });

    it("returns false for out-of-range index", () => {
      expect(manager.indexInRange(0)).toBe(false);
      expect(manager.indexInRange(-1)).toBe(false);
    });
  });

  describe("getString", () => {
    it("returns memo at index", () => {
      manager.addMemo("hello");
      expect(manager.getString(0)).toBe("●hello");
    });

    it("returns empty string for invalid index", () => {
      expect(manager.getString(99)).toBe("");
    });
  });

  describe("onUpdate callback", () => {
    it("fires on addMemo", () => {
      const callback = vi.fn();
      manager.onUpdate(callback);
      manager.addMemo("test");
      expect(callback).toHaveBeenCalled();
    });

    it("fires on delMemo", () => {
      manager.addMemo("test");
      const callback = vi.fn();
      manager.onUpdate(callback);
      manager.delMemo("test");
      expect(callback).toHaveBeenCalled();
    });

    it("unsubscribe stops callbacks", () => {
      const callback = vi.fn();
      const unsub = manager.onUpdate(callback);
      unsub();
      manager.addMemo("test");
      expect(callback).not.toHaveBeenCalled();
    });
  });

  describe("bulkLoadItems", () => {
    it("loads and merges items", () => {
      manager.bulkLoadItems(["●a", "continuation", "●b"]);
      expect(manager.getCount()).toBe(2);
      expect(manager.getString(0)).toBe("●acontinuation");
      expect(manager.getString(1)).toBe("●b");
    });
  });
});
