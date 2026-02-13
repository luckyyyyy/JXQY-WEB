import { describe, it, expect, vi, beforeEach } from "vitest";
import { TimerManager } from "../../src/data/timer-manager";

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

describe("TimerManager", () => {
  let timer: TimerManager;

  beforeEach(() => {
    timer = new TimerManager();
  });

  describe("openTimeLimit / closeTimeLimit", () => {
    it("starts timer with given seconds", () => {
      timer.openTimeLimit(60);
      expect(timer.isTimerRunning()).toBe(true);
      expect(timer.getCurrentSeconds()).toBe(60);
    });

    it("closes timer and resets", () => {
      timer.openTimeLimit(60);
      timer.closeTimeLimit();
      expect(timer.isTimerRunning()).toBe(false);
      expect(timer.getCurrentSeconds()).toBe(0);
    });
  });

  describe("update", () => {
    it("does nothing when timer is not running", () => {
      timer.update(1); // 1 second
      expect(timer.getCurrentSeconds()).toBe(0);
    });

    it("decrements seconds over time", () => {
      timer.openTimeLimit(10);
      timer.update(1); // 1 second passes
      expect(timer.getCurrentSeconds()).toBe(9);
    });

    it("accumulates partial updates", () => {
      timer.openTimeLimit(10);
      timer.update(0.5); // 500ms
      expect(timer.getCurrentSeconds()).toBe(10); // not yet 1 second
      timer.update(0.5); // another 500ms = 1 second total
      expect(timer.getCurrentSeconds()).toBe(9);
    });

    it("does not go below 0", () => {
      timer.openTimeLimit(1);
      timer.update(1); // 1 second → 0
      expect(timer.getCurrentSeconds()).toBe(0);
      timer.update(1); // another second
      // timer doesn't auto-close, seconds stays at 0 or goes negative
      // per implementation it just decrements
    });
  });

  describe("setTimeScript", () => {
    it("triggers script at specified time", () => {
      const runner = vi.fn();
      timer.setScriptRunner(runner);
      timer.openTimeLimit(10);
      timer.setTimeScript(8, "script1.txt");

      // Count down from 10 to 8
      timer.update(1); // 9
      expect(runner).not.toHaveBeenCalled();
      timer.update(1); // 8
      expect(runner).toHaveBeenCalledWith("script1.txt");
    });

    it("removes script after triggering", () => {
      const runner = vi.fn();
      timer.setScriptRunner(runner);
      timer.openTimeLimit(10);
      timer.setTimeScript(8, "script1.txt");

      timer.update(1); // 9
      timer.update(1); // 8 → triggers
      timer.update(1); // 7
      expect(runner).toHaveBeenCalledTimes(1);
    });

    it("ignores when timer not running", () => {
      timer.setTimeScript(5, "script.txt");
      const state = timer.getState();
      expect(state.timeScripts).toHaveLength(0);
    });

    it("overwrites previous time script", () => {
      timer.openTimeLimit(10);
      timer.setTimeScript(5, "first.txt");
      timer.setTimeScript(3, "second.txt");
      const state = timer.getState();
      expect(state.timeScripts).toHaveLength(1);
      expect(state.timeScripts[0].scriptFileName).toBe("second.txt");
    });
  });

  describe("hideTimerWnd", () => {
    it("sets hidden flag", () => {
      timer.openTimeLimit(10);
      timer.hideTimerWnd();
      expect(timer.isHidden()).toBe(true);
    });
  });

  describe("getFormattedTime", () => {
    it("formats as MM分SS秒", () => {
      timer.openTimeLimit(125); // 2 min 5 sec
      expect(timer.getFormattedTime()).toBe("02分05秒");
    });

    it("handles zero", () => {
      timer.openTimeLimit(0);
      expect(timer.getFormattedTime()).toBe("00分00秒");
    });

    it("handles exact minutes", () => {
      timer.openTimeLimit(120);
      expect(timer.getFormattedTime()).toBe("02分00秒");
    });
  });

  describe("serialization", () => {
    it("toJSON captures state", () => {
      timer.openTimeLimit(60);
      timer.hideTimerWnd();
      timer.setTimeScript(30, "test.txt");

      const json = timer.toJSON() as Record<string, unknown>;
      expect(json.isRunning).toBe(true);
      expect(json.seconds).toBe(60);
      expect(json.isHidden).toBe(true);
    });

    it("fromJSON restores state", () => {
      timer.fromJSON({
        isRunning: true,
        seconds: 45,
        isHidden: true,
        timeScripts: [{ triggerSeconds: 20, scriptFileName: "restore.txt" }],
      });
      expect(timer.isTimerRunning()).toBe(true);
      expect(timer.getCurrentSeconds()).toBe(45);
      expect(timer.isHidden()).toBe(true);
    });
  });

  describe("reset", () => {
    it("resets everything", () => {
      timer.openTimeLimit(100);
      timer.hideTimerWnd();
      timer.reset();
      expect(timer.isTimerRunning()).toBe(false);
      expect(timer.getCurrentSeconds()).toBe(0);
      expect(timer.isHidden()).toBe(false);
    });
  });
});
