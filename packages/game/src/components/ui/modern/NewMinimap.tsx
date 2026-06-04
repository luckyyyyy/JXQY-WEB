/**
 * NewMinimap - 现代风格小地图（真实地形渲染版）
 *
 * - 16:9 毛玻璃面板，居中显示
 * - 摄像机跟随玩家（蓝点永远居中），不跑出地图边缘
 * - 拖拽时冻结跟随，松手后等玩家移动才回弹
 * - 滚轮缩放
 * - 点击地图寻路
 * - 鼠标悬停显示瓦片坐标
 * - 角色标记：敌人=红，友方NPC=黄，玩家=蓝
 */

import type { Vector2 } from "@miu2d/engine/core/types";
import { pixelToTile } from "@miu2d/engine/utils/coordinate";
import type React from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { CharacterMarker } from "../classic/LittleMapGui";
import { GlassPanel, PanelHeader } from "./components";
import { modernColors, spacing, typography, zIndex } from "./theme";

// ============= Constants =============

const CANVAS_W = 640;
const CANVAS_H = 360;
const DRAG_THRESHOLD = 5;
const DEFAULT_ZOOM = 5;
const MIN_ZOOM = 0.5;
const MAX_ZOOM = 20;
const ZOOM_STEP = 1.15;

// Persistent zoom across open/close
let _savedZoom = DEFAULT_ZOOM;

// ============= Helpers =============

function computeFollowOffset(
  mc: HTMLCanvasElement,
  mco: { x: number; y: number },
  pp: Vector2,
  ds: number
): { x: number; y: number } {
  const pdx = (pp.x + mco.x) * ds;
  const pdy = (pp.y + mco.y) * ds;
  const mw = mc.width * ds;
  const mh = mc.height * ds;
  let ox = CANVAS_W / 2 - pdx;
  let oy = CANVAS_H / 2 - pdy;
  if (mw <= CANVAS_W) ox = (CANVAS_W - mw) / 2;
  else ox = Math.min(0, Math.max(CANVAS_W - mw, ox));
  if (mh <= CANVAS_H) oy = (CANVAS_H - mh) / 2;
  else oy = Math.min(0, Math.max(CANVAS_H - mh, oy));
  return { x: ox, y: oy };
}

function clampOffset(
  o: { x: number; y: number },
  mw: number,
  mh: number
): { x: number; y: number } {
  let { x, y } = o;
  if (mw <= CANVAS_W) x = (CANVAS_W - mw) / 2;
  else x = Math.min(0, Math.max(CANVAS_W - mw, x));
  if (mh <= CANVAS_H) y = (CANVAS_H - mh) / 2;
  else y = Math.min(0, Math.max(CANVAS_H - mh, y));
  return { x, y };
}

// ============= Component =============

interface NewMinimapProps {
  mapData: import("@miu2d/engine/map/types").MiuMapData | null;
  mapName: string;
  mapDisplayName: string;
  playerPosition: Vector2;
  characters: CharacterMarker[];
  minimapCanvas: HTMLCanvasElement | null;
  minimapCanvasOffset: { x: number; y: number } | null;
  onClose: () => void;
  onMapClick: (worldX: number, worldY: number) => void;
}

export const NewMinimap: React.FC<NewMinimapProps> = ({
  mapData,
  mapName,
  mapDisplayName,
  playerPosition,
  characters,
  minimapCanvas,
  minimapCanvasOffset,
  onClose,
  onMapClick,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Drag
  const isDragging = useRef(false);
  const dragStart = useRef({ x: 0, y: 0 });
  const dragStartVO = useRef({ x: 0, y: 0 });
  const dragDistance = useRef(0);

  const [viewOffset, setViewOffset] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(_savedZoom);
  useEffect(() => { _savedZoom = zoom; }, [zoom]);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });
  const [tooltipText, setTooltipText] = useState<string | null>(null);

  // Mouse position on canvas (for tile highlight)
  const [mouseCanvasPos, setMouseCanvasPos] = useState<{ x: number; y: number } | null>(null);
  // Hovered character
  const [hoverChar, setHoverChar] = useState<CharacterMarker | null>(null);

  const baseScale = useMemo(() => {
    if (!minimapCanvas) return 1;
    return Math.min(CANVAS_W / minimapCanvas.width, CANVAS_H / minimapCanvas.height);
  }, [minimapCanvas]);

  const displayScale = baseScale * zoom;

  // CSS-to-canvas ratio (canvas is width:100% so CSS size may differ from internal size)
  // Computed per-call to handle layout changes
  const getCssRatio = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return 1;
    const rect = canvas.getBoundingClientRect();
    return rect.width > 0 ? CANVAS_W / rect.width : 1;
  }, []);

  // Center on player ONLY once when minimap opens
  const didInitCenter = useRef(false);
  useEffect(() => {
    if (!minimapCanvas || !minimapCanvasOffset || didInitCenter.current) return;
    didInitCenter.current = true;
    const follow = computeFollowOffset(
      minimapCanvas,
      minimapCanvasOffset,
      playerPosition,
      displayScale
    );
    setViewOffset(follow);
  }, [minimapCanvas, minimapCanvasOffset]);

  // Reset on map change
  useEffect(() => {
    didInitCenter.current = false;
  }, [minimapCanvas]);

  // ============= Canvas Rendering =============

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !minimapCanvas || !minimapCanvasOffset || !mapData) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);

    const drawW = minimapCanvas.width * displayScale;
    const drawH = minimapCanvas.height * displayScale;
    ctx.drawImage(minimapCanvas, viewOffset.x, viewOffset.y, drawW, drawH);

    const toX = (wx: number) =>
      (wx + minimapCanvasOffset.x) * displayScale + viewOffset.x;
    const toY = (wy: number) =>
      (wy + minimapCanvasOffset.y) * displayScale + viewOffset.y;
    const fromCanvas = (cx: number, cy: number) => ({
      x: (cx - viewOffset.x) / displayScale - minimapCanvasOffset.x,
      y: (cy - viewOffset.y) / displayScale - minimapCanvasOffset.y,
    });

    // Tile highlight under mouse (diamond shape, same as scene editor)
    if (mouseCanvasPos && mapData) {
      const world = fromCanvas(mouseCanvasPos.x, mouseCanvasPos.y);
      const tile = pixelToTile(world.x, world.y);
      if (
        tile.x >= 0 && tile.x < mapData.mapColumnCounts &&
        tile.y >= 0 && tile.y < mapData.mapRowCounts
      ) {
        // Use same formula as renderMapToOffscreen for tile world position
        const tileWorldX = (tile.y % 2) * 32 + 64 * tile.x;
        const tileWorldY = 16 * tile.y;
        // Convert to canvas coords using the same toX/toY as character rendering
        const cx = toX(tileWorldX);
        const cy = toY(tileWorldY);
        // Diamond: 64x32, centered at (cx, cy), offset down by half-height
        // Scene editor draws at (pixelPos.x - 32, pixelPos.y - 16), so center = pixelPos
        const dw = 32 * displayScale;
        const dh = 16 * displayScale;
        ctx.beginPath();
        ctx.moveTo(cx, cy - dh);          // top
        ctx.lineTo(cx + dw, cy);          // right
        ctx.lineTo(cx, cy + dh);          // bottom
        ctx.lineTo(cx - dw, cy);          // left
        ctx.closePath();
        ctx.fillStyle = "rgba(255, 255, 255, 0.25)";
        ctx.fill();
        ctx.strokeStyle = "rgba(255, 255, 255, 0.8)";
        ctx.lineWidth = 1;
        ctx.stroke();
      }
    }

    // Characters (circles)
    for (const c of characters) {
      const cx = toX(c.x);
      const cy = toY(c.y);
      if (cx < -10 || cx > CANVAS_W + 10 || cy < -10 || cy > CANVAS_H + 10) continue;
      const isHovered = hoverChar === c;
      const radius = isHovered ? 5 : 3;
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.fillStyle =
        c.type === "enemy"
          ? "#ff2222"
          : c.type === "partner"
            ? "#00ffff"
            : "#ffff00";
      ctx.fill();
      if (isHovered) {
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }
    }

    // Player (circle, blue)
    const px = toX(playerPosition.x);
    const py = toY(playerPosition.y);
    ctx.beginPath();
    ctx.arc(px, py, 4, 0, Math.PI * 2);
    ctx.fillStyle = "#00aaff";
    ctx.fill();
  }, [
    minimapCanvas,
    minimapCanvasOffset,
    mapData,
    displayScale,
    viewOffset,
    playerPosition,
    characters,
    mouseCanvasPos,
    hoverChar,
  ]);

  // ============= Coordinate helpers =============

  const canvasToWorld = useCallback(
    (canvasX: number, canvasY: number): Vector2 | null => {
      if (!minimapCanvasOffset) return null;
      return {
        x: (canvasX - viewOffset.x) / displayScale - minimapCanvasOffset.x,
        y: (canvasY - viewOffset.y) / displayScale - minimapCanvasOffset.y,
      };
    },
    [minimapCanvasOffset, displayScale, viewOffset]
  );

  /** Convert mouse event coords to canvas-internal coords */
  const mouseToCanvas = useCallback(
    (e: React.MouseEvent): { x: number; y: number } => {
      const canvas = canvasRef.current;
      if (!canvas) return { x: 0, y: 0 };
      const rect = canvas.getBoundingClientRect();
      const ratio = rect.width > 0 ? CANVAS_W / rect.width : 1;
      return {
        x: (e.clientX - rect.left) * ratio,
        y: (e.clientY - rect.top) * ratio,
      };
    },
    []
  );

  // ============= Wheel zoom =============

  const handleWheel = useCallback(
    (e: React.WheelEvent<HTMLCanvasElement>) => {
      e.preventDefault();
      if (!minimapCanvas) return;

      const { x: mx, y: my } = mouseToCanvas(e);
      const oldZoom = zoom;
      const newZoom =
        e.deltaY < 0
          ? Math.min(MAX_ZOOM, oldZoom * ZOOM_STEP)
          : Math.max(MIN_ZOOM, oldZoom / ZOOM_STEP);
      if (newZoom === oldZoom) return;

      const oldScale = baseScale * oldZoom;
      const newScale = baseScale * newZoom;
      const wx = (mx - viewOffset.x) / oldScale;
      const wy = (my - viewOffset.y) / oldScale;

      const mw = minimapCanvas.width * newScale;
      const mh = minimapCanvas.height * newScale;
      setViewOffset(clampOffset({ x: mx - wx * newScale, y: my - wy * newScale }, mw, mh));
      setZoom(newZoom);
    },
    [zoom, baseScale, viewOffset, minimapCanvas, mouseToCanvas]
  );

  // ============= Drag =============

  const handleMouseDown = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      isDragging.current = true;
      dragStart.current = { x: e.clientX, y: e.clientY };
      dragStartVO.current = { ...viewOffset };
      dragDistance.current = 0;
      e.preventDefault();
    },
    [viewOffset]
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      // Tooltip
      if (!isDragging.current) {
        const { x: cx, y: cy } = mouseToCanvas(e);
        setMouseCanvasPos({ x: cx, y: cy });

        // Check character hover
        let found: CharacterMarker | null = null;
        for (const c of characters) {
          const cdx = (c.x + minimapCanvasOffset!.x) * displayScale + viewOffset.x;
          const cdy = (c.y + minimapCanvasOffset!.y) * displayScale + viewOffset.y;
          const dist = Math.sqrt((cx - cdx) ** 2 + (cy - cdy) ** 2);
          if (dist < 8) {
            found = c;
            break;
          }
        }
        setHoverChar(found);

        const world = canvasToWorld(cx, cy);
        if (found && found.name) {
          setTooltipPos({ x: e.clientX, y: e.clientY });
          setTooltipText(found.name);
        } else if (world && mapData) {
          const tile = pixelToTile(world.x, world.y);
          if (
            tile.x >= 0 &&
            tile.x < mapData.mapColumnCounts &&
            tile.y >= 0 &&
            tile.y < mapData.mapRowCounts
          ) {
            setTooltipPos({ x: e.clientX, y: e.clientY });
            setTooltipText(`坐标: (${tile.x}, ${tile.y})`);
          } else {
            setTooltipText(null);
          }
        } else {
          setTooltipText(null);
        }
        return;
      }

      // Dragging
      const ratio = getCssRatio();
      const dx = (e.clientX - dragStart.current.x) * ratio;
      const dy = (e.clientY - dragStart.current.y) * ratio;
      dragDistance.current = Math.sqrt(dx * dx + dy * dy) / ratio;

      if (minimapCanvas) {
        const mw = minimapCanvas.width * displayScale;
        const mh = minimapCanvas.height * displayScale;
        setViewOffset(
          clampOffset(
            { x: dragStartVO.current.x + dx, y: dragStartVO.current.y + dy },
            mw,
            mh
          )
        );
      }
    },
    [getCssRatio, mouseToCanvas, canvasToWorld, mapData, minimapCanvas, displayScale, minimapCanvasOffset, characters, viewOffset]
  );

  const handleMouseUp = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (!isDragging.current) return;
      isDragging.current = false;
      setTooltipText(null);

      if (dragDistance.current < DRAG_THRESHOLD) {
        const { x: cx, y: cy } = mouseToCanvas(e);
        const world = canvasToWorld(cx, cy);
        if (world) onMapClick(world.x, world.y);
      }
    },
    [canvasToWorld, mouseToCanvas, onMapClick]
  );

  const handleMouseLeave = useCallback(() => {
    isDragging.current = false;
    setTooltipText(null);
    setMouseCanvasPos(null);
    setHoverChar(null);
  }, []);

  // ============= Display =============

  if (!mapData || !minimapCanvas) return null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        pointerEvents: "none",
        zIndex: zIndex.modal,
      }}
    >
      <GlassPanel
        variant="dark"
        style={{
          pointerEvents: "auto",
          display: "flex",
          flexDirection: "column",
          width: CANVAS_W + spacing.md * 2,
          height: CANVAS_H + 36, // 36 = header height
        }}
      >
        <PanelHeader title={mapDisplayName} onClose={onClose} />

        <canvas
          ref={canvasRef}
          width={CANVAS_W}
          height={CANVAS_H}
          style={{
            flex: 1,
            width: "100%",
            height: "100%",
            imageRendering: "auto",
            cursor: "grab",
            display: "block",
          }}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseLeave}
          onWheel={handleWheel}
        />

      </GlassPanel>

      {/* Tooltip - outside GlassPanel to avoid transform/overflow issues */}
      {tooltipText && (
        <div
          style={{
            position: "fixed",
            left: tooltipPos.x + 15,
            top: tooltipPos.y + 15,
            padding: `${spacing.xs}px ${spacing.sm}px`,
            background: modernColors.bg.glassDark,
            border: `1px solid ${modernColors.border.glass}`,
            borderRadius: 4,
            fontSize: typography.fontSize.sm,
            color: modernColors.text.primary,
            fontFamily: typography.fontFamily,
            pointerEvents: "none",
            whiteSpace: "nowrap",
            zIndex: zIndex.tooltip,
          }}
        >
          {tooltipText}
        </div>
      )}
    </div>
  );
};
