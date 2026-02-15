/**
 * WASM 精灵解码器
 *
 * 支持两种格式：
 * - MSF v2 (Miu Sprite Format): zstd 压缩 + 调色板索引
 * - ASF 1.0 (原始格式): RLE 压缩
 *
 * 使用前需要 await initWasm()
 */

import { logger } from "../core/logger";
import type { AsfData, AsfFrame } from "../resource/format/asf";
import type { WasmModule } from "./wasm-manager";
import { getWasmModule, MSF_MAGIC } from "./wasm-manager";

/**
 * 使用 WASM 解码精灵文件（支持 MSF v2 和原始 ASF 格式）
 */
export function decodeAsfWasm(buffer: ArrayBuffer): AsfData | null {
  const wasmModule = getWasmModule();
  if (!wasmModule) {
    logger.warn("[SpriteDecoder] WASM not initialized");
    return null;
  }

  const data = new Uint8Array(buffer);

  if (data.length < 8) {
    logger.warn("[SpriteDecoder] Data too short");
    return null;
  }

  // 检测格式：MSF v2 or 原始 ASF
  const magic = data[0] | (data[1] << 8) | (data[2] << 16) | (data[3] << 24);
  if (magic === MSF_MAGIC) {
    return decodeMsf(wasmModule, data);
  }

  // 尝试原始 ASF 格式
  return decodeOriginalAsf(wasmModule, data);
}

/** 解码原始 ASF 格式 */
function decodeOriginalAsf(wasmModule: WasmModule, data: Uint8Array): AsfData | null {
  const header = wasmModule.parse_asf_header(data);
  if (!header) {
    return null;
  }

  const frameSize = header.width * header.height * 4;
  const totalSize = frameSize * header.frame_count;
  const allPixelData = new Uint8Array(totalSize);

  const frameCount = wasmModule.decode_asf_frames(data, allPixelData);
  if (frameCount === 0) {
    return null;
  }

  const frames: AsfFrame[] = [];
  for (let i = 0; i < header.frame_count; i++) {
    const offset = i * frameSize;
    const pixelData = allPixelData.subarray(offset, offset + frameSize);
    const imageData = new ImageData(new Uint8ClampedArray(pixelData), header.width, header.height);
    frames.push({
      width: header.width,
      height: header.height,
      imageData,
      canvas: null,
    });
  }

  return {
    width: header.width,
    height: header.height,
    frameCount: header.frame_count,
    directions: header.directions,
    colorCount: header.color_count,
    interval: header.interval,
    left: header.left,
    bottom: header.bottom,
    framesPerDirection: header.frames_per_direction,
    frames,
    isLoaded: true,
    pixelFormat: 0,
  };
}

/** 解码 MSF 格式 */
function decodeMsf(
  wasmModule: NonNullable<ReturnType<typeof getWasmModule>>,
  data: Uint8Array
): AsfData | null {
  const header = wasmModule.parse_msf_header(data);
  if (!header) {
    return null;
  }

  const frameSize = header.canvas_width * header.canvas_height * 4;
  const totalSize = frameSize * header.frame_count;

  // 预分配输出 buffer
  const allPixelData = new Uint8Array(totalSize);

  // 解码所有帧
  const frameCount = wasmModule.decode_msf_frames(data, allPixelData);
  if (frameCount === 0) {
    return null;
  }

  // 切分成各帧
  const frames: AsfFrame[] = [];
  for (let i = 0; i < header.frame_count; i++) {
    const offset = i * frameSize;
    const pixelData = allPixelData.subarray(offset, offset + frameSize);

    const imageData = new ImageData(
      new Uint8ClampedArray(pixelData),
      header.canvas_width,
      header.canvas_height
    );

    frames.push({
      width: header.canvas_width,
      height: header.canvas_height,
      imageData,
      canvas: null,
    });
  }

  // MSF fps → interval (ms)
  const interval = header.fps > 0 ? Math.round(1000 / header.fps) : 67;

  return {
    width: header.canvas_width,
    height: header.canvas_height,
    frameCount: header.frame_count,
    directions: header.directions,
    colorCount: header.palette_size,
    interval,
    left: header.anchor_x,
    bottom: header.anchor_y,
    framesPerDirection: header.frames_per_direction,
    frames,
    isLoaded: true,
    pixelFormat: header.pixel_format,
  };
}
