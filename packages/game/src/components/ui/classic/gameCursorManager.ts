import { logger } from "@miu2d/engine/core/logger";
import { type AsfData, getFrameCanvas, loadAsf } from "@miu2d/engine/resource/format/asf";

// UI 配置
const MOUSE_CONFIG = {
  image: "asf/ui/common/mouse.asf",
};

// 常量
const CURSOR_STYLE_ID = "game-cursor-style";
const CURSOR_CONTAINER_CLASS = "game-cursor-container";

// 状态
let isInitialized = false;
let isEnabled = false;
let containerElement: HTMLElement | null = null;
let styleElement: HTMLStyleElement | null = null;
let animationTimer: number | null = null;
let currentFrameIndex = 0;
let totalFrames = 0;

// 缓存
let cachedAsfData: AsfData | null = null;
let cachedFrameDataUrls: string[] = [];
let loadPromise: Promise<void> | null = null;

/**
 * 加载鼠标 ASF 资源并转换为 data URL
 * 使用 canvas.toDataURL() 直接生成，不产生网络请求
 */
async function loadCursorAsf(): Promise<void> {
  if (cachedAsfData && cachedFrameDataUrls.length > 0) return;

  if (loadPromise) {
    await loadPromise;
    return;
  }

  loadPromise = (async () => {
    // loadAsf 内部会自动添加资源根目录
    const imagePath = MOUSE_CONFIG.image;
    logger.debug(`[GameCursor] Loading cursor ASF from: ${imagePath}`);

    try {
      const data = await loadAsf(imagePath);
      if (data && data.frames.length > 0) {
        cachedAsfData = data;
        logger.debug(`[GameCursor] Loaded ${data.frames.length} frames`);

        // 直接转换每帧为 data URL（同步操作，不产生网络请求）
        cachedFrameDataUrls = data.frames.map((frame) => {
          const canvas = getFrameCanvas(frame);
          return canvas.toDataURL("image/png");
        });

        logger.debug(`[GameCursor] Created ${cachedFrameDataUrls.length} data URLs`);
      } else {
        logger.warn("[GameCursor] No frames found in cursor ASF");
      }
    } catch (error) {
      logger.error("[GameCursor] Failed to load cursor ASF:", error);
    }
  })();

  await loadPromise;
}

/**
 * 初始化所有帧的 CSS 样式（只执行一次）
 * 为每个帧创建单独的 CSS 类，之后只需切换类名
 */
function initializeCursorStyles(): void {
  if (!styleElement || cachedFrameDataUrls.length === 0) return;

  totalFrames = cachedFrameDataUrls.length;

  // 生成所有帧的 CSS 类
  let cssContent = `
    /* 基础样式 - 禁用选择 */
    .${CURSOR_CONTAINER_CLASS},
    .${CURSOR_CONTAINER_CLASS} * {
      user-select: none !important;
      -webkit-user-select: none !important;
    }
  `;

  // 为每个帧创建单独的类
  cachedFrameDataUrls.forEach((dataUrl, index) => {
    const cursorValue = `url(${dataUrl}) 0 0, auto`;
    cssContent += `
    .game-cursor-frame-${index},
    .game-cursor-frame-${index} * {
      cursor: ${cursorValue} !important;
    }
    `;
  });

  styleElement.textContent = cssContent;
  logger.debug(`[GameCursor] Initialized ${totalFrames} cursor frame styles`);
}

/**
 * 切换到指定帧（通过切换类名，不重写 CSS）
 */
function switchToFrame(frameIndex: number): void {
  if (!containerElement || totalFrames === 0) return;

  // 移除所有帧类名
  for (let i = 0; i < totalFrames; i++) {
    containerElement.classList.remove(`game-cursor-frame-${i}`);
  }
  // 添加当前帧类名
  containerElement.classList.add(`game-cursor-frame-${frameIndex}`);
}

/**
 * 启动动画
 */
function startAnimation(): void {
  if (animationTimer !== null) return;
  if (cachedFrameDataUrls.length === 0) return;

  // 单帧不需要动画
  if (cachedFrameDataUrls.length === 1) {
    switchToFrame(0);
    return;
  }

  const interval = cachedAsfData?.interval ?? 100;

  const animate = () => {
    currentFrameIndex = (currentFrameIndex + 1) % cachedFrameDataUrls.length;
    switchToFrame(currentFrameIndex);
    animationTimer = window.setTimeout(animate, interval);
  };

  currentFrameIndex = 0;
  switchToFrame(0);
  animationTimer = window.setTimeout(animate, interval);
}

/**
 * 停止动画
 */
function stopAnimation(): void {
  if (animationTimer !== null) {
    clearTimeout(animationTimer);
    animationTimer = null;
  }
}

// ========== 公共 API ==========

/**
 * 初始化游戏光标系统
 * 只需调用一次，后续可通过 enable/disable 控制
 */
export async function initGameCursor(): Promise<void> {
  if (isInitialized) return;

  await loadCursorAsf();

  isInitialized = true;
}

/**
 * 启用游戏光标
 * @param container 游戏容器元素
 */
export function enableGameCursor(container: HTMLElement): void {
  if (!isInitialized) {
    logger.warn("[GameCursor] 请先调用 initGameCursor()");
    return;
  }

  if (cachedFrameDataUrls.length === 0) {
    logger.warn("[GameCursor] 没有加载到光标帧数据");
    return;
  }

  if (isEnabled) {
    // 如果已启用但容器不同，先禁用再重新启用
    if (containerElement !== container) {
      disableGameCursor();
    } else {
      return;
    }
  }

  isEnabled = true;
  logger.debug(
    `[GameCursor] Enabling cursor on container: ${container.tagName}#${container.id || "(no-id)"}`
  );

  // 创建/更新动态样式表
  if (!styleElement) {
    styleElement = document.createElement("style");
    styleElement.id = CURSOR_STYLE_ID;
    document.head.appendChild(styleElement);
    logger.debug("[GameCursor] Created style element");
  }

  containerElement = container;

  // 初始化所有帧的 CSS 样式
  initializeCursorStyles();

  // 添加容器基础类
  container.classList.add(CURSOR_CONTAINER_CLASS);

  startAnimation();
}

/**
 * 禁用游戏光标
 */
export function disableGameCursor(): void {
  if (!isEnabled) return;
  isEnabled = false;

  stopAnimation();

  // 移除容器的所有 cursor 相关 CSS class
  if (containerElement) {
    containerElement.classList.remove(CURSOR_CONTAINER_CLASS);
    for (let i = 0; i < totalFrames; i++) {
      containerElement.classList.remove(`game-cursor-frame-${i}`);
    }
    logger.debug(`[GameCursor] Removed cursor classes from container`);
  }

  containerElement = null;
}

/**
 * 销毁游戏光标系统
 */
export function destroyGameCursor(): void {
  disableGameCursor();

  // 移除动态样式表
  if (styleElement?.parentNode) {
    styleElement.parentNode.removeChild(styleElement);
    styleElement = null;
  }

  // data URL 不需要释放（不像 blob URL）
  cachedFrameDataUrls = [];
  cachedAsfData = null;
  loadPromise = null;
  totalFrames = 0;

  isInitialized = false;
}

/**
 * 检查是否已启用
 */
export function isGameCursorEnabled(): boolean {
  return isEnabled;
}

/**
 * 检查是否已初始化
 */
export function isGameCursorInitialized(): boolean {
  return isInitialized;
}
