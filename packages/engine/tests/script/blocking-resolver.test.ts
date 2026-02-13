import { describe, it, expect, vi } from "vitest";
import { BlockingResolver } from "../../src/script/blocking-resolver";

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

describe("BlockingResolver", () => {
  describe("waitForCondition", () => {
    it("resolves immediately when condition is already true", async () => {
      const resolver = new BlockingResolver();
      const promise = resolver.waitForCondition(() => true);
      await expect(promise).resolves.toBeUndefined();
    });

    it("resolves on tick when condition becomes true", async () => {
      const resolver = new BlockingResolver();
      let ready = false;
      const promise = resolver.waitForCondition(() => ready);

      expect(resolver.hasPending).toBe(true);

      resolver.tick(); // still false
      expect(resolver.hasPending).toBe(true);

      ready = true;
      resolver.tick();

      await expect(promise).resolves.toBeUndefined();
      expect(resolver.hasPending).toBe(false);
    });

    it("handles multiple poll waiters", async () => {
      const resolver = new BlockingResolver();
      let condA = false;
      let condB = false;

      const promA = resolver.waitForCondition(() => condA);
      const promB = resolver.waitForCondition(() => condB);

      condA = true;
      resolver.tick();
      await expect(promA).resolves.toBeUndefined();
      expect(resolver.hasPending).toBe(true); // B still pending

      condB = true;
      resolver.tick();
      await expect(promB).resolves.toBeUndefined();
      expect(resolver.hasPending).toBe(false);
    });
  });

  describe("waitForEvent / resolveEvent", () => {
    it("resolves when event is fired", async () => {
      const resolver = new BlockingResolver();
      const promise = resolver.waitForEvent<string>("DIALOG_CLOSED");

      expect(resolver.hasPending).toBe(true);

      resolver.resolveEvent("DIALOG_CLOSED", "ok");
      await expect(promise).resolves.toBe("ok");
      expect(resolver.hasPending).toBe(false);
    });

    it("resolves first waiter only (FIFO)", async () => {
      const resolver = new BlockingResolver();
      const prom1 = resolver.waitForEvent("TEST");
      const prom2 = resolver.waitForEvent("TEST");

      resolver.resolveEvent("TEST", "first");
      await expect(prom1).resolves.toBe("first");

      // prom2 still pending
      expect(resolver.hasPending).toBe(true);

      resolver.resolveEvent("TEST", "second");
      await expect(prom2).resolves.toBe("second");
    });

    it("does nothing when no waiter exists for event", () => {
      const resolver = new BlockingResolver();
      // Should not throw
      expect(() => resolver.resolveEvent("NONEXISTENT")).not.toThrow();
    });
  });

  describe("hasPending", () => {
    it("is false when empty", () => {
      const resolver = new BlockingResolver();
      expect(resolver.hasPending).toBe(false);
    });

    it("is true with poll waiter", () => {
      const resolver = new BlockingResolver();
      resolver.waitForCondition(() => false);
      expect(resolver.hasPending).toBe(true);
    });

    it("is true with event waiter", () => {
      const resolver = new BlockingResolver();
      resolver.waitForEvent("TEST");
      expect(resolver.hasPending).toBe(true);
    });
  });

  describe("clear", () => {
    it("clears all pending waiters", () => {
      const resolver = new BlockingResolver();
      resolver.waitForCondition(() => false);
      resolver.waitForEvent("TEST");
      expect(resolver.hasPending).toBe(true);

      resolver.clear();
      expect(resolver.hasPending).toBe(false);
    });
  });
});
