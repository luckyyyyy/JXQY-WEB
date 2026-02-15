/**
 * EngineLoop — 游戏主循环控制
 * 从 GameEngine 中提取的帧率控制与循环管理
 */

import { logger } from "../core/logger";
import type { PerformanceStats } from "./performance-stats";

// 帧率控制常量
const TARGET_FPS = 60;
const FRAME_INTERVAL = 1000 / TARGET_FPS; // ~16.67ms

/** EngineLoop 所需的外部依赖 */
export interface EngineLoopDeps {
  performanceStats: PerformanceStats;
  getState: () => string;
  setState: (state: "running") => void;
  update: (deltaTime: number) => void;
  render: () => void;
}

/**
 * 游戏主循环控制器
 * 锁定 60 FPS，与 XNA 版本保持一致
 */
export class EngineLoop {
  private animationFrameId = 0;
  private lastTime = 0;
  private nextFrameTime = 0;
  private running = false;

  constructor(private readonly deps: EngineLoopDeps) {}

  get isRunning(): boolean {
    return this.running;
  }

  /**
   * 启动游戏循环
   */
  start(): void {
    if (this.running) {
      logger.warn("[GameEngine] Game loop already running");
      return;
    }

    const state = this.deps.getState();
    if (state !== "running" && state !== "paused" && state !== "loading") {
      logger.error("[GameEngine] Cannot start: not initialized");
      return;
    }

    this.running = true;
    this.lastTime = performance.now();
    this.nextFrameTime = performance.now();
    if (state !== "loading") {
      this.deps.setState("running");
    }

    this.animationFrameId = requestAnimationFrame((time) => this.gameLoop(time));
    logger.log("[GameEngine] Game loop started (60 FPS locked)");
  }

  /**
   * 停止游戏循环
   */
  stop(): void {
    if (!this.running) return;

    this.running = false;
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = 0;
    }
    logger.log("[GameEngine] Game loop stopped");
  }

  /**
   * 游戏主循环
   */
  private gameLoop(timestamp: number): void {
    if (!this.running) return;

    // 帧率控制：检查是否到达下一帧时间
    if (timestamp < this.nextFrameTime) {
      this.animationFrameId = requestAnimationFrame((time) => this.gameLoop(time));
      return;
    }

    // 更新下一帧目标时间（累加方式保持稳定帧率）
    this.nextFrameTime += FRAME_INTERVAL;
    // 防止掉帧后追帧
    if (timestamp - this.nextFrameTime > FRAME_INTERVAL * 2) {
      this.nextFrameTime = timestamp + FRAME_INTERVAL;
    }

    const stats = this.deps.performanceStats;
    const fixedDeltaTime = 1 / TARGET_FPS;

    // 标记帧开始
    stats.beginFrame();

    // 更新游戏逻辑
    stats.beginUpdate();
    this.deps.update(fixedDeltaTime);
    stats.endUpdate();

    // 渲染
    stats.beginRender();
    this.deps.render();
    stats.endRender();

    // 标记帧结束并更新统计
    stats.endFrame(fixedDeltaTime);

    // 继续循环
    this.animationFrameId = requestAnimationFrame((time) => this.gameLoop(time));
  }
}
