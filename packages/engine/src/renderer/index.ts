/**
 * 渲染器工厂 & 模块入口
 *
 * 提供统一的创建函数，自动选择最优渲染器后端：
 * 1. 优先尝试 WebGL
 * 2. 降级到 Canvas 2D
 */

// 实现导出
export { Canvas2DRenderer } from "./canvas2d-renderer";
export { parseColor, type RGBAColor } from "./color-utils";
export { RectBatcher } from "./rect-batcher";
// 类型导出
export type { Renderer } from "./renderer";
// 屏幕特效
export * from "./screen-effects";
export {
  createRectProgram,
  createSpriteProgram,
  type RectProgram,
  type SpriteProgram,
} from "./shaders";
export { SpriteBatcher } from "./sprite-batcher";
export type {
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
export { WebGLRenderer } from "./webgl-renderer";

import { logger } from "../core/logger";
import { Canvas2DRenderer } from "./canvas2d-renderer";
// 导入实现类
import type { Renderer } from "./renderer";
import { WebGLRenderer } from "./webgl-renderer";

/** 渲染器后端偏好 */
export type RendererBackend = "auto" | "webgl" | "canvas2d";

/**
 * 创建渲染器
 *
 * @param canvas HTML Canvas 元素
 * @param backend 后端偏好，默认 "auto"（优先 WebGL）
 * @returns Renderer 实例
 */
export function createRenderer(
  canvas: HTMLCanvasElement,
  backend: RendererBackend = "auto"
): Renderer {
  // 强制 Canvas2D
  if (backend === "canvas2d") {
    return createCanvas2DRenderer(canvas);
  }

  // 强制 WebGL
  if (backend === "webgl") {
    const renderer = new WebGLRenderer();
    if (renderer.init(canvas)) {
      logger.info("[Renderer] Using WebGL backend");
      return renderer;
    }
    throw new Error("[Renderer] WebGL not available");
  }

  // Auto: 优先 WebGL，降级 Canvas2D
  const webglRenderer = new WebGLRenderer();
  if (webglRenderer.init(canvas)) {
    logger.info("[Renderer] Using WebGL backend (auto-detected)");
    return webglRenderer;
  }

  logger.warn("[Renderer] WebGL not available, falling back to Canvas 2D");
  return createCanvas2DRenderer(canvas);
}

function createCanvas2DRenderer(canvas: HTMLCanvasElement): Canvas2DRenderer {
  const renderer = new Canvas2DRenderer();
  if (!renderer.init(canvas)) {
    throw new Error("[Renderer] Canvas 2D not available");
  }
  logger.info("[Renderer] Using Canvas 2D backend");
  return renderer;
}

/**
 * 检测当前环境是否支持 WebGL
 */
export function isWebGLAvailable(): boolean {
  try {
    const testCanvas = document.createElement("canvas");
    return testCanvas.getContext("webgl2") !== null;
  } catch {
    // WebGL not available
    return false;
  }
}
