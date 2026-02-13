import { describe, it, expect, vi } from "vitest";
import { EventEmitter } from "../../src/core/event-emitter";

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

describe("EventEmitter", () => {
  it("calls listener when event is emitted", () => {
    const emitter = new EventEmitter();
    const callback = vi.fn();
    emitter.on("test", callback);
    emitter.emit("test", "data");
    expect(callback).toHaveBeenCalledWith("data");
  });

  it("supports multiple listeners on same event", () => {
    const emitter = new EventEmitter();
    const cb1 = vi.fn();
    const cb2 = vi.fn();
    emitter.on("test", cb1);
    emitter.on("test", cb2);
    emitter.emit("test", 42);
    expect(cb1).toHaveBeenCalledWith(42);
    expect(cb2).toHaveBeenCalledWith(42);
  });

  it("does not call unrelated listeners", () => {
    const emitter = new EventEmitter();
    const cb = vi.fn();
    emitter.on("other", cb);
    emitter.emit("test");
    expect(cb).not.toHaveBeenCalled();
  });

  it("returns unsubscribe function from on()", () => {
    const emitter = new EventEmitter();
    const cb = vi.fn();
    const unsub = emitter.on("test", cb);
    unsub();
    emitter.emit("test");
    expect(cb).not.toHaveBeenCalled();
  });

  it("off() removes the listener", () => {
    const emitter = new EventEmitter();
    const cb = vi.fn();
    emitter.on("test", cb);
    emitter.off("test", cb);
    emitter.emit("test");
    expect(cb).not.toHaveBeenCalled();
  });

  it("once() only fires once", () => {
    const emitter = new EventEmitter();
    const cb = vi.fn();
    emitter.once("test", cb);
    emitter.emit("test", "first");
    emitter.emit("test", "second");
    expect(cb).toHaveBeenCalledTimes(1);
    expect(cb).toHaveBeenCalledWith("first");
  });

  it("clear() removes all listeners", () => {
    const emitter = new EventEmitter();
    const cb1 = vi.fn();
    const cb2 = vi.fn();
    emitter.on("a", cb1);
    emitter.on("b", cb2);
    emitter.clear();
    emitter.emit("a");
    emitter.emit("b");
    expect(cb1).not.toHaveBeenCalled();
    expect(cb2).not.toHaveBeenCalled();
  });

  it("clearEvent() removes listeners for specific event", () => {
    const emitter = new EventEmitter();
    const cb1 = vi.fn();
    const cb2 = vi.fn();
    emitter.on("a", cb1);
    emitter.on("b", cb2);
    emitter.clearEvent("a");
    emitter.emit("a");
    emitter.emit("b");
    expect(cb1).not.toHaveBeenCalled();
    expect(cb2).toHaveBeenCalled();
  });

  it("handles emit with no data", () => {
    const emitter = new EventEmitter();
    const cb = vi.fn();
    emitter.on("test", cb);
    emitter.emit("test");
    expect(cb).toHaveBeenCalledWith(undefined);
  });

  it("catches and logs errors in handlers", () => {
    const emitter = new EventEmitter();
    const errorCb = vi.fn(() => {
      throw new Error("oops");
    });
    const normalCb = vi.fn();
    emitter.on("test", errorCb);
    emitter.on("test", normalCb);
    // Should not throw
    emitter.emit("test");
    expect(normalCb).toHaveBeenCalled();
  });

  it("emit on non-existing event does nothing", () => {
    const emitter = new EventEmitter();
    expect(() => emitter.emit("nonexistent")).not.toThrow();
  });
});
