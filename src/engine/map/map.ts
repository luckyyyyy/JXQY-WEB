/**
 * JxqyMap parser - matches C# Engine/Map/JxqyMap.cs implementation
 */

import { getLittleEndianInt, getTextDecoder, readNullTerminatedString } from "../core/binaryUtils";
import { logger } from "../core/logger";
import type { JxqyMapData, MapMpcIndex, MapTileInfo } from "../core/mapTypes";
import { resourceLoader } from "../resource/resourceLoader";

/**
 * Parse a .map file buffer into JxqyMapData
 */
export async function parseMap(buffer: ArrayBuffer, mapPath?: string): Promise<JxqyMapData | null> {
  const data = new Uint8Array(buffer);

  // Check header - "MAP File Ver"
  const headerBytes = data.slice(0, 12);
  const header = String.fromCharCode(...headerBytes);
  if (header !== "MAP File Ver") {
    logger.error(`Invalid MAP file header: "${header}" (path: ${mapPath || "unknown"})`);
    return null;
  }

  let offset = 32;

  // Read MPC directory path
  let len = 0;
  while (data[offset + len] !== 0 && len < 32) len++;
  let mpcDirPath = "";
  if (len > 0) {
    // Skip first byte and read the path
    mpcDirPath = getTextDecoder().decode(data.slice(offset + 1, offset + len));
  }

  // Read map dimensions
  offset = 68;
  const mapColumnCounts = getLittleEndianInt(data, offset);
  offset += 4;
  const mapRowCounts = getLittleEndianInt(data, offset);
  offset += 4;

  const mapPixelWidth = (mapColumnCounts - 1) * 64;
  const mapPixelHeight = (Math.floor((mapRowCounts - 3) / 2) + 1) * 32;

  // Read MPC file list (255 entries, each 64 bytes, starting at offset 192)
  offset = 192;
  const mpcFileNames: (string | null)[] = [];
  const loopingMpcIndices: number[] = [];

  for (let k = 0; k < 255; k++) {
    const mpcFileName = readNullTerminatedString(data, offset, 32);
    if (mpcFileName.length === 0) {
      mpcFileNames.push(null);
    } else {
      mpcFileNames.push(mpcFileName);
      // Check if looping (byte at offset + 36)
      if (data[offset + 36] === 1) {
        loopingMpcIndices.push(k);
      }
    }
    offset += 64;
  }

  // Tile data starts at offset 16512
  offset = 16512;

  const totalTiles = mapColumnCounts * mapRowCounts;
  const layer1: MapMpcIndex[] = [];
  const layer2: MapMpcIndex[] = [];
  const layer3: MapMpcIndex[] = [];
  const tileInfos: MapTileInfo[] = [];

  for (let i = 0; i < totalTiles; i++) {
    layer1.push({
      frame: data[offset++],
      mpcIndex: data[offset++],
    });
    layer2.push({
      frame: data[offset++],
      mpcIndex: data[offset++],
    });
    layer3.push({
      frame: data[offset++],
      mpcIndex: data[offset++],
    });
    tileInfos.push({
      barrierType: data[offset++],
      trapIndex: data[offset++],
    });
    offset += 2; // Skip 2 bytes
  }

  return {
    mapColumnCounts,
    mapRowCounts,
    mapPixelWidth,
    mapPixelHeight,
    mpcDirPath,
    mpcFileNames,
    loopingMpcIndices,
    layer1,
    layer2,
    layer3,
    tileInfos,
  };
}

/**
 * Load a map file from URL
 * Uses unified resourceLoader for binary data fetching
 */
export async function loadMap(url: string): Promise<JxqyMapData | null> {
  try {
    logger.debug(`[Map] Fetching map from: ${url}`);
    const buffer = await resourceLoader.loadBinary(url);
    if (!buffer) {
      logger.error(`Failed to load map: ${url}`);
      return null;
    }
    return parseMap(buffer, url);
  } catch (error) {
    logger.error(`Error loading map ${url}:`, error);
    return null;
  }
}
