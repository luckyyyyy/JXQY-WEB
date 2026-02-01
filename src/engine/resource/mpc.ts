/**
 * MPC file parser - matches C# Engine/Mpc.cs implementation
 *
 * MPC files can optionally have associated SHD (shadow) files.
 * When SHD is present, shadow data is used as the base layer,
 * and MPC color pixels are drawn on top.
 */

import { getLittleEndianInt } from "../utils/binaryUtils";
import { logger } from "../core/logger";
import type { Mpc, MpcFrame, MpcHead } from "../core/mapTypes";
import { resourceLoader } from "./resourceLoader";
import { type Shd, loadShd } from "./shd";

/**
 * Parse an MPC file buffer into an Mpc object
 */
export async function parseMpc(buffer: ArrayBuffer): Promise<Mpc | null> {
  const data = new Uint8Array(buffer);

  // Check header - "MPC File Ver" at offset 0
  const header = String.fromCharCode(...data.slice(0, 12));
  if (!header.startsWith("MPC File Ver") && !header.startsWith("SHD File Ver")) {
    logger.error("Invalid MPC file header:", header);
    return null;
  }

  // Header data starts at offset 64
  let offset = 64;

  const head: MpcHead = {
    framesDataLengthSum: getLittleEndianInt(data, offset),
    globleWidth: getLittleEndianInt(data, offset + 4),
    globleHeight: getLittleEndianInt(data, offset + 8),
    frameCounts: getLittleEndianInt(data, offset + 12),
    direction: getLittleEndianInt(data, offset + 16),
    colourCounts: getLittleEndianInt(data, offset + 20),
    interval: getLittleEndianInt(data, offset + 24),
    bottom: getLittleEndianInt(data, offset + 28),
    left: 0,
  };

  // Transform to asf offset type (from C#)
  head.left = Math.floor(head.globleWidth / 2);
  if (head.globleHeight >= 16) {
    head.bottom = head.globleHeight - 16 - head.bottom;
  } else {
    head.bottom = 16 - head.globleHeight - head.bottom;
  }

  // Skip to palette - C# reads 8 ints (32 bytes) starting at 64, then skips 32 more bytes
  // So: 64 + 32 (8 ints) + 32 (skip) = 128
  offset = 128;

  // Load palette (256 colors typically)
  const palette: Uint8ClampedArray[] = [];
  for (let i = 0; i < head.colourCounts; i++) {
    // BGR format in file (BGRA)
    const b = data[offset++];
    const g = data[offset++];
    const r = data[offset++];
    offset++; // Skip padding byte
    palette.push(new Uint8ClampedArray([r, g, b, 255]));
  }

  // After palette, we have frame offset table and frame data
  // The frame offsets are relative to the start of frame data area
  const _frameOffsetsStart = offset;
  const dataOffsets: number[] = [];

  for (let i = 0; i < head.frameCounts; i++) {
    dataOffsets.push(getLittleEndianInt(data, offset));
    offset += 4;
  }

  // Frame data starts after the offset table
  const frameDataStart = offset;

  // Load frames
  const frames: MpcFrame[] = [];

  for (let j = 0; j < head.frameCounts; j++) {
    let dataStart = frameDataStart + dataOffsets[j];
    const dataLen = getLittleEndianInt(data, dataStart);
    dataStart += 4;
    const width = getLittleEndianInt(data, dataStart);
    dataStart += 4;
    const height = getLittleEndianInt(data, dataStart);
    dataStart += 4;
    dataStart += 8; // Skip 8 bytes (2 ints for some offset data)

    if (width <= 0 || height <= 0 || width > 2048 || height > 2048) {
      logger.warn(`Invalid frame dimensions: ${width}x${height}`);
      frames.push({ width: 1, height: 1, imageData: new ImageData(1, 1) });
      continue;
    }

    const pixelData = new Uint8ClampedArray(width * height * 4);
    let dataIdx = 0;
    // C#: var dataend = datastart + datalen - 20;
    // dataStart is already at: frameStart + 20 (4+4+4+8)
    // so dataEnd = dataStart + dataLen - 20 = frameStart + dataLen
    const dataEnd = frameDataStart + dataOffsets[j] + dataLen;

    while (dataStart < dataEnd && dataIdx < width * height) {
      const byte = data[dataStart];
      if (byte > 0x80) {
        // Transparent pixels
        const transparentCount = byte - 0x80;
        for (let ti = 0; ti < transparentCount && dataIdx < width * height; ti++) {
          const idx = dataIdx * 4;
          pixelData[idx] = 0;
          pixelData[idx + 1] = 0;
          pixelData[idx + 2] = 0;
          pixelData[idx + 3] = 0;
          dataIdx++;
        }
        dataStart++;
      } else {
        // Colored pixels
        const colorCount = byte;
        dataStart++;
        for (let ci = 0; ci < colorCount && dataIdx < width * height; ci++) {
          const paletteIdx = data[dataStart++];
          const idx = dataIdx * 4;
          if (paletteIdx < palette.length) {
            pixelData[idx] = palette[paletteIdx][0];
            pixelData[idx + 1] = palette[paletteIdx][1];
            pixelData[idx + 2] = palette[paletteIdx][2];
            pixelData[idx + 3] = palette[paletteIdx][3];
          } else {
            pixelData[idx] = 0;
            pixelData[idx + 1] = 0;
            pixelData[idx + 2] = 0;
            pixelData[idx + 3] = 0;
          }
          dataIdx++;
        }
      }
    }

    // Fill remaining with transparent
    while (dataIdx < width * height) {
      const idx = dataIdx * 4;
      pixelData[idx] = 0;
      pixelData[idx + 1] = 0;
      pixelData[idx + 2] = 0;
      pixelData[idx + 3] = 0;
      dataIdx++;
    }

    const imageData = new ImageData(pixelData, width, height);
    frames.push({ width, height, imageData });
  }

  return { head, frames, palette };
}

/**
 * Load an MPC file from a URL
 * Uses unified resourceLoader for caching parsed results
 */
export async function loadMpc(url: string): Promise<Mpc | null> {
  return resourceLoader.loadParsedBinary<Mpc>(
    url,
    (buffer) => parseMpcBuffer(buffer, null),
    "mpc"
  );
}

/**
 * Load an MPC file with optional SHD shadow file
 * Based on C# Mpc(string path, string shdFileName) constructor
 *
 * When SHD is provided, shadow data serves as the base layer
 * and MPC color pixels are drawn on top (preserving shadow under transparent areas)
 *
 * @param mpcUrl - URL to the MPC file
 * @param shdUrl - Optional URL to the SHD shadow file
 */
export async function loadMpcWithShadow(
  mpcUrl: string,
  shdUrl?: string
): Promise<Mpc | null> {
  // Load SHD first if provided
  let shd: Shd | null = null;
  if (shdUrl) {
    shd = await loadShd(shdUrl);
    if (!shd) {
      logger.warn(`[MPC] SHD file not found: ${shdUrl}, loading MPC without shadow`);
    }
  }

  // Load and parse MPC with SHD data
  const buffer = await resourceLoader.loadBinary(mpcUrl);
  if (!buffer) {
    logger.error(`[MPC] Failed to load: ${mpcUrl}`);
    return null;
  }

  return parseMpcBuffer(buffer, shd);
}

/**
 * Sync version of MPC parsing for resourceLoader
 * @param buffer - MPC file buffer
 * @param shd - Optional pre-loaded SHD shadow data
 */
function parseMpcBuffer(buffer: ArrayBuffer, shd: Shd | null): Mpc | null {
  try {
    const data = new Uint8Array(buffer);

    // Check header - "MPC File Ver" at offset 0
    const header = String.fromCharCode(...data.slice(0, 12));
    if (!header.startsWith("MPC File Ver") && !header.startsWith("SHD File Ver")) {
      logger.error("Invalid MPC file header:", header);
      return null;
    }

    // Header data starts at offset 64
    let offset = 64;

    const head: MpcHead = {
      framesDataLengthSum: getLittleEndianInt(data, offset),
      globleWidth: getLittleEndianInt(data, offset + 4),
      globleHeight: getLittleEndianInt(data, offset + 8),
      frameCounts: getLittleEndianInt(data, offset + 12),
      direction: getLittleEndianInt(data, offset + 16),
      colourCounts: getLittleEndianInt(data, offset + 20),
      interval: getLittleEndianInt(data, offset + 24),
      bottom: getLittleEndianInt(data, offset + 28),
      left: 0,
    };

    // Transform to asf offset type (from C#)
    head.left = Math.floor(head.globleWidth / 2);
    if (head.globleHeight >= 16) {
      head.bottom = head.globleHeight - 16 - head.bottom;
    } else {
      head.bottom = 16 - head.globleHeight - head.bottom;
    }

    // Skip to palette - C# reads 8 ints (32 bytes) starting at 64, then skips 32 more bytes
    offset = 128;

    // Load palette (256 colors typically)
    const palette: Uint8ClampedArray[] = [];
    for (let i = 0; i < head.colourCounts; i++) {
      const b = data[offset++];
      const g = data[offset++];
      const r = data[offset++];
      offset++;
      palette.push(new Uint8ClampedArray([r, g, b, 255]));
    }

    // After palette, we have frame offset table and frame data
    const dataOffsets: number[] = [];
    for (let i = 0; i < head.frameCounts; i++) {
      dataOffsets.push(getLittleEndianInt(data, offset));
      offset += 4;
    }

    // Frame data starts after the offset table
    const frameDataStart = offset;

    // Load frames
    const frames: MpcFrame[] = [];
    for (let j = 0; j < head.frameCounts; j++) {
      let dataStart = frameDataStart + dataOffsets[j];
      const dataLen = getLittleEndianInt(data, dataStart);
      dataStart += 4;
      const width = getLittleEndianInt(data, dataStart);
      dataStart += 4;
      const height = getLittleEndianInt(data, dataStart);
      dataStart += 4;
      dataStart += 8;

      if (width <= 0 || height <= 0 || width > 2048 || height > 2048) {
        frames.push({ width: 1, height: 1, imageData: new ImageData(1, 1) });
        continue;
      }

      // Check if we have SHD shadow data for this frame
      // C#: var hasShd = (_shd != null) && (_shd.GetFrameData(j) != null);
      const shdFrame = shd && j >= 0 && j < shd.frames.length ? shd.frames[j] : null;
      const hasShd = shdFrame !== null && shdFrame.width === width && shdFrame.height === height;

      // If we have SHD, use shadow data as base; otherwise create empty array
      // C#: var data = hasShd ? _shd.GetFrameData(j) : new Color[width * height];
      let pixelData: Uint8ClampedArray;
      if (hasShd && shdFrame) {
        // Copy SHD data as base (shadow layer)
        pixelData = new Uint8ClampedArray(shdFrame.data);
      } else {
        pixelData = new Uint8ClampedArray(width * height * 4);
      }

      let dataIdx = 0;
      // C#: var dataend = datastart + datalen - 20;
      // dataStart is already at: frameStart + 20 (4+4+4+8)
      // so dataEnd = dataStart + dataLen - 20 = frameStart + dataLen
      const dataEnd = frameDataStart + dataOffsets[j] + dataLen;

      while (dataStart < dataEnd && dataIdx < width * height) {
        const byte = data[dataStart];
        if (byte > 0x80) {
          // Transparent pixels
          const transparentCount = byte - 0x80;
          // C#: if (!hasShd) { for (...) data[dataidx++] = Color.Transparent; } else { dataidx += transparentCount; }
          if (!hasShd) {
            // No shadow - fill with transparent
            for (let ti = 0; ti < transparentCount && dataIdx < width * height; ti++) {
              const idx = dataIdx * 4;
              pixelData[idx] = 0;
              pixelData[idx + 1] = 0;
              pixelData[idx + 2] = 0;
              pixelData[idx + 3] = 0;
              dataIdx++;
            }
          } else {
            // Has shadow - keep shadow data, just advance index
            dataIdx += transparentCount;
          }
          dataStart++;
        } else {
          // Colored pixels - always overwrite (both with and without SHD)
          const colorCount = byte;
          dataStart++;
          for (let ci = 0; ci < colorCount && dataIdx < width * height; ci++) {
            const paletteIdx = data[dataStart++];
            const idx = dataIdx * 4;
            if (paletteIdx < palette.length) {
              pixelData[idx] = palette[paletteIdx][0];
              pixelData[idx + 1] = palette[paletteIdx][1];
              pixelData[idx + 2] = palette[paletteIdx][2];
              pixelData[idx + 3] = palette[paletteIdx][3];
            } else {
              pixelData[idx] = 0;
              pixelData[idx + 1] = 0;
              pixelData[idx + 2] = 0;
              pixelData[idx + 3] = 0;
            }
            dataIdx++;
          }
        }
      }

      while (dataIdx < width * height) {
        const idx = dataIdx * 4;
        pixelData[idx] = 0;
        pixelData[idx + 1] = 0;
        pixelData[idx + 2] = 0;
        pixelData[idx + 3] = 0;
        dataIdx++;
      }

      // Create ImageData from pixel data
      const imageData = new ImageData(width, height);
      imageData.data.set(pixelData);
      frames.push({ width, height, imageData });
    }

    return { head, frames, palette };
  } catch (error) {
    logger.error("Error parsing MPC:", error);
    return null;
  }
}

/**
 * Clear the MPC cache (delegates to resourceLoader)
 */
export function clearMpcCache(): void {
  resourceLoader.clearCache("mpc");
}
