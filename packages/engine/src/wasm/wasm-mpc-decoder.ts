/**
 * WASM MPC 解码器
 *
 * 支持两种格式：
 * - MSF v2 (Miu Sprite Format): zstd 压缩 + 调色板索引
 * - MPC (原始格式): RLE 压缩
 *
 * 使用前需要 await initWasm()
 */

import type { Mpc, MpcFrame, MpcHead } from "../map/types";
import { getWasmModule } from "./wasm-manager";
import type { WasmModule } from "./wasm-manager";

/** MSF v2 magic bytes: "MSF2" */
const MSF_MAGIC = 0x3246534d; // little-endian "MSF2"

/**
 * 使用 WASM 解码 MPC 文件（支持 MSF v2 和原始 MPC 格式）
 * 返回 null 如果 WASM 不可用或解码失败
 */
export function decodeMpcWasm(buffer: ArrayBuffer): Mpc | null {
  const wasmModule = getWasmModule();
  if (!wasmModule) {
    return null;
  }

  const data = new Uint8Array(buffer);

  if (data.length < 8) {
    return null;
  }

  // 检测格式：MSF v2 or 原始 MPC
  const magic = data[0] | (data[1] << 8) | (data[2] << 16) | (data[3] << 24);
  if (magic === MSF_MAGIC) {
    return decodeMsfAsMpc(data, wasmModule);
  }

  // 尝试原始 MPC 格式
  return decodeOriginalMpc(data, wasmModule);
}

/** 解码原始 MPC 格式 */
function decodeOriginalMpc(
  data: Uint8Array,
  wasmModule: WasmModule,
): Mpc | null {
  const header = wasmModule.parse_mpc_header(data);
  if (!header) {
    return null;
  }

  const pixelOutput = new Uint8Array(header.total_pixel_bytes);
  const frameSizesOutput = new Uint8Array(header.frame_count * 2 * 4);
  const frameOffsetsOutput = new Uint8Array(header.frame_count * 4);

  const frameCount = wasmModule.decode_mpc_frames(
    data,
    pixelOutput,
    frameSizesOutput,
    frameOffsetsOutput,
  );

  if (frameCount === 0) {
    return null;
  }

  const frameSizes = new Uint32Array(frameSizesOutput.buffer);
  const frameOffsets = new Uint32Array(frameOffsetsOutput.buffer);

  const frames: MpcFrame[] = [];
  for (let i = 0; i < frameCount; i++) {
    const width = frameSizes[i * 2];
    const height = frameSizes[i * 2 + 1];
    const offset = frameOffsets[i];
    const frameSize = width * height * 4;

    const pixelData = new Uint8ClampedArray(frameSize);
    pixelData.set(pixelOutput.subarray(offset, offset + frameSize));

    const imageData = new ImageData(pixelData, width, height);
    frames.push({ width, height, imageData });
  }

  const head: MpcHead = {
    framesDataLengthSum: header.frames_data_length_sum,
    globalWidth: header.global_width,
    globalHeight: header.global_height,
    frameCounts: header.frame_count,
    direction: header.direction,
    colourCounts: header.color_count,
    interval: header.interval,
    bottom: header.bottom,
    left: header.left,
  };

  return { head, frames, palette: [] };
}

/**
 * 解码 MSF 格式数据为 Mpc 结构（MPC 转换后的 MSF 文件）
 */
function decodeMsfAsMpc(
  data: Uint8Array,
  wasmModule: ReturnType<typeof getWasmModule> & object,
): Mpc | null {
  const wasm = wasmModule as import("./wasm-manager").WasmModule;
  const header = wasm.parse_msf_header(data);
  if (!header) {
    return null;
  }

  // Allocate buffers based on header info
  const pixelOutput = new Uint8Array(header.total_individual_pixel_bytes);
  const frameSizesOutput = new Uint8Array(header.frame_count * 2 * 4);
  const frameOffsetsOutput = new Uint8Array(header.frame_count * 4);

  const frameCount = wasm.decode_msf_individual_frames(
    data,
    pixelOutput,
    frameSizesOutput,
    frameOffsetsOutput,
  );

  if (frameCount === 0) {
    return null;
  }

  const frameSizes = new Uint32Array(frameSizesOutput.buffer);
  const frameOffsets = new Uint32Array(frameOffsetsOutput.buffer);

  const frames: MpcFrame[] = [];
  for (let i = 0; i < frameCount; i++) {
    const width = frameSizes[i * 2];
    const height = frameSizes[i * 2 + 1];
    const offset = frameOffsets[i];
    const frameSize = width * height * 4;

    const pixelData = new Uint8ClampedArray(frameSize);
    pixelData.set(pixelOutput.subarray(offset, offset + frameSize));

    const imageData = new ImageData(pixelData, width, height);
    frames.push({ width, height, imageData });
  }

  const head: MpcHead = {
    framesDataLengthSum: 0,
    globalWidth: header.canvas_width,
    globalHeight: header.canvas_height,
    frameCounts: header.frame_count,
    direction: header.directions,
    colourCounts: header.palette_size,
    interval: Math.round(1000 / Math.max(header.fps, 1)),
    bottom: header.anchor_y,
    left: header.anchor_x,
  };

  return { head, frames, palette: [] };
}


