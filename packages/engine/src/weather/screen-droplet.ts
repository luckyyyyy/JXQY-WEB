/**
 * ScreenDroplet - 屏幕上的水滴（雨滴打在"镜头"上的效果）
 *
 * 真实水滴在玻璃上的视觉原理：
 * - 水滴是凸透镜，内部画面是 **倒像**（上下翻转）
 * - 放大约 5%-15%，边缘有轻微桶形畸变（暗角）
 * - 边缘有极细菲涅尔亮带 + 外侧极细暗边
 * - 一个小镜面高光点
 * - 形状多样：圆形、竖椭圆、扁椭圆、长条形，朝向随机
 * - 水滴缓慢下滑留下极细湿痕
 *
 * 核心实现：每帧从游戏画布采样水滴位置像素，**翻转+放大**后裁切画回
 */

import type { IRenderer } from "../renderer/i-renderer";

/** 覆盖层纹理缓存（边缘环+高光，按 rx_ry 缓存） */
const overlayCache = new Map<string, OffscreenCanvas>();

/** 暗角纹理缓存（椭圆内边缘变暗，模拟桶形畸变） */
const vignetteCache = new Map<string, OffscreenCanvas>();

/**
 * 每个水滴拥有一个私有合成 canvas
 */
function createCompositeCanvas(w: number, h: number): { canvas: OffscreenCanvas; ctx: OffscreenCanvasRenderingContext2D } | null {
  const canvas = new OffscreenCanvas(w, h);
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  return { canvas, ctx };
}

/**
 * 预渲染覆盖层：边缘环 + 高光（无旋转，旋转在合成时处理）
 */
function getOverlayTexture(rx: number, ry: number): OffscreenCanvas {
  const key = `${Math.round(rx)}_${Math.round(ry)}`;
  const cached = overlayCache.get(key);
  if (cached) return cached;

  const pad = 2;
  const w = Math.ceil(rx * 2 + pad * 2);
  const h = Math.ceil(ry * 2 + pad * 2);
  const canvas = new OffscreenCanvas(w, h);
  const ctx = canvas.getContext("2d");
  if (!ctx) return canvas;

  const cx = w / 2;
  const cy = h / 2;

  // 1. 外侧极细暗边
  ctx.save();
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx + 1, ry + 1, 0, 0, Math.PI * 2);
  ctx.ellipse(cx, cy, rx - 0.5, ry - 0.5, 0, 0, Math.PI * 2);
  ctx.clip("evenodd");
  ctx.fillStyle = "rgba(0,0,0,0.06)";
  ctx.fillRect(0, 0, w, h);
  ctx.restore();

  // 2. 菲涅尔亮边（更淡，更通透）
  ctx.save();
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
  ctx.lineWidth = Math.max(0.5, Math.min(rx, ry) * 0.05);
  const rimGrad = ctx.createLinearGradient(cx, cy - ry, cx, cy + ry);
  rimGrad.addColorStop(0, "rgba(255,255,255,0.2)");
  rimGrad.addColorStop(0.35, "rgba(255,255,255,0.1)");
  rimGrad.addColorStop(0.7, "rgba(255,255,255,0.03)");
  rimGrad.addColorStop(1, "rgba(255,255,255,0.01)");
  ctx.strokeStyle = rimGrad;
  ctx.stroke();
  ctx.restore();

  // 3. 镜面高光点（更小更淡）
  ctx.save();
  const hlX = cx - rx * 0.28;
  const hlY = cy - ry * 0.32;
  const hlR = Math.max(0.8, Math.min(rx, ry) * 0.1);
  const hlGrad = ctx.createRadialGradient(hlX, hlY, 0, hlX, hlY, hlR);
  hlGrad.addColorStop(0, "rgba(255,255,255,0.45)");
  hlGrad.addColorStop(0.35, "rgba(255,255,255,0.12)");
  hlGrad.addColorStop(1, "rgba(255,255,255,0)");
  ctx.beginPath();
  ctx.arc(hlX, hlY, hlR, 0, Math.PI * 2);
  ctx.fillStyle = hlGrad;
  ctx.fill();
  ctx.restore();

  overlayCache.set(key, canvas);
  return canvas;
}

/**
 * 预渲染暗角纹理（椭圆边缘变暗，模拟凸透镜桶形畸变）
 */
function getVignetteTexture(rx: number, ry: number): OffscreenCanvas {
  const key = `${Math.round(rx)}_${Math.round(ry)}`;
  const cached = vignetteCache.get(key);
  if (cached) return cached;

  const w = Math.ceil(rx * 2);
  const h = Math.ceil(ry * 2);
  const canvas = new OffscreenCanvas(w, h);
  const ctx = canvas.getContext("2d");
  if (!ctx) return canvas;

  const cx = w / 2;
  const cy = h / 2;

  // 椭圆径向渐变：中心透明 → 边缘微暗
  // 为了适配椭圆，先画圆形暗角再 scale
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(1, ry / rx); // 将圆变为椭圆
  const grad = ctx.createRadialGradient(0, 0, rx * 0.5, 0, 0, rx);
  grad.addColorStop(0, "rgba(0,0,0,0)");
  grad.addColorStop(0.7, "rgba(0,0,0,0)");
  grad.addColorStop(0.9, "rgba(0,0,0,0.04)");
  grad.addColorStop(1, "rgba(0,0,0,0.12)");
  ctx.beginPath();
  ctx.arc(0, 0, rx, 0, Math.PI * 2);
  ctx.fillStyle = grad;
  ctx.fill();
  ctx.restore();

  vignetteCache.set(key, canvas);
  return canvas;
}

/** 水痕段 */
interface TrailSegment {
  x: number;
  y: number;
  alpha: number;
  width: number;
}

export class ScreenDroplet {
  /** 屏幕位置（水滴中心） */
  x: number;
  y: number;

  /** 初始水平半径 */
  readonly baseRx: number;
  /** 初始垂直半径 */
  readonly baseRy: number;

  /** 当前动态半径（受重力拉伸 + 着陆动画影响） */
  currentRx: number;
  currentRy: number;

  /** 旋转角度（弧度） */
  rotation: number;

  /** 全局透明度（用于淡出） */
  alpha: number;

  /** 剩余生命（秒） */
  life: number;
  readonly maxLife: number;

  /** 下滑速度（像素/秒），受重力加速 */
  slideSpeed: number;

  /** 重力加速度（像素/秒²），每颗水滴不同 */
  private readonly gravity: number;

  /** 累计滑动距离 */
  private slideDistance: number = 0;

  /** 折射放大倍率 */
  readonly magnification: number;

  /** 水痕轨迹 */
  private trail: TrailSegment[] = [];
  private trailAccum: number = 0;

  /** 覆盖层纹理 */
  private readonly overlay: OffscreenCanvas;
  /** 暗角纹理 */
  private readonly vignette: OffscreenCanvas;

  /** 私有合成 canvas */
  private compositeCanvas: OffscreenCanvas | null = null;
  private compositeCtx: OffscreenCanvasRenderingContext2D | null = null;
  private readonly compSize: number;

  /** 稳定期（初始不滑动） */
  private settledTime: number;

  // ===== 着陆动画（splash-in） =====
  /** 着陆动画进度：0(刚生成) → 1(动画结束)，-1 表示已完成 */
  private impactProgress: number = 0;
  /** 着陆动画总时长（秒） */
  private readonly impactDuration: number;

  constructor(x: number, y: number) {
    this.x = x;
    this.y = y;

    // ===== 形状多样性（更大的尺寸范围） =====
    // 大部分小水滴(2-10)，少量中等(10-18)，极少大水滴(18-28)
    const sizeRand = Math.random();
    const baseR = sizeRand < 0.5 ? 2 + Math.random() * 8
      : sizeRand < 0.85 ? 8 + Math.random() * 10
      : 16 + Math.random() * 12;

    const shapeRand = Math.random();
    let rx: number;
    let ry: number;
    if (shapeRand < 0.3) {
      // 近似圆形（小水滴常见）
      rx = baseR;
      ry = baseR * (0.9 + Math.random() * 0.2);
    } else if (shapeRand < 0.6) {
      // 竖椭圆
      rx = baseR;
      ry = baseR * (1.1 + Math.random() * 0.4);
    } else if (shapeRand < 0.8) {
      // 扁椭圆
      rx = baseR * (1.1 + Math.random() * 0.3);
      ry = baseR;
    } else {
      // 长条形
      rx = baseR * (0.5 + Math.random() * 0.3);
      ry = baseR * (1.5 + Math.random() * 0.5);
    }
    this.baseRx = rx;
    this.baseRy = ry;
    // 着陆动画开始时从极小开始
    this.currentRx = rx * 0.15;
    this.currentRy = ry * 0.15;

    this.rotation = (Math.random() - 0.5) * 0.63;

    this.alpha = 1.0;

    // ===== 差异化的生命周期 =====
    // 小水滴消失快（2-5秒），大水滴持久（6-14秒）
    const sizeRatio = baseR / 20; // 0-1
    this.maxLife = 2 + sizeRatio * 5 + Math.random() * 7;
    this.life = this.maxLife;

    // ===== 差异化的滑动参数 =====
    // 30% 概率几乎不动（表面张力粘住），70% 正常滑动
    const stickRand = Math.random();
    if (stickRand < 0.3) {
      // 粘住型：极慢滑动
      this.slideSpeed = 0.5 + Math.random() * 2;
      this.gravity = 1 + Math.random() * 3;
      this.settledTime = 2 + Math.random() * 5; // 长稳定期
    } else if (stickRand < 0.7) {
      // 正常型
      this.slideSpeed = 3 + Math.random() * 8;
      this.gravity = 8 + Math.random() * 15;
      this.settledTime = 0.5 + Math.random() * 2;
    } else {
      // 快速型（大水滴，重力大）
      this.slideSpeed = 8 + Math.random() * 15;
      this.gravity = 18 + Math.random() * 30;
      this.settledTime = 0.2 + Math.random() * 0.8;
    }

    this.magnification = 1.06 + Math.random() * 0.09;

    // 着陆动画时长：0.06-0.12 秒
    this.impactDuration = 0.06 + Math.random() * 0.06;

    this.overlay = getOverlayTexture(this.baseRx, this.baseRy);
    this.vignette = getVignetteTexture(this.baseRx, this.baseRy);

    const maxR = Math.max(this.baseRx, this.baseRy) * 2.5;
    this.compSize = Math.ceil(maxR * 2 + 6);
    const comp = createCompositeCanvas(this.compSize, this.compSize);
    if (comp) {
      this.compositeCanvas = comp.canvas;
      this.compositeCtx = comp.ctx;
    }
  }

  /**
   * @returns false = 已消亡
   */
  update(deltaTime: number): boolean {
    this.life -= deltaTime;
    if (this.life <= 0) return false;

    // ===== 着陆动画阶段 =====
    if (this.impactProgress >= 0 && this.impactProgress < 1) {
      this.impactProgress += deltaTime / this.impactDuration;
      if (this.impactProgress >= 1) {
        // 动画结束
        this.impactProgress = -1;
        this.currentRx = this.baseRx;
        this.currentRy = this.baseRy;
      } else {
        // easeOutBack: 快速膨胀 + 轻微过冲弹跳
        const t = this.impactProgress;
        const overshoot = 1.4;
        const ease = 1 + (overshoot + 1) * (t - 1) ** 3 + overshoot * (t - 1) ** 2;
        this.currentRx = this.baseRx * ease;
        this.currentRy = this.baseRy * ease;
        // 着陆期间透明度从 0 快速到 1
        this.alpha = Math.min(1, t * 3);
      }
      return true;
    }

    // ===== 稳定期 =====
    if (this.settledTime > 0) {
      this.settledTime -= deltaTime;
      this.alpha = 1.0;
      this.currentRx = this.baseRx;
      this.currentRy = this.baseRy;
      return true;
    }

    // ===== 重力加速 =====
    this.slideSpeed += this.gravity * deltaTime;

    const slide = this.slideSpeed * deltaTime;
    this.y += slide;
    this.x += Math.sin(this.y * 0.03) * 0.12;
    this.slideDistance += slide;

    // ===== 形状形变：滑动越远越细长 =====
    const deformThreshold = this.baseRy * 3;
    const deformFactor = Math.min(this.slideDistance / deformThreshold, 1.0);

    this.currentRx = this.baseRx * (1.0 - deformFactor * 0.7);
    this.currentRy = this.baseRy * (1.0 + deformFactor * 1.0);

    // 旋转逐渐趋向垂直
    this.rotation *= 1.0 - deltaTime * 1.5;

    // ===== 透明度 =====
    const slideAlpha = 1.0 - deformFactor * 0.6;
    const lifeRatio = this.life / this.maxLife;
    const lifeAlpha = lifeRatio < 0.15 ? lifeRatio / 0.15 : 1.0;
    this.alpha = slideAlpha * lifeAlpha;

    if (this.currentRx < 1.5) return false;

    // 水痕
    this.trailAccum += slide;
    if (this.trailAccum >= 4) {
      this.trailAccum = 0;
      this.trail.push({
        x: this.x,
        y: this.y,
        alpha: 0.035,
        width: Math.max(0.5, this.currentRx * 0.2),
      });
      if (this.trail.length > 40) this.trail.shift();
    }
    for (const seg of this.trail) {
      seg.alpha *= 0.985;
    }

    return true;
  }

  /**
   * 绘制折射水滴
   *
   * 核心原理：水滴是凸透镜
   * 1. 从游戏画布采样当前位置的像素
   * 2. **上下翻转**（凸透镜倒像）
   * 3. 放大 6%-15%
   * 4. 椭圆裁切 + 旋转
   * 5. 叠加暗角（桶形畸变）+ 覆盖层（菲涅尔边+高光）
   */
  draw(renderer: IRenderer, gameCanvas: HTMLCanvasElement | null): void {
    if (this.alpha < 0.02) return;

    if (!gameCanvas || !this.compositeCtx || !this.compositeCanvas) {
      this.drawOverlayOnly(renderer);
      return;
    }

    const { currentRx: rx, currentRy: ry, rotation } = this;
    const diam = this.compSize;
    const ctx = this.compositeCtx;
    const tempCanvas = this.compositeCanvas;
    const cx = diam / 2;
    const cy = diam / 2;

    ctx.clearRect(0, 0, diam, diam);

    // ---- 1. 旋转椭圆裁切（使用动态尺寸） ----
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx, ry, rotation, 0, Math.PI * 2);
    ctx.clip();

    // ---- 2. 采样 + 翻转（凸透镜倒像） ----
    ctx.translate(cx, cy);
    ctx.rotate(rotation);
    ctx.scale(1, -1); // ★ 凸透镜倒像
    ctx.rotate(-rotation);
    ctx.translate(-cx, -cy);

    // 从游戏画布采样：源区域略小于目标区域 → 放大效果
    const srcHalfW = rx / this.magnification;
    const srcHalfH = ry / this.magnification;

    const canvasW = gameCanvas.width;
    const canvasH = gameCanvas.height;
    const sx = Math.max(0, this.x - srcHalfW);
    const sy = Math.max(0, this.y - srcHalfH);
    const sw = Math.min(srcHalfW * 2, canvasW - sx);
    const sh = Math.min(srcHalfH * 2, canvasH - sy);

    if (sw > 0 && sh > 0) {
      ctx.drawImage(
        gameCanvas,
        sx, sy, sw, sh,
        cx - rx, cy - ry, rx * 2, ry * 2,
      );
    }

    ctx.restore();

    // ---- 3. 暗角 + 覆盖层（缩放到当前动态尺寸） ----
    // 覆盖层/暗角是按初始 baseRx/baseRy 预渲染的，
    // 通过 scale 变换适配当前变形后的尺寸
    const scaleX = rx / this.baseRx;
    const scaleY = ry / this.baseRy;

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(rotation);
    ctx.scale(scaleX, scaleY);
    ctx.drawImage(
      this.vignette,
      -this.vignette.width / 2,
      -this.vignette.height / 2,
    );
    ctx.restore();

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(rotation);
    ctx.scale(scaleX, scaleY);
    ctx.drawImage(
      this.overlay,
      -this.overlay.width / 2,
      -this.overlay.height / 2,
    );
    ctx.restore();

    // ---- 5. 画回主渲染器 ----
    renderer.save();
    renderer.setAlpha(this.alpha);
    renderer.updateSourceTexture(tempCanvas);
    renderer.drawSource(tempCanvas, Math.round(this.x - cx), Math.round(this.y - cy));
    renderer.restore();

    this.drawTrail(renderer);
  }

  /** 绘制水痕 */
  private drawTrail(renderer: IRenderer): void {
    for (const seg of this.trail) {
      if (seg.alpha < 0.008) continue;
      renderer.fillRect({
        x: seg.x - seg.width / 2,
        y: seg.y,
        width: seg.width,
        height: 3,
        color: `rgba(255,255,255,${seg.alpha.toFixed(3)})`,
      });
    }
  }

  /** 降级绘制（无画布可采样时） */
  private drawOverlayOnly(renderer: IRenderer): void {
    renderer.save();
    renderer.setAlpha(this.alpha);
    renderer.drawSource(
      this.overlay,
      Math.round(this.x - this.overlay.width / 2),
      Math.round(this.y - this.overlay.height / 2),
    );
    renderer.restore();
    this.drawTrail(renderer);
  }
}

/**
 * 清除缓存
 */
export function clearDropletTextureCache(): void {
  overlayCache.clear();
  vignetteCache.clear();
}
