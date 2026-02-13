// Map tile types matching implementation
export interface MapMpcIndex {
  frame: number; // byte
  mpcIndex: number; // byte
}

export interface MapTileInfo {
  trapIndex: number; // byte
  barrierType: number; // byte
}

export interface MpcHead {
  framesDataLengthSum: number;
  globalWidth: number;
  globalHeight: number;
  frameCounts: number;
  direction: number;
  colourCounts: number;
  interval: number;
  bottom: number;
  left: number;
}

export interface MpcFrame {
  width: number;
  height: number;
  imageData: ImageData;
}

export interface Mpc {
  head: MpcHead;
  frames: MpcFrame[];
  palette: Uint8ClampedArray[]; // RGBA palette
}

// ============= MSF Entry (MMF format) =============

export interface MsfEntry {
  /** MSF file name (UTF-8, e.g. "map003-1-1.msf") */
  name: string;
  /** Whether animation loops */
  looping: boolean;
}

// ============= Trap Entry (MMF format) =============

export interface TrapEntry {
  /** Trap index (1-255, matches tile trapIndex) */
  trapIndex: number;
  /** Script path (UTF-8, e.g. "Trap01.txt") */
  scriptPath: string;
}

// ============= Map Data (MMF format) =============

/**
 * MiuMapData - MMF format parsed output
 *
 * Uses Uint8Array for tile data (zero-copy from zstd blob).
 * Tile access: offset = (col + row * columns) * 2; msfIdx = layer[offset]; frame = layer[offset+1];
 */
export interface MiuMapData {
  mapColumnCounts: number;
  mapRowCounts: number;
  mapPixelWidth: number;
  mapPixelHeight: number;
  /** MSF file list (compact, 0-based) */
  msfEntries: MsfEntry[];
  /** Trap definitions embedded in map file */
  trapTable: TrapEntry[];
  /** Layer 1 (ground): totalTiles × 2 bytes [msfIndex, frame] */
  layer1: Uint8Array;
  /** Layer 2 (decoration): totalTiles × 2 bytes [msfIndex, frame] */
  layer2: Uint8Array;
  /** Layer 3 (top/occlusion): totalTiles × 2 bytes [msfIndex, frame] */
  layer3: Uint8Array;
  /** Barrier types: totalTiles × 1 byte */
  barriers: Uint8Array;
  /** Trap indices: totalTiles × 1 byte */
  traps: Uint8Array;
}

// ============= Legacy MAP format types (for viewer / old parser) =============

/**
 * JxqyMapData - Legacy .map format parsed output
 *
 * Kept for backward compatibility with the viewer and old MAP parser.
 * Engine runtime uses MiuMapData (MMF format) instead.
 */
export interface JxqyMapData {
  mapColumnCounts: number;
  mapRowCounts: number;
  mapPixelWidth: number;
  mapPixelHeight: number;
  mpcDirPath: string;
  mpcFileNames: (string | null)[];
  loopingMpcIndices: number[];
  layer1: MapMpcIndex[];
  layer2: MapMpcIndex[];
  layer3: MapMpcIndex[];
  tileInfos: MapTileInfo[];
}

export interface Camera {
  x: number;
  y: number;
  width: number;
  height: number;
}

// Barrier types
export const BarrierType = {
  None: 0x00,
  Obstacle: 0x80,
  CanOverObstacle: 0xa0,
  Trans: 0x40,
  CanOverTrans: 0x60,
  CanOver: 0x20,
} as const;

// ============= Legacy → MiuMapData conversion =============

/**
 * Convert legacy JxqyMapData to MiuMapData for rendering compatibility.
 * Used by the viewer to render old .map files with the new renderer.
 */
export function jxqyToMiuMapData(old: JxqyMapData): MiuMapData {
  const totalTiles = old.mapColumnCounts * old.mapRowCounts;

  // Build compact msfEntries and old→new index remapping
  // Old format: mpcIndex is 1-based (0=empty), mpcFileNames is 0-based (255 slots)
  // New format: msfIndex is 1-based (0=empty), msfEntries is 0-based (compact)
  const oldSlotToNewMsf = new Map<number, number>();
  const msfEntries: MsfEntry[] = [];
  let newIdx = 1;
  for (let slot = 0; slot < old.mpcFileNames.length; slot++) {
    const name = old.mpcFileNames[slot];
    if (name !== null) {
      oldSlotToNewMsf.set(slot, newIdx);
      msfEntries.push({
        name,
        looping: old.loopingMpcIndices.includes(slot),
      });
      newIdx++;
    }
  }

  // Convert object arrays to Uint8Arrays with index remapping
  const layer1 = new Uint8Array(totalTiles * 2);
  const layer2 = new Uint8Array(totalTiles * 2);
  const layer3 = new Uint8Array(totalTiles * 2);
  const barriers = new Uint8Array(totalTiles);
  const traps = new Uint8Array(totalTiles);

  const remapMpcIndex = (mpcIndex: number): number => {
    if (mpcIndex === 0) return 0;
    // mpcIndex is 1-based → slot = mpcIndex - 1
    return oldSlotToNewMsf.get(mpcIndex - 1) ?? 0;
  };

  for (let i = 0; i < totalTiles; i++) {
    const offset = i * 2;
    layer1[offset] = remapMpcIndex(old.layer1[i].mpcIndex);
    layer1[offset + 1] = old.layer1[i].frame;
    layer2[offset] = remapMpcIndex(old.layer2[i].mpcIndex);
    layer2[offset + 1] = old.layer2[i].frame;
    layer3[offset] = remapMpcIndex(old.layer3[i].mpcIndex);
    layer3[offset + 1] = old.layer3[i].frame;
    barriers[i] = old.tileInfos[i].barrierType;
    traps[i] = old.tileInfos[i].trapIndex;
  }

  return {
    mapColumnCounts: old.mapColumnCounts,
    mapRowCounts: old.mapRowCounts,
    mapPixelWidth: old.mapPixelWidth,
    mapPixelHeight: old.mapPixelHeight,
    msfEntries,
    trapTable: [],
    layer1,
    layer2,
    layer3,
    barriers,
    traps,
  };
}
