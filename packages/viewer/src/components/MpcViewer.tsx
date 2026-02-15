/**
 * MPC 预览组件
 *
 * 视图模式：
 * 1. 拼图模式：将所有帧按指定列数排列展示（方便一次性查看所有帧）
 * 2. 网格模式：缩略图网格 + 详情面板
 *
 * **注意：拼图模式的排列方式由用户指定，与地图中的实际排列无关！**
 * 地图文件 (.map) 包含 layer1/layer2/layer3 数组，
 * 通过 {mpcIndex, frame} 引用 MPC 帧，每个地图位置可以引用任意帧。
 */

import type { Mpc } from "@miu2d/engine/map/types";
import { useEffect, useMemo, useRef, useState } from "react";

interface MpcViewerProps {
  /** MPC 数据 */
  mpc: Mpc | null;
  /** 文件名 */
  fileName?: string;
  /** 是否正在加载 */
  isLoading?: boolean;
  /** 错误信息 */
  error?: string | null;
}

type ViewMode = "puzzle" | "grid";

export function MpcViewer({ mpc, fileName, isLoading, error }: MpcViewerProps) {
  // 视图模式
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  // 选中的帧（网格模式用）
  const [selectedFrame, setSelectedFrame] = useState<number>(0);
  // 缩略图大小（网格模式用）
  const [thumbnailSize, setThumbnailSize] = useState<number>(64);
  // 预览缩放（网格模式用）
  const [previewZoom, setPreviewZoom] = useState<number>(2);
  // 显示帧号
  const [showFrameNumbers, setShowFrameNumbers] = useState<boolean>(true);
  // 拼图列数（0 = 自动）
  const [puzzleColumns, setPuzzleColumns] = useState<number>(0);
  // 拼图缩放
  const [puzzleZoom, setPuzzleZoom] = useState<number>(1);

  // Canvas refs
  const puzzleCanvasRef = useRef<HTMLCanvasElement>(null);
  const previewCanvasRef = useRef<HTMLCanvasElement>(null);

  // 自动计算最佳列数
  const autoColumns = useMemo(() => {
    if (!mpc || mpc.frames.length === 0) return 1;

    const frameCount = mpc.frames.length;

    // 如果帧数能开方，用正方形
    const sqrt = Math.sqrt(frameCount);
    if (Number.isInteger(sqrt)) return sqrt;

    // 尝试找最接近正方形的因子
    for (let i = Math.ceil(sqrt); i <= frameCount; i++) {
      if (frameCount % i === 0) return i;
    }

    // 默认用接近正方形的列数
    return Math.ceil(sqrt);
  }, [mpc]);

  const actualColumns = puzzleColumns === 0 ? autoColumns : puzzleColumns;

  // 绘制拼图
  useEffect(() => {
    const canvas = puzzleCanvasRef.current;
    if (!canvas || !mpc || mpc.frames.length === 0 || viewMode !== "puzzle") return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const cols = actualColumns;
    const rows = Math.ceil(mpc.frames.length / cols);

    // 计算每帧的最大尺寸（用于对齐）
    let maxFrameWidth = 0;
    let maxFrameHeight = 0;
    for (const frame of mpc.frames) {
      maxFrameWidth = Math.max(maxFrameWidth, frame.width);
      maxFrameHeight = Math.max(maxFrameHeight, frame.height);
    }

    // 设置 canvas 大小
    const canvasWidth = cols * maxFrameWidth * puzzleZoom;
    const canvasHeight = rows * maxFrameHeight * puzzleZoom;
    canvas.width = canvasWidth;
    canvas.height = canvasHeight;

    // 绘制棋盘格背景
    const gridSize = 8 * puzzleZoom;
    ctx.fillStyle = "#1e1e1e";
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);
    ctx.fillStyle = "#2d2d2d";
    for (let x = 0; x < canvasWidth; x += gridSize * 2) {
      for (let y = 0; y < canvasHeight; y += gridSize * 2) {
        ctx.fillRect(x, y, gridSize, gridSize);
        ctx.fillRect(x + gridSize, y + gridSize, gridSize, gridSize);
      }
    }

    // 绘制所有帧
    ctx.imageSmoothingEnabled = false;
    for (let i = 0; i < mpc.frames.length; i++) {
      const frame = mpc.frames[i];
      const col = i % cols;
      const row = Math.floor(i / cols);

      // 创建临时 canvas
      const tempCanvas = document.createElement("canvas");
      tempCanvas.width = frame.width;
      tempCanvas.height = frame.height;
      const tempCtx = tempCanvas.getContext("2d");
      if (!tempCtx) continue;
      tempCtx.putImageData(frame.imageData, 0, 0);

      // 绘制帧（居中对齐在每个格子中）
      const cellX = col * maxFrameWidth * puzzleZoom;
      const cellY = row * maxFrameHeight * puzzleZoom;
      const offsetX = ((maxFrameWidth - frame.width) * puzzleZoom) / 2;
      const offsetY = ((maxFrameHeight - frame.height) * puzzleZoom) / 2;

      ctx.drawImage(
        tempCanvas,
        cellX + offsetX,
        cellY + offsetY,
        frame.width * puzzleZoom,
        frame.height * puzzleZoom
      );
    }

    // 如果显示帧号，绘制网格线和帧号
    if (showFrameNumbers) {
      ctx.strokeStyle = "rgba(255, 255, 255, 0.2)";
      ctx.lineWidth = 1;

      // 绘制网格线
      for (let col = 1; col < cols; col++) {
        const x = col * maxFrameWidth * puzzleZoom;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, canvasHeight);
        ctx.stroke();
      }
      for (let row = 1; row < rows; row++) {
        const y = row * maxFrameHeight * puzzleZoom;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(canvasWidth, y);
        ctx.stroke();
      }

      // 绘制帧号
      ctx.font = `${10 * puzzleZoom}px monospace`;
      ctx.textBaseline = "top";
      for (let i = 0; i < mpc.frames.length; i++) {
        const col = i % cols;
        const row = Math.floor(i / cols);
        const x = col * maxFrameWidth * puzzleZoom + 2;
        const y = row * maxFrameHeight * puzzleZoom + 2;

        // 背景
        ctx.fillStyle = "rgba(0, 0, 0, 0.7)";
        const textWidth = ctx.measureText(String(i)).width;
        ctx.fillRect(x, y, textWidth + 4, 12 * puzzleZoom);

        // 文字
        ctx.fillStyle = "#fff";
        ctx.fillText(String(i), x + 2, y + 1);
      }
    }
  }, [mpc, viewMode, actualColumns, puzzleZoom, showFrameNumbers]);

  // 绘制选中帧的放大预览（网格模式）
  useEffect(() => {
    const canvas = previewCanvasRef.current;
    if (!canvas || !mpc || mpc.frames.length === 0 || viewMode !== "grid") return;

    const frame = mpc.frames[selectedFrame];
    if (!frame) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const displayWidth = frame.width * previewZoom;
    const displayHeight = frame.height * previewZoom;
    canvas.width = displayWidth;
    canvas.height = displayHeight;

    // 绘制棋盘格背景
    const gridSize = 8 * previewZoom;
    ctx.fillStyle = "#1e1e1e";
    ctx.fillRect(0, 0, displayWidth, displayHeight);
    ctx.fillStyle = "#2d2d2d";
    for (let x = 0; x < displayWidth; x += gridSize * 2) {
      for (let y = 0; y < displayHeight; y += gridSize * 2) {
        ctx.fillRect(x, y, gridSize, gridSize);
        ctx.fillRect(x + gridSize, y + gridSize, gridSize, gridSize);
      }
    }

    // 创建临时 canvas 绘制 ImageData
    const tempCanvas = document.createElement("canvas");
    tempCanvas.width = frame.width;
    tempCanvas.height = frame.height;
    const tempCtx = tempCanvas.getContext("2d");
    if (!tempCtx) return;
    tempCtx.putImageData(frame.imageData, 0, 0);

    // 绘制帧
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(tempCanvas, 0, 0, displayWidth, displayHeight);
  }, [mpc, selectedFrame, previewZoom, viewMode]);

  // 加载/错误状态
  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center bg-[#1e1e1e]">
        <div className="text-center">
          <div className="mx-auto mb-2 h-8 w-8 animate-spin rounded-full border-2 border-amber-500 border-t-transparent" />
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

  if (!mpc) {
    return (
      <div className="flex h-full items-center justify-center bg-[#1e1e1e]">
        <div className="text-center text-[#808080]">
          <span className="text-4xl">📦</span>
          <p className="mt-4">选择一个 MPC 文件查看</p>
        </div>
      </div>
    );
  }

  const selectedFrameData = mpc.frames[selectedFrame];

  return (
    <div className="flex h-full flex-col overflow-hidden bg-[#1e1e1e]">
      {/* 工具栏 */}
      <div className="flex shrink-0 items-center gap-4 border-b border-[#3c3c3c] bg-[#252526] px-4 py-2">
        {/* 文件名 */}
        <div className="flex-1">
          <span className="text-sm text-[#cccccc]">{fileName || "未选择"}</span>
          <span className="ml-2 text-xs text-[#808080]">{mpc.head.frameCounts} 帧</span>
        </div>

        {/* 视图模式切换 */}
        <div className="flex items-center gap-1 rounded bg-[#3c3c3c] p-0.5">
          <button
            className={`rounded px-3 py-1 text-xs transition-colors ${
              viewMode === "puzzle"
                ? "bg-[#0e639c] text-white"
                : "text-[#cccccc] hover:bg-[#4c4c4c]"
            }`}
            onClick={() => setViewMode("puzzle")}
          >
            🧩 拼图
          </button>
          <button
            className={`rounded px-3 py-1 text-xs transition-colors ${
              viewMode === "grid" ? "bg-[#0e639c] text-white" : "text-[#cccccc] hover:bg-[#4c4c4c]"
            }`}
            onClick={() => setViewMode("grid")}
          >
            ▦ 网格
          </button>
        </div>

        {/* 拼图模式控制 */}
        {viewMode === "puzzle" && (
          <>
            <div className="flex items-center gap-2">
              <span className="text-xs text-[#808080]">列数:</span>
              <select
                value={puzzleColumns}
                onChange={(e) => setPuzzleColumns(Number(e.target.value))}
                className="rounded border-none bg-[#3c3c3c] px-2 py-1 text-sm text-[#cccccc]"
              >
                <option value={0}>自动 ({autoColumns})</option>
                {[1, 2, 3, 4, 5, 6, 8, 10, 12].map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-[#808080]">缩放:</span>
              <select
                value={puzzleZoom}
                onChange={(e) => setPuzzleZoom(Number(e.target.value))}
                className="rounded border-none bg-[#3c3c3c] px-2 py-1 text-sm text-[#cccccc]"
              >
                <option value={0.5}>0.5x</option>
                <option value={1}>1x</option>
                <option value={2}>2x</option>
                <option value={3}>3x</option>
                <option value={4}>4x</option>
              </select>
            </div>
          </>
        )}

        {/* 网格模式控制 */}
        {viewMode === "grid" && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-[#808080]">缩略图:</span>
            <select
              value={thumbnailSize}
              onChange={(e) => setThumbnailSize(Number(e.target.value))}
              className="rounded border-none bg-[#3c3c3c] px-2 py-1 text-sm text-[#cccccc]"
            >
              <option value={48}>48px</option>
              <option value={64}>64px</option>
              <option value={96}>96px</option>
              <option value={128}>128px</option>
            </select>
          </div>
        )}

        {/* 显示帧号 */}
        <button
          className={`rounded px-2 py-1 text-sm ${
            showFrameNumbers ? "bg-[#0e639c]" : "hover:bg-[#3c3c3c]"
          } text-[#cccccc]`}
          onClick={() => setShowFrameNumbers(!showFrameNumbers)}
          title="显示帧号"
        >
          #
        </button>
      </div>

      {/* 主内容区 */}
      <div className="flex min-h-0 flex-1">
        {/* 拼图视图 */}
        {viewMode === "puzzle" && (
          <div className="flex flex-1 flex-col">
            {/* 拼图画布 - 可滚动 */}
            <div className="flex-1 overflow-auto p-4">
              <canvas
                ref={puzzleCanvasRef}
                className="border border-[#3c3c3c]"
                style={{ imageRendering: "pixelated" }}
              />
            </div>
            {/* 信息栏 */}
            <div className="shrink-0 border-t border-[#3c3c3c] bg-[#252526] px-4 py-2 text-xs text-[#808080]">
              <span>
                {mpc.head.frameCounts} 帧 | {actualColumns} ×{" "}
                {Math.ceil(mpc.frames.length / actualColumns)} | 单帧尺寸: {mpc.head.globalWidth} ×{" "}
                {mpc.head.globalHeight} | 方向数: {mpc.head.direction} | 间隔: {mpc.head.interval}ms
              </span>
            </div>
          </div>
        )}

        {/* 网格视图 */}
        {viewMode === "grid" && (
          <>
            {/* 帧网格 - 可滚动 */}
            <div className="flex-1 overflow-auto p-4">
              <div
                className="grid gap-2"
                style={{
                  gridTemplateColumns: `repeat(auto-fill, minmax(${thumbnailSize}px, 1fr))`,
                }}
              >
                {mpc.frames.map((frame, index) => (
                  <button
                    key={index}
                    className={`relative rounded border-2 transition-colors ${
                      selectedFrame === index
                        ? "border-[#0e639c] bg-[#0e639c]/20"
                        : "border-[#3c3c3c] bg-[#252526] hover:border-[#5c5c5c]"
                    }`}
                    style={{
                      width: thumbnailSize,
                      height: thumbnailSize,
                      padding: 2,
                    }}
                    onClick={() => setSelectedFrame(index)}
                    title={`帧 ${index}`}
                  >
                    <FrameThumbnail frame={frame} size={thumbnailSize - 8} />
                    {showFrameNumbers && (
                      <span className="absolute bottom-0 right-0 rounded-tl bg-black/70 px-1 text-[10px] text-white">
                        {index}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* 信息面板 */}
            <div className="w-72 shrink-0 overflow-y-auto border-l border-[#3c3c3c] bg-[#252526] p-4">
              {/* 选中帧预览 */}
              <div className="mb-4">
                <h3 className="mb-2 text-sm font-medium text-[#cccccc]">帧 {selectedFrame} 预览</h3>
                <div className="mb-2 flex items-center gap-2">
                  <span className="text-xs text-[#808080]">缩放:</span>
                  <select
                    value={previewZoom}
                    onChange={(e) => setPreviewZoom(Number(e.target.value))}
                    className="rounded border-none bg-[#3c3c3c] px-2 py-1 text-xs text-[#cccccc]"
                  >
                    <option value={1}>1x</option>
                    <option value={2}>2x</option>
                    <option value={3}>3x</option>
                    <option value={4}>4x</option>
                  </select>
                </div>
                <div className="flex max-h-64 justify-center overflow-auto rounded bg-[#1a1a1a] p-2">
                  <canvas ref={previewCanvasRef} style={{ imageRendering: "pixelated" }} />
                </div>
              </div>

              {/* 选中帧信息 */}
              {selectedFrameData && (
                <div className="mb-4">
                  <h3 className="mb-2 text-sm font-medium text-[#cccccc]">帧信息</h3>
                  <div className="space-y-1 text-xs text-[#808080]">
                    <div className="flex justify-between">
                      <span>帧索引:</span>
                      <span className="font-mono text-[#cccccc]">{selectedFrame}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>尺寸:</span>
                      <span className="text-[#cccccc]">
                        {selectedFrameData.width} × {selectedFrameData.height}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* 文件信息 */}
              <div className="mb-4">
                <h3 className="mb-2 text-sm font-medium text-[#cccccc]">文件信息</h3>
                <div className="space-y-1 text-xs text-[#808080]">
                  <div className="flex justify-between">
                    <span>总帧数:</span>
                    <span className="text-[#cccccc]">{mpc.head.frameCounts}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>全局尺寸:</span>
                    <span className="text-[#cccccc]">
                      {mpc.head.globalWidth} × {mpc.head.globalHeight}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>方向数:</span>
                    <span className="text-[#cccccc]">{mpc.head.direction}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>颜色数:</span>
                    <span className="text-[#cccccc]">{mpc.head.colourCounts}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>帧间隔:</span>
                    <span className="text-[#cccccc]">{mpc.head.interval}ms</span>
                  </div>
                  <div className="flex justify-between">
                    <span>偏移:</span>
                    <span className="text-[#cccccc]">
                      ({mpc.head.left}, {mpc.head.bottom})
                    </span>
                  </div>
                </div>
              </div>

              {/* 使用说明 */}
              <div className="rounded bg-[#1a1a1a] p-2 text-xs text-[#666]">
                <p className="mb-1">
                  💡 <strong>地图引用方式：</strong>
                </p>
                <p className="font-mono text-[#808080]">mpcIndex: N, frame: {selectedFrame}</p>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/**
 * 帧缩略图组件
 */
function FrameThumbnail({
  frame,
  size,
}: {
  frame: { width: number; height: number; imageData: ImageData };
  size: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // 绘制棋盘格背景
    const gridSize = 4;
    ctx.fillStyle = "#1e1e1e";
    ctx.fillRect(0, 0, size, size);
    ctx.fillStyle = "#2d2d2d";
    for (let x = 0; x < size; x += gridSize * 2) {
      for (let y = 0; y < size; y += gridSize * 2) {
        ctx.fillRect(x, y, gridSize, gridSize);
        ctx.fillRect(x + gridSize, y + gridSize, gridSize, gridSize);
      }
    }

    // 创建临时 canvas
    const tempCanvas = document.createElement("canvas");
    tempCanvas.width = frame.width;
    tempCanvas.height = frame.height;
    const tempCtx = tempCanvas.getContext("2d");
    if (!tempCtx) return;
    tempCtx.putImageData(frame.imageData, 0, 0);

    // 计算缩放以适应缩略图（保持比例）
    const scale = Math.min(size / frame.width, size / frame.height);
    const drawWidth = frame.width * scale;
    const drawHeight = frame.height * scale;
    const offsetX = (size - drawWidth) / 2;
    const offsetY = (size - drawHeight) / 2;

    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(tempCanvas, offsetX, offsetY, drawWidth, drawHeight);
  }, [frame, size]);

  return (
    <canvas
      ref={canvasRef}
      width={size}
      height={size}
      className="h-full w-full"
      style={{ imageRendering: "pixelated" }}
    />
  );
}
