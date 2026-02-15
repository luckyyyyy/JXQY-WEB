/**
 * Renderer - 渲染器抽象接口
 *
 * 这是 Canvas2D 和 WebGL 渲染器的统一接口。
 * 设计覆盖了当前引擎所有的渲染操作：
 *
 * 1. 精灵绘制 (drawImage → drawSprite)
 * 2. 矩形填充 (fillRect → fillRect)
 * 3. 混合模式 (globalCompositeOperation → setBlendMode)
 * 4. 透明度 (globalAlpha → setAlpha)
 * 5. 颜色滤镜 (ctx.filter → setFilter)
 * 6. 状态栈 (save/restore → save/restore)
 * 7. 纹理管理 (HTMLCanvasElement → TextureInfo)
 *
 * 使用方法：
 * ```typescript
 * // 之前:
 * ctx.drawImage(canvas, x, y);
 *
 * // 之后:
 * const tex = renderer.createTexture(canvas);
 * renderer.drawSprite(tex, x, y);
 * ```
 */

import type {
  BlendMode,
  ColorFilter,
  DrawSourceOptions,
  DrawSpriteParams,
  FillRectParams,
  RenderStats,
  TextureId,
  TextureInfo,
  TextureSource,
} from "./types";

export interface Renderer {
  // ============= 生命周期 =============

  /** 渲染器类型标识 */
  readonly type: "canvas2d" | "webgl";

  /** 画布宽度 */
  readonly width: number;

  /** 画布高度 */
  readonly height: number;

  /**
   * 初始化渲染器
   * @param canvas HTML canvas 元素
   * @returns 是否初始化成功
   */
  init(canvas: HTMLCanvasElement): boolean;

  /** 销毁渲染器，释放所有 GPU 资源 */
  dispose(): void;

  /**
   * 调整画布尺寸
   */
  resize(width: number, height: number): void;

  // ============= 帧控制 =============

  /**
   * 开始新的一帧渲染
   * - 清空画布
   * - 重置统计数据
   * - 设置默认状态
   */
  beginFrame(): void;

  /**
   * 结束当前帧
   * - 刷新所有待提交的批次
   * - WebGL: 确保所有绘制命令执行完毕
   */
  endFrame(): void;

  // ============= 纹理管理 =============

  /**
   * 从图像源创建纹理
   * - Canvas2D: 直接保存引用
   * - WebGL: 上传到 GPU 创建 WebGLTexture
   *
   * @param source 图像数据源
   * @returns 纹理信息（带唯一 ID）
   */
  createTexture(source: TextureSource): TextureInfo;

  /**
   * 更新已有纹理的内容
   * 用于动画帧更新等场景
   */
  updateTexture(texture: TextureInfo, source: TextureSource): void;

  /**
   * 删除纹理，释放 GPU 资源
   */
  deleteTexture(texture: TextureInfo): void;

  /**
   * 释放通过 drawSource/drawSourceEx 自动缓存的纹理
   *
   * 当外部持有的源对象（如 MPC atlas canvas）即将被丢弃时调用，
   * 确保对应的 GPU 纹理一并释放，避免内存泄漏。
   * 对于没有自动缓存纹理的后端（如 Canvas2D），此方法为空操作。
   */
  releaseSourceTexture(source: TextureSource): void;

  /**
   * 更新已缓存的 source 纹理数据（重新上传像素到 GPU）
   *
   * 用于每帧内容变化的动态 source（如 OffscreenCanvas 合成）。
   * 对于没有自动缓存纹理的后端（如 Canvas2D），此方法为空操作。
   */
  updateSourceTexture(source: TextureSource): void;

  /**
   * 根据 ID 获取纹理
   */
  getTexture(id: TextureId): TextureInfo | null;

  // ============= 精灵绘制 =============

  /**
   * 绘制精灵（最常用的操作）
   *
   * 简化版本：等价于 ctx.drawImage(source, x, y)
   */
  drawSprite(texture: TextureInfo, x: number, y: number): void;

  /**
   * 绘制精灵（完整参数版本）
   *
   * 支持源区域裁切、目标尺寸、翻转、透明度、滤镜
   */
  drawSpriteEx(params: DrawSpriteParams): void;

  // ============= 便捷绘制（直接使用图像源，自动缓存纹理） =============

  /**
   * 直接绘制图像源（HTMLCanvasElement / OffscreenCanvas / ImageData 等）
   * 等价于 ctx.drawImage(source, x, y)
   * WebGL 后端会自动通过 WeakMap 缓存纹理
   */
  drawSource(source: TextureSource, x: number, y: number): void;

  /**
   * 带选项绘制图像源（翻转、裁切、滤镜、透明度）
   * 等价于 ctx.drawImage 的 9 参数版本 + ctx.filter + ctx.globalAlpha
   */
  drawSourceEx(source: TextureSource, x: number, y: number, options: DrawSourceOptions): void;

  // ============= 矩形绘制 =============

  /**
   * 填充矩形
   * 用于：清屏、天气粒子、屏幕特效叠加
   */
  fillRect(params: FillRectParams): void;

  // ============= 状态管理 =============

  /**
   * 保存当前渲染状态到栈
   * 等价于 ctx.save()
   */
  save(): void;

  /**
   * 恢复上一个保存的渲染状态
   * 等价于 ctx.restore()
   */
  restore(): void;

  /**
   * 设置全局透明度
   * 等价于 ctx.globalAlpha = alpha
   */
  setAlpha(alpha: number): void;

  /**
   * 设置混合模式
   * 等价于 ctx.globalCompositeOperation
   */
  setBlendMode(mode: BlendMode): void;

  /**
   * 设置颜色滤镜
   * 等价于 ctx.filter（CSS filter 字符串）
   */
  setFilter(filter: ColorFilter): void;

  // ============= 查询 =============

  /**
   * 获取当前帧的渲染统计
   */
  getStats(): RenderStats;

  /**
   * 获取底层 canvas 元素（用于截图等场景）
   */
  getCanvas(): HTMLCanvasElement | null;

  /**
   * 获取 Canvas 2D 上下文（仅 Canvas2D 后端返回非 null）
   * 用于复杂占位符绘制（文字、圆弧等）的渐进迁移回退
   */
  getContext2D(): CanvasRenderingContext2D | null;

  // ============= 世界缩放 =============

  /**
   * 设置世界坐标缩放（低缩放率大地图支持）
   *
   * 当画布缓冲区尺寸（受 GPU 限制）小于世界可视区域时，
   * 通过此方法设置世界坐标空间大小，渲染器会自动将世界坐标
   * 缩放到画布缓冲区。在 beginFrame 之后、绘制之前调用。
   *
   * - Canvas2D: 内部 ctx.scale(canvasW/worldW, canvasH/worldH)
   * - WebGL: 修改 u_resolution 为 worldW/worldH
   *
   * @param worldWidth  世界可视区域宽度（像素）
   * @param worldHeight 世界可视区域高度（像素）
   */
  applyWorldScale(worldWidth: number, worldHeight: number): void;

  /**
   * 重置世界坐标缩放（恢复 1:1 画布坐标）
   * 在 endFrame 之前调用。
   */
  resetWorldScale(): void;
}
