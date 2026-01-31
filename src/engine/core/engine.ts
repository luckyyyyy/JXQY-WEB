/**
 * Engine - 游戏引擎核心容器
 *
 * 所有子系统的唯一持有者，提供统一的访问入口
 * 替代之前散落各处的 getXXX() 全局单例函数
 */

import type { EventEmitter } from "./eventEmitter";

/**
 * 引擎上下文 - 包含所有子系统的引用
 * 用于子系统之间的相互访问
 */
export interface EngineContext {
  readonly events: EventEmitter;
}

/**
 * 全局引擎实例
 */
let engineContext: EngineContext | null = null;

/**
 * 初始化引擎上下文
 * 由 GameEngine 在初始化时调用
 */
export function initEngineContext(context: EngineContext): void {
  engineContext = context;
}

/**
 * 获取引擎上下文
 * 这是访问所有子系统的统一入口
 */
export function getEngine(): EngineContext {
  if (!engineContext) {
    throw new Error("[Engine] Engine not initialized. Call initEngineContext first.");
  }
  return engineContext;
}

/**
 * 检查引擎是否已初始化
 */
export function isEngineInitialized(): boolean {
  return engineContext !== null;
}

/**
 * 重置引擎上下文（用于测试）
 */
export function resetEngineContext(): void {
  engineContext = null;
}
