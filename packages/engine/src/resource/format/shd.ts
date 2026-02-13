/**
 * SHD (Shadow) file parser - matches Engine/Shd.cs implementation
 *
 * SHD files store shadow data for MPC sprites. Unlike MPC files:
 * - No palette (shadow is always semi-transparent black)
 * - Pixels are either transparent or 60% opacity black
 *
 * Reference: Engine/Shd.cs
 */

import { logger } from "../../core/logger";
import type { MpcHead } from "../../map/types";
import { getLittleEndianInt } from "./binary-utils";
import { resourceLoader } from "../resource-loader";

/**
 * SHD frame data - array of RGBA values (shadow pixels)
 */
export interface ShdFrame {
  width: number;
  height: number;
  /** Pixel data: transparent (0) or semi-transparent black (0,0,0,153) */
  data: Uint8ClampedArray;
}

/**
 * Parsed SHD file
 */
export interface Shd {
  head: MpcHead;
  frames: ShdFrame[];
}

/**
 * Parse an SHD file buffer
 *  LoadFrame()
 *
 * Key differences from MPC:
 * - LoadPalette is empty (no palette in SHD files)
 * - Colored pixels become semi-transparent black (Color.Black * 0.6f)
 */
export function parseShdBuffer(buffer: ArrayBuffer): Shd | null {
  try {
    const data = new Uint8Array(buffer);

    // Check header - "SHD File Ver" at offset 0
    const header = String.fromCharCode(...data.slice(0, 12));
    if (!header.startsWith("SHD File Ver")) {
      logger.error("[SHD] Invalid file header:", header);
      return null;
    }

    // Header data starts at offset 64
    let offset = 64;

    const head: MpcHead = {
      framesDataLengthSum: getLittleEndianInt(data, offset),
      globalWidth: getLittleEndianInt(data, offset + 4),
      globalHeight: getLittleEndianInt(data, offset + 8),
      frameCounts: getLittleEndianInt(data, offset + 12),
      direction: getLittleEndianInt(data, offset + 16),
      colourCounts: getLittleEndianInt(data, offset + 20),
      interval: getLittleEndianInt(data, offset + 24),
      bottom: getLittleEndianInt(data, offset + 28),
      left: 0,
    };

    // Transform to asf offset type (same as MPC)
    head.left = Math.floor(head.globalWidth / 2);
    if (head.globalHeight >= 16) {
      head.bottom = head.globalHeight - 16 - head.bottom;
    } else {
      head.bottom = 16 - head.globalHeight - head.bottom;
    }

    // Skip header (no palette in SHD files!)
    // Shd.LoadPalette() is empty, so we skip directly to frame offsets
    // After 64 + 32 (head) + 32 (skip) = 128, but no palette
    offset = 128;

    // Frame offset table
    const dataOffsets: number[] = [];
    for (let i = 0; i < head.frameCounts; i++) {
      dataOffsets.push(getLittleEndianInt(data, offset));
      offset += 4;
    }

    // Frame data starts after the offset table
    const frameDataStart = offset;

    // Load frames
    const frames: ShdFrame[] = [];

    // Shadow color: semi-transparent black (60% opacity)
    // uses Color.Black * 0.6f which results in (0, 0, 0, 153)
    const SHADOW_ALPHA = Math.round(255 * 0.6); // 153

    for (let j = 0; j < head.frameCounts; j++) {
      let dataStart = frameDataStart + dataOffsets[j];
      const dataLen = getLittleEndianInt(data, dataStart);
      dataStart += 4;
      const width = getLittleEndianInt(data, dataStart);
      dataStart += 4;
      const height = getLittleEndianInt(data, dataStart);
      dataStart += 4;
      dataStart += 8; // Skip 8 bytes

      if (width <= 0 || height <= 0 || width > 2048 || height > 2048) {
        logger.warn(`[SHD] Invalid frame dimensions: ${width}x${height}`);
        frames.push({
          width: 1,
          height: 1,
          data: new Uint8ClampedArray(4), // 1 transparent pixel
        });
        continue;
      }

      // RGBA pixel data
      const pixelData = new Uint8ClampedArray(width * height * 4);
      let dataIdx = 0;
      const dataEnd = frameDataStart + dataOffsets[j] + dataLen - 20;

      while (dataStart < dataEnd && dataIdx < width * height) {
        const byte = data[dataStart];

        if (byte > 0x80) {
          // Transparent pixels (same as MPC)
          const transparentCount = byte - 0x80;
          for (let ti = 0; ti < transparentCount && dataIdx < width * height; ti++) {
            const idx = dataIdx * 4;
            pixelData[idx] = 0; // R
            pixelData[idx + 1] = 0; // G
            pixelData[idx + 2] = 0; // B
            pixelData[idx + 3] = 0; // A (transparent)
            dataIdx++;
          }
          dataStart++;
        } else {
          // Shadow pixels - semi-transparent black
          // 原版: data[dataidx++] = Color.Black * 0.6f
          const colorCount = byte;
          dataStart++;
          for (let ci = 0; ci < colorCount && dataIdx < width * height; ci++) {
            const idx = dataIdx * 4;
            pixelData[idx] = 0; // R (black)
            pixelData[idx + 1] = 0; // G (black)
            pixelData[idx + 2] = 0; // B (black)
            pixelData[idx + 3] = SHADOW_ALPHA; // A (60% opacity)
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

      frames.push({ width, height, data: pixelData });
    }

    return { head, frames };
  } catch (error) {
    logger.error("[SHD] Error parsing file:", error);
    return null;
  }
}

/**
 * Load an SHD file from a URL
 * Uses resourceLoader for caching
 */
export async function loadShd(url: string): Promise<Shd | null> {
  return resourceLoader.loadParsedBinary<Shd>(url, parseShdBuffer, "shd");
}
