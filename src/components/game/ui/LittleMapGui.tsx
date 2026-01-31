/**
 * LittleMapGui Component - based on JxqyHD Engine/Gui/LittleMapGui.cs
 * Displays a mini map for navigation
 *
 * C# Reference: LittleMapGui.cs shows a scaled-down map with player/NPC positions
 * Resources:
 * - asf/ui/littlemap/panel.asf - main panel background
 * - asf/ui/littlemap/btnleft/right/up/down/close.asf - navigation buttons
 * - asf/ui/littlemap/主角坐标.asf - player marker
 * - asf/ui/littlemap/敌人坐标.asf - enemy marker
 * - asf/ui/littlemap/同伴坐标.asf - partner marker
 * - asf/ui/littlemap/路人坐标.asf - neutral NPC marker
 * - map/littlemap/*.png - pre-rendered minimap images
 *
 * Key concepts from C#:
 * - ViewWidth = 320, ViewHeight = 240 (the viewport size for the map)
 * - MapViewDrawBeginX = 160, MapViewDrawBeginY = 120 (where to draw the map view)
 * - Ratio = 4 (scale factor between world coordinates and minimap)
 * - Uses pre-rendered PNG images from map/littlemap/ directory
 */
import { ResourcePath } from "@/config";
import type React from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { logger } from "@/engine/core/logger";
import type { JxqyMapData } from "@/engine/core/mapTypes";
import type { Vector2 } from "@/engine/core/types";
import { GAME_FONTS } from "@/engine/gui/fonts";
import { type AsfAnimationData, useAsfAnimation, useAsfImage } from "./hooks";
import { useLittleMapGuiConfig } from "./useUISettings";

// C# Constants
const VIEW_WIDTH = 320;
const VIEW_HEIGHT = 240;
const MAP_VIEW_DRAW_BEGIN_X = 160;
const MAP_VIEW_DRAW_BEGIN_Y = 120;
const RATIO = 4;

// Character position info
export interface CharacterMarker {
  x: number; // World position X
  y: number; // World position Y
  type: "player" | "enemy" | "partner" | "neutral";
}

interface LittleMapGuiProps {
  isVisible: boolean;
  screenWidth: number;
  screenHeight: number;
  mapData: JxqyMapData | null;
  mapName: string;
  mapDisplayName?: string; // 地图显示名称（从 mapname.ini 获取）
  playerPosition: Vector2;
  characters: CharacterMarker[];
  cameraPosition: Vector2; // 当前相机位置
  onClose: () => void;
  onMapClick?: (worldPosition: Vector2) => void; // 点击地图移动
}

/**
 * 小地图按钮组件
 */
interface MapButtonProps {
  imagePath: string;
  left: number;
  top: number;
  onClick: () => void;
  onMouseDown?: () => void;
  onMouseUp?: () => void;
}

const MapButton: React.FC<MapButtonProps> = ({
  imagePath,
  left,
  top,
  onClick,
  onMouseDown,
  onMouseUp,
}) => {
  const [isPressed, setIsPressed] = useState(false);
  const normalImage = useAsfImage(imagePath, 0);
  const pressedImage = useAsfImage(imagePath, 1);

  const handleMouseDown = useCallback(() => {
    setIsPressed(true);
    onMouseDown?.();
  }, [onMouseDown]);

  const handleMouseUp = useCallback(() => {
    setIsPressed(false);
    onMouseUp?.();
  }, [onMouseUp]);

  const currentImage = isPressed && pressedImage.dataUrl ? pressedImage : normalImage;

  return (
    <div
      style={{
        position: "absolute",
        left,
        top,
        cursor: "pointer",
      }}
      onClick={onClick}
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      {currentImage.dataUrl && (
        <img
          src={currentImage.dataUrl}
          alt=""
          style={{
            imageRendering: "pixelated",
            pointerEvents: "none",
          }}
          draggable={false}
        />
      )}
    </div>
  );
};

export const LittleMapGui: React.FC<LittleMapGuiProps> = ({
  isVisible,
  screenWidth,
  screenHeight,
  mapData,
  mapName,
  mapDisplayName,
  playerPosition,
  characters,
  cameraPosition,
  onClose,
  onMapClick,
}) => {
  // 从 UI_Settings.ini 加载配置
  const config = useLittleMapGuiConfig();

  // 加载面板背景
  const panelImage = useAsfImage(config?.panel.image || "asf/ui/littlemap/panel.asf");

  // 加载角色标记动画
  const playerMarker = useAsfAnimation("asf/ui/littlemap/主角坐标.asf");
  const enemyMarker = useAsfAnimation("asf/ui/littlemap/敌人坐标.asf");
  const partnerMarker = useAsfAnimation("asf/ui/littlemap/同伴坐标.asf");
  const neutralMarker = useAsfAnimation("asf/ui/littlemap/路人坐标.asf");

  // 加载预渲染的小地图 PNG 图片
  const [littleMapImage, setLittleMapImage] = useState<HTMLImageElement | null>(null);
  const [littleMapSize, setLittleMapSize] = useState<{ width: number; height: number }>({ width: 0, height: 0 });

  useEffect(() => {
    if (!mapName || !isVisible) return;

    // 构建小地图 PNG 路径: map/littlemap/mapName.png
    // mapName 格式可能是 "map_012_惠安镇" 或带有路径前缀
    const baseName = mapName.replace(/^map[\/\\]/, "").replace(/\.map$/i, "");
    const pngPath = ResourcePath.map(`littlemap/${baseName}.png`);

    logger.debug(`[LittleMapGui] 加载小地图图片: ${pngPath}`);

    const img = new Image();
    img.onload = () => {
      setLittleMapImage(img);
      setLittleMapSize({ width: img.width, height: img.height });
      logger.debug(`[LittleMapGui] 小地图图片加载成功: ${img.width}x${img.height}`);
    };
    img.onerror = () => {
      logger.warn(`[LittleMapGui] 小地图图片加载失败: ${pngPath}`);
      setLittleMapImage(null);
      setLittleMapSize({ width: 0, height: 0 });
    };
    img.src = pngPath;

    return () => {
      img.onload = null;
      img.onerror = null;
    };
  }, [mapName, isVisible]);

  // 小地图视口偏移
  const [viewBeginX, setViewBeginX] = useState(0);
  const [viewBeginY, setViewBeginY] = useState(0);

  // 显示移动失败消息
  const [showMoveError, setShowMoveError] = useState(false);

  // Canvas ref for drawing
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // 计算地图缩略图尺寸 - 使用预渲染图片尺寸，或根据地图数据计算
  const mapSize = useMemo(() => {
    // 优先使用预渲染图片尺寸
    if (littleMapSize.width > 0 && littleMapSize.height > 0) {
      return littleMapSize;
    }
    // 备用：根据地图数据计算
    if (mapData) {
      return {
        width: Math.floor(mapData.mapPixelWidth / RATIO),
        height: Math.floor(mapData.mapPixelHeight / RATIO),
      };
    }
    return { width: 0, height: 0 };
  }, [littleMapSize, mapData]);

  // 标记是否已初始化视口位置（只在打开时初始化一次）
  const [viewInitialized, setViewInitialized] = useState(false);

  // 初始化视口位置：只在小地图刚打开时执行一次
  // C# 参考: ViewBeginX = MapBase.Instance.ViewBeginX / Ratio
  useEffect(() => {
    if (!isVisible) {
      // 关闭时重置初始化标记
      setViewInitialized(false);
      return;
    }

    if (viewInitialized || mapSize.width === 0) return;

    // 使用相机位置初始化视口（与 C# 一致）
    // C# 中 MapBase.Instance.ViewBeginX 就是相机左上角位置
    const initialX = Math.floor(cameraPosition.x / RATIO);
    const initialY = Math.floor(cameraPosition.y / RATIO);

    // 限制边界
    const maxX = Math.max(0, mapSize.width - VIEW_WIDTH);
    const maxY = Math.max(0, mapSize.height - VIEW_HEIGHT);

    setViewBeginX(Math.max(0, Math.min(maxX, initialX)));
    setViewBeginY(Math.max(0, Math.min(maxY, initialY)));
    setViewInitialized(true);
  }, [isVisible, viewInitialized, cameraPosition.x, cameraPosition.y, mapSize.width, mapSize.height]);

  // 按钮点击用的导航函数（单次移动）
  const BUTTON_MOVE_STEP = 16;
  const moveLeft = useCallback(() => {
    setViewBeginX((prev) => Math.max(0, prev - BUTTON_MOVE_STEP));
  }, []);
  const moveRight = useCallback(() => {
    setViewBeginX((prev) => Math.min(mapSize.width - VIEW_WIDTH, prev + BUTTON_MOVE_STEP));
  }, [mapSize.width]);
  const moveUp = useCallback(() => {
    setViewBeginY((prev) => Math.max(0, prev - BUTTON_MOVE_STEP));
  }, []);
  const moveDown = useCallback(() => {
    setViewBeginY((prev) => Math.min(mapSize.height - VIEW_HEIGHT, prev + BUTTON_MOVE_STEP));
  }, [mapSize.height]);

  // 键盘导航状态 - 记录当前按下的方向键
  const keysPressed = useRef<Set<string>>(new Set());

  // 平滑移动速度（每帧像素）
  const KEY_MOVE_SPEED = 4;

  // 鼠标拖拽状态
  const isDragging = useRef(false);
  const hasDragged = useRef(false); // 是否真的发生了拖拽（移动超过阈值）
  const dragStartPos = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const dragStartView = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const DRAG_THRESHOLD = 3; // 移动超过 3 像素才算拖拽

  // 键盘导航 - 使用 requestAnimationFrame 实现平滑持续移动
  useEffect(() => {
    if (!isVisible) return;

    let animationFrameId: number;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key)) {
        e.preventDefault();
        keysPressed.current.add(e.key);
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      keysPressed.current.delete(e.key);
    };

    const updatePosition = () => {
      const keys = keysPressed.current;

      if (keys.has("ArrowUp")) {
        setViewBeginY((prev) => Math.max(0, prev - KEY_MOVE_SPEED));
      }
      if (keys.has("ArrowDown")) {
        setViewBeginY((prev) => Math.min(mapSize.height - VIEW_HEIGHT, prev + KEY_MOVE_SPEED));
      }
      if (keys.has("ArrowLeft")) {
        setViewBeginX((prev) => Math.max(0, prev - KEY_MOVE_SPEED));
      }
      if (keys.has("ArrowRight")) {
        setViewBeginX((prev) => Math.min(mapSize.width - VIEW_WIDTH, prev + KEY_MOVE_SPEED));
      }

      animationFrameId = requestAnimationFrame(updatePosition);
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    animationFrameId = requestAnimationFrame(updatePosition);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      cancelAnimationFrame(animationFrameId);
      keysPressed.current.clear();
    };
  }, [isVisible, mapSize.width, mapSize.height]);

  // 绘制小地图
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !isVisible) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // 清空画布
    ctx.fillStyle = "#1a1a2e";
    ctx.fillRect(0, 0, VIEW_WIDTH, VIEW_HEIGHT);

    // 绘制预渲染的小地图图片
    if (littleMapImage) {
      // 从图片中裁剪视口区域并绘制
      ctx.drawImage(
        littleMapImage,
        viewBeginX, viewBeginY, VIEW_WIDTH, VIEW_HEIGHT, // 源区域
        0, 0, VIEW_WIDTH, VIEW_HEIGHT // 目标区域
      );
    } else {
      // 显示加载中占位符
      ctx.fillStyle = "#333";
      ctx.fillRect(0, 0, VIEW_WIDTH, VIEW_HEIGHT);
      ctx.fillStyle = "#888";
      ctx.font = "14px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("加载中...", VIEW_WIDTH / 2, VIEW_HEIGHT / 2);
    }

    // 绘制角色标记
    const drawMarker = (
      worldX: number,
      worldY: number,
      markerData: AsfAnimationData,
      fallbackColor: string
    ) => {
      // 检查是否在视口内
      const mapX = worldX / RATIO;
      const mapY = worldY / RATIO;

      if (
        mapX >= viewBeginX &&
        mapX < viewBeginX + VIEW_WIDTH &&
        mapY >= viewBeginY &&
        mapY < viewBeginY + VIEW_HEIGHT
      ) {
        const canvasX = mapX - viewBeginX;
        const canvasY = mapY - viewBeginY;

        if (markerData.asf && markerData.asf.frames.length > 0) {
          // 使用 ASF 帧绘制
          const frame = markerData.asf.frames[markerData.frameIndex % markerData.asf.frames.length];
          if (frame && frame.imageData) {
            const tempCanvas = document.createElement('canvas');
            tempCanvas.width = frame.imageData.width;
            tempCanvas.height = frame.imageData.height;
            const tempCtx = tempCanvas.getContext('2d');
            if (tempCtx) {
              tempCtx.putImageData(frame.imageData, 0, 0);
              ctx.drawImage(tempCanvas, canvasX - frame.imageData.width / 2, canvasY - frame.imageData.height / 2);
            }
          }
        } else {
          // 备用：绘制圆点
          ctx.fillStyle = fallbackColor;
          ctx.beginPath();
          ctx.arc(canvasX, canvasY, 3, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    };

    // 绘制 NPCs
    for (const char of characters) {
      switch (char.type) {
        case "enemy":
          drawMarker(char.x, char.y, enemyMarker, "#ff4444");
          break;
        case "partner":
          drawMarker(char.x, char.y, partnerMarker, "#44ff44");
          break;
        case "neutral":
          drawMarker(char.x, char.y, neutralMarker, "#aaaaaa");
          break;
      }
    }

    // 绘制玩家
    drawMarker(playerPosition.x, playerPosition.y, playerMarker, "#ffff44");
  }, [
    isVisible,
    littleMapImage,
    mapData,
    viewBeginX,
    viewBeginY,
    characters,
    playerPosition,
    playerMarker,
    enemyMarker,
    partnerMarker,
    neutralMarker,
  ]);

  // 处理点击地图移动
  const handleCanvasClick = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      // 如果发生了拖拽，不触发点击事件
      if (hasDragged.current) return;
      if (!onMapClick || !mapData) return;

      const canvas = canvasRef.current;
      if (!canvas) return;

      const rect = canvas.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const clickY = e.clientY - rect.top;

      // 转换到世界坐标
      const worldX = (clickX + viewBeginX) * RATIO;
      const worldY = (clickY + viewBeginY) * RATIO;

      onMapClick({ x: worldX, y: worldY });
    },
    [onMapClick, mapData, viewBeginX, viewBeginY]
  );

  // 鼠标拖拽处理
  const handleCanvasMouseDown = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      isDragging.current = true;
      hasDragged.current = false; // 重置拖拽标记
      dragStartPos.current = { x: e.clientX, y: e.clientY };
      dragStartView.current = { x: viewBeginX, y: viewBeginY };
      e.preventDefault();
    },
    [viewBeginX, viewBeginY]
  );

  const handleCanvasMouseMove = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (!isDragging.current) return;

      const deltaX = dragStartPos.current.x - e.clientX;
      const deltaY = dragStartPos.current.y - e.clientY;

      // 检查是否超过拖拽阈值
      if (!hasDragged.current) {
        const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
        if (distance < DRAG_THRESHOLD) return;
        hasDragged.current = true;
      }

      const newX = dragStartView.current.x + deltaX;
      const newY = dragStartView.current.y + deltaY;

      // 限制边界
      const maxX = Math.max(0, mapSize.width - VIEW_WIDTH);
      const maxY = Math.max(0, mapSize.height - VIEW_HEIGHT);

      setViewBeginX(Math.max(0, Math.min(maxX, newX)));
      setViewBeginY(Math.max(0, Math.min(maxY, newY)));
    },
    [mapSize.width, mapSize.height]
  );

  const handleCanvasMouseUp = useCallback(() => {
    isDragging.current = false;
  }, []);

  const handleCanvasMouseLeave = useCallback(() => {
    isDragging.current = false;
  }, []);

  // 计算面板位置 - 水平和垂直都居中
  const panelStyle = useMemo(() => {
    if (!config || !panelImage.width) return null;
    const panelWidth = panelImage.width;
    const panelHeight = panelImage.height || 420;

    return {
      position: "absolute" as const,
      left: (screenWidth - panelWidth) / 2,
      top: (screenHeight - panelHeight) / 2,
      width: panelWidth,
      height: panelHeight,
      pointerEvents: "auto" as const,
      zIndex: 1000,
    };
  }, [screenWidth, screenHeight, config, panelImage.width, panelImage.height]);

  // 地图名称显示
  const displayName = mapDisplayName || mapName || "无名地图";

  if (!isVisible || !config || !panelStyle) return null;

  // 文本对齐样式
  const getTextAlign = (align: number): "left" | "center" | "right" => {
    switch (align) {
      case 0:
        return "left";
      case 1:
        return "center";
      case 2:
        return "right";
      default:
        return "left";
    }
  };

  return (
    <div
      style={panelStyle}
      onClick={(e) => e.stopPropagation()}
    >
      {/* 背景面板 */}
      {panelImage.dataUrl && (
        <img
          src={panelImage.dataUrl}
          alt="小地图面板"
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            width: panelImage.width,
            height: panelImage.height,
            imageRendering: "pixelated",
            pointerEvents: "none",
          }}
        />
      )}

      {/* 地图名称 */}
      <div
        style={{
          position: "absolute",
          left: config.mapNameText.left,
          top: config.mapNameText.top - 8, // 上移 8px
          width: config.mapNameText.width,
          height: config.mapNameText.height,
          textAlign: getTextAlign(config.mapNameText.align),
          color: config.mapNameText.color,
          fontFamily: GAME_FONTS.primary,
          fontSize: 16, // 字体加大
          fontWeight: "bold", // 加粗
          lineHeight: `${config.mapNameText.height}px`,
          pointerEvents: "none",
        }}
      >
        {displayName}
      </div>

      {/* 地图画布 */}
      <canvas
        ref={canvasRef}
        width={VIEW_WIDTH}
        height={VIEW_HEIGHT}
        style={{
          position: "absolute",
          left: MAP_VIEW_DRAW_BEGIN_X,
          top: MAP_VIEW_DRAW_BEGIN_Y,
          cursor: isDragging.current ? "grabbing" : "grab",
          imageRendering: "pixelated",
        }}
        onClick={handleCanvasClick}
        onMouseDown={handleCanvasMouseDown}
        onMouseMove={handleCanvasMouseMove}
        onMouseUp={handleCanvasMouseUp}
        onMouseLeave={handleCanvasMouseLeave}
      />

      {/* 导航按钮 */}
      <MapButton
        imagePath={config.leftBtn.image}
        left={config.leftBtn.left}
        top={config.leftBtn.top}
        onClick={moveLeft}
      />
      <MapButton
        imagePath={config.rightBtn.image}
        left={config.rightBtn.left}
        top={config.rightBtn.top}
        onClick={moveRight}
      />
      <MapButton
        imagePath={config.upBtn.image}
        left={config.upBtn.left}
        top={config.upBtn.top}
        onClick={moveUp}
      />
      <MapButton
        imagePath={config.downBtn.image}
        left={config.downBtn.left}
        top={config.downBtn.top}
        onClick={moveDown}
      />
      <MapButton
        imagePath={config.closeBtn.image}
        left={config.closeBtn.left}
        top={config.closeBtn.top}
        onClick={onClose}
      />

      {/* 底部提示 */}
      <div
        style={{
          position: "absolute",
          left: config.bottomTipText.left,
          top: config.bottomTipText.top,
          width: config.bottomTipText.width,
          height: config.bottomTipText.height,
          textAlign: getTextAlign(config.bottomTipText.align),
          color: config.bottomTipText.color,
          fontFamily: GAME_FONTS.system,
          fontSize: 10,
          lineHeight: `${config.bottomTipText.height}px`,
          pointerEvents: "none",
        }}
      >
        点击小地图进行移动
      </div>

      {/* 移动失败消息 */}
      {showMoveError && (
        <div
          style={{
            position: "absolute",
            left: config.messageTipText.left,
            top: config.messageTipText.top,
            width: config.messageTipText.width,
            height: config.messageTipText.height,
            textAlign: getTextAlign(config.messageTipText.align),
            color: config.messageTipText.color,
            fontFamily: GAME_FONTS.system,
            fontSize: 10,
            lineHeight: `${config.messageTipText.height}px`,
            pointerEvents: "none",
          }}
        >
          无法移动到目的地
        </div>
      )}
    </div>
  );
};
