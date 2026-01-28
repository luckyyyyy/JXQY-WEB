/**
 * GameCursor Component - based on JxqyHD Engine/Gui/MouseGui.cs
 * Custom game cursor using ASF sprite from resources
 *
 * C# Reference: MouseGui.cs loads mouse.asf from UI_Settings.ini [Mouse] section
 * Resource: asf/ui/common/mouse.asf
 *
 * 实现方式：使用 CSS cursor: none 隐藏系统鼠标，然后用 canvas 跟随鼠标位置显示自定义指针
 *
 * 性能优化：使用 canvas 直接绘制 ASF 帧数据，避免每帧更新 img src 导致的浏览器重新解析 base64
 */
import React, { useState, useEffect, useRef, useCallback } from "react";
import { loadAsf, getFrameCanvas, type AsfData } from "../../engine/sprite/asf";

// UI配置 - 对应 UI_Settings.ini 中的 [Mouse] 部分
const MOUSE_CONFIG = {
  image: "asf/ui/common/mouse.asf",
};

// 全局缓存 - 存储预渲染的帧 canvas
let cachedAsfData: AsfData | null = null;
let cachedFrameCanvases: HTMLCanvasElement[] = [];
let cacheLoadPromise: Promise<void> | null = null;

/**
 * 预加载鼠标指针 ASF 并缓存所有帧的 canvas
 */
async function ensureCursorLoaded(): Promise<{ asf: AsfData; frames: HTMLCanvasElement[] } | null> {
  if (cachedAsfData && cachedFrameCanvases.length > 0) {
    return { asf: cachedAsfData, frames: cachedFrameCanvases };
  }

  if (cacheLoadPromise) {
    await cacheLoadPromise;
    if (cachedAsfData && cachedFrameCanvases.length > 0) {
      return { asf: cachedAsfData, frames: cachedFrameCanvases };
    }
    return null;
  }

  cacheLoadPromise = (async () => {
    const fullPath = `/resources/${MOUSE_CONFIG.image}`;
    const data = await loadAsf(fullPath);
    if (data && data.frames.length > 0) {
      cachedAsfData = data;
      cachedFrameCanvases = data.frames.map(frame => getFrameCanvas(frame));
      console.log('[GameCursor] Loaded and cached', cachedFrameCanvases.length, 'cursor frames');
    }
  })();

  await cacheLoadPromise;

  if (cachedAsfData && cachedFrameCanvases.length > 0) {
    return { asf: cachedAsfData, frames: cachedFrameCanvases };
  }
  return null;
}

interface GameCursorProps {
  /** 是否启用自定义鼠标指针 */
  enabled?: boolean;
  /** 容器元素引用（用于限制鼠标跟踪范围） */
  containerRef?: React.RefObject<HTMLElement | null>;
}

/**
 * 自定义游戏鼠标指针组件
 *
 * 使用方法：
 * 1. 在需要自定义鼠标的容器中添加 `cursor: 'none'` 样式
 * 2. 在容器内添加 <GameCursor /> 组件
 *
 * 注意：组件使用 canvas 直接绘制，避免了 React 重新渲染的性能问题
 */
export const GameCursor: React.FC<GameCursorProps> = ({
  enabled = true,
  containerRef,
}) => {
  // 鼠标位置 - 使用 ref 避免不必要的重新渲染
  const positionRef = useRef({ x: 0, y: 0 });
  const [isVisible, setIsVisible] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);

  // Canvas 和动画相关 refs
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerDivRef = useRef<HTMLDivElement>(null);
  const animationRef = useRef<number | null>(null);
  const frameIndexRef = useRef(0);
  const lastFrameTimeRef = useRef(0);
  const cursorDataRef = useRef<{ asf: AsfData; frames: HTMLCanvasElement[] } | null>(null);

  // 加载鼠标指针 ASF
  useEffect(() => {
    let cancelled = false;

    ensureCursorLoaded().then(data => {
      if (cancelled) return;
      if (data) {
        cursorDataRef.current = data;
        setIsLoaded(true);
      }
    });

    return () => {
      cancelled = true;
    };
  }, []);

  // 动画循环 - 使用 requestAnimationFrame 直接绘制到 canvas
  useEffect(() => {
    if (!enabled || !isLoaded || !isVisible) {
      return;
    }

    const cursorData = cursorDataRef.current;
    if (!cursorData) return;

    const { asf, frames } = cursorData;
    const interval = asf.interval > 0 ? asf.interval : 100;

    const animate = (timestamp: number) => {
      const canvas = canvasRef.current;
      const containerDiv = containerDivRef.current;
      if (!canvas || !containerDiv) {
        animationRef.current = requestAnimationFrame(animate);
        return;
      }

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        animationRef.current = requestAnimationFrame(animate);
        return;
      }

      // 更新位置
      containerDiv.style.left = `${positionRef.current.x}px`;
      containerDiv.style.top = `${positionRef.current.y}px`;

      // 更新帧（根据时间间隔）
      if (timestamp - lastFrameTimeRef.current >= interval) {
        lastFrameTimeRef.current = timestamp;
        frameIndexRef.current = (frameIndexRef.current + 1) % frames.length;

        // 绘制当前帧
        const frameCanvas = frames[frameIndexRef.current];
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(frameCanvas, 0, 0);
      }

      animationRef.current = requestAnimationFrame(animate);
    };

    // 初始绘制
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      if (ctx && frames.length > 0) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(frames[0], 0, 0);
      }
    }

    animationRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = null;
      }
    };
  }, [enabled, isLoaded, isVisible]);

  // 鼠标移动处理 - 直接更新 ref，不触发重新渲染
  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (containerRef?.current) {
      const rect = containerRef.current.getBoundingClientRect();
      positionRef.current = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      };
    } else {
      positionRef.current = {
        x: e.clientX,
        y: e.clientY,
      };
    }
  }, [containerRef]);

  // 鼠标进入处理
  const handleMouseEnter = useCallback(() => {
    setIsVisible(true);
  }, []);

  // 鼠标离开处理
  const handleMouseLeave = useCallback(() => {
    setIsVisible(false);
  }, []);

  // 监听鼠标事件
  useEffect(() => {
    if (!enabled) return;

    const target = containerRef?.current ?? document;
    const container = containerRef?.current;

    target.addEventListener("mousemove", handleMouseMove as EventListener);

    if (container) {
      container.addEventListener("mouseenter", handleMouseEnter);
      container.addEventListener("mouseleave", handleMouseLeave);
    } else {
      setIsVisible(true);
    }

    return () => {
      target.removeEventListener("mousemove", handleMouseMove as EventListener);
      if (container) {
        container.removeEventListener("mouseenter", handleMouseEnter);
        container.removeEventListener("mouseleave", handleMouseLeave);
      }
    };
  }, [enabled, containerRef, handleMouseMove, handleMouseEnter, handleMouseLeave]);

  // 不启用或未加载时不渲染
  if (!enabled || !isLoaded) {
    return null;
  }

  // 不可见时不渲染
  if (!isVisible) {
    return null;
  }

  const cursorData = cursorDataRef.current;
  if (!cursorData) return null;

  const { asf } = cursorData;

  return (
    <div
      ref={containerDivRef}
      style={{
        position: "absolute",
        left: positionRef.current.x,
        top: positionRef.current.y,
        width: asf.width,
        height: asf.height,
        pointerEvents: "none",
        zIndex: 99999,
        imageRendering: "pixelated",
      }}
    >
      <canvas
        ref={canvasRef}
        width={asf.width}
        height={asf.height}
        style={{
          width: "100%",
          height: "100%",
          imageRendering: "pixelated",
        }}
      />
    </div>
  );
};

/**
 * 全局样式：确保容器内所有元素都隐藏系统鼠标并禁止选择
 * 使用 !important 覆盖所有可能的 cursor 样式（如 pointer, text 等）
 */
const CURSOR_NONE_STYLE = `
  .game-cursor-container,
  .game-cursor-container * {
    cursor: none !important;
    user-select: none !important;
    -webkit-user-select: none !important;
    -moz-user-select: none !important;
    -ms-user-select: none !important;
  }
`;

/**
 * 用于包裹需要自定义鼠标的区域的容器组件
 * 自动应用 cursor: none 样式并包含 GameCursor 组件
 */
interface GameCursorContainerProps {
  children: React.ReactNode;
  /** 是否启用自定义鼠标指针 */
  enabled?: boolean;
  /** 额外的样式 */
  style?: React.CSSProperties;
  /** 额外的类名 */
  className?: string;
}

export const GameCursorContainer: React.FC<GameCursorContainerProps> = ({
  children,
  enabled = true,
  style,
  className,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);

  // 注入全局样式
  useEffect(() => {
    if (!enabled) return;

    // 检查是否已经存在样式
    const styleId = "game-cursor-style";
    if (document.getElementById(styleId)) return;

    const styleElement = document.createElement("style");
    styleElement.id = styleId;
    styleElement.textContent = CURSOR_NONE_STYLE;
    document.head.appendChild(styleElement);

    return () => {
      // 不移除样式，因为可能有多个 GameCursorContainer 实例
    };
  }, [enabled]);

  return (
    <div
      ref={containerRef}
      className={`${enabled ? "game-cursor-container" : ""} ${className || ""}`}
      style={{
        ...style,
        position: "relative",
      }}
    >
      {children}
      <GameCursor enabled={enabled} containerRef={containerRef} />
    </div>
  );
};

export default GameCursor;
