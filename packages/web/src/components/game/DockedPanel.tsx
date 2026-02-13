/**
 * DockedPanel - 固定在左侧的面板
 *
 * 特点：
 * - 固定在界面左侧，占据游戏位置（非 fixed 浮动）
 * - 不可拖拽、不可调整位置
 * - 仅支持通过右侧边缘调整宽度
 * - 宽度持久化到 localStorage
 */

import { useCallback, useEffect, useRef, useState } from "react";

const LS_KEY = "jxqy_docked_panel_";

interface DockedPanelProps {
  /** 面板唯一 ID（用于 localStorage 存储宽度） */
  panelId: string;
  /** 是否可见 */
  visible: boolean;
  /** 关闭回调 */
  onClose: () => void;
  /** 标题 */
  title: string;
  /** 默认宽度 */
  defaultWidth?: number;
  /** 最小宽度 */
  minWidth?: number;
  /** 最大宽度（默认 50vw） */
  maxWidth?: number;
  children: React.ReactNode;
}

function loadWidth(panelId: string): number | null {
  try {
    const raw = localStorage.getItem(LS_KEY + panelId);
    if (raw) {
      const val = Number(raw);
      if (!Number.isNaN(val) && val > 0) return val;
    }
  } catch {
    // ignore
  }
  return null;
}

function saveWidth(panelId: string, width: number) {
  try {
    localStorage.setItem(LS_KEY + panelId, String(width));
  } catch {
    // ignore
  }
}

export function DockedPanel({
  panelId,
  visible,
  onClose,
  title,
  defaultWidth = 420,
  minWidth = 280,
  maxWidth,
  children,
}: DockedPanelProps) {
  const [width, setWidth] = useState(() => loadWidth(panelId) ?? defaultWidth);
  const resizingRef = useRef(false);
  const startXRef = useRef(0);
  const startWidthRef = useRef(0);

  // 同步 ref
  const widthRef = useRef(width);
  widthRef.current = width;

  const effectiveMaxWidth = maxWidth ?? Math.floor(window.innerWidth * 0.5);

  const startResize = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    resizingRef.current = true;
    startXRef.current = e.clientX;
    startWidthRef.current = widthRef.current;
    document.body.style.cursor = "ew-resize";
    document.body.style.userSelect = "none";
  }, []);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!resizingRef.current) return;
      const dx = e.clientX - startXRef.current;
      const newWidth = Math.max(minWidth, Math.min(effectiveMaxWidth, startWidthRef.current + dx));
      setWidth(newWidth);
      widthRef.current = newWidth;
    };

    const handleMouseUp = () => {
      if (!resizingRef.current) return;
      resizingRef.current = false;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      saveWidth(panelId, widthRef.current);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [panelId, minWidth, effectiveMaxWidth]);

  if (!visible) return null;

  return (
    <div
      className="flex-shrink-0 flex flex-col bg-[#252526] border-r border-[#333] relative h-full"
      style={{ width }}
    >
      {/* 标题栏 */}
      <div className="flex items-center justify-between px-3 py-1 border-b border-white/[0.06] flex-shrink-0 select-none bg-white/[0.03]">
        <h2 className="text-xs font-semibold text-[#d4d4d4]">{title}</h2>
        <button
          type="button"
          onClick={onClose}
          className="w-6 h-6 flex items-center justify-center rounded text-[#969696] hover:text-[#d4d4d4] hover:bg-white/10 transition-colors text-xs"
        >
          ✕
        </button>
      </div>

      {/* 内容 */}
      <div className="flex-1 overflow-y-auto">{children}</div>

      {/* 右侧调整宽度手柄 */}
      <div
        className="absolute top-0 right-0 w-[5px] h-full cursor-ew-resize z-10 hover:bg-[#007acc] active:bg-[#007acc] transition-colors"
        onMouseDown={startResize}
      />
    </div>
  );
}
