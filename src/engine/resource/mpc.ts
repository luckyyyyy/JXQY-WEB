/**
 * MPC file parser - matches C# Engine/Mpc.cs implementation
 */
import type { Mpc, MpcHead, MpcFrame } from "../core/mapTypes";
import { getLittleEndianInt } from "../core/binaryUtils";
import { resourceLoader } from "./resourceLoader";

/**
 * Parse an MPC file buffer into an Mpc object
 */
export async function parseMpc(buffer: ArrayBuffer): Promise<Mpc | null> {
  const data = new Uint8Array(buffer);

  // Check header - "MPC File Ver" at offset 0
  const header = String.fromCharCode(...data.slice(0, 12));
  if (!header.startsWith("MPC File Ver") && !header.startsWith("SHD File Ver")) {
    console.error("Invalid MPC file header:", header);
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
  const frameOffsetsStart = offset;
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
      console.warn(`Invalid frame dimensions: ${width}x${height}`);
      frames.push({ width: 1, height: 1, imageData: new ImageData(1, 1) });
      continue;
    }

    const pixelData = new Uint8ClampedArray(width * height * 4);
    let dataIdx = 0;
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
  // parseMpc is async but synchronous in implementation
  // Use loadParsedBinary with a sync wrapper
  return resourceLoader.loadParsedBinary<Mpc>(url, (buffer) => {
    // Call parseMpc synchronously (it's async for historical reasons but doesn't use await internally)
    // We need to handle this differently since parseMpc is async
    // Instead, parse synchronously inline
    return parseMpcBuffer(buffer);
  }, "mpc");
}

/**
 * Sync version of MPC parsing for resourceLoader
 */
function parseMpcBuffer(buffer: ArrayBuffer): Mpc | null {
  try {
    const data = new Uint8Array(buffer);

    // Check header - "MPC File Ver" at offset 0
    const header = String.fromCharCode(...data.slice(0, 12));
    if (!header.startsWith("MPC File Ver") && !header.startsWith("SHD File Ver")) {
      console.error("Invalid MPC file header:", header);
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

      const pixelData = new Uint8ClampedArray(width * height * 4);
      let dataIdx = 0;
      const dataEnd = frameDataStart + dataOffsets[j] + dataLen;

      while (dataStart < dataEnd && dataIdx < width * height) {
        const byte = data[dataStart];
        if (byte > 0x80) {
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

      const imageData = new ImageData(pixelData, width, height);
      frames.push({ width, height, imageData });
    }

    return { head, frames, palette };
  } catch (error) {
    console.error("Error parsing MPC:", error);
    return null;
  }
}

/**
 * Clear the MPC cache (delegates to resourceLoader)
 */
export function clearMpcCache(): void {
  resourceLoader.clearCache("mpc");
}
