/**
 * Map Renderer - Canvas-based rendering for JxqyMap
 * Handles loading MPC textures and drawing tiles
 */
import type { JxqyMapData, Camera, Mpc } from "../core/mapTypes";
import { loadMpc } from "../resource/mpc";
import { toPixelPosition, toTilePosition } from "./map";

export interface MapRenderer {
  mapData: JxqyMapData;
  mpcs: (Mpc | null)[];
  mpcCanvases: (HTMLCanvasElement[][] | null)[]; // Pre-rendered MPC frames
  camera: Camera;
  isLoading: boolean;
  loadProgress: number;
  loadVersion: number; // Used to cancel stale loads
  _cameraDebugLogged?: boolean; // Debug flag
}

/**
 * Create a new map renderer
 */
export function createMapRenderer(): MapRenderer {
  return {
    mapData: null as unknown as JxqyMapData,
    mpcs: [],
    mpcCanvases: [],
    camera: { x: 0, y: 0, width: 800, height: 600 },
    isLoading: true, // Start as loading to prevent rendering before first load
    loadProgress: 0,
    loadVersion: 0,
  };
}

/**
 * Pre-render MPC frames to canvas elements for faster drawing
 */
function createMpcCanvases(mpc: Mpc): HTMLCanvasElement[] {
  const canvases: HTMLCanvasElement[] = [];
  for (const frame of mpc.frames) {
    const canvas = document.createElement("canvas");
    canvas.width = frame.width;
    canvas.height = frame.height;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.putImageData(frame.imageData, 0, 0);
    }
    canvases.push(canvas);
  }
  return canvases;
}

/**
 * Load all MPC files for a map
 */
export async function loadMapMpcs(
  renderer: MapRenderer,
  mapData: JxqyMapData,
  mapNameWithoutExt: string,
  onProgress?: (progress: number) => void
): Promise<boolean> {
  // Increment load version to cancel any previous load
  renderer.loadVersion++;
  const currentLoadVersion = renderer.loadVersion;

  // Clear current data immediately and set loading state
  renderer.mapData = null as unknown as JxqyMapData;
  renderer.mpcs = [];
  renderer.mpcCanvases = [];
  renderer.isLoading = true;
  renderer.loadProgress = 0;

  // NOTE: 不要调用 clearMpcCache()！
  // resourceLoader 的缓存是全局的，MPC 等资源应该在游戏运行期间保持缓存
  // 之前每次换地图都清除缓存导致所有 ASF/MPC/脚本等资源被重复加载

  // Determine the base MPC path
  let mpcBasePath = mapData.mpcDirPath;
  if (!mpcBasePath || mpcBasePath.trim() === "") {
    mpcBasePath = `mpc/map/${mapNameWithoutExt}`;
  } else {
    // Convert Windows path to URL path
    mpcBasePath = mpcBasePath.replace(/\\/g, "/");
  }

  // Ensure path starts with /resources/
  if (!mpcBasePath.startsWith("/")) {
    mpcBasePath = `/resources/${mpcBasePath}`;
  }

  const totalMpcs = mapData.mpcFileNames.filter((n) => n !== null).length;
  let loadedCount = 0;

  // Temporary arrays to hold loaded data
  const tempMpcs: (Mpc | null)[] = [];
  const tempMpcCanvases: (HTMLCanvasElement[][] | null)[] = [];

  for (let i = 0; i < mapData.mpcFileNames.length; i++) {
    // Check if this load has been superseded
    if (renderer.loadVersion !== currentLoadVersion) {
      console.log("Load cancelled due to newer load request");
      return false;
    }

    const mpcFileName = mapData.mpcFileNames[i];
    if (mpcFileName === null) {
      tempMpcs.push(null);
      tempMpcCanvases.push(null);
      continue;
    }

    const mpcUrl = `${mpcBasePath}/${mpcFileName}`;
    try {
      const mpc = await loadMpc(mpcUrl);
      tempMpcs.push(mpc);
      if (mpc) {
        tempMpcCanvases.push([createMpcCanvases(mpc)]);
      } else {
        tempMpcCanvases.push(null);
      }
    } catch (error) {
      console.warn(`Failed to load MPC: ${mpcUrl}`, error);
      tempMpcs.push(null);
      tempMpcCanvases.push(null);
    }

    loadedCount++;
    renderer.loadProgress = loadedCount / totalMpcs;
    onProgress?.(renderer.loadProgress);
  }

  // Final check before committing data
  if (renderer.loadVersion !== currentLoadVersion) {
    console.log("Load cancelled due to newer load request");
    return false;
  }

  // Commit all data atomically
  renderer.mapData = mapData;
  renderer.mpcs = tempMpcs;
  renderer.mpcCanvases = tempMpcCanvases;
  renderer.isLoading = false;
  renderer.loadProgress = 1;

  return true;
}

/**
 * Get start and end tile indices for the current view
 */
export function getViewTileRange(
  camera: Camera,
  mapData: JxqyMapData
): { startX: number; startY: number; endX: number; endY: number } {
  const start = toTilePosition(camera.x, camera.y);
  const end = toTilePosition(camera.x + camera.width, camera.y + camera.height);

  // Add padding for tiles that may extend into view
  const padding = 20;

  return {
    startX: Math.max(0, start.x - padding),
    startY: Math.max(0, start.y - padding),
    endX: Math.min(mapData.mapColumnCounts, end.x + padding),
    endY: Math.min(mapData.mapRowCounts, end.y + padding),
  };
}

/**
 * Draw a single tile layer
 */
function drawTileLayer(
  ctx: CanvasRenderingContext2D,
  renderer: MapRenderer,
  layer: "layer1" | "layer2" | "layer3",
  col: number,
  row: number
): void {
  const mapData = renderer.mapData;
  const tileIndex = col + row * mapData.mapColumnCounts;

  if (tileIndex < 0 || tileIndex >= mapData[layer].length) return;

  const tileData = mapData[layer][tileIndex];
  if (tileData.mpcIndex === 0) return;

  const mpcIndex = tileData.mpcIndex - 1;
  const mpcCanvases = renderer.mpcCanvases[mpcIndex];
  if (!mpcCanvases || !mpcCanvases[0]) return;

  const frameIndex = tileData.frame;
  const frameCanvas = mpcCanvases[0][frameIndex];
  if (!frameCanvas) return;

  const mpc = renderer.mpcs[mpcIndex];
  if (!mpc) return;

  // Calculate pixel position
  const pixelPos = toPixelPosition(col, row);

  // Adjust position based on texture size (center and bottom alignment)
  // Use Math.floor to ensure integer coordinates and avoid sub-pixel rendering gaps
  const drawX = Math.floor(pixelPos.x - frameCanvas.width / 2 - renderer.camera.x);
  const drawY = Math.floor(pixelPos.y - (frameCanvas.height - 16) - renderer.camera.y);

  // Draw with slight overlap to eliminate gaps between tiles
  // The extra 0.5 pixels help prevent seams caused by floating point precision issues
  ctx.drawImage(
    frameCanvas,
    0, 0,
    frameCanvas.width, frameCanvas.height,
    drawX, drawY,
    frameCanvas.width + 0.5, frameCanvas.height + 0.5
  );
}

/**
 * Draw a specific layer for the entire visible area
 */
export function renderLayer(
  ctx: CanvasRenderingContext2D,
  renderer: MapRenderer,
  layer: "layer1" | "layer2" | "layer3"
): void {
  const { camera, mapData } = renderer;
  if (!mapData || renderer.isLoading) return;

  ctx.imageSmoothingEnabled = false;
  const { startX, startY, endX, endY } = getViewTileRange(camera, mapData);

  for (let row = startY; row < endY; row++) {
    for (let col = startX; col < endX; col++) {
      drawTileLayer(ctx, renderer, layer, col, row);
    }
  }
}

/**
 * Draw layer 1 tile at a specific position (for interleaved rendering)
 */
export function drawLayer1TileAt(
  ctx: CanvasRenderingContext2D,
  renderer: MapRenderer,
  col: number,
  row: number
): void {
  if (!renderer.mapData || renderer.isLoading) return;
  ctx.imageSmoothingEnabled = false;
  drawTileLayer(ctx, renderer, "layer2", col, row);
}

/**
 * Render map with interleaved character drawing (C# style)
 * This method draws layer1 (ground), then interleaves layer2 tiles with characters row-by-row,
 * then draws layer3 on top.
 *
 * @param drawCharactersAtRow - Callback to draw characters at a specific row
 */
export function renderMapInterleaved(
  ctx: CanvasRenderingContext2D,
  renderer: MapRenderer,
  drawCharactersAtRow?: (row: number, startCol: number, endCol: number) => void
): void {
  const { camera, mapData } = renderer;

  ctx.imageSmoothingEnabled = false;

  // Don't render if no map data or still loading
  if (!mapData || renderer.isLoading) {
    ctx.fillStyle = "#ffffff";
    ctx.font = "24px Arial";
    ctx.textAlign = "center";
    ctx.fillText(
      `加载中... ${Math.round(renderer.loadProgress * 100)}%`,
      camera.width / 2,
      camera.height / 2
    );
    return;
  }

  const { startX, startY, endX, endY } = getViewTileRange(camera, mapData);

  // 1. Draw layer1 (ground) - entire visible area
  for (let row = startY; row < endY; row++) {
    for (let col = startX; col < endX; col++) {
      drawTileLayer(ctx, renderer, "layer1", col, row);
    }
  }

  // 2. Interleave layer2 with characters (row by row)
  for (let row = startY; row < endY; row++) {
    // Draw layer2 tiles for this row
    for (let col = startX; col < endX; col++) {
      drawTileLayer(ctx, renderer, "layer2", col, row);
    }

    // Draw characters at this row
    if (drawCharactersAtRow) {
      drawCharactersAtRow(row, startX, endX);
    }
  }

  // 3. Draw layer3 (top objects) - entire visible area
  for (let row = startY; row < endY; row++) {
    for (let col = startX; col < endX; col++) {
      drawTileLayer(ctx, renderer, "layer3", col, row);
    }
  }
}

/**
 * Render the map to a canvas
 */
export function renderMap(
  ctx: CanvasRenderingContext2D,
  renderer: MapRenderer
): void {
  const { camera, mapData } = renderer;

  // Disable image smoothing to prevent anti-aliasing artifacts and gaps between tiles
  ctx.imageSmoothingEnabled = false;

  // Clear canvas
  ctx.fillStyle = "#1a1a2e";
  ctx.fillRect(0, 0, camera.width, camera.height);

  // Don't render if no map data or still loading
  if (!mapData || renderer.isLoading) {
    // Draw loading indicator
    ctx.fillStyle = "#ffffff";
    ctx.font = "24px Arial";
    ctx.textAlign = "center";
    ctx.fillText(
      `加载中... ${Math.round(renderer.loadProgress * 100)}%`,
      camera.width / 2,
      camera.height / 2
    );
    return;
  }

  // Get visible tile range
  const { startX, startY, endX, endY } = getViewTileRange(camera, mapData);

  // Draw tiles in order: layer1 (ground), layer2, layer3 (top objects)
  // Draw from back to front for proper depth
  for (let row = startY; row < endY; row++) {
    for (let col = startX; col < endX; col++) {
      drawTileLayer(ctx, renderer, "layer1", col, row);
    }
  }

  for (let row = startY; row < endY; row++) {
    for (let col = startX; col < endX; col++) {
      drawTileLayer(ctx, renderer, "layer2", col, row);
    }
  }

  for (let row = startY; row < endY; row++) {
    for (let col = startX; col < endX; col++) {
      drawTileLayer(ctx, renderer, "layer3", col, row);
    }
  }
}

/**
 * Update camera position with bounds checking
 */
export function updateCamera(
  renderer: MapRenderer,
  deltaX: number,
  deltaY: number
): void {
  if (!renderer.mapData) return;

  const { camera, mapData } = renderer;

  let newX = camera.x + deltaX;
  let newY = camera.y + deltaY;

  // Clamp to map bounds
  if (newX < 0) newX = 0;
  if (newY < 0) newY = 0;
  if (newX + camera.width > mapData.mapPixelWidth) {
    newX = Math.max(0, mapData.mapPixelWidth - camera.width);
  }
  if (newY + camera.height > mapData.mapPixelHeight) {
    newY = Math.max(0, mapData.mapPixelHeight - camera.height);
  }

  // Use Math.floor to ensure camera position is always at integer pixels
  // This prevents sub-pixel rendering which can cause tile gaps
  camera.x = Math.floor(newX);
  camera.y = Math.floor(newY);
}

/**
 * Set camera size
 */
export function setCameraSize(
  renderer: MapRenderer,
  width: number,
  height: number
): void {
  renderer.camera.width = width;
  renderer.camera.height = height;
}
