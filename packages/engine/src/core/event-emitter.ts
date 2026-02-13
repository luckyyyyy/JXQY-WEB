/**
 * EventEmitter - 简单的事件发射器
 * 用于游戏引擎与UI层之间的通信
 */

import { logger } from "./logger";
export type EventCallback<T = unknown> = (data: T) => void;

export class EventEmitter {
  private listeners: Map<string, Set<EventCallback<unknown>>> = new Map();

  /**
   * 订阅事件
   */
  on<T = unknown>(event: string, callback: EventCallback<T>): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)?.add(callback as EventCallback<unknown>);

    // 返回取消订阅函数
    return () => this.off(event, callback);
  }

  /**
   * 一次性订阅
   */
  once<T = unknown>(event: string, callback: EventCallback<T>): () => void {
    const wrapper: EventCallback<T> = (data) => {
      this.off(event, wrapper);
      callback(data);
    };
    return this.on(event, wrapper);
  }

  /**
   * 取消订阅
   */
  off<T = unknown>(event: string, callback: EventCallback<T>): void {
    const callbacks = this.listeners.get(event);
    if (callbacks) {
      callbacks.delete(callback as EventCallback<unknown>);
      if (callbacks.size === 0) {
        this.listeners.delete(event);
      }
    }
  }

  /**
   * 发射事件
   */
  emit<T = unknown>(event: string, data?: T): void {
    const callbacks = this.listeners.get(event);
    if (callbacks) {
      callbacks.forEach((callback) => {
        try {
          callback(data);
        } catch (error) {
          logger.error(`[EventEmitter] Error in event handler for '${event}':`, error);
        }
      });
    }
  }

  /**
   * 清除所有监听器
   */
  clear(): void {
    this.listeners.clear();
  }

  /**
   * 清除特定事件的所有监听器
   */
  clearEvent(event: string): void {
    this.listeners.delete(event);
  }
}
