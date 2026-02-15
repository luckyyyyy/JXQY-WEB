/**
 * Object 预览组件
 *
 * 显示 Object 的动画：
 * - Object 只支持 Common 一种状态（与 NPC 多状态不同）
 */

import type { AsfData } from "@miu2d/engine/resource/format/asf";
import { getFrameCanvas } from "@miu2d/engine/resource/format/asf";
import { decodeAsfWasm } from "@miu2d/engine/wasm/wasm-asf-decoder";
import { initWasm } from "@miu2d/engine/wasm/wasm-manager";
import type { Obj, ObjRes, ObjResource, ObjState } from "@miu2d/types";
import { ObjKindLabels, ObjStateLabels } from "@miu2d/types";
import { useCallback, useEffect, useRef, useState } from "react";
import { buildResourceUrl } from "../../utils";

// ========== 类型定义 ==========

interface ObjPreviewProps {
  gameSlug: string;
  obj: Partial<Obj> | null;
  /** 关联的 Obj 资源（用于获取资源） */
  resource?: ObjRes;
}

/** 可预览的状态列表 - Object 只支持 Common 状态 */
const PREVIEW_STATES: ObjState[] = ["Common"];

// ========== 主组件 ==========

export function ObjPreview({ gameSlug, obj, resource }: ObjPreviewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number | null>(null);

  // WASM 状态
  const [wasmReady, setWasmReady] = useState(false);

  // 获取实际使用的资源配置（优先使用关联的资源，否则使用 Obj 自身的资源）
  const resources = resource?.resources ?? obj?.resources;

  // 当前选中的状态（Object 只有 Common）
  const [selectedState] = useState<ObjState>("Common");

  // 当前方向（0-7）
  const [direction, setDirection] = useState(0);

  // ASF 数据
  const [asfData, setAsfData] = useState<AsfData | null>(null);

  // 动画帧（使用 ref 避免触发 effect 重新执行）
  const frameRef = useRef(0);

  // 累积时间（模拟引擎的 elapsedMilliSecond）
  const elapsedRef = useRef(0);
  const lastTimeRef = useRef(0);

  // 加载状态
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  // ========== 初始化 WASM ==========
  useEffect(() => {
    initWasm()
      .then(() => setWasmReady(true))
      .catch((err) => {
        console.error("Failed to init WASM:", err);
      });
  }, []);

  // ========== 规范化图像路径 ==========
  const normalizeImagePath = useCallback((imagePath: string | null | undefined): string | null => {
    if (!imagePath) return null;

    let path = imagePath.trim();
    if (!path) return null;

    // 规范化路径分隔符
    path = path.replace(/\\/g, "/");

    // 移除开头的斜杠
    if (path.startsWith("/")) {
      path = path.slice(1);
    }

    // 判断是否是绝对路径
    const lowerPath = path.toLowerCase();
    if (lowerPath.startsWith("asf/") || lowerPath.startsWith("mpc/")) {
      return path.toLowerCase();
    }

    // 相对路径：添加默认前缀
    return `asf/object/${path}`.toLowerCase();
  }, []);

  // ========== 获取当前状态的资源路径 ==========
  const getResourcePath = useCallback(
    (state: ObjState): string | null => {
      if (!resources) return null;

      const stateKey = state.toLowerCase() as keyof ObjResource;
      const stateRes = resources[stateKey];

      // 规范化路径（兼容旧数据）
      return normalizeImagePath(stateRes?.image);
    },
    [resources, normalizeImagePath]
  );

  // ========== 加载 ASF 文件 ==========
  const loadAsf = useCallback(
    async (imagePath: string): Promise<AsfData | null> => {
      if (!wasmReady || !gameSlug) return null;

      try {
        const url = buildResourceUrl(gameSlug, imagePath);
        const response = await fetch(url);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const buffer = await response.arrayBuffer();
        return decodeAsfWasm(buffer);
      } catch (err) {
        console.error(`Failed to load ASF: ${imagePath}`, err);
        return null;
      }
    },
    [wasmReady, gameSlug]
  );

  // ========== 加载选中状态的资源 ==========
  useEffect(() => {
    if (!wasmReady || !obj) return;

    const loadSelectedState = async () => {
      const path = getResourcePath(selectedState);

      if (!path) {
        setAsfData(null);
        setLoadError(`${ObjStateLabels[selectedState]} 状态未配置动画资源`);
        return;
      }

      setIsLoading(true);
      setLoadError(null);
      setAsfData(null);
      // 重置动画状态
      frameRef.current = 0;
      elapsedRef.current = 0;
      lastTimeRef.current = 0;

      const data = await loadAsf(path);
      if (data) {
        setAsfData(data);
      } else {
        setLoadError(`无法加载 ${path}`);
      }
      setIsLoading(false);
    };

    loadSelectedState();
  }, [wasmReady, obj, selectedState, getResourcePath, loadAsf]);

  // ========== 动画渲染 ==========
  useEffect(() => {
    const canvas = canvasRef.current;

    if (!canvas || !asfData) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const { frames, framesPerDirection, interval } = asfData;
    if (frames.length === 0) return;

    // 计算方向数量
    const totalDirections = Math.ceil(frames.length / framesPerDirection);
    // 如果指定方向超出范围，回退到方向 0
    const safeDirection = direction < totalDirections ? direction : 0;
    const directionOffset = safeDirection * framesPerDirection;
    const totalDirectionFrames = Math.min(framesPerDirection, frames.length - directionOffset);

    if (totalDirectionFrames <= 0) return;

    // 重置动画状态
    frameRef.current = 0;
    elapsedRef.current = 0;
    lastTimeRef.current = 0;

    // 帧间隔：使用 ASF 文件中的原始值，与游戏引擎一致
    const frameInterval = interval || 100;

    const animate = (time: number) => {
      // 计算 deltaTime（毫秒）
      if (lastTimeRef.current === 0) {
        lastTimeRef.current = time;
      }
      const deltaMs = time - lastTimeRef.current;
      lastTimeRef.current = time;

      // 累积时间（模拟引擎的 elapsedMilliSecond）
      elapsedRef.current += deltaMs;

      // 当累积时间超过帧间隔时切换帧
      if (elapsedRef.current >= frameInterval) {
        elapsedRef.current -= frameInterval;
        frameRef.current = (frameRef.current + 1) % totalDirectionFrames;
      }

      // 计算当前帧索引
      const frameIndex = directionOffset + frameRef.current;

      // 清空画布
      ctx.fillStyle = "#1e1e1e";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // 绘制帧
      if (frameIndex < frames.length) {
        const frameCanvas = getFrameCanvas(frames[frameIndex]);
        if (frameCanvas) {
          // 居中绘制，放大 2 倍
          const scale = 2;
          const x = (canvas.width - frameCanvas.width * scale) / 2;
          const y = (canvas.height - frameCanvas.height * scale) / 2;
          ctx.imageSmoothingEnabled = false;
          ctx.drawImage(frameCanvas, x, y, frameCanvas.width * scale, frameCanvas.height * scale);
        }
      }

      animationRef.current = requestAnimationFrame(animate);
    };

    animationRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [asfData, direction]);

  // 方向控制
  const handleDirectionChange = (delta: number) => {
    setDirection((d) => (d + delta + 8) % 8);
    // 重置帧
    frameRef.current = 0;
    elapsedRef.current = 0;
  };

  // 方向标签
  const directionLabels = ["↑", "↗", "→", "↘", "↓", "↙", "←", "↖"];

  // 检查 ASF 是否有多个方向（用于决定是否显示方向控制）
  const hasMultipleDirections = asfData
    ? Math.ceil(asfData.frames.length / asfData.framesPerDirection) > 1
    : false;

  // 判断是否有任何资源配置
  const hasAnyResource = PREVIEW_STATES.some((state) => {
    const stateKey = state.toLowerCase() as keyof ObjResource;
    const image = resources?.[stateKey]?.image;
    return image && image.trim() !== "";
  });

  return (
    <div className="space-y-4">
      {/* 画布 */}
      <div className="relative bg-[#1e1e1e] rounded-lg overflow-hidden aspect-square border border-widget-border">
        {/* 始终渲染 canvas，但在无资源时隐藏 */}
        <canvas
          ref={canvasRef}
          width={256}
          height={256}
          className={`w-full h-full ${hasAnyResource ? "" : "hidden"}`}
          style={{ imageRendering: "pixelated" }}
        />

        {/* 无资源时显示默认图标 */}
        {!hasAnyResource && !isLoading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-5xl mb-2">📦</span>
            <div className="text-xs text-[#858585] text-center px-4">
              未配置动画资源
              <br />
              <span className="text-[#666]">在"资源配置"标签页添加</span>
            </div>
          </div>
        )}

        {/* 加载中 */}
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/50">
            <div className="text-sm text-[#858585]">加载中...</div>
          </div>
        )}

        {/* 错误提示 - 只在有资源但加载失败时显示 */}
        {loadError && !isLoading && hasAnyResource && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-xs text-[#858585] text-center px-4">{loadError}</div>
          </div>
        )}

        {/* 方向控制 - 只在有资源且有多个方向时显示 */}
        {hasAnyResource && hasMultipleDirections && (
          <div className="absolute bottom-2 right-2 flex items-center gap-1">
            <button
              type="button"
              onClick={() => handleDirectionChange(-1)}
              className="w-6 h-6 flex items-center justify-center rounded bg-black/50 hover:bg-black/70 text-white text-xs"
            >
              ◀
            </button>
            <span className="w-6 h-6 flex items-center justify-center rounded bg-black/50 text-white text-sm">
              {directionLabels[direction]}
            </span>
            <button
              type="button"
              onClick={() => handleDirectionChange(1)}
              className="w-6 h-6 flex items-center justify-center rounded bg-black/50 hover:bg-black/70 text-white text-xs"
            >
              ▶
            </button>
          </div>
        )}
      </div>

      {/* Object 信息 */}
      {obj && (
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-[#858585]">名称</span>
            <span className="text-[#cccccc]">{obj.name || "未命名"}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-[#858585]">类型</span>
            <span className="text-[#cccccc]">{ObjKindLabels[obj.kind || "Static"]}</span>
          </div>
          {obj.damage !== undefined && obj.damage > 0 && (
            <div className="flex justify-between">
              <span className="text-[#858585]">伤害</span>
              <span className="text-[#cccccc]">{obj.damage}</span>
            </div>
          )}
          {obj.scriptFile && (
            <div className="flex justify-between">
              <span className="text-[#858585]">脚本</span>
              <span className="text-[#cccccc] truncate max-w-[120px]" title={obj.scriptFile}>
                {obj.scriptFile.split("/").pop()}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
