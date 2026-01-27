/**
 * useAsfImage Hook - Load ASF files and convert to usable images
 * Based on C# Utils.GetAsf() pattern
 */
import { useState, useEffect, useRef } from "react";
import { loadAsf, getFrameCanvas, type AsfData } from "../../../engine/sprite/asf";

export interface AsfImageData {
  asf: AsfData | null;
  dataUrl: string | null;
  width: number;
  height: number;
  isLoading: boolean;
  error: string | null;
}

/**
 * Hook to load an ASF file and get image data
 */
export function useAsfImage(path: string | null, frameIndex: number = 0): AsfImageData {
  const [asf, setAsf] = useState<AsfData | null>(null);
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!path) {
      setAsf(null);
      setDataUrl(null);
      return;
    }

    let cancelled = false;
    setIsLoading(true);
    setError(null);

    // Normalize path - remove leading backslash and convert to forward slashes
    let normalizedPath = path.replace(/\\/g, "/");
    if (normalizedPath.startsWith("/")) {
      normalizedPath = normalizedPath.substring(1);
    }

    // Prepend resources path
    const fullPath = `/resources/${normalizedPath}`;

    loadAsf(fullPath)
      .then((data) => {
        if (cancelled) return;
        if (data) {
          setAsf(data);
          // Generate data URL for the specified frame
          if (data.frames.length > 0) {
            const idx = Math.min(frameIndex, data.frames.length - 1);
            const canvas = getFrameCanvas(data.frames[idx]);
            setDataUrl(canvas.toDataURL());
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
  }, [path, frameIndex]);

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
export function useMultipleAsfImages(
  paths: (string | null)[]
): Map<string, AsfImageData> {
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
        const fullPath = `/resources/${normalizedPath}`;

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
  }, [paths.join(",")]);

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
        0, startY, frame.width, visibleHeight, // source
        0, startY, frame.width, visibleHeight  // destination
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

/**
 * Hook to load an ASF file and animate it (play through all frames)
 * Based on C# Texture class with Update() method for animation
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
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const animationRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number>(0);

  // Load ASF file - 当 path 改变时重新加载
  useEffect(() => {
    // 清理之前的动画
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
    }
    lastTimeRef.current = 0;

    if (!path) {
      setAsf(null);
      setDataUrl(null);
      setFrameIndex(0);
      return;
    }

    let cancelled = false;
    setIsLoading(true);
    setError(null);
    // 重置状态以避免显示旧图像
    setDataUrl(null);
    setFrameIndex(0);

    // Normalize path - remove leading backslash and convert to forward slashes
    let normalizedPath = path.replace(/\\/g, "/");
    if (normalizedPath.startsWith("/")) {
      normalizedPath = normalizedPath.substring(1);
    }

    // Prepend resources path
    const fullPath = `/resources/${normalizedPath}`;

    loadAsf(fullPath)
      .then((data) => {
        if (cancelled) return;
        if (data) {
          setAsf(data);
          setFrameIndex(0);
          // Generate initial frame
          if (data.frames.length > 0) {
            const canvas = getFrameCanvas(data.frames[0]);
            setDataUrl(canvas.toDataURL());
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
  }, [path]);

  // Animation loop
  useEffect(() => {
    if (!asf || !autoPlay || asf.frames.length <= 1) {
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

          // Update dataUrl for new frame
          if (asf.frames[nextIndex]) {
            const canvas = getFrameCanvas(asf.frames[nextIndex]);
            setDataUrl(canvas.toDataURL());
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
  }, [asf, autoPlay, loop]);

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
