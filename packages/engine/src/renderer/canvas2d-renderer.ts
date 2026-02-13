/**
 * Canvas2DRenderer - Canvas 2D 渲染器实现
 *
 * 包装现有的 CanvasRenderingContext2D 调用，实现 IRenderer 接口。
 * 这是渐进迁移的第一步：让所有绘制代码通过 IRenderer 而非直接调用 ctx。
 * 功能上与当前行为完全一致，不引入任何变化。
 */

import type { IRenderer } from "./i-renderer";
import type {
  BlendMode,
  ColorFilter,
  DrawSourceOptions,
  DrawSpriteParams,
  FillRectParams,
  RenderState,
  RenderStats,
  TextureId,
  TextureInfo,
  TextureSource,
} from "./types";

/** Canvas2D 纹理实现（直接保持对源 image/canvas 的引用） */
interface Canvas2DTexture extends TextureInfo {
  source: TextureSource;
}

/** ColorFilter → CSS filter 字符串映射 */
const FILTER_MAP: Record<ColorFilter, string> = {
  none: "none",
  grayscale: "grayscale(100%)",
  frozen: "sepia(100%) saturate(300%) hue-rotate(180deg)",
  poison: "sepia(100%) saturate(300%) hue-rotate(60deg)",
};

/** BlendMode → globalCompositeOperation 映射 */
const BLEND_MODE_MAP: Record<BlendMode, GlobalCompositeOperation> = {
  normal: "source-over",
  multiply: "multiply",
  additive: "lighter",
  screen: "screen",
};

export class Canvas2DRenderer implements IRenderer {
  readonly type = "canvas2d" as const;

  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private _width = 0;
  private _height = 0;

  // 纹理管理
  private nextTextureId: TextureId = 1;
  private textures = new Map<TextureId, Canvas2DTexture>();

  // 状态栈
  private stateStack: RenderState[] = [];
  private currentState: RenderState = {
    alpha: 1,
    blendMode: "normal",
    filter: "none",
  };

  // 临时 canvas 复用（用于 ImageData 转换，避免每次 createElement）
  private tmpCanvas: HTMLCanvasElement | null = null;
  private tmpCtx: CanvasRenderingContext2D | null = null;

  // 统计
  private stats: RenderStats = {
    drawCalls: 0,
    spriteCount: 0,
    rectCount: 0,
    textureSwaps: 0,
    textureCount: 0,
  };

  /** 上一帧完整统计快照（供外部查询） */
  private lastFrameStats: RenderStats = {
    drawCalls: 0,
    spriteCount: 0,
    rectCount: 0,
    textureSwaps: 0,
    textureCount: 0,
  };

  get width(): number {
    return this._width;
  }

  get height(): number {
    return this._height;
  }

  // ============= 生命周期 =============

  init(canvas: HTMLCanvasElement): boolean {
    const ctx = canvas.getContext("2d");
    if (!ctx) return false;

    this.canvas = canvas;
    this.ctx = ctx;
    this._width = canvas.width;
    this._height = canvas.height;

    // 像素风格：禁用平滑
    ctx.imageSmoothingEnabled = false;

    return true;
  }

  dispose(): void {
    this.textures.clear();
    this.stateStack = [];
    this.ctx = null;
    this.canvas = null;
    this.tmpCanvas = null;
    this.tmpCtx = null;
  }

  resize(width: number, height: number): void {
    this._width = width;
    this._height = height;
    if (this.canvas) {
      this.canvas.width = width;
      this.canvas.height = height;
    }
    if (this.ctx) {
      this.ctx.imageSmoothingEnabled = false;
    }
  }

  // ============= 帧控制 =============

  beginFrame(): void {
    this.stats.drawCalls = 0;
    this.stats.spriteCount = 0;
    this.stats.rectCount = 0;
    this.stats.textureSwaps = 0;
    this.stats.textureCount = this.textures.size;

    // 重置状态
    this.currentState = { alpha: 1, blendMode: "normal", filter: "none" };
    this.stateStack = [];

    if (!this.ctx) return;

    // 清屏
    this.ctx.fillStyle = "#1a1a2e";
    this.ctx.fillRect(0, 0, this._width, this._height);
  }

  endFrame(): void {
    // 保存完整帧统计快照
    this.stats.textureCount = this.textures.size;
    this.lastFrameStats = { ...this.stats };
  }

  // ============= 纹理管理 =============

  createTexture(source: TextureSource): TextureInfo {
    const id = this.nextTextureId++;

    let width: number;
    let height: number;

    if (source instanceof ImageData) {
      width = source.width;
      height = source.height;
    } else {
      width = source.width;
      height = source.height;
    }

    const texture: Canvas2DTexture = {
      id,
      width,
      height,
      isReady: true,
      source,
    };

    this.textures.set(id, texture);
    return texture;
  }

  updateTexture(texture: TextureInfo, source: TextureSource): void {
    const existing = this.textures.get(texture.id);
    if (existing) {
      existing.source = source;
    }
  }

  deleteTexture(texture: TextureInfo): void {
    this.textures.delete(texture.id);
  }

  releaseSourceTexture(_source: TextureSource): void {
    // Canvas2D 后端的 drawSource/drawSourceEx 不缓存纹理，无需释放
  }

  updateSourceTexture(_source: TextureSource): void {
    // Canvas2D 后端直接 drawImage 读源，无需手动更新
  }

  getTexture(id: TextureId): TextureInfo | null {
    return this.textures.get(id) ?? null;
  }

  // ============= 精灵绘制 =============

  drawSprite(texture: TextureInfo, x: number, y: number): void {
    if (!this.ctx) return;
    const tex = this.textures.get(texture.id);
    if (!tex) return;

    const source = tex.source;
    // ImageData 不能直接 drawImage，需要特殊处理
    if (source instanceof ImageData) {
      this.ctx.putImageData(source, x, y);
    } else {
      this.ctx.drawImage(source as CanvasImageSource, x, y);
    }

    this.stats.drawCalls++;
    this.stats.spriteCount++;
  }

  drawSpriteEx(params: DrawSpriteParams): void {
    if (!this.ctx) return;
    const tex = this.textures.get(params.texture.id);
    if (!tex) return;

    const ctx = this.ctx;
    const source = tex.source;
    const needState = params.alpha !== undefined || params.filter !== undefined || params.flipX;

    if (needState) {
      ctx.save();
    }

    // 透明度
    if (params.alpha !== undefined) {
      ctx.globalAlpha = params.alpha;
    }

    // 颜色滤镜
    if (params.filter && params.filter !== "none") {
      ctx.filter = FILTER_MAP[params.filter];
    }

    // 翻转
    if (params.flipX) {
      const dstW = params.dstWidth ?? params.srcWidth ?? tex.width;
      ctx.translate(params.x + dstW, params.y);
      ctx.scale(-1, 1);
      this.drawImageInternal(
        source,
        params.srcX ?? 0,
        params.srcY ?? 0,
        params.srcWidth ?? tex.width,
        params.srcHeight ?? tex.height,
        0,
        0,
        params.dstWidth ?? params.srcWidth ?? tex.width,
        params.dstHeight ?? params.srcHeight ?? tex.height
      );
    } else if (
      params.srcX !== undefined ||
      params.srcY !== undefined ||
      params.dstWidth !== undefined ||
      params.dstHeight !== undefined
    ) {
      // 使用9参数版本 drawImage
      this.drawImageInternal(
        source,
        params.srcX ?? 0,
        params.srcY ?? 0,
        params.srcWidth ?? tex.width,
        params.srcHeight ?? tex.height,
        params.x,
        params.y,
        params.dstWidth ?? params.srcWidth ?? tex.width,
        params.dstHeight ?? params.srcHeight ?? tex.height
      );
    } else {
      // 简单版本
      if (source instanceof ImageData) {
        this.ctx.putImageData(source, params.x, params.y);
      } else {
        ctx.drawImage(source as CanvasImageSource, params.x, params.y);
      }
    }

    if (needState) {
      ctx.restore();
    }

    this.stats.drawCalls++;
    this.stats.spriteCount++;
  }

  private drawImageInternal(
    source: TextureSource,
    sx: number,
    sy: number,
    sw: number,
    sh: number,
    dx: number,
    dy: number,
    dw: number,
    dh: number
  ): void {
    if (!this.ctx) return;
    if (source instanceof ImageData) {
      // ImageData 不支持 9 参数 drawImage，需要通过临时 canvas（复用）
      if (!this.tmpCanvas) {
        this.tmpCanvas = document.createElement("canvas");
        this.tmpCtx = this.tmpCanvas.getContext("2d");
      }
      if (this.tmpCanvas.width !== source.width) this.tmpCanvas.width = source.width;
      if (this.tmpCanvas.height !== source.height) this.tmpCanvas.height = source.height;
      if (this.tmpCtx) {
        this.tmpCtx.putImageData(source, 0, 0);
        this.ctx.drawImage(this.tmpCanvas, sx, sy, sw, sh, dx, dy, dw, dh);
      }
    } else {
      this.ctx.drawImage(source as CanvasImageSource, sx, sy, sw, sh, dx, dy, dw, dh);
    }
  }

  // ============= 矩形绘制 =============

  fillRect(params: FillRectParams): void {
    if (!this.ctx) return;
    this.ctx.fillStyle = params.color;
    this.ctx.fillRect(params.x, params.y, params.width, params.height);
    this.stats.drawCalls++;
    this.stats.rectCount++;
  }

  // ============= 状态管理 =============

  save(): void {
    this.stateStack.push({ ...this.currentState });
    this.ctx?.save();
  }

  restore(): void {
    const prev = this.stateStack.pop();
    if (prev) {
      this.currentState = prev;
    }
    this.ctx?.restore();
  }

  setAlpha(alpha: number): void {
    this.currentState.alpha = alpha;
    if (this.ctx) {
      this.ctx.globalAlpha = alpha;
    }
  }

  setBlendMode(mode: BlendMode): void {
    this.currentState.blendMode = mode;
    if (this.ctx) {
      this.ctx.globalCompositeOperation = BLEND_MODE_MAP[mode];
    }
  }

  setFilter(filter: ColorFilter): void {
    this.currentState.filter = filter;
    if (this.ctx) {
      this.ctx.filter = FILTER_MAP[filter];
    }
  }

  // ============= 查询 =============

  getStats(): RenderStats {
    return { ...this.lastFrameStats };
  }

  getCanvas(): HTMLCanvasElement | null {
    return this.canvas;
  }

  /**
   * 获取底层 Canvas2D context（临时过渡用）
   * 在迁移完成前，某些复杂操作可能仍需直接访问 ctx
   */
  getContext(): CanvasRenderingContext2D | null {
    return this.ctx;
  }

  /**
   * IRenderer.getContext2D 实现
   */
  getContext2D(): CanvasRenderingContext2D | null {
    return this.ctx;
  }

  // ============= 便捷绘制 =============

  drawSource(source: TextureSource, x: number, y: number): void {
    if (!this.ctx) return;
    if (source instanceof ImageData) {
      this.ctx.putImageData(source, x, y);
    } else {
      this.ctx.drawImage(source as CanvasImageSource, x, y);
    }
    this.stats.drawCalls++;
    this.stats.spriteCount++;
  }

  drawSourceEx(source: TextureSource, x: number, y: number, options: DrawSourceOptions): void {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const needState =
      options.alpha !== undefined ||
      options.filter !== undefined ||
      options.flipX;

    if (needState) ctx.save();

    if (options.alpha !== undefined) ctx.globalAlpha = options.alpha;
    if (options.filter && options.filter !== "none") ctx.filter = FILTER_MAP[options.filter];

    const hasSrcRect =
      options.srcX !== undefined ||
      options.srcY !== undefined ||
      options.srcWidth !== undefined ||
      options.srcHeight !== undefined;

    const srcW = options.srcWidth ?? (source instanceof ImageData ? source.width : (source as HTMLCanvasElement).width);
    const srcH = options.srcHeight ?? (source instanceof ImageData ? source.height : (source as HTMLCanvasElement).height);
    const dstW = options.dstWidth ?? srcW;
    const dstH = options.dstHeight ?? srcH;

    if (source instanceof ImageData) {
      // ImageData: 通过复用 tmpCanvas 转换
      if (!this.tmpCanvas) {
        this.tmpCanvas = document.createElement("canvas");
        this.tmpCtx = this.tmpCanvas.getContext("2d");
      }
      if (this.tmpCanvas.width !== source.width) this.tmpCanvas.width = source.width;
      if (this.tmpCanvas.height !== source.height) this.tmpCanvas.height = source.height;
      if (this.tmpCtx) {
        this.tmpCtx.putImageData(source, 0, 0);
        this.drawCanvasSource(ctx, this.tmpCanvas, x, y, options, hasSrcRect, srcW, srcH, dstW, dstH);
      }
    } else {
      this.drawCanvasSource(ctx, source as CanvasImageSource, x, y, options, hasSrcRect, srcW, srcH, dstW, dstH);
    }

    if (needState) ctx.restore();
    this.stats.drawCalls++;
    this.stats.spriteCount++;
  }

  private _worldScaleApplied = false;

  applyWorldScale(worldWidth: number, worldHeight: number): void {
    if (!this.ctx) return;
    const sx = this._width / worldWidth;
    const sy = this._height / worldHeight;
    if (Math.abs(sx - 1) < 1e-6 && Math.abs(sy - 1) < 1e-6) return;
    this.ctx.save();
    this.ctx.scale(sx, sy);
    this._worldScaleApplied = true;
  }

  resetWorldScale(): void {
    if (!this.ctx || !this._worldScaleApplied) return;
    this.ctx.restore();
    this._worldScaleApplied = false;
  }

  private drawCanvasSource(
    ctx: CanvasRenderingContext2D,
    source: CanvasImageSource,
    x: number,
    y: number,
    options: DrawSourceOptions,
    hasSrcRect: boolean,
    srcW: number,
    srcH: number,
    dstW: number,
    dstH: number
  ): void {
    if (options.flipX) {
      ctx.translate(x + dstW, y);
      ctx.scale(-1, 1);
      if (hasSrcRect) {
        ctx.drawImage(source, options.srcX ?? 0, options.srcY ?? 0, srcW, srcH, 0, 0, dstW, dstH);
      } else {
        ctx.drawImage(source, 0, 0);
      }
    } else if (hasSrcRect || options.dstWidth !== undefined || options.dstHeight !== undefined) {
      ctx.drawImage(source, options.srcX ?? 0, options.srcY ?? 0, srcW, srcH, x, y, dstW, dstH);
    } else {
      ctx.drawImage(source, x, y);
    }
  }
}
