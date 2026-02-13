/** 地图渲染器 - Canvas 基于的 JxqyMap 渲染 */

import { ResourcePath } from "../resource/resource-paths";
import { logger } from "../core/logger";
import type { Camera, MiuMapData, Mpc } from "./types";
import { loadMpc } from "../resource/format/mpc";
import type { IRenderer } from "../renderer/i-renderer";
import { MapBase } from "./map-base";

/** 单个 MPC 图集：一张 atlas canvas + 每帧的源矩形 */
export interface MpcAtlas {
  canvas: HTMLCanvasElement;
  rects: { x: number; y: number; w: number; h: number }[];
}

export interface MapRenderer {
  mapData: MiuMapData | null;
  mpcs: (Mpc | null)[];
  /** MPC 图集（每个 MPC 文件一张 atlas） */
  mpcAtlases: (MpcAtlas | null)[];
  camera: Camera;
  isLoading: boolean;
  loadProgress: number;
  loadVersion: number;
  /** 已加载 MPC 中的最大瓦片高度（像素），用于计算视图 padding */
  maxTileHeight: number;
  /** 已加载 MPC 中的最大瓦片宽度（像素） */
  maxTileWidth: number;
  _cameraDebugLogged?: boolean;
}

export function createMapRenderer(): MapRenderer {
  return {
    mapData: null,
    mpcs: [],
    mpcAtlases: [],
    camera: { x: 0, y: 0, width: 800, height: 600 },
    isLoading: true,
    loadProgress: 0,
    loadVersion: 0,
    maxTileHeight: 0,
    maxTileWidth: 0,
  };
}

// ============= MPC Atlas 缓存 =============

/** MPC atlas 缓存：按 URL 缓存构建好的 atlas canvas，切换地图时复用 */
const mpcAtlasCache = new Map<string, MpcAtlas>();

/** 清除 MPC atlas 缓存（在 clearMpcCache 时一并调用） */
export function clearMpcAtlasCache(): void {
  mpcAtlasCache.clear();
}

/** 获取或创建 MPC atlas（优先从缓存读取） */
function getOrCreateMpcAtlas(url: string, mpc: Mpc): MpcAtlas {
  const cached = mpcAtlasCache.get(url);
  if (cached) return cached;
  const atlas = createMpcAtlas(mpc);
  mpcAtlasCache.set(url, atlas);
  return atlas;
}

/** 将 MPC 所有帧打包到一张 atlas canvas 中，减少纹理切换 */
function createMpcAtlas(mpc: Mpc): MpcAtlas {
  const frames = mpc.frames;
  if (frames.length === 0) {
    const c = document.createElement("canvas");
    c.width = 1;
    c.height = 1;
    return { canvas: c, rects: [] };
  }

  // 使用行式排列：所有帧横向排列
  // 如果帧数较多则换行（每行最多 8 帧，避免 atlas 过宽）
  const maxCols = Math.min(frames.length, 8);
  const rows = Math.ceil(frames.length / maxCols);

  // 计算每行的最大尺寸（帧可能大小不一）
  let maxFrameWidth = 0;
  let maxFrameHeight = 0;
  for (const frame of frames) {
    if (frame.width > maxFrameWidth) maxFrameWidth = frame.width;
    if (frame.height > maxFrameHeight) maxFrameHeight = frame.height;
  }

  const atlasWidth = maxCols * maxFrameWidth;
  const atlasHeight = rows * maxFrameHeight;

  const canvas = document.createElement("canvas");
  canvas.width = atlasWidth;
  canvas.height = atlasHeight;
  const ctx = canvas.getContext("2d");

  const rects: { x: number; y: number; w: number; h: number }[] = [];

  if (ctx) {
    for (let i = 0; i < frames.length; i++) {
      const col = i % maxCols;
      const row = Math.floor(i / maxCols);
      const x = col * maxFrameWidth;
      const y = row * maxFrameHeight;
      ctx.putImageData(frames[i].imageData, x, y);
      rects.push({ x, y, w: frames[i].width, h: frames[i].height });
    }
  }

  return { canvas, rects };
}

/**
 * 释放地图渲染器当前持有的所有 MPC 纹理资源
 *
 * 在切换地图前调用：遍历当前 mpcAtlases，
 * 通过 IRenderer.releaseSourceTexture 释放对应的 GPU 纹理，
 * 避免切换地图后旧纹理在 WebGLRenderer.textures Map 中泄漏。
 * 注意：atlas canvas 本身保留在 mpcAtlasCache 中，下次加载同一地图时复用。
 */
export function releaseMapTextures(mapRenderer: MapRenderer, renderer: IRenderer): void {
  for (const atlas of mapRenderer.mpcAtlases) {
    if (atlas) {
      renderer.releaseSourceTexture(atlas.canvas);
    }
  }
}

/** 加载地图的所有 MSF/MPC 文件 */
export async function loadMapMpcs(
  renderer: MapRenderer,
  mapData: MiuMapData,
  mapNameWithoutExt: string,
  onProgress?: (progress: number) => void,
  /** 可选的资源根目录，用于编辑器等场景覆盖默认路径 */
  resourceRoot?: string
): Promise<boolean> {
  renderer.loadVersion++;
  const currentLoadVersion = renderer.loadVersion;

  // 重置状态（旧纹理已在外部通过 releaseMapTextures 释放）
  renderer.mapData = null;
  renderer.mpcs = [];
  renderer.mpcAtlases = [];
  renderer.isLoading = true;
  renderer.loadProgress = 0;
  renderer.maxTileHeight = 0;
  renderer.maxTileWidth = 0;

  // MSF/MPC 基础路径: msf/map/{mapName}/
  let msfBasePath = `msf/map/${mapNameWithoutExt}`;
  if (resourceRoot) {
    msfBasePath = `${resourceRoot}/${msfBasePath}`;
  } else {
    msfBasePath = ResourcePath.from(msfBasePath);
  }

  // 收集需要加载的 MSF 任务
  interface MsfLoadTask {
    slotIndex: number;
    url: string;
  }
  const tasks: MsfLoadTask[] = [];
  const totalSlots = mapData.msfEntries.length;

  // 预填充 null 占位
  const resultMpcs: (Mpc | null)[] = new Array<Mpc | null>(totalSlots).fill(null);
  const resultAtlases: (MpcAtlas | null)[] = new Array<MpcAtlas | null>(totalSlots).fill(null);

  for (let i = 0; i < totalSlots; i++) {
    const entry = mapData.msfEntries[i];
    tasks.push({ slotIndex: i, url: `${msfBasePath}/${entry.name}` });
  }

  const totalMpcs = tasks.length;
  let loadedCount = 0;

  // 并行加载所有 MSF 文件（resourceLoader 内部有请求去重和缓存）
  await Promise.all(
    tasks.map(async (task) => {
      try {
        const mpc = await loadMpc(task.url);
        if (mpc) {
          resultMpcs[task.slotIndex] = mpc;
          resultAtlases[task.slotIndex] = getOrCreateMpcAtlas(task.url, mpc);
        }
      } catch (error) {
        logger.warn(`Failed to load MSF: ${task.url}`, error);
      }
      loadedCount++;
      renderer.loadProgress = totalMpcs > 0 ? loadedCount / totalMpcs : 1;
      onProgress?.(renderer.loadProgress);
    })
  );

  // 加载完成后检查是否已被新请求取消
  if (renderer.loadVersion !== currentLoadVersion) {
    logger.log("Load cancelled due to newer load request");
    return false;
  }

  // 计算最大瓦片尺寸（从 atlas rects 获取）
  let maxTileHeight = 0;
  let maxTileWidth = 0;
  for (const atlas of resultAtlases) {
    if (!atlas) continue;
    for (const rect of atlas.rects) {
      if (rect.h > maxTileHeight) maxTileHeight = rect.h;
      if (rect.w > maxTileWidth) maxTileWidth = rect.w;
    }
  }

  // 原子性提交所有数据
  renderer.mapData = mapData;
  renderer.mpcs = resultMpcs;
  renderer.mpcAtlases = resultAtlases;
  renderer.maxTileHeight = maxTileHeight;
  renderer.maxTileWidth = maxTileWidth;
  renderer.isLoading = false;
  renderer.loadProgress = 1;

  return true;
}

/** 获取当前视图的瓦片范围（动态 padding，基于实际瓦片尺寸） */
export function getViewTileRange(
  camera: Camera,
  mapData: MiuMapData,
  maxTileHeight = 320,
  maxTileWidth = 320
): { startX: number; startY: number; endX: number; endY: number } {
  const start = MapBase.toTilePosition(camera.x, camera.y);
  const end = MapBase.toTilePosition(camera.x + camera.width, camera.y + camera.height);

  // 瓦片从锚点向上延伸 (height - 16) 像素，行间距 16px
  // 所以视图下方需要更多 padding 才能看到向上延伸的高大瓦片
  const paddingBottom = Math.ceil((maxTileHeight - 16) / 16) + 2;
  const paddingTop = 3;
  // 瓦片从中心向左右延伸 width/2 像素，列间距 64px
  const paddingX = Math.ceil(maxTileWidth / 2 / 64) + 2;

  return {
    startX: Math.max(0, start.x - paddingX),
    startY: Math.max(0, start.y - paddingTop),
    endX: Math.min(mapData.mapColumnCounts, end.x + paddingX),
    endY: Math.min(mapData.mapRowCounts, end.y + paddingBottom),
  };
}

/** 绘制单个瓦片层 */
function drawTileLayer(
  renderer: IRenderer,
  mapRenderer: MapRenderer,
  layer: "layer1" | "layer2" | "layer3",
  col: number,
  row: number
): void {
  const mapData = mapRenderer.mapData;
  if (!mapData) return;
  const tileIndex = col + row * mapData.mapColumnCounts;
  const byteOffset = tileIndex * 2;
  const layerData = mapData[layer];

  if (byteOffset < 0 || byteOffset + 1 >= layerData.length) return;

  const msfIdx = layerData[byteOffset];
  const frame = layerData[byteOffset + 1];
  if (msfIdx === 0) return;

  // msfIdx is 1-based in tile data, maps to 0-based mpcAtlases index
  const atlasIndex = msfIdx - 1;

  const atlas = mapRenderer.mpcAtlases[atlasIndex];
  if (!atlas || frame >= atlas.rects.length) return;

  const rect = atlas.rects[frame];
  const pixelPos = MapBase.toPixelPosition(col, row);
  const drawX = Math.floor(pixelPos.x - rect.w / 2 - mapRenderer.camera.x);
  const drawY = Math.floor(pixelPos.y - (rect.h - 16) - mapRenderer.camera.y);

  renderer.drawSourceEx(
    atlas.canvas,
    drawX,
    drawY,
    {
      srcX: rect.x,
      srcY: rect.y,
      srcWidth: rect.w,
      srcHeight: rect.h,
      dstWidth: rect.w + 1,
      dstHeight: rect.h + 1,
    }
  );
}

/** 渲染指定图层 */
export function renderLayer(
  renderer: IRenderer,
  mapRenderer: MapRenderer,
  layer: "layer1" | "layer2" | "layer3"
): void {
  const { camera, mapData } = mapRenderer;
  if (!mapData || mapRenderer.isLoading) return;

  const { startX, startY, endX, endY } = getViewTileRange(
    camera, mapData, mapRenderer.maxTileHeight, mapRenderer.maxTileWidth
  );

  for (let row = startY; row < endY; row++) {
    for (let col = startX; col < endX; col++) {
      drawTileLayer(renderer, mapRenderer, layer, col, row);
    }
  }
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
  const byteOffset = tileIndex * 2;
  const layerData = mapData[layer];
  if (byteOffset < 0 || byteOffset + 1 >= layerData.length) return null;

  const msfIdx = layerData[byteOffset];
  const frame = layerData[byteOffset + 1];
  if (msfIdx === 0) return null;

  const atlas = renderer.mpcAtlases[msfIdx - 1];
  if (!atlas || frame >= atlas.rects.length) return null;

  const rect = atlas.rects[frame];
  const pixelPos = MapBase.toPixelPosition(col, row);
  return {
    x: pixelPos.x - rect.w / 2,
    y: pixelPos.y - (rect.h - 16),
    width: rect.w,
    height: rect.h,
  };
}

/** 交错渲染选项 */
export interface RenderMapInterleavedOptions {
  /** 是否渲染 layer1（地面层），默认 true */
  showLayer1?: boolean;
  /** 是否渲染 layer2（物体层），默认 true */
  showLayer2?: boolean;
  /** 是否渲染 layer3（顶层），默认 true */
  showLayer3?: boolean;
}

/** 交错渲染地图（layer1 -> layer2+角色 -> layer3） */
export function renderMapInterleaved(
  renderer: IRenderer,
  mapRenderer: MapRenderer,
  drawCharactersAtRow?: (row: number, startCol: number, endCol: number) => void,
  options?: RenderMapInterleavedOptions
): void {
  const { camera, mapData } = mapRenderer;

  if (!mapData || mapRenderer.isLoading) {
    const ctx = renderer.getContext2D();
    if (ctx) {
      ctx.fillStyle = "#ffffff";
      ctx.font = "24px Arial";
      ctx.textAlign = "center";
      ctx.fillText(
        `加载中... ${Math.round(mapRenderer.loadProgress * 100)}%`,
        camera.width / 2,
        camera.height / 2
      );
    }
    return;
  }

  const { startX, startY, endX, endY } = getViewTileRange(
    camera, mapData, mapRenderer.maxTileHeight, mapRenderer.maxTileWidth
  );

  const layer1 = options?.showLayer1 !== false;
  const layer2 = options?.showLayer2 !== false;
  const layer3 = options?.showLayer3 !== false;

  // 1. 绘制 layer1 (地面)
  if (layer1) {
    for (let row = startY; row < endY; row++) {
      for (let col = startX; col < endX; col++) {
        drawTileLayer(renderer, mapRenderer, "layer1", col, row);
      }
    }
  }

  // 2. layer2 与角色交错渲染
  for (let row = startY; row < endY; row++) {
    if (layer2) {
      for (let col = startX; col < endX; col++) {
        drawTileLayer(renderer, mapRenderer, "layer2", col, row);
      }
    }
    drawCharactersAtRow?.(row, startX, endX);
  }

  // 3. 绘制 layer3 (顶层物体)
  if (layer3) {
    for (let row = startY; row < endY; row++) {
      for (let col = startX; col < endX; col++) {
        drawTileLayer(renderer, mapRenderer, "layer3", col, row);
      }
    }
  }
}

/** 渲染地图到画布（不含角色交错） */
export function renderMap(renderer: IRenderer, mapRenderer: MapRenderer): void {
  const { camera, mapData } = mapRenderer;
  renderer.fillRect({
    x: 0,
    y: 0,
    width: camera.width,
    height: camera.height,
    color: "#1a1a2e",
  });

  if (!mapData || mapRenderer.isLoading) {
    const ctx = renderer.getContext2D();
    if (ctx) {
      ctx.fillStyle = "#ffffff";
      ctx.font = "24px Arial";
      ctx.textAlign = "center";
      ctx.fillText(
        `加载中... ${Math.round(mapRenderer.loadProgress * 100)}%`,
        camera.width / 2,
        camera.height / 2
      );
    }
    return;
  }

  const { startX, startY, endX, endY } = getViewTileRange(
    camera, mapData, mapRenderer.maxTileHeight, mapRenderer.maxTileWidth
  );

  // 按层次绘制: layer1 -> layer2 -> layer3
  for (const layer of ["layer1", "layer2", "layer3"] as const) {
    for (let row = startY; row < endY; row++) {
      for (let col = startX; col < endX; col++) {
        drawTileLayer(renderer, mapRenderer, layer, col, row);
      }
    }
  }
}

/** 更新相机位置（带边界检查） */
export function updateCamera(renderer: MapRenderer, deltaX: number, deltaY: number): void {
  if (!renderer.mapData) return;

  const { camera, mapData } = renderer;
  const newX = Math.max(0, Math.min(camera.x + deltaX, mapData.mapPixelWidth - camera.width));
  const newY = Math.max(0, Math.min(camera.y + deltaY, mapData.mapPixelHeight - camera.height));

  camera.x = Math.round(newX);
  camera.y = Math.round(newY);
}

export function setCameraSize(renderer: MapRenderer, width: number, height: number): void {
  renderer.camera.width = width;
  renderer.camera.height = height;
}
