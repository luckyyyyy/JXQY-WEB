/**
 * 地图预览组件
 *
 * 完全复用 engine 的渲染逻辑，使用 WebGL (IRenderer) 渲染所有内容。
 *
 * 架构: 单 canvas
 * - WebGL canvas: 逻辑分辨率 = containerSize/zoom，渲染地图瓦片 + NPC/OBJ 精灵
 *   + 网格/障碍/陷阱/标签/选中框（通过预渲染 offscreen canvas + drawSource）
 * - IRenderer 懒初始化：首次 drawMap 时创建，避免 canvas 未挂载的竞态
 */

import { type JxqyMapData, jxqyToMiuMapData, type MiuMapData } from "@miu2d/engine/map/types";
import {
  createMapRenderer,
  getViewTileRange,
  loadMapMpcs,
  MapBase,
  type MapRenderer,
  renderMapInterleaved,
  setCameraSize,
  updateCamera,
} from "@miu2d/engine/map";
import type { AsfData } from "@miu2d/engine/resource/format/asf";
import { getFrameAtlasInfo, getFrameCanvas, getFrameIndex } from "@miu2d/engine/resource/format/asf";
import { getOuterEdge } from "@miu2d/engine/sprite/edge-detection";
import { createRenderer, type IRenderer, type RendererBackend } from "@miu2d/engine/renderer";
import {
  forwardRef,
  memo,
  type ReactNode,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";

/** WebGL 渲染画布最大单边尺寸（避免 GPU 显存溢出） */
const MAX_RENDER_DIM = 4096;

/** 超过此可见瓦片数量时跳过网格/hover 叠加层，防止低缩放率卡死 */
const MAX_OVERLAY_TILES = 10000;
/** 障碍/陷阱上限更高 — 它们是稀疏的，迭代成本>绘制成本 */
const MAX_OVERLAY_TILES_SPARSE = 50000;
/** 低于此缩放率时跳过陷阱序号文字（太小看不清） */
const TRAP_LABEL_MIN_ZOOM = 0.25;

/**
 * 计算逻辑画布尺寸和世界可视尺寸。
 * - logicalW/H: 画布缓冲区尺寸（受 MAX_RENDER_DIM 限制，避免 GPU 溢出）
 * - worldW/H: 世界可视区域尺寸（不受限制，大地图低缩放时 > logicalW/H）
 *
 * 当 worldW/H > logicalW/H 时，需要通过 IRenderer.applyWorldScale 将世界坐标
 * 缩放到画布坐标，避免低缩放率时缩放完全失效。
 */
function computeLogicalSize(
  containerW: number,
  containerH: number,
  zoom: number
): { logicalW: number; logicalH: number; worldW: number; worldH: number } {
  const worldW = Math.ceil(containerW / zoom);
  const worldH = Math.ceil(containerH / zoom);
  const maxDim = Math.max(worldW, worldH);
  if (maxDim > MAX_RENDER_DIM) {
    const scale = MAX_RENDER_DIM / maxDim;
    return {
      logicalW: Math.ceil(worldW * scale),
      logicalH: Math.ceil(worldH * scale),
      worldW,
      worldH,
    };
  }
  return { logicalW: worldW, logicalH: worldH, worldW, worldH };
}

/** 地图标记（NPC/OBJ 等） */
export interface MapMarker {
  /** 瓦片 X */
  mapX: number;
  /** 瓦片 Y */
  mapY: number;
  /** 显示标签 */
  label: string;
  /** 标记颜色 */
  color: string;
  /** 是否选中高亮 */
  selected?: boolean;
  /** 选中时的描边颜色（默认黄色） */
  selectedColor?: string;
  /** 朝向方向（默认 0） */
  direction?: number;
  /** 精灵动画帧（用于渲染真实外观） */
  sprite?: {
    /** 所有帧的画布（循环播放，作为回退） */
    frames: HTMLCanvasElement[];
    /** 帧间隔（毫秒） */
    interval: number;
    /** 绘制偏移 X（相对于瓦片像素中心），来自 ASF left */
    offsetX: number;
    /** 绘制偏移 Y（相对于瓦片像素中心），来自 ASF bottom */
    offsetY: number;
    /** ASF 数据（用于 WebGL atlas 渲染） */
    asf?: AsfData;
    /** 是否为 OBJ（OBJ 使用 per-frame canvas 渲染，自带 offX/offY） */
    isObj?: boolean;
    /** OBJ 额外偏移 X */
    objOffX?: number;
    /** OBJ 额外偏移 Y */
    objOffY?: number;
    /** 行走状态 ASF 数据（NPC 专用，模拟行走动画） */
    walkAsf?: AsfData;
  };
}

/** 右侧面板的额外 Tab（由父组件注入） */
export interface SidePanelTab {
  /** Tab 唯一标识 */
  id: string;
  /** Tab 显示标签 */
  label: string;
  /** Tab 内容（ReactNode） */
  content: ReactNode;
}

interface MapViewerProps {
  /** 地图数据（旧 .map 格式） */
  mapData?: JxqyMapData | null;
  /** 地图数据（新 .mmf 格式，优先使用） */
  mmfData?: MiuMapData | null;
  /** 地图文件名（不含扩展名，用于加载 MPC/MSF） */
  mapName: string | null;
  /** 文件名（显示用） */
  fileName?: string;
  /** 是否正在加载 */
  isLoading?: boolean;
  /** 错误信息 */
  error?: string | null;
  /** 文件句柄（用于读取 MPC 文件） */
  rootHandle?: FileSystemDirectoryHandle | null;
  /** 读取文件函数 */
  readFile?: (path: string) => Promise<ArrayBuffer | null>;
  /** 资源根目录（用于编辑器等场景覆盖默认路径） */
  resourceRoot?: string;
  /** 地图标记列表（NPC/OBJ 位置） */
  markers?: MapMarker[];
  /** 点击标记回调 */
  onMarkerClick?: (index: number) => void;
  /** 拖拽标记结束回调（返回新的瓦片坐标） */
  onMarkerDrag?: (index: number, mapX: number, mapY: number) => void;
  /** 点击地图空白区域回调（用于取消选中） */
  onEmptyClick?: () => void;
  /** 点击带陷阱的瓦片回调（trapIndex > 0 时触发，优先于 onEmptyClick） */
  onTrapTileClick?: (trapIndex: number, tileX: number, tileY: number) => void;
  /** 右侧面板的额外 Tab（在"地图"Tab 后追加） */
  sidePanelTabs?: SidePanelTab[];
  /** 右侧面板当前激活的 Tab ID（受控模式，不传则内部管理） */
  activeTabId?: string;
  /** Tab 切换回调 */
  onTabChange?: (tabId: string) => void;
  /** 渲染器后端偏好（默认 "auto"，Dashboard 推荐 "canvas2d"） */
  rendererBackend?: RendererBackend;
  /** 获取标记的动态位置覆盖（NPC 模拟等），返回 undefined 表示使用原始位置
   * - mapX/mapY: 瓦片坐标（会经过 toPixelPosition 转换）
   * - pixelX/pixelY: 像素坐标（跳过转换，直接用于渲染，更平滑）
   */
  getMarkerPosition?: (
    index: number
  ) => {
    mapX: number; mapY: number;
    pixelX?: number; pixelY?: number;
    walking?: boolean; direction?: number;
  } | undefined;
  /** 从外部拖拽元素放入地图时的回调（mapX/mapY 为瓦片坐标） */
  onDrop?: (mapX: number, mapY: number, data: DataTransfer) => void;
  /** 高亮陷阱索引集合（用于选中某个陷阱脚本时高亮对应瓦片） */
  highlightTrapIndices?: ReadonlySet<number> | null;
  /** 右键地图回调（tileX/tileY 为瓦片坐标，clientX/clientY 用于定位菜单） */
  onContextMenu?: (info: { tileX: number; tileY: number; clientX: number; clientY: number }) => void;
}

/** MapViewer 暴露给父组件的命令式 API */
export interface MapViewerHandle {
  /** 将相机平滑移动到指定瓦片坐标（居中） */
  panTo: (mapX: number, mapY: number) => void;
  /** 获取当前地图信息 */
  getMapInfo: () => MapInfo | null;
  /** 获取当前缩放比例 */
  getZoom: () => number;
  /** 设置缩放比例 */
  setZoom: (zoom: number) => void;
  /** 请求重新渲染一帧（外部动画驱动用，如 NPC 模拟） */
  requestRender: () => void;
}

/** 地图信息（供外部面板显示） */
export interface MapInfo {
  columns: number;
  rows: number;
  pixelWidth: number;
  pixelHeight: number;
  msfCount: number;
  trapCount: number;
  msfEntries: { name: string; looping: boolean }[];
}

// 障碍类型颜色
const BARRIER_COLORS: Record<number, string> = {
  0: "transparent", // None
  128: "rgba(255, 0, 0, 0.5)", // Obstacle
  160: "rgba(255, 128, 0, 0.5)", // CanOverObstacle
  64: "rgba(0, 0, 255, 0.5)", // Trans
  96: "rgba(0, 128, 255, 0.5)", // CanOverTrans
  32: "rgba(0, 255, 0, 0.5)", // CanOver
};

// 陷阱颜色
const TRAP_COLOR = "rgba(255, 255, 0, 0.6)";
/** 高亮陷阱颜色（选中陷阱脚本对应的 tile） */
const TRAP_HIGHLIGHT_COLOR = "rgba(255, 100, 0, 0.85)";

// ============= 叠加层形状缓存（预渲染到 offscreen canvas，通过 drawSource 绘制）=============

const overlayShapeCache = new Map<string, HTMLCanvasElement>();

/** 获取或创建缓存的菱形 canvas（64×32 等距瓦片形状） */
function getCachedDiamond(fillColor: string, strokeColor?: string): HTMLCanvasElement {
  const key = `d:${fillColor}:${strokeColor ?? ""}`;
  const cached = overlayShapeCache.get(key);
  if (cached) return cached;

  const canvas = document.createElement("canvas");
  canvas.width = 64;
  canvas.height = 32;
  const ctx = canvas.getContext("2d")!;
  ctx.beginPath();
  ctx.moveTo(32, 0);
  ctx.lineTo(64, 16);
  ctx.lineTo(32, 32);
  ctx.lineTo(0, 16);
  ctx.closePath();
  if (fillColor !== "transparent") {
    ctx.fillStyle = fillColor;
    ctx.fill();
  }
  if (strokeColor) {
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  overlayShapeCache.set(key, canvas);
  return canvas;
}

/** 获取或创建缓存的文字标签 canvas（白色带黑色阴影） */
function getCachedLabel(text: string, fontSize = 11): HTMLCanvasElement {
  const key = `l:${text}:${fontSize}`;
  const cached = overlayShapeCache.get(key);
  if (cached) return cached;

  const canvas = document.createElement("canvas");
  const tmpCtx = canvas.getContext("2d")!;
  const font = `bold ${fontSize}px Arial`;
  tmpCtx.font = font;
  const metrics = tmpCtx.measureText(text);
  const w = Math.ceil(metrics.width) + 4;
  const h = fontSize + 6;
  canvas.width = w;
  canvas.height = h;

  const ctx = canvas.getContext("2d")!;
  ctx.font = font;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "#000";
  ctx.fillText(text, w / 2 + 1, h / 2 + 1);
  ctx.fillStyle = "#fff";
  ctx.fillText(text, w / 2, h / 2);

  overlayShapeCache.set(key, canvas);
  return canvas;
}

/** 获取或创建缓存的陷阱序号 canvas */
function getCachedTrapLabel(index: number): HTMLCanvasElement {
  const key = `t:${index}`;
  const cached = overlayShapeCache.get(key);
  if (cached) return cached;

  const text = String(index);
  const canvas = document.createElement("canvas");
  const tmpCtx = canvas.getContext("2d")!;
  tmpCtx.font = "10px Arial";
  const metrics = tmpCtx.measureText(text);
  const w = Math.ceil(metrics.width) + 2;
  const h = 14;
  canvas.width = w;
  canvas.height = h;

  const ctx = canvas.getContext("2d")!;
  ctx.font = "10px Arial";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "#000";
  ctx.fillText(text, w / 2, h / 2);

  overlayShapeCache.set(key, canvas);
  return canvas;
}

/** 获取或创建缓存的圆点标记 canvas（无精灵时的 fallback） */
function getCachedCircle(color: string, radius: number, isSelected: boolean): HTMLCanvasElement {
  const key = `c:${color}:${radius}:${isSelected ? 1 : 0}`;
  const cached = overlayShapeCache.get(key);
  if (cached) return cached;

  const pad = isSelected ? 6 : 2;
  const size = (radius + pad) * 2;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  const cx = size / 2;
  const cy = size / 2;

  // 底圈
  ctx.beginPath();
  ctx.arc(cx, cy, radius + 2, 0, Math.PI * 2);
  ctx.fillStyle = isSelected ? "#fff" : "rgba(0,0,0,0.6)";
  ctx.fill();

  // 主色圈
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();

  // 选中高亮环
  if (isSelected) {
    ctx.beginPath();
    ctx.arc(cx, cy, radius + 4, 0, Math.PI * 2);
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  overlayShapeCache.set(key, canvas);
  return canvas;
}

/**
 * 标记命中检测：使用精灵包围盒判定，无精灵时回退到 12px 半径
 * 返回命中的标记索引，-1 表示未命中
 *
 * @param posOverride 模拟位置覆盖（移动中的 NPC 的实际像素位置）
 */
function hitTestMarker(
  markers: MapMarker[],
  worldX: number,
  worldY: number,
  posOverride?: (index: number) => { mapX: number; mapY: number; pixelX?: number; pixelY?: number } | undefined,
): number {
  // 从后往前检测（后绘制的在上层，优先命中）
  for (let i = markers.length - 1; i >= 0; i--) {
    const m = markers[i];
    // 优先使用模拟位置（移动中的 NPC 的像素坐标）
    const sim = posOverride?.(i);
    let pp: { x: number; y: number };
    if (sim?.pixelX != null && sim.pixelY != null) {
      pp = { x: sim.pixelX, y: sim.pixelY };
    } else if (sim) {
      pp = MapBase.toPixelPosition(sim.mapX, sim.mapY, false);
    } else {
      pp = MapBase.toPixelPosition(m.mapX, m.mapY, false);
    }

    if (m.sprite?.asf) {
      const { offsetX, offsetY, asf, isObj, objOffX, objOffY } = m.sprite;
      // 精灵包围盒
      let left: number;
      let top: number;
      if (isObj) {
        left = pp.x - offsetX + (objOffX ?? 0);
        top = pp.y - offsetY + (objOffY ?? 0);
      } else {
        left = pp.x - asf.left;
        top = pp.y - asf.bottom;
      }
      const right = left + asf.width;
      const bottom = top + asf.height;
      if (worldX >= left && worldX <= right && worldY >= top && worldY <= bottom) {
        return i;
      }
    } else if (m.sprite && m.sprite.frames.length > 0) {
      // 回退帧包围盒
      const { offsetX, offsetY, frames } = m.sprite;
      const f = frames[0];
      const left = pp.x - offsetX;
      const top = pp.y - offsetY;
      if (worldX >= left && worldX <= left + f.width && worldY >= top && worldY <= top + f.height) {
        return i;
      }
    } else {
      // 无精灵：12px 半径
      const dx = worldX - pp.x;
      const dy = worldY - pp.y;
      if (dx * dx + dy * dy < 144) {
        return i;
      }
    }
  }
  return -1;
}

// ============= Component =============

export const MapViewer = memo(
  forwardRef<MapViewerHandle, MapViewerProps>(function MapViewer(
    {
      mapData,
      mmfData,
      mapName,
      fileName,
      isLoading,
      error,
      rootHandle,
      readFile,
      resourceRoot,
      markers,
      onMarkerClick,
      onMarkerDrag,
      onEmptyClick,
      onTrapTileClick,
      sidePanelTabs,
      activeTabId,
      onTabChange,
      rendererBackend = "auto",
      getMarkerPosition,
      onDrop,
      highlightTrapIndices,
      onContextMenu: onContextMenuProp,
    },
    ref
  ) {
    // Map 渲染器（管理 MPC atlas 和相机）
    const rendererRef = useRef<MapRenderer | null>(null);

    // 单 canvas: WebGL 渲染所有内容
    const webglCanvasRef = useRef<HTMLCanvasElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    // WebGL IRenderer（懒初始化：首次 drawMap 时创建）
    const tileRendererRef = useRef<IRenderer | null>(null);

    // 状态
    const [zoom, setZoomState] = useState(0.25);
    const zoomRef = useRef(0.25);
    /** 更新缩放值（ref + state 同步，ref 用于渲染循环，state 用于 UI 显示） */
    const setZoom = useCallback((z: number | ((prev: number) => number)) => {
      const newZoom = typeof z === "function" ? z(zoomRef.current) : z;
      zoomRef.current = newZoom;
      needsRenderRef.current = true;
      setZoomState(newZoom);
    }, []);
    const [loadProgress, setLoadProgress] = useState(0);
    const [isMapLoading, setIsMapLoading] = useState(false);
    const [_mapLoadError, setMapLoadError] = useState<string | null>(null);

    // isMapLoading ref（供事件处理器读取，避免闭包过期）
    const isMapLoadingRef = useRef(false);
    isMapLoadingRef.current = isMapLoading;

    // 图层显示控制
    const [showLayer1, setShowLayer1] = useState(true);
    const [showLayer2, setShowLayer2] = useState(true);
    const [showLayer3, setShowLayer3] = useState(true);
    const [showObstacles, setShowObstacles] = useState(false);
    const [showTraps, setShowTraps] = useState(false);

    // 高亮陷阱索引 ref（避免闭包依赖）
    const highlightTrapIndicesRef = useRef(highlightTrapIndices);
    highlightTrapIndicesRef.current = highlightTrapIndices;

    // 有高亮陷阱时自动显示陷阱叠加层
    useEffect(() => {
      if (highlightTrapIndices && highlightTrapIndices.size > 0) {
        setShowTraps(true);
      }
    }, [highlightTrapIndices]);
    const [showGrid, setShowGrid] = useState(false);

    // 右侧面板 Tab（内部状态，受控时由外部管理）
    const [internalTabId, setInternalTabId] = useState("map");
    const currentTabId = activeTabId ?? internalTabId;
    const handleTabChange = useCallback(
      (id: string) => {
        if (onTabChange) onTabChange(id);
        else setInternalTabId(id);
      },
      [onTabChange]
    );

    // 鼠标状态（全部使用 ref，通过 syncUI 直接更新 DOM，彻底避免 React 重渲染）
    const lastMouseRef = useRef({ x: 0, y: 0 });
    const tilePosRef = useRef({ x: 0, y: 0 });
    const mousePosRef = useRef({ x: 0, y: 0 });
    const mouseClientPosRef = useRef({ x: 0, y: 0 });
    const isHoveringRef = useRef(false);
    const isDraggingRef = useRef(false);

    // DOM refs：tooltip / 状态栏 / 面板坐标（直接操作 DOM，不走 React）
    const tooltipRef = useRef<HTMLDivElement>(null);
    const statusCoordsRef = useRef<HTMLSpanElement>(null);
    const statusTileRef = useRef<HTMLSpanElement>(null);
    const panelCoordsRef = useRef<HTMLSpanElement>(null);
    const panelTileRef = useRef<HTMLSpanElement>(null);

    // 标记拖拽状态
    const draggingMarkerRef = useRef<number | null>(null);
    const markerDragPosRef = useRef<{ x: number; y: number } | null>(null);
    // 鼠标 hover 的标记索引（用于描边高亮）
    const hoveredMarkerRef = useRef<number | null>(null);
    // 待确认的 marker 点击（mousedown 记录，mouseup 确认，避免拖拽误触）
    const pendingClickRef = useRef<{ idx: number; x: number; y: number } | null>(null);

    // 标记位置覆盖回调（通过 ref 存储，避免影响 drawMap 依赖）
    const getMarkerPositionRef = useRef(getMarkerPosition);
    getMarkerPositionRef.current = getMarkerPosition;

    // 动画时间
    const animTimeRef = useRef(0);
    const lastFrameTimeRef = useRef(0);

    // 脏标记：仅在可视内容变化时才重新渲染（避免 60fps 空转）
    const needsRenderRef = useRef(true);
    const lastAnimTickRef = useRef(0);
    const hasAnimatedMarkersRef = useRef(false);
    /** 上一次 drawMap 耗时（ms），用于低缩放率时节流动画重绘 */
    const lastDrawDurationRef = useRef(0);

    // 上一次逻辑分辨率（避免每帧 resize）
    const lastLogicalSizeRef = useRef({ w: 0, h: 0 });

    // 初始化 MapRenderer
    useEffect(() => {
      if (!rendererRef.current) {
        rendererRef.current = createMapRenderer();
      }
    }, []);

    // 清理 IRenderer（卸载时释放 WebGL 资源）
    useEffect(() => {
      return () => {
        tileRendererRef.current?.dispose();
        tileRendererRef.current = null;
      };
    }, []);

    // rendererBackend 变更时重建渲染器
    const prevBackendRef = useRef(rendererBackend);
    useEffect(() => {
      if (prevBackendRef.current !== rendererBackend && tileRendererRef.current) {
        tileRendererRef.current.dispose();
        tileRendererRef.current = null;
        needsRenderRef.current = true;
      }
      prevBackendRef.current = rendererBackend;
    }, [rendererBackend]);

    // Convert JxqyMapData to MiuMapData for engine renderer functions
    // If mmfData is provided directly, use it as-is (no conversion needed)
    const miuMapData = useMemo(
      () => mmfData ?? (mapData ? jxqyToMiuMapData(mapData) : null),
      [mmfData, mapData]
    );

    // miuMapData ref（syncUI 通过 ref 读取，避免闭包过期）
    const miuMapDataRef = useRef(miuMapData);
    miuMapDataRef.current = miuMapData;

    // MSF 稳定键：仅在 MSF 列表变化时才触发 MPC 重新加载，trap 编辑不会改变此值
    const msfKey = useMemo(
      () => miuMapData?.msfEntries.map((e) => e.name).join(",") ?? "",
      [miuMapData],
    );

    // 暴露命令式 API 给父组件
    useImperativeHandle(
      ref,
      () => ({
        panTo: (mapX: number, mapY: number) => {
          const renderer = rendererRef.current;
          if (!renderer) return;
          const pixelPos = MapBase.toPixelPosition(mapX, mapY, false);
          renderer.camera.x = Math.floor(Math.max(0, pixelPos.x - renderer.camera.width / 2));
          renderer.camera.y = Math.floor(Math.max(0, pixelPos.y - renderer.camera.height / 2));
          needsRenderRef.current = true;
        },
        getMapInfo: () => {
          if (!miuMapData) return null;
          return {
            columns: miuMapData.mapColumnCounts,
            rows: miuMapData.mapRowCounts,
            pixelWidth: miuMapData.mapPixelWidth,
            pixelHeight: miuMapData.mapPixelHeight,
            msfCount: miuMapData.msfEntries.length,
            trapCount: miuMapData.trapTable.length,
            msfEntries: miuMapData.msfEntries.map((e) => ({ name: e.name, looping: e.looping })),
          };
        },
        getZoom: () => zoomRef.current,
        setZoom: (z: number) => setZoom(z),
        requestRender: () => {
          needsRenderRef.current = true;
        },
      }),
      [miuMapData, setZoom]
    );

    // Unified map dimensions for camera/zoom calculations
    // 使用原始值作为依赖，避免 trap 编辑改变 mmfData 引用时导致缩放重置
    const mapPixelW = mmfData?.mapPixelWidth ?? mapData?.mapPixelWidth ?? 0;
    const mapPixelH = mmfData?.mapPixelHeight ?? mapData?.mapPixelHeight ?? 0;
    const mapDimensions = useMemo(
      () => (mapPixelW > 0 && mapPixelH > 0 ? { width: mapPixelW, height: mapPixelH } : null),
      [mapPixelW, mapPixelH],
    );

    // 地图加载后计算合适的初始缩放，并重置相机位置
    useEffect(() => {
      if (!mapDimensions) return;
      const container = containerRef.current;
      const renderer = rendererRef.current;
      if (!container || !renderer) return;

      const { width, height } = container.getBoundingClientRect();
      if (width === 0 || height === 0) return;

      // 重置相机位置到左上角
      renderer.camera.x = 0;
      renderer.camera.y = 0;

      // 计算能完整显示地图的缩放比例
      const scaleX = width / mapDimensions.width;
      const scaleY = height / mapDimensions.height;
      const fitScale = Math.min(scaleX, scaleY, 1); // 不超过 100%
      setZoom(Math.max(0.05, Math.min(1, fitScale)));
    }, [mapDimensions]);

    // 加载 MPC 资源
    // 依赖 msfKey 而非 miuMapData 引用：trap/trapTable 编辑不改变 MSF 列表，不会触发重新加载
    // miuMapData 通过 ref 读取实际数据
    useEffect(() => {
      const data = miuMapDataRef.current;
      if (!data || !mapName || !msfKey) return;

      // 立刻设置加载状态，防止显示旧地图
      setIsMapLoading(true);
      setMapLoadError(null);
      setLoadProgress(0);

      const loadMpcs = async () => {
        try {
          const renderer = rendererRef.current;
          if (!renderer) return;

          // 使用 engine 的 loadMapMpcs
          const success = await loadMapMpcs(
            renderer,
            data,
            mapName,
            (progress: number) => setLoadProgress(progress),
            resourceRoot
          );

          if (!success) {
            setMapLoadError("加载 MPC 资源失败");
          }
        } catch (err) {
          setMapLoadError(`加载失败: ${(err as Error).message}`);
        } finally {
          setIsMapLoading(false);
        }
      };

      loadMpcs();
    }, [msfKey, mapName, resourceRoot]);

    // 监听容器尺寸变化（仅标记脏，实际 resize 由 drawMap 统一处理，避免清空画布造成黑闪）
    // 依赖 miuMapData: 同 wheel 事件注册，确保组件从早期 return 过渡到完整渲染后重新绑定
    // biome-ignore lint/correctness/useExhaustiveDependencies: miuMapData triggers re-binding when container mounts after early return
    useEffect(() => {
      const container = containerRef.current;
      if (!container) return;

      const resizeObserver = new ResizeObserver(() => {
        needsRenderRef.current = true;
      });
      resizeObserver.observe(container);
      return () => resizeObserver.disconnect();
    }, [miuMapData]);

    // 绘制地图（单 WebGL canvas 渲染全部内容）
    const drawMap = useCallback(() => {
      const webglCanvas = webglCanvasRef.current;
      const mapRenderer = rendererRef.current;
      const container = containerRef.current;

      if (!webglCanvas || !mapRenderer || !container) return;

      // 懒初始化 IRenderer（Canvas 挂载后首次绘制时创建）
      // 当 canvas 元素因条件渲染被卸载/重新挂载后，旧 renderer 的上下文已失效，
      // 需要检测 canvas 变化并重建 renderer（修复场景切换黑屏问题）
      if (!tileRendererRef.current || tileRendererRef.current.getCanvas() !== webglCanvas) {
        tileRendererRef.current?.dispose();
        tileRendererRef.current = createRenderer(webglCanvas, rendererBackend);
      }
      const tileRenderer = tileRendererRef.current;

      const containerRect = container.getBoundingClientRect();
      const containerW = Math.floor(containerRect.width);
      const containerH = Math.floor(containerRect.height);
      if (containerW === 0 || containerH === 0) return;

      // 确保画布缓冲区尺寸同步（capped），相机使用未受限的世界尺寸
      const currentZoom = zoomRef.current;
      const { logicalW, logicalH, worldW, worldH } = computeLogicalSize(containerW, containerH, currentZoom);
      if (webglCanvas.width !== logicalW || webglCanvas.height !== logicalH) {
        webglCanvas.width = logicalW;
        webglCanvas.height = logicalH;
        tileRenderer.resize(logicalW, logicalH);
        lastLogicalSizeRef.current = { w: logicalW, h: logicalH };
      }

      // 相机覆盖的世界区域 = 未受限尺寸（大地图低缩放时可远大于画布）
      mapRenderer.camera.width = worldW;
      mapRenderer.camera.height = worldH;
      setCameraSize(mapRenderer, worldW, worldH);

      // ========== 渲染: 全部内容 ==========
      tileRenderer.beginFrame();

      // 应用世界缩放（世界坐标 → 画布坐标）
      tileRenderer.applyWorldScale(worldW, worldH);

      // 背景
      tileRenderer.fillRect({ x: 0, y: 0, width: worldW, height: worldH, color: "#1a1a2e" });

      if (!miuMapData || isMapLoading || mapRenderer.isLoading) {
        // 无数据或加载中：仅渲染背景，HTML overlay 显示加载进度
        tileRenderer.resetWorldScale();
        tileRenderer.endFrame();
        return;
      }

      // 预计算标记按行分组（用于 renderMapInterleaved 回调）
      const curDragPos = markerDragPosRef.current;
      const posOverride = getMarkerPositionRef.current;

      /** 解析标记位置：拖拽 > 模拟 > 原始。返回瓦片坐标 + 可选像素坐标 + 行走状态 */
      const resolvePos = (
        i: number,
        m: MapMarker
      ): { x: number; y: number; px?: number; py?: number; walking?: boolean; dir?: number } => {
        if (draggingMarkerRef.current === i && curDragPos) {
          return { x: curDragPos.x, y: curDragPos.y };
        }
        const sim = posOverride?.(i);
        if (sim) return {
          x: sim.mapX, y: sim.mapY,
          px: sim.pixelX, py: sim.pixelY,
          walking: sim.walking, dir: sim.direction,
        };
        return { x: m.mapX, y: m.mapY };
      };

      const markersByRow = new Map<number, number[]>();
      if (markers && markers.length > 0) {
        for (let i = 0; i < markers.length; i++) {
          const pos = resolvePos(i, markers[i]);
          let arr = markersByRow.get(pos.y);
          if (!arr) {
            arr = [];
            markersByRow.set(pos.y, arr);
          }
          arr.push(i);
        }
      }

      const camX = mapRenderer.camera.x;
      const camY = mapRenderer.camera.y;

      // 使用引擎的 renderMapInterleaved 实现正确的深度交错渲染
      renderMapInterleaved(
        tileRenderer,
        mapRenderer,
        (row: number) => {
          // 绘制该行的精灵标记
          const indices = markersByRow.get(row);
          if (!indices) return;

          for (const i of indices) {
            const marker = markers![i];
            const pos = resolvePos(i, marker);
            const pixelPos =
              pos.px != null && pos.py != null
                ? { x: pos.px, y: pos.py }
                : MapBase.toPixelPosition(pos.x, pos.y, false);

            if (!marker.sprite || marker.sprite.frames.length === 0) continue;

            const { frames, interval, offsetX, offsetY, asf, isObj, objOffX, objOffY, walkAsf } =
              marker.sprite;
            // 行走时：使用 walkAsf 并采用模拟朝向；否则用 standAsf + 原始朝向
            const isWalking = pos.walking && walkAsf && walkAsf.frames.length > 0;
            const activeAsf = isWalking ? walkAsf : asf;
            const direction = (pos.walking && pos.dir != null) ? pos.dir : (marker.direction ?? 0);

            if (activeAsf && activeAsf.frames.length > 0) {
              // **引擎标准渲染**: 使用 ASF atlas + IRenderer.drawSourceEx
              const framesPerDir = activeAsf.framesPerDirection || activeAsf.frames.length;
              const animFrame =
                frames.length > 1
                  ? Math.floor(animTimeRef.current / Math.max(interval, 50)) % framesPerDir
                  : 0;
              const frameIdx = getFrameIndex(activeAsf, direction, animFrame);

              if (isObj) {
                // OBJ 渲染: per-frame canvas + drawSource（与 engine/obj/obj.ts 一致）
                if (frameIdx >= 0 && frameIdx < activeAsf.frames.length) {
                  const frame = activeAsf.frames[frameIdx];
                  if (frame && frame.width > 0 && frame.height > 0) {
                    const canvas = getFrameCanvas(frame);
                    const drawX = pixelPos.x - camX - offsetX + (objOffX ?? 0);
                    const drawY = pixelPos.y - camY - offsetY + (objOffY ?? 0);
                    tileRenderer.drawSource(canvas, drawX, drawY);
                  }
                }
              } else {
                // NPC/Character 渲染: atlas + drawSourceEx（与 engine/sprite/sprite.ts 一致）
                const atlasInfo = getFrameAtlasInfo(activeAsf, frameIdx);
                const drawX = pixelPos.x - camX - activeAsf.left;
                const drawY = pixelPos.y - camY - activeAsf.bottom;
                tileRenderer.drawSourceEx(atlasInfo.canvas, drawX, drawY, {
                  srcX: atlasInfo.srcX,
                  srcY: atlasInfo.srcY,
                  srcWidth: atlasInfo.srcWidth,
                  srcHeight: atlasInfo.srcHeight,
                });
              }
            } else {
              // 回退: 使用预渲染帧画布 + drawSource
              const frameIdx =
                frames.length > 1
                  ? Math.floor(animTimeRef.current / Math.max(interval, 50)) % frames.length
                  : 0;
              const spriteCanvas = frames[frameIdx];
              const drawX = pixelPos.x - camX - offsetX;
              const drawY = pixelPos.y - camY - offsetY;
              tileRenderer.drawSource(spriteCanvas, drawX, drawY);
            }
          }
        },
        { showLayer1, showLayer2, showLayer3 }
      );

      // ========== 叠加层（仅在可见瓦片不过多时绘制，防止低缩放率卡死）==========

      const { startX, startY, endX, endY } = getViewTileRange(
        mapRenderer.camera,
        miuMapData,
        mapRenderer.maxTileHeight,
        mapRenderer.maxTileWidth
      );
      const visibleTileCount = (endX - startX) * (endY - startY);

      // 网格（菱形线框）
      if (showGrid && visibleTileCount <= MAX_OVERLAY_TILES) {
        const gridDiamond = getCachedDiamond("transparent", "#444");
        for (let row = startY; row < endY; row++) {
          for (let col = startX; col < endX; col++) {
            const pixelPos = MapBase.toPixelPosition(col, row);
            tileRenderer.drawSource(gridDiamond, pixelPos.x - camX - 32, pixelPos.y - camY - 16);
          }
        }
      }

      // 障碍物（填色菱形）— 稀疏数据，用更高的上限
      if (showObstacles && miuMapData.barriers && visibleTileCount <= MAX_OVERLAY_TILES_SPARSE) {
        for (let row = startY; row < endY; row++) {
          for (let col = startX; col < endX; col++) {
            const tileIndex = col + row * miuMapData.mapColumnCounts;
            const barrierType = miuMapData.barriers[tileIndex] ?? 0;
            if (barrierType === 0) continue;
            const color = BARRIER_COLORS[barrierType] || "rgba(128, 128, 128, 0.5)";
            const diamond = getCachedDiamond(color);
            const pixelPos = MapBase.toPixelPosition(col, row);
            tileRenderer.drawSource(diamond, pixelPos.x - camX - 32, pixelPos.y - camY - 16);
          }
        }
      }

      // 陷阱（填色菱形 + 序号文字，高亮选中的陷阱索引）— 稀疏数据，用更高的上限
      if (showTraps && miuMapData.traps && visibleTileCount <= MAX_OVERLAY_TILES_SPARSE) {
        const trapDiamond = getCachedDiamond(TRAP_COLOR);
        const hlSet = highlightTrapIndicesRef.current;
        const hasHighlight = hlSet != null && hlSet.size > 0;
        const hlDiamond = hasHighlight ? getCachedDiamond(TRAP_HIGHLIGHT_COLOR) : null;
        for (let row = startY; row < endY; row++) {
          for (let col = startX; col < endX; col++) {
            const tileIndex = col + row * miuMapData.mapColumnCounts;
            const trapIndex = miuMapData.traps[tileIndex] ?? 0;
            if (trapIndex === 0) continue;
            const pixelPos = MapBase.toPixelPosition(col, row);
            const sx = pixelPos.x - camX - 32;
            const sy = pixelPos.y - camY - 16;
            const isHighlighted = hasHighlight && hlSet!.has(trapIndex);
            tileRenderer.drawSource(isHighlighted ? hlDiamond! : trapDiamond, sx, sy);
            // 陷阱序号（低缩放率时跳过文字，太小无法辨识）
            if (zoomRef.current >= TRAP_LABEL_MIN_ZOOM) {
              const trapLabel = getCachedTrapLabel(trapIndex);
              tileRenderer.drawSource(
                trapLabel,
                sx + 32 - trapLabel.width / 2,
                sy + 16 - trapLabel.height / 2 + 4
              );
            }
          }
        }
      }

      // Hover 瓦片高亮
      const hoverTile = tilePosRef.current;
      if (
        hoverTile.x >= 0 &&
        hoverTile.y >= 0 &&
        hoverTile.x < miuMapData.mapColumnCounts &&
        hoverTile.y < miuMapData.mapRowCounts
      ) {
        const hoverDiamond = getCachedDiamond(
          "rgba(255, 255, 255, 0.3)",
          "rgba(255, 255, 255, 0.8)"
        );
        const pixelPos = MapBase.toPixelPosition(hoverTile.x, hoverTile.y);
        tileRenderer.drawSource(hoverDiamond, pixelPos.x - camX - 32, pixelPos.y - camY - 16);
      }

      // 标记标签 + 描边高亮 + 圆点（无精灵时 fallback）
      if (markers && markers.length > 0) {
        const hoveredIdx = hoveredMarkerRef.current;
        for (let i = 0; i < markers.length; i++) {
          const marker = markers[i];
          const pos = resolvePos(i, marker);
          const pixelPos =
            pos.px != null && pos.py != null
              ? { x: pos.px, y: pos.py }
              : MapBase.toPixelPosition(pos.x, pos.y, false);
          const screenX = pixelPos.x - camX;
          const screenY = pixelPos.y - camY;
          const isSelected = marker.selected ?? false;
          const isHovered = hoveredIdx === i && !isSelected;

          if (marker.sprite && marker.sprite.frames.length > 0) {
            const { frames, interval, offsetX, offsetY, asf, isObj, objOffX, objOffY, walkAsf } =
              marker.sprite;
            const isWalkingOverlay = pos.walking && walkAsf && walkAsf.frames.length > 0;
            const activeAsf = isWalkingOverlay ? walkAsf : asf;
            const direction = (pos.walking && pos.dir != null) ? pos.dir : (marker.direction ?? 0);

            // 选中 / hover 描边（复用引擎 getOuterEdge）
            if (isSelected || isHovered) {
              const edgeColor = isSelected
                ? (marker.selectedColor ?? "rgba(255, 255, 0, 0.8)")
                : "rgba(255, 255, 255, 0.5)";
              if (activeAsf && activeAsf.frames.length > 0) {
                const framesPerDir = activeAsf.framesPerDirection || activeAsf.frames.length;
                const animFrame =
                  frames.length > 1
                    ? Math.floor(animTimeRef.current / Math.max(interval, 50)) % framesPerDir
                    : 0;
                const frameIdx = getFrameIndex(activeAsf, direction, animFrame);
                if (frameIdx >= 0 && frameIdx < activeAsf.frames.length) {
                  const canvas = getFrameCanvas(activeAsf.frames[frameIdx]);
                  const edgeCanvas = getOuterEdge(canvas, edgeColor);
                  if (isObj) {
                    tileRenderer.drawSource(
                      edgeCanvas,
                      screenX - offsetX + (objOffX ?? 0),
                      screenY - offsetY + (objOffY ?? 0)
                    );
                  } else {
                    tileRenderer.drawSource(edgeCanvas, screenX - activeAsf.left, screenY - activeAsf.bottom);
                  }
                }
              } else {
                const frameIdx =
                  frames.length > 1
                    ? Math.floor(animTimeRef.current / Math.max(interval, 50)) % frames.length
                    : 0;
                const edgeCanvas = getOuterEdge(frames[frameIdx], edgeColor);
                tileRenderer.drawSource(edgeCanvas, screenX - offsetX, screenY - offsetY);
              }
            }

            // 标签
            const labelCanvas = getCachedLabel(marker.label);
            const labelOffY = offsetY + 2;
            tileRenderer.drawSource(
              labelCanvas,
              screenX - labelCanvas.width / 2,
              screenY - labelOffY - labelCanvas.height
            );
          } else {
            // 无精灵: 圆点标记
            const radius = isSelected ? 8 : 6;
            const circle = getCachedCircle(marker.color, radius, isSelected);
            tileRenderer.drawSource(
              circle,
              screenX - circle.width / 2,
              screenY - circle.height / 2
            );

            // 标签
            const labelCanvas = getCachedLabel(marker.label);
            const labelOffY = radius + 4;
            tileRenderer.drawSource(
              labelCanvas,
              screenX - labelCanvas.width / 2,
              screenY - labelOffY - labelCanvas.height
            );
          }
        }
      }

      tileRenderer.resetWorldScale();
      tileRenderer.endFrame();
    }, [
      miuMapData,
      isMapLoading,
      rendererBackend,
      showGrid,
      showLayer1,
      showLayer2,
      showLayer3,
      showObstacles,
      showTraps,
      markers,
    ]);

    /**
     * 直接更新 DOM 元素（tooltip / 状态栏 / 面板坐标）
     * 完全绕过 React 渲染周期，确保鼠标移动时零 re-render
     */
    const syncUI = useCallback(() => {
      const tp = tilePosRef.current;
      const mp = mousePosRef.current;
      const mcp = mouseClientPosRef.current;
      const hovering = isHoveringRef.current;
      const dragging = isDraggingRef.current;
      const data = miuMapDataRef.current;

      // ---- Tooltip ----
      const tooltip = tooltipRef.current;
      if (tooltip) {
        const showTooltip = hovering && !dragging && data;
        if (showTooltip) {
          const { x, y } = tp;
          const inBounds = x >= 0 && y >= 0 && x < data.mapColumnCounts && y < data.mapRowCounts;
          if (inBounds) {
            tooltip.style.display = "";
            tooltip.style.left = `${mcp.x + 16}px`;
            tooltip.style.top = `${mcp.y + 16}px`;
            const cw = containerRef.current?.clientWidth ?? 0;
            tooltip.style.transform = mcp.x > cw - 200 ? "translateX(-100%)" : "";

            const tileIndex = x + y * data.mapColumnCounts;
            const off = tileIndex * 2;
            const l1m = data.layer1[off] ?? 0,
              l1f = data.layer1[off + 1] ?? 0;
            const l2m = data.layer2[off] ?? 0,
              l2f = data.layer2[off + 1] ?? 0;
            const l3m = data.layer3[off] ?? 0,
              l3f = data.layer3[off + 1] ?? 0;
            const barrier = data.barriers[tileIndex] ?? 0;
            const trap = data.traps[tileIndex] ?? 0;

            let html = `<div class="text-[#cccccc] font-medium mb-1">瓦片 (${x}, ${y})</div>`;
            html += '<div class="space-y-0.5 text-[#808080]">';
            html += `<div>L1: MPC:${l1m} F:${l1f}</div>`;
            html += `<div>L2: MPC:${l2m} F:${l2f}</div>`;
            html += `<div>L3: MPC:${l3m} F:${l3f}</div>`;
            if (barrier !== 0)
              html += `<div class="text-red-400">障碍: 0x${barrier.toString(16).toUpperCase().padStart(2, "0")}</div>`;
            if (trap !== 0) html += `<div class="text-yellow-400">陷阱: ${trap}</div>`;
            html += "</div>";
            tooltip.innerHTML = html;
          } else {
            tooltip.style.display = "none";
          }
        } else {
          tooltip.style.display = "none";
        }
      }

      // ---- 状态栏 ----
      if (statusCoordsRef.current) statusCoordsRef.current.textContent = `坐标: (${mp.x}, ${mp.y})`;
      if (statusTileRef.current) statusTileRef.current.textContent = `瓦片: (${tp.x}, ${tp.y})`;

      // ---- 右侧面板「当前位置」----
      if (panelCoordsRef.current) panelCoordsRef.current.textContent = `(${mp.x}, ${mp.y})`;
      if (panelTileRef.current) panelTileRef.current.textContent = `(${tp.x}, ${tp.y})`;
    }, []); // 全部通过 ref 读取，无闭包依赖

    // 更新 hasAnimatedMarkersRef（仅在 markers 变化时计算一次）
    useEffect(() => {
      hasAnimatedMarkersRef.current =
        markers?.some((m) => m.sprite && m.sprite.frames.length > 1) ?? false;
      needsRenderRef.current = true;
    }, [markers]);

    // 高亮陷阱变化时触发重绘
    // biome-ignore lint/correctness/useExhaustiveDependencies: intentionally trigger redraw when highlightTrapIndices prop changes
    useEffect(() => {
      needsRenderRef.current = true;
    }, [highlightTrapIndices]);

    // 动画循环（脏标记驱动：仅在 needsRenderRef 为 true 时才执行 drawMap）
    useEffect(() => {
      let animationId: number;
      // drawMap 依赖变化时（图层切换、zoom 等）确保首帧渲染
      needsRenderRef.current = true;

      const animate = (timestamp: number) => {
        // 更新动画时间
        if (lastFrameTimeRef.current === 0) lastFrameTimeRef.current = timestamp;
        animTimeRef.current += timestamp - lastFrameTimeRef.current;
        lastFrameTimeRef.current = timestamp;

        // 加载中跳过所有渲染（HTML 遮罩已覆盖画布，canvas 渲染纯属浪费）
        if (isMapLoadingRef.current) {
          animationId = requestAnimationFrame(animate);
          return;
        }

        // 精灵动画帧变化检测（50ms 粒度，匹配最小帧间隔）
        // 如果上一帧渲染耗时过长（>30ms），降低动画刷新率以防主线程阻塞
        if (hasAnimatedMarkersRef.current) {
          const animInterval = lastDrawDurationRef.current > 30 ? 200 : 50;
          const tick = Math.floor(animTimeRef.current / animInterval);
          if (tick !== lastAnimTickRef.current) {
            lastAnimTickRef.current = tick;
            needsRenderRef.current = true;
          }
        }

        // 仅在脏标记时渲染 + 直接同步 DOM（不触发 React 重渲染）
        if (needsRenderRef.current) {
          needsRenderRef.current = false;
          const t0 = performance.now();
          drawMap();
          lastDrawDurationRef.current = performance.now() - t0;
          syncUI();
        }

        animationId = requestAnimationFrame(animate);
      };

      animationId = requestAnimationFrame(animate);
      return () => {
        cancelAnimationFrame(animationId);
        lastFrameTimeRef.current = 0;
      };
    }, [drawMap, syncUI]);

    // ============= 事件处理 =============

    /** 计算鼠标在世界坐标中的位置 */
    const getWorldPos = useCallback(
      (clientX: number, clientY: number) => {
        const canvas = webglCanvasRef.current;
        const renderer = rendererRef.current;
        if (!canvas || !renderer) return null;

        const rect = canvas.getBoundingClientRect();
        const canvasX = clientX - rect.left;
        const canvasY = clientY - rect.top;

        // effectiveZoom = zoom（直接使用，无需通过 logicalW 间接计算）
        const currentZoom = zoomRef.current;
        const effectiveZoom = currentZoom;

        const worldX = canvasX / effectiveZoom + renderer.camera.x;
        const worldY = canvasY / effectiveZoom + renderer.camera.y;

        return { canvasX, canvasY, worldX, worldY, effectiveZoom };
      },
      []
    );

    // ============= 拖放处理 =============

    const handleDragOver = useCallback((e: React.DragEvent) => {
      // 检查是否包含 miu2d 自定义数据类型
      if (e.dataTransfer.types.some((t) => t.startsWith("application/miu2d-"))) {
        e.preventDefault();
        e.dataTransfer.dropEffect = "copy";
      }
    }, []);

    const handleDrop = useCallback(
      (e: React.DragEvent) => {
        e.preventDefault();
        if (!onDrop) return;
        const wp = getWorldPos(e.clientX, e.clientY);
        if (!wp) return;
        const tile = MapBase.toTilePosition(wp.worldX, wp.worldY, false);
        onDrop(tile.x, tile.y, e.dataTransfer);
      },
      [getWorldPos, onDrop]
    );

    // 鼠标事件处理（全部通过 ref，不触发 React 重渲染）
    const handleMouseDown = useCallback(
      (e: React.MouseEvent) => {
        const renderer = rendererRef.current;
        if (!renderer) {
          isDraggingRef.current = true;
          lastMouseRef.current = { x: e.clientX, y: e.clientY };
          return;
        }

        const wp = getWorldPos(e.clientX, e.clientY);
        if (!wp) {
          isDraggingRef.current = true;
          lastMouseRef.current = { x: e.clientX, y: e.clientY };
          return;
        }

        // 如果正在搬运标记，左键点击放置（右键由 contextmenu 处理取消）
        if (draggingMarkerRef.current !== null) {
          if (e.button !== 0) return;
          const dragIdx = draggingMarkerRef.current;
          const dragPos = markerDragPosRef.current;
          // 获取放置时鼠标所在瓦片（即使未移动也用当前鼠标位置）
          const placeTile = dragPos ?? MapBase.toTilePosition(wp.worldX, wp.worldY, false);
          onMarkerDrag?.(dragIdx, Math.max(0, placeTile.x), Math.max(0, placeTile.y));
          draggingMarkerRef.current = null;
          markerDragPosRef.current = null;
          needsRenderRef.current = true;
          return;
        }

        // 检测是否点击了标记（优先用精灵包围盒命中检测）
        if (markers && markers.length > 0) {
          const hitIdx = hitTestMarker(markers, wp.worldX, wp.worldY, getMarkerPositionRef.current);

          if (hitIdx >= 0) {
            // 所有 marker 都用 pending 机制（mousedown 记录，mouseup 确认）
            pendingClickRef.current = { idx: hitIdx, x: e.clientX, y: e.clientY };
            isDraggingRef.current = true;
            lastMouseRef.current = { x: e.clientX, y: e.clientY };
            e.stopPropagation();
            return;
          }
        }

        // 点击空白区域 → 记录待确认的空白点击
        pendingClickRef.current = { idx: -1, x: e.clientX, y: e.clientY };
        isDraggingRef.current = true;
        lastMouseRef.current = { x: e.clientX, y: e.clientY };
      },
      [markers, onMarkerDrag, getWorldPos]
    );

    const handleMouseUp = useCallback(
      (e: React.MouseEvent) => {
        // 搬运模式下 mouseup 不放置（等待下次点击放置）
        if (draggingMarkerRef.current !== null) {
          needsRenderRef.current = true;
          return;
        }
        isDraggingRef.current = false;
        needsRenderRef.current = true;

        // 仅左键点击才处理标记选择/搬运（右键由 contextmenu 处理）
        if (e.button !== 0) {
          pendingClickRef.current = null;
          return;
        }

        // 检查是否有待确认的点击（mousedown 位置与 mouseup 位置距离 < 5px 视为点击）
        const pending = pendingClickRef.current;
        pendingClickRef.current = null;
        if (pending) {
          const dx = e.clientX - pending.x;
          const dy = e.clientY - pending.y;
          if (dx * dx + dy * dy < 25) {
            if (pending.idx >= 0) {
              const marker = markers?.[pending.idx];
              if (marker?.selected && onMarkerDrag) {
                // 已选中的标记 → 进入搬运模式（跟随鼠标，无需按住）
                draggingMarkerRef.current = pending.idx;
                markerDragPosRef.current = null;
                needsRenderRef.current = true;
              } else {
                onMarkerClick?.(pending.idx);
              }
            } else {
              // 空白区域点击：检查是否有陷阱瓦片
              const tp = tilePosRef.current;
              const data = miuMapDataRef.current;
              if (onTrapTileClick && data && tp.x >= 0 && tp.y >= 0 && tp.x < data.mapColumnCounts && tp.y < data.mapRowCounts) {
                const tIdx = tp.x + tp.y * data.mapColumnCounts;
                const trapIdx = data.traps[tIdx] ?? 0;
                if (trapIdx > 0) {
                  onTrapTileClick(trapIdx, tp.x, tp.y);
                } else {
                  onEmptyClick?.();
                }
              } else {
                onEmptyClick?.();
              }
            }
          }
        }
      },
      [markers, onMarkerDrag, onMarkerClick, onEmptyClick, onTrapTileClick]
    );

    const handleMouseMove = useCallback(
      (e: React.MouseEvent) => {
        const wp = getWorldPos(e.clientX, e.clientY);
        if (!wp) return;

        // 更新 refs + 脏标记（仅在值真正变化时标脏）
        mouseClientPosRef.current = { x: wp.canvasX, y: wp.canvasY };
        mousePosRef.current = { x: Math.floor(wp.worldX), y: Math.floor(wp.worldY) };

        if (!isHoveringRef.current) {
          isHoveringRef.current = true;
          needsRenderRef.current = true;
        }

        const tile = MapBase.toTilePosition(wp.worldX, wp.worldY);
        const prevTile = tilePosRef.current;
        if (tile.x !== prevTile.x || tile.y !== prevTile.y) {
          tilePosRef.current = { x: tile.x, y: tile.y };
          // 仅在缩放率足够高时才为 hover 高亮触发重绘，防止低缩放率下频繁重绘卡死
          if (zoomRef.current >= 0.2) {
            needsRenderRef.current = true;
          }
        }

        // 拖拽移动
        if (draggingMarkerRef.current !== null) {
          // 拖拽标记 → 更新标记位置
          const dragTile = MapBase.toTilePosition(wp.worldX, wp.worldY, false);
          markerDragPosRef.current = { x: Math.max(0, dragTile.x), y: Math.max(0, dragTile.y) };
          needsRenderRef.current = true;
        } else if (isDraggingRef.current) {
          const deltaX = (lastMouseRef.current.x - e.clientX) / wp.effectiveZoom;
          const deltaY = (lastMouseRef.current.y - e.clientY) / wp.effectiveZoom;
          updateCamera(rendererRef.current!, deltaX, deltaY);
          lastMouseRef.current = { x: e.clientX, y: e.clientY };
          needsRenderRef.current = true;
        }

        // 标记 hover 检测（非拖拽时）
        if (
          draggingMarkerRef.current === null &&
          !isDraggingRef.current &&
          markers &&
          markers.length > 0
        ) {
          const hitIdx = hitTestMarker(markers, wp.worldX, wp.worldY, getMarkerPositionRef.current);
          if (hitIdx !== hoveredMarkerRef.current) {
            hoveredMarkerRef.current = hitIdx >= 0 ? hitIdx : null;
            needsRenderRef.current = true;
          }
        }

        // 鼠标移动时直接同步 DOM（tooltip 跟随响应更即时）
        syncUI();
      },
      [getWorldPos, markers, syncUI]
    );

    const handleMouseLeave = useCallback(() => {
      isDraggingRef.current = false;
      isHoveringRef.current = false;
      // 取消标记拖拽（不提交）
      draggingMarkerRef.current = null;
      markerDragPosRef.current = null;
      hoveredMarkerRef.current = null;
      needsRenderRef.current = true;
      syncUI();
    }, [syncUI]);

    // 右键：正在搬运标记时取消搬运；否则触发外部右键菜单回调
    const handleContextMenu = useCallback((e: React.MouseEvent) => {
      e.preventDefault();
      if (draggingMarkerRef.current !== null) {
        draggingMarkerRef.current = null;
        markerDragPosRef.current = null;
        needsRenderRef.current = true;
        return;
      }
      if (onContextMenuProp) {
        const wp = getWorldPos(e.clientX, e.clientY);
        if (wp) {
          const tile = MapBase.toTilePosition(wp.worldX, wp.worldY, false);
          onContextMenuProp({ tileX: tile.x, tileY: tile.y, clientX: e.clientX, clientY: e.clientY });
        }
      }
    }, [onContextMenuProp, getWorldPos]);

    // 滚轮事件：直接滚轮缩放
    const handleWheel = useCallback(
      (e: WheelEvent) => {
        e.preventDefault();
        // 加载中禁止缩放（避免频繁 resize canvas 导致浏览器卡死）
        if (isMapLoadingRef.current) return;

        const renderer = rendererRef.current;
        const canvas = webglCanvasRef.current;
        if (!renderer || !canvas) return;

        // 获取鼠标在 canvas 中的位置
        const rect = canvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;

        const currentZoom = zoomRef.current;
        const effectiveZoom = currentZoom;

        // 计算鼠标对应的世界坐标（缩放前）
        const worldX = mouseX / effectiveZoom + renderer.camera.x;
        const worldY = mouseY / effectiveZoom + renderer.camera.y;

        // 计算新的缩放值
        const zoomDelta = e.deltaY > 0 ? 0.9 : 1.1;
        const newZoom = Math.max(0.05, Math.min(4, currentZoom * zoomDelta));
        const newEffectiveZoom = newZoom;

        // 新的世界可视尺寸（用于 camera clamp）
        const newWorldW = Math.ceil(rect.width / newZoom);
        const newWorldH = Math.ceil(rect.height / newZoom);

        // 调整相机位置（同时 clamp 上下界，与 updateCamera 一致，避免拖拽时跳跃）
        const newCameraX = worldX - mouseX / newEffectiveZoom;
        const newCameraY = worldY - mouseY / newEffectiveZoom;

        const mapData = renderer.mapData;
        if (mapData) {
          const maxCameraX = Math.max(0, mapData.mapPixelWidth - newWorldW);
          const maxCameraY = Math.max(0, mapData.mapPixelHeight - newWorldH);
          renderer.camera.x = Math.round(Math.max(0, Math.min(newCameraX, maxCameraX)));
          renderer.camera.y = Math.round(Math.max(0, Math.min(newCameraY, maxCameraY)));
        } else {
          renderer.camera.x = Math.round(Math.max(0, newCameraX));
          renderer.camera.y = Math.round(Math.max(0, newCameraY));
        }

        setZoom(newZoom);
      },
      [setZoom]
    );

    // 注册非 passive 滚轮事件（React 默认 passive 无法 preventDefault）
    // 依赖 miuMapData: 组件有早期 return（isLoading / error / !miuMapData），
    // 此时 containerRef.current 为 null，效果空转；miuMapData 变化后重新挂载 container → 重新注册
    // biome-ignore lint/correctness/useExhaustiveDependencies: miuMapData triggers re-registration when container mounts after early return
    useEffect(() => {
      const container = containerRef.current;
      if (!container) return;
      container.addEventListener("wheel", handleWheel, { passive: false });
      return () => container.removeEventListener("wheel", handleWheel);
    }, [handleWheel, miuMapData]);

    // 加载/错误状态
    if (isLoading) {
      return (
        <div className="flex h-full items-center justify-center bg-[#1e1e1e]">
          <div className="text-center">
            <div className="mb-2 h-8 w-8 animate-spin rounded-full border-2 border-amber-500 border-t-transparent mx-auto" />
            <span className="text-[#808080]">加载中...</span>
          </div>
        </div>
      );
    }

    if (error) {
      return (
        <div className="flex h-full items-center justify-center bg-[#1e1e1e]">
          <div className="text-center text-red-400">
            <span className="text-2xl">❌</span>
            <p className="mt-2">{error}</p>
          </div>
        </div>
      );
    }

    if (!miuMapData) {
      return (
        <div className="flex h-full items-center justify-center bg-[#1e1e1e]">
          <div className="text-center text-[#808080]">
            <span className="text-4xl">🗺️</span>
            <p className="mt-4">选择一个地图文件查看</p>
          </div>
        </div>
      );
    }

    return (
      <div className="flex h-full flex-col bg-[#1e1e1e] overflow-hidden">
        {/* 工具栏 */}
        <div className="flex shrink-0 items-center gap-4 border-b border-[#3c3c3c] bg-[#252526] px-4 py-2 z-10 relative">
          {/* 文件名 */}
          <div className="flex-1">
            <span className="text-sm text-[#cccccc]">{fileName || "未选择"}</span>
          </div>

          {/* 图层控制 */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-[#808080]">图层:</span>
            <button
              className={`rounded px-2 py-1 text-xs ${
                showLayer1 ? "bg-[#0e639c] text-white" : "bg-[#3c3c3c] text-[#cccccc]"
              }`}
              onClick={() => setShowLayer1(!showLayer1)}
              title="地面层 (底层)"
            >
              L1
            </button>
            <button
              className={`rounded px-2 py-1 text-xs ${
                showLayer2 ? "bg-[#0e639c] text-white" : "bg-[#3c3c3c] text-[#cccccc]"
              }`}
              onClick={() => setShowLayer2(!showLayer2)}
              title="物体层 (中层)"
            >
              L2
            </button>
            <button
              className={`rounded px-2 py-1 text-xs ${
                showLayer3 ? "bg-[#0e639c] text-white" : "bg-[#3c3c3c] text-[#cccccc]"
              }`}
              onClick={() => setShowLayer3(!showLayer3)}
              title="顶层 (遮挡层)"
            >
              L3
            </button>
          </div>

          {/* 调试层控制 */}
          <div className="flex items-center gap-2">
            <button
              className={`rounded px-2 py-1 text-xs ${
                showObstacles ? "bg-red-600 text-white" : "bg-[#3c3c3c] text-[#cccccc]"
              }`}
              onClick={() => setShowObstacles(!showObstacles)}
              title="显示障碍物"
            >
              🚧
            </button>
            <button
              className={`rounded px-2 py-1 text-xs ${
                showTraps ? "bg-yellow-600 text-white" : "bg-[#3c3c3c] text-[#cccccc]"
              }`}
              onClick={() => setShowTraps(!showTraps)}
              title="显示陷阱"
            >
              ⚠️
            </button>
            <button
              className={`rounded px-2 py-1 text-xs ${
                showGrid ? "bg-[#0e639c] text-white" : "bg-[#3c3c3c] text-[#cccccc]"
              }`}
              onClick={() => setShowGrid(!showGrid)}
              title="显示网格"
            >
              #
            </button>
          </div>

          {/* 缩放控制 */}
          <div className="flex items-center gap-2">
            <button
              className="rounded px-2 py-1 text-xs bg-[#3c3c3c] text-[#cccccc] hover:bg-[#4c4c4c]"
              onClick={() => setZoom((z) => Math.max(0.1, z - 0.1))}
              title="缩小"
            >
              -
            </button>
            <span className="text-xs text-[#cccccc] w-12 text-center">
              {Math.round(zoom * 100)}%
            </span>
            <button
              className="rounded px-2 py-1 text-xs bg-[#3c3c3c] text-[#cccccc] hover:bg-[#4c4c4c]"
              onClick={() => setZoom((z) => Math.min(4, z + 0.1))}
              title="放大"
            >
              +
            </button>
            <select
              value={zoom}
              onChange={(e) => setZoom(Number(e.target.value))}
              className="rounded bg-[#3c3c3c] px-2 py-1 text-xs text-[#cccccc] border-none"
            >
              <option value={0.1}>10%</option>
              <option value={0.25}>25%</option>
              <option value={0.5}>50%</option>
              <option value={0.75}>75%</option>
              <option value={1}>100%</option>
              <option value={1.5}>150%</option>
              <option value={2}>200%</option>
              <option value={3}>300%</option>
              <option value={4}>400%</option>
            </select>
          </div>
        </div>

        {/* 主内容区 */}
        <div className="flex flex-1 min-h-0">
          {/* 地图画布区 */}
          <div
            ref={containerRef}
            className={`relative flex-1 min-w-0 overflow-hidden ${
              draggingMarkerRef.current !== null
                ? "cursor-crosshair"
                : hoveredMarkerRef.current !== null
                  ? "cursor-pointer"
                  : "cursor-grab active:cursor-grabbing"
            }`}
            onMouseDown={handleMouseDown}
            onMouseUp={handleMouseUp}
            onMouseMove={handleMouseMove}
            onMouseLeave={handleMouseLeave}
            onContextMenu={handleContextMenu}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
          >
            {/* 单 WebGL canvas: 地图 + 精灵 + 叠加层 */}
            <canvas
              ref={webglCanvasRef}
              className="absolute inset-0 w-full h-full"
              style={{ imageRendering: "pixelated" }}
            />

            {/* MPC 资源加载中（HTML overlay） */}
            {isMapLoading && (
              <div className="absolute inset-0 flex items-center justify-center bg-[#1a1a2e]/80 z-10">
                <div className="text-center">
                  <div className="text-white text-sm mb-2">
                    加载地图资源中... {Math.round(loadProgress * 100)}%
                  </div>
                  <div className="w-48 h-1 bg-[#333] rounded overflow-hidden mx-auto">
                    <div
                      className="h-full bg-[#0e639c] transition-all"
                      style={{ width: `${loadProgress * 100}%` }}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* 跟随鼠标的瓦片信息提示框（DOM ref 直接更新，不走 React 渲染） */}
            <div
              ref={tooltipRef}
              className="absolute pointer-events-none bg-[#1e1e1e]/90 border border-[#3c3c3c] rounded px-2 py-1.5 text-xs shadow-lg"
              style={{ display: "none" }}
            />
          </div>

          {/* 右侧面板（带 Tab） */}
          <div
            className={`${sidePanelTabs && sidePanelTabs.length > 0 ? "w-[420px]" : "w-64"} shrink-0 border-l border-[#3c3c3c] bg-[#252526] flex flex-col min-h-0 overflow-hidden`}
          >
            {/* Tab 栏 */}
            <div className="flex border-b border-[#3c3c3c] shrink-0 overflow-x-auto">
              {/* 仅在 sidePanelTabs 没有 map tab 时显示内置地图 tab */}
              {!sidePanelTabs?.some((t) => t.id === "map") && (
                <button
                  type="button"
                  onClick={() => handleTabChange("map")}
                  className={`px-3 py-1.5 text-xs transition-colors shrink-0 ${currentTabId === "map" ? "bg-[#1e1e1e] text-white border-t-2 border-[#0098ff]" : "text-[#858585] hover:text-[#cccccc]"}`}
                >
                  地图
                </button>
              )}
              {sidePanelTabs?.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => handleTabChange(tab.id)}
                  className={`px-3 py-1.5 text-xs transition-colors shrink-0 ${currentTabId === tab.id ? "bg-[#1e1e1e] text-white border-t-2 border-[#0098ff]" : "text-[#858585] hover:text-[#cccccc]"}`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Tab 内容 */}
            <div className="flex-1 flex flex-col min-h-0">
              {currentTabId === "map" && !sidePanelTabs?.some((t) => t.id === "map") && (
                <div className="flex-1 overflow-auto p-4">
                  {/* 地图信息 */}
                  <div className="mb-4">
                    <h3 className="mb-2 text-sm font-medium text-[#cccccc]">地图信息</h3>
                    <div className="space-y-1 text-xs text-[#808080]">
                      <div className="flex justify-between">
                        <span>尺寸:</span>
                        <span className="text-[#cccccc]">
                          {miuMapData.mapColumnCounts} × {miuMapData.mapRowCounts}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>像素尺寸:</span>
                        <span className="text-[#cccccc]">
                          {miuMapData.mapPixelWidth} × {miuMapData.mapPixelHeight}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>MSF 数量:</span>
                        <span className="text-[#cccccc]">{miuMapData.msfEntries.length}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>陷阱数:</span>
                        <span className="text-[#cccccc]">{miuMapData.trapTable.length}</span>
                      </div>
                    </div>
                  </div>

                  {/* 当前位置（DOM ref 直接更新） */}
                  <div className="mb-4">
                    <h3 className="mb-2 text-sm font-medium text-[#cccccc]">当前位置</h3>
                    <div className="space-y-1 text-xs text-[#808080]">
                      <div className="flex justify-between">
                        <span>像素:</span>
                        <span ref={panelCoordsRef} className="text-[#cccccc]">
                          (0, 0)
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>瓦片:</span>
                        <span ref={panelTileRef} className="text-[#cccccc]">
                          (0, 0)
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* 障碍类型图例 */}
                  {showObstacles && (
                    <div className="mb-4">
                      <h3 className="mb-2 text-sm font-medium text-[#cccccc]">障碍类型图例</h3>
                      <div className="space-y-1 text-xs">
                        <div className="flex items-center gap-2">
                          <span
                            className="w-4 h-4 rounded"
                            style={{ background: BARRIER_COLORS[0x80] }}
                          />
                          <span className="text-[#808080]">障碍物 Obstacle (0x80)</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span
                            className="w-4 h-4 rounded"
                            style={{ background: BARRIER_COLORS[0xa0] }}
                          />
                          <span className="text-[#808080]">可越过障碍 CanOverObstacle (0xA0)</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span
                            className="w-4 h-4 rounded"
                            style={{ background: BARRIER_COLORS[0x40] }}
                          />
                          <span className="text-[#808080]">传送点 Trans (0x40)</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span
                            className="w-4 h-4 rounded"
                            style={{ background: BARRIER_COLORS[0x60] }}
                          />
                          <span className="text-[#808080]">可越过传送点 CanOverTrans (0x60)</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span
                            className="w-4 h-4 rounded"
                            style={{ background: BARRIER_COLORS[0x20] }}
                          />
                          <span className="text-[#808080]">可越过 CanOver (0x20)</span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* MSF 文件列表 */}
                  <div>
                    <h3 className="mb-2 text-sm font-medium text-[#cccccc]">MSF 文件</h3>
                    <div className="max-h-40 overflow-y-auto space-y-1 text-xs">
                      {miuMapData.msfEntries.map((entry, index) => (
                        <div
                          key={index}
                          className="flex justify-between text-[#808080] hover:bg-[#3c3c3c] px-1 rounded"
                        >
                          <span className="text-[#569cd6]">[{index}]</span>
                          <span className="text-[#cccccc] truncate ml-2" title={entry.name}>
                            {entry.name}
                            {entry.looping ? " 🔁" : ""}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
              {sidePanelTabs?.map((tab) =>
                currentTabId === tab.id ? (
                  <div key={tab.id} className="flex-1 flex flex-col min-h-0">
                    {tab.content}
                  </div>
                ) : null
              )}
            </div>
          </div>
        </div>

        {/* 状态栏（坐标由 DOM ref 直接更新） */}
        <div className="flex shrink-0 h-6 items-center gap-4 border-t border-[#3c3c3c] bg-[#007acc] px-4 text-xs text-white">
          <span ref={statusCoordsRef}>坐标: (0, 0)</span>
          <span ref={statusTileRef}>瓦片: (0, 0)</span>
          <span>缩放: {Math.round(zoom * 100)}%</span>
          {isMapLoading && <span>加载中: {Math.round(loadProgress * 100)}%</span>}
        </div>
      </div>
    );
  })
);
