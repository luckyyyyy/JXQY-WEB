/**
 * WeatherManager - 天气管理器
 * 基于 C# JxqyHD/Engine/Weather/WeatherManager.cs
 *
 * 统一管理雨、雪等天气效果
 */

import type { AudioManager } from "../audio";
import { RAIN_COLOR, Rain } from "./rain";
import { Snow } from "./snow";

export class WeatherManager {
  private rain: Rain;
  private snow: Snow;

  /** 当前是否下雨 */
  get isRaining(): boolean {
    return this.rain.isRaining;
  }

  /** 当前是否下雪 */
  get isSnowing(): boolean {
    return this.snow.isSnowing;
  }

  /** 下雨时使用的颜色 */
  get rainColor(): { r: number; g: number; b: number } {
    return RAIN_COLOR;
  }

  /** 当前是否正在闪电 */
  private _isFlashing: boolean = false;
  get isFlashing(): boolean {
    return this._isFlashing;
  }

  constructor(audioManager: AudioManager | null = null) {
    this.rain = new Rain(audioManager);
    this.snow = new Snow();
  }

  /**
   * 设置屏幕尺寸
   */
  setWindowSize(width: number, height: number): void {
    this.rain.setWindowSize(width, height);
    this.snow.setWindowSize(width, height);
  }

  /**
   * 显示/隐藏雪效果
   * C#: ShowSnow(bool isShow)
   */
  showSnow(isShow: boolean): void {
    this.snow.show(isShow);
  }

  /**
   * 开始下雨
   * C#: BeginRain(string fileName)
   * 注：fileName 在 C# 中用于指定雨声文件，这里简化处理
   */
  beginRain(_fileName?: string): void {
    this.rain.setRaining(true);
  }

  /**
   * 停止下雨
   * C#: StopRain()
   */
  stopRain(): void {
    this.rain.setRaining(false);
  }

  /**
   * 更新天气效果
   * @param deltaTime 时间差（秒）
   * @param cameraX 相机 X 位置
   * @param cameraY 相机 Y 位置
   */
  update(deltaTime: number, cameraX: number, cameraY: number): void {
    // 更新雨效果
    const rainResult = this.rain.update(deltaTime);
    this._isFlashing = rainResult.isFlashing;

    // 更新雪效果
    this.snow.update(deltaTime, cameraX, cameraY);
  }

  /**
   * 绘制天气效果
   * 注意：应在所有游戏内容绘制完成后调用
   */
  draw(ctx: CanvasRenderingContext2D, cameraX: number, cameraY: number): void {
    // 绘制雨（仅在下雨时）
    if (this.isRaining) {
      this.rain.draw(ctx);
    }

    // 绘制雪
    this.snow.draw(ctx, cameraX, cameraY);
  }

  /**
   * 清理资源
   */
  dispose(): void {
    this.rain.dispose();
    this.snow.dispose();
  }
}
