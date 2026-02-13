/**
 * LazyAsfIcon - 懒加载 ASF 精灵图标组件
 *
 * 使用 IntersectionObserver 实现滚动到视口才加载 ASF 图标。
 * 全局缓存已解码的 dataURL，避免重复解码。
 */
import { useState, useEffect, useRef, type ReactNode } from "react";
import { getFrameCanvas } from "@miu2d/engine/resource/format/asf";
import { initWasm } from "@miu2d/engine/wasm/wasm-manager";
import { decodeAsfWasm } from "@miu2d/engine/wasm/wasm-asf-decoder";
import { buildResourceUrl } from "../../pages/dashboard/utils";
import { getNpcImageCandidates } from "@miu2d/types";

// 全局 ASF 图标 dataURL 缓存
const asfIconCache = new Map<string, string>();

// WASM 初始化状态（全局单例）
let wasmInitialized = false;
let wasmInitPromise: Promise<void> | null = null;

async function ensureWasmInit(): Promise<boolean> {
  if (wasmInitialized) return true;
  if (!wasmInitPromise) {
    wasmInitPromise = initWasm()
      .then(() => {
        wasmInitialized = true;
      })
      .catch((err) => {
        console.error("[LazyAsfIcon] Failed to init WASM:", err);
      });
  }
  await wasmInitPromise;
  return wasmInitialized;
}

export interface LazyAsfIconProps {
  /** ASF 文件名或相对路径（如 "npc001.asf" 或 "asf/character/npc001.asf"） */
  iconPath?: string | null;
  /** 游戏 slug（用于构建资源 URL） */
  gameSlug?: string;
  /** 图标尺寸，默认 32 */
  size?: number;
  /**
   * 默认资源前缀（当 iconPath 不含 "/" 时自动补全）
   * 例如 "asf/character/"、"asf/magic/"、"asf/goods/"
   */
  prefix?: string;
  /** 无图标时的 fallback 内容（默认不显示） */
  fallback?: ReactNode;
  /** 额外 CSS className */
  className?: string;
  /** IntersectionObserver rootMargin，控制提前加载距离，默认 "200px" */
  rootMargin?: string;
}

export function LazyAsfIcon({
  iconPath,
  gameSlug,
  size = 32,
  prefix = "asf/",
  fallback,
  className,
  rootMargin = "200px",
}: LazyAsfIconProps) {
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const containerRef = useRef<HTMLSpanElement>(null);
  const loadedKeyRef = useRef<string | null>(null);

  const sizeStyle = { width: size, height: size };

  // IntersectionObserver - 检测元素是否进入视口
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [rootMargin]);

  // 加载 ASF 图标（仅在可见时）
  useEffect(() => {
    if (!isVisible || !iconPath || !gameSlug) {
      setDataUrl(null);
      loadedKeyRef.current = null;
      return;
    }

    // 构建候选路径（角色资源使用共享的回退策略，与引擎 loadCharacterAsf 一致）
    const candidatePaths: string[] = [];
    if (iconPath.includes("/")) {
      candidatePaths.push(iconPath);
    } else if (prefix === "asf/character/") {
      // 使用共享的路径回退策略：character → interlude
      candidatePaths.push(...getNpcImageCandidates(iconPath));
    } else {
      candidatePaths.push(`${prefix}${iconPath}`);
    }

    const cacheKey = `${gameSlug}:${candidatePaths[0]}`;

    // 已经加载过相同的路径
    if (cacheKey === loadedKeyRef.current && dataUrl) {
      return;
    }

    // 命中缓存
    const cached = asfIconCache.get(cacheKey);
    if (cached) {
      loadedKeyRef.current = cacheKey;
      setDataUrl(cached);
      return;
    }

    let cancelled = false;
    setIsLoading(true);
    setDataUrl(null);

    const loadIcon = async () => {
      try {
        const ready = await ensureWasmInit();
        if (!ready || cancelled) return;

        for (const resourcePath of candidatePaths) {
          if (cancelled) return;

          const url = buildResourceUrl(gameSlug, resourcePath);
          try {
            const response = await fetch(url);
            if (!response.ok || cancelled) continue;

            const buffer = await response.arrayBuffer();
            if (cancelled) return;

            const decodedAsf = decodeAsfWasm(buffer);
            if (
              !decodedAsf ||
              !decodedAsf.frames ||
              decodedAsf.frames.length === 0 ||
              cancelled
            )
              continue;

            const canvas = getFrameCanvas(decodedAsf.frames[0]);
            if (!canvas || cancelled) return;

            const result = canvas.toDataURL();
            asfIconCache.set(cacheKey, result);
            loadedKeyRef.current = cacheKey;
            setDataUrl(result);
            return; // 成功，退出循环
          } catch {
            // 继续尝试下一个路径
          }
        }
      } catch {
        // ignore load errors
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    loadIcon();
    return () => {
      cancelled = true;
    };
  }, [isVisible, iconPath, gameSlug, prefix, dataUrl]);

  // 已加载 - 显示图标
  if (dataUrl) {
    return (
      <img
        src={dataUrl}
        alt=""
        className={`flex-shrink-0 object-contain ${className ?? ""}`}
        style={{ ...sizeStyle, imageRendering: "pixelated" }}
      />
    );
  }

  // 加载中 - 骨架屏
  if (isLoading) {
    return (
      <span
        ref={containerRef}
        className={`flex-shrink-0 animate-pulse bg-[#3c3c3c] rounded ${className ?? ""}`}
        style={sizeStyle}
      />
    );
  }

  // 未加载 / 无路径 - fallback
  return (
    <span
      ref={containerRef}
      className={`flex-shrink-0 flex items-center justify-center ${className ?? ""}`}
      style={sizeStyle}
    >
      {fallback ?? (
        <span
          className="bg-[#3c3c3c] rounded flex items-center justify-center"
          style={sizeStyle}
        />
      )}
    </span>
  );
}
