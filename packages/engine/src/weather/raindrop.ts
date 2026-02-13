/**
 * RainDrop - 雨滴粒子（改进版）
 * 基于JxqyHD/Engine/Weather/RainDrop.cs，增加了真实的下落运动
 *
 * 改进点：
 * - 雨滴从屏幕顶部落下，而非固定位置闪烁
 * - 带有风向偏移角度（微斜）
 * - 不同层次的雨滴（近处大快、远处小慢）模拟纵深
 * - 落到屏幕底部后重生在顶部
 */

import type { IRenderer } from "../renderer/i-renderer";

/** 雨滴层级：近/中/远，模拟纵深效果 */
export enum RainLayer {
  /** 远景雨滴：小、慢、暗 */
  Far = 0,
  /** 中景雨滴 */
  Mid = 1,
  /** 近景雨滴：大、快、亮 */
  Near = 2,
}

/** 各层级参数配置（降低透明度，增加尺寸随机） */
const LAYER_CONFIG = [
  // Far — 远景极淡
  { speedMin: 500, speedMax: 900, lengthMin: 5, lengthMax: 16, widthMin: 0.5, widthMax: 1, alphaMin: 0.06, alphaMax: 0.14 },
  // Mid — 中景半透明
  { speedMin: 800, speedMax: 1300, lengthMin: 10, lengthMax: 26, widthMin: 0.8, widthMax: 1.5, alphaMin: 0.1, alphaMax: 0.22 },
  // Near — 近景也不要太亮
  { speedMin: 1200, speedMax: 1800, lengthMin: 16, lengthMax: 36, widthMin: 1, widthMax: 2, alphaMin: 0.15, alphaMax: 0.32 },
] as const;

/** 风向角度（弧度），轻微向右偏 ≈ 5° */
const WIND_ANGLE = 0.087;
const WIND_COS = Math.cos(WIND_ANGLE);
const WIND_SIN = Math.sin(WIND_ANGLE);

export class RainDrop {
  /** 屏幕坐标 */
  x: number;
  y: number;

  /** 下落速度（像素/秒） */
  readonly speed: number;

  /** 雨滴长度 */
  readonly length: number;

  /** 雨滴宽度 */
  readonly width: number;

  /** 层级 */
  readonly layer: RainLayer;

  /** 预缓存的颜色字符串 */
  readonly fillStyle: string;

  /** 风向引起的 X 方向速度分量 */
  readonly windSpeedX: number;

  /** 风向引起的 Y 方向速度分量 */
  readonly windSpeedY: number;

  constructor(x: number, y: number, layer: RainLayer) {
    this.x = x;
    this.y = y;
    this.layer = layer;

    const cfg = LAYER_CONFIG[layer];
    this.speed = cfg.speedMin + Math.random() * (cfg.speedMax - cfg.speedMin);
    this.length = cfg.lengthMin + Math.random() * (cfg.lengthMax - cfg.lengthMin);
    this.width = cfg.widthMin + Math.random() * (cfg.widthMax - cfg.widthMin);

    // 风向分解
    this.windSpeedX = this.speed * WIND_SIN;
    this.windSpeedY = this.speed * WIND_COS;

    // 随机透明度，颜色偏冷色调，更通透
    const alpha = cfg.alphaMin + Math.random() * (cfg.alphaMax - cfg.alphaMin);
    // 色值也加点随机：180-210, 200-220, 220-240
    const r = 180 + Math.floor(Math.random() * 30);
    const g = 200 + Math.floor(Math.random() * 20);
    const b = 220 + Math.floor(Math.random() * 20);
    this.fillStyle = `rgba(${r},${g},${b},${alpha.toFixed(2)})`;
  }

  /**
   * 更新雨滴位置
   */
  update(deltaTime: number): void {
    this.x += this.windSpeedX * deltaTime;
    this.y += this.windSpeedY * deltaTime;
  }

  /**
   * 绘制雨滴：一条带风向倾斜的细线段
   */
  draw(renderer: IRenderer): void {
    const dy = this.length * WIND_COS;

    renderer.fillRect({
      x: this.x,
      y: this.y,
      width: this.width,
      height: dy,
      color: this.fillStyle,
    });

    // 近景雨滴加一小段更亮的头部（模拟水滴反光，降低亮度）
    if (this.layer === RainLayer.Near) {
      renderer.fillRect({
        x: this.x,
        y: this.y + dy * 0.85,
        width: this.width,
        height: Math.min(4, dy * 0.15),
        color: "rgba(220,228,240,0.25)",
      });
    }
  }
}
