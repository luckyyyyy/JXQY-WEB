/**
 * DraggableWindow - 可拖拽、可调整大小的毛玻璃窗口
 *
 * 与 GlassModal 的区别：
 * - 无全屏遮罩，不阻挡游戏操作
 * - 标题栏可拖拽移动，四边/四角可调整大小
 * - 位置和尺寸持久化到 localStorage
 * - 无打开/关闭动画
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { HiOutlineXMark } from "react-icons/hi2";

const LS_KEY = "miu2d_dwindow_";

interface WindowRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

type ResizeEdge =
  | "top" | "bottom" | "left" | "right"
  | "top-left" | "top-right" | "bottom-left" | "bottom-right";

const EDGE_CURSORS: Record<ResizeEdge, string> = {
  top: "ns-resize", bottom: "ns-resize",
  left: "ew-resize", right: "ew-resize",
  "top-left": "nwse-resize", "top-right": "nesw-resize",
  "bottom-left": "nesw-resize", "bottom-right": "nwse-resize",
};

function loadRect(key: string): WindowRect | null {
  try {
    const raw = localStorage.getItem(LS_KEY + key);
    if (raw) {
      const p = JSON.parse(raw);
      if (typeof p.x === "number" && typeof p.y === "number" &&
          typeof p.width === "number" && typeof p.height === "number") {
        return p;
      }
    }
  } catch { /* ignore */ }
  return null;
}

function saveRect(key: string, rect: WindowRect) {
  try { localStorage.setItem(LS_KEY + key, JSON.stringify(rect)); } catch { /* ignore */ }
}

function isHeaderVisible(rect: WindowRect): boolean {
  const MARGIN = 40;
  return (
    rect.x + rect.width > MARGIN &&
    rect.x < window.innerWidth - MARGIN &&
    rect.y + 36 > 0 &&
    rect.y < window.innerHeight - MARGIN
  );
}

export interface DraggableWindowProps {
  visible: boolean;
  onClose: () => void;
  title: string;
  /** localStorage 持久化 key，不传则不持久化 */
  storageKey?: string;
  defaultWidth?: number;
  defaultHeight?: number;
  minWidth?: number;
  minHeight?: number;
  /** 是否允许 ESC 关闭，默认 true */
  closeOnEsc?: boolean;
  children: React.ReactNode;
}

export function DraggableWindow({
  visible,
  onClose,
  title,
  storageKey,
  defaultWidth = 600,
  defaultHeight = 480,
  minWidth = 320,
  minHeight = 200,
  closeOnEsc = true,
  children,
}: DraggableWindowProps) {
  const getDefault = useCallback((): WindowRect => ({
    x: Math.max(0, (window.innerWidth - defaultWidth) / 2),
    y: Math.max(0, (window.innerHeight - defaultHeight) / 2),
    width: defaultWidth,
    height: defaultHeight,
  }), [defaultWidth, defaultHeight]);

  const [rect, setRect] = useState<WindowRect>(() => {
    if (storageKey) {
      const stored = loadRect(storageKey);
      if (stored && isHeaderVisible(stored)) return stored;
    }
    return getDefault();
  });

  const rectRef = useRef(rect);
  rectRef.current = rect;

  // 拖拽/缩放状态
  const draggingRef = useRef(false);
  const resizingRef = useRef<ResizeEdge | null>(null);
  const interactionStartRef = useRef({ mouseX: 0, mouseY: 0, rect: { ...rect } });

  // 打开时恢复位置
  useEffect(() => {
    if (!visible || !storageKey) return;
    const stored = loadRect(storageKey);
    if (stored && isHeaderVisible(stored)) {
      setRect(stored);
    } else {
      const def = getDefault();
      setRect(def);
      saveRect(storageKey, def);
    }
  }, [visible, storageKey, getDefault]);

  // ESC 关闭
  useEffect(() => {
    if (!visible || !closeOnEsc) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [visible, onClose, closeOnEsc]);

  // 全局 mousemove/mouseup
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      const dx = e.clientX - interactionStartRef.current.mouseX;
      const dy = e.clientY - interactionStartRef.current.mouseY;
      const orig = interactionStartRef.current.rect;

      if (draggingRef.current) {
        const newRect = { ...rectRef.current, x: orig.x + dx, y: orig.y + dy };
        setRect(newRect);
        rectRef.current = newRect;
        return;
      }

      if (resizingRef.current) {
        const edge = resizingRef.current;
        let { x, y, width, height } = orig;
        if (edge.includes("right")) width = Math.max(minWidth, orig.width + dx);
        if (edge.includes("left")) { const w = Math.max(minWidth, orig.width - dx); x = orig.x + (orig.width - w); width = w; }
        if (edge.includes("bottom")) height = Math.max(minHeight, orig.height + dy);
        if (edge.startsWith("top")) { const h = Math.max(minHeight, orig.height - dy); y = orig.y + (orig.height - h); height = h; }
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
        if (storageKey) saveRect(storageKey, rectRef.current);
      }
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [storageKey, minWidth, minHeight]);

  const startDrag = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    draggingRef.current = true;
    interactionStartRef.current = { mouseX: e.clientX, mouseY: e.clientY, rect: { ...rectRef.current } };
    document.body.style.cursor = "move";
    document.body.style.userSelect = "none";
  }, []);

  const startResize = useCallback((edge: ResizeEdge) => (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    resizingRef.current = edge;
    interactionStartRef.current = { mouseX: e.clientX, mouseY: e.clientY, rect: { ...rectRef.current } };
    document.body.style.cursor = EDGE_CURSORS[edge];
    document.body.style.userSelect = "none";
  }, []);

  if (!visible) return null;

  return (
    <div
      className="fixed z-[1200]"
      style={{ left: rect.x, top: rect.y, width: rect.width, height: rect.height }}
    >
      <div className="w-full h-full flex flex-col rounded-2xl overflow-hidden
        bg-[#1e1e1e]/80 backdrop-blur-xl border border-white/15 shadow-2xl"
      >
        {/* 标题栏 - 拖拽手柄 */}
        <div
          className="flex items-center justify-between px-5 py-2.5 border-b border-white/10 flex-shrink-0 cursor-move select-none"
          onMouseDown={startDrag}
        >
          <h2 className="text-sm font-semibold text-white/90">{title}</h2>
          <button
            onClick={(e) => { e.stopPropagation(); onClose(); }}
            onMouseDown={(e) => e.stopPropagation()}
            className="w-7 h-7 flex items-center justify-center rounded-lg text-white/50 hover:text-white hover:bg-white/10 transition-colors"
          >
            <HiOutlineXMark style={{ strokeWidth: 2.2 }} />
          </button>
        </div>

        {/* 内容 */}
        <div className="flex-1 flex flex-col min-h-0">{children}</div>
      </div>

      {/* 四边 resize 手柄 */}
      <div className="absolute top-0 left-0 right-0 h-1 cursor-n-resize" onMouseDown={startResize("top")} />
      <div className="absolute bottom-0 left-0 right-0 h-1 cursor-s-resize" onMouseDown={startResize("bottom")} />
      <div className="absolute top-0 left-0 bottom-0 w-1 cursor-w-resize" onMouseDown={startResize("left")} />
      <div className="absolute top-0 right-0 bottom-0 w-1 cursor-e-resize" onMouseDown={startResize("right")} />

      {/* 四角 resize 手柄 */}
      <div className="absolute top-0 left-0 w-3 h-3 cursor-nw-resize" onMouseDown={startResize("top-left")} />
      <div className="absolute top-0 right-0 w-3 h-3 cursor-ne-resize" onMouseDown={startResize("top-right")} />
      <div className="absolute bottom-0 left-0 w-3 h-3 cursor-sw-resize" onMouseDown={startResize("bottom-left")} />
      <div className="absolute bottom-0 right-0 w-3 h-3 cursor-se-resize" onMouseDown={startResize("bottom-right")} />
    </div>
  );
}
