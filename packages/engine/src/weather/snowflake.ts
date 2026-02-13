/**
 * SnowFlake - 雪花粒子（改进版）
 * 基于JxqyHD/Engine/Weather/SnowFlake.cs
 *
 * 改进点：
 * - 横向正弦摆动，模拟真实雪花飘落
 * - 多种大小/透明度，营造纵深
 * - 旋转感（通过绘制形状变化模拟）
 * - 更大的雪花使用柔和渐变纹理
 */

import type { IRenderer } from "../renderer/i-renderer";

/** 雪花形状类型（0-3: 小型像素 | 4-5: 大型柔和） */
export type SnowFlakeType = 0 | 1 | 2 | 3 | 4 | 5;

/** 大型雪花预渲染纹理缓存 */
const snowTextureCache = new Map<number, OffscreenCanvas>();

/** 预渲染柔和雪花纹理 */
function getLargeSnowTexture(size: number): OffscreenCanvas {
  const key = Math.round(size);
  const cached = snowTextureCache.get(key);
  if (cached) return cached;

  const dim = Math.ceil(size * 2 + 2);
  const canvas = new OffscreenCanvas(dim, dim);
  const ctx = canvas.getContext("2d");
  if (!ctx) return canvas;

  const cx = dim / 2;
  const cy = dim / 2;

  // 柔和的径向渐变雪花
  const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, size);
  grad.addColorStop(0, "rgba(255,255,255,0.9)");
  grad.addColorStop(0.3, "rgba(240,245,255,0.6)");
  grad.addColorStop(0.6, "rgba(220,230,245,0.25)");
  grad.addColorStop(1, "rgba(210,220,240,0)");

  ctx.beginPath();
  ctx.arc(cx, cy, size, 0, Math.PI * 2);
  ctx.fillStyle = grad;
  ctx.fill();

  snowTextureCache.set(key, canvas);
  return canvas;
}

export class SnowFlake {
  /** 在世界中的位置 */
  positionInWorld: { x: number; y: number };

  /** 移动方向（归一化向量） */
  private direction: { x: number; y: number };

  /** 移动速度（像素/秒） */
  private velocity: number;

  /** 已移动的 Y 距离（用于判断是否飘出屏幕） */
  movedYDistance: number = 0;

  /** 雪花类型（决定外观） */
  readonly type: SnowFlakeType;

  /** 横向摆动相位（弧度） */
  private swayPhase: number;

  /** 横向摆动幅度（像素） */
  private swayAmplitude: number;

  /** 横向摆动频率（弧度/秒） */
  private swayFrequency: number;

  /** 累计时间 */
  private elapsed: number = 0;

  /** 透明度（大雪花用） */
  readonly alpha: number;

  /** 大型雪花尺寸 */
  readonly size: number;

  constructor(
    positionInWorld: { x: number; y: number },
    direction: { x: number; y: number },
    velocity: number,
    type: SnowFlakeType
  ) {
    this.positionInWorld = { ...positionInWorld };
    this.velocity = velocity;
    this.type = type;

    // 归一化方向向量
    const len = Math.sqrt(direction.x * direction.x + direction.y * direction.y);
    if (len > 0) {
      this.direction = { x: direction.x / len, y: direction.y / len };
    } else {
      this.direction = { x: 0, y: 1 };
    }

    // 随机摆动参数
    this.swayPhase = Math.random() * Math.PI * 2;
    this.swayAmplitude = 8 + Math.random() * 20;
    this.swayFrequency = 1.5 + Math.random() * 2;

    // 大型雪花参数
    if (type >= 4) {
      this.size = type === 4 ? 3 + Math.random() * 2 : 5 + Math.random() * 3;
      this.alpha = type === 4 ? 0.4 + Math.random() * 0.3 : 0.5 + Math.random() * 0.35;
    } else {
      this.size = 1;
      this.alpha = 1;
    }
  }

  /**
   * 更新雪花位置
   */
  update(deltaTime: number): void {
    this.elapsed += deltaTime;

    const moveX = this.direction.x * this.velocity * deltaTime;
    const moveY = this.direction.y * this.velocity * deltaTime;

    // 加入横向正弦摆动
    const swayOffset = Math.sin(this.elapsed * this.swayFrequency + this.swayPhase) * this.swayAmplitude * deltaTime;

    this.positionInWorld.x += moveX + swayOffset;
    this.positionInWorld.y += moveY;
    this.movedYDistance += Math.abs(moveY);
  }

  /**
   * 绘制雪花
   */
  draw(renderer: IRenderer, cameraX: number, cameraY: number, color: string): void {
    const screenX = this.positionInWorld.x - cameraX;
    const screenY = this.positionInWorld.y - cameraY;

    // 大型柔和雪花：使用预渲染纹理
    if (this.type >= 4) {
      const tex = getLargeSnowTexture(this.size);
      renderer.save();
      renderer.setAlpha(this.alpha);
      renderer.drawSource(tex, Math.round(screenX - tex.width / 2), Math.round(screenY - tex.height / 2));
      renderer.restore();
      return;
    }

    // 小型像素雪花：保留原版风格但微调
    switch (this.type) {
      case 0:
        // 3x3 十字形
        renderer.fillRect({ x: screenX + 1, y: screenY, width: 1, height: 1, color });
        renderer.fillRect({ x: screenX, y: screenY + 1, width: 3, height: 1, color });
        renderer.fillRect({ x: screenX + 1, y: screenY + 2, width: 1, height: 1, color });
        break;

      case 1:
        // 2x2 对角线（左上-右下）
        renderer.fillRect({ x: screenX + 1, y: screenY, width: 1, height: 1, color });
        renderer.fillRect({ x: screenX, y: screenY + 1, width: 1, height: 1, color });
        break;

      case 2:
        // 2x2 对角线（右上-左下）
        renderer.fillRect({ x: screenX, y: screenY, width: 1, height: 1, color });
        renderer.fillRect({ x: screenX + 1, y: screenY + 1, width: 1, height: 1, color });
        break;

      case 3:
        // 1x1 单点
        renderer.fillRect({ x: screenX, y: screenY, width: 1, height: 1, color });
        break;
    }
  }
}

/**
 * 清除雪花纹理缓存
 */
export function clearSnowTextureCache(): void {
  snowTextureCache.clear();
}
