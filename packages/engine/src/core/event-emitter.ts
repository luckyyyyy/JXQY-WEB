/**
 * TypedEventEmitter - 类型安全的事件发射器
 * 用于游戏引擎与UI层之间的通信
 */

import { logger } from "./logger";
export type EventCallback<T> = (data: T) => void;

export class TypedEventEmitter<EventMap extends object> {
  private listeners: {
    [K in keyof EventMap]?: Set<EventCallback<EventMap[K]>>;
  } = {};

  /**
   * 订阅事件
   */
  on<K extends keyof EventMap>(event: K, callback: EventCallback<EventMap[K]>): () => void {
    if (!this.listeners[event]) {
      this.listeners[event] = new Set<EventCallback<EventMap[K]>>();
    }
    this.listeners[event]?.add(callback);

    // 返回取消订阅函数
    return () => this.off(event, callback);
  }

  /**
   * 一次性订阅
   */
  once<K extends keyof EventMap>(event: K, callback: EventCallback<EventMap[K]>): () => void {
    const wrapper: EventCallback<EventMap[K]> = (data) => {
      this.off(event, wrapper);
      callback(data);
    };
    return this.on(event, wrapper);
  }

  /**
   * 取消订阅
   */
  off<K extends keyof EventMap>(event: K, callback: EventCallback<EventMap[K]>): void {
    const callbacks = this.listeners[event];
    if (callbacks) {
      callbacks.delete(callback);
      if (callbacks.size === 0) {
        delete this.listeners[event];
      }
    }
  }

  /**
   * 发射事件
   */
  emit<K extends keyof EventMap>(event: K, data: EventMap[K]): void {
    const callbacks = this.listeners[event];
    if (callbacks) {
      callbacks.forEach((callback) => {
        try {
          callback(data);
        } catch (error) {
          logger.error(`[EventEmitter] Error in event handler for '${String(event)}':`, error);
        }
      });
    }
  }

  /**
   * 清除所有监听器
   */
  clear(): void {
    this.listeners = {};
  }

  /**
   * 清除特定事件的所有监听器
   */
  clearEvent<K extends keyof EventMap>(event: K): void {
    delete this.listeners[event];
  }
}
