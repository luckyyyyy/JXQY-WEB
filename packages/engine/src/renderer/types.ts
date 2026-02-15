/**
 * WebGL 渲染层核心类型定义
 *
 * 这是渲染抽象层的类型基础，所有渲染器实现（Canvas2D / WebGL）都基于此接口。
 * 设计原则：
 * 1. 接口覆盖当前 Canvas 2D 的所有绘制操作
 * 2. 纹理抽象化，统一 HTMLCanvasElement / WebGLTexture
 * 3. 最小化破坏性改动，保持渐进式迁移能力
 */

// ============= 混合模式 =============

/** 支持的混合模式（映射 Canvas2D globalCompositeOperation 和 WebGL blend func） */
export type BlendMode =
  | "normal" // source-over（默认）
  | "multiply" // 颜色相乘（地图着色）
  | "additive" // 加法混合（发光效果）
  | "screen"; // 滤色

// ============= 颜色滤镜 =============

/** 预定义颜色滤镜（映射 CSS filter 到 shader uniform） */
export type ColorFilter =
  | "none" // 无滤镜
  | "grayscale" // 灰度（石化 - "black"）
  | "frozen" // 冰冻蓝
  | "poison"; // 中毒绿

// ============= 纹理 =============

/** 纹理源类型 */
export type TextureSource =
  | HTMLCanvasElement
  | HTMLImageElement
  | ImageBitmap
  | ImageData
  | OffscreenCanvas;

/** 纹理 ID（用于缓存和引用） */
export type TextureId = number;

/** 纹理信息 */
export interface TextureInfo {
  /** 唯一 ID */
  readonly id: TextureId;
  /** 宽度 */
  readonly width: number;
  /** 高度 */
  readonly height: number;
  /** 纹理是否已上传到 GPU（WebGL 模式） */
  readonly isReady: boolean;
}

// ============= 绘制参数 =============

/** 精灵绘制参数 */
export interface DrawSpriteParams {
  /** 纹理 */
  texture: TextureInfo;
  /** 目标 X 坐标（屏幕空间） */
  x: number;
  /** 目标 Y 坐标（屏幕空间） */
  y: number;
  /** 源区域 X（用于纹理图集裁切），默认 0 */
  srcX?: number;
  /** 源区域 Y，默认 0 */
  srcY?: number;
  /** 源区域宽度，默认纹理宽度 */
  srcWidth?: number;
  /** 源区域高度，默认纹理高度 */
  srcHeight?: number;
  /** 目标宽度，默认源宽度 */
  dstWidth?: number;
  /** 目标高度，默认源高度 */
  dstHeight?: number;
  /** 水平翻转 */
  flipX?: boolean;
  /** 透明度 0-1，默认 1 */
  alpha?: number;
  /** 颜色滤镜 */
  filter?: ColorFilter;
}

/** 矩形填充参数 */
export interface FillRectParams {
  x: number;
  y: number;
  width: number;
  height: number;
  /** CSS 颜色字符串 "rgba(r,g,b,a)" 或 "#hex" */
  color: string;
}

// ============= 渲染状态 =============

/** 渲染器状态快照（用于 save/restore） */
export interface RenderState {
  alpha: number;
  blendMode: BlendMode;
  filter: ColorFilter;
}

// ============= 渲染统计 =============

/** drawSourceEx 选项 */
export interface DrawSourceOptions {
  srcX?: number;
  srcY?: number;
  srcWidth?: number;
  srcHeight?: number;
  dstWidth?: number;
  dstHeight?: number;
  flipX?: boolean;
  alpha?: number;
  filter?: ColorFilter;
}

/** 每帧渲染统计 */
export interface RenderStats {
  /** 绘制调用次数 */
  drawCalls: number;
  /** 绘制的精灵/图像数量 */
  spriteCount: number;
  /** 绘制的矩形数量 */
  rectCount: number;
  /** 纹理切换次数 */
  textureSwaps: number;
  /** 当前已上传的纹理总数 */
  textureCount: number;
}
