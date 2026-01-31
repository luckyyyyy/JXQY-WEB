/**
 * ASF 加载器 - 游戏的精灵动画格式
 * 格式: Header(16) + Metadata(64) + Palette(colors*4) + FrameOffsets(frames*8) + RLE压缩帧数据
 */

import { logger } from "../core/logger";
import { resourceLoader } from "../resource/resourceLoader";

export interface AsfFrame {
  width: number;
  height: number;
  imageData: ImageData;
  canvas: HTMLCanvasElement | null;
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
}

export function clearAsfCache(): void {
  resourceLoader.clearCache("asf");
}

function getInt32LE(buf: DataView, offset: number): number {
  return buf.getInt32(offset, true);
}

export async function loadAsf(url: string): Promise<AsfData | null> {
  return resourceLoader.loadParsedBinary<AsfData>(url, parseAsf, "asf");
}

function parseAsf(buffer: ArrayBuffer): AsfData | null {
  const bytes = new Uint8Array(buffer);
  const view = new DataView(buffer);

  // 检查文件签名
  if (String.fromCharCode(...bytes.slice(0, 7)) !== "ASF 1.0") {
    logger.warn("Invalid ASF signature");
    return null;
  }

  let offset = 16;

  // 读取元数据
  const width = getInt32LE(view, offset); offset += 4;
  const height = getInt32LE(view, offset); offset += 4;
  const frameCount = getInt32LE(view, offset); offset += 4;
  const directions = getInt32LE(view, offset); offset += 4;
  const colorCount = getInt32LE(view, offset); offset += 4;
  const interval = getInt32LE(view, offset); offset += 4;
  const left = getInt32LE(view, offset); offset += 4;
  const bottom = getInt32LE(view, offset); offset += 4;
  offset += 16;

  // 读取调色板 (BGRA -> RGBA)
  const palette: Uint8ClampedArray[] = [];
  for (let i = 0; i < colorCount; i++) {
    const b = bytes[offset++], g = bytes[offset++], r = bytes[offset++];
    offset++;
    palette.push(new Uint8ClampedArray([r, g, b, 255]));
  }

  // 读取帧偏移和长度
  const frameOffsets: number[] = [], frameLengths: number[] = [];
  for (let i = 0; i < frameCount; i++) {
    frameOffsets.push(getInt32LE(view, offset)); offset += 4;
    frameLengths.push(getInt32LE(view, offset)); offset += 4;
  }

  // 解码帧
  const frames = frameOffsets.map((off, i) =>
    decodeFrame(bytes, off, frameLengths[i], width, height, palette)
  );

  const framesPerDirection = directions > 0
    ? Math.max(1, Math.floor(frameCount / directions))
    : Math.max(1, frameCount);

  return {
    width, height, frameCount, directions, colorCount, interval,
    left, bottom, framesPerDirection, frames, isLoaded: true
  };
}

/** RLE 解压缩单帧 */
function decodeFrame(
  bytes: Uint8Array,
  offset: number,
  length: number,
  width: number,
  height: number,
  palette: Uint8ClampedArray[]
): AsfFrame {
  const imageData = new ImageData(width, height);
  const data = imageData.data;
  const dataEnd = offset + length;
  const maxPixels = width * height * 4;
  let pixelIdx = 0;

  try {
    while (offset < dataEnd && pixelIdx < maxPixels) {
      const pixelCount = bytes[offset++];
      const pixelAlpha = bytes[offset++];

      for (let k = 0; k < pixelCount && pixelIdx < maxPixels; k++) {
        if (pixelAlpha === 0) {
          data[pixelIdx++] = 0; data[pixelIdx++] = 0;
          data[pixelIdx++] = 0; data[pixelIdx++] = 0;
        } else {
          const color = palette[bytes[offset++]] || new Uint8ClampedArray([255, 0, 255, 255]);
          data[pixelIdx++] = color[0]; data[pixelIdx++] = color[1];
          data[pixelIdx++] = color[2]; data[pixelIdx++] = pixelAlpha;
        }
      }
    }
  } catch {
    logger.warn("ASF frame decode error");
  }

  return { width, height, imageData, canvas: null };
}

/** 获取帧的 canvas（延迟创建） */
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

/** 获取帧索引 */
export function getFrameIndex(asf: AsfData, direction: number, animFrame: number): number {
  if (!asf || asf.frameCount === 0) return 0;
  const dir = Math.min(direction, Math.max(0, asf.directions - 1));
  const framesPerDir = asf.framesPerDirection || 1;
  return Math.min(dir * framesPerDir + (animFrame % framesPerDir), asf.frames.length - 1);
}

/** 绘制 ASF 帧 */
export function drawAsfFrame(
  ctx: CanvasRenderingContext2D,
  asf: AsfData,
  frameIndex: number,
  x: number,
  y: number,
  flipX: boolean = false
): void {
  if (!asf || frameIndex < 0 || frameIndex >= asf.frames.length) return;

  const canvas = getFrameCanvas(asf.frames[frameIndex]);
  ctx.save();
  if (flipX) {
    ctx.translate(x + asf.width, y);
    ctx.scale(-1, 1);
    ctx.drawImage(canvas, 0, 0);
  } else {
    ctx.drawImage(canvas, x, y);
  }
  ctx.restore();
}
