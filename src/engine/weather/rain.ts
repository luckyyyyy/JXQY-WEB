/**
 * Rain - 雨效果系统
 * 基于 C# JxqyHD/Engine/Weather/Rain.cs
 *
 * 特性：
 * - 随机分布的雨滴粒子
 * - 雨天地图变灰色
 * - 雷声和闪电效果
 * - 背景雨声
 */

import type { AudioManager } from "../audio";
import { logger } from "../core/logger";
import { RainDrop } from "./raindrop";
import { ResourcePath } from "@/config/resourcePaths";

// 下雨时的地图/精灵颜色（灰色）
export const RAIN_COLOR = { r: 128, g: 128, b: 128 };

// 闪电持续时间（毫秒）
const FLASH_MILLISECONDS = 100;

export class Rain {
  /** 雨滴列表 */
  private rainDrops: RainDrop[] = [];

  /** 是否正在下雨 */
  private _isRaining: boolean = false;

  /** 累计时间（用于闪电效果） */
  private elapsedMilliSeconds: number = 0;

  /** 是否正在闪电 */
  private isInFlash: boolean = false;

  /** 音频管理器 */
  private audioManager: AudioManager | null = null;

  /** 雨声 HTML Audio 元素 */
  private rainSoundElement: HTMLAudioElement | null = null;

  /** 屏幕尺寸 */
  private windowWidth: number = 800;
  private windowHeight: number = 600;

  get isRaining(): boolean {
    return this._isRaining;
  }

  /**
   * 初始化雨效果
   */
  constructor(audioManager: AudioManager | null = null) {
    this.audioManager = audioManager;
  }

  /**
   * 设置屏幕尺寸
   */
  setWindowSize(width: number, height: number): void {
    this.windowWidth = width;
    this.windowHeight = height;
  }

  /**
   * 生成雨滴
   * C#: GenerateRainDrops
   * 减少密度以适应更高帧率的 Web 版本
   */
  private generateRainDrops(): void {
    this.rainDrops = [];

    // 在屏幕上生成随机分布的雨滴
    // 比 C# 原版稀疏一些，避免太密集
    // 水平间距：4-16 像素（原版 2-10）
    // 垂直间距：20-150 像素（原版 10-100）
    let w = Math.floor(Math.random() * 12) + 4;
    while (w < this.windowWidth) {
      let h = Math.floor(Math.random() * 130) + 20;
      while (h < this.windowHeight) {
        this.rainDrops.push(new RainDrop(w, h));
        h += Math.floor(Math.random() * 130) + 20;
      }
      w += Math.floor(Math.random() * 12) + 4;
    }
  }

  /**
   * 播放雨声（循环）
   */
  private async playRainSound(): Promise<void> {
    if (this.rainSoundElement) return;

    // 尝试多种音频格式
    const formats = [".ogg", ".mp3", ".wav"];
    const basePath = ResourcePath.sound("背-下雨");

    for (const format of formats) {
      try {
        const audio = new Audio(basePath + format);
        audio.loop = true;
        audio.volume = 0.5;

        await audio.play();
        this.rainSoundElement = audio;
        logger.log(`[Rain] Rain sound started: ${basePath}${format}`);
        return;
      } catch (_e) {
        // 尝试下一个格式
      }
    }

    logger.warn("[Rain] Could not play rain sound");
  }

  /**
   * 停止雨声
   */
  private stopRainSound(): void {
    if (this.rainSoundElement) {
      this.rainSoundElement.pause();
      this.rainSoundElement.currentTime = 0;
      this.rainSoundElement = null;
      logger.log("[Rain] Rain sound stopped");
    }
  }

  /**
   * 开始/停止下雨
   * C#: Raining(bool isRain)
   */
  setRaining(isRain: boolean): void {
    this._isRaining = isRain;
    this.generateRainDrops();
    logger.log(
      `[Rain] setRaining(${isRain}), generated ${this.rainDrops.length} rain drops, windowSize: ${this.windowWidth}x${this.windowHeight}`
    );

    if (this._isRaining) {
      // 播放雨声（循环）
      this.playRainSound();
    } else {
      // 停止雨声
      this.stopRainSound();
    }
  }

  /**
   * 更新雨效果
   * @param deltaTime 时间差（秒）
   * @returns 返回是否需要闪电（用于改变屏幕颜色）
   */
  update(deltaTime: number): { isFlashing: boolean } {
    if (!this._isRaining) {
      return { isFlashing: false };
    }

    // 更新所有雨滴
    for (const drop of this.rainDrops) {
      drop.update();
    }

    // C#: 1/300 概率触发雷声和闪电
    // 随机触发雷声
    if (Math.random() < 1 / 300) {
      this.isInFlash = true;
      this.elapsedMilliSeconds = 0;

      // 播放雷声
      if (this.audioManager) {
        this.audioManager.playSound("背-打雷.wav");
      }
    }

    // 处理闪电持续时间
    if (this.isInFlash) {
      this.elapsedMilliSeconds += deltaTime * 1000;
      if (this.elapsedMilliSeconds >= FLASH_MILLISECONDS) {
        this.elapsedMilliSeconds = 0;
        this.isInFlash = false;
      }
    }

    return { isFlashing: this.isInFlash };
  }

  /**
   * 绘制雨效果
   * @param ctx Canvas 上下文
   */
  draw(ctx: CanvasRenderingContext2D): void {
    if (!this._isRaining) return;

    for (const drop of this.rainDrops) {
      drop.draw(ctx);
    }
  }

  /**
   * 清理资源
   */
  dispose(): void {
    this.stopRainSound();
    this.rainDrops = [];
  }
}
