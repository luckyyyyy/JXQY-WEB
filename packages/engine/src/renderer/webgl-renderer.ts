/**
 * WebGLRenderer - WebGL 2D 精灵渲染器
 *
 * 核心实现：
 * 1. 使用 SpriteBatcher 批量绘制精灵（主要性能提升来源）
 * 2. 纹理管理：ImageData/Canvas → WebGLTexture，带缓存
 * 3. 着色器内置颜色滤镜（grayscale/frozen/poison）
 * 4. 混合模式映射到 WebGL blendFunc
 * 5. 矩形填充使用独立 shader program
 *
 * 预期性能提升：
 * - 地图瓦片 ~4800 drawImage → ~1-5 draw calls（同一纹理自动批合并）
 * - 角色/NPC/物体 ~100-200 drawImage → ~5-10 draw calls
 * - 天气粒子 ~300 fillRect → 1 draw call
 */

import { logger } from "../core/logger";
import type { IRenderer } from "./i-renderer";
import { RectBatcher } from "./rect-batcher";
import { SpriteBatcher } from "./sprite-batcher";
import { parseColor, type RGBAColor } from "./color-utils";
import { createRectProgram, createSpriteProgram, type RectProgram, type SpriteProgram } from "./shaders";
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

/** WebGL 纹理实现 */
interface WebGLTextureEntry extends TextureInfo {
  glTexture: WebGLTexture;
  /** 原始图像源（用于重新上传） */
  source: TextureSource | null;
}

export class WebGLRenderer implements IRenderer {
  readonly type = "webgl" as const;

  private canvas: HTMLCanvasElement | null = null;
  private gl: WebGLRenderingContext | null = null;
  private _width = 0;
  private _height = 0;

  // Shader programs
  private spriteProgram: SpriteProgram | null = null;
  private rectProgram: RectProgram | null = null;

  // 批量渲染器
  private batcher: SpriteBatcher | null = null;
  private rectBatcher: RectBatcher | null = null;

  // 纹理管理
  private nextTextureId: TextureId = 1;
  private textures = new Map<TextureId, WebGLTextureEntry>();

  /** drawSource/drawSourceEx 用的纹理缓存（WeakMap 自动清理，仅限 object 类型 source） */
  private sourceTextureCache = new WeakMap<object, TextureInfo>();
  /** ImageData 纹理缓存（通过 width+height+data hash 识别，避免每次重建） */
  private imageDataTextureCache = new Map<ImageData, TextureInfo>();

  /**
   * FinalizationRegistry: 当 drawSource 缓存的源对象被 GC 时，
   * 自动从 textures Map 中删除对应的 GPU 纹理，防止孤立泄漏。
   *
   * 典型场景：NPC ASF atlas canvas 失去所有强引用后，
   * sourceTextureCache (WeakMap) 的条目自动消失，
   * 但 textures Map 中的 WebGLTextureEntry 仍在——
   * FinalizationRegistry 回调会清理它。
   */
  private sourceTextureRegistry = new FinalizationRegistry<TextureId>((textureId) => {
    const entry = this.textures.get(textureId);
    if (entry) {
      this.gl?.deleteTexture(entry.glTexture);
      this.textures.delete(textureId);
    }
  });

  /** CSS 颜色字符串解析缓存（避免天气粒子每帧重复解析） */
  private colorCache = new Map<string, RGBAColor>();

  /** 上一次实际应用到 GL 的混合模式（脏标记，避免每帧数千次无意义 gl.blendFunc） */
  private lastAppliedBlendMode: BlendMode = "normal";

  // 状态栈
  private stateStack: RenderState[] = [];
  private currentState: RenderState = {
    alpha: 1,
    blendMode: "normal",
    filter: "none",
  };

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
    const gl = canvas.getContext("webgl2", {
      alpha: false, // 不需要 canvas 透明背景
      antialias: false, // 像素风格不需要抗锯齿
      premultipliedAlpha: true,
      preserveDrawingBuffer: true, // 截图需要
    }) as WebGLRenderingContext | null;

    if (!gl) {
      logger.error("[WebGLRenderer] Failed to get WebGL2 context");
      return false;
    }

    this.canvas = canvas;
    this.gl = gl;
    this._width = canvas.width;
    this._height = canvas.height;

    // 编译着色器
    this.spriteProgram = createSpriteProgram(gl);
    if (!this.spriteProgram) {
      logger.error("[WebGLRenderer] Failed to create sprite program");
      return false;
    }

    this.rectProgram = createRectProgram(gl);
    if (!this.rectProgram) {
      logger.error("[WebGLRenderer] Failed to create rect program");
      return false;
    }

    // 创建批量渲染器
    this.batcher = new SpriteBatcher(gl, this.spriteProgram);
    this.rectBatcher = new RectBatcher(gl, this.rectProgram);

    // 设置 WebGL 状态
    gl.viewport(0, 0, this._width, this._height);

    // 启用 alpha 混合（精灵有透明像素）
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

    // 禁用不需要的功能
    gl.disable(gl.DEPTH_TEST);
    gl.disable(gl.CULL_FACE);

    // 设置分辨率 uniform
    gl.useProgram(this.spriteProgram.program);
    gl.uniform2f(this.spriteProgram.u_resolution, this._width, this._height);

    gl.useProgram(this.rectProgram.program);
    gl.uniform2f(this.rectProgram.u_resolution, this._width, this._height);

    logger.info(
      `[WebGLRenderer] Initialized: ${this._width}x${this._height}, ` +
        `vendor=${gl.getParameter(gl.VENDOR)}, renderer=${gl.getParameter(gl.RENDERER)}`
    );

    return true;
  }

  dispose(): void {
    const gl = this.gl;
    if (!gl) return;

    // 释放纹理
    for (const tex of this.textures.values()) {
      gl.deleteTexture(tex.glTexture);
    }
    this.textures.clear();

    // 释放 batcher
    this.batcher?.dispose();
    this.batcher = null;
    this.rectBatcher?.dispose();
    this.rectBatcher = null;

    // 清理缓存
    this.imageDataTextureCache.clear();
    this.colorCache.clear();
    // FinalizationRegistry 无需手动清理，所有注册的 source 已随纹理释放

    // 释放 programs
    if (this.spriteProgram) gl.deleteProgram(this.spriteProgram.program);
    if (this.rectProgram) gl.deleteProgram(this.rectProgram.program);

    this.gl = null;
    this.canvas = null;
  }

  resize(width: number, height: number): void {
    this._width = width;
    this._height = height;

    if (this.canvas) {
      this.canvas.width = width;
      this.canvas.height = height;
    }

    const gl = this.gl;
    if (!gl) return;

    gl.viewport(0, 0, width, height);

    // 更新分辨率 uniform
    if (this.spriteProgram) {
      gl.useProgram(this.spriteProgram.program);
      gl.uniform2f(this.spriteProgram.u_resolution, width, height);
    }
    if (this.rectProgram) {
      gl.useProgram(this.rectProgram.program);
      gl.uniform2f(this.rectProgram.u_resolution, width, height);
    }
  }

  // ============= 帧控制 =============

  beginFrame(): void {
    const gl = this.gl;
    if (!gl) return;

    // 重置统计
    this.batcher?.resetStats();
    this.rectBatcher?.resetStats();
    this.stats.drawCalls = 0;
    this.stats.spriteCount = 0;
    this.stats.rectCount = 0;
    this.stats.textureSwaps = 0;
    this.stats.textureCount = this.textures.size;

    // 重置状态（复用对象，避免 GC）
    this.currentState.alpha = 1;
    this.currentState.blendMode = "normal";
    this.currentState.filter = "none";
    this.stateStack.length = 0;

    // 清屏 (#1a1a2e → RGB)
    gl.clearColor(0x1a / 255, 0x1a / 255, 0x2e / 255, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);

    // 重置混合模式
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    this.lastAppliedBlendMode = "normal";
  }

  endFrame(): void {
    // 刷新所有待提交的批次
    this.batcher?.flush();
    this.rectBatcher?.flush();

    // 汇总统计
    if (this.batcher) {
      this.stats.drawCalls += this.batcher.drawCalls;
      this.stats.spriteCount = this.batcher.totalSprites;
      this.stats.textureSwaps = this.batcher.textureSwaps;
    }
    if (this.rectBatcher) {
      this.stats.drawCalls += this.rectBatcher.drawCalls;
      this.stats.rectCount = this.rectBatcher.totalRects;
    }
    this.stats.textureCount = this.textures.size;

    // 保存完整帧统计快照（复用对象，避免 GC）
    this.lastFrameStats.drawCalls = this.stats.drawCalls;
    this.lastFrameStats.spriteCount = this.stats.spriteCount;
    this.lastFrameStats.rectCount = this.stats.rectCount;
    this.lastFrameStats.textureSwaps = this.stats.textureSwaps;
    this.lastFrameStats.textureCount = this.stats.textureCount;
  }

  // ============= 纹理管理 =============

  createTexture(source: TextureSource): TextureInfo {
    const gl = this.gl;
    if (!gl) {
      return { id: -1, width: 0, height: 0, isReady: false };
    }

    const glTexture = gl.createTexture();
    if (!glTexture) {
      return { id: -1, width: 0, height: 0, isReady: false };
    }

    gl.bindTexture(gl.TEXTURE_2D, glTexture);

    // 像素风格：最近邻采样
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

    // 上传纹理数据
    this.uploadTexture(gl, source);

    const id = this.nextTextureId++;
    const width = source instanceof ImageData ? source.width : source.width;
    const height = source instanceof ImageData ? source.height : source.height;

    const entry: WebGLTextureEntry = {
      id,
      width,
      height,
      isReady: true,
      glTexture,
      source: null, // 不保留源引用以节省内存
    };

    this.textures.set(id, entry);
    return entry;
  }

  updateTexture(texture: TextureInfo, source: TextureSource): void {
    const gl = this.gl;
    if (!gl) return;

    const entry = this.textures.get(texture.id);
    if (!entry) return;

    gl.bindTexture(gl.TEXTURE_2D, entry.glTexture);
    this.uploadTexture(gl, source);
  }

  deleteTexture(texture: TextureInfo): void {
    const gl = this.gl;
    if (!gl) return;

    const entry = this.textures.get(texture.id);
    if (entry) {
      gl.deleteTexture(entry.glTexture);
      this.textures.delete(texture.id);
    }
  }

  releaseSourceTexture(source: TextureSource): void {
    // ImageData 走独立缓存
    if (source instanceof ImageData) {
      const tex = this.imageDataTextureCache.get(source);
      if (tex) {
        this.deleteTexture(tex);
        this.imageDataTextureCache.delete(source);
      }
      return;
    }
    // Canvas / HTMLImageElement / OffscreenCanvas 走 WeakMap 缓存
    const tex = this.sourceTextureCache.get(source);
    if (tex) {
      this.deleteTexture(tex);
      this.sourceTextureCache.delete(source);
      // 取消 FinalizationRegistry 注册（已手动释放，无需 GC 回调）
      this.sourceTextureRegistry.unregister(source);
    }
  }

  updateSourceTexture(source: TextureSource): void {
    if (source instanceof ImageData) return;
    const tex = this.sourceTextureCache.get(source);
    if (tex) {
      this.updateTexture(tex, source);
    }
  }

  getTexture(id: TextureId): TextureInfo | null {
    return this.textures.get(id) ?? null;
  }

  /** 获取 WebGL 纹理对象（内部使用） */
  getGLTexture(id: TextureId): WebGLTexture | null {
    return this.textures.get(id)?.glTexture ?? null;
  }

  // ============= 精灵绘制 =============

  drawSprite(texture: TextureInfo, x: number, y: number): void {
    this.drawSpriteEx({
      texture,
      x,
      y,
    });
  }

  drawSpriteEx(params: DrawSpriteParams): void {
    if (!this.batcher) return;

    // 先 flush 矩形批次（保证绘制顺序正确）
    this.rectBatcher?.flush();

    const entry = this.textures.get(params.texture.id);
    if (!entry) return;

    const texWidth = entry.width;
    const texHeight = entry.height;

    const dx = params.x;
    const dy = params.y;
    const dw = params.dstWidth ?? params.srcWidth ?? texWidth;
    const dh = params.dstHeight ?? params.srcHeight ?? texHeight;

    // 归一化 UV 坐标
    const sx = (params.srcX ?? 0) / texWidth;
    const sy = (params.srcY ?? 0) / texHeight;
    const sw = (params.srcWidth ?? texWidth) / texWidth;
    const sh = (params.srcHeight ?? texHeight) / texHeight;

    // 翻转处理（通过交换 UV）
    let u0 = sx;
    let u1 = sx + sw;
    if (params.flipX) {
      const tmp = u0;
      u0 = u1;
      u1 = tmp;
    }

    const alpha = (params.alpha ?? 1) * this.currentState.alpha;
    const filter = params.filter ?? this.currentState.filter;

    // 确保当前混合模式已应用
    this.applyBlendMode();

    this.batcher.draw(
      entry.glTexture,
      entry.id,
      dx,
      dy,
      dw,
      dh,
      u0,
      sy,
      u1 - u0,
      sh,
      alpha,
      filter
    );
  }

  // ============= 矩形绘制 =============

  fillRect(params: FillRectParams): void {
    if (!this.rectBatcher) return;

    // 先 flush 精灵批次（保证绘制顺序正确）
    this.batcher?.flush();

    // 解析颜色（带缓存）
    let color = this.colorCache.get(params.color);
    if (!color) {
      color = parseColor(params.color);
      this.colorCache.set(params.color, color);
    }

    this.applyBlendMode();
    this.rectBatcher.draw(params.x, params.y, params.width, params.height, color, this.currentState.alpha);
  }

  // ============= 状态管理 =============

  save(): void {
    this.stateStack.push({ ...this.currentState });
  }

  restore(): void {
    const prev = this.stateStack.pop();
    if (prev) {
      // 如果混合模式变了，需要先 flush 所有批次
      if (prev.blendMode !== this.currentState.blendMode) {
        this.batcher?.flush();
        this.rectBatcher?.flush();
      }
      this.currentState = prev;
    }
  }

  setAlpha(alpha: number): void {
    this.currentState.alpha = alpha;
  }

  setBlendMode(mode: BlendMode): void {
    if (mode !== this.currentState.blendMode) {
      // 混合模式改变需要 flush 所有批次
      this.batcher?.flush();
      this.rectBatcher?.flush();
      this.currentState.blendMode = mode;
    }
  }

  setFilter(filter: ColorFilter): void {
    this.currentState.filter = filter;
  }

  // ============= 查询 =============

  getStats(): RenderStats {
    return { ...this.lastFrameStats };
  }

  getCanvas(): HTMLCanvasElement | null {
    return this.canvas;
  }

  // ============= 内部方法 =============

  /** 上传纹理数据到 GPU */
  private uploadTexture(gl: WebGLRenderingContext, source: TextureSource): void {
    if (source instanceof ImageData) {
      gl.texImage2D(
        gl.TEXTURE_2D,
        0,
        gl.RGBA,
        source.width,
        source.height,
        0,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        source.data
      );
    } else if (source instanceof HTMLCanvasElement || source instanceof HTMLImageElement) {
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
    } else if (source instanceof ImageBitmap) {
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
    } else if (source instanceof OffscreenCanvas) {
      // OffscreenCanvas → 先转为 ImageBitmap 或直接传
      // WebGL1 texImage2D 支持 OffscreenCanvas 作为 TexImageSource 在大多数浏览器中
      gl.texImage2D(
        gl.TEXTURE_2D,
        0,
        gl.RGBA,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        source as unknown as TexImageSource
      );
    }
  }

  /** 应用当前混合模式到 WebGL 状态（带脏标记，仅在实际变化时调用 gl.blendFunc） */
  private applyBlendMode(): void {
    const mode = this.currentState.blendMode;
    if (mode === this.lastAppliedBlendMode) return;

    const gl = this.gl;
    if (!gl) return;

    this.lastAppliedBlendMode = mode;

    switch (mode) {
      case "normal":
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
        break;
      case "multiply":
        gl.blendFunc(gl.DST_COLOR, gl.ZERO);
        break;
      case "additive":
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
        break;
      case "screen":
        gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_COLOR);
        break;
    }
  }

  // ============= 便捷绘制方法 =============

  /** 获取或创建 source 的缓存纹理 */
  private getOrCreateSourceTexture(source: TextureSource): TextureInfo | null {
    if (source instanceof ImageData) {
      // ImageData 使用独立的 Map 缓存（同一 ImageData 对象反复绘制时复用纹理）
      let tex = this.imageDataTextureCache.get(source);
      if (!tex) {
        tex = this.createTexture(source);
        this.imageDataTextureCache.set(source, tex);
      }
      return tex;
    }
    let tex = this.sourceTextureCache.get(source);
    if (!tex) {
      tex = this.createTexture(source);
      this.sourceTextureCache.set(source, tex);
      // 注册 GC 回调：当 source 被回收时自动释放 GPU 纹理
      // 第三参数为 unregisterToken，用于 releaseSourceTexture 时取消注册
      this.sourceTextureRegistry.register(source, tex.id, source);
    }
    return tex;
  }

  drawSource(source: TextureSource, x: number, y: number): void {
    const tex = this.getOrCreateSourceTexture(source);
    if (tex) this.drawSprite(tex, x, y);
  }

  drawSourceEx(source: TextureSource, x: number, y: number, options: DrawSourceOptions): void {
    const tex = this.getOrCreateSourceTexture(source);
    if (!tex) return;

    const srcW = options.srcWidth ?? tex.width;
    const srcH = options.srcHeight ?? tex.height;
    const dstW = options.dstWidth ?? srcW;
    const dstH = options.dstHeight ?? srcH;

    this.drawSpriteEx({
      texture: tex,
      x,
      y,
      dstWidth: dstW,
      dstHeight: dstH,
      srcX: options.srcX ?? 0,
      srcY: options.srcY ?? 0,
      srcWidth: srcW,
      srcHeight: srcH,
      flipX: options.flipX ?? false,
      alpha: options.alpha,
      filter: options.filter,
    });
  }

  getContext2D(): CanvasRenderingContext2D | null {
    return null;
  }

  applyWorldScale(worldWidth: number, worldHeight: number): void {
    const gl = this.gl;
    if (!gl) return;
    // flush pending draws before changing resolution
    this.batcher?.flush();
    this.rectBatcher?.flush();
    if (this.spriteProgram) {
      gl.useProgram(this.spriteProgram.program);
      gl.uniform2f(this.spriteProgram.u_resolution, worldWidth, worldHeight);
    }
    if (this.rectProgram) {
      gl.useProgram(this.rectProgram.program);
      gl.uniform2f(this.rectProgram.u_resolution, worldWidth, worldHeight);
    }
  }

  resetWorldScale(): void {
    const gl = this.gl;
    if (!gl) return;
    this.batcher?.flush();
    this.rectBatcher?.flush();
    if (this.spriteProgram) {
      gl.useProgram(this.spriteProgram.program);
      gl.uniform2f(this.spriteProgram.u_resolution, this._width, this._height);
    }
    if (this.rectProgram) {
      gl.useProgram(this.rectProgram.program);
      gl.uniform2f(this.rectProgram.u_resolution, this._width, this._height);
    }
  }
}
