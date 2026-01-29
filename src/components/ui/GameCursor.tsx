/**
 * GameCursor Component - based on JxqyHD Engine/Gui/MouseGui.cs
 * Custom game cursor using ASF sprite from resources
 *
 * C# Reference: MouseGui.cs loads mouse.asf from UI_Settings.ini [Mouse] section
 * Resource: asf/ui/common/mouse.asf
 *
 * 实现方式：使用 CSS cursor 属性设置自定义鼠标图像
 * - 预加载 ASF 帧并转换为 data URL
 * - 使用 CSS 自定义属性和动画实现帧切换（如果是多帧）
 * - 比 DOM 跟随方案更轻量，且在拖拽时也能正常显示
 *
 * 优点：
 * 1. 不需要 mousemove 事件监听
 * 2. 不需要 requestAnimationFrame 更新位置
 * 3. 浏览器原生处理鼠标位置，更流畅
 * 4. 拖拽时也能正常显示（会显示拖拽图像，但不会卡住）
 */
import React, { useEffect, useRef } from "react";
import { loadAsf, getFrameCanvas, type AsfData } from "../../engine/sprite/asf";

// UI配置 - 对应 UI_Settings.ini 中的 [Mouse] 部分
const MOUSE_CONFIG = {
  image: "asf/ui/common/mouse.asf",
};

// 全局缓存 - 存储预渲染的帧 data URL
let cachedAsfData: AsfData | null = null;
let cachedFrameDataUrls: string[] = [];
let cacheLoadPromise: Promise<void> | null = null;

/**
 * 预加载鼠标指针 ASF 并缓存所有帧的 data URL
 *
 * 注意：直接使用 canvas.toDataURL() 生成的 data URL
 * 这不会在 Network 面板产生请求，因为 data URL 是同步生成的内联数据
 *
 * 之前尝试用 fetch(dataUrl) 转换为 blob URL 的方案反而会在 Network 面板
 * 产生 data:image 请求和 blob:http 条目
 */
async function ensureCursorLoaded(): Promise<{ asf: AsfData; dataUrls: string[] } | null> {
  if (cachedAsfData && cachedFrameDataUrls.length > 0) {
    return { asf: cachedAsfData, dataUrls: cachedFrameDataUrls };
  }

  if (cacheLoadPromise) {
    await cacheLoadPromise;
    if (cachedAsfData && cachedFrameDataUrls.length > 0) {
      return { asf: cachedAsfData, dataUrls: cachedFrameDataUrls };
    }
    return null;
  }

  cacheLoadPromise = (async () => {
    const fullPath = `/resources/${MOUSE_CONFIG.image}`;
    const data = await loadAsf(fullPath);
    if (data && data.frames.length > 0) {
      cachedAsfData = data;
      // 直接转换每帧为 data URL（同步操作，不产生网络请求）
      cachedFrameDataUrls = data.frames.map(frame => {
        const canvas = getFrameCanvas(frame);
        return canvas.toDataURL('image/png');
      });
    }
  })();

  await cacheLoadPromise;

  if (cachedAsfData && cachedFrameDataUrls.length > 0) {
    return { asf: cachedAsfData, dataUrls: cachedFrameDataUrls };
  }
  return null;
}

/**
 * 生成 CSS cursor 值
 * CSS cursor 语法: url(image) hotspotX hotspotY, fallback
 * hotspot 是鼠标点击的实际位置（相对于图像左上角）
 */
function getCursorCssValue(dataUrl: string): string {
  // 鼠标指针的热点通常在左上角或稍微偏移
  // 对于箭头鼠标，热点通常是 (0, 0) 或 (1, 1)
  return `url(${dataUrl}) 0 0, auto`;
}

/**
 * 全局样式 ID
 */
const CURSOR_STYLE_ID = "game-cursor-style";

/**
 * 当前动画帧索引（全局共享）
 */
let currentFrameIndex = 0;
let animationTimer: number | null = null;

/**
 * 样式是否已经初始化（所有帧的 CSS 类已创建）
 */
let stylesInitialized = false;

/**
 * 总帧数
 */
let totalFrames = 0;

/**
 * 当前容器元素引用（用于切换类名）
 */
let currentContainerElement: HTMLElement | null = null;

/**
 * 初始化所有帧的 CSS 样式（只执行一次）
 * 为每个帧创建单独的 CSS 类，之后只需切换类名，不需要重写 CSS
 */
function initializeCursorStyles(dataUrls: string[]) {
  if (stylesInitialized) return;

  const styleEl = document.getElementById(CURSOR_STYLE_ID);
  if (!styleEl) return;

  totalFrames = dataUrls.length;

  // 生成所有帧的 CSS 类
  let cssContent = `
    /* 基础样式 */
    .game-cursor-container,
    .game-cursor-container * {
      user-select: none !important;
      -webkit-user-select: none !important;
      -moz-user-select: none !important;
      -ms-user-select: none !important;
    }
  `;

  // 为每个帧创建单独的类
  dataUrls.forEach((dataUrl, index) => {
    const cursorValue = getCursorCssValue(dataUrl);
    cssContent += `
    .game-cursor-frame-${index},
    .game-cursor-frame-${index} * {
      cursor: ${cursorValue} !important;
    }
    `;
  });

  styleEl.textContent = cssContent;
  stylesInitialized = true;
}

/**
 * 切换到指定帧（通过切换类名，不重写 CSS）
 */
function switchToFrame(frameIndex: number) {
  if (!currentContainerElement || totalFrames === 0) return;

  // 移除所有帧类名
  for (let i = 0; i < totalFrames; i++) {
    currentContainerElement.classList.remove(`game-cursor-frame-${i}`);
  }
  // 添加当前帧类名
  currentContainerElement.classList.add(`game-cursor-frame-${frameIndex}`);
}

/**
 * 设置容器元素
 */
function setContainerElement(element: HTMLElement | null) {
  currentContainerElement = element;
}

/**
 * 启动 cursor 动画（多帧时）
 */
function startCursorAnimation(asf: AsfData, dataUrls: string[]) {
  if (animationTimer !== null) return; // 已经在运行

  // 初始化所有帧的 CSS 样式（只执行一次）
  initializeCursorStyles(dataUrls);

  if (dataUrls.length <= 1) {
    // 单帧，不需要动画
    switchToFrame(0);
    return;
  }

  const interval = asf.interval > 0 ? asf.interval : 100;

  const animate = () => {
    currentFrameIndex = (currentFrameIndex + 1) % dataUrls.length;
    switchToFrame(currentFrameIndex);
    animationTimer = window.setTimeout(animate, interval);
  };

  // 初始设置
  currentFrameIndex = 0;
  switchToFrame(0);
  animationTimer = window.setTimeout(animate, interval);
}

/**
 * 停止 cursor 动画
 */
function stopCursorAnimation() {
  if (animationTimer !== null) {
    clearTimeout(animationTimer);
    animationTimer = null;
  }
}

interface GameCursorProps {
  /** 是否启用自定义鼠标指针 */
  enabled?: boolean;
  /** 容器元素引用（未使用，保留兼容性） */
  containerRef?: React.RefObject<HTMLElement | null>;
}

/**
 * 自定义游戏鼠标指针组件
 *
 * 使用方法：
 * 使用 <GameCursorContainer> 包裹需要自定义鼠标的区域
 *
 * 注意：
 * - 使用 CSS cursor 属性，比 DOM 跟随方案更轻量
 * - 多帧动画通过定时器切换 CSS 实现
 * - 拖拽时浏览器会显示拖拽图像，自定义鼠标暂时不可见是正常的
 */
export const GameCursor: React.FC<GameCursorProps> = ({
  enabled = true,
}) => {
  const cursorDataRef = useRef<{ asf: AsfData; dataUrls: string[] } | null>(null);

  // 加载鼠标指针 ASF
  useEffect(() => {
    if (!enabled) return;

    let cancelled = false;

    ensureCursorLoaded().then(data => {
      if (cancelled) return;
      if (data) {
        cursorDataRef.current = data;
        startCursorAnimation(data.asf, data.dataUrls);
      }
    });

    return () => {
      cancelled = true;
      stopCursorAnimation();
    };
  }, [enabled]);

  // 这个组件不渲染任何 DOM，只负责加载和启动动画
  return null;
};

/**
 * 用于包裹需要自定义鼠标的区域的容器组件
 * 自动应用 cursor 样式并包含 GameCursor 组件
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
    if (document.getElementById(CURSOR_STYLE_ID)) return;

    const styleElement = document.createElement("style");
    styleElement.id = CURSOR_STYLE_ID;
    // 初始样式（隐藏系统鼠标，等待 ASF 加载）
    styleElement.textContent = `
      .game-cursor-container,
      .game-cursor-container * {
        cursor: none !important;
        user-select: none !important;
        -webkit-user-select: none !important;
        -moz-user-select: none !important;
        -ms-user-select: none !important;
      }
    `;
    document.head.appendChild(styleElement);

    return () => {
      // 不移除样式，因为可能有多个 GameCursorContainer 实例
    };
  }, [enabled]);

  // 设置容器元素引用，用于切换类名
  useEffect(() => {
    if (enabled && containerRef.current) {
      setContainerElement(containerRef.current);
    }
    return () => {
      setContainerElement(null);
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
