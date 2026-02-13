/**
 * BlockingResolver - Bridges frame-based polling and event callbacks to Promises
 *
 * Used internally by GameAPI implementations to convert blocking operations
 * (movement, dialog, fade effects, etc.) into Promises that both the DSL
 * executor and future JS/Lua engines can `await`.
 *
 * Two resolution mechanisms:
 * - waitForCondition(pollFn): resolved when pollFn returns true (checked each tick)
 * - waitForEvent(name): resolved when resolveEvent(name, value) is called externally
 *
 * The executor calls `tick()` every frame to advance poll-based waiters.
 * UI callbacks (dialog closed, selection made) call `resolveEvent()`.
 */

import { logger } from "../core/logger";

// ===== Well-known event names =====
export const BlockingEvent = {
  DIALOG_CLOSED: "DIALOG_CLOSED",
  SELECTION_MADE: "SELECTION_MADE",
  CHOOSE_MULTIPLE_DONE: "CHOOSE_MULTIPLE_DONE",
} as const;

interface PollWaiter {
  pollFn: () => boolean;
  resolve: () => void;
}

interface EventWaiter {
  resolve: (value: unknown) => void;
}

export class BlockingResolver {
  private pollWaiters: PollWaiter[] = [];
  private eventWaiters = new Map<string, EventWaiter[]>();

  /**
   * Wait until pollFn returns true. Checked each tick().
   */
  waitForCondition(pollFn: () => boolean): Promise<void> {
    // Resolve immediately if already satisfied
    if (pollFn()) return Promise.resolve();

    return new Promise<void>((resolve) => {
      this.pollWaiters.push({ pollFn, resolve });
    });
  }

  /**
   * Wait for a named event to be resolved externally.
   * Returns the value passed to resolveEvent().
   */
  waitForEvent<T = void>(eventName: string): Promise<T> {
    return new Promise<T>((resolve) => {
      const waiters = this.eventWaiters.get(eventName) ?? [];
      waiters.push({ resolve: resolve as (value: unknown) => void });
      this.eventWaiters.set(eventName, waiters);
    });
  }

  /**
   * Resolve a named event, waking up the first waiter.
   */
  resolveEvent(eventName: string, value?: unknown): void {
    const waiters = this.eventWaiters.get(eventName);
    if (!waiters || waiters.length === 0) {
      logger.debug(`[BlockingResolver] resolveEvent: no waiter for "${eventName}"`);
      return;
    }
    const waiter = waiters.shift()!;
    if (waiters.length === 0) {
      this.eventWaiters.delete(eventName);
    }
    waiter.resolve(value);
  }

  /**
   * Check all poll-based waiters. Call this every frame from the executor's update().
   */
  tick(): void {
    const remaining: PollWaiter[] = [];
    for (const waiter of this.pollWaiters) {
      if (waiter.pollFn()) {
        waiter.resolve();
      } else {
        remaining.push(waiter);
      }
    }
    this.pollWaiters = remaining;
  }

  /**
   * Whether there are any pending poll or event waiters.
   * Used by executor to know if a blocking operation is in progress.
   */
  get hasPending(): boolean {
    if (this.pollWaiters.length > 0) return true;
    for (const waiters of this.eventWaiters.values()) {
      if (waiters.length > 0) return true;
    }
    return false;
  }

  /**
   * Clear all pending waiters (e.g., when stopping all scripts).
   */
  clear(): void {
    this.pollWaiters = [];
    this.eventWaiters.clear();
  }
}
