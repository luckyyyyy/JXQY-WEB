/**
 * useAsfImage Hook - Load ASF files and convert to usable images
 * Based on C# Utils.GetAsf() pattern
 */
import { useEffect, useRef, useState } from "react";
import { type AsfData, getFrameCanvas, loadAsf } from "@/engine/sprite/asf";
import { buildPath } from "@/config/resourcePaths";

export interface AsfImageData {
  asf: AsfData | null;
  dataUrl: string | null;
  width: number;
  height: number;
  isLoading: boolean;
  error: string | null;
}

// 缓存单帧图片的 dataUrl
const singleFrameCache = new Map<string, { dataUrl: string; width: number; height: number }>();

/**
 * Hook to load an ASF file and get image data
 */
export function useAsfImage(path: string | null, frameIndex: number = 0): AsfImageData {
  const [asf, setAsf] = useState<AsfData | null>(null);
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 用于追踪是否已加载过
  const loadedKeyRef = useRef<string | null>(null);

  useEffect(() => {
    if (!path) {
      setAsf(null);
      setDataUrl(null);
      loadedKeyRef.current = null;
      return;
    }

    // Normalize path - remove leading backslash and convert to forward slashes
    let normalizedPath = path.replace(/\\/g, "/");
    if (normalizedPath.startsWith("/")) {
      normalizedPath = normalizedPath.substring(1);
    }

    // Prepend resources path
    const fullPath = buildPath(normalizedPath);
    const cacheKey = `${fullPath}:${frameIndex}`;

    // 如果已加载过相同的，跳过
    if (cacheKey === loadedKeyRef.current && dataUrl) {
      return;
    }

    // 检查缓存
    const cached = singleFrameCache.get(cacheKey);
    if (cached) {
      loadedKeyRef.current = cacheKey;
      setDataUrl(cached.dataUrl);
      // 还需要加载 asf 数据用于 width/height
      loadAsf(fullPath).then((data) => {
        if (data) setAsf(data);
      });
      return;
    }

    let cancelled = false;
    setIsLoading(true);
    setError(null);

    loadAsf(fullPath)
      .then((data) => {
        if (cancelled) return;
        if (data) {
          setAsf(data);
          // Generate data URL for the specified frame
          if (data.frames.length > 0) {
            const idx = Math.min(frameIndex, data.frames.length - 1);
            const canvas = getFrameCanvas(data.frames[idx]);
            const url = canvas.toDataURL();

            // 缓存
            singleFrameCache.set(cacheKey, {
              dataUrl: url,
              width: data.width,
              height: data.height,
            });
            loadedKeyRef.current = cacheKey;

            setDataUrl(url);
          }
        } else {
          setError(`Failed to load ASF: ${fullPath}`);
        }
        setIsLoading(false);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err.message);
        setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [path, frameIndex, dataUrl]);

  return {
    asf,
    dataUrl,
    width: asf?.width ?? 0,
    height: asf?.height ?? 0,
    isLoading,
    error,
  };
}

/**
 * Hook to load multiple ASF files
 */
export function useMultipleAsfImages(paths: (string | null)[]): Map<string, AsfImageData> {
  const [results, setResults] = useState<Map<string, AsfImageData>>(new Map());

  useEffect(() => {
    const newResults = new Map<string, AsfImageData>();
    let cancelled = false;

    const loadAll = async () => {
      for (const path of paths) {
        if (!path) continue;

        // Normalize path
        let normalizedPath = path.replace(/\\/g, "/");
        if (normalizedPath.startsWith("/")) {
          normalizedPath = normalizedPath.substring(1);
        }
        const fullPath = buildPath(normalizedPath);

        try {
          const data = await loadAsf(fullPath);
          if (cancelled) return;

          if (data && data.frames.length > 0) {
            const canvas = getFrameCanvas(data.frames[0]);
            newResults.set(path, {
              asf: data,
              dataUrl: canvas.toDataURL(),
              width: data.width,
              height: data.height,
              isLoading: false,
              error: null,
            });
          }
        } catch (err) {
          if (cancelled) return;
          newResults.set(path, {
            asf: null,
            dataUrl: null,
            width: 0,
            height: 0,
            isLoading: false,
            error: (err as Error).message,
          });
        }
      }

      if (!cancelled) {
        setResults(new Map(newResults));
      }
    };

    loadAll();

    return () => {
      cancelled = true;
    };
  }, [paths]);

  return results;
}

/**
 * Get frame data URL from ASF for a specific frame
 */
export function getAsfFrameDataUrl(asf: AsfData | null, frameIndex: number): string | null {
  if (!asf || asf.frames.length === 0) return null;
  const idx = Math.min(frameIndex, asf.frames.length - 1);
  const canvas = getFrameCanvas(asf.frames[idx]);
  return canvas.toDataURL();
}

/**
 * Hook to create a ColumnView-style clipped image (transparent from top based on percent)
 */
export function useColumnView(
  path: string | null,
  percent: number // 0 to 1, how much to show from bottom
): { dataUrl: string | null; width: number; height: number; isLoading: boolean } {
  const { asf, isLoading } = useAsfImage(path, 0);
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (!asf || asf.frames.length === 0) {
      setDataUrl(null);
      return;
    }

    const frame = asf.frames[0];
    const srcCanvas = getFrameCanvas(frame);

    // Create a new canvas for the clipped result
    if (!canvasRef.current) {
      canvasRef.current = document.createElement("canvas");
    }
    const canvas = canvasRef.current;
    canvas.width = frame.width;
    canvas.height = frame.height;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Calculate visible height from bottom
    const visibleHeight = Math.floor(frame.height * Math.max(0, Math.min(1, percent)));
    const startY = frame.height - visibleHeight;

    if (visibleHeight > 0) {
      // Draw only the bottom portion
      ctx.drawImage(
        srcCanvas,
        0,
        startY,
        frame.width,
        visibleHeight, // source
        0,
        startY,
        frame.width,
        visibleHeight // destination
      );
    }

    setDataUrl(canvas.toDataURL());
  }, [asf, percent]);

  return {
    dataUrl,
    width: asf?.width ?? 0,
    height: asf?.height ?? 0,
    isLoading,
  };
}

export interface AsfAnimationData {
  asf: AsfData | null;
  dataUrl: string | null;
  width: number;
  height: number;
  isLoading: boolean;
  error: string | null;
  frameIndex: number;
  frameCount: number;
}

// 缓存每个 ASF 文件的所有帧 dataUrl
const frameDataUrlCache = new Map<string, string[]>();

/**
 * Hook to load an ASF file and animate it (play through all frames)
 * Based on C# Texture class with Update() method for animation
 *
 * 性能优化：预先生成并缓存所有帧的 dataUrl，避免每帧调用 toDataURL()
 *
 * @param path - Path to the ASF file
 * @param autoPlay - Whether to automatically play the animation (default: true)
 * @param loop - Whether to loop the animation (default: true)
 */
export function useAsfAnimation(
  path: string | null,
  autoPlay: boolean = true,
  loop: boolean = true
): AsfAnimationData {
  const [asf, setAsf] = useState<AsfData | null>(null);
  const [frameIndex, setFrameIndex] = useState(0);
  const [frameDataUrls, setFrameDataUrls] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const animationRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number>(0);

  // 用于追踪是否已加载过
  const loadedPathRef = useRef<string | null>(null);

  // Load ASF file - 当 path 改变时重新加载
  useEffect(() => {
    // 如果路径没变且已加载，跳过
    if (path === loadedPathRef.current && frameDataUrls.length > 0) {
      return;
    }

    // 清理之前的动画
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
    }
    lastTimeRef.current = 0;

    if (!path) {
      setAsf(null);
      setFrameDataUrls([]);
      setFrameIndex(0);
      loadedPathRef.current = null;
      return;
    }

    // Normalize path - remove leading backslash and convert to forward slashes
    let normalizedPath = path.replace(/\\/g, "/");
    if (normalizedPath.startsWith("/")) {
      normalizedPath = normalizedPath.substring(1);
    }

    // Prepend resources path
    const fullPath = buildPath(normalizedPath);

    // 检查缓存 - 如果已缓存直接使用
    const cached = frameDataUrlCache.get(fullPath);
    if (cached && cached.length > 0) {
      loadedPathRef.current = path;

      // 从缓存加载 ASF 数据
      loadAsf(fullPath).then((data) => {
        if (data) {
          setAsf(data);
          setFrameDataUrls(cached);
          setFrameIndex(0);
        }
      });
      return;
    }

    let cancelled = false;
    setIsLoading(true);
    setError(null);
    // 重置状态以避免显示旧图像
    setFrameDataUrls([]);
    setFrameIndex(0);

    loadAsf(fullPath)
      .then((data) => {
        if (cancelled) return;
        if (data) {
          setAsf(data);
          setFrameIndex(0);
          loadedPathRef.current = path;

          // 预先生成所有帧的 dataUrl 并缓存
          const urls = data.frames.map((frame) => {
            const canvas = getFrameCanvas(frame);
            return canvas.toDataURL();
          });
          frameDataUrlCache.set(fullPath, urls);
          setFrameDataUrls(urls);
        } else {
          setError(`Failed to load ASF: ${fullPath}`);
        }
        setIsLoading(false);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err.message);
        setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [path, frameDataUrls.length]); // 移除 frameDataUrls.length 依赖，避免循环

  // Animation loop - 只更新 frameIndex，不再调用 toDataURL
  useEffect(() => {
    if (!asf || !autoPlay || asf.frames.length <= 1 || frameDataUrls.length === 0) {
      return;
    }

    // 使用文件中的 interval 值，如果为 0 或未定义则使用默认值
    // C# Texture.Update() 使用 _texture.Interval，当 interval 为 0 时每帧更新
    // 这里设置合理的默认值 100ms (10 FPS)
    const interval = asf.interval > 0 ? asf.interval : 100;

    const animate = (timestamp: number) => {
      if (!lastTimeRef.current) {
        lastTimeRef.current = timestamp;
      }

      const elapsed = timestamp - lastTimeRef.current;

      if (elapsed >= interval) {
        lastTimeRef.current = timestamp;

        setFrameIndex((prevIndex) => {
          let nextIndex = prevIndex + 1;
          if (nextIndex >= asf.frames.length) {
            nextIndex = loop ? 0 : asf.frames.length - 1;
          }
          return nextIndex;
        });
      }

      animationRef.current = requestAnimationFrame(animate);
    };

    animationRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = null;
      }
      lastTimeRef.current = 0;
    };
  }, [asf, autoPlay, loop, frameDataUrls.length]);

  // 从缓存的 dataUrls 中获取当前帧
  const dataUrl = frameDataUrls[frameIndex] ?? null;

  return {
    asf,
    dataUrl,
    width: asf?.width ?? 0,
    height: asf?.height ?? 0,
    isLoading,
    error,
    frameIndex,
    frameCount: asf?.frames.length ?? 0,
  };
}
