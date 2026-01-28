/**
 * AsfAnimatedSprite Component - 高性能 ASF 动画精灵组件
 *
 * 使用 canvas 直接绘制 ASF 帧数据，避免每帧更新 img src 导致的性能问题
 * 适用于需要播放动画的 ASF 精灵（如武功图标、特效等）
 *
 * 对于静态图片（只显示单帧），建议继续使用 useAsfImage + img，因为有缓存不会重复渲染
 */
import React, { useEffect, useRef, useState, memo } from "react";
import {
  loadAsf,
  getFrameCanvas,
  type AsfData,
} from "../../engine/sprite/asf";

// 全局帧缓存 - 按路径存储预渲染的 canvas
const frameCanvasCache = new Map<
  string,
  { asf: AsfData; frames: HTMLCanvasElement[] }
>();
const loadPromiseCache = new Map<string, Promise<void>>();

/**
 * 加载 ASF 并缓存所有帧的 canvas
 */
async function loadAndCacheAsf(
  path: string
): Promise<{ asf: AsfData; frames: HTMLCanvasElement[] } | null> {
  // 已缓存
  const cached = frameCanvasCache.get(path);
  if (cached) {
    return cached;
  }

  // 正在加载
  const existingPromise = loadPromiseCache.get(path);
  if (existingPromise) {
    await existingPromise;
    return frameCanvasCache.get(path) ?? null;
  }

  // 开始加载
  const loadPromise = (async () => {
    const data = await loadAsf(path);
    if (data && data.frames.length > 0) {
      const frames = data.frames.map((frame) => getFrameCanvas(frame));
      frameCanvasCache.set(path, { asf: data, frames });
    }
  })();

  loadPromiseCache.set(path, loadPromise);
  await loadPromise;
  loadPromiseCache.delete(path);

  return frameCanvasCache.get(path) ?? null;
}

/**
 * 规范化路径
 */
function normalizePath(path: string): string {
  let normalized = path.replace(/\\/g, "/");
  if (normalized.startsWith("/")) {
    normalized = normalized.substring(1);
  }
  return `/resources/${normalized}`;
}

export interface AsfAnimatedSpriteProps {
  /** ASF 文件路径 */
  path: string | null;
  /** 是否自动播放动画 */
  autoPlay?: boolean;
  /** 是否循环播放 */
  loop?: boolean;
  /** 额外样式 */
  style?: React.CSSProperties;
  /** 类名 */
  className?: string;
  /** alt 文本（用于可访问性） */
  alt?: string;
}

/**
 * 高性能 ASF 动画精灵组件
 *
 * 使用 canvas 直接绘制，避免 React 重新渲染
 */
export const AsfAnimatedSprite: React.FC<AsfAnimatedSpriteProps> = memo(
  ({ path, autoPlay = true, loop = true, style, className, alt }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const animationRef = useRef<number | null>(null);
    const frameIndexRef = useRef(0);
    const lastFrameTimeRef = useRef(0);
    const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
    const [isLoaded, setIsLoaded] = useState(false);
    const cachedDataRef = useRef<{
      asf: AsfData;
      frames: HTMLCanvasElement[];
    } | null>(null);
    const currentPathRef = useRef<string | null>(null);
    const needsInitialDrawRef = useRef(false);

    // 加载 ASF
    useEffect(() => {
      if (!path) {
        setIsLoaded(false);
        setDimensions({ width: 0, height: 0 });
        cachedDataRef.current = null;
        currentPathRef.current = null;
        needsInitialDrawRef.current = false;
        return;
      }

      const fullPath = normalizePath(path);

      // 如果路径没变且已加载，跳过
      if (fullPath === currentPathRef.current && cachedDataRef.current) {
        return;
      }

      let cancelled = false;

      loadAndCacheAsf(fullPath).then((data) => {
        if (cancelled || !data) return;

        cachedDataRef.current = data;
        currentPathRef.current = fullPath;
        frameIndexRef.current = 0;
        lastFrameTimeRef.current = 0;
        needsInitialDrawRef.current = true; // 标记需要初始绘制

        setDimensions({ width: data.asf.width, height: data.asf.height });
        setIsLoaded(true);
      });

      return () => {
        cancelled = true;
      };
    }, [path]);

    // 初始绘制第一帧 - 在 canvas 尺寸设置后执行
    useEffect(() => {
      if (!isLoaded || !needsInitialDrawRef.current) return;

      const data = cachedDataRef.current;
      const canvas = canvasRef.current;
      if (!data || !canvas || data.frames.length === 0) return;

      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(data.frames[0], 0, 0);
      needsInitialDrawRef.current = false;
    }, [isLoaded, dimensions]);

    // 动画循环
    useEffect(() => {
      const data = cachedDataRef.current;
      if (!isLoaded || !data || !autoPlay || data.frames.length <= 1) {
        return;
      }

      const { asf, frames } = data;
      const interval = asf.interval > 0 ? asf.interval : 100;

      const animate = (timestamp: number) => {
        const canvas = canvasRef.current;
        if (!canvas) {
          animationRef.current = requestAnimationFrame(animate);
          return;
        }

        const ctx = canvas.getContext("2d");
        if (!ctx) {
          animationRef.current = requestAnimationFrame(animate);
          return;
        }

        // 更新帧（根据时间间隔）
        if (timestamp - lastFrameTimeRef.current >= interval) {
          lastFrameTimeRef.current = timestamp;

          frameIndexRef.current = frameIndexRef.current + 1;
          if (frameIndexRef.current >= frames.length) {
            frameIndexRef.current = loop ? 0 : frames.length - 1;
          }

          // 绘制当前帧
          const frameCanvas = frames[frameIndexRef.current];
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(frameCanvas, 0, 0);
        }

        animationRef.current = requestAnimationFrame(animate);
      };

      animationRef.current = requestAnimationFrame(animate);

      return () => {
        if (animationRef.current) {
          cancelAnimationFrame(animationRef.current);
          animationRef.current = null;
        }
      };
    }, [isLoaded, autoPlay, loop]);

    if (!path || !isLoaded || dimensions.width === 0) {
      return null;
    }

    return (
      <canvas
        ref={canvasRef}
        width={dimensions.width}
        height={dimensions.height}
        className={className}
        aria-label={alt}
        style={{
          imageRendering: "pixelated",
          ...style,
        }}
      />
    );
  }
);

AsfAnimatedSprite.displayName = "AsfAnimatedSprite";

export default AsfAnimatedSprite;
