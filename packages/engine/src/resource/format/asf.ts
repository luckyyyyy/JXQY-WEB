/**
 * 精灵动画加载器 - 支持 MSF (Miu Sprite Format) 新格式
 *
 * MSF 格式: per-frame tight bbox + indexed8 像素，HTTP 传输时自动压缩
 * 向后兼容：如果传入 .asf 路径，自动重写为 .msf
 *
 * 使用 WASM 解码器
 * 注意：使用前需在应用启动时调用 await initWasm()
 */

import { decodeAsfWasm } from "../../wasm/wasm-asf-decoder";
import { resourceLoader } from "../resource-loader";

export interface AsfFrame {
  width: number;
  height: number;
  imageData: ImageData;
  canvas: HTMLCanvasElement | null;
}

/** ASF 帧图集：所有帧打包到一张 canvas 中，减少纹理切换 */
export interface AsfAtlas {
  canvas: HTMLCanvasElement;
  /** 每帧在 atlas 中的源矩形 */
  rects: { x: number; y: number; w: number; h: number }[];
}

export interface AsfData {
  width: number;
  height: number;
  frameCount: number;
  directions: number;
  colorCount: number;
  interval: number;
  left: number;
  bottom: number;
  framesPerDirection: number;
  frames: AsfFrame[];
  isLoaded: boolean;
  /** 帧图集（延迟创建） */
  atlas?: AsfAtlas;
  /** MSF 像素格式: 0=Rgba8, 1=Indexed8, 2=Indexed8Alpha8 */
  pixelFormat?: number;
}

export function clearAsfCache(): void {
  resourceLoader.clearCache("asf");
}

/**
 * 将 .asf 扩展名重写为 .msf（兼容旧路径引用）
 */
function rewriteAsfToMsf(url: string): string {
  return url.replace(/\.asf$/i, ".msf");
}

/**
 * 同步获取已缓存的 ASF
 * 必须先通过 loadAsf 加载过才能获取
 */
export function getCachedAsf(url: string): AsfData | null {
  return resourceLoader.getFromCache<AsfData>(rewriteAsfToMsf(url), "asf");
}

export async function loadAsf(url: string): Promise<AsfData | null> {
  const msfUrl = rewriteAsfToMsf(url);
  return resourceLoader.loadParsedBinary<AsfData>(msfUrl, decodeAsfWasm, "asf");
}

/** 获取帧的 canvas（延迟创建）— 用于 UI 预览等非批量渲染场景 */
export function getFrameCanvas(frame: AsfFrame): HTMLCanvasElement {
  if (frame.canvas) return frame.canvas;

  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, frame.width);
  canvas.height = Math.max(1, frame.height);
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (ctx) ctx.putImageData(frame.imageData, 0, 0);
  frame.canvas = canvas;
  return canvas;
}

/** 构建 ASF 帧图集：将所有帧打包到一张 canvas（网格排列） */
function buildAsfAtlas(asf: AsfData): AsfAtlas {
  const frames = asf.frames;
  if (frames.length === 0) {
    const c = document.createElement("canvas");
    c.width = 1;
    c.height = 1;
    return { canvas: c, rects: [] };
  }

  // ASF 所有帧尺寸相同（来自 header 的 width/height）
  const fw = asf.width;
  const fh = asf.height;

  // 网格排列：每行最多 16 帧
  const cols = Math.min(frames.length, 16);
  const rows = Math.ceil(frames.length / cols);

  const atlasW = cols * fw;
  const atlasH = rows * fh;

  const canvas = document.createElement("canvas");
  canvas.width = atlasW;
  canvas.height = atlasH;
  const ctx = canvas.getContext("2d");

  const rects: { x: number; y: number; w: number; h: number }[] = [];

  if (ctx) {
    for (let i = 0; i < frames.length; i++) {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const x = col * fw;
      const y = row * fh;
      ctx.putImageData(frames[i].imageData, x, y);
      rects.push({ x, y, w: frames[i].width, h: frames[i].height });
    }
  }

  return { canvas, rects };
}

/** 获取 ASF 的帧图集（延迟创建并缓存） */
export function getAsfAtlas(asf: AsfData): AsfAtlas {
  if (asf.atlas) return asf.atlas;
  asf.atlas = buildAsfAtlas(asf);
  return asf.atlas;
}

/** 帧图集绘制信息（复用对象，避免热路径每帧数百次 GC 分配） */
export interface FrameAtlasInfo {
  canvas: HTMLCanvasElement;
  srcX: number;
  srcY: number;
  srcWidth: number;
  srcHeight: number;
}

/** 预分配的复用对象（热路径优化：每帧调用数百次，不再每次 new 对象） */
const _reusableAtlasInfo: FrameAtlasInfo = {
  canvas: null!,
  srcX: 0,
  srcY: 0,
  srcWidth: 0,
  srcHeight: 0,
};

/**
 * 获取帧的图集绘制信息（用于批量渲染的热路径）
 * 返回共享的复用对象 — 调用方必须在下一次调用前使用完毕，不要持有引用！
 */
export function getFrameAtlasInfo(asf: AsfData, frameIdx: number): FrameAtlasInfo {
  const atlas = getAsfAtlas(asf);
  const rect = atlas.rects[frameIdx];
  _reusableAtlasInfo.canvas = atlas.canvas;
  _reusableAtlasInfo.srcX = rect.x;
  _reusableAtlasInfo.srcY = rect.y;
  _reusableAtlasInfo.srcWidth = rect.w;
  _reusableAtlasInfo.srcHeight = rect.h;
  return _reusableAtlasInfo;
}

/** 获取帧索引 */
export function getFrameIndex(asf: AsfData, direction: number, animFrame: number): number {
  if (!asf || asf.frameCount === 0) return 0;
  const dir = Math.min(direction, Math.max(0, asf.directions - 1));
  const framesPerDir = asf.framesPerDirection || 1;
  return Math.min(dir * framesPerDir + (animFrame % framesPerDir), asf.frames.length - 1);
}
