// Map tile types matching C# implementation
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
  globleWidth: number;
  globleHeight: number;
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

// Barrier types from C# implementation
export const BarrierType = {
  None: 0x00,
  Obstacle: 0x80,
  CanOverObstacle: 0xa0,
  Trans: 0x40,
  CanOverTrans: 0x60,
  CanOver: 0x20,
} as const;
