/**
 * 性能统计系统
 *
 * 追踪游戏循环的 FPS、帧时间、Update/Render 耗时等
 */

/**
 * 性能统计数据
 */
export interface PerformanceStatsData {
  // FPS 相关
  fps: number; // 当前 FPS
  fpsMin: number; // 最近一段时间的最低 FPS
  fpsMax: number; // 最近一段时间的最高 FPS
  fpsAvg: number; // 平均 FPS

  // 帧时间（毫秒）
  frameTime: number; // 当前帧时间
  frameTimeAvg: number; // 平均帧时间

  // 各阶段耗时（毫秒）
  updateTime: number; // Update 阶段耗时
  renderTime: number; // Render 阶段耗时
  updateTimeAvg: number; // 平均 Update 耗时
  renderTimeAvg: number; // 平均 Render 耗时

  // 对象统计
  npcsInView: number; // 视野内 NPC 数量
  objsInView: number; // 视野内 Obj 数量
  magicSprites: number; // 武功精灵数量

  // 帧数统计
  totalFrames: number; // 总帧数
  droppedFrames: number; // 丢帧数（帧时间 > 33ms，即低于 30fps）

  // 渲染器信息
  rendererType: "canvas2d" | "webgl" | "none"; // 渲染后端类型
  drawCalls: number; // 绘制调用次数
  spriteCount: number; // 绘制的精灵数量
  rectCount: number; // 绘制的矩形数量
  textureSwaps: number; // 纹理切换次数
  textureCount: number; // 已上传纹理总数
}

/**
 * 性能统计器
 */
export class PerformanceStats {
  // 采样缓冲区大小（用于计算平均值）
  private readonly SAMPLE_SIZE = 60; // 约 1 秒的采样

  // FPS 采样
  private fpsSamples: number[] = [];
  private lastFpsTime = 0;
  private frameCount = 0;
  private currentFps = 0;

  // 帧时间采样
  private frameTimeSamples: number[] = [];

  // Update/Render 时间采样
  private updateTimeSamples: number[] = [];
  private renderTimeSamples: number[] = [];

  // 当前帧的测量值
  private currentFrameTime = 0;
  private currentUpdateTime = 0;
  private currentRenderTime = 0;

  // 对象统计
  private npcsInView = 0;
  private objsInView = 0;
  private magicSprites = 0;

  // 帧统计
  private totalFrames = 0;
  private droppedFrames = 0;

  // 临时变量用于测量
  private updateStartTime = 0;
  private renderStartTime = 0;

  /**
   * 标记帧开始
   */
  beginFrame(): void {
    this.totalFrames++;
  }

  /**
   * 标记 Update 阶段开始
   */
  beginUpdate(): void {
    this.updateStartTime = performance.now();
  }

  /**
   * 标记 Update 阶段结束
   */
  endUpdate(): void {
    this.currentUpdateTime = performance.now() - this.updateStartTime;
    this.addSample(this.updateTimeSamples, this.currentUpdateTime);
  }

  /**
   * 标记 Render 阶段开始
   */
  beginRender(): void {
    this.renderStartTime = performance.now();
  }

  /**
   * 标记 Render 阶段结束
   */
  endRender(): void {
    this.currentRenderTime = performance.now() - this.renderStartTime;
    this.addSample(this.renderTimeSamples, this.currentRenderTime);
  }

  /**
   * 更新帧统计（在帧结束时调用）
   */
  endFrame(deltaTime: number): void {
    // 帧时间（转换为毫秒）
    this.currentFrameTime = deltaTime * 1000;
    this.addSample(this.frameTimeSamples, this.currentFrameTime);

    // 检测丢帧（帧时间超过 33ms，即低于 30fps）
    if (this.currentFrameTime > 33) {
      this.droppedFrames++;
    }

    // 更新 FPS
    this.frameCount++;
    const now = performance.now();
    const elapsed = now - this.lastFpsTime;

    // 每 500ms 更新一次 FPS
    if (elapsed >= 500) {
      this.currentFps = Math.round((this.frameCount * 1000) / elapsed);
      this.addSample(this.fpsSamples, this.currentFps);
      this.frameCount = 0;
      this.lastFpsTime = now;
    }
  }

  /**
   * 更新对象统计
   */
  updateObjectStats(npcsInView: number, objsInView: number, magicSprites: number): void {
    this.npcsInView = npcsInView;
    this.objsInView = objsInView;
    this.magicSprites = magicSprites;
  }

  /**
   * 获取统计数据
   */
  getStats(rendererInfo?: {
    type: "canvas2d" | "webgl";
    drawCalls: number;
    spriteCount: number;
    rectCount: number;
    textureSwaps: number;
    textureCount: number;
  }): PerformanceStatsData {
    return {
      fps: this.currentFps,
      fpsMin: this.fpsSamples.length > 0 ? Math.min(...this.fpsSamples) : 0,
      fpsMax: this.fpsSamples.length > 0 ? Math.max(...this.fpsSamples) : 0,
      fpsAvg: this.calculateAverage(this.fpsSamples),

      frameTime: this.currentFrameTime,
      frameTimeAvg: this.calculateAverage(this.frameTimeSamples),

      updateTime: this.currentUpdateTime,
      renderTime: this.currentRenderTime,
      updateTimeAvg: this.calculateAverage(this.updateTimeSamples),
      renderTimeAvg: this.calculateAverage(this.renderTimeSamples),

      npcsInView: this.npcsInView,
      objsInView: this.objsInView,
      magicSprites: this.magicSprites,

      totalFrames: this.totalFrames,
      droppedFrames: this.droppedFrames,

      rendererType: rendererInfo?.type ?? "none",
      drawCalls: rendererInfo?.drawCalls ?? 0,
      spriteCount: rendererInfo?.spriteCount ?? 0,
      rectCount: rendererInfo?.rectCount ?? 0,
      textureSwaps: rendererInfo?.textureSwaps ?? 0,
      textureCount: rendererInfo?.textureCount ?? 0,
    };
  }

  /**
   * 重置统计
   */
  reset(): void {
    this.fpsSamples = [];
    this.frameTimeSamples = [];
    this.updateTimeSamples = [];
    this.renderTimeSamples = [];
    this.currentFps = 0;
    this.currentFrameTime = 0;
    this.currentUpdateTime = 0;
    this.currentRenderTime = 0;
    this.totalFrames = 0;
    this.droppedFrames = 0;
    this.frameCount = 0;
    this.lastFpsTime = 0;
  }

  /**
   * 添加采样值到缓冲区
   */
  private addSample(samples: number[], value: number): void {
    samples.push(value);
    if (samples.length > this.SAMPLE_SIZE) {
      samples.shift();
    }
  }

  /**
   * 计算平均值
   */
  private calculateAverage(samples: number[]): number {
    if (samples.length === 0) return 0;
    const sum = samples.reduce((a, b) => a + b, 0);
    return Math.round((sum / samples.length) * 10) / 10;
  }
}
