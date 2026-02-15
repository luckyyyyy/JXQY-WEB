/**
 * FloatingPanel - 可拖拽、可调整大小的浮动面板
 *
 * 特点：
 * - 通过顶栏拖拽移动位置
 * - 四边和四角拖拽调整大小
 * - 位置和尺寸持久化到 localStorage
 * - 每次打开时检测面板是否超出屏幕，超出则重置
 */

import { useAnimatedVisibility } from "@miu2d/shared";
import { useCallback, useEffect, useRef, useState } from "react";

// localStorage key
const LS_KEY = "jxqy_floating_panel_";

interface PanelRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface FloatingPanelProps {
  /** 面板唯一 ID（用于 localStorage 存储） */
  panelId: string;
  /** 是否可见 */
  visible: boolean;
  /** 关闭回调 */
  onClose: () => void;
  /** 标题 */
  title: string;
  /** 默认宽度 */
  defaultWidth?: number;
  /** 默认高度（不设则自动填充） */
  defaultHeight?: number;
  /** 最小宽度 */
  minWidth?: number;
  /** 最小高度 */
  minHeight?: number;
  /** z-index */
  zIndex?: number;
  children: React.ReactNode;
}

function loadRect(panelId: string): PanelRect | null {
  try {
    const raw = localStorage.getItem(LS_KEY + panelId);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (
        typeof parsed.x === "number" &&
        typeof parsed.y === "number" &&
        typeof parsed.width === "number" &&
        typeof parsed.height === "number"
      ) {
        return parsed as PanelRect;
      }
    }
  } catch {
    // ignore
  }
  return null;
}

function saveRect(panelId: string, rect: PanelRect) {
  try {
    localStorage.setItem(LS_KEY + panelId, JSON.stringify(rect));
  } catch {
    // ignore
  }
}

/** 检查面板头部是否在屏幕范围内 */
function isHeaderVisible(rect: PanelRect): boolean {
  const HEADER_HEIGHT = 36;
  const MARGIN = 20;
  // 头部区域：(x, y) -> (x + width, y + HEADER_HEIGHT)
  // 至少有 MARGIN px 的头部在可见区域内
  const headerRight = rect.x + rect.width;
  const headerBottom = rect.y + HEADER_HEIGHT;
  return (
    headerRight > MARGIN &&
    rect.x < window.innerWidth - MARGIN &&
    headerBottom > 0 &&
    rect.y < window.innerHeight - MARGIN
  );
}

type ResizeEdge =
  | "top"
  | "bottom"
  | "left"
  | "right"
  | "top-left"
  | "top-right"
  | "bottom-left"
  | "bottom-right";

const EDGE_CURSORS: Record<ResizeEdge, string> = {
  top: "ns-resize",
  bottom: "ns-resize",
  left: "ew-resize",
  right: "ew-resize",
  "top-left": "nwse-resize",
  "top-right": "nesw-resize",
  "bottom-left": "nesw-resize",
  "bottom-right": "nwse-resize",
};

export function FloatingPanel({
  panelId,
  visible,
  onClose,
  title,
  defaultWidth = 480,
  defaultHeight,
  minWidth = 320,
  minHeight = 200,
  zIndex = 1200,
  children,
}: FloatingPanelProps) {
  const getDefaultRect = useCallback(
    (): PanelRect => ({
      x: 0,
      y: 40,
      width: defaultWidth,
      height: defaultHeight ?? window.innerHeight - 40,
    }),
    [defaultWidth, defaultHeight]
  );

  const [rect, setRect] = useState<PanelRect>(() => {
    const stored = loadRect(panelId);
    if (stored && isHeaderVisible(stored)) return stored;
    return getDefaultRect();
  });

  // 拖拽状态
  const draggingRef = useRef(false);
  const resizingRef = useRef<ResizeEdge | null>(null);
  const dragStartRef = useRef({ mouseX: 0, mouseY: 0, rect: { ...rect } });
  const rectRef = useRef(rect);
  rectRef.current = rect;

  const { shouldRender, transitionStyle } = useAnimatedVisibility(visible);

  // 每次 visible 切换为 true 时检测位置
  useEffect(() => {
    if (!visible) return;
    const stored = loadRect(panelId);
    if (stored && isHeaderVisible(stored)) {
      setRect(stored);
    } else {
      const def = getDefaultRect();
      setRect(def);
      saveRect(panelId, def);
    }
  }, [visible, panelId, getDefaultRect]);

  // 全局 mousemove/mouseup
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (draggingRef.current) {
        const dx = e.clientX - dragStartRef.current.mouseX;
        const dy = e.clientY - dragStartRef.current.mouseY;
        const newRect = {
          ...rectRef.current,
          x: dragStartRef.current.rect.x + dx,
          y: dragStartRef.current.rect.y + dy,
        };
        setRect(newRect);
        rectRef.current = newRect;
      } else if (resizingRef.current) {
        const edge = resizingRef.current;
        const dx = e.clientX - dragStartRef.current.mouseX;
        const dy = e.clientY - dragStartRef.current.mouseY;
        const orig = dragStartRef.current.rect;
        let { x, y, width, height } = orig;

        if (edge.includes("right")) {
          width = Math.max(minWidth, orig.width + dx);
        }
        if (edge.includes("left")) {
          const newWidth = Math.max(minWidth, orig.width - dx);
          x = orig.x + (orig.width - newWidth);
          width = newWidth;
        }
        if (edge.includes("bottom")) {
          height = Math.max(minHeight, orig.height + dy);
        }
        if (edge === "top" || edge === "top-left" || edge === "top-right") {
          const newHeight = Math.max(minHeight, orig.height - dy);
          y = orig.y + (orig.height - newHeight);
          height = newHeight;
        }

        const newRect = { x, y, width, height };
        setRect(newRect);
        rectRef.current = newRect;
      }
    };

    const handleMouseUp = () => {
      if (draggingRef.current || resizingRef.current) {
        draggingRef.current = false;
        resizingRef.current = null;
        document.body.style.cursor = "";
        document.body.style.userSelect = "";

        // 贴边吸附 + 尺寸裁剪：确保面板完全在屏幕内
        const cur = { ...rectRef.current };
        const vw = window.innerWidth;
        const vh = window.innerHeight;
        let snappedEdge = false;

        // 宽度超出视口 → 裁剪到视口宽度
        if (cur.width > vw) {
          cur.width = Math.max(minWidth, vw);
        }
        // 左侧超出 → 贴左边，高度最大化
        if (cur.x < 0) {
          cur.x = 0;
          snappedEdge = true;
        }
        // 右侧超出 → 贴右边，高度最大化
        if (cur.x + cur.width > vw) {
          cur.x = Math.max(0, vw - cur.width);
          snappedEdge = true;
        }
        // 贴边后高度拉满（减去顶栏 40px）
        if (snappedEdge) {
          cur.y = 40;
          cur.height = vh - 40;
        } else {
          // 上方超出 → 贴顶部
          if (cur.y < 0) {
            cur.y = 0;
          }
        }

        if (
          cur.x !== rectRef.current.x ||
          cur.y !== rectRef.current.y ||
          cur.width !== rectRef.current.width ||
          cur.height !== rectRef.current.height
        ) {
          setRect(cur);
          rectRef.current = cur;
        }

        saveRect(panelId, rectRef.current);
      }
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [panelId, minWidth, minHeight]);

  const startDrag = useCallback((e: React.MouseEvent) => {
    // 只处理左键
    if (e.button !== 0) return;
    e.preventDefault();
    draggingRef.current = true;
    dragStartRef.current = { mouseX: e.clientX, mouseY: e.clientY, rect: { ...rectRef.current } };
    document.body.style.cursor = "grabbing";
    document.body.style.userSelect = "none";
  }, []);

  const startResize = useCallback((edge: ResizeEdge, e: React.MouseEvent) => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    resizingRef.current = edge;
    dragStartRef.current = { mouseX: e.clientX, mouseY: e.clientY, rect: { ...rectRef.current } };
    document.body.style.cursor = EDGE_CURSORS[edge];
    document.body.style.userSelect = "none";
  }, []);

  if (!shouldRender) return null;

  const EDGE_SIZE = 5;

  return (
    <div
      className="fixed flex flex-col bg-black/60 backdrop-blur-xl border border-white/10 shadow-2xl rounded-lg overflow-hidden"
      style={{
        left: rect.x,
        top: rect.y,
        width: rect.width,
        height: rect.height,
        zIndex,
        ...transitionStyle,
      }}
    >
      {/* 调整大小 边缘热区 */}
      {/* 上 */}
      <div
        className="absolute top-0 left-2 right-2 h-[5px] cursor-ns-resize z-10"
        onMouseDown={(e) => startResize("top", e)}
      />
      {/* 下 */}
      <div
        className="absolute bottom-0 left-2 right-2 h-[5px] cursor-ns-resize z-10"
        onMouseDown={(e) => startResize("bottom", e)}
      />
      {/* 左 */}
      <div
        className="absolute top-2 bottom-2 left-0 w-[5px] cursor-ew-resize z-10"
        onMouseDown={(e) => startResize("left", e)}
      />
      {/* 右 */}
      <div
        className="absolute top-2 bottom-2 right-0 w-[5px] cursor-ew-resize z-10"
        onMouseDown={(e) => startResize("right", e)}
      />
      {/* 四角 */}
      <div
        className="absolute top-0 left-0 w-[8px] h-[8px] cursor-nwse-resize z-20"
        onMouseDown={(e) => startResize("top-left", e)}
      />
      <div
        className="absolute top-0 right-0 w-[8px] h-[8px] cursor-nesw-resize z-20"
        onMouseDown={(e) => startResize("top-right", e)}
      />
      <div
        className="absolute bottom-0 left-0 w-[8px] h-[8px] cursor-nesw-resize z-20"
        onMouseDown={(e) => startResize("bottom-left", e)}
      />
      <div
        className="absolute bottom-0 right-0 w-[8px] h-[8px] cursor-nwse-resize z-20"
        onMouseDown={(e) => startResize("bottom-right", e)}
      />

      {/* 可拖拽头部 */}
      <div
        className="flex items-center justify-between px-4 py-2 border-b border-white/10 flex-shrink-0 cursor-grab active:cursor-grabbing select-none"
        onMouseDown={startDrag}
      >
        <h2 className="text-sm font-semibold text-white/80">{title}</h2>
        <button
          type="button"
          onClick={onClose}
          onMouseDown={(e) => e.stopPropagation()}
          className="w-7 h-7 flex items-center justify-center rounded-lg text-white/40 hover:text-white hover:bg-white/10 transition-colors"
        >
          ✕
        </button>
      </div>

      {/* 内容 */}
      <div className="flex-1 overflow-y-auto">{children}</div>
    </div>
  );
}
