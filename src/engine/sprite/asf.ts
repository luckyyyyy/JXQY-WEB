/**
 * ASF (Animated Sprite File) Loader - based on JxqyHD Engine/Asf.cs
 * ASF is a custom sprite format used in the game for character animations
 *
 * File Format:
 * - Header (16 bytes): "ASF 1.0" signature + padding
 * - Metadata (64 bytes): width, height, frameCount, directions, colors, interval, left, bottom
 * - Palette: colors * 4 bytes (BGRA)
 * - Frame offsets: frameCount * 8 bytes (offset + length)
 * - Frame data: RLE compressed pixel data with alpha
 */

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
  interval: number; // Animation interval in milliseconds
  left: number; // Offset from left
  bottom: number; // Offset from bottom (for positioning)
  framesPerDirection: number;
  frames: AsfFrame[];
  isLoaded: boolean;
}

/**
 * Clear ASF cache (delegates to resourceLoader)
 */
export function clearAsfCache(): void {
  resourceLoader.clearCache("asf");
}

/**
 * Get little-endian 32-bit integer from buffer
 */
function getInt32LE(buf: DataView, offset: number): number {
  return buf.getInt32(offset, true);
}

/**
 * Load and parse an ASF file
 * Uses unified resourceLoader for caching parsed results
 */
export async function loadAsf(url: string): Promise<AsfData | null> {
  return resourceLoader.loadParsedBinary<AsfData>(url, parseAsf, "asf");
}

/**
 * Parse ASF buffer
 */
function parseAsf(buffer: ArrayBuffer): AsfData | null {
  const bytes = new Uint8Array(buffer);
  const view = new DataView(buffer);

  // Check header signature "ASF 1.0"
  const signature = String.fromCharCode(...bytes.slice(0, 7));
  if (signature !== "ASF 1.0") {
    console.warn("Invalid ASF signature:", signature);
    return null;
  }

  let offset = 16; // Skip header

  // Read metadata
  const width = getInt32LE(view, offset);
  offset += 4;
  const height = getInt32LE(view, offset);
  offset += 4;
  const frameCount = getInt32LE(view, offset);
  offset += 4;
  const directions = getInt32LE(view, offset);
  offset += 4;
  const colorCount = getInt32LE(view, offset);
  offset += 4;
  const interval = getInt32LE(view, offset);
  offset += 4;
  const left = getInt32LE(view, offset);
  offset += 4;
  const bottom = getInt32LE(view, offset);
  offset += 4;

  offset += 16; // Skip padding

  // Read palette (BGRA format)
  const palette: Uint8ClampedArray[] = [];
  for (let i = 0; i < colorCount; i++) {
    const b = bytes[offset++];
    const g = bytes[offset++];
    const r = bytes[offset++];
    offset++; // Skip alpha (always 0xFF)
    palette.push(new Uint8ClampedArray([r, g, b, 255]));
  }

  // Read frame offsets and lengths
  const frameOffsets: number[] = [];
  const frameLengths: number[] = [];
  for (let i = 0; i < frameCount; i++) {
    frameOffsets.push(getInt32LE(view, offset));
    offset += 4;
    frameLengths.push(getInt32LE(view, offset));
    offset += 4;
  }

  // Decode frames
  const frames: AsfFrame[] = [];
  for (let i = 0; i < frameCount; i++) {
    const frame = decodeFrame(bytes, frameOffsets[i], frameLengths[i], width, height, palette);
    frames.push(frame);
  }

  // Ensure framesPerDirection is at least 1 to avoid division by zero
  const framesPerDirection = directions > 0 ? Math.max(1, Math.floor(frameCount / directions)) : Math.max(1, frameCount);

  return {
    width,
    height,
    frameCount,
    directions,
    colorCount,
    interval: interval || 100, // Default to 100ms if not specified
    left,
    bottom,
    framesPerDirection,
    frames,
    isLoaded: true,
  };
}

/**
 * Decode a single frame using RLE decompression
 */
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

  let dataIdx = 0;
  const dataEnd = offset + length;
  let pixelIdx = 0;

  try {
    while (offset < dataEnd && pixelIdx < width * height * 4) {
      const pixelCount = bytes[offset++];
      const pixelAlpha = bytes[offset++];

      for (let k = 0; k < pixelCount && pixelIdx < width * height * 4; k++) {
        if (pixelAlpha === 0) {
          // Transparent pixel
          data[pixelIdx++] = 0;
          data[pixelIdx++] = 0;
          data[pixelIdx++] = 0;
          data[pixelIdx++] = 0;
        } else {
          // Colored pixel with alpha
          const colorIdx = bytes[offset++];
          const color = palette[colorIdx] || new Uint8ClampedArray([255, 0, 255, 255]);
          const alpha = pixelAlpha;

          data[pixelIdx++] = color[0];
          data[pixelIdx++] = color[1];
          data[pixelIdx++] = color[2];
          data[pixelIdx++] = alpha;
        }
      }
    }
  } catch (e) {
    // File corruption - return what we have
    console.warn("ASF frame decode error:", e);
  }

  return {
    width,
    height,
    imageData,
    canvas: null, // Will be created lazily
  };
}

/**
 * Get a canvas element for a frame (creates if needed)
 */
export function getFrameCanvas(frame: AsfFrame): HTMLCanvasElement {
  if (frame.canvas) {
    return frame.canvas;
  }

  // Ensure valid dimensions (minimum 1x1 to avoid rendering issues)
  const width = Math.max(1, frame.width);
  const height = Math.max(1, frame.height);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  // Use willReadFrequently since this canvas may be read by edge detection (getImageData)
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (ctx) {
    ctx.putImageData(frame.imageData, 0, 0);
  }
  frame.canvas = canvas;
  return canvas;
}

/**
 * Get frame index for a direction and animation frame
 */
export function getFrameIndex(asf: AsfData, direction: number, animFrame: number): number {
  if (!asf || asf.frameCount === 0) return 0;

  const dir = Math.min(direction, Math.max(0, asf.directions - 1));
  const framesPerDir = asf.framesPerDirection || 1;
  const frame = animFrame % framesPerDir;

  // Clamp to valid frame range
  return Math.min(dir * framesPerDir + frame, asf.frames.length - 1);
}

/**
 * Draw ASF frame on canvas
 */
export function drawAsfFrame(
  ctx: CanvasRenderingContext2D,
  asf: AsfData,
  frameIndex: number,
  x: number,
  y: number,
  flipX: boolean = false
): void {
  if (!asf || frameIndex < 0 || frameIndex >= asf.frames.length) return;

  const frame = asf.frames[frameIndex];
  const canvas = getFrameCanvas(frame);

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
