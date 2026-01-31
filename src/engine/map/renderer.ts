/** 地图渲染器 - Canvas 基于的 JxqyMap 渲染 */
import { logger } from "../core/logger";
import type { Camera, JxqyMapData, Mpc } from "../core/mapTypes";
import { loadMpc } from "../resource/mpc";
import { toPixelPosition, toTilePosition } from "./map";
import { ResourcePath } from "@/config/resourcePaths";

export interface MapRenderer {
  mapData: JxqyMapData;
  mpcs: (Mpc | null)[];
  mpcCanvases: (HTMLCanvasElement[][] | null)[];
  camera: Camera;
  isLoading: boolean;
  loadProgress: number;
  loadVersion: number;
  _cameraDebugLogged?: boolean;
}

export function createMapRenderer(): MapRenderer {
  return {
    mapData: null as unknown as JxqyMapData,
    mpcs: [],
    mpcCanvases: [],
    camera: { x: 0, y: 0, width: 800, height: 600 },
    isLoading: true,
    loadProgress: 0,
    loadVersion: 0,
  };
}

/** 预渲染 MPC 帧到 canvas */
function createMpcCanvases(mpc: Mpc): HTMLCanvasElement[] {
  return mpc.frames.map((frame) => {
    const canvas = document.createElement("canvas");
    canvas.width = frame.width;
    canvas.height = frame.height;
    const ctx = canvas.getContext("2d");
    if (ctx) ctx.putImageData(frame.imageData, 0, 0);
    return canvas;
  });
}

/** 加载地图的所有 MPC 文件 */
export async function loadMapMpcs(
  renderer: MapRenderer,
  mapData: JxqyMapData,
  mapNameWithoutExt: string,
  onProgress?: (progress: number) => void
): Promise<boolean> {
  renderer.loadVersion++;
  const currentLoadVersion = renderer.loadVersion;

  renderer.mapData = null as unknown as JxqyMapData;
  renderer.mpcs = [];
  renderer.mpcCanvases = [];
  renderer.isLoading = true;
  renderer.loadProgress = 0;

  // 确定 MPC 基础路径
  let mpcBasePath = mapData.mpcDirPath;
  if (!mpcBasePath || mpcBasePath.trim() === "") {
    mpcBasePath = `mpc/map/${mapNameWithoutExt}`;
  } else {
    mpcBasePath = mpcBasePath.replace(/\\/g, "/");
  }
  if (!mpcBasePath.startsWith("/")) {
    mpcBasePath = ResourcePath.from(mpcBasePath);
  }

  const totalMpcs = mapData.mpcFileNames.filter((n) => n !== null).length;
  let loadedCount = 0;

  // Temporary arrays to hold loaded data
  const tempMpcs: (Mpc | null)[] = [];
  const tempMpcCanvases: (HTMLCanvasElement[][] | null)[] = [];

  for (let i = 0; i < mapData.mpcFileNames.length; i++) {
    // Check if this load has been superseded
    if (renderer.loadVersion !== currentLoadVersion) {
      logger.log("Load cancelled due to newer load request");
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
      logger.warn(`Failed to load MPC: ${mpcUrl}`, error);
      tempMpcs.push(null);
      tempMpcCanvases.push(null);
    }

    loadedCount++;
    renderer.loadProgress = loadedCount / totalMpcs;
    onProgress?.(renderer.loadProgress);
  }

  // Final check before committing data
  if (renderer.loadVersion !== currentLoadVersion) {
    logger.log("Load cancelled due to newer load request");
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

/** 获取当前视图的瓦片范围 */
export function getViewTileRange(
  camera: Camera,
  mapData: JxqyMapData
): { startX: number; startY: number; endX: number; endY: number } {
  const start = toTilePosition(camera.x, camera.y);
  const end = toTilePosition(camera.x + camera.width, camera.y + camera.height);
  const padding = 20; // 视图外延伸的瓦片数

  return {
    startX: Math.max(0, start.x - padding),
    startY: Math.max(0, start.y - padding),
    endX: Math.min(mapData.mapColumnCounts, end.x + padding),
    endY: Math.min(mapData.mapRowCounts, end.y + padding),
  };
}

/** 绘制单个瓦片层 */
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
  if (!mpcCanvases?.[0]) return;

  const frameCanvas = mpcCanvases[0][tileData.frame];
  if (!frameCanvas || !renderer.mpcs[mpcIndex]) return;

  const pixelPos = toPixelPosition(col, row);
  const drawX = Math.floor(pixelPos.x - frameCanvas.width / 2 - renderer.camera.x);
  const drawY = Math.floor(pixelPos.y - (frameCanvas.height - 16) - renderer.camera.y);

  // 额外 0.5 像素避免浮点精度问题导致的缝隙
  ctx.drawImage(
    frameCanvas, 0, 0, frameCanvas.width, frameCanvas.height,
    drawX, drawY, frameCanvas.width + 0.5, frameCanvas.height + 0.5
  );
}

/** 渲染指定图层 */
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

/** 在指定位置绘制 layer2 瓦片（用于交错渲染） */
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

/** 获取瓦片纹理的世界坐标区域（用于碰撞检测） */
export function getTileTextureRegion(
  renderer: MapRenderer,
  col: number,
  row: number,
  layer: "layer1" | "layer2" | "layer3"
): { x: number; y: number; width: number; height: number } | null {
  const mapData = renderer.mapData;
  if (!mapData || renderer.isLoading) return null;

  const tileIndex = col + row * mapData.mapColumnCounts;
  if (tileIndex < 0 || tileIndex >= mapData[layer].length) return null;

  const tileData = mapData[layer][tileIndex];
  if (tileData.mpcIndex === 0) return null;

  const mpcCanvases = renderer.mpcCanvases[tileData.mpcIndex - 1];
  if (!mpcCanvases?.[0]) return null;

  const frameCanvas = mpcCanvases[0][tileData.frame];
  if (!frameCanvas) return null;

  const pixelPos = toPixelPosition(col, row);
  return {
    x: pixelPos.x - frameCanvas.width / 2,
    y: pixelPos.y - (frameCanvas.height - 16),
    width: frameCanvas.width,
    height: frameCanvas.height,
  };
}

/** 检查指定瓦片是否有纹理 */
export function hasTileTexture(
  renderer: MapRenderer,
  col: number,
  row: number,
  layer: "layer1" | "layer2" | "layer3"
): boolean {
  const mapData = renderer.mapData;
  if (!mapData || renderer.isLoading) return false;

  const tileIndex = col + row * mapData.mapColumnCounts;
  if (tileIndex < 0 || tileIndex >= mapData[layer].length) return false;

  return mapData[layer][tileIndex].mpcIndex !== 0;
}

/** 交错渲染地图（layer1 -> layer2+角色 -> layer3） */
export function renderMapInterleaved(
  ctx: CanvasRenderingContext2D,
  renderer: MapRenderer,
  drawCharactersAtRow?: (row: number, startCol: number, endCol: number) => void
): void {
  const { camera, mapData } = renderer;
  ctx.imageSmoothingEnabled = false;

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

  // 1. 绘制 layer1 (地面)
  for (let row = startY; row < endY; row++) {
    for (let col = startX; col < endX; col++) {
      drawTileLayer(ctx, renderer, "layer1", col, row);
    }
  }

  // 2. layer2 与角色交错渲染
  for (let row = startY; row < endY; row++) {
    for (let col = startX; col < endX; col++) {
      drawTileLayer(ctx, renderer, "layer2", col, row);
    }
    drawCharactersAtRow?.(row, startX, endX);
  }

  // 3. 绘制 layer3 (顶层物体)
  for (let row = startY; row < endY; row++) {
    for (let col = startX; col < endX; col++) {
      drawTileLayer(ctx, renderer, "layer3", col, row);
    }
  }
}

/** 渲染地图到画布（不含角色交错） */
export function renderMap(ctx: CanvasRenderingContext2D, renderer: MapRenderer): void {
  const { camera, mapData } = renderer;
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = "#1a1a2e";
  ctx.fillRect(0, 0, camera.width, camera.height);

  if (!mapData || renderer.isLoading) {
    ctx.fillStyle = "#ffffff";
    ctx.font = "24px Arial";
    ctx.textAlign = "center";
    ctx.fillText(`加载中... ${Math.round(renderer.loadProgress * 100)}%`, camera.width / 2, camera.height / 2);
    return;
  }

  const { startX, startY, endX, endY } = getViewTileRange(camera, mapData);

  // 按层次绘制: layer1 -> layer2 -> layer3
  for (const layer of ["layer1", "layer2", "layer3"] as const) {
    for (let row = startY; row < endY; row++) {
      for (let col = startX; col < endX; col++) {
        drawTileLayer(ctx, renderer, layer, col, row);
      }
    }
  }
}

/** 更新相机位置（带边界检查） */
export function updateCamera(renderer: MapRenderer, deltaX: number, deltaY: number): void {
  if (!renderer.mapData) return;

  const { camera, mapData } = renderer;
  let newX = Math.max(0, Math.min(camera.x + deltaX, mapData.mapPixelWidth - camera.width));
  let newY = Math.max(0, Math.min(camera.y + deltaY, mapData.mapPixelHeight - camera.height));

  camera.x = Math.floor(newX);
  camera.y = Math.floor(newY);
}

export function setCameraSize(renderer: MapRenderer, width: number, height: number): void {
  renderer.camera.width = width;
  renderer.camera.height = height;
}
